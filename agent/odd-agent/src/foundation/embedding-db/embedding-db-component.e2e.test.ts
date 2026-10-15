import { describe, expect, it } from "vitest";
import { InMemoryLogger } from "../logger/logger-component.js";
import { FoundationEmbeddingDb } from "./embedding-db-component.js";
import { PgVectorEmbeddingDbProvider } from "./embedding-db-provider-pgvector.js";

const databaseUrl =
  process.env["ODD_AGENT_TEST_DATABASE_URL"] ??
  "postgres://odd_agent:odd_agent@127.0.0.1:55432/odd_agent";

describe.runIf(process.env["ODD_AGENT_EMBEDDING_DB_E2E"] === "1")(
  "FoundationEmbeddingDb pgvector",
  () => {
    it("stores vectors in pgvector with metadata isolation", async () => {
      const db = new FoundationEmbeddingDb();
      await db.init(
        {
          collectionName: `foundation_vectors_${Date.now()}`,
          dimension: 3,
          distance: "cosine",
          topKDefault: 5
        },
        {
          logger: new InMemoryLogger(),
          provider: new PgVectorEmbeddingDbProvider({ connectionStringSecretRef: "DATABASE_URL" }),
          secretProvider: { getSecret: () => Promise.resolve(databaseUrl) }
        }
      );
      try {
        await db.upsert({
          userId: "u1",
          id: "near",
          vector: [1, 0, 0],
          content: "near",
          metadata: { conversationId: "c1" }
        });
        await db.upsert({
          userId: "u2",
          id: "other-user",
          vector: [1, 0, 0],
          content: "other",
          metadata: { conversationId: "c1" }
        });
        const results = await db.search<
          { readonly conversationId: string },
          { readonly userId: string; readonly conversationId: string }
        >({
          vector: [0.99, 0.01, 0],
          userId: "u1",
          filter: { conversationId: "c1" },
          topK: 5
        });

        expect(results.map((item) => item.id)).toEqual(["near"]);
        expect(await db.deleteByFilter("u1", { conversationId: "c1" })).toBe(1);
      } finally {
        await db.close();
      }
    });
  }
);
