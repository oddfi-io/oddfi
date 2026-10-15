// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {ODDToken} from "../src/modules/token/ODDToken.sol";
import {TierSale} from "../src/modules/token/TierSale.sol";
import {HouseVault} from "../src/modules/token/HouseVault.sol";
import {EcosystemRewards} from "../src/modules/token/EcosystemRewards.sol";
import {DexLaunchController} from "../src/modules/token/DexLaunchController.sol";
import {DexLpLocker} from "../src/modules/token/DexLpLocker.sol";
import {IODDTokenBusiness} from "../src/modules/token/interfaces/IODDTokenBusiness.sol";
import {Roles} from "../src/shared/access/Roles.sol";
import {
    OddMvpBusinessHarness,
    OddMvpHarnessERC20,
    OddMvpHarnessPositionManager
} from "./helpers/OddMvpTokenHarnesses.sol";

contract OddMvpE2ETest is Test {
    address internal admin = address(0xA11CE);
    address internal pauser = address(0xCAFE);
    address internal user = address(0x1001);
    address internal receiver = address(0x1002);
    address internal opsTreasury = address(0xBEEF);

    ODDToken internal odd;
    OddMvpHarnessERC20 internal usdt;
    OddMvpHarnessPositionManager internal positionManager;
    DexLpLocker internal lpLocker;
    TierSale internal tierSale;
    HouseVault internal houseVault;
    EcosystemRewards internal rewards;
    DexLaunchController internal dexLaunch;
    OddMvpBusinessHarness internal business;

    function setUp() public {
        vm.warp(1_000_000);

        odd = ODDToken(_proxy(address(new ODDToken()), abi.encodeCall(ODDToken.initialize, (admin, pauser))));
        usdt = new OddMvpHarnessERC20("Harness USDT", "USDT", 6);
        positionManager = new OddMvpHarnessPositionManager();
        lpLocker = DexLpLocker(
            _proxy(
                address(new DexLpLocker()),
                abi.encodeCall(DexLpLocker.initialize, (admin, address(positionManager), opsTreasury))
            )
        );
        tierSale = TierSale(
            _proxy(address(new TierSale()), abi.encodeCall(TierSale.initialize, (admin, address(odd), address(usdt))))
        );
        houseVault =
            HouseVault(_proxy(address(new HouseVault()), abi.encodeCall(HouseVault.initialize, (admin, address(odd)))));
        rewards = EcosystemRewards(
            _proxy(address(new EcosystemRewards()), abi.encodeCall(EcosystemRewards.initialize, (admin, address(odd))))
        );
        dexLaunch = DexLaunchController(
            _proxy(
                address(new DexLaunchController()),
                abi.encodeCall(
                    DexLaunchController.initialize,
                    (
                        admin,
                        address(odd),
                        address(usdt),
                        address(tierSale),
                        address(positionManager),
                        address(lpLocker),
                        opsTreasury
                    )
                )
            )
        );
        business = new OddMvpBusinessHarness();

        vm.startPrank(admin);
        odd.setTreasurySink(opsTreasury, true);
        odd.setFixedSourceContracts(
            IODDTokenBusiness.FixedSources({
                tierSale: address(tierSale),
                houseVault: address(houseVault),
                dexLaunchController: address(dexLaunch),
                ecosystemRewards: address(rewards),
                opsTreasury: opsTreasury
            })
        );
        odd.setWhitelist(address(business), true);
        odd.allocateInitialSupply();
        odd.grantRole(Roles.WHITELIST_ADMIN_ROLE, address(dexLaunch));
        odd.grantRole(Roles.DEX_LAUNCHER_ROLE, address(dexLaunch));
        lpLocker.grantRole(Roles.DEX_LAUNCHER_ROLE, address(dexLaunch));
        tierSale.startSale();
        vm.stopPrank();
    }

    function testSaleLaunchBusinessProfitAndLpLockEndToEnd() public {
        usdt.mint(user, 1_000e6);

        vm.prank(user);
        usdt.approve(address(tierSale), type(uint256).max);
        vm.prank(user);
        tierSale.buy(10_000 ether);

        vm.startPrank(admin);
        tierSale.forceFinalize(50e6, 5_000 ether);
        tierSale.approveLaunch(address(dexLaunch), 50e6, 5_000 ether);
        dexLaunch.setLaunchConfig(2_500, -60, 60, uint160(1 << 96), 365 days);
        vm.stopPrank();

        vm.prank(admin);
        (address pool, uint256 tokenId,, uint256 oddUsed, uint256 usdtUsed) =
            dexLaunch.launch(5_000 ether, 50e6, 0, 0, block.timestamp + 1 hours);

        assertEq(pool, positionManager.pool());
        assertEq(tokenId, 1);
        assertEq(oddUsed, 5_000 ether);
        assertEq(usdtUsed, 50e6);
        assertEq(odd.poolLaunchTime(), block.timestamp);
        assertEq(odd.balanceOf(pool), 5_000 ether);
        assertTrue(odd.isDexRestrictedTarget(address(positionManager)));
        assertTrue(odd.isDexRestrictedTarget(pool));

        (address beneficiary,, uint64 unlockAt, bool released) = lpLocker.lockedPositions(tokenId);
        assertEq(beneficiary, opsTreasury);
        assertGt(unlockAt, block.timestamp);
        assertFalse(released);

        vm.prank(user);
        odd.approve(address(business), 500 ether);
        bytes32 businessId = business.consume(odd, user, 1000, keccak256("e2e-business"), 500 ether);

        vm.prank(admin);
        houseVault.transferOdd(address(business), 25 ether);
        business.outcome(odd, user, businessId, 525 ether, true);

        IODDTokenBusiness.BusinessSnapshot memory snapshot = odd.businessSnapshotOf(businessId);
        assertTrue(snapshot.finalized);
        assertEq(snapshot.businessIn, 500 ether);
        assertEq(snapshot.principalReturned, 500 ether);
        assertEq(snapshot.profitRecognized, 25 ether);
        assertEq(snapshot.lossRecognized, 0);
        assertGe(odd.transferableBalanceOf(user), 25 ether);

        vm.prank(user);
        odd.transfer(receiver, 25 ether);
        assertEq(odd.balanceOf(receiver), 25 ether);
    }

    function _proxy(address implementation, bytes memory initData) internal returns (address) {
        return address(new ERC1967Proxy(implementation, initData));
    }
}
