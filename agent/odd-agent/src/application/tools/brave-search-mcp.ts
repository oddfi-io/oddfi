import { createHash } from "node:crypto";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";
import { silentLogger, type Logger } from "../../foundation/logger/logger-component.js";
import type { SecretProvider } from "../../infrastructure/secrets/env-secret-provider.js";

export type BraveSearchMcpToolConfig = {
  readonly enabled: boolean;
  readonly apiKeySecretRef: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly timeoutMs: number;
  readonly maxResults: number;
  readonly country: string;
  readonly searchLang: string;
  readonly uiLang: string;
  readonly safesearch: "off" | "moderate" | "strict";
};

export type BraveSearchResult = {
  readonly title: string;
  readonly url: string;
  readonly content?: string;
};

export type BraveSearchToolResult = {
  readonly query: string;
  readonly results: readonly BraveSearchResult[];
};

export type RegisteredTool = {
  readonly name: string;
  readonly description: string;
  readonly definition: ChatCompletionTool;
  readonly call: (args: unknown) => Promise<unknown>;
  readonly close?: () => Promise<void>;
};

const braveSearchToolInputSchema = z.object({
  query: z.string().min(1).max(400),
  country: z.string().min(2).max(3).optional(),
  search_lang: z.string().min(2).max(16).optional(),
  ui_lang: z.string().min(2).max(16).optional(),
  count: z.number().int().positive().max(20).optional(),
  freshness: z.string().min(1).max(64).optional(),
  safesearch: z.enum(["off", "moderate", "strict"]).optional()
});

const mcpTextContentSchema = z.object({
  type: z.literal("text"),
  text: z.string()
});

const mcpCallToolResultSchema = z.object({
  content: z.array(z.unknown()).catch([]),
  isError: z.boolean().optional()
});

const braveMcpResultItemSchema = z.object({
  title: z.string().catch(""),
  url: z.string().catch(""),
  description: z.string().optional()
});

export class BraveSearchMcpTool implements RegisteredTool {
  readonly name = "web_search";
  readonly description =
    "Search the internet through the configured Brave Search MCP server and return relevant web results.";
  readonly definition: ChatCompletionTool = {
    type: "function",
    function: {
      name: this.name,
      description: this.description,
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: {
            type: "string",
            description: "Search query for arbitrary internet information."
          },
          country: {
            type: "string",
            description: "Optional Brave country code such as US, GB, CN, or ALL."
          },
          search_lang: {
            type: "string",
            description: "Optional Brave search language such as en or zh-hans."
          },
          ui_lang: {
            type: "string",
            description: "Optional Brave UI language such as en-US or zh-CN."
          },
          count: {
            type: "integer",
            description: "Optional result count from 1 to 20."
          },
          freshness: {
            type: "string",
            description: "Optional freshness filter such as pd, pw, pm, py, or a date range."
          },
          safesearch: {
            type: "string",
            enum: ["off", "moderate", "strict"],
            description: "Optional safe search level."
          }
        },
        required: ["query"]
      }
    }
  };

  readonly #config: BraveSearchMcpToolConfig;
  readonly #secretProvider: SecretProvider;
  readonly #logger: Logger;
  #client: Client | undefined;
  #connectPromise: Promise<Client> | undefined;

  /**
   * 调用流程：创建 Brave Search MCP web_search 工具。
   * 入参：Brave MCP 配置、secret provider 和可选 logger。
   * 出参：可注册到 Chat LLM 的 OpenAI-compatible function tool。
   */
  constructor(
    config: BraveSearchMcpToolConfig,
    secretProvider: SecretProvider,
    logger: Logger = silentLogger
  ) {
    this.#config = config;
    this.#secretProvider = secretProvider;
    this.#logger = logger;
  }

  /**
   * 调用流程：执行一次 Brave MCP 搜索。
   * 入参：LLM tool call 传入的 JSON 参数，必须满足 query/country/search_lang 等 schema。
   * 出参：已归一化、字段受限的搜索结果。
   *
   * 实现方式：先确保 MCP stdio client 已连接，再调用 MCP server 的 brave_web_search；MCP 返回的
   * text 内容逐条按 JSON 解析，最后只保留 title/url/content，避免原始 payload 注入 LLM。
   */
  async call(args: unknown): Promise<BraveSearchToolResult> {
    const input = braveSearchToolInputSchema.parse(args);
    const startedAt = Date.now();
    this.#logger.info("tool.brave_search_mcp.search_started", {
      bounded_context: "chat_agent",
      tool_name: this.name,
      query_hash: hashText(input.query)
    });

    try {
      const client = await this.#connect();
      const result = await client.callTool(
        {
          name: "brave_web_search",
          arguments: {
            query: input.query,
            country: input.country ?? this.#config.country,
            search_lang: input.search_lang ?? this.#config.searchLang,
            ui_lang: input.ui_lang ?? this.#config.uiLang,
            count: Math.min(input.count ?? this.#config.maxResults, this.#config.maxResults),
            safesearch: input.safesearch ?? this.#config.safesearch,
            ...(input.freshness === undefined ? {} : { freshness: input.freshness })
          }
        },
        undefined,
        { timeout: this.#config.timeoutMs }
      );
      const results = normalizeMcpSearchResults(result).slice(0, this.#config.maxResults);
      this.#logger.info("tool.brave_search_mcp.search_succeeded", {
        bounded_context: "chat_agent",
        tool_name: this.name,
        duration_ms: Date.now() - startedAt,
        result_count: results.length
      });
      return { query: input.query, results };
    } catch (cause) {
      this.#logger.error("tool.brave_search_mcp.search_failed", {
        bounded_context: "chat_agent",
        tool_name: this.name,
        duration_ms: Date.now() - startedAt,
        error: normalizeError(cause)
      });
      throw cause;
    }
  }

  /**
   * 调用流程：关闭 MCP client 和底层 stdio transport。
   * 入参：无。
   * 出参：Promise 完成表示子进程已关闭。
   */
  async close(): Promise<void> {
    await this.#client?.close();
    this.#client = undefined;
    this.#connectPromise = undefined;
  }

  /**
   * 调用流程：懒连接 Brave Search MCP server。
   * 入参：无。
   * 出参：已完成 initialize 的 MCP Client。
   *
   * 实现方式：首次调用时读取 secret，启动配置指定的 stdio command；并发调用复用同一个
   * connectPromise，避免重复拉起多个 MCP 子进程。
   */
  async #connect(): Promise<Client> {
    if (this.#client !== undefined) {
      return this.#client;
    }
    this.#connectPromise ??= this.#createClient();
    return this.#connectPromise;
  }

  /**
   * 调用流程：创建并连接 MCP client。
   * 入参：无；从配置读取 command/args，从 secret provider 读取 BRAVE_API_KEY。
   * 出参：已连接的 MCP Client。
   */
  async #createClient(): Promise<Client> {
    // secret 只从受控 secret provider 读取，并只通过 MCP 子进程环境变量传递，不进入 prompt 或日志。
    const apiKey = await this.#secretProvider.getSecret(this.#config.apiKeySecretRef);
    const transport = new StdioClientTransport({
      command: this.#config.command,
      args: [...this.#config.args],
      env: { ...getDefaultEnvironment(), BRAVE_API_KEY: apiKey },
      stderr: "pipe"
    });

    // 连接后立即检查 MCP server 暴露的工具名，配置错误时 fail-fast，避免运行中才发现 tool 不可用。
    const client = new Client({ name: "odd-agent", version: "0.1.0" });
    await client.connect(transport, { timeout: this.#config.timeoutMs });
    const tools = await client.listTools(undefined, { timeout: this.#config.timeoutMs });
    if (!tools.tools.some((tool) => tool.name === "brave_web_search")) {
      await client.close();
      throw new Error("Brave MCP server does not expose brave_web_search");
    }
    this.#client = client;
    return client;
  }
}

/**
 * 调用流程：渲染注册工具 prompt。
 * 入参：已注册工具列表和本次请求最大工具调用次数。
 * 出参：放入 Chat prompt 的工具说明文本。
 */
export const formatRegisteredToolsPrompt = (
  tools: readonly RegisteredTool[],
  maxToolCalls: number
): string => {
  const payload = {
    max_tool_calls: maxToolCalls,
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description
    }))
  };
  return `<registered_tools>\n${JSON.stringify(payload, null, 2)}\n</registered_tools>`;
};

/**
 * 调用流程：按工具名索引已注册工具。
 * 入参：工具列表。
 * 出参：工具名到工具实例的 Map。
 */
export const indexRegisteredTools = (
  tools: readonly RegisteredTool[]
): ReadonlyMap<string, RegisteredTool> => new Map(tools.map((tool) => [tool.name, tool]));

/**
 * 调用流程：把 MCP tool result 归一化为搜索结果。
 * 入参：MCP client.callTool 返回值。
 * 出参：可回填给 LLM 的 title/url/content 列表。
 */
const normalizeMcpSearchResults = (value: unknown): BraveSearchResult[] => {
  const parsed = mcpCallToolResultSchema.parse(value);
  if (parsed.isError === true) {
    throw new Error("Brave MCP search returned an error result");
  }
  return parsed.content.flatMap((item) => {
    const content = mcpTextContentSchema.safeParse(item);
    if (!content.success) {
      return [];
    }
    return normalizeMcpTextItem(content.data.text);
  });
};

/**
 * 调用流程：解析 MCP text item。
 * 入参：MCP server 返回的 text，通常是一条 JSON 字符串。
 * 出参：单条搜索结果；非法 JSON 或空 title/url 返回空数组。
 */
const normalizeMcpTextItem = (text: string): BraveSearchResult[] => {
  const parsedJson = parseJsonObject(text);
  const parsed = braveMcpResultItemSchema.safeParse(parsedJson);
  if (!parsed.success || parsed.data.title.length === 0 || parsed.data.url.length === 0) {
    return [];
  }
  return [
    {
      title: parsed.data.title,
      url: parsed.data.url,
      ...(parsed.data.description === undefined ? {} : { content: parsed.data.description })
    }
  ];
};

/**
 * 调用流程：安全解析 JSON object。
 * 入参：MCP text 字符串。
 * 出参：解析成功返回 unknown object，失败返回空对象供 schema 拒绝。
 */
const parseJsonObject = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
};

/**
 * 调用流程：生成搜索词的短 hash。
 * 入参：原始 query，可能包含用户文本。
 * 出参：日志可用的短 hash；避免直接记录敏感 query。
 */
const hashText = (value: string): string =>
  createHash("sha256").update(value).digest("hex").slice(0, 16);

/**
 * 调用流程：把未知错误转换为可记录的短对象。
 * 入参：catch 捕获的任意错误。
 * 出参：不包含 secret 或原始搜索响应的日志字段。
 */
const normalizeError = (cause: unknown): Record<string, unknown> =>
  cause instanceof Error
    ? { name: cause.name, message: cause.message, code: "code" in cause ? cause.code : undefined }
    : { message: String(cause) };
