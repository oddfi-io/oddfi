// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {PrecisionConstants} from "../../shared/constants/PrecisionConstants.sol";
import {BettingConstants} from "../../shared/constants/BettingConstants.sol";
import {BetSettlementState, MarketStatus, SignalColor} from "../../shared/types/MarketEnums.sol";
import {MarketFinalResult} from "../../shared/types/ParlayTypes.sol";
import {InvalidAddress} from "../../shared/errors/CommonErrors.sol";
import {
    RefundAmountExceeded,
    InvalidBetState,
    RefundBatchTooLarge,
    BetNotOwner,
    PoolLiquidityInsufficient,
    InvalidQuoteGuard,
    MarketClosed,
    MarketLocked,
    MarketNotOpen,
    PayoutAlreadyClaimed,
    PayoutNotClaimable,
    PayoutTooSmall,
    SettlementCannotClose
} from "../../shared/errors/BettingErrors.sol";
import {BettingOddsLib} from "./BettingOddsLib.sol";
import {BettingScoreResultLib} from "./BettingScoreResultLib.sol";
import {ILiquidityPoolSettlementV1} from "./interfaces/ILiquidityPoolSettlementV1.sol";
import {IStakingHookV2} from "../staking/interfaces/IStakingHookV2.sol";
import {IODDTokenBusiness} from "../token/interfaces/IODDTokenBusiness.sol";
import {TokenBusinessTypes} from "../token/TokenBusinessTypes.sol";
import {BettingPoolStorage} from "./BettingPoolStorage.sol";

interface IBettingClaimStatusPool {
    function getBet(bytes32 betId) external view returns (BettingPoolStorage.Bet memory);

    function getMarket(bytes32 marketId) external view returns (BettingPoolStorage.MarketConfig memory);

    function getMarketOdds(bytes32 marketId)
        external
        view
        returns (uint256[] memory baseOdds, uint256[] memory quotedOdds, uint64 updatedAt, uint256 quoteVersion);
}

contract BettingSettlementModule is BettingPoolStorage {
    using SafeERC20 for IERC20;

    address private immutable SELF = address(this);

    struct BetSettlementBreakdown {
        uint256 refundStake;
        uint256 winStake;
        uint256 lossStake;
    }

    struct CashOutContext {
        bytes32 marketId;
        address owner;
        bytes32 matchId;
        uint256 remainingStake;
        uint256 releasedPayout;
        uint256 cashOutAmount;
        uint256 currentOdds;
        uint16 feeBps;
        uint256 quoteVersion;
    }

    modifier onlyDelegateCall() {
        _onlyDelegateCall();
        _;
    }

    function _onlyDelegateCall() internal view {
        if (address(this) == SELF) revert InvalidAddress();
    }

    function getClaimStatus(address bettingPoolAddress, address userAddress, bytes32 betId)
        external
        view
        returns (bool won, uint256 reward)
    {
        IBettingClaimStatusPool pool = IBettingClaimStatusPool(bettingPoolAddress);
        Bet memory bet = pool.getBet(betId);
        if (bet.owner == address(0)) {
            return (false, 0);
        }

        MarketConfig memory market = pool.getMarket(bet.marketId);
        if (block.timestamp < market.matchEndTime) {
            revert SettlementCannotClose(bet.marketId);
        }
        if (bet.owner != userAddress) {
            return (false, 0);
        }

        if (
            bet.settlementState == BetSettlementState.WonUnclaimed
                || bet.settlementState == BetSettlementState.WonClaimed
        ) {
            won = true;
            if (bet.settlementState == BetSettlementState.WonUnclaimed) {
                uint256 taxAmount = bet.claimablePayout * bet.payoutTaxRateBps / PrecisionConstants.BPS_SCALE;
                reward = bet.claimablePayout - taxAmount;
            }
        }
    }

    function estimateBetValue(address bettingPoolAddress, address userAddress, bytes32 betId)
        external
        view
        returns (uint256 estimatedValue, int256 floatingPnL)
    {
        IBettingClaimStatusPool pool = IBettingClaimStatusPool(bettingPoolAddress);
        Bet memory bet = pool.getBet(betId);
        if (bet.owner == address(0) || bet.owner != userAddress) {
            return (0, 0);
        }
        if (bet.settlementState != BetSettlementState.Pending) {
            revert PayoutNotClaimable(betId);
        }

        MarketConfig memory market = pool.getMarket(bet.marketId);
        if (_isTerminal(market.status) || block.timestamp >= market.matchEndTime) {
            revert MarketClosed(bet.marketId);
        }

        (, uint256[] memory quotedOdds,,) = pool.getMarketOdds(bet.marketId);
        uint256 currentOdds = quotedOdds[bet.outcome];
        uint256 remainingStake = bet.acceptedAmount - bet.refundedAmount;
        uint256 releasedPayout = remainingStake * bet.lockedOdds / PrecisionConstants.ODDS_RATE_SCALE;
        estimatedValue = releasedPayout * PrecisionConstants.ODDS_RATE_SCALE / currentOdds;
        // Safe: bet amounts are bounded by platform payout caps and fit in int256.
        // forge-lint: disable-next-line(unsafe-typecast)
        floatingPnL = int256(estimatedValue) - int256(remainingStake);
    }

    function lockMarket(bytes32 marketId) external onlyDelegateCall {
        MarketConfig storage market = markets[marketId];
        if (!_marketExists(market) || _isTerminal(market.status)) revert MarketClosed(marketId);
        if (market.status == MarketStatus.Locked) revert MarketLocked(marketId);
        if (market.status != MarketStatus.Open) revert MarketNotOpen(marketId);
        if (block.timestamp > market.matchEndTime) revert MarketClosed(marketId);

        uint64 lockedAt = uint64(block.timestamp);
        uint256 quoteVersion = marketOdds[marketId].quoteVersion + 1;

        market.status = MarketStatus.Locked;
        market.lockAt = lockedAt;
        marketOdds[marketId].quoteVersion = quoteVersion;
        emit MarketManuallyLocked(marketId, market.matchId, msg.sender, lockedAt, quoteVersion);

        ILiquidityPoolSettlementV1(liquidityPool).closeMatchPoolDeposit(market.matchId);
    }

    function settleMarketBetsByScore(bytes32 marketId, uint16 homeScore, uint16 awayScore, bytes32[] calldata betIds)
        external
        onlyDelegateCall
    {
        MarketConfig storage market = markets[marketId];
        if (!_marketExists(market) || _isTerminal(market.status)) revert SettlementCannotClose(marketId);
        if (block.timestamp < market.matchEndTime) revert SettlementCannotClose(marketId);
        if (homeScore > BettingConstants.MAX_SETTLEMENT_SCORE || awayScore > BettingConstants.MAX_SETTLEMENT_SCORE) {
            revert SettlementCannotClose(marketId);
        }
        uint256 totalBetCount = marketBetIds[marketId].length;
        if (betIds.length > BettingConstants.FINALIZE_BATCH_HARD_CAP) {
            revert RefundBatchTooLarge(betIds.length, BettingConstants.FINALIZE_BATCH_HARD_CAP);
        }
        if (betIds.length == 0 && totalBetCount > 0 && marketPreClosedBetCount[marketId] != totalBetCount) {
            revert RefundBatchTooLarge(betIds.length, BettingConstants.FINALIZE_BATCH_HARD_CAP);
        }

        MarketSettlementProgress storage progress = marketSettlementProgress[marketId];
        if (!progress.active) {
            progress.active = true;
            progress.homeScore = homeScore;
            progress.awayScore = awayScore;
        } else if (progress.homeScore != homeScore || progress.awayScore != awayScore) {
            revert SettlementCannotClose(marketId);
        }

        SettlementContext memory context;
        for (uint256 i = 0; i < betIds.length; ++i) {
            Bet storage bet = bets[betIds[i]];
            if (bet.marketId != marketId || bet.settlementState != BetSettlementState.Pending) {
                revert InvalidBetState(betIds[i], uint8(bet.settlementState));
            }

            uint256 currentOrderAmount = bet.acceptedAmount - bet.refundedAmount;
            uint256 releasedPotentialPayout = currentOrderAmount * bet.lockedOdds / PrecisionConstants.ODDS_RATE_SCALE;
            BetSettlementBreakdown memory breakdown =
                _resolveBetBreakdown(market, bet.outcome, currentOrderAmount, homeScore, awayScore);
            _materializeScoreSettledBet(
                marketId, betIds[i], bet, currentOrderAmount, releasedPotentialPayout, breakdown, context
            );
        }

        progress.processedCount += betIds.length;
        progress.totalStake += context.totalStake;
        progress.grossPayout += context.grossPayout;
        progress.loserStakes += context.loserStakes;
        _refreshExposureAndOdds(marketId);
        emit MarketSettlementScoreBatchProcessed(marketId, homeScore, awayScore, progress.processedCount, totalBetCount);
    }

    function finalizeMarketSettlement(bytes32 marketId, uint8 resultKindRaw) external onlyDelegateCall {
        MarketConfig storage market = markets[marketId];
        if (!_marketExists(market) || _isTerminal(market.status)) {
            revert SettlementCannotClose(marketId);
        }
        if (block.timestamp < market.matchEndTime) revert SettlementCannotClose(marketId);
        if (resultKindRaw > uint8(SettlementResultKind.Cancelled)) revert SettlementCannotClose(marketId);

        SettlementResultKind resultKind = SettlementResultKind(resultKindRaw);
        MarketSettlementProgress storage progress = marketSettlementProgress[marketId];
        SettlementContext memory context;
        bool scoreSettled;
        uint16 homeScore;
        uint16 awayScore;

        if (resultKind == SettlementResultKind.Settled) {
            uint256 totalBetCount = marketBetIds[marketId].length;
            if (totalBetCount > 0 || progress.active) {
                if (!progress.active || progress.processedCount + marketPreClosedBetCount[marketId] != totalBetCount) {
                    revert SettlementCannotClose(marketId);
                }
                scoreSettled = true;
                homeScore = progress.homeScore;
                awayScore = progress.awayScore;
                context.totalStake = progress.totalStake;
                context.grossPayout = progress.grossPayout;
                context.loserStakes = progress.loserStakes;
            }
            uint256 totalMargin = context.totalStake * 1000 / PrecisionConstants.BPS_SCALE;
            context.lpMarginShare = totalMargin * lpMarginShareBps / PrecisionConstants.BPS_SCALE;
            context.platformMarginShare = totalMargin - context.lpMarginShare;
            uint256 selfFundedPayout = context.totalStake - totalMargin;
            context.netLoss = context.grossPayout > selfFundedPayout ? context.grossPayout - selfFundedPayout : 0;
            _applySettlementAccounting(market, resultKind, context);
            delete marketSettlementProgress[marketId];
        } else {
            if (progress.active) revert SettlementCannotClose(marketId);
            _applySettlementAccounting(market, resultKind, context);
        }

        marketFinalResults[marketId] = MarketFinalResult({
            finalized: true,
            resultKind: resultKindRaw,
            scoreSettled: scoreSettled,
            homeScore: homeScore,
            awayScore: awayScore
        });

        uint256 quoteVersion = marketOdds[marketId].quoteVersion + 1;
        marketOdds[marketId].quoteVersion = quoteVersion;
        emit MarketFinalResultRecorded(marketId, resultKindRaw, scoreSettled, homeScore, awayScore);
        emit MarketSettlementFinalized(
            marketId,
            resultKindRaw,
            scoreSettled,
            homeScore,
            awayScore,
            context.grossPayout,
            context.lpMarginShare,
            context.platformMarginShare,
            quoteVersion
        );
    }

    function refundBets(bytes32 marketId, bytes32[] calldata betIds, uint256[] calldata refundAmounts)
        external
        onlyDelegateCall
    {
        if (betIds.length != refundAmounts.length) {
            revert RefundAmountExceeded(bytes32(0), betIds.length, refundAmounts.length);
        }
        if (betIds.length > BettingConstants.REFUND_BATCH_DEFAULT) {
            revert RefundBatchTooLarge(betIds.length, BettingConstants.REFUND_BATCH_DEFAULT);
        }
        if (markets[marketId].status != MarketStatus.Refunded && markets[marketId].status != MarketStatus.Cancelled) {
            revert SettlementCannotClose(marketId);
        }

        _refundBetsInternal(marketId, betIds, refundAmounts, uint8(markets[marketId].status));
    }

    function claimPayout(bytes32 betId) external onlyDelegateCall {
        Bet storage bet = bets[betId];
        if (bet.owner != msg.sender) revert BetNotOwner(betId, msg.sender);
        if (bet.settlementState == BetSettlementState.WonClaimed) revert PayoutAlreadyClaimed(betId);
        if (bet.settlementState != BetSettlementState.WonUnclaimed) revert PayoutNotClaimable(betId);
        if (markets[bet.marketId].status != MarketStatus.Settled) revert PayoutNotClaimable(betId);

        uint256 grossPayout = bet.claimablePayout;
        uint256 taxAmount = grossPayout * bet.payoutTaxRateBps / PrecisionConstants.BPS_SCALE;
        uint256 netPayout = grossPayout - taxAmount;
        if (netPayout == 0) revert PayoutTooSmall();

        bet.settlementState = BetSettlementState.WonClaimed;

        uint256 actualBalance = oddToken.balanceOf(address(this));
        if (actualBalance < grossPayout) {
            uint256 amountNeeded = grossPayout - actualBalance;
            ILiquidityPoolSettlementV1(liquidityPool)
                .requestPayoutLiquidity(markets[bet.marketId].matchId, amountNeeded);
            accountedBalance += amountNeeded;
        }

        _distributePayoutTax(bet, taxAmount);
        accountedBalance -= netPayout;
        _registerBetOutcome(msg.sender, betId, netPayout, true);

        emit BetClaimed(betId, bet.marketId, msg.sender, netPayout, msg.sender);
        emit PayoutClaimed(betId, msg.sender, grossPayout, taxAmount, netPayout);
    }

    function releasePayoutReserve(bytes32 riskId) external onlyDelegateCall {
        uint256 releasedAmount = ILiquidityPoolSettlementV1(liquidityPool).releasePayoutReserve(riskId);
        if (releasedAmount > 0 && lpLossOffsetRemaining > 0) {
            uint256 offsetAmount = releasedAmount <= lpLossOffsetRemaining ? releasedAmount : lpLossOffsetRemaining;
            lpLossOffsetRemaining -= offsetAmount;
            emit LpLossOffsetApplied(offsetAmount, lpLossOffsetRemaining);
        }
    }

    function cashOut(
        bytes32 betId,
        uint256 expectedQuoteVersion,
        uint64 quotedAt,
        uint256 minAmountOut,
        uint256 deadline
    ) external onlyDelegateCall {
        Bet storage bet = bets[betId];
        if (bet.owner != msg.sender) revert BetNotOwner(betId, msg.sender);
        if (bet.settlementState != BetSettlementState.Pending) {
            revert InvalidBetState(betId, uint8(bet.settlementState));
        }

        MarketConfig storage market = markets[bet.marketId];
        _validateCashOutMarket(bet.marketId, market);
        CashOutContext memory context =
            _cashOutContext(bet, market, expectedQuoteVersion, quotedAt, minAmountOut, deadline);

        bet.settlementState = BetSettlementState.CashedOut;
        marketPreClosedBetCount[context.marketId] += 1;
        _applyCashOutRiskRollback(bet, context.remainingStake, context.releasedPayout);

        _refreshExposureAndOdds(context.marketId);
        marketOdds[context.marketId].quoteVersion = context.quoteVersion;

        emit BetCashedOut(
            betId,
            context.marketId,
            context.owner,
            context.remainingStake,
            context.cashOutAmount,
            context.currentOdds,
            context.feeBps,
            context.quoteVersion
        );
        emit OddsUpdated(
            context.marketId,
            marketOdds[context.marketId].updatedAt,
            context.quoteVersion,
            uint8(marketExposure[context.marketId].signalColor)
        );

        _settleCashOutFunds(betId, context.matchId, context.owner, context.remainingStake, context.cashOutAmount);
    }

    function _refundBetsInternal(
        bytes32 marketId,
        bytes32[] calldata betIds,
        uint256[] memory refundAmounts,
        uint8 reasonCode
    ) internal returns (uint256 totalRefundAmount) {
        uint256 refundQuoteVersion = marketOdds[marketId].quoteVersion + 1;
        for (uint256 i = 0; i < betIds.length; ++i) {
            Bet storage bet = bets[betIds[i]];
            if (bet.marketId != marketId || bet.settlementState != BetSettlementState.Pending) {
                revert InvalidBetState(betIds[i], uint8(bet.settlementState));
            }

            uint256 currentOrderAmount = bet.acceptedAmount - bet.refundedAmount;
            uint256 refundAmount = refundAmounts[i];
            if (refundAmount > currentOrderAmount) {
                revert RefundAmountExceeded(betIds[i], refundAmount, currentOrderAmount);
            }
            if (oddToken.balanceOf(address(this)) < refundAmount) {
                revert PoolLiquidityInsufficient(refundAmount, oddToken.balanceOf(address(this)));
            }

            bet.refundedAmount += refundAmount;
            if (bet.refundedAmount == bet.acceptedAmount) {
                bet.settlementState = BetSettlementState.Refunded;
            }

            _applyRefundRiskRollback(bet, refundAmount);
            if (refundAmount > 0) {
                accountedBalance -= refundAmount;
                _registerBetOutcome(
                    bet.owner, betIds[i], refundAmount, bet.settlementState == BetSettlementState.Refunded
                );
            }
            totalRefundAmount += refundAmount;
            emit BetRefunded(betIds[i], marketId, bet.owner, refundAmount, reasonCode, refundQuoteVersion);
        }

        marketOdds[marketId].quoteVersion += 1;
        _refreshExposureAndOdds(marketId);
        emit OddsUpdated(
            marketId,
            marketOdds[marketId].updatedAt,
            marketOdds[marketId].quoteVersion,
            uint8(marketExposure[marketId].signalColor)
        );
        return totalRefundAmount;
    }

    function _distributePayoutTax(Bet storage bet, uint256 taxAmount) internal {
        if (taxAmount == 0 || bet.payoutTaxRateBps == 0) return;

        uint256 stakingShare = taxAmount * bet.taxAllocStakingBps / bet.payoutTaxRateBps;
        uint256 taxBufferShare = taxAmount * bet.taxAllocTaxBufferBps / bet.payoutTaxRateBps;
        uint256 referrerShare = taxAmount * bet.taxAllocReferrerBps / bet.payoutTaxRateBps;
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
            if (bet.referrerSnapshot != address(0)) {
                referrerRewardsOdd[bet.referrerSnapshot] += referrerShare;
                emit ReferralRewardAccumulated(bet.referrerSnapshot, referrerShare, bet.owner, 1);
            } else {
                platformShare += referrerShare;
            }
        }

        if (platformShare > 0) {
            accountedBalance -= platformShare;
            oddToken.safeTransfer(platformTreasury, platformShare);
        }
    }

    function _injectTaxBuffer(uint256 amount) internal {
        if (amount == 0) return;

        if (lpLossOffsetRemaining > 0) {
            // Offset historical L2 LP losses as an accounting priority before taxBuffer/reserve funding.
            // No ODD is transferred to LiquidityPool here and prior LP loss accounting is not reversed.
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
            // Safe: amount is bounded by taxAmount derived from claimable payout.
            // forge-lint: disable-next-line(unsafe-typecast)
            emit PlatformReserveUpdated(int256(amount), platformReserve, 3);
        }
    }

    function _validateCashOutMarket(bytes32 marketId, MarketConfig storage market) internal view {
        if (!_marketExists(market)) revert MarketClosed(marketId);
        if (market.status == MarketStatus.Locked) revert MarketLocked(marketId);
        if (_isTerminal(market.status) || block.timestamp >= market.matchEndTime) revert MarketClosed(marketId);
        if (market.status != MarketStatus.Open) revert MarketNotOpen(marketId);
    }

    function _cashOutContext(
        Bet storage bet,
        MarketConfig storage market,
        uint256 expectedQuoteVersion,
        uint64 quotedAt,
        uint256 minAmountOut,
        uint256 deadline
    ) internal view returns (CashOutContext memory context) {
        MarketOdds storage odds = marketOdds[bet.marketId];
        if (expectedQuoteVersion != odds.quoteVersion) revert InvalidQuoteGuard();
        if (quotedAt > block.timestamp) revert InvalidQuoteGuard();
        if (block.timestamp > uint256(quotedAt) + BettingConstants.CASH_OUT_QUOTE_TTL) revert InvalidQuoteGuard();
        if (block.timestamp > deadline) revert InvalidQuoteGuard();

        uint256 currentOdds = odds.quotedOdds[bet.outcome];
        if (currentOdds == 0) revert InvalidQuoteGuard();

        uint256 remainingStake = bet.acceptedAmount - bet.refundedAmount;
        if (remainingStake == 0) revert PayoutTooSmall();

        uint256 releasedPayout = remainingStake * bet.lockedOdds / PrecisionConstants.ODDS_RATE_SCALE;
        uint256 theoreticalValue = releasedPayout * PrecisionConstants.ODDS_RATE_SCALE / currentOdds;
        uint16 feeBps = _cashOutFeeBps(market.matchStartTime);
        uint256 cashOutAmount =
            theoreticalValue * (PrecisionConstants.BPS_SCALE - feeBps) / PrecisionConstants.BPS_SCALE;
        if (cashOutAmount < BettingConstants.MIN_CASH_OUT_AMOUNT) revert PayoutTooSmall();
        if (cashOutAmount < minAmountOut) revert InvalidQuoteGuard();

        context = CashOutContext({
            marketId: bet.marketId,
            owner: bet.owner,
            matchId: market.matchId,
            remainingStake: remainingStake,
            releasedPayout: releasedPayout,
            cashOutAmount: cashOutAmount,
            currentOdds: currentOdds,
            feeBps: feeBps,
            quoteVersion: odds.quoteVersion + 1
        });
    }

    function _cashOutFeeBps(uint64 matchStartTime) internal view returns (uint16) {
        if (
            uint256(matchStartTime) > BettingConstants.CASH_OUT_LATE_WINDOW
                && block.timestamp < uint256(matchStartTime) - BettingConstants.CASH_OUT_LATE_WINDOW
        ) {
            return BettingConstants.CASH_OUT_EARLY_FEE_BPS;
        }
        return BettingConstants.CASH_OUT_LATE_FEE_BPS;
    }

    function _applyCashOutRiskRollback(Bet storage bet, uint256 remainingStake, uint256 releasedPayout) internal {
        MarketExposure storage exposure = marketExposure[bet.marketId];
        exposure.totalStakedByOutcome[bet.outcome] -= remainingStake;
        exposure.payoutByOutcome[bet.outcome] -= releasedPayout;

        userRiskLedger[bet.owner].unsettledStake -= remainingStake;
        userMarketExposure[bet.owner][bet.marketId].potentialPayoutCommitted -= releasedPayout;
    }

    function _settleCashOutFunds(
        bytes32 betId,
        bytes32 matchId,
        address owner,
        uint256 remainingStake,
        uint256 cashOutAmount
    ) internal {
        uint256 lpLossBooked = 0;
        if (cashOutAmount <= remainingStake) {
            uint256 retained = remainingStake - cashOutAmount;
            if (retained > 0) {
                platformReserve += retained;
                // Safe: retained is derived from accepted stake already held by this contract.
                // forge-lint: disable-next-line(unsafe-typecast)
                emit PlatformReserveUpdated(int256(retained), platformReserve, 5);
            }
        } else {
            lpLossBooked = _waterfall(matchId, cashOutAmount - remainingStake);
            accountedBalance += lpLossBooked;
        }

        if (cashOutAmount > accountedBalance) {
            revert PoolLiquidityInsufficient(cashOutAmount, accountedBalance);
        }
        accountedBalance -= cashOutAmount;

        if (lpLossBooked > 0) {
            ILiquidityPoolSettlementV1(liquidityPool).requestPayoutLiquidity(matchId, lpLossBooked);
        }
        uint256 actualBalance = oddToken.balanceOf(address(this));
        if (actualBalance < cashOutAmount) {
            revert PoolLiquidityInsufficient(cashOutAmount, actualBalance);
        }

        _registerBetOutcome(owner, betId, cashOutAmount, true);
    }

    function _materializeScoreSettledBet(
        bytes32 marketId,
        bytes32 betId,
        Bet storage bet,
        uint256 currentOrderAmount,
        uint256 releasedPotentialPayout,
        BetSettlementBreakdown memory breakdown,
        SettlementContext memory context
    ) internal {
        userRiskLedger[bet.owner].unsettledStake -= currentOrderAmount;
        userMarketExposure[bet.owner][marketId].potentialPayoutCommitted -= releasedPotentialPayout;

        if (breakdown.refundStake > 0) {
            if (oddToken.balanceOf(address(this)) < breakdown.refundStake) {
                revert PoolLiquidityInsufficient(breakdown.refundStake, oddToken.balanceOf(address(this)));
            }
            bet.refundedAmount += breakdown.refundStake;
            _releaseMarketExposure(bet, breakdown.refundStake);
            accountedBalance -= breakdown.refundStake;
            _registerBetOutcome(bet.owner, betId, breakdown.refundStake, breakdown.winStake == 0);
            emit BetRefunded(
                betId,
                marketId,
                bet.owner,
                breakdown.refundStake,
                uint8(MarketStatus.Settled),
                marketOdds[marketId].quoteVersion
            );
        }

        context.totalStake += breakdown.winStake + breakdown.lossStake;

        if (breakdown.winStake > 0) {
            uint256 claimablePayout = breakdown.winStake * bet.lockedOdds / PrecisionConstants.ODDS_RATE_SCALE;
            bet.claimablePayout = claimablePayout;
            bet.payoutTaxRateBps = payoutTaxBps;
            bet.taxAllocStakingBps = taxAllocStakingBps;
            bet.taxAllocTaxBufferBps = taxAllocTaxBufferBps;
            bet.taxAllocReferrerBps = taxAllocReferrerBps;
            bet.referrerSnapshot = referrers[bet.owner];
            bet.settlementState = BetSettlementState.WonUnclaimed;
            context.grossPayout += claimablePayout;
            return;
        }

        if (breakdown.lossStake > 0) {
            bet.settlementState = BetSettlementState.Lost;
            context.loserStakes += breakdown.lossStake;
            if (breakdown.refundStake == 0) {
                _registerBetOutcome(bet.owner, betId, 0, true);
            }
            return;
        }

        bet.settlementState = BetSettlementState.Refunded;
    }

    function _resolveBetBreakdown(
        MarketConfig storage market,
        uint8 betOutcome,
        uint256 currentOrderAmount,
        uint16 homeScore,
        uint16 awayScore
    ) internal view returns (BetSettlementBreakdown memory breakdown) {
        BettingScoreResultLib.Result result = BettingScoreResultLib.resolve(
            market.marketType, market.line, betOutcome, homeScore, awayScore
        );
        if (result == BettingScoreResultLib.Result.FullWin) {
            breakdown.winStake = currentOrderAmount;
            return breakdown;
        }
        if (result == BettingScoreResultLib.Result.FullLoss) {
            breakdown.lossStake = currentOrderAmount;
            return breakdown;
        }
        if (result == BettingScoreResultLib.Result.FullPush) {
            breakdown.refundStake = currentOrderAmount;
            return breakdown;
        }

        uint256 halfStake = currentOrderAmount / 2;
        breakdown.refundStake = currentOrderAmount - halfStake;
        if (result == BettingScoreResultLib.Result.HalfWin) {
            breakdown.winStake = halfStake;
        } else {
            breakdown.lossStake = halfStake;
        }
    }

    function _applySettlementAccounting(
        MarketConfig storage market,
        SettlementResultKind resultKind,
        SettlementContext memory context
    ) internal {
        if (resultKind == SettlementResultKind.Settled) {
            market.status = MarketStatus.Settled;
            (uint256 globalWeight, uint256 matchWeight) =
                ILiquidityPoolSettlementV1(liquidityPool).getPoolWeights(market.matchId);
            bool hasActiveLpWeight = globalWeight + matchWeight > 0;
            if (context.lpMarginShare > 0 && hasActiveLpWeight) {
                accountedBalance -= context.lpMarginShare;
                oddToken.safeTransfer(liquidityPool, context.lpMarginShare);
                ILiquidityPoolSettlementV1(liquidityPool).distributeMargin(market.matchId, context.lpMarginShare);
            } else if (context.lpMarginShare > 0) {
                platformReserve += context.lpMarginShare;
                emit PlatformReserveUpdated(int256(context.lpMarginShare), platformReserve, 2);
            }
            if (context.platformMarginShare > 0) {
                platformReserve += context.platformMarginShare;
                // Safe: platformMarginShare is derived from total accepted stake held by this contract.
                // forge-lint: disable-next-line(unsafe-typecast)
                emit PlatformReserveUpdated(int256(context.platformMarginShare), platformReserve, 4);
            }

            if (context.netLoss > 0) {
                _waterfall(market.matchId, context.netLoss);
            }
            return;
        }

        if (resultKind == SettlementResultKind.Refunded) {
            market.status = MarketStatus.Refunded;
            return;
        }

        market.status = MarketStatus.Cancelled;
    }

    function _registerBetOutcome(address user, bytes32 betId, uint256 amount, bool finalized) internal {
        IODDTokenBusiness(address(oddToken))
            .registerBusinessOutcomeDelta(user, _betBusinessId(betId), amount, finalized);
    }

    function _betBusinessId(bytes32 betId) internal view returns (bytes32) {
        return keccak256(abi.encode(address(this), TokenBusinessTypes.BET_SINGLE, betId));
    }

    function _waterfall(bytes32 matchId, uint256 deficit) internal returns (uint256 lpLossBooked) {
        if (deficit == 0) return 0;

        if (deficit > 0) {
            lpLossBooked = ILiquidityPoolSettlementV1(liquidityPool).distributeLoss(matchId, deficit);
            deficit -= lpLossBooked;
            // Record the remaining L2 loss offset target. Future payout-tax buffer inflows consume this
            // marker before filling taxBuffer/reserve; they do not repay LP positions or reverse LP losses.
            lpLossOffsetRemaining += lpLossBooked;
        }

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
                emit ReserveTapped(matchId, l4Used, platformReserve);
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

        if (deficit > 0) revert SettlementCannotClose(matchId);
        return lpLossBooked;
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

    function _applyRefundRiskRollback(Bet storage bet, uint256 refundAmount) internal {
        uint256 releasedPayout = refundAmount * bet.lockedOdds / PrecisionConstants.ODDS_RATE_SCALE;
        MarketExposure storage exposure = marketExposure[bet.marketId];
        exposure.totalStakedByOutcome[bet.outcome] -= refundAmount;
        exposure.payoutByOutcome[bet.outcome] -= releasedPayout;

        UserRiskLedger storage riskLedger = userRiskLedger[bet.owner];
        if (_currentDayBucket() == bet.acceptedDayBucket) {
            riskLedger.dailyAcceptedAmount -= refundAmount;
        }
        riskLedger.unsettledStake -= refundAmount;
        userMarketExposure[bet.owner][bet.marketId].potentialPayoutCommitted -= releasedPayout;
        _refreshExposureAndOdds(bet.marketId);
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

    function _releaseMarketExposure(Bet storage bet, uint256 refundAmount) internal {
        uint256 releasedPayout = refundAmount * bet.lockedOdds / PrecisionConstants.ODDS_RATE_SCALE;
        MarketExposure storage exposure = marketExposure[bet.marketId];
        exposure.totalStakedByOutcome[bet.outcome] -= refundAmount;
        exposure.payoutByOutcome[bet.outcome] -= releasedPayout;
    }

    function _currentDayBucket() internal view returns (uint32) {
        return uint32(block.timestamp / PrecisionConstants.SECONDS_PER_DAY);
    }

    function _marketExists(MarketConfig storage market) internal view returns (bool) {
        return market.matchId != bytes32(0);
    }

    function _isTerminal(MarketStatus status) internal pure returns (bool) {
        return status == MarketStatus.Settled || status == MarketStatus.Refunded || status == MarketStatus.Cancelled;
    }
}
