// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

enum PoolType {
    Global,
    Match
}

enum LpPositionState {
    Active,
    Unbonding,
    Ready,
    Withdrawn,
    Liquidated,
    Withdrawable
}
