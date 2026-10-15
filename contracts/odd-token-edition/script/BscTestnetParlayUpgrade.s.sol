// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {LiquidityPool} from "../src/modules/liquidity/LiquidityPool.sol";
import {BettingPool} from "../src/modules/betting/BettingPool.sol";
import {BettingBetModule} from "../src/modules/betting/BettingBetModule.sol";
import {BettingMarketModule} from "../src/modules/betting/BettingMarketModule.sol";
import {BettingReferralModule} from "../src/modules/betting/BettingReferralModule.sol";
import {BettingSettlementModule} from "../src/modules/betting/BettingSettlementModule.sol";
import {BettingParlayModule} from "../src/modules/betting/BettingParlayModule.sol";
import {BettingParlayLens} from "../src/modules/betting/BettingParlayLens.sol";

contract BscTestnetParlayUpgrade is Script {
    bytes32 internal constant IMPLEMENTATION_SLOT = 0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC;

    LiquidityPool internal constant LIQUIDITY = LiquidityPool(0x2de40A5AE2eF4a3fb8168ccd357b37A9fFC04b50);
    BettingPool internal constant BETTING = BettingPool(0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3);

    struct Result {
        address liquidityImplementation;
        address bettingImplementation;
        address settlementModule;
        address betModule;
        address parlayModule;
        address parlayLens;
    }

    function run(uint256 globalRequestableInitial) external returns (Result memory result) {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);

        console2.log("deployer", deployer);
        console2.log("liquidityProxy", address(LIQUIDITY));
        console2.log("bettingProxy", address(BETTING));
        console2.log("liquidityImplBefore", _implementationOf(address(LIQUIDITY)));
        console2.log("bettingImplBefore", _implementationOf(address(BETTING)));
        console2.log("settlementModuleBefore", BETTING.settlementModule());
        console2.log("globalRequestableInitial", globalRequestableInitial);

        vm.startBroadcast(deployerPk);

        LiquidityPool liquidityImpl = new LiquidityPool();
        BettingPool bettingImpl = new BettingPool();
        BettingSettlementModule settlementModule = new BettingSettlementModule();
        BettingBetModule betModule = new BettingBetModule();
        BettingParlayModule parlayModule = new BettingParlayModule();
        BettingParlayLens parlayLens = new BettingParlayLens();

        LIQUIDITY.upgradeToAndCall(
            address(liquidityImpl),
            abi.encodeCall(LiquidityPool.initializeGlobalRequestableLiquidity, (globalRequestableInitial))
        );
        BETTING.upgradeToAndCall(address(bettingImpl), abi.encodeCall(BettingPool.initializeV3, ()));
        BETTING.setSettlementModule(address(settlementModule));
        BETTING.setBetModule(address(betModule));
        BETTING.setMarketModule(address(new BettingMarketModule()));
        BETTING.setReferralModule(address(new BettingReferralModule()));
        BETTING.setParlayModule(address(parlayModule));

        vm.stopBroadcast();

        _assertImplementation(address(LIQUIDITY), address(liquidityImpl), "LIQUIDITY_IMPL_MISMATCH");
        _assertImplementation(address(BETTING), address(bettingImpl), "BETTING_IMPL_MISMATCH");
        require(BETTING.settlementModule() == address(settlementModule), "SETTLEMENT_MODULE_MISMATCH");
        require(BETTING.betModule() == address(betModule), "BET_MODULE_MISMATCH");
        require(BETTING.parlayModule() == address(parlayModule), "PARLAY_MODULE_MISMATCH");
        require(LIQUIDITY.getGlobalRequestableLiquidity() == globalRequestableInitial, "GLOBAL_REQUESTABLE_MISMATCH");

        console2.log("liquidityImplAfter", _implementationOf(address(LIQUIDITY)));
        console2.log("bettingImplAfter", _implementationOf(address(BETTING)));
        console2.log("settlementModuleAfter", BETTING.settlementModule());
        console2.log("betModuleAfter", BETTING.betModule());
        console2.log("parlayModuleAfter", BETTING.parlayModule());
        console2.log("parlayLens", address(parlayLens));
        console2.log("globalRequestableAfter", LIQUIDITY.getGlobalRequestableLiquidity());

        result = Result({
            liquidityImplementation: address(liquidityImpl),
            bettingImplementation: address(bettingImpl),
            settlementModule: address(settlementModule),
            betModule: address(betModule),
            parlayModule: address(parlayModule),
            parlayLens: address(parlayLens)
        });
    }

    function _assertImplementation(address proxy, address expected, string memory message) internal view {
        require(_implementationOf(proxy) == expected, message);
    }

    function _implementationOf(address proxy) internal view returns (address impl) {
        impl = address(uint160(uint256(vm.load(proxy, IMPLEMENTATION_SLOT))));
    }
}
