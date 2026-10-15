package contracts

import (
	"context"
	"errors"
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/common"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/bindings/bettingpool"
	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/bindings/liquiditypool"
	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/bindings/stakingpool"
	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/chain"
)

func TestStakingPoolAdapterReadMethods(t *testing.T) {
	t.Parallel()

	contractABI, err := stakingpool.StakingPoolMetaData.GetAbi()
	if err != nil {
		t.Fatalf("parse abi: %v", err)
	}
	oddToken := common.HexToAddress("0x5530dA4357803bD0ed806a999a1f1fcc3c45Dc8C")
	bettingPool := common.HexToAddress("0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F")
	treasury := common.HexToAddress("0x0000000000000000000000000000000000001234")
	backend := &fakeCaller{
		code: []byte{0x01},
		responses: map[string][]byte{
			methodID(t, contractABI, "oddToken"):            packOutput(t, contractABI, "oddToken", oddToken),
			methodID(t, contractABI, "bettingPool"):         packOutput(t, contractABI, "bettingPool", bettingPool),
			methodID(t, contractABI, "platformTreasury"):    packOutput(t, contractABI, "platformTreasury", treasury),
			methodID(t, contractABI, "paused"):              packOutput(t, contractABI, "paused", true),
			methodID(t, contractABI, "minStakeAmount"):      packOutput(t, contractABI, "minStakeAmount", big.NewInt(10)),
			methodID(t, contractABI, "totalWeightedShares"): packOutput(t, contractABI, "totalWeightedShares", big.NewInt(20)),
			methodID(t, contractABI, "accountedOddBalance"): packOutput(t, contractABI, "accountedOddBalance", big.NewInt(30)),
			methodID(t, contractABI, "nextPositionId"):      packOutput(t, contractABI, "nextPositionId", big.NewInt(40)),
		},
	}
	adapter, err := NewStakingPoolAdapter(backend, nil, common.HexToAddress("0x65fd4A2529010693BA474d1993631e305a42E061"))
	if err != nil {
		t.Fatalf("new adapter: %v", err)
	}

	ctx := context.Background()
	assertAddress(t, "OddToken", adapter.OddToken, oddToken)
	assertAddress(t, "BettingPool", adapter.BettingPool, bettingPool)
	assertAddress(t, "PlatformTreasury", adapter.PlatformTreasury, treasury)
	if got, err := adapter.Paused(ctx); err != nil || !got {
		t.Fatalf("Paused() = %v, %v", got, err)
	}
	assertBigInt(t, "MinStakeAmount", func() (*big.Int, error) { return adapter.MinStakeAmount(ctx) }, "10")
	assertBigInt(t, "TotalWeightedShares", func() (*big.Int, error) { return adapter.TotalWeightedShares(ctx) }, "20")
	assertBigInt(t, "AccountedOddBalance", func() (*big.Int, error) { return adapter.AccountedOddBalance(ctx) }, "30")
	assertBigInt(t, "NextPositionID", func() (*big.Int, error) { return adapter.NextPositionID(ctx) }, "40")
}

func TestLiquidityPoolAdapterReadMethods(t *testing.T) {
	t.Parallel()

	contractABI, err := liquiditypool.LiquidityPoolMetaData.GetAbi()
	if err != nil {
		t.Fatalf("parse abi: %v", err)
	}
	oddToken := common.HexToAddress("0x5530dA4357803bD0ed806a999a1f1fcc3c45Dc8C")
	bettingPool := common.HexToAddress("0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F")
	backend := &fakeCaller{
		code: []byte{0x01},
		responses: map[string][]byte{
			methodID(t, contractABI, "oddToken"):                       packOutput(t, contractABI, "oddToken", oddToken),
			methodID(t, contractABI, "bettingPool"):                    packOutput(t, contractABI, "bettingPool", bettingPool),
			methodID(t, contractABI, "paused"):                         packOutput(t, contractABI, "paused", false),
			methodID(t, contractABI, "minDeposit"):                     packOutput(t, contractABI, "minDeposit", big.NewInt(11)),
			methodID(t, contractABI, "requestableLiquidity"):           packOutput(t, contractABI, "requestableLiquidity", big.NewInt(22)),
			methodID(t, contractABI, "totalActiveDeposited"):           packOutput(t, contractABI, "totalActiveDeposited", big.NewInt(33)),
			methodID(t, contractABI, "totalOutstandingPayoutReserved"): packOutput(t, contractABI, "totalOutstandingPayoutReserved", big.NewInt(44)),
			methodID(t, contractABI, "getPayoutLiquidityWindow"):       packOutputs(t, contractABI, "getPayoutLiquidityWindow", big.NewInt(55), big.NewInt(66), big.NewInt(77)),
			methodID(t, contractABI, "previewWithdraw"):                packOutputs(t, contractABI, "previewWithdraw", big.NewInt(88), big.NewInt(-9), uint8(5)),
			methodID(t, contractABI, "unbondEpochs"):                   packOutput(t, contractABI, "unbondEpochs", uint32(3)),
		},
	}
	adapter, err := NewLiquidityPoolAdapter(backend, nil, common.HexToAddress("0xdf0c59B387DfDf9f18969880DDCF1216BFEe318f"))
	if err != nil {
		t.Fatalf("new adapter: %v", err)
	}

	ctx := context.Background()
	assertAddress(t, "OddToken", adapter.OddToken, oddToken)
	assertAddress(t, "BettingPool", adapter.BettingPool, bettingPool)
	if got, err := adapter.Paused(ctx); err != nil || got {
		t.Fatalf("Paused() = %v, %v", got, err)
	}
	assertBigInt(t, "MinDeposit", func() (*big.Int, error) { return adapter.MinDeposit(ctx) }, "11")
	assertBigInt(t, "RequestableLiquidity", func() (*big.Int, error) { return adapter.RequestableLiquidity(ctx) }, "22")
	assertBigInt(t, "TotalActiveDeposited", func() (*big.Int, error) { return adapter.TotalActiveDeposited(ctx) }, "33")
	assertBigInt(t, "TotalOutstandingPayoutReserved", func() (*big.Int, error) {
		return adapter.TotalOutstandingPayoutReserved(ctx)
	}, "44")
	reserved, paidOut, settledAt, err := adapter.PayoutLiquidityWindow(ctx, [32]byte{0x01})
	if err != nil {
		t.Fatalf("PayoutLiquidityWindow(): %v", err)
	}
	if reserved.String() != "55" || paidOut.String() != "66" || settledAt.String() != "77" {
		t.Fatalf("PayoutLiquidityWindow() = reserved %s paidOut %s settledAt %s", reserved, paidOut, settledAt)
	}
	withdrawAmount, netPnL, effectiveState, err := adapter.PreviewWithdraw(ctx, big.NewInt(1))
	if err != nil {
		t.Fatalf("PreviewWithdraw(): %v", err)
	}
	if withdrawAmount.String() != "88" || netPnL.String() != "-9" || effectiveState != 5 {
		t.Fatalf("PreviewWithdraw() = amount %s netPnL %s state %d", withdrawAmount, netPnL, effectiveState)
	}
	if got, err := adapter.UnbondEpochs(ctx); err != nil || got != 3 {
		t.Fatalf("UnbondEpochs() = %d, %v", got, err)
	}
}

func TestBettingPoolAdapterReadMethods(t *testing.T) {
	t.Parallel()

	contractABI, err := bettingpool.BettingPoolMetaData.GetAbi()
	if err != nil {
		t.Fatalf("parse abi: %v", err)
	}
	oddToken := common.HexToAddress("0x5530dA4357803bD0ed806a999a1f1fcc3c45Dc8C")
	stakingPool := common.HexToAddress("0x65fd4A2529010693BA474d1993631e305a42E061")
	liquidityPool := common.HexToAddress("0xdf0c59B387DfDf9f18969880DDCF1216BFEe318f")
	treasury := common.HexToAddress("0x0000000000000000000000000000000000005678")
	backend := &fakeCaller{
		code: []byte{0x01},
		responses: map[string][]byte{
			methodID(t, contractABI, "oddToken"):         packOutput(t, contractABI, "oddToken", oddToken),
			methodID(t, contractABI, "stakingPool"):      packOutput(t, contractABI, "stakingPool", stakingPool),
			methodID(t, contractABI, "liquidityPool"):    packOutput(t, contractABI, "liquidityPool", liquidityPool),
			methodID(t, contractABI, "platformTreasury"): packOutput(t, contractABI, "platformTreasury", treasury),
			methodID(t, contractABI, "paused"):           packOutput(t, contractABI, "paused", false),
			methodID(t, contractABI, "betTaxBps"):        packOutput(t, contractABI, "betTaxBps", uint16(100)),
			methodID(t, contractABI, "payoutTaxBps"):     packOutput(t, contractABI, "payoutTaxBps", uint16(200)),
			methodID(t, contractABI, "platformReserve"):  packOutput(t, contractABI, "platformReserve", big.NewInt(55)),
			methodID(t, contractABI, "accountedBalance"): packOutput(t, contractABI, "accountedBalance", big.NewInt(66)),
			methodID(t, contractABI, "getMarketExposure"): packOutputs(
				t,
				contractABI,
				"getMarketExposure",
				[]*big.Int{big.NewInt(100), big.NewInt(200)},
				[]*big.Int{big.NewInt(300), big.NewInt(400)},
				uint8(2),
			),
		},
	}
	adapter, err := NewBettingPoolAdapter(backend, nil, common.HexToAddress("0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F"))
	if err != nil {
		t.Fatalf("new adapter: %v", err)
	}

	ctx := context.Background()
	assertAddress(t, "OddToken", adapter.OddToken, oddToken)
	assertAddress(t, "StakingPool", adapter.StakingPool, stakingPool)
	assertAddress(t, "LiquidityPool", adapter.LiquidityPool, liquidityPool)
	assertAddress(t, "PlatformTreasury", adapter.PlatformTreasury, treasury)
	if got, err := adapter.Paused(ctx); err != nil || got {
		t.Fatalf("Paused() = %v, %v", got, err)
	}
	if got, err := adapter.BetTaxBps(ctx); err != nil || got != 100 {
		t.Fatalf("BetTaxBps() = %d, %v", got, err)
	}
	if got, err := adapter.PayoutTaxBps(ctx); err != nil || got != 200 {
		t.Fatalf("PayoutTaxBps() = %d, %v", got, err)
	}
	assertBigInt(t, "PlatformReserve", func() (*big.Int, error) { return adapter.PlatformReserve(ctx) }, "55")
	assertBigInt(t, "AccountedBalance", func() (*big.Int, error) { return adapter.AccountedBalance(ctx) }, "66")
	staked, payouts, signalColor, err := adapter.GetMarketExposure(ctx, [32]byte{0x01})
	if err != nil {
		t.Fatalf("GetMarketExposure(): %v", err)
	}
	if len(staked) != 2 || staked[0].String() != "100" || staked[1].String() != "200" {
		t.Fatalf("GetMarketExposure() staked = %v", staked)
	}
	if len(payouts) != 2 || payouts[0].String() != "300" || payouts[1].String() != "400" {
		t.Fatalf("GetMarketExposure() payouts = %v", payouts)
	}
	if signalColor != 2 {
		t.Fatalf("GetMarketExposure() signalColor = %d", signalColor)
	}
}

func TestBettingPoolAdapterWriteMethodsRequireTransactor(t *testing.T) {
	t.Parallel()

	contractABI, err := bettingpool.BettingPoolMetaData.GetAbi()
	if err != nil {
		t.Fatalf("parse abi: %v", err)
	}
	backend := &fakeCaller{
		code: []byte{0x01},
		responses: map[string][]byte{
			methodID(t, contractABI, "oddToken"): packOutput(t, contractABI, "oddToken", common.Address{}),
		},
	}
	adapter, err := NewBettingPoolAdapter(backend, nil, common.HexToAddress("0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F"))
	if err != nil {
		t.Fatalf("new adapter: %v", err)
	}
	marketID := [32]byte{0x01}
	betIDs := [][32]byte{{0x02}}

	if _, err := adapter.UpdateOdds(nil, marketID, []*big.Int{big.NewInt(20000), big.NewInt(30000), big.NewInt(20000)}, 1); !errors.Is(err, chain.ErrMissingRPCClient) {
		t.Fatalf("UpdateOdds missing transactor error = %v", err)
	}
	if _, err := adapter.LockMarket(nil, marketID); !errors.Is(err, chain.ErrMissingRPCClient) {
		t.Fatalf("LockMarket missing transactor error = %v", err)
	}
	if _, err := adapter.CashOut(nil, betIDs[0], big.NewInt(1), 1, big.NewInt(1), big.NewInt(2)); !errors.Is(err, chain.ErrMissingRPCClient) {
		t.Fatalf("CashOut missing transactor error = %v", err)
	}
	parlayLegs := []BettingPoolParlayLegInput{{
		MarketID:     marketID,
		QuoteVersion: big.NewInt(1),
		MinOdds:      big.NewInt(10_000),
	}}
	if _, err := adapter.PlaceParlay(nil, parlayLegs, big.NewInt(1), big.NewInt(10_000), big.NewInt(2), common.Address{}); !errors.Is(err, chain.ErrMissingRPCClient) {
		t.Fatalf("PlaceParlay missing transactor error = %v", err)
	}
	if _, err := adapter.SettleMarketBetsByScore(nil, marketID, 2, 1, betIDs); !errors.Is(err, chain.ErrMissingRPCClient) {
		t.Fatalf("SettleMarketBetsByScore missing transactor error = %v", err)
	}
	if _, err := adapter.SettleParlay(nil, betIDs[0]); !errors.Is(err, chain.ErrMissingRPCClient) {
		t.Fatalf("SettleParlay missing transactor error = %v", err)
	}
	if _, err := adapter.FinalizeMarketSettlement(nil, marketID, 1); !errors.Is(err, chain.ErrMissingRPCClient) {
		t.Fatalf("FinalizeMarketSettlement missing transactor error = %v", err)
	}
	if _, err := adapter.RefundBets(nil, marketID, betIDs, []*big.Int{big.NewInt(1)}); !errors.Is(err, chain.ErrMissingRPCClient) {
		t.Fatalf("RefundBets missing transactor error = %v", err)
	}
	if _, err := adapter.ClaimParlayPayout(nil, betIDs[0]); !errors.Is(err, chain.ErrMissingRPCClient) {
		t.Fatalf("ClaimParlayPayout missing transactor error = %v", err)
	}
	if _, err := adapter.ReleasePayoutReserve(nil, marketID); !errors.Is(err, chain.ErrMissingRPCClient) {
		t.Fatalf("ReleasePayoutReserve missing transactor error = %v", err)
	}
}

func TestLiquidityPoolAdapterWriteMethodsRequireTransactor(t *testing.T) {
	t.Parallel()

	contractABI, err := liquiditypool.LiquidityPoolMetaData.GetAbi()
	if err != nil {
		t.Fatalf("parse abi: %v", err)
	}
	backend := &fakeCaller{
		code: []byte{0x01},
		responses: map[string][]byte{
			methodID(t, contractABI, "oddToken"): packOutput(t, contractABI, "oddToken", common.Address{}),
		},
	}
	adapter, err := NewLiquidityPoolAdapter(backend, nil, common.HexToAddress("0xdf0c59B387DfDf9f18969880DDCF1216BFEe318f"))
	if err != nil {
		t.Fatalf("new adapter: %v", err)
	}
	riskID := [32]byte{0x01}

	if _, err := adapter.InitializeGlobalRequestableLiquidity(nil, big.NewInt(1)); !errors.Is(err, chain.ErrMissingRPCClient) {
		t.Fatalf("InitializeGlobalRequestableLiquidity missing transactor error = %v", err)
	}
	if _, err := adapter.DistributeGlobalLoss(nil, riskID, big.NewInt(1)); !errors.Is(err, chain.ErrMissingRPCClient) {
		t.Fatalf("DistributeGlobalLoss missing transactor error = %v", err)
	}
	if _, err := adapter.DistributeGlobalMargin(nil, riskID, big.NewInt(1)); !errors.Is(err, chain.ErrMissingRPCClient) {
		t.Fatalf("DistributeGlobalMargin missing transactor error = %v", err)
	}
	if _, err := adapter.ReleasePayoutReserve(nil, riskID); !errors.Is(err, chain.ErrMissingRPCClient) {
		t.Fatalf("ReleasePayoutReserve missing transactor error = %v", err)
	}
}

func assertAddress(t *testing.T, name string, fn func(context.Context) (common.Address, error), want common.Address) {
	t.Helper()
	got, err := fn(context.Background())
	if err != nil {
		t.Fatalf("%s(): %v", name, err)
	}
	if got != want {
		t.Fatalf("%s() = %s, want %s", name, got, want)
	}
}
