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
import {BettingParlayLens} from "../src/modules/betting/BettingParlayLens.sol";
import {QuoteGuardInput} from "../src/shared/types/CommonTypes.sol";
import {BetSettlementState} from "../src/shared/types/MarketEnums.sol";
import {
    ParlayBet,
    ParlayEstimatedValue,
    ParlayLegInput,
    ParlayLegResult,
    ParlayPreview,
    ParlayState
} from "../src/shared/types/ParlayTypes.sol";
import {OddMvpTestBootstrap} from "./helpers/OddMvpTestBootstrap.sol";

contract ParlayModuleTest is OddMvpTestBootstrap {
    address internal admin = address(0xA11CE);
    address internal treasury = address(0xBEEF);
    address internal user = address(0xCAFE);
    address internal lpUser = address(0x1A);

    ODDToken internal odd;
    StakingPool internal staking;
    LiquidityPool internal liquidity;
    BettingPool internal betting;
    BettingSettlementModule internal settlement;
    BettingBetModule internal betModule;
    BettingParlayModule internal parlayModule;
    BettingParlayLens internal lens;

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

        settlement = new BettingSettlementModule();
        betModule = new BettingBetModule();
        parlayModule = new BettingParlayModule();
        lens = new BettingParlayLens();

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
        assertTrue(odd.transfer(user, 100_000 ether));
        assertTrue(odd.transfer(lpUser, 1_000_000 ether));
        vm.stopPrank();

        vm.startPrank(user);
        odd.approve(address(betting), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(lpUser);
        odd.approve(address(liquidity), type(uint256).max);
        liquidity.depositGlobal(500_000 ether, 0);
        vm.stopPrank();
    }

    function testParlayFullWinClaimAndEstimatedValue() public {
        bytes32 marketA = _openMarketWithMatch(keccak256("parlay-a"), 0, 0, 3, 20_000);
        bytes32 marketB = _openMarketWithMatch(keccak256("parlay-b"), 0, 0, 3, 20_000);

        ParlayLegInput[] memory legs = new ParlayLegInput[](2);
        legs[0] = _leg(marketA, 0);
        legs[1] = _leg(marketB, 0);

        uint256 userBefore = odd.balanceOf(user);
        vm.prank(user);
        bytes32 parlayId = betting.placeParlay(legs, 100 ether, 39_000, block.timestamp + 1 hours, address(0));

        ParlayBet memory placed = _parlay(parlayId);
        assertEq(uint8(placed.state), uint8(ParlayState.Pending));
        assertEq(placed.stake, 100 ether);
        assertEq(placed.maxPayout, 400 ether);
        assertEq(betting.openParlayMaxPayout(), 400 ether);

        _finalizeMarket(marketA, 2, 1);
        _finalizeMarket(marketB, 1, 0);

        ParlayEstimatedValue memory estimated = lens.estimateParlayValue(address(betting), user, parlayId);
        assertEq(estimated.estimatedValue, 400 ether);
        assertEq(estimated.floatingPnL, 300 ether);
        assertTrue(estimated.isFinal);

        ParlayEstimatedValue memory poolEstimated = betting.estimateParlayValue(user, parlayId);
        assertEq(poolEstimated.estimatedValue, estimated.estimatedValue);
        assertEq(poolEstimated.floatingPnL, estimated.floatingPnL);
        assertTrue(poolEstimated.isFinal);

        estimated = lens.estimateParlayValue(address(betting), address(0xBAD), parlayId);
        assertEq(estimated.stake, 0);
        assertEq(estimated.maxPayout, 0);
        assertEq(estimated.estimatedValue, 0);
        assertEq(estimated.floatingPnL, 0);

        vm.prank(admin);
        betting.settleParlay(parlayId);

        ParlayBet memory settled = _parlay(parlayId);
        assertEq(uint8(settled.state), uint8(ParlayState.WonUnclaimed));
        assertEq(settled.claimablePayout, 400 ether);
        assertEq(betting.openParlayMaxPayout(), 0);

        vm.expectRevert();
        lens.estimateParlayValue(address(betting), user, parlayId);

        (bool won, uint256 reward) = parlayModule.getParlayClaimStatus(address(betting), user, parlayId);
        uint256 tax = 400 ether * uint256(betting.payoutTaxBps()) / 10_000;
        uint256 netPayout = 400 ether - tax;
        assertTrue(won);
        assertEq(reward, netPayout);

        (won, reward) = betting.getParlayClaimStatus(user, parlayId);
        assertTrue(won);
        assertEq(reward, netPayout);

        (won, reward) = parlayModule.getParlayClaimStatus(address(betting), address(0xBAD), parlayId);
        assertFalse(won);
        assertEq(reward, 0);

        vm.prank(user);
        betting.claimParlayPayout(parlayId);

        uint256 totalDeduct = 101 ether;
        assertEq(odd.balanceOf(user), userBefore + netPayout - totalDeduct);
        assertEq(uint8(_parlay(parlayId).state), uint8(ParlayState.WonClaimed));

        (won, reward) = parlayModule.getParlayClaimStatus(address(betting), user, parlayId);
        assertTrue(won);
        assertEq(reward, 0);
        (won, reward) = betting.getParlayClaimStatus(user, parlayId);
        assertTrue(won);
        assertEq(reward, 0);
    }

    function testV3LinesParlayInheritsPushAndHalfSettlement() public {
        bytes32 ahHalfWin = _openMarketWithMatch(keccak256("v3-parlay-ah-half-win"), 1, 10, 2, 20_000);
        bytes32 ouHalfLoss = _openMarketWithMatch(keccak256("v3-parlay-ou-half-loss"), 2, 8, 2, 20_000);
        bytes32 ouPush = _openMarketWithMatch(keccak256("v3-parlay-ou-push"), 2, 10, 2, 20_000);
        bytes32 oneXTwoWin = _openMarketWithMatch(keccak256("v3-parlay-1x2-win"), 0, 0, 3, 20_000);

        ParlayLegInput[] memory legs = new ParlayLegInput[](4);
        legs[0] = _leg(ahHalfWin, 0);
        legs[1] = _leg(ouHalfLoss, 0);
        legs[2] = _leg(ouPush, 0);
        legs[3] = _leg(oneXTwoWin, 0);

        vm.prank(user);
        bytes32 parlayId = betting.placeParlay(legs, 100 ether, 0, block.timestamp + 1 hours, address(0));

        _finalizeMarket(ahHalfWin, 2, 0);
        _finalizeMarket(ouHalfLoss, 2, 0);
        _finalizeMarket(ouPush, 3, 0);
        _finalizeMarket(oneXTwoWin, 1, 0);

        ParlayEstimatedValue memory estimated = lens.estimateParlayValue(address(betting), user, parlayId);
        assertEq(estimated.estimatedValue, 150 ether);
        assertEq(estimated.floatingPnL, 50 ether);
        assertTrue(estimated.isFinal);

        vm.prank(admin);
        betting.settleParlay(parlayId);

        assertEq(uint8(_parlayLegResult(parlayId, 0)), uint8(ParlayLegResult.HalfWin));
        assertEq(uint8(_parlayLegResult(parlayId, 1)), uint8(ParlayLegResult.HalfLoss));
        assertEq(uint8(_parlayLegResult(parlayId, 2)), uint8(ParlayLegResult.FullPush));
        assertEq(uint8(_parlayLegResult(parlayId, 3)), uint8(ParlayLegResult.FullWin));

        ParlayBet memory settled = _parlay(parlayId);
        assertEq(uint8(settled.state), uint8(ParlayState.WonUnclaimed));
        assertEq(settled.claimablePayout, 150 ether);

        vm.prank(user);
        betting.claimParlayPayout(parlayId);
        assertEq(uint8(_parlay(parlayId).state), uint8(ParlayState.WonClaimed));
    }

    function testSingleBetClaimStatusFromSettlementModule() public {
        bytes32 marketId = _openMarketWithMatch(keccak256("single-claim-status"), 0, 0, 3, 20_000);

        QuoteGuardInput memory guard = _guard(marketId, 0);
        vm.prank(user);
        (bytes32 betId,,) = betting.placeBet(marketId, 0, 100 ether, guard);

        (uint256 estimatedValue, int256 floatingPnL) = settlement.estimateBetValue(address(betting), user, betId);
        assertEq(estimatedValue, 100 ether);
        assertEq(floatingPnL, 0);

        (estimatedValue, floatingPnL) = betting.estimateBetValue(user, betId);
        assertEq(estimatedValue, 100 ether);
        assertEq(floatingPnL, 0);

        (estimatedValue, floatingPnL) = settlement.estimateBetValue(address(betting), address(0xBAD), betId);
        assertEq(estimatedValue, 0);
        assertEq(floatingPnL, 0);

        vm.expectRevert();
        settlement.getClaimStatus(address(betting), user, betId);
        vm.expectRevert();
        betting.getClaimStatus(user, betId);

        bytes32[] memory betIds = new bytes32[](1);
        betIds[0] = betId;
        vm.startPrank(admin);
        vm.warp(betting.getMarket(marketId).matchEndTime + 1);
        betting.settleMarketBetsByScore(marketId, 2, 1, betIds);
        betting.finalizeMarketSettlement(marketId, 0);
        vm.stopPrank();

        (bool won, uint256 reward) = settlement.getClaimStatus(address(betting), user, betId);
        uint256 grossPayout = 200 ether;
        uint256 tax = grossPayout * uint256(betting.payoutTaxBps()) / 10_000;
        assertTrue(won);
        assertEq(reward, grossPayout - tax);

        (won, reward) = betting.getClaimStatus(user, betId);
        assertTrue(won);
        assertEq(reward, grossPayout - tax);

        vm.expectRevert();
        settlement.estimateBetValue(address(betting), user, betId);
        vm.expectRevert();
        betting.estimateBetValue(user, betId);

        (won, reward) = settlement.getClaimStatus(address(betting), address(0xBAD), betId);
        assertFalse(won);
        assertEq(reward, 0);

        vm.prank(user);
        betting.claimPayout(betId);
        (won, reward) = settlement.getClaimStatus(address(betting), user, betId);
        assertTrue(won);
        assertEq(reward, 0);
        (won, reward) = betting.getClaimStatus(user, betId);
        assertTrue(won);
        assertEq(reward, 0);
    }

    function testSingleBetEstimateAndClaimStatusLossMatrix() public {
        bytes32 marketId = _openMarketWithMatch(keccak256("single-loss-status"), 0, 0, 3, 20_000);

        QuoteGuardInput memory guard = _guard(marketId, 1);
        vm.prank(user);
        (bytes32 betId,,) = betting.placeBet(marketId, 1, 100 ether, guard);

        _updateThreeWayOdds(marketId, 20_000, 40_000, 20_000);
        (uint256 estimatedValue, int256 floatingPnL) = settlement.estimateBetValue(address(betting), user, betId);
        (, uint256[] memory quotedOdds,,) = betting.getMarketOdds(marketId);
        uint256 expectedEstimatedValue = 100 ether * 20_000 / quotedOdds[1];
        assertEq(estimatedValue, expectedEstimatedValue);
        assertEq(floatingPnL, int256(expectedEstimatedValue) - int256(100 ether));
        assertLt(floatingPnL, 0);

        vm.expectRevert();
        settlement.getClaimStatus(address(betting), user, betId);

        bytes32[] memory betIds = new bytes32[](1);
        betIds[0] = betId;
        vm.startPrank(admin);
        vm.warp(betting.getMarket(marketId).matchEndTime + 1);
        betting.settleMarketBetsByScore(marketId, 2, 1, betIds);
        betting.finalizeMarketSettlement(marketId, 0);
        vm.stopPrank();

        assertEq(uint8(betting.getBet(betId).settlementState), uint8(BetSettlementState.Lost));
        (bool won, uint256 reward) = settlement.getClaimStatus(address(betting), user, betId);
        assertFalse(won);
        assertEq(reward, 0);

        vm.expectRevert();
        settlement.estimateBetValue(address(betting), user, betId);
    }

    function testParlayEstimateAndClaimStatusLossMatrix() public {
        bytes32 marketA = _openMarketWithMatch(keccak256("parlay-loss-a"), 0, 0, 3, 20_000);
        bytes32 marketB = _openMarketWithMatch(keccak256("parlay-loss-b"), 0, 0, 3, 20_000);

        ParlayLegInput[] memory legs = new ParlayLegInput[](2);
        legs[0] = _leg(marketA, 0);
        legs[1] = _leg(marketB, 0);

        vm.prank(user);
        bytes32 parlayId = betting.placeParlay(legs, 100 ether, 39_000, block.timestamp + 1 hours, address(0));

        _updateThreeWayOdds(marketA, 40_000, 20_000, 20_000);
        ParlayEstimatedValue memory estimated = lens.estimateParlayValue(address(betting), user, parlayId);
        assertEq(estimated.estimatedValue, 50 ether);
        assertEq(estimated.floatingPnL, -50 ether);
        assertEq(estimated.unresolvedLegCount, 2);
        assertFalse(estimated.isFinal);

        ParlayEstimatedValue memory poolEstimated = betting.estimateParlayValue(user, parlayId);
        assertEq(poolEstimated.estimatedValue, estimated.estimatedValue);
        assertEq(poolEstimated.floatingPnL, estimated.floatingPnL);
        assertEq(poolEstimated.unresolvedLegCount, estimated.unresolvedLegCount);

        estimated = lens.estimateParlayValue(address(betting), address(0xBAD), parlayId);
        assertEq(estimated.stake, 0);
        assertEq(estimated.estimatedValue, 0);
        assertEq(estimated.floatingPnL, 0);

        vm.expectRevert();
        parlayModule.getParlayClaimStatus(address(betting), user, parlayId);

        _finalizeMarket(marketA, 1, 2);
        _finalizeMarket(marketB, 2, 1);

        estimated = lens.estimateParlayValue(address(betting), user, parlayId);
        assertTrue(estimated.hasFullLoss);
        assertEq(estimated.estimatedValue, 0);
        assertEq(estimated.floatingPnL, -100 ether);

        (bool won, uint256 reward) = parlayModule.getParlayClaimStatus(address(betting), user, parlayId);
        assertFalse(won);
        assertEq(reward, 0);
        (won, reward) = betting.getParlayClaimStatus(user, parlayId);
        assertFalse(won);
        assertEq(reward, 0);

        vm.prank(admin);
        betting.settleParlay(parlayId);
        assertEq(uint8(_parlay(parlayId).state), uint8(ParlayState.Lost));

        (won, reward) = parlayModule.getParlayClaimStatus(address(betting), user, parlayId);
        assertFalse(won);
        assertEq(reward, 0);

        vm.expectRevert();
        lens.estimateParlayValue(address(betting), user, parlayId);
    }

    function testRawPayoutAboveCapStillPlacesWithCappedMaxPayout() public {
        ParlayLegInput[] memory legs = new ParlayLegInput[](6);
        for (uint256 i = 0; i < 6; ++i) {
            bytes32 marketId = _openMarketWithMatch(bytes32(uint256(100 + i)), 0, 0, 3, 20_000);
            legs[i] = _leg(marketId, 0);
        }

        ParlayPreview memory preview = lens.previewParlay(address(betting), legs, 1_000 ether, user);
        assertTrue(preview.cappedByPayout);
        assertEq(preview.maxPayout, 30_000 ether);

        vm.prank(user);
        bytes32 parlayId = betting.placeParlay(legs, 1_000 ether, 0, block.timestamp + 1 hours, address(0));
        assertEq(_parlay(parlayId).maxPayout, 30_000 ether);
        assertEq(betting.openParlayMaxPayout(), 30_000 ether);
    }

    function testSameMatchParlayReverts() public {
        bytes32 matchId = keccak256("same-match");
        bytes32 oneXTwo = _openMarketWithMatch(matchId, 0, 0, 3, 20_000);
        bytes32 overUnder = _openMarketWithMatch(matchId, 2, 1, 2, 20_000);

        ParlayLegInput[] memory legs = new ParlayLegInput[](2);
        legs[0] = _leg(oneXTwo, 0);
        legs[1] = _leg(overUnder, 0);

        vm.expectRevert();
        vm.prank(user);
        betting.placeParlay(legs, 100 ether, 0, block.timestamp + 1 hours, address(0));
    }

    function _finalizeMarket(bytes32 marketId, uint16 homeScore, uint16 awayScore) internal {
        bytes32[] memory empty = new bytes32[](0);
        vm.startPrank(admin);
        vm.warp(betting.getMarket(marketId).matchEndTime + 1);
        betting.settleMarketBetsByScore(marketId, homeScore, awayScore, empty);
        betting.finalizeMarketSettlement(marketId, 0);
        vm.stopPrank();
    }

    function _leg(bytes32 marketId, uint8 outcome) internal view returns (ParlayLegInput memory input) {
        (,, uint64 updatedAt, uint256 quoteVersion) = betting.getMarketOdds(marketId);
        (, uint256[] memory quotedOdds,,) = betting.getMarketOdds(marketId);
        input = ParlayLegInput({
            marketId: marketId,
            outcome: outcome,
            quoteVersion: quoteVersion,
            quotedAt: updatedAt,
            minOdds: quotedOdds[outcome]
        });
    }

    function _guard(bytes32 marketId, uint8 outcome) internal view returns (QuoteGuardInput memory guard) {
        (,, uint64 updatedAt, uint256 quoteVersion) = betting.getMarketOdds(marketId);
        (, uint256[] memory quotedOdds,,) = betting.getMarketOdds(marketId);
        guard = QuoteGuardInput({
            quoteVersion: quoteVersion,
            quotedAt: updatedAt,
            minOdds: quotedOdds[outcome],
            minAcceptedAmount: 100 ether,
            deadline: block.timestamp + 1 hours
        });
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

    function _parlayLegResult(bytes32 parlayId, uint256 index) internal view returns (ParlayLegResult result) {
        (,,,,,,, result) = betting.parlayLegs(parlayId, index);
    }

    function _openMarketWithMatch(bytes32 matchId, uint8 marketType, uint8 line, uint256 outcomeCount, uint256 odds)
        internal
        returns (bytes32 marketId)
    {
        uint256[] memory baseOdds = new uint256[](outcomeCount);
        for (uint256 i = 0; i < outcomeCount; ++i) {
            baseOdds[i] = odds;
        }
        uint64 matchStartTime = uint64(block.timestamp + 10 hours);
        vm.prank(admin);
        marketId = betting.openMarket(
            matchId,
            marketType,
            line,
            matchStartTime,
            uint64(matchStartTime + 1 hours),
            baseOdds,
            uint64(block.timestamp)
        );
    }

    function _updateThreeWayOdds(bytes32 marketId, uint256 homeOdds, uint256 drawOdds, uint256 awayOdds) internal {
        uint256[] memory baseOdds = new uint256[](3);
        baseOdds[0] = homeOdds;
        baseOdds[1] = drawOdds;
        baseOdds[2] = awayOdds;
        vm.prank(admin);
        betting.updateOdds(marketId, baseOdds, uint64(block.timestamp));
    }

    function _proxy(address implementation, bytes memory initData) internal returns (address) {
        return address(new ERC1967Proxy(implementation, initData));
    }
}
