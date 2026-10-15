package relay

import (
	"errors"
	"math/big"
	"testing"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
)

func validReq() PlaceBetRequest {
	return PlaceBetRequest{
		UserID:         "user-A",
		Market:         coretypes.MarketKey{MatchID: coretypes.MatchID{0x01}, MarketType: 0, Line: 0},
		Outcome:        0,
		Amount:         big.NewInt(100),
		Deadline:       1900000000,
		IdempotencyKey: "idem-1",
	}
}

func TestValidatePlaceBet(t *testing.T) {
	tests := []struct {
		name    string
		mutate  func(*PlaceBetRequest)
		wantErr bool
	}{
		{"valid", func(*PlaceBetRequest) {}, false},
		{"empty UserID", func(r *PlaceBetRequest) { r.UserID = "" }, true},
		{"zero MatchID", func(r *PlaceBetRequest) { r.Market.MatchID = coretypes.MatchID{} }, true},
		{"nil Amount", func(r *PlaceBetRequest) { r.Amount = nil }, true},
		{"zero Amount", func(r *PlaceBetRequest) { r.Amount = big.NewInt(0) }, true},
		{"negative Amount", func(r *PlaceBetRequest) { r.Amount = big.NewInt(-1) }, true},
		{"zero Deadline", func(r *PlaceBetRequest) { r.Deadline = 0 }, true},
		{"empty IdempotencyKey", func(r *PlaceBetRequest) { r.IdempotencyKey = "" }, true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := validReq()
			tc.mutate(&req)
			err := validatePlaceBet(req)
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
