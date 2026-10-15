package oddfi

// Note: adapter-level abi.Pack failure for the EcosystemRewards Calldata method is
// structurally unreachable from the typed public facade — the single parameter is a
// fixed *big.Int that the ABI binding accepts unconditionally. The
// wrapUserError(op, err) path on adapter failure exists as defense-in-depth for
// ABI drift after binding regeneration. The nil-bigint test covers the only
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

type stubEcosystemRewardsCaller struct{}

func (stubEcosystemRewardsCaller) CodeAt(_ context.Context, _ common.Address, _ *big.Int) ([]byte, error) {
	return []byte{0x60}, nil
}
func (stubEcosystemRewardsCaller) CallContract(_ context.Context, _ ethereum.CallMsg, _ *big.Int) ([]byte, error) {
	return nil, errors.New("stub call contract")
}

func newOfflineEcosystemRewards(t *testing.T) *EcosystemRewards {
	t.Helper()
	adapter, err := contracts.NewEcosystemRewardsAdapter(stubEcosystemRewardsCaller{}, nil, common.HexToAddress("0x0000000000000000000000000000000000000001"))
	if err != nil {
		t.Fatalf("build adapter: %v", err)
	}
	return &EcosystemRewards{adapter: adapter}
}

// TestEcosystemRewards_ClaimCalldata verifies selector correctness.
func TestEcosystemRewards_ClaimCalldata(t *testing.T) {
	t.Parallel()
	rewards := newOfflineEcosystemRewards(t)

	data, err := rewards.ClaimCalldata(big.NewInt(42))
	if err != nil {
		t.Fatalf("ClaimCalldata: %v", err)
	}
	if len(data) < 4 {
		t.Fatalf("calldata too short: %d", len(data))
	}
	wantSel := crypto.Keccak256([]byte("claim(uint256)"))[:4]
	if !bytes.Equal(data[:4], wantSel) {
		t.Fatalf("selector mismatch: got %x want %x", data[:4], wantSel)
	}
}

// TestEcosystemRewards_ClaimCalldata_NilReceiver verifies nil *EcosystemRewards returns ConfigError.
func TestEcosystemRewards_ClaimCalldata_NilReceiver(t *testing.T) {
	t.Parallel()
	_, err := (*EcosystemRewards)(nil).ClaimCalldata(big.NewInt(1))
	if !errors.Is(err, ErrMissingEcosystemRewards) {
		t.Fatalf("expected ErrMissingEcosystemRewards, got %v", err)
	}
	var cfg *ConfigError
	if !errors.As(err, &cfg) {
		t.Fatalf("expected *ConfigError, got %T", err)
	}
}

// TestEcosystemRewards_ClaimCalldata_NilClaimID verifies nil claimID returns UserError.
func TestEcosystemRewards_ClaimCalldata_NilClaimID(t *testing.T) {
	t.Parallel()
	rewards := newOfflineEcosystemRewards(t)
	_, err := rewards.ClaimCalldata(nil)
	if !errors.Is(err, ErrNilBigIntParam) {
		t.Fatalf("expected ErrNilBigIntParam, got %v", err)
	}
	var ue *UserError
	if !errors.As(err, &ue) {
		t.Fatalf("expected *UserError, got %T", err)
	}
}

// TestEcosystemRewards_ClaimCalldata_Deterministic verifies that encoding the same input
// twice yields identical bytes (no mutable state in ABI encoding).
func TestEcosystemRewards_ClaimCalldata_Deterministic(t *testing.T) {
	t.Parallel()
	rewards := newOfflineEcosystemRewards(t)
	claimID := big.NewInt(7)

	data1, err := rewards.ClaimCalldata(claimID)
	if err != nil {
		t.Fatalf("first call: %v", err)
	}
	data2, err := rewards.ClaimCalldata(claimID)
	if err != nil {
		t.Fatalf("second call: %v", err)
	}
	if !bytes.Equal(data1, data2) {
		t.Fatalf("non-deterministic encoding: %x vs %x", data1, data2)
	}
}
