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
import {ParlayBet, ParlayLegInput, ParlayState} from "../src/shared/types/ParlayTypes.sol";
import {OddMvpTestBootstrap} from "./helpers/OddMvpTestBootstrap.sol";

contract SettlementNetLossHotfixTest is OddMvpTestBootstrap {
    address internal admin = address(0xA11CE);
    address internal treasury = address(0xBEEF);
    address internal user = address(0xCAFE);
    address internal user2 = address(0xCAFE2);

    uint256 internal constant INITIAL_RESERVE = 1_000_000 ether;

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

        _bootstrapOddMvpToken(odd, admin, treasury, address(staking), address(liquidity), address(betting));

        vm.startPrank(admin);
        betting.setSettlementModule(address(new BettingSettlementModule()));
        betting.setBetModule(address(new BettingBetModule()));
        betting.setMarketModule(address(new BettingMarketModule()));
        betting.setReferralModule(address(new BettingReferralModule()));
        betting.setParlayModule(address(new BettingParlayModule()));
        betting.initializeV2(treasury);
        staking.initializeV2(address(betting));
        liquidity.setBettingPool(address(betting));
        odd.transfer(user, 10_000 ether);
        odd.transfer(user2, 10_000 ether);
        odd.approve(address(betting), type(uint256).max);
        betting.addPlatformReserve(INITIAL_RESERVE);
        vm.stopPrank();

        vm.prank(user);
        odd.approve(address(betting), type(uint256).max);
        vm.prank(user2);
        odd.approve(address(betting), type(uint256).max);
    }

    function testColdStartOrdinarySettlementDoesNotDebitReserveWhenSelfFunded() public {
        bytes32 marketId = _openMarket(keccak256("ordinary-self-funded"), 1, 0, 2, 18_000);
        bytes32 winBet = _placeBet(user, marketId, 0, 1_000 ether);
        bytes32 loseBet = _placeBet(user2, marketId, 1, 1_000 ether);
        bytes32[] memory betIds = _pair(winBet, loseBet);

        uint256 reserveBefore = betting.platformReserve();
        assertEq(betting.taxBuffer(), 0);
        assertEq(liquidity.getRequestableLiquidity(), 0);

        _settleByScore(marketId, 1, 0, betIds);

        assertEq(betting.platformReserve(), reserveBefore + 200 ether);
        assertEq(betting.lpLossOffsetRemaining(), 0);
        assertEq(betting.accountedBalance(), odd.balanceOf(address(betting)));
    }

    function testColdStartOrdinarySettlementDebitsOnlyTrueDeficit() public {
        bytes32 marketId = _openMarket(keccak256("ordinary-true-deficit"), 1, 0, 2, 25_000);
        bytes32 winBet = _placeBet(user, marketId, 0, 1_000 ether);
        bytes32[] memory betIds = _single(winBet);

        uint256 reserveBefore = betting.platformReserve();
        assertEq(betting.taxBuffer(), 0);
        assertEq(liquidity.getRequestableLiquidity(), 0);

        _settleByScore(marketId, 1, 0, betIds);

        uint256 grossPayout = 2_500 ether;
        uint256 totalMargin = 100 ether;
        uint256 selfFundedPayout = 900 ether;
        uint256 trueDeficit = grossPayout - selfFundedPayout;
        assertEq(trueDeficit, 1_600 ether);
        assertEq(betting.platformReserve(), reserveBefore + totalMargin - trueDeficit);
        assertEq(betting.lpLossOffsetRemaining(), 0);
        assertEq(betting.accountedBalance(), odd.balanceOf(address(betting)));
    }

    function testColdStartParlaySettlementDebitsOnlyTrueDeficit() public {
        bytes32 marketA = _openMarket(keccak256("parlay-hotfix-a"), 0, 0, 3, 20_000);
        bytes32 marketB = _openMarket(keccak256("parlay-hotfix-b"), 0, 0, 3, 20_000);
        ParlayLegInput[] memory legs = new ParlayLegInput[](2);
        legs[0] = _leg(marketA, 0);
        legs[1] = _leg(marketB, 0);

        vm.prank(user);
        bytes32 parlayId = betting.placeParlay(legs, 100 ether, 40_000, block.timestamp + 1 hours, address(0));
        uint256 reserveBefore = betting.platformReserve();
        assertEq(betting.taxBuffer(), 0);
        assertEq(liquidity.getRequestableLiquidity(), 0);

        _finalizeEmptyScoreMarket(marketA, 2, 1);
        _finalizeEmptyScoreMarket(marketB, 1, 0);
        vm.prank(admin);
        betting.settleParlay(parlayId);

        ParlayBet memory settled = _parlay(parlayId);
        assertEq(uint8(settled.state), uint8(ParlayState.WonUnclaimed));
        assertEq(settled.claimablePayout, 400 ether);
        assertEq(betting.platformReserve(), reserveBefore - 300 ether);
        assertEq(betting.lpLossOffsetRemaining(), 0);
        assertEq(betting.accountedBalance(), odd.balanceOf(address(betting)));
    }

    function testFuzzNetLossFormulaMatchesEconomicDeficit(uint96 rawFundingBase, uint96 rawGrossPayout) public pure {
        uint256 fundingBase = bound(uint256(rawFundingBase), 1 ether, 1_000_000 ether);
        uint256 grossPayout = bound(uint256(rawGrossPayout), 0, 2_000_000 ether);
        uint256 totalMargin = fundingBase * 1000 / 10_000;
        uint256 selfFundedPayout = fundingBase - totalMargin;

        uint256 netLoss = grossPayout > selfFundedPayout ? grossPayout - selfFundedPayout : 0;
        uint256 expected = grossPayout + totalMargin > fundingBase ? grossPayout + totalMargin - fundingBase : 0;
        assertEq(netLoss, expected);

        if (grossPayout <= selfFundedPayout) {
            assertEq(netLoss, 0);
        } else {
            assertEq(fundingBase + netLoss, grossPayout + totalMargin);
        }
    }

    function _openMarket(bytes32 matchId, uint8 marketType, uint8 line, uint256 outcomeCount, uint256 odds)
        internal
        returns (bytes32 marketId)
    {
        uint256[] memory baseOdds = new uint256[](outcomeCount);
        for (uint256 i = 0; i < outcomeCount; ++i) {
            baseOdds[i] = odds;
        }
        vm.prank(admin);
        marketId = betting.openMarket(
            matchId,
            marketType,
            line,
            uint64(block.timestamp + 2 hours),
            uint64(block.timestamp + 3 hours),
            baseOdds,
            uint64(block.timestamp)
        );
    }

    function _placeBet(address bettor, bytes32 marketId, uint8 outcome, uint256 amount)
        internal
        returns (bytes32 betId)
    {
        (, uint256 acceptedAmount, uint256 lockedOdds,,) = betting.previewSignal(marketId, outcome, amount);
        (,, uint64 updatedAt, uint256 quoteVersion) = betting.getMarketOdds(marketId);
        QuoteGuardInput memory guard = QuoteGuardInput({
            quoteVersion: quoteVersion,
            quotedAt: updatedAt,
            minOdds: lockedOdds,
            minAcceptedAmount: acceptedAmount,
            deadline: block.timestamp + 1 hours
        });
        vm.prank(bettor);
        (betId,,) = betting.placeBet(marketId, outcome, amount, guard);
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

    function _single(bytes32 betId) internal pure returns (bytes32[] memory betIds) {
        betIds = new bytes32[](1);
        betIds[0] = betId;
    }

    function _pair(bytes32 first, bytes32 second) internal pure returns (bytes32[] memory betIds) {
        betIds = new bytes32[](2);
        betIds[0] = first;
        betIds[1] = second;
    }

    function _proxy(address implementation, bytes memory initData) internal returns (address) {
        return address(new ERC1967Proxy(implementation, initData));
    }
}
