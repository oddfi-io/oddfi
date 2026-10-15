// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {PrecisionConstants} from "./PrecisionConstants.sol";

library StakingConstants {
    uint256 internal constant MIN_STAKE_AMOUNT = 100 * PrecisionConstants.ODD_WAD;

    uint16 internal constant STAKE_PLAN_COUNT = 6;

    uint16 internal constant STAKE_PLAN_0_LOCK_DAYS = 7;
    uint32 internal constant STAKE_PLAN_0_MULTIPLIER_BPS = 5_000;
    uint16 internal constant STAKE_PLAN_1_LOCK_DAYS = 30;
    uint32 internal constant STAKE_PLAN_1_MULTIPLIER_BPS = 10_000;
    uint16 internal constant STAKE_PLAN_2_LOCK_DAYS = 60;
    uint32 internal constant STAKE_PLAN_2_MULTIPLIER_BPS = 18_000;
    uint16 internal constant STAKE_PLAN_3_LOCK_DAYS = 90;
    uint32 internal constant STAKE_PLAN_3_MULTIPLIER_BPS = 40_000;
    uint16 internal constant STAKE_PLAN_4_LOCK_DAYS = 180;
    uint32 internal constant STAKE_PLAN_4_MULTIPLIER_BPS = 80_000;
    uint16 internal constant STAKE_PLAN_5_LOCK_DAYS = 360;
    uint32 internal constant STAKE_PLAN_5_MULTIPLIER_BPS = 150_000;

    uint8 internal constant VIP_TIER_COUNT = 11;
    uint256 internal constant VIP_THRESHOLD_0 = 0;
    uint256 internal constant VIP_THRESHOLD_1 = 1_000 * PrecisionConstants.ODD_WAD;
    uint256 internal constant VIP_THRESHOLD_2 = 5_000 * PrecisionConstants.ODD_WAD;
    uint256 internal constant VIP_THRESHOLD_3 = 20_000 * PrecisionConstants.ODD_WAD;
    uint256 internal constant VIP_THRESHOLD_4 = 50_000 * PrecisionConstants.ODD_WAD;
    uint256 internal constant VIP_THRESHOLD_5 = 100_000 * PrecisionConstants.ODD_WAD;
    uint256 internal constant VIP_THRESHOLD_6 = 200_000 * PrecisionConstants.ODD_WAD;
    uint256 internal constant VIP_THRESHOLD_7 = 500_000 * PrecisionConstants.ODD_WAD;
    uint256 internal constant VIP_THRESHOLD_8 = 1_000_000 * PrecisionConstants.ODD_WAD;
    uint256 internal constant VIP_THRESHOLD_9 = 2_000_000 * PrecisionConstants.ODD_WAD;
    uint256 internal constant VIP_THRESHOLD_10 = 5_000_000 * PrecisionConstants.ODD_WAD;

    uint256 internal constant VIP_DAILY_LIMIT_0 = 10_000 * PrecisionConstants.ODD_WAD;
    uint256 internal constant VIP_DAILY_LIMIT_1 = 50_000 * PrecisionConstants.ODD_WAD;
    uint256 internal constant VIP_DAILY_LIMIT_2 = 100_000 * PrecisionConstants.ODD_WAD;
    uint256 internal constant VIP_DAILY_LIMIT_3 = 150_000 * PrecisionConstants.ODD_WAD;
    uint256 internal constant VIP_DAILY_LIMIT_4 = 200_000 * PrecisionConstants.ODD_WAD;
    uint256 internal constant VIP_DAILY_LIMIT_5 = 250_000 * PrecisionConstants.ODD_WAD;
    uint256 internal constant VIP_DAILY_LIMIT_6 = 300_000 * PrecisionConstants.ODD_WAD;
    uint256 internal constant VIP_DAILY_LIMIT_7 = 400_000 * PrecisionConstants.ODD_WAD;
    uint256 internal constant VIP_DAILY_LIMIT_8 = 500_000 * PrecisionConstants.ODD_WAD;
    uint256 internal constant VIP_DAILY_LIMIT_9 = 750_000 * PrecisionConstants.ODD_WAD;
    uint256 internal constant VIP_DAILY_LIMIT_10 = 1_000_000 * PrecisionConstants.ODD_WAD;

    uint256 internal constant OPEN_POSITION_STAKE_FREE_THRESHOLD = 5_000 * PrecisionConstants.ODD_WAD;
}
