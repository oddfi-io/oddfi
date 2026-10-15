// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IBettingMatchViewV1 {
    function isMatchTerminal(bytes32 matchId) external view returns (bool);
}
