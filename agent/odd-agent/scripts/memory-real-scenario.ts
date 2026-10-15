import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FoundationEmbeddingDb } from "../src/foundation/embedding-db/embedding-db-component.js";
import { PineconeEmbeddingDbProvider } from "../src/foundation/embedding-db/embedding-db-provider-pinecone.js";
import type { SecretProvider } from "../src/foundation/foundation-types.js";
import {
  OpenAiLlmComponent,
  type OpenAiChatCompletionClient
} from "../src/foundation/llm/llm-component.js";
import {
  OpenAiLlmEmbeddingComponent,
  type OpenAiEmbeddingClient
} from "../src/foundation/llm/llm-embedding.js";
import { InMemoryLogger } from "../src/foundation/logger/logger-component.js";
import {
  MemoryComponent,
  type Memory,
  type MemoryConfig,
  type MemorySearchResult
} from "../src/foundation/memory/index.js";

/**
 * Memory 真实 100 轮场景测试。
 *
 * 参数通过环境变量传入：`MINIMAX_API_KEY`、`PINECONE_API_KEY` 和 `BAILIAN_API_KEY`
 * 必填；其它 endpoint/model/namespace 有默认值，默认值匹配当前真实验收环境。实现方式是
 * 直接创建 MiniMax Chat Completions、百炼 OpenAI-compatible Embeddings 和 Pinecone
 * data-plane provider，再通过 MemoryComponent 的 public API 跑 write/search/list/delete。
 */
const main = async (): Promise<void> => {
  const runtime = readRuntimeConfig();
  const logger = new InMemoryLogger();
  await logger.init({
    level: "debug",
    output: "stdout",
    redactKeys: ["apiKey", "api_key", "authorization", "password", "token"]
  });

  const embeddingDb = new FoundationEmbeddingDb();
  const llm = new OpenAiLlmComponent();
  const llmEmbedding = new OpenAiLlmEmbeddingComponent();
  const memory = new MemoryComponent();
  const runId = `memory_real_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const userId = `user_${runId}`;
  const otherUserId = `other_${runId}`;
  const namespace = runtime.pineconeNamespace;
  const startedAt = Date.now();

  try {
    progress(
      `init real services: llm=${runtime.minimaxModel}, embedding=${runtime.embeddingModel}, pinecone_namespace=${namespace}, dimension=${runtime.dimension}`
    );
    // 初始化三个真实外部依赖。这里每个组件都只拿自己需要的 secret，避免把凭据放进
    // YAML 或报告；后续报告只记录模型、host、namespace 和维度。
    await llm.init(
      {
        baseUrl: runtime.minimaxBaseUrl,
        apiKeySecretRef: "MINIMAX_API_KEY",
        model: runtime.minimaxModel,
        modelTier: "standard",
        temperature: 0,
        timeoutMs: runtime.minimaxTimeoutMs,
        maxRetries: runtime.minimaxMaxRetries,
        logMessages: false
      },
      { logger, secretProvider: staticSecrets({ MINIMAX_API_KEY: runtime.minimaxApiKey }) }
    );
    await llmEmbedding.init(
      {
        baseUrl: runtime.embeddingBaseUrl,
        apiKeySecretRef: "BAILIAN_API_KEY",
        model: runtime.embeddingModel,
        timeoutMs: runtime.embeddingTimeoutMs,
        maxRetries: 1,
        dimensions: runtime.dimension,
        encodingFormat: "float"
      },
      { logger, secretProvider: staticSecrets({ BAILIAN_API_KEY: runtime.bailianApiKey }) }
    );
    await memory.init(memoryConfig(namespace, runtime.dimension), {
      embeddingDb,
      embeddingDbProvider: new PineconeEmbeddingDbProvider({
        endpoint: runtime.pineconeEndpoint,
        apiKeySecretRef: "PINECONE_API_KEY",
        apiVersion: runtime.pineconeApiVersion,
        timeoutMs: runtime.pineconeTimeoutMs,
        maxRetries: runtime.pineconeMaxRetries,
        retryDelayMs: runtime.pineconeRetryDelayMs
      }),
      secretProvider: staticSecrets({ PINECONE_API_KEY: runtime.pineconeApiKey }),
      llm: new CapturingLlm(llm.chatCompletions),
      llmEmbedding: new CapturingEmbedding(llmEmbedding.embeddings),
      logger
    });

    // 100 轮全部走 Memory.write + Memory.search。每轮写入后立刻查一次，能暴露解析、
    // embedding、Pinecone upsert 和 query 任一环节的真实问题。
    const turns: TurnReport[] = [];
    const roundMessages = buildRoundMessages(runtime.rounds);
    for (const [index, message] of roundMessages.entries()) {
      const round = index + 1;
      progress(`round ${round}/${runtime.rounds} write+search started`);
      const conversationId = `conv_${runId}_${round}`;
      const diffs = await memory.write({
        traceId: `trace_${runId}_write_${round}`,
        userId,
        conversationId,
        message
      });
      const query = queryForMessage(message);
      const recalled = await memory.search({
        traceId: `trace_${runId}_search_${round}`,
        userId,
        query,
        topK: 8
      });
      turns.push({
        round,
        conversationId,
        message,
        query,
        actions: diffs.map((diff) => diff.action),
        diffCount: diffs.length,
        topRecall: recalled.slice(0, 3).map(toReportMemory)
      });
      progress(
        `round ${round}/${runtime.rounds} ok: diffs=${diffs.length}, actions=${diffs
          .map((diff) => diff.action)
          .join(",")}, recall=${recalled.length}`
      );
    }

    progress("final add/update/query/delete assertions started");
    // 轮次写完后做专门 ADD/UPDATE/QUERY/DELETE 验收。删除用 public delete API 触发 soft
    // delete，再通过 list/search/getBy metadata 结果验证 active=false 生效。
    const listedBeforeDelete = await memory.list({ userId, page: 1, pageSize: 100 });
    const finalRecall = await memory.search({
      traceId: `trace_${runId}_final_query`,
      userId,
      query: "用户偏好的回答语言、当前主要编程语言、项目状态、真实验证事件",
      topK: 20
    });
    const crossUserRecall = await memory.search({
      traceId: `trace_${runId}_cross_user`,
      userId: otherUserId,
      query: "用户偏好的回答语言和编程语言",
      topK: 10
    });
    const deleteTarget = chooseDeleteTarget(listedBeforeDelete);
    if (deleteTarget === undefined) {
      throw new Error("memory real scenario did not produce any memory to delete");
    }
    await memory.delete({
      traceId: `trace_${runId}_delete`,
      userId,
      memoryId: deleteTarget.id,
      reason: "100 round real scenario soft delete validation"
    });
    const listedAfterDelete = await memory.list({ userId, page: 1, pageSize: 100 });
    const includeDeletedRows = await memory.list({
      userId,
      filters: { includeDeleted: true },
      page: 1,
      pageSize: 100
    });
    const deletedRecall = await memory.search({
      traceId: `trace_${runId}_deleted_query`,
      userId,
      query: deleteTarget.text,
      topK: 20
    });

    const report = buildReport({
      runId,
      userId,
      namespace,
      runtime,
      startedAt,
      turns,
      listedBeforeDelete,
      listedAfterDelete,
      includeDeletedRows,
      finalRecall,
      crossUserRecall,
      deletedRecall,
      deleteTarget,
      logEvents: summarizeLogEvents(
        logger.entries.flatMap((entry) => (typeof entry.event === "string" ? [entry.event] : []))
      )
    });
    await writeReport(report);
    progress(
      `report written: ok=${report.ok}, failed_checks=${report.failedChecks
        .map((check) => check.name)
        .join(",")}`
    );
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!report.ok) {
      throw new Error(
        `memory real 100 round scenario failed: ${JSON.stringify(report.failedChecks, null, 2)}`
      );
    }
  } finally {
    // 真实 Pinecone namespace 是用户指定的 oddfi，所以只能按本轮 userId 清理，避免误删同
    // namespace 的其它数据；清理失败不吞掉主流程错误，但会由 catch 返回安全的 0。
    progress("cleanup started");
    await embeddingDb.deleteByUser(userId).catch(() => Promise.resolve(0));
    await embeddingDb.deleteByUser(otherUserId).catch(() => Promise.resolve(0));
    await embeddingDb.close();
    await llmEmbedding.close();
    await llm.close();
  }
};

type RuntimeConfig = {
  readonly rounds: number;
  readonly dimension: number;
  readonly minimaxBaseUrl: string;
  readonly minimaxModel: string;
  readonly minimaxTimeoutMs: number;
  readonly minimaxMaxRetries: number;
  readonly minimaxApiKey: string;
  readonly embeddingBaseUrl: string;
  readonly embeddingModel: string;
  readonly embeddingTimeoutMs: number;
  readonly bailianApiKey: string;
  readonly pineconeEndpoint: string;
  readonly pineconeNamespace: string;
  readonly pineconeApiVersion: string;
  readonly pineconeTimeoutMs: number;
  readonly pineconeMaxRetries: number;
  readonly pineconeRetryDelayMs: number;
  readonly pineconeApiKey: string;
};

type TurnReport = {
  readonly round: number;
  readonly conversationId: string;
  readonly message: string;
  readonly query: string;
  readonly actions: readonly string[];
  readonly diffCount: number;
  readonly topRecall: readonly Record<string, unknown>[];
};

type ScenarioReport = {
  readonly ok: boolean;
  readonly failedChecks: readonly ScenarioCheck[];
  readonly checks: readonly ScenarioCheck[];
  readonly durationMs: number;
  readonly services: Record<string, unknown>;
  readonly ids: Record<string, string>;
  readonly turns: readonly TurnReport[];
  readonly finalRecall: readonly Record<string, unknown>[];
  readonly listedBeforeDelete: readonly Record<string, unknown>[];
  readonly listedAfterDelete: readonly Record<string, unknown>[];
  readonly includeDeletedRows: readonly Record<string, unknown>[];
  readonly crossUserRecall: readonly Record<string, unknown>[];
  readonly deletedRecall: readonly Record<string, unknown>[];
  readonly logEvents: Readonly<Record<string, number>>;
};

type ScenarioCheck = {
  readonly name: string;
  readonly passed: boolean;
  readonly details?: Record<string, unknown>;
};

/**
 * 读取真实验证配置。
 *
 * 参数来自环境变量，API key 必须由调用命令传入；baseUrl、model、host、namespace 和维度都有
 * 当前验收环境默认值。实现方式是逐项读取并校验必填 secret，避免测试脚本隐式跳过真实调用。
 */
const readRuntimeConfig = (): RuntimeConfig => ({
  rounds: positiveIntEnv("MEMORY_REAL_ROUNDS", 100),
  dimension: positiveIntEnv("MEMORY_REAL_DIMENSION", 512),
  minimaxBaseUrl: process.env["MINIMAX_BASE_URL"] ?? "https://api.minimaxi.com/v1",
  minimaxModel: process.env["MINIMAX_MODEL"] ?? "MiniMax-M2.7",
  minimaxTimeoutMs: positiveIntEnv("MINIMAX_TIMEOUT_MS", 420_000),
  minimaxMaxRetries: nonNegativeIntEnv("MINIMAX_MAX_RETRIES", 2),
  minimaxApiKey: requiredEnv("MINIMAX_API_KEY"),
  embeddingBaseUrl:
    process.env["BAILIAN_BASE_URL"] ?? "https://dashscope.aliyuncs.com/compatible-mode/v1",
  embeddingModel: process.env["BAILIAN_EMBEDDING_MODEL"] ?? "text-embedding-v4",
  embeddingTimeoutMs: positiveIntEnv("BAILIAN_TIMEOUT_MS", 60_000),
  bailianApiKey: requiredEnv("BAILIAN_API_KEY"),
  pineconeEndpoint:
    process.env["PINECONE_ENDPOINT"] ?? "https://oddfi-9j57y2k.svc.aped-4627-b74a.pinecone.io",
  pineconeNamespace: process.env["PINECONE_NAMESPACE"] ?? "oddfi",
  pineconeApiVersion: process.env["PINECONE_API_VERSION"] ?? "2026-04",
  pineconeTimeoutMs: positiveIntEnv("PINECONE_TIMEOUT_MS", 60_000),
  pineconeMaxRetries: nonNegativeIntEnv("PINECONE_MAX_RETRIES", 12),
  pineconeRetryDelayMs: positiveIntEnv("PINECONE_RETRY_DELAY_MS", 5_000),
  pineconeApiKey: requiredEnv("PINECONE_API_KEY")
});

/**
 * 构造 Memory 运行配置。
 *
 * @param collectionName 目标 Embedding DB 存储名；Pinecone provider 会把它作为 namespace，
 * Qdrant/Chroma/Milvus 会把它作为 collection，pgvector 会把它作为表名。
 * @param dimension embedding 向量维度，必须等于百炼返回向量长度和 Pinecone index 维度。
 *
 * 实现方式：固定语义 key 白名单为当前 Memory v3 支持的五类，阈值维持生产口径，确保真实
 * 验证和运行时一致。
 */
const memoryConfig = (collectionName: string, dimension: number): MemoryConfig => ({
  embeddingCollectionName: collectionName,
  embeddingDimension: dimension,
  embeddingDistance: "cosine",
  defaultTopK: 8,
  maxContentBytes: 65_536,
  maxMetadataBytes: 16_384,
  maxPageSize: 200,
  minCandidateConfidence: 0.55,
  minDiffConfidence: 0.55,
  semanticKeys: {
    profile: ["profile.*"],
    preference: ["preference.*"],
    current_state: ["current_state.*"],
    project_state: ["project_state.*"],
    event: ["event.*"]
  },
  promptDir: "prompts"
});

/**
 * 生成 100 轮真实用户消息。
 *
 * @param rounds 需要生成的轮数，默认 100。
 *
 * 实现方式：按固定模板循环制造 profile/preference/current_state/project_state/event
 * 五类事实，并周期性更新同一 semantic slot，保证 ADD、UPDATE 和 QUERY 都有真实输入。
 */
const buildRoundMessages = (rounds: number): readonly string[] =>
  Array.from({ length: rounds }, (_value, index) => {
    const round = index + 1;
    const bucket = round % 10;
    if (bucket === 1) {
      return `第${round}轮请记住：我偏好简洁中文回答，当前验证批次是 batch-${Math.ceil(round / 10)}。`;
    }
    if (bucket === 2) {
      return `第${round}轮请记住：我主要写 TypeScript，并在 odd_agent memory 真实验证中工作。`;
    }
    if (bucket === 3) {
      return `第${round}轮更新：我现在主要写 Go，不再主要写 TypeScript。`;
    }
    if (bucket === 4) {
      return `第${round}轮请记住：odd_agent Memory 真实验证项目当前正在检查 Pinecone 写入和召回。`;
    }
    if (bucket === 5) {
      return `第${round}轮事件：我完成了第${round}轮 Memory 真实写入验证。`;
    }
    if (bucket === 6) {
      return `第${round}轮请记住：我喜欢在回答里看到明确的测试结果和失败原因。`;
    }
    if (bucket === 7) {
      return `第${round}轮更新：我现在更关注 Memory 的 delete 和 query 行为，不再只关注 add。`;
    }
    if (bucket === 8) {
      return `第${round}轮请记住：我的当前任务是验证 Memory 100 轮解析、写入、更新、删除和查询。`;
    }
    if (bucket === 9) {
      return `第${round}轮事件：我在 Pinecone namespace oddfi 中验证长期记忆检索。`;
    }
    return `第${round}轮更新：如果回答提到我的技术栈，请优先说 Go 和 TypeScript。`;
  });

/**
 * 为每轮消息生成紧邻查询语句。
 *
 * @param message 当前写入的用户消息。
 *
 * 实现方式：根据消息关键词选择查询主题，让每轮都能真实调用 Memory.search，同时避免
 * 只用原文查询造成虚假的高词面重合。
 */
const queryForMessage = (message: string): string => {
  if (message.includes("Go") || message.includes("TypeScript")) {
    return "用户当前主要编程语言和技术栈";
  }
  if (message.includes("Pinecone") || message.includes("namespace")) {
    return "Pinecone namespace 写入召回验证";
  }
  if (message.includes("delete") || message.includes("query")) {
    return "Memory delete query add update 行为";
  }
  if (message.includes("事件") || message.includes("完成")) {
    return "Memory 真实验证历史事件";
  }
  return "用户回答风格和当前 Memory 验证任务";
};

class CapturingLlm implements OpenAiChatCompletionClient {
  readonly calls: { readonly schemaName: string; readonly output: string }[] = [];

  constructor(private readonly inner: OpenAiChatCompletionClient) {}

  get model(): string {
    return this.inner.model;
  }

  get temperature(): number {
    return this.inner.temperature;
  }

  /**
   * 代理真实 Chat Completions 请求并记录 schema 与输出。
   *
   * @param command OpenAI Chat Completions 非流式请求参数，由 Memory 传入。
   *
   * 实现方式：调用真实 LLM，再保存 response_format schema name 和返回文本，供报告统计。
   */
  async create(command: Parameters<OpenAiChatCompletionClient["create"]>[0]) {
    const response = await this.#createWithNonEmptyContent(command);
    this.calls.push({
      schemaName:
        command.response_format?.type === "json_schema"
          ? command.response_format.json_schema.name
          : "unknown",
      output: response.choices[0]?.message.content ?? ""
    });
    return response;
  }

  /**
   * 调用真实 LLM，并对偶发空 content 做一次同请求重试。
   *
   * @param command OpenAI Chat Completions 非流式请求参数，由 Memory 传入。
   *
   * 实现方式：最多尝试两次；如果 provider 返回 200 但第一条 message.content 为空，说明没有
   * 可解析 JSON，重试同一真实请求；其它错误原样抛出。
   */
  async #createWithNonEmptyContent(command: Parameters<OpenAiChatCompletionClient["create"]>[0]) {
    const first = await this.inner.create(command);
    if ((first.choices[0]?.message.content ?? "").trim().length > 0) {
      return first;
    }
    return await this.inner.create(command);
  }

  /**
   * 代理流式接口。
   *
   * @param command OpenAI Chat Completions 流式请求参数。
   *
   * 实现方式：Memory 当前不会调用 stream，这里仍保持接口完整，直接转发给真实 LLM。
   */
  async stream(command: Parameters<OpenAiChatCompletionClient["stream"]>[0]) {
    return await this.inner.stream(command);
  }
}

class CapturingEmbedding implements OpenAiEmbeddingClient {
  readonly calls: string[] = [];

  constructor(private readonly inner: OpenAiEmbeddingClient) {}

  get model(): string {
    return this.inner.model;
  }

  get dimensions(): number {
    return this.inner.dimensions ?? 512;
  }

  /**
   * 代理原生 embeddings.create。
   *
   * @param params OpenAI-compatible embeddings.create 参数。
   *
   * 实现方式：直接转发给真实 embedding client；Memory 当前走 embedText，这里保留接口完整。
   */
  async create(params: Parameters<OpenAiEmbeddingClient["create"]>[0]) {
    return await this.inner.create(params);
  }

  /**
   * 生成单条文本 embedding 并记录调用。
   *
   * @param text 需要向量化的文本，来自 memory text 或 search query。
   * @param options 维度和 user 等 OpenAI-compatible 参数。
   *
   * 实现方式：记录文本摘要后调用真实百炼 embedding，返回真实 number[] vector。
   */
  async embedText(
    text: string,
    options?: Parameters<OpenAiEmbeddingClient["embedText"]>[1]
  ): Promise<readonly number[]> {
    this.calls.push(text.slice(0, 120));
    return await this.inner.embedText(text, options);
  }

  /**
   * 批量生成 embedding。
   *
   * @param texts 需要向量化的文本数组。
   * @param options 维度和 user 等 OpenAI-compatible 参数。
   *
   * 实现方式：记录每条文本摘要后转发给真实 embedding client。
   */
  async embedTexts(
    texts: readonly string[],
    options?: Parameters<OpenAiEmbeddingClient["embedTexts"]>[1]
  ): Promise<readonly (readonly number[])[]> {
    this.calls.push(...texts.map((text) => text.slice(0, 120)));
    return await this.inner.embedTexts(texts, options);
  }
}

/**
 * 选择删除验证目标。
 *
 * @param memories 当前 active memory 列表。
 *
 * 实现方式：优先删除 event，避免删除偏好/项目状态影响最终查询判断；没有 event 时删除第一条。
 */
const chooseDeleteTarget = (memories: readonly Memory[]): Memory | undefined =>
  memories.find((memory) => memory.type === "event") ?? memories[0];

/**
 * 组装最终报告并执行验收断言。
 *
 * @param input 真实场景执行产生的所有关键结果。
 *
 * 实现方式：把每个验收项建模为 ScenarioCheck，报告完整保留成功与失败细节，调用方看到
 * `ok=false` 时能直接定位是解析、写入、召回、删除还是跨用户隔离失败。
 */
const buildReport = (input: {
  readonly runId: string;
  readonly userId: string;
  readonly namespace: string;
  readonly runtime: RuntimeConfig;
  readonly startedAt: number;
  readonly turns: readonly TurnReport[];
  readonly listedBeforeDelete: readonly Memory[];
  readonly listedAfterDelete: readonly Memory[];
  readonly includeDeletedRows: readonly Memory[];
  readonly finalRecall: readonly MemorySearchResult[];
  readonly crossUserRecall: readonly MemorySearchResult[];
  readonly deletedRecall: readonly MemorySearchResult[];
  readonly deleteTarget: Memory;
  readonly logEvents: Readonly<Record<string, number>>;
}): ScenarioReport => {
  const actions = input.turns.flatMap((turn) => turn.actions);
  const checks = [
    check("ran_exactly_requested_rounds", input.turns.length === input.runtime.rounds, {
      rounds: input.turns.length
    }),
    check(
      "most_rounds_returned_diffs",
      input.turns.filter((turn) => turn.diffCount > 0).length >= input.runtime.rounds * 0.8,
      {
        diffRounds: input.turns.filter((turn) => turn.diffCount > 0).length,
        emptyRounds: input.turns.filter((turn) => turn.diffCount === 0).map((turn) => turn.round)
      }
    ),
    check("add_happened", actions.includes("ADD"), { actions }),
    check("update_happened", actions.includes("UPDATE"), { actions }),
    check("memories_written_to_embedding_db", input.listedBeforeDelete.length >= 5, {
      count: input.listedBeforeDelete.length
    }),
    check("final_query_recalled_memories", input.finalRecall.length >= 5, {
      recalled: input.finalRecall.map((memory) => memory.text)
    }),
    check("final_query_has_key_topics", containsAllTopics(input.finalRecall), {
      recalled: input.finalRecall.map((memory) => memory.text)
    }),
    check(
      "delete_removed_from_active_list",
      !input.listedAfterDelete.some((memory) => memory.id === input.deleteTarget.id),
      {
        deletedId: input.deleteTarget.id
      }
    ),
    check(
      "delete_marked_inactive_for_audit",
      input.includeDeletedRows.some(
        (memory) => memory.id === input.deleteTarget.id && memory.deletedAt !== undefined
      ),
      {
        deletedId: input.deleteTarget.id
      }
    ),
    check(
      "delete_removed_from_search",
      !input.deletedRecall.some((memory) => memory.id === input.deleteTarget.id),
      {
        deletedId: input.deleteTarget.id
      }
    ),
    check("cross_user_query_empty", input.crossUserRecall.length === 0, {
      resultCount: input.crossUserRecall.length
    })
  ];
  const failedChecks = checks.filter((item) => !item.passed);
  return {
    ok: failedChecks.length === 0,
    failedChecks,
    checks,
    durationMs: Date.now() - input.startedAt,
    services: {
      llmBaseUrl: input.runtime.minimaxBaseUrl,
      llmModel: input.runtime.minimaxModel,
      embeddingBaseUrl: input.runtime.embeddingBaseUrl,
      embeddingModel: input.runtime.embeddingModel,
      pineconeEndpoint: input.runtime.pineconeEndpoint,
      pineconeNamespace: input.namespace,
      dimension: input.runtime.dimension
    },
    ids: { runId: input.runId, userId: input.userId },
    turns: input.turns,
    finalRecall: input.finalRecall.map(toReportMemory),
    listedBeforeDelete: input.listedBeforeDelete.map(toReportMemory),
    listedAfterDelete: input.listedAfterDelete.map(toReportMemory),
    includeDeletedRows: input.includeDeletedRows.map(toReportMemory),
    crossUserRecall: input.crossUserRecall.map(toReportMemory),
    deletedRecall: input.deletedRecall.map(toReportMemory),
    logEvents: input.logEvents
  };
};

/**
 * 写出真实场景报告。
 *
 * @param report 完整场景报告。
 *
 * 实现方式：写入 `tmp/memory-real/latest.json`，同时写入简短 summary，方便人工和 CI 同时查看。
 */
const writeReport = async (report: ScenarioReport): Promise<void> => {
  await mkdir(resolve("tmp", "memory-real"), { recursive: true });
  await writeFile(
    resolve("tmp", "memory-real", "latest.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );
  await writeFile(
    resolve("tmp", "memory-real", "summary-for-table.json"),
    `${JSON.stringify(
      {
        ok: report.ok,
        durationMs: report.durationMs,
        checks: report.checks,
        services: report.services,
        logEvents: report.logEvents
      },
      null,
      2
    )}\n`
  );
};

const check = (
  name: string,
  passed: boolean,
  details?: Record<string, unknown>
): ScenarioCheck => ({
  name,
  passed,
  ...(details === undefined ? {} : { details })
});

/**
 * 判断最终召回是否覆盖验收关注主题。
 *
 * @param memories 最终 query 返回的 Memory.search 结果。
 *
 * 实现方式：把召回文本合并成小写字符串，再检查技术栈、Memory、Pinecone/namespace 和中文偏好
 * 四组关键词；这是召回质量断言，不参与写入或删除副作用。
 */
const containsAllTopics = (memories: readonly MemorySearchResult[]): boolean => {
  const text = memories
    .map((memory) => memory.text)
    .join("\n")
    .toLowerCase();
  return (
    (text.includes("go") || text.includes("typescript")) &&
    text.includes("memory") &&
    (text.includes("pinecone") || text.includes("namespace")) &&
    (text.includes("中文") || text.includes("简洁"))
  );
};

/**
 * 把 Memory 对象裁剪成报告字段。
 *
 * @param memory Memory.list 或 Memory.search 返回的单条记录。
 *
 * 实现方式：只保留验收定位需要的非敏感字段，避免把原始 metadata 扩展字段或 secret 写进报告。
 */
const toReportMemory = (memory: {
  readonly id: string;
  readonly type: string;
  readonly semanticKey: string;
  readonly text: string;
  readonly confidence: number;
  readonly importance: number;
  readonly similarity?: number;
  readonly deletedAt?: string;
}): Record<string, unknown> => ({
  id: memory.id,
  type: memory.type,
  semanticKey: memory.semanticKey,
  text: memory.text,
  confidence: memory.confidence,
  importance: memory.importance,
  ...(memory.similarity === undefined ? {} : { similarity: memory.similarity }),
  ...(memory.deletedAt === undefined ? {} : { deletedAt: memory.deletedAt })
});

/**
 * 读取必填环境变量。
 *
 * @param name 环境变量名。
 *
 * 实现方式：缺失或空字符串立即抛错，保证真实测试不会因为未配置 secret 而降级或跳过。
 */
const requiredEnv = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required for real memory scenario`);
  }
  return value;
};

/**
 * 读取正整数环境变量。
 *
 * @param name 环境变量名。
 * @param fallback 未设置时使用的默认值。
 *
 * 实现方式：把字符串转 number 后校验整数和正数，避免 timeout、rounds、dimension 被错误值污染。
 */
const positiveIntEnv = (name: string, fallback: number): number => {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
};

/**
 * 读取非负整数环境变量。
 *
 * @param name 环境变量名。
 * @param fallback 未设置时使用的默认值。
 *
 * 实现方式：把字符串转 number 后校验整数和非负数，用于 maxRetries 这类允许 0 的配置。
 */
const nonNegativeIntEnv = (name: string, fallback: number): number => {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
};

/**
 * 构造测试专用 secret provider。
 *
 * @param secrets secretRef 到真实 secret 的映射。
 *
 * 实现方式：只在内存中读取调用命令传入的 secret，不写 YAML、日志或报告；缺失时 fail-fast。
 */
const staticSecrets = (secrets: Readonly<Record<string, string>>): SecretProvider => ({
  getSecret: async (secretRef: string) => {
    const value = secrets[secretRef];
    if (value === undefined || value.length === 0) {
      throw new Error(`missing secret: ${secretRef}`);
    }
    return await Promise.resolve(value);
  }
});

/**
 * 汇总结构化日志事件数量。
 *
 * @param events logger 收集到的事件名数组。
 *
 * 实现方式：按事件名计数，报告用它验证 LLM、embedding 和 embedding_db 真实调用确实发生。
 */
const summarizeLogEvents = (events: readonly string[]): Readonly<Record<string, number>> => {
  const counts: Record<string, number> = {};
  for (const event of events) {
    counts[event] = (counts[event] ?? 0) + 1;
  }
  return counts;
};

/**
 * 打印真实场景进度。
 *
 * @param message 面向人工观察的阶段摘要。
 *
 * 实现方式：写 stdout 并追加 ISO 时间，长跑时可以看到每轮是否卡在 LLM、embedding 或 Pinecone。
 */
const progress = (message: string): void => {
  process.stdout.write(`[${new Date().toISOString()}] ${message}\n`);
};

await main();
