// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {Roles} from "../../shared/access/Roles.sol";
import {PrecisionConstants} from "../../shared/constants/PrecisionConstants.sol";
import {LiquidityConstants} from "../../shared/constants/LiquidityConstants.sol";
import {InvalidAddress} from "../../shared/errors/CommonErrors.sol";
import {
    DepositBelowMinimum,
    InvalidLiquidityPlan,
    MatchPoolDepositsClosed,
    LpPositionNotOwner,
    PositionNotUnbondable,
    EpochNotReady,
    PayoutWindowExceeded,
    InvalidMatchPoolLifecycle,
    MatchNotTerminal,
    BettingPoolOnly
} from "../../shared/errors/LiquidityErrors.sol";
import {LpPositionState, PoolType} from "../../shared/types/LiquidityEnums.sol";
import {IODDTokenBusiness} from "../token/interfaces/IODDTokenBusiness.sol";
import {TokenBusinessTypes} from "../token/TokenBusinessTypes.sol";
import {IBettingMatchViewV1} from "./interfaces/IBettingMatchViewV1.sol";

contract LiquidityPool is AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    struct Pool {
        PoolType poolType;
        bytes32 matchId;
        bool exists;
        bool depositOpen;
        uint64 depositCloseAt;
        uint64 unlockAt;
        uint256 totalDeposited;
        uint256 totalWeight;
        uint256 rewardPerWeight;
        uint256 lossPerPrincipal;
    }

    struct LpPosition {
        address owner;
        uint256 poolId;
        uint256 principal;
        uint256 weight;
        uint64 unlockAt;
        uint256 rewardDebt;
        uint256 lossDebt;
        uint32 unbondingEpoch;
        uint256 frozenRewardPerWeight;
        uint256 frozenLossPerPrincipal;
        uint16 planId;
        LpPositionState state;
    }

    struct PayoutLiquidityWindow {
        bytes32 matchId;
        uint256 reservedAmount;
        uint256 paidOutAmount;
        uint64 settledAt;
    }

    IERC20 public oddToken;
    address public bettingPool;
    uint64 public epochStart;
    uint256 public minDeposit;
    uint32 public unbondEpochs;

    uint256 public nextLpPositionId;
    uint256 public totalActiveDeposited;
    uint256 public totalOutstandingPayoutReserved;

    mapping(uint256 => Pool) public pools;
    mapping(uint256 => LpPosition) public positions;
    mapping(bytes32 => PayoutLiquidityWindow) public payoutWindows;

    uint256 private _reentrancyStatus;
    uint256 public requestableLiquidity;
    uint256 public globalRequestableLiquidity;
    bool public globalRequestableLiquidityInitialized;

    uint256[40] private __gap;

    event MatchPoolOpened(bytes32 indexed matchId, uint256 indexed poolId, uint64 matchEndTime, uint64 depositCloseAt);
    event LiquidityConfigUpdated(address indexed operator, address indexed newBettingPool);
    event MinDepositUpdated(address indexed operator, uint256 oldAmount, uint256 newAmount);
    event UnbondEpochsUpdated(address indexed operator, uint32 oldEpochs, uint32 newEpochs);
    event MatchPoolDepositClosed(bytes32 indexed matchId, uint256 indexed poolId, uint8 reason);
    event LiquidityDeposited(
        uint256 indexed positionId,
        uint256 indexed poolId,
        address indexed user,
        uint256 amount,
        uint256 weight,
        uint16 planId,
        uint64 unlockAt
    );
    event MarginDistributed(bytes32 indexed matchId, uint256 lpMarginShare, uint256 globalShare, uint256 matchShare);
    event GlobalMarginDistributed(bytes32 indexed riskId, uint256 lpMarginShare);
    event LossDistributed(
        bytes32 indexed matchId, uint256 lpLossBooked, uint256 globalLossShare, uint256 matchLossShare
    );
    event GlobalLossDistributed(bytes32 indexed riskId, uint256 lpLossBooked);
    event PayoutLiquidityReserved(
        bytes32 indexed matchId, uint256 reservedAmount, uint256 paidOutAmount, uint64 settledAt
    );
    event PayoutReserveOutstanding(bytes32 indexed matchId, uint256 outstandingAmount);
    event PayoutReserveReleased(
        bytes32 indexed matchId,
        uint256 releasedAmount,
        uint256 globalShare,
        uint256 matchShare,
        uint256 reservedAmount,
        uint256 paidOutAmount
    );
    event UnbondRequested(
        uint256 indexed positionId,
        address indexed user,
        uint32 unbondingEpoch,
        uint256 frozenRewardPerWeight,
        uint256 frozenLossPerPrincipal
    );
    event LiquidityWithdrawn(
        uint256 indexed positionId, address indexed user, uint256 withdrawAmount, uint8 finalState, int256 netPnl
    );
    event PayoutLiquidityTransferred(bytes32 indexed matchId, uint256 amount, uint256 newPaidOutAmount);
    event LiquidityPositionStateChanged(
        uint256 indexed positionId,
        address indexed user,
        uint8 previousState,
        uint8 newState,
        uint256 principal,
        uint256 weight
    );
    event LiquidityAccountingSnapshot(
        bytes32 indexed matchId,
        uint256 indexed poolId,
        uint256 indexed positionId,
        uint8 actionKind,
        uint256 requestableLiquidityAfter,
        uint256 totalActiveDepositedAfter,
        uint256 totalOutstandingPayoutReservedAfter,
        uint256 poolTotalDepositedAfter,
        uint256 poolTotalWeightAfter
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

    function initialize(address admin, address oddTokenAddress, address initialBettingPool) external initializer {
        if (admin == address(0) || oddTokenAddress == address(0) || initialBettingPool == address(0)) {
            revert InvalidAddress();
        }

        __AccessControl_init();
        __Pausable_init();

        _grantRole(Roles.DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Roles.UPGRADER_ROLE, admin);
        _grantRole(Roles.PAUSER_ROLE, admin);

        oddToken = IERC20(oddTokenAddress);
        bettingPool = initialBettingPool;
        epochStart = uint64(block.timestamp / PrecisionConstants.SECONDS_PER_DAY * PrecisionConstants.SECONDS_PER_DAY);
        minDeposit = LiquidityConstants.MIN_LP_DEPOSIT;
        unbondEpochs = uint32(LiquidityConstants.UNBOND_EPOCHS);
        nextLpPositionId = 1;
        _reentrancyStatus = 1;
        requestableLiquidity = 0;
        globalRequestableLiquidityInitialized = true;

        pools[0] = Pool({
            poolType: PoolType.Global,
            matchId: bytes32(0),
            exists: true,
            depositOpen: true,
            depositCloseAt: 0,
            unlockAt: 0,
            totalDeposited: 0,
            totalWeight: 0,
            rewardPerWeight: 0,
            lossPerPrincipal: 0
        });

        emit LiquidityConfigUpdated(admin, initialBettingPool);
    }

    function setBettingPool(address newBettingPool) external onlyRole(Roles.DEFAULT_ADMIN_ROLE) {
        if (newBettingPool == address(0)) {
            revert InvalidAddress();
        }
        bettingPool = newBettingPool;
        emit LiquidityConfigUpdated(msg.sender, newBettingPool);
    }

    function setMinDeposit(uint256 newMinDeposit) external onlyRole(Roles.DEFAULT_ADMIN_ROLE) {
        if (newMinDeposit == 0) {
            revert DepositBelowMinimum(0, 1);
        }
        emit MinDepositUpdated(msg.sender, minDeposit, newMinDeposit);
        minDeposit = newMinDeposit;
    }

    function setUnbondEpochs(uint32 newUnbondEpochs) external onlyRole(Roles.DEFAULT_ADMIN_ROLE) {
        if (newUnbondEpochs == 0) {
            revert EpochNotReady(0, 1);
        }
        emit UnbondEpochsUpdated(msg.sender, unbondEpochs, newUnbondEpochs);
        unbondEpochs = newUnbondEpochs;
    }

    function depositGlobal(uint256 amount, uint16 planId)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 positionId)
    {
        if (amount < minDeposit) {
            revert DepositBelowMinimum(amount, minDeposit);
        }
        (uint16 lockDays,) = _globalPlan(planId);
        Pool storage pool = pools[0];
        if (!pool.depositOpen) {
            revert InvalidMatchPoolLifecycle(bytes32(0));
        }

        // v2 accounting uses principal-based weight; lock multipliers remain display-only.
        uint256 weight = amount;
        uint64 unlockAt = uint64(block.timestamp + uint256(lockDays) * PrecisionConstants.SECONDS_PER_DAY);
        positionId = _createPosition(msg.sender, 0, amount, weight, unlockAt, planId);

        pool.totalDeposited += amount;
        pool.totalWeight += weight;
        totalActiveDeposited += amount;
        requestableLiquidity += amount;
        globalRequestableLiquidity += amount;

        IODDTokenBusiness(address(oddToken))
            .consumeBusinessInflow(msg.sender, TokenBusinessTypes.LP_POSITION, bytes32(positionId), amount);
        emit LiquidityDeposited(positionId, 0, msg.sender, amount, weight, planId, unlockAt);
        emit LiquidityAccountingSnapshot(
            bytes32(0),
            0,
            positionId,
            0,
            requestableLiquidity,
            totalActiveDeposited,
            totalOutstandingPayoutReserved,
            pool.totalDeposited,
            pool.totalWeight
        );
    }

    function depositMatch(bytes32 matchId, uint256 amount)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 positionId)
    {
        if (amount < minDeposit) {
            revert DepositBelowMinimum(amount, minDeposit);
        }

        uint256 poolId = _matchPoolId(matchId);
        Pool storage pool = pools[poolId];
        if (!pool.exists || pool.poolType != PoolType.Match) {
            revert InvalidMatchPoolLifecycle(matchId);
        }
        if (!pool.depositOpen || block.timestamp >= pool.depositCloseAt) {
            revert MatchPoolDepositsClosed(matchId);
        }

        uint256 weight = amount * LiquidityConstants.MATCH_POOL_MULTIPLIER_BPS / PrecisionConstants.BPS_SCALE;
        positionId = _createPosition(msg.sender, poolId, amount, weight, pool.unlockAt, 0);

        pool.totalDeposited += amount;
        pool.totalWeight += weight;
        totalActiveDeposited += amount;
        requestableLiquidity += amount;

        IODDTokenBusiness(address(oddToken))
            .consumeBusinessInflow(msg.sender, TokenBusinessTypes.LP_POSITION, bytes32(positionId), amount);
        emit LiquidityDeposited(positionId, poolId, msg.sender, amount, weight, 0, pool.unlockAt);
        emit LiquidityAccountingSnapshot(
            matchId,
            poolId,
            positionId,
            1,
            requestableLiquidity,
            totalActiveDeposited,
            totalOutstandingPayoutReserved,
            pool.totalDeposited,
            pool.totalWeight
        );
    }

    function openMatchPool(bytes32 matchId, uint64 matchStartTime, uint64 matchEndTime) external onlyBettingPool {
        if (matchId == bytes32(0) || matchStartTime == 0 || matchEndTime <= matchStartTime) {
            revert InvalidMatchPoolLifecycle(matchId);
        }

        uint256 poolId = _matchPoolId(matchId);
        if (pools[poolId].exists) {
            revert InvalidMatchPoolLifecycle(matchId);
        }

        pools[poolId] = Pool({
            poolType: PoolType.Match,
            matchId: matchId,
            exists: true,
            depositOpen: true,
            depositCloseAt: matchStartTime,
            unlockAt: matchEndTime,
            totalDeposited: 0,
            totalWeight: 0,
            rewardPerWeight: 0,
            lossPerPrincipal: 0
        });

        emit MatchPoolOpened(matchId, poolId, matchEndTime, matchStartTime);
        emit LiquidityAccountingSnapshot(
            matchId, poolId, 0, 2, requestableLiquidity, totalActiveDeposited, totalOutstandingPayoutReserved, 0, 0
        );
    }

    function closeMatchPoolDeposit(bytes32 matchId) external onlyBettingPool {
        uint256 poolId = _matchPoolId(matchId);
        Pool storage pool = pools[poolId];
        if (!pool.exists || pool.poolType != PoolType.Match) {
            revert InvalidMatchPoolLifecycle(matchId);
        }

        pool.depositOpen = false;
        emit MatchPoolDepositClosed(matchId, poolId, 0);
        emit LiquidityAccountingSnapshot(
            matchId,
            poolId,
            0,
            3,
            requestableLiquidity,
            totalActiveDeposited,
            totalOutstandingPayoutReserved,
            pool.totalDeposited,
            pool.totalWeight
        );
    }

    function distributeMargin(bytes32 matchId, uint256 lpMarginShare) external onlyBettingPool {
        uint256 poolId = _matchPoolId(matchId);
        Pool storage globalPool = pools[0];
        Pool storage matchPool = pools[poolId];
        if (!matchPool.exists) {
            revert InvalidMatchPoolLifecycle(matchId);
        }

        uint256 wg = globalPool.totalWeight;
        uint256 wm = matchPool.totalWeight;
        if (wg + wm == 0 || lpMarginShare == 0) {
            emit MarginDistributed(matchId, lpMarginShare, 0, 0);
            emit LiquidityAccountingSnapshot(
                matchId,
                poolId,
                0,
                4,
                requestableLiquidity,
                totalActiveDeposited,
                totalOutstandingPayoutReserved,
                matchPool.totalDeposited,
                matchPool.totalWeight
            );
            return;
        }

        uint256 globalShare;
        uint256 matchShare;
        if (wg == 0) {
            matchShare = lpMarginShare;
        } else if (wm == 0) {
            globalShare = lpMarginShare;
        } else {
            globalShare = lpMarginShare * wg / (wg + wm);
            matchShare = lpMarginShare - globalShare;
        }

        if (globalShare > 0 && wg > 0) {
            globalPool.rewardPerWeight += globalShare * PrecisionConstants.ODD_WAD / wg;
            globalRequestableLiquidity += globalShare;
        }
        if (matchShare > 0 && wm > 0) {
            matchPool.rewardPerWeight += matchShare * PrecisionConstants.ODD_WAD / wm;
        }
        requestableLiquidity += lpMarginShare;

        emit MarginDistributed(matchId, lpMarginShare, globalShare, matchShare);
        emit LiquidityAccountingSnapshot(
            matchId,
            poolId,
            0,
            4,
            requestableLiquidity,
            totalActiveDeposited,
            totalOutstandingPayoutReserved,
            matchPool.totalDeposited,
            matchPool.totalWeight
        );
    }

    function distributeLoss(bytes32 matchId, uint256 netLoss) external onlyBettingPool returns (uint256 lpLossBooked) {
        uint256 poolId = _matchPoolId(matchId);
        Pool storage globalPool = pools[0];
        Pool storage matchPool = pools[poolId];
        if (!matchPool.exists) {
            revert InvalidMatchPoolLifecycle(matchId);
        }

        uint256 g = globalPool.totalDeposited;
        uint256 m = matchPool.totalDeposited;
        uint256 totalActive = g + m;
        if (totalActive == 0 || requestableLiquidity == 0) {
            _setReservedAmount(matchId, 0);
            emit LossDistributed(matchId, 0, 0, 0);
            emit LiquidityAccountingSnapshot(
                matchId,
                poolId,
                0,
                5,
                requestableLiquidity,
                totalActiveDeposited,
                totalOutstandingPayoutReserved,
                matchPool.totalDeposited,
                matchPool.totalWeight
            );
            return 0;
        }

        lpLossBooked = netLoss > requestableLiquidity ? requestableLiquidity : netLoss;
        uint256 globalLossShare;
        uint256 matchLossShare;
        if (g == 0) {
            matchLossShare = lpLossBooked;
        } else if (m == 0) {
            globalLossShare = lpLossBooked;
        } else {
            globalLossShare = lpLossBooked * g / totalActive;
            matchLossShare = lpLossBooked - globalLossShare;
        }

        if (globalLossShare > 0 && g > 0) {
            globalPool.lossPerPrincipal += globalLossShare * PrecisionConstants.ODD_WAD / g;
            globalRequestableLiquidity =
                globalLossShare >= globalRequestableLiquidity ? 0 : globalRequestableLiquidity - globalLossShare;
        }
        if (matchLossShare > 0 && m > 0) {
            matchPool.lossPerPrincipal += matchLossShare * PrecisionConstants.ODD_WAD / m;
        }

        requestableLiquidity -= lpLossBooked;
        _setReservedAmount(matchId, lpLossBooked);
        emit LossDistributed(matchId, lpLossBooked, globalLossShare, matchLossShare);
        emit LiquidityAccountingSnapshot(
            matchId,
            poolId,
            0,
            5,
            requestableLiquidity,
            totalActiveDeposited,
            totalOutstandingPayoutReserved,
            matchPool.totalDeposited,
            matchPool.totalWeight
        );
        return lpLossBooked;
    }

    function distributeGlobalMargin(bytes32 riskId, uint256 lpMarginShare) external onlyBettingPool {
        Pool storage globalPool = pools[0];
        uint256 wg = globalPool.totalWeight;
        if (wg == 0 || lpMarginShare == 0) {
            emit GlobalMarginDistributed(riskId, lpMarginShare);
            emit LiquidityAccountingSnapshot(
                riskId,
                0,
                0,
                9,
                requestableLiquidity,
                totalActiveDeposited,
                totalOutstandingPayoutReserved,
                globalPool.totalDeposited,
                globalPool.totalWeight
            );
            return;
        }

        globalPool.rewardPerWeight += lpMarginShare * PrecisionConstants.ODD_WAD / wg;
        requestableLiquidity += lpMarginShare;
        globalRequestableLiquidity += lpMarginShare;

        emit GlobalMarginDistributed(riskId, lpMarginShare);
        emit MarginDistributed(riskId, lpMarginShare, lpMarginShare, 0);
        emit LiquidityAccountingSnapshot(
            riskId,
            0,
            0,
            9,
            requestableLiquidity,
            totalActiveDeposited,
            totalOutstandingPayoutReserved,
            globalPool.totalDeposited,
            globalPool.totalWeight
        );
    }

    function distributeGlobalLoss(bytes32 riskId, uint256 netLoss)
        external
        onlyBettingPool
        returns (uint256 lpLossBooked)
    {
        Pool storage globalPool = pools[0];
        uint256 g = globalPool.totalDeposited;
        if (g == 0 || globalRequestableLiquidity == 0 || requestableLiquidity == 0) {
            _setReservedAmount(riskId, 0);
            emit GlobalLossDistributed(riskId, 0);
            emit LossDistributed(riskId, 0, 0, 0);
            emit LiquidityAccountingSnapshot(
                riskId,
                0,
                0,
                10,
                requestableLiquidity,
                totalActiveDeposited,
                totalOutstandingPayoutReserved,
                globalPool.totalDeposited,
                globalPool.totalWeight
            );
            return 0;
        }

        lpLossBooked = netLoss > globalRequestableLiquidity ? globalRequestableLiquidity : netLoss;
        if (lpLossBooked > requestableLiquidity) {
            lpLossBooked = requestableLiquidity;
        }
        globalPool.lossPerPrincipal += lpLossBooked * PrecisionConstants.ODD_WAD / g;
        requestableLiquidity -= lpLossBooked;
        globalRequestableLiquidity -= lpLossBooked;
        _setReservedAmount(riskId, lpLossBooked);

        emit GlobalLossDistributed(riskId, lpLossBooked);
        emit LossDistributed(riskId, lpLossBooked, lpLossBooked, 0);
        emit LiquidityAccountingSnapshot(
            riskId,
            0,
            0,
            10,
            requestableLiquidity,
            totalActiveDeposited,
            totalOutstandingPayoutReserved,
            globalPool.totalDeposited,
            globalPool.totalWeight
        );
        return lpLossBooked;
    }

    function requestUnbond(uint256 positionId) external nonReentrant whenNotPaused {
        LpPosition storage position = positions[positionId];
        _validateOwnedPosition(positionId, position);
        if (position.state != LpPositionState.Active) {
            revert PositionNotUnbondable(positionId);
        }
        if (block.timestamp < position.unlockAt) {
            revert PositionNotUnbondable(positionId);
        }

        Pool storage pool = pools[position.poolId];
        if (pool.poolType == PoolType.Match && !IBettingMatchViewV1(bettingPool).isMatchTerminal(pool.matchId)) {
            revert MatchNotTerminal(pool.matchId);
        }

        uint8 previousState = uint8(position.state);
        position.frozenRewardPerWeight = pool.rewardPerWeight;
        position.frozenLossPerPrincipal = pool.lossPerPrincipal;
        position.unbondingEpoch = _currentEpoch();
        position.state = LpPositionState.Unbonding;

        uint256 requestableShare = _activePositionValue(position, pool.rewardPerWeight, pool.lossPerPrincipal);
        pool.totalDeposited -= position.principal;
        pool.totalWeight -= position.weight;
        totalActiveDeposited -= position.principal;
        requestableLiquidity -= requestableShare;
        if (position.poolId == 0) {
            globalRequestableLiquidity -= requestableShare;
        }

        emit UnbondRequested(
            positionId,
            position.owner,
            position.unbondingEpoch,
            position.frozenRewardPerWeight,
            position.frozenLossPerPrincipal
        );
        emit LiquidityPositionStateChanged(
            positionId, position.owner, previousState, uint8(position.state), position.principal, position.weight
        );
        emit LiquidityAccountingSnapshot(
            pool.matchId,
            position.poolId,
            positionId,
            6,
            requestableLiquidity,
            totalActiveDeposited,
            totalOutstandingPayoutReserved,
            pool.totalDeposited,
            pool.totalWeight
        );
    }

    function withdraw(uint256 positionId) external nonReentrant whenNotPaused {
        LpPosition storage position = positions[positionId];
        _validateOwnedPosition(positionId, position);
        if (
            position.state != LpPositionState.Unbonding && position.state != LpPositionState.Ready
                && position.state != LpPositionState.Withdrawable
        ) {
            revert PositionNotUnbondable(positionId);
        }

        uint32 currentEpoch = _currentEpoch();
        uint32 requiredEpoch = position.unbondingEpoch + unbondEpochs + 1;
        if (currentEpoch < requiredEpoch) {
            revert EpochNotReady(currentEpoch, requiredEpoch);
        }

        uint8 previousState = uint8(position.state);
        if (position.state == LpPositionState.Unbonding || position.state == LpPositionState.Ready) {
            position.state = LpPositionState.Withdrawable;
        }

        (uint256 withdrawAmount, int256 netPnl, LpPositionState finalState) = _withdrawOutcome(position);
        position.state = finalState;

        IODDTokenBusiness(address(oddToken))
            .registerBusinessOutcomeDelta(position.owner, _positionBusinessId(positionId), withdrawAmount, true);

        _emitWithdrawAccounting(positionId, position, previousState, withdrawAmount, netPnl);
    }

    function requestPayoutLiquidity(bytes32 matchId, uint256 amount) external onlyBettingPool {
        PayoutLiquidityWindow storage window = payoutWindows[matchId];
        if (window.matchId == bytes32(0)) {
            revert InvalidMatchPoolLifecycle(matchId);
        }

        uint256 remainingReserved = window.reservedAmount - window.paidOutAmount;
        if (amount > remainingReserved) {
            revert PayoutWindowExceeded(matchId, amount, remainingReserved);
        }
        uint256 actualBalance = oddToken.balanceOf(address(this));
        if (amount > actualBalance) {
            revert PayoutWindowExceeded(matchId, amount, actualBalance);
        }

        window.paidOutAmount += amount;
        totalOutstandingPayoutReserved -= amount;
        oddToken.safeTransfer(bettingPool, amount);

        uint256 poolId = _matchPoolId(matchId);
        Pool storage pool = pools[poolId];
        emit PayoutLiquidityTransferred(matchId, amount, window.paidOutAmount);
        emit PayoutReserveOutstanding(matchId, window.reservedAmount - window.paidOutAmount);
        emit LiquidityAccountingSnapshot(
            matchId,
            poolId,
            0,
            8,
            requestableLiquidity,
            totalActiveDeposited,
            totalOutstandingPayoutReserved,
            pool.totalDeposited,
            pool.totalWeight
        );
    }

    function releasePayoutReserve(bytes32 matchId) external onlyBettingPool returns (uint256 releasedAmount) {
        PayoutLiquidityWindow storage window = payoutWindows[matchId];
        if (window.matchId == bytes32(0) || window.reservedAmount <= window.paidOutAmount) {
            return 0;
        }

        releasedAmount = window.reservedAmount - window.paidOutAmount;
        window.reservedAmount = window.paidOutAmount;
        totalOutstandingPayoutReserved -= releasedAmount;

        (uint256 globalShare, uint256 matchShare, uint256 poolId) = _creditReleasedReserve(matchId, releasedAmount);

        emit PayoutReserveReleased(
            matchId, releasedAmount, globalShare, matchShare, window.reservedAmount, window.paidOutAmount
        );
        emit PayoutReserveOutstanding(matchId, 0);
        emit LiquidityAccountingSnapshot(
            matchId,
            poolId,
            0,
            11,
            requestableLiquidity,
            totalActiveDeposited,
            totalOutstandingPayoutReserved,
            pools[poolId].totalDeposited,
            pools[poolId].totalWeight
        );
    }

    function getPayoutLiquidityWindow(bytes32 matchId)
        external
        view
        returns (uint256 reservedAmount, uint256 paidOutAmount, uint256 settledAt)
    {
        PayoutLiquidityWindow storage window = payoutWindows[matchId];
        return (window.reservedAmount, window.paidOutAmount, window.settledAt);
    }

    function getPoolWeights(bytes32 matchId) external view returns (uint256 globalWeight, uint256 matchWeight) {
        globalWeight = pools[0].totalWeight;
        matchWeight = pools[_matchPoolId(matchId)].totalWeight;
    }

    function getPositionState(uint256 positionId) external view returns (LpPositionState) {
        return _effectivePositionState(positions[positionId]);
    }

    function previewWithdraw(uint256 positionId)
        external
        view
        returns (uint256 withdrawAmount, int256 netPnl, LpPositionState effectiveState)
    {
        LpPosition storage position = positions[positionId];
        effectiveState = _effectivePositionState(position);
        if (effectiveState != LpPositionState.Unbonding && effectiveState != LpPositionState.Withdrawable) {
            return (0, 0, effectiveState);
        }

        (withdrawAmount, netPnl,) = _withdrawOutcome(position);
    }

    function getRequestableLiquidity() public view returns (uint256) {
        return requestableLiquidity;
    }

    function getGlobalRequestableLiquidity() external view returns (uint256) {
        return globalRequestableLiquidity;
    }

    function initializeGlobalRequestableLiquidity(uint256 value) external onlyRole(Roles.DEFAULT_ADMIN_ROLE) {
        if (globalRequestableLiquidityInitialized) {
            revert InvalidMatchPoolLifecycle(bytes32(0));
        }
        globalRequestableLiquidity = value;
        globalRequestableLiquidityInitialized = true;
    }

    function pause() external onlyRole(Roles.PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(Roles.PAUSER_ROLE) {
        _unpause();
    }

    function _createPosition(
        address owner,
        uint256 poolId,
        uint256 principal,
        uint256 weight,
        uint64 unlockAt,
        uint16 planId
    ) internal returns (uint256 positionId) {
        positionId = nextLpPositionId++;
        Pool storage pool = pools[poolId];
        positions[positionId] = LpPosition({
            owner: owner,
            poolId: poolId,
            principal: principal,
            weight: weight,
            unlockAt: unlockAt,
            rewardDebt: pool.rewardPerWeight,
            lossDebt: pool.lossPerPrincipal,
            unbondingEpoch: 0,
            frozenRewardPerWeight: 0,
            frozenLossPerPrincipal: 0,
            planId: planId,
            state: LpPositionState.Active
        });
    }

    function _setReservedAmount(bytes32 matchId, uint256 newReservedAmount) internal {
        PayoutLiquidityWindow storage window = payoutWindows[matchId];
        uint256 previousOutstanding = window.reservedAmount - window.paidOutAmount;

        if (window.matchId == bytes32(0)) {
            window.matchId = matchId;
        }
        window.reservedAmount += newReservedAmount;
        window.settledAt = uint64(block.timestamp);

        uint256 newOutstanding =
            window.reservedAmount > window.paidOutAmount ? window.reservedAmount - window.paidOutAmount : 0;
        if (newOutstanding >= previousOutstanding) {
            totalOutstandingPayoutReserved += newOutstanding - previousOutstanding;
        } else {
            totalOutstandingPayoutReserved -= previousOutstanding - newOutstanding;
        }

        emit PayoutLiquidityReserved(matchId, window.reservedAmount, window.paidOutAmount, window.settledAt);
        emit PayoutReserveOutstanding(matchId, newOutstanding);
    }

    function _creditReleasedReserve(bytes32 matchId, uint256 releasedAmount)
        internal
        returns (uint256 globalShare, uint256 matchShare, uint256 poolId)
    {
        poolId = _matchPoolId(matchId);
        Pool storage globalPool = pools[0];
        Pool storage matchPool = pools[poolId];
        uint256 wg = globalPool.totalWeight;
        uint256 wm = matchPool.exists ? matchPool.totalWeight : 0;

        if (wm == 0) {
            globalShare = releasedAmount;
        } else if (wg == 0) {
            matchShare = releasedAmount;
        } else {
            globalShare = releasedAmount * wg / (wg + wm);
            matchShare = releasedAmount - globalShare;
        }

        if (globalShare > 0 && wg > 0) {
            globalPool.rewardPerWeight += globalShare * PrecisionConstants.ODD_WAD / wg;
            globalRequestableLiquidity += globalShare;
        }
        if (matchShare > 0 && wm > 0) {
            matchPool.rewardPerWeight += matchShare * PrecisionConstants.ODD_WAD / wm;
        }
        requestableLiquidity += releasedAmount;
    }

    function _currentEpoch() internal view returns (uint32) {
        return uint32((block.timestamp - epochStart) / PrecisionConstants.SECONDS_PER_DAY);
    }

    function _effectivePositionState(LpPosition storage position) internal view returns (LpPositionState) {
        if (position.state == LpPositionState.Active && block.timestamp >= position.unlockAt) {
            return LpPositionState.Ready;
        }
        if (position.state == LpPositionState.Unbonding) {
            uint32 requiredEpoch = position.unbondingEpoch + unbondEpochs + 1;
            if (_currentEpoch() >= requiredEpoch) {
                return LpPositionState.Withdrawable;
            }
        }
        return position.state;
    }

    function _activePositionValue(
        LpPosition storage position,
        uint256 currentRewardPerWeight,
        uint256 currentLossPerPrincipal
    ) internal view returns (uint256 value) {
        uint256 accruedReward = position.weight * (currentRewardPerWeight - position.rewardDebt)
            / PrecisionConstants.ODD_WAD;
        uint256 accruedLoss =
            position.principal * (currentLossPerPrincipal - position.lossDebt) / PrecisionConstants.ODD_WAD;
        if (accruedLoss >= position.principal + accruedReward) {
            return 0;
        }
        return position.principal + accruedReward - accruedLoss;
    }

    function _withdrawOutcome(LpPosition storage position)
        internal
        view
        returns (uint256 withdrawAmount, int256 netPnl, LpPositionState finalState)
    {
        uint256 accruedReward =
            position.weight * (position.frozenRewardPerWeight - position.rewardDebt) / PrecisionConstants.ODD_WAD;
        uint256 accruedLoss =
            position.principal * (position.frozenLossPerPrincipal - position.lossDebt) / PrecisionConstants.ODD_WAD;
        netPnl = int256(accruedReward) - int256(accruedLoss);

        if (netPnl >= 0) {
            withdrawAmount = position.principal + uint256(netPnl);
            finalState = LpPositionState.Withdrawn;
            return (withdrawAmount, netPnl, finalState);
        }

        uint256 lossAmount = uint256(-netPnl);
        if (lossAmount >= position.principal) {
            return (0, netPnl, LpPositionState.Liquidated);
        }

        withdrawAmount = position.principal - lossAmount;
        finalState = LpPositionState.Withdrawn;
    }

    function _positionBusinessId(uint256 positionId) internal view returns (bytes32) {
        return keccak256(abi.encode(address(this), TokenBusinessTypes.LP_POSITION, bytes32(positionId)));
    }

    function _emitWithdrawAccounting(
        uint256 positionId,
        LpPosition storage position,
        uint8 previousState,
        uint256 withdrawAmount,
        int256 netPnl
    ) internal {
        Pool storage pool = pools[position.poolId];
        emit LiquidityWithdrawn(positionId, position.owner, withdrawAmount, uint8(position.state), netPnl);
        emit LiquidityPositionStateChanged(
            positionId, position.owner, previousState, uint8(position.state), position.principal, position.weight
        );
        emit LiquidityAccountingSnapshot(
            pool.matchId,
            position.poolId,
            positionId,
            7,
            requestableLiquidity,
            totalActiveDeposited,
            totalOutstandingPayoutReserved,
            pool.totalDeposited,
            pool.totalWeight
        );
    }

    function _matchPoolId(bytes32 matchId) internal pure returns (uint256) {
        return uint256(matchId);
    }

    function _globalPlan(uint16 planId) internal pure returns (uint16 lockDays, uint32 multiplierBps) {
        if (planId == 0) {
            return (LiquidityConstants.GLOBAL_PLAN_0_LOCK_DAYS, LiquidityConstants.GLOBAL_PLAN_0_MULTIPLIER_BPS);
        }
        if (planId == 1) {
            return (LiquidityConstants.GLOBAL_PLAN_1_LOCK_DAYS, LiquidityConstants.GLOBAL_PLAN_1_MULTIPLIER_BPS);
        }
        if (planId == 2) {
            return (LiquidityConstants.GLOBAL_PLAN_2_LOCK_DAYS, LiquidityConstants.GLOBAL_PLAN_2_MULTIPLIER_BPS);
        }
        if (planId == 3) {
            return (LiquidityConstants.GLOBAL_PLAN_3_LOCK_DAYS, LiquidityConstants.GLOBAL_PLAN_3_MULTIPLIER_BPS);
        }
        if (planId == 4) {
            return (LiquidityConstants.GLOBAL_PLAN_4_LOCK_DAYS, LiquidityConstants.GLOBAL_PLAN_4_MULTIPLIER_BPS);
        }
        revert InvalidLiquidityPlan(planId);
    }

    function _validateOwnedPosition(uint256 positionId, LpPosition storage position) internal view {
        if (position.owner != msg.sender) {
            revert LpPositionNotOwner(positionId, msg.sender);
        }
    }

    function _authorizeUpgrade(address) internal view override onlyRole(Roles.UPGRADER_ROLE) {}

    function _nonReentrantBefore() internal {
        if (_reentrancyStatus == 2) revert InvalidMatchPoolLifecycle(bytes32(0));
        _reentrancyStatus = 2;
    }

    function _nonReentrantAfter() internal {
        _reentrancyStatus = 1;
    }

    function _requireBettingPool() internal view {
        if (msg.sender != bettingPool) {
            revert BettingPoolOnly(msg.sender);
        }
    }
}
