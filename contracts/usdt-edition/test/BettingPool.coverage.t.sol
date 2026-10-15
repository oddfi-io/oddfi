// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./helpers/BettingPoolTestBase.sol";

/// @notice Extra tests to cover remaining uncovered branches.
contract BettingPoolCoverageTest is BettingPoolTestBase {
    bytes32 constant COLLAT = keccak256("collatC");
    bytes32 constant CREDIT = keccak256("creditC");

    bytes32 constant MATCH_COLLAT = keccak256("matchCollatC");
    bytes32 constant MATCH_CREDIT = keccak256("matchCreditC");

    function setUp() public override {
        super.setUp();
        _addLiquidity(lp1, 500_000e6);
        _deposit(user1, 10_000e6);
        vm.startPrank(admin);
        pool.openMarket(MATCH_COLLAT, MarketType.X12, 0);
        pool.openMarket(MATCH_CREDIT, MarketType.X12, 0);
        vm.stopPrank();
    }

    // ── Credit settlement: collatWon + creditWon, odds < 2000 (line 722) ─────────

    function test_creditSettle_collatWon_creditWon_lowOdds_bettingPoolIncrease() public {
        // odds=1500: potPayout=600e6 < 2*400e6=800e6 → pool GAINS (2*amount - potPayout)
        uint256 creditAmt = 400e6;

        _lockBet(COLLAT, user1, 1_000e6, MATCH_COLLAT, MarketType.X12, 0, 0, 1818);

        vm.prank(admin);
        pool.lockCreditBet(CREDIT, COLLAT, user1, creditAmt, MATCH_CREDIT, MarketType.X12, 0, 0, 1500);

        // Settle collateral as Won
        vm.prank(admin);
        pool.closeMarket(MATCH_COLLAT, MarketType.X12, 0);
        bytes32[] memory c1 = new bytes32[](1);
        c1[0] = COLLAT;
        _settle(MATCH_COLLAT, MarketType.X12, 0, 0, c1);

        // Settle credit as Won with odds=1500 → potPayout(600) < 2*amount(800) → else branch
        vm.prank(admin);
        pool.closeMarket(MATCH_CREDIT, MarketType.X12, 0);
        bytes32[] memory c2 = new bytes32[](1);
        c2[0] = CREDIT;

        uint256 poolBefore = pool.bettingPool();
        _settle(MATCH_CREDIT, MarketType.X12, 0, 0, c2);

        // bettingPool += (2*amount - potPayout) = (800 - 600) = 200e6
        assertEq(pool.bettingPool(), poolBefore + 200e6);
    }

    // ── releaseOrForfeiture: frozen < 2*amount (line 795) ────────────────────────

    function test_releaseOrForfeiture_collatWon_frozenLtTwiceAmount() public {
        // odds=1500: frozen=600 < 2*400=800 → pool += (2*amount - frozen) = 200
        uint256 creditAmt = 400e6;
        _lockBet(COLLAT, user1, 1_000e6, MATCH_COLLAT, MarketType.X12, 0, 0, 1818);

        vm.prank(admin);
        pool.lockCreditBet(CREDIT, COLLAT, user1, creditAmt, MATCH_CREDIT, MarketType.X12, 0, 0, 1500);

        // Settle credit as Won while collateral is Pending → frozen payout
        vm.prank(admin);
        pool.closeMarket(MATCH_CREDIT, MarketType.X12, 0);
        bytes32[] memory c2 = new bytes32[](1);
        c2[0] = CREDIT;
        _settle(MATCH_CREDIT, MarketType.X12, 0, 0, c2);

        uint256 frozen = pool.frozenPayouts(CREDIT);
        assertEq(frozen, 600e6); // 400*1500/1000

        // Settle collateral as Won
        vm.prank(admin);
        pool.closeMarket(MATCH_COLLAT, MarketType.X12, 0);
        bytes32[] memory c1 = new bytes32[](1);
        c1[0] = COLLAT;
        _settle(MATCH_COLLAT, MarketType.X12, 0, 0, c1);

        // releaseOrForfeiture: frozen=600 < 2*400=800 → else branch: pool += 200e6
        uint256 poolBefore = pool.bettingPool();
        vm.prank(admin);
        pool.releaseOrForfeiture(CREDIT);

        assertEq(pool.frozenPayouts(CREDIT), 0);
        assertEq(pool.totalFrozenPayouts(), 0);
        // Pool gained (2*amount - frozen) = 200e6
        assertEq(pool.bettingPool(), poolBefore + 200e6);
    }

    // ── cancelMatch with a credit bet (line 840) ──────────────────────────────────

    function test_cancelMatch_with_creditBet() public {
        _lockBet(COLLAT, user1, 1_000e6, MATCH_COLLAT, MarketType.X12, 0, 0, 1818);

        vm.prank(admin);
        pool.lockCreditBet(CREDIT, COLLAT, user1, 400e6, MATCH_CREDIT, MarketType.X12, 0, 0, 1500);

        uint256 poolBefore = pool.bettingPool();
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = CREDIT;

        vm.prank(multisig);
        pool.cancelMatch(MATCH_CREDIT, MarketType.X12, 0, ids);

        // Credit amount (400e6) returned to pool
        assertEq(pool.bettingPool(), poolBefore + 400e6);
        assertEq(pool.totalCreditOutstanding(), 0);

        (,,,,,,, BetStatus status,,,,) = pool.bets(CREDIT);
        assertEq(uint8(status), uint8(BetStatus.Cancelled));
    }

    // ── cancelMatch: skip already-cancelled bet (line 835 branch) ────────────────

    function test_cancelMatch_skipsAlreadyCancelledBet() public {
        bytes32 BET1 = keccak256("bet1_skip");
        bytes32 BET2 = keccak256("bet2_skip");
        _openMarket(MATCH_A, MarketType.X12, 0);
        _lockBet(BET1, user1, 500e6, MATCH_A, MarketType.X12, 0, 0, 1500);
        _lockBet(BET2, user1, 200e6, MATCH_A, MarketType.X12, 1, 0, 1500);

        // Pre-cancel BET1 via unlockBet
        bytes32[] memory empty;
        vm.prank(admin);
        pool.unlockBet(BET1, empty);

        // Now cancelMatch with [BET1, BET2] — BET1 skipped (not Pending), BET2 cancelled
        bytes32[] memory ids = new bytes32[](2);
        ids[0] = BET1;
        ids[1] = BET2;
        vm.prank(multisig);
        pool.cancelMatch(MATCH_A, MarketType.X12, 0, ids);

        (,,,,,,, BetStatus s1,,,,) = pool.bets(BET1);
        (,,,,,,, BetStatus s2,,,,) = pool.bets(BET2);
        assertEq(uint8(s1), uint8(BetStatus.Cancelled)); // already was
        assertEq(uint8(s2), uint8(BetStatus.Cancelled)); // newly cancelled
    }

    // ── batchCancelMatch (lines 945-987) ─────────────────────────────────────────

    function test_batchCancelMatch_success() public {
        // Two markets on the SAME match (batchCancelMatch takes single matchId)
        bytes32 MATCH_MULTI = keccak256("matchMulti");
        bytes32 BET_X12 = keccak256("betX12");
        bytes32 BET_AH = keccak256("betAH");

        vm.startPrank(admin);
        pool.openMarket(MATCH_MULTI, MarketType.X12, 0);
        pool.openMarket(MATCH_MULTI, MarketType.AH, 1);
        vm.stopPrank();

        _lockBet(BET_X12, user1, 500e6, MATCH_MULTI, MarketType.X12, 0, 0, 1500);
        _lockBet(BET_AH, user1, 300e6, MATCH_MULTI, MarketType.AH, 0, 1, 1500);

        MarketType[] memory mts = new MarketType[](2);
        mts[0] = MarketType.X12;
        mts[1] = MarketType.AH;

        uint8[] memory lines = new uint8[](2);
        lines[0] = 0;
        lines[1] = 1;

        bytes32[][] memory betsByMarket = new bytes32[][](2);
        betsByMarket[0] = new bytes32[](1);
        betsByMarket[0][0] = BET_X12;
        betsByMarket[1] = new bytes32[](1);
        betsByMarket[1][0] = BET_AH;

        vm.prank(multisig);
        pool.batchCancelMatch(MATCH_MULTI, mts, lines, betsByMarket);

        (,,,,,,, BetStatus sx,,,,) = pool.bets(BET_X12);
        (,,,,,,, BetStatus sy,,,,) = pool.bets(BET_AH);
        assertEq(uint8(sx), uint8(BetStatus.Cancelled));
        assertEq(uint8(sy), uint8(BetStatus.Cancelled));
    }

    function test_batchCancelMatch_lengthMismatch_reverts() public {
        MarketType[] memory mts = new MarketType[](2);
        uint8[] memory lines = new uint8[](1); // mismatch
        bytes32[][] memory bids = new bytes32[][](2);

        vm.prank(multisig);
        vm.expectRevert("length mismatch");
        pool.batchCancelMatch(MATCH_A, mts, lines, bids);
    }

    function test_batchCancelMatch_alreadyCancelled_market_ok() public {
        bytes32 MATCH_Z = keccak256("matchZ");
        bytes32 BET_Z = keccak256("betZ");

        vm.prank(admin);
        pool.openMarket(MATCH_Z, MarketType.X12, 0);
        _lockBet(BET_Z, user1, 500e6, MATCH_Z, MarketType.X12, 0, 0, 1500);

        MarketType[] memory mts = new MarketType[](1);
        mts[0] = MarketType.X12;
        uint8[] memory lines = new uint8[](1);
        bytes32[][] memory bids = new bytes32[][](1);
        bids[0] = new bytes32[](1);
        bids[0][0] = BET_Z;

        vm.prank(multisig);
        pool.batchCancelMatch(MATCH_Z, mts, lines, bids);

        // Cancel again (already-Cancelled market) with empty bets — no revert
        bytes32[][] memory emptyBids = new bytes32[][](1);
        emptyBids[0] = new bytes32[](0);
        vm.prank(multisig);
        pool.batchCancelMatch(MATCH_Z, mts, lines, emptyBids);
    }

    // ── 3-leg parlay: cancel 1 leg → reduces to 2 (else branch, lines 917-921) ──

    function test_cancelParlay_3legs_cancelOne_reduceToTwo() public {
        bytes32 PARLAY3 = keccak256("parlay3");
        bytes32 LEG1 = keccak256("l1");
        bytes32 LEG2 = keccak256("l2");
        bytes32 LEG3 = keccak256("l3");
        bytes32 M1 = keccak256("c1");
        bytes32 M2 = keccak256("c2");
        bytes32 M3 = keccak256("c3");

        vm.startPrank(admin);
        pool.openMarket(M1, MarketType.X12, 0);
        pool.openMarket(M2, MarketType.X12, 0);
        pool.openMarket(M3, MarketType.X12, 0);
        vm.stopPrank();

        bytes32[] memory mIds = new bytes32[](3);
        mIds[0] = M1; mIds[1] = M2; mIds[2] = M3;
        MarketType[] memory mts = new MarketType[](3);
        mts[0] = MarketType.X12; mts[1] = MarketType.X12; mts[2] = MarketType.X12;
        uint8[] memory outs = new uint8[](3);
        uint8[] memory lns = new uint8[](3);
        uint256[] memory odds = new uint256[](3);
        odds[0] = 1500; odds[1] = 1500; odds[2] = 1500;
        bytes32[] memory legIds = new bytes32[](3);
        legIds[0] = LEG1; legIds[1] = LEG2; legIds[2] = LEG3;

        vm.prank(admin);
        pool.lockParlay(PARLAY3, user1, 100e6, mIds, mts, outs, lns, odds, legIds);

        // Cancel M1 (1 of 3 legs) — remaining=2, takes else branch (not degradeToSingle)
        bytes32[] memory cancelIds = new bytes32[](1);
        cancelIds[0] = LEG1;
        vm.prank(multisig);
        pool.cancelMatch(M1, MarketType.X12, 0, cancelIds);

        (,, uint256 newOdds,, BetStatus pStatus, , , uint8 cancelled) = pool.parlays(PARLAY3);
        assertEq(uint8(pStatus), uint8(BetStatus.Pending));
        assertEq(cancelled, 1);
        // newCombinedOdds = (oldCombined * 1000) / leg1Odds
        // oldCombined = 1500*1500*1500/1000/1000 = 3375 (with integer truncation)
        // = 1500*1500/1000=2250, then 2250*1500/1000=3375
        // newCombined = 3375*1000/1500 = 2250
        assertEq(newOdds, 2250);
    }

    // ── lockCreditBet: InsufficientLiquidity (line 345) ──────────────────────────

    function test_lockCreditBet_insufficientLiquidity_reverts() public {
        // Use extreme odds so potPayout >> available pool capacity
        // bettingPool=500_000e6, totalPotentialPayout≈0, amount=400e6
        // potPayout = 400e6 * 1_000_000 / 1000 = 400_000e6
        // available = (500_000e6 - 400e6) - 0 - 0 = 499_600e6
        // 400_000e6 < 499_600e6 — that won't revert...
        // Need to first exhaust pool with normal bets, then try credit

        // Lock 50 bets at 10_000e6 each at 1000 odds → 50*10_000=500_000e6 totalPotentialPayout
        // That = bettingPool so nothing left for credit
        bytes32 matchFill = keccak256("matchFillC");
        vm.prank(admin);
        pool.openMarket(matchFill, MarketType.X12, 0);

        // Lock COLLAT bet FIRST (while pool still has capacity)
        // COLLAT: stake=1_000e6, odds=1818 → potPayout=1818e6
        _lockBet(COLLAT, user1, 1_000e6, MATCH_COLLAT, MarketType.X12, 0, 0, 1818);

        // 49 fill bets at 10_000e6 stake, 1000 odds → each potPayout=10_000e6
        // After 49: totalPotentialPayout = 1818e6 + 490_000e6 = 491_818e6
        // Available remaining = 500_000e6 - 491_818e6 = 8_182e6
        for (uint8 i = 0; i < 49; i++) {
            address u = address(uint160(0x3000 + i));
            _depositWithHash(u, 10_000e6, keccak256(abi.encode("fillC", i)));
            bytes32 bid = keccak256(abi.encode("fillBetC", i));
            _lockBet(bid, u, 10_000e6, matchFill, MarketType.X12, 0, 0, 1000);
        }
        // Final fill bet: 7_500e6 stake at 1000 odds → potPayout=7_500e6 ≤ 8_182e6 (fits)
        // totalPotentialPayout = 491_818e6 + 7_500e6 = 499_318e6
        // Credit potPayout = 400e6*1500/1000 = 600e6
        // available = (500_000e6 - 400e6) - 499_318e6 = +282e6  (no underflow!)
        // 282e6 < 600e6 → InsufficientLiquidity ✓
        {
            address uf = address(uint160(0x4000));
            _depositWithHash(uf, 10_000e6, keccak256(abi.encode("fillC", 49)));
            bytes32 bid = keccak256(abi.encode("fillBetC", 49));
            _lockBet(bid, uf, 7_500e6, matchFill, MarketType.X12, 0, 0, 1000);
        }

        vm.prank(admin);
        vm.expectRevert(InsufficientLiquidity.selector);
        pool.lockCreditBet(CREDIT, COLLAT, user1, 400e6, MATCH_CREDIT, MarketType.X12, 0, 0, 1500);
    }
}
