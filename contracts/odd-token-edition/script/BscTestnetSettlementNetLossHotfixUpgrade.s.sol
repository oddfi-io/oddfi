// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {BettingPool} from "../src/modules/betting/BettingPool.sol";
import {BettingSettlementModule} from "../src/modules/betting/BettingSettlementModule.sol";
import {BettingParlayModule} from "../src/modules/betting/BettingParlayModule.sol";

contract BscTestnetSettlementNetLossHotfixUpgrade is Script {
    BettingPool internal constant BETTING = BettingPool(0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3);

    struct Result {
        address deployer;
        address bettingProxy;
        address settlementModuleBefore;
        address settlementModuleAfter;
        address parlayModuleBefore;
        address parlayModuleAfter;
    }

    function run() external returns (Result memory result) {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);

        address settlementModuleBefore = BETTING.settlementModule();
        address parlayModuleBefore = BETTING.parlayModule();

        console2.log("deployer", deployer);
        console2.log("bettingProxy", address(BETTING));
        console2.log("settlementModuleBefore", settlementModuleBefore);
        console2.log("parlayModuleBefore", parlayModuleBefore);

        vm.startBroadcast(deployerPk);

        BettingSettlementModule settlementModule = new BettingSettlementModule();
        BettingParlayModule parlayModule = new BettingParlayModule();

        BETTING.setSettlementModule(address(settlementModule));
        BETTING.setParlayModule(address(parlayModule));

        vm.stopBroadcast();

        address settlementModuleAfter = BETTING.settlementModule();
        address parlayModuleAfter = BETTING.parlayModule();

        require(settlementModuleAfter == address(settlementModule), "SETTLEMENT_MODULE_MISMATCH");
        require(parlayModuleAfter == address(parlayModule), "PARLAY_MODULE_MISMATCH");

        console2.log("settlementModuleAfter", settlementModuleAfter);
        console2.log("parlayModuleAfter", parlayModuleAfter);

        result = Result({
            deployer: deployer,
            bettingProxy: address(BETTING),
            settlementModuleBefore: settlementModuleBefore,
            settlementModuleAfter: settlementModuleAfter,
            parlayModuleBefore: parlayModuleBefore,
            parlayModuleAfter: parlayModuleAfter
        });
    }
}
