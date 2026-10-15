# contracts-business-layer

Go 业务层，封装 `oddfi-ODD-SDK` 的合约写入，按**最小权限**原则把对外能力切成三个独立 Go 包，每个写方法都有 **A 形态（默认，提交即返回 hash）** 和 **B 形态（`WithReceipt` 后缀，等回执）** 两种入口。

```
                          ┌──────────────────────────┐
                          │     外部业务（调用方）     │
                          └──┬────────┬──────────┬───┘
                             ▼        ▼          ▼
                       ┌────────┐ ┌────────┐ ┌────────┐
                       │ admin/ │ │ relay/ │ │ read/  │
                       │  4 写  │ │ 10 写  │ │ 42 读  │
                       │ ×2 形态│ │ ×2 形态│ │        │
                       └────────┘ └────────┘ └────────┘
                       admin 私钥  sponsor 私钥   无私钥
                          + DB        + DB        + 缓存
```

## 1. 三库职责

| 包 | 用途 | 调用者持有 |
|---|---|---|
| `admin/` | 平台运营写：开盘 / 结算 / 角色管理 / 平台注资 | **admin 私钥** + DB |
| `relay/` | 用户代付写：用户出私钥 + 平台付 gas（EIP-7702 sponsored） | **sponsor 私钥** + DB |
| `read/` | 链上读：合约状态、赔率、用户余额、市场态、bet 态 | **无私钥**，**无 DB** |

> **关键安全特性**：`read` 服务**完全无私钥、无 DB**。read-svc 即使全量泄漏也不能动用户/平台一分钱。

## 2. 部署形态（生产推荐）

```
admin-svc        →  business.NewAdminClients(AdminConfig{AdminPrivateKey, DB, ...})
                    持有: admin 私钥 + chain_actions DB

user-api-svc     →  business.NewRelayClients(RelayConfig{SponsorPrivateKey, SponsorImpl, DB, ...})
                    持有: sponsor 私钥 + chain_actions DB（注意:无 admin 私钥）

read-svc / web   →  business.NewReadClients(ReadConfig{无任何私钥, 无 DB})
                    持有: 仅 RPC + 缓存
```

任何一个服务被攻破，**只能动它持有的能力范围**。

> dev / 一体化部署：`business.NewClients(Config{...})` 一次性构造所有三个 client。

## 3. 命名约定

- 每个写方法都有两个变体（M2 规则，2026-05-14 锁定）：

```go
result, err := relayCli.PlaceBet(ctx, req)              // A 形态: 提交立即返回 tx hash
result, err := relayCli.PlaceBetWithReceipt(ctx, req)   // B 形态: 等 2 块确认 + 解析 event
```

- `read.Client` 扁平命名：`BettingPoolPaused()` / `LiquidityPoolPaused()` / `StakingPoolPaused()`
- **`MarketKey`** 而不是 32 字节 MarketID：业务方只传 `(MatchID, MarketType, Line)` 三元组，本层 hash

## 4. 错误模型（4 大类）

```go
*coretypes.BusinessError   // 用户输入/状态/权限错（不可重试）
*coretypes.RetryableError  // RPC 抖动 / Redis 故障（可重试）
*coretypes.FatalError      // 合约暂停 / 配置错（不可重试，运维介入）
*coretypes.InternalError   // 本层 bug（告警）
```

完整 33 个 sentinel 错误码：`coretypes/errors_v2.go`。

## 5. 一句话快速接入

```go
import "github.com/Crypto-Barrett/contracts-business-layer"

// 给用户做代付下注 (核心用户故事):
res, err := relayCli.PlaceBetWithReceipt(ctx, relay.PlaceBetRequest{
    PrivateKey: userKey,                                 // A 的私钥
    Market:     coretypes.MarketKey{MatchID: ..., MarketType: 0, Line: 0},
    Outcome:    0,
    Amount:     big.NewInt(100_000_000_000_000_000_00),  // 100 ODD (wei)
    MinOdds:    big.NewInt(10100),                       // 1.01 (1e4 精度)
    Deadline:   uint64(time.Now().Add(15*time.Minute).Unix()),
    IdempotencyKey: "bet-user-A-2026-05-15-001",
})
fmt.Println(res.BetID, res.TxHash, res.AcceptedAmount)
```

→ 完整调用示例见 **[docs/usage-examples.md](docs/usage-examples.md)**

## 6. 项目结构

```
contracts-business-layer/
├── clients.go              ← business.NewClients / NewAdminClients / NewRelayClients / NewReadClients
├── doc.go                  ← package doc
├── admin/                  ← admin-svc 用
├── relay/                  ← user-api-svc 用 (含 internal/eip7702 sponsored 签名层)
├── read/                   ← read-svc 用 (零 DB, 零私钥)
├── action/                 ← chain_actions repo + 状态查询 helper
├── coretypes/              ← 共享类型 + 4 大错误 + 33 sentinel + MarketKey/MatchID/BetID
├── multicall/              ← multicall3 最小 wrapper (1 次 RPC 拉多个读)
├── cache/                  ← Read cache (InProcess) + TODO Redis impl
├── watcher/                ← chain_actions HTTP poll 回执跟踪器（可选）
├── migrations/             ← chain_actions 表 DB schema
└── docs/
    ├── usage-examples.md   ← 完整调用指南
    └── 2026-05-14-refactor-plan.md
```

## 7. 工程约束

- **Go 版本**: 1.25.0+ 推荐；1.24 也行（SDK go.mod 要相应改）
- **RPC**: BSC mainnet / testnet（type-0x04 SetCodeTx 支持）
- **multicall3**: 在 `0xcA11bde05977b3631167028862bE2a173976CA11`（BSC 主网/测试网都有）
- **没有 WebSocket 依赖**：所有 watcher 用 HTTP poll
- **私钥不落盘**：本层不存储、不日志化任何私钥

### 7.1 私有 SDK 拉取

`oddfi-ODD-SDK` 是私有 Go 模块，开发机/CI 需要配置访问凭证：

```bash
# 1. 把这个 module path 标记为 private (不走 sum DB / proxy)
go env -w GOPRIVATE=github.com/Crypto-Barrett/*

# 2. (可选) 同时禁用 module proxy 防止泄漏私有 path
go env -w GONOSUMCHECK=github.com/Crypto-Barrett/*

# 3. 配置 git 走 SSH (或用 PAT)
# SSH 方式:
git config --global url."git@github.com:".insteadOf "https://github.com/"

# 或 HTTPS + Personal Access Token:
git config --global url."https://${GITHUB_TOKEN}@github.com/".insteadOf "https://github.com/"
```

然后拉指定版本：

```bash
# 拉最新 main
go get github.com/Crypto-Barrett/oddfi-ODD-SDK@main

# 或 pin 到具体 tag/commit (推荐生产用)
go get github.com/Crypto-Barrett/oddfi-ODD-SDK@v0.1.0
go get github.com/Crypto-Barrett/oddfi-ODD-SDK@<commit-sha>

go mod tidy
```

> 当前 `go.mod` 里的 require 行是 placeholder pseudo-version；执行上面任一 `go get` 后会被替换成真实 git 元数据。

## 8. 测试

完整端到端场景测试在 `scenario_e2e_test.go`，演示**分服务部署 + 7 步业务流**：

```bash
# 顶部填好 RPC / 私钥 / 合约地址后:
go test -tags e2e -run TestScenarioFullMatch -v -timeout 25m -count=1 ./...
```

诊断工具 `placebet_simulate_test.go`：直接 `eth_call` 模拟 placeBet（不走 sponsored 包装），定位合约层 vs 包装层问题。

## 9. 设计文档索引

| 文档 | 内容 |
|---|---|
| **`docs/usage-examples.md`** | 各种部署模式 + 完整调用示例（必读）|
| `docs/2026-05-14-refactor-plan.md` | 重构 plan（13 个 Task） |
| `findings.md` | 重构设计依据 |
| `task_plan.md` | 决策时间线 |
| `progress.md` | 执行进度 |
