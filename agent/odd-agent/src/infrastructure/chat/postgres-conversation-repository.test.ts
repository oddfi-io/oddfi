import { describe, expect, it } from "vitest";
import type { DbQueryCommand, DbQueryResult } from "../../foundation/db/db-component.js";
import type { AppError } from "../../shared/app-error.js";
import {
  buildDefaultConversationName,
  PostgresConversationRepository
} from "./postgres-conversation-repository.js";

const baseTime = new Date("2026-05-26T00:00:00.000Z");

const buildConversationRow = (
  overrides: {
    readonly conversation_id?: string;
    readonly user_id?: string;
    readonly name?: string;
    readonly deleted_at?: Date | string | null;
  } = {}
) => ({
  id: "1",
  conversation_id: overrides.conversation_id ?? "conv_1",
  user_id: overrides.user_id ?? "user_1",
  name: overrides.name ?? "会话",
  deleted_at: overrides.deleted_at ?? null,
  created_at: baseTime,
  updated_at: baseTime
});

const buildDetailRow = () => ({
  id: "2",
  conversation_id: "conv_1",
  msg_id: "msg_1",
  user_id: "user_1",
  direction: 0,
  message: "分析比赛",
  deleted_at: null,
  created_at: baseTime,
  updated_at: baseTime
});

type QueryCall = {
  readonly text: string;
  readonly values: readonly unknown[] | undefined;
};

describe("PostgresConversationRepository", () => {
  it("creates a conversation with generated id and trimmed name", async () => {
    const calls: QueryCall[] = [];
    const repository = new PostgresConversationRepository({
      query: <T>(
        commandOrText: DbQueryCommand | string,
        values?: readonly unknown[]
      ): Promise<DbQueryResult<T>> => {
        const command = toCommand(commandOrText, values);
        calls.push(command);
        expect(command.text).toContain("INSERT INTO conversaction");
        expect(command.values?.[0]).toEqual(expect.stringMatching(/^chat_/u));
        expect(command.values?.[1]).toBe("user_1");
        expect(command.values?.[2]).toBe("我的会话");
        return Promise.resolve({
          rows: [buildConversationRow({ conversation_id: String(command.values?.[0]) }) as T],
          rowCount: 1,
          durationMs: 1
        });
      }
    });

    const conversation = await repository.createConversation({
      userId: " user_1 ",
      name: " 我的会话 "
    });

    expect(calls).toHaveLength(1);
    expect(conversation.conversationId).toMatch(/^chat_/u);
    expect(conversation.createdAt).toBe("2026-05-26T00:00:00.000Z");
  });

  it("rejects missing or cross-user conversation ids instead of creating details", async () => {
    const calls: QueryCall[] = [];
    const repository = new PostgresConversationRepository({
      query: <T>(
        commandOrText: DbQueryCommand | string,
        values?: readonly unknown[]
      ): Promise<DbQueryResult<T>> => {
        const command = toCommand(commandOrText, values);
        calls.push(command);
        return Promise.resolve({
          rows: calls.length === 1 ? [] : [buildConversationRow({ user_id: "other_user" }) as T],
          rowCount: calls.length === 1 ? 0 : 1,
          durationMs: 1
        });
      }
    });

    await expect(
      repository.appendMessage({
        userId: "user_1",
        conversationId: "conv_1",
        direction: 0,
        message: "分析比赛"
      })
    ).rejects.toMatchObject({
      code: "CHAT_CONVERSATION_NOT_FOUND"
    } satisfies Partial<AppError>);
    await expect(
      repository.appendMessage({
        userId: "user_1",
        conversationId: "conv_2",
        direction: 0,
        message: "分析比赛"
      })
    ).rejects.toMatchObject({
      code: "CHAT_CONVERSATION_NOT_FOUND"
    } satisfies Partial<AppError>);
    expect(calls).toHaveLength(2);
    expect(calls.map((call) => call.text)).toEqual([
      expect.stringContaining("WHERE conversation_id = $1"),
      expect.stringContaining("WHERE conversation_id = $1")
    ]);
  });

  it("appends a message and updates the parent conversation timestamp", async () => {
    const calls: QueryCall[] = [];
    const repository = new PostgresConversationRepository({
      query: <T>(
        commandOrText: DbQueryCommand | string,
        values?: readonly unknown[]
      ): Promise<DbQueryResult<T>> => {
        const command = toCommand(commandOrText, values);
        calls.push(command);
        if (command.text.includes("SELECT id, conversation_id")) {
          return Promise.resolve({
            rows: [buildConversationRow() as T],
            rowCount: 1,
            durationMs: 1
          });
        }
        if (command.text.includes("INSERT INTO conversaction_detail")) {
          expect(command.values?.[0]).toBe("conv_1");
          expect(command.values?.[2]).toBe("user_1");
          expect(command.values?.[3]).toBe(0);
          expect(command.values?.[4]).toBe("分析比赛");
          return Promise.resolve({
            rows: [buildDetailRow() as T],
            rowCount: 1,
            durationMs: 1
          });
        }
        return Promise.resolve({ rows: [], rowCount: 1, durationMs: 1 });
      }
    });

    const detail = await repository.appendMessage({
      userId: "user_1",
      conversationId: "conv_1",
      direction: 0,
      message: "分析比赛"
    });

    expect(detail).toMatchObject({
      conversationId: "conv_1",
      msgId: "msg_1",
      userId: "user_1",
      direction: 0,
      message: "分析比赛"
    });
    expect(calls.map((call) => call.text)).toEqual([
      expect.stringContaining("FROM conversaction"),
      expect.stringContaining("INSERT INTO conversaction_detail"),
      expect.stringContaining("UPDATE conversaction")
    ]);
  });

  it("lists conversation details only after ownership validation", async () => {
    const calls: QueryCall[] = [];
    const repository = new PostgresConversationRepository({
      query: <T>(
        commandOrText: DbQueryCommand | string,
        values?: readonly unknown[]
      ): Promise<DbQueryResult<T>> => {
        const command = toCommand(commandOrText, values);
        calls.push(command);
        if (command.text.includes("FROM conversaction") && !command.text.includes("_detail")) {
          return Promise.resolve({
            rows: [buildConversationRow() as T],
            rowCount: 1,
            durationMs: 1
          });
        }
        if (command.text.includes("count(*) AS total")) {
          expect(command.values).toEqual(["conv_1", "user_1"]);
          return Promise.resolve({ rows: [{ total: "1" } as T], rowCount: 1, durationMs: 1 });
        }
        expect(command.values).toEqual(["conv_1", "user_1", 10, 10]);
        return Promise.resolve({ rows: [buildDetailRow() as T], rowCount: 1, durationMs: 1 });
      }
    });

    const result = await repository.listConversationDetails({
      userId: "user_1",
      query: { conversation_id: "conv_1", page: 2, page_size: 10 }
    });

    expect(result).toEqual({
      total: 1,
      items: [
        {
          id: 2,
          conversationId: "conv_1",
          msgId: "msg_1",
          userId: "user_1",
          direction: 0,
          message: "分析比赛",
          createdAt: "2026-05-26T00:00:00.000Z",
          updatedAt: "2026-05-26T00:00:00.000Z"
        }
      ]
    });
    expect(calls[0]?.text).toContain("WHERE conversation_id = $1");
  });

  it("builds compact default conversation names", () => {
    expect(buildDefaultConversationName("  今天   篮球比赛怎么交易？  ")).toBe(
      "今天 篮球比赛怎么交易？"
    );
    expect(buildDefaultConversationName("")).toBe("新会话");
    expect(buildDefaultConversationName("a".repeat(50))).toHaveLength(40);
  });
});

const toCommand = (
  commandOrText: DbQueryCommand | string,
  values?: readonly unknown[]
): QueryCall =>
  typeof commandOrText === "string"
    ? { text: commandOrText, values }
    : { text: commandOrText.text ?? commandOrText.sql ?? "", values: commandOrText.values };
