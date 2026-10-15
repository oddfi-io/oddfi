import { describe, expect, it } from "vitest";
import { buildServer } from "./server.js";
import { memoryListResponseSchema } from "../../models/http/memory-dto-model.js";
import type {
  ConversationDetailRecord,
  ConversationRecord
} from "../../models/db/persistence-model.js";

const buildTag = (id: number, name: string) => ({
  id,
  category: "player",
  langMetadata: { en: name },
  sortOrder: 0,
  createdAt: "2026-05-19T00:00:00.000Z",
  updatedAt: "2026-05-19T00:00:00.000Z"
});

const buildConversation = (overrides: Partial<ConversationRecord> = {}): ConversationRecord => ({
  id: overrides.id ?? 1,
  conversationId: overrides.conversationId ?? "conv_chat",
  userId: overrides.userId ?? "user_1",
  name: overrides.name ?? "测试会话",
  createdAt: overrides.createdAt ?? "2026-05-26T00:00:00.000Z",
  updatedAt: overrides.updatedAt ?? "2026-05-26T00:00:00.000Z",
  ...(overrides.deletedAt === undefined ? {} : { deletedAt: overrides.deletedAt })
});

const buildConversationDetail = (
  overrides: Partial<ConversationDetailRecord> = {}
): ConversationDetailRecord => ({
  id: overrides.id ?? 1,
  conversationId: overrides.conversationId ?? "conv_chat",
  msgId: overrides.msgId ?? "msg_1",
  userId: overrides.userId ?? "user_1",
  direction: overrides.direction ?? 0,
  message: overrides.message ?? "分析比赛",
  createdAt: overrides.createdAt ?? "2026-05-26T00:00:00.000Z",
  updatedAt: overrides.updatedAt ?? "2026-05-26T00:00:00.000Z",
  ...(overrides.deletedAt === undefined ? {} : { deletedAt: overrides.deletedAt })
});

// 所有 internal 路由测试统一使用同一个服务间 token，模拟主后端注入的 X-Service-Token。
const SERVICE_TOKEN = "svc_token_test";
const serviceTokenHeader = { "x-service-token": SERVICE_TOKEN };

describe("user tag HTTP server", () => {
  it("only exposes health and user tag routes", async () => {
    const server = await buildServer({
      requestTimeoutMs: 1000,
      internalServiceToken: SERVICE_TOKEN
    });
    try {
      const health = await server.inject({ method: "GET", url: "/health" });
      const agents = await server.inject({
        method: "GET",
        url: "/internal/agents",
        headers: serviceTokenHeader
      });

      expect(health.statusCode).toBe(200);
      expect(health.json()).toEqual({
        status: "ok",
        service: "odd-agent",
        features: ["foundation", "memory", "chat_agent", "user_tag"]
      });
      expect(agents.statusCode).toBe(404);
    } finally {
      await server.close();
    }
  });

  it("serves chat test page and chat SSE route", async () => {
    const server = await buildServer({
      requestTimeoutMs: 1000,
      chatTestPagePath: "test/chat-agent/chat-test.html",
      conversationRepository: {
        appendMessage: () => Promise.resolve(buildConversationDetail())
      } as never,
      chatAgentService: {
        streamChat: async function* () {
          await Promise.resolve();
          yield { type: "meta", trace_id: "trace_chat", conversation_id: "conv_chat" };
          yield { type: "token", delta: "hello" };
          yield { type: "done", trace_id: "trace_chat", memory_write: "scheduled" };
        }
      } as never
    });

    try {
      const page = await server.inject({ method: "GET", url: "/chat-test" });
      const missingUser = await server.inject({
        method: "POST",
        url: "/api/chat",
        payload: { conversation_id: "conv_chat", message: "分析比赛" }
      });
      const missingConversation = await server.inject({
        method: "POST",
        url: "/api/chat",
        headers: {
          "x-user-id": "user_1"
        },
        payload: { message: "分析比赛" }
      });
      const response = await server.inject({
        method: "POST",
        url: "/api/chat",
        headers: {
          "x-user-id": "user_1",
          "x-trace-id": "trace_chat"
        },
        payload: {
          conversation_id: "conv_chat",
          message: "分析比赛"
        }
      });

      expect(page.statusCode).toBe(200);
      expect(page.headers["content-type"]).toContain("text/html");
      expect(String(page.body)).toContain("Odd Agent Chat Test");
      expect(String(page.body)).toContain("我喜欢C罗");
      expect(String(page.body)).toContain("我最喜欢的足球运动员是谁");
      expect(String(page.body)).toContain("1+2");
      expect(missingUser.statusCode).toBe(400);
      expect(missingUser.body).toContain("CHAT_AGENT_USER_REQUIRED");
      expect(missingConversation.statusCode).toBe(400);
      expect(missingConversation.body).toContain("CHAT_AGENT_BAD_REQUEST");
      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/event-stream");
      expect(response.body).toContain("event: meta");
      expect(response.body).toContain("event: token");
      expect(response.body).toContain("hello");
      expect(response.body).toContain("event: done");
    } finally {
      await server.close();
    }
  });

  it("serves conversation create list detail routes through the repository dependency", async () => {
    const calls: string[] = [];
    const server = await buildServer({
      requestTimeoutMs: 1000,
      conversationRepository: {
        createConversation: (input: { readonly userId: string; readonly name: string }) => {
          calls.push(`create:${input.userId}:${input.name}`);
          return Promise.resolve(buildConversation({ conversationId: "conv_created" }));
        },
        listConversations: (input: {
          readonly userId: string;
          readonly query: { readonly page: number; readonly page_size: number };
        }) => {
          calls.push(`list:${input.userId}:${input.query.page}:${input.query.page_size}`);
          return Promise.resolve({
            items: [buildConversation({ conversationId: "conv_created" })],
            total: 1
          });
        },
        listConversationDetails: (input: {
          readonly userId: string;
          readonly query: {
            readonly conversation_id: string;
            readonly page: number;
            readonly page_size: number;
          };
        }) => {
          calls.push(
            `detail:${input.userId}:${input.query.conversation_id}:${input.query.page}:${input.query.page_size}`
          );
          return Promise.resolve({
            items: [
              buildConversationDetail({
                msgId: "msg_user",
                conversationId: input.query.conversation_id,
                direction: 0,
                message: "用户问题"
              })
            ],
            total: 1
          });
        }
      } as never
    });

    try {
      const missingUser = await server.inject({
        method: "POST",
        url: "/api/create/conversation",
        payload: { name: "新会话" }
      });
      const created = await server.inject({
        method: "POST",
        url: "/api/create/conversation",
        headers: { "x-user-id": "user_1" },
        payload: { name: "新会话" }
      });
      const listed = await server.inject({
        method: "GET",
        url: "/api/conversations?page=2&page_size=5",
        headers: { "x-user-id": "user_1" }
      });
      const detail = await server.inject({
        method: "GET",
        url: "/api/conversation/detail?conversation_id=conv_created&page=3&page_size=7",
        headers: { "x-user-id": "user_1" }
      });

      expect(missingUser.statusCode).toBe(400);
      expect(missingUser.json()).toMatchObject({ code: "CHAT_AGENT_USER_REQUIRED" });
      expect(created.statusCode).toBe(200);
      expect(created.json()).toEqual({
        code: 0,
        msg: "",
        data: { conversation_id: "conv_created" }
      });
      expect(listed.statusCode).toBe(200);
      expect(listed.json()).toMatchObject({
        data: {
          page: 2,
          page_size: 5,
          total: 1,
          items: [{ conversation_id: "conv_created", name: "测试会话" }]
        }
      });
      expect(detail.statusCode).toBe(200);
      expect(detail.json()).toMatchObject({
        data: {
          conversation_id: "conv_created",
          page: 3,
          page_size: 7,
          total: 1,
          items: [{ msg_id: "msg_user", direction: 0, message: "用户问题" }]
        }
      });
      expect(calls).toEqual([
        "create:user_1:新会话",
        "list:user_1:2:5",
        "detail:user_1:conv_created:3:7"
      ]);
    } finally {
      await server.close();
    }
  });

  it("persists user input and final agent output around chat SSE", async () => {
    const calls: string[] = [];
    const server = await buildServer({
      requestTimeoutMs: 1000,
      conversationRepository: {
        appendMessage: (input: {
          readonly userId: string;
          readonly conversationId: string;
          readonly direction: 0 | 1;
          readonly message: string;
        }) => {
          calls.push(
            `append:${input.userId}:${input.conversationId}:${input.direction}:${input.message}`
          );
          return Promise.resolve(
            buildConversationDetail({
              conversationId: input.conversationId,
              direction: input.direction,
              message: input.message
            })
          );
        }
      } as never,
      chatAgentService: {
        streamChat: async function* (command: { readonly conversationId: string }) {
          await Promise.resolve();
          yield {
            type: "meta",
            trace_id: "trace_chat",
            conversation_id: command.conversationId
          };
          yield { type: "token", delta: "hello" };
          yield { type: "token", delta: " world" };
          yield { type: "done", trace_id: "trace_chat", memory_write: "scheduled" };
        }
      } as never
    });

    try {
      const response = await server.inject({
        method: "POST",
        url: "/api/chat",
        headers: {
          "x-user-id": "user_1",
          "x-trace-id": "trace_chat"
        },
        payload: {
          conversation_id: "conv_chat",
          message: "分析比赛"
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toContain("hello");
      expect(response.body).toContain("world");
      expect(calls).toEqual([
        "append:user_1:conv_chat:0:分析比赛",
        "append:user_1:conv_chat:1:hello world"
      ]);
    } finally {
      await server.close();
    }
  });

  it("rejects chat when conversation id does not exist", async () => {
    const server = await buildServer({
      requestTimeoutMs: 1000,
      conversationRepository: {
        appendMessage: () =>
          Promise.reject(
            Object.assign(new Error("conversation not found"), {
              code: "CHAT_CONVERSATION_NOT_FOUND"
            })
          )
      } as never,
      chatAgentService: {
        streamChat: async function* () {
          await Promise.resolve();
          yield { type: "token", delta: "should not stream" };
        }
      } as never
    });

    try {
      const response = await server.inject({
        method: "POST",
        url: "/api/chat",
        headers: {
          "x-user-id": "user_1"
        },
        payload: {
          conversation_id: "missing_conv",
          message: "分析比赛"
        }
      });

      expect(response.statusCode).toBe(404);
      expect(response.body).toContain("CHAT_CONVERSATION_NOT_FOUND");
      expect(response.body).not.toContain("should not stream");
    } finally {
      await server.close();
    }
  });

  it("serves internal tag match-text with the shared response envelope", async () => {
    const server = await buildServer({
      requestTimeoutMs: 1000,
      internalServiceToken: SERVICE_TOKEN,
      tagMatchService: {
        matchText: () =>
          Promise.resolve({
            matched: true,
            matched_tags: [
              {
                id: 10,
                category: "player",
                lang_metadata: { en: "Ronaldo" }
              }
            ],
            llm_result: {
              code: 0,
              msg: "player=Ronaldo 匹配成功",
              data: ["Ronaldo"]
            }
          })
      } as never
    });

    try {
      const response = await server.inject({
        method: "POST",
        url: "/internal/tag/match-text",
        headers: {
          ...serviceTokenHeader,
          "x-trace-id": "trace_tag_match"
        },
        payload: {
          text: "Ronaldo scored again.",
          locale: "en",
          rules: {
            operator: "or",
            groups: [{ operator: "or", tag_ids: [10] }]
          }
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        code: 0,
        msg: "",
        data: {
          matched: true,
          matched_tags: [expect.objectContaining({ id: 10 })],
          llm_result: {
            data: ["Ronaldo"]
          }
        }
      });
    } finally {
      await server.close();
    }
  });

  it("serves user tag CRUD routes through the repository dependency", async () => {
    const tag = buildTag(1, "Messi");
    const calls: string[] = [];
    const server = await buildServer({
      requestTimeoutMs: 1000,
      internalServiceToken: SERVICE_TOKEN,
      tagRepository: {
        createMany: (request: unknown) => {
          calls.push(`create:${JSON.stringify(request)}`);
          return Promise.resolve({ items: [tag], failed: [] });
        },
        list: () => Promise.resolve({ items: [tag], total: 1 }),
        replaceUserTags: (userId: string) => {
          calls.push(`replace:${userId}`);
          return Promise.resolve();
        },
        listUserTags: () => Promise.resolve([{ ...tag, desc: "favorite" }])
      } as never
    });

    try {
      const created = await server.inject({
        method: "POST",
        url: "/internal/tag/tags/batch-create",
        headers: serviceTokenHeader,
        payload: {
          items: [{ category: "player", lang_metadata: { en: "Messi" }, sort_order: 0 }]
        }
      });
      const listed = await server.inject({
        method: "GET",
        url: "/internal/tag/tags",
        headers: serviceTokenHeader
      });
      const replaced = await server.inject({
        method: "PUT",
        url: "/internal/tag/users/user_1/tags",
        headers: serviceTokenHeader,
        payload: { tag_ids: [1], desc: "favorite" }
      });

      expect(created.statusCode).toBe(200);
      const createdBody: {
        readonly data: {
          readonly items: readonly unknown[];
        };
      } = created.json();
      expect(createdBody.data.items[0]).toMatchObject({ id: 1, lang_metadata: { en: "Messi" } });
      expect(listed.statusCode).toBe(200);
      expect(listed.json()).toMatchObject({ data: { total: 1 } });
      expect(replaced.statusCode).toBe(200);
      expect(replaced.json()).toMatchObject({ data: { user_id: "user_1" } });
      expect(calls).toEqual(
        expect.arrayContaining([expect.stringContaining("create:"), "replace:user_1"])
      );
    } finally {
      await server.close();
    }
  });

  it("serves matched tweet history from x-user-id and deduplicated tweet rows", async () => {
    const calls: { readonly userId: string; readonly page: number; readonly pageSize: number }[] =
      [];
    const server = await buildServer({
      requestTimeoutMs: 1000,
      internalServiceToken: SERVICE_TOKEN,
      tagRepository: {
        listUserMatchedTweets: (
          userId: string,
          query: { readonly page: number; readonly pageSize: number }
        ) => {
          calls.push({ userId, page: query.page, pageSize: query.pageSize });
          return Promise.resolve({
            items: [
              {
                tweetId: "tweet_1",
                tweetPayload: { id: "tweet_1", text: "England won." },
                matchedTags: [
                  {
                    id: 33,
                    category: "country",
                    langMetadata: { en: "England" }
                  },
                  {
                    id: 44,
                    category: "player",
                    langMetadata: { en: "Kane" }
                  }
                ],
                llmResult: { code: 0, msg: "matched", data: ["England", "Kane"] },
                matchedAt: "2026-05-20T00:00:00.000Z",
                pushedAt: "2026-05-20T00:00:01.000Z"
              }
            ],
            total: 1
          });
        }
      } as never
    });

    try {
      const missingHeader = await server.inject({
        method: "GET",
        url: "/internal/tag/matched-tweets",
        headers: serviceTokenHeader
      });
      const response = await server.inject({
        method: "GET",
        url: "/internal/tag/matched-tweets?page=2&pageSize=3",
        headers: {
          ...serviceTokenHeader,
          "x-user-id": "user_1"
        }
      });

      expect(missingHeader.statusCode).toBe(400);
      expect(missingHeader.json()).toMatchObject({
        code: 40001,
        msg: "x-user-id header is required"
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        code: 0,
        data: {
          page: 2,
          pageSize: 3,
          total: 1,
          items: [
            {
              tweet_id: "tweet_1",
              matched_tags: [
                { id: 33, lang_metadata: { en: "England" } },
                { id: 44, lang_metadata: { en: "Kane" } }
              ]
            }
          ]
        }
      });
      expect(calls).toEqual([{ userId: "user_1", page: 2, pageSize: 3 }]);
    } finally {
      await server.close();
    }
  });

  it("serves internal memory list with simplified fields and cursor pagination", async () => {
    // 构造 3 条乱序 memory，验证 createdAt 倒序、5 字段精简和 cursor 续页语义。
    const buildMemory = (id: string, createdAt: string) => ({
      id,
      userId: "user_1",
      type: "preference",
      semanticKey: `preference.${id}`,
      text: `memory ${id}`,
      confidence: 0.9,
      importance: 3,
      conversationId: "conv_1",
      sourceMessageId: `msg_${id}`,
      validFrom: createdAt,
      createdAt,
      updatedAt: createdAt,
      metadata: {}
    });
    const calls: {
      readonly userId: string;
      readonly pageSize?: number;
      readonly orderBy?: string;
    }[] = [];
    const server = await buildServer({
      requestTimeoutMs: 1000,
      internalServiceToken: SERVICE_TOKEN,
      memoryMaxPageSize: 100,
      memoryComponent: {
        list: (command: {
          readonly userId: string;
          readonly pageSize?: number;
          readonly orderBy?: string;
        }) => {
          calls.push({
            userId: command.userId,
            ...(command.pageSize === undefined ? {} : { pageSize: command.pageSize }),
            ...(command.orderBy === undefined ? {} : { orderBy: command.orderBy })
          });
          return Promise.resolve([
            buildMemory("m1", "2026-06-01T00:00:00.000Z"),
            buildMemory("m3", "2026-06-03T00:00:00.000Z"),
            buildMemory("m2", "2026-06-02T00:00:00.000Z")
          ]);
        }
      } as never
    });
    try {
      const firstPage = await server.inject({
        method: "GET",
        url: "/internal/memory/list?limit=2",
        headers: { ...serviceTokenHeader, "x-user-id": "user_1" }
      });
      const secondPage = await server.inject({
        method: "GET",
        url: `/internal/memory/list?limit=2&cursor=${encodeURIComponent("2026-06-02T00:00:00.000Z|m2")}`,
        headers: { ...serviceTokenHeader, "x-user-id": "user_1" }
      });
      const missingUser = await server.inject({
        method: "GET",
        url: "/internal/memory/list",
        headers: serviceTokenHeader
      });
      const overLimit = await server.inject({
        method: "GET",
        url: "/internal/memory/list?limit=101",
        headers: { ...serviceTokenHeader, "x-user-id": "user_1" }
      });

      expect(firstPage.statusCode).toBe(200);
      expect(firstPage.json()).toEqual({
        items: [
          {
            id: "m3",
            text: "memory m3",
            type: "preference",
            importance: 3,
            createdAt: "2026-06-03T00:00:00.000Z"
          },
          {
            id: "m2",
            text: "memory m2",
            type: "preference",
            importance: 3,
            createdAt: "2026-06-02T00:00:00.000Z"
          }
        ],
        nextCursor: "2026-06-02T00:00:00.000Z|m2"
      });
      // cursor 续页只剩 m1，且尾页 nextCursor 必须是 null。
      expect(secondPage.statusCode).toBe(200);
      expect(secondPage.json()).toMatchObject({
        items: [{ id: "m1" }],
        nextCursor: null
      });
      expect(missingUser.statusCode).toBe(400);
      expect(missingUser.json()).toEqual({ error: "x_user_id_required" });
      expect(overLimit.statusCode).toBe(400);
      // wrapper 必须以 createdAt 截断窗口请求 SDK，避免与对外分页排序键错配。
      expect(calls).toEqual([
        { userId: "user_1", pageSize: 100, orderBy: "createdAt" },
        { userId: "user_1", pageSize: 100, orderBy: "createdAt" }
      ]);
    } finally {
      await server.close();
    }
  });

  it("pages through same-createdAt memories without losing or repeating records", async () => {
    // 同一毫秒写入 4 条记忆是 Memory 批量提取的常态；复合游标 (createdAt, id) 必须不丢不重。
    const buildMemory = (id: string, createdAt: string) => ({
      id,
      userId: "user_1",
      type: "preference",
      semanticKey: `preference.${id}`,
      text: `memory ${id}`,
      confidence: 0.9,
      importance: 3,
      conversationId: "conv_1",
      sourceMessageId: `msg_${id}`,
      validFrom: createdAt,
      createdAt,
      updatedAt: createdAt,
      metadata: {}
    });
    const sameInstant = "2026-06-04T00:00:00.000Z";
    const server = await buildServer({
      requestTimeoutMs: 1000,
      internalServiceToken: SERVICE_TOKEN,
      memoryComponent: {
        list: () =>
          Promise.resolve([
            buildMemory("a1", sameInstant),
            buildMemory("a2", sameInstant),
            buildMemory("a3", sameInstant),
            buildMemory("a4", sameInstant)
          ])
      } as never
    });
    try {
      // 逐页消费直到 nextCursor=null，收集到的 id 必须恰好是全部 4 条、无重复。
      const seen: string[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < 5 && (page === 0 || cursor !== null); page += 1) {
        const url =
          cursor === null
            ? "/internal/memory/list?limit=3"
            : `/internal/memory/list?limit=3&cursor=${encodeURIComponent(cursor)}`;
        const response = await server.inject({
          method: "GET",
          url,
          headers: { ...serviceTokenHeader, "x-user-id": "user_1" }
        });
        expect(response.statusCode).toBe(200);
        const body = memoryListResponseSchema.parse(response.json());
        seen.push(...body.items.map((item) => item.id));
        cursor = body.nextCursor;
      }
      expect(cursor).toBeNull();
      expect([...seen].sort()).toEqual(["a1", "a2", "a3", "a4"]);
      expect(new Set(seen).size).toBe(4);
    } finally {
      await server.close();
    }
  });

  it("returns 500 when memory list fails downstream", async () => {
    const server = await buildServer({
      requestTimeoutMs: 1000,
      internalServiceToken: SERVICE_TOKEN,
      memoryComponent: {
        list: () => Promise.reject(new Error("pinecone unavailable"))
      }
    });
    try {
      const response = await server.inject({
        method: "GET",
        url: "/internal/memory/list",
        headers: { ...serviceTokenHeader, "x-user-id": "user_1" }
      });
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ error: "memory_list_failed" });
    } finally {
      await server.close();
    }
  });

  it("returns 503 for internal memory list when memory is not configured", async () => {
    const server = await buildServer({
      requestTimeoutMs: 1000,
      internalServiceToken: SERVICE_TOKEN
    });
    try {
      const response = await server.inject({
        method: "GET",
        url: "/internal/memory/list",
        headers: { ...serviceTokenHeader, "x-user-id": "user_1" }
      });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual({ error: "memory_unavailable" });
    } finally {
      await server.close();
    }
  });

  it("guards /internal/* with x-service-token in three states", async () => {
    const server = await buildServer({
      requestTimeoutMs: 1000,
      internalServiceToken: SERVICE_TOKEN,
      tagRepository: {
        list: () => Promise.resolve({ items: [], total: 0 })
      } as never
    });
    try {
      // 三态之一：缺 token 与错误 token 都必须 401，且响应 shape 是跨团队约定的 { error }。
      const missing = await server.inject({ method: "GET", url: "/internal/tag/tags" });
      const wrong = await server.inject({
        method: "GET",
        url: "/internal/tag/tags",
        headers: { "x-service-token": "wrong_token" }
      });
      // 三态之二：正确 token 走现有行为。
      const ok = await server.inject({
        method: "GET",
        url: "/internal/tag/tags",
        headers: serviceTokenHeader
      });
      // /api/* 与 /health 不受 middleware 影响。
      const health = await server.inject({ method: "GET", url: "/health" });

      expect(missing.statusCode).toBe(401);
      expect(missing.json()).toEqual({ error: "invalid_service_token" });
      expect(wrong.statusCode).toBe(401);
      expect(wrong.json()).toEqual({ error: "invalid_service_token" });
      expect(ok.statusCode).toBe(200);
      expect(health.statusCode).toBe(200);
    } finally {
      await server.close();
    }
  });

  it("lets CORS preflight pass /internal/* without service token", async () => {
    // 浏览器预检不携带自定义 header；OPTIONS 必须落到统一 204 handler 而不是被 401 拦截。
    const server = await buildServer({
      requestTimeoutMs: 1000,
      internalServiceToken: SERVICE_TOKEN
    });
    try {
      const preflight = await server.inject({
        method: "OPTIONS",
        url: "/internal/memory/list",
        headers: {
          origin: "https://oddfi.io",
          "access-control-request-method": "GET",
          "access-control-request-headers": "x-user-id"
        }
      });
      expect(preflight.statusCode).toBe(204);
    } finally {
      await server.close();
    }
  });

  it("returns 500 on /internal/* when service token is not configured", async () => {
    // 三态之三：token 未配置属于部署错误，请求期兜底返回 500 而非放行。
    const server = await buildServer({ requestTimeoutMs: 1000 });
    try {
      const response = await server.inject({
        method: "GET",
        url: "/internal/tag/tags",
        headers: serviceTokenHeader
      });
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ error: "service_token_misconfigured" });
    } finally {
      await server.close();
    }
  });
});
