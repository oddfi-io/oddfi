import { CORE_CHAIN } from "./chains";

const TRUST_WALLET_BASE = "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains";

function bscIcon(checksumAddress: string): string {
  return `${TRUST_WALLET_BASE}/smartchain/assets/${checksumAddress}/logo.png`;
}

function ethIcon(checksumAddress: string): string {
  return `${TRUST_WALLET_BASE}/ethereum/assets/${checksumAddress}/logo.png`;
}

function chainLogo(chain: string): string {
  return `${TRUST_WALLET_BASE}/${chain}/info/logo.png`;
}

export interface TokenMeta {
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
  iconUrl: string;
  /** Sorting weight when USD value = 0. Higher = displayed first. */
  tier: number;
  isNative?: boolean;
  /** Chain this token belongs to */
  chainId: number;
}

// ============================================================
// Chain ID mapping (numeric ↔ backend string)
// ============================================================

/** Numeric chain ID → backend string (e.g. 56 → "bsc") */
export const CHAIN_ID_MAP: Record<number, string> = {
  56: "bsc",
  97: "bsc_testnet",
  1: "eth",
  137: "polygon_pos",
  42161: "arbitrum",
  8453: "base",
};

/** Reverse: backend string → numeric chain ID */
export const CHAIN_ID_REVERSE_MAP: Record<string, number> = Object.fromEntries(
  Object.entries(CHAIN_ID_MAP).map(([k, v]) => [v, Number(k)])
);

/**
 * Chain icon URLs — 优先本地彩色资源（见 public/images/chains/），
 * 未维护本地资源的链用 chainLogo() 外链兜底。
 */
export const CHAIN_ICON_MAP: Record<number, string> = {
  56: "/images/chains/bsc.svg",
  97: "/images/chains/bsc.svg", // 复用 BSC 图标（testnet 无独立 logo）
  1: "/images/chains/ethereum.svg",
  137: "/images/chains/polygon.png",
  42161: "/images/chains/arbitrum.png",
  8453: "/images/chains/base.svg",
};

// ============================================================
// BSC (chainId: 56) — existing 9 tokens
// ============================================================

export const BSC_TOKENS: TokenMeta[] = [
  {
    symbol: "BNB",
    name: "BNB",
    address: "0x0000000000000000000000000000000000000000",
    decimals: 18,
    iconUrl: chainLogo("smartchain"),
    tier: 4,
    isNative: true,
    chainId: 56,
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    address: "0x55d398326f99059fF775485246999027B3197955",
    decimals: 18,
    iconUrl: bscIcon("0x55d398326f99059fF775485246999027B3197955"),
    tier: 3,
    chainId: 56,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    decimals: 18,
    iconUrl: bscIcon("0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"),
    tier: 2,
    chainId: 56,
  },
  {
    // 2026-06-13 真 ODDToken 主网部署，退役占位 TODD（旧址 0xa3049f…）；
    // 与后端 prod config odd_token_address + 合约 bsc-mainnet-current.json 逐字节一致（DD-142）
    symbol: "ODD",
    name: "Odd Token",
    address: "0x3e130563e069c414F0a18863966c211aA5D518F9",
    decimals: 18,
    iconUrl: "/images/tokens/odd.svg",
    tier: 1,
    chainId: 56,
  },
];

// ============================================================
// Ethereum (chainId: 1)
// ============================================================

const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as const;

export const ETH_TOKENS: TokenMeta[] = [
  {
    symbol: "ETH",
    name: "Ethereum",
    address: ZERO_ADDR,
    decimals: 18,
    iconUrl: chainLogo("ethereum"),
    tier: 9,
    isNative: true,
    chainId: 1,
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    decimals: 6,
    iconUrl: ethIcon("0xdAC17F958D2ee523a2206206994597C13D831ec7"),
    tier: 8,
    chainId: 1,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
    iconUrl: ethIcon("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
    tier: 7,
    chainId: 1,
  },
  {
    symbol: "DAI",
    name: "Dai Stablecoin",
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    decimals: 18,
    iconUrl: ethIcon("0x6B175474E89094C44Da98b954EedeAC495271d0F"),
    tier: 5,
    chainId: 1,
  },
];

// ============================================================
// Polygon (chainId: 137)
// ============================================================

export const POLYGON_TOKENS: TokenMeta[] = [
  {
    symbol: "POL",
    name: "POL",
    address: ZERO_ADDR,
    decimals: 18,
    iconUrl: chainLogo("polygon"),
    tier: 9,
    isNative: true,
    chainId: 137,
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    decimals: 6,
    iconUrl: ethIcon("0xdAC17F958D2ee523a2206206994597C13D831ec7"),
    tier: 8,
    chainId: 137,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    decimals: 6,
    iconUrl: ethIcon("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
    tier: 7,
    chainId: 137,
  },
];

// ============================================================
// Arbitrum (chainId: 42161)
// ============================================================

export const ARB_TOKENS: TokenMeta[] = [
  {
    symbol: "ETH",
    name: "Ethereum",
    address: ZERO_ADDR,
    decimals: 18,
    iconUrl: chainLogo("ethereum"),
    tier: 9,
    isNative: true,
    chainId: 42161,
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    decimals: 6,
    iconUrl: ethIcon("0xdAC17F958D2ee523a2206206994597C13D831ec7"),
    tier: 8,
    chainId: 42161,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    decimals: 6,
    iconUrl: ethIcon("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
    tier: 7,
    chainId: 42161,
  },
  {
    symbol: "ARB",
    name: "Arbitrum",
    address: "0x912CE59144191C1204E64559FE8253a0e49E6548",
    decimals: 18,
    iconUrl: chainLogo("arbitrum"),
    tier: 6,
    chainId: 42161,
  },
];

// ============================================================
// Base (chainId: 8453)
// ============================================================

export const BASE_TOKENS: TokenMeta[] = [
  {
    symbol: "ETH",
    name: "Ethereum",
    address: ZERO_ADDR,
    decimals: 18,
    iconUrl: chainLogo("ethereum"),
    tier: 9,
    isNative: true,
    chainId: 8453,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6,
    iconUrl: ethIcon("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
    tier: 7,
    chainId: 8453,
  },
];

// ============================================================
// BSC Testnet (chainId: 97) — DD-079 ODD 联调
// ============================================================
// TODO(testnet-contracts): USDC 的 testnet 合约地址待合约团队提供，未定前用 ZERO 占位。
// USDT: 0xa8A74A6b4198F4C3650C8e6Fc2d2498a9B61377c（已确认）
// ODD:  0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0（2026-06-01 合约全量重部署 Proxy；旧 0x5530dA… 已弃用）

export const BSC_TESTNET_TOKENS: TokenMeta[] = [
  {
    symbol: "BNB",
    name: "tBNB",
    address: ZERO_ADDR,
    decimals: 18,
    iconUrl: chainLogo("smartchain"),
    tier: 4,
    isNative: true,
    chainId: 97,
  },
  {
    symbol: "USDT",
    name: "Test USDT",
    address: "0xa8A74A6b4198F4C3650C8e6Fc2d2498a9B61377c",
    decimals: 6,
    iconUrl: bscIcon("0x337610d27c682E347C9cD60BD4b3b107C9d34dDd"),
    tier: 3,
    chainId: 97,
  },
  {
    symbol: "USDC",
    name: "Test USDC",
    address: ZERO_ADDR,
    decimals: 18,
    iconUrl: bscIcon("0x64544969ed7EBf5f083679233325356EbE738930"),
    tier: 2,
    chainId: 97,
  },
  {
    symbol: "ODD",
    name: "Odd Token",
    // 2026-06-01 ODDToken proxy 重部署（oddfi-ODD/docs/development/api.md，与后端 config 一致）
    address: "0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0",
    decimals: 18,
    iconUrl: "/images/tokens/odd.svg",
    tier: 5, // 高于 USDT/USDC，排序置顶
    chainId: 97,
  },
];

/** Token list indexed by chainId — multi-chain registry */
export const TOKEN_REGISTRY: Record<number, TokenMeta[]> = {
  56: BSC_TOKENS,
  97: BSC_TESTNET_TOKENS,
  1: ETH_TOKENS,
  137: POLYGON_TOKENS,
  42161: ARB_TOKENS,
  8453: BASE_TOKENS,
};

/**
 * 以「当前核心链」的 token 列表派生（DD-079 §3.6）：
 * - mainnet 下等于 BSC_TOKENS（保持原行为）
 * - testnet 下等于 BSC_TESTNET_TOKENS（含 ODD，让 PLATFORM_TOKEN 查得到）
 */
export const TOKEN_BY_SYMBOL: Record<string, TokenMeta> = Object.fromEntries(
  (TOKEN_REGISTRY[CORE_CHAIN.id] ?? []).map((t) => [t.symbol, t])
);

export function getTokensForChain(chainId: number): TokenMeta[] {
  return TOKEN_REGISTRY[chainId] ?? [];
}

/** Look up a token by chain + symbol (multi-chain aware) */
export function getTokenByChainAndSymbol(chainId: number, symbol: string): TokenMeta | undefined {
  return TOKEN_REGISTRY[chainId]?.find((t) => t.symbol === symbol);
}

// ============================================================
// Swap-specific token subsets & helpers
// ============================================================

/**
 * WBNB wrapped address on BSC.
 * Used by swap hooks to build routing paths (native BNB → WBNB in path).
 */
export const WBNB_ADDRESS = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" as const;

/** Deposit 支持的代币（不含平台币，平台币由 platform-token.ts 配置，始终展示） */
export const DEPOSIT_TOKEN_SYMBOLS: string[] = ["BNB", "USDC"];

/** All BSC tokens are available in the Swap UI. */
export const SWAP_TOKENS: TokenMeta[] = BSC_TOKENS;

/** Look up a token by symbol within a given chain. */
export function getTokenBySymbol(chainId: number, symbol: string): TokenMeta | undefined {
  return getTokensForChain(chainId).find((t) => t.symbol === symbol);
}
