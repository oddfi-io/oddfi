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

// newApproveUsdtTestClient builds a Client wired just enough to exercise the
// pre-submit validation branches of ApproveUsdt (no eth/sdk/multicall, so any
// path reaching submit would panic — these tests deliberately stop before it).
func newApproveUsdtTestClient(usdt common.Address) *Client {
	return &Client{
		cfg:       Config{ChainID: big.NewInt(97), USDT: usdt},
		signer:    &mockSigner{addr: common.HexToAddress("0x000000000000000000000000000000000000A11C")},
		addrCache: &userAddrCache{},
		log:       zap.NewNop(),
	}
}

func TestApproveUsdt_ValidationErrors(t *testing.T) {
	usdt := common.HexToAddress("0x337610d27c682E347C9cD60BD4b3b107C9d34dDd")
	spender := common.HexToAddress("0xBe938fB7AF656B111a123B749bB724d8351497C7")
	c := newApproveUsdtTestClient(usdt)

	cases := []struct {
		name string
		req  ApproveUsdtRequest
	}{
		{"empty user id", ApproveUsdtRequest{UserID: "", Spender: spender, Value: big.NewInt(1), IdempotencyKey: "k"}},
		{"zero spender", ApproveUsdtRequest{UserID: "u1", Spender: common.Address{}, Value: big.NewInt(1), IdempotencyKey: "k"}},
		{"nil value", ApproveUsdtRequest{UserID: "u1", Spender: spender, Value: nil, IdempotencyKey: "k"}},
		{"empty idempotency key", ApproveUsdtRequest{UserID: "u1", Spender: spender, Value: big.NewInt(1), IdempotencyKey: ""}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := c.ApproveUsdt(context.Background(), tc.req)
			if err == nil {
				t.Fatal("expected error, got nil")
			}
			if !errors.Is(err, coretypes.ErrParamInvalid) {
				t.Errorf("want ErrParamInvalid, got %v", err)
			}
		})
	}
}

// Value == 0 is a legal revoke, so a zero value must pass field validation and
// fall through to the next gate (here, the USDT-not-configured check) rather
// than being rejected as an invalid request.
func TestApproveUsdt_ZeroValueIsLegalRevoke(t *testing.T) {
	spender := common.HexToAddress("0xBe938fB7AF656B111a123B749bB724d8351497C7")
	// USDT unset → the zero-value request must fail on the USDT gate, proving it
	// got PAST the field validation (a nil value would have failed earlier).
	c := newApproveUsdtTestClient(common.Address{})
	_, err := c.ApproveUsdt(context.Background(), ApproveUsdtRequest{
		UserID: "u1", Spender: spender, Value: big.NewInt(0), IdempotencyKey: "k",
	})
	if err == nil {
		t.Fatal("expected USDT-not-configured error, got nil")
	}
	if !errors.Is(err, coretypes.ErrParamInvalid) {
		t.Errorf("want ErrParamInvalid, got %v", err)
	}
}

func TestApproveUsdt_UsdtNotConfigured(t *testing.T) {
	spender := common.HexToAddress("0xBe938fB7AF656B111a123B749bB724d8351497C7")
	// Valid request fields, but Config.USDT is the zero address → must error
	// instead of approving the zero address.
	c := newApproveUsdtTestClient(common.Address{})
	_, err := c.ApproveUsdt(context.Background(), ApproveUsdtRequest{
		UserID: "u1", Spender: spender, Value: big.NewInt(1), IdempotencyKey: "k",
	})
	if err == nil {
		t.Fatal("expected error when USDT unconfigured, got nil")
	}
	if !errors.Is(err, coretypes.ErrParamInvalid) {
		t.Errorf("want ErrParamInvalid, got %v", err)
	}
}
