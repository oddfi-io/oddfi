// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../../src/core/BettingPool.sol";
import "../../src/shared/types/BetTypes.sol";
import "../../src/shared/constants/Constants.sol";
import "../../src/shared/errors/Errors.sol";
import "./MockUSDT.sol";

/// @notice Base test contract. Deploy proxy + helpers used by all test files.
abstract contract BettingPoolTestBase is Test {
    MockUSDT internal usdt;
    BettingPool internal pool;

    address internal admin = makeAddr("admin");
    address internal multisig = makeAddr("multisig");
    address internal user1 = makeAddr("user1");
    address internal user2 = makeAddr("user2");
    address internal user3 = makeAddr("user3");
    address internal user4 = makeAddr("user4");
    address internal user5 = makeAddr("user5");
    address internal lp1 = makeAddr("lp1");
    address internal lp2 = makeAddr("lp2");

    // Common market params
    bytes32 internal constant MATCH_A = keccak256("matchA");
    bytes32 internal constant MATCH_B = keccak256("matchB");
    bytes32 internal constant MATCH_C = keccak256("matchC");

    function setUp() public virtual {
        usdt = new MockUSDT();

        BettingPool impl = new BettingPool();
        bytes memory initData = abi.encodeCall(BettingPool.initialize, (address(usdt), admin, multisig));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        pool = BettingPool(address(proxy));
    }

    // ── Deposit helper ────────────────────────────────────────────────────────

    function _deposit(address user, uint256 amount) internal {
        bytes32 txHash = keccak256(abi.encode(user, amount, block.timestamp));
        usdt.mint(address(pool), amount);
        vm.prank(admin);
        pool.creditDeposit(user, amount, txHash);
    }

    function _depositWithHash(address user, uint256 amount, bytes32 txHash) internal {
        usdt.mint(address(pool), amount);
        vm.prank(admin);
        pool.creditDeposit(user, amount, txHash);
    }

    // ── LP helper ─────────────────────────────────────────────────────────────

    function _addLiquidity(address provider, uint256 amount) internal {
        usdt.mint(provider, amount);
        vm.startPrank(provider);
        usdt.approve(address(pool), amount);
        pool.addLiquidity(amount);
        vm.stopPrank();
    }

    // ── Market helpers ────────────────────────────────────────────────────────

    function _openMarket(bytes32 matchId, MarketType market, uint8 line) internal {
        vm.prank(admin);
        pool.openMarket(matchId, market, line);
    }

    function _closeMarket(bytes32 matchId, MarketType market, uint8 line) internal {
        vm.prank(admin);
        pool.closeMarket(matchId, market, line);
    }

    // ── Bet helpers ───────────────────────────────────────────────────────────

    function _lockBet(
        bytes32 betId,
        address user,
        uint256 amount,
        bytes32 matchId,
        MarketType market,
        uint8 outcome,
        uint8 line,
        uint256 odds
    ) internal {
        vm.prank(admin);
        pool.lockBet(betId, user, amount, matchId, market, outcome, line, odds);
    }

    function _settle(bytes32 matchId, MarketType market, uint8 line, uint8 winningOutcome, bytes32[] memory betIds)
        internal
    {
        vm.prank(multisig);
        pool.settle(matchId, market, line, winningOutcome, betIds);
    }

    // ── Common setup: open market + add enough LP ─────────────────────────────

    function _setupMarketWithLiquidity(bytes32 matchId, MarketType market, uint8 line, uint256 lpAmount) internal {
        _addLiquidity(lp1, lpAmount);
        _openMarket(matchId, market, line);
    }
}
