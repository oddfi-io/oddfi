// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ILiquidityPoolSettlementV1 {
    function openMatchPool(bytes32 matchId, uint64 matchStartTime, uint64 matchEndTime) external;

    function closeMatchPoolDeposit(bytes32 matchId) external;

    function distributeMargin(bytes32 matchId, uint256 lpMarginShare) external;

    function distributeLoss(bytes32 matchId, uint256 netLoss) external returns (uint256 lpLossBooked);

    function distributeGlobalMargin(bytes32 riskId, uint256 lpMarginShare) external;

    function distributeGlobalLoss(bytes32 riskId, uint256 netLoss) external returns (uint256 lpLossBooked);

    function requestPayoutLiquidity(bytes32 matchId, uint256 amount) external;

    function releasePayoutReserve(bytes32 matchId) external returns (uint256 releasedAmount);

    function getPayoutLiquidityWindow(bytes32 matchId)
        external
        view
        returns (uint256 reservedAmount, uint256 paidOutAmount, uint256 settledAt);

    function getPoolWeights(bytes32 matchId) external view returns (uint256 globalWeight, uint256 matchWeight);

    function getRequestableLiquidity() external view returns (uint256);

    function getGlobalRequestableLiquidity() external view returns (uint256);
}
