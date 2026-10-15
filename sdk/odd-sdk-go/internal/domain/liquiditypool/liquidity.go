// Package liquiditypool contains liquidity business concepts.
package liquiditypool

import "math/big"

// PositionID identifies a liquidity position.
type PositionID uint64

// LpPositionState is the lifecycle state of an LP position.
type LpPositionState uint8

const (
	// LpPositionStateActive indicates an active LP position.
	LpPositionStateActive LpPositionState = iota
	// LpPositionStateUnbonding indicates an LP position waiting for unbond epochs.
	LpPositionStateUnbonding
	// LpPositionStateReady indicates an active LP position that has reached unlock time.
	LpPositionStateReady
	// LpPositionStateWithdrawn indicates an LP position has been withdrawn.
	LpPositionStateWithdrawn
	// LpPositionStateLiquidated indicates losses covered the LP principal.
	LpPositionStateLiquidated
	// LpPositionStateWithdrawable indicates an unbonded LP position can withdraw now.
	LpPositionStateWithdrawable
)

// String returns the stable text form of LpPositionState.
func (s LpPositionState) String() string {
	switch s {
	case LpPositionStateActive:
		return "active"
	case LpPositionStateUnbonding:
		return "unbonding"
	case LpPositionStateReady:
		return "ready"
	case LpPositionStateWithdrawn:
		return "withdrawn"
	case LpPositionStateLiquidated:
		return "liquidated"
	case LpPositionStateWithdrawable:
		return "withdrawable"
	default:
		return "unknown"
	}
}

// PoolStatus is the business lifecycle state of a liquidity pool.
type PoolStatus uint8

const (
	// PoolStatusUnknown indicates an unmapped or unset liquidity pool status.
	PoolStatusUnknown PoolStatus = iota
	// PoolStatusOpen indicates deposits or active liquidity accounting are open.
	PoolStatusOpen
	// PoolStatusClosed indicates deposits are closed.
	PoolStatusClosed
	// PoolStatusSettled indicates the pool has completed settlement.
	PoolStatusSettled
)

// String returns the stable text form of PoolStatus.
func (s PoolStatus) String() string {
	switch s {
	case PoolStatusOpen:
		return "open"
	case PoolStatusClosed:
		return "closed"
	case PoolStatusSettled:
		return "settled"
	default:
		return "unknown"
	}
}

// LiquidityTotals summarizes global liquidity accounting.
type LiquidityTotals struct {
	RequestableLiquidity           *big.Int
	TotalActiveDeposited           *big.Int
	TotalOutstandingPayoutReserved *big.Int
}

// Copy returns a defensive copy of LiquidityTotals.
func (t LiquidityTotals) Copy() LiquidityTotals {
	out := t
	if t.RequestableLiquidity != nil {
		out.RequestableLiquidity = new(big.Int).Set(t.RequestableLiquidity)
	}
	if t.TotalActiveDeposited != nil {
		out.TotalActiveDeposited = new(big.Int).Set(t.TotalActiveDeposited)
	}
	if t.TotalOutstandingPayoutReserved != nil {
		out.TotalOutstandingPayoutReserved = new(big.Int).Set(t.TotalOutstandingPayoutReserved)
	}
	return out
}
