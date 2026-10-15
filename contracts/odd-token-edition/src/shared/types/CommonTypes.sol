// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

struct QuoteGuardInput {
    uint256 quoteVersion;
    uint64 quotedAt;
    uint256 minOdds;
    uint256 minAcceptedAmount;
    uint256 deadline;
}

struct TierView {
    uint8 tier;
    uint256 activeStakeAmount;
    uint256 dailyLimit;
}

struct PayoutWindowSnapshot {
    bytes32 matchId;
    uint256 reservedAmount;
    uint256 paidOutAmount;
    uint64 settledAt;
}

struct PoolViewKey {
    uint256 poolId;
    bytes32 matchId;
}
