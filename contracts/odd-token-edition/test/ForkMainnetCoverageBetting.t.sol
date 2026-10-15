// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ForkBase} from "./helpers/ForkBase.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ODDToken} from "../src/modules/token/ODDToken.sol";
import {StakingPool} from "../src/modules/staking/StakingPool.sol";
import {LiquidityPool} from "../src/modules/liquidity/LiquidityPool.sol";
import {BettingPool} from "../src/modules/betting/BettingPool.sol";
import {BettingBetModule} from "../src/modules/betting/BettingBetModule.sol";
import {BettingSettlementModule} from "../src/modules/betting/BettingSettlementModule.sol";
import {QuoteGuardInput} from "../src/shared/types/CommonTypes.sol";
import {PrecisionConstants} from "../src/shared/constants/PrecisionConstants.sol";

contract ForkMainnetCoverageBettingTest is ForkBase {
    function _proxy(address implementation, bytes memory initData) internal returns (address) {
        return address(new ERC1967Proxy(implementation, initData));
    }

    function _freshSystem(bool seedReserve)
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
        token.transfer(user2, 2_000_000 ether);
        token.transfer(referrer, 1_000_000 ether);
        token.approve(address(bettingPool), type(uint256).max);
        if (seedReserve) {
            bettingPool.addPlatformReserve(15_000_000 ether);
        }
        vm.stopPrank();

        vm.prank(user);
        token.approve(address(bettingPool), type(uint256).max);
        vm.prank(user);
        token.approve(address(stakingPool), type(uint256).max);
        vm.prank(user2);
        token.approve(address(bettingPool), type(uint256).max);
        vm.prank(user2);
        token.approve(address(stakingPool), type(uint256).max);
        vm.prank(referrer);
        token.approve(address(bettingPool), type(uint256).max);
    }

    function testCoverageBettingAdminAndInitializerGuards() public {
        (ODDToken token, StakingPool stakingPool, LiquidityPool liquidityPool,) = _freshSystem(true);
        BettingSettlementModule settlement = new BettingSettlementModule();
        BettingBetModule betModule = new BettingBetModule();
        BettingPool fresh = new BettingPool();

        vm.expectRevert();
        vm.prank(admin);
        fresh.initialize(admin, address(0), address(stakingPool), address(liquidityPool));

        fresh = BettingPool(
            _proxy(
                address(new BettingPool()),
                abi.encodeCall(
                    BettingPool.initialize, (admin, address(token), address(stakingPool), address(liquidityPool))
                )
            )
        );
        _installBettingModules(fresh, settlement, betModule);
        vm.expectRevert();
        vm.prank(admin);
        fresh.setBettingDependencies(address(0), address(liquidityPool), address(token));
        vm.expectRevert();
        vm.prank(admin);
        fresh.setBettingDependencies(address(stakingPool), address(liquidityPool), address(token));

        vm.expectRevert();
        vm.prank(admin);
        fresh.initializeV2(address(0));
        vm.prank(admin);
        fresh.initializeV2(treasury);

        vm.expectRevert();
        vm.prank(admin);
        fresh.setTaxConfig(301, 500, 200, 100, 100, 100);
        vm.expectRevert();
        vm.prank(admin);
        fresh.setTaxConfig(100, 1001, 200, 100, 100, 100);
        vm.expectRevert();
        vm.prank(admin);
        fresh.setTaxConfig(100, 500, 200, 100, 100, 50);
        vm.prank(admin);
        fresh.setTaxConfig(150, 600, 200, 150, 150, 100);

        vm.expectRevert();
        vm.prank(admin);
        fresh.setPlatformTreasury(address(0));
        vm.prank(admin);
        token.setTreasurySink(user, true);
        vm.prank(admin);
        fresh.setPlatformTreasury(user);

        vm.expectRevert();
        vm.prank(admin);
        fresh.setRiskConfig(0, 1, 2);
        vm.prank(admin);
        fresh.setRiskConfig(10_000 ether, 20_000 ether, 30_000 ether);

        vm.expectRevert();
        vm.prank(admin);
        fresh.setMarginSplit(10_001);
        vm.prank(admin);
        fresh.setMarginSplit(6_000);

        vm.expectRevert();
        vm.prank(admin);
        fresh.setReferralClaimConfig(address(0), DEFAULT_USDT_FEE);
        vm.expectRevert();
        vm.prank(admin);
        fresh.setReferralClaimConfig(signer, 0);
        vm.prank(admin);
        fresh.setReferralClaimConfig(signer, DEFAULT_USDT_FEE);
        vm.expectRevert();
        vm.prank(admin);
        fresh.setReferralSwapConfig(address(0), BSC_USDT);
        vm.expectRevert();
        vm.prank(admin);
        fresh.setReferralSwapConfig(PANCAKE_V3_ROUTER, BSC_USDT);
        vm.prank(admin);
        fresh.setReferralSwapConfig(PANCAKE_V3_ROUTER, BSC_USDT, address(0x1234));

        vm.expectRevert();
        vm.prank(admin);
        fresh.addPlatformReserve(0);
        vm.expectRevert();
        vm.prank(user);
        fresh.addPlatformReserve(1 ether);

        address proxy = _proxy(
            address(new BettingPool()),
            abi.encodeCall(
                BettingPool.initialize, (admin, address(token), address(stakingPool), address(liquidityPool))
            )
        );
        BettingPool proxied = BettingPool(proxy);
        vm.expectRevert();
        vm.prank(admin);
        proxied.upgradeToAndCall(address(0), bytes(""));
    }

    function testCoverageBettingMarketTemplateOddsAndPreviewGuards() public {
        vm.expectRevert();
        vm.prank(admin);
        betting.openMarket(
            keccak256("bad-template"),
            0,
            0,
            uint64(block.timestamp + 2 hours),
            uint64(block.timestamp + 4 hours),
            new uint256[](2),
            uint64(block.timestamp)
        );

        uint256[] memory invalidOdds = new uint256[](3);
        invalidOdds[0] = 20_005;
        invalidOdds[1] = 30_000;
        invalidOdds[2] = 40_000;
        vm.expectRevert();
        vm.prank(admin);
        betting.openMarket(
            keccak256("bad-odds"),
            0,
            0,
            uint64(block.timestamp + 2 hours),
            uint64(block.timestamp + 4 hours),
            invalidOdds,
            uint64(block.timestamp)
        );

        bytes32 oneXTwo = _openThreeWayMarket(keccak256("coverage-one-x-two"));
        vm.expectRevert();
        _openThreeWayMarket(keccak256("coverage-one-x-two"));

        bytes32 asianHandicap = _openTwoWayMarket(keccak256("coverage-ah"), 1, 0);
        bytes32 overUnder = _openTwoWayMarket(keccak256("coverage-ou"), 2, 1);
        assertTrue(oneXTwo != bytes32(0) && asianHandicap != bytes32(0) && overUnder != bytes32(0));

        uint256[] memory newOdds = new uint256[](3);
        newOdds[0] = 20_100;
        newOdds[1] = 30_100;
        newOdds[2] = 40_100;
        vm.expectRevert();
        vm.prank(admin);
        betting.updateOdds(keccak256("missing-market"), newOdds, uint64(block.timestamp));
        vm.expectRevert();
        vm.prank(admin);
        betting.updateOdds(oneXTwo, invalidOdds, uint64(block.timestamp));
        vm.expectRevert();
        vm.prank(admin);
        betting.updateOdds(oneXTwo, new uint256[](2), uint64(block.timestamp));
        vm.prank(admin);
        betting.updateOdds(oneXTwo, newOdds, uint64(block.timestamp));

        vm.expectRevert();
        betting.previewSignal(keccak256("missing-market"), 0, 100 ether);
        vm.expectRevert();
        betting.previewSignal(oneXTwo, 3, 100 ether);
        vm.expectRevert();
        betting.previewSignal(oneXTwo, 0, 0);

        vm.prank(admin);
        betting.setRiskConfig(500 ether, 750 ether, 1_000 ether);
        (, uint256 accepted,, bool partialFill,) = betting.previewSignal(oneXTwo, 0, 2_000 ether);
        assertTrue(partialFill);
        assertGt(accepted, 0);
        assertLt(accepted, 2_000 ether);

        vm.warp(block.timestamp + 2 hours + 10 minutes);
        betting.previewSignal(oneXTwo, 0, 100 ether);
        vm.prank(admin);
        betting.updateOdds(oneXTwo, newOdds, uint64(block.timestamp));
        (,,, uint256 beforeLockVersion) = betting.getMarketOdds(oneXTwo);
        vm.expectRevert();
        vm.prank(user);
        betting.lockMarket(oneXTwo);
        vm.prank(admin);
        betting.lockMarket(oneXTwo);
        (,,, uint256 afterLockVersion) = betting.getMarketOdds(oneXTwo);
        assertEq(afterLockVersion, beforeLockVersion + 1);
        vm.expectRevert();
        betting.previewSignal(oneXTwo, 0, 100 ether);
        vm.expectRevert();
        vm.prank(admin);
        betting.updateOdds(oneXTwo, newOdds, uint64(block.timestamp));

        bytes32 closingMarket = _openTwoWayMarket(keccak256("coverage-closed"), 1, 0);
        vm.warp(block.timestamp + 5 hours);
        vm.expectRevert();
        betting.previewSignal(closingMarket, 0, 100 ether);
    }

    function testCoverageBettingGuardAndUserLimitReverts() public {
        vm.prank(user);
        betting.bindReferrer(referrer);
        vm.expectRevert();
        vm.prank(user);
        betting.bindReferrer(referrer);
        vm.expectRevert();
        vm.prank(user2);
        betting.bindReferrer(user2);
        vm.expectRevert();
        vm.prank(user2);
        betting.bindReferrer(address(0));

        bytes32 marketId = _openThreeWayMarket(keccak256("coverage-place-bet-guards"));
        (QuoteGuardInput memory guard,, uint256 lockedOdds) = _guard(marketId, 0, 200 ether);

        vm.prank(admin);
        staking.setVipTierConfig(0, 0, 100 ether);
        vm.expectRevert();
        vm.prank(user);
        betting.placeBet(marketId, 0, 200 ether, guard);

        vm.prank(admin);
        staking.setVipTierConfig(0, 0, 50_000 ether);

        QuoteGuardInput memory badVersion = guard;
        badVersion.quoteVersion += 1;
        vm.expectRevert();
        vm.prank(user);
        betting.placeBet(marketId, 0, 200 ether, badVersion);

        QuoteGuardInput memory badTimestamp = guard;
        badTimestamp.quotedAt += 1;
        vm.expectRevert();
        vm.prank(user);
        betting.placeBet(marketId, 0, 200 ether, badTimestamp);

        QuoteGuardInput memory expired = guard;
        expired.deadline = block.timestamp - 1;
        vm.expectRevert();
        vm.prank(user);
        betting.placeBet(marketId, 0, 200 ether, expired);

        (QuoteGuardInput memory minAcceptedGuard,,) = _guard(marketId, 0, 200 ether);
        minAcceptedGuard.minAcceptedAmount = 201 ether;
        vm.expectRevert();
        vm.prank(user);
        betting.placeBet(marketId, 0, 200 ether, minAcceptedGuard);

        (QuoteGuardInput memory minOddsGuard,,) = _guard(marketId, 0, 200 ether);
        minOddsGuard.minOdds = lockedOdds + 100;
        vm.expectRevert();
        vm.prank(user);
        betting.placeBet(marketId, 0, 200 ether, minOddsGuard);

        (QuoteGuardInput memory openLimitGuard,,) = _guard(marketId, 0, 5_100 ether);
        vm.expectRevert();
        vm.prank(user);
        betting.placeBet(marketId, 0, 5_100 ether, openLimitGuard);

        vm.prank(user);
        staking.stake(50_000 ether, 1);
        bytes32 capMarket = _openTwoWayMarket(keccak256("coverage-cap-market"), 1, 0);
        (QuoteGuardInput memory capGuard,,) = _guard(capMarket, 0, 20_000 ether);
        vm.expectRevert();
        vm.prank(user);
        betting.placeBet(capMarket, 0, 20_000 ether, capGuard);

        (ODDToken freshToken, StakingPool freshStaking, LiquidityPool freshLiquidity, BettingPool freshBetting) =
            _freshSystem(false);
        vm.prank(admin);
        freshStaking.setVipTierConfig(0, 0, 50_000 ether);
        vm.prank(user);
        freshToken.approve(address(freshStaking), type(uint256).max);
        vm.prank(user);
        freshStaking.stake(10_000 ether, 1);
        bytes32 lowLiquidityMarket;
        {
            uint256[] memory baseOdds = new uint256[](2);
            baseOdds[0] = 20_000;
            baseOdds[1] = 20_000;
            vm.prank(admin);
            lowLiquidityMarket = freshBetting.openMarket(
                keccak256("coverage-liquidity-insufficient"),
                1,
                0,
                uint64(block.timestamp + 2 hours),
                uint64(block.timestamp + 4 hours),
                baseOdds,
                uint64(block.timestamp)
            );
        }
        (QuoteGuardInput memory liquidityGuard,,) = _guardFresh(freshBetting, lowLiquidityMarket, 0, 1_000 ether);
        vm.expectRevert();
        vm.prank(user);
        freshBetting.placeBet(lowLiquidityMarket, 0, 1_000 ether, liquidityGuard);

        // keep references live for coverage
        assertTrue(address(freshLiquidity) != address(0));
    }

    function testCoverageBettingSettlementRefundPushAndClaimBranches() public {
        bytes32 marketId = _openTwoWayMarket(keccak256("coverage-settlement-market"), 1, 0);
        (QuoteGuardInput memory guard,,) = _guard(marketId, 0, 100 ether);
        vm.prank(user);
        (bytes32 betId,,) = betting.placeBet(marketId, 0, 100 ether, guard, referrer);

        vm.expectRevert();
        vm.prank(admin);
        betting.finalizeMarketSettlement(keccak256("missing-market"), 0);
        vm.expectRevert();
        vm.prank(admin);
        betting.finalizeMarketSettlement(marketId, 3);
        vm.expectRevert();
        vm.prank(admin);
        betting.finalizeMarketSettlement(marketId, 0);

        vm.warp(block.timestamp + 5 hours);
        vm.expectRevert();
        vm.prank(admin);
        betting.settleMarketBetsByScore(marketId, 51, 0, _singleBetId(betId));
        _settleMarketByScore(marketId, 1, 0);

        vm.expectRevert();
        vm.prank(outsider);
        betting.claimPayout(betId);
        vm.prank(user);
        betting.claimPayout(betId);
        vm.expectRevert();
        vm.prank(user);
        betting.claimPayout(betId);
    }

    function testCoverageBettingRefundAndPushBranches() public {
        (ODDToken freshToken, StakingPool freshStaking, LiquidityPool freshLiquidity, BettingPool freshBetting) =
            _freshSystem(true);
        uint256[] memory twoWayOdds = new uint256[](2);
        twoWayOdds[0] = 20_000;
        twoWayOdds[1] = 20_000;
        bytes32 pendingMarket;
        uint64 pendingStart = uint64(uint256(block.timestamp) + 2 hours);
        uint64 pendingEnd = uint64(uint256(block.timestamp) + 4 hours);
        vm.prank(admin);
        pendingMarket = freshBetting.openMarket(
            keccak256("coverage-refund-market"), 1, 0, pendingStart, pendingEnd, twoWayOdds, uint64(block.timestamp)
        );
        (QuoteGuardInput memory refundGuard,,) = _guardFresh(freshBetting, pendingMarket, 0, 100 ether);
        vm.prank(user);
        (bytes32 refundBetId, uint256 accepted,) = freshBetting.placeBet(pendingMarket, 0, 100 ether, refundGuard);

        bytes32[] memory singleBetIds = new bytes32[](1);
        singleBetIds[0] = refundBetId;
        uint256[] memory singleRefundAmounts = new uint256[](1);
        singleRefundAmounts[0] = accepted;
        vm.expectRevert();
        vm.prank(admin);
        freshBetting.refundBets(pendingMarket, singleBetIds, new uint256[](0));
        vm.expectRevert();
        vm.prank(admin);
        freshBetting.refundBets(pendingMarket, new bytes32[](21), new uint256[](21));
        vm.expectRevert();
        vm.prank(admin);
        freshBetting.refundBets(pendingMarket, singleBetIds, singleRefundAmounts);

        vm.warp(block.timestamp + 5 hours);
        _finalizeMarketStatus(freshBetting, pendingMarket, 1);
        vm.prank(admin);
        freshBetting.refundBets(pendingMarket, singleBetIds, singleRefundAmounts);
        vm.expectRevert();
        vm.prank(admin);
        freshBetting.refundBets(pendingMarket, singleBetIds, singleRefundAmounts);

        bytes32 cancelledMarket;
        uint64 cancelledStart = uint64(uint256(block.timestamp) + 2 hours);
        uint64 cancelledEnd = uint64(uint256(block.timestamp) + 4 hours);
        vm.prank(admin);
        cancelledMarket = freshBetting.openMarket(
            keccak256("coverage-cancelled-market"),
            1,
            0,
            cancelledStart,
            cancelledEnd,
            twoWayOdds,
            uint64(block.timestamp)
        );
        vm.warp(block.timestamp + 5 hours);
        _finalizeMarketStatus(freshBetting, cancelledMarket, 2);

        vm.expectRevert();
        vm.prank(admin);
        freshBetting.finalizeMarketSettlement(cancelledMarket, 0);

        vm.createSelectFork(vm.envString(RPC_ENV));
        (ODDToken pushToken, StakingPool pushStaking, LiquidityPool pushLiquidity, BettingPool pushBetting) =
            _freshSystem(true);
        bytes32 pushMarket;
        uint64 pushStart = uint64(uint256(block.timestamp) + 2 hours);
        uint64 pushEnd = uint64(uint256(block.timestamp) + 4 hours);
        vm.prank(admin);
        pushMarket = pushBetting.openMarket(
            keccak256("coverage-push-market"), 1, 1, pushStart, pushEnd, twoWayOdds, uint64(block.timestamp)
        );
        (QuoteGuardInput memory pushGuard0,,) = _guardFresh(pushBetting, pushMarket, 0, 100 ether);
        vm.prank(user);
        (bytes32 pushBetId,,) = pushBetting.placeBet(pushMarket, 0, 100 ether, pushGuard0);
        vm.expectRevert();
        vm.prank(admin);
        pushBetting.settleMarketBetsByScore(pushMarket, 1, 0, new bytes32[](21));
        bytes32[] memory pushBetIds = new bytes32[](1);
        pushBetIds[0] = pushBetId;
        vm.warp(block.timestamp + 5 hours);
        vm.prank(admin);
        pushBetting.settleMarketBetsByScore(pushMarket, 1, 0, pushBetIds);
        vm.prank(admin);
        pushBetting.finalizeMarketSettlement(pushMarket, 0);
        vm.expectRevert();
        vm.prank(admin);
        pushBetting.settleMarketBetsByScore(pushMarket, 1, 0, pushBetIds);

        assertTrue(
            address(freshToken) != address(0) && address(freshStaking) != address(0)
                && address(freshLiquidity) != address(0)
        );
        assertTrue(
            address(pushToken) != address(0) && address(pushStaking) != address(0)
                && address(pushLiquidity) != address(0)
        );
    }

    function testCoverageBettingReferralReconcileAndUsdtBranches() public {
        bytes32 marketId = _openTwoWayMarket(keccak256("coverage-referral-claim"), 1, 0);
        (QuoteGuardInput memory guard,,) = _guard(marketId, 0, 100 ether);
        vm.prank(user);
        betting.placeBet(marketId, 0, 100 ether, guard, referrer);

        vm.expectRevert();
        vm.prank(user2);
        betting.claimReferralRewards(1 ether);
        vm.expectRevert();
        vm.prank(referrer);
        betting.claimReferralRewards(0);
        vm.prank(referrer);
        betting.claimReferralRewards(0.5 ether);

        (ODDToken freshToken, StakingPool freshStaking, LiquidityPool freshLiquidity, BettingPool freshBetting) =
            _freshSystem(true);
        bytes32 freshMarket;
        {
            uint256[] memory baseOdds = new uint256[](2);
            baseOdds[0] = 20_000;
            baseOdds[1] = 20_000;
            vm.prank(admin);
            freshMarket = freshBetting.openMarket(
                keccak256("coverage-no-signer"),
                1,
                0,
                uint64(block.timestamp + 2 hours),
                uint64(block.timestamp + 4 hours),
                baseOdds,
                uint64(block.timestamp)
            );
        }
        (QuoteGuardInput memory freshGuard,,) = _guardFresh(freshBetting, freshMarket, 0, 100 ether);
        vm.prank(user);
        freshBetting.placeBet(freshMarket, 0, 100 ether, freshGuard, referrer);
        vm.expectRevert();
        vm.prank(referrer);
        freshBetting.claimUSDTReferralRewards(1, block.timestamp + 1 hours, hex"1234", 0);

        _ensureOddUsdtPool(50_000 ether, 5_000 ether);
        uint256 available = betting.referrerRewardsOdd(referrer);
        vm.expectRevert();
        vm.prank(referrer);
        freshBetting.claimUSDTReferralRewards(1, block.timestamp + 1 hours, hex"1234", 0);

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory badSignature =
            _referralSignature(referrer, available, 1, deadline, betting.referralClaimNonces(referrer));
        vm.expectRevert();
        vm.prank(referrer);
        betting.claimUSDTReferralRewards(1, block.timestamp - 1, badSignature, 0);

        vm.expectRevert();
        vm.prank(referrer);
        betting.claimUSDTReferralRewards(1, deadline, hex"deadbeef", 0);

        uint256 impossibleMinOut = type(uint128).max;
        bytes memory strictSignature =
            _referralSignature(referrer, available, impossibleMinOut, deadline, betting.referralClaimNonces(referrer));
        vm.expectRevert();
        vm.prank(referrer);
        betting.claimUSDTReferralRewards(impossibleMinOut, deadline, strictSignature, 0);

        uint256 successMinOut = 1;
        bytes memory okSignature =
            _referralSignature(referrer, available, successMinOut, deadline, betting.referralClaimNonces(referrer));
        vm.prank(referrer);
        uint256 usdtOut = betting.claimUSDTReferralRewards(successMinOut, deadline, okSignature, 0);
        assertGt(usdtOut, 0);

        assertTrue(
            address(freshToken) != address(0) && address(freshStaking) != address(0)
                && address(freshLiquidity) != address(0)
        );
    }

    function testCoverageBettingWaterfallPauseBranch() public {
        (ODDToken token, StakingPool stakingPool, LiquidityPool liquidityPool, BettingPool bettingPool) =
            _freshSystem(false);
        vm.prank(admin);
        bettingPool.setRiskConfig(500 ether, 750 ether, 1_000 ether);
        vm.prank(admin);
        token.approve(address(bettingPool), type(uint256).max);
        vm.prank(admin);
        bettingPool.addPlatformReserve(100_000 ether);

        uint256[] memory baseOdds = new uint256[](2);
        baseOdds[0] = 20_000;
        baseOdds[1] = 20_000;
        bytes32 matchId = keccak256("coverage-waterfall-pause");
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
        (QuoteGuardInput memory loserGuard,,) = _guardFresh(bettingPool, marketId, 1, 1_000 ether);
        vm.prank(user2);
        bettingPool.placeBet(marketId, 1, 1_000 ether, loserGuard);
        (QuoteGuardInput memory winnerGuard,,) = _guardFresh(bettingPool, marketId, 0, 1_000 ether);
        vm.prank(user);
        bettingPool.placeBet(marketId, 0, 1_000 ether, winnerGuard);

        vm.warp(block.timestamp + 5 hours);
        _settleMarketByScore(bettingPool, marketId, 1, 0);
        assertTrue(bettingPool.paused());
        assertTrue(address(stakingPool) != address(0) && address(liquidityPool) != address(0));
    }

    function testCoverageBettingRefundedAndCancelledStatusBranches() public {
        (, StakingPool stakingPool, LiquidityPool liquidityPool, BettingPool bettingPool) = _freshSystem(false);
        uint256[] memory baseOdds = new uint256[](2);
        baseOdds[0] = 20_000;
        baseOdds[1] = 20_000;
        bytes32 refundedMarket = keccak256("coverage-refunded-status");
        vm.prank(admin);
        bytes32 extraMarket = bettingPool.openMarket(
            refundedMarket,
            1,
            0,
            uint64(block.timestamp + 2 hours),
            uint64(block.timestamp + 4 hours),
            baseOdds,
            uint64(block.timestamp)
        );
        vm.warp(block.timestamp + 5 hours);
        _finalizeMarketStatus(bettingPool, extraMarket, 1);
        BettingPool.MarketConfig memory refundedConfig = bettingPool.getMarket(extraMarket);
        assertEq(uint8(refundedConfig.status), 3);

        bytes32 cancelledMatch = keccak256("coverage-cancelled-status");
        vm.prank(admin);
        bytes32 cancelledMarket = bettingPool.openMarket(
            cancelledMatch,
            1,
            0,
            uint64(block.timestamp + 2 hours),
            uint64(block.timestamp + 4 hours),
            baseOdds,
            uint64(block.timestamp)
        );
        vm.warp(block.timestamp + 5 hours);
        _finalizeMarketStatus(bettingPool, cancelledMarket, 2);
        BettingPool.MarketConfig memory cancelledConfig = bettingPool.getMarket(cancelledMarket);
        assertEq(uint8(cancelledConfig.status), 4);

        assertTrue(address(stakingPool) != address(0) && address(liquidityPool) != address(0));
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
}
