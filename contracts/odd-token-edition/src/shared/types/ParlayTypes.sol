// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

enum ParlayState {
    Pending,
    Lost,
    WonUnclaimed,
    WonClaimed,
    Refundable,
    Refunded
}

enum ParlayLegResult {
    Pending,
    FullWin,
    FullLoss,
    FullPush,
    HalfWin,
    HalfLoss,
    Void
}

struct ParlayLegInput {
    bytes32 marketId;
    uint8 outcome;
    uint256 quoteVersion;
    uint64 quotedAt;
    uint256 minOdds;
}

struct ParlayLeg {
    bytes32 marketId;
    bytes32 matchId;
    uint8 marketType;
    uint8 line;
    uint8 outcome;
    uint256 lockedOdds;
    uint256 syntheticPayout;
    ParlayLegResult result;
}

struct ParlayBet {
    address owner;
    uint256 stake;
    uint256 lockedComboOdds;
    uint256 maxPayout;
    uint256 claimablePayout;
    bytes32 parlayRiskId;
    uint32 acceptedDayBucket;
    uint8 legCount;
    ParlayState state;
    uint16 payoutTaxRateBps;
    uint16 taxAllocStakingBps;
    uint16 taxAllocTaxBufferBps;
    uint16 taxAllocReferrerBps;
    address referrerSnapshot;
}

struct MarketFinalResult {
    bool finalized;
    uint8 resultKind;
    bool scoreSettled;
    uint16 homeScore;
    uint16 awayScore;
}

struct ParlayPreview {
    uint256 rawComboOdds;
    uint256 lockedComboOdds;
    uint256 maxPayout;
    uint256 maxRequiredPayout;
    uint256 availableParlayCapacity;
    bool cappedByOdds;
    bool cappedByPayout;
}

struct ParlayEstimatedValue {
    uint8 state;
    uint256 stake;
    uint256 lockedComboOdds;
    uint256 maxPayout;
    uint256 estimatedValue;
    int256 floatingPnL;
    uint256 factorProduct;
    uint8 finalizedLegCount;
    uint8 unresolvedLegCount;
    bool hasFullLoss;
    bool isFinal;
}
