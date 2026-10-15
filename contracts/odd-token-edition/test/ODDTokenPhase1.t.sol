// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {ODDToken} from "../src/modules/token/ODDToken.sol";
import {IODDTokenBusiness} from "../src/modules/token/interfaces/IODDTokenBusiness.sol";
import {Roles} from "../src/shared/access/Roles.sol";
import {TokenConstants} from "../src/shared/constants/TokenConstants.sol";

contract ODDTokenCallerMock {
    function distributeSale(ODDToken token, address user, uint256 amount) external {
        token.distributeSalePurchase(user, amount);
    }

    function distributeReward(ODDToken token, address user, uint256 amount) external {
        token.distributeRewardClaim(user, amount);
    }

    function consumeInflow(ODDToken token, address user, uint16 businessType, bytes32 rawId, uint256 amount)
        external
        returns (bytes32)
    {
        return token.consumeBusinessInflow(user, businessType, rawId, amount);
    }

    function registerOutcome(ODDToken token, address user, bytes32 businessId, uint256 amount, bool finalized)
        external
    {
        token.registerBusinessOutcomeDelta(user, businessId, amount, finalized);
    }

    function registerProfitSwap(
        ODDToken token,
        address user,
        uint16 businessType,
        bytes32 rawId,
        uint256 amount,
        address spender,
        address target
    ) external returns (bytes32) {
        return token.registerBusinessProfitForDexSwap(user, businessType, rawId, amount, spender, target);
    }

    function approveToken(ODDToken token, address spender, uint256 amount) external {
        token.approve(spender, amount);
    }
}

contract ODDTokenPhase1Test is Test {
    address internal admin = address(0xA11CE);
    address internal pauser = address(0xCAFE);
    address internal user = address(0x1001);
    address internal user2 = address(0x1002);
    address internal opsTreasury = address(0xBEEF);
    address internal router = address(0x3001);
    address internal v3Pool = address(0x3002);
    address internal positionManager = address(0x3003);

    ODDToken internal token;
    ODDTokenCallerMock internal tierSale;
    ODDTokenCallerMock internal houseVault;
    ODDTokenCallerMock internal dexLaunchController;
    ODDTokenCallerMock internal ecosystemRewards;
    ODDTokenCallerMock internal business;

    function setUp() public {
        token = _deployToken();
        tierSale = new ODDTokenCallerMock();
        houseVault = new ODDTokenCallerMock();
        dexLaunchController = new ODDTokenCallerMock();
        ecosystemRewards = new ODDTokenCallerMock();
        business = new ODDTokenCallerMock();
    }

    function testInitializeMintsToTokenAndGrantsRoles() public {
        assertEq(token.name(), "OddFi");
        assertEq(token.symbol(), "ODD");
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), TokenConstants.TOTAL_SUPPLY);
        assertEq(token.balanceOf(address(token)), TokenConstants.TOTAL_SUPPLY);
        assertEq(token.balanceOf(admin), 0);
        assertTrue(token.hasRole(Roles.DEFAULT_ADMIN_ROLE, admin));
        assertTrue(token.hasRole(Roles.WHITELIST_ADMIN_ROLE, admin));
        assertTrue(token.hasRole(Roles.DEX_LAUNCHER_ROLE, admin));
        assertTrue(token.hasRole(Roles.PAUSER_ROLE, pauser));

        vm.prank(pauser);
        token.pause();
        assertTrue(token.paused());
        vm.prank(pauser);
        token.unpause();
        assertFalse(token.paused());
    }

    function testAllocateInitialSupplyRequiresTreasurySinkAndRunsOnce() public {
        _setFixedSources();

        vm.expectRevert();
        vm.prank(admin);
        token.allocateInitialSupply();

        vm.prank(admin);
        token.setTreasurySink(opsTreasury, true);
        vm.prank(admin);
        token.allocateInitialSupply();

        assertEq(token.balanceOf(address(tierSale)), 30_000_000 ether);
        assertEq(token.balanceOf(address(houseVault)), 25_000_000 ether);
        assertEq(token.balanceOf(address(dexLaunchController)), 10_000_000 ether);
        assertEq(token.balanceOf(address(ecosystemRewards)), 15_000_000 ether);
        assertEq(token.balanceOf(opsTreasury), 20_000_000 ether);
        assertEq(token.dexLiquidityTransferableAllocation(), 10_000_000 ether);

        vm.expectRevert();
        vm.prank(admin);
        token.allocateInitialSupply();
    }

    function testWhitelistRejectsEOAAndDexRestrictedTargets() public {
        vm.expectRevert();
        vm.prank(admin);
        token.setWhitelist(user, true);

        vm.prank(admin);
        token.setDexRestrictedTarget(router, true);
        vm.expectRevert();
        vm.prank(admin);
        token.setWhitelist(router, true);

        vm.prank(admin);
        token.setWhitelist(address(business), true);
        assertTrue(token.whitelist(address(business)));
    }

    function testSaleDistributionLocksThenUnlocksByLaunchCurve() public {
        _configureAndAllocate();

        tierSale.distributeSale(token, user, 870 ether);
        assertEq(token.balanceOf(user), 870 ether);
        assertEq(token.transferableBalanceOf(user), 0);
        vm.expectRevert();
        vm.prank(user);
        token.transfer(user2, 1);

        vm.prank(admin);
        token.markDexPoolLaunched(uint64(block.timestamp));
        assertEq(token.transferableBalanceOf(user), 2 ether);

        vm.prank(user);
        token.transfer(user2, 2 ether);
        assertEq(token.balanceOf(user2), 2 ether);

        vm.expectRevert();
        vm.prank(user);
        token.transfer(user2, 1);
    }

    function testBusinessOutcomeRestoresPrincipalAndLeavesProfitTransferable() public {
        _configureAndAllocate();
        _whitelistBusiness();

        tierSale.distributeSale(token, user, 100 ether);
        vm.prank(user);
        token.approve(address(business), 100 ether);

        bytes32 rawId = bytes32("bet-1");
        bytes32 businessId = business.consumeInflow(token, user, 1, rawId, 100 ether);
        assertEq(token.balanceOf(user), 0);
        assertEq(token.balanceOf(address(business)), 100 ether);

        vm.prank(opsTreasury);
        token.transfer(address(business), 50 ether);
        business.registerOutcome(token, user, businessId, 150 ether, true);

        assertEq(token.balanceOf(user), 150 ether);
        assertEq(token.transferableBalanceOf(user), 50 ether);
        IODDTokenBusiness.SourceBreakdown memory source = token.sourceBalanceOf(user);
        assertEq(source.saleLocked, 100 ether);

        IODDTokenBusiness.BusinessSnapshot memory snapshot = token.businessSnapshotOf(businessId);
        assertEq(snapshot.businessIn, 100 ether);
        assertEq(snapshot.totalBusinessOut, 150 ether);
        assertEq(snapshot.principalReturned, 100 ether);
        assertEq(snapshot.profitRecognized, 50 ether);
        assertEq(snapshot.lossRecognized, 0);
        assertTrue(snapshot.finalized);
    }

    function testZeroDeltaFinalizedConfirmsFullLoss() public {
        _configureAndAllocate();
        _whitelistBusiness();

        tierSale.distributeSale(token, user, 100 ether);
        vm.prank(user);
        token.approve(address(business), 100 ether);

        bytes32 businessId = business.consumeInflow(token, user, 1, bytes32("lost-bet"), 100 ether);
        business.registerOutcome(token, user, businessId, 0, true);

        assertEq(token.balanceOf(user), 0);
        assertEq(token.lockedBalanceOf(user), 0);
        assertEq(token.businessLossOf(businessId), 100 ether);

        IODDTokenBusiness.BusinessSnapshot memory snapshot = token.businessSnapshotOf(businessId);
        assertEq(snapshot.lossRecognized, 100 ether);
        assertTrue(snapshot.finalized);
    }

    function testDexLaunchAndBusinessProfitSwapUseOneTimeAllowances() public {
        _configureAndAllocate();
        _whitelistBusiness();

        vm.startPrank(admin);
        token.setDexRestrictedTarget(positionManager, true);
        token.setDexRestrictedTarget(router, true);
        token.setDexRestrictedTarget(v3Pool, true);
        token.setDexLaunchTransferTarget(positionManager, v3Pool);
        vm.stopPrank();

        dexLaunchController.approveToken(token, positionManager, 2_000 ether);
        vm.prank(positionManager);
        token.transferFrom(address(dexLaunchController), v3Pool, 1_000 ether);
        assertEq(token.balanceOf(v3Pool), 1_000 ether);
        assertEq(token.dexLiquidityTransferableAllocation(), 10_000_000 ether - 1_000 ether);

        vm.expectRevert();
        vm.prank(router);
        token.transferFrom(address(dexLaunchController), v3Pool, 1 ether);

        vm.prank(opsTreasury);
        token.transfer(address(business), 100 ether);
        business.registerProfitSwap(token, user, 4, bytes32("ref-swap"), 60 ether, router, v3Pool);
        business.approveToken(token, router, 100 ether);

        vm.prank(router);
        token.transferFrom(address(business), v3Pool, 60 ether);
        assertEq(token.businessProfitSwapAllowance(address(business), router, v3Pool), 0);

        vm.expectRevert();
        vm.prank(router);
        token.transferFrom(address(business), v3Pool, 1 ether);
    }

    function _deployToken() internal returns (ODDToken deployed) {
        deployed = ODDToken(
            address(new ERC1967Proxy(address(new ODDToken()), abi.encodeCall(ODDToken.initialize, (admin, pauser))))
        );
    }

    function _setFixedSources() internal {
        vm.prank(admin);
        token.setFixedSourceContracts(
            IODDTokenBusiness.FixedSources({
                tierSale: address(tierSale),
                houseVault: address(houseVault),
                dexLaunchController: address(dexLaunchController),
                ecosystemRewards: address(ecosystemRewards),
                opsTreasury: opsTreasury
            })
        );
    }

    function _configureAndAllocate() internal {
        _setFixedSources();
        vm.prank(admin);
        token.setTreasurySink(opsTreasury, true);
        vm.prank(admin);
        token.allocateInitialSupply();
    }

    function _whitelistBusiness() internal {
        vm.prank(admin);
        token.setWhitelist(address(business), true);
    }
}
