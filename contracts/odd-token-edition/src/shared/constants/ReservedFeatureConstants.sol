// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {PrecisionConstants} from "./PrecisionConstants.sol";

library ReservedFeatureConstants {
    uint8 internal constant PARLAY_MAX_LEGS = 6;
    uint16 internal constant PARLAY_MAX_TOTAL_ODDS_X = 200;
    uint256 internal constant PARLAY_MAX_PAYOUT = 30_000 * PrecisionConstants.ODD_WAD;
    bool internal constant PARLAY_SAME_MATCH_FORBIDDEN = true;
}
