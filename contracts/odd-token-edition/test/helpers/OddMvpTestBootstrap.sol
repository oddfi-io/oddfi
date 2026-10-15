// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

import {ODDToken} from "../../src/modules/token/ODDToken.sol";
import {IODDTokenBusiness} from "../../src/modules/token/interfaces/IODDTokenBusiness.sol";

contract OddMvpTestFixedSource {}

abstract contract OddMvpTestBootstrap is Test {
    function _bootstrapOddMvpToken(
        ODDToken odd,
        address admin,
        address treasury,
        address staking,
        address liquidity,
        address betting
    ) internal {
        OddMvpTestFixedSource tierSale = new OddMvpTestFixedSource();
        OddMvpTestFixedSource houseVault = new OddMvpTestFixedSource();
        OddMvpTestFixedSource dexLaunchController = new OddMvpTestFixedSource();
        OddMvpTestFixedSource ecosystemRewards = new OddMvpTestFixedSource();

        vm.startPrank(admin);
        odd.setTreasurySink(admin, true);
        if (treasury != address(0) && treasury != admin) {
            odd.setTreasurySink(treasury, true);
        }
        odd.setFixedSourceContracts(
            IODDTokenBusiness.FixedSources({
                tierSale: address(tierSale),
                houseVault: address(houseVault),
                dexLaunchController: address(dexLaunchController),
                ecosystemRewards: address(ecosystemRewards),
                opsTreasury: admin
            })
        );
        if (staking != address(0)) odd.setWhitelist(staking, true);
        if (liquidity != address(0)) odd.setWhitelist(liquidity, true);
        if (betting != address(0)) odd.setWhitelist(betting, true);
        odd.allocateInitialSupply();
        vm.stopPrank();
    }
}
