import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { TagMatchService } from "../src/application/tags/tag-match-service.js";
import { OpenAiLlmComponent } from "../src/foundation/llm/llm-component.js";
import { InMemoryLogger } from "../src/foundation/logger/logger-component.js";
import { loadOddAgentConfig } from "../src/infrastructure/config/load-odd-agent-config.js";
import type { PostgresTagRepository } from "../src/infrastructure/tags/postgres-tag-repository.js";
import type { TagRecord } from "../src/models/db/persistence-model.js";

const workspaceRoot = resolve(new URL("..", import.meta.url).pathname);

type CheckResult = {
  readonly name: string;
  readonly ok: boolean;
  readonly details: Readonly<Record<string, unknown>>;
};

const now = new Date().toISOString();

const fixtureTags: readonly TagRecord[] = [
  {
    id: 1,
    category: "football",
    langMetadata: { en: "Argentina", zh: "阿根廷" },
    sortOrder: 1,
    createdAt: now,
    updatedAt: now
  },
  {
    id: 2,
    category: "football",
    langMetadata: { en: "Messi", zh: "梅西" },
    sortOrder: 2,
    createdAt: now,
    updatedAt: now
  },
  {
    id: 3,
    category: "technology",
    langMetadata: { en: "PostgreSQL", zh: "PostgreSQL" },
    sortOrder: 3,
    createdAt: now,
    updatedAt: now
  }
];

const main = async (): Promise<void> => {
  const startedAt = Date.now();
  const config = await loadOddAgentConfig(workspaceRoot);
  const apiKey =
    process.env["MINIMAX_API_KEY"] ?? config.localSecrets?.[config.userTag.llm.apiKeySecretRef];
  if (apiKey === undefined || apiKey.length === 0) {
    throw new Error("MINIMAX_API_KEY is required or must exist in config localSecrets");
  }

  const logger = new InMemoryLogger();
  await logger.init({
    level: "debug",
    output: "stdout",
    redactKeys: ["apiKey", "api_key", "authorization", "password", "token"]
  });

  const llm = new OpenAiLlmComponent();
  await llm.init(
    {
      model: config.userTag.llm.model,
      modelTier: config.userTag.llm.modelTier,
      apiKeySecretRef: config.userTag.llm.apiKeySecretRef,
      temperature: config.userTag.llm.temperature,
      timeoutMs: config.userTag.llm.timeoutMs,
      maxRetries: config.userTag.llm.maxRetries,
      logMessages: config.userTag.llm.logMessages,
      ...(config.userTag.llm.baseUrl === undefined ? {} : { baseUrl: config.userTag.llm.baseUrl }),
      ...(config.userTag.llm.defaultHeaders === undefined
        ? {}
        : { defaultHeaders: config.userTag.llm.defaultHeaders })
    },
    {
      logger,
      secretProvider: { getSecret: () => Promise.resolve(apiKey) }
    }
  );

  try {
    const service = new TagMatchService({
      tagRepository: fixtureTagRepository(),
      llmClient: llm.chatCompletions,
      logger
    });
    const traceId = `user_tag_real_${randomUUID()}`;
    const result = await service.matchText({
      traceId,
      text: "Lionel Messi scored again for Argentina in a late World Cup qualifier.",
      locale: "en",
      rules: { operator: "or", groups: [{ operator: "or", tag_ids: [1, 2, 3] }] }
    });
    const matchedNames = result.matched_tags.map((tag) => tag.lang_metadata.en).sort();
    const check: CheckResult = {
      name: "user_tag_minimax_structured_match",
      ok: result.matched && matchedNames.includes("Argentina") && matchedNames.includes("Messi"),
      details: {
        matched: result.matched,
        matched_names: matchedNames,
        llm_code: result.llm_result.code,
        llm_data: result.llm_result.data,
        chat_completion_succeeded: countEvents(logger, "foundation.llm.chat_completion_succeeded"),
        tag_match_completed: countEvents(logger, "tag_match.request_completed")
      }
    };
    const report = {
      ok: check.ok,
      duration_ms: Date.now() - startedAt,
      base_url: config.userTag.llm.baseUrl,
      model: config.userTag.llm.model,
      check
    };
    // eslint-disable-next-line no-console -- E2E smoke script prints a machine-readable JSON report.
    console.log(JSON.stringify(report, null, 2));
    if (!check.ok) {
      process.exitCode = 1;
    }
  } finally {
    await llm.close();
  }
};

/**
 * 构造只实现 `findByIds` 的标签仓储替身。
 *
 * 没有参数；返回值按 `PostgresTagRepository` 形状提供给 `TagMatchService`。实现上只读取
 * 本脚本固定标签快照，避免这个 LLM smoke 测试额外依赖真实数据库状态。
 */
const fixtureTagRepository = (): PostgresTagRepository =>
  ({
    findByIds: async (ids: readonly number[]) => {
      await Promise.resolve();
      const idSet = new Set(ids);
      return fixtureTags.filter((tag) => idSet.has(tag.id));
    }
  }) as Pick<PostgresTagRepository, "findByIds"> as PostgresTagRepository;

/**
 * 统计内存日志里的事件数量。
 *
 * @param logger 测试用内存 logger。
 * @param event 需要统计的事件名。实现上读取 logger.entries 顶层 event 字段，用于验证
 * OpenAI SDK 调用和 tag match 流程都真实走到成功日志。
 */
const countEvents = (logger: InMemoryLogger, event: string): number =>
  logger.entries.filter((entry) => entry["event"] === event).length;

await main();
