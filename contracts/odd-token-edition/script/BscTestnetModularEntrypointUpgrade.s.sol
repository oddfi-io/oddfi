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

contract BscTestnetModularEntrypointUpgrade is Script {
    bytes32 internal constant IMPLEMENTATION_SLOT = 0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC;

    BettingPool internal constant BETTING = BettingPool(0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3);

    struct Result {
        address bettingImplementation;
        address settlementModule;
        address betModule;
        address marketModule;
        address referralModule;
        address parlayModule;
        address parlayLens;
    }

    function run() external returns (Result memory result) {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);

        console2.log("deployer", deployer);
        console2.log("bettingProxy", address(BETTING));
        console2.log("bettingImplBefore", _implementationOf(address(BETTING)));
        console2.log("settlementModuleBefore", BETTING.settlementModule());
        console2.log("parlayModuleBefore", BETTING.parlayModule());

        vm.startBroadcast(deployerPk);

        BettingPool bettingImpl = new BettingPool();
        BettingSettlementModule settlementModule = new BettingSettlementModule();
        BettingBetModule betModule = new BettingBetModule();
        BettingMarketModule marketModule = new BettingMarketModule();
        BettingReferralModule referralModule = new BettingReferralModule();
        BettingParlayModule parlayModule = new BettingParlayModule();
        BettingParlayLens parlayLens = new BettingParlayLens();

        BETTING.upgradeToAndCall(address(bettingImpl), bytes(""));
        BETTING.setSettlementModule(address(settlementModule));
        BETTING.setBetModule(address(betModule));
        BETTING.setMarketModule(address(marketModule));
        BETTING.setReferralModule(address(referralModule));
        BETTING.setParlayModule(address(parlayModule));

        vm.stopBroadcast();

        _assertImplementation(address(BETTING), address(bettingImpl), "BETTING_IMPL_MISMATCH");
        require(BETTING.settlementModule() == address(settlementModule), "SETTLEMENT_MODULE_MISMATCH");
        require(BETTING.betModule() == address(betModule), "BET_MODULE_MISMATCH");
        require(BETTING.marketModule() == address(marketModule), "MARKET_MODULE_MISMATCH");
        require(BETTING.referralModule() == address(referralModule), "REFERRAL_MODULE_MISMATCH");
        require(BETTING.parlayModule() == address(parlayModule), "PARLAY_MODULE_MISMATCH");

        console2.log("bettingImplAfter", _implementationOf(address(BETTING)));
        console2.log("settlementModuleAfter", BETTING.settlementModule());
        console2.log("betModuleAfter", BETTING.betModule());
        console2.log("marketModuleAfter", BETTING.marketModule());
        console2.log("referralModuleAfter", BETTING.referralModule());
        console2.log("parlayModuleAfter", BETTING.parlayModule());
        console2.log("parlayLens", address(parlayLens));

        result = Result({
            bettingImplementation: address(bettingImpl),
            settlementModule: address(settlementModule),
            betModule: address(betModule),
            marketModule: address(marketModule),
            referralModule: address(referralModule),
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
