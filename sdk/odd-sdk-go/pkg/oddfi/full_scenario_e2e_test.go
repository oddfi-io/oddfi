package oddfi_test

// TestE2EFullMatchScenario runs the complete 7-step end-to-end scenario on BSC Testnet:
//
//  1. OpenMarket  – admin (OPERATOR_ROLE) opens a 1x2 betting market
//  2. DepositMatch – LP (admin key) deposits 1000 ODD into the single-match pool
//  3. PlaceBet    – bettor (generated address) bets 100 ODD on outcome 0
//  4. Score settlement – admin (SETTLER_ROLE) settles bet batches by score and finalizes the market
//  5. ClaimPayout  – bettor claims winning payout
//  6. RequestUnbond – LP requests to unbond the match pool position
//  7. Withdraw     – LP withdraws principal + earnings (after unbond epoch elapses)
//
// Each step logs: tx_hash, gas_used, BNB delta, ODD deltas, and contract balance changes.
//
// Required env vars:
//
//	ODDFI_FULL_E2E=1
//	ODDFI_PRIVATE_KEY=<hex>
//	ODDFI_RPC_URL=<url>
//	ODDFI_ODD_TOKEN_PROXY=<addr>
//	ODDFI_STAKING_POOL_PROXY=<addr>
//	ODDFI_LIQUIDITY_POOL_PROXY=<addr>
//	ODDFI_BETTING_POOL_PROXY=<addr>
//
// Optional env vars:
//
//	ODDFI_FULL_E2E_TOP_UP_RESERVE=1    // add missing BettingPool reserve and retry ClaimPayout
//	ODDFI_FULL_E2E_WAIT_WITHDRAW=10m   // wait duration for LP withdrawable state

import (
	"context"
	"fmt"
	"math/big"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/pkg/oddfi"
)

func TestE2EFullMatchScenario(t *testing.T) {
	if os.Getenv("ODDFI_FULL_E2E") != "1" {
		t.Skip("set ODDFI_FULL_E2E=1 to run the full 7-step match scenario (≈15 min)")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 40*time.Minute)
	t.Cleanup(cancel)

	// ── connect ─────────────────────────────────────────────────────────────
	rpcURL := requiredEnv(t, "ODDFI_RPC_URL")
	adminKey := requiredPrivateKey(t)
	adminAddr := crypto.PubkeyToAddress(adminKey.PublicKey)
	t.Logf("admin_address: %s", adminAddr.Hex())

	observer, err := ethclient.DialContext(ctx, rpcURL)
	if err != nil {
		t.Fatalf("dial rpc: %v", err)
	}
	t.Cleanup(observer.Close)

	chainID, err := observer.ChainID(ctx)
	if err != nil {
		t.Fatalf("chain id: %v", err)
	}
	t.Logf("chain_id: %s", chainID)

	lpAddr := mustParseEnvAddress(t, "ODDFI_LIQUIDITY_POOL_PROXY")
	bpAddr := mustParseEnvAddress(t, "ODDFI_BETTING_POOL_PROXY")

	sdk, err := oddfi.NewClient(ctx, oddfi.Config{
		RPCURL:             rpcURL,
		ODDTokenProxy:      mustParseEnvAddress(t, "ODDFI_ODD_TOKEN_PROXY"),
		StakingPoolProxy:   mustParseEnvAddress(t, "ODDFI_STAKING_POOL_PROXY"),
		LiquidityPoolProxy: lpAddr,
		BettingPoolProxy:   bpAddr,
	})
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	t.Cleanup(func() { _ = sdk.Close(ctx) })

	adminOpts := func() *bind.TransactOpts {
		o, e := bind.NewKeyedTransactorWithChainID(adminKey, chainID)
		if e != nil {
			t.Fatalf("adminOpts: %v", e)
		}
		o.Context = ctx
		return o
	}

	// ── generate bettor ──────────────────────────────────────────────────────
	bettorKey, err := crypto.GenerateKey()
	if err != nil {
		t.Fatalf("generate bettor key: %v", err)
	}
	bettorAddr := crypto.PubkeyToAddress(bettorKey.PublicKey)
	bettorOpts := func() *bind.TransactOpts {
		o, e := bind.NewKeyedTransactorWithChainID(bettorKey, chainID)
		if e != nil {
			t.Fatalf("bettorOpts: %v", e)
		}
		o.Context = ctx
		return o
	}
	t.Logf("bettor_address (generated): %s", bettorAddr.Hex())

	// ── timing ───────────────────────────────────────────────────────────────
	// lockAt = matchStartTime - 5 min; we need ≥ 5 min for steps 1-3.
	// Use 10-min window → lockAt = now + 5 min, matchEnd = now + 11 min.
	now := uint64(time.Now().Unix())
	matchStartTime := now + 10*60 // 10 min from now; lockAt = now + 5 min
	matchEndTime := now + 11*60   // 1 min after matchStartTime

	matchID := fsMatchID(now)
	marketID := fsMarketID(matchID, 0, 0)

	t.Logf("match_id:         %x", matchID)
	t.Logf("market_id:        %x", marketID)
	t.Logf("match_start_time: %d  (lock_at = %d)", matchStartTime, matchStartTime-300)
	t.Logf("match_end_time:   %d", matchEndTime)

	// ── role hashes ──────────────────────────────────────────────────────────
	operatorRole := crypto.Keccak256Hash([]byte("OPERATOR_ROLE"))
	settlerRole := crypto.Keccak256Hash([]byte("SETTLER_ROLE"))

	// ── amounts ──────────────────────────────────────────────────────────────
	one18 := new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)
	lpAmount := new(big.Int).Mul(big.NewInt(1000), one18) // 1000 ODD
	betAmount := new(big.Int).Mul(big.NewInt(100), one18) // 100 ODD
	// betTax = 1% of betAmount (betTaxBps = 100)
	betApproval := new(big.Int).Add(betAmount, new(big.Int).Div(betAmount, big.NewInt(100)))
	// Fund bettor: enough ODD + BNB for gas
	bettorODDFund := new(big.Int).Mul(big.NewInt(200), one18)                                               // 200 ODD
	bettorBNBFund := new(big.Int).Mul(big.NewInt(2), new(big.Int).Exp(big.NewInt(10), big.NewInt(16), nil)) // 0.02 BNB
	topUpReserveOnClaimFailure := os.Getenv("ODDFI_FULL_E2E_TOP_UP_RESERVE") == "1"
	withdrawWait := fsEnvDuration(t, "ODDFI_FULL_E2E_WAIT_WITHDRAW", 10*time.Minute)

	// ── fund bettor with BNB ──────────────────────────────────────────────────
	t.Log("=== Setup: fund bettor with BNB ===")
	{
		nonce, _ := observer.PendingNonceAt(ctx, adminAddr)
		gasPrice, _ := observer.SuggestGasPrice(ctx)
		rawTx := types.NewTx(&types.LegacyTx{
			Nonce: nonce, To: &bettorAddr, Value: bettorBNBFund, Gas: 21000, GasPrice: gasPrice,
		})
		signed, _ := types.SignTx(rawTx, types.NewEIP155Signer(chainID), adminKey)
		if err2 := observer.SendTransaction(ctx, signed); err2 != nil {
			t.Fatalf("fund bettor BNB: %v", err2)
		}
		receipt := fsMine(t, ctx, observer, signed)
		t.Logf("Setup.FundBettorBNB tx_hash=%s gas_used=%d amount=%s wei", signed.Hash().Hex(), receipt.GasUsed, bettorBNBFund)
	}

	// ── fund bettor with ODD ──────────────────────────────────────────────────
	t.Log("=== Setup: fund bettor with ODD ===")
	{
		tx, err2 := sdk.ODDToken().Transfer(adminOpts(), bettorAddr, bettorODDFund)
		if err2 != nil {
			t.Fatalf("fund bettor ODD: %v", err2)
		}
		receipt := fsMine(t, ctx, observer, tx)
		bBefore, _ := observer.BalanceAt(ctx, adminAddr, new(big.Int).SetUint64(receipt.BlockNumber.Uint64()-1))
		bAfter, _ := observer.BalanceAt(ctx, adminAddr, receipt.BlockNumber)
		oddBefore, _ := sdk.ODDToken().BalanceOf(ctx, adminAddr)
		oddAfter, _ := sdk.ODDToken().BalanceOf(ctx, bettorAddr)
		t.Logf("Setup.FundBettorODD tx_hash=%s gas_used=%d", tx.Hash().Hex(), receipt.GasUsed)
		t.Logf("  admin_BNB_delta=%s  bettor_ODD_received=%s", deltaStr(bAfter, bBefore), oddAfter)
		t.Logf("  admin_ODD_before=%s → sent %s", oddBefore, bettorODDFund)
	}

	// ════════════════════════════════════════════════════════════════════════
	// Step 1: OpenMarket
	// ════════════════════════════════════════════════════════════════════════
	t.Log("\n=== Step 1: OpenMarket ===")
	{
		// Grant OPERATOR_ROLE if not held
		if hasRole, _ := sdk.BettingPool().HasRole(ctx, operatorRole, adminAddr); !hasRole {
			tx, err2 := sdk.BettingPool().GrantRole(adminOpts(), operatorRole, adminAddr)
			if err2 != nil {
				t.Fatalf("grant OPERATOR_ROLE: %v", err2)
			}
			r := fsMine(t, ctx, observer, tx)
			t.Logf("Step1.GrantOperatorRole tx_hash=%s gas_used=%d", tx.Hash().Hex(), r.GasUsed)
		} else {
			t.Log("Step1: admin already has OPERATOR_ROLE")
		}

		b := fsReadBP(t, ctx, observer, sdk, adminAddr, bpAddr)
		baseOdds := []*big.Int{big.NewInt(20000), big.NewInt(30000), big.NewInt(20000)}
		tx, err2 := sdk.BettingPool().OpenMarket(
			adminOpts(), matchID, 0, 0,
			matchStartTime, matchEndTime, baseOdds, uint64(time.Now().Unix()),
		)
		if err2 != nil {
			t.Fatalf("OpenMarket: %v", err2)
		}
		receipt := fsMine(t, ctx, observer, tx)
		a := fsReadBP(t, ctx, observer, sdk, adminAddr, bpAddr)
		fsLogBP(t, "Step1.OpenMarket", tx, receipt, b, a)
		t.Logf("  market_type=0 (1x2)  outcomes=3  base_odds=[20000,30000,20000]")
		t.Logf("  match_start_time=%d  lock_at=%d  match_end_time=%d", matchStartTime, matchStartTime-300, matchEndTime)
	}

	// ════════════════════════════════════════════════════════════════════════
	// Step 2: DepositMatch (single-match LP)
	// ════════════════════════════════════════════════════════════════════════
	t.Log("\n=== Step 2: DepositMatch (single-match LP) ===")
	var lpPositionID *big.Int
	{
		nextID, _ := sdk.LiquidityPool().NextLpPositionID(ctx)
		lpPositionID = new(big.Int).Set(nextID)

		// Approve
		appTx, err2 := sdk.ODDToken().Approve(adminOpts(), lpAddr, lpAmount)
		if err2 != nil {
			t.Fatalf("approve LP: %v", err2)
		}
		appR := fsMine(t, ctx, observer, appTx)
		t.Logf("Step2.Approve tx_hash=%s gas_used=%d amount=%s ODD-wei", appTx.Hash().Hex(), appR.GasUsed, lpAmount)

		b := fsReadLP(t, ctx, observer, sdk, adminAddr, lpAddr)
		tx, err2 := sdk.LiquidityPool().DepositMatch(adminOpts(), matchID, lpAmount)
		if err2 != nil {
			t.Fatalf("DepositMatch: %v", err2)
		}
		receipt := fsMine(t, ctx, observer, tx)
		a := fsReadLP(t, ctx, observer, sdk, adminAddr, lpAddr)
		fsLogLP(t, "Step2.DepositMatch", tx, receipt, b, a)
		t.Logf("  lp_position_id=%s  lp_amount=%s ODD-wei  unlock_at=matchEndTime(%d)", lpPositionID, lpAmount, matchEndTime)
	}

	// ════════════════════════════════════════════════════════════════════════
	// Step 3: PlaceBet (user side)
	// ════════════════════════════════════════════════════════════════════════
	t.Log("\n=== Step 3: PlaceBet (user side) ===")
	var betID [32]byte
	{
		// Read market odds for guard
		odds, err2 := sdk.BettingPool().GetMarketOdds(ctx, marketID)
		if err2 != nil {
			t.Fatalf("GetMarketOdds: %v", err2)
		}
		t.Logf("Step3.MarketOdds  quote_version=%s  updated_at=%d  quoted_odds=%v", odds.QuoteVersion, odds.UpdatedAt, odds.QuotedOdds)

		sig, err2 := sdk.BettingPool().PreviewSignal(ctx, marketID, 0, betAmount)
		if err2 != nil {
			t.Fatalf("PreviewSignal: %v", err2)
		}
		t.Logf("Step3.PreviewSignal  signal=%d(0=Green)  accepted=%s  locked_odds=%s  partial=%v",
			sig.Signal, sig.AcceptedAmount, sig.LockedOdds, sig.PartialFill)

		guard := oddfi.QuoteGuardInput{
			QuoteVersion:      odds.QuoteVersion,
			QuotedAt:          odds.UpdatedAt,
			MinOdds:           big.NewInt(10100),
			MinAcceptedAmount: big.NewInt(1),
			Deadline:          big.NewInt(time.Now().Add(15 * time.Minute).Unix()),
		}

		// Bettor approves BettingPool
		appTx, err2 := sdk.ODDToken().Approve(bettorOpts(), bpAddr, betApproval)
		if err2 != nil {
			t.Fatalf("bettor approve BP: %v", err2)
		}
		appR := fsMine(t, ctx, observer, appTx)
		t.Logf("Step3.BettorApprove tx_hash=%s gas_used=%d amount=%s ODD-wei", appTx.Hash().Hex(), appR.GasUsed, betApproval)

		b := fsReadBP(t, ctx, observer, sdk, bettorAddr, bpAddr)
		tx, err2 := sdk.BettingPool().PlaceBet(bettorOpts(), marketID, 0, betAmount, guard)
		if err2 != nil {
			t.Fatalf("PlaceBet: %v", err2)
		}
		receipt := fsMine(t, ctx, observer, tx)
		a := fsReadBP(t, ctx, observer, sdk, bettorAddr, bpAddr)
		fsLogBP(t, "Step3.PlaceBet", tx, receipt, b, a)

		betID = fsParseBetID(t, receipt)
		t.Logf("  bet_id=%x  outcome=0  requested=%s  bet_tax_1pct=%s", betID, betAmount, new(big.Int).Div(betAmount, big.NewInt(100)))
	}

	// ── wait for matchEndTime ─────────────────────────────────────────────────
	t.Logf("\n=== Waiting for matchEndTime=%d ===", matchEndTime)
	fsWaitTimestamp(t, ctx, observer, matchEndTime+2, "matchEndTime")

	// ════════════════════════════════════════════════════════════════════════
	// Step 4: Score settlement (admin side)
	// ════════════════════════════════════════════════════════════════════════
	t.Log("\n=== Step 4: Score settlement (admin side) ===")
	{
		if hasRole, _ := sdk.BettingPool().HasRole(ctx, settlerRole, adminAddr); !hasRole {
			tx, err2 := sdk.BettingPool().GrantRole(adminOpts(), settlerRole, adminAddr)
			if err2 != nil {
				t.Fatalf("grant SETTLER_ROLE: %v", err2)
			}
			r := fsMine(t, ctx, observer, tx)
			t.Logf("Step4.GrantSettlerRole tx_hash=%s gas_used=%d", tx.Hash().Hex(), r.GasUsed)
		} else {
			t.Log("Step4: admin already has SETTLER_ROLE")
		}

		b := fsReadBP(t, ctx, observer, sdk, adminAddr, bpAddr)
		betIDs, err2 := sdk.BettingPool().GetMarketBetIds(ctx, marketID, big.NewInt(0), big.NewInt(100))
		if err2 != nil {
			t.Fatalf("GetMarketBetIds: %v", err2)
		}
		if len(betIDs) == 0 {
			t.Fatalf("GetMarketBetIds returned no bets for market %x", marketID)
		}
		settleTx, err2 := sdk.BettingPool().SettleMarketBetsByScore(adminOpts(), marketID, 2, 1, betIDs)
		if err2 != nil {
			t.Fatalf("SettleMarketBetsByScore: %v", err2)
		}
		settleReceipt := fsMine(t, ctx, observer, settleTx)
		m := fsReadBP(t, ctx, observer, sdk, adminAddr, bpAddr)
		fsLogBP(t, "Step4.SettleMarketBetsByScore", settleTx, settleReceipt, b, m)

		finalizeTx, err2 := sdk.BettingPool().FinalizeMarketSettlement(adminOpts(), marketID, 0)
		if err2 != nil {
			t.Fatalf("FinalizeMarketSettlement: %v", err2)
		}
		finalizeReceipt := fsMine(t, ctx, observer, finalizeTx)
		a := fsReadBP(t, ctx, observer, sdk, adminAddr, bpAddr)
		fsLogBP(t, "Step4.FinalizeMarketSettlement", finalizeTx, finalizeReceipt, m, a)

		mkt, _ := sdk.BettingPool().GetMarket(ctx, marketID)
		t.Logf("  market_status=%d(2=Settled)  score=2-1  bet_batch_count=%d  result_kind=0(Settled)", mkt.Status, len(betIDs))
		fsLogPayoutWindow(t, ctx, sdk, matchID, "Step4.PostSettle")
	}

	// ════════════════════════════════════════════════════════════════════════
	// Step 5: ClaimPayout (user side)
	// ════════════════════════════════════════════════════════════════════════
	t.Log("\n=== Step 5: ClaimPayout (user side) ===")
	{
		bet, err2 := sdk.BettingPool().GetBet(ctx, betID)
		if err2 != nil {
			t.Fatalf("GetBet: %v", err2)
		}
		t.Logf("Step5.BetState  settlement_state=%d(3=WonUnclaimed,2=Lost)  claimable_payout=%s", bet.SettlementState, bet.ClaimablePayout)

		if bet.SettlementState == 3 { // WonUnclaimed
			if !fsClaimPayout(t, ctx, observer, sdk, bettorOpts, betID, bettorAddr, bpAddr, matchID, bet.ClaimablePayout, "Step5.ClaimPayout") {
				if !topUpReserveOnClaimFailure {
					t.Fatalf("ClaimPayout failed before LP unbond/withdraw. Diagnostics above show payout liquidity state. Set ODDFI_FULL_E2E_TOP_UP_RESERVE=1 to add the missing reserve and continue the full flow.")
				}
				missing := fsClaimShortfall(t, ctx, sdk, bpAddr, bet.ClaimablePayout)
				if missing.Sign() <= 0 {
					missing = one18
				}
				t.Logf("Step5.Recovery: topping up BettingPool reserve by %s ODD-wei before retry", missing)
				appTx, err2 := sdk.ODDToken().Approve(adminOpts(), bpAddr, missing)
				if err2 != nil {
					t.Fatalf("reserve approve after claim failure: %v", err2)
				}
				appR := fsMine(t, ctx, observer, appTx)
				t.Logf("Step5.RecoveryApprove tx_hash=%s gas_used=%d amount=%s ODD-wei", appTx.Hash().Hex(), appR.GasUsed, missing)
				b := fsReadBP(t, ctx, observer, sdk, adminAddr, bpAddr)
				tx, err2 := sdk.BettingPool().AddPlatformReserve(adminOpts(), missing)
				if err2 != nil {
					t.Fatalf("AddPlatformReserve after claim failure: %v", err2)
				}
				receipt := fsMine(t, ctx, observer, tx)
				a := fsReadBP(t, ctx, observer, sdk, adminAddr, bpAddr)
				fsLogBP(t, "Step5.RecoveryAddPlatformReserve", tx, receipt, b, a)
				if !fsClaimPayout(t, ctx, observer, sdk, bettorOpts, betID, bettorAddr, bpAddr, matchID, bet.ClaimablePayout, "Step5.ClaimPayoutRetry") {
					t.Fatalf("ClaimPayout retry failed after reserve top-up")
				}
			}
		} else {
			t.Logf("Step5: bet outcome=%d → Lost (bettor bet on outcome 0 which won, but state shows %d — check actual result)", bet.Outcome, bet.SettlementState)
		}
	}

	// ════════════════════════════════════════════════════════════════════════
	// Step 6: RequestUnbond (LP withdraws principal+earnings – phase 1)
	// ════════════════════════════════════════════════════════════════════════
	t.Log("\n=== Step 6: RequestUnbond (LP principal+earnings – phase 1) ===")
	{
		// Wait for match terminal
		fsWaitMatchTerminal(t, ctx, sdk, matchID)

		b := fsReadLP(t, ctx, observer, sdk, adminAddr, lpAddr)
		tx, err2 := sdk.LiquidityPool().RequestUnbond(adminOpts(), lpPositionID)
		if err2 != nil {
			t.Fatalf("RequestUnbond: %v", err2)
		}
		receipt := fsMine(t, ctx, observer, tx)
		a := fsReadLP(t, ctx, observer, sdk, adminAddr, lpAddr)
		fsLogLP(t, "Step6.RequestUnbond", tx, receipt, b, a)

		state, _ := sdk.LiquidityPool().GetPositionState(ctx, lpPositionID)
		t.Logf("  lp_position_id=%s  state=%d(1=Unbonding)  unbond_epochs=2 (need 2 epoch transitions)", lpPositionID, state)
	}

	// ════════════════════════════════════════════════════════════════════════
	// Step 7: Withdraw (LP – 用户提现 – phase 2)
	// ════════════════════════════════════════════════════════════════════════
	t.Log("\n=== Step 7: Withdraw (LP 用户提现 – phase 2) ===")
	{
		withdrawable := fsWaitLPWithdrawableOrNote(t, ctx, sdk, lpPositionID, withdrawWait)
		if withdrawable {
			b := fsReadLP(t, ctx, observer, sdk, adminAddr, lpAddr)
			tx, err2 := sdk.LiquidityPool().Withdraw(adminOpts(), lpPositionID)
			if err2 != nil {
				t.Fatalf("Withdraw: %v", err2)
			}
			receipt := fsMine(t, ctx, observer, tx)
			a := fsReadLP(t, ctx, observer, sdk, adminAddr, lpAddr)
			fsLogLP(t, "Step7.Withdraw", tx, receipt, b, a)
			t.Logf("  lp_position_id=%s  WITHDRAWN — principal+earnings returned to LP", lpPositionID)
		} else {
			t.Logf("Step7.Withdraw SKIPPED: unbond_epochs=2 not yet elapsed.")
			t.Logf("  To withdraw later: ODDFI_FULL_E2E=1 go test -run TestE2EWithdrawOnly and set ODDFI_LP_POSITION_ID=%s", lpPositionID)
		}
	}

	t.Log("\n=== Full 7-step scenario complete ===")
}

// TestE2EWithdrawOnly completes step 7 (withdraw) for an LP position after the
// unbond epoch has elapsed. Set ODDFI_LP_POSITION_ID=<id> to the position created
// in TestE2EFullMatchScenario.
func TestE2EWithdrawOnly(t *testing.T) {
	if os.Getenv("ODDFI_FULL_E2E") != "1" {
		t.Skip("set ODDFI_FULL_E2E=1")
	}
	posIDStr := os.Getenv("ODDFI_LP_POSITION_ID")
	if posIDStr == "" {
		t.Skip("set ODDFI_LP_POSITION_ID=<positionId>")
	}
	posID, ok := new(big.Int).SetString(posIDStr, 10)
	if !ok {
		t.Fatalf("invalid ODDFI_LP_POSITION_ID: %s", posIDStr)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	t.Cleanup(cancel)

	rpcURL := requiredEnv(t, "ODDFI_RPC_URL")
	adminKey := requiredPrivateKey(t)
	adminAddr := crypto.PubkeyToAddress(adminKey.PublicKey)
	lpAddr := mustParseEnvAddress(t, "ODDFI_LIQUIDITY_POOL_PROXY")

	observer, _ := ethclient.DialContext(ctx, rpcURL)
	t.Cleanup(observer.Close)
	chainID, _ := observer.ChainID(ctx)

	sdk, err := oddfi.NewClient(ctx, oddfi.Config{
		RPCURL:             rpcURL,
		ODDTokenProxy:      mustParseEnvAddress(t, "ODDFI_ODD_TOKEN_PROXY"),
		StakingPoolProxy:   mustParseEnvAddress(t, "ODDFI_STAKING_POOL_PROXY"),
		LiquidityPoolProxy: lpAddr,
		BettingPoolProxy:   mustParseEnvAddress(t, "ODDFI_BETTING_POOL_PROXY"),
	})
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	t.Cleanup(func() { _ = sdk.Close(ctx) })

	adminOpts := func() *bind.TransactOpts {
		o, e := bind.NewKeyedTransactorWithChainID(adminKey, chainID)
		if e != nil {
			t.Fatalf("adminOpts: %v", e)
		}
		o.Context = ctx
		return o
	}

	state, _ := sdk.LiquidityPool().GetPositionState(ctx, posID)
	t.Logf("LP position %s state=%d (5=Withdrawable)", posID, state)

	b := fsReadLP(t, ctx, observer, sdk, adminAddr, lpAddr)
	tx, err2 := sdk.LiquidityPool().Withdraw(adminOpts(), posID)
	if err2 != nil {
		t.Fatalf("Withdraw: %v", err2)
	}
	receipt := fsMine(t, ctx, observer, tx)
	a := fsReadLP(t, ctx, observer, sdk, adminAddr, lpAddr)
	fsLogLP(t, "Step7.Withdraw", tx, receipt, b, a)
}

// ── balance snapshot types ────────────────────────────────────────────────────

type fsBPSnap struct {
	userBNB, userODD, contractODD, platformReserve, accountedBal *big.Int
}

type fsLPSnap struct {
	userBNB, userODD, contractODD, totalActive, requestable *big.Int
}

func fsReadBP(t *testing.T, ctx context.Context, obs *ethclient.Client, sdk *oddfi.Client, user, contract common.Address) fsBPSnap {
	t.Helper()
	bnb, _ := obs.BalanceAt(ctx, user, nil)
	uODD, _ := sdk.ODDToken().BalanceOf(ctx, user)
	cODD, _ := sdk.ODDToken().BalanceOf(ctx, contract)
	res, _ := sdk.BettingPool().PlatformReserve(ctx)
	acc, _ := sdk.BettingPool().AccountedBalance(ctx)
	return fsBPSnap{safeBI(bnb), safeBI(uODD), safeBI(cODD), safeBI(res), safeBI(acc)}
}

func fsReadLP(t *testing.T, ctx context.Context, obs *ethclient.Client, sdk *oddfi.Client, user, contract common.Address) fsLPSnap {
	t.Helper()
	bnb, _ := obs.BalanceAt(ctx, user, nil)
	uODD, _ := sdk.ODDToken().BalanceOf(ctx, user)
	cODD, _ := sdk.ODDToken().BalanceOf(ctx, contract)
	tot, _ := sdk.LiquidityPool().TotalActiveDeposited(ctx)
	req, _ := sdk.LiquidityPool().RequestableLiquidity(ctx)
	return fsLPSnap{safeBI(bnb), safeBI(uODD), safeBI(cODD), safeBI(tot), safeBI(req)}
}

func fsLogBP(t *testing.T, label string, tx *types.Transaction, r *types.Receipt, b, a fsBPSnap) {
	t.Helper()
	t.Logf("%s  tx_hash=%s  block=%d  gas_used=%d", label, tx.Hash().Hex(), r.BlockNumber.Uint64(), r.GasUsed)
	t.Logf("  user_BNB_delta=%s", deltaStr(a.userBNB, b.userBNB))
	t.Logf("  user_ODD  before=%s  after=%s  delta=%s", b.userODD, a.userODD, deltaStr(a.userODD, b.userODD))
	t.Logf("  contract_ODD  before=%s  after=%s  delta=%s", b.contractODD, a.contractODD, deltaStr(a.contractODD, b.contractODD))
	t.Logf("  platform_reserve  before=%s  after=%s", b.platformReserve, a.platformReserve)
	t.Logf("  accounted_balance  before=%s  after=%s", b.accountedBal, a.accountedBal)
}

func fsLogLP(t *testing.T, label string, tx *types.Transaction, r *types.Receipt, b, a fsLPSnap) {
	t.Helper()
	t.Logf("%s  tx_hash=%s  block=%d  gas_used=%d", label, tx.Hash().Hex(), r.BlockNumber.Uint64(), r.GasUsed)
	t.Logf("  user_BNB_delta=%s", deltaStr(a.userBNB, b.userBNB))
	t.Logf("  user_ODD  before=%s  after=%s  delta=%s", b.userODD, a.userODD, deltaStr(a.userODD, b.userODD))
	t.Logf("  contract_ODD  before=%s  after=%s  delta=%s", b.contractODD, a.contractODD, deltaStr(a.contractODD, b.contractODD))
	t.Logf("  total_active_deposited  before=%s  after=%s  delta=%s", b.totalActive, a.totalActive, deltaStr(a.totalActive, b.totalActive))
	t.Logf("  requestable_liquidity  before=%s  after=%s  delta=%s", b.requestable, a.requestable, deltaStr(a.requestable, b.requestable))
}

func fsClaimPayout(
	t *testing.T,
	ctx context.Context,
	obs *ethclient.Client,
	sdk *oddfi.Client,
	bettorOpts func() *bind.TransactOpts,
	betID [32]byte,
	bettorAddr common.Address,
	bpAddr common.Address,
	matchID [32]byte,
	claimablePayout *big.Int,
	label string,
) bool {
	t.Helper()
	b := fsReadBP(t, ctx, obs, sdk, bettorAddr, bpAddr)
	tx, err := sdk.BettingPool().ClaimPayout(bettorOpts(), betID)
	if err != nil {
		t.Logf("%s submit_failed=%v", label, err)
		fsLogClaimDiagnostics(t, ctx, sdk, matchID, bpAddr, claimablePayout, err)
		return false
	}
	receipt := fsMine(t, ctx, obs, tx)
	a := fsReadBP(t, ctx, obs, sdk, bettorAddr, bpAddr)
	fsLogBP(t, label, tx, receipt, b, a)

	finalBet, err := sdk.BettingPool().GetBet(ctx, betID)
	if err != nil {
		t.Fatalf("GetBet after %s: %v", label, err)
	}
	fsLogPayoutWindow(t, ctx, sdk, matchID, label+".PostClaim")
	t.Logf("  final_bet_state=%d(4=WonClaimed)  net_payout≈claimable×0.95(5%% payout_tax)", finalBet.SettlementState)
	return true
}

func fsLogClaimDiagnostics(t *testing.T, ctx context.Context, sdk *oddfi.Client, matchID [32]byte, bpAddr common.Address, claimablePayout *big.Int, claimErr error) {
	t.Helper()
	bpODD, _ := sdk.ODDToken().BalanceOf(ctx, bpAddr)
	platformReserve, _ := sdk.BettingPool().PlatformReserve(ctx)
	accounted, _ := sdk.BettingPool().AccountedBalance(ctx)
	shortfall := new(big.Int).Sub(safeBI(claimablePayout), safeBI(bpODD))
	if shortfall.Sign() < 0 {
		shortfall = new(big.Int)
	}
	t.Logf("Claim diagnostics: BettingPool_ODD=%s claimable_payout=%s shortfall=%s", safeBI(bpODD), safeBI(claimablePayout), shortfall)
	t.Logf("Claim diagnostics: platform_reserve=%s accounted_balance=%s", safeBI(platformReserve), safeBI(accounted))
	fsLogPayoutWindow(t, ctx, sdk, matchID, "Claim diagnostics")
	if claimErr != nil {
		t.Logf("Claim diagnostics: panic_0x11=%v", fsLooksLikePanic11(claimErr))
	}
}

func fsLogPayoutWindow(t *testing.T, ctx context.Context, sdk *oddfi.Client, matchID [32]byte, label string) {
	t.Helper()
	window, err := sdk.LiquidityPool().PayoutLiquidityWindow(ctx, matchID)
	if err != nil {
		t.Logf("%s payout_window_error=%v", label, err)
		return
	}
	t.Logf("%s payout_window reserved=%s paid_out=%s settled_at=%s", label, safeBI(window.ReservedAmount), safeBI(window.PaidOutAmount), safeBI(window.SettledAt))
}

func fsClaimShortfall(t *testing.T, ctx context.Context, sdk *oddfi.Client, bpAddr common.Address, claimablePayout *big.Int) *big.Int {
	t.Helper()
	bpODD, err := sdk.ODDToken().BalanceOf(ctx, bpAddr)
	if err != nil {
		t.Fatalf("read BettingPool ODD for claim shortfall: %v", err)
	}
	shortfall := new(big.Int).Sub(safeBI(claimablePayout), safeBI(bpODD))
	if shortfall.Sign() < 0 {
		return new(big.Int)
	}
	return shortfall
}

func fsLooksLikePanic11(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "0x11") ||
		strings.Contains(msg, "arithmetic underflow or overflow") ||
		strings.Contains(msg, "Panic(0x11)")
}

// ── chain helpers ─────────────────────────────────────────────────────────────

func fsMine(t *testing.T, ctx context.Context, obs *ethclient.Client, tx *types.Transaction) *types.Receipt {
	t.Helper()
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()
	for {
		r, err := obs.TransactionReceipt(ctx, tx.Hash())
		if err == nil {
			if r.Status != 1 {
				t.Fatalf("tx %s reverted (status=%d)", tx.Hash().Hex(), r.Status)
			}
			return r
		}
		select {
		case <-ctx.Done():
			t.Fatalf("fsMine timeout for %s: %v", tx.Hash().Hex(), ctx.Err())
		case <-ticker.C:
		}
	}
}

func fsWaitTimestamp(t *testing.T, ctx context.Context, obs *ethclient.Client, target uint64, label string) {
	t.Helper()
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	t.Logf("Waiting for %s (target=%d)…", label, target)
	for {
		hdr, err := obs.HeaderByNumber(ctx, nil)
		if err == nil && hdr.Time >= target {
			t.Logf("Reached %s at block=%s time=%d", label, hdr.Number, hdr.Time)
			return
		}
		select {
		case <-ctx.Done():
			t.Fatalf("fsWaitTimestamp timeout for %s: %v", label, ctx.Err())
		case <-ticker.C:
			if err == nil {
				t.Logf("  waiting… current=%d target=%d remaining=%ds", hdr.Time, target, int64(target)-int64(hdr.Time))
			}
		}
	}
}

func fsWaitMatchTerminal(t *testing.T, ctx context.Context, sdk *oddfi.Client, matchID [32]byte) {
	t.Helper()
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for {
		ok, err := sdk.BettingPool().IsMatchTerminal(ctx, matchID)
		if err == nil && ok {
			t.Log("Match is terminal")
			return
		}
		select {
		case <-ctx.Done():
			t.Fatalf("fsWaitMatchTerminal timeout: %v", ctx.Err())
		case <-ticker.C:
		}
	}
}

func fsWaitLPWithdrawableOrNote(t *testing.T, ctx context.Context, sdk *oddfi.Client, posID *big.Int, timeout time.Duration) bool {
	t.Helper()
	deadline := time.Now().Add(timeout)
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	t.Logf("Polling LP position %s for Withdrawable state (max %v)…", posID, timeout)
	for time.Now().Before(deadline) {
		state, err := sdk.LiquidityPool().GetPositionState(ctx, posID)
		if err == nil {
			t.Logf("  LP state=%d (1=Unbonding, 5=Withdrawable)", state)
			if state == 5 {
				return true
			}
		}
		select {
		case <-ctx.Done():
			return false
		case <-ticker.C:
		}
	}
	t.Logf("LP position not yet Withdrawable after %v (unbond_epochs=2 requires 2 epoch transitions)", timeout)
	t.Logf("  Run TestE2EWithdrawOnly with ODDFI_LP_POSITION_ID=%s once epochs have elapsed", posID)
	return false
}

func fsEnvDuration(t *testing.T, key string, fallback time.Duration) time.Duration {
	t.Helper()
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		t.Fatalf("parse %s duration %q: %v", key, value, err)
	}
	if parsed < 0 {
		t.Fatalf("parse %s duration %q: negative duration", key, value)
	}
	return parsed
}

// ── computation helpers ───────────────────────────────────────────────────────

// fsMatchID builds a deterministic test match ID.
func fsMatchID(nowSec uint64) [32]byte {
	seed := fmt.Sprintf("e2e-match-%d", nowSec)
	return crypto.Keccak256Hash([]byte(seed))
}

// fsMarketID computes keccak256(abi.encode(matchId, marketType, line)).
func fsMarketID(matchID [32]byte, marketType uint8, line uint8) [32]byte {
	buf := make([]byte, 96)
	copy(buf[0:32], matchID[:])
	buf[63] = marketType
	buf[95] = line
	return crypto.Keccak256Hash(buf)
}

// fsParseBetID extracts betId from the BetPlaced event (topics[1]).
func fsParseBetID(t *testing.T, r *types.Receipt) [32]byte {
	t.Helper()
	topic0 := crypto.Keccak256Hash([]byte("BetPlaced(bytes32,bytes32,address,uint256,uint256,uint256,uint256,uint8)"))
	for _, log := range r.Logs {
		if len(log.Topics) >= 2 && log.Topics[0] == topic0 {
			return log.Topics[1]
		}
	}
	t.Log("Warning: BetPlaced event not found; betId=zero")
	return [32]byte{}
}

func deltaStr(after, before *big.Int) string {
	return new(big.Int).Sub(after, before).String()
}

func safeBI(v *big.Int) *big.Int {
	if v == nil {
		return new(big.Int)
	}
	return new(big.Int).Set(v)
}

func Example_fullScenarioCommand() {
	fmt.Println("ODDFI_FULL_E2E=1 ODDFI_PRIVATE_KEY=<redacted> ODDFI_RPC_URL=<url> go test ./pkg/oddfi -run TestE2EFullMatchScenario -count=1 -v -timeout 40m")
	// Output:
	// ODDFI_FULL_E2E=1 ODDFI_PRIVATE_KEY=<redacted> ODDFI_RPC_URL=<url> go test ./pkg/oddfi -run TestE2EFullMatchScenario -count=1 -v -timeout 40m
}
