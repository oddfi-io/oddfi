// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

import {ODDToken} from "../src/modules/token/ODDToken.sol";
import {TierSale} from "../src/modules/token/TierSale.sol";
import {HouseVault} from "../src/modules/token/HouseVault.sol";
import {DexLaunchController} from "../src/modules/token/DexLaunchController.sol";
import {DexLpLocker} from "../src/modules/token/DexLpLocker.sol";
import {EcosystemRewards} from "../src/modules/token/EcosystemRewards.sol";
import {IODDTokenBusiness} from "../src/modules/token/interfaces/IODDTokenBusiness.sol";
import {StakingPool} from "../src/modules/staking/StakingPool.sol";
import {LiquidityPool} from "../src/modules/liquidity/LiquidityPool.sol";
import {BettingPool} from "../src/modules/betting/BettingPool.sol";
import {BettingBetModule} from "../src/modules/betting/BettingBetModule.sol";
import {BettingMarketModule} from "../src/modules/betting/BettingMarketModule.sol";
import {BettingReferralModule} from "../src/modules/betting/BettingReferralModule.sol";
import {BettingParlayModule} from "../src/modules/betting/BettingParlayModule.sol";
import {BettingParlayLens} from "../src/modules/betting/BettingParlayLens.sol";
import {BettingSettlementModule} from "../src/modules/betting/BettingSettlementModule.sol";
import {Roles} from "../src/shared/access/Roles.sol";

contract DeployAll is Script {
    address internal constant BSC_USDT = 0x55d398326f99059fF775485246999027B3197955;
    address internal constant PANCAKE_V3_SWAP_ROUTER = 0x13f4EA83D0bd40E75C8222255bc855a974568Dd4;
    address internal constant PANCAKE_V3_POSITION_MANAGER = 0x46A15B0b27311cedF172AB29E4f4766fbE7F4364;

    struct DeployConfig {
        address deployer;
        address admin;
        address pauser;
        address platformTreasury;
        address opsTreasury;
        address usdt;
        address positionManager;
        address referralSwapRouter;
        address referralSwapExpectedPool;
        address referralClaimSigner;
        uint24 referralSwapPoolFee;
        uint256 initialPlatformReserve;
    }

    struct DeployedSystem {
        ODDToken oddImpl;
        ODDToken odd;
        TierSale tierSaleImpl;
        TierSale tierSale;
        HouseVault houseVaultImpl;
        HouseVault houseVault;
        DexLpLocker lpLockerImpl;
        DexLpLocker lpLocker;
        DexLaunchController dexLaunchImpl;
        DexLaunchController dexLaunch;
        EcosystemRewards rewardsImpl;
        EcosystemRewards rewards;
        StakingPool stakingImpl;
        StakingPool staking;
        LiquidityPool liquidityImpl;
        LiquidityPool liquidity;
        BettingPool bettingImpl;
        BettingPool betting;
        BettingSettlementModule settlementImpl;
        BettingBetModule betModuleImpl;
        BettingParlayModule parlayModuleImpl;
        BettingParlayLens parlayLens;
        BettingMarketModule marketModuleImpl;
        BettingReferralModule referralModuleImpl;
    }

    struct DeploymentResult {
        address deployer;
        address admin;
        address pauser;
        address platformTreasury;
        address opsTreasury;
        address oddImplementation;
        address oddProxy;
        address tierSaleImplementation;
        address tierSaleProxy;
        address houseVaultImplementation;
        address houseVaultProxy;
        address dexLaunchImplementation;
        address dexLaunchProxy;
        address dexLpLockerImplementation;
        address dexLpLockerProxy;
        address ecosystemRewardsImplementation;
        address ecosystemRewardsProxy;
        address stakingImplementation;
        address stakingProxy;
        address liquidityImplementation;
        address liquidityProxy;
        address bettingImplementation;
        address bettingProxy;
        address settlementImplementation;
        address betModuleImplementation;
        address parlayModuleImplementation;
        address parlayLens;
    }

    function run(
        address admin,
        address pauser,
        address platformTreasury,
        address opsTreasury,
        address referralClaimSigner,
        uint24 referralSwapPoolFee,
        uint256 initialPlatformReserve,
        address usdt,
        address positionManager,
        address referralSwapRouter,
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
            usdt,
            positionManager,
            referralSwapRouter,
            referralSwapExpectedPool
        );

        vm.startBroadcast(deployerPk);

        DeployedSystem memory sys = _deploySystem(cfg);
        _configureSystem(cfg, sys);
        _assertDeploymentGate(cfg, sys);

        if (cfg.admin != cfg.deployer || cfg.pauser != cfg.deployer || cfg.opsTreasury != cfg.deployer) {
            _grantFinalRoles(cfg, sys);
            _revokeBootstrapRoles(cfg, sys);
        }

        vm.stopBroadcast();

        _logDeployment(cfg, sys);
        result = _deploymentResult(cfg, sys);
    }

    function _buildConfig(
        address deployer,
        address admin,
        address pauser,
        address platformTreasury,
        address opsTreasury,
        address referralClaimSigner,
        uint24 referralSwapPoolFee,
        uint256 initialPlatformReserve,
        address usdt,
        address positionManager,
        address referralSwapRouter,
        address referralSwapExpectedPool
    ) internal pure returns (DeployConfig memory cfg) {
        require(referralSwapPoolFee != 0, "POOL_FEE_ZERO");
        cfg.deployer = deployer;
        cfg.admin = admin == address(0) ? deployer : admin;
        cfg.pauser = pauser == address(0) ? cfg.admin : pauser;
        cfg.platformTreasury = platformTreasury == address(0) ? cfg.admin : platformTreasury;
        cfg.opsTreasury = opsTreasury == address(0) ? cfg.admin : opsTreasury;
        cfg.referralClaimSigner = referralClaimSigner == address(0) ? cfg.admin : referralClaimSigner;
        cfg.referralSwapPoolFee = referralSwapPoolFee;
        cfg.initialPlatformReserve = initialPlatformReserve;
        cfg.usdt = usdt == address(0) ? BSC_USDT : usdt;
        cfg.positionManager = positionManager == address(0) ? PANCAKE_V3_POSITION_MANAGER : positionManager;
        cfg.referralSwapRouter = referralSwapRouter == address(0) ? PANCAKE_V3_SWAP_ROUTER : referralSwapRouter;
        cfg.referralSwapExpectedPool = referralSwapExpectedPool;
    }

    function _deploySystem(DeployConfig memory cfg) internal returns (DeployedSystem memory sys) {
        sys.oddImpl = new ODDToken();
        sys.odd = ODDToken(
            address(
                new ERC1967Proxy(address(sys.oddImpl), abi.encodeCall(ODDToken.initialize, (cfg.deployer, cfg.pauser)))
            )
        );

        sys.tierSaleImpl = new TierSale();
        sys.tierSale = TierSale(
            address(
                new ERC1967Proxy(
                    address(sys.tierSaleImpl),
                    abi.encodeCall(TierSale.initialize, (cfg.deployer, address(sys.odd), cfg.usdt))
                )
            )
        );

        sys.houseVaultImpl = new HouseVault();
        sys.houseVault = HouseVault(
            address(
                new ERC1967Proxy(
                    address(sys.houseVaultImpl), abi.encodeCall(HouseVault.initialize, (cfg.deployer, address(sys.odd)))
                )
            )
        );

        sys.lpLockerImpl = new DexLpLocker();
        sys.lpLocker = DexLpLocker(
            address(
                new ERC1967Proxy(
                    address(sys.lpLockerImpl),
                    abi.encodeCall(DexLpLocker.initialize, (cfg.deployer, cfg.positionManager, cfg.opsTreasury))
                )
            )
        );

        sys.dexLaunchImpl = new DexLaunchController();
        sys.dexLaunch = DexLaunchController(
            address(
                new ERC1967Proxy(
                    address(sys.dexLaunchImpl),
                    abi.encodeCall(
                        DexLaunchController.initialize,
                        (
                            cfg.deployer,
                            address(sys.odd),
                            cfg.usdt,
                            address(sys.tierSale),
                            cfg.positionManager,
                            address(sys.lpLocker),
                            cfg.opsTreasury
                        )
                    )
                )
            )
        );

        sys.rewardsImpl = new EcosystemRewards();
        sys.rewards = EcosystemRewards(
            address(
                new ERC1967Proxy(
                    address(sys.rewardsImpl),
                    abi.encodeCall(EcosystemRewards.initialize, (cfg.deployer, address(sys.odd)))
                )
            )
        );

        sys.stakingImpl = new StakingPool();
        sys.staking = StakingPool(
            address(
                new ERC1967Proxy(
                    address(sys.stakingImpl),
                    abi.encodeCall(StakingPool.initialize, (cfg.deployer, address(sys.odd), cfg.platformTreasury))
                )
            )
        );

        sys.liquidityImpl = new LiquidityPool();
        sys.liquidity = LiquidityPool(
            address(
                new ERC1967Proxy(
                    address(sys.liquidityImpl),
                    abi.encodeCall(LiquidityPool.initialize, (cfg.deployer, address(sys.odd), cfg.deployer))
                )
            )
        );

        sys.bettingImpl = new BettingPool();
        sys.settlementImpl = new BettingSettlementModule();
        sys.betModuleImpl = new BettingBetModule();
        sys.parlayModuleImpl = new BettingParlayModule();
        sys.parlayLens = new BettingParlayLens();
        sys.marketModuleImpl = new BettingMarketModule();
        sys.referralModuleImpl = new BettingReferralModule();
        sys.betting = BettingPool(
            address(
                new ERC1967Proxy(
                    address(sys.bettingImpl),
                    abi.encodeCall(
                        BettingPool.initialize,
                        (cfg.deployer, address(sys.odd), address(sys.staking), address(sys.liquidity))
                    )
                )
            )
        );
    }

    function _configureSystem(DeployConfig memory cfg, DeployedSystem memory sys) internal {
        sys.odd.setTreasurySink(cfg.opsTreasury, true);
        sys.odd.setTreasurySink(cfg.platformTreasury, true);
        sys.odd.setDexRestrictedTarget(cfg.positionManager, true);
        sys.odd.setDexRestrictedTarget(cfg.referralSwapRouter, true);
        if (cfg.referralSwapExpectedPool != address(0)) {
            sys.odd.setDexRestrictedTarget(cfg.referralSwapExpectedPool, true);
        }

        sys.odd
            .setFixedSourceContracts(
                IODDTokenBusiness.FixedSources({
                    tierSale: address(sys.tierSale),
                    houseVault: address(sys.houseVault),
                    dexLaunchController: address(sys.dexLaunch),
                    ecosystemRewards: address(sys.rewards),
                    opsTreasury: cfg.opsTreasury
                })
            );
        sys.odd.setWhitelist(address(sys.staking), true);
        sys.odd.setWhitelist(address(sys.liquidity), true);
        sys.odd.setWhitelist(address(sys.betting), true);
        sys.odd.allocateInitialSupply();
        sys.odd.grantRole(Roles.WHITELIST_ADMIN_ROLE, address(sys.dexLaunch));
        sys.odd.grantRole(Roles.DEX_LAUNCHER_ROLE, address(sys.dexLaunch));
        sys.lpLocker.grantRole(Roles.DEX_LAUNCHER_ROLE, address(sys.dexLaunch));

        sys.staking.setBettingPool(address(sys.betting));
        sys.liquidity.setBettingPool(address(sys.betting));
        sys.betting.setSettlementModule(address(sys.settlementImpl));
        sys.betting.setBetModule(address(sys.betModuleImpl));
        sys.betting.setMarketModule(address(sys.marketModuleImpl));
        sys.betting.setReferralModule(address(sys.referralModuleImpl));
        sys.betting.setParlayModule(address(sys.parlayModuleImpl));
        sys.betting.initializeV2(cfg.platformTreasury);
        sys.betting.setReferralClaimConfig(cfg.referralClaimSigner, cfg.referralSwapPoolFee);
        if (cfg.referralSwapExpectedPool != address(0)) {
            sys.betting.setReferralSwapConfig(cfg.referralSwapRouter, cfg.usdt, cfg.referralSwapExpectedPool);
        }

        if (cfg.initialPlatformReserve > 0) {
            require(cfg.opsTreasury == cfg.deployer, "RESERVE_SOURCE_NOT_BROADCASTER");
            sys.odd.approve(address(sys.betting), cfg.initialPlatformReserve);
            sys.betting.addPlatformReserve(cfg.initialPlatformReserve);
        }
    }

    function _assertDeploymentGate(DeployConfig memory cfg, DeployedSystem memory sys) internal view {
        require(sys.odd.fixedSourcesConfigured(), "FIXED_SOURCES_NOT_CONFIGURED");
        require(sys.odd.initialSupplyAllocated(), "INITIAL_SUPPLY_NOT_ALLOCATED");
        require(sys.odd.isTreasurySink(cfg.opsTreasury), "OPS_NOT_TREASURY_SINK");
        require(sys.odd.isTreasurySink(cfg.platformTreasury), "PLATFORM_NOT_TREASURY_SINK");
        require(sys.odd.isWhitelist(address(sys.staking)), "STAKING_NOT_WHITELISTED");
        require(sys.odd.isWhitelist(address(sys.liquidity)), "LIQUIDITY_NOT_WHITELISTED");
        require(sys.odd.isWhitelist(address(sys.betting)), "BETTING_NOT_WHITELISTED");
        require(sys.odd.isDexRestrictedTarget(cfg.positionManager), "POSITION_MANAGER_NOT_DEX_RESTRICTED");
        require(sys.odd.isDexRestrictedTarget(cfg.referralSwapRouter), "ROUTER_NOT_DEX_RESTRICTED");
        require(!sys.odd.isWhitelist(cfg.positionManager), "POSITION_MANAGER_WHITELISTED");
        require(!sys.odd.isWhitelist(cfg.referralSwapRouter), "ROUTER_WHITELISTED");
        if (cfg.referralSwapExpectedPool != address(0)) {
            require(sys.odd.isDexRestrictedTarget(cfg.referralSwapExpectedPool), "REFERRAL_POOL_NOT_DEX_RESTRICTED");
            require(sys.betting.referralSwapExpectedPool() == cfg.referralSwapExpectedPool, "REFERRAL_POOL_MISMATCH");
        }
        require(address(sys.staking.oddToken()) == address(sys.odd), "STAKING_ODD_MISMATCH");
        require(address(sys.liquidity.oddToken()) == address(sys.odd), "LIQUIDITY_ODD_MISMATCH");
        require(address(sys.betting.oddToken()) == address(sys.odd), "BETTING_ODD_MISMATCH");
    }

    function _grantFinalRoles(DeployConfig memory cfg, DeployedSystem memory sys) internal {
        _grantOddRoles(sys.odd, cfg.admin, cfg.pauser);
        _grantCoreRoles(sys.staking, cfg.admin, cfg.pauser);
        _grantCoreRoles(sys.liquidity, cfg.admin, cfg.pauser);
        _grantBettingRoles(sys.betting, cfg.admin, cfg.pauser);
        _grantTierSaleRoles(sys.tierSale, cfg.admin, cfg.pauser);
        _grantHouseVaultRoles(sys.houseVault, cfg.admin, cfg.pauser);
        _grantDexLaunchRoles(sys.dexLaunch, cfg.admin, cfg.pauser);
        _grantDexLockerRoles(sys.lpLocker, cfg.admin, cfg.pauser);
        _grantRewardsRoles(sys.rewards, cfg.admin, cfg.pauser);
        _grantOpsRoles(cfg, sys);
    }

    function _revokeBootstrapRoles(DeployConfig memory cfg, DeployedSystem memory sys) internal {
        _revokeOddRoles(sys.odd, cfg);
        _revokeCoreRoles(sys.staking, cfg);
        _revokeCoreRoles(sys.liquidity, cfg);
        _revokeBettingRoles(sys.betting, cfg);
        _revokeTierSaleRoles(sys.tierSale, cfg);
        _revokeHouseVaultRoles(sys.houseVault, cfg);
        _revokeDexLaunchRoles(sys.dexLaunch, cfg);
        _revokeDexLockerRoles(sys.lpLocker, cfg);
        _revokeRewardsRoles(sys.rewards, cfg);
    }

    function _grantOddRoles(ODDToken odd, address admin, address pauser) internal {
        odd.grantRole(Roles.DEFAULT_ADMIN_ROLE, admin);
        odd.grantRole(Roles.UPGRADER_ROLE, admin);
        odd.grantRole(Roles.WHITELIST_ADMIN_ROLE, admin);
        odd.grantRole(Roles.HOUSEVAULT_MANAGER_ROLE, admin);
        odd.grantRole(Roles.DEX_LAUNCHER_ROLE, admin);
        odd.grantRole(Roles.SALE_ADMIN_ROLE, admin);
        odd.grantRole(Roles.REWARD_DISTRIBUTOR_ROLE, admin);
        odd.grantRole(Roles.PAUSER_ROLE, pauser);
    }

    function _grantCoreRoles(IAccessControl target, address admin, address pauser) internal {
        target.grantRole(Roles.DEFAULT_ADMIN_ROLE, admin);
        target.grantRole(Roles.UPGRADER_ROLE, admin);
        target.grantRole(Roles.PAUSER_ROLE, pauser);
    }

    function _grantBettingRoles(BettingPool betting, address admin, address pauser) internal {
        _grantCoreRoles(betting, admin, pauser);
        betting.grantRole(Roles.SETTLER_ROLE, admin);
        betting.grantRole(Roles.OPERATOR_ROLE, admin);
        betting.grantRole(Roles.KEEPER_ROLE, admin);
    }

    function _grantTierSaleRoles(TierSale tierSale, address admin, address pauser) internal {
        _grantCoreRoles(tierSale, admin, pauser);
        tierSale.grantRole(Roles.SALE_ADMIN_ROLE, admin);
    }

    function _grantHouseVaultRoles(HouseVault houseVault, address admin, address pauser) internal {
        _grantCoreRoles(houseVault, admin, pauser);
        houseVault.grantRole(Roles.HOUSEVAULT_MANAGER_ROLE, admin);
    }

    function _grantDexLaunchRoles(DexLaunchController dexLaunch, address admin, address pauser) internal {
        _grantCoreRoles(dexLaunch, admin, pauser);
        dexLaunch.grantRole(Roles.DEX_LAUNCHER_ROLE, admin);
    }

    function _grantDexLockerRoles(DexLpLocker lpLocker, address admin, address pauser) internal {
        _grantCoreRoles(lpLocker, admin, pauser);
        lpLocker.grantRole(Roles.DEX_LAUNCHER_ROLE, admin);
    }

    function _grantRewardsRoles(EcosystemRewards rewards, address admin, address pauser) internal {
        _grantCoreRoles(rewards, admin, pauser);
        rewards.grantRole(Roles.REWARD_DISTRIBUTOR_ROLE, admin);
    }

    function _grantOpsRoles(DeployConfig memory cfg, DeployedSystem memory sys) internal {
        sys.betting.grantRole(Roles.OPERATOR_ROLE, cfg.opsTreasury);
        sys.betting.grantRole(Roles.SETTLER_ROLE, cfg.opsTreasury);
        sys.betting.grantRole(Roles.KEEPER_ROLE, cfg.opsTreasury);
    }

    function _revokeOddRoles(ODDToken odd, DeployConfig memory cfg) internal {
        _revokeAdminRole(odd, Roles.REWARD_DISTRIBUTOR_ROLE, cfg);
        _revokeAdminRole(odd, Roles.SALE_ADMIN_ROLE, cfg);
        _revokeAdminRole(odd, Roles.DEX_LAUNCHER_ROLE, cfg);
        _revokeAdminRole(odd, Roles.HOUSEVAULT_MANAGER_ROLE, cfg);
        _revokeAdminRole(odd, Roles.WHITELIST_ADMIN_ROLE, cfg);
        _revokeAdminRole(odd, Roles.UPGRADER_ROLE, cfg);
        _revokePauserRole(odd, cfg);
        _revokeAdminRole(odd, Roles.DEFAULT_ADMIN_ROLE, cfg);
    }

    function _revokeCoreRoles(IAccessControl target, DeployConfig memory cfg) internal {
        _revokeAdminRole(target, Roles.UPGRADER_ROLE, cfg);
        _revokePauserRole(target, cfg);
        _revokeAdminRole(target, Roles.DEFAULT_ADMIN_ROLE, cfg);
    }

    function _revokeBettingRoles(BettingPool betting, DeployConfig memory cfg) internal {
        _revokeBettingOperationalRole(betting, Roles.KEEPER_ROLE, cfg);
        _revokeBettingOperationalRole(betting, Roles.OPERATOR_ROLE, cfg);
        _revokeBettingOperationalRole(betting, Roles.SETTLER_ROLE, cfg);
        _revokeCoreRoles(betting, cfg);
    }

    function _revokeTierSaleRoles(TierSale tierSale, DeployConfig memory cfg) internal {
        _revokeAdminRole(tierSale, Roles.SALE_ADMIN_ROLE, cfg);
        _revokeCoreRoles(tierSale, cfg);
    }

    function _revokeHouseVaultRoles(HouseVault houseVault, DeployConfig memory cfg) internal {
        _revokeAdminRole(houseVault, Roles.HOUSEVAULT_MANAGER_ROLE, cfg);
        _revokeCoreRoles(houseVault, cfg);
    }

    function _revokeDexLaunchRoles(DexLaunchController dexLaunch, DeployConfig memory cfg) internal {
        _revokeAdminRole(dexLaunch, Roles.DEX_LAUNCHER_ROLE, cfg);
        _revokeCoreRoles(dexLaunch, cfg);
    }

    function _revokeDexLockerRoles(DexLpLocker lpLocker, DeployConfig memory cfg) internal {
        _revokeAdminRole(lpLocker, Roles.DEX_LAUNCHER_ROLE, cfg);
        _revokeCoreRoles(lpLocker, cfg);
    }

    function _revokeRewardsRoles(EcosystemRewards rewards, DeployConfig memory cfg) internal {
        _revokeAdminRole(rewards, Roles.REWARD_DISTRIBUTOR_ROLE, cfg);
        _revokeCoreRoles(rewards, cfg);
    }

    function _revokeAdminRole(IAccessControl target, bytes32 role, DeployConfig memory cfg) internal {
        if (cfg.deployer != cfg.admin) target.revokeRole(role, cfg.deployer);
    }

    function _revokeBettingOperationalRole(IAccessControl target, bytes32 role, DeployConfig memory cfg) internal {
        if (cfg.deployer != cfg.admin && cfg.deployer != cfg.opsTreasury) target.revokeRole(role, cfg.deployer);
    }

    function _revokePauserRole(IAccessControl target, DeployConfig memory cfg) internal {
        if (cfg.deployer != cfg.pauser) target.revokeRole(Roles.PAUSER_ROLE, cfg.deployer);
    }

    function _logDeployment(DeployConfig memory cfg, DeployedSystem memory sys) internal pure {
        console2.log("deployer", cfg.deployer);
        console2.log("admin", cfg.admin);
        console2.log("pauser", cfg.pauser);
        console2.log("platformTreasury", cfg.platformTreasury);
        console2.log("opsTreasury", cfg.opsTreasury);
        console2.log("oddProxy", address(sys.odd));
        console2.log("tierSaleProxy", address(sys.tierSale));
        console2.log("houseVaultProxy", address(sys.houseVault));
        console2.log("dexLaunchProxy", address(sys.dexLaunch));
        console2.log("dexLpLockerProxy", address(sys.lpLocker));
        console2.log("ecosystemRewardsProxy", address(sys.rewards));
        console2.log("stakingProxy", address(sys.staking));
        console2.log("liquidityProxy", address(sys.liquidity));
        console2.log("bettingProxy", address(sys.betting));
        console2.log("parlayLens", address(sys.parlayLens));
    }

    function _deploymentResult(DeployConfig memory cfg, DeployedSystem memory sys)
        internal
        pure
        returns (DeploymentResult memory result)
    {
        result = DeploymentResult({
            deployer: cfg.deployer,
            admin: cfg.admin,
            pauser: cfg.pauser,
            platformTreasury: cfg.platformTreasury,
            opsTreasury: cfg.opsTreasury,
            oddImplementation: address(sys.oddImpl),
            oddProxy: address(sys.odd),
            tierSaleImplementation: address(sys.tierSaleImpl),
            tierSaleProxy: address(sys.tierSale),
            houseVaultImplementation: address(sys.houseVaultImpl),
            houseVaultProxy: address(sys.houseVault),
            dexLaunchImplementation: address(sys.dexLaunchImpl),
            dexLaunchProxy: address(sys.dexLaunch),
            dexLpLockerImplementation: address(sys.lpLockerImpl),
            dexLpLockerProxy: address(sys.lpLocker),
            ecosystemRewardsImplementation: address(sys.rewardsImpl),
            ecosystemRewardsProxy: address(sys.rewards),
            stakingImplementation: address(sys.stakingImpl),
            stakingProxy: address(sys.staking),
            liquidityImplementation: address(sys.liquidityImpl),
            liquidityProxy: address(sys.liquidity),
            bettingImplementation: address(sys.bettingImpl),
            bettingProxy: address(sys.betting),
            settlementImplementation: address(sys.settlementImpl),
            betModuleImplementation: address(sys.betModuleImpl),
            parlayModuleImplementation: address(sys.parlayModuleImpl),
            parlayLens: address(sys.parlayLens)
        });
    }
}
