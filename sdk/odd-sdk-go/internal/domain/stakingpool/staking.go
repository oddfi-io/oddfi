// Package stakingpool contains staking business concepts.
package stakingpool

// PositionState is the lifecycle state of a staking position.
type PositionState uint8

const (
	// PositionStateUnknown indicates an unmapped or unset staking position state.
	PositionStateUnknown PositionState = iota
	// PositionStateActive indicates an active staking position.
	PositionStateActive
	// PositionStateUnstaking indicates a position in an unstaking flow.
	PositionStateUnstaking
	// PositionStateClosed indicates a closed staking position.
	PositionStateClosed
)

// String returns the stable text form of PositionState.
func (s PositionState) String() string {
	switch s {
	case PositionStateActive:
		return "active"
	case PositionStateUnstaking:
		return "unstaking"
	case PositionStateClosed:
		return "closed"
	default:
		return "unknown"
	}
}

// VIPTier identifies an oddfi staking VIP tier.
type VIPTier uint8
