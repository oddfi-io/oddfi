// 链图标本地化：源自 trustwallet/assets，下载到 public/images/chains/ 以去掉外链依赖。
// 命名规则见 .claude/rules/static-assets.md —— 链 slug 小写，SVG 优先，无 SVG 源时允许 PNG。
export interface ChainMeta {
  chainId: number;
  name: string;
  slug: string;
  iconUrl: string;
}

const BSC_CHAIN: ChainMeta = {
  chainId: 56,
  name: "BNB Chain",
  slug: "smartchain",
  iconUrl: "/images/chains/bsc.svg",
};

const ETH_CHAIN: ChainMeta = {
  chainId: 1,
  name: "Ethereum",
  slug: "ethereum",
  iconUrl: "/images/chains/ethereum.svg",
};

const ARBITRUM_CHAIN: ChainMeta = {
  chainId: 42161,
  name: "Arbitrum",
  slug: "arbitrum",
  iconUrl: "/images/chains/arbitrum.png",
};

const BASE_CHAIN: ChainMeta = {
  chainId: 8453,
  name: "Base",
  slug: "base",
  iconUrl: "/images/chains/base.svg",
};

const POLYGON_CHAIN: ChainMeta = {
  chainId: 137,
  name: "Polygon",
  slug: "polygon",
  iconUrl: "/images/chains/polygon.png",
};

const BSC_TESTNET_CHAIN: ChainMeta = {
  chainId: 97,
  name: "BNB Testnet",
  slug: "bsc_testnet",
  iconUrl: "/images/chains/bsc.svg",
};

const CHAIN_REGISTRY: Record<number, ChainMeta> = {
  [BSC_CHAIN.chainId]: BSC_CHAIN,
  [BSC_TESTNET_CHAIN.chainId]: BSC_TESTNET_CHAIN,
  [ETH_CHAIN.chainId]: ETH_CHAIN,
  [ARBITRUM_CHAIN.chainId]: ARBITRUM_CHAIN,
  [BASE_CHAIN.chainId]: BASE_CHAIN,
  [POLYGON_CHAIN.chainId]: POLYGON_CHAIN,
};

export const DEFAULT_CHAIN_META = BSC_CHAIN;

export function getChainMeta(chainId: number | undefined): ChainMeta {
  if (!chainId) return DEFAULT_CHAIN_META;
  return CHAIN_REGISTRY[chainId] ?? DEFAULT_CHAIN_META;
}
