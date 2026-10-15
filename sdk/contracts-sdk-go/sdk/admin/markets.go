package admin

import (
	"context"

	"github.com/ethereum/go-ethereum/core/types"
)

// ── openMarket ───────────────────────────────────────────────────────────────

// OpenMarket opens (matchId, market, line) for new bets. Reverts if already
// open or if max-markets-per-match is exceeded.
func (c *Client) OpenMarket(ctx context.Context, a OpenMarketArgs) (*types.Transaction, error) {
	opts, err := c.transactOpts(ctx)
	if err != nil {
		return nil, err
	}
	tx, err := c.bp.OpenMarket(opts, a.MatchID, uint8(a.Market), a.Line)
	if err != nil {
		return nil, c.wrapWriteErr(err, "openMarket")
	}
	return tx, nil
}

// SimulateOpenMarket eth_call dry-run.
func (c *Client) SimulateOpenMarket(ctx context.Context, a OpenMarketArgs) error {
	return c.simulateCall(ctx, "openMarket", a.MatchID, uint8(a.Market), a.Line)
}

// ── closeMarket ──────────────────────────────────────────────────────────────

// CloseMarket closes (matchId, market, line) — no further bets can lock.
func (c *Client) CloseMarket(ctx context.Context, a CloseMarketArgs) (*types.Transaction, error) {
	opts, err := c.transactOpts(ctx)
	if err != nil {
		return nil, err
	}
	tx, err := c.bp.CloseMarket(opts, a.MatchID, uint8(a.Market), a.Line)
	if err != nil {
		return nil, c.wrapWriteErr(err, "closeMarket")
	}
	return tx, nil
}

// SimulateCloseMarket eth_call dry-run.
func (c *Client) SimulateCloseMarket(ctx context.Context, a CloseMarketArgs) error {
	return c.simulateCall(ctx, "closeMarket", a.MatchID, uint8(a.Market), a.Line)
}

// ── batchOpenMarkets ─────────────────────────────────────────────────────────

// BatchOpenMarkets opens multiple markets for the same match in one tx.
// Reverts if len(Markets) != len(Lines).
func (c *Client) BatchOpenMarkets(ctx context.Context, a BatchOpenMarketsArgs) (*types.Transaction, error) {
	opts, err := c.transactOpts(ctx)
	if err != nil {
		return nil, err
	}
	tx, err := c.bp.BatchOpenMarkets(opts, a.MatchID, marketTypesToUint8(a.Markets), a.Lines)
	if err != nil {
		return nil, c.wrapWriteErr(err, "batchOpenMarkets")
	}
	return tx, nil
}

// SimulateBatchOpenMarkets eth_call dry-run.
func (c *Client) SimulateBatchOpenMarkets(ctx context.Context, a BatchOpenMarketsArgs) error {
	return c.simulateCall(ctx, "batchOpenMarkets", a.MatchID, marketTypesToUint8(a.Markets), a.Lines)
}

// ── batchCloseMarkets ────────────────────────────────────────────────────────

// BatchCloseMarkets closes multiple markets for the same match in one tx.
func (c *Client) BatchCloseMarkets(ctx context.Context, a BatchCloseMarketsArgs) (*types.Transaction, error) {
	opts, err := c.transactOpts(ctx)
	if err != nil {
		return nil, err
	}
	tx, err := c.bp.BatchCloseMarkets(opts, a.MatchID, marketTypesToUint8(a.Markets), a.Lines)
	if err != nil {
		return nil, c.wrapWriteErr(err, "batchCloseMarkets")
	}
	return tx, nil
}

// SimulateBatchCloseMarkets eth_call dry-run.
func (c *Client) SimulateBatchCloseMarkets(ctx context.Context, a BatchCloseMarketsArgs) error {
	return c.simulateCall(ctx, "batchCloseMarkets", a.MatchID, marketTypesToUint8(a.Markets), a.Lines)
}
