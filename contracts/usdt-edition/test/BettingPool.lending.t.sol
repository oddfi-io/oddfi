// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./helpers/BettingPoolTestBase.sol";

/// @notice Tests for credit/lending flows (lockCreditBet + all 8 settlement paths).
contract BettingPoolLendingTest is BettingPoolTestBase {
    bytes32 constant COLLAT_BET = keccak256("collat");
    bytes32 constant CREDIT_BET = keccak256("credit");

    uint256 constant LP_AMOUNT = 500_000e6;
    uint256 constant COLLAT_STAKE = 1_000e6;
    uint256 constant COLLAT_ODDS = 1818;
    // max credit = COLLAT_STAKE * 50% = 500e6
    uint256 constant CREDIT_AMOUNT = 400e6;
    uint256 constant CREDIT_ODDS = 2000;

    bytes32 constant MATCH_COLLAT = keccak256("matchCollat");
    bytes32 constant MATCH_CREDIT = keccak256("matchCredit");

    function setUp() public override {
        super.setUp();
        _addLiquidity(lp1, LP_AMOUNT);
        _deposit(user1, 10_000e6);

        vm.startPrank(admin);
        pool.openMarket(MATCH_COLLAT, MarketType.X12, 0);
        pool.openMarket(MATCH_CREDIT, MarketType.X12, 0);
        vm.stopPrank();

        // Lock the collateral bet (normal bet)
        _lockBet(COLLAT_BET, user1, COLLAT_STAKE, MATCH_COLLAT, MarketType.X12, 0, 0, COLLAT_ODDS);
    }

    // ── lockCreditBet basic ───────────────────────────────────────────────────

    function test_lockCreditBet_normal() public {
        vm.prank(admin);
        pool.lockCreditBet(CREDIT_BET, COLLAT_BET, user1, CREDIT_AMOUNT, MATCH_CREDIT, MarketType.X12, 0, 0, CREDIT_ODDS);

        (address u, uint256 amt,,,,,, BetStatus status, bool isCredit, bytes32 collatId,,) = pool.bets(CREDIT_BET);
        assertEq(u, user1);
        assertEq(amt, CREDIT_AMOUNT);
        assertEq(uint8(status), uint8(BetStatus.Pending));
        assertTrue(isCredit);
        assertEq(collatId, COLLAT_BET);

        // bettingPool reduced by credit amount
        assertEq(pool.totalCreditOutstanding(), CREDIT_AMOUNT);
        assertEq(pool.collateralUsed(COLLAT_BET), CREDIT_AMOUNT);
    }

    function test_lockCreditBet_emitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit IBettingPool.CreditBetLocked(CREDIT_BET, COLLAT_BET, user1, CREDIT_AMOUNT);
        vm.prank(admin);
        pool.lockCreditBet(CREDIT_BET, COLLAT_BET, user1, CREDIT_AMOUNT, MATCH_CREDIT, MarketType.X12, 0, 0, CREDIT_ODDS);
    }

    function test_lockCreditBet_creditLimitExceeded_reverts() public {
        // max credit = 50% of 1000e6 = 500e6; try 600e6
        vm.prank(admin);
        vm.expectRevert(CreditLimitExceeded.selector);
        pool.lockCreditBet(CREDIT_BET, COLLAT_BET, user1, 600e6, MATCH_CREDIT, MarketType.X12, 0, 0, CREDIT_ODDS);
    }

    function test_lockCreditBet_chainForbidden_reverts() public {
        // Credit bet against a credit bet (chain)
        vm.prank(admin);
        pool.lockCreditBet(CREDIT_BET, COLLAT_BET, user1, CREDIT_AMOUNT, MATCH_CREDIT, MarketType.X12, 0, 0, CREDIT_ODDS);

        bytes32 CHAIN_BET = keccak256("chain");
        bytes32 MATCH_CHAIN = keccak256("matchChain");
        vm.prank(admin);
        pool.openMarket(MATCH_CHAIN, MarketType.X12, 0);

        vm.prank(admin);
        vm.expectRevert(CreditChainForbidden.selector);
        pool.lockCreditBet(CHAIN_BET, CREDIT_BET, user1, 100e6, MATCH_CHAIN, MarketType.X12, 0, 0, CREDIT_ODDS);
    }

    function test_lockCreditBet_parlayNotCollateralizable_reverts() public {
        // Setup a parlay and try to use it as collateral
        bytes32 PARLAY1 = keccak256("parlay1");
        bytes32 LEG_A = keccak256("legA");
        bytes32 LEG_B = keccak256("legB");
        bytes32 MATCH_P1 = keccak256("mp1");
        bytes32 MATCH_P2 = keccak256("mp2");

        _deposit(user2, 10_000e6);
        vm.startPrank(admin);
        pool.openMarket(MATCH_P1, MarketType.X12, 0);
        pool.openMarket(MATCH_P2, MarketType.X12, 0);
        vm.stopPrank();

        bytes32[] memory mIds = new bytes32[](2);
        mIds[0] = MATCH_P1;
        mIds[1] = MATCH_P2;
        MarketType[] memory mts = new MarketType[](2);
        mts[0] = MarketType.X12;
        mts[1] = MarketType.X12;
        uint8[] memory outs = new uint8[](2);
        uint8[] memory lns = new uint8[](2);
        uint256[] memory odds = new uint256[](2);
        odds[0] = 1500;
        odds[1] = 1500;
        bytes32[] memory legIds = new bytes32[](2);
        legIds[0] = LEG_A;
        legIds[1] = LEG_B;

        vm.prank(admin);
        pool.lockParlay(PARLAY1, user2, 1_000e6, mIds, mts, outs, lns, odds, legIds);

        // Now try to use a parlay leg as collateral
        bytes32 MATCH_CR = keccak256("matchCr2");
        vm.prank(admin);
        pool.openMarket(MATCH_CR, MarketType.X12, 0);

        vm.prank(admin);
        vm.expectRevert(ParlayNotCollateralizable.selector);
        pool.lockCreditBet(keccak256("cr2"), LEG_A, user2, 100e6, MATCH_CR, MarketType.X12, 0, 0, CREDIT_ODDS);
    }

    function test_lockCreditBet_collateralWrongUser_reverts() public {
        vm.prank(admin);
        vm.expectRevert(Unauthorized.selector);
        // user2 trying to borrow against user1's collateral
        pool.lockCreditBet(CREDIT_BET, COLLAT_BET, user2, CREDIT_AMOUNT, MATCH_CREDIT, MarketType.X12, 0, 0, CREDIT_ODDS);
    }

    // ── Settlement path: collateral Won, credit Won ───────────────────────────

    function test_settle_creditBet_collatWon_creditWon() public {
        vm.prank(admin);
        pool.lockCreditBet(CREDIT_BET, COLLAT_BET, user1, CREDIT_AMOUNT, MATCH_CREDIT, MarketType.X12, 0, 0, CREDIT_ODDS);

        // Settle collateral (Won)
        vm.prank(admin);
        pool.closeMarket(MATCH_COLLAT, MarketType.X12, 0);
        bytes32[] memory collatIds = new bytes32[](1);
        collatIds[0] = COLLAT_BET;
        _settle(MATCH_COLLAT, MarketType.X12, 0, 0, collatIds); // collat outcome=0 wins

        // Settle credit (Won, same outcome=0)
        vm.prank(admin);
        pool.closeMarket(MATCH_CREDIT, MarketType.X12, 0);
        bytes32[] memory creditIds = new bytes32[](1);
        creditIds[0] = CREDIT_BET;

        uint256 balBefore = pool.userBalances(user1);
        _settle(MATCH_CREDIT, MarketType.X12, 0, 0, creditIds);

        // potPayout = credit_amount * credit_odds / 1000 = 400*2000/1000 = 800e6
        // deduction = credit_amount = 400e6
        // netToUser = 800e6 - 400e6 = 400e6
        uint256 potPayout = (CREDIT_AMOUNT * CREDIT_ODDS) / 1000;
        uint256 netToUser = potPayout - CREDIT_AMOUNT;
        assertEq(pool.userBalances(user1), balBefore + netToUser);

        (,,,,,,, BetStatus creditStatus,,,,) = pool.bets(CREDIT_BET);
        assertEq(uint8(creditStatus), uint8(BetStatus.Won));
    }

    // ── Settlement path: collateral Won, credit Lost ──────────────────────────

    function test_settle_creditBet_collatWon_creditLost() public {
        vm.prank(admin);
        pool.lockCreditBet(CREDIT_BET, COLLAT_BET, user1, CREDIT_AMOUNT, MATCH_CREDIT, MarketType.X12, 0, 0, CREDIT_ODDS);

        vm.prank(admin);
        pool.closeMarket(MATCH_COLLAT, MarketType.X12, 0);
        bytes32[] memory collatIds = new bytes32[](1);
        collatIds[0] = COLLAT_BET;
        _settle(MATCH_COLLAT, MarketType.X12, 0, 0, collatIds);

        vm.prank(admin);
        pool.closeMarket(MATCH_CREDIT, MarketType.X12, 0);
        bytes32[] memory creditIds = new bytes32[](1);
        creditIds[0] = CREDIT_BET;
        _settle(MATCH_CREDIT, MarketType.X12, 0, 1, creditIds); // credit outcome=0, win=1 → lost

        (,,,,,,, BetStatus creditStatus,,,,) = pool.bets(CREDIT_BET);
        assertEq(uint8(creditStatus), uint8(BetStatus.Lost));
    }

    // ── Settlement path: collateral Lost, credit Won ──────────────────────────

    function test_settle_creditBet_collatLost_creditWon_forfeited() public {
        vm.prank(admin);
        pool.lockCreditBet(CREDIT_BET, COLLAT_BET, user1, CREDIT_AMOUNT, MATCH_CREDIT, MarketType.X12, 0, 0, CREDIT_ODDS);

        // Settle collateral as Lost
        vm.prank(admin);
        pool.closeMarket(MATCH_COLLAT, MarketType.X12, 0);
        bytes32[] memory collatIds = new bytes32[](1);
        collatIds[0] = COLLAT_BET;
        _settle(MATCH_COLLAT, MarketType.X12, 0, 1, collatIds); // outcome=1 wins, collat was on 0 → Lost

        vm.prank(admin);
        pool.closeMarket(MATCH_CREDIT, MarketType.X12, 0);
        bytes32[] memory creditIds = new bytes32[](1);
        creditIds[0] = CREDIT_BET;

        uint256 platBefore = pool.platformBalance();
        _settle(MATCH_CREDIT, MarketType.X12, 0, 0, creditIds); // credit wins, but collat lost → forfeit

        uint256 potPayout = (CREDIT_AMOUNT * CREDIT_ODDS) / 1000;
        assertEq(pool.platformBalance(), platBefore + potPayout);

        (,,,,,,, BetStatus creditStatus,,,,) = pool.bets(CREDIT_BET);
        assertEq(uint8(creditStatus), uint8(BetStatus.Cancelled));
    }

    // ── Settlement path: collateral Lost, credit Lost ─────────────────────────

    function test_settle_creditBet_collatLost_creditLost() public {
        vm.prank(admin);
        pool.lockCreditBet(CREDIT_BET, COLLAT_BET, user1, CREDIT_AMOUNT, MATCH_CREDIT, MarketType.X12, 0, 0, CREDIT_ODDS);

        vm.prank(admin);
        pool.closeMarket(MATCH_COLLAT, MarketType.X12, 0);
        bytes32[] memory collatIds = new bytes32[](1);
        collatIds[0] = COLLAT_BET;
        _settle(MATCH_COLLAT, MarketType.X12, 0, 1, collatIds); // collat lost

        vm.prank(admin);
        pool.closeMarket(MATCH_CREDIT, MarketType.X12, 0);
        bytes32[] memory creditIds = new bytes32[](1);
        creditIds[0] = CREDIT_BET;
        _settle(MATCH_CREDIT, MarketType.X12, 0, 1, creditIds); // credit lost too

        (,,,,,,, BetStatus creditStatus,,,,) = pool.bets(CREDIT_BET);
        assertEq(uint8(creditStatus), uint8(BetStatus.Cancelled));
    }

    // ── Settlement path: collateral Pending, credit Won → frozen payout ───────

    function test_settle_creditBet_collatPending_creditWon_frozen() public {
        vm.prank(admin);
        pool.lockCreditBet(CREDIT_BET, COLLAT_BET, user1, CREDIT_AMOUNT, MATCH_CREDIT, MarketType.X12, 0, 0, CREDIT_ODDS);

        // Settle credit BEFORE collateral
        vm.prank(admin);
        pool.closeMarket(MATCH_CREDIT, MarketType.X12, 0);
        bytes32[] memory creditIds = new bytes32[](1);
        creditIds[0] = CREDIT_BET;
        _settle(MATCH_CREDIT, MarketType.X12, 0, 0, creditIds); // credit wins, collat still Pending

        uint256 potPayout = (CREDIT_AMOUNT * CREDIT_ODDS) / 1000;
        assertEq(pool.frozenPayouts(CREDIT_BET), potPayout);
        assertEq(pool.totalFrozenPayouts(), potPayout);

        (,,,,,,, BetStatus creditStatus,,,,) = pool.bets(CREDIT_BET);
        assertEq(uint8(creditStatus), uint8(BetStatus.Won));
    }

    // ── Settlement path: collateral Pending, credit Lost ─────────────────────

    function test_settle_creditBet_collatPending_creditLost() public {
        vm.prank(admin);
        pool.lockCreditBet(CREDIT_BET, COLLAT_BET, user1, CREDIT_AMOUNT, MATCH_CREDIT, MarketType.X12, 0, 0, CREDIT_ODDS);

        vm.prank(admin);
        pool.closeMarket(MATCH_CREDIT, MarketType.X12, 0);
        bytes32[] memory creditIds = new bytes32[](1);
        creditIds[0] = CREDIT_BET;
        _settle(MATCH_CREDIT, MarketType.X12, 0, 1, creditIds); // credit lost

        assertEq(pool.frozenPayouts(CREDIT_BET), 0);
        (,,,,,,, BetStatus creditStatus,,,,) = pool.bets(CREDIT_BET);
        assertEq(uint8(creditStatus), uint8(BetStatus.Lost));
    }

    // ── Settlement path: collateral Cancelled, credit Won ────────────────────

    function test_settle_creditBet_collatCancelled_creditWon_poolBears() public {
        vm.prank(admin);
        pool.lockCreditBet(CREDIT_BET, COLLAT_BET, user1, CREDIT_AMOUNT, MATCH_CREDIT, MarketType.X12, 0, 0, CREDIT_ODDS);

        // Cancel collateral
        vm.prank(multisig);
        bytes32[] memory collatIds = new bytes32[](1);
        collatIds[0] = COLLAT_BET;
        pool.cancelMatch(MATCH_COLLAT, MarketType.X12, 0, collatIds);

        // Settle credit as Won
        vm.prank(admin);
        pool.closeMarket(MATCH_CREDIT, MarketType.X12, 0);
        bytes32[] memory creditIds = new bytes32[](1);
        creditIds[0] = CREDIT_BET;

        uint256 balBefore = pool.userBalances(user1);
        _settle(MATCH_CREDIT, MarketType.X12, 0, 0, creditIds);

        uint256 potPayout = (CREDIT_AMOUNT * CREDIT_ODDS) / 1000;
        assertEq(pool.userBalances(user1), balBefore + potPayout);
    }

    // ── Settlement path: collateral Cancelled, credit Lost ───────────────────

    function test_settle_creditBet_collatCancelled_creditLost() public {
        vm.prank(admin);
        pool.lockCreditBet(CREDIT_BET, COLLAT_BET, user1, CREDIT_AMOUNT, MATCH_CREDIT, MarketType.X12, 0, 0, CREDIT_ODDS);

        vm.prank(multisig);
        bytes32[] memory collatIds = new bytes32[](1);
        collatIds[0] = COLLAT_BET;
        pool.cancelMatch(MATCH_COLLAT, MarketType.X12, 0, collatIds);

        vm.prank(admin);
        pool.closeMarket(MATCH_CREDIT, MarketType.X12, 0);
        bytes32[] memory creditIds = new bytes32[](1);
        creditIds[0] = CREDIT_BET;
        _settle(MATCH_CREDIT, MarketType.X12, 0, 1, creditIds);

        (,,,,,,, BetStatus creditStatus,,,,) = pool.bets(CREDIT_BET);
        assertEq(uint8(creditStatus), uint8(BetStatus.Lost));
    }

    // ── releaseOrForfeiture ───────────────────────────────────────────────────

    function _setupFrozenPayout() internal returns (uint256 frozen) {
        vm.prank(admin);
        pool.lockCreditBet(CREDIT_BET, COLLAT_BET, user1, CREDIT_AMOUNT, MATCH_CREDIT, MarketType.X12, 0, 0, CREDIT_ODDS);

        // Credit wins while collateral is still pending
        vm.prank(admin);
        pool.closeMarket(MATCH_CREDIT, MarketType.X12, 0);
        bytes32[] memory creditIds = new bytes32[](1);
        creditIds[0] = CREDIT_BET;
        _settle(MATCH_CREDIT, MarketType.X12, 0, 0, creditIds);

        frozen = pool.frozenPayouts(CREDIT_BET);
    }

    function test_releaseOrForfeiture_collatWon_release() public {
        uint256 frozen = _setupFrozenPayout();

        // Now settle collateral as Won
        vm.prank(admin);
        pool.closeMarket(MATCH_COLLAT, MarketType.X12, 0);
        bytes32[] memory collatIds = new bytes32[](1);
        collatIds[0] = COLLAT_BET;
        _settle(MATCH_COLLAT, MarketType.X12, 0, 0, collatIds);

        uint256 balBefore = pool.userBalances(user1);
        vm.prank(admin);
        pool.releaseOrForfeiture(CREDIT_BET);

        uint256 netPayout = frozen - CREDIT_AMOUNT;
        assertEq(pool.userBalances(user1), balBefore + netPayout);
        assertEq(pool.frozenPayouts(CREDIT_BET), 0);
        assertEq(pool.totalFrozenPayouts(), 0);
    }

    function test_releaseOrForfeiture_collatLost_forfeit() public {
        uint256 frozen = _setupFrozenPayout();

        // Settle collateral as Lost
        vm.prank(admin);
        pool.closeMarket(MATCH_COLLAT, MarketType.X12, 0);
        bytes32[] memory collatIds = new bytes32[](1);
        collatIds[0] = COLLAT_BET;
        _settle(MATCH_COLLAT, MarketType.X12, 0, 1, collatIds);

        uint256 platBefore = pool.platformBalance();
        vm.prank(admin);
        pool.releaseOrForfeiture(CREDIT_BET);

        assertEq(pool.platformBalance(), platBefore + frozen);
        assertEq(pool.frozenPayouts(CREDIT_BET), 0);
    }

    function test_releaseOrForfeiture_collatCancelled_fullRelease() public {
        uint256 frozen = _setupFrozenPayout();

        // Cancel collateral
        vm.prank(multisig);
        bytes32[] memory collatIds = new bytes32[](1);
        collatIds[0] = COLLAT_BET;
        pool.cancelMatch(MATCH_COLLAT, MarketType.X12, 0, collatIds);

        uint256 balBefore = pool.userBalances(user1);
        vm.prank(admin);
        pool.releaseOrForfeiture(CREDIT_BET);

        assertEq(pool.userBalances(user1), balBefore + frozen);
        assertEq(pool.frozenPayouts(CREDIT_BET), 0);
    }

    function test_releaseOrForfeiture_noFrozen_reverts() public {
        vm.prank(admin);
        vm.expectRevert(FrozenPayoutNotFound.selector);
        pool.releaseOrForfeiture(CREDIT_BET);
    }
}
