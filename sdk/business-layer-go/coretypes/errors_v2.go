// errors_v2.go — three-library refactor error model (2026-05-14).
//
// Defines 4 error categories (BusinessError / RetryableError / FatalError / InternalError)
// and the sentinel error codes used across admin / relay / read libraries.
//
// Usage:
//
//	if errors.Is(err, coretypes.ErrUserInsufficientBalance) { ... }
//	var be *coretypes.BusinessError
//	if errors.As(err, &be) { log.Warn("biz error", "code", be.Code, "op", be.Op) }
//
// See findings.md §4.3 for full design rationale.

package coretypes

import (
	"errors"
	"fmt"
)

// ─── 4 error categories ────────────────────────────────────────────────────

// BusinessError — user input / state / permission problem. NOT retryable.
type BusinessError struct {
	Code string
	Op   string
	Err  error
}

func (e *BusinessError) Error() string {
	if e.Op != "" {
		return fmt.Sprintf("business: %s: %s: %v", e.Op, e.Code, e.Err)
	}
	return fmt.Sprintf("business: %s: %v", e.Code, e.Err)
}
func (e *BusinessError) Unwrap() error { return e.Err }
func (e *BusinessError) Is(target error) bool {
	t, ok := target.(*BusinessError)
	if !ok {
		return false
	}
	return e.Code == t.Code
}

// RetryableError — transient infra error. Caller may retry.
type RetryableError struct {
	Code string
	Op   string
	Err  error
}

func (e *RetryableError) Error() string {
	if e.Op != "" {
		return fmt.Sprintf("retryable: %s: %s: %v", e.Op, e.Code, e.Err)
	}
	return fmt.Sprintf("retryable: %s: %v", e.Code, e.Err)
}
func (e *RetryableError) Unwrap() error { return e.Err }
func (e *RetryableError) Is(target error) bool {
	t, ok := target.(*RetryableError)
	if !ok {
		return false
	}
	return e.Code == t.Code
}

// FatalError — permanent infra/contract error. NOT retryable. Operator must intervene.
type FatalError struct {
	Code string
	Op   string
	Err  error
}

func (e *FatalError) Error() string {
	if e.Op != "" {
		return fmt.Sprintf("fatal: %s: %s: %v", e.Op, e.Code, e.Err)
	}
	return fmt.Sprintf("fatal: %s: %v", e.Code, e.Err)
}
func (e *FatalError) Unwrap() error { return e.Err }
func (e *FatalError) Is(target error) bool {
	t, ok := target.(*FatalError)
	if !ok {
		return false
	}
	return e.Code == t.Code
}

// InternalError — business-layer bug. Should never happen but did. Triggers alerts.
type InternalError struct {
	Code string
	Op   string
	Err  error
}

func (e *InternalError) Error() string {
	if e.Op != "" {
		return fmt.Sprintf("internal: %s: %s: %v", e.Op, e.Code, e.Err)
	}
	return fmt.Sprintf("internal: %s: %v", e.Code, e.Err)
}
func (e *InternalError) Unwrap() error { return e.Err }
func (e *InternalError) Is(target error) bool {
	t, ok := target.(*InternalError)
	if !ok {
		return false
	}
	return e.Code == t.Code
}

// ─── Sentinel constructors ────────────────────────────────────────────────

func biz(code string) *BusinessError {
	return &BusinessError{Code: code, Err: errors.New(code)}
}
func retry(code string) *RetryableError {
	return &RetryableError{Code: code, Err: errors.New(code)}
}
func fatal(code string) *FatalError {
	return &FatalError{Code: code, Err: errors.New(code)}
}
func internal(code string) *InternalError {
	return &InternalError{Code: code, Err: errors.New(code)}
}

// WrapBusiness / WrapRetryable / WrapFatal / WrapInternal — produce a fresh
// error instance with operation context, while preserving sentinel matching
// via errors.Is (BusinessError.Is compares Code).
func WrapBusiness(sentinel *BusinessError, op string, cause error) *BusinessError {
	return &BusinessError{Code: sentinel.Code, Op: op, Err: cause}
}
func WrapRetryable(sentinel *RetryableError, op string, cause error) *RetryableError {
	return &RetryableError{Code: sentinel.Code, Op: op, Err: cause}
}
func WrapFatal(sentinel *FatalError, op string, cause error) *FatalError {
	return &FatalError{Code: sentinel.Code, Op: op, Err: cause}
}
func WrapInternal(sentinel *InternalError, op string, cause error) *InternalError {
	return &InternalError{Code: sentinel.Code, Op: op, Err: cause}
}

// ─── BusinessError sentinels (23 codes) ────────────────────────────────────

var (
	ErrUserInsufficientBalance    = biz("ErrUserInsufficientBalance")
	ErrAdminInsufficientBalance   = biz("ErrAdminInsufficientBalance")
	ErrAdminAllowanceInsufficient = biz("ErrAdminAllowanceInsufficient")

	ErrMarketNotOpen        = biz("ErrMarketNotOpen")
	ErrMarketNotLocked      = biz("ErrMarketNotLocked")
	ErrMarketAlreadyOpen    = biz("ErrMarketAlreadyOpen")
	ErrMarketAlreadySettled = biz("ErrMarketAlreadySettled")
	ErrMarketMaxPerMatch    = biz("ErrMarketMaxPerMatch")

	ErrBetQuoteExpired = biz("ErrBetQuoteExpired")
	ErrBetNotOwned     = biz("ErrBetNotOwned")
	ErrBetNotWon       = biz("ErrBetNotWon")
	ErrBetPayoutZero   = biz("ErrBetPayoutZero")

	ErrPoolBelowMinDeposit    = biz("ErrPoolBelowMinDeposit")
	ErrStakeBelowMin          = biz("ErrStakeBelowMin")
	ErrPlanInvalid            = biz("ErrPlanInvalid")
	ErrPoolPayoutWindowClosed = biz("ErrPoolPayoutWindowClosed")

	ErrPositionWrongState   = biz("ErrPositionWrongState")
	ErrPositionNotUnbonded  = biz("ErrPositionNotUnbonded")
	ErrPositionNotMatured   = biz("ErrPositionNotMatured")
	ErrPositionNotOwned     = biz("ErrPositionNotOwned")
	ErrStakeNotMatured      = biz("ErrStakeNotMatured")

	ErrParamInvalid = biz("ErrParamInvalid")

	// NOTE: ErrIdempotencyConflict is also defined in errors.go (legacy) as
	// errors.New(...) — same code string. New code paths SHOULD construct via
	// &BusinessError{Code: "ErrIdempotencyConflict", ...} so errors.Is still works
	// against the v2 sentinel below.
	ErrIdempotencyConflictV2 = biz("ErrIdempotencyConflict")
)

// ─── RetryableError sentinels (4 codes) ───────────────────────────────────

var (
	ErrInfraRPC            = retry("ErrInfraRPC")
	ErrInfraReceiptTimeout = retry("ErrInfraReceiptTimeout")
	ErrInfraMulticall      = retry("ErrInfraMulticall")
	ErrInfraCache          = retry("ErrInfraCache")
)

// ─── FatalError sentinels (7 codes) ───────────────────────────────────────

var (
	ErrAdminRoleMissing     = fatal("ErrAdminRoleMissing")
	ErrMultisigRoleRequired = fatal("ErrMultisigRoleRequired")
	ErrPoolUndercapitalized = fatal("ErrPoolUndercapitalized")
	ErrTokenPaused          = fatal("ErrTokenPaused")
	ErrContractPaused       = fatal("ErrContractPaused")
	ErrConfigChainInvalid   = fatal("ErrConfigChainInvalid")
	ErrChainTxReverted      = fatal("ErrChainTxReverted")
)

// ─── InternalError sentinels (2 codes) ────────────────────────────────────

var (
	ErrInternalInvariant     = internal("ErrInternalInvariant")
	ErrInternalUnknownRevert = internal("ErrInternalUnknownRevert")
)
