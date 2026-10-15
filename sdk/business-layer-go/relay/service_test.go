package relay

import (
	"context"
	"errors"
	"testing"

	"github.com/ethereum/go-ethereum/common"

	magicclient "github.com/Crypto-Barrett/oddfi-magic-client/client"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
)

// mockSigner implements magicclient.Signer for tests. It records the digests it
// is asked to sign and returns a canned signature.
type mockSigner struct {
	addr        common.Address
	sig         magicclient.Signature
	signErr     error
	walletErr   error
	gotDigests  [][32]byte
	gotUserIDs  []string
	gotWalletID []string
}

// Compile-time check that mockSigner satisfies the relay Signer interface.
var _ Signer = (*mockSigner)(nil)

func (m *mockSigner) WalletAddress(_ context.Context, userID string) (common.Address, error) {
	m.gotWalletID = append(m.gotWalletID, userID)
	if m.walletErr != nil {
		return common.Address{}, m.walletErr
	}
	return m.addr, nil
}

func (m *mockSigner) SignDigest(_ context.Context, userID string, digest [32]byte) (magicclient.Signature, error) {
	m.gotUserIDs = append(m.gotUserIDs, userID)
	m.gotDigests = append(m.gotDigests, digest)
	if m.signErr != nil {
		return magicclient.Signature{}, m.signErr
	}
	return m.sig, nil
}

func TestWrapMagicErr(t *testing.T) {
	tests := []struct {
		name string
		in   error
		// want classifies the coretypes wrapper we expect.
		wantParamInvalid bool
		wantRetryable    bool
		wantInternal     bool
	}{
		{"invalid config", magicclient.ErrInvalidConfig, true, false, false},
		{"bad request", magicclient.ErrBadRequest, true, false, false},
		{"unauthorized", magicclient.ErrUnauthorized, true, false, false},
		{"op not allowed", magicclient.ErrOpNotAllowed, true, false, false},
		{"magic upstream", magicclient.ErrMagicUpstream, false, true, false},
		{"magic network", magicclient.ErrMagicNetwork, false, true, false},
		{"client network", magicclient.ErrNetwork, false, true, false},
		{"server internal", magicclient.ErrServerInternal, false, false, true},
		{"unknown", errors.New("boom"), false, true, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := wrapMagicErr("op", tc.in)
			if got == nil {
				t.Fatal("wrapMagicErr returned nil")
			}
			// The original error must remain unwrappable for diagnostics.
			if !errors.Is(got, tc.in) {
				t.Errorf("errors.Is(got, in) = false; want true")
			}
			if tc.wantParamInvalid && !errors.Is(got, coretypes.ErrParamInvalid) {
				t.Errorf("want ErrParamInvalid, got %v", got)
			}
			if tc.wantInternal && !errors.Is(got, coretypes.ErrInternalInvariant) {
				t.Errorf("want ErrInternalInvariant, got %v", got)
			}
			if tc.wantRetryable && !errors.Is(got, coretypes.ErrInfraRPC) {
				t.Errorf("want ErrInfraRPC (retryable), got %v", got)
			}
		})
	}
}
