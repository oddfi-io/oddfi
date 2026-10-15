import { describe, expect, it } from "vitest";
import { z } from "zod";
import { InMemoryLogger } from "../logger/logger-component.js";
import { startOpenAiCompatibleTestServer } from "../testing/openai-compatible-test-server.js";
import { OpenAiLlmComponent } from "./llm-component.js";

const initTestLlm = async (llm: OpenAiLlmComponent, baseUrl: string): Promise<void> => {
  await llm.init(
    {
      baseUrl,
      apiKeySecretRef: "TEST_LLM_KEY",
      model: "foundation-test-model",
      modelTier: "cheap",
      temperature: 0,
      timeoutMs: 5_000,
      maxRetries: 0
    },
    {
      logger: new InMemoryLogger(),
      secretProvider: { getSecret: () => Promise.resolve("test-key") }
    }
  );
};

describe("OpenAiLlmComponent", () => {
  it("exposes OpenAI chat.completions.create with configured model defaults", async () => {
    const server = await startOpenAiCompatibleTestServer();
    const logger = new InMemoryLogger();
    const llm = new OpenAiLlmComponent();
    try {
      await llm.init(
        {
          baseUrl: server.baseUrl,
          apiKeySecretRef: "TEST_LLM_KEY",
          model: "foundation-test-model",
          modelTier: "cheap",
          temperature: 0,
          timeoutMs: 5_000,
          maxRetries: 0
        },
        {
          logger,
          secretProvider: { getSecret: () => Promise.resolve("test-key") }
        }
      );
      const result = await llm.chatCompletions.create({
        model: llm.chatCompletions.model,
        temperature: llm.chatCompletions.temperature,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: "hello llm" }]
      });

      expect(JSON.parse(result.choices[0]?.message.content ?? "")).toEqual({
        ok: true,
        echo: "hello llm"
      });
      expect(result.model).toBe("foundation-test-model");
      expect(server.requests).toHaveLength(1);
      expect(
        logger.entries.some((entry) => entry.event === "foundation.llm.chat_completion_succeeded")
      ).toBe(true);
    } finally {
      await llm.close();
      await server.close();
    }
  });

  it("passes OpenAI json_schema response_format through unchanged", async () => {
    const server = await startOpenAiCompatibleTestServer();
    const llm = new OpenAiLlmComponent();
    try {
      await initTestLlm(llm, server.baseUrl);
      const schema = z.toJSONSchema(
        z.object({
          code: z.number(),
          msg: z.string(),
          data: z.array(z.string())
        })
      );

      const result = await llm.chatCompletions.create({
        model: llm.chatCompletions.model,
        temperature: llm.chatCompletions.temperature,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "tag_match_result",
            strict: true,
            schema
          }
        },
        messages: [{ role: "user", content: "strict tags" }]
      });

      expect(JSON.parse(result.choices[0]?.message.content ?? "")).toEqual({
        code: 0,
        msg: "匹配成功",
        data: ["Portugal", "Ronaldo"]
      });
      expect(
        (server.requests[0] as { readonly response_format?: unknown }).response_format
      ).toEqual({
        type: "json_schema",
        json_schema: {
          name: "tag_match_result",
          strict: true,
          schema
        }
      });
    } finally {
      await llm.close();
      await server.close();
    }
  });

  it("supports OpenAI tool calling request/response shape", async () => {
    const server = await startOpenAiCompatibleTestServer();
    const llm = new OpenAiLlmComponent();
    try {
      await initTestLlm(llm, server.baseUrl);
      const first = await llm.chatCompletions.create({
        model: llm.chatCompletions.model,
        temperature: llm.chatCompletions.temperature,
        messages: [{ role: "user", content: "weather with tool" }],
        tool_choice: "auto",
        tools: [
          {
            type: "function",
            function: {
              name: "get_weather",
              description: "Get current weather by city.",
              parameters: {
                type: "object",
                additionalProperties: false,
                properties: { city: { type: "string" } },
                required: ["city"]
              },
              strict: true
            }
          }
        ]
      });
      const toolCall = first.choices[0]?.message.tool_calls?.[0];
      if (toolCall?.type !== "function") {
        throw new Error("expected function tool call");
      }
      expect(toolCall.function.name).toBe("get_weather");
      expect(JSON.parse(toolCall.function.arguments)).toEqual({ city: "Shanghai" });

      const second = await llm.chatCompletions.create({
        model: llm.chatCompletions.model,
        temperature: llm.chatCompletions.temperature,
        messages: [
          { role: "user", content: "weather with tool" },
          first.choices[0]?.message ?? { role: "assistant", content: null },
          {
            role: "tool",
            tool_call_id: toolCall?.id ?? "call_weather",
            content: JSON.stringify({ city: "Shanghai", condition: "sunny" })
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "get_weather",
              parameters: { type: "object", properties: {}, additionalProperties: false }
            }
          }
        ]
      });

      expect(second.choices[0]?.message.content ?? "").toContain("Weather summary");
      expect(server.requests).toHaveLength(2);
    } finally {
      await llm.close();
      await server.close();
    }
  });

  it("passes deprecated function calling fields through for compatible providers", async () => {
    const server = await startOpenAiCompatibleTestServer();
    const llm = new OpenAiLlmComponent();
    try {
      await initTestLlm(llm, server.baseUrl);
      await llm.chatCompletions.create({
        model: llm.chatCompletions.model,
        temperature: llm.chatCompletions.temperature,
        messages: [{ role: "user", content: "hello llm" }],
        function_call: "auto",
        functions: [
          {
            name: "legacy_lookup",
            description: "Legacy function calling path.",
            parameters: {
              type: "object",
              properties: { query: { type: "string" } },
              required: ["query"]
            }
          }
        ]
      });

      expect(
        (server.requests[0] as { readonly functions?: readonly unknown[] }).functions
      ).toHaveLength(1);
      expect((server.requests[0] as { readonly function_call?: unknown }).function_call).toBe(
        "auto"
      );
    } finally {
      await llm.close();
      await server.close();
    }
  });

  it("streams OpenAI chat completion chunks", async () => {
    const server = await startOpenAiCompatibleTestServer();
    const llm = new OpenAiLlmComponent();
    try {
      await initTestLlm(llm, server.baseUrl);
      const stream = await llm.chatCompletions.stream({
        model: llm.chatCompletions.model,
        temperature: llm.chatCompletions.temperature,
        stream: true,
        stream_options: { include_usage: true },
        messages: [{ role: "user", content: "stream tokens" }]
      });
      const chunks: string[] = [];
      for await (const chunk of stream) {
        for (const choice of chunk.choices) {
          if (typeof choice.delta.content === "string") {
            chunks.push(choice.delta.content);
          }
        }
      }
      expect(chunks.join("")).toBe("Hello streaming world");
    } finally {
      await llm.close();
      await server.close();
    }
  });

  it("exposes the raw OpenAI client for direct SDK calls", async () => {
    const server = await startOpenAiCompatibleTestServer();
    const llm = new OpenAiLlmComponent();
    try {
      await initTestLlm(llm, server.baseUrl);
      const result = await llm.client.chat.completions.create({
        model: "foundation-test-model",
        messages: [{ role: "user", content: "raw sdk call" }]
      });
      expect(result.choices[0]?.message.content).toBe("raw method ok");
    } finally {
      await llm.close();
      await server.close();
    }
  });

  it("requires logger for init", async () => {
    const llm = new OpenAiLlmComponent();
    await expect(
      llm.init({
        apiKeySecretRef: "TEST_LLM_KEY",
        model: "model",
        modelTier: "cheap",
        temperature: 0,
        timeoutMs: 1000,
        maxRetries: 0
      })
    ).rejects.toThrow(/requires logger/);
  });
});
