package oddfi

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

type stubStakingPoolCaller struct{}

func (stubStakingPoolCaller) CodeAt(_ context.Context, _ common.Address, _ *big.Int) ([]byte, error) {
	return []byte{0x60}, nil
}
func (stubStakingPoolCaller) CallContract(_ context.Context, _ ethereum.CallMsg, _ *big.Int) ([]byte, error) {
	return nil, errors.New("stub call contract")
}

func newOfflineStakingPool(t *testing.T) *StakingPool {
	t.Helper()
	adapter, err := contracts.NewStakingPoolAdapter(stubStakingPoolCaller{}, nil, common.HexToAddress("0x0000000000000000000000000000000000000001"))
	if err != nil {
		t.Fatalf("build adapter: %v", err)
	}
	return &StakingPool{adapter: adapter}
}

// TestStakingPool_StakeCalldata verifies selector correctness.
func TestStakingPool_StakeCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineStakingPool(t)
	amount := big.NewInt(1_000_000_000_000_000_000)
	var planID uint16 = 3

	data, err := pool.StakeCalldata(amount, planID)
	if err != nil {
		t.Fatalf("StakeCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("stake(uint256,uint16)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestStakingPool_StakeCalldata_NilReceiver verifies nil *StakingPool returns ConfigError.
func TestStakingPool_StakeCalldata_NilReceiver(t *testing.T) {
	t.Parallel()
	_, err := (*StakingPool)(nil).StakeCalldata(big.NewInt(1), 0)
	if !errors.Is(err, ErrMissingStakingPool) {
		t.Fatalf("expected ErrMissingStakingPool, got %v", err)
	}
	var cfg *ConfigError
	if !errors.As(err, &cfg) {
		t.Fatalf("expected *ConfigError, got %T", err)
	}
}

// Adapter-level abi.Pack failure is structurally unreachable from the typed
// facade for stake(uint256,uint16) / unstake(uint256) — all type errors are
// caught at Go's type system. The nil-bigint tests cover the only user-input
// failure path.

// TestStakingPool_StakeCalldata_NilAmount verifies nil amount returns UserError.
func TestStakingPool_StakeCalldata_NilAmount(t *testing.T) {
	t.Parallel()
	pool := newOfflineStakingPool(t)
	_, err := pool.StakeCalldata(nil, 1)
	if !errors.Is(err, ErrNilBigIntParam) {
		t.Fatalf("expected ErrNilBigIntParam, got %v", err)
	}
	var ue *UserError
	if !errors.As(err, &ue) {
		t.Fatalf("expected *UserError, got %T", err)
	}
}

// TestStakingPool_UnstakeCalldata verifies selector correctness.
func TestStakingPool_UnstakeCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineStakingPool(t)
	positionID := big.NewInt(42)

	data, err := pool.UnstakeCalldata(positionID)
	if err != nil {
		t.Fatalf("UnstakeCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("unstake(uint256)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestStakingPool_UnstakeCalldata_NilReceiver verifies nil *StakingPool returns ConfigError.
func TestStakingPool_UnstakeCalldata_NilReceiver(t *testing.T) {
	t.Parallel()
	_, err := (*StakingPool)(nil).UnstakeCalldata(big.NewInt(1))
	if !errors.Is(err, ErrMissingStakingPool) {
		t.Fatalf("expected ErrMissingStakingPool, got %v", err)
	}
	var cfg *ConfigError
	if !errors.As(err, &cfg) {
		t.Fatalf("expected *ConfigError, got %T", err)
	}
}

// TestStakingPool_UnstakeCalldata_NilPositionID verifies nil positionID returns UserError.
func TestStakingPool_UnstakeCalldata_NilPositionID(t *testing.T) {
	t.Parallel()
	pool := newOfflineStakingPool(t)
	_, err := pool.UnstakeCalldata(nil)
	if !errors.Is(err, ErrNilBigIntParam) {
		t.Fatalf("expected ErrNilBigIntParam, got %v", err)
	}
	var ue *UserError
	if !errors.As(err, &ue) {
		t.Fatalf("expected *UserError, got %T", err)
	}
}

// TestStakingPool_EarlyUnstakeCalldata verifies selector correctness.
func TestStakingPool_EarlyUnstakeCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineStakingPool(t)
	positionID := big.NewInt(42)

	data, err := pool.EarlyUnstakeCalldata(positionID)
	if err != nil {
		t.Fatalf("EarlyUnstakeCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("earlyUnstake(uint256)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestStakingPool_EarlyUnstakeCalldata_NilReceiver verifies nil *StakingPool returns ConfigError.
func TestStakingPool_EarlyUnstakeCalldata_NilReceiver(t *testing.T) {
	t.Parallel()
	_, err := (*StakingPool)(nil).EarlyUnstakeCalldata(big.NewInt(1))
	if !errors.Is(err, ErrMissingStakingPool) {
		t.Fatalf("expected ErrMissingStakingPool, got %v", err)
	}
	var cfg *ConfigError
	if !errors.As(err, &cfg) {
		t.Fatalf("expected *ConfigError, got %T", err)
	}
}

// TestStakingPool_EarlyUnstakeCalldata_NilPositionID verifies nil positionID returns UserError.
func TestStakingPool_EarlyUnstakeCalldata_NilPositionID(t *testing.T) {
	t.Parallel()
	pool := newOfflineStakingPool(t)
	_, err := pool.EarlyUnstakeCalldata(nil)
	if !errors.Is(err, ErrNilBigIntParam) {
		t.Fatalf("expected ErrNilBigIntParam, got %v", err)
	}
	var ue *UserError
	if !errors.As(err, &ue) {
		t.Fatalf("expected *UserError, got %T", err)
	}
}
