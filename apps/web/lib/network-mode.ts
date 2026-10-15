/**
 * Network Mode Configuration (DD-079)
 *
 * 网络模式的"单一数据源"。默认 mainnet，任何 env 误写都回落安全值。
 * 其他模块一律 `import { IS_TESTNET, ACTIVE_CORE_CHAIN } from "@/lib/network-mode"`。
 *
 * 切换方式：pnpm dev:testnet（脚本内注入 NEXT_PUBLIC_NETWORK_MODE=testnet）。
 */

import { bsc, bscTestnet } from "wagmi/chains";
import type { Chain } from "wagmi/chains";

export type NetworkMode = "mainnet" | "testnet";

// ── 唯一切换入口（对齐 lib/platform-token.ts 风格） ──
export const ACTIVE_NETWORK: NetworkMode =
  process.env.NEXT_PUBLIC_NETWORK_MODE === "testnet" ? "testnet" : "mainnet";

export const IS_TESTNET = ACTIVE_NETWORK === "testnet";
export const ACTIVE_CORE_CHAIN: Chain = IS_TESTNET ? bscTestnet : bsc;

// ── 赛事赔率实时源开关（临时 · 后端 WS 优化期间）──
//
// 背景：链上赔率 WS（oddfi-data-ws）是事件驱动 —— 仅当链上发生 OddsUpdated（有交易量）才推送。
// 实测真实世界杯赛中链上盘口常被锁盘/无量更新（quoted_odds 冻结），会与 sports_all 的 SportMonks
// live odds 脱节（后端 Remy 口径）。短期先以 sports_all 的赛中赔率为准。
//
// - "rest"：不订阅 WS，赛中赔率显示走 sports_all（useLiveOddsForEntry 的 fallbackValue，由
//           useMarketData 既有 ~30s 轮询刷新，匹配后端 spider 节奏），并在值变化时闪烁。
// - "ws"  ：恢复 WS 实时推送 + 合约 quotedOdds 优先（后端推送链路稳定后改回，WS 代码全部保留）。
//
// 恢复方式：把本值改回 "ws" 重新部署即可。
export const LIVE_ODDS_SOURCE: "rest" | "ws" = "rest";
