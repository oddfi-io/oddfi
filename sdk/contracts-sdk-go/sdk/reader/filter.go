package reader

import (
	"context"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
)

// FilterOpts is the Layer 1 query shape: pull historical logs in a single
// eth_getLogs call (or a batched series — see Stream for backfill).
//
// FromBlock is inclusive; ToBlock is inclusive (nil = latest at call time).
// Kinds restricts the topic[0] filter to specific event kinds; empty Kinds
// = all known BettingPool events.
type FilterOpts struct {
	FromBlock uint64
	ToBlock   *uint64
	Kinds     []EventKind
}

// FilterEvents performs eth_getLogs against the configured BettingPool
// address and decodes every log into an Event. The contract's address is
// taken from the Connection.
//
// Caller must split large block ranges themselves — many BSC RPCs cap
// eth_getLogs at 5_000-block windows. Use Stream() for automatic batching.
func (c *Client) FilterEvents(ctx context.Context, opts FilterOpts) ([]*Event, error) {
	addr := c.conn.BettingPoolAddr()
	if addr == (common.Address{}) {
		return nil, fmt.Errorf("reader: BettingPool address is zero")
	}

	q := ethereum.FilterQuery{
		Addresses: []common.Address{addr},
		FromBlock: new(big.Int).SetUint64(opts.FromBlock),
		Topics:    [][]common.Hash{topicsForKinds(opts.Kinds)},
	}
	if opts.ToBlock != nil {
		q.ToBlock = new(big.Int).SetUint64(*opts.ToBlock)
	}

	logs, err := c.conn.EthClient().FilterLogs(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("reader: FilterLogs: %w", err)
	}

	out := make([]*Event, 0, len(logs))
	for i := range logs {
		ev, derr := decodeLog(c.filterer, logs[i])
		if derr != nil {
			return nil, derr
		}
		if ev == nil {
			continue // unknown topic, skip
		}
		out = append(out, ev)
	}
	return out, nil
}

// topicsForKinds returns the topic[0] OR-list to feed eth_getLogs.
// Empty kinds = all events the SDK knows about.
func topicsForKinds(kinds []EventKind) []common.Hash {
	if len(kinds) == 0 {
		// Empty inner slice means "match anything" in eth_getLogs semantics;
		// returning a slice of all our known topic0 values gives us the same
		// effect with explicit-allow-list safety (logs from unknown events
		// past our SDK's knowledge are pre-filtered out by the RPC).
		return append([]common.Hash{}, allTopics0...)
	}
	out := make([]common.Hash, 0, len(kinds))
	seen := make(map[EventKind]bool, len(kinds))
	for _, k := range kinds {
		if seen[k] {
			continue
		}
		seen[k] = true
		if topic, ok := Topic0For(k); ok {
			out = append(out, topic)
		}
	}
	return out
}
