package relay

import (
	"context"
	"errors"
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"go.uber.org/zap"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
)

// newClaimEcosystemRewardTestClient builds a Client wired just enough to exercise
// the pre-submit validation branches of ClaimEcosystemReward (no eth/sdk/multicall,
// so any path reaching resolveUserAddr+calldata+submit would touch nil deps —
// these tests deliberately stop before it).
func newClaimEcosystemRewardTestClient(ecosystemRewards common.Address) *Client {
	return &Client{
		cfg:       Config{ChainID: big.NewInt(97), EcosystemRewards: ecosystemRewards},
		signer:    &mockSigner{addr: common.HexToAddress("0x000000000000000000000000000000000000A11C")},
		addrCache: &userAddrCache{},
		log:       zap.NewNop(),
	}
}

func TestClaimEcosystemReward_ValidationErrors(t *testing.T) {
	// EcosystemRewards configured so the only failing gate is the field under test.
	rewards := common.HexToAddress("0x71f0C250e8f9cE43626822dE118bC07FBb72CDA4")
	c := newClaimEcosystemRewardTestClient(rewards)

	cases := []struct {
		name string
		req  ClaimEcosystemRewardRequest
	}{
		{"empty user id", ClaimEcosystemRewardRequest{UserID: "", ClaimID: big.NewInt(1), IdempotencyKey: "k"}},
		{"nil claim id", ClaimEcosystemRewardRequest{UserID: "u1", ClaimID: nil, IdempotencyKey: "k"}},
		{"zero claim id", ClaimEcosystemRewardRequest{UserID: "u1", ClaimID: big.NewInt(0), IdempotencyKey: "k"}},
		{"negative claim id", ClaimEcosystemRewardRequest{UserID: "u1", ClaimID: big.NewInt(-1), IdempotencyKey: "k"}},
		{"empty idempotency key", ClaimEcosystemRewardRequest{UserID: "u1", ClaimID: big.NewInt(1), IdempotencyKey: ""}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := c.ClaimEcosystemReward(context.Background(), tc.req)
			if err == nil {
				t.Fatal("expected error, got nil")
			}
			if !errors.Is(err, coretypes.ErrParamInvalid) {
				t.Errorf("want ErrParamInvalid, got %v", err)
			}
		})
	}
}

// A request with valid fields must still fail when EcosystemRewards is unset,
// proving the not-configured gate runs (and is reached only past field validation,
// before any nil-dependency access).
func TestClaimEcosystemReward_NotConfigured(t *testing.T) {
	c := newClaimEcosystemRewardTestClient(common.Address{})
	_, err := c.ClaimEcosystemReward(context.Background(), ClaimEcosystemRewardRequest{
		UserID: "u1", ClaimID: big.NewInt(1), IdempotencyKey: "k",
	})
	if err == nil {
		t.Fatal("expected EcosystemRewards-not-configured error, got nil")
	}
	if !errors.Is(err, coretypes.ErrParamInvalid) {
		t.Errorf("want ErrParamInvalid, got %v", err)
	}
}
