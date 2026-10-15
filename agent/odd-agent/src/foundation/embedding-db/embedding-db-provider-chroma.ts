import { createHash } from "node:crypto";
import { createFoundationError, nowIso } from "../foundation-types.js";
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

export type ChromaEmbeddingDbProviderConfig = {
  readonly endpoint: string;
};

type ChromaEnvelope = {
  readonly id?: string;
  readonly name?: string;
  readonly ids?: readonly string[] | readonly string[][];
  readonly documents?: readonly (string | null)[] | readonly (readonly (string | null)[])[];
  readonly metadatas?: readonly unknown[] | readonly (readonly unknown[])[];
  readonly distances?: readonly number[] | readonly (readonly number[])[];
};

/**
 * Chroma provider，基于 Chroma HTTP API 实现。
 *
 * Chroma 会分开存 ids、documents、embeddings 和 metadata。该 provider 把
 * EmbeddingDb content 存成 Chroma document，并把原始 metadata 存在
 * Chroma metadata 中，读取时再还原调用方面向的 record。
 */
export class ChromaEmbeddingDbProvider implements EmbeddingDbProvider {
  readonly name = "chroma";
  #endpoint: string | undefined;
  #collectionId: string | undefined;

  constructor(private readonly providerConfig: ChromaEmbeddingDbProviderConfig) {}

  /**
   * 初始化 Chroma collection。
   *
   * @param config Foundation 公共配置；collectionName 用于创建/读取 Chroma collection，
   * dimension/distance 会作为 collection metadata 记录，方便排查配置。
   *
   * Chroma collection 是 embedding 的存储边界；provider 会尝试
   * 创建 collection，并兼容 collection 已存在的响应。
   */
  async init(config: EmbeddingDbConfig): Promise<void> {
    this.#endpoint = this.providerConfig.endpoint.replace(/\/+$/u, "");
    const collection = await this.#createOrReadCollection(config);
    if (typeof collection.id !== "string") {
      throw createFoundationError({
        component: "embedding_db",
        code: "FOUNDATION_EMBEDDING_CHROMA_PAYLOAD_INVALID",
        message: "chroma collection payload is missing id",
        retryable: false
      });
    }
    // Chroma 0.5 后续 API 需要 collection UUID，因此初始化成功后必须保存 id。
    this.#collectionId = collection.id;
  }

  /**
   * 检查当前配置的 collection 是否可读取。
   *
   * 参数：无。
   *
   * GET 成功说明 Chroma server 和 collection 都可访问。
   */
  async healthCheck() {
    await this.#request(`/api/v1/collections/${this.#requireCollectionId()}`, "GET");
    return { status: "healthy" as const, message: "embedding db initialized", checkedAt: nowIso() };
  }

  /**
   * 清空当前进程内的 endpoint 状态。
   *
   * 参数：无。
   *
   * 该 provider 通过无状态 HTTP 调用访问 Chroma。
   */
  close(): Promise<void> {
    this.#endpoint = undefined;
    this.#collectionId = undefined;
    return Promise.resolve();
  }

  /**
   * 通过先删除旧 id 再 add 新 payload 的方式实现 upsert。
   *
   * @param command 写入命令；`userId` 和 `id` 生成 Chroma id，`vector` 写入 embeddings，
   * `content` 写入 documents，`metadata` 写入 metadatas。
   *
   * Chroma add API 要求 id 唯一，所以先 delete 再 add 可以提供 EmbeddingDb 覆盖写入
   * 语义，并且不把这个 provider 细节暴露给调用方。
   */
  async upsert(command: EmbeddingUpsertCommand<Record<string, unknown>>): Promise<void> {
    const collectionId = this.#requireCollectionId();
    const id = chromaId(command.userId, command.id);
    // 删除旧 id 的失败被忽略，因为首次写入时该 id 本来就不存在；后续 add 才是最终写入动作。
    await this.#request(`/api/v1/collections/${collectionId}/delete`, "POST", {
      ids: [id]
    }).catch(() => undefined);
    await this.#request(`/api/v1/collections/${collectionId}/add`, "POST", {
      ids: [id],
      embeddings: [command.vector],
      documents: [command.content],
      metadatas: [
        {
          userId: command.userId,
          originalId: command.id,
          metadataJson: JSON.stringify(command.metadata),
          ...flattenChromaMetadata(command.metadata)
        }
      ]
    });
  }

  /**
   * 使用 userId 作用域内的 metadata filter 执行向量相似度检索。
   *
   * @param command 检索命令；`vector` 是 query embedding，`filter` 是业务 metadata 条件，
   * `userId` 会被强制注入 Chroma where。
   * @param topK 最大召回数量。
   *
   * 实现方式：调用 Chroma query，返回 documents/metadatas/distances；provider 再把 distance
   * 转成 EmbeddingDb score。
   *
   * Chroma 的 `where` filter 使用 `$and` 条件构建，确保 `userId` 总是先于
   * 调用方 metadata 条件被应用。
   */
  async search<TFilter, TMetadata>(
    command: EmbeddingSearchCommand<TFilter>,
    topK: number
  ): Promise<readonly EmbeddingSearchResult<TMetadata>[]> {
    const payload = await this.#request(
      `/api/v1/collections/${this.#requireCollectionId()}/query`,
      "POST",
      {
        query_embeddings: [command.vector],
        n_results: topK,
        where: chromaWhere(command.userId, command.filter),
        include: ["documents", "metadatas", "distances"]
      }
    );
    return chromaRows(payload).map((row) => chromaToSearchResult<TMetadata>(row));
  }

  /**
   * 按稳定 Chroma id 读取单条记录。
   *
   * @param command 精确读取命令；`userId` 和公开 `id` 会生成 Chroma id。
   *
   * 实现方式：调用 Chroma get，并要求返回 documents/metadatas；返回后用 metadataJson 还原
   * 原始业务 metadata。
   *
   * provider id 由 `(userId,id)` 确定性生成；公开 id 会从
   * metadata 中还原后再返回。
   */
  async getById<TMetadata>(
    command: EmbeddingGetCommand
  ): Promise<EmbeddingRecord<TMetadata> | undefined> {
    const payload = await this.#request(
      `/api/v1/collections/${this.#requireCollectionId()}/get`,
      "POST",
      {
        ids: [chromaId(command.userId, command.id)],
        include: ["documents", "metadatas"]
      }
    );
    const row = chromaRows(payload)[0];
    return row === undefined ? undefined : chromaToRecord<TMetadata>(row);
  }

  /**
   * 按 metadata filter 列出记录。
   *
   * @param command 列表命令；`userId` 会被注入 where，`filter` 是业务 metadata 条件。
   * @param page 页码，从 1 开始。
   * @param pageSize 每页数量。
   *
   * 实现方式：调用 Chroma get，直接使用 limit/offset 做分页，并返回 documents/metadatas。
   *
   * Chroma get 支持 `where`、`limit` 和 `offset`，可以直接映射到 EmbeddingDb
   * 注入 userId 隔离后的分页语义。
   */
  async list<TFilter, TMetadata>(
    command: EmbeddingListCommand<TFilter>,
    page: number,
    pageSize: number
  ): Promise<readonly EmbeddingRecord<TMetadata>[]> {
    const payload = await this.#request(
      `/api/v1/collections/${this.#requireCollectionId()}/get`,
      "POST",
      {
        where: chromaWhere(command.userId, command.filter),
        limit: pageSize,
        offset: (page - 1) * pageSize,
        include: ["documents", "metadatas"]
      }
    );
    return chromaRows(payload).map((row) => chromaToRecord<TMetadata>(row));
  }

  /**
   * 删除一个 userId 下匹配 metadata filter 的记录。
   *
   * @param userId 要删除的用户边界。
   * @param filter 业务 metadata 条件。
   *
   * 实现方式：先构造带 userId 的 where，再交给内部 `#delete()` 读取 id 并删除。
   *
   * 方法先读取匹配 id，这样可以返回确定的删除数量。
   */
  async deleteByFilter<TFilter>(userId: string, filter: TFilter): Promise<number> {
    return await this.#delete(chromaWhere(userId, filter));
  }

  /**
   * 删除一个 userId 下的全部记录。
   *
   * @param userId 要删除的用户边界。
   *
   * 实现方式：构造 `{ userId }` where 并复用内部 `#delete()`。
   *
   * 这里使用 metadata 过滤而不是删除 collection，因为 collection 是
   * 所有 EmbeddingDb 用户共享的。
   */
  async deleteByUser(userId: string): Promise<number> {
    return await this.#delete({ userId });
  }

  /**
   * 通过 Chroma 的 id-based delete endpoint 删除记录。
   *
   * @param where 已包含 userId 隔离的 Chroma where 条件。
   *
   * 实现方式：先用 get 读取匹配 ids，再用 delete endpoint 删除这些 ids。
   *
   * Chroma delete endpoint 不提供可移植的 affected count，所以 provider
   * 会先用 `get` 读取匹配 id，再显式删除这些 id。
   */
  async #delete(where: Record<string, unknown>): Promise<number> {
    const collectionId = this.#requireCollectionId();
    const before = await this.#request(`/api/v1/collections/${collectionId}/get`, "POST", {
      where,
      include: ["metadatas"]
    });
    const ids = chromaIds(before);
    if (ids.length > 0) {
      // 只在确实有 id 时调用 delete，避免部分 Chroma 版本对空 ids 请求返回错误。
      await this.#request(`/api/v1/collections/${collectionId}/delete`, "POST", { ids });
    }
    return ids.length;
  }

  /**
   * 创建 collection；如果已存在则读取它。
   *
   * @param config Foundation 公共配置，用于 collection name 和 metadata。
   *
   * 实现方式：优先 POST 创建；如果服务返回 already exists/409，则 GET 读取已有 collection。
   *
   * Chroma 0.5 后续 collection 操作需要使用 collection UUID，所以
   * 这里保存返回的 id，而不是继续使用可读 collection name。
   */
  async #createOrReadCollection(config: EmbeddingDbConfig): Promise<ChromaEnvelope> {
    const created = await this.#request("/api/v1/collections", "POST", {
      name: config.collectionName,
      metadata: { dimension: config.dimension, distance: config.distance }
    }).catch(async (cause: unknown) => {
      if (cause instanceof Error && /already exists|409/iu.test(cause.message)) {
        return await this.#request(`/api/v1/collections/${config.collectionName}`, "GET");
      }
      throw cause;
    });
    return typeof created.id === "string"
      ? created
      : await this.#request(`/api/v1/collections/${config.collectionName}`, "GET");
  }

  /**
   * 发送一次 Chroma HTTP 请求，并把非成功响应归一化为 Foundation 错误。
   *
   * @param path Chroma REST 路径。
   * @param method HTTP 方法；当前 provider 使用 GET/POST。
   * @param body 可选 JSON body。
   *
   * 实现方式：统一设置 accept/content-type，解析 JSON 响应，非 2xx 时抛 Foundation 错误。
   */
  async #request(
    path: string,
    method: "GET" | "POST",
    body?: Record<string, unknown>
  ): Promise<ChromaEnvelope> {
    const headers = new Headers({ accept: "application/json" });
    if (body !== undefined) {
      headers.set("content-type", "application/json");
    }
    const response = await fetch(`${this.#requireEndpoint()}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const text = await response.text();
    const payload = text.length === 0 ? {} : (JSON.parse(text) as ChromaEnvelope);
    if (!response.ok) {
      throw createFoundationError({
        component: "embedding_db",
        code: "FOUNDATION_EMBEDDING_CHROMA_REQUEST_FAILED",
        message: `chroma request failed: ${response.status} ${text.slice(0, 500)}`,
        retryable: response.status >= 500
      });
    }
    return payload;
  }

  #requireEndpoint(): string {
    if (this.#endpoint === undefined) {
      throw createFoundationError({
        component: "embedding_db",
        code: "FOUNDATION_NOT_INITIALIZED",
        message: "chroma embedding db is not initialized",
        retryable: false
      });
    }
    return this.#endpoint;
  }

  #requireCollectionId(): string {
    if (this.#collectionId === undefined) {
      throw createFoundationError({
        component: "embedding_db",
        code: "FOUNDATION_NOT_INITIALIZED",
        message: "chroma embedding db collection id is not initialized",
        retryable: false
      });
    }
    return this.#collectionId;
  }
}

type ChromaRow = {
  readonly id: string;
  readonly document: string;
  readonly metadata: unknown;
  readonly distance: number | undefined;
};

/** 生成稳定 Chroma id；参数 userId 是隔离键，id 是公开业务 id。 */
const chromaId = (userId: string, id: string): string =>
  createHash("sha256").update(`${userId}:${id}`).digest("hex");

/**
 * 只保留 Chroma 可以直接过滤的标量 metadata 字段。
 *
 * @param metadata 调用方写入的结构化 metadata。
 *
 * 实现方式：过滤出 string/number/boolean 字段；完整结构继续保存在 metadataJson 中。
 *
 * 原始结构化 metadata 仍然会通过 `metadataJson` 保留。
 */
const flattenChromaMetadata = (metadata: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(metadata).filter(([, value]) =>
      ["string", "number", "boolean"].includes(typeof value)
    )
  );

/** 构建包含强制 userId 隔离的 Chroma `where` filter；filter 只接收可直接过滤的标量字段。 */
const chromaWhere = (userId: string, filter: unknown): Record<string, unknown> => {
  const clauses: Record<string, unknown>[] = [{ userId }];
  if (filter !== null && typeof filter === "object" && !Array.isArray(filter)) {
    for (const [key, value] of Object.entries(filter)) {
      if (["string", "number", "boolean"].includes(typeof value)) {
        clauses.push({ [key]: safeMetadataValue(value) });
      }
    }
  }
  return clauses.length === 1 ? (clauses[0] ?? {}) : { $and: clauses };
};

/** 从 query 风格的嵌套数组或 get 风格的扁平数组中提取 id。 */
const chromaIds = (payload: ChromaEnvelope): readonly string[] => {
  const ids = payload.ids;
  const flat = Array.isArray(ids?.[0])
    ? (ids[0] as readonly unknown[])
    : (ids as readonly unknown[] | undefined);
  return flat?.filter((id): id is string => typeof id === "string") ?? [];
};

/** 把 Chroma 返回的 ids/documents/metadatas/distances 并行数组合并成 row 对象。 */
const chromaRows = (payload: ChromaEnvelope): readonly ChromaRow[] => {
  const ids = chromaIds(payload);
  const documents = firstChromaArray(payload.documents);
  const metadatas = firstChromaArray(payload.metadatas);
  const distances = firstChromaArray(payload.distances);
  return ids.flatMap((id, index) => {
    const document = documents[index];
    if (typeof document !== "string") {
      return [];
    }
    const distance = distances[index];
    return [
      {
        id,
        document,
        metadata: metadatas[index],
        distance: typeof distance === "number" ? distance : undefined
      }
    ];
  });
};

/** query 响应返回第一行数组；get 响应则直接返回扁平数组。 */
const firstChromaArray = (value: unknown): readonly unknown[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const first: unknown = value[0];
  return Array.isArray(first) ? first : value;
};

/** 从 Chroma document 和 metadata 字段还原公共 EmbeddingDb record。 */
const chromaToRecord = <TMetadata>(row: ChromaRow): EmbeddingRecord<TMetadata> => {
  if (row.metadata === null || typeof row.metadata !== "object" || Array.isArray(row.metadata)) {
    throw createFoundationError({
      component: "embedding_db",
      code: "FOUNDATION_EMBEDDING_CHROMA_PAYLOAD_INVALID",
      message: "chroma metadata is missing",
      retryable: false
    });
  }
  const metadata = row.metadata as Record<string, unknown>;
  if (typeof metadata["originalId"] !== "string") {
    throw createFoundationError({
      component: "embedding_db",
      code: "FOUNDATION_EMBEDDING_CHROMA_PAYLOAD_INVALID",
      message: "chroma metadata is missing originalId",
      retryable: false
    });
  }
  const parsed =
    typeof metadata["metadataJson"] === "string"
      ? (JSON.parse(metadata["metadataJson"]) as TMetadata)
      : ({} as TMetadata);
  return { id: metadata["originalId"], content: row.document, metadata: parsed };
};

/** 把 Chroma distance 转成 EmbeddingDb 的分数约定：值越大越相似。 */
const chromaToSearchResult = <TMetadata>(row: ChromaRow): EmbeddingSearchResult<TMetadata> => ({
  ...chromaToRecord<TMetadata>(row),
  score: typeof row.distance === "number" ? -row.distance : 0
});

/** 在值进入 Chroma `where` filter 前校验它必须是 string/number/boolean 标量。 */
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
