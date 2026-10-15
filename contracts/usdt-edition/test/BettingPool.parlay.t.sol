// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./helpers/BettingPoolTestBase.sol";

contract BettingPoolParlayTest is BettingPoolTestBase {
    bytes32 constant PARLAY1 = keccak256("parlay1");
    bytes32 constant LEG_A = keccak256("legA");
    bytes32 constant LEG_B = keccak256("legB");
    bytes32 constant LEG_C = keccak256("legC");
    bytes32 constant LEG_D = keccak256("legD");
    bytes32 constant LEG_E = keccak256("legE");
    bytes32 constant LEG_F = keccak256("legF");

    uint256 constant LP_AMOUNT = 500_000e6;
    uint256 constant STAKE = 1_000e6;
    uint256 constant LEG_ODDS = 1500; // 1.5x each leg

    // Matches for parlay legs (must be unique)
    bytes32 constant MATCH_1 = keccak256("m1");
    bytes32 constant MATCH_2 = keccak256("m2");
    bytes32 constant MATCH_3 = keccak256("m3");
    bytes32 constant MATCH_4 = keccak256("m4");
    bytes32 constant MATCH_5 = keccak256("m5");
    bytes32 constant MATCH_6 = keccak256("m6");

    // Parlay getter field order (legBetIds[] is skipped by auto-getter):
    // 0: address user, 1: uint256 stake, 2: uint256 combinedOdds,
    // 3: uint256 maxPayout, 4: BetStatus status,
    // 5: uint8 settledLegs, 6: uint8 wonLegs, 7: uint8 cancelledLegs

    function setUp() public override {
        super.setUp();
        _addLiquidity(lp1, LP_AMOUNT);
        _deposit(user1, 50_000e6);

        // Open markets for all match+line combos
        vm.startPrank(admin);
        pool.openMarket(MATCH_1, MarketType.X12, 0);
        pool.openMarket(MATCH_2, MarketType.X12, 0);
        pool.openMarket(MATCH_3, MarketType.X12, 0);
        pool.openMarket(MATCH_4, MarketType.X12, 0);
        pool.openMarket(MATCH_5, MarketType.X12, 0);
        pool.openMarket(MATCH_6, MarketType.X12, 0);
        vm.stopPrank();
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    function _lock2LegParlay(bytes32 parlayId, bytes32 legA, bytes32 legB) internal {
        bytes32[] memory mIds = new bytes32[](2);
        mIds[0] = MATCH_1;
        mIds[1] = MATCH_2;

        MarketType[] memory mts = new MarketType[](2);
        mts[0] = MarketType.X12;
        mts[1] = MarketType.X12;

        uint8[] memory outs = new uint8[](2);
        outs[0] = 0;
        outs[1] = 0;

        uint8[] memory lns = new uint8[](2);
        lns[0] = 0;
        lns[1] = 0;

        uint256[] memory odds = new uint256[](2);
        odds[0] = LEG_ODDS;
        odds[1] = LEG_ODDS;

        bytes32[] memory legIds = new bytes32[](2);
        legIds[0] = legA;
        legIds[1] = legB;

        vm.prank(admin);
        pool.lockParlay(parlayId, user1, STAKE, mIds, mts, outs, lns, odds, legIds);
    }

    function _lock6LegParlay(bytes32 parlayId) internal {
        bytes32[] memory mIds = new bytes32[](6);
        mIds[0] = MATCH_1;
        mIds[1] = MATCH_2;
        mIds[2] = MATCH_3;
        mIds[3] = MATCH_4;
        mIds[4] = MATCH_5;
        mIds[5] = MATCH_6;

        MarketType[] memory mts = new MarketType[](6);
        uint8[] memory outs = new uint8[](6);
        uint8[] memory lns = new uint8[](6);
        uint256[] memory odds = new uint256[](6);
        bytes32[] memory legIds = new bytes32[](6);
        for (uint256 i = 0; i < 6; i++) {
            mts[i] = MarketType.X12;
            outs[i] = 0;
            lns[i] = 0;
            odds[i] = LEG_ODDS;
        }
        legIds[0] = LEG_A;
        legIds[1] = LEG_B;
        legIds[2] = LEG_C;
        legIds[3] = LEG_D;
        legIds[4] = LEG_E;
        legIds[5] = LEG_F;

        vm.prank(admin);
        pool.lockParlay(parlayId, user1, STAKE, mIds, mts, outs, lns, odds, legIds);
    }

    /// @dev Get parlay status (field 4 of 8-field getter, skipping legBetIds)
    function _parlayStatus(bytes32 parlayId) internal view returns (BetStatus) {
        (,,,, BetStatus status,,,) = pool.parlays(parlayId);
        return status;
    }

    /// @dev Get parlay cancelledLegs count (field 7 of 8-field getter)
    function _parlayCancelledLegs(bytes32 parlayId) internal view returns (uint8) {
        (,,,,,,, uint8 cancelledLegs) = pool.parlays(parlayId);
        return cancelledLegs;
    }

    /// @dev Get parlay combinedOdds (field 2 of 8-field getter)
    function _parlayCombinedOdds(bytes32 parlayId) internal view returns (uint256) {
        (,, uint256 combinedOdds,,,,,) = pool.parlays(parlayId);
        return combinedOdds;
    }

    // ── lockParlay ────────────────────────────────────────────────────────────

    function test_lockParlay_2legs() public {
        _lock2LegParlay(PARLAY1, LEG_A, LEG_B);

        (address u, uint256 stake, uint256 combinedOdds, uint256 maxPayout, BetStatus status,,,) =
            pool.parlays(PARLAY1);
        assertEq(u, user1);
        assertEq(stake, STAKE);
        assertEq(combinedOdds, (LEG_ODDS * LEG_ODDS) / 1000); // 2250
        assertEq(maxPayout, (STAKE * combinedOdds) / 1000);
        assertEq(uint8(status), uint8(BetStatus.Pending));
        assertEq(pool.lockedBalances(user1), STAKE);
        assertEq(pool.totalPotentialPayout(), maxPayout);
    }

    function test_lockParlay_6legs() public {
        // Use 100e6 stake so 6-leg payout stays under MAX_PARLAY_PAYOUT (10_000e6)
        // combinedOdds ≈ 1500^6/1000^5 = 11390; maxPayout = 100e6 * 11390/1000 = 1139e6 ✓
        bytes32[] memory mIds = new bytes32[](6);
        mIds[0] = MATCH_1; mIds[1] = MATCH_2; mIds[2] = MATCH_3;
        mIds[3] = MATCH_4; mIds[4] = MATCH_5; mIds[5] = MATCH_6;
        MarketType[] memory mts = new MarketType[](6);
        uint8[] memory outs = new uint8[](6);
        uint8[] memory lns = new uint8[](6);
        uint256[] memory odds = new uint256[](6);
        bytes32[] memory legIds = new bytes32[](6);
        legIds[0] = LEG_A; legIds[1] = LEG_B; legIds[2] = LEG_C;
        legIds[3] = LEG_D; legIds[4] = LEG_E; legIds[5] = LEG_F;
        for (uint256 i = 0; i < 6; i++) {
            mts[i] = MarketType.X12;
            odds[i] = LEG_ODDS;
        }
        vm.prank(admin);
        pool.lockParlay(PARLAY1, user1, 100e6, mIds, mts, outs, lns, odds, legIds);

        bytes32[] memory legs = pool.getParlayLegs(PARLAY1);
        assertEq(legs.length, 6);
    }

    function test_lockParlay_emitsEvent() public {
        bytes32[] memory mIds = new bytes32[](2);
        mIds[0] = MATCH_1;
        mIds[1] = MATCH_2;
        MarketType[] memory mts = new MarketType[](2);
        mts[0] = MarketType.X12;
        mts[1] = MarketType.X12;
        uint8[] memory outs = new uint8[](2);
        uint8[] memory lns = new uint8[](2);
        uint256[] memory odds = new uint256[](2);
        odds[0] = LEG_ODDS;
        odds[1] = LEG_ODDS;
        bytes32[] memory legIds = new bytes32[](2);
        legIds[0] = LEG_A;
        legIds[1] = LEG_B;

        vm.prank(admin);
        vm.expectEmit(true, true, false, false);
        emit IBettingPool.ParlayLocked(PARLAY1, user1, STAKE, 2, 0, legIds);
        pool.lockParlay(PARLAY1, user1, STAKE, mIds, mts, outs, lns, odds, legIds);
    }

    function test_lockParlay_zeroStake_reverts() public {
        bytes32[] memory mIds = new bytes32[](2);
        mIds[0] = MATCH_1;
        mIds[1] = MATCH_2;
        MarketType[] memory mts = new MarketType[](2);
        mts[0] = MarketType.X12;
        mts[1] = MarketType.X12;
        uint8[] memory outs = new uint8[](2);
        uint8[] memory lns = new uint8[](2);
        uint256[] memory odds = new uint256[](2);
        odds[0] = LEG_ODDS;
        odds[1] = LEG_ODDS;
        bytes32[] memory legIds = new bytes32[](2);
        legIds[0] = LEG_A;
        legIds[1] = LEG_B;
        vm.prank(admin);
        vm.expectRevert(ZeroAmount.selector);
        pool.lockParlay(PARLAY1, user1, 0, mIds, mts, outs, lns, odds, legIds);
    }

    function test_lockParlay_tooFewLegs_reverts() public {
        bytes32[] memory mIds = new bytes32[](1);
        mIds[0] = MATCH_1;
        MarketType[] memory mts = new MarketType[](1);
        mts[0] = MarketType.X12;
        uint8[] memory outs = new uint8[](1);
        uint8[] memory lns = new uint8[](1);
        uint256[] memory odds = new uint256[](1);
        odds[0] = LEG_ODDS;
        bytes32[] memory legIds = new bytes32[](1);
        legIds[0] = LEG_A;
        vm.prank(admin);
        vm.expectRevert(InvalidParlayLegs.selector);
        pool.lockParlay(PARLAY1, user1, STAKE, mIds, mts, outs, lns, odds, legIds);
    }

    function test_lockParlay_tooManyLegs_reverts() public {
        bytes32[] memory mIds = new bytes32[](7);
        MarketType[] memory mts = new MarketType[](7);
        uint8[] memory outs = new uint8[](7);
        uint8[] memory lns = new uint8[](7);
        uint256[] memory odds = new uint256[](7);
        bytes32[] memory legIds = new bytes32[](7);
        bytes32[7] memory matches =
            [MATCH_1, MATCH_2, MATCH_3, MATCH_4, MATCH_5, MATCH_6, keccak256("m7")];
        for (uint256 i = 0; i < 7; i++) {
            mIds[i] = matches[i];
            mts[i] = MarketType.X12;
            odds[i] = LEG_ODDS;
            legIds[i] = keccak256(abi.encode("leg", i));
        }
        vm.prank(admin);
        vm.expectRevert(InvalidParlayLegs.selector);
        pool.lockParlay(PARLAY1, user1, STAKE, mIds, mts, outs, lns, odds, legIds);
    }

    function test_lockParlay_duplicateMatch_reverts() public {
        bytes32[] memory mIds = new bytes32[](2);
        mIds[0] = MATCH_1;
        mIds[1] = MATCH_1; // duplicate!
        MarketType[] memory mts = new MarketType[](2);
        mts[0] = MarketType.X12;
        mts[1] = MarketType.X12;
        uint8[] memory outs = new uint8[](2);
        uint8[] memory lns = new uint8[](2);
        uint256[] memory odds = new uint256[](2);
        odds[0] = LEG_ODDS;
        odds[1] = LEG_ODDS;
        bytes32[] memory legIds = new bytes32[](2);
        legIds[0] = LEG_A;
        legIds[1] = LEG_B;
        vm.prank(admin);
        vm.expectRevert(DuplicateMatchInParlay.selector);
        pool.lockParlay(PARLAY1, user1, STAKE, mIds, mts, outs, lns, odds, legIds);
    }

    function test_lockParlay_payoutExceeded_reverts() public {
        // combinedOdds = 1500*1500/1000 = 2250; stake=5_000e6 → maxPayout = 11_250e6 > 10_000e6
        bytes32[] memory mIds = new bytes32[](2);
        mIds[0] = MATCH_1;
        mIds[1] = MATCH_2;
        MarketType[] memory mts = new MarketType[](2);
        mts[0] = MarketType.X12;
        mts[1] = MarketType.X12;
        uint8[] memory outs = new uint8[](2);
        uint8[] memory lns = new uint8[](2);
        uint256[] memory odds = new uint256[](2);
        odds[0] = LEG_ODDS;
        odds[1] = LEG_ODDS;
        bytes32[] memory legIds = new bytes32[](2);
        legIds[0] = LEG_A;
        legIds[1] = LEG_B;
        vm.prank(admin);
        vm.expectRevert(ParlayPayoutExceeded.selector);
        pool.lockParlay(PARLAY1, user1, 5_000e6, mIds, mts, outs, lns, odds, legIds);
    }

    function test_lockParlay_duplicateParlayId_reverts() public {
        _lock2LegParlay(PARLAY1, LEG_A, LEG_B);

        bytes32[] memory mIds = new bytes32[](2);
        mIds[0] = MATCH_3;
        mIds[1] = MATCH_4;
        MarketType[] memory mts = new MarketType[](2);
        mts[0] = MarketType.X12;
        mts[1] = MarketType.X12;
        uint8[] memory outs = new uint8[](2);
        uint8[] memory lns = new uint8[](2);
        uint256[] memory odds = new uint256[](2);
        odds[0] = LEG_ODDS;
        odds[1] = LEG_ODDS;
        bytes32[] memory legIds = new bytes32[](2);
        legIds[0] = LEG_C;
        legIds[1] = LEG_D;
        vm.prank(admin);
        vm.expectRevert(ParlayIdAlreadyExists.selector);
        pool.lockParlay(PARLAY1, user1, STAKE, mIds, mts, outs, lns, odds, legIds);
    }

    // ── settle parlay — all win ───────────────────────────────────────────────

    function test_settle_parlay_allLegsWin() public {
        _lock2LegParlay(PARLAY1, LEG_A, LEG_B);
        uint256 combinedOdds = (LEG_ODDS * LEG_ODDS) / 1000; // 2250
        uint256 maxPayout = (STAKE * combinedOdds) / 1000;

        vm.prank(admin);
        pool.closeMarket(MATCH_1, MarketType.X12, 0);
        bytes32[] memory ids1 = new bytes32[](1);
        ids1[0] = LEG_A;
        _settle(MATCH_1, MarketType.X12, 0, 0, ids1); // outcome 0 wins

        vm.prank(admin);
        pool.closeMarket(MATCH_2, MarketType.X12, 0);
        bytes32[] memory ids2 = new bytes32[](1);
        ids2[0] = LEG_B;

        uint256 balBefore = pool.userBalances(user1);
        _settle(MATCH_2, MarketType.X12, 0, 0, ids2);

        uint256 profit = maxPayout - STAKE;
        assertEq(pool.userBalances(user1), balBefore + profit);
        assertEq(pool.lockedBalances(user1), 0);
        assertEq(uint8(_parlayStatus(PARLAY1)), uint8(BetStatus.Won));
    }

    function test_settle_parlay_emitsParlayWon() public {
        _lock2LegParlay(PARLAY1, LEG_A, LEG_B);

        vm.prank(admin);
        pool.closeMarket(MATCH_1, MarketType.X12, 0);
        bytes32[] memory ids1 = new bytes32[](1);
        ids1[0] = LEG_A;
        _settle(MATCH_1, MarketType.X12, 0, 0, ids1);

        vm.prank(admin);
        pool.closeMarket(MATCH_2, MarketType.X12, 0);
        bytes32[] memory ids2 = new bytes32[](1);
        ids2[0] = LEG_B;

        uint256 combinedOdds = (LEG_ODDS * LEG_ODDS) / 1000;
        uint256 expectedPayout = (STAKE * combinedOdds) / 1000;
        vm.expectEmit(true, true, false, true);
        emit IBettingPool.ParlayWon(PARLAY1, user1, expectedPayout);
        _settle(MATCH_2, MarketType.X12, 0, 0, ids2);
    }

    // ── settle parlay — one leg loses ────────────────────────────────────────

    function test_settle_parlay_oneLegLoses() public {
        _lock2LegParlay(PARLAY1, LEG_A, LEG_B);

        vm.prank(admin);
        pool.closeMarket(MATCH_1, MarketType.X12, 0);
        bytes32[] memory ids1 = new bytes32[](1);
        ids1[0] = LEG_A;
        _settle(MATCH_1, MarketType.X12, 0, 1, ids1); // outcome 1 wins, user bet on 0 → LEG_A lost

        assertEq(uint8(_parlayStatus(PARLAY1)), uint8(BetStatus.Lost));
        assertEq(pool.lockedBalances(user1), 0);
    }

    function test_settle_parlay_emitsParlayLost() public {
        _lock2LegParlay(PARLAY1, LEG_A, LEG_B);
        vm.prank(admin);
        pool.closeMarket(MATCH_1, MarketType.X12, 0);
        bytes32[] memory ids1 = new bytes32[](1);
        ids1[0] = LEG_A;
        vm.expectEmit(true, true, false, true);
        emit IBettingPool.ParlayLost(PARLAY1, user1, STAKE);
        _settle(MATCH_1, MarketType.X12, 0, 1, ids1);
    }

    // ── unlockParlay ──────────────────────────────────────────────────────────

    function test_unlockParlay_success() public {
        _lock2LegParlay(PARLAY1, LEG_A, LEG_B);
        vm.prank(admin);
        pool.unlockParlay(PARLAY1);

        assertEq(pool.lockedBalances(user1), 0);
        assertEq(pool.totalPotentialPayout(), 0);
        assertEq(uint8(_parlayStatus(PARLAY1)), uint8(BetStatus.Cancelled));
    }

    function test_unlockParlay_emitsEvent() public {
        _lock2LegParlay(PARLAY1, LEG_A, LEG_B);
        vm.expectEmit(true, true, false, true);
        emit IBettingPool.ParlayUnlocked(PARLAY1, user1, STAKE);
        vm.prank(admin);
        pool.unlockParlay(PARLAY1);
    }

    function test_unlockParlay_partiallySettled_reverts() public {
        _lock2LegParlay(PARLAY1, LEG_A, LEG_B);
        vm.prank(admin);
        pool.closeMarket(MATCH_1, MarketType.X12, 0);
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = LEG_A;
        _settle(MATCH_1, MarketType.X12, 0, 0, ids); // LEG_A won

        vm.prank(admin);
        vm.expectRevert(ParlayPartiallySettled.selector);
        pool.unlockParlay(PARLAY1);
    }

    function test_unlockParlay_notFound_reverts() public {
        vm.prank(admin);
        vm.expectRevert(BetNotFound.selector);
        pool.unlockParlay(PARLAY1);
    }

    // ── cancelMatch with parlay legs ──────────────────────────────────────────

    function test_cancelMatch_parlay_degradesToSingle() public {
        _lock2LegParlay(PARLAY1, LEG_A, LEG_B);

        // Cancel MATCH_1 — LEG_A cancelled, parlay degrades to single (LEG_B remains)
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = LEG_A;
        vm.prank(multisig);
        pool.cancelMatch(MATCH_1, MarketType.X12, 0, ids);

        assertEq(_parlayCancelledLegs(PARLAY1), 1);
        assertEq(_parlayCombinedOdds(PARLAY1), LEG_ODDS); // degraded to single leg odds
    }

    function test_cancelMatch_parlay_allLegs_fullRefund() public {
        _lock2LegParlay(PARLAY1, LEG_A, LEG_B);

        bytes32[] memory ids1 = new bytes32[](1);
        ids1[0] = LEG_A;
        vm.prank(multisig);
        pool.cancelMatch(MATCH_1, MarketType.X12, 0, ids1);

        bytes32[] memory ids2 = new bytes32[](1);
        ids2[0] = LEG_B;
        vm.prank(multisig);
        pool.cancelMatch(MATCH_2, MarketType.X12, 0, ids2);

        assertEq(uint8(_parlayStatus(PARLAY1)), uint8(BetStatus.Cancelled));
        assertEq(pool.lockedBalances(user1), 0);
    }

    function test_cancelMatch_parlay_autoSettleAfterCancel() public {
        // 2-leg parlay: settle LEG_A as win, then cancel LEG_B → auto-settle to win
        _lock2LegParlay(PARLAY1, LEG_A, LEG_B);

        vm.prank(admin);
        pool.closeMarket(MATCH_1, MarketType.X12, 0);
        bytes32[] memory ids1 = new bytes32[](1);
        ids1[0] = LEG_A;
        _settle(MATCH_1, MarketType.X12, 0, 0, ids1); // LEG_A won

        // Cancel LEG_B — triggers auto-settle as win (wonLegs + cancelledLegs == numLegs)
        bytes32[] memory ids2 = new bytes32[](1);
        ids2[0] = LEG_B;

        uint256 balBefore = pool.userBalances(user1);
        vm.prank(multisig);
        pool.cancelMatch(MATCH_2, MarketType.X12, 0, ids2);

        assertEq(uint8(_parlayStatus(PARLAY1)), uint8(BetStatus.Won));
        // After degrade to single, payout = stake * singleLegOdds / 1000
        uint256 payout = (STAKE * LEG_ODDS) / 1000;
        uint256 profit = payout - STAKE;
        assertEq(pool.userBalances(user1), balBefore + profit);
    }
}
