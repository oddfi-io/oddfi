package reader

import (
	"fmt"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/bindings/bettingpool"
)

// Event is a decoded BettingPool log together with chain metadata. The
// Decoded field holds the abigen-generated typed struct (e.g. *BettingPoolDeposited);
// callers type-assert when they need typed access:
//
//	switch e.Kind {
//	case reader.EventDeposited:
//	    d := e.Decoded.(*bettingpool.BettingPoolDeposited)
//	    fmt.Println(d.User.Hex(), d.Amount)
//	case reader.EventBetLocked:
//	    bl := e.Decoded.(*bettingpool.BettingPoolBetLocked)
//	    ...
//	}
type Event struct {
	Kind        EventKind
	BlockNumber uint64
	TxHash      common.Hash
	LogIndex    uint
	Removed     bool        // chain reorg signal (eth_getLogs / watcher set)
	Decoded     interface{} // *BettingPoolXxx — type asserted by Kind
	Raw         *types.Log
}

// ── Decoder registry ─────────────────────────────────────────────────────────

// decoderFunc parses a single log into the abigen-generated struct.
type decoderFunc func(*bettingpool.BettingPoolFilterer, types.Log) (interface{}, error)

// kindDecoder bundles the static info we need per event.
type kindDecoder struct {
	kind    EventKind
	name    string       // Solidity event name
	topic0  common.Hash  // keccak256 selector for log.Topics[0]
	parse   decoderFunc
}

// decoderTable maps every EventKind to its parse closure. We use closures
// rather than reflection so the cost is one map lookup per log.
//
// Adding a new event = one row here + one EventKind constant + one entry
// in kindToSolidityName. The TestDecoderRegistryComplete test fails if
// kindToSolidityName has entries with no corresponding row.
var decoderTable = []kindDecoder{
	{EventDeposited, "Deposited", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseDeposited(l) }},
	{EventWithdrawn, "Withdrawn", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseWithdrawn(l) }},
	{EventLargeWithdrawalRequested, "LargeWithdrawalRequested", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseLargeWithdrawalRequested(l) }},
	{EventLargeWithdrawalRejected, "LargeWithdrawalRejected", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseLargeWithdrawalRejected(l) }},
	{EventBetLocked, "BetLocked", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseBetLocked(l) }},
	{EventBetUnlocked, "BetUnlocked", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseBetUnlocked(l) }},
	{EventBetSettled, "BetSettled", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseBetSettled(l) }},
	{EventMatchSettled, "MatchSettled", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseMatchSettled(l) }},
	{EventParlayLocked, "ParlayLocked", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseParlayLocked(l) }},
	{EventParlayUnlocked, "ParlayUnlocked", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseParlayUnlocked(l) }},
	{EventParlayWon, "ParlayWon", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseParlayWon(l) }},
	{EventParlayLost, "ParlayLost", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseParlayLost(l) }},
	{EventParlayLegCancelled, "ParlayLegCancelled", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseParlayLegCancelled(l) }},
	{EventParlayDegradedToSingle, "ParlayDegradedToSingle", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseParlayDegradedToSingle(l) }},
	{EventCreditBetLocked, "CreditBetLocked", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseCreditBetLocked(l) }},
	{EventCreditBetSettled, "CreditBetSettled", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseCreditBetSettled(l) }},
	{EventCreditPayoutFrozen, "CreditPayoutFrozen", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseCreditPayoutFrozen(l) }},
	{EventCreditPayoutReleased, "CreditPayoutReleased", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseCreditPayoutReleased(l) }},
	{EventCreditPayoutForfeited, "CreditPayoutForfeited", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseCreditPayoutForfeited(l) }},
	{EventCreditBetForfeited, "CreditBetForfeited", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseCreditBetForfeited(l) }},
	{EventCreditCollateralCancelled, "CreditCollateralCancelled", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseCreditCollateralCancelled(l) }},
	{EventLiquidityAdded, "LiquidityAdded", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseLiquidityAdded(l) }},
	{EventLiquidityRemoved, "LiquidityRemoved", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseLiquidityRemoved(l) }},
	{EventSignalUpdated, "SignalUpdated", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseSignalUpdated(l) }},
	{EventMarketOpened, "MarketOpened", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseMarketOpened(l) }},
	{EventMarketClosed, "MarketClosed", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseMarketClosed(l) }},
	{EventMarketReopened, "MarketReopened", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseMarketReopened(l) }},
	{EventMatchCancelled, "MatchCancelled", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseMatchCancelled(l) }},
	{EventPlatformWithdrawn, "PlatformWithdrawn", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParsePlatformWithdrawn(l) }},
	{EventRedLightThresholdUpdated, "RedLightThresholdUpdated", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseRedLightThresholdUpdated(l) }},
	{EventMaxMarketsPerMatchUpdated, "MaxMarketsPerMatchUpdated", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseMaxMarketsPerMatchUpdated(l) }},
	{EventAdminUpdated, "AdminUpdated", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseAdminUpdated(l) }},
	{EventLpShareBpsUpdated, "LpShareBpsUpdated", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseLpShareBpsUpdated(l) }},
	{EventPaused, "Paused", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParsePaused(l) }},
	{EventUnpaused, "Unpaused", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseUnpaused(l) }},
	{EventUpgraded, "Upgraded", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseUpgraded(l) }},
	{EventInitialized, "Initialized", common.Hash{}, func(f *bettingpool.BettingPoolFilterer, l types.Log) (interface{}, error) { return f.ParseInitialized(l) }},
}

// kindByTopic0 maps the keccak256 selector to its EventKind. Built once at
// package init from the parsed BettingPool ABI.
var (
	kindByTopic0 map[common.Hash]EventKind
	parseByKind  map[EventKind]decoderFunc
	allTopics0   []common.Hash
)

func init() {
	parsed, err := bettingpool.BettingPoolMetaData.GetAbi()
	if err != nil {
		panic("reader: parse BettingPool ABI: " + err.Error())
	}
	kindByTopic0 = make(map[common.Hash]EventKind, len(decoderTable))
	parseByKind = make(map[EventKind]decoderFunc, len(decoderTable))
	allTopics0 = make([]common.Hash, 0, len(decoderTable))

	for i := range decoderTable {
		row := &decoderTable[i]
		ev, ok := parsed.Events[row.name]
		if !ok {
			panic(fmt.Sprintf("reader: BettingPool ABI missing event %q (decoderTable inconsistent)", row.name))
		}
		row.topic0 = ev.ID
		kindByTopic0[ev.ID] = row.kind
		parseByKind[row.kind] = row.parse
		allTopics0 = append(allTopics0, ev.ID)
	}
}

// decodeLog converts a raw log into a typed Event. Returns nil, nil if the
// log's topic[0] is not one we recognise (a future event added on chain
// after the SDK was compiled — caller decides whether to surface it).
func decodeLog(filterer *bettingpool.BettingPoolFilterer, log types.Log) (*Event, error) {
	if len(log.Topics) == 0 {
		return nil, nil
	}
	kind, ok := kindByTopic0[log.Topics[0]]
	if !ok {
		return nil, nil
	}
	parse := parseByKind[kind]
	decoded, err := parse(filterer, log)
	if err != nil {
		return nil, fmt.Errorf("reader: decode %s @ %d/%d: %w", kind, log.BlockNumber, log.Index, err)
	}
	return &Event{
		Kind:        kind,
		BlockNumber: log.BlockNumber,
		TxHash:      log.TxHash,
		LogIndex:    log.Index,
		Removed:     log.Removed,
		Decoded:     decoded,
		Raw:         &log,
	}, nil
}

// Topic0For returns the keccak256 selector for an event kind, useful for
// hand-rolling eth_getLogs filters.
func Topic0For(kind EventKind) (common.Hash, bool) {
	for i := range decoderTable {
		if decoderTable[i].kind == kind {
			return decoderTable[i].topic0, true
		}
	}
	return common.Hash{}, false
}
