import { bsc, bscTestnet, mainnet, polygon, arbitrum, base } from "wagmi/chains";
import type { Chain } from "wagmi/chains";
import { ACTIVE_CORE_CHAIN, IS_TESTNET } from "./network-mode";

// ============================================================
// Supported chains — chains the user can stay on
// ============================================================
// Mainnet: bsc/mainnet/polygon/arbitrum/base 均为支持链
// Testnet (DD-079): 仅 bscTestnet，用于 ODD 合约联调

export const SUPPORTED_CHAINS = (
  IS_TESTNET ? [bscTestnet] : [bsc, mainnet, polygon, arbitrum, base]
) as readonly [Chain, ...Chain[]];
export type SupportedChain = (typeof SUPPORTED_CHAINS)[number];

/** 核心链：PancakeSwap / Betting / Proxy Wallet 所在链（随 NetworkMode 切换） */
export const CORE_CHAIN: Chain = ACTIVE_CORE_CHAIN;

export const isSupportedChain = (chainId: number): boolean =>
  SUPPORTED_CHAINS.some((c) => c.id === chainId);

/** 是否为核心链（随 NetworkMode 切换 mainnet BSC / BSC Testnet） */
export const isCoreChain = (chainId: number): boolean => chainId === CORE_CHAIN.id;

// 每条链的自定义 RPC（可选）。undefined 时 fallback 到链默认公共 RPC。
export const CHAIN_RPC: Record<number, string | undefined> = {
  [bsc.id]: process.env.NEXT_PUBLIC_BSC_RPC_URL,
  [bscTestnet.id]: process.env.NEXT_PUBLIC_BSC_TESTNET_RPC_URL,
  [mainnet.id]: process.env.NEXT_PUBLIC_ETH_RPC_URL,
  [polygon.id]: process.env.NEXT_PUBLIC_POLYGON_RPC_URL,
  [arbitrum.id]: process.env.NEXT_PUBLIC_ARB_RPC_URL,
  [base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL,
};

// ============================================================
// Balance-read chains — chains we read balances from (read-only, no tx signing)
// ============================================================

/** All chains we read token balances from (equals SUPPORTED_CHAINS) */
export const BALANCE_READ_CHAINS = SUPPORTED_CHAINS;

/** RPC endpoints for balance-read chains */
export const BALANCE_CHAIN_RPC: Record<number, string | undefined> = CHAIN_RPC;

// ============================================================
// All chains — union of supported + balance-read (for wagmi config)
// ============================================================

/** Deduplicated union of all chains needing transport */
export const ALL_CHAINS = [
  ...new Map([...SUPPORTED_CHAINS, ...BALANCE_READ_CHAINS].map((c) => [c.id, c])).values(),
] as unknown as readonly [Chain, ...Chain[]];

/** Combined RPC map for all chains */
export const ALL_CHAIN_RPC: Record<number, string | undefined> = {
  ...BALANCE_CHAIN_RPC,
  ...CHAIN_RPC,
};
