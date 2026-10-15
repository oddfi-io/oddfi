// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../shared/types/BetTypes.sol";
import "../../shared/constants/Constants.sol";

library ParlayLib {
    event BetSettled(bytes32 indexed betId, address indexed user, BetStatus status, uint256 payout);
    event ParlayWon(bytes32 indexed parlayId, address indexed user, uint256 payout);
    event ParlayLost(bytes32 indexed parlayId, address indexed user, uint256 stake);
    event ParlayLegCancelled(bytes32 indexed parlayId, bytes32 indexed betId, uint256 newCombinedOdds);
    event ParlayDegradedToSingle(bytes32 indexed parlayId, bytes32 indexed remainingBetId, uint256 newOdds);
    event ParlayUnlocked(bytes32 indexed parlayId, address indexed user, uint256 stake);

    /// @notice Settle a parlay leg during a market settlement.
    /// @return settled True if the full parlay was settled (won or lost).
    function settleParlayLeg(
        bytes32 legBetId,
        bytes32 parlayId,
        uint8 winningOutcome,
        mapping(bytes32 => Bet) storage bets,
        mapping(bytes32 => Parlay) storage parlays,
        mapping(address => uint256) storage userBalances,
        mapping(address => uint256) storage lockedBalances,
        uint256 lpShareBps,
        uint256 bpsDenum
    ) internal returns (bool settled, uint256 payoutDelta, bool isWin) {
        Parlay storage parlay = parlays[parlayId];
        Bet storage bet = bets[legBetId];

        // If parlay already finished, skip
        if (parlay.status != BetStatus.Pending) {
            return (false, 0, false);
        }

        address user = parlay.user;
        bool legWon = (bet.outcome == winningOutcome);

        if (legWon) {
            bet.status = BetStatus.Won;
        } else {
            bet.status = BetStatus.Lost;
        }
        parlay.settledLegs += 1;

        if (!legWon) {
            // Entire parlay lost
            parlay.status = BetStatus.Lost;

            // Mark remaining pending legs as Cancelled
            bytes32[] storage legIds = parlay.legBetIds;
            for (uint256 i = 0; i < legIds.length; i++) {
                if (bets[legIds[i]].status == BetStatus.Pending) {
                    bets[legIds[i]].status = BetStatus.Cancelled;
                }
            }

            uint256 stake = parlay.stake;
            userBalances[user] -= stake;
            lockedBalances[user] -= stake;

            // totalPotentialPayout reduction = maxPayout (handled by caller)
            // bettingPool split (handled by caller)

            emit BetSettled(legBetId, user, BetStatus.Lost, 0);
            emit ParlayLost(parlayId, user, stake);

            return (true, parlay.maxPayout, false);
        } else {
            // Leg won
            parlay.wonLegs += 1;

            emit BetSettled(legBetId, user, BetStatus.Won, 0);

            // Check if all legs resolved
            if (parlay.wonLegs + parlay.cancelledLegs == parlay.legBetIds.length) {
                return _finalizeParlayWin(parlayId, parlays, userBalances, lockedBalances);
            }

            return (false, 0, true);
        }
    }

    /// @notice Finalize a parlay win (called when all legs resolved as won/cancelled).
    function _finalizeParlayWin(
        bytes32 parlayId,
        mapping(bytes32 => Parlay) storage parlays,
        mapping(address => uint256) storage userBalances,
        mapping(address => uint256) storage lockedBalances
    ) internal returns (bool settled, uint256 payoutDelta, bool isWin) {
        Parlay storage parlay = parlays[parlayId];
        address user = parlay.user;
        uint256 stake = parlay.stake;
        uint256 payout = (stake * parlay.combinedOdds) / ODDS_PRECISION;

        userBalances[user] += (payout - stake);
        lockedBalances[user] -= stake;
        parlay.status = BetStatus.Won;

        // bettingPool reduction = payout - stake (handled by caller)
        // totalPotentialPayout reduction = maxPayout (handled by caller)

        emit ParlayWon(parlayId, user, payout);

        return (true, parlay.maxPayout, true);
    }

    /// @notice Cancel a parlay leg during a market cancellation.
    /// Returns the old maxPayout and new maxPayout so caller can update totalPotentialPayout.
    function cancelParlayLeg(
        bytes32 legBetId,
        bytes32 parlayId,
        mapping(bytes32 => Bet) storage bets,
        mapping(bytes32 => Parlay) storage parlays,
        mapping(address => uint256) storage userBalances,
        mapping(address => uint256) storage lockedBalances
    ) internal returns (uint256 oldMaxPayout, uint256 newMaxPayout, bool parlayDone) {
        Parlay storage parlay = parlays[parlayId];
        Bet storage bet = bets[legBetId];

        // If parlay already finished, skip
        if (parlay.status != BetStatus.Pending) {
            return (0, 0, false);
        }

        bet.status = BetStatus.Cancelled;
        parlay.cancelledLegs += 1;

        oldMaxPayout = parlay.maxPayout;

        uint256 remainingLegs = parlay.legBetIds.length - parlay.cancelledLegs;

        if (remainingLegs == 0) {
            // All legs cancelled — full refund
            lockedBalances[parlay.user] -= parlay.stake;
            parlay.status = BetStatus.Cancelled;
            emit ParlayUnlocked(parlayId, parlay.user, parlay.stake);
            return (oldMaxPayout, oldMaxPayout, true);
        }

        // Recalculate combined odds removing this leg
        uint256 newCombinedOdds = (parlay.combinedOdds * ODDS_PRECISION) / bet.lockedOdds;

        if (remainingLegs == 1) {
            // Degrade to single — find the remaining non-cancelled leg
            bytes32 remainingBetId;
            bytes32[] storage legIds = parlay.legBetIds;
            for (uint256 i = 0; i < legIds.length; i++) {
                if (bets[legIds[i]].status != BetStatus.Cancelled) {
                    remainingBetId = legIds[i];
                    break;
                }
            }
            newCombinedOdds = bets[remainingBetId].lockedOdds;
            parlay.combinedOdds = newCombinedOdds;
            newMaxPayout = (parlay.stake * newCombinedOdds) / ODDS_PRECISION;
            parlay.maxPayout = newMaxPayout;
            emit ParlayDegradedToSingle(parlayId, remainingBetId, newCombinedOdds);
        } else {
            // Still a multi-leg parlay
            parlay.combinedOdds = newCombinedOdds;
            newMaxPayout = (parlay.stake * newCombinedOdds) / ODDS_PRECISION;
            parlay.maxPayout = newMaxPayout;
            emit ParlayLegCancelled(parlayId, legBetId, newCombinedOdds);
        }

        // Step 9: check auto-settle as Won if wonLegs + cancelledLegs == total
        if (parlay.wonLegs + parlay.cancelledLegs == parlay.legBetIds.length && parlay.status == BetStatus.Pending) {
            // Auto-settle as Won
            address user = parlay.user;
            uint256 stake = parlay.stake;
            uint256 payout = (stake * parlay.combinedOdds) / ODDS_PRECISION;

            userBalances[user] += (payout - stake);
            lockedBalances[user] -= stake;
            parlay.status = BetStatus.Won;

            // Caller must: totalPotentialPayout -= newMaxPayout (already updated above)
            // bettingPool -= (payout - stake)
            // Return newMaxPayout as the amount to deduct from totalPotentialPayout

            emit ParlayWon(parlayId, user, payout);
            return (oldMaxPayout, newMaxPayout, true);
        }

        return (oldMaxPayout, newMaxPayout, false);
    }
}
