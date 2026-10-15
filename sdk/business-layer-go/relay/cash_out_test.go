package relay

import (
	"errors"
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
)

func validCashOutReq() CashOutRequest {
	return CashOutRequest{
		UserID:               "user-A",
		BetID:                coretypes.BetID{0x01},
		ExpectedQuoteVersion: big.NewInt(7),
		QuotedAt:             1900000000,
		MinAmountOut:         big.NewInt(100),
		Deadline:             1900000030,
		IdempotencyKey:       "idem-1",
	}
}

func TestValidateCashOut(t *testing.T) {
	tests := []struct {
		name    string
		mutate  func(*CashOutRequest)
		wantErr bool
	}{
		{"valid", func(*CashOutRequest) {}, false},
		{"zero MinAmountOut allowed", func(r *CashOutRequest) { r.MinAmountOut = big.NewInt(0) }, false},
		{"empty UserID", func(r *CashOutRequest) { r.UserID = "" }, true},
		{"zero BetID", func(r *CashOutRequest) { r.BetID = coretypes.BetID{} }, true},
		{"nil ExpectedQuoteVersion", func(r *CashOutRequest) { r.ExpectedQuoteVersion = nil }, true},
		{"zero QuotedAt", func(r *CashOutRequest) { r.QuotedAt = 0 }, true},
		{"nil MinAmountOut", func(r *CashOutRequest) { r.MinAmountOut = nil }, true},
		{"negative MinAmountOut", func(r *CashOutRequest) { r.MinAmountOut = big.NewInt(-1) }, true},
		{"zero Deadline", func(r *CashOutRequest) { r.Deadline = 0 }, true},
		{"empty IdempotencyKey", func(r *CashOutRequest) { r.IdempotencyKey = "" }, true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := validCashOutReq()
			tc.mutate(&req)
			err := validateCashOut(req)
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

// TestParseBetCashedOut decodes a synthetic BettingPool BetCashedOut log and
// verifies cashOutAmount (data[32:64]) + betId (topics[1]) are extracted, and
// that logs from other addresses / topics are ignored. Mirrors the SDK's
// selector-correctness style but for the business-layer receipt decoder.
func TestParseBetCashedOut(t *testing.T) {
	bp := common.HexToAddress("0x000000000000000000000000000000000000bEEF")
	betID := coretypes.BetID{0xAB, 0xCD}
	marketID := common.HexToHash("0x1111111111111111111111111111111111111111111111111111111111111111")
	user := common.HexToAddress("0x000000000000000000000000000000000000dEaD")

	remainingStake := big.NewInt(111)
	cashOutAmount := big.NewInt(222_000_000)
	currentOdds := big.NewInt(20000)
	feeBps := big.NewInt(1000)
	quoteVersion := big.NewInt(8)

	data := make([]byte, 160)
	copy(data[0:32], common.LeftPadBytes(remainingStake.Bytes(), 32))
	copy(data[32:64], common.LeftPadBytes(cashOutAmount.Bytes(), 32))
	copy(data[64:96], common.LeftPadBytes(currentOdds.Bytes(), 32))
	copy(data[96:128], common.LeftPadBytes(feeBps.Bytes(), 32))
	copy(data[128:160], common.LeftPadBytes(quoteVersion.Bytes(), 32))

	matchLog := &types.Log{
		Address: bp,
		Topics: []common.Hash{
			betCashedOutTopic0,
			common.BytesToHash(betID[:]),
			marketID,
			common.BytesToHash(user.Bytes()),
		},
		Data: data,
	}

	t.Run("decodes matching log", func(t *testing.T) {
		receipt := &types.Receipt{Logs: []*types.Log{matchLog}}
		got := parseBetCashedOut(receipt, bp)
		if !got.Found {
			t.Fatalf("expected Found=true")
		}
		if got.BetID != betID {
			t.Errorf("BetID: got %x want %x", got.BetID, betID)
		}
		if got.CashOutAmount == nil || got.CashOutAmount.Cmp(cashOutAmount) != 0 {
			t.Errorf("CashOutAmount: got %v want %v", got.CashOutAmount, cashOutAmount)
		}
	})

	t.Run("ignores log from another address", func(t *testing.T) {
		other := common.HexToAddress("0x0000000000000000000000000000000000000001")
		receipt := &types.Receipt{Logs: []*types.Log{matchLog}}
		if got := parseBetCashedOut(receipt, other); got.Found {
			t.Errorf("expected Found=false for non-BettingPool address")
		}
	})

	t.Run("ignores unrelated topic0", func(t *testing.T) {
		wrong := *matchLog
		wrong.Topics = []common.Hash{betPlacedTopic0, matchLog.Topics[1], matchLog.Topics[2], matchLog.Topics[3]}
		receipt := &types.Receipt{Logs: []*types.Log{&wrong}}
		if got := parseBetCashedOut(receipt, bp); got.Found {
			t.Errorf("expected Found=false for non-BetCashedOut topic0")
		}
	})
}
