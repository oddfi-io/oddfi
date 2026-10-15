// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {Roles} from "../../shared/access/Roles.sol";
import {PrecisionConstants} from "../../shared/constants/PrecisionConstants.sol";
import {StakingConstants} from "../../shared/constants/StakingConstants.sol";
import {InvalidAddress} from "../../shared/errors/CommonErrors.sol";
import {
    StakeBelowMinimum,
    InvalidStakePlan,
    StakePositionNotOwner,
    PositionNotActive,
    PositionNotMatured,
    PositionAlreadyMatured,
    RewardSourceForbidden
} from "../../shared/errors/StakingErrors.sol";
import {StakeSourceType} from "../../shared/types/StakingEnums.sol";
import {IODDTokenBusiness} from "../token/interfaces/IODDTokenBusiness.sol";
import {IODDTokenTreasuryView} from "../token/interfaces/IODDTokenTreasuryView.sol";
import {TokenBusinessTypes} from "../token/TokenBusinessTypes.sol";
import {IStakingPoolViewV1} from "./interfaces/IStakingPoolViewV1.sol";

contract StakingPool is AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable, IStakingPoolViewV1 {
    using SafeERC20 for IERC20;

    struct StakePosition {
        address owner;
        uint256 principal;
        uint256 weight;
        uint64 unlockAt;
        uint256 rewardDebt;
        uint16 planId;
        StakeSourceType sourceType;
        bool active;
    }

    IERC20 public oddToken;
    address public platformTreasury;
    address public bettingPool;
    uint256 public minStakeAmount;

    uint256 public nextPositionId;
    uint256 public accRewardPerShare;
    uint256 public totalWeightedShares;
    uint256 public accountedOddBalance;

    mapping(uint256 => StakePosition) public positions;
    mapping(address => uint256) public activeStakeAmount;

    uint256 private _reentrancyStatus;
    uint256[11] private _vipThresholds;
    uint256[11] private _vipDailyLimits;

    uint256[22] private __gap;

    event StakingInitialized(address indexed admin, address indexed oddToken, address indexed treasury);
    event StakeCreated(
        uint256 indexed positionId,
        address indexed user,
        uint256 principal,
        uint16 planId,
        uint8 sourceType,
        uint256 weight,
        uint64 unlockAt
    );
    event StakeWithdrawn(
        uint256 indexed positionId, address indexed user, uint256 principal, uint256 reward, bool early
    );
    event RewardNotified(address indexed caller, uint256 amount, uint256 newAccRewardPerShare);
    event RewardRedirectedToPlatform(address indexed caller, uint256 amount, address indexed treasury);
    event StakingConfigUpdated(address indexed operator, address indexed treasury);
    event BettingPoolUpdated(address indexed operator, address indexed bettingPool);
    event MinStakeAmountUpdated(address indexed operator, uint256 oldAmount, uint256 newAmount);
    event VipConfigUpdated(address indexed operator, bytes32 configHash);
    event VipTierConfigUpdated(address indexed operator, uint8 indexed tier, uint256 threshold, uint256 dailyLimit);
    event StakeAccountingSnapshot(
        uint256 indexed positionId,
        address indexed user,
        uint8 actionKind,
        uint256 activeStakeAfter,
        uint256 totalWeightedSharesAfter,
        uint256 accountedOddBalanceAfter,
        uint256 accRewardPerShareAfter
    );

    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    modifier onlyBettingPool() {
        _requireBettingPool();
        _;
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, address oddTokenAddress, address initialPlatformTreasury) external initializer {
        if (admin == address(0) || oddTokenAddress == address(0) || initialPlatformTreasury == address(0)) {
            revert InvalidAddress();
        }

        __AccessControl_init();
        __Pausable_init();

        _grantRole(Roles.DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Roles.UPGRADER_ROLE, admin);
        _grantRole(Roles.PAUSER_ROLE, admin);

        oddToken = IERC20(oddTokenAddress);
        platformTreasury = initialPlatformTreasury;
        minStakeAmount = StakingConstants.MIN_STAKE_AMOUNT;
        nextPositionId = 1;
        _reentrancyStatus = 1;
        _setDefaultVipConfig();

        emit StakingInitialized(admin, oddTokenAddress, initialPlatformTreasury);
        emit StakingConfigUpdated(admin, initialPlatformTreasury);
        emit VipConfigUpdated(admin, _vipConfigHash());
    }

    function initializeV2(address initialBettingPool) external reinitializer(2) onlyRole(Roles.DEFAULT_ADMIN_ROLE) {
        if (initialBettingPool == address(0)) {
            revert InvalidAddress();
        }
        bettingPool = initialBettingPool;
        emit BettingPoolUpdated(msg.sender, initialBettingPool);
    }

    function stake(uint256 amount, uint16 planId) external nonReentrant whenNotPaused returns (uint256 positionId) {
        if (amount < minStakeAmount) {
            revert StakeBelowMinimum(amount, minStakeAmount);
        }

        (uint16 lockDays, uint32 multiplierBps) = _stakePlan(planId);
        uint256 weight = amount * multiplierBps / PrecisionConstants.BPS_SCALE;
        uint64 unlockAt = uint64(block.timestamp + uint256(lockDays) * PrecisionConstants.SECONDS_PER_DAY);

        positionId = _createPosition(msg.sender, amount, weight, unlockAt, planId, StakeSourceType.Manual);
        IODDTokenBusiness(address(oddToken))
            .consumeBusinessInflow(msg.sender, TokenBusinessTypes.STAKING_POSITION, bytes32(positionId), amount);
        accountedOddBalance += amount;
        emit StakeAccountingSnapshot(
            positionId,
            msg.sender,
            0,
            activeStakeAmount[msg.sender],
            totalWeightedShares,
            accountedOddBalance,
            accRewardPerShare
        );
    }

    function notifyReward(uint256 amount) external nonReentrant onlyBettingPool {
        if (amount == 0) {
            revert StakeBelowMinimum(0, 1);
        }
        if (oddToken.balanceOf(address(this)) < accountedOddBalance + amount) {
            revert RewardSourceForbidden(msg.sender);
        }

        accountedOddBalance += amount;

        if (totalWeightedShares == 0) {
            accountedOddBalance -= amount;
            oddToken.safeTransfer(platformTreasury, amount);
            emit RewardRedirectedToPlatform(msg.sender, amount, platformTreasury);
            emit StakeAccountingSnapshot(
                0,
                msg.sender,
                3,
                activeStakeAmount[msg.sender],
                totalWeightedShares,
                accountedOddBalance,
                accRewardPerShare
            );
            return;
        }

        accRewardPerShare += amount * PrecisionConstants.ODD_WAD / totalWeightedShares;
        emit RewardNotified(msg.sender, amount, accRewardPerShare);
        emit StakeAccountingSnapshot(
            0, msg.sender, 2, activeStakeAmount[msg.sender], totalWeightedShares, accountedOddBalance, accRewardPerShare
        );
    }

    function unstake(uint256 positionId) external nonReentrant whenNotPaused {
        StakePosition storage position = positions[positionId];
        _validateOwnedActivePosition(positionId, position);
        if (block.timestamp < position.unlockAt) {
            revert PositionNotMatured(positionId, position.unlockAt, block.timestamp);
        }

        uint256 pendingReward = _pendingReward(position);
        _deactivatePosition(positionId, position);
        accountedOddBalance -= position.principal + pendingReward;
        IODDTokenBusiness(address(oddToken))
            .registerBusinessOutcomeDelta(
                position.owner, _positionBusinessId(positionId), position.principal + pendingReward, true
            );
        emit StakeWithdrawn(positionId, position.owner, position.principal, pendingReward, false);
        emit StakeAccountingSnapshot(
            positionId,
            position.owner,
            4,
            activeStakeAmount[position.owner],
            totalWeightedShares,
            accountedOddBalance,
            accRewardPerShare
        );
    }

    function earlyUnstake(uint256 positionId) external nonReentrant whenNotPaused {
        StakePosition storage position = positions[positionId];
        _validateOwnedActivePosition(positionId, position);
        if (block.timestamp >= position.unlockAt) {
            revert PositionAlreadyMatured(positionId);
        }

        uint256 pendingReward = _pendingReward(position);
        _deactivatePosition(positionId, position);
        accountedOddBalance -= position.principal;
        IODDTokenBusiness(address(oddToken))
            .registerBusinessOutcomeDelta(position.owner, _positionBusinessId(positionId), position.principal, true);

        if (pendingReward > 0) {
            if (totalWeightedShares > 0) {
                accRewardPerShare += pendingReward * PrecisionConstants.ODD_WAD / totalWeightedShares;
                emit RewardNotified(msg.sender, pendingReward, accRewardPerShare);
            } else {
                accountedOddBalance -= pendingReward;
                oddToken.safeTransfer(platformTreasury, pendingReward);
                emit RewardRedirectedToPlatform(msg.sender, pendingReward, platformTreasury);
            }
        }

        emit StakeWithdrawn(positionId, position.owner, position.principal, pendingReward, true);
        emit StakeAccountingSnapshot(
            positionId,
            position.owner,
            5,
            activeStakeAmount[position.owner],
            totalWeightedShares,
            accountedOddBalance,
            accRewardPerShare
        );
    }

    function setPlatformTreasury(address newPlatformTreasury) external onlyRole(Roles.DEFAULT_ADMIN_ROLE) {
        if (
            newPlatformTreasury == address(0)
                || !IODDTokenTreasuryView(address(oddToken)).isTreasurySink(newPlatformTreasury)
        ) {
            revert InvalidAddress();
        }
        platformTreasury = newPlatformTreasury;
        emit StakingConfigUpdated(msg.sender, newPlatformTreasury);
    }

    function setBettingPool(address newBettingPool) external onlyRole(Roles.DEFAULT_ADMIN_ROLE) {
        if (newBettingPool == address(0)) {
            revert InvalidAddress();
        }
        bettingPool = newBettingPool;
        emit BettingPoolUpdated(msg.sender, newBettingPool);
    }

    function setMinStakeAmount(uint256 newMinStakeAmount) external onlyRole(Roles.DEFAULT_ADMIN_ROLE) {
        if (newMinStakeAmount == 0) {
            revert StakeBelowMinimum(0, 1);
        }
        emit MinStakeAmountUpdated(msg.sender, minStakeAmount, newMinStakeAmount);
        minStakeAmount = newMinStakeAmount;
    }

    function setVipTierConfig(uint8 tier, uint256 threshold, uint256 dailyLimit)
        external
        onlyRole(Roles.DEFAULT_ADMIN_ROLE)
    {
        if (tier >= 11) {
            revert InvalidStakePlan(tier);
        }
        if (tier == 0 && threshold != 0) {
            revert InvalidStakePlan(tier);
        }
        if (tier > 0 && threshold < _vipThresholds[tier - 1]) {
            revert InvalidStakePlan(tier);
        }
        if (tier < 10 && threshold > _vipThresholds[tier + 1]) {
            revert InvalidStakePlan(tier);
        }
        if (tier > 0 && dailyLimit < _vipDailyLimits[tier - 1]) {
            revert InvalidStakePlan(tier);
        }
        if (tier < 10 && dailyLimit > _vipDailyLimits[tier + 1]) {
            revert InvalidStakePlan(tier);
        }

        _vipThresholds[tier] = threshold;
        _vipDailyLimits[tier] = dailyLimit;
        emit VipTierConfigUpdated(msg.sender, tier, threshold, dailyLimit);
        emit VipConfigUpdated(msg.sender, _vipConfigHash());
    }

    function pause() external onlyRole(Roles.PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(Roles.PAUSER_ROLE) {
        _unpause();
    }

    function getActiveStakeAmount(address user) external view returns (uint256) {
        return activeStakeAmount[user];
    }

    function getUserTier(address user) external view returns (uint8) {
        return _tierFor(activeStakeAmount[user]);
    }

    function getUserDailyLimit(address user) external view returns (uint256) {
        uint8 tier = _tierFor(activeStakeAmount[user]);
        return _vipDailyLimits[tier];
    }

    function isActiveStaker(address user) external view returns (bool) {
        return activeStakeAmount[user] > 0;
    }

    function _createPosition(
        address owner,
        uint256 principal,
        uint256 weight,
        uint64 unlockAt,
        uint16 planId,
        StakeSourceType sourceType
    ) internal returns (uint256 positionId) {
        positionId = nextPositionId++;
        positions[positionId] = StakePosition({
            owner: owner,
            principal: principal,
            weight: weight,
            unlockAt: unlockAt,
            rewardDebt: accRewardPerShare,
            planId: planId,
            sourceType: sourceType,
            active: true
        });

        totalWeightedShares += weight;
        activeStakeAmount[owner] += principal;

        emit StakeCreated(positionId, owner, principal, planId, uint8(sourceType), weight, unlockAt);
    }

    function _validateOwnedActivePosition(uint256 positionId, StakePosition storage position) internal view {
        if (position.owner != msg.sender) {
            revert StakePositionNotOwner(positionId, msg.sender);
        }
        if (!position.active) {
            revert PositionNotActive(positionId);
        }
    }

    function _deactivatePosition(uint256, StakePosition storage position) internal {
        position.active = false;
        totalWeightedShares -= position.weight;
        activeStakeAmount[position.owner] -= position.principal;
    }

    function _pendingReward(StakePosition storage position) internal view returns (uint256) {
        return position.weight * (accRewardPerShare - position.rewardDebt) / PrecisionConstants.ODD_WAD;
    }

    function _positionBusinessId(uint256 positionId) internal view returns (bytes32) {
        return keccak256(abi.encode(address(this), TokenBusinessTypes.STAKING_POSITION, bytes32(positionId)));
    }

    function _stakePlan(uint16 planId) internal pure returns (uint16 lockDays, uint32 multiplierBps) {
        if (planId == 0) {
            return (StakingConstants.STAKE_PLAN_0_LOCK_DAYS, StakingConstants.STAKE_PLAN_0_MULTIPLIER_BPS);
        }
        if (planId == 1) {
            return (StakingConstants.STAKE_PLAN_1_LOCK_DAYS, StakingConstants.STAKE_PLAN_1_MULTIPLIER_BPS);
        }
        if (planId == 2) {
            return (StakingConstants.STAKE_PLAN_2_LOCK_DAYS, StakingConstants.STAKE_PLAN_2_MULTIPLIER_BPS);
        }
        if (planId == 3) {
            return (StakingConstants.STAKE_PLAN_3_LOCK_DAYS, StakingConstants.STAKE_PLAN_3_MULTIPLIER_BPS);
        }
        if (planId == 4) {
            return (StakingConstants.STAKE_PLAN_4_LOCK_DAYS, StakingConstants.STAKE_PLAN_4_MULTIPLIER_BPS);
        }
        if (planId == 5) {
            return (StakingConstants.STAKE_PLAN_5_LOCK_DAYS, StakingConstants.STAKE_PLAN_5_MULTIPLIER_BPS);
        }
        revert InvalidStakePlan(planId);
    }

    function _vipConfigHash() internal view returns (bytes32) {
        return keccak256(abi.encode(_vipThresholds, _vipDailyLimits, minStakeAmount));
    }

    function _authorizeUpgrade(address) internal view override onlyRole(Roles.UPGRADER_ROLE) {}

    function _nonReentrantBefore() internal {
        if (_reentrancyStatus == 2) revert RewardSourceForbidden(msg.sender);
        _reentrancyStatus = 2;
    }

    function _nonReentrantAfter() internal {
        _reentrancyStatus = 1;
    }

    function _requireBettingPool() internal view {
        if (msg.sender != bettingPool) {
            revert RewardSourceForbidden(msg.sender);
        }
    }

    function _setDefaultVipConfig() internal {
        _vipThresholds[0] = StakingConstants.VIP_THRESHOLD_0;
        _vipThresholds[1] = StakingConstants.VIP_THRESHOLD_1;
        _vipThresholds[2] = StakingConstants.VIP_THRESHOLD_2;
        _vipThresholds[3] = StakingConstants.VIP_THRESHOLD_3;
        _vipThresholds[4] = StakingConstants.VIP_THRESHOLD_4;
        _vipThresholds[5] = StakingConstants.VIP_THRESHOLD_5;
        _vipThresholds[6] = StakingConstants.VIP_THRESHOLD_6;
        _vipThresholds[7] = StakingConstants.VIP_THRESHOLD_7;
        _vipThresholds[8] = StakingConstants.VIP_THRESHOLD_8;
        _vipThresholds[9] = StakingConstants.VIP_THRESHOLD_9;
        _vipThresholds[10] = StakingConstants.VIP_THRESHOLD_10;

        _vipDailyLimits[0] = StakingConstants.VIP_DAILY_LIMIT_0;
        _vipDailyLimits[1] = StakingConstants.VIP_DAILY_LIMIT_1;
        _vipDailyLimits[2] = StakingConstants.VIP_DAILY_LIMIT_2;
        _vipDailyLimits[3] = StakingConstants.VIP_DAILY_LIMIT_3;
        _vipDailyLimits[4] = StakingConstants.VIP_DAILY_LIMIT_4;
        _vipDailyLimits[5] = StakingConstants.VIP_DAILY_LIMIT_5;
        _vipDailyLimits[6] = StakingConstants.VIP_DAILY_LIMIT_6;
        _vipDailyLimits[7] = StakingConstants.VIP_DAILY_LIMIT_7;
        _vipDailyLimits[8] = StakingConstants.VIP_DAILY_LIMIT_8;
        _vipDailyLimits[9] = StakingConstants.VIP_DAILY_LIMIT_9;
        _vipDailyLimits[10] = StakingConstants.VIP_DAILY_LIMIT_10;
    }

    function _tierFor(uint256 amount) internal view returns (uint8) {
        for (uint8 tier = 10; tier > 0; --tier) {
            if (amount >= _vipThresholds[tier]) return tier;
        }
        return 0;
    }
}
