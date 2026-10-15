// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../shared/types/BetTypes.sol";

interface IBettingPool {
    // ── Events ────────────────────────────────────────────────────────────────

    // Deposit / Withdraw
    event Deposited(address indexed user, uint256 amount, bytes32 indexed txHash);
    event Withdrawn(address indexed user, uint256 amount);
    event LargeWithdrawalRequested(bytes32 indexed requestId, address indexed user, uint256 amount);
    event LargeWithdrawalRejected(bytes32 indexed requestId, address indexed user, uint256 amount);

    // Normal bets
    event BetLocked(bytes32 indexed betId, address indexed user, uint256 amount, bytes32 indexed matchId);
    event BetUnlocked(bytes32 indexed betId, address indexed user, uint256 amount);
    event BetSettled(bytes32 indexed betId, address indexed user, BetStatus status, uint256 payout);

    // Market settlement (aggregate)
    event MatchSettled(bytes32 indexed matchId, MarketType market, uint8 line, uint8 winningOutcome);

    // Parlay
    event ParlayLocked(
        bytes32 indexed parlayId,
        address indexed user,
        uint256 stake,
        uint8 legs,
        uint256 combinedOdds,
        bytes32[] legBetIds
    );
    event ParlayUnlocked(bytes32 indexed parlayId, address indexed user, uint256 stake);
    event ParlayWon(bytes32 indexed parlayId, address indexed user, uint256 payout);
    event ParlayLost(bytes32 indexed parlayId, address indexed user, uint256 stake);

    // Credit bets
    event CreditBetLocked(
        bytes32 indexed betId,
        bytes32 indexed collateralBetId,
        address indexed user,
        uint256 amount
    );
    event CreditBetSettled(
        bytes32 indexed betId,
        address indexed user,
        BetStatus status,
        uint256 payout,
        uint256 deduction
    );
    event CreditPayoutFrozen(bytes32 indexed betId, address indexed user, uint256 payout);
    event CreditPayoutReleased(bytes32 indexed betId, address indexed user, uint256 netPayout);
    event CreditPayoutForfeited(bytes32 indexed betId, uint256 payout);
    event CreditBetForfeited(bytes32 indexed betId, bytes32 indexed collateralBetId, uint256 amount);
    event CreditCollateralCancelled(bytes32 indexed betId, bytes32 indexed collateralBetId, uint256 amount);

    // LP
    event LiquidityAdded(address indexed provider, uint256 amount, uint256 shares);
    event LiquidityRemoved(address indexed provider, uint256 amount, uint256 shares);

    // Signal
    event SignalUpdated(bytes32 indexed matchId, MarketType market, uint8 line, SignalColor color);

    // Market lifecycle
    event MarketOpened(bytes32 indexed matchId, MarketType market, uint8 line);
    event MarketClosed(bytes32 indexed matchId, MarketType market, uint8 line);
    event MarketReopened(bytes32 indexed matchId, MarketType market, uint8 line);

    // Match cancel
    event MatchCancelled(bytes32 indexed matchId, MarketType market, uint8 line);
    event ParlayLegCancelled(bytes32 indexed parlayId, bytes32 indexed betId, uint256 newCombinedOdds);
    event ParlayDegradedToSingle(bytes32 indexed parlayId, bytes32 indexed remainingBetId, uint256 newOdds);

    // Admin ops
    event PlatformWithdrawn(address indexed to, uint256 amount);
    event RedLightThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event MaxMarketsPerMatchUpdated(uint256 newMax);
    event AdminUpdated(address indexed oldAdmin, address indexed newAdmin);
    event LpShareBpsUpdated(uint256 oldBps, uint256 newBps);

    // ── User Functions ────────────────────────────────────────────────────────

    function creditDeposit(address user, uint256 amount, bytes32 txHash) external;

    function withdraw(uint256 amount) external;

    function executeLargeWithdrawal(bytes32 requestId) external;

    function rejectLargeWithdrawal(bytes32 requestId) external;

    // ── Admin Functions ───────────────────────────────────────────────────────

    function openMarket(bytes32 matchId, MarketType market, uint8 line) external;

    function closeMarket(bytes32 matchId, MarketType market, uint8 line) external;

    function batchOpenMarkets(bytes32 matchId, MarketType[] calldata markets, uint8[] calldata lines) external;

    function batchCloseMarkets(bytes32 matchId, MarketType[] calldata markets, uint8[] calldata lines) external;

    function lockBet(
        bytes32 betId,
        address user,
        uint256 amount,
        bytes32 matchId,
        MarketType market,
        uint8 outcome,
        uint8 line,
        uint256 lockedOdds
    ) external;

    function lockCreditBet(
        bytes32 betId,
        bytes32 collateralBetId,
        address user,
        uint256 amount,
        bytes32 matchId,
        MarketType market,
        uint8 outcome,
        uint8 line,
        uint256 lockedOdds
    ) external;

    function lockParlay(
        bytes32 parlayId,
        address user,
        uint256 stake,
        bytes32[] calldata matchIds,
        MarketType[] calldata markets,
        uint8[] calldata outcomes,
        uint8[] calldata lines,
        uint256[] calldata legOdds,
        bytes32[] calldata legBetIds
    ) external;

    function unlockBet(bytes32 betId, bytes32[] calldata creditBetIds) external;

    function unlockParlay(bytes32 parlayId) external;

    function updateSignal(
        bytes32 matchId,
        MarketType market,
        uint8 line,
        uint256 heavyAmount,
        uint8 heavySide,
        SignalColor color
    ) external;

    // ── Multisig Functions ────────────────────────────────────────────────────

    function reopenMarket(bytes32 matchId, MarketType market, uint8 line) external;

    function settle(
        bytes32 matchId,
        MarketType market,
        uint8 line,
        uint8 winningOutcome,
        bytes32[] calldata betIds
    ) external;

    function releaseOrForfeiture(bytes32 creditBetId) external;

    function cancelMatch(
        bytes32 matchId,
        MarketType market,
        uint8 line,
        bytes32[] calldata betIds
    ) external;

    function batchCancelMatch(
        bytes32 matchId,
        MarketType[] calldata markets,
        uint8[] calldata lines,
        bytes32[][] calldata betIdsByMarket
    ) external;

    function withdrawPlatform(address to, uint256 amount) external;

    function setMaxMarketsPerMatch(uint256 max) external;

    function setRedLightThreshold(uint256 threshold) external;

    function setAdmin(address newAdmin) external;

    function setLpShareBps(uint256 newBps) external;

    function pause() external;

    function unpause() external;

    // ── LP Functions ──────────────────────────────────────────────────────────

    function addLiquidity(uint256 amount) external;

    function removeLiquidity(uint256 shares) external;

    // ── View Functions ────────────────────────────────────────────────────────

    function isAccepting(
        bytes32 matchId,
        MarketType market,
        uint8 line,
        uint8 outcome
    ) external view returns (bool);

    function getParlayLegs(bytes32 parlayId) external view returns (bytes32[] memory);
}
