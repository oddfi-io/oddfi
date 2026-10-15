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

export type MilvusEmbeddingDbProviderConfig = {
  readonly endpoint: string;
  readonly tokenSecretRef?: string;
  readonly dbName?: string;
  readonly partitionName?: string;
};

type MilvusEnvelope = {
  readonly code?: number;
  readonly message?: string;
  readonly data?: unknown;
};

type MilvusEntity = {
  readonly id?: unknown;
  readonly originalId?: unknown;
  readonly content?: unknown;
  readonly metadata?: unknown;
  readonly distance?: unknown;
  readonly score?: unknown;
};

/**
 * Milvus provider，基于 Milvus REST API 实现。
 *
 * collection 使用 Milvus quick-setup 模式创建；每条记录都保存稳定 provider id 和原始业务 id。
 * userId 会作为标量字段写入，并在 search/query/delete 表达式中强制参与过滤。
 */
export class MilvusEmbeddingDbProvider implements EmbeddingDbProvider {
  readonly name = "milvus";
  #config: EmbeddingDbConfig | undefined;
  #endpoint: string | undefined;
  #token: string | undefined;

  constructor(private readonly providerConfig: MilvusEmbeddingDbProviderConfig) {}

  /**
   * 初始化 EmbeddingDb 使用的 Milvus collection。
   *
   * @param config Foundation 公共配置；collectionName 是 Milvus collection 名，dimension 和
   * distance 用于创建向量字段。
   * @param deps 初始化依赖；当 tokenSecretRef 存在时会从 deps.secretProvider 读取 token。
   *
   * 实现方式：先解析 endpoint/token，再列出 collection；不存在时用 quick-setup 参数创建；
   * 最后执行 load，确保后续 search/query 能立即访问。quick-setup 的 dynamic fields 让 provider
   * 可以保存 content、metadata 和 userId，而不把 Milvus schema 细节暴露到 Foundation 配置。
   */
  async init(config: EmbeddingDbConfig, deps?: FoundationInitDeps): Promise<void> {
    this.#config = config;
    this.#endpoint = this.providerConfig.endpoint.replace(/\/+$/u, "");
    this.#token =
      this.providerConfig.tokenSecretRef === undefined
        ? undefined
        : await resolveSecret("embedding_db", deps, this.providerConfig.tokenSecretRef);

    // 先列出 collection，是为了在 provider init 阶段兼容“已有 collection”和“首次创建”两种启动路径。
    const collections = await this.#request("/v2/vectordb/collections/list", {
      dbName: this.#dbName()
    });
    const names = milvusNames(collections.data);
    if (!names.includes(config.collectionName)) {
      // collection 不存在时使用 Milvus quick-setup 创建，避免为了基础库引入复杂 schema 编排。
      await this.#request("/v2/vectordb/collections/create", {
        dbName: this.#dbName(),
        collectionName: config.collectionName,
        dimension: config.dimension,
        metricType: milvusMetric(config.distance),
        idType: "VarChar",
        autoID: false,
        primaryFieldName: "id",
        vectorFieldName: "vector",
        params: { max_length: "512" }
      });
    }
    // Milvus collection 创建或重启后需要 load；这里放在 init 末尾保证后续读写路径可用。
    await this.#request("/v2/vectordb/collections/load", {
      dbName: this.#dbName(),
      collectionName: config.collectionName
    });
  }

  /**
   * 检查当前配置的 Milvus collection 是否可访问。
   *
   * 参数：无。
   *
   * 实现方式：通过 collections/list 判断 collectionName 是否存在。这里不用向量 search，是为了
   * 保持健康检查低成本，也避免构造探测向量。
   */
  async healthCheck() {
    const config = this.#requireConfig();
    const collections = await this.#request("/v2/vectordb/collections/list", {
      dbName: this.#dbName()
    });
    return {
      status: milvusNames(collections.data).includes(config.collectionName)
        ? ("healthy" as const)
        : ("unhealthy" as const),
      message: "milvus embedding db collection check completed",
      checkedAt: nowIso()
    };
  }

  /**
   * 清空当前进程内的连接状态。
   *
   * 参数：无。
   *
   * 实现方式：清空 endpoint/token。这里通过无状态 HTTP 访问 Milvus，所以没有 socket pool 需要关闭。
   */
  close(): Promise<void> {
    this.#endpoint = undefined;
    this.#token = undefined;
    return Promise.resolve();
  }

  /**
   * 向 Milvus 写入或覆盖一条 EmbeddingDb record。
   *
   * @param command 写入命令；`userId` 和 `id` 会生成 Milvus 主键，`vector/content/metadata`
   * 分别写入对应字段。
   *
   * 实现方式：先按 provider id 删除旧记录，再执行 upsert。Milvus 主键是 `(userId,id)` 的稳定
   * hash；原始业务 id 另存为 `originalId`，避免调用方看到 provider 私有 id。
   */
  async upsert(command: EmbeddingUpsertCommand<Record<string, unknown>>): Promise<void> {
    const config = this.#requireConfig();
    const id = milvusEntityId(command.userId, command.id);
    // 删除旧 id 是为了让 REST 场景下覆盖写入的可见性更稳定，避免同 id 出现重复动态字段记录。
    await this.#request("/v2/vectordb/entities/delete", {
      dbName: this.#dbName(),
      collectionName: config.collectionName,
      filter: `id in [${JSON.stringify(id)}]`
    }).catch(() => undefined);
    await this.#request("/v2/vectordb/entities/upsert", {
      dbName: this.#dbName(),
      collectionName: config.collectionName,
      ...(this.providerConfig.partitionName === undefined
        ? {}
        : { partitionName: this.providerConfig.partitionName }),
      data: [
        {
          id,
          originalId: command.id,
          userId: command.userId,
          content: command.content,
          metadata: command.metadata,
          vector: command.vector
        }
      ]
    });
  }

  /**
   * 在一个 userId 边界内按向量相似度检索 Milvus。
   *
   * @param command 检索命令；`vector` 是 query 向量，`filter` 是业务 metadata 条件，`userId`
   * 会被注入 Milvus scalar filter。
   * @param topK 最大召回数量。
   *
   * 实现方式：调用 entities/search，filter 总是以 `userId == ...` 开头，再拼接 metadata JSON
   * 表达式，确保 ANN search 不跨租户。
   */
  async search<TFilter, TMetadata>(
    command: EmbeddingSearchCommand<TFilter>,
    topK: number
  ): Promise<readonly EmbeddingSearchResult<TMetadata>[]> {
    const config = this.#requireConfig();
    const payload = await this.#request("/v2/vectordb/entities/search", {
      dbName: this.#dbName(),
      collectionName: config.collectionName,
      data: [command.vector],
      annsField: "vector",
      filter: milvusFilter(command.userId, command.filter),
      limit: topK,
      outputFields: ["originalId", "content", "metadata"]
    });
    return milvusEntities(payload.data).map((entity) => milvusToSearchResult<TMetadata>(entity));
  }

  /**
   * 按公开 `(userId,id)` key 读取单条记录。
   *
   * @param command 精确读取命令；`userId` 和 `id` 用于生成 Milvus provider id。
   *
   * 实现方式：用 hashed provider id 查询，比 metadata scan 更便宜，也不会因为不同用户同 id
   * 产生歧义。
   */
  async getById<TMetadata>(
    command: EmbeddingGetCommand
  ): Promise<EmbeddingRecord<TMetadata> | undefined> {
    const config = this.#requireConfig();
    const payload = await this.#request("/v2/vectordb/entities/query", {
      dbName: this.#dbName(),
      collectionName: config.collectionName,
      filter: `id in [${JSON.stringify(milvusEntityId(command.userId, command.id))}]`,
      outputFields: ["originalId", "content", "metadata"]
    });
    const entity = milvusEntities(payload.data)[0];
    return entity === undefined ? undefined : milvusToRecord<TMetadata>(entity);
  }

  /**
   * 按 metadata filter 列出一个 userId 下的记录。
   *
   * @param command 列表命令；`userId` 会被注入 Milvus filter，`filter` 是业务 metadata 条件。
   * @param page 页码，从 1 开始。
   * @param pageSize 每页数量。
   *
   * 实现方式：Milvus REST query 基于 scalar filter 返回过滤后记录，provider 再本地 slice 当前页，
   * 保持和其它 provider 的分页行为一致。
   */
  async list<TFilter, TMetadata>(
    command: EmbeddingListCommand<TFilter>,
    page: number,
    pageSize: number
  ): Promise<readonly EmbeddingRecord<TMetadata>[]> {
    const config = this.#requireConfig();
    const payload = await this.#request("/v2/vectordb/entities/query", {
      dbName: this.#dbName(),
      collectionName: config.collectionName,
      filter: milvusFilter(command.userId, command.filter),
      outputFields: ["originalId", "content", "metadata"],
      limit: page * pageSize
    });
    return milvusEntities(payload.data)
      .slice((page - 1) * pageSize, page * pageSize)
      .map((entity) => milvusToRecord<TMetadata>(entity));
  }

  /**
   * 删除一个 userId 下匹配 metadata filter 的记录。
   *
   * @param userId 要删除的用户边界。
   * @param filter 业务 metadata 条件，会拼入 Milvus filter 表达式。
   *
   * 实现方式：先构造带 userId 的 Milvus filter，再交给内部 `#delete()` 查询 id 并删除。
   */
  async deleteByFilter<TFilter>(userId: string, filter: TFilter): Promise<number> {
    return await this.#delete(milvusFilter(userId, filter));
  }

  /**
   * 删除一个 userId 下的全部记录。
   *
   * @param userId 要删除的用户边界。
   *
   * 实现方式：构造仅包含 userId 的 filter 并复用内部 `#delete()`，这样仍能先查询 id 并返回
   * 可审计的删除数量。
   */
  async deleteByUser(userId: string): Promise<number> {
    return await this.#delete(`userId == ${JSON.stringify(userId)}`);
  }

  /**
   * 先查询 provider id，再删除这些 id。
   *
   * @param filter 已经包含 userId 隔离的 Milvus filter 表达式。
   *
   * 实现方式：Milvus REST delete 响应不保证包含 affected row count，所以这里先 query 出 id，
   * 再用 `id in [...]` 删除，从而给 EmbeddingDb 返回确定数量。
   */
  async #delete(filter: string): Promise<number> {
    const config = this.#requireConfig();
    const before = await this.#request("/v2/vectordb/entities/query", {
      dbName: this.#dbName(),
      collectionName: config.collectionName,
      filter,
      outputFields: ["id"],
      limit: 10_000
    });
    const ids = milvusEntities(before.data)
      .map((entity) => entity.id)
      .filter((id): id is string => typeof id === "string");
    if (ids.length > 0) {
      // 删除时只使用 provider id，避免 metadata 条件在删除和查询之间因动态字段表达式差异产生偏差。
      await this.#request("/v2/vectordb/entities/delete", {
        dbName: this.#dbName(),
        collectionName: config.collectionName,
        filter: `id in [${ids.map((id) => JSON.stringify(id)).join(", ")}]`
      });
    }
    return ids.length;
  }

  /**
   * 发送一次 Milvus REST 请求，并同时校验 HTTP 状态和 Milvus envelope 状态。
   *
   * @param path Milvus REST 路径。
   * @param body 请求 JSON body；必须包含 dbName/collectionName 等接口所需字段。
   *
   * 实现方式：统一附加 JSON header 和可选 bearer token；解析响应后同时检查 HTTP status 与
   * payload.code，因为 Milvus 可能 HTTP 200 但 envelope 表示失败。
   */
  async #request(path: string, body: Record<string, unknown>): Promise<MilvusEnvelope> {
    const headers = new Headers({ accept: "application/json", "content-type": "application/json" });
    if (this.#token !== undefined) {
      headers.set("authorization", `Bearer ${this.#token}`);
    }
    const response = await fetch(`${this.#requireEndpoint()}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    const text = await response.text();
    const payload = text.length === 0 ? {} : (JSON.parse(text) as MilvusEnvelope);
    if (
      !response.ok ||
      (typeof payload.code === "number" && payload.code !== 0 && payload.code !== 200)
    ) {
      throw createFoundationError({
        component: "embedding_db",
        code: "FOUNDATION_EMBEDDING_MILVUS_REQUEST_FAILED",
        message: `milvus request failed: ${response.status} ${payload.message ?? text.slice(0, 500)}`,
        retryable: response.status >= 500
      });
    }
    return payload;
  }

  #dbName(): string {
    return this.providerConfig.dbName ?? "_default";
  }

  #requireConfig(): EmbeddingDbConfig {
    if (this.#config === undefined) {
      throw createFoundationError({
        component: "embedding_db",
        code: "FOUNDATION_NOT_INITIALIZED",
        message: "milvus embedding db is not initialized",
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
        message: "milvus embedding db is not initialized",
        retryable: false
      });
    }
    return this.#endpoint;
  }
}

/** 生成 Milvus 稳定主键；参数 userId 是隔离键，id 是公开业务 id。 */
const milvusEntityId = (userId: string, id: string): string =>
  createHash("sha256").update(`${userId}:${id}`).digest("hex");

/** 把 Foundation 距离名称映射为 Milvus metric 名称。 */
const milvusMetric = (distance: EmbeddingDbConfig["distance"]): "COSINE" | "IP" | "L2" =>
  distance === "cosine" ? "COSINE" : distance === "dot" ? "IP" : "L2";

/** 从不同 Milvus 版本的 REST 响应变体中提取 collection name。 */
const milvusNames = (data: unknown): readonly string[] =>
  Array.isArray(data)
    ? data.filter((item): item is string => typeof item === "string")
    : Array.isArray((data as { readonly collectionNames?: unknown }).collectionNames)
      ? (data as { readonly collectionNames: readonly unknown[] }).collectionNames.filter(
          (item): item is string => typeof item === "string"
        )
      : [];

/** 构建包含强制 userId 隔离的 Milvus scalar filter。 */
const milvusFilter = (userId: string, filter: unknown): string => {
  const clauses = [
    `userId == ${JSON.stringify(userId)}`,
    ...milvusMetadataClauses("metadata", filter)
  ];
  return clauses.join(" and ");
};

/** 把嵌套 metadata filter 转换成 Milvus JSON 字段 filter 表达式。 */
const milvusMetadataClauses = (prefix: string, filter: unknown): readonly string[] => {
  if (filter === null || typeof filter !== "object" || Array.isArray(filter)) {
    return [];
  }
  return Object.entries(filter).flatMap(([key, value]) => {
    const path = `${prefix}[${JSON.stringify(key)}]`;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      return milvusMetadataClauses(path, value);
    }
    return [`${path} == ${JSON.stringify(value)}`];
  });
};

/** 从 Milvus 响应变体中提取 entity rows。 */
const milvusEntities = (data: unknown): readonly MilvusEntity[] => {
  if (Array.isArray(data)) {
    return data.filter(isMilvusEntity);
  }
  const rows =
    (data as { readonly rows?: unknown; readonly data?: unknown }).rows ??
    (data as { readonly data?: unknown }).data;
  return Array.isArray(rows) ? rows.filter(isMilvusEntity) : [];
};

/** 对可能是 Milvus entity row 的值做类型收窄。 */
const isMilvusEntity = (value: unknown): value is MilvusEntity =>
  value !== null && typeof value === "object";

/** 从 Milvus dynamic fields 还原公共 EmbeddingDb record。 */
const milvusToRecord = <TMetadata>(entity: MilvusEntity): EmbeddingRecord<TMetadata> => {
  if (typeof entity.originalId !== "string" || typeof entity.content !== "string") {
    throw createFoundationError({
      component: "embedding_db",
      code: "FOUNDATION_EMBEDDING_MILVUS_PAYLOAD_INVALID",
      message: "milvus entity is missing originalId or content",
      retryable: false
    });
  }
  return { id: entity.originalId, content: entity.content, metadata: entity.metadata as TMetadata };
};

/** 把 Milvus search row 转成公共 search result；score/distance 缺失时按 0 处理。 */
const milvusToSearchResult = <TMetadata>(
  entity: MilvusEntity
): EmbeddingSearchResult<TMetadata> => ({
  ...milvusToRecord<TMetadata>(entity),
  score:
    typeof entity.score === "number"
      ? entity.score
      : typeof entity.distance === "number"
        ? entity.distance
        : 0
});
