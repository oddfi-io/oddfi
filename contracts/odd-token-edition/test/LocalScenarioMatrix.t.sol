// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ODDToken} from "../src/modules/token/ODDToken.sol";
import {StakingPool} from "../src/modules/staking/StakingPool.sol";
import {LiquidityPool} from "../src/modules/liquidity/LiquidityPool.sol";
import {BettingPool} from "../src/modules/betting/BettingPool.sol";
import {BettingBetModule} from "../src/modules/betting/BettingBetModule.sol";
import {BettingMarketModule} from "../src/modules/betting/BettingMarketModule.sol";
import {BettingReferralModule} from "../src/modules/betting/BettingReferralModule.sol";
import {BettingSettlementModule} from "../src/modules/betting/BettingSettlementModule.sol";
import {IPancakeV3SwapRouterLike} from "../src/modules/betting/interfaces/IPancakeV3SwapRouterLike.sol";
import {QuoteGuardInput} from "../src/shared/types/CommonTypes.sol";
import {BetSettlementState, MarketStatus} from "../src/shared/types/MarketEnums.sol";
import {LpPositionState} from "../src/shared/types/LiquidityEnums.sol";
import {PrecisionConstants} from "../src/shared/constants/PrecisionConstants.sol";
import {StakingConstants} from "../src/shared/constants/StakingConstants.sol";
import {LiquidityConstants} from "../src/shared/constants/LiquidityConstants.sol";
import {TokenConstants} from "../src/shared/constants/TokenConstants.sol";
import {OddMvpTestBootstrap} from "./helpers/OddMvpTestBootstrap.sol";

contract LocalScenarioUsdt is ERC20 {
    constructor() ERC20("Local USDT", "USDT") {}

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract LocalScenarioRouter {
    using SafeERC20 for IERC20;

    function exactInputSingle(IPancakeV3SwapRouterLike.ExactInputSingleParams calldata params)
        external
        returns (uint256 amountOut)
    {
        IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);
        amountOut = params.amountIn;
        if (amountOut < params.amountOutMinimum) amountOut = params.amountOutMinimum;
        LocalScenarioUsdt(params.tokenOut).mint(params.recipient, amountOut);
    }
}

contract LocalScenarioMatrixTest is OddMvpTestBootstrap {
    using MessageHashUtils for bytes32;

    uint256 internal constant SIGNER_PK = 0xA12345;

    address internal admin = address(0xA11CE);
    address internal treasury = address(0xBEEF);
    address internal user = address(0xCAFE);
    address internal user2 = address(0xCAFE2);
    address internal user3 = address(0xCAFE3);
    address internal user4 = address(0xCAFE4);
    address internal referrer = address(0xF00D);
    address internal lpUser = address(0x1A);
    address internal outsider = address(0xBAD);

    ODDToken internal odd;
    StakingPool internal staking;
    LiquidityPool internal liquidity;
    BettingPool internal betting;
    LocalScenarioUsdt internal usdt;
    LocalScenarioRouter internal router;

    function setUp() public {
        (odd, staking, liquidity, betting) = _deploySystem(2_000_000 ether);
        usdt = new LocalScenarioUsdt();
        router = new LocalScenarioRouter();
        vm.startPrank(admin);
        betting.setReferralClaimConfig(vm.addr(SIGNER_PK), 2500);
        odd.setDexRestrictedTarget(address(router), true);
        betting.setReferralSwapConfig(address(router), address(usdt), address(router));
        vm.stopPrank();
    }

    function testDEP001ToDEP005_TokenPermissionsPauseAndAccessNegativePaths() public {
        assertEq(odd.totalSupply(), TokenConstants.TOTAL_SUPPLY);

        uint256 beforeUser2 = odd.balanceOf(user2);
        vm.prank(user);
        assertTrue(odd.transfer(user2, 123.456 ether));
        assertEq(odd.balanceOf(user2), beforeUser2 + 123.456 ether);

        vm.expectRevert();
        vm.prank(outsider);
        odd.pause();
        vm.expectRevert();
        vm.prank(outsider);
        betting.setTaxConfig(100, 500, 200, 100, 100, 100);
        vm.expectRevert();
        vm.prank(outsider);
        betting.addPlatformReserve(1 ether);

        vm.prank(admin);
        odd.pause();
        vm.prank(user);
        (bool pausedTransferOk,) = address(odd).call(abi.encodeCall(IERC20.transfer, (user2, 1 ether)));
        assertFalse(pausedTransferOk);
        vm.prank(admin);
        odd.unpause();
        vm.prank(user);
        assertTrue(odd.transfer(user2, 1 ether));

        bytes32 marketId = _openMarket("dep-unauthorized-settlement", 1, 0, 2);
        vm.warp(betting.getMarket(marketId).matchEndTime + 1);
        vm.expectRevert();
        vm.prank(outsider);
        betting.finalizeMarketSettlement(marketId, 0);
    }

    function testREF001ToREF005_ReferralBindingAutoBindingAndStakeDecoupling() public {
        vm.prank(user);
        betting.bindReferrer(referrer);
        assertEq(betting.referrers(user), referrer);

        vm.expectRevert();
        vm.prank(user);
        betting.bindReferrer(user2);
        vm.expectRevert();
        vm.prank(user2);
        betting.bindReferrer(user2);
        vm.expectRevert();
        vm.prank(user2);
        betting.bindReferrer(address(0));

        bytes32 marketId = _openMarket("ref-auto-bind", 1, 0, 2);
        uint256 beforeReward = betting.referrerRewardsOdd(referrer);
        _placeBet(user2, marketId, 0, 100 ether, referrer);

        assertEq(betting.referrers(user2), referrer);
        assertEq(betting.referrerRewardsOdd(referrer), beforeReward + 1 ether);
        assertEq(staking.getActiveStakeAmount(referrer), 0);
    }

    function testTAX001ToTAX017_TaxSnapshotsClaimsNoTaxBranchesAndStaticBounds() public {
        vm.startPrank(user3);
        staking.stake(1_000 ether, 1);
        vm.stopPrank();

        bytes32 marketId = _openMarket("tax-snapshot", 1, 0, 2);
        bytes32 winBet = _placeBet(user, marketId, 0, 100 ether, referrer);
        _placeBet(user2, marketId, 1, 100 ether, address(0));
        uint256 referrerBeforeClaim = betting.referrerRewardsOdd(referrer);

        vm.warp(betting.getMarket(marketId).matchEndTime + 1);
        _settleMarketByScore(marketId, 1, 0);
        BettingPool.Bet memory settledBet = betting.getBet(winBet);
        assertEq(settledBet.payoutTaxRateBps, 500);
        assertEq(settledBet.taxAllocStakingBps, 200);
        assertEq(settledBet.taxAllocTaxBufferBps, 100);
        assertEq(settledBet.taxAllocReferrerBps, 100);
        assertEq(settledBet.referrerSnapshot, referrer);

        vm.prank(admin);
        betting.setTaxConfig(200, 600, 300, 100, 100, 100);

        uint256 accRewardBefore = staking.accRewardPerShare();
        uint256 taxBufferBefore = betting.taxBuffer();
        vm.prank(user);
        betting.claimPayout(winBet);
        assertGt(staking.accRewardPerShare(), accRewardBefore);
        assertEq(betting.taxBuffer(), taxBufferBefore + 2 ether);
        assertEq(betting.referrerRewardsOdd(referrer), referrerBeforeClaim + 2 ether);

        bytes32 lateMarket = _openMarket("tax-late-binding-before-settle", 1, 0, 2);
        bytes32 lateBet = _placeBet(user4, lateMarket, 0, 100 ether, address(0));
        vm.prank(user4);
        betting.bindReferrer(referrer);
        vm.warp(betting.getMarket(lateMarket).matchEndTime + 1);
        _settleMarketByScore(lateMarket, 1, 0);
        assertEq(betting.getBet(lateBet).referrerSnapshot, referrer);

        bytes32 noRetroMarket = _openMarket("tax-late-binding-after-settle", 1, 0, 2);
        bytes32 noRetroBet = _placeBet(address(0xCAFE5), noRetroMarket, 0, 100 ether, address(0));
        vm.warp(betting.getMarket(noRetroMarket).matchEndTime + 1);
        _settleMarketByScore(noRetroMarket, 1, 0);
        assertEq(betting.getBet(noRetroBet).referrerSnapshot, address(0));

        bytes32 pushMarket = _openMarket("tax-push-no-payout-tax", 1, 1, 2);
        bytes32 pushBet = _placeBet(address(0xCAFE6), pushMarket, 0, 100 ether, address(0));
        uint256 bufferBeforePush = betting.taxBuffer();
        vm.warp(betting.getMarket(pushMarket).matchEndTime + 1);
        _settleMarketByScore(pushMarket, 1, 0);
        assertEq(uint8(betting.getBet(pushBet).settlementState), uint8(BetSettlementState.Refunded));
        assertEq(betting.taxBuffer(), bufferBeforePush);

        vm.expectRevert();
        vm.prank(referrer);
        betting.claimReferralRewards(0);
        uint256 claimable = betting.referrerRewardsOdd(referrer);
        vm.prank(referrer);
        betting.claimReferralRewards(1 ether);
        assertEq(betting.referrerRewardsOdd(referrer), claimable - 1 ether);

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory signature = _referralSignature(
            referrer, betting.referrerRewardsOdd(referrer), 1, deadline, betting.referralClaimNonces(referrer)
        );
        vm.prank(referrer);
        uint256 usdtOut = betting.claimUSDTReferralRewards(1, deadline, signature, 1);
        assertGt(usdtOut, 0);
    }

    function testBET001ToBET009_BettingLifecycleSettlementClaimPauseAndRefundNegativePaths() public {
        bytes32 marketId = _openMarket("bet-lifecycle", 1, 0, 2);
        bytes32 winBet = _placeBet(user, marketId, 0, 100 ether, address(0));
        bytes32 loseBet = _placeBet(user2, marketId, 1, 100 ether, address(0));

        vm.expectRevert();
        vm.prank(user);
        betting.claimPayout(winBet);

        BettingPool.MarketConfig memory openMarketConfig = betting.getMarket(marketId);
        assertEq(openMarketConfig.lockAt, openMarketConfig.matchEndTime);
        (QuoteGuardInput memory lockedGuard,,) = _guard(betting, marketId, 0, 100 ether);
        (,,, uint256 beforeLockVersion) = betting.getMarketOdds(marketId);
        vm.expectRevert();
        vm.prank(outsider);
        betting.lockMarket(marketId);
        vm.prank(admin);
        betting.lockMarket(marketId);
        BettingPool.MarketConfig memory lockedMarketConfig = betting.getMarket(marketId);
        assertEq(uint8(lockedMarketConfig.status), uint8(MarketStatus.Locked));
        assertEq(lockedMarketConfig.lockAt, uint64(block.timestamp));
        (,,, uint256 afterLockVersion) = betting.getMarketOdds(marketId);
        assertEq(afterLockVersion, beforeLockVersion + 1);
        vm.expectRevert();
        vm.prank(user3);
        betting.placeBet(marketId, 0, 100 ether, lockedGuard);

        vm.warp(betting.getMarket(marketId).matchEndTime + 1);
        bytes32[] memory allBetIds = betting.getMarketBetIds(marketId, 0, 20);
        bytes32[] memory first = new bytes32[](1);
        first[0] = allBetIds[0];
        vm.prank(admin);
        betting.settleMarketBetsByScore(marketId, 1, 0, first);
        vm.expectRevert();
        vm.prank(admin);
        betting.finalizeMarketSettlement(marketId, 0);

        bytes32[] memory second = new bytes32[](1);
        second[0] = allBetIds[1];
        vm.prank(admin);
        betting.settleMarketBetsByScore(marketId, 1, 0, second);
        vm.prank(admin);
        betting.finalizeMarketSettlement(marketId, 0);

        assertEq(uint8(betting.getBet(winBet).settlementState), uint8(BetSettlementState.WonUnclaimed));
        assertEq(uint8(betting.getBet(loseBet).settlementState), uint8(BetSettlementState.Lost));
        vm.warp(block.timestamp + 180 days);
        vm.prank(user);
        betting.claimPayout(winBet);
        vm.expectRevert();
        vm.prank(user);
        betting.claimPayout(winBet);
        vm.expectRevert();
        vm.prank(user2);
        betting.claimPayout(loseBet);

        bytes32 pausedMarket = _openMarket("bet-paused-settlement", 1, 0, 2);
        bytes32 pausedBet = _placeBet(user3, pausedMarket, 0, 100 ether, address(0));
        (QuoteGuardInput memory pausedGuard,,) = _guard(betting, pausedMarket, 1, 100 ether);
        vm.prank(admin);
        betting.pause();
        vm.expectRevert();
        vm.prank(user4);
        betting.placeBet(pausedMarket, 1, 100 ether, pausedGuard);
        vm.warp(betting.getMarket(pausedMarket).matchEndTime + 1);
        _settleMarketByScore(pausedMarket, 1, 0);
        vm.expectRevert();
        vm.prank(user3);
        betting.claimPayout(pausedBet);
        vm.prank(admin);
        betting.unpause();
        vm.prank(user3);
        betting.claimPayout(pausedBet);

        bytes32 refundMarket = _openMarket("bet-refund-after-end", 1, 0, 2);
        bytes32 refundBet = _placeBet(address(0xCAFE7), refundMarket, 0, 100 ether, address(0));
        bytes32[] memory refundIds = _singleBetId(refundBet);
        uint256[] memory refundAmounts = new uint256[](1);
        refundAmounts[0] = 100 ether;
        vm.expectRevert();
        vm.prank(admin);
        betting.finalizeMarketSettlement(refundMarket, 1);
        vm.warp(betting.getMarket(refundMarket).matchEndTime + 1);
        vm.prank(admin);
        betting.finalizeMarketSettlement(refundMarket, 1);
        vm.prank(admin);
        betting.refundBets(refundMarket, refundIds, refundAmounts);
        assertEq(uint8(betting.getBet(refundBet).settlementState), uint8(BetSettlementState.Refunded));
    }

    function testBET010_UnlockedMarketAcceptsLiveBetsUntilMatchEnd() public {
        bytes32 marketId = _openMarket("bet-live-unlocked", 1, 0, 2);
        BettingPool.MarketConfig memory market = betting.getMarket(marketId);
        vm.warp(uint256(market.matchStartTime) + 30 minutes);

        uint256[] memory liveOdds = new uint256[](2);
        liveOdds[0] = 20_100;
        liveOdds[1] = 19_900;
        vm.prank(admin);
        betting.updateOdds(marketId, liveOdds, uint64(block.timestamp));

        bytes32 liveBet = _placeBet(user3, marketId, 0, 100 ether, address(0));
        assertEq(uint8(betting.getBet(liveBet).settlementState), uint8(BetSettlementState.Pending));

        market = betting.getMarket(marketId);
        vm.warp(market.matchEndTime);
        vm.expectRevert();
        betting.previewSignal(marketId, 0, 100 ether);
    }

    function testSTK001ToSTK017_StakingLifecycleRewardsVipPauseAndFailurePaths() public {
        uint256 treasuryBefore = odd.balanceOf(treasury);
        vm.prank(admin);
        assertTrue(odd.transfer(address(staking), 50 ether));
        vm.prank(address(betting));
        staking.notifyReward(50 ether);
        assertEq(odd.balanceOf(treasury), treasuryBefore + 50 ether);

        vm.expectRevert();
        vm.prank(user);
        staking.stake(99 ether, 1);
        vm.expectRevert();
        vm.prank(user);
        staking.stake(100 ether, 99);

        vm.prank(user);
        uint256 firstPosition = staking.stake(1_000 ether, 1);
        assertEq(staking.getActiveStakeAmount(user), 1_000 ether);
        assertEq(staking.getUserTier(user), 1);

        vm.prank(admin);
        assertTrue(odd.transfer(address(staking), 100 ether));
        vm.prank(address(betting));
        staking.notifyReward(100 ether);
        uint256 accAfterReward = staking.accRewardPerShare();

        vm.prank(user2);
        uint256 secondPosition = staking.stake(1_000 ether, 1);
        (,,,, uint256 secondRewardDebt,,,) = staking.positions(secondPosition);
        assertEq(secondRewardDebt, accAfterReward);

        vm.expectRevert();
        vm.prank(outsider);
        staking.unstake(firstPosition);
        vm.expectRevert();
        vm.prank(user);
        staking.unstake(firstPosition);

        vm.prank(admin);
        staking.pause();
        vm.expectRevert();
        vm.prank(user3);
        staking.stake(1_000 ether, 1);
        vm.expectRevert();
        vm.prank(user2);
        staking.earlyUnstake(secondPosition);
        vm.prank(admin);
        staking.unpause();

        vm.prank(user2);
        staking.earlyUnstake(secondPosition);
        assertEq(staking.getActiveStakeAmount(user2), 0);

        vm.warp(block.timestamp + StakingConstants.STAKE_PLAN_1_LOCK_DAYS * PrecisionConstants.SECONDS_PER_DAY + 1);
        vm.prank(user);
        staking.unstake(firstPosition);
        assertEq(staking.getActiveStakeAmount(user), 0);

        address poorUser = address(0xDEAD123);
        vm.prank(poorUser);
        odd.approve(address(staking), type(uint256).max);
        vm.expectRevert();
        vm.prank(poorUser);
        staking.stake(1_000 ether, 1);
        assertEq(staking.getActiveStakeAmount(referrer), 0);
    }

    function testLP001ToLP024_LiquidityLifecycleMarginLossUnbondEpochPauseAndBounds() public {
        vm.warp(12_345);
        ODDToken token = ODDToken(_proxy(address(new ODDToken()), abi.encodeCall(ODDToken.initialize, (admin, admin))));
        LiquidityPool pool = LiquidityPool(
            _proxy(
                address(new LiquidityPool()), abi.encodeCall(LiquidityPool.initialize, (admin, address(token), admin))
            )
        );
        _bootstrapOddMvpToken(token, admin, treasury, address(0), address(pool), address(0));
        uint256 expectedEpochStart = block.timestamp - (block.timestamp % PrecisionConstants.SECONDS_PER_DAY);
        assertEq(pool.epochStart(), expectedEpochStart);

        vm.startPrank(admin);
        assertTrue(token.transfer(user, 20_000 ether));
        assertTrue(token.transfer(user2, 20_000 ether));
        assertTrue(token.transfer(lpUser, 20_000 ether));
        vm.stopPrank();
        _approveToken(token, user, address(pool));
        _approveToken(token, user2, address(pool));
        _approveToken(token, lpUser, address(pool));

        vm.expectRevert();
        vm.prank(user);
        pool.depositGlobal(999 ether, 1);
        vm.expectRevert();
        vm.prank(user);
        pool.depositGlobal(1_000 ether, 99);

        vm.prank(user);
        uint256 globalPosition = pool.depositGlobal(1_000 ether, 4);
        (,, uint256 globalPrincipal, uint256 globalWeight,,,,,,,,) = pool.positions(globalPosition);
        assertEq(globalPrincipal, 1_000 ether);
        assertEq(globalWeight, 1_000 ether);

        bytes32 matchId = keccak256("lp-match");
        vm.prank(admin);
        pool.openMatchPool(matchId, uint64(block.timestamp + 1 hours), uint64(block.timestamp + 2 hours));
        vm.prank(user2);
        uint256 matchPosition = pool.depositMatch(matchId, 1_000 ether);
        (,, uint256 matchPrincipal, uint256 matchWeight,,,,,,,,) = pool.positions(matchPosition);
        assertEq(matchPrincipal, 1_000 ether);
        assertEq(matchWeight, 1_000 ether);

        vm.warp(block.timestamp + 1 hours + 1);
        vm.expectRevert();
        vm.prank(lpUser);
        pool.depositMatch(matchId, 1_000 ether);

        vm.prank(admin);
        pool.distributeMargin(matchId, 100 ether);
        assertGt(pool.getRequestableLiquidity(), 2_000 ether);
        vm.prank(admin);
        pool.distributeLoss(matchId, 500 ether);

        vm.expectRevert();
        vm.prank(outsider);
        pool.requestUnbond(globalPosition);
        vm.expectRevert();
        vm.prank(user);
        pool.requestUnbond(globalPosition);

        vm.warp(block.timestamp + LiquidityConstants.GLOBAL_PLAN_4_LOCK_DAYS * PrecisionConstants.SECONDS_PER_DAY + 1);
        vm.prank(user);
        pool.requestUnbond(globalPosition);
        (uint256 previewAmount, int256 previewNetPnl, LpPositionState previewState) =
            pool.previewWithdraw(globalPosition);
        assertEq(previewAmount, 800 ether);
        assertEq(previewNetPnl, -200 ether);
        assertEq(uint8(previewState), uint8(LpPositionState.Unbonding));
        vm.expectRevert();
        vm.prank(user);
        pool.requestUnbond(globalPosition);
        vm.expectRevert();
        vm.prank(user);
        pool.withdraw(globalPosition);
        vm.warp(block.timestamp + 3 * PrecisionConstants.SECONDS_PER_DAY);
        (
            uint256 withdrawablePreviewAmount,
            int256 withdrawablePreviewNetPnl,
            LpPositionState withdrawablePreviewState
        ) = pool.previewWithdraw(globalPosition);
        assertEq(withdrawablePreviewAmount, previewAmount);
        assertEq(withdrawablePreviewNetPnl, previewNetPnl);
        assertEq(uint8(withdrawablePreviewState), uint8(LpPositionState.Withdrawable));
        assertEq(uint8(pool.getPositionState(globalPosition)), uint8(LpPositionState.Withdrawable));
        uint256 balanceBeforeWithdraw = token.balanceOf(user);
        vm.prank(user);
        pool.withdraw(globalPosition);
        assertEq(token.balanceOf(user) - balanceBeforeWithdraw, withdrawablePreviewAmount);

        vm.prank(admin);
        pool.pause();
        vm.expectRevert();
        vm.prank(lpUser);
        pool.depositGlobal(1_000 ether, 1);
        vm.prank(admin);
        pool.unpause();
        vm.prank(lpUser);
        pool.depositGlobal(1_000 ether, 1);
    }

    function testWFL001ToWFL018_WaterfallL1L2TaxBufferReserveEmergencyAndInvariantPaths() public {
        bytes32 l1Market = _openMarketWithOdds("wfl-l1", 1, 0, 2, 10_100);
        _placeBet(user, l1Market, 0, 100 ether, address(0));
        _placeBet(user2, l1Market, 1, 100 ether, address(0));
        _placeBet(user3, l1Market, 1, 100 ether, address(0));
        uint256 offsetBeforeL1 = betting.lpLossOffsetRemaining();
        vm.warp(betting.getMarket(l1Market).matchEndTime + 1);
        _settleMarketByScore(l1Market, 1, 0);
        assertEq(betting.lpLossOffsetRemaining(), offsetBeforeL1);

        vm.prank(lpUser);
        liquidity.depositGlobal(1_000 ether, 1);
        bytes32 l2Market = _openMarket("wfl-l2", 1, 0, 2);
        bytes32 l2WinBet = _placeBet(user4, l2Market, 0, 100 ether, address(0));
        vm.warp(betting.getMarket(l2Market).matchEndTime + 1);
        _settleMarketByScore(l2Market, 1, 0);
        assertGt(betting.lpLossOffsetRemaining(), 0);

        uint256 offsetBeforeClaim = betting.lpLossOffsetRemaining();
        vm.prank(user4);
        betting.claimPayout(l2WinBet);
        assertLt(betting.lpLossOffsetRemaining(), offsetBeforeClaim);

        (ODDToken reserveOdd,, LiquidityPool noLpLiquidity, BettingPool reserveBetting) = _deploySystem(100_100 ether);
        assertEq(noLpLiquidity.getRequestableLiquidity(), 0);
        bytes32 reserveMarket = _openMarket(reserveBetting, "wfl-reserve-emergency", 1, 0, 2);
        _placeBet(reserveBetting, user, reserveMarket, 0, 100 ether, address(0));
        uint256 reserveBefore = reserveBetting.platformReserve();
        vm.warp(reserveBetting.getMarket(reserveMarket).matchEndTime + 1);
        _settleMarketByScore(reserveBetting, reserveMarket, 1, 0);
        assertLt(reserveBetting.platformReserve(), reserveBefore);
        assertTrue(reserveBetting.paused());

        vm.startPrank(admin);
        reserveOdd.approve(address(reserveBetting), 1_000 ether);
        reserveBetting.addPlatformReserve(1_000 ether);
        reserveBetting.unpause();
        vm.stopPrank();
        assertFalse(reserveBetting.paused());
    }

    function testSPC001ToSPC004_SpecialMarketsAhOuSameMatchIsolationAndExpandedLines() public {
        for (uint8 line = 0; line < 13; ++line) {
            _openMarket(string(abi.encodePacked("spc-ah-line-", line)), 1, line, 2);
        }
        vm.expectRevert();
        _openMarket("spc-ah-line-13", 1, 13, 2);

        bytes32 matchId = keccak256("spc-same-match");
        bytes32 oneXTwo = _openMarketWithMatch(matchId, 0, 0, 3, 20_000);
        bytes32 ahMinusOne = _openMarketWithMatch(matchId, 1, 1, 2, 20_000);
        bytes32 ouTwoPointFive = _openMarketWithMatch(matchId, 2, 1, 2, 20_000);

        bytes32 oneXTwoBet = _placeBet(user, oneXTwo, 0, 100 ether, address(0));
        bytes32 ahBet = _placeBet(user2, ahMinusOne, 0, 100 ether, address(0));
        bytes32 ouBet = _placeBet(user3, ouTwoPointFive, 1, 100 ether, address(0));

        vm.warp(betting.getMarket(oneXTwo).matchEndTime + 1);
        _settleMarketByScore(oneXTwo, 1, 0);
        _settleMarketByScore(ahMinusOne, 1, 0);
        _settleMarketByScore(ouTwoPointFive, 1, 0);

        assertEq(uint8(betting.getBet(oneXTwoBet).settlementState), uint8(BetSettlementState.WonUnclaimed));
        assertEq(uint8(betting.getBet(ahBet).settlementState), uint8(BetSettlementState.Refunded));
        assertEq(uint8(betting.getBet(ouBet).settlementState), uint8(BetSettlementState.WonUnclaimed));
    }

    function testODDV2001_PayoutAccumulatorUsesLockedOddsAndSurvivesBaseOddsUpdate() public {
        bytes32 marketId = _openMarketWithOdds("odd-v2-payout-accumulator", 1, 0, 2, 20_000);
        (bytes32 betId,,) = _placeBetReturningResult(user, marketId, 0, 100 ether, address(0));
        assertEq(betting.getBet(betId).lockedOdds, 20_000);

        (uint256[] memory stakesBefore, uint256[] memory payoutsBefore,) = betting.getMarketExposure(marketId);
        assertEq(stakesBefore[0], 100 ether);
        assertEq(payoutsBefore[0], 200 ether);

        uint256[] memory newBaseOdds = new uint256[](2);
        newBaseOdds[0] = 30_000;
        newBaseOdds[1] = 20_000;
        vm.prank(admin);
        betting.updateOdds(marketId, newBaseOdds, uint64(block.timestamp));

        (uint256[] memory stakesAfter, uint256[] memory payoutsAfter,) = betting.getMarketExposure(marketId);
        assertEq(stakesAfter[0], 100 ether);
        assertEq(payoutsAfter[0], 200 ether);
    }

    function testODDV2002_RedCapacityUsesV2FormulaAndRedLineOdds() public {
        bytes32 marketId = _openMarketWithOdds("odd-v2-red-capacity", 1, 0, 2, 25_000);
        vm.prank(user);
        staking.stake(10_000 ether, 1);
        vm.prank(user2);
        staking.stake(5_000 ether, 1);
        vm.prank(user3);
        staking.stake(10_000 ether, 1);
        _placeBet(user, marketId, 0, 10_000 ether, address(0));
        _placeBet(user3, marketId, 0, 10_000 ether, address(0));
        _placeBet(user2, marketId, 1, 5_000 ether, address(0));
        vm.prank(admin);
        betting.setRiskConfig(8_000 ether, 18_000 ether, 28_000 ether);

        (, uint256 acceptedAmount, uint256 lockedOdds, bool partialFill,) =
            betting.previewSignal(marketId, 0, 10_000 ether);

        assertTrue(partialFill);
        assertEq(acceptedAmount, 2_500 ether);
        assertEq(lockedOdds, 22_000);
    }

    function testSEC001ToSEC006_IdempotencyReplayConfigBoundsAndSettlementModeLocks() public {
        vm.expectRevert();
        vm.prank(admin);
        betting.setTaxConfig(301, 500, 200, 100, 100, 100);
        vm.expectRevert();
        vm.prank(admin);
        betting.setTaxConfig(100, 500, 200, 100, 100, 99);
        vm.expectRevert();
        vm.prank(admin);
        betting.setRiskConfig(0, 1, 2);
        vm.expectRevert();
        vm.prank(admin);
        betting.setMarginSplit(10_001);

        bytes32 marketId = _openMarket("sec-mode-lock", 1, 0, 2);
        bytes32 betId = _placeBet(user, marketId, 0, 100 ether, address(0));
        bytes32[] memory betIds = _singleBetId(betId);
        vm.warp(betting.getMarket(marketId).matchEndTime + 1);
        vm.prank(admin);
        betting.settleMarketBetsByScore(marketId, 1, 0, betIds);
        vm.expectRevert();
        vm.prank(admin);
        betting.finalizeMarketSettlement(marketId, 1);
        vm.prank(admin);
        betting.finalizeMarketSettlement(marketId, 0);

        vm.prank(user);
        betting.claimPayout(betId);
        vm.expectRevert();
        vm.prank(user);
        betting.claimPayout(betId);

        bytes32 refMarket = _openMarket("sec-ref-claim-replay", 1, 0, 2);
        _placeBet(user2, refMarket, 0, 100 ether, referrer);
        vm.prank(referrer);
        betting.claimReferralRewards(0.5 ether);
        vm.expectRevert();
        vm.prank(referrer);
        betting.claimReferralRewards(type(uint256).max);
    }

    function _deploySystem(uint256 reserveAmount)
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
        bettingPool = BettingPool(
            _proxy(
                address(new BettingPool()),
                abi.encodeCall(
                    BettingPool.initialize, (admin, address(token), address(stakingPool), address(liquidityPool))
                )
            )
        );
        BettingSettlementModule settlement = new BettingSettlementModule();
        BettingBetModule betModule = new BettingBetModule();

        _bootstrapOddMvpToken(
            token, admin, treasury, address(stakingPool), address(liquidityPool), address(bettingPool)
        );

        vm.startPrank(admin);
        bettingPool.setSettlementModule(address(settlement));
        bettingPool.setBetModule(address(betModule));
        bettingPool.setMarketModule(address(new BettingMarketModule()));
        bettingPool.setReferralModule(address(new BettingReferralModule()));
        bettingPool.initializeV2(treasury);
        stakingPool.initializeV2(address(bettingPool));
        liquidityPool.setBettingPool(address(bettingPool));
        address[7] memory actors = [user, user2, user3, user4, referrer, lpUser, outsider];
        for (uint256 i = 0; i < actors.length; ++i) {
            assertTrue(token.transfer(actors[i], 1_000_000 ether));
        }
        if (reserveAmount > 0) {
            token.approve(address(bettingPool), reserveAmount);
            bettingPool.addPlatformReserve(reserveAmount);
        }
        vm.stopPrank();

        _approveAll(token, bettingPool, stakingPool, liquidityPool, user);
        _approveAll(token, bettingPool, stakingPool, liquidityPool, user2);
        _approveAll(token, bettingPool, stakingPool, liquidityPool, user3);
        _approveAll(token, bettingPool, stakingPool, liquidityPool, user4);
        _approveAll(token, bettingPool, stakingPool, liquidityPool, referrer);
        _approveAll(token, bettingPool, stakingPool, liquidityPool, lpUser);
        _approveAll(token, bettingPool, stakingPool, liquidityPool, outsider);
        _fundAndApproveIfNeeded(token, bettingPool, stakingPool, liquidityPool, address(0xCAFE5));
        _fundAndApproveIfNeeded(token, bettingPool, stakingPool, liquidityPool, address(0xCAFE6));
        _fundAndApproveIfNeeded(token, bettingPool, stakingPool, liquidityPool, address(0xCAFE7));
    }

    function _proxy(address implementation, bytes memory initData) internal returns (address) {
        return address(new ERC1967Proxy(implementation, initData));
    }

    function _fundAndApproveIfNeeded(
        ODDToken token,
        BettingPool bettingPool,
        StakingPool stakingPool,
        LiquidityPool liquidityPool,
        address actor
    ) internal {
        vm.prank(admin);
        assertTrue(token.transfer(actor, 10_000 ether));
        _approveAll(token, bettingPool, stakingPool, liquidityPool, actor);
    }

    function _approveAll(
        ODDToken token,
        BettingPool bettingPool,
        StakingPool stakingPool,
        LiquidityPool liquidityPool,
        address actor
    ) internal {
        vm.startPrank(actor);
        token.approve(address(bettingPool), type(uint256).max);
        token.approve(address(stakingPool), type(uint256).max);
        token.approve(address(liquidityPool), type(uint256).max);
        vm.stopPrank();
    }

    function _approveToken(ODDToken token, address actor, address spender) internal {
        vm.prank(actor);
        token.approve(spender, type(uint256).max);
    }

    function _openMarket(string memory label, uint8 marketType, uint8 line, uint256 outcomeCount)
        internal
        returns (bytes32)
    {
        return _openMarket(betting, label, marketType, line, outcomeCount);
    }

    function _openMarket(BettingPool pool, string memory label, uint8 marketType, uint8 line, uint256 outcomeCount)
        internal
        returns (bytes32 marketId)
    {
        return _openMarketWithMatch(pool, keccak256(bytes(label)), marketType, line, outcomeCount, 20_000);
    }

    function _openMarketWithOdds(string memory label, uint8 marketType, uint8 line, uint256 outcomeCount, uint256 odds)
        internal
        returns (bytes32 marketId)
    {
        return _openMarketWithMatch(betting, keccak256(bytes(label)), marketType, line, outcomeCount, odds);
    }

    function _openMarketWithMatch(bytes32 matchId, uint8 marketType, uint8 line, uint256 outcomeCount, uint256 odds)
        internal
        returns (bytes32 marketId)
    {
        return _openMarketWithMatch(betting, matchId, marketType, line, outcomeCount, odds);
    }

    function _openMarketWithMatch(
        BettingPool pool,
        bytes32 matchId,
        uint8 marketType,
        uint8 line,
        uint256 outcomeCount,
        uint256 odds
    ) internal returns (bytes32 marketId) {
        uint256[] memory baseOdds = new uint256[](outcomeCount);
        for (uint256 i = 0; i < outcomeCount; ++i) {
            baseOdds[i] = odds;
        }
        vm.prank(admin);
        uint64 matchStartTime = uint64(block.timestamp + 10 hours);
        marketId = pool.openMarket(
            matchId,
            marketType,
            line,
            matchStartTime,
            uint64(matchStartTime + 1 hours),
            baseOdds,
            uint64(block.timestamp)
        );
    }

    function _placeBet(address actor, bytes32 marketId, uint8 outcome, uint256 amount, address boundReferrer)
        internal
        returns (bytes32 betId)
    {
        (betId,,) = _placeBetReturningResult(betting, actor, marketId, outcome, amount, boundReferrer);
    }

    function _placeBet(
        BettingPool pool,
        address actor,
        bytes32 marketId,
        uint8 outcome,
        uint256 amount,
        address boundReferrer
    ) internal returns (bytes32 betId) {
        (betId,,) = _placeBetReturningResult(pool, actor, marketId, outcome, amount, boundReferrer);
    }

    function _placeBetReturningResult(
        address actor,
        bytes32 marketId,
        uint8 outcome,
        uint256 amount,
        address boundReferrer
    ) internal returns (bytes32 betId, uint256 acceptedAmount, uint256 lockedOdds) {
        return _placeBetReturningResult(betting, actor, marketId, outcome, amount, boundReferrer);
    }

    function _placeBetReturningResult(
        BettingPool pool,
        address actor,
        bytes32 marketId,
        uint8 outcome,
        uint256 amount,
        address boundReferrer
    ) internal returns (bytes32 betId, uint256 acceptedAmount, uint256 lockedOdds) {
        (QuoteGuardInput memory guard,,) = _guard(pool, marketId, outcome, amount);
        vm.prank(actor);
        (betId, acceptedAmount, lockedOdds) = pool.placeBet(marketId, outcome, amount, guard, boundReferrer);
    }

    function _guard(BettingPool pool, bytes32 marketId, uint8 outcome, uint256 amount)
        internal
        view
        returns (QuoteGuardInput memory guard, uint256 acceptedAmount, uint256 lockedOdds)
    {
        (, acceptedAmount, lockedOdds,,) = pool.previewSignal(marketId, outcome, amount);
        (,, uint64 updatedAt, uint256 quoteVersion) = pool.getMarketOdds(marketId);
        guard = QuoteGuardInput({
            quoteVersion: quoteVersion,
            quotedAt: updatedAt,
            minOdds: lockedOdds,
            minAcceptedAmount: acceptedAmount,
            deadline: block.timestamp + 1 hours
        });
    }

    function _settleMarketByScore(bytes32 marketId, uint16 homeScore, uint16 awayScore) internal {
        _settleMarketByScore(betting, marketId, homeScore, awayScore);
    }

    function _settleMarketByScore(BettingPool pool, bytes32 marketId, uint16 homeScore, uint16 awayScore) internal {
        bytes32[] memory betIds = pool.getMarketBetIds(marketId, 0, 50);
        if (betIds.length > 0) {
            vm.prank(admin);
            pool.settleMarketBetsByScore(marketId, homeScore, awayScore, betIds);
        }
        vm.prank(admin);
        pool.finalizeMarketSettlement(marketId, 0);
    }

    function _singleBetId(bytes32 betId) internal pure returns (bytes32[] memory betIds) {
        betIds = new bytes32[](1);
        betIds[0] = betId;
    }

    function _referralSignature(address claimant, uint256 oddAmount, uint256 minOut, uint256 deadline, uint256 nonce)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = keccak256(
                abi.encode(address(betting), block.chainid, claimant, oddAmount, minOut, deadline, nonce)
            ).toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_PK, digest);
        return abi.encodePacked(r, s, v);
    }
}
