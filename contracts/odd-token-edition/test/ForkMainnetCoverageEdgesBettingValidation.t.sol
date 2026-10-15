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

contract ForkMainnetCoverageEdgesBettingValidationTest is ForkBase {
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
        vm.prank(admin);
        bettingPool.setReferralClaimConfig(signer, DEFAULT_USDT_FEE);

        vm.startPrank(admin);
        token.transfer(user, 2_000_000 ether);
        token.transfer(user2, 2_000_000 ether);
        token.transfer(referrer, 1_000_000 ether);
        token.approve(address(bettingPool), type(uint256).max);
        if (seedReserve) bettingPool.addPlatformReserve(15_000_000 ether);
        vm.stopPrank();

        vm.prank(user);
        token.approve(address(bettingPool), type(uint256).max);
        vm.prank(user2);
        token.approve(address(bettingPool), type(uint256).max);
        vm.prank(referrer);
        token.approve(address(bettingPool), type(uint256).max);
    }

    function _openTwoWayFreshMarket(BettingPool bettingPool, bytes32 matchId, uint8 marketType, uint8 line)
        internal
        returns (bytes32 marketId)
    {
        uint256[] memory baseOdds = new uint256[](2);
        baseOdds[0] = 20_000;
        baseOdds[1] = 20_000;
        uint64 startTime = uint64(uint256(block.timestamp) + 2 hours);
        uint64 endTime = uint64(uint256(block.timestamp) + 4 hours);
        vm.prank(admin);
        marketId =
            bettingPool.openMarket(matchId, marketType, line, startTime, endTime, baseOdds, uint64(block.timestamp));
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

    function testCoverageBettingSettledGettersAndPreviewEdges() public {
        bytes32 settledMarket = _openTwoWayMarket(keccak256("coverage-settled-market"), 1, 0);
        (QuoteGuardInput memory settledGuard,,) = _guard(settledMarket, 0, 100 ether);
        vm.prank(user);
        (bytes32 wonBetId,,) = betting.placeBet(settledMarket, 0, 100 ether, settledGuard);
        vm.warp(block.timestamp + 5 hours);
        _settleMarketByScore(settledMarket, 1, 0);
        vm.expectRevert();
        betting.previewSignal(settledMarket, 0, 100 ether);
        assertFalse(betting.isMatchTerminal(keccak256("missing-match")));
        assertFalse(betting.isMatchTerminal(keccak256("coverage-pending-claim")));
        assertTrue(wonBetId != bytes32(0));
    }

    function testCoverageBettingFreshPushPendingAndUsdtEdges() public {
        (ODDToken freshToken, StakingPool freshStaking, LiquidityPool freshLiquidity, BettingPool freshBetting) =
            _freshSystem(true);
        bytes32 pushWrongLine = _openTwoWayFreshMarket(freshBetting, keccak256("coverage-push-wrong-line"), 1, 0);
        vm.expectRevert();
        _finalizeMarketStatus(freshBetting, pushWrongLine, 1);

        bytes32 pendingMarket = _openTwoWayFreshMarket(freshBetting, keccak256("coverage-pending-claim"), 1, 0);
        (QuoteGuardInput memory pendingGuard,,) = _guardFresh(freshBetting, pendingMarket, 0, 100 ether);
        vm.prank(user2);
        (bytes32 pendingBetId,,) = freshBetting.placeBet(pendingMarket, 0, 100 ether, pendingGuard);
        vm.expectRevert();
        vm.prank(user2);
        freshBetting.claimPayout(pendingBetId);
        vm.expectRevert();
        vm.prank(referrer);
        freshBetting.claimUSDTReferralRewards(1, block.timestamp + 1 hours, hex"1234", 0);
        assertFalse(freshBetting.isMatchTerminal(keccak256("coverage-pending-claim")));
        assertTrue(
            address(freshToken) != address(0) && address(freshStaking) != address(0)
                && address(freshLiquidity) != address(0)
        );
    }

    function testCoverageBettingDirectPlaceBetReverts() public {
        bytes32 marketId = _openTwoWayMarket(keccak256("coverage-direct-reverts"), 1, 0);
        (QuoteGuardInput memory guard,,) = _guard(marketId, 0, 100 ether);

        vm.expectRevert();
        vm.prank(user);
        betting.placeBet(keccak256("missing-market"), 0, 100 ether, guard);
        vm.expectRevert();
        vm.prank(user);
        betting.placeBet(marketId, 2, 100 ether, guard);
        vm.expectRevert();
        vm.prank(user);
        betting.placeBet(marketId, 0, 1 ether, guard);

        QuoteGuardInput memory badTimestamp = guard;
        badTimestamp.quotedAt += 1;
        vm.expectRevert();
        vm.prank(user);
        betting.placeBet(marketId, 0, 100 ether, badTimestamp);

        QuoteGuardInput memory expired = guard;
        expired.deadline = block.timestamp - 1;
        vm.expectRevert();
        vm.prank(user);
        betting.placeBet(marketId, 0, 100 ether, expired);

        vm.warp(block.timestamp + 2 hours - 4 minutes);
        vm.expectRevert();
        vm.prank(user);
        betting.placeBet(marketId, 0, 100 ether, guard);
    }

    function testCoverageBettingRefundAndScoreSettlementLoopReverts() public {
        (ODDToken freshToken, StakingPool freshStaking, LiquidityPool freshLiquidity, BettingPool freshBetting) =
            _freshSystem(true);
        bytes32 pushMarket = _openTwoWayFreshMarket(freshBetting, keccak256("coverage-push-loop"), 1, 1);
        (QuoteGuardInput memory pushGuard,,) = _guardFresh(freshBetting, pushMarket, 0, 100 ether);
        vm.prank(user);
        (bytes32 pushBetId,,) = freshBetting.placeBet(pushMarket, 0, 100 ether, pushGuard);

        bytes32[] memory invalidBetIds = new bytes32[](2);
        invalidBetIds[0] = pushBetId;
        invalidBetIds[1] = bytes32(uint256(999));
        vm.expectRevert();
        vm.prank(admin);
        freshBetting.settleMarketBetsByScore(pushMarket, 1, 0, new bytes32[](21));
        vm.warp(block.timestamp + 5 hours);
        vm.expectRevert();
        vm.prank(admin);
        freshBetting.settleMarketBetsByScore(pushMarket, 1, 0, invalidBetIds);

        vm.createSelectFork(vm.envString(RPC_ENV));
        (freshToken, freshStaking, freshLiquidity, freshBetting) = _freshSystem(true);
        bytes32 refundMarket = _openTwoWayFreshMarket(freshBetting, keccak256("coverage-refund-too-much"), 1, 0);
        (QuoteGuardInput memory refundGuard,,) = _guardFresh(freshBetting, refundMarket, 0, 100 ether);
        vm.prank(user2);
        (bytes32 refundBetId, uint256 accepted,) = freshBetting.placeBet(refundMarket, 0, 100 ether, refundGuard);
        vm.expectRevert();
        _finalizeMarketStatus(freshBetting, refundMarket, 1);
        vm.warp(block.timestamp + 5 hours);
        _finalizeMarketStatus(freshBetting, refundMarket, 1);

        bytes32[] memory singleBetIds = new bytes32[](1);
        singleBetIds[0] = refundBetId;
        uint256[] memory tooMuch = new uint256[](1);
        tooMuch[0] = accepted + 1;
        vm.expectRevert();
        vm.prank(admin);
        freshBetting.refundBets(refundMarket, singleBetIds, tooMuch);

        assertTrue(
            address(freshToken) != address(0) && address(freshStaking) != address(0)
                && address(freshLiquidity) != address(0)
        );
    }
}
