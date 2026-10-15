export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export type ProviderId = "deepseek" | "kimi" | "xai";

interface ProviderConfig {
  url: string;
  model: string;
  keyEnv: "DEEPSEEK_API_KEY" | "KIMI_API_KEY" | "XAI_API_KEY";
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  deepseek: {
    url: "https://api.deepseek.com/chat/completions",
    model: "deepseek-chat",
    keyEnv: "DEEPSEEK_API_KEY",
  },
  kimi: {
    url: "https://api.moonshot.cn/v1/chat/completions",
    model: "moonshot-v1-8k",
    keyEnv: "KIMI_API_KEY",
  },
  xai: {
    // xAI Agent Tools / Responses API（grok-4.3）
    // 2026-05 实测：旧 chat/completions + search_parameters 已下线（返回 "Live search is deprecated"），
    // 新 endpoint 走 /v1/responses + tools: [{type:"web_search"}]，body 字段从 messages → input。
    // callChat 内对 xai 做单独的请求/响应适配（其他 provider 仍走 chat/completions）。
    url: "https://api.x.ai/v1/responses",
    model: "grok-4.3",
    keyEnv: "XAI_API_KEY",
  },
};

export interface ResolvedProvider extends ProviderConfig {
  id: ProviderId;
  key: string;
}

export class AiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiConfigError";
  }
}

export class AiUpstreamError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AiUpstreamError";
    this.status = status;
  }
}

export type AiEnv = Record<string, string | undefined>;

export function getProvider(env: AiEnv = process.env): ResolvedProvider {
  const id = (env.AI_PROVIDER ?? "deepseek") as ProviderId;
  const cfg = PROVIDERS[id];
  if (!cfg) {
    throw new AiConfigError(`Unknown AI_PROVIDER: ${id}`);
  }
  const key = env[cfg.keyEnv];
  if (!key) {
    throw new AiConfigError(`Missing ${cfg.keyEnv} for provider=${id}`);
  }
  return { id, key, ...cfg };
}

interface CallChatOptions {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  maxTokens?: number;
  temperature?: number;
  env?: AiEnv;
}

export type StreamPhase = "thinking" | "searching";

export type StreamChunk =
  | { type: "delta"; text: string }
  | { type: "phase"; phase: StreamPhase }
  | { type: "done"; usage?: ChatUsage };

/**
 * DD-107 Step 2 · 流式 SSE 解析器。
 * 把 ReadableStream<Uint8Array> 转成 SSE 事件流（每个 event 含 name + data）。
 * 协议：行 `event: <name>` 后跟 `data: <payload>`，事件以空行分隔。
 */
async function* parseSse(
  body: ReadableStream<Uint8Array>
): AsyncIterable<{ event: string; data: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const raw = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      let event = "message";
      const dataLines: string[] = [];
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
      }
      if (dataLines.length > 0) yield { event, data: dataLines.join("\n") };
    }
  }
}

/**
 * DD-107 Step 2 · 统一流式接口。
 * 屏蔽 provider 差异，发出统一的 delta / done 事件。
 * - xAI：/v1/responses + tools.web_search + SSE event=response.output_text.delta
 * - DeepSeek / Kimi：OpenAI-compatible /v1/chat/completions + SSE choices[0].delta.content + [DONE]
 */
export async function* callChatStream(
  systemPrompt: string,
  messages: ChatMessage[],
  opts: CallChatOptions = {}
): AsyncIterable<StreamChunk> {
  const { fetchFn = fetch, timeoutMs = 30_000, maxTokens = 1024, temperature = 0.7, env } = opts;
  const provider = getProvider(env);
  const isXai = provider.id === "xai";

  const requestBody: Record<string, unknown> = isXai
    ? {
        model: provider.model,
        input: [{ role: "system" as const, content: systemPrompt }, ...messages],
        tools: [{ type: "web_search" }],
        max_output_tokens: maxTokens,
        temperature,
        stream: true,
      }
    : {
        model: provider.model,
        messages: [{ role: "system" as const, content: systemPrompt }, ...messages],
        max_tokens: maxTokens,
        temperature,
        stream: true,
      };

  const res = await fetchFn(provider.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.key}`,
      Accept: "text/event-stream",
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const upstreamText = await res.text().catch(() => "");
    console.error("[ai/provider] stream upstream error", {
      provider: provider.id,
      status: res.status,
      snippet: upstreamText.slice(0, 200),
    });
    const status = res.status >= 500 ? 502 : res.status;
    throw new AiUpstreamError("AI_UPSTREAM_ERROR", status);
  }
  if (!res.body) {
    throw new AiUpstreamError("AI_EMPTY_RESPONSE", 502);
  }

  let usage: ChatUsage | undefined;
  let emittedAny = false;
  for await (const ev of parseSse(res.body)) {
    if (isXai) {
      if (ev.event === "response.output_text.delta") {
        const payload = JSON.parse(ev.data) as { delta?: string };
        if (payload.delta) {
          emittedAny = true;
          yield { type: "delta", text: payload.delta };
        }
      } else if (ev.event.startsWith("response.web_search_call.")) {
        // xAI Agent Tools 事件流（实测）：
        //   response.web_search_call.in_progress / .searching → 正在调外部搜索
        //   response.web_search_call.completed                 → 搜索结束，回到推理
        // 用尾段（最后一节）判定阶段，避免与未来新增子事件冲突。
        const tail = ev.event.split(".").pop();
        yield { type: "phase", phase: tail === "completed" ? "thinking" : "searching" };
      } else if (ev.event === "response.completed") {
        const payload = JSON.parse(ev.data) as {
          response?: {
            usage?: {
              input_tokens?: number;
              output_tokens?: number;
              total_tokens?: number;
            };
          };
        };
        const u = payload.response?.usage;
        if (u) {
          usage = {
            prompt_tokens: u.input_tokens,
            completion_tokens: u.output_tokens,
            total_tokens: u.total_tokens,
          };
        }
      }
    } else {
      // OpenAI 兼容：data 是 chat.completion.chunk 或 "[DONE]"
      if (ev.data === "[DONE]") continue;
      const payload = JSON.parse(ev.data) as {
        choices?: Array<{ delta?: { content?: string } }>;
        usage?: ChatUsage;
      };
      const text = payload.choices?.[0]?.delta?.content;
      if (text) {
        emittedAny = true;
        yield { type: "delta", text };
      }
      if (payload.usage) usage = payload.usage;
    }
  }

  if (!emittedAny) {
    console.error("[ai/provider] stream emitted no deltas", { provider: provider.id });
    throw new AiUpstreamError("AI_EMPTY_RESPONSE", 502);
  }
  yield { type: "done", usage };
}

/**
 * xAI Responses API 响应解析（DD-107 ENH）。
 * data.output 是一个混合数组（reasoning / web_search_call / message），
 * 找最后一条 type==="message" 的 content[0].text 作为最终回答。
 * 引用通过 content[0].annotations[].url 给出，目前直接展平进文本不另外暴露。
 */
function parseXaiResponses(data: {
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
}): { content: string; usage?: ChatUsage } | null {
  const messages = data?.output?.filter((o) => o.type === "message") ?? [];
  const last = messages[messages.length - 1];
  const text = last?.content?.find((c) => c.type === "output_text")?.text;
  if (!text) return null;
  return {
    content: text,
    usage: {
      prompt_tokens: data.usage?.input_tokens,
      completion_tokens: data.usage?.output_tokens,
      total_tokens: data.usage?.total_tokens,
    },
  };
}

export async function callChat(
  systemPrompt: string,
  messages: ChatMessage[],
  opts: CallChatOptions = {}
): Promise<{ content: string; usage?: ChatUsage; provider: ProviderId }> {
  const { fetchFn = fetch, timeoutMs = 20_000, maxTokens = 1024, temperature = 0.7, env } = opts;
  const provider = getProvider(env);
  const isXai = provider.id === "xai";

  // DD-107 ENH · xAI Agent Tools API（/v1/responses + tools.web_search）：
  // 旧 chat/completions + search_parameters 已于 2026-05 下线。
  // 字段来源：https://docs.x.ai/docs/guides/tools/overview
  const requestBody: Record<string, unknown> = isXai
    ? {
        model: provider.model,
        input: [{ role: "system" as const, content: systemPrompt }, ...messages],
        tools: [{ type: "web_search" }],
        max_output_tokens: maxTokens,
        temperature,
      }
    : {
        model: provider.model,
        messages: [{ role: "system" as const, content: systemPrompt }, ...messages],
        max_tokens: maxTokens,
        temperature,
      };

  const res = await fetchFn(provider.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.key}`,
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const upstreamText = await res.text().catch(() => "");
    console.error("[ai/provider] upstream error", {
      provider: provider.id,
      status: res.status,
      snippet: upstreamText.slice(0, 200),
    });
    const status = res.status >= 500 ? 502 : res.status;
    throw new AiUpstreamError("AI_UPSTREAM_ERROR", status);
  }

  const data = await res.json();

  if (isXai) {
    const parsed = parseXaiResponses(data);
    if (!parsed) {
      console.error("[ai/provider] empty xai response", { provider: provider.id, data });
      throw new AiUpstreamError("AI_EMPTY_RESPONSE", 502);
    }
    return { ...parsed, provider: provider.id };
  }

  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) {
    console.error("[ai/provider] empty choices", { provider: provider.id, data });
    throw new AiUpstreamError("AI_EMPTY_RESPONSE", 502);
  }
  return { content, usage: data?.usage, provider: provider.id };
}
