import { setTimeout as delay } from "node:timers/promises";
import { createHash } from "node:crypto";
import {
  createFoundationError,
  nowIso,
  resolveSecret,
  type FoundationInitDeps
} from "../foundation-types.js";
import type {
  EmbeddingDbConfig,
  EmbeddingDbProvider,
  EmbeddingGetCommand,
  EmbeddingListCommand,
  EmbeddingRecord,
  EmbeddingSearchCommand,
  EmbeddingSearchResult,
  EmbeddingUpsertCommand
} from "./embedding-db-types.js";

export type PineconeEmbeddingDbProviderConfig = {
  readonly endpoint: string;
  readonly apiKeySecretRef: string;
  readonly apiVersion?: string;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
  readonly retryDelayMs?: number;
};

type PineconeVector = {
  readonly id?: unknown;
  readonly score?: unknown;
  readonly metadata?: unknown;
};

type PineconeEnvelope = {
  readonly matches?: readonly PineconeVector[];
  readonly vectors?: Record<string, PineconeVector>;
};

/**
 * Pinecone provider，基于 Pinecone data-plane REST API 实现。
 *
 * Pinecone index 由外部控制面预先创建；`EmbeddingDbConfig.collectionName` 在该 provider
 * 中就是 Pinecone namespace。公共 EmbeddingDb API 的租户隔离仍然通过 metadata filter
 * 中的 `userId` 强制实现，namespace 只承担同一 index 内的数据分区职责。
 */
export class PineconeEmbeddingDbProvider implements EmbeddingDbProvider {
  readonly name = "pinecone";
  #endpoint: string | undefined;
  #apiKey: string | undefined;
  #namespaceName: string | undefined;

  constructor(private readonly providerConfig: PineconeEmbeddingDbProviderConfig) {}

  /**
   * 初始化 Pinecone data-plane client。
   *
   * @param config Foundation 公共配置；Pinecone index 由外部控制面创建，collectionName
   * 会被作为 data-plane 请求的 namespace 使用。
   * @param deps 初始化依赖；通过 deps.secretProvider 解析 `apiKeySecretRef`。
   *
   * 实现方式：保存 endpoint、namespace，解析 API key，然后调用 `describe_index_stats` 验证
   * 凭据和 index host 可达。Pinecone index 创建不属于 data-plane provider 职责。
   */
  async init(config: EmbeddingDbConfig, deps?: FoundationInitDeps): Promise<void> {
    this.#endpoint = this.providerConfig.endpoint.replace(/\/+$/u, "");
    this.#namespaceName = config.collectionName;
    this.#apiKey = await resolveSecret("embedding_db", deps, this.providerConfig.apiKeySecretRef);
    await this.#request("/describe_index_stats", "POST", {});
  }

  /**
   * 检查当前配置的 Pinecone index host 是否可访问。
   *
   * 参数：无。
   *
   * 实现方式：调用 `describe_index_stats`。该接口成本低，也不依赖任何具体 vector id，适合
   * 健康检查。
   */
  async healthCheck() {
    await this.#request("/describe_index_stats", "POST", {});
    return { status: "healthy" as const, message: "embedding db initialized", checkedAt: nowIso() };
  }

  /**
   * 清空当前进程内的 Pinecone 连接状态。
   *
   * 参数：无。
   *
   * 实现方式：清空 endpoint 和 API key。Pinecone 调用是无状态 HTTP 请求，所以没有连接池
   * 或 socket 需要关闭。
   */
  close(): Promise<void> {
    this.#endpoint = undefined;
    this.#apiKey = undefined;
    this.#namespaceName = undefined;
    return Promise.resolve();
  }

  /**
   * 向 Pinecone 写入或覆盖一条 vector。
   *
   * @param command 写入命令；`userId` 和 `id` 会生成稳定 provider id，`vector` 写入 values，
   * `content` 和 `metadata` 会放进 Pinecone metadata。
   *
   * 实现方式：把可过滤的标量 metadata 平铺到 Pinecone metadata，同时把原始结构化 metadata
   * 序列化进 `metadataJson`。这样 Pinecone 可以做标量过滤，读取时也能还原调用方写入的结构。
   */
  async upsert(command: EmbeddingUpsertCommand<Record<string, unknown>>): Promise<void> {
    // Pinecone upsert 接受 vectors 数组；这里仍保持单条写入语义，批量策略由调用脚本并发控制。
    await this.#request("/vectors/upsert", "POST", {
      namespace: this.#namespace(),
      vectors: [
        {
          id: pineconeVectorId(command.userId, command.id),
          values: command.vector,
          metadata: {
            ...flattenPineconeMetadata(command.metadata),
            userId: command.userId,
            originalId: command.id,
            content: command.content,
            metadataJson: JSON.stringify(command.metadata)
          }
        }
      ]
    });
  }

  /**
   * 在 userId 作用域内按向量相似度检索。
   *
   * @param command 检索命令；`vector` 是 query 向量，`filter` 是业务 metadata 条件，
   * `userId` 会被强制注入 Pinecone filter。
   * @param topK 本次最大召回数量，由门面层按 command.topK 或默认值计算。
   *
   * 实现方式：调用 `/query`，打开 includeMetadata 以便还原 record，不返回 values 以降低响应体。
   * filter 始终包含 `userId == command.userId`。
   */
  async search<TFilter, TMetadata>(
    command: EmbeddingSearchCommand<TFilter>,
    topK: number
  ): Promise<readonly EmbeddingSearchResult<TMetadata>[]> {
    const payload = await this.#request("/query", "POST", {
      namespace: this.#namespace(),
      vector: command.vector,
      topK,
      includeMetadata: true,
      includeValues: false,
      filter: pineconeFilter(command.userId, command.filter)
    });
    return (payload.matches ?? []).map((match) => pineconeToSearchResult<TMetadata>(match));
  }

  /**
   * 按稳定 provider id 精确读取单条记录。
   *
   * @param command 精确读取命令；`userId` 和公开 `id` 会生成 Pinecone vector id。
   *
   * 实现方式：调用 `/vectors/fetch`。Pinecone 返回以 vector id 为 key 的 map，provider 再把
   * metadata 中的 `originalId/content/metadataJson` 转回 EmbeddingDb record。
   */
  async getById<TMetadata>(
    command: EmbeddingGetCommand
  ): Promise<EmbeddingRecord<TMetadata> | undefined> {
    const params = new URLSearchParams({
      namespace: this.#namespace(),
      ids: pineconeVectorId(command.userId, command.id)
    });
    const payload = await this.#request(`/vectors/fetch?${params.toString()}`, "GET");
    const vector = payload.vectors?.[pineconeVectorId(command.userId, command.id)];
    return vector === undefined ? undefined : pineconeToRecord<TMetadata>(vector);
  }

  /**
   * 按 metadata filter 列出记录。
   *
   * @param command 列表命令；`userId` 会被注入 filter，`filter` 只表达业务 metadata 条件。
   * @param page 页码，从 1 开始。
   * @param pageSize 每页数量。
   *
   * 实现方式：调用 `/vectors/fetch_by_metadata` 先取到 `page * pageSize` 条，再在本地 slice
   * 出当前页。这样和其它 provider 保持相同分页语义。
   */
  async list<TFilter, TMetadata>(
    command: EmbeddingListCommand<TFilter>,
    page: number,
    pageSize: number
  ): Promise<readonly EmbeddingRecord<TMetadata>[]> {
    const payload = await this.#request("/vectors/fetch_by_metadata", "POST", {
      namespace: this.#namespace(),
      filter: pineconeFilter(command.userId, command.filter),
      limit: page * pageSize
    });
    return Object.values(payload.vectors ?? {})
      .slice((page - 1) * pageSize, page * pageSize)
      .map((vector) => pineconeToRecord<TMetadata>(vector));
  }

  /**
   * 删除一个 userId 下匹配 metadata filter 的记录。
   *
   * @param userId 要删除的用户边界。
   * @param filter 业务 metadata 条件，会和 userId 一起构造成 Pinecone filter。
   *
   * 实现方式：先构造带 userId 的 filter，再交给内部 `#delete()` 先查 id、再分片删除。
   */
  async deleteByFilter<TFilter>(userId: string, filter: TFilter): Promise<number> {
    return await this.#delete(pineconeFilter(userId, filter));
  }

  /**
   * 删除当前 namespace 中某个 userId 的全部记录。
   *
   * @param userId 要删除的用户边界。
   *
   * 实现方式：仍然使用 metadata filter，而不是删除 namespace。namespace 是 provider 部署细节，
   * userId 隔离才是 EmbeddingDb 对外契约。
   */
  async deleteByUser(userId: string): Promise<number> {
    return await this.#delete({ userId: { $eq: userId } });
  }

  /**
   * 先物化匹配 vector id，再执行删除。
   *
   * @param filter 已经包含 userId 隔离的 Pinecone metadata filter。
   *
   * 实现方式：Pinecone 删除响应不包含 affected count，且 data-plane API 单次最多删除 1000 个
   * id。这里先 fetch_by_metadata 获取 id 列表用于返回数量，再按 1000 个一组调用 delete。
   */
  async #delete(filter: Record<string, unknown>): Promise<number> {
    // 先读取 id 是为了让 deleteByFilter/deleteByUser 都能返回准确删除数量，而不是只能返回成功/失败。
    const before = await this.#request("/vectors/fetch_by_metadata", "POST", {
      namespace: this.#namespace(),
      filter,
      limit: 10_000
    });
    const ids = Object.keys(before.vectors ?? {});
    for (const chunk of chunks(ids, 1_000)) {
      // Pinecone 对 ids 删除有 1000 个/请求的限制，所以大用户清理必须分片提交。
      await this.#request("/vectors/delete", "POST", {
        namespace: this.#namespace(),
        ids: chunk
      });
    }
    return ids.length;
  }

  /**
   * 发送一次 Pinecone data-plane 请求，并把非 2xx 响应转换成 Foundation 错误。
   *
   * @param path data-plane 路径，例如 `/query` 或 `/vectors/upsert`。
   * @param method HTTP 方法；当前 provider 只需要 GET 和 POST。
   * @param body 可选 JSON body；GET 或空 POST 可不传。
   *
   * 实现方式：统一附加 API key、API version 和 JSON header；解析响应 JSON；失败时抛出
   * Foundation 错误。index 创建这类 control-plane 操作放在测试/部署脚本中，运行时 provider
   * 只负责数据面。
   */
  async #request(
    path: string,
    method: "GET" | "POST",
    body?: Record<string, unknown>
  ): Promise<PineconeEnvelope> {
    const headers = new Headers({
      accept: "application/json",
      "api-key": this.#requireApiKey(),
      "x-pinecone-api-version": this.providerConfig.apiVersion ?? "2025-10"
    });
    if (body !== undefined) {
      headers.set("content-type", "application/json");
    }
    const attempts = (this.providerConfig.maxRetries ?? 0) + 1;
    let lastCause: unknown;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        // Pinecone data-plane 调用全部经过同一个超时入口，避免真实验证或线上请求在网络层
        // 无限等待。默认 30 秒足够覆盖健康检查、upsert、query 和 delete，调用方可按环境覆盖。
        const response = await fetch(`${this.#requireEndpoint()}${path}`, {
          method,
          headers,
          signal: AbortSignal.timeout(this.providerConfig.timeoutMs ?? 30_000),
          ...(body === undefined ? {} : { body: JSON.stringify(body) })
        });
        const text = await response.text();
        const payload = text.length === 0 ? {} : (JSON.parse(text) as PineconeEnvelope);
        if (!response.ok) {
          const retryable = response.status >= 500;
          lastCause = `status ${response.status}: ${text.slice(0, 500)}`;
          if (retryable && attempt < attempts) {
            await delay(this.#retryDelayMs(attempt));
            continue;
          }
          throw createFoundationError({
            component: "embedding_db",
            code: "FOUNDATION_EMBEDDING_PINECONE_REQUEST_FAILED",
            message: `pinecone request failed: ${response.status} ${text.slice(0, 500)}`,
            retryable
          });
        }
        return payload;
      } catch (cause) {
        if (cause instanceof SyntaxError) {
          throw createFoundationError({
            component: "embedding_db",
            code: "FOUNDATION_EMBEDDING_PINECONE_PAYLOAD_INVALID",
            message: `pinecone response json is invalid: ${cause.message}`,
            retryable: false,
            cause
          });
        }
        lastCause = cause;
        if (isFoundationPineconeRequestFailure(cause) || attempt >= attempts) {
          break;
        }
        await delay(this.#retryDelayMs(attempt));
      }
    }
    throw createFoundationError({
      component: "embedding_db",
      code: "FOUNDATION_EMBEDDING_PINECONE_NETWORK_FAILED",
      message: `pinecone request failed before response after ${attempts} attempt(s): ${errorMessage(
        lastCause
      )}`,
      retryable: true,
      cause: lastCause
    });
  }

  /**
   * 读取当前 Pinecone namespace。
   *
   * 参数：无。实现方式：返回 init 时从 `EmbeddingDbConfig.collectionName` 保存的 namespace；
   * 未初始化时抛出 Foundation 初始化错误，避免请求落到错误 namespace。
   */
  #namespace(): string {
    if (this.#namespaceName === undefined) {
      throw createFoundationError({
        component: "embedding_db",
        code: "FOUNDATION_NOT_INITIALIZED",
        message: "pinecone embedding db namespace is not initialized",
        retryable: false
      });
    }
    return this.#namespaceName;
  }

  /**
   * 读取已初始化的 Pinecone endpoint。
   *
   * 参数：无。实现方式：初始化前调用会抛出 Foundation 错误，防止请求发往空地址。
   */
  #requireEndpoint(): string {
    if (this.#endpoint === undefined) {
      throw createFoundationError({
        component: "embedding_db",
        code: "FOUNDATION_NOT_INITIALIZED",
        message: "pinecone embedding db is not initialized",
        retryable: false
      });
    }
    return this.#endpoint;
  }

  /**
   * 读取已解析的 Pinecone API key。
   *
   * 参数：无。实现方式：初始化前调用会抛出 Foundation 错误，防止匿名请求泄漏到外部服务。
   */
  #requireApiKey(): string {
    if (this.#apiKey === undefined) {
      throw createFoundationError({
        component: "embedding_db",
        code: "FOUNDATION_NOT_INITIALIZED",
        message: "pinecone embedding db is not initialized",
        retryable: false
      });
    }
    return this.#apiKey;
  }

  /**
   * 计算 Pinecone 重试等待时间。
   *
   * @param attempt 当前失败的尝试序号，从 1 开始。
   *
   * 实现方式：用配置的 retryDelayMs 做线性退避基数，默认 500ms；真实网络抖动通常短暂，
   * 线性退避足够且不会显著拖慢 100 轮验证。
   */
  #retryDelayMs(attempt: number): number {
    return (this.providerConfig.retryDelayMs ?? 500) * attempt;
  }
}

/** 生成稳定 provider id；参数 userId 是租户边界，id 是公开业务 id，返回值不会暴露原始 userId。 */
const pineconeVectorId = (userId: string, id: string): string =>
  createHash("sha256").update(`${userId}:${id}`).digest("hex");

/**
 * 保留 Pinecone 可原生过滤的标量 metadata 字段。
 *
 * @param metadata 调用方写入的结构化 metadata。
 *
 * 实现方式：只保留 string/number/boolean。完整结构仍然保存在 `metadataJson`，这里的平铺字段
 * 只用于 Pinecone provider-side filter。
 */
const flattenPineconeMetadata = (metadata: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(metadata).filter(([, value]) =>
      ["string", "number", "boolean"].includes(typeof value)
    )
  );

/**
 * 构建包含强制 userId 隔离的 Pinecone metadata filter。
 *
 * @param userId 租户边界，永远会作为第一条过滤条件。
 * @param filter 业务 metadata 条件；只支持可被 Pinecone 直接表达的标量字段。
 *
 * 实现方式：用 `$and` 组合 userId 条件和标量业务条件。嵌套 filter 会被忽略，因为 Pinecone
 * 标量 metadata filter 不能表达任意 JSON 子集匹配；调用方读取时仍能从 `metadataJson` 拿回原始结构。
 */
const pineconeFilter = (userId: string, filter: unknown): Record<string, unknown> => {
  const clauses: Record<string, unknown>[] = [{ userId: { $eq: userId } }];
  if (filter !== null && typeof filter === "object" && !Array.isArray(filter)) {
    for (const [key, value] of Object.entries(filter)) {
      if (["string", "number", "boolean"].includes(typeof value)) {
        clauses.push({ [key]: { $eq: safeMetadataValue(value) } });
      }
    }
  }
  return clauses.length === 1 ? (clauses[0] ?? {}) : { $and: clauses };
};

/**
 * 提取网络错误的短消息。
 *
 * @param cause fetch 抛出的任意错误。
 *
 * 实现方式：优先使用 Error.message；非 Error 值转成字符串。该消息只用于错误摘要，
 * 不包含 request body 或 secret。
 */
const errorMessage = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

/**
 * 判断是否为已经构造好的 Pinecone HTTP 错误。
 *
 * @param cause catch 捕获到的错误。
 *
 * 实现方式：HTTP 非 2xx 分支已经带有可重试判断，不应该再被外层网络重试逻辑重新包装。
 */
const isFoundationPineconeRequestFailure = (cause: unknown): boolean =>
  cause instanceof Error &&
  "code" in cause &&
  cause.code === "FOUNDATION_EMBEDDING_PINECONE_REQUEST_FAILED";

/** 从 Pinecone metadata 还原不依赖具体 provider 的 EmbeddingDb record。 */
const pineconeToRecord = <TMetadata>(vector: PineconeVector): EmbeddingRecord<TMetadata> => {
  const metadata = vector.metadata;
  if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw createFoundationError({
      component: "embedding_db",
      code: "FOUNDATION_EMBEDDING_PINECONE_PAYLOAD_INVALID",
      message: "pinecone vector metadata is missing",
      retryable: false
    });
  }
  const record = metadata as Record<string, unknown>;
  if (typeof record["originalId"] !== "string" || typeof record["content"] !== "string") {
    throw createFoundationError({
      component: "embedding_db",
      code: "FOUNDATION_EMBEDDING_PINECONE_PAYLOAD_INVALID",
      message: "pinecone vector metadata is missing originalId or content",
      retryable: false
    });
  }
  const parsed =
    typeof record["metadataJson"] === "string"
      ? (JSON.parse(record["metadataJson"]) as TMetadata)
      : ({} as TMetadata);
  return { id: record["originalId"], content: record["content"], metadata: parsed };
};

/** 把 Pinecone match 转成公共 search result；score 缺失时按 0 处理。 */
const pineconeToSearchResult = <TMetadata>(
  vector: PineconeVector
): EmbeddingSearchResult<TMetadata> => ({
  ...pineconeToRecord<TMetadata>(vector),
  score: typeof vector.score === "number" ? vector.score : 0
});

/** 校验 Pinecone metadata filter 值；只允许 string/number/boolean 三类标量。 */
const safeMetadataValue = (value: unknown): string | number | boolean => {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  throw createFoundationError({
    component: "embedding_db",
    code: "FOUNDATION_EMBEDDING_METADATA_INVALID",
    message: "metadata filter value must be scalar",
    retryable: false
  });
};

/** 按固定 size 拆分数组；参数 size 用于适配 Pinecone 单请求 id 数限制。 */
const chunks = <T>(items: readonly T[], size: number): readonly (readonly T[])[] => {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};
