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
import {QuoteGuardInput} from "../src/shared/types/CommonTypes.sol";
import {BetSettlementState, MarketStatus} from "../src/shared/types/MarketEnums.sol";
import {OddMvpTestBootstrap} from "./helpers/OddMvpTestBootstrap.sol";

contract BatchMarketSettlementTest is OddMvpTestBootstrap {
    enum ReferenceScoreResult {
        FullWin,
        FullLoss,
        FullPush,
        HalfWin,
        HalfLoss
    }

    address internal admin = address(0xA11CE);
    address internal treasury = address(0xBEEF);
    ODDToken internal odd;
    StakingPool internal staking;
    LiquidityPool internal liquidity;
    BettingPool internal betting;

    function _proxy(address implementation, bytes memory initData) internal returns (address) {
        return address(new ERC1967Proxy(implementation, initData));
    }

    function setUp() public {
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

        _bootstrapOddMvpToken(odd, admin, treasury, address(staking), address(liquidity), address(betting));

        vm.startPrank(admin);
        betting.setSettlementModule(address(settlement));
        betting.setBetModule(address(betModule));
        betting.setMarketModule(address(new BettingMarketModule()));
        betting.setReferralModule(address(new BettingReferralModule()));
        betting.initializeV2(treasury);
        staking.initializeV2(address(betting));
        liquidity.setBettingPool(address(betting));
        odd.approve(address(betting), 1_000_000 ether);
        betting.addPlatformReserve(1_000_000 ether);
        vm.stopPrank();
    }

    function testBatchSettlementFinalizesAfterAllBetsProcessed() public {
        (bytes32 marketId, bytes32[] memory betIds) = _openMarketAndPlaceBets("batch-settlement-ok", 6);
        bytes32[] memory firstBatch = _slice(betIds, 0, 3);
        bytes32[] memory secondBatch = _slice(betIds, 3, 3);

        vm.warp(block.timestamp + 3 hours);
        vm.prank(admin);
        betting.settleMarketBetsByScore(marketId, 1, 0, firstBatch);

        vm.expectRevert();
        vm.prank(_bettor("batch-settlement-ok", 0));
        betting.claimPayout(betIds[0]);

        vm.expectRevert();
        vm.prank(admin);
        betting.finalizeMarketSettlement(marketId, 0);

        vm.prank(admin);
        betting.settleMarketBetsByScore(marketId, 1, 0, secondBatch);
        vm.prank(admin);
        betting.finalizeMarketSettlement(marketId, 0);

        assertEq(uint8(betting.getMarket(marketId).status), uint8(MarketStatus.Settled));
        assertEq(uint8(betting.getBet(betIds[0]).settlementState), uint8(BetSettlementState.WonUnclaimed));
        assertEq(uint8(betting.getBet(betIds[1]).settlementState), uint8(BetSettlementState.Lost));
        assertGt(betting.platformReserve(), 1_000_000 ether);
    }

    function testBatchSettlementRejectsDuplicateAndWrongMarketBets() public {
        (bytes32 marketId, bytes32[] memory betIds) = _openMarketAndPlaceBets("batch-settlement-rejects", 2);
        (bytes32 otherMarketId, bytes32[] memory otherBetIds) = _openMarketAndPlaceBets("batch-settlement-other", 1);
        otherMarketId;

        bytes32[] memory duplicateBatch = new bytes32[](2);
        duplicateBatch[0] = betIds[0];
        duplicateBatch[1] = betIds[0];

        vm.warp(block.timestamp + 3 hours);
        vm.expectRevert();
        vm.prank(admin);
        betting.settleMarketBetsByScore(marketId, 1, 0, duplicateBatch);

        bytes32[] memory wrongMarketBatch = new bytes32[](1);
        wrongMarketBatch[0] = otherBetIds[0];
        vm.expectRevert();
        vm.prank(admin);
        betting.settleMarketBetsByScore(marketId, 1, 0, wrongMarketBatch);
    }

    function testRefundedAndCancelledSettlementOnlyMarkMarketTerminal() public {
        (bytes32 refundMarketId, bytes32[] memory refundBetIds) = _openMarketAndPlaceBets("batch-terminal-refund", 2);
        (bytes32 cancelMarketId, bytes32[] memory cancelBetIds) = _openMarketAndPlaceBets("batch-terminal-cancel", 2);

        vm.warp(block.timestamp + 3 hours);

        vm.expectEmit(true, false, false, true, address(betting));
        emit BettingPoolStorageEvents.MarketSettlementFinalized(refundMarketId, 1, false, 0, 0, 0, 0, 0, 4);
        vm.prank(admin);
        betting.finalizeMarketSettlement(refundMarketId, 1);

        vm.expectEmit(true, false, false, true, address(betting));
        emit BettingPoolStorageEvents.MarketSettlementFinalized(cancelMarketId, 2, false, 0, 0, 0, 0, 0, 4);
        vm.prank(admin);
        betting.finalizeMarketSettlement(cancelMarketId, 2);

        assertEq(uint8(betting.getMarket(refundMarketId).status), uint8(MarketStatus.Refunded));
        assertEq(uint8(betting.getMarket(cancelMarketId).status), uint8(MarketStatus.Cancelled));
        assertEq(uint8(betting.getBet(refundBetIds[0]).settlementState), uint8(BetSettlementState.Pending));
        assertEq(uint8(betting.getBet(cancelBetIds[0]).settlementState), uint8(BetSettlementState.Pending));
        assertEq(betting.platformReserve(), 1_000_000 ether);
    }

    function testBatchSettlementRejectsScoreMismatchAndInvalidScores() public {
        (bytes32 marketId, bytes32[] memory betIds) = _openMarketAndPlaceBets("batch-score-mismatch", 2);
        bytes32[] memory firstBatch = _slice(betIds, 0, 1);
        bytes32[] memory secondBatch = _slice(betIds, 1, 1);

        vm.warp(block.timestamp + 3 hours);
        vm.prank(admin);
        betting.settleMarketBetsByScore(marketId, 1, 0, firstBatch);

        vm.expectRevert();
        vm.prank(admin);
        betting.settleMarketBetsByScore(marketId, 2, 0, secondBatch);

        (bytes32 invalidScoreMarketId, bytes32[] memory invalidScoreBetIds) =
            _openMarketAndPlaceBets("batch-invalid-score", 1);
        bytes32[] memory invalidScoreBatch = _slice(invalidScoreBetIds, 0, 1);
        vm.warp(block.timestamp + 3 hours);
        vm.expectRevert();
        vm.prank(admin);
        betting.settleMarketBetsByScore(invalidScoreMarketId, 51, 0, invalidScoreBatch);
    }

    function testZeroBetMarketCanFinalizeAfterMatchEnd() public {
        uint256[] memory baseOdds = new uint256[](2);
        baseOdds[0] = 20_000;
        baseOdds[1] = 20_000;

        vm.prank(admin);
        bytes32 marketId = betting.openMarket(
            keccak256("zero-bet-market"),
            1,
            0,
            uint64(block.timestamp + 1 hours),
            uint64(block.timestamp + 2 hours),
            baseOdds,
            uint64(block.timestamp)
        );

        vm.warp(block.timestamp + 3 hours);
        vm.prank(admin);
        betting.finalizeMarketSettlement(marketId, 0);

        assertEq(uint8(betting.getMarket(marketId).status), uint8(MarketStatus.Settled));
    }

    function testFullPushSettlesMarketAndRefundsBet() public {
        (bytes32 marketId, bytes32[] memory betIds) = _openAhMarketAndPlaceSingleBet("full-push", 1, 0);
        uint256 bettorBalanceBefore = odd.balanceOf(_bettor("full-push", 0));

        vm.warp(block.timestamp + 3 hours);
        vm.prank(admin);
        betting.settleMarketBetsByScore(marketId, 1, 0, betIds);
        vm.prank(admin);
        betting.finalizeMarketSettlement(marketId, 0);

        assertEq(uint8(betting.getMarket(marketId).status), uint8(MarketStatus.Settled));
        assertEq(uint8(betting.getBet(betIds[0]).settlementState), uint8(BetSettlementState.Refunded));
        assertEq(odd.balanceOf(_bettor("full-push", 0)), bettorBalanceBefore + 100 ether);
        (uint256[] memory stakes, uint256[] memory payouts,) = betting.getMarketExposure(marketId);
        assertEq(stakes[0], 0);
        assertEq(payouts[0], 0);
        assertEq(stakes[1], 0);
        assertEq(payouts[1], 0);
    }

    function testHalfLossRefundReleasesOnlyRefundedExposure() public {
        (bytes32 marketId, bytes32[] memory betIds) = _openAhMarketAndPlaceSingleBet("half-loss-exposure", 3, 0);
        (uint256[] memory stakesBefore, uint256[] memory payoutsBefore,) = betting.getMarketExposure(marketId);
        assertEq(stakesBefore[0], 100 ether);
        assertEq(payoutsBefore[0], 200 ether);

        vm.warp(block.timestamp + 3 hours);
        vm.prank(admin);
        betting.settleMarketBetsByScore(marketId, 0, 0, betIds);
        vm.prank(admin);
        betting.finalizeMarketSettlement(marketId, 0);

        (uint256[] memory stakesAfter, uint256[] memory payoutsAfter,) = betting.getMarketExposure(marketId);
        assertEq(stakesAfter[0], 50 ether);
        assertEq(payoutsAfter[0], 100 ether);
        assertEq(stakesAfter[1], 0);
        assertEq(payoutsAfter[1], 0);
    }

    function testAllSupportedAhLinesResolveOutcomeZero() public {
        _assertAhResult("ah-minus-half-win", 0, 1, 0, BetSettlementState.WonUnclaimed, 0, 200 ether);
        _assertAhResult("ah-minus-half-loss", 0, 0, 0, BetSettlementState.Lost, 0, 0);
        _assertAhResult("ah-minus-one-push", 1, 1, 0, BetSettlementState.Refunded, 100 ether, 0);
        _assertAhResult("ah-minus-one-point-five-loss", 2, 1, 0, BetSettlementState.Lost, 0, 0);
        _assertAhResult("ah-minus-quarter-half-loss", 3, 0, 0, BetSettlementState.Lost, 50 ether, 0);
        _assertAhResult(
            "ah-minus-three-quarter-half-win", 4, 1, 0, BetSettlementState.WonUnclaimed, 50 ether, 100 ether
        );
        _assertAhResult("ah-minus-one-point-two-five-half-loss", 5, 1, 0, BetSettlementState.Lost, 50 ether, 0);
        _assertAhResult("ah-plus-zero-push", 6, 0, 0, BetSettlementState.Refunded, 100 ether, 0);
        _assertAhResult("ah-plus-quarter-half-win", 7, 0, 0, BetSettlementState.WonUnclaimed, 50 ether, 100 ether);
        _assertAhResult("ah-plus-half-win", 8, 0, 0, BetSettlementState.WonUnclaimed, 0, 200 ether);
        _assertAhResult("ah-plus-three-quarter-half-loss", 9, 0, 1, BetSettlementState.Lost, 50 ether, 0);
        _assertAhResult(
            "ah-minus-one-point-seven-five-half-win", 10, 2, 0, BetSettlementState.WonUnclaimed, 50 ether, 100 ether
        );
        _assertAhResult("ah-minus-two-push", 11, 2, 0, BetSettlementState.Refunded, 100 ether, 0);
        _assertAhResult("ah-minus-three-push", 12, 3, 0, BetSettlementState.Refunded, 100 ether, 0);
    }

    function testV3AhDeepLinesResolveKeyOutcomes() public {
        _assertAhResult("ah-v3-minus-one-point-seven-five-win", 10, 3, 0, BetSettlementState.WonUnclaimed, 0, 200 ether);
        _assertAhResult(
            "ah-v3-minus-one-point-seven-five-half", 10, 2, 0, BetSettlementState.WonUnclaimed, 50 ether, 100 ether
        );
        _assertAhResult("ah-v3-minus-one-point-seven-five-loss", 10, 1, 0, BetSettlementState.Lost, 0, 0);
        _assertAhResult("ah-v3-minus-two-win", 11, 3, 0, BetSettlementState.WonUnclaimed, 0, 200 ether);
        _assertAhResult("ah-v3-minus-two-push", 11, 2, 0, BetSettlementState.Refunded, 100 ether, 0);
        _assertAhResult("ah-v3-minus-two-loss", 11, 1, 0, BetSettlementState.Lost, 0, 0);
        _assertAhResult("ah-v3-minus-three-win", 12, 4, 0, BetSettlementState.WonUnclaimed, 0, 200 ether);
        _assertAhResult("ah-v3-minus-three-push", 12, 3, 0, BetSettlementState.Refunded, 100 ether, 0);
        _assertAhResult("ah-v3-minus-three-loss", 12, 2, 0, BetSettlementState.Lost, 0, 0);
        _assertAhResultForOutcome(
            "ah-v3-away-minus-one-point-seven-five-half-loss", 10, 1, 2, 0, BetSettlementState.Lost, 50 ether, 0
        );
    }

    function testMarketTemplateSupportsV3ExpandedLines() public {
        for (uint8 line = 0; line < 13; ++line) {
            _openMarket(string(abi.encodePacked("ah-line-", line)), 1, line, 2);
        }
        vm.expectRevert();
        _openMarket("ah-line-13", 1, 13, 2);

        for (uint8 line = 0; line < 11; ++line) {
            _openMarket(string(abi.encodePacked("ou-line-", line)), 2, line, 2);
        }
        vm.expectRevert();
        _openMarket("ou-line-11", 2, 11, 2);
        _openMarket("1x2-line-0", 0, 0, 3);
        vm.expectRevert();
        _openMarket("1x2-line-1", 0, 1, 3);
    }

    function testOneXTwoAndOuResolveByScore() public {
        _assertMarketResult("1x2-home", 0, 0, 0, 1, 0, BetSettlementState.WonUnclaimed, 0, 200 ether);
        _assertMarketResult("1x2-draw", 0, 0, 1, 1, 1, BetSettlementState.WonUnclaimed, 0, 300 ether);
        _assertMarketResult("1x2-away", 0, 0, 2, 0, 1, BetSettlementState.WonUnclaimed, 0, 400 ether);
        _assertMarketResult("ou-over", 2, 1, 0, 2, 1, BetSettlementState.WonUnclaimed, 0, 200 ether);
        _assertMarketResult("ou-under", 2, 1, 1, 1, 1, BetSettlementState.WonUnclaimed, 0, 300 ether);
    }

    function testV3OuLinesResolvePushAndHalfResults() public {
        _assertMarketResult("ou-v3-zero-over-push", 2, 3, 0, 0, 0, BetSettlementState.Refunded, 100 ether, 0);
        _assertMarketResult("ou-v3-zero-under-push", 2, 3, 1, 0, 0, BetSettlementState.Refunded, 100 ether, 0);
        _assertMarketResult("ou-v3-half-over-win", 2, 4, 0, 1, 0, BetSettlementState.WonUnclaimed, 0, 200 ether);
        _assertMarketResult("ou-v3-half-under-loss", 2, 4, 1, 1, 0, BetSettlementState.Lost, 0, 0);
        _assertMarketResult("ou-v3-one-over-push", 2, 5, 0, 1, 0, BetSettlementState.Refunded, 100 ether, 0);
        _assertMarketResult("ou-v3-one-under-push", 2, 5, 1, 1, 0, BetSettlementState.Refunded, 100 ether, 0);
        _assertMarketResult(
            "ou-v3-one-point-seven-five-over-half-win",
            2,
            6,
            0,
            2,
            0,
            BetSettlementState.WonUnclaimed,
            50 ether,
            100 ether
        );
        _assertMarketResult(
            "ou-v3-one-point-seven-five-under-half-loss", 2, 6, 1, 2, 0, BetSettlementState.Lost, 50 ether, 0
        );
        _assertMarketResult("ou-v3-two-over-push", 2, 7, 0, 2, 0, BetSettlementState.Refunded, 100 ether, 0);
        _assertMarketResult("ou-v3-two-under-push", 2, 7, 1, 2, 0, BetSettlementState.Refunded, 100 ether, 0);
        _assertMarketResult(
            "ou-v3-two-point-two-five-over-half-loss", 2, 8, 0, 2, 0, BetSettlementState.Lost, 50 ether, 0
        );
        _assertMarketResult(
            "ou-v3-two-point-two-five-under-half-win",
            2,
            8,
            1,
            2,
            0,
            BetSettlementState.WonUnclaimed,
            50 ether,
            150 ether
        );
        _assertMarketResult(
            "ou-v3-two-point-seven-five-over-half-win",
            2,
            9,
            0,
            3,
            0,
            BetSettlementState.WonUnclaimed,
            50 ether,
            100 ether
        );
        _assertMarketResult(
            "ou-v3-two-point-seven-five-under-half-loss", 2, 9, 1, 3, 0, BetSettlementState.Lost, 50 ether, 0
        );
        _assertMarketResult("ou-v3-three-over-push", 2, 10, 0, 3, 0, BetSettlementState.Refunded, 100 ether, 0);
        _assertMarketResult("ou-v3-three-under-push", 2, 10, 1, 3, 0, BetSettlementState.Refunded, 100 ether, 0);
    }

    function testV3AhNewLineClaimEndToEnd() public {
        (bytes32 ahMarketId, bytes32[] memory ahBetIds) = _openAhMarketAndPlaceSingleBet("v3-ah-half-win-claim", 10, 0);
        vm.warp(betting.getMarket(ahMarketId).matchEndTime + 1);
        vm.prank(admin);
        betting.settleMarketBetsByScore(ahMarketId, 2, 0, ahBetIds);
        vm.prank(admin);
        betting.finalizeMarketSettlement(ahMarketId, 0);

        BettingPool.Bet memory ahBet = betting.getBet(ahBetIds[0]);
        assertEq(uint8(ahBet.settlementState), uint8(BetSettlementState.WonUnclaimed));
        assertEq(ahBet.refundedAmount, 50 ether);
        assertEq(ahBet.claimablePayout, 100 ether);

        vm.prank(_bettor("v3-ah-half-win-claim", 0));
        betting.claimPayout(ahBetIds[0]);
        assertEq(uint8(betting.getBet(ahBetIds[0]).settlementState), uint8(BetSettlementState.WonClaimed));
    }

    function testV3OuHalfLossReleasesExposureEndToEnd() public {
        (bytes32 ouMarketId, bytes32[] memory ouBetIds) =
            _openTwoWayMarketAndPlaceSingleBet("v3-ou-half-loss-exposure", 2, 8, 0);
        (uint256[] memory stakesBefore, uint256[] memory payoutsBefore,) = betting.getMarketExposure(ouMarketId);
        assertEq(stakesBefore[0], 100 ether);
        assertEq(payoutsBefore[0], 200 ether);

        vm.warp(betting.getMarket(ouMarketId).matchEndTime + 1);
        vm.prank(admin);
        betting.settleMarketBetsByScore(ouMarketId, 2, 0, ouBetIds);
        vm.prank(admin);
        betting.finalizeMarketSettlement(ouMarketId, 0);

        BettingPool.Bet memory ouBet = betting.getBet(ouBetIds[0]);
        assertEq(uint8(ouBet.settlementState), uint8(BetSettlementState.Lost));
        assertEq(ouBet.refundedAmount, 50 ether);
        (uint256[] memory stakesAfter, uint256[] memory payoutsAfter,) = betting.getMarketExposure(ouMarketId);
        assertEq(stakesAfter[0], 50 ether);
        assertEq(payoutsAfter[0], 100 ether);
    }

    function testAhOutcomeOneUsesAwaySideAgainstLine() public {
        _assertAhResultForOutcome(
            "ah-away-minus-quarter-draw", 3, 1, 0, 0, BetSettlementState.WonUnclaimed, 50 ether, 100 ether
        );
        _assertAhResultForOutcome("ah-away-plus-zero-home-win", 6, 1, 1, 0, BetSettlementState.Lost, 0, 0);
        _assertAhResultForOutcome(
            "ah-away-plus-three-quarter-away-loss-one", 9, 1, 0, 1, BetSettlementState.WonUnclaimed, 50 ether, 100 ether
        );
    }

    function testFuzzAhScoreSettlementMatchesReference(
        uint8 rawLine,
        uint8 rawOutcome,
        uint8 rawHomeScore,
        uint8 rawAwayScore
    ) public {
        uint8 line = rawLine % 13;
        uint8 outcome = rawOutcome % 2;
        uint16 homeScore = uint16(rawHomeScore % 51);
        uint16 awayScore = uint16(rawAwayScore % 51);
        (BetSettlementState expectedState, uint256 expectedRefunded, uint256 expectedClaimable) =
            _expectedAhSettlement(line, outcome, homeScore, awayScore);

        _assertAhResultForOutcome(
            "ah-fuzz", line, outcome, homeScore, awayScore, expectedState, expectedRefunded, expectedClaimable
        );
    }

    function testFuzzOuScoreSettlementMatchesReference(uint8 rawLine, uint8 rawOutcome, uint8 rawTotalGoals) public {
        uint8 line = rawLine % 11;
        uint8 outcome = rawOutcome % 2;
        uint16 totalGoals = uint16(rawTotalGoals % 5);
        (BetSettlementState expectedState, uint256 expectedRefunded, uint256 expectedClaimable) =
            _expectedOuSettlement(line, outcome, totalGoals);

        _assertMarketResult(
            "ou-fuzz", 2, line, outcome, totalGoals, 0, expectedState, expectedRefunded, expectedClaimable
        );
    }

    function _openMarketAndPlaceBets(string memory label, uint256 count)
        internal
        returns (bytes32 marketId, bytes32[] memory betIds)
    {
        uint256[] memory baseOdds = new uint256[](2);
        baseOdds[0] = 10_100;
        baseOdds[1] = 10_100;

        vm.prank(admin);
        marketId = betting.openMarket(
            keccak256(bytes(label)),
            1,
            0,
            uint64(block.timestamp + 1 hours),
            uint64(block.timestamp + 2 hours),
            baseOdds,
            uint64(block.timestamp)
        );

        betIds = new bytes32[](count);
        for (uint256 i = 0; i < count; ++i) {
            address bettor = _bettor(label, i);
            uint8 outcome = i % 2 == 0 ? 0 : 1;
            vm.prank(admin);
            assertTrue(odd.transfer(bettor, 500 ether));

            (, uint256 acceptedAmount, uint256 lockedOdds,,) = betting.previewSignal(marketId, outcome, 100 ether);
            (,, uint64 updatedAt, uint256 quoteVersion) = betting.getMarketOdds(marketId);
            QuoteGuardInput memory guard = QuoteGuardInput({
                quoteVersion: quoteVersion,
                quotedAt: updatedAt,
                minOdds: lockedOdds,
                minAcceptedAmount: acceptedAmount,
                deadline: uint256(updatedAt) + 30 minutes
            });

            vm.startPrank(bettor);
            odd.approve(address(betting), type(uint256).max);
            (betIds[i],,) = betting.placeBet(marketId, outcome, 100 ether, guard);
            vm.stopPrank();
        }
    }

    function _openMarket(string memory label, uint8 marketType, uint8 line, uint256 outcomeCount)
        internal
        returns (bytes32 marketId)
    {
        uint256[] memory baseOdds = new uint256[](outcomeCount);
        for (uint256 i = 0; i < outcomeCount; ++i) {
            baseOdds[i] = uint256(20_000 + i * 10_000);
        }

        vm.prank(admin);
        marketId = betting.openMarket(
            keccak256(bytes(label)),
            marketType,
            line,
            uint64(block.timestamp + 1 hours),
            uint64(block.timestamp + 2 hours),
            baseOdds,
            uint64(block.timestamp)
        );
    }

    function _openAhMarketAndPlaceSingleBet(string memory label, uint8 line, uint8 outcome)
        internal
        returns (bytes32 marketId, bytes32[] memory betIds)
    {
        return _openTwoWayMarketAndPlaceSingleBet(label, 1, line, outcome);
    }

    function _openTwoWayMarketAndPlaceSingleBet(string memory label, uint8 marketType, uint8 line, uint8 outcome)
        internal
        returns (bytes32 marketId, bytes32[] memory betIds)
    {
        uint256[] memory baseOdds = new uint256[](2);
        baseOdds[0] = 20_000;
        baseOdds[1] = 20_000;

        vm.prank(admin);
        marketId = betting.openMarket(
            keccak256(bytes(label)),
            marketType,
            line,
            uint64(block.timestamp + 1 hours),
            uint64(block.timestamp + 2 hours),
            baseOdds,
            uint64(block.timestamp)
        );

        address bettor = _bettor(label, 0);
        vm.prank(admin);
        assertTrue(odd.transfer(bettor, 500 ether));

        (, uint256 acceptedAmount, uint256 lockedOdds,,) = betting.previewSignal(marketId, outcome, 100 ether);
        (,, uint64 updatedAt, uint256 quoteVersion) = betting.getMarketOdds(marketId);
        QuoteGuardInput memory guard = QuoteGuardInput({
            quoteVersion: quoteVersion,
            quotedAt: updatedAt,
            minOdds: lockedOdds,
            minAcceptedAmount: acceptedAmount,
            deadline: uint256(updatedAt) + 30 minutes
        });

        betIds = new bytes32[](1);
        vm.startPrank(bettor);
        odd.approve(address(betting), type(uint256).max);
        (betIds[0],,) = betting.placeBet(marketId, outcome, 100 ether, guard);
        vm.stopPrank();
    }

    function _assertAhResult(
        string memory label,
        uint8 line,
        uint16 homeScore,
        uint16 awayScore,
        BetSettlementState expectedState,
        uint256 expectedRefunded,
        uint256 expectedClaimable
    ) internal {
        (bytes32 marketId, bytes32[] memory betIds) = _openAhMarketAndPlaceSingleBet(label, line, 0);
        vm.warp(betting.getMarket(marketId).matchEndTime + 1);
        vm.prank(admin);
        betting.settleMarketBetsByScore(marketId, homeScore, awayScore, betIds);
        vm.prank(admin);
        betting.finalizeMarketSettlement(marketId, 0);

        BettingPool.Bet memory bet = betting.getBet(betIds[0]);
        assertEq(uint8(bet.settlementState), uint8(expectedState), label);
        assertEq(bet.refundedAmount, expectedRefunded, label);
        assertEq(bet.claimablePayout, expectedClaimable, label);
    }

    function _assertAhResultForOutcome(
        string memory label,
        uint8 line,
        uint8 outcome,
        uint16 homeScore,
        uint16 awayScore,
        BetSettlementState expectedState,
        uint256 expectedRefunded,
        uint256 expectedClaimable
    ) internal {
        (bytes32 marketId, bytes32[] memory betIds) = _openAhMarketAndPlaceSingleBet(label, line, outcome);
        vm.warp(betting.getMarket(marketId).matchEndTime + 1);
        vm.prank(admin);
        betting.settleMarketBetsByScore(marketId, homeScore, awayScore, betIds);
        vm.prank(admin);
        betting.finalizeMarketSettlement(marketId, 0);

        BettingPool.Bet memory bet = betting.getBet(betIds[0]);
        assertEq(uint8(bet.settlementState), uint8(expectedState), label);
        assertEq(bet.refundedAmount, expectedRefunded, label);
        assertEq(bet.claimablePayout, expectedClaimable, label);
    }

    function _assertMarketResult(
        string memory label,
        uint8 marketType,
        uint8 line,
        uint8 outcome,
        uint16 homeScore,
        uint16 awayScore,
        BetSettlementState expectedState,
        uint256 expectedRefunded,
        uint256 expectedClaimable
    ) internal {
        bytes32 marketId = _openMarket(label, marketType, line, marketType == 0 ? 3 : 2);
        address bettor = _bettor(label, 0);
        vm.prank(admin);
        assertTrue(odd.transfer(bettor, 500 ether));

        (, uint256 acceptedAmount, uint256 lockedOdds,,) = betting.previewSignal(marketId, outcome, 100 ether);
        (,, uint64 updatedAt, uint256 quoteVersion) = betting.getMarketOdds(marketId);
        QuoteGuardInput memory guard = QuoteGuardInput({
            quoteVersion: quoteVersion,
            quotedAt: updatedAt,
            minOdds: lockedOdds,
            minAcceptedAmount: acceptedAmount,
            deadline: uint256(updatedAt) + 30 minutes
        });

        vm.startPrank(bettor);
        odd.approve(address(betting), type(uint256).max);
        (bytes32 betId,,) = betting.placeBet(marketId, outcome, 100 ether, guard);
        vm.stopPrank();

        bytes32[] memory betIds = new bytes32[](1);
        betIds[0] = betId;
        vm.warp(betting.getMarket(marketId).matchEndTime + 1);
        vm.prank(admin);
        betting.settleMarketBetsByScore(marketId, homeScore, awayScore, betIds);
        vm.prank(admin);
        betting.finalizeMarketSettlement(marketId, 0);

        BettingPool.Bet memory bet = betting.getBet(betId);
        assertEq(uint8(bet.settlementState), uint8(expectedState), label);
        assertEq(bet.refundedAmount, expectedRefunded, label);
        assertEq(bet.claimablePayout, expectedClaimable, label);
    }

    function _expectedAhSettlement(uint8 line, uint8 outcome, uint16 homeScore, uint16 awayScore)
        internal
        pure
        returns (BetSettlementState expectedState, uint256 expectedRefunded, uint256 expectedClaimable)
    {
        ReferenceScoreResult result = _expectedAhHomeResult(line, homeScore, awayScore);
        if (outcome == 1) {
            result = _oppositeExpectedResult(result);
        }

        if (result == ReferenceScoreResult.FullWin) {
            return (BetSettlementState.WonUnclaimed, 0, 200 ether);
        }
        if (result == ReferenceScoreResult.FullLoss) {
            return (BetSettlementState.Lost, 0, 0);
        }
        if (result == ReferenceScoreResult.FullPush) {
            return (BetSettlementState.Refunded, 100 ether, 0);
        }
        if (result == ReferenceScoreResult.HalfWin) {
            return (BetSettlementState.WonUnclaimed, 50 ether, 100 ether);
        }
        return (BetSettlementState.Lost, 50 ether, 0);
    }

    function _expectedAhHomeResult(uint8 line, uint16 homeScore, uint16 awayScore)
        internal
        pure
        returns (ReferenceScoreResult)
    {
        if (line == 0) return homeScore > awayScore ? ReferenceScoreResult.FullWin : ReferenceScoreResult.FullLoss;
        if (line == 1) {
            if (homeScore >= awayScore + 2) return ReferenceScoreResult.FullWin;
            if (homeScore == awayScore + 1) return ReferenceScoreResult.FullPush;
            return ReferenceScoreResult.FullLoss;
        }
        if (line == 2) {
            return homeScore >= awayScore + 2 ? ReferenceScoreResult.FullWin : ReferenceScoreResult.FullLoss;
        }
        if (line == 3) {
            if (homeScore > awayScore) return ReferenceScoreResult.FullWin;
            if (homeScore == awayScore) return ReferenceScoreResult.HalfLoss;
            return ReferenceScoreResult.FullLoss;
        }
        if (line == 4) {
            if (homeScore >= awayScore + 2) return ReferenceScoreResult.FullWin;
            if (homeScore == awayScore + 1) return ReferenceScoreResult.HalfWin;
            return ReferenceScoreResult.FullLoss;
        }
        if (line == 5) {
            if (homeScore >= awayScore + 2) return ReferenceScoreResult.FullWin;
            if (homeScore == awayScore + 1) return ReferenceScoreResult.HalfLoss;
            return ReferenceScoreResult.FullLoss;
        }
        if (line == 6) {
            if (homeScore > awayScore) return ReferenceScoreResult.FullWin;
            if (homeScore == awayScore) return ReferenceScoreResult.FullPush;
            return ReferenceScoreResult.FullLoss;
        }
        if (line == 7) {
            if (homeScore > awayScore) return ReferenceScoreResult.FullWin;
            if (homeScore == awayScore) return ReferenceScoreResult.HalfWin;
            return ReferenceScoreResult.FullLoss;
        }
        if (line == 8) return homeScore >= awayScore ? ReferenceScoreResult.FullWin : ReferenceScoreResult.FullLoss;
        if (line == 9) {
            if (homeScore >= awayScore) return ReferenceScoreResult.FullWin;
            if (awayScore == homeScore + 1) return ReferenceScoreResult.HalfLoss;
            return ReferenceScoreResult.FullLoss;
        }
        if (line == 10) {
            if (homeScore >= awayScore + 3) return ReferenceScoreResult.FullWin;
            if (homeScore == awayScore + 2) return ReferenceScoreResult.HalfWin;
            return ReferenceScoreResult.FullLoss;
        }
        if (line == 11) {
            if (homeScore >= awayScore + 3) return ReferenceScoreResult.FullWin;
            if (homeScore == awayScore + 2) return ReferenceScoreResult.FullPush;
            return ReferenceScoreResult.FullLoss;
        }
        if (homeScore >= awayScore + 4) return ReferenceScoreResult.FullWin;
        if (homeScore == awayScore + 3) return ReferenceScoreResult.FullPush;
        return ReferenceScoreResult.FullLoss;
    }

    function _expectedOuSettlement(uint8 line, uint8 outcome, uint16 totalGoals)
        internal
        pure
        returns (BetSettlementState expectedState, uint256 expectedRefunded, uint256 expectedClaimable)
    {
        ReferenceScoreResult result = _expectedOuOverResult(line, totalGoals);
        if (outcome == 1) {
            result = _oppositeExpectedResult(result);
        }

        uint256 fullPayout = outcome == 0 ? 200 ether : 300 ether;
        uint256 halfPayout = outcome == 0 ? 100 ether : 150 ether;
        if (result == ReferenceScoreResult.FullWin) {
            return (BetSettlementState.WonUnclaimed, 0, fullPayout);
        }
        if (result == ReferenceScoreResult.FullLoss) {
            return (BetSettlementState.Lost, 0, 0);
        }
        if (result == ReferenceScoreResult.FullPush) {
            return (BetSettlementState.Refunded, 100 ether, 0);
        }
        if (result == ReferenceScoreResult.HalfWin) {
            return (BetSettlementState.WonUnclaimed, 50 ether, halfPayout);
        }
        return (BetSettlementState.Lost, 50 ether, 0);
    }

    function _expectedOuOverResult(uint8 line, uint16 totalGoals) internal pure returns (ReferenceScoreResult) {
        if (line == 0) return totalGoals >= 2 ? ReferenceScoreResult.FullWin : ReferenceScoreResult.FullLoss;
        if (line == 1) return totalGoals >= 3 ? ReferenceScoreResult.FullWin : ReferenceScoreResult.FullLoss;
        if (line == 2) return totalGoals >= 4 ? ReferenceScoreResult.FullWin : ReferenceScoreResult.FullLoss;
        if (line == 3) return totalGoals == 0 ? ReferenceScoreResult.FullPush : ReferenceScoreResult.FullWin;
        if (line == 4) return totalGoals >= 1 ? ReferenceScoreResult.FullWin : ReferenceScoreResult.FullLoss;
        if (line == 5) {
            if (totalGoals >= 2) return ReferenceScoreResult.FullWin;
            if (totalGoals == 1) return ReferenceScoreResult.FullPush;
            return ReferenceScoreResult.FullLoss;
        }
        if (line == 6) {
            if (totalGoals >= 3) return ReferenceScoreResult.FullWin;
            if (totalGoals == 2) return ReferenceScoreResult.HalfWin;
            return ReferenceScoreResult.FullLoss;
        }
        if (line == 7) {
            if (totalGoals >= 3) return ReferenceScoreResult.FullWin;
            if (totalGoals == 2) return ReferenceScoreResult.FullPush;
            return ReferenceScoreResult.FullLoss;
        }
        if (line == 8) {
            if (totalGoals >= 3) return ReferenceScoreResult.FullWin;
            if (totalGoals == 2) return ReferenceScoreResult.HalfLoss;
            return ReferenceScoreResult.FullLoss;
        }
        if (line == 9) {
            if (totalGoals >= 4) return ReferenceScoreResult.FullWin;
            if (totalGoals == 3) return ReferenceScoreResult.HalfWin;
            return ReferenceScoreResult.FullLoss;
        }
        if (totalGoals >= 4) return ReferenceScoreResult.FullWin;
        if (totalGoals == 3) return ReferenceScoreResult.FullPush;
        return ReferenceScoreResult.FullLoss;
    }

    function _oppositeExpectedResult(ReferenceScoreResult result) internal pure returns (ReferenceScoreResult) {
        if (result == ReferenceScoreResult.FullWin) return ReferenceScoreResult.FullLoss;
        if (result == ReferenceScoreResult.FullLoss) return ReferenceScoreResult.FullWin;
        if (result == ReferenceScoreResult.HalfWin) return ReferenceScoreResult.HalfLoss;
        if (result == ReferenceScoreResult.HalfLoss) return ReferenceScoreResult.HalfWin;
        return ReferenceScoreResult.FullPush;
    }

    function _bettor(string memory label, uint256 i) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encode(label, i)))));
    }

    function _slice(bytes32[] memory values, uint256 start, uint256 length)
        internal
        pure
        returns (bytes32[] memory result)
    {
        result = new bytes32[](length);
        for (uint256 i = 0; i < length; ++i) {
            result[i] = values[start + i];
        }
    }
}

interface BettingPoolStorageEvents {
    event MarketSettlementFinalized(
        bytes32 indexed marketId,
        uint8 resultKind,
        bool scoreSettled,
        uint16 homeScore,
        uint16 awayScore,
        uint256 grossPayout,
        uint256 lpMarginShare,
        uint256 platformMarginShare,
        uint256 quoteVersion
    );
}
