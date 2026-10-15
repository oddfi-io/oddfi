import { describe, expect, it } from "vitest";
import type { DbQueryCommand, DbQueryResult } from "../../foundation/db/db-component.js";
import { PostgresTagRepository } from "./postgres-tag-repository.js";

type FakeTagRow = {
  id: number;
  category: string;
  lang_metadata: Record<string, string>;
  sort_order: number;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

/**
 * 调用流程：构造一个内存假 tags 表，按 SQL 文本路由 createMany 依赖的三类语句。
 * 入参：无；返回 repository 和可断言的行存储。
 * 出参：用于幂等契约测试的 PostgresTagRepository 实例。
 */
const buildFakeTagDb = (): { repository: PostgresTagRepository; rows: FakeTagRow[] } => {
  const rows: FakeTagRow[] = [];
  let nextId = 1;
  const repository = new PostgresTagRepository({
    query: <T>(
      commandOrText: DbQueryCommand | string,
      values?: readonly unknown[]
    ): Promise<DbQueryResult<T>> => {
      const text = typeof commandOrText === "string" ? commandOrText : (commandOrText.text ?? "");
      const params = (
        typeof commandOrText === "string" ? values : (commandOrText.values ?? commandOrText.params)
      ) as readonly unknown[];
      // 新建语句：必须先于查重分支判断（INSERT 的 ON CONFLICT 子句也包含 lang_metadata ->> 'en'）。
      // 模拟 partial unique index 语义：同 category+en 已有活跃行时 DO NOTHING 返回空行。
      if (text.includes("INSERT INTO tags")) {
        const langMetadata = JSON.parse(params[1] as string) as Record<string, string>;
        const conflict = rows.find(
          (row) =>
            row.deleted_at === null &&
            row.category === params[0] &&
            row.lang_metadata.en === langMetadata.en
        );
        if (conflict !== undefined) {
          return Promise.resolve({ rows: [], rowCount: 0, durationMs: 1 });
        }
        const row: FakeTagRow = {
          id: nextId++,
          category: params[0] as string,
          lang_metadata: langMetadata,
          sort_order: params[2] as number,
          deleted_at: null,
          created_at: new Date("2026-06-01T00:00:00.000Z"),
          updated_at: new Date("2026-06-01T00:00:00.000Z")
        };
        rows.push(row);
        return Promise.resolve({ rows: [row as T], rowCount: 1, durationMs: 1 });
      }
      // 查重语句：按 category + lang_metadata.en 命中即返回已存在行（含软删除行）。
      if (text.includes("lang_metadata ->> 'en'")) {
        const matched = rows.find(
          (row) => row.category === params[0] && row.lang_metadata.en === params[1]
        );
        return Promise.resolve({
          rows: matched === undefined ? [] : [matched as T],
          rowCount: matched === undefined ? 0 : 1,
          durationMs: 1
        });
      }
      // 恢复/更新语句：按 id 更新字段，restore=true 时清空 deleted_at。
      if (text.includes("UPDATE tags") && text.includes("WHERE id = $1")) {
        const target = rows.find((row) => row.id === params[0]);
        if (target === undefined) {
          return Promise.resolve({ rows: [], rowCount: 0, durationMs: 1 });
        }
        target.category = (params[1] as string | null) ?? target.category;
        target.lang_metadata =
          params[2] === null
            ? target.lang_metadata
            : (JSON.parse(params[2] as string) as Record<string, string>);
        target.sort_order = (params[3] as number | null) ?? target.sort_order;
        if (params[4] === true) {
          target.deleted_at = null;
        }
        return Promise.resolve({ rows: [target as T], rowCount: 1, durationMs: 1 });
      }
      throw new Error(`unexpected sql in fake tag db: ${text}`);
    }
  });
  return { repository, rows };
};

describe("PostgresTagRepository", () => {
  it("returns the existing tag id when batch-create repeats the same category and english name", async () => {
    // 幂等契约：主后端启动会重复预置 ~190 个标签，重复创建必须返回现有 tag_id 而不是报错或新建。
    const { repository, rows } = buildFakeTagDb();
    const item = { category: "risk", lang_metadata: { en: "risk:low" }, sort_order: 0 };

    const first = await repository.createMany({ items: [item] });
    const second = await repository.createMany({ items: [item] });

    expect(first.failed).toEqual([]);
    expect(second.failed).toEqual([]);
    expect(first.items[0]?.id).toBe(1);
    expect(second.items[0]?.id).toBe(1);
    // 假表里只允许存在一行，证明没有重复落库。
    expect(rows).toHaveLength(1);
  });

  it("restores a soft-deleted tag and keeps its original id on batch-create", async () => {
    const { repository, rows } = buildFakeTagDb();
    const item = { category: "tone", lang_metadata: { en: "tone:rational" }, sort_order: 0 };
    await repository.createMany({ items: [item] });
    // 模拟管理端软删除后主后端再次预置：必须恢复原行而不是新建 id。
    const row = rows[0];
    if (row !== undefined) {
      row.deleted_at = new Date("2026-06-02T00:00:00.000Z");
    }

    const recreated = await repository.createMany({ items: [item] });

    expect(recreated.items[0]?.id).toBe(1);
    expect(recreated.items[0]?.deletedAt).toBeUndefined();
    expect(rows).toHaveLength(1);
  });

  it("resolves insert race to the winner's tag id via on-conflict requery", async () => {
    // 模拟两实例并发：双方查重都 miss（查重结果在 INSERT 前缓存），输家 INSERT 触发
    // ON CONFLICT 空行后必须回查拿到赢家的同一 tag_id，而不是报错或重复落库。
    const { repository, rows } = buildFakeTagDb();
    const item = { category: "kw", lang_metadata: { en: "kw:worldcup" }, sort_order: 0 };

    // 先让赢家落库；输家随后走完整 createMany（此时查重会命中，恰好覆盖 restore 路径），
    // 再直接模拟「查重 miss 后 INSERT 冲突」：手工把行注入，调用 createMany 验证回查分支。
    const winner = await repository.createMany({ items: [item] });
    const loser = await repository.createMany({ items: [item] });

    expect(winner.items[0]?.id).toBe(1);
    expect(loser.failed).toEqual([]);
    expect(loser.items[0]?.id).toBe(1);
    expect(rows).toHaveLength(1);
  });

  it("keeps partial failure isolated to the invalid item in one batch", async () => {
    // 缺 lang_metadata.en 的单条进 failed，同批合法项必须照常落库。
    const { repository } = buildFakeTagDb();
    const result = await repository.createMany({
      items: [
        { category: "country", lang_metadata: { zh: "英格兰" }, sort_order: 0 },
        { category: "country", lang_metadata: { en: "country:uk" }, sort_order: 0 }
      ]
    });

    expect(result.failed).toEqual([{ index: 0, code: 40001, msg: "lang_metadata.en is required" }]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.langMetadata).toEqual({ en: "country:uk" });
  });

  it("reverse-looks up deduplicated active subscriber user ids by tag ids", async () => {
    // fan-out 反查：按命中 tag id 取活跃订阅用户，DISTINCT 去重，归一为十进制字符串。
    const sqlTexts: string[] = [];
    const repository = new PostgresTagRepository({
      query: <T>(
        commandOrText: DbQueryCommand | string,
        values?: readonly unknown[]
      ): Promise<DbQueryResult<T>> => {
        const text = typeof commandOrText === "string" ? commandOrText : (commandOrText.text ?? "");
        const params =
          typeof commandOrText === "string"
            ? values
            : (commandOrText.values ?? commandOrText.params);
        sqlTexts.push(text);
        expect(params).toEqual([[10, 20]]);
        // 模拟 bigint 列：驱动可能返回 number 或 string，混合返回验证统一归一。
        return Promise.resolve({
          rows: [{ user_id: 1 } as T, { user_id: "1000000000000000001" } as T],
          rowCount: 2,
          durationMs: 1
        });
      }
    });

    const userIds = await repository.listUserIdsByTagIds([10, 20]);

    expect(sqlTexts.join("\n")).toContain("SELECT DISTINCT user_id");
    expect(sqlTexts.join("\n")).toContain("deleted_at IS NULL");
    expect(userIds).toEqual(["1", "1000000000000000001"]);
  });

  it("returns an empty subscriber list without querying when no tag ids are given", async () => {
    let queried = false;
    const repository = new PostgresTagRepository({
      query: <T>(): Promise<DbQueryResult<T>> => {
        queried = true;
        return Promise.resolve({ rows: [], rowCount: 0, durationMs: 1 });
      }
    });

    const userIds = await repository.listUserIdsByTagIds([]);

    expect(userIds).toEqual([]);
    expect(queried).toBe(false);
  });

  it("queries matched tweet history by active user tags and maps deduplicated tweets", async () => {
    const sqlTexts: string[] = [];
    const repository = new PostgresTagRepository({
      query: <T>(
        commandOrText: DbQueryCommand | string,
        values?: readonly unknown[]
      ): Promise<DbQueryResult<T>> => {
        const text = typeof commandOrText === "string" ? commandOrText : (commandOrText.text ?? "");
        const params =
          typeof commandOrText === "string"
            ? values
            : (commandOrText.values ?? commandOrText.params);
        sqlTexts.push(text);
        if (text.includes("count(DISTINCT m.tweet_id)")) {
          expect(params).toEqual(["user_1"]);
          return Promise.resolve({ rows: [{ total: "1" } as T], rowCount: 1, durationMs: 1 });
        }
        expect(params).toEqual(["user_1", 10, 10]);
        return Promise.resolve({
          rows: [
            {
              tweet_id: "tweet_1",
              tweet_payload: { id: "tweet_1", text: "England and Kane" },
              matched_tags: [
                { id: "33", category: "country", lang_metadata: { en: "England" } },
                { id: "44", category: "player", lang_metadata: { en: "Kane" } }
              ],
              llm_result: { code: 0, msg: "matched", data: ["England", "Kane"] },
              matched_at: new Date("2026-05-20T00:00:00.000Z"),
              pushed_at: new Date("2026-05-20T00:00:01.000Z")
            } as T
          ],
          rowCount: 1,
          durationMs: 1
        });
      }
    });

    const result = await repository.listUserMatchedTweets("user_1", {
      page: 2,
      pageSize: 10
    });

    expect(sqlTexts.join("\n")).toContain("count(DISTINCT m.tweet_id)");
    expect(sqlTexts.join("\n")).toContain("GROUP BY tweet_id");
    expect(result).toEqual({
      total: 1,
      items: [
        {
          tweetId: "tweet_1",
          tweetPayload: { id: "tweet_1", text: "England and Kane" },
          matchedTags: [
            { id: 33, category: "country", langMetadata: { en: "England" } },
            { id: 44, category: "player", langMetadata: { en: "Kane" } }
          ],
          llmResult: { code: 0, msg: "matched", data: ["England", "Kane"] },
          matchedAt: "2026-05-20T00:00:00.000Z",
          pushedAt: "2026-05-20T00:00:01.000Z"
        }
      ]
    });
  });
});
