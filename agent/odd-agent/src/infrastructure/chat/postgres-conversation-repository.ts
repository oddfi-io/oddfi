import { randomUUID } from "node:crypto";
import type { FoundationDb } from "../../foundation/db/db-component.js";
import type {
  ConversationDetailRecord,
  ConversationRecord
} from "../../models/db/persistence-model.js";
import type {
  ConversationDetailQuery,
  ListConversationsQuery
} from "../../models/http/chat-dto-model.js";
import { AppError } from "../../shared/app-error.js";

type ConversationRow = {
  readonly id: number | string;
  readonly conversation_id: string;
  readonly user_id: string;
  readonly name: string;
  readonly deleted_at: Date | string | null;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
};

type ConversationDetailRow = {
  readonly id: number | string;
  readonly conversation_id: string;
  readonly msg_id: string;
  readonly user_id: string;
  readonly direction: number;
  readonly message: string;
  readonly deleted_at: Date | string | null;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
};

export type ConversationListResult = {
  readonly items: readonly ConversationRecord[];
  readonly total: number;
};

export type ConversationDetailListResult = {
  readonly items: readonly ConversationDetailRecord[];
  readonly total: number;
};

export class PostgresConversationRepository {
  readonly #database: Pick<FoundationDb, "query">;

  /**
   * 调用流程：创建 Chat 会话仓储。
   * 入参：FoundationDb 的 query 子集，用于执行参数化 SQL。
   * 出参：仓储实例；构造阶段不触发 I/O，真实查询由方法执行。
   */
  constructor(database: Pick<FoundationDb, "query">) {
    this.#database = database;
  }

  /**
   * 调用流程：为当前用户创建一个新的会话。
   * 入参：可信 userId、用户提供的会话名和可选 traceId。
   * 出参：新建的会话记录，包含生成的 conversationId。
   *
   * 实现方式：仓储内部生成 `chat_<uuid>`，用 INSERT RETURNING 拿到数据库时间字段；
   * userId 和 name 都在写入前 trim，避免空白绕过数据库约束。
   */
  async createConversation(input: {
    readonly traceId?: string;
    readonly userId: string;
    readonly name: string;
  }): Promise<ConversationRecord> {
    assertNonEmpty(input.userId, "userId");
    assertNonEmpty(input.name, "name");
    const result = await this.#database.query<ConversationRow>({
      text: `INSERT INTO conversaction (conversation_id, user_id, name)
               VALUES ($1, $2, $3)
               RETURNING id, conversation_id, user_id, name, deleted_at, created_at, updated_at`,
      values: [`chat_${randomUUID()}`, input.userId.trim(), input.name.trim()],
      ...(input.traceId === undefined ? {} : { traceId: input.traceId })
    });
    return toConversationRecord(readSingleRow(result.rows, "conversation"));
  }

  /**
   * 调用流程：确保指定会话存在且归属当前用户。
   * 入参：可信 userId、目标 conversationId 和可选 traceId。
   * 出参：已存在且归属当前用户的会话记录。
   *
   * 实现方式：先按 conversationId 查询全局唯一会话；存在且 userId 相同、未删除时返回；
   * 不存在、已删除或跨用户时统一抛业务错误，避免 `/api/chat` 静默创建新会话。
   */
  async ensureConversation(input: {
    readonly traceId?: string;
    readonly userId: string;
    readonly conversationId: string;
  }): Promise<ConversationRecord> {
    assertNonEmpty(input.userId, "userId");
    assertNonEmpty(input.conversationId, "conversationId");

    return this.#readOwnedConversation({
      userId: input.userId,
      conversationId: input.conversationId,
      ...(input.traceId === undefined ? {} : { traceId: input.traceId })
    });
  }

  /**
   * 调用流程：分页读取当前用户的会话列表。
   * 入参：可信 userId、分页 query 和可选 traceId。
   * 出参：未删除会话 items 与 total。
   *
   * 实现方式：count 和列表都按 user_id + deleted_at 过滤，列表按 updated_at/id 倒序，
   * 让最新产生消息或更新的会话排在前面。
   */
  async listConversations(input: {
    readonly traceId?: string;
    readonly userId: string;
    readonly query: ListConversationsQuery;
  }): Promise<ConversationListResult> {
    assertNonEmpty(input.userId, "userId");
    const offset = (input.query.page - 1) * input.query.page_size;
    const count = await this.#database.query<{ readonly total: string | number }>({
      text: `SELECT count(*) AS total
             FROM conversaction
             WHERE user_id = $1 AND deleted_at IS NULL`,
      values: [input.userId.trim()],
      ...(input.traceId === undefined ? {} : { traceId: input.traceId })
    });
    const rows = await this.#database.query<ConversationRow>({
      text: `SELECT id, conversation_id, user_id, name, deleted_at, created_at, updated_at
             FROM conversaction
             WHERE user_id = $1 AND deleted_at IS NULL
             ORDER BY updated_at DESC, id DESC
             LIMIT $2 OFFSET $3`,
      values: [input.userId.trim(), input.query.page_size, offset],
      ...(input.traceId === undefined ? {} : { traceId: input.traceId })
    });
    return {
      items: rows.rows.map(toConversationRecord),
      total: Number(count.rows[0]?.total ?? 0)
    };
  }

  /**
   * 调用流程：向会话明细表写入一条消息。
   * 入参：可信 userId、conversationId、方向和消息正文。
   * 出参：写入后的消息记录。
   *
   * 实现方式：先校验会话已存在且归属当前用户，再生成 `msg_<uuid>` 插入明细；
   * 最后更新会话主表 updated_at，让列表顺序反映最新对话活动。
   */
  async appendMessage(input: {
    readonly traceId?: string;
    readonly userId: string;
    readonly conversationId: string;
    readonly direction: 0 | 1;
    readonly message: string;
  }): Promise<ConversationDetailRecord> {
    await this.#readOwnedConversation({
      userId: input.userId,
      conversationId: input.conversationId,
      ...(input.traceId === undefined ? {} : { traceId: input.traceId })
    });

    const result = await this.#database.query<ConversationDetailRow>({
      text: `INSERT INTO conversaction_detail (
               conversation_id,
               msg_id,
               user_id,
               direction,
               message
             )
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id,
                       conversation_id,
                       msg_id,
                       user_id,
                       direction,
                       message,
                       deleted_at,
                       created_at,
                       updated_at`,
      values: [
        input.conversationId.trim(),
        `msg_${randomUUID()}`,
        input.userId.trim(),
        input.direction,
        input.message
      ],
      ...(input.traceId === undefined ? {} : { traceId: input.traceId })
    });
    await this.#database.query({
      text: `UPDATE conversaction
             SET updated_at = now()
             WHERE conversation_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      values: [input.conversationId.trim(), input.userId.trim()],
      ...(input.traceId === undefined ? {} : { traceId: input.traceId })
    });
    return toConversationDetailRecord(readSingleRow(result.rows, "conversation detail"));
  }

  /**
   * 调用流程：分页读取当前用户指定会话的消息明细。
   * 入参：可信 userId、conversation_id 与分页 query。
   * 出参：未删除消息 items 与 total；会话不存在或跨用户时抛业务错误。
   *
   * 实现方式：先验证会话归属，再按 created_at/id 顺序
   * 返回消息，保证前端分页展示和写入顺序一致。
   */
  async listConversationDetails(input: {
    readonly traceId?: string;
    readonly userId: string;
    readonly query: ConversationDetailQuery;
  }): Promise<ConversationDetailListResult> {
    await this.#readOwnedConversation({
      userId: input.userId,
      conversationId: input.query.conversation_id,
      ...(input.traceId === undefined ? {} : { traceId: input.traceId })
    });
    const offset = (input.query.page - 1) * input.query.page_size;
    const count = await this.#database.query<{ readonly total: string | number }>({
      text: `SELECT count(*) AS total
             FROM conversaction_detail
             WHERE conversation_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      values: [input.query.conversation_id, input.userId.trim()],
      ...(input.traceId === undefined ? {} : { traceId: input.traceId })
    });
    const rows = await this.#database.query<ConversationDetailRow>({
      text: `SELECT id,
                    conversation_id,
                    msg_id,
                    user_id,
                    direction,
                    message,
                    deleted_at,
                    created_at,
                    updated_at
             FROM conversaction_detail
             WHERE conversation_id = $1 AND user_id = $2 AND deleted_at IS NULL
             ORDER BY created_at ASC, id ASC
             LIMIT $3 OFFSET $4`,
      values: [input.query.conversation_id, input.userId.trim(), input.query.page_size, offset],
      ...(input.traceId === undefined ? {} : { traceId: input.traceId })
    });
    return {
      items: rows.rows.map(toConversationDetailRecord),
      total: Number(count.rows[0]?.total ?? 0)
    };
  }

  /**
   * 调用流程：按全局会话 ID 查询会话记录。
   * 入参：conversationId 与可选 traceId。
   * 出参：存在时返回会话记录，不存在时返回 undefined。
   */
  async #findConversationById(
    conversationId: string,
    traceId: string | undefined
  ): Promise<ConversationRecord | undefined> {
    const result = await this.#database.query<ConversationRow>({
      text: `SELECT id, conversation_id, user_id, name, deleted_at, created_at, updated_at
             FROM conversaction
             WHERE conversation_id = $1
             LIMIT 1`,
      values: [conversationId.trim()],
      ...(traceId === undefined ? {} : { traceId })
    });
    return result.rows[0] === undefined ? undefined : toConversationRecord(result.rows[0]);
  }

  /**
   * 调用流程：读取当前用户拥有的指定会话。
   * 入参：可信 userId、conversationId 和可选 traceId。
   * 出参：会话记录；会话不存在、已删除或跨用户时抛业务错误。
   */
  async #readOwnedConversation(input: {
    readonly traceId?: string;
    readonly userId: string;
    readonly conversationId: string;
  }): Promise<ConversationRecord> {
    const conversation = await this.#findConversationById(input.conversationId, input.traceId);
    if (
      conversation === undefined ||
      conversation.deletedAt !== undefined ||
      conversation.userId !== input.userId.trim()
    ) {
      throw new AppError({
        code: "CHAT_CONVERSATION_NOT_FOUND",
        message: "conversation not found",
        retryable: false,
        ...(input.traceId === undefined ? {} : { traceId: input.traceId })
      });
    }
    return conversation;
  }
}

/**
 * 调用流程：构造缺省会话名。
 * 入参：用户消息或任意候选文本。
 * 出参：最多 40 字符的非空名称。
 */
export const buildDefaultConversationName = (message: string): string => {
  const trimmed = message.trim().replaceAll(/\s+/gu, " ");
  return trimmed.length === 0 ? "新会话" : trimmed.slice(0, 40);
};

const assertNonEmpty = (value: string, field: string): void => {
  if (value.trim().length === 0) {
    throw new AppError({
      code: "CHAT_CONVERSATION_INVALID_ARGUMENT",
      message: `${field} is required`,
      retryable: false
    });
  }
};

/**
 * 调用流程：从 INSERT/UPDATE RETURNING 结果中读取唯一行。
 * 入参：数据库 rows 和用于错误消息的实体名。
 * 出参：第一行记录；如果数据库没有返回行，抛出明确错误。
 */
const readSingleRow = <T>(rows: readonly T[], label: string): T => {
  const row = rows[0];
  if (row === undefined) {
    throw new Error(`${label} mutation did not return a row`);
  }
  return row;
};

/**
 * 调用流程：把 PostgreSQL 会话行映射为内部记录。
 * 入参：snake_case 数据库行。
 * 出参：camelCase 会话记录，并把时间统一转成 ISO8601。
 */
const toConversationRecord = (row: ConversationRow): ConversationRecord => ({
  id: Number(row.id),
  conversationId: row.conversation_id,
  userId: row.user_id,
  name: row.name,
  ...(row.deleted_at === null ? {} : { deletedAt: toIso(row.deleted_at) }),
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at)
});

/**
 * 调用流程：把 PostgreSQL 会话消息行映射为内部记录。
 * 入参：snake_case 数据库行。
 * 出参：camelCase 会话消息记录，并约束 direction 为 0 或 1。
 */
const toConversationDetailRecord = (row: ConversationDetailRow): ConversationDetailRecord => ({
  id: Number(row.id),
  conversationId: row.conversation_id,
  msgId: row.msg_id,
  userId: row.user_id,
  direction: row.direction === 0 ? 0 : 1,
  message: row.message,
  ...(row.deleted_at === null ? {} : { deletedAt: toIso(row.deleted_at) }),
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at)
});

/**
 * 调用流程：规范化数据库时间值。
 * 入参：pg 可能返回的 Date 或字符串。
 * 出参：ISO8601 字符串。
 */
const toIso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();
