// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./helpers/BettingPoolTestBase.sol";

contract BettingPoolSignalTest is BettingPoolTestBase {
    function setUp() public override {
        super.setUp();
        _openMarket(MATCH_A, MarketType.X12, 0);
        _addLiquidity(lp1, 100_000e6);
        _deposit(user1, 10_000e6);
    }

    // ── updateSignal ──────────────────────────────────────────────────────────

    function test_updateSignal_green() public {
        vm.prank(admin);
        pool.updateSignal(MATCH_A, MarketType.X12, 0, 5_000e6, 0, SignalColor.Green);

        bytes32 key = keccak256(abi.encode(MATCH_A, MarketType.X12, uint8(0)));
        (uint256 heavyAmount, uint8 heavySide, SignalColor color) = pool.signals(key);
        assertEq(heavyAmount, 5_000e6);
        assertEq(heavySide, 0);
        assertEq(uint8(color), uint8(SignalColor.Green));
    }

    function test_updateSignal_red() public {
        vm.prank(admin);
        pool.updateSignal(MATCH_A, MarketType.X12, 0, 30_000e6, 0, SignalColor.Red);

        bytes32 key = keccak256(abi.encode(MATCH_A, MarketType.X12, uint8(0)));
        (, uint8 heavySide, SignalColor color) = pool.signals(key);
        assertEq(heavySide, 0);
        assertEq(uint8(color), uint8(SignalColor.Red));
    }

    function test_updateSignal_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit IBettingPool.SignalUpdated(MATCH_A, MarketType.X12, 0, SignalColor.Red);
        vm.prank(admin);
        pool.updateSignal(MATCH_A, MarketType.X12, 0, 30_000e6, 0, SignalColor.Red);
    }

    function test_updateSignal_canOverwrite() public {
        vm.prank(admin);
        pool.updateSignal(MATCH_A, MarketType.X12, 0, 30_000e6, 0, SignalColor.Red);
        vm.prank(admin);
        pool.updateSignal(MATCH_A, MarketType.X12, 0, 0, 0, SignalColor.Green); // reset

        bytes32 key = keccak256(abi.encode(MATCH_A, MarketType.X12, uint8(0)));
        (,, SignalColor color) = pool.signals(key);
        assertEq(uint8(color), uint8(SignalColor.Green));
    }

    // ── isAccepting ───────────────────────────────────────────────────────────

    function test_isAccepting_defaultGreen_allOutcomes() public view {
        // No signal set → default Green → all outcomes accepted
        assertTrue(pool.isAccepting(MATCH_A, MarketType.X12, 0, 0));
        assertTrue(pool.isAccepting(MATCH_A, MarketType.X12, 0, 1));
        assertTrue(pool.isAccepting(MATCH_A, MarketType.X12, 0, 2));
    }

    function test_isAccepting_red_blocksHeavySide() public {
        vm.prank(admin);
        pool.updateSignal(MATCH_A, MarketType.X12, 0, 30_000e6, 0, SignalColor.Red);

        assertFalse(pool.isAccepting(MATCH_A, MarketType.X12, 0, 0)); // heavySide=0 blocked
        assertTrue(pool.isAccepting(MATCH_A, MarketType.X12, 0, 1)); // outcome=1 OK
        assertTrue(pool.isAccepting(MATCH_A, MarketType.X12, 0, 2)); // outcome=2 OK
    }

    function test_isAccepting_yellow_allowsAll() public {
        vm.prank(admin);
        pool.updateSignal(MATCH_A, MarketType.X12, 0, 20_000e6, 0, SignalColor.Yellow);

        assertTrue(pool.isAccepting(MATCH_A, MarketType.X12, 0, 0));
        assertTrue(pool.isAccepting(MATCH_A, MarketType.X12, 0, 1));
    }

    function test_isAccepting_orange_allowsAll() public {
        vm.prank(admin);
        pool.updateSignal(MATCH_A, MarketType.X12, 0, 25_000e6, 0, SignalColor.Orange);

        assertTrue(pool.isAccepting(MATCH_A, MarketType.X12, 0, 0));
        assertTrue(pool.isAccepting(MATCH_A, MarketType.X12, 0, 1));
    }

    // ── red light blocks lockBet ──────────────────────────────────────────────

    function test_redLight_blocksLockBet_heavySide() public {
        vm.prank(admin);
        pool.updateSignal(MATCH_A, MarketType.X12, 0, 30_000e6, 1, SignalColor.Red); // heavySide=1

        vm.prank(admin);
        vm.expectRevert(MarketRedLight.selector);
        pool.lockBet(keccak256("bet1"), user1, 100e6, MATCH_A, MarketType.X12, 1, 0, 1500);
    }

    function test_redLight_allowsLockBet_otherSide() public {
        vm.prank(admin);
        pool.updateSignal(MATCH_A, MarketType.X12, 0, 30_000e6, 1, SignalColor.Red); // heavySide=1

        // outcome=0 (not heavy side) should be accepted
        _lockBet(keccak256("bet1"), user1, 100e6, MATCH_A, MarketType.X12, 0, 0, 1500);
    }

    function test_redLight_heavySide1_blocksOutcome1() public {
        vm.prank(admin);
        pool.updateSignal(MATCH_A, MarketType.X12, 0, 30_000e6, 1, SignalColor.Red);

        assertFalse(pool.isAccepting(MATCH_A, MarketType.X12, 0, 1));
        assertTrue(pool.isAccepting(MATCH_A, MarketType.X12, 0, 0));
    }
}
