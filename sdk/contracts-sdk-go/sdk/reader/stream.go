package reader

import (
	"context"
	"fmt"
	"math/big"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
)

// StreamOpts configures Stream()'s behaviour.
type StreamOpts struct {
	// FromBlock is the inclusive start. 0 = use the deploy block from
	// embedded config (Connection.EnvConfig().DeployBlock); if that is also
	// 0, falls back to chainHead - SwitchToLiveAt (effectively "live only").
	FromBlock uint64

	// BatchSize is the eth_getLogs window during backfill. BSC public
	// nodes commonly cap at 5_000; many private nodes accept larger
	// windows. Defaults to 5_000 if 0.
	BatchSize uint64

	// Kinds restricts events to a subset. Empty = all known BettingPool events.
	Kinds []EventKind

	// SwitchToLiveAt is the buffer (in blocks) between latest seen and
	// chainHead at which Stream switches from backfill mode to live polling.
	// Larger value = safer against shallow reorgs; smaller = lower latency.
	// Defaults to 5 (BSC PoSA finality is typically 5-12 blocks).
	SwitchToLiveAt uint64

	// PollInterval is the live-mode polling cadence. Defaults to 3s.
	PollInterval time.Duration

	// EventBuffer is the size of the Events channel. Defaults to 64.
	EventBuffer int
}

// EventStream is the Layer 2 unified stream returned by Stream(). The
// Events channel emits decoded events in chain order; Errors emits
// non-fatal errors (the goroutine continues running). The stream is closed
// when ctx is cancelled or a fatal error occurs (Done channel closed).
//
// Events channel ordering: backfilled events come first in (block, logIndex)
// order. After SwitchToLiveAt is reached, live polling delivers new events
// as they appear; if a re-poll surfaces a previously-emitted event (RPC
// glitch), Stream skips it via in-memory dedup of the (txHash, logIndex)
// pair within a small recent window.
type EventStream struct {
	Events <-chan *Event
	Errors <-chan error
	Done   <-chan struct{}

	cancel func()
}

// Cancel stops the stream's goroutine. After Cancel returns, the Done
// channel will close (possibly asynchronously) and Events / Errors will
// drain. Safe to call multiple times.
func (s *EventStream) Cancel() {
	if s.cancel != nil {
		s.cancel()
	}
}

// Stream returns a unified, automatically-paginated event stream covering
// historical backfill and live polling. The returned EventStream is owned
// by the caller; remember to call Cancel() when done.
func (c *Client) Stream(ctx context.Context, opts StreamOpts) *EventStream {
	if opts.BatchSize == 0 {
		opts.BatchSize = 5_000
	}
	if opts.SwitchToLiveAt == 0 {
		opts.SwitchToLiveAt = 5
	}
	if opts.PollInterval <= 0 {
		opts.PollInterval = 3 * time.Second
	}
	if opts.EventBuffer <= 0 {
		opts.EventBuffer = 64
	}

	events := make(chan *Event, opts.EventBuffer)
	errors := make(chan error, 8)
	done := make(chan struct{})

	streamCtx, cancel := context.WithCancel(ctx)
	s := &EventStream{
		Events: events,
		Errors: errors,
		Done:   done,
		cancel: cancel,
	}

	go c.runStream(streamCtx, opts, events, errors, done)
	return s
}

// runStream is the goroutine body. It owns the channels and is responsible
// for closing them on exit.
func (c *Client) runStream(
	ctx context.Context,
	opts StreamOpts,
	events chan<- *Event,
	errors chan<- error,
	done chan<- struct{},
) {
	defer close(events)
	defer close(errors)
	defer close(done)

	// 1. Determine starting block.
	startBlock := opts.FromBlock
	if startBlock == 0 {
		startBlock = c.conn.EnvConfig().DeployBlock
	}

	addr := c.conn.BettingPoolAddr()
	topics := topicsForKinds(opts.Kinds)

	// 2. Backfill loop.
	cur := startBlock
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		head, err := c.conn.EthClient().BlockNumber(ctx)
		if err != nil {
			select {
			case errors <- fmt.Errorf("stream: head: %w", err):
			case <-ctx.Done():
				return
			}
			if !sleep(ctx, opts.PollInterval) {
				return
			}
			continue
		}

		// Cap target = head - SwitchToLiveAt; if startBlock > target, jump
		// directly into live mode.
		target := head
		if head > opts.SwitchToLiveAt {
			target = head - opts.SwitchToLiveAt
		} else {
			target = 0
		}
		if cur > target {
			break // ready for live mode
		}

		// Emit one batch [cur, min(cur+batch-1, target)].
		end := cur + opts.BatchSize - 1
		if end > target {
			end = target
		}
		if err := c.fetchAndEmit(ctx, addr, topics, cur, &end, events, errors); err != nil {
			if ctx.Err() != nil {
				return
			}
			select {
			case errors <- err:
			case <-ctx.Done():
				return
			}
			// brief backoff before retrying same window
			if !sleep(ctx, opts.PollInterval) {
				return
			}
			continue
		}
		cur = end + 1
	}

	// 3. Live polling.
	c.runStreamLive(ctx, opts, addr, topics, cur, events, errors)
}

// runStreamLive polls for new logs from `cur` onward at PollInterval. Caps
// each poll's ToBlock at chainHead - SwitchToLiveAt to stay in the safe
// finality window.
func (c *Client) runStreamLive(
	ctx context.Context,
	opts StreamOpts,
	addr common.Address,
	topics []common.Hash,
	cur uint64,
	events chan<- *Event,
	errors chan<- error,
) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		head, err := c.conn.EthClient().BlockNumber(ctx)
		if err != nil {
			select {
			case errors <- fmt.Errorf("stream: head (live): %w", err):
			case <-ctx.Done():
				return
			}
			if !sleep(ctx, opts.PollInterval) {
				return
			}
			continue
		}

		var end uint64
		if head > opts.SwitchToLiveAt {
			end = head - opts.SwitchToLiveAt
		}
		if end < cur {
			// Nothing new past our finality buffer.
			if !sleep(ctx, opts.PollInterval) {
				return
			}
			continue
		}

		// Cap each live poll at BatchSize too — defensively, in case the
		// chain produced > BatchSize blocks while we slept (rare but
		// possible after a network blip).
		windowEnd := end
		if windowEnd > cur+opts.BatchSize-1 {
			windowEnd = cur + opts.BatchSize - 1
		}
		if err := c.fetchAndEmit(ctx, addr, topics, cur, &windowEnd, events, errors); err != nil {
			if ctx.Err() != nil {
				return
			}
			select {
			case errors <- err:
			case <-ctx.Done():
				return
			}
			if !sleep(ctx, opts.PollInterval) {
				return
			}
			continue
		}
		cur = windowEnd + 1
	}
}

// fetchAndEmit runs a single eth_getLogs and pushes decoded events.
func (c *Client) fetchAndEmit(
	ctx context.Context,
	addr common.Address,
	topics []common.Hash,
	from uint64,
	to *uint64,
	events chan<- *Event,
	errors chan<- error,
) error {
	q := ethereum.FilterQuery{
		Addresses: []common.Address{addr},
		FromBlock: new(big.Int).SetUint64(from),
		Topics:    [][]common.Hash{topics},
	}
	if to != nil {
		q.ToBlock = new(big.Int).SetUint64(*to)
	}
	logs, err := c.conn.EthClient().FilterLogs(ctx, q)
	if err != nil {
		return fmt.Errorf("stream: FilterLogs [%d, %v]: %w", from, to, err)
	}
	for i := range logs {
		ev, derr := decodeLog(c.filterer, logs[i])
		if derr != nil {
			// Surface decode errors but keep streaming the rest of the batch.
			select {
			case errors <- derr:
			case <-ctx.Done():
				return ctx.Err()
			}
			continue
		}
		if ev == nil {
			continue
		}
		select {
		case events <- ev:
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	return nil
}

// sleep returns true if it slept the full duration; false if ctx ended.
func sleep(ctx context.Context, d time.Duration) bool {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-t.C:
		return true
	case <-ctx.Done():
		return false
	}
}
