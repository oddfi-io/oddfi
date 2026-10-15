// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/core/BettingPool.sol";
import "../src/core/interfaces/IBettingPool.sol";
import "../src/shared/types/BetTypes.sol";
import "../src/shared/constants/Constants.sol";
import "../src/shared/errors/Errors.sol";
import "./helpers/MockUSDT.sol";

/// @notice BSC mainnet fork integration tests — full end-to-end flows.
/// @dev Fork RPC: https://bnb-mainnet.g.alchemy.com/v2/VGUSp96-0jeuW75frxJJl
contract BettingPoolForkTest is Test {
    MockUSDT internal usdt;
    BettingPool internal pool;

    address internal admin;
    address internal multisig;
    address internal user1;
    address internal user2;
    address internal user3;
    address internal user4;
    address internal user5;
    address internal lp1;
    address internal lp2;

    bytes32 constant MATCH_A = keccak256("fork-matchA");
    bytes32 constant MATCH_B = keccak256("fork-matchB");
    bytes32 constant MATCH_C = keccak256("fork-matchC");

    string constant BSC_RPC = "https://bnb-mainnet.g.alchemy.com/v2/VGUSp96-0jeuW75frxJJl";
    uint256 constant BNB_FUND = 100 ether;
    uint256 constant LP_AMOUNT = 500_000e6; // $500k liquidity
    uint256 constant STAKE = 1_000e6; // $1k per bet

    function setUp() public {
        vm.createSelectFork(BSC_RPC);

        // Generate 5 test accounts and fund each with 100 BNB
        admin = makeAddr("fork-admin");
        multisig = makeAddr("fork-multisig");
        user1 = makeAddr("fork-user1");
        user2 = makeAddr("fork-user2");
        user3 = makeAddr("fork-user3");
        user4 = makeAddr("fork-user4");
        user5 = makeAddr("fork-user5");
        lp1 = makeAddr("fork-lp1");
        lp2 = makeAddr("fork-lp2");

        vm.deal(user1, BNB_FUND);
        vm.deal(user2, BNB_FUND);
        vm.deal(user3, BNB_FUND);
        vm.deal(user4, BNB_FUND);
        vm.deal(user5, BNB_FUND);
        vm.deal(admin, BNB_FUND);
        vm.deal(multisig, BNB_FUND);
        vm.deal(lp1, BNB_FUND);
        vm.deal(lp2, BNB_FUND);

        // Deploy mock USDT (6 decimals)
        usdt = new MockUSDT();

        // Deploy BettingPool via UUPS proxy
        BettingPool impl = new BettingPool();
        bytes memory initData = abi.encodeCall(BettingPool.initialize, (address(usdt), admin, multisig));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        pool = BettingPool(address(proxy));

        // Verify deployment
        assertEq(pool.admin(), admin);
        assertEq(pool.multisig(), multisig);
        assertEq(address(pool.usdt()), address(usdt));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. 权限全流程 — Permission flows
    // ─────────────────────────────────────────────────────────────────────────

    function test_fork_permission_onlyAdmin_enforced() public {
        // Non-admin cannot call admin functions
        vm.prank(user1);
        vm.expectRevert(Unauthorized.selector);
        pool.openMarket(MATCH_A, MarketType.X12, 0);

        // Non-admin cannot creditDeposit
        usdt.mint(address(pool), 1000e6);
        vm.prank(user1);
        vm.expectRevert(Unauthorized.selector);
        pool.creditDeposit(user1, 1000e6, keccak256("tx1"));
    }

    function test_fork_permission_onlyMultisig_enforced() public {
        _addLiquidity(lp1, LP_AMOUNT);
        _openAndCloseMarket(MATCH_A, MarketType.X12, 0);

        // Non-multisig cannot settle
        bytes32[] memory betIds = new bytes32[](0);
        vm.prank(admin);
        vm.expectRevert(Unauthorized.selector);
        pool.settle(MATCH_A, MarketType.X12, 0, 0, betIds);

        // Non-multisig cannot pause
        vm.prank(admin);
        vm.expectRevert(Unauthorized.selector);
        pool.pause();
    }

    function test_fork_permission_setAdmin_multisigOnly() public {
        address newAdmin = makeAddr("newAdmin");

        // Only multisig can change admin
        vm.prank(admin);
        vm.expectRevert(Unauthorized.selector);
        pool.setAdmin(newAdmin);

        vm.prank(multisig);
        pool.setAdmin(newAdmin);
        assertEq(pool.admin(), newAdmin);
    }

    function test_fork_permission_setLpShareBps_range() public {
        // Valid range
        vm.prank(multisig);
        pool.setLpShareBps(8000);
        assertEq(pool.lpShareBps(), 8000);

        // Out of range
        vm.prank(multisig);
        vm.expectRevert(InvalidLpShareBps.selector);
        pool.setLpShareBps(4999);

        vm.prank(multisig);
        vm.expectRevert(InvalidLpShareBps.selector);
        pool.setLpShareBps(9001);
    }

    function test_fork_permission_pause_unpause() public {
        vm.prank(multisig);
        pool.pause();
        assertTrue(pool.paused());

        // Paused: creditDeposit blocked
        usdt.mint(address(pool), 1000e6);
        vm.prank(admin);
        vm.expectRevert();
        pool.creditDeposit(user1, 1000e6, keccak256("tx-paused"));

        vm.prank(multisig);
        pool.unpause();
        assertFalse(pool.paused());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. 提现充值全流程 — Deposit / withdrawal lifecycle
    // ─────────────────────────────────────────────────────────────────────────

    function test_fork_deposit_and_small_withdrawal() public {
        uint256 amount = 2_000e6;
        _deposit(user1, amount);
        assertEq(pool.userBalances(user1), amount);
        assertEq(pool.totalUserBalances(), amount);

        // Withdraw small amount (≤ $5k)
        uint256 before = usdt.balanceOf(user1);
        vm.prank(user1);
        pool.withdraw(amount);
        assertEq(usdt.balanceOf(user1), before + amount);
        assertEq(pool.userBalances(user1), 0);
        assertEq(pool.totalUserBalances(), 0);
    }

    function test_fork_deposit_dedup_txHash() public {
        bytes32 txHash = keccak256("fork-tx-dedup");
        usdt.mint(address(pool), 1000e6);
        vm.prank(admin);
        pool.creditDeposit(user1, 1000e6, txHash);

        // Duplicate txHash must revert
        usdt.mint(address(pool), 1000e6);
        vm.prank(admin);
        vm.expectRevert();
        pool.creditDeposit(user1, 1000e6, txHash);
    }

    function test_fork_large_withdrawal_full_flow() public {
        uint256 amount = 10_000e6; // > $5k threshold
        _deposit(user2, amount);

        // Submit large withdrawal request
        vm.prank(user2);
        pool.withdraw(amount);
        assertEq(pool.userBalances(user2), 0); // deducted immediately
        assertEq(pool.totalPendingWithdrawals(), amount);

        // Compute requestId
        bytes32 requestId = keccak256(abi.encode(user2, uint256(0)));

        // Cannot execute before delay
        vm.prank(user2);
        vm.expectRevert(WithdrawalNotReady.selector);
        pool.executeLargeWithdrawal(requestId);

        // Warp past delay
        vm.warp(block.timestamp + WITHDRAWAL_DELAY + 1);

        uint256 before = usdt.balanceOf(user2);
        vm.prank(user2);
        pool.executeLargeWithdrawal(requestId);
        assertEq(usdt.balanceOf(user2), before + amount);
        assertEq(pool.totalPendingWithdrawals(), 0);
    }

    function test_fork_large_withdrawal_rejected() public {
        uint256 amount = 10_000e6;
        _deposit(user3, amount);

        vm.prank(user3);
        pool.withdraw(amount);
        bytes32 requestId = keccak256(abi.encode(user3, uint256(0)));

        // Admin rejects within delay window
        vm.prank(admin);
        pool.rejectLargeWithdrawal(requestId);

        // Balance should be restored
        assertEq(pool.userBalances(user3), amount);
        assertEq(pool.totalPendingWithdrawals(), 0);

        // Execute should now fail (rejected)
        vm.warp(block.timestamp + WITHDRAWAL_DELAY + 1);
        vm.prank(user3);
        vm.expectRevert(WithdrawalAlreadyProcessed.selector);
        pool.executeLargeWithdrawal(requestId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. LP全流程 — Liquidity provider lifecycle
    // ─────────────────────────────────────────────────────────────────────────

    function test_fork_lp_addAndRemove() public {
        uint256 amount = LP_AMOUNT;
        _addLiquidity(lp1, amount);

        assertEq(pool.bettingPool(), amount);
        assertEq(pool.totalLpShares(), amount); // first LP: shares = amount
        assertEq(pool.lpShares(lp1), amount);

        // Second LP adds
        _addLiquidity(lp2, amount);
        assertEq(pool.bettingPool(), 2 * amount);

        // lp1 removes all shares
        uint256 sharesBefore = pool.lpShares(lp1);
        uint256 balBefore = usdt.balanceOf(lp1);
        vm.prank(lp1);
        pool.removeLiquidity(sharesBefore);
        assertEq(usdt.balanceOf(lp1), balBefore + amount);
        assertEq(pool.lpShares(lp1), 0);
    }

    function test_fork_lp_belowMin_reverts() public {
        usdt.mint(lp1, MIN_LP_DEPOSIT - 1);
        vm.startPrank(lp1);
        usdt.approve(address(pool), MIN_LP_DEPOSIT - 1);
        vm.expectRevert();
        pool.addLiquidity(MIN_LP_DEPOSIT - 1);
        vm.stopPrank();
    }

    function test_fork_lp_removeLiquidity_antiSqueezeProtection() public {
        _addLiquidity(lp1, LP_AMOUNT);
        _openMarket(MATCH_A, MarketType.X12, 0);
        _deposit(user1, 20_000e6);

        // Lock a large bet to use up pool
        bytes32 betId = keccak256("fork-large-bet");
        vm.prank(admin);
        pool.lockBet(betId, user1, 10_000e6, MATCH_A, MarketType.X12, 0, 0, 1500);

        // LP tries to remove more than available — should revert
        uint256 poolAvailable = pool.bettingPool() - pool.totalPotentialPayout() - pool.totalFrozenPayouts();
        uint256 lp1Shares = pool.lpShares(lp1);
        uint256 lp1Value = (lp1Shares * pool.bettingPool()) / pool.totalLpShares();

        if (lp1Value > poolAvailable) {
            vm.prank(lp1);
            vm.expectRevert(InsufficientLiquidity.selector);
            pool.removeLiquidity(lp1Shares);
        }
    }

    function test_fork_lp_withdrawPlatform() public {
        _addLiquidity(lp1, LP_AMOUNT);
        _openMarket(MATCH_A, MarketType.X12, 0);
        _deposit(user1, 5_000e6);

        // user1 loses a bet → platform balance accumulates
        bytes32 betId = keccak256("fork-platform-bet");
        vm.prank(admin);
        pool.lockBet(betId, user1, STAKE, MATCH_A, MarketType.X12, 0, 0, 1818);

        _closeMarket(MATCH_A, MarketType.X12, 0);
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = betId;
        vm.prank(multisig);
        pool.settle(MATCH_A, MarketType.X12, 0, 1, ids); // outcome=1 → user1 loses

        uint256 platBal = pool.platformBalance();
        assertTrue(platBal > 0);

        address treasury = makeAddr("treasury");
        vm.prank(multisig);
        pool.withdrawPlatform(treasury, platBal);
        assertEq(usdt.balanceOf(treasury), platBal);
        assertEq(pool.platformBalance(), 0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. 赛事全流程 / 盘口全流程 — Match & market lifecycle
    // ─────────────────────────────────────────────────────────────────────────

    function test_fork_market_lifecycle_full() public {
        // Open
        vm.prank(admin);
        pool.openMarket(MATCH_A, MarketType.X12, 0);

        bytes32 key = keccak256(abi.encode(MATCH_A, MarketType.X12, uint8(0)));
        assertEq(uint8(pool.marketStatus(key)), uint8(MarketStatus.Open));

        // Close
        vm.prank(admin);
        pool.closeMarket(MATCH_A, MarketType.X12, 0);
        assertEq(uint8(pool.marketStatus(key)), uint8(MarketStatus.Closed));

        // Reopen (multisig)
        vm.prank(multisig);
        pool.reopenMarket(MATCH_A, MarketType.X12, 0);
        assertEq(uint8(pool.marketStatus(key)), uint8(MarketStatus.Open));

        // Close again and settle
        _addLiquidity(lp1, LP_AMOUNT);
        vm.prank(admin);
        pool.closeMarket(MATCH_A, MarketType.X12, 0);
        bytes32[] memory emptyIds = new bytes32[](0);
        vm.prank(multisig);
        pool.settle(MATCH_A, MarketType.X12, 0, 0, emptyIds);
        assertEq(uint8(pool.marketStatus(key)), uint8(MarketStatus.Settled));
    }

    function test_fork_batchOpenClose_markets() public {
        MarketType[] memory markets = new MarketType[](3);
        uint8[] memory lines = new uint8[](3);
        markets[0] = MarketType.X12;
        markets[1] = MarketType.AH;
        markets[2] = MarketType.OU;
        lines[0] = 0;
        lines[1] = 0;
        lines[2] = 0;

        vm.prank(admin);
        pool.batchOpenMarkets(MATCH_A, markets, lines);

        vm.prank(admin);
        pool.batchCloseMarkets(MATCH_A, markets, lines);

        bytes32 keyX12 = keccak256(abi.encode(MATCH_A, MarketType.X12, uint8(0)));
        bytes32 keyAH = keccak256(abi.encode(MATCH_A, MarketType.AH, uint8(0)));
        assertEq(uint8(pool.marketStatus(keyX12)), uint8(MarketStatus.Closed));
        assertEq(uint8(pool.marketStatus(keyAH)), uint8(MarketStatus.Closed));
    }

    function test_fork_cancelMatch_full_flow() public {
        _addLiquidity(lp1, LP_AMOUNT);
        _openMarket(MATCH_B, MarketType.X12, 0);
        _deposit(user1, 5_000e6);
        _deposit(user2, 5_000e6);

        bytes32 bet1 = keccak256("fork-cancel-bet1");
        bytes32 bet2 = keccak256("fork-cancel-bet2");
        vm.prank(admin);
        pool.lockBet(bet1, user1, STAKE, MATCH_B, MarketType.X12, 0, 0, 1818);
        vm.prank(admin);
        pool.lockBet(bet2, user2, STAKE, MATCH_B, MarketType.X12, 1, 0, 2000);

        uint256 u1BalBefore = pool.userBalances(user1);
        uint256 u2BalBefore = pool.userBalances(user2);

        bytes32[] memory ids = new bytes32[](2);
        ids[0] = bet1;
        ids[1] = bet2;
        vm.prank(multisig);
        pool.cancelMatch(MATCH_B, MarketType.X12, 0, ids);

        // Both bets refunded (locked balance released)
        assertEq(pool.lockedBalances(user1), 0);
        assertEq(pool.lockedBalances(user2), 0);
        assertEq(pool.userBalances(user1), u1BalBefore);
        assertEq(pool.userBalances(user2), u2BalBefore);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. 下注全流程 — Betting lifecycle (lock → settle win/lose)
    // ─────────────────────────────────────────────────────────────────────────

    function test_fork_bet_win_full_flow() public {
        _addLiquidity(lp1, LP_AMOUNT);
        _openMarket(MATCH_A, MarketType.X12, 0);
        _deposit(user1, 10_000e6);

        bytes32 betId = keccak256("fork-win-bet");
        uint256 odds = 1818;
        vm.prank(admin);
        pool.lockBet(betId, user1, STAKE, MATCH_A, MarketType.X12, 0, 0, odds);

        uint256 balBefore = pool.userBalances(user1);
        uint256 poolBefore = pool.bettingPool();

        _closeMarket(MATCH_A, MarketType.X12, 0);
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = betId;
        vm.prank(multisig);
        pool.settle(MATCH_A, MarketType.X12, 0, 0, ids); // outcome=0 → user1 wins

        uint256 payout = (STAKE * odds) / 1000;
        uint256 profit = payout - STAKE;
        assertEq(pool.userBalances(user1), balBefore + profit);
        assertEq(pool.lockedBalances(user1), 0);
        assertEq(pool.bettingPool(), poolBefore - profit);

        // Check bet status
        (,,,,,, , BetStatus status,,,,) = pool.bets(betId);
        assertEq(uint8(status), uint8(BetStatus.Won));
    }

    function test_fork_bet_lose_full_flow() public {
        _addLiquidity(lp1, LP_AMOUNT);
        _openMarket(MATCH_A, MarketType.X12, 0);
        _deposit(user1, 10_000e6);

        bytes32 betId = keccak256("fork-lose-bet");
        uint256 odds = 1818;
        vm.prank(admin);
        pool.lockBet(betId, user1, STAKE, MATCH_A, MarketType.X12, 0, 0, odds);

        uint256 balBefore = pool.userBalances(user1);
        uint256 poolBefore = pool.bettingPool();

        _closeMarket(MATCH_A, MarketType.X12, 0);
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = betId;
        vm.prank(multisig);
        pool.settle(MATCH_A, MarketType.X12, 0, 1, ids); // outcome=1 → user1 loses

        assertEq(pool.userBalances(user1), balBefore - STAKE);
        assertEq(pool.lockedBalances(user1), 0);
        uint256 lpShare = (STAKE * pool.lpShareBps()) / 10000;
        assertEq(pool.bettingPool(), poolBefore + lpShare);
        assertTrue(pool.platformBalance() > 0);

        (,,,,,, , BetStatus status,,,,) = pool.bets(betId);
        assertEq(uint8(status), uint8(BetStatus.Lost));
    }

    function test_fork_bet_multiple_users_settle_batch() public {
        _addLiquidity(lp1, LP_AMOUNT);
        _openMarket(MATCH_A, MarketType.X12, 0);
        _deposit(user1, 5_000e6);
        _deposit(user2, 5_000e6);
        _deposit(user3, 5_000e6);
        _deposit(user4, 5_000e6);
        _deposit(user5, 5_000e6);

        bytes32[] memory betIds = new bytes32[](5);
        for (uint256 i = 0; i < 5; i++) {
            betIds[i] = keccak256(abi.encode("fork-multi-bet", i));
            address user = [user1, user2, user3, user4, user5][i];
            vm.prank(admin);
            pool.lockBet(betIds[i], user, STAKE, MATCH_A, MarketType.X12, uint8(i % 3), 0, 1818);
        }

        _closeMarket(MATCH_A, MarketType.X12, 0);
        vm.prank(multisig);
        pool.settle(MATCH_A, MarketType.X12, 0, 0, betIds); // outcome 0 wins

        // user1 (outcome=0) won, user2 (outcome=1) lost, user3 (outcome=2) lost
        (,,,,,, , BetStatus s1,,,,) = pool.bets(betIds[0]);
        (,,,,,, , BetStatus s2,,,,) = pool.bets(betIds[1]);
        assertEq(uint8(s1), uint8(BetStatus.Won));
        assertEq(uint8(s2), uint8(BetStatus.Lost));
    }

    function test_fork_bet_winningOutcome_invalidRange_reverts() public {
        _addLiquidity(lp1, LP_AMOUNT);
        _openAndCloseMarket(MATCH_A, MarketType.X12, 0);

        bytes32[] memory ids = new bytes32[](0);
        // X12 only allows 0-2
        vm.prank(multisig);
        vm.expectRevert();
        pool.settle(MATCH_A, MarketType.X12, 0, 3, ids);

        // AH only allows 0-1
        _openAndCloseMarket(MATCH_B, MarketType.AH, 0);
        vm.prank(multisig);
        vm.expectRevert();
        pool.settle(MATCH_B, MarketType.AH, 0, 2, ids);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. 串关全流程 — Parlay lifecycle
    // ─────────────────────────────────────────────────────────────────────────

    function test_fork_parlay_allLegsWin() public {
        _addLiquidity(lp1, LP_AMOUNT);
        _openMarket(MATCH_A, MarketType.X12, 0);
        _openMarket(MATCH_B, MarketType.X12, 0);
        _deposit(user1, 10_000e6);

        bytes32 parlayId = keccak256("fork-parlay-win");
        bytes32[] memory matchIds = new bytes32[](2);
        MarketType[] memory markets = new MarketType[](2);
        uint8[] memory outcomes = new uint8[](2);
        uint8[] memory lines = new uint8[](2);
        uint256[] memory legOdds = new uint256[](2);
        bytes32[] memory legBetIds = new bytes32[](2);

        matchIds[0] = MATCH_A;
        matchIds[1] = MATCH_B;
        markets[0] = MarketType.X12;
        markets[1] = MarketType.X12;
        outcomes[0] = 0;
        outcomes[1] = 0;
        lines[0] = 0;
        lines[1] = 0;
        legOdds[0] = 1800;
        legOdds[1] = 2000;
        legBetIds[0] = keccak256("fork-parlay-leg1");
        legBetIds[1] = keccak256("fork-parlay-leg2");

        vm.prank(admin);
        pool.lockParlay(parlayId, user1, STAKE, matchIds, markets, outcomes, lines, legOdds, legBetIds);

        uint256 combinedOdds = (1800 * 2000) / 1000; // 3600
        uint256 expectedPayout = (STAKE * combinedOdds) / 1000;

        uint256 balBefore = pool.userBalances(user1);

        // Settle leg 1 win
        _closeMarket(MATCH_A, MarketType.X12, 0);
        bytes32[] memory leg1Ids = new bytes32[](1);
        leg1Ids[0] = legBetIds[0];
        vm.prank(multisig);
        pool.settle(MATCH_A, MarketType.X12, 0, 0, leg1Ids);

        // Settle leg 2 win → parlay wins
        _closeMarket(MATCH_B, MarketType.X12, 0);
        bytes32[] memory leg2Ids = new bytes32[](1);
        leg2Ids[0] = legBetIds[1];
        vm.prank(multisig);
        pool.settle(MATCH_B, MarketType.X12, 0, 0, leg2Ids);

        uint256 profit = expectedPayout - STAKE;
        assertEq(pool.userBalances(user1), balBefore + profit);
        assertEq(pool.lockedBalances(user1), 0);

        (,,,,BetStatus parlayStatus,,,) = pool.parlays(parlayId);
        assertEq(uint8(parlayStatus), uint8(BetStatus.Won));
    }

    function test_fork_parlay_oneLegLoses() public {
        _addLiquidity(lp1, LP_AMOUNT);
        _openMarket(MATCH_A, MarketType.X12, 0);
        _openMarket(MATCH_B, MarketType.X12, 0);
        _deposit(user1, 10_000e6);

        bytes32 parlayId = keccak256("fork-parlay-lose");
        bytes32[] memory matchIds = new bytes32[](2);
        MarketType[] memory markets = new MarketType[](2);
        uint8[] memory outcomes = new uint8[](2);
        uint8[] memory lines = new uint8[](2);
        uint256[] memory legOdds = new uint256[](2);
        bytes32[] memory legBetIds = new bytes32[](2);

        matchIds[0] = MATCH_A;
        matchIds[1] = MATCH_B;
        markets[0] = MarketType.X12;
        markets[1] = MarketType.X12;
        outcomes[0] = 0;
        outcomes[1] = 0;
        lines[0] = 0;
        lines[1] = 0;
        legOdds[0] = 1800;
        legOdds[1] = 2000;
        legBetIds[0] = keccak256("fork-parlay-lose-leg1");
        legBetIds[1] = keccak256("fork-parlay-lose-leg2");

        vm.prank(admin);
        pool.lockParlay(parlayId, user1, STAKE, matchIds, markets, outcomes, lines, legOdds, legBetIds);

        uint256 balBefore = pool.userBalances(user1);

        // Settle leg 1 lose → parlay immediately lost
        _closeMarket(MATCH_A, MarketType.X12, 0);
        bytes32[] memory leg1Ids = new bytes32[](1);
        leg1Ids[0] = legBetIds[0];
        vm.prank(multisig);
        pool.settle(MATCH_A, MarketType.X12, 0, 1, leg1Ids); // outcome=1, user bet=0 → leg lost

        assertEq(pool.userBalances(user1), balBefore - STAKE);
        assertEq(pool.lockedBalances(user1), 0);

        (,,,,BetStatus parlayStatus,,,) = pool.parlays(parlayId);
        assertEq(uint8(parlayStatus), uint8(BetStatus.Lost));

        // Remaining leg should be Cancelled
        (,,,,,, , BetStatus leg2Status,,,,) = pool.bets(legBetIds[1]);
        assertEq(uint8(leg2Status), uint8(BetStatus.Cancelled));
    }

    function test_fork_parlay_cancelLeg_autoSettle() public {
        _addLiquidity(lp1, LP_AMOUNT);
        _openMarket(MATCH_A, MarketType.X12, 0);
        _openMarket(MATCH_B, MarketType.X12, 0);
        _deposit(user1, 10_000e6);

        bytes32 parlayId = keccak256("fork-parlay-autosettle");
        bytes32[] memory matchIds = new bytes32[](2);
        MarketType[] memory markets = new MarketType[](2);
        uint8[] memory outcomes = new uint8[](2);
        uint8[] memory lines = new uint8[](2);
        uint256[] memory legOdds = new uint256[](2);
        bytes32[] memory legBetIds = new bytes32[](2);

        matchIds[0] = MATCH_A;
        matchIds[1] = MATCH_B;
        markets[0] = MarketType.X12;
        markets[1] = MarketType.X12;
        outcomes[0] = 0;
        outcomes[1] = 0;
        lines[0] = 0;
        lines[1] = 0;
        legOdds[0] = 1800;
        legOdds[1] = 2000;
        legBetIds[0] = keccak256("fork-autosettle-leg1");
        legBetIds[1] = keccak256("fork-autosettle-leg2");

        vm.prank(admin);
        pool.lockParlay(parlayId, user1, STAKE, matchIds, markets, outcomes, lines, legOdds, legBetIds);

        // Settle leg 1 won
        _closeMarket(MATCH_A, MarketType.X12, 0);
        bytes32[] memory l1 = new bytes32[](1);
        l1[0] = legBetIds[0];
        vm.prank(multisig);
        pool.settle(MATCH_A, MarketType.X12, 0, 0, l1);

        uint256 balBefore = pool.userBalances(user1);

        // Cancel leg 2 → parlay auto-settles as Won (wonLegs + cancelledLegs == total)
        bytes32[] memory l2 = new bytes32[](1);
        l2[0] = legBetIds[1];
        vm.prank(multisig);
        pool.cancelMatch(MATCH_B, MarketType.X12, 0, l2);

        // Parlay should auto-settle as Won with reduced odds (just leg1 odds)
        (,,,,BetStatus parlayStatus,,,) = pool.parlays(parlayId);
        assertEq(uint8(parlayStatus), uint8(BetStatus.Won));
        // User balance should have increased
        assertTrue(pool.userBalances(user1) > balBefore);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. 信用仓位全流程 — Credit bet lifecycle
    // ─────────────────────────────────────────────────────────────────────────

    function test_fork_creditBet_collateralWon_creditWon() public {
        _addLiquidity(lp1, LP_AMOUNT);
        _openMarket(MATCH_A, MarketType.X12, 0);
        _openMarket(MATCH_B, MarketType.X12, 0);
        _deposit(user1, 10_000e6);

        // Lock collateral bet
        bytes32 collBetId = keccak256("fork-coll-bet");
        vm.prank(admin);
        pool.lockBet(collBetId, user1, 4_000e6, MATCH_A, MarketType.X12, 0, 0, 1818);

        // Lock credit bet (up to 50% of collateral = $2k)
        bytes32 creditBetId = keccak256("fork-credit-bet");
        vm.prank(admin);
        pool.lockCreditBet(creditBetId, collBetId, user1, 2_000e6, MATCH_B, MarketType.X12, 0, 0, 1500);

        // Settle collateral bet → Won
        _closeMarket(MATCH_A, MarketType.X12, 0);
        bytes32[] memory c = new bytes32[](1);
        c[0] = collBetId;
        vm.prank(multisig);
        pool.settle(MATCH_A, MarketType.X12, 0, 0, c);

        // Settle credit bet → Won (collateral Won)
        _closeMarket(MATCH_B, MarketType.X12, 0);
        bytes32[] memory cr = new bytes32[](1);
        cr[0] = creditBetId;
        vm.prank(multisig);
        pool.settle(MATCH_B, MarketType.X12, 0, 0, cr);

        // User gets net payout = credit payout - deduction (credit principal)
        (,,,,,, , BetStatus status,,,,) = pool.bets(creditBetId);
        assertEq(uint8(status), uint8(BetStatus.Won));
    }

    function test_fork_creditBet_frozen_then_released() public {
        _addLiquidity(lp1, LP_AMOUNT);
        _openMarket(MATCH_A, MarketType.X12, 0);
        _openMarket(MATCH_B, MarketType.X12, 0);
        _deposit(user1, 10_000e6);

        bytes32 collBetId = keccak256("fork-frozen-coll");
        vm.prank(admin);
        pool.lockBet(collBetId, user1, 4_000e6, MATCH_A, MarketType.X12, 0, 0, 1818);

        bytes32 creditBetId = keccak256("fork-frozen-credit");
        vm.prank(admin);
        pool.lockCreditBet(creditBetId, collBetId, user1, 2_000e6, MATCH_B, MarketType.X12, 0, 0, 1500);

        // Settle credit bet FIRST (collateral still Pending → frozen)
        _closeMarket(MATCH_B, MarketType.X12, 0);
        bytes32[] memory cr = new bytes32[](1);
        cr[0] = creditBetId;
        vm.prank(multisig);
        pool.settle(MATCH_B, MarketType.X12, 0, 0, cr); // credit wins, collateral still pending

        uint256 frozen = pool.frozenPayouts(creditBetId);
        assertTrue(frozen > 0);
        assertTrue(pool.totalFrozenPayouts() > 0);

        // Settle collateral → Won → release frozen payout
        _closeMarket(MATCH_A, MarketType.X12, 0);
        bytes32[] memory c = new bytes32[](1);
        c[0] = collBetId;
        vm.prank(multisig);
        pool.settle(MATCH_A, MarketType.X12, 0, 0, c);

        uint256 balBefore = pool.userBalances(user1);
        vm.prank(admin);
        pool.releaseOrForfeiture(creditBetId);

        assertTrue(pool.userBalances(user1) > balBefore);
        assertEq(pool.frozenPayouts(creditBetId), 0);
        assertEq(pool.totalFrozenPayouts(), 0);
    }

    function test_fork_creditBet_collateralCancelled_creditSettlesNormally() public {
        _addLiquidity(lp1, LP_AMOUNT);
        _openMarket(MATCH_A, MarketType.X12, 0);
        _openMarket(MATCH_B, MarketType.X12, 0);
        _deposit(user1, 10_000e6);

        bytes32 collBetId = keccak256("fork-coll-cancel");
        vm.prank(admin);
        pool.lockBet(collBetId, user1, 4_000e6, MATCH_A, MarketType.X12, 0, 0, 1818);

        bytes32 creditBetId = keccak256("fork-credit-coll-cancel");
        vm.prank(admin);
        pool.lockCreditBet(creditBetId, collBetId, user1, 2_000e6, MATCH_B, MarketType.X12, 0, 0, 1500);

        // Cancel the collateral bet's match
        bytes32[] memory collIds = new bytes32[](1);
        collIds[0] = collBetId;
        vm.prank(multisig);
        pool.cancelMatch(MATCH_A, MarketType.X12, 0, collIds);

        // Credit bet still lives — settle it (collateral is Cancelled → Pool bears risk)
        _closeMarket(MATCH_B, MarketType.X12, 0);
        bytes32[] memory crIds = new bytes32[](1);
        crIds[0] = creditBetId;
        vm.prank(multisig);
        pool.settle(MATCH_B, MarketType.X12, 0, 0, crIds); // credit wins

        // Status should be Won (not Cancelled)
        (,,,,,, , BetStatus status,,,,) = pool.bets(creditBetId);
        assertEq(uint8(status), uint8(BetStatus.Won));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 8. 会计不变量验证 — Accounting invariant
    // ─────────────────────────────────────────────────────────────────────────

    function test_fork_accounting_invariant_after_full_cycle() public {
        _addLiquidity(lp1, LP_AMOUNT);
        _openMarket(MATCH_A, MarketType.X12, 0);
        _deposit(user1, 5_000e6);
        _deposit(user2, 5_000e6);
        _deposit(user3, 5_000e6);

        bytes32 b1 = keccak256("fork-inv-b1");
        bytes32 b2 = keccak256("fork-inv-b2");
        bytes32 b3 = keccak256("fork-inv-b3");
        vm.prank(admin);
        pool.lockBet(b1, user1, STAKE, MATCH_A, MarketType.X12, 0, 0, 1818);
        vm.prank(admin);
        pool.lockBet(b2, user2, STAKE, MATCH_A, MarketType.X12, 1, 0, 2000);
        vm.prank(admin);
        pool.lockBet(b3, user3, STAKE, MATCH_A, MarketType.X12, 2, 0, 1500);

        _closeMarket(MATCH_A, MarketType.X12, 0);
        bytes32[] memory ids = new bytes32[](3);
        ids[0] = b1;
        ids[1] = b2;
        ids[2] = b3;
        vm.prank(multisig);
        pool.settle(MATCH_A, MarketType.X12, 0, 0, ids);

        _assertAccountingInvariant();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    function _deposit(address user, uint256 amount) internal {
        bytes32 txHash = keccak256(abi.encode(user, amount, block.timestamp, block.number));
        usdt.mint(address(pool), amount);
        vm.prank(admin);
        pool.creditDeposit(user, amount, txHash);
    }

    function _addLiquidity(address provider, uint256 amount) internal {
        usdt.mint(provider, amount);
        vm.startPrank(provider);
        usdt.approve(address(pool), amount);
        pool.addLiquidity(amount);
        vm.stopPrank();
    }

    function _openMarket(bytes32 matchId, MarketType market, uint8 line) internal {
        vm.prank(admin);
        pool.openMarket(matchId, market, line);
    }

    function _closeMarket(bytes32 matchId, MarketType market, uint8 line) internal {
        vm.prank(admin);
        pool.closeMarket(matchId, market, line);
    }

    function _openAndCloseMarket(bytes32 matchId, MarketType market, uint8 line) internal {
        _openMarket(matchId, market, line);
        _closeMarket(matchId, market, line);
    }

    function _assertAccountingInvariant() internal view {
        uint256 contractBalance = usdt.balanceOf(address(pool));
        uint256 accounted = pool.totalUserBalances() + pool.bettingPool() + pool.platformBalance()
            + pool.totalPendingWithdrawals() + pool.totalCreditOutstanding();
        assertEq(contractBalance, accounted, "accounting invariant violated");
    }
}
