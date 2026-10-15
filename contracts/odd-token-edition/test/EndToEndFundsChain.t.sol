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
import {BetSettlementState} from "../src/shared/types/MarketEnums.sol";
import {LpPositionState} from "../src/shared/types/LiquidityEnums.sol";
import {PrecisionConstants} from "../src/shared/constants/PrecisionConstants.sol";
import {StakingConstants} from "../src/shared/constants/StakingConstants.sol";
import {OddMvpTestBootstrap} from "./helpers/OddMvpTestBootstrap.sol";

contract EndToEndFundsChainTest is OddMvpTestBootstrap {
    address internal admin = address(0xA11CE);
    address internal treasury = address(0xBEEF);
    address internal bettor = address(0xCAFE);
    address internal bettor2 = address(0xCAFE2);
    address internal staker = address(0x57A6E);
    address internal lpUser = address(0x1A);

    uint256 internal constant USER_FLOAT = 1_000_000 ether;
    uint256 internal constant STAKE_AMOUNT = 10_000 ether;
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
        assertTrue(odd.transfer(bettor, USER_FLOAT));
        assertTrue(odd.transfer(bettor2, USER_FLOAT));
        assertTrue(odd.transfer(staker, USER_FLOAT));
        assertTrue(odd.transfer(lpUser, USER_FLOAT));
        vm.stopPrank();

        _approve(bettor, address(betting));
        _approve(bettor2, address(betting));
        _approve(staker, address(staking));
        _approve(lpUser, address(liquidity));
    }

    function testFullFundsChainStakingLiquiditySingleAndParlay() public {
        uint256 stakerStart = odd.balanceOf(staker);
        uint256 lpStart = odd.balanceOf(lpUser);

        vm.prank(staker);
        uint256 stakePositionId = staking.stake(STAKE_AMOUNT, 1);
        assertEq(odd.balanceOf(staker), stakerStart - STAKE_AMOUNT);
        assertEq(staking.activeStakeAmount(staker), STAKE_AMOUNT);
        assertEq(staking.accountedOddBalance(), STAKE_AMOUNT);

        vm.prank(lpUser);
        uint256 globalPositionId = liquidity.depositGlobal(GLOBAL_LP, 1);
        assertEq(liquidity.getRequestableLiquidity(), GLOBAL_LP);
        assertEq(liquidity.getGlobalRequestableLiquidity(), GLOBAL_LP);

        bytes32 singleMatchId = keccak256("e2e-single");
        bytes32 singleMarket = _openMarketWithMatch(singleMatchId, 1, 0, 2, 20_000);
        vm.prank(lpUser);
        uint256 matchPositionId = liquidity.depositMatch(singleMatchId, MATCH_LP);
        assertEq(odd.balanceOf(lpUser), lpStart - GLOBAL_LP - MATCH_LP);
        assertEq(liquidity.getRequestableLiquidity(), GLOBAL_LP + MATCH_LP);

        uint256 bettorStart = odd.balanceOf(bettor);
        uint256 bettor2Start = odd.balanceOf(bettor2);
        (bytes32 winningBet,,) = _placeBet(bettor, singleMarket, 0, 100 ether);
        (bytes32 losingBet,,) = _placeBet(bettor2, singleMarket, 1, 100 ether);
        assertEq(odd.balanceOf(bettor), bettorStart - 101 ether);
        assertEq(odd.balanceOf(bettor2), bettor2Start - 101 ether);
        assertEq(odd.balanceOf(treasury), 2 ether);
        _assertBettingBalanceMatchesAccounting();

        _settleByScore(singleMarket, 1, 0, _pair(winningBet, losingBet));
        assertEq(uint8(betting.getBet(winningBet).settlementState), uint8(BetSettlementState.WonUnclaimed));
        assertEq(uint8(betting.getBet(losingBet).settlementState), uint8(BetSettlementState.Lost));
        assertEq(betting.platformReserve(), 4 ether);
        assertEq(liquidity.getRequestableLiquidity(), GLOBAL_LP + MATCH_LP + 16 ether - 20 ether);
        assertEq(liquidity.getGlobalRequestableLiquidity(), GLOBAL_LP + 8 ether - 10 ether);

        vm.prank(bettor);
        betting.claimPayout(winningBet);
        assertEq(odd.balanceOf(bettor), bettorStart + 89 ether);
        assertEq(odd.balanceOf(treasury), 6 ether);
        assertEq(odd.balanceOf(address(staking)), STAKE_AMOUNT + 4 ether);
        assertEq(staking.accountedOddBalance(), STAKE_AMOUNT + 4 ether);
        assertEq(betting.lpLossOffsetRemaining(), 18 ether);
        _assertBettingBalanceMatchesAccounting();

        (uint256 singleReserved, uint256 singlePaid,) = liquidity.getPayoutLiquidityWindow(singleMatchId);
        assertEq(singleReserved, 20 ether);
        assertEq(singlePaid, 16 ether);
        vm.prank(admin);
        betting.releasePayoutReserve(singleMatchId);
        assertEq(betting.lpLossOffsetRemaining(), 14 ether);
        (singleReserved, singlePaid,) = liquidity.getPayoutLiquidityWindow(singleMatchId);
        assertEq(singleReserved, singlePaid);
        assertEq(singlePaid, 16 ether);

        bytes32 parlayMarketA = _openMarketWithMatch(keccak256("e2e-parlay-a"), 0, 0, 3, 20_000);
        bytes32 parlayMarketB = _openMarketWithMatch(keccak256("e2e-parlay-b"), 0, 0, 3, 20_000);
        ParlayLegInput[] memory legs = new ParlayLegInput[](2);
        legs[0] = _leg(parlayMarketA, 0);
        legs[1] = _leg(parlayMarketB, 0);

        vm.prank(bettor2);
        bytes32 parlayId = betting.placeParlay(legs, 100 ether, 40_000, vm.getBlockTimestamp() + 1 hours, address(0));
        assertEq(odd.balanceOf(treasury), 7 ether);
        assertEq(betting.openParlayMaxPayout(), 400 ether);

        _finalizeEmptyScoreMarket(parlayMarketA, 2, 1);
        _finalizeEmptyScoreMarket(parlayMarketB, 1, 0);
        vm.prank(admin);
        betting.settleParlay(parlayId);

        ParlayBet memory settledParlay = _parlay(parlayId);
        assertEq(uint8(settledParlay.state), uint8(ParlayState.WonUnclaimed));
        assertEq(settledParlay.claimablePayout, 400 ether);
        assertEq(betting.openParlayMaxPayout(), 0);
        assertEq(betting.platformReserve(), 6 ether);
        assertEq(liquidity.getRequestableLiquidity(), GLOBAL_LP + MATCH_LP + 8 ether - 310 ether);
        assertEq(liquidity.getGlobalRequestableLiquidity(), GLOBAL_LP + 8 ether - 310 ether);

        vm.prank(bettor2);
        betting.claimParlayPayout(parlayId);
        assertEq(uint8(_parlay(parlayId).state), uint8(ParlayState.WonClaimed));
        assertEq(odd.balanceOf(bettor2), bettor2Start + 178 ether);
        assertEq(odd.balanceOf(treasury), 15 ether);
        assertEq(odd.balanceOf(address(staking)), STAKE_AMOUNT + 12 ether);
        assertEq(staking.accountedOddBalance(), STAKE_AMOUNT + 12 ether);
        assertEq(betting.lpLossOffsetRemaining(), 320 ether);
        _assertBettingBalanceMatchesAccounting();

        (uint256 parlayReserved, uint256 parlayPaid,) = liquidity.getPayoutLiquidityWindow(settledParlay.parlayRiskId);
        assertEq(parlayReserved, 310 ether);
        assertEq(parlayPaid, 306 ether);
        vm.prank(admin);
        betting.releasePayoutReserve(settledParlay.parlayRiskId);
        assertEq(betting.lpLossOffsetRemaining(), 316 ether);
        (parlayReserved, parlayPaid,) = liquidity.getPayoutLiquidityWindow(settledParlay.parlayRiskId);
        assertEq(parlayReserved, parlayPaid);
        assertEq(parlayPaid, 306 ether);

        uint256 outstandingPayout = (singleReserved - singlePaid) + (parlayReserved - parlayPaid);
        assertEq(outstandingPayout, 0);
        assertEq(liquidity.getRequestableLiquidity(), odd.balanceOf(address(liquidity)));

        vm.warp(
            vm.getBlockTimestamp() + StakingConstants.STAKE_PLAN_1_LOCK_DAYS * PrecisionConstants.SECONDS_PER_DAY + 1
        );
        vm.prank(lpUser);
        liquidity.requestUnbond(globalPositionId);
        (uint256 globalWithdrawPreview, int256 globalPnl, LpPositionState globalState) =
            liquidity.previewWithdraw(globalPositionId);
        assertEq(globalWithdrawPreview, 99_702 ether);
        assertEq(globalPnl, -298 ether);
        assertEq(uint8(globalState), uint8(LpPositionState.Unbonding));

        vm.prank(lpUser);
        liquidity.requestUnbond(matchPositionId);
        (uint256 matchWithdrawPreview, int256 matchPnl, LpPositionState matchState) =
            liquidity.previewWithdraw(matchPositionId);
        assertEq(matchWithdrawPreview, 100_000 ether);
        assertEq(matchPnl, 0);
        assertEq(uint8(matchState), uint8(LpPositionState.Unbonding));
        assertEq(liquidity.getRequestableLiquidity(), 0);
        assertEq(liquidity.getGlobalRequestableLiquidity(), 0);

        vm.warp(vm.getBlockTimestamp() + 3 * PrecisionConstants.SECONDS_PER_DAY);
        uint256 lpBeforeWithdraw = odd.balanceOf(lpUser);
        vm.startPrank(lpUser);
        liquidity.withdraw(globalPositionId);
        liquidity.withdraw(matchPositionId);
        vm.stopPrank();
        assertEq(odd.balanceOf(lpUser) - lpBeforeWithdraw, globalWithdrawPreview + matchWithdrawPreview);
        assertEq(odd.balanceOf(address(liquidity)), 0);

        uint256 stakerBeforeUnstake = odd.balanceOf(staker);
        vm.prank(staker);
        staking.unstake(stakePositionId);
        assertEq(odd.balanceOf(staker) - stakerBeforeUnstake, STAKE_AMOUNT + 12 ether);
        assertEq(staking.accountedOddBalance(), 0);
        assertEq(staking.activeStakeAmount(staker), 0);
        assertEq(odd.balanceOf(address(staking)), 0);
    }

    function _approve(address owner, address spender) internal {
        vm.prank(owner);
        odd.approve(spender, type(uint256).max);
    }

    function _openMarketWithMatch(bytes32 matchId, uint8 marketType, uint8 line, uint256 outcomeCount, uint256 odds)
        internal
        returns (bytes32 marketId)
    {
        uint256[] memory baseOdds = new uint256[](outcomeCount);
        for (uint256 i = 0; i < outcomeCount; ++i) {
            baseOdds[i] = odds;
        }
        uint256 nowTs = vm.getBlockTimestamp();
        uint64 matchStartTime = uint64(nowTs + 2 hours);
        vm.prank(admin);
        marketId = betting.openMarket(
            matchId, marketType, line, matchStartTime, uint64(matchStartTime + 1 hours), baseOdds, uint64(nowTs)
        );
    }

    function _placeBet(address user, bytes32 marketId, uint8 outcome, uint256 amount)
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
            deadline: vm.getBlockTimestamp() + 1 hours
        });
        vm.prank(user);
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

    function _pair(bytes32 first, bytes32 second) internal pure returns (bytes32[] memory betIds) {
        betIds = new bytes32[](2);
        betIds[0] = first;
        betIds[1] = second;
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

    function _assertBettingBalanceMatchesAccounting() internal view {
        assertEq(odd.balanceOf(address(betting)), betting.accountedBalance());
    }

    function _proxy(address implementation, bytes memory initData) internal returns (address) {
        return address(new ERC1967Proxy(implementation, initData));
    }
}
