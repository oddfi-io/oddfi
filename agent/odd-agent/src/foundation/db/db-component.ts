import { createHash } from "node:crypto";
import { Pool, type PoolClient } from "pg";
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
import type { LogFields, LoggerComponent } from "../logger/logger-component.js";

export type DbConfig = {
  readonly provider: "postgres";
  readonly connectionStringSecretRef: string;
  readonly maxPoolSize: number;
  readonly statementTimeoutMs: number;
  readonly idleTimeoutMs: number;
  readonly ssl: boolean;
};

export type DbQueryCommand = {
  readonly traceId?: string;
  readonly text?: string;
  readonly sql?: string;
  readonly values?: readonly unknown[];
  readonly params?: readonly unknown[];
};

export type DbQueryResult<T> = {
  readonly rows: readonly T[];
  readonly rowCount: number;
  readonly durationMs: number;
};

export type DbTransaction = {
  readonly query: {
    <T>(command: DbQueryCommand): Promise<DbQueryResult<T>>;
    <T>(text: string, values?: readonly unknown[]): Promise<DbQueryResult<T>>;
  };
};

// 所有 DB 日志都保持 foundation 视角：只记录组件名和可选 trace，
// 不在这里推断 user/session 等业务上下文，避免基础库反向依赖业务概念。
const componentFields = (component: string, traceId?: string): LogFields => ({
  component,
  ...(traceId === undefined ? {} : { trace_id: traceId })
});

/**
 * FoundationDb 是项目内唯一的 SQL 基础工具。
 *
 * 设计边界：
 * - 只负责连接池、参数化 query、事务、健康检查和关闭；
 * - 不读取 YAML，不读取散落 env，不理解业务表结构；
 * - SQL 调用失败统一包装为 foundation error，便于上层按组件定位。
 */
export class FoundationDb implements FoundationComponent<DbConfig> {
  #pool: Pool | undefined;
  #logger: LoggerComponent | undefined;

  /**
   * 初始化 PostgreSQL 连接池。
   *
   * 连接串必须经 secretProvider 解析；logger 必须由组合根显式传入。
   * 初始化末尾执行一次 `select 1`，让连接串、网络、权限问题在启动阶段 fail-fast。
   */
  async init(config: DbConfig, deps?: FoundationInitDeps): Promise<void> {
    const logger = requireFoundationLogger("db", deps);
    this.#logger = logger;
    const startedAt = Date.now();
    logger.info("foundation.db.init_started", {
      provider: config.provider,
      max_pool_size: config.maxPoolSize,
      component: "db"
    });
    try {
      const connectionString = await resolveSecret("db", deps, config.connectionStringSecretRef);
      this.#pool = new Pool({
        connectionString,
        max: config.maxPoolSize,
        idleTimeoutMillis: config.idleTimeoutMs,
        statement_timeout: config.statementTimeoutMs,
        ssl: config.ssl ? { rejectUnauthorized: false } : undefined
      });
      await this.query({ text: "select 1" });
      logger.info("foundation.db.init_succeeded", {
        duration_ms: Date.now() - startedAt,
        component: "db"
      });
    } catch (cause) {
      logger.error("foundation.db.init_failed", {
        duration_ms: Date.now() - startedAt,
        error: normalizeError(cause),
        component: "db"
      });
      throw createFoundationError({
        component: "db",
        code: "FOUNDATION_DB_INIT_FAILED",
        message: "database init failed",
        retryable: true,
        cause
      });
    }
  }

  async query<T>(command: DbQueryCommand): Promise<DbQueryResult<T>>;
  async query<T>(text: string, values?: readonly unknown[]): Promise<DbQueryResult<T>>;
  /**
   * 执行单条 SQL。
   *
   * 支持 command object 和 `(text, values)` 两种形式，方便脚本和业务仓储复用。
   * 日志只记录 SQL hash、参数数量、耗时和行数，不输出 SQL 原文和参数值，
   * 避免把 secret / PII 意外写入日志。
   */
  async query<T>(
    commandOrText: DbQueryCommand | string,
    values?: readonly unknown[]
  ): Promise<DbQueryResult<T>> {
    const command = toQueryCommand(commandOrText, values);
    const pool = this.#requirePool();
    const startedAt = Date.now();
    this.#logger?.debug("foundation.db.query_started", {
      sql_hash: hashSql(getSql(command)),
      param_count: getParams(command).length,
      ...componentFields("db", command.traceId)
    });
    try {
      const result = await pool.query(getSql(command), getParams(command));
      const durationMs = Date.now() - startedAt;
      this.#logger?.debug("foundation.db.query_succeeded", {
        sql_hash: hashSql(getSql(command)),
        row_count: result.rowCount ?? 0,
        duration_ms: durationMs,
        ...componentFields("db", command.traceId)
      });
      return { rows: result.rows as readonly T[], rowCount: result.rowCount ?? 0, durationMs };
    } catch (cause) {
      this.#logger?.error("foundation.db.query_failed", {
        sql_hash: hashSql(getSql(command)),
        duration_ms: Date.now() - startedAt,
        error: normalizeError(cause),
        ...componentFields("db", command.traceId)
      });
      throw createFoundationError({
        component: "db",
        code: "FOUNDATION_DB_QUERY_FAILED",
        message: "database query failed",
        retryable: true,
        cause
      });
    }
  }

  /**
   * 在同一个 client 上执行事务。
   *
   * handler 只拿到受控的 tx.query，不能直接操作连接池。
   * handler 成功则 commit，任意异常都会 rollback 并原样抛出，避免吞掉上层的业务错误类型。
   */
  async transaction<T>(handler: (tx: DbTransaction) => Promise<T>): Promise<T> {
    const pool = this.#requirePool();
    const client = await pool.connect();
    const startedAt = Date.now();
    this.#logger?.debug("foundation.db.transaction_started", { component: "db" });
    try {
      await client.query("BEGIN");
      const value = await handler({
        query: <T>(commandOrText: DbQueryCommand | string, values?: readonly unknown[]) =>
          queryClient<T>(client, toQueryCommand(commandOrText, values))
      });
      await client.query("COMMIT");
      this.#logger?.debug("foundation.db.transaction_succeeded", {
        duration_ms: Date.now() - startedAt,
        component: "db"
      });
      return value;
    } catch (cause) {
      await client.query("ROLLBACK");
      this.#logger?.error("foundation.db.transaction_failed", {
        duration_ms: Date.now() - startedAt,
        error: normalizeError(cause),
        component: "db"
      });
      throw cause;
    } finally {
      client.release();
    }
  }

  /**
   * 轻量健康检查。
   *
   * 这里复用 query，因此可以同时验证 pool 是否初始化、连接是否仍可用、
   * statement timeout 等基础配置是否正常。
   */
  async healthCheck(): Promise<FoundationHealth> {
    try {
      await this.query({ text: "select 1" });
      return { status: "healthy", message: "db query ok", checkedAt: nowIso() };
    } catch (cause) {
      return {
        status: "unhealthy",
        message: cause instanceof Error ? cause.message : "db health check failed",
        checkedAt: nowIso()
      };
    }
  }

  /**
   * 释放连接池。
   *
   * close 后再次 query 会得到 FOUNDATION_NOT_INITIALIZED，避免关闭后的隐藏重连。
   */
  async close(): Promise<void> {
    await this.#pool?.end();
    this.#pool = undefined;
  }

  /**
   * 统一的初始化守卫。
   *
   * 所有业务方法先走这里，保证未 init 的错误明确、非重试型，
   * 而不是让 pg client 抛出难懂的空引用错误。
   */
  #requirePool(): Pool {
    if (this.#pool === undefined) {
      throw createFoundationError({
        component: "db",
        code: "FOUNDATION_NOT_INITIALIZED",
        message: "db is not initialized",
        retryable: false
      });
    }
    return this.#pool;
  }
}

// 事务内 query 不能走 pool.query，否则会逃出当前事务连接。
// 这个小 helper 只封装行数、耗时和泛型 rows 转换。
const queryClient = async <T>(
  client: PoolClient,
  command: DbQueryCommand
): Promise<DbQueryResult<T>> => {
  const startedAt = Date.now();
  const result = await client.query(getSql(command), getParams(command));
  return {
    rows: result.rows as readonly T[],
    rowCount: result.rowCount ?? 0,
    durationMs: Date.now() - startedAt
  };
};

// 把两种公开调用形式归一成 command object，后续 SQL/params 解析只维护一套逻辑。
const toQueryCommand = (
  commandOrText: DbQueryCommand | string,
  values?: readonly unknown[]
): DbQueryCommand =>
  typeof commandOrText === "string"
    ? { text: commandOrText, ...(values === undefined ? {} : { values }) }
    : commandOrText;

// `sql` 和 `text` 都是合法字段，兼容 node-postgres 习惯和内部命名。
// 如果调用方两者都没传，提前抛明确错误。
const getSql = (command: DbQueryCommand): string => {
  const sql = command.sql ?? command.text;
  if (sql === undefined) {
    throw createFoundationError({
      component: "db",
      code: "FOUNDATION_DB_SQL_REQUIRED",
      message: "database query requires text or sql",
      retryable: false
    });
  }
  return sql;
};

// `params` 和 `values` 同样兼容两种命名；返回拷贝，避免下游意外修改调用方数组。
const getParams = (command: DbQueryCommand): unknown[] => {
  const params = command.params ?? command.values ?? [];
  return [...params];
};

// SQL hash 用于日志排障和指标聚合：同一 SQL 模板稳定命中，又不会泄漏原文。
const hashSql = (sql: string): string =>
  createHash("sha256").update(sql).digest("hex").slice(0, 16);
