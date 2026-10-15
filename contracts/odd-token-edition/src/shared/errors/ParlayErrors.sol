// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

error InvalidParlayLegCount(uint256 provided, uint256 minimum, uint256 maximum);
error DuplicateParlayMarket(bytes32 marketId);
error DuplicateParlayMatch(bytes32 matchId);
error InvalidParlayState(bytes32 parlayId, uint8 state);
error ParlayNotOwner(bytes32 parlayId, address caller);
error ParlayModuleDirectCall();
