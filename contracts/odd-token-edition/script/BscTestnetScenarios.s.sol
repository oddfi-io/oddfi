// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {ODDToken} from "../src/modules/token/ODDToken.sol";
import {StakingPool} from "../src/modules/staking/StakingPool.sol";
import {LiquidityPool} from "../src/modules/liquidity/LiquidityPool.sol";
import {BettingPool} from "../src/modules/betting/BettingPool.sol";
import {QuoteGuardInput} from "../src/shared/types/CommonTypes.sol";

contract BscTestnetScenarios is Script {
    ODDToken internal constant odd = ODDToken(0x9D3cfd96C447D45FBf3e10bf0D233C51DEb58Ad0);
    StakingPool internal constant staking = StakingPool(0x9378fd8E53c3904e972bf633Dbb96aA3EF46E32F);
    LiquidityPool internal constant liquidity = LiquidityPool(0x2de40A5AE2eF4a3fb8168ccd357b37A9fFC04b50);
    BettingPool internal constant betting = BettingPool(0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3);

    struct Actor {
        uint256 pk;
        address addr;
    }

    function run() external {
        Actor memory admin = _actor("PRIVATE_KEY");
        Actor memory referrer = _actor("REFERRER_PK");
        Actor memory user = _actor("USER_A_PK");
        Actor memory lpUser = _actor("LP_PK");

        _seedActors(admin, referrer, user, lpUser);
        _runV2Scenario(admin, referrer, user, lpUser);
    }

    function _seedActors(Actor memory admin, Actor memory referrer, Actor memory user, Actor memory lpUser) internal {
        vm.startBroadcast(admin.pk);
        _fundNative(referrer.addr, 0.02 ether);
        _fundNative(user.addr, 0.02 ether);
        _fundNative(lpUser.addr, 0.02 ether);
        odd.transfer(referrer.addr, 2_000 ether);
        odd.transfer(user.addr, 5_000 ether);
        odd.transfer(lpUser.addr, 5_000 ether);
        vm.stopBroadcast();

        _approve(referrer, address(staking));
        _approve(user, address(betting));
        _approve(lpUser, address(liquidity));
    }

    function _runV2Scenario(Actor memory admin, Actor memory referrer, Actor memory user, Actor memory lpUser)
        internal
    {
        vm.startBroadcast(referrer.pk);
        staking.stake(500 ether, 1);
        vm.stopBroadcast();

        vm.startBroadcast(lpUser.pk);
        uint256 lpPositionId = liquidity.depositGlobal(1_000 ether, 1);
        vm.stopBroadcast();

        bytes32 marketId = _openScenarioMarket(admin);
        QuoteGuardInput memory guard = _scenarioGuard(marketId);
        bytes32 betId = _placeScenarioBet(user, referrer.addr, marketId, guard);

        console2.log("LP_POSITION_ID", lpPositionId);
        console2.log("MARKET_ID");
        console2.logBytes32(marketId);
        console2.log("BET_ID");
        console2.logBytes32(betId);
        console2.log("REFERRAL_REWARD_ODD", betting.referrerRewardsOdd(referrer.addr));
    }

    function _openScenarioMarket(Actor memory admin) internal returns (bytes32 marketId) {
        uint256[] memory odds_ = new uint256[](2);
        odds_[0] = 20_000;
        odds_[1] = 20_000;
        bytes32 matchId = keccak256(abi.encodePacked("bsc-testnet-v2-match", block.timestamp));

        vm.startBroadcast(admin.pk);
        odd.approve(address(betting), type(uint256).max);
        betting.addPlatformReserve(5_000 ether);
        marketId = betting.openMarket(
            matchId,
            1,
            0,
            uint64(block.timestamp + 2 hours),
            uint64(block.timestamp + 4 hours),
            odds_,
            uint64(block.timestamp)
        );
        vm.stopBroadcast();
    }

    function _scenarioGuard(bytes32 marketId) internal view returns (QuoteGuardInput memory guard) {
        (, uint256 acceptedAmount, uint256 lockedOdds,,) = betting.previewSignal(marketId, 0, 100 ether);
        (,, uint64 updatedAt, uint256 quoteVersion) = betting.getMarketOdds(marketId);
        guard = QuoteGuardInput({
            quoteVersion: quoteVersion,
            quotedAt: updatedAt,
            minOdds: lockedOdds,
            minAcceptedAmount: acceptedAmount,
            deadline: block.timestamp + 1 hours
        });
    }

    function _placeScenarioBet(Actor memory user, address referrer, bytes32 marketId, QuoteGuardInput memory guard)
        internal
        returns (bytes32 betId)
    {
        vm.startBroadcast(user.pk);
        (betId,,) = betting.placeBet(marketId, 0, 100 ether, guard, referrer);
        vm.stopBroadcast();
    }

    function _approve(Actor memory actor, address spender) internal {
        vm.startBroadcast(actor.pk);
        odd.approve(spender, type(uint256).max);
        vm.stopBroadcast();
    }

    function _actor(string memory envKey) internal view returns (Actor memory actor) {
        actor.pk = vm.envUint(envKey);
        actor.addr = vm.addr(actor.pk);
    }

    function _fundNative(address to, uint256 amount) internal {
        (bool ok,) = payable(to).call{value: amount}("");
        require(ok, "FUND_NATIVE_FAILED");
    }
}
