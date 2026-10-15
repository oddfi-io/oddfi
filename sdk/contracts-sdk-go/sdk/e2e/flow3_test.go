//go:build e2e

package e2e

// TestFlow3 — 信用仓位 (Credit Bet / Lending): 用户先下抵押单 A,再用 A 担保
// 信用单 B。A 先结算赢、B 后结算赢的 happy path。
//
// 抵押约束(链下校验,合约也会再 require):
//
//	 cumulativeCredit ≤ A.amount × 50%
//	 collateralBet.isCredit == false   (禁止连环)
//	 collateralBet.isParlay == false   (串关不能抵押)
//
// Step list:
//
//	0a   Admin    : OpenMarket(matchID_A, X12, 0)
//	0b   Admin    : OpenMarket(matchID_B, X12, 0)
//	1    User     : USDT.Transfer(BettingPool, stake_A)            ← 全部入金做抵押
//	2    Admin    : CreditDeposit(user, stake_A, txHash=<step1>)
//	3    Admin    : LockBet A(stake_A, odds_A)                     ← 普通抵押单
//	4    Admin    : LockCreditBet B(amount_B, collateral=A,
//	                                odds_B)                        ← 用 A 担保
//	                amount_B ≤ stake_A × 0.5
//	                B 的资金来自 bettingPool,不动 user.userBalances
//	5    Admin    : CloseMarket(matchID_A)
//	6    Multisig : BettingPool.Settle(A wins)
//	                 → user.lockedBalances -= stake_A
//	                   user.userBalances ⇒ stake_A × odds_A / 1000
//	7    Admin    : CloseMarket(matchID_B)
//	8    Multisig : BettingPool.Settle(B wins)
//	                 → A 已结算赢 → 合约直接把利润 (= amountB × (oddsB−1000) / 1000)
//	                   计入 user.userBalances,信用额 amountB 留给 Pool
//	                 注:若反过来"B 先赢 A 仍 pending",Settle B 会把 gross 冻结到
//	                   frozenPayouts[B],之后必须 Multisig.ReleaseOrForfeiture(B)
//	                   才决定释放给用户(A 赢)还是 forfeit 给 platformBalance(A 输)。
//	                   本测试不覆盖那条分支。
//	9    User     : Withdraw(payout)
//
// Run:
//
//	E2E_RPC=... E2E_ADMIN_PK=... E2E_USER_PK=... \
//	  go test -tags=e2e -count=1 -v -timeout=15m -run TestFlow3 ./sdk/e2e/...

import (
	"context"
	"math/big"
	"testing"
	"time"

	sdkadmin "github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/admin"
	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/bindings/bettingpool"
	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/bindings/erc20"
)

// Flow 3 parameters. f3 prefix.
const (
	f3StakeA  int64 = 2_000_000 // 2 USDT collateral bet
	f3AmountB int64 = 1_000_000 // 1 USDT credit bet (= 50% of A, the cap)
	f3Odds    int64 = 1500      // 1.5x for both legs
	f3Market  uint8 = 0         // X12
	f3Line    uint8 = 0
	f3Outcome uint8 = 1
	f3Winning uint8 = 1
)

func TestFlow3(t *testing.T) {
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

	stakeA := big.NewInt(f3StakeA)
	amountB := big.NewInt(f3AmountB)

	startUserUSDT, _ := usdt.BalanceOf(nil, user)
	startBpUSDT, _ := usdt.BalanceOf(nil, bpAddr)
	t.Logf("== START ==  user.USDT=%s  bp.USDT=%s", usdt6(startUserUSDT), usdt6(startBpUSDT))
	if startUserUSDT.Cmp(stakeA) < 0 {
		t.Fatalf("user wallet has %s USDT < required %s", usdt6(startUserUSDT), usdt6(stakeA))
	}

	matchA := rand32(t)
	matchB := rand32(t)
	betA := rand32(t)
	betB := rand32(t)
	t.Logf("matchA=0x%x betA=0x%x  (collateral)", matchA, betA)
	t.Logf("matchB=0x%x betB=0x%x  (credit)", matchB, betB)

	// ── 0. Admin: OpenMarket × 2 ─────────────────────────────────────────────
	for i, m := range [...][32]byte{matchA, matchB} {
		t.Logf("STEP 0%c admin.OpenMarket %s", 'a'+byte(i), [...]string{"A (collateral)", "B (credit)"}[i])
		args := sdkadmin.OpenMarketArgs{MatchID: m, Market: sdkadmin.MarketX12, Line: f3Line}
		if err := adminCli.SimulateOpenMarket(ctx, args); err != nil {
			t.Fatalf("simulate OpenMarket: %v", err)
		}
		tx, err := adminCli.OpenMarket(ctx, args)
		if err != nil {
			t.Fatalf("OpenMarket: %v", err)
		}
		waitMined(t, ctx, conn, tx, "OpenMarket")
	}

	// ── 1. User: USDT.Transfer(stakeA) ───────────────────────────────────────
	t.Log("STEP 1  user → BettingPool USDT.transfer (collateral funds)")
	uOpts, err := txOpts(ctx, conn, usrS)
	if err != nil {
		t.Fatalf("user opts: %v", err)
	}
	transferTx, err := usdt.Transfer(uOpts, bpAddr, stakeA)
	if err != nil {
		t.Fatalf("USDT.Transfer: %v", err)
	}
	waitMined(t, ctx, conn, transferTx, "USDT.Transfer")
	depositTxHash := transferTx.Hash()

	// ── 2. Admin: CreditDeposit ──────────────────────────────────────────────
	t.Log("STEP 2  admin.CreditDeposit")
	depArgs := sdkadmin.CreditDepositArgs{User: user, Amount: stakeA, TxHash: depositTxHash}
	if err := adminCli.SimulateCreditDeposit(ctx, depArgs); err != nil {
		t.Fatalf("simulate CreditDeposit: %v", err)
	}
	tx, err := adminCli.CreditDeposit(ctx, depArgs)
	if err != nil {
		t.Fatalf("CreditDeposit: %v", err)
	}
	waitMined(t, ctx, conn, tx, "CreditDeposit")

	// Baseline userBalances after deposit: any leftover from prior runs is
	// folded in; subsequent assertions use deltas relative to this point.
	balBaseline, _ := bpCaller.UserBalances(nil, user)
	t.Logf("    baseline userBalances = %s", usdt6(balBaseline))

	// ── 3. Admin: LockBet A (collateral) ─────────────────────────────────────
	t.Log("STEP 3  admin.LockBet A (collateral, 1.5x)")
	betAArgs := sdkadmin.LockBetArgs{
		BetID: betA, User: user, Amount: stakeA, MatchID: matchA,
		Market: sdkadmin.MarketX12, Outcome: f3Outcome, Line: f3Line,
		LockedOdds: big.NewInt(f3Odds),
	}
	if err := adminCli.SimulateLockBet(ctx, betAArgs); err != nil {
		t.Fatalf("simulate LockBet A: %v", err)
	}
	tx, err = adminCli.LockBet(ctx, betAArgs)
	if err != nil {
		t.Fatalf("LockBet A: %v", err)
	}
	waitMined(t, ctx, conn, tx, "LockBet A")

	// ── 4. Admin: LockCreditBet B (collateralised by A) ──────────────────────
	t.Log("STEP 4  admin.LockCreditBet B (1 USDT credit, A as collateral, 1.5x)")
	betBArgs := sdkadmin.LockCreditBetArgs{
		BetID:           betB,
		CollateralBetID: betA,
		User:            user,
		Amount:          amountB,
		MatchID:         matchB,
		Market:          sdkadmin.MarketX12,
		Outcome:         f3Outcome,
		Line:            f3Line,
		LockedOdds:      big.NewInt(f3Odds),
	}
	if err := adminCli.SimulateLockCreditBet(ctx, betBArgs); err != nil {
		t.Fatalf("simulate LockCreditBet B: %v", err)
	}
	tx, err = adminCli.LockCreditBet(ctx, betBArgs)
	if err != nil {
		t.Fatalf("LockCreditBet B: %v", err)
	}
	waitMined(t, ctx, conn, tx, "LockCreditBet B")

	// Verify state.
	locked, _ := bpCaller.LockedBalances(nil, user)
	bal, _ := bpCaller.UserBalances(nil, user)
	t.Logf("    after both locks: user.locked=%s userBalances=%s",
		usdt6(locked), usdt6(bal))
	if locked.Cmp(stakeA) != 0 {
		t.Fatalf("locked = %s, want %s (only A locks user funds; B uses pool)",
			usdt6(locked), usdt6(stakeA))
	}

	// ── 5. Admin: CloseMarket A ──────────────────────────────────────────────
	t.Log("STEP 5  admin.CloseMarket A")
	closeA := sdkadmin.CloseMarketArgs{MatchID: matchA, Market: sdkadmin.MarketX12, Line: f3Line}
	if err := adminCli.SimulateCloseMarket(ctx, closeA); err != nil {
		t.Fatalf("simulate CloseMarket A: %v", err)
	}
	tx, err = adminCli.CloseMarket(ctx, closeA)
	if err != nil {
		t.Fatalf("CloseMarket A: %v", err)
	}
	waitMined(t, ctx, conn, tx, "CloseMarket A")

	// ── 6. Multisig: Settle A (A wins) ───────────────────────────────────────
	t.Log("STEP 6  multisig.Settle A (A wins)")
	mOpts, err := txOpts(ctx, conn, admS)
	if err != nil {
		t.Fatalf("multisig opts: %v", err)
	}
	tx, err = bp.Settle(mOpts, matchA, f3Market, f3Line, f3Winning, [][32]byte{betA})
	if err != nil {
		t.Fatalf("Settle A: %v", err)
	}
	waitMined(t, ctx, conn, tx, "Settle A")

	balAfterA, _ := bpCaller.UserBalances(nil, user)
	lockedAfterA, _ := bpCaller.LockedBalances(nil, user)
	// profit_A = stakeA × (oddsA − 1000) / 1000 = 2 × 500 / 1000 = 1.0
	profitA := new(big.Int).Mul(stakeA, big.NewInt(f3Odds-1000))
	profitA = profitA.Quo(profitA, big.NewInt(1000))
	deltaA := new(big.Int).Sub(balAfterA, balBaseline)
	t.Logf("    after Settle A: locked=%s userBalances=%s (delta vs baseline=%s, want profit_A=%s)",
		usdt6(lockedAfterA), usdt6(balAfterA), usdt6(deltaA), usdt6(profitA))
	if deltaA.Cmp(profitA) != 0 {
		t.Errorf("after Settle A delta = %s, want %s (profit only; stake stays in userBalances)",
			usdt6(deltaA), usdt6(profitA))
	}

	// ── 7. Admin: CloseMarket B ──────────────────────────────────────────────
	t.Log("STEP 7  admin.CloseMarket B")
	closeB := sdkadmin.CloseMarketArgs{MatchID: matchB, Market: sdkadmin.MarketX12, Line: f3Line}
	if err := adminCli.SimulateCloseMarket(ctx, closeB); err != nil {
		t.Fatalf("simulate CloseMarket B: %v", err)
	}
	tx, err = adminCli.CloseMarket(ctx, closeB)
	if err != nil {
		t.Fatalf("CloseMarket B: %v", err)
	}
	waitMined(t, ctx, conn, tx, "CloseMarket B")

	// ── 8. Multisig: Settle B ────────────────────────────────────────────────
	// Since A is already settled-won, the contract directly credits user with
	// profit_B = amountB × (oddsB − 1000) / 1000 (gross − credit_used).
	// frozenPayouts[B] stays 0 in this branch; ReleaseOrForfeiture is only
	// needed when B is settled while A is still pending.
	t.Log("STEP 8  multisig.Settle B (A already won → direct profit credit)")
	mOpts2, err := txOpts(ctx, conn, admS)
	if err != nil {
		t.Fatalf("multisig opts: %v", err)
	}
	tx, err = bp.Settle(mOpts2, matchB, f3Market, f3Line, f3Winning, [][32]byte{betB})
	if err != nil {
		t.Fatalf("Settle B: %v", err)
	}
	waitMined(t, ctx, conn, tx, "Settle B")

	balAfterB, _ := bpCaller.UserBalances(nil, user)
	lockedAfterB, _ := bpCaller.LockedBalances(nil, user)
	frozenAfterB, frozenErr := bpCaller.FrozenPayouts(nil, betB)
	// profit_B = amountB × (oddsB − 1000) / 1000 = 1 × 500 / 1000 = 0.5
	profitB := new(big.Int).Mul(amountB, big.NewInt(f3Odds-1000))
	profitB = profitB.Quo(profitB, big.NewInt(1000))
	deltaB := new(big.Int).Sub(balAfterB, balAfterA)
	t.Logf("    after Settle B: locked=%s userBalances=%s frozenPayouts[B]=%s",
		usdt6(lockedAfterB), usdt6(balAfterB), usdt6(frozenAfterB))
	t.Logf("    delta vs after-A=%s, want profit_B=%s", usdt6(deltaB), usdt6(profitB))
	if deltaB.Cmp(profitB) != 0 {
		t.Errorf("after Settle B delta = %s, want %s (= amountB × (oddsB−1000) / 1000)",
			usdt6(deltaB), usdt6(profitB))
	}
	switch {
	case frozenErr != nil:
		t.Logf("    FrozenPayouts(B) call err=%v (treated as 0)", frozenErr)
	case frozenAfterB == nil:
		// abigen returns nil on certain decode hiccups; treat as zero.
	case frozenAfterB.Sign() != 0:
		t.Errorf("frozenPayouts[B] = %s, want 0 (A first → direct credit, no freeze)",
			usdt6(frozenAfterB))
	}
	if lockedAfterB.Sign() != 0 {
		t.Fatalf("after both settles user.lockedBalances = %s, want 0", usdt6(lockedAfterB))
	}

	// ── 9. User: Withdraw ────────────────────────────────────────────────────
	t.Log("STEP 9  user.Withdraw")
	payout := balAfterB
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
	wantDelta := new(big.Int).Sub(payout, stakeA)
	if walletDelta.Cmp(wantDelta) != 0 {
		t.Fatalf("wallet delta = %s, want %s", signed(walletDelta), signed(wantDelta))
	}

	t.Log("== DONE ==")
	t.Logf("collateral paid       : -%s USDT", usdt6(stakeA))
	t.Logf("withdrawn (gross)     : +%s USDT", usdt6(payout))
	t.Logf("net to user wallet    : %s USDT", signed(walletDelta))
	t.Logf("  break-down:")
	t.Logf("    A (regular) profit: +%s USDT", usdt6(profitA))
	t.Logf("    B (credit)  profit: +%s USDT", usdt6(profitB))
}
