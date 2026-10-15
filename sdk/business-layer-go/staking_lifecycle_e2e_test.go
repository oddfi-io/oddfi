//go:build e2e

// staking_lifecycle_e2e_test.go — three independent end-to-end tests that
// together cover the StakingPool "stake → (earlyUnstake | unstake-after-lock)"
// lifecycle, using ONLY the admin / relay / read clients this project exposes.
//
// All connection params / keys / addresses are reused from
// scenario_e2e_test.go (same package + build tag) — see the constants there.
// A == bettorKeyHex is the staker; admin doubles as the gas sponsor. Stake/
// unstake/earlyUnstake require NO role grants (the SDK & contract gate purely
// on position ownership), so unlike the LP flow there is no OPERATOR/SETTLER
// hand-shaking here. Pre-fund A with >= MinStakeAmount (= 100 ODD on testnet)
// PER TEST before running.
//
// ──────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────
//
//   TestStakeEarlyUnstake
//       Single-run smoke for the early-unstake (pre-maturity) path:
//         predict posID → Approve(StakingPool, 100 ODD) → Stake(plan 0)
//         → assert activeStake increased by amount and posID advanced →
//         EarlyUnstake(posID) → assert activeStake back to baseline and
//         balance returned ≈ baseline (principal-only; no reward).
//       Plan 0 lock period is 8 hours on testnet — earlyUnstake must be
//       called WELL inside that window, which a single run trivially is.
//
//   TestStakeForLaterUnstake
//       Stakes 100 ODD into plan 0 and persists the assigned positionId to
//       ./.last_stake_position (gitignored). Logs how many seconds remain
//       until unlockAt so the operator knows when TestUnstake becomes
//       callable. The actual unstake is INTENTIONALLY deferred — plan 0's
//       8 hour lock cannot be waited out inside a single test invocation.
//
//       IMPORTANT: TestUnstake MUST be run ≥ 8 hours after this test
//       finishes; running it sooner will fail-fast with PositionNotMatured.
//
//   TestUnstake
//       Reads ./.last_stake_position written by the previous test, calls
//       Unstake. Fail-fast: if the lock period hasn't elapsed the contract
//       reverts with PositionNotMatured and this test fails — that's
//       expected behavior, just re-run it later. No polling, no sleeping.
//
// ──────────────────────────────────────────────────────────────────────────
// Build / run
// ──────────────────────────────────────────────────────────────────────────
//
//	go test -tags e2e -run TestStakeEarlyUnstake      -v -timeout 5m ./...
//	go test -tags e2e -run TestStakeForLaterUnstake   -v -timeout 5m ./...
//	# ~8 hours later (plan 0 lockDays × SECONDS_PER_DAY = 8 × 3600s):
//	go test -tags e2e -run TestUnstake                -v -timeout 5m ./...

package business_test

import (
	"context"
	"fmt"
	"math/big"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
	"github.com/Crypto-Barrett/contracts-business-layer/relay"
)

// stakePositionFile is the on-disk hand-off between TestStakeForLaterUnstake
// (writer) and TestUnstake (reader). Lives at the project root; gitignored.
const stakePositionFile = ".last_stake_position"

// stakeAmountODD is the per-test stake size. Must be >= MinStakeAmount (100
// ODD on testnet). Kept at exactly the minimum so a small wallet can run
// both A and B1.1 back-to-back.
const stakeAmountODD = 100

// stakePlan0LockSeconds is the plan-0 lock duration on this contract config
// (8 days × PrecisionConstants.SECONDS_PER_DAY = 8 × 3600 = 28800 seconds
// under accelerated testnet time). Used purely for log messaging.
const stakePlan0LockSeconds = 8 * 3600

// ════════════════════════════════════════════════════════════════════════
// TestStakeEarlyUnstake — single-run stake + immediate early-unstake.
// ════════════════════════════════════════════════════════════════════════
//
// Flow:
//
//  1. Wire up relay+read clients (newLPTestClients — generic).
//  2. Sanity-check A's ODD balance is >= stakeAmount; t.Skip otherwise
//     with a clear "please fund A" message so the test can't be silently
//     green on an empty wallet.
//  3. Snapshot activeStake_before, balance_before.
//  4. Pre-read NextStakePositionID — StakeResult.PositionID is not
//     populated by the relay wrapper, so we predict the id this way
//     (same trick as the LP tests).
//  5. relay.Approve(StakingPool, 100 ODD)  — sponsored by admin.
//  6. relay.Stake(planID=0, amount=100 ODD) — sponsored by admin.
//  7. Assert activeStake_after_stake == before + amount and that
//     NextStakePositionID has advanced past posID.
//  8. relay.EarlyUnstake(posID) — must succeed because we're well inside
//     the 8h lock window. Returns principal only (no reward).
//  9. Assert activeStake is back to baseline and ODD balance is ≈
//     baseline (allow tiny dust delta due to reward redistribution
//     semantics — see the contract).
//  10. Log all tx hashes, blocks, gas.
/*
=== RUN   TestStakeEarlyUnstake
    staking_lifecycle_e2e_test.go:119: staker(A) = 0x46F00168097De28a2c436540C93db16914601d6d  run_tag = 1780038149517851800
    staking_lifecycle_e2e_test.go:130:   StakingPool.minStakeAmount = 100000000000000000000 ODD
    staking_lifecycle_e2e_test.go:142:   activeStake_before = 100000000000000000000   balance_before = 6410000000000000000000
    staking_lifecycle_e2e_test.go:151: === Step 5: A approve StakingPool ===
    staking_lifecycle_e2e_test.go:162: === Step 6: relay.Stake ===
    staking_lifecycle_e2e_test.go:172:   stake_position_id=21 tx_hash=0x497ff7c9c401c725e403a0e4ae69791b164bfd999b7cd4a77ffbbae581d8a332 block=110211326 gas=276846
    staking_lifecycle_e2e_test.go:190: === Step 8: relay.EarlyUnstake ===
    staking_lifecycle_e2e_test.go:199:   early_unstake tx_hash=0x5679446d978676bcae2265ceb1c95bbfdfafef4ce0c7757f9bb82d798fcbe429 block=110211337 gas=146880
    staking_lifecycle_e2e_test.go:216:   activeStake_after_early = 100000000000000000000
    staking_lifecycle_e2e_test.go:217:   balance_after_early     = 6410000000000000000000   (delta vs before = 0; expect ≈ 0, early-unstake returns principal only)
    staking_lifecycle_e2e_test.go:228: === Stake → EarlyUnstake complete (single-run smoke). ===
--- PASS: TestStakeEarlyUnstake (17.74s)
PASS
*/
func TestStakeEarlyUnstake(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	t.Cleanup(cancel)

	clients := newLPTestClients(t, ctx)
	relayCli, readCli := clients.Relay, clients.Read

	stakerKey := mustECDSA(t, bettorKeyHex) // A
	stakerAddr := crypto.PubkeyToAddress(stakerKey.PublicKey)
	runTag := fmt.Sprintf("%d", time.Now().UnixNano())
	t.Logf("staker(A) = %s  run_tag = %s", stakerAddr.Hex(), runTag)

	one18 := new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)
	stakeAmount := new(big.Int).Mul(big.NewInt(stakeAmountODD), one18) // 100 ODD
	const planID = uint16(0)

	// Step 2 — balance sanity check
	requireMinODD(t, ctx, readCli, stakerAddr, stakeAmount, "TestStakeEarlyUnstake")

	// Informational pre-state.
	if msa, err := readCli.MinStakeAmount(ctx); err == nil {
		t.Logf("  StakingPool.minStakeAmount = %s ODD", msa)
	}

	// Step 3 — snapshot balances
	activeBefore, err := readCli.GetActiveStakeAmount(ctx, stakerAddr)
	if err != nil {
		t.Fatalf("GetActiveStakeAmount(before): %v", err)
	}
	balBefore, err := readCli.BalanceOf(ctx, stakerAddr)
	if err != nil {
		t.Fatalf("BalanceOf(before): %v", err)
	}
	t.Logf("  activeStake_before = %s   balance_before = %s", activeBefore, balBefore)

	// Step 4 — predict positionId
	posID, err := readCli.NextStakePositionID(ctx)
	if err != nil {
		t.Fatalf("NextStakePositionID: %v", err)
	}

	// Step 5 — A approves StakingPool
	t.Log("=== Step 5: A approve StakingPool ===")
	if _, err := relayCli.ApproveWithReceipt(ctx, relay.ApproveRequest{
		UserID:         lpUserID,
		Spender:        common.HexToAddress(addrStakingPool),
		Value:          stakeAmount,
		IdempotencyKey: "stake-early-approve-" + runTag,
	}); err != nil {
		t.Fatalf("approve StakingPool: %v", err)
	}

	// Step 6 — Stake
	t.Log("=== Step 6: relay.Stake ===")
	stakeRes, err := relayCli.StakeWithReceipt(ctx, relay.StakeRequest{
		UserID:         lpUserID,
		Amount:         stakeAmount,
		PlanID:         planID,
		IdempotencyKey: "stake-early-stake-" + runTag,
	})
	if err != nil {
		t.Fatalf("Stake: %v", err)
	}
	t.Logf("  stake_position_id=%s tx_hash=%s block=%d gas=%d",
		posID, stakeRes.TxHash, stakeRes.BlockNumber, stakeRes.GasUsed)

	// Step 7 — assert active stake increased by amount and posID advanced.
	activeAfterStake, err := readCli.GetActiveStakeAmount(ctx, stakerAddr)
	if err != nil {
		t.Fatalf("GetActiveStakeAmount(after stake): %v", err)
	}
	wantActive := new(big.Int).Add(activeBefore.BigInt(), stakeAmount)
	if activeAfterStake.BigInt().Cmp(wantActive) != 0 {
		t.Fatalf("activeStake_after_stake = %s, want %s (= before %s + amount %s)",
			activeAfterStake, wantActive, activeBefore, stakeAmount)
	}
	if next, _ := readCli.NextStakePositionID(ctx); next.Cmp(posID) <= 0 {
		t.Fatalf("NextStakePositionID did not advance past %s (got %s)", posID, next)
	}

	// Step 8 — EarlyUnstake (well inside the 8h lock window).
	t.Log("=== Step 8: relay.EarlyUnstake ===")
	earlyRes, err := relayCli.EarlyUnstakeWithReceipt(ctx, relay.EarlyUnstakeRequest{
		UserID:         lpUserID,
		PositionID:     posID,
		IdempotencyKey: "stake-early-unstake-" + runTag,
	})
	if err != nil {
		t.Fatalf("EarlyUnstake: %v", err)
	}
	t.Logf("  early_unstake tx_hash=%s block=%d gas=%d",
		earlyRes.TxHash, earlyRes.BlockNumber, earlyRes.GasUsed)

	// Step 9 — assert activeStake back to baseline; balance ≈ baseline.
	activeAfterEarly, err := readCli.GetActiveStakeAmount(ctx, stakerAddr)
	if err != nil {
		t.Fatalf("GetActiveStakeAmount(after early-unstake): %v", err)
	}
	if activeAfterEarly.BigInt().Cmp(activeBefore.BigInt()) != 0 {
		t.Fatalf("activeStake_after_early = %s, want back to baseline %s",
			activeAfterEarly, activeBefore)
	}
	balAfter, err := readCli.BalanceOf(ctx, stakerAddr)
	if err != nil {
		t.Fatalf("BalanceOf(after early-unstake): %v", err)
	}
	balDelta := new(big.Int).Sub(balAfter.BigInt(), balBefore.BigInt())
	t.Logf("  activeStake_after_early = %s", activeAfterEarly)
	t.Logf("  balance_after_early     = %s   (delta vs before = %s; expect ≈ 0, early-unstake returns principal only)",
		balAfter, balDelta)

	// Reward redirection semantics: principal is returned, accrued reward
	// goes to remaining stakers (or platform treasury). Net balance delta
	// should be ≤ 0 (gas is sponsored, so no negative from us). Allow
	// equality or slight loss; flag a positive delta as unexpected.
	if balDelta.Sign() > 0 {
		t.Fatalf("balance INCREASED after early-unstake (%s) — early-unstake must return principal only", balDelta)
	}

	t.Log("=== Stake → EarlyUnstake complete (single-run smoke). ===")
}

// ════════════════════════════════════════════════════════════════════════
// TestStakeForLaterUnstake — stake, persist posID, defer unstake.
// ════════════════════════════════════════════════════════════════════════
//
// IMPORTANT: TestUnstake (the matching reader) MUST be run ≥ 8 HOURS after
// this test finishes — plan 0's lock period is 8 × SECONDS_PER_DAY (= 8 ×
// 3600 = 28800 seconds on this accelerated testnet config). Calling Unstake
// inside that window reverts with PositionNotMatured.
//
// Flow:
//
//  1. Wire up relay+read clients.
//  2. Sanity-check A has >= stakeAmount; t.Skip otherwise.
//  3. Predict posID via NextStakePositionID.
//  4. relay.Approve(StakingPool, 100 ODD).
//  5. relay.Stake(planID=0, amount=100 ODD).
//  6. Write posID (decimal) to ./.last_stake_position (overwrite).
//  7. Log tx hash / block / gas + posID + a reminder of when Unstake
//     becomes callable (= roughly now + stakePlan0LockSeconds).
func TestStakeForLaterUnstake(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	t.Cleanup(cancel)

	clients := newLPTestClients(t, ctx)
	relayCli, readCli := clients.Relay, clients.Read

	stakerKey := mustECDSA(t, bettorKeyHex) // A
	stakerAddr := crypto.PubkeyToAddress(stakerKey.PublicKey)
	runTag := fmt.Sprintf("%d", time.Now().UnixNano())
	t.Logf("staker(A) = %s  run_tag = %s", stakerAddr.Hex(), runTag)

	one18 := new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)
	stakeAmount := new(big.Int).Mul(big.NewInt(stakeAmountODD), one18) // 100 ODD
	const planID = uint16(0)

	// Step 2 — balance sanity check
	requireMinODD(t, ctx, readCli, stakerAddr, stakeAmount, "TestStakeForLaterUnstake")

	// Step 3 — predict positionId
	posID, err := readCli.NextStakePositionID(ctx)
	if err != nil {
		t.Fatalf("NextStakePositionID: %v", err)
	}

	// Step 4 — A approves StakingPool
	t.Log("=== Step 4: A approve StakingPool ===")
	if _, err := relayCli.ApproveWithReceipt(ctx, relay.ApproveRequest{
		UserID:         lpUserID,
		Spender:        common.HexToAddress(addrStakingPool),
		Value:          stakeAmount,
		IdempotencyKey: "stake-later-approve-" + runTag,
	}); err != nil {
		t.Fatalf("approve StakingPool: %v", err)
	}

	// Step 5 — Stake
	t.Log("=== Step 5: relay.Stake ===")
	stakeRes, err := relayCli.StakeWithReceipt(ctx, relay.StakeRequest{
		UserID:         lpUserID,
		Amount:         stakeAmount,
		PlanID:         planID,
		IdempotencyKey: "stake-later-stake-" + runTag,
	})
	if err != nil {
		t.Fatalf("Stake: %v", err)
	}
	t.Logf("  stake_position_id=%s tx_hash=%s block=%d gas=%d",
		posID, stakeRes.TxHash, stakeRes.BlockNumber, stakeRes.GasUsed)

	// Step 6 — persist posID for TestUnstake
	if err := os.WriteFile(stakePositionFile, []byte(posID.String()+"\n"), 0o644); err != nil {
		t.Fatalf("write %s: %v", stakePositionFile, err)
	}
	t.Logf("  wrote stake_position_id=%s to ./%s", posID, stakePositionFile)

	// Step 7 — operator reminder
	unlockAt := time.Now().Add(stakePlan0LockSeconds * time.Second)
	t.Logf("  plan 0 lockDays × SECONDS_PER_DAY = %d seconds → Unstake callable after ~%s (local)",
		stakePlan0LockSeconds, unlockAt.Format(time.RFC3339))
	t.Log("=== Stake complete. Now wait ~8 hours and run TestUnstake. ===")
}

// ════════════════════════════════════════════════════════════════════════
// TestUnstake — manually triggered after ~8h
// ════════════════════════════════════════════════════════════════════════
//
// Flow:
//
//  1. Wire up relay+read clients.
//  2. Read ./.last_stake_position; t.Fatal if missing/unparsable with a
//     clear "run TestStakeForLaterUnstake first" message.
//  3. Snapshot activeStake_before, balance_before.
//  4. relay.Unstake(posID). Fail-fast: if the contract reverts (e.g.
//     PositionNotMatured because the 8h lock hasn't elapsed yet) the
//     error propagates to t.Fatal. Re-run later — no polling, no sleeping.
//  5. Snapshot activeStake_after, balance_after; log deltas.
//  6. Assert activeStake decreased by exactly the staked amount and that
//     balance increased by at least the staked amount (reward may be 0 if
//     there was no other staking activity / no notifyReward in between).
//
// go test -tags e2e -run TestUnstake -v -timeout 5m
func TestUnstake(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	t.Cleanup(cancel)

	clients := newLPTestClients(t, ctx)
	relayCli, readCli := clients.Relay, clients.Read

	stakerKey := mustECDSA(t, bettorKeyHex) // A — must own the position
	stakerAddr := crypto.PubkeyToAddress(stakerKey.PublicKey)
	runTag := fmt.Sprintf("%d", time.Now().UnixNano())

	// Step 2 — read posID from file
	posID, err := readStakePositionFile()
	if err != nil {
		t.Fatalf("read %s: %v — run TestStakeForLaterUnstake first to produce it", stakePositionFile, err)
	}
	t.Logf("staker(A)=%s stake_position_id=%s run_tag=%s", stakerAddr.Hex(), posID, runTag)

	// Step 3 — snapshot pre-state
	activeBefore, err := readCli.GetActiveStakeAmount(ctx, stakerAddr)
	if err != nil {
		t.Fatalf("GetActiveStakeAmount(before): %v", err)
	}
	balBefore, err := readCli.BalanceOf(ctx, stakerAddr)
	if err != nil {
		t.Fatalf("BalanceOf(before): %v", err)
	}
	t.Logf("  activeStake_before = %s   balance_before = %s", activeBefore, balBefore)

	one18 := new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)
	stakeAmount := new(big.Int).Mul(big.NewInt(stakeAmountODD), one18) // 100 ODD

	// Step 4 — Unstake; fail-fast on chain revert
	t.Log("=== relay.Unstake ===")
	res, err := relayCli.UnstakeWithReceipt(ctx, relay.UnstakeRequest{
		UserID:         lpUserID,
		PositionID:     posID,
		IdempotencyKey: "stake-unstake-" + posID.String() + "-" + runTag,
	})
	if err != nil {
		t.Fatalf("Unstake reverted (likely PositionNotMatured — 8h lock not yet elapsed; re-run later): %v", err)
	}
	t.Logf("  unstake tx=%s block=%d gas=%d", res.TxHash, res.BlockNumber, res.GasUsed)

	// Step 5 — snapshot post-state
	activeAfter, err := readCli.GetActiveStakeAmount(ctx, stakerAddr)
	if err != nil {
		t.Fatalf("GetActiveStakeAmount(after): %v", err)
	}
	balAfter, err := readCli.BalanceOf(ctx, stakerAddr)
	if err != nil {
		t.Fatalf("BalanceOf(after): %v", err)
	}
	activeDelta := new(big.Int).Sub(activeBefore.BigInt(), activeAfter.BigInt()) // before - after = removed
	balDelta := new(big.Int).Sub(balAfter.BigInt(), balBefore.BigInt())          // after - before = gained
	t.Logf("  activeStake_after = %s   (removed = %s)", activeAfter, activeDelta)
	t.Logf("  balance_after     = %s   (gained = %s, expect >= principal %s; reward may be 0)",
		balAfter, balDelta, stakeAmount)

	// Step 6 — assertions.
	if activeDelta.Cmp(stakeAmount) != 0 {
		t.Fatalf("activeStake delta = %s, want exactly %s (= staked amount)", activeDelta, stakeAmount)
	}
	if balDelta.Cmp(stakeAmount) < 0 {
		t.Fatalf("balance gain = %s, want >= principal %s", balDelta, stakeAmount)
	}
	t.Logf("=== Unstake complete. principal+reward returned = %s ===", balDelta)
}

// ─── shared helpers ────────────────────────────────────────────────────────

// readStakePositionFile loads the positionId persisted by
// TestStakeForLaterUnstake.
func readStakePositionFile() (coretypes.StakePositionID, error) {
	data, err := os.ReadFile(stakePositionFile)
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
	return coretypes.StakePositionID(id), nil
}
