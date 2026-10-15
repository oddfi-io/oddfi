"use client";

import { useBalance } from "wagmi";
import { formatUnits } from "viem";
import type { TokenMeta } from "@/lib/token-registry";

export interface UseTokenBalanceResult {
  balance: bigint;
  formatted: string;
  decimals: number;
  isLoading: boolean;
  refetch: () => void;
}

/**
 * Returns the on-chain balance for a given token.
 * Handles both native BNB and ERC-20 tokens transparently.
 */
export function useTokenBalance(
  address: `0x${string}` | undefined,
  token: TokenMeta | undefined
): UseTokenBalanceResult {
  const isNative = token?.isNative ?? false;

  const { data, isLoading, isError, refetch } = useBalance({
    address,
    // wagmi useBalance: omit `token` for native BNB, pass address for ERC-20
    token: isNative ? undefined : (token?.address as `0x${string}` | undefined),
    // 显式按 token 的链读取余额，避免默认走钱包活跃链导致多链资产读 0
    chainId: token?.chainId,
    query: { enabled: !!address && !!token, retry: 1 },
  });

  return {
    balance: data?.value ?? 0n,
    formatted: data ? formatUnits(data.value, data.decimals) : "0",
    decimals: data?.decimals ?? token?.decimals ?? 18,
    // Treat error as "done loading with 0 balance" — prevents infinite "..." for
    // tokens whose contract doesn't exist or when RPC times out.
    isLoading: isLoading && !isError,
    refetch,
  };
}
