package oddfi_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/common"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/pkg/oddfi"
)

func TestReadOnlyE2EAllConfiguredContracts(t *testing.T) {
	if os.Getenv("ODDFI_E2E") != "1" {
		t.Skip("set ODDFI_E2E=1 to run read-only chain integration tests")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	client, err := oddfi.NewClient(ctx, oddfi.Config{
		RPCURL:             requiredEnv(t, "ODDFI_RPC_URL"),
		ODDTokenProxy:      mustParseEnvAddress(t, "ODDFI_ODD_TOKEN_PROXY"),
		StakingPoolProxy:   mustParseEnvAddress(t, "ODDFI_STAKING_POOL_PROXY"),
		LiquidityPoolProxy: mustParseEnvAddress(t, "ODDFI_LIQUIDITY_POOL_PROXY"),
		BettingPoolProxy:   mustParseEnvAddress(t, "ODDFI_BETTING_POOL_PROXY"),
	})
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	defer func() {
		if err := client.Close(ctx); err != nil {
			t.Fatalf("Close: %v", err)
		}
	}()

	if _, err := client.ODDToken().Name(ctx); err != nil {
		t.Fatalf("ODDToken.Name: %v", err)
	}
	if _, err := client.ODDToken().TotalSupply(ctx); err != nil {
		t.Fatalf("ODDToken.TotalSupply: %v", err)
	}
	if _, err := client.StakingPool().MinStakeAmount(ctx); err != nil {
		t.Fatalf("StakingPool.MinStakeAmount: %v", err)
	}
	if _, err := client.LiquidityPool().MinDeposit(ctx); err != nil {
		t.Fatalf("LiquidityPool.MinDeposit: %v", err)
	}
	if _, err := client.BettingPool().PlatformReserve(ctx); err != nil {
		t.Fatalf("BettingPool.PlatformReserve: %v", err)
	}
}

func requiredEnv(t *testing.T, key string) string {
	t.Helper()
	value := os.Getenv(key)
	if value == "" {
		t.Fatalf("missing %s", key)
	}
	return value
}

func mustParseEnvAddress(t *testing.T, key string) common.Address {
	t.Helper()
	value := requiredEnv(t, key)
	address, err := oddfi.ParseAddress(value)
	if err != nil {
		t.Fatalf("parse %s: %v", key, err)
	}
	return address
}
