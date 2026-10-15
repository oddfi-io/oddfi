// Package bettingpool contains betting business concepts.
package bettingpool

import "github.com/ethereum/go-ethereum/common"

// MarketID identifies a betting market.
type MarketID common.Hash

// BetID identifies a submitted bet.
type BetID common.Hash

// MarketStatus is the business lifecycle state of a betting market.
type MarketStatus uint8

const (
	// MarketStatusUnknown indicates an unmapped or unset market status.
	MarketStatusUnknown MarketStatus = iota
	// MarketStatusOpen indicates the market accepts bets.
	MarketStatusOpen
	// MarketStatusLocked indicates betting is closed before settlement.
	MarketStatusLocked
	// MarketStatusSettled indicates the market has a settlement result.
	MarketStatusSettled
	// MarketStatusVoided indicates the market was voided or refunded.
	MarketStatusVoided
)

// String returns the stable text form of MarketStatus.
func (s MarketStatus) String() string {
	switch s {
	case MarketStatusOpen:
		return "open"
	case MarketStatusLocked:
		return "locked"
	case MarketStatusSettled:
		return "settled"
	case MarketStatusVoided:
		return "voided"
	default:
		return "unknown"
	}
}
