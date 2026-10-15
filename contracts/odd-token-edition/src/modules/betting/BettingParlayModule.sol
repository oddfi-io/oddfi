// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {PrecisionConstants} from "../../shared/constants/PrecisionConstants.sol";
import {BettingConstants} from "../../shared/constants/BettingConstants.sol";
import {StakingConstants} from "../../shared/constants/StakingConstants.sol";
import {MarketStatus, SignalColor} from "../../shared/types/MarketEnums.sol";
import {
    MarketFinalResult,
    ParlayBet,
    ParlayEstimatedValue,
    ParlayLeg,
    ParlayLegInput,
    ParlayLegResult,
    ParlayState
} from "../../shared/types/ParlayTypes.sol";
import {
    DailyLimitExceeded,
    InvalidQuoteGuard,
    InvalidReferrerBinding,
    MarketClosed,
    MarketLocked,
    MarketNotOpen,
    MarketTemplateNotAllowed,
    MatchPayoutExceeded,
    OpenPositionExceeded,
    PoolLiquidityInsufficient,
    PayoutTooSmall,
    SettlementCannotClose
} from "../../shared/errors/BettingErrors.sol";
import {
    DuplicateParlayMarket,
    DuplicateParlayMatch,
    InvalidParlayLegCount,
    InvalidParlayState,
    ParlayModuleDirectCall,
    ParlayNotOwner
} from "../../shared/errors/ParlayErrors.sol";
import {BettingOddsLib} from "./BettingOddsLib.sol";
import {BettingScoreResultLib} from "./BettingScoreResultLib.sol";
import {ILiquidityPoolSettlementV1} from "./interfaces/ILiquidityPoolSettlementV1.sol";
import {IStakingHookV2} from "../staking/interfaces/IStakingHookV2.sol";
import {IStakingPoolViewV1} from "../staking/interfaces/IStakingPoolViewV1.sol";
import {IODDTokenBusiness} from "../token/interfaces/IODDTokenBusiness.sol";
import {TokenBusinessTypes} from "../token/TokenBusinessTypes.sol";
import {BettingPoolStorage} from "./BettingPoolStorage.sol";

interface IBettingParlayClaimStatusPool {
    function getMarket(bytes32 marketId) external view returns (BettingPoolStorage.MarketConfig memory);

    function getMarketOdds(bytes32 marketId)
        external
        view
        returns (uint256[] memory baseOdds, uint256[] memory quotedOdds, uint64 updatedAt, uint256 quoteVersion);

    function marketFinalResults(bytes32 marketId)
        external
        view
        returns (bool finalized, uint8 resultKind, bool scoreSettled, uint16 homeScore, uint16 awayScore);

    function parlays(bytes32 parlayId)
        external
        view
        returns (
            address owner,
            uint256 stake,
            uint256 lockedComboOdds,
            uint256 maxPayout,
            uint256 claimablePayout,
            bytes32 parlayRiskId,
            uint32 acceptedDayBucket,
            uint8 legCount,
            ParlayState state,
            uint16 payoutTaxRateBps,
            uint16 taxAllocStakingBps,
            uint16 taxAllocTaxBufferBps,
            uint16 taxAllocReferrerBps,
            address referrerSnapshot
        );

    function parlayLegs(bytes32 parlayId, uint256 index)
        external
        view
        returns (
            bytes32 marketId,
            bytes32 matchId,
            uint8 marketType,
            uint8 line,
            uint8 outcome,
            uint256 lockedOdds,
            uint256 syntheticPayout,
            ParlayLegResult result
        );
}

contract BettingParlayModule is BettingPoolStorage {
    using SafeERC20 for IERC20;

    address private immutable SELF = address(this);
    uint256 private constant FACTOR_SCALE = 1e18;

    struct PlaceComputation {
        uint256 rawComboOdds;
        uint256 lockedComboOdds;
        uint256 maxPayout;
        uint256 availableCapacity;
        uint256 betTax;
        uint256 totalDeduct;
        uint32 dayBucket;
        bytes32 parlayId;
        bytes32 parlayRiskId;
    }

    struct SettlementComputation {
        uint256 factorProduct;
        uint256 grossPayout;
        uint256 marginBase;
        uint256 lpMarginShare;
        uint256 platformMarginShare;
        uint256 lpLossBooked;
        uint8 effectiveLegCount;
        bool hasFullLoss;
    }

    modifier onlyDelegateCall() {
        _onlyDelegateCall();
        _;
    }

    function _onlyDelegateCall() internal view {
        if (address(this) == SELF) revert ParlayModuleDirectCall();
    }

    function getParlayClaimStatus(address bettingPoolAddress, address userAddress, bytes32 parlayId)
        external
        view
        returns (bool won, uint256 reward)
    {
        IBettingParlayClaimStatusPool pool = IBettingParlayClaimStatusPool(bettingPoolAddress);
        ParlayBet memory parlay = _claimStatusParlay(pool, parlayId);
        if (parlay.owner == address(0) || parlay.legCount == 0) {
            return (false, 0);
        }

        for (uint256 i = 0; i < parlay.legCount; ++i) {
            (bytes32 marketId,,,,,,,) = pool.parlayLegs(parlayId, i);
            BettingPoolStorage.MarketConfig memory market = pool.getMarket(marketId);
            if (block.timestamp < market.matchEndTime) {
                revert SettlementCannotClose(marketId);
            }
        }
        if (parlay.owner != userAddress) {
            return (false, 0);
        }

        if (parlay.state == ParlayState.WonUnclaimed || parlay.state == ParlayState.WonClaimed) {
            won = true;
            if (parlay.state == ParlayState.WonUnclaimed) {
                uint256 taxAmount = parlay.claimablePayout * parlay.payoutTaxRateBps / PrecisionConstants.BPS_SCALE;
                reward = parlay.claimablePayout - taxAmount;
            }
        } else if (parlay.state == ParlayState.Refundable) {
            reward = parlay.claimablePayout;
        }
    }

    function estimateParlayValue(address bettingPoolAddress, address userAddress, bytes32 parlayId)
        external
        view
        returns (ParlayEstimatedValue memory estimated)
    {
        IBettingParlayClaimStatusPool pool = IBettingParlayClaimStatusPool(bettingPoolAddress);
        ParlayBet memory parlay = _claimStatusParlay(pool, parlayId);
        if (parlay.owner == address(0) || parlay.owner != userAddress) {
            return estimated;
        }
        if (parlay.state != ParlayState.Pending) {
            revert InvalidParlayState(parlayId, uint8(parlay.state));
        }

        estimated.state = uint8(parlay.state);
        estimated.stake = parlay.stake;
        estimated.lockedComboOdds = parlay.lockedComboOdds;
        estimated.maxPayout = parlay.maxPayout;
        estimated.factorProduct = FACTOR_SCALE;
        for (uint256 i = 0; i < parlay.legCount; ++i) {
            ParlayLeg memory leg = _claimStatusParlayLeg(pool, parlayId, i);
            MarketFinalResult memory finalResult;
            (
                finalResult.finalized,
                finalResult.resultKind,
                finalResult.scoreSettled,
                finalResult.homeScore,
                finalResult.awayScore
            ) = pool.marketFinalResults(leg.marketId);
            if (finalResult.finalized) {
                estimated.finalizedLegCount += 1;
                if (finalResult.resultKind == 1 || finalResult.resultKind == 2) {
                    continue;
                }
                BettingScoreResultLib.Result result = BettingScoreResultLib.resolve(
                    leg.marketType, leg.line, leg.outcome, finalResult.homeScore, finalResult.awayScore
                );
                if (result == BettingScoreResultLib.Result.FullLoss) {
                    estimated.hasFullLoss = true;
                    estimated.factorProduct = 0;
                    estimated.estimatedValue = 0;
                    // Safe: parlay stake is bounded by platform payout caps and fits in int256.
                    // forge-lint: disable-next-line(unsafe-typecast)
                    estimated.floatingPnL = -int256(parlay.stake);
                    return estimated;
                }
                estimated.factorProduct = _applyFinalLegFactor(estimated.factorProduct, leg.lockedOdds, result);
            } else {
                estimated.unresolvedLegCount += 1;
                (, uint256[] memory quotedOdds,,) = pool.getMarketOdds(leg.marketId);
                uint256 currentOdds = quotedOdds[leg.outcome];
                estimated.factorProduct = estimated.factorProduct * leg.lockedOdds / currentOdds;
            }
        }

        estimated.isFinal = estimated.unresolvedLegCount == 0;
        estimated.estimatedValue = parlay.stake * estimated.factorProduct / FACTOR_SCALE;
        if (estimated.estimatedValue > parlay.maxPayout) {
            estimated.estimatedValue = parlay.maxPayout;
        }
        // Safe: parlay stake and estimated value are bounded by platform payout caps and fit in int256.
        // forge-lint: disable-next-line(unsafe-typecast)
        estimated.floatingPnL = int256(estimated.estimatedValue) - int256(parlay.stake);
    }

    function placeParlay(
        ParlayLegInput[] calldata inputs,
        uint256 stake,
        uint256 minComboOdds,
        uint256 deadline,
        address referrer
    ) external onlyDelegateCall returns (bytes32 parlayId) {
        uint256 legCount = inputs.length;
        if (legCount < BettingConstants.PARLAY_MIN_LEGS || legCount > BettingConstants.PARLAY_MAX_LEGS) {
            revert InvalidParlayLegCount(legCount, BettingConstants.PARLAY_MIN_LEGS, BettingConstants.PARLAY_MAX_LEGS);
        }
        if (stake < BettingConstants.MIN_BET_AMOUNT || stake == 0) {
            revert PoolLiquidityInsufficient(stake, BettingConstants.MIN_BET_AMOUNT);
        }
        if (block.timestamp > deadline) revert InvalidQuoteGuard();

        _bindReferrerIfNeeded(msg.sender, referrer);

        ParlayLeg[] memory preparedLegs = new ParlayLeg[](legCount);
        PlaceComputation memory context;
        context.rawComboOdds = PrecisionConstants.ODDS_RATE_SCALE;
        context.lockedComboOdds = PrecisionConstants.ODDS_RATE_SCALE;

        for (uint256 i = 0; i < legCount; ++i) {
            preparedLegs[i] = _prepareLeg(inputs[i], preparedLegs, i);
            context.rawComboOdds = _mulOddsCapped(context.rawComboOdds, preparedLegs[i].lockedOdds, type(uint256).max);
            context.lockedComboOdds = _mulOddsCapped(
                context.lockedComboOdds, preparedLegs[i].lockedOdds, BettingConstants.PARLAY_ODDS_RATE_CAP
            );
        }

        if (context.lockedComboOdds < minComboOdds) revert InvalidQuoteGuard();
        context.maxPayout = stake * context.lockedComboOdds / PrecisionConstants.ODDS_RATE_SCALE;
        if (context.maxPayout > BettingConstants.SINGLE_MATCH_PAYOUT_CAP) {
            context.maxPayout = BettingConstants.SINGLE_MATCH_PAYOUT_CAP;
        }
        context.availableCapacity = _availableParlayCapacity();
        if (context.maxPayout > context.availableCapacity) {
            revert PoolLiquidityInsufficient(context.maxPayout, context.availableCapacity);
        }

        context.dayBucket = _syncRiskLedgerDayBucket(userRiskLedger[msg.sender]);
        _validateUserRisk(msg.sender, userRiskLedger[msg.sender], stake);
        for (uint256 i = 0; i < legCount; ++i) {
            _validateLegRisk(msg.sender, preparedLegs[i], context.maxPayout);
        }

        context.betTax = stake * betTaxBps / PrecisionConstants.BPS_SCALE;
        context.totalDeduct = stake + context.betTax;
        uint256 nonce = nextParlayNonce++;
        context.parlayId = keccak256(abi.encodePacked(address(this), "ODDFI_PARLAY", nonce));
        context.parlayRiskId = keccak256(abi.encodePacked("ODDFI_PARLAY_RISK", context.parlayId));
        IODDTokenBusiness(address(oddToken))
            .consumeBusinessInflow(msg.sender, TokenBusinessTypes.BET_PARLAY, context.parlayId, context.totalDeduct);
        accountedBalance += context.totalDeduct;

        // Safe: legCount is validated against PARLAY_MAX_LEGS before this cast.
        // forge-lint: disable-next-line(unsafe-typecast)
        uint8 safeLegCount = uint8(legCount);
        parlays[context.parlayId] = ParlayBet({
            owner: msg.sender,
            stake: stake,
            lockedComboOdds: context.lockedComboOdds,
            maxPayout: context.maxPayout,
            claimablePayout: 0,
            parlayRiskId: context.parlayRiskId,
            acceptedDayBucket: context.dayBucket,
            legCount: safeLegCount,
            state: ParlayState.Pending,
            payoutTaxRateBps: 0,
            taxAllocStakingBps: 0,
            taxAllocTaxBufferBps: 0,
            taxAllocReferrerBps: 0,
            referrerSnapshot: address(0)
        });
        userParlayIds[msg.sender].push(context.parlayId);

        UserRiskLedger storage ledger = userRiskLedger[msg.sender];
        ledger.dailyAcceptedAmount += stake;
        ledger.unsettledStake += stake;
        openParlayMaxPayout += context.maxPayout;

        for (uint256 i = 0; i < legCount; ++i) {
            preparedLegs[i].syntheticPayout = context.maxPayout;
            parlayLegs[context.parlayId].push(preparedLegs[i]);
            _reserveSyntheticExposure(msg.sender, context.parlayId, preparedLegs[i], context.maxPayout);
        }

        _settleBetTax(msg.sender, context.betTax);
        emit ParlayPlaced(
            context.parlayId,
            msg.sender,
            stake,
            context.betTax,
            context.totalDeduct,
            safeLegCount,
            context.lockedComboOdds,
            context.maxPayout,
            context.parlayRiskId
        );
        return context.parlayId;
    }

    function settleParlay(bytes32 parlayId) external onlyDelegateCall {
        ParlayBet storage parlay = parlays[parlayId];
        if (parlay.state != ParlayState.Pending) {
            revert InvalidParlayState(parlayId, uint8(parlay.state));
        }

        ParlayLeg[] storage legs = parlayLegs[parlayId];
        SettlementComputation memory context;
        context.factorProduct = FACTOR_SCALE;

        for (uint256 i = 0; i < legs.length; ++i) {
            ParlayLeg storage leg = legs[i];
            ParlayLegResult result = _materializeLegResult(leg);
            leg.result = result;
            _releaseSyntheticExposure(parlay.owner, leg);

            if (result == ParlayLegResult.FullLoss) {
                context.hasFullLoss = true;
            } else if (result == ParlayLegResult.FullWin) {
                context.effectiveLegCount += 1;
                context.factorProduct = context.factorProduct * leg.lockedOdds / PrecisionConstants.ODDS_RATE_SCALE;
            } else if (result == ParlayLegResult.HalfWin) {
                context.effectiveLegCount += 1;
                context.factorProduct = context.factorProduct * (leg.lockedOdds + PrecisionConstants.ODDS_RATE_SCALE)
                    / 2 / PrecisionConstants.ODDS_RATE_SCALE;
            } else if (result == ParlayLegResult.HalfLoss) {
                context.effectiveLegCount += 1;
                context.factorProduct = context.factorProduct / 2;
            }
        }

        userRiskLedger[parlay.owner].unsettledStake -= parlay.stake;
        openParlayMaxPayout -= parlay.maxPayout;

        if (context.hasFullLoss) {
            parlay.state = ParlayState.Lost;
            context.marginBase = parlay.stake;
            _registerParlayOutcome(parlay.owner, parlayId, 0, true);
        } else if (context.effectiveLegCount == 0) {
            parlay.state = ParlayState.Refundable;
            parlay.claimablePayout = parlay.stake;
        } else {
            context.grossPayout = parlay.stake * context.factorProduct / FACTOR_SCALE;
            if (context.grossPayout > parlay.maxPayout) {
                context.grossPayout = parlay.maxPayout;
            }
            if (context.grossPayout == 0) {
                parlay.state = ParlayState.Lost;
                context.marginBase = parlay.stake;
                _registerParlayOutcome(parlay.owner, parlayId, 0, true);
            } else if (context.grossPayout <= parlay.stake) {
                parlay.state = ParlayState.Refundable;
                parlay.claimablePayout = context.grossPayout;
                context.marginBase = parlay.stake - context.grossPayout;
            } else {
                parlay.state = ParlayState.WonUnclaimed;
                parlay.claimablePayout = context.grossPayout;
                parlay.payoutTaxRateBps = payoutTaxBps;
                parlay.taxAllocStakingBps = taxAllocStakingBps;
                parlay.taxAllocTaxBufferBps = taxAllocTaxBufferBps;
                parlay.taxAllocReferrerBps = taxAllocReferrerBps;
                parlay.referrerSnapshot = referrers[parlay.owner];
                context.marginBase = parlay.stake;
                uint256 totalMargin = parlay.stake * 1000 / PrecisionConstants.BPS_SCALE;
                uint256 selfFundedPayout = parlay.stake - totalMargin;
                uint256 netLoss = context.grossPayout > selfFundedPayout ? context.grossPayout - selfFundedPayout : 0;
                context.lpLossBooked =
                    _applyParlaySettlementAccounting(parlay.parlayRiskId, context.marginBase, netLoss, context);
                emit ParlaySettled(
                    parlayId,
                    parlay.owner,
                    uint8(parlay.state),
                    context.grossPayout,
                    context.marginBase,
                    context.lpMarginShare,
                    context.platformMarginShare,
                    context.lpLossBooked,
                    parlay.parlayRiskId
                );
                return;
            }
        }

        _applyParlaySettlementAccounting(parlay.parlayRiskId, context.marginBase, 0, context);
        emit ParlaySettled(
            parlayId,
            parlay.owner,
            uint8(parlay.state),
            context.grossPayout,
            context.marginBase,
            context.lpMarginShare,
            context.platformMarginShare,
            context.lpLossBooked,
            parlay.parlayRiskId
        );
    }

    function claimParlayPayout(bytes32 parlayId) external onlyDelegateCall {
        ParlayBet storage parlay = parlays[parlayId];
        if (parlay.owner != msg.sender) revert ParlayNotOwner(parlayId, msg.sender);
        if (parlay.claimablePayout == 0) revert PayoutTooSmall();

        if (parlay.state == ParlayState.Refundable) {
            uint256 refundAmount = parlay.claimablePayout;
            parlay.state = ParlayState.Refunded;
            parlay.claimablePayout = 0;
            uint256 poolBalance = oddToken.balanceOf(address(this));
            if (poolBalance < refundAmount) {
                revert PoolLiquidityInsufficient(refundAmount, poolBalance);
            }
            accountedBalance -= refundAmount;
            _registerParlayOutcome(msg.sender, parlayId, refundAmount, true);
            emit ParlayPayoutClaimed(parlayId, msg.sender, refundAmount, 0, refundAmount);
            return;
        }

        if (parlay.state != ParlayState.WonUnclaimed) {
            revert InvalidParlayState(parlayId, uint8(parlay.state));
        }

        uint256 grossPayout = parlay.claimablePayout;
        uint256 taxAmount = grossPayout * parlay.payoutTaxRateBps / PrecisionConstants.BPS_SCALE;
        uint256 netPayout = grossPayout - taxAmount;
        if (netPayout == 0) revert PayoutTooSmall();

        parlay.state = ParlayState.WonClaimed;
        parlay.claimablePayout = 0;

        uint256 actualBalance = oddToken.balanceOf(address(this));
        if (actualBalance < grossPayout) {
            uint256 amountNeeded = grossPayout - actualBalance;
            ILiquidityPoolSettlementV1(liquidityPool).requestPayoutLiquidity(parlay.parlayRiskId, amountNeeded);
            accountedBalance += amountNeeded;
        }

        _distributeParlayPayoutTax(parlay, taxAmount);
        accountedBalance -= netPayout;
        _registerParlayOutcome(msg.sender, parlayId, netPayout, true);
        emit ParlayPayoutClaimed(parlayId, msg.sender, grossPayout, taxAmount, netPayout);
    }

    function _claimStatusParlay(IBettingParlayClaimStatusPool pool, bytes32 parlayId)
        internal
        view
        returns (ParlayBet memory parlay)
    {
        (
            parlay.owner,
            parlay.stake,
            parlay.lockedComboOdds,
            parlay.maxPayout,
            parlay.claimablePayout,
            parlay.parlayRiskId,
            parlay.acceptedDayBucket,
            parlay.legCount,
            parlay.state,
            parlay.payoutTaxRateBps,
            parlay.taxAllocStakingBps,
            parlay.taxAllocTaxBufferBps,
            parlay.taxAllocReferrerBps,
            parlay.referrerSnapshot
        ) = pool.parlays(parlayId);
    }

    function _claimStatusParlayLeg(IBettingParlayClaimStatusPool pool, bytes32 parlayId, uint256 index)
        internal
        view
        returns (ParlayLeg memory leg)
    {
        (
            leg.marketId,
            leg.matchId,
            leg.marketType,
            leg.line,
            leg.outcome,
            leg.lockedOdds,
            leg.syntheticPayout,
            leg.result
        ) = pool.parlayLegs(parlayId, index);
    }

    function _applyFinalLegFactor(uint256 factorProduct, uint256 lockedOdds, BettingScoreResultLib.Result result)
        internal
        pure
        returns (uint256)
    {
        if (result == BettingScoreResultLib.Result.FullWin) {
            return factorProduct * lockedOdds / PrecisionConstants.ODDS_RATE_SCALE;
        }
        if (result == BettingScoreResultLib.Result.HalfWin) {
            return
                factorProduct * (lockedOdds + PrecisionConstants.ODDS_RATE_SCALE) / 2
                    / PrecisionConstants.ODDS_RATE_SCALE;
        }
        if (result == BettingScoreResultLib.Result.HalfLoss) {
            return factorProduct / 2;
        }
        return factorProduct;
    }

    function _prepareLeg(ParlayLegInput calldata input, ParlayLeg[] memory preparedLegs, uint256 preparedCount)
        internal
        view
        returns (ParlayLeg memory leg)
    {
        MarketConfig storage market = markets[input.marketId];
        if (!_marketExists(market)) revert MarketNotOpen(input.marketId);
        if (market.status == MarketStatus.Locked) revert MarketLocked(input.marketId);
        if (_isTerminal(market.status) || block.timestamp >= market.matchEndTime) revert MarketClosed(input.marketId);
        if (market.status != MarketStatus.Open) revert MarketNotOpen(input.marketId);
        if (input.outcome >= market.outcomeCount) {
            revert MarketTemplateNotAllowed(market.marketType, market.line);
        }

        MarketOdds storage odds = marketOdds[input.marketId];
        if (input.quoteVersion != odds.quoteVersion || input.quotedAt != odds.updatedAt) {
            revert InvalidQuoteGuard();
        }
        uint256 lockedOdds = odds.quotedOdds[input.outcome];
        if (lockedOdds < input.minOdds) revert InvalidQuoteGuard();

        for (uint256 i = 0; i < preparedCount; ++i) {
            if (preparedLegs[i].marketId == input.marketId) revert DuplicateParlayMarket(input.marketId);
            if (preparedLegs[i].matchId == market.matchId) revert DuplicateParlayMatch(market.matchId);
        }

        return ParlayLeg({
            marketId: input.marketId,
            matchId: market.matchId,
            marketType: market.marketType,
            line: market.line,
            outcome: input.outcome,
            lockedOdds: lockedOdds,
            syntheticPayout: 0,
            result: ParlayLegResult.Pending
        });
    }

    function _validateUserRisk(address user, UserRiskLedger storage ledger, uint256 stake) internal view {
        uint256 activeStakeAmount = IStakingPoolViewV1(stakingPool).getActiveStakeAmount(user);
        uint256 dailyLimit = IStakingPoolViewV1(stakingPool).getUserDailyLimit(user);
        if (ledger.dailyAcceptedAmount + stake > dailyLimit) {
            revert DailyLimitExceeded(user, ledger.dailyAcceptedAmount + stake, dailyLimit - ledger.dailyAcceptedAmount);
        }

        uint256 allowedOpenPosition = activeStakeAmount > StakingConstants.OPEN_POSITION_STAKE_FREE_THRESHOLD
            ? activeStakeAmount
            : StakingConstants.OPEN_POSITION_STAKE_FREE_THRESHOLD;
        if (ledger.unsettledStake + stake > allowedOpenPosition) {
            revert OpenPositionExceeded(user, ledger.unsettledStake + stake, allowedOpenPosition);
        }
    }

    function _validateLegRisk(address user, ParlayLeg memory leg, uint256 maxPayout) internal view {
        uint256 committed = userMarketExposure[user][leg.marketId].potentialPayoutCommitted;
        if (committed + maxPayout > BettingConstants.SINGLE_MATCH_PAYOUT_CAP) {
            revert MatchPayoutExceeded(
                user, leg.marketId, committed + maxPayout, BettingConstants.SINGLE_MATCH_PAYOUT_CAP
            );
        }

        MarketExposure storage exposure = marketExposure[leg.marketId];
        uint256[] memory payouts = _copyArray(exposure.payoutByOutcome);
        payouts[leg.outcome] += maxPayout;
        (, uint256 maxWcl) = BettingOddsLib.computeWorstCaseLosses(
            payouts, BettingOddsLib.sumArray(_copyArray(exposure.totalStakedByOutcome))
        );
        if (maxWcl > wclRedThreshold) {
            revert PoolLiquidityInsufficient(maxWcl, wclRedThreshold);
        }
    }

    function _reserveSyntheticExposure(address user, bytes32 parlayId, ParlayLeg memory leg, uint256 syntheticPayout)
        internal
    {
        marketExposure[leg.marketId].payoutByOutcome[leg.outcome] += syntheticPayout;
        userMarketExposure[user][leg.marketId].potentialPayoutCommitted += syntheticPayout;
        _refreshExposureAndOdds(leg.marketId);
        marketOdds[leg.marketId].quoteVersion += 1;
        emit ParlayLegExposureReserved(parlayId, leg.marketId, leg.outcome, syntheticPayout);
        emit OddsUpdated(
            leg.marketId,
            marketOdds[leg.marketId].updatedAt,
            marketOdds[leg.marketId].quoteVersion,
            uint8(marketExposure[leg.marketId].signalColor)
        );
    }

    function _releaseSyntheticExposure(address user, ParlayLeg storage leg) internal {
        marketExposure[leg.marketId].payoutByOutcome[leg.outcome] -= leg.syntheticPayout;
        userMarketExposure[user][leg.marketId].potentialPayoutCommitted -= leg.syntheticPayout;
        _refreshExposureAndOdds(leg.marketId);
        marketOdds[leg.marketId].quoteVersion += 1;
        emit OddsUpdated(
            leg.marketId,
            marketOdds[leg.marketId].updatedAt,
            marketOdds[leg.marketId].quoteVersion,
            uint8(marketExposure[leg.marketId].signalColor)
        );
    }

    function _materializeLegResult(ParlayLeg storage leg) internal view returns (ParlayLegResult) {
        MarketConfig storage market = markets[leg.marketId];
        MarketFinalResult storage finalResult = marketFinalResults[leg.marketId];
        if (!finalResult.finalized) revert SettlementCannotClose(leg.marketId);
        if (market.status == MarketStatus.Open || market.status == MarketStatus.Locked) {
            revert SettlementCannotClose(leg.marketId);
        }
        if (finalResult.resultKind == uint8(SettlementResultKind.Refunded)) return ParlayLegResult.Void;
        if (finalResult.resultKind == uint8(SettlementResultKind.Cancelled)) return ParlayLegResult.Void;
        if (finalResult.resultKind != uint8(SettlementResultKind.Settled) || !finalResult.scoreSettled) {
            revert SettlementCannotClose(leg.marketId);
        }

        BettingScoreResultLib.Result result = BettingScoreResultLib.resolve(
            leg.marketType, leg.line, leg.outcome, finalResult.homeScore, finalResult.awayScore
        );
        if (result == BettingScoreResultLib.Result.FullWin) return ParlayLegResult.FullWin;
        if (result == BettingScoreResultLib.Result.FullLoss) return ParlayLegResult.FullLoss;
        if (result == BettingScoreResultLib.Result.FullPush) return ParlayLegResult.FullPush;
        if (result == BettingScoreResultLib.Result.HalfWin) return ParlayLegResult.HalfWin;
        return ParlayLegResult.HalfLoss;
    }

    function _applyParlaySettlementAccounting(
        bytes32 riskId,
        uint256 marginBase,
        uint256 netLoss,
        SettlementComputation memory context
    ) internal returns (uint256 lpLossBooked) {
        if (marginBase > 0) {
            uint256 totalMargin = marginBase * 1000 / PrecisionConstants.BPS_SCALE;
            context.lpMarginShare = totalMargin * lpMarginShareBps / PrecisionConstants.BPS_SCALE;
            context.platformMarginShare = totalMargin - context.lpMarginShare;

            (uint256 globalWeight,) = ILiquidityPoolSettlementV1(liquidityPool).getPoolWeights(riskId);
            if (context.lpMarginShare > 0 && globalWeight > 0) {
                accountedBalance -= context.lpMarginShare;
                oddToken.safeTransfer(liquidityPool, context.lpMarginShare);
                ILiquidityPoolSettlementV1(liquidityPool).distributeGlobalMargin(riskId, context.lpMarginShare);
            } else if (context.lpMarginShare > 0) {
                platformReserve += context.lpMarginShare;
                // Safe: lpMarginShare is derived from accepted stake already held by this contract.
                // forge-lint: disable-next-line(unsafe-typecast)
                emit PlatformReserveUpdated(int256(context.lpMarginShare), platformReserve, 2);
            }

            if (context.platformMarginShare > 0) {
                platformReserve += context.platformMarginShare;
                // Safe: platformMarginShare is derived from accepted stake already held by this contract.
                // forge-lint: disable-next-line(unsafe-typecast)
                emit PlatformReserveUpdated(int256(context.platformMarginShare), platformReserve, 4);
            }
        }

        if (netLoss > 0) {
            lpLossBooked = _globalWaterfall(riskId, netLoss);
        }
    }

    function _globalWaterfall(bytes32 riskId, uint256 deficit) internal returns (uint256 lpLossBooked) {
        if (deficit == 0) return 0;

        lpLossBooked = ILiquidityPoolSettlementV1(liquidityPool).distributeGlobalLoss(riskId, deficit);
        deficit -= lpLossBooked;
        lpLossOffsetRemaining += lpLossBooked;

        if (deficit > 0 && taxBuffer > 0) {
            uint256 l3Used = deficit <= taxBuffer ? deficit : taxBuffer;
            taxBuffer -= l3Used;
            deficit -= l3Used;
        }

        if (deficit > 0) {
            uint256 reserveBefore = platformReserve;
            uint256 l4Used = deficit <= platformReserve ? deficit : platformReserve;
            platformReserve -= l4Used;
            deficit -= l4Used;
            if (l4Used > 0) {
                emit ReserveTapped(riskId, l4Used, platformReserve);
                // Safe: l4Used is capped by platformReserve and both values are bounded by token supply.
                // forge-lint: disable-next-line(unsafe-typecast)
                emit PlatformReserveUpdated(-int256(l4Used), platformReserve, 1);
                _emitReserveStepAlerts(reserveBefore, platformReserve);
                if (platformReserve <= BettingConstants.EMERGENCY_FLOOR) {
                    _pause();
                    emit ReserveBelowFloor(platformReserve);
                }
            }
        }

        if (deficit > 0) revert SettlementCannotClose(riskId);
        return lpLossBooked;
    }

    function _distributeParlayPayoutTax(ParlayBet storage parlay, uint256 taxAmount) internal {
        if (taxAmount == 0 || parlay.payoutTaxRateBps == 0) return;

        uint256 stakingShare = taxAmount * parlay.taxAllocStakingBps / parlay.payoutTaxRateBps;
        uint256 taxBufferShare = taxAmount * parlay.taxAllocTaxBufferBps / parlay.payoutTaxRateBps;
        uint256 referrerShare = taxAmount * parlay.taxAllocReferrerBps / parlay.payoutTaxRateBps;
        uint256 platformShare = taxAmount - stakingShare - taxBufferShare - referrerShare;

        if (stakingShare > 0) {
            accountedBalance -= stakingShare;
            oddToken.safeTransfer(stakingPool, stakingShare);
            IStakingHookV2(stakingPool).notifyReward(stakingShare);
        }
        if (taxBufferShare > 0) {
            _injectTaxBuffer(taxBufferShare);
        }
        if (referrerShare > 0) {
            if (parlay.referrerSnapshot != address(0)) {
                referrerRewardsOdd[parlay.referrerSnapshot] += referrerShare;
                emit ReferralRewardAccumulated(parlay.referrerSnapshot, referrerShare, parlay.owner, 1);
            } else {
                platformShare += referrerShare;
            }
        }
        if (platformShare > 0) {
            accountedBalance -= platformShare;
            oddToken.safeTransfer(platformTreasury, platformShare);
        }
    }

    function _registerParlayOutcome(address user, bytes32 parlayId, uint256 amount, bool finalized) internal {
        IODDTokenBusiness(address(oddToken))
            .registerBusinessOutcomeDelta(user, _parlayBusinessId(parlayId), amount, finalized);
    }

    function _parlayBusinessId(bytes32 parlayId) internal view returns (bytes32) {
        return keccak256(abi.encode(address(this), TokenBusinessTypes.BET_PARLAY, parlayId));
    }

    function _injectTaxBuffer(uint256 amount) internal {
        if (amount == 0) return;

        if (lpLossOffsetRemaining > 0) {
            uint256 offsetAmount = amount <= lpLossOffsetRemaining ? amount : lpLossOffsetRemaining;
            lpLossOffsetRemaining -= offsetAmount;
            amount -= offsetAmount;
            emit LpLossOffsetApplied(offsetAmount, lpLossOffsetRemaining);
        }

        if (amount > 0 && taxBuffer < BettingConstants.TAX_BUFFER_CAP) {
            uint256 toBuffer = amount;
            uint256 remainingBufferCapacity = BettingConstants.TAX_BUFFER_CAP - taxBuffer;
            if (toBuffer > remainingBufferCapacity) {
                toBuffer = remainingBufferCapacity;
            }
            taxBuffer += toBuffer;
            amount -= toBuffer;
            emit TaxBufferFunded(toBuffer, taxBuffer);
        }

        if (amount > 0) {
            platformReserve += amount;
            // Safe: amount is payout tax already held by this contract.
            // forge-lint: disable-next-line(unsafe-typecast)
            emit PlatformReserveUpdated(int256(amount), platformReserve, 3);
        }
    }

    function _settleBetTax(address user, uint256 betTax) internal {
        if (betTax == 0) return;
        address boundReferrer = referrers[user];
        if (boundReferrer != address(0)) {
            referrerRewardsOdd[boundReferrer] += betTax;
            emit ReferralRewardAccumulated(boundReferrer, betTax, user, 0);
        } else {
            accountedBalance -= betTax;
            oddToken.safeTransfer(platformTreasury, betTax);
        }
    }

    function _bindReferrerIfNeeded(address user, address referrer) internal {
        if (referrer == address(0) || referrers[user] != address(0)) return;
        if (referrer == user) revert InvalidReferrerBinding();
        referrers[user] = referrer;
        emit ReferrerBound(user, referrer);
    }

    function _availableParlayCapacity() internal view returns (uint256) {
        uint256 rawCapacity =
            ILiquidityPoolSettlementV1(liquidityPool).getGlobalRequestableLiquidity() + taxBuffer + platformReserve;
        if (rawCapacity <= openParlayMaxPayout) {
            return 0;
        }
        return rawCapacity - openParlayMaxPayout;
    }

    function _syncRiskLedgerDayBucket(UserRiskLedger storage ledger) internal returns (uint32 currentDayBucket) {
        currentDayBucket = uint32(block.timestamp / PrecisionConstants.SECONDS_PER_DAY);
        if (ledger.dayBucket != currentDayBucket) {
            ledger.dayBucket = currentDayBucket;
            ledger.dailyAcceptedAmount = 0;
        }
    }

    function _mulOddsCapped(uint256 currentOdds, uint256 nextOdds, uint256 cap) internal pure returns (uint256) {
        if (currentOdds == 0 || nextOdds == 0) return 0;
        if (cap != type(uint256).max) {
            uint256 capNumerator = cap * PrecisionConstants.ODDS_RATE_SCALE;
            if (nextOdds > capNumerator || currentOdds > capNumerator / nextOdds) {
                return cap;
            }
        }
        uint256 result = currentOdds * nextOdds / PrecisionConstants.ODDS_RATE_SCALE;
        return result > cap ? cap : result;
    }

    function _refreshExposureAndOdds(bytes32 marketId) internal {
        MarketExposure storage exposure = marketExposure[marketId];
        MarketOdds storage odds = marketOdds[marketId];
        (uint256[] memory newQuotedOdds,, SignalColor signalColor) = BettingOddsLib.computeQuotedOdds(
            odds.baseOdds,
            exposure.totalStakedByOutcome,
            exposure.payoutByOutcome,
            wclYellowThreshold,
            wclOrangeThreshold,
            wclRedThreshold
        );
        odds.quotedOdds = newQuotedOdds;
        exposure.signalColor = signalColor;
    }

    function _copyArray(uint256[] storage values) internal view returns (uint256[] memory result) {
        result = new uint256[](values.length);
        for (uint256 i = 0; i < values.length; ++i) {
            result[i] = values[i];
        }
    }

    function _emitReserveStepAlerts(uint256 oldReserve, uint256 newReserve) internal {
        if (newReserve >= oldReserve) return;

        uint256 oldStep = oldReserve / BettingConstants.RESERVE_STEP_ALERT_SIZE;
        uint256 newStep = newReserve / BettingConstants.RESERVE_STEP_ALERT_SIZE;
        if (newStep >= oldStep) return;

        for (uint256 step = oldStep; step > newStep; --step) {
            emit ReserveStepAlert(step - 1, newReserve);
        }
    }

    function _marketExists(MarketConfig storage market) internal view returns (bool) {
        return market.matchId != bytes32(0);
    }

    function _isTerminal(MarketStatus status) internal pure returns (bool) {
        return status == MarketStatus.Settled || status == MarketStatus.Refunded || status == MarketStatus.Cancelled;
    }
}
