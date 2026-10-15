/**
 * 共享 React Query key 常量。
 *
 * 目的：跨 DD / 跨组件用同一 query key 命中同一缓存（避免重复请求 + invalidate 失效）。
 * 新加 key 时**禁止**在组件里手写 ['xxx', id] 字面量数组 —— 引用本文件常量。
 */

/** DD-105 / DD-117 / DD-118 共用 — 单个 fixture 的所有链上盘口（按 fixtureId 缓存） */
export const ONCHAIN_MARKETS = (fixtureId: number) => ["onchain-markets", fixtureId] as const;
