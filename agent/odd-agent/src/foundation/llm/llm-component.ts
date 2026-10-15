import OpenAI from "openai";
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming
} from "openai/resources/chat/completions";
import type { Stream } from "openai/core/streaming";
import type {
  FoundationComponent,
  FoundationHealth,
  FoundationInitDeps
} from "../foundation-types.js";
import {
  createFoundationError,
  normalizeError,
  nowIso,
  requireFoundationLogger,
  resolveSecret
} from "../foundation-types.js";
import type { LoggerComponent } from "../logger/logger-component.js";

export type LlmConfig = {
  readonly model: string;
  readonly modelTier: "cheap" | "standard" | "strong";
  readonly baseUrl?: string;
  readonly apiKeySecretRef: string;
  readonly temperature: number;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly defaultHeaders?: Record<string, string>;
  readonly logMessages?: boolean;
};

/**
 * OpenAI Chat Completions 的最小客户端接口。
 *
 * 调用方通过 `model` 和 `temperature` 读取组件初始化时固定的默认模型参数；通过 `create`
 * 发起非流式请求，通过 `stream` 发起流式请求，参数完全沿用 OpenAI SDK 类型。
 */
export type OpenAiChatCompletionClient = {
  readonly model: string;
  readonly temperature: number;
  create(params: ChatCompletionCreateParamsNonStreaming): Promise<ChatCompletion>;
  stream(
    params: ChatCompletionCreateParamsStreaming
  ): Promise<Stream<OpenAI.Chat.Completions.ChatCompletionChunk>>;
};

export type LlmComponent = FoundationComponent<LlmConfig> & {
  readonly client: OpenAI;
  readonly chatCompletions: OpenAiChatCompletionClient;
};

/**
 * Foundation LLM 的 OpenAI SDK 轻封装。
 *
 * 组件只负责 OpenAI-compatible client 初始化、secret 解析、统一日志和 timeout/retry 配置。
 * Chat Completions 的 tools、function calling、structured output、streaming 等参数保持 OpenAI
 * 原生形态，由调用方直接传给 `chatCompletions.create()` 或 `chatCompletions.stream()`。
 */
export class OpenAiLlmComponent implements LlmComponent {
  #config: LlmConfig | undefined;
  #logger: LoggerComponent | undefined;
  #client: OpenAI | undefined;

  /**
   * 初始化 OpenAI SDK client。
   *
   * @param config LLM 配置；`baseUrl` 用于 MiniMax 等 OpenAI-compatible endpoint，不传时使用
   * OpenAI SDK 默认 endpoint。
   * @param deps 初始化依赖；必须传 logger 和 secretProvider，API key 只通过 secret ref 解析。
   *
   * 实现方式：解析 secret，创建 OpenAI client，并把模型、温度、timeout 固定在当前组件实例上；
   * 业务请求不能在调用时临时切换这些初始化配置。
   */
  async init(config: LlmConfig, deps?: FoundationInitDeps): Promise<void> {
    const logger = requireFoundationLogger("llm", deps);
    this.#logger = logger;
    const startedAt = Date.now();
    logger.info("foundation.llm.init_started", {
      model: config.model,
      model_tier: config.modelTier,
      component: "llm"
    });
    try {
      const apiKey = await resolveSecret("llm", deps, config.apiKeySecretRef);
      this.#client = new OpenAI({
        apiKey,
        timeout: config.timeoutMs,
        maxRetries: config.maxRetries,
        ...(config.baseUrl === undefined ? {} : { baseURL: config.baseUrl }),
        ...(config.defaultHeaders === undefined ? {} : { defaultHeaders: config.defaultHeaders })
      });
      this.#config = config;
      logger.info("foundation.llm.init_succeeded", {
        duration_ms: Date.now() - startedAt,
        component: "llm"
      });
    } catch (cause) {
      logger.error("foundation.llm.init_failed", {
        duration_ms: Date.now() - startedAt,
        error: normalizeError(cause),
        component: "llm"
      });
      throw cause;
    }
  }

  /**
   * 返回底层 OpenAI SDK 实例。
   *
   * 没有参数；调用方需要访问 SDK 未经封装的新能力时使用。实现上只做初始化状态校验，
   * 不修改 OpenAI client 的任何方法或参数。
   */
  get client(): OpenAI {
    return this.#requireClient();
  }

  /**
   * 返回 Chat Completions 轻量入口。
   *
   * 没有参数；返回值包含初始化模型参数和 `create/stream` 方法。实现上每次创建一个闭包对象，
   * 让请求统一经过本组件的日志、timeout 和错误归一化记录。
   */
  get chatCompletions(): OpenAiChatCompletionClient {
    return {
      model: this.#requireConfig().model,
      temperature: this.#requireConfig().temperature,
      create: async (params) => await this.#create(params),
      stream: async (params) => await this.#stream(params)
    };
  }

  /**
   * 检查 LLM 组件是否已经初始化。
   *
   * 没有参数；返回 Foundation 标准健康状态。实现上只检查本地 OpenAI client 是否存在，
   * 不主动调用外部模型，避免健康检查产生额外 token 成本。
   */
  async healthCheck(): Promise<FoundationHealth> {
    await Promise.resolve();
    return {
      status: this.#client === undefined ? "unhealthy" : "healthy",
      message: this.#client === undefined ? "llm is not initialized" : "llm initialized",
      checkedAt: nowIso()
    };
  }

  /**
   * 关闭 LLM 组件。
   *
   * 没有参数；当前 OpenAI SDK client 不持有需要显式释放的连接，因此实现为空异步方法，
   * 只保留 FoundationComponent 生命周期接口的一致性。
   */
  async close(): Promise<void> {
    await Promise.resolve();
  }

  /**
   * 发起非流式 Chat Completion。
   *
   * @param params OpenAI SDK `chat.completions.create` 的非流式参数，调用方负责传入
   * model、messages、tools、functions 或 response_format 等 OpenAI 原生字段。
   *
   * 实现方式：记录请求摘要，调用底层 OpenAI SDK，并把 token usage 与耗时写入结构化日志；
   * SDK 抛出的错误原样继续抛出，便于上层按 provider 错误处理。
   */
  async #create(params: ChatCompletionCreateParamsNonStreaming): Promise<ChatCompletion> {
    const config = this.#requireConfig();
    const startedAt = Date.now();
    this.#logger?.info("foundation.llm.chat_completion_started", {
      component: "llm",
      model: config.model,
      stream: false,
      message_count: params.messages.length,
      tool_count: params.tools?.length ?? params.functions?.length ?? 0,
      response_format: responseFormatName(params.response_format)
    });
    try {
      const completion = await this.#requireClient().chat.completions.create(params, {
        signal: AbortSignal.timeout(config.timeoutMs)
      });
      this.#logger?.info("foundation.llm.chat_completion_succeeded", {
        component: "llm",
        model: completion.model,
        duration_ms: Date.now() - startedAt,
        input_tokens: completion.usage?.prompt_tokens,
        output_tokens: completion.usage?.completion_tokens
      });
      return completion;
    } catch (cause) {
      this.#logger?.error("foundation.llm.chat_completion_failed", {
        component: "llm",
        model: config.model,
        duration_ms: Date.now() - startedAt,
        error: normalizeError(cause)
      });
      throw cause;
    }
  }

  /**
   * 发起流式 Chat Completion。
   *
   * @param params OpenAI SDK `chat.completions.create` 的流式参数，必须包含 `stream:true`；
   * 其他 tools、functions、response_format 等字段保持 OpenAI 原生结构。
   *
   * 实现方式：记录流式请求摘要，打开 SDK stream 后立即返回给调用方消费；组件只记录
   * stream 打开成功，不消费 chunk，避免改变调用方对 streaming 的控制权。
   */
  async #stream(
    params: ChatCompletionCreateParamsStreaming
  ): Promise<Stream<OpenAI.Chat.Completions.ChatCompletionChunk>> {
    const config = this.#requireConfig();
    const startedAt = Date.now();
    this.#logger?.info("foundation.llm.chat_completion_started", {
      component: "llm",
      model: config.model,
      stream: true,
      message_count: params.messages.length,
      tool_count: params.tools?.length ?? params.functions?.length ?? 0,
      response_format: responseFormatName(params.response_format)
    });
    try {
      const stream = await this.#requireClient().chat.completions.create(params, {
        signal: AbortSignal.timeout(config.timeoutMs)
      });
      this.#logger?.info("foundation.llm.chat_completion_stream_opened", {
        component: "llm",
        model: config.model,
        duration_ms: Date.now() - startedAt
      });
      return stream;
    } catch (cause) {
      this.#logger?.error("foundation.llm.chat_completion_failed", {
        component: "llm",
        model: config.model,
        duration_ms: Date.now() - startedAt,
        error: normalizeError(cause)
      });
      throw cause;
    }
  }

  /**
   * 读取初始化配置。
   *
   * 没有参数；返回已初始化的 LLM 配置。实现上集中抛出 Foundation 未初始化错误，
   * 避免各个 public/private 方法重复写状态判断。
   */
  #requireConfig(): LlmConfig {
    if (this.#config === undefined) {
      throw createFoundationError({
        component: "llm",
        code: "FOUNDATION_NOT_INITIALIZED",
        message: "llm is not initialized",
        retryable: false
      });
    }
    return this.#config;
  }

  /**
   * 读取底层 OpenAI client。
   *
   * 没有参数；返回已初始化的 SDK client。实现上集中保护未初始化状态，
   * 让 `client` getter 和 chat completion 方法共享同一错误语义。
   */
  #requireClient(): OpenAI {
    if (this.#client === undefined) {
      throw createFoundationError({
        component: "llm",
        code: "FOUNDATION_NOT_INITIALIZED",
        message: "llm is not initialized",
        retryable: false
      });
    }
    return this.#client;
  }
}

/**
 * 提取 OpenAI response_format 类型用于日志。
 *
 * @param responseFormat OpenAI SDK 的 response_format 参数或空值。实现上只读取对象的
 * `type` 字段，避免把完整 JSON schema 记入日志。
 */
const responseFormatName = (responseFormat: unknown): string | undefined => {
  if (
    responseFormat === undefined ||
    responseFormat === null ||
    typeof responseFormat !== "object"
  ) {
    return undefined;
  }
  const type = (responseFormat as { readonly type?: unknown }).type;
  return typeof type === "string" ? type : undefined;
};
