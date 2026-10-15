// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {ODDToken} from "../src/modules/token/ODDToken.sol";
import {StakingPool} from "../src/modules/staking/StakingPool.sol";
import {LiquidityPool} from "../src/modules/liquidity/LiquidityPool.sol";
import {BettingPool} from "../src/modules/betting/BettingPool.sol";
import {QuoteGuardInput} from "../src/shared/types/CommonTypes.sol";
import {PrecisionConstants} from "../src/shared/constants/PrecisionConstants.sol";

contract BscTestnetSmoke is Script {
    ODDToken internal constant odd = ODDToken(0x9D3cfd96C447D45FBf3e10bf0D233C51DEb58Ad0);
    StakingPool internal constant staking = StakingPool(0x9378fd8E53c3904e972bf633Dbb96aA3EF46E32F);
    LiquidityPool internal constant liquidity = LiquidityPool(0x2de40A5AE2eF4a3fb8168ccd357b37A9fFC04b50);
    BettingPool internal constant betting = BettingPool(0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3);

    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);

        bytes32 matchId = keccak256(abi.encodePacked("bsc-testnet-smoke", block.chainid, block.timestamp));
        uint256[] memory odds_ = new uint256[](2);
        odds_[0] = 20_000;
        odds_[1] = 20_000;

        vm.startBroadcast(deployerPk);

        odd.approve(address(staking), type(uint256).max);
        odd.approve(address(liquidity), type(uint256).max);
        odd.approve(address(betting), type(uint256).max);

        uint256 stakePositionId = staking.stake(1_000 ether, 1);
        uint256 lpPositionId = liquidity.depositGlobal(1_000 ether, 1);

        bytes32 marketId = betting.openMarket(
            matchId,
            1,
            0,
            uint64(block.timestamp + 2 hours),
            uint64(block.timestamp + 4 hours),
            odds_,
            uint64(block.timestamp)
        );

        vm.stopBroadcast();

        (, uint256 acceptedAmount, uint256 lockedOdds,,) = betting.previewSignal(marketId, 0, 100 ether);
        (,, uint64 updatedAt, uint256 quoteVersion) = betting.getMarketOdds(marketId);
        QuoteGuardInput memory guard = QuoteGuardInput({
            quoteVersion: quoteVersion,
            quotedAt: updatedAt,
            minOdds: lockedOdds,
            minAcceptedAmount: acceptedAmount,
            deadline: block.timestamp + 1 hours
        });

        vm.startBroadcast(deployerPk);

        (bytes32 betId,,) = betting.placeBet(marketId, 0, 100 ether, guard);

        vm.stopBroadcast();

        console2.log("deployer", deployer);
        console2.log("matchId");
        console2.logBytes32(matchId);
        console2.log("marketId");
        console2.logBytes32(marketId);
        console2.log("betId");
        console2.logBytes32(betId);
        console2.log("stakePositionId", stakePositionId);
        console2.log("lpPositionId", lpPositionId);
        console2.log("deployerTier", staking.getUserTier(deployer));
        console2.log("activeStake", staking.getActiveStakeAmount(deployer));
        console2.log("platformReserve", betting.platformReserve());
        console2.log("deployerOddBalance", odd.balanceOf(deployer));
        console2.log("bettingOddBalance", odd.balanceOf(address(betting)));
        console2.log("liquidityRequestable", liquidity.getRequestableLiquidity());
        console2.log("expectedPayout", acceptedAmount * lockedOdds / PrecisionConstants.ODDS_RATE_SCALE);
        console2.log("settlementCoveredBy", "script/bsc_testnet_full_flow_report.py");
    }
}
