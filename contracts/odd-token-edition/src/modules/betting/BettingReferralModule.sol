// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {InvalidAddress} from "../../shared/errors/CommonErrors.sol";
import {
    InvalidReferralClaim,
    InvalidReferrerBinding,
    SettlementCannotClose
} from "../../shared/errors/BettingErrors.sol";
import {IODDTokenBusiness} from "../token/interfaces/IODDTokenBusiness.sol";
import {TokenBusinessTypes} from "../token/TokenBusinessTypes.sol";
import {BettingReferralLib} from "./BettingReferralLib.sol";
import {BettingPoolStorage} from "./BettingPoolStorage.sol";

contract BettingReferralModule is BettingPoolStorage {
    using SafeERC20 for IERC20;

    address private immutable SELF = address(this);

    modifier onlyDelegateCall() {
        _onlyDelegateCall();
        _;
    }

    function _onlyDelegateCall() internal view {
        if (address(this) == SELF) revert SettlementCannotClose(bytes32(0));
    }

    function bindReferrer(address referrer) external onlyDelegateCall {
        _bindReferrer(msg.sender, referrer);
    }

    function claimReferralRewards(uint256 oddAmount) external onlyDelegateCall returns (uint256 claimedAmount) {
        uint256 availableAmount = referrerRewardsOdd[msg.sender];
        if (availableAmount == 0) revert InvalidReferralClaim();
        if (oddAmount == 0 || oddAmount > availableAmount) revert InvalidReferralClaim();

        referrerRewardsOdd[msg.sender] = availableAmount - oddAmount;
        accountedBalance -= oddAmount;
        uint256 claimNonce = referralClaimNonces[msg.sender]++;
        IODDTokenBusiness(address(oddToken))
            .registerBusinessProfitAndTransfer(
                msg.sender,
                TokenBusinessTypes.REFERRAL_REWARD,
                _referralRawId("ODD_REFERRAL", msg.sender, claimNonce),
                oddAmount
            );
        claimedAmount = oddAmount;
        emit ReferralClaimed(msg.sender, claimedAmount);
    }

    function claimUSDTReferralRewards(
        uint256 rewardMinUsdtOutAmount,
        uint256 signatureDeadline,
        bytes calldata signature,
        uint256 minUsdtOut
    ) external onlyDelegateCall returns (uint256 amountOut) {
        address swapRouter = referralSwapRouter;
        address usdtAddress = referralUsdtToken;
        address expectedPool = referralSwapExpectedPool;
        uint256 claimNonce = referralClaimNonces[msg.sender];
        uint256 oddAmount = _validateAndConsumeReferralUsdtClaim(rewardMinUsdtOutAmount, signatureDeadline, signature);
        uint256 usdtBefore = IERC20(usdtAddress).balanceOf(msg.sender);
        if (expectedPool == address(0)) revert InvalidReferralClaim();
        IODDTokenBusiness(address(oddToken))
            .registerBusinessProfitForDexSwap(
                msg.sender,
                TokenBusinessTypes.REFERRAL_REWARD,
                _referralRawId("USDT_REFERRAL", msg.sender, claimNonce),
                oddAmount,
                swapRouter,
                expectedPool
            );
        _executeReferralUsdtSwap(swapRouter, usdtAddress, oddAmount, minUsdtOut);
        amountOut = IERC20(usdtAddress).balanceOf(msg.sender) - usdtBefore;
        if (amountOut < minUsdtOut || amountOut < rewardMinUsdtOutAmount) revert InvalidReferralClaim();
        emit ReferralClaimedUSDT(
            msg.sender,
            oddAmount,
            amountOut,
            BettingReferralLib.claimExecutionPriceX18(usdtAddress, oddAmount, amountOut)
        );
    }

    function _bindReferrer(address user, address referrer) internal {
        if (referrers[user] != address(0)) revert InvalidReferrerBinding();
        if (referrer == user) revert InvalidReferrerBinding();
        if (referrer == address(0)) revert InvalidReferrerBinding();
        referrers[user] = referrer;
        emit ReferrerBound(user, referrer);
    }

    function _validateAndConsumeReferralUsdtClaim(
        uint256 rewardMinUsdtOutAmount,
        uint256 signatureDeadline,
        bytes calldata signature
    ) internal returns (uint256 oddAmount) {
        if (referralSwapRouter == address(0) || referralUsdtToken == address(0)) {
            revert InvalidAddress();
        }
        if (referralClaimSigner == address(0)) revert InvalidReferralClaim();
        if (referralSwapPoolFee == 0) revert InvalidReferralClaim();
        oddAmount = referrerRewardsOdd[msg.sender];
        if (oddAmount == 0) revert InvalidReferralClaim();

        BettingReferralLib.validateClaimSignature(
            address(this),
            msg.sender,
            oddAmount,
            rewardMinUsdtOutAmount,
            signatureDeadline,
            referralClaimNonces[msg.sender],
            referralClaimSigner,
            signature
        );

        referralClaimNonces[msg.sender] += 1;
        referrerRewardsOdd[msg.sender] = 0;
        accountedBalance -= oddAmount;
    }

    function _executeReferralUsdtSwap(address swapRouter, address usdtAddress, uint256 oddAmount, uint256 minUsdtOut)
        internal
        returns (uint256 amountOut)
    {
        amountOut = BettingReferralLib.executeUsdtSwap(
            address(oddToken), swapRouter, usdtAddress, referralSwapPoolFee, msg.sender, oddAmount, minUsdtOut
        );
    }

    function _referralRawId(string memory kind, address user, uint256 nonce) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(kind, user, nonce));
    }
}
