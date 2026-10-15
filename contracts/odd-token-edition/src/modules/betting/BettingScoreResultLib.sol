// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BettingConstants} from "../../shared/constants/BettingConstants.sol";
import {SettlementCannotClose} from "../../shared/errors/BettingErrors.sol";

library BettingScoreResultLib {
    enum Result {
        FullWin,
        FullLoss,
        FullPush,
        HalfWin,
        HalfLoss
    }

    function resolve(uint8 marketType, uint8 line, uint8 betOutcome, uint16 homeScore, uint16 awayScore)
        internal
        pure
        returns (Result)
    {
        if (homeScore > BettingConstants.MAX_SETTLEMENT_SCORE || awayScore > BettingConstants.MAX_SETTLEMENT_SCORE) {
            revert SettlementCannotClose(bytes32(0));
        }
        if (marketType == 0) {
            uint8 winningOutcome = homeScore > awayScore ? 0 : homeScore == awayScore ? 1 : 2;
            return betOutcome == winningOutcome ? Result.FullWin : Result.FullLoss;
        }
        if (marketType == 2) {
            if (betOutcome > 1) revert SettlementCannotClose(bytes32(0));
            Result overResult = resolveOuOverResult(line, homeScore + awayScore);
            return betOutcome == 0 ? overResult : opposite(overResult);
        }
        if (marketType != 1 || betOutcome > 1) revert SettlementCannotClose(bytes32(0));

        // Safe: scores are capped by MAX_SETTLEMENT_SCORE above.
        // forge-lint: disable-next-line(unsafe-typecast)
        int256 scoreDiff = int256(uint256(homeScore)) - int256(uint256(awayScore));
        Result homeResult = resolveAhHomeResult(line, scoreDiff);
        if (betOutcome == 0) {
            return homeResult;
        }
        return opposite(homeResult);
    }

    function resolveOuOverResult(uint8 line, uint16 totalGoals) internal pure returns (Result) {
        if (line == 0) return totalGoals >= 2 ? Result.FullWin : Result.FullLoss;
        if (line == 1) return totalGoals >= 3 ? Result.FullWin : Result.FullLoss;
        if (line == 2) return totalGoals >= 4 ? Result.FullWin : Result.FullLoss;
        if (line == 3) return totalGoals == 0 ? Result.FullPush : Result.FullWin;
        if (line == 4) return totalGoals >= 1 ? Result.FullWin : Result.FullLoss;
        if (line == 5) {
            if (totalGoals >= 2) return Result.FullWin;
            if (totalGoals == 1) return Result.FullPush;
            return Result.FullLoss;
        }
        if (line == 6) {
            if (totalGoals >= 3) return Result.FullWin;
            if (totalGoals == 2) return Result.HalfWin;
            return Result.FullLoss;
        }
        if (line == 7) {
            if (totalGoals >= 3) return Result.FullWin;
            if (totalGoals == 2) return Result.FullPush;
            return Result.FullLoss;
        }
        if (line == 8) {
            if (totalGoals >= 3) return Result.FullWin;
            if (totalGoals == 2) return Result.HalfLoss;
            return Result.FullLoss;
        }
        if (line == 9) {
            if (totalGoals >= 4) return Result.FullWin;
            if (totalGoals == 3) return Result.HalfWin;
            return Result.FullLoss;
        }
        if (line == 10) {
            if (totalGoals >= 4) return Result.FullWin;
            if (totalGoals == 3) return Result.FullPush;
            return Result.FullLoss;
        }
        revert SettlementCannotClose(bytes32(0));
    }

    function resolveAhHomeResult(uint8 line, int256 scoreDiff) internal pure returns (Result) {
        if (line == 0) return scoreDiff >= 1 ? Result.FullWin : Result.FullLoss;
        if (line == 1) {
            if (scoreDiff >= 2) return Result.FullWin;
            if (scoreDiff == 1) return Result.FullPush;
            return Result.FullLoss;
        }
        if (line == 2) return scoreDiff >= 2 ? Result.FullWin : Result.FullLoss;
        if (line == 3) {
            if (scoreDiff >= 1) return Result.FullWin;
            if (scoreDiff == 0) return Result.HalfLoss;
            return Result.FullLoss;
        }
        if (line == 4) {
            if (scoreDiff >= 2) return Result.FullWin;
            if (scoreDiff == 1) return Result.HalfWin;
            return Result.FullLoss;
        }
        if (line == 5) {
            if (scoreDiff >= 2) return Result.FullWin;
            if (scoreDiff == 1) return Result.HalfLoss;
            return Result.FullLoss;
        }
        if (line == 6) {
            if (scoreDiff >= 1) return Result.FullWin;
            if (scoreDiff == 0) return Result.FullPush;
            return Result.FullLoss;
        }
        if (line == 7) {
            if (scoreDiff >= 1) return Result.FullWin;
            if (scoreDiff == 0) return Result.HalfWin;
            return Result.FullLoss;
        }
        if (line == 8) return scoreDiff >= 0 ? Result.FullWin : Result.FullLoss;
        if (line == 9) {
            if (scoreDiff >= 0) return Result.FullWin;
            if (scoreDiff == -1) return Result.HalfLoss;
            return Result.FullLoss;
        }
        if (line == 10) {
            if (scoreDiff >= 3) return Result.FullWin;
            if (scoreDiff == 2) return Result.HalfWin;
            return Result.FullLoss;
        }
        if (line == 11) {
            if (scoreDiff >= 3) return Result.FullWin;
            if (scoreDiff == 2) return Result.FullPush;
            return Result.FullLoss;
        }
        if (line == 12) {
            if (scoreDiff >= 4) return Result.FullWin;
            if (scoreDiff == 3) return Result.FullPush;
            return Result.FullLoss;
        }
        revert SettlementCannotClose(bytes32(0));
    }

    function opposite(Result result) internal pure returns (Result) {
        if (result == Result.FullWin) return Result.FullLoss;
        if (result == Result.FullLoss) return Result.FullWin;
        if (result == Result.HalfWin) return Result.HalfLoss;
        if (result == Result.HalfLoss) return Result.HalfWin;
        return Result.FullPush;
    }
}
