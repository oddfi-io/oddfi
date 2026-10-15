// modules_validation_test.go — chain-free white-box unit tests for the input
// validation guarding the SDK v0.0.12 module-setter admin methods
// (SetBetModule / SetMarketModule / SetReferralModule).
//
// Like methods_validation_test.go these exercise ONLY the pre-RPC validation
// branch, which returns before any of the Client's eth / sdk / action-repo fields
// are touched. A zero-value *Client is therefore sufficient; no live chain or DB
// is required. Happy-path encoding is covered by the SDK's *Calldata selector
// tests and the e2e suites.

package admin

import (
	"context"
	"errors"
	"testing"

	"github.com/ethereum/go-ethereum/common"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
)

func TestSetBetModule_RejectsZeroAddress(t *testing.T) {
	c := &Client{}
	_, err := c.SetBetModule(context.Background(), SetBetModuleRequest{
		Module:         common.Address{},
		IdempotencyKey: "unit-zero-bet",
	})
	if !errors.Is(err, coretypes.ErrParamInvalid) {
		t.Fatalf("zero module: got err=%v, want ErrParamInvalid", err)
	}
}

func TestSetMarketModule_RejectsZeroAddress(t *testing.T) {
	c := &Client{}
	_, err := c.SetMarketModule(context.Background(), SetMarketModuleRequest{
		Module:         common.Address{},
		IdempotencyKey: "unit-zero-market",
	})
	if !errors.Is(err, coretypes.ErrParamInvalid) {
		t.Fatalf("zero module: got err=%v, want ErrParamInvalid", err)
	}
}

func TestSetReferralModule_RejectsZeroAddress(t *testing.T) {
	c := &Client{}
	_, err := c.SetReferralModule(context.Background(), SetReferralModuleRequest{
		Module:         common.Address{},
		IdempotencyKey: "unit-zero-referral",
	})
	if !errors.Is(err, coretypes.ErrParamInvalid) {
		t.Fatalf("zero module: got err=%v, want ErrParamInvalid", err)
	}
}
