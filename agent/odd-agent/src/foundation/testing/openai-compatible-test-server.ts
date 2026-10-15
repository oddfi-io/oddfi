import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

export type TestLlmServer = {
  readonly baseUrl: string;
  readonly requests: readonly unknown[];
  readonly close: () => Promise<void>;
};

export const startOpenAiCompatibleTestServer = async (): Promise<TestLlmServer> => {
  const requests: unknown[] = [];
  const server = createServer((request, response) => {
    if (request.method === "POST" && request.url === "/embeddings") {
      handleEmbeddingRequest(request, response, requests);
      return;
    }
    if (request.method !== "POST" || request.url !== "/chat/completions") {
      response.writeHead(404).end();
      return;
    }
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      const parsed = JSON.parse(body) as {
        readonly model?: string;
        readonly messages?: readonly { readonly role: string; readonly content: string }[];
        readonly tools?: readonly unknown[];
        readonly functions?: readonly unknown[];
        readonly response_format?: unknown;
        readonly stream?: boolean;
      };
      requests.push(parsed);
      const userMessage =
        [...(parsed.messages ?? [])].reverse().find((message) => message.role === "user")
          ?.content ?? "";
      const toolMessage =
        [...(parsed.messages ?? [])].reverse().find((message) => message.role === "tool")
          ?.content ?? "";
      const toolMessages = (parsed.messages ?? []).filter((message) => message.role === "tool");
      if (
        userMessage === "strict fallback" &&
        typeof parsed.response_format === "object" &&
        parsed.response_format !== null &&
        (parsed.response_format as { readonly type?: unknown }).type === "json_schema"
      ) {
        response.writeHead(400, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            error: {
              type: "bad_request_error",
              message: "invalid params, json_schema response_format is not supported"
            }
          })
        );
        return;
      }
      if (userMessage === "stream tokens" && parsed.stream === true) {
        sendStream(response, parsed.model, ["Hello", " streaming", " world"]);
        return;
      }
      response.writeHead(200, { "content-type": "application/json" });
      if (userMessage === "raw sdk call") {
        sendCompletion(response, parsed.model, {
          content: "raw method ok"
        });
        return;
      }
      if (userMessage === "parallel tools" && toolMessages.length >= 2) {
        sendCompletion(response, parsed.model, {
          content: `Parallel summary: ${toolMessages.map((message) => message.content).join(" | ")}`
        });
        return;
      }
      if (userMessage === "serial tools" && toolMessages.length >= 2) {
        sendCompletion(response, parsed.model, {
          content: `Serial summary: ${toolMessages.map((message) => message.content).join(" -> ")}`
        });
        return;
      }
      if (userMessage === "repeat tool" && toolMessages.length >= 2) {
        sendCompletion(response, parsed.model, {
          content: `Repeat summary: ${toolMessages.map((message) => message.content).join(" + ")}`
        });
        return;
      }
      if (toolMessage.length > 0) {
        if (userMessage === "serial tools" && toolMessages.length === 1) {
          sendCompletion(response, parsed.model, {
            content: "",
            toolCalls: [
              {
                id: "call_format_second",
                name: "format_result",
                argumentsJson: JSON.stringify({ value: toolMessage })
              }
            ]
          });
          return;
        }
        sendCompletion(response, parsed.model, {
          content: `Weather summary: ${toolMessage}`
        });
        return;
      }
      if (userMessage === "strict tags") {
        sendCompletion(response, parsed.model, {
          content: JSON.stringify({
            code: 0,
            msg: "匹配成功",
            data: ["Portugal", "Ronaldo"]
          })
        });
        return;
      }
      if (userMessage === "strict fallback") {
        sendCompletion(response, parsed.model, {
          content: `<think>private</think>\n${JSON.stringify({
            code: 0,
            msg: "fallback成功",
            data: ["MiniMax", "JSON"]
          })}`
        });
        return;
      }
      if (userMessage === "weather with tool") {
        sendCompletion(response, parsed.model, {
          content: "",
          toolCalls: [
            {
              id: "call_weather",
              name: "get_weather",
              argumentsJson: JSON.stringify({ city: "Shanghai" })
            }
          ]
        });
        return;
      }
      if (userMessage === "forced tool") {
        sendCompletion(response, parsed.model, {
          content: "",
          toolCalls: [
            {
              id: "call_forced_weather",
              name: "get_weather",
              argumentsJson: JSON.stringify({ city: "Shanghai" })
            }
          ]
        });
        return;
      }
      if (userMessage === "parallel tools") {
        sendCompletion(response, parsed.model, {
          content: "",
          toolCalls: [
            {
              id: "call_weather_parallel",
              name: "get_weather",
              argumentsJson: JSON.stringify({ city: "Shanghai" })
            },
            {
              id: "call_time_parallel",
              name: "get_time",
              argumentsJson: JSON.stringify({ timezone: "Asia/Shanghai" })
            }
          ]
        });
        return;
      }
      if (userMessage === "serial tools") {
        sendCompletion(response, parsed.model, {
          content: "",
          toolCalls: [
            {
              id: "call_fetch_first",
              name: "fetch_number",
              argumentsJson: JSON.stringify({ seed: 7 })
            }
          ]
        });
        return;
      }
      if (userMessage === "repeat tool") {
        sendCompletion(response, parsed.model, {
          content: "",
          toolCalls: [
            {
              id: "call_repeat_first",
              name: "lookup_score",
              argumentsJson: JSON.stringify({ team: "A" })
            },
            {
              id: "call_repeat_second",
              name: "lookup_score",
              argumentsJson: JSON.stringify({ team: "B" })
            }
          ]
        });
        return;
      }
      const rawContent = JSON.stringify({ ok: true, echo: userMessage });
      sendCompletion(response, parsed.model, {
        content:
          userMessage === "json with think"
            ? `<think>private reasoning</think>\n${rawContent}`
            : rawContent
      });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("failed to start test llm server");
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    close: () => closeServer(server)
  };
};

type CompletionPayload = {
  readonly content: string;
  readonly toolCalls?: readonly {
    readonly id: string;
    readonly name: string;
    readonly argumentsJson: string;
  }[];
};

const sendCompletion = (
  response: ServerResponse,
  model: string | undefined,
  payload: CompletionPayload
): void => {
  response.end(
    JSON.stringify({
      id: "chatcmpl_foundation_test",
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: model ?? "test-model",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: payload.content,
            ...(payload.toolCalls === undefined
              ? {}
              : {
                  tool_calls: payload.toolCalls.map((toolCall) => ({
                    id: toolCall.id,
                    type: "function",
                    function: {
                      name: toolCall.name,
                      arguments: toolCall.argumentsJson
                    }
                  }))
                })
          },
          finish_reason: payload.toolCalls === undefined ? "stop" : "tool_calls"
        }
      ],
      usage: {
        prompt_tokens: 7,
        completion_tokens: 5,
        total_tokens: 12
      }
    })
  );
};

const sendStream = (
  response: ServerResponse,
  model: string | undefined,
  chunks: readonly string[]
): void => {
  response.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive"
  });
  for (const content of chunks) {
    response.write(
      `data: ${JSON.stringify({
        id: "chatcmpl_stream_foundation_test",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: model ?? "test-model",
        choices: [
          {
            index: 0,
            delta: { content },
            finish_reason: null
          }
        ]
      })}\n\n`
    );
  }
  response.write(
    `data: ${JSON.stringify({
      id: "chatcmpl_stream_foundation_test",
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model: model ?? "test-model",
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: "stop"
        }
      ],
      usage: {
        prompt_tokens: 3,
        completion_tokens: 3,
        total_tokens: 6
      }
    })}\n\n`
  );
  response.end("data: [DONE]\n\n");
};

const handleEmbeddingRequest = (
  request: IncomingMessage,
  response: ServerResponse,
  requests: unknown[]
): void => {
  let body = "";
  request.setEncoding("utf8");
  request.on("data", (chunk) => {
    body += chunk;
  });
  request.on("end", () => {
    const parsed = JSON.parse(body) as {
      readonly model?: string;
      readonly input?: string | readonly string[];
      readonly dimensions?: number;
    };
    requests.push(parsed);
    const inputs = Array.isArray(parsed.input) ? parsed.input : [parsed.input ?? ""];
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        object: "list",
        model: parsed.model ?? "test-embedding-model",
        data: inputs.map((input, index) => ({
          object: "embedding",
          index,
          embedding: vectorForText(String(input), parsed.dimensions ?? 4)
        })),
        usage: {
          prompt_tokens: inputs.length * 3,
          total_tokens: inputs.length * 3
        }
      })
    );
  });
};

const vectorForText = (text: string, dimensions: number): readonly number[] => {
  const base = [...text].reduce((sum, char) => sum + char.charCodeAt(0), 0) || 1;
  return Array.from({ length: dimensions }, (_, index) =>
    Number(((base + index) / 1000).toFixed(6))
  );
};

const closeServer = (server: Server): Promise<void> =>
  new Promise((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) {
        resolve();
        return;
      }
      reject(error);
    });
  });
