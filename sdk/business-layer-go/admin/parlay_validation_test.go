// parlay_validation_test.go — chain-free white-box unit tests for the input
// validation guarding the admin parlay methods. Each exercises ONLY the pre-RPC
// zero-value guard, which returns before any Client field (eth / sdk / actions)
// is touched, so a zero-value *Client suffices.
//
// Happy-path encoding + on-chain behavior is covered by TestParlayDirectE2E and
// the SDK's own *Calldata selector tests.

package admin

import (
	"context"
	"errors"
	"testing"

	"github.com/ethereum/go-ethereum/common"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
)

func TestSettleParlay_RejectsZeroID(t *testing.T) {
	c := &Client{}
	_, err := c.SettleParlay(context.Background(), SettleParlayRequest{
		ParlayID:       coretypes.ParlayID{}, // zero
		IdempotencyKey: "unit-settle-zero",
	})
	if !errors.Is(err, coretypes.ErrParamInvalid) {
		t.Fatalf("zero ParlayID: got err=%v, want ErrParamInvalid", err)
	}
}

func TestReleasePayoutReserve_RejectsZeroRisk(t *testing.T) {
	c := &Client{}
	_, err := c.ReleasePayoutReserve(context.Background(), ReleasePayoutReserveRequest{
		RiskID:         [32]byte{}, // zero
		IdempotencyKey: "unit-release-zero",
	})
	if !errors.Is(err, coretypes.ErrParamInvalid) {
		t.Fatalf("zero RiskID: got err=%v, want ErrParamInvalid", err)
	}
}

func TestSetParlayModule_RejectsZeroModule(t *testing.T) {
	c := &Client{}
	_, err := c.SetParlayModule(context.Background(), SetParlayModuleRequest{
		Module:         common.Address{}, // zero
		IdempotencyKey: "unit-setmodule-zero",
	})
	if !errors.Is(err, coretypes.ErrParamInvalid) {
		t.Fatalf("zero Module: got err=%v, want ErrParamInvalid", err)
	}
}
