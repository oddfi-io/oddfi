//go:build e2e

// scenario_e2e_test.go — end-to-end scenario test using ONLY admin/relay/read
// from this project. All connection params + keys + contract addresses are
// declared at the top as named constants so the user can fill them in once
// (no env vars).
//
// Mirrors oddfi-ODD-SDK/pkg/oddfi/full_scenario_e2e_test.go's 7-step flow:
//
//  1. (setup) Fund bettor with BNB + ODD
//  2. OpenMarket           — admin
//  3. DepositMatch (LP)    — relay (LP user delegates via sponsor)
//  4. PlaceBet             — relay (bettor delegates via sponsor)
//  5. SettleMarket         — admin
//  6. ClaimPayout          — relay (bettor claims)
//  7. RequestUnbond        — relay (LP user)
//  8. Withdraw             — relay (LP user, after unbond epochs)
//
// Build / run:
//
//	go test -tags e2e -run TestScenarioFullMatch -v -timeout 40m ./...

package business_test

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"math/big"
	"strings"
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
	"github.com/Crypto-Barrett/contracts-business-layer/relay"
)

// ════════════════════════════════════════════════════════════════════════
// FILL IN BEFORE RUNNING ↓↓↓
// ════════════════════════════════════════════════════════════════════════
const (
	// RPC / chain.
	scenarioRPCURL  = "https://bnb-testnet.g.alchemy.com/v2/H35XdJCol-9YDMElNIXe3"
	scenarioChainID = 97 // BSC testnet = 97, BSC mainnet = 56

	// Required private keys (hex; with or without 0x prefix).
	// adminKeyHex   = B = gas payer (also has OPERATOR_ROLE + SETTLER_ROLE).
	// bettorKeyHex  = A = ordinary user; funded by admin during setup.
	// lpUserKeyHex  = LP user; funded by admin during setup.
	adminKeyHex = "0xf56381db8696b0121b7cdb1d00437c7b6c5f053b04602bfba8947280f407e796"
	// 0x46F00168097De28a2c436540C93db16914601d6d
	bettorKeyHex = "0x5f05ff4f080afba0c832d36f7130d5fdaf38a4b72fb3c9bc49fc3c19881d74b7"
	lpUserKeyHex = "0x5f05ff4f080afba0c832d36f7130d5fdaf38a4b72fb3c9bc49fc3c19881d74b7"

	// Required contract addresses.
	addrODDToken      = "0x5530dA4357803bD0ed806a999a1f1fcc3c45Dc8C"
	addrStakingPool   = "0x65fd4A2529010693BA474d1993631e305a42E061"
	addrLiquidityPool = "0xdf0c59B387DfDf9f18969880DDCF1216BFEe318f"
	addrBettingPool   = "0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F"

	// BatchCallAndSponsor v2 implementation (the EIP-7702 delegated impl).
	addrSponsorImpl = "0x6f7522e124a354125dcb679b4c7eee8046a64f53"

	// MySQL DSN for chain_actions table.
	scenarioMySQLDSN = "root:admin888@tcp(127.0.0.1:3306)/chain_consumer?parseTime=true&charset=utf8mb4"

	// Optional: override multicall3 address if testnet uses a non-canonical deployment.
	// Leave empty to use the default 0xcA11bde05977b3631167028862bE2a173976CA11.
	addrMulticall3 = "0xcA11bde05977b3631167028862bE2a173976CA11"

	// ────────────────────────────────────────────────────────────────────
	// On-chain constraint (verified via eth_call on 2026-05-14):
	//   LiquidityPool.minDeposit() returns 0x3635c9adc5dea00000
	//                                    = 1000 * 10^18 wei
	//                                    = 1000 ODD
	// Any relay.DepositMatch / relay.DepositGlobal with amount < 1000 ODD
	// will be reverted by the contract with the gas pattern ~86686.
	//
	// Pre-fund the bettor address (A) with AT LEAST `lpMinDepositODD + bet
	// amount + 1% bet tax + small buffer` before running. Recommended: 1200 ODD.
	// ────────────────────────────────────────────────────────────────────
	lpMinDepositODD = 1000
)

// ════════════════════════════════════════════════════════════════════════
// FILL IN BEFORE RUNNING ↑↑↑
// ════════════════════════════════════════════════════════════════════════

/**
 Step 0a: admin → bettor BNB        (保险，bettor 用不上)
  Step 0b: admin → lpAddr BNB        (lpAddr==bettorAddr,同上)
  Step 0d:
    - bettor approve LiquidityPool 200 ODD   (relay sponsored)
    - bettor DepositMatch 200 ODD             (relay sponsored, lpPositionID 提前拿到)
  Step 0e: bettor approve BettingPool 100*1.01 ODD  (relay sponsored)
  Step 1:  admin OpenMarket                   (admin 直发)
  Step 2:  已删（前置 0d 替代）
  Step 3:  bettor PlaceBet 100 ODD            (relay sponsored)  ← 核心场景
  Step 4:  admin SettleMarket
  Step 5:  bettor ClaimPayout (TODO skip)
  Step 6:  bettor RequestUnbond
  Step 7:  bettor Withdraw
**/

/**
	test log
	=== RUN   TestScenarioFullMatch
    scenario_e2e_test.go:193: admin = 0x7501bCBFAAa99e6390577277D051A32ec2e64064 (gas payer / OPERATOR / SETTLER)
    scenario_e2e_test.go:194: bettor= 0x46F00168097De28a2c436540C93db16914601d6d (user A; relay sponsored)
    scenario_e2e_test.go:195: lpUser= 0x46F00168097De28a2c436540C93db16914601d6d (LP user; relay sponsored)
    scenario_e2e_test.go:291: match_id = 000000000000000000000000000000000000000000000000000000006a05f5cd  market_id (derived) = 9ae81726677d203780d156133ce1a0abbb8d1519c45c2d576f4d6dc2cf271ae6  run_tag = 1778775501295356400
    scenario_e2e_test.go:299: === Step 0c: A approve LiquidityPool ===
    scenario_e2e_test.go:311: === Step 0d: A approve BettingPool ===
    scenario_e2e_test.go:324:
        === Step 1: admin.OpenMarket ===
    scenario_e2e_test.go:352:   tx=0x330e4df131121d630c12351c03743ac384b84d1a1af3e813f91c5146dd91256d block=107405509 gas=491021
    scenario_e2e_test.go:359:
        === Step 2: relay.DepositMatch ===
    scenario_e2e_test.go:371:   lp_position_id=44 tx=0x220cf93c9ce09371ca698deaecb1bd963637f9fe2348fe8a68d2c54cd69cc5cd block=107405518 gas=317739
    scenario_e2e_test.go:377:
        === Step 3: relay.PlaceBet ===
    scenario_e2e_test.go:385:   preview signal=0 accepted=100000000000000000000 locked_odds=2 partial=false
    scenario_e2e_test.go:403:   bet_id=000000000000000000000000000000000000000000000000000000000000000f tx=0xbeb9ebf1f0f3ebf31930a47d0ba8711204f067659423fd8037a4198cbbdf2c33 block=107405528 gas=512779
    scenario_e2e_test.go:404:   accepted=100000000000000000000 locked_odds=20000
    scenario_e2e_test.go:411:
        === Waiting until matchEndTime=1778776161 ===
    scenario_e2e_test.go:417:
        === Step 4: admin.SettleMarket ===
    scenario_e2e_test.go:439:   tx=0x57afe82de80dc21402c21e58ac30884ece59427443b4bf7fc13040000676421f block=107406965 gas=356155
    scenario_e2e_test.go:442:   market_status=Settled (expect Settled)
    scenario_e2e_test.go:448:
        === Step 5: relay.ClaimPayout ===
    scenario_e2e_test.go:458:   bet pre-claim: state=3(0=Pending,1=Refunded,2=Lost,3=WonUnclaimed,4=WonClaimed) claimable=200000000000000000000 odds=2
    scenario_e2e_test.go:471:   tx=0x5eac0e9553f13a5d0daf23eab04ee988a5d0bcf72619aea8665f75e1f8fb6cc6 block=107406974 gas=207015
    scenario_e2e_test.go:487:
        === Step 6: relay.RequestUnbond ===
    scenario_e2e_test.go:505:   tx=0x5ad22d40fbc5b8a259e421b9884e1addf471e0bff97f8c1e96403bf44c964a37 block=107406982 gas=241265
    scenario_e2e_test.go:508:   lp_position state=1 (1=Unbonding)
    scenario_e2e_test.go:514:
        === Step 7: relay.Withdraw ===
    scenario_e2e_test.go:528:   unbond epochs not yet elapsed; Step 7 skipped (re-run later)
--- PASS: TestScenarioFullMatch (1283.22s)
**/

func TestScenarioFullMatch(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 40*time.Minute)
	t.Cleanup(cancel)

	// ── Parse keys + addresses ──────────────────────────────────────────
	adminKey, err := crypto.HexToECDSA(strings.TrimPrefix(adminKeyHex, "0x"))
	if err != nil {
		t.Fatalf("parse adminKey: %v", err)
	}
	bettorKey, err := crypto.HexToECDSA(strings.TrimPrefix(bettorKeyHex, "0x"))
	if err != nil {
		t.Fatalf("parse bettorKey: %v", err)
	}
	lpKey, err := crypto.HexToECDSA(strings.TrimPrefix(lpUserKeyHex, "0x"))
	if err != nil {
		t.Fatalf("parse lpKey: %v", err)
	}
	adminAddr := crypto.PubkeyToAddress(adminKey.PublicKey)
	bettorAddr := crypto.PubkeyToAddress(bettorKey.PublicKey)
	lpAddr := crypto.PubkeyToAddress(lpKey.PublicKey)
	t.Logf("admin = %s (gas payer / OPERATOR / SETTLER)", adminAddr.Hex())
	t.Logf("bettor= %s (user A; relay sponsored)", bettorAddr.Hex())
	t.Logf("lpUser= %s (LP user; relay sponsored)", lpAddr.Hex())

	// ── DB (only admin-svc + relay-svc need it; read-svc does NOT) ──────
	db, err := gorm.Open(mysql.Open(scenarioMySQLDSN), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}

	multicallAddr := common.Address{}
	if addrMulticall3 != "" {
		multicallAddr = common.HexToAddress(addrMulticall3)
	}
	oddAddr := common.HexToAddress(addrODDToken)
	bpAddr := common.HexToAddress(addrBettingPool)
	spAddr := common.HexToAddress(addrStakingPool)
	lpAddrContract := common.HexToAddress(addrLiquidityPool)

	// ── Per-service wire-up: each microservice would call ONLY its own
	// factory; this test exercises all three in one process to verify
	// they can coexist and to act as the canonical multi-service example. ─

	// admin-svc: holds admin key + DB
	adminClients, err := business.NewAdminClients(ctx, business.AdminConfig{
		RPCURL:           scenarioRPCURL,
		ChainID:          big.NewInt(scenarioChainID),
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
		t.Fatalf("business.NewAdminClients: %v", err)
	}
	t.Cleanup(func() { _ = adminClients.Close(ctx) })

	// In-memory Magic stand-in: the user keys live here, indexed by user_id.
	// Relay calls pass UserID; the signer resolves the EOA and signs for them.
	fakeMagic := newFakeMagicSigner(map[string]*ecdsa.PrivateKey{
		"bettor": bettorKey,
		"lp":     lpKey,
	})

	// user-api-svc: holds sponsor key + sponsor impl + DB + the user signer
	relayClients, err := business.NewRelayClients(ctx, business.RelayConfig{
		RPCURL:            scenarioRPCURL,
		ChainID:           big.NewInt(scenarioChainID),
		SponsorPrivateKey: adminKey, // admin doubles as sponsor in this test
		UserSigner:        fakeMagic,
		SponsorImpl:       common.HexToAddress(addrSponsorImpl),
		ODDToken:          oddAddr,
		BettingPool:       bpAddr,
		StakingPool:       spAddr,
		LiquidityPool:     lpAddrContract,
		MulticallAddress:  multicallAddr,
		DB:                db,
		Confirmations:     2,
		SignatureDeadline: 15 * time.Minute,
	})
	if err != nil {
		t.Fatalf("business.NewRelayClients: %v", err)
	}
	t.Cleanup(func() { _ = relayClients.Close(ctx) })

	// read-svc: NO keys, NO DB — pure on-chain reader
	readClients, err := business.NewReadClients(ctx, business.ReadConfig{
		RPCURL:        scenarioRPCURL,
		ChainID:       big.NewInt(scenarioChainID),
		ODDToken:      oddAddr,
		BettingPool:   bpAddr,
		StakingPool:   spAddr,
		LiquidityPool: lpAddrContract,
		Cache:         cache.NewInProcess(),
	})
	if err != nil {
		t.Fatalf("business.NewReadClients: %v", err)
	}
	t.Cleanup(func() { _ = readClients.Close(ctx) })

	adminCli := adminClients.Admin
	relayCli := relayClients.Relay
	readCli := readClients.Read
	// scenarioWaitTimestamp / scenarioSendBNB need a raw ethclient; reuse
	// the one already dialed by relayClients (relay-svc would have one).
	eth := relayClients.Eth

	// ── Scenario constants ──────────────────────────────────────────────
	one18 := new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)
	// MUST be >= lpMinDepositODD (see constant block above). Currently == 1000.
	lpAmount := new(big.Int).Mul(big.NewInt(lpMinDepositODD), one18) // 1000 ODD
	betAmount := new(big.Int).Mul(big.NewInt(100), one18)            // 100 ODD

	now := uint64(time.Now().Unix())
	matchStartTime := now + 10*60
	matchEndTime := now + 11*60
	matchID := scenarioMatchID(now)
	marketKey := coretypes.MarketKey{MatchID: matchID, MarketType: 0, Line: 0}
	// runTag makes every IdempotencyKey globally unique to this test run,
	// so chain_actions short-circuit can't accidentally return a stale tx_hash
	// from a previous attempt.
	runTag := fmt.Sprintf("%d", time.Now().UnixNano())
	t.Logf("match_id = %x  market_id (derived) = %x  run_tag = %s", matchID, marketKey.MarketID(), runTag)

	// NOTE: ODD funding for A (bettor + LP user) is assumed done OOB
	// (caller pre-funded ~1000 ODD to bettorAddr). A does NOT need BNB —
	// all relay txs are sponsored by admin.
	_ = lpAddr // bettor and LP use the same address; reference here to silence unused

	// ── Step 0c: A approves LiquidityPool (DepositMatch will be Step 2 after OpenMarket) ──
	t.Log("=== Step 0c: A approve LiquidityPool ===")
	if _, err := relayCli.ApproveWithReceipt(ctx, relay.ApproveRequest{
		UserID:         "bettor",
		Spender:        common.HexToAddress(addrLiquidityPool),
		Value:          lpAmount,
		IdempotencyKey: "scenario-approve-lp-" + matchHex(matchID) + "-" + runTag,
	}); err != nil {
		t.Fatalf("A approve LP: %v", err)
	}

	// ── Step 0d: A approves BettingPool (PlaceBet will be Step 3) ──
	betApproval := new(big.Int).Add(betAmount, new(big.Int).Div(betAmount, big.NewInt(100)))
	t.Log("=== Step 0d: A approve BettingPool ===")
	if _, err := relayCli.ApproveWithReceipt(ctx, relay.ApproveRequest{
		UserID:         "bettor",
		Spender:        common.HexToAddress(addrBettingPool),
		Value:          betApproval,
		IdempotencyKey: "scenario-approve-bp-" + matchHex(matchID) + "-" + runTag,
	}); err != nil {
		t.Fatalf("approve BettingPool: %v", err)
	}

	// ════════════════════════════════════════════════════════════════════
	// Step 1: OpenMarket (admin)
	// ════════════════════════════════════════════════════════════════════
	t.Log("\n=== Step 1: admin.OpenMarket ===")
	{
		// Ensure admin has OPERATOR_ROLE.
		operatorRole := crypto.Keccak256Hash([]byte("OPERATOR_ROLE"))
		if has, _ := readCli.HasRole(ctx, operatorRole, adminAddr); !has {
			if _, err := adminCli.GrantRoleWithReceipt(ctx, admin.GrantRoleRequest{
				Role:           operatorRole,
				Account:        adminAddr,
				IdempotencyKey: "scenario-grant-operator-" + matchHex(matchID) + "-" + runTag,
			}); err != nil {
				t.Fatalf("GrantRole OPERATOR: %v", err)
			}
		}

		baseOdds := []*big.Int{big.NewInt(20000), big.NewInt(30000), big.NewInt(20000)}
		res, err := adminCli.OpenMarketWithReceipt(ctx, admin.OpenMarketRequest{
			MatchID:        matchID,
			MarketType:     0, // 1x2
			Line:           0,
			MatchStartTime: matchStartTime,
			MatchEndTime:   matchEndTime,
			BaseOdds:       baseOdds,
			UpdatedAt:      uint64(time.Now().Unix()),
			IdempotencyKey: "scenario-open-market-" + matchHex(matchID) + "-" + runTag,
		})
		if err != nil {
			t.Fatalf("OpenMarket: %v", err)
		}
		t.Logf("  tx=%s block=%d gas=%d", res.TxHash, res.BlockNumber, res.GasUsed)
	}

	// ════════════════════════════════════════════════════════════════════
	// Step 2: relay.DepositMatch (LP user) — A injects 200 ODD into the
	// match liquidity pool that OpenMarket just opened via openMatchPool().
	// ════════════════════════════════════════════════════════════════════
	t.Log("\n=== Step 2: relay.DepositMatch ===")
	lpPositionID, _ := readCli.NextLpPositionID(ctx)
	{
		res, err := relayCli.DepositMatchWithReceipt(ctx, relay.DepositMatchRequest{
			UserID:         "bettor",
			MatchID:        matchID,
			Amount:         lpAmount,
			IdempotencyKey: "scenario-deposit-match-" + matchHex(matchID) + "-" + runTag,
		})
		if err != nil {
			t.Fatalf("DepositMatch: %v", err)
		}
		t.Logf("  lp_position_id=%s tx=%s block=%d gas=%d", lpPositionID, res.TxHash, res.BlockNumber, res.GasUsed)
	}

	// ════════════════════════════════════════════════════════════════════
	// Step 3: relay.PlaceBet (bettor)
	// ════════════════════════════════════════════════════════════════════
	t.Log("\n=== Step 3: relay.PlaceBet ===")
	var placedBetID coretypes.BetID
	{
		// Sanity log: preview signal (read path).
		preview, err := readCli.PreviewSignal(ctx, marketKey, 0, decimal.NewFromBigInt(betAmount, 0))
		if err != nil {
			t.Logf("  preview (informational only): %v", err)
		} else {
			t.Logf("  preview signal=%d accepted=%s locked_odds=%s partial=%v",
				preview.Color, preview.AcceptedAmount, preview.LockedOdds, preview.PartialFill)
		}

		res, err := relayCli.PlaceBetWithReceipt(ctx, relay.PlaceBetRequest{
			UserID:            "bettor",
			Market:            marketKey,
			Outcome:           0,
			Amount:            betAmount,
			MinAcceptedAmount: big.NewInt(1),
			MinOdds:           big.NewInt(10100),
			Deadline:          uint64(time.Now().Add(15 * time.Minute).Unix()),
			IdempotencyKey:    "scenario-place-bet-" + matchHex(matchID) + "-" + runTag,
		})
		if err != nil {
			t.Fatalf("PlaceBet: %v", err)
		}
		placedBetID = res.BetID
		t.Logf("  bet_id=%x tx=%s block=%d gas=%d", res.BetID, res.TxHash, res.BlockNumber, res.GasUsed)
		t.Logf("  accepted=%s locked_odds=%s", res.AcceptedAmount, res.LockedOdds)
	}

	// ── wait for matchEndTime ────────────────────────────────────────────
	// BettingSettlementModule.settleMarket has a hard require:
	//   if (block.timestamp < market.matchEndTime) revert SettlementCannotClose
	// so we must wait until on-chain time has crossed matchEndTime before Step 4.
	t.Logf("\n=== Waiting until matchEndTime=%d ===", matchEndTime)
	scenarioWaitTimestamp(t, ctx, eth, matchEndTime+5)

	// ════════════════════════════════════════════════════════════════════
	// Step 4: admin score-based settlement (SDK v0.0.5)
	//   4a. SettleMarketBetsByScore — process bets in ≤50 batches by final score
	//   4b. FinalizeMarketSettlement(resultKind=0 Settled)
	// Score (home=2, away=1) → 1X2 home win → bettor's outcome 0 wins, so the
	// Step 5 ClaimPayout below stays exercised.
	// ════════════════════════════════════════════════════════════════════
	t.Log("\n=== Step 4: admin.SettleMarketBetsByScore + FinalizeMarketSettlement ===")
	{
		settlerRole := crypto.Keccak256Hash([]byte("SETTLER_ROLE"))
		if has, _ := readCli.HasRole(ctx, settlerRole, adminAddr); !has {
			if _, err := adminCli.GrantRoleWithReceipt(ctx, admin.GrantRoleRequest{
				Role:           settlerRole,
				Account:        adminAddr,
				IdempotencyKey: "scenario-grant-settler-" + matchHex(matchID) + "-" + runTag,
			}); err != nil {
				t.Fatalf("GrantRole SETTLER: %v", err)
			}
		}

		// 4a: page the market's bet IDs (cap each settle batch at MaxSettleScoreBatch=50).
		betIDs, err := readCli.GetMarketBetIds(ctx, marketKey, big.NewInt(0), big.NewInt(admin.MaxSettleScoreBatch))
		if err != nil {
			t.Fatalf("GetMarketBetIds: %v", err)
		}
		t.Logf("  market has %d bet(s) to settle by score", len(betIDs))
		if len(betIDs) > 0 {
			res, err := adminCli.SettleMarketBetsByScoreWithReceipt(ctx, admin.SettleMarketBetsByScoreRequest{
				Market:         marketKey,
				HomeScore:      2,
				AwayScore:      1,
				BetIDs:         betIDs,
				IdempotencyKey: "scenario-settle-score-" + matchHex(matchID) + "-" + runTag,
			})
			if err != nil {
				t.Fatalf("SettleMarketBetsByScore: %v", err)
			}
			t.Logf("  settle tx=%s block=%d gas=%d", res.TxHash, res.BlockNumber, res.GasUsed)
		}

		// 4b: finalize as Settled.
		res, err := adminCli.FinalizeMarketSettlementWithReceipt(ctx, admin.FinalizeMarketSettlementRequest{
			Market:         marketKey,
			ResultKind:     0,
			IdempotencyKey: "scenario-finalize-" + matchHex(matchID) + "-" + runTag,
		})
		if err != nil {
			t.Fatalf("FinalizeMarketSettlement: %v", err)
		}
		t.Logf("  finalize tx=%s block=%d gas=%d", res.TxHash, res.BlockNumber, res.GasUsed)

		mkt, _ := readCli.GetMarket(ctx, marketKey)
		t.Logf("  market_status=%s (expect Settled)", mkt.Status)
	}

	// ════════════════════════════════════════════════════════════════════
	// Step 5: relay.ClaimPayout (bettor) — using betID parsed from Step 3 receipt
	// ════════════════════════════════════════════════════════════════════
	t.Log("\n=== Step 5: relay.ClaimPayout ===")
	{
		if placedBetID == (coretypes.BetID{}) {
			t.Log("  placedBetID is zero (BetPlaced event parsing failed?) — skipping claim")
		} else {
			// Inspect on-chain bet state — must be WonUnclaimed (3) to claim.
			bet, err := readCli.GetBet(ctx, placedBetID)
			if err != nil {
				t.Fatalf("GetBet: %v", err)
			}
			t.Logf("  bet pre-claim: state=%d(0=Pending,1=Refunded,2=Lost,3=WonUnclaimed,4=WonClaimed) claimable=%s odds=%s",
				bet.SettlementState, bet.ClaimablePayout, bet.LockedOdds)

			switch bet.SettlementState {
			case read.BetSettlementWonUnclaimed:
				res, err := relayCli.ClaimPayoutWithReceipt(ctx, relay.ClaimPayoutRequest{
					UserID:         "bettor",
					BetID:          placedBetID,
					IdempotencyKey: "scenario-claim-payout-" + matchHex(matchID) + "-" + runTag,
				})
				if err != nil {
					t.Fatalf("ClaimPayout: %v", err)
				}
				t.Logf("  tx=%s block=%d gas=%d", res.TxHash, res.BlockNumber, res.GasUsed)
			case read.BetSettlementLost:
				t.Log("  bet outcome lost → no payout to claim (this is fine if A picked the wrong side)")
			case read.BetSettlementRefunded:
				t.Log("  bet refunded → claim path not applicable")
			case read.BetSettlementWonClaimed:
				t.Log("  bet already claimed (perhaps a prior run on the same BetID)")
			default:
				t.Logf("  bet not in terminal claimable state (state=%d) — skip Step 5", bet.SettlementState)
			}
		}
	}

	// ════════════════════════════════════════════════════════════════════
	// Step 6: relay.RequestUnbond (LP)
	// ════════════════════════════════════════════════════════════════════
	t.Log("\n=== Step 6: relay.RequestUnbond ===")
	{
		// Wait until match is terminal.
		for i := 0; i < 60; i++ {
			if term, _ := readCli.IsMatchTerminal(ctx, matchID); term {
				break
			}
			time.Sleep(2 * time.Second)
		}

		res, err := relayCli.RequestUnbondWithReceipt(ctx, relay.RequestUnbondRequest{
			UserID:         "lp",
			PositionID:     lpPositionID,
			IdempotencyKey: "scenario-request-unbond-" + matchHex(matchID) + "-" + runTag,
		})
		if err != nil {
			t.Fatalf("RequestUnbond: %v", err)
		}
		t.Logf("  tx=%s block=%d gas=%d", res.TxHash, res.BlockNumber, res.GasUsed)

		state, _ := readCli.GetLpPositionState(ctx, lpPositionID)
		t.Logf("  lp_position state=%d (1=Unbonding)", state)
	}

	// ════════════════════════════════════════════════════════════════════
	// Step 7: relay.Withdraw (LP) — needs unbond epochs elapsed
	// ════════════════════════════════════════════════════════════════════
	t.Log("\n=== Step 7: relay.Withdraw ===")
	{
		// Poll for withdrawable state (LP position state == 2 typically).
		ready := false
		deadline := time.Now().Add(10 * time.Minute)
		for time.Now().Before(deadline) {
			state, _ := readCli.GetLpPositionState(ctx, lpPositionID)
			if state == 2 {
				ready = true
				break
			}
			time.Sleep(10 * time.Second)
		}
		if !ready {
			t.Log("  unbond epochs not yet elapsed; Step 7 skipped (re-run later)")
			return
		}

		res, err := relayCli.WithdrawWithReceipt(ctx, relay.WithdrawRequest{
			UserID:         "lp",
			PositionID:     lpPositionID,
			IdempotencyKey: "scenario-withdraw-" + matchHex(matchID) + "-" + runTag,
		})
		if err != nil {
			t.Fatalf("Withdraw: %v", err)
		}
		t.Logf("  tx=%s block=%d gas=%d", res.TxHash, res.BlockNumber, res.GasUsed)
	}

	t.Log("\n=== Scenario complete ===")
}

// ─── helpers ─────────────────────────────────────────────────────────────

// scenarioSendBNB sends native BNB from `fromKey` to `to` for funding test
// accounts. Direct ethclient call — not a business operation; the project's
// admin/relay/read packages don't expose native-coin transfers (the platform
// economic model uses ODD ERC20 throughout).
func scenarioSendBNB(ctx context.Context, eth *ethclient.Client, fromKey *ecdsa.PrivateKey, to common.Address, value *big.Int, chainID *big.Int) error {
	from := crypto.PubkeyToAddress(fromKey.PublicKey)
	nonce, err := eth.PendingNonceAt(ctx, from)
	if err != nil {
		return err
	}
	gasPrice, err := eth.SuggestGasPrice(ctx)
	if err != nil {
		return err
	}
	raw := types.NewTx(&types.LegacyTx{
		Nonce: nonce, To: &to, Value: value, Gas: 21000, GasPrice: gasPrice,
	})
	signed, err := types.SignTx(raw, types.NewEIP155Signer(chainID), fromKey)
	if err != nil {
		return err
	}
	if err := eth.SendTransaction(ctx, signed); err != nil {
		return err
	}
	for i := 0; i < 60; i++ {
		if r, _ := eth.TransactionReceipt(ctx, signed.Hash()); r != nil {
			return nil
		}
		time.Sleep(1 * time.Second)
	}
	return nil
}

// scenarioMatchID derives a deterministic 32-byte match id from a timestamp.
// Replace with your real match-id derivation logic if needed.
func scenarioMatchID(now uint64) coretypes.MatchID {
	var b [32]byte
	for i := 0; i < 8; i++ {
		b[31-i] = byte(now >> (8 * i))
	}
	return coretypes.MatchID(b)
}

// scenarioMarketID is kept as a thin wrapper for the SDK-isolation test
// (placebet_simulate_test.go) that calls the SDK directly with a [32]byte
// marketID. Production code paths use coretypes.MarketKey and never need
// to compute this hash themselves — see coretypes.MarketKey.MarketID().
func scenarioMarketID(matchID coretypes.MatchID, marketType, line uint8) coretypes.MarketID {
	return coretypes.MarketKey{MatchID: matchID, MarketType: marketType, Line: line}.MarketID()
}

// matchHex returns the last 16 hex chars of matchID — the bytes that actually
// carry the timestamp (scenarioMatchID writes the uint64 into bytes [24..31]).
// Using the prefix would yield "0000000000000000" because the first 24 bytes
// are zero, which would make IdempotencyKey collide across runs.
func matchHex(m coretypes.MatchID) string {
	h := common.Hash(m).Hex()
	return h[len(h)-16:]
}

// scenarioWaitTimestamp blocks until block timestamp >= target.
func scenarioWaitTimestamp(t *testing.T, ctx context.Context, eth *ethclient.Client, target uint64) {
	for i := 0; i < 600; i++ {
		head, err := eth.HeaderByNumber(ctx, nil)
		if err == nil && head.Time >= target {
			return
		}
		time.Sleep(2 * time.Second)
	}
	t.Fatalf("timed out waiting for timestamp >= %d", target)
}
