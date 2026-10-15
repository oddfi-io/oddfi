package admin

import (
	"context"

	"github.com/ethereum/go-ethereum/core/types"
)

// ── lockBet ──────────────────────────────────────────────────────────────────

// LockBet records a regular bet, debiting the user's in-contract balance.
//
// LockedOdds is the integer-encoded odds (×1000); e.g. odds 1.818 → 1818.
func (c *Client) LockBet(ctx context.Context, a LockBetArgs) (*types.Transaction, error) {
	opts, err := c.transactOpts(ctx)
	if err != nil {
		return nil, err
	}
	tx, err := c.bp.LockBet(opts, a.BetID, a.User, a.Amount, a.MatchID,
		uint8(a.Market), a.Outcome, a.Line, a.LockedOdds)
	if err != nil {
		return nil, c.wrapWriteErr(err, "lockBet")
	}
	return tx, nil
}

// SimulateLockBet eth_call dry-run.
func (c *Client) SimulateLockBet(ctx context.Context, a LockBetArgs) error {
	return c.simulateCall(ctx, "lockBet", a.BetID, a.User, a.Amount, a.MatchID,
		uint8(a.Market), a.Outcome, a.Line, a.LockedOdds)
}

// ── lockCreditBet ────────────────────────────────────────────────────────────

// LockCreditBet records a credit bet collateralised by a previously placed
// regular bet's potential payout.
func (c *Client) LockCreditBet(ctx context.Context, a LockCreditBetArgs) (*types.Transaction, error) {
	opts, err := c.transactOpts(ctx)
	if err != nil {
		return nil, err
	}
	tx, err := c.bp.LockCreditBet(opts, a.BetID, a.CollateralBetID, a.User, a.Amount,
		a.MatchID, uint8(a.Market), a.Outcome, a.Line, a.LockedOdds)
	if err != nil {
		return nil, c.wrapWriteErr(err, "lockCreditBet")
	}
	return tx, nil
}

// SimulateLockCreditBet eth_call dry-run.
func (c *Client) SimulateLockCreditBet(ctx context.Context, a LockCreditBetArgs) error {
	return c.simulateCall(ctx, "lockCreditBet", a.BetID, a.CollateralBetID, a.User, a.Amount,
		a.MatchID, uint8(a.Market), a.Outcome, a.Line, a.LockedOdds)
}

// ── unlockBet ────────────────────────────────────────────────────────────────

// UnlockBet refunds a previously locked bet (e.g. on cancellation), atomically
// unwinding any credit bets collateralised by it.
func (c *Client) UnlockBet(ctx context.Context, a UnlockBetArgs) (*types.Transaction, error) {
	opts, err := c.transactOpts(ctx)
	if err != nil {
		return nil, err
	}
	tx, err := c.bp.UnlockBet(opts, a.BetID, a.CreditBetIDs)
	if err != nil {
		return nil, c.wrapWriteErr(err, "unlockBet")
	}
	return tx, nil
}

// SimulateUnlockBet eth_call dry-run.
func (c *Client) SimulateUnlockBet(ctx context.Context, a UnlockBetArgs) error {
	return c.simulateCall(ctx, "unlockBet", a.BetID, a.CreditBetIDs)
}
