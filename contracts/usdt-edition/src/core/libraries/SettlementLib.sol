// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../shared/types/BetTypes.sol";
import "../../shared/constants/Constants.sol";

library SettlementLib {
    struct SettleContext {
        mapping(address => uint256) userBalances;
        mapping(address => uint256) lockedBalances;
        uint256 bettingPool;
        uint256 platformBalance;
        uint256 totalPotentialPayout;
        uint256 totalUserBalances;
        uint256 lpShareBps;
    }

    /// @notice Settle a normal (non-parlay, non-credit) bet.
    /// Returns (payout, isWon) where payout is the total payout for a win, 0 for loss.
    function settleNormalBet(
        Bet storage bet,
        uint8 winningOutcome,
        mapping(address => uint256) storage userBalances,
        mapping(address => uint256) storage lockedBalances,
        mapping(bytes32 => uint256) storage collateralUsed,
        bytes32 betId,
        uint256 lpShareBps,
        uint256 bpsDenum
    )
        internal
        returns (
            uint256 payout,
            bool isWon
        )
    {
        address user = bet.user;
        uint256 amount = bet.amount;
        uint256 lockedOdds = bet.lockedOdds;
        uint256 potPayout = (amount * lockedOdds) / ODDS_PRECISION;

        if (bet.outcome == winningOutcome) {
            // Winner
            isWon = true;
            payout = potPayout;
            userBalances[user] += (payout - amount);
            lockedBalances[user] -= amount;
            // bettingPool and totalPotentialPayout updated by caller
            bet.status = BetStatus.Won;
        } else {
            // Loser
            isWon = false;
            payout = 0;
            userBalances[user] -= amount;
            lockedBalances[user] -= amount;
            // bettingPool split done by caller
            bet.status = BetStatus.Lost;
        }

        // Clean up collateralUsed if this bet was used as collateral
        if (collateralUsed[betId] > 0) {
            collateralUsed[betId] = 0;
        }
    }
}
