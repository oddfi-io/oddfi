// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

error StakeBelowMinimum(uint256 attempted, uint256 minimum);
error InvalidStakePlan(uint16 planId);
error StakePositionNotOwner(uint256 positionId, address caller);
error PositionNotActive(uint256 positionId);
error PositionNotMatured(uint256 positionId, uint256 unlockAt, uint256 currentTimestamp);
error PositionAlreadyMatured(uint256 positionId);
error RewardSourceForbidden(address caller);
