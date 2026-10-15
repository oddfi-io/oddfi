// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./helpers/BettingPoolTestBase.sol";

contract BettingPoolAdminTest is BettingPoolTestBase {
    function setUp() public override {
        super.setUp();
    }

    // ── setAdmin ──────────────────────────────────────────────────────────────

    function test_setAdmin_success() public {
        vm.prank(multisig);
        pool.setAdmin(user1);
        assertEq(pool.admin(), user1);
    }

    function test_setAdmin_emitsEvent() public {
        vm.expectEmit(true, true, false, false);
        emit IBettingPool.AdminUpdated(admin, user1);
        vm.prank(multisig);
        pool.setAdmin(user1);
    }

    function test_setAdmin_zeroAddress_reverts() public {
        vm.prank(multisig);
        vm.expectRevert(InvalidAddress.selector);
        pool.setAdmin(address(0));
    }

    function test_setAdmin_thenOldAdminFails() public {
        vm.prank(multisig);
        pool.setAdmin(user1);

        // old admin can no longer open markets
        vm.prank(admin);
        vm.expectRevert(Unauthorized.selector);
        pool.openMarket(MATCH_A, MarketType.X12, 0);
    }

    function test_setAdmin_newAdminWorks() public {
        vm.prank(multisig);
        pool.setAdmin(user1);

        vm.prank(user1);
        pool.openMarket(MATCH_A, MarketType.X12, 0);
        bytes32 key = keccak256(abi.encode(MATCH_A, MarketType.X12, uint8(0)));
        assertEq(uint8(pool.marketStatus(key)), uint8(MarketStatus.Open));
    }

    // ── setRedLightThreshold ──────────────────────────────────────────────────

    function test_setRedLightThreshold_success() public {
        vm.prank(multisig);
        pool.setRedLightThreshold(10_000e6);
        assertEq(pool.redLightThreshold(), 10_000e6);
    }

    function test_setRedLightThreshold_emitsEvent() public {
        uint256 oldThreshold = pool.redLightThreshold();
        vm.expectEmit(false, false, false, true);
        emit IBettingPool.RedLightThresholdUpdated(oldThreshold, 10_000e6);
        vm.prank(multisig);
        pool.setRedLightThreshold(10_000e6);
    }

    function test_setRedLightThreshold_zero_allowed() public {
        vm.prank(multisig);
        pool.setRedLightThreshold(0);
        assertEq(pool.redLightThreshold(), 0);
    }

    // ── setMaxMarketsPerMatch ─────────────────────────────────────────────────

    function test_setMaxMarketsPerMatch_success() public {
        vm.prank(multisig);
        pool.setMaxMarketsPerMatch(5);
        assertEq(pool.maxMarketsPerMatch(), 5);
    }

    function test_setMaxMarketsPerMatch_emitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit IBettingPool.MaxMarketsPerMatchUpdated(5);
        vm.prank(multisig);
        pool.setMaxMarketsPerMatch(5);
    }

    // ── setLpShareBps ─────────────────────────────────────────────────────────

    function test_setLpShareBps_success() public {
        vm.prank(multisig);
        pool.setLpShareBps(8000);
        assertEq(pool.lpShareBps(), 8000);
    }

    function test_setLpShareBps_emitsEvent() public {
        uint256 oldBps = pool.lpShareBps();
        vm.expectEmit(false, false, false, true);
        emit IBettingPool.LpShareBpsUpdated(oldBps, 8000);
        vm.prank(multisig);
        pool.setLpShareBps(8000);
    }

    function test_setLpShareBps_minBound_5000_succeeds() public {
        vm.prank(multisig);
        pool.setLpShareBps(5000);
        assertEq(pool.lpShareBps(), 5000);
    }

    function test_setLpShareBps_maxBound_9000_succeeds() public {
        vm.prank(multisig);
        pool.setLpShareBps(9000);
        assertEq(pool.lpShareBps(), 9000);
    }

    function test_setLpShareBps_belowMin_reverts() public {
        vm.prank(multisig);
        vm.expectRevert(InvalidLpShareBps.selector);
        pool.setLpShareBps(4999);
    }

    function test_setLpShareBps_aboveMax_reverts() public {
        vm.prank(multisig);
        vm.expectRevert(InvalidLpShareBps.selector);
        pool.setLpShareBps(9001);
    }

    // ── withdrawPlatform ──────────────────────────────────────────────────────

    function test_withdrawPlatform_success() public {
        // Generate platform balance via losing bet
        _addLiquidity(lp1, 100_000e6);
        _openMarket(MATCH_A, MarketType.X12, 0);
        _deposit(user1, 10_000e6);
        _lockBet(keccak256("bet1"), user1, 1_000e6, MATCH_A, MarketType.X12, 0, 0, 1500);
        _closeMarket(MATCH_A, MarketType.X12, 0);

        bytes32[] memory ids = new bytes32[](1);
        ids[0] = keccak256("bet1");
        _settle(MATCH_A, MarketType.X12, 0, 1, ids); // user loses

        uint256 platBalance = pool.platformBalance();
        assertGt(platBalance, 0);

        uint256 balBefore = usdt.balanceOf(user2);
        vm.prank(multisig);
        pool.withdrawPlatform(user2, platBalance);

        assertEq(usdt.balanceOf(user2), balBefore + platBalance);
        assertEq(pool.platformBalance(), 0);
    }

    function test_withdrawPlatform_emitsEvent() public {
        // Simulate platform balance
        _addLiquidity(lp1, 100_000e6);
        _openMarket(MATCH_A, MarketType.X12, 0);
        _deposit(user1, 10_000e6);
        _lockBet(keccak256("bet1"), user1, 1_000e6, MATCH_A, MarketType.X12, 0, 0, 1500);
        _closeMarket(MATCH_A, MarketType.X12, 0);

        bytes32[] memory ids = new bytes32[](1);
        ids[0] = keccak256("bet1");
        _settle(MATCH_A, MarketType.X12, 0, 1, ids);

        uint256 platBalance = pool.platformBalance();
        vm.expectEmit(true, false, false, true);
        emit IBettingPool.PlatformWithdrawn(user2, platBalance);
        vm.prank(multisig);
        pool.withdrawPlatform(user2, platBalance);
    }

    function test_withdrawPlatform_zeroAddress_reverts() public {
        vm.prank(multisig);
        vm.expectRevert(InvalidAddress.selector);
        pool.withdrawPlatform(address(0), 0);
    }

    function test_withdrawPlatform_exceedsBalance_reverts() public {
        vm.prank(multisig);
        vm.expectRevert("exceeds platform balance");
        pool.withdrawPlatform(user1, 1e6);
    }

    // ── pause / unpause ───────────────────────────────────────────────────────

    function test_pause_blocksDeposit() public {
        vm.prank(multisig);
        pool.pause();

        usdt.mint(address(pool), 100e6);
        vm.prank(admin);
        vm.expectRevert();
        pool.creditDeposit(user1, 100e6, keccak256("h1"));
    }

    function test_unpause_restoresFunction() public {
        vm.prank(multisig);
        pool.pause();
        vm.prank(multisig);
        pool.unpause();

        _deposit(user1, 100e6);
        assertEq(pool.userBalances(user1), 100e6);
    }

    // ── initialize guards ─────────────────────────────────────────────────────

    function test_initialize_zeroUsdt_reverts() public {
        BettingPool impl = new BettingPool();
        bytes memory initData = abi.encodeCall(BettingPool.initialize, (address(0), admin, multisig));
        vm.expectRevert(InvalidAddress.selector);
        new ERC1967Proxy(address(impl), initData);
    }

    function test_initialize_zeroAdmin_reverts() public {
        BettingPool impl = new BettingPool();
        bytes memory initData = abi.encodeCall(BettingPool.initialize, (address(usdt), address(0), multisig));
        vm.expectRevert(InvalidAddress.selector);
        new ERC1967Proxy(address(impl), initData);
    }

    function test_initialize_zeroMultisig_reverts() public {
        BettingPool impl = new BettingPool();
        bytes memory initData = abi.encodeCall(BettingPool.initialize, (address(usdt), admin, address(0)));
        vm.expectRevert(InvalidAddress.selector);
        new ERC1967Proxy(address(impl), initData);
    }

    function test_initialize_defaultParams() public view {
        assertEq(pool.redLightThreshold(), 28_000e6);
        assertEq(pool.lpShareBps(), 7000);
        assertEq(pool.maxMarketsPerMatch(), 9);
    }

    function test_initialize_cannotReinitialize() public {
        vm.expectRevert();
        pool.initialize(address(usdt), admin, multisig);
    }

    // ── UUPS upgrade auth ─────────────────────────────────────────────────────

    function test_upgradeToAndCall_nonMultisig_reverts() public {
        BettingPool newImpl = new BettingPool();
        vm.prank(user1);
        vm.expectRevert(Unauthorized.selector);
        pool.upgradeToAndCall(address(newImpl), "");
    }

    function test_upgradeToAndCall_byMultisig_succeeds() public {
        BettingPool newImpl = new BettingPool();
        vm.prank(multisig);
        pool.upgradeToAndCall(address(newImpl), "");
        // Proxy still functional
        assertEq(pool.admin(), admin);
    }
}
