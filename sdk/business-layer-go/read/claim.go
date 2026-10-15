// claim.go — SDK v0.0.12 BettingPool public query wrappers.
//
// The 2026-06-08 BettingPool modular-entrypoint upgrade exposed four read-only
// query wrappers on the BettingPool proxy (forwarded by staticcall to the
// settlement / parlay modules), plus a per-match market index:
//
//   - GetClaimStatus        — post-match win + net claimable for a single bet.
//   - EstimateBetValue      — in-progress display value + floating PnL for a bet.
//   - GetParlayClaimStatus  — post-match win/refund + net claimable for a parlay.
//   - GetMatchMarketIds     — every marketId opened under a match.
//
// (EstimateParlayValue moved onto the BettingPool wrapper too — see parlay.go.)
//
// All four are user-scoped or match-scoped A-class reads: never cached. They are
// pure forwarders apart from the big.Int -> decimal scaling done by the toX
// mappers, which carry all project-owned logic and are unit-tested directly.

package read

import (
	"context"

	"github.com/ethereum/go-ethereum/common"
	"github.com/shopspring/decimal"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/pkg/oddfi"
)

// ─── DTOs ────────────────────────────────────────────────────────────────

// ClaimStatus is the wrapped form of oddfi.ClaimStatus — the post-match claim
// state of a single bet or parlay. Reward is the net claimable amount in ODD wei
// (payout tax already deducted on the win path). For a Refundable parlay, Won is
// false but Reward carries the refundable principal.
type ClaimStatus struct {
	Won    bool
	Reward decimal.Decimal
}

// BetEstimate is the wrapped form of oddfi.BetEstimatedValue — the display-only
// in-progress valuation of a Pending single bet. EstimatedValue and FloatingPnL
// are NOT claimable and NOT a cash-out quote; FloatingPnL (estimatedValue minus
// remaining stake) may be negative.
type BetEstimate struct {
	EstimatedValue decimal.Decimal
	FloatingPnL    decimal.Decimal
}

// ─── mappers (RPC-free, unit-tested) ──────────────────────────────────────

func toClaimStatus(raw oddfi.ClaimStatus) ClaimStatus {
	return ClaimStatus{
		Won:    raw.Won,
		Reward: wrapBigInt(raw.Reward),
	}
}

func toBetEstimate(raw oddfi.BetEstimatedValue) BetEstimate {
	return BetEstimate{
		EstimatedValue: wrapBigInt(raw.EstimatedValue),
		FloatingPnL:    wrapBigInt(raw.FloatingPnL),
	}
}

func toMarketIDs(raw [][32]byte) []coretypes.MarketID {
	out := make([]coretypes.MarketID, len(raw))
	for i, m := range raw {
		out[i] = coretypes.MarketID(m)
	}
	return out
}

// ─── reads ───────────────────────────────────────────────────────────────

// GetClaimStatus returns whether a single bet has won and the current net
// claimable reward for the given user. User-scoped A-class read (never cached).
// Reverts on-chain if the underlying market has not reached matchEndTime; an
// unknown bet or owner mismatch returns (false, 0) rather than reverting.
func (c *Client) GetClaimStatus(ctx context.Context, user common.Address, betID coretypes.BetID) (ClaimStatus, error) {
	raw, err := c.sdk.BettingPool().GetClaimStatus(ctx, user, [32]byte(betID))
	if err != nil {
		return ClaimStatus{}, wrapInfraRPC("GetClaimStatus", err)
	}
	return toClaimStatus(raw), nil
}

// EstimateBetValue returns the display-only in-progress value and floating PnL of
// a Pending single bet for the given user. Display-only: NOT claimable, NOT a
// cash-out quote. User-scoped A-class read (never cached). Reverts on-chain once
// the bet is settled/refunded/cashed-out or the match has ended.
func (c *Client) EstimateBetValue(ctx context.Context, user common.Address, betID coretypes.BetID) (BetEstimate, error) {
	raw, err := c.sdk.BettingPool().EstimateBetValue(ctx, user, [32]byte(betID))
	if err != nil {
		return BetEstimate{}, wrapInfraRPC("EstimateBetValue", err)
	}
	return toBetEstimate(raw), nil
}

// GetParlayClaimStatus returns whether a parlay has won and the current net
// claimable amount for the given user. A Refundable parlay returns Won=false with
// the refundable principal in Reward. User-scoped A-class read (never cached).
// Reverts on-chain if any leg's market has not reached matchEndTime; an unknown
// parlay or owner mismatch returns (false, 0).
func (c *Client) GetParlayClaimStatus(ctx context.Context, user common.Address, parlayID coretypes.ParlayID) (ClaimStatus, error) {
	raw, err := c.sdk.BettingPool().GetParlayClaimStatus(ctx, user, [32]byte(parlayID))
	if err != nil {
		return ClaimStatus{}, wrapInfraRPC("GetParlayClaimStatus", err)
	}
	return toClaimStatus(raw), nil
}

// GetMatchMarketIds returns every marketId opened under a match. Match-scoped
// read. Takes a MatchID directly (the on-chain index is keyed by match hash).
func (c *Client) GetMatchMarketIds(ctx context.Context, matchID coretypes.MatchID) ([]coretypes.MarketID, error) {
	raw, err := c.sdk.BettingPool().GetMatchMarketIds(ctx, [32]byte(matchID))
	if err != nil {
		return nil, wrapInfraRPC("GetMatchMarketIds", err)
	}
	return toMarketIDs(raw), nil
}

// ─── module address getters (post-modularization wiring introspection) ─────
//
// After the 2026-06-08 modular-entrypoint upgrade BettingPool routes the heavy
// write/read logic to four implementation modules. These getters expose the
// currently-wired module addresses for health-checks and upgrade verification;
// they are not needed on the user hot path. (parlayModule() is already covered by
// the SDK's read surface used elsewhere.)

func (c *Client) BetModule(ctx context.Context) (common.Address, error) {
	return c.sdk.BettingPool().BetModule(ctx)
}

func (c *Client) MarketModule(ctx context.Context) (common.Address, error) {
	return c.sdk.BettingPool().MarketModule(ctx)
}

func (c *Client) ReferralModule(ctx context.Context) (common.Address, error) {
	return c.sdk.BettingPool().ReferralModule(ctx)
}
