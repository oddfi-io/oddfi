// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {BettingPool} from "../src/modules/betting/BettingPool.sol";
import {BettingBetModule} from "../src/modules/betting/BettingBetModule.sol";
import {BettingMarketModule} from "../src/modules/betting/BettingMarketModule.sol";
import {BettingReferralModule} from "../src/modules/betting/BettingReferralModule.sol";
import {BettingSettlementModule} from "../src/modules/betting/BettingSettlementModule.sol";
import {BettingParlayModule} from "../src/modules/betting/BettingParlayModule.sol";
import {BettingParlayLens} from "../src/modules/betting/BettingParlayLens.sol";

contract BscTestnetQueryInterfacesUpgrade is Script {
    BettingPool internal constant BETTING = BettingPool(0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3);

    struct Result {
        address settlementModule;
        address betModule;
        address parlayModule;
        address parlayLens;
    }

    function run() external returns (Result memory result) {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);

        console2.log("deployer", deployer);
        console2.log("bettingProxy", address(BETTING));
        console2.log("settlementModuleBefore", BETTING.settlementModule());
        console2.log("betModuleBefore", BETTING.betModule());
        console2.log("parlayModuleBefore", BETTING.parlayModule());

        vm.startBroadcast(deployerPk);

        BettingSettlementModule settlementModule = new BettingSettlementModule();
        BettingBetModule betModule = new BettingBetModule();
        BettingParlayModule parlayModule = new BettingParlayModule();
        BettingParlayLens parlayLens = new BettingParlayLens();

        BETTING.setSettlementModule(address(settlementModule));
        BETTING.setBetModule(address(betModule));
        BETTING.setMarketModule(address(new BettingMarketModule()));
        BETTING.setReferralModule(address(new BettingReferralModule()));
        BETTING.setParlayModule(address(parlayModule));

        vm.stopBroadcast();

        require(BETTING.settlementModule() == address(settlementModule), "SETTLEMENT_MODULE_MISMATCH");
        require(BETTING.betModule() == address(betModule), "BET_MODULE_MISMATCH");
        require(BETTING.parlayModule() == address(parlayModule), "PARLAY_MODULE_MISMATCH");

        console2.log("settlementModuleAfter", BETTING.settlementModule());
        console2.log("betModuleAfter", BETTING.betModule());
        console2.log("parlayModuleAfter", BETTING.parlayModule());
        console2.log("parlayLens", address(parlayLens));

        result = Result({
            settlementModule: address(settlementModule),
            betModule: address(betModule),
            parlayModule: address(parlayModule),
            parlayLens: address(parlayLens)
        });
    }
}
