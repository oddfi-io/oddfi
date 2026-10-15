package withdrawal

import (
	"context"
	"fmt"
	"math/big"
	"os"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
)

// TestGetSuggestedGasPrice tests fetching gas price from network
func TestGetSuggestedGasPrice(t *testing.T) {
	rpcURL := getEnvOrDefault("BSC_RPC", "https://bsc-dataseed.binance.org/")

	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		t.Fatalf("Failed to create ETH client: %v", err)
	}
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	gasPrice, err := GetSuggestedGasPrice(ctx, client)
	if err != nil {
		t.Fatalf("GetSuggestedGasPrice failed: %v", err)
	}

	gasPriceGwei := new(big.Float).Quo(
		new(big.Float).SetInt(gasPrice),
		big.NewFloat(1e9),
	)

	t.Logf("=== Gas Price ===")
	t.Logf("Gas Price (wei): %s", gasPrice.String())
	t.Logf("Gas Price (Gwei): %s", gasPriceGwei.String())
}

// TestGetTokenBalance tests querying token balance
func TestGetTokenBalance(t *testing.T) {
	rpcURL := getEnvOrDefault("BSC_RPC", "https://bsc-dataseed.binance.org/")
	tokenAddress := getEnvOrDefault("TEST_TOKEN_ADDRESS", "0xa3049f4C5b196EbDE022eBedA6673683E5eC49b7")
	accountAddress := getEnvOrDefault("TEST_ACCOUNT_ADDRESS", "0x75eC09534D9be1c0746759e73E2489a0e372F579")

	if tokenAddress == "" || accountAddress == "" {
		t.Skip("TEST_TOKEN_ADDRESS or TEST_ACCOUNT_ADDRESS not configured, skipping test")
	}

	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		t.Fatalf("Failed to create ETH client: %v", err)
	}
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	balance, err := GetTokenBalance(ctx, client, common.HexToAddress(tokenAddress), common.HexToAddress(accountAddress))
	if err != nil {
		t.Fatalf("GetTokenBalance failed: %v", err)
	}

	t.Logf("=== Token Balance ===")
	t.Logf("Balance (wei): %s", balance.String())
}

// TestGetCallCount tests the call count function
func TestGetCallCount(t *testing.T) {
	transfers := []Transfer{
		{
			To:         common.HexToAddress("0x1234567890123456789012345678901234567890"),
			RealAmount: big.NewInt(1000),
		},
		{
			To:         common.HexToAddress("0x2345678901234567890123456789012345678901"),
			RealAmount: big.NewInt(2000),
		},
		{
			To:         common.HexToAddress("0x3456789012345678901234567890123456789012"),
			RealAmount: big.NewInt(3000),
		},
	}

	count := GetCallCount(transfers)

	if count != 3 {
		t.Errorf("Expected call count 3, got %d", count)
	}

	t.Logf("Call count: %d", count)
}

// TestFormatGweiToWei tests Gwei to Wei conversion
func TestFormatGweiToWei(t *testing.T) {
	testCases := []struct {
		gwei int64
		wei  int64
	}{
		{5, 5e9},
		{10, 10e9},
		{100, 100e9},
	}

	for _, tc := range testCases {
		result := FormatGweiToWei(tc.gwei)
		expected := big.NewInt(tc.wei)
		if result.Cmp(expected) != 0 {
			t.Errorf("FormatGweiToWei(%d) = %s, expected %s", tc.gwei, result.String(), expected.String())
		}
	}
}

// TestDefaultGasConfig tests default gas config
func TestDefaultGasConfig(t *testing.T) {
	cfg := DefaultGasConfig()

	if cfg.MaxPriorityFee.Cmp(big.NewInt(2e9)) != 0 {
		t.Errorf("Expected MaxPriorityFee 2e9, got %s", cfg.MaxPriorityFee.String())
	}

	if cfg.GasLimitPerCall != 65000 {
		t.Errorf("Expected GasLimitPerCall 65000, got %d", cfg.GasLimitPerCall)
	}

	if cfg.Multiplicator != 1.2 {
		t.Errorf("Expected Multiplicator 1.2, got %f", cfg.Multiplicator)
	}

	t.Logf("Default Gas Config: MaxPriorityFee=%s, GasLimitPerCall=%d, Multiplicator=%f",
		cfg.MaxPriorityFee.String(), cfg.GasLimitPerCall, cfg.Multiplicator)
}

// TestBatchTransferWithDistribute tests batch transfer using TokenDistributor contract
func TestBatchTransferWithDistribute(t *testing.T) {
	rpcURL := getEnvOrDefault("BSC_RPC", "https://bsc-dataseed.binance.org/")
	// oddAddress       = "0xa3049f4c5b196ebde022ebeda6673683e5ec49b7"                         //平台分发odd地址
	// senderPrivateKey = "0x5e45f7884bd8da2ae76b5018abc50a3833af47fa0c0c7b7821ca5dac1f605b18" //平台分发odd地址私钥
	senderPK := getEnvOrDefault("SENDER_PRIVATE_KEY", "5e45f7884bd8da2ae76b5018abc50a3833af47fa0c0c7b7821ca5dac1f605b18")
	tokenAddress := getEnvOrDefault("TEST_TOKEN_ADDRESS", "0xa3049f4c5b196ebde022ebeda6673683e5ec49b7")
	distributeAddr := getEnvOrDefault("DISTRIBUTE_CONTRACT_ADDRESS", "0x3cd84963954f8c6E4fbdE87B35B5638b545B6Ca9")

	if senderPK == "" || tokenAddress == "" {
		t.Skip("SENDER_PRIVATE_KEY or TEST_TOKEN_ADDRESS not configured, skipping test")
	}

	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		t.Fatalf("Failed to create ETH client: %v", err)
	}
	defer client.Close()

	// Prepare test transfers (配对的 transfers)
	transfers := []Transfer{
		{
			To:         common.HexToAddress("0x1234567890123456789012345678901234567890"),
			RealAmount: big.NewInt(1000000),
		},
		{
			To:         common.HexToAddress("0x2345678901234567890123456789012345678901"),
			RealAmount: big.NewInt(2000000),
		},
		{
			To:         common.HexToAddress("0x3456789012345678901234567890123456789012"),
			RealAmount: big.NewInt(3000000),
		},
	}

	req := &BatchTransferReq{
		TokenAddress:              common.HexToAddress(tokenAddress),
		Transfers:                 transfers,
		PrivateKeyHex:             senderPK,
		DistributeContractAddress: common.HexToAddress(distributeAddr),
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	result, err := BatchTransferWithDistribute(ctx, client, req)
	if err != nil {
		t.Fatalf("BatchTransferWithDistribute failed: %v", err)
	}

	t.Logf("=== Batch Transfer With Distribute Result ===")
	t.Logf("TxHash: %s", result.TxHash.Hex())
	t.Logf("Gas Used: %d", result.GasUsed)
	t.Logf("Effective Gas Price: %s wei", result.EffectiveGasPrice.String())
	t.Logf("Total Fees: %s wei", result.TotalFees.String())
	t.Logf("Total Fees (BNB): %s", formatWeiToBNB(result.TotalFees))
}

// getEnvOrDefault returns environment variable or default value
func getEnvOrDefault(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

// formatWeiToBNB converts wei to BNB (approximate)
func formatWeiToBNB(wei *big.Int) string {
	bnb := new(big.Float).Quo(
		new(big.Float).SetInt(wei),
		big.NewFloat(1e18),
	)
	return fmt.Sprintf("%.8f", bnb)
}
