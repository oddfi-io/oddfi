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

type stubLiquidityPoolCaller struct{}

func (stubLiquidityPoolCaller) CodeAt(_ context.Context, _ common.Address, _ *big.Int) ([]byte, error) {
	return []byte{0x60}, nil
}
func (stubLiquidityPoolCaller) CallContract(_ context.Context, _ ethereum.CallMsg, _ *big.Int) ([]byte, error) {
	return nil, errors.New("stub call contract")
}

func newOfflineLiquidityPool(t *testing.T) *LiquidityPool {
	t.Helper()
	adapter, err := contracts.NewLiquidityPoolAdapter(stubLiquidityPoolCaller{}, nil, common.HexToAddress("0x0000000000000000000000000000000000000001"))
	if err != nil {
		t.Fatalf("build adapter: %v", err)
	}
	return &LiquidityPool{adapter: adapter}
}

// TestLiquidityPool_DepositGlobalCalldata verifies selector correctness.
func TestLiquidityPool_DepositGlobalCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineLiquidityPool(t)
	amount := big.NewInt(1_000_000_000_000_000_000)
	var planID uint16 = 2

	data, err := pool.DepositGlobalCalldata(amount, planID)
	if err != nil {
		t.Fatalf("DepositGlobalCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("depositGlobal(uint256,uint16)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestLiquidityPool_DepositGlobalCalldata_NilReceiver verifies nil *LiquidityPool returns ConfigError.
func TestLiquidityPool_DepositGlobalCalldata_NilReceiver(t *testing.T) {
	t.Parallel()
	_, err := (*LiquidityPool)(nil).DepositGlobalCalldata(big.NewInt(1), 0)
	if !errors.Is(err, ErrMissingLiquidityPool) {
		t.Fatalf("expected ErrMissingLiquidityPool, got %v", err)
	}
	var cfg *ConfigError
	if !errors.As(err, &cfg) {
		t.Fatalf("expected *ConfigError, got %T", err)
	}
}

// Adapter-level abi.Pack failure is structurally unreachable from the typed
// facade for depositGlobal(uint256,uint16) / depositMatch(bytes32,uint256) /
// requestUnbond(uint256) / withdraw(uint256) — all type errors are caught at
// Go's type system. The nil-bigint tests cover the only user-input failure path.

// TestLiquidityPool_DepositGlobalCalldata_NilAmount verifies nil amount returns UserError.
func TestLiquidityPool_DepositGlobalCalldata_NilAmount(t *testing.T) {
	t.Parallel()
	pool := newOfflineLiquidityPool(t)
	_, err := pool.DepositGlobalCalldata(nil, 1)
	if !errors.Is(err, ErrNilBigIntParam) {
		t.Fatalf("expected ErrNilBigIntParam, got %v", err)
	}
	var ue *UserError
	if !errors.As(err, &ue) {
		t.Fatalf("expected *UserError, got %T", err)
	}
}

// TestLiquidityPool_DepositMatchCalldata verifies selector correctness.
func TestLiquidityPool_DepositMatchCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineLiquidityPool(t)
	var matchID [32]byte
	copy(matchID[:], crypto.Keccak256([]byte("match-1")))
	amount := big.NewInt(500_000_000_000_000_000)

	data, err := pool.DepositMatchCalldata(matchID, amount)
	if err != nil {
		t.Fatalf("DepositMatchCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("depositMatch(bytes32,uint256)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestLiquidityPool_DepositMatchCalldata_NilReceiver verifies nil *LiquidityPool returns ConfigError.
func TestLiquidityPool_DepositMatchCalldata_NilReceiver(t *testing.T) {
	t.Parallel()
	var matchID [32]byte
	_, err := (*LiquidityPool)(nil).DepositMatchCalldata(matchID, big.NewInt(1))
	if !errors.Is(err, ErrMissingLiquidityPool) {
		t.Fatalf("expected ErrMissingLiquidityPool, got %v", err)
	}
	var cfg *ConfigError
	if !errors.As(err, &cfg) {
		t.Fatalf("expected *ConfigError, got %T", err)
	}
}

// TestLiquidityPool_DepositMatchCalldata_NilAmount verifies nil amount returns UserError.
func TestLiquidityPool_DepositMatchCalldata_NilAmount(t *testing.T) {
	t.Parallel()
	pool := newOfflineLiquidityPool(t)
	var matchID [32]byte
	_, err := pool.DepositMatchCalldata(matchID, nil)
	if !errors.Is(err, ErrNilBigIntParam) {
		t.Fatalf("expected ErrNilBigIntParam, got %v", err)
	}
	var ue *UserError
	if !errors.As(err, &ue) {
		t.Fatalf("expected *UserError, got %T", err)
	}
}

// TestLiquidityPool_RequestUnbondCalldata verifies selector correctness.
func TestLiquidityPool_RequestUnbondCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineLiquidityPool(t)
	positionID := big.NewInt(7)

	data, err := pool.RequestUnbondCalldata(positionID)
	if err != nil {
		t.Fatalf("RequestUnbondCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("requestUnbond(uint256)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestLiquidityPool_RequestUnbondCalldata_NilReceiver verifies nil *LiquidityPool returns ConfigError.
func TestLiquidityPool_RequestUnbondCalldata_NilReceiver(t *testing.T) {
	t.Parallel()
	_, err := (*LiquidityPool)(nil).RequestUnbondCalldata(big.NewInt(1))
	if !errors.Is(err, ErrMissingLiquidityPool) {
		t.Fatalf("expected ErrMissingLiquidityPool, got %v", err)
	}
	var cfg *ConfigError
	if !errors.As(err, &cfg) {
		t.Fatalf("expected *ConfigError, got %T", err)
	}
}

// TestLiquidityPool_RequestUnbondCalldata_NilPositionID verifies nil positionID returns UserError.
func TestLiquidityPool_RequestUnbondCalldata_NilPositionID(t *testing.T) {
	t.Parallel()
	pool := newOfflineLiquidityPool(t)
	_, err := pool.RequestUnbondCalldata(nil)
	if !errors.Is(err, ErrNilBigIntParam) {
		t.Fatalf("expected ErrNilBigIntParam, got %v", err)
	}
	var ue *UserError
	if !errors.As(err, &ue) {
		t.Fatalf("expected *UserError, got %T", err)
	}
}

// TestLiquidityPool_WithdrawCalldata verifies selector correctness.
func TestLiquidityPool_WithdrawCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineLiquidityPool(t)
	positionID := big.NewInt(42)

	data, err := pool.WithdrawCalldata(positionID)
	if err != nil {
		t.Fatalf("WithdrawCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("withdraw(uint256)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestLiquidityPool_WithdrawCalldata_NilReceiver verifies nil *LiquidityPool returns ConfigError.
func TestLiquidityPool_WithdrawCalldata_NilReceiver(t *testing.T) {
	t.Parallel()
	_, err := (*LiquidityPool)(nil).WithdrawCalldata(big.NewInt(1))
	if !errors.Is(err, ErrMissingLiquidityPool) {
		t.Fatalf("expected ErrMissingLiquidityPool, got %v", err)
	}
	var cfg *ConfigError
	if !errors.As(err, &cfg) {
		t.Fatalf("expected *ConfigError, got %T", err)
	}
}

// TestLiquidityPool_WithdrawCalldata_NilPositionID verifies nil positionID returns UserError.
func TestLiquidityPool_WithdrawCalldata_NilPositionID(t *testing.T) {
	t.Parallel()
	pool := newOfflineLiquidityPool(t)
	_, err := pool.WithdrawCalldata(nil)
	if !errors.Is(err, ErrNilBigIntParam) {
		t.Fatalf("expected ErrNilBigIntParam, got %v", err)
	}
	var ue *UserError
	if !errors.As(err, &ue) {
		t.Fatalf("expected *UserError, got %T", err)
	}
}

// TestLiquidityPool_InitializeGlobalRequestableLiquidityCalldata verifies selector correctness.
func TestLiquidityPool_InitializeGlobalRequestableLiquidityCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineLiquidityPool(t)

	data, err := pool.InitializeGlobalRequestableLiquidityCalldata(big.NewInt(100))
	if err != nil {
		t.Fatalf("InitializeGlobalRequestableLiquidityCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("initializeGlobalRequestableLiquidity(uint256)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestLiquidityPool_InitializeGlobalRequestableLiquidityCalldata_NilValue verifies nil value returns UserError.
func TestLiquidityPool_InitializeGlobalRequestableLiquidityCalldata_NilValue(t *testing.T) {
	t.Parallel()
	pool := newOfflineLiquidityPool(t)
	_, err := pool.InitializeGlobalRequestableLiquidityCalldata(nil)
	if !errors.Is(err, ErrNilBigIntParam) {
		t.Fatalf("expected ErrNilBigIntParam, got %v", err)
	}
	var ue *UserError
	if !errors.As(err, &ue) {
		t.Fatalf("expected *UserError, got %T", err)
	}
}

// TestLiquidityPool_DistributeGlobalLossCalldata verifies selector correctness.
func TestLiquidityPool_DistributeGlobalLossCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineLiquidityPool(t)
	riskID := [32]byte(crypto.Keccak256Hash([]byte("global-loss")))

	data, err := pool.DistributeGlobalLossCalldata(riskID, big.NewInt(10))
	if err != nil {
		t.Fatalf("DistributeGlobalLossCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("distributeGlobalLoss(bytes32,uint256)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestLiquidityPool_DistributeGlobalLossCalldata_NilNetLoss verifies nil netLoss returns UserError.
func TestLiquidityPool_DistributeGlobalLossCalldata_NilNetLoss(t *testing.T) {
	t.Parallel()
	pool := newOfflineLiquidityPool(t)
	_, err := pool.DistributeGlobalLossCalldata([32]byte{0x01}, nil)
	if !errors.Is(err, ErrNilBigIntParam) {
		t.Fatalf("expected ErrNilBigIntParam, got %v", err)
	}
	var ue *UserError
	if !errors.As(err, &ue) {
		t.Fatalf("expected *UserError, got %T", err)
	}
}

// TestLiquidityPool_DistributeGlobalMarginCalldata verifies selector correctness.
func TestLiquidityPool_DistributeGlobalMarginCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineLiquidityPool(t)
	riskID := [32]byte(crypto.Keccak256Hash([]byte("global-margin")))

	data, err := pool.DistributeGlobalMarginCalldata(riskID, big.NewInt(20))
	if err != nil {
		t.Fatalf("DistributeGlobalMarginCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("distributeGlobalMargin(bytes32,uint256)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestLiquidityPool_DistributeGlobalMarginCalldata_NilMargin verifies nil margin returns UserError.
func TestLiquidityPool_DistributeGlobalMarginCalldata_NilMargin(t *testing.T) {
	t.Parallel()
	pool := newOfflineLiquidityPool(t)
	_, err := pool.DistributeGlobalMarginCalldata([32]byte{0x01}, nil)
	if !errors.Is(err, ErrNilBigIntParam) {
		t.Fatalf("expected ErrNilBigIntParam, got %v", err)
	}
	var ue *UserError
	if !errors.As(err, &ue) {
		t.Fatalf("expected *UserError, got %T", err)
	}
}

// TestLiquidityPool_ReleasePayoutReserveCalldata verifies selector correctness.
func TestLiquidityPool_ReleasePayoutReserveCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineLiquidityPool(t)
	matchID := [32]byte(crypto.Keccak256Hash([]byte("release-match")))

	data, err := pool.ReleasePayoutReserveCalldata(matchID)
	if err != nil {
		t.Fatalf("ReleasePayoutReserveCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("releasePayoutReserve(bytes32)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestLiquidityPool_OpenMatchPoolCalldata verifies selector correctness.
func TestLiquidityPool_OpenMatchPoolCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineLiquidityPool(t)
	matchID := [32]byte(crypto.Keccak256Hash([]byte("open-match-pool")))

	data, err := pool.OpenMatchPoolCalldata(matchID, 1_700_100_000, 1_700_106_000)
	if err != nil {
		t.Fatalf("OpenMatchPoolCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("openMatchPool(bytes32,uint64,uint64)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestLiquidityPool_CloseMatchPoolDepositCalldata verifies selector correctness.
func TestLiquidityPool_CloseMatchPoolDepositCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineLiquidityPool(t)
	matchID := [32]byte(crypto.Keccak256Hash([]byte("close-match-pool")))

	data, err := pool.CloseMatchPoolDepositCalldata(matchID)
	if err != nil {
		t.Fatalf("CloseMatchPoolDepositCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("closeMatchPoolDeposit(bytes32)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestLiquidityPool_DistributeLossCalldata verifies selector correctness.
func TestLiquidityPool_DistributeLossCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineLiquidityPool(t)
	matchID := [32]byte(crypto.Keccak256Hash([]byte("match-loss")))

	data, err := pool.DistributeLossCalldata(matchID, big.NewInt(10))
	if err != nil {
		t.Fatalf("DistributeLossCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("distributeLoss(bytes32,uint256)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestLiquidityPool_DistributeLossCalldata_NilNetLoss verifies nil netLoss returns UserError.
func TestLiquidityPool_DistributeLossCalldata_NilNetLoss(t *testing.T) {
	t.Parallel()
	pool := newOfflineLiquidityPool(t)
	_, err := pool.DistributeLossCalldata([32]byte{0x01}, nil)
	if !errors.Is(err, ErrNilBigIntParam) {
		t.Fatalf("expected ErrNilBigIntParam, got %v", err)
	}
	var ue *UserError
	if !errors.As(err, &ue) {
		t.Fatalf("expected *UserError, got %T", err)
	}
}

// TestLiquidityPool_DistributeMarginCalldata verifies selector correctness.
func TestLiquidityPool_DistributeMarginCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineLiquidityPool(t)
	matchID := [32]byte(crypto.Keccak256Hash([]byte("match-margin")))

	data, err := pool.DistributeMarginCalldata(matchID, big.NewInt(20))
	if err != nil {
		t.Fatalf("DistributeMarginCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("distributeMargin(bytes32,uint256)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestLiquidityPool_DistributeMarginCalldata_NilMargin verifies nil margin returns UserError.
func TestLiquidityPool_DistributeMarginCalldata_NilMargin(t *testing.T) {
	t.Parallel()
	pool := newOfflineLiquidityPool(t)
	_, err := pool.DistributeMarginCalldata([32]byte{0x01}, nil)
	if !errors.Is(err, ErrNilBigIntParam) {
		t.Fatalf("expected ErrNilBigIntParam, got %v", err)
	}
	var ue *UserError
	if !errors.As(err, &ue) {
		t.Fatalf("expected *UserError, got %T", err)
	}
}

// TestLiquidityPool_RequestPayoutLiquidityCalldata verifies selector correctness.
func TestLiquidityPool_RequestPayoutLiquidityCalldata(t *testing.T) {
	t.Parallel()
	pool := newOfflineLiquidityPool(t)
	matchID := [32]byte(crypto.Keccak256Hash([]byte("request-payout-liquidity")))

	data, err := pool.RequestPayoutLiquidityCalldata(matchID, big.NewInt(30))
	if err != nil {
		t.Fatalf("RequestPayoutLiquidityCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("requestPayoutLiquidity(bytes32,uint256)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestLiquidityPool_RequestPayoutLiquidityCalldata_NilAmount verifies nil amount returns UserError.
func TestLiquidityPool_RequestPayoutLiquidityCalldata_NilAmount(t *testing.T) {
	t.Parallel()
	pool := newOfflineLiquidityPool(t)
	_, err := pool.RequestPayoutLiquidityCalldata([32]byte{0x01}, nil)
	if !errors.Is(err, ErrNilBigIntParam) {
		t.Fatalf("expected ErrNilBigIntParam, got %v", err)
	}
	var ue *UserError
	if !errors.As(err, &ue) {
		t.Fatalf("expected *UserError, got %T", err)
	}
}
