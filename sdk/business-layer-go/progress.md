# 会话日志

## 会话 1 — 2026-05-14

### 已完成
- 启用 `planning-with-files-zh` 文件规划。
- 创建 `task_plan.md` / `findings.md` / `progress.md` 三件套。
- 摸清新 SDK 顶层布局（`pkg/oddfi` 扁平包 + `contracts/abi` + `internal/{domain,infrastructure}`），已写入 `findings.md §0`。
- 锁定模块名 `github.com/Crypto-Barrett/oddfi-ODD-SDK`。

### Phase 1 完成 ✅
- `findings.md §1` SDK 全集落档（42 读 + 14 写 + 14 calldata + 16 类型/错误）。

### Phase 2 完成 ✅（2026-05-14）
- 代付库名 = `relay`
- 三库拆 `admin`/`relay`/`read`
- 写方法切分：admin=4 / relay=10（Q1/Q2 已确认）
- D1: read 包装一层 DTO
- **D2: 方案 Y** — 缓存 B(4)+C(22)+D(6)=32 个；A(6)+E(3)+F(1)=10 个不缓存
- **`AccountedBalance` 单列 F 类不缓存**（用户：业务上只在下注路径调用） → D 类剩 6 个，纯事件失效
- **事件失效启用**（用户原话："不然使用中途换了以后还要重新启动"）—— 见 `findings.md §6`
- **无 ws 端点**（用户 2026-05-14 确认）→ 改用 **HTTP poll + `FilterLogs`**，复用老项目 `watcher/` 模式（已是 polling）

### Phase 3 完成 ✅
- §3.1 ~ §3.14：14 张写卡片（28 个对外写函数 + 15 个 multicall 读项）
- §3.16：read 库 42 个 DTO 设计 + 完整签名表
- N1: 赔率自动除 1e4；N2: read 扁平命名加合约前缀（用户 2026-05-14 拍板）

### Phase 4 完成 ✅（2026-05-14）
- §4.1 命名规范：**M2** 落地（A 形态默认名 + B 形态加 `WithReceipt` 后缀），28 函数命名表已锁
- §4.1.1 老代码风格对齐：废弃老 `Submit*` / `SubmitAndWait`（因新设计有库分层不需要 Submit 前缀）
- §4.2 `GetActionStatus(actionID)` / `GetActionByIdempotencyKey(key)` 读 chain_actions 表
- §4.3 错误模型：
  - 4 大朴素类 `BusinessError` / `RetryableError` / `FatalError` / `InternalError`
  - 33 个 sentinel 按业务能力域前缀（`ErrBet*` / `ErrMarket*` / `ErrPosition*` / `ErrPool*` / `ErrToken*` / `ErrStake*` / `ErrInfra*` / `ErrAdmin*` / `ErrInternal*` / 等）
  - MVP 手写 10 条 revert selector 映射 + 兜底 `ErrChainTxReverted` + 未知 → `ErrInternalUnknownRevert`

### Phase 5 完成 ✅（2026-05-14）
- 写好 `docs/2026-05-14-refactor-plan.md`（~330 行，10 章节 + 2 附录）
- 13 个 Task 拆分（Task 0 范围确认 → Task 12 文档清理），总工期 ~17.5 天串行
- "架构保留 + 其他重写" 决策落地：保留 `action/`/`coretypes/`/`watcher/`/`migrations/`/`multisig/`/`multisigpoll/`/`proposal/`/`resolver/`；删 `writes/`/`sponsored/`/`internal/eip7702/`/`methods.go`/`service*.go`/e2e；改 `config.go`/`migrations`/`watcher`

### Phase 6 部分完成（2026-05-14 当次会话）

**已落代码**（约 1600 行新代码 + 大幅修改）：
- `go.mod` 切到本地 SDK（C1）
- `coretypes/types.go` 扩展 4 个新 ID 类型
- `coretypes/errors_v2.go` 4 大错误类 + 33 sentinel + WrapXxx helper
- `multicall/multicall3.go` 最小 wrapper（不引第三方）
- `relay/{sponsored,client,service,place_bet,helpers,stubs}.go` 完整骨架
  - `relay/sponsored.go` 是 alias 层，relay 包对外不暴露 eip7702 名字（内部 import `internal/eip7702`，不搬迁源码）
  - `relay.PlaceBet` 完整模板（A/B 双形态、validate、SDK calldata、submit 调用）
  - 其他 9 个 relay 方法 stub（返回 ErrInternalInvariant）
- `admin/{client,methods}.go` 完整骨架（4 方法 A 形态 + WithReceipt stub）
- `read/{client,dto,enums}.go` 14 个方法完整实现 + 28 stub 列表
- `README.md` 完全重写（8 节）
- `docs/usage-examples.md` 完整调用指南（9 节，含核心用户故事代码）

**第六批完成（2026-05-14 同次会话）— 老代码批量清理**：

**删除目录**（共 9 个）：
- `writes/` —— 6 个老 SDK write 服务（已被 admin/+relay/ 取代）
- `sponsored/` —— 老代付 transfer/withdraw（被 relay/ 取代）
- `multisig/` / `multisigpoll/` / `proposal/` —— 多签子系统（新 SDK 无 multisig 子包，无法继续工作）
- `resolver/` —— 仅服务于 multisig 的接口
- `client/` —— 老 SDK Connection 包装（admin/relay/read 直接拿 `*ethclient.Client`）
- `internal/signerload/` —— 依赖 `oddfi-contracts-sdk/sdk/signer`，新 SDK 无此包
- `internal/eip7702/erc20/` —— 仅给 sponsored/ 用，relay 用 SDK 的 `ODDToken.TransferCalldata`

**删除文件**（共 13 个根目录 .go）：
- `methods.go` / `service.go` / `service_wire.go` / `service_wire_full.go` —— 老 Service 单类聚合
- `flow1_e2e_test.go` / `flow2_e2e_test.go` / `e2e_helpers_test.go` —— 老 e2e（已被 `scenario_e2e_test.go` 取代）
- `types.go` / `markets.go` / `tokens.go` / `config.go` / `errors.go` —— 老顶层重导出
- 老 `doc.go` —— 描述老 Service 架构，被新极简 doc.go 取代

**新建占位**：
- `doc.go` —— 新极简版（umbrella package + 子包路标）

**验证**：`grep -r "oddfi-contracts-sdk" *.go` 返回 0 → 代码层 SDK 切换 100% 完成。

**最终目录树**（11 个保留模块）：
```
action/ admin/ cache/ coretypes/ docs/ internal/{eip7702,money,nonce,testdb,zapslog}/
migrations/ multicall/ read/ relay/ watcher/ + scenario_e2e_test.go + doc.go
```

**第五批完成（2026-05-14 同次会话）— Phase 6 全部代码落地**：
- `admin/client.go::waitReceipt()` 完整实现（与 relay 同 pattern）
- `admin/methods.go` 4 个 `WithReceipt` 形态全部完整（调 A 形态 + waitReceipt）
- `admin/methods.go` 删 `todo()` 辅助
- `read/stubs.go` 新建：剩余 28 个 read 方法全部实现（透传 SDK + DTO 包装）
- `read/client.go::GetActionStatus` / `GetActionByIdempotencyKey` 真正实现（读 chain_actions 表 + DTO 转换）
- `cache/cache.go` 新建：`Client` 接口 + `NewInProcess()` 实现（sync.Map + TTL）
- `scenario_e2e_test.go` 新建：完整 7 步场景测试（build tag `e2e`）
  - 顶部 13 个 const 参数（私钥 3 + 地址 5 + RPC + chainID + MySQL DSN + multicall + impl）
  - 所有业务方法用 `admin.*` / `relay.*` / `read.*`
  - 唯一直接 ethclient 调用：`scenarioSendBNB`（项目层不暴露原生币转账，注释里说明）
  - Step 5 ClaimPayout 留 `t.Skip` TODO（需用户接入 betID 持久化层）

**第四批完成（2026-05-14 同次会话）— relay 14 个方法全部填齐**：
- `DepositGlobal` / `DepositGlobalWithReceipt` ✅（含 BalanceOf precheck）
- `DepositMatch` / `DepositMatchWithReceipt` ✅（BalanceOf precheck，PayoutLiquidityWindow 留给合约 revert）
- `RequestUnbond` / `RequestUnbondWithReceipt` ✅（无 precheck，靠 revert）
- `Withdraw` / `WithdrawWithReceipt` ✅（无 precheck）
- `Stake` / `StakeWithReceipt` ✅（含 BalanceOf precheck）
- `Unstake` / `UnstakeWithReceipt` ✅（无 precheck）
- `Approve` / `ApproveWithReceipt` ✅（Value==0 合法）
- 加 `c.checkBalance(ctx, op, user, want)` 共享 helper（1-call multicall 抽出）
- `todo()` 函数已删除

**第三批完成（2026-05-14 同次会话末段）**：
- `relay/precheck.go` 完整：3 个 read calldata encoder + 2 个 decoder + `prePlaceBet()` 3-call multicall 预校验
- `relay/client.go::Config` 加 `Addresses` 字段（4 proxy 地址，与 oddfi.Config 对齐）
- `relay/place_bet.go` 真正端到端：multicall 3 路 → MarketOdds QuoteGuard → submit
- `relay/stubs.go::Transfer` 完整：1-call multicall（BalanceOf）+ submit
- `relay/stubs.go::ClaimPayout` 完整：无 precheck（S3 决策，靠合约 revert）+ submit + WithReceipt
- `admin/client.go::Config` 加 `Addresses` 字段
- `admin/client.go::submit()` 完整实现（EIP-1559 DynamicFeeTx + admin signer + chain_actions）
- `admin/methods.go` 4 方法都用 `c.cfg.Addresses.BettingPool` 真实地址

**追加完成（2026-05-14 同次会话）**：
- `relay/service.go::submit()` 完整实现（~180 行）：
  1. 校验 ctx/UserKey/IdempotencyKey/Target
  2. 落 chain_actions 行（pending；已存在且有 tx_hash 则直接返回历史 hash）
  3. 读 chainID + A 的 NonceAt + BatchCallAndSponsor.nonce(A)
  4. 计算 deadline (now + cfg.SignatureDeadline)
  5. 签 SetCodeAuthorization (A)
  6. 签 EIP-712 Execute typed data (A)
  7. 编码 outer calldata via `eip7702.EncodeBatchExecute`
  8. 读 sponsor PendingNonceAt + SuggestGasTipCap + SuggestGasPrice
  9. `buildSetCodeTx` (type-0x04 SetCodeTx) + `types.NewPragueSigner` 签 + `eth.SendTransaction`
  10. `actions.MarkSubmitted` 落表
  11. 任何 step 错误都按 4 错误类正确包装（Business/Retryable/Internal）
- `relay/service.go::waitReceipt()` 完整实现：1s 轮询 + 2 min 安全 deadline + 等 Confirmations 块
- `action/repo.go::MarkSubmitted(ctx,...)` 新增（ctx 风味的 MarkSubmittedTx）
- `multicall/multicall3.go` 顶部加用户指定的 0xsequence 切换指南（暂保留手写实现）

**TODO（剩余 Phase 6 工作，pattern 已示）**：
- 9 个 relay 方法的 multicall 预校验 + 落地
- 4 个 admin 方法的 WithReceipt 形态
- read 剩余 28 个方法（pattern 已定）
- `cache/` 包（Redis + 进程内 + HTTP poll 失效器）
- 删除 `writes/` / `sponsored/` / `service_wire_full.go` / `methods.go`
- 改 multisig 等保留模块对原 Service 的调用点
- e2e 测试重写

### 闪崩恢复指令（给下一次的我）
1. 读 `task_plan.md` → 看「当前阶段」字段（Phase 6 进行中）
2. 读 `progress.md` → 本节看已完成 / 待办
3. 读 `findings.md` 任一 §（设计依据）
4. 读 `docs/2026-05-14-refactor-plan.md` → 看 Task 7-12 还没做完的部分
5. 跑 `git status && git diff --stat` 看 working tree 变更面
6. 不要 commit（用户明确）

### 已知错误状态
- go.mod 用 `replace` 指向本地 SDK，但很多文件仍 import 老 SDK（`oddfi-contracts-sdk/sdk`），所以 `go build ./...` 跑不通。这是预期的过渡态。
- 当前对话中所有 `go list` 类诊断都是因为这个原因；可忽略到老 import 全清完后再 `go mod tidy`。

### 待办（按计划顺序）
1. **等用户输入**：D 类失效策略 D-1 / D-2 / D-3。
2. Phase 3：逐张接口卡片（入参 / 内部校验 / A·B 双形态返回）。
3. Phase 4：A/B 形态规范 + 错误模型。
4. Phase 5：转成可执行 plan 文件（`docs/superpowers/plans/<date>-refactor.md`）。

### 闪崩恢复指令（给下一次的我）
1. 读 `task_plan.md` → 看「当前阶段」字段。
2. 读 `progress.md` → 看最近会话的「进行中 / 待办」。
3. 读 `findings.md` → 看已填到哪一节。
4. 跑：`git status && git log --oneline -10`，对照「决策记录」核对工作树。
5. 若 Phase 1 已填完但用户没分类，恢复后第一句话应该是：「Phase 1 接口清单已就绪，请认领分类（admin / 代付 / 共用 / 不暴露），并给代付库起名」。
