// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IStakingPoolViewV1 {
    function getActiveStakeAmount(address user) external view returns (uint256);

    function getUserTier(address user) external view returns (uint8);

    function getUserDailyLimit(address user) external view returns (uint256);

    function isActiveStaker(address user) external view returns (bool);
}
