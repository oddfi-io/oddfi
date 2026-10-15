# 预售运营后台 · admin-backend 实施指南

> **契约源真值**：`oddfi-backend/web-api/docs/dd-invest/03-admin-api-contract.md`（upstream DD V3）
> **本文档定位**：admin-backend 仓库侧的**下游实施文档**，包含 RBAC 矩阵、完整接口契约、curl 示例、代码结构指南。
> 与上游 DD 出现冲突时，以上游 DD 为准；实施细节（文件路径、中间件设计）本文档优先。

---

## 1 引言

本文档是 `oddfi-admin-backend` 仓库实施**预售运营后台**（`/admin/presale/*`）的入口。

所有预售 admin 接口遵循现有 admin-backend 规范：

- **鉴权**：Lark OAuth + JWT（`AdminAuthMiddleware`，`Authorization: Bearer <token>`）
- **RBAC**：4 角色（`super_admin / operator / customer_service / finance`），`middleware.RoleRequired(...)` 声明
- **限流**：default 60/min；高敏接口 10/min（`PATCH /config`、`migrate-round`、`PATCH /rounds/:id`）
- **响应格式**：`{ "code": 0, "message": "ok", "data": {...} }`（沿用现有 `pkg/response` 封装）
- **audit**：所有 mutate 接口通过 `presale_audit` middleware 自动落 `presale_admin_audit` 表

**数据库策略**：admin-backend 直接 GORM 操作共享 MySQL 的 `presale_*` 表，**不走 web-api HTTP 接口**（沿用"避免循环依赖"原则，参考现有 `admin_users.go` repository 模式）。

---

## 2 RBAC 角色矩阵

### 2.1 现有 4 角色

```
super_admin > operator > customer_service > finance
```

### 2.2 预售接口权限映射

| 操作类型 | 接口 | 最低角色 |
|---|---|---|
| 查看轮次列表 / 详情 | `GET /admin/presale/rounds` / `GET /admin/presale/rounds/:id` | `customer_service` |
| 查看入账记录 / 详情 | `GET /admin/presale/deposits` / `GET /admin/presale/deposits/:txHash` | `customer_service` |
| 查看异常事件列表 / 详情 | `GET /admin/presale/anomaly` / `GET /admin/presale/anomaly/:id` | `customer_service` |
| 查看全局配置 | `GET /admin/presale/config` | `customer_service` |
| 查看 audit 日志 | `GET /admin/presale/audit` | `customer_service` |
| 轮次状态机操作（pause/resume/reopen/close） | `POST /admin/presale/rounds/:id/{pause,resume,reopen,close}` | `operator` |
| 改 referral_reward_pct | `PATCH /admin/presale/rounds/:id/referral-pct` | `operator` |
| 入账迁移轮次 | `POST /admin/presale/deposits/:txHash/migrate-round` | `operator` |
| 处理异常事件 | `POST /admin/presale/anomaly/:id/resolve` | `customer_service` |
| 改 round 字段（价格/supply/时间窗） | `PATCH /admin/presale/rounds/:id` | `super_admin` |
| 改金库地址 / TGE / tge_open_price_usd | `PATCH /admin/presale/config` | `super_admin` |

> `finance` 角色本期暂无预售相关 grant；退款链路（如启用）后续落 `finance`。
>
> 以上矩阵须同步更新到 `.claude/rules/rbac.md`（预售路径权限映射章节）。

---

## 3 接口清单

| 方法 | 路径 | RBAC | 是否 mutate | 用途 |
|---|---|---|---|---|
| GET | `/admin/presale/rounds` | customer_service+ | 否 | 列出全部轮次 |
| GET | `/admin/presale/rounds/:id` | customer_service+ | 否 | 单轮次详情 |
| PATCH | `/admin/presale/rounds/:id` | super_admin | 是 | 改 round 字段 |
| POST | `/admin/presale/rounds/:id/pause` | operator+ | 是 | 暂停 active 轮次 |
| POST | `/admin/presale/rounds/:id/resume` | operator+ | 是 | 恢复 paused 轮次 |
| POST | `/admin/presale/rounds/:id/reopen` | operator+ | 是 | 重开 ended 轮次 |
| POST | `/admin/presale/rounds/:id/close` | operator+ | 是 | 手动关闭轮次 |
| PATCH | `/admin/presale/rounds/:id/referral-pct` | operator+ | 是 | 改 referral_reward_pct |
| GET | `/admin/presale/config` | customer_service+ | 否 | 全局配置 |
| PATCH | `/admin/presale/config` | super_admin | 是 | 改金库 / TGE / 基准价 |
| GET | `/admin/presale/deposits` | customer_service+ | 否 | 入账列表（分页） |
| GET | `/admin/presale/deposits/:txHash` | customer_service+ | 否 | 单笔入账详情 |
| POST | `/admin/presale/deposits/:txHash/migrate-round` | operator+ | 是 | 迁移轮次归属 |
| GET | `/admin/presale/anomaly` | customer_service+ | 否 | 异常事件列表 |
| GET | `/admin/presale/anomaly/:id` | customer_service+ | 否 | 单条异常详情 |
| POST | `/admin/presale/anomaly/:id/resolve` | customer_service+ | 是 | 处理异常事件 |
| GET | `/admin/presale/audit` | customer_service+ | 否 | 操作审计日志 |

---

## 4 接口契约详情

### 4.1 公共约定

**所有 mutate 类接口**必须携带 `note` 字段（≥ 10 字符）：

```json
{ "note": "操作原因，至少 10 字符，会落 audit" }
```

- 空 note 或长度不足 → `400 { code: "NOTE_REQUIRED", message: "..." }`
- `presale_audit` middleware 在事务前后自动写 `presale_admin_audit`，handler 无需手动调用
- 高敏接口限流 10/min：`PATCH /config`、`POST .../migrate-round`、`PATCH /rounds/:id`

**错误码字典**（按 web-api 源码 `gin.H{"code": "..."}` 真值整理，统一字符串码）：

| HTTP | code | 含义 |
|---|---|---|
| 400 | `INVALID_BODY` | 请求体解析失败 |
| 400 | `INVALID_PARAM` | 参数校验失败（含 vault 地址非法、supply<sold、金额格式错误等通用入参错误） |
| 400 | `NOTE_REQUIRED` | 备注缺失或长度不足（≥ 10 字符） |
| 400 | `INVALID_RESOLUTION` | `anomaly/resolve` 传入的 resolution 不在 enum |
| 400 | `IDEMPOTENCY_KEY_REQUIRED` | 缺少 `Idempotency-Key` 请求头 |
| 403 | `INSUFFICIENT_ROLE` | 角色权限不足 |
| 403 | `SERVICE_SIG_INVALID` | 服务间签名失败（admin-backend ↔ web-api） |
| 404 | `ROUND_NOT_FOUND` / `DEPOSIT_NOT_FOUND` / `ANOMALY_NOT_FOUND` | 资源不存在 |
| 404 | `TARGET_ROUND_NOT_FOUND` | `migrate-round` / `anomaly/resolve` 指定的目标轮次不存在 |
| 409 | `INVALID_STATE_TRANSITION` | 状态机非法切换 |
| 409 | `IDEMPOTENCY_BODY_MISMATCH` | 相同 `Idempotency-Key` 二次请求 body 不一致 |
| 422 | `MIGRATE_LIMIT_EXCEEDED` | 单笔 deposit 迁移次数已达上限（≥ 3） |
| 422 | `BLOCK_TIMESTAMP_OUT_OF_RANGE` | `block_timestamp` 不在目标轮次容差范围内 |
| 500 | `INTERNAL_ERROR` / `NO_TX` | 服务内部错误（不应出现，出现需立即查日志） |

---

### 4.2 `POST /admin/presale/rounds/:id/pause`

暂停 active 轮次。pause 不阻止链上到账（pause 期间入账走 `paused_arrival` 信息流）。

**请求**

```json
{ "note": "插入种子轮回退，临时暂停战略轮" }
```

**响应**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "roundId": "strategic",
    "previousStatus": "active",
    "currentStatus": "paused",
    "manualOverride": true,
    "operator": "lark_user_id_xxx",
    "pausedAt": 1747900000000
  }
}
```

**curl 示例**

```bash
curl -X POST https://admin.oddfi.io/admin/presale/rounds/strategic/pause \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"note": "插入种子轮回退，临时暂停战略轮"}'
```

**后端动作**（事务内）：

1. 取 round，校验 `status ∈ {active}`（否则 `INVALID_STATE_TRANSITION`）
2. UPDATE `status=paused`、`manual_override=1`、`updated_at`
3. `presale_audit` middleware 写 audit：`action=pause, target=round:strategic, before={status:active}, after={status:paused}`
4. 非阻塞 Lark webhook 通知运营群

---

### 4.3 `POST /admin/presale/rounds/:id/resume`

恢复 paused 轮次。

**curl 示例**

```bash
curl -X POST https://admin.oddfi.io/admin/presale/rounds/strategic/resume \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"note": "种子轮回退完成，战略轮恢复开放"}'
```

校验：`status ∈ {paused}`，更新 `status=active`、`manual_override=1`。

---

### 4.4 `POST /admin/presale/rounds/:id/reopen`

重开已结束的轮次（大客户补仓、运营临时插入场景）。

**curl 示例**

```bash
curl -X POST https://admin.oddfi.io/admin/presale/rounds/seed/reopen \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"note": "大客户 X 想补种子轮份额，临时 reopen"}'
```

**后端动作**：

1. 校验 `status = ended`（否则 `INVALID_STATE_TRANSITION`）
2. UPDATE `status=active`、`manual_override=1`，`end_ts` **不动**
3. cron 因 `manual_override=1` 不会自动再推回 ended
4. 运营补完后必须显式 `POST .../close`

---

### 4.5 `POST /admin/presale/rounds/:id/close`

手动关闭轮次（reopen 后回收，或 active 期间提前关闭）。

**curl 示例**

```bash
curl -X POST https://admin.oddfi.io/admin/presale/rounds/seed/close \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"note": "种子轮补仓完成，手动关闭"}'
```

校验：`status ∈ {active, paused}`，更新 `status=ended`、`manual_override=1`。

---

### 4.6 `PATCH /admin/presale/rounds/:id`

改 round 字段。`super_admin` 专属，字段全部可选。

**请求**

```json
{
  "priceUsd": "0.04",
  "supplyOdd": "12000000",
  "endTs": 1749800000000,
  "minPerOrderUsd": "100",
  "maxPerWalletUsd": "100000",
  "tgeReleasePct": 15,
  "linearReleaseDays": 90,
  "note": "PRD V3 调整种子轮供给"
}
```

**curl 示例**

```bash
curl -X PATCH https://admin.oddfi.io/admin/presale/rounds/seed \
  -H "Authorization: Bearer $SUPER_ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "priceUsd": "0.04",
    "supplyOdd": "12000000",
    "note": "PRD V3 调整种子轮供给"
  }'
```

**校验**：`price > 0`、`supply > 0`、`end_ts > start_ts`；若 `supply < sold_odd` → `INVALID_PARAM`。`referral_reward_pct` 走单独接口。

---

### 4.7 `PATCH /admin/presale/rounds/:id/referral-pct`

改邀请奖励比例。`operator+` 可改，不影响历史已入账的 deposit（快照值独立）。

**curl 示例**

```bash
curl -X PATCH https://admin.oddfi.io/admin/presale/rounds/seed/referral-pct \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"referralRewardPct": "12.5000", "note": "种子轮大客户邀请活动，提高返佣至 12.5%"}'
```

---

### 4.8 `GET /admin/presale/config` / `PATCH /admin/presale/config`

全局配置读写。PATCH 字段全部可选，`vault_address` 改完响应附带 warning 提示。

**PATCH 请求**

```json
{
  "tgeTs": 1749571200000,
  "tgeOpenPriceUsd": "0.1",
  "vaultAddress": "0xNEW_VAULT...",
  "minSubscribeUsd": "1000",
  "boundaryToleranceMin": 5,
  "totalTargetUsd": "20000000",
  "auditLabel": "CertiK",
  "larkWebhookUrl": "https://open.larksuite.com/...",
  "note": "金库切换：从 0xOLD 切换到 0xNEW，multisig 重新生成"
}
```

**curl 示例（改 TGE 时间）**

```bash
curl -X PATCH https://admin.oddfi.io/admin/presale/config \
  -H "Authorization: Bearer $SUPER_ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "tgeTs": 1749571200000,
    "note": "TGE 延期至 2026-06-10 00:00 UTC+8"
  }'
```

**curl 示例（改金库地址）**

```bash
curl -X PATCH https://admin.oddfi.io/admin/presale/config \
  -H "Authorization: Bearer $SUPER_ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "vaultAddress": "0xNEW_VAULT_ADDR",
    "note": "金库切换：multisig 重新生成，需同步 env PRESALE_VAULT_POOL 并重启 presale-worker"
  }'
```

**响应（改 vault_address 时）**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "warning": "vault_address 已更新到 0xNEW...，但 env PRESALE_VAULT_POOL 仍需同步且重启 presale-worker 进程后才会生效。监听器扫到老地址的入账时仍按 vault_address 快照入账（多地址池支持）。"
  }
}
```

---

### 4.9 `GET /admin/presale/deposits`

入账记录分页查询。

**query 参数**：`round_id` / `eoa_address` / `status` / `vault_address` / `from_ts` / `to_ts` / `page`（默认 1）/ `size`（默认 20，最大 100）

**curl 示例**

```bash
curl "https://admin.oddfi.io/admin/presale/deposits?round_id=public_a&status=anomaly&page=1&size=20" \
  -H "Authorization: Bearer $JWT"
```

---

### 4.10 `POST /admin/presale/deposits/:txHash/migrate-round`

把一笔已 confirmed deposit 从轮次 A 迁移到轮次 B（修订边界切轮错误归属）。

**请求**

```json
{
  "targetRoundId": "seed",
  "note": "用户 0xUSR... 投诉边界切轮，原入战略轮，按种子轮重算"
}
```

**curl 示例**

```bash
curl -X POST "https://admin.oddfi.io/admin/presale/deposits/0xABC.../migrate-round" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "targetRoundId": "seed",
    "note": "用户 0xUSR 投诉边界切轮，原入战略轮，按种子轮重算"
  }'
```

**后端动作**（事务内，7 步）：

1. 取 deposit，校验 `status = confirmed`
2. 校验 `targetRoundId` 存在
3. 校验 `block_timestamp ∈ [target.start_ts - 容差, target.end_ts + 容差]`（否则 `422 BLOCK_TIMESTAMP_OUT_OF_RANGE`）；目标轮次不存在 → `404 TARGET_ROUND_NOT_FOUND`
4. 取 target round 价格，重算 `shares_odd` / `referral_reward_odd`
5. 回滚旧轮次 holding（减量 + 重算 `locked_price_avg`）
6. 应用新轮次 holding（upsert）
7. 同理处理 referral holding；更新 deposit 字段；写 audit；非阻塞 Lark 通知

---

### 4.11 `POST /admin/presale/anomaly/:id/resolve`

处理异常事件。

**请求**

```json
{
  "resolution": "convert_to_deposit",
  "targetRoundId": "seed",
  "note": "用户 0xUSR 联系客服确认身份，把 unclaimed 转账落入种子轮"
}
```

`resolution` 枚举：

| 值 | 含义 |
|---|---|
| `convert_to_deposit` | 落成正式 `presale_deposit`（unclaimed / late_arrival 等） |
| `partial_credit` | 部分入账（overflow 超出部分挂账） |
| `reject` | 拒绝处理（用户撤回 / 已退款） |

**curl 示例**

```bash
curl -X POST https://admin.oddfi.io/admin/presale/anomaly/42/resolve \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "resolution": "convert_to_deposit",
    "targetRoundId": "seed",
    "note": "用户 0xUSR 联系客服确认身份，把 unclaimed 转账落入种子轮"
  }'
```

---

### 4.12 `GET /admin/presale/audit`

审计日志查询。

**query 参数**：`operator` / `action` / `target_type` / `target_id` / `from_ts` / `to_ts` / `page` / `size`

**curl 示例**

```bash
# 查最近 1h 的高敏操作
curl "https://admin.oddfi.io/admin/presale/audit?action=update_config&from_ts=1747900000000" \
  -H "Authorization: Bearer $JWT"
```

---

## 5 实施指南

### 5.1 路由注册

在 `internal/router/router.go` 中，仿照现有 `admin-users` 路由组注册预售路由：

```go
// 参考现有模式
admin := r.Group("/admin", middleware.AdminAuthMiddleware())
{
    // 现有
    admin.GET("/admin-users", middleware.RoleRequired("super_admin"), handler.ListAdminUsers)

    // 新增：预售路由组
    presale := admin.Group("/presale", middleware.PresaleAuditMiddleware())
    {
        // 查询接口（customer_service+）
        presale.GET("/rounds", middleware.RoleRequired("customer_service", "operator", "super_admin"), presaleHandler.ListRounds)
        presale.GET("/rounds/:id", middleware.RoleRequired("customer_service", "operator", "super_admin"), presaleHandler.GetRound)
        presale.GET("/config", middleware.RoleRequired("customer_service", "operator", "super_admin"), presaleHandler.GetConfig)
        presale.GET("/deposits", middleware.RoleRequired("customer_service", "operator", "super_admin"), presaleHandler.ListDeposits)
        presale.GET("/deposits/:txHash", middleware.RoleRequired("customer_service", "operator", "super_admin"), presaleHandler.GetDeposit)
        presale.GET("/anomaly", middleware.RoleRequired("customer_service", "operator", "super_admin"), presaleHandler.ListAnomalyEvents)
        presale.GET("/anomaly/:id", middleware.RoleRequired("customer_service", "operator", "super_admin"), presaleHandler.GetAnomalyEvent)
        presale.GET("/audit", middleware.RoleRequired("customer_service", "operator", "super_admin"), presaleHandler.ListAuditLogs)

        // operator+ 接口
        presale.POST("/rounds/:id/pause", middleware.RoleRequired("operator", "super_admin"), presaleHandler.PauseRound)
        presale.POST("/rounds/:id/resume", middleware.RoleRequired("operator", "super_admin"), presaleHandler.ResumeRound)
        presale.POST("/rounds/:id/reopen", middleware.RoleRequired("operator", "super_admin"), presaleHandler.ReopenRound)
        presale.POST("/rounds/:id/close", middleware.RoleRequired("operator", "super_admin"), presaleHandler.CloseRound)
        presale.PATCH("/rounds/:id/referral-pct", middleware.RoleRequired("operator", "super_admin"), presaleHandler.UpdateReferralPct)
        presale.POST("/deposits/:txHash/migrate-round", middleware.RoleRequired("operator", "super_admin"), presaleHandler.MigrateDepositRound)
        presale.POST("/anomaly/:id/resolve", middleware.RoleRequired("customer_service", "operator", "super_admin"), presaleHandler.ResolveAnomalyEvent)

        // super_admin only
        presale.PATCH("/rounds/:id", middleware.RoleRequired("super_admin"), presaleHandler.UpdateRound)
        presale.PATCH("/config", middleware.RoleRequired("super_admin"), presaleHandler.UpdateConfig)
    }
}
```

### 5.2 Handler 文件清单

新增文件在 `internal/handler/`：

| 文件 | 包含 handler |
|---|---|
| `presale_round.go` | `ListRounds`, `GetRound`, `PauseRound`, `ResumeRound`, `ReopenRound`, `CloseRound`, `UpdateRound`, `UpdateReferralPct` |
| `presale_deposit.go` | `ListDeposits`, `GetDeposit`, `MigrateDepositRound` |
| `presale_anomaly.go` | `ListAnomalyEvents`, `GetAnomalyEvent`, `ResolveAnomalyEvent` |
| `presale_config.go` | `GetConfig`, `UpdateConfig` |
| `presale_audit.go` | `ListAuditLogs` |

### 5.3 Service 文件清单

新增文件在 `internal/service/`：

| 文件 | 职责 |
|---|---|
| `presale_round.go` | 状态机操作（pause/resume/reopen/close）、字段更新、轮次查询 |
| `presale_deposit.go` | 入账查询、migrate-round 事务逻辑（7 步，含 holding 回滚/应用） |
| `presale_anomaly.go` | 异常事件查询、resolve 逻辑（按 resolution 类型分支） |
| `presale_config.go` | 配置读写、vault_address 改值后 warning 生成 |

### 5.4 Repository 文件清单

新增文件在 `internal/repository/`，直接 GORM 操作共享 MySQL（参考现有 `admin_users.go` 模式）：

| 文件 | 操作的表 |
|---|---|
| `presale_round.go` | `presale_round` |
| `presale_deposit.go` | `presale_deposit` |
| `presale_holding.go` | `presale_holding`（migrate-round 需要修改） |
| `presale_config.go` | `presale_config` |
| `presale_ops_event.go` | `presale_ops_event` |
| `presale_admin_audit.go` | `presale_admin_audit`（只 INSERT，不 UPDATE/DELETE） |

**repository 约束**：

```go
// presale_admin_audit 只允许 INSERT，禁止 UPDATE / DELETE
// 参考 admin_users.go 中防止删除最后一个 super_admin 的保护模式

func (r *PresaleAdminAuditRepo) Create(ctx context.Context, audit *model.PresaleAdminAudit) error {
    return r.db.WithContext(ctx).Create(audit).Error
    // 注意：此 repo 无 Update / Delete 方法，DB 层也只授 INSERT 权限
}
```

### 5.5 Audit Middleware 设计

新增 `internal/middleware/presale_audit.go`：

```
PresaleAuditMiddleware 挂在 presale 路由组，对所有 mutate 接口自动：

1. Before handler：
   - 从请求 body 解析 `note` 字段，校验长度 ≥ 10（否则 400 NOTE_REQUIRED）
   - 从 ctx 取 `target_type` / `target_id`（handler 通过 c.Set 注入）
   - 查询 before snapshot（target 对象的当前状态，JSON 序列化）
   - 注入 audit 上下文到 c

2. After handler（defer）：
   - 若 handler 返回错误，跳过 audit 写入
   - 查询 after snapshot
   - INSERT presale_admin_audit {
       operator: c.GetString("admin_user_id"),
       operator_role: c.GetString("role"),
       action: 从路由 method+path 推导,
       target_type, target_id,
       before_json, after_json,
       source: "api",
       ip: c.ClientIP(),
       note: 从 body 取
     }
   - 失败时 log error 但不回滚业务事务（audit 写入失败不影响业务）
```

**GET 接口跳过 audit**（中间件内判断 `c.Request.Method == "GET"` 时直接 next）。

### 5.6 GORM Model 清单

新增文件在 `internal/model/`：

| 文件 | struct |
|---|---|
| `presale_round.go` | `PresaleRound`（含状态机枚举常量） |
| `presale_deposit.go` | `PresaleDeposit`（含 anomaly_reason 枚举常量） |
| `presale_holding.go` | `PresaleHolding`（含 source 常量：1=invest, 2=referral） |
| `presale_config.go` | `PresaleConfig` |
| `presale_ops_event.go` | `PresaleOpsEvent` |
| `presale_admin_audit.go` | `PresaleAdminAudit` |
| `presale_dto.go` | 各接口 request / response DTO |

---

## 6 Migration 说明

### 6.1 本仓库负责的 migration

```
migrations/0002_create_presale_admin_audit.sql
```

```sql
-- 0002_create_presale_admin_audit.sql
CREATE TABLE `presale_admin_audit` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `operator`      VARCHAR(64)     NOT NULL COMMENT 'admin_user.lark_user_id 或 script:filename',
  `operator_role` VARCHAR(32)     NULL     COMMENT 'super_admin/operator/customer_service/finance/script',
  `action`        VARCHAR(48)     NOT NULL COMMENT 'pause/resume/reopen/close/update_round/update_config/anomaly_resolve/migrate_round_id/...',
  `target_type`   VARCHAR(32)     NOT NULL COMMENT 'round/deposit/config/anomaly',
  `target_id`     VARCHAR(64)     NOT NULL,
  `before_json`   TEXT            NULL     COMMENT '变更前快照',
  `after_json`    TEXT            NULL     COMMENT '变更后快照',
  `source`        VARCHAR(16)     NOT NULL DEFAULT 'api' COMMENT 'api/script',
  `ip`            VARCHAR(64)     NULL     COMMENT '仅 api 来源有值',
  `note`          TEXT            NOT NULL COMMENT '操作人必填备注',
  `created_at`    BIGINT          NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_operator_ts` (`operator`, `created_at`),
  KEY `idx_target` (`target_type`, `target_id`),
  KEY `idx_action_ts` (`action`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='运营操作审计';
```

执行方式（在共享 MySQL 上，需在 web-api 业务表 migration 之后执行）：

```bash
mysql -h <host> -u <user> -p <db> < migrations/0002_create_presale_admin_audit.sql
```

### 6.2 业务表 migration（不在本仓库）

`presale_round / presale_deposit / presale_config / presale_holding / presale_event_cursor / presale_ops_event / user_referral_code / user_referral_bind` 共 8 张表的 migration 在 **web-api 仓库**（`oddfi-backend/web-api/migrations/`），必须在 admin-backend 启动前跑完。

**应用启动时不自动建表**（`gorm.AutoMigrate` 不调用这 8 张表），依赖 web-api 仓库的 migration 提前执行。

### 6.3 Migration 执行顺序（完整）

```
[web-api 仓库]
1. 00xx_create_presale_round.sql
2. 00xx_create_presale_deposit.sql
3. 00xx_create_presale_config.sql
4. 00xx_create_presale_holding.sql
5. 00xx_create_presale_event_cursor.sql
6. 00xx_create_presale_ops_event.sql
7. 00xx_create_user_referral_code.sql
8. 00xx_create_user_referral_bind.sql

[admin-backend 仓库]
9. 0002_create_presale_admin_audit.sql   ← 本仓库，引用业务表，必须最后执行
```

---

## 7 安全约束

- 所有 mutate 接口必须携带 `note` 字段（≥ 10 字符），空 note 直接拒绝（`NOTE_REQUIRED`）
- 高敏接口（`PATCH /config` / `migrate-round` / `PATCH /rounds/:id`）限流 10/min
- `presale_admin_audit` 表：DB 层只授 INSERT 权限，应用层禁止 DELETE / UPDATE
- `vault_address` 改值必须双步确认（admin PATCH + 运维更新 env + 重启 worker）
- 所有响应不包含 Lark webhook 完整 URL（返回时 mask 最后 16 字符）
- 响应不包含其他用户 EOA（仅返回操作者自身信息）

---

## 8 与预案脚本的对应关系

预案脚本（`web-api/scripts/presale-ops/*.go`）与 admin HTTP 接口**功能等价**，两条路径都落 `presale_admin_audit`：

| 场景 | HTTP 接口 | 预案脚本（SSH 执行） |
|---|---|---|
| pause / resume / reopen / close | `POST /admin/presale/rounds/:id/...` | `round-pause.go` / `round-resume.go` |
| 迁移 round_id | `POST /admin/presale/deposits/:txHash/migrate-round` | `migrate-round.go` |
| 处理异常 | `POST /admin/presale/anomaly/:id/resolve` | `anomaly-resolve.go` |
| 改 config | `PATCH /admin/presale/config` | 无脚本（高敏，仅 super_admin 走 HTTP） |

脚本落 audit 时：`operator = "script:filename"`，`source = "script"`，`ip = NULL`。

---

## 9 本地开发快速上手

```bash
# 1. 确保 web-api migration 已在本地 MySQL 跑过（8 张业务表）
mysql -u root oddfi < /path/to/oddfi-backend/web-api/migrations/00xx_create_presale_*.sql

# 2. 跑 admin-backend audit 表 migration
mysql -u root oddfi < migrations/0002_create_presale_admin_audit.sql

# 3. 用 dev-token 工具生成 super_admin JWT 测试
go run cmd/dev-token/main.go --role=super_admin

# 4. 验证接口
JWT=$(go run cmd/dev-token/main.go --role=super_admin)

curl http://localhost:8081/admin/presale/rounds \
  -H "Authorization: Bearer $JWT"

curl -X POST http://localhost:8081/admin/presale/rounds/strategic/pause \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"note": "本地测试暂停战略轮"}'
```
