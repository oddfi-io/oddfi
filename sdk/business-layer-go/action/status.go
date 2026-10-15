package action

import (
	"context"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
)

// Status is the caller-facing view of a chain_actions row, suitable for
// returning to upstream services that polled an A-form (hash-only) submit.
// Mirrors the columns of action.Row but uses coretypes.* types and pointer
// fields for optional columns so JSON serialization is clean.
type Status struct {
	ActionID    coretypes.ActionID
	Method      string
	Status      coretypes.Status
	TxHash      coretypes.TxHash
	SubmittedAt uint64
	ConfirmedAt *uint64
	RevertInfo  *coretypes.RevertInfo
	BlockNumber *uint64
}

// GetStatus returns the chain_actions row for actionID as a Status DTO.
// Errors include coretypes.ErrActionNotFound (not found) and *ErrDB (DB layer).
func (r *Repo) GetStatus(ctx context.Context, actionID coretypes.ActionID) (Status, error) {
	row, err := r.Get(ctx, int64(actionID))
	if err != nil {
		return Status{}, err
	}
	return RowToStatus(row), nil
}

// GetStatusByIdempotencyKey returns the chain_actions row for the given
// caller-supplied idempotency key. Common use: pre-flight check before
// resubmitting to detect prior submissions.
func (r *Repo) GetStatusByIdempotencyKey(ctx context.Context, key string) (Status, error) {
	row, err := r.GetByIdempotencyKey(ctx, key)
	if err != nil {
		return Status{}, err
	}
	return RowToStatus(row), nil
}

// RowToStatus converts a Row into the DTO. Exposed so callers that already
// hold a *Row (e.g. from a sweep or a batched query) can wrap it without
// going through Get again.
func RowToStatus(row *Row) Status {
	out := Status{
		ActionID: coretypes.ActionID(row.ID),
		Method:   row.Op,
		Status:   row.Status,
	}
	if row.TxHash.Valid {
		out.TxHash = coretypes.TxHash(row.TxHash.String)
	}
	if row.SubmittedAt.Valid {
		out.SubmittedAt = uint64(row.SubmittedAt.Time.Unix())
	}
	if row.ConfirmedAt.Valid {
		ts := uint64(row.ConfirmedAt.Time.Unix())
		out.ConfirmedAt = &ts
	}
	if row.BlockNumber.Valid {
		bn := uint64(row.BlockNumber.Int64)
		out.BlockNumber = &bn
	}
	return out
}
