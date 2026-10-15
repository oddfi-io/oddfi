"use client";

import { useQuery } from "@tanstack/react-query";
import { readContract, writeContract, type WriteContractParameters } from "wagmi/actions";
import { parseUnits, formatUnits, maxUint256, type Address, type Hash } from "viem";
import { wagmiConfig } from "@/lib/wagmi.config";
import { bscTestnet } from "wagmi/chains";
import { ROUTER_ABI, ERC20_ABI, DEX_ROUTER, getDeadline, WBNB_TESTNET_ADDRESS } from "./constants";
import { TOKEN_BY_SYMBOL, WBNB_ADDRESS, type TokenMeta } from "@/lib/token-registry";
import { PLATFORM_TOKEN } from "@/lib/platform-token";
import { isGt } from "@/lib/decimal";

// ── Types ────────────────────────────────────────────────────────

export interface PancakeSwapParams {
  fromToken: TokenMeta;
  toToken: TokenMeta;
  amount: string; // human-readable, e.g. "1.5"
  slippageBps: number; // basis points, e.g. 50 = 0.5%
  recipient: Address; // Deposit: proxy wallet; Swap: user EOA
  owner: Address; // For allowance lookup (usually = user EOA)
}

export interface PancakeQuote {
  path: readonly Address[];
  amountIn: bigint;
  amountOut: bigint;
  amountOutFormatted: string;
  /** "1 FROM = X TO" */
  rate: string;
  /** Price impact as percent string, e.g. "0.250" */
  priceImpact: string;
  minReceived: bigint;
  minReceivedFormatted: string;
}

// ── Internal constants ───────────────────────────────────────────

const BSC_USDT = TOKEN_BY_SYMBOL.USDT.address as Address;

/** Tokens whose only PancakeSwap V2 pool is against USDT (not WBNB) */
const USDT_ROUTED = new Set([PLATFORM_TOKEN.address]);

// ── Path builder ─────────────────────────────────────────────────

/**
 * Build the optimal swap path.
 * Routes through WBNB by default, USDT for specific tokens (e.g. TODD/ODD).
 */
export function buildPath(from: TokenMeta, to: TokenMeta): readonly Address[] {
  const wbnb = (from.chainId === bscTestnet.id ? WBNB_TESTNET_ADDRESS : WBNB_ADDRESS) as Address;
  const fromAddr = (from.isNative ? wbnb : from.address) as Address;
  const toAddr = (to.isNative ? wbnb : to.address) as Address;

  // Testnet: only USDT/ODD direct pool exists — always use direct path
  if (from.chainId === bscTestnet.id) {
    return [fromAddr, toAddr];
  }

  // Mainnet: USDT-routed logic for PLATFORM_TOKEN (TODD/ODD only pool is USDT-paired)
  const needsUsdtBridge = USDT_ROUTED.has(fromAddr) || USDT_ROUTED.has(toAddr);

  if (!needsUsdtBridge) {
    if (fromAddr === wbnb || toAddr === wbnb) {
      return [fromAddr, toAddr];
    }
    return [fromAddr, wbnb, toAddr];
  }

  // USDT-routed token: direct if other side is USDT
  if (fromAddr === BSC_USDT || toAddr === BSC_USDT) {
    return [fromAddr, toAddr];
  }
  // BNB ↔ USDT-routed token: WBNB → USDT → TOKEN
  if (fromAddr === wbnb) return [wbnb, BSC_USDT, toAddr];
  if (toAddr === wbnb) return [fromAddr, BSC_USDT, wbnb];
  // Other ERC-20 ↔ USDT-routed token: TOKEN → USDT → TOKEN
  return [fromAddr, BSC_USDT, toAddr];
}

// ── Core computation ─────────────────────────────────────────────

export async function computePancakeQuote(params: PancakeSwapParams): Promise<PancakeQuote | null> {
  const { fromToken, toToken, amount, slippageBps } = params;

  if (!amount || !isGt(amount, "0")) return null;

  let amountIn: bigint;
  try {
    amountIn = parseUnits(amount, fromToken.decimals);
  } catch {
    return null;
  }
  if (amountIn === 0n) return null;

  const path = buildPath(fromToken, toToken);
  const chainId = fromToken.chainId;

  const amountsOut = (await readContract(wagmiConfig, {
    chainId,
    abi: ROUTER_ABI,
    address: DEX_ROUTER[chainId],
    functionName: "getAmountsOut",
    args: [amountIn, path],
  })) as readonly bigint[];

  const amountOut = amountsOut[amountsOut.length - 1];
  const toDecimals = toToken.decimals;
  const fromDecimals = fromToken.decimals;

  const amountOutFormatted = formatUnits(amountOut, toDecimals);

  // Rate: 1 fromToken = X toToken (adjust for decimal difference)
  const rateRaw = (Number(amountOut) / Number(amountIn)) * Math.pow(10, fromDecimals - toDecimals);
  // eslint-disable-next-line no-restricted-syntax -- intermediate calc, not financial display
  const rate = rateRaw.toFixed(6);

  // Price impact: 0.25% base fee per hop + rough size impact estimate
  const hops = path.length - 1;
  const sizeImpact = Math.min(Number(formatUnits(amountIn, fromDecimals)) / 100_000, 2);
  // eslint-disable-next-line no-restricted-syntax -- intermediate calc, not financial display
  const priceImpact = (0.25 * hops + sizeImpact).toFixed(3);

  // Min received after slippage (slippageBps: 50 = 0.5%)
  const slippageFactor = BigInt(10_000 - slippageBps);
  const minReceived = (amountOut * slippageFactor) / 10_000n;
  const minReceivedFormatted = formatUnits(minReceived, toDecimals);

  return {
    path,
    amountIn,
    amountOut,
    amountOutFormatted,
    rate,
    priceImpact,
    minReceived,
    minReceivedFormatted,
  };
}

// ── React hook form (TanStack Query) ────────────────────────────

export function usePancakeQuote(params: PancakeSwapParams | undefined) {
  return useQuery({
    queryKey: ["pancakeQuote", params],
    queryFn: () => computePancakeQuote(params!),
    enabled: !!params && isGt(params.amount, "0"),
    staleTime: 5_000,
    refetchInterval: 15_000,
  });
}

// ── Pure factory form (execute inside click handler) ─────────────

export function createPancakeSwap(params: PancakeSwapParams) {
  const chainId = params.fromToken.chainId;
  const routerAddress = DEX_ROUTER[chainId];

  return {
    async needsApproval(): Promise<boolean> {
      if (params.fromToken.isNative) return false;
      const amountIn = parseUnits(params.amount, params.fromToken.decimals);
      const allowance = (await readContract(wagmiConfig, {
        chainId,
        abi: ERC20_ABI,
        address: params.fromToken.address as Address,
        functionName: "allowance",
        args: [params.owner, routerAddress],
      })) as bigint;
      return allowance < amountIn;
    },

    async approve(): Promise<Hash> {
      if (params.fromToken.isNative) throw new Error("Native token does not require approval");
      return writeContract(wagmiConfig, {
        chainId,
        abi: ERC20_ABI,
        address: params.fromToken.address as Address,
        functionName: "approve",
        args: [routerAddress, maxUint256],
      } as WriteContractParameters);
    },

    async execute(quote: PancakeQuote): Promise<Hash> {
      const deadline = getDeadline();
      const { path, minReceived, amountIn } = quote;

      // Native (BNB) → ERC20
      if (params.fromToken.isNative) {
        return writeContract(wagmiConfig, {
          chainId,
          abi: ROUTER_ABI,
          address: routerAddress,
          functionName: "swapExactETHForTokens",
          args: [minReceived, path, params.recipient, deadline],
          value: amountIn,
        } as WriteContractParameters);
      }
      // ERC20 → Native (BNB)
      if (params.toToken.isNative) {
        return writeContract(wagmiConfig, {
          chainId,
          abi: ROUTER_ABI,
          address: routerAddress,
          functionName: "swapExactTokensForETH",
          args: [amountIn, minReceived, path, params.recipient, deadline],
        } as WriteContractParameters);
      }
      // ERC20 → ERC20
      return writeContract(wagmiConfig, {
        chainId,
        abi: ROUTER_ABI,
        address: routerAddress,
        functionName: "swapExactTokensForTokens",
        args: [amountIn, minReceived, path, params.recipient, deadline],
      } as WriteContractParameters);
    },
  };
}
