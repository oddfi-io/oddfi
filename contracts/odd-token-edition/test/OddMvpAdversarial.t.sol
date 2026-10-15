// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {ODDToken} from "../src/modules/token/ODDToken.sol";
import {OddMvpTestBootstrap} from "./helpers/OddMvpTestBootstrap.sol";

contract OddMvpBusinessActor {
    function approveToken(ODDToken odd, address spender, uint256 amount) external {
        odd.approve(spender, amount);
    }

    function registerSwapProfit(
        ODDToken odd,
        address user,
        uint16 businessType,
        bytes32 rawId,
        uint256 amount,
        address router,
        address expectedPool
    ) external {
        odd.registerBusinessProfitForDexSwap(user, businessType, rawId, amount, router, expectedPool);
    }
}

contract OddMvpAdversarialTest is OddMvpTestBootstrap {
    address internal admin = address(0xA11CE);
    address internal pauser = address(0xCAFE);
    address internal user = address(0x1001);
    address internal spender = address(0x1002);
    address internal router = address(0x2001);
    address internal expectedPool = address(0x2002);
    address internal wrongPool = address(0x2003);

    ODDToken internal odd;
    OddMvpBusinessActor internal business;

    function setUp() public {
        odd = ODDToken(_proxy(address(new ODDToken()), abi.encodeCall(ODDToken.initialize, (admin, pauser))));
        business = new OddMvpBusinessActor();
        _bootstrapOddMvpToken(odd, admin, admin, address(0), address(0), address(business));

        vm.prank(admin);
        odd.transfer(user, 100 ether);
    }

    function testUserCannotBypassBusinessInflowWithTransferOrTransferFrom() public {
        vm.expectRevert();
        vm.prank(user);
        odd.transfer(address(business), 1 ether);

        vm.prank(user);
        odd.approve(spender, 1 ether);
        vm.expectRevert();
        vm.prank(spender);
        odd.transferFrom(user, address(business), 1 ether);
    }

    function testDexRestrictedTargetCannotBeWhitelisted() public {
        vm.prank(admin);
        odd.setDexRestrictedTarget(router, true);

        vm.expectRevert();
        vm.prank(admin);
        odd.setWhitelist(router, true);
    }

    function testBusinessProfitSwapAllowanceRequiresExactExpectedPool() public {
        vm.startPrank(admin);
        odd.setDexRestrictedTarget(router, true);
        odd.setDexRestrictedTarget(expectedPool, true);
        odd.setDexRestrictedTarget(wrongPool, true);
        odd.transfer(address(business), 10 ether);
        vm.stopPrank();

        business.registerSwapProfit(odd, user, 99, keccak256("swap-profit"), 10 ether, router, expectedPool);
        business.approveToken(odd, router, 10 ether);

        vm.expectRevert();
        vm.prank(router);
        odd.transferFrom(address(business), wrongPool, 10 ether);

        vm.prank(router);
        odd.transferFrom(address(business), expectedPool, 10 ether);

        assertEq(odd.businessProfitSwapAllowance(address(business), router, expectedPool), 0);
        assertEq(odd.balanceOf(expectedPool), 10 ether);
    }

    function _proxy(address implementation, bytes memory initData) internal returns (address) {
        return address(new ERC1967Proxy(implementation, initData));
    }
}
