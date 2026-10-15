// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ParlayEstimatedValue, ParlayLegInput} from "../../../shared/types/ParlayTypes.sol";

interface IBettingParlayModule {
    function getParlayClaimStatus(address bettingPoolAddress, address userAddress, bytes32 parlayId)
        external
        view
        returns (bool won, uint256 reward);

    function estimateParlayValue(address bettingPoolAddress, address userAddress, bytes32 parlayId)
        external
        view
        returns (ParlayEstimatedValue memory estimated);

    function placeParlay(
        ParlayLegInput[] calldata legs,
        uint256 stake,
        uint256 minComboOdds,
        uint256 deadline,
        address referrer
    ) external returns (bytes32 parlayId);

    function settleParlay(bytes32 parlayId) external;

    function claimParlayPayout(bytes32 parlayId) external;
}
