// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

enum MarketType {
    OneXTwo,
    AsianHandicap,
    OverUnder
}

enum AhLine {
    MinusHalf,
    MinusOne,
    MinusOnePointFive,
    MinusQuarter,
    MinusThreeQuarter,
    MinusOnePointTwoFive,
    PlusZero,
    PlusQuarter,
    PlusHalf,
    PlusThreeQuarter,
    MinusOnePointSevenFive,
    MinusTwo,
    MinusThree
}

enum OuLine {
    OnePointFive,
    TwoPointFive,
    ThreePointFive,
    Zero,
    ZeroPointFive,
    One,
    OnePointSevenFive,
    Two,
    TwoPointTwoFive,
    TwoPointSevenFive,
    Three
}

enum MarketStatus {
    Open,
    Locked,
    Settled,
    Refunded,
    Cancelled
}

enum BetSettlementState {
    Pending,
    Refunded,
    Lost,
    WonUnclaimed,
    WonClaimed,
    CashedOut
}

enum SignalColor {
    Green,
    Yellow,
    Orange,
    Red
}
