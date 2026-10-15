import { Pool } from "pg";
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
import {
  assertSafeCollectionName,
  pgOrderSql,
  pgScoreSql,
  pgVectorOps,
  toVectorLiteral
} from "./embedding-db-utils.js";

export type PgVectorEmbeddingDbProviderConfig = {
  readonly connectionStringSecretRef: string;
};

/**
 * PostgreSQL pgvector provider。
 *
 * 这个 provider 保留给兼容场景和本地数据库回归测试。它把用户边界放在独立 `user_id`
 * 列中，把业务过滤字段放在 `metadata jsonb` 中。
 */
export class PgVectorEmbeddingDbProvider implements EmbeddingDbProvider {
  readonly name = "pgvector";
  #config: EmbeddingDbConfig | undefined;
  #pool: Pool | undefined;

  constructor(private readonly providerConfig: PgVectorEmbeddingDbProviderConfig) {}

  /**
   * 创建 pgvector 表和索引，如果已经存在则复用。
   *
   * @param config Foundation 公共配置；collectionName 是表名，dimension 是 vector 维度，
   * distance 决定 HNSW operator class。
   * @param deps 初始化依赖；通过 deps.secretProvider 读取 connectionStringSecretRef。
   *
   * 实现方式：先校验表名，再创建 pgvector extension、表、维度校验和索引。表使用
   * `(user_id,id)` 作为主键，让公开 id 只在用户边界内唯一。
   */
  async init(config: EmbeddingDbConfig, deps?: FoundationInitDeps): Promise<void> {
    assertSafeCollectionName(config.collectionName);
    // 连接串通过 secretProvider 解析，避免把数据库凭据写入 provider 配置或日志。
    const connectionString = await resolveSecret(
      "embedding_db",
      deps,
      this.providerConfig.connectionStringSecretRef
    );
    this.#config = config;
    this.#pool = new Pool({ connectionString });
    // extension 和表结构都在 init 中准备，确保应用启动后 provider 可直接处理写入。
    await this.#requirePool().query("CREATE EXTENSION IF NOT EXISTS vector");
    await this.#requirePool().query(
      `CREATE TABLE IF NOT EXISTS ${config.collectionName} (
         user_id text NOT NULL,
         id text NOT NULL,
         content text NOT NULL,
         metadata jsonb NOT NULL,
         embedding vector(${config.dimension}) NOT NULL,
         created_at timestamptz NOT NULL DEFAULT now(),
         updated_at timestamptz NOT NULL DEFAULT now(),
         PRIMARY KEY (user_id, id)
       )`
    );
    // 复用已有表时必须确认 vector 维度一致，否则后续 insert/search 会在数据库层失败。
    await this.#assertDimension(config);
    // HNSW 用于向量近邻检索；operator class 必须和 distance 配置一致。
    await this.#requirePool().query(
      `CREATE INDEX IF NOT EXISTS ${config.collectionName}_embedding_${config.distance}_hnsw_idx
       ON ${config.collectionName}
       USING hnsw (embedding ${pgVectorOps(config.distance)})`
    );
    // GIN 索引用于 metadata @> 过滤，避免业务 filter 退化成全表扫描。
    await this.#requirePool().query(
      `CREATE INDEX IF NOT EXISTS ${config.collectionName}_metadata_gin_idx
       ON ${config.collectionName}
       USING gin (metadata jsonb_path_ops)`
    );
    // user_id + created_at 索引用于 list 场景按用户边界做最近更新时间排序。
    await this.#requirePool().query(
      `CREATE INDEX IF NOT EXISTS ${config.collectionName}_user_created_idx
       ON ${config.collectionName} (user_id, created_at DESC)`
    );
  }

  /**
   * 检查 PostgreSQL 连接池是否可用。
   *
   * 参数：无。
   *
   * 实现方式：执行一条轻量 `select 1`，成功即代表连接池可访问数据库。
   */
  async healthCheck() {
    await this.#requirePool().query("select 1");
    return { status: "healthy" as const, message: "embedding db initialized", checkedAt: nowIso() };
  }

  /**
   * 关闭 PostgreSQL 连接池。
   *
   * 参数：无。
   *
   * 实现方式：调用 pg Pool.end()，然后清空本地 pool 引用。
   */
  async close(): Promise<void> {
    await this.#pool?.end();
    this.#pool = undefined;
  }

  /**
   * 写入或覆盖一条 pgvector 行。
   *
   * @param command 写入命令；`userId/id` 写入复合主键，`content/metadata/vector` 写入对应列。
   *
   * 实现方式：使用 `INSERT ... ON CONFLICT (user_id,id) DO UPDATE`，在数据库约束层保持租户
   * 隔离和 upsert 语义。
   */
  async upsert(command: EmbeddingUpsertCommand<Record<string, unknown>>): Promise<void> {
    const config = this.#requireConfig();
    await this.#requirePool().query(
      `INSERT INTO ${config.collectionName} (user_id, id, content, metadata, embedding, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5::vector, now())
       ON CONFLICT (user_id, id)
       DO UPDATE SET content = EXCLUDED.content,
                     metadata = EXCLUDED.metadata,
                     embedding = EXCLUDED.embedding,
                     updated_at = now()`,
      [
        command.userId,
        command.id,
        command.content,
        JSON.stringify(command.metadata),
        toVectorLiteral(command.vector)
      ]
    );
  }

  /**
   * 在 userId 和 metadata 过滤后使用 PostgreSQL vector operator 检索。
   *
   * @param command 检索命令；`vector` 是 query 向量，`userId` 是隔离键，`filter` 会转成
   * JSONB 子集条件。
   * @param topK 最大召回数量。
   *
   * 实现方式：SQL 的 `WHERE user_id = $2 AND metadata @> $3` 先限定可见数据，再按 vector
   * operator 排序和 LIMIT，保证 topK 只来自允许的用户边界。
   */
  async search<TFilter, TMetadata>(
    command: EmbeddingSearchCommand<TFilter>,
    topK: number
  ): Promise<readonly EmbeddingSearchResult<TMetadata>[]> {
    const config = this.#requireConfig();
    const result = await this.#requirePool().query<{
      readonly id: string;
      readonly content: string;
      readonly metadata: TMetadata;
      readonly score: number;
    }>(
      `SELECT id, content, metadata, (${pgScoreSql(config.distance)})::float8 AS score
       FROM ${config.collectionName}
       WHERE user_id = $2 AND metadata @> $3::jsonb
       ORDER BY ${pgOrderSql(config.distance)}
       LIMIT $4`,
      [toVectorLiteral(command.vector), command.userId, JSON.stringify(command.filter), topK]
    );
    return result.rows;
  }

  /**
   * 按 `(user_id,id)` 读取单行。
   *
   * @param command 精确读取命令；`userId` 对应 user_id 列，`id` 对应业务 id 列。
   *
   * 实现方式：使用复合主键条件查询一行，找不到时返回 undefined。
   */
  async getById<TMetadata>(
    command: EmbeddingGetCommand
  ): Promise<EmbeddingRecord<TMetadata> | undefined> {
    const config = this.#requireConfig();
    const result = await this.#requirePool().query<{
      readonly id: string;
      readonly content: string;
      readonly metadata: TMetadata;
    }>(
      `SELECT id, content, metadata
       FROM ${config.collectionName}
       WHERE user_id = $1 AND id = $2
       LIMIT 1`,
      [command.userId, command.id]
    );
    return result.rows[0];
  }

  /**
   * 按 JSONB metadata filter 列出行，并按最近更新时间倒序。
   *
   * @param command 列表命令；`userId` 限定用户边界，`filter` 会转成 JSONB 子集条件。
   * @param page 页码，从 1 开始。
   * @param pageSize 每页数量。
   *
   * 实现方式：用 `metadata @>` 做业务过滤，用 LIMIT/OFFSET 完成分页。
   */
  async list<TFilter, TMetadata>(
    command: EmbeddingListCommand<TFilter>,
    page: number,
    pageSize: number
  ): Promise<readonly EmbeddingRecord<TMetadata>[]> {
    const config = this.#requireConfig();
    const result = await this.#requirePool().query<{
      readonly id: string;
      readonly content: string;
      readonly metadata: TMetadata;
    }>(
      `SELECT id, content, metadata
       FROM ${config.collectionName}
       WHERE user_id = $1 AND metadata @> $2::jsonb
       ORDER BY updated_at DESC
       LIMIT $3 OFFSET $4`,
      [command.userId, JSON.stringify(command.filter), pageSize, (page - 1) * pageSize]
    );
    return result.rows;
  }

  /**
   * 删除一个 userId 下匹配 JSONB metadata 子集的行。
   *
   * @param userId 要删除的用户边界。
   * @param filter 业务 metadata 条件。
   *
   * 实现方式：使用 `DELETE ... WHERE user_id = $1 AND metadata @> $2`，返回数据库 rowCount。
   */
  async deleteByFilter<TFilter>(userId: string, filter: TFilter): Promise<number> {
    const config = this.#requireConfig();
    const result = await this.#requirePool().query(
      `DELETE FROM ${config.collectionName}
       WHERE user_id = $1 AND metadata @> $2::jsonb`,
      [userId, JSON.stringify(filter)]
    );
    return result.rowCount ?? 0;
  }

  /**
   * 删除一个 userId 下的全部行。
   *
   * @param userId 要删除的用户边界。
   *
   * 实现方式：只按 user_id 删除，返回数据库 rowCount。
   */
  async deleteByUser(userId: string): Promise<number> {
    const config = this.#requireConfig();
    const result = await this.#requirePool().query(
      `DELETE FROM ${config.collectionName} WHERE user_id = $1`,
      [userId]
    );
    return result.rowCount ?? 0;
  }

  /**
   * 确认已存在表的 vector 维度和当前配置一致。
   *
   * @param config Foundation 公共配置；使用 collectionName 找表，dimension 做期望值。
   *
   * 实现方式：读取 pg_attribute.atttypmod。pgvector 的 typmod 对应声明维度；不一致时
   * fail-fast，避免同表复用导致运行期写入失败。
   */
  async #assertDimension(config: EmbeddingDbConfig): Promise<void> {
    const result = await this.#requirePool().query<{
      readonly actual_dimension: number | string | null;
    }>(
      `SELECT atttypmod AS actual_dimension
       FROM pg_attribute
       WHERE attrelid = $1::regclass
         AND attname = 'embedding'
         AND NOT attisdropped`,
      [config.collectionName]
    );
    const actual = result.rows[0]?.actual_dimension;
    if (Number(actual) !== config.dimension) {
      throw createFoundationError({
        component: "embedding_db",
        code: "FOUNDATION_EMBEDDING_DIMENSION_MISMATCH",
        message: `existing collection dimension mismatch: expected ${config.dimension}, got ${String(actual)}`,
        retryable: false
      });
    }
  }

  #requireConfig(): EmbeddingDbConfig {
    if (this.#config === undefined) {
      throw createFoundationError({
        component: "embedding_db",
        code: "FOUNDATION_NOT_INITIALIZED",
        message: "pgvector embedding db is not initialized",
        retryable: false
      });
    }
    return this.#config;
  }

  #requirePool(): Pool {
    if (this.#pool === undefined) {
      throw createFoundationError({
        component: "embedding_db",
        code: "FOUNDATION_NOT_INITIALIZED",
        message: "pgvector embedding db is not initialized",
        retryable: false
      });
    }
    return this.#pool;
  }
}
