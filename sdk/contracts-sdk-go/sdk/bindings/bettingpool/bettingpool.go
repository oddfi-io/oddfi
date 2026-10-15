// Code generated - DO NOT EDIT.
// This file is a generated binding and any manual changes will be lost.

package bettingpool

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

// BettingPoolMetaData contains all meta data concerning the BettingPool contract.
var BettingPoolMetaData = &bind.MetaData{
	ABI: "[{\"type\":\"constructor\",\"inputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"UPGRADE_INTERFACE_VERSION\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"string\",\"internalType\":\"string\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"addLiquidity\",\"inputs\":[{\"name\":\"amount\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"admin\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"address\",\"internalType\":\"address\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"batchCancelMatch\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"markets\",\"type\":\"uint8[]\",\"internalType\":\"enumMarketType[]\"},{\"name\":\"lines\",\"type\":\"uint8[]\",\"internalType\":\"uint8[]\"},{\"name\":\"betIdsByMarket\",\"type\":\"bytes32[][]\",\"internalType\":\"bytes32[][]\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"batchCloseMarkets\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"markets\",\"type\":\"uint8[]\",\"internalType\":\"enumMarketType[]\"},{\"name\":\"lines\",\"type\":\"uint8[]\",\"internalType\":\"uint8[]\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"batchOpenMarkets\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"markets\",\"type\":\"uint8[]\",\"internalType\":\"enumMarketType[]\"},{\"name\":\"lines\",\"type\":\"uint8[]\",\"internalType\":\"uint8[]\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"bets\",\"inputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[{\"name\":\"user\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"matchId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"market\",\"type\":\"uint8\",\"internalType\":\"enumMarketType\"},{\"name\":\"outcome\",\"type\":\"uint8\",\"internalType\":\"uint8\"},{\"name\":\"line\",\"type\":\"uint8\",\"internalType\":\"uint8\"},{\"name\":\"lockedOdds\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"status\",\"type\":\"uint8\",\"internalType\":\"enumBetStatus\"},{\"name\":\"isCredit\",\"type\":\"bool\",\"internalType\":\"bool\"},{\"name\":\"collateralBetId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"isParlay\",\"type\":\"bool\",\"internalType\":\"bool\"},{\"name\":\"parlayId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"bettingPool\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"cancelMatch\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"market\",\"type\":\"uint8\",\"internalType\":\"enumMarketType\"},{\"name\":\"line\",\"type\":\"uint8\",\"internalType\":\"uint8\"},{\"name\":\"betIds\",\"type\":\"bytes32[]\",\"internalType\":\"bytes32[]\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"closeMarket\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"market\",\"type\":\"uint8\",\"internalType\":\"enumMarketType\"},{\"name\":\"line\",\"type\":\"uint8\",\"internalType\":\"uint8\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"collateralUsed\",\"inputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"creditDeposit\",\"inputs\":[{\"name\":\"user\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"txHash\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"executeLargeWithdrawal\",\"inputs\":[{\"name\":\"requestId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"frozenPayouts\",\"inputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"getParlayLegs\",\"inputs\":[{\"name\":\"parlayId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[{\"name\":\"\",\"type\":\"bytes32[]\",\"internalType\":\"bytes32[]\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"initialize\",\"inputs\":[{\"name\":\"_usdt\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"_admin\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"_multisig\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"isAccepting\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"market\",\"type\":\"uint8\",\"internalType\":\"enumMarketType\"},{\"name\":\"line\",\"type\":\"uint8\",\"internalType\":\"uint8\"},{\"name\":\"outcome\",\"type\":\"uint8\",\"internalType\":\"uint8\"}],\"outputs\":[{\"name\":\"\",\"type\":\"bool\",\"internalType\":\"bool\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"lockBet\",\"inputs\":[{\"name\":\"betId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"user\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"matchId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"market\",\"type\":\"uint8\",\"internalType\":\"enumMarketType\"},{\"name\":\"outcome\",\"type\":\"uint8\",\"internalType\":\"uint8\"},{\"name\":\"line\",\"type\":\"uint8\",\"internalType\":\"uint8\"},{\"name\":\"lockedOdds\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"lockCreditBet\",\"inputs\":[{\"name\":\"betId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"collateralBetId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"user\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"matchId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"market\",\"type\":\"uint8\",\"internalType\":\"enumMarketType\"},{\"name\":\"outcome\",\"type\":\"uint8\",\"internalType\":\"uint8\"},{\"name\":\"line\",\"type\":\"uint8\",\"internalType\":\"uint8\"},{\"name\":\"lockedOdds\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"lockParlay\",\"inputs\":[{\"name\":\"parlayId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"user\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"stake\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"matchIds\",\"type\":\"bytes32[]\",\"internalType\":\"bytes32[]\"},{\"name\":\"markets\",\"type\":\"uint8[]\",\"internalType\":\"enumMarketType[]\"},{\"name\":\"outcomes\",\"type\":\"uint8[]\",\"internalType\":\"uint8[]\"},{\"name\":\"lines\",\"type\":\"uint8[]\",\"internalType\":\"uint8[]\"},{\"name\":\"legOdds\",\"type\":\"uint256[]\",\"internalType\":\"uint256[]\"},{\"name\":\"legBetIds\",\"type\":\"bytes32[]\",\"internalType\":\"bytes32[]\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"lockedBalances\",\"inputs\":[{\"name\":\"\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"lpShareBps\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"lpShares\",\"inputs\":[{\"name\":\"\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"marketOutcome\",\"inputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[{\"name\":\"\",\"type\":\"uint8\",\"internalType\":\"uint8\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"marketStatus\",\"inputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[{\"name\":\"\",\"type\":\"uint8\",\"internalType\":\"enumMarketStatus\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"matchMarkets\",\"inputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"maxMarketsPerMatch\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"multisig\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"address\",\"internalType\":\"address\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"openMarket\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"market\",\"type\":\"uint8\",\"internalType\":\"enumMarketType\"},{\"name\":\"line\",\"type\":\"uint8\",\"internalType\":\"uint8\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"parlays\",\"inputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[{\"name\":\"user\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"stake\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"combinedOdds\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"maxPayout\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"status\",\"type\":\"uint8\",\"internalType\":\"enumBetStatus\"},{\"name\":\"settledLegs\",\"type\":\"uint8\",\"internalType\":\"uint8\"},{\"name\":\"wonLegs\",\"type\":\"uint8\",\"internalType\":\"uint8\"},{\"name\":\"cancelledLegs\",\"type\":\"uint8\",\"internalType\":\"uint8\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"pause\",\"inputs\":[],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"paused\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"bool\",\"internalType\":\"bool\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"platformBalance\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"processedDeposits\",\"inputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[{\"name\":\"\",\"type\":\"bool\",\"internalType\":\"bool\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"proxiableUUID\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"redLightThreshold\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"rejectLargeWithdrawal\",\"inputs\":[{\"name\":\"requestId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"releaseOrForfeiture\",\"inputs\":[{\"name\":\"creditBetId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"removeLiquidity\",\"inputs\":[{\"name\":\"shares\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"reopenMarket\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"market\",\"type\":\"uint8\",\"internalType\":\"enumMarketType\"},{\"name\":\"line\",\"type\":\"uint8\",\"internalType\":\"uint8\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"setAdmin\",\"inputs\":[{\"name\":\"newAdmin\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"setLpShareBps\",\"inputs\":[{\"name\":\"newBps\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"setMaxMarketsPerMatch\",\"inputs\":[{\"name\":\"max\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"setRedLightThreshold\",\"inputs\":[{\"name\":\"threshold\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"settle\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"market\",\"type\":\"uint8\",\"internalType\":\"enumMarketType\"},{\"name\":\"line\",\"type\":\"uint8\",\"internalType\":\"uint8\"},{\"name\":\"winningOutcome\",\"type\":\"uint8\",\"internalType\":\"uint8\"},{\"name\":\"betIds\",\"type\":\"bytes32[]\",\"internalType\":\"bytes32[]\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"signals\",\"inputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[{\"name\":\"heavyAmount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"heavySide\",\"type\":\"uint8\",\"internalType\":\"uint8\"},{\"name\":\"color\",\"type\":\"uint8\",\"internalType\":\"enumSignalColor\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"totalCreditOutstanding\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"totalFrozenPayouts\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"totalLpShares\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"totalPendingWithdrawals\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"totalPotentialPayout\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"totalUserBalances\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"unlockBet\",\"inputs\":[{\"name\":\"betId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"creditBetIds\",\"type\":\"bytes32[]\",\"internalType\":\"bytes32[]\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"unlockParlay\",\"inputs\":[{\"name\":\"parlayId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"unpause\",\"inputs\":[],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"updateSignal\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"market\",\"type\":\"uint8\",\"internalType\":\"enumMarketType\"},{\"name\":\"line\",\"type\":\"uint8\",\"internalType\":\"uint8\"},{\"name\":\"heavyAmount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"heavySide\",\"type\":\"uint8\",\"internalType\":\"uint8\"},{\"name\":\"color\",\"type\":\"uint8\",\"internalType\":\"enumSignalColor\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"upgradeToAndCall\",\"inputs\":[{\"name\":\"newImplementation\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"data\",\"type\":\"bytes\",\"internalType\":\"bytes\"}],\"outputs\":[],\"stateMutability\":\"payable\"},{\"type\":\"function\",\"name\":\"usdt\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"address\",\"internalType\":\"contractIERC20\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"userBalances\",\"inputs\":[{\"name\":\"\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"withdraw\",\"inputs\":[{\"name\":\"amount\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"withdrawPlatform\",\"inputs\":[{\"name\":\"to\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"withdrawalNonce\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"withdrawalRequests\",\"inputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[{\"name\":\"user\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"requestTime\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"executed\",\"type\":\"bool\",\"internalType\":\"bool\"},{\"name\":\"rejected\",\"type\":\"bool\",\"internalType\":\"bool\"}],\"stateMutability\":\"view\"},{\"type\":\"event\",\"name\":\"AdminUpdated\",\"inputs\":[{\"name\":\"oldAdmin\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"newAdmin\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"BetLocked\",\"inputs\":[{\"name\":\"betId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"user\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"matchId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"BetSettled\",\"inputs\":[{\"name\":\"betId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"user\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"status\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"enumBetStatus\"},{\"name\":\"payout\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"BetUnlocked\",\"inputs\":[{\"name\":\"betId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"user\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"CreditBetForfeited\",\"inputs\":[{\"name\":\"betId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"collateralBetId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"amount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"CreditBetLocked\",\"inputs\":[{\"name\":\"betId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"collateralBetId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"user\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"CreditBetSettled\",\"inputs\":[{\"name\":\"betId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"user\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"status\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"enumBetStatus\"},{\"name\":\"payout\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"deduction\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"CreditCollateralCancelled\",\"inputs\":[{\"name\":\"betId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"collateralBetId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"amount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"CreditPayoutForfeited\",\"inputs\":[{\"name\":\"betId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"payout\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"CreditPayoutFrozen\",\"inputs\":[{\"name\":\"betId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"user\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"payout\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"CreditPayoutReleased\",\"inputs\":[{\"name\":\"betId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"user\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"netPayout\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"Deposited\",\"inputs\":[{\"name\":\"user\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"txHash\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"Initialized\",\"inputs\":[{\"name\":\"version\",\"type\":\"uint64\",\"indexed\":false,\"internalType\":\"uint64\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"LargeWithdrawalRejected\",\"inputs\":[{\"name\":\"requestId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"user\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"LargeWithdrawalRequested\",\"inputs\":[{\"name\":\"requestId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"user\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"LiquidityAdded\",\"inputs\":[{\"name\":\"provider\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"shares\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"LiquidityRemoved\",\"inputs\":[{\"name\":\"provider\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"shares\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"LpShareBpsUpdated\",\"inputs\":[{\"name\":\"oldBps\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"newBps\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"MarketClosed\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"market\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"enumMarketType\"},{\"name\":\"line\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"uint8\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"MarketOpened\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"market\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"enumMarketType\"},{\"name\":\"line\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"uint8\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"MarketReopened\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"market\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"enumMarketType\"},{\"name\":\"line\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"uint8\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"MatchCancelled\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"market\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"enumMarketType\"},{\"name\":\"line\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"uint8\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"MatchSettled\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"market\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"enumMarketType\"},{\"name\":\"line\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"uint8\"},{\"name\":\"winningOutcome\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"uint8\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"MaxMarketsPerMatchUpdated\",\"inputs\":[{\"name\":\"newMax\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"ParlayDegradedToSingle\",\"inputs\":[{\"name\":\"parlayId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"remainingBetId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"newOdds\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"ParlayLegCancelled\",\"inputs\":[{\"name\":\"parlayId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"betId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"newCombinedOdds\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"ParlayLocked\",\"inputs\":[{\"name\":\"parlayId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"user\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"stake\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"legs\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"uint8\"},{\"name\":\"combinedOdds\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"legBetIds\",\"type\":\"bytes32[]\",\"indexed\":false,\"internalType\":\"bytes32[]\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"ParlayLost\",\"inputs\":[{\"name\":\"parlayId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"user\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"stake\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"ParlayUnlocked\",\"inputs\":[{\"name\":\"parlayId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"user\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"stake\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"ParlayWon\",\"inputs\":[{\"name\":\"parlayId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"user\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"payout\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"Paused\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"indexed\":false,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"PlatformWithdrawn\",\"inputs\":[{\"name\":\"to\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"RedLightThresholdUpdated\",\"inputs\":[{\"name\":\"oldThreshold\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"newThreshold\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"SignalUpdated\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"market\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"enumMarketType\"},{\"name\":\"line\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"uint8\"},{\"name\":\"color\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"enumSignalColor\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"Unpaused\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"indexed\":false,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"Upgraded\",\"inputs\":[{\"name\":\"implementation\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"Withdrawn\",\"inputs\":[{\"name\":\"user\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"error\",\"name\":\"AddressEmptyCode\",\"inputs\":[{\"name\":\"target\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"BetAlreadySettled\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"BetIdAlreadyExists\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"BetNotFound\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"CreditChainForbidden\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"CreditLimitExceeded\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"DuplicateMatchInParlay\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"ERC1967InvalidImplementation\",\"inputs\":[{\"name\":\"implementation\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"ERC1967NonPayable\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"EnforcedPause\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"ExpectedPause\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"FailedCall\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"FrozenPayoutNotFound\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"GlobalMaxBetExceeded\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"InsufficientBalance\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"InsufficientLiquidity\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"InvalidAddress\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"InvalidBetForMarket\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"InvalidInitialization\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"InvalidLpShareBps\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"InvalidOdds\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"InvalidParlayLegs\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"MarketNotOpen\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"MarketRedLight\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"NotInitializing\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"OutcomeInconsistent\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"ParlayIdAlreadyExists\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"ParlayNotCollateralizable\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"ParlayPartiallySettled\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"ParlayPayoutExceeded\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"ReentrancyGuardReentrantCall\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"SafeERC20FailedOperation\",\"inputs\":[{\"name\":\"token\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"SharesIsZero\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"TooManyMarkets\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"UUPSUnauthorizedCallContext\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"UUPSUnsupportedProxiableUUID\",\"inputs\":[{\"name\":\"slot\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}]},{\"type\":\"error\",\"name\":\"Unauthorized\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"WithdrawalAlreadyProcessed\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"WithdrawalNotReady\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"ZeroAmount\",\"inputs\":[]}]",
}

// BettingPoolABI is the input ABI used to generate the binding from.
// Deprecated: Use BettingPoolMetaData.ABI instead.
var BettingPoolABI = BettingPoolMetaData.ABI

// BettingPool is an auto generated Go binding around an Ethereum contract.
type BettingPool struct {
	BettingPoolCaller     // Read-only binding to the contract
	BettingPoolTransactor // Write-only binding to the contract
	BettingPoolFilterer   // Log filterer for contract events
}

// BettingPoolCaller is an auto generated read-only Go binding around an Ethereum contract.
type BettingPoolCaller struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// BettingPoolTransactor is an auto generated write-only Go binding around an Ethereum contract.
type BettingPoolTransactor struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// BettingPoolFilterer is an auto generated log filtering Go binding around an Ethereum contract events.
type BettingPoolFilterer struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// BettingPoolSession is an auto generated Go binding around an Ethereum contract,
// with pre-set call and transact options.
type BettingPoolSession struct {
	Contract     *BettingPool      // Generic contract binding to set the session for
	CallOpts     bind.CallOpts     // Call options to use throughout this session
	TransactOpts bind.TransactOpts // Transaction auth options to use throughout this session
}

// BettingPoolCallerSession is an auto generated read-only Go binding around an Ethereum contract,
// with pre-set call options.
type BettingPoolCallerSession struct {
	Contract *BettingPoolCaller // Generic contract caller binding to set the session for
	CallOpts bind.CallOpts      // Call options to use throughout this session
}

// BettingPoolTransactorSession is an auto generated write-only Go binding around an Ethereum contract,
// with pre-set transact options.
type BettingPoolTransactorSession struct {
	Contract     *BettingPoolTransactor // Generic contract transactor binding to set the session for
	TransactOpts bind.TransactOpts      // Transaction auth options to use throughout this session
}

// BettingPoolRaw is an auto generated low-level Go binding around an Ethereum contract.
type BettingPoolRaw struct {
	Contract *BettingPool // Generic contract binding to access the raw methods on
}

// BettingPoolCallerRaw is an auto generated low-level read-only Go binding around an Ethereum contract.
type BettingPoolCallerRaw struct {
	Contract *BettingPoolCaller // Generic read-only contract binding to access the raw methods on
}

// BettingPoolTransactorRaw is an auto generated low-level write-only Go binding around an Ethereum contract.
type BettingPoolTransactorRaw struct {
	Contract *BettingPoolTransactor // Generic write-only contract binding to access the raw methods on
}

// NewBettingPool creates a new instance of BettingPool, bound to a specific deployed contract.
func NewBettingPool(address common.Address, backend bind.ContractBackend) (*BettingPool, error) {
	contract, err := bindBettingPool(address, backend, backend, backend)
	if err != nil {
		return nil, err
	}
	return &BettingPool{BettingPoolCaller: BettingPoolCaller{contract: contract}, BettingPoolTransactor: BettingPoolTransactor{contract: contract}, BettingPoolFilterer: BettingPoolFilterer{contract: contract}}, nil
}

// NewBettingPoolCaller creates a new read-only instance of BettingPool, bound to a specific deployed contract.
func NewBettingPoolCaller(address common.Address, caller bind.ContractCaller) (*BettingPoolCaller, error) {
	contract, err := bindBettingPool(address, caller, nil, nil)
	if err != nil {
		return nil, err
	}
	return &BettingPoolCaller{contract: contract}, nil
}

// NewBettingPoolTransactor creates a new write-only instance of BettingPool, bound to a specific deployed contract.
func NewBettingPoolTransactor(address common.Address, transactor bind.ContractTransactor) (*BettingPoolTransactor, error) {
	contract, err := bindBettingPool(address, nil, transactor, nil)
	if err != nil {
		return nil, err
	}
	return &BettingPoolTransactor{contract: contract}, nil
}

// NewBettingPoolFilterer creates a new log filterer instance of BettingPool, bound to a specific deployed contract.
func NewBettingPoolFilterer(address common.Address, filterer bind.ContractFilterer) (*BettingPoolFilterer, error) {
	contract, err := bindBettingPool(address, nil, nil, filterer)
	if err != nil {
		return nil, err
	}
	return &BettingPoolFilterer{contract: contract}, nil
}

// bindBettingPool binds a generic wrapper to an already deployed contract.
func bindBettingPool(address common.Address, caller bind.ContractCaller, transactor bind.ContractTransactor, filterer bind.ContractFilterer) (*bind.BoundContract, error) {
	parsed, err := BettingPoolMetaData.GetAbi()
	if err != nil {
		return nil, err
	}
	return bind.NewBoundContract(address, *parsed, caller, transactor, filterer), nil
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_BettingPool *BettingPoolRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _BettingPool.Contract.BettingPoolCaller.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_BettingPool *BettingPoolRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _BettingPool.Contract.BettingPoolTransactor.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_BettingPool *BettingPoolRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _BettingPool.Contract.BettingPoolTransactor.contract.Transact(opts, method, params...)
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_BettingPool *BettingPoolCallerRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _BettingPool.Contract.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_BettingPool *BettingPoolTransactorRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _BettingPool.Contract.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_BettingPool *BettingPoolTransactorRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _BettingPool.Contract.contract.Transact(opts, method, params...)
}

// UPGRADEINTERFACEVERSION is a free data retrieval call binding the contract method 0xad3cb1cc.
//
// Solidity: function UPGRADE_INTERFACE_VERSION() view returns(string)
func (_BettingPool *BettingPoolCaller) UPGRADEINTERFACEVERSION(opts *bind.CallOpts) (string, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "UPGRADE_INTERFACE_VERSION")

	if err != nil {
		return *new(string), err
	}

	out0 := *abi.ConvertType(out[0], new(string)).(*string)

	return out0, err

}

// UPGRADEINTERFACEVERSION is a free data retrieval call binding the contract method 0xad3cb1cc.
//
// Solidity: function UPGRADE_INTERFACE_VERSION() view returns(string)
func (_BettingPool *BettingPoolSession) UPGRADEINTERFACEVERSION() (string, error) {
	return _BettingPool.Contract.UPGRADEINTERFACEVERSION(&_BettingPool.CallOpts)
}

// UPGRADEINTERFACEVERSION is a free data retrieval call binding the contract method 0xad3cb1cc.
//
// Solidity: function UPGRADE_INTERFACE_VERSION() view returns(string)
func (_BettingPool *BettingPoolCallerSession) UPGRADEINTERFACEVERSION() (string, error) {
	return _BettingPool.Contract.UPGRADEINTERFACEVERSION(&_BettingPool.CallOpts)
}

// Admin is a free data retrieval call binding the contract method 0xf851a440.
//
// Solidity: function admin() view returns(address)
func (_BettingPool *BettingPoolCaller) Admin(opts *bind.CallOpts) (common.Address, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "admin")

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// Admin is a free data retrieval call binding the contract method 0xf851a440.
//
// Solidity: function admin() view returns(address)
func (_BettingPool *BettingPoolSession) Admin() (common.Address, error) {
	return _BettingPool.Contract.Admin(&_BettingPool.CallOpts)
}

// Admin is a free data retrieval call binding the contract method 0xf851a440.
//
// Solidity: function admin() view returns(address)
func (_BettingPool *BettingPoolCallerSession) Admin() (common.Address, error) {
	return _BettingPool.Contract.Admin(&_BettingPool.CallOpts)
}

// Bets is a free data retrieval call binding the contract method 0xc902c3ae.
//
// Solidity: function bets(bytes32 ) view returns(address user, uint256 amount, bytes32 matchId, uint8 market, uint8 outcome, uint8 line, uint256 lockedOdds, uint8 status, bool isCredit, bytes32 collateralBetId, bool isParlay, bytes32 parlayId)
func (_BettingPool *BettingPoolCaller) Bets(opts *bind.CallOpts, arg0 [32]byte) (struct {
	User            common.Address
	Amount          *big.Int
	MatchId         [32]byte
	Market          uint8
	Outcome         uint8
	Line            uint8
	LockedOdds      *big.Int
	Status          uint8
	IsCredit        bool
	CollateralBetId [32]byte
	IsParlay        bool
	ParlayId        [32]byte
}, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "bets", arg0)

	outstruct := new(struct {
		User            common.Address
		Amount          *big.Int
		MatchId         [32]byte
		Market          uint8
		Outcome         uint8
		Line            uint8
		LockedOdds      *big.Int
		Status          uint8
		IsCredit        bool
		CollateralBetId [32]byte
		IsParlay        bool
		ParlayId        [32]byte
	})
	if err != nil {
		return *outstruct, err
	}

	outstruct.User = *abi.ConvertType(out[0], new(common.Address)).(*common.Address)
	outstruct.Amount = *abi.ConvertType(out[1], new(*big.Int)).(**big.Int)
	outstruct.MatchId = *abi.ConvertType(out[2], new([32]byte)).(*[32]byte)
	outstruct.Market = *abi.ConvertType(out[3], new(uint8)).(*uint8)
	outstruct.Outcome = *abi.ConvertType(out[4], new(uint8)).(*uint8)
	outstruct.Line = *abi.ConvertType(out[5], new(uint8)).(*uint8)
	outstruct.LockedOdds = *abi.ConvertType(out[6], new(*big.Int)).(**big.Int)
	outstruct.Status = *abi.ConvertType(out[7], new(uint8)).(*uint8)
	outstruct.IsCredit = *abi.ConvertType(out[8], new(bool)).(*bool)
	outstruct.CollateralBetId = *abi.ConvertType(out[9], new([32]byte)).(*[32]byte)
	outstruct.IsParlay = *abi.ConvertType(out[10], new(bool)).(*bool)
	outstruct.ParlayId = *abi.ConvertType(out[11], new([32]byte)).(*[32]byte)

	return *outstruct, err

}

// Bets is a free data retrieval call binding the contract method 0xc902c3ae.
//
// Solidity: function bets(bytes32 ) view returns(address user, uint256 amount, bytes32 matchId, uint8 market, uint8 outcome, uint8 line, uint256 lockedOdds, uint8 status, bool isCredit, bytes32 collateralBetId, bool isParlay, bytes32 parlayId)
func (_BettingPool *BettingPoolSession) Bets(arg0 [32]byte) (struct {
	User            common.Address
	Amount          *big.Int
	MatchId         [32]byte
	Market          uint8
	Outcome         uint8
	Line            uint8
	LockedOdds      *big.Int
	Status          uint8
	IsCredit        bool
	CollateralBetId [32]byte
	IsParlay        bool
	ParlayId        [32]byte
}, error) {
	return _BettingPool.Contract.Bets(&_BettingPool.CallOpts, arg0)
}

// Bets is a free data retrieval call binding the contract method 0xc902c3ae.
//
// Solidity: function bets(bytes32 ) view returns(address user, uint256 amount, bytes32 matchId, uint8 market, uint8 outcome, uint8 line, uint256 lockedOdds, uint8 status, bool isCredit, bytes32 collateralBetId, bool isParlay, bytes32 parlayId)
func (_BettingPool *BettingPoolCallerSession) Bets(arg0 [32]byte) (struct {
	User            common.Address
	Amount          *big.Int
	MatchId         [32]byte
	Market          uint8
	Outcome         uint8
	Line            uint8
	LockedOdds      *big.Int
	Status          uint8
	IsCredit        bool
	CollateralBetId [32]byte
	IsParlay        bool
	ParlayId        [32]byte
}, error) {
	return _BettingPool.Contract.Bets(&_BettingPool.CallOpts, arg0)
}

// BettingPool is a free data retrieval call binding the contract method 0xa55e7756.
//
// Solidity: function bettingPool() view returns(uint256)
func (_BettingPool *BettingPoolCaller) BettingPool(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "bettingPool")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// BettingPool is a free data retrieval call binding the contract method 0xa55e7756.
//
// Solidity: function bettingPool() view returns(uint256)
func (_BettingPool *BettingPoolSession) BettingPool() (*big.Int, error) {
	return _BettingPool.Contract.BettingPool(&_BettingPool.CallOpts)
}

// BettingPool is a free data retrieval call binding the contract method 0xa55e7756.
//
// Solidity: function bettingPool() view returns(uint256)
func (_BettingPool *BettingPoolCallerSession) BettingPool() (*big.Int, error) {
	return _BettingPool.Contract.BettingPool(&_BettingPool.CallOpts)
}

// CollateralUsed is a free data retrieval call binding the contract method 0x903e8ef8.
//
// Solidity: function collateralUsed(bytes32 ) view returns(uint256)
func (_BettingPool *BettingPoolCaller) CollateralUsed(opts *bind.CallOpts, arg0 [32]byte) (*big.Int, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "collateralUsed", arg0)

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// CollateralUsed is a free data retrieval call binding the contract method 0x903e8ef8.
//
// Solidity: function collateralUsed(bytes32 ) view returns(uint256)
func (_BettingPool *BettingPoolSession) CollateralUsed(arg0 [32]byte) (*big.Int, error) {
	return _BettingPool.Contract.CollateralUsed(&_BettingPool.CallOpts, arg0)
}

// CollateralUsed is a free data retrieval call binding the contract method 0x903e8ef8.
//
// Solidity: function collateralUsed(bytes32 ) view returns(uint256)
func (_BettingPool *BettingPoolCallerSession) CollateralUsed(arg0 [32]byte) (*big.Int, error) {
	return _BettingPool.Contract.CollateralUsed(&_BettingPool.CallOpts, arg0)
}

// FrozenPayouts is a free data retrieval call binding the contract method 0x241e3013.
//
// Solidity: function frozenPayouts(bytes32 ) view returns(uint256)
func (_BettingPool *BettingPoolCaller) FrozenPayouts(opts *bind.CallOpts, arg0 [32]byte) (*big.Int, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "frozenPayouts", arg0)

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// FrozenPayouts is a free data retrieval call binding the contract method 0x241e3013.
//
// Solidity: function frozenPayouts(bytes32 ) view returns(uint256)
func (_BettingPool *BettingPoolSession) FrozenPayouts(arg0 [32]byte) (*big.Int, error) {
	return _BettingPool.Contract.FrozenPayouts(&_BettingPool.CallOpts, arg0)
}

// FrozenPayouts is a free data retrieval call binding the contract method 0x241e3013.
//
// Solidity: function frozenPayouts(bytes32 ) view returns(uint256)
func (_BettingPool *BettingPoolCallerSession) FrozenPayouts(arg0 [32]byte) (*big.Int, error) {
	return _BettingPool.Contract.FrozenPayouts(&_BettingPool.CallOpts, arg0)
}

// GetParlayLegs is a free data retrieval call binding the contract method 0x73323cb3.
//
// Solidity: function getParlayLegs(bytes32 parlayId) view returns(bytes32[])
func (_BettingPool *BettingPoolCaller) GetParlayLegs(opts *bind.CallOpts, parlayId [32]byte) ([][32]byte, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "getParlayLegs", parlayId)

	if err != nil {
		return *new([][32]byte), err
	}

	out0 := *abi.ConvertType(out[0], new([][32]byte)).(*[][32]byte)

	return out0, err

}

// GetParlayLegs is a free data retrieval call binding the contract method 0x73323cb3.
//
// Solidity: function getParlayLegs(bytes32 parlayId) view returns(bytes32[])
func (_BettingPool *BettingPoolSession) GetParlayLegs(parlayId [32]byte) ([][32]byte, error) {
	return _BettingPool.Contract.GetParlayLegs(&_BettingPool.CallOpts, parlayId)
}

// GetParlayLegs is a free data retrieval call binding the contract method 0x73323cb3.
//
// Solidity: function getParlayLegs(bytes32 parlayId) view returns(bytes32[])
func (_BettingPool *BettingPoolCallerSession) GetParlayLegs(parlayId [32]byte) ([][32]byte, error) {
	return _BettingPool.Contract.GetParlayLegs(&_BettingPool.CallOpts, parlayId)
}

// IsAccepting is a free data retrieval call binding the contract method 0x9cf70204.
//
// Solidity: function isAccepting(bytes32 matchId, uint8 market, uint8 line, uint8 outcome) view returns(bool)
func (_BettingPool *BettingPoolCaller) IsAccepting(opts *bind.CallOpts, matchId [32]byte, market uint8, line uint8, outcome uint8) (bool, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "isAccepting", matchId, market, line, outcome)

	if err != nil {
		return *new(bool), err
	}

	out0 := *abi.ConvertType(out[0], new(bool)).(*bool)

	return out0, err

}

// IsAccepting is a free data retrieval call binding the contract method 0x9cf70204.
//
// Solidity: function isAccepting(bytes32 matchId, uint8 market, uint8 line, uint8 outcome) view returns(bool)
func (_BettingPool *BettingPoolSession) IsAccepting(matchId [32]byte, market uint8, line uint8, outcome uint8) (bool, error) {
	return _BettingPool.Contract.IsAccepting(&_BettingPool.CallOpts, matchId, market, line, outcome)
}

// IsAccepting is a free data retrieval call binding the contract method 0x9cf70204.
//
// Solidity: function isAccepting(bytes32 matchId, uint8 market, uint8 line, uint8 outcome) view returns(bool)
func (_BettingPool *BettingPoolCallerSession) IsAccepting(matchId [32]byte, market uint8, line uint8, outcome uint8) (bool, error) {
	return _BettingPool.Contract.IsAccepting(&_BettingPool.CallOpts, matchId, market, line, outcome)
}

// LockedBalances is a free data retrieval call binding the contract method 0x0483a7f6.
//
// Solidity: function lockedBalances(address ) view returns(uint256)
func (_BettingPool *BettingPoolCaller) LockedBalances(opts *bind.CallOpts, arg0 common.Address) (*big.Int, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "lockedBalances", arg0)

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// LockedBalances is a free data retrieval call binding the contract method 0x0483a7f6.
//
// Solidity: function lockedBalances(address ) view returns(uint256)
func (_BettingPool *BettingPoolSession) LockedBalances(arg0 common.Address) (*big.Int, error) {
	return _BettingPool.Contract.LockedBalances(&_BettingPool.CallOpts, arg0)
}

// LockedBalances is a free data retrieval call binding the contract method 0x0483a7f6.
//
// Solidity: function lockedBalances(address ) view returns(uint256)
func (_BettingPool *BettingPoolCallerSession) LockedBalances(arg0 common.Address) (*big.Int, error) {
	return _BettingPool.Contract.LockedBalances(&_BettingPool.CallOpts, arg0)
}

// LpShareBps is a free data retrieval call binding the contract method 0x4c7ac03f.
//
// Solidity: function lpShareBps() view returns(uint256)
func (_BettingPool *BettingPoolCaller) LpShareBps(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "lpShareBps")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// LpShareBps is a free data retrieval call binding the contract method 0x4c7ac03f.
//
// Solidity: function lpShareBps() view returns(uint256)
func (_BettingPool *BettingPoolSession) LpShareBps() (*big.Int, error) {
	return _BettingPool.Contract.LpShareBps(&_BettingPool.CallOpts)
}

// LpShareBps is a free data retrieval call binding the contract method 0x4c7ac03f.
//
// Solidity: function lpShareBps() view returns(uint256)
func (_BettingPool *BettingPoolCallerSession) LpShareBps() (*big.Int, error) {
	return _BettingPool.Contract.LpShareBps(&_BettingPool.CallOpts)
}

// LpShares is a free data retrieval call binding the contract method 0xc109a6dc.
//
// Solidity: function lpShares(address ) view returns(uint256)
func (_BettingPool *BettingPoolCaller) LpShares(opts *bind.CallOpts, arg0 common.Address) (*big.Int, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "lpShares", arg0)

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// LpShares is a free data retrieval call binding the contract method 0xc109a6dc.
//
// Solidity: function lpShares(address ) view returns(uint256)
func (_BettingPool *BettingPoolSession) LpShares(arg0 common.Address) (*big.Int, error) {
	return _BettingPool.Contract.LpShares(&_BettingPool.CallOpts, arg0)
}

// LpShares is a free data retrieval call binding the contract method 0xc109a6dc.
//
// Solidity: function lpShares(address ) view returns(uint256)
func (_BettingPool *BettingPoolCallerSession) LpShares(arg0 common.Address) (*big.Int, error) {
	return _BettingPool.Contract.LpShares(&_BettingPool.CallOpts, arg0)
}

// MarketOutcome is a free data retrieval call binding the contract method 0xce1f4567.
//
// Solidity: function marketOutcome(bytes32 ) view returns(uint8)
func (_BettingPool *BettingPoolCaller) MarketOutcome(opts *bind.CallOpts, arg0 [32]byte) (uint8, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "marketOutcome", arg0)

	if err != nil {
		return *new(uint8), err
	}

	out0 := *abi.ConvertType(out[0], new(uint8)).(*uint8)

	return out0, err

}

// MarketOutcome is a free data retrieval call binding the contract method 0xce1f4567.
//
// Solidity: function marketOutcome(bytes32 ) view returns(uint8)
func (_BettingPool *BettingPoolSession) MarketOutcome(arg0 [32]byte) (uint8, error) {
	return _BettingPool.Contract.MarketOutcome(&_BettingPool.CallOpts, arg0)
}

// MarketOutcome is a free data retrieval call binding the contract method 0xce1f4567.
//
// Solidity: function marketOutcome(bytes32 ) view returns(uint8)
func (_BettingPool *BettingPoolCallerSession) MarketOutcome(arg0 [32]byte) (uint8, error) {
	return _BettingPool.Contract.MarketOutcome(&_BettingPool.CallOpts, arg0)
}

// MarketStatus is a free data retrieval call binding the contract method 0xccf04659.
//
// Solidity: function marketStatus(bytes32 ) view returns(uint8)
func (_BettingPool *BettingPoolCaller) MarketStatus(opts *bind.CallOpts, arg0 [32]byte) (uint8, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "marketStatus", arg0)

	if err != nil {
		return *new(uint8), err
	}

	out0 := *abi.ConvertType(out[0], new(uint8)).(*uint8)

	return out0, err

}

// MarketStatus is a free data retrieval call binding the contract method 0xccf04659.
//
// Solidity: function marketStatus(bytes32 ) view returns(uint8)
func (_BettingPool *BettingPoolSession) MarketStatus(arg0 [32]byte) (uint8, error) {
	return _BettingPool.Contract.MarketStatus(&_BettingPool.CallOpts, arg0)
}

// MarketStatus is a free data retrieval call binding the contract method 0xccf04659.
//
// Solidity: function marketStatus(bytes32 ) view returns(uint8)
func (_BettingPool *BettingPoolCallerSession) MarketStatus(arg0 [32]byte) (uint8, error) {
	return _BettingPool.Contract.MarketStatus(&_BettingPool.CallOpts, arg0)
}

// MatchMarkets is a free data retrieval call binding the contract method 0x2a43449a.
//
// Solidity: function matchMarkets(bytes32 , uint256 ) view returns(bytes32)
func (_BettingPool *BettingPoolCaller) MatchMarkets(opts *bind.CallOpts, arg0 [32]byte, arg1 *big.Int) ([32]byte, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "matchMarkets", arg0, arg1)

	if err != nil {
		return *new([32]byte), err
	}

	out0 := *abi.ConvertType(out[0], new([32]byte)).(*[32]byte)

	return out0, err

}

// MatchMarkets is a free data retrieval call binding the contract method 0x2a43449a.
//
// Solidity: function matchMarkets(bytes32 , uint256 ) view returns(bytes32)
func (_BettingPool *BettingPoolSession) MatchMarkets(arg0 [32]byte, arg1 *big.Int) ([32]byte, error) {
	return _BettingPool.Contract.MatchMarkets(&_BettingPool.CallOpts, arg0, arg1)
}

// MatchMarkets is a free data retrieval call binding the contract method 0x2a43449a.
//
// Solidity: function matchMarkets(bytes32 , uint256 ) view returns(bytes32)
func (_BettingPool *BettingPoolCallerSession) MatchMarkets(arg0 [32]byte, arg1 *big.Int) ([32]byte, error) {
	return _BettingPool.Contract.MatchMarkets(&_BettingPool.CallOpts, arg0, arg1)
}

// MaxMarketsPerMatch is a free data retrieval call binding the contract method 0xc9b0694a.
//
// Solidity: function maxMarketsPerMatch() view returns(uint256)
func (_BettingPool *BettingPoolCaller) MaxMarketsPerMatch(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "maxMarketsPerMatch")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// MaxMarketsPerMatch is a free data retrieval call binding the contract method 0xc9b0694a.
//
// Solidity: function maxMarketsPerMatch() view returns(uint256)
func (_BettingPool *BettingPoolSession) MaxMarketsPerMatch() (*big.Int, error) {
	return _BettingPool.Contract.MaxMarketsPerMatch(&_BettingPool.CallOpts)
}

// MaxMarketsPerMatch is a free data retrieval call binding the contract method 0xc9b0694a.
//
// Solidity: function maxMarketsPerMatch() view returns(uint256)
func (_BettingPool *BettingPoolCallerSession) MaxMarketsPerMatch() (*big.Int, error) {
	return _BettingPool.Contract.MaxMarketsPerMatch(&_BettingPool.CallOpts)
}

// Multisig is a free data retrieval call binding the contract method 0x4783c35b.
//
// Solidity: function multisig() view returns(address)
func (_BettingPool *BettingPoolCaller) Multisig(opts *bind.CallOpts) (common.Address, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "multisig")

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// Multisig is a free data retrieval call binding the contract method 0x4783c35b.
//
// Solidity: function multisig() view returns(address)
func (_BettingPool *BettingPoolSession) Multisig() (common.Address, error) {
	return _BettingPool.Contract.Multisig(&_BettingPool.CallOpts)
}

// Multisig is a free data retrieval call binding the contract method 0x4783c35b.
//
// Solidity: function multisig() view returns(address)
func (_BettingPool *BettingPoolCallerSession) Multisig() (common.Address, error) {
	return _BettingPool.Contract.Multisig(&_BettingPool.CallOpts)
}

// Parlays is a free data retrieval call binding the contract method 0x7cd9cc33.
//
// Solidity: function parlays(bytes32 ) view returns(address user, uint256 stake, uint256 combinedOdds, uint256 maxPayout, uint8 status, uint8 settledLegs, uint8 wonLegs, uint8 cancelledLegs)
func (_BettingPool *BettingPoolCaller) Parlays(opts *bind.CallOpts, arg0 [32]byte) (struct {
	User          common.Address
	Stake         *big.Int
	CombinedOdds  *big.Int
	MaxPayout     *big.Int
	Status        uint8
	SettledLegs   uint8
	WonLegs       uint8
	CancelledLegs uint8
}, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "parlays", arg0)

	outstruct := new(struct {
		User          common.Address
		Stake         *big.Int
		CombinedOdds  *big.Int
		MaxPayout     *big.Int
		Status        uint8
		SettledLegs   uint8
		WonLegs       uint8
		CancelledLegs uint8
	})
	if err != nil {
		return *outstruct, err
	}

	outstruct.User = *abi.ConvertType(out[0], new(common.Address)).(*common.Address)
	outstruct.Stake = *abi.ConvertType(out[1], new(*big.Int)).(**big.Int)
	outstruct.CombinedOdds = *abi.ConvertType(out[2], new(*big.Int)).(**big.Int)
	outstruct.MaxPayout = *abi.ConvertType(out[3], new(*big.Int)).(**big.Int)
	outstruct.Status = *abi.ConvertType(out[4], new(uint8)).(*uint8)
	outstruct.SettledLegs = *abi.ConvertType(out[5], new(uint8)).(*uint8)
	outstruct.WonLegs = *abi.ConvertType(out[6], new(uint8)).(*uint8)
	outstruct.CancelledLegs = *abi.ConvertType(out[7], new(uint8)).(*uint8)

	return *outstruct, err

}

// Parlays is a free data retrieval call binding the contract method 0x7cd9cc33.
//
// Solidity: function parlays(bytes32 ) view returns(address user, uint256 stake, uint256 combinedOdds, uint256 maxPayout, uint8 status, uint8 settledLegs, uint8 wonLegs, uint8 cancelledLegs)
func (_BettingPool *BettingPoolSession) Parlays(arg0 [32]byte) (struct {
	User          common.Address
	Stake         *big.Int
	CombinedOdds  *big.Int
	MaxPayout     *big.Int
	Status        uint8
	SettledLegs   uint8
	WonLegs       uint8
	CancelledLegs uint8
}, error) {
	return _BettingPool.Contract.Parlays(&_BettingPool.CallOpts, arg0)
}

// Parlays is a free data retrieval call binding the contract method 0x7cd9cc33.
//
// Solidity: function parlays(bytes32 ) view returns(address user, uint256 stake, uint256 combinedOdds, uint256 maxPayout, uint8 status, uint8 settledLegs, uint8 wonLegs, uint8 cancelledLegs)
func (_BettingPool *BettingPoolCallerSession) Parlays(arg0 [32]byte) (struct {
	User          common.Address
	Stake         *big.Int
	CombinedOdds  *big.Int
	MaxPayout     *big.Int
	Status        uint8
	SettledLegs   uint8
	WonLegs       uint8
	CancelledLegs uint8
}, error) {
	return _BettingPool.Contract.Parlays(&_BettingPool.CallOpts, arg0)
}

// Paused is a free data retrieval call binding the contract method 0x5c975abb.
//
// Solidity: function paused() view returns(bool)
func (_BettingPool *BettingPoolCaller) Paused(opts *bind.CallOpts) (bool, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "paused")

	if err != nil {
		return *new(bool), err
	}

	out0 := *abi.ConvertType(out[0], new(bool)).(*bool)

	return out0, err

}

// Paused is a free data retrieval call binding the contract method 0x5c975abb.
//
// Solidity: function paused() view returns(bool)
func (_BettingPool *BettingPoolSession) Paused() (bool, error) {
	return _BettingPool.Contract.Paused(&_BettingPool.CallOpts)
}

// Paused is a free data retrieval call binding the contract method 0x5c975abb.
//
// Solidity: function paused() view returns(bool)
func (_BettingPool *BettingPoolCallerSession) Paused() (bool, error) {
	return _BettingPool.Contract.Paused(&_BettingPool.CallOpts)
}

// PlatformBalance is a free data retrieval call binding the contract method 0x62a5dbbc.
//
// Solidity: function platformBalance() view returns(uint256)
func (_BettingPool *BettingPoolCaller) PlatformBalance(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "platformBalance")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// PlatformBalance is a free data retrieval call binding the contract method 0x62a5dbbc.
//
// Solidity: function platformBalance() view returns(uint256)
func (_BettingPool *BettingPoolSession) PlatformBalance() (*big.Int, error) {
	return _BettingPool.Contract.PlatformBalance(&_BettingPool.CallOpts)
}

// PlatformBalance is a free data retrieval call binding the contract method 0x62a5dbbc.
//
// Solidity: function platformBalance() view returns(uint256)
func (_BettingPool *BettingPoolCallerSession) PlatformBalance() (*big.Int, error) {
	return _BettingPool.Contract.PlatformBalance(&_BettingPool.CallOpts)
}

// ProcessedDeposits is a free data retrieval call binding the contract method 0x40c5faf0.
//
// Solidity: function processedDeposits(bytes32 ) view returns(bool)
func (_BettingPool *BettingPoolCaller) ProcessedDeposits(opts *bind.CallOpts, arg0 [32]byte) (bool, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "processedDeposits", arg0)

	if err != nil {
		return *new(bool), err
	}

	out0 := *abi.ConvertType(out[0], new(bool)).(*bool)

	return out0, err

}

// ProcessedDeposits is a free data retrieval call binding the contract method 0x40c5faf0.
//
// Solidity: function processedDeposits(bytes32 ) view returns(bool)
func (_BettingPool *BettingPoolSession) ProcessedDeposits(arg0 [32]byte) (bool, error) {
	return _BettingPool.Contract.ProcessedDeposits(&_BettingPool.CallOpts, arg0)
}

// ProcessedDeposits is a free data retrieval call binding the contract method 0x40c5faf0.
//
// Solidity: function processedDeposits(bytes32 ) view returns(bool)
func (_BettingPool *BettingPoolCallerSession) ProcessedDeposits(arg0 [32]byte) (bool, error) {
	return _BettingPool.Contract.ProcessedDeposits(&_BettingPool.CallOpts, arg0)
}

// ProxiableUUID is a free data retrieval call binding the contract method 0x52d1902d.
//
// Solidity: function proxiableUUID() view returns(bytes32)
func (_BettingPool *BettingPoolCaller) ProxiableUUID(opts *bind.CallOpts) ([32]byte, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "proxiableUUID")

	if err != nil {
		return *new([32]byte), err
	}

	out0 := *abi.ConvertType(out[0], new([32]byte)).(*[32]byte)

	return out0, err

}

// ProxiableUUID is a free data retrieval call binding the contract method 0x52d1902d.
//
// Solidity: function proxiableUUID() view returns(bytes32)
func (_BettingPool *BettingPoolSession) ProxiableUUID() ([32]byte, error) {
	return _BettingPool.Contract.ProxiableUUID(&_BettingPool.CallOpts)
}

// ProxiableUUID is a free data retrieval call binding the contract method 0x52d1902d.
//
// Solidity: function proxiableUUID() view returns(bytes32)
func (_BettingPool *BettingPoolCallerSession) ProxiableUUID() ([32]byte, error) {
	return _BettingPool.Contract.ProxiableUUID(&_BettingPool.CallOpts)
}

// RedLightThreshold is a free data retrieval call binding the contract method 0x574c8ffe.
//
// Solidity: function redLightThreshold() view returns(uint256)
func (_BettingPool *BettingPoolCaller) RedLightThreshold(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "redLightThreshold")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// RedLightThreshold is a free data retrieval call binding the contract method 0x574c8ffe.
//
// Solidity: function redLightThreshold() view returns(uint256)
func (_BettingPool *BettingPoolSession) RedLightThreshold() (*big.Int, error) {
	return _BettingPool.Contract.RedLightThreshold(&_BettingPool.CallOpts)
}

// RedLightThreshold is a free data retrieval call binding the contract method 0x574c8ffe.
//
// Solidity: function redLightThreshold() view returns(uint256)
func (_BettingPool *BettingPoolCallerSession) RedLightThreshold() (*big.Int, error) {
	return _BettingPool.Contract.RedLightThreshold(&_BettingPool.CallOpts)
}

// Signals is a free data retrieval call binding the contract method 0x107494eb.
//
// Solidity: function signals(bytes32 ) view returns(uint256 heavyAmount, uint8 heavySide, uint8 color)
func (_BettingPool *BettingPoolCaller) Signals(opts *bind.CallOpts, arg0 [32]byte) (struct {
	HeavyAmount *big.Int
	HeavySide   uint8
	Color       uint8
}, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "signals", arg0)

	outstruct := new(struct {
		HeavyAmount *big.Int
		HeavySide   uint8
		Color       uint8
	})
	if err != nil {
		return *outstruct, err
	}

	outstruct.HeavyAmount = *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)
	outstruct.HeavySide = *abi.ConvertType(out[1], new(uint8)).(*uint8)
	outstruct.Color = *abi.ConvertType(out[2], new(uint8)).(*uint8)

	return *outstruct, err

}

// Signals is a free data retrieval call binding the contract method 0x107494eb.
//
// Solidity: function signals(bytes32 ) view returns(uint256 heavyAmount, uint8 heavySide, uint8 color)
func (_BettingPool *BettingPoolSession) Signals(arg0 [32]byte) (struct {
	HeavyAmount *big.Int
	HeavySide   uint8
	Color       uint8
}, error) {
	return _BettingPool.Contract.Signals(&_BettingPool.CallOpts, arg0)
}

// Signals is a free data retrieval call binding the contract method 0x107494eb.
//
// Solidity: function signals(bytes32 ) view returns(uint256 heavyAmount, uint8 heavySide, uint8 color)
func (_BettingPool *BettingPoolCallerSession) Signals(arg0 [32]byte) (struct {
	HeavyAmount *big.Int
	HeavySide   uint8
	Color       uint8
}, error) {
	return _BettingPool.Contract.Signals(&_BettingPool.CallOpts, arg0)
}

// TotalCreditOutstanding is a free data retrieval call binding the contract method 0xe6cec23c.
//
// Solidity: function totalCreditOutstanding() view returns(uint256)
func (_BettingPool *BettingPoolCaller) TotalCreditOutstanding(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "totalCreditOutstanding")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// TotalCreditOutstanding is a free data retrieval call binding the contract method 0xe6cec23c.
//
// Solidity: function totalCreditOutstanding() view returns(uint256)
func (_BettingPool *BettingPoolSession) TotalCreditOutstanding() (*big.Int, error) {
	return _BettingPool.Contract.TotalCreditOutstanding(&_BettingPool.CallOpts)
}

// TotalCreditOutstanding is a free data retrieval call binding the contract method 0xe6cec23c.
//
// Solidity: function totalCreditOutstanding() view returns(uint256)
func (_BettingPool *BettingPoolCallerSession) TotalCreditOutstanding() (*big.Int, error) {
	return _BettingPool.Contract.TotalCreditOutstanding(&_BettingPool.CallOpts)
}

// TotalFrozenPayouts is a free data retrieval call binding the contract method 0xea9e838b.
//
// Solidity: function totalFrozenPayouts() view returns(uint256)
func (_BettingPool *BettingPoolCaller) TotalFrozenPayouts(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "totalFrozenPayouts")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// TotalFrozenPayouts is a free data retrieval call binding the contract method 0xea9e838b.
//
// Solidity: function totalFrozenPayouts() view returns(uint256)
func (_BettingPool *BettingPoolSession) TotalFrozenPayouts() (*big.Int, error) {
	return _BettingPool.Contract.TotalFrozenPayouts(&_BettingPool.CallOpts)
}

// TotalFrozenPayouts is a free data retrieval call binding the contract method 0xea9e838b.
//
// Solidity: function totalFrozenPayouts() view returns(uint256)
func (_BettingPool *BettingPoolCallerSession) TotalFrozenPayouts() (*big.Int, error) {
	return _BettingPool.Contract.TotalFrozenPayouts(&_BettingPool.CallOpts)
}

// TotalLpShares is a free data retrieval call binding the contract method 0x0fd4f78d.
//
// Solidity: function totalLpShares() view returns(uint256)
func (_BettingPool *BettingPoolCaller) TotalLpShares(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "totalLpShares")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// TotalLpShares is a free data retrieval call binding the contract method 0x0fd4f78d.
//
// Solidity: function totalLpShares() view returns(uint256)
func (_BettingPool *BettingPoolSession) TotalLpShares() (*big.Int, error) {
	return _BettingPool.Contract.TotalLpShares(&_BettingPool.CallOpts)
}

// TotalLpShares is a free data retrieval call binding the contract method 0x0fd4f78d.
//
// Solidity: function totalLpShares() view returns(uint256)
func (_BettingPool *BettingPoolCallerSession) TotalLpShares() (*big.Int, error) {
	return _BettingPool.Contract.TotalLpShares(&_BettingPool.CallOpts)
}

// TotalPendingWithdrawals is a free data retrieval call binding the contract method 0xa4563e03.
//
// Solidity: function totalPendingWithdrawals() view returns(uint256)
func (_BettingPool *BettingPoolCaller) TotalPendingWithdrawals(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "totalPendingWithdrawals")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// TotalPendingWithdrawals is a free data retrieval call binding the contract method 0xa4563e03.
//
// Solidity: function totalPendingWithdrawals() view returns(uint256)
func (_BettingPool *BettingPoolSession) TotalPendingWithdrawals() (*big.Int, error) {
	return _BettingPool.Contract.TotalPendingWithdrawals(&_BettingPool.CallOpts)
}

// TotalPendingWithdrawals is a free data retrieval call binding the contract method 0xa4563e03.
//
// Solidity: function totalPendingWithdrawals() view returns(uint256)
func (_BettingPool *BettingPoolCallerSession) TotalPendingWithdrawals() (*big.Int, error) {
	return _BettingPool.Contract.TotalPendingWithdrawals(&_BettingPool.CallOpts)
}

// TotalPotentialPayout is a free data retrieval call binding the contract method 0x4cf0d920.
//
// Solidity: function totalPotentialPayout() view returns(uint256)
func (_BettingPool *BettingPoolCaller) TotalPotentialPayout(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "totalPotentialPayout")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// TotalPotentialPayout is a free data retrieval call binding the contract method 0x4cf0d920.
//
// Solidity: function totalPotentialPayout() view returns(uint256)
func (_BettingPool *BettingPoolSession) TotalPotentialPayout() (*big.Int, error) {
	return _BettingPool.Contract.TotalPotentialPayout(&_BettingPool.CallOpts)
}

// TotalPotentialPayout is a free data retrieval call binding the contract method 0x4cf0d920.
//
// Solidity: function totalPotentialPayout() view returns(uint256)
func (_BettingPool *BettingPoolCallerSession) TotalPotentialPayout() (*big.Int, error) {
	return _BettingPool.Contract.TotalPotentialPayout(&_BettingPool.CallOpts)
}

// TotalUserBalances is a free data retrieval call binding the contract method 0x74a6d16e.
//
// Solidity: function totalUserBalances() view returns(uint256)
func (_BettingPool *BettingPoolCaller) TotalUserBalances(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "totalUserBalances")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// TotalUserBalances is a free data retrieval call binding the contract method 0x74a6d16e.
//
// Solidity: function totalUserBalances() view returns(uint256)
func (_BettingPool *BettingPoolSession) TotalUserBalances() (*big.Int, error) {
	return _BettingPool.Contract.TotalUserBalances(&_BettingPool.CallOpts)
}

// TotalUserBalances is a free data retrieval call binding the contract method 0x74a6d16e.
//
// Solidity: function totalUserBalances() view returns(uint256)
func (_BettingPool *BettingPoolCallerSession) TotalUserBalances() (*big.Int, error) {
	return _BettingPool.Contract.TotalUserBalances(&_BettingPool.CallOpts)
}

// Usdt is a free data retrieval call binding the contract method 0x2f48ab7d.
//
// Solidity: function usdt() view returns(address)
func (_BettingPool *BettingPoolCaller) Usdt(opts *bind.CallOpts) (common.Address, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "usdt")

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// Usdt is a free data retrieval call binding the contract method 0x2f48ab7d.
//
// Solidity: function usdt() view returns(address)
func (_BettingPool *BettingPoolSession) Usdt() (common.Address, error) {
	return _BettingPool.Contract.Usdt(&_BettingPool.CallOpts)
}

// Usdt is a free data retrieval call binding the contract method 0x2f48ab7d.
//
// Solidity: function usdt() view returns(address)
func (_BettingPool *BettingPoolCallerSession) Usdt() (common.Address, error) {
	return _BettingPool.Contract.Usdt(&_BettingPool.CallOpts)
}

// UserBalances is a free data retrieval call binding the contract method 0x26224c64.
//
// Solidity: function userBalances(address ) view returns(uint256)
func (_BettingPool *BettingPoolCaller) UserBalances(opts *bind.CallOpts, arg0 common.Address) (*big.Int, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "userBalances", arg0)

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// UserBalances is a free data retrieval call binding the contract method 0x26224c64.
//
// Solidity: function userBalances(address ) view returns(uint256)
func (_BettingPool *BettingPoolSession) UserBalances(arg0 common.Address) (*big.Int, error) {
	return _BettingPool.Contract.UserBalances(&_BettingPool.CallOpts, arg0)
}

// UserBalances is a free data retrieval call binding the contract method 0x26224c64.
//
// Solidity: function userBalances(address ) view returns(uint256)
func (_BettingPool *BettingPoolCallerSession) UserBalances(arg0 common.Address) (*big.Int, error) {
	return _BettingPool.Contract.UserBalances(&_BettingPool.CallOpts, arg0)
}

// WithdrawalNonce is a free data retrieval call binding the contract method 0x7b259db4.
//
// Solidity: function withdrawalNonce() view returns(uint256)
func (_BettingPool *BettingPoolCaller) WithdrawalNonce(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "withdrawalNonce")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// WithdrawalNonce is a free data retrieval call binding the contract method 0x7b259db4.
//
// Solidity: function withdrawalNonce() view returns(uint256)
func (_BettingPool *BettingPoolSession) WithdrawalNonce() (*big.Int, error) {
	return _BettingPool.Contract.WithdrawalNonce(&_BettingPool.CallOpts)
}

// WithdrawalNonce is a free data retrieval call binding the contract method 0x7b259db4.
//
// Solidity: function withdrawalNonce() view returns(uint256)
func (_BettingPool *BettingPoolCallerSession) WithdrawalNonce() (*big.Int, error) {
	return _BettingPool.Contract.WithdrawalNonce(&_BettingPool.CallOpts)
}

// WithdrawalRequests is a free data retrieval call binding the contract method 0x124b82a5.
//
// Solidity: function withdrawalRequests(bytes32 ) view returns(address user, uint256 amount, uint256 requestTime, bool executed, bool rejected)
func (_BettingPool *BettingPoolCaller) WithdrawalRequests(opts *bind.CallOpts, arg0 [32]byte) (struct {
	User        common.Address
	Amount      *big.Int
	RequestTime *big.Int
	Executed    bool
	Rejected    bool
}, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "withdrawalRequests", arg0)

	outstruct := new(struct {
		User        common.Address
		Amount      *big.Int
		RequestTime *big.Int
		Executed    bool
		Rejected    bool
	})
	if err != nil {
		return *outstruct, err
	}

	outstruct.User = *abi.ConvertType(out[0], new(common.Address)).(*common.Address)
	outstruct.Amount = *abi.ConvertType(out[1], new(*big.Int)).(**big.Int)
	outstruct.RequestTime = *abi.ConvertType(out[2], new(*big.Int)).(**big.Int)
	outstruct.Executed = *abi.ConvertType(out[3], new(bool)).(*bool)
	outstruct.Rejected = *abi.ConvertType(out[4], new(bool)).(*bool)

	return *outstruct, err

}

// WithdrawalRequests is a free data retrieval call binding the contract method 0x124b82a5.
//
// Solidity: function withdrawalRequests(bytes32 ) view returns(address user, uint256 amount, uint256 requestTime, bool executed, bool rejected)
func (_BettingPool *BettingPoolSession) WithdrawalRequests(arg0 [32]byte) (struct {
	User        common.Address
	Amount      *big.Int
	RequestTime *big.Int
	Executed    bool
	Rejected    bool
}, error) {
	return _BettingPool.Contract.WithdrawalRequests(&_BettingPool.CallOpts, arg0)
}

// WithdrawalRequests is a free data retrieval call binding the contract method 0x124b82a5.
//
// Solidity: function withdrawalRequests(bytes32 ) view returns(address user, uint256 amount, uint256 requestTime, bool executed, bool rejected)
func (_BettingPool *BettingPoolCallerSession) WithdrawalRequests(arg0 [32]byte) (struct {
	User        common.Address
	Amount      *big.Int
	RequestTime *big.Int
	Executed    bool
	Rejected    bool
}, error) {
	return _BettingPool.Contract.WithdrawalRequests(&_BettingPool.CallOpts, arg0)
}

// AddLiquidity is a paid mutator transaction binding the contract method 0x51c6590a.
//
// Solidity: function addLiquidity(uint256 amount) returns()
func (_BettingPool *BettingPoolTransactor) AddLiquidity(opts *bind.TransactOpts, amount *big.Int) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "addLiquidity", amount)
}

// AddLiquidity is a paid mutator transaction binding the contract method 0x51c6590a.
//
// Solidity: function addLiquidity(uint256 amount) returns()
func (_BettingPool *BettingPoolSession) AddLiquidity(amount *big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.AddLiquidity(&_BettingPool.TransactOpts, amount)
}

// AddLiquidity is a paid mutator transaction binding the contract method 0x51c6590a.
//
// Solidity: function addLiquidity(uint256 amount) returns()
func (_BettingPool *BettingPoolTransactorSession) AddLiquidity(amount *big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.AddLiquidity(&_BettingPool.TransactOpts, amount)
}

// BatchCancelMatch is a paid mutator transaction binding the contract method 0xe995168a.
//
// Solidity: function batchCancelMatch(bytes32 matchId, uint8[] markets, uint8[] lines, bytes32[][] betIdsByMarket) returns()
func (_BettingPool *BettingPoolTransactor) BatchCancelMatch(opts *bind.TransactOpts, matchId [32]byte, markets []uint8, lines []uint8, betIdsByMarket [][][32]byte) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "batchCancelMatch", matchId, markets, lines, betIdsByMarket)
}

// BatchCancelMatch is a paid mutator transaction binding the contract method 0xe995168a.
//
// Solidity: function batchCancelMatch(bytes32 matchId, uint8[] markets, uint8[] lines, bytes32[][] betIdsByMarket) returns()
func (_BettingPool *BettingPoolSession) BatchCancelMatch(matchId [32]byte, markets []uint8, lines []uint8, betIdsByMarket [][][32]byte) (*types.Transaction, error) {
	return _BettingPool.Contract.BatchCancelMatch(&_BettingPool.TransactOpts, matchId, markets, lines, betIdsByMarket)
}

// BatchCancelMatch is a paid mutator transaction binding the contract method 0xe995168a.
//
// Solidity: function batchCancelMatch(bytes32 matchId, uint8[] markets, uint8[] lines, bytes32[][] betIdsByMarket) returns()
func (_BettingPool *BettingPoolTransactorSession) BatchCancelMatch(matchId [32]byte, markets []uint8, lines []uint8, betIdsByMarket [][][32]byte) (*types.Transaction, error) {
	return _BettingPool.Contract.BatchCancelMatch(&_BettingPool.TransactOpts, matchId, markets, lines, betIdsByMarket)
}

// BatchCloseMarkets is a paid mutator transaction binding the contract method 0x0eb76275.
//
// Solidity: function batchCloseMarkets(bytes32 matchId, uint8[] markets, uint8[] lines) returns()
func (_BettingPool *BettingPoolTransactor) BatchCloseMarkets(opts *bind.TransactOpts, matchId [32]byte, markets []uint8, lines []uint8) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "batchCloseMarkets", matchId, markets, lines)
}

// BatchCloseMarkets is a paid mutator transaction binding the contract method 0x0eb76275.
//
// Solidity: function batchCloseMarkets(bytes32 matchId, uint8[] markets, uint8[] lines) returns()
func (_BettingPool *BettingPoolSession) BatchCloseMarkets(matchId [32]byte, markets []uint8, lines []uint8) (*types.Transaction, error) {
	return _BettingPool.Contract.BatchCloseMarkets(&_BettingPool.TransactOpts, matchId, markets, lines)
}

// BatchCloseMarkets is a paid mutator transaction binding the contract method 0x0eb76275.
//
// Solidity: function batchCloseMarkets(bytes32 matchId, uint8[] markets, uint8[] lines) returns()
func (_BettingPool *BettingPoolTransactorSession) BatchCloseMarkets(matchId [32]byte, markets []uint8, lines []uint8) (*types.Transaction, error) {
	return _BettingPool.Contract.BatchCloseMarkets(&_BettingPool.TransactOpts, matchId, markets, lines)
}

// BatchOpenMarkets is a paid mutator transaction binding the contract method 0x783bb1cc.
//
// Solidity: function batchOpenMarkets(bytes32 matchId, uint8[] markets, uint8[] lines) returns()
func (_BettingPool *BettingPoolTransactor) BatchOpenMarkets(opts *bind.TransactOpts, matchId [32]byte, markets []uint8, lines []uint8) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "batchOpenMarkets", matchId, markets, lines)
}

// BatchOpenMarkets is a paid mutator transaction binding the contract method 0x783bb1cc.
//
// Solidity: function batchOpenMarkets(bytes32 matchId, uint8[] markets, uint8[] lines) returns()
func (_BettingPool *BettingPoolSession) BatchOpenMarkets(matchId [32]byte, markets []uint8, lines []uint8) (*types.Transaction, error) {
	return _BettingPool.Contract.BatchOpenMarkets(&_BettingPool.TransactOpts, matchId, markets, lines)
}

// BatchOpenMarkets is a paid mutator transaction binding the contract method 0x783bb1cc.
//
// Solidity: function batchOpenMarkets(bytes32 matchId, uint8[] markets, uint8[] lines) returns()
func (_BettingPool *BettingPoolTransactorSession) BatchOpenMarkets(matchId [32]byte, markets []uint8, lines []uint8) (*types.Transaction, error) {
	return _BettingPool.Contract.BatchOpenMarkets(&_BettingPool.TransactOpts, matchId, markets, lines)
}

// CancelMatch is a paid mutator transaction binding the contract method 0xf1c9c609.
//
// Solidity: function cancelMatch(bytes32 matchId, uint8 market, uint8 line, bytes32[] betIds) returns()
func (_BettingPool *BettingPoolTransactor) CancelMatch(opts *bind.TransactOpts, matchId [32]byte, market uint8, line uint8, betIds [][32]byte) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "cancelMatch", matchId, market, line, betIds)
}

// CancelMatch is a paid mutator transaction binding the contract method 0xf1c9c609.
//
// Solidity: function cancelMatch(bytes32 matchId, uint8 market, uint8 line, bytes32[] betIds) returns()
func (_BettingPool *BettingPoolSession) CancelMatch(matchId [32]byte, market uint8, line uint8, betIds [][32]byte) (*types.Transaction, error) {
	return _BettingPool.Contract.CancelMatch(&_BettingPool.TransactOpts, matchId, market, line, betIds)
}

// CancelMatch is a paid mutator transaction binding the contract method 0xf1c9c609.
//
// Solidity: function cancelMatch(bytes32 matchId, uint8 market, uint8 line, bytes32[] betIds) returns()
func (_BettingPool *BettingPoolTransactorSession) CancelMatch(matchId [32]byte, market uint8, line uint8, betIds [][32]byte) (*types.Transaction, error) {
	return _BettingPool.Contract.CancelMatch(&_BettingPool.TransactOpts, matchId, market, line, betIds)
}

// CloseMarket is a paid mutator transaction binding the contract method 0x5811d4cc.
//
// Solidity: function closeMarket(bytes32 matchId, uint8 market, uint8 line) returns()
func (_BettingPool *BettingPoolTransactor) CloseMarket(opts *bind.TransactOpts, matchId [32]byte, market uint8, line uint8) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "closeMarket", matchId, market, line)
}

// CloseMarket is a paid mutator transaction binding the contract method 0x5811d4cc.
//
// Solidity: function closeMarket(bytes32 matchId, uint8 market, uint8 line) returns()
func (_BettingPool *BettingPoolSession) CloseMarket(matchId [32]byte, market uint8, line uint8) (*types.Transaction, error) {
	return _BettingPool.Contract.CloseMarket(&_BettingPool.TransactOpts, matchId, market, line)
}

// CloseMarket is a paid mutator transaction binding the contract method 0x5811d4cc.
//
// Solidity: function closeMarket(bytes32 matchId, uint8 market, uint8 line) returns()
func (_BettingPool *BettingPoolTransactorSession) CloseMarket(matchId [32]byte, market uint8, line uint8) (*types.Transaction, error) {
	return _BettingPool.Contract.CloseMarket(&_BettingPool.TransactOpts, matchId, market, line)
}

// CreditDeposit is a paid mutator transaction binding the contract method 0x1e5491b6.
//
// Solidity: function creditDeposit(address user, uint256 amount, bytes32 txHash) returns()
func (_BettingPool *BettingPoolTransactor) CreditDeposit(opts *bind.TransactOpts, user common.Address, amount *big.Int, txHash [32]byte) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "creditDeposit", user, amount, txHash)
}

// CreditDeposit is a paid mutator transaction binding the contract method 0x1e5491b6.
//
// Solidity: function creditDeposit(address user, uint256 amount, bytes32 txHash) returns()
func (_BettingPool *BettingPoolSession) CreditDeposit(user common.Address, amount *big.Int, txHash [32]byte) (*types.Transaction, error) {
	return _BettingPool.Contract.CreditDeposit(&_BettingPool.TransactOpts, user, amount, txHash)
}

// CreditDeposit is a paid mutator transaction binding the contract method 0x1e5491b6.
//
// Solidity: function creditDeposit(address user, uint256 amount, bytes32 txHash) returns()
func (_BettingPool *BettingPoolTransactorSession) CreditDeposit(user common.Address, amount *big.Int, txHash [32]byte) (*types.Transaction, error) {
	return _BettingPool.Contract.CreditDeposit(&_BettingPool.TransactOpts, user, amount, txHash)
}

// ExecuteLargeWithdrawal is a paid mutator transaction binding the contract method 0xfb0af736.
//
// Solidity: function executeLargeWithdrawal(bytes32 requestId) returns()
func (_BettingPool *BettingPoolTransactor) ExecuteLargeWithdrawal(opts *bind.TransactOpts, requestId [32]byte) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "executeLargeWithdrawal", requestId)
}

// ExecuteLargeWithdrawal is a paid mutator transaction binding the contract method 0xfb0af736.
//
// Solidity: function executeLargeWithdrawal(bytes32 requestId) returns()
func (_BettingPool *BettingPoolSession) ExecuteLargeWithdrawal(requestId [32]byte) (*types.Transaction, error) {
	return _BettingPool.Contract.ExecuteLargeWithdrawal(&_BettingPool.TransactOpts, requestId)
}

// ExecuteLargeWithdrawal is a paid mutator transaction binding the contract method 0xfb0af736.
//
// Solidity: function executeLargeWithdrawal(bytes32 requestId) returns()
func (_BettingPool *BettingPoolTransactorSession) ExecuteLargeWithdrawal(requestId [32]byte) (*types.Transaction, error) {
	return _BettingPool.Contract.ExecuteLargeWithdrawal(&_BettingPool.TransactOpts, requestId)
}

// Initialize is a paid mutator transaction binding the contract method 0xc0c53b8b.
//
// Solidity: function initialize(address _usdt, address _admin, address _multisig) returns()
func (_BettingPool *BettingPoolTransactor) Initialize(opts *bind.TransactOpts, _usdt common.Address, _admin common.Address, _multisig common.Address) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "initialize", _usdt, _admin, _multisig)
}

// Initialize is a paid mutator transaction binding the contract method 0xc0c53b8b.
//
// Solidity: function initialize(address _usdt, address _admin, address _multisig) returns()
func (_BettingPool *BettingPoolSession) Initialize(_usdt common.Address, _admin common.Address, _multisig common.Address) (*types.Transaction, error) {
	return _BettingPool.Contract.Initialize(&_BettingPool.TransactOpts, _usdt, _admin, _multisig)
}

// Initialize is a paid mutator transaction binding the contract method 0xc0c53b8b.
//
// Solidity: function initialize(address _usdt, address _admin, address _multisig) returns()
func (_BettingPool *BettingPoolTransactorSession) Initialize(_usdt common.Address, _admin common.Address, _multisig common.Address) (*types.Transaction, error) {
	return _BettingPool.Contract.Initialize(&_BettingPool.TransactOpts, _usdt, _admin, _multisig)
}

// LockBet is a paid mutator transaction binding the contract method 0x0c2951ab.
//
// Solidity: function lockBet(bytes32 betId, address user, uint256 amount, bytes32 matchId, uint8 market, uint8 outcome, uint8 line, uint256 lockedOdds) returns()
func (_BettingPool *BettingPoolTransactor) LockBet(opts *bind.TransactOpts, betId [32]byte, user common.Address, amount *big.Int, matchId [32]byte, market uint8, outcome uint8, line uint8, lockedOdds *big.Int) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "lockBet", betId, user, amount, matchId, market, outcome, line, lockedOdds)
}

// LockBet is a paid mutator transaction binding the contract method 0x0c2951ab.
//
// Solidity: function lockBet(bytes32 betId, address user, uint256 amount, bytes32 matchId, uint8 market, uint8 outcome, uint8 line, uint256 lockedOdds) returns()
func (_BettingPool *BettingPoolSession) LockBet(betId [32]byte, user common.Address, amount *big.Int, matchId [32]byte, market uint8, outcome uint8, line uint8, lockedOdds *big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.LockBet(&_BettingPool.TransactOpts, betId, user, amount, matchId, market, outcome, line, lockedOdds)
}

// LockBet is a paid mutator transaction binding the contract method 0x0c2951ab.
//
// Solidity: function lockBet(bytes32 betId, address user, uint256 amount, bytes32 matchId, uint8 market, uint8 outcome, uint8 line, uint256 lockedOdds) returns()
func (_BettingPool *BettingPoolTransactorSession) LockBet(betId [32]byte, user common.Address, amount *big.Int, matchId [32]byte, market uint8, outcome uint8, line uint8, lockedOdds *big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.LockBet(&_BettingPool.TransactOpts, betId, user, amount, matchId, market, outcome, line, lockedOdds)
}

// LockCreditBet is a paid mutator transaction binding the contract method 0x6770c7b6.
//
// Solidity: function lockCreditBet(bytes32 betId, bytes32 collateralBetId, address user, uint256 amount, bytes32 matchId, uint8 market, uint8 outcome, uint8 line, uint256 lockedOdds) returns()
func (_BettingPool *BettingPoolTransactor) LockCreditBet(opts *bind.TransactOpts, betId [32]byte, collateralBetId [32]byte, user common.Address, amount *big.Int, matchId [32]byte, market uint8, outcome uint8, line uint8, lockedOdds *big.Int) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "lockCreditBet", betId, collateralBetId, user, amount, matchId, market, outcome, line, lockedOdds)
}

// LockCreditBet is a paid mutator transaction binding the contract method 0x6770c7b6.
//
// Solidity: function lockCreditBet(bytes32 betId, bytes32 collateralBetId, address user, uint256 amount, bytes32 matchId, uint8 market, uint8 outcome, uint8 line, uint256 lockedOdds) returns()
func (_BettingPool *BettingPoolSession) LockCreditBet(betId [32]byte, collateralBetId [32]byte, user common.Address, amount *big.Int, matchId [32]byte, market uint8, outcome uint8, line uint8, lockedOdds *big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.LockCreditBet(&_BettingPool.TransactOpts, betId, collateralBetId, user, amount, matchId, market, outcome, line, lockedOdds)
}

// LockCreditBet is a paid mutator transaction binding the contract method 0x6770c7b6.
//
// Solidity: function lockCreditBet(bytes32 betId, bytes32 collateralBetId, address user, uint256 amount, bytes32 matchId, uint8 market, uint8 outcome, uint8 line, uint256 lockedOdds) returns()
func (_BettingPool *BettingPoolTransactorSession) LockCreditBet(betId [32]byte, collateralBetId [32]byte, user common.Address, amount *big.Int, matchId [32]byte, market uint8, outcome uint8, line uint8, lockedOdds *big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.LockCreditBet(&_BettingPool.TransactOpts, betId, collateralBetId, user, amount, matchId, market, outcome, line, lockedOdds)
}

// LockParlay is a paid mutator transaction binding the contract method 0xba192656.
//
// Solidity: function lockParlay(bytes32 parlayId, address user, uint256 stake, bytes32[] matchIds, uint8[] markets, uint8[] outcomes, uint8[] lines, uint256[] legOdds, bytes32[] legBetIds) returns()
func (_BettingPool *BettingPoolTransactor) LockParlay(opts *bind.TransactOpts, parlayId [32]byte, user common.Address, stake *big.Int, matchIds [][32]byte, markets []uint8, outcomes []uint8, lines []uint8, legOdds []*big.Int, legBetIds [][32]byte) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "lockParlay", parlayId, user, stake, matchIds, markets, outcomes, lines, legOdds, legBetIds)
}

// LockParlay is a paid mutator transaction binding the contract method 0xba192656.
//
// Solidity: function lockParlay(bytes32 parlayId, address user, uint256 stake, bytes32[] matchIds, uint8[] markets, uint8[] outcomes, uint8[] lines, uint256[] legOdds, bytes32[] legBetIds) returns()
func (_BettingPool *BettingPoolSession) LockParlay(parlayId [32]byte, user common.Address, stake *big.Int, matchIds [][32]byte, markets []uint8, outcomes []uint8, lines []uint8, legOdds []*big.Int, legBetIds [][32]byte) (*types.Transaction, error) {
	return _BettingPool.Contract.LockParlay(&_BettingPool.TransactOpts, parlayId, user, stake, matchIds, markets, outcomes, lines, legOdds, legBetIds)
}

// LockParlay is a paid mutator transaction binding the contract method 0xba192656.
//
// Solidity: function lockParlay(bytes32 parlayId, address user, uint256 stake, bytes32[] matchIds, uint8[] markets, uint8[] outcomes, uint8[] lines, uint256[] legOdds, bytes32[] legBetIds) returns()
func (_BettingPool *BettingPoolTransactorSession) LockParlay(parlayId [32]byte, user common.Address, stake *big.Int, matchIds [][32]byte, markets []uint8, outcomes []uint8, lines []uint8, legOdds []*big.Int, legBetIds [][32]byte) (*types.Transaction, error) {
	return _BettingPool.Contract.LockParlay(&_BettingPool.TransactOpts, parlayId, user, stake, matchIds, markets, outcomes, lines, legOdds, legBetIds)
}

// OpenMarket is a paid mutator transaction binding the contract method 0xa6679d62.
//
// Solidity: function openMarket(bytes32 matchId, uint8 market, uint8 line) returns()
func (_BettingPool *BettingPoolTransactor) OpenMarket(opts *bind.TransactOpts, matchId [32]byte, market uint8, line uint8) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "openMarket", matchId, market, line)
}

// OpenMarket is a paid mutator transaction binding the contract method 0xa6679d62.
//
// Solidity: function openMarket(bytes32 matchId, uint8 market, uint8 line) returns()
func (_BettingPool *BettingPoolSession) OpenMarket(matchId [32]byte, market uint8, line uint8) (*types.Transaction, error) {
	return _BettingPool.Contract.OpenMarket(&_BettingPool.TransactOpts, matchId, market, line)
}

// OpenMarket is a paid mutator transaction binding the contract method 0xa6679d62.
//
// Solidity: function openMarket(bytes32 matchId, uint8 market, uint8 line) returns()
func (_BettingPool *BettingPoolTransactorSession) OpenMarket(matchId [32]byte, market uint8, line uint8) (*types.Transaction, error) {
	return _BettingPool.Contract.OpenMarket(&_BettingPool.TransactOpts, matchId, market, line)
}

// Pause is a paid mutator transaction binding the contract method 0x8456cb59.
//
// Solidity: function pause() returns()
func (_BettingPool *BettingPoolTransactor) Pause(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "pause")
}

// Pause is a paid mutator transaction binding the contract method 0x8456cb59.
//
// Solidity: function pause() returns()
func (_BettingPool *BettingPoolSession) Pause() (*types.Transaction, error) {
	return _BettingPool.Contract.Pause(&_BettingPool.TransactOpts)
}

// Pause is a paid mutator transaction binding the contract method 0x8456cb59.
//
// Solidity: function pause() returns()
func (_BettingPool *BettingPoolTransactorSession) Pause() (*types.Transaction, error) {
	return _BettingPool.Contract.Pause(&_BettingPool.TransactOpts)
}

// RejectLargeWithdrawal is a paid mutator transaction binding the contract method 0xb789b7bf.
//
// Solidity: function rejectLargeWithdrawal(bytes32 requestId) returns()
func (_BettingPool *BettingPoolTransactor) RejectLargeWithdrawal(opts *bind.TransactOpts, requestId [32]byte) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "rejectLargeWithdrawal", requestId)
}

// RejectLargeWithdrawal is a paid mutator transaction binding the contract method 0xb789b7bf.
//
// Solidity: function rejectLargeWithdrawal(bytes32 requestId) returns()
func (_BettingPool *BettingPoolSession) RejectLargeWithdrawal(requestId [32]byte) (*types.Transaction, error) {
	return _BettingPool.Contract.RejectLargeWithdrawal(&_BettingPool.TransactOpts, requestId)
}

// RejectLargeWithdrawal is a paid mutator transaction binding the contract method 0xb789b7bf.
//
// Solidity: function rejectLargeWithdrawal(bytes32 requestId) returns()
func (_BettingPool *BettingPoolTransactorSession) RejectLargeWithdrawal(requestId [32]byte) (*types.Transaction, error) {
	return _BettingPool.Contract.RejectLargeWithdrawal(&_BettingPool.TransactOpts, requestId)
}

// ReleaseOrForfeiture is a paid mutator transaction binding the contract method 0x4c80494c.
//
// Solidity: function releaseOrForfeiture(bytes32 creditBetId) returns()
func (_BettingPool *BettingPoolTransactor) ReleaseOrForfeiture(opts *bind.TransactOpts, creditBetId [32]byte) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "releaseOrForfeiture", creditBetId)
}

// ReleaseOrForfeiture is a paid mutator transaction binding the contract method 0x4c80494c.
//
// Solidity: function releaseOrForfeiture(bytes32 creditBetId) returns()
func (_BettingPool *BettingPoolSession) ReleaseOrForfeiture(creditBetId [32]byte) (*types.Transaction, error) {
	return _BettingPool.Contract.ReleaseOrForfeiture(&_BettingPool.TransactOpts, creditBetId)
}

// ReleaseOrForfeiture is a paid mutator transaction binding the contract method 0x4c80494c.
//
// Solidity: function releaseOrForfeiture(bytes32 creditBetId) returns()
func (_BettingPool *BettingPoolTransactorSession) ReleaseOrForfeiture(creditBetId [32]byte) (*types.Transaction, error) {
	return _BettingPool.Contract.ReleaseOrForfeiture(&_BettingPool.TransactOpts, creditBetId)
}

// RemoveLiquidity is a paid mutator transaction binding the contract method 0x9c8f9f23.
//
// Solidity: function removeLiquidity(uint256 shares) returns()
func (_BettingPool *BettingPoolTransactor) RemoveLiquidity(opts *bind.TransactOpts, shares *big.Int) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "removeLiquidity", shares)
}

// RemoveLiquidity is a paid mutator transaction binding the contract method 0x9c8f9f23.
//
// Solidity: function removeLiquidity(uint256 shares) returns()
func (_BettingPool *BettingPoolSession) RemoveLiquidity(shares *big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.RemoveLiquidity(&_BettingPool.TransactOpts, shares)
}

// RemoveLiquidity is a paid mutator transaction binding the contract method 0x9c8f9f23.
//
// Solidity: function removeLiquidity(uint256 shares) returns()
func (_BettingPool *BettingPoolTransactorSession) RemoveLiquidity(shares *big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.RemoveLiquidity(&_BettingPool.TransactOpts, shares)
}

// ReopenMarket is a paid mutator transaction binding the contract method 0x32a34ccc.
//
// Solidity: function reopenMarket(bytes32 matchId, uint8 market, uint8 line) returns()
func (_BettingPool *BettingPoolTransactor) ReopenMarket(opts *bind.TransactOpts, matchId [32]byte, market uint8, line uint8) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "reopenMarket", matchId, market, line)
}

// ReopenMarket is a paid mutator transaction binding the contract method 0x32a34ccc.
//
// Solidity: function reopenMarket(bytes32 matchId, uint8 market, uint8 line) returns()
func (_BettingPool *BettingPoolSession) ReopenMarket(matchId [32]byte, market uint8, line uint8) (*types.Transaction, error) {
	return _BettingPool.Contract.ReopenMarket(&_BettingPool.TransactOpts, matchId, market, line)
}

// ReopenMarket is a paid mutator transaction binding the contract method 0x32a34ccc.
//
// Solidity: function reopenMarket(bytes32 matchId, uint8 market, uint8 line) returns()
func (_BettingPool *BettingPoolTransactorSession) ReopenMarket(matchId [32]byte, market uint8, line uint8) (*types.Transaction, error) {
	return _BettingPool.Contract.ReopenMarket(&_BettingPool.TransactOpts, matchId, market, line)
}

// SetAdmin is a paid mutator transaction binding the contract method 0x704b6c02.
//
// Solidity: function setAdmin(address newAdmin) returns()
func (_BettingPool *BettingPoolTransactor) SetAdmin(opts *bind.TransactOpts, newAdmin common.Address) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "setAdmin", newAdmin)
}

// SetAdmin is a paid mutator transaction binding the contract method 0x704b6c02.
//
// Solidity: function setAdmin(address newAdmin) returns()
func (_BettingPool *BettingPoolSession) SetAdmin(newAdmin common.Address) (*types.Transaction, error) {
	return _BettingPool.Contract.SetAdmin(&_BettingPool.TransactOpts, newAdmin)
}

// SetAdmin is a paid mutator transaction binding the contract method 0x704b6c02.
//
// Solidity: function setAdmin(address newAdmin) returns()
func (_BettingPool *BettingPoolTransactorSession) SetAdmin(newAdmin common.Address) (*types.Transaction, error) {
	return _BettingPool.Contract.SetAdmin(&_BettingPool.TransactOpts, newAdmin)
}

// SetLpShareBps is a paid mutator transaction binding the contract method 0x1b38dbb0.
//
// Solidity: function setLpShareBps(uint256 newBps) returns()
func (_BettingPool *BettingPoolTransactor) SetLpShareBps(opts *bind.TransactOpts, newBps *big.Int) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "setLpShareBps", newBps)
}

// SetLpShareBps is a paid mutator transaction binding the contract method 0x1b38dbb0.
//
// Solidity: function setLpShareBps(uint256 newBps) returns()
func (_BettingPool *BettingPoolSession) SetLpShareBps(newBps *big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.SetLpShareBps(&_BettingPool.TransactOpts, newBps)
}

// SetLpShareBps is a paid mutator transaction binding the contract method 0x1b38dbb0.
//
// Solidity: function setLpShareBps(uint256 newBps) returns()
func (_BettingPool *BettingPoolTransactorSession) SetLpShareBps(newBps *big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.SetLpShareBps(&_BettingPool.TransactOpts, newBps)
}

// SetMaxMarketsPerMatch is a paid mutator transaction binding the contract method 0x8ebbbf45.
//
// Solidity: function setMaxMarketsPerMatch(uint256 max) returns()
func (_BettingPool *BettingPoolTransactor) SetMaxMarketsPerMatch(opts *bind.TransactOpts, max *big.Int) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "setMaxMarketsPerMatch", max)
}

// SetMaxMarketsPerMatch is a paid mutator transaction binding the contract method 0x8ebbbf45.
//
// Solidity: function setMaxMarketsPerMatch(uint256 max) returns()
func (_BettingPool *BettingPoolSession) SetMaxMarketsPerMatch(max *big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.SetMaxMarketsPerMatch(&_BettingPool.TransactOpts, max)
}

// SetMaxMarketsPerMatch is a paid mutator transaction binding the contract method 0x8ebbbf45.
//
// Solidity: function setMaxMarketsPerMatch(uint256 max) returns()
func (_BettingPool *BettingPoolTransactorSession) SetMaxMarketsPerMatch(max *big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.SetMaxMarketsPerMatch(&_BettingPool.TransactOpts, max)
}

// SetRedLightThreshold is a paid mutator transaction binding the contract method 0xeb28c09f.
//
// Solidity: function setRedLightThreshold(uint256 threshold) returns()
func (_BettingPool *BettingPoolTransactor) SetRedLightThreshold(opts *bind.TransactOpts, threshold *big.Int) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "setRedLightThreshold", threshold)
}

// SetRedLightThreshold is a paid mutator transaction binding the contract method 0xeb28c09f.
//
// Solidity: function setRedLightThreshold(uint256 threshold) returns()
func (_BettingPool *BettingPoolSession) SetRedLightThreshold(threshold *big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.SetRedLightThreshold(&_BettingPool.TransactOpts, threshold)
}

// SetRedLightThreshold is a paid mutator transaction binding the contract method 0xeb28c09f.
//
// Solidity: function setRedLightThreshold(uint256 threshold) returns()
func (_BettingPool *BettingPoolTransactorSession) SetRedLightThreshold(threshold *big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.SetRedLightThreshold(&_BettingPool.TransactOpts, threshold)
}

// Settle is a paid mutator transaction binding the contract method 0xbce480aa.
//
// Solidity: function settle(bytes32 matchId, uint8 market, uint8 line, uint8 winningOutcome, bytes32[] betIds) returns()
func (_BettingPool *BettingPoolTransactor) Settle(opts *bind.TransactOpts, matchId [32]byte, market uint8, line uint8, winningOutcome uint8, betIds [][32]byte) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "settle", matchId, market, line, winningOutcome, betIds)
}

// Settle is a paid mutator transaction binding the contract method 0xbce480aa.
//
// Solidity: function settle(bytes32 matchId, uint8 market, uint8 line, uint8 winningOutcome, bytes32[] betIds) returns()
func (_BettingPool *BettingPoolSession) Settle(matchId [32]byte, market uint8, line uint8, winningOutcome uint8, betIds [][32]byte) (*types.Transaction, error) {
	return _BettingPool.Contract.Settle(&_BettingPool.TransactOpts, matchId, market, line, winningOutcome, betIds)
}

// Settle is a paid mutator transaction binding the contract method 0xbce480aa.
//
// Solidity: function settle(bytes32 matchId, uint8 market, uint8 line, uint8 winningOutcome, bytes32[] betIds) returns()
func (_BettingPool *BettingPoolTransactorSession) Settle(matchId [32]byte, market uint8, line uint8, winningOutcome uint8, betIds [][32]byte) (*types.Transaction, error) {
	return _BettingPool.Contract.Settle(&_BettingPool.TransactOpts, matchId, market, line, winningOutcome, betIds)
}

// UnlockBet is a paid mutator transaction binding the contract method 0x1201ebe0.
//
// Solidity: function unlockBet(bytes32 betId, bytes32[] creditBetIds) returns()
func (_BettingPool *BettingPoolTransactor) UnlockBet(opts *bind.TransactOpts, betId [32]byte, creditBetIds [][32]byte) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "unlockBet", betId, creditBetIds)
}

// UnlockBet is a paid mutator transaction binding the contract method 0x1201ebe0.
//
// Solidity: function unlockBet(bytes32 betId, bytes32[] creditBetIds) returns()
func (_BettingPool *BettingPoolSession) UnlockBet(betId [32]byte, creditBetIds [][32]byte) (*types.Transaction, error) {
	return _BettingPool.Contract.UnlockBet(&_BettingPool.TransactOpts, betId, creditBetIds)
}

// UnlockBet is a paid mutator transaction binding the contract method 0x1201ebe0.
//
// Solidity: function unlockBet(bytes32 betId, bytes32[] creditBetIds) returns()
func (_BettingPool *BettingPoolTransactorSession) UnlockBet(betId [32]byte, creditBetIds [][32]byte) (*types.Transaction, error) {
	return _BettingPool.Contract.UnlockBet(&_BettingPool.TransactOpts, betId, creditBetIds)
}

// UnlockParlay is a paid mutator transaction binding the contract method 0x95e2b768.
//
// Solidity: function unlockParlay(bytes32 parlayId) returns()
func (_BettingPool *BettingPoolTransactor) UnlockParlay(opts *bind.TransactOpts, parlayId [32]byte) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "unlockParlay", parlayId)
}

// UnlockParlay is a paid mutator transaction binding the contract method 0x95e2b768.
//
// Solidity: function unlockParlay(bytes32 parlayId) returns()
func (_BettingPool *BettingPoolSession) UnlockParlay(parlayId [32]byte) (*types.Transaction, error) {
	return _BettingPool.Contract.UnlockParlay(&_BettingPool.TransactOpts, parlayId)
}

// UnlockParlay is a paid mutator transaction binding the contract method 0x95e2b768.
//
// Solidity: function unlockParlay(bytes32 parlayId) returns()
func (_BettingPool *BettingPoolTransactorSession) UnlockParlay(parlayId [32]byte) (*types.Transaction, error) {
	return _BettingPool.Contract.UnlockParlay(&_BettingPool.TransactOpts, parlayId)
}

// Unpause is a paid mutator transaction binding the contract method 0x3f4ba83a.
//
// Solidity: function unpause() returns()
func (_BettingPool *BettingPoolTransactor) Unpause(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "unpause")
}

// Unpause is a paid mutator transaction binding the contract method 0x3f4ba83a.
//
// Solidity: function unpause() returns()
func (_BettingPool *BettingPoolSession) Unpause() (*types.Transaction, error) {
	return _BettingPool.Contract.Unpause(&_BettingPool.TransactOpts)
}

// Unpause is a paid mutator transaction binding the contract method 0x3f4ba83a.
//
// Solidity: function unpause() returns()
func (_BettingPool *BettingPoolTransactorSession) Unpause() (*types.Transaction, error) {
	return _BettingPool.Contract.Unpause(&_BettingPool.TransactOpts)
}

// UpdateSignal is a paid mutator transaction binding the contract method 0x5f4b0f0b.
//
// Solidity: function updateSignal(bytes32 matchId, uint8 market, uint8 line, uint256 heavyAmount, uint8 heavySide, uint8 color) returns()
func (_BettingPool *BettingPoolTransactor) UpdateSignal(opts *bind.TransactOpts, matchId [32]byte, market uint8, line uint8, heavyAmount *big.Int, heavySide uint8, color uint8) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "updateSignal", matchId, market, line, heavyAmount, heavySide, color)
}

// UpdateSignal is a paid mutator transaction binding the contract method 0x5f4b0f0b.
//
// Solidity: function updateSignal(bytes32 matchId, uint8 market, uint8 line, uint256 heavyAmount, uint8 heavySide, uint8 color) returns()
func (_BettingPool *BettingPoolSession) UpdateSignal(matchId [32]byte, market uint8, line uint8, heavyAmount *big.Int, heavySide uint8, color uint8) (*types.Transaction, error) {
	return _BettingPool.Contract.UpdateSignal(&_BettingPool.TransactOpts, matchId, market, line, heavyAmount, heavySide, color)
}

// UpdateSignal is a paid mutator transaction binding the contract method 0x5f4b0f0b.
//
// Solidity: function updateSignal(bytes32 matchId, uint8 market, uint8 line, uint256 heavyAmount, uint8 heavySide, uint8 color) returns()
func (_BettingPool *BettingPoolTransactorSession) UpdateSignal(matchId [32]byte, market uint8, line uint8, heavyAmount *big.Int, heavySide uint8, color uint8) (*types.Transaction, error) {
	return _BettingPool.Contract.UpdateSignal(&_BettingPool.TransactOpts, matchId, market, line, heavyAmount, heavySide, color)
}

// UpgradeToAndCall is a paid mutator transaction binding the contract method 0x4f1ef286.
//
// Solidity: function upgradeToAndCall(address newImplementation, bytes data) payable returns()
func (_BettingPool *BettingPoolTransactor) UpgradeToAndCall(opts *bind.TransactOpts, newImplementation common.Address, data []byte) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "upgradeToAndCall", newImplementation, data)
}

// UpgradeToAndCall is a paid mutator transaction binding the contract method 0x4f1ef286.
//
// Solidity: function upgradeToAndCall(address newImplementation, bytes data) payable returns()
func (_BettingPool *BettingPoolSession) UpgradeToAndCall(newImplementation common.Address, data []byte) (*types.Transaction, error) {
	return _BettingPool.Contract.UpgradeToAndCall(&_BettingPool.TransactOpts, newImplementation, data)
}

// UpgradeToAndCall is a paid mutator transaction binding the contract method 0x4f1ef286.
//
// Solidity: function upgradeToAndCall(address newImplementation, bytes data) payable returns()
func (_BettingPool *BettingPoolTransactorSession) UpgradeToAndCall(newImplementation common.Address, data []byte) (*types.Transaction, error) {
	return _BettingPool.Contract.UpgradeToAndCall(&_BettingPool.TransactOpts, newImplementation, data)
}

// Withdraw is a paid mutator transaction binding the contract method 0x2e1a7d4d.
//
// Solidity: function withdraw(uint256 amount) returns()
func (_BettingPool *BettingPoolTransactor) Withdraw(opts *bind.TransactOpts, amount *big.Int) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "withdraw", amount)
}

// Withdraw is a paid mutator transaction binding the contract method 0x2e1a7d4d.
//
// Solidity: function withdraw(uint256 amount) returns()
func (_BettingPool *BettingPoolSession) Withdraw(amount *big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.Withdraw(&_BettingPool.TransactOpts, amount)
}

// Withdraw is a paid mutator transaction binding the contract method 0x2e1a7d4d.
//
// Solidity: function withdraw(uint256 amount) returns()
func (_BettingPool *BettingPoolTransactorSession) Withdraw(amount *big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.Withdraw(&_BettingPool.TransactOpts, amount)
}

// WithdrawPlatform is a paid mutator transaction binding the contract method 0x7fe33965.
//
// Solidity: function withdrawPlatform(address to, uint256 amount) returns()
func (_BettingPool *BettingPoolTransactor) WithdrawPlatform(opts *bind.TransactOpts, to common.Address, amount *big.Int) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "withdrawPlatform", to, amount)
}

// WithdrawPlatform is a paid mutator transaction binding the contract method 0x7fe33965.
//
// Solidity: function withdrawPlatform(address to, uint256 amount) returns()
func (_BettingPool *BettingPoolSession) WithdrawPlatform(to common.Address, amount *big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.WithdrawPlatform(&_BettingPool.TransactOpts, to, amount)
}

// WithdrawPlatform is a paid mutator transaction binding the contract method 0x7fe33965.
//
// Solidity: function withdrawPlatform(address to, uint256 amount) returns()
func (_BettingPool *BettingPoolTransactorSession) WithdrawPlatform(to common.Address, amount *big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.WithdrawPlatform(&_BettingPool.TransactOpts, to, amount)
}

// BettingPoolAdminUpdatedIterator is returned from FilterAdminUpdated and is used to iterate over the raw logs and unpacked data for AdminUpdated events raised by the BettingPool contract.
type BettingPoolAdminUpdatedIterator struct {
	Event *BettingPoolAdminUpdated // Event containing the contract specifics and raw log

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
func (it *BettingPoolAdminUpdatedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolAdminUpdated)
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
		it.Event = new(BettingPoolAdminUpdated)
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
func (it *BettingPoolAdminUpdatedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolAdminUpdatedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolAdminUpdated represents a AdminUpdated event raised by the BettingPool contract.
type BettingPoolAdminUpdated struct {
	OldAdmin common.Address
	NewAdmin common.Address
	Raw      types.Log // Blockchain specific contextual infos
}

// FilterAdminUpdated is a free log retrieval operation binding the contract event 0x101b8081ff3b56bbf45deb824d86a3b0fd38b7e3dd42421105cf8abe9106db0b.
//
// Solidity: event AdminUpdated(address indexed oldAdmin, address indexed newAdmin)
func (_BettingPool *BettingPoolFilterer) FilterAdminUpdated(opts *bind.FilterOpts, oldAdmin []common.Address, newAdmin []common.Address) (*BettingPoolAdminUpdatedIterator, error) {

	var oldAdminRule []interface{}
	for _, oldAdminItem := range oldAdmin {
		oldAdminRule = append(oldAdminRule, oldAdminItem)
	}
	var newAdminRule []interface{}
	for _, newAdminItem := range newAdmin {
		newAdminRule = append(newAdminRule, newAdminItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "AdminUpdated", oldAdminRule, newAdminRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolAdminUpdatedIterator{contract: _BettingPool.contract, event: "AdminUpdated", logs: logs, sub: sub}, nil
}

// WatchAdminUpdated is a free log subscription operation binding the contract event 0x101b8081ff3b56bbf45deb824d86a3b0fd38b7e3dd42421105cf8abe9106db0b.
//
// Solidity: event AdminUpdated(address indexed oldAdmin, address indexed newAdmin)
func (_BettingPool *BettingPoolFilterer) WatchAdminUpdated(opts *bind.WatchOpts, sink chan<- *BettingPoolAdminUpdated, oldAdmin []common.Address, newAdmin []common.Address) (event.Subscription, error) {

	var oldAdminRule []interface{}
	for _, oldAdminItem := range oldAdmin {
		oldAdminRule = append(oldAdminRule, oldAdminItem)
	}
	var newAdminRule []interface{}
	for _, newAdminItem := range newAdmin {
		newAdminRule = append(newAdminRule, newAdminItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "AdminUpdated", oldAdminRule, newAdminRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolAdminUpdated)
				if err := _BettingPool.contract.UnpackLog(event, "AdminUpdated", log); err != nil {
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

// ParseAdminUpdated is a log parse operation binding the contract event 0x101b8081ff3b56bbf45deb824d86a3b0fd38b7e3dd42421105cf8abe9106db0b.
//
// Solidity: event AdminUpdated(address indexed oldAdmin, address indexed newAdmin)
func (_BettingPool *BettingPoolFilterer) ParseAdminUpdated(log types.Log) (*BettingPoolAdminUpdated, error) {
	event := new(BettingPoolAdminUpdated)
	if err := _BettingPool.contract.UnpackLog(event, "AdminUpdated", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolBetLockedIterator is returned from FilterBetLocked and is used to iterate over the raw logs and unpacked data for BetLocked events raised by the BettingPool contract.
type BettingPoolBetLockedIterator struct {
	Event *BettingPoolBetLocked // Event containing the contract specifics and raw log

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
func (it *BettingPoolBetLockedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolBetLocked)
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
		it.Event = new(BettingPoolBetLocked)
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
func (it *BettingPoolBetLockedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolBetLockedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolBetLocked represents a BetLocked event raised by the BettingPool contract.
type BettingPoolBetLocked struct {
	BetId   [32]byte
	User    common.Address
	Amount  *big.Int
	MatchId [32]byte
	Raw     types.Log // Blockchain specific contextual infos
}

// FilterBetLocked is a free log retrieval operation binding the contract event 0x9f3fd7d3209cf7d8bde00f6b120b65d66b2bbf3cbe4d673f0f7f7893ccab1072.
//
// Solidity: event BetLocked(bytes32 indexed betId, address indexed user, uint256 amount, bytes32 indexed matchId)
func (_BettingPool *BettingPoolFilterer) FilterBetLocked(opts *bind.FilterOpts, betId [][32]byte, user []common.Address, matchId [][32]byte) (*BettingPoolBetLockedIterator, error) {

	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "BetLocked", betIdRule, userRule, matchIdRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolBetLockedIterator{contract: _BettingPool.contract, event: "BetLocked", logs: logs, sub: sub}, nil
}

// WatchBetLocked is a free log subscription operation binding the contract event 0x9f3fd7d3209cf7d8bde00f6b120b65d66b2bbf3cbe4d673f0f7f7893ccab1072.
//
// Solidity: event BetLocked(bytes32 indexed betId, address indexed user, uint256 amount, bytes32 indexed matchId)
func (_BettingPool *BettingPoolFilterer) WatchBetLocked(opts *bind.WatchOpts, sink chan<- *BettingPoolBetLocked, betId [][32]byte, user []common.Address, matchId [][32]byte) (event.Subscription, error) {

	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "BetLocked", betIdRule, userRule, matchIdRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolBetLocked)
				if err := _BettingPool.contract.UnpackLog(event, "BetLocked", log); err != nil {
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

// ParseBetLocked is a log parse operation binding the contract event 0x9f3fd7d3209cf7d8bde00f6b120b65d66b2bbf3cbe4d673f0f7f7893ccab1072.
//
// Solidity: event BetLocked(bytes32 indexed betId, address indexed user, uint256 amount, bytes32 indexed matchId)
func (_BettingPool *BettingPoolFilterer) ParseBetLocked(log types.Log) (*BettingPoolBetLocked, error) {
	event := new(BettingPoolBetLocked)
	if err := _BettingPool.contract.UnpackLog(event, "BetLocked", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolBetSettledIterator is returned from FilterBetSettled and is used to iterate over the raw logs and unpacked data for BetSettled events raised by the BettingPool contract.
type BettingPoolBetSettledIterator struct {
	Event *BettingPoolBetSettled // Event containing the contract specifics and raw log

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
func (it *BettingPoolBetSettledIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolBetSettled)
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
		it.Event = new(BettingPoolBetSettled)
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
func (it *BettingPoolBetSettledIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolBetSettledIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolBetSettled represents a BetSettled event raised by the BettingPool contract.
type BettingPoolBetSettled struct {
	BetId  [32]byte
	User   common.Address
	Status uint8
	Payout *big.Int
	Raw    types.Log // Blockchain specific contextual infos
}

// FilterBetSettled is a free log retrieval operation binding the contract event 0x11c19c758747dac3335cd511581f22fdeae9252ca9eb7f8fe5bbc4dd2a0eb8b7.
//
// Solidity: event BetSettled(bytes32 indexed betId, address indexed user, uint8 status, uint256 payout)
func (_BettingPool *BettingPoolFilterer) FilterBetSettled(opts *bind.FilterOpts, betId [][32]byte, user []common.Address) (*BettingPoolBetSettledIterator, error) {

	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "BetSettled", betIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolBetSettledIterator{contract: _BettingPool.contract, event: "BetSettled", logs: logs, sub: sub}, nil
}

// WatchBetSettled is a free log subscription operation binding the contract event 0x11c19c758747dac3335cd511581f22fdeae9252ca9eb7f8fe5bbc4dd2a0eb8b7.
//
// Solidity: event BetSettled(bytes32 indexed betId, address indexed user, uint8 status, uint256 payout)
func (_BettingPool *BettingPoolFilterer) WatchBetSettled(opts *bind.WatchOpts, sink chan<- *BettingPoolBetSettled, betId [][32]byte, user []common.Address) (event.Subscription, error) {

	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "BetSettled", betIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolBetSettled)
				if err := _BettingPool.contract.UnpackLog(event, "BetSettled", log); err != nil {
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

// ParseBetSettled is a log parse operation binding the contract event 0x11c19c758747dac3335cd511581f22fdeae9252ca9eb7f8fe5bbc4dd2a0eb8b7.
//
// Solidity: event BetSettled(bytes32 indexed betId, address indexed user, uint8 status, uint256 payout)
func (_BettingPool *BettingPoolFilterer) ParseBetSettled(log types.Log) (*BettingPoolBetSettled, error) {
	event := new(BettingPoolBetSettled)
	if err := _BettingPool.contract.UnpackLog(event, "BetSettled", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolBetUnlockedIterator is returned from FilterBetUnlocked and is used to iterate over the raw logs and unpacked data for BetUnlocked events raised by the BettingPool contract.
type BettingPoolBetUnlockedIterator struct {
	Event *BettingPoolBetUnlocked // Event containing the contract specifics and raw log

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
func (it *BettingPoolBetUnlockedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolBetUnlocked)
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
		it.Event = new(BettingPoolBetUnlocked)
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
func (it *BettingPoolBetUnlockedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolBetUnlockedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolBetUnlocked represents a BetUnlocked event raised by the BettingPool contract.
type BettingPoolBetUnlocked struct {
	BetId  [32]byte
	User   common.Address
	Amount *big.Int
	Raw    types.Log // Blockchain specific contextual infos
}

// FilterBetUnlocked is a free log retrieval operation binding the contract event 0x9d1eabb8726eb5d6b449dae5bcba14482b2db04edb91bf032bfd01c013705ebe.
//
// Solidity: event BetUnlocked(bytes32 indexed betId, address indexed user, uint256 amount)
func (_BettingPool *BettingPoolFilterer) FilterBetUnlocked(opts *bind.FilterOpts, betId [][32]byte, user []common.Address) (*BettingPoolBetUnlockedIterator, error) {

	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "BetUnlocked", betIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolBetUnlockedIterator{contract: _BettingPool.contract, event: "BetUnlocked", logs: logs, sub: sub}, nil
}

// WatchBetUnlocked is a free log subscription operation binding the contract event 0x9d1eabb8726eb5d6b449dae5bcba14482b2db04edb91bf032bfd01c013705ebe.
//
// Solidity: event BetUnlocked(bytes32 indexed betId, address indexed user, uint256 amount)
func (_BettingPool *BettingPoolFilterer) WatchBetUnlocked(opts *bind.WatchOpts, sink chan<- *BettingPoolBetUnlocked, betId [][32]byte, user []common.Address) (event.Subscription, error) {

	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "BetUnlocked", betIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolBetUnlocked)
				if err := _BettingPool.contract.UnpackLog(event, "BetUnlocked", log); err != nil {
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

// ParseBetUnlocked is a log parse operation binding the contract event 0x9d1eabb8726eb5d6b449dae5bcba14482b2db04edb91bf032bfd01c013705ebe.
//
// Solidity: event BetUnlocked(bytes32 indexed betId, address indexed user, uint256 amount)
func (_BettingPool *BettingPoolFilterer) ParseBetUnlocked(log types.Log) (*BettingPoolBetUnlocked, error) {
	event := new(BettingPoolBetUnlocked)
	if err := _BettingPool.contract.UnpackLog(event, "BetUnlocked", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolCreditBetForfeitedIterator is returned from FilterCreditBetForfeited and is used to iterate over the raw logs and unpacked data for CreditBetForfeited events raised by the BettingPool contract.
type BettingPoolCreditBetForfeitedIterator struct {
	Event *BettingPoolCreditBetForfeited // Event containing the contract specifics and raw log

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
func (it *BettingPoolCreditBetForfeitedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolCreditBetForfeited)
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
		it.Event = new(BettingPoolCreditBetForfeited)
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
func (it *BettingPoolCreditBetForfeitedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolCreditBetForfeitedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolCreditBetForfeited represents a CreditBetForfeited event raised by the BettingPool contract.
type BettingPoolCreditBetForfeited struct {
	BetId           [32]byte
	CollateralBetId [32]byte
	Amount          *big.Int
	Raw             types.Log // Blockchain specific contextual infos
}

// FilterCreditBetForfeited is a free log retrieval operation binding the contract event 0x31b7ebd6ccf292c28df942d8dc770196a3ed4a72d5fa483462880a7f5a970e7e.
//
// Solidity: event CreditBetForfeited(bytes32 indexed betId, bytes32 indexed collateralBetId, uint256 amount)
func (_BettingPool *BettingPoolFilterer) FilterCreditBetForfeited(opts *bind.FilterOpts, betId [][32]byte, collateralBetId [][32]byte) (*BettingPoolCreditBetForfeitedIterator, error) {

	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}
	var collateralBetIdRule []interface{}
	for _, collateralBetIdItem := range collateralBetId {
		collateralBetIdRule = append(collateralBetIdRule, collateralBetIdItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "CreditBetForfeited", betIdRule, collateralBetIdRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolCreditBetForfeitedIterator{contract: _BettingPool.contract, event: "CreditBetForfeited", logs: logs, sub: sub}, nil
}

// WatchCreditBetForfeited is a free log subscription operation binding the contract event 0x31b7ebd6ccf292c28df942d8dc770196a3ed4a72d5fa483462880a7f5a970e7e.
//
// Solidity: event CreditBetForfeited(bytes32 indexed betId, bytes32 indexed collateralBetId, uint256 amount)
func (_BettingPool *BettingPoolFilterer) WatchCreditBetForfeited(opts *bind.WatchOpts, sink chan<- *BettingPoolCreditBetForfeited, betId [][32]byte, collateralBetId [][32]byte) (event.Subscription, error) {

	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}
	var collateralBetIdRule []interface{}
	for _, collateralBetIdItem := range collateralBetId {
		collateralBetIdRule = append(collateralBetIdRule, collateralBetIdItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "CreditBetForfeited", betIdRule, collateralBetIdRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolCreditBetForfeited)
				if err := _BettingPool.contract.UnpackLog(event, "CreditBetForfeited", log); err != nil {
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

// ParseCreditBetForfeited is a log parse operation binding the contract event 0x31b7ebd6ccf292c28df942d8dc770196a3ed4a72d5fa483462880a7f5a970e7e.
//
// Solidity: event CreditBetForfeited(bytes32 indexed betId, bytes32 indexed collateralBetId, uint256 amount)
func (_BettingPool *BettingPoolFilterer) ParseCreditBetForfeited(log types.Log) (*BettingPoolCreditBetForfeited, error) {
	event := new(BettingPoolCreditBetForfeited)
	if err := _BettingPool.contract.UnpackLog(event, "CreditBetForfeited", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolCreditBetLockedIterator is returned from FilterCreditBetLocked and is used to iterate over the raw logs and unpacked data for CreditBetLocked events raised by the BettingPool contract.
type BettingPoolCreditBetLockedIterator struct {
	Event *BettingPoolCreditBetLocked // Event containing the contract specifics and raw log

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
func (it *BettingPoolCreditBetLockedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolCreditBetLocked)
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
		it.Event = new(BettingPoolCreditBetLocked)
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
func (it *BettingPoolCreditBetLockedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolCreditBetLockedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolCreditBetLocked represents a CreditBetLocked event raised by the BettingPool contract.
type BettingPoolCreditBetLocked struct {
	BetId           [32]byte
	CollateralBetId [32]byte
	User            common.Address
	Amount          *big.Int
	Raw             types.Log // Blockchain specific contextual infos
}

// FilterCreditBetLocked is a free log retrieval operation binding the contract event 0x45590627069c060abf57ddcd68044b1324f98998654980b4a7578af6597e64f0.
//
// Solidity: event CreditBetLocked(bytes32 indexed betId, bytes32 indexed collateralBetId, address indexed user, uint256 amount)
func (_BettingPool *BettingPoolFilterer) FilterCreditBetLocked(opts *bind.FilterOpts, betId [][32]byte, collateralBetId [][32]byte, user []common.Address) (*BettingPoolCreditBetLockedIterator, error) {

	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}
	var collateralBetIdRule []interface{}
	for _, collateralBetIdItem := range collateralBetId {
		collateralBetIdRule = append(collateralBetIdRule, collateralBetIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "CreditBetLocked", betIdRule, collateralBetIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolCreditBetLockedIterator{contract: _BettingPool.contract, event: "CreditBetLocked", logs: logs, sub: sub}, nil
}

// WatchCreditBetLocked is a free log subscription operation binding the contract event 0x45590627069c060abf57ddcd68044b1324f98998654980b4a7578af6597e64f0.
//
// Solidity: event CreditBetLocked(bytes32 indexed betId, bytes32 indexed collateralBetId, address indexed user, uint256 amount)
func (_BettingPool *BettingPoolFilterer) WatchCreditBetLocked(opts *bind.WatchOpts, sink chan<- *BettingPoolCreditBetLocked, betId [][32]byte, collateralBetId [][32]byte, user []common.Address) (event.Subscription, error) {

	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}
	var collateralBetIdRule []interface{}
	for _, collateralBetIdItem := range collateralBetId {
		collateralBetIdRule = append(collateralBetIdRule, collateralBetIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "CreditBetLocked", betIdRule, collateralBetIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolCreditBetLocked)
				if err := _BettingPool.contract.UnpackLog(event, "CreditBetLocked", log); err != nil {
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

// ParseCreditBetLocked is a log parse operation binding the contract event 0x45590627069c060abf57ddcd68044b1324f98998654980b4a7578af6597e64f0.
//
// Solidity: event CreditBetLocked(bytes32 indexed betId, bytes32 indexed collateralBetId, address indexed user, uint256 amount)
func (_BettingPool *BettingPoolFilterer) ParseCreditBetLocked(log types.Log) (*BettingPoolCreditBetLocked, error) {
	event := new(BettingPoolCreditBetLocked)
	if err := _BettingPool.contract.UnpackLog(event, "CreditBetLocked", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolCreditBetSettledIterator is returned from FilterCreditBetSettled and is used to iterate over the raw logs and unpacked data for CreditBetSettled events raised by the BettingPool contract.
type BettingPoolCreditBetSettledIterator struct {
	Event *BettingPoolCreditBetSettled // Event containing the contract specifics and raw log

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
func (it *BettingPoolCreditBetSettledIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolCreditBetSettled)
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
		it.Event = new(BettingPoolCreditBetSettled)
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
func (it *BettingPoolCreditBetSettledIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolCreditBetSettledIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolCreditBetSettled represents a CreditBetSettled event raised by the BettingPool contract.
type BettingPoolCreditBetSettled struct {
	BetId     [32]byte
	User      common.Address
	Status    uint8
	Payout    *big.Int
	Deduction *big.Int
	Raw       types.Log // Blockchain specific contextual infos
}

// FilterCreditBetSettled is a free log retrieval operation binding the contract event 0x46bd16227fac5e0f3ad020a9f103b9bee394810fe47cad0d42303cae9816535d.
//
// Solidity: event CreditBetSettled(bytes32 indexed betId, address indexed user, uint8 status, uint256 payout, uint256 deduction)
func (_BettingPool *BettingPoolFilterer) FilterCreditBetSettled(opts *bind.FilterOpts, betId [][32]byte, user []common.Address) (*BettingPoolCreditBetSettledIterator, error) {

	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "CreditBetSettled", betIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolCreditBetSettledIterator{contract: _BettingPool.contract, event: "CreditBetSettled", logs: logs, sub: sub}, nil
}

// WatchCreditBetSettled is a free log subscription operation binding the contract event 0x46bd16227fac5e0f3ad020a9f103b9bee394810fe47cad0d42303cae9816535d.
//
// Solidity: event CreditBetSettled(bytes32 indexed betId, address indexed user, uint8 status, uint256 payout, uint256 deduction)
func (_BettingPool *BettingPoolFilterer) WatchCreditBetSettled(opts *bind.WatchOpts, sink chan<- *BettingPoolCreditBetSettled, betId [][32]byte, user []common.Address) (event.Subscription, error) {

	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "CreditBetSettled", betIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolCreditBetSettled)
				if err := _BettingPool.contract.UnpackLog(event, "CreditBetSettled", log); err != nil {
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

// ParseCreditBetSettled is a log parse operation binding the contract event 0x46bd16227fac5e0f3ad020a9f103b9bee394810fe47cad0d42303cae9816535d.
//
// Solidity: event CreditBetSettled(bytes32 indexed betId, address indexed user, uint8 status, uint256 payout, uint256 deduction)
func (_BettingPool *BettingPoolFilterer) ParseCreditBetSettled(log types.Log) (*BettingPoolCreditBetSettled, error) {
	event := new(BettingPoolCreditBetSettled)
	if err := _BettingPool.contract.UnpackLog(event, "CreditBetSettled", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolCreditCollateralCancelledIterator is returned from FilterCreditCollateralCancelled and is used to iterate over the raw logs and unpacked data for CreditCollateralCancelled events raised by the BettingPool contract.
type BettingPoolCreditCollateralCancelledIterator struct {
	Event *BettingPoolCreditCollateralCancelled // Event containing the contract specifics and raw log

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
func (it *BettingPoolCreditCollateralCancelledIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolCreditCollateralCancelled)
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
		it.Event = new(BettingPoolCreditCollateralCancelled)
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
func (it *BettingPoolCreditCollateralCancelledIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolCreditCollateralCancelledIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolCreditCollateralCancelled represents a CreditCollateralCancelled event raised by the BettingPool contract.
type BettingPoolCreditCollateralCancelled struct {
	BetId           [32]byte
	CollateralBetId [32]byte
	Amount          *big.Int
	Raw             types.Log // Blockchain specific contextual infos
}

// FilterCreditCollateralCancelled is a free log retrieval operation binding the contract event 0x21fc79fb620494002db7650f225e169207ff213e945223c527eb3277cd8b3b35.
//
// Solidity: event CreditCollateralCancelled(bytes32 indexed betId, bytes32 indexed collateralBetId, uint256 amount)
func (_BettingPool *BettingPoolFilterer) FilterCreditCollateralCancelled(opts *bind.FilterOpts, betId [][32]byte, collateralBetId [][32]byte) (*BettingPoolCreditCollateralCancelledIterator, error) {

	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}
	var collateralBetIdRule []interface{}
	for _, collateralBetIdItem := range collateralBetId {
		collateralBetIdRule = append(collateralBetIdRule, collateralBetIdItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "CreditCollateralCancelled", betIdRule, collateralBetIdRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolCreditCollateralCancelledIterator{contract: _BettingPool.contract, event: "CreditCollateralCancelled", logs: logs, sub: sub}, nil
}

// WatchCreditCollateralCancelled is a free log subscription operation binding the contract event 0x21fc79fb620494002db7650f225e169207ff213e945223c527eb3277cd8b3b35.
//
// Solidity: event CreditCollateralCancelled(bytes32 indexed betId, bytes32 indexed collateralBetId, uint256 amount)
func (_BettingPool *BettingPoolFilterer) WatchCreditCollateralCancelled(opts *bind.WatchOpts, sink chan<- *BettingPoolCreditCollateralCancelled, betId [][32]byte, collateralBetId [][32]byte) (event.Subscription, error) {

	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}
	var collateralBetIdRule []interface{}
	for _, collateralBetIdItem := range collateralBetId {
		collateralBetIdRule = append(collateralBetIdRule, collateralBetIdItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "CreditCollateralCancelled", betIdRule, collateralBetIdRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolCreditCollateralCancelled)
				if err := _BettingPool.contract.UnpackLog(event, "CreditCollateralCancelled", log); err != nil {
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

// ParseCreditCollateralCancelled is a log parse operation binding the contract event 0x21fc79fb620494002db7650f225e169207ff213e945223c527eb3277cd8b3b35.
//
// Solidity: event CreditCollateralCancelled(bytes32 indexed betId, bytes32 indexed collateralBetId, uint256 amount)
func (_BettingPool *BettingPoolFilterer) ParseCreditCollateralCancelled(log types.Log) (*BettingPoolCreditCollateralCancelled, error) {
	event := new(BettingPoolCreditCollateralCancelled)
	if err := _BettingPool.contract.UnpackLog(event, "CreditCollateralCancelled", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolCreditPayoutForfeitedIterator is returned from FilterCreditPayoutForfeited and is used to iterate over the raw logs and unpacked data for CreditPayoutForfeited events raised by the BettingPool contract.
type BettingPoolCreditPayoutForfeitedIterator struct {
	Event *BettingPoolCreditPayoutForfeited // Event containing the contract specifics and raw log

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
func (it *BettingPoolCreditPayoutForfeitedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolCreditPayoutForfeited)
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
		it.Event = new(BettingPoolCreditPayoutForfeited)
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
func (it *BettingPoolCreditPayoutForfeitedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolCreditPayoutForfeitedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolCreditPayoutForfeited represents a CreditPayoutForfeited event raised by the BettingPool contract.
type BettingPoolCreditPayoutForfeited struct {
	BetId  [32]byte
	Payout *big.Int
	Raw    types.Log // Blockchain specific contextual infos
}

// FilterCreditPayoutForfeited is a free log retrieval operation binding the contract event 0xe5e9fe4d75a12e2207dc162d901e96fe982a89e3f2ecad12320ab30ac24e0216.
//
// Solidity: event CreditPayoutForfeited(bytes32 indexed betId, uint256 payout)
func (_BettingPool *BettingPoolFilterer) FilterCreditPayoutForfeited(opts *bind.FilterOpts, betId [][32]byte) (*BettingPoolCreditPayoutForfeitedIterator, error) {

	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "CreditPayoutForfeited", betIdRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolCreditPayoutForfeitedIterator{contract: _BettingPool.contract, event: "CreditPayoutForfeited", logs: logs, sub: sub}, nil
}

// WatchCreditPayoutForfeited is a free log subscription operation binding the contract event 0xe5e9fe4d75a12e2207dc162d901e96fe982a89e3f2ecad12320ab30ac24e0216.
//
// Solidity: event CreditPayoutForfeited(bytes32 indexed betId, uint256 payout)
func (_BettingPool *BettingPoolFilterer) WatchCreditPayoutForfeited(opts *bind.WatchOpts, sink chan<- *BettingPoolCreditPayoutForfeited, betId [][32]byte) (event.Subscription, error) {

	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "CreditPayoutForfeited", betIdRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolCreditPayoutForfeited)
				if err := _BettingPool.contract.UnpackLog(event, "CreditPayoutForfeited", log); err != nil {
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

// ParseCreditPayoutForfeited is a log parse operation binding the contract event 0xe5e9fe4d75a12e2207dc162d901e96fe982a89e3f2ecad12320ab30ac24e0216.
//
// Solidity: event CreditPayoutForfeited(bytes32 indexed betId, uint256 payout)
func (_BettingPool *BettingPoolFilterer) ParseCreditPayoutForfeited(log types.Log) (*BettingPoolCreditPayoutForfeited, error) {
	event := new(BettingPoolCreditPayoutForfeited)
	if err := _BettingPool.contract.UnpackLog(event, "CreditPayoutForfeited", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolCreditPayoutFrozenIterator is returned from FilterCreditPayoutFrozen and is used to iterate over the raw logs and unpacked data for CreditPayoutFrozen events raised by the BettingPool contract.
type BettingPoolCreditPayoutFrozenIterator struct {
	Event *BettingPoolCreditPayoutFrozen // Event containing the contract specifics and raw log

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
func (it *BettingPoolCreditPayoutFrozenIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolCreditPayoutFrozen)
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
		it.Event = new(BettingPoolCreditPayoutFrozen)
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
func (it *BettingPoolCreditPayoutFrozenIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolCreditPayoutFrozenIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolCreditPayoutFrozen represents a CreditPayoutFrozen event raised by the BettingPool contract.
type BettingPoolCreditPayoutFrozen struct {
	BetId  [32]byte
	User   common.Address
	Payout *big.Int
	Raw    types.Log // Blockchain specific contextual infos
}

// FilterCreditPayoutFrozen is a free log retrieval operation binding the contract event 0xabbd0802aac5941d78c0b75e496d313874b7fa632a8c73699ac36a06eacb6c58.
//
// Solidity: event CreditPayoutFrozen(bytes32 indexed betId, address indexed user, uint256 payout)
func (_BettingPool *BettingPoolFilterer) FilterCreditPayoutFrozen(opts *bind.FilterOpts, betId [][32]byte, user []common.Address) (*BettingPoolCreditPayoutFrozenIterator, error) {

	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "CreditPayoutFrozen", betIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolCreditPayoutFrozenIterator{contract: _BettingPool.contract, event: "CreditPayoutFrozen", logs: logs, sub: sub}, nil
}

// WatchCreditPayoutFrozen is a free log subscription operation binding the contract event 0xabbd0802aac5941d78c0b75e496d313874b7fa632a8c73699ac36a06eacb6c58.
//
// Solidity: event CreditPayoutFrozen(bytes32 indexed betId, address indexed user, uint256 payout)
func (_BettingPool *BettingPoolFilterer) WatchCreditPayoutFrozen(opts *bind.WatchOpts, sink chan<- *BettingPoolCreditPayoutFrozen, betId [][32]byte, user []common.Address) (event.Subscription, error) {

	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "CreditPayoutFrozen", betIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolCreditPayoutFrozen)
				if err := _BettingPool.contract.UnpackLog(event, "CreditPayoutFrozen", log); err != nil {
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

// ParseCreditPayoutFrozen is a log parse operation binding the contract event 0xabbd0802aac5941d78c0b75e496d313874b7fa632a8c73699ac36a06eacb6c58.
//
// Solidity: event CreditPayoutFrozen(bytes32 indexed betId, address indexed user, uint256 payout)
func (_BettingPool *BettingPoolFilterer) ParseCreditPayoutFrozen(log types.Log) (*BettingPoolCreditPayoutFrozen, error) {
	event := new(BettingPoolCreditPayoutFrozen)
	if err := _BettingPool.contract.UnpackLog(event, "CreditPayoutFrozen", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolCreditPayoutReleasedIterator is returned from FilterCreditPayoutReleased and is used to iterate over the raw logs and unpacked data for CreditPayoutReleased events raised by the BettingPool contract.
type BettingPoolCreditPayoutReleasedIterator struct {
	Event *BettingPoolCreditPayoutReleased // Event containing the contract specifics and raw log

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
func (it *BettingPoolCreditPayoutReleasedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolCreditPayoutReleased)
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
		it.Event = new(BettingPoolCreditPayoutReleased)
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
func (it *BettingPoolCreditPayoutReleasedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolCreditPayoutReleasedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolCreditPayoutReleased represents a CreditPayoutReleased event raised by the BettingPool contract.
type BettingPoolCreditPayoutReleased struct {
	BetId     [32]byte
	User      common.Address
	NetPayout *big.Int
	Raw       types.Log // Blockchain specific contextual infos
}

// FilterCreditPayoutReleased is a free log retrieval operation binding the contract event 0x9fc13668ad3b782383b9d58b0e5e87719d34f8fccf466dccf9bd78668547c288.
//
// Solidity: event CreditPayoutReleased(bytes32 indexed betId, address indexed user, uint256 netPayout)
func (_BettingPool *BettingPoolFilterer) FilterCreditPayoutReleased(opts *bind.FilterOpts, betId [][32]byte, user []common.Address) (*BettingPoolCreditPayoutReleasedIterator, error) {

	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "CreditPayoutReleased", betIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolCreditPayoutReleasedIterator{contract: _BettingPool.contract, event: "CreditPayoutReleased", logs: logs, sub: sub}, nil
}

// WatchCreditPayoutReleased is a free log subscription operation binding the contract event 0x9fc13668ad3b782383b9d58b0e5e87719d34f8fccf466dccf9bd78668547c288.
//
// Solidity: event CreditPayoutReleased(bytes32 indexed betId, address indexed user, uint256 netPayout)
func (_BettingPool *BettingPoolFilterer) WatchCreditPayoutReleased(opts *bind.WatchOpts, sink chan<- *BettingPoolCreditPayoutReleased, betId [][32]byte, user []common.Address) (event.Subscription, error) {

	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "CreditPayoutReleased", betIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolCreditPayoutReleased)
				if err := _BettingPool.contract.UnpackLog(event, "CreditPayoutReleased", log); err != nil {
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

// ParseCreditPayoutReleased is a log parse operation binding the contract event 0x9fc13668ad3b782383b9d58b0e5e87719d34f8fccf466dccf9bd78668547c288.
//
// Solidity: event CreditPayoutReleased(bytes32 indexed betId, address indexed user, uint256 netPayout)
func (_BettingPool *BettingPoolFilterer) ParseCreditPayoutReleased(log types.Log) (*BettingPoolCreditPayoutReleased, error) {
	event := new(BettingPoolCreditPayoutReleased)
	if err := _BettingPool.contract.UnpackLog(event, "CreditPayoutReleased", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolDepositedIterator is returned from FilterDeposited and is used to iterate over the raw logs and unpacked data for Deposited events raised by the BettingPool contract.
type BettingPoolDepositedIterator struct {
	Event *BettingPoolDeposited // Event containing the contract specifics and raw log

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
func (it *BettingPoolDepositedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolDeposited)
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
		it.Event = new(BettingPoolDeposited)
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
func (it *BettingPoolDepositedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolDepositedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolDeposited represents a Deposited event raised by the BettingPool contract.
type BettingPoolDeposited struct {
	User   common.Address
	Amount *big.Int
	TxHash [32]byte
	Raw    types.Log // Blockchain specific contextual infos
}

// FilterDeposited is a free log retrieval operation binding the contract event 0xd7eda976cf4919f13172eb15bb39c64cecb7172258c741dab31d14c855eff402.
//
// Solidity: event Deposited(address indexed user, uint256 amount, bytes32 indexed txHash)
func (_BettingPool *BettingPoolFilterer) FilterDeposited(opts *bind.FilterOpts, user []common.Address, txHash [][32]byte) (*BettingPoolDepositedIterator, error) {

	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	var txHashRule []interface{}
	for _, txHashItem := range txHash {
		txHashRule = append(txHashRule, txHashItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "Deposited", userRule, txHashRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolDepositedIterator{contract: _BettingPool.contract, event: "Deposited", logs: logs, sub: sub}, nil
}

// WatchDeposited is a free log subscription operation binding the contract event 0xd7eda976cf4919f13172eb15bb39c64cecb7172258c741dab31d14c855eff402.
//
// Solidity: event Deposited(address indexed user, uint256 amount, bytes32 indexed txHash)
func (_BettingPool *BettingPoolFilterer) WatchDeposited(opts *bind.WatchOpts, sink chan<- *BettingPoolDeposited, user []common.Address, txHash [][32]byte) (event.Subscription, error) {

	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	var txHashRule []interface{}
	for _, txHashItem := range txHash {
		txHashRule = append(txHashRule, txHashItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "Deposited", userRule, txHashRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolDeposited)
				if err := _BettingPool.contract.UnpackLog(event, "Deposited", log); err != nil {
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

// ParseDeposited is a log parse operation binding the contract event 0xd7eda976cf4919f13172eb15bb39c64cecb7172258c741dab31d14c855eff402.
//
// Solidity: event Deposited(address indexed user, uint256 amount, bytes32 indexed txHash)
func (_BettingPool *BettingPoolFilterer) ParseDeposited(log types.Log) (*BettingPoolDeposited, error) {
	event := new(BettingPoolDeposited)
	if err := _BettingPool.contract.UnpackLog(event, "Deposited", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolInitializedIterator is returned from FilterInitialized and is used to iterate over the raw logs and unpacked data for Initialized events raised by the BettingPool contract.
type BettingPoolInitializedIterator struct {
	Event *BettingPoolInitialized // Event containing the contract specifics and raw log

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
func (it *BettingPoolInitializedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolInitialized)
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
		it.Event = new(BettingPoolInitialized)
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
func (it *BettingPoolInitializedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolInitializedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolInitialized represents a Initialized event raised by the BettingPool contract.
type BettingPoolInitialized struct {
	Version uint64
	Raw     types.Log // Blockchain specific contextual infos
}

// FilterInitialized is a free log retrieval operation binding the contract event 0xc7f505b2f371ae2175ee4913f4499e1f2633a7b5936321eed1cdaeb6115181d2.
//
// Solidity: event Initialized(uint64 version)
func (_BettingPool *BettingPoolFilterer) FilterInitialized(opts *bind.FilterOpts) (*BettingPoolInitializedIterator, error) {

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "Initialized")
	if err != nil {
		return nil, err
	}
	return &BettingPoolInitializedIterator{contract: _BettingPool.contract, event: "Initialized", logs: logs, sub: sub}, nil
}

// WatchInitialized is a free log subscription operation binding the contract event 0xc7f505b2f371ae2175ee4913f4499e1f2633a7b5936321eed1cdaeb6115181d2.
//
// Solidity: event Initialized(uint64 version)
func (_BettingPool *BettingPoolFilterer) WatchInitialized(opts *bind.WatchOpts, sink chan<- *BettingPoolInitialized) (event.Subscription, error) {

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "Initialized")
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolInitialized)
				if err := _BettingPool.contract.UnpackLog(event, "Initialized", log); err != nil {
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
func (_BettingPool *BettingPoolFilterer) ParseInitialized(log types.Log) (*BettingPoolInitialized, error) {
	event := new(BettingPoolInitialized)
	if err := _BettingPool.contract.UnpackLog(event, "Initialized", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolLargeWithdrawalRejectedIterator is returned from FilterLargeWithdrawalRejected and is used to iterate over the raw logs and unpacked data for LargeWithdrawalRejected events raised by the BettingPool contract.
type BettingPoolLargeWithdrawalRejectedIterator struct {
	Event *BettingPoolLargeWithdrawalRejected // Event containing the contract specifics and raw log

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
func (it *BettingPoolLargeWithdrawalRejectedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolLargeWithdrawalRejected)
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
		it.Event = new(BettingPoolLargeWithdrawalRejected)
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
func (it *BettingPoolLargeWithdrawalRejectedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolLargeWithdrawalRejectedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolLargeWithdrawalRejected represents a LargeWithdrawalRejected event raised by the BettingPool contract.
type BettingPoolLargeWithdrawalRejected struct {
	RequestId [32]byte
	User      common.Address
	Amount    *big.Int
	Raw       types.Log // Blockchain specific contextual infos
}

// FilterLargeWithdrawalRejected is a free log retrieval operation binding the contract event 0x358c3332f6fa2856fa09728720955205c550a1ed779b0352fe71e05793815d22.
//
// Solidity: event LargeWithdrawalRejected(bytes32 indexed requestId, address indexed user, uint256 amount)
func (_BettingPool *BettingPoolFilterer) FilterLargeWithdrawalRejected(opts *bind.FilterOpts, requestId [][32]byte, user []common.Address) (*BettingPoolLargeWithdrawalRejectedIterator, error) {

	var requestIdRule []interface{}
	for _, requestIdItem := range requestId {
		requestIdRule = append(requestIdRule, requestIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "LargeWithdrawalRejected", requestIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolLargeWithdrawalRejectedIterator{contract: _BettingPool.contract, event: "LargeWithdrawalRejected", logs: logs, sub: sub}, nil
}

// WatchLargeWithdrawalRejected is a free log subscription operation binding the contract event 0x358c3332f6fa2856fa09728720955205c550a1ed779b0352fe71e05793815d22.
//
// Solidity: event LargeWithdrawalRejected(bytes32 indexed requestId, address indexed user, uint256 amount)
func (_BettingPool *BettingPoolFilterer) WatchLargeWithdrawalRejected(opts *bind.WatchOpts, sink chan<- *BettingPoolLargeWithdrawalRejected, requestId [][32]byte, user []common.Address) (event.Subscription, error) {

	var requestIdRule []interface{}
	for _, requestIdItem := range requestId {
		requestIdRule = append(requestIdRule, requestIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "LargeWithdrawalRejected", requestIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolLargeWithdrawalRejected)
				if err := _BettingPool.contract.UnpackLog(event, "LargeWithdrawalRejected", log); err != nil {
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

// ParseLargeWithdrawalRejected is a log parse operation binding the contract event 0x358c3332f6fa2856fa09728720955205c550a1ed779b0352fe71e05793815d22.
//
// Solidity: event LargeWithdrawalRejected(bytes32 indexed requestId, address indexed user, uint256 amount)
func (_BettingPool *BettingPoolFilterer) ParseLargeWithdrawalRejected(log types.Log) (*BettingPoolLargeWithdrawalRejected, error) {
	event := new(BettingPoolLargeWithdrawalRejected)
	if err := _BettingPool.contract.UnpackLog(event, "LargeWithdrawalRejected", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolLargeWithdrawalRequestedIterator is returned from FilterLargeWithdrawalRequested and is used to iterate over the raw logs and unpacked data for LargeWithdrawalRequested events raised by the BettingPool contract.
type BettingPoolLargeWithdrawalRequestedIterator struct {
	Event *BettingPoolLargeWithdrawalRequested // Event containing the contract specifics and raw log

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
func (it *BettingPoolLargeWithdrawalRequestedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolLargeWithdrawalRequested)
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
		it.Event = new(BettingPoolLargeWithdrawalRequested)
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
func (it *BettingPoolLargeWithdrawalRequestedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolLargeWithdrawalRequestedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolLargeWithdrawalRequested represents a LargeWithdrawalRequested event raised by the BettingPool contract.
type BettingPoolLargeWithdrawalRequested struct {
	RequestId [32]byte
	User      common.Address
	Amount    *big.Int
	Raw       types.Log // Blockchain specific contextual infos
}

// FilterLargeWithdrawalRequested is a free log retrieval operation binding the contract event 0xd89576f718d00c0a3daaec20fae2e79b3f19954ad30c03819dfc63f4863f8334.
//
// Solidity: event LargeWithdrawalRequested(bytes32 indexed requestId, address indexed user, uint256 amount)
func (_BettingPool *BettingPoolFilterer) FilterLargeWithdrawalRequested(opts *bind.FilterOpts, requestId [][32]byte, user []common.Address) (*BettingPoolLargeWithdrawalRequestedIterator, error) {

	var requestIdRule []interface{}
	for _, requestIdItem := range requestId {
		requestIdRule = append(requestIdRule, requestIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "LargeWithdrawalRequested", requestIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolLargeWithdrawalRequestedIterator{contract: _BettingPool.contract, event: "LargeWithdrawalRequested", logs: logs, sub: sub}, nil
}

// WatchLargeWithdrawalRequested is a free log subscription operation binding the contract event 0xd89576f718d00c0a3daaec20fae2e79b3f19954ad30c03819dfc63f4863f8334.
//
// Solidity: event LargeWithdrawalRequested(bytes32 indexed requestId, address indexed user, uint256 amount)
func (_BettingPool *BettingPoolFilterer) WatchLargeWithdrawalRequested(opts *bind.WatchOpts, sink chan<- *BettingPoolLargeWithdrawalRequested, requestId [][32]byte, user []common.Address) (event.Subscription, error) {

	var requestIdRule []interface{}
	for _, requestIdItem := range requestId {
		requestIdRule = append(requestIdRule, requestIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "LargeWithdrawalRequested", requestIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolLargeWithdrawalRequested)
				if err := _BettingPool.contract.UnpackLog(event, "LargeWithdrawalRequested", log); err != nil {
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

// ParseLargeWithdrawalRequested is a log parse operation binding the contract event 0xd89576f718d00c0a3daaec20fae2e79b3f19954ad30c03819dfc63f4863f8334.
//
// Solidity: event LargeWithdrawalRequested(bytes32 indexed requestId, address indexed user, uint256 amount)
func (_BettingPool *BettingPoolFilterer) ParseLargeWithdrawalRequested(log types.Log) (*BettingPoolLargeWithdrawalRequested, error) {
	event := new(BettingPoolLargeWithdrawalRequested)
	if err := _BettingPool.contract.UnpackLog(event, "LargeWithdrawalRequested", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolLiquidityAddedIterator is returned from FilterLiquidityAdded and is used to iterate over the raw logs and unpacked data for LiquidityAdded events raised by the BettingPool contract.
type BettingPoolLiquidityAddedIterator struct {
	Event *BettingPoolLiquidityAdded // Event containing the contract specifics and raw log

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
func (it *BettingPoolLiquidityAddedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolLiquidityAdded)
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
		it.Event = new(BettingPoolLiquidityAdded)
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
func (it *BettingPoolLiquidityAddedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolLiquidityAddedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolLiquidityAdded represents a LiquidityAdded event raised by the BettingPool contract.
type BettingPoolLiquidityAdded struct {
	Provider common.Address
	Amount   *big.Int
	Shares   *big.Int
	Raw      types.Log // Blockchain specific contextual infos
}

// FilterLiquidityAdded is a free log retrieval operation binding the contract event 0xac1d76749e5447b7b16f5ab61447e1bd502f3bb4807af3b28e620d1700a6ee45.
//
// Solidity: event LiquidityAdded(address indexed provider, uint256 amount, uint256 shares)
func (_BettingPool *BettingPoolFilterer) FilterLiquidityAdded(opts *bind.FilterOpts, provider []common.Address) (*BettingPoolLiquidityAddedIterator, error) {

	var providerRule []interface{}
	for _, providerItem := range provider {
		providerRule = append(providerRule, providerItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "LiquidityAdded", providerRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolLiquidityAddedIterator{contract: _BettingPool.contract, event: "LiquidityAdded", logs: logs, sub: sub}, nil
}

// WatchLiquidityAdded is a free log subscription operation binding the contract event 0xac1d76749e5447b7b16f5ab61447e1bd502f3bb4807af3b28e620d1700a6ee45.
//
// Solidity: event LiquidityAdded(address indexed provider, uint256 amount, uint256 shares)
func (_BettingPool *BettingPoolFilterer) WatchLiquidityAdded(opts *bind.WatchOpts, sink chan<- *BettingPoolLiquidityAdded, provider []common.Address) (event.Subscription, error) {

	var providerRule []interface{}
	for _, providerItem := range provider {
		providerRule = append(providerRule, providerItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "LiquidityAdded", providerRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolLiquidityAdded)
				if err := _BettingPool.contract.UnpackLog(event, "LiquidityAdded", log); err != nil {
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

// ParseLiquidityAdded is a log parse operation binding the contract event 0xac1d76749e5447b7b16f5ab61447e1bd502f3bb4807af3b28e620d1700a6ee45.
//
// Solidity: event LiquidityAdded(address indexed provider, uint256 amount, uint256 shares)
func (_BettingPool *BettingPoolFilterer) ParseLiquidityAdded(log types.Log) (*BettingPoolLiquidityAdded, error) {
	event := new(BettingPoolLiquidityAdded)
	if err := _BettingPool.contract.UnpackLog(event, "LiquidityAdded", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolLiquidityRemovedIterator is returned from FilterLiquidityRemoved and is used to iterate over the raw logs and unpacked data for LiquidityRemoved events raised by the BettingPool contract.
type BettingPoolLiquidityRemovedIterator struct {
	Event *BettingPoolLiquidityRemoved // Event containing the contract specifics and raw log

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
func (it *BettingPoolLiquidityRemovedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolLiquidityRemoved)
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
		it.Event = new(BettingPoolLiquidityRemoved)
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
func (it *BettingPoolLiquidityRemovedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolLiquidityRemovedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolLiquidityRemoved represents a LiquidityRemoved event raised by the BettingPool contract.
type BettingPoolLiquidityRemoved struct {
	Provider common.Address
	Amount   *big.Int
	Shares   *big.Int
	Raw      types.Log // Blockchain specific contextual infos
}

// FilterLiquidityRemoved is a free log retrieval operation binding the contract event 0x96cd817c6329656790ef8fba7675405193677d39619571282f5e21f3a98cd059.
//
// Solidity: event LiquidityRemoved(address indexed provider, uint256 amount, uint256 shares)
func (_BettingPool *BettingPoolFilterer) FilterLiquidityRemoved(opts *bind.FilterOpts, provider []common.Address) (*BettingPoolLiquidityRemovedIterator, error) {

	var providerRule []interface{}
	for _, providerItem := range provider {
		providerRule = append(providerRule, providerItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "LiquidityRemoved", providerRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolLiquidityRemovedIterator{contract: _BettingPool.contract, event: "LiquidityRemoved", logs: logs, sub: sub}, nil
}

// WatchLiquidityRemoved is a free log subscription operation binding the contract event 0x96cd817c6329656790ef8fba7675405193677d39619571282f5e21f3a98cd059.
//
// Solidity: event LiquidityRemoved(address indexed provider, uint256 amount, uint256 shares)
func (_BettingPool *BettingPoolFilterer) WatchLiquidityRemoved(opts *bind.WatchOpts, sink chan<- *BettingPoolLiquidityRemoved, provider []common.Address) (event.Subscription, error) {

	var providerRule []interface{}
	for _, providerItem := range provider {
		providerRule = append(providerRule, providerItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "LiquidityRemoved", providerRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolLiquidityRemoved)
				if err := _BettingPool.contract.UnpackLog(event, "LiquidityRemoved", log); err != nil {
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

// ParseLiquidityRemoved is a log parse operation binding the contract event 0x96cd817c6329656790ef8fba7675405193677d39619571282f5e21f3a98cd059.
//
// Solidity: event LiquidityRemoved(address indexed provider, uint256 amount, uint256 shares)
func (_BettingPool *BettingPoolFilterer) ParseLiquidityRemoved(log types.Log) (*BettingPoolLiquidityRemoved, error) {
	event := new(BettingPoolLiquidityRemoved)
	if err := _BettingPool.contract.UnpackLog(event, "LiquidityRemoved", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolLpShareBpsUpdatedIterator is returned from FilterLpShareBpsUpdated and is used to iterate over the raw logs and unpacked data for LpShareBpsUpdated events raised by the BettingPool contract.
type BettingPoolLpShareBpsUpdatedIterator struct {
	Event *BettingPoolLpShareBpsUpdated // Event containing the contract specifics and raw log

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
func (it *BettingPoolLpShareBpsUpdatedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolLpShareBpsUpdated)
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
		it.Event = new(BettingPoolLpShareBpsUpdated)
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
func (it *BettingPoolLpShareBpsUpdatedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolLpShareBpsUpdatedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolLpShareBpsUpdated represents a LpShareBpsUpdated event raised by the BettingPool contract.
type BettingPoolLpShareBpsUpdated struct {
	OldBps *big.Int
	NewBps *big.Int
	Raw    types.Log // Blockchain specific contextual infos
}

// FilterLpShareBpsUpdated is a free log retrieval operation binding the contract event 0x6d2d09caed0d3badb9e1336a313b044725487a5adc1acdbc0e72fd3909b1b192.
//
// Solidity: event LpShareBpsUpdated(uint256 oldBps, uint256 newBps)
func (_BettingPool *BettingPoolFilterer) FilterLpShareBpsUpdated(opts *bind.FilterOpts) (*BettingPoolLpShareBpsUpdatedIterator, error) {

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "LpShareBpsUpdated")
	if err != nil {
		return nil, err
	}
	return &BettingPoolLpShareBpsUpdatedIterator{contract: _BettingPool.contract, event: "LpShareBpsUpdated", logs: logs, sub: sub}, nil
}

// WatchLpShareBpsUpdated is a free log subscription operation binding the contract event 0x6d2d09caed0d3badb9e1336a313b044725487a5adc1acdbc0e72fd3909b1b192.
//
// Solidity: event LpShareBpsUpdated(uint256 oldBps, uint256 newBps)
func (_BettingPool *BettingPoolFilterer) WatchLpShareBpsUpdated(opts *bind.WatchOpts, sink chan<- *BettingPoolLpShareBpsUpdated) (event.Subscription, error) {

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "LpShareBpsUpdated")
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolLpShareBpsUpdated)
				if err := _BettingPool.contract.UnpackLog(event, "LpShareBpsUpdated", log); err != nil {
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

// ParseLpShareBpsUpdated is a log parse operation binding the contract event 0x6d2d09caed0d3badb9e1336a313b044725487a5adc1acdbc0e72fd3909b1b192.
//
// Solidity: event LpShareBpsUpdated(uint256 oldBps, uint256 newBps)
func (_BettingPool *BettingPoolFilterer) ParseLpShareBpsUpdated(log types.Log) (*BettingPoolLpShareBpsUpdated, error) {
	event := new(BettingPoolLpShareBpsUpdated)
	if err := _BettingPool.contract.UnpackLog(event, "LpShareBpsUpdated", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolMarketClosedIterator is returned from FilterMarketClosed and is used to iterate over the raw logs and unpacked data for MarketClosed events raised by the BettingPool contract.
type BettingPoolMarketClosedIterator struct {
	Event *BettingPoolMarketClosed // Event containing the contract specifics and raw log

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
func (it *BettingPoolMarketClosedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolMarketClosed)
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
		it.Event = new(BettingPoolMarketClosed)
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
func (it *BettingPoolMarketClosedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolMarketClosedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolMarketClosed represents a MarketClosed event raised by the BettingPool contract.
type BettingPoolMarketClosed struct {
	MatchId [32]byte
	Market  uint8
	Line    uint8
	Raw     types.Log // Blockchain specific contextual infos
}

// FilterMarketClosed is a free log retrieval operation binding the contract event 0xf7b6d64bac45f85c39986a67bd45eda1431a319baeecc405f085bc09804e8c51.
//
// Solidity: event MarketClosed(bytes32 indexed matchId, uint8 market, uint8 line)
func (_BettingPool *BettingPoolFilterer) FilterMarketClosed(opts *bind.FilterOpts, matchId [][32]byte) (*BettingPoolMarketClosedIterator, error) {

	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "MarketClosed", matchIdRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolMarketClosedIterator{contract: _BettingPool.contract, event: "MarketClosed", logs: logs, sub: sub}, nil
}

// WatchMarketClosed is a free log subscription operation binding the contract event 0xf7b6d64bac45f85c39986a67bd45eda1431a319baeecc405f085bc09804e8c51.
//
// Solidity: event MarketClosed(bytes32 indexed matchId, uint8 market, uint8 line)
func (_BettingPool *BettingPoolFilterer) WatchMarketClosed(opts *bind.WatchOpts, sink chan<- *BettingPoolMarketClosed, matchId [][32]byte) (event.Subscription, error) {

	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "MarketClosed", matchIdRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolMarketClosed)
				if err := _BettingPool.contract.UnpackLog(event, "MarketClosed", log); err != nil {
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

// ParseMarketClosed is a log parse operation binding the contract event 0xf7b6d64bac45f85c39986a67bd45eda1431a319baeecc405f085bc09804e8c51.
//
// Solidity: event MarketClosed(bytes32 indexed matchId, uint8 market, uint8 line)
func (_BettingPool *BettingPoolFilterer) ParseMarketClosed(log types.Log) (*BettingPoolMarketClosed, error) {
	event := new(BettingPoolMarketClosed)
	if err := _BettingPool.contract.UnpackLog(event, "MarketClosed", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolMarketOpenedIterator is returned from FilterMarketOpened and is used to iterate over the raw logs and unpacked data for MarketOpened events raised by the BettingPool contract.
type BettingPoolMarketOpenedIterator struct {
	Event *BettingPoolMarketOpened // Event containing the contract specifics and raw log

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
func (it *BettingPoolMarketOpenedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolMarketOpened)
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
		it.Event = new(BettingPoolMarketOpened)
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
func (it *BettingPoolMarketOpenedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolMarketOpenedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolMarketOpened represents a MarketOpened event raised by the BettingPool contract.
type BettingPoolMarketOpened struct {
	MatchId [32]byte
	Market  uint8
	Line    uint8
	Raw     types.Log // Blockchain specific contextual infos
}

// FilterMarketOpened is a free log retrieval operation binding the contract event 0x225dd0281c881e7f559101b5d73fae3203af78e619c0b7fb1ba31890691899ef.
//
// Solidity: event MarketOpened(bytes32 indexed matchId, uint8 market, uint8 line)
func (_BettingPool *BettingPoolFilterer) FilterMarketOpened(opts *bind.FilterOpts, matchId [][32]byte) (*BettingPoolMarketOpenedIterator, error) {

	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "MarketOpened", matchIdRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolMarketOpenedIterator{contract: _BettingPool.contract, event: "MarketOpened", logs: logs, sub: sub}, nil
}

// WatchMarketOpened is a free log subscription operation binding the contract event 0x225dd0281c881e7f559101b5d73fae3203af78e619c0b7fb1ba31890691899ef.
//
// Solidity: event MarketOpened(bytes32 indexed matchId, uint8 market, uint8 line)
func (_BettingPool *BettingPoolFilterer) WatchMarketOpened(opts *bind.WatchOpts, sink chan<- *BettingPoolMarketOpened, matchId [][32]byte) (event.Subscription, error) {

	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "MarketOpened", matchIdRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolMarketOpened)
				if err := _BettingPool.contract.UnpackLog(event, "MarketOpened", log); err != nil {
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

// ParseMarketOpened is a log parse operation binding the contract event 0x225dd0281c881e7f559101b5d73fae3203af78e619c0b7fb1ba31890691899ef.
//
// Solidity: event MarketOpened(bytes32 indexed matchId, uint8 market, uint8 line)
func (_BettingPool *BettingPoolFilterer) ParseMarketOpened(log types.Log) (*BettingPoolMarketOpened, error) {
	event := new(BettingPoolMarketOpened)
	if err := _BettingPool.contract.UnpackLog(event, "MarketOpened", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolMarketReopenedIterator is returned from FilterMarketReopened and is used to iterate over the raw logs and unpacked data for MarketReopened events raised by the BettingPool contract.
type BettingPoolMarketReopenedIterator struct {
	Event *BettingPoolMarketReopened // Event containing the contract specifics and raw log

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
func (it *BettingPoolMarketReopenedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolMarketReopened)
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
		it.Event = new(BettingPoolMarketReopened)
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
func (it *BettingPoolMarketReopenedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolMarketReopenedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolMarketReopened represents a MarketReopened event raised by the BettingPool contract.
type BettingPoolMarketReopened struct {
	MatchId [32]byte
	Market  uint8
	Line    uint8
	Raw     types.Log // Blockchain specific contextual infos
}

// FilterMarketReopened is a free log retrieval operation binding the contract event 0x8aad72d8ab0fc77cf20e379817c883c09c094358aba0119143a7ee0bec7083a3.
//
// Solidity: event MarketReopened(bytes32 indexed matchId, uint8 market, uint8 line)
func (_BettingPool *BettingPoolFilterer) FilterMarketReopened(opts *bind.FilterOpts, matchId [][32]byte) (*BettingPoolMarketReopenedIterator, error) {

	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "MarketReopened", matchIdRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolMarketReopenedIterator{contract: _BettingPool.contract, event: "MarketReopened", logs: logs, sub: sub}, nil
}

// WatchMarketReopened is a free log subscription operation binding the contract event 0x8aad72d8ab0fc77cf20e379817c883c09c094358aba0119143a7ee0bec7083a3.
//
// Solidity: event MarketReopened(bytes32 indexed matchId, uint8 market, uint8 line)
func (_BettingPool *BettingPoolFilterer) WatchMarketReopened(opts *bind.WatchOpts, sink chan<- *BettingPoolMarketReopened, matchId [][32]byte) (event.Subscription, error) {

	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "MarketReopened", matchIdRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolMarketReopened)
				if err := _BettingPool.contract.UnpackLog(event, "MarketReopened", log); err != nil {
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

// ParseMarketReopened is a log parse operation binding the contract event 0x8aad72d8ab0fc77cf20e379817c883c09c094358aba0119143a7ee0bec7083a3.
//
// Solidity: event MarketReopened(bytes32 indexed matchId, uint8 market, uint8 line)
func (_BettingPool *BettingPoolFilterer) ParseMarketReopened(log types.Log) (*BettingPoolMarketReopened, error) {
	event := new(BettingPoolMarketReopened)
	if err := _BettingPool.contract.UnpackLog(event, "MarketReopened", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolMatchCancelledIterator is returned from FilterMatchCancelled and is used to iterate over the raw logs and unpacked data for MatchCancelled events raised by the BettingPool contract.
type BettingPoolMatchCancelledIterator struct {
	Event *BettingPoolMatchCancelled // Event containing the contract specifics and raw log

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
func (it *BettingPoolMatchCancelledIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolMatchCancelled)
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
		it.Event = new(BettingPoolMatchCancelled)
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
func (it *BettingPoolMatchCancelledIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolMatchCancelledIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolMatchCancelled represents a MatchCancelled event raised by the BettingPool contract.
type BettingPoolMatchCancelled struct {
	MatchId [32]byte
	Market  uint8
	Line    uint8
	Raw     types.Log // Blockchain specific contextual infos
}

// FilterMatchCancelled is a free log retrieval operation binding the contract event 0xeb598a54b9dd43f7c70565ba7d58fed90b786ce30a3b4aeb2211d6a0fc4325e9.
//
// Solidity: event MatchCancelled(bytes32 indexed matchId, uint8 market, uint8 line)
func (_BettingPool *BettingPoolFilterer) FilterMatchCancelled(opts *bind.FilterOpts, matchId [][32]byte) (*BettingPoolMatchCancelledIterator, error) {

	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "MatchCancelled", matchIdRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolMatchCancelledIterator{contract: _BettingPool.contract, event: "MatchCancelled", logs: logs, sub: sub}, nil
}

// WatchMatchCancelled is a free log subscription operation binding the contract event 0xeb598a54b9dd43f7c70565ba7d58fed90b786ce30a3b4aeb2211d6a0fc4325e9.
//
// Solidity: event MatchCancelled(bytes32 indexed matchId, uint8 market, uint8 line)
func (_BettingPool *BettingPoolFilterer) WatchMatchCancelled(opts *bind.WatchOpts, sink chan<- *BettingPoolMatchCancelled, matchId [][32]byte) (event.Subscription, error) {

	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "MatchCancelled", matchIdRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolMatchCancelled)
				if err := _BettingPool.contract.UnpackLog(event, "MatchCancelled", log); err != nil {
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

// ParseMatchCancelled is a log parse operation binding the contract event 0xeb598a54b9dd43f7c70565ba7d58fed90b786ce30a3b4aeb2211d6a0fc4325e9.
//
// Solidity: event MatchCancelled(bytes32 indexed matchId, uint8 market, uint8 line)
func (_BettingPool *BettingPoolFilterer) ParseMatchCancelled(log types.Log) (*BettingPoolMatchCancelled, error) {
	event := new(BettingPoolMatchCancelled)
	if err := _BettingPool.contract.UnpackLog(event, "MatchCancelled", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolMatchSettledIterator is returned from FilterMatchSettled and is used to iterate over the raw logs and unpacked data for MatchSettled events raised by the BettingPool contract.
type BettingPoolMatchSettledIterator struct {
	Event *BettingPoolMatchSettled // Event containing the contract specifics and raw log

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
func (it *BettingPoolMatchSettledIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolMatchSettled)
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
		it.Event = new(BettingPoolMatchSettled)
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
func (it *BettingPoolMatchSettledIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolMatchSettledIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolMatchSettled represents a MatchSettled event raised by the BettingPool contract.
type BettingPoolMatchSettled struct {
	MatchId        [32]byte
	Market         uint8
	Line           uint8
	WinningOutcome uint8
	Raw            types.Log // Blockchain specific contextual infos
}

// FilterMatchSettled is a free log retrieval operation binding the contract event 0x6476a80f2c3baf6204e4e208f52c50568869522fd861874cec57208f5463d75c.
//
// Solidity: event MatchSettled(bytes32 indexed matchId, uint8 market, uint8 line, uint8 winningOutcome)
func (_BettingPool *BettingPoolFilterer) FilterMatchSettled(opts *bind.FilterOpts, matchId [][32]byte) (*BettingPoolMatchSettledIterator, error) {

	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "MatchSettled", matchIdRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolMatchSettledIterator{contract: _BettingPool.contract, event: "MatchSettled", logs: logs, sub: sub}, nil
}

// WatchMatchSettled is a free log subscription operation binding the contract event 0x6476a80f2c3baf6204e4e208f52c50568869522fd861874cec57208f5463d75c.
//
// Solidity: event MatchSettled(bytes32 indexed matchId, uint8 market, uint8 line, uint8 winningOutcome)
func (_BettingPool *BettingPoolFilterer) WatchMatchSettled(opts *bind.WatchOpts, sink chan<- *BettingPoolMatchSettled, matchId [][32]byte) (event.Subscription, error) {

	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "MatchSettled", matchIdRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolMatchSettled)
				if err := _BettingPool.contract.UnpackLog(event, "MatchSettled", log); err != nil {
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

// ParseMatchSettled is a log parse operation binding the contract event 0x6476a80f2c3baf6204e4e208f52c50568869522fd861874cec57208f5463d75c.
//
// Solidity: event MatchSettled(bytes32 indexed matchId, uint8 market, uint8 line, uint8 winningOutcome)
func (_BettingPool *BettingPoolFilterer) ParseMatchSettled(log types.Log) (*BettingPoolMatchSettled, error) {
	event := new(BettingPoolMatchSettled)
	if err := _BettingPool.contract.UnpackLog(event, "MatchSettled", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolMaxMarketsPerMatchUpdatedIterator is returned from FilterMaxMarketsPerMatchUpdated and is used to iterate over the raw logs and unpacked data for MaxMarketsPerMatchUpdated events raised by the BettingPool contract.
type BettingPoolMaxMarketsPerMatchUpdatedIterator struct {
	Event *BettingPoolMaxMarketsPerMatchUpdated // Event containing the contract specifics and raw log

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
func (it *BettingPoolMaxMarketsPerMatchUpdatedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolMaxMarketsPerMatchUpdated)
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
		it.Event = new(BettingPoolMaxMarketsPerMatchUpdated)
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
func (it *BettingPoolMaxMarketsPerMatchUpdatedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolMaxMarketsPerMatchUpdatedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolMaxMarketsPerMatchUpdated represents a MaxMarketsPerMatchUpdated event raised by the BettingPool contract.
type BettingPoolMaxMarketsPerMatchUpdated struct {
	NewMax *big.Int
	Raw    types.Log // Blockchain specific contextual infos
}

// FilterMaxMarketsPerMatchUpdated is a free log retrieval operation binding the contract event 0x9bb72b6cbbd1c97ffa706b9aa85dc0c1c0bc9c08d085fc247424c97bf51ac3ab.
//
// Solidity: event MaxMarketsPerMatchUpdated(uint256 newMax)
func (_BettingPool *BettingPoolFilterer) FilterMaxMarketsPerMatchUpdated(opts *bind.FilterOpts) (*BettingPoolMaxMarketsPerMatchUpdatedIterator, error) {

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "MaxMarketsPerMatchUpdated")
	if err != nil {
		return nil, err
	}
	return &BettingPoolMaxMarketsPerMatchUpdatedIterator{contract: _BettingPool.contract, event: "MaxMarketsPerMatchUpdated", logs: logs, sub: sub}, nil
}

// WatchMaxMarketsPerMatchUpdated is a free log subscription operation binding the contract event 0x9bb72b6cbbd1c97ffa706b9aa85dc0c1c0bc9c08d085fc247424c97bf51ac3ab.
//
// Solidity: event MaxMarketsPerMatchUpdated(uint256 newMax)
func (_BettingPool *BettingPoolFilterer) WatchMaxMarketsPerMatchUpdated(opts *bind.WatchOpts, sink chan<- *BettingPoolMaxMarketsPerMatchUpdated) (event.Subscription, error) {

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "MaxMarketsPerMatchUpdated")
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolMaxMarketsPerMatchUpdated)
				if err := _BettingPool.contract.UnpackLog(event, "MaxMarketsPerMatchUpdated", log); err != nil {
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

// ParseMaxMarketsPerMatchUpdated is a log parse operation binding the contract event 0x9bb72b6cbbd1c97ffa706b9aa85dc0c1c0bc9c08d085fc247424c97bf51ac3ab.
//
// Solidity: event MaxMarketsPerMatchUpdated(uint256 newMax)
func (_BettingPool *BettingPoolFilterer) ParseMaxMarketsPerMatchUpdated(log types.Log) (*BettingPoolMaxMarketsPerMatchUpdated, error) {
	event := new(BettingPoolMaxMarketsPerMatchUpdated)
	if err := _BettingPool.contract.UnpackLog(event, "MaxMarketsPerMatchUpdated", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolParlayDegradedToSingleIterator is returned from FilterParlayDegradedToSingle and is used to iterate over the raw logs and unpacked data for ParlayDegradedToSingle events raised by the BettingPool contract.
type BettingPoolParlayDegradedToSingleIterator struct {
	Event *BettingPoolParlayDegradedToSingle // Event containing the contract specifics and raw log

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
func (it *BettingPoolParlayDegradedToSingleIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolParlayDegradedToSingle)
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
		it.Event = new(BettingPoolParlayDegradedToSingle)
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
func (it *BettingPoolParlayDegradedToSingleIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolParlayDegradedToSingleIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolParlayDegradedToSingle represents a ParlayDegradedToSingle event raised by the BettingPool contract.
type BettingPoolParlayDegradedToSingle struct {
	ParlayId       [32]byte
	RemainingBetId [32]byte
	NewOdds        *big.Int
	Raw            types.Log // Blockchain specific contextual infos
}

// FilterParlayDegradedToSingle is a free log retrieval operation binding the contract event 0x04c96faf0ccf02e415ff7d94fa8cfcf8b55fa887863a39fbf423f944c548202e.
//
// Solidity: event ParlayDegradedToSingle(bytes32 indexed parlayId, bytes32 indexed remainingBetId, uint256 newOdds)
func (_BettingPool *BettingPoolFilterer) FilterParlayDegradedToSingle(opts *bind.FilterOpts, parlayId [][32]byte, remainingBetId [][32]byte) (*BettingPoolParlayDegradedToSingleIterator, error) {

	var parlayIdRule []interface{}
	for _, parlayIdItem := range parlayId {
		parlayIdRule = append(parlayIdRule, parlayIdItem)
	}
	var remainingBetIdRule []interface{}
	for _, remainingBetIdItem := range remainingBetId {
		remainingBetIdRule = append(remainingBetIdRule, remainingBetIdItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "ParlayDegradedToSingle", parlayIdRule, remainingBetIdRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolParlayDegradedToSingleIterator{contract: _BettingPool.contract, event: "ParlayDegradedToSingle", logs: logs, sub: sub}, nil
}

// WatchParlayDegradedToSingle is a free log subscription operation binding the contract event 0x04c96faf0ccf02e415ff7d94fa8cfcf8b55fa887863a39fbf423f944c548202e.
//
// Solidity: event ParlayDegradedToSingle(bytes32 indexed parlayId, bytes32 indexed remainingBetId, uint256 newOdds)
func (_BettingPool *BettingPoolFilterer) WatchParlayDegradedToSingle(opts *bind.WatchOpts, sink chan<- *BettingPoolParlayDegradedToSingle, parlayId [][32]byte, remainingBetId [][32]byte) (event.Subscription, error) {

	var parlayIdRule []interface{}
	for _, parlayIdItem := range parlayId {
		parlayIdRule = append(parlayIdRule, parlayIdItem)
	}
	var remainingBetIdRule []interface{}
	for _, remainingBetIdItem := range remainingBetId {
		remainingBetIdRule = append(remainingBetIdRule, remainingBetIdItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "ParlayDegradedToSingle", parlayIdRule, remainingBetIdRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolParlayDegradedToSingle)
				if err := _BettingPool.contract.UnpackLog(event, "ParlayDegradedToSingle", log); err != nil {
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

// ParseParlayDegradedToSingle is a log parse operation binding the contract event 0x04c96faf0ccf02e415ff7d94fa8cfcf8b55fa887863a39fbf423f944c548202e.
//
// Solidity: event ParlayDegradedToSingle(bytes32 indexed parlayId, bytes32 indexed remainingBetId, uint256 newOdds)
func (_BettingPool *BettingPoolFilterer) ParseParlayDegradedToSingle(log types.Log) (*BettingPoolParlayDegradedToSingle, error) {
	event := new(BettingPoolParlayDegradedToSingle)
	if err := _BettingPool.contract.UnpackLog(event, "ParlayDegradedToSingle", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolParlayLegCancelledIterator is returned from FilterParlayLegCancelled and is used to iterate over the raw logs and unpacked data for ParlayLegCancelled events raised by the BettingPool contract.
type BettingPoolParlayLegCancelledIterator struct {
	Event *BettingPoolParlayLegCancelled // Event containing the contract specifics and raw log

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
func (it *BettingPoolParlayLegCancelledIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolParlayLegCancelled)
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
		it.Event = new(BettingPoolParlayLegCancelled)
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
func (it *BettingPoolParlayLegCancelledIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolParlayLegCancelledIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolParlayLegCancelled represents a ParlayLegCancelled event raised by the BettingPool contract.
type BettingPoolParlayLegCancelled struct {
	ParlayId        [32]byte
	BetId           [32]byte
	NewCombinedOdds *big.Int
	Raw             types.Log // Blockchain specific contextual infos
}

// FilterParlayLegCancelled is a free log retrieval operation binding the contract event 0x63d804601900d007897d1b2b79d825a1eacbb08327bfbc395a9b5fe1aafd71a4.
//
// Solidity: event ParlayLegCancelled(bytes32 indexed parlayId, bytes32 indexed betId, uint256 newCombinedOdds)
func (_BettingPool *BettingPoolFilterer) FilterParlayLegCancelled(opts *bind.FilterOpts, parlayId [][32]byte, betId [][32]byte) (*BettingPoolParlayLegCancelledIterator, error) {

	var parlayIdRule []interface{}
	for _, parlayIdItem := range parlayId {
		parlayIdRule = append(parlayIdRule, parlayIdItem)
	}
	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "ParlayLegCancelled", parlayIdRule, betIdRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolParlayLegCancelledIterator{contract: _BettingPool.contract, event: "ParlayLegCancelled", logs: logs, sub: sub}, nil
}

// WatchParlayLegCancelled is a free log subscription operation binding the contract event 0x63d804601900d007897d1b2b79d825a1eacbb08327bfbc395a9b5fe1aafd71a4.
//
// Solidity: event ParlayLegCancelled(bytes32 indexed parlayId, bytes32 indexed betId, uint256 newCombinedOdds)
func (_BettingPool *BettingPoolFilterer) WatchParlayLegCancelled(opts *bind.WatchOpts, sink chan<- *BettingPoolParlayLegCancelled, parlayId [][32]byte, betId [][32]byte) (event.Subscription, error) {

	var parlayIdRule []interface{}
	for _, parlayIdItem := range parlayId {
		parlayIdRule = append(parlayIdRule, parlayIdItem)
	}
	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "ParlayLegCancelled", parlayIdRule, betIdRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolParlayLegCancelled)
				if err := _BettingPool.contract.UnpackLog(event, "ParlayLegCancelled", log); err != nil {
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

// ParseParlayLegCancelled is a log parse operation binding the contract event 0x63d804601900d007897d1b2b79d825a1eacbb08327bfbc395a9b5fe1aafd71a4.
//
// Solidity: event ParlayLegCancelled(bytes32 indexed parlayId, bytes32 indexed betId, uint256 newCombinedOdds)
func (_BettingPool *BettingPoolFilterer) ParseParlayLegCancelled(log types.Log) (*BettingPoolParlayLegCancelled, error) {
	event := new(BettingPoolParlayLegCancelled)
	if err := _BettingPool.contract.UnpackLog(event, "ParlayLegCancelled", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolParlayLockedIterator is returned from FilterParlayLocked and is used to iterate over the raw logs and unpacked data for ParlayLocked events raised by the BettingPool contract.
type BettingPoolParlayLockedIterator struct {
	Event *BettingPoolParlayLocked // Event containing the contract specifics and raw log

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
func (it *BettingPoolParlayLockedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolParlayLocked)
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
		it.Event = new(BettingPoolParlayLocked)
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
func (it *BettingPoolParlayLockedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolParlayLockedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolParlayLocked represents a ParlayLocked event raised by the BettingPool contract.
type BettingPoolParlayLocked struct {
	ParlayId     [32]byte
	User         common.Address
	Stake        *big.Int
	Legs         uint8
	CombinedOdds *big.Int
	LegBetIds    [][32]byte
	Raw          types.Log // Blockchain specific contextual infos
}

// FilterParlayLocked is a free log retrieval operation binding the contract event 0xce78f700f3210aa7965a1d44f4ce14cce09abe0b76de1135cb37a4580789acc7.
//
// Solidity: event ParlayLocked(bytes32 indexed parlayId, address indexed user, uint256 stake, uint8 legs, uint256 combinedOdds, bytes32[] legBetIds)
func (_BettingPool *BettingPoolFilterer) FilterParlayLocked(opts *bind.FilterOpts, parlayId [][32]byte, user []common.Address) (*BettingPoolParlayLockedIterator, error) {

	var parlayIdRule []interface{}
	for _, parlayIdItem := range parlayId {
		parlayIdRule = append(parlayIdRule, parlayIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "ParlayLocked", parlayIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolParlayLockedIterator{contract: _BettingPool.contract, event: "ParlayLocked", logs: logs, sub: sub}, nil
}

// WatchParlayLocked is a free log subscription operation binding the contract event 0xce78f700f3210aa7965a1d44f4ce14cce09abe0b76de1135cb37a4580789acc7.
//
// Solidity: event ParlayLocked(bytes32 indexed parlayId, address indexed user, uint256 stake, uint8 legs, uint256 combinedOdds, bytes32[] legBetIds)
func (_BettingPool *BettingPoolFilterer) WatchParlayLocked(opts *bind.WatchOpts, sink chan<- *BettingPoolParlayLocked, parlayId [][32]byte, user []common.Address) (event.Subscription, error) {

	var parlayIdRule []interface{}
	for _, parlayIdItem := range parlayId {
		parlayIdRule = append(parlayIdRule, parlayIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "ParlayLocked", parlayIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolParlayLocked)
				if err := _BettingPool.contract.UnpackLog(event, "ParlayLocked", log); err != nil {
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

// ParseParlayLocked is a log parse operation binding the contract event 0xce78f700f3210aa7965a1d44f4ce14cce09abe0b76de1135cb37a4580789acc7.
//
// Solidity: event ParlayLocked(bytes32 indexed parlayId, address indexed user, uint256 stake, uint8 legs, uint256 combinedOdds, bytes32[] legBetIds)
func (_BettingPool *BettingPoolFilterer) ParseParlayLocked(log types.Log) (*BettingPoolParlayLocked, error) {
	event := new(BettingPoolParlayLocked)
	if err := _BettingPool.contract.UnpackLog(event, "ParlayLocked", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolParlayLostIterator is returned from FilterParlayLost and is used to iterate over the raw logs and unpacked data for ParlayLost events raised by the BettingPool contract.
type BettingPoolParlayLostIterator struct {
	Event *BettingPoolParlayLost // Event containing the contract specifics and raw log

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
func (it *BettingPoolParlayLostIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolParlayLost)
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
		it.Event = new(BettingPoolParlayLost)
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
func (it *BettingPoolParlayLostIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolParlayLostIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolParlayLost represents a ParlayLost event raised by the BettingPool contract.
type BettingPoolParlayLost struct {
	ParlayId [32]byte
	User     common.Address
	Stake    *big.Int
	Raw      types.Log // Blockchain specific contextual infos
}

// FilterParlayLost is a free log retrieval operation binding the contract event 0x28b9f616716c3df62066cf0e98efb10bd7a2aa4bcc96ab9e9bd904cd59775128.
//
// Solidity: event ParlayLost(bytes32 indexed parlayId, address indexed user, uint256 stake)
func (_BettingPool *BettingPoolFilterer) FilterParlayLost(opts *bind.FilterOpts, parlayId [][32]byte, user []common.Address) (*BettingPoolParlayLostIterator, error) {

	var parlayIdRule []interface{}
	for _, parlayIdItem := range parlayId {
		parlayIdRule = append(parlayIdRule, parlayIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "ParlayLost", parlayIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolParlayLostIterator{contract: _BettingPool.contract, event: "ParlayLost", logs: logs, sub: sub}, nil
}

// WatchParlayLost is a free log subscription operation binding the contract event 0x28b9f616716c3df62066cf0e98efb10bd7a2aa4bcc96ab9e9bd904cd59775128.
//
// Solidity: event ParlayLost(bytes32 indexed parlayId, address indexed user, uint256 stake)
func (_BettingPool *BettingPoolFilterer) WatchParlayLost(opts *bind.WatchOpts, sink chan<- *BettingPoolParlayLost, parlayId [][32]byte, user []common.Address) (event.Subscription, error) {

	var parlayIdRule []interface{}
	for _, parlayIdItem := range parlayId {
		parlayIdRule = append(parlayIdRule, parlayIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "ParlayLost", parlayIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolParlayLost)
				if err := _BettingPool.contract.UnpackLog(event, "ParlayLost", log); err != nil {
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

// ParseParlayLost is a log parse operation binding the contract event 0x28b9f616716c3df62066cf0e98efb10bd7a2aa4bcc96ab9e9bd904cd59775128.
//
// Solidity: event ParlayLost(bytes32 indexed parlayId, address indexed user, uint256 stake)
func (_BettingPool *BettingPoolFilterer) ParseParlayLost(log types.Log) (*BettingPoolParlayLost, error) {
	event := new(BettingPoolParlayLost)
	if err := _BettingPool.contract.UnpackLog(event, "ParlayLost", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolParlayUnlockedIterator is returned from FilterParlayUnlocked and is used to iterate over the raw logs and unpacked data for ParlayUnlocked events raised by the BettingPool contract.
type BettingPoolParlayUnlockedIterator struct {
	Event *BettingPoolParlayUnlocked // Event containing the contract specifics and raw log

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
func (it *BettingPoolParlayUnlockedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolParlayUnlocked)
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
		it.Event = new(BettingPoolParlayUnlocked)
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
func (it *BettingPoolParlayUnlockedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolParlayUnlockedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolParlayUnlocked represents a ParlayUnlocked event raised by the BettingPool contract.
type BettingPoolParlayUnlocked struct {
	ParlayId [32]byte
	User     common.Address
	Stake    *big.Int
	Raw      types.Log // Blockchain specific contextual infos
}

// FilterParlayUnlocked is a free log retrieval operation binding the contract event 0x6515d254cc14faf7ce007701a64330e3efdc677df76e9eb312c4e37ba5cf33c0.
//
// Solidity: event ParlayUnlocked(bytes32 indexed parlayId, address indexed user, uint256 stake)
func (_BettingPool *BettingPoolFilterer) FilterParlayUnlocked(opts *bind.FilterOpts, parlayId [][32]byte, user []common.Address) (*BettingPoolParlayUnlockedIterator, error) {

	var parlayIdRule []interface{}
	for _, parlayIdItem := range parlayId {
		parlayIdRule = append(parlayIdRule, parlayIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "ParlayUnlocked", parlayIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolParlayUnlockedIterator{contract: _BettingPool.contract, event: "ParlayUnlocked", logs: logs, sub: sub}, nil
}

// WatchParlayUnlocked is a free log subscription operation binding the contract event 0x6515d254cc14faf7ce007701a64330e3efdc677df76e9eb312c4e37ba5cf33c0.
//
// Solidity: event ParlayUnlocked(bytes32 indexed parlayId, address indexed user, uint256 stake)
func (_BettingPool *BettingPoolFilterer) WatchParlayUnlocked(opts *bind.WatchOpts, sink chan<- *BettingPoolParlayUnlocked, parlayId [][32]byte, user []common.Address) (event.Subscription, error) {

	var parlayIdRule []interface{}
	for _, parlayIdItem := range parlayId {
		parlayIdRule = append(parlayIdRule, parlayIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "ParlayUnlocked", parlayIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolParlayUnlocked)
				if err := _BettingPool.contract.UnpackLog(event, "ParlayUnlocked", log); err != nil {
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

// ParseParlayUnlocked is a log parse operation binding the contract event 0x6515d254cc14faf7ce007701a64330e3efdc677df76e9eb312c4e37ba5cf33c0.
//
// Solidity: event ParlayUnlocked(bytes32 indexed parlayId, address indexed user, uint256 stake)
func (_BettingPool *BettingPoolFilterer) ParseParlayUnlocked(log types.Log) (*BettingPoolParlayUnlocked, error) {
	event := new(BettingPoolParlayUnlocked)
	if err := _BettingPool.contract.UnpackLog(event, "ParlayUnlocked", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolParlayWonIterator is returned from FilterParlayWon and is used to iterate over the raw logs and unpacked data for ParlayWon events raised by the BettingPool contract.
type BettingPoolParlayWonIterator struct {
	Event *BettingPoolParlayWon // Event containing the contract specifics and raw log

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
func (it *BettingPoolParlayWonIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolParlayWon)
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
		it.Event = new(BettingPoolParlayWon)
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
func (it *BettingPoolParlayWonIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolParlayWonIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolParlayWon represents a ParlayWon event raised by the BettingPool contract.
type BettingPoolParlayWon struct {
	ParlayId [32]byte
	User     common.Address
	Payout   *big.Int
	Raw      types.Log // Blockchain specific contextual infos
}

// FilterParlayWon is a free log retrieval operation binding the contract event 0xa3ab1bfdae6eeab7e76f0d8c3e41c329453ffb30c27617a211c23b50503afaef.
//
// Solidity: event ParlayWon(bytes32 indexed parlayId, address indexed user, uint256 payout)
func (_BettingPool *BettingPoolFilterer) FilterParlayWon(opts *bind.FilterOpts, parlayId [][32]byte, user []common.Address) (*BettingPoolParlayWonIterator, error) {

	var parlayIdRule []interface{}
	for _, parlayIdItem := range parlayId {
		parlayIdRule = append(parlayIdRule, parlayIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "ParlayWon", parlayIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolParlayWonIterator{contract: _BettingPool.contract, event: "ParlayWon", logs: logs, sub: sub}, nil
}

// WatchParlayWon is a free log subscription operation binding the contract event 0xa3ab1bfdae6eeab7e76f0d8c3e41c329453ffb30c27617a211c23b50503afaef.
//
// Solidity: event ParlayWon(bytes32 indexed parlayId, address indexed user, uint256 payout)
func (_BettingPool *BettingPoolFilterer) WatchParlayWon(opts *bind.WatchOpts, sink chan<- *BettingPoolParlayWon, parlayId [][32]byte, user []common.Address) (event.Subscription, error) {

	var parlayIdRule []interface{}
	for _, parlayIdItem := range parlayId {
		parlayIdRule = append(parlayIdRule, parlayIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "ParlayWon", parlayIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolParlayWon)
				if err := _BettingPool.contract.UnpackLog(event, "ParlayWon", log); err != nil {
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

// ParseParlayWon is a log parse operation binding the contract event 0xa3ab1bfdae6eeab7e76f0d8c3e41c329453ffb30c27617a211c23b50503afaef.
//
// Solidity: event ParlayWon(bytes32 indexed parlayId, address indexed user, uint256 payout)
func (_BettingPool *BettingPoolFilterer) ParseParlayWon(log types.Log) (*BettingPoolParlayWon, error) {
	event := new(BettingPoolParlayWon)
	if err := _BettingPool.contract.UnpackLog(event, "ParlayWon", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolPausedIterator is returned from FilterPaused and is used to iterate over the raw logs and unpacked data for Paused events raised by the BettingPool contract.
type BettingPoolPausedIterator struct {
	Event *BettingPoolPaused // Event containing the contract specifics and raw log

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
func (it *BettingPoolPausedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolPaused)
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
		it.Event = new(BettingPoolPaused)
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
func (it *BettingPoolPausedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolPausedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolPaused represents a Paused event raised by the BettingPool contract.
type BettingPoolPaused struct {
	Account common.Address
	Raw     types.Log // Blockchain specific contextual infos
}

// FilterPaused is a free log retrieval operation binding the contract event 0x62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258.
//
// Solidity: event Paused(address account)
func (_BettingPool *BettingPoolFilterer) FilterPaused(opts *bind.FilterOpts) (*BettingPoolPausedIterator, error) {

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "Paused")
	if err != nil {
		return nil, err
	}
	return &BettingPoolPausedIterator{contract: _BettingPool.contract, event: "Paused", logs: logs, sub: sub}, nil
}

// WatchPaused is a free log subscription operation binding the contract event 0x62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258.
//
// Solidity: event Paused(address account)
func (_BettingPool *BettingPoolFilterer) WatchPaused(opts *bind.WatchOpts, sink chan<- *BettingPoolPaused) (event.Subscription, error) {

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "Paused")
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolPaused)
				if err := _BettingPool.contract.UnpackLog(event, "Paused", log); err != nil {
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
func (_BettingPool *BettingPoolFilterer) ParsePaused(log types.Log) (*BettingPoolPaused, error) {
	event := new(BettingPoolPaused)
	if err := _BettingPool.contract.UnpackLog(event, "Paused", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolPlatformWithdrawnIterator is returned from FilterPlatformWithdrawn and is used to iterate over the raw logs and unpacked data for PlatformWithdrawn events raised by the BettingPool contract.
type BettingPoolPlatformWithdrawnIterator struct {
	Event *BettingPoolPlatformWithdrawn // Event containing the contract specifics and raw log

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
func (it *BettingPoolPlatformWithdrawnIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolPlatformWithdrawn)
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
		it.Event = new(BettingPoolPlatformWithdrawn)
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
func (it *BettingPoolPlatformWithdrawnIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolPlatformWithdrawnIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolPlatformWithdrawn represents a PlatformWithdrawn event raised by the BettingPool contract.
type BettingPoolPlatformWithdrawn struct {
	To     common.Address
	Amount *big.Int
	Raw    types.Log // Blockchain specific contextual infos
}

// FilterPlatformWithdrawn is a free log retrieval operation binding the contract event 0xa061d73c5e1e0bac9b10f6f37c6cf03f36521f19e349267f50a639f57c7c74fd.
//
// Solidity: event PlatformWithdrawn(address indexed to, uint256 amount)
func (_BettingPool *BettingPoolFilterer) FilterPlatformWithdrawn(opts *bind.FilterOpts, to []common.Address) (*BettingPoolPlatformWithdrawnIterator, error) {

	var toRule []interface{}
	for _, toItem := range to {
		toRule = append(toRule, toItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "PlatformWithdrawn", toRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolPlatformWithdrawnIterator{contract: _BettingPool.contract, event: "PlatformWithdrawn", logs: logs, sub: sub}, nil
}

// WatchPlatformWithdrawn is a free log subscription operation binding the contract event 0xa061d73c5e1e0bac9b10f6f37c6cf03f36521f19e349267f50a639f57c7c74fd.
//
// Solidity: event PlatformWithdrawn(address indexed to, uint256 amount)
func (_BettingPool *BettingPoolFilterer) WatchPlatformWithdrawn(opts *bind.WatchOpts, sink chan<- *BettingPoolPlatformWithdrawn, to []common.Address) (event.Subscription, error) {

	var toRule []interface{}
	for _, toItem := range to {
		toRule = append(toRule, toItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "PlatformWithdrawn", toRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolPlatformWithdrawn)
				if err := _BettingPool.contract.UnpackLog(event, "PlatformWithdrawn", log); err != nil {
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

// ParsePlatformWithdrawn is a log parse operation binding the contract event 0xa061d73c5e1e0bac9b10f6f37c6cf03f36521f19e349267f50a639f57c7c74fd.
//
// Solidity: event PlatformWithdrawn(address indexed to, uint256 amount)
func (_BettingPool *BettingPoolFilterer) ParsePlatformWithdrawn(log types.Log) (*BettingPoolPlatformWithdrawn, error) {
	event := new(BettingPoolPlatformWithdrawn)
	if err := _BettingPool.contract.UnpackLog(event, "PlatformWithdrawn", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolRedLightThresholdUpdatedIterator is returned from FilterRedLightThresholdUpdated and is used to iterate over the raw logs and unpacked data for RedLightThresholdUpdated events raised by the BettingPool contract.
type BettingPoolRedLightThresholdUpdatedIterator struct {
	Event *BettingPoolRedLightThresholdUpdated // Event containing the contract specifics and raw log

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
func (it *BettingPoolRedLightThresholdUpdatedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolRedLightThresholdUpdated)
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
		it.Event = new(BettingPoolRedLightThresholdUpdated)
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
func (it *BettingPoolRedLightThresholdUpdatedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolRedLightThresholdUpdatedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolRedLightThresholdUpdated represents a RedLightThresholdUpdated event raised by the BettingPool contract.
type BettingPoolRedLightThresholdUpdated struct {
	OldThreshold *big.Int
	NewThreshold *big.Int
	Raw          types.Log // Blockchain specific contextual infos
}

// FilterRedLightThresholdUpdated is a free log retrieval operation binding the contract event 0x1d3436df5b07f24df33bfa26b45e6997fe02151bd3ae46c07e829579c8dcde5b.
//
// Solidity: event RedLightThresholdUpdated(uint256 oldThreshold, uint256 newThreshold)
func (_BettingPool *BettingPoolFilterer) FilterRedLightThresholdUpdated(opts *bind.FilterOpts) (*BettingPoolRedLightThresholdUpdatedIterator, error) {

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "RedLightThresholdUpdated")
	if err != nil {
		return nil, err
	}
	return &BettingPoolRedLightThresholdUpdatedIterator{contract: _BettingPool.contract, event: "RedLightThresholdUpdated", logs: logs, sub: sub}, nil
}

// WatchRedLightThresholdUpdated is a free log subscription operation binding the contract event 0x1d3436df5b07f24df33bfa26b45e6997fe02151bd3ae46c07e829579c8dcde5b.
//
// Solidity: event RedLightThresholdUpdated(uint256 oldThreshold, uint256 newThreshold)
func (_BettingPool *BettingPoolFilterer) WatchRedLightThresholdUpdated(opts *bind.WatchOpts, sink chan<- *BettingPoolRedLightThresholdUpdated) (event.Subscription, error) {

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "RedLightThresholdUpdated")
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolRedLightThresholdUpdated)
				if err := _BettingPool.contract.UnpackLog(event, "RedLightThresholdUpdated", log); err != nil {
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

// ParseRedLightThresholdUpdated is a log parse operation binding the contract event 0x1d3436df5b07f24df33bfa26b45e6997fe02151bd3ae46c07e829579c8dcde5b.
//
// Solidity: event RedLightThresholdUpdated(uint256 oldThreshold, uint256 newThreshold)
func (_BettingPool *BettingPoolFilterer) ParseRedLightThresholdUpdated(log types.Log) (*BettingPoolRedLightThresholdUpdated, error) {
	event := new(BettingPoolRedLightThresholdUpdated)
	if err := _BettingPool.contract.UnpackLog(event, "RedLightThresholdUpdated", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolSignalUpdatedIterator is returned from FilterSignalUpdated and is used to iterate over the raw logs and unpacked data for SignalUpdated events raised by the BettingPool contract.
type BettingPoolSignalUpdatedIterator struct {
	Event *BettingPoolSignalUpdated // Event containing the contract specifics and raw log

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
func (it *BettingPoolSignalUpdatedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolSignalUpdated)
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
		it.Event = new(BettingPoolSignalUpdated)
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
func (it *BettingPoolSignalUpdatedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolSignalUpdatedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolSignalUpdated represents a SignalUpdated event raised by the BettingPool contract.
type BettingPoolSignalUpdated struct {
	MatchId [32]byte
	Market  uint8
	Line    uint8
	Color   uint8
	Raw     types.Log // Blockchain specific contextual infos
}

// FilterSignalUpdated is a free log retrieval operation binding the contract event 0x698cd625fc0b5a73828a6633c68e6aea5afd97218aad8650bf8588e97e9e2048.
//
// Solidity: event SignalUpdated(bytes32 indexed matchId, uint8 market, uint8 line, uint8 color)
func (_BettingPool *BettingPoolFilterer) FilterSignalUpdated(opts *bind.FilterOpts, matchId [][32]byte) (*BettingPoolSignalUpdatedIterator, error) {

	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "SignalUpdated", matchIdRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolSignalUpdatedIterator{contract: _BettingPool.contract, event: "SignalUpdated", logs: logs, sub: sub}, nil
}

// WatchSignalUpdated is a free log subscription operation binding the contract event 0x698cd625fc0b5a73828a6633c68e6aea5afd97218aad8650bf8588e97e9e2048.
//
// Solidity: event SignalUpdated(bytes32 indexed matchId, uint8 market, uint8 line, uint8 color)
func (_BettingPool *BettingPoolFilterer) WatchSignalUpdated(opts *bind.WatchOpts, sink chan<- *BettingPoolSignalUpdated, matchId [][32]byte) (event.Subscription, error) {

	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "SignalUpdated", matchIdRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolSignalUpdated)
				if err := _BettingPool.contract.UnpackLog(event, "SignalUpdated", log); err != nil {
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

// ParseSignalUpdated is a log parse operation binding the contract event 0x698cd625fc0b5a73828a6633c68e6aea5afd97218aad8650bf8588e97e9e2048.
//
// Solidity: event SignalUpdated(bytes32 indexed matchId, uint8 market, uint8 line, uint8 color)
func (_BettingPool *BettingPoolFilterer) ParseSignalUpdated(log types.Log) (*BettingPoolSignalUpdated, error) {
	event := new(BettingPoolSignalUpdated)
	if err := _BettingPool.contract.UnpackLog(event, "SignalUpdated", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolUnpausedIterator is returned from FilterUnpaused and is used to iterate over the raw logs and unpacked data for Unpaused events raised by the BettingPool contract.
type BettingPoolUnpausedIterator struct {
	Event *BettingPoolUnpaused // Event containing the contract specifics and raw log

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
func (it *BettingPoolUnpausedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolUnpaused)
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
		it.Event = new(BettingPoolUnpaused)
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
func (it *BettingPoolUnpausedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolUnpausedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolUnpaused represents a Unpaused event raised by the BettingPool contract.
type BettingPoolUnpaused struct {
	Account common.Address
	Raw     types.Log // Blockchain specific contextual infos
}

// FilterUnpaused is a free log retrieval operation binding the contract event 0x5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa.
//
// Solidity: event Unpaused(address account)
func (_BettingPool *BettingPoolFilterer) FilterUnpaused(opts *bind.FilterOpts) (*BettingPoolUnpausedIterator, error) {

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "Unpaused")
	if err != nil {
		return nil, err
	}
	return &BettingPoolUnpausedIterator{contract: _BettingPool.contract, event: "Unpaused", logs: logs, sub: sub}, nil
}

// WatchUnpaused is a free log subscription operation binding the contract event 0x5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa.
//
// Solidity: event Unpaused(address account)
func (_BettingPool *BettingPoolFilterer) WatchUnpaused(opts *bind.WatchOpts, sink chan<- *BettingPoolUnpaused) (event.Subscription, error) {

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "Unpaused")
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolUnpaused)
				if err := _BettingPool.contract.UnpackLog(event, "Unpaused", log); err != nil {
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
func (_BettingPool *BettingPoolFilterer) ParseUnpaused(log types.Log) (*BettingPoolUnpaused, error) {
	event := new(BettingPoolUnpaused)
	if err := _BettingPool.contract.UnpackLog(event, "Unpaused", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolUpgradedIterator is returned from FilterUpgraded and is used to iterate over the raw logs and unpacked data for Upgraded events raised by the BettingPool contract.
type BettingPoolUpgradedIterator struct {
	Event *BettingPoolUpgraded // Event containing the contract specifics and raw log

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
func (it *BettingPoolUpgradedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolUpgraded)
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
		it.Event = new(BettingPoolUpgraded)
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
func (it *BettingPoolUpgradedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolUpgradedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolUpgraded represents a Upgraded event raised by the BettingPool contract.
type BettingPoolUpgraded struct {
	Implementation common.Address
	Raw            types.Log // Blockchain specific contextual infos
}

// FilterUpgraded is a free log retrieval operation binding the contract event 0xbc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b.
//
// Solidity: event Upgraded(address indexed implementation)
func (_BettingPool *BettingPoolFilterer) FilterUpgraded(opts *bind.FilterOpts, implementation []common.Address) (*BettingPoolUpgradedIterator, error) {

	var implementationRule []interface{}
	for _, implementationItem := range implementation {
		implementationRule = append(implementationRule, implementationItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "Upgraded", implementationRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolUpgradedIterator{contract: _BettingPool.contract, event: "Upgraded", logs: logs, sub: sub}, nil
}

// WatchUpgraded is a free log subscription operation binding the contract event 0xbc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b.
//
// Solidity: event Upgraded(address indexed implementation)
func (_BettingPool *BettingPoolFilterer) WatchUpgraded(opts *bind.WatchOpts, sink chan<- *BettingPoolUpgraded, implementation []common.Address) (event.Subscription, error) {

	var implementationRule []interface{}
	for _, implementationItem := range implementation {
		implementationRule = append(implementationRule, implementationItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "Upgraded", implementationRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolUpgraded)
				if err := _BettingPool.contract.UnpackLog(event, "Upgraded", log); err != nil {
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
func (_BettingPool *BettingPoolFilterer) ParseUpgraded(log types.Log) (*BettingPoolUpgraded, error) {
	event := new(BettingPoolUpgraded)
	if err := _BettingPool.contract.UnpackLog(event, "Upgraded", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolWithdrawnIterator is returned from FilterWithdrawn and is used to iterate over the raw logs and unpacked data for Withdrawn events raised by the BettingPool contract.
type BettingPoolWithdrawnIterator struct {
	Event *BettingPoolWithdrawn // Event containing the contract specifics and raw log

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
func (it *BettingPoolWithdrawnIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolWithdrawn)
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
		it.Event = new(BettingPoolWithdrawn)
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
func (it *BettingPoolWithdrawnIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolWithdrawnIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolWithdrawn represents a Withdrawn event raised by the BettingPool contract.
type BettingPoolWithdrawn struct {
	User   common.Address
	Amount *big.Int
	Raw    types.Log // Blockchain specific contextual infos
}

// FilterWithdrawn is a free log retrieval operation binding the contract event 0x7084f5476618d8e60b11ef0d7d3f06914655adb8793e28ff7f018d4c76d505d5.
//
// Solidity: event Withdrawn(address indexed user, uint256 amount)
func (_BettingPool *BettingPoolFilterer) FilterWithdrawn(opts *bind.FilterOpts, user []common.Address) (*BettingPoolWithdrawnIterator, error) {

	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "Withdrawn", userRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolWithdrawnIterator{contract: _BettingPool.contract, event: "Withdrawn", logs: logs, sub: sub}, nil
}

// WatchWithdrawn is a free log subscription operation binding the contract event 0x7084f5476618d8e60b11ef0d7d3f06914655adb8793e28ff7f018d4c76d505d5.
//
// Solidity: event Withdrawn(address indexed user, uint256 amount)
func (_BettingPool *BettingPoolFilterer) WatchWithdrawn(opts *bind.WatchOpts, sink chan<- *BettingPoolWithdrawn, user []common.Address) (event.Subscription, error) {

	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "Withdrawn", userRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolWithdrawn)
				if err := _BettingPool.contract.UnpackLog(event, "Withdrawn", log); err != nil {
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

// ParseWithdrawn is a log parse operation binding the contract event 0x7084f5476618d8e60b11ef0d7d3f06914655adb8793e28ff7f018d4c76d505d5.
//
// Solidity: event Withdrawn(address indexed user, uint256 amount)
func (_BettingPool *BettingPoolFilterer) ParseWithdrawn(log types.Log) (*BettingPoolWithdrawn, error) {
	event := new(BettingPoolWithdrawn)
	if err := _BettingPool.contract.UnpackLog(event, "Withdrawn", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}
