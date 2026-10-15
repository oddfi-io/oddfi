// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

import {ODDToken} from "../src/modules/token/ODDToken.sol";
import {TierSale} from "../src/modules/token/TierSale.sol";
import {DexLaunchController} from "../src/modules/token/DexLaunchController.sol";
import {DexLpLocker} from "../src/modules/token/DexLpLocker.sol";
import {EcosystemRewards} from "../src/modules/token/EcosystemRewards.sol";
import {StakingPool} from "../src/modules/staking/StakingPool.sol";
import {LiquidityPool} from "../src/modules/liquidity/LiquidityPool.sol";
import {BettingPool} from "../src/modules/betting/BettingPool.sol";
import {BettingPoolStorage} from "../src/modules/betting/BettingPoolStorage.sol";
import {QuoteGuardInput} from "../src/shared/types/CommonTypes.sol";
import {ParlayLegInput} from "../src/shared/types/ParlayTypes.sol";

interface IPancakeV2RouterTestnetLike {
    function swapExactETHForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline)
        external
        payable
        returns (uint256[] memory amounts);
}

contract BscTestnetMvpFullValidation is Script {
    using SafeERC20 for IERC20;
    using MessageHashUtils for bytes32;

    ODDToken internal constant ODD = ODDToken(0x9D3cfd96C447D45FBf3e10bf0D233C51DEb58Ad0);
    TierSale internal constant TIER_SALE = TierSale(0xBe938fB7AF656B111a123B749bB724d8351497C7);
    DexLaunchController internal constant DEX_LAUNCH = DexLaunchController(0x070f72Fda6eAa8335162A5A5629Fb12f9f8b6d54);
    DexLpLocker internal constant LP_LOCKER = DexLpLocker(0xC30d6407df0E7291dbE8A58A2c44808C92AFD3a9);
    EcosystemRewards internal constant REWARDS = EcosystemRewards(0x6c5352D01160E50C50b66dD61BD3d48Ff6B4E2ac);
    StakingPool internal constant STAKING = StakingPool(0x9378fd8E53c3904e972bf633Dbb96aA3EF46E32F);
    LiquidityPool internal constant LIQUIDITY = LiquidityPool(0x2de40A5AE2eF4a3fb8168ccd357b37A9fFC04b50);
    BettingPool internal constant BETTING = BettingPool(0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3);

    IERC20 internal constant USDT = IERC20(0x337610d27c682E347C9cD60BD4b3b107C9d34dDd);
    IPancakeV2RouterTestnetLike internal constant PANCAKE_V2_ROUTER =
        IPancakeV2RouterTestnetLike(0xD99D1c33F9fC3444f8101754aBC46c52416550D1);
    address internal constant WBNB = 0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd;
    address internal constant PANCAKE_V3_SWAP_ROUTER = 0x1b81D678ffb9C0263b24A97847620C99d213eB14;

    uint24 internal constant POOL_FEE = 2500;
    int24 internal constant TICK_LOWER = -887250;
    int24 internal constant TICK_UPPER = 887250;
    uint160 internal constant SQRT_PRICE_X96_100_ODD_PER_USDT = 792281625142643375935439503360;
    uint256 internal constant SALE_ODD = 1_000 ether;
    uint256 internal constant STAKE_AMOUNT = 100 ether;
    uint256 internal constant BET_AMOUNT = 100 ether;
    uint256 internal constant LP_AMOUNT = 1_000 ether;

    struct Actor {
        uint256 pk;
        address addr;
    }

    struct Actors {
        Actor admin;
        Actor saleUser;
        Actor rewardUser;
        Actor staker;
        Actor lpUser;
        Actor cashoutUser;
        Actor bettor;
        Actor parlayUser;
        Actor referrer;
    }

    function seed(bytes32 salt) external {
        Actors memory a = _actors(salt);
        _assertDeployment(a.admin.addr);
        _seedActors(a);
        console2.log("VALIDATION_PHASE", "seed_complete");
    }

    function saleAndDex(bytes32 salt) external {
        Actors memory a = _actors(salt);
        _assertDeployment(a.admin.addr);
        _runSaleAndDexLaunch(a);
        console2.log("VALIDATION_PHASE", "sale_and_dex_complete");
    }

    function stakingSources(bytes32 salt) external {
        Actors memory a = _actors(salt);
        _assertDeployment(a.admin.addr);
        _runStakingSources(a);
        console2.log("VALIDATION_PHASE", "staking_sources_complete");
    }

    function liquiditySetup(bytes32 salt) external {
        Actors memory a = _actors(salt);
        _assertDeployment(a.admin.addr);
        _runLiquiditySetup(a, salt);
        console2.log("VALIDATION_PHASE", "liquidity_setup_complete");
    }

    function cashOutAndReferral(bytes32 salt) external {
        Actors memory a = _actors(salt);
        _assertDeployment(a.admin.addr);
        _runCashOutAndReferral(a, salt);
        console2.log("VALIDATION_PHASE", "cashout_referral_complete");
    }

    function ordinaryBetSetup(bytes32 salt) external {
        Actors memory a = _actors(salt);
        _assertDeployment(a.admin.addr);
        _runOrdinaryBetSetup(a, salt);
        console2.log("VALIDATION_PHASE", "ordinary_bet_setup_complete");
    }

    function parlaySetup(bytes32 salt) external {
        Actors memory a = _actors(salt);
        _assertDeployment(a.admin.addr);
        _runParlaySetup(a, salt);
        console2.log("VALIDATION_PHASE", "parlay_setup_complete");
        console2.log("SETTLE_AFTER", _maxSettlementTime(salt));
    }

    function setup(bytes32 salt) external {
        Actors memory a = _actors(salt);
        _assertDeployment(a.admin.addr);
        _seedActors(a);
        _runSaleAndDexLaunch(a);
        _runStakingSources(a);
        _runLiquiditySetup(a, salt);
        _runCashOutAndReferral(a, salt);
        _runOrdinaryBetSetup(a, salt);
        _runParlaySetup(a, salt);

        uint256 settleAfter = _maxSettlementTime(salt);
        console2.log("VALIDATION_PHASE", "setup_complete");
        console2.log("VALIDATION_SALT");
        console2.logBytes32(salt);
        console2.log("SETTLE_AFTER", settleAfter);
        console2.log("ORDINARY_MARKET");
        console2.logBytes32(_marketId(_matchId("ordinary", salt)));
        console2.log("ORDINARY_BET_ID");
        console2.logBytes32(_betId(2));
        console2.log("PARLAY_ID");
        console2.logBytes32(_parlayId(1));
        console2.log("MATCH_LP_POSITION_ID", uint256(2));
    }

    function settle(bytes32 salt) external {
        Actors memory a = _actors(salt);
        uint256 settleAfter = _maxSettlementTime(salt);
        require(block.timestamp >= settleAfter, "MATCH_NOT_READY");

        bytes32 ordinaryMarket = _marketId(_matchId("ordinary", salt));
        bytes32 ordinaryBetId = _betId(2);
        bytes32[] memory ordinaryBets = new bytes32[](1);
        ordinaryBets[0] = ordinaryBetId;

        vm.startBroadcast(a.admin.pk);
        BETTING.settleMarketBetsByScore(ordinaryMarket, 1, 0, ordinaryBets);
        BETTING.finalizeMarketSettlement(ordinaryMarket, 0);
        vm.stopBroadcast();

        vm.startBroadcast(a.bettor.pk);
        BETTING.claimPayout(ordinaryBetId);
        vm.stopBroadcast();

        _settleParlayLegMarket(_matchId("parlay-a", salt));
        _settleParlayLegMarket(_matchId("parlay-b", salt));

        bytes32 parlayId = _parlayId(1);
        vm.startBroadcast(a.admin.pk);
        BETTING.settleParlay(parlayId);
        vm.stopBroadcast();

        vm.startBroadcast(a.parlayUser.pk);
        BETTING.claimParlayPayout(parlayId);
        vm.stopBroadcast();

        vm.startBroadcast(a.lpUser.pk);
        LIQUIDITY.requestUnbond(2);
        vm.stopBroadcast();

        console2.log("VALIDATION_PHASE", "settle_complete");
        console2.log("ORDINARY_CLAIMED_BET");
        console2.logBytes32(ordinaryBetId);
        console2.log("PARLAY_CLAIMED");
        console2.logBytes32(parlayId);
        console2.log("MATCH_LP_UNBOND_REQUESTED", uint256(2));
        console2.log("MATURE_STAKE_WITHDRAW_STATUS", "pending_8_day_lock");
        console2.log("LP_WITHDRAW_STATUS", "pending_unbond_epoch_after_match_unlock");
    }

    function _assertDeployment(address admin) internal view {
        require(ODD.initialSupplyAllocated(), "ODD_INITIAL_SUPPLY_NOT_ALLOCATED");
        require(ODD.fixedSourcesConfigured(), "ODD_FIXED_SOURCES_NOT_CONFIGURED");
        require(ODD.isTreasurySink(admin), "ADMIN_NOT_TREASURY_SINK");
        require(ODD.isWhitelist(address(STAKING)), "STAKING_NOT_WHITELISTED");
        require(ODD.isWhitelist(address(LIQUIDITY)), "LIQUIDITY_NOT_WHITELISTED");
        require(ODD.isWhitelist(address(BETTING)), "BETTING_NOT_WHITELISTED");
        require(address(STAKING.oddToken()) == address(ODD), "STAKING_ODD_MISMATCH");
        require(address(LIQUIDITY.oddToken()) == address(ODD), "LIQUIDITY_ODD_MISMATCH");
        require(address(BETTING.oddToken()) == address(ODD), "BETTING_ODD_MISMATCH");
        require(BETTING.settlementModule() == 0xC29ebbdd68d7718f0fe1B8E187d84ae8F34bfA39, "SETTLEMENT_MISMATCH");
        require(BETTING.betModule() == 0xe911D8472F53f64E8B06eAb31E8Ec6Cc5B4c8825, "BET_MODULE_MISMATCH");
        require(BETTING.marketModule() == 0xD786A66a77Ff137A09Aa2fa69BbD8f6AE42f79De, "MARKET_MODULE_MISMATCH");
        require(BETTING.referralModule() == 0x6f481A9E772AFDF85741a5FA82985DCcaC79Bb6B, "REFERRAL_MODULE_MISMATCH");
        require(BETTING.parlayModule() == 0xD7AcFb964C01D4be09757207034FD919dA06fE96, "PARLAY_MODULE_MISMATCH");
    }

    function _seedActors(Actors memory a) internal {
        vm.startBroadcast(a.admin.pk);
        _fundNative(a.saleUser.addr, 0.05 ether);
        _fundNative(a.rewardUser.addr, 0.05 ether);
        _fundNative(a.staker.addr, 0.05 ether);
        _fundNative(a.lpUser.addr, 0.08 ether);
        _fundNative(a.cashoutUser.addr, 0.05 ether);
        _fundNative(a.bettor.addr, 0.05 ether);
        _fundNative(a.parlayUser.addr, 0.05 ether);
        _fundNative(a.referrer.addr, 0.08 ether);

        IERC20(address(ODD)).safeTransfer(a.rewardUser.addr, 500 ether);
        IERC20(address(ODD)).safeTransfer(a.staker.addr, 500 ether);
        IERC20(address(ODD)).safeTransfer(a.lpUser.addr, 5_000 ether);
        IERC20(address(ODD)).safeTransfer(a.cashoutUser.addr, 1_000 ether);
        IERC20(address(ODD)).safeTransfer(a.bettor.addr, 2_000 ether);
        IERC20(address(ODD)).safeTransfer(a.parlayUser.addr, 2_000 ether);
        vm.stopBroadcast();

        _approveOdd(a.saleUser, address(STAKING));
        _approveOdd(a.rewardUser, address(STAKING));
        _approveOdd(a.staker, address(STAKING));
        _approveOdd(a.lpUser, address(LIQUIDITY));
        _approveOdd(a.cashoutUser, address(BETTING));
        _approveOdd(a.bettor, address(BETTING));
        _approveOdd(a.parlayUser, address(BETTING));
    }

    function _runSaleAndDexLaunch(Actors memory a) internal {
        uint256 saleCost = TIER_SALE.previewBuy(SALE_ODD);
        address[] memory path = new address[](2);
        path[0] = WBNB;
        path[1] = address(USDT);

        vm.startBroadcast(a.admin.pk);
        PANCAKE_V2_ROUTER.swapExactETHForTokens{value: 1 ether}(0, path, a.admin.addr, block.timestamp + 600);
        USDT.safeTransfer(a.saleUser.addr, saleCost);
        TIER_SALE.startSale();
        vm.stopBroadcast();

        vm.startBroadcast(a.saleUser.pk);
        USDT.forceApprove(address(TIER_SALE), saleCost);
        TIER_SALE.buy(SALE_ODD);
        vm.stopBroadcast();

        vm.startBroadcast(a.saleUser.pk);
        uint256 saleStakePositionId = STAKING.stake(STAKE_AMOUNT, 0);
        STAKING.earlyUnstake(saleStakePositionId);
        vm.stopBroadcast();

        vm.startBroadcast(a.admin.pk);
        TIER_SALE.forceFinalize(saleCost, SALE_ODD);
        TIER_SALE.approveLaunch(address(DEX_LAUNCH), saleCost, SALE_ODD);
        DEX_LAUNCH.setLaunchConfig(POOL_FEE, TICK_LOWER, TICK_UPPER, SQRT_PRICE_X96_100_ODD_PER_USDT, 365 days);
        (address pool, uint256 tokenId,,,) = DEX_LAUNCH.launch(SALE_ODD, saleCost, 0, 0, block.timestamp + 600);
        BETTING.setReferralSwapConfig(PANCAKE_V3_SWAP_ROUTER, address(USDT), pool);
        vm.stopBroadcast();

        (address beneficiary, uint64 lockedAt, uint64 unlockAt, bool released) = LP_LOCKER.lockedPositions(tokenId);
        require(pool != address(0), "DEX_POOL_ZERO");
        require(beneficiary == a.admin.addr && lockedAt != 0 && unlockAt > block.timestamp && !released, "LP_LOCK_BAD");
        console2.log("SALE_STAKE_EARLY_UNSTAKED", saleStakePositionId);
        console2.log("DEX_POOL", pool);
        console2.log("DEX_LP_TOKEN_ID", tokenId);
    }

    function _runStakingSources(Actors memory a) internal {
        vm.startBroadcast(a.admin.pk);
        REWARDS.setCategoryBudget(1, 1_000 ether);
        uint256 rewardClaimId = REWARDS.createClaimable(a.rewardUser.addr, 1, 200 ether);
        vm.stopBroadcast();

        vm.startBroadcast(a.rewardUser.pk);
        REWARDS.claim(rewardClaimId);
        uint256 rewardStakePositionId = STAKING.stake(STAKE_AMOUNT, 0);
        STAKING.earlyUnstake(rewardStakePositionId);
        vm.stopBroadcast();

        vm.startBroadcast(a.staker.pk);
        uint256 manualStakePositionId = STAKING.stake(STAKE_AMOUNT, 0);
        STAKING.earlyUnstake(manualStakePositionId);
        vm.stopBroadcast();

        console2.log("REWARD_STAKE_EARLY_UNSTAKED", rewardStakePositionId);
        console2.log("MANUAL_STAKE_EARLY_UNSTAKED", manualStakePositionId);
    }

    function _runLiquiditySetup(Actors memory a, bytes32 salt) internal {
        vm.startBroadcast(a.lpUser.pk);
        uint256 globalPositionId = LIQUIDITY.depositGlobal(LP_AMOUNT, 0);
        vm.stopBroadcast();

        bytes32 matchId = _matchId("ordinary", salt);
        bytes32 marketId = _openAhMarket(a.admin, matchId, _baseStartTime(salt), _baseEndTime(salt));

        vm.startBroadcast(a.lpUser.pk);
        uint256 matchPositionId = LIQUIDITY.depositMatch(matchId, LP_AMOUNT);
        vm.stopBroadcast();

        console2.log("GLOBAL_LP_POSITION_ID", globalPositionId);
        console2.log("MATCH_LP_POSITION_ID", matchPositionId);
        console2.log("ORDINARY_MARKET_OPENED");
        console2.logBytes32(marketId);
    }

    function _runCashOutAndReferral(Actors memory a, bytes32 salt) internal {
        bytes32 marketId = _openAhMarket(
            a.admin, _matchId("cashout", salt), uint64(block.timestamp + 1 hours), uint64(block.timestamp + 2 hours)
        );
        QuoteGuardInput memory guard = _guard(marketId, 0, BET_AMOUNT);

        vm.startBroadcast(a.cashoutUser.pk);
        (bytes32 cashoutBetId,,) = BETTING.placeBet(marketId, 0, BET_AMOUNT, guard, a.referrer.addr);
        (,, uint64 updatedAt, uint256 quoteVersion) = BETTING.getMarketOdds(marketId);
        BETTING.cashOut(cashoutBetId, quoteVersion, updatedAt, 0, block.timestamp + 600);
        vm.stopBroadcast();

        uint256 oddReward = BETTING.referrerRewardsOdd(a.referrer.addr);
        require(oddReward > 0, "NO_ODD_REFERRAL_REWARD");
        vm.startBroadcast(a.referrer.pk);
        BETTING.claimReferralRewards(oddReward);
        vm.stopBroadcast();

        console2.log("CASHOUT_BET_ID");
        console2.logBytes32(cashoutBetId);
        console2.log("ODD_REFERRAL_CLAIMED", oddReward);
    }

    function _runOrdinaryBetSetup(Actors memory a, bytes32 salt) internal {
        bytes32 marketId = _marketId(_matchId("ordinary", salt));
        QuoteGuardInput memory guard = _guard(marketId, 0, BET_AMOUNT);

        vm.startBroadcast(a.bettor.pk);
        (bytes32 betId,,) = BETTING.placeBet(marketId, 0, BET_AMOUNT, guard, a.referrer.addr);
        vm.stopBroadcast();

        uint256 rewardOdd = BETTING.referrerRewardsOdd(a.referrer.addr);
        uint256 nonce = BETTING.referralClaimNonces(a.referrer.addr);
        uint256 deadline = block.timestamp + 600;
        bytes memory signature = _referralSignature(a.admin.pk, a.referrer.addr, rewardOdd, 0, deadline, nonce);

        vm.startBroadcast(a.referrer.pk);
        uint256 usdtOut = BETTING.claimUSDTReferralRewards(0, deadline, signature, 0);
        vm.stopBroadcast();

        console2.log("ORDINARY_BET_ID");
        console2.logBytes32(betId);
        console2.log("USDT_REFERRAL_OUT", usdtOut);
    }

    function _runParlaySetup(Actors memory a, bytes32 salt) internal {
        bytes32 marketA = _openAhMarket(a.admin, _matchId("parlay-a", salt), _baseStartTime(salt), _baseEndTime(salt));
        bytes32 marketB = _openAhMarket(a.admin, _matchId("parlay-b", salt), _baseStartTime(salt), _baseEndTime(salt));
        ParlayLegInput[] memory legs = new ParlayLegInput[](2);
        legs[0] = _parlayLeg(marketA);
        legs[1] = _parlayLeg(marketB);

        vm.startBroadcast(a.parlayUser.pk);
        bytes32 parlayId = BETTING.placeParlay(legs, BET_AMOUNT, 0, block.timestamp + 600, address(0));
        vm.stopBroadcast();

        console2.log("PARLAY_MARKET_A");
        console2.logBytes32(marketA);
        console2.log("PARLAY_MARKET_B");
        console2.logBytes32(marketB);
        console2.log("PARLAY_ID");
        console2.logBytes32(parlayId);
    }

    function _settleParlayLegMarket(bytes32 matchId) internal {
        bytes32 marketId = _marketId(matchId);
        bytes32[] memory empty = new bytes32[](0);
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        BETTING.settleMarketBetsByScore(marketId, 1, 0, empty);
        BETTING.finalizeMarketSettlement(marketId, 0);
        vm.stopBroadcast();
    }

    function _openAhMarket(Actor memory admin, bytes32 matchId, uint64 startTime, uint64 endTime)
        internal
        returns (bytes32 marketId)
    {
        uint256[] memory odds = new uint256[](2);
        odds[0] = 20_000;
        odds[1] = 20_000;
        vm.startBroadcast(admin.pk);
        marketId = BETTING.openMarket(matchId, 1, 0, startTime, endTime, odds, uint64(block.timestamp));
        vm.stopBroadcast();
    }

    function _guard(bytes32 marketId, uint8 outcome, uint256 amount)
        internal
        view
        returns (QuoteGuardInput memory guard)
    {
        (, uint256 accepted, uint256 lockedOdds,,) = BETTING.previewSignal(marketId, outcome, amount);
        (,, uint64 updatedAt, uint256 quoteVersion) = BETTING.getMarketOdds(marketId);
        require(accepted == amount, "BET_NOT_FULLY_ACCEPTED");
        guard = QuoteGuardInput({
            quoteVersion: quoteVersion,
            quotedAt: updatedAt,
            minOdds: lockedOdds,
            minAcceptedAmount: accepted,
            deadline: block.timestamp + 600
        });
    }

    function _parlayLeg(bytes32 marketId) internal view returns (ParlayLegInput memory leg) {
        (,, uint64 updatedAt, uint256 quoteVersion) = BETTING.getMarketOdds(marketId);
        leg = ParlayLegInput({
            marketId: marketId, outcome: 0, quoteVersion: quoteVersion, quotedAt: updatedAt, minOdds: 0
        });
    }

    function _approveOdd(Actor memory actor, address spender) internal {
        vm.startBroadcast(actor.pk);
        IERC20(address(ODD)).forceApprove(spender, type(uint256).max);
        vm.stopBroadcast();
    }

    function _fundNative(address to, uint256 amount) internal {
        (bool ok,) = payable(to).call{value: amount}("");
        require(ok, "FUND_NATIVE_FAILED");
    }

    function _referralSignature(
        uint256 signerPk,
        address claimant,
        uint256 oddAmount,
        uint256 rewardMinUsdtOut,
        uint256 deadline,
        uint256 nonce
    ) internal view returns (bytes memory signature) {
        bytes32 digest = keccak256(
                abi.encode(address(BETTING), block.chainid, claimant, oddAmount, rewardMinUsdtOut, deadline, nonce)
            ).toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        signature = abi.encodePacked(r, s, v);
    }

    function _actors(bytes32 salt) internal view returns (Actors memory a) {
        a.admin = Actor({pk: vm.envUint("PRIVATE_KEY"), addr: vm.addr(vm.envUint("PRIVATE_KEY"))});
        a.saleUser = _actor("sale-user", salt);
        a.rewardUser = _actor("reward-user", salt);
        a.staker = _actor("staker", salt);
        a.lpUser = _actor("lp-user", salt);
        a.cashoutUser = _actor("cashout-user", salt);
        a.bettor = _actor("bettor", salt);
        a.parlayUser = _actor("parlay-user", salt);
        a.referrer = _actor("referrer", salt);
    }

    function _actor(string memory label, bytes32 salt) internal view returns (Actor memory actor) {
        actor.pk = uint256(keccak256(abi.encodePacked("oddfi-bsc-testnet-mvp-validation", label, salt)));
        actor.addr = vm.addr(actor.pk);
    }

    function _matchId(string memory label, bytes32 salt) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("oddfi-bsc-testnet-mvp-validation", label, salt));
    }

    function _marketId(bytes32 matchId) internal pure returns (bytes32) {
        return keccak256(abi.encode(matchId, uint8(1), uint8(0)));
    }

    function _betId(uint256 nonce) internal pure returns (bytes32) {
        return bytes32(nonce);
    }

    function _parlayId(uint256 nonce) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(address(BETTING), "ODDFI_PARLAY", nonce));
    }

    function _baseStartTime(bytes32 salt) internal view returns (uint64) {
        salt;
        return uint64(block.timestamp + 90);
    }

    function _baseEndTime(bytes32 salt) internal view returns (uint64) {
        salt;
        return uint64(block.timestamp + 150);
    }

    function _maxSettlementTime(bytes32 salt) internal view returns (uint256 settleAfter) {
        uint64 ordinaryEnd = _marketEndTime(_marketId(_matchId("ordinary", salt)));
        uint64 parlayAEnd = _marketEndTime(_marketId(_matchId("parlay-a", salt)));
        uint64 parlayBEnd = _marketEndTime(_marketId(_matchId("parlay-b", salt)));
        uint64 maxEnd = ordinaryEnd;
        if (parlayAEnd > maxEnd) maxEnd = parlayAEnd;
        if (parlayBEnd > maxEnd) maxEnd = parlayBEnd;
        settleAfter = uint256(maxEnd) + 20;
    }

    function _marketEndTime(bytes32 marketId) internal view returns (uint64) {
        BettingPoolStorage.MarketConfig memory market = BETTING.getMarket(marketId);
        return market.matchEndTime;
    }
}
