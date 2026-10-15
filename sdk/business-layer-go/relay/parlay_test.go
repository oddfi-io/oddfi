// parlay_test.go — chain-free white-box unit tests for the parlay relay layer:
//   1. validatePlaceParlay — input validation (leg bounds, quote snapshot, etc.)
//   2. parseParlayPlaced / parseParlayPayoutClaimed — receipt log decoding.
//
// No chain, DB, or Magic signer is touched: validation returns before any
// Client field is used, and the event parsers operate on a hand-built receipt.
// Happy-path on-chain behavior is covered by TestParlayDirectE2E.

package relay

import (
	"errors"
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
)

func validLeg(matchByte byte) coretypes.ParlayLegInput {
	return coretypes.ParlayLegInput{
		Market:       coretypes.MarketKey{MatchID: coretypes.MatchID{matchByte}, MarketType: 0, Line: 0},
		Outcome:      0,
		QuoteVersion: big.NewInt(1),
		QuotedAt:     1900000000,
		MinOdds:      big.NewInt(20000),
	}
}

func validParlayReq() PlaceParlayRequest {
	return PlaceParlayRequest{
		UserID:         "user-A",
		Legs:           []coretypes.ParlayLegInput{validLeg(0x01), validLeg(0x02)},
		Stake:          big.NewInt(100),
		MinComboOdds:   big.NewInt(39000),
		Deadline:       1900000000,
		IdempotencyKey: "idem-parlay-1",
	}
}

func TestValidatePlaceParlay(t *testing.T) {
	sixLegs := func() []coretypes.ParlayLegInput {
		legs := make([]coretypes.ParlayLegInput, 6)
		for i := range legs {
			legs[i] = validLeg(byte(0x10 + i))
		}
		return legs
	}
	tests := []struct {
		name    string
		mutate  func(*PlaceParlayRequest)
		wantErr bool
	}{
		{"valid", func(*PlaceParlayRequest) {}, false},
		{"valid 6 legs", func(r *PlaceParlayRequest) { r.Legs = sixLegs() }, false},
		{"empty UserID", func(r *PlaceParlayRequest) { r.UserID = "" }, true},
		{"one leg (below min)", func(r *PlaceParlayRequest) { r.Legs = r.Legs[:1] }, true},
		{"seven legs (above max)", func(r *PlaceParlayRequest) {
			legs := sixLegs()
			r.Legs = append(legs, validLeg(0x99))
		}, true},
		{"zero MatchID in leg", func(r *PlaceParlayRequest) { r.Legs[1].Market.MatchID = coretypes.MatchID{} }, true},
		{"nil QuoteVersion in leg", func(r *PlaceParlayRequest) { r.Legs[0].QuoteVersion = nil }, true},
		{"zero QuotedAt in leg", func(r *PlaceParlayRequest) { r.Legs[0].QuotedAt = 0 }, true},
		{"nil MinOdds in leg", func(r *PlaceParlayRequest) { r.Legs[0].MinOdds = nil }, true},
		{"negative MinOdds in leg", func(r *PlaceParlayRequest) { r.Legs[0].MinOdds = big.NewInt(-1) }, true},
		{"nil Stake", func(r *PlaceParlayRequest) { r.Stake = nil }, true},
		{"zero Stake", func(r *PlaceParlayRequest) { r.Stake = big.NewInt(0) }, true},
		{"zero Deadline", func(r *PlaceParlayRequest) { r.Deadline = 0 }, true},
		{"empty IdempotencyKey", func(r *PlaceParlayRequest) { r.IdempotencyKey = "" }, true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := validParlayReq()
			tc.mutate(&req)
			err := validatePlaceParlay(req)
			if tc.wantErr && err == nil {
				t.Fatalf("expected error, got nil")
			}
			if !tc.wantErr && err != nil {
				t.Fatalf("expected nil, got %v", err)
			}
			if tc.wantErr && err != nil && !errors.Is(err, coretypes.ErrParamInvalid) {
				t.Errorf("expected ErrParamInvalid, got %v", err)
			}
		})
	}
}

// slot32 right-aligns v into a 32-byte big-endian slot (abi.encode of uint256).
func slot32(v *big.Int) []byte {
	return common.LeftPadBytes(v.Bytes(), 32)
}

func TestParseParlayPlaced(t *testing.T) {
	bp := common.HexToAddress("0x000000000000000000000000000000000000bbbb")
	parlayID := common.HexToHash("0xabc123")
	user := common.HexToHash("0x00000000000000000000000000000000000000aa")
	riskID := common.HexToHash("0xdeadbeef")

	// data: stake, betTax, totalDeduct, legCount, lockedComboOdds, maxPayout
	var data []byte
	data = append(data, slot32(big.NewInt(100))...)   // stake
	data = append(data, slot32(big.NewInt(1))...)     // betTax
	data = append(data, slot32(big.NewInt(101))...)   // totalDeduct
	data = append(data, slot32(big.NewInt(2))...)     // legCount
	data = append(data, slot32(big.NewInt(40000))...) // lockedComboOdds
	data = append(data, slot32(big.NewInt(400))...)   // maxPayout

	receipt := &types.Receipt{Logs: []*types.Log{
		{Address: common.HexToAddress("0x000000000000000000000000000000000000cccc"), Topics: []common.Hash{{0x01}}}, // ignored
		{
			Address: bp,
			Topics:  []common.Hash{parlayPlacedTopic0, parlayID, user, riskID},
			Data:    data,
		},
	}}

	got := parseParlayPlaced(receipt, bp)
	if !got.Found {
		t.Fatalf("expected Found=true")
	}
	if common.Hash(got.ParlayID) != parlayID {
		t.Errorf("ParlayID = %x, want %x", got.ParlayID, parlayID)
	}
	if got.LockedComboOdds.Cmp(big.NewInt(40000)) != 0 {
		t.Errorf("LockedComboOdds = %s, want 40000", got.LockedComboOdds)
	}
	if got.MaxPayout.Cmp(big.NewInt(400)) != 0 {
		t.Errorf("MaxPayout = %s, want 400", got.MaxPayout)
	}

	// Wrong contract address → not found.
	if parseParlayPlaced(receipt, common.HexToAddress("0x000000000000000000000000000000000000dddd")).Found {
		t.Errorf("expected not Found for wrong bp address")
	}
}

func TestParseParlayPayoutClaimed(t *testing.T) {
	bp := common.HexToAddress("0x000000000000000000000000000000000000bbbb")
	parlayID := common.HexToHash("0xfeed")
	user := common.HexToHash("0x00000000000000000000000000000000000000aa")

	// data: grossPayout, taxAmount, netPayout
	var data []byte
	data = append(data, slot32(big.NewInt(400))...) // grossPayout
	data = append(data, slot32(big.NewInt(20))...)  // taxAmount
	data = append(data, slot32(big.NewInt(380))...) // netPayout

	receipt := &types.Receipt{Logs: []*types.Log{{
		Address: bp,
		Topics:  []common.Hash{parlayPayoutClaimedTopic0, parlayID, user},
		Data:    data,
	}}}

	got := parseParlayPayoutClaimed(receipt, bp)
	if !got.Found {
		t.Fatalf("expected Found=true")
	}
	if got.NetPayout.Cmp(big.NewInt(380)) != 0 {
		t.Errorf("NetPayout = %s, want 380", got.NetPayout)
	}
}

// Guard: the hardcoded topic0 hashes must match the contract event signatures.
func TestParlayTopicHashes(t *testing.T) {
	wantPlaced := crypto.Keccak256Hash([]byte(
		"ParlayPlaced(bytes32,address,uint256,uint256,uint256,uint8,uint256,uint256,bytes32)"))
	if parlayPlacedTopic0 != wantPlaced {
		t.Errorf("parlayPlacedTopic0 mismatch")
	}
	wantClaimed := crypto.Keccak256Hash([]byte(
		"ParlayPayoutClaimed(bytes32,address,uint256,uint256,uint256)"))
	if parlayPayoutClaimedTopic0 != wantClaimed {
		t.Errorf("parlayPayoutClaimedTopic0 mismatch")
	}
}
