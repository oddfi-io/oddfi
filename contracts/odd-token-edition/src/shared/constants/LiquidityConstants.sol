// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {PrecisionConstants} from "./PrecisionConstants.sol";

library LiquidityConstants {
    uint256 internal constant MIN_LP_DEPOSIT = 1_000 * PrecisionConstants.ODD_WAD;

    uint16 internal constant GLOBAL_POOL_PLAN_COUNT = 5;

    uint16 internal constant GLOBAL_PLAN_0_LOCK_DAYS = 7;
    uint32 internal constant GLOBAL_PLAN_0_MULTIPLIER_BPS = 5_000;
    uint16 internal constant GLOBAL_PLAN_1_LOCK_DAYS = 14;
    uint32 internal constant GLOBAL_PLAN_1_MULTIPLIER_BPS = 10_000;
    uint16 internal constant GLOBAL_PLAN_2_LOCK_DAYS = 28;
    uint32 internal constant GLOBAL_PLAN_2_MULTIPLIER_BPS = 18_000;
    uint16 internal constant GLOBAL_PLAN_3_LOCK_DAYS = 60;
    uint32 internal constant GLOBAL_PLAN_3_MULTIPLIER_BPS = 25_000;
    uint16 internal constant GLOBAL_PLAN_4_LOCK_DAYS = 90;
    uint32 internal constant GLOBAL_PLAN_4_MULTIPLIER_BPS = 35_000;

    uint32 internal constant MATCH_POOL_MULTIPLIER_BPS = 10_000;
    uint32 internal constant UNBOND_EPOCHS = 2;
    uint256 internal constant PLATFORM_RESERVE_INITIAL_AMOUNT = 15_000_000 * PrecisionConstants.ODD_WAD;
}
