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
import {
    BetNotOwner,
    InvalidBetState,
    InvalidQuoteGuard,
    MarketLocked,
    PayoutTooSmall
} from "../src/shared/errors/BettingErrors.sol";
import {OddMvpTestBootstrap} from "./helpers/OddMvpTestBootstrap.sol";

contract CashOutTest is OddMvpTestBootstrap {
    address internal admin = address(0xA11CE);
    address internal treasury = address(0xBEEF);
    address internal bettor = address(0xCAFE);
    address internal outsider = address(0xBAD);
    address internal lp = address(0x1A);

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
        assertTrue(odd.transfer(bettor, 20_000 ether));
        assertTrue(odd.transfer(outsider, 20_000 ether));
        assertTrue(odd.transfer(lp, 20_000 ether));
        vm.stopPrank();

        vm.prank(bettor);
        odd.approve(address(betting), type(uint256).max);
        vm.prank(outsider);
        odd.approve(address(betting), type(uint256).max);

        vm.startPrank(lp);
        odd.approve(address(liquidity), type(uint256).max);
        liquidity.depositGlobal(1_000 ether, 1);
        vm.stopPrank();
    }

    function testCashOutFormulaUsesEarlyLateAndInPlayFees() public {
        assertEq(_cashOutAt("cashout-formula-early", 0), 90 ether);
        assertEq(_cashOutAt("cashout-formula-late", 110 minutes), 80 ether);
        assertEq(_cashOutAt("cashout-formula-inplay", 130 minutes), 80 ether);
    }

    function testFuzzCashOutMatchesReferenceFormula(uint16 rawCurrentOdds, bool lateWindow) public {
        uint256 currentOdds = bound(uint256(rawCurrentOdds), 101, 1_000) * 100;
        bytes32 marketId = _openMarketLabel("cashout-fuzz-formula", 50_000);
        bytes32 betId = _placeBet(marketId, 100 ether);
        _updateOdds(marketId, currentOdds);

        uint256 feeBps = lateWindow ? 2_000 : 1_000;
        if (lateWindow) {
            vm.warp(vm.getBlockTimestamp() + 110 minutes);
        }

        uint256 releasedPayout = 100 ether * 50_000 / 10_000;
        uint256 theoreticalValue = releasedPayout * 10_000 / currentOdds;
        uint256 expectedCashOut = theoreticalValue * (10_000 - feeBps) / 10_000;
        uint256 currentTimestamp = vm.getBlockTimestamp();
        uint256 cashOutQuoteVersion = _quoteVersion(marketId);

        if (expectedCashOut < 10 ether) {
            vm.expectRevert(PayoutTooSmall.selector);
            vm.prank(bettor);
            betting.cashOut(betId, cashOutQuoteVersion, uint64(currentTimestamp), 0, currentTimestamp + 1);
            return;
        }

        uint256 balanceBefore = odd.balanceOf(bettor);
        vm.prank(bettor);
        betting.cashOut(betId, cashOutQuoteVersion, uint64(currentTimestamp), expectedCashOut, currentTimestamp + 1);
        assertEq(odd.balanceOf(bettor) - balanceBefore, expectedCashOut);
    }

    function testCashOutLossRetainedCreditsReserveWithoutDailyLimitRollback() public {
        bytes32 marketId = _openMarketLabel("cashout-loss-retained", 50_000);
        bytes32 betId = _placeBet(marketId, 100 ether);
        _updateOdds(marketId, 100_000);

        uint256 bettorBalanceBefore = odd.balanceOf(bettor);
        uint256 accountBefore = betting.accountedBalance();
        uint256 cashOutQuoteVersion = _quoteVersion(marketId);
        vm.prank(bettor);
        betting.cashOut(betId, cashOutQuoteVersion, uint64(block.timestamp), 45 ether, block.timestamp + 1);

        assertEq(odd.balanceOf(bettor) - bettorBalanceBefore, 45 ether);
        assertEq(betting.platformReserve(), 55 ether);
        assertEq(betting.accountedBalance(), accountBefore - 45 ether);

        BettingPool.Bet memory bet = betting.getBet(betId);
        assertEq(uint8(bet.settlementState), uint8(BetSettlementState.CashedOut));
        assertEq(bet.refundedAmount, 0);
        assertEq(bet.claimablePayout, 0);

        BettingPool.UserRiskLedger memory risk = betting.getUserRiskLedger(bettor);
        assertEq(risk.dailyAcceptedAmount, 100 ether);
        assertEq(risk.unsettledStake, 0);

        (uint256[] memory stakes, uint256[] memory payouts,) = betting.getMarketExposure(marketId);
        assertEq(stakes[0], 0);
        assertEq(payouts[0], 0);

        cashOutQuoteVersion = _quoteVersion(marketId);
        vm.expectRevert(abi.encodeWithSelector(InvalidBetState.selector, betId, uint8(BetSettlementState.CashedOut)));
        vm.prank(bettor);
        betting.cashOut(betId, cashOutQuoteVersion, uint64(block.timestamp), 0, block.timestamp + 1);
    }

    function testCashOutProfitBooksLpLossAndPullsPayoutLiquidity() public {
        bytes32 matchId = keccak256("cashout-profit-lp");
        bytes32 marketId = _openMarketForMatch(matchId, 50_000);
        bytes32 betId = _placeBet(marketId, 100 ether);
        _updateOdds(marketId, 20_000);

        uint256 bettorBalanceBefore = odd.balanceOf(bettor);
        uint256 cashOutQuoteVersion = _quoteVersion(marketId);
        vm.prank(bettor);
        betting.cashOut(betId, cashOutQuoteVersion, uint64(block.timestamp), 225 ether, block.timestamp + 1);

        assertEq(odd.balanceOf(bettor) - bettorBalanceBefore, 225 ether);
        assertEq(betting.lpLossOffsetRemaining(), 125 ether);
        assertEq(betting.accountedBalance(), 0);

        (uint256 reservedAmount, uint256 paidOutAmount,) = liquidity.getPayoutLiquidityWindow(matchId);
        assertEq(reservedAmount, 125 ether);
        assertEq(paidOutAmount, 125 ether);
    }

    function testCashOutRejectsManualLockedMarket() public {
        bytes32 marketId = _openMarketLabel("cashout-locked", 50_000);
        bytes32 betId = _placeBet(marketId, 100 ether);

        vm.prank(admin);
        betting.lockMarket(marketId);

        uint256 cashOutQuoteVersion = _quoteVersion(marketId);
        vm.expectRevert(abi.encodeWithSelector(MarketLocked.selector, marketId));
        vm.prank(bettor);
        betting.cashOut(betId, cashOutQuoteVersion, uint64(block.timestamp), 0, block.timestamp + 1);
    }

    function testLockedMarketRejectsCashOutAndStillSettles() public {
        bytes32 marketId = _openMarketLabel("cashout-locked-settlement", 50_000);
        bytes32 betId = _placeBet(marketId, 100 ether);

        vm.prank(admin);
        betting.lockMarket(marketId);

        uint256 cashOutQuoteVersion = _quoteVersion(marketId);
        vm.expectRevert(abi.encodeWithSelector(MarketLocked.selector, marketId));
        vm.prank(bettor);
        betting.cashOut(betId, cashOutQuoteVersion, uint64(block.timestamp), 0, block.timestamp + 1);

        vm.warp(betting.getMarket(marketId).matchEndTime + 1);
        vm.prank(admin);
        betting.settleMarketBetsByScore(marketId, 1, 0, _singleBetId(betId));
        vm.prank(admin);
        betting.finalizeMarketSettlement(marketId, 0);

        assertEq(uint8(betting.getMarket(marketId).status), uint8(MarketStatus.Settled));
        assertEq(uint8(betting.getBet(betId).settlementState), uint8(BetSettlementState.WonUnclaimed));

        vm.prank(bettor);
        betting.claimPayout(betId);
        assertEq(uint8(betting.getBet(betId).settlementState), uint8(BetSettlementState.WonClaimed));
    }

    function testCashOutRejectsNonOwnerAndInvalidGuards() public {
        bytes32 marketId = _openMarketLabel("cashout-invalid-guards", 50_000);
        bytes32 betId = _placeBet(marketId, 100 ether);
        uint256 quoteVersion = _quoteVersion(marketId);

        vm.expectRevert(abi.encodeWithSelector(BetNotOwner.selector, betId, outsider));
        vm.prank(outsider);
        betting.cashOut(betId, quoteVersion, uint64(block.timestamp), 0, block.timestamp + 1);

        vm.expectRevert(InvalidQuoteGuard.selector);
        vm.prank(bettor);
        betting.cashOut(betId, quoteVersion + 1, uint64(block.timestamp), 0, block.timestamp + 1);

        vm.expectRevert(InvalidQuoteGuard.selector);
        vm.prank(bettor);
        betting.cashOut(betId, quoteVersion, uint64(block.timestamp - 31), 0, block.timestamp + 1);

        vm.expectRevert(InvalidQuoteGuard.selector);
        vm.prank(bettor);
        betting.cashOut(betId, quoteVersion, uint64(block.timestamp), 91 ether, block.timestamp + 1);
    }

    function testCashOutRejectsDustAmount() public {
        bytes32 marketId = _openMarketLabel("cashout-dust", 50_000);
        bytes32 betId = _placeBet(marketId, 100 ether);
        _updateOdds(marketId, 1_000_000);

        uint256 cashOutQuoteVersion = _quoteVersion(marketId);
        vm.expectRevert(PayoutTooSmall.selector);
        vm.prank(bettor);
        betting.cashOut(betId, cashOutQuoteVersion, uint64(block.timestamp), 0, block.timestamp + 1);
    }

    function testAllCashedOutMarketCanRecordScoreAndFinalize() public {
        bytes32 marketId = _openMarketLabel("cashout-all-finalize", 50_000);
        bytes32 betId = _placeBet(marketId, 100 ether);

        uint256 cashOutQuoteVersion = _quoteVersion(marketId);
        vm.prank(bettor);
        betting.cashOut(betId, cashOutQuoteVersion, uint64(block.timestamp), 90 ether, block.timestamp + 1);

        vm.warp(betting.getMarket(marketId).matchEndTime + 1);
        bytes32[] memory emptyBetIds = new bytes32[](0);
        vm.prank(admin);
        betting.settleMarketBetsByScore(marketId, 1, 0, emptyBetIds);
        vm.prank(admin);
        betting.finalizeMarketSettlement(marketId, 0);

        assertEq(uint8(betting.getMarket(marketId).status), uint8(MarketStatus.Settled));
    }

    function testCashedOutBetCannotBeSettledOrRefunded() public {
        bytes32 marketId = _openMarketLabel("cashout-terminal-bet", 50_000);
        bytes32 betId = _placeBet(marketId, 100 ether);

        uint256 cashOutQuoteVersion = _quoteVersion(marketId);
        vm.prank(bettor);
        betting.cashOut(betId, cashOutQuoteVersion, uint64(block.timestamp), 90 ether, block.timestamp + 1);

        vm.expectRevert();
        vm.prank(bettor);
        betting.claimPayout(betId);

        vm.warp(betting.getMarket(marketId).matchEndTime + 1);
        bytes32[] memory betIds = _singleBetId(betId);
        vm.expectRevert(abi.encodeWithSelector(InvalidBetState.selector, betId, uint8(BetSettlementState.CashedOut)));
        vm.prank(admin);
        betting.settleMarketBetsByScore(marketId, 1, 0, betIds);

        vm.prank(admin);
        betting.finalizeMarketSettlement(marketId, 1);

        uint256[] memory refundAmounts = new uint256[](1);
        refundAmounts[0] = 100 ether;
        vm.expectRevert(abi.encodeWithSelector(InvalidBetState.selector, betId, uint8(BetSettlementState.CashedOut)));
        vm.prank(admin);
        betting.refundBets(marketId, betIds, refundAmounts);
    }

    function testOrdinaryEmptyScoreBatchStillReverts() public {
        bytes32 marketId = _openMarketLabel("cashout-empty-rejects", 50_000);
        _placeBet(marketId, 100 ether);

        vm.warp(betting.getMarket(marketId).matchEndTime + 1);
        bytes32[] memory emptyBetIds = new bytes32[](0);
        vm.expectRevert();
        vm.prank(admin);
        betting.settleMarketBetsByScore(marketId, 1, 0, emptyBetIds);
    }

    function _cashOutAt(string memory label, uint256 warpOffset) internal returns (uint256 received) {
        bytes32 marketId = _openMarketLabel(label, 50_000);
        bytes32 betId = _placeBet(marketId, 100 ether);
        if (warpOffset > 0) {
            vm.warp(vm.getBlockTimestamp() + warpOffset);
        }

        uint256 currentTimestamp = vm.getBlockTimestamp();
        uint64 quotedAt = uint64(currentTimestamp);
        uint256 deadline = currentTimestamp + 1;
        uint256 balanceBefore = odd.balanceOf(bettor);
        uint256 cashOutQuoteVersion = _quoteVersion(marketId);
        vm.prank(bettor);
        betting.cashOut(betId, cashOutQuoteVersion, quotedAt, 0, deadline);
        received = odd.balanceOf(bettor) - balanceBefore;
    }

    function _openMarketLabel(string memory label, uint256 odds) internal returns (bytes32 marketId) {
        return _openMarketForMatch(keccak256(bytes(label)), odds);
    }

    function _openMarketForMatch(bytes32 matchId, uint256 odds) internal returns (bytes32 marketId) {
        uint256[] memory baseOdds = new uint256[](2);
        baseOdds[0] = odds;
        baseOdds[1] = odds;

        vm.prank(admin);
        marketId = betting.openMarket(
            matchId,
            1,
            0,
            uint64(block.timestamp + 2 hours),
            uint64(block.timestamp + 3 hours),
            baseOdds,
            uint64(block.timestamp)
        );
    }

    function _placeBet(bytes32 marketId, uint256 amount) internal returns (bytes32 betId) {
        (, uint256 acceptedAmount, uint256 lockedOdds,,) = betting.previewSignal(marketId, 0, amount);
        (,, uint64 updatedAt, uint256 quoteVersion) = betting.getMarketOdds(marketId);
        QuoteGuardInput memory guard = QuoteGuardInput({
            quoteVersion: quoteVersion,
            quotedAt: updatedAt,
            minOdds: lockedOdds,
            minAcceptedAmount: acceptedAmount,
            deadline: block.timestamp + 1 hours
        });

        vm.prank(bettor);
        (betId,,) = betting.placeBet(marketId, 0, amount, guard);
    }

    function _updateOdds(bytes32 marketId, uint256 odds) internal {
        uint256[] memory baseOdds = new uint256[](2);
        baseOdds[0] = odds;
        baseOdds[1] = odds;

        vm.prank(admin);
        betting.updateOdds(marketId, baseOdds, uint64(block.timestamp));
    }

    function _quoteVersion(bytes32 marketId) internal view returns (uint256 quoteVersion) {
        (,,, quoteVersion) = betting.getMarketOdds(marketId);
    }

    function _singleBetId(bytes32 betId) internal pure returns (bytes32[] memory betIds) {
        betIds = new bytes32[](1);
        betIds[0] = betId;
    }

    function _proxy(address implementation, bytes memory initData) internal returns (address) {
        return address(new ERC1967Proxy(implementation, initData));
    }
}
