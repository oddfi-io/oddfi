// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ForkBase} from "./helpers/ForkBase.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ODDToken} from "../src/modules/token/ODDToken.sol";
import {StakingPool} from "../src/modules/staking/StakingPool.sol";
import {LiquidityPool} from "../src/modules/liquidity/LiquidityPool.sol";
import {BettingPool} from "../src/modules/betting/BettingPool.sol";
import {BettingBetModule} from "../src/modules/betting/BettingBetModule.sol";
import {BettingSettlementModule} from "../src/modules/betting/BettingSettlementModule.sol";

contract ODDTokenForkV2 is ODDToken {
    uint256 public marker;

    function initializeV2(uint256 m) external reinitializer(2) {
        marker = m;
    }
}

contract StakingForkV2 is StakingPool {
    uint256 public marker;

    function initializeV3(uint256 m) external reinitializer(3) {
        marker = m;
    }
}

contract LiquidityForkV2 is LiquidityPool {
    uint256 public marker;

    function initializeV3(uint256 m) external reinitializer(3) {
        marker = m;
    }
}

contract BettingForkV2 is BettingPool {
    uint256 public marker;

    function initializeV3(uint256 m) external reinitializer(3) {
        marker = m;
    }
}

contract ForkMainnetUpgradeTest is ForkBase {
    function _proxy(address implementation, bytes memory initData) internal returns (address) {
        return address(new ERC1967Proxy(implementation, initData));
    }

    function testForkUpgradePreservesCoreState() public {
        ODDToken oddImpl = new ODDToken();
        address oddProxy = _proxy(address(oddImpl), abi.encodeCall(ODDToken.initialize, (admin, admin)));
        ODDToken oddToken = ODDToken(oddProxy);
        _bootstrapOddMvpToken(oddToken, admin, treasury, address(0), address(0), address(0));
        vm.prank(admin);
        oddToken.transfer(user, 100 ether);

        ODDTokenForkV2 oddImplV2 = new ODDTokenForkV2();
        vm.prank(admin);
        oddToken.upgradeToAndCall(address(oddImplV2), abi.encodeCall(ODDTokenForkV2.initializeV2, (7)));
        assertEq(ODDTokenForkV2(oddProxy).marker(), 7);
        assertEq(ODDTokenForkV2(oddProxy).balanceOf(user), 100 ether);

        StakingPool stakingImpl = new StakingPool();
        address stakingProxy =
            _proxy(address(stakingImpl), abi.encodeCall(StakingPool.initialize, (admin, address(oddToken), treasury)));
        StakingPool stakingPool = StakingPool(stakingProxy);
        vm.prank(admin);
        oddToken.setWhitelist(address(stakingPool), true);
        vm.prank(admin);
        stakingPool.initializeV2(address(betting));
        vm.prank(admin);
        oddToken.approve(address(stakingPool), type(uint256).max);
        vm.prank(admin);
        stakingPool.stake(1_000 ether, 1);
        StakingForkV2 stakingImplV2 = new StakingForkV2();
        vm.prank(admin);
        stakingPool.upgradeToAndCall(address(stakingImplV2), abi.encodeCall(StakingForkV2.initializeV3, (9)));
        assertEq(StakingForkV2(stakingProxy).marker(), 9);
        assertEq(StakingForkV2(stakingProxy).getActiveStakeAmount(admin), 1_000 ether);

        LiquidityPool liqImpl = new LiquidityPool();
        address liqProxy = _proxy(
            address(liqImpl), abi.encodeCall(LiquidityPool.initialize, (admin, address(oddToken), address(betting)))
        );
        LiquidityPool liq = LiquidityPool(liqProxy);
        vm.prank(admin);
        oddToken.setWhitelist(address(liq), true);
        vm.prank(admin);
        oddToken.approve(address(liq), type(uint256).max);
        vm.prank(admin);
        liq.depositGlobal(1_000 ether, 1);
        LiquidityForkV2 liqImplV2 = new LiquidityForkV2();
        vm.prank(admin);
        liq.upgradeToAndCall(address(liqImplV2), abi.encodeCall(LiquidityForkV2.initializeV3, (11)));
        assertEq(LiquidityForkV2(liqProxy).marker(), 11);
        assertEq(LiquidityForkV2(liqProxy).totalActiveDeposited(), 1_000 ether);

        BettingSettlementModule settlement = new BettingSettlementModule();
        BettingBetModule betModule = new BettingBetModule();
        BettingPool betImpl = new BettingPool();
        address betProxy = _proxy(
            address(betImpl),
            abi.encodeCall(BettingPool.initialize, (admin, address(oddToken), address(stakingPool), address(liq)))
        );
        BettingPool bet = BettingPool(betProxy);
        _installBettingModules(bet, settlement, betModule);
        vm.prank(admin);
        oddToken.setWhitelist(address(bet), true);
        vm.prank(admin);
        bet.initializeV2(treasury);
        vm.prank(admin);
        oddToken.approve(address(bet), type(uint256).max);
        vm.prank(admin);
        bet.addPlatformReserve(1_000 ether);
        BettingForkV2 betImplV2 = new BettingForkV2();
        vm.prank(admin);
        bet.upgradeToAndCall(address(betImplV2), abi.encodeCall(BettingForkV2.initializeV3, (13)));
        assertEq(BettingForkV2(betProxy).marker(), 13);
        assertEq(BettingForkV2(betProxy).platformReserve(), 1_000 ether);
    }
}
