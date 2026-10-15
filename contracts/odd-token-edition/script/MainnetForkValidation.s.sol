// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {ODDToken} from "../src/modules/token/ODDToken.sol";
import {StakingPool} from "../src/modules/staking/StakingPool.sol";
import {LiquidityPool} from "../src/modules/liquidity/LiquidityPool.sol";
import {BettingPool} from "../src/modules/betting/BettingPool.sol";
import {BettingBetModule} from "../src/modules/betting/BettingBetModule.sol";
import {BettingMarketModule} from "../src/modules/betting/BettingMarketModule.sol";
import {BettingReferralModule} from "../src/modules/betting/BettingReferralModule.sol";
import {BettingParlayModule} from "../src/modules/betting/BettingParlayModule.sol";
import {BettingSettlementModule} from "../src/modules/betting/BettingSettlementModule.sol";
import {IODDTokenBusiness} from "../src/modules/token/interfaces/IODDTokenBusiness.sol";
import {QuoteGuardInput} from "../src/shared/types/CommonTypes.sol";

contract ForkValidationSource {
    function sweep(IERC20 token, address to, uint256 amount) external {
        require(token.transfer(to, amount), "SWEEP_TRANSFER_FAILED");
    }
}

contract MainnetForkValidationScript is Script {
    uint256 internal constant ADMIN_PK = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    uint256 internal constant USER_PK = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
    uint256 internal constant REFERRER_PK = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;
    uint256 internal constant LP_PK = 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6;
    uint256 internal constant OTHER_PK = 0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a;

    bytes32 internal constant MATCH_ID = keccak256("bnb-mainnet-fork-match-1");

    function run() external {
        address admin = vm.addr(ADMIN_PK);
        address user = vm.addr(USER_PK);
        address referrer = vm.addr(REFERRER_PK);
        address lp = vm.addr(LP_PK);
        address other = vm.addr(OTHER_PK);

        vm.deal(admin, 100 ether);
        vm.deal(user, 20 ether);
        vm.deal(referrer, 20 ether);
        vm.deal(lp, 20 ether);
        vm.deal(other, 20 ether);

        vm.startPrank(vm.addr(ADMIN_PK));
        ODDToken odd = ODDToken(_proxy(address(new ODDToken()), abi.encodeCall(ODDToken.initialize, (admin, admin))));
        StakingPool staking = StakingPool(
            _proxy(address(new StakingPool()), abi.encodeCall(StakingPool.initialize, (admin, address(odd), admin)))
        );
        LiquidityPool liquidity = LiquidityPool(
            _proxy(address(new LiquidityPool()), abi.encodeCall(LiquidityPool.initialize, (admin, address(odd), admin)))
        );
        BettingSettlementModule settlement = new BettingSettlementModule();
        BettingBetModule betModule = new BettingBetModule();
        BettingParlayModule parlayModule = new BettingParlayModule();
        BettingPool betting = BettingPool(
            _proxy(
                address(new BettingPool()),
                abi.encodeCall(BettingPool.initialize, (admin, address(odd), address(staking), address(liquidity)))
            )
        );
        BettingMarketModule marketModule = new BettingMarketModule();
        BettingReferralModule referralModule = new BettingReferralModule();
        betting.setSettlementModule(address(settlement));
        betting.setBetModule(address(betModule));
        betting.setMarketModule(address(marketModule));
        betting.setReferralModule(address(referralModule));
        betting.setParlayModule(address(parlayModule));
        staking.initializeV2(address(betting));
        liquidity.setBettingPool(address(betting));
        _bootstrapToken(odd, staking, liquidity, betting, admin);
        betting.initializeV2(admin);
        odd.approve(address(betting), type(uint256).max);
        vm.stopPrank();

        console2.log("DEPLOYED");
        console2.logAddress(address(odd));
        console2.logAddress(address(staking));
        console2.logAddress(address(liquidity));
        console2.logAddress(address(betting));
        console2.log("ACCOUNTS");
        console2.logAddress(admin);
        console2.logAddress(user);
        console2.logAddress(referrer);
        console2.logAddress(lp);
        console2.logAddress(other);

        vm.startPrank(vm.addr(ADMIN_PK));
        require(odd.transfer(referrer, 5_000 ether), "REFERRER_TRANSFER_FAILED");
        require(odd.transfer(user, 20_000 ether), "USER_TRANSFER_FAILED");
        require(odd.transfer(lp, 20_000 ether), "LP_TRANSFER_FAILED");
        require(odd.transfer(other, 100 ether), "OTHER_TRANSFER_FAILED");
        vm.stopPrank();

        console2.log("BALANCE_INIT_ADMIN");
        console2.logUint(odd.balanceOf(admin));
        console2.log("BALANCE_INIT_REFERRER");
        console2.logUint(odd.balanceOf(referrer));
        console2.log("BALANCE_INIT_USER");
        console2.logUint(odd.balanceOf(user));
        console2.log("BALANCE_INIT_LP");
        console2.logUint(odd.balanceOf(lp));
        vm.startPrank(vm.addr(REFERRER_PK));
        odd.approve(address(staking), type(uint256).max);
        staking.stake(1_000 ether, 1);
        vm.stopPrank();
        console2.log("AFTER_REFERRER_STAKE_BALANCE");
        console2.logUint(odd.balanceOf(referrer));
        console2.log("AFTER_REFERRER_STAKE_ACTIVE");
        console2.logUint(staking.getActiveStakeAmount(referrer));

        vm.startPrank(vm.addr(LP_PK));
        odd.approve(address(liquidity), type(uint256).max);
        liquidity.depositGlobal(1_000 ether, 1);
        vm.stopPrank();

        vm.startPrank(vm.addr(ADMIN_PK));
        betting.addPlatformReserve(10_000 ether);
        uint256[] memory baseOdds = new uint256[](3);
        baseOdds[0] = 20_000;
        baseOdds[1] = 30_000;
        baseOdds[2] = 40_000;
        bytes32 marketId = betting.openMarket(
            MATCH_ID,
            0,
            0,
            uint64(block.timestamp + 2 hours),
            uint64(block.timestamp + 4 hours),
            baseOdds,
            uint64(block.timestamp)
        );
        vm.stopPrank();

        (, uint256 acceptedAmount, uint256 lockedOdds,,) = betting.previewSignal(marketId, 0, 200 ether);
        (,, uint64 updatedAt, uint256 quoteVersion) = betting.getMarketOdds(marketId);
        QuoteGuardInput memory guard = QuoteGuardInput({
            quoteVersion: quoteVersion,
            quotedAt: updatedAt,
            minOdds: lockedOdds,
            minAcceptedAmount: acceptedAmount,
            deadline: block.timestamp + 1 hours
        });

        vm.startPrank(vm.addr(USER_PK));
        odd.approve(address(betting), type(uint256).max);
        (bytes32 betId,,) = betting.placeBet(marketId, 0, 200 ether, guard, referrer);
        vm.stopPrank();
        console2.log("AFTER_BET_USER");
        console2.logUint(odd.balanceOf(user));
        console2.log("AFTER_BET_POOL");
        console2.logUint(odd.balanceOf(address(betting)));

        vm.warp(block.timestamp + 4 hours + 1);
        vm.startPrank(vm.addr(ADMIN_PK));
        _settleByScore(betting, marketId, 1, 0);
        vm.stopPrank();

        vm.startPrank(vm.addr(USER_PK));
        betting.claimPayout(betId);
        vm.stopPrank();

        vm.startPrank(vm.addr(REFERRER_PK));
        betting.claimReferralRewards(2 ether);
        vm.stopPrank();

        console2.log("AFTER_FINALIZE_CLAIM_USER");
        console2.logUint(odd.balanceOf(user));
        console2.log("AFTER_FINALIZE_CLAIM_POOL");
        console2.logUint(odd.balanceOf(address(betting)));
        console2.log("AFTER_REFERRER_CLAIM");
        console2.logUint(odd.balanceOf(referrer));

        console2.log("RESERVE_LEDGER_PLATFORM");
        console2.logUint(betting.platformReserve());
        console2.log("MATCH_TERMINAL");
        console2.logUint(betting.isMatchTerminal(MATCH_ID) ? 1 : 0);
    }

    function _proxy(address implementation, bytes memory initData) internal returns (address) {
        return address(new ERC1967Proxy(implementation, initData));
    }

    function _bootstrapToken(
        ODDToken odd,
        StakingPool staking,
        LiquidityPool liquidity,
        BettingPool betting,
        address admin
    ) internal {
        ForkValidationSource tierSale = new ForkValidationSource();
        ForkValidationSource houseVault = new ForkValidationSource();
        ForkValidationSource dexLaunchController = new ForkValidationSource();
        ForkValidationSource ecosystemRewards = new ForkValidationSource();

        odd.setTreasurySink(admin, true);
        odd.setFixedSourceContracts(
            IODDTokenBusiness.FixedSources({
                tierSale: address(tierSale),
                houseVault: address(houseVault),
                dexLaunchController: address(dexLaunchController),
                ecosystemRewards: address(ecosystemRewards),
                opsTreasury: admin
            })
        );
        odd.setWhitelist(address(staking), true);
        odd.setWhitelist(address(liquidity), true);
        odd.setWhitelist(address(betting), true);
        odd.allocateInitialSupply();

        _sweepSource(tierSale, odd, admin);
        _sweepSource(houseVault, odd, admin);
        _sweepSource(dexLaunchController, odd, admin);
        _sweepSource(ecosystemRewards, odd, admin);
    }

    function _sweepSource(ForkValidationSource source, ODDToken odd, address to) internal {
        uint256 balance = odd.balanceOf(address(source));
        if (balance > 0) {
            source.sweep(IERC20(address(odd)), to, balance);
        }
    }

    function _settleByScore(BettingPool pool, bytes32 marketId, uint16 homeScore, uint16 awayScore) internal {
        bytes32[] memory betIds = pool.getMarketBetIds(marketId, 0, 50);
        if (betIds.length > 0) {
            pool.settleMarketBetsByScore(marketId, homeScore, awayScore, betIds);
        }
        pool.finalizeMarketSettlement(marketId, 0);
    }
}
