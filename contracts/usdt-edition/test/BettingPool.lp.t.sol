// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./helpers/BettingPoolTestBase.sol";

contract BettingPoolLpTest is BettingPoolTestBase {
    uint256 constant FIRST_DEPOSIT = 10_000e6;
    uint256 constant SECOND_DEPOSIT = 5_000e6;

    function setUp() public override {
        super.setUp();
    }

    // ── addLiquidity ──────────────────────────────────────────────────────────

    function test_addLiquidity_firstDeposit_sharesEqualAmount() public {
        _addLiquidity(lp1, FIRST_DEPOSIT);

        // First deposit: shares = amount (LiquidityLib: totalLpShares == 0 → shares = amount)
        assertEq(pool.lpShares(lp1), FIRST_DEPOSIT);
        assertEq(pool.totalLpShares(), FIRST_DEPOSIT);
        assertEq(pool.bettingPool(), FIRST_DEPOSIT);
    }

    function test_addLiquidity_emitsEvent() public {
        usdt.mint(lp1, FIRST_DEPOSIT);
        vm.startPrank(lp1);
        usdt.approve(address(pool), FIRST_DEPOSIT);
        vm.expectEmit(true, false, false, true);
        emit IBettingPool.LiquidityAdded(lp1, FIRST_DEPOSIT, FIRST_DEPOSIT);
        pool.addLiquidity(FIRST_DEPOSIT);
        vm.stopPrank();
    }

    function test_addLiquidity_subsequentDeposit_sharesProportion() public {
        _addLiquidity(lp1, FIRST_DEPOSIT);
        // Pool = 10_000, shares = 10_000

        _addLiquidity(lp2, SECOND_DEPOSIT);
        // shares = amount * totalLpShares / bettingPool = 5_000 * 10_000 / 10_000 = 5_000
        assertEq(pool.lpShares(lp2), SECOND_DEPOSIT);
        assertEq(pool.totalLpShares(), FIRST_DEPOSIT + SECOND_DEPOSIT);
        assertEq(pool.bettingPool(), FIRST_DEPOSIT + SECOND_DEPOSIT);
    }

    function test_addLiquidity_belowMinDeposit_reverts() public {
        // MIN_LP_DEPOSIT = 1_000e6
        usdt.mint(lp1, 999e6);
        vm.startPrank(lp1);
        usdt.approve(address(pool), 999e6);
        vm.expectRevert("below min deposit");
        pool.addLiquidity(999e6);
        vm.stopPrank();
    }

    function test_addLiquidity_exactMinDeposit_succeeds() public {
        _addLiquidity(lp1, 1_000e6);
        assertEq(pool.bettingPool(), 1_000e6);
    }

    function test_addLiquidity_transfersUSDT() public {
        uint256 balBefore = usdt.balanceOf(lp1);
        _addLiquidity(lp1, FIRST_DEPOSIT);
        // _addLiquidity mints to lp1 then transfers — so balance stays same since we minted inside helper
        assertEq(usdt.balanceOf(address(pool)), FIRST_DEPOSIT);
    }

    // ── removeLiquidity ───────────────────────────────────────────────────────

    function test_removeLiquidity_normal() public {
        _addLiquidity(lp1, FIRST_DEPOSIT);
        uint256 shares = pool.lpShares(lp1);

        vm.prank(lp1);
        pool.removeLiquidity(shares);

        assertEq(pool.lpShares(lp1), 0);
        assertEq(pool.totalLpShares(), 0);
        assertEq(pool.bettingPool(), 0);
        assertEq(usdt.balanceOf(lp1), FIRST_DEPOSIT);
    }

    function test_removeLiquidity_emitsEvent() public {
        _addLiquidity(lp1, FIRST_DEPOSIT);
        uint256 shares = pool.lpShares(lp1);

        vm.expectEmit(true, false, false, true);
        emit IBettingPool.LiquidityRemoved(lp1, FIRST_DEPOSIT, shares);
        vm.prank(lp1);
        pool.removeLiquidity(shares);
    }

    function test_removeLiquidity_partial() public {
        _addLiquidity(lp1, FIRST_DEPOSIT);
        uint256 halfShares = pool.lpShares(lp1) / 2;

        vm.prank(lp1);
        pool.removeLiquidity(halfShares);

        // LP gets half the pool back
        assertEq(usdt.balanceOf(lp1), FIRST_DEPOSIT / 2);
        assertEq(pool.bettingPool(), FIRST_DEPOSIT / 2);
    }

    function test_removeLiquidity_insufficientLiquidity_reverts() public {
        _addLiquidity(lp1, FIRST_DEPOSIT);

        // Lock a bet that ties up almost all liquidity
        _openMarket(MATCH_A, MarketType.X12, 0);
        _deposit(user1, 10_000e6);
        // lockBet at 1x odds: payout = amount = 9_000e6; pool = 10_000e6; available = 10_000-9_000 = 1_000
        _lockBet(keccak256("bet1"), user1, 9_000e6, MATCH_A, MarketType.X12, 0, 0, 1000);

        // Now try to remove all liquidity — only 1_000e6 available but we need more
        uint256 shares = pool.lpShares(lp1);
        vm.prank(lp1);
        vm.expectRevert(InsufficientLiquidity.selector);
        pool.removeLiquidity(shares);
    }

    // ── share calculation accuracy ────────────────────────────────────────────

    function test_shareCalculation_afterProfitAccrues() public {
        _addLiquidity(lp1, 10_000e6);
        // shares = 10_000

        // Simulate pool gaining value (losing bet — LP gains)
        _openMarket(MATCH_A, MarketType.X12, 0);
        _deposit(user1, 10_000e6);
        bytes32 betId = keccak256("bet1");
        _lockBet(betId, user1, 1_000e6, MATCH_A, MarketType.X12, 0, 0, 1000);
        _closeMarket(MATCH_A, MarketType.X12, 0);

        bytes32[] memory ids = new bytes32[](1);
        ids[0] = betId;
        _settle(MATCH_A, MarketType.X12, 0, 1, ids); // user loses → LP gains 70%

        uint256 lpGain = (1_000e6 * 7000) / 10000; // 700e6
        // Pool is now 10_000 + 700 = 10_700e6; totalLpShares = 10_000

        // New LP adds 10_700e6: shares = 10_700 * 10_000 / 10_700 = 10_000
        _addLiquidity(lp2, 10_700e6);
        assertEq(pool.lpShares(lp2), 10_000e6);

        // Total pool = 21_400; total shares = 20_000
        // lp1 can remove 10_000 shares → gets 10_000 * 21_400 / 20_000 = 10_700e6
        uint256 sharesBefore = pool.lpShares(lp1);
        vm.prank(lp1);
        pool.removeLiquidity(sharesBefore);
        assertEq(usdt.balanceOf(lp1), 10_000e6 + lpGain); // 10_700e6
    }

    function test_multipleLPs_fairShare() public {
        _addLiquidity(lp1, 10_000e6);
        _addLiquidity(lp2, 10_000e6);

        assertEq(pool.lpShares(lp1), pool.lpShares(lp2));
        assertEq(pool.totalLpShares(), 20_000e6);
        assertEq(pool.bettingPool(), 20_000e6);
    }
}
