import type { FoundationComponent, FoundationHealth } from "../foundation-types.js";
import {
  createFoundationError,
  normalizeError,
  nowIso,
  requireFoundationLogger
} from "../foundation-types.js";
import type { LoggerComponent } from "../logger/logger-component.js";
import type {
  EmbeddingDbConfig,
  EmbeddingDbInitDeps,
  EmbeddingDbProvider,
  EmbeddingGetCommand,
  EmbeddingListCommand,
  EmbeddingRecord,
  EmbeddingSearchCommand,
  EmbeddingSearchResult,
  EmbeddingUpsertCommand
} from "./embedding-db-types.js";
import {
  assertDimension,
  assertPayloadSize,
  assertSafeFilter,
  buildLogFields,
  defaultMaxContentBytes,
  defaultMaxMetadataBytes,
  filterKeys,
  hashId,
  hashUserId,
  normalizeMetadata
} from "./embedding-db-utils.js";

export type {
  EmbeddingDbConfig,
  EmbeddingDbInitDeps,
  EmbeddingDbProvider,
  EmbeddingGetCommand,
  EmbeddingListCommand,
  EmbeddingRecord,
  EmbeddingSearchCommand,
  EmbeddingSearchResult,
  EmbeddingUpsertCommand,
  EmbeddingVector
} from "./embedding-db-types.js";

/**
 * Embedding DB 是向量能力的统一入口。
 *
 * 组件本身只负责公共校验、审计日志和 provider 生命周期；具体存储实现由组合根在
 * 初始化时注入。这样 Memory 组件只依赖稳定接口，不需要知道底层是否使用
 * PostgreSQL、Qdrant 或其他向量库。
 */
export class FoundationEmbeddingDb implements Omit<FoundationComponent<EmbeddingDbConfig>, "init"> {
  #config: EmbeddingDbConfig | undefined;
  #logger: LoggerComponent | undefined;
  #provider: EmbeddingDbProvider | undefined;

  /**
   * 初始化由外部注入的 provider。
   *
   * @param config EmbeddingDb 的公共配置，包含 collectionName、dimension、distance、
   * topKDefault 和 payload 大小限制；这些值会原样传给 provider。
   * @param deps 初始化依赖，必须包含 provider；logger 从 deps 中读取，secretProvider 会被
   * provider 自己按需使用。
   *
   * 实现方式：组件先取得 logger 和 provider，记录启动日志；再调用 provider.init() 完成
   * 连接检查、collection/table 准备和维度一致性校验；失败时统一包装为 Foundation 错误，
   * 让服务启动阶段可以 fail-fast。
   */
  async init(config: EmbeddingDbConfig, deps?: EmbeddingDbInitDeps): Promise<void> {
    // 初始化必须先解析 logger/provider，因为后续所有成功和失败路径都需要带 provider 名称写审计日志。
    const logger = requireFoundationLogger("embedding_db", deps);
    const provider = this.#requireInitProvider(deps);
    const startedAt = Date.now();
    this.#logger = logger;
    logger.info("foundation.embedding_db.init_started", {
      provider: provider.name,
      collection_name: config.collectionName,
      dimension: config.dimension,
      component: "embedding_db"
    });

    try {
      // 真正的外部资源准备交给 provider；门面只保存成功初始化后的生命周期状态。
      await provider.init(config, deps);
      this.#provider = provider;
      this.#config = config;
      logger.info("foundation.embedding_db.init_succeeded", {
        provider: provider.name,
        duration_ms: Date.now() - startedAt,
        component: "embedding_db"
      });
    } catch (cause) {
      logger.error("foundation.embedding_db.init_failed", {
        provider: provider.name,
        duration_ms: Date.now() - startedAt,
        error: normalizeError(cause),
        component: "embedding_db"
      });
      throw createFoundationError({
        component: "embedding_db",
        code: "FOUNDATION_EMBEDDING_DB_INIT_FAILED",
        message: "embedding db init failed",
        retryable: true,
        cause
      });
    }
  }

  /**
   * 写入或覆盖单条向量。
   *
   * @param command 写入命令；`userId` 是强制隔离键，`id` 是用户边界内的业务 id，
   * `vector` 必须等于配置维度，`content` 是可召回文本，`metadata` 是业务过滤字段。
   *
   * 实现方式：组件先把 metadata 归一化并补入 userId，再校验维度和 payload 大小，最后
   * 调用 provider.upsert()。`(userId,id)` 是所有 provider 都必须遵守的复合业务键；metadata
   * 中的 userId 只用于审计和兼容读取，真正的租户隔离仍必须由 provider 查询条件保证。
   */
  async upsert<TMetadata>(command: EmbeddingUpsertCommand<TMetadata>): Promise<void> {
    const config = this.#requireConfig();
    const provider = this.#requireProvider();
    // metadata 先在门面层归一化，确保所有 provider 都能拿到相同的审计字段和 undefined 防护结果。
    const metadata = normalizeMetadata(command.userId, command.metadata);
    const startedAt = Date.now();
    this.#logger?.info("foundation.embedding_db.upsert_started", {
      collection_name: config.collectionName,
      dimension: command.vector.length,
      user_id_hash: hashUserId(command.userId),
      ...buildLogFields("embedding_db", command.traceId)
    });

    try {
      // 这些校验放在 provider I/O 前，目的是把跨 provider 一致的输入错误提前挡住。
      assertDimension(config, command.vector);
      assertPayloadSize(config, command.content, metadata);
      await provider.upsert({ ...command, metadata });
      this.#logger?.info("foundation.embedding_db.upsert_succeeded", {
        collection_name: config.collectionName,
        user_id_hash: hashUserId(command.userId),
        duration_ms: Date.now() - startedAt,
        result_count: 1,
        ...buildLogFields("embedding_db", command.traceId)
      });
    } catch (cause) {
      this.#logger?.error("foundation.embedding_db.upsert_failed", {
        duration_ms: Date.now() - startedAt,
        user_id_hash: hashUserId(command.userId),
        error: normalizeError(cause),
        ...buildLogFields("embedding_db", command.traceId)
      });
      throw cause;
    }
  }

  /**
   * 在当前 userId 的隔离空间内做向量召回。
   *
   * @param command 检索命令；`userId` 限定租户边界，`vector` 是 query 向量，`filter`
   * 是业务 metadata 条件，`topK` 可覆盖默认召回数量。
   *
   * 实现方式：组件解析 topK，校验向量维度和 filter 非空/无 undefined；topK 小于等于 0
   * 时直接返回空数组；其余情况交给 provider.search()。provider 必须保证 userId 过滤发生
   * 在 metadata 业务过滤和 topK 截断之前，避免 ANN 后置过滤导致跨租户泄漏或召回塌缩。
   */
  async search<TFilter, TMetadata>(
    command: EmbeddingSearchCommand<TFilter>
  ): Promise<readonly EmbeddingSearchResult<TMetadata>[]> {
    const config = this.#requireConfig();
    const provider = this.#requireProvider();
    const topK = command.topK ?? config.topKDefault;
    const startedAt = Date.now();
    this.#logger?.info("foundation.embedding_db.search_started", {
      collection_name: config.collectionName,
      top_k: topK,
      filter_keys: filterKeys(command.filter),
      user_id_hash: hashUserId(command.userId),
      ...buildLogFields("embedding_db", command.traceId)
    });

    try {
      // search 是最容易出现跨租户误召回的路径，所以维度和 filter 安全检查必须在这里统一执行。
      assertDimension(config, command.vector);
      assertSafeFilter(command.filter);
      if (topK <= 0) {
        return [];
      }
      const results = await provider.search<TFilter, TMetadata>(command, topK);
      this.#logger?.info("foundation.embedding_db.search_succeeded", {
        collection_name: config.collectionName,
        top_k: topK,
        result_count: results.length,
        duration_ms: Date.now() - startedAt,
        user_id_hash: hashUserId(command.userId),
        ...buildLogFields("embedding_db", command.traceId)
      });
      return results;
    } catch (cause) {
      this.#logger?.error("foundation.embedding_db.search_failed", {
        duration_ms: Date.now() - startedAt,
        user_id_hash: hashUserId(command.userId),
        error: normalizeError(cause),
        ...buildLogFields("embedding_db", command.traceId)
      });
      throw cause;
    }
  }

  /**
   * 按 `(userId, id)` 精确读取单条记录。
   *
   * @param command 精确读取命令；`userId` 限定租户边界，`id` 是调用方写入时使用的业务 id。
   *
   * 实现方式：门面只负责日志和隔离字段透传，实际读取由 provider.getById() 使用各自的
   * 稳定 provider id 或数据库复合键完成。这是 Memory v3 用 EmbeddingDb 承载事实存储后的
   * 基础能力，避免应用层为了更新或删除记忆再维护一套 PostgreSQL metadata 主表。
   */
  async getById<TMetadata>(
    command: EmbeddingGetCommand
  ): Promise<EmbeddingRecord<TMetadata> | undefined> {
    const config = this.#requireConfig();
    const provider = this.#requireProvider();
    const startedAt = Date.now();
    this.#logger?.info("foundation.embedding_db.get_started", {
      collection_name: config.collectionName,
      user_id_hash: hashUserId(command.userId),
      id_hash: hashId(command.id),
      ...buildLogFields("embedding_db", command.traceId)
    });

    try {
      const record = await provider.getById<TMetadata>(command);
      this.#logger?.info("foundation.embedding_db.get_succeeded", {
        collection_name: config.collectionName,
        user_id_hash: hashUserId(command.userId),
        id_hash: hashId(command.id),
        result_count: record ? 1 : 0,
        duration_ms: Date.now() - startedAt,
        ...buildLogFields("embedding_db", command.traceId)
      });
      return record;
    } catch (cause) {
      this.#logger?.error("foundation.embedding_db.get_failed", {
        duration_ms: Date.now() - startedAt,
        user_id_hash: hashUserId(command.userId),
        id_hash: hashId(command.id),
        error: normalizeError(cause),
        ...buildLogFields("embedding_db", command.traceId)
      });
      throw cause;
    }
  }

  /**
   * 按 metadata 子集分页列出记录。
   *
   * @param command 列表命令；`userId` 限定租户边界，`filter` 是必填业务 metadata 条件，
   * `page` 和 `pageSize` 可选，不传时使用第一页和默认 pageSize。
   *
   * 实现方式：组件先计算分页参数并校验 filter；page/pageSize 小于 1 时直接返回空数组；
   * 否则调用 provider.list()。list 不做向量相似度排序，主要服务于 Memory active facts
   * 列表和调试审计场景；provider 需要先 userId 隔离，再套用业务 filter。
   */
  async list<TFilter, TMetadata>(
    command: EmbeddingListCommand<TFilter>
  ): Promise<readonly EmbeddingRecord<TMetadata>[]> {
    const config = this.#requireConfig();
    const provider = this.#requireProvider();
    const page = command.page ?? 1;
    const pageSize = command.pageSize ?? config.topKDefault;
    const startedAt = Date.now();
    this.#logger?.info("foundation.embedding_db.list_started", {
      collection_name: config.collectionName,
      page,
      page_size: pageSize,
      filter_keys: filterKeys(command.filter),
      user_id_hash: hashUserId(command.userId),
      ...buildLogFields("embedding_db", command.traceId)
    });

    try {
      // list 可能被用于后台批量枚举，所以空 filter 仍然禁止，避免误扫全库。
      assertSafeFilter(command.filter);
      if (page < 1 || pageSize < 1) {
        return [];
      }
      const records = await provider.list<TFilter, TMetadata>(command, page, pageSize);
      this.#logger?.info("foundation.embedding_db.list_succeeded", {
        collection_name: config.collectionName,
        result_count: records.length,
        duration_ms: Date.now() - startedAt,
        user_id_hash: hashUserId(command.userId),
        ...buildLogFields("embedding_db", command.traceId)
      });
      return records;
    } catch (cause) {
      this.#logger?.error("foundation.embedding_db.list_failed", {
        duration_ms: Date.now() - startedAt,
        user_id_hash: hashUserId(command.userId),
        error: normalizeError(cause),
        ...buildLogFields("embedding_db", command.traceId)
      });
      throw cause;
    }
  }

  /**
   * 删除指定 userId 下匹配 metadata filter 的记录。
   *
   * @param userId 要清理的租户边界。
   * @param filter 业务 metadata 条件；必须是非空对象，undefined 会被拒绝。
   *
   * 实现方式：先复用公共 filter 校验，再进入内部 `#delete()`。这里不允许空对象 filter，
   * 是为了避免调用方缺参导致意外全量删除；需要用户级全清理时应显式调用 deleteByUser()。
   */
  async deleteByFilter<TFilter>(userId: string, filter: TFilter): Promise<number> {
    assertSafeFilter(filter);
    return await this.#delete(userId, filter, "filter");
  }

  /**
   * 删除指定 userId 下的全部向量记录。
   *
   * @param userId 要清理的租户边界。
   *
   * 实现方式：调用内部 `#delete()`，并把 action 标为 `user`。这是显式的用户级清理 API，
   * 日志 action 会和 filter 删除区分，便于审计删除入口。
   */
  async deleteByUser(userId: string): Promise<number> {
    return await this.#delete(userId, undefined, "user");
  }

  /**
   * 透传 provider 健康检查。
   *
   * 参数：无。
   *
   * 实现方式：未初始化时直接返回 unhealthy；已初始化时调用 provider.healthCheck()。外部
   * provider 的连接失败会被降级为 unhealthy health 响应，不在健康检查路径抛出到调用方。
   */
  async healthCheck(): Promise<FoundationHealth> {
    const provider = this.#provider;
    if (!provider) {
      return {
        status: "unhealthy",
        message: "embedding db is not initialized",
        checkedAt: nowIso()
      };
    }

    try {
      return await provider.healthCheck();
    } catch (cause) {
      const error = normalizeError(cause);
      return {
        status: "unhealthy",
        message: `embedding db health check failed: ${String(error.message)}`,
        checkedAt: nowIso()
      };
    }
  }

  /**
   * 关闭 provider 连接并清空组件状态。
   *
   * 参数：无。
   *
   * 实现方式：先把门面里的 provider/config 置空，再调用旧 provider.close() 释放资源。
   * 对 pgvector 是关闭连接池；对 Qdrant/Pinecone 这类 HTTP provider 当前是清空本地状态；
   * memory provider 会清空进程内向量。
   */
  async close(): Promise<void> {
    const provider = this.#provider;
    this.#provider = undefined;
    this.#config = undefined;
    if (provider) {
      await provider.close();
    }
  }

  async #delete<TFilter>(
    userId: string,
    filter: TFilter | undefined,
    action: "filter" | "user"
  ): Promise<number> {
    const config = this.#requireConfig();
    const provider = this.#requireProvider();
    const startedAt = Date.now();
    // 内部删除函数统一写日志，是为了让 filter 删除和用户级删除共享同一套审计字段。
    this.#logger?.info("foundation.embedding_db.delete_started", {
      collection_name: config.collectionName,
      action,
      filter_keys: filter ? filterKeys(filter) : [],
      user_id_hash: hashUserId(userId),
      ...buildLogFields("embedding_db")
    });

    try {
      // action 决定最终调用哪个 provider 删除入口；这样公共日志和错误处理只需要维护一份。
      const deleted =
        action === "user"
          ? await provider.deleteByUser(userId)
          : await provider.deleteByFilter(userId, filter);
      this.#logger?.info("foundation.embedding_db.delete_succeeded", {
        collection_name: config.collectionName,
        action,
        result_count: deleted,
        duration_ms: Date.now() - startedAt,
        user_id_hash: hashUserId(userId),
        ...buildLogFields("embedding_db")
      });
      return deleted;
    } catch (cause) {
      this.#logger?.error("foundation.embedding_db.delete_failed", {
        action,
        duration_ms: Date.now() - startedAt,
        user_id_hash: hashUserId(userId),
        error: normalizeError(cause),
        ...buildLogFields("embedding_db")
      });
      throw cause;
    }
  }

  #requireConfig(): EmbeddingDbConfig {
    if (!this.#config) {
      throw createFoundationError({
        component: "embedding_db",
        code: "FOUNDATION_EMBEDDING_DB_NOT_INITIALIZED",
        message: "embedding db is not initialized",
        retryable: false
      });
    }
    return this.#config;
  }

  #requireProvider(): EmbeddingDbProvider {
    if (!this.#provider) {
      throw createFoundationError({
        component: "embedding_db",
        code: "FOUNDATION_EMBEDDING_DB_NOT_INITIALIZED",
        message: "embedding db provider is not initialized",
        retryable: false
      });
    }
    return this.#provider;
  }

  #requireInitProvider(deps: EmbeddingDbInitDeps | undefined): EmbeddingDbProvider {
    if (deps?.provider === undefined) {
      throw createFoundationError({
        component: "embedding_db",
        code: "FOUNDATION_EMBEDDING_DB_PROVIDER_REQUIRED",
        message: "embedding db init requires provider",
        retryable: false
      });
    }
    return deps.provider;
  }
}

export { defaultMaxContentBytes, defaultMaxMetadataBytes };
