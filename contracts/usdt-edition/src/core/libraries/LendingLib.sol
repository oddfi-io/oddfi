// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../shared/types/BetTypes.sol";
import "../../shared/constants/Constants.sol";

library LendingLib {
    event CreditBetSettled(
        bytes32 indexed betId,
        address indexed user,
        BetStatus status,
        uint256 payout,
        uint256 deduction
    );
    event CreditBetForfeited(bytes32 indexed betId, bytes32 indexed collateralBetId, uint256 amount);
    event CreditCollateralCancelled(bytes32 indexed betId, bytes32 indexed collateralBetId, uint256 amount);
    event CreditPayoutFrozen(bytes32 indexed betId, address indexed user, uint256 payout);
    event CreditPayoutReleased(bytes32 indexed betId, address indexed user, uint256 netPayout);
    event CreditPayoutForfeited(bytes32 indexed betId, uint256 payout);

    struct CreditSettleResult {
        // How much to add/subtract from bettingPool (signed via separate bool)
        uint256 bettingPoolDelta;
        bool bettingPoolIncrease; // true = add to pool, false = subtract from pool
        uint256 platformDelta;
        uint256 userBalanceDelta;
        bool userBalanceIncrease;
        uint256 totalUserBalancesDelta;
        bool totalUserBalancesIncrease;
        uint256 potPayoutReduction; // always reduces totalPotentialPayout
        bool frozen; // payout was frozen
        uint256 frozenAmount;
    }

    /// @notice Settle a credit bet. Returns structured deltas for caller to apply.
    function settleCreditBet(
        bytes32 betId,
        uint8 winningOutcome,
        mapping(bytes32 => Bet) storage bets,
        mapping(bytes32 => uint256) storage frozenPayouts,
        uint256 lpShareBps,
        uint256 bpsDenum
    ) internal returns (CreditSettleResult memory result) {
        Bet storage bet = bets[betId];
        bytes32 collateralBetId = bet.collateralBetId;
        Bet storage collateralBet = bets[collateralBetId];
        BetStatus collateralStatus = collateralBet.status;

        uint256 amount = bet.amount;
        uint256 lockedOdds = bet.lockedOdds;
        uint256 potPayout = (amount * lockedOdds) / ODDS_PRECISION;
        bool betWon = (bet.outcome == winningOutcome);

        result.potPayoutReduction = potPayout;

        if (collateralStatus == BetStatus.Lost) {
            // Collateral lost: credit bet set to Cancelled regardless of outcome
            bet.status = BetStatus.Cancelled;

            if (betWon) {
                // Pool owes the payout, goes to platform
                uint256 payout = potPayout;
                result.platformDelta = payout;
                // bettingPool -= (payout - amount)  [Pool already -amount at lock time]
                result.bettingPoolDelta = payout - amount;
                result.bettingPoolIncrease = false;
            } else {
                // Pool recovers the full amount
                result.bettingPoolDelta = amount;
                result.bettingPoolIncrease = true;
            }

            emit CreditBetForfeited(betId, collateralBetId, amount);
            emit CreditBetSettled(betId, bet.user, BetStatus.Cancelled, 0, 0);
        } else if (collateralStatus == BetStatus.Won) {
            // Normal settlement but with credit deduction
            if (betWon) {
                uint256 payout = potPayout;
                uint256 deduction = amount; // repay credit principal
                uint256 netToUser = payout - deduction;

                result.userBalanceDelta = netToUser;
                result.userBalanceIncrease = true;
                result.totalUserBalancesDelta = netToUser;
                result.totalUserBalancesIncrease = true;

                // bettingPool net: -(payout - amount) + amount = -(payout - 2*amount)
                // But we track as: bettingPool -= (payout - amount) then += deduction
                // Net delta = -(payout - amount) + amount = -(payout - 2*amount)
                // Since payout >= amount always (odds >= 1.0):
                if (payout >= 2 * amount) {
                    result.bettingPoolDelta = payout - 2 * amount;
                    result.bettingPoolIncrease = false;
                } else {
                    // payout < 2*amount => net pool gain
                    result.bettingPoolDelta = 2 * amount - payout;
                    result.bettingPoolIncrease = true;
                }

                bet.status = BetStatus.Won;
                emit CreditBetSettled(betId, bet.user, BetStatus.Won, netToUser, deduction);
            } else {
                // Loser — 70/30 split
                uint256 lpShare = (amount * lpShareBps) / bpsDenum;
                uint256 platShare = amount - lpShare;

                result.bettingPoolDelta = lpShare;
                result.bettingPoolIncrease = true;
                result.platformDelta = platShare;

                bet.status = BetStatus.Lost;
                emit CreditBetSettled(betId, bet.user, BetStatus.Lost, 0, 0);
            }
        } else if (collateralStatus == BetStatus.Pending) {
            // Collateral not yet settled
            if (betWon) {
                // Freeze payout
                uint256 payout = potPayout;
                frozenPayouts[betId] = payout;
                result.frozen = true;
                result.frozenAmount = payout;

                bet.status = BetStatus.Won;
                emit CreditPayoutFrozen(betId, bet.user, payout);
            } else {
                // Loser — same as Won collateral + Lost credit
                uint256 lpShare = (amount * lpShareBps) / bpsDenum;
                uint256 platShare = amount - lpShare;

                result.bettingPoolDelta = lpShare;
                result.bettingPoolIncrease = true;
                result.platformDelta = platShare;

                bet.status = BetStatus.Lost;
                emit CreditBetSettled(betId, bet.user, BetStatus.Lost, 0, 0);
            }
        } else {
            // collateralStatus == Cancelled: Pool bears credit risk
            bet.status = BetStatus.Cancelled;

            if (betWon) {
                uint256 payout = potPayout;
                // Full payout to user (stake came from Pool)
                result.userBalanceDelta = payout;
                result.userBalanceIncrease = true;
                result.totalUserBalancesDelta = payout;
                result.totalUserBalancesIncrease = true;

                // bettingPool -= (payout - amount)
                result.bettingPoolDelta = payout - amount;
                result.bettingPoolIncrease = false;

                emit CreditBetSettled(betId, bet.user, BetStatus.Won, payout, 0);
            } else {
                // 70/30 split
                uint256 lpShare = (amount * lpShareBps) / bpsDenum;
                uint256 platShare = amount - lpShare;

                result.bettingPoolDelta = lpShare;
                result.bettingPoolIncrease = true;
                result.platformDelta = platShare;

                emit CreditBetSettled(betId, bet.user, BetStatus.Lost, 0, 0);
            }

            emit CreditCollateralCancelled(betId, collateralBetId, amount);
        }
    }

    /// @notice Release or forfeit a frozen credit payout after collateral settles.
    function releaseOrForfeiture(
        bytes32 creditBetId,
        mapping(bytes32 => Bet) storage bets,
        mapping(bytes32 => uint256) storage frozenPayouts,
        mapping(address => uint256) storage userBalances,
        uint256 lpShareBps,
        uint256 bpsDenum
    )
        internal
        returns (
            uint256 totalFrozenPayoutsDelta, // always reduces
            uint256 bettingPoolDelta,
            bool bettingPoolIncrease,
            uint256 platformDelta,
            uint256 userBalanceDelta,
            bool userBalanceIncrease,
            uint256 totalUserBalancesDelta,
            bool totalUserBalancesIncrease
        )
    {
        Bet storage creditBet = bets[creditBetId];
        bytes32 collateralBetId = creditBet.collateralBetId;
        BetStatus collateralStatus = bets[collateralBetId].status;
        uint256 frozen = frozenPayouts[creditBetId];
        uint256 amount = creditBet.amount;
        address user = creditBet.user;

        totalFrozenPayoutsDelta = frozen;

        if (collateralStatus == BetStatus.Won) {
            uint256 deduction = amount;
            uint256 netPayout = frozen - deduction;

            userBalanceDelta = netPayout;
            userBalanceIncrease = true;
            totalUserBalancesDelta = netPayout;
            totalUserBalancesIncrease = true;

            // bettingPool: -(frozen - amount) + amount = -(frozen - 2*amount)
            if (frozen >= 2 * amount) {
                bettingPoolDelta = frozen - 2 * amount;
                bettingPoolIncrease = false;
            } else {
                bettingPoolDelta = 2 * amount - frozen;
                bettingPoolIncrease = true;
            }

            userBalances[user] += netPayout;

            emit CreditPayoutReleased(creditBetId, user, netPayout);
        } else if (collateralStatus == BetStatus.Lost) {
            // Forfeit to platform
            platformDelta = frozen;

            // bettingPool -= (frozen - amount)
            bettingPoolDelta = frozen - amount;
            bettingPoolIncrease = false;

            emit CreditPayoutForfeited(creditBetId, frozen);
        } else {
            // Cancelled — Pool bears risk, full release to user
            userBalanceDelta = frozen;
            userBalanceIncrease = true;
            totalUserBalancesDelta = frozen;
            totalUserBalancesIncrease = true;

            // bettingPool -= (frozen - amount)
            bettingPoolDelta = frozen - amount;
            bettingPoolIncrease = false;

            userBalances[user] += frozen;

            emit CreditPayoutReleased(creditBetId, user, frozen);
        }
    }
}
