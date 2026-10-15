package oddfi_test

import (
	"context"
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

func TestE2ECashOutAndParlayScenario(t *testing.T) {
	if os.Getenv("ODDFI_FULL_E2E") != "1" {
		t.Skip("set ODDFI_FULL_E2E=1 to run cash out and parlay write scenario")
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

	lpAddr := mustParseEnvAddress(t, "ODDFI_LIQUIDITY_POOL_PROXY")
	bpAddr := mustParseEnvAddress(t, "ODDFI_BETTING_POOL_PROXY")
	lensAddr := mustParseEnvAddress(t, "ODDFI_BETTING_PARLAY_LENS")
	sdk, err := oddfi.NewClient(ctx, oddfi.Config{
		RPCURL:                    rpcURL,
		ODDTokenProxy:             mustParseEnvAddress(t, "ODDFI_ODD_TOKEN_PROXY"),
		StakingPoolProxy:          mustParseEnvAddress(t, "ODDFI_STAKING_POOL_PROXY"),
		LiquidityPoolProxy:        lpAddr,
		BettingPoolProxy:          bpAddr,
		BettingParlayLensContract: lensAddr,
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
	parlayStake := new(big.Int).Mul(big.NewInt(100), one18)
	betTax := new(big.Int).Div(betAmount, big.NewInt(100))
	betApproval := new(big.Int).Add(betAmount, betTax)
	bettorODDFund := new(big.Int).Mul(big.NewInt(500), one18)
	bettorBNBFund := new(big.Int).Mul(big.NewInt(3), new(big.Int).Exp(big.NewInt(10), big.NewInt(16), nil))
	globalLiquidity := new(big.Int).Mul(big.NewInt(1000), one18)
	platformReserve := new(big.Int).Mul(big.NewInt(500), one18)

	fundBNB(t, ctx, observer, adminKey, chainID, adminAddr, bettorAddr, bettorBNBFund, "Setup.FundBettorBNB")
	tx, err := sdk.ODDToken().Transfer(adminOpts(), bettorAddr, bettorODDFund)
	if err != nil {
		t.Fatalf("fund bettor ODD: %v", err)
	}
	receipt := fsMine(t, ctx, observer, tx)
	t.Logf("Setup.FundBettorODD tx_hash=%s gas_used=%d amount=%s", tx.Hash().Hex(), receipt.GasUsed, bettorODDFund)

	approveAndDepositGlobal(t, ctx, observer, sdk, adminOpts, adminAddr, lpAddr, globalLiquidity)
	approveAndAddPlatformReserve(t, ctx, observer, sdk, adminOpts, adminAddr, bpAddr, platformReserve)

	now := uint64(time.Now().Unix())
	matchStartTime := now + 10*60
	matchEndTime := now + 11*60
	cashOutMatchID := advancedMatchID("cash-out", now)
	parlayMatch1ID := advancedMatchID("parlay-leg-1", now)
	parlayMatch2ID := advancedMatchID("parlay-leg-2", now)
	cashOutMarketID := fsMarketID(cashOutMatchID, 0, 0)
	parlayMarket1ID := fsMarketID(parlayMatch1ID, 0, 0)
	parlayMarket2ID := fsMarketID(parlayMatch2ID, 0, 0)

	t.Logf("cashout_match_id=%x cashout_market_id=%x", cashOutMatchID, cashOutMarketID)
	t.Logf("parlay_match_1_id=%x parlay_market_1_id=%x", parlayMatch1ID, parlayMarket1ID)
	t.Logf("parlay_match_2_id=%x parlay_market_2_id=%x", parlayMatch2ID, parlayMarket2ID)
	t.Logf("match_start_time=%d lock_at=%d match_end_time=%d", matchStartTime, matchStartTime-300, matchEndTime)

	baseOdds := []*big.Int{big.NewInt(20000), big.NewInt(30000), big.NewInt(20000)}
	openMarket(t, ctx, observer, sdk, adminOpts, adminAddr, bpAddr, cashOutMatchID, 0, 0, matchStartTime, matchEndTime, baseOdds, "Step1.OpenCashOutMarket")
	openMarket(t, ctx, observer, sdk, adminOpts, adminAddr, bpAddr, parlayMatch1ID, 0, 0, matchStartTime, matchEndTime, baseOdds, "Step1.OpenParlayMarket1")
	openMarket(t, ctx, observer, sdk, adminOpts, adminAddr, bpAddr, parlayMatch2ID, 0, 0, matchStartTime, matchEndTime, baseOdds, "Step1.OpenParlayMarket2")

	t.Log("=== Step 2: CashOut before settlement ===")
	cashOutBetID := placeRefundScenarioBet(t, ctx, observer, sdk, bettorOpts, bettorAddr, bpAddr, cashOutMarketID, betAmount, betApproval, "Step2.CashOutMarket")
	odds, err := sdk.BettingPool().GetMarketOdds(ctx, cashOutMarketID)
	if err != nil {
		t.Fatalf("CashOut GetMarketOdds: %v", err)
	}
	before := fsReadBP(t, ctx, observer, sdk, bettorAddr, bpAddr)
	tx, err = sdk.BettingPool().CashOut(
		bettorOpts(),
		cashOutBetID,
		odds.QuoteVersion,
		odds.UpdatedAt,
		big.NewInt(1),
		big.NewInt(time.Now().Add(15*time.Minute).Unix()),
	)
	if err != nil {
		t.Fatalf("CashOut: %v", err)
	}
	receipt = fsMine(t, ctx, observer, tx)
	after := fsReadBP(t, ctx, observer, sdk, bettorAddr, bpAddr)
	fsLogBP(t, "Step2.CashOut", tx, receipt, before, after)
	cashOutBet, err := sdk.BettingPool().GetBet(ctx, cashOutBetID)
	if err != nil {
		t.Fatalf("GetBet after CashOut: %v", err)
	}
	if cashOutBet.SettlementState != 5 {
		t.Fatalf("cashout settlement_state=%d, want 5", cashOutBet.SettlementState)
	}
	t.Logf("  cashout_bet_id=%x settlement_state=%d(5=CashedOut)", cashOutBetID, cashOutBet.SettlementState)

	t.Log("=== Step 3: Preview and place parlay ===")
	parlayID := placeParlayScenario(t, ctx, observer, sdk, bettorOpts, bettorAddr, bpAddr, parlayMarket1ID, parlayMarket2ID, parlayStake, betApproval)
	parlay, err := sdk.BettingPool().GetParlay(ctx, parlayID)
	if err != nil {
		t.Fatalf("GetParlay after place: %v", err)
	}
	t.Logf("  parlay_id=%x state=%d leg_count=%d locked_combo_odds=%s max_payout=%s", parlayID, parlay.State, parlay.LegCount, parlay.LockedComboOdds, parlay.MaxPayout)

	t.Logf("=== Waiting for matchEndTime=%d ===", matchEndTime)
	fsWaitTimestamp(t, ctx, observer, matchEndTime+2, "matchEndTime")

	t.Log("=== Step 4: Score settle parlay markets ===")
	scoreSettleMarket(t, ctx, observer, sdk, adminOpts, adminAddr, bpAddr, parlayMarket1ID, nil, "Step4.SettleParlayMarket1")
	scoreSettleMarket(t, ctx, observer, sdk, adminOpts, adminAddr, bpAddr, parlayMarket2ID, nil, "Step4.SettleParlayMarket2")

	t.Log("=== Step 5: Settle and claim parlay ===")
	before = fsReadBP(t, ctx, observer, sdk, bettorAddr, bpAddr)
	tx, err = sdk.BettingPool().SettleParlay(adminOpts(), parlayID)
	if err != nil {
		t.Fatalf("SettleParlay: %v", err)
	}
	receipt = fsMine(t, ctx, observer, tx)
	mid := fsReadBP(t, ctx, observer, sdk, bettorAddr, bpAddr)
	fsLogBP(t, "Step5.SettleParlay", tx, receipt, before, mid)
	parlay, err = sdk.BettingPool().GetParlay(ctx, parlayID)
	if err != nil {
		t.Fatalf("GetParlay after settle: %v", err)
	}
	if parlay.State != 2 {
		t.Fatalf("parlay state after settle=%d, want 2", parlay.State)
	}
	t.Logf("  parlay_state=%d(2=WonUnclaimed) claimable_payout=%s", parlay.State, parlay.ClaimablePayout)

	tx, err = sdk.BettingPool().ClaimParlayPayout(bettorOpts(), parlayID)
	if err != nil {
		t.Fatalf("ClaimParlayPayout: %v", err)
	}
	receipt = fsMine(t, ctx, observer, tx)
	after = fsReadBP(t, ctx, observer, sdk, bettorAddr, bpAddr)
	fsLogBP(t, "Step5.ClaimParlayPayout", tx, receipt, mid, after)
	parlay, err = sdk.BettingPool().GetParlay(ctx, parlayID)
	if err != nil {
		t.Fatalf("GetParlay after claim: %v", err)
	}
	if parlay.State != 3 {
		t.Fatalf("parlay state after claim=%d, want 3", parlay.State)
	}
	t.Logf("  final_parlay_state=%d(3=WonClaimed)", parlay.State)

	t.Log("=== Cash out and parlay scenario complete ===")
}

func approveAndDepositGlobal(t *testing.T, ctx context.Context, observer *ethclient.Client, sdk *oddfi.Client, adminOpts func() *bind.TransactOpts, adminAddr common.Address, lpAddr common.Address, amount *big.Int) {
	t.Helper()
	tx, err := sdk.ODDToken().Approve(adminOpts(), lpAddr, amount)
	if err != nil {
		t.Fatalf("approve global LP: %v", err)
	}
	receipt := fsMine(t, ctx, observer, tx)
	t.Logf("Setup.ApproveGlobalLP tx_hash=%s gas_used=%d amount=%s", tx.Hash().Hex(), receipt.GasUsed, amount)

	before := fsReadLP(t, ctx, observer, sdk, adminAddr, lpAddr)
	tx, err = sdk.LiquidityPool().DepositGlobal(adminOpts(), amount, 0)
	if err != nil {
		t.Fatalf("DepositGlobal: %v", err)
	}
	receipt = fsMine(t, ctx, observer, tx)
	after := fsReadLP(t, ctx, observer, sdk, adminAddr, lpAddr)
	fsLogLP(t, "Setup.DepositGlobal", tx, receipt, before, after)
}

func approveAndAddPlatformReserve(t *testing.T, ctx context.Context, observer *ethclient.Client, sdk *oddfi.Client, adminOpts func() *bind.TransactOpts, adminAddr common.Address, bpAddr common.Address, amount *big.Int) {
	t.Helper()
	tx, err := sdk.ODDToken().Approve(adminOpts(), bpAddr, amount)
	if err != nil {
		t.Fatalf("approve platform reserve: %v", err)
	}
	receipt := fsMine(t, ctx, observer, tx)
	t.Logf("Setup.ApprovePlatformReserve tx_hash=%s gas_used=%d amount=%s", tx.Hash().Hex(), receipt.GasUsed, amount)

	before := fsReadBP(t, ctx, observer, sdk, adminAddr, bpAddr)
	tx, err = sdk.BettingPool().AddPlatformReserve(adminOpts(), amount)
	if err != nil {
		t.Fatalf("AddPlatformReserve: %v", err)
	}
	receipt = fsMine(t, ctx, observer, tx)
	after := fsReadBP(t, ctx, observer, sdk, adminAddr, bpAddr)
	fsLogBP(t, "Setup.AddPlatformReserve", tx, receipt, before, after)
}

func placeParlayScenario(
	t *testing.T,
	ctx context.Context,
	observer *ethclient.Client,
	sdk *oddfi.Client,
	bettorOpts func() *bind.TransactOpts,
	bettorAddr common.Address,
	bpAddr common.Address,
	market1ID [32]byte,
	market2ID [32]byte,
	stake *big.Int,
	approval *big.Int,
) [32]byte {
	t.Helper()
	odds1, err := sdk.BettingPool().GetMarketOdds(ctx, market1ID)
	if err != nil {
		t.Fatalf("Parlay GetMarketOdds leg 1: %v", err)
	}
	odds2, err := sdk.BettingPool().GetMarketOdds(ctx, market2ID)
	if err != nil {
		t.Fatalf("Parlay GetMarketOdds leg 2: %v", err)
	}
	legs := []oddfi.ParlayLegInput{
		{
			MarketID:     market1ID,
			Outcome:      0,
			QuoteVersion: odds1.QuoteVersion,
			QuotedAt:     odds1.UpdatedAt,
			MinOdds:      big.NewInt(10100),
		},
		{
			MarketID:     market2ID,
			Outcome:      0,
			QuoteVersion: odds2.QuoteVersion,
			QuotedAt:     odds2.UpdatedAt,
			MinOdds:      big.NewInt(10100),
		},
	}
	preview, err := sdk.BettingParlayLens().PreviewParlay(ctx, bpAddr, legs, stake, bettorAddr)
	if err != nil {
		t.Fatalf("PreviewParlay: %v", err)
	}
	t.Logf("Step3.PreviewParlay raw_combo_odds=%s locked_combo_odds=%s max_payout=%s available_capacity=%s capped_by_odds=%v capped_by_payout=%v",
		preview.RawComboOdds, preview.LockedComboOdds, preview.MaxPayout, preview.AvailableParlayCapacity, preview.CappedByOdds, preview.CappedByPayout)

	tx, err := sdk.ODDToken().Approve(bettorOpts(), bpAddr, approval)
	if err != nil {
		t.Fatalf("Parlay approve: %v", err)
	}
	receipt := fsMine(t, ctx, observer, tx)
	t.Logf("Step3.ParlayApprove tx_hash=%s gas_used=%d amount=%s", tx.Hash().Hex(), receipt.GasUsed, approval)

	before := fsReadBP(t, ctx, observer, sdk, bettorAddr, bpAddr)
	tx, err = sdk.BettingPool().PlaceParlay(
		bettorOpts(),
		legs,
		stake,
		big.NewInt(10100),
		big.NewInt(time.Now().Add(15*time.Minute).Unix()),
		common.Address{},
	)
	if err != nil {
		t.Fatalf("PlaceParlay: %v", err)
	}
	receipt = fsMine(t, ctx, observer, tx)
	after := fsReadBP(t, ctx, observer, sdk, bettorAddr, bpAddr)
	fsLogBP(t, "Step3.PlaceParlay", tx, receipt, before, after)
	parlayID := parseParlayID(t, receipt)
	if parlayID == ([32]byte{}) {
		t.Fatalf("ParlayPlaced event not found")
	}
	return parlayID
}

func scoreSettleMarket(t *testing.T, ctx context.Context, observer *ethclient.Client, sdk *oddfi.Client, adminOpts func() *bind.TransactOpts, adminAddr common.Address, bpAddr common.Address, marketID [32]byte, betIDs [][32]byte, label string) {
	t.Helper()
	before := fsReadBP(t, ctx, observer, sdk, adminAddr, bpAddr)
	tx, err := sdk.BettingPool().SettleMarketBetsByScore(adminOpts(), marketID, 2, 1, betIDs)
	if err != nil {
		t.Fatalf("%s SettleMarketBetsByScore: %v", label, err)
	}
	receipt := fsMine(t, ctx, observer, tx)
	mid := fsReadBP(t, ctx, observer, sdk, adminAddr, bpAddr)
	fsLogBP(t, label+".SettleMarketBetsByScore", tx, receipt, before, mid)

	tx, err = sdk.BettingPool().FinalizeMarketSettlement(adminOpts(), marketID, 0)
	if err != nil {
		t.Fatalf("%s FinalizeMarketSettlement: %v", label, err)
	}
	receipt = fsMine(t, ctx, observer, tx)
	after := fsReadBP(t, ctx, observer, sdk, adminAddr, bpAddr)
	fsLogBP(t, label+".FinalizeMarketSettlement", tx, receipt, mid, after)
	finalResult, err := sdk.BettingPool().MarketFinalResult(ctx, marketID)
	if err != nil {
		t.Fatalf("%s MarketFinalResult: %v", label, err)
	}
	t.Logf("  market_id=%x finalized=%v result_kind=%d score_settled=%v score=%d-%d", marketID, finalResult.Finalized, finalResult.ResultKind, finalResult.ScoreSettled, finalResult.HomeScore, finalResult.AwayScore)
}

func parseParlayID(t *testing.T, receipt *types.Receipt) [32]byte {
	t.Helper()
	topic0 := crypto.Keccak256Hash([]byte("ParlayPlaced(bytes32,address,uint256,uint256,uint256,uint8,uint256,uint256,bytes32)"))
	for _, log := range receipt.Logs {
		if len(log.Topics) >= 2 && log.Topics[0] == topic0 {
			return log.Topics[1]
		}
	}
	return [32]byte{}
}

func advancedMatchID(label string, nowSec uint64) [32]byte {
	return crypto.Keccak256Hash([]byte(fmt.Sprintf("advanced-scenario-%s-%d", label, nowSec)))
}

func Example_advancedScenarioCommand() {
	fmt.Println("ODDFI_FULL_E2E=1 ODDFI_PRIVATE_KEY=<redacted> ODDFI_RPC_URL=<url> ODDFI_BETTING_PARLAY_LENS=<addr> go test ./pkg/oddfi -run TestE2ECashOutAndParlayScenario -count=1 -v -timeout 45m")
	// Output:
	// ODDFI_FULL_E2E=1 ODDFI_PRIVATE_KEY=<redacted> ODDFI_RPC_URL=<url> ODDFI_BETTING_PARLAY_LENS=<addr> go test ./pkg/oddfi -run TestE2ECashOutAndParlayScenario -count=1 -v -timeout 45m
}
