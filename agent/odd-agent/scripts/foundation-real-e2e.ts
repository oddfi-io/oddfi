import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { z } from "zod";
import { FoundationDb } from "../src/foundation/db/db-component.js";
import { FoundationEmbeddingDb } from "../src/foundation/embedding-db/embedding-db-component.js";
import { PgVectorEmbeddingDbProvider } from "../src/foundation/embedding-db/embedding-db-provider-pgvector.js";
import { OpenAiLlmComponent } from "../src/foundation/llm/llm-component.js";
import { InMemoryLogger } from "../src/foundation/logger/logger-component.js";
import { FoundationRedis } from "../src/foundation/redis/redis-component.js";
import { loadOddAgentConfig } from "../src/infrastructure/config/load-odd-agent-config.js";

const workspaceRoot = resolve(new URL("..", import.meta.url).pathname);
const postgresUrl =
  process.env["ODD_AGENT_TEST_DATABASE_URL"] ??
  "postgres://odd_agent:odd_agent@127.0.0.1:55432/odd_agent";
const redisUrl = process.env["ODD_AGENT_TEST_REDIS_URL"] ?? "redis://127.0.0.1:56379";
const ollamaBaseUrl = process.env["OLLAMA_BASE_URL"] ?? "http://127.0.0.1:11434";
const ollamaEmbeddingModel = process.env["OLLAMA_EMBEDDING_MODEL"] ?? "all-minilm:latest";
const minimaxBaseUrl = process.env["MINIMAX_BASE_URL"] ?? "https://api.minimaxi.com/v1";
const minimaxModel = process.env["MINIMAX_MODEL"] ?? "MiniMax-M2.7";

type CheckResult = {
  readonly name: string;
  readonly ok: boolean;
  readonly details: Readonly<Record<string, unknown>>;
};

const ollamaEmbeddingResponseSchema = z.object({
  embedding: z.array(z.number())
});

const main = async (): Promise<void> => {
  const startedAt = Date.now();
  const config = await loadOddAgentConfig(workspaceRoot);
  const minimaxApiKey =
    process.env["MINIMAX_API_KEY"] ?? config.localSecrets?.[config.userTag.llm.apiKeySecretRef];
  if (minimaxApiKey === undefined || minimaxApiKey.length === 0) {
    throw new Error(
      "MINIMAX_API_KEY is required or must exist in config/odd-agent.yaml localSecrets"
    );
  }

  const logger = new InMemoryLogger();
  await logger.init({
    level: "debug",
    output: "stdout",
    redactKeys: ["apiKey", "api_key", "authorization", "password", "token"]
  });

  const db = new FoundationDb();
  const redis = new FoundationRedis();
  const embeddingDb = new FoundationEmbeddingDb();
  const llm = new OpenAiLlmComponent();
  const runId = `foundation_e2e_${Date.now()}_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
  const sqlTableName = `${runId}_sql`;
  const vectorCollectionName = `${runId}_vec`;

  const checks: CheckResult[] = [];
  try {
    await db.init(
      {
        provider: "postgres",
        connectionStringSecretRef: "DATABASE_URL",
        maxPoolSize: 3,
        statementTimeoutMs: 10_000,
        idleTimeoutMs: 5_000,
        ssl: false
      },
      { logger, secretProvider: { getSecret: () => Promise.resolve(postgresUrl) } }
    );
    checks.push(await runDbCrudAndFuzz(db, sqlTableName));

    await redis.init(
      {
        urlSecretRef: "REDIS_URL",
        keyPrefix: runId,
        commandTimeoutMs: 2_000,
        maxRetries: 1,
        defaultTtlSeconds: 120
      },
      { logger, secretProvider: { getSecret: () => Promise.resolve(redisUrl) } }
    );
    checks.push(await runRedisCrudAndFuzz(redis));

    await llm.init(
      {
        baseUrl: minimaxBaseUrl,
        apiKeySecretRef: "MINIMAX_API_KEY",
        model: minimaxModel,
        modelTier: "standard",
        temperature: 0,
        timeoutMs: 45_000,
        maxRetries: 0,
        logMessages: false
      },
      { logger, secretProvider: { getSecret: () => Promise.resolve(minimaxApiKey) } }
    );
    checks.push(await runMiniMaxRealCall(llm));

    const seedVector = await embedWithOllama("Redis stores cache data");
    await embeddingDb.init(
      {
        collectionName: vectorCollectionName,
        dimension: seedVector.length,
        distance: "cosine",
        topKDefault: 5
      },
      {
        logger,
        provider: new PgVectorEmbeddingDbProvider({ connectionStringSecretRef: "DATABASE_URL" }),
        secretProvider: { getSecret: () => Promise.resolve(postgresUrl) }
      }
    );
    checks.push(await runEmbeddingDbOllamaE2e(embeddingDb, seedVector));
  } finally {
    await embeddingDb.close();
    await llm.close();
    await redis.close();
    await db.query({ text: `DROP TABLE IF EXISTS ${vectorCollectionName}` }).catch(() => undefined);
    await db.query({ text: `DROP TABLE IF EXISTS ${sqlTableName}` }).catch(() => undefined);
    await db.close();
  }

  const summary = {
    ok: checks.every((check) => check.ok),
    duration_ms: Date.now() - startedAt,
    services: {
      postgres: postgresUrl.replace(/:[^:@/]+@/u, ":***@"),
      redis: redisUrl,
      minimax_base_url: minimaxBaseUrl,
      minimax_model: minimaxModel,
      ollama_base_url: ollamaBaseUrl,
      ollama_embedding_model: ollamaEmbeddingModel
    },
    checks,
    log_events: summarizeLogEvents(
      logger.entries.flatMap((entry) => (typeof entry.event === "string" ? [entry.event] : []))
    )
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (!summary.ok) {
    process.exitCode = 1;
  }
};

const runDbCrudAndFuzz = async (db: FoundationDb, tableName: string): Promise<CheckResult> => {
  await db.query({
    text: `CREATE TABLE ${tableName} (
      id serial PRIMARY KEY,
      label text NOT NULL,
      payload jsonb NOT NULL,
      counter int NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    )`
  });
  const labels = ["plain", "unicode-你好", "quote-'--", "json-{nested}", "long-" + "x".repeat(128)];
  const inserted: number[] = [];
  for (const [index, label] of labels.entries()) {
    const result = await db.query<{ readonly id: number }>({
      text: `INSERT INTO ${tableName} (label, payload, counter) VALUES ($1, $2::jsonb, $3) RETURNING id`,
      values: [label, JSON.stringify({ index, tags: ["db", "fuzz"], nested: { ok: true } }), index]
    });
    const id = result.rows[0]?.id;
    if (id === undefined) {
      throw new Error("insert did not return id");
    }
    inserted.push(id);
  }
  const selected = await db.query<{ readonly total: string; readonly max_counter: number }>({
    text: `SELECT count(*) AS total, max(counter) AS max_counter FROM ${tableName}`
  });
  await db.query({
    text: `UPDATE ${tableName} SET counter = counter + 10 WHERE label LIKE $1`,
    values: ["unicode%"]
  });
  const updated = await db.query<{ readonly counter: number }>({
    text: `SELECT counter FROM ${tableName} WHERE label = $1`,
    values: ["unicode-你好"]
  });
  await db.query({ text: `DELETE FROM ${tableName} WHERE id = $1`, values: [inserted[0]] });
  const afterDelete = await db.query<{ readonly total: string }>({
    text: `SELECT count(*) AS total FROM ${tableName}`
  });
  const rollbackOk = await db
    .transaction(async (tx) => {
      await tx.query(
        `INSERT INTO ${tableName} (label, payload, counter) VALUES ($1, $2::jsonb, $3)`,
        ["rollback", JSON.stringify({ rollback: true }), 999]
      );
      throw new Error("intentional rollback");
    })
    .then(() => false)
    .catch(() => true);
  const rollbackRows = await db.query<{ readonly total: string }>({
    text: `SELECT count(*) AS total FROM ${tableName} WHERE label = $1`,
    values: ["rollback"]
  });
  const ok =
    Number(selected.rows[0]?.total) === labels.length &&
    updated.rows[0]?.counter === 11 &&
    Number(afterDelete.rows[0]?.total) === labels.length - 1 &&
    rollbackOk &&
    Number(rollbackRows.rows[0]?.total) === 0;
  return {
    name: "docker_postgres_sql_crud_fuzz",
    ok,
    details: {
      inserted: inserted.length,
      selected_total: Number(selected.rows[0]?.total),
      updated_unicode_counter: updated.rows[0]?.counter,
      after_delete_total: Number(afterDelete.rows[0]?.total),
      rollback_ok: rollbackOk
    }
  };
};

const runRedisCrudAndFuzz = async (redis: FoundationRedis): Promise<CheckResult> => {
  const key = "crud:item";
  const listKey = "crud:list";
  const payload = {
    text: "redis-你好-'--",
    count: 1,
    nested: { ok: true, values: [1, 2, 3] }
  };
  const created = await redis.set(key, payload, { nx: true, ttlSeconds: 120 });
  const nxBlocked = await redis.set(key, { overwritten: true }, { nx: true });
  const fetched = await redis.get<typeof payload>(key);
  const updated = await redis.set(key, { ...payload, count: 2 });
  const updatedFetched = await redis.get<typeof payload>(key);
  const listLength = await redis.lpush(listKey, [{ id: 1 }, { id: 2 }, { id: 3 }]);
  const list = await redis.lrange<{ readonly id: number }>(listKey, 0, 2);
  await redis.ltrim(listKey, 0, 1);
  const trimmed = await redis.lrange<{ readonly id: number }>(listKey, 0, 9);
  const deleted = await redis.del(key);
  await redis.del(listKey);
  const ok =
    created &&
    !nxBlocked &&
    fetched?.text === payload.text &&
    updated &&
    updatedFetched?.count === 2 &&
    listLength === 3 &&
    list.map((item) => item.id).join(",") === "3,2,1" &&
    trimmed.length === 2 &&
    deleted === 1;
  return {
    name: "docker_redis_crud_fuzz",
    ok,
    details: {
      created,
      nx_blocked: nxBlocked,
      fetched_text: fetched?.text,
      updated_count: updatedFetched?.count,
      list_order: list.map((item) => item.id),
      trimmed_length: trimmed.length,
      deleted
    }
  };
};

const runMiniMaxRealCall = async (llm: OpenAiLlmComponent): Promise<CheckResult> => {
  const startedAt = Date.now();
  const result = await llm.chatCompletions.create({
    model: llm.chatCompletions.model,
    temperature: llm.chatCompletions.temperature,
    messages: [
      {
        role: "system",
        content:
          "You are a connectivity test. Reply with a short sentence that includes FOUNDATION_LLM_OK."
      },
      {
        role: "user",
        content: "Return a short confirmation for the foundation LLM real e2e test."
      }
    ]
  });
  const content = result.choices[0]?.message.content ?? "";
  const ok = content.includes("FOUNDATION_LLM_OK") || content.trim().length > 0;
  return {
    name: "minimax_openai_sdk_real_call",
    ok,
    details: {
      model: result.model,
      duration_ms: Date.now() - startedAt,
      input_tokens: result.usage?.prompt_tokens,
      output_tokens: result.usage?.completion_tokens,
      output_preview: content.slice(0, 120)
    }
  };
};

const runEmbeddingDbOllamaE2e = async (
  embeddingDb: FoundationEmbeddingDb,
  seedVector: readonly number[]
): Promise<CheckResult> => {
  const docs = [
    { id: "redis", text: "Redis is an in-memory cache and queue database.", userId: "u1" },
    { id: "postgres", text: "PostgreSQL stores relational SQL rows.", userId: "u1" },
    { id: "other-user", text: "Redis cache from another user should be isolated.", userId: "u2" }
  ] as const;
  await embeddingDb.upsert({
    userId: docs[0].userId,
    id: docs[0].id,
    vector: seedVector,
    content: docs[0].text,
    metadata: { source: "ollama" }
  });
  for (const doc of docs.slice(1)) {
    await embeddingDb.upsert({
      userId: doc.userId,
      id: doc.id,
      vector: await embedWithOllama(doc.text),
      content: doc.text,
      metadata: { source: "ollama" }
    });
  }
  const queryVector = await embedWithOllama("cache queue memory database");
  const results = await embeddingDb.search<
    { readonly source: string },
    { readonly userId: string; readonly source: string }
  >({
    userId: "u1",
    vector: queryVector,
    filter: { source: "ollama" },
    topK: 2
  });
  const emptyFilterRejected = await embeddingDb
    .search({ userId: "u1", vector: queryVector, filter: {}, topK: 1 })
    .then(() => false)
    .catch(() => true);
  const deleted = await embeddingDb.deleteByFilter("u1", { source: "ollama" });
  const ok =
    results.length === 2 &&
    results.every((item) => item.metadata.userId === "u1") &&
    results.some((item) => item.id === "redis") &&
    emptyFilterRejected &&
    deleted === 2;
  return {
    name: "ollama_embedding_pgvector_crud_fuzz",
    ok,
    details: {
      dimension: seedVector.length,
      top_ids: results.map((item) => item.id),
      top_scores: results.map((item) => Number(item.score.toFixed(4))),
      empty_filter_rejected: emptyFilterRejected,
      deleted
    }
  };
};

const embedWithOllama = async (prompt: string): Promise<readonly number[]> => {
  const response = await fetch(`${ollamaBaseUrl}/api/embeddings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: ollamaEmbeddingModel, prompt })
  });
  if (!response.ok) {
    throw new Error(`Ollama embedding failed: HTTP ${response.status} ${await response.text()}`);
  }
  const parsed = ollamaEmbeddingResponseSchema.parse(await response.json());
  if (parsed.embedding.length === 0) {
    throw new Error("Ollama returned an empty embedding");
  }
  return parsed.embedding;
};

const summarizeLogEvents = (events: readonly string[]): Readonly<Record<string, number>> => {
  const counts: Record<string, number> = {};
  for (const event of events) {
    counts[event] = (counts[event] ?? 0) + 1;
  }
  return counts;
};

await main();
