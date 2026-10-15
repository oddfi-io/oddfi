# AGENTS.md

本文件为所有协助 **ODD-SDK** 开发的 Agent（人类与自动化）提供统一、强约束的工作规则。ODD-SDK 是 oddfi 协议合约的 **公开 Golang SDK**，第三方将直接 `go get` 依赖。任何破坏向后兼容、安全性、可观测性、类型安全的改动，均视为不可验收。

> 架构与分层的完整强约束见 [`docs/architecture/layering.md`](./docs/architecture/layering.md)，与本文件第 8 节"不可豁免清单"具有同等效力。

## 0. 总则

- **公开 SDK 的最高约束是兼容性与正确性**：`v1.0.0` 之后破坏性变更须升 SemVer MAJOR；`v0.x` 期间的破坏性变更须在 CHANGELOG 与 release note 显式标记 `BREAKING`。
- **业务域建模非可选**：领域层按 oddfi 合约业务域组织，独立于 ABI 生成代码、RPC 客户端、具体基础设施实现等细节；可直接使用必要的 `go-ethereum` 常用公开类型。
- **Agent 不得自行豁免本文件任何"必须 / 禁止"条款**。条款冲突时停止编码，向用户申请豁免并记录到 `docs/development/`。
- **每步评审 / 验证最多 3 轮迭代**，超过须人工介入（"人工" = 项目维护者 / 提交需求的用户）；未达成评审一致不得进入下一阶段。
- **严格规范** 禁止上传任何私钥以及私有rpc相关的内容

## 1. 开始工作前必读

修改代码前至少读：`docs/README.md` → `docs/progress/`（真实状态）→ 任务相关 `docs/architecture/`（设计意图）→ `docs/development/`（实施清单）→ `docs/testing/`。

`architecture/`（应当如此）与 `progress/`（实际如此）必须严格区分：与代码不一致时以代码 + `progress/` 为准，由人工决定是否回写设计；新增变更必须先改 `architecture/` 再改代码。

功能开发须在 `development/` 找到对应文档才能开始。豁免：bug hotfix（首次修复失败后须补 `development/` 研究记录，见第 6 节）、typo / 格式、纯文档变更、补测试（不改业务）、纯重构（不改外部行为且不改公开 API）、bootstrap 阶段骨架。豁免操作完成后仍须更新 `docs/progress/`。

## 2. docs 协作规则

- `docs/` 根只允许 `README.md`，其他文档归入 `architecture/` | `development/` | `progress/` | `testing/`。
- 新建子目录须用户许可。
- PR 须完整记录变更动机、影响面、迁移指引（涉及公开 API 时）。
- 文档与代码长期偏离时必须至少修正一侧，并在 PR 描述中点名。

## 3. 架构红线（指针）

完整规则见 [`docs/architecture/layering.md`](./docs/architecture/layering.md)。本节仅列出绝对不可破坏项：

- 四层结构：`pkg`（公开）→ `application` → `domain` ← `infrastructure`；依赖无环，`application` 与 `infrastructure` 均朝向 `domain`。
- `internal/domain` 不得 import `net/http`、ABI 绑定、任何具体 RPC / DB / 文件系统库；可使用必要的 `go-ethereum` 常用公开类型表达链上数据。
- `/pkg` 可以暴露 `common.Address`、`common.Hash`、`*big.Int`、`*types.Transaction`、`bind.TransactOpts`、`bind.CallOpts` 等 `go-ethereum` 常用公开类型；不得暴露 `*ethclient.Client`、内部基础设施具体类型、ABI 生成 binding 类型。
- ABI 资产分两处：原始 artifact 在 `/contracts/abi/`，abigen 产物在 `/internal/infrastructure/bindings/<contract>/`；`/pkg` 与 `/examples` 不得直接 import bindings；生成命令集中在 `bindings/gen.go`。
- 所有 SDK 持有的可变依赖（链客户端、日志、指标、tracer、时间源、随机源、重试策略）通过构造函数 / Option 注入；禁止 `init()` 副作用、包级可变状态、隐藏单例。
- CI 必须含 import 方向校验（如 `depguard` / `go-arch-lint`），失败即阻断。

## 4. Golang 编码红线

### 4.1 类型安全

- 公开 API 禁止 `interface{}` / `any`，除非是已知多态边界（泛型约束、序列化）且 godoc 明示。
- 禁止 `unsafe`，除非架构文档论证并经安全评审。
- SDK 自有类型只在表达 oddfi 业务语义时引入；不得为了包裹 `common.Address`、`common.Hash`、`*big.Int`、`*types.Transaction`、`bind.TransactOpts`、`bind.CallOpts` 创建无业务增益的重复类型。
- 枚举 = 具名类型 + 常量 + `String()`，构造点校验合法性。
- 启用 `go vet`、`golangci-lint`（含 `errcheck`、`govet`、`staticcheck`、`revive`、`gosec`、`bodyclose`、`contextcheck`、`exhaustive`、`nilerr`、`copyloopvar`），`go.mod` 的 `go` 指令与 CI 一致。

### 4.2 错误处理

- 库代码禁止 `panic`；唯一例外为 `MustXxx` 风格构造函数（接收常量 / 静态输入），且 godoc 必须明示触发条件；其余路径出错一律返回 `error`。
- 错误必须可被 `errors.Is` / `errors.As` 判别：哨兵错误 `var ErrXxx = errors.New(...)` 或自定义类型；包装统一用 `fmt.Errorf("...: %w", err)`。
- 禁止吞错：业务 / I/O 路径不得 `_ = call()` 丢弃 error；不得只 log 不返回；不得用脱敏 string error 丢失链上原因；deferred 清理（如 `Close`）须显式 log 或通过 `errors.Join` 合并到返回错误。
- 链上 revert 数据必须解码为领域错误，并提供原始字节供调试。
- 错误分类：`UserError` / `RevertError` / `InfraError` / `ConfigError`，分别映射不同重试语义。

### 4.3 并发与上下文

- 所有 I/O / 阻塞 API 第一参数为 `ctx context.Context`；库内部禁止 `context.Background()` / `context.TODO()`（仅 `examples/` 与测试可用）。
- 每个 `go` 必须有取消路径（ctx 取消、显式 stop、close channel）；禁止"火并忘记"。
- 共享状态须有明确同步原语，结构体注释标明字段由哪个锁保护。
- 测试必须通过 `-race`。
- 禁止 `time.Sleep` 用作可阻塞同步；含睡眠的退避 / 轮询必须用 `select { case <-time.After(...): case <-ctx.Done(): }`，确保被 ctx 取消。

### 4.4 链上交互

- SDK 自行组织的高阶交易流程建议按 **Build → Simulate → Sign → Send & Wait** 分离，每阶段独立可调用、可替换、可测试；直接映射合约写方法可以接受调用方提供的 `*bind.TransactOpts` 并返回 `*types.Transaction`。
- 签名、nonce、gas 默认由调用方通过 `bind.TransactOpts` 控制；SDK 不托管私钥，不在公开 API 接收 `*ecdsa.PrivateKey`、私钥字符串或私钥字节。
- SDK 若实现自有高阶交易流水线，gas / nonce 策略必须显式可注入；直接合约写方法不得隐藏覆盖调用方 `bind.TransactOpts` 中的设置。
- RPC 必须可重试：网络 / 429 / 5xx / 超时指数退避；幂等读可重试，写仅在明确幂等场景下重试。
- SDK 自行签名或广播交易前必须校验交易 chain ID 与 client chain ID 一致，不一致返回 `ErrChainIDMismatch`；直接使用调用方 `bind.TransactOpts` 的写方法必须保留 go-ethereum 的签名 / chain ID 错误。
- EIP-712 / 离线签名须强类型，配 typed-data hash 单测与官方 vector 比对。
- 事件 / ABI 解码必须容错（未知 topic / 字段缺失），返回明确错误而非 panic。
- 公开入口若接受字符串地址必须做 EIP-55 校验；接受 `common.Address` 的入口不得再创建重复地址包装。
- 金额单位明确（wei / 最小单位 / 人类单位），文档明示精度，禁止隐式换算。
- 等待确认必须存储交易所在 block 的 hash 并按 hash 重拉 receipt 比对，正确处理 reorg / 区块跳过；不得仅依赖 block number 判定确认。

### 4.5 可观测性

- 日志由调用方注入：最小 `Logger` 接口（`Debug/Info/Warn/Error` + 结构化字段），默认 noop；禁止 `log` 标准库 / `fmt.Println` / 全局 logger。
- 禁止日志泄漏私钥 / 签名 / 助记词 / calldata 中的敏感字段；地址默认完整、密钥永远脱敏。
- 关键路径埋点 metrics 钩子（接口注入），至少覆盖 RPC 次数 / 延迟 / 错误率、tx 提交 / 确认 / revert；如 SDK 高阶流程引入签名回调，再覆盖签名耗时。
- 必须提供 OpenTelemetry tracing 注入接口，默认实现为 noop。

### 4.6 配置与依赖

- 依赖最小化：新增第三方依赖须在 PR 说明理由；禁止 GPL / AGPL；首选标准库与 go-ethereum 官方包。
- `go.mod` 必须 tidy，CI 校验 `go mod tidy -diff`；主分支禁止 replace 指向私有仓库。
- `CGO_ENABLED=0` 默认必须可构建；不可避免须文档化并提供纯 Go 备选。
- 最低 Go 版本在 `go.mod` / `README.md` / CI 三处一致。

### 4.7 公开 API 稳定性

- `/pkg` 所有导出符号必须有 godoc，第一句以符号名开头；并发安全性、阻塞与否、错误条件须显式说明。
- 每个公开类型 / 关键函数配 `ExampleXxx`，CI 必须可编译运行。
- 公开 API 变更必须经 apidiff / `gorelease` 检查，CI 失败即阻断。
- 弃用用 `// Deprecated:` 注释，至少保留一个 minor 版本。
- `CHANGELOG.md` 强制更新，遵循 Keep a Changelog。

### 4.8 安全

- 提交前必须通过：`golangci-lint run`（零告警或显式 `nolint:` + 理由）、`govulncheck ./...`、`gosec ./...`、`go test -race -count=1 ./...`。
- 供应链：CI 校验 `go.sum`；发布产物含 SBOM；release tag 须 GPG 签名。
- Fuzz：ABI 解码、字符串地址 / 数字解析、EIP-712 编码、事件 topic 解析必须有 fuzz 测试。
- SDK 默认不得处理私钥；测试 / 示例若在显式 opt-in 写交易中运行时读取私钥，禁止写入源码、文档、日志、错误信息、metric label，且应在使用后清零可清理的字节缓冲。

## 5. 文档同步规则

**任务改变实现状态却没更新对应文档，则任务不视为完成。** 架构变化（领域边界 / 公开 API 合约 / 核心交互 / 签名 / 安全模型 / 模块依赖）须**先**改 `docs/architecture/` 再改代码；实现进度（完成 / 开发中 / 调整 / 回退 / 延后 / 占位转可用）按模块写入 `docs/progress/`；fuzz / 集成 / 对抗性测试报告、安全审计、覆盖率快照入 `docs/testing/`；开发文档入 `docs/development/`，每篇含背景、范围、API 变更面、迁移指引、测试计划、回滚方案。

## 6. 开发与验收流程

- 变更顺序：领域模型 → 应用用例 → 基础设施实现 → 公开 API 包装 → 示例与文档。
- 功能开发须有开发文档（豁免见第 1 节）。
- Bug 修复至少 2 次复现验证，保留输入 / 输出 / 期望；首次修复失败先补研究记录到 `docs/development/` 再继续。
- 复杂或高风险改动至少 3 轮验证后验收，必须做对抗性测试。**高风险定义**（满足任一即视为高风险）：公开 API 变更、签名 / nonce / gas / 交易广播路径变更、新合约接入、跨链 / 多链支持、私钥与权限相关代码、ABI 解码变更。
- 完成后必须重跑：构建、`go vet`、`golangci-lint`、单测含 `-race`、集成测试、`govulncheck`、API diff。
- 公开 API 改动须额外提供：迁移示例代码、CHANGELOG 条目、对外 release note 草稿。

**对抗性测试维度**：类型 / 边界（零值、`MaxUint256`、负数、空切片、`nil`、超长串、非 EIP-55 字符串地址）；链上语义（reorg、tx 被替换、nonce 冲突、gas 估算失败、链 ID 切换、节点返回错乱 ABI）；并发（共享 client、ctx 同时取消、关闭后再调用）；资源（goroutine / 连接 / 文件句柄 / 内存泄漏）；安全（恶意节点构造数据、RPC 重定向、签名 oracle 攻击、replay）；文档（示例可编译、godoc 与行为一致、术语一致、跨文档无矛盾）。

## 7. 需求变更与开发工作流

每步评审 / 验证最多 3 轮，超过须人工介入。

1. **需求调研**：业务语义、链上语义、已有协议接口、对使用者影响面，记录到 `docs/development/` 草稿。
2. **调研评审**：发现问题须重新调研。
3. **架构与设计文档更新**：更新 `docs/architecture/`，明确领域模型变更、公开 API 形状、依赖方向、可观测性钩子、迁移路径。
4. **文档评审**：正确性、完整性、一致性，且与现有 `progress/` 不冲突。
5. **开发文档设计**：归档 `docs/development/`，含 API 草案、内部分层、测试计划（fuzz / 集成 / 对抗）、回滚方案。
6. **开发文档评审**：至多 3 轮 Review，修正逻辑漏洞与规范不符。
7. **任务分配与开发**：开发文档定稿后方可编码；公开 API 变更须先合入 API 设计 PR（仅含 `/pkg` 接口签名 + godoc），再合入实现 PR。
8. **测试与验收**：单元、集成、fuzz、对抗、API diff、CHANGELOG 全部通过方可合并。
9. **`docs/progress/` 同步**：合并前更新；合并后发现遗漏立即补单。

## 8. 不可豁免清单（任意一条违反即立即停止）

- 公开 API 在未升 MAJOR 的情况下破坏向后兼容
- 领域层 import 基础设施实现、ABI 生成 binding、具体 RPC client / DB / 文件系统库
- 库代码出现 `panic`（`MustXxx` 构造函数除外）或裸 `os.Exit`
- 私钥进入日志 / 错误信息 / 公开类型字段 / metric label
- 跨网络 / 跨进程调用未接收 `context.Context`
- 公开 API 暴露 `*ethclient.Client`、内部基础设施具体类型或 ABI 生成 binding 类型
- 全局可变状态、`init()` 中执行 I/O、隐藏单例
- CI 中任何被注释 / 跳过的安全检查（`golangci-lint`、`gosec`、`govulncheck`、`-race`、API diff、import 方向校验）
- 文档与代码状态不同步即声明"完成"
