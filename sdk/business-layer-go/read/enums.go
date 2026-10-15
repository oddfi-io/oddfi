// enums.go — typed enums replacing the raw uint8 values returned by the SDK.

package read

// MarketStatus decodes BettingPool.GetMarket().Status.
type MarketStatus uint8

const (
	MarketStatusOpen      MarketStatus = 0
	MarketStatusLocked    MarketStatus = 1
	MarketStatusSettled   MarketStatus = 2
	MarketStatusRefunded  MarketStatus = 3
	MarketStatusCancelled MarketStatus = 4
)

func (s MarketStatus) String() string {
	switch s {
	case MarketStatusOpen:
		return "Open"
	case MarketStatusLocked:
		return "Locked"
	case MarketStatusSettled:
		return "Settled"
	case MarketStatusRefunded:
		return "Refunded"
	case MarketStatusCancelled:
		return "Cancelled"
	default:
		return "Unknown"
	}
}

// BetSettlementState decodes BettingPool.GetBet().SettlementState.
type BetSettlementState uint8

const (
	BetSettlementPending      BetSettlementState = 0
	BetSettlementRefunded     BetSettlementState = 1
	BetSettlementLost         BetSettlementState = 2
	BetSettlementWonUnclaimed BetSettlementState = 3
	BetSettlementWonClaimed   BetSettlementState = 4
	BetSettlementCashedOut    BetSettlementState = 5 // bet exited early via relay.CashOut (terminal)
)

// SignalColor decodes BettingPool.PreviewSignal().Signal.
type SignalColor uint8

const (
	SignalGreen  SignalColor = 0
	SignalYellow SignalColor = 1
	SignalOrange SignalColor = 2
	SignalRed    SignalColor = 3
)

// LpPositionState decodes LiquidityPool.GetPositionState().
// TODO Phase 6: confirm actual constant values from SDK ABI.
type LpPositionState uint8

// ResultKind is the admin-supplied settle outcome category.
// TODO Phase 6: confirm.
type ResultKind uint8
