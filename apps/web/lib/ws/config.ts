/**
 * DD-101: WS 服务多环境 URL 解析
 *
 * 命名规范：NEXT_PUBLIC_WS_<SERVICE>_URL（参考 docs/websocket-integration.md）。
 * 缺失/空值 → 显式抛 WsDisabledError，消费方决定降级路径（绝不静默连接）。
 */

import { WsDisabledError } from "./types";

export interface TxWsConfig {
  url: string;
}

/** Read NEXT_PUBLIC_WS_TX_URL or throw WsDisabledError if empty/missing. */
export function getTxWsConfig(): TxWsConfig {
  const raw = process.env.NEXT_PUBLIC_WS_TX_URL;
  const url = typeof raw === "string" ? raw.trim() : "";
  if (!url) throw new WsDisabledError("tx");
  return { url };
}

export interface OddsWsConfig {
  url: string;
}

/**
 * DD-118: 读取 NEXT_PUBLIC_WS_ODDS_URL —— 链上赔率推送服务（oddfi-data-ws）。
 * 空值/缺失抛 WsDisabledError，消费方降级到 REST base_odds（无实时刷新）。
 */
export function getOddsWsConfig(): OddsWsConfig {
  const raw = process.env.NEXT_PUBLIC_WS_ODDS_URL;
  const url = typeof raw === "string" ? raw.trim() : "";
  if (!url) throw new WsDisabledError("odds");
  return { url };
}
