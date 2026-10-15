# AGENTS.md

本文件为 **odd_agent** 协作者提供统一规则。当前运行时已收敛为 **Foundation 组件 + Memory v3 独立组件 + 用户标签推送服务**。旧多 Agent / Chat / Workflow 文档已删除，不再作为当前实现依据。

> **范围**：仅承载框架级约束。当前功能文档按 `foundation`、`memory`、`user-tag` 分目录维护，入口见 `docs/README.md`。

## 1. 开始前必须阅读

阅读顺序：`docs/README.md` → 任务相关 `docs/architecture/<功能>/架构设计.md` → `docs/development/<功能>/` → `docs/progress/<功能>/` → `docs/testing/<功能>/`。

`architecture/` 是功能架构设计、`progress/` 是真实状态：冲突时以代码与 `progress/` 为准；**新变更须先改设计文档再改代码**（见 §4）。功能开发须在 `development/<功能>/` 找到对应文档；豁免：hotfix、typo、纯测试补充、纯重构、bootstrap 骨架，豁免后仍须更新 `docs/progress/`。

## 2. docs 目录规则

- `docs/` 根目录只保留 `README.md`；子目录限定为 `architecture/` | `development/` | `progress/` | `research/` | `deployment/` | `testing/`，按需创建；新增其他子目录须经许可。
- `docs/architecture/` 按功能划分，例如 `foundation/`、`memory/`、`user-tag/`；不再维护旧 `context-map.md`、`ubiquitous-language.md`、`agent-ddd-mapping.md`、`events.md`、`slo.md`、`action-execution-policy.md` 这类已偏离当前实现的总纲文档。
- 结构性调整必须留下文档记录；文档与代码偏离必须至少修正一侧。

## 3. 编码红线

- ** 编码红线1 **: 业务层需要严格按照ddd执行，但是基础类库禁止设计多层结构，需要简单且直接的一层调用！禁止超过2层以上的设计，包括接口! 拒绝过度设计! 如果判断一个方法无法超过30行，或者只有一个方法调用，则不需要提出来单独作为公共方法！新增的方法功能，能在一个类库中完成的则不要去设计多个类库!
- ** 编码红线2 **: 所有的方法都必须有完整注释，要告诉参数怎么用，这个方法是如何实现的，是做什么的. 如果方法内的代码段超过3行，则每个代码段，都要写清楚这个代码段为什么在这里，是做什么的，怎么实现的！

### 3.1 DDD 战略层

- **限界上下文**：在 `context-map.md` 维护上下文图与映射关系；新增上下文先改图后写代码。
- **跨上下文通信**只允许两种：**领域事件**（zod schema、版本化、注册 `events.md`）或**防腐层 ACL**（在 infrastructure 封装为本上下文 port；外部 DTO / 字段 / 枚举严禁泄漏到 domain）。
- **通用语言**：核心概念命名（Agent / Skill / Tool / Memory / Session / Trace / Plan / Invocation）必须与 `ubiquitous-language.md` 一致；同概念禁多名。
- **Agent 概念 → DDD 角色映射基线**（可在 `agent-ddd-mapping.md` 调整并留档；Memory 按层级或物理边界拆为多个聚合）：


| 概念 | DDD 角色 | 层 |
|---|---|---|
| Agent / Skill / Session | 聚合根 | domain |
| Memory（每个物理层级独立） | 聚合根 | domain |
| Tool | 端口（策略对象）/ 适配器 | domain 接口 / infra 实现 |
| Invocation / Plan / Trace | 实体 / 值对象 | domain |
| Guardrail / ContextBudgetCalculator | 领域服务 | domain |
| Supervisor / Router / Orchestrator | 应用服务 | application |
| LLM Client / VectorStore / 推送服务 | 端口 + 适配器（ACL） | domain 接口 / infra 实现 |

### 3.2 DDD 战术层

- **分层**：`domain/`（聚合 / 实体 / 值对象 / 领域服务 / 领域事件 / 仓储与端口**接口**，零 I/O）；`application/`（用例编排、事务、跨聚合协调、事件发布与订阅）；`infrastructure/`（LangGraph/LangChain 适配器、LLM/Redis/DB/向量库/推送、仓储实现、ACL）；`interface/`（HTTP/SSE/WS/Job）。依赖方向：`interface → application → domain ← infrastructure`，禁反向。
- **聚合根**：一次事务**只改一个聚合根**；不变量在聚合根方法内保护，**禁外部直接 set 字段**；跨聚合一致性走领域事件 / 最终一致性。**强一致需求**（如用量扣减）必须建模为单聚合（如 `UsageLedger`）内部操作，其他副作用（写记忆、发推送）通过事件异步触发。
- **实体 / 值对象**：值对象不可变（用 `readonly` + 工厂构造时校验，必要时 `Object.freeze`）、按值相等；货币、时间窗口、预算比例、置信度、**隔离键**等必须建模为值对象，禁裸 number/string。
- **领域服务 vs 应用服务**：业务规则一律在领域服务（无 I/O），应用服务只编排；规则严禁泄漏到 application。
- **仓储**：接口在 domain、实现在 infrastructure；**以聚合根为粒度**，不以表为粒度；复杂查询走独立 Query / Read Model；接口强制传入隔离键，缺一即拒。
- **领域事件**：命名过去式（`AgentInvoked` / `SessionDeleted` / `UsageDeducted`）；zod schema 版本化；携带 `trace_id` + 隔离键，不带外部 DTO；订阅者位于 application，domain 不订阅；**订阅者必须幂等**（按事件 ID / 业务键去重，重复投递视为常态）。
- 一个文件只导出一个聚合根 / 用例 / 领域服务 / 适配器。
- **运行时数据结构 ≠ 聚合**：LangGraph State、HTTP DTO 是运行时容器，不受聚合根封装规则约束，但仍须 zod 校验。

### 3.3 TypeScript

- `tsconfig` 强制 `strict` + `noUncheckedIndexedAccess` + `noImplicitOverride`；推荐 `exactOptionalPropertyTypes`（关闭须留档）。
- 禁 `any`（确需 `// @ts-expect-error: <原因>`）；优先 `unknown` + 类型守卫。
- 公共接口（Tool I/O、Agent envelope、HTTP DTO、配置、领域事件）必须用 **zod** 校验，类型由 schema 反推。
- **错误处理双轨**：不可恢复 / 基础设施异常 → `throw AppError`（带 `code`/`retryable`/`trace_id`）；可预期业务失败（用量不足、Guardrail 拒绝等）→ `Result<T, E>`（`neverthrow` 或自定义联合类型），不 throw。
- 异步必须 `await`，禁 floating promise（启用 `@typescript-eslint/no-floating-promises`）。
- 时间一律 UTC / ISO8601；**运行时配置只能使用单一 YAML 文件 `config/odd-agent.yaml`**，统一走强类型 loader + zod schema 校验。禁止拆分为 `config/agents/<id>.yaml`、`skills/<dir>/skill.yaml`、`config/app.yaml`、`config/memory.yaml`、`config/jobs.yaml`、`config/push.yaml` 等散落配置；禁用 TOML / JSON / `.env` 配置，禁散落 `process.env.XXX`；禁止顶层 `memory`、顶层 `skills`、`agents` 或 `worker_agents`，每个 Agent 必须写成同名顶层 section（如 `supervisor_agent:`、`market_copilot_agent:`），Agent 的记忆与 Skill manifest 必须跟随各自 Agent；YAML 解析或 schema 校验失败必须定位到文件+行号且服务 fail-fast。
- ESM + 路径别名 + `prettier + eslint` 强制。

### 3.4 LangGraph / LangChain

- `StateGraph` State 必须 zod 可序列化，禁塞闭包 / 类实例；State 是运行时数据结构，**不是** DDD 聚合。
- 节点为纯函数（`(state) => Partial<State> | Command`），副作用走注入的 port。
- **节点失败协调**：业务可预期失败 → **返回** `{ error: { code, message, retryable } }` 走条件边，**不在节点内 throw**；基础设施异常 / 编程错误 → `throw AppError` 由图外 runner 捕获。
- 图 / 节点 / Tool / Agent 必须显式命名并注册到 registry，禁匿名函数直挂图。
- LangChain `Tool` / `StructuredTool` 必须：zod schema、依赖注入（不读全局单例）、内部归一化为 `ToolError`；保留通过 ACL 切换框架的能力。
- **所有 Prompt 资产**（system / user template / few-shot / tool description）必须放 `prompts/<agent>.<kind>.<version>.md`，代码只引文件路径与版本号；版本采用日期或 semver 并入 git 历史；禁多行 prompt 硬编码。
- LLM 客户端是 **port + adapter**，封装超时 / 重试 / `trace_id` 透传 / token 回调 / 降级模型；**禁直接 new LangChain LLM 实现类**（`ChatOpenAI` / `ChatAnthropic` / `ChatGoogle...` 等）。
- 前台流式输出统一走应用层流适配器（**SSE / WebSocket**）；LangGraph `stream`/`streamEvents` 不直接暴露给 HTTP / WS。前端 SSE 只能输出 Supervisor 总结后的用户可见事件，Worker Agent / Skill / Context / Usage 中间事件只写 trace / audit。
- **Prompt 注入防护**：用户输入与外部内容（新闻 / 网页 / Tool 返回）进 LLM 前必须截断 → 用 `<untrusted_input>...</untrusted_input>` 包裹 → 在 system prompt 标注不可信。System 消息只允许通过 schema 校验过的安全字段插值（用户名、时区等），**禁未经 schema 校验的用户/外部文本拼入 system 消息**。

### 3.5 Agent 框架安全与隔离

- **上游身份边界**：本服务不做用户鉴权，`user_id` 只接受可信上游 header `x-user-id`，不得从 query/body 读取；缺失即拒绝。部署层必须保证外部客户端不能直接伪造该 header 访问本服务。
- **多租户隔离**：所有 Agent 调用 / 记忆 / 推送 / 活动 / Job 按隔离键（首个应用为 `user_id + agent_id + session_id`）隔离；**仓储、Tool、Skill、Job、Push** 入口全部强制校验，缺一即拒；隔离键必须是值对象。
- **跨隔离键边界禁令**：Worker Agent / Tool / Skill 不得在调用上下文外读写其他隔离键的数据（含同用户跨 Agent、跨 Session）；越界即视为安全事件。
- **动作执行策略**：Supervisor 接收用户 prompt 后基于 `supervisor_agent.dispatch_targets` 生成 steps，执行器按 steps 顺序调用目标 Agent；定时触发由各 Agent 的 `cron.enabled` / `cron.schedule` 控制。Agent 仅调用自己 `skill_dirs[].manifest.capabilities` 已声明的 Skill。只要 Skill 支持、schema 校验通过、隔离键与幂等校验通过，Agent 即执行。
- **Guardrail 框架**：业务输出必须经 Guardrail（字段集由应用定义），失败重试上限 2 次（线性退避，间隔由配置），仍失败降级模板且**不扣费**；降级模板维护在 `docs/development/` 并版本化。
- **Trace 强制**：每请求**复用上游 `trace_id`，缺失才新建**，贯穿 chat → context → 编排器 → worker → skill → usage → memory → push 全链路；审计 / 记忆 / 活动 / 领域事件必须携带，跨服务调用同 trace 不同 span。**业务输出必须可溯源**到 Agent ID / Skill 引用 / Prompt 版本 / 模型档位。
- **用量幂等**：以幂等键（`request_id`/`trace_id`）+ DB unique constraint 兜底（首选），跨表 / 无法 unique 时辅以分布式锁；**禁仅靠应用层 Map 去重**；失败 / 超时 / Guardrail 拦截 / 降级不扣费。
- **凭据**：所有 secret 走 secret manager 或受控 env，禁落库 / 入 prompt / 入日志；日志走 PII / secret 脱敏中间件（`user_id` 等敏感字段统一 SHA-256 前 16 位）；**测试 / 预发 / 生产凭据严格隔离，禁混用**。
- **删除分层归属**：数据按归属层管理生命周期——**Session 级短暂资产**（L1 / L2 / 消息 / 会话内 Job / 会话内 Trace）按 `user_id + agent_id + session_id` 三元组绑定；**Agent 级长期资产**（L3 / L4 / 活动 / 推送 feed / 偏好 / Usage）按 `user_id + agent_id` 归属，每条记录携带不可空 `session_id` 作为**来源 provenance**。删除提供两种模式：**Archive**（软归档，仅改 session 状态）+ **Permanent Delete**（仅清理 Session 级资产，Agent 级保留为孤儿来源引用，需 `?confirm=true`）；两者幂等，永久删除发布 `SessionPermanentlyDeleted` 领域事件，订阅者按归属层清理。
- **Skill 加载**：required Skill 缺失 → **fail-fast 退出**；非 required Skill 缺失 → 对应 Agent 标 `unavailable` 并暴露在健康检查；配置失败一律禁静默启动。
- **Skill 配置模型**：Agent 能力必须用 `skill_dirs[]`，禁 `agent.skill_id` 单值。

### 3.6 LLM 成本 / Token

- 上下文构造遵循 Agent 声明式配置（manifest）的 `context_budget`，超额按相关性 / 时间 / 置信度排序裁剪并写 trace。
- **请求复用**：同隔离键 + 领域级幂等键在配置窗口内复用**首次成功**结果；首次失败 / 降级**不缓存**，下次重试。
- **模型分级**：按任务复杂度分级（cheap / standard / strong）写入 manifest；**禁止所有任务无差别使用 strong 档位**；编排器路由前能判档位。
- **Prompt cache**：cache 字段（system 头部、固定 few-shot）严禁穿插动态内容；动态内容放 cache 边界后。
- 每次 LLM 调用上报 input/output token 到指标；超 manifest 阈值告警。
- 长任务 / 舆情类 / 定时摘要走异步 Job，禁在同步 chat 跑长上下文。

### 3.7 测试门禁（提交前必须通过）

- 单元测试 `vitest` 或同等；**目标覆盖率**（行 + 分支双指标） domain ≥ 80% / application ≥ 70%（可在测试矩阵留档调整）；纯函数节点 / 领域服务 / 值对象构造校验必须覆盖。
- 聚合不变量必须有正反向用例；Tool / Skill / 领域事件 schema 必须有契约测试（合法 / 非法 / 边界 / 版本兼容）；事件订阅者必须有幂等测试（重复投递）。
- **LangGraph 图路由用例**：每个条件边的所有可能分支必须有用例覆盖。
- 集成测试至少覆盖：Chat 流式主链路、异步 Job、主动推送、会话级联删除（含事件订阅链路）。
- 类型 / `eslint` / `prettier --check` 全绿。
- **Prompt 回归**：核心 Prompt 资产变更必须附回归用例（推荐 `promptfoo` / `langsmith`），**只断言结构化字段（JSON path / schema 形状）**，不对自由文本字面值断言。
- 高风险变更（编排器路由 / Guardrail / 用量 / 记忆删除 / Skill 加载 / 隔离键 / 事件订阅 / 动作执行策略）必须做对抗性测试（见 §5）。

### 3.8 可观测 / 配置 / NFR

- **Trace** 在统一后端（OpenTelemetry / Jaeger / Tempo）可按链路检索，领域事件发布 / 订阅必须带 trace。
- **Metrics**（OTel / Prometheus 任选）必须暴露：QPS、p50/p95/p99 延迟、首 token 延迟、token 用量、Guardrail 拦截率、Skill 失败率、推送失败率、用量扣减率、事件发布 / 订阅延迟与失败率、jailbreak 命中率。
- **结构化日志** JSON 必填字段：`trace_id`、`user_id`（统一 SHA-256 前 16 位脱敏）、`agent_id`、`session_id`、`level`、`event`、`bounded_context`；禁 `console.log` 进业务代码。
- 多环境（dev/staging/prod）走强类型 config + schema 校验；禁"prod 才有的代码分支"。
- **Feature flag**：满足以下任一即视为高风险，必须走 flag 默认 off + 灰度留档：影响金钱 / 跨越隔离键边界 / 涉及合规 / 改变核心链路可用性 / 修改动作执行策略。
- 模型档位切换走配置热更（不重启），切换原因 / 回滚方案入 `docs/progress/`；不得改变接口契约。
- **SLO** 在 `slo.md` 维护：同步 chat 首 token p95 / 总延迟 p95 / 异步 Job p95 / 推送成功率 / 核心可用性。
- 每个外部依赖（LLM / 向量库 / Redis / 推送 / DB）必须标注降级策略并有对抗性测试。
- 聚合 / 事件 / manifest schema 变更必须有可回滚迁移脚本，留档 `docs/deployment/`。

## 4. 文档同步

**任务改变实现状态却未更新文档 → 任务不视为完成。PR 描述必须列出本次变更的文档清单（含 "无" 选项）。**

- 架构变化（先改文档后改代码）：限界上下文 / 通用语言 / 聚合边界 / Agent-Skill 模型 / 上下文预算 / 流协议 / 外部接口 / 安全模型 / 动作执行策略 / 部署架构 → 改 `docs/architecture/` 与对应开发文档。
- 实现进度变化：功能完成 / 范围调整 / 占位变可用 → 改 `docs/progress/<功能模块>.md`。
- 过程归档：调研 → `research/`、开发 → `development/`、部署 → `deployment/`、测试与审计 → `testing/`。
- 接口变更（首个应用 `多Agent编排_接口规范.md`）必须同步并标版本；新增接口规范文档需登记到 `docs/README.md`。
- 领域事件 schema 新增 / 变更 / 弃用必须改 `events.md` 并经订阅方评审。

## 5. 开发与验收

- **变更顺序**：上下文与通用语言确认 → 聚合 / 值对象 / 领域服务 / 仓储接口 → 基础设施 + ACL → 应用用例 → LangGraph 编排 → 接口层 → 配置与 Skill 目录。
- Bug 修复至少 2 次复现验证，保留输入 / 输出 / 期望；首次失败先补 Research，新调研归档到 `docs/research/`。
- 复杂 / 高风险改动至少 3 轮验证后再验收；验收必做对抗性测试。
- **维护"关键集成测试清单"** 于 `docs/testing/critical-integration-tests.md`，完工跑：类型 / lint / 单测 / 该清单全部用例 + 影响范围内的对抗性测试。

**对抗性测试**（攻击者视角）：边界与异常输入；权限越权（跨隔离键读写）；跨 Agent / 跨 Session 串用；用量绕过（重复 `request_id` / 幂等键并发重放 / 错误状态扣费）；**Prompt 注入与 Jailbreak**（破坏 system / 越权调用 Tool）；**成本耗尽攻击**（构造长上下文 / 高频请求耗光配额）；Guardrail 绕过；**领域事件重放**（重复消费导致重复副作用）；删除残留（二级缓存 / 向量索引元数据 / 未完成 Job / 未发推送 / 未消费事件）；并发脏数据与乐观/悲观锁；跨上下文 DTO 泄漏；**内容审核越权**（输出违规 / PII 泄漏）；外部依赖单点故障降级。文档层面：规则矛盾、流程死锁、术语一致性。

## 6. 需求变更工作流

每步评审最多 3 轮，超过须人工介入。

1. 需求调研 → 2. 调研评审 → 3. 更新 `docs/architecture/`（context-map / ubiquitous-language / events / agent-ddd-mapping / slo / action-execution-policy 视情况）与开发设计文档 → 4. 文档评审（重点：上下文 / 通用语言 / 聚合边界与不变量 / Agent-Skill / 隔离 / Trace / 用量 / Guardrail / 事件 schema / 动作执行策略）→ 5. 产品文档修改后做对抗性测试 → 6. 写开发文档（含影响上下文 / 聚合变更 / 事件变更 / 迁移 / 接口 / 回滚 / 测试矩阵）→ 7. 多轮 Review → 8. 任务分配（每个 Sub-agent 明确：所在上下文 / DDD 层 / 依赖端口 / I/O schema / 不变量 / 测试）→ 9. 严格遵守本文件 → 10. **代码评审**（核对 DDD 边界、红线合规、文档同步）→ 11. 跑完所有测试 + 更新 `docs/progress/` 验收。

## 7. 速查清单

- **DDD**：未越上下文边界（跨上下文走事件或 ACL）；单事务单聚合根（强一致建模为单聚合）；不变量方法内保护；仓储以聚合根为粒度；领域服务 vs 应用服务分工清晰；值对象不可变；事件命名过去式 + schema 已注册到 `events.md`；订阅者幂等。
- **TS / 框架**：分层无反向依赖；公共 schema 用 zod；错误双轨清晰；LangGraph State 可序列化、节点纯函数、业务失败**返回** `{ error }`、基础设施 throw；所有 Prompt 资产文件版本化；外部内容 `<untrusted_input>` 包裹，system 消息只允许 schema 校验过的安全插值。
- **安全 / 用量**：隔离键值对象化（Session 级三元组 / Agent 级二元组按归属分层）并在仓储 / Tool / Skill / Job / Push 全部强制校验；越界即安全事件；`trace_id` 含事件全链路且复用上游；日志带 `bounded_context` 与统一脱敏；用量幂等键 + DB unique（首选）/ 分布式锁；动作由代码 workflow 显式调用 Agent 并按 Skill capability 执行；模型分级（禁全量 strong）；prompt cache 边界正确；删除分 Archive（软归档）+ Permanent Delete（仅清理 Session 级资产，Agent 级保留 session_id 孤儿来源）。
- **配置**：所有配置统一 YAML 格式，强类型 loader + schema 校验，错误定位到文件+行号且 fail-fast。
- **测试 / 运维**：聚合不变量 + 事件 schema + 订阅幂等 + 图路由 + Guardrail 全测；Prompt 回归只断结构化；类型 / lint / 单测 / 关键集成测试清单全绿；外部依赖降级与 SLO 同步；PR 描述列出文档变更清单；`docs/progress/` 已更新。
