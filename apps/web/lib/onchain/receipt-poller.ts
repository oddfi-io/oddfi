/**
 * DD-105 链上 receipt 轮询基建。
 *
 * 用途：后端 `approve` / `place_bet` / `claim_payout` 返回 tx_hash 后，
 * 前端必须等 BSC Testnet receipt status=success 才能进入下一步。
 *
 * 设计要点：
 * - 指数退避（2s → 3s → 4.5s → 上限 8s），降低 RPC 限流压力
 * - 默认 3min 硬超时；UI 层把超时态映射为"网络拥堵，去注单查看"
 * - `client` / `sleep` / `now` 全部可注入，便于单测在虚拟时间下跑
 */

import { createPublicClient, http, type Hash } from "viem";
import { CORE_CHAIN, CHAIN_RPC } from "@/lib/chains";

export type ReceiptStatus = "success" | "reverted";

export interface WaitForReceiptResult {
  status: ReceiptStatus;
  blockNumber: bigint;
  txHash: Hash;
}

export class ReceiptTimeoutError extends Error {
  constructor(
    public txHash: string,
    public elapsedMs: number
  ) {
    super(`[ReceiptPoller] Timeout after ${elapsedMs}ms waiting for ${txHash}`);
    this.name = "ReceiptTimeoutError";
  }
}

interface MinimalReceipt {
  status: ReceiptStatus;
  blockNumber: bigint;
}

export interface ReceiptClient {
  getTransactionReceipt: (args: { hash: Hash }) => Promise<MinimalReceipt>;
}

export interface WaitForReceiptOpts {
  /** Hard ceiling, default 180_000 ms (3min) */
  timeoutMs?: number;
  /** First sleep before first poll, default 2000 ms */
  initialDelayMs?: number;
  /** Max single sleep cap, default 8000 ms */
  maxDelayMs?: number;
  /** Backoff multiplier, default 1.5 */
  backoff?: number;
  /** Inject custom client for tests; default = CORE_CHAIN client (走 NEXT_PUBLIC_BSC_{TESTNET_,}RPC_URL,与钱包/wagmi 同一 RPC) */
  client?: ReceiptClient;
  /** Inject sleep for tests */
  sleep?: (ms: number) => Promise<void>;
  /** Inject monotonic clock for tests */
  now?: () => number;
}

const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_INITIAL_DELAY_MS = 2_000;
const DEFAULT_MAX_DELAY_MS = 8_000;
const DEFAULT_BACKOFF = 1.5;

let cachedDefaultClient: ReceiptClient | null = null;
function getDefaultClient(): ReceiptClient {
  // SSR 防护：lib/onchain 不应在服务端实例化（持有 RPC 连接的客户端单例只在浏览器有意义）
  // 任何 Server Component 误传入这条路径都早抛错，而非泄漏长连接。
  // (REV-DD105-v1 C-03)
  if (typeof window === "undefined") {
    throw new Error(
      "[ReceiptPoller] Default client cannot be created on the server; pass a client via opts.client or call from a 'use client' module"
    );
  }
  if (!cachedDefaultClient) {
    // 用 CORE_CHAIN(随 NetworkMode 切 BSC 主网 / Testnet) + 项目自定义 RPC(Alchemy),
    // 跟钱包/wagmi 走同一条 RPC,避免混用 BSC 官方公网 RPC 限流。
    const rpcUrl = CHAIN_RPC[CORE_CHAIN.id];
    cachedDefaultClient = createPublicClient({
      chain: CORE_CHAIN,
      transport: http(rpcUrl),
    }) as unknown as ReceiptClient;
  }
  return cachedDefaultClient;
}

function realSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForReceipt(
  txHash: Hash,
  opts: WaitForReceiptOpts = {}
): Promise<WaitForReceiptResult> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    initialDelayMs = DEFAULT_INITIAL_DELAY_MS,
    maxDelayMs = DEFAULT_MAX_DELAY_MS,
    backoff = DEFAULT_BACKOFF,
    client = getDefaultClient(),
    sleep = realSleep,
    now = Date.now,
  } = opts;

  const start = now();
  let delay = initialDelayMs;

  while (true) {
    await sleep(delay);

    try {
      const receipt = await client.getTransactionReceipt({ hash: txHash });
      return { status: receipt.status, blockNumber: receipt.blockNumber, txHash };
    } catch {
      // pending — viem throws TransactionReceiptNotFoundError; treat any error as "not yet"
      // 这里不区分 RPC 故障 vs pending：均按 pending 重试，让 timeoutMs 兜底
    }

    const elapsed = now() - start;
    if (elapsed >= timeoutMs) {
      throw new ReceiptTimeoutError(txHash, elapsed);
    }

    delay = Math.min(delay * backoff, maxDelayMs);
  }
}
