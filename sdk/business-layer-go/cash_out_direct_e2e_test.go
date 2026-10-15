//go:build e2e

// cash_out_direct_e2e_test.go — a DIRECT-EOA (non-Magic, non-relay) on-chain
// exercise of BettingPool.cashOut.
//
// Unlike TestCashOutE2E (cash_out_lock_market_e2e_test.go), this test does NOT
// use the sponsored Magic/relay path. The bettor signs every state-changing
// transaction itself with a hardcoded private key (bettorKeyHex) and pays its
// own gas — so the bettor address must be pre-funded with tBNB. Calldata is
// built with the ODD-SDK *Calldata helpers and sent via a small local
// sendDirectTx helper that mirrors admin/client.go's EIP-1559 signing.
//
// Flow:
//   1. admin OpenMarket with a short window (matchStart=+6m, matchEnd=+7m)
//   2. bettor (direct) approve ODD → LiquidityPool + BettingPool
//   3. bettor (direct) DepositMatch  → fund the match pool
//   4. bettor (direct) PlaceBet
//   5. bettor (direct) cashOut  → assert bet state == CashedOut
//   6. wait past matchEndTime, admin settles by score + Finalize → market Settled
//
// Timing constraints (why the window is short but not too short):
//   - cashOut requires the market to be Open and now < matchStartTime (the
//     market auto-locks at matchStart) AND now < matchEndTime. So steps 1–5
//     must all confirm before matchStart (+6m gives ~6 sequential testnet txs
//     plenty of headroom).
//   - Settlement requires now >= matchEndTime, so step 6 waits ~7m of real time.
//   - cashOut also has a 30s quote TTL: quotedAt <= block.timestamp <=
//     quotedAt+30s, checked at inclusion. quotedAt is stamped immediately
//     before the cashOut tx; a direct tx mines well within 30s on BSC testnet.
//   Tune the window via the two `+N*60` constants below if your testnet is slow.
//
// Reuses constants + helpers from scenario_e2e_test.go (same package
// business_test): RPC/keys/addresses, scenarioMatchID, matchHex,
// scenarioWaitTimestamp, lpMinDepositODD, ensureOperatorRole.
//
// Run:
//
//	go test -tags e2e -run TestCashOutDirectE2E -v -timeout 20m ./...

package business_test

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"math/big"
	"testing"
	"time"

	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"

	business "github.com/Crypto-Barrett/contracts-business-layer"
	"github.com/Crypto-Barrett/contracts-business-layer/admin"
	"github.com/Crypto-Barrett/contracts-business-layer/cache"
	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
	"github.com/Crypto-Barrett/contracts-business-layer/read"
	"github.com/Crypto-Barrett/oddfi-ODD-SDK/pkg/oddfi"
)

/*
*
=== RUN   TestCashOutDirectE2E

	cash_out_direct_e2e_test.go:81: admin=0x7501bCBFAAa99e6390577277D051A32ec2e64064 bettor=0x45C4Ef602bC5EB4493070d69B4F3b6a74f952216
	cash_out_direct_e2e_test.go:165: match_id=000000000000000000000000000000000000000000000000000000006a23a048 market_id=50722163985908450afb4de84a49585651caa933c18d9fca3fbc45ddcce7b369 run_tag=1780719688175573900
	cash_out_direct_e2e_test.go:166: matchStart=1780720048 matchEnd=1780720108 (now=1780719688)
	cash_out_direct_e2e_test.go:173: === OpenMarket ===
	cash_out_direct_e2e_test.go:196: === approve LP + BettingPool (direct) ===
	cash_out_direct_e2e_test.go:201:   approve→LP tx=0x064ffab69f1b43f42672562d9dc5ed2cabf5b3d4232170e31b95adecacda2938 (gas limit 64060)
	cash_out_direct_e2e_test.go:201:   approve→LP mined block=111725844 gas_used=50856 ✓
	cash_out_direct_e2e_test.go:208:   approve→BettingPool tx=0xfbd62c38bd8f4f109dd1751827e920422ba04733fb663c41b4db604f01917d72 (gas limit 64060)
	cash_out_direct_e2e_test.go:208:   approve→BettingPool mined block=111725856 gas_used=50856 ✓
	cash_out_direct_e2e_test.go:213: === DepositMatch (direct) ===
	cash_out_direct_e2e_test.go:218:   depositMatch tx=0xf8f30734acc81e91c1f07f202552af92000aeea8a98c737a73d599531619321a (gas limit 344806)
	cash_out_direct_e2e_test.go:218:   depositMatch mined block=111725862 gas_used=261635 ✓
	cash_out_direct_e2e_test.go:223: === PlaceBet (direct) ===
	cash_out_direct_e2e_test.go:239:   placeBet tx=0xa5f9cb03f3a983d34bd82b615de1d8fc4c6d03a78416a3172a69fb02350eebaf (gas limit 703956)
	cash_out_direct_e2e_test.go:239:   placeBet mined block=111725873 gas_used=544466 ✓
	cash_out_direct_e2e_test.go:250:   bet_id=000000000000000000000000000000000000000000000000000000000000019d
	cash_out_direct_e2e_test.go:255: === CashOut (direct) ===
	cash_out_direct_e2e_test.go:261:   quote_version=2
	cash_out_direct_e2e_test.go:275:   cashOut tx=0xce61e21344e93a92eb7f5dbc3c938b8e16b701691cf85f545d6b7febe5a0d367 (gas limit 272957)
	cash_out_direct_e2e_test.go:275:   cashOut mined block=111725883 gas_used=188989 ✓
	cash_out_direct_e2e_test.go:283:   bet state = CashedOut ✓
	cash_out_direct_e2e_test.go:288: === Waiting until matchEndTime=1780720108 ===
*/
func TestCashOutDirectE2E(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
	t.Cleanup(cancel)

	// ── keys ──────────────────────────────────────────────────────────────
	// f56381db8696b0121b7cdb1d00437c7b6c5f053b04602bfba8947280f407e796
	adminKey, err := crypto.HexToECDSA("")
	if err != nil {
		t.Fatalf("parse adminKey: %v", err)
	}
	// adadadadadadadadadadadadadadadadadadadadadadadadadadadadadadadad
	bettorKey, err := crypto.HexToECDSA("")
	if err != nil {
		t.Fatalf("parse bettorKey: %v", err)
	}
	adminAddr := crypto.PubkeyToAddress(adminKey.PublicKey)
	bettorAddr := crypto.PubkeyToAddress(bettorKey.PublicKey)
	t.Logf("admin=%s bettor=%s", adminAddr.Hex(), bettorAddr.Hex())

	// ── addresses ─────────────────────────────────────────────────────────
	multicallAddr := common.Address{}
	if addrMulticall3 != "" {
		multicallAddr = common.HexToAddress(addrMulticall3)
	}
	oddAddr := common.HexToAddress("0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0")
	bpAddr := common.HexToAddress("0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291")
	spAddr := common.HexToAddress("0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A")
	lpAddrContract := common.HexToAddress("0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa")

	db, err := gorm.Open(mysql.Open(scenarioMySQLDSN), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}

	chainID := big.NewInt(scenarioChainID)

	// ── raw ethclient for direct bettor txs + timestamp waiting ─────────────
	eth, err := ethclient.DialContext(ctx, scenarioRPCURL)
	if err != nil {
		t.Fatalf("dial eth: %v", err)
	}
	t.Cleanup(eth.Close)

	// ── ODD-SDK: read-only adapters used ONLY to build calldata ─────────────
	sdk, err := oddfi.NewClient(ctx, oddfi.Config{
		RPCURL:             scenarioRPCURL,
		ODDTokenProxy:      oddAddr,
		StakingPoolProxy:   spAddr,
		LiquidityPoolProxy: lpAddrContract,
		BettingPoolProxy:   bpAddr,
	})
	if err != nil {
		t.Fatalf("sdk NewClient: %v", err)
	}
	t.Cleanup(func() { _ = sdk.Close(ctx) })

	// ── admin client (direct, OPERATOR/SETTLER) for open + settle ──────────
	adminClients, err := business.NewAdminClients(ctx, business.AdminConfig{
		RPCURL:           scenarioRPCURL,
		ChainID:          chainID,
		AdminPrivateKey:  adminKey,
		ODDToken:         oddAddr,
		BettingPool:      bpAddr,
		StakingPool:      spAddr,
		LiquidityPool:    lpAddrContract,
		MulticallAddress: multicallAddr,
		DB:               db,
		Confirmations:    2,
	})
	if err != nil {
		t.Fatalf("NewAdminClients: %v", err)
	}
	t.Cleanup(func() { _ = adminClients.Close(ctx) })

	readClients, err := business.NewReadClients(ctx, business.ReadConfig{
		RPCURL:        scenarioRPCURL,
		ChainID:       chainID,
		ODDToken:      oddAddr,
		BettingPool:   bpAddr,
		StakingPool:   spAddr,
		LiquidityPool: lpAddrContract,
		Cache:         cache.NewInProcess(),
	})
	if err != nil {
		t.Fatalf("NewReadClients: %v", err)
	}
	t.Cleanup(func() { _ = readClients.Close(ctx) })

	adminCli := adminClients.Admin
	readCli := readClients.Read

	one18 := new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)
	lpAmount := new(big.Int).Mul(big.NewInt(lpMinDepositODD), one18) // 1000 ODD
	betAmount := new(big.Int).Mul(big.NewInt(100), one18)            // 100 ODD

	now := uint64(time.Now().Unix())
	matchStartTime := now + 6*60 // market auto-locks here: steps 1–5 must finish before this
	matchEndTime := now + 7*60   // settlement allowed after this
	matchID := scenarioMatchID(now)
	marketKey := coretypes.MarketKey{MatchID: matchID, MarketType: 0, Line: 0}
	runTag := fmt.Sprintf("%d", time.Now().UnixNano())
	t.Logf("match_id=%x market_id=%x run_tag=%s", matchID, marketKey.MarketID(), runTag)
	t.Logf("matchStart=%d matchEnd=%d (now=%d)", matchStartTime, matchEndTime, now)

	ensureOperatorRole(t, ctx, adminCli, readCli, adminAddr, matchID, runTag)

	// ════════════════════════════════════════════════════════════════════
	// Step 1: admin OpenMarket
	// ════════════════════════════════════════════════════════════════════
	t.Log("=== OpenMarket ===")
	baseOdds := []*big.Int{big.NewInt(20000), big.NewInt(30000), big.NewInt(20000)}
	if _, err := adminCli.OpenMarketWithReceipt(ctx, admin.OpenMarketRequest{
		MatchID:        matchID,
		MarketType:     0,
		Line:           0,
		MatchStartTime: matchStartTime,
		MatchEndTime:   matchEndTime,
		BaseOdds:       baseOdds,
		UpdatedAt:      uint64(time.Now().Unix()),
		IdempotencyKey: "e2e-cashout-direct-open-" + matchHex(matchID) + "-" + runTag,
	}); err != nil {
		t.Fatalf("OpenMarket: %v", err)
	}
	if m, err := readCli.GetMarket(ctx, marketKey); err != nil {
		t.Fatalf("GetMarket (post-open): %v", err)
	} else if m.Status != read.MarketStatusOpen {
		t.Fatalf("post-open status = %v, want Open", m.Status)
	}

	// ════════════════════════════════════════════════════════════════════
	// Step 2: bettor (direct) approve ODD → LiquidityPool + BettingPool
	// ════════════════════════════════════════════════════════════════════
	t.Log("=== approve LP + BettingPool (direct) ===")
	approveLP, err := sdk.ODDToken().ApproveCalldata(lpAddrContract, lpAmount)
	if err != nil {
		t.Fatalf("ApproveCalldata(LP): %v", err)
	}
	sendDirectTx(t, ctx, eth, chainID, bettorKey, bettorAddr, oddAddr, approveLP, "approve→LP")

	betApproval := new(big.Int).Add(betAmount, new(big.Int).Div(betAmount, big.NewInt(100))) // bet + 1%
	approveBP, err := sdk.ODDToken().ApproveCalldata(bpAddr, betApproval)
	if err != nil {
		t.Fatalf("ApproveCalldata(BP): %v", err)
	}
	sendDirectTx(t, ctx, eth, chainID, bettorKey, bettorAddr, oddAddr, approveBP, "approve→BettingPool")

	// ════════════════════════════════════════════════════════════════════
	// Step 3: bettor (direct) DepositMatch → fund the match pool
	// ════════════════════════════════════════════════════════════════════
	t.Log("=== DepositMatch (direct) ===")
	depositCD, err := sdk.LiquidityPool().DepositMatchCalldata([32]byte(matchID), lpAmount)
	if err != nil {
		t.Fatalf("DepositMatchCalldata: %v", err)
	}
	sendDirectTx(t, ctx, eth, chainID, bettorKey, bettorAddr, lpAddrContract, depositCD, "depositMatch")

	// ════════════════════════════════════════════════════════════════════
	// Step 4: bettor (direct) PlaceBet
	// ════════════════════════════════════════════════════════════════════
	t.Log("=== PlaceBet (direct) ===")
	preOdds, err := readCli.GetMarketOdds(ctx, marketKey)
	if err != nil {
		t.Fatalf("GetMarketOdds (pre-bet): %v", err)
	}
	guard := oddfi.QuoteGuardInput{
		QuoteVersion:      preOdds.QuoteVersion.BigInt(),
		QuotedAt:          preOdds.UpdatedAt,
		MinOdds:           big.NewInt(10100),
		MinAcceptedAmount: big.NewInt(1),
		Deadline:          big.NewInt(time.Now().Add(15 * time.Minute).Unix()),
	}
	placeCD, err := sdk.BettingPool().PlaceBetCalldata([32]byte(marketKey.MarketID()), 0, betAmount, guard)
	if err != nil {
		t.Fatalf("PlaceBetCalldata: %v", err)
	}
	sendDirectTx(t, ctx, eth, chainID, bettorKey, bettorAddr, bpAddr, placeCD, "placeBet")

	// Resolve the bet ID from the market's bet list (only one bet here).
	betIDs, err := readCli.GetMarketBetIds(ctx, marketKey, big.NewInt(0), big.NewInt(10))
	if err != nil {
		t.Fatalf("GetMarketBetIds: %v", err)
	}
	if len(betIDs) == 0 {
		t.Fatalf("expected at least one bet after PlaceBet, got 0")
	}
	betID := betIDs[0]
	t.Logf("  bet_id=%x", betID)

	// ════════════════════════════════════════════════════════════════════
	// Step 5: bettor (direct) cashOut
	// ════════════════════════════════════════════════════════════════════
	t.Log("=== CashOut (direct) ===")
	postOdds, err := readCli.GetMarketOdds(ctx, marketKey) // PlaceBet bumped quoteVersion
	if err != nil {
		t.Fatalf("GetMarketOdds (pre-cashout): %v", err)
	}
	quoteVersion := postOdds.QuoteVersion.BigInt()
	t.Logf("  quote_version=%s", quoteVersion)

	// Stamp quotedAt now; the direct cashOut must be mined within 30s.
	quotedAt := uint64(time.Now().Unix())
	cashOutCD, err := sdk.BettingPool().CashOutCalldata(
		[32]byte(betID),
		quoteVersion,
		quotedAt,
		big.NewInt(1), // minAmountOut: non-binding; contract floor is 10 ODD
		big.NewInt(time.Now().Add(2*time.Minute).Unix()), // deadline
	)
	if err != nil {
		t.Fatalf("CashOutCalldata: %v", err)
	}
	sendDirectTx(t, ctx, eth, chainID, bettorKey, bettorAddr, bpAddr, cashOutCD, "cashOut")

	// Bet must now be in the CashedOut terminal state.
	if b, err := readCli.GetBet(ctx, betID); err != nil {
		t.Fatalf("GetBet (post-cashout): %v", err)
	} else if b.SettlementState != read.BetSettlementCashedOut {
		t.Fatalf("post-cashout bet state = %d, want %d (CashedOut)", b.SettlementState, read.BetSettlementCashedOut)
	}
	t.Log("  bet state = CashedOut ✓")

	// ════════════════════════════════════════════════════════════════════
	// Step 6: wait past matchEndTime, then admin settles by score + Finalize
	// ════════════════════════════════════════════════════════════════════
	t.Logf("=== Waiting until matchEndTime=%d ===", matchEndTime)
	scenarioWaitTimestamp(t, ctx, eth, matchEndTime+5)

	t.Log("=== SettleMarketBetsByScore + FinalizeMarketSettlement ===")
	settlerRole := crypto.Keccak256Hash([]byte("SETTLER_ROLE"))
	if has, _ := readCli.HasRole(ctx, settlerRole, adminAddr); !has {
		if _, err := adminCli.GrantRoleWithReceipt(ctx, admin.GrantRoleRequest{
			Role:           settlerRole,
			Account:        adminAddr,
			IdempotencyKey: "e2e-cashout-direct-grant-settler-" + matchHex(matchID) + "-" + runTag,
		}); err != nil {
			t.Fatalf("GrantRole SETTLER: %v", err)
		}
	}

	// The sole bet is already CashedOut (terminal); settleByScore simply records
	// the final score and skips it. testAllCashedOutMarketCanRecordScoreAndFinalize
	// in the contract suite confirms a fully-cashed-out market can still finalize.
	settleBetIDs, err := readCli.GetMarketBetIds(ctx, marketKey, big.NewInt(0), big.NewInt(admin.MaxSettleScoreBatch))
	if err != nil {
		t.Fatalf("GetMarketBetIds (settle): %v", err)
	}
	if len(settleBetIDs) > 0 {
		if _, err := adminCli.SettleMarketBetsByScoreWithReceipt(ctx, admin.SettleMarketBetsByScoreRequest{
			Market:         marketKey,
			HomeScore:      2,
			AwayScore:      1,
			BetIDs:         settleBetIDs,
			IdempotencyKey: "e2e-cashout-direct-settle-score-" + matchHex(matchID) + "-" + runTag,
		}); err != nil {
			t.Fatalf("SettleMarketBetsByScore: %v", err)
		}
	}

	if _, err := adminCli.FinalizeMarketSettlementWithReceipt(ctx, admin.FinalizeMarketSettlementRequest{
		Market:         marketKey,
		ResultKind:     0, // Settled
		IdempotencyKey: "e2e-cashout-direct-finalize-" + matchHex(matchID) + "-" + runTag,
	}); err != nil {
		t.Fatalf("FinalizeMarketSettlement: %v", err)
	}

	if m, err := readCli.GetMarket(ctx, marketKey); err != nil {
		t.Fatalf("GetMarket (post-settle): %v", err)
	} else if m.Status != read.MarketStatusSettled {
		t.Fatalf("post-settle status = %v, want Settled", m.Status)
	}
	t.Log("  market status = Settled ✓")
}

// sendDirectTx builds, signs (with `key`), sends an EIP-1559 tx to `to` with
// `calldata`, waits for the receipt, and fails the test on a revert. This is
// the non-Magic, non-relay path: the signer pays its own gas. Mirrors the
// EIP-1559 assembly in admin/client.go's submit().
func sendDirectTx(
	t *testing.T, ctx context.Context,
	eth *ethclient.Client, chainID *big.Int,
	key *ecdsa.PrivateKey, from, to common.Address,
	calldata []byte, label string,
) *types.Receipt {
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

	gasLimit := uint64(2_000_000) // safe fallback for delegatecall-heavy paths
	if est, eerr := eth.EstimateGas(ctx, ethereum.CallMsg{From: from, To: &to, Data: calldata}); eerr == nil {
		gasLimit = est + est/4 // +25% buffer
	} else {
		t.Logf("  %s: EstimateGas failed (%v); using fallback gas=%d", label, eerr, gasLimit)
	}

	tx := types.NewTx(&types.DynamicFeeTx{
		ChainID:   chainID,
		Nonce:     nonce,
		GasTipCap: tipCap,
		GasFeeCap: feeCap,
		Gas:       gasLimit,
		To:        &to,
		Value:     big.NewInt(0),
		Data:      calldata,
	})
	signed, err := types.SignTx(tx, types.NewLondonSigner(chainID), key)
	if err != nil {
		t.Fatalf("%s: SignTx: %v", label, err)
	}
	if err := eth.SendTransaction(ctx, signed); err != nil {
		t.Fatalf("%s: SendTransaction: %v", label, err)
	}
	hash := signed.Hash()
	t.Logf("  %s tx=%s (gas limit %d)", label, hash.Hex(), gasLimit)

	rcpt := waitDirectReceipt(t, ctx, eth, hash, label)
	if rcpt.Status != types.ReceiptStatusSuccessful {
		t.Fatalf("%s: tx reverted (status=0) tx=%s block=%d", label, hash.Hex(), rcpt.BlockNumber)
	}
	t.Logf("  %s mined block=%d gas_used=%d ✓", label, rcpt.BlockNumber, rcpt.GasUsed)
	return rcpt
}

// waitDirectReceipt polls for a tx receipt (~5 min at 2s intervals).
func waitDirectReceipt(
	t *testing.T, ctx context.Context,
	eth *ethclient.Client, hash common.Hash, label string,
) *types.Receipt {
	t.Helper()
	for i := 0; i < 150; i++ {
		if rcpt, err := eth.TransactionReceipt(ctx, hash); err == nil && rcpt != nil {
			return rcpt
		}
		select {
		case <-ctx.Done():
			t.Fatalf("%s: ctx done waiting receipt: %v", label, ctx.Err())
		case <-time.After(2 * time.Second):
		}
	}
	t.Fatalf("%s: timed out waiting for receipt tx=%s", label, hash.Hex())
	return nil
}
