"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useWallet } from "@/hooks/useWallet";
import { useMultiChainPortfolio, type PortfolioToken } from "@/hooks/useMultiChainPortfolio";
import { getChainMeta } from "@/lib/chain-registry";
import { BALANCE_READ_CHAINS } from "@/lib/chains";
import { IS_TESTNET } from "@/lib/network-mode";
import { resolvePopularTokens } from "@/lib/swap/picker-popular";
import { formatAmount, formatBalance } from "@/lib/decimal";
import { PLATFORM_TOKEN } from "@/lib/platform-token";
import type { PickerItem, PickerSection } from "@/components/swap/token-picker/types";
import type { TokenMeta } from "@/lib/token-registry";

/**
 * testnet 模式下只允许选 USDT 和 ODD（均在 chainId 97）；
 * mainnet 下直接返回原 item，不做任何修改。
 */
const TESTNET_ALLOWED_IDS = new Set(["97:USDT", "97:ODD"]);

function applyTestnetAllowlist(sections: PickerSection[]): PickerSection[] {
  if (!IS_TESTNET) return sections;
  return sections.map((section) => ({
    ...section,
    items: section.items.map((item) =>
      TESTNET_ALLOWED_IDS.has(item.id) ? item : { ...item, disabled: true }
    ),
  }));
}

/** 链筛选 Tab — Picker / ChainTabs 组件共用形状（DD-078 §3.2） */
export interface ChainTab {
  chainId: number | "all";
  label: string;
  iconUrl?: string;
}

export interface PickerDataResult {
  sections: PickerSection[];
  chainTabs: ChainTab[];
  isLoading: boolean;
}

/**
 * Swap TokenPicker 数据源（Pay/Receive 共用，DD-078 §3.2）。
 *
 * Section 顺序（平台币始终置顶，无分组标签）：
 *   · 未连钱包 / 零资产   → [PlatformTop, Popular（去重 TODD）]
 *   · 连钱包 + 有资产    → [PlatformTop, Owned（去重 TODD）, Popular（去重 TODD + Owned）]
 *
 * PlatformTop 规则：
 *   · 用户持有 TODD → 取 portfolio 条目（真实 balance + usdValue）
 *   · 用户未持有 TODD / 未登录 → 合成 balance="0", usdValue="$—", hasPriceData=false
 *
 * chainTabs 固定顺序：All + Ethereum + BSC + Base + Arbitrum + Polygon。
 */
export function useTokenPickerSource(): PickerDataResult {
  const t = useTranslations("swap.tokenPicker");
  const { address } = useWallet();
  const isConnected = !!address;

  const { portfolio, isLoading } = useMultiChainPortfolio();

  const chainTabs = useMemo<ChainTab[]>(() => buildChainTabs(t("allChains")), [t]);

  const sections = useMemo<PickerSection[]>(() => {
    const platformId = `${PLATFORM_TOKEN.chainId}:${PLATFORM_TOKEN.symbol}`;
    const platformHeld = portfolio.find(
      (p) => p.chainId === PLATFORM_TOKEN.chainId && p.meta.symbol === PLATFORM_TOKEN.symbol
    );
    const platformItem = platformHeld
      ? toOwnedItem(platformHeld)
      : toSyntheticPlatformItem(PLATFORM_TOKEN);
    // 无 label 裸置顶，走 owned variant（显示余额 + USD 列）
    const platformSection: PickerSection = {
      items: [platformItem],
      variant: "owned",
    };

    const excludeIds = new Set<string>([platformId]);

    const popularItems = resolvePopularTokens()
      .map(toDefaultItem)
      .filter((i) => !excludeIds.has(i.id));

    if (!isConnected || portfolio.length === 0) {
      return applyTestnetAllowlist([platformSection, { label: t("popular"), items: popularItems }]);
    }

    const owned = portfolio
      .filter(
        (p) => !(p.chainId === PLATFORM_TOKEN.chainId && p.meta.symbol === PLATFORM_TOKEN.symbol)
      )
      .map(toOwnedItem);
    const ownedIds = new Set(owned.map((i) => i.id));
    const popularDedup = popularItems.filter((i) => !ownedIds.has(i.id));

    return applyTestnetAllowlist([
      platformSection,
      { label: t("ownedAssets"), items: owned },
      { label: t("popular"), items: popularDedup },
    ]);
  }, [isConnected, portfolio, t]);

  return {
    sections,
    chainTabs,
    // 未连钱包时 portfolio 始终空，不让 UI 进入 loading 态
    isLoading: isConnected ? isLoading : false,
  };
}

// ── chainTabs 构造 ────────────────────────────────────────────

const CHAIN_TAB_ORDER: readonly number[] = IS_TESTNET ? [97] : [1, 56, 8453, 42161, 137];

function buildChainTabs(allLabel: string): ChainTab[] {
  const tabs: ChainTab[] = [{ chainId: "all", label: allLabel }];
  for (const chainId of CHAIN_TAB_ORDER) {
    // 防御：仅收录当前 BALANCE_READ_CHAINS 支持的链，避免与 portfolio 扫链不一致
    if (!BALANCE_READ_CHAINS.some((c) => c.id === chainId)) continue;
    const meta = getChainMeta(chainId);
    tabs.push({
      chainId,
      label: shortLabel(meta.name),
      iconUrl: meta.iconUrl,
    });
  }
  return tabs;
}

/** BNB Chain → BSC（Tab 空间有限，全称 "BNB Chain" 会挤掉 iconUrl 后的文字） */
function shortLabel(name: string): string {
  return name === "BNB Chain" ? "BSC" : name;
}

// ── PickerItem 归一化 ─────────────────────────────────────────

function toOwnedItem(p: PortfolioToken): PickerItem {
  const chain = getChainMeta(p.chainId);
  return {
    id: `${p.chainId}:${p.meta.symbol}`,
    symbol: p.meta.symbol,
    name: p.meta.name,
    tokenIconUrl: p.meta.iconUrl,
    chainId: p.chainId,
    chainName: chain.name,
    chainIconUrl: p.chainIcon || chain.iconUrl,
    decimals: p.meta.decimals,
    address: p.meta.address,
    isNative: p.meta.isNative,
    tier: p.meta.tier,
    balance: formatBalance(p.balance, 6),
    usdValue: p.hasPriceData ? `$${formatAmount(p.usdValue, 2)}` : "$—",
    hasPriceData: p.hasPriceData,
  };
}

function toDefaultItem(meta: TokenMeta): PickerItem {
  const chain = getChainMeta(meta.chainId);
  return {
    id: `${meta.chainId}:${meta.symbol}`,
    symbol: meta.symbol,
    name: meta.name,
    tokenIconUrl: meta.iconUrl,
    chainId: meta.chainId,
    chainName: chain.name,
    chainIconUrl: chain.iconUrl,
    decimals: meta.decimals,
    address: meta.address,
    isNative: meta.isNative,
    tier: meta.tier,
  };
}

/**
 * 未持有平台币时的合成条目（未登录 / 登录但钱包无 TODD）：
 * 走 owned variant 以保持布局（右侧余额列）；余额显 0，USD 显 "$—"。
 */
function toSyntheticPlatformItem(meta: TokenMeta): PickerItem {
  const chain = getChainMeta(meta.chainId);
  return {
    id: `${meta.chainId}:${meta.symbol}`,
    symbol: meta.symbol,
    name: meta.name,
    tokenIconUrl: meta.iconUrl,
    chainId: meta.chainId,
    chainName: chain.name,
    chainIconUrl: chain.iconUrl,
    decimals: meta.decimals,
    address: meta.address,
    isNative: meta.isNative,
    tier: meta.tier,
    balance: "0",
    usdValue: "$—",
    hasPriceData: false,
  };
}
