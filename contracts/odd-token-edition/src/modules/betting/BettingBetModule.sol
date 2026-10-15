// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {PrecisionConstants} from "../../shared/constants/PrecisionConstants.sol";
import {BettingConstants} from "../../shared/constants/BettingConstants.sol";
import {QuoteGuardInput} from "../../shared/types/CommonTypes.sol";
import {BetSettlementState, SignalColor} from "../../shared/types/MarketEnums.sol";
import {
    InvalidReferrerBinding,
    MarketClosed,
    MarketNotOpen,
    SettlementCannotClose
} from "../../shared/errors/BettingErrors.sol";
import {BettingOddsLib} from "./BettingOddsLib.sol";
import {BettingValidationLib} from "./BettingValidationLib.sol";
import {ILiquidityPoolSettlementV1} from "./interfaces/ILiquidityPoolSettlementV1.sol";
import {IStakingPoolViewV1} from "../staking/interfaces/IStakingPoolViewV1.sol";
import {IODDTokenBusiness} from "../token/interfaces/IODDTokenBusiness.sol";
import {TokenBusinessTypes} from "../token/TokenBusinessTypes.sol";
import {BettingPoolStorage} from "./BettingPoolStorage.sol";

contract BettingBetModule is BettingPoolStorage {
    using SafeERC20 for IERC20;

    address private immutable SELF = address(this);

    modifier onlyDelegateCall() {
        _onlyDelegateCall();
        _;
    }

    function _onlyDelegateCall() internal view {
        if (address(this) == SELF) revert SettlementCannotClose(bytes32(0));
    }

    function placeBet(bytes32 marketId, uint8 outcome, uint256 requestedAmount, QuoteGuardInput calldata guard)
        external
        onlyDelegateCall
        returns (bytes32 betId, uint256 acceptedAmount, uint256 lockedOdds)
    {
        return _placeBet(marketId, outcome, requestedAmount, guard, address(0));
    }

    function placeBet(
        bytes32 marketId,
        uint8 outcome,
        uint256 requestedAmount,
        QuoteGuardInput calldata guard,
        address referrer
    ) external onlyDelegateCall returns (bytes32 betId, uint256 acceptedAmount, uint256 lockedOdds) {
        return _placeBet(marketId, outcome, requestedAmount, guard, referrer);
    }

    function _placeBet(
        bytes32 marketId,
        uint8 outcome,
        uint256 requestedAmount,
        QuoteGuardInput calldata guard,
        address referrer
    ) internal returns (bytes32 betId, uint256 acceptedAmount, uint256 lockedOdds) {
        MarketConfig storage market = markets[marketId];
        UserRiskLedger storage riskLedger = userRiskLedger[msg.sender];
        UserMarketExposure storage marketExposureByUser = userMarketExposure[msg.sender][marketId];
        BetPreviewContext memory context =
            _prepareBetContext(marketId, market, outcome, requestedAmount, guard, referrer, riskLedger);
        acceptedAmount = context.acceptedAmount;
        lockedOdds = context.lockedOdds;
        _validateBetLimits(marketId, guard, riskLedger, marketExposureByUser, context);

        uint256 betTax = acceptedAmount * betTaxBps / PrecisionConstants.BPS_SCALE;
        uint256 totalDeduct = acceptedAmount + betTax;
        betId = bytes32(nextBetNonce++);
        IODDTokenBusiness(address(oddToken))
            .consumeBusinessInflow(msg.sender, TokenBusinessTypes.BET_SINGLE, betId, totalDeduct);
        accountedBalance += totalDeduct;

        betId = _recordBetPlacement(
            betId,
            marketId,
            outcome,
            acceptedAmount,
            lockedOdds,
            context.currentDayBucket,
            context.potentialPayout,
            riskLedger,
            marketExposureByUser
        );

        _settleBetTax(msg.sender, betTax);
        _emitBetPlacementEvents(marketId, betId, requestedAmount);
    }

    function _prepareBetContext(
        bytes32 marketId,
        MarketConfig storage market,
        uint8 outcome,
        uint256 requestedAmount,
        QuoteGuardInput calldata guard,
        address referrer,
        UserRiskLedger storage riskLedger
    ) internal returns (BetPreviewContext memory context) {
        _validateMarketAndGuardForBet(marketId, market, outcome, requestedAmount, guard, referrer);

        context.currentDayBucket = _syncRiskLedgerDayBucket(riskLedger);
        (, context.acceptedAmount, context.lockedOdds,,) = _previewBet(marketId, outcome, requestedAmount);
        if (context.acceptedAmount == 0) {
            revert MarketClosed(marketId);
        }

        context.activeStakeAmount = IStakingPoolViewV1(stakingPool).getActiveStakeAmount(msg.sender);
        context.dailyLimit = IStakingPoolViewV1(stakingPool).getUserDailyLimit(msg.sender);
        context.potentialPayout = context.acceptedAmount * context.lockedOdds / PrecisionConstants.ODDS_RATE_SCALE;
        context.availableLiquidity = _otherOutcomeStakes(marketId, outcome)
            + ILiquidityPoolSettlementV1(liquidityPool).getRequestableLiquidity() + taxBuffer + platformReserve;
    }

    function _validateMarketAndGuardForBet(
        bytes32 marketId,
        MarketConfig storage market,
        uint8 outcome,
        uint256 requestedAmount,
        QuoteGuardInput calldata guard,
        address referrer
    ) internal {
        if (!_marketExists(market)) {
            revert MarketNotOpen(marketId);
        }

        MarketOdds storage odds = marketOdds[marketId];
        BettingValidationLib.validateMarketGuard(
            marketId,
            market.marketType,
            market.line,
            market.outcomeCount,
            market.status,
            market.matchEndTime,
            odds.quoteVersion,
            odds.updatedAt,
            outcome,
            requestedAmount,
            guard,
            block.timestamp
        );

        if (referrer != address(0) && referrers[msg.sender] == address(0)) {
            _bindReferrer(msg.sender, referrer);
        }
    }

    function _validateBetLimits(
        bytes32 marketId,
        QuoteGuardInput calldata guard,
        UserRiskLedger storage riskLedger,
        UserMarketExposure storage marketExposureByUser,
        BetPreviewContext memory context
    ) internal view {
        BettingValidationLib.validateBetLimits(
            msg.sender,
            marketId,
            riskLedger.dailyAcceptedAmount,
            riskLedger.unsettledStake,
            marketExposureByUser.potentialPayoutCommitted,
            context.activeStakeAmount,
            context.dailyLimit,
            context.acceptedAmount,
            context.potentialPayout,
            context.availableLiquidity,
            guard.minAcceptedAmount,
            context.lockedOdds,
            guard.minOdds
        );
    }

    function _recordBetPlacement(
        bytes32 betId,
        bytes32 marketId,
        uint8 outcome,
        uint256 acceptedAmount,
        uint256 lockedOdds,
        uint32 currentDayBucket,
        uint256 potentialPayout,
        UserRiskLedger storage riskLedger,
        UserMarketExposure storage marketExposureByUser
    ) internal returns (bytes32) {
        bets[betId] = Bet({
            owner: msg.sender,
            marketId: marketId,
            outcome: outcome,
            acceptedAmount: acceptedAmount,
            refundedAmount: 0,
            lockedOdds: lockedOdds,
            acceptedDayBucket: currentDayBucket,
            settlementState: BetSettlementState.Pending,
            claimablePayout: 0,
            payoutTaxRateBps: 0,
            taxAllocStakingBps: 0,
            taxAllocTaxBufferBps: 0,
            taxAllocReferrerBps: 0,
            referrerSnapshot: address(0)
        });
        marketBetIds[marketId].push(betId);

        riskLedger.dailyAcceptedAmount += acceptedAmount;
        riskLedger.unsettledStake += acceptedAmount;
        marketExposureByUser.potentialPayoutCommitted += potentialPayout;

        MarketExposure storage exposure = marketExposure[marketId];
        exposure.totalStakedByOutcome[outcome] += acceptedAmount;
        exposure.payoutByOutcome[outcome] += potentialPayout;
        _refreshExposureAndOdds(marketId);
        marketOdds[marketId].quoteVersion += 1;
        return betId;
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

    function _emitBetPlacementEvents(bytes32 marketId, bytes32 betId, uint256 requestedAmount) internal {
        Bet storage bet = bets[betId];
        MarketOdds storage odds = marketOdds[marketId];
        MarketExposure storage exposure = marketExposure[marketId];

        emit BetPlaced(
            betId,
            marketId,
            msg.sender,
            requestedAmount,
            bet.acceptedAmount,
            bet.lockedOdds,
            odds.quoteVersion,
            bet.outcome
        );
        emit OddsUpdated(marketId, odds.updatedAt, odds.quoteVersion, uint8(exposure.signalColor));
    }

    function _bindReferrer(address user, address referrer) internal {
        if (referrers[user] != address(0)) revert InvalidReferrerBinding();
        if (referrer == user) revert InvalidReferrerBinding();
        if (referrer == address(0)) revert InvalidReferrerBinding();
        referrers[user] = referrer;
        emit ReferrerBound(user, referrer);
    }

    function _otherOutcomeStakes(bytes32 marketId, uint8 selectedOutcome) internal view returns (uint256 total) {
        MarketExposure storage exposure = marketExposure[marketId];
        for (uint256 i = 0; i < exposure.totalStakedByOutcome.length; ++i) {
            if (i == selectedOutcome) continue;
            total += exposure.totalStakedByOutcome[i];
        }
    }

    function _previewBet(bytes32 marketId, uint8 outcome, uint256 requestedAmount)
        internal
        view
        returns (
            SignalColor signal,
            uint256 acceptedAmount,
            uint256 lockedOdds,
            bool partialFill,
            uint256 maxAcceptableAmount
        )
    {
        MarketExposure storage exposure = marketExposure[marketId];
        MarketOdds storage odds = marketOdds[marketId];
        uint256 currentQuotedOdds = odds.quotedOdds[outcome];
        if (currentQuotedOdds == 0) {
            revert MarketClosed(marketId);
        }
        uint256 currentOutcomePayout = exposure.payoutByOutcome[outcome];
        uint256 currentTotalStake = _sumArrayStorage(exposure.totalStakedByOutcome);
        uint256 currentWcl = BettingOddsLib.currentOutcomeWcl(currentOutcomePayout, currentTotalStake);
        if (currentWcl >= wclRedThreshold) {
            signal = BettingOddsLib.signalFor(currentWcl, wclYellowThreshold, wclOrangeThreshold, wclRedThreshold);
            return (signal, 0, currentQuotedOdds, true, 0);
        }

        uint256 redOdds = BettingOddsLib.redLineOdds(odds.baseOdds[outcome]);
        uint256 candidateLockedOdds = currentQuotedOdds;
        if (requestedAmount > BettingConstants.SLIPPAGE_TRIGGER_AMOUNT) {
            (, candidateLockedOdds) = _previewPostTradeSignal(marketId, outcome, requestedAmount, currentQuotedOdds);
        }

        uint256 candidatePayout =
            currentOutcomePayout + requestedAmount * candidateLockedOdds / PrecisionConstants.ODDS_RATE_SCALE;
        uint256 candidateTotalStake = currentTotalStake + requestedAmount;
        uint256 candidateWcl = BettingOddsLib.currentOutcomeWcl(candidatePayout, candidateTotalStake);

        maxAcceptableAmount =
            BettingOddsLib.maxStakeAtRedThreshold(currentOutcomePayout, currentTotalStake, redOdds, wclRedThreshold);

        if (candidateWcl > wclRedThreshold) {
            acceptedAmount = requestedAmount > maxAcceptableAmount ? maxAcceptableAmount : requestedAmount;
            partialFill = requestedAmount > maxAcceptableAmount;
            lockedOdds = redOdds;
            if (acceptedAmount == 0) {
                return (SignalColor.Red, 0, lockedOdds, true, 0);
            }
            (signal,) = _previewPostTradeSignal(marketId, outcome, acceptedAmount, lockedOdds);
            return (signal, acceptedAmount, lockedOdds, partialFill, maxAcceptableAmount);
        }

        if (requestedAmount > maxAcceptableAmount) {
            acceptedAmount = maxAcceptableAmount;
            partialFill = true;
            lockedOdds = redOdds;
        } else {
            acceptedAmount = requestedAmount;
            lockedOdds = candidateLockedOdds;
        }

        (signal,) = _previewPostTradeSignal(marketId, outcome, acceptedAmount, lockedOdds);
    }

    function _previewPostTradeSignal(bytes32 marketId, uint8 outcome, uint256 acceptedAmount, uint256 lockedOdds)
        internal
        view
        returns (SignalColor signal, uint256 outcomeQuotedOdds)
    {
        MarketOdds storage odds = marketOdds[marketId];
        MarketExposure storage exposure = marketExposure[marketId];
        uint256[] memory stakes = _copyArray(exposure.totalStakedByOutcome);
        uint256[] memory payouts = _copyArray(exposure.payoutByOutcome);
        stakes[outcome] += acceptedAmount;
        payouts[outcome] += acceptedAmount * lockedOdds / PrecisionConstants.ODDS_RATE_SCALE;

        (uint256[] memory quotedOddsPreview,, SignalColor signalPreview) = BettingOddsLib.computeQuotedOdds(
            odds.baseOdds, stakes, payouts, wclYellowThreshold, wclOrangeThreshold, wclRedThreshold
        );
        return (signalPreview, quotedOddsPreview[outcome]);
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

    function _syncRiskLedgerDayBucket(UserRiskLedger storage riskLedger) internal returns (uint32 currentDayBucket) {
        currentDayBucket = _currentDayBucket();
        if (riskLedger.dayBucket != currentDayBucket) {
            riskLedger.dayBucket = currentDayBucket;
            riskLedger.dailyAcceptedAmount = 0;
        }
    }

    function _currentDayBucket() internal view returns (uint32) {
        return uint32(block.timestamp / PrecisionConstants.SECONDS_PER_DAY);
    }

    function _sumArrayStorage(uint256[] storage values) internal view returns (uint256 total) {
        for (uint256 i = 0; i < values.length; ++i) {
            total += values[i];
        }
    }

    function _copyArray(uint256[] storage values) internal view returns (uint256[] memory result) {
        result = new uint256[](values.length);
        for (uint256 i = 0; i < values.length; ++i) {
            result[i] = values[i];
        }
    }

    function _marketExists(MarketConfig storage market) internal view returns (bool) {
        return market.matchId != bytes32(0);
    }
}
