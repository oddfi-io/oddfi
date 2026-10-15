"use client";

import { useEffect } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { maxUint256 } from "viem";
import { ERC20_ABI, PANCAKE_ROUTER_V2, DEX_ROUTER } from "@/lib/swap/constants";
import type { TokenMeta } from "@/lib/token-registry";

export interface UseTokenApprovalResult {
  needsApproval: boolean;
  isApproving: boolean;
  /** True once the approval tx has been mined */
  isApproveConfirmed: boolean;
  approveTxHash: `0x${string}` | undefined;
  approve: (callbacks?: { onError?: (err: Error) => void }) => void;
  /** Re-read allowance from chain — call after a swap consumes allowance */
  refetchAllowance: () => void;
}

/**
 * Manages ERC-20 allowance for the PancakeSwap V2 Router.
 * Skips approval check for native BNB (no allowance needed).
 */
export function useTokenApproval(
  owner: `0x${string}` | undefined,
  token: TokenMeta | undefined,
  amountIn: bigint
): UseTokenApprovalResult {
  const isNative = token?.isNative ?? false;
  const tokenAddress = isNative ? undefined : (token?.address as `0x${string}` | undefined);
  const routerAddress =
    token?.chainId != null ? (DEX_ROUTER[token.chainId] ?? PANCAKE_ROUTER_V2) : PANCAKE_ROUTER_V2;

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    abi: ERC20_ABI,
    address: tokenAddress,
    functionName: "allowance",
    args: owner && tokenAddress ? [owner, routerAddress] : undefined,
    query: { enabled: !!owner && !!tokenAddress && !isNative },
  });

  const { writeContract, data: approveTxHash, isPending: isWritePending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isApproveConfirmed } = useWaitForTransactionReceipt({
    hash: approveTxHash,
  });

  // Refetch allowance after approval tx confirms
  useEffect(() => {
    if (isApproveConfirmed) refetchAllowance();
  }, [isApproveConfirmed, refetchAllowance]);

  const needsApproval =
    !isNative && !!owner && !!tokenAddress && amountIn > 0n && (allowance ?? 0n) < amountIn;

  const approve = (callbacks?: { onError?: (err: Error) => void }) => {
    if (!tokenAddress || isNative) return;
    writeContract(
      {
        abi: ERC20_ABI,
        address: tokenAddress,
        functionName: "approve",
        args: [routerAddress, maxUint256],
      },
      {
        onError(err) {
          callbacks?.onError?.(err);
        },
      }
    );
  };

  return {
    needsApproval,
    isApproving: isWritePending || isConfirming,
    isApproveConfirmed,
    approveTxHash,
    approve,
    refetchAllowance,
  };
}
