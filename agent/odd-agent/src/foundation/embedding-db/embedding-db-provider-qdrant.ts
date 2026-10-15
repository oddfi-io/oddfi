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
import { isPlainRecord } from "./embedding-db-utils.js";

export type QdrantEmbeddingDbProviderConfig = {
  readonly endpoint: string;
  readonly apiKeySecretRef?: string;
};

type QdrantEnvelope = {
  readonly result?:
    | {
        readonly config?: {
          readonly params?: {
            readonly vectors?: { readonly size?: number };
          };
        };
        readonly points?: readonly QdrantPoint[];
      }
    | readonly QdrantPoint[];
};

type QdrantCollectionEnvelope = {
  readonly result?: {
    readonly config?: {
      readonly params?: {
        readonly vectors?: { readonly size?: number };
      };
    };
  };
};

type QdrantScrollEnvelope = {
  readonly result?: {
    readonly points?: readonly QdrantPoint[];
  };
};

type QdrantPoint = {
  readonly id?: string | number;
  readonly score?: number;
  readonly payload?: {
    readonly id?: unknown;
    readonly content?: unknown;
    readonly metadata?: unknown;
  };
};

/**
 * Qdrant provider，用于把向量持久化存放到 PostgreSQL 之外。
 *
 * Qdrant point id 使用 `(userId,id)` 的稳定 hash；原始 id、content 和
 * metadata 保存在 payload 中，避免调用方依赖 provider 私有 id。
 */
export class QdrantEmbeddingDbProvider implements EmbeddingDbProvider {
  readonly name = "qdrant";
  #config: EmbeddingDbConfig | undefined;
  #endpoint: string | undefined;
  #apiKey: string | undefined;

  constructor(private readonly providerConfig: QdrantEmbeddingDbProviderConfig) {}

  /**
   * 初始化 Qdrant collection。
   *
   * @param config Foundation 公共配置；collectionName 是 Qdrant collection 名，dimension 和
   * distance 用于创建向量索引。
   * @param deps 初始化依赖；当 apiKeySecretRef 存在时会从 deps.secretProvider 读取 API key。
   *
   * 方法会解析可选 API key；collection 不存在时创建；
   * 已存在 collection 的向量维度与 Foundation 配置不一致时会 fail-fast。
   */
  async init(config: EmbeddingDbConfig, deps?: FoundationInitDeps): Promise<void> {
    this.#config = config;
    this.#endpoint = this.providerConfig.endpoint.replace(/\/+$/u, "");
    this.#apiKey =
      this.providerConfig.apiKeySecretRef === undefined
        ? undefined
        : await resolveSecret("embedding_db", deps, this.providerConfig.apiKeySecretRef);
    // 先用 raw 请求读取 collection，是因为 404 不是错误，而是首次初始化时需要创建 collection 的信号。
    const existing = await this.#fetchRaw(`/collections/${config.collectionName}`, {
      method: "GET"
    });
    if (existing.status === 404) {
      // collection 不存在时按 Foundation 维度和距离创建，确保后续写入不需要 provider 外部预置资源。
      await this.#fetch(`/collections/${config.collectionName}`, {
        method: "PUT",
        body: JSON.stringify({
          vectors: {
            size: config.dimension,
            distance: qdrantDistance(config.distance)
          }
        })
      });
      return;
    }
    // 已存在 collection 时必须校验维度，防止同名 collection 被错误配置复用后写入失败或检索异常。
    const payload = (await parseQdrantResponse(existing)) as QdrantCollectionEnvelope;
    const vectorConfig = payload.result?.config?.params?.vectors;
    if (typeof vectorConfig?.size === "number" && Number(vectorConfig.size) !== config.dimension) {
      throw createFoundationError({
        component: "embedding_db",
        code: "FOUNDATION_EMBEDDING_DIMENSION_MISMATCH",
        message: `existing qdrant collection dimension mismatch: expected ${config.dimension}, got ${String(vectorConfig.size)}`,
        retryable: false
      });
    }
  }

  /**
   * 检查当前配置的 Qdrant collection 是否可访问。
   *
   * 参数：无。
   *
   * 实现方式：对当前 collection 做 GET 请求；请求成功即认为 provider healthy。
   */
  async healthCheck() {
    await this.#fetch(`/collections/${this.#requireConfig().collectionName}`, { method: "GET" });
    return { status: "healthy" as const, message: "embedding db initialized", checkedAt: nowIso() };
  }

  /**
   * 清空本地 endpoint 和 API key 状态。
   *
   * 参数：无。
   *
   * 实现方式：Qdrant 通过无状态 HTTP 调用访问，所以 close 只需要清空本地保存的 endpoint/API key。
   */
  close(): Promise<void> {
    this.#endpoint = undefined;
    this.#apiKey = undefined;
    return Promise.resolve();
  }

  /**
   * 写入或覆盖一个 Qdrant point。
   *
   * @param command 写入命令；`userId` 和 `id` 生成稳定 point id，`vector` 写入向量字段，
   * `content/metadata` 写入 payload。
   *
   * 实现方式：调用 `/points?wait=true`，让写入在返回前可见；payload 顶层保留 userId 便于过滤。
   *
   * payload 同时保留顶层 `userId` 便于快速隔离过滤，也保留 `metadata` 用于
   * 调用方自己的业务过滤。
   */
  async upsert(command: EmbeddingUpsertCommand<Record<string, unknown>>): Promise<void> {
    const config = this.#requireConfig();
    await this.#fetch(`/collections/${config.collectionName}/points?wait=true`, {
      method: "PUT",
      body: JSON.stringify({
        points: [
          {
            id: qdrantPointId(command.userId, command.id),
            vector: command.vector,
            payload: {
              userId: command.userId,
              id: command.id,
              content: command.content,
              metadata: command.metadata
            }
          }
        ]
      })
    });
  }

  /**
   * 使用 Qdrant payload filter 执行向量检索。
   *
   * @param command 检索命令；`vector` 是 query 向量，`filter` 是业务 metadata 条件，`userId`
   * 会被注入 payload filter。
   * @param topK 最大召回数量。
   *
   * 实现方式：调用 `/points/search`，设置 with_payload=true 用于还原 record，with_vector=false
   * 降低响应体大小。
   *
   * filter 始终包含顶层 `userId` 和 metadata 条件，确保 Qdrant 不会
   * 返回跨用户候选。
   */
  async search<TFilter, TMetadata>(
    command: EmbeddingSearchCommand<TFilter>,
    topK: number
  ): Promise<readonly EmbeddingSearchResult<TMetadata>[]> {
    const config = this.#requireConfig();
    const payload = await this.#fetch(`/collections/${config.collectionName}/points/search`, {
      method: "POST",
      body: JSON.stringify({
        vector: command.vector,
        filter: qdrantFilter(command.userId, command.filter),
        limit: topK,
        with_payload: true,
        with_vector: false
      })
    });
    return qdrantResultPoints(payload).map((point) => ({
      ...qdrantPointToRecord<TMetadata>(point),
      score: typeof point.score === "number" ? point.score : 0
    }));
  }

  /**
   * 按确定性的 provider id 读取一个 point。
   *
   * @param command 精确读取命令；`userId` 和公开 `id` 会生成 Qdrant point id。
   *
   * 实现方式：调用 `/points` 批量读取接口但只传一个 id，并要求返回 payload、不返回 vector。
   */
  async getById<TMetadata>(
    command: EmbeddingGetCommand
  ): Promise<EmbeddingRecord<TMetadata> | undefined> {
    const config = this.#requireConfig();
    const payload = await this.#fetch(`/collections/${config.collectionName}/points`, {
      method: "POST",
      body: JSON.stringify({
        ids: [qdrantPointId(command.userId, command.id)],
        with_payload: true,
        with_vector: false
      })
    });
    const point = qdrantResultPoints(payload)[0];
    return point === undefined ? undefined : qdrantPointToRecord<TMetadata>(point);
  }

  /**
   * 使用 Qdrant scroll 和同一套 userId 过滤条件分页列出 point。
   *
   * @param command 列表命令；`userId` 会被注入 filter，`filter` 是业务 metadata 条件。
   * @param page 页码，从 1 开始。
   * @param pageSize 每页数量。
   *
   * 实现方式：Qdrant scroll 没有直接 page 参数，所以先取 `page * pageSize` 条，再在本地 slice
   * 当前页。
   */
  async list<TFilter, TMetadata>(
    command: EmbeddingListCommand<TFilter>,
    page: number,
    pageSize: number
  ): Promise<readonly EmbeddingRecord<TMetadata>[]> {
    const config = this.#requireConfig();
    const payload = (await this.#fetch(`/collections/${config.collectionName}/points/scroll`, {
      method: "POST",
      body: JSON.stringify({
        filter: qdrantFilter(command.userId, command.filter),
        limit: page * pageSize,
        with_payload: true,
        with_vector: false
      })
    })) as QdrantScrollEnvelope;
    return qdrantScrollPoints(payload)
      .slice((page - 1) * pageSize, page * pageSize)
      .map((point) => qdrantPointToRecord<TMetadata>(point));
  }

  /**
   * 删除一个 userId 下匹配 metadata filter 的 point。
   *
   * @param userId 要删除的用户边界。
   * @param filter 业务 metadata 条件。
   *
   * 实现方式：复用 `#delete()`，内部会先按 filter scroll 计数，再按同一 filter 删除。
   */
  async deleteByFilter<TFilter>(userId: string, filter: TFilter): Promise<number> {
    return await this.#delete(userId, filter);
  }

  /**
   * 删除一个 userId 下的全部 point。
   *
   * @param userId 要删除的用户边界。
   *
   * 实现方式：传入 undefined filter，内部会构建只包含 userId 的 Qdrant filter。
   */
  async deleteByUser(userId: string): Promise<number> {
    return await this.#delete(userId, undefined);
  }

  /**
   * 删除前先统计匹配 point，保证公共 API 能返回确定的删除数量。
   *
   * Qdrant delete-by-filter 不直接返回我们需要的简单 affected count，
   * 所以 provider 先 scroll 匹配 id，再执行真正删除。
   */
  async #delete<TFilter>(userId: string, filter: TFilter | undefined): Promise<number> {
    const config = this.#requireConfig();
    const qdrantPayloadFilter =
      filter === undefined ? qdrantUserFilter(userId) : qdrantFilter(userId, filter);
    // 先 scroll 匹配点用于计数；删除响应不作为数量来源，避免不同 Qdrant 版本响应结构差异。
    const before = (await this.#fetch(`/collections/${config.collectionName}/points/scroll`, {
      method: "POST",
      body: JSON.stringify({
        filter: qdrantPayloadFilter,
        limit: 10_000,
        with_payload: false,
        with_vector: false
      })
    })) as QdrantScrollEnvelope;
    const points = qdrantScrollPoints(before);
    // 删除时复用完全相同的 filter，保证计数范围和删除范围一致。
    await this.#fetch(`/collections/${config.collectionName}/points/delete?wait=true`, {
      method: "POST",
      body: JSON.stringify({ filter: qdrantPayloadFilter })
    });
    return points.length;
  }

  /**
   * 执行一次 Qdrant 请求，并解析 JSON envelope。
   *
   * @param path Qdrant REST 路径。
   * @param init fetch 初始化参数，包含 method/body 等。
   *
   * 实现方式：先通过 `#fetchRaw()` 附加 header 并发请求，再交给 parseQdrantResponse 统一处理错误。
   */
  async #fetch(path: string, init: RequestInit): Promise<QdrantEnvelope> {
    return await parseQdrantResponse(await this.#fetchRaw(path, init));
  }

  /**
   * 附加 provider header 后执行原始 HTTP 请求。
   *
   * @param path Qdrant REST 路径。
   * @param init fetch 初始化参数。
   *
   * 实现方式：统一设置 content-type；若配置了 API key，则写入 `api-key` header。
   */
  async #fetchRaw(path: string, init: RequestInit): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("content-type", "application/json");
    if (this.#apiKey !== undefined) {
      headers.set("api-key", this.#apiKey);
    }
    return await fetch(`${this.#requireEndpoint()}${path}`, { ...init, headers });
  }

  #requireConfig(): EmbeddingDbConfig {
    if (this.#config === undefined) {
      throw createFoundationError({
        component: "embedding_db",
        code: "FOUNDATION_NOT_INITIALIZED",
        message: "qdrant embedding db is not initialized",
        retryable: false
      });
    }
    return this.#config;
  }

  #requireEndpoint(): string {
    if (this.#endpoint === undefined) {
      throw createFoundationError({
        component: "embedding_db",
        code: "FOUNDATION_NOT_INITIALIZED",
        message: "qdrant embedding db is not initialized",
        retryable: false
      });
    }
    return this.#endpoint;
  }
}

/** 生成 Qdrant UUID 风格 point id；参数 userId 是隔离键，id 是公开业务 id。 */
const qdrantPointId = (userId: string, id: string): string => {
  const hex = createHash("sha256").update(`${userId}:${id}`).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

/** 把 Foundation 的距离名称映射为 Qdrant collection distance enum。 */
const qdrantDistance = (distance: EmbeddingDbConfig["distance"]): "Cosine" | "Dot" | "Euclid" =>
  distance === "cosine" ? "Cosine" : distance === "dot" ? "Dot" : "Euclid";

/** 构建 deleteByUser 使用的最小 userId-only filter。 */
const qdrantUserFilter = (userId: string): Record<string, unknown> => ({
  must: [{ key: "userId", match: { value: userId } }]
});

/** 构建包含强制 userId 隔离和 metadata 条件的 Qdrant filter。 */
const qdrantFilter = (userId: string, filter: unknown): Record<string, unknown> => ({
  must: [
    { key: "userId", match: { value: userId } },
    ...qdrantMetadataConditions("metadata", filter)
  ]
});

/**
 * 把嵌套 metadata filter 转换成 Qdrant 点号 payload path。
 *
 * 例如 `{ nested: { file: 1 } }` 会变成 `metadata.nested.file` 条件。
 */
const qdrantMetadataConditions = (
  prefix: string,
  filter: unknown
): readonly Record<string, unknown>[] => {
  if (!isPlainRecord(filter)) {
    return [];
  }
  return Object.entries(filter).flatMap(([key, value]) => {
    const path = `${prefix}.${key}`;
    if (isPlainRecord(value)) {
      return qdrantMetadataConditions(path, value);
    }
    return [{ key: path, match: { value } }];
  });
};

/**
 * 从 Qdrant payload 还原公共 EmbeddingDb record 结构。
 */
const qdrantPointToRecord = <TMetadata>(point: QdrantPoint): EmbeddingRecord<TMetadata> => {
  const payload = point.payload;
  if (
    payload === undefined ||
    typeof payload.id !== "string" ||
    typeof payload.content !== "string"
  ) {
    throw createFoundationError({
      component: "embedding_db",
      code: "FOUNDATION_EMBEDDING_QDRANT_PAYLOAD_INVALID",
      message: "qdrant point payload is missing required memory fields",
      retryable: false
    });
  }
  return { id: payload.id, content: payload.content, metadata: payload.metadata as TMetadata };
};

/**
 * 从 Qdrant search response envelope 中提取 point。
 */
const qdrantResultPoints = (payload: QdrantEnvelope): readonly QdrantPoint[] =>
  Array.isArray(payload.result) ? payload.result.filter(isQdrantPoint) : [];

/**
 * 从 Qdrant scroll response envelope 中提取 point。
 */
const qdrantScrollPoints = (payload: QdrantScrollEnvelope): readonly QdrantPoint[] =>
  Array.isArray(payload.result?.points) ? payload.result.points.filter(isQdrantPoint) : [];

/**
 * 对可能是 point 的响应值做类型收窄。
 */
const isQdrantPoint = (value: unknown): value is QdrantPoint =>
  value !== null && typeof value === "object";

/**
 * 解析 Qdrant JSON，并把非成功响应转换成 Foundation 错误。
 */
const parseQdrantResponse = async (response: Response): Promise<QdrantEnvelope> => {
  const text = await response.text();
  const body = text.length === 0 ? {} : (JSON.parse(text) as QdrantEnvelope);
  if (!response.ok) {
    throw createFoundationError({
      component: "embedding_db",
      code: "FOUNDATION_EMBEDDING_QDRANT_REQUEST_FAILED",
      message: `qdrant request failed: ${response.status} ${text.slice(0, 500)}`,
      retryable: response.status >= 500
    });
  }
  return body;
};
