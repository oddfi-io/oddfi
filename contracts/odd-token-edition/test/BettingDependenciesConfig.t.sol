// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ODDToken} from "../src/modules/token/ODDToken.sol";
import {StakingPool} from "../src/modules/staking/StakingPool.sol";
import {LiquidityPool} from "../src/modules/liquidity/LiquidityPool.sol";
import {BettingPool} from "../src/modules/betting/BettingPool.sol";
import {DependenciesAlreadyConfigured} from "../src/shared/errors/ConfigErrors.sol";

contract BettingDependenciesConfigTest is Test {
    address internal admin = address(0xA11CE);
    address internal treasury = address(0xBEEF);

    function _proxy(address implementation, bytes memory initData) internal returns (address) {
        return address(new ERC1967Proxy(implementation, initData));
    }

    function testSetBettingDependenciesCannotReplaceConfiguredLedgerAnchors() public {
        ODDToken odd = ODDToken(_proxy(address(new ODDToken()), abi.encodeCall(ODDToken.initialize, (admin, admin))));

        StakingPool staking = StakingPool(
            _proxy(address(new StakingPool()), abi.encodeCall(StakingPool.initialize, (admin, address(odd), treasury)))
        );

        LiquidityPool liquidity = LiquidityPool(
            _proxy(address(new LiquidityPool()), abi.encodeCall(LiquidityPool.initialize, (admin, address(odd), admin)))
        );

        BettingPool betting = BettingPool(
            _proxy(
                address(new BettingPool()),
                abi.encodeCall(BettingPool.initialize, (admin, address(odd), address(staking), address(liquidity)))
            )
        );

        vm.expectRevert(DependenciesAlreadyConfigured.selector);
        vm.prank(admin);
        betting.setBettingDependencies(address(staking), address(liquidity), address(odd));
    }
}
