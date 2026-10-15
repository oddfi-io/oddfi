/** Picker 使用场景 — pay（支付端）/ receive（收到端） */
export type PickerMode = "pay" | "receive";

/**
 * Picker 列表项。由 `useTokenPickerSource` 归一化 PortfolioToken/TokenMeta 而来。
 * id 作为 React key 与去重依据，格式: `${chainId}:${symbol}`。
 */
export interface PickerItem {
  id: string;
  symbol: string;
  name: string;
  tokenIconUrl: string;
  chainId: number;
  chainName: string;
  chainIconUrl: string;
  /** 仅 "owned" 行使用；格式化后的余额字符串 */
  balance?: string;
  /** 仅 "owned" 行使用；`$<amount>` 或 `$—`（无价格数据时） */
  usdValue?: string;
  // ── DD-078 扩展：SwapCard.handlePickerSelect 现场组 TokenMeta 必需 ──
  decimals?: number;
  address?: `0x${string}`;
  isNative?: boolean;
  tier?: number;
  /** Pay 模式：价格 API 是否返回数据；false 时 usdValue = "$—" */
  hasPriceData?: boolean;
  /** testnet allowlist：非许可 token 时为 true，置灰不可点（不影响 mainnet） */
  disabled?: boolean;
}

/** 列表分组 — label 为空则渲染为无分组单列表（PC 形态） */
export interface PickerSection {
  label?: string;
  items: PickerItem[];
  /**
   * 强制指定行 variant（不依赖 label 匹配）。
   * 用于平台币置顶分组：无 label 但仍需 owned variant（余额 + USD 列）。
   */
  variant?: PickerRowVariant;
}

/** 用户搜索 + 链筛选的受控状态 */
export interface PickerFilter {
  search: string;
  chainId: number | "all";
}

/** Row 渲染变体：default 无右侧余额列；owned 带余额 + USD 列 */
export type PickerRowVariant = "default" | "owned";
