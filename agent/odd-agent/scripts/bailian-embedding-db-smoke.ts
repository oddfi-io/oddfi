import { randomUUID } from "node:crypto";
import { FoundationDb } from "../src/foundation/db/db-component.js";
import { FoundationEmbeddingDb } from "../src/foundation/embedding-db/embedding-db-component.js";
import { PgVectorEmbeddingDbProvider } from "../src/foundation/embedding-db/embedding-db-provider-pgvector.js";
import { OpenAiLlmEmbeddingComponent } from "../src/foundation/llm/llm-embedding.js";
import { InMemoryLogger } from "../src/foundation/logger/logger-component.js";

const bailianApiKey = process.env["BAILIAN_API_KEY"] ?? process.env["DASHSCOPE_API_KEY"];
const bailianBaseUrl =
  process.env["BAILIAN_BASE_URL"] ?? "https://dashscope.aliyuncs.com/compatible-mode/v1";
const bailianEmbeddingModel = process.env["BAILIAN_EMBEDDING_MODEL"] ?? "text-embedding-v4";
const postgresUrl =
  process.env["ODD_AGENT_TEST_DATABASE_URL"] ??
  "postgres://odd_agent:odd_agent@127.0.0.1:55432/odd_agent";

if (bailianApiKey === undefined || bailianApiKey.length === 0) {
  throw new Error("BAILIAN_API_KEY or DASHSCOPE_API_KEY is required");
}

type SmokeMetadata = {
  readonly memoryComponent: "bailian_smoke";
  readonly memoryId: string;
  readonly topic: "database" | "dessert";
};

const main = async (): Promise<void> => {
  const startedAt = Date.now();
  const runId = randomUUID().replaceAll("-", "").slice(0, 8);
  const userId = `user_bailian_smoke_${runId}`;
  const collectionName = `bailian_embedding_smoke_${runId}`;
  const logger = new InMemoryLogger();
  await logger.init({
    level: "debug",
    output: "stdout",
    redactKeys: ["apiKey", "api_key", "authorization", "password", "token"]
  });

  const db = new FoundationDb();
  const embeddingDb = new FoundationEmbeddingDb();
  const llmEmbedding = new OpenAiLlmEmbeddingComponent();
  const checks: Record<string, unknown> = {};

  try {
    await db.init(
      {
        provider: "postgres",
        connectionStringSecretRef: "DATABASE_URL",
        maxPoolSize: 2,
        statementTimeoutMs: 30_000,
        idleTimeoutMs: 5_000,
        ssl: false
      },
      { logger, secretProvider: { getSecret: () => Promise.resolve(postgresUrl) } }
    );

    await llmEmbedding.init(
      {
        baseUrl: bailianBaseUrl,
        apiKeySecretRef: "BAILIAN_API_KEY",
        model: bailianEmbeddingModel,
        dimensions: 512,
        timeoutMs: 60_000,
        maxRetries: 0,
        encodingFormat: "float"
      },
      { logger, secretProvider: { getSecret: () => Promise.resolve(bailianApiKey) } }
    );

    await embeddingDb.init(
      {
        collectionName,
        dimension: 512,
        distance: "cosine",
        topKDefault: 3,
        maxContentBytes: 65_536,
        maxMetadataBytes: 16_384
      },
      {
        logger,
        provider: new PgVectorEmbeddingDbProvider({ connectionStringSecretRef: "DATABASE_URL" }),
        secretProvider: { getSecret: () => Promise.resolve(postgresUrl) }
      }
    );

    const insertVector = await llmEmbedding.embeddings.embedText(
      "odd_agent uses Supabase pgvector for memory search"
    );
    const dessertVector = await llmEmbedding.embeddings.embedText("mango coconut dessert recipe");
    const queryVector = await llmEmbedding.embeddings.embedText(
      "Supabase vector database memory retrieval"
    );

    await embeddingDb.upsert<SmokeMetadata>({
      traceId: "trace_bailian_embedding_smoke",
      userId,
      id: "memory_database",
      vector: insertVector,
      content: "odd_agent uses Supabase pgvector for memory search",
      metadata: {
        memoryComponent: "bailian_smoke",
        memoryId: "memory_database",
        topic: "database"
      }
    });

    await embeddingDb.upsert<SmokeMetadata>({
      traceId: "trace_bailian_embedding_smoke",
      userId,
      id: "memory_dessert",
      vector: dessertVector,
      content: "mango coconut dessert recipe",
      metadata: {
        memoryComponent: "bailian_smoke",
        memoryId: "memory_dessert",
        topic: "dessert"
      }
    });

    const afterInsert = await embeddingDb.search<
      { readonly memoryComponent: "bailian_smoke" },
      SmokeMetadata
    >({
      traceId: "trace_bailian_embedding_smoke",
      userId,
      vector: queryVector,
      filter: { memoryComponent: "bailian_smoke" },
      topK: 2
    });
    checks["insert_query_top_id"] = afterInsert[0]?.id;

    const updatedVector = await llmEmbedding.embeddings.embedText(
      "odd_agent stores long term memory vectors in PostgreSQL pgvector"
    );
    await embeddingDb.upsert<SmokeMetadata>({
      traceId: "trace_bailian_embedding_smoke",
      userId,
      id: "memory_database",
      vector: updatedVector,
      content: "odd_agent stores long term memory vectors in PostgreSQL pgvector",
      metadata: {
        memoryComponent: "bailian_smoke",
        memoryId: "memory_database",
        topic: "database"
      }
    });

    const afterUpdate = await embeddingDb.search<
      { readonly memoryId: "memory_database" },
      SmokeMetadata
    >({
      traceId: "trace_bailian_embedding_smoke",
      userId,
      vector: updatedVector,
      filter: { memoryId: "memory_database" },
      topK: 1
    });
    checks["updated_content"] = afterUpdate[0]?.content;

    const deleted = await embeddingDb.deleteByFilter(userId, { memoryId: "memory_database" });
    const afterDelete = await embeddingDb.search<
      { readonly memoryComponent: "bailian_smoke" },
      SmokeMetadata
    >({
      traceId: "trace_bailian_embedding_smoke",
      userId,
      vector: queryVector,
      filter: { memoryComponent: "bailian_smoke" },
      topK: 3
    });
    checks["deleted_count"] = deleted;
    checks["remaining_ids"] = afterDelete.map((result) => result.id);

    const remainingDeleted = await embeddingDb.deleteByUser(userId);
    checks["cleanup_delete_by_user_count"] = remainingDeleted;

    const tableRows = await db.query<{ readonly total: string }>({
      text: `SELECT count(*) AS total FROM ${collectionName}`
    });
    checks["rows_before_drop"] = Number(tableRows.rows[0]?.total ?? 0);

    const ok =
      afterInsert[0]?.id === "memory_database" &&
      afterUpdate[0]?.content ===
        "odd_agent stores long term memory vectors in PostgreSQL pgvector" &&
      deleted === 1 &&
      afterDelete.every((result) => result.id !== "memory_database") &&
      remainingDeleted === 1 &&
      Number(tableRows.rows[0]?.total ?? 0) === 0;

    process.stdout.write(
      `${JSON.stringify(
        {
          ok,
          duration_ms: Date.now() - startedAt,
          collection_name: collectionName,
          embedding_base_url: bailianBaseUrl,
          embedding_model: bailianEmbeddingModel,
          embedding_dimension: insertVector.length,
          log_events: summarizeLogEvents(
            logger.entries.flatMap((entry) =>
              typeof entry.event === "string" ? [entry.event] : []
            )
          ),
          checks
        },
        null,
        2
      )}\n`
    );
    if (!ok) {
      process.exitCode = 1;
    }
  } finally {
    await embeddingDb.close();
    await llmEmbedding.close();
    await db.query({ text: `DROP TABLE IF EXISTS ${collectionName}` }).catch(() => undefined);
    await db.close();
  }
};

const summarizeLogEvents = (events: readonly string[]): Record<string, number> =>
  events.reduce<Record<string, number>>((summary, event) => {
    summary[event] = (summary[event] ?? 0) + 1;
    return summary;
  }, {});

await main();
