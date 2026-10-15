import { bsc, bscTestnet } from "wagmi/chains";
import type { Abi } from "viem";

// ============================================================
// Contract Addresses — BSC Mainnet
// ============================================================

export const PANCAKE_ROUTER_V2 = "0x10ED43C718714eb63d5aA57B78B54704E256024E" as const;
export const PANCAKE_TESTNET_ROUTER_V2 = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1" as const;

/** Per-chain DEX router map. Phase 2: add Ethereum/Arbitrum routers here. */
export const DEX_ROUTER: Record<number, `0x${string}`> = {
  [bsc.id]: PANCAKE_ROUTER_V2,
  [bscTestnet.id]: PANCAKE_TESTNET_ROUTER_V2,
};

export const WBNB_TESTNET_ADDRESS = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd" as const;

// ============================================================
// PancakeSwap V2 Router — Minimal ABI (4 methods)
// ============================================================

export const ROUTER_ABI = [
  {
    name: "getAmountsOut",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    name: "swapExactETHForTokens",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    name: "swapExactTokensForETH",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    name: "swapExactTokensForTokens",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
] as const satisfies Abi;

// ============================================================
// ERC-20 — Minimal ABI (4 methods)
// ============================================================

export const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const satisfies Abi;

// ============================================================
// Utilities
// ============================================================

/** Deadline = current time + 20 minutes (Unix seconds, as bigint) */
export function getDeadline(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
}
