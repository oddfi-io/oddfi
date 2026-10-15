# B3 · Admin 管理后台模块（跨仓库 batch）

> **实现仓库**：`oddfi-admin-backend`（主 PR 在此仓库）
> **文档归属**：`oddfi-backend/web-api/docs/dd-invest/batches/B3-admin.md`（DD-INVEST 整套方案一部分）
> **接口契约源真值**：[03-admin-api-contract.md](../03-admin-api-contract.md)
> **依赖**：B0（presale_* 表 schema 已 migrate）、B2（presale_deposit 写入逻辑上线）

---

## 0 跨仓库工作流

```
oddfi-backend (web-api)          oddfi-admin-backend
       │                                  │
       │  presale_* 表 migration          │
       │  (B0 已完成，admin-backend        │
       │   直接 GORM 读写不走 API)         │
       │                                  │
       │  本 batch web-api 改动：          │
       │  ① 无（admin 接口全在            │
       │    admin-backend，不沾            │
       │    web-api /admin/* 路由）        │  feat/presale-admin 分支
       │                                  ├─ internal/router/router.go
       │                                  ├─ internal/handler/presale_*.go
       │                                  ├─ internal/service/presale_*.go
       │                                  ├─ internal/repository/presale_*.go
       │                                  ├─ internal/model/presale_*.go
       │                                  ├─ internal/middleware/presale_audit.go
       │                                  ├─ migrations/0002_create_presale_admin_audit.sql
       │                                  ├─ .claude/rules/rbac.md（追加预售路径）
       │                                  └─ docs/presale-admin/README.md（契约镜像）
```

**worktree 隔离操作**：

```bash
# 在 oddfi-admin-backend 根目录
git worktree add .claude/worktrees/presale-admin feat/presale-admin
cd .claude/worktrees/presale-admin

# agent A / agent B 各自在此 worktree 操作，文件不重叠
```

**web-api 仓库本 batch 无需改动**：admin 接口完全在 admin-backend 实现；web-api 的 `/admin/*` 零鉴权问题（SEC-001）本期不治理。

---

## 1 文件边界

### 1.1 admin-backend 仓库（主战场）

| 文件路径 | 说明 | Agent |
|---|---|---|
| `migrations/0002_create_presale_admin_audit.sql` | `presale_admin_audit` 表 DDL | A |
| `internal/model/presale_round.go` | Round GORM model（与 web-api 保持一致，独立维护） | A |
| `internal/model/presale_deposit.go` | Deposit GORM model | A |
| `internal/model/presale_config.go` | Config GORM model（单行表） | A |
| `internal/model/presale_ops_event.go` | OpsEvent GORM model | A |
| `internal/model/presale_admin_audit.go` | Audit GORM model（admin-backend 独有） | A |
| `internal/repository/presale_round.go` | Round CRUD + 状态机更新 | A |
| `internal/repository/presale_deposit.go` | Deposit 查询 + round_id 迁移事务 | A |
| `internal/repository/presale_config.go` | Config 读写（单行 upsert） | A |
| `internal/repository/presale_ops_event.go` | OpsEvent 查询 + resolve 更新 | A |
| `internal/repository/presale_audit.go` | Audit INSERT（只写，无 UPDATE/DELETE） | A |
| `internal/service/presale_round.go` | 轮次状态机 + PATCH 字段校验 | A |
| `internal/service/presale_deposit.go` | migrate-round 事务编排 | A |
| `internal/service/presale_config.go` | Config 读写 + vault_address 警告 | A |
| `internal/service/presale_anomaly.go` | Anomaly resolve 3 种 resolution 路由 | A |
| `internal/handler/presale_round.go` | Round HTTP handler（Gin） | A |
| `internal/handler/presale_config.go` | Config HTTP handler | A |
| `internal/handler/presale_deposit.go` | Deposit 查询 + migrate-round handler | A |
| `internal/handler/presale_anomaly.go` | Anomaly 列表 + resolve handler | A |
| `internal/handler/presale_audit.go` | Audit 查询 handler | A |
| `internal/middleware/presale_audit.go` | mutate 接口自动写 audit 的中间件 | B |
| `internal/router/router.go` | 注册 `/admin/presale/*` 路由组 | B |
| `.claude/rules/rbac.md` | 追加预售路径权限映射 | B |
| `docs/presale-admin/README.md` | 接口契约镜像（同步 03-admin-api-contract.md） | B |

### 1.2 文件不重叠保证

- Agent A 仅改 handler / service / repository / model / migration（不动 router / middleware）
- Agent B 仅改 router / middleware / rbac.md / docs（不动业务逻辑层）
- 会师点：router.go 在 Agent B 完成后集成 Agent A 的 handler 依赖

---

## 2 接口清单与 RBAC 矩阵

完整契约见 [03-admin-api-contract.md §1](../03-admin-api-contract.md)。

| 方法 | 路径 | 最低角色 | Handler 函数 |
|---|---|---|---|
| GET | `/admin/presale/rounds` | customer_service | `ListRounds` |
| GET | `/admin/presale/rounds/:id` | customer_service | `GetRound` |
| PATCH | `/admin/presale/rounds/:id` | super_admin | `UpdateRound` |
| POST | `/admin/presale/rounds/:id/pause` | operator | `PauseRound` |
| POST | `/admin/presale/rounds/:id/resume` | operator | `ResumeRound` |
| POST | `/admin/presale/rounds/:id/reopen` | operator | `ReopenRound` |
| POST | `/admin/presale/rounds/:id/close` | operator | `CloseRound` |
| PATCH | `/admin/presale/rounds/:id/referral-pct` | operator | `UpdateReferralPct` |
| GET | `/admin/presale/config` | customer_service | `GetConfig` |
| PATCH | `/admin/presale/config` | super_admin | `UpdateConfig` |
| GET | `/admin/presale/deposits` | customer_service | `ListDeposits` |
| GET | `/admin/presale/deposits/:txHash` | customer_service | `GetDeposit` |
| POST | `/admin/presale/deposits/:txHash/migrate-round` | operator | `MigrateRound` |
| GET | `/admin/presale/anomaly` | customer_service | `ListAnomaly` |
| GET | `/admin/presale/anomaly/:id` | customer_service | `GetAnomaly` |
| POST | `/admin/presale/anomaly/:id/resolve` | customer_service | `ResolveAnomaly` |
| GET | `/admin/presale/audit` | customer_service | `ListAudit` |

### RBAC 矩阵（追加到 `.claude/rules/rbac.md`）

| 操作 | super_admin | operator | customer_service | finance |
|---|---|---|---|---|
| 查看 rounds / deposits / anomaly / config / audit | ✅ | ✅ | ✅ | ✗ |
| pause / resume / reopen / close | ✅ | ✅ | ✗ | ✗ |
| 改 referral_reward_pct | ✅ | ✅ | ✗ | ✗ |
| anomaly/resolve | ✅ | ✅ | ✅ | ✗ |
| migrate-round | ✅ | ✅ | ✗ | ✗ |
| PATCH /config（vault / TGE / 基准价） | ✅ | ✗ | ✗ | ✗ |
| PATCH /rounds（价格 / supply / 时间窗） | ✅ | ✗ | ✗ | ✗ |

> finance 角色本期暂无预售相关 grant；退款链路启用后归 finance。

路由注册模式（复用现有 `RoleRequired` 中间件）：

```go
// internal/router/router.go
presale := admin.Group("/presale")
{
    // 查询接口：customer_service+
    cs := presale.Group("", middleware.RoleRequired(
        "customer_service", "operator", "finance", "super_admin"))
    cs.GET("/rounds", presaleHandler.ListRounds)
    cs.GET("/rounds/:id", presaleHandler.GetRound)
    cs.GET("/deposits", presaleHandler.ListDeposits)
    cs.GET("/deposits/:txHash", presaleHandler.GetDeposit)
    cs.GET("/anomaly", presaleHandler.ListAnomaly)
    cs.GET("/anomaly/:id", presaleHandler.GetAnomaly)
    cs.GET("/config", presaleHandler.GetConfig)
    cs.GET("/audit", presaleHandler.ListAudit)

    // 状态机操作：operator+（含 customer_service resolve）
    op := presale.Group("", middleware.RoleRequired(
        "operator", "super_admin"))
    op.POST("/rounds/:id/pause", middleware.PresaleAudit(), presaleHandler.PauseRound)
    op.POST("/rounds/:id/resume", middleware.PresaleAudit(), presaleHandler.ResumeRound)
    op.POST("/rounds/:id/reopen", middleware.PresaleAudit(), presaleHandler.ReopenRound)
    op.POST("/rounds/:id/close", middleware.PresaleAudit(), presaleHandler.CloseRound)
    op.PATCH("/rounds/:id/referral-pct", middleware.PresaleAudit(), presaleHandler.UpdateReferralPct)
    op.POST("/deposits/:txHash/migrate-round", middleware.PresaleAudit(), presaleHandler.MigrateRound)

    // anomaly/resolve：customer_service+（client_service 也可处理）
    csResolve := presale.Group("", middleware.RoleRequired(
        "customer_service", "operator", "super_admin"))
    csResolve.POST("/anomaly/:id/resolve", middleware.PresaleAudit(), presaleHandler.ResolveAnomaly)

    // 高敏：super_admin only
    sa := presale.Group("", middleware.RoleRequired("super_admin"))
    sa.PATCH("/rounds/:id", middleware.PresaleAudit(), presaleHandler.UpdateRound)
    sa.PATCH("/config", middleware.PresaleAudit(), presaleHandler.UpdateConfig)
}
```

---

## 3 Migration

### `migrations/0002_create_presale_admin_audit.sql`

```sql
-- 预售运营操作审计表（admin-backend 专属）
-- 业务表 migration（presale_round / presale_deposit 等）在 web-api 仓库
CREATE TABLE `presale_admin_audit` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `operator`      VARCHAR(64)     NOT NULL COMMENT 'admin_user.lark_user_id 或 script:filename',
  `operator_role` VARCHAR(32)     NULL     COMMENT 'super_admin/operator/customer_service/finance/script',
  `action`        VARCHAR(48)     NOT NULL COMMENT 'pause/resume/reopen/close/update_round/update_config/anomaly_resolve/migrate_round_id',
  `target_type`   VARCHAR(32)     NOT NULL COMMENT 'round/deposit/config/anomaly',
  `target_id`     VARCHAR(64)     NOT NULL,
  `before_json`   TEXT            NULL     COMMENT '变更前快照 JSON',
  `after_json`    TEXT            NULL     COMMENT '变更后快照 JSON',
  `source`        VARCHAR(16)     NOT NULL DEFAULT 'api' COMMENT 'api/script',
  `ip`            VARCHAR(64)     NULL     COMMENT '仅 api 来源有值',
  `note`          TEXT            NOT NULL COMMENT '操作人必填备注（≥10字符）',
  `created_at`    BIGINT          NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_operator_ts` (`operator`, `created_at`),
  KEY `idx_target` (`target_type`, `target_id`),
  KEY `idx_action_ts` (`action`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='运营操作审计（admin-backend，DB 层只授 INSERT）';

-- 回滚：DROP TABLE presale_admin_audit;
```

> **DB 权限约定**：生产环境 admin-backend 数据库用户仅被授予此表的 `INSERT + SELECT` 权限，**不授 UPDATE / DELETE**，保证审计不可篡改。

---

## 4 Model 定义

admin-backend 的 model 与 web-api 保持语义一致，独立维护（不跨仓库引用）。

```go
// internal/model/presale_round.go
type PresaleRound struct {
    ID                 string          `gorm:"primarykey;column:id"`
    Name               string          `gorm:"column:name"`
    RoundType          string          `gorm:"column:round_type"`
    PriceUsd           decimal.Decimal `gorm:"column:price_usd;type:DECIMAL(38,18)"`
    SupplyOdd          decimal.Decimal `gorm:"column:supply_odd;type:DECIMAL(38,18)"`
    SoldOdd            decimal.Decimal `gorm:"column:sold_odd;type:DECIMAL(38,18)"`
    RaisedUsd          decimal.Decimal `gorm:"column:raised_usd;type:DECIMAL(38,18)"`
    TargetRaiseUsd     decimal.Decimal `gorm:"column:target_raise_usd;type:DECIMAL(38,18)"`
    MinPerOrderUsd     *decimal.Decimal `gorm:"column:min_per_order_usd"`
    MaxPerWalletUsd    *decimal.Decimal `gorm:"column:max_per_wallet_usd"`
    ReferralRewardPct  decimal.Decimal `gorm:"column:referral_reward_pct;type:DECIMAL(10,4)"`
    StartTs            int64           `gorm:"column:start_ts"`
    EndTs              int64           `gorm:"column:end_ts"`
    Status             string          `gorm:"column:status"` // upcoming/active/paused/ended
    ManualOverride     bool            `gorm:"column:manual_override"`
    Badge              *string         `gorm:"column:badge"`
    SortOrder          int             `gorm:"column:sort_order"`
    CreatedAt          int64           `gorm:"column:created_at;autoCreateTime:milli"`
    UpdatedAt          int64           `gorm:"column:updated_at;autoUpdateTime:milli"`
}

func (PresaleRound) TableName() string { return "presale_round" }

// internal/model/presale_admin_audit.go
type PresaleAdminAudit struct {
    ID           uint64  `gorm:"primarykey;column:id"`
    Operator     string  `gorm:"column:operator"`
    OperatorRole string  `gorm:"column:operator_role"`
    Action       string  `gorm:"column:action"`
    TargetType   string  `gorm:"column:target_type"`
    TargetID     string  `gorm:"column:target_id"`
    BeforeJSON   *string `gorm:"column:before_json"`
    AfterJSON    *string `gorm:"column:after_json"`
    Source       string  `gorm:"column:source"` // api/script
    IP           *string `gorm:"column:ip"`
    Note         string  `gorm:"column:note"`
    CreatedAt    int64   `gorm:"column:created_at;autoCreateTime:milli"`
}

func (PresaleAdminAudit) TableName() string { return "presale_admin_audit" }
```

---

## 5 Audit Middleware 设计

### 5.1 核心原理

`PresaleAudit()` 是装饰器中间件，包裹所有 mutate 接口（POST/PATCH）：

1. **before snapshot**：handler 执行前，根据请求参数取当前目标的 JSON 快照（GET target）
2. **执行 handler**：Gin `c.Next()`，handler 在同一事务内完成数据变更
3. **after snapshot**：从 `c.Get("audit_after")` 取 handler 写入的 after 快照
4. **INSERT audit**：在与 handler 同一 DB 事务内写 `presale_admin_audit`
5. **提交或回滚**：整体提交；任何环节失败回滚整个请求

```go
// internal/middleware/presale_audit.go

// PresaleAudit 为所有 mutate 类预售接口自动写 presale_admin_audit。
// 使用方式：在路由注册时链入此中间件，handler 内通过 c.Set("audit_*") 传递快照。
func PresaleAudit() gin.HandlerFunc {
    return func(c *gin.Context) {
        // 从 JWT context 取操作人信息
        operator, _ := c.Get("admin_user_id")
        role, _ := c.Get("role")
        ip := c.ClientIP()

        // 强制校验 note 字段（≥10 字符）
        var req struct {
            Note string `json:"note"`
        }
        // 先 Peek body，不消费（通过 c.ShouldBindBodyWith 实现）
        if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil || len([]rune(req.Note)) < 10 {
            response.BadRequest(c, errcode.NoteRequired, "note 字段必填且不少于10字符")
            c.Abort()
            return
        }

        // 开启共享事务，注入到 context 供 handler / repository 复用
        tx := db.Begin()
        c.Set("db_tx", tx)

        // 执行 handler（含业务逻辑 + 写入 audit_before / audit_after）
        c.Next()

        // handler 出错时 tx 已在 handler 内 Rollback，此处检查即可
        if len(c.Errors) > 0 || c.IsAborted() {
            tx.Rollback()
            return
        }

        // 从 context 取 handler 设置的审计快照
        targetType, _ := c.Get("audit_target_type")
        targetID, _ := c.Get("audit_target_id")
        action, _ := c.Get("audit_action")
        beforeJSON, _ := c.Get("audit_before")
        afterJSON, _ := c.Get("audit_after")

        before := toJSONPtr(beforeJSON)
        after := toJSONPtr(afterJSON)

        audit := &model.PresaleAdminAudit{
            Operator:     fmt.Sprintf("%v", operator),
            OperatorRole: fmt.Sprintf("%v", role),
            Action:       fmt.Sprintf("%v", action),
            TargetType:   fmt.Sprintf("%v", targetType),
            TargetID:     fmt.Sprintf("%v", targetID),
            BeforeJSON:   before,
            AfterJSON:    after,
            Source:       "api",
            IP:           &ip,
            Note:         req.Note,
            CreatedAt:    time.Now().UnixMilli(),
        }

        // 在同一事务内 INSERT audit（失败则整体回滚）
        if err := tx.Create(audit).Error; err != nil {
            tx.Rollback()
            response.InternalError(c, "audit 写入失败，请求已回滚")
            return
        }

        tx.Commit()
    }
}
```

### 5.2 Handler 内设置审计快照

```go
// internal/handler/presale_round.go — PauseRound 示例
func (h *PresaleRoundHandler) PauseRound(c *gin.Context) {
    id := c.Param("id")
    tx, _ := c.Get("db_tx")

    // 取 before 快照
    round, err := h.svc.GetRound(tx.(*gorm.DB), id)
    if err != nil {
        response.NotFound(c, errcode.RoundNotFound, "轮次不存在")
        return
    }
    beforeJSON, _ := json.Marshal(round)
    c.Set("audit_before", string(beforeJSON))
    c.Set("audit_target_type", "round")
    c.Set("audit_target_id", id)
    c.Set("audit_action", "pause")

    // 执行状态机变更
    updated, err := h.svc.PauseRound(tx.(*gorm.DB), id)
    if err != nil {
        // 错误已通过 c.Errors 传递给 middleware 做回滚
        response.Conflict(c, errcode.InvalidStateTransition, err.Error())
        return
    }

    afterJSON, _ := json.Marshal(updated)
    c.Set("audit_after", string(afterJSON))

    response.OK(c, gin.H{
        "roundId":        updated.ID,
        "previousStatus": round.Status,
        "currentStatus":  updated.Status,
        "manualOverride": updated.ManualOverride,
        "operator":       c.GetString("admin_user_id"),
        "pausedAt":       updated.UpdatedAt,
    })
}
```

---

## 6 关键接口实现细节

### 6.1 Pause / Resume / Reopen / Close — 状态机校验

```go
// internal/service/presale_round.go

// 合法状态转换表
var validTransitions = map[string][]string{
    "pause":  {"active"},            // active → paused
    "resume": {"paused"},            // paused → active
    "reopen": {"ended"},             // ended  → active（manual_override=1，end_ts 不动）
    "close":  {"active", "paused"},  // 任意非 ended → ended
}

func (s *PresaleRoundService) PauseRound(tx *gorm.DB, id string) (*model.PresaleRound, error) {
    return s.applyTransition(tx, id, "pause", "paused")
}

func (s *PresaleRoundService) applyTransition(
    tx *gorm.DB, id, action, targetStatus string,
) (*model.PresaleRound, error) {
    round, err := s.repo.GetForUpdate(tx, id) // SELECT ... FOR UPDATE 防并发
    if err != nil {
        return nil, err
    }

    allowed := validTransitions[action]
    if !slices.Contains(allowed, round.Status) {
        return nil, fmt.Errorf("INVALID_STATE_TRANSITION: %s 不允许从 %s 转换", action, round.Status)
    }

    now := time.Now().UnixMilli()
    updates := map[string]any{
        "status":          targetStatus,
        "manual_override": true,
        "updated_at":      now,
    }
    if err := tx.Model(round).Updates(updates).Error; err != nil {
        return nil, err
    }
    round.Status = targetStatus
    round.ManualOverride = true
    round.UpdatedAt = now
    return round, nil
}
```

### 6.2 migrate-round — Holding 回滚 + 重算事务

完整流程对应 [03-admin-api-contract.md §5.8](../03-admin-api-contract.md)。

```go
// internal/service/presale_deposit.go

func (s *PresaleDepositService) MigrateRound(
    tx *gorm.DB, txHash, targetRoundID, note string,
) (*model.PresaleDeposit, error) {
    // 1. 取 deposit，加行锁
    dep, err := s.depRepo.GetByTxHashForUpdate(tx, txHash)
    if err != nil || dep.Status != "confirmed" {
        return nil, errors.New("deposit 不存在或状态非 confirmed")
    }

    // 2. 校验目标轮次存在
    target, err := s.roundRepo.GetByID(tx, targetRoundID)
    if err != nil {
        return nil, errors.New("INVALID_TARGET_ROUND: 目标轮次不存在")
    }

    // 3. 校验 block_timestamp ∈ [target.start_ts - tolerance, target.end_ts + tolerance]
    tolerance := int64(s.cfg.BoundaryToleranceMin) * 60 * 1000
    if dep.BlockTimestamp < target.StartTs-tolerance || dep.BlockTimestamp > target.EndTs+tolerance {
        return nil, errors.New("BLOCK_TIMESTAMP_NOT_IN_TARGET_ROUND: 区块时间不在目标轮次范围内")
    }

    oldRoundID := dep.RoundID
    oldShares := dep.SharesOdd
    oldReward := dep.ReferralRewardOdd

    // 4. 用目标轮次价格重算份额
    newShares := dep.AmountUsdt.Div(target.PriceUsd)
    var newReward decimal.Decimal
    if dep.ReferrerUserID != nil {
        newReward = newShares.Mul(target.ReferralRewardPct).Div(decimal.NewFromInt(100))
    }

    // 5. 回滚旧轮次 holding（减去旧份额）
    if err := s.holdingRepo.SubtractInvest(tx, dep.UserID, oldRoundID, oldShares, dep.AmountUsdt); err != nil {
        return nil, fmt.Errorf("回滚旧轮次 holding 失败: %w", err)
    }
    if dep.ReferrerUserID != nil {
        if err := s.holdingRepo.SubtractReferral(tx, *dep.ReferrerUserID, oldRoundID, oldReward); err != nil {
            return nil, fmt.Errorf("回滚旧轮次 referral holding 失败: %w", err)
        }
    }

    // 6. 应用新轮次 holding（加上新份额）
    if err := s.holdingRepo.UpsertInvest(tx, dep.UserID, targetRoundID, newShares, dep.AmountUsdt, target.PriceUsd); err != nil {
        return nil, fmt.Errorf("应用新轮次 holding 失败: %w", err)
    }
    if dep.ReferrerUserID != nil {
        if err := s.holdingRepo.UpsertReferral(tx, *dep.ReferrerUserID, targetRoundID, newReward); err != nil {
            return nil, fmt.Errorf("应用新轮次 referral holding 失败: %w", err)
        }
    }

    // 7. 更新 deposit
    now := time.Now().UnixMilli()
    if err := tx.Model(dep).Updates(map[string]any{
        "round_id":             targetRoundID,
        "price_usd":            target.PriceUsd,
        "shares_odd":           newShares,
        "referral_reward_odd":  newReward,
        "referral_reward_pct":  target.ReferralRewardPct,
        "updated_at":           now,
    }).Error; err != nil {
        return nil, err
    }

    // 8. 非阻塞 Lark 通知（goroutine，不影响事务）
    go s.lark.NotifyMigrateRound(dep.TxHash, oldRoundID, targetRoundID)

    return dep, nil
}
```

### 6.3 PATCH /config — vault_address 修改返提示重启 Worker

对应 [03-admin-api-contract.md §5.7](../03-admin-api-contract.md)。

```go
// internal/service/presale_config.go

type UpdateConfigResult struct {
    Config  *model.PresaleConfig
    Warning string // 非空时前端展示
}

func (s *PresaleConfigService) UpdateConfig(
    tx *gorm.DB, req *UpdateConfigRequest,
) (*UpdateConfigResult, error) {
    cfg, err := s.repo.GetForUpdate(tx)
    if err != nil {
        return nil, err
    }

    updates := map[string]any{"updated_at": time.Now().UnixMilli()}
    var warning string

    if req.VaultAddress != nil {
        if !isValidEthAddress(*req.VaultAddress) {
            return nil, errors.New("VAULT_ADDRESS_INVALID: 地址格式不合法")
        }
        updates["vault_address"] = strings.ToLower(*req.VaultAddress)
        // vault_address 变更必须提示运营同步 env + 重启 worker
        warning = fmt.Sprintf(
            "vault_address 已更新到 %s，但 env PRESALE_VAULT_POOL 仍需同步且重启 presale-worker 进程后才会生效。"+
                "监听器扫到老地址的入账时仍按 vault_address 快照入账（多地址池支持）。",
            *req.VaultAddress,
        )
    }
    // ... 其他字段更新

    if err := tx.Model(cfg).Updates(updates).Error; err != nil {
        return nil, err
    }
    return &UpdateConfigResult{Config: cfg, Warning: warning}, nil
}
```

### 6.4 anomaly/resolve — 3 种 Resolution 路由

对应 [03-admin-api-contract.md §5.9](../03-admin-api-contract.md)。

```go
// internal/service/presale_anomaly.go

type Resolution string

const (
    ResolutionConvertToDeposit Resolution = "convert_to_deposit"
    ResolutionPartialCredit    Resolution = "partial_credit"
    ResolutionReject           Resolution = "reject"
)

func (s *PresaleAnomalyService) Resolve(
    tx *gorm.DB, id uint64, req *ResolveRequest, operatorID string,
) error {
    event, err := s.repo.GetForUpdate(tx, id)
    if err != nil {
        return errors.New("ANOMALY_NOT_FOUND")
    }
    // 只允许处理 pending / notified 状态
    if event.Status != "pending" && event.Status != "notified" {
        return errors.New("INVALID_STATE_TRANSITION: 事件已处理")
    }

    switch Resolution(req.Resolution) {
    case ResolutionConvertToDeposit:
        // 将异常事件落成正式 presale_deposit
        if err := s.convertToDeposit(tx, event, req.TargetRoundID); err != nil {
            return fmt.Errorf("convert_to_deposit 失败: %w", err)
        }

    case ResolutionPartialCredit:
        // 部分入账：overflow 场景，超出部分标记 partial_overflow 挂账
        if err := s.partialCredit(tx, event); err != nil {
            return fmt.Errorf("partial_credit 失败: %w", err)
        }

    case ResolutionReject:
        // 拒绝处理（用户撤回 / 已退款），仅更新 ops_event 状态
        // 不改动 presale_deposit（已是 anomaly 状态保持不变）

    default:
        return errors.New("INVALID_RESOLUTION: 不支持的处理方式")
    }

    now := time.Now().UnixMilli()
    return tx.Model(event).Updates(map[string]any{
        "status":       "resolved",
        "resolved_by":  operatorID,
        "resolved_at":  now,
        "resolve_note": req.Note,
        "updated_at":   now,
    }).Error
}
```

---

## 7 限流配置

| 接口组 | 限流 | 说明 |
|---|---|---|
| 全部 admin 接口（默认） | 60/min | 复用现有 admin-backend 限流器 |
| `PATCH /config` | 10/min | 高敏接口 |
| `POST .../migrate-round` | 10/min | 高敏接口 |
| `PATCH /rounds/:id` | 10/min | 高敏接口 |

```go
// router.go 高敏接口注册示例
sa.PATCH("/config",
    middleware.RateLimitN(10),  // 覆盖 default 60/min
    middleware.PresaleAudit(),
    presaleHandler.UpdateConfig)
```

---

## 8 docs/presale-admin/README.md（契约镜像）

此文件由 agent B 维护，**内容同步自 [03-admin-api-contract.md](../03-admin-api-contract.md)**，额外补充 curl 示例：

```bash
# 暂停轮次
curl -X POST https://admin.oddfi.io/admin/presale/rounds/strategic/pause \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"note":"插入种子轮回退，临时暂停战略轮"}'

# 迁移 round_id
curl -X POST https://admin.oddfi.io/admin/presale/deposits/0xabc.../migrate-round \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"targetRoundId":"seed","note":"用户投诉边界切轮，按种子轮重算"}'

# 处理异常（转单）
curl -X POST https://admin.oddfi.io/admin/presale/anomaly/42/resolve \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"resolution":"convert_to_deposit","targetRoundId":"seed","note":"用户联系客服确认，绕前端直转"}'
```

---

## 9 DoD（Definition of Done）

| 检查项 | 负责 |
|---|---|
| 所有 17 个接口契约对齐 [03-admin-api-contract.md](../03-admin-api-contract.md)，curl 全部 2xx | Agent A + B |
| RBAC 4 角色 × 17 接口 table-driven 测试覆盖，禁止越权访问 | Agent B |
| audit 中间件单测：before/after JSON 正确 / note < 10 字符被拒 / 事务失败自动回滚 | Agent B |
| `docs/presale-admin/README.md` 与 03-admin-api-contract.md 保持同步 | Agent B |
| `.claude/rules/rbac.md` 预售路径权限矩阵追加完毕 | Agent B |
| `migrations/0002_create_presale_admin_audit.sql` 可在 dev DB 执行并回滚 | Agent A |
| `migrate-round` 事务：holding 回滚 + 重算 + 幂等（同笔 txHash 跑两次不重复入账） | Agent A |
| `anomaly/resolve` 3 种 resolution 各有集成测试 | Agent A |
| go vet / go build 无报错 | Agent A + B |
| dev 环境联调：用 `cmd/dev-token/` 生成各角色 token，逐一验证接口 + RBAC | Agent A + B |

---

## 10 Task Prompt

### Task Prompt for Agent A（handler / service / repository）

```
你是 Agent A，负责 oddfi-admin-backend 仓库 B3 batch 的业务逻辑层实现。

工作目录：/Users/hang/work/oddfi-admin-backend/.claude/worktrees/presale-admin
仓库：oddfi-admin-backend，分支：feat/presale-admin

**必读文档**：
- web-api/docs/dd-invest/03-admin-api-contract.md（接口契约源真值）
- web-api/docs/dd-invest/01-data-model.md §3.9（presale_admin_audit schema）
- oddfi-admin-backend/ARCHITECTURE.md（现有架构 + 模式）
- oddfi-admin-backend/.claude/rules/rbac.md（RBAC 4 角色规则）

**你的文件边界**（只改这些）：
- migrations/0002_create_presale_admin_audit.sql
- internal/model/presale_*.go（5 个 model 文件）
- internal/repository/presale_*.go（5 个 repository 文件）
- internal/service/presale_*.go（5 个 service 文件）
- internal/handler/presale_*.go（5 个 handler 文件）

**不动**：router.go / middleware/ / .claude/rules/ / docs/

**关键约束**：
1. 金额字段一律用 shopspring/decimal，不用 float64
2. 所有 mutate 操作必须在 tx（*gorm.DB）内完成，tx 从 c.Get("db_tx") 取
3. audit 的 before/after JSON 通过 c.Set("audit_before"/"audit_after") 传给 middleware
4. 状态机校验见 B3-admin.md §6.1，合法转换表需严格遵守
5. migrate-round：校验 block_timestamp ∈ [target.start_ts - tolerance, target.end_ts + tolerance]
6. anomaly/resolve 3 种 resolution：convert_to_deposit / partial_credit / reject
7. 中文注释覆盖所有业务逻辑；zerolog 日志字段用 snake_case
8. go vet 通过后再提交

**测试要求**：
- service/presale_round_test.go：状态机合法/非法转换 table-driven
- service/presale_deposit_test.go：migrate-round 主流程 + block_timestamp 越界拒绝
- service/presale_anomaly_test.go：3 种 resolution 各一 case

完成后在 worktree 内 git commit（简体中文 commit message，禁 Co-Authored-By），通知 Agent B 可以集成 handler 依赖。
```

### Task Prompt for Agent B（middleware + router + docs + RBAC）

```
你是 Agent B，负责 oddfi-admin-backend 仓库 B3 batch 的中间件、路由、RBAC 更新和文档镜像。

等待 Agent A 完成 handler 函数签名后再写 router 集成（可先写 middleware + rbac.md + docs）。

工作目录：/Users/hang/work/oddfi-admin-backend/.claude/worktrees/presale-admin
仓库：oddfi-admin-backend，分支：feat/presale-admin

**你的文件边界**（只改这些）：
- internal/middleware/presale_audit.go（audit 中间件）
- internal/router/router.go（注册路由组）
- .claude/rules/rbac.md（追加预售路径权限映射）
- docs/presale-admin/README.md（接口契约镜像 + curl 示例）

**不动**：handler/ / service/ / repository/ / model/ / migrations/

**关键约束**：
1. PresaleAudit() middleware 负责：body peek 校验 note（≥10字符）/ 开共享 tx 注入 c.Set("db_tx") / c.Next() / INSERT audit / Commit or Rollback
2. 路由组权限见 B3-admin.md §2（RBAC 矩阵）；严格按 RoleRequired(allow...) 注册，super_admin 不自动通过
3. 高敏接口（PATCH /config / migrate-round / PATCH /rounds）额外套 RateLimitN(10)
4. rbac.md 追加预售路径权限映射表（7 行），不改现有内容
5. docs/presale-admin/README.md 同步 03-admin-api-contract.md 全部内容 + 补 curl 示例

**测试要求**：
- middleware/presale_audit_test.go：
  - note 空 / <10 字符 → 400 NoteRequired
  - handler 错误时 tx 回滚，audit 不写入
  - 正常流程 audit 写入正确 before/after JSON

- RBAC table-driven（复用现有 rbac_test.go 风格）：
  各角色 × 17 接口 = 68 case，验证 200 vs 403 符合矩阵

完成后 git commit + merge Agent A 的提交，push feat/presale-admin，发 PR。
```
