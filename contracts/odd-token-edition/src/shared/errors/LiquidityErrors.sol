// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

error DepositBelowMinimum(uint256 attempted, uint256 minimum);
error InvalidLiquidityPlan(uint16 planId);
error MatchPoolDepositsClosed(bytes32 matchId);
error LpPositionNotOwner(uint256 positionId, address caller);
error PositionNotUnbondable(uint256 positionId);
error EpochNotReady(uint32 currentEpoch, uint32 requiredEpoch);
error PayoutWindowExceeded(bytes32 matchId, uint256 requested, uint256 remaining);
error InvalidMatchPoolLifecycle(bytes32 matchId);
error MatchNotTerminal(bytes32 matchId);
error BettingPoolOnly(address caller);
