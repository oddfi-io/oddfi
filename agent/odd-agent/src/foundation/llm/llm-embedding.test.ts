import { describe, expect, it } from "vitest";
import { InMemoryLogger } from "../logger/logger-component.js";
import { startOpenAiCompatibleTestServer } from "../testing/openai-compatible-test-server.js";
import { OpenAiLlmEmbeddingComponent } from "./llm-embedding.js";

const initTestEmbedding = async (
  embedding: OpenAiLlmEmbeddingComponent,
  baseUrl: string,
  logger = new InMemoryLogger()
): Promise<InMemoryLogger> => {
  await embedding.init(
    {
      baseUrl,
      apiKeySecretRef: "TEST_EMBEDDING_KEY",
      model: "foundation-test-embedding",
      dimensions: 4,
      timeoutMs: 5_000,
      maxRetries: 0
    },
    {
      logger,
      secretProvider: { getSecret: () => Promise.resolve("test-key") }
    }
  );
  return logger;
};

describe("OpenAiLlmEmbeddingComponent", () => {
  it("embeds one text with configured model and dimensions", async () => {
    const server = await startOpenAiCompatibleTestServer();
    const logger = new InMemoryLogger();
    const embedding = new OpenAiLlmEmbeddingComponent();
    try {
      await initTestEmbedding(embedding, server.baseUrl, logger);
      const vector = await embedding.embeddings.embedText("hello embeddings");

      expect(vector).toHaveLength(4);
      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]).toMatchObject({
        model: "foundation-test-embedding",
        input: ["hello embeddings"],
        dimensions: 4
      });
      expect(
        logger.entries.some(
          (entry) => entry.event === "foundation.llm_embedding.embedding_succeeded"
        )
      ).toBe(true);
    } finally {
      await embedding.close();
      await server.close();
    }
  });

  it("embeds a batch and keeps provider index order", async () => {
    const server = await startOpenAiCompatibleTestServer();
    const embedding = new OpenAiLlmEmbeddingComponent();
    try {
      await initTestEmbedding(embedding, server.baseUrl);
      const vectors = await embedding.embeddings.embedTexts(["first", "second"], {
        user: "user_1",
        dimensions: 3
      });

      expect(vectors).toHaveLength(2);
      expect(vectors[0]).toHaveLength(3);
      expect(vectors[1]).toHaveLength(3);
      expect(server.requests[0]).toMatchObject({
        model: "foundation-test-embedding",
        input: ["first", "second"],
        dimensions: 3,
        user: "user_1"
      });
    } finally {
      await embedding.close();
      await server.close();
    }
  });

  it("passes raw OpenAI embeddings.create params through unchanged", async () => {
    const server = await startOpenAiCompatibleTestServer();
    const embedding = new OpenAiLlmEmbeddingComponent();
    try {
      await initTestEmbedding(embedding, server.baseUrl);
      const response = await embedding.embeddings.create({
        model: embedding.embeddings.model,
        input: "raw embedding call",
        dimensions: 2,
        encoding_format: "float"
      });

      expect(response.data[0]?.embedding).toHaveLength(2);
      expect(server.requests[0]).toMatchObject({
        model: "foundation-test-embedding",
        input: "raw embedding call",
        dimensions: 2,
        encoding_format: "float"
      });
    } finally {
      await embedding.close();
      await server.close();
    }
  });

  it("exposes raw OpenAI client embeddings API", async () => {
    const server = await startOpenAiCompatibleTestServer();
    const embedding = new OpenAiLlmEmbeddingComponent();
    try {
      await initTestEmbedding(embedding, server.baseUrl);
      const response = await embedding.client.embeddings.create({
        model: "foundation-test-embedding",
        input: "raw sdk embeddings",
        dimensions: 2,
        encoding_format: "float"
      });

      expect(response.data[0]?.embedding).toHaveLength(2);
    } finally {
      await embedding.close();
      await server.close();
    }
  });

  it("rejects missing logger and empty text", async () => {
    const embedding = new OpenAiLlmEmbeddingComponent();
    await expect(
      embedding.init({
        apiKeySecretRef: "TEST_EMBEDDING_KEY",
        model: "model",
        timeoutMs: 1_000,
        maxRetries: 0
      })
    ).rejects.toThrow(/requires logger/);

    const server = await startOpenAiCompatibleTestServer();
    try {
      await initTestEmbedding(embedding, server.baseUrl);
      await expect(embedding.embeddings.embedText("   ")).rejects.toThrow(
        /embedding text is empty/
      );
    } finally {
      await embedding.close();
      await server.close();
    }
  });

  it("reports unhealthy before init", async () => {
    const embedding = new OpenAiLlmEmbeddingComponent();
    await expect(embedding.healthCheck()).resolves.toMatchObject({ status: "unhealthy" });
  });
});
