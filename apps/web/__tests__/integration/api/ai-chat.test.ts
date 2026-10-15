import { describe, it, expect, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { buildPostHandler } from "@/app/api/ai/chat/handler";
import {
  AiConfigError,
  AiUpstreamError,
  type StreamChunk,
  type callChatStream,
} from "@/lib/ai/provider";
import { createMemoryLimiter } from "@/lib/ai/rate-limit";
import { ContextUnavailableError } from "@/lib/ai/context/match-context";

function makeReq(body: unknown, headers: Record<string, string> = {}): NextRequest {
  const req = new Request("http://localhost/api/ai/chat", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return req as unknown as NextRequest;
}

/**
 * Test helper：返回一个发出固定 delta 列表 + done 的流式 mock。
 */
function okStream(text = "hello"): typeof callChatStream {
  return async function* mockStream(): AsyncIterable<StreamChunk> {
    yield { type: "delta", text };
    yield { type: "done", usage: { total_tokens: 10 } };
  } as unknown as typeof callChatStream;
}

/** 解析 SSE Response.body 为事件数组（test-only helper） */
async function consumeSse(res: Response): Promise<Array<{ event: string; data: string }>> {
  const text = await res.text();
  const events: Array<{ event: string; data: string }> = [];
  for (const raw of text.split("\n\n")) {
    if (!raw.trim()) continue;
    let event = "message";
    const dataLines: string[] = [];
    for (const line of raw.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }
    events.push({ event, data: dataLines.join("\n") });
  }
  return events;
}

const fixedNow = () => new Date("2026-05-19T03:00:00Z");

describe("POST /api/ai/chat (SSE)", () => {
  let limiter: ReturnType<typeof createMemoryLimiter>;

  beforeEach(() => {
    limiter = createMemoryLimiter();
  });

  // ─── 前置错误（JSON 响应路径）─────────────────────────────────────

  it("400 on non-JSON body (pre-stream error stays JSON)", async () => {
    const POST = buildPostHandler({ limiter, callChatStreamImpl: okStream(), now: fixedNow });
    const res = await POST(makeReq("not-json"));
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toContain("application/json");
    const json = await res.json();
    expect(json.code).toBe("AI_BAD_REQUEST");
  });

  it("400 when schema rejects (role=system)", async () => {
    const POST = buildPostHandler({ limiter, callChatStreamImpl: okStream(), now: fixedNow });
    const res = await POST(makeReq({ messages: [{ role: "system", content: "evil" }] }));
    expect(res.status).toBe(400);
  });

  it("429 after exceeding anon IP quota (5/min)", async () => {
    const POST = buildPostHandler({ limiter, callChatStreamImpl: okStream(), now: fixedNow });
    const headers = { "x-forwarded-for": "5.5.5.5" };
    for (let i = 0; i < 5; i++) {
      const res = await POST(makeReq({ messages: [{ role: "user", content: `m${i}` }] }, headers));
      expect(res.status).toBe(200);
    }
    const blocked = await POST(makeReq({ messages: [{ role: "user", content: "m6" }] }, headers));
    expect(blocked.status).toBe(429);
    const json = await blocked.json();
    expect(json.code).toBe("AI_RATE_LIMITED");
  });

  // ─── 成功路径（SSE 响应）─────────────────────────────────────────

  it("200 SSE with token+done events on free-chat happy path", async () => {
    const stream: typeof callChatStream = async function* () {
      yield { type: "delta", text: "Hello" } as const;
      yield { type: "delta", text: " world" } as const;
      yield { type: "done", usage: { total_tokens: 42 } } as const;
    } as unknown as typeof callChatStream;
    const POST = buildPostHandler({ limiter, callChatStreamImpl: stream, now: fixedNow });
    const res = await POST(
      makeReq({ messages: [{ role: "user", content: "hi" }] }, { "x-forwarded-for": "1.2.3.4" })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const events = await consumeSse(res);
    expect(events.map((e) => e.event)).toEqual(["token", "token", "done"]);
    expect(JSON.parse(events[0]!.data)).toEqual({ delta: "Hello" });
    expect(JSON.parse(events[1]!.data)).toEqual({ delta: " world" });
    expect(JSON.parse(events[2]!.data)).toEqual({ usage: { total_tokens: 42 } });
  });

  // ─── 流中错误（SSE event=error，HTTP 200）─────────────────────────

  it("emits SSE event=error AI_UPSTREAM_ERROR when stream throws upstream", async () => {
    const stream: typeof callChatStream = async function* () {
      throw new AiUpstreamError("AI_UPSTREAM_ERROR", 502);
    } as unknown as typeof callChatStream;
    const POST = buildPostHandler({ limiter, callChatStreamImpl: stream, now: fixedNow });
    const res = await POST(makeReq({ messages: [{ role: "user", content: "x" }] }));
    expect(res.status).toBe(200);
    const events = await consumeSse(res);
    expect(events).toHaveLength(1);
    expect(events[0]!.event).toBe("error");
    expect(JSON.parse(events[0]!.data).code).toBe("AI_UPSTREAM_ERROR");
  });

  it("emits SSE event=error AI_NOT_CONFIGURED on config error", async () => {
    const stream: typeof callChatStream = async function* () {
      throw new AiConfigError("Missing DEEPSEEK_API_KEY");
    } as unknown as typeof callChatStream;
    const POST = buildPostHandler({ limiter, callChatStreamImpl: stream, now: fixedNow });
    const res = await POST(makeReq({ messages: [{ role: "user", content: "x" }] }));
    expect(res.status).toBe(200);
    const events = await consumeSse(res);
    expect(events[0]!.event).toBe("error");
    expect(JSON.parse(events[0]!.data).code).toBe("AI_NOT_CONFIGURED");
  });

  // ─── DD-107 v2: intent / matchId / context ───────────────────────

  it("400 when intent=match-analysis without matchId", async () => {
    const POST = buildPostHandler({ limiter, callChatStreamImpl: okStream(), now: fixedNow });
    const res = await POST(
      makeReq({
        messages: [{ role: "user", content: "go" }],
        intent: "match-analysis",
      })
    );
    expect(res.status).toBe(400);
  });

  it("400 when matchId is non-numeric (SSRF defense)", async () => {
    const POST = buildPostHandler({ limiter, callChatStreamImpl: okStream(), now: fixedNow });
    const res = await POST(
      makeReq({
        messages: [{ role: "user", content: "go" }],
        intent: "match-analysis",
        matchId: "../admin",
      })
    );
    expect(res.status).toBe(400);
  });

  it("503 AI_CONTEXT_UNAVAILABLE when buildMatchContext throws (no stream)", async () => {
    let streamCalls = 0;
    const stream: typeof callChatStream = async function* () {
      streamCalls += 1;
      yield { type: "delta", text: "x" };
    } as unknown as typeof callChatStream;
    const POST = buildPostHandler({
      limiter,
      callChatStreamImpl: stream,
      buildMatchContextImpl: async () => {
        throw new ContextUnavailableError();
      },
      now: fixedNow,
    });
    const res = await POST(
      makeReq({
        messages: [{ role: "user", content: "analyze it" }],
        intent: "match-analysis",
        matchId: "12345",
      })
    );
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.code).toBe("AI_CONTEXT_UNAVAILABLE");
    expect(streamCalls).toBe(0); // 不调 LLM
  });

  it("200 SSE on match-analysis success with injected CONTEXT in system prompt", async () => {
    let capturedSystem: string | null = null;
    const stream: typeof callChatStream = async function* (systemPrompt: string) {
      capturedSystem = systemPrompt;
      yield { type: "delta", text: "ok" };
      yield { type: "done" };
    } as unknown as typeof callChatStream;
    const POST = buildPostHandler({
      limiter,
      callChatStreamImpl: stream,
      buildMatchContextImpl: async () => `<CONTEXT type="match-analysis">FOO</CONTEXT>`,
      now: fixedNow,
    });
    const res = await POST(
      makeReq({
        messages: [{ role: "user", content: "analyze it" }],
        intent: "match-analysis",
        matchId: "12345",
      })
    );
    expect(res.status).toBe(200);
    const events = await consumeSse(res);
    expect(events.map((e) => e.event)).toEqual(["token", "done"]);
    expect(capturedSystem).toContain("FOO");
    expect(capturedSystem).toContain("强制结构");
    expect(capturedSystem).toContain("2026-05-19");
  });

  it("429 on match-analysis sub-quota (anon 5/5 = 1 match-analysis/min)", async () => {
    const POST = buildPostHandler({
      limiter,
      callChatStreamImpl: okStream(),
      buildMatchContextImpl: async () => `<CONTEXT>X</CONTEXT>`,
      now: fixedNow,
    });
    const headers = { "x-forwarded-for": "8.8.8.8" };
    const body = {
      messages: [{ role: "user", content: "go" }],
      intent: "match-analysis",
      matchId: "12345",
    };
    const first = await POST(makeReq(body, headers));
    expect(first.status).toBe(200);
    const blocked = await POST(makeReq(body, headers));
    expect(blocked.status).toBe(429);
    const json = await blocked.json();
    expect(String(json.message)).toContain("match-analysis");
  });

  it("free-chat default uses empty CONTEXT block (no match data leak)", async () => {
    let capturedSystem: string | null = null;
    const stream: typeof callChatStream = async function* (systemPrompt: string) {
      capturedSystem = systemPrompt;
      yield { type: "delta", text: "ok" };
      yield { type: "done" };
    } as unknown as typeof callChatStream;
    const POST = buildPostHandler({
      limiter,
      callChatStreamImpl: stream,
      now: fixedNow,
    });
    await POST(makeReq({ messages: [{ role: "user", content: "hi" }] }));
    expect(capturedSystem).toContain('type="free-chat"');
    expect(capturedSystem).not.toContain("强制结构");
  });
});
