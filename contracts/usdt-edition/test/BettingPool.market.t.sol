// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./helpers/BettingPoolTestBase.sol";

contract BettingPoolMarketTest is BettingPoolTestBase {
    function setUp() public override {
        super.setUp();
    }

    // ── openMarket ────────────────────────────────────────────────────────────

    function test_openMarket_success() public {
        vm.prank(admin);
        pool.openMarket(MATCH_A, MarketType.X12, 0);

        bytes32 key = keccak256(abi.encode(MATCH_A, MarketType.X12, uint8(0)));
        assertEq(uint8(pool.marketStatus(key)), uint8(MarketStatus.Open));
    }

    function test_openMarket_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit IBettingPool.MarketOpened(MATCH_A, MarketType.X12, 0);
        vm.prank(admin);
        pool.openMarket(MATCH_A, MarketType.X12, 0);
    }

    function test_openMarket_alreadyExists_reverts() public {
        vm.prank(admin);
        pool.openMarket(MATCH_A, MarketType.X12, 0);
        vm.prank(admin);
        vm.expectRevert("already exists");
        pool.openMarket(MATCH_A, MarketType.X12, 0);
    }

    function test_openMarket_addsToMatchMarkets() public {
        vm.prank(admin);
        pool.openMarket(MATCH_A, MarketType.X12, 0);
        vm.prank(admin);
        pool.openMarket(MATCH_A, MarketType.AH, 1);

        bytes32 key0 = keccak256(abi.encode(MATCH_A, MarketType.X12, uint8(0)));
        bytes32 key1 = keccak256(abi.encode(MATCH_A, MarketType.AH, uint8(1)));
        assertEq(pool.matchMarkets(MATCH_A, 0), key0);
        assertEq(pool.matchMarkets(MATCH_A, 1), key1);
    }

    function test_openMarket_tooMany_reverts() public {
        // DEFAULT_MAX_MARKETS_PER_MATCH = 9
        for (uint8 i = 0; i < 9; i++) {
            vm.prank(admin);
            pool.openMarket(MATCH_A, MarketType.X12, i);
        }
        vm.prank(admin);
        vm.expectRevert(TooManyMarkets.selector);
        pool.openMarket(MATCH_A, MarketType.AH, 9);
    }

    // ── closeMarket ───────────────────────────────────────────────────────────

    function test_closeMarket_success() public {
        vm.prank(admin);
        pool.openMarket(MATCH_A, MarketType.X12, 0);
        vm.prank(admin);
        pool.closeMarket(MATCH_A, MarketType.X12, 0);

        bytes32 key = keccak256(abi.encode(MATCH_A, MarketType.X12, uint8(0)));
        assertEq(uint8(pool.marketStatus(key)), uint8(MarketStatus.Closed));
    }

    function test_closeMarket_emitsEvent() public {
        vm.prank(admin);
        pool.openMarket(MATCH_A, MarketType.X12, 0);
        vm.expectEmit(true, false, false, true);
        emit IBettingPool.MarketClosed(MATCH_A, MarketType.X12, 0);
        vm.prank(admin);
        pool.closeMarket(MATCH_A, MarketType.X12, 0);
    }

    function test_closeMarket_notOpen_reverts() public {
        vm.prank(admin);
        vm.expectRevert("not open");
        pool.closeMarket(MATCH_A, MarketType.X12, 0);
    }

    // ── reopenMarket ──────────────────────────────────────────────────────────

    function test_reopenMarket_success() public {
        vm.prank(admin);
        pool.openMarket(MATCH_A, MarketType.X12, 0);
        vm.prank(admin);
        pool.closeMarket(MATCH_A, MarketType.X12, 0);
        vm.prank(multisig);
        pool.reopenMarket(MATCH_A, MarketType.X12, 0);

        bytes32 key = keccak256(abi.encode(MATCH_A, MarketType.X12, uint8(0)));
        assertEq(uint8(pool.marketStatus(key)), uint8(MarketStatus.Open));
    }

    function test_reopenMarket_emitsEvent() public {
        vm.prank(admin);
        pool.openMarket(MATCH_A, MarketType.X12, 0);
        vm.prank(admin);
        pool.closeMarket(MATCH_A, MarketType.X12, 0);
        vm.expectEmit(true, false, false, true);
        emit IBettingPool.MarketReopened(MATCH_A, MarketType.X12, 0);
        vm.prank(multisig);
        pool.reopenMarket(MATCH_A, MarketType.X12, 0);
    }

    function test_reopenMarket_notClosed_reverts() public {
        vm.prank(admin);
        pool.openMarket(MATCH_A, MarketType.X12, 0);
        vm.prank(multisig);
        vm.expectRevert("not closed");
        pool.reopenMarket(MATCH_A, MarketType.X12, 0);
    }

    // ── batchOpenMarkets ──────────────────────────────────────────────────────

    function test_batchOpenMarkets_success() public {
        MarketType[] memory mts = new MarketType[](3);
        mts[0] = MarketType.X12;
        mts[1] = MarketType.AH;
        mts[2] = MarketType.OU;
        uint8[] memory lines = new uint8[](3);
        lines[0] = 0;
        lines[1] = 1;
        lines[2] = 2;

        vm.prank(admin);
        pool.batchOpenMarkets(MATCH_B, mts, lines);

        for (uint256 i = 0; i < 3; i++) {
            bytes32 key = keccak256(abi.encode(MATCH_B, mts[i], lines[i]));
            assertEq(uint8(pool.marketStatus(key)), uint8(MarketStatus.Open));
        }
    }

    function test_batchOpenMarkets_lengthMismatch_reverts() public {
        MarketType[] memory mts = new MarketType[](2);
        mts[0] = MarketType.X12;
        mts[1] = MarketType.AH;
        uint8[] memory lines = new uint8[](1);
        lines[0] = 0;

        vm.prank(admin);
        vm.expectRevert("length mismatch");
        pool.batchOpenMarkets(MATCH_B, mts, lines);
    }

    function test_batchOpenMarkets_tooMany_reverts() public {
        // Fill 9 markets first
        MarketType[] memory mts1 = new MarketType[](9);
        uint8[] memory lines1 = new uint8[](9);
        for (uint8 i = 0; i < 9; i++) {
            mts1[i] = MarketType.X12;
            lines1[i] = i;
        }
        vm.prank(admin);
        pool.batchOpenMarkets(MATCH_C, mts1, lines1);

        // Try to add one more
        MarketType[] memory mts2 = new MarketType[](1);
        mts2[0] = MarketType.AH;
        uint8[] memory lines2 = new uint8[](1);
        lines2[0] = 0;
        vm.prank(admin);
        vm.expectRevert(TooManyMarkets.selector);
        pool.batchOpenMarkets(MATCH_C, mts2, lines2);
    }

    // ── batchCloseMarkets ─────────────────────────────────────────────────────

    function test_batchCloseMarkets_success() public {
        MarketType[] memory mts = new MarketType[](2);
        mts[0] = MarketType.X12;
        mts[1] = MarketType.AH;
        uint8[] memory lines = new uint8[](2);
        lines[0] = 0;
        lines[1] = 1;

        vm.prank(admin);
        pool.batchOpenMarkets(MATCH_A, mts, lines);
        vm.prank(admin);
        pool.batchCloseMarkets(MATCH_A, mts, lines);

        for (uint256 i = 0; i < 2; i++) {
            bytes32 key = keccak256(abi.encode(MATCH_A, mts[i], lines[i]));
            assertEq(uint8(pool.marketStatus(key)), uint8(MarketStatus.Closed));
        }
    }

    function test_batchCloseMarkets_notOpen_reverts() public {
        MarketType[] memory mts = new MarketType[](1);
        mts[0] = MarketType.X12;
        uint8[] memory lines = new uint8[](1);
        lines[0] = 0;

        vm.prank(admin);
        vm.expectRevert("not open");
        pool.batchCloseMarkets(MATCH_A, mts, lines);
    }

    // ── state transitions ─────────────────────────────────────────────────────

    function test_marketStatus_notCreated_initially() public view {
        bytes32 key = keccak256(abi.encode(MATCH_A, MarketType.X12, uint8(0)));
        assertEq(uint8(pool.marketStatus(key)), uint8(MarketStatus.NotCreated));
    }

    function test_marketStatus_fullLifecycle() public {
        bytes32 key = keccak256(abi.encode(MATCH_A, MarketType.X12, uint8(0)));

        // NotCreated → Open
        vm.prank(admin);
        pool.openMarket(MATCH_A, MarketType.X12, 0);
        assertEq(uint8(pool.marketStatus(key)), uint8(MarketStatus.Open));

        // Open → Closed
        vm.prank(admin);
        pool.closeMarket(MATCH_A, MarketType.X12, 0);
        assertEq(uint8(pool.marketStatus(key)), uint8(MarketStatus.Closed));

        // Closed → Open (reopen)
        vm.prank(multisig);
        pool.reopenMarket(MATCH_A, MarketType.X12, 0);
        assertEq(uint8(pool.marketStatus(key)), uint8(MarketStatus.Open));
    }

    function test_setMaxMarketsPerMatch_byMultisig() public {
        vm.prank(multisig);
        pool.setMaxMarketsPerMatch(3);
        assertEq(pool.maxMarketsPerMatch(), 3);

        // Now only 3 markets allowed
        for (uint8 i = 0; i < 3; i++) {
            vm.prank(admin);
            pool.openMarket(MATCH_A, MarketType.X12, i);
        }
        vm.prank(admin);
        vm.expectRevert(TooManyMarkets.selector);
        pool.openMarket(MATCH_A, MarketType.X12, 3);
    }
}
