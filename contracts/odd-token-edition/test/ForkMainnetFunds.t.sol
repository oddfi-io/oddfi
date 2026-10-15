// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ForkBase} from "./helpers/ForkBase.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ODDToken} from "../src/modules/token/ODDToken.sol";
import {StakingPool} from "../src/modules/staking/StakingPool.sol";
import {LiquidityPool} from "../src/modules/liquidity/LiquidityPool.sol";
import {BettingPool} from "../src/modules/betting/BettingPool.sol";
import {BettingBetModule} from "../src/modules/betting/BettingBetModule.sol";
import {BettingSettlementModule} from "../src/modules/betting/BettingSettlementModule.sol";
import {QuoteGuardInput} from "../src/shared/types/CommonTypes.sol";
import {PrecisionConstants} from "../src/shared/constants/PrecisionConstants.sol";
import {BetSettlementState} from "../src/shared/types/MarketEnums.sol";

contract ForkMainnetFundsTest is ForkBase {
    function _proxy(address implementation, bytes memory initData) internal returns (address) {
        return address(new ERC1967Proxy(implementation, initData));
    }

    function _freshSystem()
        internal
        returns (ODDToken token, StakingPool stakingPool, LiquidityPool liquidityPool, BettingPool bettingPool)
    {
        token = ODDToken(_proxy(address(new ODDToken()), abi.encodeCall(ODDToken.initialize, (admin, admin))));

        stakingPool = StakingPool(
            _proxy(
                address(new StakingPool()), abi.encodeCall(StakingPool.initialize, (admin, address(token), treasury))
            )
        );

        liquidityPool = LiquidityPool(
            _proxy(
                address(new LiquidityPool()), abi.encodeCall(LiquidityPool.initialize, (admin, address(token), admin))
            )
        );

        BettingSettlementModule settlement = new BettingSettlementModule();
        BettingBetModule betModule = new BettingBetModule();
        bettingPool = BettingPool(
            _proxy(
                address(new BettingPool()),
                abi.encodeCall(
                    BettingPool.initialize, (admin, address(token), address(stakingPool), address(liquidityPool))
                )
            )
        );
        _installBettingModules(bettingPool, settlement, betModule);
        vm.prank(admin);
        stakingPool.initializeV2(address(bettingPool));
        vm.prank(admin);
        liquidityPool.setBettingPool(address(bettingPool));
        _bootstrapForkSystem(token, treasury, address(stakingPool), address(liquidityPool), address(bettingPool));
        vm.prank(admin);
        bettingPool.initializeV2(treasury);

        vm.startPrank(admin);
        token.transfer(user, 2_000_000 ether);
        token.transfer(lpUser, 3_000_000 ether);
        vm.stopPrank();

        vm.prank(user);
        token.approve(address(bettingPool), type(uint256).max);
        vm.prank(lpUser);
        token.approve(address(liquidityPool), type(uint256).max);
    }

    function _guardFresh(BettingPool bettingPool, bytes32 marketId, uint8 outcome, uint256 requestedAmount)
        internal
        view
        returns (QuoteGuardInput memory guard, uint256 acceptedAmount, uint256 lockedOdds)
    {
        (, acceptedAmount, lockedOdds,,) = bettingPool.previewSignal(marketId, outcome, requestedAmount);
        (,, uint64 updatedAt, uint256 quoteVersion) = bettingPool.getMarketOdds(marketId);
        guard = QuoteGuardInput({
            quoteVersion: quoteVersion,
            quotedAt: updatedAt,
            minOdds: lockedOdds,
            minAcceptedAmount: acceptedAmount,
            deadline: block.timestamp + 1 hours
        });
    }

    function testEndToEndPayoutTaxAndReferralFlowsOnFork() public {
        vm.prank(lpUser);
        liquidity.depositGlobal(5_000 ether, 1);
        vm.prank(referrer);
        staking.stake(1_000 ether, 1);

        bytes32 marketId = _openTwoWayMarket(keccak256("fork-funds-normal"), 1, 0);
        (QuoteGuardInput memory guard,, uint256 lockedOdds) = _guard(marketId, 0, 100 ether);
        vm.prank(user);
        (bytes32 betId, uint256 acceptedAmount,) = betting.placeBet(marketId, 0, 100 ether, guard, referrer);

        vm.warp(block.timestamp + 4 hours + 1);
        _settleMarketByScore(marketId, 1, 0);

        uint256 referrerRewardBefore = betting.referrerRewardsOdd(referrer);
        uint256 treasuryBefore = odd.balanceOf(treasury);
        uint256 taxBufferBefore = betting.taxBuffer();
        uint256 lpLossOffsetRemainingBefore = betting.lpLossOffsetRemaining();
        uint256 userBefore = odd.balanceOf(user);

        vm.prank(user);
        betting.claimPayout(betId);

        uint256 gross = acceptedAmount * lockedOdds / PrecisionConstants.ODDS_RATE_SCALE;
        uint256 tax = gross * betting.payoutTaxBps() / PrecisionConstants.BPS_SCALE;
        assertEq(odd.balanceOf(user), userBefore + gross - tax);
        assertGt(betting.referrerRewardsOdd(referrer), referrerRewardBefore);
        assertGt(odd.balanceOf(treasury), treasuryBefore);
        assertLt(betting.lpLossOffsetRemaining(), lpLossOffsetRemainingBefore);
        assertGe(betting.taxBuffer(), taxBufferBefore);
        assertEq(uint8(betting.getBet(betId).settlementState), uint8(BetSettlementState.WonClaimed));
    }

    function testFullPushRefundsBetsOnFork() public {
        bytes32 marketId = _openTwoWayMarket(keccak256("fork-funds-push"), 1, 1);
        (QuoteGuardInput memory guard0,,) = _guard(marketId, 0, 100 ether);
        vm.prank(user);
        (bytes32 betId0, uint256 accepted0,) = betting.placeBet(marketId, 0, 100 ether, guard0);

        (QuoteGuardInput memory guard1,,) = _guard(marketId, 1, 120 ether);
        vm.prank(user2);
        (bytes32 betId1, uint256 accepted1,) = betting.placeBet(marketId, 1, 120 ether, guard1);

        bytes32[] memory betIds = new bytes32[](2);
        betIds[0] = betId0;
        betIds[1] = betId1;

        uint256 before0 = odd.balanceOf(user);
        uint256 before1 = odd.balanceOf(user2);
        vm.warp(block.timestamp + 4 hours + 1);
        vm.prank(admin);
        betting.settleMarketBetsByScore(marketId, 1, 0, betIds);
        vm.prank(admin);
        betting.finalizeMarketSettlement(marketId, 0);
        assertEq(odd.balanceOf(user), before0 + accepted0);
        assertEq(odd.balanceOf(user2), before1 + accepted1);
    }

    function testReferralOddAndUsdtClaimOnForkWithRealRouter() public {
        _ensureOddUsdtPool(50_000 ether, 5_000 ether);
        bytes32 marketId = _openTwoWayMarket(keccak256("fork-funds-referral"), 1, 0);
        (QuoteGuardInput memory guard,,) = _guard(marketId, 0, 100 ether);
        vm.prank(user);
        betting.placeBet(marketId, 0, 100 ether, guard, referrer);

        uint256 oddBefore = odd.balanceOf(referrer);
        vm.prank(referrer);
        betting.claimReferralRewards(0.5 ether);
        assertEq(odd.balanceOf(referrer), oddBefore + 0.5 ether);

        uint256 available = betting.referrerRewardsOdd(referrer);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory signature =
            _referralSignature(referrer, available, 1, deadline, betting.referralClaimNonces(referrer));
        uint256 usdtBefore = IERC20(BSC_USDT).balanceOf(referrer);
        vm.prank(referrer);
        uint256 amountOut = betting.claimUSDTReferralRewards(1, deadline, signature, 0);
        assertGt(amountOut, 0);
        assertEq(IERC20(BSC_USDT).balanceOf(referrer), usdtBefore + amountOut);
        assertEq(betting.referrerRewardsOdd(referrer), 0);
    }

    function testWaterfallConsumesLpThenReserveOnFork() public {
        vm.prank(lpUser);
        liquidity.depositGlobal(1_000 ether, 1);
        vm.prank(admin);
        betting.setRiskConfig(500 ether, 1_000 ether, 2_000 ether);

        bytes32 marketId = _openTwoWayMarket(keccak256("fork-funds-waterfall"), 1, 0);
        (QuoteGuardInput memory guard,,) = _guard(marketId, 0, 1_000 ether);
        vm.prank(user);
        betting.placeBet(marketId, 0, 1_000 ether, guard);

        uint256 reserveBefore = betting.platformReserve();
        vm.warp(block.timestamp + 4 hours + 1);
        _settleMarketByScore(marketId, 1, 0);

        assertGt(betting.lpLossOffsetRemaining(), 0);
        assertLt(betting.platformReserve(), reserveBefore);
    }

    function testClaimPayoutPullsLiquidityForGrossPayoutWhenInternalTaxStaysAccounted() public {
        (ODDToken token,, LiquidityPool liquidityPool, BettingPool bettingPool) = _freshSystem();

        bytes32 matchId = keccak256("fork-funds-gross-liquidity");
        uint256[] memory baseOdds = new uint256[](2);
        baseOdds[0] = 20_000;
        baseOdds[1] = 20_000;
        vm.prank(admin);
        bytes32 marketId = bettingPool.openMarket(
            matchId,
            1,
            0,
            uint64(block.timestamp + 2 hours),
            uint64(block.timestamp + 4 hours),
            baseOdds,
            uint64(block.timestamp)
        );
        vm.prank(lpUser);
        liquidityPool.depositMatch(matchId, 1_000 ether);

        (QuoteGuardInput memory guard,, uint256 lockedOdds) = _guardFresh(bettingPool, marketId, 0, 100 ether);
        vm.prank(user);
        (bytes32 betId, uint256 acceptedAmount,) = bettingPool.placeBet(marketId, 0, 100 ether, guard);

        vm.warp(block.timestamp + 4 hours + 1);
        _settleMarketByScore(bettingPool, marketId, 1, 0);

        uint256 gross = acceptedAmount * lockedOdds / PrecisionConstants.ODDS_RATE_SCALE;
        uint256 tax = gross * bettingPool.payoutTaxBps() / PrecisionConstants.BPS_SCALE;
        uint256 lpPullAmount = gross - token.balanceOf(address(bettingPool));
        uint256 userBefore = token.balanceOf(user);

        vm.prank(user);
        bettingPool.claimPayout(betId);

        (, uint256 windowPaidOut,) = liquidityPool.getPayoutLiquidityWindow(matchId);
        assertEq(windowPaidOut, lpPullAmount);
        assertEq(token.balanceOf(user), userBefore + gross - tax);
        assertEq(uint8(bettingPool.getBet(betId).settlementState), uint8(BetSettlementState.WonClaimed));
    }

    function testEndToEndMatchLpWithdrawAfterPayoutOnFork() public {
        bytes32 matchId = keccak256("fork-funds-match-lp-withdraw");
        bytes32 marketId = _openTwoWayMarket(matchId, 1, 0);
        vm.prank(lpUser);
        uint256 lpPositionId = liquidity.depositMatch(matchId, 1_000 ether);

        (QuoteGuardInput memory guard,,) = _guard(marketId, 0, 100 ether);
        vm.prank(user);
        (bytes32 betId,,) = betting.placeBet(marketId, 0, 100 ether, guard, referrer);

        vm.warp(block.timestamp + 4 hours + 1);
        _settleMarketByScore(marketId, 1, 0);

        vm.prank(user);
        betting.claimPayout(betId);

        vm.prank(lpUser);
        liquidity.requestUnbond(lpPositionId);
        vm.warp(block.timestamp + 3 * PrecisionConstants.SECONDS_PER_DAY);

        uint256 lpBefore = odd.balanceOf(lpUser);
        vm.prank(lpUser);
        liquidity.withdraw(lpPositionId);

        assertGt(odd.balanceOf(lpUser), lpBefore);
    }
}
