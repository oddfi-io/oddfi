//go:build e2e

package e2e

// TestFlow1 — 充值 → 下注 → 结算 → 提现 (deposit → bet → settle → withdraw)
//
// Step list:
//
//	0    Admin    : OpenMarket(matchID, X12, line=0)
//	1    User     : USDT.Transfer(BettingPool, stake)
//	2    Admin    : CreditDeposit(user, stake, txHash=<step 1 hash>)   ← dedup key
//	3    Admin    : LockBet(betID, user, stake, matchID, X12, outcome=1, line=0, odds=1818)
//	3.5  Admin    : CloseMarket(matchID, X12, line=0)                  ← required before Settle
//	4    Multisig : BettingPool.Settle(matchID, X12, 0, winning=1, [betID])
//	                multisig is the same EOA as admin in this testnet → call the
//	                binding directly (sdk/multisig is for real Gnosis Safe)
//	5    User     : Withdraw(payout)  — payout = userBalances after settle
//
// Run:
//
//	E2E_RPC=... E2E_ADMIN_PK=... E2E_USER_PK=... \
//	  go test -tags=e2e -count=1 -v -timeout=10m -run TestFlow1 ./sdk/e2e/...

import (
	"context"
	"math/big"
	"testing"
	"time"

	sdkadmin "github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/admin"
	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/bindings/bettingpool"
	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/bindings/erc20"
)

// Flow1 parameters. f1 prefix avoids collisions with future flow2/flow3.
const (
	f1Stake      int64 = 1_000_000 // 1 USDT (6 decimals raw)
	f1Odds       int64 = 1818      // 1.818x (×1000 encoded)
	f1Market     uint8 = 0         // X12
	f1Line       uint8 = 0
	f1BetOutcome uint8 = 1 // user bets on outcome=1 …
	f1Winning    uint8 = 1 // … and wins (admin EOA sets winningOutcome=1 at settle)
)

func TestFlow1(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	conn := connectE2E(t)
	admS := loadSigner(t, "E2E_ADMIN_PK")
	usrS := loadSigner(t, "E2E_USER_PK")

	if admS.Address() != conn.EnvConfig().ExpectedAdmin() {
		t.Fatalf("admin signer mismatch")
	}

	bpAddr := conn.BettingPoolAddr()
	usdtAddr := conn.USDTAddr()
	user := usrS.Address()
	t.Logf("Admin: %s   User: %s", admS.Address().Hex(), user.Hex())

	adminCli, err := sdkadmin.New(conn, sdkadmin.WithSigner(admS), sdkadmin.WithTxTimeout(60*time.Second))
	if err != nil {
		t.Fatalf("admin.New: %v", err)
	}
	bp, err := bettingpool.NewBettingPool(bpAddr, conn.EthClient())
	if err != nil {
		t.Fatalf("NewBettingPool: %v", err)
	}
	usdt, err := erc20.NewERC20(usdtAddr, conn.EthClient())
	if err != nil {
		t.Fatalf("NewERC20: %v", err)
	}
	bpCaller := &bp.BettingPoolCaller

	stakeWei := big.NewInt(f1Stake)

	startUserUSDT, err := usdt.BalanceOf(nil, user)
	if err != nil {
		t.Fatalf("startUserUSDT: %v", err)
	}
	startBpUSDT, err := usdt.BalanceOf(nil, bpAddr)
	if err != nil {
		t.Fatalf("startBpUSDT: %v", err)
	}
	t.Logf("== START ==  user.USDT=%s  bp.USDT=%s", usdt6(startUserUSDT), usdt6(startBpUSDT))

	if startUserUSDT.Cmp(stakeWei) < 0 {
		t.Fatalf("user wallet has %s USDT < required %s; please top up testnet USDT",
			usdt6(startUserUSDT), usdt6(stakeWei))
	}

	matchID := rand32(t)
	betID := rand32(t)
	t.Logf("matchID = 0x%x", matchID)
	t.Logf("betID   = 0x%x", betID)

	// ── 0. Admin: OpenMarket ─────────────────────────────────────────────────
	t.Log("STEP 0  admin.OpenMarket")
	if err := adminCli.SimulateOpenMarket(ctx, sdkadmin.OpenMarketArgs{
		MatchID: matchID, Market: sdkadmin.MarketX12, Line: f1Line,
	}); err != nil {
		t.Fatalf("simulate OpenMarket: %v", err)
	}
	tx, err := adminCli.OpenMarket(ctx, sdkadmin.OpenMarketArgs{
		MatchID: matchID, Market: sdkadmin.MarketX12, Line: f1Line,
	})
	if err != nil {
		t.Fatalf("OpenMarket: %v", err)
	}
	waitMined(t, ctx, conn, tx, "OpenMarket")

	accepting, err := bpCaller.IsAccepting(nil, matchID, f1Market, f1Line, f1BetOutcome)
	if err != nil {
		t.Fatalf("IsAccepting: %v", err)
	}
	if !accepting {
		t.Fatal("market not accepting after OpenMarket")
	}
	t.Log("    market accepting ✓")

	// ── 1. User: USDT.Transfer(BettingPool, stake) ───────────────────────────
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

	bpAfterTransfer, _ := usdt.BalanceOf(nil, bpAddr)
	delta := new(big.Int).Sub(bpAfterTransfer, startBpUSDT)
	if delta.Cmp(stakeWei) != 0 {
		t.Fatalf("BettingPool USDT delta = %s, want %s", usdt6(delta), usdt6(stakeWei))
	}
	t.Logf("    BettingPool +%s USDT ✓", usdt6(delta))

	// ── 2. Admin: CreditDeposit ──────────────────────────────────────────────
	t.Log("STEP 2  admin.CreditDeposit (record off-chain ref)")
	depArgs := sdkadmin.CreditDepositArgs{
		User:   user,
		Amount: stakeWei,
		TxHash: depositTxHash,
	}
	if err := adminCli.SimulateCreditDeposit(ctx, depArgs); err != nil {
		t.Fatalf("simulate CreditDeposit: %v", err)
	}
	tx, err = adminCli.CreditDeposit(ctx, depArgs)
	if err != nil {
		t.Fatalf("CreditDeposit: %v", err)
	}
	waitMined(t, ctx, conn, tx, "CreditDeposit")

	userSpend, _ := bpCaller.UserBalances(nil, user)
	if userSpend.Cmp(stakeWei) != 0 {
		t.Fatalf("after CreditDeposit user.userBalances = %s, want %s", usdt6(userSpend), usdt6(stakeWei))
	}
	t.Logf("    user.userBalances = %s ✓", usdt6(userSpend))

	// ── 3. Admin: LockBet ────────────────────────────────────────────────────
	t.Log("STEP 3  admin.LockBet")
	betArgs := sdkadmin.LockBetArgs{
		BetID:      betID,
		User:       user,
		Amount:     stakeWei,
		MatchID:    matchID,
		Market:     sdkadmin.MarketX12,
		Outcome:    f1BetOutcome,
		Line:       f1Line,
		LockedOdds: big.NewInt(f1Odds),
	}
	if err := adminCli.SimulateLockBet(ctx, betArgs); err != nil {
		t.Fatalf("simulate LockBet: %v", err)
	}
	tx, err = adminCli.LockBet(ctx, betArgs)
	if err != nil {
		t.Fatalf("LockBet: %v", err)
	}
	waitMined(t, ctx, conn, tx, "LockBet")

	locked, _ := bpCaller.LockedBalances(nil, user)
	balAfterLock, _ := bpCaller.UserBalances(nil, user)
	if locked.Cmp(stakeWei) != 0 {
		t.Fatalf("after LockBet user.lockedBalances = %s, want %s", usdt6(locked), usdt6(stakeWei))
	}
	// userBalances is total in-contract credit; LockBet does NOT decrement it,
	// it only increments lockedBalances. Spendable = userBalances - locked.
	if new(big.Int).Sub(balAfterLock, locked).Sign() < 0 {
		t.Fatalf("inconsistent state: userBalances %s < lockedBalances %s",
			usdt6(balAfterLock), usdt6(locked))
	}
	t.Logf("    user locked=%s userBalances=%s (spendable=%s) ✓",
		usdt6(locked), usdt6(balAfterLock), usdt6(new(big.Int).Sub(balAfterLock, locked)))

	// ── 3.5 Admin: CloseMarket ───────────────────────────────────────────────
	t.Log("STEP 3.5 admin.CloseMarket (window shut before settle)")
	closeArgs := sdkadmin.CloseMarketArgs{MatchID: matchID, Market: sdkadmin.MarketX12, Line: f1Line}
	if err := adminCli.SimulateCloseMarket(ctx, closeArgs); err != nil {
		t.Fatalf("simulate CloseMarket: %v", err)
	}
	tx, err = adminCli.CloseMarket(ctx, closeArgs)
	if err != nil {
		t.Fatalf("CloseMarket: %v", err)
	}
	waitMined(t, ctx, conn, tx, "CloseMarket")
	// Note: IsAccepting view does NOT flip on close (it checks pause/LP, not
	// per-market state). Settle's own require enforces "not open".

	// ── 4. Multisig (= admin EOA): BettingPool.Settle ────────────────────────
	t.Log("STEP 4  multisig.Settle (direct binding call; admin EOA == multisig EOA)")
	mOpts, err := txOpts(ctx, conn, admS)
	if err != nil {
		t.Fatalf("multisig opts: %v", err)
	}
	tx, err = bp.Settle(mOpts, matchID, f1Market, f1Line, f1Winning, [][32]byte{betID})
	if err != nil {
		t.Fatalf("Settle: %v", err)
	}
	waitMined(t, ctx, conn, tx, "Settle")

	lockedAfterSettle, _ := bpCaller.LockedBalances(nil, user)
	balAfterSettle, _ := bpCaller.UserBalances(nil, user)
	if lockedAfterSettle.Sign() != 0 {
		t.Fatalf("after Settle user.lockedBalances = %s, want 0", usdt6(lockedAfterSettle))
	}
	if balAfterSettle.Sign() == 0 {
		t.Fatalf("after Settle user.userBalances = 0, expected positive payout (user won)")
	}
	if balAfterSettle.Cmp(stakeWei) <= 0 {
		t.Errorf("after Settle user.userBalances = %s, expected > stake %s (user should profit)",
			usdt6(balAfterSettle), usdt6(stakeWei))
	}
	t.Logf("    user locked=%s userBalances=%s (full payout) ✓",
		usdt6(lockedAfterSettle), usdt6(balAfterSettle))

	// ── 5. User: Withdraw ────────────────────────────────────────────────────
	t.Log("STEP 5  user.Withdraw")
	payout := balAfterSettle
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
	t.Logf("    user wallet delta = %s (start=%s end=%s)",
		signed(walletDelta), usdt6(startUserUSDT), usdt6(endUserUSDT))

	// Wallet net = -stake (paid in step 1) + payout (received in step 5)
	wantDelta := new(big.Int).Sub(payout, stakeWei)
	if walletDelta.Cmp(wantDelta) != 0 {
		t.Fatalf("wallet delta = %s, want %s (payout %s - stake %s)",
			signed(walletDelta), signed(wantDelta), usdt6(payout), usdt6(stakeWei))
	}

	t.Log("== DONE ==")
	t.Logf("stake placed         : -%s USDT", usdt6(stakeWei))
	t.Logf("settle payout (gross): +%s USDT", usdt6(payout))
	t.Logf("net to user wallet   : %s USDT", signed(walletDelta))
}
