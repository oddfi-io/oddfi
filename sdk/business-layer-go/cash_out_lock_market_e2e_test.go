//go:build e2e

// cash_out_lock_market_e2e_test.go — on-chain coverage for the two methods
// added on top of oddfi-ODD-SDK v0.0.10:
//
//   - admin.LockMarket   (OPERATOR_ROLE)  → TestLockMarketE2E
//   - relay.CashOut       (sponsored user) → TestCashOutE2E
//
// These reuse the constants + helpers declared in scenario_e2e_test.go
// (same package business_test): RPC/keys/addresses, scenarioMatchID,
// matchHex, newFakeMagicSigner, lpMinDepositODD.
//
// Run:
//
//	go test -tags e2e -run TestLockMarketE2E -v -timeout 15m ./...
//	go test -tags e2e -run TestCashOutE2E   -v -timeout 15m ./...

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
	"gorm.io/driver/mysql"
	"gorm.io/gorm"

	business "github.com/Crypto-Barrett/contracts-business-layer"
	"github.com/Crypto-Barrett/contracts-business-layer/admin"
	"github.com/Crypto-Barrett/contracts-business-layer/cache"
	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
	"github.com/Crypto-Barrett/contracts-business-layer/read"
	"github.com/Crypto-Barrett/contracts-business-layer/relay"
)

// TestLockMarketE2E: open a market with a far-future matchStart (so it never
// auto-locks), assert it is Open, manually LockMarket, assert it is Locked.
func TestLockMarketE2E(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	t.Cleanup(cancel)

	adminKey, err := crypto.HexToECDSA(strings.TrimPrefix(adminKeyHex, "0x"))
	if err != nil {
		t.Fatalf("parse adminKey: %v", err)
	}
	adminAddr := crypto.PubkeyToAddress(adminKey.PublicKey)

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
		t.Fatalf("NewAdminClients: %v", err)
	}
	t.Cleanup(func() { _ = adminClients.Close(ctx) })

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
		t.Fatalf("NewReadClients: %v", err)
	}
	t.Cleanup(func() { _ = readClients.Close(ctx) })

	adminCli := adminClients.Admin
	readCli := readClients.Read

	now := uint64(time.Now().Unix())
	matchStartTime := now + 365*24*60*60 // 1 year out: lockAt never elapses
	matchEndTime := matchStartTime + 60
	matchID := scenarioMatchID(now)
	marketKey := coretypes.MarketKey{MatchID: matchID, MarketType: 0, Line: 0}
	runTag := fmt.Sprintf("%d", time.Now().UnixNano())
	t.Logf("match_id=%x market_id=%x run_tag=%s", matchID, marketKey.MarketID(), runTag)

	ensureOperatorRole(t, ctx, adminCli, readCli, adminAddr, matchID, runTag)

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
		IdempotencyKey: "e2e-lock-open-" + matchHex(matchID) + "-" + runTag,
	}); err != nil {
		t.Fatalf("OpenMarket: %v", err)
	}

	if m, err := readCli.GetMarket(ctx, marketKey); err != nil {
		t.Fatalf("GetMarket (pre): %v", err)
	} else if m.Status != read.MarketStatusOpen {
		t.Fatalf("pre-lock status = %v, want Open", m.Status)
	}

	t.Log("=== LockMarket ===")
	res, err := adminCli.LockMarketWithReceipt(ctx, admin.LockMarketRequest{
		Market:         marketKey,
		IdempotencyKey: "e2e-lock-" + matchHex(matchID) + "-" + runTag,
	})
	if err != nil {
		t.Fatalf("LockMarket: %v", err)
	}
	t.Logf("  tx=%s block=%d gas=%d", res.TxHash, res.BlockNumber, res.GasUsed)

	if m, err := readCli.GetMarket(ctx, marketKey); err != nil {
		t.Fatalf("GetMarket (post): %v", err)
	} else if m.Status != read.MarketStatusLocked {
		t.Fatalf("post-lock status = %v, want Locked", m.Status)
	}
	t.Log("  market status = Locked ✓")
}

// TestCashOutE2E: open market → fund match pool → place bet → read the live
// quoteVersion → cash the bet out (full sponsored relay path), asserting a
// positive cashOutAmount.
//
// ⚠️ 30-second TTL: the contract requires quotedAt <= block.timestamp <=
// quotedAt+30s, checked at INCLUSION. The sponsored SetCodeTx must be mined
// within 30s of `quotedAt` below. On a congested testnet this can fail with a
// revert — re-run if so.
func TestCashOutE2E(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	t.Cleanup(cancel)

	adminKey, err := crypto.HexToECDSA(strings.TrimPrefix(adminKeyHex, "0x"))
	if err != nil {
		t.Fatalf("parse adminKey: %v", err)
	}
	bettorKey, err := crypto.HexToECDSA(strings.TrimPrefix(bettorKeyHex, "0x"))
	if err != nil {
		t.Fatalf("parse bettorKey: %v", err)
	}
	adminAddr := crypto.PubkeyToAddress(adminKey.PublicKey)

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
		t.Fatalf("NewAdminClients: %v", err)
	}
	t.Cleanup(func() { _ = adminClients.Close(ctx) })

	fakeMagic := newFakeMagicSigner(map[string]*ecdsa.PrivateKey{"bettor": bettorKey})
	relayClients, err := business.NewRelayClients(ctx, business.RelayConfig{
		RPCURL:            scenarioRPCURL,
		ChainID:           big.NewInt(scenarioChainID),
		SponsorPrivateKey: adminKey, // admin doubles as sponsor
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
		t.Fatalf("NewRelayClients: %v", err)
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
		t.Fatalf("NewReadClients: %v", err)
	}
	t.Cleanup(func() { _ = readClients.Close(ctx) })

	adminCli := adminClients.Admin
	relayCli := relayClients.Relay
	readCli := readClients.Read

	one18 := new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)
	lpAmount := new(big.Int).Mul(big.NewInt(lpMinDepositODD), one18) // 1000 ODD
	betAmount := new(big.Int).Mul(big.NewInt(100), one18)            // 100 ODD

	now := uint64(time.Now().Unix())
	matchStartTime := now + 365*24*60*60 // far future: market stays Open, >30min → feeBps=1000
	matchEndTime := matchStartTime + 60
	matchID := scenarioMatchID(now)
	marketKey := coretypes.MarketKey{MatchID: matchID, MarketType: 0, Line: 0}
	runTag := fmt.Sprintf("%d", time.Now().UnixNano())
	t.Logf("match_id=%x market_id=%x run_tag=%s", matchID, marketKey.MarketID(), runTag)

	ensureOperatorRole(t, ctx, adminCli, readCli, adminAddr, matchID, runTag)

	// Approvals (bettor → LP + BettingPool).
	t.Log("=== approve LP + BettingPool ===")
	if _, err := relayCli.ApproveWithReceipt(ctx, relay.ApproveRequest{
		UserID:         "bettor",
		Spender:        lpAddrContract,
		Value:          lpAmount,
		IdempotencyKey: "e2e-cashout-approve-lp-" + matchHex(matchID) + "-" + runTag,
	}); err != nil {
		t.Fatalf("approve LP: %v", err)
	}
	betApproval := new(big.Int).Add(betAmount, new(big.Int).Div(betAmount, big.NewInt(100)))
	if _, err := relayCli.ApproveWithReceipt(ctx, relay.ApproveRequest{
		UserID:         "bettor",
		Spender:        bpAddr,
		Value:          betApproval,
		IdempotencyKey: "e2e-cashout-approve-bp-" + matchHex(matchID) + "-" + runTag,
	}); err != nil {
		t.Fatalf("approve BettingPool: %v", err)
	}

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
		IdempotencyKey: "e2e-cashout-open-" + matchHex(matchID) + "-" + runTag,
	}); err != nil {
		t.Fatalf("OpenMarket: %v", err)
	}

	t.Log("=== DepositMatch (fund match pool) ===")
	if _, err := relayCli.DepositMatchWithReceipt(ctx, relay.DepositMatchRequest{
		UserID:         "bettor",
		MatchID:        matchID,
		Amount:         lpAmount,
		IdempotencyKey: "e2e-cashout-deposit-" + matchHex(matchID) + "-" + runTag,
	}); err != nil {
		t.Fatalf("DepositMatch: %v", err)
	}

	t.Log("=== PlaceBet ===")
	placed, err := relayCli.PlaceBetWithReceipt(ctx, relay.PlaceBetRequest{
		UserID:            "bettor",
		Market:            marketKey,
		Outcome:           0,
		Amount:            betAmount,
		MinAcceptedAmount: big.NewInt(1),
		MinOdds:           big.NewInt(10100),
		Deadline:          uint64(time.Now().Add(15 * time.Minute).Unix()),
		IdempotencyKey:    "e2e-cashout-bet-" + matchHex(matchID) + "-" + runTag,
	})
	if err != nil {
		t.Fatalf("PlaceBet: %v", err)
	}
	t.Logf("  bet_id=%x accepted=%s", placed.BetID, placed.AcceptedAmount)

	// Read the live quote AFTER PlaceBet (PlaceBet bumps quoteVersion).
	odds, err := readCli.GetMarketOdds(ctx, marketKey)
	if err != nil {
		t.Fatalf("GetMarketOdds: %v", err)
	}
	quoteVersion := odds.QuoteVersion.BigInt()
	t.Logf("  quote_version=%s", quoteVersion)

	// Stamp quotedAt now; the sponsored cashOut must be mined within 30s.
	quotedAt := uint64(time.Now().Unix())

	t.Log("=== CashOut ===")
	res, err := relayCli.CashOutWithReceipt(ctx, relay.CashOutRequest{
		UserID:               "bettor",
		BetID:                placed.BetID,
		ExpectedQuoteVersion: quoteVersion,
		QuotedAt:             quotedAt,
		MinAmountOut:         big.NewInt(1), // non-binding; contract floor is 10 ODD
		Deadline:             uint64(time.Now().Add(2 * time.Minute).Unix()),
		IdempotencyKey:       "e2e-cashout-" + matchHex(matchID) + "-" + runTag,
	})
	if err != nil {
		t.Fatalf("CashOut: %v", err)
	}
	t.Logf("  tx=%s block=%d gas=%d cash_out_amount=%v", res.TxHash, res.BlockNumber, res.GasUsed, res.CashOutAmount)
	if res.CashOutAmount == nil || res.CashOutAmount.Sign() <= 0 {
		t.Fatalf("expected positive cashOutAmount, got %v", res.CashOutAmount)
	}

	// Bet must now be in the CashedOut terminal state.
	if b, err := readCli.GetBet(ctx, placed.BetID); err != nil {
		t.Fatalf("GetBet (post): %v", err)
	} else if b.SettlementState != read.BetSettlementCashedOut {
		t.Fatalf("post-cashout bet state = %d, want %d (CashedOut)", b.SettlementState, read.BetSettlementCashedOut)
	}
	t.Log("  bet state = CashedOut ✓")
}

// ensureOperatorRole grants OPERATOR_ROLE to admin if missing (OpenMarket /
// LockMarket both require it). Mirrors the role-grant step in scenario_e2e.
func ensureOperatorRole(
	t *testing.T, ctx context.Context,
	adminCli *admin.Client, readCli *read.Client,
	adminAddr common.Address, matchID coretypes.MatchID, runTag string,
) {
	t.Helper()
	operatorRole := crypto.Keccak256Hash([]byte("OPERATOR_ROLE"))
	if has, _ := readCli.HasRole(ctx, operatorRole, adminAddr); has {
		return
	}
	if _, err := adminCli.GrantRoleWithReceipt(ctx, admin.GrantRoleRequest{
		Role:           operatorRole,
		Account:        adminAddr,
		IdempotencyKey: "e2e-grant-operator-" + matchHex(matchID) + "-" + runTag,
	}); err != nil {
		t.Fatalf("GrantRole OPERATOR: %v", err)
	}
}
