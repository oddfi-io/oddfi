package admin

import (
	"context"
	"errors"
	"fmt"

	"github.com/ethereum/go-ethereum/core/types"
)

// ── lockParlay ───────────────────────────────────────────────────────────────

// LockParlay records a multi-leg combo bet. All leg slices must have the same
// length; the contract additionally enforces business rules (≥2 legs,
// per-match dedup, etc.).
func (c *Client) LockParlay(ctx context.Context, a LockParlayArgs) (*types.Transaction, error) {
	if err := a.validate(); err != nil {
		return nil, err
	}
	opts, err := c.transactOpts(ctx)
	if err != nil {
		return nil, err
	}
	tx, err := c.bp.LockParlay(opts, a.ParlayID, a.User, a.Stake,
		a.MatchIDs, marketTypesToUint8(a.Markets), a.Outcomes, a.Lines, a.LegOdds, a.LegBetIDs)
	if err != nil {
		return nil, c.wrapWriteErr(err, "lockParlay")
	}
	return tx, nil
}

// SimulateLockParlay eth_call dry-run.
func (c *Client) SimulateLockParlay(ctx context.Context, a LockParlayArgs) error {
	if err := a.validate(); err != nil {
		return err
	}
	return c.simulateCall(ctx, "lockParlay", a.ParlayID, a.User, a.Stake,
		a.MatchIDs, marketTypesToUint8(a.Markets), a.Outcomes, a.Lines, a.LegOdds, a.LegBetIDs)
}

// validate is a fast client-side sanity check on slice lengths so callers
// don't waste an RPC roundtrip on a guaranteed-revert. The contract has its
// own (authoritative) checks; we just catch obvious mistakes.
func (a *LockParlayArgs) validate() error {
	n := len(a.MatchIDs)
	if n < 2 {
		return errors.New("admin: LockParlay: need at least 2 legs")
	}
	if got := len(a.Markets); got != n {
		return fmt.Errorf("admin: LockParlay: len(Markets)=%d != len(MatchIDs)=%d", got, n)
	}
	if got := len(a.Outcomes); got != n {
		return fmt.Errorf("admin: LockParlay: len(Outcomes)=%d != len(MatchIDs)=%d", got, n)
	}
	if got := len(a.Lines); got != n {
		return fmt.Errorf("admin: LockParlay: len(Lines)=%d != len(MatchIDs)=%d", got, n)
	}
	if got := len(a.LegOdds); got != n {
		return fmt.Errorf("admin: LockParlay: len(LegOdds)=%d != len(MatchIDs)=%d", got, n)
	}
	if got := len(a.LegBetIDs); got != n {
		return fmt.Errorf("admin: LockParlay: len(LegBetIDs)=%d != len(MatchIDs)=%d", got, n)
	}
	return nil
}

// ── unlockParlay ─────────────────────────────────────────────────────────────

// UnlockParlay refunds a previously locked parlay (e.g. on cancellation of a
// leg's match — contract may degrade vs cancel based on remaining legs).
func (c *Client) UnlockParlay(ctx context.Context, a UnlockParlayArgs) (*types.Transaction, error) {
	opts, err := c.transactOpts(ctx)
	if err != nil {
		return nil, err
	}
	tx, err := c.bp.UnlockParlay(opts, a.ParlayID)
	if err != nil {
		return nil, c.wrapWriteErr(err, "unlockParlay")
	}
	return tx, nil
}

// SimulateUnlockParlay eth_call dry-run.
func (c *Client) SimulateUnlockParlay(ctx context.Context, a UnlockParlayArgs) error {
	return c.simulateCall(ctx, "unlockParlay", a.ParlayID)
}
