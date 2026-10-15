// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

import { useAiChat } from "./useAiChat";
import { useAiChatSessionStore } from "@/stores/aiChatSessionStore";

function resetStore() {
  localStorage.clear();
  useAiChatSessionStore.setState({
    isOpen: false,
    activeTab: "chat",
    messages: [],
    hydrated: false,
  });
}

/** Construct a fake SSE Response delivering `content` as 1 token + done. */
function sseResponse(content = "hello") {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(enc.encode(`event: token\ndata: ${JSON.stringify({ delta: content })}\n\n`));
      c.enqueue(enc.encode(`event: done\ndata: {}\n\n`));
      c.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

/** SSE Response that yields `event: error` (HTTP 200, in-stream error) */
function sseErrorResponse(code: string) {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(enc.encode(`event: error\ndata: ${JSON.stringify({ code })}\n\n`));
      c.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

describe("useAiChat", () => {
  beforeEach(resetStore);

  it("send appends user msg + ok assistant on 200", async () => {
    const fetchFn = (async () => sseResponse("answer")) as unknown as typeof fetch;
    const { result } = renderHook(() => useAiChat({ fetchFn }));
    await act(async () => {
      await result.current.send("hi");
    });
    const msgs = useAiChatSessionStore.getState().messages;
    expect(msgs.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(msgs[0]!.content).toBe("hi");
    expect(msgs[1]!.content).toBe("answer");
    expect(msgs[1]!.status).toBe("ok");
  });

  it("send marks assistant as error on non-2xx", async () => {
    const fetchFn = (async () =>
      new Response(JSON.stringify({ code: "AI_RATE_LIMITED" }), {
        status: 429,
      })) as unknown as typeof fetch;
    const { result } = renderHook(() => useAiChat({ fetchFn }));
    await act(async () => {
      await result.current.send("hi");
    });
    const assistant = useAiChatSessionStore.getState().messages[1]!;
    expect(assistant.status).toBe("error");
    expect(assistant.errorCode).toBe("AI_RATE_LIMITED");
  });

  it("send caps context window at 20 messages in request body", async () => {
    let capturedBody: { messages: unknown[] } | null = null;
    const fetchFn = (async (_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body)) as { messages: unknown[] };
      return sseResponse("ok");
    }) as unknown as typeof fetch;

    // 预置 25 条历史
    const { appendMessage } = useAiChatSessionStore.getState();
    for (let i = 0; i < 25; i++) {
      appendMessage({
        id: `h${i}`,
        role: i % 2 === 0 ? "user" : "assistant",
        content: `m${i}`,
        createdAt: i,
        status: "ok",
      });
    }
    const { result } = renderHook(() => useAiChat({ fetchFn }));
    await act(async () => {
      await result.current.send("new");
    });
    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.messages.length).toBe(20);
  });

  it("rejects empty input", async () => {
    const fetchFn = (async () => sseResponse("nope")) as unknown as typeof fetch;
    const { result } = renderHook(() => useAiChat({ fetchFn }));
    let res: { ok: boolean; errorCode?: string } = { ok: true };
    await act(async () => {
      res = await result.current.send("   ");
    });
    expect(res.ok).toBe(false);
    expect(res.errorCode).toBe("EMPTY_INPUT");
    expect(useAiChatSessionStore.getState().messages).toHaveLength(0);
  });

  it("excludes pending / error / empty-content history from request body", async () => {
    // 复现 bug：localStorage 残留 pending（content=""）+ error → 旧版本被一并发出，server zod 拒为 400
    let capturedBody: { messages: { role: string; content: string }[] } | null = null;
    const fetchFn = (async (_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body)) as typeof capturedBody;
      return sseResponse("answer");
    }) as unknown as typeof fetch;

    const { appendMessage } = useAiChatSessionStore.getState();
    appendMessage({
      id: "stale-pending",
      role: "assistant",
      content: "",
      createdAt: 1,
      status: "pending",
    });
    appendMessage({
      id: "stale-error",
      role: "assistant",
      content: "broken",
      createdAt: 2,
      status: "error",
      errorCode: "NETWORK_ERROR",
    });

    const { result } = renderHook(() => useAiChat({ fetchFn }));
    await act(async () => {
      await result.current.send("hi");
    });

    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.messages).toEqual([{ role: "user", content: "hi" }]);
  });

  it("streams deltas → message.content grows incrementally → final status=ok (DD-107 Step 2)", async () => {
    const enc = new TextEncoder();
    const fetchFn = (async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(enc.encode(`event: token\ndata: {"delta":"Hello"}\n\n`));
          c.enqueue(enc.encode(`event: token\ndata: {"delta":" "}\n\n`));
          c.enqueue(enc.encode(`event: token\ndata: {"delta":"world"}\n\n`));
          c.enqueue(enc.encode(`event: done\ndata: {}\n\n`));
          c.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    }) as unknown as typeof fetch;
    const { result } = renderHook(() => useAiChat({ fetchFn }));
    await act(async () => {
      await result.current.send("hi");
    });
    const assistant = useAiChatSessionStore.getState().messages[1]!;
    expect(assistant.status).toBe("ok");
    expect(assistant.content).toBe("Hello world");
  });

  it("SSE event=error → message.status=error with code (DD-107 Step 2)", async () => {
    const fetchFn = (async () => sseErrorResponse("AI_UPSTREAM_ERROR")) as unknown as typeof fetch;
    const { result } = renderHook(() => useAiChat({ fetchFn }));
    await act(async () => {
      await result.current.send("hi");
    });
    const assistant = useAiChatSessionStore.getState().messages[1]!;
    expect(assistant.status).toBe("error");
    expect(assistant.errorCode).toBe("AI_UPSTREAM_ERROR");
  });

  it("DD-120: match-analysis send 给 assistant 盖 recommendation.matchId", async () => {
    const fetchFn = (async () => sseResponse("analysis")) as unknown as typeof fetch;
    const { result } = renderHook(() => useAiChat({ fetchFn }));
    await act(async () => {
      await result.current.send("分析", { intent: "match-analysis", matchId: "9001" });
    });
    const assistant = useAiChatSessionStore.getState().messages[1]!;
    expect(assistant.status).toBe("ok");
    expect(assistant.recommendation).toEqual({ matchId: "9001" });
  });

  it("DD-136: match-analysis 流含 oddfi-picks 块 → content 剥离协议块 + recommendation.picks 回填", async () => {
    const picksBlock = `\`\`\`oddfi-picks\n{"picks":[{"market":"1x2","side":"Away","confidence":"high","reason":"客队状态佳"},{"market":"asian_total","side":"Over","confidence":"mid"}]}\n\`\`\``;
    const fetchFn = (async () =>
      sseResponse(`分析正文\n\n> ⚠️ 仅供参考\n\n${picksBlock}`)) as unknown as typeof fetch;
    const { result } = renderHook(() => useAiChat({ fetchFn }));
    await act(async () => {
      await result.current.send("分析", { intent: "match-analysis", matchId: "9001" });
    });
    const assistant = useAiChatSessionStore.getState().messages[1]!;
    expect(assistant.status).toBe("ok");
    expect(assistant.content).not.toContain("oddfi-picks");
    expect(assistant.content).toContain("分析正文");
    expect(assistant.recommendation?.matchId).toBe("9001");
    expect(assistant.recommendation?.picks).toHaveLength(2);
    expect(assistant.recommendation?.picks?.[0]?.side).toBe("Away");
  });

  it("DD-136: picks 块坏 JSON → 块仍剥离，recommendation 保留但无 picks（渲染层兜底）", async () => {
    const fetchFn = (async () =>
      sseResponse(`正文\n\n\`\`\`oddfi-picks\n{BROKEN\n\`\`\``)) as unknown as typeof fetch;
    const { result } = renderHook(() => useAiChat({ fetchFn }));
    await act(async () => {
      await result.current.send("分析", { intent: "match-analysis", matchId: "9001" });
    });
    const assistant = useAiChatSessionStore.getState().messages[1]!;
    expect(assistant.content).toBe("正文");
    expect(assistant.recommendation).toEqual({ matchId: "9001" });
  });

  it("DD-136: free-chat 流里出现 picks 块 → 剥离但不创建 recommendation", async () => {
    const fetchFn = (async () =>
      sseResponse(
        `回答\n\n\`\`\`oddfi-picks\n{"picks":[{"market":"1x2","side":"Home","confidence":"high"}]}\n\`\`\``
      )) as unknown as typeof fetch;
    const { result } = renderHook(() => useAiChat({ fetchFn }));
    await act(async () => {
      await result.current.send("hi");
    });
    const assistant = useAiChatSessionStore.getState().messages[1]!;
    expect(assistant.content).toBe("回答");
    expect(assistant.recommendation).toBeUndefined();
  });

  it("REV-v1-A M-1: retry 后新流无 picks 块 → 旧 picks 不残留（仅保留 matchId）", async () => {
    const picksBlock = `\`\`\`oddfi-picks\n{"picks":[{"market":"1x2","side":"Home","confidence":"high"}]}\n\`\`\``;
    let call = 0;
    const fetchFn = (async () => {
      call += 1;
      // 第一次：带 picks 块；retry：无 picks 块（模拟解析失败/LLM 未输出）
      return call === 1 ? sseResponse(`正文A\n\n${picksBlock}`) : sseResponse("正文B 无协议块");
    }) as unknown as typeof fetch;
    const { result } = renderHook(() => useAiChat({ fetchFn }));
    await act(async () => {
      await result.current.send("分析", { intent: "match-analysis", matchId: "9001" });
    });
    expect(useAiChatSessionStore.getState().messages[1]!.recommendation?.picks).toHaveLength(1);

    const assistantId = useAiChatSessionStore.getState().messages[1]!.id;
    await act(async () => {
      await result.current.retry(assistantId);
    });
    const after = useAiChatSessionStore.getState().messages[1]!;
    expect(after.content).toBe("正文B 无协议块");
    expect(after.recommendation).toEqual({ matchId: "9001" }); // 旧 picks 已清除
  });

  it("DD-120: 普通 send（无 intent）不盖 recommendation", async () => {
    const fetchFn = (async () => sseResponse("hi")) as unknown as typeof fetch;
    const { result } = renderHook(() => useAiChat({ fetchFn }));
    await act(async () => {
      await result.current.send("hello");
    });
    expect(useAiChatSessionStore.getState().messages[1]!.recommendation).toBeUndefined();
  });

  it("DD-120: retry 不传 sendOpts，recommendation 仍保留（复用同消息对象）", async () => {
    let calls = 0;
    const fetchFn = (async () => {
      calls += 1;
      if (calls === 1) return new Response("oops", { status: 502 });
      return sseResponse("recovered");
    }) as unknown as typeof fetch;
    const { result } = renderHook(() => useAiChat({ fetchFn }));
    await act(async () => {
      await result.current.send("分析", { intent: "match-analysis", matchId: "9002" });
    });
    const errId = useAiChatSessionStore.getState().messages[1]!.id;
    await act(async () => {
      await result.current.retry(errId);
    });
    await waitFor(() => {
      const m = useAiChatSessionStore.getState().messages.find((x) => x.id === errId);
      expect(m?.status).toBe("ok");
      expect(m?.recommendation).toEqual({ matchId: "9002" });
    });
  });

  it("retry re-posts and turns error into ok", async () => {
    let calls = 0;
    const fetchFn = (async () => {
      calls += 1;
      if (calls === 1) return new Response("oops", { status: 502 });
      return sseResponse("recovered");
    }) as unknown as typeof fetch;
    const { result } = renderHook(() => useAiChat({ fetchFn }));
    await act(async () => {
      await result.current.send("hi");
    });
    const errId = useAiChatSessionStore.getState().messages[1]!.id;
    await act(async () => {
      await result.current.retry(errId);
    });
    await waitFor(() => {
      const m = useAiChatSessionStore.getState().messages.find((x) => x.id === errId);
      expect(m?.status).toBe("ok");
      expect(m?.content).toBe("recovered");
    });
  });
});
