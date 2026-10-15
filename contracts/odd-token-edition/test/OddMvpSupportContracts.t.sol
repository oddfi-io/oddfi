// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {ODDToken} from "../src/modules/token/ODDToken.sol";
import {TierSale} from "../src/modules/token/TierSale.sol";
import {EcosystemRewards} from "../src/modules/token/EcosystemRewards.sol";
import {HouseVault} from "../src/modules/token/HouseVault.sol";
import {DexLaunchController, IPancakeV3PositionManagerMintLike} from "../src/modules/token/DexLaunchController.sol";
import {DexLpLocker} from "../src/modules/token/DexLpLocker.sol";
import {IODDTokenBusiness} from "../src/modules/token/interfaces/IODDTokenBusiness.sol";
import {BettingPool} from "../src/modules/betting/BettingPool.sol";
import {Roles} from "../src/shared/access/Roles.sol";

contract MockERC20 is ERC20 {
    uint8 internal immutable TOKEN_DECIMALS;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        TOKEN_DECIMALS = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return TOKEN_DECIMALS;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockV3Pool {}

contract MockPositionManager is ERC721 {
    using SafeERC20 for IERC20;

    address public immutable pool;
    uint256 public nextTokenId = 1;

    constructor() ERC721("Mock V3 Position", "MV3P") {
        pool = address(new MockV3Pool());
    }

    function createAndInitializePoolIfNecessary(address, address, uint24, uint160) external view returns (address) {
        return pool;
    }

    function mint(IPancakeV3PositionManagerMintLike.MintParams calldata params)
        external
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        IERC20(params.token0).safeTransferFrom(msg.sender, pool, params.amount0Desired);
        IERC20(params.token1).safeTransferFrom(msg.sender, pool, params.amount1Desired);
        tokenId = nextTokenId++;
        liquidity = uint128((params.amount0Desired + params.amount1Desired) / 1e12);
        amount0 = params.amount0Desired;
        amount1 = params.amount1Desired;
        _safeMint(params.recipient, tokenId);
    }
}

contract SupportBusinessMock {}

contract OddMvpSupportContractsTest is Test {
    address internal admin = address(0xA11CE);
    address internal pauser = address(0xCAFE);
    address internal user = address(0x1001);
    address internal user2 = address(0x1002);
    address internal opsTreasury = address(0xBEEF);

    ODDToken internal odd;
    MockERC20 internal usdt;
    TierSale internal tierSale;
    HouseVault internal houseVault;
    DexLaunchController internal dexLaunch;
    DexLpLocker internal lpLocker;
    EcosystemRewards internal rewards;
    BettingPool internal betting;
    MockPositionManager internal positionManager;
    SupportBusinessMock internal business;

    function setUp() public {
        odd = ODDToken(_proxy(address(new ODDToken()), abi.encodeCall(ODDToken.initialize, (admin, pauser))));
        usdt = new MockERC20("Mock USDT", "USDT", 6);
        positionManager = new MockPositionManager();
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
        betting = BettingPool(
            _proxy(
                address(new BettingPool()),
                abi.encodeCall(BettingPool.initialize, (admin, address(odd), address(0x5001), address(0x5002)))
            )
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
        business = new SupportBusinessMock();

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
        odd.allocateInitialSupply();
        odd.grantRole(Roles.WHITELIST_ADMIN_ROLE, address(dexLaunch));
        odd.grantRole(Roles.DEX_LAUNCHER_ROLE, address(dexLaunch));
        lpLocker.grantRole(Roles.DEX_LAUNCHER_ROLE, address(dexLaunch));
        vm.stopPrank();
    }

    function testTierSaleCrossTierBuyAndCancelRefundReclaimsSaleSource() public {
        usdt.mint(user, 50_000e6);

        vm.prank(admin);
        tierSale.startSale();

        vm.prank(user);
        usdt.approve(address(tierSale), type(uint256).max);
        vm.prank(user);
        (uint256 purchaseId, uint256 usdtPaid) = tierSale.buy(3_500_000 ether);

        assertEq(purchaseId, 1);
        assertEq(usdtPaid, 40_000e6);
        assertEq(usdt.balanceOf(address(tierSale)), 40_000e6);
        assertEq(odd.balanceOf(user), 3_500_000 ether);
        assertEq(odd.lockedBalanceOf(user), 3_500_000 ether);

        vm.prank(admin);
        tierSale.cancelSale();

        vm.prank(user);
        odd.approve(address(tierSale), 3_500_000 ether);
        vm.prank(user);
        uint256 refundedUsdt = tierSale.refundPurchase(purchaseId, 3_500_000 ether);

        assertEq(refundedUsdt, 40_000e6);
        assertEq(usdt.balanceOf(user), 50_000e6);
        assertEq(odd.balanceOf(user), 0);
        assertEq(odd.lockedBalanceOf(user), 0);
        assertEq(tierSale.totalOddRefunded(), 3_500_000 ether);
    }

    function testEcosystemRewardClaimRegistersRewardSource() public {
        vm.startPrank(admin);
        rewards.setCategoryBudget(1, 1_000 ether);
        uint256 claimId = rewards.createClaimable(user, 1, 100 ether);
        vm.stopPrank();

        vm.prank(user);
        rewards.claim(claimId);

        assertEq(odd.balanceOf(user), 100 ether);
        assertEq(odd.lockedBalanceOf(user), 100 ether);
        (uint256 unlockedAmount, uint256 lockedAmount) = odd.previewRewardUnlock(user);
        assertEq(unlockedAmount, 0);
        assertEq(lockedAmount, 100 ether);
        assertEq(rewards.claimableOf(user), 0);
    }

    function testEcosystemRewardsCannotExceedTotalAllocation() public {
        vm.startPrank(admin);
        rewards.setCategoryBudget(1, 15_000_000 ether);

        vm.expectRevert();
        rewards.setCategoryBudget(2, 1);

        rewards.createClaimable(user, 1, 15_000_000 ether);

        vm.expectRevert();
        rewards.createClaimable(user2, 1, 1);
        vm.stopPrank();
    }

    function testHouseVaultOnlyTransfersToWhitelistOrTreasurySink() public {
        vm.startPrank(admin);
        odd.setWhitelist(address(business), true);
        odd.setDexRestrictedTarget(user2, true);
        vm.stopPrank();

        vm.prank(admin);
        houseVault.transferOdd(address(business), 100 ether);
        assertEq(odd.balanceOf(address(business)), 100 ether);

        vm.prank(admin);
        houseVault.transferOdd(opsTreasury, 50 ether);
        assertEq(odd.balanceOf(opsTreasury), 20_000_050 ether);

        vm.expectRevert();
        vm.prank(admin);
        houseVault.transferOdd(user, 1 ether);

        vm.expectRevert();
        vm.prank(admin);
        houseVault.transferOdd(user2, 1 ether);
    }

    function testHouseVaultFundsBettingPlatformReserveAsL4() public {
        vm.prank(admin);
        odd.setWhitelist(address(betting), true);

        vm.prank(admin);
        houseVault.transferOdd(address(betting), 1 ether);

        assertEq(odd.balanceOf(address(betting)), 1 ether);
        assertEq(betting.platformReserve(), 0);
        assertEq(betting.accountedBalance(), 0);

        vm.prank(opsTreasury);
        odd.transfer(user, 10 ether);
        vm.startPrank(user);
        odd.approve(address(betting), 10 ether);
        vm.expectRevert();
        betting.addPlatformReserve(10 ether);
        vm.stopPrank();

        vm.prank(admin);
        houseVault.fundBettingPlatformReserve(address(betting), 100 ether);

        assertEq(odd.balanceOf(address(betting)), 101 ether);
        assertEq(betting.platformReserve(), 100 ether);
        assertEq(betting.accountedBalance(), 100 ether);
        assertEq(odd.allowance(address(houseVault), address(betting)), 0);
    }

    function testDexLaunchUsesPositionManagerAllowanceAndMarksPoolLaunch() public {
        usdt.mint(user, 20e6);

        vm.prank(admin);
        tierSale.startSale();
        vm.prank(user);
        usdt.approve(address(tierSale), type(uint256).max);
        vm.prank(user);
        tierSale.buy(1_000 ether);

        vm.startPrank(admin);
        tierSale.forceFinalize(10e6, 1_000 ether);
        tierSale.approveLaunch(address(dexLaunch), 10e6, 1_000 ether);
        dexLaunch.setLaunchConfig(2_500, -60, 60, uint160(1 << 96), 365 days);
        vm.stopPrank();

        vm.prank(admin);
        (address pool, uint256 tokenId,, uint256 oddUsed, uint256 usdtUsed) =
            dexLaunch.launch(1_000 ether, 10e6, 0, 0, block.timestamp + 1 hours);

        assertEq(pool, positionManager.pool());
        assertEq(tokenId, 1);
        assertEq(oddUsed, 1_000 ether);
        assertEq(usdtUsed, 10e6);
        assertEq(odd.poolLaunchTime(), block.timestamp);
        assertEq(odd.balanceOf(pool), 1_000 ether);
        assertEq(usdt.balanceOf(pool), 10e6);
        assertEq(odd.dexLiquidityTransferableAllocation(), 10_000_000 ether - 1_000 ether);
        assertTrue(odd.isDexRestrictedTarget(address(positionManager)));
        assertTrue(odd.isDexRestrictedTarget(pool));
        assertEq(positionManager.ownerOf(tokenId), address(lpLocker));

        (address beneficiary,, uint64 unlockAt, bool released) = lpLocker.lockedPositions(tokenId);
        assertEq(beneficiary, opsTreasury);
        assertEq(unlockAt, block.timestamp + 365 days);
        assertFalse(released);

        vm.expectRevert();
        vm.prank(admin);
        lpLocker.releasePosition(tokenId, opsTreasury);

        vm.warp(unlockAt);
        vm.prank(admin);
        lpLocker.releasePosition(tokenId, opsTreasury);

        assertEq(positionManager.ownerOf(tokenId), opsTreasury);
    }

    function testDexLaunchRequiresExactApprovedAmounts() public {
        usdt.mint(user, 20e6);

        vm.prank(admin);
        tierSale.startSale();
        vm.prank(user);
        usdt.approve(address(tierSale), type(uint256).max);
        vm.prank(user);
        tierSale.buy(1_000 ether);

        vm.startPrank(admin);
        tierSale.forceFinalize(10e6, 1_000 ether);
        tierSale.approveLaunch(address(dexLaunch), 10e6, 1_000 ether);
        dexLaunch.setLaunchConfig(2_500, -60, 60, uint160(1 << 96), 365 days);

        vm.expectRevert();
        dexLaunch.launch(999 ether, 10e6, 0, 0, block.timestamp + 1 hours);

        vm.expectRevert();
        dexLaunch.launch(1_000 ether, 9e6, 0, 0, block.timestamp + 1 hours);
        vm.stopPrank();
    }

    function testDexLaunchSweepRemainderOnlyToTreasurySink() public {
        _launchPool();
        usdt.mint(address(dexLaunch), 10e6);

        vm.expectRevert();
        vm.prank(admin);
        dexLaunch.sweepRemainder(address(usdt), user, 1e6);

        vm.prank(admin);
        dexLaunch.sweepRemainder(address(usdt), opsTreasury, 1e6);

        assertEq(usdt.balanceOf(opsTreasury), 1e6);
    }

    function testDexLpLockerOnlyReleasesToBeneficiary() public {
        uint256 tokenId = _launchPool();
        (,, uint64 unlockAt,) = lpLocker.lockedPositions(tokenId);
        vm.warp(unlockAt);

        vm.expectRevert();
        vm.prank(admin);
        lpLocker.releasePosition(tokenId, user);

        vm.prank(admin);
        lpLocker.releasePosition(tokenId, opsTreasury);

        assertEq(positionManager.ownerOf(tokenId), opsTreasury);
    }

    function _proxy(address implementation, bytes memory initData) internal returns (address) {
        return address(new ERC1967Proxy(implementation, initData));
    }

    function _launchPool() internal returns (uint256 tokenId) {
        usdt.mint(user, 20e6);

        vm.prank(admin);
        tierSale.startSale();
        vm.prank(user);
        usdt.approve(address(tierSale), type(uint256).max);
        vm.prank(user);
        tierSale.buy(1_000 ether);

        vm.startPrank(admin);
        tierSale.forceFinalize(10e6, 1_000 ether);
        tierSale.approveLaunch(address(dexLaunch), 10e6, 1_000 ether);
        dexLaunch.setLaunchConfig(2_500, -60, 60, uint160(1 << 96), 365 days);
        (, tokenId,,,) = dexLaunch.launch(1_000 ether, 10e6, 0, 0, block.timestamp + 1 hours);
        vm.stopPrank();
    }
}
