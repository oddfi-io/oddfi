// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IBettingMarketModule {
    function openMarket(
        bytes32 matchId,
        uint8 marketType,
        uint8 line,
        uint64 matchStartTime,
        uint64 matchEndTime,
        uint256[] calldata baseOdds,
        uint64 updatedAt
    ) external returns (bytes32 marketId);

    function updateOdds(bytes32 marketId, uint256[] calldata baseOdds, uint64 updatedAt) external;

    function previewSignal(address bettingPoolAddress, bytes32 marketId, uint8 outcome, uint256 requestedAmount)
        external
        view
        returns (
            uint8 signal,
            uint256 acceptedAmount,
            uint256 lockedOdds,
            bool partialFill,
            uint256 maxAcceptableAmount
        );

    function isMatchTerminal(address bettingPoolAddress, bytes32 matchId) external view returns (bool);
}
