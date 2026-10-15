// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {BettingPool} from "../src/modules/betting/BettingPool.sol";
import {BettingMarketModule} from "../src/modules/betting/BettingMarketModule.sol";
import {BettingSettlementModule} from "../src/modules/betting/BettingSettlementModule.sol";
import {BettingParlayModule} from "../src/modules/betting/BettingParlayModule.sol";
import {BettingParlayLens} from "../src/modules/betting/BettingParlayLens.sol";

contract BscTestnetOddsV3LineUpgrade is Script {
    BettingPool internal constant BETTING = BettingPool(0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3);

    struct Result {
        address deployer;
        address bettingProxy;
        address settlementModuleBefore;
        address settlementModuleAfter;
        address marketModuleBefore;
        address marketModuleAfter;
        address parlayModuleBefore;
        address parlayModuleAfter;
        address parlayLens;
    }

    function run() external returns (Result memory result) {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);

        address settlementModuleBefore = BETTING.settlementModule();
        address marketModuleBefore = BETTING.marketModule();
        address parlayModuleBefore = BETTING.parlayModule();

        console2.log("deployer", deployer);
        console2.log("bettingProxy", address(BETTING));
        console2.log("settlementModuleBefore", settlementModuleBefore);
        console2.log("marketModuleBefore", marketModuleBefore);
        console2.log("parlayModuleBefore", parlayModuleBefore);

        vm.startBroadcast(deployerPk);

        BettingSettlementModule settlementModule = new BettingSettlementModule();
        BettingMarketModule marketModule = new BettingMarketModule();
        BettingParlayModule parlayModule = new BettingParlayModule();
        BettingParlayLens parlayLens = new BettingParlayLens();

        BETTING.setSettlementModule(address(settlementModule));
        BETTING.setMarketModule(address(marketModule));
        BETTING.setParlayModule(address(parlayModule));

        vm.stopBroadcast();

        address settlementModuleAfter = BETTING.settlementModule();
        address marketModuleAfter = BETTING.marketModule();
        address parlayModuleAfter = BETTING.parlayModule();

        require(settlementModuleAfter == address(settlementModule), "SETTLEMENT_MODULE_MISMATCH");
        require(marketModuleAfter == address(marketModule), "MARKET_MODULE_MISMATCH");
        require(parlayModuleAfter == address(parlayModule), "PARLAY_MODULE_MISMATCH");

        console2.log("settlementModuleAfter", settlementModuleAfter);
        console2.log("marketModuleAfter", marketModuleAfter);
        console2.log("parlayModuleAfter", parlayModuleAfter);
        console2.log("parlayLens", address(parlayLens));

        result = Result({
            deployer: deployer,
            bettingProxy: address(BETTING),
            settlementModuleBefore: settlementModuleBefore,
            settlementModuleAfter: settlementModuleAfter,
            marketModuleBefore: marketModuleBefore,
            marketModuleAfter: marketModuleAfter,
            parlayModuleBefore: parlayModuleBefore,
            parlayModuleAfter: parlayModuleAfter,
            parlayLens: address(parlayLens)
        });
    }
}
