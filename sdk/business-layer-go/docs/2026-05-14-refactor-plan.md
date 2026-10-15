# 重构落地计划 — `contracts-business-layer` 三库化 + ODD-SDK 切换

> **作者**：Claude + niall
> **日期**：2026-05-14
> **状态**：草稿（Phase 5 产出 → 待 Phase 6 按 task 顺序执行）
> **闪崩恢复**：本文件是给"执行人"看的；设计依据见仓库根 `findings.md`（按 §引用），决策记录见 `task_plan.md`。

---

## 0. TL;DR

把 `contracts-business-layer` 的 SDK 依赖从 `Crypto-Barrett/oddfi-contracts-sdk` 切到 `Crypto-Barrett/oddfi-ODD-SDK`；同时把对外接口按 **`admin` / `relay` / `read`** 三个 Go 包拆开；每个写方法暴露 **A 形态（默认，提交即返回 hash）+ B 形态（`WithReceipt` 后缀，等回执）**；引入 **multicall3** 批量化预校验读；引入 **缓存层（Redis + 进程内）+ HTTP poll 事件失效器** 用于 32 个 read 缓存；统一 **4 大错误类 + 33 个 sentinel 错误码**。

总规模：**28 个对外写函数 + 42 个 read 函数 + 1 个 ActionStatus 查询 + 6 个新增包**。

---

## 1. 目标 / 范围 / 非范围

### 1.1 目标
- 切换 SDK 依赖到 `github.com/Crypto-Barrett/oddfi-ODD-SDK`
- 对外暴露三个独立 Go 包：`admin` / `relay` / `read`
- 每个写方法 A/B 双形态
- 用户传 `ctx + *ecdsa.PrivateKey + amount` → 单次调用返回 tx hash（核心用户故事）
- 引入 multicall3 + 缓存 + 事件失效

### 1.2 范围内
- 顶层业务接口重写（`writes/` / `sponsored/` / `internal/eip7702/` / `methods.go` / `service*.go`）
- e2e 测试重写（`flow1_e2e_test.go` / `flow2_e2e_test.go` / `e2e_helpers_test.go`）

### 1.3 范围外 / 保留不动
| 模块 | 现状 | 处理 |
|---|---|---|
| `action/` | chain_actions 表 model + repo | **保留**（架构核心） |
| `coretypes/` | 公共类型 + 错误 | **扩展**（加 4 大错误类 + 33 sentinel + 新 ID 别名） |
| `watcher/` | HTTP poll 回执跟踪器 | **保留 + 复用**（扩展为 cache 失效器；见 §4） |
| `migrations/` | DB schema | **追加**（新建 `cache_invalidator_cursor` 表） |
| `multisig/` / `multisigpoll/` / `proposal/` / `resolver/` | 多签子系统 | **保留**（不涉及 SDK 改动） |
| `client/` | _待查_ | 默认保留，Phase 6 第一步确认 |
| `markets.go` / `tokens.go` | 顶层类型 | 视内容定，可能合并到 `coretypes/` 或删除 |

### 1.4 非目标（本次不做）
- 事件失效器的高级补漏机制（如 finality reorganization 检测）→ 用 `Confirmations=2` 兜底即可
- WS 订阅（用户确认无 WS 端点，只用 HTTP poll）
- 多签子系统的 SDK 切换（独立工作量）

---

## 2. 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│  外部业务层（调用方）                                          │
└──────┬──────────────────┬──────────────────┬────────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   admin/     │   │   relay/     │   │   read/      │
│  4 写×2 形态  │   │  10 写×2 形态 │   │  42 读 + DTO  │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                  │                  │
       └──────────────────┼──────────────────┘
                          ▼
              ┌───────────────────────┐
              │     基础设施层         │
              │  ─ multicall/         │ ← multicall3 binding
              │  ─ cache/             │ ← Redis + 进程内 + 失效器
              │  ─ action/ (保留)     │ ← chain_actions 表
              │  ─ watcher/ (保留)    │ ← HTTP poll 回执 + 失效
              │  ─ coretypes/ (扩展)  │ ← 错误/类型
              └──────────┬────────────┘
                         ▼
         ┌────────────────────────────────────────┐
         │  github.com/Crypto-Barrett/oddfi-ODD-SDK │
         │  pkg/oddfi (Client/BettingPool/...)      │
         └──────────────────┬─────────────────────┘
                            ▼
                    BSC 链上合约
```

设计依据：`findings.md §2.0` / §2.1 / §2.4

---

## 3. 依赖切换清单

### 3.1 go.mod 改动
```diff
- github.com/Crypto-Barrett/oddfi-contracts-sdk v0.1.0
+ github.com/Crypto-Barrett/oddfi-ODD-SDK v0.x.x  // pin 到具体 tag

+ github.com/Crypto-Barrett/multicall3-go v0.x.x  // 待定，或自建 binding
```

### 3.2 import 替换点（全量 grep）

Phase 6 Task 0：执行
```
grep -rln "Crypto-Barrett/oddfi-contracts-sdk" --include="*.go"
```
对每个匹配项决定：
- **要删的文件** → 直接删（不替换 import）
- **保留的文件** → 替换 import 为 `oddfi-ODD-SDK/pkg/oddfi`

预期匹配范围：`writes/*.go` / `sponsored/*.go` / `methods.go` / `service_wire*.go` 等（全部在重写名单内）。

---

## 4. 新增文件结构

> 每个新建包的初始文件清单。代码骨架引用 `findings.md` 对应卡片。

### 4.1 `admin/`（4 接口 × 2 形态 = 8 函数）

```
admin/
├── client.go           — admin.Client 句柄（持 admin 私钥 + SDK Client）
├── service.go          — 通用 Submit/SubmitAndWait 辅助函数
├── add_platform_reserve.go  — AddPlatformReserve + WithReceipt
├── grant_role.go            — GrantRole + WithReceipt
├── open_market.go           — OpenMarket + WithReceipt
├── settle_market.go         — SettleMarket + WithReceipt
└── errors.go           — admin 包专属错误类型补充（如有）
```

每个写方法卡片：`findings.md §3.2 ~ §3.5`

### 4.2 `relay/`（10 接口 × 2 形态 = 20 函数）

```
relay/
├── client.go           — relay.Client 句柄（持 multicall 适配 + SDK Client，不持私钥）
├── service.go          — 通用预校验/签名/落 chain_actions 流程
├── place_bet.go        — PlaceBet + WithReceipt（见 §3.1 模板卡片）
├── claim_payout.go     — ClaimPayout + WithReceipt
├── deposit_global.go
├── deposit_match.go
├── request_unbond.go
├── withdraw.go
├── stake.go
├── unstake.go
├── transfer.go
├── approve.go
└── errors.go           — relay 包专属错误（如有）
```

每个写方法卡片：`findings.md §3.1 / §3.6 ~ §3.14`

### 4.3 `read/`（42 接口 + DTO + 枚举）

```
read/
├── client.go           — read.Client 句柄（持 cache.Client + SDK Client）
├── dto.go              — 6 个核心 DTO（Market / MarketOdds / Bet / Signal / PayoutWindow / ActionStatus）
├── enums.go            — 枚举常量集（MarketStatus / BetSettlementState / SignalColor / LpPositionState）
├── odd_token.go        — Name / Symbol / Decimals / TotalSupply / Paused / BalanceOf / Allowance
├── betting_pool.go     — 15 个 BettingPool 读（含 BettingPoolPaused 等扁平命名）
├── liquidity_pool.go   — 11 个 LiquidityPool 读
├── staking_pool.go     — 9 个 StakingPool 读
├── action_status.go    — GetActionStatus + GetActionByIdempotencyKey（读 chain_actions 表）
├── address.go          — ParseAddress / MustParseAddress 转发
└── errors.go
```

DTO 与签名总表：`findings.md §3.16`

### 4.4 `multicall/`（新建）

```
multicall/
├── multicall3.go       — multicall3 ABI binding（abigen 生成或手写）
├── builder.go          — Builder API：链式追加 call + Execute()
├── decode.go           — 结果按 ABI 解码到目标 Go 类型
└── multicall_test.go
```

multicall3 合约地址：`0xcA11bde05977b3631167028862bE2a173976CA11`（详见 `findings.md §3.0.3`）

### 4.5 `cache/`（新建）

```
cache/
├── client.go               — Cache.Client 接口 + Redis 实现 + in-process 实现
├── keys.go                 — Cache key 命名约定（如 `bpool:market:<id>` / `bpool:taxbps`）
├── ttl.go                  — TTL 策略表（按 §6.0 分档 ❄️/⏸️/🌡️）
├── invalidator.go          — HTTP poll 事件失效器（复用 watcher 模式）
├── invalidator_mapping.go  — 事件 selector → cache key 映射表
└── cache_test.go
```

设计依据：`findings.md §6`

### 4.6 `coretypes/` 扩展

新增到现有 `coretypes/types.go` / `errors.go`：
```go
// 新增 ID 类型
type MarketID [32]byte
type MatchID  [32]byte
type LpPositionID    *big.Int
type StakePositionID *big.Int

// 新增 4 大错误类型（见 findings.md §4.3.1）
type BusinessError struct{ Code, Op string; Err error }
type RetryableError struct{ Code, Op string; Err error }
type FatalError    struct{ Code, Op string; Err error }
type InternalError struct{ Code, Op string; Err error }

// 33 sentinel 错误码（见 findings.md §4.3.2）
var ErrIdempotencyConflict = &BusinessError{Code: "ErrIdempotencyConflict", ...}
var ErrUserInsufficientBalance = ...
// ... 共 33 个
```

---

## 5. 要删除的旧文件

| 路径 | 替换为 |
|---|---|
| `writes/openmarket.go` / `closemarket.go` / `lockbet.go` / `lockparlay.go` / `creditdeposit.go` / `settle.go` / `shared.go` | `admin/*` + `relay/*`（按归类） |
| `writes/*_test.go` | `admin/*_test.go` + `relay/*_test.go` |
| `sponsored/transfer.go` / `withdraw.go` / `*_test.go` | `relay/transfer.go` + `relay/withdraw.go` |
| `internal/eip7702/*.go` | `relay/internal/sponsored_signer/*.go`（命名待定，避开 eip7702 字眼） |
| `methods.go` | 三库各自的 client.go 门面 |
| `service.go` / `service_wire.go` / `service_wire_full.go` | 三库各自的构造 + 一个顶层 `package business` 重导出（可选） |
| `flow1_e2e_test.go` / `flow2_e2e_test.go` / `e2e_helpers_test.go` | 重写为三库 e2e |

> **注**：`internal/eip7702/` 内部代码是代付签名核心实现，**逻辑保留但搬到 `relay/internal/sponsored_signer/`** 并改名（不暴露 eip7702 字眼）。这是"重写"中唯一带"代码搬迁"性质的，其它都是从头按新 SDK 重写。

---

## 6. 要修改的文件

| 路径 | 改动 |
|---|---|
| `config.go` | 增加三库各自的 Config（admin 私钥、relay sponsor 私钥、cache 配置、multicall3 地址）；移除老 SDK 配置 |
| `doc.go` / `errors.go` / `types.go` / `markets.go` / `tokens.go` | Phase 6 Task 0 时审阅；保留必要部分，其余删 |
| `coretypes/types.go` / `errors.go` | 追加 §4.6 列出的新类型 |
| `watcher/watcher.go` | **扩展**为可注入多种 worker（保留现有 receipt-tracker；新增 cache-invalidator）；或在 `cache/invalidator.go` 复制其 ticker+worker 模式 |
| `migrations/` | 新增 SQL：`cache_invalidator_cursor` 表（单行 KV 存 last-seen-block） |

---

## 7. 任务粒度拆分（Phase 6 执行顺序）

> 按依赖顺序排列；每个 task 完成准则在末尾。

### 7.1 Task 0 — 范围确认（首要，0.5 天）

- [ ] grep 所有 `oddfi-contracts-sdk` import，列出删除/重写文件清单
- [ ] 审阅 `client/` / `markets.go` / `tokens.go` / `doc.go` / `errors.go` / `types.go` 内容，确认每个文件的去留
- [ ] 列出 `multisig/` 等保留模块对 `methods.go` 的调用点，决定如何让它们改调三库（可能加一层 adapter）
- **完成准则**：产出 `docs/2026-05-14-refactor-task0-scope.md` 含明确文件清单，用户审阅 OK

### 7.2 Task 1 — `coretypes` 扩展（1 天，无依赖）

- [ ] 新增 4 大错误类型 + `Error()`/`Unwrap()` 方法
- [ ] 新增 33 sentinel 错误码（按 `findings.md §4.3.2`）
- [ ] 新增 `MarketID` / `MatchID` / `LpPositionID` / `StakePositionID` 类型别名
- [ ] 单元测试：错误透传 / `errors.Is` 命中
- **完成准则**：`go test ./coretypes/...` 全绿；`errors.As` 能从 wrapped 错误取出 `*BusinessError` 等

### 7.3 Task 2 — `multicall/` 包（1.5 天，无依赖）

- [ ] 用 abigen 生成 multicall3 binding（或手写 `aggregate3` 调用）
- [ ] 实现 `Builder` API：`b.Add(addr, calldata) ... b.Execute(ctx)`
- [ ] 实现 `Decode` 帮助：按 ABI 把 raw bytes 解到 Go 类型
- [ ] 单元测试：用 mock ethClient 验证 builder 流
- **完成准则**：`go test ./multicall/...` 全绿；e2e 在 BSC 测试网真实调用一次 `aggregate3` 拿 `BalanceOf + AccountedBalance + GetMarketOdds`

### 7.4 Task 3 — `cache/` 包（2 天，依赖 Task 1）

- [ ] `Client` 接口（Get/Set/Del/MGet/MDel）+ Redis 实现 + 进程内 `sync.Map` 实现
- [ ] `keys.go` 命名规范（如 `oddfi:bpool:taxbps`）
- [ ] `ttl.go` TTL 策略表（按 `findings.md §6.0` 分档）
- [ ] `Invalidator` 结构（复用 `watcher/` 的 ticker + worker 模式，但 worker 是 `FilterLogs` 而非 `eth_getTransactionReceipt`）
- [ ] `cache_invalidator_cursor` 表的 migration + repo
- [ ] 事件 → cache key 映射表（暂时填空 keys，selector 待 Task 4）
- [ ] 单元测试：Redis fake / 失效路径覆盖
- **完成准则**：`go test ./cache/...` 全绿；用 testcontainers 启 Redis 跑集成测试

### 7.5 Task 4 — Revert 解析与 selector 映射（0.5 天，依赖 Task 1）

- [ ] grep 新 SDK `contracts/abi/*.json` 提取 `errors` 字段的 4-byte selector
- [ ] 写 `coretypes/revert_decode.go`：selector → sentinel 映射函数
- [ ] MVP 手写 10 条（见 `findings.md §4.3.4`）；未知 → `ErrInternalUnknownRevert`
- [ ] 单元测试：构造各 selector 的 revert bytes 验证翻译
- **完成准则**：10 条 selector 全部能翻译；未知 selector 触发告警路径

### 7.6 Task 5 — `read/` 包骨架 + 42 个签名（2 天，依赖 Task 1/3）

- [ ] `client.go` + `dto.go` + `enums.go`
- [ ] 按 `findings.md §3.16.5` 表挨个实现 42 个签名（先不接缓存，先透传 SDK + DTO 包装 + 1e4 除法 for 赔率）
- [ ] `action_status.go`（读 chain_actions 表）
- [ ] 按缓存类（B/C/D）接入 cache layer：
  - C 类 22 个 → 进程内 sync.Once（启动一次拉）
  - B 类 4 + D 类 6 → Redis 短 TTL
- [ ] 单元测试：DTO 转换、enum 翻译、cache 命中/未命中路径
- **完成准则**：`go test ./read/...` 全绿；e2e 在 BSC 测试网调 42 个读各一次

### 7.7 Task 6 — `relay/` 包内部基建（1 天，依赖 Task 1/2/4）

- [ ] 把 `internal/eip7702/` 的代付签名核心逻辑搬到 `relay/internal/sponsored_signer/`，改包名/类型名（移除所有 eip7702 字眼）
- [ ] `relay/client.go` + `relay/service.go`：通用 `submit(ctx, calldata) (TxHash, ActionID, error)` 流程：
  1. 落 `chain_actions` 行（pending）
  2. multicall 预校验（接受外部传入的"预校验描述符"）
  3. 签名（用 sponsored_signer）
  4. 提交链上 → 拿 hash → 更新行
  5. A 形态返回；B 形态进 `waitReceipt(hash) (Receipt, error)` 等回执
- [ ] 单元测试：mock 各步
- **完成准则**：通用 flow 单测全绿，可注入 mock SDK 跑通

### 7.8 Task 7 — `relay/` 10 个具体接口（3 天，依赖 Task 5/6）

- [ ] 按 `findings.md §3.1 / §3.6 ~ §3.14` 卡片，逐个实现：
  - `PlaceBet` + `PlaceBetWithReceipt`
  - `ClaimPayout` + `WithReceipt`
  - `DepositGlobal` / `DepositMatch` / `RequestUnbond` / `Withdraw` / `Stake` / `Unstake` / `Transfer` / `Approve`（各 + WithReceipt）
- [ ] 每个接口单测：mock SDK + multicall，覆盖各错误分支
- **完成准则**：`go test ./relay/...` 全绿；e2e 测试 `PlaceBet` 跑通

### 7.9 Task 8 — `admin/` 4 个接口（1.5 天，依赖 Task 5/6 的部分能力）

- [ ] `admin/client.go`：持 admin 私钥 + `submit()` 通用流程（与 relay 类似但用固定 admin signer，不接受外部私钥）
- [ ] `AddPlatformReserve` / `GrantRole` / `OpenMarket` / `SettleMarket`（各 + WithReceipt）
- [ ] 单测全覆盖
- **完成准则**：`go test ./admin/...` 全绿

### 7.10 Task 9 — Cache 失效器接入（1 天，依赖 Task 3）

- [ ] 把 §6.1 (B 类 4)/§6.2 (C 类 22, 含 token metadata 不订阅)/§6.3 (D 类 6) 的事件 → cache key 映射全填到 `invalidator_mapping.go`
- [ ] 启动 Invalidator goroutine + 启动时 backfill
- [ ] 失效路径单测 + Redis 集成测
- **完成准则**：模拟链上事件（用 anvil/hardhat fork）触发失效，能在下次读时回源

### 7.11 Task 10 — methods/service 顶层重写（1 天，依赖 Task 7/8/9）

- [ ] 删除 `writes/` / `sponsored/` / `internal/eip7702/` / `methods.go` / `service*.go`
- [ ] 新建顶层 `business.go`（或保留 `service.go`）：
  - 构造 `admin.Client` / `relay.Client` / `read.Client` 各一个
  - 用顶层 `Service` 重导出三个子 client（业务上层可写 `svc.Admin().OpenMarket(...)` / `svc.Relay().PlaceBet(...)` / `svc.Read().GetMarket(...)`）
- [ ] 调整 `multisig/` 等保留模块的调用点（如它们之前调 `Service.SubmitXxx`，现改调 `Service.Admin().Xxx`）
- **完成准则**：`go build ./...` 通过；老的 `Submit*` 调用点全部迁移完毕

### 7.12 Task 11 — e2e 测试重写（2 天，依赖 Task 10）

- [ ] 重写 `flow1_e2e_test.go` / `flow2_e2e_test.go` / `e2e_helpers_test.go`
- [ ] 覆盖：admin 开盘 → relay 下注 → admin 锁注/结算 → relay claim payout 的完整链路
- [ ] 新加：A 形态返回 + 后续 `read.GetActionStatus` 轮询的测试
- **完成准则**：在 BSC 测试网两个 flow 全绿

### 7.13 Task 12 — 文档与清理（0.5 天）

- [ ] 更新 README.md 描述三库分层
- [ ] 删除过期 `docs/superpowers/specs/*.md`（旧 sponsored / creditdeposit / business-layer design）
- [ ] 旧 plan `docs/superpowers/plans/2026-05-06-flow1-flow2-e2e.md` 标记 archive
- [ ] CHANGELOG 加一条

### 7.14 总工期估算

| Task | 工期 |
|---|---|
| 0 范围确认 | 0.5 d |
| 1 coretypes | 1.0 d |
| 2 multicall | 1.5 d |
| 3 cache | 2.0 d |
| 4 revert 解析 | 0.5 d |
| 5 read | 2.0 d |
| 6 relay 基建 | 1.0 d |
| 7 relay 10 接口 | 3.0 d |
| 8 admin 4 接口 | 1.5 d |
| 9 cache 失效器 | 1.0 d |
| 10 顶层重写 | 1.0 d |
| 11 e2e 重写 | 2.0 d |
| 12 文档清理 | 0.5 d |
| **合计** | **17.5 d** |

> 串行估算；并行（如 Task 1/2/3 同时启动）可压到 ~12 天。

---

## 8. 测试策略

- **单元测试**：每个新包 ≥ 80% 行覆盖；重点：multicall 解码、revert 翻译、cache 失效路径
- **集成测试**：用 testcontainers 启 MySQL + Redis；Redis cache 路径走集成
- **e2e 测试**：BSC 测试网，沿用现有 BSC 配置与 admin 钱包
- **回归保护**：Task 11 重写 e2e 前，先在新 branch 跑老 e2e 确认 baseline；重构完跑新 e2e 比对

---

## 9. 回滚预案

- 在 `feature/refactor-three-libs` 分支上做，main 不动
- 每个 Task 单独 commit，commit message 写明对应 task 编号
- 如需中途 abort：`git checkout main` 即可恢复

---

## 10. 风险清单

| # | 风险 | 影响 | 缓解 |
|---|---|---|---|
| R1 | multicall3 在 BSC 测试网部署地址确认 | 阻塞 Task 2 | Task 0 时手动验证 |
| R2 | 新 SDK API 在 Phase 5 之后还在变（v0.x） | 接口签名漂移 | pin 到具体 commit；与 SDK 作者协调 |
| R3 | revert selector 实际值与 MVP 10 条假设不符 | Task 4 重做 | Task 4 grep ABI 确认 |
| R4 | `internal/eip7702/` 代码搬迁到 `relay/internal/sponsored_signer/` 时 BSC EIP-7702 支持的依赖暴露 | 命名约束被破坏 | 仅改包/类型名，不改逻辑；公共 API 不出现 7702 字眼即可 |
| R5 | 缓存失效器漏事件 | 数据陈旧 | TTL 兜底 + Confirmations=2 + last-seen-block 持久化 + 启动时 backfill |
| R6 | `multisig/` 模块调用迁移工作量超出 Task 10 估算 | 工期超 | Task 0 时审计调用点，必要时拆 Task 10a/10b |

---

## 附录 A — `findings.md` 章节索引（执行时随查）

| Section | 内容 |
|---|---|
| §0 | 项目/SDK 上下文快照 |
| §1 | SDK 全接口清单（42 read + 14 write + 14 calldata） |
| §2 | 分类决策（admin/relay/read 切分 + 缓存方案 Y） |
| §3.0 | 卡片设计原则（multicall 必用、Allowance 跳过等） |
| §3.1 | `relay.PlaceBet` 完整模板卡片 |
| §3.2-§3.14 | 其余 13 张写卡片 |
| §3.15 | 14 接口汇总速查表 |
| §3.16 | read 库 42 个 DTO + 签名 |
| §4.1 | M2 命名规范 + 28 函数命名表 |
| §4.2 | `GetActionStatus` 设计 |
| §4.3 | 错误模型（4 类 + 33 sentinel + MVP 10 revert） |
| §6 | 缓存失效需求清单 |

---

## 附录 B — task_plan.md 决策记录索引

22 条决策已在 `task_plan.md` 决策表里逐条 timestamp，Phase 6 执行时如有疑问，回查 timestamp 对应行。
