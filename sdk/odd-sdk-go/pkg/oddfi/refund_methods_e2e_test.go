package oddfi_test

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"math/big"
	"os"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/pkg/oddfi"
)

func TestE2ENewBettingPoolWriteMethods(t *testing.T) {
	if os.Getenv("ODDFI_FULL_E2E") != "1" {
		t.Skip("set ODDFI_FULL_E2E=1 to run BettingPool update/refund write scenario")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 40*time.Minute)
	t.Cleanup(cancel)

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

	bpAddr := mustParseEnvAddress(t, "ODDFI_BETTING_POOL_PROXY")
	sdk, err := oddfi.NewClient(ctx, oddfi.Config{
		RPCURL:             rpcURL,
		ODDTokenProxy:      mustParseEnvAddress(t, "ODDFI_ODD_TOKEN_PROXY"),
		StakingPoolProxy:   mustParseEnvAddress(t, "ODDFI_STAKING_POOL_PROXY"),
		LiquidityPoolProxy: mustParseEnvAddress(t, "ODDFI_LIQUIDITY_POOL_PROXY"),
		BettingPoolProxy:   bpAddr,
	})
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	t.Cleanup(func() { _ = sdk.Close(ctx) })

	adminOpts := func() *bind.TransactOpts {
		opts, e := bind.NewKeyedTransactorWithChainID(adminKey, chainID)
		if e != nil {
			t.Fatalf("admin opts: %v", e)
		}
		opts.Context = ctx
		return opts
	}

	bettorKey, err := crypto.GenerateKey()
	if err != nil {
		t.Fatalf("generate bettor key: %v", err)
	}
	bettorAddr := crypto.PubkeyToAddress(bettorKey.PublicKey)
	bettorOpts := func() *bind.TransactOpts {
		opts, e := bind.NewKeyedTransactorWithChainID(bettorKey, chainID)
		if e != nil {
			t.Fatalf("bettor opts: %v", e)
		}
		opts.Context = ctx
		return opts
	}
	t.Logf("bettor_address (generated): %s", bettorAddr.Hex())

	operatorRole := crypto.Keccak256Hash([]byte("OPERATOR_ROLE"))
	settlerRole := crypto.Keccak256Hash([]byte("SETTLER_ROLE"))
	ensureRole(t, ctx, observer, sdk, adminOpts, adminAddr, operatorRole, "OPERATOR_ROLE")
	ensureRole(t, ctx, observer, sdk, adminOpts, adminAddr, settlerRole, "SETTLER_ROLE")

	one18 := new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)
	betAmount := new(big.Int).Mul(big.NewInt(100), one18)
	betApproval := new(big.Int).Add(betAmount, new(big.Int).Div(betAmount, big.NewInt(100)))
	bettorODDFund := new(big.Int).Mul(big.NewInt(250), one18)
	bettorBNBFund := new(big.Int).Mul(big.NewInt(3), new(big.Int).Exp(big.NewInt(10), big.NewInt(16), nil))

	fundBNB(t, ctx, observer, adminKey, chainID, adminAddr, bettorAddr, bettorBNBFund, "Setup.FundBettorBNB")
	tx, err := sdk.ODDToken().Transfer(adminOpts(), bettorAddr, bettorODDFund)
	if err != nil {
		t.Fatalf("fund bettor ODD: %v", err)
	}
	receipt := fsMine(t, ctx, observer, tx)
	t.Logf("Setup.FundBettorODD tx_hash=%s gas_used=%d amount=%s", tx.Hash().Hex(), receipt.GasUsed, bettorODDFund)

	now := uint64(time.Now().Unix())
	matchStartTime := now + 8*60
	matchEndTime := now + 9*60
	refundMatchID := newMethodsMatchID("refund-bets", now)
	cancelMatchID := newMethodsMatchID("cancel-refund", now)
	refundMarketID := fsMarketID(refundMatchID, 0, 0)
	cancelMarketID := fsMarketID(cancelMatchID, 1, 1)

	t.Logf("refund_match_id=%x refund_market_id=%x", refundMatchID, refundMarketID)
	t.Logf("cancel_match_id=%x cancel_market_id=%x", cancelMatchID, cancelMarketID)
	t.Logf("match_start_time=%d lock_at=%d match_end_time=%d", matchStartTime, matchStartTime-300, matchEndTime)

	openMarket(t, ctx, observer, sdk, adminOpts, adminAddr, bpAddr, refundMatchID, 0, 0, matchStartTime, matchEndTime, []*big.Int{big.NewInt(20000), big.NewInt(30000), big.NewInt(20000)}, "Step1.OpenRefundMarket")
	openMarket(t, ctx, observer, sdk, adminOpts, adminAddr, bpAddr, cancelMatchID, 1, 1, matchStartTime, matchEndTime, []*big.Int{big.NewInt(20000), big.NewInt(20000)}, "Step1.OpenCancelMarket")

	t.Log("=== Step 2: UpdateOdds ===")
	{
		b := fsReadBP(t, ctx, observer, sdk, adminAddr, bpAddr)
		tx, err := sdk.BettingPool().UpdateOdds(adminOpts(), refundMarketID, []*big.Int{big.NewInt(21000), big.NewInt(29000), big.NewInt(21000)}, uint64(time.Now().Unix()))
		if err != nil {
			t.Fatalf("UpdateOdds: %v", err)
		}
		receipt := fsMine(t, ctx, observer, tx)
		a := fsReadBP(t, ctx, observer, sdk, adminAddr, bpAddr)
		fsLogBP(t, "Step2.UpdateOdds", tx, receipt, b, a)
		odds, err := sdk.BettingPool().GetMarketOdds(ctx, refundMarketID)
		if err != nil {
			t.Fatalf("GetMarketOdds after update: %v", err)
		}
		t.Logf("  quote_version=%s base_odds=%v quoted_odds=%v updated_at=%d", odds.QuoteVersion, odds.BaseOdds, odds.QuotedOdds, odds.UpdatedAt)
	}

	t.Log("=== Step 3: Place refundable bets ===")
	refundBetID := placeRefundScenarioBet(t, ctx, observer, sdk, bettorOpts, bettorAddr, bpAddr, refundMarketID, betAmount, betApproval, "Step3.RefundBetsMarket")
	cancelBetID := placeRefundScenarioBet(t, ctx, observer, sdk, bettorOpts, bettorAddr, bpAddr, cancelMarketID, betAmount, betApproval, "Step3.CancelMarket")

	t.Logf("=== Waiting for matchEndTime=%d ===", matchEndTime)
	fsWaitTimestamp(t, ctx, observer, matchEndTime+2, "matchEndTime")

	t.Log("=== Step 4: Settle refundBets market as refunded ===")
	finalizeMarket(t, ctx, observer, sdk, adminOpts, adminAddr, bpAddr, refundMarketID, 1, "Step4.FinalizeRefundBetsMarket")

	t.Log("=== Step 5: RefundBets ===")
	{
		b := fsReadBP(t, ctx, observer, sdk, bettorAddr, bpAddr)
		tx, err := sdk.BettingPool().RefundBets(adminOpts(), refundMarketID, [][32]byte{refundBetID}, []*big.Int{betAmount})
		if err != nil {
			t.Fatalf("RefundBets: %v", err)
		}
		receipt := fsMine(t, ctx, observer, tx)
		a := fsReadBP(t, ctx, observer, sdk, bettorAddr, bpAddr)
		fsLogBP(t, "Step5.RefundBets", tx, receipt, b, a)
		bet, err := sdk.BettingPool().GetBet(ctx, refundBetID)
		if err != nil {
			t.Fatalf("GetBet after RefundBets: %v", err)
		}
		t.Logf("  bet_id=%x settlement_state=%d refunded_amount=%s", refundBetID, bet.SettlementState, bet.RefundedAmount)
	}

	t.Log("=== Step 6: Finalize cancelled market and RefundBets ===")
	{
		b := fsReadBP(t, ctx, observer, sdk, bettorAddr, bpAddr)
		tx, err := sdk.BettingPool().FinalizeMarketSettlement(adminOpts(), cancelMarketID, 2)
		if err != nil {
			t.Fatalf("FinalizeMarketSettlement cancelled: %v", err)
		}
		receipt := fsMine(t, ctx, observer, tx)
		mid := fsReadBP(t, ctx, observer, sdk, bettorAddr, bpAddr)
		fsLogBP(t, "Step6.FinalizeCancelMarket", tx, receipt, b, mid)

		tx, err = sdk.BettingPool().RefundBets(adminOpts(), cancelMarketID, [][32]byte{cancelBetID}, []*big.Int{betAmount})
		if err != nil {
			t.Fatalf("RefundBets cancelled: %v", err)
		}
		receipt = fsMine(t, ctx, observer, tx)
		a := fsReadBP(t, ctx, observer, sdk, bettorAddr, bpAddr)
		fsLogBP(t, "Step6.RefundCancelledBet", tx, receipt, mid, a)
		bet, err := sdk.BettingPool().GetBet(ctx, cancelBetID)
		if err != nil {
			t.Fatalf("GetBet after cancelled RefundBets: %v", err)
		}
		t.Logf("  bet_id=%x settlement_state=%d refunded_amount=%s", cancelBetID, bet.SettlementState, bet.RefundedAmount)
		market, err := sdk.BettingPool().GetMarket(ctx, cancelMarketID)
		if err != nil {
			t.Fatalf("GetMarket after cancelled RefundBets: %v", err)
		}
		t.Logf("  market_id=%x status=%d(4=Cancelled)", cancelMarketID, market.Status)
	}

	t.Log("=== New BettingPool write methods scenario complete ===")
}

func ensureRole(t *testing.T, ctx context.Context, observer *ethclient.Client, sdk *oddfi.Client, adminOpts func() *bind.TransactOpts, adminAddr common.Address, role [32]byte, label string) {
	t.Helper()
	hasRole, err := sdk.BettingPool().HasRole(ctx, role, adminAddr)
	if err != nil {
		t.Fatalf("HasRole %s: %v", label, err)
	}
	if hasRole {
		t.Logf("admin already has %s", label)
		return
	}
	tx, err := sdk.BettingPool().GrantRole(adminOpts(), role, adminAddr)
	if err != nil {
		t.Fatalf("grant %s: %v", label, err)
	}
	receipt := fsMine(t, ctx, observer, tx)
	t.Logf("Grant%s tx_hash=%s gas_used=%d", label, tx.Hash().Hex(), receipt.GasUsed)
}

func fundBNB(t *testing.T, ctx context.Context, observer *ethclient.Client, adminKey *ecdsa.PrivateKey, chainID *big.Int, from common.Address, to common.Address, amount *big.Int, label string) {
	t.Helper()
	nonce, err := observer.PendingNonceAt(ctx, from)
	if err != nil {
		t.Fatalf("%s nonce: %v", label, err)
	}
	gasPrice, err := observer.SuggestGasPrice(ctx)
	if err != nil {
		t.Fatalf("%s gas price: %v", label, err)
	}
	rawTx := types.NewTx(&types.LegacyTx{
		Nonce:    nonce,
		To:       &to,
		Value:    amount,
		Gas:      21000,
		GasPrice: gasPrice,
	})
	signed, err := types.SignTx(rawTx, types.NewEIP155Signer(chainID), adminKey)
	if err != nil {
		t.Fatalf("%s sign: %v", label, err)
	}
	if err := observer.SendTransaction(ctx, signed); err != nil {
		t.Fatalf("%s send: %v", label, err)
	}
	receipt := fsMine(t, ctx, observer, signed)
	t.Logf("%s tx_hash=%s gas_used=%d amount=%s", label, signed.Hash().Hex(), receipt.GasUsed, amount)
}

func openMarket(t *testing.T, ctx context.Context, observer *ethclient.Client, sdk *oddfi.Client, adminOpts func() *bind.TransactOpts, adminAddr common.Address, bpAddr common.Address, matchID [32]byte, marketType uint8, line uint8, matchStartTime uint64, matchEndTime uint64, baseOdds []*big.Int, label string) {
	t.Helper()
	b := fsReadBP(t, ctx, observer, sdk, adminAddr, bpAddr)
	tx, err := sdk.BettingPool().OpenMarket(adminOpts(), matchID, marketType, line, matchStartTime, matchEndTime, baseOdds, uint64(time.Now().Unix()))
	if err != nil {
		t.Fatalf("%s: %v", label, err)
	}
	receipt := fsMine(t, ctx, observer, tx)
	a := fsReadBP(t, ctx, observer, sdk, adminAddr, bpAddr)
	fsLogBP(t, label, tx, receipt, b, a)
}

func placeRefundScenarioBet(t *testing.T, ctx context.Context, observer *ethclient.Client, sdk *oddfi.Client, bettorOpts func() *bind.TransactOpts, bettorAddr common.Address, bpAddr common.Address, marketID [32]byte, betAmount *big.Int, betApproval *big.Int, label string) [32]byte {
	t.Helper()
	appTx, err := sdk.ODDToken().Approve(bettorOpts(), bpAddr, betApproval)
	if err != nil {
		t.Fatalf("%s approve: %v", label, err)
	}
	appR := fsMine(t, ctx, observer, appTx)
	t.Logf("%s.Approve tx_hash=%s gas_used=%d amount=%s", label, appTx.Hash().Hex(), appR.GasUsed, betApproval)

	odds, err := sdk.BettingPool().GetMarketOdds(ctx, marketID)
	if err != nil {
		t.Fatalf("%s GetMarketOdds: %v", label, err)
	}
	guard := oddfi.QuoteGuardInput{
		QuoteVersion:      odds.QuoteVersion,
		QuotedAt:          odds.UpdatedAt,
		MinOdds:           big.NewInt(10100),
		MinAcceptedAmount: big.NewInt(1),
		Deadline:          big.NewInt(time.Now().Add(15 * time.Minute).Unix()),
	}
	b := fsReadBP(t, ctx, observer, sdk, bettorAddr, bpAddr)
	tx, err := sdk.BettingPool().PlaceBet(bettorOpts(), marketID, 0, betAmount, guard)
	if err != nil {
		t.Fatalf("%s PlaceBet: %v", label, err)
	}
	receipt := fsMine(t, ctx, observer, tx)
	a := fsReadBP(t, ctx, observer, sdk, bettorAddr, bpAddr)
	fsLogBP(t, label+".PlaceBet", tx, receipt, b, a)
	betID := fsParseBetID(t, receipt)
	t.Logf("  bet_id=%x market_id=%x amount=%s", betID, marketID, betAmount)
	return betID
}

func finalizeMarket(t *testing.T, ctx context.Context, observer *ethclient.Client, sdk *oddfi.Client, adminOpts func() *bind.TransactOpts, adminAddr common.Address, bpAddr common.Address, marketID [32]byte, resultKindRaw uint8, label string) {
	t.Helper()
	b := fsReadBP(t, ctx, observer, sdk, adminAddr, bpAddr)
	tx, err := sdk.BettingPool().FinalizeMarketSettlement(adminOpts(), marketID, resultKindRaw)
	if err != nil {
		t.Fatalf("%s: %v", label, err)
	}
	receipt := fsMine(t, ctx, observer, tx)
	a := fsReadBP(t, ctx, observer, sdk, adminAddr, bpAddr)
	fsLogBP(t, label, tx, receipt, b, a)
	market, err := sdk.BettingPool().GetMarket(ctx, marketID)
	if err != nil {
		t.Fatalf("%s GetMarket: %v", label, err)
	}
	t.Logf("  market_id=%x status=%d result_kind=%d", marketID, market.Status, resultKindRaw)
}

func newMethodsMatchID(label string, nowSec uint64) [32]byte {
	return crypto.Keccak256Hash([]byte(fmt.Sprintf("new-methods-%s-%d", label, nowSec)))
}
