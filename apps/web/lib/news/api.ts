/**
 * DD-110 — News Push API client。
 *
 * 与 lib/api.ts 的差异：
 * - 直连 oddfi-agent-backend（NEXT_PUBLIC_NEWS_API_BASE_URL），不走 Next.js 代理
 * - 无鉴权（后端当前裸奔）
 * - SSE 用浏览器原生 EventSource。注意：原生 EventSource 仅在「连接被网络中断」时自动重连，
 *   遇到非 2xx（如 429）会直接 CLOSED 且**不**自动重连，也读不到 HTTP 状态/Retry-After。
 *   429 的退避重连由 useNewsFeed 的指数退避兜底（见该 hook RECONNECT_* 常量）。
 */
import ky, { HTTPError } from "ky";
import type { PushCard, PushResponse } from "@/types/news";

/**
 * 后端返回 429 / 503 时的错误（DD-110 §10.1 后端速率限制）。
 * 收到此错误的调用方：
 * - REST → 不自动重试，UI 提示「请求过频，{retryAfter}s 后再试」
 * - SSE  → 原生 EventSource 读不到状态码，429 一律表现为 CLOSED；
 *          由 useNewsFeed 指数退避重连兜底（封顶 60s，不再无限风暴），不依赖 Retry-After
 */
export class NewsRateLimitError extends Error {
  constructor(
    public readonly status: 429 | 503,
    public readonly retryAfterSec: number
  ) {
    super(`[news/api] rate limited: HTTP ${status}, retry after ${retryAfterSec}s`);
    this.name = "NewsRateLimitError";
  }
}

function parseRetryAfter(headers: Headers): number {
  const raw = headers.get("Retry-After");
  const sec = raw ? Number(raw) : NaN;
  return Number.isFinite(sec) && sec > 0 ? sec : 60;
}

/**
 * Lazy 读 env — 由 Next.js 在构建时静态折叠为字符串字面量。
 * 用 getter 而非 module-level const 是为了让单测 `vi.stubEnv` 在 import 后仍能生效。
 */
function getNewsApiBase(): string {
  return process.env.NEXT_PUBLIC_NEWS_API_BASE_URL ?? "";
}

/** 配置缺失 → 整 tab 占位「未配置」，不静默走默认 host（DD-110 D15）。 */
export function isNewsApiConfigured(): boolean {
  return getNewsApiBase().length > 0;
}

export interface FetchPushParams {
  limit?: number;
  /** 翻页游标 — 取 ingestedAt 早于此值的卡。 */
  before?: number;
}

/** GET /api/push — 首屏 + 翻页。 */
export async function fetchPush(params: FetchPushParams = {}): Promise<PushResponse> {
  const base = getNewsApiBase();
  if (!base) {
    throw new Error("[news/api] NEXT_PUBLIC_NEWS_API_BASE_URL not configured");
  }
  const searchParams: Record<string, string | number> = {};
  if (params.limit !== undefined) searchParams.limit = params.limit;
  if (params.before !== undefined) searchParams.before = params.before;
  try {
    return await ky
      .get(`${base.replace(/\/$/, "")}/api/push`, {
        searchParams,
        timeout: 15_000,
        // 429 / 503 不自动重试 — 让调用方决定（DD-110 §10.1 后端速率限制 handoff）
        retry: { limit: 2, methods: ["get"], statusCodes: [408, 413, 500, 502, 504] },
      })
      .json<PushResponse>();
  } catch (e) {
    if (e instanceof HTTPError) {
      const status = e.response.status;
      if (status === 429 || status === 503) {
        throw new NewsRateLimitError(status, parseRetryAfter(e.response.headers));
      }
    }
    throw e;
  }
}

export interface PushStreamHandlers {
  onNew: (card: PushCard) => void;
  onUpdate: (card: PushCard) => void;
  onError: () => void;
}

/**
 * 建立 SSE 长连。返回 EventSource，调用方负责 close。
 * @param since unix ms — 仅推送 ingestedAt > since 的卡（断线恢复用）
 */
export function openPushStream(since: number | null, handlers: PushStreamHandlers): EventSource {
  const baseRaw = getNewsApiBase();
  if (!baseRaw) {
    throw new Error("[news/api] NEXT_PUBLIC_NEWS_API_BASE_URL not configured");
  }
  const base = baseRaw.replace(/\/$/, "");
  const url = since !== null ? `${base}/api/push/stream?since=${since}` : `${base}/api/push/stream`;
  const es = new EventSource(url);

  es.addEventListener("card.new", (e) => {
    try {
      const card = JSON.parse((e as MessageEvent).data) as PushCard;
      handlers.onNew(card);
    } catch (err) {
      console.warn("[news/api] card.new parse failed", err);
    }
  });

  es.addEventListener("card.update", (e) => {
    try {
      const card = JSON.parse((e as MessageEvent).data) as PushCard;
      handlers.onUpdate(card);
    } catch (err) {
      console.warn("[news/api] card.update parse failed", err);
    }
  });

  // ping (30s 心跳) — 浏览器默认接收，无需 listener；noop。
  es.addEventListener("error", () => {
    handlers.onError();
  });

  return es;
}
