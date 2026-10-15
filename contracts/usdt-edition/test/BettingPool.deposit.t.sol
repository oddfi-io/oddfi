// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./helpers/BettingPoolTestBase.sol";

contract BettingPoolDepositTest is BettingPoolTestBase {
    function setUp() public override {
        super.setUp();
    }

    // ── creditDeposit ─────────────────────────────────────────────────────────

    function test_creditDeposit_normal() public {
        bytes32 h = keccak256("tx1");
        usdt.mint(address(pool), 1_000e6);
        vm.prank(admin);
        pool.creditDeposit(user1, 1_000e6, h);

        assertEq(pool.userBalances(user1), 1_000e6);
        assertEq(pool.totalUserBalances(), 1_000e6);
        assertTrue(pool.processedDeposits(h));
    }

    function test_creditDeposit_emitsEvent() public {
        bytes32 h = keccak256("tx_emit");
        usdt.mint(address(pool), 500e6);
        vm.expectEmit(true, false, true, true);
        emit IBettingPool.Deposited(user1, 500e6, h);
        vm.prank(admin);
        pool.creditDeposit(user1, 500e6, h);
    }

    function test_creditDeposit_zeroAmount_reverts() public {
        bytes32 h = keccak256("tx_zero");
        usdt.mint(address(pool), 0);
        vm.prank(admin);
        vm.expectRevert(ZeroAmount.selector);
        pool.creditDeposit(user1, 0, h);
    }

    function test_creditDeposit_zeroAddress_reverts() public {
        bytes32 h = keccak256("tx_addr0");
        usdt.mint(address(pool), 100e6);
        vm.prank(admin);
        vm.expectRevert(InvalidAddress.selector);
        pool.creditDeposit(address(0), 100e6, h);
    }

    function test_creditDeposit_duplicateTxHash_reverts() public {
        bytes32 h = keccak256("tx_dup");
        usdt.mint(address(pool), 1_000e6);
        vm.prank(admin);
        pool.creditDeposit(user1, 500e6, h);

        usdt.mint(address(pool), 500e6);
        vm.prank(admin);
        vm.expectRevert("already processed");
        pool.creditDeposit(user1, 500e6, h);
    }

    function test_creditDeposit_balanceMismatch_reverts() public {
        // don't mint — pool balance too low
        bytes32 h = keccak256("tx_mismatch");
        vm.prank(admin);
        vm.expectRevert("balance mismatch");
        pool.creditDeposit(user1, 100e6, h);
    }

    function test_creditDeposit_multipleUsers() public {
        _deposit(user1, 500e6);
        _deposit(user2, 300e6);
        assertEq(pool.userBalances(user1), 500e6);
        assertEq(pool.userBalances(user2), 300e6);
        assertEq(pool.totalUserBalances(), 800e6);
    }

    // ── withdraw (small — direct) ─────────────────────────────────────────────

    function test_withdraw_small_direct() public {
        _deposit(user1, 1_000e6);
        uint256 balBefore = usdt.balanceOf(user1);
        vm.prank(user1);
        pool.withdraw(100e6);
        assertEq(usdt.balanceOf(user1), balBefore + 100e6);
        assertEq(pool.userBalances(user1), 900e6);
        assertEq(pool.totalUserBalances(), 900e6);
    }

    function test_withdraw_small_emitsEvent() public {
        _deposit(user1, 1_000e6);
        vm.expectEmit(true, false, false, true);
        emit IBettingPool.Withdrawn(user1, 100e6);
        vm.prank(user1);
        pool.withdraw(100e6);
    }

    function test_withdraw_exactThreshold_direct() public {
        _deposit(user1, 10_000e6);
        // LARGE_WITHDRAWAL_THRESHOLD = 5_000e6 — exactly threshold goes direct
        vm.prank(user1);
        pool.withdraw(5_000e6);
        assertEq(usdt.balanceOf(user1), 5_000e6);
    }

    function test_withdraw_zeroAmount_reverts() public {
        _deposit(user1, 1_000e6);
        vm.prank(user1);
        vm.expectRevert("bad amount");
        pool.withdraw(0);
    }

    function test_withdraw_insufficientBalance_reverts() public {
        _deposit(user1, 100e6);
        vm.prank(user1);
        vm.expectRevert("bad amount");
        pool.withdraw(200e6);
    }

    // ── withdraw (large — creates request) ───────────────────────────────────

    function test_withdraw_large_createsRequest() public {
        _deposit(user1, 10_000e6);
        vm.prank(user1);
        pool.withdraw(6_000e6);

        bytes32 reqId = keccak256(abi.encode(user1, uint256(0)));
        (address reqUser, uint256 reqAmount,, bool executed, bool rejected) = pool.withdrawalRequests(reqId);
        assertEq(reqUser, user1);
        assertEq(reqAmount, 6_000e6);
        assertFalse(executed);
        assertFalse(rejected);
        assertEq(pool.totalPendingWithdrawals(), 6_000e6);
        // userBalance deducted immediately
        assertEq(pool.userBalances(user1), 4_000e6);
    }

    function test_withdraw_large_emitsEvent() public {
        _deposit(user1, 10_000e6);
        bytes32 expectedReqId = keccak256(abi.encode(user1, uint256(0)));
        vm.expectEmit(true, true, false, true);
        emit IBettingPool.LargeWithdrawalRequested(expectedReqId, user1, 6_000e6);
        vm.prank(user1);
        pool.withdraw(6_000e6);
    }

    // ── executeLargeWithdrawal ────────────────────────────────────────────────

    function test_executeLargeWithdrawal_afterDelay() public {
        _deposit(user1, 10_000e6);
        vm.prank(user1);
        pool.withdraw(6_000e6);
        bytes32 reqId = keccak256(abi.encode(user1, uint256(0)));

        vm.warp(block.timestamp + 24 hours + 1);
        uint256 balBefore = usdt.balanceOf(user1);
        vm.prank(user1);
        pool.executeLargeWithdrawal(reqId);

        assertEq(usdt.balanceOf(user1), balBefore + 6_000e6);
        assertEq(pool.totalPendingWithdrawals(), 0);
        (,, , bool executed,) = pool.withdrawalRequests(reqId);
        assertTrue(executed);
    }

    function test_executeLargeWithdrawal_beforeDelay_reverts() public {
        _deposit(user1, 10_000e6);
        vm.prank(user1);
        pool.withdraw(6_000e6);
        bytes32 reqId = keccak256(abi.encode(user1, uint256(0)));

        vm.prank(user1);
        vm.expectRevert(WithdrawalNotReady.selector);
        pool.executeLargeWithdrawal(reqId);
    }

    function test_executeLargeWithdrawal_wrongUser_reverts() public {
        _deposit(user1, 10_000e6);
        vm.prank(user1);
        pool.withdraw(6_000e6);
        bytes32 reqId = keccak256(abi.encode(user1, uint256(0)));

        vm.warp(block.timestamp + 24 hours + 1);
        vm.prank(user2);
        vm.expectRevert("not owner");
        pool.executeLargeWithdrawal(reqId);
    }

    function test_executeLargeWithdrawal_alreadyProcessed_reverts() public {
        _deposit(user1, 10_000e6);
        vm.prank(user1);
        pool.withdraw(6_000e6);
        bytes32 reqId = keccak256(abi.encode(user1, uint256(0)));

        vm.warp(block.timestamp + 24 hours + 1);
        vm.prank(user1);
        pool.executeLargeWithdrawal(reqId);

        vm.prank(user1);
        vm.expectRevert(WithdrawalAlreadyProcessed.selector);
        pool.executeLargeWithdrawal(reqId);
    }

    // ── rejectLargeWithdrawal ─────────────────────────────────────────────────

    function test_rejectLargeWithdrawal_withinDelay() public {
        _deposit(user1, 10_000e6);
        vm.prank(user1);
        pool.withdraw(6_000e6);
        bytes32 reqId = keccak256(abi.encode(user1, uint256(0)));

        vm.prank(admin);
        pool.rejectLargeWithdrawal(reqId);

        // funds restored
        assertEq(pool.userBalances(user1), 10_000e6);
        assertEq(pool.totalPendingWithdrawals(), 0);
        (,,,, bool rejected) = pool.withdrawalRequests(reqId);
        assertTrue(rejected);
    }

    function test_rejectLargeWithdrawal_emitsEvent() public {
        _deposit(user1, 10_000e6);
        vm.prank(user1);
        pool.withdraw(6_000e6);
        bytes32 reqId = keccak256(abi.encode(user1, uint256(0)));

        vm.expectEmit(true, true, false, true);
        emit IBettingPool.LargeWithdrawalRejected(reqId, user1, 6_000e6);
        vm.prank(admin);
        pool.rejectLargeWithdrawal(reqId);
    }

    function test_rejectLargeWithdrawal_afterDelay_reverts() public {
        _deposit(user1, 10_000e6);
        vm.prank(user1);
        pool.withdraw(6_000e6);
        bytes32 reqId = keccak256(abi.encode(user1, uint256(0)));

        vm.warp(block.timestamp + 24 hours + 1);
        vm.prank(admin);
        vm.expectRevert("delay passed");
        pool.rejectLargeWithdrawal(reqId);
    }

    function test_rejectLargeWithdrawal_alreadyProcessed_reverts() public {
        _deposit(user1, 10_000e6);
        vm.prank(user1);
        pool.withdraw(6_000e6);
        bytes32 reqId = keccak256(abi.encode(user1, uint256(0)));

        vm.prank(admin);
        pool.rejectLargeWithdrawal(reqId);

        vm.prank(admin);
        vm.expectRevert(WithdrawalAlreadyProcessed.selector);
        pool.rejectLargeWithdrawal(reqId);
    }

    function test_multipleWithdrawalNonces() public {
        _deposit(user1, 30_000e6);
        vm.prank(user1);
        pool.withdraw(6_000e6);
        vm.prank(user1);
        pool.withdraw(7_000e6);

        bytes32 reqId0 = keccak256(abi.encode(user1, uint256(0)));
        bytes32 reqId1 = keccak256(abi.encode(user1, uint256(1)));

        (address u0, uint256 a0,,,) = pool.withdrawalRequests(reqId0);
        (address u1, uint256 a1,,,) = pool.withdrawalRequests(reqId1);

        assertEq(u0, user1);
        assertEq(a0, 6_000e6);
        assertEq(u1, user1);
        assertEq(a1, 7_000e6);
    }
}
