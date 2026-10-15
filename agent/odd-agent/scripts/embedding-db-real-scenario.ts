import { randomUUID } from "node:crypto";
import { FoundationDb } from "../src/foundation/db/db-component.js";
import { FoundationEmbeddingDb } from "../src/foundation/embedding-db/embedding-db-component.js";
import { PgVectorEmbeddingDbProvider } from "../src/foundation/embedding-db/embedding-db-provider-pgvector.js";
import { InMemoryLogger } from "../src/foundation/logger/logger-component.js";

const postgresUrl =
  process.env["ODD_AGENT_TEST_DATABASE_URL"] ??
  "postgres://odd_agent:odd_agent@127.0.0.1:55432/odd_agent";

type CheckResult = {
  readonly name: string;
  readonly ok: boolean;
  readonly details: Readonly<Record<string, unknown>>;
};

type TestMetadata = {
  readonly source: "tweet" | "note";
  readonly topic: string;
  readonly nested: {
    readonly league: string;
    readonly season: number;
  };
  readonly userId: string;
};

const main = async (): Promise<void> => {
  const startedAt = Date.now();
  const collectionName = `emb_real_${Date.now()}_${randomUUID().replaceAll("-", "").slice(0, 6)}`;
  const logger = new InMemoryLogger();
  await logger.init({
    level: "debug",
    output: "stdout",
    redactKeys: ["apiKey", "api_key", "authorization", "password", "token"]
  });

  const db = new FoundationDb();
  const embeddingDb = new FoundationEmbeddingDb();
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
    await embeddingDb.init(
      {
        collectionName,
        dimension: 3,
        distance: "cosine",
        topKDefault: 2,
        maxContentBytes: 256,
        maxMetadataBytes: 512
      },
      {
        logger,
        provider: new PgVectorEmbeddingDbProvider({ connectionStringSecretRef: "DATABASE_URL" }),
        secretProvider: { getSecret: () => Promise.resolve(postgresUrl) }
      }
    );

    checks.push(await checkPhysicalSchema(db, collectionName));
    checks.push(await checkTenantIsolationAndRanking(embeddingDb));
    checks.push(await checkValidationGuards(embeddingDb));
    checks.push(await checkScopedDeletion(embeddingDb));
    checks.push(await checkDimensionFailFast(collectionName, logger));
  } finally {
    await embeddingDb.close();
    await db.query({ text: `DROP TABLE IF EXISTS ${collectionName}` }).catch(() => undefined);
    await db.close();
  }

  const summary = {
    ok: checks.every((check) => check.ok),
    duration_ms: Date.now() - startedAt,
    collection_name: collectionName,
    postgres: postgresUrl.replace(/:[^:@/]+@/u, ":***@"),
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

const checkPhysicalSchema = async (
  db: FoundationDb,
  collectionName: string
): Promise<CheckResult> => {
  const primaryKey = await db.query<{ readonly constraint_name: string }>({
    text: `SELECT tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      WHERE tc.table_name = $1
        AND tc.constraint_type = 'PRIMARY KEY'
      GROUP BY tc.constraint_name
      HAVING array_agg(kcu.column_name::text ORDER BY kcu.ordinal_position) = ARRAY['user_id', 'id']`,
    values: [collectionName]
  });
  const indexes = await db.query<{ readonly indexname: string; readonly indexdef: string }>({
    text: `SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = current_schema()
        AND tablename = $1
      ORDER BY indexname`,
    values: [collectionName]
  });
  const indexDefs = indexes.rows.map((row) => row.indexdef);
  const hasHnsw = indexDefs.some((definition) => definition.includes("USING hnsw"));
  const hasGinMetadata = indexDefs.some(
    (definition) =>
      definition.includes("USING gin") && definition.includes("metadata jsonb_path_ops")
  );
  const hasUserCreated = indexDefs.some(
    (definition) => definition.includes("user_id") && definition.includes("created_at")
  );
  return {
    name: "pgvector_physical_schema",
    ok: primaryKey.rowCount === 1 && hasHnsw && hasGinMetadata && hasUserCreated,
    details: {
      primary_key_ok: primaryKey.rowCount === 1,
      has_hnsw_index: hasHnsw,
      has_metadata_gin_index: hasGinMetadata,
      has_user_created_index: hasUserCreated,
      indexes: indexes.rows.map((row) => row.indexname)
    }
  };
};

const checkTenantIsolationAndRanking = async (
  embeddingDb: FoundationEmbeddingDb
): Promise<CheckResult> => {
  await embeddingDb.upsert({
    traceId: "trace_embedding_real_upsert_a",
    userId: "user_a",
    id: "same_id",
    vector: [1, 0, 0],
    content: "user a premier tweet",
    metadata: metadata("tweet", "football")
  });
  await embeddingDb.upsert({
    traceId: "trace_embedding_real_upsert_b",
    userId: "user_b",
    id: "same_id",
    vector: [1, 0, 0],
    content: "user b premier tweet",
    metadata: metadata("tweet", "football")
  });
  await embeddingDb.upsert({
    userId: "user_a",
    id: "far_tweet",
    vector: [0, 1, 0],
    content: "user a far tweet",
    metadata: metadata("tweet", "football")
  });
  await embeddingDb.upsert({
    userId: "user_a",
    id: "note_doc",
    vector: [0, 0, 1],
    content: "user a note",
    metadata: metadata("note", "football")
  });

  const userA = await embeddingDb.search<
    { readonly source: "tweet"; readonly nested: { readonly league: string } },
    TestMetadata
  >({
    traceId: "trace_embedding_real_search_a",
    userId: "user_a",
    vector: [1, 0, 0],
    filter: { source: "tweet", nested: { league: "premier" } }
  });
  const userB = await embeddingDb.search<{ readonly source: "tweet" }, TestMetadata>({
    userId: "user_b",
    vector: [1, 0, 0],
    filter: { source: "tweet" },
    topK: 5
  });
  return {
    name: "tenant_isolation_composite_pk_and_ranking",
    ok:
      userA.length === 2 &&
      userA[0]?.id === "same_id" &&
      userA.every((item) => item.metadata.userId === "user_a") &&
      userB.length === 1 &&
      userB[0]?.content === "user b premier tweet" &&
      typeof userA[0]?.score === "number",
    details: {
      user_a_top_ids: userA.map((item) => item.id),
      user_a_scores: userA.map((item) => Number(item.score.toFixed(4))),
      user_b_top_ids: userB.map((item) => item.id),
      user_a_user_ids: userA.map((item) => item.metadata.userId),
      user_b_content: userB[0]?.content
    }
  };
};

const checkValidationGuards = async (embeddingDb: FoundationEmbeddingDb): Promise<CheckResult> => {
  const emptyFilterRejected = await embeddingDb
    .search({ userId: "user_a", vector: [1, 0, 0], filter: {}, topK: 1 })
    .then(() => false)
    .catch(() => true);
  const undefinedFilterRejected = await embeddingDb
    .search({
      userId: "user_a",
      vector: [1, 0, 0],
      filter: { nested: { league: undefined } },
      topK: 1
    })
    .then(() => false)
    .catch(() => true);
  const oversizedContentRejected = await embeddingDb
    .upsert({
      userId: "user_a",
      id: "too_large",
      vector: [1, 0, 0],
      content: "x".repeat(300),
      metadata: metadata("tweet", "overflow")
    })
    .then(() => false)
    .catch(() => true);
  const unsafeMetadataRejected = await embeddingDb
    .upsert({
      userId: "user_a",
      id: "unsafe_metadata",
      vector: [1, 0, 0],
      content: "unsafe",
      metadata: { source: "tweet", value: undefined }
    })
    .then(() => false)
    .catch(() => true);
  return {
    name: "validation_guards",
    ok:
      emptyFilterRejected &&
      undefinedFilterRejected &&
      oversizedContentRejected &&
      unsafeMetadataRejected,
    details: {
      empty_filter_rejected: emptyFilterRejected,
      undefined_filter_rejected: undefinedFilterRejected,
      oversized_content_rejected: oversizedContentRejected,
      unsafe_metadata_rejected: unsafeMetadataRejected
    }
  };
};

const checkScopedDeletion = async (embeddingDb: FoundationEmbeddingDb): Promise<CheckResult> => {
  const deletedUserATweets = await embeddingDb.deleteByFilter("user_a", { source: "tweet" });
  const userANotes = await embeddingDb.search<{ readonly source: "note" }, TestMetadata>({
    userId: "user_a",
    vector: [0, 0, 1],
    filter: { source: "note" },
    topK: 5
  });
  const userBTweetsBeforeDelete = await embeddingDb.search<
    { readonly source: "tweet" },
    TestMetadata
  >({
    userId: "user_b",
    vector: [1, 0, 0],
    filter: { source: "tweet" },
    topK: 5
  });
  const deletedUserB = await embeddingDb.deleteByUser("user_b");
  const userBTweetsAfterDelete = await embeddingDb.search<
    { readonly source: "tweet" },
    TestMetadata
  >({
    userId: "user_b",
    vector: [1, 0, 0],
    filter: { source: "tweet" },
    topK: 5
  });
  return {
    name: "scoped_delete_by_filter_and_user",
    ok:
      deletedUserATweets === 2 &&
      userANotes.length === 1 &&
      userBTweetsBeforeDelete.length === 1 &&
      deletedUserB === 1 &&
      userBTweetsAfterDelete.length === 0,
    details: {
      deleted_user_a_tweets: deletedUserATweets,
      user_a_note_ids: userANotes.map((item) => item.id),
      user_b_before_delete: userBTweetsBeforeDelete.map((item) => item.id),
      deleted_user_b: deletedUserB,
      user_b_after_delete: userBTweetsAfterDelete.length
    }
  };
};

const checkDimensionFailFast = async (
  collectionName: string,
  logger: InMemoryLogger
): Promise<CheckResult> => {
  const mismatched = new FoundationEmbeddingDb();
  const rejected = await mismatched
    .init(
      {
        collectionName,
        dimension: 4,
        distance: "cosine",
        topKDefault: 1
      },
      {
        logger,
        provider: new PgVectorEmbeddingDbProvider({ connectionStringSecretRef: "DATABASE_URL" }),
        secretProvider: { getSecret: () => Promise.resolve(postgresUrl) }
      }
    )
    .then(() => false)
    .catch(() => true)
    .finally(async () => {
      await mismatched.close();
    });
  return {
    name: "dimension_change_fail_fast",
    ok: rejected,
    details: {
      rejected
    }
  };
};

const metadata = (source: "tweet" | "note", topic: string): Omit<TestMetadata, "userId"> => ({
  source,
  topic,
  nested: { league: "premier", season: 2026 }
});

const summarizeLogEvents = (events: readonly string[]): Readonly<Record<string, number>> => {
  const counts: Record<string, number> = {};
  for (const event of events) {
    counts[event] = (counts[event] ?? 0) + 1;
  }
  return counts;
};

await main();
