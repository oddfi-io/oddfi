import { describe, expect, it } from "vitest";
import { FoundationEmbeddingDb } from "../embedding-db/embedding-db-component.js";
import { MemoryEmbeddingDbProvider } from "../embedding-db/embedding-db-provider-memory.js";
import type { OpenAiChatCompletionClient } from "../llm/llm-component.js";
import type { OpenAiEmbeddingClient } from "../llm/llm-embedding.js";
import { InMemoryLogger } from "../logger/logger-component.js";
import { MemoryComponent } from "./memory-component.js";

const embeddingDimension = 512;

describe.runIf(process.env["ODD_AGENT_MEMORY_E2E"] === "1")("MemoryComponent E2E", () => {
  it("writes, searches, updates, and deletes long-term memories through memory-backed EmbeddingDb", async () => {
    const logger = new InMemoryLogger();
    const collectionName = `memory_vectors_${Date.now()}`;
    const embeddingDb = new FoundationEmbeddingDb();
    const memory = new MemoryComponent();
    try {
      await memory.init(
        {
          embeddingCollectionName: collectionName,
          embeddingDimension,
          embeddingDistance: "cosine",
          defaultTopK: 4,
          maxPageSize: 20,
          minCandidateConfidence: 0.55,
          minDiffConfidence: 0.55,
          semanticKeys: {
            profile: ["profile.*"],
            preference: ["preference.*"],
            current_state: ["current_state.*"],
            event: ["event.*"],
            project_state: ["project_state.*"]
          },
          promptDir: "prompts"
        },
        {
          embeddingDb,
          embeddingDbProvider: new MemoryEmbeddingDbProvider(),
          llm: new MemoryE2eLlm(),
          llmEmbedding: new MemoryE2eEmbedding(embeddingDimension),
          logger
        }
      );
      const userId = `user_memory_${Date.now()}`;
      const added = await memory.write({
        traceId: "trace_memory_e2e",
        userId,
        conversationId: "conv_memory_1",
        message: "我主要写 Rust。"
      });
      expect(added[0]?.action).toBe("ADD");

      const searched = await memory.search({
        traceId: "trace_memory_e2e",
        userId,
        query: "user programming language",
        topK: 3
      });
      expect(searched[0]?.text).toContain("Rust");

      const listed = await memory.list({ userId, filters: { semanticKeys: ["profile.language"] } });
      expect(listed).toHaveLength(1);

      await memory.delete({ userId, memoryId: listed[0]?.id ?? "", reason: "e2e cleanup" });
      const afterDelete = await memory.search({ userId, query: "Rust", topK: 3 });
      expect(afterDelete).toHaveLength(0);
      expect(logger.entries.some((entry) => entry.event === "memory.write_succeeded")).toBe(true);
    } finally {
      await embeddingDb.close();
    }
  });
});

class MemoryE2eLlm {
  readonly model = "memory-e2e";
  readonly temperature = 0;
  #diffCalls = 0;

  stream(): never {
    throw new Error("stream is not used by MemoryComponent E2E tests");
  }

  create(command: Parameters<OpenAiChatCompletionClient["create"]>[0]) {
    const schemaName =
      command.response_format?.type === "json_schema"
        ? command.response_format.json_schema.name
        : "";
    if (schemaName === "MemoryCandidateExtraction") {
      const jsonPayload = {
        candidates: [
          {
            text: "用户主要写 Rust。",
            type: "profile",
            semantic_key: "profile.language",
            subject: "用户",
            predicate: "writes",
            object: "Rust",
            polarity: "positive",
            confidence: 0.91,
            importance: 4,
            reason: "user said they write Rust",
            metadata: { tags: ["coding"], llmConfidence: 0.91 }
          }
        ]
      };
      return Promise.resolve(openAiCompletion(JSON.stringify(jsonPayload)));
    }
    this.#diffCalls += 1;
    const jsonPayload = {
      action: this.#diffCalls === 1 ? "ADD" : "NOOP",
      target_id: null,
      new_memory: null,
      reason: "e2e deterministic diff",
      confidence: 0.88
    };
    return Promise.resolve(openAiCompletion(JSON.stringify(jsonPayload)));
  }
}

class MemoryE2eEmbedding implements OpenAiEmbeddingClient {
  readonly model = "memory-e2e-embedding";
  readonly dimensions: number;

  constructor(dimensions: number) {
    this.dimensions = dimensions;
  }

  create(): never {
    throw new Error("raw embedding create is not used by MemoryComponent E2E tests");
  }

  embedText(_text: string, options?: { readonly dimensions?: number }): Promise<readonly number[]> {
    const dimension = options?.dimensions ?? this.dimensions;
    return Promise.resolve(
      Array.from({ length: dimension }, (_value, index) => (index === 0 ? 1 : 0))
    );
  }

  embedTexts(): never {
    throw new Error("batch embedding is not used by MemoryComponent E2E tests");
  }
}

const openAiCompletion = (content: string) => ({
  id: "chatcmpl_memory_e2e",
  object: "chat.completion" as const,
  created: 0,
  model: "memory-e2e",
  choices: [
    {
      index: 0,
      message: { role: "assistant" as const, content, refusal: null },
      finish_reason: "stop" as const,
      logprobs: null
    }
  ],
  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
});
