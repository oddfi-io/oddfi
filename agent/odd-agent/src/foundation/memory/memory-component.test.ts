import { describe, expect, it } from "vitest";
import { InMemoryLogger } from "../logger/logger-component.js";
import type { FoundationHealth } from "../foundation-types.js";
import type {
  EmbeddingDbConfig,
  EmbeddingDbInitDeps,
  EmbeddingDbProvider,
  EmbeddingRecord,
  EmbeddingSearchResult,
  EmbeddingUpsertCommand
} from "../embedding-db/embedding-db-component.js";
import type { OpenAiChatCompletionClient } from "../llm/llm-component.js";
import type { OpenAiEmbeddingClient } from "../llm/llm-embedding.js";
import {
  MemoryComponent,
  formatMemorySearchContext,
  type MemoryConfig
} from "./memory-component.js";

const config: MemoryConfig = {
  embeddingCollectionName: "memory_test_vectors",
  embeddingDimension: 16,
  embeddingDistance: "cosine",
  defaultTopK: 5,
  maxPageSize: 50,
  minCandidateConfidence: 0.55,
  minDiffConfidence: 0.55,
  semanticKeys: {
    profile: ["profile.*"],
    preference: ["preference.*"],
    current_state: ["current_state.*"],
    event: ["event.*"],
    project_state: ["project_state.*"]
  },
  promptDir: "prompts"
};

describe("MemoryComponent", () => {
  it("adds a new durable profile memory into EmbeddingDb", async () => {
    const deps = createDeps();
    deps.llm.queueCandidate({
      text: "用户主要写 Rust。",
      type: "profile",
      semantic_key: "profile.programming_language",
      subject: "用户",
      predicate: "writes",
      object: "Rust",
      polarity: "positive",
      confidence: 0.92,
      importance: 4,
      reason: "user stated current language",
      metadata: { tags: ["coding"], llmConfidence: 0.92 }
    });
    deps.llm.queueDiff({
      action: "ADD",
      target_id: null,
      new_memory: null,
      reason: "new fact",
      confidence: 0.9
    });
    const memory = new MemoryComponent();
    await memory.init(config, deps);

    const result = await memory.write({
      traceId: "trace_add",
      userId: "user_1",
      conversationId: "conv_1",
      message: "我现在主要写 Rust。"
    });

    expect(result[0]?.action).toBe("ADD");
    expect(result[0]?.reason).toBe("new fact");
    expect(result[0]?.confidence).toBe(0.9);
    expect(result[0]?.newMemory?.text).toBe("用户主要写 Rust。");
    expect(deps.embeddingDb.initCalls[0]?.config).toMatchObject({
      collectionName: "memory_test_vectors",
      dimension: 16,
      distance: "cosine",
      topKDefault: 5
    });
    expect(deps.embeddingDb.initCalls[0]?.providerName).toBe("memory_fake_provider");
    expect(deps.embeddingDb.records).toHaveLength(1);
    expect(deps.embeddingDb.records[0]?.metadata.conversationId).toBe("conv_1");
    expect(deps.embeddingDb.records[0]?.metadata.sourceMessageId).toMatch(/^msg_/u);
    expect(deps.llmEmbedding.calls.map((call) => call.text)).toContain("用户主要写 Rust。");
  });

  it("updates an existing memory when diff targets a retrieved semantic slot", async () => {
    const deps = createDeps();
    deps.embeddingDb.seedMemory({
      userId: "user_1",
      id: "mem_existing",
      content: "用户喜欢 Java。",
      metadata: storedMetadata({
        memoryId: "mem_existing",
        type: "preference",
        semanticKey: "preference.language",
        text: "用户喜欢 Java。",
        confidence: 0.8,
        importance: 3
      })
    });
    deps.llm.queueCandidate({
      text: "用户现在更喜欢 Rust。",
      type: "preference",
      semantic_key: "preference.language",
      confidence: 0.91,
      importance: 4,
      metadata: { tags: ["coding"], llmConfidence: 0.91 }
    });
    deps.llm.queueDiff({
      action: "UPDATE",
      target_id: "mem_existing",
      new_memory: {
        text: "用户现在更喜欢 Rust。",
        type: "preference",
        semantic_key: "preference.language",
        confidence: 0.9,
        importance: 4,
        metadata: { tags: ["coding"], llmConfidence: 0.9 }
      },
      reason: "same semantic slot changed",
      confidence: 0.88
    });
    const memory = new MemoryComponent();
    await memory.init(config, deps);

    const result = await memory.write({
      traceId: "trace_update",
      userId: "user_1",
      conversationId: "conv_2",
      message: "我现在更喜欢 Rust，不怎么用 Java 了。"
    });

    expect(result[0]?.action).toBe("UPDATE");
    expect(deps.embeddingDb.records).toHaveLength(1);
    expect(deps.embeddingDb.records[0]?.content).toBe("用户现在更喜欢 Rust。");
    expect(deps.embeddingDb.records[0]?.metadata.conversationId).toBe("conv_2");
  });

  it("forces event memories to add-only without calling MemoryDiff", async () => {
    const deps = createDeps();
    deps.embeddingDb.seedMemory({
      userId: "user_1",
      id: "mem_event_old",
      content: "用户参加过旧活动。",
      metadata: storedMetadata({
        memoryId: "mem_event_old",
        type: "event",
        semanticKey: "event.workshop",
        text: "用户参加过旧活动。",
        confidence: 0.8,
        importance: 3
      })
    });
    deps.llm.queueCandidate({
      text: "用户参加了 Rust 工作坊。",
      type: "event",
      semantic_key: "event.workshop",
      confidence: 0.87,
      importance: 3,
      metadata: { tags: ["event"] }
    });
    const memory = new MemoryComponent();
    await memory.init(config, deps);

    const result = await memory.write({
      userId: "user_1",
      conversationId: "conv_event",
      message: "昨天我参加了 Rust 工作坊。"
    });

    expect(result[0]?.action).toBe("ADD");
    expect(deps.llm.diffCalls).toBe(0);
    expect(deps.embeddingDb.records).toHaveLength(2);
  });

  it("turns invalid semantic keys and unsafe target ids into NOOP", async () => {
    const deps = createDeps();
    deps.llm.queueCandidate({
      text: "用户喜欢 Go。",
      type: "preference",
      semantic_key: "unsafe.key",
      confidence: 0.95,
      importance: 3,
      metadata: {}
    });
    const memory = new MemoryComponent();
    await memory.init(config, deps);

    const invalid = await memory.write({
      userId: "user_1",
      conversationId: "conv_invalid",
      message: "我喜欢 Go。"
    });
    expect(invalid[0]).toMatchObject({ action: "NOOP" });
    expect(deps.embeddingDb.records).toHaveLength(0);

    deps.llm.queueCandidate({
      text: "用户喜欢 Go。",
      type: "preference",
      semantic_key: "preference.language",
      confidence: 0.95,
      importance: 3,
      metadata: {}
    });
    deps.llm.queueDiff({
      action: "DELETE",
      target_id: "mem_other_user",
      new_memory: null,
      reason: "unsafe target",
      confidence: 0.9
    });
    const unsafe = await memory.write({
      userId: "user_1",
      conversationId: "conv_unsafe",
      message: "我不喜欢 Go。"
    });

    expect(unsafe[0]).toMatchObject({
      action: "NOOP",
      reason: "target_id is not in retrieved memories"
    });
  });

  it("searches, lists, formats context, and deletes only within the user scope", async () => {
    const deps = createDeps();
    deps.embeddingDb.seedMemory({
      userId: "user_1",
      id: "mem_1",
      content: "用户是后端工程师。",
      score: 0.93,
      metadata: storedMetadata({
        memoryId: "mem_1",
        type: "profile",
        semanticKey: "profile.role",
        text: "用户是后端工程师。",
        confidence: 0.9,
        importance: 5,
        tags: ["work"]
      })
    });
    deps.embeddingDb.seedMemory({
      userId: "user_2",
      id: "mem_2",
      content: "其他用户是设计师。",
      score: 0.99,
      metadata: storedMetadata({
        memoryId: "mem_2",
        type: "profile",
        semanticKey: "profile.role",
        text: "其他用户是设计师。",
        confidence: 0.9,
        importance: 5,
        tags: ["work"]
      })
    });
    const memory = new MemoryComponent();
    await memory.init(config, deps);

    const searched = await memory.search({ userId: "user_1", query: "用户职业", topK: 5 });
    expect(searched.map((item) => item.id)).toEqual(["mem_1"]);
    expect(formatMemorySearchContext(searched)).toContain("user_memories");
    expect(formatMemorySearchContext(searched)).not.toContain("mem_1");

    const listed = await memory.list({ userId: "user_1", filters: { tags: ["work"] } });
    expect(listed.map((item) => item.id)).toEqual(["mem_1"]);

    await expect(memory.delete({ userId: "user_2", memoryId: "mem_1" })).rejects.toMatchObject({
      code: "MEMORY_NOT_FOUND"
    });
    await memory.delete({ userId: "user_1", memoryId: "mem_1", reason: "用户要求删除" });
    expect(deps.embeddingDb.records.find((row) => row.id === "mem_1")?.metadata.active).toBe(false);
    expect(deps.embeddingDb.records.find((row) => row.id === "mem_1")?.metadata.deletedAt).toEqual(
      expect.any(String)
    );
    const afterDelete = await memory.search({ userId: "user_1", query: "用户职业", topK: 5 });
    expect(afterDelete).toEqual([]);
  });
});

type StoredMetadata = {
  memoryComponent: "long_term";
  memoryId: string;
  active: boolean;
  type: string;
  semanticKey: string;
  confidence: number;
  importance: number;
  conversationId: string;
  sourceMessageId: string;
  validFrom: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  tags?: string[];
  llmConfidence?: number;
};

const createDeps = (): {
  readonly embeddingDb: MemoryEmbeddingFake;
  readonly embeddingDbProvider: MemoryEmbeddingFakeProvider;
  readonly llm: MemoryLlmFake;
  readonly llmEmbedding: MemoryLlmEmbeddingFake;
  readonly logger: InMemoryLogger;
} => ({
  embeddingDb: new MemoryEmbeddingFake(),
  embeddingDbProvider: new MemoryEmbeddingFakeProvider(),
  llm: new MemoryLlmFake(),
  llmEmbedding: new MemoryLlmEmbeddingFake(config.embeddingDimension),
  logger: new InMemoryLogger()
});

class MemoryEmbeddingFake {
  readonly records: {
    readonly userId: string;
    readonly id: string;
    readonly content: string;
    readonly metadata: StoredMetadata;
    readonly score: number;
  }[] = [];
  readonly deletedFilters: { readonly userId: string; readonly filter: unknown }[] = [];
  readonly initCalls: {
    readonly config: EmbeddingDbConfig;
    readonly providerName: string;
  }[] = [];

  init(config: EmbeddingDbConfig, deps: EmbeddingDbInitDeps): Promise<void> {
    this.initCalls.push({ config, providerName: deps.provider.name });
    return Promise.resolve();
  }

  healthCheck(): Promise<FoundationHealth> {
    return Promise.resolve({
      status: "healthy",
      message: "ok",
      checkedAt: new Date().toISOString()
    });
  }

  upsert<TMetadata>(command: EmbeddingUpsertCommand<TMetadata>): Promise<void> {
    const index = this.records.findIndex(
      (row) => row.userId === command.userId && row.id === command.id
    );
    const record = {
      userId: command.userId,
      id: command.id,
      content: command.content,
      metadata: command.metadata as StoredMetadata,
      score: 1
    };
    if (index >= 0) {
      this.records[index] = record;
    } else {
      this.records.push(record);
    }
    return Promise.resolve();
  }

  getById<TMetadata>(command: {
    readonly userId: string;
    readonly id: string;
  }): Promise<
    { readonly id: string; readonly content: string; readonly metadata: TMetadata } | undefined
  > {
    const row = this.records.find(
      (item) => item.userId === command.userId && item.id === command.id
    );
    return Promise.resolve(
      row === undefined
        ? undefined
        : { id: row.id, content: row.content, metadata: row.metadata as TMetadata }
    );
  }

  list<TFilter, TMetadata>(command: {
    readonly userId: string;
    readonly filter: TFilter;
    readonly page?: number;
    readonly pageSize?: number;
  }): Promise<
    readonly { readonly id: string; readonly content: string; readonly metadata: TMetadata }[]
  > {
    const page = command.page ?? 1;
    const pageSize = command.pageSize ?? 5;
    return Promise.resolve(
      this.records
        .filter(
          (row) => row.userId === command.userId && jsonContains(row.metadata, command.filter)
        )
        .sort((left, right) => right.metadata.updatedAt.localeCompare(left.metadata.updatedAt))
        .slice((page - 1) * pageSize, page * pageSize)
        .map((row) => ({ id: row.id, content: row.content, metadata: row.metadata as TMetadata }))
    );
  }

  search<TFilter, TMetadata>(command: {
    readonly userId: string;
    readonly filter: TFilter;
    readonly topK?: number;
  }): Promise<readonly EmbeddingSearchResult<TMetadata>[]> {
    return Promise.resolve(
      this.records
        .filter(
          (row) => row.userId === command.userId && jsonContains(row.metadata, command.filter)
        )
        .sort((left, right) => right.score - left.score)
        .slice(0, command.topK ?? 5)
        .map((row) => ({
          id: row.id,
          content: row.content,
          metadata: row.metadata as TMetadata,
          score: row.score
        }))
    );
  }

  deleteByFilter(userId: string, filter: unknown): Promise<number> {
    this.deletedFilters.push({ userId, filter });
    const before = this.records.length;
    for (let index = this.records.length - 1; index >= 0; index -= 1) {
      const row = this.records[index];
      if (row?.userId === userId && jsonContains(row.metadata, filter)) {
        this.records.splice(index, 1);
      }
    }
    return Promise.resolve(before - this.records.length);
  }

  seedMemory(input: {
    readonly userId: string;
    readonly id: string;
    readonly content: string;
    readonly metadata: StoredMetadata;
    readonly score?: number;
  }): void {
    this.records.push({ ...input, score: input.score ?? 1 });
  }
}

class MemoryEmbeddingFakeProvider implements EmbeddingDbProvider {
  readonly name = "memory_fake_provider";

  init(): Promise<void> {
    return Promise.resolve();
  }

  healthCheck(): Promise<FoundationHealth> {
    return Promise.resolve({
      status: "healthy",
      message: "ok",
      checkedAt: new Date().toISOString()
    });
  }

  upsert(): Promise<void> {
    return Promise.resolve();
  }

  search<TMetadata>(): Promise<readonly EmbeddingSearchResult<TMetadata>[]> {
    return Promise.resolve([]);
  }

  getById<TMetadata>(): Promise<EmbeddingRecord<TMetadata> | undefined> {
    return Promise.resolve(undefined);
  }

  list<TMetadata>(): Promise<readonly EmbeddingRecord<TMetadata>[]> {
    return Promise.resolve([]);
  }

  deleteByFilter(): Promise<number> {
    return Promise.resolve(0);
  }

  deleteByUser(): Promise<number> {
    return Promise.resolve(0);
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}

class MemoryLlmFake {
  readonly model = "memory-test-model";
  readonly temperature = 0;
  readonly candidates: unknown[] = [];
  readonly diffs: unknown[] = [];
  diffCalls = 0;

  queueCandidate(candidate: unknown): void {
    this.candidates.push(candidate);
  }

  queueDiff(diff: unknown): void {
    this.diffs.push(diff);
  }

  stream(): never {
    throw new Error("stream is not used by MemoryComponent tests");
  }

  create(command: Parameters<OpenAiChatCompletionClient["create"]>[0]) {
    const schemaName =
      command.response_format?.type === "json_schema"
        ? command.response_format.json_schema.name
        : "";
    if (schemaName === "MemoryCandidateExtraction") {
      const jsonPayload = { candidates: [this.candidates.shift()] };
      return Promise.resolve(openAiCompletion(JSON.stringify(jsonPayload)));
    }
    this.diffCalls += 1;
    const jsonPayload = this.diffs.shift() as Record<string, unknown>;
    return Promise.resolve(openAiCompletion(JSON.stringify(jsonPayload)));
  }
}

class MemoryLlmEmbeddingFake implements OpenAiEmbeddingClient {
  readonly model = "memory-test-embedding";
  readonly dimensions: number;
  readonly calls: { readonly text: string; readonly dimensions?: number }[] = [];

  constructor(dimensions: number) {
    this.dimensions = dimensions;
  }

  create(): never {
    throw new Error("raw embedding create is not used by MemoryComponent tests");
  }

  embedText(text: string, options?: { readonly dimensions?: number }): Promise<readonly number[]> {
    this.calls.push({
      text,
      ...(options?.dimensions === undefined ? {} : { dimensions: options.dimensions })
    });
    const dimension = options?.dimensions ?? this.dimensions;
    return Promise.resolve(
      Array.from({ length: dimension }, (_value, index) => (index === 0 ? 1 : 0))
    );
  }

  embedTexts(): never {
    throw new Error("batch embedding is not used by MemoryComponent tests");
  }
}

const openAiCompletion = (content: string) => ({
  id: "chatcmpl_memory_test",
  object: "chat.completion" as const,
  created: 0,
  model: "memory-test-model",
  choices: [
    {
      index: 0,
      message: { role: "assistant" as const, content, refusal: null },
      finish_reason: "stop" as const,
      logprobs: null
    }
  ],
  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
});

const storedMetadata = (input: {
  readonly memoryId: string;
  readonly type: string;
  readonly semanticKey: string;
  readonly text: string;
  readonly confidence: number;
  readonly importance: number;
  readonly tags?: string[];
}): StoredMetadata => {
  const now = new Date().toISOString();
  return {
    memoryComponent: "long_term",
    memoryId: input.memoryId,
    active: true,
    type: input.type,
    semanticKey: input.semanticKey,
    confidence: input.confidence,
    importance: input.importance,
    conversationId: "conv_seed",
    sourceMessageId: "msg_seed",
    validFrom: now,
    createdAt: now,
    updatedAt: now,
    ...(input.tags === undefined ? {} : { tags: input.tags })
  };
};

const jsonContains = (metadata: unknown, filter: unknown): boolean => {
  if (!isRecord(metadata) || !isRecord(filter)) {
    return false;
  }
  return Object.entries(filter).every(([key, value]) => {
    const actual = metadata[key];
    if (isRecord(value)) {
      return jsonContains(actual, value);
    }
    return actual === value;
  });
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
