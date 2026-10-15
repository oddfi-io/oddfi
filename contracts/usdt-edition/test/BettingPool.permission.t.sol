// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./helpers/BettingPoolTestBase.sol";

/// @notice Permission / access-control tests.
contract BettingPoolPermissionTest is BettingPoolTestBase {
    bytes32 constant BET1 = keccak256("bet1");

    function setUp() public override {
        super.setUp();
        // add LP so lockBet calls have liquidity
        _addLiquidity(lp1, 100_000e6);
        _openMarket(MATCH_A, MarketType.X12, 0);
        _deposit(user1, 10_000e6);
    }

    // ── onlyAdmin functions ───────────────────────────────────────────────────

    function test_creditDeposit_nonAdmin_reverts() public {
        bytes32 h = keccak256("h1");
        usdt.mint(address(pool), 100e6);
        vm.prank(user1);
        vm.expectRevert(Unauthorized.selector);
        pool.creditDeposit(user1, 100e6, h);
    }

    function test_openMarket_nonAdmin_reverts() public {
        vm.prank(user1);
        vm.expectRevert(Unauthorized.selector);
        pool.openMarket(MATCH_B, MarketType.X12, 0);
    }

    function test_closeMarket_nonAdmin_reverts() public {
        vm.prank(user1);
        vm.expectRevert(Unauthorized.selector);
        pool.closeMarket(MATCH_A, MarketType.X12, 0);
    }

    function test_batchOpenMarkets_nonAdmin_reverts() public {
        MarketType[] memory mts = new MarketType[](1);
        mts[0] = MarketType.X12;
        uint8[] memory lines = new uint8[](1);
        lines[0] = 0;
        vm.prank(user1);
        vm.expectRevert(Unauthorized.selector);
        pool.batchOpenMarkets(MATCH_B, mts, lines);
    }

    function test_batchCloseMarkets_nonAdmin_reverts() public {
        MarketType[] memory mts = new MarketType[](1);
        mts[0] = MarketType.X12;
        uint8[] memory lines = new uint8[](1);
        lines[0] = 0;
        vm.prank(user1);
        vm.expectRevert(Unauthorized.selector);
        pool.batchCloseMarkets(MATCH_A, mts, lines);
    }

    function test_lockBet_nonAdmin_reverts() public {
        vm.prank(user1);
        vm.expectRevert(Unauthorized.selector);
        pool.lockBet(BET1, user1, 100e6, MATCH_A, MarketType.X12, 0, 0, 1818);
    }

    function test_lockCreditBet_nonAdmin_reverts() public {
        vm.prank(user1);
        vm.expectRevert(Unauthorized.selector);
        pool.lockCreditBet(BET1, bytes32(0), user1, 100e6, MATCH_A, MarketType.X12, 0, 0, 1818);
    }

    function test_lockParlay_nonAdmin_reverts() public {
        bytes32[] memory mIds = new bytes32[](2);
        MarketType[] memory mts = new MarketType[](2);
        uint8[] memory outs = new uint8[](2);
        uint8[] memory lns = new uint8[](2);
        uint256[] memory odds = new uint256[](2);
        bytes32[] memory legIds = new bytes32[](2);

        vm.prank(user1);
        vm.expectRevert(Unauthorized.selector);
        pool.lockParlay(bytes32(0), user1, 100e6, mIds, mts, outs, lns, odds, legIds);
    }

    function test_unlockBet_nonAdmin_reverts() public {
        bytes32[] memory empty;
        vm.prank(user1);
        vm.expectRevert(Unauthorized.selector);
        pool.unlockBet(BET1, empty);
    }

    function test_unlockParlay_nonAdmin_reverts() public {
        vm.prank(user1);
        vm.expectRevert(Unauthorized.selector);
        pool.unlockParlay(bytes32(0));
    }

    function test_updateSignal_nonAdmin_reverts() public {
        vm.prank(user1);
        vm.expectRevert(Unauthorized.selector);
        pool.updateSignal(MATCH_A, MarketType.X12, 0, 1000e6, 0, SignalColor.Red);
    }

    function test_rejectLargeWithdrawal_nonAdmin_reverts() public {
        // create a large withdrawal request first
        _deposit(user2, 10_000e6);
        vm.prank(user2);
        pool.withdraw(6_000e6);
        bytes32 reqId = keccak256(abi.encode(user2, 0));

        vm.prank(user1);
        vm.expectRevert(Unauthorized.selector);
        pool.rejectLargeWithdrawal(reqId);
    }

    function test_releaseOrForfeiture_nonAdmin_reverts() public {
        vm.prank(user1);
        vm.expectRevert(Unauthorized.selector);
        pool.releaseOrForfeiture(bytes32(0));
    }

    // ── onlyMultisig functions ────────────────────────────────────────────────

    function test_reopenMarket_nonMultisig_reverts() public {
        _closeMarket(MATCH_A, MarketType.X12, 0);
        vm.prank(user1);
        vm.expectRevert(Unauthorized.selector);
        pool.reopenMarket(MATCH_A, MarketType.X12, 0);
    }

    function test_settle_nonMultisig_reverts() public {
        bytes32[] memory ids;
        vm.prank(user1);
        vm.expectRevert(Unauthorized.selector);
        pool.settle(MATCH_A, MarketType.X12, 0, 0, ids);
    }

    function test_cancelMatch_nonMultisig_reverts() public {
        bytes32[] memory ids;
        vm.prank(user1);
        vm.expectRevert(Unauthorized.selector);
        pool.cancelMatch(MATCH_A, MarketType.X12, 0, ids);
    }

    function test_withdrawPlatform_nonMultisig_reverts() public {
        vm.prank(user1);
        vm.expectRevert(Unauthorized.selector);
        pool.withdrawPlatform(user1, 1e6);
    }

    function test_setAdmin_nonMultisig_reverts() public {
        vm.prank(user1);
        vm.expectRevert(Unauthorized.selector);
        pool.setAdmin(user1);
    }

    function test_setRedLightThreshold_nonMultisig_reverts() public {
        vm.prank(user1);
        vm.expectRevert(Unauthorized.selector);
        pool.setRedLightThreshold(10_000e6);
    }

    function test_setMaxMarketsPerMatch_nonMultisig_reverts() public {
        vm.prank(user1);
        vm.expectRevert(Unauthorized.selector);
        pool.setMaxMarketsPerMatch(5);
    }

    function test_setLpShareBps_nonMultisig_reverts() public {
        vm.prank(user1);
        vm.expectRevert(Unauthorized.selector);
        pool.setLpShareBps(7000);
    }

    function test_pause_nonMultisig_reverts() public {
        vm.prank(user1);
        vm.expectRevert(Unauthorized.selector);
        pool.pause();
    }

    function test_unpause_nonMultisig_reverts() public {
        vm.prank(multisig);
        pool.pause();
        vm.prank(user1);
        vm.expectRevert(Unauthorized.selector);
        pool.unpause();
    }

    // ── whenNotPaused functions ───────────────────────────────────────────────

    function test_creditDeposit_paused_reverts() public {
        vm.prank(multisig);
        pool.pause();

        bytes32 h = keccak256("h2");
        usdt.mint(address(pool), 100e6);
        vm.prank(admin);
        vm.expectRevert();
        pool.creditDeposit(user1, 100e6, h);
    }

    function test_withdraw_paused_reverts() public {
        vm.prank(multisig);
        pool.pause();

        vm.prank(user1);
        vm.expectRevert();
        pool.withdraw(100e6);
    }

    function test_lockBet_paused_reverts() public {
        vm.prank(multisig);
        pool.pause();

        vm.prank(admin);
        vm.expectRevert();
        pool.lockBet(BET1, user1, 100e6, MATCH_A, MarketType.X12, 0, 0, 1818);
    }

    function test_addLiquidity_paused_reverts() public {
        vm.prank(multisig);
        pool.pause();

        usdt.mint(lp1, 1_000e6);
        vm.startPrank(lp1);
        usdt.approve(address(pool), 1_000e6);
        vm.expectRevert();
        pool.addLiquidity(1_000e6);
        vm.stopPrank();
    }

    function test_removeLiquidity_paused_reverts() public {
        _addLiquidity(lp2, 10_000e6);
        uint256 shares = pool.lpShares(lp2);

        vm.prank(multisig);
        pool.pause();

        vm.prank(lp2);
        vm.expectRevert();
        pool.removeLiquidity(shares);
    }

    // ── pause / unpause access ────────────────────────────────────────────────

    function test_pause_by_multisig_succeeds() public {
        vm.prank(multisig);
        pool.pause();
        assertTrue(pool.paused());
    }

    function test_unpause_by_multisig_succeeds() public {
        vm.prank(multisig);
        pool.pause();
        vm.prank(multisig);
        pool.unpause();
        assertFalse(pool.paused());
    }
}
