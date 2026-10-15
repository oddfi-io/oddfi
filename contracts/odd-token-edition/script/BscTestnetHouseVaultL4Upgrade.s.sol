// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {BettingPool} from "../src/modules/betting/BettingPool.sol";
import {HouseVault} from "../src/modules/token/HouseVault.sol";
import {ODDToken} from "../src/modules/token/ODDToken.sol";

contract BscTestnetHouseVaultL4Upgrade is Script {
    bytes32 internal constant IMPLEMENTATION_SLOT = 0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC;

    ODDToken internal constant ODD = ODDToken(0x9D3cfd96C447D45FBf3e10bf0D233C51DEb58Ad0);
    HouseVault internal constant HOUSE_VAULT = HouseVault(0x41e87F99f1a3dBDb09A337AEf4C4841d90b5d280);
    BettingPool internal constant BETTING = BettingPool(0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3);

    struct Result {
        address deployer;
        address houseVaultImplementationBefore;
        address houseVaultImplementationAfter;
        address bettingImplementationBefore;
        address bettingImplementationAfter;
        uint256 l4FundAmount;
        uint256 platformReserveBefore;
        uint256 platformReserveAfter;
        uint256 accountedBalanceBefore;
        uint256 accountedBalanceAfter;
        uint256 bettingBalanceBefore;
        uint256 bettingBalanceAfter;
    }

    function run() external returns (Result memory result) {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);
        uint256 l4FundAmount = vm.envOr("HOUSEVAULT_L4_TEST_AMOUNT", uint256(1 ether));

        address houseVaultImplementationBefore = _implementationOf(address(HOUSE_VAULT));
        address bettingImplementationBefore = _implementationOf(address(BETTING));
        uint256 platformReserveBefore = BETTING.platformReserve();
        uint256 accountedBalanceBefore = BETTING.accountedBalance();
        uint256 bettingBalanceBefore = ODD.balanceOf(address(BETTING));
        uint256 houseVaultAllowanceBefore = ODD.allowance(address(HOUSE_VAULT), address(BETTING));

        console2.log("deployer", deployer);
        console2.log("houseVaultProxy", address(HOUSE_VAULT));
        console2.log("bettingProxy", address(BETTING));
        console2.log("houseVaultImplBefore", houseVaultImplementationBefore);
        console2.log("bettingImplBefore", bettingImplementationBefore);
        console2.log("l4FundAmount", l4FundAmount);
        console2.log("platformReserveBefore", platformReserveBefore);
        console2.log("accountedBalanceBefore", accountedBalanceBefore);
        console2.log("bettingBalanceBefore", bettingBalanceBefore);
        console2.log("houseVaultAllowanceBefore", houseVaultAllowanceBefore);

        vm.startBroadcast(deployerPk);

        HouseVault houseVaultImplementation = new HouseVault();
        BettingPool bettingImplementation = new BettingPool();

        HOUSE_VAULT.upgradeToAndCall(address(houseVaultImplementation), bytes(""));
        BETTING.upgradeToAndCall(address(bettingImplementation), bytes(""));

        if (l4FundAmount > 0) {
            HOUSE_VAULT.fundBettingPlatformReserve(address(BETTING), l4FundAmount);
        }

        vm.stopBroadcast();

        address houseVaultImplementationAfter = _implementationOf(address(HOUSE_VAULT));
        address bettingImplementationAfter = _implementationOf(address(BETTING));
        uint256 platformReserveAfter = BETTING.platformReserve();
        uint256 accountedBalanceAfter = BETTING.accountedBalance();
        uint256 bettingBalanceAfter = ODD.balanceOf(address(BETTING));
        uint256 houseVaultAllowanceAfter = ODD.allowance(address(HOUSE_VAULT), address(BETTING));

        require(houseVaultImplementationAfter == address(houseVaultImplementation), "HOUSEVAULT_IMPL_MISMATCH");
        require(bettingImplementationAfter == address(bettingImplementation), "BETTING_IMPL_MISMATCH");
        require(houseVaultAllowanceAfter == 0, "HOUSEVAULT_ALLOWANCE_NOT_CLEARED");
        require(platformReserveAfter == platformReserveBefore + l4FundAmount, "PLATFORM_RESERVE_NOT_FUNDED");
        require(accountedBalanceAfter == accountedBalanceBefore + l4FundAmount, "ACCOUNTED_BALANCE_NOT_FUNDED");
        require(bettingBalanceAfter == bettingBalanceBefore + l4FundAmount, "BETTING_BALANCE_NOT_FUNDED");

        console2.log("houseVaultImplAfter", houseVaultImplementationAfter);
        console2.log("bettingImplAfter", bettingImplementationAfter);
        console2.log("platformReserveAfter", platformReserveAfter);
        console2.log("accountedBalanceAfter", accountedBalanceAfter);
        console2.log("bettingBalanceAfter", bettingBalanceAfter);
        console2.log("houseVaultAllowanceAfter", houseVaultAllowanceAfter);

        result = Result({
            deployer: deployer,
            houseVaultImplementationBefore: houseVaultImplementationBefore,
            houseVaultImplementationAfter: houseVaultImplementationAfter,
            bettingImplementationBefore: bettingImplementationBefore,
            bettingImplementationAfter: bettingImplementationAfter,
            l4FundAmount: l4FundAmount,
            platformReserveBefore: platformReserveBefore,
            platformReserveAfter: platformReserveAfter,
            accountedBalanceBefore: accountedBalanceBefore,
            accountedBalanceAfter: accountedBalanceAfter,
            bettingBalanceBefore: bettingBalanceBefore,
            bettingBalanceAfter: bettingBalanceAfter
        });
    }

    function _implementationOf(address proxy) internal view returns (address impl) {
        impl = address(uint160(uint256(vm.load(proxy, IMPLEMENTATION_SLOT))));
    }
}
