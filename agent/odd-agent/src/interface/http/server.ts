import { timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sensible from "@fastify/sensible";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { ZodError } from "zod";
import type { ChatAgentService } from "../../application/chat/chat-agent-service.js";
import type { TagMatchService } from "../../application/tags/tag-match-service.js";
import { silentLogger, type Logger } from "../../foundation/logger/logger-component.js";
import {
  chatApiResponseSchema,
  chatRequestSchema,
  conversationDetailDataSchema,
  conversationDetailQuerySchema,
  conversationListDataSchema,
  createConversationDataSchema,
  createConversationRequestSchema,
  listConversationsQuerySchema,
  type ChatSseEvent
} from "../../models/http/chat-dto-model.js";
import type {
  ConversationDetailRecord,
  ConversationRecord,
  TagRecord
} from "../../models/db/persistence-model.js";
import type { Memory, MemoryComponent } from "../../foundation/memory/index.js";
import {
  memoryListQuerySchema,
  memoryListResponseSchema
} from "../../models/http/memory-dto-model.js";
import type { PostgresConversationRepository } from "../../infrastructure/chat/postgres-conversation-repository.js";
import type {
  PostgresTagRepository,
  UserMatchedTweetView
} from "../../infrastructure/tags/postgres-tag-repository.js";
import {
  batchCreateTagsRequestSchema,
  batchDeleteTagsRequestSchema,
  batchTagDataSchema,
  batchUpdateTagsRequestSchema,
  internalTagResponseSchema,
  listTagsQuerySchema,
  matchTextDataSchema,
  matchTextRequestSchema,
  tagListDataSchema,
  userIdParamsSchema,
  userMatchedTweetsDataSchema,
  userMatchedTweetsQuerySchema,
  userTagsDataSchema,
  userTagsQuerySchema,
  userTagsRequestSchema
} from "../../models/http/user-tag-dto-model.js";

export type BuildServerOptions = {
  readonly requestTimeoutMs: number;
  readonly logger?: Logger;
  readonly chatAgentService?: ChatAgentService;
  readonly conversationRepository?: PostgresConversationRepository;
  readonly chatTestPagePath?: string;
  readonly tagRepository?: PostgresTagRepository;
  readonly tagMatchService?: TagMatchService;
  readonly internalServiceToken?: string;
  readonly memoryComponent?: Pick<MemoryComponent, "list">;
  readonly memoryMaxPageSize?: number;
};

/**
 * 调用流程：创建精简后的 HTTP 服务，只暴露健康检查与用户标签内部接口。
 * 入参：request timeout、logger、用户标签 repository 和 tag match service。
 * 出参：尚未 listen 的 Fastify 实例；启动与关闭由组合根 `initApp()` 管理。
 */
export const buildServer = async (options: BuildServerOptions): Promise<FastifyInstance> => {
  const server = Fastify({
    logger: false,
    requestTimeout: options.requestTimeoutMs
  });
  const logger = options.logger ?? silentLogger;
  await server.register(sensible);

  server.addHook("onRequest", async (_request, reply) => {
    reply.header("access-control-allow-origin", "*");
    reply.header("access-control-allow-headers", "authorization,content-type,x-user-id,x-trace-id");
    reply.header("access-control-allow-methods", "GET,POST,OPTIONS");
  });

  server.options("/*", (_request, reply) => reply.status(204).send());

  // /internal/* 是主后端服务间专用入口；onRequest 阶段统一校验 X-Service-Token，
  // 静态对比即可（跨团队约定不做 HMAC 时间戳），/api/* 与 /health 不受影响。
  server.addHook("onRequest", async (request, reply) => {
    // 非 internal 前缀直接放行，保证既有公开路由行为完全不变；裸 /internal 一并防御。
    if (!request.url.startsWith("/internal/") && request.url !== "/internal") {
      return;
    }
    // CORS 预检按规范不携带自定义 header，放行让它落到统一 OPTIONS 204 handler；
    // OPTIONS 没有任何业务 handler，不会绕过鉴权触达 internal 数据。
    if (request.method === "OPTIONS") {
      return;
    }
    // token 未配置属于部署错误而非调用方错误：返回 500 并打日志，组合根启动时也会 fail-fast 兜底。
    if (options.internalServiceToken === undefined) {
      logger.error("internal_auth.service_token_misconfigured", {
        ...logRequest(request),
        bounded_context: "internal_auth"
      });
      return reply.status(500).send({ error: "service_token_misconfigured" });
    }
    // header 缺失或不等于期望值一律 401；不区分两种情况，避免给探测方泄露配置状态。
    const token = readHeaderValue(request, "x-service-token");
    if (token === undefined || !timingSafeStringEqual(token, options.internalServiceToken)) {
      logger.warn("internal_auth.invalid_service_token", {
        ...logRequest(request),
        bounded_context: "internal_auth"
      });
      return reply.status(401).send({ error: "invalid_service_token" });
    }
    return;
  });

  server.get("/health", () => ({
    status: "ok",
    service: "odd-agent",
    features: ["foundation", "memory", "chat_agent", "user_tag"]
  }));

  server.get("/chat-test", async (_request, reply) => {
    const html = await readFile(
      resolve(options.chatTestPagePath ?? "test/chat-agent/chat-test.html"),
      "utf8"
    );
    return reply.type("text/html; charset=utf-8").send(html);
  });

  // Chat SSE 主入口：先保存用户输入，再流式返回 Agent 输出并落最终消息。
  server.post("/api/chat", async (request, reply) => {
    logger.debug("http.request_received", {
      ...logRequest(request),
      bounded_context: "chat_agent_http"
    });
    if (options.chatAgentService === undefined) {
      return sendChatSseError(reply, 503, "CHAT_AGENT_UNAVAILABLE", "chat agent is not configured");
    }
    if (options.conversationRepository === undefined) {
      return sendChatSseError(
        reply,
        503,
        "CHAT_CONVERSATION_UNAVAILABLE",
        "conversation repository is not configured"
      );
    }
    const userId = readHeaderValue(request, "x-user-id")?.trim();
    if (userId === undefined || userId.length === 0) {
      return sendChatSseError(
        reply,
        400,
        "CHAT_AGENT_USER_REQUIRED",
        "x-user-id header is required"
      );
    }
    const body = parsePublicRequest(chatRequestSchema, request.body);
    if (!body.ok) {
      return sendChatSseError(reply, 400, "CHAT_AGENT_BAD_REQUEST", body.message);
    }

    // 会话 ID 必须由客户端传入且已存在，确保 DB、SSE meta 和 Memory provenance 使用同一个值。
    const traceId = readHeaderValue(request, "x-trace-id");
    const conversationId = body.value.conversation_id;
    try {
      // 用户消息在 LLM stream 前写入；如果会话跨用户或写库失败，本次 SSE 不进入正常流。
      await options.conversationRepository.appendMessage({
        userId,
        conversationId,
        direction: 0,
        message: body.value.message,
        ...(traceId === undefined ? {} : { traceId })
      });
    } catch (error) {
      return sendChatSseError(
        reply,
        readErrorCode(error) === "CHAT_CONVERSATION_NOT_FOUND" ? 404 : 500,
        readErrorCode(error) ?? "CHAT_CONVERSATION_WRITE_FAILED",
        normalizeInternalErrorMessage(error)
      );
    }

    // SSE header 在历史写入成功后再发送，避免持久化失败却已经返回 200。
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no"
    });
    try {
      let finalAgentMessage = "";
      for await (const event of options.chatAgentService.streamChat({
        userId,
        message: body.value.message,
        conversationId,
        ...(traceId === undefined ? {} : { traceId })
      })) {
        // token 事件一边透传给前端，一边拼接成最终可见回答，供 done 前写入明细表。
        if (event.type === "token") {
          finalAgentMessage += event.delta;
          reply.raw.write(formatSseEvent(event));
          continue;
        }
        // done 事件前写入 Agent 最终消息，保证客户端看到 done 时本轮历史已经可查询。
        if (event.type === "done") {
          await options.conversationRepository.appendMessage({
            userId,
            conversationId,
            direction: 1,
            message: finalAgentMessage,
            ...(traceId === undefined ? {} : { traceId })
          });
          reply.raw.write(formatSseEvent(event));
          continue;
        }
        reply.raw.write(formatSseEvent(event));
      }
    } catch (error) {
      reply.raw.write(
        formatSseEvent({
          type: "error",
          code: readErrorCode(error) ?? "CHAT_AGENT_STREAM_FAILED",
          message: normalizeInternalErrorMessage(error)
        })
      );
    } finally {
      reply.raw.end();
    }
    return reply;
  });

  // 创建会话接口：只接受可信 header 中的用户身份，body 只承载用户可见会话名。
  server.post("/api/create/conversation", async (request, reply) => {
    logger.debug("http.request_received", {
      ...logRequest(request),
      bounded_context: "chat_agent_http"
    });
    const conversationRepository = requireConversationRepository(options, reply);
    if (conversationRepository === undefined) {
      return reply;
    }
    const userId = readHeaderValue(request, "x-user-id")?.trim();
    if (userId === undefined || userId.length === 0) {
      return sendChatJsonError(
        reply,
        400,
        "CHAT_AGENT_USER_REQUIRED",
        "x-user-id header is required"
      );
    }
    const body = parsePublicRequest(createConversationRequestSchema, request.body);
    if (!body.ok) {
      return sendChatJsonError(reply, 400, "CHAT_AGENT_BAD_REQUEST", body.message);
    }
    // traceId 只用于 SQL 日志串联；会话 ID 由仓储生成，避免客户端伪造新建 ID。
    const traceId = readHeaderValue(request, "x-trace-id");
    const conversation = await conversationRepository.createConversation({
      userId,
      name: body.value.name,
      ...(traceId === undefined ? {} : { traceId })
    });
    return reply.send(
      chatApiResponseSchema(createConversationDataSchema).parse({
        code: 0,
        msg: "",
        data: { conversation_id: conversation.conversationId }
      })
    );
  });

  // 会话列表接口：按 x-user-id 隔离分页读取，不接受 query/body 中的用户身份。
  server.get("/api/conversations", async (request, reply) => {
    logger.debug("http.request_received", {
      ...logRequest(request),
      bounded_context: "chat_agent_http"
    });
    const conversationRepository = requireConversationRepository(options, reply);
    if (conversationRepository === undefined) {
      return reply;
    }
    const userId = readHeaderValue(request, "x-user-id")?.trim();
    if (userId === undefined || userId.length === 0) {
      return sendChatJsonError(
        reply,
        400,
        "CHAT_AGENT_USER_REQUIRED",
        "x-user-id header is required"
      );
    }
    const query = parsePublicRequest(listConversationsQuerySchema, request.query);
    if (!query.ok) {
      return sendChatJsonError(reply, 400, "CHAT_AGENT_BAD_REQUEST", query.message);
    }
    // 分页参数已经由 zod 归一为 number，仓储只接收强类型 query。
    const traceId = readHeaderValue(request, "x-trace-id");
    const result = await conversationRepository.listConversations({
      userId,
      query: query.value,
      ...(traceId === undefined ? {} : { traceId })
    });
    return reply.send(
      chatApiResponseSchema(conversationListDataSchema).parse({
        code: 0,
        msg: "",
        data: {
          items: result.items.map(toConversationDto),
          page: query.value.page,
          page_size: query.value.page_size,
          total: result.total
        }
      })
    );
  });

  // 会话详情接口：先由仓储校验会话归属，再返回当前用户可见的消息明细。
  server.get("/api/conversation/detail", async (request, reply) => {
    logger.debug("http.request_received", {
      ...logRequest(request),
      bounded_context: "chat_agent_http"
    });
    const conversationRepository = requireConversationRepository(options, reply);
    if (conversationRepository === undefined) {
      return reply;
    }
    const userId = readHeaderValue(request, "x-user-id")?.trim();
    if (userId === undefined || userId.length === 0) {
      return sendChatJsonError(
        reply,
        400,
        "CHAT_AGENT_USER_REQUIRED",
        "x-user-id header is required"
      );
    }
    const query = parsePublicRequest(conversationDetailQuerySchema, request.query);
    if (!query.ok) {
      return sendChatJsonError(reply, 400, "CHAT_AGENT_BAD_REQUEST", query.message);
    }
    try {
      // 查询失败时只返回稳定错误码，不泄露数据库或跨用户存在性细节。
      const traceId = readHeaderValue(request, "x-trace-id");
      const result = await conversationRepository.listConversationDetails({
        userId,
        query: query.value,
        ...(traceId === undefined ? {} : { traceId })
      });
      return reply.send(
        chatApiResponseSchema(conversationDetailDataSchema).parse({
          code: 0,
          msg: "",
          data: {
            conversation_id: query.value.conversation_id,
            items: result.items.map(toConversationDetailDto),
            page: query.value.page,
            page_size: query.value.page_size,
            total: result.total
          }
        })
      );
    } catch (error) {
      return sendChatJsonError(
        reply,
        readErrorCode(error) === "CHAT_CONVERSATION_NOT_FOUND" ? 404 : 500,
        readErrorCode(error) ?? "CHAT_CONVERSATION_DETAIL_FAILED",
        normalizeInternalErrorMessage(error)
      );
    }
  });

  // Memory 列表 internal wrapper：主后端代理前端记忆 UI 的只读查询；输出跨团队约定的
  // 简化 5 字段 + createdAt 倒序 cursor 分页，鉴权由 /internal/* middleware 统一完成。
  server.get("/internal/memory/list", async (request, reply) => {
    logger.debug("http.request_received", {
      ...logRequest(request),
      bounded_context: "memory_http"
    });
    if (options.memoryComponent === undefined) {
      return reply.status(503).send({ error: "memory_unavailable" });
    }
    // x-user-id 是 Memory 的隔离键；与其他 internal 接口一致只信可信上游 header。
    const userId = readHeaderValue(request, "x-user-id")?.trim();
    if (userId === undefined || userId.length === 0) {
      return reply.status(400).send({ error: "x_user_id_required" });
    }
    const query = parsePublicRequest(memoryListQuerySchema, request.query);
    if (!query.ok) {
      return reply.status(400).send({ error: "invalid_query", message: query.message });
    }
    try {
      // Memory SDK 是 page/pageSize 语义；wrapper 一次取 maxPageSize 条（orderBy=createdAt
      // 保证截断窗口与对外分页排序键一致）后在本层做 cursor 过滤。
      // 单用户活跃记忆超过 maxPageSize 时深分页会截断（已留档）。
      const traceId = readHeaderValue(request, "x-trace-id");
      const memories = await options.memoryComponent.list({
        userId,
        page: 1,
        pageSize: options.memoryMaxPageSize ?? 100,
        orderBy: "createdAt",
        ...(traceId === undefined ? {} : { traceId })
      });
      // 排序与 cursor 比较使用 (createdAt, id) 复合全序：同一毫秒多条记录时仍能稳定续页，
      // 不丢也不重复；cursor 对调用方是不透明字符串，格式 `${createdAt}|${id}`，
      // 兼容旧的纯 createdAt cursor（无 "|" 时按 createdAt 严格小于过滤）。
      const sorted = [...memories].sort(
        (left, right) => compareMemoryCursorKey(right, left) // 倒序：新的在前
      );
      const cursor = parseMemoryCursor(query.value.cursor);
      const filtered =
        cursor === undefined
          ? sorted
          : sorted.filter((memory) => compareMemoryCursorKey(memory, cursor) < 0);
      const pageItems = filtered.slice(0, query.value.limit);
      // 过滤后仍有剩余才给 nextCursor，避免客户端对空尾页做多余请求。
      const lastItem = pageItems.at(-1);
      const nextCursor =
        filtered.length > pageItems.length && lastItem !== undefined
          ? `${lastItem.createdAt}|${lastItem.id}`
          : null;
      return reply.send(
        memoryListResponseSchema.parse({
          items: pageItems.map(toMemoryListItemDto),
          nextCursor
        })
      );
    } catch (error) {
      logger.error("memory_http.list_failed", {
        ...logRequest(request),
        bounded_context: "memory_http",
        error: { message: normalizeInternalErrorMessage(error) }
      });
      return reply.status(500).send({ error: "memory_list_failed" });
    }
  });

  // Tag 目录管理接口保持批处理语义：合法项先落库，单条失败进入 failed 数组。
  server.post("/internal/tag/tags/batch-create", async (request, reply) => {
    logger.debug("http.request_received", logRequest(request));
    const tagRepository = requireTagRepository(options, reply);
    if (tagRepository === undefined) {
      return reply;
    }
    const body = parsePublicRequest(batchCreateTagsRequestSchema, request.body);
    if (!body.ok) {
      return sendInternalTagError(reply, 400, 40001, body.message);
    }
    const result = await tagRepository.createMany(body.value);
    return reply.send(
      internalTagResponseSchema(batchTagDataSchema).parse({
        code: result.failed.length === 0 ? 0 : 40009,
        msg: result.failed.length === 0 ? "" : "partial batch failure",
        data: toBatchTagData(result)
      })
    );
  });

  server.patch("/internal/tag/tags/batch-update", async (request, reply) => {
    logger.debug("http.request_received", logRequest(request));
    const tagRepository = requireTagRepository(options, reply);
    if (tagRepository === undefined) {
      return reply;
    }
    const body = parsePublicRequest(batchUpdateTagsRequestSchema, request.body);
    if (!body.ok) {
      return sendInternalTagError(reply, 400, 40001, body.message);
    }
    const result = await tagRepository.updateMany(body.value);
    return reply.send(
      internalTagResponseSchema(batchTagDataSchema).parse({
        code: result.failed.length === 0 ? 0 : 40009,
        msg: result.failed.length === 0 ? "" : "partial batch failure",
        data: toBatchTagData(result)
      })
    );
  });

  server.post("/internal/tag/tags/batch-delete", async (request, reply) => {
    logger.debug("http.request_received", logRequest(request));
    const tagRepository = requireTagRepository(options, reply);
    if (tagRepository === undefined) {
      return reply;
    }
    const body = parsePublicRequest(batchDeleteTagsRequestSchema, request.body);
    if (!body.ok) {
      return sendInternalTagError(reply, 400, 40001, body.message);
    }
    const result = await tagRepository.deleteMany(body.value.ids);
    return reply.send(
      internalTagResponseSchema(batchTagDataSchema).parse({
        code: result.failed.length === 0 ? 0 : 40009,
        msg: result.failed.length === 0 ? "" : "partial batch failure",
        data: toBatchTagData(result)
      })
    );
  });

  server.get("/internal/tag/tags", async (request, reply) => {
    logger.debug("http.request_received", logRequest(request));
    const tagRepository = requireTagRepository(options, reply);
    if (tagRepository === undefined) {
      return reply;
    }
    const query = parsePublicRequest(listTagsQuerySchema, request.query);
    if (!query.ok) {
      return sendInternalTagError(reply, 400, 40001, query.message);
    }
    const result = await tagRepository.list(query.value);
    return reply.send(
      internalTagResponseSchema(tagListDataSchema).parse({
        code: 0,
        msg: "",
        data: {
          items: result.items.map(toTagDto),
          page: query.value.page,
          page_size: query.value.page_size,
          total: result.total
        }
      })
    );
  });

  server.put<{ Params: { userId: string } }>(
    "/internal/tag/users/:userId/tags",
    async (request, reply) => {
      logger.debug("http.request_received", logRequest(request));
      const tagRepository = requireTagRepository(options, reply);
      if (tagRepository === undefined) {
        return reply;
      }
      const params = parsePublicRequest(userIdParamsSchema, request.params);
      const body = parsePublicRequest(userTagsRequestSchema, request.body);
      if (!params.ok) {
        return sendInternalTagError(reply, 400, 40001, params.message);
      }
      if (!body.ok) {
        return sendInternalTagError(reply, 400, 40001, body.message);
      }
      try {
        await tagRepository.replaceUserTags(
          params.value.userId,
          body.value.tag_ids,
          body.value.desc
        );
      } catch (error) {
        return sendInternalTagError(reply, 400, 40004, normalizeInternalErrorMessage(error));
      }
      return reply.send(
        internalTagResponseSchema(userTagsDataSchema).parse(
          await buildUserTagsResponse(tagRepository, params.value.userId)
        )
      );
    }
  );

  server.get<{ Params: { userId: string } }>(
    "/internal/tag/users/:userId/tags",
    async (request, reply) => {
      logger.debug("http.request_received", logRequest(request));
      const tagRepository = requireTagRepository(options, reply);
      if (tagRepository === undefined) {
        return reply;
      }
      const params = parsePublicRequest(userIdParamsSchema, request.params);
      const query = parsePublicRequest(userTagsQuerySchema, request.query);
      if (!params.ok) {
        return sendInternalTagError(reply, 400, 40001, params.message);
      }
      if (!query.ok) {
        return sendInternalTagError(reply, 400, 40001, query.message);
      }
      return reply.send(
        internalTagResponseSchema(userTagsDataSchema).parse(
          await buildUserTagsResponse(
            tagRepository,
            params.value.userId,
            query.value.include_deleted
          )
        )
      );
    }
  );

  server.post<{ Params: { userId: string } }>(
    "/internal/tag/users/:userId/tags",
    async (request, reply) => {
      logger.debug("http.request_received", logRequest(request));
      const tagRepository = requireTagRepository(options, reply);
      if (tagRepository === undefined) {
        return reply;
      }
      const params = parsePublicRequest(userIdParamsSchema, request.params);
      const body = parsePublicRequest(userTagsRequestSchema, request.body);
      if (!params.ok) {
        return sendInternalTagError(reply, 400, 40001, params.message);
      }
      if (!body.ok) {
        return sendInternalTagError(reply, 400, 40001, body.message);
      }
      try {
        await tagRepository.addUserTags(params.value.userId, body.value.tag_ids, body.value.desc);
      } catch (error) {
        return sendInternalTagError(reply, 400, 40004, normalizeInternalErrorMessage(error));
      }
      return reply.send(
        internalTagResponseSchema(userTagsDataSchema).parse(
          await buildUserTagsResponse(tagRepository, params.value.userId)
        )
      );
    }
  );

  server.delete<{ Params: { userId: string } }>(
    "/internal/tag/users/:userId/tags",
    async (request, reply) => {
      logger.debug("http.request_received", logRequest(request));
      const tagRepository = requireTagRepository(options, reply);
      if (tagRepository === undefined) {
        return reply;
      }
      const params = parsePublicRequest(userIdParamsSchema, request.params);
      const body = parsePublicRequest(userTagsRequestSchema, request.body);
      if (!params.ok) {
        return sendInternalTagError(reply, 400, 40001, params.message);
      }
      if (!body.ok) {
        return sendInternalTagError(reply, 400, 40001, body.message);
      }
      await tagRepository.deleteUserTags(params.value.userId, body.value.tag_ids);
      return reply.send(
        internalTagResponseSchema(userTagsDataSchema).parse(
          await buildUserTagsResponse(tagRepository, params.value.userId)
        )
      );
    }
  );

  server.get("/internal/tag/matched-tweets", async (request, reply) => {
    logger.debug("http.request_received", logRequest(request));
    const tagRepository = requireTagRepository(options, reply);
    if (tagRepository === undefined) {
      return reply;
    }
    const userId = readHeaderValue(request, "x-user-id")?.trim();
    if (userId === undefined || userId.length === 0) {
      return sendInternalTagError(reply, 400, 40001, "x-user-id header is required");
    }
    const query = parsePublicRequest(userMatchedTweetsQuerySchema, request.query);
    if (!query.ok) {
      return sendInternalTagError(reply, 400, 40001, query.message);
    }
    const result = await tagRepository.listUserMatchedTweets(userId, query.value);
    return reply.send(
      internalTagResponseSchema(userMatchedTweetsDataSchema).parse({
        code: 0,
        msg: "",
        data: {
          items: result.items.map(toUserMatchedTweetDto),
          page: query.value.page,
          pageSize: query.value.pageSize,
          total: result.total
        }
      })
    );
  });

  // match-text 是用户标签语义判断入口；HTTP 层只校验 DTO 和映射错误，LLM 协议在 application 层完成。
  server.post("/internal/tag/match-text", async (request, reply) => {
    logger.debug("http.request_received", logRequest(request));
    if (options.tagMatchService === undefined) {
      return sendInternalTagError(reply, 503, 50000, "tag match service is not configured");
    }
    const body = parsePublicRequest(matchTextRequestSchema, request.body);
    if (!body.ok) {
      return sendInternalTagError(reply, 400, 40001, body.message);
    }
    try {
      const traceId = readHeaderValue(request, "x-trace-id");
      const data = await options.tagMatchService.matchText({
        ...body.value,
        ...(traceId === undefined ? {} : { traceId })
      });
      return reply.send(
        internalTagResponseSchema(matchTextDataSchema).parse({
          code: 0,
          msg: "",
          data
        })
      );
    } catch (error) {
      const errorCode = readErrorCode(error);
      const statusCode =
        errorCode === "TAG_LLM_STRUCTURED_OUTPUT_INVALID" || errorCode === "LLM_REQUEST_FAILED"
          ? 500
          : 400;
      const code =
        errorCode === "TAG_LLM_STRUCTURED_OUTPUT_INVALID"
          ? 50011
          : errorCode === "LLM_REQUEST_FAILED"
            ? 50010
            : 40004;
      return sendInternalTagError(reply, statusCode, code, normalizeInternalErrorMessage(error));
    }
  });

  return server;
};

type PublicParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: string };

const parsePublicRequest = <T>(
  schema: { parse(input: unknown): T },
  input: unknown
): PublicParseResult<T> => {
  try {
    return { ok: true, value: schema.parse(input) };
  } catch (error) {
    if (error instanceof ZodError) {
      return { ok: false, message: error.issues.map((issue) => issue.message).join("; ") };
    }
    throw error;
  }
};

const toTagDto = (
  tag: TagRecord
): {
  readonly id: number;
  readonly category: string;
  readonly lang_metadata: Record<string, string>;
  readonly sort_order: number;
  readonly deleted_at?: string | null;
  readonly created_at?: string;
  readonly updated_at?: string;
} => ({
  id: tag.id,
  category: tag.category,
  lang_metadata: tag.langMetadata,
  sort_order: tag.sortOrder,
  deleted_at: tag.deletedAt ?? null,
  created_at: tag.createdAt,
  updated_at: tag.updatedAt
});

const toBatchTagData = (result: {
  readonly items: readonly TagRecord[];
  readonly failed: readonly {
    readonly id?: number;
    readonly index?: number;
    readonly code: number;
    readonly msg: string;
  }[];
}): {
  readonly items: ReturnType<typeof toTagDto>[];
  readonly failed: typeof result.failed;
} => ({
  items: result.items.map(toTagDto),
  failed: result.failed
});

/**
 * 调用流程：常量时间对比服务间 token，消除逐字符短路比较的时序侧信道。
 * 入参：请求 header 中的 token 与服务端期望值。
 * 出参：是否相等；长度不同直接判否（长度信息本身不构成有效侧信道）。
 */
const timingSafeStringEqual = (actual: string, expected: string): boolean => {
  const actualBuffer = Buffer.from(actual, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(actualBuffer, expectedBuffer);
};

type MemoryCursorKey = {
  readonly createdAt: string;
  readonly id: string;
};

/**
 * 调用流程：解析客户端透传回来的 memory 分页 cursor。
 * 入参：query 中的 cursor 字符串；格式 `${createdAt}|${id}`，旧格式纯 createdAt 也兼容。
 * 出参：(createdAt, id) 复合键；cursor 缺失时返回 undefined。
 *
 * 实现方式：按最后一个 "|" 拆分（createdAt 是 ISO 字符串不含 "|"）；无 "|" 时 id 取空串，
 * 等价于「该 createdAt 的所有记录都视为已读过」，保持旧 cursor 的严格小于语义。
 */
const parseMemoryCursor = (cursor: string | undefined): MemoryCursorKey | undefined => {
  if (cursor === undefined) {
    return undefined;
  }
  const separatorIndex = cursor.lastIndexOf("|");
  if (separatorIndex === -1) {
    return { createdAt: cursor, id: "" };
  }
  return {
    createdAt: cursor.slice(0, separatorIndex),
    id: cursor.slice(separatorIndex + 1)
  };
};

/**
 * 调用流程：对 memory 记录按 (createdAt, id) 复合键做全序比较。
 * 入参：两个含 createdAt 和 id 的对象。
 * 出参：负数表示 left 较小（较旧）；同一 createdAt 用 id 决出稳定顺序，保证 cursor 续页不丢不重。
 */
const compareMemoryCursorKey = (left: MemoryCursorKey, right: MemoryCursorKey): number => {
  const byCreatedAt = left.createdAt.localeCompare(right.createdAt);
  return byCreatedAt !== 0 ? byCreatedAt : left.id.localeCompare(right.id);
};

/**
 * 调用流程：把 Memory SDK 完整记录映射为跨团队约定的简化 5 字段 DTO。
 * 入参：Memory.list 返回的单条 Memory。
 * 出参：只含 id/text/type/importance/createdAt 的列表项，不泄漏内部字段。
 */
const toMemoryListItemDto = (
  memory: Memory
): {
  readonly id: string;
  readonly text: string;
  readonly type: string;
  readonly importance: number;
  readonly createdAt: string;
} => ({
  id: memory.id,
  text: memory.text,
  type: memory.type,
  importance: memory.importance,
  createdAt: memory.createdAt
});

const toUserMatchedTweetDto = (
  item: UserMatchedTweetView
): {
  readonly tweet_id: string;
  readonly tweet: {
    readonly raw: Record<string, unknown>;
  };
  readonly matched_tags: readonly {
    readonly id: number;
    readonly category: string;
    readonly lang_metadata: Record<string, string>;
  }[];
  readonly llm_result: Record<string, unknown>;
  readonly matched_at: string;
  readonly pushed_at: string | null;
} => ({
  tweet_id: item.tweetId,
  tweet: {
    raw: item.tweetPayload
  },
  matched_tags: item.matchedTags.map((tag) => ({
    id: tag.id,
    category: tag.category,
    lang_metadata: tag.langMetadata
  })),
  llm_result: item.llmResult,
  matched_at: item.matchedAt,
  pushed_at: item.pushedAt ?? null
});

/**
 * 调用流程：把会话记录转换成 HTTP response item。
 * 入参：PostgreSQL repository 返回的 camelCase 会话记录。
 * 出参：对外接口使用的 snake_case 字段。
 */
const toConversationDto = (
  item: ConversationRecord
): {
  readonly conversation_id: string;
  readonly name: string;
  readonly created_at: string;
  readonly updated_at: string;
} => ({
  conversation_id: item.conversationId,
  name: item.name,
  created_at: item.createdAt,
  updated_at: item.updatedAt
});

/**
 * 调用流程：把会话消息记录转换成 HTTP response item。
 * 入参：PostgreSQL repository 返回的 camelCase 会话消息。
 * 出参：隐藏内部自增 id 和 userId，只返回前端展示所需字段。
 */
const toConversationDetailDto = (
  item: ConversationDetailRecord
): {
  readonly msg_id: string;
  readonly direction: 0 | 1;
  readonly message: string;
  readonly created_at: string;
  readonly updated_at: string;
} => ({
  msg_id: item.msgId,
  direction: item.direction,
  message: item.message,
  created_at: item.createdAt,
  updated_at: item.updatedAt
});

const buildUserTagsResponse = async (
  tagRepository: PostgresTagRepository,
  userId: string,
  includeDeleted = false
): Promise<{
  readonly code: 0;
  readonly msg: "";
  readonly data: {
    readonly user_id: string;
    readonly tags: readonly {
      readonly id: number;
      readonly category: string;
      readonly lang_metadata: Record<string, string>;
      readonly sort_order: number;
      readonly created_at?: string;
      readonly desc: string;
    }[];
  };
}> => {
  const tags = await tagRepository.listUserTags(userId, { includeDeleted });
  return {
    code: 0,
    msg: "",
    data: {
      user_id: userId,
      tags: tags.map((tag) => ({
        id: tag.id,
        category: tag.category,
        lang_metadata: tag.langMetadata,
        sort_order: tag.sortOrder,
        created_at: tag.createdAt,
        desc: tag.desc
      }))
    }
  };
};

const requireConversationRepository = (
  options: BuildServerOptions,
  reply: FastifyReply
): PostgresConversationRepository | undefined => {
  if (options.conversationRepository !== undefined) {
    return options.conversationRepository;
  }
  sendChatJsonError(
    reply,
    503,
    "CHAT_CONVERSATION_UNAVAILABLE",
    "conversation repository is not configured"
  );
  return undefined;
};

const requireTagRepository = (
  options: BuildServerOptions,
  reply: FastifyReply
): PostgresTagRepository | undefined => {
  if (options.tagRepository !== undefined) {
    return options.tagRepository;
  }
  sendInternalTagError(reply, 503, 50000, "tag repository is not configured");
  return undefined;
};

const sendInternalTagError = (
  reply: FastifyReply,
  statusCode: number,
  code: number,
  msg: string
): FastifyReply => reply.status(statusCode).send({ code, msg, data: {} });

/**
 * 调用流程：返回 Chat JSON 接口的错误 envelope。
 * 入参：Fastify reply、HTTP 状态、稳定错误码和用户可见消息。
 * 出参：已发送 `{ code, msg, data: {} }` 的 reply。
 */
const sendChatJsonError = (
  reply: FastifyReply,
  statusCode: number,
  code: string,
  msg: string
): FastifyReply => reply.status(statusCode).send({ code, msg, data: {} });

/**
 * 调用流程：在 Chat SSE 尚未进入正常循环时返回一个 error event。
 * 入参：Fastify reply、HTTP 状态码、稳定错误码和用户可见错误消息。
 * 出参：Fastify reply；实现上仍使用 text/event-stream，便于测试页统一解析失败。
 */
const sendChatSseError = (
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string
): FastifyReply =>
  reply
    .status(statusCode)
    .type("text/event-stream; charset=utf-8")
    .send(formatSseEvent({ type: "error", code, message }));

/**
 * 调用流程：把内部 Chat 事件转换为 SSE 文本块。
 * 入参：ChatSseEvent，包含 meta/token/done/error。
 * 出参：符合 event-stream 格式的字符串。
 */
const formatSseEvent = (event: ChatSseEvent): string => {
  const eventName = event.type;
  return `event: ${eventName}\ndata: ${JSON.stringify(event)}\n\n`;
};

const normalizeInternalErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const readErrorCode = (error: unknown): string | undefined => {
  if (!(error instanceof Error) || !("code" in error)) {
    return undefined;
  }
  const code = error.code;
  return typeof code === "string" ? code : undefined;
};

const readHeaderValue = (request: FastifyRequest, name: string): string | undefined => {
  const value = request.headers[name] ?? request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
};

const logRequest = (request: FastifyRequest): Record<string, unknown> => ({
  method: request.method,
  url: request.url,
  bounded_context: "user_tag_http"
});
