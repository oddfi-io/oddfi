// dto.go — DTO types wrapping the raw SDK structs. Odds fields are scaled
// from 1e4 integer precision into human-readable decimal.Decimal (per N1
// decision 2026-05-14).

package read

import (
	"github.com/ethereum/go-ethereum/common"
	"github.com/shopspring/decimal"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
)

// Market is the wrapped form of oddfi.MarketInfo.
type Market struct {
	MatchID        coretypes.MatchID
	MarketType     uint8
	Line           uint8
	OutcomeCount   uint8
	MatchStartTime uint64
	LockAt         uint64
	Status         MarketStatus
	MatchEndTime   uint64
}

// MarketOdds is the wrapped form of oddfi.MarketOdds.
// BaseOdds / QuotedOdds are pre-divided by 1e4 (e.g. SDK 15000 -> DTO 1.5).
// QuoteVersion is opaque; treat as a monotonically-increasing counter.
type MarketOdds struct {
	BaseOdds     []decimal.Decimal
	QuotedOdds   []decimal.Decimal
	UpdatedAt    uint64
	QuoteVersion decimal.Decimal
}

// Bet is the wrapped form of oddfi.BetInfo.
type Bet struct {
	Owner           common.Address
	MarketID        coretypes.MarketID
	Outcome         uint8
	AcceptedAmount  decimal.Decimal
	RefundedAmount  decimal.Decimal
	LockedOdds      decimal.Decimal // pre-divided by 1e4
	SettlementState BetSettlementState
	ClaimablePayout decimal.Decimal
}

// Signal is the wrapped form of oddfi.SignalResult.
type Signal struct {
	Color               SignalColor
	AcceptedAmount      decimal.Decimal
	LockedOdds          decimal.Decimal
	PartialFill         bool
	MaxAcceptableAmount decimal.Decimal
}

// PayoutWindow is the wrapped form of oddfi.PayoutLiquidityWindow.
// TODO Phase 6: confirm field set by reading SDK source.
type PayoutWindow struct {
	// Fields TBD
}

// WithdrawPreview is the wrapped form of oddfi.LiquidityWithdrawPreview — the
// read-only result of LiquidityPool.previewWithdraw(positionId). Amounts are in
// ODD base units (NOT 1e4-scaled: these are token amounts, not odds). NetPnL may
// be negative when losses reduced the LP principal. EffectiveState mirrors
// GetLpPositionState's effective (not stored) state; only Unbonding /
// Withdrawable positions return a non-zero WithdrawAmount.
type WithdrawPreview struct {
	WithdrawAmount decimal.Decimal
	NetPnL         decimal.Decimal
	EffectiveState LpPositionState
}

// (ActionStatus DTO moved to action package as action.Status; see
// action.Repo.GetStatus / action.Repo.GetStatusByIdempotencyKey.)
