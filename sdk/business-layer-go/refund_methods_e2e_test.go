//go:build e2e

// refund_methods_e2e_test.go — E2E coverage for the admin refund/settlement
// write methods (UpdateOdds / RefundBets / FinalizeMarketSettlement) wired in
// admin/methods.go.
//
// Reuses the constants + helper functions defined in scenario_e2e_test.go
// (same package, same build tag) — RPC URL, admin/bettor keys, MySQL DSN,
// contract addresses, scenarioWaitTimestamp, matchHex, etc.
//
// Each test is self-contained: it opens its OWN market (so a previous run's
// state can't interfere) and uses a keccak-derived matchID so back-to-back
// runs within the same second don't collide on idempotency keys.
//
// Build / run:
//
//	go test -tags e2e -run TestScenarioUpdateOddsAndRefundBets -v -timeout 30m ./...
//	go test -tags e2e -run TestScenarioMarketRefund            -v -timeout 30m ./...
//	go test -tags e2e -run 'TestScenario(UpdateOddsAndRefundBets|MarketRefund)' -v -timeout 60m ./...
//
// Pre-funding (same as TestScenarioFullMatch):
//   - bettor address (≡ lpUser) must hold ≥ ~1200 ODD per test run
//     (1000 ODD LP min-deposit + ~101 ODD for the bet+tax).
//   - admin BNB ≥ 0.05 BNB per test run for gas.

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
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"

	business "github.com/Crypto-Barrett/contracts-business-layer"
	"github.com/Crypto-Barrett/contracts-business-layer/admin"
	"github.com/Crypto-Barrett/contracts-business-layer/cache"
	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
	"github.com/Crypto-Barrett/contracts-business-layer/read"
	"github.com/Crypto-Barrett/contracts-business-layer/relay"
)

// methodsMatchID derives a deterministic, label-scoped 32-byte matchID via
// keccak. Two tests started in the same second still get different IDs.
func methodsMatchID(label string, nowSec uint64) coretypes.MatchID {
	return coretypes.MatchID(crypto.Keccak256Hash([]byte(fmt.Sprintf("admin-methods-%s-%d", label, nowSec))))
}

// methodsBootstrap wires the three clients exactly the way TestScenarioFullMatch
// does: separate per-service factories, admin doubles as sponsor for relay.
type methodsBootstrap struct {
	adminCli   *admin.Client
	relayCli   *relay.Client
	readCli    *read.Client
	eth        *ethclient.Client // taken from relay-svc; used for scenarioWaitTimestamp
	adminAddr  common.Address
	bettorAddr common.Address
}

func newMethodsBootstrap(t *testing.T, ctx context.Context) *methodsBootstrap {
	t.Helper()

	adminKey, err := crypto.HexToECDSA(strings.TrimPrefix(adminKeyHex, "0x"))
	if err != nil {
		t.Fatalf("parse adminKey: %v", err)
	}
	bettorKey, err := crypto.HexToECDSA(strings.TrimPrefix(bettorKeyHex, "0x"))
	if err != nil {
		t.Fatalf("parse bettorKey: %v", err)
	}
	adminAddr := crypto.PubkeyToAddress(adminKey.PublicKey)
	bettorAddr := crypto.PubkeyToAddress(bettorKey.PublicKey)
	t.Logf("admin  = %s (OPERATOR_ROLE + SETTLER_ROLE + gas payer)", adminAddr.Hex())
	t.Logf("bettor = %s (LP user; relay sponsored)", bettorAddr.Hex())

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

	fakeMagic := newFakeMagicSigner(map[string]*ecdsa.PrivateKey{
		"bettor": bettorKey,
	})

	relayClients, err := business.NewRelayClients(ctx, business.RelayConfig{
		RPCURL:            scenarioRPCURL,
		ChainID:           big.NewInt(scenarioChainID),
		SponsorPrivateKey: adminKey,
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

	// Ensure admin holds both roles upfront so neither test gets surprised
	// by a missing-role revert.
	for _, r := range []struct {
		role  [32]byte
		label string
	}{
		{crypto.Keccak256Hash([]byte("OPERATOR_ROLE")), "OPERATOR_ROLE"},
		{crypto.Keccak256Hash([]byte("SETTLER_ROLE")), "SETTLER_ROLE"},
	} {
		if has, _ := readClients.Read.HasRole(ctx, r.role, adminAddr); has {
			continue
		}
		if _, err := adminClients.Admin.GrantRoleWithReceipt(ctx, admin.GrantRoleRequest{
			Role:           r.role,
			Account:        adminAddr,
			IdempotencyKey: "methods-grant-" + r.label + "-" + fmt.Sprintf("%d", time.Now().UnixNano()),
		}); err != nil {
			t.Fatalf("GrantRole %s: %v", r.label, err)
		}
		t.Logf("granted %s → %s", r.label, adminAddr.Hex())
	}

	return &methodsBootstrap{
		adminCli:   adminClients.Admin,
		relayCli:   relayClients.Relay,
		readCli:    readClients.Read,
		eth:        relayClients.Eth,
		adminAddr:  adminAddr,
		bettorAddr: bettorAddr,
	}
}

// ════════════════════════════════════════════════════════════════════════
// Test A: UpdateOdds + (Settle as Refunded) + RefundBets
//
//	Step 1: admin.OpenMarket               (1x2, 3 outcomes)
//	Step 2: admin.UpdateOdds               ← new
//	Step 3: bettor approve + DepositMatch  (LP liquidity)
//	Step 4: bettor approve + PlaceBet      (relay sponsored)
//	Step 5: wait → admin.FinalizeMarketSettlement(kind=1 Refunded)
//	Step 6: admin.RefundBets               ← new
//	Verify: market.Status==Refunded, bet.SettlementState==Refunded
//
// ════════════════════════════════════════════════════════════════════════
func TestScenarioUpdateOddsAndRefundBets(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	t.Cleanup(cancel)

	boot := newMethodsBootstrap(t, ctx)
	adminCli, relayCli, readCli := boot.adminCli, boot.relayCli, boot.readCli

	one18 := new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)
	lpAmount := new(big.Int).Mul(big.NewInt(lpMinDepositODD), one18) // 1000 ODD
	betAmount := new(big.Int).Mul(big.NewInt(100), one18)            // 100 ODD
	betApproval := new(big.Int).Add(betAmount, new(big.Int).Div(betAmount, big.NewInt(100)))

	now := uint64(time.Now().Unix())
	matchStartTime := now + 8*60
	matchEndTime := now + 9*60
	matchID := methodsMatchID("update-refund", now)
	marketKey := coretypes.MarketKey{MatchID: matchID, MarketType: 0, Line: 0}
	runTag := fmt.Sprintf("%d", time.Now().UnixNano())
	t.Logf("match_id=%x  market_id=%x  run_tag=%s", matchID, marketKey.MarketID(), runTag)
	t.Logf("match_start=%d  lock_at=%d  match_end=%d (now=%d)", matchStartTime, matchStartTime-300, matchEndTime, now)

	// ── Step 1: OpenMarket ─────────────────────────────────────────────
	t.Log("\n=== Step 1: admin.OpenMarket (1x2) ===")
	{
		baseOdds := []*big.Int{big.NewInt(20000), big.NewInt(30000), big.NewInt(20000)} // 2.0 / 3.0 / 2.0
		res, err := adminCli.OpenMarketWithReceipt(ctx, admin.OpenMarketRequest{
			MatchID:        matchID,
			MarketType:     0,
			Line:           0,
			MatchStartTime: matchStartTime,
			MatchEndTime:   matchEndTime,
			BaseOdds:       baseOdds,
			UpdatedAt:      uint64(time.Now().Unix()),
			IdempotencyKey: "methods-open-" + matchHex(matchID) + "-" + runTag,
		})
		if err != nil {
			t.Fatalf("OpenMarket: %v", err)
		}
		t.Logf("  tx=%s block=%d gas=%d", res.TxHash, res.BlockNumber, res.GasUsed)
	}

	// ── Step 2: UpdateOdds (NEW) ───────────────────────────────────────
	t.Log("\n=== Step 2: admin.UpdateOdds ===")
	{
		newOdds := []*big.Int{big.NewInt(21000), big.NewInt(29000), big.NewInt(21000)} // 2.1 / 2.9 / 2.1
		updatedAt := uint64(time.Now().Unix())
		res, err := adminCli.UpdateOddsWithReceipt(ctx, admin.UpdateOddsRequest{
			Market:         marketKey,
			BaseOdds:       newOdds,
			UpdatedAt:      updatedAt,
			IdempotencyKey: "methods-update-odds-" + matchHex(matchID) + "-" + runTag,
		})
		if err != nil {
			t.Fatalf("UpdateOdds: %v", err)
		}
		t.Logf("  tx=%s block=%d gas=%d", res.TxHash, res.BlockNumber, res.GasUsed)

		odds, err := readCli.GetMarketOdds(ctx, marketKey)
		if err != nil {
			t.Fatalf("GetMarketOdds after update: %v", err)
		}
		t.Logf("  read-back: base_odds=%v quoted_odds=%v updated_at=%d quote_version=%s", odds.BaseOdds, odds.QuotedOdds, odds.UpdatedAt, odds.QuoteVersion)
		if odds.UpdatedAt != updatedAt {
			t.Fatalf("UpdateOdds did not persist: got updatedAt=%d want %d", odds.UpdatedAt, updatedAt)
		}
		if len(odds.BaseOdds) != 3 {
			t.Fatalf("UpdateOdds outcome count: got %d want 3", len(odds.BaseOdds))
		}
	}

	// ── Step 3: Bettor approve LP + DepositMatch ───────────────────────
	t.Log("\n=== Step 3: bettor approve LP + DepositMatch (relay) ===")
	{
		if _, err := relayCli.ApproveWithReceipt(ctx, relay.ApproveRequest{
			UserID:         "bettor",
			Spender:        common.HexToAddress(addrLiquidityPool),
			Value:          lpAmount,
			IdempotencyKey: "methods-approve-lp-" + matchHex(matchID) + "-" + runTag,
		}); err != nil {
			t.Fatalf("Approve LP: %v", err)
		}
		lpPositionID, _ := readCli.NextLpPositionID(ctx)
		res, err := relayCli.DepositMatchWithReceipt(ctx, relay.DepositMatchRequest{
			UserID:         "bettor",
			MatchID:        matchID,
			Amount:         lpAmount,
			IdempotencyKey: "methods-deposit-match-" + matchHex(matchID) + "-" + runTag,
		})
		if err != nil {
			t.Fatalf("DepositMatch: %v", err)
		}
		t.Logf("  lp_position_id=%s tx=%s block=%d gas=%d", lpPositionID, res.TxHash, res.BlockNumber, res.GasUsed)
	}

	// ── Step 4: Bettor approve BettingPool + PlaceBet ──────────────────
	t.Log("\n=== Step 4: bettor approve BP + PlaceBet (relay) ===")
	var betID coretypes.BetID
	{
		if _, err := relayCli.ApproveWithReceipt(ctx, relay.ApproveRequest{
			UserID:         "bettor",
			Spender:        common.HexToAddress(addrBettingPool),
			Value:          betApproval,
			IdempotencyKey: "methods-approve-bp-" + matchHex(matchID) + "-" + runTag,
		}); err != nil {
			t.Fatalf("Approve BettingPool: %v", err)
		}
		res, err := relayCli.PlaceBetWithReceipt(ctx, relay.PlaceBetRequest{
			UserID:            "bettor",
			Market:            marketKey,
			Outcome:           0,
			Amount:            betAmount,
			MinAcceptedAmount: big.NewInt(1),
			MinOdds:           big.NewInt(10100),
			Deadline:          uint64(time.Now().Add(15 * time.Minute).Unix()),
			IdempotencyKey:    "methods-place-bet-" + matchHex(matchID) + "-" + runTag,
		})
		if err != nil {
			t.Fatalf("PlaceBet: %v", err)
		}
		betID = res.BetID
		t.Logf("  bet_id=%x accepted=%s locked_odds=%s tx=%s gas=%d", betID, res.AcceptedAmount, res.LockedOdds, res.TxHash, res.GasUsed)
		if betID == (coretypes.BetID{}) {
			t.Fatalf("PlaceBet returned zero BetID (BetPlaced event parse failed?)")
		}
	}

	// ── Wait until matchEndTime so SettleMarket is accepted ───────────
	t.Logf("\n=== Waiting until matchEndTime=%d ===", matchEndTime)
	scenarioWaitTimestamp(t, ctx, boot.eth, matchEndTime+5)

	// ── Step 5: FinalizeMarketSettlement(kind=1 Refunded) ─────────────
	// Refund/cancel skip score settlement: finalize directly with resultKind=1.
	// (finalizeMarketSettlement requires block.timestamp >= matchEndTime for all
	// result kinds, hence the wait above.)
	t.Log("\n=== Step 5: admin.FinalizeMarketSettlement (ResultKind=1 → Refunded) ===")
	{
		res, err := adminCli.FinalizeMarketSettlementWithReceipt(ctx, admin.FinalizeMarketSettlementRequest{
			Market:         marketKey,
			ResultKind:     1, // Refunded
			IdempotencyKey: "methods-finalize-refunded-" + matchHex(matchID) + "-" + runTag,
		})
		if err != nil {
			t.Fatalf("FinalizeMarketSettlement(Refunded): %v", err)
		}
		t.Logf("  tx=%s block=%d gas=%d", res.TxHash, res.BlockNumber, res.GasUsed)

		mkt, _ := readCli.GetMarket(ctx, marketKey)
		t.Logf("  market.Status=%s (expect Refunded)", mkt.Status)
		if mkt.Status != read.MarketStatusRefunded {
			t.Fatalf("market status after settle: got %s want Refunded", mkt.Status)
		}
	}

	// ── Step 6: RefundBets (NEW) ──────────────────────────────────────
	t.Log("\n=== Step 6: admin.RefundBets ===")
	{
		bet, err := readCli.GetBet(ctx, betID)
		if err != nil {
			t.Fatalf("GetBet pre-refund: %v", err)
		}
		// Use accepted amount as refund (full refund of the matched stake).
		refundAmount := new(big.Int).Set(bet.AcceptedAmount.BigInt())
		t.Logf("  pre-refund: state=%d accepted=%s", bet.SettlementState, bet.AcceptedAmount)

		res, err := adminCli.RefundBetsWithReceipt(ctx, admin.RefundBetsRequest{
			Market:         marketKey,
			BetIDs:         []coretypes.BetID{betID},
			RefundAmounts:  []*big.Int{refundAmount},
			IdempotencyKey: "methods-refund-bets-" + matchHex(matchID) + "-" + runTag,
		})
		if err != nil {
			t.Fatalf("RefundBets: %v", err)
		}
		t.Logf("  tx=%s block=%d gas=%d", res.TxHash, res.BlockNumber, res.GasUsed)

		bet, err = readCli.GetBet(ctx, betID)
		if err != nil {
			t.Fatalf("GetBet post-refund: %v", err)
		}
		t.Logf("  post-refund: state=%d refunded=%s (1=Refunded)", bet.SettlementState, bet.RefundedAmount)
		if bet.SettlementState != read.BetSettlementRefunded {
			t.Fatalf("bet state after RefundBets: got %d want Refunded(1)", bet.SettlementState)
		}
	}

	t.Log("\n=== UpdateOdds + RefundBets scenario complete ===")
}

// ════════════════════════════════════════════════════════════════════════
// Test B: market-level refund via FinalizeMarketSettlement(Refunded) + RefundBets
//
//	Step 1: admin.OpenMarket               (AH: MarketType=1, Line=1)
//	Step 2: bettor approve + DepositMatch  (LP liquidity)
//	Step 3: bettor approve + PlaceBet      (relay sponsored)
//	Step 4: wait → admin.FinalizeMarketSettlement(kind=1 Refunded) + RefundBets
//	Verify: market.Status==Refunded, bet.SettlementState==Refunded
//
// SDK v0.0.5 removed the single-shot pushRefundMarket. A market-level refund is
// now: finalize with resultKind=1 (Refunded), then batch-refund the pending
// bets via RefundBets. Unlike the old pushRefundMarket, finalizeMarketSettlement
// requires block.timestamp >= matchEndTime, so this test waits for match end.
// ════════════════════════════════════════════════════════════════════════
func TestScenarioMarketRefund(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	t.Cleanup(cancel)

	boot := newMethodsBootstrap(t, ctx)
	adminCli, relayCli, readCli := boot.adminCli, boot.relayCli, boot.readCli

	one18 := new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)
	lpAmount := new(big.Int).Mul(big.NewInt(lpMinDepositODD), one18)
	betAmount := new(big.Int).Mul(big.NewInt(100), one18)
	betApproval := new(big.Int).Add(betAmount, new(big.Int).Div(betAmount, big.NewInt(100)))

	now := uint64(time.Now().Unix())
	matchStartTime := now + 8*60
	matchEndTime := now + 9*60
	matchID := methodsMatchID("push-refund", now)
	// AH push line is marketType=1, line=1, 2 outcomes (home / away).
	marketKey := coretypes.MarketKey{MatchID: matchID, MarketType: 1, Line: 1}
	runTag := fmt.Sprintf("%d", time.Now().UnixNano())
	t.Logf("match_id=%x  market_id=%x  run_tag=%s", matchID, marketKey.MarketID(), runTag)
	t.Logf("match_start=%d  lock_at=%d  match_end=%d (now=%d)", matchStartTime, matchStartTime-300, matchEndTime, now)

	// ── Step 1: OpenMarket (AH push) ──────────────────────────────────
	t.Log("\n=== Step 1: admin.OpenMarket (AH push, line=1) ===")
	{
		baseOdds := []*big.Int{big.NewInt(20000), big.NewInt(20000)} // 2.0 / 2.0
		res, err := adminCli.OpenMarketWithReceipt(ctx, admin.OpenMarketRequest{
			MatchID:        matchID,
			MarketType:     1,
			Line:           1,
			MatchStartTime: matchStartTime,
			MatchEndTime:   matchEndTime,
			BaseOdds:       baseOdds,
			UpdatedAt:      uint64(time.Now().Unix()),
			IdempotencyKey: "methods-push-open-" + matchHex(matchID) + "-" + runTag,
		})
		if err != nil {
			t.Fatalf("OpenMarket(AH-push): %v", err)
		}
		t.Logf("  tx=%s block=%d gas=%d", res.TxHash, res.BlockNumber, res.GasUsed)
	}

	// ── Step 2: Bettor approve LP + DepositMatch ──────────────────────
	t.Log("\n=== Step 2: bettor approve LP + DepositMatch (relay) ===")
	{
		if _, err := relayCli.ApproveWithReceipt(ctx, relay.ApproveRequest{
			UserID:         "bettor",
			Spender:        common.HexToAddress(addrLiquidityPool),
			Value:          lpAmount,
			IdempotencyKey: "methods-push-approve-lp-" + matchHex(matchID) + "-" + runTag,
		}); err != nil {
			t.Fatalf("Approve LP: %v", err)
		}
		lpPositionID, _ := readCli.NextLpPositionID(ctx)
		res, err := relayCli.DepositMatchWithReceipt(ctx, relay.DepositMatchRequest{
			UserID:         "bettor",
			MatchID:        matchID,
			Amount:         lpAmount,
			IdempotencyKey: "methods-push-deposit-match-" + matchHex(matchID) + "-" + runTag,
		})
		if err != nil {
			t.Fatalf("DepositMatch: %v", err)
		}
		t.Logf("  lp_position_id=%s tx=%s block=%d gas=%d", lpPositionID, res.TxHash, res.BlockNumber, res.GasUsed)
	}

	// ── Step 3: Bettor approve BettingPool + PlaceBet ─────────────────
	t.Log("\n=== Step 3: bettor approve BP + PlaceBet (relay) ===")
	var betID coretypes.BetID
	{
		if _, err := relayCli.ApproveWithReceipt(ctx, relay.ApproveRequest{
			UserID:         "bettor",
			Spender:        common.HexToAddress(addrBettingPool),
			Value:          betApproval,
			IdempotencyKey: "methods-push-approve-bp-" + matchHex(matchID) + "-" + runTag,
		}); err != nil {
			t.Fatalf("Approve BettingPool: %v", err)
		}
		res, err := relayCli.PlaceBetWithReceipt(ctx, relay.PlaceBetRequest{
			UserID:            "bettor",
			Market:            marketKey,
			Outcome:           0,
			Amount:            betAmount,
			MinAcceptedAmount: big.NewInt(1),
			MinOdds:           big.NewInt(10100),
			Deadline:          uint64(time.Now().Add(15 * time.Minute).Unix()),
			IdempotencyKey:    "methods-push-place-bet-" + matchHex(matchID) + "-" + runTag,
		})
		if err != nil {
			t.Fatalf("PlaceBet: %v", err)
		}
		betID = res.BetID
		t.Logf("  bet_id=%x accepted=%s locked_odds=%s tx=%s gas=%d", betID, res.AcceptedAmount, res.LockedOdds, res.TxHash, res.GasUsed)
		if betID == (coretypes.BetID{}) {
			t.Fatalf("PlaceBet returned zero BetID")
		}
	}

	// ── Wait until matchEndTime so FinalizeMarketSettlement is accepted ──
	t.Logf("\n=== Waiting until matchEndTime=%d ===", matchEndTime)
	scenarioWaitTimestamp(t, ctx, boot.eth, matchEndTime+5)

	// ── Step 4: FinalizeMarketSettlement(kind=1 Refunded) + RefundBets ──
	t.Log("\n=== Step 4: admin.FinalizeMarketSettlement(Refunded) + RefundBets ===")
	{
		// 4a: mark the market Refunded (skip score settlement entirely).
		if _, err := adminCli.FinalizeMarketSettlementWithReceipt(ctx, admin.FinalizeMarketSettlementRequest{
			Market:         marketKey,
			ResultKind:     1, // Refunded
			IdempotencyKey: "methods-marketrefund-finalize-" + matchHex(matchID) + "-" + runTag,
		}); err != nil {
			t.Fatalf("FinalizeMarketSettlement(Refunded): %v", err)
		}
		mkt, _ := readCli.GetMarket(ctx, marketKey)
		t.Logf("  market.Status=%s (expect Refunded)", mkt.Status)
		if mkt.Status != read.MarketStatusRefunded {
			t.Fatalf("market status after finalize: got %s want Refunded", mkt.Status)
		}

		// 4b: batch-refund the pending bet (full matched stake).
		bet, err := readCli.GetBet(ctx, betID)
		if err != nil {
			t.Fatalf("GetBet pre-refund: %v", err)
		}
		refundAmount := new(big.Int).Set(bet.AcceptedAmount.BigInt())
		res, err := adminCli.RefundBetsWithReceipt(ctx, admin.RefundBetsRequest{
			Market:         marketKey,
			BetIDs:         []coretypes.BetID{betID},
			RefundAmounts:  []*big.Int{refundAmount},
			IdempotencyKey: "methods-marketrefund-refundbets-" + matchHex(matchID) + "-" + runTag,
		})
		if err != nil {
			t.Fatalf("RefundBets: %v", err)
		}
		t.Logf("  refund tx=%s block=%d gas=%d", res.TxHash, res.BlockNumber, res.GasUsed)

		bet, _ = readCli.GetBet(ctx, betID)
		t.Logf("  bet.state=%d refunded=%s (1=Refunded)", bet.SettlementState, bet.RefundedAmount)
		if bet.SettlementState != read.BetSettlementRefunded {
			t.Fatalf("bet state after RefundBets: got %d want Refunded(1)", bet.SettlementState)
		}
	}

	t.Log("\n=== Market refund scenario complete ===")
}
