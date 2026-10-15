//go:build e2e

package e2e

// TestFlow2 — 串关 (Parlay): 用户用 1 USDT 串 2 腿,两腿全部赢。
//
// Step list:
//
//	0a   Admin    : OpenMarket(matchID_A, X12, 0)
//	0b   Admin    : OpenMarket(matchID_B, X12, 0)
//	1    User     : USDT.Transfer(BettingPool, stake)
//	2    Admin    : CreditDeposit(user, stake, txHash=<step 1 hash>)
//	3    Admin    : LockParlay(parlayId, user, stake, [matchA,matchB],
//	                           [X12,X12], [outcome,outcome], [0,0],
//	                           [legOdds,legOdds], [legA_betId,legB_betId])
//	3.5a Admin    : CloseMarket(matchID_A)
//	3.5b Admin    : CloseMarket(matchID_B)
//	4a   Multisig : BettingPool.Settle(matchID_A, X12, 0, winning, [legA_betId])
//	                 → leg A 解算赢;parlay 仍 pending(还差 leg B)
//	4b   Multisig : BettingPool.Settle(matchID_B, X12, 0, winning, [legB_betId])
//	                 → leg B 解算赢;两腿全胜 → 合约 finalize parlay,
//	                 user.userBalances += stake × combinedOdds / 1000
//	5    User     : Withdraw(payout)
//
// Run:
//
//	E2E_RPC=... E2E_ADMIN_PK=... E2E_USER_PK=... \
//	  go test -tags=e2e -count=1 -v -timeout=15m -run TestFlow2 ./sdk/e2e/...

import (
	"context"
	"math/big"
	"testing"
	"time"

	sdkadmin "github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/admin"
	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/bindings/bettingpool"
	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/bindings/erc20"
)

// Flow 2 parameters. f2 prefix avoids clashing with f1*/f3*.
const (
	f2Stake     int64 = 1_000_000 // 1 USDT
	f2LegOdds   int64 = 1500      // 1.5x per leg → combined 2 legs = 1500*1500/1000 = 2250 (2.25x)
	f2Market    uint8 = 0         // X12
	f2Line      uint8 = 0
	f2Outcome   uint8 = 1 // user picks outcome=1 on every leg
	f2Winning   uint8 = 1 // ditto on settle
	f2NumLegs         = 2
)

func TestFlow2(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()

	conn := connectE2E(t)
	admS := loadSigner(t, "E2E_ADMIN_PK")
	usrS := loadSigner(t, "E2E_USER_PK")

	if admS.Address() != conn.EnvConfig().ExpectedAdmin() {
		t.Fatalf("admin signer mismatch")
	}

	bpAddr := conn.BettingPoolAddr()
	user := usrS.Address()
	t.Logf("Admin: %s   User: %s", admS.Address().Hex(), user.Hex())

	adminCli, err := sdkadmin.New(conn, sdkadmin.WithSigner(admS), sdkadmin.WithTxTimeout(60*time.Second))
	if err != nil {
		t.Fatalf("admin.New: %v", err)
	}
	bp, _ := bettingpool.NewBettingPool(bpAddr, conn.EthClient())
	usdt, _ := erc20.NewERC20(conn.USDTAddr(), conn.EthClient())
	bpCaller := &bp.BettingPoolCaller

	stakeWei := big.NewInt(f2Stake)

	startUserUSDT, _ := usdt.BalanceOf(nil, user)
	startBpUSDT, _ := usdt.BalanceOf(nil, bpAddr)
	t.Logf("== START ==  user.USDT=%s  bp.USDT=%s", usdt6(startUserUSDT), usdt6(startBpUSDT))
	if startUserUSDT.Cmp(stakeWei) < 0 {
		t.Fatalf("user wallet has %s USDT < required %s; please top up testnet USDT",
			usdt6(startUserUSDT), usdt6(stakeWei))
	}

	matchIDs := [f2NumLegs][32]byte{}
	legBetIDs := [f2NumLegs][32]byte{}
	for i := 0; i < f2NumLegs; i++ {
		matchIDs[i] = rand32(t)
		legBetIDs[i] = rand32(t)
	}
	parlayID := rand32(t)
	t.Logf("parlayID = 0x%x", parlayID)
	for i := 0; i < f2NumLegs; i++ {
		t.Logf("  leg %d: matchID=0x%x betID=0x%x", i, matchIDs[i], legBetIDs[i])
	}

	// ── 0. Admin: OpenMarket × 2 ─────────────────────────────────────────────
	for i := 0; i < f2NumLegs; i++ {
		t.Logf("STEP 0%c admin.OpenMarket leg=%d", 'a'+byte(i), i)
		args := sdkadmin.OpenMarketArgs{MatchID: matchIDs[i], Market: sdkadmin.MarketX12, Line: f2Line}
		if err := adminCli.SimulateOpenMarket(ctx, args); err != nil {
			t.Fatalf("simulate OpenMarket leg %d: %v", i, err)
		}
		tx, err := adminCli.OpenMarket(ctx, args)
		if err != nil {
			t.Fatalf("OpenMarket leg %d: %v", i, err)
		}
		waitMined(t, ctx, conn, tx, "OpenMarket")
	}

	// ── 1. User: USDT.Transfer ───────────────────────────────────────────────
	t.Log("STEP 1  user → BettingPool USDT.transfer")
	uOpts, err := txOpts(ctx, conn, usrS)
	if err != nil {
		t.Fatalf("user opts: %v", err)
	}
	transferTx, err := usdt.Transfer(uOpts, bpAddr, stakeWei)
	if err != nil {
		t.Fatalf("USDT.Transfer: %v", err)
	}
	waitMined(t, ctx, conn, transferTx, "USDT.Transfer")
	depositTxHash := transferTx.Hash()

	// ── 2. Admin: CreditDeposit ──────────────────────────────────────────────
	t.Log("STEP 2  admin.CreditDeposit")
	depArgs := sdkadmin.CreditDepositArgs{User: user, Amount: stakeWei, TxHash: depositTxHash}
	if err := adminCli.SimulateCreditDeposit(ctx, depArgs); err != nil {
		t.Fatalf("simulate CreditDeposit: %v", err)
	}
	tx, err := adminCli.CreditDeposit(ctx, depArgs)
	if err != nil {
		t.Fatalf("CreditDeposit: %v", err)
	}
	waitMined(t, ctx, conn, tx, "CreditDeposit")

	// ── 3. Admin: LockParlay ─────────────────────────────────────────────────
	t.Log("STEP 3  admin.LockParlay (2 legs, 1.5x each)")
	legOdds := make([]*big.Int, f2NumLegs)
	markets := make([]sdkadmin.MarketType, f2NumLegs)
	outcomes := make([]uint8, f2NumLegs)
	lines := make([]uint8, f2NumLegs)
	for i := 0; i < f2NumLegs; i++ {
		legOdds[i] = big.NewInt(f2LegOdds)
		markets[i] = sdkadmin.MarketX12
		outcomes[i] = f2Outcome
		lines[i] = f2Line
	}
	parlayArgs := sdkadmin.LockParlayArgs{
		ParlayID:  parlayID,
		User:      user,
		Stake:     stakeWei,
		MatchIDs:  matchIDs[:],
		Markets:   markets,
		Outcomes:  outcomes,
		Lines:     lines,
		LegOdds:   legOdds,
		LegBetIDs: legBetIDs[:],
	}
	if err := adminCli.SimulateLockParlay(ctx, parlayArgs); err != nil {
		t.Fatalf("simulate LockParlay: %v", err)
	}
	tx, err = adminCli.LockParlay(ctx, parlayArgs)
	if err != nil {
		t.Fatalf("LockParlay: %v", err)
	}
	waitMined(t, ctx, conn, tx, "LockParlay")

	// Verify state.
	parlay, err := bpCaller.Parlays(nil, parlayID)
	if err != nil {
		t.Fatalf("Parlays: %v", err)
	}
	t.Logf("    parlay.user=%s stake=%s combinedOdds=%s maxPayout=%s status=%d settled=%d won=%d",
		parlay.User.Hex(), usdt6(parlay.Stake), parlay.CombinedOdds.String(),
		usdt6(parlay.MaxPayout), parlay.Status, parlay.SettledLegs, parlay.WonLegs)
	if parlay.User != user {
		t.Fatalf("parlay.user = %s, want %s", parlay.User.Hex(), user.Hex())
	}
	if parlay.Stake.Cmp(stakeWei) != 0 {
		t.Fatalf("parlay.stake = %s, want %s", usdt6(parlay.Stake), usdt6(stakeWei))
	}
	locked, _ := bpCaller.LockedBalances(nil, user)
	if locked.Cmp(stakeWei) != 0 {
		t.Fatalf("after LockParlay user.lockedBalances = %s, want %s", usdt6(locked), usdt6(stakeWei))
	}
	t.Logf("    user.lockedBalances = %s ✓", usdt6(locked))

	// ── 3.5 Admin: CloseMarket × 2 ───────────────────────────────────────────
	for i := 0; i < f2NumLegs; i++ {
		t.Logf("STEP 3.5%c admin.CloseMarket leg=%d", 'a'+byte(i), i)
		args := sdkadmin.CloseMarketArgs{MatchID: matchIDs[i], Market: sdkadmin.MarketX12, Line: f2Line}
		if err := adminCli.SimulateCloseMarket(ctx, args); err != nil {
			t.Fatalf("simulate CloseMarket leg %d: %v", i, err)
		}
		tx, err := adminCli.CloseMarket(ctx, args)
		if err != nil {
			t.Fatalf("CloseMarket leg %d: %v", i, err)
		}
		waitMined(t, ctx, conn, tx, "CloseMarket")
	}

	// ── 4. Multisig: Settle each leg ────────────────────────────────────────
	for i := 0; i < f2NumLegs; i++ {
		t.Logf("STEP 4%c multisig.Settle leg=%d (winningOutcome=%d)", 'a'+byte(i), i, f2Winning)
		mOpts, err := txOpts(ctx, conn, admS)
		if err != nil {
			t.Fatalf("multisig opts: %v", err)
		}
		tx, err := bp.Settle(mOpts, matchIDs[i], f2Market, f2Line, f2Winning, [][32]byte{legBetIDs[i]})
		if err != nil {
			t.Fatalf("Settle leg %d: %v", i, err)
		}
		waitMined(t, ctx, conn, tx, "Settle")

		parlay, _ := bpCaller.Parlays(nil, parlayID)
		t.Logf("    parlay.status=%d settled=%d won=%d", parlay.Status, parlay.SettledLegs, parlay.WonLegs)
	}

	// ── post-settle: parlay finalised, user.userBalances grows ───────────────
	finalLocked, _ := bpCaller.LockedBalances(nil, user)
	finalBal, _ := bpCaller.UserBalances(nil, user)
	if finalLocked.Sign() != 0 {
		t.Fatalf("after all legs settled user.lockedBalances = %s, want 0", usdt6(finalLocked))
	}
	if finalBal.Cmp(stakeWei) <= 0 {
		t.Fatalf("after all legs settled user.userBalances = %s, want > stake %s",
			usdt6(finalBal), usdt6(stakeWei))
	}
	// Expected payout = stake × combinedOdds / 1000.
	combined := parlay.CombinedOdds // re-read (last leg may have updated)
	parlay, _ = bpCaller.Parlays(nil, parlayID)
	combined = parlay.CombinedOdds
	wantPayout := new(big.Int).Mul(stakeWei, combined)
	wantPayout = wantPayout.Quo(wantPayout, big.NewInt(1000))
	t.Logf("    expected payout = %s × %s / 1000 = %s",
		usdt6(stakeWei), combined, usdt6(wantPayout))
	if finalBal.Cmp(wantPayout) != 0 {
		t.Errorf("user.userBalances = %s, want %s", usdt6(finalBal), usdt6(wantPayout))
	}
	t.Logf("    user.userBalances = %s (parlay won) ✓", usdt6(finalBal))

	// ── 5. User: Withdraw ────────────────────────────────────────────────────
	t.Log("STEP 5  user.Withdraw")
	payout := finalBal
	uOpts2, err := txOpts(ctx, conn, usrS)
	if err != nil {
		t.Fatalf("user opts (withdraw): %v", err)
	}
	tx, err = bp.Withdraw(uOpts2, payout)
	if err != nil {
		t.Fatalf("Withdraw: %v", err)
	}
	waitMined(t, ctx, conn, tx, "Withdraw")

	endUserUSDT, _ := usdt.BalanceOf(nil, user)
	endBal, _ := bpCaller.UserBalances(nil, user)
	if endBal.Sign() != 0 {
		t.Fatalf("after Withdraw user.userBalances = %s, want 0", usdt6(endBal))
	}
	walletDelta := new(big.Int).Sub(endUserUSDT, startUserUSDT)
	wantDelta := new(big.Int).Sub(payout, stakeWei)
	if walletDelta.Cmp(wantDelta) != 0 {
		t.Fatalf("wallet delta = %s, want %s", signed(walletDelta), signed(wantDelta))
	}

	t.Log("== DONE ==")
	t.Logf("stake placed         : -%s USDT", usdt6(stakeWei))
	t.Logf("parlay payout (gross): +%s USDT", usdt6(payout))
	t.Logf("net to user wallet   : %s USDT", signed(walletDelta))
}
