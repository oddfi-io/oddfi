package reader

// EventKind enumerates every BettingPool event this SDK can decode. Values
// are stable across SDK versions; new events append to the end.
//
// Names mirror the Solidity event names exactly (camelCase preserved). The
// String() output matches the Solidity name and is what gets logged.
type EventKind int

const (
	EventUnknown EventKind = iota

	// User funds
	EventDeposited
	EventWithdrawn
	EventLargeWithdrawalRequested
	EventLargeWithdrawalRejected

	// Regular bets
	EventBetLocked
	EventBetUnlocked
	EventBetSettled

	// Match-level settlement
	EventMatchSettled

	// Parlays
	EventParlayLocked
	EventParlayUnlocked
	EventParlayWon
	EventParlayLost
	EventParlayLegCancelled
	EventParlayDegradedToSingle

	// Credit bets
	EventCreditBetLocked
	EventCreditBetSettled
	EventCreditPayoutFrozen
	EventCreditPayoutReleased
	EventCreditPayoutForfeited
	EventCreditBetForfeited
	EventCreditCollateralCancelled

	// LP
	EventLiquidityAdded
	EventLiquidityRemoved

	// Signals & market lifecycle
	EventSignalUpdated
	EventMarketOpened
	EventMarketClosed
	EventMarketReopened

	// Match cancel
	EventMatchCancelled

	// Admin / multisig ops
	EventPlatformWithdrawn
	EventRedLightThresholdUpdated
	EventMaxMarketsPerMatchUpdated
	EventAdminUpdated
	EventLpShareBpsUpdated

	// Inherited (UUPS / Pausable / Initializable)
	EventPaused
	EventUnpaused
	EventUpgraded
	EventInitialized
)

// kindToSolidityName is the canonical Solidity event name for each kind.
// It is also used to look up the abigen ParseXxx method via the decoder
// registry in event.go.
var kindToSolidityName = map[EventKind]string{
	EventDeposited:                 "Deposited",
	EventWithdrawn:                 "Withdrawn",
	EventLargeWithdrawalRequested:  "LargeWithdrawalRequested",
	EventLargeWithdrawalRejected:   "LargeWithdrawalRejected",
	EventBetLocked:                 "BetLocked",
	EventBetUnlocked:               "BetUnlocked",
	EventBetSettled:                "BetSettled",
	EventMatchSettled:              "MatchSettled",
	EventParlayLocked:              "ParlayLocked",
	EventParlayUnlocked:            "ParlayUnlocked",
	EventParlayWon:                 "ParlayWon",
	EventParlayLost:                "ParlayLost",
	EventParlayLegCancelled:        "ParlayLegCancelled",
	EventParlayDegradedToSingle:    "ParlayDegradedToSingle",
	EventCreditBetLocked:           "CreditBetLocked",
	EventCreditBetSettled:          "CreditBetSettled",
	EventCreditPayoutFrozen:        "CreditPayoutFrozen",
	EventCreditPayoutReleased:      "CreditPayoutReleased",
	EventCreditPayoutForfeited:     "CreditPayoutForfeited",
	EventCreditBetForfeited:        "CreditBetForfeited",
	EventCreditCollateralCancelled: "CreditCollateralCancelled",
	EventLiquidityAdded:            "LiquidityAdded",
	EventLiquidityRemoved:          "LiquidityRemoved",
	EventSignalUpdated:             "SignalUpdated",
	EventMarketOpened:              "MarketOpened",
	EventMarketClosed:              "MarketClosed",
	EventMarketReopened:            "MarketReopened",
	EventMatchCancelled:            "MatchCancelled",
	EventPlatformWithdrawn:         "PlatformWithdrawn",
	EventRedLightThresholdUpdated:  "RedLightThresholdUpdated",
	EventMaxMarketsPerMatchUpdated: "MaxMarketsPerMatchUpdated",
	EventAdminUpdated:              "AdminUpdated",
	EventLpShareBpsUpdated:         "LpShareBpsUpdated",
	EventPaused:                    "Paused",
	EventUnpaused:                  "Unpaused",
	EventUpgraded:                  "Upgraded",
	EventInitialized:               "Initialized",
}

// String returns the Solidity event name (e.g. "Deposited"), or
// "Event(?)" for unknown kinds.
func (k EventKind) String() string {
	if name, ok := kindToSolidityName[k]; ok {
		return name
	}
	return "Event(?)"
}

// AllEventKinds returns every defined kind in declaration order. Useful for
// "subscribe to everything" calls.
func AllEventKinds() []EventKind {
	out := make([]EventKind, 0, len(kindToSolidityName))
	for k := range kindToSolidityName {
		out = append(out, k)
	}
	return out
}
