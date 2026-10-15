import { nowIso } from "../foundation-types.js";
import type {
  EmbeddingDbConfig,
  EmbeddingDbProvider,
  EmbeddingGetCommand,
  EmbeddingListCommand,
  EmbeddingRecord,
  EmbeddingSearchCommand,
  EmbeddingSearchResult,
  EmbeddingUpsertCommand,
  EmbeddingVector
} from "./embedding-db-types.js";
import { jsonContains, memoryKey, score } from "./embedding-db-utils.js";

type StoredVector = {
  readonly userId: string;
  readonly id: string;
  readonly vector: EmbeddingVector;
  readonly content: string;
  readonly metadata: unknown;
};

/**
 * 单元测试和本地确定性校验使用的内存 provider。
 *
 * 这个 provider 复用生产 provider 的 userId 隔离和 JSON 子集匹配语义，
 * 但数据只保存在当前进程内，所以健康状态会刻意标记为 degraded。
 */
export class MemoryEmbeddingDbProvider implements EmbeddingDbProvider {
  readonly name = "memory";
  #config: EmbeddingDbConfig | undefined;
  readonly #vectors = new Map<string, StoredVector>();

  /**
   * 保存 EmbeddingDb 公共配置。
   *
   * @param config Foundation 公共配置；内存 provider 主要使用其中的 distance 进行本地打分。
   *
   * 这里没有外部资源要初始化；保留 config 是为了让 search 使用和生产一致的
   * 距离打分语义。
   */
  init(config: EmbeddingDbConfig): Promise<void> {
    this.#config = config;
    return Promise.resolve();
  }

  /**
   * 返回 degraded 健康状态，因为内存 provider 不具备持久化能力。
   *
   * 参数：无。
   *
   * 实现方式：直接返回固定健康对象；不访问外部资源。
   */
  healthCheck() {
    return Promise.resolve({
      status: "degraded" as const,
      message: "embedding db initialized with in-memory backing",
      checkedAt: nowIso()
    });
  }

  /**
   * 清空当前进程内保存的所有向量。
   *
   * 参数：无。
   *
   * 测试会在场景之间调用 close，避免上一轮数据泄漏到下一轮。
   */
  close(): Promise<void> {
    this.#vectors.clear();
    return Promise.resolve();
  }

  /**
   * 按 `(userId,id)` 写入或覆盖一条向量。
   *
   * @param command 写入命令；`userId` 和 `id` 组成 Map key，`vector/content/metadata`
   * 原样保存到内存。
   *
   * 复合 key 模拟生产 provider 的隔离方式，确保不同用户的相同业务 id
   * 不会互相覆盖。
   */
  upsert(command: EmbeddingUpsertCommand<Record<string, unknown>>): Promise<void> {
    // vector 使用浅拷贝保存，避免调用方后续修改数组影响内存 provider 中的测试数据。
    this.#vectors.set(memoryKey(command.userId, command.id), {
      userId: command.userId,
      id: command.id,
      vector: [...command.vector],
      content: command.content,
      metadata: command.metadata
    });
    return Promise.resolve();
  }

  /**
   * 在单个 userId 边界内执行向量检索。
   *
   * @param command 检索命令；`userId` 用于隔离，`filter` 用 JSON 子集语义匹配 metadata，
   * `vector` 用于计算本地 score。
   * @param topK 最大召回数量。
   *
   * 实现方式：先筛选同 userId 且 metadata 命中的记录，再按 configured distance 算分并降序排序。
   *
   * 过滤会先于打分执行，用来对齐 provider 契约：租户隔离
   * 和 metadata 过滤必须发生在 topK 截断之前。
   */
  search<TFilter, TMetadata>(
    command: EmbeddingSearchCommand<TFilter>,
    topK: number
  ): Promise<readonly EmbeddingSearchResult<TMetadata>[]> {
    const config = this.#requireConfig();
    return Promise.resolve(
      [...this.#vectors.values()]
        .filter(
          (item) => item.userId === command.userId && jsonContains(item.metadata, command.filter)
        )
        .map((item) => ({
          id: item.id,
          content: item.content,
          metadata: item.metadata as TMetadata,
          score: score(config.distance, command.vector, item.vector)
        }))
        .sort((left, right) => right.score - left.score)
        .slice(0, topK)
    );
  }

  /**
   * 使用写入时相同的复合 key 读取单条记录。
   *
   * @param command 精确读取命令；`userId` 和 `id` 会组成与 upsert 相同的内存 key。
   *
   * 实现方式：直接从 Map 读取，找不到时返回 undefined。
   */
  getById<TMetadata>(
    command: EmbeddingGetCommand
  ): Promise<EmbeddingRecord<TMetadata> | undefined> {
    const item = this.#vectors.get(memoryKey(command.userId, command.id));
    return Promise.resolve(
      item === undefined
        ? undefined
        : { id: item.id, content: item.content, metadata: item.metadata as TMetadata }
    );
  }

  /**
   * 按 JSON 子集 metadata filter 列出记录。
   *
   * @param command 列表命令；`userId` 用于隔离，`filter` 用于 metadata 子集匹配。
   * @param page 页码，从 1 开始。
   * @param pageSize 每页数量。
   *
   * 实现方式：先过滤 userId 和 metadata，再 slice 当前页，不计算向量分数。
   *
   * list 模式不计算向量分数；分页会在 userId 和 metadata 过滤之后执行。
   */
  list<TFilter, TMetadata>(
    command: EmbeddingListCommand<TFilter>,
    page: number,
    pageSize: number
  ): Promise<readonly EmbeddingRecord<TMetadata>[]> {
    return Promise.resolve(
      [...this.#vectors.values()]
        .filter(
          (item) => item.userId === command.userId && jsonContains(item.metadata, command.filter)
        )
        .slice((page - 1) * pageSize, page * pageSize)
        .map((item) => ({
          id: item.id,
          content: item.content,
          metadata: item.metadata as TMetadata
        }))
    );
  }

  /**
   * 删除单个 userId 下匹配 metadata filter 的记录。
   *
   * @param userId 要删除的用户边界。
   * @param filter 业务 metadata 条件。
   *
   * 实现方式：复用内部删除循环，返回被删除的 Map entry 数量。
   */
  deleteByFilter<TFilter>(userId: string, filter: TFilter): Promise<number> {
    return Promise.resolve(this.#delete(userId, filter));
  }

  /**
   * 删除一个 userId 下的全部记录。
   *
   * @param userId 要删除的用户边界。
   *
   * 实现方式：复用内部删除循环，并传入 undefined filter 表示仅按 userId 匹配。
   */
  deleteByUser(userId: string): Promise<number> {
    return Promise.resolve(this.#delete(userId, undefined));
  }

  /**
   * deleteByFilter 和 deleteByUser 共享的删除循环。
   *
   * @param userId 要删除的用户边界。
   * @param filter 可选业务 filter；undefined 表示删除该 userId 下全部记录。
   *
   * 实现方式：遍历 Map，命中 userId 且 filter 匹配时删除当前 entry，并累计删除数量。
   */
  #delete<TFilter>(userId: string, filter: TFilter | undefined): number {
    let deleted = 0;
    for (const [id, item] of this.#vectors.entries()) {
      if (item.userId === userId && (filter === undefined || jsonContains(item.metadata, filter))) {
        this.#vectors.delete(id);
        deleted += 1;
      }
    }
    return deleted;
  }

  #requireConfig(): EmbeddingDbConfig {
    if (this.#config === undefined) {
      throw new Error("memory embedding provider is not initialized");
    }
    return this.#config;
  }
}
