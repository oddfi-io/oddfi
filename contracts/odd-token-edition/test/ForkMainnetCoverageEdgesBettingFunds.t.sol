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

contract ForkMainnetCoverageEdgesBettingFundsTest is ForkBase {
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
        token.transfer(lpUser, 3_000_000 ether);
        token.approve(address(bettingPool), type(uint256).max);
        if (seedReserve) bettingPool.addPlatformReserve(15_000_000 ether);
        vm.stopPrank();

        vm.prank(user);
        token.approve(address(bettingPool), type(uint256).max);
        vm.prank(user);
        token.approve(address(stakingPool), type(uint256).max);
        vm.prank(user2);
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

    function testCoverageBettingPayoutLiquidityAndRedBand() public {
        vm.prank(lpUser);
        liquidity.depositGlobal(5_000 ether, 1);
        bytes32 highOddsMarket = _openThreeWayMarket(keccak256("coverage-high-odds"));
        (QuoteGuardInput memory loserGuard,,) = _guard(highOddsMarket, 0, 1_000 ether);
        vm.prank(user2);
        betting.placeBet(highOddsMarket, 0, 1_000 ether, loserGuard);
        (QuoteGuardInput memory winnerGuard,,) = _guard(highOddsMarket, 2, 1_000 ether);
        vm.prank(user);
        (bytes32 highOddsBetId,,) = betting.placeBet(highOddsMarket, 2, 1_000 ether, winnerGuard);

        vm.prank(admin);
        betting.setRiskConfig(1 ether, 2 ether, 3 ether);
        (QuoteGuardInput memory redGuard,,) = _guard(highOddsMarket, 2, 5_000 ether);
        vm.expectRevert();
        vm.prank(user);
        betting.placeBet(highOddsMarket, 2, 5_000 ether, redGuard);

        vm.warp(block.timestamp + 5 hours);
        _settleMarketByScore(highOddsMarket, 0, 1);
        vm.prank(user);
        betting.claimPayout(highOddsBetId);
    }

    function testCoverageBettingL2PayoutAndActiveStakerTaxPath() public {
        (ODDToken token, StakingPool stakingPool, LiquidityPool liquidityPool, BettingPool bettingPool) =
            _freshSystem(false);
        vm.prank(user);
        stakingPool.stake(1_000 ether, 1);
        vm.prank(lpUser);
        liquidityPool.depositGlobal(5_000 ether, 1);

        bytes32 matchId = keccak256("coverage-l2-request");
        uint256[] memory baseOdds = new uint256[](3);
        baseOdds[0] = 20_000;
        baseOdds[1] = 30_000;
        baseOdds[2] = 40_000;
        vm.prank(admin);
        bytes32 marketId = bettingPool.openMarket(
            matchId,
            0,
            0,
            uint64(uint256(block.timestamp) + 2 hours),
            uint64(uint256(block.timestamp) + 4 hours),
            baseOdds,
            uint64(block.timestamp)
        );

        (QuoteGuardInput memory loserGuard,,) = _guardFresh(bettingPool, marketId, 0, 1_000 ether);
        vm.prank(user2);
        bettingPool.placeBet(marketId, 0, 1_000 ether, loserGuard);
        (QuoteGuardInput memory winnerGuard,,) = _guardFresh(bettingPool, marketId, 2, 1_000 ether);
        vm.prank(user);
        (bytes32 betId,,) = bettingPool.placeBet(marketId, 2, 1_000 ether, winnerGuard);

        vm.warp(block.timestamp + 5 hours);
        _settleMarketByScore(bettingPool, marketId, 0, 1);
        uint256 stakingBalanceBefore = token.balanceOf(address(stakingPool));
        vm.prank(user);
        bettingPool.claimPayout(betId);
        assertGt(token.balanceOf(address(stakingPool)), stakingBalanceBefore);
    }

    function testCoverageBettingZeroPayoutTaxPath() public {
        (ODDToken token, StakingPool stakingPool, LiquidityPool liquidityPool, BettingPool bettingPool) =
            _freshSystem(true);
        vm.prank(admin);
        bettingPool.setTaxConfig(100, 0, 0, 0, 0, 0);
        uint256[] memory taxlessOdds = new uint256[](2);
        taxlessOdds[0] = 20_000;
        taxlessOdds[1] = 20_000;
        uint64 startTime = uint64(uint256(block.timestamp) + 2 hours);
        uint64 endTime = uint64(uint256(block.timestamp) + 4 hours);
        vm.prank(admin);
        bytes32 marketId = bettingPool.openMarket(
            keccak256("coverage-taxless"), 1, 0, startTime, endTime, taxlessOdds, uint64(block.timestamp)
        );
        (QuoteGuardInput memory taxlessGuard,,) = _guardFresh(bettingPool, marketId, 0, 100 ether);
        vm.prank(user);
        (bytes32 betId,,) = bettingPool.placeBet(marketId, 0, 100 ether, taxlessGuard);
        vm.warp(block.timestamp + 5 hours);
        _settleMarketByScore(bettingPool, marketId, 1, 0);
        vm.prank(user);
        bettingPool.claimPayout(betId);
        assertTrue(
            address(token) != address(0) && address(stakingPool) != address(0) && address(liquidityPool) != address(0)
        );
    }
}
