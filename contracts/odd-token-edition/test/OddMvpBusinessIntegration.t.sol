// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {ODDToken} from "../src/modules/token/ODDToken.sol";
import {TierSale} from "../src/modules/token/TierSale.sol";
import {EcosystemRewards} from "../src/modules/token/EcosystemRewards.sol";
import {HouseVault} from "../src/modules/token/HouseVault.sol";
import {IODDTokenBusiness} from "../src/modules/token/interfaces/IODDTokenBusiness.sol";
import {TokenBusinessTypes} from "../src/modules/token/TokenBusinessTypes.sol";
import {StakingPool} from "../src/modules/staking/StakingPool.sol";
import {LiquidityPool} from "../src/modules/liquidity/LiquidityPool.sol";
import {BettingPool} from "../src/modules/betting/BettingPool.sol";
import {BettingBetModule} from "../src/modules/betting/BettingBetModule.sol";
import {BettingMarketModule} from "../src/modules/betting/BettingMarketModule.sol";
import {BettingReferralModule} from "../src/modules/betting/BettingReferralModule.sol";
import {BettingSettlementModule} from "../src/modules/betting/BettingSettlementModule.sol";
import {BettingParlayModule} from "../src/modules/betting/BettingParlayModule.sol";
import {IPancakeV3SwapRouterLike} from "../src/modules/betting/interfaces/IPancakeV3SwapRouterLike.sol";
import {QuoteGuardInput} from "../src/shared/types/CommonTypes.sol";
import {BetSettlementState} from "../src/shared/types/MarketEnums.sol";
import {ParlayBet, ParlayLegInput, ParlayState} from "../src/shared/types/ParlayTypes.sol";

contract OddMvpIntegrationUSDT is ERC20 {
    constructor() ERC20("Integration USDT", "USDT") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract OddMvpDummyContract {}

contract OddMvpReferralSwapRouter {
    address public immutable expectedPool;

    constructor(address expectedPool_) {
        expectedPool = expectedPool_;
    }

    function exactInputSingle(IPancakeV3SwapRouterLike.ExactInputSingleParams calldata params)
        external
        returns (uint256 amountOut)
    {
        IERC20(params.tokenIn).transferFrom(msg.sender, expectedPool, params.amountIn);
        amountOut = params.amountOutMinimum == 0 ? 1e6 : params.amountOutMinimum;
        OddMvpIntegrationUSDT(params.tokenOut).mint(params.recipient, amountOut);
    }
}

contract OddMvpBusinessIntegrationTest is Test {
    using MessageHashUtils for bytes32;

    uint256 internal constant SIGNER_PK = 0xA12345;

    address internal admin = address(0xA11CE);
    address internal pauser = address(0xCAFE);
    address internal treasury = address(0xBEEF);
    address internal staker = address(0x1001);
    address internal lpUser = address(0x1002);
    address internal bettor = address(0x1003);
    address internal bettor2 = address(0x1004);
    address internal referrer = address(0x1005);

    ODDToken internal odd;
    OddMvpIntegrationUSDT internal usdt;
    TierSale internal tierSale;
    HouseVault internal houseVault;
    EcosystemRewards internal rewards;
    OddMvpDummyContract internal dexSource;
    OddMvpDummyContract internal referralExpectedPool;
    OddMvpReferralSwapRouter internal referralRouter;
    StakingPool internal staking;
    LiquidityPool internal liquidity;
    BettingPool internal betting;

    function setUp() public {
        vm.warp(1_000_000);

        odd = ODDToken(_proxy(address(new ODDToken()), abi.encodeCall(ODDToken.initialize, (admin, pauser))));
        usdt = new OddMvpIntegrationUSDT();
        tierSale = TierSale(
            _proxy(address(new TierSale()), abi.encodeCall(TierSale.initialize, (admin, address(odd), address(usdt))))
        );
        houseVault =
            HouseVault(_proxy(address(new HouseVault()), abi.encodeCall(HouseVault.initialize, (admin, address(odd)))));
        rewards = EcosystemRewards(
            _proxy(address(new EcosystemRewards()), abi.encodeCall(EcosystemRewards.initialize, (admin, address(odd))))
        );
        dexSource = new OddMvpDummyContract();
        referralExpectedPool = new OddMvpDummyContract();
        referralRouter = new OddMvpReferralSwapRouter(address(referralExpectedPool));
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

        vm.startPrank(admin);
        odd.setTreasurySink(treasury, true);
        odd.setFixedSourceContracts(
            IODDTokenBusiness.FixedSources({
                tierSale: address(tierSale),
                houseVault: address(houseVault),
                dexLaunchController: address(dexSource),
                ecosystemRewards: address(rewards),
                opsTreasury: treasury
            })
        );
        odd.setWhitelist(address(staking), true);
        odd.setWhitelist(address(liquidity), true);
        odd.setWhitelist(address(betting), true);
        odd.setDexRestrictedTarget(address(referralRouter), true);
        odd.setDexRestrictedTarget(address(referralExpectedPool), true);
        odd.allocateInitialSupply();
        tierSale.startSale();
        staking.initializeV2(address(betting));
        liquidity.setBettingPool(address(betting));
        betting.setSettlementModule(address(new BettingSettlementModule()));
        betting.setBetModule(address(new BettingBetModule()));
        betting.setMarketModule(address(new BettingMarketModule()));
        betting.setReferralModule(address(new BettingReferralModule()));
        betting.setParlayModule(address(new BettingParlayModule()));
        betting.initializeV2(treasury);
        betting.setReferralClaimConfig(vm.addr(SIGNER_PK), 2500);
        betting.setReferralSwapConfig(address(referralRouter), address(usdt), address(referralExpectedPool));
        vm.stopPrank();

        _buySaleOdd(staker, 2_000 ether);
        _buySaleOdd(lpUser, 2_000 ether);
        _buySaleOdd(bettor, 2_000 ether);
        _buySaleOdd(bettor2, 2_000 ether);
    }

    function testStakingUsesBusinessSnapshotAndProfitBecomesTransferable() public {
        vm.prank(staker);
        odd.approve(address(staking), 1_000 ether);
        vm.prank(staker);
        uint256 positionId = staking.stake(1_000 ether, 0);

        bytes32 businessId = _businessId(address(staking), TokenBusinessTypes.STAKING_POSITION, bytes32(positionId));
        IODDTokenBusiness.BusinessSnapshot memory afterStake = odd.businessSnapshotOf(businessId);
        assertEq(afterStake.businessIn, 1_000 ether);
        assertEq(afterStake.sourceIn.saleLocked, 1_000 ether);
        assertEq(odd.lockedBalanceOf(staker), 1_000 ether);

        vm.prank(admin);
        houseVault.transferOdd(address(staking), 10 ether);
        vm.prank(address(betting));
        staking.notifyReward(10 ether);

        vm.warp(block.timestamp + 9 days);
        vm.prank(staker);
        staking.unstake(positionId);

        IODDTokenBusiness.BusinessSnapshot memory finalized = odd.businessSnapshotOf(businessId);
        assertTrue(finalized.finalized);
        assertEq(finalized.totalBusinessOut, 1_010 ether);
        assertEq(finalized.principalReturned, 1_000 ether);
        assertEq(finalized.profitRecognized, 10 ether);
        assertEq(finalized.lossRecognized, 0);
        assertEq(odd.balanceOf(staker), 2_010 ether);
        assertEq(odd.lockedBalanceOf(staker), 2_000 ether);
        assertEq(odd.transferableBalanceOf(staker), 10 ether);
    }

    function testLiquidityDepositWithdrawRestoresSaleSource() public {
        vm.prank(lpUser);
        odd.approve(address(liquidity), 1_000 ether);
        vm.prank(lpUser);
        uint256 positionId = liquidity.depositGlobal(1_000 ether, 0);

        bytes32 businessId = _businessId(address(liquidity), TokenBusinessTypes.LP_POSITION, bytes32(positionId));
        IODDTokenBusiness.BusinessSnapshot memory afterDeposit = odd.businessSnapshotOf(businessId);
        assertEq(afterDeposit.businessIn, 1_000 ether);
        assertEq(afterDeposit.sourceIn.saleLocked, 1_000 ether);
        assertEq(odd.lockedBalanceOf(lpUser), 1_000 ether);

        vm.warp(block.timestamp + 8 days);
        vm.prank(lpUser);
        liquidity.requestUnbond(positionId);

        vm.warp(block.timestamp + 4 days);
        vm.prank(lpUser);
        liquidity.withdraw(positionId);

        IODDTokenBusiness.BusinessSnapshot memory finalized = odd.businessSnapshotOf(businessId);
        assertTrue(finalized.finalized);
        assertEq(finalized.totalBusinessOut, 1_000 ether);
        assertEq(finalized.principalReturned, 1_000 ether);
        assertEq(finalized.profitRecognized, 0);
        assertEq(finalized.lossRecognized, 0);
        assertEq(odd.balanceOf(lpUser), 2_000 ether);
        assertEq(odd.lockedBalanceOf(lpUser), 2_000 ether);
        assertEq(odd.transferableBalanceOf(lpUser), 0);
    }

    function testBettingWinAndLossUpdateBusinessSources() public {
        _seedGlobalLiquidity();

        bytes32 marketId = _openMarket(keccak256("mvp-bet"));

        vm.prank(bettor);
        odd.approve(address(betting), 101 ether);
        (bytes32 winBet,,) = _placeBet(bettor, marketId, 0, 100 ether);

        vm.prank(bettor2);
        odd.approve(address(betting), 101 ether);
        (bytes32 loseBet,,) = _placeBet(bettor2, marketId, 1, 100 ether);

        vm.warp(block.timestamp + 3 hours);
        bytes32[] memory betIds = new bytes32[](2);
        betIds[0] = winBet;
        betIds[1] = loseBet;
        vm.prank(admin);
        betting.settleMarketBetsByScore(marketId, 1, 0, betIds);
        vm.prank(admin);
        betting.finalizeMarketSettlement(marketId, 0);

        IODDTokenBusiness.BusinessSnapshot memory losingSnapshot =
            odd.businessSnapshotOf(_businessId(address(betting), TokenBusinessTypes.BET_SINGLE, loseBet));
        assertTrue(losingSnapshot.finalized);
        assertEq(losingSnapshot.businessIn, 101 ether);
        assertEq(losingSnapshot.totalBusinessOut, 0);
        assertEq(losingSnapshot.lossRecognized, 101 ether);
        assertEq(odd.balanceOf(bettor2), 1_899 ether);
        assertEq(odd.lockedBalanceOf(bettor2), 1_899 ether);

        vm.prank(bettor);
        betting.claimPayout(winBet);

        IODDTokenBusiness.BusinessSnapshot memory winningSnapshot =
            odd.businessSnapshotOf(_businessId(address(betting), TokenBusinessTypes.BET_SINGLE, winBet));
        assertTrue(winningSnapshot.finalized);
        assertEq(winningSnapshot.businessIn, 101 ether);
        assertEq(winningSnapshot.principalReturned, 101 ether);
        assertEq(winningSnapshot.profitRecognized, winningSnapshot.totalBusinessOut - 101 ether);
        assertEq(uint8(betting.getBet(winBet).settlementState), uint8(BetSettlementState.WonClaimed));
        assertEq(odd.lockedBalanceOf(bettor), 2_000 ether);
        assertEq(odd.transferableBalanceOf(bettor), winningSnapshot.profitRecognized);
    }

    function testParlayWinRegistersNetProfitAsTransferable() public {
        _seedGlobalLiquidity();

        bytes32 marketA = _openMarketWithMatch(keccak256("mvp-parlay-a"), 0, 0, 3, 20_000);
        bytes32 marketB = _openMarketWithMatch(keccak256("mvp-parlay-b"), 0, 0, 3, 20_000);

        ParlayLegInput[] memory legs = new ParlayLegInput[](2);
        legs[0] = _leg(marketA, 0);
        legs[1] = _leg(marketB, 0);

        vm.prank(bettor);
        odd.approve(address(betting), 101 ether);
        vm.prank(bettor);
        bytes32 parlayId = betting.placeParlay(legs, 100 ether, 39_000, block.timestamp + 1 hours, address(0));

        bytes32 businessId = _businessId(address(betting), TokenBusinessTypes.BET_PARLAY, parlayId);
        IODDTokenBusiness.BusinessSnapshot memory afterPlace = odd.businessSnapshotOf(businessId);
        assertEq(afterPlace.businessIn, 101 ether);
        assertEq(afterPlace.sourceIn.saleLocked, 101 ether);

        _finalizeEmptyScoreMarket(marketA, 2, 1);
        _finalizeEmptyScoreMarket(marketB, 1, 0);
        vm.prank(admin);
        betting.settleParlay(parlayId);
        assertEq(uint8(_parlay(parlayId).state), uint8(ParlayState.WonUnclaimed));

        vm.prank(bettor);
        betting.claimParlayPayout(parlayId);

        IODDTokenBusiness.BusinessSnapshot memory finalized = odd.businessSnapshotOf(businessId);
        assertTrue(finalized.finalized);
        assertEq(finalized.totalBusinessOut, 380 ether);
        assertEq(finalized.principalReturned, 101 ether);
        assertEq(finalized.profitRecognized, 279 ether);
        assertEq(uint8(_parlay(parlayId).state), uint8(ParlayState.WonClaimed));
        assertEq(odd.lockedBalanceOf(bettor), 2_000 ether);
        assertEq(odd.transferableBalanceOf(bettor), 279 ether);
    }

    function testReferralOddClaimIsTransferableBusinessProfit() public {
        _seedGlobalLiquidity();
        bytes32 marketId = _openMarket(keccak256("mvp-referral-odd"));

        vm.prank(bettor);
        odd.approve(address(betting), 101 ether);
        _placeBetWithReferrer(bettor, marketId, 0, 100 ether, referrer);
        assertEq(betting.referrerRewardsOdd(referrer), 1 ether);

        vm.prank(referrer);
        uint256 claimed = betting.claimReferralRewards(1 ether);

        assertEq(claimed, 1 ether);
        assertEq(betting.referrerRewardsOdd(referrer), 0);
        assertEq(odd.balanceOf(referrer), 1 ether);
        assertEq(odd.lockedBalanceOf(referrer), 0);
        assertEq(odd.transferableBalanceOf(referrer), 1 ether);
    }

    function testReferralUsdtClaimUsesDexRestrictedExpectedPool() public {
        _seedGlobalLiquidity();
        bytes32 marketId = _openMarket(keccak256("mvp-referral-usdt"));

        vm.prank(bettor);
        odd.approve(address(betting), 101 ether);
        _placeBetWithReferrer(bettor, marketId, 0, 100 ether, referrer);

        uint256 available = betting.referrerRewardsOdd(referrer);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory signature =
            _referralSignature(referrer, available, 1e6, deadline, betting.referralClaimNonces(referrer));

        vm.prank(referrer);
        uint256 amountOut = betting.claimUSDTReferralRewards(1e6, deadline, signature, 1e6);

        assertEq(amountOut, 1e6);
        assertEq(betting.referrerRewardsOdd(referrer), 0);
        assertEq(usdt.balanceOf(referrer), 1e6);
        assertEq(odd.balanceOf(address(referralExpectedPool)), available);
        assertEq(
            odd.businessProfitSwapAllowance(address(betting), address(referralRouter), address(referralExpectedPool)), 0
        );
    }

    function _buySaleOdd(address user, uint256 oddAmount) internal {
        usdt.mint(user, 1_000e6);
        vm.prank(user);
        usdt.approve(address(tierSale), type(uint256).max);
        vm.prank(user);
        tierSale.buy(oddAmount);
    }

    function _seedGlobalLiquidity() internal {
        vm.prank(lpUser);
        odd.approve(address(liquidity), 1_000 ether);
        vm.prank(lpUser);
        liquidity.depositGlobal(1_000 ether, 0);
    }

    function _openMarket(bytes32 matchId) internal returns (bytes32 marketId) {
        uint256[] memory odds = new uint256[](2);
        odds[0] = 20_000;
        odds[1] = 20_000;
        vm.prank(admin);
        marketId = betting.openMarket(
            matchId,
            1,
            0,
            uint64(block.timestamp + 1 hours),
            uint64(block.timestamp + 2 hours),
            odds,
            uint64(block.timestamp)
        );
    }

    function _openMarketWithMatch(
        bytes32 matchId,
        uint8 marketType,
        uint8 line,
        uint256 outcomeCount,
        uint256 oddsValue
    ) internal returns (bytes32 marketId) {
        uint256[] memory odds = new uint256[](outcomeCount);
        for (uint256 i = 0; i < outcomeCount; ++i) {
            odds[i] = oddsValue;
        }
        vm.prank(admin);
        marketId = betting.openMarket(
            matchId,
            marketType,
            line,
            uint64(block.timestamp + 1 hours),
            uint64(block.timestamp + 2 hours),
            odds,
            uint64(block.timestamp)
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
            deadline: block.timestamp + 1 hours
        });
        vm.prank(user);
        (betId, acceptedAmount, lockedOdds) = betting.placeBet(marketId, outcome, amount, guard);
    }

    function _placeBetWithReferrer(address user, bytes32 marketId, uint8 outcome, uint256 amount, address boundReferrer)
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
            deadline: block.timestamp + 1 hours
        });
        vm.prank(user);
        (betId, acceptedAmount, lockedOdds) = betting.placeBet(marketId, outcome, amount, guard, boundReferrer);
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

    function _finalizeEmptyScoreMarket(bytes32 marketId, uint16 homeScore, uint16 awayScore) internal {
        vm.warp(betting.getMarket(marketId).matchEndTime + 1);
        bytes32[] memory betIds = new bytes32[](0);
        vm.startPrank(admin);
        betting.settleMarketBetsByScore(marketId, homeScore, awayScore, betIds);
        betting.finalizeMarketSettlement(marketId, 0);
        vm.stopPrank();
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

    function _businessId(address businessContract, uint16 businessType, bytes32 rawId) internal pure returns (bytes32) {
        return keccak256(abi.encode(businessContract, businessType, rawId));
    }

    function _proxy(address implementation, bytes memory initData) internal returns (address) {
        return address(new ERC1967Proxy(implementation, initData));
    }
}
