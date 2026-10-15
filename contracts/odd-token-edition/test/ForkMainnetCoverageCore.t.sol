// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ForkBase} from "./helpers/ForkBase.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ODDToken} from "../src/modules/token/ODDToken.sol";
import {StakingPool} from "../src/modules/staking/StakingPool.sol";
import {LiquidityPool} from "../src/modules/liquidity/LiquidityPool.sol";
import {PrecisionConstants} from "../src/shared/constants/PrecisionConstants.sol";
import {LpPositionState} from "../src/shared/types/LiquidityEnums.sol";

contract ForkMainnetCoverageCoreTest is ForkBase {
    function _proxy(address implementation, bytes memory initData) internal returns (address) {
        return address(new ERC1967Proxy(implementation, initData));
    }

    function _freshToken(address tokenAdmin) internal returns (ODDToken token) {
        token = ODDToken(_proxy(address(new ODDToken()), abi.encodeCall(ODDToken.initialize, (tokenAdmin, tokenAdmin))));
        _bootstrapOddMvpToken(token, tokenAdmin, treasury, address(0), address(0), address(0));
    }

    function _freshStaking(address tokenAdmin, address treasuryAddress, address bettingPoolAddress)
        internal
        returns (ODDToken token, StakingPool pool)
    {
        token = _freshToken(tokenAdmin);
        pool = StakingPool(
            _proxy(
                address(new StakingPool()),
                abi.encodeCall(StakingPool.initialize, (tokenAdmin, address(token), treasuryAddress))
            )
        );
        vm.prank(tokenAdmin);
        token.setWhitelist(address(pool), true);
        vm.prank(tokenAdmin);
        pool.initializeV2(bettingPoolAddress);
    }

    function _freshLiquidity(address tokenAdmin, address bettingPoolAddress)
        internal
        returns (ODDToken token, LiquidityPool pool)
    {
        token = _freshToken(tokenAdmin);
        pool = LiquidityPool(
            _proxy(
                address(new LiquidityPool()),
                abi.encodeCall(LiquidityPool.initialize, (tokenAdmin, address(token), bettingPoolAddress))
            )
        );
        vm.prank(tokenAdmin);
        token.setWhitelist(address(pool), true);
    }

    function testCoverageTokenInitializerAndPauseGuards() public {
        ODDToken fresh = new ODDToken();
        vm.expectRevert();
        fresh.initialize(address(0), admin);

        fresh = _freshToken(admin);
        vm.expectRevert();
        fresh.initialize(admin, admin);

        vm.prank(admin);
        fresh.pause();
        vm.expectRevert();
        vm.prank(admin);
        fresh.transfer(user, 1 ether);

        vm.prank(admin);
        fresh.unpause();
        vm.prank(admin);
        fresh.transfer(user, 1 ether);
        assertEq(fresh.balanceOf(user), 1 ether);

        address proxy = _proxy(address(new ODDToken()), abi.encodeCall(ODDToken.initialize, (admin, admin)));
        ODDToken proxied = ODDToken(proxy);
        vm.expectRevert();
        vm.prank(admin);
        proxied.upgradeToAndCall(address(0), bytes(""));
    }

    function testCoverageStakingInitializerAndConfigGuards() public {
        ODDToken token = _freshToken(admin);
        StakingPool pool = new StakingPool();

        vm.expectRevert();
        vm.prank(admin);
        pool.initialize(admin, address(0), treasury);

        pool = StakingPool(
            _proxy(
                address(new StakingPool()), abi.encodeCall(StakingPool.initialize, (admin, address(token), treasury))
            )
        );

        vm.expectRevert();
        vm.prank(admin);
        pool.initializeV2(address(0));
        vm.prank(admin);
        pool.initializeV2(admin);

        vm.expectRevert();
        vm.prank(admin);
        pool.setPlatformTreasury(address(0));
        vm.expectRevert();
        vm.prank(admin);
        pool.setBettingPool(address(0));
        vm.expectRevert();
        vm.prank(admin);
        pool.setMinStakeAmount(0);
        vm.expectRevert();
        vm.prank(admin);
        pool.setVipTierConfig(11, 0, 0);
        vm.expectRevert();
        vm.prank(admin);
        pool.setVipTierConfig(0, 1 ether, 10_000 ether);
        vm.expectRevert();
        vm.prank(admin);
        pool.setVipTierConfig(2, 999 ether, 100_000 ether);
        vm.expectRevert();
        vm.prank(admin);
        pool.setVipTierConfig(1, 1_000 ether, 9_999 ether);

        vm.prank(admin);
        pool.setVipTierConfig(1, 2_000 ether, 60_000 ether);
        vm.prank(admin);
        token.setTreasurySink(user, true);
        vm.prank(admin);
        pool.setPlatformTreasury(user);
        vm.prank(admin);
        pool.setBettingPool(user2);
        vm.prank(admin);
        pool.setMinStakeAmount(250 ether);
        vm.prank(admin);
        pool.pause();
        vm.prank(admin);
        pool.unpause();
    }

    function testCoverageStakingFlowAndRewardBranches() public {
        (ODDToken token, StakingPool pool) = _freshStaking(admin, treasury, admin);
        vm.prank(admin);
        token.transfer(user, 5_000 ether);
        vm.prank(user);
        token.approve(address(pool), type(uint256).max);

        vm.expectRevert();
        vm.prank(user);
        pool.stake(99 ether, 1);
        vm.expectRevert();
        vm.prank(user);
        pool.stake(200 ether, 99);

        vm.prank(user);
        uint256 positionId = pool.stake(1_000 ether, 1);
        assertTrue(pool.isActiveStaker(user));
        assertEq(pool.getActiveStakeAmount(user), 1_000 ether);

        vm.expectRevert();
        vm.prank(outsider);
        pool.unstake(positionId);
        vm.expectRevert();
        vm.prank(user);
        pool.unstake(positionId);

        vm.expectRevert();
        vm.prank(admin);
        pool.notifyReward(0);
        vm.expectRevert();
        vm.prank(admin);
        pool.notifyReward(10 ether);

        vm.prank(admin);
        token.transfer(address(pool), 100 ether);
        vm.prank(admin);
        pool.notifyReward(100 ether);

        vm.warp(block.timestamp + 31 days);
        vm.expectRevert();
        vm.prank(user);
        pool.earlyUnstake(positionId);

        vm.prank(user);
        pool.unstake(positionId);
        assertEq(pool.getActiveStakeAmount(user), 0);
        vm.expectRevert();
        vm.prank(user);
        pool.unstake(positionId);
    }

    function testCoverageStakingRewardRedirectAndEarlyUnstakeRedistribution() public {
        (ODDToken token, StakingPool pool) = _freshStaking(admin, treasury, admin);

        uint256 treasuryBefore = token.balanceOf(treasury);
        vm.prank(admin);
        token.transfer(address(pool), 50 ether);
        vm.prank(admin);
        pool.notifyReward(50 ether);
        assertEq(token.balanceOf(treasury), treasuryBefore + 50 ether);

        vm.startPrank(admin);
        token.transfer(user, 2_000 ether);
        token.transfer(user2, 2_000 ether);
        vm.stopPrank();
        vm.prank(user);
        token.approve(address(pool), type(uint256).max);
        vm.prank(user2);
        token.approve(address(pool), type(uint256).max);

        vm.prank(user);
        pool.stake(1_000 ether, 1);
        vm.prank(user2);
        pool.stake(1_000 ether, 1);

        vm.prank(admin);
        token.transfer(address(pool), 100 ether);
        vm.prank(admin);
        pool.notifyReward(100 ether);
        assertGt(pool.accRewardPerShare(), 0);

        vm.warp(block.timestamp + 8 hours);
        vm.prank(user);
        pool.earlyUnstake(1);
        assertEq(pool.getActiveStakeAmount(user), 0);
        assertGt(pool.accRewardPerShare(), 0);
    }

    function testCoverageLiquidityInitializerAndConfigGuards() public {
        ODDToken token = _freshToken(admin);
        LiquidityPool pool = new LiquidityPool();

        vm.expectRevert();
        vm.prank(admin);
        pool.initialize(admin, address(token), address(0));

        pool = LiquidityPool(
            _proxy(
                address(new LiquidityPool()), abi.encodeCall(LiquidityPool.initialize, (admin, address(token), admin))
            )
        );
        vm.prank(admin);
        token.setWhitelist(address(pool), true);

        vm.expectRevert();
        vm.prank(admin);
        pool.setBettingPool(address(0));
        vm.expectRevert();
        vm.prank(admin);
        pool.setMinDeposit(0);
        vm.expectRevert();
        vm.prank(admin);
        pool.setUnbondEpochs(0);

        vm.prank(admin);
        pool.setBettingPool(user);
        vm.prank(admin);
        pool.setMinDeposit(2_000 ether);
        vm.prank(admin);
        pool.setUnbondEpochs(1);

        vm.prank(admin);
        token.approve(address(pool), type(uint256).max);
        vm.prank(admin);
        pool.depositGlobal(2_000 ether, 1);

        address proxy = _proxy(
            address(new LiquidityPool()), abi.encodeCall(LiquidityPool.initialize, (admin, address(token), admin))
        );
        LiquidityPool proxied = LiquidityPool(proxy);
        vm.expectRevert();
        vm.prank(admin);
        proxied.upgradeToAndCall(address(0), bytes(""));
    }

    function testCoverageLiquidityOperationalBranches() public {
        (ODDToken token, LiquidityPool pool) = _freshLiquidity(admin, admin);
        vm.startPrank(admin);
        token.transfer(user, 10_000 ether);
        token.transfer(user2, 10_000 ether);
        token.transfer(lpUser, 10_000 ether);
        vm.stopPrank();
        vm.prank(user);
        token.approve(address(pool), type(uint256).max);
        vm.prank(user2);
        token.approve(address(pool), type(uint256).max);
        vm.prank(lpUser);
        token.approve(address(pool), type(uint256).max);

        vm.expectRevert();
        vm.prank(user);
        pool.depositGlobal(999 ether, 1);
        vm.expectRevert();
        vm.prank(user);
        pool.depositGlobal(1_000 ether, 99);

        vm.prank(user);
        uint256 globalPos = pool.depositGlobal(1_000 ether, 1);
        assertEq(pool.getRequestableLiquidity(), 1_000 ether);

        bytes32 matchId = keccak256("coverage-liquidity-match");
        vm.expectRevert();
        vm.prank(admin);
        pool.openMatchPool(bytes32(0), uint64(block.timestamp + 1 hours), uint64(block.timestamp + 2 hours));
        vm.prank(admin);
        pool.openMatchPool(matchId, uint64(block.timestamp + 1 hours), uint64(block.timestamp + 2 hours));
        vm.expectRevert();
        vm.prank(admin);
        pool.openMatchPool(matchId, uint64(block.timestamp + 1 hours), uint64(block.timestamp + 2 hours));

        vm.expectRevert();
        vm.prank(user);
        pool.depositMatch(keccak256("missing"), 1_000 ether);
        vm.prank(user2);
        uint256 matchPos = pool.depositMatch(matchId, 1_000 ether);

        vm.warp(block.timestamp + 1 hours + 1);
        vm.expectRevert();
        vm.prank(lpUser);
        pool.depositMatch(matchId, 1_000 ether);
        vm.prank(admin);
        pool.closeMatchPoolDeposit(matchId);

        vm.expectRevert();
        vm.prank(admin);
        pool.closeMatchPoolDeposit(keccak256("bad-match"));
        vm.expectRevert();
        vm.prank(admin);
        pool.distributeMargin(keccak256("bad-match"), 10 ether);
        vm.expectRevert();
        vm.prank(admin);
        pool.distributeLoss(keccak256("bad-match"), 10 ether);

        bytes32 emptyMatch = keccak256("coverage-empty-match");
        vm.prank(admin);
        pool.openMatchPool(emptyMatch, uint64(block.timestamp + 1 hours), uint64(block.timestamp + 2 hours));
        vm.prank(admin);
        pool.distributeMargin(emptyMatch, 10 ether);
        vm.prank(admin);
        pool.distributeLoss(emptyMatch, 10 ether);

        vm.prank(admin);
        pool.distributeMargin(matchId, 100 ether);
        vm.prank(admin);
        pool.distributeLoss(matchId, 500 ether);

        vm.expectRevert();
        vm.prank(outsider);
        pool.requestUnbond(globalPos);
        vm.expectRevert();
        vm.prank(user);
        pool.requestUnbond(globalPos);

        vm.warp(block.timestamp + 30 days);
        vm.prank(user);
        pool.requestUnbond(globalPos);
        vm.expectRevert();
        vm.prank(user);
        pool.withdraw(globalPos);
        vm.warp(block.timestamp + 3 days);
        assertEq(uint8(pool.getPositionState(globalPos)), uint8(LpPositionState.Withdrawable));
        vm.prank(user);
        pool.withdraw(globalPos);

        vm.expectRevert();
        vm.prank(user2);
        pool.requestUnbond(matchPos);

        bytes32 wipeMatch = keccak256("coverage-wipe-match");
        vm.prank(admin);
        pool.openMatchPool(wipeMatch, uint64(block.timestamp + 1 hours), uint64(block.timestamp + 2 hours));
        vm.prank(lpUser);
        uint256 wipedGlobal = pool.depositGlobal(1_000 ether, 1);
        vm.prank(admin);
        pool.distributeLoss(wipeMatch, 1_000 ether);
        uint256 wipeMatureAt = block.timestamp + 15 days;
        vm.warp(wipeMatureAt);
        vm.prank(lpUser);
        pool.requestUnbond(wipedGlobal);
        vm.warp(wipeMatureAt + 3 days);
        vm.prank(lpUser);
        pool.withdraw(wipedGlobal);
        (,,,,,,,,,,, LpPositionState finalState) = pool.positions(wipedGlobal);
        assertEq(uint8(finalState), uint8(LpPositionState.Liquidated));

        bytes32 payoutMatch = keccak256("coverage-payout-window");
        vm.expectRevert();
        vm.prank(admin);
        pool.requestPayoutLiquidity(payoutMatch, 1 ether);

        vm.prank(admin);
        pool.distributeLoss(matchId, 100 ether);
        vm.expectRevert();
        vm.prank(admin);
        pool.requestPayoutLiquidity(matchId, type(uint256).max);
        vm.prank(admin);
        pool.requestPayoutLiquidity(matchId, 100 ether);

        vm.prank(admin);
        pool.pause();
        vm.expectRevert();
        vm.prank(user2);
        pool.depositGlobal(1_000 ether, 1);
        vm.prank(admin);
        pool.unpause();
    }
}
