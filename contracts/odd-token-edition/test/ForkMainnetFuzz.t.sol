// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ForkBase} from "./helpers/ForkBase.sol";
import {QuoteGuardInput} from "../src/shared/types/CommonTypes.sol";

contract ForkMainnetFuzzTest is ForkBase {
    function testFuzzPlaceBetMaintainsLedger(uint96 rawAmount) public {
        uint256 amount = bound(uint256(rawAmount), 100 ether, 5_000 ether);
        bytes32 marketId = _openThreeWayMarket(keccak256(abi.encodePacked("fuzz-bet", amount)));
        (QuoteGuardInput memory guard, uint256 acceptedAmount, uint256 lockedOdds) = _guard(marketId, 0, amount);

        uint256 beforePool = odd.balanceOf(address(betting));
        vm.prank(user);
        (bytes32 betId, uint256 accepted, uint256 odds) = betting.placeBet(marketId, 0, amount, guard, referrer);

        assertEq(accepted, acceptedAmount);
        assertEq(odds, lockedOdds);
        assertGt(odd.balanceOf(address(betting)), beforePool);
        assertEq(betting.getBet(betId).acceptedAmount, acceptedAmount);
        assertEq(betting.getUserRiskLedger(user).unsettledStake, acceptedAmount);
    }

    function testFuzzReferralOddClaimPartial(uint96 rawOdd) public {
        bytes32 marketId = _openTwoWayMarket(keccak256("fuzz-referral"), 1, 0);
        (QuoteGuardInput memory guard,,) = _guard(marketId, 0, 100 ether);
        vm.prank(user);
        betting.placeBet(marketId, 0, 100 ether, guard, referrer);

        uint256 available = betting.referrerRewardsOdd(referrer);
        uint256 claimAmount = bound(uint256(rawOdd), 1, available);
        uint256 before = odd.balanceOf(referrer);
        vm.prank(referrer);
        betting.claimReferralRewards(claimAmount);
        assertEq(odd.balanceOf(referrer), before + claimAmount);
        assertEq(betting.referrerRewardsOdd(referrer), available - claimAmount);
    }
}
