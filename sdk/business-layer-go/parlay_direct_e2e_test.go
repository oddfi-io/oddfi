//go:build e2e

// parlay_direct_e2e_test.go — DIRECT-EOA (non-Magic, non-relay) on-chain
// exercise of the parlay (串关) lifecycle, mirroring oddfi-ODD's
// test/ParlayModule.t.sol + the parlay rows of test/FundsFlowMatrix.t.sol.
//
// Like cash_out_direct_e2e_test.go, the bettor signs every user-side tx itself
// with a hardcoded key (bettorKey) and pays its own gas — no Magic, no sponsor.
// Admin-side ops (OpenMarket / settle / finalize / SettleParlay /
// ReleasePayoutReserve) go through the direct-signed admin client. Reads
// (PreviewParlay / GetParlay / EstimateParlayValue) go through the read client,
// which is wired with the BettingParlayLens address.
//
// Keys + funding are the operator's responsibility (fill bettorKeyHex /
// adminKeyHex; pre-fund both with tBNB; the bettor with ODD for the stake +
// global-LP deposit). The legs all use marketType 0 (X12); outcome 0 = home win,
// so scores with home > away make every leg win.
//
// Four tests (run individually with -run):
//   TestParlayDirectE2E          full win → settleParlay → estimate → claim
//   TestParlayReserveReleaseE2E  win → settleParlay → releasePayoutReserve (no claim)
//   TestParlayPreviewCapE2E      6 legs → PreviewParlay asserts cappedByPayout
//   TestParlaySameMatchRevertE2E two legs on one match → placeParlay reverts
//
// Run e.g.:
//
//	go test -tags e2e -run TestParlayDirectE2E -v -timeout 25m ./...

package business_test

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"math/big"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/shopspring/decimal"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"

	business "github.com/Crypto-Barrett/contracts-business-layer"
	"github.com/Crypto-Barrett/contracts-business-layer/admin"
	"github.com/Crypto-Barrett/contracts-business-layer/cache"
	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
	"github.com/Crypto-Barrett/contracts-business-layer/read"
	"github.com/Crypto-Barrett/oddfi-ODD-SDK/pkg/oddfi"
)

// ── fixed parameters (BSC testnet) ──────────────────────────────────────────
//
// Keys are stored WITHOUT the 0x prefix (crypto.HexToECDSA rejects 0x).
const (
	// admin / settler EOA: 0xf56381db8696b0121b7cdb1d00437c7b6c5f053b04602bfba8947280f407e796
	parlayAdminKeyHex = "f56381db8696b0121b7cdb1d00437c7b6c5f053b04602bfba8947280f407e796"
	// bettor (user) EOA: 0xfad9c882d1476552a1161e5633e2b99da909655128df61f01fd4582c74191c12
	parlayBettorKeyHex = "fad9c882d1476552a1161e5633e2b99da909655128df61f01fd4582c74191c12"

	// Deployed proxy / lens addresses on BSC testnet.
	parlayODDTokenAddr      = "0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0"
	parlayStakingPoolAddr   = "0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A"
	parlayLiquidityPoolAddr = "0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa"
	parlayBettingPoolAddr   = "0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291"
	// BettingParlayLens deployed 2026-06-07 on BSC testnet (parlay MVP upgrade).
	parlayLensAddr = "0x8df283608c37c387513810cdf9e3de171b09f6fc"
)

// parlayEnv bundles the wired clients + keys shared by the parlay e2e tests.
type parlayEnv struct {
	ctx     context.Context
	eth     *ethclient.Client
	sdk     *oddfi.Client
	admin   *admin.Client
	read    *read.Client
	chainID *big.Int

	adminKey, bettorKey   *ecdsa.PrivateKey
	adminAddr, bettorAddr common.Address

	odd, bp, sp, lp common.Address
	runTag          string
	one18           *big.Int
}

func newParlayEnv(t *testing.T, ctx context.Context) *parlayEnv {
	t.Helper()

	adminKey, err := crypto.HexToECDSA(parlayAdminKeyHex)
	if err != nil {
		t.Fatalf("parse adminKey: %v", err)
	}
	bettorKey, err := crypto.HexToECDSA(parlayBettorKeyHex)
	if err != nil {
		t.Fatalf("parse bettorKey: %v", err)
	}
	adminAddr := crypto.PubkeyToAddress(adminKey.PublicKey)
	bettorAddr := crypto.PubkeyToAddress(bettorKey.PublicKey)
	t.Logf("admin=%s bettor=%s", adminAddr.Hex(), bettorAddr.Hex())

	multicallAddr := common.Address{}
	if addrMulticall3 != "" {
		multicallAddr = common.HexToAddress(addrMulticall3)
	}
	odd := common.HexToAddress(parlayODDTokenAddr)
	bp := common.HexToAddress(parlayBettingPoolAddr)
	sp := common.HexToAddress(parlayStakingPoolAddr)
	lp := common.HexToAddress(parlayLiquidityPoolAddr)

	db, err := gorm.Open(mysql.Open(scenarioMySQLDSN), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	chainID := big.NewInt(scenarioChainID)

	eth, err := ethclient.DialContext(ctx, scenarioRPCURL)
	if err != nil {
		t.Fatalf("dial eth: %v", err)
	}
	t.Cleanup(eth.Close)

	sdk, err := oddfi.NewClient(ctx, oddfi.Config{
		RPCURL:                    scenarioRPCURL,
		ODDTokenProxy:             odd,
		StakingPoolProxy:          sp,
		LiquidityPoolProxy:        lp,
		BettingPoolProxy:          bp,
		BettingParlayLensContract: common.HexToAddress(parlayLensAddr),
	})
	if err != nil {
		t.Fatalf("sdk NewClient: %v", err)
	}
	t.Cleanup(func() { _ = sdk.Close(ctx) })

	adminClients, err := business.NewAdminClients(ctx, business.AdminConfig{
		RPCURL:           scenarioRPCURL,
		ChainID:          chainID,
		AdminPrivateKey:  adminKey,
		ODDToken:         odd,
		BettingPool:      bp,
		StakingPool:      sp,
		LiquidityPool:    lp,
		MulticallAddress: multicallAddr,
		DB:               db,
		Confirmations:    2,
	})
	if err != nil {
		t.Fatalf("NewAdminClients: %v", err)
	}
	t.Cleanup(func() { _ = adminClients.Close(ctx) })

	readClients, err := business.NewReadClients(ctx, business.ReadConfig{
		RPCURL:            scenarioRPCURL,
		ChainID:           chainID,
		ODDToken:          odd,
		BettingPool:       bp,
		StakingPool:       sp,
		LiquidityPool:     lp,
		BettingParlayLens: common.HexToAddress(parlayLensAddr),
		Cache:             cache.NewInProcess(),
	})
	if err != nil {
		t.Fatalf("NewReadClients: %v", err)
	}
	t.Cleanup(func() { _ = readClients.Close(ctx) })

	return &parlayEnv{
		ctx: ctx, eth: eth, sdk: sdk,
		admin: adminClients.Admin, read: readClients.Read, chainID: chainID,
		adminKey: adminKey, bettorKey: bettorKey,
		adminAddr: adminAddr, bettorAddr: bettorAddr,
		odd: odd, bp: bp, sp: sp, lp: lp,
		runTag: fmt.Sprintf("%d", time.Now().UnixNano()),
		one18:  new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil),
	}
}

// odd converts a whole-ODD count into wei.
func (e *parlayEnv) wei(odd int64) *big.Int { return new(big.Int).Mul(big.NewInt(odd), e.one18) }

// openLeg opens an X12 (marketType 0) market for matchID with three outcomes at
// 2.0x and returns the MarketKey. Mirrors _openMarketWithMatch in the contract test.
func (e *parlayEnv) openLeg(t *testing.T, matchID coretypes.MatchID, start, end uint64, label string) coretypes.MarketKey {
	t.Helper()
	key := coretypes.MarketKey{MatchID: matchID, MarketType: 0, Line: 0}
	baseOdds := []*big.Int{big.NewInt(20000), big.NewInt(20000), big.NewInt(20000)}
	if _, err := e.admin.OpenMarketWithReceipt(e.ctx, admin.OpenMarketRequest{
		MatchID:        matchID,
		MarketType:     0,
		Line:           0,
		MatchStartTime: start,
		MatchEndTime:   end,
		BaseOdds:       baseOdds,
		UpdatedAt:      uint64(time.Now().Unix()),
		IdempotencyKey: "e2e-parlay-open-" + label + "-" + matchHex(matchID) + "-" + e.runTag,
	}); err != nil {
		t.Fatalf("OpenMarket(%s): %v", label, err)
	}
	if m, err := e.read.GetMarket(e.ctx, key); err != nil {
		t.Fatalf("GetMarket(%s): %v", label, err)
	} else if m.Status != read.MarketStatusOpen {
		t.Fatalf("market %s status = %v, want Open", label, m.Status)
	}
	return key
}

// legSnapshot reads live odds for a market and builds a parlay leg input with the
// current quote snapshot (mirrors the contract test's _leg helper).
func (e *parlayEnv) legSnapshot(t *testing.T, key coretypes.MarketKey, outcome uint8) coretypes.ParlayLegInput {
	t.Helper()
	odds, err := e.read.GetMarketOdds(e.ctx, key)
	if err != nil {
		t.Fatalf("GetMarketOdds: %v", err)
	}
	return coretypes.ParlayLegInput{
		Market:       key,
		Outcome:      outcome,
		QuoteVersion: odds.QuoteVersion.BigInt(),
		QuotedAt:     odds.UpdatedAt,
		MinOdds:      big.NewInt(10100), // 1.01x floor; non-binding
	}
}

// recordScoreAndFinalize records a market's final score (empty bet batch) then
// finalizes it as Settled — the canonical way to resolve a parlay leg's market
// (mirrors _settleByScore). The empty-batch settle is sent directly with the SDK
// calldata because the admin wrapper deliberately rejects empty bet batches.
func (e *parlayEnv) recordScoreAndFinalize(t *testing.T, key coretypes.MarketKey, home, away uint16, label string) {
	t.Helper()
	marketID := [32]byte(key.MarketID())
	settleCD, err := e.sdk.BettingPool().SettleMarketBetsByScoreCalldata(marketID, home, away, [][32]byte{})
	if err != nil {
		t.Fatalf("SettleMarketBetsByScoreCalldata(%s): %v", label, err)
	}
	sendDirectTx(t, e.ctx, e.eth, e.chainID, e.adminKey, e.adminAddr, e.bp, settleCD, "settleScore-"+label)

	// The settle tx (sendDirectTx) and the finalize tx (admin client) both sign
	// with the admin key via independent PendingNonceAt lookups. On this RPC the
	// pending-nonce view can lag a freshly-mined tx, so the finalize would grab
	// the settle's nonce and fail with "replacement transaction underpriced".
	// Wait until the node reports no in-flight admin tx before finalizing.
	e.waitAdminNonceSettled(t)

	if _, err := e.admin.FinalizeMarketSettlementWithReceipt(e.ctx, admin.FinalizeMarketSettlementRequest{
		Market:         key,
		ResultKind:     0, // Settled
		IdempotencyKey: "e2e-parlay-finalize-" + label + "-" + matchHex(key.MatchID) + "-" + e.runTag,
	}); err != nil {
		t.Fatalf("FinalizeMarketSettlement(%s): %v", label, err)
	}
}

// waitAdminNonceSettled blocks until the admin account has no in-flight tx
// (pendingNonce == latestNonce), so the next admin tx fetches a fresh nonce
// instead of racing a just-mined one. Defensive against PendingNonceAt lag on
// public RPCs (the cause of intermittent "replacement transaction underpriced").
func (e *parlayEnv) waitAdminNonceSettled(t *testing.T) {
	t.Helper()
	for i := 0; i < 45; i++ {
		latest, err1 := e.eth.NonceAt(e.ctx, e.adminAddr, nil)
		pending, err2 := e.eth.PendingNonceAt(e.ctx, e.adminAddr)
		if err1 == nil && err2 == nil && pending == latest {
			return
		}
		time.Sleep(2 * time.Second)
	}
	t.Logf("warning: admin nonce did not settle (pending != latest) after wait")
}

// ensureRoles grants OPERATOR_ROLE + SETTLER_ROLE to the admin if missing.
func (e *parlayEnv) ensureRoles(t *testing.T, anchor coretypes.MatchID) {
	t.Helper()
	ensureOperatorRole(t, e.ctx, e.admin, e.read, e.adminAddr, anchor, e.runTag)
	settlerRole := crypto.Keccak256Hash([]byte("SETTLER_ROLE"))
	if has, _ := e.read.HasRole(e.ctx, settlerRole, e.adminAddr); !has {
		if _, err := e.admin.GrantRoleWithReceipt(e.ctx, admin.GrantRoleRequest{
			Role:           settlerRole,
			Account:        e.adminAddr,
			IdempotencyKey: "e2e-parlay-grant-settler-" + matchHex(anchor) + "-" + e.runTag,
		}); err != nil {
			t.Fatalf("GrantRole SETTLER: %v", err)
		}
	}
}

// approveAndFundBettor approves BettingPool (stake+tax) and ensures the global LP
// has enough requestable liquidity to reserve a parlay's max payout. The global
// pool is shared and persistent across runs, so on a funded testnet the deposit
// is a no-op — depositing every run would needlessly drain the bettor's ODD
// (and eventually fail with ERC20InsufficientBalance).
func (e *parlayEnv) approveAndFundBettor(t *testing.T, stake *big.Int) {
	t.Helper()
	// Approve BettingPool generously (stake + payout-tax headroom).
	bpApprove := new(big.Int).Mul(stake, big.NewInt(3))
	if cd, err := e.sdk.ODDToken().ApproveCalldata(e.bp, bpApprove); err != nil {
		t.Fatalf("ApproveCalldata(BP): %v", err)
	} else {
		sendDirectTx(t, e.ctx, e.eth, e.chainID, e.bettorKey, e.bettorAddr, e.odd, cd, "approve→BP")
	}

	// Skip the LP top-up when requestable liquidity already dwarfs a parlay's
	// reserved payout (~400 ODD here). Threshold = minDeposit (1000 ODD).
	if req, err := e.read.RequestableLiquidity(e.ctx); err == nil && req.Cmp(decimalFromWei(e.wei(lpMinDepositODD))) >= 0 {
		t.Logf("  requestableLiquidity=%s ODD ≥ %d — skipping global LP deposit", req.Div(decimalE18()), lpMinDepositODD)
		return
	}

	// Otherwise approve + deposit minDeposit (1000 ODD) into the global LP.
	lpAmount := e.wei(lpMinDepositODD)
	if cd, err := e.sdk.ODDToken().ApproveCalldata(e.lp, lpAmount); err != nil {
		t.Fatalf("ApproveCalldata(LP): %v", err)
	} else {
		sendDirectTx(t, e.ctx, e.eth, e.chainID, e.bettorKey, e.bettorAddr, e.odd, cd, "approve→LP")
	}
	if cd, err := e.sdk.LiquidityPool().DepositGlobalCalldata(lpAmount, 0); err != nil {
		t.Fatalf("DepositGlobalCalldata: %v", err)
	} else {
		sendDirectTx(t, e.ctx, e.eth, e.chainID, e.bettorKey, e.bettorAddr, e.lp, cd, "depositGlobal")
	}
}

// placeParlayDirect builds + sends placeParlay as a direct bettor tx and returns
// the parlayID parsed from the ParlayPlaced event.
func (e *parlayEnv) placeParlayDirect(t *testing.T, legs []coretypes.ParlayLegInput, stake, minComboOdds *big.Int, deadline uint64) coretypes.ParlayID {
	t.Helper()
	cd, err := e.sdk.BettingPool().PlaceParlayCalldata(toSDKLegs(legs), stake, minComboOdds, new(big.Int).SetUint64(deadline), common.Address{})
	if err != nil {
		t.Fatalf("PlaceParlayCalldata: %v", err)
	}
	rcpt := sendDirectTx(t, e.ctx, e.eth, e.chainID, e.bettorKey, e.bettorAddr, e.bp, cd, "placeParlay")
	id := extractParlayID(t, rcpt, e.bp)
	t.Logf("  parlay_id=%x", id)
	return id
}

// ════════════════════════════════════════════════════════════════════════════
// Test 1: full win → settleParlay → estimate → claim
// (mirrors testParlayFullWinClaimAndEstimatedValue)
// ════════════════════════════════════════════════════════════════════════════
/*
  === RUN   TestParlayDirectE2E
    admin=0x7501bCBFAAa99e6390577277D051A32ec2e64064 bettor=0x83547Ed07e72979aEE115dd29a40FA1200769f56
    === open 2 legs ===
      approve→BP    tx=0xe2bb5607c3d67e3177f94e62de001bf53512fce79b9d48684487a8504357f718  mined block=111928794
  gas_used=30956  ✓
      approve→LP    tx=0x90d69e581a19fcc24d1fa08e904249edf34a46699c2432cc93788b7818e55876  mined block=111928803
  gas_used=50856  ✓
      depositGlobal tx=0xb184331c188ce9b14fcecbe79625159c9bda77d0b3d5619bbb99255509bea99b  mined block=111928812
  gas_used=249741 ✓
    === PreviewParlay ===
      combo=4 maxPayout=400000000000000000000 cappedOdds=false cappedPayout=false
    === placeParlay ===
      placeParlay tx=0x77c5e5c59aca0593d684c5d871df86032d35e17c86273748714b45f46f6fb99f  mined block=111928824
  gas_used=894351 ✓
      parlay_id=954c6c41b7c6b46ffd480092cc2ae2cd10d4c97e11aa597c37c6beb13703a258
      state=Pending maxPayout=400000000000000000000 legCount=2
    === waiting until matchEnd=1780811794 ===
    === record scores + finalize both markets (home wins) ===
      settleScore-A tx=0x25f03410cd8d1a92f0c85fa8c17c0fa3914a574ff8b7f5fc182672c9a5b3ccfd  mined block=111930524
  gas_used=136994 ✓
      settleScore-B tx=0xae92055a9440f8e3d78bdbc5f19b3f2dcc9ce3ee1d9ea94154bcae40d6f0556a  mined block=111930543
  gas_used=136982 ✓
    === settleParlay ===
      state=WonUnclaimed claimable=400000000000000000000
    === EstimateParlayValue ===
      estimated=400000000000000000000 isFinal=true state=WonUnclaimed
    === claimParlayPayout ===
      claimParlay tx=0x186c26a72113fb20892ed3c98253473e72b5b4b868ee1929db2f300ff88fa902  mined block=111930570
  gas_used=147742 ✓
      state = WonClaimed ✓
  --- PASS: TestParlayDirectE2E (813.63s)
*/
func TestParlayDirectE2E(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Minute)
	t.Cleanup(cancel)
	e := newParlayEnv(t, ctx)

	now := uint64(time.Now().Unix())
	start := now + 12*60 // markets auto-lock here: place must land before this
	end := now + 13*60   // settle allowed after this
	matchA := scenarioMatchID(now)
	matchB := scenarioMatchID(now + 1)
	e.ensureRoles(t, matchA)

	t.Log("=== open 2 legs ===")
	keyA := e.openLeg(t, matchA, start, end, "A")
	keyB := e.openLeg(t, matchB, start, end, "B")

	stake := e.wei(100)
	e.approveAndFundBettor(t, stake)

	legs := []coretypes.ParlayLegInput{e.legSnapshot(t, keyA, 0), e.legSnapshot(t, keyB, 0)}

	t.Log("=== PreviewParlay ===")
	pv, err := e.read.PreviewParlay(ctx, legs, decimalFromWei(stake), e.bettorAddr)
	if err != nil {
		t.Fatalf("PreviewParlay: %v", err)
	}
	t.Logf("  combo=%s maxPayout=%s cappedOdds=%v cappedPayout=%v",
		pv.LockedComboOdds, pv.MaxPayout, pv.CappedByOdds, pv.CappedByPayout)
	if pv.CappedByPayout {
		t.Fatalf("did not expect payout cap for a 100 ODD 2-leg parlay")
	}

	t.Log("=== placeParlay ===")
	parlayID := e.placeParlayDirect(t, legs, stake, big.NewInt(39000), now+1*60*60)

	if p, err := e.read.GetParlay(ctx, parlayID); err != nil {
		t.Fatalf("GetParlay (post-place): %v", err)
	} else if p.State != read.ParlayPending {
		t.Fatalf("post-place state = %v, want Pending", p.State)
	} else {
		t.Logf("  state=Pending maxPayout=%s legCount=%d", p.MaxPayout, p.LegCount)
	}

	t.Log("=== EstimateParlayValue (Pending window) ===")
	// As of the 2026-06-08 modular-entrypoint upgrade EstimateParlayValue is a
	// user-scoped query that only resolves a Pending parlay (it reverts once the
	// parlay leaves Pending). Probe it here, before settlement.
	if est, err := e.read.EstimateParlayValue(ctx, e.bettorAddr, parlayID); err != nil {
		t.Fatalf("EstimateParlayValue (pending): %v", err)
	} else {
		t.Logf("  estimated=%s floatingPnL=%s state=%v isFinal=%v", est.EstimatedValue, est.FloatingPnL, est.State, est.IsFinal)
		if est.State != read.ParlayPending {
			t.Errorf("estimate state = %v, want Pending", est.State)
		}
		if est.IsFinal {
			t.Errorf("expected isFinal=false while Pending")
		}
	}

	t.Logf("=== waiting until matchEnd=%d ===", end)
	scenarioWaitTimestamp(t, ctx, e.eth, end+5)

	t.Log("=== record scores + finalize both markets (home wins) ===")
	e.recordScoreAndFinalize(t, keyA, 2, 1, "A")
	e.recordScoreAndFinalize(t, keyB, 1, 0, "B")

	t.Log("=== settleParlay ===")
	if _, err := e.admin.SettleParlayWithReceipt(ctx, admin.SettleParlayRequest{
		ParlayID:       parlayID,
		IdempotencyKey: "e2e-parlay-settle-" + e.runTag,
	}); err != nil {
		t.Fatalf("SettleParlay: %v", err)
	}
	settled, err := e.read.GetParlay(ctx, parlayID)
	if err != nil {
		t.Fatalf("GetParlay (post-settle): %v", err)
	}
	if settled.State != read.ParlayWonUnclaimed {
		t.Fatalf("post-settle state = %v, want WonUnclaimed", settled.State)
	}
	t.Logf("  state=WonUnclaimed claimable=%s", settled.ClaimablePayout)

	// Post-settle the parlay is no longer Pending, so EstimateParlayValue now
	// reverts by design; the post-match claimable view is GetParlayClaimStatus.
	t.Log("=== GetParlayClaimStatus (post-settle) ===")
	if cs, err := e.read.GetParlayClaimStatus(ctx, e.bettorAddr, parlayID); err != nil {
		t.Fatalf("GetParlayClaimStatus: %v", err)
	} else {
		t.Logf("  won=%v reward=%s", cs.Won, cs.Reward)
		if !cs.Won {
			t.Errorf("expected won=true after winning settle")
		}
		if !cs.Reward.IsPositive() {
			t.Errorf("expected positive net reward, got %s", cs.Reward)
		}
	}

	t.Log("=== claimParlayPayout ===")
	claimCD, err := e.sdk.BettingPool().ClaimParlayPayoutCalldata([32]byte(parlayID))
	if err != nil {
		t.Fatalf("ClaimParlayPayoutCalldata: %v", err)
	}
	sendDirectTx(t, ctx, e.eth, e.chainID, e.bettorKey, e.bettorAddr, e.bp, claimCD, "claimParlay")

	if p, err := e.read.GetParlay(ctx, parlayID); err != nil {
		t.Fatalf("GetParlay (post-claim): %v", err)
	} else if p.State != read.ParlayWonClaimed {
		t.Fatalf("post-claim state = %v, want WonClaimed", p.State)
	}
	t.Log("  state = WonClaimed ✓")
}

// ════════════════════════════════════════════════════════════════════════════
// Test 2: win → settleParlay → releasePayoutReserve (instead of claim)
// (mirrors testManualReleaseUnclaimedParlayReserveUnlocksGlobalLp)
// ════════════════════════════════════════════════════════════════════════════
/*
 === RUN   TestParlayReserveReleaseE2E
    admin=0x7501bCBFAAa99e6390577277D051A32ec2e64064 bettor=0x83547Ed07e72979aEE115dd29a40FA1200769f56
      approve→BP tx=0x7a1c70aaa4868993c4753937a808fca80fd088c7128eaa5009b95559be2bd9e1  mined block=111933255
  gas_used=30956 ✓
      requestableLiquidity=114475.469061988816015 ODD ≥ 1000 — skipping global LP deposit
      placeParlay tx=0x70fde00982326f83347555f77b236d6b53237093975487036370f212a058e6c0  mined block=111933263
  gas_used=808851 ✓
      parlay_id=4342d7e1b737bdc879d06e785d5d4a373b4c04f449a6125c50b864708f8cc8c5
      settleScore-A tx=0x710b0c145f7448881323c678e67cd8d4f63c47deadbbb106e69c2e82be69b5ad  mined block=111934981
  gas_used=136994 ✓
      settleScore-B tx=0x5bf5d65d4f08eb28dd2eea1afaf8bb36e909132e5a0a33e14da82edb23a6f8d8  mined block=111935003
  gas_used=136982 ✓
      riskID=ccbd93c8028e210d8601c74e48046dd84c99e6ea8a92f3cfce7a5150eb30b8e1 — releasing reserve (no claim)
      requestableLiquidity 114083469061988816015000 → 114483469061988816015000     (+400 ODD)
      reserve released ✓
  --- PASS: TestParlayReserveReleaseE2E (818.75s)
*/
func TestParlayReserveReleaseE2E(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Minute)
	t.Cleanup(cancel)
	e := newParlayEnv(t, ctx)

	now := uint64(time.Now().Unix())
	start := now + 12*60
	end := now + 13*60
	matchA := scenarioMatchID(now + 100)
	matchB := scenarioMatchID(now + 101)
	e.ensureRoles(t, matchA)

	keyA := e.openLeg(t, matchA, start, end, "A")
	keyB := e.openLeg(t, matchB, start, end, "B")

	stake := e.wei(100)
	e.approveAndFundBettor(t, stake)
	legs := []coretypes.ParlayLegInput{e.legSnapshot(t, keyA, 0), e.legSnapshot(t, keyB, 0)}
	parlayID := e.placeParlayDirect(t, legs, stake, big.NewInt(39000), now+1*60*60)

	scenarioWaitTimestamp(t, ctx, e.eth, end+5)
	e.recordScoreAndFinalize(t, keyA, 2, 1, "A")
	e.recordScoreAndFinalize(t, keyB, 1, 0, "B")

	if _, err := e.admin.SettleParlayWithReceipt(ctx, admin.SettleParlayRequest{
		ParlayID: parlayID, IdempotencyKey: "e2e-parlay-rr-settle-" + e.runTag,
	}); err != nil {
		t.Fatalf("SettleParlay: %v", err)
	}
	settled, err := e.read.GetParlay(ctx, parlayID)
	if err != nil {
		t.Fatalf("GetParlay (post-settle): %v", err)
	}
	if settled.State != read.ParlayWonUnclaimed {
		t.Fatalf("post-settle state = %v, want WonUnclaimed", settled.State)
	}
	t.Logf("  riskID=%x — releasing reserve (no claim)", settled.ParlayRiskID)

	reqBefore, _ := e.read.RequestableLiquidity(ctx)
	if _, err := e.admin.ReleasePayoutReserveWithReceipt(ctx, admin.ReleasePayoutReserveRequest{
		RiskID:         settled.ParlayRiskID,
		IdempotencyKey: "e2e-parlay-release-" + e.runTag,
	}); err != nil {
		t.Fatalf("ReleasePayoutReserve: %v", err)
	}
	reqAfter, _ := e.read.RequestableLiquidity(ctx)
	t.Logf("  requestableLiquidity %s → %s", reqBefore, reqAfter)
	if !reqAfter.GreaterThan(reqBefore) {
		t.Errorf("expected requestable liquidity to rise after reserve release, got %s → %s", reqBefore, reqAfter)
	}
	t.Log("  reserve released ✓")
}

// ════════════════════════════════════════════════════════════════════════════
// Test 3: 6 legs → PreviewParlay asserts cappedByPayout
// (mirrors testRawPayoutAboveCapStillPlacesWithCappedMaxPayout — read-only)
// ════════════════════════════════════════════════════════════════════════════
/*
=== RUN   TestParlayPreviewCapE2E
    admin=0x7501bCBFAAa99e6390577277D051A32ec2e64064 bettor=0x83547Ed07e72979aEE115dd29a40FA1200769f56
      raw=64 locked=64 maxPayout=30000000000000000000000 cappedOdds=false cappedPayout=true
      cappedByPayout ✓
  --- PASS: TestParlayPreviewCapE2E (28.74s)
  （raw 组合赔率 2^6=64x，封顶后 maxPayout=30000 ODD，cappedByPayout=true）
*/
func TestParlayPreviewCapE2E(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	t.Cleanup(cancel)
	e := newParlayEnv(t, ctx)

	now := uint64(time.Now().Unix())
	start := now + 30*60
	end := now + 31*60
	first := scenarioMatchID(now + 200)
	e.ensureRoles(t, first)

	legs := make([]coretypes.ParlayLegInput, 6)
	for i := 0; i < 6; i++ {
		mid := scenarioMatchID(now + 200 + uint64(i))
		key := e.openLeg(t, mid, start, end, fmt.Sprintf("cap%d", i))
		legs[i] = e.legSnapshot(t, key, 0)
	}

	// 1000 ODD stake × 2^6 = 64000 raw > 30000 cap → payout-capped.
	pv, err := e.read.PreviewParlay(ctx, legs, decimalFromWei(e.wei(1000)), e.bettorAddr)
	if err != nil {
		t.Fatalf("PreviewParlay: %v", err)
	}
	t.Logf("  raw=%s locked=%s maxPayout=%s cappedOdds=%v cappedPayout=%v",
		pv.RawComboOdds, pv.LockedComboOdds, pv.MaxPayout, pv.CappedByOdds, pv.CappedByPayout)
	if !pv.CappedByPayout {
		t.Fatalf("expected cappedByPayout=true for a 6-leg 1000 ODD parlay")
	}
	t.Log("  cappedByPayout ✓")
}

// ════════════════════════════════════════════════════════════════════════════
// Test 4: two legs on one match → placeParlay reverts
// (mirrors testSameMatchParlayReverts)
// ════════════════════════════════════════════════════════════════════════════
/*
 === RUN   TestParlaySameMatchRevertE2E
    admin=0x7501bCBFAAa99e6390577277D051A32ec2e64064 bettor=0x83547Ed07e72979aEE115dd29a40FA1200769f56
      approve→BP    tx=0xd371a61db93faa0178d1dff318bbafc1fe2582511757f33f7e1dcea892c22372  mined block=111928650
  gas_used=50856  ✓
      approve→LP    tx=0xdd3b2df2976ac1bcf42c0237eec7b5cf9732a6939d55ec6876e76bdc1b976176  mined block=111928658
  gas_used=50856  ✓
      depositGlobal tx=0x592ea7620f943f4ad0bb21a903f3ad157bac40f625dd097edf3d1d8cf03fad2d  mined block=111928668
  gas_used=249741 ✓
      same-match parlay reverted ✓
  --- PASS: TestParlaySameMatchRevertE2E (30.75s)
*/
func TestParlaySameMatchRevertE2E(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	t.Cleanup(cancel)
	e := newParlayEnv(t, ctx)

	now := uint64(time.Now().Unix())
	start := now + 30*60
	end := now + 31*60
	matchID := scenarioMatchID(now + 300)
	e.ensureRoles(t, matchID)

	// Two markets on the SAME match: X12 (type 0) and OU (type 2).
	keyX12 := coretypes.MarketKey{MatchID: matchID, MarketType: 0, Line: 0}
	keyOU := coretypes.MarketKey{MatchID: matchID, MarketType: 2, Line: 1}
	e.openLeg(t, matchID, start, end, "x12") // opens type 0
	// open the OU market on the same match directly via the admin client.
	if _, err := e.admin.OpenMarketWithReceipt(ctx, admin.OpenMarketRequest{
		MatchID: matchID, MarketType: 2, Line: 1,
		MatchStartTime: start, MatchEndTime: end,
		BaseOdds:       []*big.Int{big.NewInt(20000), big.NewInt(20000)},
		UpdatedAt:      uint64(time.Now().Unix()),
		IdempotencyKey: "e2e-parlay-open-ou-" + matchHex(matchID) + "-" + e.runTag,
	}); err != nil {
		t.Fatalf("OpenMarket(OU): %v", err)
	}

	stake := e.wei(100)
	e.approveAndFundBettor(t, stake)
	legs := []coretypes.ParlayLegInput{e.legSnapshot(t, keyX12, 0), e.legSnapshot(t, keyOU, 0)}

	// placeParlay must revert (same match across legs). sendDirectTxExpectRevert
	// asserts a status-0 receipt.
	cd, err := e.sdk.BettingPool().PlaceParlayCalldata(toSDKLegs(legs), stake, big.NewInt(0), new(big.Int).SetUint64(now+1*60*60), common.Address{})
	if err != nil {
		t.Fatalf("PlaceParlayCalldata: %v", err)
	}
	if reverted := sendDirectTxExpectRevert(t, ctx, e.eth, e.chainID, e.bettorKey, e.bettorAddr, e.bp, cd, "placeParlay-same-match"); !reverted {
		t.Fatalf("expected placeParlay to revert for two legs on the same match")
	}
	t.Log("  same-match parlay reverted ✓")
}

// ── small local helpers ─────────────────────────────────────────────────────

// decimalFromWei wraps a wei *big.Int into the decimal.Decimal the read API uses.
func decimalFromWei(v *big.Int) decimal.Decimal { return decimal.NewFromBigInt(v, 0) }

// decimalE18 is 1e18 as a decimal (wei → ODD divisor for log output).
func decimalE18() decimal.Decimal { return decimal.New(1, 18) }

// toSDKLegs converts business-layer legs into the SDK input (deriving marketID).
func toSDKLegs(legs []coretypes.ParlayLegInput) []oddfi.ParlayLegInput {
	out := make([]oddfi.ParlayLegInput, len(legs))
	for i, l := range legs {
		out[i] = oddfi.ParlayLegInput{
			MarketID:     [32]byte(l.Market.MarketID()),
			Outcome:      l.Outcome,
			QuoteVersion: l.QuoteVersion,
			QuotedAt:     l.QuotedAt,
			MinOdds:      l.MinOdds,
		}
	}
	return out
}

// extractParlayID scans a receipt for the ParlayPlaced event and returns its
// indexed parlayId (topics[1]).
func extractParlayID(t *testing.T, rcpt *types.Receipt, bp common.Address) coretypes.ParlayID {
	t.Helper()
	topic0 := crypto.Keccak256Hash([]byte(
		"ParlayPlaced(bytes32,address,uint256,uint256,uint256,uint8,uint256,uint256,bytes32)"))
	for _, lg := range rcpt.Logs {
		if lg.Address == bp && len(lg.Topics) >= 2 && lg.Topics[0] == topic0 {
			var id coretypes.ParlayID
			copy(id[:], lg.Topics[1].Bytes())
			return id
		}
	}
	t.Fatalf("ParlayPlaced event not found in receipt %s", rcpt.TxHash.Hex())
	return coretypes.ParlayID{}
}

// sendDirectTxExpectRevert mirrors sendDirectTx but expects an on-chain revert
// (receipt status 0). Returns true if the tx reverted as expected. It does NOT
// fail the test on revert (that is the success case); it only fails on send /
// receipt errors. EstimateGas is skipped (it would error on a reverting call).
func sendDirectTxExpectRevert(
	t *testing.T, ctx context.Context,
	eth *ethclient.Client, chainID *big.Int,
	key *ecdsa.PrivateKey, from, to common.Address,
	calldata []byte, label string,
) bool {
	t.Helper()
	nonce, err := eth.PendingNonceAt(ctx, from)
	if err != nil {
		t.Fatalf("%s: PendingNonceAt: %v", label, err)
	}
	tipCap, err := eth.SuggestGasTipCap(ctx)
	if err != nil {
		t.Fatalf("%s: SuggestGasTipCap: %v", label, err)
	}
	feeCapBase, err := eth.SuggestGasPrice(ctx)
	if err != nil {
		t.Fatalf("%s: SuggestGasPrice: %v", label, err)
	}
	feeCap := new(big.Int).Add(feeCapBase, tipCap)

	// Fixed gas: EstimateGas would revert (and error) on a call we expect to fail.
	gasLimit := uint64(1_500_000)
	tx := types.NewTx(&types.DynamicFeeTx{
		ChainID: chainID, Nonce: nonce, GasTipCap: tipCap, GasFeeCap: feeCap,
		Gas: gasLimit, To: &to, Value: big.NewInt(0), Data: calldata,
	})
	signed, err := types.SignTx(tx, types.NewLondonSigner(chainID), key)
	if err != nil {
		t.Fatalf("%s: SignTx: %v", label, err)
	}
	if err := eth.SendTransaction(ctx, signed); err != nil {
		// Some nodes reject the tx at send time via eth_estimateGas in the mempool;
		// that is also an acceptable "reverted" signal for this negative test.
		t.Logf("  %s rejected at send (treated as revert): %v", label, err)
		return true
	}
	rcpt := waitDirectReceipt(t, ctx, eth, signed.Hash(), label)
	return rcpt.Status != types.ReceiptStatusSuccessful
}
