package admin

import (
	"context"

	"github.com/ethereum/go-ethereum/core/types"
)

// UpdateSignal reports the heavy-side load and signal color for a market
// bucket, used by the LP risk system.
func (c *Client) UpdateSignal(ctx context.Context, a UpdateSignalArgs) (*types.Transaction, error) {
	opts, err := c.transactOpts(ctx)
	if err != nil {
		return nil, err
	}
	tx, err := c.bp.UpdateSignal(opts, a.MatchID, uint8(a.Market), a.Line,
		a.HeavyAmount, a.HeavySide, uint8(a.Color))
	if err != nil {
		return nil, c.wrapWriteErr(err, "updateSignal")
	}
	return tx, nil
}

// SimulateUpdateSignal eth_call dry-run.
func (c *Client) SimulateUpdateSignal(ctx context.Context, a UpdateSignalArgs) error {
	return c.simulateCall(ctx, "updateSignal", a.MatchID, uint8(a.Market), a.Line,
		a.HeavyAmount, a.HeavySide, uint8(a.Color))
}
