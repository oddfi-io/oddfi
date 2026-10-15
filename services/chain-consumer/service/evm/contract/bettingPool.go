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

// BettingPoolStorageBet is an auto generated low-level Go binding around an user-defined struct.
type BettingPoolStorageBet struct {
	Owner                common.Address
	MarketId             [32]byte
	Outcome              uint8
	AcceptedAmount       *big.Int
	RefundedAmount       *big.Int
	LockedOdds           *big.Int
	AcceptedDayBucket    uint32
	SettlementState      uint8
	ClaimablePayout      *big.Int
	PayoutTaxRateBps     uint16
	TaxAllocStakingBps   uint16
	TaxAllocTaxBufferBps uint16
	TaxAllocReferrerBps  uint16
	ReferrerSnapshot     common.Address
}

// BettingPoolStorageMarketConfig is an auto generated low-level Go binding around an user-defined struct.
type BettingPoolStorageMarketConfig struct {
	MatchId        [32]byte
	MarketType     uint8
	Line           uint8
	OutcomeCount   uint8
	MatchStartTime uint64
	LockAt         uint64
	Status         uint8
	MatchEndTime   uint64
}

// BettingPoolStorageUserRiskLedger is an auto generated low-level Go binding around an user-defined struct.
type BettingPoolStorageUserRiskLedger struct {
	DayBucket           uint32
	DailyAcceptedAmount *big.Int
	UnsettledStake      *big.Int
}

// QuoteGuardInput is an auto generated low-level Go binding around an user-defined struct.
type QuoteGuardInput struct {
	QuoteVersion      *big.Int
	QuotedAt          uint64
	MinOdds           *big.Int
	MinAcceptedAmount *big.Int
	Deadline          *big.Int
}

// BettingPoolMetaData contains all meta data concerning the BettingPool contract.
var BettingPoolMetaData = &bind.MetaData{
	ABI: "[{\"type\":\"constructor\",\"inputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"DEFAULT_ADMIN_ROLE\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"UPGRADE_INTERFACE_VERSION\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"string\",\"internalType\":\"string\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"accountedBalance\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"addPlatformReserve\",\"inputs\":[{\"name\":\"amount\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"betTaxBps\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint16\",\"internalType\":\"uint16\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"bindReferrer\",\"inputs\":[{\"name\":\"referrer\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"cashOut\",\"inputs\":[{\"name\":\"betId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"expectedQuoteVersion\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"quotedAt\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"minAmountOut\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"deadline\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"claimPayout\",\"inputs\":[{\"name\":\"betId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"claimReferralRewards\",\"inputs\":[{\"name\":\"oddAmount\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[{\"name\":\"claimedAmount\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"claimUSDTReferralRewards\",\"inputs\":[{\"name\":\"rewardMinUsdtOutAmount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"signatureDeadline\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"signature\",\"type\":\"bytes\",\"internalType\":\"bytes\"},{\"name\":\"minUsdtOut\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[{\"name\":\"amountOut\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"finalizeMarketSettlement\",\"inputs\":[{\"name\":\"marketId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"resultKindRaw\",\"type\":\"uint8\",\"internalType\":\"uint8\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"getBet\",\"inputs\":[{\"name\":\"betId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[{\"name\":\"\",\"type\":\"tuple\",\"internalType\":\"structBettingPoolStorage.Bet\",\"components\":[{\"name\":\"owner\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"marketId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"outcome\",\"type\":\"uint8\",\"internalType\":\"uint8\"},{\"name\":\"acceptedAmount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"refundedAmount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"lockedOdds\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"acceptedDayBucket\",\"type\":\"uint32\",\"internalType\":\"uint32\"},{\"name\":\"settlementState\",\"type\":\"uint8\",\"internalType\":\"enumBetSettlementState\"},{\"name\":\"claimablePayout\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"payoutTaxRateBps\",\"type\":\"uint16\",\"internalType\":\"uint16\"},{\"name\":\"taxAllocStakingBps\",\"type\":\"uint16\",\"internalType\":\"uint16\"},{\"name\":\"taxAllocTaxBufferBps\",\"type\":\"uint16\",\"internalType\":\"uint16\"},{\"name\":\"taxAllocReferrerBps\",\"type\":\"uint16\",\"internalType\":\"uint16\"},{\"name\":\"referrerSnapshot\",\"type\":\"address\",\"internalType\":\"address\"}]}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"getMarket\",\"inputs\":[{\"name\":\"marketId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[{\"name\":\"\",\"type\":\"tuple\",\"internalType\":\"structBettingPoolStorage.MarketConfig\",\"components\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"marketType\",\"type\":\"uint8\",\"internalType\":\"uint8\"},{\"name\":\"line\",\"type\":\"uint8\",\"internalType\":\"uint8\"},{\"name\":\"outcomeCount\",\"type\":\"uint8\",\"internalType\":\"uint8\"},{\"name\":\"matchStartTime\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"lockAt\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"status\",\"type\":\"uint8\",\"internalType\":\"enumMarketStatus\"},{\"name\":\"matchEndTime\",\"type\":\"uint64\",\"internalType\":\"uint64\"}]}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"getMarketBetIds\",\"inputs\":[{\"name\":\"marketId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"offset\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"limit\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[{\"name\":\"result\",\"type\":\"bytes32[]\",\"internalType\":\"bytes32[]\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"getMarketExposure\",\"inputs\":[{\"name\":\"marketId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[{\"name\":\"totalStakedByOutcome\",\"type\":\"uint256[]\",\"internalType\":\"uint256[]\"},{\"name\":\"payoutByOutcome\",\"type\":\"uint256[]\",\"internalType\":\"uint256[]\"},{\"name\":\"signalColor\",\"type\":\"uint8\",\"internalType\":\"enumSignalColor\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"getMarketOdds\",\"inputs\":[{\"name\":\"marketId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[{\"name\":\"\",\"type\":\"uint256[]\",\"internalType\":\"uint256[]\"},{\"name\":\"\",\"type\":\"uint256[]\",\"internalType\":\"uint256[]\"},{\"name\":\"\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"getRoleAdmin\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"getUserRiskLedger\",\"inputs\":[{\"name\":\"user\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[{\"name\":\"\",\"type\":\"tuple\",\"internalType\":\"structBettingPoolStorage.UserRiskLedger\",\"components\":[{\"name\":\"dayBucket\",\"type\":\"uint32\",\"internalType\":\"uint32\"},{\"name\":\"dailyAcceptedAmount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"unsettledStake\",\"type\":\"uint256\",\"internalType\":\"uint256\"}]}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"grantRole\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"hasRole\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[{\"name\":\"\",\"type\":\"bool\",\"internalType\":\"bool\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"initialize\",\"inputs\":[{\"name\":\"admin\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"oddTokenAddress\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"stakingPoolAddress\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"liquidityPoolAddress\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"initializeV2\",\"inputs\":[{\"name\":\"treasuryAddress\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"isMatchTerminal\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[{\"name\":\"\",\"type\":\"bool\",\"internalType\":\"bool\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"liquidityPool\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"address\",\"internalType\":\"address\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"lockMarket\",\"inputs\":[{\"name\":\"marketId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"lpLossOffsetRemaining\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"lpMarginShareBps\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint16\",\"internalType\":\"uint16\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"nextBetNonce\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"oddToken\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"address\",\"internalType\":\"contractIERC20\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"openMarket\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"marketType\",\"type\":\"uint8\",\"internalType\":\"uint8\"},{\"name\":\"line\",\"type\":\"uint8\",\"internalType\":\"uint8\"},{\"name\":\"matchStartTime\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"matchEndTime\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"baseOdds\",\"type\":\"uint256[]\",\"internalType\":\"uint256[]\"},{\"name\":\"updatedAt\",\"type\":\"uint64\",\"internalType\":\"uint64\"}],\"outputs\":[{\"name\":\"marketId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"pause\",\"inputs\":[],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"paused\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"bool\",\"internalType\":\"bool\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"payoutTaxBps\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint16\",\"internalType\":\"uint16\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"placeBet\",\"inputs\":[{\"name\":\"marketId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"outcome\",\"type\":\"uint8\",\"internalType\":\"uint8\"},{\"name\":\"requestedAmount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"guard\",\"type\":\"tuple\",\"internalType\":\"structQuoteGuardInput\",\"components\":[{\"name\":\"quoteVersion\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"quotedAt\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"minOdds\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"minAcceptedAmount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"deadline\",\"type\":\"uint256\",\"internalType\":\"uint256\"}]}],\"outputs\":[{\"name\":\"betId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"acceptedAmount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"lockedOdds\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"placeBet\",\"inputs\":[{\"name\":\"marketId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"outcome\",\"type\":\"uint8\",\"internalType\":\"uint8\"},{\"name\":\"requestedAmount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"guard\",\"type\":\"tuple\",\"internalType\":\"structQuoteGuardInput\",\"components\":[{\"name\":\"quoteVersion\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"quotedAt\",\"type\":\"uint64\",\"internalType\":\"uint64\"},{\"name\":\"minOdds\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"minAcceptedAmount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"deadline\",\"type\":\"uint256\",\"internalType\":\"uint256\"}]},{\"name\":\"referrer\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[{\"name\":\"betId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"acceptedAmount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"lockedOdds\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"platformReserve\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"platformTreasury\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"address\",\"internalType\":\"address\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"previewSignal\",\"inputs\":[{\"name\":\"marketId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"outcome\",\"type\":\"uint8\",\"internalType\":\"uint8\"},{\"name\":\"requestedAmount\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[{\"name\":\"signal\",\"type\":\"uint8\",\"internalType\":\"enumSignalColor\"},{\"name\":\"acceptedAmount\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"lockedOdds\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"partialFill\",\"type\":\"bool\",\"internalType\":\"bool\"},{\"name\":\"maxAcceptableAmount\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"proxiableUUID\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"referralClaimNonces\",\"inputs\":[{\"name\":\"\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"referralClaimSigner\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"address\",\"internalType\":\"address\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"referralSwapPoolFee\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint24\",\"internalType\":\"uint24\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"referralSwapRouter\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"address\",\"internalType\":\"address\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"referralUsdtToken\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"address\",\"internalType\":\"address\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"referrerRewardsOdd\",\"inputs\":[{\"name\":\"\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"referrers\",\"inputs\":[{\"name\":\"\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[{\"name\":\"\",\"type\":\"address\",\"internalType\":\"address\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"refundBets\",\"inputs\":[{\"name\":\"marketId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"betIds\",\"type\":\"bytes32[]\",\"internalType\":\"bytes32[]\"},{\"name\":\"refundAmounts\",\"type\":\"uint256[]\",\"internalType\":\"uint256[]\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"renounceRole\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"callerConfirmation\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"revokeRole\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"setBettingDependencies\",\"inputs\":[{\"name\":\"stakingPoolAddress\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"liquidityPoolAddress\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"oddTokenAddress\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"setMarginSplit\",\"inputs\":[{\"name\":\"newLpMarginShareBps\",\"type\":\"uint16\",\"internalType\":\"uint16\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"setPlatformTreasury\",\"inputs\":[{\"name\":\"treasuryAddress\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"setReferralClaimConfig\",\"inputs\":[{\"name\":\"signer\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"poolFee\",\"type\":\"uint24\",\"internalType\":\"uint24\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"setReferralSwapConfig\",\"inputs\":[{\"name\":\"swapRouter\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"usdtToken\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"setRiskConfig\",\"inputs\":[{\"name\":\"yellowThreshold\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"orangeThreshold\",\"type\":\"uint256\",\"internalType\":\"uint256\"},{\"name\":\"redThreshold\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"setSettlementModule\",\"inputs\":[{\"name\":\"newSettlementModule\",\"type\":\"address\",\"internalType\":\"address\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"setTaxConfig\",\"inputs\":[{\"name\":\"newBetTaxBps\",\"type\":\"uint16\",\"internalType\":\"uint16\"},{\"name\":\"newPayoutTaxBps\",\"type\":\"uint16\",\"internalType\":\"uint16\"},{\"name\":\"newAllocStakingBps\",\"type\":\"uint16\",\"internalType\":\"uint16\"},{\"name\":\"newAllocTaxBufferBps\",\"type\":\"uint16\",\"internalType\":\"uint16\"},{\"name\":\"newAllocPlatformBps\",\"type\":\"uint16\",\"internalType\":\"uint16\"},{\"name\":\"newAllocReferrerBps\",\"type\":\"uint16\",\"internalType\":\"uint16\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"settleMarketBetsByScore\",\"inputs\":[{\"name\":\"marketId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"homeScore\",\"type\":\"uint16\",\"internalType\":\"uint16\"},{\"name\":\"awayScore\",\"type\":\"uint16\",\"internalType\":\"uint16\"},{\"name\":\"betIds\",\"type\":\"bytes32[]\",\"internalType\":\"bytes32[]\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"settlementModule\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"address\",\"internalType\":\"address\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"stakingPool\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"address\",\"internalType\":\"address\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"supportsInterface\",\"inputs\":[{\"name\":\"interfaceId\",\"type\":\"bytes4\",\"internalType\":\"bytes4\"}],\"outputs\":[{\"name\":\"\",\"type\":\"bool\",\"internalType\":\"bool\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"taxAllocPlatformBps\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint16\",\"internalType\":\"uint16\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"taxAllocReferrerBps\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint16\",\"internalType\":\"uint16\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"taxAllocStakingBps\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint16\",\"internalType\":\"uint16\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"taxAllocTaxBufferBps\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint16\",\"internalType\":\"uint16\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"taxBuffer\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"unpause\",\"inputs\":[],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"updateOdds\",\"inputs\":[{\"name\":\"marketId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"},{\"name\":\"baseOdds\",\"type\":\"uint256[]\",\"internalType\":\"uint256[]\"},{\"name\":\"updatedAt\",\"type\":\"uint64\",\"internalType\":\"uint64\"}],\"outputs\":[],\"stateMutability\":\"nonpayable\"},{\"type\":\"function\",\"name\":\"upgradeToAndCall\",\"inputs\":[{\"name\":\"newImplementation\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"data\",\"type\":\"bytes\",\"internalType\":\"bytes\"}],\"outputs\":[],\"stateMutability\":\"payable\"},{\"type\":\"function\",\"name\":\"wclOrangeThreshold\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"wclRedThreshold\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"function\",\"name\":\"wclYellowThreshold\",\"inputs\":[],\"outputs\":[{\"name\":\"\",\"type\":\"uint256\",\"internalType\":\"uint256\"}],\"stateMutability\":\"view\"},{\"type\":\"event\",\"name\":\"BetCashedOut\",\"inputs\":[{\"name\":\"betId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"marketId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"user\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"remainingStake\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"cashOutAmount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"currentOdds\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"feeBps\",\"type\":\"uint16\",\"indexed\":false,\"internalType\":\"uint16\"},{\"name\":\"quoteVersion\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"BetClaimed\",\"inputs\":[{\"name\":\"betId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"marketId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"user\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"payout\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"executor\",\"type\":\"address\",\"indexed\":false,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"BetPlaced\",\"inputs\":[{\"name\":\"betId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"marketId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"user\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"requestedAmount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"acceptedAmount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"lockedOdds\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"quoteVersion\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"outcome\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"uint8\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"BetRefunded\",\"inputs\":[{\"name\":\"betId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"marketId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"user\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"refundAmount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"reason\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"uint8\"},{\"name\":\"quoteVersion\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"Initialized\",\"inputs\":[{\"name\":\"version\",\"type\":\"uint64\",\"indexed\":false,\"internalType\":\"uint64\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"LpLossOffsetApplied\",\"inputs\":[{\"name\":\"amount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"remainingOffset\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"MarketManuallyLocked\",\"inputs\":[{\"name\":\"marketId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"matchId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"operator\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"lockedAt\",\"type\":\"uint64\",\"indexed\":false,\"internalType\":\"uint64\"},{\"name\":\"quoteVersion\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"MarketOpened\",\"inputs\":[{\"name\":\"marketId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"matchId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"marketType\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"uint8\"},{\"name\":\"line\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"uint8\"},{\"name\":\"matchStartTime\",\"type\":\"uint64\",\"indexed\":false,\"internalType\":\"uint64\"},{\"name\":\"lockAt\",\"type\":\"uint64\",\"indexed\":false,\"internalType\":\"uint64\"},{\"name\":\"quoteVersion\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"MarketSettlementFinalized\",\"inputs\":[{\"name\":\"marketId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"resultKind\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"uint8\"},{\"name\":\"scoreSettled\",\"type\":\"bool\",\"indexed\":false,\"internalType\":\"bool\"},{\"name\":\"homeScore\",\"type\":\"uint16\",\"indexed\":false,\"internalType\":\"uint16\"},{\"name\":\"awayScore\",\"type\":\"uint16\",\"indexed\":false,\"internalType\":\"uint16\"},{\"name\":\"grossPayout\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"lpMarginShare\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"platformMarginShare\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"quoteVersion\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"MarketSettlementScoreBatchProcessed\",\"inputs\":[{\"name\":\"marketId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"homeScore\",\"type\":\"uint16\",\"indexed\":false,\"internalType\":\"uint16\"},{\"name\":\"awayScore\",\"type\":\"uint16\",\"indexed\":false,\"internalType\":\"uint16\"},{\"name\":\"processedCount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"totalBetCount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"OddsUpdated\",\"inputs\":[{\"name\":\"marketId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"updatedAt\",\"type\":\"uint64\",\"indexed\":false,\"internalType\":\"uint64\"},{\"name\":\"quoteVersion\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"signal\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"uint8\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"Paused\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"indexed\":false,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"PayoutClaimed\",\"inputs\":[{\"name\":\"betId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"user\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"grossPayout\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"taxAmount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"netPayout\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"PlatformReserveUpdated\",\"inputs\":[{\"name\":\"delta\",\"type\":\"int256\",\"indexed\":false,\"internalType\":\"int256\"},{\"name\":\"newBalance\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"reason\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"uint8\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"ReferralClaimed\",\"inputs\":[{\"name\":\"referrer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"oddAmount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"ReferralClaimedUSDT\",\"inputs\":[{\"name\":\"referrer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"oddAmount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"usdtAmount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"currentPriceX18\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"ReferralRewardAccumulated\",\"inputs\":[{\"name\":\"referrer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"from\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"kind\",\"type\":\"uint8\",\"indexed\":false,\"internalType\":\"uint8\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"ReferrerBound\",\"inputs\":[{\"name\":\"user\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"referrer\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"ReserveBelowFloor\",\"inputs\":[{\"name\":\"remainingReserve\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"ReserveStepAlert\",\"inputs\":[{\"name\":\"stepIndex\",\"type\":\"uint256\",\"indexed\":true,\"internalType\":\"uint256\"},{\"name\":\"remainingReserve\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"ReserveTapped\",\"inputs\":[{\"name\":\"matchId\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"tapAmount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"remainingReserve\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"RoleAdminChanged\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"previousAdminRole\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"newAdminRole\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"RoleGranted\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"account\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"sender\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"RoleRevoked\",\"inputs\":[{\"name\":\"role\",\"type\":\"bytes32\",\"indexed\":true,\"internalType\":\"bytes32\"},{\"name\":\"account\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"},{\"name\":\"sender\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"TaxBufferFunded\",\"inputs\":[{\"name\":\"amount\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"},{\"name\":\"newTaxBuffer\",\"type\":\"uint256\",\"indexed\":false,\"internalType\":\"uint256\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"Unpaused\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"indexed\":false,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"event\",\"name\":\"Upgraded\",\"inputs\":[{\"name\":\"implementation\",\"type\":\"address\",\"indexed\":true,\"internalType\":\"address\"}],\"anonymous\":false},{\"type\":\"error\",\"name\":\"AccessControlBadConfirmation\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"AccessControlUnauthorizedAccount\",\"inputs\":[{\"name\":\"account\",\"type\":\"address\",\"internalType\":\"address\"},{\"name\":\"neededRole\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}]},{\"type\":\"error\",\"name\":\"AddressEmptyCode\",\"inputs\":[{\"name\":\"target\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"DependenciesAlreadyConfigured\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"ERC1967InvalidImplementation\",\"inputs\":[{\"name\":\"implementation\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"ERC1967NonPayable\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"EnforcedPause\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"ExpectedPause\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"FailedCall\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"InvalidAddress\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"InvalidInitialization\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"InvalidReferralClaim\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"InvalidReferrerBinding\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"InvalidTaxConfig\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"MarketAlreadyExists\",\"inputs\":[{\"name\":\"marketId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}]},{\"type\":\"error\",\"name\":\"MarketClosed\",\"inputs\":[{\"name\":\"marketId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}]},{\"type\":\"error\",\"name\":\"MarketLocked\",\"inputs\":[{\"name\":\"marketId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}]},{\"type\":\"error\",\"name\":\"MarketNotOpen\",\"inputs\":[{\"name\":\"marketId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}]},{\"type\":\"error\",\"name\":\"MarketTemplateNotAllowed\",\"inputs\":[{\"name\":\"marketType\",\"type\":\"uint8\",\"internalType\":\"uint8\"},{\"name\":\"line\",\"type\":\"uint8\",\"internalType\":\"uint8\"}]},{\"type\":\"error\",\"name\":\"NotInitializing\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"SafeERC20FailedOperation\",\"inputs\":[{\"name\":\"token\",\"type\":\"address\",\"internalType\":\"address\"}]},{\"type\":\"error\",\"name\":\"SettlementCannotClose\",\"inputs\":[{\"name\":\"marketId\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}]},{\"type\":\"error\",\"name\":\"UUPSUnauthorizedCallContext\",\"inputs\":[]},{\"type\":\"error\",\"name\":\"UUPSUnsupportedProxiableUUID\",\"inputs\":[{\"name\":\"slot\",\"type\":\"bytes32\",\"internalType\":\"bytes32\"}]}]",
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

// DEFAULTADMINROLE is a free data retrieval call binding the contract method 0xa217fddf.
//
// Solidity: function DEFAULT_ADMIN_ROLE() view returns(bytes32)
func (_BettingPool *BettingPoolCaller) DEFAULTADMINROLE(opts *bind.CallOpts) ([32]byte, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "DEFAULT_ADMIN_ROLE")

	if err != nil {
		return *new([32]byte), err
	}

	out0 := *abi.ConvertType(out[0], new([32]byte)).(*[32]byte)

	return out0, err

}

// DEFAULTADMINROLE is a free data retrieval call binding the contract method 0xa217fddf.
//
// Solidity: function DEFAULT_ADMIN_ROLE() view returns(bytes32)
func (_BettingPool *BettingPoolSession) DEFAULTADMINROLE() ([32]byte, error) {
	return _BettingPool.Contract.DEFAULTADMINROLE(&_BettingPool.CallOpts)
}

// DEFAULTADMINROLE is a free data retrieval call binding the contract method 0xa217fddf.
//
// Solidity: function DEFAULT_ADMIN_ROLE() view returns(bytes32)
func (_BettingPool *BettingPoolCallerSession) DEFAULTADMINROLE() ([32]byte, error) {
	return _BettingPool.Contract.DEFAULTADMINROLE(&_BettingPool.CallOpts)
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

// AccountedBalance is a free data retrieval call binding the contract method 0x0937eb54.
//
// Solidity: function accountedBalance() view returns(uint256)
func (_BettingPool *BettingPoolCaller) AccountedBalance(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "accountedBalance")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// AccountedBalance is a free data retrieval call binding the contract method 0x0937eb54.
//
// Solidity: function accountedBalance() view returns(uint256)
func (_BettingPool *BettingPoolSession) AccountedBalance() (*big.Int, error) {
	return _BettingPool.Contract.AccountedBalance(&_BettingPool.CallOpts)
}

// AccountedBalance is a free data retrieval call binding the contract method 0x0937eb54.
//
// Solidity: function accountedBalance() view returns(uint256)
func (_BettingPool *BettingPoolCallerSession) AccountedBalance() (*big.Int, error) {
	return _BettingPool.Contract.AccountedBalance(&_BettingPool.CallOpts)
}

// BetTaxBps is a free data retrieval call binding the contract method 0x2ee8af7d.
//
// Solidity: function betTaxBps() view returns(uint16)
func (_BettingPool *BettingPoolCaller) BetTaxBps(opts *bind.CallOpts) (uint16, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "betTaxBps")

	if err != nil {
		return *new(uint16), err
	}

	out0 := *abi.ConvertType(out[0], new(uint16)).(*uint16)

	return out0, err

}

// BetTaxBps is a free data retrieval call binding the contract method 0x2ee8af7d.
//
// Solidity: function betTaxBps() view returns(uint16)
func (_BettingPool *BettingPoolSession) BetTaxBps() (uint16, error) {
	return _BettingPool.Contract.BetTaxBps(&_BettingPool.CallOpts)
}

// BetTaxBps is a free data retrieval call binding the contract method 0x2ee8af7d.
//
// Solidity: function betTaxBps() view returns(uint16)
func (_BettingPool *BettingPoolCallerSession) BetTaxBps() (uint16, error) {
	return _BettingPool.Contract.BetTaxBps(&_BettingPool.CallOpts)
}

// GetBet is a free data retrieval call binding the contract method 0x37e8c09e.
//
// Solidity: function getBet(bytes32 betId) view returns((address,bytes32,uint8,uint256,uint256,uint256,uint32,uint8,uint256,uint16,uint16,uint16,uint16,address))
func (_BettingPool *BettingPoolCaller) GetBet(opts *bind.CallOpts, betId [32]byte) (BettingPoolStorageBet, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "getBet", betId)

	if err != nil {
		return *new(BettingPoolStorageBet), err
	}

	out0 := *abi.ConvertType(out[0], new(BettingPoolStorageBet)).(*BettingPoolStorageBet)

	return out0, err

}

// GetBet is a free data retrieval call binding the contract method 0x37e8c09e.
//
// Solidity: function getBet(bytes32 betId) view returns((address,bytes32,uint8,uint256,uint256,uint256,uint32,uint8,uint256,uint16,uint16,uint16,uint16,address))
func (_BettingPool *BettingPoolSession) GetBet(betId [32]byte) (BettingPoolStorageBet, error) {
	return _BettingPool.Contract.GetBet(&_BettingPool.CallOpts, betId)
}

// GetBet is a free data retrieval call binding the contract method 0x37e8c09e.
//
// Solidity: function getBet(bytes32 betId) view returns((address,bytes32,uint8,uint256,uint256,uint256,uint32,uint8,uint256,uint16,uint16,uint16,uint16,address))
func (_BettingPool *BettingPoolCallerSession) GetBet(betId [32]byte) (BettingPoolStorageBet, error) {
	return _BettingPool.Contract.GetBet(&_BettingPool.CallOpts, betId)
}

// GetMarket is a free data retrieval call binding the contract method 0xc3c95c7b.
//
// Solidity: function getMarket(bytes32 marketId) view returns((bytes32,uint8,uint8,uint8,uint64,uint64,uint8,uint64))
func (_BettingPool *BettingPoolCaller) GetMarket(opts *bind.CallOpts, marketId [32]byte) (BettingPoolStorageMarketConfig, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "getMarket", marketId)

	if err != nil {
		return *new(BettingPoolStorageMarketConfig), err
	}

	out0 := *abi.ConvertType(out[0], new(BettingPoolStorageMarketConfig)).(*BettingPoolStorageMarketConfig)

	return out0, err

}

// GetMarket is a free data retrieval call binding the contract method 0xc3c95c7b.
//
// Solidity: function getMarket(bytes32 marketId) view returns((bytes32,uint8,uint8,uint8,uint64,uint64,uint8,uint64))
func (_BettingPool *BettingPoolSession) GetMarket(marketId [32]byte) (BettingPoolStorageMarketConfig, error) {
	return _BettingPool.Contract.GetMarket(&_BettingPool.CallOpts, marketId)
}

// GetMarket is a free data retrieval call binding the contract method 0xc3c95c7b.
//
// Solidity: function getMarket(bytes32 marketId) view returns((bytes32,uint8,uint8,uint8,uint64,uint64,uint8,uint64))
func (_BettingPool *BettingPoolCallerSession) GetMarket(marketId [32]byte) (BettingPoolStorageMarketConfig, error) {
	return _BettingPool.Contract.GetMarket(&_BettingPool.CallOpts, marketId)
}

// GetMarketBetIds is a free data retrieval call binding the contract method 0xa79107b5.
//
// Solidity: function getMarketBetIds(bytes32 marketId, uint256 offset, uint256 limit) view returns(bytes32[] result)
func (_BettingPool *BettingPoolCaller) GetMarketBetIds(opts *bind.CallOpts, marketId [32]byte, offset *big.Int, limit *big.Int) ([][32]byte, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "getMarketBetIds", marketId, offset, limit)

	if err != nil {
		return *new([][32]byte), err
	}

	out0 := *abi.ConvertType(out[0], new([][32]byte)).(*[][32]byte)

	return out0, err

}

// GetMarketBetIds is a free data retrieval call binding the contract method 0xa79107b5.
//
// Solidity: function getMarketBetIds(bytes32 marketId, uint256 offset, uint256 limit) view returns(bytes32[] result)
func (_BettingPool *BettingPoolSession) GetMarketBetIds(marketId [32]byte, offset *big.Int, limit *big.Int) ([][32]byte, error) {
	return _BettingPool.Contract.GetMarketBetIds(&_BettingPool.CallOpts, marketId, offset, limit)
}

// GetMarketBetIds is a free data retrieval call binding the contract method 0xa79107b5.
//
// Solidity: function getMarketBetIds(bytes32 marketId, uint256 offset, uint256 limit) view returns(bytes32[] result)
func (_BettingPool *BettingPoolCallerSession) GetMarketBetIds(marketId [32]byte, offset *big.Int, limit *big.Int) ([][32]byte, error) {
	return _BettingPool.Contract.GetMarketBetIds(&_BettingPool.CallOpts, marketId, offset, limit)
}

// GetMarketExposure is a free data retrieval call binding the contract method 0xad684bfb.
//
// Solidity: function getMarketExposure(bytes32 marketId) view returns(uint256[] totalStakedByOutcome, uint256[] payoutByOutcome, uint8 signalColor)
func (_BettingPool *BettingPoolCaller) GetMarketExposure(opts *bind.CallOpts, marketId [32]byte) (struct {
	TotalStakedByOutcome []*big.Int
	PayoutByOutcome      []*big.Int
	SignalColor          uint8
}, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "getMarketExposure", marketId)

	outstruct := new(struct {
		TotalStakedByOutcome []*big.Int
		PayoutByOutcome      []*big.Int
		SignalColor          uint8
	})
	if err != nil {
		return *outstruct, err
	}

	outstruct.TotalStakedByOutcome = *abi.ConvertType(out[0], new([]*big.Int)).(*[]*big.Int)
	outstruct.PayoutByOutcome = *abi.ConvertType(out[1], new([]*big.Int)).(*[]*big.Int)
	outstruct.SignalColor = *abi.ConvertType(out[2], new(uint8)).(*uint8)

	return *outstruct, err

}

// GetMarketExposure is a free data retrieval call binding the contract method 0xad684bfb.
//
// Solidity: function getMarketExposure(bytes32 marketId) view returns(uint256[] totalStakedByOutcome, uint256[] payoutByOutcome, uint8 signalColor)
func (_BettingPool *BettingPoolSession) GetMarketExposure(marketId [32]byte) (struct {
	TotalStakedByOutcome []*big.Int
	PayoutByOutcome      []*big.Int
	SignalColor          uint8
}, error) {
	return _BettingPool.Contract.GetMarketExposure(&_BettingPool.CallOpts, marketId)
}

// GetMarketExposure is a free data retrieval call binding the contract method 0xad684bfb.
//
// Solidity: function getMarketExposure(bytes32 marketId) view returns(uint256[] totalStakedByOutcome, uint256[] payoutByOutcome, uint8 signalColor)
func (_BettingPool *BettingPoolCallerSession) GetMarketExposure(marketId [32]byte) (struct {
	TotalStakedByOutcome []*big.Int
	PayoutByOutcome      []*big.Int
	SignalColor          uint8
}, error) {
	return _BettingPool.Contract.GetMarketExposure(&_BettingPool.CallOpts, marketId)
}

// GetMarketOdds is a free data retrieval call binding the contract method 0x756828eb.
//
// Solidity: function getMarketOdds(bytes32 marketId) view returns(uint256[], uint256[], uint64, uint256)
func (_BettingPool *BettingPoolCaller) GetMarketOdds(opts *bind.CallOpts, marketId [32]byte) ([]*big.Int, []*big.Int, uint64, *big.Int, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "getMarketOdds", marketId)

	if err != nil {
		return *new([]*big.Int), *new([]*big.Int), *new(uint64), *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new([]*big.Int)).(*[]*big.Int)
	out1 := *abi.ConvertType(out[1], new([]*big.Int)).(*[]*big.Int)
	out2 := *abi.ConvertType(out[2], new(uint64)).(*uint64)
	out3 := *abi.ConvertType(out[3], new(*big.Int)).(**big.Int)

	return out0, out1, out2, out3, err

}

// GetMarketOdds is a free data retrieval call binding the contract method 0x756828eb.
//
// Solidity: function getMarketOdds(bytes32 marketId) view returns(uint256[], uint256[], uint64, uint256)
func (_BettingPool *BettingPoolSession) GetMarketOdds(marketId [32]byte) ([]*big.Int, []*big.Int, uint64, *big.Int, error) {
	return _BettingPool.Contract.GetMarketOdds(&_BettingPool.CallOpts, marketId)
}

// GetMarketOdds is a free data retrieval call binding the contract method 0x756828eb.
//
// Solidity: function getMarketOdds(bytes32 marketId) view returns(uint256[], uint256[], uint64, uint256)
func (_BettingPool *BettingPoolCallerSession) GetMarketOdds(marketId [32]byte) ([]*big.Int, []*big.Int, uint64, *big.Int, error) {
	return _BettingPool.Contract.GetMarketOdds(&_BettingPool.CallOpts, marketId)
}

// GetRoleAdmin is a free data retrieval call binding the contract method 0x248a9ca3.
//
// Solidity: function getRoleAdmin(bytes32 role) view returns(bytes32)
func (_BettingPool *BettingPoolCaller) GetRoleAdmin(opts *bind.CallOpts, role [32]byte) ([32]byte, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "getRoleAdmin", role)

	if err != nil {
		return *new([32]byte), err
	}

	out0 := *abi.ConvertType(out[0], new([32]byte)).(*[32]byte)

	return out0, err

}

// GetRoleAdmin is a free data retrieval call binding the contract method 0x248a9ca3.
//
// Solidity: function getRoleAdmin(bytes32 role) view returns(bytes32)
func (_BettingPool *BettingPoolSession) GetRoleAdmin(role [32]byte) ([32]byte, error) {
	return _BettingPool.Contract.GetRoleAdmin(&_BettingPool.CallOpts, role)
}

// GetRoleAdmin is a free data retrieval call binding the contract method 0x248a9ca3.
//
// Solidity: function getRoleAdmin(bytes32 role) view returns(bytes32)
func (_BettingPool *BettingPoolCallerSession) GetRoleAdmin(role [32]byte) ([32]byte, error) {
	return _BettingPool.Contract.GetRoleAdmin(&_BettingPool.CallOpts, role)
}

// GetUserRiskLedger is a free data retrieval call binding the contract method 0xd05bf6e3.
//
// Solidity: function getUserRiskLedger(address user) view returns((uint32,uint256,uint256))
func (_BettingPool *BettingPoolCaller) GetUserRiskLedger(opts *bind.CallOpts, user common.Address) (BettingPoolStorageUserRiskLedger, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "getUserRiskLedger", user)

	if err != nil {
		return *new(BettingPoolStorageUserRiskLedger), err
	}

	out0 := *abi.ConvertType(out[0], new(BettingPoolStorageUserRiskLedger)).(*BettingPoolStorageUserRiskLedger)

	return out0, err

}

// GetUserRiskLedger is a free data retrieval call binding the contract method 0xd05bf6e3.
//
// Solidity: function getUserRiskLedger(address user) view returns((uint32,uint256,uint256))
func (_BettingPool *BettingPoolSession) GetUserRiskLedger(user common.Address) (BettingPoolStorageUserRiskLedger, error) {
	return _BettingPool.Contract.GetUserRiskLedger(&_BettingPool.CallOpts, user)
}

// GetUserRiskLedger is a free data retrieval call binding the contract method 0xd05bf6e3.
//
// Solidity: function getUserRiskLedger(address user) view returns((uint32,uint256,uint256))
func (_BettingPool *BettingPoolCallerSession) GetUserRiskLedger(user common.Address) (BettingPoolStorageUserRiskLedger, error) {
	return _BettingPool.Contract.GetUserRiskLedger(&_BettingPool.CallOpts, user)
}

// HasRole is a free data retrieval call binding the contract method 0x91d14854.
//
// Solidity: function hasRole(bytes32 role, address account) view returns(bool)
func (_BettingPool *BettingPoolCaller) HasRole(opts *bind.CallOpts, role [32]byte, account common.Address) (bool, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "hasRole", role, account)

	if err != nil {
		return *new(bool), err
	}

	out0 := *abi.ConvertType(out[0], new(bool)).(*bool)

	return out0, err

}

// HasRole is a free data retrieval call binding the contract method 0x91d14854.
//
// Solidity: function hasRole(bytes32 role, address account) view returns(bool)
func (_BettingPool *BettingPoolSession) HasRole(role [32]byte, account common.Address) (bool, error) {
	return _BettingPool.Contract.HasRole(&_BettingPool.CallOpts, role, account)
}

// HasRole is a free data retrieval call binding the contract method 0x91d14854.
//
// Solidity: function hasRole(bytes32 role, address account) view returns(bool)
func (_BettingPool *BettingPoolCallerSession) HasRole(role [32]byte, account common.Address) (bool, error) {
	return _BettingPool.Contract.HasRole(&_BettingPool.CallOpts, role, account)
}

// IsMatchTerminal is a free data retrieval call binding the contract method 0xdba60337.
//
// Solidity: function isMatchTerminal(bytes32 matchId) view returns(bool)
func (_BettingPool *BettingPoolCaller) IsMatchTerminal(opts *bind.CallOpts, matchId [32]byte) (bool, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "isMatchTerminal", matchId)

	if err != nil {
		return *new(bool), err
	}

	out0 := *abi.ConvertType(out[0], new(bool)).(*bool)

	return out0, err

}

// IsMatchTerminal is a free data retrieval call binding the contract method 0xdba60337.
//
// Solidity: function isMatchTerminal(bytes32 matchId) view returns(bool)
func (_BettingPool *BettingPoolSession) IsMatchTerminal(matchId [32]byte) (bool, error) {
	return _BettingPool.Contract.IsMatchTerminal(&_BettingPool.CallOpts, matchId)
}

// IsMatchTerminal is a free data retrieval call binding the contract method 0xdba60337.
//
// Solidity: function isMatchTerminal(bytes32 matchId) view returns(bool)
func (_BettingPool *BettingPoolCallerSession) IsMatchTerminal(matchId [32]byte) (bool, error) {
	return _BettingPool.Contract.IsMatchTerminal(&_BettingPool.CallOpts, matchId)
}

// LiquidityPool is a free data retrieval call binding the contract method 0x665a11ca.
//
// Solidity: function liquidityPool() view returns(address)
func (_BettingPool *BettingPoolCaller) LiquidityPool(opts *bind.CallOpts) (common.Address, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "liquidityPool")

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// LiquidityPool is a free data retrieval call binding the contract method 0x665a11ca.
//
// Solidity: function liquidityPool() view returns(address)
func (_BettingPool *BettingPoolSession) LiquidityPool() (common.Address, error) {
	return _BettingPool.Contract.LiquidityPool(&_BettingPool.CallOpts)
}

// LiquidityPool is a free data retrieval call binding the contract method 0x665a11ca.
//
// Solidity: function liquidityPool() view returns(address)
func (_BettingPool *BettingPoolCallerSession) LiquidityPool() (common.Address, error) {
	return _BettingPool.Contract.LiquidityPool(&_BettingPool.CallOpts)
}

// LpLossOffsetRemaining is a free data retrieval call binding the contract method 0xe093e74f.
//
// Solidity: function lpLossOffsetRemaining() view returns(uint256)
func (_BettingPool *BettingPoolCaller) LpLossOffsetRemaining(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "lpLossOffsetRemaining")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// LpLossOffsetRemaining is a free data retrieval call binding the contract method 0xe093e74f.
//
// Solidity: function lpLossOffsetRemaining() view returns(uint256)
func (_BettingPool *BettingPoolSession) LpLossOffsetRemaining() (*big.Int, error) {
	return _BettingPool.Contract.LpLossOffsetRemaining(&_BettingPool.CallOpts)
}

// LpLossOffsetRemaining is a free data retrieval call binding the contract method 0xe093e74f.
//
// Solidity: function lpLossOffsetRemaining() view returns(uint256)
func (_BettingPool *BettingPoolCallerSession) LpLossOffsetRemaining() (*big.Int, error) {
	return _BettingPool.Contract.LpLossOffsetRemaining(&_BettingPool.CallOpts)
}

// LpMarginShareBps is a free data retrieval call binding the contract method 0xfd47c4d9.
//
// Solidity: function lpMarginShareBps() view returns(uint16)
func (_BettingPool *BettingPoolCaller) LpMarginShareBps(opts *bind.CallOpts) (uint16, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "lpMarginShareBps")

	if err != nil {
		return *new(uint16), err
	}

	out0 := *abi.ConvertType(out[0], new(uint16)).(*uint16)

	return out0, err

}

// LpMarginShareBps is a free data retrieval call binding the contract method 0xfd47c4d9.
//
// Solidity: function lpMarginShareBps() view returns(uint16)
func (_BettingPool *BettingPoolSession) LpMarginShareBps() (uint16, error) {
	return _BettingPool.Contract.LpMarginShareBps(&_BettingPool.CallOpts)
}

// LpMarginShareBps is a free data retrieval call binding the contract method 0xfd47c4d9.
//
// Solidity: function lpMarginShareBps() view returns(uint16)
func (_BettingPool *BettingPoolCallerSession) LpMarginShareBps() (uint16, error) {
	return _BettingPool.Contract.LpMarginShareBps(&_BettingPool.CallOpts)
}

// NextBetNonce is a free data retrieval call binding the contract method 0xbca37a8b.
//
// Solidity: function nextBetNonce() view returns(uint256)
func (_BettingPool *BettingPoolCaller) NextBetNonce(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "nextBetNonce")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// NextBetNonce is a free data retrieval call binding the contract method 0xbca37a8b.
//
// Solidity: function nextBetNonce() view returns(uint256)
func (_BettingPool *BettingPoolSession) NextBetNonce() (*big.Int, error) {
	return _BettingPool.Contract.NextBetNonce(&_BettingPool.CallOpts)
}

// NextBetNonce is a free data retrieval call binding the contract method 0xbca37a8b.
//
// Solidity: function nextBetNonce() view returns(uint256)
func (_BettingPool *BettingPoolCallerSession) NextBetNonce() (*big.Int, error) {
	return _BettingPool.Contract.NextBetNonce(&_BettingPool.CallOpts)
}

// OddToken is a free data retrieval call binding the contract method 0x94235764.
//
// Solidity: function oddToken() view returns(address)
func (_BettingPool *BettingPoolCaller) OddToken(opts *bind.CallOpts) (common.Address, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "oddToken")

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// OddToken is a free data retrieval call binding the contract method 0x94235764.
//
// Solidity: function oddToken() view returns(address)
func (_BettingPool *BettingPoolSession) OddToken() (common.Address, error) {
	return _BettingPool.Contract.OddToken(&_BettingPool.CallOpts)
}

// OddToken is a free data retrieval call binding the contract method 0x94235764.
//
// Solidity: function oddToken() view returns(address)
func (_BettingPool *BettingPoolCallerSession) OddToken() (common.Address, error) {
	return _BettingPool.Contract.OddToken(&_BettingPool.CallOpts)
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

// PayoutTaxBps is a free data retrieval call binding the contract method 0xc3ce52b9.
//
// Solidity: function payoutTaxBps() view returns(uint16)
func (_BettingPool *BettingPoolCaller) PayoutTaxBps(opts *bind.CallOpts) (uint16, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "payoutTaxBps")

	if err != nil {
		return *new(uint16), err
	}

	out0 := *abi.ConvertType(out[0], new(uint16)).(*uint16)

	return out0, err

}

// PayoutTaxBps is a free data retrieval call binding the contract method 0xc3ce52b9.
//
// Solidity: function payoutTaxBps() view returns(uint16)
func (_BettingPool *BettingPoolSession) PayoutTaxBps() (uint16, error) {
	return _BettingPool.Contract.PayoutTaxBps(&_BettingPool.CallOpts)
}

// PayoutTaxBps is a free data retrieval call binding the contract method 0xc3ce52b9.
//
// Solidity: function payoutTaxBps() view returns(uint16)
func (_BettingPool *BettingPoolCallerSession) PayoutTaxBps() (uint16, error) {
	return _BettingPool.Contract.PayoutTaxBps(&_BettingPool.CallOpts)
}

// PlatformReserve is a free data retrieval call binding the contract method 0x42277097.
//
// Solidity: function platformReserve() view returns(uint256)
func (_BettingPool *BettingPoolCaller) PlatformReserve(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "platformReserve")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// PlatformReserve is a free data retrieval call binding the contract method 0x42277097.
//
// Solidity: function platformReserve() view returns(uint256)
func (_BettingPool *BettingPoolSession) PlatformReserve() (*big.Int, error) {
	return _BettingPool.Contract.PlatformReserve(&_BettingPool.CallOpts)
}

// PlatformReserve is a free data retrieval call binding the contract method 0x42277097.
//
// Solidity: function platformReserve() view returns(uint256)
func (_BettingPool *BettingPoolCallerSession) PlatformReserve() (*big.Int, error) {
	return _BettingPool.Contract.PlatformReserve(&_BettingPool.CallOpts)
}

// PlatformTreasury is a free data retrieval call binding the contract method 0xe138818c.
//
// Solidity: function platformTreasury() view returns(address)
func (_BettingPool *BettingPoolCaller) PlatformTreasury(opts *bind.CallOpts) (common.Address, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "platformTreasury")

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// PlatformTreasury is a free data retrieval call binding the contract method 0xe138818c.
//
// Solidity: function platformTreasury() view returns(address)
func (_BettingPool *BettingPoolSession) PlatformTreasury() (common.Address, error) {
	return _BettingPool.Contract.PlatformTreasury(&_BettingPool.CallOpts)
}

// PlatformTreasury is a free data retrieval call binding the contract method 0xe138818c.
//
// Solidity: function platformTreasury() view returns(address)
func (_BettingPool *BettingPoolCallerSession) PlatformTreasury() (common.Address, error) {
	return _BettingPool.Contract.PlatformTreasury(&_BettingPool.CallOpts)
}

// PreviewSignal is a free data retrieval call binding the contract method 0x9f3c19b4.
//
// Solidity: function previewSignal(bytes32 marketId, uint8 outcome, uint256 requestedAmount) view returns(uint8 signal, uint256 acceptedAmount, uint256 lockedOdds, bool partialFill, uint256 maxAcceptableAmount)
func (_BettingPool *BettingPoolCaller) PreviewSignal(opts *bind.CallOpts, marketId [32]byte, outcome uint8, requestedAmount *big.Int) (struct {
	Signal              uint8
	AcceptedAmount      *big.Int
	LockedOdds          *big.Int
	PartialFill         bool
	MaxAcceptableAmount *big.Int
}, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "previewSignal", marketId, outcome, requestedAmount)

	outstruct := new(struct {
		Signal              uint8
		AcceptedAmount      *big.Int
		LockedOdds          *big.Int
		PartialFill         bool
		MaxAcceptableAmount *big.Int
	})
	if err != nil {
		return *outstruct, err
	}

	outstruct.Signal = *abi.ConvertType(out[0], new(uint8)).(*uint8)
	outstruct.AcceptedAmount = *abi.ConvertType(out[1], new(*big.Int)).(**big.Int)
	outstruct.LockedOdds = *abi.ConvertType(out[2], new(*big.Int)).(**big.Int)
	outstruct.PartialFill = *abi.ConvertType(out[3], new(bool)).(*bool)
	outstruct.MaxAcceptableAmount = *abi.ConvertType(out[4], new(*big.Int)).(**big.Int)

	return *outstruct, err

}

// PreviewSignal is a free data retrieval call binding the contract method 0x9f3c19b4.
//
// Solidity: function previewSignal(bytes32 marketId, uint8 outcome, uint256 requestedAmount) view returns(uint8 signal, uint256 acceptedAmount, uint256 lockedOdds, bool partialFill, uint256 maxAcceptableAmount)
func (_BettingPool *BettingPoolSession) PreviewSignal(marketId [32]byte, outcome uint8, requestedAmount *big.Int) (struct {
	Signal              uint8
	AcceptedAmount      *big.Int
	LockedOdds          *big.Int
	PartialFill         bool
	MaxAcceptableAmount *big.Int
}, error) {
	return _BettingPool.Contract.PreviewSignal(&_BettingPool.CallOpts, marketId, outcome, requestedAmount)
}

// PreviewSignal is a free data retrieval call binding the contract method 0x9f3c19b4.
//
// Solidity: function previewSignal(bytes32 marketId, uint8 outcome, uint256 requestedAmount) view returns(uint8 signal, uint256 acceptedAmount, uint256 lockedOdds, bool partialFill, uint256 maxAcceptableAmount)
func (_BettingPool *BettingPoolCallerSession) PreviewSignal(marketId [32]byte, outcome uint8, requestedAmount *big.Int) (struct {
	Signal              uint8
	AcceptedAmount      *big.Int
	LockedOdds          *big.Int
	PartialFill         bool
	MaxAcceptableAmount *big.Int
}, error) {
	return _BettingPool.Contract.PreviewSignal(&_BettingPool.CallOpts, marketId, outcome, requestedAmount)
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

// ReferralClaimNonces is a free data retrieval call binding the contract method 0x38941e91.
//
// Solidity: function referralClaimNonces(address ) view returns(uint256)
func (_BettingPool *BettingPoolCaller) ReferralClaimNonces(opts *bind.CallOpts, arg0 common.Address) (*big.Int, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "referralClaimNonces", arg0)

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// ReferralClaimNonces is a free data retrieval call binding the contract method 0x38941e91.
//
// Solidity: function referralClaimNonces(address ) view returns(uint256)
func (_BettingPool *BettingPoolSession) ReferralClaimNonces(arg0 common.Address) (*big.Int, error) {
	return _BettingPool.Contract.ReferralClaimNonces(&_BettingPool.CallOpts, arg0)
}

// ReferralClaimNonces is a free data retrieval call binding the contract method 0x38941e91.
//
// Solidity: function referralClaimNonces(address ) view returns(uint256)
func (_BettingPool *BettingPoolCallerSession) ReferralClaimNonces(arg0 common.Address) (*big.Int, error) {
	return _BettingPool.Contract.ReferralClaimNonces(&_BettingPool.CallOpts, arg0)
}

// ReferralClaimSigner is a free data retrieval call binding the contract method 0x714038de.
//
// Solidity: function referralClaimSigner() view returns(address)
func (_BettingPool *BettingPoolCaller) ReferralClaimSigner(opts *bind.CallOpts) (common.Address, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "referralClaimSigner")

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// ReferralClaimSigner is a free data retrieval call binding the contract method 0x714038de.
//
// Solidity: function referralClaimSigner() view returns(address)
func (_BettingPool *BettingPoolSession) ReferralClaimSigner() (common.Address, error) {
	return _BettingPool.Contract.ReferralClaimSigner(&_BettingPool.CallOpts)
}

// ReferralClaimSigner is a free data retrieval call binding the contract method 0x714038de.
//
// Solidity: function referralClaimSigner() view returns(address)
func (_BettingPool *BettingPoolCallerSession) ReferralClaimSigner() (common.Address, error) {
	return _BettingPool.Contract.ReferralClaimSigner(&_BettingPool.CallOpts)
}

// ReferralSwapPoolFee is a free data retrieval call binding the contract method 0x90fe5bc7.
//
// Solidity: function referralSwapPoolFee() view returns(uint24)
func (_BettingPool *BettingPoolCaller) ReferralSwapPoolFee(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "referralSwapPoolFee")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// ReferralSwapPoolFee is a free data retrieval call binding the contract method 0x90fe5bc7.
//
// Solidity: function referralSwapPoolFee() view returns(uint24)
func (_BettingPool *BettingPoolSession) ReferralSwapPoolFee() (*big.Int, error) {
	return _BettingPool.Contract.ReferralSwapPoolFee(&_BettingPool.CallOpts)
}

// ReferralSwapPoolFee is a free data retrieval call binding the contract method 0x90fe5bc7.
//
// Solidity: function referralSwapPoolFee() view returns(uint24)
func (_BettingPool *BettingPoolCallerSession) ReferralSwapPoolFee() (*big.Int, error) {
	return _BettingPool.Contract.ReferralSwapPoolFee(&_BettingPool.CallOpts)
}

// ReferralSwapRouter is a free data retrieval call binding the contract method 0x9bf58ffa.
//
// Solidity: function referralSwapRouter() view returns(address)
func (_BettingPool *BettingPoolCaller) ReferralSwapRouter(opts *bind.CallOpts) (common.Address, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "referralSwapRouter")

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// ReferralSwapRouter is a free data retrieval call binding the contract method 0x9bf58ffa.
//
// Solidity: function referralSwapRouter() view returns(address)
func (_BettingPool *BettingPoolSession) ReferralSwapRouter() (common.Address, error) {
	return _BettingPool.Contract.ReferralSwapRouter(&_BettingPool.CallOpts)
}

// ReferralSwapRouter is a free data retrieval call binding the contract method 0x9bf58ffa.
//
// Solidity: function referralSwapRouter() view returns(address)
func (_BettingPool *BettingPoolCallerSession) ReferralSwapRouter() (common.Address, error) {
	return _BettingPool.Contract.ReferralSwapRouter(&_BettingPool.CallOpts)
}

// ReferralUsdtToken is a free data retrieval call binding the contract method 0xb7d3b671.
//
// Solidity: function referralUsdtToken() view returns(address)
func (_BettingPool *BettingPoolCaller) ReferralUsdtToken(opts *bind.CallOpts) (common.Address, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "referralUsdtToken")

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// ReferralUsdtToken is a free data retrieval call binding the contract method 0xb7d3b671.
//
// Solidity: function referralUsdtToken() view returns(address)
func (_BettingPool *BettingPoolSession) ReferralUsdtToken() (common.Address, error) {
	return _BettingPool.Contract.ReferralUsdtToken(&_BettingPool.CallOpts)
}

// ReferralUsdtToken is a free data retrieval call binding the contract method 0xb7d3b671.
//
// Solidity: function referralUsdtToken() view returns(address)
func (_BettingPool *BettingPoolCallerSession) ReferralUsdtToken() (common.Address, error) {
	return _BettingPool.Contract.ReferralUsdtToken(&_BettingPool.CallOpts)
}

// ReferrerRewardsOdd is a free data retrieval call binding the contract method 0xd9357c11.
//
// Solidity: function referrerRewardsOdd(address ) view returns(uint256)
func (_BettingPool *BettingPoolCaller) ReferrerRewardsOdd(opts *bind.CallOpts, arg0 common.Address) (*big.Int, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "referrerRewardsOdd", arg0)

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// ReferrerRewardsOdd is a free data retrieval call binding the contract method 0xd9357c11.
//
// Solidity: function referrerRewardsOdd(address ) view returns(uint256)
func (_BettingPool *BettingPoolSession) ReferrerRewardsOdd(arg0 common.Address) (*big.Int, error) {
	return _BettingPool.Contract.ReferrerRewardsOdd(&_BettingPool.CallOpts, arg0)
}

// ReferrerRewardsOdd is a free data retrieval call binding the contract method 0xd9357c11.
//
// Solidity: function referrerRewardsOdd(address ) view returns(uint256)
func (_BettingPool *BettingPoolCallerSession) ReferrerRewardsOdd(arg0 common.Address) (*big.Int, error) {
	return _BettingPool.Contract.ReferrerRewardsOdd(&_BettingPool.CallOpts, arg0)
}

// Referrers is a free data retrieval call binding the contract method 0x4a3b68cc.
//
// Solidity: function referrers(address ) view returns(address)
func (_BettingPool *BettingPoolCaller) Referrers(opts *bind.CallOpts, arg0 common.Address) (common.Address, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "referrers", arg0)

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// Referrers is a free data retrieval call binding the contract method 0x4a3b68cc.
//
// Solidity: function referrers(address ) view returns(address)
func (_BettingPool *BettingPoolSession) Referrers(arg0 common.Address) (common.Address, error) {
	return _BettingPool.Contract.Referrers(&_BettingPool.CallOpts, arg0)
}

// Referrers is a free data retrieval call binding the contract method 0x4a3b68cc.
//
// Solidity: function referrers(address ) view returns(address)
func (_BettingPool *BettingPoolCallerSession) Referrers(arg0 common.Address) (common.Address, error) {
	return _BettingPool.Contract.Referrers(&_BettingPool.CallOpts, arg0)
}

// SettlementModule is a free data retrieval call binding the contract method 0x3f01a309.
//
// Solidity: function settlementModule() view returns(address)
func (_BettingPool *BettingPoolCaller) SettlementModule(opts *bind.CallOpts) (common.Address, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "settlementModule")

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// SettlementModule is a free data retrieval call binding the contract method 0x3f01a309.
//
// Solidity: function settlementModule() view returns(address)
func (_BettingPool *BettingPoolSession) SettlementModule() (common.Address, error) {
	return _BettingPool.Contract.SettlementModule(&_BettingPool.CallOpts)
}

// SettlementModule is a free data retrieval call binding the contract method 0x3f01a309.
//
// Solidity: function settlementModule() view returns(address)
func (_BettingPool *BettingPoolCallerSession) SettlementModule() (common.Address, error) {
	return _BettingPool.Contract.SettlementModule(&_BettingPool.CallOpts)
}

// StakingPool is a free data retrieval call binding the contract method 0x0c56ae3b.
//
// Solidity: function stakingPool() view returns(address)
func (_BettingPool *BettingPoolCaller) StakingPool(opts *bind.CallOpts) (common.Address, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "stakingPool")

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// StakingPool is a free data retrieval call binding the contract method 0x0c56ae3b.
//
// Solidity: function stakingPool() view returns(address)
func (_BettingPool *BettingPoolSession) StakingPool() (common.Address, error) {
	return _BettingPool.Contract.StakingPool(&_BettingPool.CallOpts)
}

// StakingPool is a free data retrieval call binding the contract method 0x0c56ae3b.
//
// Solidity: function stakingPool() view returns(address)
func (_BettingPool *BettingPoolCallerSession) StakingPool() (common.Address, error) {
	return _BettingPool.Contract.StakingPool(&_BettingPool.CallOpts)
}

// SupportsInterface is a free data retrieval call binding the contract method 0x01ffc9a7.
//
// Solidity: function supportsInterface(bytes4 interfaceId) view returns(bool)
func (_BettingPool *BettingPoolCaller) SupportsInterface(opts *bind.CallOpts, interfaceId [4]byte) (bool, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "supportsInterface", interfaceId)

	if err != nil {
		return *new(bool), err
	}

	out0 := *abi.ConvertType(out[0], new(bool)).(*bool)

	return out0, err

}

// SupportsInterface is a free data retrieval call binding the contract method 0x01ffc9a7.
//
// Solidity: function supportsInterface(bytes4 interfaceId) view returns(bool)
func (_BettingPool *BettingPoolSession) SupportsInterface(interfaceId [4]byte) (bool, error) {
	return _BettingPool.Contract.SupportsInterface(&_BettingPool.CallOpts, interfaceId)
}

// SupportsInterface is a free data retrieval call binding the contract method 0x01ffc9a7.
//
// Solidity: function supportsInterface(bytes4 interfaceId) view returns(bool)
func (_BettingPool *BettingPoolCallerSession) SupportsInterface(interfaceId [4]byte) (bool, error) {
	return _BettingPool.Contract.SupportsInterface(&_BettingPool.CallOpts, interfaceId)
}

// TaxAllocPlatformBps is a free data retrieval call binding the contract method 0x5064b68d.
//
// Solidity: function taxAllocPlatformBps() view returns(uint16)
func (_BettingPool *BettingPoolCaller) TaxAllocPlatformBps(opts *bind.CallOpts) (uint16, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "taxAllocPlatformBps")

	if err != nil {
		return *new(uint16), err
	}

	out0 := *abi.ConvertType(out[0], new(uint16)).(*uint16)

	return out0, err

}

// TaxAllocPlatformBps is a free data retrieval call binding the contract method 0x5064b68d.
//
// Solidity: function taxAllocPlatformBps() view returns(uint16)
func (_BettingPool *BettingPoolSession) TaxAllocPlatformBps() (uint16, error) {
	return _BettingPool.Contract.TaxAllocPlatformBps(&_BettingPool.CallOpts)
}

// TaxAllocPlatformBps is a free data retrieval call binding the contract method 0x5064b68d.
//
// Solidity: function taxAllocPlatformBps() view returns(uint16)
func (_BettingPool *BettingPoolCallerSession) TaxAllocPlatformBps() (uint16, error) {
	return _BettingPool.Contract.TaxAllocPlatformBps(&_BettingPool.CallOpts)
}

// TaxAllocReferrerBps is a free data retrieval call binding the contract method 0x37a6a861.
//
// Solidity: function taxAllocReferrerBps() view returns(uint16)
func (_BettingPool *BettingPoolCaller) TaxAllocReferrerBps(opts *bind.CallOpts) (uint16, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "taxAllocReferrerBps")

	if err != nil {
		return *new(uint16), err
	}

	out0 := *abi.ConvertType(out[0], new(uint16)).(*uint16)

	return out0, err

}

// TaxAllocReferrerBps is a free data retrieval call binding the contract method 0x37a6a861.
//
// Solidity: function taxAllocReferrerBps() view returns(uint16)
func (_BettingPool *BettingPoolSession) TaxAllocReferrerBps() (uint16, error) {
	return _BettingPool.Contract.TaxAllocReferrerBps(&_BettingPool.CallOpts)
}

// TaxAllocReferrerBps is a free data retrieval call binding the contract method 0x37a6a861.
//
// Solidity: function taxAllocReferrerBps() view returns(uint16)
func (_BettingPool *BettingPoolCallerSession) TaxAllocReferrerBps() (uint16, error) {
	return _BettingPool.Contract.TaxAllocReferrerBps(&_BettingPool.CallOpts)
}

// TaxAllocStakingBps is a free data retrieval call binding the contract method 0xf6398898.
//
// Solidity: function taxAllocStakingBps() view returns(uint16)
func (_BettingPool *BettingPoolCaller) TaxAllocStakingBps(opts *bind.CallOpts) (uint16, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "taxAllocStakingBps")

	if err != nil {
		return *new(uint16), err
	}

	out0 := *abi.ConvertType(out[0], new(uint16)).(*uint16)

	return out0, err

}

// TaxAllocStakingBps is a free data retrieval call binding the contract method 0xf6398898.
//
// Solidity: function taxAllocStakingBps() view returns(uint16)
func (_BettingPool *BettingPoolSession) TaxAllocStakingBps() (uint16, error) {
	return _BettingPool.Contract.TaxAllocStakingBps(&_BettingPool.CallOpts)
}

// TaxAllocStakingBps is a free data retrieval call binding the contract method 0xf6398898.
//
// Solidity: function taxAllocStakingBps() view returns(uint16)
func (_BettingPool *BettingPoolCallerSession) TaxAllocStakingBps() (uint16, error) {
	return _BettingPool.Contract.TaxAllocStakingBps(&_BettingPool.CallOpts)
}

// TaxAllocTaxBufferBps is a free data retrieval call binding the contract method 0x65c3b73b.
//
// Solidity: function taxAllocTaxBufferBps() view returns(uint16)
func (_BettingPool *BettingPoolCaller) TaxAllocTaxBufferBps(opts *bind.CallOpts) (uint16, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "taxAllocTaxBufferBps")

	if err != nil {
		return *new(uint16), err
	}

	out0 := *abi.ConvertType(out[0], new(uint16)).(*uint16)

	return out0, err

}

// TaxAllocTaxBufferBps is a free data retrieval call binding the contract method 0x65c3b73b.
//
// Solidity: function taxAllocTaxBufferBps() view returns(uint16)
func (_BettingPool *BettingPoolSession) TaxAllocTaxBufferBps() (uint16, error) {
	return _BettingPool.Contract.TaxAllocTaxBufferBps(&_BettingPool.CallOpts)
}

// TaxAllocTaxBufferBps is a free data retrieval call binding the contract method 0x65c3b73b.
//
// Solidity: function taxAllocTaxBufferBps() view returns(uint16)
func (_BettingPool *BettingPoolCallerSession) TaxAllocTaxBufferBps() (uint16, error) {
	return _BettingPool.Contract.TaxAllocTaxBufferBps(&_BettingPool.CallOpts)
}

// TaxBuffer is a free data retrieval call binding the contract method 0x108ec2f1.
//
// Solidity: function taxBuffer() view returns(uint256)
func (_BettingPool *BettingPoolCaller) TaxBuffer(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "taxBuffer")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// TaxBuffer is a free data retrieval call binding the contract method 0x108ec2f1.
//
// Solidity: function taxBuffer() view returns(uint256)
func (_BettingPool *BettingPoolSession) TaxBuffer() (*big.Int, error) {
	return _BettingPool.Contract.TaxBuffer(&_BettingPool.CallOpts)
}

// TaxBuffer is a free data retrieval call binding the contract method 0x108ec2f1.
//
// Solidity: function taxBuffer() view returns(uint256)
func (_BettingPool *BettingPoolCallerSession) TaxBuffer() (*big.Int, error) {
	return _BettingPool.Contract.TaxBuffer(&_BettingPool.CallOpts)
}

// WclOrangeThreshold is a free data retrieval call binding the contract method 0xbc1a9d46.
//
// Solidity: function wclOrangeThreshold() view returns(uint256)
func (_BettingPool *BettingPoolCaller) WclOrangeThreshold(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "wclOrangeThreshold")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// WclOrangeThreshold is a free data retrieval call binding the contract method 0xbc1a9d46.
//
// Solidity: function wclOrangeThreshold() view returns(uint256)
func (_BettingPool *BettingPoolSession) WclOrangeThreshold() (*big.Int, error) {
	return _BettingPool.Contract.WclOrangeThreshold(&_BettingPool.CallOpts)
}

// WclOrangeThreshold is a free data retrieval call binding the contract method 0xbc1a9d46.
//
// Solidity: function wclOrangeThreshold() view returns(uint256)
func (_BettingPool *BettingPoolCallerSession) WclOrangeThreshold() (*big.Int, error) {
	return _BettingPool.Contract.WclOrangeThreshold(&_BettingPool.CallOpts)
}

// WclRedThreshold is a free data retrieval call binding the contract method 0xe4b341f2.
//
// Solidity: function wclRedThreshold() view returns(uint256)
func (_BettingPool *BettingPoolCaller) WclRedThreshold(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "wclRedThreshold")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// WclRedThreshold is a free data retrieval call binding the contract method 0xe4b341f2.
//
// Solidity: function wclRedThreshold() view returns(uint256)
func (_BettingPool *BettingPoolSession) WclRedThreshold() (*big.Int, error) {
	return _BettingPool.Contract.WclRedThreshold(&_BettingPool.CallOpts)
}

// WclRedThreshold is a free data retrieval call binding the contract method 0xe4b341f2.
//
// Solidity: function wclRedThreshold() view returns(uint256)
func (_BettingPool *BettingPoolCallerSession) WclRedThreshold() (*big.Int, error) {
	return _BettingPool.Contract.WclRedThreshold(&_BettingPool.CallOpts)
}

// WclYellowThreshold is a free data retrieval call binding the contract method 0x1d3c47dc.
//
// Solidity: function wclYellowThreshold() view returns(uint256)
func (_BettingPool *BettingPoolCaller) WclYellowThreshold(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _BettingPool.contract.Call(opts, &out, "wclYellowThreshold")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// WclYellowThreshold is a free data retrieval call binding the contract method 0x1d3c47dc.
//
// Solidity: function wclYellowThreshold() view returns(uint256)
func (_BettingPool *BettingPoolSession) WclYellowThreshold() (*big.Int, error) {
	return _BettingPool.Contract.WclYellowThreshold(&_BettingPool.CallOpts)
}

// WclYellowThreshold is a free data retrieval call binding the contract method 0x1d3c47dc.
//
// Solidity: function wclYellowThreshold() view returns(uint256)
func (_BettingPool *BettingPoolCallerSession) WclYellowThreshold() (*big.Int, error) {
	return _BettingPool.Contract.WclYellowThreshold(&_BettingPool.CallOpts)
}

// AddPlatformReserve is a paid mutator transaction binding the contract method 0x53873f08.
//
// Solidity: function addPlatformReserve(uint256 amount) returns()
func (_BettingPool *BettingPoolTransactor) AddPlatformReserve(opts *bind.TransactOpts, amount *big.Int) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "addPlatformReserve", amount)
}

// AddPlatformReserve is a paid mutator transaction binding the contract method 0x53873f08.
//
// Solidity: function addPlatformReserve(uint256 amount) returns()
func (_BettingPool *BettingPoolSession) AddPlatformReserve(amount *big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.AddPlatformReserve(&_BettingPool.TransactOpts, amount)
}

// AddPlatformReserve is a paid mutator transaction binding the contract method 0x53873f08.
//
// Solidity: function addPlatformReserve(uint256 amount) returns()
func (_BettingPool *BettingPoolTransactorSession) AddPlatformReserve(amount *big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.AddPlatformReserve(&_BettingPool.TransactOpts, amount)
}

// BindReferrer is a paid mutator transaction binding the contract method 0x04f618cb.
//
// Solidity: function bindReferrer(address referrer) returns()
func (_BettingPool *BettingPoolTransactor) BindReferrer(opts *bind.TransactOpts, referrer common.Address) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "bindReferrer", referrer)
}

// BindReferrer is a paid mutator transaction binding the contract method 0x04f618cb.
//
// Solidity: function bindReferrer(address referrer) returns()
func (_BettingPool *BettingPoolSession) BindReferrer(referrer common.Address) (*types.Transaction, error) {
	return _BettingPool.Contract.BindReferrer(&_BettingPool.TransactOpts, referrer)
}

// BindReferrer is a paid mutator transaction binding the contract method 0x04f618cb.
//
// Solidity: function bindReferrer(address referrer) returns()
func (_BettingPool *BettingPoolTransactorSession) BindReferrer(referrer common.Address) (*types.Transaction, error) {
	return _BettingPool.Contract.BindReferrer(&_BettingPool.TransactOpts, referrer)
}

// CashOut is a paid mutator transaction binding the contract method 0xfae436c3.
//
// Solidity: function cashOut(bytes32 betId, uint256 expectedQuoteVersion, uint64 quotedAt, uint256 minAmountOut, uint256 deadline) returns()
func (_BettingPool *BettingPoolTransactor) CashOut(opts *bind.TransactOpts, betId [32]byte, expectedQuoteVersion *big.Int, quotedAt uint64, minAmountOut *big.Int, deadline *big.Int) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "cashOut", betId, expectedQuoteVersion, quotedAt, minAmountOut, deadline)
}

// CashOut is a paid mutator transaction binding the contract method 0xfae436c3.
//
// Solidity: function cashOut(bytes32 betId, uint256 expectedQuoteVersion, uint64 quotedAt, uint256 minAmountOut, uint256 deadline) returns()
func (_BettingPool *BettingPoolSession) CashOut(betId [32]byte, expectedQuoteVersion *big.Int, quotedAt uint64, minAmountOut *big.Int, deadline *big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.CashOut(&_BettingPool.TransactOpts, betId, expectedQuoteVersion, quotedAt, minAmountOut, deadline)
}

// CashOut is a paid mutator transaction binding the contract method 0xfae436c3.
//
// Solidity: function cashOut(bytes32 betId, uint256 expectedQuoteVersion, uint64 quotedAt, uint256 minAmountOut, uint256 deadline) returns()
func (_BettingPool *BettingPoolTransactorSession) CashOut(betId [32]byte, expectedQuoteVersion *big.Int, quotedAt uint64, minAmountOut *big.Int, deadline *big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.CashOut(&_BettingPool.TransactOpts, betId, expectedQuoteVersion, quotedAt, minAmountOut, deadline)
}

// ClaimPayout is a paid mutator transaction binding the contract method 0xb4c63471.
//
// Solidity: function claimPayout(bytes32 betId) returns()
func (_BettingPool *BettingPoolTransactor) ClaimPayout(opts *bind.TransactOpts, betId [32]byte) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "claimPayout", betId)
}

// ClaimPayout is a paid mutator transaction binding the contract method 0xb4c63471.
//
// Solidity: function claimPayout(bytes32 betId) returns()
func (_BettingPool *BettingPoolSession) ClaimPayout(betId [32]byte) (*types.Transaction, error) {
	return _BettingPool.Contract.ClaimPayout(&_BettingPool.TransactOpts, betId)
}

// ClaimPayout is a paid mutator transaction binding the contract method 0xb4c63471.
//
// Solidity: function claimPayout(bytes32 betId) returns()
func (_BettingPool *BettingPoolTransactorSession) ClaimPayout(betId [32]byte) (*types.Transaction, error) {
	return _BettingPool.Contract.ClaimPayout(&_BettingPool.TransactOpts, betId)
}

// ClaimReferralRewards is a paid mutator transaction binding the contract method 0x3b545746.
//
// Solidity: function claimReferralRewards(uint256 oddAmount) returns(uint256 claimedAmount)
func (_BettingPool *BettingPoolTransactor) ClaimReferralRewards(opts *bind.TransactOpts, oddAmount *big.Int) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "claimReferralRewards", oddAmount)
}

// ClaimReferralRewards is a paid mutator transaction binding the contract method 0x3b545746.
//
// Solidity: function claimReferralRewards(uint256 oddAmount) returns(uint256 claimedAmount)
func (_BettingPool *BettingPoolSession) ClaimReferralRewards(oddAmount *big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.ClaimReferralRewards(&_BettingPool.TransactOpts, oddAmount)
}

// ClaimReferralRewards is a paid mutator transaction binding the contract method 0x3b545746.
//
// Solidity: function claimReferralRewards(uint256 oddAmount) returns(uint256 claimedAmount)
func (_BettingPool *BettingPoolTransactorSession) ClaimReferralRewards(oddAmount *big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.ClaimReferralRewards(&_BettingPool.TransactOpts, oddAmount)
}

// ClaimUSDTReferralRewards is a paid mutator transaction binding the contract method 0xce140774.
//
// Solidity: function claimUSDTReferralRewards(uint256 rewardMinUsdtOutAmount, uint256 signatureDeadline, bytes signature, uint256 minUsdtOut) returns(uint256 amountOut)
func (_BettingPool *BettingPoolTransactor) ClaimUSDTReferralRewards(opts *bind.TransactOpts, rewardMinUsdtOutAmount *big.Int, signatureDeadline *big.Int, signature []byte, minUsdtOut *big.Int) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "claimUSDTReferralRewards", rewardMinUsdtOutAmount, signatureDeadline, signature, minUsdtOut)
}

// ClaimUSDTReferralRewards is a paid mutator transaction binding the contract method 0xce140774.
//
// Solidity: function claimUSDTReferralRewards(uint256 rewardMinUsdtOutAmount, uint256 signatureDeadline, bytes signature, uint256 minUsdtOut) returns(uint256 amountOut)
func (_BettingPool *BettingPoolSession) ClaimUSDTReferralRewards(rewardMinUsdtOutAmount *big.Int, signatureDeadline *big.Int, signature []byte, minUsdtOut *big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.ClaimUSDTReferralRewards(&_BettingPool.TransactOpts, rewardMinUsdtOutAmount, signatureDeadline, signature, minUsdtOut)
}

// ClaimUSDTReferralRewards is a paid mutator transaction binding the contract method 0xce140774.
//
// Solidity: function claimUSDTReferralRewards(uint256 rewardMinUsdtOutAmount, uint256 signatureDeadline, bytes signature, uint256 minUsdtOut) returns(uint256 amountOut)
func (_BettingPool *BettingPoolTransactorSession) ClaimUSDTReferralRewards(rewardMinUsdtOutAmount *big.Int, signatureDeadline *big.Int, signature []byte, minUsdtOut *big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.ClaimUSDTReferralRewards(&_BettingPool.TransactOpts, rewardMinUsdtOutAmount, signatureDeadline, signature, minUsdtOut)
}

// FinalizeMarketSettlement is a paid mutator transaction binding the contract method 0x410785f0.
//
// Solidity: function finalizeMarketSettlement(bytes32 marketId, uint8 resultKindRaw) returns()
func (_BettingPool *BettingPoolTransactor) FinalizeMarketSettlement(opts *bind.TransactOpts, marketId [32]byte, resultKindRaw uint8) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "finalizeMarketSettlement", marketId, resultKindRaw)
}

// FinalizeMarketSettlement is a paid mutator transaction binding the contract method 0x410785f0.
//
// Solidity: function finalizeMarketSettlement(bytes32 marketId, uint8 resultKindRaw) returns()
func (_BettingPool *BettingPoolSession) FinalizeMarketSettlement(marketId [32]byte, resultKindRaw uint8) (*types.Transaction, error) {
	return _BettingPool.Contract.FinalizeMarketSettlement(&_BettingPool.TransactOpts, marketId, resultKindRaw)
}

// FinalizeMarketSettlement is a paid mutator transaction binding the contract method 0x410785f0.
//
// Solidity: function finalizeMarketSettlement(bytes32 marketId, uint8 resultKindRaw) returns()
func (_BettingPool *BettingPoolTransactorSession) FinalizeMarketSettlement(marketId [32]byte, resultKindRaw uint8) (*types.Transaction, error) {
	return _BettingPool.Contract.FinalizeMarketSettlement(&_BettingPool.TransactOpts, marketId, resultKindRaw)
}

// GrantRole is a paid mutator transaction binding the contract method 0x2f2ff15d.
//
// Solidity: function grantRole(bytes32 role, address account) returns()
func (_BettingPool *BettingPoolTransactor) GrantRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "grantRole", role, account)
}

// GrantRole is a paid mutator transaction binding the contract method 0x2f2ff15d.
//
// Solidity: function grantRole(bytes32 role, address account) returns()
func (_BettingPool *BettingPoolSession) GrantRole(role [32]byte, account common.Address) (*types.Transaction, error) {
	return _BettingPool.Contract.GrantRole(&_BettingPool.TransactOpts, role, account)
}

// GrantRole is a paid mutator transaction binding the contract method 0x2f2ff15d.
//
// Solidity: function grantRole(bytes32 role, address account) returns()
func (_BettingPool *BettingPoolTransactorSession) GrantRole(role [32]byte, account common.Address) (*types.Transaction, error) {
	return _BettingPool.Contract.GrantRole(&_BettingPool.TransactOpts, role, account)
}

// Initialize is a paid mutator transaction binding the contract method 0xf8c8765e.
//
// Solidity: function initialize(address admin, address oddTokenAddress, address stakingPoolAddress, address liquidityPoolAddress) returns()
func (_BettingPool *BettingPoolTransactor) Initialize(opts *bind.TransactOpts, admin common.Address, oddTokenAddress common.Address, stakingPoolAddress common.Address, liquidityPoolAddress common.Address) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "initialize", admin, oddTokenAddress, stakingPoolAddress, liquidityPoolAddress)
}

// Initialize is a paid mutator transaction binding the contract method 0xf8c8765e.
//
// Solidity: function initialize(address admin, address oddTokenAddress, address stakingPoolAddress, address liquidityPoolAddress) returns()
func (_BettingPool *BettingPoolSession) Initialize(admin common.Address, oddTokenAddress common.Address, stakingPoolAddress common.Address, liquidityPoolAddress common.Address) (*types.Transaction, error) {
	return _BettingPool.Contract.Initialize(&_BettingPool.TransactOpts, admin, oddTokenAddress, stakingPoolAddress, liquidityPoolAddress)
}

// Initialize is a paid mutator transaction binding the contract method 0xf8c8765e.
//
// Solidity: function initialize(address admin, address oddTokenAddress, address stakingPoolAddress, address liquidityPoolAddress) returns()
func (_BettingPool *BettingPoolTransactorSession) Initialize(admin common.Address, oddTokenAddress common.Address, stakingPoolAddress common.Address, liquidityPoolAddress common.Address) (*types.Transaction, error) {
	return _BettingPool.Contract.Initialize(&_BettingPool.TransactOpts, admin, oddTokenAddress, stakingPoolAddress, liquidityPoolAddress)
}

// InitializeV2 is a paid mutator transaction binding the contract method 0x29b6eca9.
//
// Solidity: function initializeV2(address treasuryAddress) returns()
func (_BettingPool *BettingPoolTransactor) InitializeV2(opts *bind.TransactOpts, treasuryAddress common.Address) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "initializeV2", treasuryAddress)
}

// InitializeV2 is a paid mutator transaction binding the contract method 0x29b6eca9.
//
// Solidity: function initializeV2(address treasuryAddress) returns()
func (_BettingPool *BettingPoolSession) InitializeV2(treasuryAddress common.Address) (*types.Transaction, error) {
	return _BettingPool.Contract.InitializeV2(&_BettingPool.TransactOpts, treasuryAddress)
}

// InitializeV2 is a paid mutator transaction binding the contract method 0x29b6eca9.
//
// Solidity: function initializeV2(address treasuryAddress) returns()
func (_BettingPool *BettingPoolTransactorSession) InitializeV2(treasuryAddress common.Address) (*types.Transaction, error) {
	return _BettingPool.Contract.InitializeV2(&_BettingPool.TransactOpts, treasuryAddress)
}

// LockMarket is a paid mutator transaction binding the contract method 0x683bc03b.
//
// Solidity: function lockMarket(bytes32 marketId) returns()
func (_BettingPool *BettingPoolTransactor) LockMarket(opts *bind.TransactOpts, marketId [32]byte) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "lockMarket", marketId)
}

// LockMarket is a paid mutator transaction binding the contract method 0x683bc03b.
//
// Solidity: function lockMarket(bytes32 marketId) returns()
func (_BettingPool *BettingPoolSession) LockMarket(marketId [32]byte) (*types.Transaction, error) {
	return _BettingPool.Contract.LockMarket(&_BettingPool.TransactOpts, marketId)
}

// LockMarket is a paid mutator transaction binding the contract method 0x683bc03b.
//
// Solidity: function lockMarket(bytes32 marketId) returns()
func (_BettingPool *BettingPoolTransactorSession) LockMarket(marketId [32]byte) (*types.Transaction, error) {
	return _BettingPool.Contract.LockMarket(&_BettingPool.TransactOpts, marketId)
}

// OpenMarket is a paid mutator transaction binding the contract method 0x6ade7406.
//
// Solidity: function openMarket(bytes32 matchId, uint8 marketType, uint8 line, uint64 matchStartTime, uint64 matchEndTime, uint256[] baseOdds, uint64 updatedAt) returns(bytes32 marketId)
func (_BettingPool *BettingPoolTransactor) OpenMarket(opts *bind.TransactOpts, matchId [32]byte, marketType uint8, line uint8, matchStartTime uint64, matchEndTime uint64, baseOdds []*big.Int, updatedAt uint64) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "openMarket", matchId, marketType, line, matchStartTime, matchEndTime, baseOdds, updatedAt)
}

// OpenMarket is a paid mutator transaction binding the contract method 0x6ade7406.
//
// Solidity: function openMarket(bytes32 matchId, uint8 marketType, uint8 line, uint64 matchStartTime, uint64 matchEndTime, uint256[] baseOdds, uint64 updatedAt) returns(bytes32 marketId)
func (_BettingPool *BettingPoolSession) OpenMarket(matchId [32]byte, marketType uint8, line uint8, matchStartTime uint64, matchEndTime uint64, baseOdds []*big.Int, updatedAt uint64) (*types.Transaction, error) {
	return _BettingPool.Contract.OpenMarket(&_BettingPool.TransactOpts, matchId, marketType, line, matchStartTime, matchEndTime, baseOdds, updatedAt)
}

// OpenMarket is a paid mutator transaction binding the contract method 0x6ade7406.
//
// Solidity: function openMarket(bytes32 matchId, uint8 marketType, uint8 line, uint64 matchStartTime, uint64 matchEndTime, uint256[] baseOdds, uint64 updatedAt) returns(bytes32 marketId)
func (_BettingPool *BettingPoolTransactorSession) OpenMarket(matchId [32]byte, marketType uint8, line uint8, matchStartTime uint64, matchEndTime uint64, baseOdds []*big.Int, updatedAt uint64) (*types.Transaction, error) {
	return _BettingPool.Contract.OpenMarket(&_BettingPool.TransactOpts, matchId, marketType, line, matchStartTime, matchEndTime, baseOdds, updatedAt)
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

// PlaceBet is a paid mutator transaction binding the contract method 0x1128e379.
//
// Solidity: function placeBet(bytes32 marketId, uint8 outcome, uint256 requestedAmount, (uint256,uint64,uint256,uint256,uint256) guard) returns(bytes32 betId, uint256 acceptedAmount, uint256 lockedOdds)
func (_BettingPool *BettingPoolTransactor) PlaceBet(opts *bind.TransactOpts, marketId [32]byte, outcome uint8, requestedAmount *big.Int, guard QuoteGuardInput) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "placeBet", marketId, outcome, requestedAmount, guard)
}

// PlaceBet is a paid mutator transaction binding the contract method 0x1128e379.
//
// Solidity: function placeBet(bytes32 marketId, uint8 outcome, uint256 requestedAmount, (uint256,uint64,uint256,uint256,uint256) guard) returns(bytes32 betId, uint256 acceptedAmount, uint256 lockedOdds)
func (_BettingPool *BettingPoolSession) PlaceBet(marketId [32]byte, outcome uint8, requestedAmount *big.Int, guard QuoteGuardInput) (*types.Transaction, error) {
	return _BettingPool.Contract.PlaceBet(&_BettingPool.TransactOpts, marketId, outcome, requestedAmount, guard)
}

// PlaceBet is a paid mutator transaction binding the contract method 0x1128e379.
//
// Solidity: function placeBet(bytes32 marketId, uint8 outcome, uint256 requestedAmount, (uint256,uint64,uint256,uint256,uint256) guard) returns(bytes32 betId, uint256 acceptedAmount, uint256 lockedOdds)
func (_BettingPool *BettingPoolTransactorSession) PlaceBet(marketId [32]byte, outcome uint8, requestedAmount *big.Int, guard QuoteGuardInput) (*types.Transaction, error) {
	return _BettingPool.Contract.PlaceBet(&_BettingPool.TransactOpts, marketId, outcome, requestedAmount, guard)
}

// PlaceBet0 is a paid mutator transaction binding the contract method 0xb5ce4121.
//
// Solidity: function placeBet(bytes32 marketId, uint8 outcome, uint256 requestedAmount, (uint256,uint64,uint256,uint256,uint256) guard, address referrer) returns(bytes32 betId, uint256 acceptedAmount, uint256 lockedOdds)
func (_BettingPool *BettingPoolTransactor) PlaceBet0(opts *bind.TransactOpts, marketId [32]byte, outcome uint8, requestedAmount *big.Int, guard QuoteGuardInput, referrer common.Address) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "placeBet0", marketId, outcome, requestedAmount, guard, referrer)
}

// PlaceBet0 is a paid mutator transaction binding the contract method 0xb5ce4121.
//
// Solidity: function placeBet(bytes32 marketId, uint8 outcome, uint256 requestedAmount, (uint256,uint64,uint256,uint256,uint256) guard, address referrer) returns(bytes32 betId, uint256 acceptedAmount, uint256 lockedOdds)
func (_BettingPool *BettingPoolSession) PlaceBet0(marketId [32]byte, outcome uint8, requestedAmount *big.Int, guard QuoteGuardInput, referrer common.Address) (*types.Transaction, error) {
	return _BettingPool.Contract.PlaceBet0(&_BettingPool.TransactOpts, marketId, outcome, requestedAmount, guard, referrer)
}

// PlaceBet0 is a paid mutator transaction binding the contract method 0xb5ce4121.
//
// Solidity: function placeBet(bytes32 marketId, uint8 outcome, uint256 requestedAmount, (uint256,uint64,uint256,uint256,uint256) guard, address referrer) returns(bytes32 betId, uint256 acceptedAmount, uint256 lockedOdds)
func (_BettingPool *BettingPoolTransactorSession) PlaceBet0(marketId [32]byte, outcome uint8, requestedAmount *big.Int, guard QuoteGuardInput, referrer common.Address) (*types.Transaction, error) {
	return _BettingPool.Contract.PlaceBet0(&_BettingPool.TransactOpts, marketId, outcome, requestedAmount, guard, referrer)
}

// RefundBets is a paid mutator transaction binding the contract method 0x146cf864.
//
// Solidity: function refundBets(bytes32 marketId, bytes32[] betIds, uint256[] refundAmounts) returns()
func (_BettingPool *BettingPoolTransactor) RefundBets(opts *bind.TransactOpts, marketId [32]byte, betIds [][32]byte, refundAmounts []*big.Int) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "refundBets", marketId, betIds, refundAmounts)
}

// RefundBets is a paid mutator transaction binding the contract method 0x146cf864.
//
// Solidity: function refundBets(bytes32 marketId, bytes32[] betIds, uint256[] refundAmounts) returns()
func (_BettingPool *BettingPoolSession) RefundBets(marketId [32]byte, betIds [][32]byte, refundAmounts []*big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.RefundBets(&_BettingPool.TransactOpts, marketId, betIds, refundAmounts)
}

// RefundBets is a paid mutator transaction binding the contract method 0x146cf864.
//
// Solidity: function refundBets(bytes32 marketId, bytes32[] betIds, uint256[] refundAmounts) returns()
func (_BettingPool *BettingPoolTransactorSession) RefundBets(marketId [32]byte, betIds [][32]byte, refundAmounts []*big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.RefundBets(&_BettingPool.TransactOpts, marketId, betIds, refundAmounts)
}

// RenounceRole is a paid mutator transaction binding the contract method 0x36568abe.
//
// Solidity: function renounceRole(bytes32 role, address callerConfirmation) returns()
func (_BettingPool *BettingPoolTransactor) RenounceRole(opts *bind.TransactOpts, role [32]byte, callerConfirmation common.Address) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "renounceRole", role, callerConfirmation)
}

// RenounceRole is a paid mutator transaction binding the contract method 0x36568abe.
//
// Solidity: function renounceRole(bytes32 role, address callerConfirmation) returns()
func (_BettingPool *BettingPoolSession) RenounceRole(role [32]byte, callerConfirmation common.Address) (*types.Transaction, error) {
	return _BettingPool.Contract.RenounceRole(&_BettingPool.TransactOpts, role, callerConfirmation)
}

// RenounceRole is a paid mutator transaction binding the contract method 0x36568abe.
//
// Solidity: function renounceRole(bytes32 role, address callerConfirmation) returns()
func (_BettingPool *BettingPoolTransactorSession) RenounceRole(role [32]byte, callerConfirmation common.Address) (*types.Transaction, error) {
	return _BettingPool.Contract.RenounceRole(&_BettingPool.TransactOpts, role, callerConfirmation)
}

// RevokeRole is a paid mutator transaction binding the contract method 0xd547741f.
//
// Solidity: function revokeRole(bytes32 role, address account) returns()
func (_BettingPool *BettingPoolTransactor) RevokeRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "revokeRole", role, account)
}

// RevokeRole is a paid mutator transaction binding the contract method 0xd547741f.
//
// Solidity: function revokeRole(bytes32 role, address account) returns()
func (_BettingPool *BettingPoolSession) RevokeRole(role [32]byte, account common.Address) (*types.Transaction, error) {
	return _BettingPool.Contract.RevokeRole(&_BettingPool.TransactOpts, role, account)
}

// RevokeRole is a paid mutator transaction binding the contract method 0xd547741f.
//
// Solidity: function revokeRole(bytes32 role, address account) returns()
func (_BettingPool *BettingPoolTransactorSession) RevokeRole(role [32]byte, account common.Address) (*types.Transaction, error) {
	return _BettingPool.Contract.RevokeRole(&_BettingPool.TransactOpts, role, account)
}

// SetBettingDependencies is a paid mutator transaction binding the contract method 0x693d97e2.
//
// Solidity: function setBettingDependencies(address stakingPoolAddress, address liquidityPoolAddress, address oddTokenAddress) returns()
func (_BettingPool *BettingPoolTransactor) SetBettingDependencies(opts *bind.TransactOpts, stakingPoolAddress common.Address, liquidityPoolAddress common.Address, oddTokenAddress common.Address) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "setBettingDependencies", stakingPoolAddress, liquidityPoolAddress, oddTokenAddress)
}

// SetBettingDependencies is a paid mutator transaction binding the contract method 0x693d97e2.
//
// Solidity: function setBettingDependencies(address stakingPoolAddress, address liquidityPoolAddress, address oddTokenAddress) returns()
func (_BettingPool *BettingPoolSession) SetBettingDependencies(stakingPoolAddress common.Address, liquidityPoolAddress common.Address, oddTokenAddress common.Address) (*types.Transaction, error) {
	return _BettingPool.Contract.SetBettingDependencies(&_BettingPool.TransactOpts, stakingPoolAddress, liquidityPoolAddress, oddTokenAddress)
}

// SetBettingDependencies is a paid mutator transaction binding the contract method 0x693d97e2.
//
// Solidity: function setBettingDependencies(address stakingPoolAddress, address liquidityPoolAddress, address oddTokenAddress) returns()
func (_BettingPool *BettingPoolTransactorSession) SetBettingDependencies(stakingPoolAddress common.Address, liquidityPoolAddress common.Address, oddTokenAddress common.Address) (*types.Transaction, error) {
	return _BettingPool.Contract.SetBettingDependencies(&_BettingPool.TransactOpts, stakingPoolAddress, liquidityPoolAddress, oddTokenAddress)
}

// SetMarginSplit is a paid mutator transaction binding the contract method 0xc63fd198.
//
// Solidity: function setMarginSplit(uint16 newLpMarginShareBps) returns()
func (_BettingPool *BettingPoolTransactor) SetMarginSplit(opts *bind.TransactOpts, newLpMarginShareBps uint16) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "setMarginSplit", newLpMarginShareBps)
}

// SetMarginSplit is a paid mutator transaction binding the contract method 0xc63fd198.
//
// Solidity: function setMarginSplit(uint16 newLpMarginShareBps) returns()
func (_BettingPool *BettingPoolSession) SetMarginSplit(newLpMarginShareBps uint16) (*types.Transaction, error) {
	return _BettingPool.Contract.SetMarginSplit(&_BettingPool.TransactOpts, newLpMarginShareBps)
}

// SetMarginSplit is a paid mutator transaction binding the contract method 0xc63fd198.
//
// Solidity: function setMarginSplit(uint16 newLpMarginShareBps) returns()
func (_BettingPool *BettingPoolTransactorSession) SetMarginSplit(newLpMarginShareBps uint16) (*types.Transaction, error) {
	return _BettingPool.Contract.SetMarginSplit(&_BettingPool.TransactOpts, newLpMarginShareBps)
}

// SetPlatformTreasury is a paid mutator transaction binding the contract method 0x7cd86d60.
//
// Solidity: function setPlatformTreasury(address treasuryAddress) returns()
func (_BettingPool *BettingPoolTransactor) SetPlatformTreasury(opts *bind.TransactOpts, treasuryAddress common.Address) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "setPlatformTreasury", treasuryAddress)
}

// SetPlatformTreasury is a paid mutator transaction binding the contract method 0x7cd86d60.
//
// Solidity: function setPlatformTreasury(address treasuryAddress) returns()
func (_BettingPool *BettingPoolSession) SetPlatformTreasury(treasuryAddress common.Address) (*types.Transaction, error) {
	return _BettingPool.Contract.SetPlatformTreasury(&_BettingPool.TransactOpts, treasuryAddress)
}

// SetPlatformTreasury is a paid mutator transaction binding the contract method 0x7cd86d60.
//
// Solidity: function setPlatformTreasury(address treasuryAddress) returns()
func (_BettingPool *BettingPoolTransactorSession) SetPlatformTreasury(treasuryAddress common.Address) (*types.Transaction, error) {
	return _BettingPool.Contract.SetPlatformTreasury(&_BettingPool.TransactOpts, treasuryAddress)
}

// SetReferralClaimConfig is a paid mutator transaction binding the contract method 0xd8e898dc.
//
// Solidity: function setReferralClaimConfig(address signer, uint24 poolFee) returns()
func (_BettingPool *BettingPoolTransactor) SetReferralClaimConfig(opts *bind.TransactOpts, signer common.Address, poolFee *big.Int) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "setReferralClaimConfig", signer, poolFee)
}

// SetReferralClaimConfig is a paid mutator transaction binding the contract method 0xd8e898dc.
//
// Solidity: function setReferralClaimConfig(address signer, uint24 poolFee) returns()
func (_BettingPool *BettingPoolSession) SetReferralClaimConfig(signer common.Address, poolFee *big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.SetReferralClaimConfig(&_BettingPool.TransactOpts, signer, poolFee)
}

// SetReferralClaimConfig is a paid mutator transaction binding the contract method 0xd8e898dc.
//
// Solidity: function setReferralClaimConfig(address signer, uint24 poolFee) returns()
func (_BettingPool *BettingPoolTransactorSession) SetReferralClaimConfig(signer common.Address, poolFee *big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.SetReferralClaimConfig(&_BettingPool.TransactOpts, signer, poolFee)
}

// SetReferralSwapConfig is a paid mutator transaction binding the contract method 0xe632bea8.
//
// Solidity: function setReferralSwapConfig(address swapRouter, address usdtToken) returns()
func (_BettingPool *BettingPoolTransactor) SetReferralSwapConfig(opts *bind.TransactOpts, swapRouter common.Address, usdtToken common.Address) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "setReferralSwapConfig", swapRouter, usdtToken)
}

// SetReferralSwapConfig is a paid mutator transaction binding the contract method 0xe632bea8.
//
// Solidity: function setReferralSwapConfig(address swapRouter, address usdtToken) returns()
func (_BettingPool *BettingPoolSession) SetReferralSwapConfig(swapRouter common.Address, usdtToken common.Address) (*types.Transaction, error) {
	return _BettingPool.Contract.SetReferralSwapConfig(&_BettingPool.TransactOpts, swapRouter, usdtToken)
}

// SetReferralSwapConfig is a paid mutator transaction binding the contract method 0xe632bea8.
//
// Solidity: function setReferralSwapConfig(address swapRouter, address usdtToken) returns()
func (_BettingPool *BettingPoolTransactorSession) SetReferralSwapConfig(swapRouter common.Address, usdtToken common.Address) (*types.Transaction, error) {
	return _BettingPool.Contract.SetReferralSwapConfig(&_BettingPool.TransactOpts, swapRouter, usdtToken)
}

// SetRiskConfig is a paid mutator transaction binding the contract method 0xdc06bb7e.
//
// Solidity: function setRiskConfig(uint256 yellowThreshold, uint256 orangeThreshold, uint256 redThreshold) returns()
func (_BettingPool *BettingPoolTransactor) SetRiskConfig(opts *bind.TransactOpts, yellowThreshold *big.Int, orangeThreshold *big.Int, redThreshold *big.Int) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "setRiskConfig", yellowThreshold, orangeThreshold, redThreshold)
}

// SetRiskConfig is a paid mutator transaction binding the contract method 0xdc06bb7e.
//
// Solidity: function setRiskConfig(uint256 yellowThreshold, uint256 orangeThreshold, uint256 redThreshold) returns()
func (_BettingPool *BettingPoolSession) SetRiskConfig(yellowThreshold *big.Int, orangeThreshold *big.Int, redThreshold *big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.SetRiskConfig(&_BettingPool.TransactOpts, yellowThreshold, orangeThreshold, redThreshold)
}

// SetRiskConfig is a paid mutator transaction binding the contract method 0xdc06bb7e.
//
// Solidity: function setRiskConfig(uint256 yellowThreshold, uint256 orangeThreshold, uint256 redThreshold) returns()
func (_BettingPool *BettingPoolTransactorSession) SetRiskConfig(yellowThreshold *big.Int, orangeThreshold *big.Int, redThreshold *big.Int) (*types.Transaction, error) {
	return _BettingPool.Contract.SetRiskConfig(&_BettingPool.TransactOpts, yellowThreshold, orangeThreshold, redThreshold)
}

// SetSettlementModule is a paid mutator transaction binding the contract method 0x4b00eef5.
//
// Solidity: function setSettlementModule(address newSettlementModule) returns()
func (_BettingPool *BettingPoolTransactor) SetSettlementModule(opts *bind.TransactOpts, newSettlementModule common.Address) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "setSettlementModule", newSettlementModule)
}

// SetSettlementModule is a paid mutator transaction binding the contract method 0x4b00eef5.
//
// Solidity: function setSettlementModule(address newSettlementModule) returns()
func (_BettingPool *BettingPoolSession) SetSettlementModule(newSettlementModule common.Address) (*types.Transaction, error) {
	return _BettingPool.Contract.SetSettlementModule(&_BettingPool.TransactOpts, newSettlementModule)
}

// SetSettlementModule is a paid mutator transaction binding the contract method 0x4b00eef5.
//
// Solidity: function setSettlementModule(address newSettlementModule) returns()
func (_BettingPool *BettingPoolTransactorSession) SetSettlementModule(newSettlementModule common.Address) (*types.Transaction, error) {
	return _BettingPool.Contract.SetSettlementModule(&_BettingPool.TransactOpts, newSettlementModule)
}

// SetTaxConfig is a paid mutator transaction binding the contract method 0x37d58d85.
//
// Solidity: function setTaxConfig(uint16 newBetTaxBps, uint16 newPayoutTaxBps, uint16 newAllocStakingBps, uint16 newAllocTaxBufferBps, uint16 newAllocPlatformBps, uint16 newAllocReferrerBps) returns()
func (_BettingPool *BettingPoolTransactor) SetTaxConfig(opts *bind.TransactOpts, newBetTaxBps uint16, newPayoutTaxBps uint16, newAllocStakingBps uint16, newAllocTaxBufferBps uint16, newAllocPlatformBps uint16, newAllocReferrerBps uint16) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "setTaxConfig", newBetTaxBps, newPayoutTaxBps, newAllocStakingBps, newAllocTaxBufferBps, newAllocPlatformBps, newAllocReferrerBps)
}

// SetTaxConfig is a paid mutator transaction binding the contract method 0x37d58d85.
//
// Solidity: function setTaxConfig(uint16 newBetTaxBps, uint16 newPayoutTaxBps, uint16 newAllocStakingBps, uint16 newAllocTaxBufferBps, uint16 newAllocPlatformBps, uint16 newAllocReferrerBps) returns()
func (_BettingPool *BettingPoolSession) SetTaxConfig(newBetTaxBps uint16, newPayoutTaxBps uint16, newAllocStakingBps uint16, newAllocTaxBufferBps uint16, newAllocPlatformBps uint16, newAllocReferrerBps uint16) (*types.Transaction, error) {
	return _BettingPool.Contract.SetTaxConfig(&_BettingPool.TransactOpts, newBetTaxBps, newPayoutTaxBps, newAllocStakingBps, newAllocTaxBufferBps, newAllocPlatformBps, newAllocReferrerBps)
}

// SetTaxConfig is a paid mutator transaction binding the contract method 0x37d58d85.
//
// Solidity: function setTaxConfig(uint16 newBetTaxBps, uint16 newPayoutTaxBps, uint16 newAllocStakingBps, uint16 newAllocTaxBufferBps, uint16 newAllocPlatformBps, uint16 newAllocReferrerBps) returns()
func (_BettingPool *BettingPoolTransactorSession) SetTaxConfig(newBetTaxBps uint16, newPayoutTaxBps uint16, newAllocStakingBps uint16, newAllocTaxBufferBps uint16, newAllocPlatformBps uint16, newAllocReferrerBps uint16) (*types.Transaction, error) {
	return _BettingPool.Contract.SetTaxConfig(&_BettingPool.TransactOpts, newBetTaxBps, newPayoutTaxBps, newAllocStakingBps, newAllocTaxBufferBps, newAllocPlatformBps, newAllocReferrerBps)
}

// SettleMarketBetsByScore is a paid mutator transaction binding the contract method 0x79c48b71.
//
// Solidity: function settleMarketBetsByScore(bytes32 marketId, uint16 homeScore, uint16 awayScore, bytes32[] betIds) returns()
func (_BettingPool *BettingPoolTransactor) SettleMarketBetsByScore(opts *bind.TransactOpts, marketId [32]byte, homeScore uint16, awayScore uint16, betIds [][32]byte) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "settleMarketBetsByScore", marketId, homeScore, awayScore, betIds)
}

// SettleMarketBetsByScore is a paid mutator transaction binding the contract method 0x79c48b71.
//
// Solidity: function settleMarketBetsByScore(bytes32 marketId, uint16 homeScore, uint16 awayScore, bytes32[] betIds) returns()
func (_BettingPool *BettingPoolSession) SettleMarketBetsByScore(marketId [32]byte, homeScore uint16, awayScore uint16, betIds [][32]byte) (*types.Transaction, error) {
	return _BettingPool.Contract.SettleMarketBetsByScore(&_BettingPool.TransactOpts, marketId, homeScore, awayScore, betIds)
}

// SettleMarketBetsByScore is a paid mutator transaction binding the contract method 0x79c48b71.
//
// Solidity: function settleMarketBetsByScore(bytes32 marketId, uint16 homeScore, uint16 awayScore, bytes32[] betIds) returns()
func (_BettingPool *BettingPoolTransactorSession) SettleMarketBetsByScore(marketId [32]byte, homeScore uint16, awayScore uint16, betIds [][32]byte) (*types.Transaction, error) {
	return _BettingPool.Contract.SettleMarketBetsByScore(&_BettingPool.TransactOpts, marketId, homeScore, awayScore, betIds)
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

// UpdateOdds is a paid mutator transaction binding the contract method 0xf2c3d1f3.
//
// Solidity: function updateOdds(bytes32 marketId, uint256[] baseOdds, uint64 updatedAt) returns()
func (_BettingPool *BettingPoolTransactor) UpdateOdds(opts *bind.TransactOpts, marketId [32]byte, baseOdds []*big.Int, updatedAt uint64) (*types.Transaction, error) {
	return _BettingPool.contract.Transact(opts, "updateOdds", marketId, baseOdds, updatedAt)
}

// UpdateOdds is a paid mutator transaction binding the contract method 0xf2c3d1f3.
//
// Solidity: function updateOdds(bytes32 marketId, uint256[] baseOdds, uint64 updatedAt) returns()
func (_BettingPool *BettingPoolSession) UpdateOdds(marketId [32]byte, baseOdds []*big.Int, updatedAt uint64) (*types.Transaction, error) {
	return _BettingPool.Contract.UpdateOdds(&_BettingPool.TransactOpts, marketId, baseOdds, updatedAt)
}

// UpdateOdds is a paid mutator transaction binding the contract method 0xf2c3d1f3.
//
// Solidity: function updateOdds(bytes32 marketId, uint256[] baseOdds, uint64 updatedAt) returns()
func (_BettingPool *BettingPoolTransactorSession) UpdateOdds(marketId [32]byte, baseOdds []*big.Int, updatedAt uint64) (*types.Transaction, error) {
	return _BettingPool.Contract.UpdateOdds(&_BettingPool.TransactOpts, marketId, baseOdds, updatedAt)
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

// BettingPoolBetCashedOutIterator is returned from FilterBetCashedOut and is used to iterate over the raw logs and unpacked data for BetCashedOut events raised by the BettingPool contract.
type BettingPoolBetCashedOutIterator struct {
	Event *BettingPoolBetCashedOut // Event containing the contract specifics and raw log

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
func (it *BettingPoolBetCashedOutIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolBetCashedOut)
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
		it.Event = new(BettingPoolBetCashedOut)
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
func (it *BettingPoolBetCashedOutIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolBetCashedOutIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolBetCashedOut represents a BetCashedOut event raised by the BettingPool contract.
type BettingPoolBetCashedOut struct {
	BetId          [32]byte
	MarketId       [32]byte
	User           common.Address
	RemainingStake *big.Int
	CashOutAmount  *big.Int
	CurrentOdds    *big.Int
	FeeBps         uint16
	QuoteVersion   *big.Int
	Raw            types.Log // Blockchain specific contextual infos
}

// FilterBetCashedOut is a free log retrieval operation binding the contract event 0x1b7d13a31782d6eb4380bf22a451b3161264d295450d09cdc89c74276d9df9d4.
//
// Solidity: event BetCashedOut(bytes32 indexed betId, bytes32 indexed marketId, address indexed user, uint256 remainingStake, uint256 cashOutAmount, uint256 currentOdds, uint16 feeBps, uint256 quoteVersion)
func (_BettingPool *BettingPoolFilterer) FilterBetCashedOut(opts *bind.FilterOpts, betId [][32]byte, marketId [][32]byte, user []common.Address) (*BettingPoolBetCashedOutIterator, error) {

	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}
	var marketIdRule []interface{}
	for _, marketIdItem := range marketId {
		marketIdRule = append(marketIdRule, marketIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "BetCashedOut", betIdRule, marketIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolBetCashedOutIterator{contract: _BettingPool.contract, event: "BetCashedOut", logs: logs, sub: sub}, nil
}

// WatchBetCashedOut is a free log subscription operation binding the contract event 0x1b7d13a31782d6eb4380bf22a451b3161264d295450d09cdc89c74276d9df9d4.
//
// Solidity: event BetCashedOut(bytes32 indexed betId, bytes32 indexed marketId, address indexed user, uint256 remainingStake, uint256 cashOutAmount, uint256 currentOdds, uint16 feeBps, uint256 quoteVersion)
func (_BettingPool *BettingPoolFilterer) WatchBetCashedOut(opts *bind.WatchOpts, sink chan<- *BettingPoolBetCashedOut, betId [][32]byte, marketId [][32]byte, user []common.Address) (event.Subscription, error) {

	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}
	var marketIdRule []interface{}
	for _, marketIdItem := range marketId {
		marketIdRule = append(marketIdRule, marketIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "BetCashedOut", betIdRule, marketIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolBetCashedOut)
				if err := _BettingPool.contract.UnpackLog(event, "BetCashedOut", log); err != nil {
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

// ParseBetCashedOut is a log parse operation binding the contract event 0x1b7d13a31782d6eb4380bf22a451b3161264d295450d09cdc89c74276d9df9d4.
//
// Solidity: event BetCashedOut(bytes32 indexed betId, bytes32 indexed marketId, address indexed user, uint256 remainingStake, uint256 cashOutAmount, uint256 currentOdds, uint16 feeBps, uint256 quoteVersion)
func (_BettingPool *BettingPoolFilterer) ParseBetCashedOut(log types.Log) (*BettingPoolBetCashedOut, error) {
	event := new(BettingPoolBetCashedOut)
	if err := _BettingPool.contract.UnpackLog(event, "BetCashedOut", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolBetClaimedIterator is returned from FilterBetClaimed and is used to iterate over the raw logs and unpacked data for BetClaimed events raised by the BettingPool contract.
type BettingPoolBetClaimedIterator struct {
	Event *BettingPoolBetClaimed // Event containing the contract specifics and raw log

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
func (it *BettingPoolBetClaimedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolBetClaimed)
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
		it.Event = new(BettingPoolBetClaimed)
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
func (it *BettingPoolBetClaimedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolBetClaimedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolBetClaimed represents a BetClaimed event raised by the BettingPool contract.
type BettingPoolBetClaimed struct {
	BetId    [32]byte
	MarketId [32]byte
	User     common.Address
	Payout   *big.Int
	Executor common.Address
	Raw      types.Log // Blockchain specific contextual infos
}

// FilterBetClaimed is a free log retrieval operation binding the contract event 0xa035b6236045c828a0ee3ebaa4af17e1b393841bd46a76311b682cf7525b8832.
//
// Solidity: event BetClaimed(bytes32 indexed betId, bytes32 indexed marketId, address indexed user, uint256 payout, address executor)
func (_BettingPool *BettingPoolFilterer) FilterBetClaimed(opts *bind.FilterOpts, betId [][32]byte, marketId [][32]byte, user []common.Address) (*BettingPoolBetClaimedIterator, error) {

	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}
	var marketIdRule []interface{}
	for _, marketIdItem := range marketId {
		marketIdRule = append(marketIdRule, marketIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "BetClaimed", betIdRule, marketIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolBetClaimedIterator{contract: _BettingPool.contract, event: "BetClaimed", logs: logs, sub: sub}, nil
}

// WatchBetClaimed is a free log subscription operation binding the contract event 0xa035b6236045c828a0ee3ebaa4af17e1b393841bd46a76311b682cf7525b8832.
//
// Solidity: event BetClaimed(bytes32 indexed betId, bytes32 indexed marketId, address indexed user, uint256 payout, address executor)
func (_BettingPool *BettingPoolFilterer) WatchBetClaimed(opts *bind.WatchOpts, sink chan<- *BettingPoolBetClaimed, betId [][32]byte, marketId [][32]byte, user []common.Address) (event.Subscription, error) {

	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}
	var marketIdRule []interface{}
	for _, marketIdItem := range marketId {
		marketIdRule = append(marketIdRule, marketIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "BetClaimed", betIdRule, marketIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolBetClaimed)
				if err := _BettingPool.contract.UnpackLog(event, "BetClaimed", log); err != nil {
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

// ParseBetClaimed is a log parse operation binding the contract event 0xa035b6236045c828a0ee3ebaa4af17e1b393841bd46a76311b682cf7525b8832.
//
// Solidity: event BetClaimed(bytes32 indexed betId, bytes32 indexed marketId, address indexed user, uint256 payout, address executor)
func (_BettingPool *BettingPoolFilterer) ParseBetClaimed(log types.Log) (*BettingPoolBetClaimed, error) {
	event := new(BettingPoolBetClaimed)
	if err := _BettingPool.contract.UnpackLog(event, "BetClaimed", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolBetPlacedIterator is returned from FilterBetPlaced and is used to iterate over the raw logs and unpacked data for BetPlaced events raised by the BettingPool contract.
type BettingPoolBetPlacedIterator struct {
	Event *BettingPoolBetPlaced // Event containing the contract specifics and raw log

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
func (it *BettingPoolBetPlacedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolBetPlaced)
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
		it.Event = new(BettingPoolBetPlaced)
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
func (it *BettingPoolBetPlacedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolBetPlacedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolBetPlaced represents a BetPlaced event raised by the BettingPool contract.
type BettingPoolBetPlaced struct {
	BetId           [32]byte
	MarketId        [32]byte
	User            common.Address
	RequestedAmount *big.Int
	AcceptedAmount  *big.Int
	LockedOdds      *big.Int
	QuoteVersion    *big.Int
	Outcome         uint8
	Raw             types.Log // Blockchain specific contextual infos
}

// FilterBetPlaced is a free log retrieval operation binding the contract event 0xb2e7d3f1dc4ce9c56b8ac4f9bd41cde9240dabccdeebbf2de2764359bddb67ec.
//
// Solidity: event BetPlaced(bytes32 indexed betId, bytes32 indexed marketId, address indexed user, uint256 requestedAmount, uint256 acceptedAmount, uint256 lockedOdds, uint256 quoteVersion, uint8 outcome)
func (_BettingPool *BettingPoolFilterer) FilterBetPlaced(opts *bind.FilterOpts, betId [][32]byte, marketId [][32]byte, user []common.Address) (*BettingPoolBetPlacedIterator, error) {

	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}
	var marketIdRule []interface{}
	for _, marketIdItem := range marketId {
		marketIdRule = append(marketIdRule, marketIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "BetPlaced", betIdRule, marketIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolBetPlacedIterator{contract: _BettingPool.contract, event: "BetPlaced", logs: logs, sub: sub}, nil
}

// WatchBetPlaced is a free log subscription operation binding the contract event 0xb2e7d3f1dc4ce9c56b8ac4f9bd41cde9240dabccdeebbf2de2764359bddb67ec.
//
// Solidity: event BetPlaced(bytes32 indexed betId, bytes32 indexed marketId, address indexed user, uint256 requestedAmount, uint256 acceptedAmount, uint256 lockedOdds, uint256 quoteVersion, uint8 outcome)
func (_BettingPool *BettingPoolFilterer) WatchBetPlaced(opts *bind.WatchOpts, sink chan<- *BettingPoolBetPlaced, betId [][32]byte, marketId [][32]byte, user []common.Address) (event.Subscription, error) {

	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}
	var marketIdRule []interface{}
	for _, marketIdItem := range marketId {
		marketIdRule = append(marketIdRule, marketIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "BetPlaced", betIdRule, marketIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolBetPlaced)
				if err := _BettingPool.contract.UnpackLog(event, "BetPlaced", log); err != nil {
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

// ParseBetPlaced is a log parse operation binding the contract event 0xb2e7d3f1dc4ce9c56b8ac4f9bd41cde9240dabccdeebbf2de2764359bddb67ec.
//
// Solidity: event BetPlaced(bytes32 indexed betId, bytes32 indexed marketId, address indexed user, uint256 requestedAmount, uint256 acceptedAmount, uint256 lockedOdds, uint256 quoteVersion, uint8 outcome)
func (_BettingPool *BettingPoolFilterer) ParseBetPlaced(log types.Log) (*BettingPoolBetPlaced, error) {
	event := new(BettingPoolBetPlaced)
	if err := _BettingPool.contract.UnpackLog(event, "BetPlaced", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolBetRefundedIterator is returned from FilterBetRefunded and is used to iterate over the raw logs and unpacked data for BetRefunded events raised by the BettingPool contract.
type BettingPoolBetRefundedIterator struct {
	Event *BettingPoolBetRefunded // Event containing the contract specifics and raw log

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
func (it *BettingPoolBetRefundedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolBetRefunded)
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
		it.Event = new(BettingPoolBetRefunded)
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
func (it *BettingPoolBetRefundedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolBetRefundedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolBetRefunded represents a BetRefunded event raised by the BettingPool contract.
type BettingPoolBetRefunded struct {
	BetId        [32]byte
	MarketId     [32]byte
	User         common.Address
	RefundAmount *big.Int
	Reason       uint8
	QuoteVersion *big.Int
	Raw          types.Log // Blockchain specific contextual infos
}

// FilterBetRefunded is a free log retrieval operation binding the contract event 0xa82831ffe595079a4a86a5d75bd7c7d72c67db2da949b3fc52abb4a6f9069935.
//
// Solidity: event BetRefunded(bytes32 indexed betId, bytes32 indexed marketId, address indexed user, uint256 refundAmount, uint8 reason, uint256 quoteVersion)
func (_BettingPool *BettingPoolFilterer) FilterBetRefunded(opts *bind.FilterOpts, betId [][32]byte, marketId [][32]byte, user []common.Address) (*BettingPoolBetRefundedIterator, error) {

	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}
	var marketIdRule []interface{}
	for _, marketIdItem := range marketId {
		marketIdRule = append(marketIdRule, marketIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "BetRefunded", betIdRule, marketIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolBetRefundedIterator{contract: _BettingPool.contract, event: "BetRefunded", logs: logs, sub: sub}, nil
}

// WatchBetRefunded is a free log subscription operation binding the contract event 0xa82831ffe595079a4a86a5d75bd7c7d72c67db2da949b3fc52abb4a6f9069935.
//
// Solidity: event BetRefunded(bytes32 indexed betId, bytes32 indexed marketId, address indexed user, uint256 refundAmount, uint8 reason, uint256 quoteVersion)
func (_BettingPool *BettingPoolFilterer) WatchBetRefunded(opts *bind.WatchOpts, sink chan<- *BettingPoolBetRefunded, betId [][32]byte, marketId [][32]byte, user []common.Address) (event.Subscription, error) {

	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}
	var marketIdRule []interface{}
	for _, marketIdItem := range marketId {
		marketIdRule = append(marketIdRule, marketIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "BetRefunded", betIdRule, marketIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolBetRefunded)
				if err := _BettingPool.contract.UnpackLog(event, "BetRefunded", log); err != nil {
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

// ParseBetRefunded is a log parse operation binding the contract event 0xa82831ffe595079a4a86a5d75bd7c7d72c67db2da949b3fc52abb4a6f9069935.
//
// Solidity: event BetRefunded(bytes32 indexed betId, bytes32 indexed marketId, address indexed user, uint256 refundAmount, uint8 reason, uint256 quoteVersion)
func (_BettingPool *BettingPoolFilterer) ParseBetRefunded(log types.Log) (*BettingPoolBetRefunded, error) {
	event := new(BettingPoolBetRefunded)
	if err := _BettingPool.contract.UnpackLog(event, "BetRefunded", log); err != nil {
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

// BettingPoolLpLossOffsetAppliedIterator is returned from FilterLpLossOffsetApplied and is used to iterate over the raw logs and unpacked data for LpLossOffsetApplied events raised by the BettingPool contract.
type BettingPoolLpLossOffsetAppliedIterator struct {
	Event *BettingPoolLpLossOffsetApplied // Event containing the contract specifics and raw log

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
func (it *BettingPoolLpLossOffsetAppliedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolLpLossOffsetApplied)
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
		it.Event = new(BettingPoolLpLossOffsetApplied)
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
func (it *BettingPoolLpLossOffsetAppliedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolLpLossOffsetAppliedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolLpLossOffsetApplied represents a LpLossOffsetApplied event raised by the BettingPool contract.
type BettingPoolLpLossOffsetApplied struct {
	Amount          *big.Int
	RemainingOffset *big.Int
	Raw             types.Log // Blockchain specific contextual infos
}

// FilterLpLossOffsetApplied is a free log retrieval operation binding the contract event 0xcc23134a5f8bfedb5d80b5cc19ca7ef28dd4a5dfb6cc3ae47cfab79ca801721c.
//
// Solidity: event LpLossOffsetApplied(uint256 amount, uint256 remainingOffset)
func (_BettingPool *BettingPoolFilterer) FilterLpLossOffsetApplied(opts *bind.FilterOpts) (*BettingPoolLpLossOffsetAppliedIterator, error) {

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "LpLossOffsetApplied")
	if err != nil {
		return nil, err
	}
	return &BettingPoolLpLossOffsetAppliedIterator{contract: _BettingPool.contract, event: "LpLossOffsetApplied", logs: logs, sub: sub}, nil
}

// WatchLpLossOffsetApplied is a free log subscription operation binding the contract event 0xcc23134a5f8bfedb5d80b5cc19ca7ef28dd4a5dfb6cc3ae47cfab79ca801721c.
//
// Solidity: event LpLossOffsetApplied(uint256 amount, uint256 remainingOffset)
func (_BettingPool *BettingPoolFilterer) WatchLpLossOffsetApplied(opts *bind.WatchOpts, sink chan<- *BettingPoolLpLossOffsetApplied) (event.Subscription, error) {

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "LpLossOffsetApplied")
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolLpLossOffsetApplied)
				if err := _BettingPool.contract.UnpackLog(event, "LpLossOffsetApplied", log); err != nil {
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

// ParseLpLossOffsetApplied is a log parse operation binding the contract event 0xcc23134a5f8bfedb5d80b5cc19ca7ef28dd4a5dfb6cc3ae47cfab79ca801721c.
//
// Solidity: event LpLossOffsetApplied(uint256 amount, uint256 remainingOffset)
func (_BettingPool *BettingPoolFilterer) ParseLpLossOffsetApplied(log types.Log) (*BettingPoolLpLossOffsetApplied, error) {
	event := new(BettingPoolLpLossOffsetApplied)
	if err := _BettingPool.contract.UnpackLog(event, "LpLossOffsetApplied", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolMarketManuallyLockedIterator is returned from FilterMarketManuallyLocked and is used to iterate over the raw logs and unpacked data for MarketManuallyLocked events raised by the BettingPool contract.
type BettingPoolMarketManuallyLockedIterator struct {
	Event *BettingPoolMarketManuallyLocked // Event containing the contract specifics and raw log

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
func (it *BettingPoolMarketManuallyLockedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolMarketManuallyLocked)
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
		it.Event = new(BettingPoolMarketManuallyLocked)
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
func (it *BettingPoolMarketManuallyLockedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolMarketManuallyLockedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolMarketManuallyLocked represents a MarketManuallyLocked event raised by the BettingPool contract.
type BettingPoolMarketManuallyLocked struct {
	MarketId     [32]byte
	MatchId      [32]byte
	Operator     common.Address
	LockedAt     uint64
	QuoteVersion *big.Int
	Raw          types.Log // Blockchain specific contextual infos
}

// FilterMarketManuallyLocked is a free log retrieval operation binding the contract event 0x95244324324751abe16f64471021c5615ec015f1af924168f8979cfd5066a82e.
//
// Solidity: event MarketManuallyLocked(bytes32 indexed marketId, bytes32 indexed matchId, address indexed operator, uint64 lockedAt, uint256 quoteVersion)
func (_BettingPool *BettingPoolFilterer) FilterMarketManuallyLocked(opts *bind.FilterOpts, marketId [][32]byte, matchId [][32]byte, operator []common.Address) (*BettingPoolMarketManuallyLockedIterator, error) {

	var marketIdRule []interface{}
	for _, marketIdItem := range marketId {
		marketIdRule = append(marketIdRule, marketIdItem)
	}
	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}
	var operatorRule []interface{}
	for _, operatorItem := range operator {
		operatorRule = append(operatorRule, operatorItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "MarketManuallyLocked", marketIdRule, matchIdRule, operatorRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolMarketManuallyLockedIterator{contract: _BettingPool.contract, event: "MarketManuallyLocked", logs: logs, sub: sub}, nil
}

// WatchMarketManuallyLocked is a free log subscription operation binding the contract event 0x95244324324751abe16f64471021c5615ec015f1af924168f8979cfd5066a82e.
//
// Solidity: event MarketManuallyLocked(bytes32 indexed marketId, bytes32 indexed matchId, address indexed operator, uint64 lockedAt, uint256 quoteVersion)
func (_BettingPool *BettingPoolFilterer) WatchMarketManuallyLocked(opts *bind.WatchOpts, sink chan<- *BettingPoolMarketManuallyLocked, marketId [][32]byte, matchId [][32]byte, operator []common.Address) (event.Subscription, error) {

	var marketIdRule []interface{}
	for _, marketIdItem := range marketId {
		marketIdRule = append(marketIdRule, marketIdItem)
	}
	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}
	var operatorRule []interface{}
	for _, operatorItem := range operator {
		operatorRule = append(operatorRule, operatorItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "MarketManuallyLocked", marketIdRule, matchIdRule, operatorRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolMarketManuallyLocked)
				if err := _BettingPool.contract.UnpackLog(event, "MarketManuallyLocked", log); err != nil {
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

// ParseMarketManuallyLocked is a log parse operation binding the contract event 0x95244324324751abe16f64471021c5615ec015f1af924168f8979cfd5066a82e.
//
// Solidity: event MarketManuallyLocked(bytes32 indexed marketId, bytes32 indexed matchId, address indexed operator, uint64 lockedAt, uint256 quoteVersion)
func (_BettingPool *BettingPoolFilterer) ParseMarketManuallyLocked(log types.Log) (*BettingPoolMarketManuallyLocked, error) {
	event := new(BettingPoolMarketManuallyLocked)
	if err := _BettingPool.contract.UnpackLog(event, "MarketManuallyLocked", log); err != nil {
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
	MarketId       [32]byte
	MatchId        [32]byte
	MarketType     uint8
	Line           uint8
	MatchStartTime uint64
	LockAt         uint64
	QuoteVersion   *big.Int
	Raw            types.Log // Blockchain specific contextual infos
}

// FilterMarketOpened is a free log retrieval operation binding the contract event 0xbf9d56469aa439c93a7a6c8572afc94a449fb557fe5b7a0b380493a3b4739a44.
//
// Solidity: event MarketOpened(bytes32 indexed marketId, bytes32 indexed matchId, uint8 marketType, uint8 line, uint64 matchStartTime, uint64 lockAt, uint256 quoteVersion)
func (_BettingPool *BettingPoolFilterer) FilterMarketOpened(opts *bind.FilterOpts, marketId [][32]byte, matchId [][32]byte) (*BettingPoolMarketOpenedIterator, error) {

	var marketIdRule []interface{}
	for _, marketIdItem := range marketId {
		marketIdRule = append(marketIdRule, marketIdItem)
	}
	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "MarketOpened", marketIdRule, matchIdRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolMarketOpenedIterator{contract: _BettingPool.contract, event: "MarketOpened", logs: logs, sub: sub}, nil
}

// WatchMarketOpened is a free log subscription operation binding the contract event 0xbf9d56469aa439c93a7a6c8572afc94a449fb557fe5b7a0b380493a3b4739a44.
//
// Solidity: event MarketOpened(bytes32 indexed marketId, bytes32 indexed matchId, uint8 marketType, uint8 line, uint64 matchStartTime, uint64 lockAt, uint256 quoteVersion)
func (_BettingPool *BettingPoolFilterer) WatchMarketOpened(opts *bind.WatchOpts, sink chan<- *BettingPoolMarketOpened, marketId [][32]byte, matchId [][32]byte) (event.Subscription, error) {

	var marketIdRule []interface{}
	for _, marketIdItem := range marketId {
		marketIdRule = append(marketIdRule, marketIdItem)
	}
	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "MarketOpened", marketIdRule, matchIdRule)
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

// ParseMarketOpened is a log parse operation binding the contract event 0xbf9d56469aa439c93a7a6c8572afc94a449fb557fe5b7a0b380493a3b4739a44.
//
// Solidity: event MarketOpened(bytes32 indexed marketId, bytes32 indexed matchId, uint8 marketType, uint8 line, uint64 matchStartTime, uint64 lockAt, uint256 quoteVersion)
func (_BettingPool *BettingPoolFilterer) ParseMarketOpened(log types.Log) (*BettingPoolMarketOpened, error) {
	event := new(BettingPoolMarketOpened)
	if err := _BettingPool.contract.UnpackLog(event, "MarketOpened", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolMarketSettlementFinalizedIterator is returned from FilterMarketSettlementFinalized and is used to iterate over the raw logs and unpacked data for MarketSettlementFinalized events raised by the BettingPool contract.
type BettingPoolMarketSettlementFinalizedIterator struct {
	Event *BettingPoolMarketSettlementFinalized // Event containing the contract specifics and raw log

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
func (it *BettingPoolMarketSettlementFinalizedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolMarketSettlementFinalized)
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
		it.Event = new(BettingPoolMarketSettlementFinalized)
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
func (it *BettingPoolMarketSettlementFinalizedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolMarketSettlementFinalizedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolMarketSettlementFinalized represents a MarketSettlementFinalized event raised by the BettingPool contract.
type BettingPoolMarketSettlementFinalized struct {
	MarketId            [32]byte
	ResultKind          uint8
	ScoreSettled        bool
	HomeScore           uint16
	AwayScore           uint16
	GrossPayout         *big.Int
	LpMarginShare       *big.Int
	PlatformMarginShare *big.Int
	QuoteVersion        *big.Int
	Raw                 types.Log // Blockchain specific contextual infos
}

// FilterMarketSettlementFinalized is a free log retrieval operation binding the contract event 0xe35ec1823db5a8d93c6bd2d9f6b0173597fadeb0dd650406550ee3f9a58aadae.
//
// Solidity: event MarketSettlementFinalized(bytes32 indexed marketId, uint8 resultKind, bool scoreSettled, uint16 homeScore, uint16 awayScore, uint256 grossPayout, uint256 lpMarginShare, uint256 platformMarginShare, uint256 quoteVersion)
func (_BettingPool *BettingPoolFilterer) FilterMarketSettlementFinalized(opts *bind.FilterOpts, marketId [][32]byte) (*BettingPoolMarketSettlementFinalizedIterator, error) {

	var marketIdRule []interface{}
	for _, marketIdItem := range marketId {
		marketIdRule = append(marketIdRule, marketIdItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "MarketSettlementFinalized", marketIdRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolMarketSettlementFinalizedIterator{contract: _BettingPool.contract, event: "MarketSettlementFinalized", logs: logs, sub: sub}, nil
}

// WatchMarketSettlementFinalized is a free log subscription operation binding the contract event 0xe35ec1823db5a8d93c6bd2d9f6b0173597fadeb0dd650406550ee3f9a58aadae.
//
// Solidity: event MarketSettlementFinalized(bytes32 indexed marketId, uint8 resultKind, bool scoreSettled, uint16 homeScore, uint16 awayScore, uint256 grossPayout, uint256 lpMarginShare, uint256 platformMarginShare, uint256 quoteVersion)
func (_BettingPool *BettingPoolFilterer) WatchMarketSettlementFinalized(opts *bind.WatchOpts, sink chan<- *BettingPoolMarketSettlementFinalized, marketId [][32]byte) (event.Subscription, error) {

	var marketIdRule []interface{}
	for _, marketIdItem := range marketId {
		marketIdRule = append(marketIdRule, marketIdItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "MarketSettlementFinalized", marketIdRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolMarketSettlementFinalized)
				if err := _BettingPool.contract.UnpackLog(event, "MarketSettlementFinalized", log); err != nil {
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

// ParseMarketSettlementFinalized is a log parse operation binding the contract event 0xe35ec1823db5a8d93c6bd2d9f6b0173597fadeb0dd650406550ee3f9a58aadae.
//
// Solidity: event MarketSettlementFinalized(bytes32 indexed marketId, uint8 resultKind, bool scoreSettled, uint16 homeScore, uint16 awayScore, uint256 grossPayout, uint256 lpMarginShare, uint256 platformMarginShare, uint256 quoteVersion)
func (_BettingPool *BettingPoolFilterer) ParseMarketSettlementFinalized(log types.Log) (*BettingPoolMarketSettlementFinalized, error) {
	event := new(BettingPoolMarketSettlementFinalized)
	if err := _BettingPool.contract.UnpackLog(event, "MarketSettlementFinalized", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolMarketSettlementScoreBatchProcessedIterator is returned from FilterMarketSettlementScoreBatchProcessed and is used to iterate over the raw logs and unpacked data for MarketSettlementScoreBatchProcessed events raised by the BettingPool contract.
type BettingPoolMarketSettlementScoreBatchProcessedIterator struct {
	Event *BettingPoolMarketSettlementScoreBatchProcessed // Event containing the contract specifics and raw log

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
func (it *BettingPoolMarketSettlementScoreBatchProcessedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolMarketSettlementScoreBatchProcessed)
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
		it.Event = new(BettingPoolMarketSettlementScoreBatchProcessed)
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
func (it *BettingPoolMarketSettlementScoreBatchProcessedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolMarketSettlementScoreBatchProcessedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolMarketSettlementScoreBatchProcessed represents a MarketSettlementScoreBatchProcessed event raised by the BettingPool contract.
type BettingPoolMarketSettlementScoreBatchProcessed struct {
	MarketId       [32]byte
	HomeScore      uint16
	AwayScore      uint16
	ProcessedCount *big.Int
	TotalBetCount  *big.Int
	Raw            types.Log // Blockchain specific contextual infos
}

// FilterMarketSettlementScoreBatchProcessed is a free log retrieval operation binding the contract event 0x7405c2f4e0e654250435534eff4c4fd86175fa46dd9c2cb4183d5bbffbbc2dc5.
//
// Solidity: event MarketSettlementScoreBatchProcessed(bytes32 indexed marketId, uint16 homeScore, uint16 awayScore, uint256 processedCount, uint256 totalBetCount)
func (_BettingPool *BettingPoolFilterer) FilterMarketSettlementScoreBatchProcessed(opts *bind.FilterOpts, marketId [][32]byte) (*BettingPoolMarketSettlementScoreBatchProcessedIterator, error) {

	var marketIdRule []interface{}
	for _, marketIdItem := range marketId {
		marketIdRule = append(marketIdRule, marketIdItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "MarketSettlementScoreBatchProcessed", marketIdRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolMarketSettlementScoreBatchProcessedIterator{contract: _BettingPool.contract, event: "MarketSettlementScoreBatchProcessed", logs: logs, sub: sub}, nil
}

// WatchMarketSettlementScoreBatchProcessed is a free log subscription operation binding the contract event 0x7405c2f4e0e654250435534eff4c4fd86175fa46dd9c2cb4183d5bbffbbc2dc5.
//
// Solidity: event MarketSettlementScoreBatchProcessed(bytes32 indexed marketId, uint16 homeScore, uint16 awayScore, uint256 processedCount, uint256 totalBetCount)
func (_BettingPool *BettingPoolFilterer) WatchMarketSettlementScoreBatchProcessed(opts *bind.WatchOpts, sink chan<- *BettingPoolMarketSettlementScoreBatchProcessed, marketId [][32]byte) (event.Subscription, error) {

	var marketIdRule []interface{}
	for _, marketIdItem := range marketId {
		marketIdRule = append(marketIdRule, marketIdItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "MarketSettlementScoreBatchProcessed", marketIdRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolMarketSettlementScoreBatchProcessed)
				if err := _BettingPool.contract.UnpackLog(event, "MarketSettlementScoreBatchProcessed", log); err != nil {
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

// ParseMarketSettlementScoreBatchProcessed is a log parse operation binding the contract event 0x7405c2f4e0e654250435534eff4c4fd86175fa46dd9c2cb4183d5bbffbbc2dc5.
//
// Solidity: event MarketSettlementScoreBatchProcessed(bytes32 indexed marketId, uint16 homeScore, uint16 awayScore, uint256 processedCount, uint256 totalBetCount)
func (_BettingPool *BettingPoolFilterer) ParseMarketSettlementScoreBatchProcessed(log types.Log) (*BettingPoolMarketSettlementScoreBatchProcessed, error) {
	event := new(BettingPoolMarketSettlementScoreBatchProcessed)
	if err := _BettingPool.contract.UnpackLog(event, "MarketSettlementScoreBatchProcessed", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolOddsUpdatedIterator is returned from FilterOddsUpdated and is used to iterate over the raw logs and unpacked data for OddsUpdated events raised by the BettingPool contract.
type BettingPoolOddsUpdatedIterator struct {
	Event *BettingPoolOddsUpdated // Event containing the contract specifics and raw log

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
func (it *BettingPoolOddsUpdatedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolOddsUpdated)
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
		it.Event = new(BettingPoolOddsUpdated)
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
func (it *BettingPoolOddsUpdatedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolOddsUpdatedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolOddsUpdated represents a OddsUpdated event raised by the BettingPool contract.
type BettingPoolOddsUpdated struct {
	MarketId     [32]byte
	UpdatedAt    uint64
	QuoteVersion *big.Int
	Signal       uint8
	Raw          types.Log // Blockchain specific contextual infos
}

// FilterOddsUpdated is a free log retrieval operation binding the contract event 0x0f2da01f4bf0a5ccf13b2d90da33f01cee6cf1d662739a9716b5d07d5e31d996.
//
// Solidity: event OddsUpdated(bytes32 indexed marketId, uint64 updatedAt, uint256 quoteVersion, uint8 signal)
func (_BettingPool *BettingPoolFilterer) FilterOddsUpdated(opts *bind.FilterOpts, marketId [][32]byte) (*BettingPoolOddsUpdatedIterator, error) {

	var marketIdRule []interface{}
	for _, marketIdItem := range marketId {
		marketIdRule = append(marketIdRule, marketIdItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "OddsUpdated", marketIdRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolOddsUpdatedIterator{contract: _BettingPool.contract, event: "OddsUpdated", logs: logs, sub: sub}, nil
}

// WatchOddsUpdated is a free log subscription operation binding the contract event 0x0f2da01f4bf0a5ccf13b2d90da33f01cee6cf1d662739a9716b5d07d5e31d996.
//
// Solidity: event OddsUpdated(bytes32 indexed marketId, uint64 updatedAt, uint256 quoteVersion, uint8 signal)
func (_BettingPool *BettingPoolFilterer) WatchOddsUpdated(opts *bind.WatchOpts, sink chan<- *BettingPoolOddsUpdated, marketId [][32]byte) (event.Subscription, error) {

	var marketIdRule []interface{}
	for _, marketIdItem := range marketId {
		marketIdRule = append(marketIdRule, marketIdItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "OddsUpdated", marketIdRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolOddsUpdated)
				if err := _BettingPool.contract.UnpackLog(event, "OddsUpdated", log); err != nil {
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

// ParseOddsUpdated is a log parse operation binding the contract event 0x0f2da01f4bf0a5ccf13b2d90da33f01cee6cf1d662739a9716b5d07d5e31d996.
//
// Solidity: event OddsUpdated(bytes32 indexed marketId, uint64 updatedAt, uint256 quoteVersion, uint8 signal)
func (_BettingPool *BettingPoolFilterer) ParseOddsUpdated(log types.Log) (*BettingPoolOddsUpdated, error) {
	event := new(BettingPoolOddsUpdated)
	if err := _BettingPool.contract.UnpackLog(event, "OddsUpdated", log); err != nil {
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

// BettingPoolPayoutClaimedIterator is returned from FilterPayoutClaimed and is used to iterate over the raw logs and unpacked data for PayoutClaimed events raised by the BettingPool contract.
type BettingPoolPayoutClaimedIterator struct {
	Event *BettingPoolPayoutClaimed // Event containing the contract specifics and raw log

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
func (it *BettingPoolPayoutClaimedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolPayoutClaimed)
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
		it.Event = new(BettingPoolPayoutClaimed)
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
func (it *BettingPoolPayoutClaimedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolPayoutClaimedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolPayoutClaimed represents a PayoutClaimed event raised by the BettingPool contract.
type BettingPoolPayoutClaimed struct {
	BetId       [32]byte
	User        common.Address
	GrossPayout *big.Int
	TaxAmount   *big.Int
	NetPayout   *big.Int
	Raw         types.Log // Blockchain specific contextual infos
}

// FilterPayoutClaimed is a free log retrieval operation binding the contract event 0x8b532e8544aaba4081e6679ce58881ffd75103cdb593e8478f0fb9126ea57944.
//
// Solidity: event PayoutClaimed(bytes32 indexed betId, address indexed user, uint256 grossPayout, uint256 taxAmount, uint256 netPayout)
func (_BettingPool *BettingPoolFilterer) FilterPayoutClaimed(opts *bind.FilterOpts, betId [][32]byte, user []common.Address) (*BettingPoolPayoutClaimedIterator, error) {

	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "PayoutClaimed", betIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolPayoutClaimedIterator{contract: _BettingPool.contract, event: "PayoutClaimed", logs: logs, sub: sub}, nil
}

// WatchPayoutClaimed is a free log subscription operation binding the contract event 0x8b532e8544aaba4081e6679ce58881ffd75103cdb593e8478f0fb9126ea57944.
//
// Solidity: event PayoutClaimed(bytes32 indexed betId, address indexed user, uint256 grossPayout, uint256 taxAmount, uint256 netPayout)
func (_BettingPool *BettingPoolFilterer) WatchPayoutClaimed(opts *bind.WatchOpts, sink chan<- *BettingPoolPayoutClaimed, betId [][32]byte, user []common.Address) (event.Subscription, error) {

	var betIdRule []interface{}
	for _, betIdItem := range betId {
		betIdRule = append(betIdRule, betIdItem)
	}
	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "PayoutClaimed", betIdRule, userRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolPayoutClaimed)
				if err := _BettingPool.contract.UnpackLog(event, "PayoutClaimed", log); err != nil {
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

// ParsePayoutClaimed is a log parse operation binding the contract event 0x8b532e8544aaba4081e6679ce58881ffd75103cdb593e8478f0fb9126ea57944.
//
// Solidity: event PayoutClaimed(bytes32 indexed betId, address indexed user, uint256 grossPayout, uint256 taxAmount, uint256 netPayout)
func (_BettingPool *BettingPoolFilterer) ParsePayoutClaimed(log types.Log) (*BettingPoolPayoutClaimed, error) {
	event := new(BettingPoolPayoutClaimed)
	if err := _BettingPool.contract.UnpackLog(event, "PayoutClaimed", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolPlatformReserveUpdatedIterator is returned from FilterPlatformReserveUpdated and is used to iterate over the raw logs and unpacked data for PlatformReserveUpdated events raised by the BettingPool contract.
type BettingPoolPlatformReserveUpdatedIterator struct {
	Event *BettingPoolPlatformReserveUpdated // Event containing the contract specifics and raw log

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
func (it *BettingPoolPlatformReserveUpdatedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolPlatformReserveUpdated)
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
		it.Event = new(BettingPoolPlatformReserveUpdated)
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
func (it *BettingPoolPlatformReserveUpdatedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolPlatformReserveUpdatedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolPlatformReserveUpdated represents a PlatformReserveUpdated event raised by the BettingPool contract.
type BettingPoolPlatformReserveUpdated struct {
	Delta      *big.Int
	NewBalance *big.Int
	Reason     uint8
	Raw        types.Log // Blockchain specific contextual infos
}

// FilterPlatformReserveUpdated is a free log retrieval operation binding the contract event 0xa8e0b922a7c0c6186f7b2d3975085ee37fb59e5b23a2038132978a515a354637.
//
// Solidity: event PlatformReserveUpdated(int256 delta, uint256 newBalance, uint8 reason)
func (_BettingPool *BettingPoolFilterer) FilterPlatformReserveUpdated(opts *bind.FilterOpts) (*BettingPoolPlatformReserveUpdatedIterator, error) {

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "PlatformReserveUpdated")
	if err != nil {
		return nil, err
	}
	return &BettingPoolPlatformReserveUpdatedIterator{contract: _BettingPool.contract, event: "PlatformReserveUpdated", logs: logs, sub: sub}, nil
}

// WatchPlatformReserveUpdated is a free log subscription operation binding the contract event 0xa8e0b922a7c0c6186f7b2d3975085ee37fb59e5b23a2038132978a515a354637.
//
// Solidity: event PlatformReserveUpdated(int256 delta, uint256 newBalance, uint8 reason)
func (_BettingPool *BettingPoolFilterer) WatchPlatformReserveUpdated(opts *bind.WatchOpts, sink chan<- *BettingPoolPlatformReserveUpdated) (event.Subscription, error) {

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "PlatformReserveUpdated")
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolPlatformReserveUpdated)
				if err := _BettingPool.contract.UnpackLog(event, "PlatformReserveUpdated", log); err != nil {
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

// ParsePlatformReserveUpdated is a log parse operation binding the contract event 0xa8e0b922a7c0c6186f7b2d3975085ee37fb59e5b23a2038132978a515a354637.
//
// Solidity: event PlatformReserveUpdated(int256 delta, uint256 newBalance, uint8 reason)
func (_BettingPool *BettingPoolFilterer) ParsePlatformReserveUpdated(log types.Log) (*BettingPoolPlatformReserveUpdated, error) {
	event := new(BettingPoolPlatformReserveUpdated)
	if err := _BettingPool.contract.UnpackLog(event, "PlatformReserveUpdated", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolReferralClaimedIterator is returned from FilterReferralClaimed and is used to iterate over the raw logs and unpacked data for ReferralClaimed events raised by the BettingPool contract.
type BettingPoolReferralClaimedIterator struct {
	Event *BettingPoolReferralClaimed // Event containing the contract specifics and raw log

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
func (it *BettingPoolReferralClaimedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolReferralClaimed)
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
		it.Event = new(BettingPoolReferralClaimed)
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
func (it *BettingPoolReferralClaimedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolReferralClaimedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolReferralClaimed represents a ReferralClaimed event raised by the BettingPool contract.
type BettingPoolReferralClaimed struct {
	Referrer  common.Address
	OddAmount *big.Int
	Raw       types.Log // Blockchain specific contextual infos
}

// FilterReferralClaimed is a free log retrieval operation binding the contract event 0x6cd4d40588b17656762e007b5b0c873a86cc13d23123cd1c44b4389b8aafa105.
//
// Solidity: event ReferralClaimed(address indexed referrer, uint256 oddAmount)
func (_BettingPool *BettingPoolFilterer) FilterReferralClaimed(opts *bind.FilterOpts, referrer []common.Address) (*BettingPoolReferralClaimedIterator, error) {

	var referrerRule []interface{}
	for _, referrerItem := range referrer {
		referrerRule = append(referrerRule, referrerItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "ReferralClaimed", referrerRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolReferralClaimedIterator{contract: _BettingPool.contract, event: "ReferralClaimed", logs: logs, sub: sub}, nil
}

// WatchReferralClaimed is a free log subscription operation binding the contract event 0x6cd4d40588b17656762e007b5b0c873a86cc13d23123cd1c44b4389b8aafa105.
//
// Solidity: event ReferralClaimed(address indexed referrer, uint256 oddAmount)
func (_BettingPool *BettingPoolFilterer) WatchReferralClaimed(opts *bind.WatchOpts, sink chan<- *BettingPoolReferralClaimed, referrer []common.Address) (event.Subscription, error) {

	var referrerRule []interface{}
	for _, referrerItem := range referrer {
		referrerRule = append(referrerRule, referrerItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "ReferralClaimed", referrerRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolReferralClaimed)
				if err := _BettingPool.contract.UnpackLog(event, "ReferralClaimed", log); err != nil {
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

// ParseReferralClaimed is a log parse operation binding the contract event 0x6cd4d40588b17656762e007b5b0c873a86cc13d23123cd1c44b4389b8aafa105.
//
// Solidity: event ReferralClaimed(address indexed referrer, uint256 oddAmount)
func (_BettingPool *BettingPoolFilterer) ParseReferralClaimed(log types.Log) (*BettingPoolReferralClaimed, error) {
	event := new(BettingPoolReferralClaimed)
	if err := _BettingPool.contract.UnpackLog(event, "ReferralClaimed", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolReferralClaimedUSDTIterator is returned from FilterReferralClaimedUSDT and is used to iterate over the raw logs and unpacked data for ReferralClaimedUSDT events raised by the BettingPool contract.
type BettingPoolReferralClaimedUSDTIterator struct {
	Event *BettingPoolReferralClaimedUSDT // Event containing the contract specifics and raw log

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
func (it *BettingPoolReferralClaimedUSDTIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolReferralClaimedUSDT)
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
		it.Event = new(BettingPoolReferralClaimedUSDT)
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
func (it *BettingPoolReferralClaimedUSDTIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolReferralClaimedUSDTIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolReferralClaimedUSDT represents a ReferralClaimedUSDT event raised by the BettingPool contract.
type BettingPoolReferralClaimedUSDT struct {
	Referrer        common.Address
	OddAmount       *big.Int
	UsdtAmount      *big.Int
	CurrentPriceX18 *big.Int
	Raw             types.Log // Blockchain specific contextual infos
}

// FilterReferralClaimedUSDT is a free log retrieval operation binding the contract event 0x3f29b19bb1d03714ac07254923f21d829fe99055337c53f3bee591f5c288689d.
//
// Solidity: event ReferralClaimedUSDT(address indexed referrer, uint256 oddAmount, uint256 usdtAmount, uint256 currentPriceX18)
func (_BettingPool *BettingPoolFilterer) FilterReferralClaimedUSDT(opts *bind.FilterOpts, referrer []common.Address) (*BettingPoolReferralClaimedUSDTIterator, error) {

	var referrerRule []interface{}
	for _, referrerItem := range referrer {
		referrerRule = append(referrerRule, referrerItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "ReferralClaimedUSDT", referrerRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolReferralClaimedUSDTIterator{contract: _BettingPool.contract, event: "ReferralClaimedUSDT", logs: logs, sub: sub}, nil
}

// WatchReferralClaimedUSDT is a free log subscription operation binding the contract event 0x3f29b19bb1d03714ac07254923f21d829fe99055337c53f3bee591f5c288689d.
//
// Solidity: event ReferralClaimedUSDT(address indexed referrer, uint256 oddAmount, uint256 usdtAmount, uint256 currentPriceX18)
func (_BettingPool *BettingPoolFilterer) WatchReferralClaimedUSDT(opts *bind.WatchOpts, sink chan<- *BettingPoolReferralClaimedUSDT, referrer []common.Address) (event.Subscription, error) {

	var referrerRule []interface{}
	for _, referrerItem := range referrer {
		referrerRule = append(referrerRule, referrerItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "ReferralClaimedUSDT", referrerRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolReferralClaimedUSDT)
				if err := _BettingPool.contract.UnpackLog(event, "ReferralClaimedUSDT", log); err != nil {
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

// ParseReferralClaimedUSDT is a log parse operation binding the contract event 0x3f29b19bb1d03714ac07254923f21d829fe99055337c53f3bee591f5c288689d.
//
// Solidity: event ReferralClaimedUSDT(address indexed referrer, uint256 oddAmount, uint256 usdtAmount, uint256 currentPriceX18)
func (_BettingPool *BettingPoolFilterer) ParseReferralClaimedUSDT(log types.Log) (*BettingPoolReferralClaimedUSDT, error) {
	event := new(BettingPoolReferralClaimedUSDT)
	if err := _BettingPool.contract.UnpackLog(event, "ReferralClaimedUSDT", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolReferralRewardAccumulatedIterator is returned from FilterReferralRewardAccumulated and is used to iterate over the raw logs and unpacked data for ReferralRewardAccumulated events raised by the BettingPool contract.
type BettingPoolReferralRewardAccumulatedIterator struct {
	Event *BettingPoolReferralRewardAccumulated // Event containing the contract specifics and raw log

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
func (it *BettingPoolReferralRewardAccumulatedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolReferralRewardAccumulated)
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
		it.Event = new(BettingPoolReferralRewardAccumulated)
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
func (it *BettingPoolReferralRewardAccumulatedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolReferralRewardAccumulatedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolReferralRewardAccumulated represents a ReferralRewardAccumulated event raised by the BettingPool contract.
type BettingPoolReferralRewardAccumulated struct {
	Referrer common.Address
	Amount   *big.Int
	From     common.Address
	Kind     uint8
	Raw      types.Log // Blockchain specific contextual infos
}

// FilterReferralRewardAccumulated is a free log retrieval operation binding the contract event 0xa803ab62ef35ea7f6aa61d775222fcde438edeee01f5a6941aaea0c36a8edbaa.
//
// Solidity: event ReferralRewardAccumulated(address indexed referrer, uint256 amount, address indexed from, uint8 kind)
func (_BettingPool *BettingPoolFilterer) FilterReferralRewardAccumulated(opts *bind.FilterOpts, referrer []common.Address, from []common.Address) (*BettingPoolReferralRewardAccumulatedIterator, error) {

	var referrerRule []interface{}
	for _, referrerItem := range referrer {
		referrerRule = append(referrerRule, referrerItem)
	}

	var fromRule []interface{}
	for _, fromItem := range from {
		fromRule = append(fromRule, fromItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "ReferralRewardAccumulated", referrerRule, fromRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolReferralRewardAccumulatedIterator{contract: _BettingPool.contract, event: "ReferralRewardAccumulated", logs: logs, sub: sub}, nil
}

// WatchReferralRewardAccumulated is a free log subscription operation binding the contract event 0xa803ab62ef35ea7f6aa61d775222fcde438edeee01f5a6941aaea0c36a8edbaa.
//
// Solidity: event ReferralRewardAccumulated(address indexed referrer, uint256 amount, address indexed from, uint8 kind)
func (_BettingPool *BettingPoolFilterer) WatchReferralRewardAccumulated(opts *bind.WatchOpts, sink chan<- *BettingPoolReferralRewardAccumulated, referrer []common.Address, from []common.Address) (event.Subscription, error) {

	var referrerRule []interface{}
	for _, referrerItem := range referrer {
		referrerRule = append(referrerRule, referrerItem)
	}

	var fromRule []interface{}
	for _, fromItem := range from {
		fromRule = append(fromRule, fromItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "ReferralRewardAccumulated", referrerRule, fromRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolReferralRewardAccumulated)
				if err := _BettingPool.contract.UnpackLog(event, "ReferralRewardAccumulated", log); err != nil {
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

// ParseReferralRewardAccumulated is a log parse operation binding the contract event 0xa803ab62ef35ea7f6aa61d775222fcde438edeee01f5a6941aaea0c36a8edbaa.
//
// Solidity: event ReferralRewardAccumulated(address indexed referrer, uint256 amount, address indexed from, uint8 kind)
func (_BettingPool *BettingPoolFilterer) ParseReferralRewardAccumulated(log types.Log) (*BettingPoolReferralRewardAccumulated, error) {
	event := new(BettingPoolReferralRewardAccumulated)
	if err := _BettingPool.contract.UnpackLog(event, "ReferralRewardAccumulated", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolReferrerBoundIterator is returned from FilterReferrerBound and is used to iterate over the raw logs and unpacked data for ReferrerBound events raised by the BettingPool contract.
type BettingPoolReferrerBoundIterator struct {
	Event *BettingPoolReferrerBound // Event containing the contract specifics and raw log

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
func (it *BettingPoolReferrerBoundIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolReferrerBound)
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
		it.Event = new(BettingPoolReferrerBound)
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
func (it *BettingPoolReferrerBoundIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolReferrerBoundIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolReferrerBound represents a ReferrerBound event raised by the BettingPool contract.
type BettingPoolReferrerBound struct {
	User     common.Address
	Referrer common.Address
	Raw      types.Log // Blockchain specific contextual infos
}

// FilterReferrerBound is a free log retrieval operation binding the contract event 0xc4c2ddb91b0f73749131d376ad37ce7b01a69dc1b477abc09377cf0e1d511b14.
//
// Solidity: event ReferrerBound(address indexed user, address indexed referrer)
func (_BettingPool *BettingPoolFilterer) FilterReferrerBound(opts *bind.FilterOpts, user []common.Address, referrer []common.Address) (*BettingPoolReferrerBoundIterator, error) {

	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}
	var referrerRule []interface{}
	for _, referrerItem := range referrer {
		referrerRule = append(referrerRule, referrerItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "ReferrerBound", userRule, referrerRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolReferrerBoundIterator{contract: _BettingPool.contract, event: "ReferrerBound", logs: logs, sub: sub}, nil
}

// WatchReferrerBound is a free log subscription operation binding the contract event 0xc4c2ddb91b0f73749131d376ad37ce7b01a69dc1b477abc09377cf0e1d511b14.
//
// Solidity: event ReferrerBound(address indexed user, address indexed referrer)
func (_BettingPool *BettingPoolFilterer) WatchReferrerBound(opts *bind.WatchOpts, sink chan<- *BettingPoolReferrerBound, user []common.Address, referrer []common.Address) (event.Subscription, error) {

	var userRule []interface{}
	for _, userItem := range user {
		userRule = append(userRule, userItem)
	}
	var referrerRule []interface{}
	for _, referrerItem := range referrer {
		referrerRule = append(referrerRule, referrerItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "ReferrerBound", userRule, referrerRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolReferrerBound)
				if err := _BettingPool.contract.UnpackLog(event, "ReferrerBound", log); err != nil {
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

// ParseReferrerBound is a log parse operation binding the contract event 0xc4c2ddb91b0f73749131d376ad37ce7b01a69dc1b477abc09377cf0e1d511b14.
//
// Solidity: event ReferrerBound(address indexed user, address indexed referrer)
func (_BettingPool *BettingPoolFilterer) ParseReferrerBound(log types.Log) (*BettingPoolReferrerBound, error) {
	event := new(BettingPoolReferrerBound)
	if err := _BettingPool.contract.UnpackLog(event, "ReferrerBound", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolReserveBelowFloorIterator is returned from FilterReserveBelowFloor and is used to iterate over the raw logs and unpacked data for ReserveBelowFloor events raised by the BettingPool contract.
type BettingPoolReserveBelowFloorIterator struct {
	Event *BettingPoolReserveBelowFloor // Event containing the contract specifics and raw log

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
func (it *BettingPoolReserveBelowFloorIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolReserveBelowFloor)
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
		it.Event = new(BettingPoolReserveBelowFloor)
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
func (it *BettingPoolReserveBelowFloorIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolReserveBelowFloorIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolReserveBelowFloor represents a ReserveBelowFloor event raised by the BettingPool contract.
type BettingPoolReserveBelowFloor struct {
	RemainingReserve *big.Int
	Raw              types.Log // Blockchain specific contextual infos
}

// FilterReserveBelowFloor is a free log retrieval operation binding the contract event 0x89167d2ba448404290ef90889c5b096db534c3031122caf390204f535430062d.
//
// Solidity: event ReserveBelowFloor(uint256 remainingReserve)
func (_BettingPool *BettingPoolFilterer) FilterReserveBelowFloor(opts *bind.FilterOpts) (*BettingPoolReserveBelowFloorIterator, error) {

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "ReserveBelowFloor")
	if err != nil {
		return nil, err
	}
	return &BettingPoolReserveBelowFloorIterator{contract: _BettingPool.contract, event: "ReserveBelowFloor", logs: logs, sub: sub}, nil
}

// WatchReserveBelowFloor is a free log subscription operation binding the contract event 0x89167d2ba448404290ef90889c5b096db534c3031122caf390204f535430062d.
//
// Solidity: event ReserveBelowFloor(uint256 remainingReserve)
func (_BettingPool *BettingPoolFilterer) WatchReserveBelowFloor(opts *bind.WatchOpts, sink chan<- *BettingPoolReserveBelowFloor) (event.Subscription, error) {

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "ReserveBelowFloor")
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolReserveBelowFloor)
				if err := _BettingPool.contract.UnpackLog(event, "ReserveBelowFloor", log); err != nil {
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

// ParseReserveBelowFloor is a log parse operation binding the contract event 0x89167d2ba448404290ef90889c5b096db534c3031122caf390204f535430062d.
//
// Solidity: event ReserveBelowFloor(uint256 remainingReserve)
func (_BettingPool *BettingPoolFilterer) ParseReserveBelowFloor(log types.Log) (*BettingPoolReserveBelowFloor, error) {
	event := new(BettingPoolReserveBelowFloor)
	if err := _BettingPool.contract.UnpackLog(event, "ReserveBelowFloor", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolReserveStepAlertIterator is returned from FilterReserveStepAlert and is used to iterate over the raw logs and unpacked data for ReserveStepAlert events raised by the BettingPool contract.
type BettingPoolReserveStepAlertIterator struct {
	Event *BettingPoolReserveStepAlert // Event containing the contract specifics and raw log

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
func (it *BettingPoolReserveStepAlertIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolReserveStepAlert)
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
		it.Event = new(BettingPoolReserveStepAlert)
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
func (it *BettingPoolReserveStepAlertIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolReserveStepAlertIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolReserveStepAlert represents a ReserveStepAlert event raised by the BettingPool contract.
type BettingPoolReserveStepAlert struct {
	StepIndex        *big.Int
	RemainingReserve *big.Int
	Raw              types.Log // Blockchain specific contextual infos
}

// FilterReserveStepAlert is a free log retrieval operation binding the contract event 0x733dcc3abb49225081550b067626fbacec068328d79bf99fa79e5a56be4ff4b7.
//
// Solidity: event ReserveStepAlert(uint256 indexed stepIndex, uint256 remainingReserve)
func (_BettingPool *BettingPoolFilterer) FilterReserveStepAlert(opts *bind.FilterOpts, stepIndex []*big.Int) (*BettingPoolReserveStepAlertIterator, error) {

	var stepIndexRule []interface{}
	for _, stepIndexItem := range stepIndex {
		stepIndexRule = append(stepIndexRule, stepIndexItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "ReserveStepAlert", stepIndexRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolReserveStepAlertIterator{contract: _BettingPool.contract, event: "ReserveStepAlert", logs: logs, sub: sub}, nil
}

// WatchReserveStepAlert is a free log subscription operation binding the contract event 0x733dcc3abb49225081550b067626fbacec068328d79bf99fa79e5a56be4ff4b7.
//
// Solidity: event ReserveStepAlert(uint256 indexed stepIndex, uint256 remainingReserve)
func (_BettingPool *BettingPoolFilterer) WatchReserveStepAlert(opts *bind.WatchOpts, sink chan<- *BettingPoolReserveStepAlert, stepIndex []*big.Int) (event.Subscription, error) {

	var stepIndexRule []interface{}
	for _, stepIndexItem := range stepIndex {
		stepIndexRule = append(stepIndexRule, stepIndexItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "ReserveStepAlert", stepIndexRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolReserveStepAlert)
				if err := _BettingPool.contract.UnpackLog(event, "ReserveStepAlert", log); err != nil {
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

// ParseReserveStepAlert is a log parse operation binding the contract event 0x733dcc3abb49225081550b067626fbacec068328d79bf99fa79e5a56be4ff4b7.
//
// Solidity: event ReserveStepAlert(uint256 indexed stepIndex, uint256 remainingReserve)
func (_BettingPool *BettingPoolFilterer) ParseReserveStepAlert(log types.Log) (*BettingPoolReserveStepAlert, error) {
	event := new(BettingPoolReserveStepAlert)
	if err := _BettingPool.contract.UnpackLog(event, "ReserveStepAlert", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolReserveTappedIterator is returned from FilterReserveTapped and is used to iterate over the raw logs and unpacked data for ReserveTapped events raised by the BettingPool contract.
type BettingPoolReserveTappedIterator struct {
	Event *BettingPoolReserveTapped // Event containing the contract specifics and raw log

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
func (it *BettingPoolReserveTappedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolReserveTapped)
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
		it.Event = new(BettingPoolReserveTapped)
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
func (it *BettingPoolReserveTappedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolReserveTappedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolReserveTapped represents a ReserveTapped event raised by the BettingPool contract.
type BettingPoolReserveTapped struct {
	MatchId          [32]byte
	TapAmount        *big.Int
	RemainingReserve *big.Int
	Raw              types.Log // Blockchain specific contextual infos
}

// FilterReserveTapped is a free log retrieval operation binding the contract event 0x41796eee73a42134294f17b02323df4876e6731b49614ab9aabce632cfe12392.
//
// Solidity: event ReserveTapped(bytes32 indexed matchId, uint256 tapAmount, uint256 remainingReserve)
func (_BettingPool *BettingPoolFilterer) FilterReserveTapped(opts *bind.FilterOpts, matchId [][32]byte) (*BettingPoolReserveTappedIterator, error) {

	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "ReserveTapped", matchIdRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolReserveTappedIterator{contract: _BettingPool.contract, event: "ReserveTapped", logs: logs, sub: sub}, nil
}

// WatchReserveTapped is a free log subscription operation binding the contract event 0x41796eee73a42134294f17b02323df4876e6731b49614ab9aabce632cfe12392.
//
// Solidity: event ReserveTapped(bytes32 indexed matchId, uint256 tapAmount, uint256 remainingReserve)
func (_BettingPool *BettingPoolFilterer) WatchReserveTapped(opts *bind.WatchOpts, sink chan<- *BettingPoolReserveTapped, matchId [][32]byte) (event.Subscription, error) {

	var matchIdRule []interface{}
	for _, matchIdItem := range matchId {
		matchIdRule = append(matchIdRule, matchIdItem)
	}

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "ReserveTapped", matchIdRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolReserveTapped)
				if err := _BettingPool.contract.UnpackLog(event, "ReserveTapped", log); err != nil {
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

// ParseReserveTapped is a log parse operation binding the contract event 0x41796eee73a42134294f17b02323df4876e6731b49614ab9aabce632cfe12392.
//
// Solidity: event ReserveTapped(bytes32 indexed matchId, uint256 tapAmount, uint256 remainingReserve)
func (_BettingPool *BettingPoolFilterer) ParseReserveTapped(log types.Log) (*BettingPoolReserveTapped, error) {
	event := new(BettingPoolReserveTapped)
	if err := _BettingPool.contract.UnpackLog(event, "ReserveTapped", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolRoleAdminChangedIterator is returned from FilterRoleAdminChanged and is used to iterate over the raw logs and unpacked data for RoleAdminChanged events raised by the BettingPool contract.
type BettingPoolRoleAdminChangedIterator struct {
	Event *BettingPoolRoleAdminChanged // Event containing the contract specifics and raw log

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
func (it *BettingPoolRoleAdminChangedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolRoleAdminChanged)
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
		it.Event = new(BettingPoolRoleAdminChanged)
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
func (it *BettingPoolRoleAdminChangedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolRoleAdminChangedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolRoleAdminChanged represents a RoleAdminChanged event raised by the BettingPool contract.
type BettingPoolRoleAdminChanged struct {
	Role              [32]byte
	PreviousAdminRole [32]byte
	NewAdminRole      [32]byte
	Raw               types.Log // Blockchain specific contextual infos
}

// FilterRoleAdminChanged is a free log retrieval operation binding the contract event 0xbd79b86ffe0ab8e8776151514217cd7cacd52c909f66475c3af44e129f0b00ff.
//
// Solidity: event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole)
func (_BettingPool *BettingPoolFilterer) FilterRoleAdminChanged(opts *bind.FilterOpts, role [][32]byte, previousAdminRole [][32]byte, newAdminRole [][32]byte) (*BettingPoolRoleAdminChangedIterator, error) {

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

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "RoleAdminChanged", roleRule, previousAdminRoleRule, newAdminRoleRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolRoleAdminChangedIterator{contract: _BettingPool.contract, event: "RoleAdminChanged", logs: logs, sub: sub}, nil
}

// WatchRoleAdminChanged is a free log subscription operation binding the contract event 0xbd79b86ffe0ab8e8776151514217cd7cacd52c909f66475c3af44e129f0b00ff.
//
// Solidity: event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole)
func (_BettingPool *BettingPoolFilterer) WatchRoleAdminChanged(opts *bind.WatchOpts, sink chan<- *BettingPoolRoleAdminChanged, role [][32]byte, previousAdminRole [][32]byte, newAdminRole [][32]byte) (event.Subscription, error) {

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

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "RoleAdminChanged", roleRule, previousAdminRoleRule, newAdminRoleRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolRoleAdminChanged)
				if err := _BettingPool.contract.UnpackLog(event, "RoleAdminChanged", log); err != nil {
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
func (_BettingPool *BettingPoolFilterer) ParseRoleAdminChanged(log types.Log) (*BettingPoolRoleAdminChanged, error) {
	event := new(BettingPoolRoleAdminChanged)
	if err := _BettingPool.contract.UnpackLog(event, "RoleAdminChanged", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolRoleGrantedIterator is returned from FilterRoleGranted and is used to iterate over the raw logs and unpacked data for RoleGranted events raised by the BettingPool contract.
type BettingPoolRoleGrantedIterator struct {
	Event *BettingPoolRoleGranted // Event containing the contract specifics and raw log

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
func (it *BettingPoolRoleGrantedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolRoleGranted)
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
		it.Event = new(BettingPoolRoleGranted)
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
func (it *BettingPoolRoleGrantedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolRoleGrantedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolRoleGranted represents a RoleGranted event raised by the BettingPool contract.
type BettingPoolRoleGranted struct {
	Role    [32]byte
	Account common.Address
	Sender  common.Address
	Raw     types.Log // Blockchain specific contextual infos
}

// FilterRoleGranted is a free log retrieval operation binding the contract event 0x2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d.
//
// Solidity: event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)
func (_BettingPool *BettingPoolFilterer) FilterRoleGranted(opts *bind.FilterOpts, role [][32]byte, account []common.Address, sender []common.Address) (*BettingPoolRoleGrantedIterator, error) {

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

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "RoleGranted", roleRule, accountRule, senderRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolRoleGrantedIterator{contract: _BettingPool.contract, event: "RoleGranted", logs: logs, sub: sub}, nil
}

// WatchRoleGranted is a free log subscription operation binding the contract event 0x2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d.
//
// Solidity: event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)
func (_BettingPool *BettingPoolFilterer) WatchRoleGranted(opts *bind.WatchOpts, sink chan<- *BettingPoolRoleGranted, role [][32]byte, account []common.Address, sender []common.Address) (event.Subscription, error) {

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

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "RoleGranted", roleRule, accountRule, senderRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolRoleGranted)
				if err := _BettingPool.contract.UnpackLog(event, "RoleGranted", log); err != nil {
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
func (_BettingPool *BettingPoolFilterer) ParseRoleGranted(log types.Log) (*BettingPoolRoleGranted, error) {
	event := new(BettingPoolRoleGranted)
	if err := _BettingPool.contract.UnpackLog(event, "RoleGranted", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolRoleRevokedIterator is returned from FilterRoleRevoked and is used to iterate over the raw logs and unpacked data for RoleRevoked events raised by the BettingPool contract.
type BettingPoolRoleRevokedIterator struct {
	Event *BettingPoolRoleRevoked // Event containing the contract specifics and raw log

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
func (it *BettingPoolRoleRevokedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolRoleRevoked)
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
		it.Event = new(BettingPoolRoleRevoked)
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
func (it *BettingPoolRoleRevokedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolRoleRevokedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolRoleRevoked represents a RoleRevoked event raised by the BettingPool contract.
type BettingPoolRoleRevoked struct {
	Role    [32]byte
	Account common.Address
	Sender  common.Address
	Raw     types.Log // Blockchain specific contextual infos
}

// FilterRoleRevoked is a free log retrieval operation binding the contract event 0xf6391f5c32d9c69d2a47ea670b442974b53935d1edc7fd64eb21e047a839171b.
//
// Solidity: event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)
func (_BettingPool *BettingPoolFilterer) FilterRoleRevoked(opts *bind.FilterOpts, role [][32]byte, account []common.Address, sender []common.Address) (*BettingPoolRoleRevokedIterator, error) {

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

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "RoleRevoked", roleRule, accountRule, senderRule)
	if err != nil {
		return nil, err
	}
	return &BettingPoolRoleRevokedIterator{contract: _BettingPool.contract, event: "RoleRevoked", logs: logs, sub: sub}, nil
}

// WatchRoleRevoked is a free log subscription operation binding the contract event 0xf6391f5c32d9c69d2a47ea670b442974b53935d1edc7fd64eb21e047a839171b.
//
// Solidity: event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)
func (_BettingPool *BettingPoolFilterer) WatchRoleRevoked(opts *bind.WatchOpts, sink chan<- *BettingPoolRoleRevoked, role [][32]byte, account []common.Address, sender []common.Address) (event.Subscription, error) {

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

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "RoleRevoked", roleRule, accountRule, senderRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolRoleRevoked)
				if err := _BettingPool.contract.UnpackLog(event, "RoleRevoked", log); err != nil {
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
func (_BettingPool *BettingPoolFilterer) ParseRoleRevoked(log types.Log) (*BettingPoolRoleRevoked, error) {
	event := new(BettingPoolRoleRevoked)
	if err := _BettingPool.contract.UnpackLog(event, "RoleRevoked", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// BettingPoolTaxBufferFundedIterator is returned from FilterTaxBufferFunded and is used to iterate over the raw logs and unpacked data for TaxBufferFunded events raised by the BettingPool contract.
type BettingPoolTaxBufferFundedIterator struct {
	Event *BettingPoolTaxBufferFunded // Event containing the contract specifics and raw log

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
func (it *BettingPoolTaxBufferFundedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(BettingPoolTaxBufferFunded)
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
		it.Event = new(BettingPoolTaxBufferFunded)
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
func (it *BettingPoolTaxBufferFundedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *BettingPoolTaxBufferFundedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// BettingPoolTaxBufferFunded represents a TaxBufferFunded event raised by the BettingPool contract.
type BettingPoolTaxBufferFunded struct {
	Amount       *big.Int
	NewTaxBuffer *big.Int
	Raw          types.Log // Blockchain specific contextual infos
}

// FilterTaxBufferFunded is a free log retrieval operation binding the contract event 0x8abb59366c26d818c719c9b15a5ba06199eb24c83ce4f14f0f0ee2d73295daae.
//
// Solidity: event TaxBufferFunded(uint256 amount, uint256 newTaxBuffer)
func (_BettingPool *BettingPoolFilterer) FilterTaxBufferFunded(opts *bind.FilterOpts) (*BettingPoolTaxBufferFundedIterator, error) {

	logs, sub, err := _BettingPool.contract.FilterLogs(opts, "TaxBufferFunded")
	if err != nil {
		return nil, err
	}
	return &BettingPoolTaxBufferFundedIterator{contract: _BettingPool.contract, event: "TaxBufferFunded", logs: logs, sub: sub}, nil
}

// WatchTaxBufferFunded is a free log subscription operation binding the contract event 0x8abb59366c26d818c719c9b15a5ba06199eb24c83ce4f14f0f0ee2d73295daae.
//
// Solidity: event TaxBufferFunded(uint256 amount, uint256 newTaxBuffer)
func (_BettingPool *BettingPoolFilterer) WatchTaxBufferFunded(opts *bind.WatchOpts, sink chan<- *BettingPoolTaxBufferFunded) (event.Subscription, error) {

	logs, sub, err := _BettingPool.contract.WatchLogs(opts, "TaxBufferFunded")
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(BettingPoolTaxBufferFunded)
				if err := _BettingPool.contract.UnpackLog(event, "TaxBufferFunded", log); err != nil {
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

// ParseTaxBufferFunded is a log parse operation binding the contract event 0x8abb59366c26d818c719c9b15a5ba06199eb24c83ce4f14f0f0ee2d73295daae.
//
// Solidity: event TaxBufferFunded(uint256 amount, uint256 newTaxBuffer)
func (_BettingPool *BettingPoolFilterer) ParseTaxBufferFunded(log types.Log) (*BettingPoolTaxBufferFunded, error) {
	event := new(BettingPoolTaxBufferFunded)
	if err := _BettingPool.contract.UnpackLog(event, "TaxBufferFunded", log); err != nil {
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
