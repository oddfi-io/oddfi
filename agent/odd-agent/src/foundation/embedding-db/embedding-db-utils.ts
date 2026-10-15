import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { createFoundationError } from "../foundation-types.js";
import type { LogFields } from "../logger/logger-component.js";
import type { EmbeddingDbConfig, EmbeddingVector } from "./embedding-db-types.js";

export const defaultMaxContentBytes = 65_536;
export const defaultMaxMetadataBytes = 16_384;

/**
 * 构建 EmbeddingDb 操作共用的结构化日志字段。
 *
 * @param component 日志所属组件名，EmbeddingDb 调用时固定传 `embedding_db`。
 * @param traceId 可选链路 id；清理类 API 可能没有请求上下文，所以允许省略。
 *
 * 实现方式：始终写入 component；只有 traceId 存在时才写入 `trace_id`，避免日志里出现 undefined。
 */
export const buildLogFields = (component: string, traceId?: string): LogFields => ({
  component,
  ...(traceId === undefined ? {} : { trace_id: traceId })
});

/**
 * 校验 collectionName 是否符合 SQL identifier 安全子集。
 *
 * @param collectionName provider 私有存储名。
 *
 * 实现方式：只允许字母/数字/下划线，并要求首字符不是数字。HTTP provider 可能支持更宽松的名称，
 * 但 Foundation 配置会被 pgvector 用作表名/索引名前缀，所以这里按最严格的安全子集统一限制。
 */
export const assertSafeCollectionName = (collectionName: string): void => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(collectionName)) {
    throw createFoundationError({
      component: "embedding_db",
      code: "FOUNDATION_EMBEDDING_COLLECTION_NAME_INVALID",
      message: `invalid collection name: ${collectionName}`,
      retryable: false
    });
  }
};

/**
 * 在 metadata filter 进入 provider 之前做统一安全校验。
 *
 * @param filter 调用方传入的业务过滤条件。
 *
 * 实现方式：要求 filter 是非空对象，并递归拒绝 undefined。非空要求可以防止 search/list/delete
 * 因缺参变成无边界操作；拒绝 undefined 是因为不同 provider 序列化规则不同。
 */
export const assertSafeFilter = (filter: unknown): void => {
  if (!isPlainRecord(filter) || Object.keys(filter).length === 0) {
    throw createFoundationError({
      component: "embedding_db",
      code: "FOUNDATION_EMBEDDING_FILTER_REQUIRED",
      message: "embedding operation requires a non-empty filter",
      retryable: false
    });
  }
  if (containsUndefined(filter)) {
    throw createFoundationError({
      component: "embedding_db",
      code: "FOUNDATION_EMBEDDING_FILTER_INVALID",
      message: "embedding filter cannot contain undefined values",
      retryable: false
    });
  }
};

/**
 * 校验向量维度是否匹配 collection 配置。
 *
 * @param config EmbeddingDb 公共配置，使用其中的 dimension。
 * @param vector 待写入或检索的向量。
 *
 * 实现方式：比较 vector.length 和 config.dimension。该检查放在组件层，让每个 provider 都只接收
 * 维度正确的向量。
 */
export const assertDimension = (config: EmbeddingDbConfig, vector: EmbeddingVector): void => {
  if (vector.length !== config.dimension) {
    throw createFoundationError({
      component: "embedding_db",
      code: "FOUNDATION_EMBEDDING_DIMENSION_MISMATCH",
      message: `expected dimension ${config.dimension}, got ${vector.length}`,
      retryable: false
    });
  }
};

/**
 * 在网络或数据库 I/O 前校验 content 和 metadata 大小。
 *
 * @param config EmbeddingDb 公共配置，可覆盖默认 content/metadata 字节限制。
 * @param content 要存储的文本内容。
 * @param metadata 要存储的 metadata 对象。
 *
 * 实现方式：按 UTF-8 字节数统计 content 和 JSON.stringify(metadata)，超过限制时抛出
 * Foundation 错误，避免向量库 payload 被大字段拖垮。
 */
export const assertPayloadSize = (
  config: EmbeddingDbConfig,
  content: string,
  metadata: unknown
): void => {
  const contentBytes = Buffer.byteLength(content, "utf8");
  const metadataBytes = Buffer.byteLength(JSON.stringify(metadata), "utf8");
  if (contentBytes > (config.maxContentBytes ?? defaultMaxContentBytes)) {
    throw createFoundationError({
      component: "embedding_db",
      code: "FOUNDATION_EMBEDDING_CONTENT_TOO_LARGE",
      message: `embedding content is too large: ${contentBytes} bytes`,
      retryable: false
    });
  }
  if (metadataBytes > (config.maxMetadataBytes ?? defaultMaxMetadataBytes)) {
    throw createFoundationError({
      component: "embedding_db",
      code: "FOUNDATION_EMBEDDING_METADATA_TOO_LARGE",
      message: `embedding metadata is too large: ${metadataBytes} bytes`,
      retryable: false
    });
  }
};

/**
 * 把 metadata 归一化为 provider 契约使用的对象。
 *
 * @param userId 当前租户边界。
 * @param metadata 调用方写入的业务 metadata，必须是 JSON object。
 *
 * 实现方式：校验 metadata 是普通对象且不包含 undefined，然后补入 userId。补入 userId 只用于
 * 审计和兼容读取，provider 仍必须在查询条件中显式隔离 userId。
 */
export const normalizeMetadata = <TMetadata>(
  userId: string,
  metadata: TMetadata
): Record<string, unknown> => {
  if (!isPlainRecord(metadata)) {
    throw createFoundationError({
      component: "embedding_db",
      code: "FOUNDATION_EMBEDDING_METADATA_INVALID",
      message: "embedding metadata must be a JSON object",
      retryable: false
    });
  }
  if (containsUndefined(metadata)) {
    throw createFoundationError({
      component: "embedding_db",
      code: "FOUNDATION_EMBEDDING_METADATA_INVALID",
      message: "embedding metadata cannot contain undefined values",
      retryable: false
    });
  }
  return { ...metadata, userId };
};

/** 判断值是否为普通 JSON object；数组和 null 都返回 false。 */
export const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** 递归检测 JSON-like 结构里是否包含 undefined；用于阻止 provider 序列化差异。 */
export const containsUndefined = (value: unknown): boolean => {
  if (value === undefined) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some(containsUndefined);
  }
  if (isPlainRecord(value)) {
    return Object.values(value).some(containsUndefined);
  }
  return false;
};

/** 提取 filter 顶层 key 用于可观测日志；只记录 key，不记录 value，避免泄漏业务内容。 */
export const filterKeys = (filter: unknown): readonly string[] =>
  isPlainRecord(filter) ? Object.keys(filter) : [];

/**
 * 实现内存 provider 和测试使用的 JSON 子集匹配。
 *
 * @param metadata 被匹配的 metadata。
 * @param filter 调用方传入的过滤条件。
 *
 * 实现方式：filter 中每个 key 都必须在 metadata 中存在并匹配；嵌套对象递归匹配，数组按前缀
 * 位置匹配，尽量贴近 PostgreSQL `jsonb @>` 在测试中的语义。
 */
export const jsonContains = (metadata: unknown, filter: unknown): boolean => {
  if (!isPlainRecord(metadata) || !isPlainRecord(filter)) {
    return false;
  }
  return Object.entries(filter).every(([key, value]) => jsonValueContains(metadata[key], value));
};

/** 比较一个 metadata 值和一个 filter 值；对象/数组递归，标量用严格相等。 */
const jsonValueContains = (metadataValue: unknown, filterValue: unknown): boolean => {
  if (isPlainRecord(filterValue)) {
    return jsonContains(metadataValue, filterValue);
  }
  if (Array.isArray(filterValue)) {
    return (
      Array.isArray(metadataValue) &&
      filterValue.every((item, index) => jsonValueContains(metadataValue[index], item))
    );
  }
  return metadataValue === filterValue;
};

/**
 * 为内存 provider 计算跨 provider 一致的相似度分数。
 *
 * @param distance 配置的距离度量。
 * @param left query 向量。
 * @param right 候选向量。
 *
 * 实现方式：cosine 返回余弦相似度，dot 返回点积，l2 返回负欧氏距离；统一保证值越大越相似，
 * 和公共 `EmbeddingSearchResult.score` 约定一致。
 */
export const score = (
  distance: EmbeddingDbConfig["distance"],
  left: EmbeddingVector,
  right: EmbeddingVector
): number => {
  if (distance === "l2") {
    return -Math.sqrt(
      left.reduce((sum, value, index) => sum + (value - (right[index] ?? 0)) ** 2, 0)
    );
  }
  const dot = left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
  if (distance === "dot") {
    return dot;
  }
  const leftNorm = Math.sqrt(left.reduce((sum, value) => sum + value ** 2, 0));
  const rightNorm = Math.sqrt(right.reduce((sum, value) => sum + value ** 2, 0));
  return leftNorm === 0 || rightNorm === 0 ? 0 : dot / (leftNorm * rightNorm);
};

/** 把 JavaScript 向量转换成 pgvector SQL literal；参数 vector 会被格式化为 `[1,2,3]`。 */
export const toVectorLiteral = (vector: EmbeddingVector): string => `[${vector.join(",")}]`;

/** 构建内存 provider 的复合 key；userId 是隔离键，id 是业务 id。 */
export const memoryKey = (userId: string, id: string): string => `${userId}:${id}`;

/** 对敏感 userId 做 SHA-256 截断 hash 后再写日志。 */
export const hashUserId = (userId: string): string =>
  createHash("sha256").update(userId).digest("hex").slice(0, 16);

/** 对公开 record id 做 SHA-256 截断 hash 后再写日志。 */
export const hashId = (id: string): string =>
  createHash("sha256").update(id).digest("hex").slice(0, 16);

/** 根据 distance 选择 pgvector HNSW operator class。 */
export const pgVectorOps = (distance: EmbeddingDbConfig["distance"]): string =>
  distance === "cosine"
    ? "vector_cosine_ops"
    : distance === "dot"
      ? "vector_ip_ops"
      : "vector_l2_ops";

/** 根据 distance 选择最近邻检索使用的 SQL ORDER BY 表达式。 */
export const pgOrderSql = (distance: EmbeddingDbConfig["distance"]): string =>
  distance === "cosine"
    ? "embedding <=> $1::vector"
    : distance === "dot"
      ? "embedding <#> $1::vector"
      : "embedding <-> $1::vector";

/** 根据 distance 选择 score SQL 表达式，并统一为值越大匹配越强。 */
export const pgScoreSql = (distance: EmbeddingDbConfig["distance"]): string =>
  distance === "cosine"
    ? "1 - (embedding <=> $1::vector)"
    : distance === "dot"
      ? "-(embedding <#> $1::vector)"
      : "-(embedding <-> $1::vector)";
