// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
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
import {PrecisionConstants} from "../src/shared/constants/PrecisionConstants.sol";

contract BscTestnetUpgradeAndValidate is Script {
    bytes32 internal constant IMPLEMENTATION_SLOT = 0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC;
    ODDToken internal constant ODD = ODDToken(0x9D3cfd96C447D45FBf3e10bf0D233C51DEb58Ad0);
    StakingPool internal constant STAKING = StakingPool(0x9378fd8E53c3904e972bf633Dbb96aA3EF46E32F);
    LiquidityPool internal constant LIQUIDITY = LiquidityPool(0x2de40A5AE2eF4a3fb8168ccd357b37A9fFC04b50);
    BettingPool internal constant BETTING = BettingPool(0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3);

    struct Actor {
        uint256 pk;
        address addr;
    }

    function run() external {
        Actor memory admin = _actor(vm.envUint("PRIVATE_KEY"));
        Actor memory userA = _actor(0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d);
        Actor memory userB = _actor(0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a);
        Actor memory userC = _actor(0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6);
        Actor memory userD = _actor(0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a);

        console2.log("ADMIN", admin.addr);
        console2.log("ODD_PROXY_BEFORE_IMPL", _implementationOf(address(ODD)));
        console2.log("STAKING_PROXY_BEFORE_IMPL", _implementationOf(address(STAKING)));
        console2.log("BETTING_PROXY_BEFORE_IMPL", _implementationOf(address(BETTING)));
        console2.log("LIQUIDITY_PROXY_BEFORE_IMPL", _implementationOf(address(LIQUIDITY)));

        vm.startBroadcast(admin.pk);
        ODDToken oddImpl = new ODDToken();
        StakingPool stakingImpl = new StakingPool();
        BettingPool bettingImpl = new BettingPool();
        BettingSettlementModule settlementImpl = new BettingSettlementModule();
        BettingBetModule betModuleImpl = new BettingBetModule();
        LiquidityPool liquidityImpl = new LiquidityPool();

        ODD.upgradeToAndCall(address(oddImpl), bytes(""));
        STAKING.upgradeToAndCall(address(stakingImpl), bytes(""));
        BETTING.upgradeToAndCall(address(bettingImpl), bytes(""));
        BETTING.setSettlementModule(address(settlementImpl));
        BETTING.setBetModule(address(betModuleImpl));
        BETTING.setMarketModule(address(new BettingMarketModule()));
        BETTING.setReferralModule(address(new BettingReferralModule()));
        LIQUIDITY.upgradeToAndCall(address(liquidityImpl), bytes(""));

        _fundNative(userA.addr, 0.01 ether);
        _fundNative(userB.addr, 0.01 ether);
        _fundNative(userC.addr, 0.01 ether);
        _fundNative(userD.addr, 0.01 ether);

        ODD.transfer(userA.addr, 25_000 ether);
        ODD.transfer(userB.addr, 25_000 ether);
        ODD.transfer(userC.addr, 25_000 ether);
        ODD.transfer(userD.addr, 25_000 ether);
        vm.stopBroadcast();

        console2.log("ODD_PROXY_AFTER_IMPL", _implementationOf(address(ODD)));
        console2.log("STAKING_PROXY_AFTER_IMPL", _implementationOf(address(STAKING)));
        console2.log("BETTING_PROXY_AFTER_IMPL", _implementationOf(address(BETTING)));
        console2.log("LIQUIDITY_PROXY_AFTER_IMPL", _implementationOf(address(LIQUIDITY)));

        _approveAndStake(userA, 10_000 ether);
        _approveAndStake(userB, 10_000 ether);
        _approveAndStake(userC, 10_000 ether);
        _approveAndStake(userD, 10_000 ether);

        _validateRequestableLiquidity(admin, userA);
        _validateRoundedOdds(admin, userA, userB, userC, userD);
        _validateNoActiveLpFallback(admin);
    }

    function _validateRequestableLiquidity(Actor memory admin, Actor memory bettor) internal {
        bytes32 matchId = keccak256(abi.encodePacked("upgrade-main-requestable", block.chainid, block.timestamp));

        uint256 requestableBefore = LIQUIDITY.getRequestableLiquidity();
        uint256 reserveBefore = BETTING.platformReserve();
        uint256 bettingBalanceBefore = ODD.balanceOf(address(BETTING));
        uint256 bettorBalanceBefore = ODD.balanceOf(bettor.addr);

        uint256[] memory baseOdds = _twoWayOdds(25_000, 20_000);
        vm.startBroadcast(admin.pk);
        bytes32 marketId = BETTING.openMarket(
            matchId,
            1,
            0,
            uint64(block.timestamp + 2 hours),
            uint64(block.timestamp + 4 hours),
            baseOdds,
            uint64(block.timestamp)
        );
        vm.stopBroadcast();

        QuoteGuardInput memory guard = _guard(BETTING, marketId, 0, 7_000 ether);
        vm.startBroadcast(bettor.pk);
        (bytes32 betId, uint256 acceptedAmount, uint256 lockedOdds) = BETTING.placeBet(marketId, 0, 7_000 ether, guard);
        vm.stopBroadcast();

        uint256 bettingBalanceAfterBet = ODD.balanceOf(address(BETTING));

        vm.warp(block.timestamp + 4 hours + 1);
        vm.startBroadcast(admin.pk);
        _settleByScore(BETTING, marketId, 1, 0);
        vm.stopBroadcast();

        uint256 requestableAfterSettle = LIQUIDITY.getRequestableLiquidity();
        uint256 reserveAfterSettle = BETTING.platformReserve();
        uint256 payoutWindowReserved;
        uint256 payoutWindowPaidOut;
        (payoutWindowReserved, payoutWindowPaidOut,) = LIQUIDITY.getPayoutLiquidityWindow(matchId);

        vm.startBroadcast(bettor.pk);
        BETTING.claimPayout(betId);
        vm.stopBroadcast();

        uint256 requestableAfterClaim = LIQUIDITY.getRequestableLiquidity();
        uint256 bettingBalanceAfterClaim = ODD.balanceOf(address(BETTING));
        uint256 bettorBalanceAfterClaim = ODD.balanceOf(bettor.addr);
        (payoutWindowReserved, payoutWindowPaidOut,) = LIQUIDITY.getPayoutLiquidityWindow(matchId);

        require(requestableAfterSettle == requestableAfterClaim, "REQUESTABLE_REBOUNDED");

        console2.log("MAIN_REQUESTABLE_MATCH");
        console2.logBytes32(matchId);
        console2.log("MAIN_REQUESTABLE_MARKET");
        console2.logBytes32(marketId);
        console2.log("MAIN_REQUESTABLE_BET");
        console2.logBytes32(betId);
        console2.log("MAIN_REQUESTABLE_ACCEPTED", acceptedAmount);
        console2.log("MAIN_REQUESTABLE_LOCKED_ODDS", lockedOdds);
        console2.log("MAIN_REQUESTABLE_PAYOUT", acceptedAmount * lockedOdds / PrecisionConstants.ODDS_RATE_SCALE);
        console2.log("MAIN_REQUESTABLE_BEFORE", requestableBefore);
        console2.log("MAIN_REQUESTABLE_AFTER_SETTLE", requestableAfterSettle);
        console2.log("MAIN_REQUESTABLE_AFTER_CLAIM", requestableAfterClaim);
        console2.log("MAIN_RESERVE_BEFORE", reserveBefore);
        console2.log("MAIN_RESERVE_AFTER_SETTLE", reserveAfterSettle);
        console2.log("MAIN_BETTING_BAL_BEFORE", bettingBalanceBefore);
        console2.log("MAIN_BETTING_BAL_AFTER_BET", bettingBalanceAfterBet);
        console2.log("MAIN_BETTING_BAL_AFTER_CLAIM", bettingBalanceAfterClaim);
        console2.log("MAIN_BETTOR_BAL_BEFORE", bettorBalanceBefore);
        console2.log("MAIN_BETTOR_BAL_AFTER_CLAIM", bettorBalanceAfterClaim);
        console2.log("MAIN_WINDOW_RESERVED", payoutWindowReserved);
        console2.log("MAIN_WINDOW_PAID_OUT", payoutWindowPaidOut);
    }

    function _validateRoundedOdds(
        Actor memory admin,
        Actor memory userA,
        Actor memory userB,
        Actor memory userC,
        Actor memory userD
    ) internal {
        vm.startBroadcast(admin.pk);
        ODD.approve(address(BETTING), type(uint256).max);
        BETTING.addPlatformReserve(100_000 ether);

        bytes32 invalidMatchId = keccak256(abi.encodePacked("upgrade-invalid-odds", block.chainid, block.timestamp));
        uint256[] memory invalidOdds = _twoWayOdds(20_050, 10_100);
        (bool invalidOk,) = address(BETTING)
            .call(
                abi.encodeCall(
                    BETTING.openMarket,
                    (
                        invalidMatchId,
                        uint8(1),
                        uint8(0),
                        uint64(block.timestamp + 2 hours),
                        uint64(block.timestamp + 4 hours),
                        invalidOdds,
                        uint64(block.timestamp)
                    )
                )
            );
        require(!invalidOk, "INVALID_ODDS_ACCEPTED");

        bytes32 matchId = keccak256(abi.encodePacked("upgrade-rounded-odds", block.chainid, block.timestamp));
        bytes32 marketId = BETTING.openMarket(
            matchId,
            0,
            0,
            uint64(block.timestamp + 2 hours),
            uint64(block.timestamp + 4 hours),
            _threeWayOdds(20_100, 30_100, 40_100),
            uint64(block.timestamp)
        );
        vm.stopBroadcast();

        Actor[4] memory bettors = [userA, userB, userC, userD];
        for (uint256 i = 0; i < bettors.length; ++i) {
            QuoteGuardInput memory guard = _guard(BETTING, marketId, 0, 10_000 ether);
            vm.startBroadcast(bettors[i].pk);
            BETTING.placeBet(marketId, 0, 10_000 ether, guard);
            vm.stopBroadcast();
        }

        (, uint256[] memory quotedOdds,, uint256 quoteVersion) = BETTING.getMarketOdds(marketId);
        for (uint256 i = 0; i < quotedOdds.length; ++i) {
            require(quotedOdds[i] % PrecisionConstants.DISPLAY_ODDS_STEP == 0, "ODDS_NOT_ROUNDED");
            require(quotedOdds[i] >= 10_100, "ODDS_BELOW_MIN");
        }

        console2.log("ROUNDED_ODDS_MATCH");
        console2.logBytes32(matchId);
        console2.log("ROUNDED_ODDS_MARKET");
        console2.logBytes32(marketId);
        console2.log("ROUNDED_ODDS_VERSION", quoteVersion);
        console2.log("ROUNDED_ODDS_0", quotedOdds[0]);
        console2.log("ROUNDED_ODDS_1", quotedOdds[1]);
        console2.log("ROUNDED_ODDS_2", quotedOdds[2]);
    }

    function _validateNoActiveLpFallback(Actor memory admin) internal {
        vm.startBroadcast(admin.pk);
        LiquidityPool liquidityImpl = new LiquidityPool();
        BettingSettlementModule settlementImpl = new BettingSettlementModule();
        BettingBetModule betModuleImpl = new BettingBetModule();
        BettingPool bettingImpl = new BettingPool();

        ERC1967Proxy liquidityProxy = new ERC1967Proxy(
            address(liquidityImpl), abi.encodeCall(LiquidityPool.initialize, (admin.addr, address(ODD), admin.addr))
        );
        LiquidityPool isolatedLiquidity = LiquidityPool(address(liquidityProxy));

        ERC1967Proxy bettingProxy = new ERC1967Proxy(
            address(bettingImpl),
            abi.encodeCall(
                BettingPool.initialize, (admin.addr, address(ODD), address(STAKING), address(isolatedLiquidity))
            )
        );
        BettingPool isolatedBetting = BettingPool(address(bettingProxy));

        isolatedLiquidity.setBettingPool(address(isolatedBetting));
        isolatedBetting.setSettlementModule(address(settlementImpl));
        isolatedBetting.setBetModule(address(betModuleImpl));
        isolatedBetting.setMarketModule(address(new BettingMarketModule()));
        isolatedBetting.setReferralModule(address(new BettingReferralModule()));
        ODD.approve(address(isolatedBetting), type(uint256).max);
        isolatedBetting.addPlatformReserve(10_000 ether);

        bytes32 matchId = keccak256(abi.encodePacked("upgrade-no-lp-fallback", block.chainid, block.timestamp));
        bytes32 marketId = isolatedBetting.openMarket(
            matchId,
            1,
            0,
            uint64(block.timestamp + 2 hours),
            uint64(block.timestamp + 4 hours),
            _twoWayOdds(20_000, 20_000),
            uint64(block.timestamp)
        );
        QuoteGuardInput memory guard = _guard(isolatedBetting, marketId, 0, 100 ether);
        (bytes32 betId, uint256 acceptedAmount, uint256 lockedOdds) =
            isolatedBetting.placeBet(marketId, 0, 100 ether, guard);

        uint256 reserveBefore = isolatedBetting.platformReserve();
        uint256 liquidityBalanceBefore = ODD.balanceOf(address(isolatedLiquidity));
        _settleByScore(isolatedBetting, marketId, 1, 0);
        uint256 reserveAfter = isolatedBetting.platformReserve();
        uint256 liquidityBalanceAfter = ODD.balanceOf(address(isolatedLiquidity));
        vm.stopBroadcast();

        require(liquidityBalanceBefore == liquidityBalanceAfter, "NO_LP_MARGIN_TRANSFERRED");
        require(reserveAfter == reserveBefore + 8 ether - 100 ether, "NO_LP_FALLBACK_INCORRECT");

        console2.log("NO_LP_LIQUIDITY_PROXY", address(isolatedLiquidity));
        console2.log("NO_LP_BETTING_PROXY", address(isolatedBetting));
        console2.log("NO_LP_MATCH");
        console2.logBytes32(matchId);
        console2.log("NO_LP_MARKET");
        console2.logBytes32(marketId);
        console2.log("NO_LP_BET");
        console2.logBytes32(betId);
        console2.log("NO_LP_ACCEPTED", acceptedAmount);
        console2.log("NO_LP_LOCKED_ODDS", lockedOdds);
        console2.log("NO_LP_RESERVE_BEFORE", reserveBefore);
        console2.log("NO_LP_RESERVE_AFTER", reserveAfter);
        console2.log("NO_LP_LIQUIDITY_BAL_BEFORE", liquidityBalanceBefore);
        console2.log("NO_LP_LIQUIDITY_BAL_AFTER", liquidityBalanceAfter);
    }

    function _approveAndStake(Actor memory actor, uint256 amount) internal {
        vm.startBroadcast(actor.pk);
        ODD.approve(address(STAKING), type(uint256).max);
        ODD.approve(address(BETTING), type(uint256).max);
        STAKING.stake(amount, 1);
        vm.stopBroadcast();
    }

    function _guard(BettingPool pool, bytes32 marketId, uint8 outcome, uint256 requestedAmount)
        internal
        view
        returns (QuoteGuardInput memory guard)
    {
        (, uint256 acceptedAmount, uint256 lockedOdds,,) = pool.previewSignal(marketId, outcome, requestedAmount);
        (,, uint64 updatedAt, uint256 quoteVersion) = pool.getMarketOdds(marketId);
        guard = QuoteGuardInput({
            quoteVersion: quoteVersion,
            quotedAt: updatedAt,
            minOdds: lockedOdds,
            minAcceptedAmount: acceptedAmount,
            deadline: block.timestamp + 1 hours
        });
    }

    function _settleByScore(BettingPool pool, bytes32 marketId, uint16 homeScore, uint16 awayScore) internal {
        bytes32[] memory betIds = pool.getMarketBetIds(marketId, 0, 50);
        if (betIds.length > 0) {
            pool.settleMarketBetsByScore(marketId, homeScore, awayScore, betIds);
        }
        pool.finalizeMarketSettlement(marketId, 0);
    }

    function _implementationOf(address proxy) internal view returns (address impl) {
        impl = address(uint160(uint256(vm.load(proxy, IMPLEMENTATION_SLOT))));
    }

    function _actor(uint256 pk) internal pure returns (Actor memory actor) {
        actor.pk = pk;
        actor.addr = vm.addr(pk);
    }

    function _fundNative(address recipient, uint256 amount) internal {
        (bool ok,) = payable(recipient).call{value: amount}("");
        require(ok, "NATIVE_FUND_FAILED");
    }

    function _twoWayOdds(uint256 a, uint256 b) internal pure returns (uint256[] memory baseOdds) {
        baseOdds = new uint256[](2);
        baseOdds[0] = a;
        baseOdds[1] = b;
    }

    function _threeWayOdds(uint256 a, uint256 b, uint256 c) internal pure returns (uint256[] memory baseOdds) {
        baseOdds = new uint256[](3);
        baseOdds[0] = a;
        baseOdds[1] = b;
        baseOdds[2] = c;
    }
}
