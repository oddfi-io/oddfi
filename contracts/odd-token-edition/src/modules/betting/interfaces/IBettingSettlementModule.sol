// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IBettingSettlementModule {
    function getClaimStatus(address bettingPoolAddress, address userAddress, bytes32 betId)
        external
        view
        returns (bool won, uint256 reward);

    function estimateBetValue(address bettingPoolAddress, address userAddress, bytes32 betId)
        external
        view
        returns (uint256 estimatedValue, int256 floatingPnL);

    function lockMarket(bytes32 marketId) external;

    function settleMarketBetsByScore(bytes32 marketId, uint16 homeScore, uint16 awayScore, bytes32[] calldata betIds)
        external;
    function finalizeMarketSettlement(bytes32 marketId, uint8 resultKindRaw) external;
    function refundBets(bytes32 marketId, bytes32[] calldata betIds, uint256[] calldata refundAmounts) external;
    function claimPayout(bytes32 betId) external;
    function releasePayoutReserve(bytes32 riskId) external;
    function cashOut(
        bytes32 betId,
        uint256 expectedQuoteVersion,
        uint64 quotedAt,
        uint256 minAmountOut,
        uint256 deadline
    ) external;
}
