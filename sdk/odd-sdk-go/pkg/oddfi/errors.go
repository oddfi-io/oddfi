package oddfi

import (
	"errors"
	"fmt"
)

// ErrInvalidAddress indicates an address failed parsing or checksum validation.
var ErrInvalidAddress = errors.New("invalid address")

// ErrNilContext indicates a public I/O method was called with a nil context.
var ErrNilContext = errors.New("nil context")

// ErrMissingODDToken indicates the client has no ODDToken reader configured.
var ErrMissingODDToken = errors.New("missing odd token reader")

// ErrMissingStakingPool indicates the client has no StakingPool reader configured.
var ErrMissingStakingPool = errors.New("missing staking pool reader")

// ErrMissingLiquidityPool indicates the client has no LiquidityPool reader configured.
var ErrMissingLiquidityPool = errors.New("missing liquidity pool reader")

// ErrMissingBettingPool indicates the client has no BettingPool reader configured.
var ErrMissingBettingPool = errors.New("missing betting pool reader")

// ErrMissingTierSale indicates the client has no TierSale reader configured.
var ErrMissingTierSale = errors.New("missing tier sale reader")

// ErrMissingHouseVault indicates the client has no HouseVault reader configured.
var ErrMissingHouseVault = errors.New("missing house vault reader")

// ErrMissingDexLaunchController indicates the client has no DexLaunchController reader configured.
var ErrMissingDexLaunchController = errors.New("missing dex launch controller reader")

// ErrMissingDexLpLocker indicates the client has no DexLpLocker reader configured.
var ErrMissingDexLpLocker = errors.New("missing dex lp locker reader")

// ErrMissingEcosystemRewards indicates the client has no EcosystemRewards reader configured.
var ErrMissingEcosystemRewards = errors.New("missing ecosystem rewards reader")

// ErrNilBigIntParam indicates a required *big.Int parameter was nil.
var ErrNilBigIntParam = errors.New("nil *big.Int parameter")

// ConfigError reports invalid SDK configuration. It is not retryable until the
// caller changes configuration.
type ConfigError struct {
	Op  string
	Err error
}

// Error returns the formatted configuration error.
func (e *ConfigError) Error() string {
	return fmt.Sprintf("config %s: %v", e.Op, e.Err)
}

// Unwrap returns the underlying error.
func (e *ConfigError) Unwrap() error {
	return e.Err
}

// InfraError reports RPC, binding, or adapter failures. Retryability depends on
// the wrapped error and caller policy.
type InfraError struct {
	Op  string
	Err error
}

// Error returns the formatted infrastructure error.
func (e *InfraError) Error() string {
	return fmt.Sprintf("infra %s: %v", e.Op, e.Err)
}

// Unwrap returns the underlying error.
func (e *InfraError) Unwrap() error {
	return e.Err
}

// UserError reports invalid public API input supplied by the caller.
type UserError struct {
	Op  string
	Err error
}

// Error returns the formatted user error.
func (e *UserError) Error() string {
	return fmt.Sprintf("user %s: %v", e.Op, e.Err)
}

// Unwrap returns the underlying error.
func (e *UserError) Unwrap() error {
	return e.Err
}
