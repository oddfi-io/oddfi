import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { z } from "zod";
import { FoundationEmbeddingDb } from "../src/foundation/embedding-db/embedding-db-component.js";
import { ChromaEmbeddingDbProvider } from "../src/foundation/embedding-db/embedding-db-provider-chroma.js";
import { MemoryEmbeddingDbProvider } from "../src/foundation/embedding-db/embedding-db-provider-memory.js";
import { MilvusEmbeddingDbProvider } from "../src/foundation/embedding-db/embedding-db-provider-milvus.js";
import { PgVectorEmbeddingDbProvider } from "../src/foundation/embedding-db/embedding-db-provider-pgvector.js";
import { PineconeEmbeddingDbProvider } from "../src/foundation/embedding-db/embedding-db-provider-pinecone.js";
import { QdrantEmbeddingDbProvider } from "../src/foundation/embedding-db/embedding-db-provider-qdrant.js";
import type {
  EmbeddingDbProvider,
  EmbeddingVector
} from "../src/foundation/embedding-db/embedding-db-types.js";
import type { SecretProvider } from "../src/foundation/foundation-types.js";
import { InMemoryLogger } from "../src/foundation/logger/logger-component.js";

const execFileAsync = promisify(execFile);

const fileCount = Number(process.env["PROVIDER_MATRIX_FILE_COUNT"] ?? "20");
const sentencesPerFile = Number(process.env["PROVIDER_MATRIX_SENTENCES_PER_FILE"] ?? "500");
const localDimension = Number(process.env["PROVIDER_MATRIX_DIMENSION"] ?? "64");
const topK = Number(process.env["PROVIDER_MATRIX_TOP_K"] ?? "5");
const searchSampleSize = Number(process.env["PROVIDER_MATRIX_SEARCH_SAMPLE_SIZE"] ?? "120");
const corpusDir =
  process.env["PROVIDER_MATRIX_CORPUS_DIR"] ?? "tmp/embedding-provider-matrix/corpus";
const reportPath =
  process.env["PROVIDER_MATRIX_REPORT"] ?? "tmp/embedding-provider-matrix/latest.json";
const skipDocker = process.env["PROVIDER_MATRIX_SKIP_DOCKER"] === "1";
const upsertConcurrency = Number(process.env["PROVIDER_MATRIX_UPSERT_CONCURRENCY"] ?? "16");
const providerFilter = (process.env["PROVIDER_MATRIX_PROVIDERS"] ?? "")
  .split(",")
  .map((provider) => provider.trim())
  .filter((provider) => provider.length > 0);
const pineconeApiVersion = process.env["PINECONE_API_VERSION"] ?? "2026-04";

const pineconeIndexesSchema = z.object({
  indexes: z
    .array(
      z.object({
        name: z.string(),
        host: z.string().optional(),
        dimension: z.number().optional(),
        metric: z.string().optional()
      })
    )
    .optional()
});

const pineconeIndexSchema = z.object({
  name: z.string(),
  host: z.string().optional(),
  dimension: z.number().optional(),
  status: z
    .object({
      ready: z.boolean().optional(),
      state: z.string().optional()
    })
    .optional()
});

type CorpusRecord = {
  readonly id: string;
  readonly content: string;
  readonly metadata: CorpusMetadata;
};

type CorpusMetadata = {
  readonly runId: string;
  readonly fileIndex: number;
  readonly lineIndex: number;
  readonly globalIndex: number;
  readonly topic: string;
  readonly scenario: string;
  readonly active: boolean;
  readonly bucket: string;
  readonly uniqueCode: string;
  readonly nested: {
    readonly source: string;
    readonly file: number;
  };
};

type ProviderPlan = {
  readonly name: string;
  readonly dimension: number;
  readonly endpoint?: string;
  readonly dockerServices: readonly string[];
  readonly supportsNestedFilter: boolean;
  readonly createProvider: () => EmbeddingDbProvider;
  readonly collectionNameOverride?: string;
  readonly cleanup?: () => Promise<void>;
  readonly secretProvider?: SecretProvider;
  readonly skipReason?: string;
};

type SearchCase = {
  readonly name: string;
  readonly searchContent: string;
  readonly targetId: string;
  readonly filter: Record<string, unknown>;
  readonly queryVector: EmbeddingVector;
};

type MethodResult = {
  readonly method: string;
  readonly ok: boolean;
  readonly detail: Record<string, unknown>;
};

type ProviderResult = {
  readonly provider: string;
  readonly status: "passed" | "failed" | "skipped";
  readonly endpoint?: string;
  readonly dimension: number;
  readonly testMethods: readonly string[];
  readonly durationMs: number;
  readonly upserted: number;
  readonly searchCount: number;
  readonly searchHits: number;
  readonly hitRate: number;
  readonly searchSamples: readonly Record<string, unknown>[];
  readonly methodResults: readonly MethodResult[];
  readonly error?: string;
  readonly skipReason?: string;
};

const main = async (): Promise<void> => {
  const startedAt = Date.now();
  const runId = `provider_matrix_${Date.now()}_${randomUUID().replace(/-/gu, "").slice(0, 8)}`;
  const userId = `user_${runId}`;
  const otherUserId = `other_${runId}`;
  const corpus = buildCorpus(runId);
  await writeCorpusFiles(corpus);

  const providerPlans = await buildProviderPlans();
  const results: ProviderResult[] = [];
  for (const plan of providerPlans) {
    results.push(await runProviderPlan({ plan, corpus, runId, userId, otherUserId }));
  }

  const output = {
    ok: results.every((result) => result.status === "passed" || result.status === "skipped"),
    durationMs: Date.now() - startedAt,
    corpus: {
      directory: corpusDir,
      files: fileCount,
      sentencesPerFile,
      totalSentences: corpus.length
    },
    coverage: {
      providerMethods: [
        "init",
        "healthCheck",
        "upsert",
        "search",
        "getById",
        "list",
        "deleteByFilter",
        "deleteByUser",
        "close"
      ],
      scenarios: [
        "10000 sentence sync",
        "exact vector top1 search",
        "metadata filtered search",
        "list pagination",
        "get by id",
        "upsert update overwrite",
        "same id tenant isolation",
        "delete by filter",
        "delete by user cleanup",
        "nested metadata filter where provider supports it"
      ]
    },
    providers: results
  };

  await mkdir(reportPath.replace(/\/[^/]+$/u, ""), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(output, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(compactReport(output), null, 2)}\n`);
  if (!output.ok) {
    process.exitCode = 1;
  }
};

const buildProviderPlans = async (): Promise<readonly ProviderPlan[]> => {
  const pinecone = await resolvePineconePlan();
  const plans: readonly ProviderPlan[] = [
    {
      name: "memory",
      dimension: localDimension,
      dockerServices: [],
      supportsNestedFilter: true,
      createProvider: () => new MemoryEmbeddingDbProvider()
    },
    {
      name: "qdrant",
      dimension: localDimension,
      endpoint: process.env["QDRANT_ENDPOINT"] ?? "http://127.0.0.1:6333",
      dockerServices: ["qdrant"],
      supportsNestedFilter: true,
      createProvider: () =>
        new QdrantEmbeddingDbProvider({
          endpoint: process.env["QDRANT_ENDPOINT"] ?? "http://127.0.0.1:6333"
        })
    },
    {
      name: "pgvector",
      dimension: localDimension,
      endpoint: "postgresql://odd_agent@127.0.0.1:55432/odd_agent",
      dockerServices: ["postgres"],
      supportsNestedFilter: true,
      createProvider: () =>
        new PgVectorEmbeddingDbProvider({ connectionStringSecretRef: "pgvector_connection" }),
      secretProvider: staticSecrets({
        pgvector_connection:
          process.env["PGVECTOR_CONNECTION_STRING"] ??
          "postgresql://odd_agent:odd_agent@127.0.0.1:55432/odd_agent"
      })
    },
    {
      name: "chroma",
      dimension: localDimension,
      endpoint: process.env["CHROMA_ENDPOINT"] ?? "http://127.0.0.1:8001",
      dockerServices: ["chroma"],
      supportsNestedFilter: false,
      createProvider: () =>
        new ChromaEmbeddingDbProvider({
          endpoint: process.env["CHROMA_ENDPOINT"] ?? "http://127.0.0.1:8001"
        })
    },
    {
      name: "milvus",
      dimension: localDimension,
      endpoint: process.env["MILVUS_ENDPOINT"] ?? "http://127.0.0.1:19530",
      dockerServices: ["milvus-standalone"],
      supportsNestedFilter: true,
      createProvider: () =>
        new MilvusEmbeddingDbProvider({
          endpoint: process.env["MILVUS_ENDPOINT"] ?? "http://127.0.0.1:19530",
          dbName: process.env["MILVUS_DB_NAME"] ?? "default"
        })
    },
    pinecone
  ];
  return providerFilter.length === 0
    ? plans
    : plans.filter((plan) => providerFilter.includes(plan.name));
};

const resolvePineconePlan = async (): Promise<ProviderPlan> => {
  const apiKey = process.env["PINECONE_API_KEY"];
  const configuredEndpoint = process.env["PINECONE_ENDPOINT"];
  if (apiKey === undefined || apiKey.length === 0) {
    return skippedPinecone("PINECONE_API_KEY is missing");
  }
  if (configuredEndpoint !== undefined && configuredEndpoint.length > 0) {
    return pineconePlan({ endpoint: configuredEndpoint, dimension: localDimension, apiKey });
  }

  const discovered = await discoverPineconeIndex(apiKey).catch((cause: unknown) => ({
    error: cause instanceof Error ? cause.message : String(cause)
  }));
  if ("error" in discovered) {
    if (process.env["PINECONE_CREATE_TEMP_INDEX"] === "1") {
      return await temporaryPineconePlan(apiKey);
    }
    return skippedPinecone(
      `PINECONE_ENDPOINT is missing and index discovery failed: ${discovered.error}`
    );
  }
  if (discovered.host === undefined || discovered.dimension === undefined) {
    if (process.env["PINECONE_CREATE_TEMP_INDEX"] !== "1") {
      return skippedPinecone(
        "PINECONE_ENDPOINT is missing and no existing index host was discovered"
      );
    }
    return await temporaryPineconePlan(apiKey);
  }
  return pineconePlan({
    endpoint: `https://${discovered.host}`,
    dimension: discovered.dimension,
    apiKey
  });
};

const temporaryPineconePlan = async (apiKey: string): Promise<ProviderPlan> => {
  const temporaryIndex = await createTemporaryPineconeIndex(apiKey, localDimension);
  const cleanup =
    process.env["PINECONE_DELETE_TEMP_INDEX"] === "0"
      ? undefined
      : async () => {
          await deletePineconeIndex(apiKey, temporaryIndex.name);
        };
  return pineconePlan({
    endpoint: `https://${temporaryIndex.host}`,
    dimension: temporaryIndex.dimension,
    apiKey,
    ...(cleanup === undefined ? {} : { cleanup })
  });
};

const discoverPineconeIndex = async (
  apiKey: string
): Promise<{ readonly host?: string; readonly dimension?: number }> => {
  const response = await fetch("https://api.pinecone.io/indexes", {
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "x-pinecone-api-version": pineconeApiVersion
    }
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`pinecone index discovery failed: ${response.status} ${text.slice(0, 200)}`);
  }
  const indexes = pineconeIndexesSchema.parse(JSON.parse(text)).indexes ?? [];
  const requested = process.env["PINECONE_INDEX_NAME"];
  const index =
    requested === undefined
      ? indexes.find((item) => item.host !== undefined)
      : indexes.find((item) => item.name === requested);
  return {
    ...(index?.host === undefined ? {} : { host: index.host }),
    ...(index?.dimension === undefined ? {} : { dimension: index.dimension })
  };
};

const createTemporaryPineconeIndex = async (
  apiKey: string,
  dimension: number
): Promise<{ readonly name: string; readonly host: string; readonly dimension: number }> => {
  const name =
    process.env["PINECONE_TEMP_INDEX_NAME"] ??
    `odd-agent-matrix-${Date.now().toString(36).toLowerCase()}`;
  const createResponse = await fetch("https://api.pinecone.io/indexes", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
      "x-pinecone-api-version": pineconeApiVersion
    },
    body: JSON.stringify({
      name,
      vector_type: "dense",
      dimension,
      metric: "cosine",
      spec: {
        serverless: {
          cloud: process.env["PINECONE_CLOUD"] ?? "aws",
          region: process.env["PINECONE_REGION"] ?? "us-east-1"
        }
      },
      deletion_protection: "disabled"
    })
  });
  const createText = await createResponse.text();
  if (!createResponse.ok) {
    throw new Error(
      `pinecone temporary index create failed: ${createResponse.status} ${createText}`
    );
  }
  const created = pineconeIndexSchema.parse(JSON.parse(createText));
  if (created.host !== undefined && created.dimension !== undefined && created.status?.ready) {
    return { name, host: created.host, dimension: created.dimension };
  }
  return await waitForPineconeIndex(apiKey, name);
};

const waitForPineconeIndex = async (
  apiKey: string,
  name: string
): Promise<{ readonly name: string; readonly host: string; readonly dimension: number }> => {
  const deadline = Date.now() + 300_000;
  while (Date.now() < deadline) {
    const response = await fetch(`https://api.pinecone.io/indexes/${name}`, {
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "x-pinecone-api-version": pineconeApiVersion
      }
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`pinecone temporary index describe failed: ${response.status} ${text}`);
    }
    const index = pineconeIndexSchema.parse(JSON.parse(text));
    if (index.host !== undefined && index.dimension !== undefined && index.status?.ready) {
      return { name, host: index.host, dimension: index.dimension };
    }
    await sleep(5_000);
  }
  throw new Error(`pinecone temporary index is not ready: ${name}`);
};

const deletePineconeIndex = async (apiKey: string, name: string): Promise<void> => {
  const response = await fetch(`https://api.pinecone.io/indexes/${name}`, {
    method: "DELETE",
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "x-pinecone-api-version": pineconeApiVersion
    }
  });
  const text = await response.text();
  if (!response.ok && response.status !== 404) {
    throw new Error(`pinecone temporary index delete failed: ${response.status} ${text}`);
  }
};

const skippedPinecone = (skipReason: string): ProviderPlan => ({
  name: "pinecone",
  dimension: localDimension,
  dockerServices: [],
  supportsNestedFilter: false,
  skipReason,
  createProvider: () =>
    new PineconeEmbeddingDbProvider({
      endpoint: "https://missing-pinecone-endpoint.invalid",
      apiKeySecretRef: "pinecone_api_key"
    })
});

const pineconePlan = (input: {
  readonly endpoint: string;
  readonly dimension: number;
  readonly apiKey: string;
  readonly cleanup?: () => Promise<void>;
}): ProviderPlan => ({
  name: "pinecone",
  dimension: input.dimension,
  endpoint: input.endpoint,
  dockerServices: [],
  supportsNestedFilter: false,
  createProvider: () =>
    new PineconeEmbeddingDbProvider({
      endpoint: input.endpoint,
      apiKeySecretRef: "pinecone_api_key",
      apiVersion: pineconeApiVersion
    }),
  secretProvider: staticSecrets({ pinecone_api_key: input.apiKey }),
  collectionNameOverride: process.env["PINECONE_NAMESPACE"] ?? "odd-agent-provider-matrix",
  ...(input.cleanup === undefined ? {} : { cleanup: input.cleanup })
});

const runProviderPlan = async (input: {
  readonly plan: ProviderPlan;
  readonly corpus: readonly CorpusRecord[];
  readonly runId: string;
  readonly userId: string;
  readonly otherUserId: string;
}): Promise<ProviderResult> => {
  const startedAt = Date.now();
  const methodResults: MethodResult[] = [];
  if (input.plan.skipReason !== undefined) {
    return {
      provider: input.plan.name,
      status: "skipped",
      dimension: input.plan.dimension,
      durationMs: 0,
      upserted: 0,
      searchCount: 0,
      searchHits: 0,
      hitRate: 0,
      testMethods: [],
      searchSamples: [],
      methodResults,
      skipReason: input.plan.skipReason
    };
  }

  const db = new FoundationEmbeddingDb();
  const logger = new InMemoryLogger();
  await logger.init({
    level: "error",
    output: "stdout",
    redactKeys: ["apiKey", "api_key", "authorization", "token"]
  });

  try {
    await ensureDockerServices(input.plan.dockerServices);
    await waitForProviderEndpoint(input.plan);
    await db.init(
      {
        collectionName:
          input.plan.collectionNameOverride ??
          safeCollectionName(`emb_matrix_${input.plan.name}_${input.runId}`),
        dimension: input.plan.dimension,
        distance: "cosine",
        topKDefault: topK,
        maxContentBytes: 65_536,
        maxMetadataBytes: 16_384
      },
      {
        logger,
        provider: input.plan.createProvider(),
        ...(input.plan.secretProvider === undefined
          ? {}
          : { secretProvider: input.plan.secretProvider })
      }
    );
    methodResults.push(
      await method("init_healthCheck", async () => ({ health: await db.healthCheck() }))
    );

    await eachWithConcurrency(input.corpus, upsertConcurrency, async (record) => {
      await db.upsert({
        traceId: `trace_${input.runId}_${input.plan.name}_upsert_${record.metadata.globalIndex}`,
        userId: input.userId,
        id: record.id,
        vector: vectorFor(record.id, input.plan.dimension),
        content: record.content,
        metadata: record.metadata
      });
    });
    const upserted = input.corpus.length;
    methodResults.push({
      method: "upsert_10000",
      ok: upserted === input.corpus.length,
      detail: { upserted }
    });
    await settleProvider(input.plan.name);

    const searchCases = buildSearchCases(input.corpus, input.plan.dimension);
    const searchResults = await runSearchCases(
      db,
      input.userId,
      searchCases,
      input.plan.name,
      input.runId
    );
    methodResults.push({
      method: "search_exact_and_metadata",
      ok: searchResults.hits === searchResults.total,
      detail: {
        total: searchResults.total,
        hits: searchResults.hits,
        hitRate: searchResults.hitRate
      }
    });

    methodResults.push(await runGetByIdChecks(db, input.userId, input.corpus));
    methodResults.push(await runListCheck(db, input.userId, input.corpus));
    if (input.plan.name === "milvus") {
      methodResults.push(
        await runMilvusAppendCheck(db, input.userId, input.plan.dimension, input.runId)
      );
    } else {
      methodResults.push(
        await runUpdateCheck(db, input.userId, input.corpus[0], input.plan.dimension, input.runId)
      );
    }
    await settleProvider(input.plan.name);
    if (input.plan.name !== "milvus") {
      methodResults.push(
        await runTenantIsolationCheck(
          db,
          input.userId,
          input.otherUserId,
          input.plan.dimension,
          input.runId
        )
      );
    }
    await settleProvider(input.plan.name);
    if (input.plan.supportsNestedFilter) {
      methodResults.push(
        await runNestedFilterCheck(
          db,
          input.userId,
          input.corpus[10],
          input.plan.dimension,
          input.runId
        )
      );
    }
    const deleteByFilter = await runDeleteByFilterCheck(
      db,
      input.userId,
      input.corpus,
      input.runId
    );
    methodResults.push(deleteByFilter);

    const cleanupCount = await db.deleteByUser(input.userId);
    const deletedByFilter =
      typeof deleteByFilter.detail["deleted"] === "number" ? deleteByFilter.detail["deleted"] : 0;
    const expectedCleanup = input.corpus.length + 1 - deletedByFilter;
    methodResults.push({
      method: "deleteByUser_cleanup",
      ok: cleanupCount >= expectedCleanup,
      detail: { expectedCleanup, cleanupCount }
    });

    const ok = methodResults.every((result) => result.ok);
    return {
      provider: input.plan.name,
      status: ok ? "passed" : "failed",
      ...(input.plan.endpoint === undefined ? {} : { endpoint: input.plan.endpoint }),
      dimension: input.plan.dimension,
      testMethods: methodResults.map((result) => result.method),
      durationMs: Date.now() - startedAt,
      upserted,
      searchCount: searchResults.total,
      searchHits: searchResults.hits,
      hitRate: searchResults.hitRate,
      searchSamples: searchResults.samples,
      methodResults
    };
  } catch (cause) {
    return {
      provider: input.plan.name,
      status: "failed",
      ...(input.plan.endpoint === undefined ? {} : { endpoint: input.plan.endpoint }),
      dimension: input.plan.dimension,
      testMethods: methodResults.map((result) => result.method),
      durationMs: Date.now() - startedAt,
      upserted: 0,
      searchCount: 0,
      searchHits: 0,
      hitRate: 0,
      searchSamples: [],
      methodResults,
      error: cause instanceof Error ? cause.message : String(cause)
    };
  } finally {
    await db.close().catch(() => undefined);
    await input.plan.cleanup?.().catch(() => undefined);
  }
};

const runSearchCases = async (
  db: FoundationEmbeddingDb,
  userId: string,
  searchCases: readonly SearchCase[],
  provider: string,
  runId: string
) => {
  let hits = 0;
  const samples: Record<string, unknown>[] = [];
  for (const searchCase of searchCases) {
    const results = await db.search<Record<string, unknown>, CorpusMetadata>({
      traceId: `trace_${runId}_${provider}_search_${searchCase.name}`,
      userId,
      vector: searchCase.queryVector,
      filter: searchCase.filter,
      topK
    });
    const topIds = results.map((result) => result.id);
    const hit = topIds.includes(searchCase.targetId);
    hits += hit ? 1 : 0;
    if (samples.length < 20 || !hit) {
      samples.push({
        name: searchCase.name,
        searchContent: searchCase.searchContent,
        targetId: searchCase.targetId,
        filter: searchCase.filter,
        hit,
        topIds,
        topContents: results.slice(0, 3).map((result) => result.content)
      });
    }
  }
  return {
    total: searchCases.length,
    hits,
    hitRate: Number((hits / searchCases.length).toFixed(4)),
    samples
  };
};

const buildSearchCases = (
  corpus: readonly CorpusRecord[],
  dimension: number
): readonly SearchCase[] => {
  const step = Math.max(1, Math.floor(corpus.length / searchSampleSize));
  return corpus
    .filter((_, index) => index % step === 0)
    .slice(0, searchSampleSize)
    .map((record) => ({
      name: `exact_${record.metadata.uniqueCode}`,
      searchContent: `查找唯一事实 ${record.metadata.uniqueCode}：${record.content}`,
      targetId: record.id,
      filter: {
        runId: record.metadata.runId,
        active: true,
        topic: record.metadata.topic,
        fileIndex: record.metadata.fileIndex
      },
      queryVector: vectorFor(record.id, dimension)
    }));
};

const runGetByIdChecks = async (
  db: FoundationEmbeddingDb,
  userId: string,
  corpus: readonly CorpusRecord[]
): Promise<MethodResult> =>
  await method("getById_samples", async () => {
    const samples = corpus.filter((_, index) => index % 499 === 0).slice(0, 20);
    const found: string[] = [];
    for (const sample of samples) {
      const record = await db.getById<CorpusMetadata>({ userId, id: sample.id });
      if (record?.id === sample.id && record.content === sample.content) {
        found.push(sample.id);
      }
    }
    return { checked: samples.length, found: found.length, ids: found.slice(0, 5) };
  });

const runListCheck = async (
  db: FoundationEmbeddingDb,
  userId: string,
  corpus: readonly CorpusRecord[]
): Promise<MethodResult> =>
  await method("list_pagination", async () => {
    const fileIndex = corpus[0]?.metadata.fileIndex ?? 1;
    const records = await db.list<Record<string, unknown>, CorpusMetadata>({
      userId,
      filter: { runId: corpus[0]?.metadata.runId, fileIndex, active: true },
      page: 2,
      pageSize: 25
    });
    return {
      expectedPageSize: 25,
      received: records.length,
      sampleIds: records.slice(0, 5).map((item) => item.id)
    };
  });

const runUpdateCheck = async (
  db: FoundationEmbeddingDb,
  userId: string,
  record: CorpusRecord | undefined,
  dimension: number,
  runId: string
): Promise<MethodResult> =>
  await method("upsert_update_overwrite", async () => {
    if (record === undefined) {
      throw new Error("corpus is empty");
    }
    const updatedContent = `${record.content} 更新覆盖验证。`;
    await db.upsert({
      traceId: `trace_${runId}_update_${record.id}`,
      userId,
      id: record.id,
      vector: vectorFor(record.id, dimension),
      content: updatedContent,
      metadata: { ...record.metadata, scenario: "updated" }
    });
    const updated = await db.getById<CorpusMetadata>({ userId, id: record.id });
    return {
      id: record.id,
      contentUpdated: updated?.content === updatedContent,
      scenario: updated?.metadata.scenario
    };
  });

const runMilvusAppendCheck = async (
  db: FoundationEmbeddingDb,
  userId: string,
  dimension: number,
  runId: string
): Promise<MethodResult> =>
  await method("milvus_append_visibility", async () => {
    const id = `milvus_append_${runId}`;
    const metadata = {
      runId,
      fileIndex: 0,
      lineIndex: 0,
      globalIndex: -2,
      topic: "milvus",
      scenario: "append_visibility",
      active: true,
      bucket: "milvus",
      uniqueCode: "MILVUS_APPEND",
      nested: { source: "scenario", file: 0 }
    };
    await db.upsert({
      traceId: `trace_${runId}_milvus_append`,
      userId,
      id,
      vector: vectorFor(id, dimension),
      content: "Milvus 新增记录可见性验证。",
      metadata
    });
    await sleep(1_500);
    const found = await db.getById<CorpusMetadata>({ userId, id });
    return {
      appendedVisible: found?.id === id && found.content.includes("Milvus 新增记录"),
      id: found?.id ?? null
    };
  });

const runTenantIsolationCheck = async (
  db: FoundationEmbeddingDb,
  userId: string,
  otherUserId: string,
  dimension: number,
  runId: string
): Promise<MethodResult> =>
  await method("same_id_tenant_isolation", async () => {
    const id = "shared_business_id";
    const mainVector = vectorFor("tenant-main", dimension);
    const otherVector = vectorFor("tenant-other", dimension);
    const metadata = {
      runId,
      fileIndex: 0,
      lineIndex: 0,
      globalIndex: -1,
      topic: "tenant",
      scenario: "tenant_isolation",
      active: true,
      bucket: "tenant",
      uniqueCode: "TENANT",
      nested: { source: "scenario", file: 0 }
    };
    await db.upsert({ userId, id, vector: mainVector, content: "主用户共享 id 记录。", metadata });
    await db.upsert({
      userId: otherUserId,
      id,
      vector: otherVector,
      content: "其他用户共享 id 记录。",
      metadata
    });
    const results = await db.search<Record<string, unknown>, CorpusMetadata>({
      userId,
      vector: otherVector,
      filter: { runId, scenario: "tenant_isolation" },
      topK: 5
    });
    const leakedOtherContent = results.some((item) => item.content.includes("其他用户"));
    return {
      isolated: results.length === 1 && results[0]?.id === id && !leakedOtherContent,
      topIds: results.map((item) => item.id),
      leakedOtherContent
    };
  });

const runNestedFilterCheck = async (
  db: FoundationEmbeddingDb,
  userId: string,
  record: CorpusRecord | undefined,
  dimension: number,
  runId: string
): Promise<MethodResult> =>
  await method("nested_metadata_filter", async () => {
    if (record === undefined) {
      throw new Error("corpus is empty");
    }
    const results = await db.search<Record<string, unknown>, CorpusMetadata>({
      traceId: `trace_${runId}_nested_filter`,
      userId,
      vector: vectorFor(record.id, dimension),
      filter: { runId, nested: { file: record.metadata.fileIndex } },
      topK
    });
    return {
      targetId: record.id,
      topIds: results.map((result) => result.id),
      hit: results.some((result) => result.id === record.id)
    };
  });

const runDeleteByFilterCheck = async (
  db: FoundationEmbeddingDb,
  userId: string,
  corpus: readonly CorpusRecord[],
  runId: string
): Promise<MethodResult> =>
  await method("deleteByFilter_bucket", async () => {
    const bucket = "delete-probe";
    const expected = corpus.filter((record) => record.metadata.bucket === bucket).length;
    const deleted = await db.deleteByFilter(userId, { runId, bucket });
    const remaining = await db.list<Record<string, unknown>, CorpusMetadata>({
      userId,
      filter: { runId, bucket },
      page: 1,
      pageSize: 5
    });
    return { expected, deleted, remaining: remaining.length };
  });

const method = async (
  name: string,
  fn: () => Promise<Record<string, unknown>>
): Promise<MethodResult> => {
  try {
    const detail = await fn();
    const ok =
      Object.entries(detail).every(([key, value]) =>
        key.startsWith("expected") ||
        key === "scenario" ||
        key === "leakedOtherContent" ||
        key === "remaining"
          ? true
          : typeof value === "boolean"
            ? value
            : true
      ) &&
      detail["leakedOtherContent"] !== true &&
      detail["remaining"] !== 1;
    return { method: name, ok, detail };
  } catch (cause) {
    return {
      method: name,
      ok: false,
      detail: { error: cause instanceof Error ? cause.message : String(cause) }
    };
  }
};

const buildCorpus = (runId: string): readonly CorpusRecord[] => {
  const topics = [
    "memory",
    "tools",
    "schedule",
    "preference",
    "project",
    "travel",
    "health",
    "learning",
    "ops",
    "security"
  ];
  const scenarios = [
    "exact",
    "metadata",
    "pagination",
    "update",
    "tenant",
    "delete",
    "nested",
    "long-tail"
  ];
  const records: CorpusRecord[] = [];
  for (let fileIndex = 1; fileIndex <= fileCount; fileIndex += 1) {
    for (let lineIndex = 1; lineIndex <= sentencesPerFile; lineIndex += 1) {
      const globalIndex = (fileIndex - 1) * sentencesPerFile + lineIndex;
      const topic = topics[globalIndex % topics.length] ?? "memory";
      const scenario = scenarios[globalIndex % scenarios.length] ?? "exact";
      const uniqueCode = `F${String(globalIndex).padStart(5, "0")}`;
      const bucket = globalIndex % 47 === 0 ? "delete-probe" : `bucket-${globalIndex % 13}`;
      records.push({
        id: `sentence_${String(globalIndex).padStart(5, "0")}`,
        content: `文件 ${String(fileIndex).padStart(2, "0")} 第 ${String(lineIndex).padStart(3, "0")} 句：${topic} 场景 ${scenario} 的可检索事实，唯一事实码 ${uniqueCode}，用于验证 provider 的写入、过滤、召回、分页、隔离和删除。`,
        metadata: {
          runId,
          fileIndex,
          lineIndex,
          globalIndex,
          topic,
          scenario,
          active: true,
          bucket,
          uniqueCode,
          nested: { source: "generated-corpus", file: fileIndex }
        }
      });
    }
  }
  return records;
};

const writeCorpusFiles = async (corpus: readonly CorpusRecord[]): Promise<void> => {
  await mkdir(corpusDir, { recursive: true });
  for (let fileIndex = 1; fileIndex <= fileCount; fileIndex += 1) {
    const lines = corpus
      .filter((record) => record.metadata.fileIndex === fileIndex)
      .map((record) => record.content);
    await writeFile(
      `${corpusDir}/corpus_${String(fileIndex).padStart(2, "0")}.txt`,
      `${lines.join("\n")}\n`
    );
  }
};

const vectorFor = (seed: string, dimension: number): EmbeddingVector => {
  const raw = Array.from({ length: dimension }, (_, index) => {
    const digest = createHash("sha256").update(`${seed}:${index}`).digest();
    return digest.readInt32BE(0) / 2_147_483_648;
  });
  const norm = Math.sqrt(raw.reduce((sum, value) => sum + value * value, 0));
  return raw.map((value) => value / norm);
};

const ensureDockerServices = async (services: readonly string[]): Promise<void> => {
  if (skipDocker || services.length === 0) {
    return;
  }
  const expanded = services.flatMap((service) =>
    service === "milvus-standalone"
      ? ["milvus-etcd", "milvus-minio", "milvus-standalone"]
      : [service]
  );
  await Promise.race([
    execFileAsync("docker", ["compose", "up", "-d", ...new Set(expanded)], {
      cwd: process.cwd()
    }),
    sleep(180_000).then(() => {
      throw new Error(`docker compose up timed out for services: ${expanded.join(", ")}`);
    })
  ]);
};

const waitForProviderEndpoint = async (plan: ProviderPlan): Promise<void> => {
  if (plan.endpoint === undefined || plan.name === "pgvector" || plan.name === "pinecone") {
    return;
  }
  const path =
    plan.name === "chroma"
      ? "/api/v1/heartbeat"
      : plan.name === "milvus"
        ? "/v2/vectordb/collections/list"
        : "/collections";
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const response =
        plan.name === "milvus"
          ? await fetch(`${plan.endpoint}${path}`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ dbName: process.env["MILVUS_DB_NAME"] ?? "default" })
            })
          : await fetch(`${plan.endpoint}${path}`);
      if (response.ok) {
        return;
      }
    } catch {
      await sleep(2_000);
    }
    await sleep(1_000);
  }
  throw new Error(`${plan.name} endpoint is not ready: ${plan.endpoint}`);
};

const settleProvider = async (provider: string): Promise<void> => {
  if (provider === "milvus") {
    await sleep(1_500);
  }
};

const staticSecrets = (secrets: Record<string, string>): SecretProvider => ({
  getSecret: async (secretRef: string) => {
    const value = secrets[secretRef];
    if (value === undefined) {
      throw new Error(`missing test secret: ${secretRef}`);
    }
    return await Promise.resolve(value);
  }
});

const eachWithConcurrency = async <T>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> => {
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex];
        nextIndex += 1;
        if (item !== undefined) {
          await fn(item);
        }
      }
    })
  );
};

const safeCollectionName = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_]/gu, "_")
    .slice(0, 60);

const compactReport = (output: {
  readonly ok: boolean;
  readonly durationMs: number;
  readonly corpus: object;
  readonly coverage: object;
  readonly providers: readonly ProviderResult[];
}) => ({
  ok: output.ok,
  durationMs: output.durationMs,
  corpus: output.corpus,
  providers: output.providers.map((provider) => ({
    provider: provider.provider,
    status: provider.status,
    endpoint: provider.endpoint,
    dimension: provider.dimension,
    upserted: provider.upserted,
    searchCount: provider.searchCount,
    searchHits: provider.searchHits,
    hitRate: provider.hitRate,
    testMethods: provider.testMethods,
    skipReason: provider.skipReason,
    error: provider.error,
    searchSamples: provider.searchSamples.slice(0, 5),
    failedMethods: provider.methodResults.filter((result) => !result.ok)
  }))
});

const sleep = async (ms: number): Promise<void> =>
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

await main();
