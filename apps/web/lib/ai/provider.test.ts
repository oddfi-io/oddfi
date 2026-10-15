import { describe, it, expect, vi } from "vitest";
import {
  AiConfigError,
  AiUpstreamError,
  PROVIDERS,
  callChat,
  getProvider,
  type AiEnv,
} from "./provider";

describe("getProvider", () => {
  it("defaults to deepseek when AI_PROVIDER unset", () => {
    const p = getProvider({ DEEPSEEK_API_KEY: "sk-test" });
    expect(p.id).toBe("deepseek");
    expect(p.url).toBe(PROVIDERS.deepseek.url);
    expect(p.model).toBe("deepseek-chat");
  });

  it("switches to kimi when AI_PROVIDER=kimi", () => {
    const p = getProvider({ AI_PROVIDER: "kimi", KIMI_API_KEY: "sk-k" });
    expect(p.id).toBe("kimi");
    expect(p.model).toBe("moonshot-v1-8k");
  });

  it("switches to xai (Grok) when AI_PROVIDER=xai", () => {
    const p = getProvider({ AI_PROVIDER: "xai", XAI_API_KEY: "xai-x" });
    expect(p.id).toBe("xai");
    expect(p.url).toBe(PROVIDERS.xai.url);
    expect(p.model).toBe("grok-4.3");
  });

  it("throws AiConfigError when key missing", () => {
    expect(() => getProvider({ AI_PROVIDER: "deepseek" })).toThrow(AiConfigError);
  });

  it("throws AiConfigError for unknown provider id", () => {
    expect(() => getProvider({ AI_PROVIDER: "openai" } as AiEnv)).toThrow(AiConfigError);
  });
});

describe("callChat", () => {
  const env: AiEnv = { DEEPSEEK_API_KEY: "sk-test" };

  it("posts to provider url with bearer auth and returns content", async () => {
    let capturedUrl: string | undefined;
    let capturedInit: RequestInit | undefined;
    const fetchFn: typeof fetch = async (input, init) => {
      capturedUrl = input as string;
      capturedInit = init;
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "hello" } }],
          usage: { total_tokens: 12 },
        }),
        { status: 200 }
      );
    };
    const out = await callChat("sys", [{ role: "user", content: "hi" }], {
      fetchFn,
      env,
    });
    expect(out.content).toBe("hello");
    expect(out.provider).toBe("deepseek");
    expect(out.usage?.total_tokens).toBe(12);
    expect(capturedUrl).toBe(PROVIDERS.deepseek.url);
    expect(capturedInit?.headers).toMatchObject({ Authorization: "Bearer sk-test" });
    const body = JSON.parse(String(capturedInit?.body));
    expect(body.messages[0]).toEqual({ role: "system", content: "sys" });
    expect(body.messages[1]).toEqual({ role: "user", content: "hi" });
    expect(body.max_tokens).toBe(1024);
  });

  it("throws AiUpstreamError on non-2xx", async () => {
    const fetchFn = vi.fn(async () => new Response("oops", { status: 503 }));
    await expect(
      callChat("sys", [{ role: "user", content: "x" }], {
        fetchFn: fetchFn as unknown as typeof fetch,
        env,
      })
    ).rejects.toMatchObject({ name: "AiUpstreamError", status: 502 });
  });

  it("xai uses /v1/responses with input + tools.web_search (DD-107 ENH Agent Tools)", async () => {
    let capturedUrl: string | undefined;
    let capturedBody: Record<string, unknown> | undefined;
    const fetchFn: typeof fetch = async (input, init) => {
      capturedUrl = input as string;
      capturedBody = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          output: [
            { type: "reasoning", summary: [{ text: "thinking…" }] },
            {
              type: "message",
              role: "assistant",
              content: [{ type: "output_text", text: "PSG vs Arsenal" }],
            },
          ],
          usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 },
        }),
        { status: 200 }
      );
    };
    const out = await callChat("sys", [{ role: "user", content: "hi" }], {
      fetchFn,
      env: { AI_PROVIDER: "xai", XAI_API_KEY: "xai-x" },
    });
    expect(capturedUrl).toBe("https://api.x.ai/v1/responses");
    expect(capturedBody).toMatchObject({
      input: [
        { role: "system", content: "sys" },
        { role: "user", content: "hi" },
      ],
      tools: [{ type: "web_search" }],
    });
    expect(capturedBody).not.toHaveProperty("messages");
    expect(out.content).toBe("PSG vs Arsenal");
    expect(out.usage?.total_tokens).toBe(120);
  });

  it("non-xai providers keep messages + no tools (chat completions endpoint)", async () => {
    let capturedBody: Record<string, unknown> | undefined;
    const fetchFn: typeof fetch = async (_input, init) => {
      capturedBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
        status: 200,
      });
    };
    await callChat("sys", [{ role: "user", content: "hi" }], { fetchFn, env });
    expect(capturedBody).toHaveProperty("messages");
    expect(capturedBody).not.toHaveProperty("input");
    expect(capturedBody).not.toHaveProperty("tools");
  });

  it("xai throws AI_EMPTY_RESPONSE when output[] has no message", async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(JSON.stringify({ output: [{ type: "reasoning" }] }), { status: 200 });
    await expect(
      callChat("sys", [{ role: "user", content: "x" }], {
        fetchFn,
        env: { AI_PROVIDER: "xai", XAI_API_KEY: "xai-x" },
      })
    ).rejects.toMatchObject({ message: "AI_EMPTY_RESPONSE" });
  });

  it("throws AiUpstreamError on empty choices", async () => {
    const fetchFn = vi.fn(
      async () => new Response(JSON.stringify({ choices: [] }), { status: 200 })
    );
    await expect(
      callChat("sys", [{ role: "user", content: "x" }], {
        fetchFn: fetchFn as unknown as typeof fetch,
        env,
      })
    ).rejects.toBeInstanceOf(AiUpstreamError);
  });
});
