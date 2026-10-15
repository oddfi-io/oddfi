import { describe, expect, it, vi } from "vitest";
import type {
  ChatCompletionCreateParamsStreaming,
  ChatCompletionMessageParam,
  ChatCompletionChunk
} from "openai/resources/chat/completions";
import type { Stream } from "openai/core/streaming";
import { ChatAgentService } from "./chat-agent-service.js";
import type { MemoryWriteCommand } from "../../foundation/memory/index.js";

type ChunkDelta = ChatCompletionChunk["choices"][number]["delta"];

const buildDeltaStream = async function* (
  chunks: readonly ChunkDelta[]
): AsyncGenerator<ChatCompletionChunk> {
  for (const chunk of chunks) {
    await Promise.resolve();
    yield {
      id: "chunk",
      object: "chat.completion.chunk",
      created: 0,
      model: "test-model",
      choices: [
        {
          index: 0,
          delta: chunk,
          finish_reason: null
        }
      ]
    };
  }
};

const asOpenAiStream = (chunks: readonly string[]): Stream<ChatCompletionChunk> =>
  buildDeltaStream(
    chunks.map((content) => ({ content }))
  ) as unknown as Stream<ChatCompletionChunk>;

const asOpenAiDeltaStream = (chunks: readonly ChunkDelta[]): Stream<ChatCompletionChunk> =>
  buildDeltaStream(chunks) as unknown as Stream<ChatCompletionChunk>;

describe("ChatAgentService", () => {
  it("streams meta token done and writes memory asynchronously", async () => {
    const calls: string[] = [];
    const write = vi.fn(() => Promise.resolve([])) as unknown as ReturnType<
      typeof vi.fn<(command: MemoryWriteCommand) => Promise<[]>>
    >;
    const stream = vi.fn(() => {
      calls.push("llm_stream");
      return Promise.resolve(asOpenAiStream(["hello", " world"]));
    });
    const service = new ChatAgentService({
      memoryTopK: 2,
      systemPrompt: "system prompt",
      contextPromptTemplate: "<session_context>\n{{context_lines}}\n</session_context>",
      memory: {
        search: () => {
          calls.push("memory_search");
          return Promise.resolve([
            {
              id: "memory_1",
              userId: "user_1",
              type: "preference",
              semanticKey: "preference.market",
              text: "用户关注足球比赛交易风险。",
              confidence: 0.9,
              importance: 4,
              conversationId: "conv_old",
              sourceMessageId: "msg_old",
              validFrom: "2026-05-23T00:00:00.000Z",
              createdAt: "2026-05-23T00:00:00.000Z",
              updatedAt: "2026-05-23T00:00:00.000Z",
              metadata: {},
              similarity: 0.88
            }
          ]);
        },
        write: (...args) => {
          calls.push("memory_write");
          return write(...args);
        }
      },
      llmClient: {
        model: "test-model",
        temperature: 0,
        create: vi.fn(),
        stream
      }
    });

    const events = [];
    for await (const event of service.streamChat({
      traceId: "trace_1",
      userId: "user_1",
      conversationId: "conv_1",
      message: "分析今晚足球比赛交易风险"
    })) {
      events.push(event);
    }
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(events).toEqual([
      { type: "meta", trace_id: "trace_1", conversation_id: "conv_1" },
      { type: "token", delta: "hello" },
      { type: "token", delta: " world" },
      { type: "done", trace_id: "trace_1", memory_write: "scheduled" }
    ]);
    expect(write).toHaveBeenCalledWith({
      traceId: "trace_1",
      userId: "user_1",
      conversationId: "conv_1",
      message: "分析今晚足球比赛交易风险"
    });
    expect(calls).toEqual(["memory_search", "memory_write", "llm_stream"]);
  });

  it("places recalled memory before the latest untrusted user input", async () => {
    const stream = vi.fn(() => Promise.resolve(asOpenAiStream(["ok"]))) as unknown as ReturnType<
      typeof vi.fn<
        (params: ChatCompletionCreateParamsStreaming) => Promise<Stream<ChatCompletionChunk>>
      >
    >;
    const service = new ChatAgentService({
      memoryTopK: 5,
      systemPrompt: "system prompt",
      contextPromptTemplate: "<session_context>\n{{context_lines}}\n</session_context>",
      memory: {
        search: () =>
          Promise.resolve([
            {
              id: "memory_1",
              userId: "user_1",
              type: "profile",
              semanticKey: "profile.sport",
              text: "用户关注篮球。",
              confidence: 0.9,
              importance: 3,
              conversationId: "conv_old",
              sourceMessageId: "msg_old",
              validFrom: "2026-05-23T00:00:00.000Z",
              createdAt: "2026-05-23T00:00:00.000Z",
              updatedAt: "2026-05-23T00:00:00.000Z",
              metadata: {},
              similarity: 0.8
            }
          ]),
        write: () => Promise.resolve([])
      },
      llmClient: {
        model: "test-model",
        temperature: 0,
        create: vi.fn(),
        stream
      }
    });

    for await (const event of service.streamChat({
      traceId: "trace_2",
      userId: "user_1",
      conversationId: "conv_2",
      message: "今晚赛事怎么看？"
    })) {
      // Consume the stream so the LLM call is executed.
      expect(event.type).toMatch(/meta|token|done/u);
    }

    const request = stream.mock.calls[0]?.[0];
    expect(request).toBeDefined();
    const messages = request?.messages as ChatCompletionMessageParam[];
    expect(messages.map((message) => message.role)).toEqual([
      "system",
      "user",
      "user",
      "user",
      "user"
    ]);
    expect(readTextContent(messages[1])).toContain("<runtime_context>");
    expect(readTextContent(messages[1])).toContain("current_date");
    expect(readTextContent(messages[2])).toContain("<registered_tools>");
    expect(readTextContent(messages[3])).toContain("<retrieved_memories>");
    expect(readTextContent(messages[3])).toContain("用户关注篮球。");
    expect(readTextContent(messages[4])).toBe(
      "<untrusted_input>今晚赛事怎么看？</untrusted_input>"
    );
  });

  it("injects parsed context marker into system prompt and strips it from model input", async () => {
    const stream = vi.fn(() => Promise.resolve(asOpenAiStream(["ok"]))) as unknown as ReturnType<
      typeof vi.fn<
        (params: ChatCompletionCreateParamsStreaming) => Promise<Stream<ChatCompletionChunk>>
      >
    >;
    const writeCommands: MemoryWriteCommand[] = [];
    const service = new ChatAgentService({
      memoryTopK: 1,
      systemPrompt: "system prompt",
      contextPromptTemplate: "<session_context>\n{{context_lines}}\n</session_context>",
      memory: {
        search: () => Promise.resolve([]),
        write: (command) => {
          writeCommands.push(command);
          return Promise.resolve([]);
        }
      },
      llmClient: {
        model: "test-model",
        temperature: 0,
        create: vi.fn(),
        stream
      }
    });

    for await (const event of service.streamChat({
      traceId: "trace_ctx",
      userId: "user_1",
      conversationId: "conv_ctx",
      message: "[intent=match-analysis match_id=66923 persona=aggressive risk=8]\n分析这场比赛"
    })) {
      expect(event.type).toMatch(/meta|token|done/u);
    }
    await new Promise((resolve) => setTimeout(resolve, 0));

    const request = stream.mock.calls[0]?.[0];
    expect(request).toBeDefined();
    const messages = request?.messages as ChatCompletionMessageParam[];
    // system 消息尾部追加 schema 校验后的上下文；标记本身不进入 untrusted_input。
    expect(readTextContent(messages[0])).toContain("system prompt");
    expect(readTextContent(messages[0])).toContain("match_id=66923");
    expect(readTextContent(messages[0])).toContain("用户性格：aggressive");
    expect(readTextContent(messages[0])).toContain("风险偏好：8/10");
    const lastMessage = messages.at(-1);
    expect(readTextContent(lastMessage)).toBe("<untrusted_input>分析这场比赛</untrusted_input>");
    // Memory 写入的也必须是剥离标记后的纯用户输入。
    expect(writeCommands[0]?.message).toBe("分析这场比赛");
  });

  it("streams reasoning tags as user-visible tokens", async () => {
    const stream = vi.fn(() =>
      Promise.resolve(asOpenAiStream(["<think>internal</think>\n\n", "final answer"]))
    );
    const service = new ChatAgentService({
      memoryTopK: 1,
      systemPrompt: "system prompt",
      contextPromptTemplate: "<session_context>\n{{context_lines}}\n</session_context>",
      memory: {
        search: () => Promise.resolve([]),
        write: () => Promise.resolve([])
      },
      llmClient: {
        model: "test-model",
        temperature: 0,
        create: vi.fn(),
        stream
      }
    });

    const events = [];
    for await (const event of service.streamChat({
      traceId: "trace_reasoning",
      userId: "user_1",
      conversationId: "conv_1",
      message: "今天有什么篮球比赛？"
    })) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: "meta", trace_id: "trace_reasoning", conversation_id: "conv_1" },
      { type: "token", delta: "<think>internal</think>\n\n" },
      { type: "token", delta: "final answer" },
      { type: "done", trace_id: "trace_reasoning", memory_write: "scheduled" }
    ]);
  });

  it("continues without memory when memory search fails", async () => {
    const service = new ChatAgentService({
      memoryTopK: 5,
      systemPrompt: "system prompt",
      contextPromptTemplate: "<session_context>\n{{context_lines}}\n</session_context>",
      memory: {
        search: () => Promise.reject(new Error("pinecone unavailable")),
        write: () => Promise.resolve([])
      },
      llmClient: {
        model: "test-model",
        temperature: 0,
        create: vi.fn(),
        stream: vi.fn(() => Promise.resolve(asOpenAiStream(["fallback"])))
      }
    });

    const events = [];
    for await (const event of service.streamChat({
      traceId: "trace_3",
      userId: "user_1",
      conversationId: "conv_3",
      message: "分析交易风险"
    })) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual(["meta", "token", "done"]);
  });

  it("registers tools, executes tool calls, and streams with tool results", async () => {
    const stream = vi.fn(
      (): Promise<Stream<ChatCompletionChunk>> =>
        Promise.resolve(asOpenAiStream(["fallback answer"]))
    ) as unknown as ReturnType<
      typeof vi.fn<
        (params: ChatCompletionCreateParamsStreaming) => Promise<Stream<ChatCompletionChunk>>
      >
    >;
    stream
      .mockResolvedValueOnce(
        asOpenAiDeltaStream([
          { content: "<think>先搜索盘口数据</think>\n" },
          {
            tool_calls: [
              {
                index: 0,
                id: "call_search_1",
                type: "function",
                function: { name: "web_search", arguments: '{"query":' }
              }
            ]
          },
          {
            tool_calls: [
              {
                index: 0,
                function: { arguments: '"today basketball odds"}' }
              }
            ]
          }
        ])
      )
      .mockResolvedValueOnce(asOpenAiStream(["search answer"]));
    const toolCall = vi.fn((args: unknown) =>
      Promise.resolve({
        query: "today basketball odds",
        args,
        results: [{ title: "NBA", url: "u" }]
      })
    );
    const service = new ChatAgentService({
      memoryTopK: 5,
      systemPrompt: "system prompt",
      contextPromptTemplate: "<session_context>\n{{context_lines}}\n</session_context>",
      maxToolCalls: 3,
      tools: [
        {
          name: "web_search",
          description: "Search web.",
          definition: {
            type: "function",
            function: {
              name: "web_search",
              parameters: { type: "object", properties: {}, additionalProperties: false }
            }
          },
          call: toolCall
        }
      ],
      memory: {
        search: () => Promise.resolve([]),
        write: () => Promise.resolve([])
      },
      llmClient: {
        model: "test-model",
        temperature: 0,
        create: vi.fn(),
        stream
      }
    });

    const events = [];
    for await (const event of service.streamChat({
      traceId: "trace_tool",
      userId: "user_1",
      conversationId: "conv_tool",
      message: "今天有什么篮球比赛？"
    })) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual(["meta", "token", "token", "done"]);
    expect(events[0]).toMatchObject({ type: "meta", trace_id: "trace_tool" });
    expect(events[1]).toEqual({ type: "token", delta: "<think>先搜索盘口数据</think>\n" });
    expect(events[2]).toEqual({ type: "token", delta: "search answer" });
    expect(events[3]).toEqual({
      type: "done",
      trace_id: "trace_tool",
      memory_write: "scheduled"
    });
    expect(toolCall).toHaveBeenCalledWith({ query: "today basketball odds" });
    const firstStreamRequest = stream.mock.calls[0]?.[0];
    expect(firstStreamRequest).toBeDefined();
    const firstTool = firstStreamRequest?.tools?.[0];
    if (firstTool?.type !== "function") {
      throw new Error("expected function tool");
    }
    expect(firstTool.function.name).toBe("web_search");
    expect(readTextContent(firstStreamRequest?.messages[1])).toContain("<runtime_context>");
    expect(readTextContent(firstStreamRequest?.messages[2])).toContain("<registered_tools>");
    const secondStreamRequest = stream.mock.calls[1]?.[0];
    expect(secondStreamRequest).toBeDefined();
    expect(secondStreamRequest?.tools?.[0]?.type).toBe("function");
    expect(secondStreamRequest?.tool_choice).toBe("auto");
    const streamMessages = secondStreamRequest?.messages as ChatCompletionMessageParam[];
    expect(streamMessages.some((message) => message.role === "assistant")).toBe(true);
    expect(streamMessages.some((message) => message.role === "tool")).toBe(true);
  });
});

const readTextContent = (message: ChatCompletionMessageParam | undefined): string => {
  if (message === undefined || typeof message.content !== "string") {
    return "";
  }
  return message.content;
};
