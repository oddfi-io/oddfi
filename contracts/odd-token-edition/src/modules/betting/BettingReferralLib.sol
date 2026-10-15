// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {InvalidReferralClaimSignature, ReferralClaimSignatureExpired} from "../../shared/errors/BettingErrors.sol";
import {IPancakeV3SwapRouterLike} from "./interfaces/IPancakeV3SwapRouterLike.sol";

library BettingReferralLib {
    using SafeERC20 for IERC20;
    using MessageHashUtils for bytes32;

    function validateClaimSignature(
        address pool,
        address claimant,
        uint256 oddAmount,
        uint256 rewardMinUsdtOutAmount,
        uint256 signatureDeadline,
        uint256 nonce,
        address signer,
        bytes calldata signature
    ) public view {
        if (block.timestamp > signatureDeadline) {
            revert ReferralClaimSignatureExpired(signatureDeadline, block.timestamp);
        }

        bytes32 digest = keccak256(
                abi.encode(pool, block.chainid, claimant, oddAmount, rewardMinUsdtOutAmount, signatureDeadline, nonce)
            ).toEthSignedMessageHash();
        if (ECDSA.recover(digest, signature) != signer) {
            revert InvalidReferralClaimSignature();
        }
    }

    function executeUsdtSwap(
        address oddToken,
        address swapRouter,
        address usdtAddress,
        uint24 poolFee,
        address recipient,
        uint256 oddAmount,
        uint256 minUsdtOut
    ) public returns (uint256 amountOut) {
        IERC20 token = IERC20(oddToken);
        token.forceApprove(swapRouter, 0);
        token.forceApprove(swapRouter, oddAmount);
        amountOut = IPancakeV3SwapRouterLike(swapRouter)
            .exactInputSingle(
                IPancakeV3SwapRouterLike.ExactInputSingleParams({
                    tokenIn: oddToken,
                    tokenOut: usdtAddress,
                    fee: poolFee,
                    recipient: recipient,
                    deadline: block.timestamp,
                    amountIn: oddAmount,
                    amountOutMinimum: minUsdtOut,
                    sqrtPriceLimitX96: 0
                })
            );
        token.forceApprove(swapRouter, 0);
    }

    function claimExecutionPriceX18(address usdtAddress, uint256 oddAmount, uint256 usdtAmount)
        public
        view
        returns (uint256)
    {
        uint8 usdtDecimals = IERC20Metadata(usdtAddress).decimals();
        return oddAmount == 0 || usdtAmount == 0
            ? 0
            : usdtDecimals <= 36
                ? Math.mulDiv(usdtAmount, 10 ** (36 - usdtDecimals), oddAmount)
                : Math.mulDiv(usdtAmount, 1e18, oddAmount * (10 ** (usdtDecimals - 18)));
    }
}
