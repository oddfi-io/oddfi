//go:build e2e

// liquidity_lifecycle_e2e_test.go — three independent end-to-end tests that
// together cover the LiquidityPool "add → settle → unbond → withdraw"
// lifecycle, using ONLY the admin / relay / read clients this project exposes.
//
// All connection params / keys / addresses are reused from
// scenario_e2e_test.go (same package + build tag) — see the constants there.
// A == bettorKeyHex == lpUserKeyHex is the LP user; admin doubles as gas
// sponsor and OPERATOR / SETTLER. Pre-fund A with >= 1000 ODD
// (== LiquidityPool.minDeposit) PER TEST before running.
//
// ──────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────
//
//   TestLiquidityGlobalAddOnly
//       Deposits 1000 ODD into the GLOBAL liquidity pool (plan 0, shortest
//       lock). Prints the on-chain tx hash + assigned lp_position_id. DOES
//       NOT attempt to remove the liquidity — global plan 0 locks for 7
//       "days" (= 7 × SECONDS_PER_DAY = 7 × 3600s ≈ 7 hours under this
//       contract's accelerated time config), so removal cannot be done in a
//       single run.
//
//   TestLiquidityMatchAddSettleUnbond
//       Full per-match LP lifecycle UP TO unbond (not withdraw):
//         OpenMarket → Approve → DepositMatch → wait matchEnd → Finalize
//         (terminal) → RequestUnbond → write lp_position_id to file.
//       Withdraw is INTENTIONALLY left for the next test method, run
//       manually ~3 hours later (unbondEpochs+1 = 3 epochs × 3600s).
//
//   TestLiquidityWithdraw
//       Reads ./.last_lp_position written by the previous test, calls
//       Withdraw. Fail-fast: if the unbond epochs haven't elapsed, the
//       contract reverts with EpochNotReady and this test fails — that's
//       expected behavior, just re-run it later. No polling, no sleeping.
//
// ──────────────────────────────────────────────────────────────────────────
// Build / run
// ──────────────────────────────────────────────────────────────────────────
//
//	go test -tags e2e -run TestLiquidityGlobalAddOnly         -v -timeout 5m  ./...
//	go test -tags e2e -run TestLiquidityMatchAddSettleUnbond  -v -timeout 30m ./...
//	# ~3 hours later (3 epochs × 3600s after the unbond block):
//	go test -tags e2e -run TestLiquidityWithdraw              -v -timeout 5m  ./...

package business_test

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"math/big"
	"os"
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

// lpPositionFile is the on-disk hand-off between
// TestLiquidityMatchAddSettleUnbond (writer) and TestLiquidityWithdraw
// (reader). Lives at the project root; gitignored.
const lpPositionFile = ".last_lp_position"

// lpUserID is the Magic user_id for user A (== bettorKeyHex) across the
// liquidity + staking lifecycle tests. newLPTestClients registers it with the
// in-process fakeMagicSigner so relay calls sign on A's behalf; relay requests
// pass UserID: lpUserID and the EOA is resolved internally via the signer.
const lpUserID = "A"

// LpPositionState values mirror oddfi-ODD src/shared/types/LiquidityEnums.sol.
// GetLpPositionState returns the EFFECTIVE state: Active flips to Ready once
// unlockAt passes; Unbonding flips to Withdrawable once unbondEpochs+1
// epochs elapse.
const (
	lpActive       = read.LpPositionState(0)
	lpUnbonding    = read.LpPositionState(1)
	lpReady        = read.LpPositionState(2)
	lpWithdrawn    = read.LpPositionState(3)
	lpLiquidated   = read.LpPositionState(4)
	lpWithdrawable = read.LpPositionState(5)
)

// ════════════════════════════════════════════════════════════════════════
// TestLiquidityGlobalAddOnly — global pool: add liquidity, then leave it.
// ════════════════════════════════════════════════════════════════════════
//
// Flow:
//
//	1. Wire up admin+relay+read clients (newLPTestClients).
//	2. Sanity-check A's ODD balance is >= lpMinDepositODD; t.Skip otherwise
//	   with a clear "please fund A" message so the test can't be silently
//	   green on an empty wallet.
//	3. Pre-read NextLpPositionID — DepositGlobalWithReceipt doesn't (yet)
//	   parse the LiquidityDeposited event, so we predict the id this way.
//	4. relay.Approve(LiquidityPool, 1000 ODD)  — sponsored by admin (B).
//	5. relay.DepositGlobal(planID=0, amount=1000 ODD) — sponsored by admin.
//	   Plan 0 = shortest global lock (GLOBAL_PLAN_0_LOCK_DAYS = 7 "days"
//	   which under PrecisionConstants.SECONDS_PER_DAY=3600 means 7 hours).
//	6. Assert effective state == Active (deposit landed).
//	7. Log tx hash, block, gas, positionId, and the next-position-id advance.
//	8. Done. No requestUnbond, no withdraw — the position stays on-chain.

/*
go test -tags e2e -run TestLiquidityGlobalAddOnly -v -timeout 5m

	=== RUN   TestLiquidityGlobalAddOnly
	   liquidity_lifecycle_e2e_test.go:119: lpUser(A) = 0x46F00168097De28a2c436540C93db16914601d6d  run_tag = 1779977248095736900
	   liquidity_lifecycle_e2e_test.go:130:   LiquidityPool.minDeposit = 1000000000000000000000 ODD
	   liquidity_lifecycle_e2e_test.go:142: === Step 4: A approve LiquidityPool ===
	   liquidity_lifecycle_e2e_test.go:153: === Step 5: relay.DepositGlobal (add liquidity) ===
	   liquidity_lifecycle_e2e_test.go:163:   lp_position_id=63 tx_hash=0xc456b03b10b8b2f57b7ddbe3079aa94f09cd3b595c8f807dd05e697820929aa3 block=110075999 gas=300715
	   liquidity_lifecycle_e2e_test.go:181:   requestableLiquidity: 68668967778835876699000 → 69668967778835876699000
	   liquidity_lifecycle_e2e_test.go:182:   totalActiveDeposited: 70933000000000000000000 → 71933000000000000000000
	   liquidity_lifecycle_e2e_test.go:184: === Global add complete (position left on-chain; no unbond/withdraw) ===

--- PASS: TestLiquidityGlobalAddOnly (15.57s)
*/
func TestLiquidityGlobalAddOnly(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	t.Cleanup(cancel)

	clients := newLPTestClients(t, ctx)
	relayCli, readCli := clients.Relay, clients.Read

	lpKey := mustECDSA(t, bettorKeyHex) // A
	lpAddr := crypto.PubkeyToAddress(lpKey.PublicKey)
	runTag := fmt.Sprintf("%d", time.Now().UnixNano())
	t.Logf("lpUser(A) = %s  run_tag = %s", lpAddr.Hex(), runTag)

	one18 := new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)
	lpAmount := new(big.Int).Mul(big.NewInt(lpMinDepositODD), one18) // 1000 ODD
	const planID = uint16(0)

	// Step 2 — balance sanity check
	requireMinODD(t, ctx, readCli, lpAddr, lpAmount, "TestLiquidityGlobalAddOnly")

	// Informational pre-state.
	if md, err := readCli.MinDeposit(ctx); err == nil {
		t.Logf("  LiquidityPool.minDeposit = %s ODD", md)
	}
	reqBefore, _ := readCli.RequestableLiquidity(ctx)
	actBefore, _ := readCli.TotalActiveDeposited(ctx)

	// Step 3 — predict positionId
	posID, err := readCli.NextLpPositionID(ctx)
	if err != nil {
		t.Fatalf("NextLpPositionID: %v", err)
	}

	// Step 4 — A approves LiquidityPool
	t.Log("=== Step 4: A approve LiquidityPool ===")
	if _, err := relayCli.ApproveWithReceipt(ctx, relay.ApproveRequest{
		UserID:         lpUserID,
		Spender:        common.HexToAddress(addrLiquidityPool),
		Value:          lpAmount,
		IdempotencyKey: "lp-global-add-approve-" + runTag,
	}); err != nil {
		t.Fatalf("approve LiquidityPool: %v", err)
	}

	// Step 5 — DepositGlobal (add liquidity to the global pool)
	t.Log("=== Step 5: relay.DepositGlobal (add liquidity) ===")
	res, err := relayCli.DepositGlobalWithReceipt(ctx, relay.DepositGlobalRequest{
		UserID:         lpUserID,
		Amount:         lpAmount,
		PlanID:         planID,
		IdempotencyKey: "lp-global-add-deposit-" + runTag,
	})
	if err != nil {
		t.Fatalf("DepositGlobal: %v", err)
	}
	t.Logf("  lp_position_id=%s tx_hash=%s block=%d gas=%d",
		posID, res.TxHash, res.BlockNumber, res.GasUsed)

	// Step 6 — assert deposit landed and is Active
	st, err := readCli.GetLpPositionState(ctx, posID)
	if err != nil {
		t.Fatalf("GetLpPositionState: %v", err)
	}
	if st != lpActive {
		t.Fatalf("new global position state = %d, want Active(%d)", st, lpActive)
	}
	if next, _ := readCli.NextLpPositionID(ctx); next.Cmp(posID) <= 0 {
		t.Fatalf("NextLpPositionID did not advance past %s (got %s)", posID, next)
	}

	// Step 7 — accounting deltas (informational)
	reqAfter, _ := readCli.RequestableLiquidity(ctx)
	actAfter, _ := readCli.TotalActiveDeposited(ctx)
	t.Logf("  requestableLiquidity: %s → %s", reqBefore, reqAfter)
	t.Logf("  totalActiveDeposited: %s → %s", actBefore, actAfter)

	t.Log("=== Global add complete (position left on-chain; no unbond/withdraw) ===")
}

// ════════════════════════════════════════════════════════════════════════
// TestLiquidityMatchAddSettleUnbond — per-match pool: full flow up to unbond.
// ════════════════════════════════════════════════════════════════════════
//
// Flow:
//
//  1. Wire up admin+relay+read+eth clients.
//  2. Pick matchStartTime = now + 5min, matchEndTime = now + 6min — gives
//     us ~5 minutes to land OpenMarket + Approve + DepositMatch before the
//     pool's depositCloseAt slams shut, and a 1-minute match window so we
//     don't waste cycles waiting for matchEnd.
//  3. Sanity-check A has >= 1000 ODD; t.Skip otherwise.
//  4. ensureRole(OPERATOR_ROLE, admin); admin.OpenMarket (1x2, line 0,
//     sample baseOdds). OpenMarket triggers LiquidityPool.openMatchPool
//     the first time a market for the match is opened.
//  5. relay.Approve(LiquidityPool, 1000 ODD).
//  6. Predict posID via NextLpPositionID, then relay.DepositMatch.
//  7. Assert state == Active.
//  8. scenarioWaitTimestamp to matchEndTime + 5s.
//  9. ensureRole(SETTLER_ROLE, admin); admin.FinalizeMarketSettlement
//     with ResultKind = Settled. (No bets, so SettleMarketBetsByScore is
//     skipped — Finalize alone makes the match terminal.)
//  10. Poll IsMatchTerminal up to 2min — match-pool unbond requires both
//     now >= unlockAt(=matchEndTime) AND match is terminal.
//  11. relay.RequestUnbond(posID). Assert state ∈ {Unbonding, Withdrawable}.
//  12. Write posID (decimal) to ./.last_lp_position (overwrite). Log all tx
//     hashes / blocks / gas + posID + a reminder of when withdraw becomes
//     callable (approximately: unbond receipt block time + 3 × 3600s).
//  13. Done. Withdraw is in TestLiquidityWithdraw, manually triggered later.

/*
=== RUN   TestLiquidityMatchAddSettleUnbond

	liquidity_lifecycle_e2e_test.go:254: admin=0x7501bCBFAAa99e6390577277D051A32ec2e64064 lpUser(A)=0x46F00168097De28a2c436540C93db16914601d6d match_id=000000000000000000000000000000000000000000000000000000006a185104 run_tag=1779978500715086400
	liquidity_lifecycle_e2e_test.go:256: matchStartTime=1779978800 matchEndTime=1779978860
	liquidity_lifecycle_e2e_test.go:262: === Step 4: admin.OpenMarket (opens match liquidity pool) ===
	liquidity_lifecycle_e2e_test.go:269:   sleeping 5s to let RPC pending-nonce catch up after ensureRole
	liquidity_lifecycle_e2e_test.go:286:   open tx=0x63dd805ab3914a2ca76fa067c65d1f51cd2e852a604ddea7a74f68e8aa1bbedb block=110078784 gas=520493
	liquidity_lifecycle_e2e_test.go:290: === Step 5: A approve LiquidityPool ===
	liquidity_lifecycle_e2e_test.go:305: === Step 6: relay.DepositMatch (add liquidity) ===
	liquidity_lifecycle_e2e_test.go:316:   lp_position_id=65 deposit tx=0x20ca8f7fe6420eafcce99adaab85b813292977cdc7c36ba9a26dd90a8d06640d block=110078811 gas=317739
	liquidity_lifecycle_e2e_test.go:328: === Step 8: wait until matchEndTime=1779978860, then finalize ===
	liquidity_lifecycle_e2e_test.go:336:   sleeping 5s to let RPC pending-nonce catch up after ensureRole
	liquidity_lifecycle_e2e_test.go:349:   finalize tx=0x8c3c6921731a533b7490d22156f408940e543eb852d4ad83dd51365da4c22f65 block=110079587 gas=110632
	liquidity_lifecycle_e2e_test.go:366: === Step 11: relay.RequestUnbond ===
	liquidity_lifecycle_e2e_test.go:375:   unbond tx=0x1c04869d3ce5a8bb27e6c2f56940a1f10ae5790d435fa32d74370ada24e87c69 block=110079599 gas=201531
	liquidity_lifecycle_e2e_test.go:384:   wrote lp_position_id=65 to ./.last_lp_position
	liquidity_lifecycle_e2e_test.go:386:   unbondEpochs=2 → Withdraw is callable after 3 more epochs (1 epoch = 3600s, so ≈ 10800 seconds from unbond block)
	liquidity_lifecycle_e2e_test.go:390: === Match add → settle → unbond complete. Now wait ~3 hours and run TestLiquidityWithdraw. ===

--- PASS: TestLiquidityMatchAddSettleUnbond (382.38s)
PASS
*/
func TestLiquidityMatchAddSettleUnbond(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	t.Cleanup(cancel)

	clients := newLPTestClients(t, ctx)
	adminCli, relayCli, readCli, eth := clients.Admin, clients.Relay, clients.Read, clients.Eth

	adminKey := mustECDSA(t, adminKeyHex)
	lpKey := mustECDSA(t, bettorKeyHex) // A
	adminAddr := crypto.PubkeyToAddress(adminKey.PublicKey)
	lpAddr := crypto.PubkeyToAddress(lpKey.PublicKey)
	runTag := fmt.Sprintf("%d", time.Now().UnixNano())

	one18 := new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)
	lpAmount := new(big.Int).Mul(big.NewInt(lpMinDepositODD), one18) // 1000 ODD

	// Step 2 — pick match times
	now := uint64(time.Now().Unix())
	matchStartTime := now + 5*60
	matchEndTime := now + 6*60
	matchID := scenarioMatchID(now)
	marketKey := coretypes.MarketKey{MatchID: matchID, MarketType: 0, Line: 0}
	t.Logf("admin=%s lpUser(A)=%s match_id=%x run_tag=%s",
		adminAddr.Hex(), lpAddr.Hex(), matchID, runTag)
	t.Logf("matchStartTime=%d matchEndTime=%d", matchStartTime, matchEndTime)

	// Step 3 — balance sanity check
	requireMinODD(t, ctx, readCli, lpAddr, lpAmount, "TestLiquidityMatchAddSettleUnbond")

	// Step 4 — OpenMarket (also opens the match liquidity pool)
	t.Log("=== Step 4: admin.OpenMarket (opens match liquidity pool) ===")
	ensureRole(t, ctx, adminCli, readCli, "OPERATOR_ROLE", adminAddr, runTag)
	// Workaround: when ensureRole had to actually GrantRole, Alchemy's shared
	// RPC can lag for a few seconds before PendingNonceAt sees the new nonce.
	// Sleep a few seconds before the next admin direct tx to avoid
	// "nonce too low" on OpenMarket. Cheap and local; the real fix is to
	// route admin submissions through internal/nonce.Lease.
	t.Log("  sleeping 5s to let RPC pending-nonce catch up after ensureRole")
	time.Sleep(5 * time.Second)
	{
		baseOdds := []*big.Int{big.NewInt(20000), big.NewInt(30000), big.NewInt(20000)}
		res, err := adminCli.OpenMarketWithReceipt(ctx, admin.OpenMarketRequest{
			MatchID:        matchID,
			MarketType:     0, // 1x2
			Line:           0,
			MatchStartTime: matchStartTime,
			MatchEndTime:   matchEndTime,
			BaseOdds:       baseOdds,
			UpdatedAt:      uint64(time.Now().Unix()),
			IdempotencyKey: "lp-match-open-" + matchHex(matchID) + "-" + runTag,
		})
		if err != nil {
			t.Fatalf("OpenMarket: %v", err)
		}
		t.Logf("  open tx=%s block=%d gas=%d", res.TxHash, res.BlockNumber, res.GasUsed)
	}

	// Step 5 — A approves LiquidityPool
	t.Log("=== Step 5: A approve LiquidityPool ===")
	if _, err := relayCli.ApproveWithReceipt(ctx, relay.ApproveRequest{
		UserID:         lpUserID,
		Spender:        common.HexToAddress(addrLiquidityPool),
		Value:          lpAmount,
		IdempotencyKey: "lp-match-approve-" + matchHex(matchID) + "-" + runTag,
	}); err != nil {
		t.Fatalf("approve LiquidityPool: %v", err)
	}

	// Step 6 — predict positionId + DepositMatch
	posID, err := readCli.NextLpPositionID(ctx)
	if err != nil {
		t.Fatalf("NextLpPositionID: %v", err)
	}
	t.Log("=== Step 6: relay.DepositMatch (add liquidity) ===")
	{
		res, err := relayCli.DepositMatchWithReceipt(ctx, relay.DepositMatchRequest{
			UserID:         lpUserID,
			MatchID:        matchID,
			Amount:         lpAmount,
			IdempotencyKey: "lp-match-deposit-" + matchHex(matchID) + "-" + runTag,
		})
		if err != nil {
			t.Fatalf("DepositMatch: %v", err)
		}
		t.Logf("  lp_position_id=%s deposit tx=%s block=%d gas=%d",
			posID, res.TxHash, res.BlockNumber, res.GasUsed)
	}

	// Step 7 — assert state == Active
	if st, err := readCli.GetLpPositionState(ctx, posID); err != nil {
		t.Fatalf("GetLpPositionState: %v", err)
	} else if st != lpActive {
		t.Fatalf("new match position state=%d, want Active(%d)", st, lpActive)
	}

	// Step 8 — wait for matchEndTime (so requestUnbond's now >= unlockAt holds)
	t.Logf("=== Step 8: wait until matchEndTime=%d, then finalize ===", matchEndTime)
	scenarioWaitTimestamp(t, ctx, eth, matchEndTime+5)

	// Step 9 — Finalize the market so the match becomes terminal
	ensureRole(t, ctx, adminCli, readCli, "SETTLER_ROLE", adminAddr, runTag)
	// Same Alchemy pending-nonce lag workaround as Step 4 — without this we
	// hit "nonce too low: next nonce N+1, tx nonce N" on FinalizeMarketSettlement
	// when ensureRole actually submitted a GrantRole tx just before.
	t.Log("  sleeping 5s to let RPC pending-nonce catch up after ensureRole")
	time.Sleep(5 * time.Second)
	{
		// No bets → no SettleMarketBetsByScore needed; Finalize alone moves the
		// market to Settled and the match to terminal.
		res, err := adminCli.FinalizeMarketSettlementWithReceipt(ctx, admin.FinalizeMarketSettlementRequest{
			Market:         marketKey,
			ResultKind:     0, // Settled
			IdempotencyKey: "lp-match-finalize-" + matchHex(matchID) + "-" + runTag,
		})
		if err != nil {
			t.Fatalf("FinalizeMarketSettlement: %v", err)
		}
		t.Logf("  finalize tx=%s block=%d gas=%d", res.TxHash, res.BlockNumber, res.GasUsed)
	}

	// Step 10 — poll for terminal
	terminal := false
	for i := 0; i < 60; i++ {
		if term, _ := readCli.IsMatchTerminal(ctx, matchID); term {
			terminal = true
			break
		}
		time.Sleep(2 * time.Second)
	}
	if !terminal {
		t.Fatal("match did not become terminal after finalize; cannot RequestUnbond")
	}

	// Step 11 — RequestUnbond
	t.Log("=== Step 11: relay.RequestUnbond ===")
	unbondRes, err := relayCli.RequestUnbondWithReceipt(ctx, relay.RequestUnbondRequest{
		UserID:         lpUserID,
		PositionID:     posID,
		IdempotencyKey: "lp-match-unbond-" + matchHex(matchID) + "-" + runTag,
	})
	if err != nil {
		t.Fatalf("RequestUnbond: %v", err)
	}
	t.Logf("  unbond tx=%s block=%d gas=%d", unbondRes.TxHash, unbondRes.BlockNumber, unbondRes.GasUsed)
	if st, _ := readCli.GetLpPositionState(ctx, posID); st != lpUnbonding && st != lpWithdrawable {
		t.Fatalf("post-unbond state=%d, want Unbonding(%d) or Withdrawable(%d)", st, lpUnbonding, lpWithdrawable)
	}

	// Step 11.5 — PreviewWithdraw must agree with GetLpPositionState on the
	// effective state. The position is now Unbonding/Withdrawable, so the
	// contract computes a real withdraw outcome rather than returning zeroes.
	if pv, err := readCli.PreviewWithdraw(ctx, posID); err != nil {
		t.Fatalf("PreviewWithdraw: %v", err)
	} else {
		st, _ := readCli.GetLpPositionState(ctx, posID)
		if pv.EffectiveState != st {
			t.Fatalf("PreviewWithdraw.EffectiveState=%d != GetLpPositionState=%d", pv.EffectiveState, st)
		}
		t.Logf("  preview after unbond: withdrawAmount=%s netPnl=%s effectiveState=%d",
			pv.WithdrawAmount.String(), pv.NetPnL.String(), pv.EffectiveState)
	}

	// Step 12 — persist posID for TestLiquidityWithdraw
	if err := os.WriteFile(lpPositionFile, []byte(posID.String()+"\n"), 0o644); err != nil {
		t.Fatalf("write %s: %v", lpPositionFile, err)
	}
	t.Logf("  wrote lp_position_id=%s to ./%s", posID, lpPositionFile)
	if epochs, err := readCli.UnbondEpochs(ctx); err == nil {
		t.Logf("  unbondEpochs=%d → Withdraw is callable after %d more epochs (1 epoch = 3600s, so ≈ %d seconds from unbond block)",
			epochs, epochs+1, (epochs+1)*3600)
	}

	t.Log("=== Match add → settle → unbond complete. Now wait ~3 hours and run TestLiquidityWithdraw. ===")
}

// ════════════════════════════════════════════════════════════════════════
// TestLiquidityWithdraw — manually triggered after ~3h
// ════════════════════════════════════════════════════════════════════════
//
// Flow:
//
//  1. Wire up relay+read clients.
//  2. Read ./.last_lp_position; t.Fatal if missing/unparsable with a clear
//     "run TestLiquidityMatchAddSettleUnbond first" message.
//  3. Snapshot A's ODD balance.
//  4. relay.Withdraw(posID). Fail-fast: if the contract reverts (e.g.
//     EpochNotReady because unbond epochs haven't elapsed yet) the error
//     propagates to t.Fatal. Re-run later — no polling, no sleeping.
//  5. Snapshot A's ODD balance again, log the delta.
//  6. Assert final state ∈ {Withdrawn, Liquidated}. Liquidated means net
//     loss >= principal; withdrawAmount = 0; balance unchanged.
/*
=== RUN   TestLiquidityWithdraw
    liquidity_lifecycle_e2e_test.go:449: lpUser(A)=0x46F00168097De28a2c436540C93db16914601d6d lp_position_id=65 run_tag=1780034658197494300
    liquidity_lifecycle_e2e_test.go:453:   pre-withdraw effective state = 5
    liquidity_lifecycle_e2e_test.go:461:   ODD balance before = 5510000000000000000000
    liquidity_lifecycle_e2e_test.go:464: === relay.Withdraw ===
    liquidity_lifecycle_e2e_test.go:473:   withdraw tx=0xce8e61370182169b5403ad1b98c33fc535e4942cde48029aa070237a5cb5ef07 block=110203560 gas=163082
    liquidity_lifecycle_e2e_test.go:481:   ODD balance after  = 6510000000000000000000
    liquidity_lifecycle_e2e_test.go:482:   ODD balance delta  = 1000000000000000000000 (negative or zero is fine if the position was Liquidated)
    liquidity_lifecycle_e2e_test.go:492: === Withdraw complete. Final state=3 (3=Withdrawn, 4=Liquidated). ===
--- PASS: TestLiquidityWithdraw (15.29s)
PASS
*/
func TestLiquidityWithdraw(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	t.Cleanup(cancel)

	clients := newLPTestClients(t, ctx)
	relayCli, readCli := clients.Relay, clients.Read

	lpKey := mustECDSA(t, bettorKeyHex) // A — must own the position
	lpAddr := crypto.PubkeyToAddress(lpKey.PublicKey)
	runTag := fmt.Sprintf("%d", time.Now().UnixNano())

	// Step 2 — read posID from file
	posID, err := readLpPositionFile()
	if err != nil {
		t.Fatalf("read %s: %v — run TestLiquidityMatchAddSettleUnbond first to produce it", lpPositionFile, err)
	}
	t.Logf("lpUser(A)=%s lp_position_id=%s run_tag=%s", lpAddr.Hex(), posID, runTag)

	// Informational: log current state before attempting withdraw
	if st, err := readCli.GetLpPositionState(ctx, posID); err == nil {
		t.Logf("  pre-withdraw effective state = %d", st)
	}

	// Step 3 — snapshot balance
	balBefore, err := readCli.BalanceOf(ctx, lpAddr)
	if err != nil {
		t.Fatalf("BalanceOf(before): %v", err)
	}
	t.Logf("  ODD balance before = %s", balBefore.String())

	// Step 3.5 — preview the withdraw BEFORE submitting. Withdraw uses the same
	// frozen accounting basis, so the previewed amount must exactly predict the
	// realized ODD balance delta below (checked in Step 5.5). This holds for
	// Liquidated positions too: previewWithdraw reports 0 and the balance is
	// unchanged.
	preview, err := readCli.PreviewWithdraw(ctx, posID)
	if err != nil {
		t.Fatalf("PreviewWithdraw: %v", err)
	}
	t.Logf("  preview: withdrawAmount=%s netPnl=%s effectiveState=%d",
		preview.WithdrawAmount.String(), preview.NetPnL.String(), preview.EffectiveState)

	// Step 4 — Withdraw; fail-fast on chain revert
	t.Log("=== relay.Withdraw ===")
	res, err := relayCli.WithdrawWithReceipt(ctx, relay.WithdrawRequest{
		UserID:         lpUserID,
		PositionID:     posID,
		IdempotencyKey: "lp-withdraw-" + posID.String() + "-" + runTag,
	})
	if err != nil {
		t.Fatalf("Withdraw reverted (likely EpochNotReady — unbond epochs not yet elapsed; re-run later): %v", err)
	}
	t.Logf("  withdraw tx=%s block=%d gas=%d", res.TxHash, res.BlockNumber, res.GasUsed)

	// Step 5 — snapshot balance again
	balAfter, err := readCli.BalanceOf(ctx, lpAddr)
	if err != nil {
		t.Fatalf("BalanceOf(after): %v", err)
	}
	delta := balAfter.Sub(balBefore)
	t.Logf("  ODD balance after  = %s", balAfter.String())
	t.Logf("  ODD balance delta  = %s (negative or zero is fine if the position was Liquidated)", delta.String())

	// Step 5.5 — the pre-withdraw preview must have predicted the realized
	// balance delta exactly. Gas is paid in the native token (and sponsored),
	// so the ODD delta is purely the withdraw transfer.
	if !delta.Equal(preview.WithdrawAmount) {
		t.Fatalf("PreviewWithdraw.WithdrawAmount=%s did not match realized ODD balance delta=%s",
			preview.WithdrawAmount.String(), delta.String())
	}

	// Step 6 — assert final state
	st, err := readCli.GetLpPositionState(ctx, posID)
	if err != nil {
		t.Fatalf("GetLpPositionState(after): %v", err)
	}
	if st != lpWithdrawn && st != lpLiquidated {
		t.Fatalf("post-withdraw state=%d, want Withdrawn(%d) or Liquidated(%d)", st, lpWithdrawn, lpLiquidated)
	}
	t.Logf("=== Withdraw complete. Final state=%d (3=Withdrawn, 4=Liquidated). ===", st)
}

// ─── shared helpers ────────────────────────────────────────────────────────

// mustECDSA parses a hex private key or fails the test.
func mustECDSA(t *testing.T, hexKey string) *ecdsa.PrivateKey {
	t.Helper()
	k, err := crypto.HexToECDSA(strings.TrimPrefix(hexKey, "0x"))
	if err != nil {
		t.Fatalf("parse key: %v", err)
	}
	return k
}

// newLPTestClients wires admin+relay+read in one process using the same
// hard-coded scenario constants (admin doubles as the gas sponsor).
func newLPTestClients(t *testing.T, ctx context.Context) *business.Clients {
	t.Helper()
	adminKey := mustECDSA(t, adminKeyHex)

	// User A signs relay (sponsored) writes through the in-process Magic signer
	// stand-in; admin still signs direct admin writes + sponsors gas.
	fakeMagic := newFakeMagicSigner(map[string]*ecdsa.PrivateKey{
		lpUserID: mustECDSA(t, bettorKeyHex),
	})

	db, err := gorm.Open(mysql.Open(scenarioMySQLDSN), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	multicallAddr := common.Address{}
	if addrMulticall3 != "" {
		multicallAddr = common.HexToAddress(addrMulticall3)
	}

	clients, err := business.NewClients(ctx, business.Config{
		RPCURL:            scenarioRPCURL,
		ChainID:           big.NewInt(scenarioChainID),
		AdminPrivateKey:   adminKey,
		SponsorPrivateKey: adminKey, // admin doubles as sponsor in this test
		UserSigner:        fakeMagic,
		ODDToken:          common.HexToAddress(addrODDToken),
		BettingPool:       common.HexToAddress(addrBettingPool),
		StakingPool:       common.HexToAddress(addrStakingPool),
		LiquidityPool:     common.HexToAddress(addrLiquidityPool),
		SponsorImpl:       common.HexToAddress(addrSponsorImpl),
		MulticallAddress:  multicallAddr,
		DB:                db,
		Cache:             cache.NewInProcess(),
		Confirmations:     2,
		SignatureDeadline: 15 * time.Minute,
	})
	if err != nil {
		t.Fatalf("business.NewClients: %v", err)
	}
	t.Cleanup(func() { _ = clients.Close(ctx) })
	return clients
}

// ensureRole grants `roleName` to `account` via admin if not already held.
func ensureRole(t *testing.T, ctx context.Context, adminCli *admin.Client, readCli *read.Client, roleName string, account common.Address, runTag string) {
	t.Helper()
	role := crypto.Keccak256Hash([]byte(roleName))
	if has, _ := readCli.HasRole(ctx, role, account); has {
		return
	}
	if _, err := adminCli.GrantRoleWithReceipt(ctx, admin.GrantRoleRequest{
		Role:           role,
		Account:        account,
		IdempotencyKey: "lp-grant-" + roleName + "-" + runTag,
	}); err != nil {
		t.Fatalf("GrantRole %s: %v", roleName, err)
	}
}

// requireMinODD skips the test (with a clear funding message) if `addr` does
// not currently hold at least `want` ODD wei. Returns no value — fail-fast on
// missing balance is a Skip, not a Fatal, because the contract is correctly
// configured; the wallet just needs more ODD.
func requireMinODD(t *testing.T, ctx context.Context, readCli *read.Client, addr common.Address, want *big.Int, testName string) {
	t.Helper()
	bal, err := readCli.BalanceOf(ctx, addr)
	if err != nil {
		t.Fatalf("%s: BalanceOf(%s): %v", testName, addr.Hex(), err)
	}
	// decimal → *big.Int via BigInt (truncates fractional, fine for wei-precision values).
	balWei := bal.BigInt()
	if balWei.Cmp(want) < 0 {
		t.Skipf("%s: A (%s) ODD balance %s < required %s — please fund A with at least %s ODD wei before re-running",
			testName, addr.Hex(), balWei, want, want)
	}
}

// readLpPositionFile loads the positionId persisted by
// TestLiquidityMatchAddSettleUnbond.
func readLpPositionFile() (coretypes.LpPositionID, error) {
	data, err := os.ReadFile(lpPositionFile)
	if err != nil {
		return nil, err
	}
	s := strings.TrimSpace(string(data))
	if s == "" {
		return nil, fmt.Errorf("file is empty")
	}
	id, ok := new(big.Int).SetString(s, 10)
	if !ok {
		return nil, fmt.Errorf("not a decimal integer: %q", s)
	}
	return coretypes.LpPositionID(id), nil
}
