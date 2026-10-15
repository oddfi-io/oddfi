// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../shared/types/BetTypes.sol";

library SignalLib {
    /// @notice Check if a market is accepting bets for the given outcome.
    /// Only Red light AND outcome == heavySide returns false.
    function isAccepting(
        MarketSignal storage signal,
        uint8 outcome
    ) internal view returns (bool) {
        if (signal.color == SignalColor.Red && outcome == signal.heavySide) {
            return false;
        }
        return true;
    }
}
