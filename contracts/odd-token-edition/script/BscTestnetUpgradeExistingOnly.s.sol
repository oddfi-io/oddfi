// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {ODDToken} from "../src/modules/token/ODDToken.sol";
import {StakingPool} from "../src/modules/staking/StakingPool.sol";
import {LiquidityPool} from "../src/modules/liquidity/LiquidityPool.sol";
import {BettingPool} from "../src/modules/betting/BettingPool.sol";
import {BettingBetModule} from "../src/modules/betting/BettingBetModule.sol";
import {BettingMarketModule} from "../src/modules/betting/BettingMarketModule.sol";
import {BettingReferralModule} from "../src/modules/betting/BettingReferralModule.sol";
import {BettingSettlementModule} from "../src/modules/betting/BettingSettlementModule.sol";

contract BscTestnetUpgradeExistingOnly is Script {
    bytes32 internal constant IMPLEMENTATION_SLOT = 0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC;

    ODDToken internal constant ODD = ODDToken(0x9D3cfd96C447D45FBf3e10bf0D233C51DEb58Ad0);
    StakingPool internal constant STAKING = StakingPool(0x9378fd8E53c3904e972bf633Dbb96aA3EF46E32F);
    LiquidityPool internal constant LIQUIDITY = LiquidityPool(0x2de40A5AE2eF4a3fb8168ccd357b37A9fFC04b50);
    BettingPool internal constant BETTING = BettingPool(0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3);

    address internal constant PANCAKE_V3_SWAP_ROUTER = 0x13f4EA83D0bd40E75C8222255bc855a974568Dd4;
    address internal constant BSC_USDT = 0x55d398326f99059fF775485246999027B3197955;

    struct Result {
        address oddImplementation;
        address stakingImplementation;
        address liquidityImplementation;
        address bettingImplementation;
        address settlementModule;
        address betModule;
    }

    function run() external returns (Result memory result) {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);
        address referralSwapExpectedPool = vm.envOr("REFERRAL_SWAP_EXPECTED_POOL", address(0));

        console2.log("deployer", deployer);
        console2.log("oddProxy", address(ODD));
        console2.log("stakingProxy", address(STAKING));
        console2.log("liquidityProxy", address(LIQUIDITY));
        console2.log("bettingProxy", address(BETTING));
        console2.log("oddImplBefore", _implementationOf(address(ODD)));
        console2.log("stakingImplBefore", _implementationOf(address(STAKING)));
        console2.log("liquidityImplBefore", _implementationOf(address(LIQUIDITY)));
        console2.log("bettingImplBefore", _implementationOf(address(BETTING)));
        console2.log("settlementModuleBefore", BETTING.settlementModule());
        console2.log("betModuleBefore", BETTING.betModule());

        vm.startBroadcast(deployerPk);

        ODDToken oddImpl = new ODDToken();
        StakingPool stakingImpl = new StakingPool();
        LiquidityPool liquidityImpl = new LiquidityPool();
        BettingPool bettingImpl = new BettingPool();
        BettingSettlementModule settlementModule = new BettingSettlementModule();
        BettingBetModule betModule = new BettingBetModule();

        ODD.upgradeToAndCall(address(oddImpl), bytes(""));
        STAKING.upgradeToAndCall(address(stakingImpl), bytes(""));
        LIQUIDITY.upgradeToAndCall(address(liquidityImpl), bytes(""));
        BETTING.upgradeToAndCall(address(bettingImpl), bytes(""));
        BETTING.setSettlementModule(address(settlementModule));
        BETTING.setBetModule(address(betModule));
        BETTING.setMarketModule(address(new BettingMarketModule()));
        BETTING.setReferralModule(address(new BettingReferralModule()));
        if (referralSwapExpectedPool != address(0)) {
            BETTING.setReferralSwapConfig(PANCAKE_V3_SWAP_ROUTER, BSC_USDT, referralSwapExpectedPool);
        }

        vm.stopBroadcast();

        _assertImplementation(address(ODD), address(oddImpl), "ODD_IMPL_MISMATCH");
        _assertImplementation(address(STAKING), address(stakingImpl), "STAKING_IMPL_MISMATCH");
        _assertImplementation(address(LIQUIDITY), address(liquidityImpl), "LIQUIDITY_IMPL_MISMATCH");
        _assertImplementation(address(BETTING), address(bettingImpl), "BETTING_IMPL_MISMATCH");
        require(BETTING.settlementModule() == address(settlementModule), "SETTLEMENT_MODULE_MISMATCH");
        require(BETTING.betModule() == address(betModule), "BET_MODULE_MISMATCH");
        if (referralSwapExpectedPool != address(0)) {
            require(BETTING.referralSwapRouter() == PANCAKE_V3_SWAP_ROUTER, "REFERRAL_ROUTER_MISMATCH");
            require(BETTING.referralUsdtToken() == BSC_USDT, "REFERRAL_USDT_MISMATCH");
            require(BETTING.referralSwapExpectedPool() == referralSwapExpectedPool, "REFERRAL_POOL_MISMATCH");
        }

        console2.log("oddImplAfter", _implementationOf(address(ODD)));
        console2.log("stakingImplAfter", _implementationOf(address(STAKING)));
        console2.log("liquidityImplAfter", _implementationOf(address(LIQUIDITY)));
        console2.log("bettingImplAfter", _implementationOf(address(BETTING)));
        console2.log("betModuleAfter", BETTING.betModule());
        console2.log("settlementModuleAfter", BETTING.settlementModule());
        console2.log("referralSwapRouter", BETTING.referralSwapRouter());
        console2.log("referralUsdtToken", BETTING.referralUsdtToken());
        console2.log("referralSwapExpectedPool", BETTING.referralSwapExpectedPool());

        result = Result({
            oddImplementation: address(oddImpl),
            stakingImplementation: address(stakingImpl),
            liquidityImplementation: address(liquidityImpl),
            bettingImplementation: address(bettingImpl),
            settlementModule: address(settlementModule),
            betModule: address(betModule)
        });
    }

    function _assertImplementation(address proxy, address expected, string memory message) internal view {
        require(_implementationOf(proxy) == expected, message);
    }

    function _implementationOf(address proxy) internal view returns (address impl) {
        impl = address(uint160(uint256(vm.load(proxy, IMPLEMENTATION_SLOT))));
    }
}
