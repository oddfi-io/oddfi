// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {ODDToken} from "../src/modules/token/ODDToken.sol";
import {IODDTokenBusiness} from "../src/modules/token/interfaces/IODDTokenBusiness.sol";
import {OddMvpBusinessHarness, OddMvpSourceHarness} from "./helpers/OddMvpTokenHarnesses.sol";

contract ODDTokenSourcesFuzzTest is Test {
    address internal admin = address(0xA11CE);
    address internal pauser = address(0xCAFE);
    address internal user = address(0x1001);

    ODDToken internal odd;
    OddMvpSourceHarness internal tierSale;
    OddMvpSourceHarness internal houseVault;
    OddMvpSourceHarness internal dexLaunch;
    OddMvpSourceHarness internal rewards;
    OddMvpBusinessHarness internal business;

    function setUp() public {
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

    function testFuzzBusinessOutcomeKeepsSaleSourceAccounting(uint96 saleSeed, uint96 inflowSeed, uint96 outSeed)
        public
    {
        uint256 saleAmount = bound(uint256(saleSeed), 1 ether, 100_000 ether);
        uint256 businessIn = bound(uint256(inflowSeed), 1, saleAmount);
        uint256 businessOut = bound(uint256(outSeed), 0, businessIn * 2);

        tierSale.distributeSale(odd, user, saleAmount);
        vm.prank(user);
        odd.approve(address(business), businessIn);

        bytes32 rawId = keccak256(abi.encode(saleSeed, inflowSeed, outSeed));
        bytes32 businessId = business.consume(odd, user, 900, rawId, businessIn);
        if (businessOut > businessIn) {
            vm.prank(admin);
            odd.transfer(address(business), businessOut - businessIn);
        }

        business.outcome(odd, user, businessId, businessOut, true);

        uint256 principalReturned = businessOut < businessIn ? businessOut : businessIn;
        uint256 expectedProfit = businessOut > businessIn ? businessOut - businessIn : 0;
        uint256 expectedLoss = businessIn - principalReturned;
        uint256 expectedLocked = saleAmount - expectedLoss;

        IODDTokenBusiness.BusinessSnapshot memory snapshot = odd.businessSnapshotOf(businessId);
        assertTrue(snapshot.finalized);
        assertEq(snapshot.businessIn, businessIn);
        assertEq(snapshot.totalBusinessOut, businessOut);
        assertEq(snapshot.principalReturned, principalReturned);
        assertEq(snapshot.profitRecognized, expectedProfit);
        assertEq(snapshot.lossRecognized, expectedLoss);
        assertEq(odd.balanceOf(user), saleAmount - businessIn + businessOut);
        assertEq(odd.lockedBalanceOf(user), expectedLocked);
        assertEq(odd.transferableBalanceOf(user), expectedProfit);
    }

    function testFuzzBusinessProfitIsImmediatelyTransferable(uint96 amountSeed) public {
        uint256 amount = bound(uint256(amountSeed), 1, 100_000 ether);

        vm.prank(admin);
        odd.transfer(address(business), amount);

        business.profit(odd, user, 901, keccak256(abi.encode(amount)), amount);

        assertEq(odd.balanceOf(user), amount);
        assertEq(odd.lockedBalanceOf(user), 0);
        assertEq(odd.transferableBalanceOf(user), amount);
    }

    function testFuzzBurnConsumesLockedSources(uint96 saleSeed, uint96 rewardSeed, uint96 burnSeed) public {
        uint256 saleAmount = bound(uint256(saleSeed), 1 ether, 100_000 ether);
        uint256 rewardAmount = bound(uint256(rewardSeed), 1 ether, 100_000 ether);
        uint256 burnAmount = bound(uint256(burnSeed), 1, saleAmount + rewardAmount);

        tierSale.distributeSale(odd, user, saleAmount);
        rewards.distributeReward(odd, user, rewardAmount);

        vm.prank(user);
        odd.burn(burnAmount);

        assertEq(odd.balanceOf(user), saleAmount + rewardAmount - burnAmount);
        assertEq(odd.lockedBalanceOf(user), saleAmount + rewardAmount - burnAmount);
        assertEq(odd.transferableBalanceOf(user), 0);
    }

    function _proxy(address implementation, bytes memory initData) internal returns (address) {
        return address(new ERC1967Proxy(implementation, initData));
    }
}
