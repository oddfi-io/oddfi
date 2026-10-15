import type { FoundationHealth, FoundationInitDeps } from "../foundation-types.js";

export type EmbeddingDbConfig = {
  /** Provider 存储分区名；pgvector 中是表名，Qdrant/Chroma/Milvus 中是 collection，Pinecone 中是 namespace。 */
  readonly collectionName: string;
  /** 向量维度；组件会在写入和检索前用它校验 vector.length，避免 provider 接收错误维度。 */
  readonly dimension: number;
  /** 距离度量；provider 用它创建索引或映射检索表达式，返回分数统一为越大越相似。 */
  readonly distance: "cosine" | "dot" | "l2";
  /** 默认召回条数；search/list 调用没有传 topK/pageSize 时使用该值。 */
  readonly topKDefault: number;
  /** content 最大 UTF-8 字节数；超过后组件在 I/O 前拒绝，防止向量库 payload 膨胀。 */
  readonly maxContentBytes?: number;
  /** metadata 序列化后的最大 UTF-8 字节数；超过后组件在 I/O 前拒绝。 */
  readonly maxMetadataBytes?: number;
};

export type EmbeddingVector = readonly number[];

export type EmbeddingUpsertCommand<TMetadata> = {
  readonly traceId?: string;
  readonly userId: string;
  readonly id: string;
  readonly vector: EmbeddingVector;
  readonly content: string;
  readonly metadata: TMetadata;
};

export type EmbeddingSearchCommand<TFilter> = {
  readonly traceId?: string;
  readonly userId: string;
  readonly vector: EmbeddingVector;
  readonly filter: TFilter;
  readonly topK?: number;
};

export type EmbeddingGetCommand = {
  readonly traceId?: string;
  readonly userId: string;
  readonly id: string;
};

export type EmbeddingListCommand<TFilter> = {
  readonly traceId?: string;
  readonly userId: string;
  readonly filter: TFilter;
  readonly page?: number;
  readonly pageSize?: number;
};

export type EmbeddingRecord<TMetadata> = {
  readonly id: string;
  readonly content: string;
  readonly metadata: TMetadata;
};

export type EmbeddingSearchResult<TMetadata> = EmbeddingRecord<TMetadata> & {
  readonly score: number;
};

export type EmbeddingDbProvider = {
  /** Provider 名称；只用于日志、测试报告和诊断，不参与业务隔离。 */
  readonly name: string;
  /** 初始化 provider 资源；config 是 Foundation 公共配置，deps 用于读取 logger/secret 等基础依赖。 */
  init(config: EmbeddingDbConfig, deps?: FoundationInitDeps): Promise<void>;
  /** 返回 provider 健康状态；正常健康探测路径应返回 unhealthy/degraded，而不是把连接异常直接抛给调用方。 */
  healthCheck(): Promise<FoundationHealth>;
  /** 释放 provider 资源；数据库 provider 关闭连接池，HTTP provider 清空本地 endpoint/凭据状态。 */
  close(): Promise<void>;
  /** 写入或覆盖一条记录；command.userId 和 command.id 共同组成跨 provider 的稳定业务键。 */
  upsert(command: EmbeddingUpsertCommand<Record<string, unknown>>): Promise<void>;
  /** 执行向量检索；command.filter 是业务 metadata 条件，provider 必须先强制 userId 隔离再做 topK。 */
  search<TFilter, TMetadata>(
    command: EmbeddingSearchCommand<TFilter>,
    topK: number
  ): Promise<readonly EmbeddingSearchResult<TMetadata>[]>;
  /** 按公开 `(userId,id)` 读取单条记录；返回 undefined 表示该用户边界内不存在该 id。 */
  getById<TMetadata>(command: EmbeddingGetCommand): Promise<EmbeddingRecord<TMetadata> | undefined>;
  /** 按 metadata filter 分页列出记录；不做向量打分，用于列表页、审计和 Memory 事实枚举。 */
  list<TFilter, TMetadata>(
    command: EmbeddingListCommand<TFilter>,
    page: number,
    pageSize: number
  ): Promise<readonly EmbeddingRecord<TMetadata>[]>;
  /** 删除一个 userId 下匹配 filter 的记录；返回 provider 能确认的删除数量。 */
  deleteByFilter<TFilter>(userId: string, filter: TFilter): Promise<number>;
  /** 删除一个 userId 下的全部记录；用于用户级清理和测试回收。 */
  deleteByUser(userId: string): Promise<number>;
};

export type EmbeddingDbInitDeps = FoundationInitDeps & {
  readonly provider: EmbeddingDbProvider;
};
