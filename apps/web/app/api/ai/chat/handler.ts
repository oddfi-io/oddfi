/**
 * DD-107 §3.3：AI Chat POST 处理逻辑工厂。
 *
 * 单独抽离到 handler.ts —— Next.js 14 App Router 限制 route.ts 不允许
 * export HTTP verb 之外的命名导出（buildPostHandler 是 dep-injection 工厂，
 * 留在 route.ts 会触发 .next/types 校验错误）。route.ts 仅 export POST。
 */
import { type NextRequest } from "next/server";
import { decodeJwtAddress } from "@/lib/auth";
import { AiConfigError, AiUpstreamError, callChatStream } from "@/lib/ai/provider";
import { memoryLimiter, type RateLimiter } from "@/lib/ai/rate-limit";
import { chatRequestSchema } from "@/lib/ai/schema";
import { buildFreeChatContext, buildSystemPrompt, todayISO } from "@/lib/ai/system-prompt";
import { ContextUnavailableError, buildMatchContext } from "@/lib/ai/context/match-context";

const WINDOW_MS = 60_000;
const ANON_MAX_PER_MIN = 5;
const WALLET_MAX_PER_MIN = 30;
// match-analysis triggers 5 downstream fetches → sub-quota = base / DIVISOR
const MATCH_ANALYSIS_DIVISOR = 5;

interface Identity {
  key: string;
  max: number;
}

function getIdentity(req: NextRequest): Identity {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    const address = decodeJwtAddress(token);
    if (address) {
      return { key: `wallet:${address.toLowerCase()}`, max: WALLET_MAX_PER_MIN };
    }
  }
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return { key: `ip:${ip}`, max: ANON_MAX_PER_MIN };
}

export interface HandlerDeps {
  limiter?: RateLimiter;
  callChatStreamImpl?: typeof callChatStream;
  buildMatchContextImpl?: typeof buildMatchContext;
  now?: () => Date;
}

export function buildPostHandler(deps: HandlerDeps = {}) {
  const limiter = deps.limiter ?? memoryLimiter;
  const callChatStreamFn = deps.callChatStreamImpl ?? callChatStream;
  const buildContextFn = deps.buildMatchContextImpl ?? buildMatchContext;
  const nowFn = deps.now ?? (() => new Date());

  return async function POST(req: NextRequest): Promise<Response> {
    const t0 = Date.now();
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json(
        { code: "AI_BAD_REQUEST", message: "Invalid JSON body", data: null },
        { status: 400 }
      );
    }

    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          code: "AI_BAD_REQUEST",
          message: parsed.error.issues.map((i) => i.message).join("; "),
          data: null,
        },
        { status: 400 }
      );
    }

    const { intent, matchId, messages, persona } = parsed.data;
    const identity = getIdentity(req);

    const baseAllowed = await limiter.check(identity.key, identity.max, WINDOW_MS);
    if (!baseAllowed) {
      return Response.json(
        { code: "AI_RATE_LIMITED", message: "Too many requests", data: null },
        { status: 429 }
      );
    }
    if (intent === "match-analysis") {
      const matchKey = `${identity.key}:match-analysis`;
      const matchMax = Math.max(1, Math.floor(identity.max / MATCH_ANALYSIS_DIVISOR));
      const matchAllowed = await limiter.check(matchKey, matchMax, WINDOW_MS);
      if (!matchAllowed) {
        return Response.json(
          {
            code: "AI_RATE_LIMITED",
            message: "Too many match-analysis requests",
            data: null,
          },
          { status: 429 }
        );
      }
    }

    let contextBlock: string;
    if (intent === "match-analysis" && matchId) {
      try {
        contextBlock = await buildContextFn(matchId);
      } catch (e: unknown) {
        if (e instanceof ContextUnavailableError) {
          console.error("[ai/chat] context unavailable", { matchId, ms: Date.now() - t0 });
          return Response.json(
            {
              code: "AI_CONTEXT_UNAVAILABLE",
              message: "Match data temporarily unavailable, please retry",
              data: null,
            },
            { status: 503 }
          );
        }
        console.error("[ai/chat] context unknown fail", {
          matchId,
          msg: e instanceof Error ? e.message : "unknown",
        });
        return Response.json(
          { code: "AI_INTERNAL", message: "Context build failed", data: null },
          { status: 500 }
        );
      }
    } else {
      contextBlock = buildFreeChatContext();
    }

    // DD-107 ENH · Live Search：仅 xAI provider 启用（其他 provider 没有 web search 能力）
    const liveSearchEnabled = (process.env.AI_PROVIDER ?? "deepseek") === "xai";

    const systemPrompt = buildSystemPrompt({
      persona,
      todayISO: todayISO(nowFn()),
      intent,
      contextBlock,
      liveSearchEnabled,
    });

    // DD-107 Step 2 · SSE 流式响应
    // 协议（同源 Server → Client）：
    //   event: token  data: {"delta":"..."}
    //   event: done   data: {"usage":{...}|null}
    //   event: error  data: {"code":"AI_xxx","message":"..."}
    //
    // 错误分两类：
    //   - 前置错误（zod / rate limit / context / config）→ 仍走 JSON 响应（status 4xx/5xx）
    //   - 流中错误（upstream / unknown）→ 走 SSE event=error，HTTP 200，前端 hook 解析

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const enc = new TextEncoder();
        const send = (event: string, data: unknown) => {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };
        try {
          let lastUsage: { total_tokens?: number } | undefined;
          for await (const chunk of callChatStreamFn(systemPrompt, messages)) {
            if (chunk.type === "delta") {
              send("token", { delta: chunk.text });
            } else if (chunk.type === "phase") {
              // DD-107 v3 · 暴露 AI 阶段（thinking / searching）给 UI 渲染"Thinking → Searching..."
              send("phase", { phase: chunk.phase });
            } else {
              lastUsage = chunk.usage;
              send("done", { usage: chunk.usage ?? null });
            }
          }
          console.log("[ai/chat] stream ok", {
            intent,
            ms: Date.now() - t0,
            tokens: lastUsage?.total_tokens,
          });
        } catch (e: unknown) {
          const ms = Date.now() - t0;
          if (e instanceof AiUpstreamError) {
            console.error("[ai/chat] stream upstream fail", {
              ms,
              status: e.status,
              msg: e.message,
            });
            send("error", { code: e.message, message: "AI service unavailable" });
          } else if (e instanceof AiConfigError) {
            console.error("[ai/chat] stream config fail", { ms, msg: e.message });
            send("error", { code: "AI_NOT_CONFIGURED", message: "AI service not configured" });
          } else {
            const msg = e instanceof Error ? e.message : "unknown";
            console.error("[ai/chat] stream unknown fail", { ms, msg });
            send("error", { code: "AI_INTERNAL", message: "AI internal error" });
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  };
}
