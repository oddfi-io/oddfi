import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionChunk,
  ChatCompletionMessageFunctionToolCall,
  ChatCompletionMessageParam,
  ChatCompletionTool
} from "openai/resources/chat/completions";
import {
  formatRegisteredToolsPrompt,
  indexRegisteredTools,
  type RegisteredTool
} from "../tools/brave-search-mcp.js";
import {
  parseChatContextMarker,
  renderChatContextPrompt,
  type ChatSessionContext
} from "./chat-context-marker.js";
import type { OpenAiChatCompletionClient } from "../../foundation/llm/llm-component.js";
import { silentLogger, type Logger } from "../../foundation/logger/logger-component.js";
import {
  formatMemorySearchContext,
  type MemoryComponent,
  type MemorySearchResult
} from "../../foundation/memory/index.js";
import type {
  ChatDoneEvent,
  ChatMetaEvent,
  ChatSseEvent,
  ChatTokenEvent
} from "../../models/http/chat-dto-model.js";
import { AppError } from "../../shared/app-error.js";

export type ChatAgentServiceOptions = {
  readonly llmClient: OpenAiChatCompletionClient;
  readonly tools?: readonly RegisteredTool[];
  readonly maxToolCalls?: number;
  readonly memory: Pick<MemoryComponent, "search" | "write">;
  readonly memoryTopK: number;
  readonly systemPrompt: string;
  readonly contextPromptTemplate: string;
  readonly logger?: Logger;
};

export type ChatStreamCommand = {
  readonly traceId?: string;
  readonly userId: string;
  readonly conversationId: string;
  readonly message: string;
};

export class ChatAgentService {
  readonly #llmClient: OpenAiChatCompletionClient;
  readonly #tools: readonly RegisteredTool[];
  readonly #toolsByName: ReadonlyMap<string, RegisteredTool>;
  readonly #maxToolCalls: number;
  readonly #memory: Pick<MemoryComponent, "search" | "write">;
  readonly #memoryTopK: number;
  readonly #systemPrompt: string;
  readonly #contextPromptTemplate: string;
  readonly #logger: Logger;

  /**
   * 调用流程：创建 Chat Agent 应用服务实例。
   * 入参：Chat LLM、Memory 组件、Memory 召回 topK、system prompt 和可选 logger。
   * 出参：可被 HTTP SSE 层调用的服务对象；构造函数只保存依赖，不做 I/O。
   */
  constructor(options: ChatAgentServiceOptions) {
    this.#llmClient = options.llmClient;
    this.#tools = options.tools ?? [];
    this.#toolsByName = indexRegisteredTools(this.#tools);
    this.#maxToolCalls = options.maxToolCalls ?? 0;
    this.#memory = options.memory;
    this.#memoryTopK = options.memoryTopK;
    this.#systemPrompt = options.systemPrompt;
    this.#contextPromptTemplate = options.contextPromptTemplate;
    this.#logger = options.logger ?? silentLogger;
  }

  /**
   * 调用流程：处理一条用户输入并以 AsyncGenerator 形式输出 SSE 事件。
   * 入参：可信上游 userId、可选 traceId、必填 conversationId 和当前用户 message。
   * 出参：依次产出 meta、token、done；基础设施异常会抛 AppError 给 HTTP 层转换为 error event。
   *
   * 实现方式：先召回用户长期记忆，search 完成后立即异步调 Memory.write 保存本次输入；
   * 再按 system -> memory -> latest user 的顺序打开 LLM stream，写入失败只记日志。
   */
  async *streamChat(command: ChatStreamCommand): AsyncGenerator<ChatSseEvent> {
    const traceId = command.traceId?.trim() || randomUUID();
    const conversationId = command.conversationId.trim();
    assertNonEmpty(command.userId, "userId", traceId);
    assertNonEmpty(command.conversationId, "conversationId", traceId);
    assertNonEmpty(command.message, "message", traceId);

    // meta 事件必须最先输出，让前端可以立即拿到 trace 和会话来源。
    const meta: ChatMetaEvent = {
      type: "meta",
      trace_id: traceId,
      conversation_id: conversationId
    };
    yield meta;

    // 先解析前端塞在 message 开头的上下文标记；剥离后的纯用户输入才进入记忆与模型链路，
    // 解析失败按普通对话处理（context=undefined、message=原文），不影响主流程。
    const parsed = parseChatContextMarker(command.message);
    if (parsed.context !== undefined) {
      this.#logger.debug("chat_agent.context_marker_parsed", {
        bounded_context: "chat_agent",
        request_trace_id: traceId,
        context: parsed.context
      });
    }

    // Memory.search 是回答前的上下文增强；失败时退化为空上下文，避免向量库短暂故障打断 chat。
    const memories = await this.#searchMemories({
      traceId,
      userId: command.userId,
      message: parsed.message
    });
    this.#scheduleMemoryWrite({
      traceId,
      userId: command.userId,
      conversationId,
      message: parsed.message
    });
    // LLM streaming 是用户可见主链路；如果模型在 stream 中继续请求工具，就执行工具后再开下一轮 stream。
    for await (const token of this.#streamWithToolLoop(
      this.#buildMessages(memories, parsed.message, parsed.context),
      { traceId }
    )) {
      yield token;
    }

    // done 只表达用户可见 stream 结束；Memory.write 已在 search 后后台执行，不阻塞当前回答。
    const done: ChatDoneEvent = { type: "done", trace_id: traceId, memory_write: "scheduled" };
    yield done;
  }

  /**
   * 调用流程：读取 Memory v3 的长期记忆召回结果。
   * 入参：traceId、userId 和当前 message；message 会作为语义检索 query。
   * 出参：Memory.search 返回的结果；失败时返回空数组。
   *
   * 实现方式：把 Memory.search 包在 try/catch 中，错误只写日志，因为 chat 主链路可以在无
   * 记忆上下文时继续回答。
   */
  async #searchMemories(command: {
    readonly traceId: string;
    readonly userId: string;
    readonly message: string;
  }): Promise<readonly MemorySearchResult[]> {
    try {
      return await this.#memory.search({
        traceId: command.traceId,
        userId: command.userId,
        query: command.message,
        topK: this.#memoryTopK
      });
    } catch (cause) {
      this.#logger.error("chat_agent.memory_search_failed", {
        bounded_context: "chat_agent",
        request_trace_id: command.traceId,
        error: normalizeError(cause)
      });
      return [];
    }
  }

  /**
   * 调用流程：构造 Chat LLM messages。
   * 入参：Memory.search 结果和用户当前输入。
   * 出参：OpenAI Chat Completions messages，顺序固定为 system、runtime、tools、memory、latest user。
   *
   * 实现方式：runtime_context 提供当前 UTC 日期，避免模型猜测“今天”；Memory 使用格式化 JSON
   * 并包裹在 retrieved_memories；当前用户输入包裹在 untrusted_input 且放在最后。
   */
  #buildMessages(
    memories: readonly MemorySearchResult[],
    message: string,
    context?: ChatSessionContext
  ): ChatCompletionMessageParam[] {
    // session context 只接受 zod 校验过的安全字段（枚举/数字串），渲染模板后追加到 system 尾部；
    // 动态内容放在固定 system prompt 之后，不破坏 prompt cache 边界。
    const systemContent =
      context === undefined
        ? this.#systemPrompt
        : `${this.#systemPrompt}\n\n${renderChatContextPrompt(this.#contextPromptTemplate, context)}`;
    return [
      {
        role: "system",
        content: systemContent
      },
      {
        role: "user",
        content: `<runtime_context>\n${JSON.stringify(buildRuntimeContext(), null, 2)}\n</runtime_context>`
      },
      {
        role: "user",
        content: formatRegisteredToolsPrompt(this.#tools, this.#maxToolCalls)
      },
      {
        role: "user",
        content: `<retrieved_memories>\n${formatMemorySearchContext(memories)}\n</retrieved_memories>`
      },
      {
        role: "user",
        content: `<untrusted_input>${escapePromptBoundary(message)}</untrusted_input>`
      }
    ];
  }

  /**
   * 调用流程：流式调用 LLM，并在模型请求工具时继续执行 tool loop。
   * 入参：初始 messages 和 traceId。
   * 出参：用户可见 token 事件；模型停止请求工具或达到 `maxToolCalls` 后结束。
   *
   * 实现方式：每轮都用 streaming Chat Completions，边输出 content delta，边收集 streamed
   * tool_calls；当一轮 stream 结束后，如果模型请求了工具且未达到上限，就执行工具并把结果
   * 追加到 messages，再由模型决定下一轮是继续调用工具还是输出最终答案。
   */
  async *#streamWithToolLoop(
    messages: readonly ChatCompletionMessageParam[],
    context: { readonly traceId: string }
  ): AsyncGenerator<ChatTokenEvent> {
    const resolvedMessages = [...messages];
    let toolCallCount = 0;

    while (true) {
      const canUseTools = this.#tools.length > 0 && toolCallCount < this.#maxToolCalls;
      const pendingToolCalls = new Map<number, PendingStreamToolCall>();
      let assistantContent = "";

      // 每轮都保持 stream；文本实时给前端，tool_call delta 暂存到本轮结束后统一执行。
      const stream = await this.#llmClient.stream({
        model: this.#llmClient.model,
        temperature: this.#llmClient.temperature,
        stream: true,
        messages: resolvedMessages,
        ...this.#buildToolRequestFields(canUseTools)
      });
      for await (const chunk of stream) {
        for (const choice of chunk.choices) {
          const contentDelta = choice.delta.content ?? "";
          assistantContent += contentDelta;
          if (contentDelta.length > 0) {
            yield { type: "token", delta: contentDelta };
          }
          for (const toolCallDelta of choice.delta.tool_calls ?? []) {
            collectToolCallDelta(pendingToolCalls, toolCallDelta);
          }
        }
      }

      // 没有 tool call 表示模型自己决定已经结束；代码只负责尊重这个停止点。
      const functionToolCalls = finalizeToolCalls(pendingToolCalls);
      if (functionToolCalls.length !== pendingToolCalls.size) {
        this.#logger.warn("chat_agent.incomplete_tool_call_delta", {
          bounded_context: "chat_agent",
          request_trace_id: context.traceId,
          pending_tool_calls: pendingToolCalls.size,
          executable_tool_calls: functionToolCalls.length
        });
      }
      if (functionToolCalls.length === 0) {
        break;
      }

      // 达到上限时不再执行新工具；下一轮将不带 tools，让模型基于已有上下文收束回答。
      const remainingToolCalls = this.#maxToolCalls - toolCallCount;
      const executableToolCalls = functionToolCalls.slice(0, Math.max(0, remainingToolCalls));
      if (executableToolCalls.length < functionToolCalls.length) {
        this.#logger.warn("chat_agent.tool_call_limit_reached", {
          bounded_context: "chat_agent",
          request_trace_id: context.traceId,
          max_tool_calls: this.#maxToolCalls
        });
      }
      if (executableToolCalls.length === 0) {
        resolvedMessages.push({
          role: "user",
          content:
            "<tool_call_limit_reached>Tool call limit reached. Answer with the information already available and do not request more tools.</tool_call_limit_reached>"
        });
        continue;
      }

      // assistant tool_calls 和 role:tool 结果必须成对回填，否则下一轮 LLM 无法关联工具返回。
      resolvedMessages.push(
        toAssistantMessageParam({
          content: assistantContent.length === 0 ? null : assistantContent,
          toolCalls: executableToolCalls
        })
      );
      for (const toolCall of executableToolCalls) {
        resolvedMessages.push(await this.#executeToolCall(toolCall, context));
      }
      toolCallCount += executableToolCalls.length;
    }
  }

  /**
   * 调用流程：执行单个 LLM tool call。
   * 入参：OpenAI-compatible function tool call 和 traceId。
   * 出参：`role:"tool"` message，内容为工具执行结果或错误。
   */
  async #executeToolCall(
    toolCall: ChatCompletionMessageFunctionToolCall,
    context: { readonly traceId: string }
  ): Promise<ChatCompletionMessageParam> {
    const tool = this.#toolsByName.get(toolCall.function.name);
    if (tool === undefined) {
      return {
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify({
          error: {
            code: "TOOL_NOT_REGISTERED",
            message: `tool is not registered: ${toolCall.function.name}`
          }
        })
      };
    }
    try {
      const args = parseToolArguments(toolCall.function.arguments);
      const result = await tool.call(args);
      return {
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result)
      };
    } catch (cause) {
      this.#logger.error("chat_agent.tool_call_failed", {
        bounded_context: "chat_agent",
        request_trace_id: context.traceId,
        tool_name: toolCall.function.name,
        error: normalizeError(cause)
      });
      return {
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify({
          error: {
            code: "TOOL_CALL_FAILED",
            message: cause instanceof Error ? cause.message : String(cause)
          }
        })
      };
    }
  }

  /**
   * 调用流程：构造传给 Chat Completions 的 tool 字段。
   * 入参：无，使用构造函数注入的工具列表。
   * 出参：没有工具时为空对象，有工具时包含 tools 和 tool_choice。
   */
  #buildToolRequestFields(enabled: boolean): {
    readonly tools?: ChatCompletionTool[];
    readonly tool_choice?: "auto";
  } {
    if (!enabled || this.#tools.length === 0 || this.#maxToolCalls <= 0) {
      return {};
    }
    return {
      tools: this.#tools.map((tool) => tool.definition),
      tool_choice: "auto"
    };
  }

  /**
   * 调用流程：在 Memory.search 完成后异步写入长期记忆。
   * 入参：traceId、userId、conversationId 和当前用户 message。
   * 出参：无；方法立即返回，内部 promise 自行捕获失败。
   *
   * 实现方式：search 完成后立即使用 void promise 启动后台副作用；catch 中只写结构化日志，
   * 避免未处理 promise 影响进程稳定性，也避免慢写入阻塞 LLM streaming。
   */
  #scheduleMemoryWrite(command: {
    readonly traceId: string;
    readonly userId: string;
    readonly conversationId: string;
    readonly message: string;
  }): void {
    void this.#memory
      .write({
        traceId: command.traceId,
        userId: command.userId,
        conversationId: command.conversationId,
        message: command.message
      })
      .catch((cause: unknown) => {
        this.#logger.error("chat_agent.memory_write_failed", {
          bounded_context: "chat_agent",
          request_trace_id: command.traceId,
          error: normalizeError(cause)
        });
      });
  }
}

/**
 * 调用流程：加载 Chat Agent system prompt。
 * 入参：promptDir，可选 prompt 目录；不传时读取当前进程工作目录的 prompts。
 * 出参：prompt 文本；文件缺失或为空会让初始化 fail-fast。
 */
export const loadChatAgentSystemPrompt = async (
  promptDir = resolve(process.cwd(), "prompts")
): Promise<string> => {
  const prompt = await readFile(resolve(promptDir, "chat-agent.system.v1.md"), "utf8");
  if (prompt.trim().length === 0) {
    throw new AppError({
      code: "CHAT_AGENT_PROMPT_EMPTY",
      message: "chat agent system prompt is empty",
      retryable: false
    });
  }
  return prompt;
};

/**
 * 调用流程：加载会话上下文标记的 system 注入模板。
 * 入参：promptDir，可选 prompt 目录；不传时读取当前进程工作目录的 prompts。
 * 出参：含 {{context_lines}} 占位符的模板文本；文件缺失、为空或缺占位符会让初始化 fail-fast。
 */
export const loadChatAgentContextPrompt = async (
  promptDir = resolve(process.cwd(), "prompts")
): Promise<string> => {
  const template = await readFile(resolve(promptDir, "chat-agent.context.v1.md"), "utf8");
  // 占位符缺失说明模板被误改，渲染会静默丢失上下文，必须在启动期阻断。
  if (template.trim().length === 0 || !template.includes("{{context_lines}}")) {
    throw new AppError({
      code: "CHAT_AGENT_CONTEXT_PROMPT_INVALID",
      message: "chat agent context prompt is empty or missing {{context_lines}} placeholder",
      retryable: false
    });
  }
  return template;
};

/**
 * 调用流程：校验字符串参数非空。
 * 入参：待校验 value、字段名和 traceId。
 * 出参：无；非法时抛 AppError。
 */
const assertNonEmpty = (value: string, field: string, traceId: string): void => {
  if (value.trim().length === 0) {
    throw new AppError({
      code: "CHAT_AGENT_INVALID_ARGUMENT",
      message: `${field} is required`,
      retryable: false,
      traceId
    });
  }
};

/**
 * 调用流程：转义 prompt 边界字符。
 * 入参：外部用户输入。
 * 出参：安全放入 XML-like wrapper 的文本。
 */
const escapePromptBoundary = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/**
 * 调用流程：生成 Chat Agent 的运行时上下文。
 * 入参：无；使用当前进程 UTC 时间，避免模型自行猜测“今天”等相对日期。
 * 出参：可安全放入 user message 的 JSON 上下文。
 */
const buildRuntimeContext = (): {
  readonly current_date: string;
  readonly current_time_iso: string;
  readonly timezone: string;
} => {
  const now = new Date();
  return {
    current_date: now.toISOString().slice(0, 10),
    current_time_iso: now.toISOString(),
    timezone: "UTC"
  };
};

/**
 * 调用流程：解析 LLM 生成的工具参数 JSON。
 * 入参：function.arguments 原始字符串。
 * 出参：unknown 结构，由具体工具继续 zod 校验。
 */
const parseToolArguments = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch (cause) {
    throw new AppError({
      code: "CHAT_AGENT_TOOL_ARGUMENTS_INVALID",
      message: "tool arguments are not valid JSON",
      retryable: false,
      cause
    });
  }
};

/**
 * 调用流程：把 SDK 返回的 assistant message 转成可回填的 message param。
 * 入参：Chat Completions assistant message。
 * 出参：带 content 和 tool_calls 的 assistant message param。
 */
const toAssistantMessageParam = (message: {
  readonly content: string | null;
  readonly toolCalls: readonly ChatCompletionMessageFunctionToolCall[];
}): ChatCompletionAssistantMessageParam => ({
  role: "assistant",
  content: message.content,
  tool_calls: [...message.toolCalls]
});

/**
 * 调用流程：收集 streamed tool_call delta。
 * 入参：本轮 pending map 和 OpenAI-compatible chunk 里的单个 tool_call delta。
 * 出参：无；函数会按 delta.index 原地累计 id、function.name 和 function.arguments。
 */
const collectToolCallDelta = (
  pendingToolCalls: Map<number, PendingStreamToolCall>,
  toolCallDelta: StreamToolCallDelta
): void => {
  const current = pendingToolCalls.get(toolCallDelta.index) ?? {
    id: "",
    name: "",
    arguments: ""
  };

  // streamed tool_call 的字段可能分散在多个 chunk 中，所以 name/arguments 需要累加。
  pendingToolCalls.set(toolCallDelta.index, {
    id: toolCallDelta.id ?? current.id,
    name: `${current.name}${toolCallDelta.function?.name ?? ""}`,
    arguments: `${current.arguments}${toolCallDelta.function?.arguments ?? ""}`
  });
};

/**
 * 调用流程：把 streamed tool_call delta 合成为可执行 function tool call。
 * 入参：按 index 累计的 pending tool call map。
 * 出参：字段完整的 function tool call；缺 id/name 的半截 tool call 会被跳过并由调用方记录告警。
 */
const finalizeToolCalls = (
  pendingToolCalls: ReadonlyMap<number, PendingStreamToolCall>
): ChatCompletionMessageFunctionToolCall[] =>
  [...pendingToolCalls.entries()]
    .sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
    .flatMap(([, toolCall]) => {
      if (toolCall.id.length === 0 || toolCall.name.length === 0) {
        return [];
      }
      return [
        {
          id: toolCall.id,
          type: "function",
          function: {
            name: toolCall.name,
            arguments: toolCall.arguments
          }
        }
      ];
    });

type StreamToolCallDelta = NonNullable<
  ChatCompletionChunk["choices"][number]["delta"]["tool_calls"]
>[number];

type PendingStreamToolCall = {
  readonly id: string;
  readonly name: string;
  readonly arguments: string;
};

/**
 * 调用流程：把未知错误转换为可记录的短对象。
 * 入参：catch 捕获的任意错误。
 * 出参：不包含 secret 或原始请求体的日志字段。
 */
const normalizeError = (cause: unknown): Record<string, unknown> =>
  cause instanceof Error
    ? { name: cause.name, message: cause.message, code: "code" in cause ? cause.code : undefined }
    : { message: String(cause) };
