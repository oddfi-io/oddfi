// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./helpers/BettingPoolTestBase.sol";

contract BettingPoolBetTest is BettingPoolTestBase {
    bytes32 constant BET1 = keccak256("bet1");
    bytes32 constant BET2 = keccak256("bet2");
    bytes32 constant BET3 = keccak256("bet3");

    uint256 constant LP_AMOUNT = 100_000e6;
    uint256 constant STAKE = 1_000e6;
    uint256 constant ODDS = 1818; // 1.818x

    function setUp() public override {
        super.setUp();
        _addLiquidity(lp1, LP_AMOUNT);
        _openMarket(MATCH_A, MarketType.X12, 0);
        _deposit(user1, 10_000e6);
        _deposit(user2, 10_000e6);
    }

    // ── lockBet normal ────────────────────────────────────────────────────────

    function test_lockBet_normal() public {
        _lockBet(BET1, user1, STAKE, MATCH_A, MarketType.X12, 0, 0, ODDS);

        (address u, uint256 amt,,,,, uint256 lo, BetStatus status, bool isCredit,,,) = pool.bets(BET1);
        assertEq(u, user1);
        assertEq(amt, STAKE);
        assertEq(lo, ODDS);
        assertEq(uint8(status), uint8(BetStatus.Pending));
        assertFalse(isCredit);

        assertEq(pool.lockedBalances(user1), STAKE);
        uint256 potPayout = (STAKE * ODDS) / 1000;
        assertEq(pool.totalPotentialPayout(), potPayout);
    }

    function test_lockBet_emitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit IBettingPool.BetLocked(BET1, user1, STAKE, MATCH_A);
        _lockBet(BET1, user1, STAKE, MATCH_A, MarketType.X12, 0, 0, ODDS);
    }

    function test_lockBet_zeroAmount_reverts() public {
        vm.prank(admin);
        vm.expectRevert(ZeroAmount.selector);
        pool.lockBet(BET1, user1, 0, MATCH_A, MarketType.X12, 0, 0, ODDS);
    }

    function test_lockBet_invalidOdds_reverts() public {
        vm.prank(admin);
        vm.expectRevert(InvalidOdds.selector);
        pool.lockBet(BET1, user1, STAKE, MATCH_A, MarketType.X12, 0, 0, 999);
    }

    function test_lockBet_oddsExactlyPrecision_accepted() public {
        // odds == ODDS_PRECISION (1.0x) is accepted (>= check)
        _lockBet(BET1, user1, STAKE, MATCH_A, MarketType.X12, 0, 0, 1000);
    }

    function test_lockBet_marketNotOpen_reverts() public {
        _openMarket(MATCH_B, MarketType.X12, 0);
        _closeMarket(MATCH_B, MarketType.X12, 0);
        vm.prank(admin);
        vm.expectRevert(MarketNotOpen.selector);
        pool.lockBet(BET1, user1, STAKE, MATCH_B, MarketType.X12, 0, 0, ODDS);
    }

    function test_lockBet_marketNotCreated_reverts() public {
        vm.prank(admin);
        vm.expectRevert(MarketNotOpen.selector);
        pool.lockBet(BET1, user1, STAKE, MATCH_B, MarketType.X12, 0, 0, ODDS);
    }

    function test_lockBet_redLight_blocks_heavySide() public {
        vm.prank(admin);
        pool.updateSignal(MATCH_A, MarketType.X12, 0, 30_000e6, 0, SignalColor.Red);
        vm.prank(admin);
        vm.expectRevert(MarketRedLight.selector);
        pool.lockBet(BET1, user1, STAKE, MATCH_A, MarketType.X12, 0, 0, ODDS); // outcome=0 blocked
    }

    function test_lockBet_redLight_allows_otherSide() public {
        vm.prank(admin);
        pool.updateSignal(MATCH_A, MarketType.X12, 0, 30_000e6, 0, SignalColor.Red);
        // outcome=1 (not heavySide=0) should be accepted
        _lockBet(BET1, user1, STAKE, MATCH_A, MarketType.X12, 1, 0, ODDS);
    }

    function test_lockBet_insufficientBalance_reverts() public {
        vm.prank(admin);
        vm.expectRevert(InsufficientBalance.selector);
        pool.lockBet(BET1, user3, STAKE, MATCH_A, MarketType.X12, 0, 0, ODDS); // user3 has no balance
    }

    function test_lockBet_globalMaxBet_reverts() public {
        _deposit(user1, 100_000e6);
        vm.prank(admin);
        vm.expectRevert(GlobalMaxBetExceeded.selector);
        pool.lockBet(BET1, user1, 10_001e6, MATCH_A, MarketType.X12, 0, 0, ODDS);
    }

    function test_lockBet_globalMaxBet_exact_accepted() public {
        _deposit(user1, 100_000e6);
        _addLiquidity(lp2, 1_000_000e6); // ensure enough liquidity
        _lockBet(BET1, user1, 10_000e6, MATCH_A, MarketType.X12, 0, 0, 1000);
    }

    function test_lockBet_insufficientLiquidity_reverts() public {
        // LP pool = 100_000e6, but we need potPayout > available
        // Use 1.0x odds so payout == stake — fill pool nearly
        // Bet 100_000e6 would need payout 100_000e6 which equals pool
        // lockBet checks: potentialPayout > bettingPool - totalPotentialPayout - totalFrozenPayouts
        // With empty pool payout tracking, bet 99_001e6 at 1.0x odds would still fail since global max is 10k
        // Instead: lock many bets to exhaust potential payouts
        for (uint8 i = 0; i < 10; i++) {
            _deposit(address(uint160(0x1000 + i)), 10_000e6);
            bytes32 bid = keccak256(abi.encode("exhaust", i));
            _lockBet(bid, address(uint160(0x1000 + i)), 10_000e6, MATCH_A, MarketType.X12, 0, 0, 1000);
        }
        // now totalPotentialPayout = 100_000e6 = bettingPool → no room
        _deposit(user3, 10_000e6);
        vm.prank(admin);
        vm.expectRevert(InsufficientLiquidity.selector);
        pool.lockBet(BET3, user3, 1e6, MATCH_A, MarketType.X12, 0, 0, 1001);
    }

    function test_lockBet_duplicateBetId_reverts() public {
        _lockBet(BET1, user1, STAKE, MATCH_A, MarketType.X12, 0, 0, ODDS);
        vm.prank(admin);
        vm.expectRevert(BetIdAlreadyExists.selector);
        pool.lockBet(BET1, user2, STAKE, MATCH_A, MarketType.X12, 0, 0, ODDS);
    }

    // ── settle win ────────────────────────────────────────────────────────────

    function test_settle_winner_getsPayout() public {
        _lockBet(BET1, user1, STAKE, MATCH_A, MarketType.X12, 0, 0, ODDS);
        _closeMarket(MATCH_A, MarketType.X12, 0);

        uint256 balBefore = pool.userBalances(user1);
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = BET1;
        _settle(MATCH_A, MarketType.X12, 0, 0, ids); // outcome 0 wins

        uint256 potPayout = (STAKE * ODDS) / 1000;
        uint256 profit = potPayout - STAKE;
        assertEq(pool.userBalances(user1), balBefore + profit);
        assertEq(pool.lockedBalances(user1), 0);

        (,,,,,,, BetStatus status,,,,) = pool.bets(BET1);
        assertEq(uint8(status), uint8(BetStatus.Won));
    }

    function test_settle_loser_losesStake() public {
        _lockBet(BET1, user1, STAKE, MATCH_A, MarketType.X12, 0, 0, ODDS);
        _closeMarket(MATCH_A, MarketType.X12, 0);

        uint256 balBefore = pool.userBalances(user1);
        uint256 poolBefore = pool.bettingPool();
        uint256 platBefore = pool.platformBalance();

        bytes32[] memory ids = new bytes32[](1);
        ids[0] = BET1;
        _settle(MATCH_A, MarketType.X12, 0, 1, ids); // outcome 1 wins, user bet on 0

        // user lost STAKE
        assertEq(pool.userBalances(user1), balBefore - STAKE);
        assertEq(pool.lockedBalances(user1), 0);

        // LP gets 70%, platform gets 30%
        uint256 lpShare = (STAKE * 7000) / 10000;
        uint256 platShare = STAKE - lpShare;
        assertEq(pool.bettingPool(), poolBefore + lpShare);
        assertEq(pool.platformBalance(), platBefore + platShare);

        (,,,,,,, BetStatus status,,,,) = pool.bets(BET1);
        assertEq(uint8(status), uint8(BetStatus.Lost));
    }

    function test_settle_batchBets() public {
        _lockBet(BET1, user1, STAKE, MATCH_A, MarketType.X12, 0, 0, ODDS);
        _lockBet(BET2, user2, STAKE, MATCH_A, MarketType.X12, 1, 0, ODDS);
        _closeMarket(MATCH_A, MarketType.X12, 0);

        bytes32[] memory ids = new bytes32[](2);
        ids[0] = BET1;
        ids[1] = BET2;
        _settle(MATCH_A, MarketType.X12, 0, 0, ids); // outcome 0 wins

        (,,,,,,, BetStatus s1,,,,) = pool.bets(BET1);
        (,,,,,,, BetStatus s2,,,,) = pool.bets(BET2);
        assertEq(uint8(s1), uint8(BetStatus.Won));
        assertEq(uint8(s2), uint8(BetStatus.Lost));
    }

    function test_settle_batchInTwoParts_outcomeConsistent() public {
        _lockBet(BET1, user1, STAKE, MATCH_A, MarketType.X12, 0, 0, ODDS);
        _lockBet(BET2, user2, STAKE, MATCH_A, MarketType.X12, 0, 0, ODDS);
        _closeMarket(MATCH_A, MarketType.X12, 0);

        bytes32[] memory ids1 = new bytes32[](1);
        ids1[0] = BET1;
        _settle(MATCH_A, MarketType.X12, 0, 0, ids1);

        bytes32[] memory ids2 = new bytes32[](1);
        ids2[0] = BET2;
        _settle(MATCH_A, MarketType.X12, 0, 0, ids2); // same outcome — ok
    }

    function test_settle_outcomeInconsistent_reverts() public {
        _lockBet(BET1, user1, STAKE, MATCH_A, MarketType.X12, 0, 0, ODDS);
        _lockBet(BET2, user2, STAKE, MATCH_A, MarketType.X12, 0, 0, ODDS);
        _closeMarket(MATCH_A, MarketType.X12, 0);

        bytes32[] memory ids1 = new bytes32[](1);
        ids1[0] = BET1;
        _settle(MATCH_A, MarketType.X12, 0, 0, ids1);

        bytes32[] memory ids2 = new bytes32[](1);
        ids2[0] = BET2;
        vm.prank(multisig);
        vm.expectRevert(OutcomeInconsistent.selector);
        pool.settle(MATCH_A, MarketType.X12, 0, 1, ids2); // different outcome
    }

    function test_settle_alreadySettledBet_skipped() public {
        _lockBet(BET1, user1, STAKE, MATCH_A, MarketType.X12, 0, 0, ODDS);
        _closeMarket(MATCH_A, MarketType.X12, 0);

        bytes32[] memory ids = new bytes32[](1);
        ids[0] = BET1;
        _settle(MATCH_A, MarketType.X12, 0, 0, ids);

        // Settling again should not revert (bet is skipped since status != Pending)
        _settle(MATCH_A, MarketType.X12, 0, 0, ids);
    }

    function test_settle_wrongMarket_reverts() public {
        _lockBet(BET1, user1, STAKE, MATCH_A, MarketType.X12, 0, 0, ODDS);
        _closeMarket(MATCH_A, MarketType.X12, 0);
        _openMarket(MATCH_B, MarketType.X12, 0);
        _closeMarket(MATCH_B, MarketType.X12, 0);

        bytes32[] memory ids = new bytes32[](1);
        ids[0] = BET1;
        vm.prank(multisig);
        vm.expectRevert(InvalidBetForMarket.selector);
        pool.settle(MATCH_B, MarketType.X12, 0, 0, ids); // BET1 belongs to MATCH_A
    }

    function test_settle_emitsMatchSettled() public {
        _closeMarket(MATCH_A, MarketType.X12, 0);
        bytes32[] memory ids;
        vm.expectEmit(true, false, false, true);
        emit IBettingPool.MatchSettled(MATCH_A, MarketType.X12, 0, 0);
        vm.prank(multisig);
        pool.settle(MATCH_A, MarketType.X12, 0, 0, ids);
    }

    // ── unlockBet ─────────────────────────────────────────────────────────────

    function test_unlockBet_normal() public {
        _lockBet(BET1, user1, STAKE, MATCH_A, MarketType.X12, 0, 0, ODDS);
        uint256 potPayoutBefore = pool.totalPotentialPayout();

        bytes32[] memory empty;
        vm.prank(admin);
        pool.unlockBet(BET1, empty);

        assertEq(pool.lockedBalances(user1), 0);
        assertEq(pool.totalPotentialPayout(), 0);
        assertLt(pool.totalPotentialPayout(), potPayoutBefore);

        (,,,,,,, BetStatus status,,,,) = pool.bets(BET1);
        assertEq(uint8(status), uint8(BetStatus.Cancelled));
    }

    function test_unlockBet_emitsEvent() public {
        _lockBet(BET1, user1, STAKE, MATCH_A, MarketType.X12, 0, 0, ODDS);
        bytes32[] memory empty;
        vm.expectEmit(true, true, false, true);
        emit IBettingPool.BetUnlocked(BET1, user1, STAKE);
        vm.prank(admin);
        pool.unlockBet(BET1, empty);
    }

    function test_unlockBet_betNotFound_reverts() public {
        bytes32[] memory empty;
        vm.prank(admin);
        vm.expectRevert(BetNotFound.selector);
        pool.unlockBet(BET1, empty);
    }

    function test_unlockBet_alreadySettled_reverts() public {
        _lockBet(BET1, user1, STAKE, MATCH_A, MarketType.X12, 0, 0, ODDS);
        _closeMarket(MATCH_A, MarketType.X12, 0);

        bytes32[] memory ids = new bytes32[](1);
        ids[0] = BET1;
        _settle(MATCH_A, MarketType.X12, 0, 0, ids);

        bytes32[] memory empty;
        vm.prank(admin);
        vm.expectRevert(BetAlreadySettled.selector);
        pool.unlockBet(BET1, empty);
    }

    function test_unlockBet_withCreditBets() public {
        // Lock collateral bet
        _lockBet(BET1, user1, STAKE, MATCH_A, MarketType.X12, 0, 0, ODDS);
        // Lock credit bet against BET1
        _openMarket(MATCH_B, MarketType.X12, 0);
        _depositWithHash(user1, 10_000e6, keccak256("extra_deposit_for_credit"));
        uint256 creditAmount = 200e6; // within 50% of STAKE=1000
        vm.prank(admin);
        pool.lockCreditBet(BET2, BET1, user1, creditAmount, MATCH_B, MarketType.X12, 0, 0, 1500);

        bytes32[] memory creditIds = new bytes32[](1);
        creditIds[0] = BET2;
        vm.prank(admin);
        pool.unlockBet(BET1, creditIds);

        (,,,,,,, BetStatus s1,,,,) = pool.bets(BET1);
        (,,,,,,, BetStatus s2,,,,) = pool.bets(BET2);
        assertEq(uint8(s1), uint8(BetStatus.Cancelled));
        assertEq(uint8(s2), uint8(BetStatus.Cancelled));
    }
}
