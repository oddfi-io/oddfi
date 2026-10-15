// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ODDToken} from "../src/modules/token/ODDToken.sol";
import {StakingPool} from "../src/modules/staking/StakingPool.sol";
import {LiquidityPool} from "../src/modules/liquidity/LiquidityPool.sol";
import {BettingPool} from "../src/modules/betting/BettingPool.sol";

contract UUPSImplementationInitializerTest is Test {
    address internal admin = address(0xA11CE);
    address internal treasury = address(0xBEEF);

    function testImplementationInitializersAreDisabled() public {
        ODDToken oddImpl = new ODDToken();
        vm.expectRevert();
        oddImpl.initialize(admin, admin);

        StakingPool stakingImpl = new StakingPool();
        vm.expectRevert();
        stakingImpl.initialize(admin, address(oddImpl), treasury);

        LiquidityPool liquidityImpl = new LiquidityPool();
        vm.expectRevert();
        liquidityImpl.initialize(admin, address(oddImpl), admin);

        BettingPool bettingImpl = new BettingPool();
        vm.expectRevert();
        bettingImpl.initialize(admin, address(oddImpl), address(stakingImpl), address(liquidityImpl));
    }
}
