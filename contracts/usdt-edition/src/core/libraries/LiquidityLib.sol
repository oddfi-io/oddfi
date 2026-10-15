// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../shared/errors/Errors.sol";

library LiquidityLib {
    /// @notice Calculate LP shares to mint when adding liquidity.
    /// @param amount Amount of USDT being added.
    /// @param totalLpShares Current total LP shares.
    /// @param bettingPool Current betting pool size.
    /// @return shares LP shares to mint.
    function calcShares(
        uint256 amount,
        uint256 totalLpShares,
        uint256 bettingPool
    ) internal pure returns (uint256 shares) {
        if (totalLpShares == 0) {
            shares = amount;
        } else {
            shares = (amount * totalLpShares) / bettingPool;
        }
        if (shares == 0) revert SharesIsZero();
    }

    /// @notice Calculate USDT amount to return when removing liquidity.
    /// @param shares Shares being redeemed.
    /// @param totalLpShares Current total LP shares.
    /// @param bettingPool Current betting pool size.
    /// @return amount USDT to return.
    function calcAmount(
        uint256 shares,
        uint256 totalLpShares,
        uint256 bettingPool
    ) internal pure returns (uint256 amount) {
        amount = (shares * bettingPool) / totalLpShares;
    }
}
