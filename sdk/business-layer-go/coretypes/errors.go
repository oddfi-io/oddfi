package coretypes

import (
	"errors"
	"fmt"
)

// ── Sentinels (use with errors.Is) ─────────────────────────────────────────

var (
	// ErrNotImplemented marks unimplemented features.
	ErrNotImplemented      = errors.New("business: not implemented")
	ErrIdempotencyConflict = errors.New("business: idempotency_key collision with different args")
	ErrConfigInvalid       = errors.New("business: config invalid")
	ErrServiceClosed       = errors.New("business: service closed")
	ErrActionNotFound      = errors.New("business: action not found")
	ErrProposalNotFound    = errors.New("business: proposal not found")
	ErrDropped             = errors.New("business: tx dropped from mempool")
	ErrTimeout             = errors.New("business: wait timed out (ctx)")
	ErrModeNotConfigured   = errors.New("business: multisig mode not configured")
)

// ── Typed wrappers (use with errors.As) ────────────────────────────────────

type ErrSimulationFailed struct {
	Method string
	Revert *RevertInfo
	Cause  error
}

func (e *ErrSimulationFailed) Error() string {
	if e.Revert != nil {
		return fmt.Sprintf("business: simulate %s reverted: %s", e.Method, e.Revert.Name)
	}
	return fmt.Sprintf("business: simulate %s failed: %v", e.Method, e.Cause)
}

func (e *ErrSimulationFailed) Unwrap() error { return e.Cause }

type ErrReverted struct {
	Method string
	TxHash TxHash
	Revert *RevertInfo
}

func (e *ErrReverted) Error() string {
	name := "<unparsed>"
	if e.Revert != nil {
		name = e.Revert.Name
	}
	return fmt.Sprintf("business: %s tx %s reverted: %s", e.Method, e.TxHash, name)
}

type ErrRPC struct {
	Op    string
	Cause error
}

func (e *ErrRPC) Error() string { return fmt.Sprintf("business: rpc %s: %v", e.Op, e.Cause) }
func (e *ErrRPC) Unwrap() error { return e.Cause }

type ErrResolver struct {
	Resolver string
	Cause    error
}

func (e *ErrResolver) Error() string {
	return fmt.Sprintf("business: resolver %s: %v", e.Resolver, e.Cause)
}
func (e *ErrResolver) Unwrap() error { return e.Cause }

type ErrDB struct {
	Op    string
	Cause error
}

func (e *ErrDB) Error() string { return fmt.Sprintf("business: db %s: %v", e.Op, e.Cause) }
func (e *ErrDB) Unwrap() error { return e.Cause }

type ErrUnknownToken struct {
	Symbol TokenSymbol
}

func (e *ErrUnknownToken) Error() string {
	return "business: unknown TokenSymbol " + string(e.Symbol) + " (add to Config.Tokens)"
}
