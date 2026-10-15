// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ForkBase} from "./helpers/ForkBase.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ODDToken} from "../src/modules/token/ODDToken.sol";
import {StakingPool} from "../src/modules/staking/StakingPool.sol";
import {LiquidityPool} from "../src/modules/liquidity/LiquidityPool.sol";

contract ForkMainnetCoverageEdgesCoreTest is ForkBase {
    function _proxy(address implementation, bytes memory initData) internal returns (address) {
        return address(new ERC1967Proxy(implementation, initData));
    }

    function _freshToken() internal returns (ODDToken token) {
        token = ODDToken(_proxy(address(new ODDToken()), abi.encodeCall(ODDToken.initialize, (admin, admin))));
        _bootstrapOddMvpToken(token, admin, treasury, address(0), address(0), address(0));
    }

    function _freshStaking(address bettingPoolAddress) internal returns (ODDToken token, StakingPool pool) {
        token = _freshToken();
        pool = StakingPool(
            _proxy(
                address(new StakingPool()), abi.encodeCall(StakingPool.initialize, (admin, address(token), treasury))
            )
        );
        vm.prank(admin);
        token.setWhitelist(address(pool), true);
        vm.prank(admin);
        pool.initializeV2(bettingPoolAddress);
    }

    function _freshLiquidity(address bettingPoolAddress) internal returns (ODDToken token, LiquidityPool pool) {
        token = _freshToken();
        pool = LiquidityPool(
            _proxy(
                address(new LiquidityPool()),
                abi.encodeCall(LiquidityPool.initialize, (admin, address(token), bettingPoolAddress))
            )
        );
        vm.prank(admin);
        token.setWhitelist(address(pool), true);
    }

    function testCoverageStakingRemainingEdges() public {
        (ODDToken token, StakingPool pool) = _freshStaking(admin);
        vm.expectRevert();
        vm.prank(user);
        pool.notifyReward(1 ether);

        vm.prank(admin);
        token.transfer(user, 2_000 ether);
        vm.prank(user);
        token.approve(address(pool), type(uint256).max);
        vm.prank(user);
        pool.stake(1_000 ether, 1);
        vm.prank(admin);
        token.transfer(address(pool), 100 ether);
        vm.prank(admin);
        pool.notifyReward(100 ether);
        vm.warp(block.timestamp + 8 hours);
        uint256 treasuryBefore = token.balanceOf(treasury);
        vm.prank(user);
        pool.earlyUnstake(1);
        assertGt(token.balanceOf(treasury), treasuryBefore);

        vm.expectRevert();
        vm.prank(admin);
        pool.setVipTierConfig(1, 6_000 ether, 50_000 ether);
        vm.expectRevert();
        vm.prank(admin);
        pool.setVipTierConfig(1, 1_000 ether, 100_001 ether);

        address proxy = _proxy(
            address(new StakingPool()), abi.encodeCall(StakingPool.initialize, (admin, address(token), treasury))
        );
        StakingPool proxied = StakingPool(proxy);
        vm.prank(admin);
        proxied.initializeV2(admin);
        vm.expectRevert();
        vm.prank(admin);
        proxied.upgradeToAndCall(address(0), bytes(""));
    }

    function testCoverageLiquidityRemainingEdges() public {
        (ODDToken token, LiquidityPool pool) = _freshLiquidity(admin);
        vm.startPrank(admin);
        token.transfer(user, 10_000 ether);
        token.transfer(user2, 10_000 ether);
        token.approve(address(pool), type(uint256).max);
        vm.stopPrank();
        vm.prank(user);
        token.approve(address(pool), type(uint256).max);
        vm.prank(user2);
        token.approve(address(pool), type(uint256).max);

        vm.prank(user);
        uint256 globalPos = pool.depositGlobal(1_000 ether, 1);
        bytes32 matchId = keccak256("coverage-liquidity-remain");
        vm.prank(admin);
        pool.openMatchPool(matchId, uint64(block.timestamp + 1 hours), uint64(block.timestamp + 2 hours));
        vm.prank(admin);
        pool.distributeMargin(matchId, 0);
        vm.prank(user2);
        uint256 matchPos = pool.depositMatch(matchId, 1_000 ether);

        bytes32 matchOnly = keccak256("coverage-liquidity-match-only");
        vm.prank(admin);
        pool.openMatchPool(matchOnly, uint64(block.timestamp + 1 hours), uint64(block.timestamp + 2 hours));
        vm.prank(user2);
        pool.depositMatch(matchOnly, 1_000 ether);
        vm.prank(admin);
        pool.distributeMargin(matchOnly, 100 ether);

        vm.warp(block.timestamp + 15 days);
        vm.prank(user);
        pool.requestUnbond(globalPos);
        vm.warp(block.timestamp + 3 days);
        vm.prank(user);
        pool.withdraw(globalPos);
        vm.expectRevert();
        vm.prank(user);
        pool.requestUnbond(globalPos);
        vm.expectRevert();
        vm.prank(user);
        pool.withdraw(globalPos);

        _openTwoWayMarket(keccak256("coverage-real-match"), 1, 0);
        vm.expectRevert();
        vm.prank(user2);
        liquidity.requestUnbond(matchPos);
    }
}
