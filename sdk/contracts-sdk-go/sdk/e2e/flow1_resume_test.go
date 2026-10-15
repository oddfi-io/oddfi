//go:build e2e

package e2e

// TestFlow1Resume finishes a Flow 1 run that was interrupted mid-way. It
// takes a matchID + betID from env, runs CloseMarket → Settle → Withdraw,
// and brings user back to a clean state (zero locked, zero userBalances,
// USDT in wallet).
//
// Use it when TestFlow1 panics/fails after step 3 (LockBet has already gone
// to chain) so the next TestFlow1 run starts from a clean slate.
//
// Env required:
//
//	E2E_RPC, E2E_ADMIN_PK, E2E_USER_PK   — same as TestFlow1
//	E2E_RESUME_MATCH_ID                  — 0x-prefixed 32-byte hex
//	E2E_RESUME_BET_ID                    — 0x-prefixed 32-byte hex
//
// Run:
//
//	go test -tags=e2e -count=1 -v -run TestFlow1Resume ./sdk/e2e/...

import (
	"context"
	"math/big"
	"testing"
	"time"

	sdkadmin "github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/admin"
	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/bindings/bettingpool"
	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/bindings/erc20"
)

func TestFlow1Resume(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	conn := connectE2E(t)
	admS := loadSigner(t, "E2E_ADMIN_PK")
	usrS := loadSigner(t, "E2E_USER_PK")

	matchID := parseHex32(t, "E2E_RESUME_MATCH_ID")
	betID := parseHex32(t, "E2E_RESUME_BET_ID")
	t.Logf("matchID = 0x%x", matchID)
	t.Logf("betID   = 0x%x", betID)

	user := usrS.Address()
	bpAddr := conn.BettingPoolAddr()

	adminCli, err := sdkadmin.New(conn, sdkadmin.WithSigner(admS), sdkadmin.WithTxTimeout(60*time.Second))
	if err != nil {
		t.Fatalf("admin.New: %v", err)
	}
	bp, _ := bettingpool.NewBettingPool(bpAddr, conn.EthClient())
	usdt, _ := erc20.NewERC20(conn.USDTAddr(), conn.EthClient())
	bpCaller := &bp.BettingPoolCaller

	startUser, _ := usdt.BalanceOf(nil, user)
	preLocked, _ := bpCaller.LockedBalances(nil, user)
	preBal, _ := bpCaller.UserBalances(nil, user)
	t.Logf("Pre  user.USDT=%s  locked=%s  userBalances=%s",
		usdt6(startUser), usdt6(preLocked), usdt6(preBal))

	bet, err := bpCaller.Bets(nil, betID)
	if err != nil {
		t.Fatalf("Bets(betID): %v", err)
	}
	t.Logf("Pre  bet.user=%s amount=%s status=%d outcome=%d",
		bet.User.Hex(), usdt6(bet.Amount), bet.Status, bet.Outcome)

	// ── A. CloseMarket (skip if already closed) ──────────────────────────────
	args := sdkadmin.CloseMarketArgs{MatchID: matchID, Market: sdkadmin.MarketX12, Line: f1Line}
	if simErr := adminCli.SimulateCloseMarket(ctx, args); simErr != nil {
		t.Logf("STEP A  CloseMarket simulate reverts (%v); assuming already closed, skip", simErr)
	} else {
		t.Log("STEP A  admin.CloseMarket")
		tx, err := adminCli.CloseMarket(ctx, args)
		if err != nil {
			t.Fatalf("CloseMarket: %v", err)
		}
		waitMined(t, ctx, conn, tx, "CloseMarket")
	}

	// ── B. Settle (multisig EOA == admin EOA) ────────────────────────────────
	t.Log("STEP B  multisig.Settle (direct binding)")
	mOpts, err := txOpts(ctx, conn, admS)
	if err != nil {
		t.Fatalf("opts: %v", err)
	}
	tx, err := bp.Settle(mOpts, matchID, f1Market, f1Line, f1Winning, [][32]byte{betID})
	if err != nil {
		t.Fatalf("Settle: %v", err)
	}
	waitMined(t, ctx, conn, tx, "Settle")

	postLocked, _ := bpCaller.LockedBalances(nil, user)
	postBal, _ := bpCaller.UserBalances(nil, user)
	if postLocked.Sign() != 0 {
		t.Fatalf("after Settle locked = %s, want 0", usdt6(postLocked))
	}
	t.Logf("Post-settle  locked=%s  userBalances=%s", usdt6(postLocked), usdt6(postBal))

	// ── C. Withdraw whatever is now spendable ────────────────────────────────
	if postBal.Sign() == 0 {
		t.Log("STEP C  userBalances=0, nothing to withdraw")
	} else {
		t.Log("STEP C  user.Withdraw")
		uOpts, err := txOpts(ctx, conn, usrS)
		if err != nil {
			t.Fatalf("opts: %v", err)
		}
		tx, err = bp.Withdraw(uOpts, postBal)
		if err != nil {
			t.Fatalf("Withdraw: %v", err)
		}
		waitMined(t, ctx, conn, tx, "Withdraw")
	}

	endUser, _ := usdt.BalanceOf(nil, user)
	endBal, _ := bpCaller.UserBalances(nil, user)
	delta := new(big.Int).Sub(endUser, startUser)
	t.Logf("Post user.USDT=%s (delta %s)  userBalances=%s",
		usdt6(endUser), signed(delta), usdt6(endBal))
	t.Log("== resume done ==")
}
