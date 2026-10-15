/**
 * Platform Token Configuration
 *
 * 平台币的"单一数据源"。区分两个独立概念：
 * - 链上 symbol（合约/Swap 路由用）
 * - UI 展示名（余额单位/投注文案用）
 *
 * Mainnet（DD-142，2026-06-13 起）：真 ODDToken 已主网部署，proxy 退役 —— 链上直接 ODD，展示亦 ODD。
 * Testnet 阶段（DD-079）：链上直接 ODD，展示亦 ODD，不再代理。
 * 两网一致后 SYMBOL 恒 "ODD"；保留 DISPLAY/NAME 抽象层，未来若需重启 proxy 占位不必从头重建。
 */

import { TOKEN_BY_SYMBOL, type TokenMeta } from "./token-registry";

// ── 唯一切换入口 ──
/** 链上 symbol — mainnet/testnet 均为真 ODD token */
export const PLATFORM_TOKEN_SYMBOL = "ODD";
/** UI 展示单位（始终 ODD） */
export const PLATFORM_TOKEN_DISPLAY = "ODD" as const;
/** 品牌名（标题用） */
export const PLATFORM_TOKEN_NAME = "Odd" as const;
// ──────────────────────────────────────────────────────────────

export const PLATFORM_TOKEN: TokenMeta = TOKEN_BY_SYMBOL[PLATFORM_TOKEN_SYMBOL];

/**
 * 链上 symbol ≠ UI 展示时为 true（代理期）。
 * proxy 退役后两网均 ODD === ODD → 恒 false。无生产消费方，仅保留语义。
 */
export const IS_PLATFORM_TOKEN_PROXY =
  (PLATFORM_TOKEN_SYMBOL as string) !== (PLATFORM_TOKEN_DISPLAY as string);
