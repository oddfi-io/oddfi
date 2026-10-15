// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

import {BettingOddsLib} from "../src/modules/betting/BettingOddsLib.sol";
import {PrecisionConstants} from "../src/shared/constants/PrecisionConstants.sol";
import {BettingConstants} from "../src/shared/constants/BettingConstants.sol";
import {SignalColor} from "../src/shared/types/MarketEnums.sol";

contract BettingOddsV2Test is Test {
    function testComputeQuotedOddsUsesPayoutAccumulator() public {
        uint256[] memory baseOdds = new uint256[](2);
        baseOdds[0] = 20_000;
        baseOdds[1] = 20_000;

        uint256[] memory stakes = new uint256[](2);
        stakes[0] = 100_000 ether;

        uint256[] memory payouts = new uint256[](2);
        payouts[0] = 250_000 ether;

        (uint256[] memory quotedOdds, uint256 worstCaseLoss, SignalColor signal) = BettingOddsLib.computeQuotedOdds(
            baseOdds,
            stakes,
            payouts,
            BettingConstants.WCL_YELLOW_THRESHOLD,
            BettingConstants.WCL_ORANGE_THRESHOLD,
            BettingConstants.WCL_RED_THRESHOLD
        );

        assertEq(worstCaseLoss, 150_000 ether);
        assertEq(uint8(signal), uint8(SignalColor.Yellow));
        assertLt(quotedOdds[0], baseOdds[0]);
        assertGt(quotedOdds[1], baseOdds[1]);
    }

    function testMaxStakeAtRedThresholdMatchesV2Example() public {
        uint256 maxStake = BettingOddsLib.maxStakeAtRedThreshold(
            500_000 ether, 250_000 ether, 22_000, BettingConstants.WCL_RED_THRESHOLD
        );

        assertEq(maxStake, 25_000 ether);
    }

    function testSignalBoundariesAreLeftOpenRightClosed() public {
        assertEq(
            uint8(
                BettingOddsLib.signalFor(
                    BettingConstants.WCL_YELLOW_THRESHOLD,
                    BettingConstants.WCL_YELLOW_THRESHOLD,
                    BettingConstants.WCL_ORANGE_THRESHOLD,
                    BettingConstants.WCL_RED_THRESHOLD
                )
            ),
            uint8(SignalColor.Green)
        );
        assertEq(
            uint8(
                BettingOddsLib.signalFor(
                    BettingConstants.WCL_ORANGE_THRESHOLD,
                    BettingConstants.WCL_YELLOW_THRESHOLD,
                    BettingConstants.WCL_ORANGE_THRESHOLD,
                    BettingConstants.WCL_RED_THRESHOLD
                )
            ),
            uint8(SignalColor.Yellow)
        );
        assertEq(
            uint8(
                BettingOddsLib.signalFor(
                    BettingConstants.WCL_RED_THRESHOLD,
                    BettingConstants.WCL_YELLOW_THRESHOLD,
                    BettingConstants.WCL_ORANGE_THRESHOLD,
                    BettingConstants.WCL_RED_THRESHOLD
                )
            ),
            uint8(SignalColor.Orange)
        );
        assertEq(
            uint8(
                BettingOddsLib.signalFor(
                    BettingConstants.WCL_RED_THRESHOLD + 1,
                    BettingConstants.WCL_YELLOW_THRESHOLD,
                    BettingConstants.WCL_ORANGE_THRESHOLD,
                    BettingConstants.WCL_RED_THRESHOLD
                )
            ),
            uint8(SignalColor.Red)
        );
    }

    function testRedLineOddsNormalizesToTickAndFloor() public {
        assertEq(BettingOddsLib.redLineOdds(25_000), 22_000);
        assertEq(BettingOddsLib.redLineOdds(11_000), 10_100);
        assertEq(PrecisionConstants.ODDS_RATE_SCALE, 10_000);
    }

    function testFuzzMaxStakeAtRedThresholdDoesNotExceedRed(uint128 rawPayout, uint128 rawTotalStake, uint16 rawOdds)
        public
    {
        uint256 currentOutcomePayout = bound(uint256(rawPayout), 0, 1_000_000_000 ether);
        uint256 currentTotalStake = bound(uint256(rawTotalStake), 0, 1_000_000_000 ether);
        uint256 odds = bound(uint256(rawOdds), 10_100, 50_000);

        uint256 maxStake = BettingOddsLib.maxStakeAtRedThreshold(
            currentOutcomePayout, currentTotalStake, odds, BettingConstants.WCL_RED_THRESHOLD
        );

        uint256 currentWcl = BettingOddsLib.currentOutcomeWcl(currentOutcomePayout, currentTotalStake);
        if (currentWcl >= BettingConstants.WCL_RED_THRESHOLD) {
            assertEq(maxStake, 0);
            return;
        }

        uint256 newPayout = currentOutcomePayout + maxStake * odds / PrecisionConstants.ODDS_RATE_SCALE;
        uint256 newTotalStake = currentTotalStake + maxStake;
        uint256 newWcl = BettingOddsLib.currentOutcomeWcl(newPayout, newTotalStake);
        assertLe(newWcl, BettingConstants.WCL_RED_THRESHOLD);
    }
}
