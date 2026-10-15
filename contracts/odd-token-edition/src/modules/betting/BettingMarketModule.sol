// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {PrecisionConstants} from "../../shared/constants/PrecisionConstants.sol";
import {BettingConstants} from "../../shared/constants/BettingConstants.sol";
import {MarketStatus, SignalColor} from "../../shared/types/MarketEnums.sol";
import {
    MarketAlreadyExists,
    MarketClosed,
    MarketLocked,
    MarketNotOpen,
    MarketTemplateNotAllowed,
    SettlementCannotClose
} from "../../shared/errors/BettingErrors.sol";
import {BettingOddsLib} from "./BettingOddsLib.sol";
import {ILiquidityPoolSettlementV1} from "./interfaces/ILiquidityPoolSettlementV1.sol";
import {BettingPoolStorage} from "./BettingPoolStorage.sol";

interface IBettingMarketModulePool {
    function wclYellowThreshold() external view returns (uint256);
    function wclOrangeThreshold() external view returns (uint256);
    function wclRedThreshold() external view returns (uint256);
    function getMarket(bytes32 marketId) external view returns (BettingPoolStorage.MarketConfig memory);
    function getMatchMarketIds(bytes32 matchId) external view returns (bytes32[] memory);
    function getMarketOdds(bytes32 marketId)
        external
        view
        returns (uint256[] memory baseOdds, uint256[] memory quotedOdds, uint64 updatedAt, uint256 quoteVersion);
    function getMarketExposure(bytes32 marketId)
        external
        view
        returns (uint256[] memory totalStakedByOutcome, uint256[] memory payoutByOutcome, SignalColor signalColor);
}

contract BettingMarketModule is BettingPoolStorage {
    address private immutable SELF = address(this);

    modifier onlyDelegateCall() {
        _onlyDelegateCall();
        _;
    }

    function _onlyDelegateCall() internal view {
        if (address(this) == SELF) revert SettlementCannotClose(bytes32(0));
    }

    function openMarket(
        bytes32 matchId,
        uint8 marketType,
        uint8 line,
        uint64 matchStartTime,
        uint64 matchEndTime,
        uint256[] calldata baseOdds,
        uint64 updatedAt
    ) external onlyDelegateCall returns (bytes32 marketId) {
        uint8 outcomeCount = BettingOddsLib.validateTemplate(marketType, line, baseOdds.length);
        BettingOddsLib.validateOddsArray(baseOdds);
        marketId = keccak256(abi.encode(matchId, marketType, line));
        if (_marketExists(markets[marketId])) {
            revert MarketAlreadyExists(marketId);
        }

        uint64 lockAt =
            _initializeMarketStorage(marketId, matchId, marketType, line, outcomeCount, matchStartTime, matchEndTime);
        uint256 quoteVersion = _initializeOddsAndExposure(
            marketId, matchId, baseOdds, outcomeCount, matchStartTime, matchEndTime, updatedAt
        );

        emit MarketOpened(marketId, matchId, marketType, line, matchStartTime, lockAt, quoteVersion);
        emit OddsUpdated(marketId, updatedAt, quoteVersion, uint8(marketExposure[marketId].signalColor));
    }

    function updateOdds(bytes32 marketId, uint256[] calldata baseOdds, uint64 updatedAt) external onlyDelegateCall {
        MarketConfig storage market = markets[marketId];
        if (!_marketExists(market)) {
            revert MarketClosed(marketId);
        }
        if (_isTerminal(market.status) || block.timestamp >= market.matchEndTime) {
            revert MarketClosed(marketId);
        }
        if (market.status == MarketStatus.Locked) {
            revert MarketLocked(marketId);
        }
        if (market.status != MarketStatus.Open) {
            revert MarketNotOpen(marketId);
        }
        if (baseOdds.length != market.outcomeCount) {
            revert MarketTemplateNotAllowed(market.marketType, market.line);
        }
        BettingOddsLib.validateOddsArray(baseOdds);

        MarketOdds storage odds = marketOdds[marketId];
        odds.baseOdds = _copyCalldataArray(baseOdds);
        odds.updatedAt = updatedAt;
        odds.quoteVersion += 1;

        _refreshExposureAndOdds(marketId);
        emit OddsUpdated(marketId, updatedAt, odds.quoteVersion, uint8(marketExposure[marketId].signalColor));
    }

    function previewSignal(address bettingPoolAddress, bytes32 marketId, uint8 outcome, uint256 requestedAmount)
        external
        view
        returns (
            uint8 signal,
            uint256 acceptedAmount,
            uint256 lockedOdds,
            bool partialFill,
            uint256 maxAcceptableAmount
        )
    {
        IBettingMarketModulePool pool = IBettingMarketModulePool(bettingPoolAddress);
        MarketConfig memory market = pool.getMarket(marketId);
        if (market.matchId == bytes32(0)) {
            revert MarketClosed(marketId);
        }
        if (_isTerminal(market.status)) {
            revert MarketClosed(marketId);
        }
        if (block.timestamp >= market.matchEndTime) {
            revert MarketClosed(marketId);
        }
        if (market.status == MarketStatus.Locked) {
            revert MarketLocked(marketId);
        }
        if (market.status != MarketStatus.Open) {
            revert MarketNotOpen(marketId);
        }
        if (requestedAmount == 0 || outcome >= market.outcomeCount) {
            revert MarketTemplateNotAllowed(market.marketType, market.line);
        }

        (SignalColor color, uint256 accepted, uint256 odds, bool partialFillResult, uint256 maxAmount) =
            _previewBet(pool, marketId, outcome, requestedAmount);
        return (uint8(color), accepted, odds, partialFillResult, maxAmount);
    }

    function isMatchTerminal(address bettingPoolAddress, bytes32 matchId) external view returns (bool) {
        IBettingMarketModulePool pool = IBettingMarketModulePool(bettingPoolAddress);
        bytes32[] memory marketIds = pool.getMatchMarketIds(matchId);
        if (marketIds.length == 0) {
            return false;
        }
        for (uint256 i = 0; i < marketIds.length; ++i) {
            MarketStatus status = pool.getMarket(marketIds[i]).status;
            if (!_isTerminal(status)) {
                return false;
            }
        }
        return true;
    }

    function _initializeMarketStorage(
        bytes32 marketId,
        bytes32 matchId,
        uint8 marketType,
        uint8 line,
        uint8 outcomeCount,
        uint64 matchStartTime,
        uint64 matchEndTime
    ) internal returns (uint64 lockAt) {
        lockAt = matchEndTime;
        markets[marketId] = MarketConfig({
            matchId: matchId,
            marketType: marketType,
            line: line,
            outcomeCount: outcomeCount,
            matchStartTime: matchStartTime,
            lockAt: lockAt,
            status: MarketStatus.Open,
            matchEndTime: matchEndTime
        });
    }

    function _initializeOddsAndExposure(
        bytes32 marketId,
        bytes32 matchId,
        uint256[] calldata baseOdds,
        uint8 outcomeCount,
        uint64 matchStartTime,
        uint64 matchEndTime,
        uint64 updatedAt
    ) internal returns (uint256 quoteVersion) {
        MarketOdds storage odds = marketOdds[marketId];
        odds.baseOdds = _copyCalldataArray(baseOdds);
        odds.quotedOdds = _copyCalldataArray(baseOdds);
        odds.updatedAt = updatedAt;
        odds.quoteVersion = 1;

        MarketExposure storage exposure = marketExposure[marketId];
        exposure.totalStakedByOutcome = new uint256[](outcomeCount);
        exposure.payoutByOutcome = new uint256[](outcomeCount);
        exposure.signalColor = SignalColor.Green;

        if (matchMarketIds[matchId].length == 0) {
            ILiquidityPoolSettlementV1(liquidityPool).openMatchPool(matchId, matchStartTime, matchEndTime);
        }
        matchMarketIds[matchId].push(marketId);
        quoteVersion = odds.quoteVersion;
    }

    function _previewBet(IBettingMarketModulePool pool, bytes32 marketId, uint8 outcome, uint256 requestedAmount)
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
        (uint256[] memory baseOdds, uint256[] memory quotedOdds,,) = pool.getMarketOdds(marketId);
        (uint256[] memory totalStakedByOutcome, uint256[] memory payoutByOutcome,) = pool.getMarketExposure(marketId);
        uint256 currentQuotedOdds = quotedOdds[outcome];
        if (currentQuotedOdds == 0) {
            revert MarketClosed(marketId);
        }
        uint256 currentOutcomePayout = payoutByOutcome[outcome];
        uint256 currentTotalStake = _sumArray(totalStakedByOutcome);
        uint256 currentWcl = BettingOddsLib.currentOutcomeWcl(currentOutcomePayout, currentTotalStake);
        uint256 redThreshold = pool.wclRedThreshold();
        uint256 yellowThreshold = pool.wclYellowThreshold();
        uint256 orangeThreshold = pool.wclOrangeThreshold();
        if (currentWcl >= redThreshold) {
            signal = BettingOddsLib.signalFor(currentWcl, yellowThreshold, orangeThreshold, redThreshold);
            return (signal, 0, currentQuotedOdds, true, 0);
        }

        uint256 redOdds = BettingOddsLib.redLineOdds(baseOdds[outcome]);
        uint256 candidateLockedOdds = currentQuotedOdds;
        if (requestedAmount > BettingConstants.SLIPPAGE_TRIGGER_AMOUNT) {
            (, candidateLockedOdds) = _previewPostTradeSignal(
                pool, marketId, outcome, requestedAmount, currentQuotedOdds, totalStakedByOutcome, payoutByOutcome
            );
        }

        uint256 candidatePayout =
            currentOutcomePayout + requestedAmount * candidateLockedOdds / PrecisionConstants.ODDS_RATE_SCALE;
        uint256 candidateTotalStake = currentTotalStake + requestedAmount;
        uint256 candidateWcl = BettingOddsLib.currentOutcomeWcl(candidatePayout, candidateTotalStake);

        maxAcceptableAmount =
            BettingOddsLib.maxStakeAtRedThreshold(currentOutcomePayout, currentTotalStake, redOdds, redThreshold);

        if (candidateWcl > redThreshold) {
            acceptedAmount = requestedAmount > maxAcceptableAmount ? maxAcceptableAmount : requestedAmount;
            partialFill = requestedAmount > maxAcceptableAmount;
            lockedOdds = redOdds;
            if (acceptedAmount == 0) {
                return (SignalColor.Red, 0, lockedOdds, true, 0);
            }
            (signal,) = _previewPostTradeSignal(
                pool, marketId, outcome, acceptedAmount, lockedOdds, totalStakedByOutcome, payoutByOutcome
            );
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

        (signal,) = _previewPostTradeSignal(
            pool, marketId, outcome, acceptedAmount, lockedOdds, totalStakedByOutcome, payoutByOutcome
        );
    }

    function _previewPostTradeSignal(
        IBettingMarketModulePool pool,
        bytes32 marketId,
        uint8 outcome,
        uint256 acceptedAmount,
        uint256 lockedOdds,
        uint256[] memory stakes,
        uint256[] memory payouts
    ) internal view returns (SignalColor signal, uint256 outcomeQuotedOdds) {
        (uint256[] memory baseOdds,,,) = pool.getMarketOdds(marketId);
        uint256[] memory stakesPreview = _copyMemoryArray(stakes);
        uint256[] memory payoutsPreview = _copyMemoryArray(payouts);
        stakesPreview[outcome] += acceptedAmount;
        payoutsPreview[outcome] += acceptedAmount * lockedOdds / PrecisionConstants.ODDS_RATE_SCALE;

        (uint256[] memory quotedOddsPreview,, SignalColor signalPreview) = BettingOddsLib.computeQuotedOdds(
            baseOdds,
            stakesPreview,
            payoutsPreview,
            pool.wclYellowThreshold(),
            pool.wclOrangeThreshold(),
            pool.wclRedThreshold()
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

    function _sumArray(uint256[] memory values) internal pure returns (uint256 total) {
        for (uint256 i = 0; i < values.length; ++i) {
            total += values[i];
        }
    }

    function _copyCalldataArray(uint256[] calldata values) internal pure returns (uint256[] memory result) {
        result = new uint256[](values.length);
        for (uint256 i = 0; i < values.length; ++i) {
            result[i] = values[i];
        }
    }

    function _copyMemoryArray(uint256[] memory values) internal pure returns (uint256[] memory result) {
        result = new uint256[](values.length);
        for (uint256 i = 0; i < values.length; ++i) {
            result[i] = values[i];
        }
    }

    function _marketExists(MarketConfig storage market) internal view returns (bool) {
        return market.matchId != bytes32(0);
    }

    function _isTerminal(MarketStatus status) internal pure returns (bool) {
        return status == MarketStatus.Settled || status == MarketStatus.Refunded || status == MarketStatus.Cancelled;
    }
}
