# B2 · 入金链路（Deposit-first + 双轨会师 + USDT 监听器）

> 依赖 B0 gate 通过（`presale_deposit` / `presale_holding` / `presale_event_cursor` 表 + repository 接口稳定）。
> 依赖 B1 gate 通过（`user_referral_bind` repository 可查绑定关系，referral service 已稳定）。
> 接口契约源真值：[02-api-contract.md §3.1～§3.5](../02-api-contract.md)。
> 数据模型源真值：[01-data-model.md §3.1～§3.7](../01-data-model.md)。
> 架构决策：[00-architecture.md §1、§5.1、§7.2](../00-architecture.md)。
>
> **本 batch 是工程量最重的核心**，分 2 个 agent 并行，最后由 verifier 会师验证。

---

## 1 背景

V3 采用 Deposit-first 事件驱动模型（[00-architecture.md §1](../00-architecture.md)）：

- **无 pending 订单**：用户直接发链上 USDT Transfer，不需要后端先建订单
- **双轨上报**：前端 `POST /deposit/report-tx`（用户主动）+ Worker 监听器（被动扫块），两路都进同一个 `confirm-deposit` service
- **幂等键 `uk_(tx_hash, log_index)`**：两路并发时，数据库唯一键保证只入账一次
- **链上事件即真相**：deposit 落库的金额 / from / to 来自链上 receipt，不信任前端传入的金额

```
用户发 USDT.transfer(vault, amount)
      │
      ├─ 前端 report-tx ──────────────────┐
      │                                   ▼
      └─ Worker eth_getLogs ──────► confirm-deposit service
                                          │
                          uk_(tx_hash, log_index) 数据库幂等锁
                                          │
                              INSERT presale_deposit (pending)
                                          │
                         达到 confirmBlocks 后（≥3 区块）
                                          │
                     UPDATE status=confirmed + UPSERT holding（同一事务）
```

---

## 2 并行拆分：Agent A / Agent B

本 batch 两个 agent 同时开工，文件不重叠：

| | Agent A | Agent B |
|---|---|---|
| **职责** | 用户 HTTP 接口 + config 接口 | USDT 监听器 + Round cron + 双轨会师 service |
| **独占路径** | `internal/handler/presale.go` | `internal/chain/presale_listener.go` |
| | `internal/service/presale_deposit.go`（接口定义） | `internal/service/presale_deposit.go`（confirm-deposit 实现） |
| | `internal/service/presale_config.go` | `internal/service/presale_round_cron.go` |
| | `internal/router/presale.go` | `cmd/presale-worker/main.go`（接入监听器，B0 骨架已有） |
| **会师点** | `ConfirmDeposit(ctx, txHash, logIndex, ...)` service 方法签名 | 相同签名，B 实现，A 调用（report-tx 走异步确认时也调此路径） |

> **注意**：`internal/service/presale_deposit.go` 文件由 Agent B 实现（含 confirm-deposit 核心逻辑），Agent A 依赖其 interface。两 agent 开工前必须先对齐 `PresaleDepositService` interface 签名（见 §5.3）。

---

## 3 文件边界（完整清单）

**Agent A 独占**：

| 路径 | 动作 |
|---|---|
| `internal/handler/presale.go` | 新建：5 个用户接口 handler |
| `internal/service/presale_config.go` | 新建：config 聚合逻辑 |
| `internal/router/presale.go` | 新建：注册 `/api/v1/presale/*` 路由组 |

**Agent B 独占**：

| 路径 | 动作 |
|---|---|
| `internal/chain/presale_listener.go` | 新建：USDT Transfer 监听器（多金库地址池）|
| `internal/service/presale_deposit.go` | 新建：`PresaleDepositService` interface + confirm-deposit 实现 |
| `internal/service/presale_round_cron.go` | 新建：Round status cron（5min 推进状态机）|
| `cmd/presale-worker/main.go` | 改：把监听器 + cron 接入 B0 骨架 |

**共读（不修改）**：

- `internal/repository/presale_deposit.go`（B0 建）
- `internal/repository/presale_round.go`（B0 建）
- `internal/repository/presale_holding.go`（B0 建）
- `internal/repository/presale_event_cursor.go`（B0 建）
- `internal/repository/presale_ops_event.go`（B0 建）
- `internal/repository/user_referral_bind.go`（B0 建）

---

## 4 Schema 引用

| 表 | 文档引用 | 关键字段 |
|---|---|---|
| `presale_deposit` | [§3.2](../01-data-model.md) | `uk_(tx_hash, log_index)` 幂等锁；`status` 三态；`source` 双轨标记 |
| `presale_round` | [§3.1](../01-data-model.md) | `status` 状态机；`manual_override`；`sold_odd / supply_odd` |
| `presale_config` | [§3.3](../01-data-model.md) | `boundary_tolerance_min`；`vault_address`；`min_subscribe_usd` |
| `presale_holding` | [§3.4](../01-data-model.md) | `uk_(user_id, round_id, source)`；加权平均 |
| `presale_event_cursor` | [§3.7](../01-data-model.md) | 每金库地址一行；单事务提交游标 + deposit |
| `presale_ops_event` | [§3.8](../01-data-model.md) | anomaly 落库 + Lark 推送 |
| `user_referral_bind` | [§3.6](../01-data-model.md) | `bound_at < block_timestamp` 才算有效邀请 |

---

## 5 Agent A：用户 HTTP 接口

### 5.1 接口清单

| 接口 | 路径 | 鉴权 | Batch |
|---|---|---|---|
| 配置 | `GET /api/v1/presale/config` | 公开 | B0 中已规划，B2 A 实现 |
| 上报 tx | `POST /api/v1/presale/deposit/report-tx` | JWT | B2 A |
| 查单笔 | `GET /api/v1/presale/deposit/:txHash` | JWT | B2 A |
| 入账历史 | `GET /api/v1/presale/deposit/list` | JWT | B2 A |
| 持仓 | `GET /api/v1/presale/position` | JWT | B2 A |

契约详情见 [02-api-contract.md §3.1～§3.5](../02-api-contract.md)。

### 5.2 `GET /api/v1/presale/config` 实现要点

```go
// internal/service/presale_config.go
//
// config 接口是高频公开接口（首屏渲染），用 Redis 30s 缓存降低 DB 压力
// 监听器入账 confirmed 时需 DEL 缓存，让下一次请求刷新 sold/raised 数据
// tgeDiscountPct 是衍生字段，后端计算而非前端：(tge_open_price - round.price) / tge_open_price × 100
// totalRaisedUsd = Σ presale_round.raised_usd（所有轮次，含 ended）

func (s *presaleConfigService) GetConfig(ctx context.Context) (*ConfigResponse, error) {
    const cacheKey = "presale:config:v1"

    // 1. 尝试 Redis 缓存
    if cached, err := s.rdb.Get(ctx, cacheKey).Bytes(); err == nil {
        var resp ConfigResponse
        if err := json.Unmarshal(cached, &resp); err == nil {
            return &resp, nil
        }
    }

    // 2. DB 查询
    cfg, err := s.configRepo.Get(ctx)
    rounds, err := s.roundRepo.List(ctx)
    totalRaised, err := s.roundRepo.TotalRaisedUsd(ctx)

    // 3. 组装响应（tgeDiscountPct 后端计算）
    resp := buildConfigResponse(cfg, rounds, totalRaised)

    // 4. 写 Redis（失败不阻塞，缓存是优化非依赖）
    if b, err := json.Marshal(resp); err == nil {
        s.rdb.Set(ctx, cacheKey, b, 30*time.Second)
    }
    return resp, nil
}
```

### 5.3 `POST /api/v1/presale/deposit/report-tx` 链上校验流程

```go
// internal/handler/presale.go
//
// report-tx 是双轨入口之一，完整的链上校验在 service 层做
// handler 只做参数绑定 + JWT 取 userID/eoa + 调 service

// internal/service/presale_deposit.go（interface，B 实现）
type PresaleDepositService interface {
    // ReportTx 前端上报入口
    // 1. 调 BSC RPC eth_getTransactionReceipt 拿 receipt（非信任前端传值）
    // 2. 解析 USDT Transfer log，校验 from/to/token
    // 3. 幂等：uk_(tx_hash, log_index) 已存在则直接返回已有 depositId
    // 4. 找归属轮次（block_timestamp + boundary_tolerance_min 容差）
    // 5. INSERT presale_deposit(status=pending, source=frontend)
    // 6. 异步等待区块确认（Worker 扫块时也会并行推进同一 deposit）
    ReportTx(ctx context.Context, userID uint64, eoa string, req ReportTxRequest) (*ReportTxResponse, error)

    // GetByTxHash 前端轮询，查单笔 deposit 状态（status: pending/confirmed/anomaly）
    GetByTxHash(ctx context.Context, userID uint64, txHash string) (*DepositDetail, error)

    // ListByUser 入账历史（分页）
    ListByUser(ctx context.Context, userID uint64, status string, page, size int) (*DepositListResponse, error)

    // GetPosition 聚合用户预售持仓（跨轮次跨 source）
    GetPosition(ctx context.Context, userID uint64) (*PositionResponse, error)

    // ConfirmDeposit 双轨会师核心：Worker 扫块达到 confirmBlocks 时调用
    // 同一事务内：UPDATE deposit(confirmed) + UPSERT holding(invest + referral)
    // 幂等：已 confirmed 的 deposit 再调此方法直接返回 nil
    ConfirmDeposit(ctx context.Context, tx *gorm.DB, depositID uint64, confirmedAt int64) error
}
```

### 5.4 `report-tx` 链上校验步骤

```go
// internal/service/presale_deposit.go
//
// 链上校验设计为串行 fail-fast，前三个错误直接返 HTTP 错误码（不入 anomaly）：
// 40006 INVALID_TX：receipt 不存在或 status=failed（用户 tx 根本没成功）
// 40007 TX_NOT_TO_VAULT：收款地址不在金库池（用户转错地址）
// 40008 TX_NOT_USDT：不是 USDT 转账（用户转错 token）
// 40902 WALLET_MISMATCH：tx.from ≠ 登录态 EOA（禁止代付）
//
// 通过前四项校验后，才进入轮次归属 + anomaly 检测阶段（此时 deposit 已入库，交给 Worker/ops 处理）
func (s *presaleDepositService) validateReceipt(ctx context.Context, txHash string, userEoa string, vaultPool []string) (*ParsedTransfer, error) {
    // 1. eth_getTransactionReceipt
    receipt, err := s.bscClient.TransactionReceipt(ctx, common.HexToHash(txHash))
    if err != nil || receipt == nil || receipt.Status != 1 {
        return nil, ErrInvalidTx // 40006
    }

    // 2. 从 logs 中找 USDT Transfer(to ∈ vaultPool)
    transfer, err := parseUsdtTransferLog(receipt.Logs, vaultPool, s.cfg.UsdtAddress)
    if err == errNoVaultLog {
        return nil, ErrTxNotToVault // 40007
    }
    if err == errNotUsdt {
        return nil, ErrTxNotUsdt // 40008
    }

    // 3. tx.from 严格匹配登录态 EOA（[关键不变量 4](../README.md#6)）
    // 智能合约钱包代付走预案，不接受（对抗 from_mismatch）
    if !strings.EqualFold(receipt.From(), userEoa) {
        return nil, ErrWalletMismatch // 40902
    }

    return transfer, nil
}
```

### 5.5 轮次归属（边界容差）

```go
// internal/service/presale_deposit.go
//
// 按 block_timestamp 找归属轮次，容差 ±boundary_tolerance_min（默认 5min）
// 边界设计：
//   正常：block_ts ∈ [round.start_ts, round.end_ts] → 属于该轮次
//   边界切轮：block_ts ∈ (round.end_ts, round.end_ts + tolerance] → 仍属于该轮次（下一轮的前 5min 也算上一轮）
//   超时：block_ts > round.end_ts + tolerance → 按下一轮算
//   若前端 expectedRoundId 与实际轮次不符 → 记 round_mismatch anomaly（信息流，不阻塞入账）
func (s *presaleDepositService) findRound(ctx context.Context, blockTsMs int64, toleranceMin int) (*model.PresaleRound, error) {
    rounds, err := s.roundRepo.ListActive(ctx) // status ∈ {active, paused}
    toleranceMs := int64(toleranceMin) * 60 * 1000

    for _, r := range rounds {
        // 标准窗口内
        if blockTsMs >= r.StartTs && blockTsMs <= r.EndTs {
            return r, nil
        }
        // 边界容差：刚过 end_ts 的 tolerance 内仍算本轮
        if blockTsMs > r.EndTs && blockTsMs <= r.EndTs+toleranceMs {
            return r, nil
        }
    }

    // 找下一个 upcoming 轮次作为兜底
    upcoming, err := s.roundRepo.FindUpcomingNearest(ctx)
    if upcoming != nil {
        return upcoming, nil
    }

    return nil, ErrNoActiveRound // 进 late_arrival anomaly
}
```

---

## 6 Agent B：监听器 + cron + 双轨会师

### 6.1 USDT 监听器设计

```go
// internal/chain/presale_listener.go
//
// 用 eth_getLogs 轮询（非 WebSocket subscribe），原因：
// 1. HTTP 长轮询比 WS 订阅更简单可靠（BSC 节点 WS 有时断线）
// 2. 游标管理更清晰：每次从 cursor.last_block_number+1 开始拉，不依赖 WS session
// 3. 支持历史重放（改 cursor 即可从任意高度重跑）
//
// 多金库地址池：每个 vault 地址维护独立游标（presale_event_cursor 每地址一行）
// 切换金库地址时：env PRESALE_VAULT_POOL 追加新地址，不删老地址，老地址继续被监听
// 直到老地址上的所有 pending deposit 都 confirmed 为止

type PresaleListener struct {
    cfg        *config.PresaleConfig
    db         *gorm.DB
    bscClient  *ethclient.Client
    depositSvc service.PresaleDepositService
    cursorRepo repository.PresaleEventCursorRepository
    lark       *lark.Client
    log        zerolog.Logger
}

func (l *PresaleListener) Run(ctx context.Context) {
    ticker := time.NewTicker(time.Duration(l.cfg.PollIntervalSec) * time.Second)
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            // 每个金库地址独立扫块（串行，避免并发写游标）
            for _, vault := range l.cfg.VaultPool {
                if err := l.scanVault(ctx, vault); err != nil {
                    l.log.Error().Err(err).Str("vault", vault).Msg("scan vault failed")
                }
            }
        }
    }
}

func (l *PresaleListener) scanVault(ctx context.Context, vaultAddr string) error {
    cursor, err := l.cursorRepo.Load(ctx, vaultAddr)

    // 获取当前链头，计算安全块（current - confirmBlocks）
    head, err := l.bscClient.BlockNumber(ctx)
    safeBlock := head - l.cfg.ConfirmBlocks

    if cursor.LastBlockNumber >= safeBlock {
        return nil // 尚未到安全块，等下一轮
    }

    // eth_getLogs：从 cursor+1 到 safeBlock，过滤 USDT Transfer(to=vaultAddr)
    logs, err := l.bscClient.FilterLogs(ctx, ethereum.FilterQuery{
        FromBlock: new(big.Int).SetUint64(cursor.LastBlockNumber + 1),
        ToBlock:   new(big.Int).SetUint64(safeBlock),
        Addresses: []common.Address{common.HexToAddress(l.cfg.UsdtAddress)},
        Topics: [][]common.Hash{{
            crypto.Keccak256Hash([]byte("Transfer(address,address,uint256)")),
            {},
            common.HexToHash(common.HexToAddress(vaultAddr).Hex()),
        }},
    })

    for _, log := range logs {
        // 解析 Transfer log，提取 from / amount
        if err := l.processLog(ctx, log, vaultAddr); err != nil {
            l.log.Error().Err(err).Str("tx", log.TxHash.Hex()).Msg("process log failed")
            // 继续处理下一条 log（单条失败不阻断整批）
        }
    }

    // 原子更新游标（只更新游标，deposit 在 processLog 内已落库）
    return l.cursorRepo.Save(ctx, l.db, vaultAddr, safeBlock, 0)
}
```

### 6.2 双轨会师：confirm-deposit service

```go
// internal/service/presale_deposit.go
//
// confirm-deposit 是双轨入口的公共终点，前端 report-tx 和 Worker 扫块都调此路径
// 幂等保证：uk_(tx_hash, log_index) 数据库唯一键，两路并发时只有一路成功 INSERT
// 事务边界：deposit INSERT + holding UPSERT + cursor Save 在一个大事务内（Worker 路径）
//           前端路径：INSERT deposit(pending)，等 Worker 扫块后推进 confirmed

// processLog（Worker 内部调用）
func (l *PresaleListener) processLog(ctx context.Context, logEntry types.Log, vaultAddr string) error {
    transfer := parseTransferLog(logEntry) // from / to / amount

    // 1. 反查 user_id（by eoa = from）
    user, err := l.userRepo.GetByEoa(ctx, transfer.From)
    if user == nil {
        // from EOA 无对应用户（绕前端直转）→ anomaly unclaimed
        return l.recordAnomaly(ctx, logEntry, vaultAddr, transfer, model.AnomalyUnclaimed)
    }

    // 2. 查 block_timestamp（从 receipt 或 eth_getBlockByNumber）
    blockTs, err := l.getBlockTimestamp(ctx, logEntry.BlockNumber)

    // 3. 找归属轮次（含容差）
    round, err := l.depositSvc.FindRound(ctx, blockTs)

    // 4. 反查邀请关系（bound_at < blockTs 才算有效）
    bind, _ := l.bindRepo.GetByUserID(ctx, user.ID)
    var referrerUserID *uint64
    var referralRewardOdd decimal.Decimal
    if bind != nil && bind.BoundAt < blockTs {
        referrerUserID = &bind.ReferrerUserID
        // 邀请奖励计算（[INV-7](../01-data-model.md#5-关键不变量测试-assertion)）
        pct := round.ReferralRewardPct
        sharesOdd := transfer.Amount.Div(round.PriceUsd)
        referralRewardOdd = sharesOdd.Mul(pct).Div(decimal.NewFromInt(100))
    }

    // 5. 开始大事务：INSERT deposit + UPSERT holding + 推进 round sold
    return l.db.Transaction(func(tx *gorm.DB) error {
        deposit := &model.PresaleDeposit{
            TxHash:            strings.ToLower(logEntry.TxHash.Hex()),
            LogIndex:          uint(logEntry.Index),
            BlockNumber:       logEntry.BlockNumber,
            BlockTimestamp:    blockTs,
            UserID:            user.ID,
            EoaAddress:        strings.ToLower(transfer.From),
            VaultAddress:      strings.ToLower(vaultAddr),
            RoundID:           round.ID,
            AmountUsdt:        transfer.Amount,
            PriceUsd:          round.PriceUsd,
            SharesOdd:         transfer.Amount.Div(round.PriceUsd),
            ReferrerUserID:    referrerUserID,
            ReferralRewardPct: &round.ReferralRewardPct,
            ReferralRewardOdd: referralRewardOdd,
            Status:            model.DepositStatusConfirmed, // Worker 路径：已达安全块，直接 confirmed
            Source:            model.DepositSourceWorker,
        }

        // uk_(tx_hash, log_index) 冲突时返回已有记录（前端已先 INSERT pending）
        existing, isNew, err := l.depositRepo.CreateOrGet(ctx, tx, deposit)
        if !isNew {
            // 前端已创建 pending 记录，更新为 confirmed
            if existing.Status == model.DepositStatusPending {
                if err := l.depositRepo.ConfirmDeposit(ctx, tx, existing.ID, time.Now().UnixMilli()); err != nil {
                    return err
                }
            }
            // 已 confirmed 则幂等返回（重复扫块保护）
        }

        // 6. 校验超额（IncrSoldAndRaised 乐观条件）
        if err := l.roundRepo.IncrSoldAndRaised(ctx, tx, round.ID, deposit.SharesOdd, deposit.AmountUsdt); err == ErrCapacityExceeded {
            // overflow anomaly：超出容量，deposit 仍入库但标 anomaly
            return l.depositRepo.MarkAnomaly(ctx, tx, deposit.ID, model.AnomalyOverflow)
        }

        // 7. UPSERT holding（invest + referral）
        if err := l.holdingRepo.UpsertInvest(ctx, tx, user.ID, round.ID, deposit.SharesOdd, deposit.AmountUsdt, round.PriceUsd); err != nil {
            return err
        }
        if referrerUserID != nil && referralRewardOdd.IsPositive() {
            if err := l.holdingRepo.UpsertReferral(ctx, tx, *referrerUserID, round.ID, referralRewardOdd); err != nil {
                return err
            }
        }

        // 8. DEL config 缓存（sold/raised 已更新，下次请求刷新）
        l.rdb.Del(ctx, "presale:config:v1")

        return nil
    })
}
```

### 6.3 游标管理原则

```go
// internal/chain/presale_listener.go
//
// 游标单事务提交设计（[01-data-model.md §3.7](../01-data-model.md)）：
// 游标更新和 deposit 落库必须在同一事务内，否则：
//   - 先更游标再 INSERT：崩溃后 log 永久丢失（游标已跳过）
//   - 先 INSERT 再更游标：崩溃后重放，uk_(tx_hash, log_index) 保证幂等（可接受）
//
// 实现选择：游标在 scanVault 末尾单独更新（每个 log 各自事务 + 最后更游标）
// 而非每个 log 一个大事务——原因：单条 log 处理失败不阻塞游标推进（继续处理下一批）
// 已 confirmed 的 log 靠 uk_(tx_hash, log_index) 幂等，不怕重放
```

### 6.4 重组防御

```go
// internal/chain/presale_listener.go
//
// BSC 出块 ~3s，等 3 个区块 ≈ 9s 的确认时间
// safeBlock = head - confirmBlocks（默认 3）
// 所有 eth_getLogs 查询的 ToBlock ≤ safeBlock，不处理 safeBlock 以上的区块
// 若发生重组：游标已记录的 block_number 范围内的 log 已经入库，
//   重组导致这些 tx 消失时，deposit 保持 confirmed 状态（不自动回滚）
//   运营通过 presale_admin_audit + 预案脚本处理极端重组（BSC 重组 >3 块概率极低）
```

### 6.5 Round status cron（5min 推进）

```go
// internal/service/presale_round_cron.go
//
// cron 设计：只推进 manual_override=0 的轮次（[01-data-model.md §3.1 状态机](../01-data-model.md)）
// 运营 pause/resume/reopen/close 后 manual_override=1，cron 不再干预该轮次
// 这是防止"运营刚 pause，cron 立刻把它 resume"的关键保护

func (s *roundCronService) Tick(ctx context.Context) {
    nowMs := time.Now().UnixMilli()

    // 1. upcoming → active（now ≥ start_ts）
    toActivate, _ := s.roundRepo.ListAutoAdvanceable(ctx, nowMs)
    for _, r := range toActivate {
        if r.Status == model.RoundStatusUpcoming && nowMs >= r.StartTs {
            s.roundRepo.AdvanceStatus(ctx, r.ID, model.RoundStatusUpcoming, model.RoundStatusActive)
            s.log.Info().Str("round", r.ID).Msg("round activated by cron")
        }
    }

    // 2. active → ended（now ≥ end_ts 或 sold_odd ≥ supply_odd）
    for _, r := range toActivate {
        if r.Status == model.RoundStatusActive {
            if nowMs >= r.EndTs || r.SoldOdd.GreaterThanOrEqual(r.SupplyOdd) {
                s.roundRepo.AdvanceStatus(ctx, r.ID, model.RoundStatusActive, model.RoundStatusEnded)
                s.log.Info().Str("round", r.ID).Str("reason", "time_or_sold_out").Msg("round ended by cron")
            }
        }
    }
}
```

### 6.6 anomaly 检测 + Lark 告警

```go
// internal/service/presale_deposit.go
//
// anomaly 落库 + Lark 推送是解耦的：
// 1. DB 事务内落 presale_ops_event（同步，保证不丢失）
// 2. 事务 commit 后异步推 Lark webhook（推送失败不影响 deposit 入账）
// Lark 消息包含：event_type / tx_hash / eoa / amount / reason，
// 供运营快速分流（多数异常 ops 团队 5min 内处理完）

func (s *presaleDepositService) recordAnomaly(ctx context.Context, depositID *uint64, txHash, eoa string, amountUsdt decimal.Decimal, eventType, payloadJSON string) error {
    event := &model.PresaleOpsEvent{
        EventType:   eventType,
        DepositID:   depositID,
        TxHash:      &txHash,
        EoaAddress:  &eoa,
        AmountUsdt:  &amountUsdt,
        PayloadJSON: &payloadJSON,
        Status:      "pending",
        CreatedAt:   time.Now().UnixMilli(),
        UpdatedAt:   time.Now().UnixMilli(),
    }
    if err := s.opsEventRepo.Create(ctx, s.db, event); err != nil {
        return err
    }

    // 异步推 Lark（不阻塞主流程）
    go func() {
        if err := s.lark.SendAnomalyAlert(context.Background(), event); err != nil {
            s.log.Warn().Err(err).Str("tx", txHash).Msg("lark anomaly push failed")
        }
    }()
    return nil
}
```

---

## 7 关键不变量验证（代码层）

引用 [01-data-model.md §5](../01-data-model.md)：

| 不变量 ID | 在哪里检查 | 实现 |
|---|---|---|
| INV-1 `sold_odd ≤ supply_odd` | `IncrSoldAndRaised` SQL 乐观条件 | `RowsAffected=0` → ErrCapacityExceeded → overflow anomaly |
| INV-3 `uk_(tx_hash, log_index)` | `CreateOrGet` 函数 | ON DUPLICATE 返回已有记录 |
| INV-6 `bound_at < block_timestamp` | `processLog` 步骤 4 | `bind.BoundAt < blockTs` 条件判断 |
| INV-7 `referral_reward_odd = shares × pct / 100` | `processLog` 步骤 4 | 用 `shopspring/decimal` 精确计算 |
| INV-8 `locked_price_avg` 加权公式 | `UpsertInvest` SQL | ON DUPLICATE KEY UPDATE 内联公式 |

---

## 8 多金库地址池运维

```
env PRESALE_VAULT_POOL = "0xOLD...,0xNEW..."（切换金库时追加，不删旧地址）

切换流程：
1. 运营 PATCH /admin/presale/config 写新 vault_address 到 presale_config 表
2. 后端返回 warning 提示更新 env
3. 运营更新 PRESALE_VAULT_POOL（追加，不删旧地址）
4. 重启 presale-worker
5. Worker 启动时 EnsureAll 为新地址创建游标（从 latest block 开始）
6. 老地址游标继续运行，直到老地址上的所有 pending deposit 都 confirmed

注意：presale_deposit.vault_address 快照的是到账时的金库地址，
即使后续切换金库，历史记录仍能追溯到具体金库（[关键不变量 9](../README.md#6)）
```

---

## 9 `GET /api/v1/presale/position` 计算

```go
// internal/service/presale_deposit.go
//
// position 聚合逻辑（[02-api-contract.md §3.5](../02-api-contract.md)）：
// 数据来源：presale_holding 表（已由 confirm-deposit 维护，非实时 SQL 聚合）
// 返回值不含 todayPriceUsd / todayValueUsd（砍掉，由前端调独立汇率服务）
// lockedPriceAvg 的跨轮次加权：Σ(round_total × round_avg) / Σ(round_total)
//                              source=invest 行参与计算，source=referral 行不参与

func (s *presaleDepositService) GetPosition(ctx context.Context, userID uint64) (*PositionResponse, error) {
    holdings, err := s.holdingRepo.ListByUser(ctx, userID)

    var totalOdd, investOdd, referralOdd decimal.Decimal
    var investedUsd decimal.Decimal
    var weightedSum decimal.Decimal // Σ(total_odd × locked_price_avg)，分母是 investOdd

    perRound := make(map[string]*PerRoundItem)
    for _, h := range holdings {
        totalOdd = totalOdd.Add(h.TotalOdd)
        item := getOrCreate(perRound, h.RoundID)
        if h.Source == model.HoldingSourceInvest {
            investOdd = investOdd.Add(h.TotalOdd)
            investedUsd = investedUsd.Add(h.InvestedUsd)
            weightedSum = weightedSum.Add(h.TotalOdd.Mul(h.LockedPriceAvg))
            item.TotalOdd = item.TotalOdd.Add(h.TotalOdd)
            item.InvestedUsd = item.InvestedUsd.Add(h.InvestedUsd)
            item.LockedPriceAvg = h.LockedPriceAvg
        } else {
            referralOdd = referralOdd.Add(h.TotalOdd)
            item.ReferralOdd = item.ReferralOdd.Add(h.TotalOdd)
        }
    }

    var lockedPriceAvg decimal.Decimal
    if investOdd.IsPositive() {
        lockedPriceAvg = weightedSum.Div(investOdd)
    }

    return &PositionResponse{
        Holdings:         totalOdd.String(),
        HoldingsBySource: map[string]string{"invest": investOdd.String(), "referral": referralOdd.String()},
        InvestedUsd:      investedUsd.String(),
        LockedPriceAvg:   lockedPriceAvg.String(),
        PerRound:         sortedPerRound(perRound),
    }, nil
}
```

---

## 10 DoD（Definition of Done）

B2 分 A / B 两个子 DoD，最后有会师 DoD：

### Agent A 子 DoD

- [ ] `GET /api/v1/presale/config` 返回所有轮次 + 金库信息 + `tgeDiscountPct` 衍生字段正确
- [ ] `POST /api/v1/presale/deposit/report-tx` 链上校验 4 项（INVALID_TX / TX_NOT_TO_VAULT / TX_NOT_USDT / WALLET_MISMATCH）均能触发
- [ ] `GET /api/v1/presale/deposit/:txHash` 前端轮询正常返回 pending → confirmed 状态
- [ ] `GET /api/v1/presale/deposit/list` 分页正确，status 筛选有效
- [ ] `GET /api/v1/presale/position` holdings / holdingsBySource / lockedPriceAvg 计算口径与 [02-api-contract.md §3.5](../02-api-contract.md) 一致
- [ ] `go test ./internal/service/... -run TestPresaleConfig -count=1` 全绿
- [ ] `go test ./internal/handler/... -run TestPresale -count=1` 全绿

### Agent B 子 DoD

- [ ] 监听器空跑：接入 B0 worker 骨架，能连 BSC RPC + 打游标日志，不 panic
- [ ] `scanVault` 能正确从 cursor.last_block_number+1 拉 eth_getLogs
- [ ] Round status cron：upcoming→active / active→ended 两条路径单测通过
- [ ] `processLog` 单测：正常 confirmed 路径 + overflow anomaly 路径
- [ ] 多金库地址池：`EnsureAll` 为 2 个地址各创建游标，`scanVault` 串行跑 2 个地址
- [ ] `go test ./internal/chain/... -run TestPresaleListener -count=1` 全绿
- [ ] `go test ./internal/service/... -run TestRoundCron -count=1` 全绿

### 会师 DoD（verifier）

- [ ] 双轨竞态：前端 report-tx 和 Worker 扫块同时到达，`uk_(tx_hash, log_index)` 保证只入账一次（DB 层 + 集成测试验证）
- [ ] 边界容差：block_timestamp 在 end_ts + 3min 内的 deposit 归属上一轮（单测验证）
- [ ] 邀请奖励时序：`bound_at > block_timestamp` 的绑定不计入 referral_reward_odd（单测验证）
- [ ] 多金库切换：两个 vault 地址各有游标，第二个地址的 deposit 能正确入账
- [ ] `go test ./... -count=1` 全绿（B0 + B1 + B2 所有测试）
- [ ] `go build ./...` 通过，包含 `cmd/presale-worker`
- [ ] code-reviewer 审过，无 Critical / High 问题

---

## 11 风险点

| 风险 | 缓解 |
|---|---|
| BSC RPC 限流 / 不稳定 | env 配多个 RPC URL 做 fallback（`BSC_RPC_URL_FALLBACK`）；eth_getLogs 失败重试 3 次 + Lark 告警 |
| Worker 进程崩溃漏块 | 游标持久化到 DB；重启后从 cursor.last_block_number+1 恢复扫块，uk 保证幂等不重入 |
| confirm-deposit 大事务慢锁 | 事务内只做：INSERT deposit + UPDATE round sold + UPSERT holding（3 个语句）；UPSERT holding 用 ON DUPLICATE KEY（单语句原子）|
| `position` 接口聚合慢 | 数据来源是 presale_holding（已聚合表），不是实时 SUM(presale_deposit)；百万级用户 holding 行数 ≤ 6×2=12 行，单用户查询极快 |
| report-tx 被洪水攻击 | nginx + service 双层限流（10 req/min/user）；txHash 做 SHA-256 黑名单检测（可选） |
| 游标和 deposit 不同事务 | 已接受：Worker 路径游标在 scanVault 末尾更新（批次提交），单条 deposit 失败不影响游标推进；重放靠 uk 幂等 |

---

## 12 Task Prompt for Agent A（用户 HTTP 接口）

```
任务：实现 oddfi-backend/web-api/docs/dd-invest/batches/B2-deposit.md §5 定义的 Agent A 部分。

前置条件：B0 + B1 gate 已通过。

上下文文档（必须先读）：
- web-api/docs/dd-invest/02-api-contract.md §3.1～§3.5（接口契约）
- web-api/docs/dd-invest/batches/B2-deposit.md §2、§3、§5（本文档 A 职责）

执行顺序：

1. 新建 internal/service/presale_deposit.go
   - 只声明 PresaleDepositService interface（§5.3 签名）
   - 不实现（等 B 完成后合并）

2. 新建 internal/service/presale_config.go
   - GetConfig：Redis 30s 缓存 + DB 聚合（§5.2）
   - tgeDiscountPct 计算：(tge_open_price - round.price) / tge_open_price × 100

3. 新建 internal/handler/presale.go
   - 5 个 handler：config / report-tx / getByTxHash / list / position
   - 响应格式严格对齐 02-api-contract.md

4. 新建 internal/router/presale.go
   - 注册 /api/v1/presale/* 路由组
   - /config 不挂 JWT；其余挂 JWT 中间件

5. report-tx handler 的链上校验（§5.4）：
   - eth_getTransactionReceipt → 校验 4 项（INVALID_TX / NOT_TO_VAULT / NOT_USDT / WALLET_MISMATCH）
   - 通过校验后调 service.ReportTx

6. 单元测试
   - TestPresaleConfig：缓存命中 / 未命中 / tgeDiscountPct 计算
   - TestReportTx：4 个错误码各 1 个 case

约束：
- presale_deposit.go 只声明 interface，不实现（B 负责实现）
- 不改 internal/chain/ （B 负责）
- position 聚合用 presale_holding 表，不做实时 SUM(presale_deposit)
- 金额字段返回 string（decimal.Decimal.String()）

验收：
  go vet ./... && go build ./...
  go test ./internal/service/... -run TestPresaleConfig -count=1
  go test ./internal/handler/... -run TestPresale -count=1
```

---

## 13 Task Prompt for Agent B（监听器 + cron + 双轨会师）

```
任务：实现 oddfi-backend/web-api/docs/dd-invest/batches/B2-deposit.md §6 定义的 Agent B 部分。

前置条件：B0 + B1 gate 已通过。与 Agent A 同时开工，interface 签名（§5.3）提前对齐。

上下文文档（必须先读）：
- web-api/docs/dd-invest/00-architecture.md §1、§5.1、§7.2（架构决策）
- web-api/docs/dd-invest/01-data-model.md §3.2、§3.4、§3.7、§3.8（关键表）
- web-api/docs/dd-invest/batches/B2-deposit.md §2、§3、§6（本文档 B 职责）

执行顺序：

1. 实现 internal/service/presale_deposit.go
   - PresaleDepositService interface（对齐 A 声明的签名）
   - ReportTx：INSERT presale_deposit(pending, source=frontend)
   - ConfirmDeposit：事务内 UPDATE confirmed + UPSERT holding（§6.2）
   - FindRound：边界容差逻辑（§5.5）
   - recordAnomaly：落 presale_ops_event + 异步 Lark（§6.6）

2. 新建 internal/chain/presale_listener.go
   - PresaleListener.Run：多金库地址轮询（§6.1）
   - scanVault：eth_getLogs + cursor 管理（§6.3）
   - processLog：解析 Transfer → user 反查 → 反查 referral → 大事务（§6.2）
   - 重组防御：safeBlock = head - confirmBlocks（§6.4）

3. 新建 internal/service/presale_round_cron.go
   - Tick：upcoming→active + active→ended（§6.5）
   - 只推进 manual_override=0 的轮次

4. 改 cmd/presale-worker/main.go（B0 骨架已有）
   - 解注释第 5 步，接入 PresaleListener.Run
   - 接入 roundCronService.Tick（ticker 5min）

5. 单元测试
   - TestPresaleListener/processLog：正常路径 + overflow anomaly + unclaimed anomaly
   - TestRoundCron：upcoming→active + active→ended + manual_override=1 不推进
   - TestConfirmDeposit：幂等（二次调用）+ referral reward 计算

约束：
- eth_getLogs 用 HTTP（非 WS subscribe），FromBlock = cursor.LastBlockNumber+1，ToBlock = safeBlock
- 游标用批次更新（scanVault 末尾），不是每条 log 一次 Save
- 所有金额计算用 shopspring/decimal，禁止 float64
- from 地址比对用 strings.EqualFold（EIP-55 大小写不敏感）

关键不变量（测试必须覆盖）：
- INV-1：sold_odd 超 supply_odd 时触发 overflow anomaly（RowsAffected=0 路径）
- INV-3：相同 uk_(tx_hash, log_index) 第二次 processLog 幂等返回
- INV-6：bound_at > block_timestamp 的邀请关系不计入 referral_reward_odd
- INV-7：referral_reward_odd = shares_odd × pct / 100（精度单测）

验收：
  go vet ./... && go build ./... (含 cmd/presale-worker)
  go test ./internal/chain/... -run TestPresaleListener -count=1
  go test ./internal/service/... -run TestRoundCron -count=1
  go test ./internal/service/... -run TestConfirmDeposit -count=1
  # Worker 空跑：进程启动后打印心跳日志，Ctrl-C 优雅退出
```
