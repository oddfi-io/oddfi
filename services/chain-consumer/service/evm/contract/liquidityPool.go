// Code generated - DO NOT EDIT.
// This file is a generated binding and any manual changes will be lost.

package contract

import (
	"errors"
	"math/big"
	"strings"

	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/event"
)

// Reference imports to suppress errors if they are not otherwise used.
var (
	_ = errors.New
	_ = big.NewInt
	_ = strings.NewReader
	_ = ethereum.NotFound
	_ = bind.Bind
	_ = common.Big1
	_ = types.BloomLookup
	_ = event.NewSubscription
	_ = abi.ConvertType
)

// LiquidityPoolMetaData contains all meta data concerning the LiquidityPool contract.
var LiquidityPoolMetaData = &bind.MetaData{
	ABI: "[{\"type\":\"constructor\",\"inputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"DEFAULT_ADMIN_ROLE\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"UPGRADE_INTERFACE_VERSION\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"string\",\"internalType\":\"string\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"bettingPool\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"address\",\"internalType\":\"address\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"closeMatchPoolDeposit\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"depositGlobal\",\"inputs\":[{\"name\":\"amount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"planId\",\"type\":\"uint16\",\"internalType\":\"uint16\"}],\"outputs\":[{\"name\":\"positionId\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"depositMatch\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"amount\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[{\"name\":\"positionId\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"distributeLoss\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"netLoss\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[{\"name\":\"lpLossBooked\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"distributeMargin\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"lpMarginShare\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"epochStart\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint64\",\"internalType\":\"uint64\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"getPayoutLiquidityWindow\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[{\"name\":\"reservedAmount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"paidOutAmount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"settledAt\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"getPoolWeights\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[{\"name\":\"globalWeight\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"matchWeight\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"getPositionState\",\"inputs\":[{\"name\":\"positionId\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[{\"name\":\"\",\"type\":\"uint8\",\"internalType\":\"enumLpPositionState\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"getRequestableLiquidity\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"getRoleAdmin\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"grantRole\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"hasRole\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[{\"name\":\"\",\"type\":\"bool\",\"internalType\":\"bool\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"initialize\",\"inputs\":[{\"name\":\"admin\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"oddTokenAddress\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"initialBettingPool\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"minDeposit\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"nextLpPositionId\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"oddToken\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"address\",\"internalType\":\"contractIERC20\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"openMatchPool\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"matchStartTime\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"matchEndTime\",\"type\":\"uint64\",\"internalType\":\"uint64\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"pause\",\"inputs\":[],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"paused\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"bool\",\"internalType\":\"bool\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"payoutWindows\",\"inputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"reservedAmount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"paidOutAmount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"settledAt\",\"type\":\"uint64\",\"internalType\":\"uint64\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"pools\",\"inputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[{\"name\":\"poolType\",\"type\":\"uint8\",\"internalType\":\"enumPoolType\"},{\"name\":\"matchId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"exists\",\"type\":\"bool\",\"internalType\":\"bool\"},{\"name\":\"depositOpen\",\"type\":\"bool\",\"internalType\":\"bool\"},{\"name\":\"depositCloseAt\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"unlockAt\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"totalDeposited\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"totalWeight\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"rewardPerWeight\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"lossPerPrincipal\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"positions\",\"inputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[{\"name\":\"owner\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"poolId\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"principal\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"weight\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"unlockAt\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"rewardDebt\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"lossDebt\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"unbondingEpoch\",\"type\":\"uint32\",\"internalType\":\"uint32\"},{\"name\":\"frozenRewardPerWeight\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"frozenLossPerPrincipal\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"planId\",\"type\":\"uint16\",\"internalType\":\"uint16\"},{\"name\":\"state\",\"type\":\"uint8\",\"internalType\":\"enumLpPositionState\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"proxiableUUID\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"renounceRole\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"callerConfirmation\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"requestPayoutLiquidity\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"amount\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"requestUnbond\",\"inputs\":[{\"name\":\"positionId\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"requestableLiquidity\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"revokeRole\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"setBettingPool\",\"inputs\":[{\"name\":\"newBettingPool\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"setMinDeposit\",\"inputs\":[{\"name\":\"newMinDeposit\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"setUnbondEpochs\",\"inputs\":[{\"name\":\"newUnbondEpochs\",\"type\":\"uint32\",\"internalType\":\"uint32\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"supportsInterface\",\"inputs\":[{\"name\":\"interfaceId\",\"type\":\"bytes4\",\"internalType\":\"bytes4\"}],\"outputs\":[{\"name\":\"\",\"type\":\"bool\",\"internalType\":\"bool\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"totalActiveDeposited\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"totalOutstandingPayoutReserved\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"unbondEpochs\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint32\",\"internalType\":\"uint32\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"unpause\",\"inputs\":[],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"upgradeToAndCall\",\"inputs\":[{\"name\":\"newImplementation\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"data\",\"type\":\"bytes\",\"internalType\":\"bytes\"}],\"outputs\":[],\"stateMutability\":\"payable\"},{\"type\":\"function\",\"name\":\"withdraw\",\"inputs\":[{\"name\":\"positionId\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"event\",\"name\":\"Initialized\",\"inputs\":[{\"name\":\"version\",\"type\":\"uint64\",\"indexed\":false,\"internalType\":\"uint64\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"LiquidityAccountingSnapshot\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"poolId\",\"type\":\"uint256\",\"indexed\":true,\"internalType\":\"uint256\"},{\"name\":\"positionId\",\"type\":\"uint256\",\"indexed\":true,\"internalType\":\"uint256\"},{\"name\":\"actionKind\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"uint8\"},{\"name\":\"requestableLiquidityAfter\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"totalActiveDepositedAfter\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"totalOutstandingPayoutReservedAfter\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"poolTotalDepositedAfter\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"poolTotalWeightAfter\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"LiquidityConfigUpdated\",\"inputs\":[{\"name\":\"operator\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"newBettingPool\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"LiquidityDeposited\",\"inputs\":[{\"name\":\"positionId\",\"type\":\"uint256\",\"indexed\":true,\"internalType\":\"uint256\"},{\"name\":\"poolId\",\"type\":\"uint256\",\"indexed\":true,\"internalType\":\"uint256\"},{\"name\":\"user\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"weight\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"planId\",\"type\":\"uint16\",\"indexed\":false,\"internalType\":\"uint16\"},{\"name\":\"unlockAt\",\"type\":\"uint64\",\"indexed\":false,\"internalType\":\"uint64\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"LiquidityPositionStateChanged\",\"inputs\":[{\"name\":\"positionId\",\"type\":\"uint256\",\"indexed\":true,\"internalType\":\"uint256\"},{\"name\":\"user\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"previousState\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"uint8\"},{\"name\":\"newState\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"uint8\"},{\"name\":\"principal\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"weight\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"LiquidityWithdrawn\",\"inputs\":[{\"name\":\"positionId\",\"type\":\"uint256\",\"indexed\":true,\"internalType\":\"uint256\"},{\"name\":\"user\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"withdrawAmount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"finalState\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"uint8\"},{\"name\":\"netPnl\",\"type\":\"int256\",\"indexed\":false,\"internalType\":\"int256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"LossDistributed\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"lpLossBooked\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"globalLossShare\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"matchLossShare\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"MarginDistributed\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"lpMarginShare\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"globalShare\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"matchShare\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"MatchPoolDepositClosed\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"poolId\",\"type\":\"uint256\",\"indexed\":true,\"internalType\":\"uint256\"},{\"name\":\"reason\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"uint8\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"MatchPoolOpened\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"poolId\",\"type\":\"uint256\",\"indexed\":true,\"internalType\":\"uint256\"},{\"name\":\"matchEndTime\",\"type\":\"uint64\",\"indexed\":false,\"internalType\":\"uint64\"},{\"name\":\"depositCloseAt\",\"type\":\"uint64\",\"indexed\":false,\"internalType\":\"uint64\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"MinDepositUpdated\",\"inputs\":[{\"name\":\"operator\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"oldAmount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"newAmount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"Paused\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"indexed\":false,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"PayoutLiquidityReserved\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"reservedAmount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"paidOutAmount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"settledAt\",\"type\":\"uint64\",\"indexed\":false,\"internalType\":\"uint64\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"PayoutLiquidityTransferred\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"amount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"newPaidOutAmount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"RoleAdminChanged\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"previousAdminRole\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"newAdminRole\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"RoleGranted\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"account\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"sender\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"RoleRevoked\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"account\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"sender\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"UnbondEpochsUpdated\",\"inputs\":[{\"name\":\"operator\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"oldEpochs\",\"type\":\"uint32\",\"indexed\":false,\"internalType\":\"uint32\"},{\"name\":\"newEpochs\",\"type\":\"uint32\",\"indexed\":false,\"internalType\":\"uint32\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"UnbondRequested\",\"inputs\":[{\"name\":\"positionId\",\"type\":\"uint256\",\"indexed\":true,\"internalType\":\"uint256\"},{\"name\":\"user\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"unbondingEpoch\",\"type\":\"uint32\",\"indexed\":false,\"internalType\":\"uint32\"},{\"name\":\"frozenRewardPerWeight\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"frozenLossPerPrincipal\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"Unpaused\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"indexed\":false,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"Upgraded\",\"inputs\":[{\"name\":\"implementation\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"error\",\"name\":\"AccessControlBadConfirmation\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"AccessControlUnauthorizedAccount\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"neededRole\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}]},{\"type\":\"error\",\"name\":\"AddressEmptyCode\",\"inputs\":[{\"name\":\"target\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"BettingPoolOnly\",\"inputs\":[{\"name\":\"caller\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"DepositBelowMinimum\",\"inputs\":[{\"name\":\"attempted\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"minimum\",\"type\":\"uint256\",\"internalType\":\"uint256\"}]},{\"type\":\"error\",\"name\":\"ERC1967InvalidImplementation\",\"inputs\":[{\"name\":\"implementation\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"ERC1967NonPayable\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"EnforcedPause\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"EpochNotReady\",\"inputs\":[{\"name\":\"currentEpoch\",\"type\":\"uint32\",\"internalType\":\"uint32\"},{\"name\":\"requiredEpoch\",\"type\":\"uint32\",\"internalType\":\"uint32\"}]},{\"type\":\"error\",\"name\":\"ExpectedPause\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"FailedCall\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"InvalidAddress\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"InvalidInitialization\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"InvalidLiquidityPlan\",\"inputs\":[{\"name\":\"planId\",\"type\":\"uint16\",\"internalType\":\"uint16\"}]},{\"type\":\"error\",\"name\":\"InvalidMatchPoolLifecycle\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}]},{\"type\":\"error\",\"name\":\"LpPositionNotOwner\",\"inputs\":[{\"name\":\"positionId\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"caller\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"MatchNotTerminal\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}]},{\"type\":\"error\",\"name\":\"MatchPoolDepositsClosed\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}]},{\"type\":\"error\",\"name\":\"NotInitializing\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"PayoutWindowExceeded\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"requested\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"remaining\",\"type\":\"uint256\",\"internalType\":\"uint256\"}]},{\"type\":\"error\",\"name\":\"PositionNotUnbondable\",\"inputs\":[{\"name\":\"positionId\",\"type\":\"uint256\",\"internalType\":\"uint256\"}]},{\"type\":\"error\",\"name\":\"SafeERC20FailedOperation\",\"inputs\":[{\"name\":\"token\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"UUPSUnauthorizedCallContext\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"UUPSUnsupportedProxiableUUID\",\"inputs\":[{\"name\":\"slot\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}]}]",
}

// LiquidityPoolABI is the input ABI used to generate the binding from.
// Deprecated: Use LiquidityPoolMetaData.ABI instead.
var LiquidityPoolABI = LiquidityPoolMetaData.ABI

// LiquidityPool is an auto generated Go binding around an Ethereum contract.
type LiquidityPool struct {
	LiquidityPoolCaller     // Read-only binding to the contract
	LiquidityPoolTransactor // Write-only binding to the contract
	LiquidityPoolFilterer   // Log filterer for contract events
}

// LiquidityPoolCaller is an auto generated read-only Go binding around an Ethereum contract.
type LiquidityPoolCaller struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// LiquidityPoolTransactor is an auto generated write-only Go binding around an Ethereum contract.
type LiquidityPoolTransactor struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// LiquidityPoolFilterer is an auto generated log filtering Go binding around an Ethereum contract events.
type LiquidityPoolFilterer struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// LiquidityPoolSession is an auto generated Go binding around an Ethereum contract,
// with pre-set call and transact options.
type LiquidityPoolSession struct {
	Contract     *LiquidityPool    // Generic contract binding to set the session for
	CallOpts     bind.CallOpts     // Call options to use throughout this session
	TransactOpts bind.TransactOpts // Transaction auth options to use throughout this session
}

// LiquidityPoolCallerSession is an auto generated read-only Go binding around an Ethereum contract,
// with pre-set call options.
type LiquidityPoolCallerSession struct {
	Contract *LiquidityPoolCaller // Generic contract caller binding to set the session for
	CallOpts bind.CallOpts        // Call options to use throughout this session
}

// LiquidityPoolTransactorSession is an auto generated write-only Go binding around an Ethereum contract,
// with pre-set transact options.
type LiquidityPoolTransactorSession struct {
	Contract     *LiquidityPoolTransactor // Generic contract transactor binding to set the session for
	TransactOpts bind.TransactOpts        // Transaction auth options to use throughout this session
}

// LiquidityPoolRaw is an auto generated low-level Go binding around an Ethereum contract.
type LiquidityPoolRaw struct {
	Contract *LiquidityPool // Generic contract binding to access the raw methods on
}

// LiquidityPoolCallerRaw is an auto generated low-level read-only Go binding around an Ethereum contract.
type LiquidityPoolCallerRaw struct {
	Contract *LiquidityPoolCaller // Generic read-only contract binding to access the raw methods on
}

// LiquidityPoolTransactorRaw is an auto generated low-level write-only Go binding around an Ethereum contract.
type LiquidityPoolTransactorRaw struct {
	Contract *LiquidityPoolTransactor // Generic write-only contract binding to access the raw methods on
}

// NewLiquidityPool creates a new instance of LiquidityPool, bound to a specific deployed contract.
func NewLiquidityPool(address common.Address, backend bind.ContractBackend) (*LiquidityPool, error) {
	contract, err := bindLiquidityPool(address, backend, backend, backend)
	if err != nil {
		return nil, err
	}
	return &LiquidityPool{LiquidityPoolCaller: LiquidityPoolCaller{contract: contract}, LiquidityPoolTransactor: LiquidityPoolTransactor{contract: contract}, LiquidityPoolFilterer: LiquidityPoolFilterer{contract: contract}}, nil
}

// NewLiquidityPoolCaller creates a new read-only instance of LiquidityPool, bound to a specific deployed contract.
func NewLiquidityPoolCaller(address common.Address, caller bind.ContractCaller) (*LiquidityPoolCaller, error) {
	contract, err := bindLiquidityPool(address, caller, nil, nil)
	if err != nil {
		return nil, err
	}
	return &LiquidityPoolCaller{contract: contract}, nil
}

// NewLiquidityPoolTransactor creates a new write-only instance of LiquidityPool, bound to a specific deployed contract.
func NewLiquidityPoolTransactor(address common.Address, transactor bind.ContractTransactor) (*LiquidityPoolTransactor, error) {
	contract, err := bindLiquidityPool(address, nil, transactor, nil)
	if err != nil {
		return nil, err
	}
	return &LiquidityPoolTransactor{contract: contract}, nil
}

// NewLiquidityPoolFilterer creates a new log filterer instance of LiquidityPool, bound to a specific deployed contract.
func NewLiquidityPoolFilterer(address common.Address, filterer bind.ContractFilterer) (*LiquidityPoolFilterer, error) {
	contract, err := bindLiquidityPool(address, nil, nil, filterer)
	if err != nil {
		return nil, err
	}
	return &LiquidityPoolFilterer{contract: contract}, nil
}

// bindLiquidityPool binds a generic wrapper to an already deployed contract.
func bindLiquidityPool(address common.Address, caller bind.ContractCaller, transactor bind.ContractTransactor, filterer bind.ContractFilterer) (*bind.BoundContract, error) {
	parsed, err := LiquidityPoolMetaData.GetAbi()
	if err != nil {
		return nil, err
	}
	return bind.NewBoundContract(address, *parsed, caller, transactor, filterer), nil
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_LiquidityPool *LiquidityPoolRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _LiquidityPool.Contract.LiquidityPoolCaller.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_LiquidityPool *LiquidityPoolRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _LiquidityPool.Contract.LiquidityPoolTransactor.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_LiquidityPool *LiquidityPoolRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _LiquidityPool.Contract.LiquidityPoolTransactor.contract.Transact(opts, method, params...)
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_LiquidityPool *LiquidityPoolCallerRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _LiquidityPool.Contract.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_LiquidityPool *LiquidityPoolTransactorRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _LiquidityPool.Contract.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_LiquidityPool *LiquidityPoolTransactorRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _LiquidityPool.Contract.contract.Transact(opts, method, params...)
}

// DEFAULTADMINROLE is a free data retrieval call binding the contract method 0xa217fddf.
//
// Solidity: function DEFAULT_ADMIN_ROLE() view returns(bytes32)
func (_LiquidityPool *LiquidityPoolCaller) DEFAULTADMINROLE(opts *bind.CallOpts) ([32]byte, error) {
	var out []interface{}
	err := _LiquidityPool.contract.Call(opts, &out, "DEFAULT_ADMIN_ROLE")

	if err != nil {
		return *new([32]byte), err
	}

	out0 := *abi.ConvertType(out[0], new([32]byte)).(*[32]byte)

	return out0, err

}

// DEFAULTADMINROLE is a free data retrieval call binding the contract method 0xa217fddf.
//
// Solidity: function DEFAULT_ADMIN_ROLE() view returns(bytes32)
func (_LiquidityPool *LiquidityPoolSession) DEFAULTADMINROLE() ([32]byte, error) {
	return _LiquidityPool.Contract.DEFAULTADMINROLE(&_LiquidityPool.CallOpts)
}

// DEFAULTADMINROLE is a free data retrieval call binding the contract method 0xa217fddf.
//
// Solidity: function DEFAULT_ADMIN_ROLE() view returns(bytes32)
func (_LiquidityPool *LiquidityPoolCallerSession) DEFAULTADMINROLE() ([32]byte, error) {
	return _LiquidityPool.Contract.DEFAULTADMINROLE(&_LiquidityPool.CallOpts)
}

// UPGRADEINTERFACEVERSION is a free data retrieval call binding the contract method 0xad3cb1cc.
//
// Solidity: function UPGRADE_INTERFACE_VERSION() view returns(string)
func (_LiquidityPool *LiquidityPoolCaller) UPGRADEINTERFACEVERSION(opts *bind.CallOpts) (string, error) {
	var out []interface{}
	err := _LiquidityPool.contract.Call(opts, &out, "UPGRADE_INTERFACE_VERSION")

	if err != nil {
		return *new(string), err
	}

	out0 := *abi.ConvertType(out[0], new(string)).(*string)

	return out0, err

}

// UPGRADEINTERFACEVERSION is a free data retrieval call binding the contract method 0xad3cb1cc.
//
// Solidity: function UPGRADE_INTERFACE_VERSION() view returns(string)
func (_LiquidityPool *LiquidityPoolSession) UPGRADEINTERFACEVERSION() (string, error) {
	return _LiquidityPool.Contract.UPGRADEINTERFACEVERSION(&_LiquidityPool.CallOpts)
}

// UPGRADEINTERFACEVERSION is a free data retrieval call binding the contract method 0xad3cb1cc.
//
// Solidity: function UPGRADE_INTERFACE_VERSION() view returns(string)
func (_LiquidityPool *LiquidityPoolCallerSession) UPGRADEINTERFACEVERSION() (string, error) {
	return _LiquidityPool.Contract.UPGRADEINTERFACEVERSION(&_LiquidityPool.CallOpts)
}

// BettingPool is a free data retrieval call binding the contract method 0xa55e7756.
//
// Solidity: function bettingPool() view returns(address)
func (_LiquidityPool *LiquidityPoolCaller) BettingPool(opts *bind.CallOpts) (common.Address, error) {
	var out []interface{}
	err := _LiquidityPool.contract.Call(opts, &out, "bettingPool")

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// BettingPool is a free data retrieval call binding the contract method 0xa55e7756.
//
// Solidity: function bettingPool() view returns(address)
func (_LiquidityPool *LiquidityPoolSession) BettingPool() (common.Address, error) {
	return _LiquidityPool.Contract.BettingPool(&_LiquidityPool.CallOpts)
}

// BettingPool is a free data retrieval call binding the contract method 0xa55e7756.
//
// Solidity: function bettingPool() view returns(address)
func (_LiquidityPool *LiquidityPoolCallerSession) BettingPool() (common.Address, error) {
	return _LiquidityPool.Contract.BettingPool(&_LiquidityPool.CallOpts)
}

// EpochStart is a free data retrieval call binding the contract method 0x15e5a1e5.
//
// Solidity: function epochStart() view returns(uint64)
func (_LiquidityPool *LiquidityPoolCaller) EpochStart(opts *bind.CallOpts) (uint64, error) {
	var out []interface{}
	err := _LiquidityPool.contract.Call(opts, &out, "epochStart")

	if err != nil {
		return *new(uint64), err
	}

	out0 := *abi.ConvertType(out[0], new(uint64)).(*uint64)

	return out0, err

}

// EpochStart is a free data retrieval call binding the contract method 0x15e5a1e5.
//
// Solidity: function epochStart() view returns(uint64)
func (_LiquidityPool *LiquidityPoolSession) EpochStart() (uint64, error) {
	return _LiquidityPool.Contract.EpochStart(&_LiquidityPool.CallOpts)
}

// EpochStart is a free data retrieval call binding the contract method 0x15e5a1e5.
//
// Solidity: function epochStart() view returns(uint64)
func (_LiquidityPool *LiquidityPoolCallerSession) EpochStart() (uint64, error) {
	return _LiquidityPool.Contract.EpochStart(&_LiquidityPool.CallOpts)
}

// GetPayoutLiquidityWindow is a free data retrieval call binding the contract method 0xaceaaa5d.
//
// Solidity: function getPayoutLiquidityWindow(bytes32 matchId) view returns(uint256 reservedAmount, uint256 paidOutAmount, uint256 settledAt)
func (_LiquidityPool *LiquidityPoolCaller) GetPayoutLiquidityWindow(opts *bind.CallOpts, matchId [32]byte) (struct {
	ReservedAmount *big.Int
	PaidOutAmount  *big.Int
	SettledAt      *big.Int
}, error) {
	var out []interface{}
	err := _LiquidityPool.contract.Call(opts, &out, "getPayoutLiquidityWindow", matchId)

	outstruct := new(struct {
		ReservedAmount *big.Int
		PaidOutAmount  *big.Int
		SettledAt      *big.Int
	})
	if err != nil {
		return *outstruct, err
	}

	outstruct.ReservedAmount = *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)
	outstruct.PaidOutAmount = *abi.ConvertType(out[1], new(*big.Int)).(**big.Int)
	outstruct.SettledAt = *abi.ConvertType(out[2], new(*big.Int)).(**big.Int)

	return *outstruct, err

}

// GetPayoutLiquidityWindow is a free data retrieval call binding the contract method 0xaceaaa5d.
//
// Solidity: function getPayoutLiquidityWindow(bytes32 matchId) view returns(uint256 reservedAmount, uint256 paidOutAmount, uint256 settledAt)
func (_LiquidityPool *LiquidityPoolSession) GetPayoutLiquidityWindow(matchId [32]byte) (struct {
	ReservedAmount *big.Int
	PaidOutAmount  *big.Int
	SettledAt      *big.Int
}, error) {
	return _LiquidityPool.Contract.GetPayoutLiquidityWindow(&_LiquidityPool.CallOpts, matchId)
}

// GetPayoutLiquidityWindow is a free data retrieval call binding the contract method 0xaceaaa5d.
//
// Solidity: function getPayoutLiquidityWindow(bytes32 matchId) view returns(uint256 reservedAmount, uint256 paidOutAmount, uint256 settledAt)
func (_LiquidityPool *LiquidityPoolCallerSession) GetPayoutLiquidityWindow(matchId [32]byte) (struct {
	ReservedAmount *big.Int
	PaidOutAmount  *big.Int
	SettledAt      *big.Int
}, error) {
	return _LiquidityPool.Contract.GetPayoutLiquidityWindow(&_LiquidityPool.CallOpts, matchId)
}

// GetPoolWeights is a free data retrieval call binding the contract method 0x68ea4ab6.
//
// Solidity: function getPoolWeights(bytes32 matchId) view returns(uint256 globalWeight, uint256 matchWeight)
func (_LiquidityPool *LiquidityPoolCaller) GetPoolWeights(opts *bind.CallOpts, matchId [32]byte) (struct {
	GlobalWeight *big.Int
	MatchWeight  *big.Int
}, error) {
	var out []interface{}
	err := _LiquidityPool.contract.Call(opts, &out, "getPoolWeights", matchId)

	outstruct := new(struct {
		GlobalWeight *big.Int
		MatchWeight  *big.Int
	})
	if err != nil {
		return *outstruct, err
	}

	outstruct.GlobalWeight = *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)
	outstruct.MatchWeight = *abi.ConvertType(out[1], new(*big.Int)).(**big.Int)

	return *outstruct, err

}

// GetPoolWeights is a free data retrieval call binding the contract method 0x68ea4ab6.
//
// Solidity: function getPoolWeights(bytes32 matchId) view returns(uint256 globalWeight, uint256 matchWeight)
func (_LiquidityPool *LiquidityPoolSession) GetPoolWeights(matchId [32]byte) (struct {
	GlobalWeight *big.Int
	MatchWeight  *big.Int
}, error) {
	return _LiquidityPool.Contract.GetPoolWeights(&_LiquidityPool.CallOpts, matchId)
}

// GetPoolWeights is a free data retrieval call binding the contract method 0x68ea4ab6.
//
// Solidity: function getPoolWeights(bytes32 matchId) view returns(uint256 globalWeight, uint256 matchWeight)
func (_LiquidityPool *LiquidityPoolCallerSession) GetPoolWeights(matchId [32]byte) (struct {
	GlobalWeight *big.Int
	MatchWeight  *big.Int
}, error) {
	return _LiquidityPool.Contract.GetPoolWeights(&_LiquidityPool.CallOpts, matchId)
}

// GetPositionState is a free data retrieval call binding the contract method 0xeb29dc5e.
//
// Solidity: function getPositionState(uint256 positionId) view returns(uint8)
func (_LiquidityPool *LiquidityPoolCaller) GetPositionState(opts *bind.CallOpts, positionId *big.Int) (uint8, error) {
	var out []interface{}
	err := _LiquidityPool.contract.Call(opts, &out, "getPositionState", positionId)

	if err != nil {
		return *new(uint8), err
	}

	out0 := *abi.ConvertType(out[0], new(uint8)).(*uint8)

	return out0, err

}

// GetPositionState is a free data retrieval call binding the contract method 0xeb29dc5e.
//
// Solidity: function getPositionState(uint256 positionId) view returns(uint8)
func (_LiquidityPool *LiquidityPoolSession) GetPositionState(positionId *big.Int) (uint8, error) {
	return _LiquidityPool.Contract.GetPositionState(&_LiquidityPool.CallOpts, positionId)
}

// GetPositionState is a free data retrieval call binding the contract method 0xeb29dc5e.
//
// Solidity: function getPositionState(uint256 positionId) view returns(uint8)
func (_LiquidityPool *LiquidityPoolCallerSession) GetPositionState(positionId *big.Int) (uint8, error) {
	return _LiquidityPool.Contract.GetPositionState(&_LiquidityPool.CallOpts, positionId)
}

// GetRequestableLiquidity is a free data retrieval call binding the contract method 0xdb108f2e.
//
// Solidity: function getRequestableLiquidity() view returns(uint256)
func (_LiquidityPool *LiquidityPoolCaller) GetRequestableLiquidity(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _LiquidityPool.contract.Call(opts, &out, "getRequestableLiquidity")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// GetRequestableLiquidity is a free data retrieval call binding the contract method 0xdb108f2e.
//
// Solidity: function getRequestableLiquidity() view returns(uint256)
func (_LiquidityPool *LiquidityPoolSession) GetRequestableLiquidity() (*big.Int, error) {
	return _LiquidityPool.Contract.GetRequestableLiquidity(&_LiquidityPool.CallOpts)
}

// GetRequestableLiquidity is a free data retrieval call binding the contract method 0xdb108f2e.
//
// Solidity: function getRequestableLiquidity() view returns(uint256)
func (_LiquidityPool *LiquidityPoolCallerSession) GetRequestableLiquidity() (*big.Int, error) {
	return _LiquidityPool.Contract.GetRequestableLiquidity(&_LiquidityPool.CallOpts)
}

// GetRoleAdmin is a free data retrieval call binding the contract method 0x248a9ca3.
//
// Solidity: function getRoleAdmin(bytes32 role) view returns(bytes32)
func (_LiquidityPool *LiquidityPoolCaller) GetRoleAdmin(opts *bind.CallOpts, role [32]byte) ([32]byte, error) {
	var out []interface{}
	err := _LiquidityPool.contract.Call(opts, &out, "getRoleAdmin", role)

	if err != nil {
		return *new([32]byte), err
	}

	out0 := *abi.ConvertType(out[0], new([32]byte)).(*[32]byte)

	return out0, err

}

// GetRoleAdmin is a free data retrieval call binding the contract method 0x248a9ca3.
//
// Solidity: function getRoleAdmin(bytes32 role) view returns(bytes32)
func (_LiquidityPool *LiquidityPoolSession) GetRoleAdmin(role [32]byte) ([32]byte, error) {
	return _LiquidityPool.Contract.GetRoleAdmin(&_LiquidityPool.CallOpts, role)
}

// GetRoleAdmin is a free data retrieval call binding the contract method 0x248a9ca3.
//
// Solidity: function getRoleAdmin(bytes32 role) view returns(bytes32)
func (_LiquidityPool *LiquidityPoolCallerSession) GetRoleAdmin(role [32]byte) ([32]byte, error) {
	return _LiquidityPool.Contract.GetRoleAdmin(&_LiquidityPool.CallOpts, role)
}

// HasRole is a free data retrieval call binding the contract method 0x91d14854.
//
// Solidity: function hasRole(bytes32 role, address account) view returns(bool)
func (_LiquidityPool *LiquidityPoolCaller) HasRole(opts *bind.CallOpts, role [32]byte, account common.Address) (bool, error) {
	var out []interface{}
	err := _LiquidityPool.contract.Call(opts, &out, "hasRole", role, account)

	if err != nil {
		return *new(bool), err
	}

	out0 := *abi.ConvertType(out[0], new(bool)).(*bool)

	return out0, err

}

// HasRole is a free data retrieval call binding the contract method 0x91d14854.
//
// Solidity: function hasRole(bytes32 role, address account) view returns(bool)
func (_LiquidityPool *LiquidityPoolSession) HasRole(role [32]byte, account common.Address) (bool, error) {
	return _LiquidityPool.Contract.HasRole(&_LiquidityPool.CallOpts, role, account)
}

// HasRole is a free data retrieval call binding the contract method 0x91d14854.
//
// Solidity: function hasRole(bytes32 role, address account) view returns(bool)
func (_LiquidityPool *LiquidityPoolCallerSession) HasRole(role [32]byte, account common.Address) (bool, error) {
	return _LiquidityPool.Contract.HasRole(&_LiquidityPool.CallOpts, role, account)
}

// MinDeposit is a free data retrieval call binding the contract method 0x41b3d185.
//
// Solidity: function minDeposit() view returns(uint256)
func (_LiquidityPool *LiquidityPoolCaller) MinDeposit(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _LiquidityPool.contract.Call(opts, &out, "minDeposit")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// MinDeposit is a free data retrieval call binding the contract method 0x41b3d185.
//
// Solidity: function minDeposit() view returns(uint256)
func (_LiquidityPool *LiquidityPoolSession) MinDeposit() (*big.Int, error) {
	return _LiquidityPool.Contract.MinDeposit(&_LiquidityPool.CallOpts)
}

// MinDeposit is a free data retrieval call binding the contract method 0x41b3d185.
//
// Solidity: function minDeposit() view returns(uint256)
func (_LiquidityPool *LiquidityPoolCallerSession) MinDeposit() (*big.Int, error) {
	return _LiquidityPool.Contract.MinDeposit(&_LiquidityPool.CallOpts)
}

// NextLpPositionId is a free data retrieval call binding the contract method 0xecad31a6.
//
// Solidity: function nextLpPositionId() view returns(uint256)
func (_LiquidityPool *LiquidityPoolCaller) NextLpPositionId(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _LiquidityPool.contract.Call(opts, &out, "nextLpPositionId")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// NextLpPositionId is a free data retrieval call binding the contract method 0xecad31a6.
//
// Solidity: function nextLpPositionId() view returns(uint256)
func (_LiquidityPool *LiquidityPoolSession) NextLpPositionId() (*big.Int, error) {
	return _LiquidityPool.Contract.NextLpPositionId(&_LiquidityPool.CallOpts)
}

// NextLpPositionId is a free data retrieval call binding the contract method 0xecad31a6.
//
// Solidity: function nextLpPositionId() view returns(uint256)
func (_LiquidityPool *LiquidityPoolCallerSession) NextLpPositionId() (*big.Int, error) {
	return _LiquidityPool.Contract.NextLpPositionId(&_LiquidityPool.CallOpts)
}

// OddToken is a free data retrieval call binding the contract method 0x94235764.
//
// Solidity: function oddToken() view returns(address)
func (_LiquidityPool *LiquidityPoolCaller) OddToken(opts *bind.CallOpts) (common.Address, error) {
	var out []interface{}
	err := _LiquidityPool.contract.Call(opts, &out, "oddToken")

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// OddToken is a free data retrieval call binding the contract method 0x94235764.
//
// Solidity: function oddToken() view returns(address)
func (_LiquidityPool *LiquidityPoolSession) OddToken() (common.Address, error) {
	return _LiquidityPool.Contract.OddToken(&_LiquidityPool.CallOpts)
}

// OddToken is a free data retrieval call binding the contract method 0x94235764.
//
// Solidity: function oddToken() view returns(address)
func (_LiquidityPool *LiquidityPoolCallerSession) OddToken() (common.Address, error) {
	return _LiquidityPool.Contract.OddToken(&_LiquidityPool.CallOpts)
}

// Paused is a free data retrieval call binding the contract method 0x5c975abb.
//
// Solidity: function paused() view returns(bool)
func (_LiquidityPool *LiquidityPoolCaller) Paused(opts *bind.CallOpts) (bool, error) {
	var out []interface{}
	err := _LiquidityPool.contract.Call(opts, &out, "paused")

	if err != nil {
		return *new(bool), err
	}

	out0 := *abi.ConvertType(out[0], new(bool)).(*bool)

	return out0, err

}

// Paused is a free data retrieval call binding the contract method 0x5c975abb.
//
// Solidity: function paused() view returns(bool)
func (_LiquidityPool *LiquidityPoolSession) Paused() (bool, error) {
	return _LiquidityPool.Contract.Paused(&_LiquidityPool.CallOpts)
}

// Paused is a free data retrieval call binding the contract method 0x5c975abb.
//
// Solidity: function paused() view returns(bool)
func (_LiquidityPool *LiquidityPoolCallerSession) Paused() (bool, error) {
	return _LiquidityPool.Contract.Paused(&_LiquidityPool.CallOpts)
}

// PayoutWindows is a free data retrieval call binding the contract method 0xd7d10410.
//
// Solidity: function payoutWindows(bytes32 ) view returns(bytes32 matchId, uint256 reservedAmount, uint256 paidOutAmount, uint64 settledAt)
func (_LiquidityPool *LiquidityPoolCaller) PayoutWindows(opts *bind.CallOpts, arg0 [32]byte) (struct {
	MatchId        [32]byte
	ReservedAmount *big.Int
	PaidOutAmount  *big.Int
	SettledAt      uint64
}, error) {
	var out []interface{}
	err := _LiquidityPool.contract.Call(opts, &out, "payoutWindows", arg0)

	outstruct := new(struct {
		MatchId        [32]byte
		ReservedAmount *big.Int
		PaidOutAmount  *big.Int
		SettledAt      uint64
	})
	if err != nil {
		return *outstruct, err
	}

	outstruct.MatchId = *abi.ConvertType(out[0], new([32]byte)).(*[32]byte)
	outstruct.ReservedAmount = *abi.ConvertType(out[1], new(*big.Int)).(**big.Int)
	outstruct.PaidOutAmount = *abi.ConvertType(out[2], new(*big.Int)).(**big.Int)
	outstruct.SettledAt = *abi.ConvertType(out[3], new(uint64)).(*uint64)

	return *outstruct, err

}

// PayoutWindows is a free data retrieval call binding the contract method 0xd7d10410.
//
// Solidity: function payoutWindows(bytes32 ) view returns(bytes32 matchId, uint256 reservedAmount, uint256 paidOutAmount, uint64 settledAt)
func (_LiquidityPool *LiquidityPoolSession) PayoutWindows(arg0 [32]byte) (struct {
	MatchId        [32]byte
	ReservedAmount *big.Int
	PaidOutAmount  *big.Int
	SettledAt      uint64
}, error) {
	return _LiquidityPool.Contract.PayoutWindows(&_LiquidityPool.CallOpts, arg0)
}

// PayoutWindows is a free data retrieval call binding the contract method 0xd7d10410.
//
// Solidity: function payoutWindows(bytes32 ) view returns(bytes32 matchId, uint256 reservedAmount, uint256 paidOutAmount, uint64 settledAt)
func (_LiquidityPool *LiquidityPoolCallerSession) PayoutWindows(arg0 [32]byte) (struct {
	MatchId        [32]byte
	ReservedAmount *big.Int
	PaidOutAmount  *big.Int
	SettledAt      uint64
}, error) {
	return _LiquidityPool.Contract.PayoutWindows(&_LiquidityPool.CallOpts, arg0)
}

// Pools is a free data retrieval call binding the contract method 0xac4afa38.
//
// Solidity: function pools(uint256 ) view returns(uint8 poolType, bytes32 matchId, bool exists, bool depositOpen, uint64 depositCloseAt, uint64 unlockAt, uint256 totalDeposited, uint256 totalWeight, uint256 rewardPerWeight, uint256 lossPerPrincipal)
func (_LiquidityPool *LiquidityPoolCaller) Pools(opts *bind.CallOpts, arg0 *big.Int) (struct {
	PoolType         uint8
	MatchId          [32]byte
	Exists           bool
	DepositOpen      bool
	DepositCloseAt   uint64
	UnlockAt         uint64
	TotalDeposited   *big.Int
	TotalWeight      *big.Int
	RewardPerWeight  *big.Int
	LossPerPrincipal *big.Int
}, error) {
	var out []interface{}
	err := _LiquidityPool.contract.Call(opts, &out, "pools", arg0)

	outstruct := new(struct {
		PoolType         uint8
		MatchId          [32]byte
		Exists           bool
		DepositOpen      bool
		DepositCloseAt   uint64
		UnlockAt         uint64
		TotalDeposited   *big.Int
		TotalWeight      *big.Int
		RewardPerWeight  *big.Int
		LossPerPrincipal *big.Int
	})
	if err != nil {
		return *outstruct, err
	}

	outstruct.PoolType = *abi.ConvertType(out[0], new(uint8)).(*uint8)
	outstruct.MatchId = *abi.ConvertType(out[1], new([32]byte)).(*[32]byte)
	outstruct.Exists = *abi.ConvertType(out[2], new(bool)).(*bool)
	outstruct.DepositOpen = *abi.ConvertType(out[3], new(bool)).(*bool)
	outstruct.DepositCloseAt = *abi.ConvertType(out[4], new(uint64)).(*uint64)
	outstruct.UnlockAt = *abi.ConvertType(out[5], new(uint64)).(*uint64)
	outstruct.TotalDeposited = *abi.ConvertType(out[6], new(*big.Int)).(**big.Int)
	outstruct.TotalWeight = *abi.ConvertType(out[7], new(*big.Int)).(**big.Int)
	outstruct.RewardPerWeight = *abi.ConvertType(out[8], new(*big.Int)).(**big.Int)
	outstruct.LossPerPrincipal = *abi.ConvertType(out[9], new(*big.Int)).(**big.Int)

	return *outstruct, err

}

// Pools is a free data retrieval call binding the contract method 0xac4afa38.
//
// Solidity: function pools(uint256 ) view returns(uint8 poolType, bytes32 matchId, bool exists, bool depositOpen, uint64 depositCloseAt, uint64 unlockAt, uint256 totalDeposited, uint256 totalWeight, uint256 rewardPerWeight, uint256 lossPerPrincipal)
func (_LiquidityPool *LiquidityPoolSession) Pools(arg0 *big.Int) (struct {
	PoolType         uint8
	MatchId          [32]byte
	Exists           bool
	DepositOpen      bool
	DepositCloseAt   uint64
	UnlockAt         uint64
	TotalDeposited   *big.Int
	TotalWeight      *big.Int
	RewardPerWeight  *big.Int
	LossPerPrincipal *big.Int
}, error) {
	return _LiquidityPool.Contract.Pools(&_LiquidityPool.CallOpts, arg0)
}

// Pools is a free data retrieval call binding the contract method 0xac4afa38.
//
// Solidity: function pools(uint256 ) view returns(uint8 poolType, bytes32 matchId, bool exists, bool depositOpen, uint64 depositCloseAt, uint64 unlockAt, uint256 totalDeposited, uint256 totalWeight, uint256 rewardPerWeight, uint256 lossPerPrincipal)
func (_LiquidityPool *LiquidityPoolCallerSession) Pools(arg0 *big.Int) (struct {
	PoolType         uint8
	MatchId          [32]byte
	Exists           bool
	DepositOpen      bool
	DepositCloseAt   uint64
	UnlockAt         uint64
	TotalDeposited   *big.Int
	TotalWeight      *big.Int
	RewardPerWeight  *big.Int
	LossPerPrincipal *big.Int
}, error) {
	return _LiquidityPool.Contract.Pools(&_LiquidityPool.CallOpts, arg0)
}

// Positions is a free data retrieval call binding the contract method 0x99fbab88.
//
// Solidity: function positions(uint256 ) view returns(address owner, uint256 poolId, uint256 principal, uint256 weight, uint64 unlockAt, uint256 rewardDebt, uint256 lossDebt, uint32 unbondingEpoch, uint256 frozenRewardPerWeight, uint256 frozenLossPerPrincipal, uint16 planId, uint8 state)
func (_LiquidityPool *LiquidityPoolCaller) Positions(opts *bind.CallOpts, arg0 *big.Int) (struct {
	Owner                  common.Address
	PoolId                 *big.Int
	Principal              *big.Int
	Weight                 *big.Int
	UnlockAt               uint64
	RewardDebt             *big.Int
	LossDebt               *big.Int
	UnbondingEpoch         uint32
	FrozenRewardPerWeight  *big.Int
	FrozenLossPerPrincipal *big.Int
	PlanId                 uint16
	State                  uint8
}, error) {
	var out []interface{}
	err := _LiquidityPool.contract.Call(opts, &out, "positions", arg0)

	outstruct := new(struct {
		Owner                  common.Address
		PoolId                 *big.Int
		Principal              *big.Int
		Weight                 *big.Int
		UnlockAt               uint64
		RewardDebt             *big.Int
		LossDebt               *big.Int
		UnbondingEpoch         uint32
		FrozenRewardPerWeight  *big.Int
		FrozenLossPerPrincipal *big.Int
		PlanId                 uint16
		State                  uint8
	})
	if err != nil {
		return *outstruct, err
	}

	outstruct.Owner = *abi.ConvertType(out[0], new(common.Address)).(*common.Address)
	outstruct.PoolId = *abi.ConvertType(out[1], new(*big.Int)).(**big.Int)
	outstruct.Principal = *abi.ConvertType(out[2], new(*big.Int)).(**big.Int)
	outstruct.Weight = *abi.ConvertType(out[3], new(*big.Int)).(**big.Int)
	outstruct.UnlockAt = *abi.ConvertType(out[4], new(uint64)).(*uint64)
	outstruct.RewardDebt = *abi.ConvertType(out[5], new(*big.Int)).(**big.Int)
	outstruct.LossDebt = *abi.ConvertType(out[6], new(*big.Int)).(**big.Int)
	outstruct.UnbondingEpoch = *abi.ConvertType(out[7], new(uint32)).(*uint32)
	outstruct.FrozenRewardPerWeight = *abi.ConvertType(out[8], new(*big.Int)).(**big.Int)
	outstruct.FrozenLossPerPrincipal = *abi.ConvertType(out[9], new(*big.Int)).(**big.Int)
	outstruct.PlanId = *abi.ConvertType(out[10], new(uint16)).(*uint16)
	outstruct.State = *abi.ConvertType(out[11], new(uint8)).(*uint8)

	return *outstruct, err

}

// Positions is a free data retrieval call binding the contract method 0x99fbab88.
//
// Solidity: function positions(uint256 ) view returns(address owner, uint256 poolId, uint256 principal, uint256 weight, uint64 unlockAt, uint256 rewardDebt, uint256 lossDebt, uint32 unbondingEpoch, uint256 frozenRewardPerWeight, uint256 frozenLossPerPrincipal, uint16 planId, uint8 state)
func (_LiquidityPool *LiquidityPoolSession) Positions(arg0 *big.Int) (struct {
	Owner                  common.Address
	PoolId                 *big.Int
	Principal              *big.Int
	Weight                 *big.Int
	UnlockAt               uint64
	RewardDebt             *big.Int
	LossDebt               *big.Int
	UnbondingEpoch         uint32
	FrozenRewardPerWeight  *big.Int
	FrozenLossPerPrincipal *big.Int
	PlanId                 uint16
	State                  uint8
}, error) {
	return _LiquidityPool.Contract.Positions(&_LiquidityPool.CallOpts, arg0)
}

// Positions is a free data retrieval call binding the contract method 0x99fbab88.
//
// Solidity: function positions(uint256 ) view returns(address owner, uint256 poolId, uint256 principal, uint256 weight, uint64 unlockAt, uint256 rewardDebt, uint256 lossDebt, uint32 unbondingEpoch, uint256 frozenRewardPerWeight, uint256 frozenLossPerPrincipal, uint16 planId, uint8 state)
func (_LiquidityPool *LiquidityPoolCallerSession) Positions(arg0 *big.Int) (struct {
	Owner                  common.Address
	PoolId                 *big.Int
	Principal              *big.Int
	Weight                 *big.Int
	UnlockAt               uint64
	RewardDebt             *big.Int
	LossDebt               *big.Int
	UnbondingEpoch         uint32
	FrozenRewardPerWeight  *big.Int
	FrozenLossPerPrincipal *big.Int
	PlanId                 uint16
	State                  uint8
}, error) {
	return _LiquidityPool.Contract.Positions(&_LiquidityPool.CallOpts, arg0)
}

// ProxiableUUID is a free data retrieval call binding the contract method 0x52d1902d.
//
// Solidity: function proxiableUUID() view returns(bytes32)
func (_LiquidityPool *LiquidityPoolCaller) ProxiableUUID(opts *bind.CallOpts) ([32]byte, error) {
	var out []interface{}
	err := _LiquidityPool.contract.Call(opts, &out, "proxiableUUID")

	if err != nil {
		return *new([32]byte), err
	}

	out0 := *abi.ConvertType(out[0], new([32]byte)).(*[32]byte)

	return out0, err

}

// ProxiableUUID is a free data retrieval call binding the contract method 0x52d1902d.
//
// Solidity: function proxiableUUID() view returns(bytes32)
func (_LiquidityPool *LiquidityPoolSession) ProxiableUUID() ([32]byte, error) {
	return _LiquidityPool.Contract.ProxiableUUID(&_LiquidityPool.CallOpts)
}

// ProxiableUUID is a free data retrieval call binding the contract method 0x52d1902d.
//
// Solidity: function proxiableUUID() view returns(bytes32)
func (_LiquidityPool *LiquidityPoolCallerSession) ProxiableUUID() ([32]byte, error) {
	return _LiquidityPool.Contract.ProxiableUUID(&_LiquidityPool.CallOpts)
}

// RequestableLiquidity is a free data retrieval call binding the contract method 0xfff6794b.
//
// Solidity: function requestableLiquidity() view returns(uint256)
func (_LiquidityPool *LiquidityPoolCaller) RequestableLiquidity(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _LiquidityPool.contract.Call(opts, &out, "requestableLiquidity")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// RequestableLiquidity is a free data retrieval call binding the contract method 0xfff6794b.
//
// Solidity: function requestableLiquidity() view returns(uint256)
func (_LiquidityPool *LiquidityPoolSession) RequestableLiquidity() (*big.Int, error) {
	return _LiquidityPool.Contract.RequestableLiquidity(&_LiquidityPool.CallOpts)
}

// RequestableLiquidity is a free data retrieval call binding the contract method 0xfff6794b.
//
// Solidity: function requestableLiquidity() view returns(uint256)
func (_LiquidityPool *LiquidityPoolCallerSession) RequestableLiquidity() (*big.Int, error) {
	return _LiquidityPool.Contract.RequestableLiquidity(&_LiquidityPool.CallOpts)
}

// SupportsInterface is a free data retrieval call binding the contract method 0x01ffc9a7.
//
// Solidity: function supportsInterface(bytes4 interfaceId) view returns(bool)
func (_LiquidityPool *LiquidityPoolCaller) SupportsInterface(opts *bind.CallOpts, interfaceId [4]byte) (bool, error) {
	var out []interface{}
	err := _LiquidityPool.contract.Call(opts, &out, "supportsInterface", interfaceId)

	if err != nil {
		return *new(bool), err
	}

	out0 := *abi.ConvertType(out[0], new(bool)).(*bool)

	return out0, err

}

// SupportsInterface is a free data retrieval call binding the contract method 0x01ffc9a7.
//
// Solidity: function supportsInterface(bytes4 interfaceId) view returns(bool)
func (_LiquidityPool *LiquidityPoolSession) SupportsInterface(interfaceId [4]byte) (bool, error) {
	return _LiquidityPool.Contract.SupportsInterface(&_LiquidityPool.CallOpts, interfaceId)
}

// SupportsInterface is a free data retrieval call binding the contract method 0x01ffc9a7.
//
// Solidity: function supportsInterface(bytes4 interfaceId) view returns(bool)
func (_LiquidityPool *LiquidityPoolCallerSession) SupportsInterface(interfaceId [4]byte) (bool, error) {
	return _LiquidityPool.Contract.SupportsInterface(&_LiquidityPool.CallOpts, interfaceId)
}

// TotalActiveDeposited is a free data retrieval call binding the contract method 0xd097b17e.
//
// Solidity: function totalActiveDeposited() view returns(uint256)
func (_LiquidityPool *LiquidityPoolCaller) TotalActiveDeposited(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _LiquidityPool.contract.Call(opts, &out, "totalActiveDeposited")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// TotalActiveDeposited is a free data retrieval call binding the contract method 0xd097b17e.
//
// Solidity: function totalActiveDeposited() view returns(uint256)
func (_LiquidityPool *LiquidityPoolSession) TotalActiveDeposited() (*big.Int, error) {
	return _LiquidityPool.Contract.TotalActiveDeposited(&_LiquidityPool.CallOpts)
}

// TotalActiveDeposited is a free data retrieval call binding the contract method 0xd097b17e.
//
// Solidity: function totalActiveDeposited() view returns(uint256)
func (_LiquidityPool *LiquidityPoolCallerSession) TotalActiveDeposited() (*big.Int, error) {
	return _LiquidityPool.Contract.TotalActiveDeposited(&_LiquidityPool.CallOpts)
}

// TotalOutstandingPayoutReserved is a free data retrieval call binding the contract method 0x58d2daaf.
//
// Solidity: function totalOutstandingPayoutReserved() view returns(uint256)
func (_LiquidityPool *LiquidityPoolCaller) TotalOutstandingPayoutReserved(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _LiquidityPool.contract.Call(opts, &out, "totalOutstandingPayoutReserved")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// TotalOutstandingPayoutReserved is a free data retrieval call binding the contract method 0x58d2daaf.
//
// Solidity: function totalOutstandingPayoutReserved() view returns(uint256)
func (_LiquidityPool *LiquidityPoolSession) TotalOutstandingPayoutReserved() (*big.Int, error) {
	return _LiquidityPool.Contract.TotalOutstandingPayoutReserved(&_LiquidityPool.CallOpts)
}

// TotalOutstandingPayoutReserved is a free data retrieval call binding the contract method 0x58d2daaf.
//
// Solidity: function totalOutstandingPayoutReserved() view returns(uint256)
func (_LiquidityPool *LiquidityPoolCallerSession) TotalOutstandingPayoutReserved() (*big.Int, error) {
	return _LiquidityPool.Contract.TotalOutstandingPayoutReserved(&_LiquidityPool.CallOpts)
}

// UnbondEpochs is a free data retrieval call binding the contract method 0xe4c8087f.
//
// Solidity: function unbondEpochs() view returns(uint32)
func (_LiquidityPool *LiquidityPoolCaller) UnbondEpochs(opts *bind.CallOpts) (uint32, error) {
	var out []interface{}
	err := _LiquidityPool.contract.Call(opts, &out, "unbondEpochs")

	if err != nil {
		return *new(uint32), err
	}

	out0 := *abi.ConvertType(out[0], new(uint32)).(*uint32)

	return out0, err

}

// UnbondEpochs is a free data retrieval call binding the contract method 0xe4c8087f.
//
// Solidity: function unbondEpochs() view returns(uint32)
func (_LiquidityPool *LiquidityPoolSession) UnbondEpochs() (uint32, error) {
	return _LiquidityPool.Contract.UnbondEpochs(&_LiquidityPool.CallOpts)
}

// UnbondEpochs is a free data retrieval call binding the contract method 0xe4c8087f.
//
// Solidity: function unbondEpochs() view returns(uint32)
func (_LiquidityPool *LiquidityPoolCallerSession) UnbondEpochs() (uint32, error) {
	return _LiquidityPool.Contract.UnbondEpochs(&_LiquidityPool.CallOpts)
}

// CloseMatchPoolDeposit is a paid mutator transaction binding the contract method 0x3f3b4909.
//
// Solidity: function closeMatchPoolDeposit(bytes32 matchId) returns()
func (_LiquidityPool *LiquidityPoolTransactor) CloseMatchPoolDeposit(opts *bind.TransactOpts, matchId [32]byte) (*types.Transaction, error) {
	return _LiquidityPool.contract.Transact(opts, "closeMatchPoolDeposit", matchId)
}

// CloseMatchPoolDeposit is a paid mutator transaction binding the contract method 0x3f3b4909.
//
// Solidity: function closeMatchPoolDeposit(bytes32 matchId) returns()
func (_LiquidityPool *LiquidityPoolSession) CloseMatchPoolDeposit(matchId [32]byte) (*types.Transaction, error) {
	return _LiquidityPool.Contract.CloseMatchPoolDeposit(&_LiquidityPool.TransactOpts, matchId)
}

// CloseMatchPoolDeposit is a paid mutator transaction binding the contract method 0x3f3b4909.
//
// Solidity: function closeMatchPoolDeposit(bytes32 matchId) returns()
func (_LiquidityPool *LiquidityPoolTransactorSession) CloseMatchPoolDeposit(matchId [32]byte) (*types.Transaction, error) {
	return _LiquidityPool.Contract.CloseMatchPoolDeposit(&_LiquidityPool.TransactOpts, matchId)
}

// DepositGlobal is a paid mutator transaction binding the contract method 0xaaa522b1.
//
// Solidity: function depositGlobal(uint256 amount, uint16 planId) returns(uint256 positionId)
func (_LiquidityPool *LiquidityPoolTransactor) DepositGlobal(opts *bind.TransactOpts, amount *big.Int, planId uint16) (*types.Transaction, error) {
	return _LiquidityPool.contract.Transact(opts, "depositGlobal", amount, planId)
}

// DepositGlobal is a paid mutator transaction binding the contract method 0xaaa522b1.
//
// Solidity: function depositGlobal(uint256 amount, uint16 planId) returns(uint256 positionId)
func (_LiquidityPool *LiquidityPoolSession) DepositGlobal(amount *big.Int, planId uint16) (*types.Transaction, error) {
	return _LiquidityPool.Contract.DepositGlobal(&_LiquidityPool.TransactOpts, amount, planId)
}

// DepositGlobal is a paid mutator transaction binding the contract method 0xaaa522b1.
//
// Solidity: function depositGlobal(uint256 amount, uint16 planId) returns(uint256 positionId)
func (_LiquidityPool *LiquidityPoolTransactorSession) DepositGlobal(amount *big.Int, planId uint16) (*types.Transaction, error) {
	return _LiquidityPool.Contract.DepositGlobal(&_LiquidityPool.TransactOpts, amount, planId)
}

// DepositMatch is a paid mutator transaction binding the contract method 0xf93c1b7c.
//
// Solidity: function depositMatch(bytes32 matchId, uint256 amount) returns(uint256 positionId)
func (_LiquidityPool *LiquidityPoolTransactor) DepositMatch(opts *bind.TransactOpts, matchId [32]byte, amount *big.Int) (*types.Transaction, error) {
	return _LiquidityPool.contract.Transact(opts, "depositMatch", matchId, amount)
}

// DepositMatch is a paid mutator transaction binding the contract method 0xf93c1b7c.
//
// Solidity: function depositMatch(bytes32 matchId, uint256 amount) returns(uint256 positionId)
func (_LiquidityPool *LiquidityPoolSession) DepositMatch(matchId [32]byte, amount *big.Int) (*types.Transaction, error) {
	return _LiquidityPool.Contract.DepositMatch(&_LiquidityPool.TransactOpts, matchId, amount)
}

// DepositMatch is a paid mutator transaction binding the contract method 0xf93c1b7c.
//
// Solidity: function depositMatch(bytes32 matchId, uint256 amount) returns(uint256 positionId)
func (_LiquidityPool *LiquidityPoolTransactorSession) DepositMatch(matchId [32]byte, amount *big.Int) (*types.Transaction, error) {
	return _LiquidityPool.Contract.DepositMatch(&_LiquidityPool.TransactOpts, matchId, amount)
}

// DistributeLoss is a paid mutator transaction binding the contract method 0x4f494ae2.
//
// Solidity: function distributeLoss(bytes32 matchId, uint256 netLoss) returns(uint256 lpLossBooked)
func (_LiquidityPool *LiquidityPoolTransactor) DistributeLoss(opts *bind.TransactOpts, matchId [32]byte, netLoss *big.Int) (*types.Transaction, error) {
	return _LiquidityPool.contract.Transact(opts, "distributeLoss", matchId, netLoss)
}

// DistributeLoss is a paid mutator transaction binding the contract method 0x4f494ae2.
//
// Solidity: function distributeLoss(bytes32 matchId, uint256 netLoss) returns(uint256 lpLossBooked)
func (_LiquidityPool *LiquidityPoolSession) DistributeLoss(matchId [32]byte, netLoss *big.Int) (*types.Transaction, error) {
	return _LiquidityPool.Contract.DistributeLoss(&_LiquidityPool.TransactOpts, matchId, netLoss)
}

// DistributeLoss is a paid mutator transaction binding the contract method 0x4f494ae2.
//
// Solidity: function distributeLoss(bytes32 matchId, uint256 netLoss) returns(uint256 lpLossBooked)
func (_LiquidityPool *LiquidityPoolTransactorSession) DistributeLoss(matchId [32]byte, netLoss *big.Int) (*types.Transaction, error) {
	return _LiquidityPool.Contract.DistributeLoss(&_LiquidityPool.TransactOpts, matchId, netLoss)
}

// DistributeMargin is a paid mutator transaction binding the contract method 0x43c8147d.
//
// Solidity: function distributeMargin(bytes32 matchId, uint256 lpMarginShare) returns()
func (_LiquidityPool *LiquidityPoolTransactor) DistributeMargin(opts *bind.TransactOpts, matchId [32]byte, lpMarginShare *big.Int) (*types.Transaction, error) {
	return _LiquidityPool.contract.Transact(opts, "distributeMargin", matchId, lpMarginShare)
}

// DistributeMargin is a paid mutator transaction binding the contract method 0x43c8147d.
//
// Solidity: function distributeMargin(bytes32 matchId, uint256 lpMarginShare) returns()
func (_LiquidityPool *LiquidityPoolSession) DistributeMargin(matchId [32]byte, lpMarginShare *big.Int) (*types.Transaction, error) {
	return _LiquidityPool.Contract.DistributeMargin(&_LiquidityPool.TransactOpts, matchId, lpMarginShare)
}

// DistributeMargin is a paid mutator transaction binding the contract method 0x43c8147d.
//
// Solidity: function distributeMargin(bytes32 matchId, uint256 lpMarginShare) returns()
func (_LiquidityPool *LiquidityPoolTransactorSession) DistributeMargin(matchId [32]byte, lpMarginShare *big.Int) (*types.Transaction, error) {
	return _LiquidityPool.Contract.DistributeMargin(&_LiquidityPool.TransactOpts, matchId, lpMarginShare)
}

// GrantRole is a paid mutator transaction binding the contract method 0x2f2ff15d.
//
// Solidity: function grantRole(bytes32 role, address account) returns()
func (_LiquidityPool *LiquidityPoolTransactor) GrantRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	return _LiquidityPool.contract.Transact(opts, "grantRole", role, account)
}

// GrantRole is a paid mutator transaction binding the contract method 0x2f2ff15d.
//
// Solidity: function grantRole(bytes32 role, address account) returns()
func (_LiquidityPool *LiquidityPoolSession) GrantRole(role [32]byte, account common.Address) (*types.Transaction, error) {
	return _LiquidityPool.Contract.GrantRole(&_LiquidityPool.TransactOpts, role, account)
}

// GrantRole is a paid mutator transaction binding the contract method 0x2f2ff15d.
//
// Solidity: function grantRole(bytes32 role, address account) returns()
func (_LiquidityPool *LiquidityPoolTransactorSession) GrantRole(role [32]byte, account common.Address) (*types.Transaction, error) {
	return _LiquidityPool.Contract.GrantRole(&_LiquidityPool.TransactOpts, role, account)
}

// Initialize is a paid mutator transaction binding the contract method 0xc0c53b8b.
//
// Solidity: function initialize(address admin, address oddTokenAddress, address initialBettingPool) returns()
func (_LiquidityPool *LiquidityPoolTransactor) Initialize(opts *bind.TransactOpts, admin common.Address, oddTokenAddress common.Address, initialBettingPool common.Address) (*types.Transaction, error) {
	return _LiquidityPool.contract.Transact(opts, "initialize", admin, oddTokenAddress, initialBettingPool)
}

// Initialize is a paid mutator transaction binding the contract method 0xc0c53b8b.
//
// Solidity: function initialize(address admin, address oddTokenAddress, address initialBettingPool) returns()
func (_LiquidityPool *LiquidityPoolSession) Initialize(admin common.Address, oddTokenAddress common.Address, initialBettingPool common.Address) (*types.Transaction, error) {
	return _LiquidityPool.Contract.Initialize(&_LiquidityPool.TransactOpts, admin, oddTokenAddress, initialBettingPool)
}

// Initialize is a paid mutator transaction binding the contract method 0xc0c53b8b.
//
// Solidity: function initialize(address admin, address oddTokenAddress, address initialBettingPool) returns()
func (_LiquidityPool *LiquidityPoolTransactorSession) Initialize(admin common.Address, oddTokenAddress common.Address, initialBettingPool common.Address) (*types.Transaction, error) {
	return _LiquidityPool.Contract.Initialize(&_LiquidityPool.TransactOpts, admin, oddTokenAddress, initialBettingPool)
}

// OpenMatchPool is a paid mutator transaction binding the contract method 0x9f21c358.
//
// Solidity: function openMatchPool(bytes32 matchId, uint64 matchStartTime, uint64 matchEndTime) returns()
func (_LiquidityPool *LiquidityPoolTransactor) OpenMatchPool(opts *bind.TransactOpts, matchId [32]byte, matchStartTime uint64, matchEndTime uint64) (*types.Transaction, error) {
	return _LiquidityPool.contract.Transact(opts, "openMatchPool", matchId, matchStartTime, matchEndTime)
}

// OpenMatchPool is a paid mutator transaction binding the contract method 0x9f21c358.
//
// Solidity: function openMatchPool(bytes32 matchId, uint64 matchStartTime, uint64 matchEndTime) returns()
func (_LiquidityPool *LiquidityPoolSession) OpenMatchPool(matchId [32]byte, matchStartTime uint64, matchEndTime uint64) (*types.Transaction, error) {
	return _LiquidityPool.Contract.OpenMatchPool(&_LiquidityPool.TransactOpts, matchId, matchStartTime, matchEndTime)
}

// OpenMatchPool is a paid mutator transaction binding the contract method 0x9f21c358.
//
// Solidity: function openMatchPool(bytes32 matchId, uint64 matchStartTime, uint64 matchEndTime) returns()
func (_LiquidityPool *LiquidityPoolTransactorSession) OpenMatchPool(matchId [32]byte, matchStartTime uint64, matchEndTime uint64) (*types.Transaction, error) {
	return _LiquidityPool.Contract.OpenMatchPool(&_LiquidityPool.TransactOpts, matchId, matchStartTime, matchEndTime)
}

// Pause is a paid mutator transaction binding the contract method 0x8456cb59.
//
// Solidity: function pause() returns()
func (_LiquidityPool *LiquidityPoolTransactor) Pause(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _LiquidityPool.contract.Transact(opts, "pause")
}

// Pause is a paid mutator transaction binding the contract method 0x8456cb59.
//
// Solidity: function pause() returns()
func (_LiquidityPool *LiquidityPoolSession) Pause() (*types.Transaction, error) {
	return _LiquidityPool.Contract.Pause(&_LiquidityPool.TransactOpts)
}

// Pause is a paid mutator transaction binding the contract method 0x8456cb59.
//
// Solidity: function pause() returns()
func (_LiquidityPool *LiquidityPoolTransactorSession) Pause() (*types.Transaction, error) {
	return _LiquidityPool.Contract.Pause(&_LiquidityPool.TransactOpts)
}

// RenounceRole is a paid mutator transaction binding the contract method 0x36568abe.
//
// Solidity: function renounceRole(bytes32 role, address callerConfirmation) returns()
func (_LiquidityPool *LiquidityPoolTransactor) RenounceRole(opts *bind.TransactOpts, role [32]byte, callerConfirmation common.Address) (*types.Transaction, error) {
	return _LiquidityPool.contract.Transact(opts, "renounceRole", role, callerConfirmation)
}

// RenounceRole is a paid mutator transaction binding the contract method 0x36568abe.
//
// Solidity: function renounceRole(bytes32 role, address callerConfirmation) returns()
func (_LiquidityPool *LiquidityPoolSession) RenounceRole(role [32]byte, callerConfirmation common.Address) (*types.Transaction, error) {
	return _LiquidityPool.Contract.RenounceRole(&_LiquidityPool.TransactOpts, role, callerConfirmation)
}

// RenounceRole is a paid mutator transaction binding the contract method 0x36568abe.
//
// Solidity: function renounceRole(bytes32 role, address callerConfirmation) returns()
func (_LiquidityPool *LiquidityPoolTransactorSession) RenounceRole(role [32]byte, callerConfirmation common.Address) (*types.Transaction, error) {
	return _LiquidityPool.Contract.RenounceRole(&_LiquidityPool.TransactOpts, role, callerConfirmation)
}

// RequestPayoutLiquidity is a paid mutator transaction binding the contract method 0x8e455923.
//
// Solidity: function requestPayoutLiquidity(bytes32 matchId, uint256 amount) returns()
func (_LiquidityPool *LiquidityPoolTransactor) RequestPayoutLiquidity(opts *bind.TransactOpts, matchId [32]byte, amount *big.Int) (*types.Transaction, error) {
	return _LiquidityPool.contract.Transact(opts, "requestPayoutLiquidity", matchId, amount)
}

// RequestPayoutLiquidity is a paid mutator transaction binding the contract method 0x8e455923.
//
// Solidity: function requestPayoutLiquidity(bytes32 matchId, uint256 amount) returns()
func (_LiquidityPool *LiquidityPoolSession) RequestPayoutLiquidity(matchId [32]byte, amount *big.Int) (*types.Transaction, error) {
	return _LiquidityPool.Contract.RequestPayoutLiquidity(&_LiquidityPool.TransactOpts, matchId, amount)
}

// RequestPayoutLiquidity is a paid mutator transaction binding the contract method 0x8e455923.
//
// Solidity: function requestPayoutLiquidity(bytes32 matchId, uint256 amount) returns()
func (_LiquidityPool *LiquidityPoolTransactorSession) RequestPayoutLiquidity(matchId [32]byte, amount *big.Int) (*types.Transaction, error) {
	return _LiquidityPool.Contract.RequestPayoutLiquidity(&_LiquidityPool.TransactOpts, matchId, amount)
}

// RequestUnbond is a paid mutator transaction binding the contract method 0x54f63b14.
//
// Solidity: function requestUnbond(uint256 positionId) returns()
func (_LiquidityPool *LiquidityPoolTransactor) RequestUnbond(opts *bind.TransactOpts, positionId *big.Int) (*types.Transaction, error) {
	return _LiquidityPool.contract.Transact(opts, "requestUnbond", positionId)
}

// RequestUnbond is a paid mutator transaction binding the contract method 0x54f63b14.
//
// Solidity: function requestUnbond(uint256 positionId) returns()
func (_LiquidityPool *LiquidityPoolSession) RequestUnbond(positionId *big.Int) (*types.Transaction, error) {
	return _LiquidityPool.Contract.RequestUnbond(&_LiquidityPool.TransactOpts, positionId)
}

// RequestUnbond is a paid mutator transaction binding the contract method 0x54f63b14.
//
// Solidity: function requestUnbond(uint256 positionId) returns()
func (_LiquidityPool *LiquidityPoolTransactorSession) RequestUnbond(positionId *big.Int) (*types.Transaction, error) {
	return _LiquidityPool.Contract.RequestUnbond(&_LiquidityPool.TransactOpts, positionId)
}

// RevokeRole is a paid mutator transaction binding the contract method 0xd547741f.
//
// Solidity: function revokeRole(bytes32 role, address account) returns()
func (_LiquidityPool *LiquidityPoolTransactor) RevokeRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	return _LiquidityPool.contract.Transact(opts, "revokeRole", role, account)
}

// RevokeRole is a paid mutator transaction binding the contract method 0xd547741f.
//
// Solidity: function revokeRole(bytes32 role, address account) returns()
func (_LiquidityPool *LiquidityPoolSession) RevokeRole(role [32]byte, account common.Address) (*types.Transaction, error) {
	return _LiquidityPool.Contract.RevokeRole(&_LiquidityPool.TransactOpts, role, account)
}

// RevokeRole is a paid mutator transaction binding the contract method 0xd547741f.
//
// Solidity: function revokeRole(bytes32 role, address account) returns()
func (_LiquidityPool *LiquidityPoolTransactorSession) RevokeRole(role [32]byte, account common.Address) (*types.Transaction, error) {
	return _LiquidityPool.Contract.RevokeRole(&_LiquidityPool.TransactOpts, role, account)
}

// SetBettingPool is a paid mutator transaction binding the contract method 0x1e421e88.
//
// Solidity: function setBettingPool(address newBettingPool) returns()
func (_LiquidityPool *LiquidityPoolTransactor) SetBettingPool(opts *bind.TransactOpts, newBettingPool common.Address) (*types.Transaction, error) {
	return _LiquidityPool.contract.Transact(opts, "setBettingPool", newBettingPool)
}

// SetBettingPool is a paid mutator transaction binding the contract method 0x1e421e88.
//
// Solidity: function setBettingPool(address newBettingPool) returns()
func (_LiquidityPool *LiquidityPoolSession) SetBettingPool(newBettingPool common.Address) (*types.Transaction, error) {
	return _LiquidityPool.Contract.SetBettingPool(&_LiquidityPool.TransactOpts, newBettingPool)
}

// SetBettingPool is a paid mutator transaction binding the contract method 0x1e421e88.
//
// Solidity: function setBettingPool(address newBettingPool) returns()
func (_LiquidityPool *LiquidityPoolTransactorSession) SetBettingPool(newBettingPool common.Address) (*types.Transaction, error) {
	return _LiquidityPool.Contract.SetBettingPool(&_LiquidityPool.TransactOpts, newBettingPool)
}

// SetMinDeposit is a paid mutator transaction binding the contract method 0x8fcc9cfb.
//
// Solidity: function setMinDeposit(uint256 newMinDeposit) returns()
func (_LiquidityPool *LiquidityPoolTransactor) SetMinDeposit(opts *bind.TransactOpts, newMinDeposit *big.Int) (*types.Transaction, error) {
	return _LiquidityPool.contract.Transact(opts, "setMinDeposit", newMinDeposit)
}

// SetMinDeposit is a paid mutator transaction binding the contract method 0x8fcc9cfb.
//
// Solidity: function setMinDeposit(uint256 newMinDeposit) returns()
func (_LiquidityPool *LiquidityPoolSession) SetMinDeposit(newMinDeposit *big.Int) (*types.Transaction, error) {
	return _LiquidityPool.Contract.SetMinDeposit(&_LiquidityPool.TransactOpts, newMinDeposit)
}

// SetMinDeposit is a paid mutator transaction binding the contract method 0x8fcc9cfb.
//
// Solidity: function setMinDeposit(uint256 newMinDeposit) returns()
func (_LiquidityPool *LiquidityPoolTransactorSession) SetMinDeposit(newMinDeposit *big.Int) (*types.Transaction, error) {
	return _LiquidityPool.Contract.SetMinDeposit(&_LiquidityPool.TransactOpts, newMinDeposit)
}

// SetUnbondEpochs is a paid mutator transaction binding the contract method 0xba5f43ba.
//
// Solidity: function setUnbondEpochs(uint32 newUnbondEpochs) returns()
func (_LiquidityPool *LiquidityPoolTransactor) SetUnbondEpochs(opts *bind.TransactOpts, newUnbondEpochs uint32) (*types.Transaction, error) {
	return _LiquidityPool.contract.Transact(opts, "setUnbondEpochs", newUnbondEpochs)
}

// SetUnbondEpochs is a paid mutator transaction binding the contract method 0xba5f43ba.
//
// Solidity: function setUnbondEpochs(uint32 newUnbondEpochs) returns()
func (_LiquidityPool *LiquidityPoolSession) SetUnbondEpochs(newUnbondEpochs uint32) (*types.Transaction, error) {
	return _LiquidityPool.Contract.SetUnbondEpochs(&_LiquidityPool.TransactOpts, newUnbondEpochs)
}

// SetUnbondEpochs is a paid mutator transaction binding the contract method 0xba5f43ba.
//
// Solidity: function setUnbondEpochs(uint32 newUnbondEpochs) returns()
func (_LiquidityPool *LiquidityPoolTransactorSession) SetUnbondEpochs(newUnbondEpochs uint32) (*types.Transaction, error) {
	return _LiquidityPool.Contract.SetUnbondEpochs(&_LiquidityPool.TransactOpts, newUnbondEpochs)
}

// Unpause is a paid mutator transaction binding the contract method 0x3f4ba83a.
//
// Solidity: function unpause() returns()
func (_LiquidityPool *LiquidityPoolTransactor) Unpause(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _LiquidityPool.contract.Transact(opts, "unpause")
}

// Unpause is a paid mutator transaction binding the contract method 0x3f4ba83a.
//
// Solidity: function unpause() returns()
func (_LiquidityPool *LiquidityPoolSession) Unpause() (*types.Transaction, error) {
	return _LiquidityPool.Contract.Unpause(&_LiquidityPool.TransactOpts)
}

// Unpause is a paid mutator transaction binding the contract method 0x3f4ba83a.
//
// Solidity: function unpause() returns()
func (_LiquidityPool *LiquidityPoolTransactorSession) Unpause() (*types.Transaction, error) {
	return _LiquidityPool.Contract.Unpause(&_LiquidityPool.TransactOpts)
}

// UpgradeToAndCall is a paid mutator transaction binding the contract method 0x4f1ef286.
//
// Solidity: function upgradeToAndCall(address newImplementation, bytes data) payable returns()
func (_LiquidityPool *LiquidityPoolTransactor) UpgradeToAndCall(opts *bind.TransactOpts, newImplementation common.Address, data []byte) (*types.Transaction, error) {
	return _LiquidityPool.contract.Transact(opts, "upgradeToAndCall", newImplementation, data)
}

// UpgradeToAndCall is a paid mutator transaction binding the contract method 0x4f1ef286.
//
// Solidity: function upgradeToAndCall(address newImplementation, bytes data) payable returns()
func (_LiquidityPool *LiquidityPoolSession) UpgradeToAndCall(newImplementation common.Address, data []byte) (*types.Transaction, error) {
	return _LiquidityPool.Contract.UpgradeToAndCall(&_LiquidityPool.TransactOpts, newImplementation, data)
}

// UpgradeToAndCall is a paid mutator transaction binding the contract method 0x4f1ef286.
//
// Solidity: function upgradeToAndCall(address newImplementation, bytes data) payable returns()
func (_LiquidityPool *LiquidityPoolTransactorSession) UpgradeToAndCall(newImplementation common.Address, data []byte) (*types.Transaction, error) {
	return _LiquidityPool.Contract.UpgradeToAndCall(&_LiquidityPool.TransactOpts, newImplementation, data)
}

// Withdraw is a paid mutator transaction binding the contract method 0x2e1a7d4d.
//
// Solidity: function withdraw(uint256 positionId) returns()
func (_LiquidityPool *LiquidityPoolTransactor) Withdraw(opts *bind.TransactOpts, positionId *big.Int) (*types.Transaction, error) {
	return _LiquidityPool.contract.Transact(opts, "withdraw", positionId)
}

// Withdraw is a paid mutator transaction binding the contract method 0x2e1a7d4d.
//
// Solidity: function withdraw(uint256 positionId) returns()
func (_LiquidityPool *LiquidityPoolSession) Withdraw(positionId *big.Int) (*types.Transaction, error) {
	return _LiquidityPool.Contract.Withdraw(&_LiquidityPool.TransactOpts, positionId)
}

// Withdraw is a paid mutator transaction binding the contract method 0x2e1a7d4d.
//
// Solidity: function withdraw(uint256 positionId) returns()
func (_LiquidityPool *LiquidityPoolTransactorSession) Withdraw(positionId *big.Int) (*types.Transaction, error) {
	return _LiquidityPool.Contract.Withdraw(&_LiquidityPool.TransactOpts, positionId)
}

// LiquidityPoolInitializedIterator is returned from FilterInitialized and is used to iterate over the raw logs and unpacked data for Initialized events raised by the LiquidityPool contract.
type LiquidityPoolInitializedIterator struct {
	Event *LiquidityPoolInitialized // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *LiquidityPoolInitializedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(LiquidityPoolInitialized)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(LiquidityPoolInitialized)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *LiquidityPoolInitializedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *LiquidityPoolInitializedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// LiquidityPoolInitialized represents a Initialized event raised by the LiquidityPool contract.
type LiquidityPoolInitialized struct {
	Version uint64
	Raw     types.Log // Blockchain specific contextual infos
}

// FilterInitialized is a free log retrieval operation binding the contract event 0xc7f505b2f371ae2175ee4913f4499e1f2633a7b5936321eed1cdaeb6115181d2.
//
// Solidity: event Initialized(uint64 version)
func (_LiquidityPool *LiquidityPoolFilterer) FilterInitialized(opts *bind.FilterOpts) (*LiquidityPoolInitializedIterator, error) {

	logs, sub, err := _LiquidityPool.contract.FilterLogs(opts, "Initialized")
	if err != nil {
		return nil, err
	}
	return &LiquidityPoolInitializedIterator{contract: _LiquidityPool.contract, event: "Initialized", logs: logs, sub: sub}, nil
}

// WatchInitialized is a free log subscription operation binding the contract event 0xc7f505b2f371ae2175ee4913f4499e1f2633a7b5936321eed1cdaeb6115181d2.
//
// Solidity: event Initialized(uint64 version)
func (_LiquidityPool *LiquidityPoolFilterer) WatchInitialized(opts *bind.WatchOpts, sink chan<- *LiquidityPoolInitialized) (event.Subscription, error) {

	logs, sub, err := _LiquidityPool.contract.WatchLogs(opts, "Initialized")
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(LiquidityPoolInitialized)
				if err := _LiquidityPool.contract.UnpackLog(event, "Initialized", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseInitialized is a log parse operation binding the contract event 0xc7f505b2f371ae2175ee4913f4499e1f2633a7b5936321eed1cdaeb6115181d2.
//
// Solidity: event Initialized(uint64 version)
func (_LiquidityPool *LiquidityPoolFilterer) ParseInitialized(log types.Log) (*LiquidityPoolInitialized, error) {
	event := new(LiquidityPoolInitialized)
	if err := _LiquidityPool.contract.UnpackLog(event, "Initialized", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// LiquidityPoolLiquidityAccountingSnapshotIterator is returned from FilterLiquidityAccountingSnapshot and is used to iterate over the raw logs and unpacked data for LiquidityAccountingSnapshot events raised by the LiquidityPool contract.
type LiquidityPoolLiquidityAccountingSnapshotIterator struct {
	Event *LiquidityPoolLiquidityAccountingSnapshot // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *LiquidityPoolLiquidityAccountingSnapshotIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(LiquidityPoolLiquidityAccountingSnapshot)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(LiquidityPoolLiquidityAccountingSnapshot)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *LiquidityPoolLiquidityAccountingSnapshotIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *LiquidityPoolLiquidityAccountingSnapshotIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// LiquidityPoolLiquidityAccountingSnapshot represents a LiquidityAccountingSnapshot event raised by the LiquidityPool contract.
type LiquidityPoolLiquidityAccountingSnapshot struct {
	MatchId                             [32]byte
	PoolId                              *big.Int
	PositionId                          *big.Int
	ActionKind                          uint8
	RequestableLiquidityAfter           *big.Int
	TotalActiveDepositedAfter           *big.Int
	TotalOutstandingPayoutReservedAfter *big.Int
	PoolTotalDepositedAfter             *big.Int
	PoolTotalWeightAfter                *big.Int
	Raw                                 types.Log // Blockchain specific contextual infos
}

// FilterLiquidityAccountingSnapshot is a free log retrieval operation binding the contract event 0xc7ab518d00c6af3af3e856d57fc20bac01cef342d6cfce0ed2c60544554fbe7c.
//
// Solidity: event LiquidityAccountingSnapshot(bytes32 indexed matchId, uint256 indexed poolId, uint256 indexed positionId, uint8 actionKind, uint256 requestableLiquidityAfter, uint256 totalActiveDepositedAfter, uint256 totalOutstandingPayoutReservedAfter, uint256 poolTotalDepositedAfter, uint256 poolTotalWeightAfter)
func (_LiquidityPool *LiquidityPoolFilterer) FilterLiquidityAccountingSnapshot(opts *bind.FilterOpts, matchId [][32]byte, poolId []*big.Int, positionId []*big.Int) (*LiquidityPoolLiquidityAccountingSnapshotIterator, error) {

	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}
	var poolIdRule []interface{}
	for _, poolIdItem := range poolId {
		poolIdRule = append(poolIdRule, poolIdItem)
	}
	var positionIdRule []interface{}
	for _, positionIdItem := range positionId {
		positionIdRule = append(positionIdRule, positionIdItem)
	}

	logs, sub, err := _LiquidityPool.contract.FilterLogs(opts, "LiquidityAccountingSnapshot", matchIdRule, poolIdRule, positionIdRule)
	if err != nil {
		return nil, err
	}
	return &LiquidityPoolLiquidityAccountingSnapshotIterator{contract: _LiquidityPool.contract, event: "LiquidityAccountingSnapshot", logs: logs, sub: sub}, nil
}

// WatchLiquidityAccountingSnapshot is a free log subscription operation binding the contract event 0xc7ab518d00c6af3af3e856d57fc20bac01cef342d6cfce0ed2c60544554fbe7c.
//
// Solidity: event LiquidityAccountingSnapshot(bytes32 indexed matchId, uint256 indexed poolId, uint256 indexed positionId, uint8 actionKind, uint256 requestableLiquidityAfter, uint256 totalActiveDepositedAfter, uint256 totalOutstandingPayoutReservedAfter, uint256 poolTotalDepositedAfter, uint256 poolTotalWeightAfter)
func (_LiquidityPool *LiquidityPoolFilterer) WatchLiquidityAccountingSnapshot(opts *bind.WatchOpts, sink chan<- *LiquidityPoolLiquidityAccountingSnapshot, matchId [][32]byte, poolId []*big.Int, positionId []*big.Int) (event.Subscription, error) {

	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}
	var poolIdRule []interface{}
	for _, poolIdItem := range poolId {
		poolIdRule = append(poolIdRule, poolIdItem)
	}
	var positionIdRule []interface{}
	for _, positionIdItem := range positionId {
		positionIdRule = append(positionIdRule, positionIdItem)
	}

	logs, sub, err := _LiquidityPool.contract.WatchLogs(opts, "LiquidityAccountingSnapshot", matchIdRule, poolIdRule, positionIdRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(LiquidityPoolLiquidityAccountingSnapshot)
				if err := _LiquidityPool.contract.UnpackLog(event, "LiquidityAccountingSnapshot", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseLiquidityAccountingSnapshot is a log parse operation binding the contract event 0xc7ab518d00c6af3af3e856d57fc20bac01cef342d6cfce0ed2c60544554fbe7c.
//
// Solidity: event LiquidityAccountingSnapshot(bytes32 indexed matchId, uint256 indexed poolId, uint256 indexed positionId, uint8 actionKind, uint256 requestableLiquidityAfter, uint256 totalActiveDepositedAfter, uint256 totalOutstandingPayoutReservedAfter, uint256 poolTotalDepositedAfter, uint256 poolTotalWeightAfter)
func (_LiquidityPool *LiquidityPoolFilterer) ParseLiquidityAccountingSnapshot(log types.Log) (*LiquidityPoolLiquidityAccountingSnapshot, error) {
	event := new(LiquidityPoolLiquidityAccountingSnapshot)
	if err := _LiquidityPool.contract.UnpackLog(event, "LiquidityAccountingSnapshot", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// LiquidityPoolLiquidityConfigUpdatedIterator is returned from FilterLiquidityConfigUpdated and is used to iterate over the raw logs and unpacked data for LiquidityConfigUpdated events raised by the LiquidityPool contract.
type LiquidityPoolLiquidityConfigUpdatedIterator struct {
	Event *LiquidityPoolLiquidityConfigUpdated // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *LiquidityPoolLiquidityConfigUpdatedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(LiquidityPoolLiquidityConfigUpdated)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(LiquidityPoolLiquidityConfigUpdated)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *LiquidityPoolLiquidityConfigUpdatedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *LiquidityPoolLiquidityConfigUpdatedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// LiquidityPoolLiquidityConfigUpdated represents a LiquidityConfigUpdated event raised by the LiquidityPool contract.
type LiquidityPoolLiquidityConfigUpdated struct {
	Operator       common.Address
	NewBettingPool common.Address
	Raw            types.Log // Blockchain specific contextual infos
}

// FilterLiquidityConfigUpdated is a free log retrieval operation binding the contract event 0x21fbc3f8d06b6296e49e3e9d3e6f571ade7a1f60c20c7f91eff0ee52489bb234.
//
// Solidity: event LiquidityConfigUpdated(address indexed operator, address indexed newBettingPool)
func (_LiquidityPool *LiquidityPoolFilterer) FilterLiquidityConfigUpdated(opts *bind.FilterOpts, operator []common.Address, newBettingPool []common.Address) (*LiquidityPoolLiquidityConfigUpdatedIterator, error) {

	var operatorRule []interface{}
	for _, operatorItem := range operator {
		operatorRule = append(operatorRule, operatorItem)
	}
	var newBettingPoolRule []interface{}
	for _, newBettingPoolItem := range newBettingPool {
		newBettingPoolRule = append(newBettingPoolRule, newBettingPoolItem)
	}

	logs, sub, err := _LiquidityPool.contract.FilterLogs(opts, "LiquidityConfigUpdated", operatorRule, newBettingPoolRule)
	if err != nil {
		return nil, err
	}
	return &LiquidityPoolLiquidityConfigUpdatedIterator{contract: _LiquidityPool.contract, event: "LiquidityConfigUpdated", logs: logs, sub: sub}, nil
}

// WatchLiquidityConfigUpdated is a free log subscription operation binding the contract event 0x21fbc3f8d06b6296e49e3e9d3e6f571ade7a1f60c20c7f91eff0ee52489bb234.
//
// Solidity: event LiquidityConfigUpdated(address indexed operator, address indexed newBettingPool)
func (_LiquidityPool *LiquidityPoolFilterer) WatchLiquidityConfigUpdated(opts *bind.WatchOpts, sink chan<- *LiquidityPoolLiquidityConfigUpdated, operator []common.Address, newBettingPool []common.Address) (event.Subscription, error) {

	var operatorRule []interface{}
	for _, operatorItem := range operator {
		operatorRule = append(operatorRule, operatorItem)
	}
	var newBettingPoolRule []interface{}
	for _, newBettingPoolItem := range newBettingPool {
		newBettingPoolRule = append(newBettingPoolRule, newBettingPoolItem)
	}

	logs, sub, err := _LiquidityPool.contract.WatchLogs(opts, "LiquidityConfigUpdated", operatorRule, newBettingPoolRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(LiquidityPoolLiquidityConfigUpdated)
				if err := _LiquidityPool.contract.UnpackLog(event, "LiquidityConfigUpdated", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseLiquidityConfigUpdated is a log parse operation binding the contract event 0x21fbc3f8d06b6296e49e3e9d3e6f571ade7a1f60c20c7f91eff0ee52489bb234.
//
// Solidity: event LiquidityConfigUpdated(address indexed operator, address indexed newBettingPool)
func (_LiquidityPool *LiquidityPoolFilterer) ParseLiquidityConfigUpdated(log types.Log) (*LiquidityPoolLiquidityConfigUpdated, error) {
	event := new(LiquidityPoolLiquidityConfigUpdated)
	if err := _LiquidityPool.contract.UnpackLog(event, "LiquidityConfigUpdated", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// LiquidityPoolLiquidityDepositedIterator is returned from FilterLiquidityDeposited and is used to iterate over the raw logs and unpacked data for LiquidityDeposited events raised by the LiquidityPool contract.
type LiquidityPoolLiquidityDepositedIterator struct {
	Event *LiquidityPoolLiquidityDeposited // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *LiquidityPoolLiquidityDepositedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(LiquidityPoolLiquidityDeposited)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(LiquidityPoolLiquidityDeposited)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *LiquidityPoolLiquidityDepositedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *LiquidityPoolLiquidityDepositedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// LiquidityPoolLiquidityDeposited represents a LiquidityDeposited event raised by the LiquidityPool contract.
type LiquidityPoolLiquidityDeposited struct {
	PositionId *big.Int
	PoolId     *big.Int
	User       common.Address
	Amount     *big.Int
	Weight     *big.Int
	PlanId     uint16
	UnlockAt   uint64
	Raw        types.Log // Blockchain specific contextual infos
}

// FilterLiquidityDeposited is a free log retrieval operation binding the contract event 0x3bd30ae93e34eaa62d6d2d640fe75168413b5c8d3545562a1fad3c1704e924aa.
//
// Solidity: event LiquidityDeposited(uint256 indexed positionId, uint256 indexed poolId, address indexed user, uint256 amount, uint256 weight, uint16 planId, uint64 unlockAt)
func (_LiquidityPool *LiquidityPoolFilterer) FilterLiquidityDeposited(opts *bind.FilterOpts, positionId []*big.Int, poolId []*big.Int, user []common.Address) (*LiquidityPoolLiquidityDepositedIterator, error) {

	var positionIdRule []interface{}
	for _, positionIdItem := range positionId {
		positionIdRule = append(positionIdRule, positionIdItem)
	}
	var poolIdRule []interface{}
	for _, poolIdItem := range poolId {
		poolIdRule = append(poolIdRule, poolIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _LiquidityPool.contract.FilterLogs(opts, "LiquidityDeposited", positionIdRule, poolIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return &LiquidityPoolLiquidityDepositedIterator{contract: _LiquidityPool.contract, event: "LiquidityDeposited", logs: logs, sub: sub}, nil
}

// WatchLiquidityDeposited is a free log subscription operation binding the contract event 0x3bd30ae93e34eaa62d6d2d640fe75168413b5c8d3545562a1fad3c1704e924aa.
//
// Solidity: event LiquidityDeposited(uint256 indexed positionId, uint256 indexed poolId, address indexed user, uint256 amount, uint256 weight, uint16 planId, uint64 unlockAt)
func (_LiquidityPool *LiquidityPoolFilterer) WatchLiquidityDeposited(opts *bind.WatchOpts, sink chan<- *LiquidityPoolLiquidityDeposited, positionId []*big.Int, poolId []*big.Int, user []common.Address) (event.Subscription, error) {

	var positionIdRule []interface{}
	for _, positionIdItem := range positionId {
		positionIdRule = append(positionIdRule, positionIdItem)
	}
	var poolIdRule []interface{}
	for _, poolIdItem := range poolId {
		poolIdRule = append(poolIdRule, poolIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _LiquidityPool.contract.WatchLogs(opts, "LiquidityDeposited", positionIdRule, poolIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(LiquidityPoolLiquidityDeposited)
				if err := _LiquidityPool.contract.UnpackLog(event, "LiquidityDeposited", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseLiquidityDeposited is a log parse operation binding the contract event 0x3bd30ae93e34eaa62d6d2d640fe75168413b5c8d3545562a1fad3c1704e924aa.
//
// Solidity: event LiquidityDeposited(uint256 indexed positionId, uint256 indexed poolId, address indexed user, uint256 amount, uint256 weight, uint16 planId, uint64 unlockAt)
func (_LiquidityPool *LiquidityPoolFilterer) ParseLiquidityDeposited(log types.Log) (*LiquidityPoolLiquidityDeposited, error) {
	event := new(LiquidityPoolLiquidityDeposited)
	if err := _LiquidityPool.contract.UnpackLog(event, "LiquidityDeposited", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// LiquidityPoolLiquidityPositionStateChangedIterator is returned from FilterLiquidityPositionStateChanged and is used to iterate over the raw logs and unpacked data for LiquidityPositionStateChanged events raised by the LiquidityPool contract.
type LiquidityPoolLiquidityPositionStateChangedIterator struct {
	Event *LiquidityPoolLiquidityPositionStateChanged // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *LiquidityPoolLiquidityPositionStateChangedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(LiquidityPoolLiquidityPositionStateChanged)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(LiquidityPoolLiquidityPositionStateChanged)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *LiquidityPoolLiquidityPositionStateChangedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *LiquidityPoolLiquidityPositionStateChangedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// LiquidityPoolLiquidityPositionStateChanged represents a LiquidityPositionStateChanged event raised by the LiquidityPool contract.
type LiquidityPoolLiquidityPositionStateChanged struct {
	PositionId    *big.Int
	User          common.Address
	PreviousState uint8
	NewState      uint8
	Principal     *big.Int
	Weight        *big.Int
	Raw           types.Log // Blockchain specific contextual infos
}

// FilterLiquidityPositionStateChanged is a free log retrieval operation binding the contract event 0xc22287c1b29b4be1ef10af7a527b51bf6d6ec647d9b1ea0ac736fa97689a80ff.
//
// Solidity: event LiquidityPositionStateChanged(uint256 indexed positionId, address indexed user, uint8 previousState, uint8 newState, uint256 principal, uint256 weight)
func (_LiquidityPool *LiquidityPoolFilterer) FilterLiquidityPositionStateChanged(opts *bind.FilterOpts, positionId []*big.Int, user []common.Address) (*LiquidityPoolLiquidityPositionStateChangedIterator, error) {

	var positionIdRule []interface{}
	for _, positionIdItem := range positionId {
		positionIdRule = append(positionIdRule, positionIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _LiquidityPool.contract.FilterLogs(opts, "LiquidityPositionStateChanged", positionIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return &LiquidityPoolLiquidityPositionStateChangedIterator{contract: _LiquidityPool.contract, event: "LiquidityPositionStateChanged", logs: logs, sub: sub}, nil
}

// WatchLiquidityPositionStateChanged is a free log subscription operation binding the contract event 0xc22287c1b29b4be1ef10af7a527b51bf6d6ec647d9b1ea0ac736fa97689a80ff.
//
// Solidity: event LiquidityPositionStateChanged(uint256 indexed positionId, address indexed user, uint8 previousState, uint8 newState, uint256 principal, uint256 weight)
func (_LiquidityPool *LiquidityPoolFilterer) WatchLiquidityPositionStateChanged(opts *bind.WatchOpts, sink chan<- *LiquidityPoolLiquidityPositionStateChanged, positionId []*big.Int, user []common.Address) (event.Subscription, error) {

	var positionIdRule []interface{}
	for _, positionIdItem := range positionId {
		positionIdRule = append(positionIdRule, positionIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _LiquidityPool.contract.WatchLogs(opts, "LiquidityPositionStateChanged", positionIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(LiquidityPoolLiquidityPositionStateChanged)
				if err := _LiquidityPool.contract.UnpackLog(event, "LiquidityPositionStateChanged", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseLiquidityPositionStateChanged is a log parse operation binding the contract event 0xc22287c1b29b4be1ef10af7a527b51bf6d6ec647d9b1ea0ac736fa97689a80ff.
//
// Solidity: event LiquidityPositionStateChanged(uint256 indexed positionId, address indexed user, uint8 previousState, uint8 newState, uint256 principal, uint256 weight)
func (_LiquidityPool *LiquidityPoolFilterer) ParseLiquidityPositionStateChanged(log types.Log) (*LiquidityPoolLiquidityPositionStateChanged, error) {
	event := new(LiquidityPoolLiquidityPositionStateChanged)
	if err := _LiquidityPool.contract.UnpackLog(event, "LiquidityPositionStateChanged", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// LiquidityPoolLiquidityWithdrawnIterator is returned from FilterLiquidityWithdrawn and is used to iterate over the raw logs and unpacked data for LiquidityWithdrawn events raised by the LiquidityPool contract.
type LiquidityPoolLiquidityWithdrawnIterator struct {
	Event *LiquidityPoolLiquidityWithdrawn // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *LiquidityPoolLiquidityWithdrawnIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(LiquidityPoolLiquidityWithdrawn)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(LiquidityPoolLiquidityWithdrawn)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *LiquidityPoolLiquidityWithdrawnIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *LiquidityPoolLiquidityWithdrawnIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// LiquidityPoolLiquidityWithdrawn represents a LiquidityWithdrawn event raised by the LiquidityPool contract.
type LiquidityPoolLiquidityWithdrawn struct {
	PositionId     *big.Int
	User           common.Address
	WithdrawAmount *big.Int
	FinalState     uint8
	NetPnl         *big.Int
	Raw            types.Log // Blockchain specific contextual infos
}

// FilterLiquidityWithdrawn is a free log retrieval operation binding the contract event 0x26abf253d9ea63c635a808e28588c4486d9f5e998d2c2a3ea742b30a0434e71d.
//
// Solidity: event LiquidityWithdrawn(uint256 indexed positionId, address indexed user, uint256 withdrawAmount, uint8 finalState, int256 netPnl)
func (_LiquidityPool *LiquidityPoolFilterer) FilterLiquidityWithdrawn(opts *bind.FilterOpts, positionId []*big.Int, user []common.Address) (*LiquidityPoolLiquidityWithdrawnIterator, error) {

	var positionIdRule []interface{}
	for _, positionIdItem := range positionId {
		positionIdRule = append(positionIdRule, positionIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _LiquidityPool.contract.FilterLogs(opts, "LiquidityWithdrawn", positionIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return &LiquidityPoolLiquidityWithdrawnIterator{contract: _LiquidityPool.contract, event: "LiquidityWithdrawn", logs: logs, sub: sub}, nil
}

// WatchLiquidityWithdrawn is a free log subscription operation binding the contract event 0x26abf253d9ea63c635a808e28588c4486d9f5e998d2c2a3ea742b30a0434e71d.
//
// Solidity: event LiquidityWithdrawn(uint256 indexed positionId, address indexed user, uint256 withdrawAmount, uint8 finalState, int256 netPnl)
func (_LiquidityPool *LiquidityPoolFilterer) WatchLiquidityWithdrawn(opts *bind.WatchOpts, sink chan<- *LiquidityPoolLiquidityWithdrawn, positionId []*big.Int, user []common.Address) (event.Subscription, error) {

	var positionIdRule []interface{}
	for _, positionIdItem := range positionId {
		positionIdRule = append(positionIdRule, positionIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _LiquidityPool.contract.WatchLogs(opts, "LiquidityWithdrawn", positionIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(LiquidityPoolLiquidityWithdrawn)
				if err := _LiquidityPool.contract.UnpackLog(event, "LiquidityWithdrawn", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseLiquidityWithdrawn is a log parse operation binding the contract event 0x26abf253d9ea63c635a808e28588c4486d9f5e998d2c2a3ea742b30a0434e71d.
//
// Solidity: event LiquidityWithdrawn(uint256 indexed positionId, address indexed user, uint256 withdrawAmount, uint8 finalState, int256 netPnl)
func (_LiquidityPool *LiquidityPoolFilterer) ParseLiquidityWithdrawn(log types.Log) (*LiquidityPoolLiquidityWithdrawn, error) {
	event := new(LiquidityPoolLiquidityWithdrawn)
	if err := _LiquidityPool.contract.UnpackLog(event, "LiquidityWithdrawn", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// LiquidityPoolLossDistributedIterator is returned from FilterLossDistributed and is used to iterate over the raw logs and unpacked data for LossDistributed events raised by the LiquidityPool contract.
type LiquidityPoolLossDistributedIterator struct {
	Event *LiquidityPoolLossDistributed // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *LiquidityPoolLossDistributedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(LiquidityPoolLossDistributed)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(LiquidityPoolLossDistributed)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *LiquidityPoolLossDistributedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *LiquidityPoolLossDistributedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// LiquidityPoolLossDistributed represents a LossDistributed event raised by the LiquidityPool contract.
type LiquidityPoolLossDistributed struct {
	MatchId         [32]byte
	LpLossBooked    *big.Int
	GlobalLossShare *big.Int
	MatchLossShare  *big.Int
	Raw             types.Log // Blockchain specific contextual infos
}

// FilterLossDistributed is a free log retrieval operation binding the contract event 0xb25320833201e32b5c6c9a98a8b02ca39b0f4b933f8504d5a5b260ed116f567a.
//
// Solidity: event LossDistributed(bytes32 indexed matchId, uint256 lpLossBooked, uint256 globalLossShare, uint256 matchLossShare)
func (_LiquidityPool *LiquidityPoolFilterer) FilterLossDistributed(opts *bind.FilterOpts, matchId [][32]byte) (*LiquidityPoolLossDistributedIterator, error) {

	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}

	logs, sub, err := _LiquidityPool.contract.FilterLogs(opts, "LossDistributed", matchIdRule)
	if err != nil {
		return nil, err
	}
	return &LiquidityPoolLossDistributedIterator{contract: _LiquidityPool.contract, event: "LossDistributed", logs: logs, sub: sub}, nil
}

// WatchLossDistributed is a free log subscription operation binding the contract event 0xb25320833201e32b5c6c9a98a8b02ca39b0f4b933f8504d5a5b260ed116f567a.
//
// Solidity: event LossDistributed(bytes32 indexed matchId, uint256 lpLossBooked, uint256 globalLossShare, uint256 matchLossShare)
func (_LiquidityPool *LiquidityPoolFilterer) WatchLossDistributed(opts *bind.WatchOpts, sink chan<- *LiquidityPoolLossDistributed, matchId [][32]byte) (event.Subscription, error) {

	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}

	logs, sub, err := _LiquidityPool.contract.WatchLogs(opts, "LossDistributed", matchIdRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(LiquidityPoolLossDistributed)
				if err := _LiquidityPool.contract.UnpackLog(event, "LossDistributed", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseLossDistributed is a log parse operation binding the contract event 0xb25320833201e32b5c6c9a98a8b02ca39b0f4b933f8504d5a5b260ed116f567a.
//
// Solidity: event LossDistributed(bytes32 indexed matchId, uint256 lpLossBooked, uint256 globalLossShare, uint256 matchLossShare)
func (_LiquidityPool *LiquidityPoolFilterer) ParseLossDistributed(log types.Log) (*LiquidityPoolLossDistributed, error) {
	event := new(LiquidityPoolLossDistributed)
	if err := _LiquidityPool.contract.UnpackLog(event, "LossDistributed", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// LiquidityPoolMarginDistributedIterator is returned from FilterMarginDistributed and is used to iterate over the raw logs and unpacked data for MarginDistributed events raised by the LiquidityPool contract.
type LiquidityPoolMarginDistributedIterator struct {
	Event *LiquidityPoolMarginDistributed // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *LiquidityPoolMarginDistributedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(LiquidityPoolMarginDistributed)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(LiquidityPoolMarginDistributed)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *LiquidityPoolMarginDistributedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *LiquidityPoolMarginDistributedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// LiquidityPoolMarginDistributed represents a MarginDistributed event raised by the LiquidityPool contract.
type LiquidityPoolMarginDistributed struct {
	MatchId       [32]byte
	LpMarginShare *big.Int
	GlobalShare   *big.Int
	MatchShare    *big.Int
	Raw           types.Log // Blockchain specific contextual infos
}

// FilterMarginDistributed is a free log retrieval operation binding the contract event 0x8eb0d54a4c4bbfe6a0f431b3babd2b1ead8813381dd1b2fd4d80931da7508738.
//
// Solidity: event MarginDistributed(bytes32 indexed matchId, uint256 lpMarginShare, uint256 globalShare, uint256 matchShare)
func (_LiquidityPool *LiquidityPoolFilterer) FilterMarginDistributed(opts *bind.FilterOpts, matchId [][32]byte) (*LiquidityPoolMarginDistributedIterator, error) {

	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}

	logs, sub, err := _LiquidityPool.contract.FilterLogs(opts, "MarginDistributed", matchIdRule)
	if err != nil {
		return nil, err
	}
	return &LiquidityPoolMarginDistributedIterator{contract: _LiquidityPool.contract, event: "MarginDistributed", logs: logs, sub: sub}, nil
}

// WatchMarginDistributed is a free log subscription operation binding the contract event 0x8eb0d54a4c4bbfe6a0f431b3babd2b1ead8813381dd1b2fd4d80931da7508738.
//
// Solidity: event MarginDistributed(bytes32 indexed matchId, uint256 lpMarginShare, uint256 globalShare, uint256 matchShare)
func (_LiquidityPool *LiquidityPoolFilterer) WatchMarginDistributed(opts *bind.WatchOpts, sink chan<- *LiquidityPoolMarginDistributed, matchId [][32]byte) (event.Subscription, error) {

	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}

	logs, sub, err := _LiquidityPool.contract.WatchLogs(opts, "MarginDistributed", matchIdRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(LiquidityPoolMarginDistributed)
				if err := _LiquidityPool.contract.UnpackLog(event, "MarginDistributed", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseMarginDistributed is a log parse operation binding the contract event 0x8eb0d54a4c4bbfe6a0f431b3babd2b1ead8813381dd1b2fd4d80931da7508738.
//
// Solidity: event MarginDistributed(bytes32 indexed matchId, uint256 lpMarginShare, uint256 globalShare, uint256 matchShare)
func (_LiquidityPool *LiquidityPoolFilterer) ParseMarginDistributed(log types.Log) (*LiquidityPoolMarginDistributed, error) {
	event := new(LiquidityPoolMarginDistributed)
	if err := _LiquidityPool.contract.UnpackLog(event, "MarginDistributed", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// LiquidityPoolMatchPoolDepositClosedIterator is returned from FilterMatchPoolDepositClosed and is used to iterate over the raw logs and unpacked data for MatchPoolDepositClosed events raised by the LiquidityPool contract.
type LiquidityPoolMatchPoolDepositClosedIterator struct {
	Event *LiquidityPoolMatchPoolDepositClosed // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *LiquidityPoolMatchPoolDepositClosedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(LiquidityPoolMatchPoolDepositClosed)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(LiquidityPoolMatchPoolDepositClosed)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *LiquidityPoolMatchPoolDepositClosedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *LiquidityPoolMatchPoolDepositClosedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// LiquidityPoolMatchPoolDepositClosed represents a MatchPoolDepositClosed event raised by the LiquidityPool contract.
type LiquidityPoolMatchPoolDepositClosed struct {
	MatchId [32]byte
	PoolId  *big.Int
	Reason  uint8
	Raw     types.Log // Blockchain specific contextual infos
}

// FilterMatchPoolDepositClosed is a free log retrieval operation binding the contract event 0x48512c7d2f8726dfbf82111a83eb728cdb7f8f13b6f507c69913342f239e0890.
//
// Solidity: event MatchPoolDepositClosed(bytes32 indexed matchId, uint256 indexed poolId, uint8 reason)
func (_LiquidityPool *LiquidityPoolFilterer) FilterMatchPoolDepositClosed(opts *bind.FilterOpts, matchId [][32]byte, poolId []*big.Int) (*LiquidityPoolMatchPoolDepositClosedIterator, error) {

	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}
	var poolIdRule []interface{}
	for _, poolIdItem := range poolId {
		poolIdRule = append(poolIdRule, poolIdItem)
	}

	logs, sub, err := _LiquidityPool.contract.FilterLogs(opts, "MatchPoolDepositClosed", matchIdRule, poolIdRule)
	if err != nil {
		return nil, err
	}
	return &LiquidityPoolMatchPoolDepositClosedIterator{contract: _LiquidityPool.contract, event: "MatchPoolDepositClosed", logs: logs, sub: sub}, nil
}

// WatchMatchPoolDepositClosed is a free log subscription operation binding the contract event 0x48512c7d2f8726dfbf82111a83eb728cdb7f8f13b6f507c69913342f239e0890.
//
// Solidity: event MatchPoolDepositClosed(bytes32 indexed matchId, uint256 indexed poolId, uint8 reason)
func (_LiquidityPool *LiquidityPoolFilterer) WatchMatchPoolDepositClosed(opts *bind.WatchOpts, sink chan<- *LiquidityPoolMatchPoolDepositClosed, matchId [][32]byte, poolId []*big.Int) (event.Subscription, error) {

	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}
	var poolIdRule []interface{}
	for _, poolIdItem := range poolId {
		poolIdRule = append(poolIdRule, poolIdItem)
	}

	logs, sub, err := _LiquidityPool.contract.WatchLogs(opts, "MatchPoolDepositClosed", matchIdRule, poolIdRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(LiquidityPoolMatchPoolDepositClosed)
				if err := _LiquidityPool.contract.UnpackLog(event, "MatchPoolDepositClosed", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseMatchPoolDepositClosed is a log parse operation binding the contract event 0x48512c7d2f8726dfbf82111a83eb728cdb7f8f13b6f507c69913342f239e0890.
//
// Solidity: event MatchPoolDepositClosed(bytes32 indexed matchId, uint256 indexed poolId, uint8 reason)
func (_LiquidityPool *LiquidityPoolFilterer) ParseMatchPoolDepositClosed(log types.Log) (*LiquidityPoolMatchPoolDepositClosed, error) {
	event := new(LiquidityPoolMatchPoolDepositClosed)
	if err := _LiquidityPool.contract.UnpackLog(event, "MatchPoolDepositClosed", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// LiquidityPoolMatchPoolOpenedIterator is returned from FilterMatchPoolOpened and is used to iterate over the raw logs and unpacked data for MatchPoolOpened events raised by the LiquidityPool contract.
type LiquidityPoolMatchPoolOpenedIterator struct {
	Event *LiquidityPoolMatchPoolOpened // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *LiquidityPoolMatchPoolOpenedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(LiquidityPoolMatchPoolOpened)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(LiquidityPoolMatchPoolOpened)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *LiquidityPoolMatchPoolOpenedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *LiquidityPoolMatchPoolOpenedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// LiquidityPoolMatchPoolOpened represents a MatchPoolOpened event raised by the LiquidityPool contract.
type LiquidityPoolMatchPoolOpened struct {
	MatchId        [32]byte
	PoolId         *big.Int
	MatchEndTime   uint64
	DepositCloseAt uint64
	Raw            types.Log // Blockchain specific contextual infos
}

// FilterMatchPoolOpened is a free log retrieval operation binding the contract event 0x9e5c9e09e3f3a02c7ef86270982de4c6b0dc24a2bad756bda7b020ad8eb11cdd.
//
// Solidity: event MatchPoolOpened(bytes32 indexed matchId, uint256 indexed poolId, uint64 matchEndTime, uint64 depositCloseAt)
func (_LiquidityPool *LiquidityPoolFilterer) FilterMatchPoolOpened(opts *bind.FilterOpts, matchId [][32]byte, poolId []*big.Int) (*LiquidityPoolMatchPoolOpenedIterator, error) {

	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}
	var poolIdRule []interface{}
	for _, poolIdItem := range poolId {
		poolIdRule = append(poolIdRule, poolIdItem)
	}

	logs, sub, err := _LiquidityPool.contract.FilterLogs(opts, "MatchPoolOpened", matchIdRule, poolIdRule)
	if err != nil {
		return nil, err
	}
	return &LiquidityPoolMatchPoolOpenedIterator{contract: _LiquidityPool.contract, event: "MatchPoolOpened", logs: logs, sub: sub}, nil
}

// WatchMatchPoolOpened is a free log subscription operation binding the contract event 0x9e5c9e09e3f3a02c7ef86270982de4c6b0dc24a2bad756bda7b020ad8eb11cdd.
//
// Solidity: event MatchPoolOpened(bytes32 indexed matchId, uint256 indexed poolId, uint64 matchEndTime, uint64 depositCloseAt)
func (_LiquidityPool *LiquidityPoolFilterer) WatchMatchPoolOpened(opts *bind.WatchOpts, sink chan<- *LiquidityPoolMatchPoolOpened, matchId [][32]byte, poolId []*big.Int) (event.Subscription, error) {

	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}
	var poolIdRule []interface{}
	for _, poolIdItem := range poolId {
		poolIdRule = append(poolIdRule, poolIdItem)
	}

	logs, sub, err := _LiquidityPool.contract.WatchLogs(opts, "MatchPoolOpened", matchIdRule, poolIdRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(LiquidityPoolMatchPoolOpened)
				if err := _LiquidityPool.contract.UnpackLog(event, "MatchPoolOpened", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseMatchPoolOpened is a log parse operation binding the contract event 0x9e5c9e09e3f3a02c7ef86270982de4c6b0dc24a2bad756bda7b020ad8eb11cdd.
//
// Solidity: event MatchPoolOpened(bytes32 indexed matchId, uint256 indexed poolId, uint64 matchEndTime, uint64 depositCloseAt)
func (_LiquidityPool *LiquidityPoolFilterer) ParseMatchPoolOpened(log types.Log) (*LiquidityPoolMatchPoolOpened, error) {
	event := new(LiquidityPoolMatchPoolOpened)
	if err := _LiquidityPool.contract.UnpackLog(event, "MatchPoolOpened", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// LiquidityPoolMinDepositUpdatedIterator is returned from FilterMinDepositUpdated and is used to iterate over the raw logs and unpacked data for MinDepositUpdated events raised by the LiquidityPool contract.
type LiquidityPoolMinDepositUpdatedIterator struct {
	Event *LiquidityPoolMinDepositUpdated // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *LiquidityPoolMinDepositUpdatedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(LiquidityPoolMinDepositUpdated)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(LiquidityPoolMinDepositUpdated)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *LiquidityPoolMinDepositUpdatedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *LiquidityPoolMinDepositUpdatedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// LiquidityPoolMinDepositUpdated represents a MinDepositUpdated event raised by the LiquidityPool contract.
type LiquidityPoolMinDepositUpdated struct {
	Operator  common.Address
	OldAmount *big.Int
	NewAmount *big.Int
	Raw       types.Log // Blockchain specific contextual infos
}

// FilterMinDepositUpdated is a free log retrieval operation binding the contract event 0x2f94d5c80cff40da556f6a53fb284902e7f6de5158833121641846e99b5e5037.
//
// Solidity: event MinDepositUpdated(address indexed operator, uint256 oldAmount, uint256 newAmount)
func (_LiquidityPool *LiquidityPoolFilterer) FilterMinDepositUpdated(opts *bind.FilterOpts, operator []common.Address) (*LiquidityPoolMinDepositUpdatedIterator, error) {

	var operatorRule []interface{}
	for _, operatorItem := range operator {
		operatorRule = append(operatorRule, operatorItem)
	}

	logs, sub, err := _LiquidityPool.contract.FilterLogs(opts, "MinDepositUpdated", operatorRule)
	if err != nil {
		return nil, err
	}
	return &LiquidityPoolMinDepositUpdatedIterator{contract: _LiquidityPool.contract, event: "MinDepositUpdated", logs: logs, sub: sub}, nil
}

// WatchMinDepositUpdated is a free log subscription operation binding the contract event 0x2f94d5c80cff40da556f6a53fb284902e7f6de5158833121641846e99b5e5037.
//
// Solidity: event MinDepositUpdated(address indexed operator, uint256 oldAmount, uint256 newAmount)
func (_LiquidityPool *LiquidityPoolFilterer) WatchMinDepositUpdated(opts *bind.WatchOpts, sink chan<- *LiquidityPoolMinDepositUpdated, operator []common.Address) (event.Subscription, error) {

	var operatorRule []interface{}
	for _, operatorItem := range operator {
		operatorRule = append(operatorRule, operatorItem)
	}

	logs, sub, err := _LiquidityPool.contract.WatchLogs(opts, "MinDepositUpdated", operatorRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(LiquidityPoolMinDepositUpdated)
				if err := _LiquidityPool.contract.UnpackLog(event, "MinDepositUpdated", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseMinDepositUpdated is a log parse operation binding the contract event 0x2f94d5c80cff40da556f6a53fb284902e7f6de5158833121641846e99b5e5037.
//
// Solidity: event MinDepositUpdated(address indexed operator, uint256 oldAmount, uint256 newAmount)
func (_LiquidityPool *LiquidityPoolFilterer) ParseMinDepositUpdated(log types.Log) (*LiquidityPoolMinDepositUpdated, error) {
	event := new(LiquidityPoolMinDepositUpdated)
	if err := _LiquidityPool.contract.UnpackLog(event, "MinDepositUpdated", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// LiquidityPoolPausedIterator is returned from FilterPaused and is used to iterate over the raw logs and unpacked data for Paused events raised by the LiquidityPool contract.
type LiquidityPoolPausedIterator struct {
	Event *LiquidityPoolPaused // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *LiquidityPoolPausedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(LiquidityPoolPaused)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(LiquidityPoolPaused)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *LiquidityPoolPausedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *LiquidityPoolPausedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// LiquidityPoolPaused represents a Paused event raised by the LiquidityPool contract.
type LiquidityPoolPaused struct {
	Account common.Address
	Raw     types.Log // Blockchain specific contextual infos
}

// FilterPaused is a free log retrieval operation binding the contract event 0x62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258.
//
// Solidity: event Paused(address account)
func (_LiquidityPool *LiquidityPoolFilterer) FilterPaused(opts *bind.FilterOpts) (*LiquidityPoolPausedIterator, error) {

	logs, sub, err := _LiquidityPool.contract.FilterLogs(opts, "Paused")
	if err != nil {
		return nil, err
	}
	return &LiquidityPoolPausedIterator{contract: _LiquidityPool.contract, event: "Paused", logs: logs, sub: sub}, nil
}

// WatchPaused is a free log subscription operation binding the contract event 0x62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258.
//
// Solidity: event Paused(address account)
func (_LiquidityPool *LiquidityPoolFilterer) WatchPaused(opts *bind.WatchOpts, sink chan<- *LiquidityPoolPaused) (event.Subscription, error) {

	logs, sub, err := _LiquidityPool.contract.WatchLogs(opts, "Paused")
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(LiquidityPoolPaused)
				if err := _LiquidityPool.contract.UnpackLog(event, "Paused", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParsePaused is a log parse operation binding the contract event 0x62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258.
//
// Solidity: event Paused(address account)
func (_LiquidityPool *LiquidityPoolFilterer) ParsePaused(log types.Log) (*LiquidityPoolPaused, error) {
	event := new(LiquidityPoolPaused)
	if err := _LiquidityPool.contract.UnpackLog(event, "Paused", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// LiquidityPoolPayoutLiquidityReservedIterator is returned from FilterPayoutLiquidityReserved and is used to iterate over the raw logs and unpacked data for PayoutLiquidityReserved events raised by the LiquidityPool contract.
type LiquidityPoolPayoutLiquidityReservedIterator struct {
	Event *LiquidityPoolPayoutLiquidityReserved // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *LiquidityPoolPayoutLiquidityReservedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(LiquidityPoolPayoutLiquidityReserved)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(LiquidityPoolPayoutLiquidityReserved)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *LiquidityPoolPayoutLiquidityReservedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *LiquidityPoolPayoutLiquidityReservedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// LiquidityPoolPayoutLiquidityReserved represents a PayoutLiquidityReserved event raised by the LiquidityPool contract.
type LiquidityPoolPayoutLiquidityReserved struct {
	MatchId        [32]byte
	ReservedAmount *big.Int
	PaidOutAmount  *big.Int
	SettledAt      uint64
	Raw            types.Log // Blockchain specific contextual infos
}

// FilterPayoutLiquidityReserved is a free log retrieval operation binding the contract event 0x353c0999c6802ecd3a6c9baccb2ad0a3a14430efa4b9481af0836b1d4b126731.
//
// Solidity: event PayoutLiquidityReserved(bytes32 indexed matchId, uint256 reservedAmount, uint256 paidOutAmount, uint64 settledAt)
func (_LiquidityPool *LiquidityPoolFilterer) FilterPayoutLiquidityReserved(opts *bind.FilterOpts, matchId [][32]byte) (*LiquidityPoolPayoutLiquidityReservedIterator, error) {

	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}

	logs, sub, err := _LiquidityPool.contract.FilterLogs(opts, "PayoutLiquidityReserved", matchIdRule)
	if err != nil {
		return nil, err
	}
	return &LiquidityPoolPayoutLiquidityReservedIterator{contract: _LiquidityPool.contract, event: "PayoutLiquidityReserved", logs: logs, sub: sub}, nil
}

// WatchPayoutLiquidityReserved is a free log subscription operation binding the contract event 0x353c0999c6802ecd3a6c9baccb2ad0a3a14430efa4b9481af0836b1d4b126731.
//
// Solidity: event PayoutLiquidityReserved(bytes32 indexed matchId, uint256 reservedAmount, uint256 paidOutAmount, uint64 settledAt)
func (_LiquidityPool *LiquidityPoolFilterer) WatchPayoutLiquidityReserved(opts *bind.WatchOpts, sink chan<- *LiquidityPoolPayoutLiquidityReserved, matchId [][32]byte) (event.Subscription, error) {

	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}

	logs, sub, err := _LiquidityPool.contract.WatchLogs(opts, "PayoutLiquidityReserved", matchIdRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(LiquidityPoolPayoutLiquidityReserved)
				if err := _LiquidityPool.contract.UnpackLog(event, "PayoutLiquidityReserved", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParsePayoutLiquidityReserved is a log parse operation binding the contract event 0x353c0999c6802ecd3a6c9baccb2ad0a3a14430efa4b9481af0836b1d4b126731.
//
// Solidity: event PayoutLiquidityReserved(bytes32 indexed matchId, uint256 reservedAmount, uint256 paidOutAmount, uint64 settledAt)
func (_LiquidityPool *LiquidityPoolFilterer) ParsePayoutLiquidityReserved(log types.Log) (*LiquidityPoolPayoutLiquidityReserved, error) {
	event := new(LiquidityPoolPayoutLiquidityReserved)
	if err := _LiquidityPool.contract.UnpackLog(event, "PayoutLiquidityReserved", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// LiquidityPoolPayoutLiquidityTransferredIterator is returned from FilterPayoutLiquidityTransferred and is used to iterate over the raw logs and unpacked data for PayoutLiquidityTransferred events raised by the LiquidityPool contract.
type LiquidityPoolPayoutLiquidityTransferredIterator struct {
	Event *LiquidityPoolPayoutLiquidityTransferred // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *LiquidityPoolPayoutLiquidityTransferredIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(LiquidityPoolPayoutLiquidityTransferred)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(LiquidityPoolPayoutLiquidityTransferred)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *LiquidityPoolPayoutLiquidityTransferredIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *LiquidityPoolPayoutLiquidityTransferredIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// LiquidityPoolPayoutLiquidityTransferred represents a PayoutLiquidityTransferred event raised by the LiquidityPool contract.
type LiquidityPoolPayoutLiquidityTransferred struct {
	MatchId          [32]byte
	Amount           *big.Int
	NewPaidOutAmount *big.Int
	Raw              types.Log // Blockchain specific contextual infos
}

// FilterPayoutLiquidityTransferred is a free log retrieval operation binding the contract event 0xe97fea91fde9d69b39936007a3ea75bf8206e8046eb8bf9fe6972a0131a03618.
//
// Solidity: event PayoutLiquidityTransferred(bytes32 indexed matchId, uint256 amount, uint256 newPaidOutAmount)
func (_LiquidityPool *LiquidityPoolFilterer) FilterPayoutLiquidityTransferred(opts *bind.FilterOpts, matchId [][32]byte) (*LiquidityPoolPayoutLiquidityTransferredIterator, error) {

	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}

	logs, sub, err := _LiquidityPool.contract.FilterLogs(opts, "PayoutLiquidityTransferred", matchIdRule)
	if err != nil {
		return nil, err
	}
	return &LiquidityPoolPayoutLiquidityTransferredIterator{contract: _LiquidityPool.contract, event: "PayoutLiquidityTransferred", logs: logs, sub: sub}, nil
}

// WatchPayoutLiquidityTransferred is a free log subscription operation binding the contract event 0xe97fea91fde9d69b39936007a3ea75bf8206e8046eb8bf9fe6972a0131a03618.
//
// Solidity: event PayoutLiquidityTransferred(bytes32 indexed matchId, uint256 amount, uint256 newPaidOutAmount)
func (_LiquidityPool *LiquidityPoolFilterer) WatchPayoutLiquidityTransferred(opts *bind.WatchOpts, sink chan<- *LiquidityPoolPayoutLiquidityTransferred, matchId [][32]byte) (event.Subscription, error) {

	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}

	logs, sub, err := _LiquidityPool.contract.WatchLogs(opts, "PayoutLiquidityTransferred", matchIdRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(LiquidityPoolPayoutLiquidityTransferred)
				if err := _LiquidityPool.contract.UnpackLog(event, "PayoutLiquidityTransferred", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParsePayoutLiquidityTransferred is a log parse operation binding the contract event 0xe97fea91fde9d69b39936007a3ea75bf8206e8046eb8bf9fe6972a0131a03618.
//
// Solidity: event PayoutLiquidityTransferred(bytes32 indexed matchId, uint256 amount, uint256 newPaidOutAmount)
func (_LiquidityPool *LiquidityPoolFilterer) ParsePayoutLiquidityTransferred(log types.Log) (*LiquidityPoolPayoutLiquidityTransferred, error) {
	event := new(LiquidityPoolPayoutLiquidityTransferred)
	if err := _LiquidityPool.contract.UnpackLog(event, "PayoutLiquidityTransferred", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// LiquidityPoolRoleAdminChangedIterator is returned from FilterRoleAdminChanged and is used to iterate over the raw logs and unpacked data for RoleAdminChanged events raised by the LiquidityPool contract.
type LiquidityPoolRoleAdminChangedIterator struct {
	Event *LiquidityPoolRoleAdminChanged // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *LiquidityPoolRoleAdminChangedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(LiquidityPoolRoleAdminChanged)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(LiquidityPoolRoleAdminChanged)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *LiquidityPoolRoleAdminChangedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *LiquidityPoolRoleAdminChangedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// LiquidityPoolRoleAdminChanged represents a RoleAdminChanged event raised by the LiquidityPool contract.
type LiquidityPoolRoleAdminChanged struct {
	Role              [32]byte
	PreviousAdminRole [32]byte
	NewAdminRole      [32]byte
	Raw               types.Log // Blockchain specific contextual infos
}

// FilterRoleAdminChanged is a free log retrieval operation binding the contract event 0xbd79b86ffe0ab8e8776151514217cd7cacd52c909f66475c3af44e129f0b00ff.
//
// Solidity: event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole)
func (_LiquidityPool *LiquidityPoolFilterer) FilterRoleAdminChanged(opts *bind.FilterOpts, role [][32]byte, previousAdminRole [][32]byte, newAdminRole [][32]byte) (*LiquidityPoolRoleAdminChangedIterator, error) {

	var roleRule []interface{}
	for _, roleItem := range role {
		roleRule = append(roleRule, roleItem)
	}
	var previousAdminRoleRule []interface{}
	for _, previousAdminRoleItem := range previousAdminRole {
		previousAdminRoleRule = append(previousAdminRoleRule, previousAdminRoleItem)
	}
	var newAdminRoleRule []interface{}
	for _, newAdminRoleItem := range newAdminRole {
		newAdminRoleRule = append(newAdminRoleRule, newAdminRoleItem)
	}

	logs, sub, err := _LiquidityPool.contract.FilterLogs(opts, "RoleAdminChanged", roleRule, previousAdminRoleRule, newAdminRoleRule)
	if err != nil {
		return nil, err
	}
	return &LiquidityPoolRoleAdminChangedIterator{contract: _LiquidityPool.contract, event: "RoleAdminChanged", logs: logs, sub: sub}, nil
}

// WatchRoleAdminChanged is a free log subscription operation binding the contract event 0xbd79b86ffe0ab8e8776151514217cd7cacd52c909f66475c3af44e129f0b00ff.
//
// Solidity: event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole)
func (_LiquidityPool *LiquidityPoolFilterer) WatchRoleAdminChanged(opts *bind.WatchOpts, sink chan<- *LiquidityPoolRoleAdminChanged, role [][32]byte, previousAdminRole [][32]byte, newAdminRole [][32]byte) (event.Subscription, error) {

	var roleRule []interface{}
	for _, roleItem := range role {
		roleRule = append(roleRule, roleItem)
	}
	var previousAdminRoleRule []interface{}
	for _, previousAdminRoleItem := range previousAdminRole {
		previousAdminRoleRule = append(previousAdminRoleRule, previousAdminRoleItem)
	}
	var newAdminRoleRule []interface{}
	for _, newAdminRoleItem := range newAdminRole {
		newAdminRoleRule = append(newAdminRoleRule, newAdminRoleItem)
	}

	logs, sub, err := _LiquidityPool.contract.WatchLogs(opts, "RoleAdminChanged", roleRule, previousAdminRoleRule, newAdminRoleRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(LiquidityPoolRoleAdminChanged)
				if err := _LiquidityPool.contract.UnpackLog(event, "RoleAdminChanged", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseRoleAdminChanged is a log parse operation binding the contract event 0xbd79b86ffe0ab8e8776151514217cd7cacd52c909f66475c3af44e129f0b00ff.
//
// Solidity: event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole)
func (_LiquidityPool *LiquidityPoolFilterer) ParseRoleAdminChanged(log types.Log) (*LiquidityPoolRoleAdminChanged, error) {
	event := new(LiquidityPoolRoleAdminChanged)
	if err := _LiquidityPool.contract.UnpackLog(event, "RoleAdminChanged", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// LiquidityPoolRoleGrantedIterator is returned from FilterRoleGranted and is used to iterate over the raw logs and unpacked data for RoleGranted events raised by the LiquidityPool contract.
type LiquidityPoolRoleGrantedIterator struct {
	Event *LiquidityPoolRoleGranted // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *LiquidityPoolRoleGrantedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(LiquidityPoolRoleGranted)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(LiquidityPoolRoleGranted)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *LiquidityPoolRoleGrantedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *LiquidityPoolRoleGrantedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// LiquidityPoolRoleGranted represents a RoleGranted event raised by the LiquidityPool contract.
type LiquidityPoolRoleGranted struct {
	Role    [32]byte
	Account common.Address
	Sender  common.Address
	Raw     types.Log // Blockchain specific contextual infos
}

// FilterRoleGranted is a free log retrieval operation binding the contract event 0x2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d.
//
// Solidity: event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)
func (_LiquidityPool *LiquidityPoolFilterer) FilterRoleGranted(opts *bind.FilterOpts, role [][32]byte, account []common.Address, sender []common.Address) (*LiquidityPoolRoleGrantedIterator, error) {

	var roleRule []interface{}
	for _, roleItem := range role {
		roleRule = append(roleRule, roleItem)
	}
	var accountRule []interface{}
	for _, accountItem := range account {
		accountRule = append(accountRule, accountItem)
	}
	var senderRule []interface{}
	for _, senderItem := range sender {
		senderRule = append(senderRule, senderItem)
	}

	logs, sub, err := _LiquidityPool.contract.FilterLogs(opts, "RoleGranted", roleRule, accountRule, senderRule)
	if err != nil {
		return nil, err
	}
	return &LiquidityPoolRoleGrantedIterator{contract: _LiquidityPool.contract, event: "RoleGranted", logs: logs, sub: sub}, nil
}

// WatchRoleGranted is a free log subscription operation binding the contract event 0x2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d.
//
// Solidity: event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)
func (_LiquidityPool *LiquidityPoolFilterer) WatchRoleGranted(opts *bind.WatchOpts, sink chan<- *LiquidityPoolRoleGranted, role [][32]byte, account []common.Address, sender []common.Address) (event.Subscription, error) {

	var roleRule []interface{}
	for _, roleItem := range role {
		roleRule = append(roleRule, roleItem)
	}
	var accountRule []interface{}
	for _, accountItem := range account {
		accountRule = append(accountRule, accountItem)
	}
	var senderRule []interface{}
	for _, senderItem := range sender {
		senderRule = append(senderRule, senderItem)
	}

	logs, sub, err := _LiquidityPool.contract.WatchLogs(opts, "RoleGranted", roleRule, accountRule, senderRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(LiquidityPoolRoleGranted)
				if err := _LiquidityPool.contract.UnpackLog(event, "RoleGranted", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseRoleGranted is a log parse operation binding the contract event 0x2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d.
//
// Solidity: event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)
func (_LiquidityPool *LiquidityPoolFilterer) ParseRoleGranted(log types.Log) (*LiquidityPoolRoleGranted, error) {
	event := new(LiquidityPoolRoleGranted)
	if err := _LiquidityPool.contract.UnpackLog(event, "RoleGranted", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// LiquidityPoolRoleRevokedIterator is returned from FilterRoleRevoked and is used to iterate over the raw logs and unpacked data for RoleRevoked events raised by the LiquidityPool contract.
type LiquidityPoolRoleRevokedIterator struct {
	Event *LiquidityPoolRoleRevoked // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *LiquidityPoolRoleRevokedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(LiquidityPoolRoleRevoked)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(LiquidityPoolRoleRevoked)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *LiquidityPoolRoleRevokedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *LiquidityPoolRoleRevokedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// LiquidityPoolRoleRevoked represents a RoleRevoked event raised by the LiquidityPool contract.
type LiquidityPoolRoleRevoked struct {
	Role    [32]byte
	Account common.Address
	Sender  common.Address
	Raw     types.Log // Blockchain specific contextual infos
}

// FilterRoleRevoked is a free log retrieval operation binding the contract event 0xf6391f5c32d9c69d2a47ea670b442974b53935d1edc7fd64eb21e047a839171b.
//
// Solidity: event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)
func (_LiquidityPool *LiquidityPoolFilterer) FilterRoleRevoked(opts *bind.FilterOpts, role [][32]byte, account []common.Address, sender []common.Address) (*LiquidityPoolRoleRevokedIterator, error) {

	var roleRule []interface{}
	for _, roleItem := range role {
		roleRule = append(roleRule, roleItem)
	}
	var accountRule []interface{}
	for _, accountItem := range account {
		accountRule = append(accountRule, accountItem)
	}
	var senderRule []interface{}
	for _, senderItem := range sender {
		senderRule = append(senderRule, senderItem)
	}

	logs, sub, err := _LiquidityPool.contract.FilterLogs(opts, "RoleRevoked", roleRule, accountRule, senderRule)
	if err != nil {
		return nil, err
	}
	return &LiquidityPoolRoleRevokedIterator{contract: _LiquidityPool.contract, event: "RoleRevoked", logs: logs, sub: sub}, nil
}

// WatchRoleRevoked is a free log subscription operation binding the contract event 0xf6391f5c32d9c69d2a47ea670b442974b53935d1edc7fd64eb21e047a839171b.
//
// Solidity: event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)
func (_LiquidityPool *LiquidityPoolFilterer) WatchRoleRevoked(opts *bind.WatchOpts, sink chan<- *LiquidityPoolRoleRevoked, role [][32]byte, account []common.Address, sender []common.Address) (event.Subscription, error) {

	var roleRule []interface{}
	for _, roleItem := range role {
		roleRule = append(roleRule, roleItem)
	}
	var accountRule []interface{}
	for _, accountItem := range account {
		accountRule = append(accountRule, accountItem)
	}
	var senderRule []interface{}
	for _, senderItem := range sender {
		senderRule = append(senderRule, senderItem)
	}

	logs, sub, err := _LiquidityPool.contract.WatchLogs(opts, "RoleRevoked", roleRule, accountRule, senderRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(LiquidityPoolRoleRevoked)
				if err := _LiquidityPool.contract.UnpackLog(event, "RoleRevoked", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseRoleRevoked is a log parse operation binding the contract event 0xf6391f5c32d9c69d2a47ea670b442974b53935d1edc7fd64eb21e047a839171b.
//
// Solidity: event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)
func (_LiquidityPool *LiquidityPoolFilterer) ParseRoleRevoked(log types.Log) (*LiquidityPoolRoleRevoked, error) {
	event := new(LiquidityPoolRoleRevoked)
	if err := _LiquidityPool.contract.UnpackLog(event, "RoleRevoked", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// LiquidityPoolUnbondEpochsUpdatedIterator is returned from FilterUnbondEpochsUpdated and is used to iterate over the raw logs and unpacked data for UnbondEpochsUpdated events raised by the LiquidityPool contract.
type LiquidityPoolUnbondEpochsUpdatedIterator struct {
	Event *LiquidityPoolUnbondEpochsUpdated // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *LiquidityPoolUnbondEpochsUpdatedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(LiquidityPoolUnbondEpochsUpdated)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(LiquidityPoolUnbondEpochsUpdated)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *LiquidityPoolUnbondEpochsUpdatedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *LiquidityPoolUnbondEpochsUpdatedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// LiquidityPoolUnbondEpochsUpdated represents a UnbondEpochsUpdated event raised by the LiquidityPool contract.
type LiquidityPoolUnbondEpochsUpdated struct {
	Operator  common.Address
	OldEpochs uint32
	NewEpochs uint32
	Raw       types.Log // Blockchain specific contextual infos
}

// FilterUnbondEpochsUpdated is a free log retrieval operation binding the contract event 0xfd7476c4c954e286314d2d8af3eeb8cfb21ffda1ccda61406538b19ea1ee995e.
//
// Solidity: event UnbondEpochsUpdated(address indexed operator, uint32 oldEpochs, uint32 newEpochs)
func (_LiquidityPool *LiquidityPoolFilterer) FilterUnbondEpochsUpdated(opts *bind.FilterOpts, operator []common.Address) (*LiquidityPoolUnbondEpochsUpdatedIterator, error) {

	var operatorRule []interface{}
	for _, operatorItem := range operator {
		operatorRule = append(operatorRule, operatorItem)
	}

	logs, sub, err := _LiquidityPool.contract.FilterLogs(opts, "UnbondEpochsUpdated", operatorRule)
	if err != nil {
		return nil, err
	}
	return &LiquidityPoolUnbondEpochsUpdatedIterator{contract: _LiquidityPool.contract, event: "UnbondEpochsUpdated", logs: logs, sub: sub}, nil
}

// WatchUnbondEpochsUpdated is a free log subscription operation binding the contract event 0xfd7476c4c954e286314d2d8af3eeb8cfb21ffda1ccda61406538b19ea1ee995e.
//
// Solidity: event UnbondEpochsUpdated(address indexed operator, uint32 oldEpochs, uint32 newEpochs)
func (_LiquidityPool *LiquidityPoolFilterer) WatchUnbondEpochsUpdated(opts *bind.WatchOpts, sink chan<- *LiquidityPoolUnbondEpochsUpdated, operator []common.Address) (event.Subscription, error) {

	var operatorRule []interface{}
	for _, operatorItem := range operator {
		operatorRule = append(operatorRule, operatorItem)
	}

	logs, sub, err := _LiquidityPool.contract.WatchLogs(opts, "UnbondEpochsUpdated", operatorRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(LiquidityPoolUnbondEpochsUpdated)
				if err := _LiquidityPool.contract.UnpackLog(event, "UnbondEpochsUpdated", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseUnbondEpochsUpdated is a log parse operation binding the contract event 0xfd7476c4c954e286314d2d8af3eeb8cfb21ffda1ccda61406538b19ea1ee995e.
//
// Solidity: event UnbondEpochsUpdated(address indexed operator, uint32 oldEpochs, uint32 newEpochs)
func (_LiquidityPool *LiquidityPoolFilterer) ParseUnbondEpochsUpdated(log types.Log) (*LiquidityPoolUnbondEpochsUpdated, error) {
	event := new(LiquidityPoolUnbondEpochsUpdated)
	if err := _LiquidityPool.contract.UnpackLog(event, "UnbondEpochsUpdated", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// LiquidityPoolUnbondRequestedIterator is returned from FilterUnbondRequested and is used to iterate over the raw logs and unpacked data for UnbondRequested events raised by the LiquidityPool contract.
type LiquidityPoolUnbondRequestedIterator struct {
	Event *LiquidityPoolUnbondRequested // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *LiquidityPoolUnbondRequestedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(LiquidityPoolUnbondRequested)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(LiquidityPoolUnbondRequested)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *LiquidityPoolUnbondRequestedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *LiquidityPoolUnbondRequestedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// LiquidityPoolUnbondRequested represents a UnbondRequested event raised by the LiquidityPool contract.
type LiquidityPoolUnbondRequested struct {
	PositionId             *big.Int
	User                   common.Address
	UnbondingEpoch         uint32
	FrozenRewardPerWeight  *big.Int
	FrozenLossPerPrincipal *big.Int
	Raw                    types.Log // Blockchain specific contextual infos
}

// FilterUnbondRequested is a free log retrieval operation binding the contract event 0x5c8677e40f537ed4033f10cea240c8289f4399ff5dceadb91ab4c801eb013895.
//
// Solidity: event UnbondRequested(uint256 indexed positionId, address indexed user, uint32 unbondingEpoch, uint256 frozenRewardPerWeight, uint256 frozenLossPerPrincipal)
func (_LiquidityPool *LiquidityPoolFilterer) FilterUnbondRequested(opts *bind.FilterOpts, positionId []*big.Int, user []common.Address) (*LiquidityPoolUnbondRequestedIterator, error) {

	var positionIdRule []interface{}
	for _, positionIdItem := range positionId {
		positionIdRule = append(positionIdRule, positionIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _LiquidityPool.contract.FilterLogs(opts, "UnbondRequested", positionIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return &LiquidityPoolUnbondRequestedIterator{contract: _LiquidityPool.contract, event: "UnbondRequested", logs: logs, sub: sub}, nil
}

// WatchUnbondRequested is a free log subscription operation binding the contract event 0x5c8677e40f537ed4033f10cea240c8289f4399ff5dceadb91ab4c801eb013895.
//
// Solidity: event UnbondRequested(uint256 indexed positionId, address indexed user, uint32 unbondingEpoch, uint256 frozenRewardPerWeight, uint256 frozenLossPerPrincipal)
func (_LiquidityPool *LiquidityPoolFilterer) WatchUnbondRequested(opts *bind.WatchOpts, sink chan<- *LiquidityPoolUnbondRequested, positionId []*big.Int, user []common.Address) (event.Subscription, error) {

	var positionIdRule []interface{}
	for _, positionIdItem := range positionId {
		positionIdRule = append(positionIdRule, positionIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _LiquidityPool.contract.WatchLogs(opts, "UnbondRequested", positionIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(LiquidityPoolUnbondRequested)
				if err := _LiquidityPool.contract.UnpackLog(event, "UnbondRequested", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseUnbondRequested is a log parse operation binding the contract event 0x5c8677e40f537ed4033f10cea240c8289f4399ff5dceadb91ab4c801eb013895.
//
// Solidity: event UnbondRequested(uint256 indexed positionId, address indexed user, uint32 unbondingEpoch, uint256 frozenRewardPerWeight, uint256 frozenLossPerPrincipal)
func (_LiquidityPool *LiquidityPoolFilterer) ParseUnbondRequested(log types.Log) (*LiquidityPoolUnbondRequested, error) {
	event := new(LiquidityPoolUnbondRequested)
	if err := _LiquidityPool.contract.UnpackLog(event, "UnbondRequested", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// LiquidityPoolUnpausedIterator is returned from FilterUnpaused and is used to iterate over the raw logs and unpacked data for Unpaused events raised by the LiquidityPool contract.
type LiquidityPoolUnpausedIterator struct {
	Event *LiquidityPoolUnpaused // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *LiquidityPoolUnpausedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(LiquidityPoolUnpaused)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(LiquidityPoolUnpaused)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *LiquidityPoolUnpausedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *LiquidityPoolUnpausedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// LiquidityPoolUnpaused represents a Unpaused event raised by the LiquidityPool contract.
type LiquidityPoolUnpaused struct {
	Account common.Address
	Raw     types.Log // Blockchain specific contextual infos
}

// FilterUnpaused is a free log retrieval operation binding the contract event 0x5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa.
//
// Solidity: event Unpaused(address account)
func (_LiquidityPool *LiquidityPoolFilterer) FilterUnpaused(opts *bind.FilterOpts) (*LiquidityPoolUnpausedIterator, error) {

	logs, sub, err := _LiquidityPool.contract.FilterLogs(opts, "Unpaused")
	if err != nil {
		return nil, err
	}
	return &LiquidityPoolUnpausedIterator{contract: _LiquidityPool.contract, event: "Unpaused", logs: logs, sub: sub}, nil
}

// WatchUnpaused is a free log subscription operation binding the contract event 0x5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa.
//
// Solidity: event Unpaused(address account)
func (_LiquidityPool *LiquidityPoolFilterer) WatchUnpaused(opts *bind.WatchOpts, sink chan<- *LiquidityPoolUnpaused) (event.Subscription, error) {

	logs, sub, err := _LiquidityPool.contract.WatchLogs(opts, "Unpaused")
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(LiquidityPoolUnpaused)
				if err := _LiquidityPool.contract.UnpackLog(event, "Unpaused", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseUnpaused is a log parse operation binding the contract event 0x5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa.
//
// Solidity: event Unpaused(address account)
func (_LiquidityPool *LiquidityPoolFilterer) ParseUnpaused(log types.Log) (*LiquidityPoolUnpaused, error) {
	event := new(LiquidityPoolUnpaused)
	if err := _LiquidityPool.contract.UnpackLog(event, "Unpaused", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// LiquidityPoolUpgradedIterator is returned from FilterUpgraded and is used to iterate over the raw logs and unpacked data for Upgraded events raised by the LiquidityPool contract.
type LiquidityPoolUpgradedIterator struct {
	Event *LiquidityPoolUpgraded // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *LiquidityPoolUpgradedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(LiquidityPoolUpgraded)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(LiquidityPoolUpgraded)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *LiquidityPoolUpgradedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *LiquidityPoolUpgradedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// LiquidityPoolUpgraded represents a Upgraded event raised by the LiquidityPool contract.
type LiquidityPoolUpgraded struct {
	Implementation common.Address
	Raw            types.Log // Blockchain specific contextual infos
}

// FilterUpgraded is a free log retrieval operation binding the contract event 0xbc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b.
//
// Solidity: event Upgraded(address indexed implementation)
func (_LiquidityPool *LiquidityPoolFilterer) FilterUpgraded(opts *bind.FilterOpts, implementation []common.Address) (*LiquidityPoolUpgradedIterator, error) {

	var implementationRule []interface{}
	for _, implementationItem := range implementation {
		implementationRule = append(implementationRule, implementationItem)
	}

	logs, sub, err := _LiquidityPool.contract.FilterLogs(opts, "Upgraded", implementationRule)
	if err != nil {
		return nil, err
	}
	return &LiquidityPoolUpgradedIterator{contract: _LiquidityPool.contract, event: "Upgraded", logs: logs, sub: sub}, nil
}

// WatchUpgraded is a free log subscription operation binding the contract event 0xbc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b.
//
// Solidity: event Upgraded(address indexed implementation)
func (_LiquidityPool *LiquidityPoolFilterer) WatchUpgraded(opts *bind.WatchOpts, sink chan<- *LiquidityPoolUpgraded, implementation []common.Address) (event.Subscription, error) {

	var implementationRule []interface{}
	for _, implementationItem := range implementation {
		implementationRule = append(implementationRule, implementationItem)
	}

	logs, sub, err := _LiquidityPool.contract.WatchLogs(opts, "Upgraded", implementationRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(LiquidityPoolUpgraded)
				if err := _LiquidityPool.contract.UnpackLog(event, "Upgraded", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseUpgraded is a log parse operation binding the contract event 0xbc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b.
//
// Solidity: event Upgraded(address indexed implementation)
func (_LiquidityPool *LiquidityPoolFilterer) ParseUpgraded(log types.Log) (*LiquidityPoolUpgraded, error) {
	event := new(LiquidityPoolUpgraded)
	if err := _LiquidityPool.contract.UnpackLog(event, "Upgraded", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}
