"use client";

import { useMemo } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { erc20Abi, multicall3Abi, formatUnits } from "viem";
import { BALANCE_READ_CHAINS } from "@/lib/chains";
import { getTokensForChain } from "@/lib/token-registry";
import type { TokenMeta } from "@/lib/token-registry";
import { IS_TESTNET } from "@/lib/network-mode";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as const;

/** Multicall3 contract — same address on all EVM chains */
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11" as const;

export interface ChainTokenBalance {
  meta: TokenMeta;
  chainId: number;
  /** Human-readable balance string (for decimal.ts) */
  balance: string;
  rawBalance: bigint;
}

/**
 * Read token balances across all BALANCE_READ_CHAINS for the connected wallet.
 *
 * Strategy:
 * - Native tokens: Multicall3.getEthBalance(address) per chain
 * - ERC-20 tokens: token.balanceOf(address) per chain
 * - All queries go through a single useReadContracts (wagmi multicall with per-contract chainId)
 */
export function useMultiChainBalances(): {
  balances: ChainTokenBalance[];
  isLoading: boolean;
} {
  const { address, isConnected } = useAccount();
  const enabled = !!address && isConnected;

  // Build a flat list of all contracts to query, tracking the token meta for each
  const { contracts, tokenMetas } = useMemo(() => {
    const contractList: {
      address: `0x${string}`;
      abi: typeof multicall3Abi | typeof erc20Abi;
      functionName: string;
      args: readonly [`0x${string}`];
      chainId: number;
    }[] = [];
    const metas: TokenMeta[] = [];

    for (const chain of BALANCE_READ_CHAINS) {
      let tokens = getTokensForChain(chain.id);
      if (IS_TESTNET) {
        tokens = tokens.filter((t) => !t.isNative && t.address !== ZERO_ADDR);
      }
      for (const token of tokens) {
        if (token.isNative) {
          // Native balance via Multicall3.getEthBalance
          contractList.push({
            address: MULTICALL3,
            abi: multicall3Abi,
            functionName: "getEthBalance",
            args: [address!],
            chainId: chain.id,
          });
        } else {
          // ERC-20 balance via balanceOf
          contractList.push({
            address: token.address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address!],
            chainId: chain.id,
          });
        }
        metas.push(token);
      }
    }

    return { contracts: contractList, tokenMetas: metas };
  }, [address]);

  const { data, isLoading } = useReadContracts({
    contracts,
    query: { enabled },
  });

  const balances: ChainTokenBalance[] = useMemo(() => {
    if (!data) return [];

    return tokenMetas.map((meta, i) => {
      const result = data[i];
      let rawBalance = 0n;
      if (result?.status === "success" && typeof result.result === "bigint") {
        rawBalance = result.result;
      }
      return {
        meta,
        chainId: meta.chainId,
        balance: formatUnits(rawBalance, meta.decimals),
        rawBalance,
      };
    });
  }, [data, tokenMetas]);

  return { balances, isLoading };
}
