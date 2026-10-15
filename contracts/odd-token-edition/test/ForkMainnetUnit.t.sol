// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ForkBase} from "./helpers/ForkBase.sol";
import {ODDToken} from "../src/modules/token/ODDToken.sol";
import {StakingPool} from "../src/modules/staking/StakingPool.sol";
import {LiquidityPool} from "../src/modules/liquidity/LiquidityPool.sol";
import {BettingPool} from "../src/modules/betting/BettingPool.sol";
import {QuoteGuardInput} from "../src/shared/types/CommonTypes.sol";
import {PrecisionConstants} from "../src/shared/constants/PrecisionConstants.sol";
import {LpPositionState} from "../src/shared/types/LiquidityEnums.sol";

contract ODDTokenV2MockFork is ODDToken {
    uint256 public marker;

    function initializeV2(uint256 newMarker) external reinitializer(2) {
        marker = newMarker;
    }
}

contract StakingPoolV2MockFork is StakingPool {
    uint256 public marker;

    function initializeV3(uint256 newMarker) external reinitializer(3) {
        marker = newMarker;
    }
}

contract LiquidityPoolV2MockFork is LiquidityPool {
    uint256 public marker;

    function initializeV3(uint256 newMarker) external reinitializer(3) {
        marker = newMarker;
    }
}

contract BettingPoolV2MockFork is BettingPool {
    uint256 public marker;

    function initializeV3(uint256 newMarker) external reinitializer(3) {
        marker = newMarker;
    }
}

contract ForkMainnetUnitTest is ForkBase {
    function testTokenPauseAndUpgradeRoleOnFork() public {
        vm.prank(admin);
        odd.pause();
        vm.expectRevert();
        vm.prank(user);
        odd.transfer(user2, 1 ether);

        vm.prank(admin);
        odd.unpause();
        vm.prank(user);
        odd.transfer(user2, 1 ether);
        assertEq(odd.balanceOf(user2), 2_000_000 ether + 1 ether);

        ODDTokenV2MockFork impl = new ODDTokenV2MockFork();
        vm.expectRevert();
        vm.prank(user);
        odd.upgradeToAndCall(address(impl), abi.encodeCall(ODDTokenV2MockFork.initializeV2, (7)));
    }

    function testStakingGovernanceAndLifecycleOnFork() public {
        vm.prank(admin);
        staking.setMinStakeAmount(250 ether);
        vm.prank(admin);
        staking.setVipTierConfig(1, 2_000 ether, 60_000 ether);

        vm.expectRevert();
        vm.prank(user);
        staking.stake(200 ether, 1);

        vm.prank(user);
        uint256 positionId = staking.stake(2_000 ether, 1);
        assertEq(staking.getUserTier(user), 1);
        assertEq(staking.getUserDailyLimit(user), 60_000 ether);

        vm.prank(admin);
        odd.transfer(address(staking), 100 ether);
        vm.prank(address(betting));
        staking.notifyReward(100 ether);
        vm.warp(block.timestamp + 31 days);
        vm.prank(user);
        staking.unstake(positionId);
        assertEq(staking.getActiveStakeAmount(user), 0);
    }

    function testLiquidityLifecycleAndStateProjectionOnFork() public {
        vm.prank(admin);
        liquidity.setMinDeposit(2_000 ether);
        vm.prank(admin);
        liquidity.setUnbondEpochs(1);

        bytes32 matchId = keccak256("fork-unit-liquidity");
        bytes32 marketId = _openTwoWayMarket(matchId, 1, 0);

        vm.prank(lpUser);
        uint256 globalPos = liquidity.depositGlobal(2_000 ether, 1);
        vm.prank(lpUser);
        uint256 matchPos = liquidity.depositMatch(matchId, 2_000 ether);

        vm.warp(block.timestamp + 20 days);
        _finalizeMarketStatus(betting, marketId, 2);

        assertEq(uint8(liquidity.getPositionState(globalPos)), uint8(LpPositionState.Ready));
        assertEq(uint8(liquidity.getPositionState(matchPos)), uint8(LpPositionState.Ready));

        vm.prank(lpUser);
        liquidity.requestUnbond(globalPos);
        vm.prank(lpUser);
        liquidity.requestUnbond(matchPos);

        vm.warp(block.timestamp + 2 days);
        assertEq(uint8(liquidity.getPositionState(globalPos)), uint8(LpPositionState.Withdrawable));
        vm.prank(lpUser);
        liquidity.withdraw(globalPos);
        (,,,,,,,,,,, LpPositionState stateAfter) = liquidity.positions(globalPos);
        assertEq(uint8(stateAfter), uint8(LpPositionState.Withdrawn));
    }

    function testBettingConfigAndRiskPathsOnFork() public {
        vm.prank(admin);
        betting.setRiskConfig(40_000 ether, 120_000 ether, 200_000 ether);
        vm.prank(admin);
        betting.setMarginSplit(7000);
        assertEq(betting.wclYellowThreshold(), 40_000 ether);
        assertEq(betting.lpMarginShareBps(), 7000);

        bytes32 marketId = _openThreeWayMarket(keccak256("fork-unit-betting"));
        (QuoteGuardInput memory guard,,) = _guard(marketId, 0, 100 ether);
        vm.prank(user);
        betting.placeBet(marketId, 0, 100 ether, guard, referrer);
        assertEq(betting.referrers(user), referrer);
        assertEq(betting.referrerRewardsOdd(referrer), 1 ether);

        vm.prank(admin);
        uint256[] memory newOdds = new uint256[](3);
        newOdds[0] = 20_100;
        newOdds[1] = 30_100;
        newOdds[2] = 40_100;
        betting.updateOdds(marketId, newOdds, uint64(block.timestamp));
        (uint256[] memory baseOdds,,, uint256 quoteVersion) = betting.getMarketOdds(marketId);
        assertEq(baseOdds[0], 20_100);
        assertGt(quoteVersion, 1);
    }
}
