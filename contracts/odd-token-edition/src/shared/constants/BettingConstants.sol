// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {PrecisionConstants} from "./PrecisionConstants.sol";

library BettingConstants {
    uint256 internal constant WCL_YELLOW_THRESHOLD = 80_000 * PrecisionConstants.ODD_WAD;
    uint256 internal constant WCL_ORANGE_THRESHOLD = 180_000 * PrecisionConstants.ODD_WAD;
    uint256 internal constant WCL_RED_THRESHOLD = 280_000 * PrecisionConstants.ODD_WAD;

    uint16 internal constant BET_TAX_BPS_DEFAULT = 100;
    uint16 internal constant BET_TAX_BPS_MAX = 300;
    uint16 internal constant PAYOUT_TAX_BPS_DEFAULT = 500;
    uint16 internal constant PAYOUT_TAX_BPS_MAX = 1_000;

    uint16 internal constant PAYOUT_ALLOC_STAKING_DEFAULT = 200;
    uint16 internal constant PAYOUT_ALLOC_TAXBUFFER_DEFAULT = 100;
    uint16 internal constant PAYOUT_ALLOC_PLATFORM_DEFAULT = 100;
    uint16 internal constant PAYOUT_ALLOC_REFERRER_DEFAULT = 100;

    uint256 internal constant MIN_BET_AMOUNT = 100 * PrecisionConstants.ODD_WAD;
    uint256 internal constant MIN_CASH_OUT_AMOUNT = 10 * PrecisionConstants.ODD_WAD;
    uint16 internal constant CASH_OUT_EARLY_FEE_BPS = 1_000;
    uint16 internal constant CASH_OUT_LATE_FEE_BPS = 2_000;
    uint256 internal constant CASH_OUT_LATE_WINDOW = 30 * PrecisionConstants.SECONDS_PER_MINUTE;
    uint256 internal constant CASH_OUT_QUOTE_TTL = 30;
    uint256 internal constant SLIPPAGE_TRIGGER_AMOUNT = 10_000 * PrecisionConstants.ODD_WAD;
    uint256 internal constant SINGLE_MATCH_PAYOUT_CAP = 30_000 * PrecisionConstants.ODD_WAD;
    uint256 internal constant PARLAY_MIN_LEGS = 2;
    uint256 internal constant PARLAY_MAX_ODDS = 200;
    uint256 internal constant PARLAY_MAX_LEGS = 6;
    uint256 internal constant PARLAY_ODDS_RATE_CAP = 200 * PrecisionConstants.ODDS_RATE_SCALE;

    uint256 internal constant TAX_BUFFER_CAP = 500_000 * PrecisionConstants.ODD_WAD;
    uint256 internal constant EMERGENCY_FLOOR = 100_000 * PrecisionConstants.ODD_WAD;
    uint256 internal constant PLATFORM_RESERVE_INITIAL = 15_000_000 * PrecisionConstants.ODD_WAD;
    uint256 internal constant RESERVE_STEP_ALERT_SIZE = 100_000 * PrecisionConstants.ODD_WAD;

    uint256 internal constant CLAIM_BATCH_DEFAULT = 20;
    uint256 internal constant CLAIM_BATCH_HARD_CAP = 50;
    uint256 internal constant REFUND_BATCH_DEFAULT = 20;
    uint256 internal constant REFUND_BATCH_HARD_CAP = 50;
    uint256 internal constant FINALIZE_BATCH_DEFAULT = 20;
    uint256 internal constant FINALIZE_BATCH_HARD_CAP = 50;
    uint16 internal constant MAX_SETTLEMENT_SCORE = 50;

    uint8 internal constant ONE_X_TWO_OUTCOME_COUNT = 3;
    uint8 internal constant TWO_WAY_OUTCOME_COUNT = 2;
    uint8 internal constant ASIAN_HANDICAP_LINE_COUNT = 13;
    uint8 internal constant OVER_UNDER_LINE_COUNT = 11;
}
