# B0 · 基础设施（Migration + Model + Repository + Worker 骨架）

> 本文档对应 V3 架构（Deposit-first 事件驱动），是所有后续 batch 的依赖底座。
> 数据模型源真值：[01-data-model.md](../01-data-model.md)；架构决策：[00-architecture.md](../00-architecture.md)。
> 单 agent 执行，不并行（后续 batch 依赖本 batch 建表 + 接口稳定）。

---

## 1 背景

V3 把 V2 的"订单驱动"彻底换成"事件驱动（Deposit-first 模型 B）"：
- 无 `presale_order` 表（砍），改为 `presale_deposit`（链上事件落库）
- 无 `presale_claim` / `presale_claim_tx` 表（vesting/claim 整段砍，schema 字段保留）
- 邀请表改名并站点级化：`user_referral_code` / `user_referral_bind`（去 `presale_` 前缀）
- 新增 `presale_event_cursor`（监听器游标，每金库地址一行）
- 新增 `presale_ops_event`（异常事件待处理）

B0 需做的事：建 9 张表的 migration + GORM model + repository 接口 + presale-worker 空进程骨架 + seed 数据。

---

## 2 文件边界

B0 单 agent 独占以下路径，后续 batch **不修改**这些文件（只调用其接口）：

| 路径 | 动作 | 说明 |
|---|---|---|
| `migrations/00xx_create_presale_round.sql` | 新建 | 含 6 行 seed |
| `migrations/00xx_create_presale_deposit.sql` | 新建 | 替代已砍的 presale_order |
| `migrations/00xx_create_presale_config.sql` | 新建 | 含 1 行初始值 |
| `migrations/00xx_create_presale_holding.sql` | 新建 | |
| `migrations/00xx_create_presale_event_cursor.sql` | 新建 | 含初始游标行占位（`last_block_number=0`）|
| `migrations/00xx_create_presale_ops_event.sql` | 新建 | |
| `migrations/00xx_create_user_referral_code.sql` | 新建 | 站点级，无业务前缀 |
| `migrations/00xx_create_user_referral_bind.sql` | 新建 | 站点级，无业务前缀 |
| `internal/model/presale_round.go` | 新建 | 状态常量 + GORM struct |
| `internal/model/presale_deposit.go` | 新建 | 状态常量 + anomaly_reason 常量 |
| `internal/model/presale_config.go` | 新建 | 单行表 model |
| `internal/model/presale_holding.go` | 新建 | source 枚举 |
| `internal/model/presale_event_cursor.go` | 新建 | |
| `internal/model/presale_ops_event.go` | 新建 | ops_event 状态常量 |
| `internal/model/user_referral_code.go` | 新建 | |
| `internal/model/user_referral_bind.go` | 新建 | |
| `internal/repository/presale_round.go` | 新建 | 接口 + 实现 |
| `internal/repository/presale_deposit.go` | 新建 | 接口 + 实现 |
| `internal/repository/presale_config.go` | 新建 | 接口 + 实现 |
| `internal/repository/presale_holding.go` | 新建 | 接口 + 实现 |
| `internal/repository/presale_event_cursor.go` | 新建 | 接口 + 实现 |
| `internal/repository/presale_ops_event.go` | 新建 | 接口 + 实现 |
| `internal/repository/user_referral_code.go` | 新建 | 接口 + 实现 |
| `internal/repository/user_referral_bind.go` | 新建 | 接口 + 实现 |
| `internal/config/presale.go` | 新建 | `PresaleConfig` struct + env 读取 |
| `cmd/presale-worker/main.go` | 新建 | 独立 binary 骨架 |
| `seed/presale_rounds.sql` | 新建 | 6 轮初始数据 |

**B0 不触碰**：`internal/handler/`、`internal/service/`、`internal/chain/`、`internal/router/`（由 B1/B2 负责）。

---

## 3 Migration（按此顺序执行）

引用 [01-data-model.md §3.1～§3.9](../01-data-model.md) 精确 SQL，**不改字段名 / 类型 / 索引**。

### 3.1 执行顺序

```
migrations/0001_create_presale_round.sql          -- §3.1
migrations/0002_create_presale_deposit.sql         -- §3.2，依赖 presale_round(id)
migrations/0003_create_presale_config.sql          -- §3.3
migrations/0004_create_presale_holding.sql         -- §3.4，依赖 presale_round(id)
migrations/0005_create_presale_event_cursor.sql    -- §3.7
migrations/0006_create_presale_ops_event.sql       -- §3.8，依赖 presale_deposit(id)
migrations/0007_create_user_referral_code.sql      -- §3.5
migrations/0008_create_user_referral_bind.sql      -- §3.6，依赖 user_referral_code(code)
```

> 若项目已有 migration 序号，接续现有最大序号。命名风格参考已有 `migrations/` 目录。
> admin-backend 的 `presale_admin_audit` 表（[§3.9](../01-data-model.md)）放 admin-backend 仓库，B0 不涉及。

### 3.2 关键约束确认

- 所有表 `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
- 金额字段一律 `DECIMAL(38,18)`，时间字段一律 `BIGINT`（毫秒）
- `presale_deposit` 的 `UNIQUE KEY uk_tx_log (tx_hash, log_index)` 是幂等锁核心，**不能漏**
- `presale_holding` 的 `UNIQUE KEY uk_user_round_source (user_id, round_id, source)` 保证 upsert 正确性
- `presale_config` 的 `CHECK (id = 1)` 保证单行约束（MySQL 8.0+）

---

## 4 Model 层

### 4.1 设计原则

- 时间字段统一 `int64`（毫秒），不用 `time.Time`（与现有 `asset_ledger` 风格保持一致）
- `decimal.Decimal` 字段 GORM tag 加 `type:decimal(38,18)`
- 状态枚举 / anomaly reason 在 model 文件顶部用 `const` 集中定义，**不散落在 service 层**
- 不实现 soft delete（状态机管状态，不删行，见 [01-data-model.md §1](../01-data-model.md)）
- 实现 `BeforeCreate` hook 统一填 `CreatedAt / UpdatedAt`（用 `time.Now().UnixMilli()`）

### 4.2 关键 model 骨架

```go
// internal/model/presale_round.go

// RoundStatus 和 ManualOverride 分离定义：
// cron 只看 manual_override=0 的行，运营 pause/resume/reopen/close 都会设 manual_override=1
// 这样设计避免 cron 把运营干预后的轮次状态自动回退
const (
    RoundStatusUpcoming = "upcoming"
    RoundStatusActive   = "active"
    RoundStatusPaused   = "paused"
    RoundStatusEnded    = "ended"
)

type PresaleRound struct {
    ID                 string          `gorm:"primaryKey;type:varchar(32)"`
    Name               string          `gorm:"not null;type:varchar(64)"`
    RoundType          string          `gorm:"not null;default:public;type:varchar(16)"`
    PriceUsd           decimal.Decimal `gorm:"not null;type:decimal(38,18)"`
    SupplyOdd          decimal.Decimal `gorm:"not null;type:decimal(38,18)"`
    SoldOdd            decimal.Decimal `gorm:"not null;default:0;type:decimal(38,18)"`
    RaisedUsd          decimal.Decimal `gorm:"not null;default:0;type:decimal(38,18)"`
    TargetRaiseUsd     decimal.Decimal `gorm:"not null;type:decimal(38,18)"`
    MinPerOrderUsd     *decimal.Decimal `gorm:"type:decimal(20,6)"`
    MaxPerWalletUsd    *decimal.Decimal `gorm:"type:decimal(20,6)"`
    TgeReleasePct      decimal.Decimal `gorm:"not null;type:decimal(5,2)"`
    LinearReleaseDays  int             `gorm:"not null"`
    ReferralRewardPct  decimal.Decimal `gorm:"not null;default:10.0000;type:decimal(10,4)"`
    ReferralReleasePct decimal.Decimal `gorm:"not null;default:100.00;type:decimal(5,2)"`
    ReferralLinearDays int             `gorm:"not null;default:0"`
    StartTs            int64           `gorm:"not null"`
    EndTs              int64           `gorm:"not null"`
    Status             string          `gorm:"not null;default:upcoming;type:varchar(16)"`
    ManualOverride     bool            `gorm:"not null;default:0"`
    Badge              *string         `gorm:"type:varchar(16)"`
    SortOrder          int             `gorm:"not null;default:0"`
    CreatedAt          int64           `gorm:"not null;autoCreateTime:milli"`
    UpdatedAt          int64           `gorm:"not null;autoUpdateTime:milli"`
}

func (PresaleRound) TableName() string { return "presale_round" }
```

```go
// internal/model/presale_deposit.go

// DepositStatus 三态设计（V3 Deposit-first）：
// pending   = 区块确认数 < confirmBlocks，链上事件已落库但尚未达到安全确认数
// confirmed = 达到 confirmBlocks + 校验通过 + holding 已 upsert，这是业务真相
// anomaly   = 链上 receipt 存在但业务校验失败，进 presale_ops_event 待人工处理
// 注意：无 expired / mismatch 中间态（V2 订单模型已废弃）
const (
    DepositStatusPending   = "pending"
    DepositStatusConfirmed = "confirmed"
    DepositStatusAnomaly   = "anomaly"
)

// AnomalyReason 枚举，deposit 落 anomaly 时必须填写原因，供运营快速分流
const (
    AnomalyOverflow      = "overflow"       // 到账超轮次剩余容量
    AnomalyFromMismatch  = "from_mismatch"  // tx.from 不是登录态 EOA（禁止合约钱包代付）
    AnomalyNonUsdt       = "non_usdt"       // log.address 不是 USDT 合约
    AnomalyBelowMin      = "below_min"      // 低于全局 minSubscribeUsd
    AnomalyRoundMismatch = "round_mismatch" // 前端期望轮次 ≠ 实际所属轮次（边界信号）
    AnomalyLateArrival   = "late_arrival"   // block_timestamp 超出所有轮次容差范围
    AnomalyPausedArrival = "paused_arrival" // 到账时轮次处于 paused（信息流，仍入账）
    AnomalyUnclaimed     = "unclaimed"      // tx.from EOA 无对应 user 记录（绕前端直转）
    AnomalyFakeReferrer  = "fake_referrer"  // 携带的 referrerCode 不存在
)

// DepositSource 标记双轨上报来源，用于排查"一路扫到另一路没扫到"的问题
const (
    DepositSourceFrontend = "frontend"
    DepositSourceWorker   = "worker"
)

type PresaleDeposit struct {
    ID                 uint64          `gorm:"primaryKey;autoIncrement"`
    TxHash             string          `gorm:"not null;uniqueIndex:uk_tx_log;type:varchar(66)"`
    LogIndex           uint            `gorm:"not null;uniqueIndex:uk_tx_log"`
    BlockNumber        uint64          `gorm:"not null"`
    BlockTimestamp     int64           `gorm:"not null"`
    UserID             uint64          `gorm:"not null;index:idx_user_block"`
    EoaAddress         string          `gorm:"not null;index:idx_eoa_block;type:varchar(42)"`
    VaultAddress       string          `gorm:"not null;type:varchar(42)"`
    RoundID            string          `gorm:"not null;index:idx_round_status;type:varchar(32)"`
    AmountUsdt         decimal.Decimal `gorm:"not null;type:decimal(38,18)"`
    PriceUsd           decimal.Decimal `gorm:"not null;type:decimal(38,18)"`
    SharesOdd          decimal.Decimal `gorm:"not null;type:decimal(38,18)"`
    ReferrerUserID     *uint64         `gorm:"index"`
    ReferrerEoa        *string         `gorm:"type:varchar(42)"`
    ReferralRewardPct  *decimal.Decimal `gorm:"type:decimal(10,4)"`
    ReferralRewardOdd  decimal.Decimal  `gorm:"not null;default:0;type:decimal(38,18)"`
    Status             string          `gorm:"not null;default:pending;index:idx_round_status;type:varchar(16)"`
    AnomalyReason      *string         `gorm:"type:varchar(64)"`
    ConfirmedAt        *int64
    ExpectedRoundID    *string         `gorm:"type:varchar(32)"`
    ExpectedAmount     *decimal.Decimal `gorm:"type:decimal(38,18)"`
    Source             string          `gorm:"not null;default:frontend;type:varchar(16)"`
    CreatedAt          int64           `gorm:"not null;autoCreateTime:milli"`
    UpdatedAt          int64           `gorm:"not null;autoUpdateTime:milli"`
}

func (PresaleDeposit) TableName() string { return "presale_deposit" }
```

```go
// internal/model/presale_holding.go

// HoldingSource 区分持仓来源：认购投入 vs 邀请奖励
// referral 行的 invested_usd / locked_price_avg 恒为 0（奖励是凭空发的，无成本价语义）
const (
    HoldingSourceInvest   = 1
    HoldingSourceReferral = 2
)
```

### 4.3 scan/value 接口

`decimal.Decimal` 字段 GORM 已内置 Scanner/Valuer，无需额外实现。
`*decimal.Decimal`（nullable 字段）需确认 GORM 版本支持，若不支持改用 `sql.NullString` + 转换层。

---

## 5 Repository 层

### 5.1 接口先于实现

每个 repository 文件先声明 interface，再用 `struct + *gorm.DB` 实现，便于 B2/B1 service 层 mock 测试：

```go
// internal/repository/presale_deposit.go

type PresaleDepositRepository interface {
    // CreateOrGet 幂等写入：uk_(tx_hash, log_index) 冲突时返回已有记录
    // 这是双轨会师的核心：前端 report-tx 和 Worker 扫块都调此方法，只有第一个调用方落库
    CreateOrGet(ctx context.Context, tx *gorm.DB, deposit *model.PresaleDeposit) (*model.PresaleDeposit, bool, error)

    // GetByTxHash 前端轮询用，按 tx_hash 查单笔（同一 tx 可能有多个 log，取第一个匹配用户 EOA 的）
    GetByTxHash(ctx context.Context, txHash string, userID uint64) (*model.PresaleDeposit, error)

    // ListByUser 用户历史入账，支持 status 筛选
    ListByUser(ctx context.Context, userID uint64, status string, page, size int) ([]*model.PresaleDeposit, int64, error)

    // ConfirmDeposit 在事务内将 pending → confirmed，同一事务中调用 UpsertHolding
    // 设计为接收外部事务，让调用方（confirm-tx service）统一管理事务边界
    ConfirmDeposit(ctx context.Context, tx *gorm.DB, depositID uint64, confirmedAt int64) error

    // MarkAnomaly 将 deposit 置为 anomaly 并写 anomaly_reason
    MarkAnomaly(ctx context.Context, tx *gorm.DB, depositID uint64, reason string) error

    // ListPendingByBlockThreshold 供 Worker 扫已达到确认块数的 pending 订单推进状态
    ListPendingByBlockThreshold(ctx context.Context, safeBlockNumber uint64) ([]*model.PresaleDeposit, error)
}
```

```go
// internal/repository/presale_round.go

type PresaleRoundRepository interface {
    // GetByID 取轮次配置，给 confirm-tx service 快照价格用
    GetByID(ctx context.Context, id string) (*model.PresaleRound, error)

    // List 返所有轮次（含 ended），给 config 接口用
    List(ctx context.Context) ([]*model.PresaleRound, error)

    // ListActive 只返 status ∈ {active, paused}，供 Worker 确认入账时找归属轮次
    ListActive(ctx context.Context) ([]*model.PresaleRound, error)

    // ListAutoAdvanceable cron 用：status=upcoming 且 now≥start_ts，或 status=active 且 now≥end_ts，
    // 且 manual_override=0（运营干预过的不自动推进）
    ListAutoAdvanceable(ctx context.Context, nowMs int64) ([]*model.PresaleRound, error)

    // AdvanceStatus cron 原子更新状态（带 manual_override=0 条件，防止覆盖运营操作）
    AdvanceStatus(ctx context.Context, id, fromStatus, toStatus string) error

    // IncrSoldAndRaised deposit 落 confirmed 时原子累加 sold_odd + raised_usd
    // 用乐观条件 sold_odd + delta ≤ supply_odd 保证不超额，返回 ErrCapacityExceeded 时调用方走 overflow anomaly
    IncrSoldAndRaised(ctx context.Context, tx *gorm.DB, roundID string, deltaOdd, deltaUsd decimal.Decimal) error

    // TotalRaisedUsd 所有轮次 raised_usd 之和，给 config 接口的 totalRaisedUsd 字段用
    TotalRaisedUsd(ctx context.Context) (decimal.Decimal, error)
}
```

```go
// internal/repository/presale_holding.go

type PresaleHoldingRepository interface {
    // UpsertInvest 认购持仓 upsert（source=1），在事务内调用
    // 加权平均成本价公式：new_avg = (old_total×old_avg + delta×price) / (old_total + delta)
    // referral 行（source=2）通过 UpsertReferral 单独处理，不混用此方法
    UpsertInvest(ctx context.Context, tx *gorm.DB, userID uint64, roundID string, deltaOdd, deltaUsd, price decimal.Decimal) error

    // UpsertReferral 邀请奖励持仓 upsert（source=2），invested_usd / locked_price_avg 不动（恒为 0）
    UpsertReferral(ctx context.Context, tx *gorm.DB, referrerUserID uint64, roundID string, deltaOdd decimal.Decimal) error

    // ListByUser 聚合用户所有轮次持仓（position 接口用）
    ListByUser(ctx context.Context, userID uint64) ([]*model.PresaleHolding, error)
}
```

```go
// internal/repository/presale_event_cursor.go

type PresaleEventCursorRepository interface {
    // Load 取指定金库地址的游标，Worker 启动时调用
    Load(ctx context.Context, vaultAddress string) (*model.PresaleEventCursor, error)

    // Save 单事务提交游标 + deposit：确保游标和入账原子推进，避免漏块或重放
    // tx 参数是外部事务，cursor 和 deposit 在同一事务内 commit
    Save(ctx context.Context, tx *gorm.DB, vaultAddress string, blockNumber uint64, logIndex uint) error

    // EnsureAll 启动时为 env PRESALE_VAULT_POOL 里的每个地址 INSERT IGNORE 初始游标
    EnsureAll(ctx context.Context, vaultAddresses []string) error
}
```

### 5.2 关键 SQL

```go
// IncrSoldAndRaised —— 防超额的乐观更新
// rows_affected = 0 表示本次累加会超出 supply，调用方据此触发 overflow anomaly
const sqlIncrSold = `
UPDATE presale_round
   SET sold_odd   = sold_odd + ?,
       raised_usd = raised_usd + ?,
       updated_at = ?
 WHERE id = ?
   AND sold_odd + ? <= supply_odd
`

// UpsertInvest —— 加权平均成本价原子更新
// 用 MySQL ON DUPLICATE KEY UPDATE 在单语句内完成插入或追加，避免 SELECT-then-UPDATE 竞态
const sqlUpsertInvest = `
INSERT INTO presale_holding
    (user_id, round_id, source, total_odd, invested_usd, locked_price_avg, created_at, updated_at)
VALUES (?, ?, 1, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
    -- 加权平均：(old_total × old_avg + delta × price) / (old_total + delta)
    locked_price_avg = (total_odd * locked_price_avg + VALUES(total_odd) * VALUES(locked_price_avg))
                     / (total_odd + VALUES(total_odd)),
    total_odd        = total_odd + VALUES(total_odd),
    invested_usd     = invested_usd + VALUES(invested_usd),
    updated_at       = VALUES(updated_at)
`
```

---

## 6 Config（`internal/config/presale.go`）

```go
// PresaleConfig 集中管理所有预售相关运行时参数
// 设计为独立文件而非内嵌 AppConfig，便于 B2/presale-worker 单独读取而不污染主配置结构
type PresaleConfig struct {
    // VaultPool 金库地址池（数组），支持多地址监听（历史地址切换后仍需监听老地址）
    // env: PRESALE_VAULT_POOL = "0xABC...,0xDEF..."（逗号分隔）
    VaultPool []string `mapstructure:"vault_pool"`

    // UsdtAddress BSC 链上 USDT (BEP20) 合约地址
    // 固定值：0x55d398326f99059fF775485246999027B3197955（mainnet）
    UsdtAddress string `mapstructure:"usdt_address"`

    // BscRpcUrl 支持 Alchemy / QuickNode / 自建节点，推荐 HTTP（非 WebSocket）做 eth_getLogs 轮询
    BscRpcUrl string `mapstructure:"bsc_rpc_url"`

    // ConfirmBlocks 等待区块确认数（默认 3），防止链上重组（BSC 出块 ~3s，3块≈9s）
    ConfirmBlocks uint64 `mapstructure:"confirm_blocks"`

    // PollIntervalSec eth_getLogs 轮询间隔（默认 6s ≈ BSC 2 个出块）
    PollIntervalSec int `mapstructure:"poll_interval_sec"`

    // BoundaryToleranceMin 轮次边界容差分钟数（默认 5），与 presale_config 表同步
    BoundaryToleranceMin int `mapstructure:"boundary_tolerance_min"`

    // LarkWebhookUrl anomaly 告警推送地址，空字符串表示不推送
    LarkWebhookUrl string `mapstructure:"lark_webhook_url"`

    // RedisLeaderKey Worker leader 抢锁用的 Redis key，默认 "presale:worker:leader"
    RedisLeaderKey string `mapstructure:"redis_leader_key"`

    // RedisLeaderTTLSec leader 锁 TTL（默认 30s），Worker 每 ~10s 续约
    RedisLeaderTTLSec int `mapstructure:"redis_leader_ttl_sec"`
}
```

---

## 7 presale-worker 骨架（`cmd/presale-worker/main.go`）

```go
// cmd/presale-worker/main.go
//
// presale-worker 是独立 binary，与 web-api HTTP server 同机部署但进程分离。
// 本期骨架实现：
//   1. leader 抢锁（Redis SET NX EX）：防止多实例并发扫块导致重复入账
//   2. cron 占位：Round status cron（每 5min）+ 区块确认 cron（每 6s）
//   3. 空跑验证：连 DB + Redis + BSC RPC 后 log 心跳，不实际扫块（B2 填充）
//
// Worker 失去 leader 锁时静默退出当前 tick，下一轮重新竞争。
// 这样设计比"主备切换"更简单：无需主动通知，锁到期自然漂移。

func main() {
    // 1. 初始化：config + logger + DB + Redis + BSC client（占位）
    cfg := config.LoadPresaleConfig()
    log := zerolog.New(os.Stdout).With().Timestamp().Logger()

    db  := initDB(cfg)
    rdb := initRedis(cfg)

    // 2. leader 抢锁
    go runLeaderLoop(cfg, rdb, log, func() {
        // 3. cron：Round status 推进（每 5min）
        go runRoundStatusCron(cfg, db, log)

        // 4. cron：区块确认推进（每 6s，B2 实现监听器后填充）
        go runConfirmCron(cfg, db, log)

        // 5. cron：USDT Transfer 监听（B2 实现 presale_listener.go 后接入）
        // go chain.NewPresaleListener(cfg, db, log).Run(ctx)
    })

    // 6. 优雅退出
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit
    log.Info().Msg("presale-worker stopping")
}

// runLeaderLoop 每 RedisLeaderTTLSec/3 秒尝试抢锁或续约
// 只有 leader 才执行 workFn 里的 cron；非 leader 空转等待，随时准备接管
func runLeaderLoop(cfg *config.PresaleConfig, rdb *redis.Client, log zerolog.Logger, workFn func()) {
    ticker := time.NewTicker(time.Duration(cfg.RedisLeaderTTLSec/3) * time.Second)
    isLeader := false
    for range ticker.C {
        ok, _ := rdb.SetNX(context.Background(), cfg.RedisLeaderKey, "1",
            time.Duration(cfg.RedisLeaderTTLSec)*time.Second).Result()
        if ok && !isLeader {
            log.Info().Msg("acquired leader lock, starting crons")
            isLeader = true
            workFn() // 启动 cron goroutine（幂等，首次才启动）
        } else if !ok && isLeader {
            // 失去续约能力（Redis 不可达），记录但不 panic——等下一轮重试
            log.Warn().Msg("lost leader lock, crons will idle")
            isLeader = false
        }
    }
}
```

> B2 完成后，把 `internal/chain/presale_listener.go` 接入 `runLeaderLoop` 的 `workFn` 里的第 5 步。

---

## 8 Seed 数据

### 8.1 `seed/presale_rounds.sql`

6 轮数据与前端 `oddfi-frontend/app/[locale]/invest/config/stages.ts` 完全对齐：

```sql
-- seed/presale_rounds.sql
-- 轮次 ID / 价格 / 供给量对齐前端 stages.ts，时间戳为占位值（运营上线前更新）
-- TGE 默认 2026-06-10 00:00 UTC+8 = 1749571200000ms
INSERT INTO presale_round
    (id, name, round_type, price_usd, supply_odd, sold_odd, raised_usd,
     target_raise_usd, tge_release_pct, linear_release_days,
     referral_reward_pct, referral_release_pct, referral_linear_days,
     start_ts, end_ts, status, manual_override, sort_order, created_at, updated_at)
VALUES
    ('seed',       '种子轮',   'private', 0.030000000000000000, 10000000,  0, 0,  300000, 10, 90,  10.0000, 100.00, 0, 1747843200000, 1749571200000, 'upcoming', 0, 1, UNIX_TIMESTAMP(NOW())*1000, UNIX_TIMESTAMP(NOW())*1000),
    ('strategic',  '战略轮',   'private', 0.040000000000000000, 12500000,  0, 0,  500000, 10, 90,  10.0000, 100.00, 0, 1747843200000, 1749571200000, 'upcoming', 0, 2, UNIX_TIMESTAMP(NOW())*1000, UNIX_TIMESTAMP(NOW())*1000),
    ('ecosystem',  '生态轮',   'private', 0.050000000000000000, 15000000,  0, 0,  750000, 15, 60,  10.0000, 100.00, 0, 1747843200000, 1749571200000, 'upcoming', 0, 3, UNIX_TIMESTAMP(NOW())*1000, UNIX_TIMESTAMP(NOW())*1000),
    ('public_a',   '公募 A 轮', 'public',  0.060000000000000000, 20000000,  0, 0, 1200000, 20, 30,  10.0000, 100.00, 0, 1747843200000, 1749571200000, 'upcoming', 0, 4, UNIX_TIMESTAMP(NOW())*1000, UNIX_TIMESTAMP(NOW())*1000),
    ('public_b',   '公募 B 轮', 'public',  0.070000000000000000, 25000000,  0, 0, 1750000, 25, 30,  10.0000, 100.00, 0, 1747843200000, 1749571200000, 'upcoming', 0, 5, UNIX_TIMESTAMP(NOW())*1000, UNIX_TIMESTAMP(NOW())*1000),
    ('public_c',   '公募 C 轮', 'public',  0.080000000000000000, 30000000,  0, 0, 2400000, 30,  0,  10.0000, 100.00, 0, 1747843200000, 1749571200000, 'upcoming', 0, 6, UNIX_TIMESTAMP(NOW())*1000, UNIX_TIMESTAMP(NOW())*1000)
ON DUPLICATE KEY UPDATE id=id;  -- 幂等，重跑 seed 不报错
```

> 价格 / 供给 / 释放比例须在上线前与 PRD 最终版和前端 stages.ts 二次对齐。

### 8.2 `presale_config` 初始行

```sql
-- 嵌入 migration 0003 末尾
INSERT IGNORE INTO presale_config
    (id, tge_ts, tge_open_price_usd, vault_address,
     min_subscribe_usd, boundary_tolerance_min, total_target_usd,
     lark_webhook_url, updated_at)
VALUES
    (1,
     1749571200000,          -- TGE: 2026-06-10 00:00 UTC+8
     0.100000000000000000,   -- PRD 设定基准价，不依赖市价
     '0x0000000000000000000000000000000000000001', -- 上线前替换真实金库地址
     1000.000000,
     5,
     20000000.000000000000000000,
     '',                     -- Lark webhook 上线前配置
     UNIX_TIMESTAMP(NOW())*1000
    );
```

### 8.3 既有用户邀请码补齐脚本占位

```
scripts/presale-ops/backfill-referral-codes.go
```

部署 B1 后执行一次：扫 `user` 表，对没有 `user_referral_code` 记录的用户 `INSERT IGNORE` 生成邀请码（CSPRNG + 5 次重试逻辑与 B1 的 service 层共用）。脚本骨架在 B1 文档中定义，B0 仅占位文件路径。

---

## 9 DoD（Definition of Done）

B0 的 gate 通过后才能进 B1。

- [ ] 所有 8 个 migration SQL 在 dev 库顺序执行通过，`SHOW CREATE TABLE` 与 [01-data-model.md §3.x](../01-data-model.md) 字段 / 索引完全一致
- [ ] `go build ./...` 无报错（包含 `cmd/presale-worker`）
- [ ] `go vet ./...` 零告警
- [ ] `go test ./internal/repository/... -count=1` 全绿：
  - `PresaleDeposit`：CreateOrGet 幂等（相同 uk 第二次返回已有记录）
  - `PresaleRound`：IncrSoldAndRaised 超额时返回 ErrCapacityExceeded
  - `PresaleHolding`：UpsertInvest 加权平均成本价公式正确（至少 3 轮累加验证）
  - `PresaleEventCursor`：EnsureAll 幂等 + Load + Save 原子性
- [ ] `cmd/presale-worker` 空跑：连接 DB + Redis 后打印心跳日志，不 panic，`Ctrl-C` 优雅退出
- [ ] Seed SQL 在 dev 库执行后 `presale_round` 有 6 行，`presale_config` 有 1 行
- [ ] code-reviewer 审过，无 Critical / High 问题

---

## 10 风险点

| 风险 | 缓解 |
|---|---|
| 金额精度截断 | GORM tag `type:decimal(38,18)` 必须显式指定，不能依赖 GORM 自推断；单测断言到 18 位小数 |
| `presale_config` CHECK 约束 MySQL 5.7 不支持 | 若生产库为 5.7，去掉 `CHECK (id=1)`，改为 GORM model 层 `BeforeCreate` 硬编码 `id=1` |
| Worker 启动顺序 | `EnsureAll` 必须在 Worker 启动扫块前执行完毕，否则游标不存在会 panic；init 顺序在 main.go 显式保证 |
| seed 数据与 stages.ts 不同步 | 部署前交叉验证：6 轮 price / supply / sort_order 与前端文件一一比对，输出 diff |

---

## 11 Task Prompt for Executor Agent

```
任务：实现 oddfi-backend/web-api/docs/dd-invest/batches/B0-foundation.md 定义的 B0 batch（V3 版本）。

上下文文档（必须先读）：
- web-api/docs/dd-invest/01-data-model.md（9 张表 schema 源真值）
- web-api/docs/dd-invest/00-architecture.md（架构决策）
- web-api/docs/dd-invest/batches/B0-foundation.md（本文档，实施规范）

执行顺序：

1. 建 migration 文件
   - 在 migrations/ 目录按已有命名风格新建 8 个 SQL 文件（顺序见 §3.1）
   - SQL 精确照抄 01-data-model.md §3.1~§3.8 的 CREATE TABLE，不改字段名 / 类型
   - migration 0003 末尾嵌入 presale_config 初始行（§8.2）
   - 另建 seed/presale_rounds.sql（§8.1）

2. 建 model 文件（internal/model/presale_*.go + user_referral_*.go）
   - 8 个文件对应 8 张业务表（presale_admin_audit 在 admin-backend 仓库，不建）
   - 时间字段 int64，金额字段 decimal.Decimal + GORM tag type:decimal(38,18)
   - 状态常量 / anomaly_reason 常量在各自 model 文件顶部定义

3. 建 repository 文件（internal/repository/presale_*.go + user_referral_*.go）
   - 8 个文件，每个先声明 interface 再实现 struct
   - 关键 SQL 见 §5.2；IncrSoldAndRaised 必须用乐观条件 + RowsAffected 检测

4. 建 config 文件（internal/config/presale.go）
   - PresaleConfig struct 见 §6
   - 挂到主 config 加载链中（mapstructure）

5. 建 presale-worker 骨架（cmd/presale-worker/main.go）
   - leader 抢锁 + cron 占位，见 §7
   - 空跑验证：连接成功后打印心跳，不实际扫块

6. 每个 repository 文件配对应单元测试（_test.go）
   - 必须覆盖：幂等 case + 乐观锁 case + 加权平均公式

约束（禁止违反）：
- 不改 internal/handler/ internal/service/ internal/chain/ internal/router/（B1/B2 负责）
- 不引入新的第三方依赖（GORM / shopspring/decimal / zerolog 已有）
- 不自创字段（严格对齐 01-data-model.md）
- presale_admin_audit 表在 admin-backend 仓库，不在 web-api

验收命令（必须全绿才算完成）：
  go build ./...
  go vet ./...
  go test ./internal/repository/... -count=1
  # 在 dev 库执行所有 migration SQL 后检查表结构
```
