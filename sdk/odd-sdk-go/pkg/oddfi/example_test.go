package oddfi_test

import (
	"context"
	"encoding/hex"
	"fmt"
	"math/big"
	"os"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/pkg/oddfi"
)

func ExampleParseAddress() {
	address, err := oddfi.ParseAddress("0x52908400098527886E0F7030069857D2E4169EE7")
	if err != nil {
		return
	}
	fmt.Println(address.String())
	// Output:
	// 0x52908400098527886E0F7030069857D2E4169EE7
}

func ExampleNewClient() {
	ctx := context.Background()
	rpcURL := os.Getenv("ODDFI_RPC_URL")
	client, err := oddfi.NewClient(ctx, oddfi.Config{
		RPCURL:             rpcURL,
		ODDTokenProxy:      oddfi.MustParseAddress("0x5530dA4357803bD0ed806a999a1f1fcc3c45Dc8C"),
		StakingPoolProxy:   oddfi.MustParseAddress("0x65fd4A2529010693BA474d1993631e305a42E061"),
		LiquidityPoolProxy: oddfi.MustParseAddress("0xdf0c59B387DfDf9f18969880DDCF1216BFEe318f"),
		BettingPoolProxy:   oddfi.MustParseAddress("0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F"),
	})
	if err != nil {
		return
	}
	defer func() {
		_ = client.Close(ctx)
	}()

	name, err := client.ODDToken().Name(ctx)
	if err != nil {
		return
	}
	fmt.Println(name)
}

func ExampleBettingPool_PlaceBetCalldata() {
	ctx := context.Background()
	rpcURL := os.Getenv("ODDFI_RPC_URL")
	client, err := oddfi.NewClient(ctx, oddfi.Config{
		RPCURL:             rpcURL,
		ODDTokenProxy:      oddfi.MustParseAddress("0x5530dA4357803bD0ed806a999a1f1fcc3c45Dc8C"),
		StakingPoolProxy:   oddfi.MustParseAddress("0x65fd4A2529010693BA474d1993631e305a42E061"),
		LiquidityPoolProxy: oddfi.MustParseAddress("0xdf0c59B387DfDf9f18969880DDCF1216BFEe318f"),
		BettingPoolProxy:   oddfi.MustParseAddress("0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F"),
	})
	if err != nil {
		return
	}
	defer func() { _ = client.Close(ctx) }()

	guard := oddfi.QuoteGuardInput{
		QuoteVersion:      big.NewInt(1),
		QuotedAt:          1_700_000_000,
		MinOdds:           big.NewInt(18_180),
		MinAcceptedAmount: big.NewInt(100_000_000),
		Deadline:          big.NewInt(1_700_000_300),
	}
	data, err := client.BettingPool().PlaceBetCalldata([32]byte{0x01}, 1, big.NewInt(100_000_000), guard)
	if err != nil {
		return
	}
	fmt.Println(hex.EncodeToString(data[:4]))
}

func ExampleEcosystemRewards_ClaimCalldata() {
	ctx := context.Background()
	rpcURL := os.Getenv("ODDFI_RPC_URL")
	client, err := oddfi.NewClient(ctx, oddfi.Config{
		RPCURL:                rpcURL,
		EcosystemRewardsProxy: oddfi.MustParseAddress("0x71f0C250e8f9cE43626822dE118bC07FBb72CDA4"),
	})
	if err != nil {
		return
	}
	defer func() { _ = client.Close(ctx) }()

	// claimID is returned by createClaimable and parsed from the ClaimableCreated event.
	// The returned bytes are the data field for a sponsored EIP-7702 inner call that the
	// claimable owner (msg.sender) executes to claim their ecosystem reward.
	data, err := client.EcosystemRewards().ClaimCalldata(big.NewInt(42))
	if err != nil {
		return
	}
	fmt.Println(hex.EncodeToString(data[:4]))
}

func ExampleLiquidityPool_PreviewWithdraw() {
	ctx := context.Background()
	rpcURL := os.Getenv("ODDFI_RPC_URL")
	client, err := oddfi.NewClient(ctx, oddfi.Config{
		RPCURL:             rpcURL,
		ODDTokenProxy:      oddfi.MustParseAddress("0x5530dA4357803bD0ed806a999a1f1fcc3c45Dc8C"),
		StakingPoolProxy:   oddfi.MustParseAddress("0x65fd4A2529010693BA474d1993631e305a42E061"),
		LiquidityPoolProxy: oddfi.MustParseAddress("0xdf0c59B387DfDf9f18969880DDCF1216BFEe318f"),
		BettingPoolProxy:   oddfi.MustParseAddress("0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F"),
	})
	if err != nil {
		return
	}
	defer func() { _ = client.Close(ctx) }()

	preview, err := client.LiquidityPool().PreviewWithdraw(ctx, big.NewInt(1))
	if err != nil {
		return
	}
	if preview.EffectiveState == oddfi.LiquidityPositionStateWithdrawable {
		fmt.Println(preview.WithdrawAmount)
	}
}
