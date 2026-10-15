// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {QuoteGuardInput} from "../../shared/types/CommonTypes.sol";
import {MarketStatus} from "../../shared/types/MarketEnums.sol";
import {StakingConstants} from "../../shared/constants/StakingConstants.sol";
import {BettingConstants} from "../../shared/constants/BettingConstants.sol";
import {
    MarketTemplateNotAllowed,
    MarketNotOpen,
    MarketClosed,
    MarketLocked,
    DailyLimitExceeded,
    OpenPositionExceeded,
    MatchPayoutExceeded,
    PoolLiquidityInsufficient,
    InvalidQuoteGuard,
    BetAmountBelowMinimum
} from "../../shared/errors/BettingErrors.sol";

library BettingValidationLib {
    function validateMarketGuard(
        bytes32 marketId,
        uint8 marketType,
        uint8 line,
        uint8 outcomeCount,
        MarketStatus status,
        uint64 matchEndTime,
        uint256 quoteVersion,
        uint64 updatedAt,
        uint8 outcome,
        uint256 requestedAmount,
        QuoteGuardInput calldata guard,
        uint256 currentTimestamp
    ) public pure {
        if (status == MarketStatus.Locked) {
            revert MarketLocked(marketId);
        }
        if (
            status == MarketStatus.Settled || status == MarketStatus.Refunded || status == MarketStatus.Cancelled
                || currentTimestamp >= matchEndTime
        ) {
            revert MarketClosed(marketId);
        }
        if (status != MarketStatus.Open) {
            revert MarketNotOpen(marketId);
        }
        if (requestedAmount < BettingConstants.MIN_BET_AMOUNT || requestedAmount == 0) {
            revert BetAmountBelowMinimum(requestedAmount, BettingConstants.MIN_BET_AMOUNT);
        }
        if (outcome >= outcomeCount) {
            revert MarketTemplateNotAllowed(marketType, line);
        }
        if (guard.quoteVersion != quoteVersion) {
            revert InvalidQuoteGuard();
        }
        if (guard.quotedAt != updatedAt) {
            revert InvalidQuoteGuard();
        }
        if (currentTimestamp > guard.deadline) {
            revert InvalidQuoteGuard();
        }
    }

    function validateBetLimits(
        address user,
        bytes32 marketId,
        uint256 currentDailyAcceptedAmount,
        uint256 currentUnsettledStake,
        uint256 currentPotentialPayoutCommitted,
        uint256 activeStakeAmount,
        uint256 dailyLimit,
        uint256 acceptedAmount,
        uint256 potentialPayout,
        uint256 availableLiquidity,
        uint256 minAcceptedAmount,
        uint256 lockedOdds,
        uint256 minOdds
    ) public pure {
        if (currentDailyAcceptedAmount + acceptedAmount > dailyLimit) {
            revert DailyLimitExceeded(
                user, currentDailyAcceptedAmount + acceptedAmount, dailyLimit - currentDailyAcceptedAmount
            );
        }

        uint256 allowedOpenPosition = activeStakeAmount > StakingConstants.OPEN_POSITION_STAKE_FREE_THRESHOLD
            ? activeStakeAmount
            : StakingConstants.OPEN_POSITION_STAKE_FREE_THRESHOLD;
        if (currentUnsettledStake + acceptedAmount > allowedOpenPosition) {
            revert OpenPositionExceeded(user, currentUnsettledStake + acceptedAmount, allowedOpenPosition);
        }

        if (currentPotentialPayoutCommitted + potentialPayout > BettingConstants.SINGLE_MATCH_PAYOUT_CAP) {
            revert MatchPayoutExceeded(
                user,
                marketId,
                currentPotentialPayoutCommitted + potentialPayout,
                BettingConstants.SINGLE_MATCH_PAYOUT_CAP
            );
        }
        if (potentialPayout > availableLiquidity) {
            revert PoolLiquidityInsufficient(potentialPayout, availableLiquidity);
        }
        if (acceptedAmount < minAcceptedAmount) {
            revert InvalidQuoteGuard();
        }
        if (lockedOdds < minOdds) {
            revert InvalidQuoteGuard();
        }
    }
}
