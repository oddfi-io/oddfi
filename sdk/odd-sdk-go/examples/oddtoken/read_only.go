package main

import (
	"context"
	"fmt"
	"os"

	"github.com/ethereum/go-ethereum/common"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/pkg/oddfi"
)

func main() {
	ctx := context.Background()
	rpcURL := os.Getenv("ODDFI_RPC_URL")
	if rpcURL == "" {
		fmt.Println("set ODDFI_RPC_URL to run this read-only example")
		return
	}

	oddTokenProxy, err := envAddress("ODDFI_ODD_TOKEN_PROXY")
	if err != nil {
		fmt.Printf("parse ODDToken proxy address: %v\n", err)
		return
	}
	stakingPoolProxy, err := envAddress("ODDFI_STAKING_POOL_PROXY")
	if err != nil {
		fmt.Printf("parse StakingPool proxy address: %v\n", err)
		return
	}
	liquidityPoolProxy, err := envAddress("ODDFI_LIQUIDITY_POOL_PROXY")
	if err != nil {
		fmt.Printf("parse LiquidityPool proxy address: %v\n", err)
		return
	}
	bettingPoolProxy, err := envAddress("ODDFI_BETTING_POOL_PROXY")
	if err != nil {
		fmt.Printf("parse BettingPool proxy address: %v\n", err)
		return
	}
	client, err := oddfi.NewClient(ctx, oddfi.Config{
		RPCURL:             rpcURL,
		ODDTokenProxy:      oddTokenProxy,
		StakingPoolProxy:   stakingPoolProxy,
		LiquidityPoolProxy: liquidityPoolProxy,
		BettingPoolProxy:   bettingPoolProxy,
	})
	if err != nil {
		fmt.Printf("new client: %v\n", err)
		return
	}
	defer func() {
		if err := client.Close(ctx); err != nil {
			fmt.Printf("close client: %v\n", err)
		}
	}()

	name, err := client.ODDToken().Name(ctx)
	if err != nil {
		fmt.Printf("read name: %v\n", err)
		return
	}
	symbol, err := client.ODDToken().Symbol(ctx)
	if err != nil {
		fmt.Printf("read symbol: %v\n", err)
		return
	}
	decimals, err := client.ODDToken().Decimals(ctx)
	if err != nil {
		fmt.Printf("read decimals: %v\n", err)
		return
	}
	totalSupply, err := client.ODDToken().TotalSupply(ctx)
	if err != nil {
		fmt.Printf("read total supply: %v\n", err)
		return
	}
	paused, err := client.ODDToken().Paused(ctx)
	if err != nil {
		fmt.Printf("read paused: %v\n", err)
		return
	}

	fmt.Printf("%s (%s), decimals=%d, totalSupply=%s, paused=%t\n", name, symbol, decimals, totalSupply.String(), paused)
}

func envAddress(key string) (common.Address, error) {
	value := os.Getenv(key)
	if value == "" {
		return common.Address{}, fmt.Errorf("missing %s", key)
	}
	return oddfi.ParseAddress(value)
}
