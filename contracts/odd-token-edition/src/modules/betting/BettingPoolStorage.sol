// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

import {BetSettlementState, MarketStatus, SignalColor} from "../../shared/types/MarketEnums.sol";
import {MarketFinalResult, ParlayBet, ParlayLeg} from "../../shared/types/ParlayTypes.sol";

abstract contract BettingPoolStorage is AccessControlUpgradeable, PausableUpgradeable {
    enum SettlementResultKind {
        Settled,
        Refunded,
        Cancelled
    }

    struct MarketConfig {
        bytes32 matchId;
        uint8 marketType;
        uint8 line;
        uint8 outcomeCount;
        uint64 matchStartTime;
        uint64 lockAt;
        MarketStatus status;
        uint64 matchEndTime;
    }

    struct MarketOdds {
        uint256[] baseOdds;
        uint256[] quotedOdds;
        uint64 updatedAt;
        uint256 quoteVersion;
    }

    struct MarketExposure {
        uint256[] totalStakedByOutcome;
        SignalColor signalColor;
        uint256[] payoutByOutcome;
    }

    struct Bet {
        address owner;
        bytes32 marketId;
        uint8 outcome;
        uint256 acceptedAmount;
        uint256 refundedAmount;
        uint256 lockedOdds;
        uint32 acceptedDayBucket;
        BetSettlementState settlementState;
        uint256 claimablePayout;
        uint16 payoutTaxRateBps;
        uint16 taxAllocStakingBps;
        uint16 taxAllocTaxBufferBps;
        uint16 taxAllocReferrerBps;
        address referrerSnapshot;
    }

    struct UserRiskLedger {
        uint32 dayBucket;
        uint256 dailyAcceptedAmount;
        uint256 unsettledStake;
    }

    struct UserMarketExposure {
        uint256 potentialPayoutCommitted;
    }

    struct BetPreviewContext {
        uint32 currentDayBucket;
        uint256 acceptedAmount;
        uint256 lockedOdds;
        uint256 potentialPayout;
        uint256 availableLiquidity;
        uint256 activeStakeAmount;
        uint256 dailyLimit;
    }

    struct SettlementContext {
        uint256 totalStake;
        uint256 grossPayout;
        uint256 loserStakes;
        uint256 lpMarginShare;
        uint256 platformMarginShare;
        uint256 netLoss;
    }

    struct MarketSettlementProgress {
        bool active;
        uint16 homeScore;
        uint16 awayScore;
        uint256 processedCount;
        uint256 totalStake;
        uint256 grossPayout;
        uint256 loserStakes;
    }

    IERC20 public oddToken;
    address public stakingPool;
    address public liquidityPool;
    address public platformTreasury;

    uint256 public nextBetNonce;
    uint16 public betTaxBps;
    uint16 public payoutTaxBps;
    uint16 public taxAllocStakingBps;
    uint16 public taxAllocTaxBufferBps;
    uint16 public taxAllocReferrerBps;
    uint16 public lpMarginShareBps;

    uint256 public platformReserve;
    uint256 public accountedBalance;
    uint256 public taxBuffer;
    /// Tracks L2 LP losses that future payout-tax buffer inflows must offset before filling taxBuffer/reserve.
    /// This is an accounting priority marker only: applying it does not transfer funds back to LiquidityPool
    /// or reverse LiquidityPool lossPerPrincipal.
    uint256 public lpLossOffsetRemaining;
    uint256 public wclYellowThreshold;
    uint256 public wclOrangeThreshold;
    uint256 public wclRedThreshold;

    mapping(bytes32 => MarketConfig) internal markets;
    mapping(bytes32 => MarketOdds) internal marketOdds;
    mapping(bytes32 => MarketExposure) internal marketExposure;
    mapping(bytes32 => bytes32[]) internal matchMarketIds;
    mapping(bytes32 => bytes32[]) internal marketBetIds;
    mapping(bytes32 => Bet) internal bets;
    mapping(address => UserRiskLedger) internal userRiskLedger;
    mapping(address => mapping(bytes32 => UserMarketExposure)) internal userMarketExposure;
    mapping(address => address) public referrers;
    mapping(address => uint256) public referrerRewardsOdd;
    mapping(address => uint256) public referralClaimNonces;

    uint256 internal _reentrancyStatus;
    address public referralClaimSigner;
    uint24 public referralSwapPoolFee;
    address public settlementModule;
    address public referralSwapRouter;
    address public referralUsdtToken;
    address public referralSwapExpectedPool;
    mapping(bytes32 => MarketSettlementProgress) internal marketSettlementProgress;
    mapping(bytes32 => uint256) internal marketPreClosedBetCount;

    uint256 public nextParlayNonce;
    address public parlayModule;
    uint256 public openParlayMaxPayout;
    mapping(bytes32 => MarketFinalResult) public marketFinalResults;
    mapping(bytes32 => ParlayBet) public parlays;
    mapping(bytes32 => ParlayLeg[]) public parlayLegs;
    mapping(address => bytes32[]) internal userParlayIds;
    address public betModule;
    address public marketModule;
    address public referralModule;

    uint256[6] private __gap;

    event ReferrerBound(address indexed user, address indexed referrer);
    event ReferralRewardAccumulated(address indexed referrer, uint256 amount, address indexed from, uint8 kind);
    event ReferralClaimed(address indexed referrer, uint256 oddAmount);
    event ReferralClaimedUSDT(address indexed referrer, uint256 oddAmount, uint256 usdtAmount, uint256 currentPriceX18);
    event PlatformTreasuryUpdated(address indexed operator, address indexed treasury);
    event PayoutClaimed(
        bytes32 indexed betId, address indexed user, uint256 grossPayout, uint256 taxAmount, uint256 netPayout
    );
    event TaxBufferFunded(uint256 amount, uint256 newTaxBuffer);
    event LpLossOffsetApplied(uint256 amount, uint256 remainingOffset);
    event ReserveTapped(bytes32 indexed matchId, uint256 tapAmount, uint256 remainingReserve);
    event ReserveBelowFloor(uint256 remainingReserve);
    event ReserveStepAlert(uint256 indexed stepIndex, uint256 remainingReserve);
    event MarketOpened(
        bytes32 indexed marketId,
        bytes32 indexed matchId,
        uint8 marketType,
        uint8 line,
        uint64 matchStartTime,
        uint64 lockAt,
        uint256 quoteVersion
    );
    event MarketManuallyLocked(
        bytes32 indexed marketId,
        bytes32 indexed matchId,
        address indexed operator,
        uint64 lockedAt,
        uint256 quoteVersion
    );
    event OddsUpdated(bytes32 indexed marketId, uint64 updatedAt, uint256 quoteVersion, uint8 signal);
    event BetPlaced(
        bytes32 indexed betId,
        bytes32 indexed marketId,
        address indexed user,
        uint256 requestedAmount,
        uint256 acceptedAmount,
        uint256 lockedOdds,
        uint256 quoteVersion,
        uint8 outcome
    );
    event BetRefunded(
        bytes32 indexed betId,
        bytes32 indexed marketId,
        address indexed user,
        uint256 refundAmount,
        uint8 reason,
        uint256 quoteVersion
    );
    event BetCashedOut(
        bytes32 indexed betId,
        bytes32 indexed marketId,
        address indexed user,
        uint256 remainingStake,
        uint256 cashOutAmount,
        uint256 currentOdds,
        uint16 feeBps,
        uint256 quoteVersion
    );
    event MarketSettlementScoreBatchProcessed(
        bytes32 indexed marketId, uint16 homeScore, uint16 awayScore, uint256 processedCount, uint256 totalBetCount
    );
    event MarketSettlementFinalized(
        bytes32 indexed marketId,
        uint8 resultKind,
        bool scoreSettled,
        uint16 homeScore,
        uint16 awayScore,
        uint256 grossPayout,
        uint256 lpMarginShare,
        uint256 platformMarginShare,
        uint256 quoteVersion
    );
    event BetClaimed(
        bytes32 indexed betId, bytes32 indexed marketId, address indexed user, uint256 payout, address executor
    );
    event PlatformReserveUpdated(int256 delta, uint256 newBalance, uint8 reason);
    event BetModuleUpdated(address indexed oldModule, address indexed newModule);
    event MarketModuleUpdated(address indexed oldModule, address indexed newModule);
    event ReferralModuleUpdated(address indexed oldModule, address indexed newModule);
    event ReferralSwapConfigUpdated(address indexed router, address indexed usdtToken, address indexed expectedPool);
    event ParlayModuleUpdated(address indexed oldModule, address indexed newModule);
    event ParlayPlaced(
        bytes32 indexed parlayId,
        address indexed user,
        uint256 stake,
        uint256 betTax,
        uint256 totalDeduct,
        uint8 legCount,
        uint256 lockedComboOdds,
        uint256 maxPayout,
        bytes32 indexed parlayRiskId
    );
    event ParlayLegExposureReserved(
        bytes32 indexed parlayId, bytes32 indexed marketId, uint8 outcome, uint256 syntheticPayout
    );
    event ParlaySettled(
        bytes32 indexed parlayId,
        address indexed user,
        uint8 state,
        uint256 grossPayout,
        uint256 marginBase,
        uint256 lpMarginShare,
        uint256 platformMarginShare,
        uint256 lpLossBooked,
        bytes32 indexed parlayRiskId
    );
    event ParlayPayoutClaimed(
        bytes32 indexed parlayId, address indexed user, uint256 grossPayout, uint256 taxAmount, uint256 netPayout
    );
    event MarketFinalResultRecorded(
        bytes32 indexed marketId, uint8 resultKind, bool scoreSettled, uint16 homeScore, uint16 awayScore
    );
}
