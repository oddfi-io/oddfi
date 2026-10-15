// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IBettingReferralModule {
    function bindReferrer(address referrer) external;

    function claimReferralRewards(uint256 oddAmount) external returns (uint256 claimedAmount);

    function claimUSDTReferralRewards(
        uint256 rewardMinUsdtOutAmount,
        uint256 signatureDeadline,
        bytes calldata signature,
        uint256 minUsdtOut
    ) external returns (uint256 amountOut);
}
