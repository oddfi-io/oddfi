// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {PrecisionConstants} from "../../shared/constants/PrecisionConstants.sol";
import {BettingConstants} from "../../shared/constants/BettingConstants.sol";
import {MarketStatus} from "../../shared/types/MarketEnums.sol";
import {
    MarketFinalResult,
    ParlayBet,
    ParlayEstimatedValue,
    ParlayLeg,
    ParlayLegInput,
    ParlayLegResult,
    ParlayPreview,
    ParlayState
} from "../../shared/types/ParlayTypes.sol";
import {
    InvalidQuoteGuard,
    MarketClosed,
    MarketLocked,
    MarketNotOpen,
    MarketTemplateNotAllowed,
    PoolLiquidityInsufficient
} from "../../shared/errors/BettingErrors.sol";
import {
    DuplicateParlayMarket,
    DuplicateParlayMatch,
    InvalidParlayLegCount,
    InvalidParlayState
} from "../../shared/errors/ParlayErrors.sol";
import {BettingPoolStorage} from "./BettingPoolStorage.sol";
import {BettingScoreResultLib} from "./BettingScoreResultLib.sol";

interface IBettingParlayLensPool {
    function liquidityPool() external view returns (address);

    function taxBuffer() external view returns (uint256);

    function platformReserve() external view returns (uint256);

    function openParlayMaxPayout() external view returns (uint256);

    function getMarket(bytes32 marketId) external view returns (BettingPoolStorage.MarketConfig memory);

    function getMarketOdds(bytes32 marketId)
        external
        view
        returns (uint256[] memory baseOdds, uint256[] memory quotedOdds, uint64 updatedAt, uint256 quoteVersion);

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

    function marketFinalResults(bytes32 marketId)
        external
        view
        returns (bool finalized, uint8 resultKind, bool scoreSettled, uint16 homeScore, uint16 awayScore);
}

interface IParlayLensLiquidityPool {
    function getGlobalRequestableLiquidity() external view returns (uint256);
}

contract BettingParlayLens {
    uint256 private constant FACTOR_SCALE = 1e18;

    function previewParlay(address bettingPool, ParlayLegInput[] calldata legs, uint256 stake, address)
        external
        view
        returns (ParlayPreview memory preview)
    {
        IBettingParlayLensPool pool = IBettingParlayLensPool(bettingPool);
        uint256 legCount = legs.length;
        if (legCount < BettingConstants.PARLAY_MIN_LEGS || legCount > BettingConstants.PARLAY_MAX_LEGS) {
            revert InvalidParlayLegCount(legCount, BettingConstants.PARLAY_MIN_LEGS, BettingConstants.PARLAY_MAX_LEGS);
        }
        if (stake < BettingConstants.MIN_BET_AMOUNT || stake == 0) {
            revert PoolLiquidityInsufficient(stake, BettingConstants.MIN_BET_AMOUNT);
        }

        bytes32[] memory seenMarkets = new bytes32[](legCount);
        bytes32[] memory seenMatches = new bytes32[](legCount);
        preview.rawComboOdds = PrecisionConstants.ODDS_RATE_SCALE;
        preview.lockedComboOdds = PrecisionConstants.ODDS_RATE_SCALE;

        for (uint256 i = 0; i < legCount; ++i) {
            BettingPoolStorage.MarketConfig memory market = pool.getMarket(legs[i].marketId);
            if (market.matchId == bytes32(0)) revert MarketNotOpen(legs[i].marketId);
            if (market.status == MarketStatus.Locked) revert MarketLocked(legs[i].marketId);
            if (_isTerminal(market.status) || block.timestamp >= market.matchEndTime) {
                revert MarketClosed(legs[i].marketId);
            }
            if (market.status != MarketStatus.Open) revert MarketNotOpen(legs[i].marketId);
            if (legs[i].outcome >= market.outcomeCount) {
                revert MarketTemplateNotAllowed(market.marketType, market.line);
            }
            _validateNoDuplicateLeg(seenMarkets, seenMatches, i, legs[i].marketId, market.matchId);
            seenMarkets[i] = legs[i].marketId;
            seenMatches[i] = market.matchId;

            (, uint256[] memory quotedOdds, uint64 updatedAt, uint256 quoteVersion) =
                pool.getMarketOdds(legs[i].marketId);
            if (
                legs[i].outcome >= quotedOdds.length || legs[i].quoteVersion != quoteVersion
                    || legs[i].quotedAt != updatedAt
            ) {
                revert InvalidQuoteGuard();
            }
            uint256 lockedOdds = quotedOdds[legs[i].outcome];
            if (lockedOdds < legs[i].minOdds) revert InvalidQuoteGuard();
            uint256 rawBefore = preview.rawComboOdds;
            preview.rawComboOdds = _mulOddsCapped(rawBefore, lockedOdds, type(uint256).max);
            uint256 lockedBefore = preview.lockedComboOdds;
            preview.lockedComboOdds = _mulOddsCapped(lockedBefore, lockedOdds, BettingConstants.PARLAY_ODDS_RATE_CAP);
            if (
                preview.lockedComboOdds == BettingConstants.PARLAY_ODDS_RATE_CAP
                    && preview.rawComboOdds > preview.lockedComboOdds
            ) {
                preview.cappedByOdds = true;
            }
        }

        uint256 rawMaxPayout = stake * preview.lockedComboOdds / PrecisionConstants.ODDS_RATE_SCALE;
        preview.maxPayout = rawMaxPayout;
        if (preview.maxPayout > BettingConstants.SINGLE_MATCH_PAYOUT_CAP) {
            preview.maxPayout = BettingConstants.SINGLE_MATCH_PAYOUT_CAP;
            preview.cappedByPayout = true;
        }
        preview.maxRequiredPayout = preview.maxPayout;
        preview.availableParlayCapacity = _availableParlayCapacity(pool);
    }

    function estimateParlayValue(address bettingPool, address userAddress, bytes32 parlayId)
        external
        view
        returns (ParlayEstimatedValue memory estimated)
    {
        IBettingParlayLensPool pool = IBettingParlayLensPool(bettingPool);
        ParlayBet memory parlay = _getParlay(pool, parlayId);
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
            ParlayLeg memory leg = _getParlayLeg(pool, parlayId, i);
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

    function _getParlay(IBettingParlayLensPool pool, bytes32 parlayId) internal view returns (ParlayBet memory parlay) {
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

    function _getParlayLeg(IBettingParlayLensPool pool, bytes32 parlayId, uint256 index)
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

    function _availableParlayCapacity(IBettingParlayLensPool pool) internal view returns (uint256) {
        uint256 rawCapacity = IParlayLensLiquidityPool(pool.liquidityPool()).getGlobalRequestableLiquidity()
            + pool.taxBuffer() + pool.platformReserve();
        uint256 openMaxPayout = pool.openParlayMaxPayout();
        if (rawCapacity <= openMaxPayout) {
            return 0;
        }
        return rawCapacity - openMaxPayout;
    }

    function _validateNoDuplicateLeg(
        bytes32[] memory seenMarkets,
        bytes32[] memory seenMatches,
        uint256 preparedCount,
        bytes32 marketId,
        bytes32 matchId
    ) internal pure {
        for (uint256 i = 0; i < preparedCount; ++i) {
            if (seenMarkets[i] == marketId) revert DuplicateParlayMarket(marketId);
            if (seenMatches[i] == matchId) revert DuplicateParlayMatch(matchId);
        }
    }

    function _isTerminal(MarketStatus status) internal pure returns (bool) {
        return status == MarketStatus.Settled || status == MarketStatus.Refunded || status == MarketStatus.Cancelled;
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
}
