package oddfi

import (
	"bytes"
	"context"
	"errors"
	"math/big"
	"testing"

	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/contracts"
)

type stubODDTokenCaller struct{}

func (stubODDTokenCaller) CodeAt(_ context.Context, _ common.Address, _ *big.Int) ([]byte, error) {
	return []byte{0x60}, nil
}
func (stubODDTokenCaller) CallContract(_ context.Context, _ ethereum.CallMsg, _ *big.Int) ([]byte, error) {
	return nil, errors.New("stub call contract")
}

func newOfflineODDToken(t *testing.T) *ODDToken {
	t.Helper()
	adapter, err := contracts.NewODDTokenAdapter(stubODDTokenCaller{}, nil, common.HexToAddress("0x0000000000000000000000000000000000000001"))
	if err != nil {
		t.Fatalf("build adapter: %v", err)
	}
	return &ODDToken{adapter: adapter}
}

// TestODDToken_TransferCalldata verifies selector correctness.
func TestODDToken_TransferCalldata(t *testing.T) {
	t.Parallel()
	token := newOfflineODDToken(t)
	to := common.HexToAddress("0x2222222222222222222222222222222222222222")
	amount := big.NewInt(1_000_000_000_000_000_000)

	data, err := token.TransferCalldata(to, amount)
	if err != nil {
		t.Fatalf("TransferCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("transfer(address,uint256)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestODDToken_TransferCalldata_NilReceiver verifies nil *ODDToken returns ConfigError.
func TestODDToken_TransferCalldata_NilReceiver(t *testing.T) {
	t.Parallel()
	_, err := (*ODDToken)(nil).TransferCalldata(common.Address{}, big.NewInt(1))
	if !errors.Is(err, ErrMissingODDToken) {
		t.Fatalf("expected ErrMissingODDToken, got %v", err)
	}
	var cfg *ConfigError
	if !errors.As(err, &cfg) {
		t.Fatalf("expected *ConfigError, got %T", err)
	}
}

// Note: for ODDToken's transfer(address,uint256) / approve(address,uint256), the
// adapter-level abi.Pack failure path is structurally unreachable from the typed
// public facade — all type/shape errors are caught at the Go type system level.
// The nil-value tests cover the only user-input error path. For richer-typed
// methods (e.g. BettingPool.PlaceBetCalldata's QuoteGuardInput tuple), T4 will
// add an adapter-Pack-failure assertion covering the *UserError wrapping at
// pkg/oddfi/oddtoken.go's err-wrap path.

// TestODDToken_TransferCalldata_NilValue verifies nil value returns UserError.
func TestODDToken_TransferCalldata_NilValue(t *testing.T) {
	t.Parallel()
	token := newOfflineODDToken(t)
	_, err := token.TransferCalldata(common.HexToAddress("0x1"), nil)
	if !errors.Is(err, ErrNilBigIntParam) {
		t.Fatalf("expected ErrNilBigIntParam, got %v", err)
	}
	var ue *UserError
	if !errors.As(err, &ue) {
		t.Fatalf("expected *UserError, got %T", err)
	}
}

// TestODDToken_ApproveCalldata verifies selector correctness.
func TestODDToken_ApproveCalldata(t *testing.T) {
	t.Parallel()
	token := newOfflineODDToken(t)
	spender := common.HexToAddress("0x3333333333333333333333333333333333333333")
	amount := big.NewInt(500_000_000_000_000_000)

	data, err := token.ApproveCalldata(spender, amount)
	if err != nil {
		t.Fatalf("ApproveCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("approve(address,uint256)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestODDToken_ApproveCalldata_NilReceiver verifies nil *ODDToken returns ConfigError.
func TestODDToken_ApproveCalldata_NilReceiver(t *testing.T) {
	t.Parallel()
	_, err := (*ODDToken)(nil).ApproveCalldata(common.Address{}, big.NewInt(1))
	if !errors.Is(err, ErrMissingODDToken) {
		t.Fatalf("expected ErrMissingODDToken, got %v", err)
	}
	var cfg *ConfigError
	if !errors.As(err, &cfg) {
		t.Fatalf("expected *ConfigError, got %T", err)
	}
}

// TestODDToken_ApproveCalldata_NilValue verifies nil value returns UserError.
func TestODDToken_ApproveCalldata_NilValue(t *testing.T) {
	t.Parallel()
	token := newOfflineODDToken(t)
	_, err := token.ApproveCalldata(common.HexToAddress("0x1"), nil)
	if !errors.Is(err, ErrNilBigIntParam) {
		t.Fatalf("expected ErrNilBigIntParam, got %v", err)
	}
	var ue *UserError
	if !errors.As(err, &ue) {
		t.Fatalf("expected *UserError, got %T", err)
	}
}
