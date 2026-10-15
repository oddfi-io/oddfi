package oddfi

// Note: adapter-level abi.Pack failure for the TierSale Calldata methods is
// structurally unreachable from the typed public facade — every parameter is a
// fixed *big.Int that the ABI binding accepts unconditionally. The
// wrapUserError(op, err) path on adapter failure exists as defense-in-depth for
// ABI drift after binding regeneration. Nil-bigint tests cover the only
// reachable user-input error path.

import (
	"bytes"
	"context"
	"errors"
	"math/big"
	"testing"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/contracts"
	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

type stubTierSaleCaller struct{}

func (stubTierSaleCaller) CodeAt(_ context.Context, _ common.Address, _ *big.Int) ([]byte, error) {
	return []byte{0x60}, nil
}
func (stubTierSaleCaller) CallContract(_ context.Context, _ ethereum.CallMsg, _ *big.Int) ([]byte, error) {
	return nil, errors.New("stub call contract")
}

func newOfflineTierSale(t *testing.T) *TierSale {
	t.Helper()
	adapter, err := contracts.NewTierSaleAdapter(stubTierSaleCaller{}, nil, common.HexToAddress("0x0000000000000000000000000000000000000001"))
	if err != nil {
		t.Fatalf("build adapter: %v", err)
	}
	return &TierSale{adapter: adapter}
}

// TestTierSale_BuyCalldata verifies selector correctness.
func TestTierSale_BuyCalldata(t *testing.T) {
	t.Parallel()
	sale := newOfflineTierSale(t)
	oddAmount := new(big.Int).Mul(big.NewInt(10_000), big.NewInt(1_000_000_000_000_000_000)) // 10,000 ODD

	data, err := sale.BuyCalldata(oddAmount)
	if err != nil {
		t.Fatalf("BuyCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("buy(uint256)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestTierSale_BuyCalldata_NilReceiver verifies nil *TierSale returns ConfigError.
func TestTierSale_BuyCalldata_NilReceiver(t *testing.T) {
	t.Parallel()
	_, err := (*TierSale)(nil).BuyCalldata(big.NewInt(1))
	if !errors.Is(err, ErrMissingTierSale) {
		t.Fatalf("expected ErrMissingTierSale, got %v", err)
	}
	var cfg *ConfigError
	if !errors.As(err, &cfg) {
		t.Fatalf("expected *ConfigError, got %T", err)
	}
}

// TestTierSale_BuyCalldata_NilAmount verifies nil oddAmount returns UserError.
func TestTierSale_BuyCalldata_NilAmount(t *testing.T) {
	t.Parallel()
	sale := newOfflineTierSale(t)
	_, err := sale.BuyCalldata(nil)
	if !errors.Is(err, ErrNilBigIntParam) {
		t.Fatalf("expected ErrNilBigIntParam, got %v", err)
	}
	var ue *UserError
	if !errors.As(err, &ue) {
		t.Fatalf("expected *UserError, got %T", err)
	}
}

// TestTierSale_BuyCalldata_Deterministic verifies that encoding the same input
// twice yields identical bytes (no mutable state in ABI encoding).
func TestTierSale_BuyCalldata_Deterministic(t *testing.T) {
	t.Parallel()
	sale := newOfflineTierSale(t)
	oddAmount := big.NewInt(5_000_000_000_000_000_000)

	data1, err := sale.BuyCalldata(oddAmount)
	if err != nil {
		t.Fatalf("first call: %v", err)
	}
	data2, err := sale.BuyCalldata(oddAmount)
	if err != nil {
		t.Fatalf("second call: %v", err)
	}
	if !bytes.Equal(data1, data2) {
		t.Fatalf("non-deterministic encoding: %x vs %x", data1, data2)
	}
}

// TestTierSale_RefundPurchaseCalldata verifies selector correctness.
func TestTierSale_RefundPurchaseCalldata(t *testing.T) {
	t.Parallel()
	sale := newOfflineTierSale(t)
	purchaseID := big.NewInt(7)
	oddAmount := big.NewInt(3_000_000_000_000_000_000)

	data, err := sale.RefundPurchaseCalldata(purchaseID, oddAmount)
	if err != nil {
		t.Fatalf("RefundPurchaseCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("refundPurchase(uint256,uint256)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestTierSale_RefundPurchaseCalldata_NilReceiver verifies nil *TierSale returns ConfigError.
func TestTierSale_RefundPurchaseCalldata_NilReceiver(t *testing.T) {
	t.Parallel()
	_, err := (*TierSale)(nil).RefundPurchaseCalldata(big.NewInt(1), big.NewInt(1))
	if !errors.Is(err, ErrMissingTierSale) {
		t.Fatalf("expected ErrMissingTierSale, got %v", err)
	}
	var cfg *ConfigError
	if !errors.As(err, &cfg) {
		t.Fatalf("expected *ConfigError, got %T", err)
	}
}

// TestTierSale_RefundPurchaseCalldata_NilBigInt verifies nil bigint parameters return UserError.
func TestTierSale_RefundPurchaseCalldata_NilBigInt(t *testing.T) {
	t.Parallel()
	sale := newOfflineTierSale(t)

	tests := []struct {
		name       string
		purchaseID *big.Int
		oddAmount  *big.Int
	}{
		{name: "purchase id", purchaseID: nil, oddAmount: big.NewInt(1)},
		{name: "odd amount", purchaseID: big.NewInt(1), oddAmount: nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			_, err := sale.RefundPurchaseCalldata(tt.purchaseID, tt.oddAmount)
			if !errors.Is(err, ErrNilBigIntParam) {
				t.Fatalf("expected ErrNilBigIntParam, got %v", err)
			}
			var ue *UserError
			if !errors.As(err, &ue) {
				t.Fatalf("expected *UserError, got %T", err)
			}
		})
	}
}
