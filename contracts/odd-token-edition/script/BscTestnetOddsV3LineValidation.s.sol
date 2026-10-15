// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {ODDToken} from "../src/modules/token/ODDToken.sol";
import {BettingPool} from "../src/modules/betting/BettingPool.sol";
import {QuoteGuardInput} from "../src/shared/types/CommonTypes.sol";
import {BetSettlementState, MarketStatus} from "../src/shared/types/MarketEnums.sol";
import {ParlayBet, ParlayLegInput, ParlayLegResult, ParlayState} from "../src/shared/types/ParlayTypes.sol";

contract BscTestnetOddsV3LineValidation is Script {
    ODDToken internal constant ODD = ODDToken(0x9D3cfd96C447D45FBf3e10bf0D233C51DEb58Ad0);
    BettingPool internal constant BETTING = BettingPool(0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3);

    address internal constant SETTLEMENT_MODULE = 0xC29ebbdd68d7718f0fe1B8E187d84ae8F34bfA39;
    address internal constant BET_MODULE = 0xe911D8472F53f64E8B06eAb31E8Ec6Cc5B4c8825;
    address internal constant MARKET_MODULE = 0xD786A66a77Ff137A09Aa2fa69BbD8f6AE42f79De;
    address internal constant REFERRAL_MODULE = 0x6f481A9E772AFDF85741a5FA82985DCcaC79Bb6B;
    address internal constant PARLAY_MODULE = 0xD7AcFb964C01D4be09757207034FD919dA06fE96;

    uint256 internal constant BET_AMOUNT = 100 ether;
    uint256 internal constant VALIDATION_ODDS = 20_000;

    function checkDeployment() external view {
        _assertDeployment();
        console2.log("VALIDATION_PHASE", "deployment_checked");
    }

    function checkLineMatrix(bytes32 salt) external {
        _assertDeployment();
        address operator = vm.addr(vm.envUint("PRIVATE_KEY"));

        uint64 startTime = uint64(block.timestamp + 30);
        uint64 endTime = uint64(block.timestamp + 300);

        _assertCanOpenAh(operator, salt, 10, startTime, endTime);
        _assertCanOpenAh(operator, salt, 11, startTime, endTime);
        _assertCanOpenAh(operator, salt, 12, startTime, endTime);

        for (uint8 line = 3; line <= 10; ++line) {
            _assertCanOpenOu(operator, salt, line, startTime, endTime);
        }

        _assertOpenReverts(operator, _taggedMatchId("invalid-ah-13", salt), 1, 13, startTime, endTime, 2);
        _assertOpenReverts(operator, _taggedMatchId("invalid-ou-11", salt), 2, 11, startTime, endTime, 2);

        console2.log("VALIDATION_PHASE", "line_matrix_checked");
    }

    function prepare(bytes32 salt) external returns (bytes32 parlayId) {
        _assertDeployment();

        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);
        uint64 startTime = uint64(block.timestamp + 30);
        uint64 endTime = uint64(block.timestamp + 300);
        uint64 updatedAt = uint64(block.timestamp);

        vm.startBroadcast(deployerPk);
        if (ODD.allowance(deployer, address(BETTING)) < 1_000 ether) {
            ODD.approve(address(BETTING), type(uint256).max);
        }

        bytes32 singleAh10 = _openMarket("single-ah10-half-win", salt, 1, 10, 2, startTime, endTime, updatedAt);
        bytes32 singleOu8 = _openMarket("single-ou8-half-loss", salt, 2, 8, 2, startTime, endTime, updatedAt);
        bytes32 singleOu10 = _openMarket("single-ou10-push", salt, 2, 10, 2, startTime, endTime, updatedAt);

        (bytes32 ah10BetId,,) = BETTING.placeBet(singleAh10, 0, BET_AMOUNT, _guard(singleAh10, 0));
        (bytes32 ou8BetId,,) = BETTING.placeBet(singleOu8, 0, BET_AMOUNT, _guard(singleOu8, 0));
        (bytes32 ou10BetId,,) = BETTING.placeBet(singleOu10, 0, BET_AMOUNT, _guard(singleOu10, 0));

        bytes32 parlayAh10 = _openMarket("parlay-ah10-half-win", salt, 1, 10, 2, startTime, endTime, updatedAt);
        bytes32 parlayOu8 = _openMarket("parlay-ou8-half-loss", salt, 2, 8, 2, startTime, endTime, updatedAt);
        bytes32 parlayOu10 = _openMarket("parlay-ou10-push", salt, 2, 10, 2, startTime, endTime, updatedAt);
        bytes32 parlayOneXTwo = _openMarket("parlay-1x2-full-win", salt, 0, 0, 3, startTime, endTime, updatedAt);

        ParlayLegInput[] memory legs = new ParlayLegInput[](4);
        legs[0] = _parlayLeg(parlayAh10, 0);
        legs[1] = _parlayLeg(parlayOu8, 0);
        legs[2] = _parlayLeg(parlayOu10, 0);
        legs[3] = _parlayLeg(parlayOneXTwo, 0);
        parlayId = BETTING.placeParlay(legs, BET_AMOUNT, 0, block.timestamp + 600, address(0));
        vm.stopBroadcast();

        _assertBetState(ah10BetId, BetSettlementState.Pending);
        _assertBetState(ou8BetId, BetSettlementState.Pending);
        _assertBetState(ou10BetId, BetSettlementState.Pending);
        _assertParlayState(parlayId, ParlayState.Pending);

        console2.log("VALIDATION_PHASE", "setup_complete");
        console2.log("VALIDATION_SALT");
        console2.logBytes32(salt);
        console2.log("SETTLE_AFTER", endTime);
        _logMarket("SINGLE_AH10", singleAh10);
        _logMarket("SINGLE_OU8", singleOu8);
        _logMarket("SINGLE_OU10", singleOu10);
        console2.log("SINGLE_AH10_BET");
        console2.logBytes32(ah10BetId);
        console2.log("SINGLE_OU8_BET");
        console2.logBytes32(ou8BetId);
        console2.log("SINGLE_OU10_BET");
        console2.logBytes32(ou10BetId);
        _logMarket("PARLAY_AH10", parlayAh10);
        _logMarket("PARLAY_OU8", parlayOu8);
        _logMarket("PARLAY_OU10", parlayOu10);
        _logMarket("PARLAY_1X2", parlayOneXTwo);
        console2.log("PARLAY_ID");
        console2.logBytes32(parlayId);
    }

    function settle(bytes32 salt, bytes32 parlayId) external {
        _assertDeployment();

        bytes32 singleAh10 = _marketId("single-ah10-half-win", salt, 1, 10);
        bytes32 singleOu8 = _marketId("single-ou8-half-loss", salt, 2, 8);
        bytes32 singleOu10 = _marketId("single-ou10-push", salt, 2, 10);
        uint64 endTime = BETTING.getMarket(singleAh10).matchEndTime;
        require(block.timestamp >= endTime, "MATCH_NOT_READY");

        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPk);
        _settleSingle(singleAh10, 2, 0);
        _settleSingle(singleOu8, 2, 0);
        _settleSingle(singleOu10, 3, 0);
        BETTING.claimPayout(_singleBetId(singleAh10));

        _settleEmpty(_marketId("parlay-ah10-half-win", salt, 1, 10), 2, 0);
        _settleEmpty(_marketId("parlay-ou8-half-loss", salt, 2, 8), 2, 0);
        _settleEmpty(_marketId("parlay-ou10-push", salt, 2, 10), 3, 0);
        _settleEmpty(_marketId("parlay-1x2-full-win", salt, 0, 0), 1, 0);
        BETTING.settleParlay(parlayId);
        BETTING.claimParlayPayout(parlayId);
        vm.stopBroadcast();

        checkAfterSettle(salt, parlayId);
        console2.log("VALIDATION_PHASE", "settle_complete");
    }

    function checkAfterSettle(bytes32 salt, bytes32 parlayId) public view {
        _assertDeployment();

        bytes32 singleAh10 = _marketId("single-ah10-half-win", salt, 1, 10);
        bytes32 singleOu8 = _marketId("single-ou8-half-loss", salt, 2, 8);
        bytes32 singleOu10 = _marketId("single-ou10-push", salt, 2, 10);

        _assertMarketState(singleAh10, MarketStatus.Settled);
        _assertMarketState(singleOu8, MarketStatus.Settled);
        _assertMarketState(singleOu10, MarketStatus.Settled);
        _assertBetState(_singleBetId(singleAh10), BetSettlementState.WonClaimed);
        _assertBetState(_singleBetId(singleOu8), BetSettlementState.Lost);
        _assertBetState(_singleBetId(singleOu10), BetSettlementState.Refunded);
        _assertParlayState(parlayId, ParlayState.WonClaimed);
        _assertParlayLegResult(parlayId, 0, ParlayLegResult.HalfWin);
        _assertParlayLegResult(parlayId, 1, ParlayLegResult.HalfLoss);
        _assertParlayLegResult(parlayId, 2, ParlayLegResult.FullPush);
        _assertParlayLegResult(parlayId, 3, ParlayLegResult.FullWin);
        console2.log("VALIDATION_PHASE", "post_settle_checked");
    }

    function _assertDeployment() internal view {
        require(ODD.initialSupplyAllocated(), "ODD_INITIAL_SUPPLY_NOT_ALLOCATED");
        require(ODD.fixedSourcesConfigured(), "ODD_FIXED_SOURCES_NOT_CONFIGURED");
        require(ODD.isWhitelist(address(BETTING)), "BETTING_NOT_WHITELISTED");
        require(address(BETTING.oddToken()) == address(ODD), "BETTING_ODD_MISMATCH");
        require(BETTING.settlementModule() == SETTLEMENT_MODULE, "SETTLEMENT_MODULE_MISMATCH");
        require(BETTING.betModule() == BET_MODULE, "BET_MODULE_MISMATCH");
        require(BETTING.marketModule() == MARKET_MODULE, "MARKET_MODULE_MISMATCH");
        require(BETTING.referralModule() == REFERRAL_MODULE, "REFERRAL_MODULE_MISMATCH");
        require(BETTING.parlayModule() == PARLAY_MODULE, "PARLAY_MODULE_MISMATCH");
    }

    function _assertCanOpenAh(address operator, bytes32 salt, uint8 line, uint64 startTime, uint64 endTime) internal {
        bytes32 marketId = _openAs(
            operator,
            _taggedMatchId(string.concat("matrix-ah-", vm.toString(line)), salt),
            1,
            line,
            2,
            startTime,
            endTime
        );
        BettingPool.MarketConfig memory market = BETTING.getMarket(marketId);
        require(market.marketType == 1 && market.line == line && market.outcomeCount == 2, "AH_LINE_MATRIX_MISMATCH");
    }

    function _assertCanOpenOu(address operator, bytes32 salt, uint8 line, uint64 startTime, uint64 endTime) internal {
        bytes32 marketId = _openAs(
            operator,
            _taggedMatchId(string.concat("matrix-ou-", vm.toString(line)), salt),
            2,
            line,
            2,
            startTime,
            endTime
        );
        BettingPool.MarketConfig memory market = BETTING.getMarket(marketId);
        require(market.marketType == 2 && market.line == line && market.outcomeCount == 2, "OU_LINE_MATRIX_MISMATCH");
    }

    function _assertOpenReverts(
        address operator,
        bytes32 matchId,
        uint8 marketType,
        uint8 line,
        uint64 startTime,
        uint64 endTime,
        uint256 outcomeCount
    ) internal {
        uint256[] memory odds = _odds(outcomeCount);
        vm.prank(operator);
        try BETTING.openMarket(matchId, marketType, line, startTime, endTime, odds, uint64(block.timestamp)) {
            revert("INVALID_LINE_ACCEPTED");
        } catch {}
    }

    function _openAs(
        address operator,
        bytes32 matchId,
        uint8 marketType,
        uint8 line,
        uint256 outcomeCount,
        uint64 startTime,
        uint64 endTime
    ) internal returns (bytes32 marketId) {
        uint256[] memory odds = _odds(outcomeCount);
        vm.prank(operator);
        marketId = BETTING.openMarket(matchId, marketType, line, startTime, endTime, odds, uint64(block.timestamp));
    }

    function _openMarket(
        string memory tag,
        bytes32 salt,
        uint8 marketType,
        uint8 line,
        uint256 outcomeCount,
        uint64 startTime,
        uint64 endTime,
        uint64 updatedAt
    ) internal returns (bytes32 marketId) {
        marketId = BETTING.openMarket(
            _taggedMatchId(tag, salt), marketType, line, startTime, endTime, _odds(outcomeCount), updatedAt
        );
    }

    function _settleSingle(bytes32 marketId, uint16 homeScore, uint16 awayScore) internal {
        bytes32[] memory betIds = new bytes32[](1);
        betIds[0] = _singleBetId(marketId);
        BETTING.settleMarketBetsByScore(marketId, homeScore, awayScore, betIds);
        BETTING.finalizeMarketSettlement(marketId, 0);
    }

    function _settleEmpty(bytes32 marketId, uint16 homeScore, uint16 awayScore) internal {
        bytes32[] memory empty = new bytes32[](0);
        BETTING.settleMarketBetsByScore(marketId, homeScore, awayScore, empty);
        BETTING.finalizeMarketSettlement(marketId, 0);
    }

    function _guard(bytes32 marketId, uint8 outcome) internal view returns (QuoteGuardInput memory guard) {
        (, uint256 acceptedAmount, uint256 lockedOdds,,) = BETTING.previewSignal(marketId, outcome, BET_AMOUNT);
        (,, uint64 updatedAt, uint256 quoteVersion) = BETTING.getMarketOdds(marketId);
        require(acceptedAmount == BET_AMOUNT, "BET_NOT_FULLY_ACCEPTED");
        guard = QuoteGuardInput({
            quoteVersion: quoteVersion,
            quotedAt: updatedAt,
            minOdds: lockedOdds,
            minAcceptedAmount: acceptedAmount,
            deadline: block.timestamp + 600
        });
    }

    function _parlayLeg(bytes32 marketId, uint8 outcome) internal view returns (ParlayLegInput memory leg) {
        (,, uint64 updatedAt, uint256 quoteVersion) = BETTING.getMarketOdds(marketId);
        (, uint256[] memory quotedOdds,,) = BETTING.getMarketOdds(marketId);
        leg = ParlayLegInput({
            marketId: marketId,
            outcome: outcome,
            quoteVersion: quoteVersion,
            quotedAt: updatedAt,
            minOdds: quotedOdds[outcome]
        });
    }

    function _assertMarketState(bytes32 marketId, MarketStatus expected) internal view {
        require(BETTING.getMarket(marketId).status == expected, "MARKET_STATE_MISMATCH");
    }

    function _assertBetState(bytes32 betId, BetSettlementState expected) internal view {
        require(BETTING.getBet(betId).settlementState == expected, "BET_STATE_MISMATCH");
    }

    function _assertParlayState(bytes32 parlayId, ParlayState expected) internal view {
        ParlayBet memory parlay = _parlay(parlayId);
        require(parlay.state == expected, "PARLAY_STATE_MISMATCH");
    }

    function _assertParlayLegResult(bytes32 parlayId, uint256 index, ParlayLegResult expected) internal view {
        (,,,,,,, ParlayLegResult result) = BETTING.parlayLegs(parlayId, index);
        require(result == expected, "PARLAY_LEG_RESULT_MISMATCH");
    }

    function _parlay(bytes32 parlayId) internal view returns (ParlayBet memory parlay) {
        (
            parlay.owner,
            parlay.stake,
            parlay.lockedComboOdds,
            parlay.maxPayout,
            parlay.claimablePayout,
            parlay.parlayRiskId,
            parlay.acceptedDayBucket,
            parlay.legCount,
            parlay.state,
            parlay.payoutTaxRateBps,
            parlay.taxAllocStakingBps,
            parlay.taxAllocTaxBufferBps,
            parlay.taxAllocReferrerBps,
            parlay.referrerSnapshot
        ) = BETTING.parlays(parlayId);
    }

    function _singleBetId(bytes32 marketId) internal view returns (bytes32 betId) {
        bytes32[] memory betIds = BETTING.getMarketBetIds(marketId, 0, 1);
        require(betIds.length == 1, "SINGLE_BET_NOT_FOUND");
        betId = betIds[0];
    }

    function _odds(uint256 outcomeCount) internal pure returns (uint256[] memory odds) {
        odds = new uint256[](outcomeCount);
        for (uint256 i = 0; i < outcomeCount; ++i) {
            odds[i] = VALIDATION_ODDS;
        }
    }

    function _marketId(string memory tag, bytes32 salt, uint8 marketType, uint8 line) internal pure returns (bytes32) {
        return keccak256(abi.encode(_taggedMatchId(tag, salt), marketType, line));
    }

    function _taggedMatchId(string memory tag, bytes32 salt) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("ODDS_V3_LINE_VALIDATION", tag, salt));
    }

    function _logMarket(string memory label, bytes32 marketId) internal pure {
        console2.log(label);
        console2.logBytes32(marketId);
    }
}
