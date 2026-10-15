// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {PrecisionConstants} from "../../shared/constants/PrecisionConstants.sol";
import {BettingConstants} from "../../shared/constants/BettingConstants.sol";
import {SignalColor} from "../../shared/types/MarketEnums.sol";
import {InvalidOddsValue, MarketTemplateNotAllowed} from "../../shared/errors/BettingErrors.sol";

library BettingOddsLib {
    function currentOutcomeWcl(uint256 currentOutcomePayout, uint256 currentTotalStake)
        public
        pure
        returns (uint256 currentWcl)
    {
        currentWcl = currentOutcomePayout > currentTotalStake ? currentOutcomePayout - currentTotalStake : 0;
    }

    function maxStakeAtRedThreshold(
        uint256 currentOutcomePayout,
        uint256 currentTotalStake,
        uint256 newOdds,
        uint256 wclRedThreshold
    ) public pure returns (uint256 maxAcceptableAmount) {
        if (newOdds <= PrecisionConstants.ODDS_RATE_SCALE) {
            return 0;
        }
        if (currentOutcomePayout >= currentTotalStake + wclRedThreshold) {
            return 0;
        }

        uint256 roomToRed = currentOutcomePayout >= currentTotalStake
            ? wclRedThreshold - (currentOutcomePayout - currentTotalStake)
            : wclRedThreshold + (currentTotalStake - currentOutcomePayout);
        uint256 denominator = newOdds - PrecisionConstants.ODDS_RATE_SCALE;
        maxAcceptableAmount = roomToRed * PrecisionConstants.ODDS_RATE_SCALE / denominator;
    }

    function redLineOdds(uint256 baseOdds) public pure returns (uint256) {
        return normalizeOdds(baseOdds * 8800 / PrecisionConstants.BPS_SCALE);
    }

    function computeQuotedOdds(
        uint256[] memory baseOdds,
        uint256[] memory stakes,
        uint256[] memory payouts,
        uint256 yellowThreshold,
        uint256 orangeThreshold,
        uint256 redThreshold
    ) public pure returns (uint256[] memory quotedOdds, uint256 worstCaseLoss, SignalColor signalColor) {
        quotedOdds = copyMemoryArray(baseOdds);
        (uint256[] memory wcls, uint256 maxWcl) = computeWorstCaseLosses(payouts, sumArray(stakes));

        if (maxWcl == 0) {
            return (quotedOdds, 0, SignalColor.Green);
        }

        uint256 compressionBps = compressionBpsFor(maxWcl, yellowThreshold, orangeThreshold, redThreshold);
        signalColor = signalFor(maxWcl, yellowThreshold, orangeThreshold, redThreshold);
        worstCaseLoss = maxWcl;

        for (uint256 i = 0; i < baseOdds.length; ++i) {
            if (wcls[i] == maxWcl) {
                uint256 compressed =
                    baseOdds[i] * (PrecisionConstants.BPS_SCALE - compressionBps) / PrecisionConstants.BPS_SCALE;
                uint256 floor = baseOdds[i] * 8800 / PrecisionConstants.BPS_SCALE;
                quotedOdds[i] = compressed < floor ? floor : compressed;
            } else {
                uint256 upliftBps = compressionBps > 800 ? 800 : compressionBps;
                uint256 uplifted =
                    baseOdds[i] * (PrecisionConstants.BPS_SCALE + upliftBps) / PrecisionConstants.BPS_SCALE;
                uint256 ceiling = baseOdds[i] * 10800 / PrecisionConstants.BPS_SCALE;
                quotedOdds[i] = uplifted > ceiling ? ceiling : uplifted;
            }
            quotedOdds[i] = normalizeOdds(quotedOdds[i]);
        }
    }

    function computeWorstCaseLosses(uint256[] memory payouts, uint256 totalStake)
        public
        pure
        returns (uint256[] memory wcls, uint256 maxWcl)
    {
        uint256 outcomeCount = payouts.length;
        wcls = new uint256[](outcomeCount);

        for (uint256 i = 0; i < outcomeCount; ++i) {
            uint256 wcl = payouts[i] > totalStake ? payouts[i] - totalStake : 0;
            wcls[i] = wcl;
            if (wcl > maxWcl) {
                maxWcl = wcl;
            }
        }
    }

    function compressionBpsFor(uint256 maxWcl, uint256 yellowThreshold, uint256 orangeThreshold, uint256 redThreshold)
        public
        pure
        returns (uint256)
    {
        if (maxWcl <= yellowThreshold) {
            return 0;
        }
        if (maxWcl <= orangeThreshold) {
            uint256 bps = (maxWcl - yellowThreshold) * 40 / (10_000 * PrecisionConstants.ODD_WAD);
            return bps > 400 ? 400 : bps;
        }
        if (maxWcl <= redThreshold) {
            uint256 bps = 400 + (maxWcl - orangeThreshold) * 80 / (10_000 * PrecisionConstants.ODD_WAD);
            return bps > 1200 ? 1200 : bps;
        }
        return 1200;
    }

    function signalFor(uint256 maxWcl, uint256 yellowThreshold, uint256 orangeThreshold, uint256 redThreshold)
        public
        pure
        returns (SignalColor)
    {
        if (maxWcl <= yellowThreshold) {
            return SignalColor.Green;
        }
        if (maxWcl <= orangeThreshold) {
            return SignalColor.Yellow;
        }
        if (maxWcl <= redThreshold) {
            return SignalColor.Orange;
        }
        return SignalColor.Red;
    }

    function validateTemplate(uint8 marketType, uint8 line, uint256 oddsLength)
        public
        pure
        returns (uint8 outcomeCount)
    {
        if (marketType == 0 && line == 0 && oddsLength == BettingConstants.ONE_X_TWO_OUTCOME_COUNT) {
            return BettingConstants.ONE_X_TWO_OUTCOME_COUNT;
        }
        if (
            marketType == 1 && line < BettingConstants.ASIAN_HANDICAP_LINE_COUNT
                && oddsLength == BettingConstants.TWO_WAY_OUTCOME_COUNT
        ) {
            return BettingConstants.TWO_WAY_OUTCOME_COUNT;
        }
        if (
            marketType == 2 && line < BettingConstants.OVER_UNDER_LINE_COUNT
                && oddsLength == BettingConstants.TWO_WAY_OUTCOME_COUNT
        ) {
            return BettingConstants.TWO_WAY_OUTCOME_COUNT;
        }
        revert MarketTemplateNotAllowed(marketType, line);
    }

    function validateOddsArray(uint256[] calldata odds) public pure {
        for (uint256 i = 0; i < odds.length; ++i) {
            validateOddsValue(odds[i]);
        }
    }

    function validateOddsValue(uint256 odds) public pure {
        if (odds < 10_100 || odds % PrecisionConstants.DISPLAY_ODDS_STEP != 0) {
            revert InvalidOddsValue(odds, 10_100, PrecisionConstants.DISPLAY_ODDS_STEP);
        }
    }

    function normalizeOdds(uint256 odds) public pure returns (uint256 normalizedOdds) {
        if (odds < 10_100) {
            return 10_100;
        }
        normalizedOdds = (odds + PrecisionConstants.DISPLAY_ODDS_STEP / 2) / PrecisionConstants.DISPLAY_ODDS_STEP
            * PrecisionConstants.DISPLAY_ODDS_STEP;
        return normalizedOdds < 10_100 ? 10_100 : normalizedOdds;
    }

    function sumArray(uint256[] memory values) public pure returns (uint256 total) {
        for (uint256 i = 0; i < values.length; ++i) {
            total += values[i];
        }
    }

    function copyMemoryArray(uint256[] memory values) public pure returns (uint256[] memory result) {
        result = new uint256[](values.length);
        for (uint256 i = 0; i < values.length; ++i) {
            result[i] = values[i];
        }
    }
}
