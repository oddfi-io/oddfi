/**
 * DD-105 / 后端 949a5f3 — 链上 BetPlaced 索引回填轮询。
 *
 * 流程位置：
 *   submitOnchainBet 拿到 place_bet 的 order_id 后，事件索引服务会异步把链上 BetPlaced 的
 *   bet_id 回填到该订单。前端轮询 GET /onchain/orders/:id 直到 bet_ready=true 才能领奖。
 *
 * 与 receipt-poller 的区别：
 * - receipt-poller 等"交易上链确认"（秒级，BSC ~3s 出块）
 * - order-poller 等"事件索引服务回填 bet_id"（分钟级，受 BetSettleService 扫描节奏影响）
 *
 * 设计要点：
 * - 默认 10 分钟硬超时（事件索引延迟通常 10-60s，给足缓冲）
 * - 指数退避（3s → 4.5s → ... 上限 15s）
 * - getOrder 抛错不重试（后端 500 等需要让上层决定，不要假装暂态）
 */

import { getOnchainOrder } from "@/lib/api";
import type { OnchainOrderResponse } from "@/types/onchain-betting";

export class OrderNotReadyTimeoutError extends Error {
  constructor(
    public orderId: number,
    public elapsedMs: number
  ) {
    super(`[OrderPoller] Order ${orderId} bet_id not ready after ${elapsedMs}ms`);
    this.name = "OrderNotReadyTimeoutError";
  }
}

export class OrderBetReadyInconsistentError extends Error {
  constructor(public order: OnchainOrderResponse) {
    super(
      `[OrderPoller] Order ${order.order_id} reports bet_ready=true but bet_id is empty — backend invariant violated`
    );
    this.name = "OrderBetReadyInconsistentError";
  }
}

export interface WaitForBetReadyOpts {
  /** Hard ceiling, default 600_000 ms (10min) — 事件索引服务回填可能慢 */
  timeoutMs?: number;
  /** First sleep before first poll, default 3000 ms */
  initialDelayMs?: number;
  /** Max single sleep cap, default 15_000 ms */
  maxDelayMs?: number;
  /** Backoff multiplier, default 1.5 */
  backoff?: number;
  /** Test seam */
  getOrder?: (orderId: number) => Promise<OnchainOrderResponse>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export interface WaitForBetReadyResult {
  betId: string;
  order: OnchainOrderResponse;
}

const DEFAULT_TIMEOUT_MS = 600_000;
const DEFAULT_INITIAL_DELAY_MS = 3_000;
const DEFAULT_MAX_DELAY_MS = 15_000;
const DEFAULT_BACKOFF = 1.5;

function realSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForOnchainBetReady(
  orderId: number,
  opts: WaitForBetReadyOpts = {}
): Promise<WaitForBetReadyResult> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    initialDelayMs = DEFAULT_INITIAL_DELAY_MS,
    maxDelayMs = DEFAULT_MAX_DELAY_MS,
    backoff = DEFAULT_BACKOFF,
    getOrder = getOnchainOrder,
    sleep = realSleep,
    now = Date.now,
  } = opts;

  const start = now();
  let delay = 0; // 首次立即查，已就绪的订单走快速路径

  while (true) {
    if (delay > 0) await sleep(delay);

    // getOrder 抛错（如 500/404）让调用方决定是否重试，不在轮询里掩盖
    const order = await getOrder(orderId);
    if (order.bet_ready) {
      if (!order.bet_id) {
        throw new OrderBetReadyInconsistentError(order);
      }
      return { betId: order.bet_id, order };
    }

    const elapsed = now() - start;
    if (elapsed >= timeoutMs) {
      throw new OrderNotReadyTimeoutError(orderId, elapsed);
    }
    delay = delay === 0 ? initialDelayMs : Math.min(delay * backoff, maxDelayMs);
  }
}
