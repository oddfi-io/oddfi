import type { FoundationDb } from "../../foundation/db/db-component.js";
import type { TagRecord, TweetTagMatchRecord } from "../../models/db/persistence-model.js";
import type {
  BatchCreateTagsRequest,
  BatchUpdateTagsRequest,
  ListTagsQuery,
  UserMatchedTweetsQuery
} from "../../models/http/user-tag-dto-model.js";
import { AppError } from "../../shared/app-error.js";

type TagRow = {
  readonly id: number | string;
  readonly category: string;
  readonly lang_metadata: Record<string, string>;
  readonly sort_order: number;
  readonly deleted_at: Date | string | null;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
};

type UserTagRow = TagRow & {
  readonly user_tag_desc: string;
};

type TweetTagMatchRow = {
  readonly id: number | string;
  readonly trace_id: string;
  readonly tweet_id: string;
  readonly tag_id: number | string;
  readonly tag_category: string;
  readonly tag_lang_metadata: Record<string, string>;
  readonly tweet_payload: Record<string, unknown>;
  readonly llm_result: Record<string, unknown>;
  readonly pushed_at: Date | string | null;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
};

type UserMatchedTweetRow = {
  readonly tweet_id: string;
  readonly tweet_payload: Record<string, unknown>;
  readonly matched_tags: unknown;
  readonly llm_result: Record<string, unknown>;
  readonly matched_at: Date | string;
  readonly pushed_at: Date | string | null;
};

export type TagListResult = {
  readonly items: readonly TagRecord[];
  readonly total: number;
};

export type BatchTagMutationResult = {
  readonly items: readonly TagRecord[];
  readonly failed: readonly {
    readonly id?: number;
    readonly index?: number;
    readonly code: number;
    readonly msg: string;
  }[];
};

export type UserTagView = TagRecord & {
  readonly desc: string;
};

export type UserMatchedTweetView = {
  readonly tweetId: string;
  readonly tweetPayload: Record<string, unknown>;
  readonly matchedTags: readonly Pick<TagRecord, "id" | "category" | "langMetadata">[];
  readonly llmResult: Record<string, unknown>;
  readonly matchedAt: string;
  readonly pushedAt?: string;
};

export type UserMatchedTweetsResult = {
  readonly items: readonly UserMatchedTweetView[];
  readonly total: number;
};

export class PostgresTagRepository {
  readonly #database: Pick<FoundationDb, "query">;

  constructor(database: Pick<FoundationDb, "query">) {
    this.#database = database;
  }

  /**
   * 调用流程：批量创建 tag；同 category + 英文名已存在时走恢复/更新，保证管理端重复提交幂等。
   * 入参：批量创建 DTO。
   * 出参：成功 items 与失败 failed，单条失败不阻断同批其他 tag。
   */
  async createMany(request: BatchCreateTagsRequest): Promise<BatchTagMutationResult> {
    const items: TagRecord[] = [];
    const failed: BatchTagMutationResult["failed"][number][] = [];

    for (const [index, item] of request.items.entries()) {
      const englishName = item.lang_metadata.en;
      if (englishName === undefined) {
        failed.push({ index, code: 40001, msg: "lang_metadata.en is required" });
        continue;
      }
      const existing = await this.findByCategoryAndEnglishName(item.category, englishName);
      if (existing !== undefined) {
        const restored = await this.updateTag({
          id: existing.id,
          category: item.category,
          langMetadata: item.lang_metadata,
          sortOrder: item.sort_order,
          restore: true
        });
        items.push(restored);
        continue;
      }

      try {
        // ON CONFLICT 对齐 0007 的 partial unique index：多实例并发创建同一新标签时，
        // 输掉竞态的一方 DO NOTHING 返回空行，再回查即可拿到赢家落库的同一 tag_id。
        const result = await this.#database.query<TagRow>(
          `INSERT INTO tags (category, lang_metadata, sort_order)
           VALUES ($1, $2::jsonb, $3)
           ON CONFLICT (category, (lang_metadata ->> 'en')) WHERE deleted_at IS NULL
           DO NOTHING
           RETURNING id, category, lang_metadata, sort_order, deleted_at, created_at, updated_at`,
          [item.category, JSON.stringify(item.lang_metadata), item.sort_order]
        );
        if (result.rows.length === 0) {
          const winner = await this.findByCategoryAndEnglishName(item.category, englishName);
          if (winner === undefined) {
            failed.push({ index, code: 50000, msg: "tag insert conflict but winner not found" });
            continue;
          }
          items.push(winner);
          continue;
        }
        items.push(readSingleTag(result.rows));
      } catch (error) {
        failed.push({
          index,
          code: 50000,
          msg: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return { items, failed };
  }

  async updateMany(request: BatchUpdateTagsRequest): Promise<BatchTagMutationResult> {
    const items: TagRecord[] = [];
    const failed: BatchTagMutationResult["failed"][number][] = [];

    for (const item of request.items) {
      try {
        const existing = await this.findByIds([item.id], { includeDeleted: true });
        if (existing.length === 0) {
          failed.push({ id: item.id, code: 40004, msg: "tag not found" });
          continue;
        }

        items.push(
          await this.updateTag({
            id: item.id,
            ...(item.category === undefined ? {} : { category: item.category }),
            ...(item.lang_metadata === undefined ? {} : { langMetadata: item.lang_metadata }),
            ...(item.sort_order === undefined ? {} : { sortOrder: item.sort_order })
          })
        );
      } catch (error) {
        failed.push({
          id: item.id,
          code: 50000,
          msg: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return { items, failed };
  }

  async deleteMany(ids: readonly number[]): Promise<BatchTagMutationResult> {
    const result = await this.#database.query<TagRow>(
      `UPDATE tags
       SET deleted_at = COALESCE(deleted_at, now()), updated_at = now()
       WHERE id = ANY($1::bigint[])
       RETURNING id, category, lang_metadata, sort_order, deleted_at, created_at, updated_at`,
      [ids]
    );
    const items = result.rows.map(toTagRecord);
    const updatedIds = new Set(items.map((item) => item.id));
    return {
      items,
      failed: ids
        .filter((id) => !updatedIds.has(id))
        .map((id) => ({ id, code: 40004, msg: "tag not found" }))
    };
  }

  async list(query: ListTagsQuery): Promise<TagListResult> {
    const offset = (query.page - 1) * query.page_size;
    const params: unknown[] = [];
    const where: string[] = [];
    if (query.category !== undefined) {
      params.push(query.category);
      where.push(`category = $${params.length}`);
    }
    if (!query.include_deleted) {
      where.push("deleted_at IS NULL");
    }
    const whereSql = where.length === 0 ? "" : `WHERE ${where.join(" AND ")}`;

    const count = await this.#database.query<{ readonly total: string | number }>(
      `SELECT count(*) AS total FROM tags ${whereSql}`,
      params
    );
    params.push(query.page_size, offset);
    const rows = await this.#database.query<TagRow>(
      `SELECT id, category, lang_metadata, sort_order, deleted_at, created_at, updated_at
       FROM tags
       ${whereSql}
       ORDER BY sort_order ASC, id ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      items: rows.rows.map(toTagRecord),
      total: Number(count.rows[0]?.total ?? 0)
    };
  }

  async findByIds(
    ids: readonly number[],
    options: { readonly includeDeleted?: boolean } = {}
  ): Promise<readonly TagRecord[]> {
    if (ids.length === 0) {
      return [];
    }
    const result = await this.#database.query<TagRow>(
      `SELECT id, category, lang_metadata, sort_order, deleted_at, created_at, updated_at
       FROM tags
       WHERE id = ANY($1::bigint[])
       ${options.includeDeleted === true ? "" : "AND deleted_at IS NULL"}
       ORDER BY sort_order ASC, id ASC`,
      [ids]
    );
    return result.rows.map(toTagRecord);
  }

  async listActiveByCategories(categories: readonly string[]): Promise<readonly TagRecord[]> {
    const result = await this.#database.query<TagRow>(
      `SELECT id, category, lang_metadata, sort_order, deleted_at, created_at, updated_at
       FROM tags
       WHERE deleted_at IS NULL AND category = ANY($1::varchar[])
       ORDER BY category ASC, sort_order ASC, id ASC`,
      [categories]
    );
    return result.rows.map(toTagRecord);
  }

  async replaceUserTags(userId: string, tagIds: readonly number[], desc: string): Promise<void> {
    await this.assertActiveTags(tagIds);
    await this.restoreUserTags(userId, tagIds, desc);
    await this.#database.query(
      `UPDATE user_tags
       SET deleted_at = now(), updated_at = now()
       WHERE user_id = $1 AND NOT (tag_id = ANY($2::bigint[])) AND deleted_at IS NULL`,
      [userId, tagIds]
    );
  }

  async addUserTags(userId: string, tagIds: readonly number[], desc: string): Promise<void> {
    await this.assertActiveTags(tagIds);
    await this.restoreUserTags(userId, tagIds, desc);
  }

  async deleteUserTags(userId: string, tagIds: readonly number[]): Promise<void> {
    await this.#database.query(
      `UPDATE user_tags
       SET deleted_at = now(), updated_at = now()
       WHERE user_id = $1 AND tag_id = ANY($2::bigint[]) AND deleted_at IS NULL`,
      [userId, tagIds]
    );
  }

  /**
   * 调用流程：反查一组 tag 的活跃订阅用户，供命中推文按 user 频道 fan-out。
   * 入参：tagIds（活跃 tag id 列表，通常为单条推文命中的多个 tag）。
   * 出参：去重后的活跃订阅 user_id 列表（十进制字符串，无前导零）；空入参直接返回空列表。
   * 实现：按 tag_id 做 IN 反查 user_tags，过滤软删除行，DISTINCT 去重；
   *       同一 user 订阅了多个命中 tag 时只返回一次，避免同推文重复 fan-out。
   */
  async listUserIdsByTagIds(tagIds: readonly number[]): Promise<readonly string[]> {
    // 空入参不查库：无命中 tag 时无需 fan-out。
    if (tagIds.length === 0) {
      return [];
    }
    const result = await this.#database.query<{ readonly user_id: string | number }>(
      `SELECT DISTINCT user_id
       FROM user_tags
       WHERE tag_id = ANY($1::bigint[])
         AND deleted_at IS NULL`,
      [tagIds]
    );
    // user_id 在库里是 bigint，pg 驱动可能返回 number 或 string；统一归一为十进制字符串，与主后端 token 授权频道命名逐字一致。
    return result.rows.map((row) => String(row.user_id));
  }

  async listUserTags(
    userId: string,
    options: { readonly includeDeleted: boolean }
  ): Promise<readonly UserTagView[]> {
    const result = await this.#database.query<UserTagRow>(
      `SELECT t.id,
              t.category,
              t.lang_metadata,
              t.sort_order,
              t.deleted_at,
              t.created_at,
              t.updated_at,
              ut."desc" AS user_tag_desc
       FROM user_tags ut
       INNER JOIN tags t ON t.id = ut.tag_id
       WHERE ut.user_id = $1
         ${options.includeDeleted ? "" : "AND ut.deleted_at IS NULL AND t.deleted_at IS NULL"}
       ORDER BY t.sort_order ASC, t.id ASC`,
      [userId]
    );
    return result.rows.map((row) => ({
      ...toTagRecord(row),
      desc: row.user_tag_desc
    }));
  }

  async listUserMatchedTweets(
    userId: string,
    query: UserMatchedTweetsQuery
  ): Promise<UserMatchedTweetsResult> {
    const offset = (query.page - 1) * query.pageSize;
    const count = await this.#database.query<{ readonly total: string | number }>(
      `SELECT count(DISTINCT m.tweet_id) AS total
       FROM tweet_tag_matches m
       INNER JOIN user_tags ut ON ut.tag_id = m.tag_id
       INNER JOIN tags t ON t.id = m.tag_id
       WHERE ut.user_id = $1
         AND ut.deleted_at IS NULL
         AND t.deleted_at IS NULL
         AND m.tweet_id <> ''`,
      [userId]
    );
    const result = await this.#database.query<UserMatchedTweetRow>(
      `WITH user_matches AS (
         SELECT m.tweet_id,
                m.tag_id,
                m.tag_category,
                m.tag_lang_metadata,
                m.tweet_payload,
                m.llm_result,
                m.pushed_at,
                m.created_at,
                m.updated_at
         FROM tweet_tag_matches m
         INNER JOIN user_tags ut ON ut.tag_id = m.tag_id
         INNER JOIN tags t ON t.id = m.tag_id
         WHERE ut.user_id = $1
           AND ut.deleted_at IS NULL
           AND t.deleted_at IS NULL
           AND m.tweet_id <> ''
       ),
       grouped AS (
         SELECT tweet_id,
                (array_agg(tweet_payload ORDER BY updated_at DESC, created_at DESC))[1] AS tweet_payload,
                jsonb_agg(
                  DISTINCT jsonb_build_object(
                    'id', tag_id,
                    'category', tag_category,
                    'lang_metadata', tag_lang_metadata
                  )
                ) AS matched_tags,
                (array_agg(llm_result ORDER BY updated_at DESC, created_at DESC))[1] AS llm_result,
                max(updated_at) AS matched_at,
                max(pushed_at) AS pushed_at
         FROM user_matches
         GROUP BY tweet_id
       )
       SELECT tweet_id, tweet_payload, matched_tags, llm_result, matched_at, pushed_at
       FROM grouped
       ORDER BY matched_at DESC, tweet_id DESC
       LIMIT $2 OFFSET $3`,
      [userId, query.pageSize, offset]
    );

    return {
      items: result.rows.map(toUserMatchedTweetView),
      total: Number(count.rows[0]?.total ?? 0)
    };
  }

  async assertActiveTags(tagIds: readonly number[]): Promise<void> {
    const tags = await this.findByIds(tagIds);
    if (new Set(tags.map((tag) => tag.id)).size !== new Set(tagIds).size) {
      throw new AppError({
        code: "TAG_NOT_FOUND",
        message: "one or more tag ids do not exist or were deleted",
        retryable: false
      });
    }
  }

  async storeTweetTagMatch(input: {
    readonly traceId: string;
    readonly tweetId: string;
    readonly tag: TagRecord;
    readonly tweetPayload: Record<string, unknown>;
    readonly llmResult: Record<string, unknown>;
  }): Promise<TweetTagMatchRecord> {
    const result = await this.#database.query<TweetTagMatchRow>(
      `INSERT INTO tweet_tag_matches (
         trace_id,
         tweet_id,
         tag_id,
         tag_category,
         tag_lang_metadata,
         tweet_payload,
         llm_result
       )
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb)
       ON CONFLICT (tweet_id, tag_id) WHERE tweet_id <> ''
       DO UPDATE SET
         trace_id = EXCLUDED.trace_id,
         tag_category = EXCLUDED.tag_category,
         tag_lang_metadata = EXCLUDED.tag_lang_metadata,
         tweet_payload = EXCLUDED.tweet_payload,
         llm_result = EXCLUDED.llm_result,
         updated_at = now()
       RETURNING id,
                 trace_id,
                 tweet_id,
                 tag_id,
                 tag_category,
                 tag_lang_metadata,
                 tweet_payload,
                 llm_result,
                 pushed_at,
                 created_at,
                 updated_at`,
      [
        input.traceId,
        input.tweetId,
        input.tag.id,
        input.tag.category,
        JSON.stringify(input.tag.langMetadata),
        JSON.stringify(input.tweetPayload),
        JSON.stringify(input.llmResult)
      ]
    );
    return toTweetTagMatchRecord(readSingleRow(result.rows, "tweet tag match"));
  }

  async markTweetTagMatchPushed(id: number): Promise<void> {
    await this.#database.query(
      `UPDATE tweet_tag_matches
       SET pushed_at = now(), updated_at = now()
       WHERE id = $1`,
      [id]
    );
  }

  private async restoreUserTags(
    userId: string,
    tagIds: readonly number[],
    desc: string
  ): Promise<void> {
    for (const tagId of tagIds) {
      await this.#database.query(
        `INSERT INTO user_tags (user_id, tag_id, "desc")
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, tag_id)
         DO UPDATE SET "desc" = EXCLUDED."desc", deleted_at = NULL, updated_at = now()`,
        [userId, tagId, desc]
      );
    }
  }

  private async findByCategoryAndEnglishName(
    category: string,
    englishName: string
  ): Promise<TagRecord | undefined> {
    const result = await this.#database.query<TagRow>(
      `SELECT id, category, lang_metadata, sort_order, deleted_at, created_at, updated_at
       FROM tags
       WHERE category = $1 AND lang_metadata ->> 'en' = $2
       LIMIT 1`,
      [category, englishName]
    );
    return result.rows[0] === undefined ? undefined : toTagRecord(result.rows[0]);
  }

  private async updateTag(input: {
    readonly id: number;
    readonly category?: string;
    readonly langMetadata?: Record<string, string>;
    readonly sortOrder?: number;
    readonly restore?: boolean;
  }): Promise<TagRecord> {
    const result = await this.#database.query<TagRow>(
      `UPDATE tags
       SET category = COALESCE($2, category),
           lang_metadata = COALESCE($3::jsonb, lang_metadata),
           sort_order = COALESCE($4, sort_order),
           deleted_at = CASE WHEN $5::boolean THEN NULL ELSE deleted_at END,
           updated_at = now()
       WHERE id = $1
       RETURNING id, category, lang_metadata, sort_order, deleted_at, created_at, updated_at`,
      [
        input.id,
        input.category ?? null,
        input.langMetadata === undefined ? null : JSON.stringify(input.langMetadata),
        input.sortOrder ?? null,
        input.restore ?? false
      ]
    );
    return readSingleTag(result.rows);
  }
}

const readSingleTag = (rows: readonly TagRow[]): TagRecord => {
  const row = readSingleRow(rows, "tag");
  return toTagRecord(row);
};

const readSingleRow = <T>(rows: readonly T[], label: string): T => {
  const row = rows[0];
  if (row === undefined) {
    throw new Error(`${label} mutation did not return a row`);
  }
  return row;
};

export const toTagRecord = (row: TagRow): TagRecord => ({
  id: Number(row.id),
  category: row.category,
  langMetadata: row.lang_metadata,
  sortOrder: row.sort_order,
  ...(row.deleted_at === null ? {} : { deletedAt: toIso(row.deleted_at) }),
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at)
});

const toIso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const toTweetTagMatchRecord = (row: TweetTagMatchRow): TweetTagMatchRecord => ({
  id: Number(row.id),
  traceId: row.trace_id,
  tweetId: row.tweet_id,
  tagId: Number(row.tag_id),
  tagCategory: row.tag_category,
  tagLangMetadata: row.tag_lang_metadata,
  tweetPayload: row.tweet_payload,
  llmResult: row.llm_result,
  ...(row.pushed_at === null ? {} : { pushedAt: toIso(row.pushed_at) }),
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at)
});

const toUserMatchedTweetView = (row: UserMatchedTweetRow): UserMatchedTweetView => ({
  tweetId: row.tweet_id,
  tweetPayload: row.tweet_payload,
  matchedTags: parseMatchedTags(row.matched_tags),
  llmResult: row.llm_result,
  matchedAt: toIso(row.matched_at),
  ...(row.pushed_at === null ? {} : { pushedAt: toIso(row.pushed_at) })
});

const parseMatchedTags = (
  value: unknown
): readonly Pick<TagRecord, "id" | "category" | "langMetadata">[] => {
  const rows = Array.isArray(value) ? value : [];
  return rows.flatMap((item) => {
    if (typeof item !== "object" || item === null) {
      return [];
    }
    const record = item as {
      readonly id?: unknown;
      readonly category?: unknown;
      readonly lang_metadata?: unknown;
    };
    if (
      (typeof record.id !== "number" && typeof record.id !== "string") ||
      typeof record.category !== "string" ||
      typeof record.lang_metadata !== "object" ||
      record.lang_metadata === null ||
      Array.isArray(record.lang_metadata)
    ) {
      return [];
    }
    return [
      {
        id: Number(record.id),
        category: record.category,
        langMetadata: record.lang_metadata as Record<string, string>
      }
    ];
  });
};
