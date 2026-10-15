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
import {OddMvpTestBootstrap} from "./helpers/OddMvpTestBootstrap.sol";

contract PlatformMarginReserveAccountingTest is OddMvpTestBootstrap {
    address internal admin = address(0xA11CE);
    address internal treasury = address(0xBEEF);
    address internal bettor = address(0xCAFE);
    address internal lp = address(0x1A);

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
        assertTrue(odd.transfer(bettor, 10_000 ether));
        assertTrue(odd.transfer(lp, 10_000 ether));
        vm.stopPrank();

        vm.prank(bettor);
        odd.approve(address(betting), type(uint256).max);

        vm.startPrank(lp);
        odd.approve(address(liquidity), type(uint256).max);
        liquidity.depositGlobal(1_000 ether, 1);
        vm.stopPrank();
    }

    function testPlatformMarginShareStaysInBettingPoolAndCreditsReserve() public {
        bytes32 marketId = _placeLosingBet();
        uint256 bettingBalanceBefore = odd.balanceOf(address(betting));
        uint256 treasuryBalanceBefore = odd.balanceOf(treasury);

        vm.warp(block.timestamp + 3 hours);
        _settleByScore(marketId, 0, 1);

        uint256 totalMargin = 100 ether * 1000 / 10_000;
        uint256 lpMarginShare = totalMargin * betting.lpMarginShareBps() / 10_000;
        uint256 platformMarginShare = totalMargin - lpMarginShare;

        assertEq(betting.platformReserve(), platformMarginShare);
        assertEq(odd.balanceOf(treasury), treasuryBalanceBefore);
        assertEq(odd.balanceOf(address(betting)), bettingBalanceBefore - lpMarginShare);
        assertEq(odd.balanceOf(address(liquidity)), 1_000 ether + lpMarginShare);
    }

    function _settleByScore(bytes32 marketId, uint16 homeScore, uint16 awayScore) internal {
        bytes32[] memory betIds = betting.getMarketBetIds(marketId, 0, 100);
        vm.prank(admin);
        betting.settleMarketBetsByScore(marketId, homeScore, awayScore, betIds);
        vm.prank(admin);
        betting.finalizeMarketSettlement(marketId, 0);
    }

    function _placeLosingBet() internal returns (bytes32 marketId) {
        uint256[] memory baseOdds = new uint256[](2);
        baseOdds[0] = 20_000;
        baseOdds[1] = 20_000;

        vm.prank(admin);
        marketId = betting.openMarket(
            keccak256("platform-margin-reserve-accounting"),
            1,
            0,
            uint64(block.timestamp + 1 hours),
            uint64(block.timestamp + 2 hours),
            baseOdds,
            uint64(block.timestamp)
        );

        (, uint256 acceptedAmount, uint256 lockedOdds,,) = betting.previewSignal(marketId, 0, 100 ether);
        (,, uint64 updatedAt, uint256 quoteVersion) = betting.getMarketOdds(marketId);
        QuoteGuardInput memory guard = QuoteGuardInput({
            quoteVersion: quoteVersion,
            quotedAt: updatedAt,
            minOdds: lockedOdds,
            minAcceptedAmount: acceptedAmount,
            deadline: block.timestamp + 1 hours
        });

        vm.prank(bettor);
        betting.placeBet(marketId, 0, 100 ether, guard);
    }
}
