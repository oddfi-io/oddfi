# 重构发现记录

> 所有从外部读取的内容（SDK 源码、合约 ABI、接口签名等）都落在这里，不写进 `task_plan.md`。

## §0 上下文快照

- **本项目**：`D:\everything_finance\org\contracts-business-layer`（Go 1.22+，gorm/MySQL，go-redis，已有 writes/* 目录，已有 e2e）
- **新 SDK**：`D:\everything_finance\oddfi-ODD-SDK`，模块名 `github.com/Crypto-Barrett/oddfi-ODD-SDK`
- **新 SDK 顶层布局**（已确认）：
  ```
  pkg/oddfi/                 ← 唯一对外包
    ├── client.go            ← SDK 入口
    ├── address.go           ← 地址注册/查询
    ├── bettingpool.go       ← 投注池
    ├── liquiditypool.go     ← LP 池
    ├── stakingpool.go       ← 质押池
    ├── oddtoken.go          ← ODD token
    └── errors.go
  contracts/abi/             ← ABI
  internal/domain/           ← 领域模型（不对外）
  internal/infrastructure/   ← 基础设施（不对外）
  ```

---

## §1 SDK 接口清单（Phase 1 产出）

> 来源：`D:\everything_finance\oddfi-ODD-SDK\pkg\oddfi\*.go`（已排除 `_test.go`）
> 分组规则：**类型 / 读（view）/ 写（state-changing, 需要 `opts *bind.TransactOpts`）/ Calldata（代付层必需）**
> 行尾的 `[admin?]` / `[代付?]` / `[共用?]` / `[不暴露?]` 是建议归类，**待 Phase 2 用户确认**。

---

### 1.1 client.go — SDK 入口

**类型**
- `Config struct { RPCURL string; ODDTokenProxy, StakingPoolProxy, LiquidityPoolProxy, BettingPoolProxy common.Address }` — 构造参数。
- `Client struct{…}` — SDK 句柄（只读 reader 的聚合体；本身**不持私钥、不发交易**）。
- `Option interface{ apply(*clientOptions) }` — 预留扩展位（当前无实现）。

**构造与生命周期**
- `NewClient(ctx, cfg Config, opts ...Option) (*Client, error)` — 拨号 + 绑定四个 adapter。
- `(*Client).Close(ctx) error` — 关 RPC，幂等。

**子句柄 accessor（每个 -> 一个子领域 reader）**
- `(*Client).ODDToken() *ODDToken`
- `(*Client).StakingPool() *StakingPool`
- `(*Client).LiquidityPool() *LiquidityPool`
- `(*Client).BettingPool() *BettingPool`

> 注：`Client` 设计上是**只读门面**。所有"写"方法仍挂在子类型上，但其参数是 `*bind.TransactOpts`——签名权由调用方（本层）持有，SDK 不碰私钥。

---

### 1.2 address.go — 地址工具

- `ParseAddress(value string) (common.Address, error)` — 严格校验。 `[共用?]`
- `MustParseAddress(value string) common.Address` — panic 版。 `[共用?]`

---

### 1.3 bettingpool.go — 投注池

**类型**
- `QuoteGuardInput { QuoteVersion *big.Int; QuotedAt uint64; MinOdds *big.Int; MinAcceptedAmount *big.Int; Deadline *big.Int }`
- `MarketInfo { MatchID [32]byte; MarketType, Line, OutcomeCount uint8; MatchStartTime, LockAt uint64; Status uint8; MatchEndTime uint64 }`
- `MarketOdds { BaseOdds, QuotedOdds []*big.Int; UpdatedAt uint64; QuoteVersion *big.Int }`
- `SignalResult { Signal uint8; AcceptedAmount, LockedOdds *big.Int; PartialFill bool; MaxAcceptableAmount *big.Int }`
- `BetInfo { Owner common.Address; MarketID [32]byte; Outcome uint8; AcceptedAmount, RefundedAmount, LockedOdds *big.Int; SettlementState uint8; ClaimablePayout *big.Int }`
- `BettingPool struct{…}` — 子句柄。

**读（view）**
- `OddToken(ctx)` / `StakingPool(ctx)` / `LiquidityPool(ctx)` / `PlatformTreasury(ctx)` — 配置地址查询。
- `Paused(ctx) (bool, error)`
- `BetTaxBps(ctx) (uint16, error)` / `PayoutTaxBps(ctx) (uint16, error)`
- `PlatformReserve(ctx) (*big.Int, error)` / `AccountedBalance(ctx) (*big.Int, error)`
- `GetMarket(ctx, marketID [32]byte) (MarketInfo, error)`
- `GetMarketOdds(ctx, marketID [32]byte) (MarketOdds, error)`
- `GetBet(ctx, betID [32]byte) (BetInfo, error)`
- `PreviewSignal(ctx, marketID, outcome uint8, requestedAmount *big.Int) (SignalResult, error)`
- `IsMatchTerminal(ctx, matchID [32]byte) (bool, error)`
- `HasRole(ctx, role [32]byte, account common.Address) (bool, error)`

**写（需 `*bind.TransactOpts`）**
- `AddPlatformReserve(opts, amount *big.Int)` — 注入平台储备。 `[admin?]`
- `GrantRole(opts, role [32]byte, account common.Address)` — 角色管理。 `[admin?]`
- `OpenMarket(opts, matchID, marketType, line uint8, matchStart, matchEnd uint64, baseOdds []*big.Int, updatedAt uint64)` `[admin?]`
- `PlaceBet(opts, marketID [32]byte, outcome uint8, requestedAmount *big.Int, guard QuoteGuardInput)` `[代付?]`
- `SettleMarket(opts, marketID, resultKindRaw, winningOutcome uint8)` `[admin?]`
- `ClaimPayout(opts, betID [32]byte)` `[代付?]`

**Calldata（代付层取 raw data 用）**
- `AddPlatformReserveCalldata(amount) ([]byte, error)`
- `GrantRoleCalldata(role, account) ([]byte, error)`
- `OpenMarketCalldata(matchID, marketType, line, matchStart, matchEnd, baseOdds, updatedAt) ([]byte, error)`
- `PlaceBetCalldata(marketID, outcome, requestedAmount, guard) ([]byte, error)`
- `SettleMarketCalldata(marketID, resultKindRaw, winningOutcome) ([]byte, error)`
- `ClaimPayoutCalldata(betID) ([]byte, error)`

---

### 1.4 liquiditypool.go — 流动性池

**类型**
- `LiquidityPool struct{…}` — 子句柄。
- `PayoutLiquidityWindow { … }` — 出块支付流动性窗口（字段未列；用户决定是否对外）。

**读**
- `OddToken(ctx)` / `BettingPool(ctx)` — 配置地址。
- `Paused(ctx) (bool, error)`
- `MinDeposit(ctx) (*big.Int, error)`
- `RequestableLiquidity(ctx) (*big.Int, error)`
- `TotalActiveDeposited(ctx) (*big.Int, error)`
- `TotalOutstandingPayoutReserved(ctx) (*big.Int, error)`
- `PayoutLiquidityWindow(ctx, matchID [32]byte) (PayoutLiquidityWindow, error)`
- `UnbondEpochs(ctx) (uint32, error)`
- `NextLpPositionID(ctx) (*big.Int, error)`
- `GetPositionState(ctx, positionID *big.Int) (uint8, error)`

**写**
- `DepositGlobal(opts, amount, planID)` `[代付?]`
- `DepositMatch(opts, matchID [32]byte, amount)` `[代付?]`
- `RequestUnbond(opts, positionID)` `[代付?]`
- `Withdraw(opts, positionID)` `[代付?]`

**Calldata**
- `DepositGlobalCalldata(amount, planID)`
- `DepositMatchCalldata(matchID, amount)`
- `RequestUnbondCalldata(positionID)`
- `WithdrawCalldata(positionID)`

---

### 1.5 stakingpool.go — 质押池

**类型**
- `StakingPool struct{…}` — 子句柄。

**读**
- `OddToken(ctx)` / `BettingPool(ctx)` / `PlatformTreasury(ctx)` — 配置地址。
- `Paused(ctx) (bool, error)`
- `MinStakeAmount(ctx) (*big.Int, error)`
- `TotalWeightedShares(ctx) (*big.Int, error)`
- `AccountedOddBalance(ctx) (*big.Int, error)`
- `NextPositionID(ctx) (*big.Int, error)`
- `GetActiveStakeAmount(ctx, user common.Address) (*big.Int, error)`

**写**
- `Stake(opts, amount, planID)` `[代付?]`
- `Unstake(opts, positionID)` `[代付?]`

**Calldata**
- `StakeCalldata(amount, planID)`
- `UnstakeCalldata(positionID)`

---

### 1.6 oddtoken.go — ODD ERC20

**类型**
- `ODDToken struct{…}` — 子句柄。

**读**
- `Name` / `Symbol` / `Decimals` / `TotalSupply` / `Paused`
- `BalanceOf(ctx, account)` `[共用?]` — **本层做余额检查会高频用**
- `Allowance(ctx, owner, spender)` `[共用?]` — 代付前 approve 检查

**写**
- `Transfer(opts, to, value)` `[代付?]`
- `Approve(opts, spender, value)` `[代付?]`

**Calldata**
- `TransferCalldata(to, value)`
- `ApproveCalldata(spender, value)`

---

### 1.7 errors.go — 错误类型

**Sentinel 变量**
- `ErrInvalidAddress`
- `ErrNilContext`
- `ErrMissingODDToken` / `ErrMissingStakingPool` / `ErrMissingLiquidityPool` / `ErrMissingBettingPool`
- `ErrNilBigIntParam`

**Error 类型（含 `Error() string` 与 `Unwrap() error`）**
- `ConfigError { Op string; Err error }` — 配置层错误
- `InfraError { Op string; Err error }` — 基础设施/RPC 错误
- `UserError { Op string; Err error }` — 用户输入错误

> 本层应该把这三类错误**透传/翻译**，对外暴露统一错误码。Phase 4 再定。

---

### 1.8 全集统计

| 文件 | 类型 | 读 | 写 | Calldata |
|------|----|----|----|----------|
| client.go | 3 | 4 accessor + Close | 0 | 0 |
| address.go | 0 | 0 | 0 | 0（+2 工具函数） |
| bettingpool.go | 6 | 14 | 6 | 6 |
| liquiditypool.go | 2 | 11 | 4 | 4 |
| stakingpool.go | 1 | 9 | 2 | 2 |
| oddtoken.go | 1 | 7 | 2 | 2 |
| errors.go | 3 | — | — | — |
| **合计写方法** | | | **14** | **14** |

> 14 个写方法 ↔ 14 个 calldata 方法，一一对应。本层重构的对外接口数量上限 = 14（每个再 ×2 形态 = 28 个对外函数；实际会少于这个数，看用户分类）。

---

## §2 分类结果（Phase 2 产出）

### 2.0 用户决策（2026-05-14）

1. **代付库名 = `relay`**（避开 eip7702 相关词）。
2. **对外暴露三个独立库（Go 包）**：`admin` / `relay` / `read`。
3. **`read` 库 = SDK 全部 42 个读方法的转发/包装**（无差别全收；统计修正：原计 41 漏了 `BettingPool.HasRole`，实为 42）。
4. **14 个写方法的 admin↔relay 归属**：admin = 4（`AddPlatformReserve` / `GrantRole` / `OpenMarket` / `SettleMarket`），relay = 10（其余）。详见 §2.2。
5. **Q1**: `AddPlatformReserve` → **admin**（对外暴露，不藏）。
6. **Q2**: `Transfer` / `Approve` → **仅 relay**，admin 不保留同名方法。
7. **D1**: read 库返回**包装成本层 DTO**，不透传 SDK 原生类型（理由：稳定 ABI、统一错误模型、便于打缓存与做单位转换）。
8. **D2**: 缓存策略 → 等用户看完 §2.5 全清单后拍板。

### 2.1 read 库覆盖范围（自动归类，已锁定）

> 41 个读方法全部归 `read`。**读方法不需要"两种返回形态"**——读本来就是即返。

**覆盖清单**（按 SDK 文件汇总，详细签名见 §1）：

| 来源文件 | 数量 | 方法 |
|---|---|---|
| `bettingpool.go` | 14 | `OddToken` / `StakingPool` / `LiquidityPool` / `PlatformTreasury` / `Paused` / `BetTaxBps` / `PayoutTaxBps` / `PlatformReserve` / `AccountedBalance` / `GetMarket` / `GetMarketOdds` / `GetBet` / `PreviewSignal` / `IsMatchTerminal` / `HasRole`（实为 15，OddToken/StakingPool/LiquidityPool/PlatformTreasury 算 4 个地址查询；总计 §1.3 列出 14 项+HasRole=15，复核见 §1.3） |
| `liquiditypool.go` | 11 | `OddToken` / `BettingPool` / `Paused` / `MinDeposit` / `RequestableLiquidity` / `TotalActiveDeposited` / `TotalOutstandingPayoutReserved` / `PayoutLiquidityWindow` / `UnbondEpochs` / `NextLpPositionID` / `GetPositionState` |
| `stakingpool.go` | 9 | `OddToken` / `BettingPool` / `PlatformTreasury` / `Paused` / `MinStakeAmount` / `TotalWeightedShares` / `AccountedOddBalance` / `NextPositionID` / `GetActiveStakeAmount` |
| `oddtoken.go` | 7 | `Name` / `Symbol` / `Decimals` / `TotalSupply` / `Paused` / `BalanceOf` / `Allowance` |
| `address.go` | 2 工具函数 | `ParseAddress` / `MustParseAddress`（建议归 `read` 包顶层 utils，或独立 `pkg/util`，待 Phase 5 定） |

**待 Phase 3 决定**：
- read 接口签名是**完全透传**（直接接 `*oddfi.Client`）还是**做一层封装**（统一加 ctx 校验 / 错误翻译 / Redis 缓存）？我倾向后者——下面 §2.3 列了几个具体设计点请你拍。

### 2.2 写方法分类（admin vs relay）— **已锁定**

| # | SDK 写方法 | admin | relay |
|---|------------|:-----:|:-----:|
| 1 | `BettingPool.AddPlatformReserve(amount)` | ✅ |  |
| 2 | `BettingPool.GrantRole(role, account)` | ✅ |  |
| 3 | `BettingPool.OpenMarket(...)` | ✅ |  |
| 4 | `BettingPool.PlaceBet(marketID, outcome, amount, guard)` |  | ✅ |
| 5 | `BettingPool.SettleMarket(...)` | ✅ |  |
| 6 | `BettingPool.ClaimPayout(betID)` |  | ✅ |
| 7 | `LiquidityPool.DepositGlobal(amount, planID)` |  | ✅ |
| 8 | `LiquidityPool.DepositMatch(matchID, amount)` |  | ✅ |
| 9 | `LiquidityPool.RequestUnbond(positionID)` |  | ✅ |
| 10 | `LiquidityPool.Withdraw(positionID)` |  | ✅ |
| 11 | `StakingPool.Stake(amount, planID)` |  | ✅ |
| 12 | `StakingPool.Unstake(positionID)` |  | ✅ |
| 13 | `ODDToken.Transfer(to, value)` |  | ✅ |
| 14 | `ODDToken.Approve(spender, value)` |  | ✅ |

**计数**：admin = **4**（`AddPlatformReserve` / `GrantRole` / `OpenMarket` / `SettleMarket`）；relay = **10**。
**对外接口数**：4×2 形态 + 10×2 形态 = **28 个写接口**，加上 42 个 read 接口（read 不分 A/B 形态） = **70 个对外函数总数上限**。同时也要更新 §2.0 的 4 条：admin = 4（**不是 5**），relay = 10。

### 2.3 read 库设计 — D1 已定，D2 待拍

- **D1（已定）**：read 库**包装一层 DTO**。每个 SDK 类型对应一个本层 DTO，`*big.Int` → 字符串或 `decimal.Decimal`（待 Phase 3 细化），`uint8` 枚举值翻译为有命名的 Go 常量（如 `MarketStatusOpen`）。
- **D2（待拍）**：哪些读走 Redis 缓存？见 §2.5 全清单的"缓存建议"列，请按行勾选最终策略。
- **D3**：地址工具 `ParseAddress` / `MustParseAddress` → 建议放 `read` 包顶层（不另起 util 包，避免过度分层），Phase 5 落地再定。

### 2.4 命名决定

- **代付库专属名 = `relay`** ✅（用户 2026-05-14 确认）
- **三库包路径建议**（Phase 5 落地时再定，先记一下候选）：
  - `github.com/Crypto-Barrett/contracts-business-layer/admin`
  - `github.com/Crypto-Barrett/contracts-business-layer/relay`
  - `github.com/Crypto-Barrett/contracts-business-layer/read`

---

### 2.5 read 库全 42 个读方法（D2 拍板用）

**变更率分档** —— 决定缓存策略的依据：

| 档位 | 含义 | 缓存建议 |
|---|---|---|
| ❄️ 冰 | 合约部署后基本不变（配置地址、token metadata） | 进程内缓存 + Redis 24h |
| ⏸️ 冷 | 管理员偶尔修改（费率、暂停状态、最小额） | Redis 5–15 分钟 + 事件失效 |
| 🌡️ 温 | 业务流引发变化但有界（池子聚合、市场状态、仓位） | Redis 10–30 秒 or 事件失效 |
| 🔥 热 | 用户余额、动态计算 | 不缓存 / Redis ≤5 秒 |

#### 2.5.1 ODDToken（7）

| # | 方法 | 入参 | 返回 | 档位 | 缓存建议 | 用户选 |
|---|------|------|------|:---:|---------|:---:|
| 1 | `Name(ctx)` | — | `string` | ❄️ | 进程内永久 | ⬜ |
| 2 | `Symbol(ctx)` | — | `string` | ❄️ | 进程内永久 | ⬜ |
| 3 | `Decimals(ctx)` | — | `uint8` | ❄️ | 进程内永久 | ⬜ |
| 4 | `TotalSupply(ctx)` | — | `*big.Int` | ⏸️ | Redis 5–15min | ⬜ |
| 5 | `Paused(ctx)` | — | `bool` | ⏸️ | Redis 5–15min + 事件失效 | ⬜ |
| 6 | `BalanceOf(ctx, account)` | `common.Address` | `*big.Int` | 🔥 | **不缓存**（下注/转账前必须实时） | ⬜ |
| 7 | `Allowance(ctx, owner, spender)` | `common.Address × 2` | `*big.Int` | 🔥 | **不缓存** | ⬜ |

#### 2.5.2 BettingPool（15）

| # | 方法 | 入参 | 返回 | 档位 | 缓存建议 | 用户选 |
|---|------|------|------|:---:|---------|:---:|
| 8 | `OddToken(ctx)` | — | `common.Address` | ❄️ | 进程内永久 | ⬜ |
| 9 | `StakingPool(ctx)` | — | `common.Address` | ❄️ | 进程内永久 | ⬜ |
| 10 | `LiquidityPool(ctx)` | — | `common.Address` | ❄️ | 进程内永久 | ⬜ |
| 11 | `PlatformTreasury(ctx)` | — | `common.Address` | ❄️ | 进程内永久 | ⬜ |
| 12 | `Paused(ctx)` | — | `bool` | ⏸️ | Redis 5–15min + 事件失效 | ⬜ |
| 13 | `BetTaxBps(ctx)` | — | `uint16` | ⏸️ | Redis 15min | ⬜ |
| 14 | `PayoutTaxBps(ctx)` | — | `uint16` | ⏸️ | Redis 15min | ⬜ |
| 15 | `PlatformReserve(ctx)` | — | `*big.Int` | 🌡️ | Redis 30s | ⬜ |
| 16 | `AccountedBalance(ctx)` | — | `*big.Int` | 🌡️ | **不缓存**（业务约束：只在下注路径调用，频次=下注 QPS，缓存命中率低） | ⬜ |
| 17 | `GetMarket(ctx, marketID)` | `[32]byte` | `MarketInfo` | 🌡️ | Redis 10–30s + 事件失效 | ⬜ |
| 18 | `GetMarketOdds(ctx, marketID)` | `[32]byte` | `MarketOdds` | 🌡️ | Redis ≤10s（QuoteVersion 高频变） | ⬜ |
| 19 | `GetBet(ctx, betID)` | `[32]byte` | `BetInfo` | 🌡️ | Redis 30s + 结算事件失效 | ⬜ |
| 20 | `PreviewSignal(ctx, marketID, outcome, amount)` | 3 参 | `SignalResult` | 🔥 | **不缓存**（动态计算） | ⬜ |
| 21 | `IsMatchTerminal(ctx, matchID)` | `[32]byte` | `bool` | 🌡️ | Redis 30s | ⬜ |
| 22 | `HasRole(ctx, role, account)` | `[32]byte, addr` | `bool` | ⏸️ | Redis 5min | ⬜ |

#### 2.5.3 LiquidityPool（11）

| # | 方法 | 入参 | 返回 | 档位 | 缓存建议 | 用户选 |
|---|------|------|------|:---:|---------|:---:|
| 23 | `OddToken(ctx)` | — | `common.Address` | ❄️ | 进程内永久 | ⬜ |
| 24 | `BettingPool(ctx)` | — | `common.Address` | ❄️ | 进程内永久 | ⬜ |
| 25 | `Paused(ctx)` | — | `bool` | ⏸️ | Redis 5–15min + 事件失效 | ⬜ |
| 26 | `MinDeposit(ctx)` | — | `*big.Int` | ⏸️ | Redis 15min | ⬜ |
| 27 | `RequestableLiquidity(ctx)` | — | `*big.Int` | 🌡️ | Redis 30s | ⬜ |
| 28 | `TotalActiveDeposited(ctx)` | — | `*big.Int` | 🌡️ | Redis 30s | ⬜ |
| 29 | `TotalOutstandingPayoutReserved(ctx)` | — | `*big.Int` | 🌡️ | Redis 30s | ⬜ |
| 30 | `PayoutLiquidityWindow(ctx, matchID)` | `[32]byte` | `PayoutLiquidityWindow` | 🌡️ | Redis 30s | ⬜ |
| 31 | `UnbondEpochs(ctx)` | — | `uint32` | ⏸️ | Redis 15min | ⬜ |
| 32 | `NextLpPositionID(ctx)` | — | `*big.Int` | 🌡️ | **不缓存**（自增 ID） | ⬜ |
| 33 | `GetPositionState(ctx, positionID)` | `*big.Int` | `uint8` | 🌡️ | Redis 30s + 事件失效 | ⬜ |

#### 2.5.4 StakingPool（9）

| # | 方法 | 入参 | 返回 | 档位 | 缓存建议 | 用户选 |
|---|------|------|------|:---:|---------|:---:|
| 34 | `OddToken(ctx)` | — | `common.Address` | ❄️ | 进程内永久 | ⬜ |
| 35 | `BettingPool(ctx)` | — | `common.Address` | ❄️ | 进程内永久 | ⬜ |
| 36 | `PlatformTreasury(ctx)` | — | `common.Address` | ❄️ | 进程内永久 | ⬜ |
| 37 | `Paused(ctx)` | — | `bool` | ⏸️ | Redis 5–15min + 事件失效 | ⬜ |
| 38 | `MinStakeAmount(ctx)` | — | `*big.Int` | ⏸️ | Redis 15min | ⬜ |
| 39 | `TotalWeightedShares(ctx)` | — | `*big.Int` | 🌡️ | Redis 30s | ⬜ |
| 40 | `AccountedOddBalance(ctx)` | — | `*big.Int` | 🌡️ | Redis 30s | ⬜ |
| 41 | `NextPositionID(ctx)` | — | `*big.Int` | 🌡️ | **不缓存** | ⬜ |
| 42 | `GetActiveStakeAmount(ctx, user)` | `common.Address` | `*big.Int` | 🔥 | **不缓存** | ⬜ |

#### 2.5.5 简化决策模式（可选）

如果你不想 42 行逐个勾，可以直接选**整套方案**：

- **方案 A — 全不缓存**：MVP 阶段最省事，链上数据全部实时查。Redis 仅留作业务态用。
- **方案 B — 仅缓存 ❄️ 档**（11 项地址/metadata）：进程内 sync.Map，零外部依赖。
- **方案 C — ❄️+⏸️ 缓存**（21 项）：上述 +Redis 中 TTL，覆盖大多数配置类读。**👈 我推荐这套作为起步**。
- **方案 D — 按行精细配置**：照上表逐行选，最大化命中率，但事件失效逻辑要做。

#### 2.5.6 缓存方案外的两个相关点

- **事件失效**：方案 C/D 涉及"事件失效"——本层需要订阅链上事件（如 `BetTaxUpdated`、`Paused`、`MarketSettled`）来主动 evict Redis key。这是工作量大头，是否启用 → 待 Phase 3 评估，**先记在这里**。
- **进程内缓存 vs Redis**：❄️ 档其实没必要走 Redis（命中率低、网络开销大于直读），用 `sync.Once`/`sync.Map` 即可。Phase 3 再细化代码层。

---

#### 2.5.7 D2 — 用户给的口径与最终决策（2026-05-14）

**用户原话归纳**：
- 「和赛事有关系、但不涉及单独地址状态的」→ 可缓存。
- 「涉及详细地址状态的」→ 不缓存。

**按口径把 42 个读方法重新分 5 类**：

| 类 | 数量 | 典型成员 | 按用户字面规则 | 我的建议 |
|---|:-:|---|:---:|:---:|
| **A 用户态**（入参含 address 或用户独占 ID） | 6 | `BalanceOf` / `Allowance` / `GetBet` / `HasRole` / `GetPositionState` / `GetActiveStakeAmount` | **不缓存** | **不缓存** |
| **B 赛事态**（入参 marketID/matchID，与市场强相关） | 4 | `GetMarket` / `GetMarketOdds` / `IsMatchTerminal` / `PayoutLiquidityWindow` | **缓存** | **缓存** |
| **C 全局配置**（合约地址 9、token metadata 3、Paused 4、税率 2、最小额 2、纪元 1、TotalSupply 1） | 22 | `OddToken/StakingPool/LiquidityPool/PlatformTreasury` 各地址 / `Name/Symbol/Decimals` / `BetTaxBps` / `MinDeposit` / `UnbondEpochs`… | ❓（用户规则未覆盖） | **缓存**（最稳的一类，命中率最高） |
| **D 池子聚合**（全局池子状态） | 6 | `PlatformReserve` / `RequestableLiquidity` / `TotalActiveDeposited` / `TotalOutstandingPayoutReserved` / `TotalWeightedShares` / `AccountedOddBalance` | ❓（用户规则未覆盖） | **缓存**（短 TTL，做"风控/报表"展示已足够） |
| **F 业务低频读**（剔出 D 类）| 1 | `AccountedBalance` | — | **不缓存**（业务约束：只在下注路径调用） |
| **E 动态/自增**（每次值不同，缓存无意义） | 3 | `PreviewSignal` / `NextLpPositionID` / `NextPositionID` | **不缓存** | **不缓存** |

**A 类详细成员（6）**：
- `ODDToken.BalanceOf(account)`
- `ODDToken.Allowance(owner, spender)`
- `BettingPool.GetBet(betID)`（bet 归属某用户）
- `BettingPool.HasRole(role, account)`
- `LiquidityPool.GetPositionState(positionID)`（仓位归属某 LP）
- `StakingPool.GetActiveStakeAmount(user)`

**B 类详细成员（4）**：
- `BettingPool.GetMarket(marketID)`
- `BettingPool.GetMarketOdds(marketID)`
- `BettingPool.IsMatchTerminal(matchID)`
- `LiquidityPool.PayoutLiquidityWindow(matchID)`

**E 类详细成员（3）**：
- `BettingPool.PreviewSignal(marketID, outcome, amount)` — 入参 amount 高基数，缓存命中率约 0
- `LiquidityPool.NextLpPositionID()` — 自增 ID
- `StakingPool.NextPositionID()` — 自增 ID

**两个收口候选方案**：

| 方案 | 缓存 | 不缓存 | 取舍 |
|---|---|---|---|
| **X 严格按用户口径** | B（4） | A + C + D + E（38） | 最 MVP，但每次启动重复拉 22 个全局配置 |
| **Y 推荐（已选）** | B + C + D'（32） | A + E + F（10） | 命中率高；D 类剔出 `AccountedBalance` → F 类，剩 6 个纯事件失效 |

**最终决策（2026-05-14）**：
- **方案 Y ✅**（缓存 B + C + D = 32 个，A + E + F = 10 个不缓存）
  - 用户进一步约束：`AccountedBalance`（原 D 类）业务上只在下注路径调用 → 剔出，不缓存。F 类专列。
- **启用事件失效 ✅**（不靠 TTL 兜底；理由：admin 改值后必须立刻生效）
- **HTTP poll 实现 ✅**（用户确认无 ws）—— 复用老项目 `watcher/` 模式
- 失效需求清单见 §6（按 B/C/D 分层；D 类现 6 个，纯事件失效）。

---

---

## §6 事件失效需求清单（D2 配套，Phase 3 起细化）

> 33 个走缓存的读方法，每个都要绑定"哪些链上事件触发其失效"。具体事件名待 Phase 3 查 SDK 的 ABI 时落实，本节先列**语义需求**。

### 6.0 原则与工程现实

- **缓存层 ≠ 永远新鲜**：事件失效 + TTL 兜底**同时启用**——失效是主路径，TTL 是兜底（漏事件时的保护网）。
- **失效粒度**：以**单条 cache key 为单位 evict**（而不是清空整个命名空间），减少误失效。
- **HTTP poll 实现，不依赖 ws ✅**（用户 2026-05-14 确认无 ws 端点）：
  - 用 `eth_getLogs(fromBlock=lastSeen, toBlock=latest, addresses=[...], topics=[...])` 轮询拉新事件。
  - 复用老项目 `watcher/` 模式（`PollInterval` 默认 500ms）——新建独立的 `cache_invalidator` 实例或扩展现有 Watcher。
  - 失效延迟 = `PollInterval`（500ms ~ 2s 可调），对方案 Y 完全够用。
- **last-seen-block 持久化**：MySQL/Redis 存最近处理过的区块号，进程重启从那继续，避免漏事件。
- **重组（reorg）保护**：`Confirmations` 已在老 Watcher 里有（默认 2），失效器也用同样的 confirmation depth，避免链重组导致的"假失效"。
- **失效是「驱动 evict」，不是「主动重读」**：失效后该 key 下一次被访问时回源 RPC，避免重读风暴。

### 6.1 B 类失效映射（4 个赛事态）

| Cache Key | 失效触发（语义） |
|---|---|
| `GetMarket(marketID)` | 该 marketID 上的 `MarketOpened` / `MarketLocked` / `MarketSettled` / `MarketCancelled` / `MarketRefunded` |
| `GetMarketOdds(marketID)` | 该 marketID 上的 `OddsUpdated` + `BetPlaced`（quoteVersion 因每次下注递增） |
| `IsMatchTerminal(matchID)` | 该 matchID 任一市场的 `MarketSettled` / `MarketCancelled` |
| `PayoutLiquidityWindow(matchID)` | 该 matchID 的 `PayoutReserved` / `PayoutReleased` 类事件 |

**注**：B 类按 marketID/matchID 分 key，事件携带这两个字段，**失效精准**——不会牵连其它赛事。

### 6.2 C 类失效映射（22 个全局配置）

| 子组 | Cache Key 示例 | 失效触发（语义） |
|---|---|---|
| 配置地址（9）| `BettingPool.OddToken` 等 | 各合约的 `Upgraded` / `<Component>Updated` 事件 |
| Token metadata（3）| `ODDToken.Name/Symbol/Decimals` | **不订阅**——ERC20 实践中不变；进程内 `sync.Once` 拉一次永久 |
| Paused（4）| `BettingPool.Paused` / `LiquidityPool.Paused` / `StakingPool.Paused` / `ODDToken.Paused` | 各合约的 `Paused` / `Unpaused` |
| 费率（2）| `BettingPool.BetTaxBps` / `PayoutTaxBps` | `BetTaxUpdated` / `PayoutTaxUpdated` 类事件 |
| 最小额（2）| `LiquidityPool.MinDeposit` / `StakingPool.MinStakeAmount` | `MinDepositUpdated` / `MinStakeAmountUpdated` |
| 纪元（1）| `LiquidityPool.UnbondEpochs` | `UnbondEpochsUpdated` |
| TotalSupply（1）| `ODDToken.TotalSupply` | `Transfer(from=0)` mint / `Transfer(to=0)` burn |

**注**：Token metadata 不订阅事件（事件不存在/合约不抛），靠**永远不失效**。这点是工程上唯一豁免。

### 6.3 D 类失效映射（6 个池子聚合）

> 用户 2026-05-14 进一步约束：`AccountedBalance` 只在下注路径调用 → 剔出 D 类、不缓存（见 F 类）。
> 剩余 6 个全部走事件失效，无 TTL 降级。

| Cache Key | 失效触发（语义） | 评估 |
|---|---|---|
| `BettingPool.PlatformReserve` | `PlatformReserveAdded` + `PlatformReserveWithdrawn` | 事件少 |
| `LiquidityPool.RequestableLiquidity` | LP 的 deposit/unbond/withdraw + 平台 reserve/release | 事件多但有限 |
| `LiquidityPool.TotalActiveDeposited` | `Deposited` / `Unbonded` / `Withdrawn` | 中等 |
| `LiquidityPool.TotalOutstandingPayoutReserved` | `PayoutReserved` / `PayoutReleased` | 中等 |
| `StakingPool.TotalWeightedShares` | `Staked` / `Unstaked` | 中等 |
| `StakingPool.AccountedOddBalance` | `Staked` / `Unstaked` / `RewardDistributed` | 中等 |

**已收口（2026-05-14）**：D 类 6 个全部事件失效；`AccountedBalance` 单独剔到 F 类不缓存。

### 6.4 工程基建清单（Phase 3 / Phase 5 落地用）

- [ ] ~~`Config` 增加 `WSURL` 字段~~ **取消**（用户 2026-05-14 确认无 ws 端点 → 改用 HTTP poll）
- [ ] **事件失效器**（`cache/invalidator.go`）—— 复用老项目 `watcher/` 的 ticker + worker 模式
  - 用 `ethclient.FilterLogs(ctx, FilterQuery{FromBlock, ToBlock, Addresses, Topics})` 拉日志
  - `PollInterval` 与现有 Watcher 一致（500ms 起步可调）
  - `Confirmations` 与现有 Watcher 一致（默认 2）防 reorg
- [ ] 事件 → cache key 失效映射表（Go map 或 yaml 配置）
- [ ] last-seen-block 持久化（推荐 MySQL `cache_invalidator_cursor` 表，单行 KV）
- [ ] 启动时 backfill：从 last-seen-block 回扫到 `latest - Confirmations`，期间相关 key 强制 evict
- [ ] 失效错误兜底：失效失败时降级到 TTL（不能因为失效 bug 拖累读路径）
- [ ] 指标：缓存命中率 / 失效次数 / `getLogs` 调用速率 / cursor 滞后区块数

---

## §3 接口卡片（Phase 3 产出）

### 3.0 卡片设计的通用原则（必读）

#### 3.0.1 第一原则：避免重复链上读（用户 2026-05-14 强调）

- 一次对外调用**最多读 1 次链**（multicall 合并所有需要的预校验值）。
- 接口内部各函数之间**传递已读到的值**，不重复 RPC。
- 缓存类读（B/C/D 类）正常走缓存层，但仍计入"读次数预算"。

#### 3.0.2 下注路径（PlaceBet）的预校验读清单

| 读项 | 是否必读 | 来源 | 备注 |
|---|---|---|---|
| `BalanceOf(user)` | ✅ | 链 | 校验用户 ODD 余额 ≥ 下注金额 |
| `AccountedBalance()` | ✅ | 链 | 校验池子余额够覆盖潜在赔付（业务定义"余额是否足够下注"） |
| `GetMarketOdds(marketID)` | ✅ | 缓存 B 类 / 链 | 用作 `QuoteGuardInput` 的 `QuoteVersion` + `QuotedAt` |
| `Allowance(user, BettingPool)` | ❌ **跳过** | — | 用户决策：业务上层保证每次转账前先 approve |

**实现**：上述 3 项必读全部走 **multicall3** 合并到 1 个 RPC。

#### 3.0.3 multicall3 实施细节

- **合约地址**：`0xcA11bde05977b3631167028862bE2a173976CA11`（多链通用部署地址，BSC 主网/测试网均有）
- **接入方式**：本层新增 `multicall/` 包，用 abigen 生成 multicall3 binding 或手写 `aggregate3` 调用
- **失败处理**：multicall3 的 `aggregate3` 支持单 call 失败不影响整体（`allowFailure`），但本层预校验**任一失败即拒绝**，所以用 `allowFailure=false`
- **gas 上限**：multicall 调用本身视为只读 `eth_call`，无 gas 限制问题

#### 3.0.4 Allowance 跳过的风险与兜底

- **风险**：用户实际 allowance 不足时，链上 `PlaceBet` 会 revert → 代付路径下平台付 gas 但交易失败
- **兜底**（不强制，业务上层选用）：
  - `relay.Approve(user, spender, amount)` 已暴露 → 业务上层在用户首次接入或额度耗尽时主动调用
  - 本层**可选**在 Redis 记录 `allowance_set:{user}:{spender}` 标志位，业务上层查表决定是否要先 approve
- **MVP**：本层下注路径不查、不记录。完全交给业务上层。

#### 3.0.5 卡片模板

每张接口卡片用以下结构：

```
### N. <接口名>（admin / relay）

**SDK 对应**：<sdk method>
**形态**：A（hash-only） / B（wait-mined） / 两者都有

**入参**：
- ctx context.Context
- <业务参数...>
- <对 relay 必含：privateKey 或 from address>

**预校验（multicall 内）**：
- [ ] <项 1>
- [ ] <项 2>

**业务校验（链下）**：
- [ ] 幂等键（idempotency_key）已记录？
- [ ] 金额格式合法（非零、非负、不超过 uint256）？
- [ ] <其他>

**内部流程**：
1. <步骤 1>
2. <步骤 2>
...

**返回（A 形态）**：tx hash + 异步落 `chain_actions` 表，由 Watcher 跟进
**返回（B 形态）**：等 receipt（含 `Confirmations` 块确认），返回 receipt + 解析后业务态

**失败语义**：
- <错误码 → 错误类型 → 是否可重试>
```

---

### 3.1 卡片 #1：`relay.PlaceBet`（代表卡片，详细完整）

> 这是用户原始例子的接口：「传入 ctx + A 的私钥 + 金额，调用下注接口，返回上链 hash」。
> 用它当模板验证设计，OK 后其它 13 张写卡片照葫芦画瓢。

**SDK 对应**：`BettingPool.PlaceBet(opts, marketID, outcome, requestedAmount, guard)` + `PlaceBetCalldata(...)`
**形态**：两种都有 → 暴露为 `PlaceBetAsync`（A）和 `PlaceBet`（B）；具体命名待 §4 规范决定

**入参**：
- `ctx context.Context`
- `req PlaceBetRequest`：
  - `PrivateKey *ecdsa.PrivateKey` — 用户私钥（**警告：不能落日志**）
  - `MarketID [32]byte`
  - `Outcome uint8`
  - `Amount *big.Int` — 期望下注金额（ODD wei）
  - `MinAcceptedAmount *big.Int` — 最小可接受成交额（用于部分成交保护）
  - `MinOdds *big.Int` — 最小可接受赔率（1e4 精度）
  - `Deadline uint64` — 报价有效截止 Unix 时间戳
  - `IdempotencyKey string` — 幂等键（业务上层生成）

**预校验（multicall 内，1 次 RPC）**：
- [x] `BalanceOf(userAddr) >= Amount`
- [x] `AccountedBalance()` 满足"余额是否足够下注"判定（具体阈值算法待 Q3 进一步细化）
- [x] `GetMarketOdds(MarketID)` 返回 `QuoteVersion` + `UpdatedAt`，用于构造 `QuoteGuardInput`

**业务校验（链下，不读链）**：
- [x] `IdempotencyKey` 在 MySQL `chain_actions` 表无重复
- [x] `Amount > 0` 且 `Amount <= max bet limit`（限额从 C 类缓存读）
- [x] `Outcome < market.OutcomeCount`（C 类缓存的 `GetMarket` 已含 outcome 数）
- [x] `Deadline > now`（防过期请求）
- [x] 从 `PrivateKey` 推导 `userAddr`，校验非零地址
- [x] 市场状态 = Open（从 B 类缓存读 `GetMarket(MarketID).Status`）

**内部流程**：
1. 入参规范化 + 从 `PrivateKey` 派生 `userAddr`
2. 链下业务校验（步骤略）
3. 写 `chain_actions` 行（状态 = `pending`，含 `IdempotencyKey`、`userAddr`、`Amount` 等）
4. multicall3 调一次：拿 `BalanceOf` + `AccountedBalance` + `GetMarketOdds`
5. 链下预校验（步骤略）
6. 构造 `QuoteGuardInput{QuoteVersion, QuotedAt: UpdatedAt, MinOdds, MinAcceptedAmount, Deadline}`
7. 调 `PlaceBetCalldata(MarketID, Outcome, Amount, guard)` 拿 raw calldata
8. 用 `PrivateKey` 签交易（gas 估算 + nonce 由 relay 通道管理）
9. 提交上链 → 拿 tx hash → 更新 `chain_actions` 行（`tx_hash`，状态 = `submitted`）
10. **A 形态返回**：返回 tx hash，结束。Watcher 异步跟回执。
11. **B 形态继续**：阻塞等回执（`Confirmations` 默认 2 块）→ 解析事件 → 更新 `chain_actions` 行 = `confirmed` → 返回 receipt + `BetID`（从事件解出）

**返回（A 形态 `PlaceBetAsync`）**：
```go
type PlaceBetAsyncResult struct {
    TxHash         common.Hash
    ActionID       string  // chain_actions 主键，用于后续查状态
    IdempotencyKey string
}
```

**返回（B 形态 `PlaceBet`）**：
```go
type PlaceBetResult struct {
    TxHash         common.Hash
    BetID          [32]byte           // 从 BetPlaced 事件解出
    AcceptedAmount *big.Int           // 从事件解出（含部分成交场景）
    LockedOdds     *big.Int
    Receipt        *types.Receipt
}
```

**失败语义（举例，统一错误模型待 §4）**：
| 场景 | 错误码 | 类型 | 可重试 |
|---|---|---|---|
| `IdempotencyKey` 重复 | `ErrIdempotencyConflict` | UserError | ❌ |
| `BalanceOf < Amount` | `ErrInsufficientBalance` | UserError | ❌（除非用户充值） |
| `AccountedBalance` 不足 | `ErrPoolUndercapitalized` | InfraError | ⚠️ 等池子恢复 |
| 市场非 Open 状态 | `ErrMarketNotOpen` | UserError | ❌ |
| `Deadline` 已过 | `ErrQuoteExpired` | UserError | ✅（重新报价） |
| RPC 调用失败 | `ErrRPCFailure` | InfraError | ✅ |
| 上链 revert | `ErrTxReverted` | UserError/InfraError 视 revert reason | 视情况 |
| receipt 等待超时（仅 B 形态）| `ErrReceiptTimeout` | InfraError | ✅（轮询 chain_actions 查最终状态） |

---

### 3.1.6 §3.1 通用细节锁定（用户 2026-05-14）

| 项 | 决策 |
|---|---|
| T1 入参字段（8 个） | 充足 |
| T2 A 形态返回 `ActionID` | OK |
| T3 B 形态确认数 | 2 块（沿用 `Watcher.Confirmations` 默认值） |
| T4 错误码风格 | 英文驼峰，无中文 |
| T5 私钥类型 | `*ecdsa.PrivateKey` |

下面 13 张写卡片**通用部分**全部继承 §3.1（A/B 双形态命名规则、`IdempotencyKey` 字段、`chain_actions` 落表流程、`Confirmations=2`、`*ecdsa.PrivateKey` 私钥参数、英文错误码），仅列**差异部分**。

---

### 3.2 `admin.AddPlatformReserve`（admin）

**SDK**：`BettingPool.AddPlatformReserve(opts, amount)` + `Calldata`
**形态**：A + B
**调用方**：平台内部脚本，固定使用 admin 私钥（注入到 admin 包构造）

**入参**：
- `ctx`
- `req AddPlatformReserveRequest{ Amount *big.Int; IdempotencyKey string }`

**预校验（multicall 内，1 次 RPC）**：
- `ODDToken.BalanceOf(adminAddr) >= Amount`
- `ODDToken.Allowance(adminAddr, BettingPool) >= Amount`（admin 路径**要查 allowance**——admin 不一定每次提前 approve）

**业务校验**：`Amount > 0`；`IdempotencyKey` 不重复。

**返回**：`{ TxHash, ActionID }`（A）/ `{ TxHash, Receipt }`（B）

**差异化失败语义**：
- `ErrAdminAllowanceInsufficient` — admin 未授权或额度不足。可重试（先 admin.Approve 再调用）。

> **S1 已锁定（2026-05-14）**：保留 Allowance 预校验（与 relay 不一致是可接受的，admin 没有"业务上层"代为保证 allowance）。

---

### 3.3 `admin.GrantRole`（admin）

**SDK**：`BettingPool.GrantRole(opts, role, account)` + `Calldata`
**形态**：A + B

**入参**：`req{ Role [32]byte; Account common.Address; IdempotencyKey string }`

**预校验**：**无**（admin 是否真有 grant 权限交由合约 revert 兜底）

**业务校验**：`Role != [32]byte{}`；`Account != zero`；幂等键。

**返回**：`{ TxHash, ActionID }` / `{ TxHash, Receipt }`

**差异化失败语义**：
- `ErrNotAdmin` — admin 私钥地址非 DEFAULT_ADMIN_ROLE，合约 revert（运维错配）。

---

### 3.4 `admin.OpenMarket`（admin）

**SDK**：`BettingPool.OpenMarket(opts, matchID, marketType, line, matchStart, matchEnd, baseOdds, updatedAt)` + `Calldata`
**形态**：A + B

**入参**：`req{ MatchID [32]byte; MarketType, Line uint8; MatchStartTime, MatchEndTime uint64; BaseOdds []*big.Int; UpdatedAt uint64; IdempotencyKey string }`

**预校验**：**无**（市场已存在由合约 revert）

**业务校验**：
- `MatchStartTime < MatchEndTime`
- `MatchEndTime > now`
- `len(BaseOdds)` 与 `marketType` 决定的 outcome 数匹配（运营给的 BaseOdds 不能错配）
- 每个 `BaseOdds[i] > 0`
- `UpdatedAt <= now`

**返回**：`{ TxHash, ActionID }` / `{ TxHash, MarketID [32]byte, Receipt }`（B 形态解 `MarketOpened` 事件拿 marketID）

**差异化失败语义**：
- `ErrMarketAlreadyOpen` — 同 (matchID, marketType, line) 已开盘。
- `ErrMaxMarketsPerMatch` — 超过合约规定的单场比赛最大盘口数。

---

### 3.5 `admin.SettleMarket`（admin）

**SDK**：`BettingPool.SettleMarket(opts, marketID, resultKindRaw, winningOutcome)` + `Calldata`
**形态**：A + B

**入参**：`req{ MarketID [32]byte; ResultKind uint8; WinningOutcome uint8; IdempotencyKey string }`

**预校验（multicall 内，1 次 RPC）**：
- `BettingPool.GetMarket(MarketID)` —— 校验 `Status == Locked`（**注**：B 类缓存可命中，可省 RPC；但 settle 是低频敏感操作，**建议直查链**绕过缓存）
- `BettingPool.IsMatchTerminal(GetMarket.MatchID)` —— 防止重复 settle

**业务校验**：
- `WinningOutcome < market.OutcomeCount`
- `ResultKind` 在合约定义的有效枚举范围（待 Phase 3 查 ABI 定义）

**返回**：`{ TxHash, ActionID }` / `{ TxHash, Receipt }`

**差异化失败语义**：
- `ErrMarketNotLocked` — 市场未锁注，不能 settle。
- `ErrMarketAlreadySettled` — 已 settle。
- `ErrOnlyMultisig` — settle 在合约里是 `onlyMultisig` 限制，admin 私钥若非 multisig 成员会 revert。

> **注**：老代码标记 `SettleMarket` 走 abigen binding 直接调用，因为旧 SDK admin 客户端不暴露 settle。新 SDK `pkg/oddfi.BettingPool.SettleMarket` 已暴露 → 本层可直接用，不需要 binding 旁路。

---

### 3.6 `relay.ClaimPayout`（relay）

**SDK**：`BettingPool.ClaimPayout(opts, betID)` + `Calldata`
**形态**：A + B

**入参**：`req{ PrivateKey *ecdsa.PrivateKey; BetID [32]byte; IdempotencyKey string }`

**预校验（multicall 内，1 次 RPC）**：
- `BettingPool.GetBet(BetID)` —— 检查 `Owner == userAddr`，`SettlementState == WonUnclaimed`，`ClaimablePayout > 0`

**业务校验**：常规（地址非零、幂等键）。

**返回**：`{ TxHash, ActionID }` / `{ TxHash, ClaimedAmount *big.Int, Receipt }`

**差异化失败语义**：
- `ErrBetNotOwned` — bet 不属于该用户。
- `ErrBetNotWon` — bet 状态非 WonUnclaimed（Pending/Lost/Refunded/已 claim）。
- `ErrPayoutZero` — `ClaimablePayout == 0`（理论上不应发生）。

---

### 3.7 `relay.DepositGlobal`（relay）

**SDK**：`LiquidityPool.DepositGlobal(opts, amount, planID)` + `Calldata`
**形态**：A + B

**入参**：`req{ PrivateKey; Amount *big.Int; PlanID uint16; IdempotencyKey string }`

**预校验（multicall 内，1 次 RPC）**：
- `ODDToken.BalanceOf(userAddr) >= Amount`

（`MinDeposit` 走 C 类缓存校验，不进 multicall。）

**业务校验**：
- `Amount >= MinDeposit`（C 缓存）
- `PlanID` 在合约定义的有效区间（Phase 3 查 ABI）

**返回**：`{ TxHash, ActionID }` / `{ TxHash, PositionID *big.Int, Receipt }`（B 解 `Deposited` 事件）

**差异化失败语义**：
- `ErrBelowMinDeposit` — Amount < MinDeposit。
- `ErrInvalidPlanID`。

---

### 3.8 `relay.DepositMatch`（relay）

**SDK**：`LiquidityPool.DepositMatch(opts, matchID, amount)` + `Calldata`
**形态**：A + B

**入参**：`req{ PrivateKey; MatchID [32]byte; Amount *big.Int; IdempotencyKey string }`

**预校验（multicall 内，1 次 RPC）**：
- `ODDToken.BalanceOf(userAddr) >= Amount`
- `LiquidityPool.PayoutLiquidityWindow(MatchID)` —— 合到 multicall（**S5 已锁定**：与 BalanceOf 合并 1 次 RPC，不复用 B 缓存）

**业务校验**：`Amount > 0`；`MatchID != [32]byte{}`。

**返回**：`{ TxHash, ActionID }` / `{ TxHash, PositionID *big.Int, Receipt }`

**差异化失败语义**：
- `ErrPayoutWindowClosed` — 该 matchID 的 payout 窗口已关闭。

---

### 3.9 `relay.RequestUnbond`（relay）

**SDK**：`LiquidityPool.RequestUnbond(opts, positionID)` + `Calldata`
**形态**：A + B

**入参**：`req{ PrivateKey; PositionID *big.Int; IdempotencyKey string }`

**预校验（multicall 内，1 次 RPC）**：
- `LiquidityPool.GetPositionState(PositionID)` —— 校验状态允许 unbond
- （归属性合约层会 revert，本层不预查 owner，省 1 个 RPC）

**业务校验**：`PositionID != nil` 且 `> 0`。

**返回**：`{ TxHash, ActionID }` / `{ TxHash, UnlockAtBlock uint64, Receipt }`

**差异化失败语义**：
- `ErrPositionWrongState` — 仓位状态非 Active。
- `ErrPositionNotOwned` — 合约 revert（本层不预查，依赖兜底）。

---

### 3.10 `relay.Withdraw`（relay）

**SDK**：`LiquidityPool.Withdraw(opts, positionID)` + `Calldata`
**形态**：A + B

**入参**：`req{ PrivateKey; PositionID *big.Int; IdempotencyKey string }`

**预校验（multicall 内，1 次 RPC）**：
- `LiquidityPool.GetPositionState(PositionID)` —— 校验状态 = `Unbonded` 且解锁到期

**业务校验**：常规。

**返回**：`{ TxHash, ActionID }` / `{ TxHash, WithdrawnAmount *big.Int, Receipt }`

**差异化失败语义**：
- `ErrPositionNotUnbonded`。
- `ErrPositionNotMatured` — 解锁纪元未到。

---

### 3.11 `relay.Stake`（relay）

**SDK**：`StakingPool.Stake(opts, amount, planID)` + `Calldata`
**形态**：A + B

**入参**：`req{ PrivateKey; Amount *big.Int; PlanID uint16; IdempotencyKey string }`

**预校验（multicall 内，1 次 RPC）**：
- `ODDToken.BalanceOf(userAddr) >= Amount`

**业务校验**：
- `Amount >= MinStakeAmount`（C 缓存）
- `PlanID` 合法

**返回**：`{ TxHash, ActionID }` / `{ TxHash, PositionID *big.Int, Receipt }`

**差异化失败语义**：
- `ErrBelowMinStake`。
- `ErrInvalidPlanID`。

---

### 3.12 `relay.Unstake`（relay）

**SDK**：`StakingPool.Unstake(opts, positionID)` + `Calldata`
**形态**：A + B

**入参**：`req{ PrivateKey; PositionID *big.Int; IdempotencyKey string }`

**预校验**：**无 multicall**（合约自己会校验 owner 与可解押条件，省 1 个 RPC）

**业务校验**：`PositionID > 0`。

**返回**：`{ TxHash, ActionID }` / `{ TxHash, UnstakedAmount *big.Int, Receipt }`

**差异化失败语义**：
- `ErrStakeNotMatured` — 锁定期未到。
- `ErrPositionNotOwned`。

---

### 3.13 `relay.Transfer`（relay）

**SDK**：`ODDToken.Transfer(opts, to, value)` + `Calldata`
**形态**：A + B

**入参**：`req{ PrivateKey; To common.Address; Value *big.Int; IdempotencyKey string }`

**预校验（multicall 内，1 次 RPC）**：
- `ODDToken.BalanceOf(userAddr) >= Value`

**业务校验**：`To != zero`；`Value > 0`。

**返回**：`{ TxHash, ActionID }` / `{ TxHash, Receipt }`

**差异化失败语义**：
- `ErrInsufficientBalance`（沿用 §3.1）。
- `ErrTokenPaused` — ODDToken 处于暂停态（C 缓存可预判，但仍以链上 revert 为准）。

---

### 3.14 `relay.Approve`（relay）

**SDK**：`ODDToken.Approve(opts, spender, value)` + `Calldata`
**形态**：A + B

**入参**：`req{ PrivateKey; Spender common.Address; Value *big.Int; IdempotencyKey string }`

**预校验**：**无**（approve 不依赖余额；无 multicall）

**业务校验**：`Spender != zero`。
> **注**：`Value == 0` 也是合法用例（用于撤销授权），不拒绝。

**返回**：`{ TxHash, ActionID }` / `{ TxHash, Receipt }`

**差异化失败语义**：仅常规 `ErrTxReverted` / `ErrRPCFailure`。

---

### 3.15 卡片汇总速查表

| # | 接口 | 库 | multicall 读项数 | 形态 |
|---|---|---|:---:|:---:|
| 1 | `PlaceBet` | relay | 3 | A+B |
| 2 | `AddPlatformReserve` | admin | 2 | A+B |
| 3 | `GrantRole` | admin | 0 | A+B |
| 4 | `OpenMarket` | admin | 0 | A+B |
| 5 | `SettleMarket` | admin | 2 | A+B |
| 6 | `ClaimPayout` | relay | 1 | A+B |
| 7 | `DepositGlobal` | relay | 1 | A+B |
| 8 | `DepositMatch` | relay | 2 | A+B |
| 9 | `RequestUnbond` | relay | 1 | A+B |
| 10 | `Withdraw` | relay | 1 | A+B |
| 11 | `Stake` | relay | 1 | A+B |
| 12 | `Unstake` | relay | 0 | A+B |
| 13 | `Transfer` | relay | 1 | A+B |
| 14 | `Approve` | relay | 0 | A+B |

总计 14 个接口 × 2 形态 = **28 个对外写函数**。
multicall 读项数累计 = 15 个链上读，分布在 9 个接口（其余 5 个不预校验，靠合约 revert 兜底）。

### 3.16 read 库 42 个 DTO 设计

#### 3.16.0 老项目风格摸底（依据）

- `coretypes/types.go` 已定义：`ActionID int64` / `ProposalID int64` / `TxHash string` / `BetID [32]byte`
- `go.mod` 已含 `github.com/shopspring/decimal v1.4.0`
→ 本层 read DTO **完全沿用这套风格**，新增 ID 类型放入 `coretypes`，DTO 结构放入 `read` 包。

#### 3.16.1 类型映射约定（D1 决策落地）

| SDK 原生类型 | 本层 DTO 类型 | 理由 |
|---|---|---|
| `*big.Int` | `decimal.Decimal` | 老项目已有依赖；财务计算友好；JSON 序列化为字符串无精度丢失 |
| `common.Address` | `common.Address` 保留 | 业界惯例；类型本身已含校验逻辑 |
| `[32]byte`（标识符）| 命名类型别名 `coretypes.<XxxID>` | 与现有 `BetID` 风格一致 |
| `uint8`（枚举）| 命名类型 + 常量集（如 `MarketStatus`）| 类型安全 + 可读 |
| `uint64`（时间戳）| `uint64` 保留 | web3 风格；不引入 `time.Time` 的序列化歧义；业务侧需要 `time.Time` 时自行 `time.Unix(int64(ts), 0)` |
| `string` | `string` 保留 | 无包装必要 |
| `bool` | `bool` 保留 | 同上 |

#### 3.16.2 新增 ID 类型（追加到 `coretypes/types.go`）

```go
type MarketID    [32]byte
type MatchID     [32]byte
type LpPositionID *big.Int   // 自增 ID，沿用 big.Int 指针避免精度丢失
type StakePositionID *big.Int
```

> **注**：`LpPositionID` / `StakePositionID` 是合约的自增 uint256，理论范围超过 int64。沿用 `*big.Int`（指针）而非 `decimal.Decimal`——ID 不参与算术，指针更轻量。

#### 3.16.3 枚举常量集（新建 `read/enums.go`）

```go
// MarketStatus —— GetMarket().Status 解码
type MarketStatus uint8
const (
    MarketStatusOpen      MarketStatus = 0
    MarketStatusLocked    MarketStatus = 1
    MarketStatusSettled   MarketStatus = 2
    MarketStatusRefunded  MarketStatus = 3
    MarketStatusCancelled MarketStatus = 4
)

// BetSettlementState —— GetBet().SettlementState 解码
type BetSettlementState uint8
const (
    BetSettlementPending     BetSettlementState = 0
    BetSettlementRefunded    BetSettlementState = 1
    BetSettlementLost        BetSettlementState = 2
    BetSettlementWonUnclaimed BetSettlementState = 3
    BetSettlementWonClaimed  BetSettlementState = 4
)

// SignalColor —— PreviewSignal().Signal 解码
type SignalColor uint8
const (
    SignalGreen  SignalColor = 0
    SignalYellow SignalColor = 1
    SignalOrange SignalColor = 2
    SignalRed    SignalColor = 3
)

// LpPositionState —— GetPositionState 返回值（具体常量待 Phase 3 查 ABI）
type LpPositionState uint8
// ResultKind —— SettleMarket 入参（具体常量待 Phase 3 查 ABI）
type ResultKind uint8
```

#### 3.16.4 6 个核心 DTO（`read/dto.go`）

```go
// MarketInfo —— GetMarket 返回
type Market struct {
    MatchID        coretypes.MatchID
    MarketType     uint8           // 待业务定枚举名
    Line           uint8
    OutcomeCount   uint8
    MatchStartTime uint64
    LockAt         uint64
    Status         MarketStatus    // 枚举包装
    MatchEndTime   uint64
}

// MarketOdds —— GetMarketOdds 返回
type MarketOdds struct {
    BaseOdds     []decimal.Decimal  // 1e4 精度，DTO 内已除以 1e4 ？或保留原精度？→ 见 §3.16.6 N1
    QuotedOdds   []decimal.Decimal
    UpdatedAt    uint64
    QuoteVersion decimal.Decimal    // 实际是 uint256 但用作版本号
}

// BetInfo —— GetBet 返回
type Bet struct {
    Owner           common.Address
    MarketID        coretypes.MarketID
    Outcome         uint8
    AcceptedAmount  decimal.Decimal
    RefundedAmount  decimal.Decimal
    LockedOdds      decimal.Decimal
    SettlementState BetSettlementState
    ClaimablePayout decimal.Decimal
}

// SignalResult —— PreviewSignal 返回
type Signal struct {
    Color               SignalColor
    AcceptedAmount      decimal.Decimal
    LockedOdds          decimal.Decimal
    PartialFill         bool
    MaxAcceptableAmount decimal.Decimal
}

// PayoutLiquidityWindow —— PayoutLiquidityWindow 返回（字段待 Phase 5 查 SDK 内部细节）
type PayoutWindow struct {
    // TODO Phase 5: 看 SDK pkg/oddfi/liquiditypool.go 的 PayoutLiquidityWindow 实际字段
}

// QuoteGuardInput 不属于 read 库（是 write 库 PlaceBet 的入参的一部分），但 read 库的 GetMarketOdds 输出常用于构造它
```

#### 3.16.5 42 个 read 接口的本层签名（汇总）

> 包名 `read`，接口风格：`func (c *Client) MethodName(ctx, args...) (DTO, error)`
> 错误统一用本层 error wrapper（待 §4 错误模型决定）

| # | 本层签名（去 ctx 缩写） | SDK 对应 | 缓存类 |
|---|---|---|:---:|
| 1 | `Name() (string, error)` | `ODDToken.Name` | C |
| 2 | `Symbol() (string, error)` | `ODDToken.Symbol` | C |
| 3 | `Decimals() (uint8, error)` | `ODDToken.Decimals` | C |
| 4 | `TotalSupply() (decimal.Decimal, error)` | `ODDToken.TotalSupply` | C |
| 5 | `TokenPaused() (bool, error)` | `ODDToken.Paused` | C |
| 6 | `BalanceOf(account) (decimal.Decimal, error)` | `ODDToken.BalanceOf` | **A 不缓存** |
| 7 | `Allowance(owner, spender) (decimal.Decimal, error)` | `ODDToken.Allowance` | **A 不缓存** |
| 8-11 | `BettingPoolODDToken() / StakingPool() / LiquidityPool() / PlatformTreasury()` 4 个地址查询 | `BettingPool.*` | C |
| 12 | `BettingPoolPaused()` | `BettingPool.Paused` | C |
| 13 | `BetTaxBps() (uint16, error)` | — | C |
| 14 | `PayoutTaxBps() (uint16, error)` | — | C |
| 15 | `PlatformReserve() (decimal.Decimal, error)` | — | D |
| 16 | `AccountedBalance() (decimal.Decimal, error)` | — | **F 不缓存** |
| 17 | `GetMarket(marketID) (Market, error)` | — | B |
| 18 | `GetMarketOdds(marketID) (MarketOdds, error)` | — | B |
| 19 | `GetBet(betID) (Bet, error)` | — | **A 不缓存** |
| 20 | `PreviewSignal(marketID, outcome, amount) (Signal, error)` | — | **E 不缓存** |
| 21 | `IsMatchTerminal(matchID) (bool, error)` | — | B |
| 22 | `HasRole(role, account) (bool, error)` | — | **A 不缓存** |
| 23-24 | `LiquidityPoolODDToken() / LiquidityPoolBettingPool()` | — | C |
| 25 | `LiquidityPoolPaused()` | — | C |
| 26 | `MinDeposit() (decimal.Decimal, error)` | — | C |
| 27 | `RequestableLiquidity() (decimal.Decimal, error)` | — | D |
| 28 | `TotalActiveDeposited() (decimal.Decimal, error)` | — | D |
| 29 | `TotalOutstandingPayoutReserved() (decimal.Decimal, error)` | — | D |
| 30 | `PayoutLiquidityWindow(matchID) (PayoutWindow, error)` | — | B |
| 31 | `UnbondEpochs() (uint32, error)` | — | C |
| 32 | `NextLpPositionID() (coretypes.LpPositionID, error)` | — | **E 不缓存** |
| 33 | `GetLpPositionState(positionID) (LpPositionState, error)` | — | **A 不缓存** |
| 34-36 | `StakingPoolODDToken() / StakingPoolBettingPool() / StakingPoolPlatformTreasury()` | — | C |
| 37 | `StakingPoolPaused()` | — | C |
| 38 | `MinStakeAmount() (decimal.Decimal, error)` | — | C |
| 39 | `TotalWeightedShares() (decimal.Decimal, error)` | — | D |
| 40 | `AccountedOddBalance() (decimal.Decimal, error)` | — | D |
| 41 | `NextStakePositionID() (coretypes.StakePositionID, error)` | — | **E 不缓存** |
| 42 | `GetActiveStakeAmount(user) (decimal.Decimal, error)` | — | **A 不缓存** |

**地址工具**：`read.ParseAddress(s)` / `read.MustParseAddress(s)` 直接转发 SDK 同名函数（无 DTO 包装必要）。

#### 3.16.6 待用户拍的几个开口

- **N1 赔率精度处理**：SDK 中 `BaseOdds` / `QuotedOdds` 是 1e4 精度的 `*big.Int`（例如 `15000` 表示 1.5）。本层 DTO 用 `decimal.Decimal`，是否做**自动除 1e4**得到人类可读值（1.5）？
  - (a) 自动除 1e4 → DTO 字段更直观，但失去原始精度
  - (b) 保留原始 1e4 整数 → 业务侧自己除
  - **我倾向 (a)** —— DTO 的目的就是消化协议细节
- **N2 命名重复处理**：`OddToken` / `BettingPool` / `Paused` 等方法名在 4 个合约下都有，本层 read.Client 怎么命名？
  - (a) 加合约前缀：`BettingPoolPaused()` / `LiquidityPoolPaused()` 等 → 我上面表格用的就是这个，但啰嗦
  - (b) 按子句柄拆：`read.BettingPool().Paused()` / `read.LiquidityPool().Paused()` → 与 SDK 一致，更优雅
  - **我倾向 (b)**，但意味着 read 包内部按子句柄分文件，与 §3.16.5 表格的命名不一致 → 看你选哪个
- **N3 `PayoutLiquidityWindow` 字段**：SDK `pkg/oddfi/liquiditypool.go:24` 已有定义但本会话还未抓字段。Phase 5 落实时读一次即可，**不阻塞 Phase 3**。

---

### 3.15 read 库 42 个 DTO 设计

_待填_——每个 read 方法对应一个本层 DTO 类型（D1 包装层）。等写卡片完成后批量处理。

---

## §4 返回形态规范 + 错误模型（Phase 4 产出）

### 4.1 A/B 形态命名规范

> 14 个写方法每个 ×2 形态 = 28 个对外函数。命名规则要稳定可推。

**候选方案**：

| 方案 | A 形态名 | B 形态名 | 优势 | 劣势 |
|---|---|---|---|---|
| M1 | `PlaceBetAsync` | `PlaceBet` | B 形态是默认（无后缀）；A 形态显式 `Async` 提示风险 | A 形态名字长 |
| M2 | `PlaceBet` | `PlaceBetWithReceipt` | A 形态是默认（吞吐优先）；B 形态加后缀 | 不阻塞=默认 反直觉 |
| M3 | `PlaceBetAsync` | `PlaceBetSync` | 对称、显式 | 两个都加后缀，啰嗦 |
| M4 | 单一方法 + `WaitMode` 选项参数 | `PlaceBet(req, WaitNone)` / `PlaceBet(req, WaitReceipt)` | 接口少一半 | 返回类型不同时签名难统一（要么用 interface{} 要么拆两个返回结构体） |

**用户 2026-05-14 选 M2**：A 形态默认名（无后缀），B 形态加 `WithReceipt` 后缀。

#### 4.1.1 与老代码风格对齐结论

**老代码实际风格**（grep 验证）：
- A 形态：`Service.SubmitLockBet` / `SubmitCreditDeposit` / `SubmitSponsoredTransfer` / `SubmitOpenMarket` 等 — 都加 **`Submit` 前缀**
- B 形态：`SubmitAndWait` / `XxxAndWait` — 加 **`AndWait` 后缀**
- 命名约定来自旧 spec：`docs/superpowers/specs/2026-05-01-sponsored-transfer-design.md` 第 84-85 行已记录

**为什么新设计弃用 `Submit` 前缀**：
- 老代码所有写方法挂在单个 `Service` 上 → 需要 `Submit*` 前缀消歧
- 新设计已按 `admin` / `relay` / `read` 三库分层 → 库名本身做了消歧，再加 `Submit` 是冗余
- M2 落地：`relay.PlaceBet(req)` 而非 `relay.SubmitPlaceBet(req)`，前者干净

**迁移影响**：业务上层调用方调用点全部需要替换。`methods.go` 里的 10 个 `Submit*` 方法在 Phase 5 重构中会被三库新接口替换。

#### 4.1.2 28 个对外函数命名落地表（M2 风格）

| # | A 形态（hash-only，默认）| B 形态（wait-mined） |
|---|---|---|
| 1 | `relay.PlaceBet` | `relay.PlaceBetWithReceipt` |
| 2 | `admin.AddPlatformReserve` | `admin.AddPlatformReserveWithReceipt` |
| 3 | `admin.GrantRole` | `admin.GrantRoleWithReceipt` |
| 4 | `admin.OpenMarket` | `admin.OpenMarketWithReceipt` |
| 5 | `admin.SettleMarket` | `admin.SettleMarketWithReceipt` |
| 6 | `relay.ClaimPayout` | `relay.ClaimPayoutWithReceipt` |
| 7 | `relay.DepositGlobal` | `relay.DepositGlobalWithReceipt` |
| 8 | `relay.DepositMatch` | `relay.DepositMatchWithReceipt` |
| 9 | `relay.RequestUnbond` | `relay.RequestUnbondWithReceipt` |
| 10 | `relay.Withdraw` | `relay.WithdrawWithReceipt` |
| 11 | `relay.Stake` | `relay.StakeWithReceipt` |
| 12 | `relay.Unstake` | `relay.UnstakeWithReceipt` |
| 13 | `relay.Transfer` | `relay.TransferWithReceipt` |
| 14 | `relay.Approve` | `relay.ApproveWithReceipt` |

### 4.2 A 形态状态查询（read 库扩展）

A 形态返回 `ActionID` 后，业务上层需要后续查这笔交易的最终上链状态。需要新增 read 接口：

```go
// read 库新增 —— 查 chain_actions 行的状态
func (c *Client) GetActionStatus(ctx, actionID coretypes.ActionID) (ActionStatus, error)

type ActionStatus struct {
    ActionID       coretypes.ActionID
    Status         coretypes.Status         // 沿用老代码：Pending/Submitted/Mined/Confirmed/Failed/Dropped
    TxHash         coretypes.TxHash
    SubmittedAt    uint64                   // unix sec
    ConfirmedAt    *uint64                  // 已确认才有值
    RevertInfo     *coretypes.RevertInfo    // 失败才有值
    BlockNumber    *uint64
}
```

**字段说明**：
- `Status` 沿用 `coretypes` 已有的 6 状态机
- `TxHash` 沿用老代码的 `string` 别名（不是 common.Hash）
- 这是**读 MySQL 表，不读链**（chain_actions 表里有 Watcher 同步过的状态）

**幂等键查询**（额外，业务上层避免重提）：

```go
func (c *Client) GetActionByIdempotencyKey(ctx, key string) (ActionStatus, error)
```

### 4.3 错误模型（E1/E2/E3 已锁定）

#### 4.3.1 三层错误体系（E1：朴素命名）

| 层 | 类型 | 来源 | 业务上层处理 |
|---|---|---|---|
| **SDK 层** | `oddfi.ConfigError` / `oddfi.InfraError` / `oddfi.UserError` | 配置/RPC/参数错误 | 透传（不展开），由本层包装 |
| **本层** | `BusinessError` / `RetryableError` / `FatalError` / `InternalError` | 业务校验/上链失败/状态机错误 | 按 4 类分别处理 |
| **业务上层** | 上层定义 | — | — |

**4 大本层错误类别（朴素命名）**：

```go
package coretypes // 与现有 coretypes 同包

// BusinessError —— 用户输入/状态/权限问题；不可重试（除非用户修正）
type BusinessError struct { Code string; Op string; Err error }

// RetryableError —— 临时性基础设施错误；可重试（RPC 超时、网络抖动、receipt 等待超时）
type RetryableError struct { Code string; Op string; Err error }

// FatalError —— 永久性基础设施错误；不可重试（合约暂停、配置错、未知 revert）
type FatalError struct { Code string; Op string; Err error }

// InternalError —— 本层 bug；需要修代码（不变式被打破，永远不该发生但发生了）
type InternalError struct { Code string; Op string; Err error }
```

每个错误都有 `Unwrap()` 方法，支持 `errors.Is` / `errors.As` 透传 SDK 原始错误。

#### 4.3.2 Sentinel 错误码总表（E2 带业务能力域前缀，已重命名）

> 命名约定：`Err<能力域><Cause>` —— 能力域 ∈ {`Bet`, `Market`, `Position`, `Stake`, `Pool`, `Token`, `Admin`, `Plan`, `Param`, `Infra`, `Chain`, `Config`, `Multisig`, `Internal`, `Idempotency`}。可重试性写在表里。

**A. BusinessError（不可重试）**

| Code | 触发场景 | 来自接口 |
|---|---|---|
| `ErrIdempotencyConflict` | `IdempotencyKey` 已存在 | 所有写 |
| `ErrUserInsufficientBalance` | 用户 ODD 余额不足 | relay.* / PlaceBet / Transfer / Deposit* / Stake |
| `ErrAdminInsufficientBalance` | admin ODD 余额不足 | admin.AddPlatformReserve |
| `ErrAdminAllowanceInsufficient` | admin 未对 BettingPool approve 或额度不足 | admin.AddPlatformReserve |
| `ErrMarketNotOpen` | 市场非 Open | PlaceBet |
| `ErrMarketNotLocked` | 市场非 Locked | SettleMarket |
| `ErrMarketAlreadyOpen` | 同 (matchID, marketType, line) 已开 | OpenMarket |
| `ErrMarketAlreadySettled` | 已 settle | SettleMarket |
| `ErrMarketMaxPerMatch` | 超过单场最大盘口数 | OpenMarket |
| `ErrBetQuoteExpired` | `Deadline` 已过 | PlaceBet |
| `ErrBetNotOwned` | bet 不属于用户 | ClaimPayout |
| `ErrBetNotWon` | bet 非 WonUnclaimed | ClaimPayout |
| `ErrBetPayoutZero` | `ClaimablePayout == 0` | ClaimPayout |
| `ErrPoolBelowMinDeposit` | < `MinDeposit` | DepositGlobal |
| `ErrStakeBelowMin` | < `MinStakeAmount` | Stake |
| `ErrPlanInvalid` | planID 不存在 | DepositGlobal / Stake |
| `ErrPoolPayoutWindowClosed` | matchID 的 window 已关 | DepositMatch |
| `ErrPositionWrongState` | 仓位状态错 | RequestUnbond |
| `ErrPositionNotUnbonded` | 仓位未 unbond | Withdraw |
| `ErrPositionNotMatured` | 解锁纪元未到 | Withdraw |
| `ErrPositionNotOwned` | positionID 不属于用户 | RequestUnbond / Unstake |
| `ErrStakeNotMatured` | 锁定期未到 | Unstake |
| `ErrParamInvalid` | 通用入参错（地址零、金额负等） | 所有 |

**B. RetryableError（可重试）**

| Code | 触发场景 |
|---|---|
| `ErrInfraRPC` | RPC 调用失败（超时/网络） |
| `ErrInfraReceiptTimeout` | B 形态等回执超过 `RPCTimeout` |
| `ErrInfraMulticall` | multicall3 调用失败 |
| `ErrInfraCache` | Redis 调用失败（**通常静默降级到直读链**；仅在 Redis 必需场景报错） |

**C. FatalError（不可重试）**

| Code | 触发场景 |
|---|---|
| `ErrAdminRoleMissing` | admin 私钥地址非 DEFAULT_ADMIN_ROLE | admin.GrantRole / admin.OpenMarket |
| `ErrMultisigRoleRequired` | settle 调用方非 multisig 成员 | admin.SettleMarket |
| `ErrPoolUndercapitalized` | `AccountedBalance` 不足以支付潜在赔付 | PlaceBet |
| `ErrTokenPaused` | ODDToken 暂停 | Transfer / Approve / 所有 ODD 转账 |
| `ErrContractPaused` | BettingPool / LiquidityPool / StakingPool 暂停 | 对应合约的所有写 |
| `ErrConfigChainInvalid` | 合约地址/链 ID 配置错 | 启动期 |
| `ErrChainTxReverted` | 上链 revert 但 reason 无法解析归类（兜底） | 所有写 |

**D. InternalError（本层 bug）**

| Code | 触发场景 |
|---|---|
| `ErrInternalInvariant` | 不变式被打破（如 `chain_actions` 行幂等键重复但 Status=Confirmed） |
| `ErrInternalUnknownRevert` | revert 4-byte selector 不在 MVP 映射表内（不能识别合约抛的错） |

**总计 33 个 sentinel 错误码**（A 类 23 / B 类 4 / C 类 7 / D 类 2）—— 比 §4.3.2 重命名前少了几个合并（如 `ErrInsufficientBalance` 拆为 user/admin 两个）。

#### 4.3.3 错误透传规则

- **SDK 错误**：本层包装为对应类别（`oddfi.UserError` → `BusinessError`，`oddfi.InfraError` → `RetryableError` 或 `FatalError`），保留 `Unwrap()` 链
- **合约 revert**：用 4-byte selector 反查映射表 → 翻译为本层 sentinel；未知 selector → `ErrInternalUnknownRevert`（InternalError，触发告警）
- **`errors.Is(err, ErrXxx)`** 必须能命中（业务上层用此判类）

#### 4.3.4 E3 — MVP revert selector 映射表（手写 10 条）

> Phase 5 落地时 grep SDK 的 `contracts/abi/*.json` 中的 `errors` 字段拿到准确 4-byte selector。本节列**语义清单**，selector 待补。

| # | 合约错误来源 | 触发条件 | 映射到本层 |
|---|---|---|---|
| 1 | ERC20 `InsufficientBalance` | 用户余额不足 | `ErrUserInsufficientBalance` |
| 2 | ERC20 `InsufficientAllowance` | admin allowance 不足 | `ErrAdminAllowanceInsufficient` |
| 3 | Pausable `EnforcedPause` | 合约暂停 | `ErrTokenPaused` 或 `ErrContractPaused`（按合约） |
| 4 | AccessControl `AccessControlUnauthorizedAccount` | 角色缺失 | `ErrAdminRoleMissing` / `ErrMultisigRoleRequired`（按合约/方法） |
| 5 | BettingPool `MarketNotOpen` | 市场状态非 Open | `ErrMarketNotOpen` |
| 6 | BettingPool `MarketNotLocked` | 市场状态非 Locked | `ErrMarketNotLocked` |
| 7 | BettingPool `MarketAlreadySettled` | 已 settle | `ErrMarketAlreadySettled` |
| 8 | BettingPool `BetNotOwned` 或类似 | bet 不属于 owner | `ErrBetNotOwned` |
| 9 | LiquidityPool `PositionNotMatured` 或类似 | 解锁纪元未到 | `ErrPositionNotMatured` |
| 10 | StakingPool `StakeNotMatured` 或类似 | 锁定期未到 | `ErrStakeNotMatured` |

**兜底**：上述 10 条之外的所有 revert → `ErrChainTxReverted`（FatalError）

**未知 selector**（甚至无 selector 的 revert）→ `ErrInternalUnknownRevert`（InternalError，告警）

---

### 4.4 Phase 4 收口

✅ §4.1 命名规范（M2 + 28 函数命名表）
✅ §4.2 A 形态 ActionStatus 查询接口
✅ §4.3 错误模型（4 大朴素类 + 33 个能力域前缀 sentinel + MVP 10 条 revert 映射）

**Phase 4 完成**。下一步 Phase 5：把 §1 ~ §6 所有决策 → 一份可执行的 `docs/superpowers/plans/<date>-refactor.md`，按文件粒度拆 task，每个 task 列要改/新增的具体文件 + 行为变化。

---

## §5 Phase 5 完成：plan 文件 `docs/2026-05-14-refactor-plan.md`

详见该文件。本节仅留 Phase 6 执行期的运行时笔记。

### 5.1 Task 0 范围确认结果（2026-05-14）

**有老 SDK import 的 16 个文件**：
- `writes/*.go`（6 个）→ **全删**（替换为 admin/+relay/）
- `sponsored/transfer.go` / `withdraw.go` → **全删**（替换为 relay/transfer.go + withdraw.go）
- `multisig/*.go`（3 个）→ **保留，改 import + 调用点迁移**（C4 已授权）
- `internal/signerload/load.go` → 看下，保留改 import
- `client/connection.go`（60 行，RPC 拨号）→ **保留改 import**
- `service_wire_full.go` → **全删**（service 装配重写）
- `e2e_helpers_test.go` → **重写**
- `doc.go` → 改

**搬迁路径**：
- `internal/eip7702/` (auth/encoding/nonce/signer + erc20/，共 ~300 行) → `relay/internal/sponsored/`
  - 包名 `eip7702` → `sponsored`
  - 类型 `SignExecuteInput` 等保留（内部不暴露，名字不必改）
  - 注释里"EIP-7702"技术语保留（用户允许内部用，公开 API 名字不含即可）

**保留模块的去留**：
- `client/connection.go` → 保留（RPC 拨号是基础设施）
- `multisig/` / `multisigpoll/` / `proposal/` / `resolver/` → 保留
- `internal/money/` / `nonce/` / `signerload/` / `testdb/` / `zapslog/` → 保留
- `markets.go` / `tokens.go` / `types.go` / `errors.go` / `config.go` / `doc.go` → 保留（顶层包入口）但要调整内容

### 5.2 Phase 6 执行实况记录

> 按 plan Task 顺序逐步推进；遇到偏离时记在这里。

### 5.0 Plan 文件应包含的章节预演

1. **目标 / 范围 / 非范围** —— 来自 `task_plan.md §目标`
2. **架构概览** —— 三库分层 `admin` / `relay` / `read` + 缓存层 + 失效器
3. **依赖切换清单** —— `oddfi-contracts-sdk` → `oddfi-ODD-SDK`，go.mod / 所有 import 替换点
4. **新增文件结构**：
   - `admin/` 包 4 接口 × 2 形态
   - `relay/` 包 10 接口 × 2 形态
   - `read/` 包 42 接口 + DTO + 枚举常量
   - `multicall/` 包（multicall3 binding 适配）
   - `cache/` 包（Redis 客户端、TTL 策略、失效器）
   - `coretypes/` 扩展（4 大错误类、33 个 sentinel、新增 ID 别名）
5. **要删除的旧文件** —— `writes/` 整个目录、`sponsored/`（替换为 relay）、`internal/eip7702/`（替换为 relay 内部）、`methods.go`（替换为三库各自门面）
6. **要修改的文件** —— `config.go`、`service*.go`、`watcher/`（扩展为通用 cache invalidator）
7. **任务粒度拆分** —— 按 §3 卡片顺序，每个接口一个 task；admin 4 + relay 10 + read 5 批（每批 ~8 个） + 缓存层 1 + 失效器 1 + 测试 e2e 重写 1
8. **测试策略** —— e2e 沿用 flow1/flow2 思路重写；单元测试覆盖：multicall 解码、revert 翻译、缓存失效路径
9. **回滚预案** —— 在 git 分支上做；保留老 `methods.go` 作 deprecated alias 一个版本（可选）
10. **风险清单** —— SDK API 变化、multicall3 在 BSC 部署确认、Redis 失效器测试覆盖
