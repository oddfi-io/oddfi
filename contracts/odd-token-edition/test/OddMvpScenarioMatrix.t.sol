// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {ODDToken} from "../src/modules/token/ODDToken.sol";
import {IODDTokenBusiness} from "../src/modules/token/interfaces/IODDTokenBusiness.sol";
import {OddMvpBusinessHarness, OddMvpSourceHarness} from "./helpers/OddMvpTokenHarnesses.sol";

contract OddMvpScenarioMatrixTest is Test {
    address internal admin = address(0xA11CE);
    address internal pauser = address(0xCAFE);
    address internal user = address(0x1001);
    address internal receiver = address(0x1002);
    address internal router = address(0x2001);
    address internal expectedPool = address(0x2002);

    ODDToken internal odd;
    OddMvpSourceHarness internal tierSale;
    OddMvpSourceHarness internal houseVault;
    OddMvpSourceHarness internal dexLaunch;
    OddMvpSourceHarness internal rewards;
    OddMvpBusinessHarness internal business;

    function setUp() public {
        vm.warp(1_000_000);

        odd = ODDToken(_proxy(address(new ODDToken()), abi.encodeCall(ODDToken.initialize, (admin, pauser))));
        tierSale = new OddMvpSourceHarness();
        houseVault = new OddMvpSourceHarness();
        dexLaunch = new OddMvpSourceHarness();
        rewards = new OddMvpSourceHarness();
        business = new OddMvpBusinessHarness();

        vm.startPrank(admin);
        odd.setTreasurySink(admin, true);
        odd.setFixedSourceContracts(
            IODDTokenBusiness.FixedSources({
                tierSale: address(tierSale),
                houseVault: address(houseVault),
                dexLaunchController: address(dexLaunch),
                ecosystemRewards: address(rewards),
                opsTreasury: admin
            })
        );
        odd.setWhitelist(address(business), true);
        odd.allocateInitialSupply();
        vm.stopPrank();
    }

    function testMatrixDirectTransferToBusinessRevertsButBusinessEntryWorks() public {
        tierSale.distributeSale(odd, user, 100 ether);

        vm.expectRevert();
        vm.prank(user);
        odd.transfer(address(business), 1 ether);

        vm.prank(user);
        odd.approve(address(business), 100 ether);
        bytes32 businessId = business.consume(odd, user, 1, keccak256("business-entry"), 100 ether);

        IODDTokenBusiness.BusinessSnapshot memory snapshot = odd.businessSnapshotOf(businessId);
        assertEq(snapshot.businessIn, 100 ether);
        assertEq(snapshot.sourceIn.saleLocked, 100 ether);
        assertEq(odd.balanceOf(address(business)), 100 ether);
    }

    function testMatrixLosingBusinessFinalizationReducesLockedPrincipal() public {
        bytes32 businessId = _consumeSaleInBusiness(100 ether, keccak256("loss"));

        business.outcome(odd, user, businessId, 0, true);

        IODDTokenBusiness.BusinessSnapshot memory snapshot = odd.businessSnapshotOf(businessId);
        assertEq(snapshot.lossRecognized, 100 ether);
        assertEq(odd.balanceOf(user), 0);
        assertEq(odd.lockedBalanceOf(user), 0);
        assertEq(odd.transferableBalanceOf(user), 0);
    }

    function testMatrixPartialBusinessReturnKeepsOnlyNetLossDeducted() public {
        bytes32 businessId = _consumeSaleInBusiness(100 ether, keccak256("partial-return"));

        business.outcome(odd, user, businessId, 40 ether, true);

        IODDTokenBusiness.BusinessSnapshot memory snapshot = odd.businessSnapshotOf(businessId);
        assertEq(snapshot.principalReturned, 40 ether);
        assertEq(snapshot.lossRecognized, 60 ether);
        assertEq(odd.balanceOf(user), 40 ether);
        assertEq(odd.lockedBalanceOf(user), 40 ether);
        assertEq(odd.transferableBalanceOf(user), 0);
    }

    function testMatrixBusinessProfitCanBeSpentWithoutUnlockingPrincipal() public {
        bytes32 businessId = _consumeSaleInBusiness(100 ether, keccak256("profit"));
        vm.prank(admin);
        odd.transfer(address(business), 25 ether);

        business.outcome(odd, user, businessId, 125 ether, true);

        assertEq(odd.lockedBalanceOf(user), 100 ether);
        assertEq(odd.transferableBalanceOf(user), 25 ether);
        vm.prank(user);
        odd.transfer(receiver, 25 ether);
        assertEq(odd.balanceOf(receiver), 25 ether);
    }

    function testMatrixSaleUnlockScheduleControlsOrdinaryTransfer() public {
        tierSale.distributeSale(odd, user, 870 ether);
        vm.prank(admin);
        odd.markDexPoolLaunched(uint64(block.timestamp));

        (uint256 unlockedDayOne, uint256 lockedDayOne) = odd.previewSaleUnlock(user);
        assertEq(unlockedDayOne, 2 ether);
        assertEq(lockedDayOne, 868 ether);

        vm.expectRevert();
        vm.prank(user);
        odd.transfer(receiver, 3 ether);

        vm.prank(user);
        odd.transfer(receiver, 2 ether);

        vm.warp(block.timestamp + 28 days);
        (uint256 unlockedFinal, uint256 lockedFinal) = odd.previewSaleUnlock(user);
        assertEq(unlockedFinal, 870 ether);
        assertEq(lockedFinal, 0);
        vm.prank(user);
        odd.transfer(receiver, 868 ether);
        assertEq(odd.balanceOf(receiver), 870 ether);
    }

    function testMatrixRewardUnlockIsLinearAfterLaunch() public {
        rewards.distributeReward(odd, user, 180 ether);
        vm.prank(admin);
        odd.markDexPoolLaunched(uint64(block.timestamp));
        uint256 launchTime = odd.poolLaunchTime();

        vm.warp(launchTime + 90 days);
        (uint256 unlockedHalf, uint256 lockedHalf) = odd.previewRewardUnlock(user);
        assertEq(unlockedHalf, 90 ether);
        assertEq(lockedHalf, 90 ether);

        vm.warp(launchTime + 180 days);
        (uint256 unlockedFinal, uint256 lockedFinal) = odd.previewRewardUnlock(user);
        assertEq(unlockedFinal, 180 ether);
        assertEq(lockedFinal, 0);
    }

    function testMatrixBusinessProfitSwapAllowanceIsPoolScopedAndSingleUse() public {
        vm.startPrank(admin);
        odd.setDexRestrictedTarget(router, true);
        odd.setDexRestrictedTarget(expectedPool, true);
        odd.transfer(address(business), 10 ether);
        vm.stopPrank();

        business.profitForSwap(odd, user, 2, keccak256("swap"), 10 ether, router, expectedPool);
        business.approveOdd(odd, router, 10 ether);

        vm.prank(router);
        odd.transferFrom(address(business), expectedPool, 10 ether);

        assertEq(odd.balanceOf(expectedPool), 10 ether);
        assertEq(odd.businessProfitSwapAllowance(address(business), router, expectedPool), 0);

        vm.expectRevert();
        vm.prank(router);
        odd.transferFrom(address(business), expectedPool, 1);
    }

    function _consumeSaleInBusiness(uint256 amount, bytes32 rawId) internal returns (bytes32 businessId) {
        tierSale.distributeSale(odd, user, amount);
        vm.prank(user);
        odd.approve(address(business), amount);
        businessId = business.consume(odd, user, 1, rawId, amount);
    }

    function _proxy(address implementation, bytes memory initData) internal returns (address) {
        return address(new ERC1967Proxy(implementation, initData));
    }
}
