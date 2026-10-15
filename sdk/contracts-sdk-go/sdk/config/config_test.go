package config

import (
	"strings"
	"testing"

	"github.com/ethereum/go-ethereum/common"
)

func TestLoadTestnet(t *testing.T) {
	c, err := Load("testnet")
	if err != nil {
		t.Fatalf("load testnet: %v", err)
	}
	if c.Name != "testnet" {
		t.Errorf("name = %q, want testnet", c.Name)
	}
	if c.ChainID != 97 {
		t.Errorf("chainId = %d, want 97", c.ChainID)
	}
	if !common.IsHexAddress(c.Contracts.BettingPool) {
		t.Errorf("bettingPool not a hex address: %q", c.Contracts.BettingPool)
	}
	if c.BettingPoolAddress() == (common.Address{}) {
		t.Errorf("bettingPool decoded to zero address")
	}
}

func TestLoadMainnet(t *testing.T) {
	c, err := Load("mainnet")
	if err != nil {
		t.Fatalf("load mainnet: %v", err)
	}
	if c.ChainID != 56 {
		t.Errorf("chainId = %d, want 56", c.ChainID)
	}
	// mainnet usdt is the real BSC USDT
	wantUSDT := "0x55d398326f99059fF775485246999027B3197955"
	if !strings.EqualFold(c.Contracts.USDT, wantUSDT) {
		t.Errorf("usdt = %q, want %q", c.Contracts.USDT, wantUSDT)
	}
}

func TestLoadUnknown(t *testing.T) {
	_, err := Load("devnet")
	if err == nil {
		t.Fatal("expected error for unknown env, got nil")
	}
}
