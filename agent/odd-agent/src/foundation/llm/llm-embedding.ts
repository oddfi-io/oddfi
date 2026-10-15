import OpenAI from "openai";
import type { CreateEmbeddingResponse, EmbeddingCreateParams } from "openai/resources/embeddings";
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

export type LlmEmbeddingConfig = {
  readonly model: string;
  readonly baseUrl?: string;
  readonly apiKeySecretRef: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly dimensions?: number;
  readonly encodingFormat?: "float" | "base64";
  readonly defaultHeaders?: Record<string, string>;
};

export type LlmEmbeddingCreateOptions = {
  readonly user?: string;
  readonly dimensions?: number;
};

export type OpenAiEmbeddingClient = {
  readonly model: string;
  readonly dimensions?: number;
  create(params: EmbeddingCreateParams): Promise<CreateEmbeddingResponse>;
  embedText(text: string, options?: LlmEmbeddingCreateOptions): Promise<readonly number[]>;
  embedTexts(
    texts: readonly string[],
    options?: LlmEmbeddingCreateOptions
  ): Promise<readonly (readonly number[])[]>;
};

export type LlmEmbeddingComponent = FoundationComponent<LlmEmbeddingConfig> & {
  readonly client: OpenAI;
  readonly embeddings: OpenAiEmbeddingClient;
};

/**
 * Foundation LLM Embedding 的 OpenAI SDK 轻封装。
 *
 * 组件只负责 OpenAI-compatible embeddings client 初始化、secret 解析、统一日志和 timeout/retry
 * 配置。它不存储向量，也不感知 Embedding DB；调用方拿到 vector 后自行写入向量库。
 */
export class OpenAiLlmEmbeddingComponent implements LlmEmbeddingComponent {
  #config: LlmEmbeddingConfig | undefined;
  #logger: LoggerComponent | undefined;
  #client: OpenAI | undefined;

  /**
   * 初始化 OpenAI SDK embeddings client。
   *
   * @param config embedding LLM 配置；`baseUrl` 用于阿里百炼等 OpenAI-compatible endpoint，
   * 不传时使用 OpenAI SDK 默认 endpoint。
   * @param deps 初始化依赖；必须传 logger 和 secretProvider，API key 只通过 secret ref 解析。
   *
   * 实现方式：解析 secret，创建独立 OpenAI client，并把模型、维度、timeout 固定在当前实例上；
   * 不复用 Chat Completions 的 `OpenAiLlmComponent`，避免配置和生命周期互相影响。
   */
  async init(config: LlmEmbeddingConfig, deps?: FoundationInitDeps): Promise<void> {
    const logger = requireFoundationLogger("llm_embedding", deps);
    this.#logger = logger;
    const startedAt = Date.now();
    logger.info("foundation.llm_embedding.init_started", {
      component: "llm_embedding",
      model: config.model,
      dimensions: config.dimensions
    });
    try {
      const apiKey = await resolveSecret("llm_embedding", deps, config.apiKeySecretRef);
      this.#client = new OpenAI({
        apiKey,
        timeout: config.timeoutMs,
        maxRetries: config.maxRetries,
        ...(config.baseUrl === undefined ? {} : { baseURL: config.baseUrl }),
        ...(config.defaultHeaders === undefined ? {} : { defaultHeaders: config.defaultHeaders })
      });
      this.#config = config;
      logger.info("foundation.llm_embedding.init_succeeded", {
        component: "llm_embedding",
        duration_ms: Date.now() - startedAt
      });
    } catch (cause) {
      logger.error("foundation.llm_embedding.init_failed", {
        component: "llm_embedding",
        duration_ms: Date.now() - startedAt,
        error: normalizeError(cause)
      });
      throw cause;
    }
  }

  /**
   * 返回底层 OpenAI SDK 实例。
   *
   * 没有参数；调用方需要访问 SDK 未经封装的新 embedding 能力时使用。实现上只做初始化
   * 状态校验，不修改 OpenAI client 的任何方法或参数。
   */
  get client(): OpenAI {
    return this.#requireClient();
  }

  /**
   * 返回 Embeddings 轻量入口。
   *
   * 没有参数；返回值包含初始化模型参数和 `create/embedText/embedTexts` 方法。实现上每次
   * 创建一个闭包对象，让请求统一经过本组件的日志、timeout 和输出校验。
   */
  get embeddings(): OpenAiEmbeddingClient {
    return {
      model: this.#requireConfig().model,
      ...(this.#requireConfig().dimensions === undefined
        ? {}
        : { dimensions: this.#requireConfig().dimensions }),
      create: async (params) => await this.#create(params),
      embedText: async (text, options) => await this.#embedText(text, options),
      embedTexts: async (texts, options) => await this.#embedTexts(texts, options)
    };
  }

  /**
   * 检查 LLM Embedding 组件是否已经初始化。
   *
   * 没有参数；返回 Foundation 标准健康状态。实现上只检查本地 OpenAI client 是否存在，
   * 不主动调用外部 embedding 模型，避免健康检查产生额外 token 成本。
   */
  async healthCheck(): Promise<FoundationHealth> {
    await Promise.resolve();
    return {
      status: this.#client === undefined ? "unhealthy" : "healthy",
      message:
        this.#client === undefined
          ? "llm embedding is not initialized"
          : "llm embedding initialized",
      checkedAt: nowIso()
    };
  }

  /**
   * 关闭 LLM Embedding 组件。
   *
   * 没有参数；当前 OpenAI SDK client 不持有需要显式释放的连接，因此实现为空异步方法，
   * 只保留 FoundationComponent 生命周期接口的一致性。
   */
  async close(): Promise<void> {
    await Promise.resolve();
  }

  /**
   * 发起原生 OpenAI embeddings.create 调用。
   *
   * @param params OpenAI SDK `embeddings.create` 参数，调用方可传 input、model、dimensions、
   * encoding_format、user 等 OpenAI 原生字段。
   *
   * 实现方式：记录请求摘要，调用底层 OpenAI SDK，校验返回的每个 embedding 是非空 number
   * 数组，并把 token usage 与耗时写入结构化日志。
   */
  async #create(params: EmbeddingCreateParams): Promise<CreateEmbeddingResponse> {
    const config = this.#requireConfig();
    const startedAt = Date.now();
    this.#logger?.info("foundation.llm_embedding.embedding_started", {
      component: "llm_embedding",
      model: params.model,
      input_count: inputCount(params.input),
      dimensions: params.dimensions
    });
    try {
      const response = await this.#requireClient().embeddings.create(params, {
        signal: AbortSignal.timeout(config.timeoutMs)
      });
      for (const item of response.data) {
        validateEmbeddingVector(item.embedding, params.dimensions);
      }
      this.#logger?.info("foundation.llm_embedding.embedding_succeeded", {
        component: "llm_embedding",
        model: response.model,
        input_count: inputCount(params.input),
        output_count: response.data.length,
        dimensions: response.data[0]?.embedding.length,
        duration_ms: Date.now() - startedAt,
        input_tokens: response.usage?.prompt_tokens,
        total_tokens: response.usage?.total_tokens
      });
      return response;
    } catch (cause) {
      this.#logger?.error("foundation.llm_embedding.embedding_failed", {
        component: "llm_embedding",
        model: params.model,
        duration_ms: Date.now() - startedAt,
        error: normalizeError(cause)
      });
      throw cause;
    }
  }

  /**
   * 生成单条文本 embedding。
   *
   * @param text 需要向量化的文本，必须是非空字符串。
   * @param options 可选调用参数；`dimensions` 会覆盖初始化默认维度，`user` 会透传给 OpenAI。
   *
   * 实现方式：用初始化模型、默认维度和 encodingFormat 构造 embeddings.create 请求，
   * 然后返回第一条 embedding vector。
   */
  async #embedText(text: string, options?: LlmEmbeddingCreateOptions): Promise<readonly number[]> {
    if (text.trim().length === 0) {
      throw createFoundationError({
        component: "llm_embedding",
        code: "FOUNDATION_LLM_EMBEDDING_INPUT_EMPTY",
        message: "embedding text is empty",
        retryable: false
      });
    }
    const vectors = await this.#embedTexts([text], options);
    const first = vectors[0];
    if (first === undefined) {
      throw createFoundationError({
        component: "llm_embedding",
        code: "FOUNDATION_LLM_EMBEDDING_OUTPUT_EMPTY",
        message: "embedding response did not contain a vector",
        retryable: true
      });
    }
    return first;
  }

  /**
   * 批量生成文本 embeddings。
   *
   * @param texts 需要向量化的文本数组，数组和每个文本都必须非空。
   * @param options 可选调用参数；`dimensions` 会覆盖初始化默认维度，`user` 会透传给 OpenAI。
   *
   * 实现方式：用初始化模型、默认维度和 encodingFormat 构造单次 batch embeddings.create 请求，
   * 然后按 OpenAI 返回顺序输出 vector 数组。
   */
  async #embedTexts(
    texts: readonly string[],
    options?: LlmEmbeddingCreateOptions
  ): Promise<readonly (readonly number[])[]> {
    if (texts.length === 0 || texts.some((text) => text.trim().length === 0)) {
      throw createFoundationError({
        component: "llm_embedding",
        code: "FOUNDATION_LLM_EMBEDDING_INPUT_EMPTY",
        message: "embedding texts must be non-empty",
        retryable: false
      });
    }
    const config = this.#requireConfig();
    const dimensions = options?.dimensions ?? config.dimensions;
    const response = await this.#create({
      model: config.model,
      input: [...texts],
      ...(dimensions === undefined ? {} : { dimensions }),
      encoding_format: config.encodingFormat ?? "float",
      ...(options?.user === undefined ? {} : { user: options.user })
    });
    return response.data
      .slice()
      .sort((left, right) => left.index - right.index)
      .map((item) => item.embedding);
  }

  /**
   * 读取初始化配置。
   *
   * 没有参数；返回已初始化的 embedding LLM 配置。实现上集中抛出 Foundation 未初始化错误，
   * 避免各个 public/private 方法重复写状态判断。
   */
  #requireConfig(): LlmEmbeddingConfig {
    if (this.#config === undefined) {
      throw createFoundationError({
        component: "llm_embedding",
        code: "FOUNDATION_NOT_INITIALIZED",
        message: "llm embedding is not initialized",
        retryable: false
      });
    }
    return this.#config;
  }

  /**
   * 读取底层 OpenAI client。
   *
   * 没有参数；返回已初始化的 SDK client。实现上集中保护未初始化状态，
   * 让 `client` getter 和 embedding 方法共享同一错误语义。
   */
  #requireClient(): OpenAI {
    if (this.#client === undefined) {
      throw createFoundationError({
        component: "llm_embedding",
        code: "FOUNDATION_NOT_INITIALIZED",
        message: "llm embedding is not initialized",
        retryable: false
      });
    }
    return this.#client;
  }
}

/**
 * 计算 OpenAI embeddings input 条数用于日志。
 *
 * @param input OpenAI SDK embeddings input。实现上按数组长度或单字符串计数，不记录原文，
 * 避免 embedding 日志泄漏用户输入。
 */
const inputCount = (input: EmbeddingCreateParams["input"]): number =>
  typeof input === "string" || typeof input[0] === "number" ? 1 : input.length;

/**
 * 校验 provider 返回的 embedding vector。
 *
 * @param vector OpenAI provider 返回的单条向量。
 * @param expectedDimensions 请求中显式指定的维度；传入时必须与返回长度一致。
 *
 * 实现方式：拒绝空数组、非 number 值和显式维度不匹配，避免坏向量继续写入 Embedding DB。
 */
const validateEmbeddingVector = (
  vector: readonly number[],
  expectedDimensions: number | undefined
): void => {
  if (vector.length === 0 || vector.some((value) => typeof value !== "number")) {
    throw createFoundationError({
      component: "llm_embedding",
      code: "FOUNDATION_LLM_EMBEDDING_VECTOR_INVALID",
      message: "embedding vector must be a non-empty number array",
      retryable: true
    });
  }
  if (expectedDimensions !== undefined && vector.length !== expectedDimensions) {
    throw createFoundationError({
      component: "llm_embedding",
      code: "FOUNDATION_LLM_EMBEDDING_DIMENSION_MISMATCH",
      message: `embedding dimension mismatch: expected ${expectedDimensions}, got ${vector.length}`,
      retryable: true
    });
  }
};
