// methods_validation_test.go — chain-free white-box unit tests for the input
// validation guarding the SDK v0.0.5 score-based settlement methods.
//
// These exercise ONLY the pre-RPC validation branch, which returns before any
// of the Client's eth / sdk / action-repo fields are touched. A zero-value
// *Client is therefore sufficient and no live chain or DB is required.
//
// Happy-path encoding + on-chain behavior is covered by the e2e tests
// (TestScenarioFullMatch / TestScenarioUpdateOddsAndRefundBets /
// TestScenarioMarketRefund) and by the SDK's own *Calldata selector tests.

package admin

import (
	"context"
	"errors"
	"testing"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
)

func TestSettleMarketBetsByScore_RejectsEmptyBetIDs(t *testing.T) {
	c := &Client{}
	_, err := c.SettleMarketBetsByScore(context.Background(), SettleMarketBetsByScoreRequest{
		HomeScore:      2,
		AwayScore:      1,
		BetIDs:         nil,
		IdempotencyKey: "unit-empty",
	})
	if !errors.Is(err, coretypes.ErrParamInvalid) {
		t.Fatalf("empty betIDs: got err=%v, want ErrParamInvalid", err)
	}
}

func TestSettleMarketBetsByScore_RejectsOversizeBatch(t *testing.T) {
	c := &Client{}
	bets := make([]coretypes.BetID, MaxSettleScoreBatch+1) // 51 > FINALIZE_BATCH_HARD_CAP
	_, err := c.SettleMarketBetsByScore(context.Background(), SettleMarketBetsByScoreRequest{
		HomeScore:      0,
		AwayScore:      0,
		BetIDs:         bets,
		IdempotencyKey: "unit-oversize",
	})
	if !errors.Is(err, coretypes.ErrParamInvalid) {
		t.Fatalf("oversize batch (%d): got err=%v, want ErrParamInvalid", len(bets), err)
	}
}

func TestFinalizeMarketSettlement_RejectsResultKindOutOfRange(t *testing.T) {
	c := &Client{}
	for _, kind := range []uint8{3, 4, 255} {
		_, err := c.FinalizeMarketSettlement(context.Background(), FinalizeMarketSettlementRequest{
			ResultKind:     kind,
			IdempotencyKey: "unit-badkind",
		})
		if !errors.Is(err, coretypes.ErrParamInvalid) {
			t.Fatalf("resultKind=%d: got err=%v, want ErrParamInvalid", kind, err)
		}
	}
}
