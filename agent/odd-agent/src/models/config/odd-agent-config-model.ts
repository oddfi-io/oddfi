import { z } from "zod";

export const serverConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().positive(),
  requestTimeoutMs: z.number().int().positive()
});

export const loggerConfigSchema = z.object({
  level: z.enum(["debug", "info", "warn", "error"]),
  output: z.enum(["stdout", "file"]),
  directory: z.string().min(1).optional(),
  filenamePrefix: z.string().min(1).optional(),
  redactKeys: z.array(z.string().min(1)).default([])
});

export const dbConfigSchema = z.object({
  provider: z.literal("postgres"),
  connectionStringSecretRef: z.string().min(1),
  maxPoolSize: z.number().int().positive(),
  statementTimeoutMs: z.number().int().positive(),
  idleTimeoutMs: z.number().int().positive(),
  ssl: z.boolean().default(false)
});

export const redisConfigSchema = z.object({
  urlSecretRef: z.string().min(1),
  keyPrefix: z.string().min(1),
  commandTimeoutMs: z.number().int().positive(),
  maxRetries: z.number().int().min(0),
  defaultTtlSeconds: z.number().int().positive().optional()
});

export const embeddingDbConfigSchema = z.object({
  collectionName: z.string().min(1),
  dimension: z.number().int().positive(),
  distance: z.enum(["cosine", "dot", "l2"]),
  topKDefault: z.number().int().positive(),
  maxContentBytes: z.number().int().positive().default(65_536),
  maxMetadataBytes: z.number().int().positive().default(16_384)
});

export const llmConfigSchema = z.object({
  model: z.string().min(1),
  modelTier: z.enum(["cheap", "standard", "strong"]),
  baseUrl: z.string().url().optional(),
  apiKeySecretRef: z.string().min(1),
  temperature: z.number().min(0).max(2),
  timeoutMs: z.number().int().positive(),
  maxRetries: z.number().int().min(0),
  defaultHeaders: z.record(z.string(), z.string()).optional(),
  logMessages: z.boolean().default(false)
});

export const braveSearchMcpToolConfigSchema = z.object({
  enabled: z.boolean().default(false),
  apiKeySecretRef: z.string().min(1),
  command: z.string().min(1),
  args: z.array(z.string().min(1)).default([]),
  timeoutMs: z.number().int().positive(),
  maxResults: z.number().int().positive().max(20),
  country: z.string().min(2).max(3).default("US"),
  searchLang: z.string().min(2).default("en"),
  uiLang: z.string().min(2).default("en-US"),
  safesearch: z.enum(["off", "moderate", "strict"]).default("moderate")
});

export const toolsConfigSchema = z.object({
  maxToolCalls: z.number().int().min(0).max(100).default(100),
  braveSearch: braveSearchMcpToolConfigSchema
});

export const llmEmbeddingConfigSchema = z.object({
  model: z.string().min(1),
  baseUrl: z.string().url().optional(),
  apiKeySecretRef: z.string().min(1),
  timeoutMs: z.number().int().positive(),
  maxRetries: z.number().int().min(0),
  dimensions: z.number().int().positive().optional(),
  encodingFormat: z.enum(["float", "base64"]).optional(),
  defaultHeaders: z.record(z.string(), z.string()).optional()
});

export const foundationConfigSchema = z.object({
  logger: loggerConfigSchema,
  db: dbConfigSchema,
  redis: redisConfigSchema,
  embeddingDb: embeddingDbConfigSchema,
  llmEmbedding: llmEmbeddingConfigSchema
});

export const memoryEmbeddingDbConfigSchema = z.object({
  provider: z.literal("pinecone"),
  endpoint: z.string().url(),
  apiKeySecretRef: z.string().min(1),
  namespace: z.string().min(1),
  timeoutMs: z.number().int().positive(),
  maxRetries: z.number().int().min(0)
});

const memorySemanticKeysConfigSchema = z
  .object({
    profile: z.array(z.string().min(1)).min(1),
    preference: z.array(z.string().min(1)).min(1),
    currentState: z.array(z.string().min(1)).min(1),
    event: z.array(z.string().min(1)).min(1),
    projectState: z.array(z.string().min(1)).min(1)
  })
  .transform((value) => ({
    profile: value.profile,
    preference: value.preference,
    current_state: value.currentState,
    event: value.event,
    project_state: value.projectState
  }));

export const memoryConfigSchema = z.object({
  memoryTopK: z.number().int().positive(),
  embeddingCollectionName: z.string().min(1),
  embeddingDimension: z.number().int().positive(),
  embeddingDistance: z.enum(["cosine", "dot", "l2"]),
  defaultTopK: z.number().int().positive(),
  maxContentBytes: z.number().int().positive().optional(),
  maxMetadataBytes: z.number().int().positive().optional(),
  maxPageSize: z.number().int().positive(),
  minCandidateConfidence: z.number().min(0).max(1),
  minDiffConfidence: z.number().min(0).max(1),
  semanticKeys: memorySemanticKeysConfigSchema,
  llm: llmConfigSchema,
  embeddingLlm: llmEmbeddingConfigSchema,
  embeddingDb: memoryEmbeddingDbConfigSchema
});

export const centrifugoConfigSchema = z.object({
  provider: z.literal("centrifugo"),
  endpoint: z.string().url(),
  apiKeySecretRef: z.string().min(1),
  // tag 频道模板：保留供历史/调试维度发布（{tag_name} 占位）。
  channelTemplateTag: z.string().min(1),
  // user 频道模板：fan-out 命中推文到订阅者各自的个人频道（{user_id} 占位）。
  // 必须与主后端给前端签发的连接 token 授权频道逐字一致，默认 "user#{user_id}"。
  channelTemplateUser: z.string().min(1).default("user#{user_id}")
});

export const tweetCatcherConfigSchema = z.object({
  websocketEndpoint: z.string().url(),
  apiKeySecretRef: z.string().min(1),
  readyTimeoutMs: z.number().int().positive(),
  eventWaitMs: z.number().int().min(0),
  heartbeatIntervalMs: z.number().int().positive(),
  reconnectInitialDelayMs: z.number().int().positive(),
  reconnectMaxDelayMs: z.number().int().positive()
});

export const userTagConfigSchema = z.object({
  snapshotRefreshIntervalMs: z.number().int().positive(),
  llm: llmConfigSchema
});

export const localSecretsConfigSchema = z.record(z.string().min(1), z.string().min(1));

// internal_auth 是 /internal/* 服务间鉴权配置；token 走 secretRef，禁止把明文写进 YAML。
export const internalAuthConfigSchema = z.object({
  serviceTokenSecretRef: z.string().min(1)
});

export const oddAgentConfigSchema = z.strictObject({
  server: serverConfigSchema,
  logger: loggerConfigSchema,
  db: dbConfigSchema,
  redis: redisConfigSchema,
  centrifugo: centrifugoConfigSchema,
  internalAuth: internalAuthConfigSchema,
  tweetCatcher: tweetCatcherConfigSchema,
  userTag: userTagConfigSchema,
  chatllm: llmConfigSchema,
  tools: toolsConfigSchema,
  memory: memoryConfigSchema,
  localSecrets: localSecretsConfigSchema.optional()
});

export type ServerConfig = z.infer<typeof serverConfigSchema>;
export type LoggerConfig = z.infer<typeof loggerConfigSchema>;
export type DbConfig = z.infer<typeof dbConfigSchema>;
export type RedisConfig = z.infer<typeof redisConfigSchema>;
export type EmbeddingDbConfig = z.infer<typeof embeddingDbConfigSchema>;
export type LlmConfig = z.infer<typeof llmConfigSchema>;
export type BraveSearchMcpToolConfig = z.infer<typeof braveSearchMcpToolConfigSchema>;
export type ToolsConfig = z.infer<typeof toolsConfigSchema>;
export type LlmEmbeddingConfig = z.infer<typeof llmEmbeddingConfigSchema>;
export type FoundationConfig = z.infer<typeof foundationConfigSchema>;
export type MemoryConfig = z.infer<typeof memoryConfigSchema>;
export type CentrifugoConfig = z.infer<typeof centrifugoConfigSchema>;
export type PushConfig = CentrifugoConfig;
export type TweetCatcherConfig = z.infer<typeof tweetCatcherConfigSchema>;
export type UserTagConfig = z.infer<typeof userTagConfigSchema>;
export type MemoryEmbeddingDbConfig = z.infer<typeof memoryEmbeddingDbConfigSchema>;
export type LocalSecretsConfig = z.infer<typeof localSecretsConfigSchema>;
export type InternalAuthConfig = z.infer<typeof internalAuthConfigSchema>;
export type OddAgentConfig = z.infer<typeof oddAgentConfigSchema>;
