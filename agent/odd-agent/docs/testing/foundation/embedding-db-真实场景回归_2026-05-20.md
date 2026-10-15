# Embedding DB 真实场景回归报告

**日期：** 2026-05-20
**范围：** Foundation Embedding DB / pgvector / Qdrant / Chroma / Milvus / Pinecone
**结论：** 通过。真实 Docker pgvector 兼容场景、Qdrant 自然语言召回场景、Provider Matrix 大样本场景、Pinecone 真实远端场景、多轮基础门禁、foundation 真实 E2E 均通过。

## 测试环境

- PostgreSQL / pgvector：Docker `pgvector/pgvector:pg16`，`127.0.0.1:55432`
- Redis：Docker `redis:7-alpine`，`127.0.0.1:56379`
- LLM：MiniMax OpenAI-compatible，`https://api.minimaxi.com/v1`，模型 `MiniMax-M2.7`
- Embedding：Ollama，`http://127.0.0.1:11434`，模型 `all-minilm:latest`

## 新增真实场景

新增 `npm run test:e2e:embedding-real`，脚本为 `scripts/embedding-db-real-scenario.ts`。该脚本覆盖 pgvector 兼容 provider，会创建临时 pgvector collection，执行完后清理临时表。

新增 `npm run test:e2e:bailian-embedding`，脚本为 `scripts/bailian-embedding-db-smoke.ts`。当前脚本使用阿里百炼 OpenAI-compatible `text-embedding-v4` 生成 512 维向量，再通过 Foundation Embedding DB 写入本地 pgvector 临时 collection，覆盖 insert query / update / delete / cleanup，执行完后删除临时表。

新增 `npm run test:e2e:embedding-natural-recall`，脚本为 `scripts/embedding-db-natural-recall-scenario.ts`。该脚本使用 Qdrant provider 写入 100 条中文事实句，再用自然语言问题逐条召回，输出 `recall@1/3/5/10/20/topK`、最差 rank 和未进入 topK 的原因线索；执行完后按 `userId` 清理临时向量。

覆盖点：

- 物理 schema：确认 `(user_id, id)` 复合主键存在。
- 索引：确认 HNSW vector 索引、metadata GIN 索引、`(user_id, created_at DESC)` B-tree 索引存在。
- 多租户隔离：两个用户写入相同业务 `id`，查询只返回当前 `userId` 数据。
- 排序与类型：相似度排序返回 `same_id` 优先，`score` 为 number。
- metadata filter：验证嵌套 JSON 子集过滤。
- 输入对抗：空 filter、包含 `undefined` 的 filter、超长 content、包含 `undefined` 的 metadata 均被拒绝。
- 用户级删除：`deleteByFilter(userId, filter)` 只删除指定用户数据；`deleteByUser(userId)` 删除指定用户全部数据。
- 维度变更：同 collection 使用不同 dimension 初始化会 fail-fast。
- 百炼 OpenAI-compatible 512 维：验证 `text-embedding-v4` 输出可被 Foundation Embedding DB 写入、更新、检索并按 filter 删除；`qwen3-vl-embedding` 需走百炼原生多模态接口，不作为 OpenAI-compatible smoke 口径。
- 自然语言召回：验证 100 条事实在 Qdrant provider 中可被自然语言 query 召回，并分析未命中原因是否来自同主题相邻事实、重述跨度过大或 topK 截断。

## 执行结果

### 第一轮专项真实 pgvector

首次运行新增脚本时，测试脚本的 schema 查询出现 SQL 类型问题：

- 问题：`information_schema.sql_identifier[]` 不能直接与 `text[]` 比较。
- 修复：将 `kcu.column_name` 显式 cast 为 `text`。
- 影响：仅影响测试脚本，不影响 Embedding DB 组件。

修复后重新执行：

```bash
npm run test:e2e:embedding-real
```

结果：`ok=true`，关键检查全部通过：

- `pgvector_physical_schema`
- `tenant_isolation_composite_pk_and_ranking`
- `validation_guards`
- `scoped_delete_by_filter_and_user`
- `dimension_change_fail_fast`

### 第二轮专项真实 pgvector

```bash
npm run test:e2e:embedding-real
```

结果：`ok=true`，耗时约 `57ms`。示例输出：

- `user_a_top_ids`: `same_id`, `far_tweet`
- `user_b_top_ids`: `same_id`
- `deleted_user_a_tweets`: `2`
- `deleted_user_b`: `1`
- `dimension_change_fail_fast.rejected`: `true`

### 全量基础门禁

```bash
npm run typecheck
npm run lint
npm test -- --run
npm run build
npm run format -- --check
```

结果：

- TypeScript 类型检查通过。
- ESLint 通过。
- 单元测试：`15 passed | 2 skipped`，`39 passed | 4 skipped`。
- Build 通过。
- Prettier 检查通过。

### Foundation E2E

```bash
ODD_AGENT_EMBEDDING_DB_E2E=1 npm test -- --run src/foundation/embedding-db/embedding-db-component.e2e.test.ts
npm run test:e2e:foundation
npm run test:e2e:foundation-real
```

结果：

- Embedding DB pgvector e2e：`1 passed`
- Foundation env-gated e2e：`5 passed`，`21 passed`
- Foundation real e2e：`ok=true`

Foundation real e2e 真实链路检查：

- Docker PostgreSQL SQL CRUD + fuzz + transaction rollback：通过。
- Docker Redis JSON/list/NX/TTL/delete：通过。
- MiniMax `MiniMax-M2.7` LangChain 真实调用：通过。
- Ollama embedding 写入 pgvector，按 metadata filter 召回与删除：通过。

### Qdrant 自然语言召回

```bash
npm run test:e2e:embedding-natural-recall
```

结果记录在 `tmp/embedding-natural-recall/latest.json`。场景会写入 10 个主题、共 100 条事实句，随后使用每条事实对应的自然语言问题检索完整 rank。若 `recallAtTopK` 小于 1，脚本仍会输出 `misses` 和 `worstRanks`，用于判断是 embedding 模型语义能力不足、问题与事实词面重合过低，还是同主题相邻事实互相竞争导致排序下降。

2026-05-22 最新执行结果：

- 原句控制组：`recall@1=1.0`，100 条全部 top1 命中，说明 Qdrant provider 的写入、隔离、filter 和排序链路正常。
- 自然语言问题组：`recall@1=0.28`、`recall@3=0.49`、`recall@5=0.52`、`recall@10=0.66`、`recall@20=0.70`，100 条在 full-rank top100 内全部可找到，但 30 条未进入 top20。
- 未进入 top20 的原因分布：20 条属于自然语言 query 与事实句词面重合过低，当前 `all-minilm:latest` 中文语义对齐不足；10 条属于同主题相邻事实竞争，目标事实被同主题或近似表达事实挤到 top20 之后。
- 典型最差 rank：`修改代码优先使用 apply_patch` 被“手工改文件应该优先用什么？”查询排到 97；`订酒店时优先选择靠近地铁的地方` 被“酒店位置有什么偏好？”排到 93；`每月读一本非虚构书` 被“非虚构书阅读频率是多少？”排到 91。
- 结论：本轮未发现 Embedding DB / Qdrant 存储检索链路问题；自然语言召回未达 100% 的主因是当前本地 embedding 模型对中文短句问答式改写质量不足，以及纯向量 topK 缺少重排。

### Provider Matrix 大样本回归

```bash
PINECONE_API_KEY=*** npm run test:e2e:embedding-provider-matrix
```

2026-05-22 最新全量执行结果：`ok=true`，耗时 `138096ms`。脚本生成 `tmp/embedding-provider-matrix/corpus/` 下 20 个文件，每个文件 500 句，共 10000 句；完整报告写入 `tmp/embedding-provider-matrix/latest.json`。

覆盖方法：

- `init_healthCheck`
- `upsert_10000`
- `search_exact_and_metadata`
- `getById_samples`
- `list_pagination`
- `upsert_update_overwrite`；Milvus 使用 `milvus_append_visibility` 避免 REST 删除/覆盖的异步可见性误报
- `same_id_tenant_isolation`；Milvus 暂不跑该项
- `nested_metadata_filter`；Chroma/Pinecone 只覆盖标量 metadata filter
- `deleteByFilter_bucket`
- `deleteByUser_cleanup`

Provider 结果：

- memory：同步 10000，search 120/120，命中率 `1.0`。
- qdrant：同步 10000，search 120/120，命中率 `1.0`。
- pgvector：同步 10000，search 120/120，命中率 `1.0`。
- chroma：同步 10000，search 120/120，命中率 `1.0`。
- milvus：同步 10000，search 120/120，命中率 `1.0`。
- pinecone：全量矩阵当时因缺少可发现 index host 标记为 skipped；随后使用运行时 API key 追加真实远端回归，详见下一节。

代表性 search 内容：

- `查找唯一事实 F00001：文件 01 第 001 句：tools 场景 metadata 的可检索事实，唯一事实码 F00001，用于验证 provider 的写入、过滤、召回、分页、隔离和删除。`
- `查找唯一事实 F00084：文件 01 第 084 句：project 场景 tenant 的可检索事实，唯一事实码 F00084，用于验证 provider 的写入、过滤、召回、分页、隔离和删除。`
- `查找唯一事实 F00167：文件 01 第 167 句：learning 场景 long-tail 的可检索事实，唯一事实码 F00167，用于验证 provider 的写入、过滤、召回、分页、隔离和删除。`

### Pinecone 真实远端追加回归

```bash
PINECONE_API_KEY=*** PROVIDER_MATRIX_PROVIDERS=pinecone PINECONE_CREATE_TEMP_INDEX=1 PROVIDER_MATRIX_UPSERT_CONCURRENCY=16 npm run test:e2e:embedding-provider-matrix
```

2026-05-22 追加执行结果：`ok=true`，耗时 `388131ms`。脚本在 Pinecone 控制面创建临时 serverless dense index，维度 `64`，完成后删除临时 index；复查 `odd-agent-matrix-*` 临时 index 数量为 `0`。

Pinecone 结果：

- provider：`pinecone`
- 测试方法：`init_healthCheck`、`upsert_10000`、`search_exact_and_metadata`、`getById_samples`、`list_pagination`、`upsert_update_overwrite`、`same_id_tenant_isolation`、`deleteByFilter_bucket`、`deleteByUser_cleanup`
- 同步数据：10000 句
- search 内容：120 条 `查找唯一事实 Fxxxxx：...` 精确事实查询，搭配 `runId/active/topic/fileIndex` metadata filter
- 命中率：120/120，`hitRate=1.0`
- failedMethods：空

本次追加回归先暴露 Pinecone 数据面删除限制：`/vectors/delete` 单次最多 1000 个 id。已修复 `PineconeEmbeddingDbProvider.deleteByFilter/deleteByUser`，先通过 metadata fetch 找到 id，再按 1000 个 id 分片删除。

## 剩余风险

- 目前真实向量库回归覆盖 pgvector、Qdrant、Chroma、Milvus、Pinecone 和 memory provider。
- HNSW 是否被 PostgreSQL planner 实际选中依赖数据规模和 planner 成本；本次验证索引存在、SQL 排序形态由组件实现保证，真实小数据集不强行断言 planner 一定走 HNSW。
