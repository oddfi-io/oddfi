// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {ODDToken} from "../src/modules/token/ODDToken.sol";
import {StakingPool} from "../src/modules/staking/StakingPool.sol";
import {LiquidityPool} from "../src/modules/liquidity/LiquidityPool.sol";
import {BettingPool} from "../src/modules/betting/BettingPool.sol";
import {BettingBetModule} from "../src/modules/betting/BettingBetModule.sol";
import {BettingMarketModule} from "../src/modules/betting/BettingMarketModule.sol";
import {BettingReferralModule} from "../src/modules/betting/BettingReferralModule.sol";
import {BettingSettlementModule} from "../src/modules/betting/BettingSettlementModule.sol";
import {BettingParlayModule} from "../src/modules/betting/BettingParlayModule.sol";
import {QuoteGuardInput} from "../src/shared/types/CommonTypes.sol";
import {BetSettlementState, MarketStatus} from "../src/shared/types/MarketEnums.sol";
import {ParlayBet, ParlayLegInput, ParlayState} from "../src/shared/types/ParlayTypes.sol";
import {BetNotOwner} from "../src/shared/errors/BettingErrors.sol";
import {OddMvpTestBootstrap} from "./helpers/OddMvpTestBootstrap.sol";

contract FundsFlowMatrixTest is OddMvpTestBootstrap {
    event PayoutReserveOutstanding(bytes32 indexed matchId, uint256 outstandingAmount);

    address internal admin = address(0xA11CE);
    address internal treasury = address(0xBEEF);
    address internal user = address(0xCAFE);
    address internal user2 = address(0xCAFE2);
    address internal lpUser = address(0x1A);

    uint256 internal constant GLOBAL_LP = 100_000 ether;
    uint256 internal constant MATCH_LP = 100_000 ether;

    ODDToken internal odd;
    StakingPool internal staking;
    LiquidityPool internal liquidity;
    BettingPool internal betting;

    function setUp() public {
        vm.warp(1_000_000);

        odd = ODDToken(_proxy(address(new ODDToken()), abi.encodeCall(ODDToken.initialize, (admin, admin))));
        staking = StakingPool(
            _proxy(address(new StakingPool()), abi.encodeCall(StakingPool.initialize, (admin, address(odd), treasury)))
        );
        liquidity = LiquidityPool(
            _proxy(address(new LiquidityPool()), abi.encodeCall(LiquidityPool.initialize, (admin, address(odd), admin)))
        );
        betting = BettingPool(
            _proxy(
                address(new BettingPool()),
                abi.encodeCall(BettingPool.initialize, (admin, address(odd), address(staking), address(liquidity)))
            )
        );

        BettingSettlementModule settlement = new BettingSettlementModule();
        BettingBetModule betModule = new BettingBetModule();
        BettingParlayModule parlayModule = new BettingParlayModule();

        _bootstrapOddMvpToken(odd, admin, treasury, address(staking), address(liquidity), address(betting));

        vm.startPrank(admin);
        betting.setSettlementModule(address(settlement));
        betting.setBetModule(address(betModule));
        betting.setMarketModule(address(new BettingMarketModule()));
        betting.setReferralModule(address(new BettingReferralModule()));
        betting.setParlayModule(address(parlayModule));
        betting.initializeV2(treasury);
        staking.initializeV2(address(betting));
        liquidity.setBettingPool(address(betting));
        assertTrue(odd.transfer(user, 1_000_000 ether));
        assertTrue(odd.transfer(user2, 1_000_000 ether));
        assertTrue(odd.transfer(lpUser, 1_000_000 ether));
        vm.stopPrank();

        _approve(user, address(betting));
        _approve(user2, address(betting));
        _approve(lpUser, address(liquidity));

        vm.prank(lpUser);
        liquidity.depositGlobal(GLOBAL_LP, 1);
    }

    function testOrdinaryWinClaimFundsFlowUsesMatchAndGlobalLp() public {
        bytes32 matchId = keccak256("ordinary-win");
        bytes32 marketId = _openMarketWithMatch(matchId, 1, 0, 2, 20_000);
        _depositMatch(matchId, MATCH_LP);

        uint256 requestableBefore = liquidity.getRequestableLiquidity();
        uint256 globalRequestableBefore = liquidity.getGlobalRequestableLiquidity();
        uint256 userBefore = odd.balanceOf(user);
        uint256 user2Before = odd.balanceOf(user2);

        (bytes32 winBet, uint256 winAccepted, uint256 winOdds) = _placeBet(user, marketId, 0, 100 ether);
        (bytes32 loseBet, uint256 loseAccepted, uint256 loseOdds) = _placeBet(user2, marketId, 1, 100 ether);

        assertEq(winAccepted, 100 ether);
        assertEq(loseAccepted, 100 ether);
        assertEq(winOdds, 20_000);
        assertEq(loseOdds, 20_000);
        assertEq(odd.balanceOf(user), userBefore - 101 ether);
        assertEq(odd.balanceOf(user2), user2Before - 101 ether);
        assertEq(odd.balanceOf(treasury), 2 ether);
        assertEq(betting.accountedBalance(), 200 ether);
        _assertBettingBalanceMatchesAccounting();
        _assertUserRisk(user, 100 ether, 100 ether);
        _assertUserRisk(user2, 100 ether, 100 ether);

        (uint256[] memory stakes, uint256[] memory payouts,) = betting.getMarketExposure(marketId);
        assertEq(stakes[0], 100 ether);
        assertEq(stakes[1], 100 ether);
        assertEq(payouts[0], 200 ether);
        assertEq(payouts[1], 200 ether);

        _settleByScore(marketId, 1, 0, _pair(winBet, loseBet));

        assertEq(uint8(betting.getBet(winBet).settlementState), uint8(BetSettlementState.WonUnclaimed));
        assertEq(uint8(betting.getBet(loseBet).settlementState), uint8(BetSettlementState.Lost));
        assertEq(betting.getBet(winBet).claimablePayout, 200 ether);
        assertEq(betting.platformReserve(), 4 ether);
        assertEq(betting.accountedBalance(), 184 ether);
        assertEq(liquidity.getRequestableLiquidity(), requestableBefore + 16 ether - 20 ether);
        assertEq(liquidity.getGlobalRequestableLiquidity(), globalRequestableBefore + 8 ether - 10 ether);
        assertEq(odd.balanceOf(address(liquidity)), GLOBAL_LP + MATCH_LP + 16 ether);

        (uint256 reservedBeforeClaim, uint256 paidBeforeClaim,) = liquidity.getPayoutLiquidityWindow(matchId);
        assertEq(reservedBeforeClaim, 20 ether);
        assertEq(paidBeforeClaim, 0);
        _assertUserRisk(user, 100 ether, 0);
        _assertUserRisk(user2, 100 ether, 0);

        vm.expectEmit(true, false, false, true, address(liquidity));
        emit PayoutReserveOutstanding(matchId, 4 ether);
        vm.prank(user);
        betting.claimPayout(winBet);

        assertEq(uint8(betting.getBet(winBet).settlementState), uint8(BetSettlementState.WonClaimed));
        assertEq(odd.balanceOf(user), userBefore + 89 ether);
        assertEq(odd.balanceOf(user2), user2Before - 101 ether);
        assertEq(odd.balanceOf(treasury), 10 ether);
        assertEq(odd.balanceOf(address(staking)), 0);
        assertEq(betting.taxBuffer(), 0);
        assertEq(betting.lpLossOffsetRemaining(), 18 ether);
        assertEq(betting.accountedBalance(), 2 ether);
        assertEq(liquidity.getRequestableLiquidity(), requestableBefore + 16 ether - 20 ether);
        assertEq(liquidity.getGlobalRequestableLiquidity(), globalRequestableBefore + 8 ether - 10 ether);
        assertEq(odd.balanceOf(address(liquidity)), GLOBAL_LP + MATCH_LP);
        _assertBettingBalanceMatchesAccounting();

        (uint256 reservedAfterClaim, uint256 paidAfterClaim,) = liquidity.getPayoutLiquidityWindow(matchId);
        assertEq(reservedAfterClaim, 20 ether);
        assertEq(paidAfterClaim, 16 ether);
        assertEq(liquidity.getRequestableLiquidity() + (reservedAfterClaim - paidAfterClaim), GLOBAL_LP + MATCH_LP);

        vm.expectEmit(true, false, false, true, address(liquidity));
        emit PayoutReserveOutstanding(matchId, 0);
        vm.prank(admin);
        betting.releasePayoutReserve(matchId);
        assertEq(betting.lpLossOffsetRemaining(), 14 ether);
        assertEq(liquidity.getRequestableLiquidity(), requestableBefore);
        assertEq(liquidity.getGlobalRequestableLiquidity(), globalRequestableBefore);
        (uint256 reservedAfterRelease, uint256 paidAfterRelease,) = liquidity.getPayoutLiquidityWindow(matchId);
        assertEq(reservedAfterRelease, paidAfterRelease);
        assertEq(paidAfterRelease, 16 ether);
        assertEq(liquidity.getRequestableLiquidity(), odd.balanceOf(address(liquidity)));
    }

    function testOrdinaryRefundFundsFlowRollsBackRisk() public {
        bytes32 marketId = _openShortMarketWithMatch(keccak256("ordinary-refund"), 1, 0, 2, 20_000);
        uint256 userBefore = odd.balanceOf(user);

        (bytes32 betId,,) = _placeBet(user, marketId, 0, 100 ether);
        assertEq(odd.balanceOf(user), userBefore - 101 ether);
        assertEq(odd.balanceOf(treasury), 1 ether);
        _assertUserRisk(user, 100 ether, 100 ether);

        vm.warp(betting.getMarket(marketId).matchEndTime + 1);
        vm.prank(admin);
        betting.finalizeMarketSettlement(marketId, 1);

        uint256[] memory refundAmounts = new uint256[](1);
        refundAmounts[0] = 100 ether;
        vm.prank(admin);
        betting.refundBets(marketId, _single(betId), refundAmounts);

        assertEq(uint8(betting.getMarket(marketId).status), uint8(MarketStatus.Refunded));
        assertEq(uint8(betting.getBet(betId).settlementState), uint8(BetSettlementState.Refunded));
        assertEq(odd.balanceOf(user), userBefore - 1 ether);
        assertEq(odd.balanceOf(treasury), 1 ether);
        assertEq(betting.accountedBalance(), 0);
        _assertBettingBalanceMatchesAccounting();
        _assertUserRisk(user, 0, 0);

        (uint256[] memory stakes, uint256[] memory payouts,) = betting.getMarketExposure(marketId);
        assertEq(stakes[0], 0);
        assertEq(payouts[0], 0);
    }

    function testOrdinaryCashOutFundsFlowRetainedAndProfit() public {
        bytes32 retainedMatch = keccak256("ordinary-cashout-retained");
        bytes32 retainedMarket = _openMarketWithMatch(retainedMatch, 1, 0, 2, 50_000);
        uint256 userBefore = odd.balanceOf(user);

        (bytes32 retainedBet,,) = _placeBet(user, retainedMarket, 0, 100 ether);
        _updateTwoWayOdds(retainedMarket, 100_000);
        uint256 retainedQuoteVersion = _quoteVersion(retainedMarket);
        vm.prank(user);
        betting.cashOut(retainedBet, retainedQuoteVersion, uint64(block.timestamp), 45 ether, block.timestamp + 1);

        assertEq(odd.balanceOf(user), userBefore - 56 ether);
        assertEq(odd.balanceOf(treasury), 1 ether);
        assertEq(betting.platformReserve(), 55 ether);
        assertEq(betting.accountedBalance(), 55 ether);
        assertEq(uint8(betting.getBet(retainedBet).settlementState), uint8(BetSettlementState.CashedOut));
        _assertUserRisk(user, 100 ether, 0);

        (uint256 retainedReserved, uint256 retainedPaid,) = liquidity.getPayoutLiquidityWindow(retainedMatch);
        assertEq(retainedReserved, 0);
        assertEq(retainedPaid, 0);

        bytes32 profitMatch = keccak256("ordinary-cashout-profit");
        bytes32 profitMarket = _openMarketWithMatch(profitMatch, 1, 0, 2, 50_000);
        uint256 user2Before = odd.balanceOf(user2);
        uint256 requestableBeforeProfit = liquidity.getRequestableLiquidity();

        (bytes32 profitBet,,) = _placeBet(user2, profitMarket, 0, 100 ether);
        _updateTwoWayOdds(profitMarket, 20_000);
        uint256 profitQuoteVersion = _quoteVersion(profitMarket);
        vm.prank(user2);
        betting.cashOut(profitBet, profitQuoteVersion, uint64(block.timestamp), 225 ether, block.timestamp + 1);

        assertEq(odd.balanceOf(user2), user2Before + 124 ether);
        assertEq(odd.balanceOf(treasury), 2 ether);
        assertEq(betting.platformReserve(), 55 ether);
        assertEq(betting.accountedBalance(), 55 ether);
        assertEq(betting.lpLossOffsetRemaining(), 125 ether);
        assertEq(liquidity.getRequestableLiquidity(), requestableBeforeProfit - 125 ether);
        assertEq(liquidity.getGlobalRequestableLiquidity(), GLOBAL_LP - 125 ether);
        assertEq(odd.balanceOf(address(liquidity)), GLOBAL_LP - 125 ether);
        _assertBettingBalanceMatchesAccounting();

        (uint256 profitReserved, uint256 profitPaid,) = liquidity.getPayoutLiquidityWindow(profitMatch);
        assertEq(profitReserved, 125 ether);
        assertEq(profitPaid, 125 ether);
    }

    function testParlayWinClaimFundsFlowUsesGlobalLpOnly() public {
        bytes32 marketA = _openMarketWithMatch(keccak256("parlay-win-a"), 0, 0, 3, 20_000);
        bytes32 marketB = _openMarketWithMatch(keccak256("parlay-win-b"), 0, 0, 3, 20_000);
        ParlayLegInput[] memory legs = new ParlayLegInput[](2);
        legs[0] = _leg(marketA, 0);
        legs[1] = _leg(marketB, 0);

        uint256 userBefore = odd.balanceOf(user);
        uint256 requestableBefore = liquidity.getRequestableLiquidity();
        uint256 globalRequestableBefore = liquidity.getGlobalRequestableLiquidity();

        vm.prank(user);
        bytes32 parlayId = betting.placeParlay(legs, 100 ether, 40_000, block.timestamp + 1 hours, address(0));

        assertEq(odd.balanceOf(user), userBefore - 101 ether);
        assertEq(odd.balanceOf(treasury), 1 ether);
        assertEq(betting.accountedBalance(), 100 ether);
        assertEq(betting.openParlayMaxPayout(), 400 ether);
        _assertUserRisk(user, 100 ether, 100 ether);
        _assertParlayExposure(marketA, 0, 0, 400 ether);
        _assertParlayExposure(marketB, 0, 0, 400 ether);
        assertEq(liquidity.getRequestableLiquidity(), requestableBefore);
        assertEq(liquidity.getGlobalRequestableLiquidity(), globalRequestableBefore);

        _finalizeEmptyScoreMarket(marketA, 2, 1);
        _finalizeEmptyScoreMarket(marketB, 1, 0);

        vm.prank(admin);
        betting.settleParlay(parlayId);

        ParlayBet memory settled = _parlay(parlayId);
        assertEq(uint8(settled.state), uint8(ParlayState.WonUnclaimed));
        assertEq(settled.claimablePayout, 400 ether);
        assertEq(betting.openParlayMaxPayout(), 0);
        assertEq(betting.accountedBalance(), 92 ether);
        assertEq(betting.platformReserve(), 2 ether);
        assertEq(betting.lpLossOffsetRemaining(), 310 ether);
        assertEq(liquidity.getRequestableLiquidity(), requestableBefore + 8 ether - 310 ether);
        assertEq(liquidity.getGlobalRequestableLiquidity(), globalRequestableBefore + 8 ether - 310 ether);
        assertEq(odd.balanceOf(address(liquidity)), GLOBAL_LP + 8 ether);
        _assertUserRisk(user, 100 ether, 0);
        _assertParlayExposure(marketA, 0, 0, 0);
        _assertParlayExposure(marketB, 0, 0, 0);

        (uint256 reservedBeforeClaim, uint256 paidBeforeClaim,) =
            liquidity.getPayoutLiquidityWindow(settled.parlayRiskId);
        assertEq(reservedBeforeClaim, 310 ether);
        assertEq(paidBeforeClaim, 0);

        vm.expectEmit(true, false, false, true, address(liquidity));
        emit PayoutReserveOutstanding(settled.parlayRiskId, 2 ether);
        vm.prank(user);
        betting.claimParlayPayout(parlayId);

        assertEq(uint8(_parlay(parlayId).state), uint8(ParlayState.WonClaimed));
        assertEq(odd.balanceOf(user), userBefore + 279 ether);
        assertEq(odd.balanceOf(treasury), 17 ether);
        assertEq(odd.balanceOf(address(staking)), 0);
        assertEq(betting.accountedBalance(), 4 ether);
        assertEq(betting.platformReserve(), 2 ether);
        assertEq(betting.taxBuffer(), 0);
        assertEq(betting.lpLossOffsetRemaining(), 306 ether);
        assertEq(liquidity.getRequestableLiquidity(), requestableBefore + 8 ether - 310 ether);
        assertEq(liquidity.getGlobalRequestableLiquidity(), globalRequestableBefore + 8 ether - 310 ether);
        assertEq(odd.balanceOf(address(liquidity)), GLOBAL_LP + 8 ether - 308 ether);
        _assertBettingBalanceMatchesAccounting();

        (uint256 reservedAfterClaim, uint256 paidAfterClaim,) = liquidity.getPayoutLiquidityWindow(settled.parlayRiskId);
        assertEq(reservedAfterClaim, 310 ether);
        assertEq(paidAfterClaim, 308 ether);
        assertEq(liquidity.getRequestableLiquidity() + (reservedAfterClaim - paidAfterClaim), GLOBAL_LP - 300 ether);

        vm.expectEmit(true, false, false, true, address(liquidity));
        emit PayoutReserveOutstanding(settled.parlayRiskId, 0);
        vm.prank(admin);
        betting.releasePayoutReserve(settled.parlayRiskId);
        assertEq(betting.lpLossOffsetRemaining(), 304 ether);
        assertEq(liquidity.getRequestableLiquidity(), requestableBefore + 8 ether - 308 ether);
        assertEq(liquidity.getGlobalRequestableLiquidity(), globalRequestableBefore + 8 ether - 308 ether);
        (uint256 reservedAfterRelease, uint256 paidAfterRelease,) =
            liquidity.getPayoutLiquidityWindow(settled.parlayRiskId);
        assertEq(reservedAfterRelease, paidAfterRelease);
        assertEq(paidAfterRelease, 308 ether);
        assertEq(liquidity.getRequestableLiquidity(), odd.balanceOf(address(liquidity)));
    }

    function testManualReleaseUnclaimedParlayReserveUnlocksGlobalLp() public {
        bytes32 marketA = _openMarketWithMatch(keccak256("parlay-unclaimed-a"), 0, 0, 3, 20_000);
        bytes32 marketB = _openMarketWithMatch(keccak256("parlay-unclaimed-b"), 0, 0, 3, 20_000);
        ParlayLegInput[] memory legs = new ParlayLegInput[](2);
        legs[0] = _leg(marketA, 0);
        legs[1] = _leg(marketB, 0);

        uint256 requestableBefore = liquidity.getRequestableLiquidity();
        uint256 globalRequestableBefore = liquidity.getGlobalRequestableLiquidity();
        vm.prank(user);
        bytes32 parlayId = betting.placeParlay(legs, 100 ether, 40_000, block.timestamp + 1 hours, address(0));
        bytes32 parlayRiskId = _parlay(parlayId).parlayRiskId;

        _finalizeEmptyScoreMarket(marketA, 2, 1);
        _finalizeEmptyScoreMarket(marketB, 1, 0);
        vm.expectEmit(true, false, false, true, address(liquidity));
        emit PayoutReserveOutstanding(parlayRiskId, 310 ether);
        vm.prank(admin);
        betting.settleParlay(parlayId);

        ParlayBet memory settled = _parlay(parlayId);
        assertEq(uint8(settled.state), uint8(ParlayState.WonUnclaimed));
        assertEq(settled.claimablePayout, 400 ether);
        assertEq(betting.lpLossOffsetRemaining(), 310 ether);
        assertEq(liquidity.getRequestableLiquidity(), requestableBefore + 8 ether - 310 ether);

        vm.expectEmit(true, false, false, true, address(liquidity));
        emit PayoutReserveOutstanding(settled.parlayRiskId, 0);
        vm.prank(admin);
        betting.releasePayoutReserve(settled.parlayRiskId);
        assertEq(betting.lpLossOffsetRemaining(), 0);
        assertEq(liquidity.getRequestableLiquidity(), requestableBefore + 8 ether);
        assertEq(liquidity.getGlobalRequestableLiquidity(), globalRequestableBefore + 8 ether);

        (uint256 reserved, uint256 paid,) = liquidity.getPayoutLiquidityWindow(settled.parlayRiskId);
        assertEq(reserved, 0);
        assertEq(paid, 0);
        assertEq(liquidity.getRequestableLiquidity(), odd.balanceOf(address(liquidity)));
    }

    function testParlayRefundableFundsFlowDoesNotPullLpOrPayoutTax() public {
        bytes32 marketA = _openMarketWithMatch(keccak256("parlay-void-a"), 0, 0, 3, 20_000);
        bytes32 marketB = _openMarketWithMatch(keccak256("parlay-void-b"), 0, 0, 3, 20_000);
        ParlayLegInput[] memory legs = new ParlayLegInput[](2);
        legs[0] = _leg(marketA, 0);
        legs[1] = _leg(marketB, 0);

        uint256 userBefore = odd.balanceOf(user);
        vm.prank(user);
        bytes32 parlayId = betting.placeParlay(legs, 100 ether, 0, block.timestamp + 1 hours, address(0));

        _finalizeTerminalMarket(marketA, 2);
        _finalizeTerminalMarket(marketB, 2);

        vm.prank(admin);
        betting.settleParlay(parlayId);

        ParlayBet memory settled = _parlay(parlayId);
        assertEq(uint8(settled.state), uint8(ParlayState.Refundable));
        assertEq(settled.claimablePayout, 100 ether);
        assertEq(betting.accountedBalance(), 100 ether);
        assertEq(betting.platformReserve(), 0);
        assertEq(betting.openParlayMaxPayout(), 0);
        assertEq(liquidity.getRequestableLiquidity(), GLOBAL_LP);
        assertEq(liquidity.getGlobalRequestableLiquidity(), GLOBAL_LP);
        _assertUserRisk(user, 100 ether, 0);

        vm.prank(user);
        betting.claimParlayPayout(parlayId);

        assertEq(uint8(_parlay(parlayId).state), uint8(ParlayState.Refunded));
        assertEq(odd.balanceOf(user), userBefore - 1 ether);
        assertEq(odd.balanceOf(treasury), 1 ether);
        assertEq(betting.accountedBalance(), 0);
        assertEq(betting.platformReserve(), 0);
        assertEq(betting.lpLossOffsetRemaining(), 0);
        assertEq(liquidity.getRequestableLiquidity(), GLOBAL_LP);
        assertEq(liquidity.getGlobalRequestableLiquidity(), GLOBAL_LP);
        _assertBettingBalanceMatchesAccounting();

        (uint256 reserved, uint256 paid,) = liquidity.getPayoutLiquidityWindow(settled.parlayRiskId);
        assertEq(reserved, 0);
        assertEq(paid, 0);
    }

    function testParlayPartialRefundBooksMarginOnlyAndHasNoCashOutPath() public {
        bytes32 voidMarket = _openMarketWithMatch(keccak256("parlay-partial-void"), 0, 0, 3, 20_000);
        bytes32 halfLossMarket = _openMarketWithMatch(keccak256("parlay-partial-half-loss"), 1, 3, 2, 20_000);
        ParlayLegInput[] memory legs = new ParlayLegInput[](2);
        legs[0] = _leg(voidMarket, 0);
        legs[1] = _leg(halfLossMarket, 0);

        uint256 userBefore = odd.balanceOf(user);
        vm.prank(user);
        bytes32 parlayId = betting.placeParlay(legs, 100 ether, 0, block.timestamp + 1 hours, address(0));

        uint256 quoteVersion = _quoteVersion(voidMarket);
        vm.expectRevert(abi.encodeWithSelector(BetNotOwner.selector, parlayId, user));
        vm.prank(user);
        betting.cashOut(parlayId, quoteVersion, uint64(block.timestamp), 0, block.timestamp + 1);

        _finalizeTerminalMarket(voidMarket, 2);
        _finalizeEmptyScoreMarket(halfLossMarket, 0, 0);

        vm.prank(admin);
        betting.settleParlay(parlayId);

        ParlayBet memory settled = _parlay(parlayId);
        assertEq(uint8(settled.state), uint8(ParlayState.Refundable));
        assertEq(settled.claimablePayout, 50 ether);
        assertEq(betting.accountedBalance(), 96 ether);
        assertEq(betting.platformReserve(), 1 ether);
        assertEq(betting.lpLossOffsetRemaining(), 0);
        assertEq(liquidity.getRequestableLiquidity(), GLOBAL_LP + 4 ether);
        assertEq(liquidity.getGlobalRequestableLiquidity(), GLOBAL_LP + 4 ether);
        assertEq(odd.balanceOf(address(liquidity)), GLOBAL_LP + 4 ether);

        vm.prank(user);
        betting.claimParlayPayout(parlayId);

        assertEq(uint8(_parlay(parlayId).state), uint8(ParlayState.Refunded));
        assertEq(odd.balanceOf(user), userBefore - 51 ether);
        assertEq(odd.balanceOf(treasury), 1 ether);
        assertEq(betting.accountedBalance(), 46 ether);
        assertEq(betting.platformReserve(), 1 ether);
        assertEq(betting.taxBuffer(), 0);
        assertEq(betting.lpLossOffsetRemaining(), 0);
        assertEq(liquidity.getRequestableLiquidity(), GLOBAL_LP + 4 ether);
        assertEq(liquidity.getGlobalRequestableLiquidity(), GLOBAL_LP + 4 ether);
        _assertBettingBalanceMatchesAccounting();

        (uint256 reserved, uint256 paid,) = liquidity.getPayoutLiquidityWindow(settled.parlayRiskId);
        assertEq(reserved, 0);
        assertEq(paid, 0);
    }

    function _approve(address owner, address spender) internal {
        vm.prank(owner);
        odd.approve(spender, type(uint256).max);
    }

    function _depositMatch(bytes32 matchId, uint256 amount) internal {
        vm.prank(lpUser);
        liquidity.depositMatch(matchId, amount);
    }

    function _openMarketWithMatch(bytes32 matchId, uint8 marketType, uint8 line, uint256 outcomeCount, uint256 odds)
        internal
        returns (bytes32 marketId)
    {
        return _openMarketWithTimes(
            matchId,
            marketType,
            line,
            outcomeCount,
            odds,
            uint64(block.timestamp + 2 hours),
            uint64(block.timestamp + 3 hours)
        );
    }

    function _openShortMarketWithMatch(
        bytes32 matchId,
        uint8 marketType,
        uint8 line,
        uint256 outcomeCount,
        uint256 odds
    ) internal returns (bytes32 marketId) {
        return _openMarketWithTimes(
            matchId,
            marketType,
            line,
            outcomeCount,
            odds,
            uint64(block.timestamp + 5 minutes),
            uint64(block.timestamp + 10 minutes)
        );
    }

    function _openMarketWithTimes(
        bytes32 matchId,
        uint8 marketType,
        uint8 line,
        uint256 outcomeCount,
        uint256 odds,
        uint64 matchStartTime,
        uint64 matchEndTime
    ) internal returns (bytes32 marketId) {
        uint256[] memory baseOdds = new uint256[](outcomeCount);
        for (uint256 i = 0; i < outcomeCount; ++i) {
            baseOdds[i] = odds;
        }
        vm.prank(admin);
        marketId = betting.openMarket(
            matchId, marketType, line, matchStartTime, matchEndTime, baseOdds, uint64(block.timestamp)
        );
    }

    function _updateTwoWayOdds(bytes32 marketId, uint256 odds) internal {
        uint256[] memory baseOdds = new uint256[](2);
        baseOdds[0] = odds;
        baseOdds[1] = odds;
        vm.prank(admin);
        betting.updateOdds(marketId, baseOdds, uint64(block.timestamp));
    }

    function _placeBet(address bettor, bytes32 marketId, uint8 outcome, uint256 amount)
        internal
        returns (bytes32 betId, uint256 acceptedAmount, uint256 lockedOdds)
    {
        (, acceptedAmount, lockedOdds,,) = betting.previewSignal(marketId, outcome, amount);
        (,, uint64 updatedAt, uint256 quoteVersion) = betting.getMarketOdds(marketId);
        QuoteGuardInput memory guard = QuoteGuardInput({
            quoteVersion: quoteVersion,
            quotedAt: updatedAt,
            minOdds: lockedOdds,
            minAcceptedAmount: acceptedAmount,
            deadline: block.timestamp + 1 hours
        });
        vm.prank(bettor);
        (betId, acceptedAmount, lockedOdds) = betting.placeBet(marketId, outcome, amount, guard);
    }

    function _leg(bytes32 marketId, uint8 outcome) internal view returns (ParlayLegInput memory input) {
        (, uint256[] memory quotedOdds, uint64 updatedAt, uint256 quoteVersion) = betting.getMarketOdds(marketId);
        input = ParlayLegInput({
            marketId: marketId,
            outcome: outcome,
            quoteVersion: quoteVersion,
            quotedAt: updatedAt,
            minOdds: quotedOdds[outcome]
        });
    }

    function _settleByScore(bytes32 marketId, uint16 homeScore, uint16 awayScore, bytes32[] memory betIds) internal {
        vm.warp(betting.getMarket(marketId).matchEndTime + 1);
        vm.startPrank(admin);
        betting.settleMarketBetsByScore(marketId, homeScore, awayScore, betIds);
        betting.finalizeMarketSettlement(marketId, 0);
        vm.stopPrank();
    }

    function _finalizeEmptyScoreMarket(bytes32 marketId, uint16 homeScore, uint16 awayScore) internal {
        _settleByScore(marketId, homeScore, awayScore, new bytes32[](0));
    }

    function _finalizeTerminalMarket(bytes32 marketId, uint8 resultKindRaw) internal {
        vm.warp(betting.getMarket(marketId).matchEndTime + 1);
        vm.prank(admin);
        betting.finalizeMarketSettlement(marketId, resultKindRaw);
    }

    function _single(bytes32 betId) internal pure returns (bytes32[] memory betIds) {
        betIds = new bytes32[](1);
        betIds[0] = betId;
    }

    function _pair(bytes32 first, bytes32 second) internal pure returns (bytes32[] memory betIds) {
        betIds = new bytes32[](2);
        betIds[0] = first;
        betIds[1] = second;
    }

    function _quoteVersion(bytes32 marketId) internal view returns (uint256 quoteVersion) {
        (,,, quoteVersion) = betting.getMarketOdds(marketId);
    }

    function _parlay(bytes32 parlayId) internal view returns (ParlayBet memory parlay) {
        (
            parlay.owner,
            parlay.stake,
            parlay.lockedComboOdds,
            parlay.maxPayout,
            parlay.claimablePayout,
            parlay.parlayRiskId,
            parlay.acceptedDayBucket,
            parlay.legCount,
            parlay.state,
            parlay.payoutTaxRateBps,
            parlay.taxAllocStakingBps,
            parlay.taxAllocTaxBufferBps,
            parlay.taxAllocReferrerBps,
            parlay.referrerSnapshot
        ) = betting.parlays(parlayId);
    }

    function _assertUserRisk(address account, uint256 expectedDaily, uint256 expectedUnsettled) internal view {
        BettingPool.UserRiskLedger memory risk = betting.getUserRiskLedger(account);
        assertEq(risk.dailyAcceptedAmount, expectedDaily);
        assertEq(risk.unsettledStake, expectedUnsettled);
    }

    function _assertParlayExposure(bytes32 marketId, uint8 outcome, uint256 expectedStake, uint256 expectedPayout)
        internal
        view
    {
        (uint256[] memory stakes, uint256[] memory payouts,) = betting.getMarketExposure(marketId);
        assertEq(stakes[outcome], expectedStake);
        assertEq(payouts[outcome], expectedPayout);
    }

    function _assertBettingBalanceMatchesAccounting() internal view {
        assertEq(odd.balanceOf(address(betting)), betting.accountedBalance());
    }

    function _proxy(address implementation, bytes memory initData) internal returns (address) {
        return address(new ERC1967Proxy(implementation, initData));
    }
}
