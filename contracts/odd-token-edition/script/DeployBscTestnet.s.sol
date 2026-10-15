// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {DeployAll} from "./DeployAll.s.sol";

contract DeployBscTestnet is DeployAll {
    address internal constant BSC_TESTNET_USDT = 0x337610d27c682E347C9cD60BD4b3b107C9d34dDd;
    address internal constant PANCAKE_V3_TESTNET_SWAP_ROUTER = 0x1b81D678ffb9C0263b24A97847620C99d213eB14;
    address internal constant PANCAKE_V3_TESTNET_POSITION_MANAGER = 0x427bF5b37357632377eCbEC9de3626C71A5396c1;

    function run(
        address admin,
        address pauser,
        address platformTreasury,
        address opsTreasury,
        address referralClaimSigner,
        uint24 referralSwapPoolFee,
        uint256 initialPlatformReserve,
        address referralSwapExpectedPool
    ) external returns (DeploymentResult memory result) {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        DeployConfig memory cfg = _buildConfig(
            vm.addr(deployerPk),
            admin,
            pauser,
            platformTreasury,
            opsTreasury,
            referralClaimSigner,
            referralSwapPoolFee,
            initialPlatformReserve,
            BSC_TESTNET_USDT,
            PANCAKE_V3_TESTNET_POSITION_MANAGER,
            PANCAKE_V3_TESTNET_SWAP_ROUTER,
            referralSwapExpectedPool
        );

        vm.startBroadcast(deployerPk);

        DeployedSystem memory sys = _deploySystem(cfg);
        _configureSystem(cfg, sys);
        _assertDeploymentGate(cfg, sys);

        if (cfg.admin != cfg.deployer || cfg.pauser != cfg.deployer) {
            _grantFinalRoles(cfg, sys);
            _revokeBootstrapRoles(cfg, sys);
        }

        vm.stopBroadcast();

        _logDeployment(cfg, sys);
        result = _deploymentResult(cfg, sys);
    }
}
