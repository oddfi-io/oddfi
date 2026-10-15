import { resolve } from "node:path";
import {
  ChatAgentService,
  loadChatAgentContextPrompt,
  loadChatAgentSystemPrompt
} from "./application/chat/chat-agent-service.js";
import { TagMatchService } from "./application/tags/tag-match-service.js";
import { TagSnapshotCache } from "./application/tags/tag-snapshot-cache.js";
import { TweetTagPushService } from "./application/tags/tweet-tag-push-service.js";
import { BraveSearchMcpTool, type RegisteredTool } from "./application/tools/brave-search-mcp.js";
import { FoundationDb } from "./foundation/db/db-component.js";
import { FoundationEmbeddingDb } from "./foundation/embedding-db/embedding-db-component.js";
import { PineconeEmbeddingDbProvider } from "./foundation/embedding-db/embedding-db-provider-pinecone.js";
import { OpenAiLlmComponent, type LlmConfig } from "./foundation/llm/llm-component.js";
import {
  OpenAiLlmEmbeddingComponent,
  type LlmEmbeddingConfig
} from "./foundation/llm/llm-embedding.js";
import { FoundationLogger, type LoggerComponent } from "./foundation/logger/logger-component.js";
import { MemoryComponent } from "./foundation/memory/index.js";
import type { MemoryConfig } from "./foundation/memory/index.js";
import { loadOddAgentConfig } from "./infrastructure/config/load-odd-agent-config.js";
import { assertSingleRuntimeConfigFile } from "./infrastructure/config/runtime-config-policy.js";
import { PostgresConversationRepository } from "./infrastructure/chat/postgres-conversation-repository.js";
import { CentrifugoPublisher } from "./infrastructure/push/centrifugo-publisher.js";
import {
  EnvSecretProvider,
  type SecretProvider
} from "./infrastructure/secrets/env-secret-provider.js";
import { PostgresTagRepository } from "./infrastructure/tags/postgres-tag-repository.js";
import { TweetCatcherListener } from "./infrastructure/tweet-catcher/tweet-catcher-listener.js";
import { buildServer } from "./interface/http/server.js";
import type { OddAgentConfig } from "./models/config/odd-agent-config-model.js";

export type RuntimeApp = {
  readonly start: () => Promise<void>;
  readonly close: () => Promise<void>;
};

type UserTagRuntime = {
  readonly tagRepository: PostgresTagRepository;
  readonly tagMatchService: TagMatchService;
  readonly start: () => Promise<void>;
  readonly close: () => Promise<void>;
};

type ChatAgentRuntime = {
  readonly chatAgentService: ChatAgentService;
  readonly memory: MemoryComponent;
  readonly close: () => Promise<void>;
};

/**
 * 调用流程：组合根初始化。这里是运行时依赖装配的唯一入口，方便排查每个组件从哪里被创建。
 * 入参：workspaceRoot，默认使用当前工作目录。
 * 出参：可启动和关闭的 RuntimeApp；初始化失败会 fail-fast，避免半初始化服务继续对外提供能力。
 */
export const initApp = async (workspaceRoot = resolve(process.cwd())): Promise<RuntimeApp> => {
  await assertSingleRuntimeConfigFile(workspaceRoot);
  const appConfig = await loadOddAgentConfig(workspaceRoot);
  const logger = new FoundationLogger();
  await logger.init({
    level: appConfig.logger.level,
    output: appConfig.logger.output,
    ...(appConfig.logger.directory === undefined
      ? {}
      : { directory: resolve(workspaceRoot, appConfig.logger.directory) }),
    ...(appConfig.logger.filenamePrefix === undefined
      ? {}
      : { filenamePrefix: appConfig.logger.filenamePrefix }),
    redactKeys: appConfig.logger.redactKeys
  });

  const secretProvider = new EnvSecretProvider(appConfig.localSecrets);
  const database = new FoundationDb();
  await database.init(appConfig.db, { logger, secretProvider });

  const userTagRuntime = await initUserTagRuntime({
    appConfig,
    database,
    logger,
    secretProvider
  });
  const chatAgentRuntime = await initChatAgentRuntime({
    appConfig,
    logger,
    secretProvider
  });
  const conversationRepository = new PostgresConversationRepository(database);
  // /internal/* 服务间 token 在启动期解析；secret 缺失直接 fail-fast，禁止无鉴权地暴露 internal 路由。
  const internalServiceToken = await secretProvider.getSecret(
    appConfig.internalAuth.serviceTokenSecretRef
  );
  const server = await buildServer({
    requestTimeoutMs: appConfig.server.requestTimeoutMs,
    logger,
    chatAgentService: chatAgentRuntime.chatAgentService,
    conversationRepository,
    chatTestPagePath: resolve(workspaceRoot, "test", "chat-agent", "chat-test.html"),
    tagRepository: userTagRuntime.tagRepository,
    tagMatchService: userTagRuntime.tagMatchService,
    internalServiceToken,
    // /internal/memory/list 复用 Chat 的 Memory 实例；单次读取上限沿用 memory.max_page_size。
    memoryComponent: chatAgentRuntime.memory,
    memoryMaxPageSize: appConfig.memory.maxPageSize
  });

  // 资源释放集中挂在 Fastify onClose hook 上；显式 close 只触发 server.close，避免同一资源重复关闭。
  const close = async (): Promise<void> => {
    await server.close();
  };

  server.addHook("onClose", async () => {
    await chatAgentRuntime.close();
    await userTagRuntime.close();
    await database.close();
    await logger.close();
  });

  return {
    start: async () => {
      await server.listen({ host: appConfig.server.host, port: appConfig.server.port });
      await userTagRuntime.start();
    },
    close
  };
};

/**
 * 调用流程：初始化单 Agent Chat 运行时依赖。
 * 说明：Chat 使用独立 LLM 实例；Memory v3 在这里拿到 Pinecone provider、Embedding DB
 * 门面、Chat LLM 和 LLM Embedding 后完成初始化，保证 /api/chat 启动前长期记忆链路可用。
 */
const initChatAgentRuntime = async (deps: {
  readonly appConfig: OddAgentConfig;
  readonly logger: LoggerComponent;
  readonly secretProvider: SecretProvider;
}): Promise<ChatAgentRuntime> => {
  const { appConfig, logger, secretProvider } = deps;

  // Chat LLM 是用户可见回答专用 MiniMax OpenAI-compatible 实例。
  const chatLlm = new OpenAiLlmComponent();
  await chatLlm.init(toFoundationLlmConfig(appConfig.chatllm), { logger, secretProvider });

  // Memory LLM 是候选提取和 diff 使用的实例；配置独立于用户可见回答 LLM。
  const memoryLlm = new OpenAiLlmComponent();
  await memoryLlm.init(toFoundationLlmConfig(appConfig.memory.llm), { logger, secretProvider });

  // LLM Embedding 使用 Foundation 独立组件；Memory.search/write 都通过它生成 512 维向量。
  const llmEmbedding = new OpenAiLlmEmbeddingComponent();
  await llmEmbedding.init(toFoundationLlmEmbeddingConfig(appConfig.memory.embeddingLlm), {
    logger,
    secretProvider
  });

  // Pinecone provider 的 endpoint 和 secret 来自 memory.embedding_db，namespace 就是 Memory collection。
  const embeddingDb = new FoundationEmbeddingDb();
  const embeddingDbProvider = new PineconeEmbeddingDbProvider({
    endpoint: appConfig.memory.embeddingDb.endpoint,
    apiKeySecretRef: appConfig.memory.embeddingDb.apiKeySecretRef,
    timeoutMs: appConfig.memory.embeddingDb.timeoutMs,
    maxRetries: appConfig.memory.embeddingDb.maxRetries
  });
  const memory = new MemoryComponent();
  await memory.init(toChatMemoryConfig(appConfig), {
    embeddingDb,
    embeddingDbProvider,
    llm: memoryLlm.chatCompletions,
    llmEmbedding: llmEmbedding.embeddings,
    logger,
    secretProvider
  });

  const registeredTools = buildRegisteredTools(appConfig, logger, secretProvider);
  const chatAgentService = new ChatAgentService({
    llmClient: chatLlm.chatCompletions,
    tools: registeredTools,
    maxToolCalls: appConfig.tools.maxToolCalls,
    memory,
    memoryTopK: appConfig.memory.memoryTopK,
    systemPrompt: await loadChatAgentSystemPrompt(resolve(process.cwd(), "prompts")),
    contextPromptTemplate: await loadChatAgentContextPrompt(resolve(process.cwd(), "prompts")),
    logger
  });

  return {
    chatAgentService,
    memory,
    close: async () => {
      // tool 可能持有 MCP stdio 子进程；先关闭 tool，避免应用退出后留下搜索子进程。
      await Promise.all(registeredTools.map((tool) => tool.close?.() ?? Promise.resolve()));
      await embeddingDb.close();
      await llmEmbedding.close();
      await memoryLlm.close();
      await chatLlm.close();
    }
  };
};

/**
 * 调用流程：根据配置构造 Chat Agent 可用工具。
 * 入参：完整 appConfig、logger 和 secretProvider。
 * 出参：注册给 ChatAgentService 的工具列表。
 */
const buildRegisteredTools = (
  appConfig: OddAgentConfig,
  logger: LoggerComponent,
  secretProvider: SecretProvider
): readonly RegisteredTool[] => {
  const tools: RegisteredTool[] = [];
  if (appConfig.tools.braveSearch.enabled) {
    tools.push(
      new BraveSearchMcpTool(
        {
          enabled: appConfig.tools.braveSearch.enabled,
          apiKeySecretRef: appConfig.tools.braveSearch.apiKeySecretRef,
          command: appConfig.tools.braveSearch.command,
          args: appConfig.tools.braveSearch.args,
          timeoutMs: appConfig.tools.braveSearch.timeoutMs,
          maxResults: appConfig.tools.braveSearch.maxResults,
          country: appConfig.tools.braveSearch.country,
          searchLang: appConfig.tools.braveSearch.searchLang,
          uiLang: appConfig.tools.braveSearch.uiLang,
          safesearch: appConfig.tools.braveSearch.safesearch
        },
        secretProvider,
        logger
      )
    );
  }
  return tools;
};

/**
 * 调用流程：初始化 user-tag 运行时依赖。
 * 说明：user-tag 的 LLM 是功能私有实例；这里统一装配 tag repository、match service、推送和监听任务。
 */
const initUserTagRuntime = async (deps: {
  readonly appConfig: OddAgentConfig;
  readonly database: FoundationDb;
  readonly logger: LoggerComponent;
  readonly secretProvider: SecretProvider;
}): Promise<UserTagRuntime> => {
  const { appConfig, database, logger, secretProvider } = deps;

  // 用户标签有自己的 LLM 对象；不同功能、不同 baseUrl 或不同模型必须创建独立 LLM 实例。
  const tagLlm = new OpenAiLlmComponent();
  await tagLlm.init(toFoundationLlmConfig(appConfig.userTag.llm), { logger, secretProvider });

  const tagRepository = new PostgresTagRepository(database);
  const tagMatchService = new TagMatchService({
    tagRepository,
    llmClient: tagLlm.chatCompletions,
    logger
  });
  const tagSnapshotCache = new TagSnapshotCache({
    tagRepository,
    refreshIntervalMs: appConfig.userTag.snapshotRefreshIntervalMs,
    logger
  });
  const tweetTagPushService = new TweetTagPushService({
    tagSnapshotCache,
    tagMatchService,
    tagRepository,
    publisher: new CentrifugoPublisher({ config: appConfig.centrifugo, secretProvider, logger }),
    logger
  });
  const tweetCatcherListener = new TweetCatcherListener({
    config: appConfig.tweetCatcher,
    secretProvider,
    onTweet: (tweet) => tweetTagPushService.handleTweet(tweet),
    logger
  });

  return {
    tagRepository,
    tagMatchService,
    start: async () => {
      await tagSnapshotCache.start();
      tweetCatcherListener.start();
    },
    close: async () => {
      tweetCatcherListener.stop();
      tagSnapshotCache.stop();
      await tagLlm.close();
    }
  };
};

/**
 * 调用流程：把用户标签功能私有 LLM 配置转换为 foundation LLM 配置。
 * 说明：schema optional 字段在 exactOptionalPropertyTypes 下不能带 undefined，因此这里显式剥掉空字段。
 */
const toFoundationLlmConfig = (config: OddAgentConfig["userTag"]["llm"]): LlmConfig => ({
  model: config.model,
  modelTier: config.modelTier,
  apiKeySecretRef: config.apiKeySecretRef,
  temperature: config.temperature,
  timeoutMs: config.timeoutMs,
  maxRetries: config.maxRetries,
  logMessages: config.logMessages,
  ...(config.baseUrl === undefined ? {} : { baseUrl: config.baseUrl }),
  ...(config.defaultHeaders === undefined ? {} : { defaultHeaders: config.defaultHeaders })
});

/**
 * 调用流程：把配置模型里的 LLM Embedding 配置转换为 foundation 组件配置。
 * 说明：exactOptionalPropertyTypes 下不能把 undefined 显式传给可选字段，所以这里逐项剥离。
 */
const toFoundationLlmEmbeddingConfig = (
  config: OddAgentConfig["memory"]["embeddingLlm"]
): LlmEmbeddingConfig => ({
  model: config.model,
  apiKeySecretRef: config.apiKeySecretRef,
  timeoutMs: config.timeoutMs,
  maxRetries: config.maxRetries,
  ...(config.baseUrl === undefined ? {} : { baseUrl: config.baseUrl }),
  ...(config.dimensions === undefined ? {} : { dimensions: config.dimensions }),
  ...(config.encodingFormat === undefined ? {} : { encodingFormat: config.encodingFormat }),
  ...(config.defaultHeaders === undefined ? {} : { defaultHeaders: config.defaultHeaders })
});

/**
 * 调用流程：生成 Chat Agent 使用的 Memory 配置。
 * 说明：Chat Agent 的 Pinecone namespace 是用户指定的 `oddfi`，因此覆盖 Memory collection；
 * optional payload 限制也在这里剥离 undefined，避免配置对象把空值传入 MemoryConfig。
 */
const toChatMemoryConfig = (config: OddAgentConfig): MemoryConfig => ({
  embeddingCollectionName: config.memory.embeddingCollectionName,
  embeddingDimension: config.memory.embeddingDimension,
  embeddingDistance: config.memory.embeddingDistance,
  defaultTopK: config.memory.defaultTopK,
  maxPageSize: config.memory.maxPageSize,
  minCandidateConfidence: config.memory.minCandidateConfidence,
  minDiffConfidence: config.memory.minDiffConfidence,
  semanticKeys: config.memory.semanticKeys,
  ...(config.memory.maxContentBytes === undefined
    ? {}
    : { maxContentBytes: config.memory.maxContentBytes }),
  ...(config.memory.maxMetadataBytes === undefined
    ? {}
    : { maxMetadataBytes: config.memory.maxMetadataBytes })
});
