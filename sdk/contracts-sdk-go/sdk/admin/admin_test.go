package admin

import (
	"context"
	"errors"
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"

	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/bindings/bettingpool"
)

// bettingpoolMetaABI parses the meta-data string the same way New does.
func bettingpoolMetaABI() (*abi.ABI, error) {
	return bettingpool.BettingPoolMetaData.GetAbi()
}

func TestNew_NilConn(t *testing.T) {
	if _, err := New(nil); err == nil {
		t.Error("expected error for nil Connection")
	}
}

func TestEnums_String(t *testing.T) {
	cases := map[MarketType]string{
		MarketX12: "X12", MarketAH: "AH", MarketOU: "OU",
		MarketType(99): "MarketType(?)",
	}
	for m, want := range cases {
		if got := m.String(); got != want {
			t.Errorf("MarketType(%d).String() = %q, want %q", m, got, want)
		}
	}
	colorCases := map[SignalColor]string{
		SignalGreen: "Green", SignalYellow: "Yellow", SignalRed: "Red",
		SignalColor(7): "SignalColor(?)",
	}
	for c, want := range colorCases {
		if got := c.String(); got != want {
			t.Errorf("SignalColor(%d).String() = %q, want %q", c, got, want)
		}
	}
}

func TestMarketTypesToUint8(t *testing.T) {
	in := []MarketType{MarketX12, MarketAH, MarketOU, MarketX12}
	got := marketTypesToUint8(in)
	want := []uint8{0, 1, 2, 0}
	if len(got) != len(want) {
		t.Fatalf("len mismatch: got %d want %d", len(got), len(want))
	}
	for i := range got {
		if got[i] != want[i] {
			t.Errorf("[%d] got %d want %d", i, got[i], want[i])
		}
	}
}

func TestLockParlayArgs_Validate(t *testing.T) {
	mk := func(n int) LockParlayArgs {
		return LockParlayArgs{
			ParlayID: [32]byte{1}, User: common.Address{}, Stake: big.NewInt(1),
			MatchIDs:  make([][32]byte, n),
			Markets:   make([]MarketType, n),
			Outcomes:  make([]uint8, n),
			Lines:     make([]uint8, n),
			LegOdds:   make([]*big.Int, n),
			LegBetIDs: make([][32]byte, n),
		}
	}
	ok2 := mk(2)
	if err := ok2.validate(); err != nil {
		t.Errorf("len=2 should validate, got %v", err)
	}
	bad1 := mk(1)
	if err := bad1.validate(); err == nil {
		t.Error("len=1 should fail (need ≥2 legs)")
	}
	bad := mk(3)
	bad.Markets = bad.Markets[:2]
	if err := bad.validate(); err == nil {
		t.Error("mismatched lengths should fail")
	}
}

// ── transactOpts / simulateCall require a real Connection. We can't build a
//    *client.Connection without an RPC. Skip those paths in unit tests; they
//    are exercised in Phase 4 fork tests. We still check the SDK-internal
//    branches that don't touch the wire. ──

func TestTransactOpts_NoSigner(t *testing.T) {
	c := &Client{} // zero-value Client (no signer)
	if _, err := c.transactOpts(context.Background()); !errors.Is(err, ErrNoSigner) {
		t.Errorf("expected ErrNoSigner, got %v", err)
	}
}

func TestClient_AddressZeroWithoutSigner(t *testing.T) {
	c := &Client{}
	if got := c.Address(); got != (common.Address{}) {
		t.Errorf("Address() = %s, want zero", got.Hex())
	}
}

// ── ABI introspection sanity: every admin method we expose must exist in the
//    parsed BettingPool ABI. Catches signature drift if abigen output
//    diverges from our hand-written wrappers. Doesn't need a Connection. ──

func TestParsedABIHasAllAdminMethods(t *testing.T) {
	parsed, err := bettingpoolMetaABI()
	if err != nil {
		t.Fatalf("parse abi: %v", err)
	}
	want := []string{
		"creditDeposit",
		"openMarket", "closeMarket",
		"batchOpenMarkets", "batchCloseMarkets",
		"lockBet", "lockCreditBet", "lockParlay",
		"unlockBet", "unlockParlay",
		"updateSignal",
	}
	for _, name := range want {
		m, ok := parsed.Methods[name]
		if !ok {
			t.Errorf("ABI missing method %q", name)
			continue
		}
		// Cross-check the input arity for the most-called methods to catch
		// argument-order drift in abigen output.
		switch name {
		case "lockBet":
			if got := len(m.Inputs); got != 8 {
				t.Errorf("lockBet inputs = %d, want 8", got)
			}
		case "lockParlay":
			if got := len(m.Inputs); got != 9 {
				t.Errorf("lockParlay inputs = %d, want 9", got)
			}
		case "creditDeposit":
			if got := len(m.Inputs); got != 3 {
				t.Errorf("creditDeposit inputs = %d, want 3", got)
			}
		}
	}
}

