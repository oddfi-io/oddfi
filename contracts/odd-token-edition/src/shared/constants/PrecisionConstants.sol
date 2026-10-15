// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

library PrecisionConstants {
    uint256 internal constant ODD_WAD = 1e18;
    uint256 internal constant BPS_SCALE = 10_000;
    uint256 internal constant ODDS_RATE_SCALE = 1e4;
    uint256 internal constant DISPLAY_ODDS_STEP = 100;
    uint256 internal constant SECONDS_PER_MINUTE = 60;
    uint256 internal constant SECONDS_PER_DAY = 86_400;
}
