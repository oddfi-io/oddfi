# 03 · 管理后台接口契约（admin-backend · V3）

> 所有 admin 接口都在 **oddfi-admin-backend** 仓库实现，挂在 `/admin/presale/*`。
> 鉴权复用 admin-backend 现有 Lark OAuth + JWT + 4 角色 RBAC + 限流 + 审计中间件。
> web-api 仓库的 `/admin/*` 路由组（SEC-001 零鉴权）**不沾**，本期不治理。
> 实际实现 PR 在 admin-backend 仓库；本文档为契约源真值，admin-backend 需镜像同步到 `oddfi-admin-backend/docs/presale-admin/README.md`。

## 1 接口清单

| 方法 | 路径 | RBAC | 用途 |
|---|---|---|---|
| GET | `/admin/presale/rounds` | customer_service+ | 列出全部轮次 |
| GET | `/admin/presale/rounds/:id` | customer_service+ | 单轮次详情 |
| PATCH | `/admin/presale/rounds/:id` | super_admin | 改 round 字段（价格/supply/时间窗） |
| POST | `/admin/presale/rounds/:id/pause` | operator+ | 暂停 active 轮次 |
| POST | `/admin/presale/rounds/:id/resume` | operator+ | 恢复 paused 轮次 |
| POST | `/admin/presale/rounds/:id/reopen` | operator+ | 重开 ended 轮次 |
| POST | `/admin/presale/rounds/:id/close` | operator+ | 手动关闭轮次 |
| PATCH | `/admin/presale/rounds/:id/referral-pct` | operator+ | 改 referral_reward_pct |
| GET | `/admin/presale/config` | customer_service+ | 全局配置 |
| PATCH | `/admin/presale/config` | super_admin | 改金库 / TGE / 基准价 / 容差 |
| GET | `/admin/presale/deposits` | customer_service+ | 入账列表（分页） |
| GET | `/admin/presale/deposits/:txHash` | customer_service+ | 单笔入账详情 |
| POST | `/admin/presale/deposits/:txHash/migrate-round` | operator+ | 把入账迁移到其他轮次（修订 round_id 保留其他真实性） |
| GET | `/admin/presale/anomaly` | customer_service+ | 异常事件列表 |
| GET | `/admin/presale/anomaly/:id` | customer_service+ | 单条异常详情 |
| POST | `/admin/presale/anomaly/:id/resolve` | customer_service+ | 处理异常（落入正常 deposit 或拒绝） |
| GET | `/admin/presale/audit` | customer_service+ | 操作审计日志 |

## 2 RBAC 角色矩阵

admin-backend 现有 4 角色：`super_admin / operator / customer_service / finance`。本期映射：

| 操作类型 | 最低角色 |
|---|---|
| 查看（rounds / deposits / anomaly / config / audit） | customer_service |
| 轮次状态机操作（pause/resume/reopen/close） | operator |
| 改 `referral_reward_pct` | operator |
| 异常事件处理（anomaly/resolve） | customer_service |
| 入账迁移轮次（migrate-round） | operator |
| 改金库地址 / TGE / `tge_open_price_usd` | **super_admin** |
| 改 round 价格 / supply / 时间窗 | **super_admin** |

> finance 角色本期暂无预售相关 grant。退款链路（如启用）落 finance。
> RBAC 路由权限矩阵必须同步更新到 `oddfi-admin-backend/.claude/rules/rbac.md`。

## 3 错误码字典（admin-backend）

| HTTP | code | 含义 |
|---|---|---|
| 403 | 40301 | `INSUFFICIENT_ROLE` 角色权限不足 |
| 404 | 40404 | `ROUND_NOT_FOUND` / `DEPOSIT_NOT_FOUND` / `ANOMALY_NOT_FOUND` |
| 409 | 40901 | `INVALID_STATE_TRANSITION` 状态机非法切换（如 pause 已 ended 轮次） |
| 400 | 40010 | `NOTE_REQUIRED` mutate 类接口必须填备注 |
| 400 | 40011 | `INVALID_TARGET_ROUND` migrate-round 目标轮次不存在 / 不允许 |
| 400 | 40012 | `VAULT_ADDRESS_INVALID` 金库地址格式错误 / 不在白名单 |
| 422 | 42201 | `BLOCK_TIMESTAMP_NOT_IN_TARGET_ROUND` migrate-round 时区块时间不在目标轮次范围 |

## 4 公共请求约定

**所有 mutate 类接口都必须**：

- 请求体携带 `note`（≥ 10 字符）：操作原因，会落 `presale_admin_audit.note`
- 接口实现内事务前后写 `presale_admin_audit`（middleware 自动处理）
- 限流：default 60/min，高敏接口（migrate-round / update-config / round PATCH）10/min

**响应包装**沿用 admin-backend 现有：`{ code, message, data }`。

## 5 接口详情（核心）

### 5.1 `POST /admin/presale/rounds/:id/pause`

**请求**

```json
{ "note": "插入种子轮回退，临时暂停战略轮" }
```

**响应 data**

```json
{
  "roundId": "strategic",
  "previousStatus": "active",
  "currentStatus": "paused",
  "manualOverride": true,
  "operator": "lark_user_id_xxx",
  "pausedAt": 1747900000000
}
```

**后端动作**（事务内）：

1. 取 round，校验 `status ∈ {active}`（否则 `40901 INVALID_STATE_TRANSITION`）
2. 更新 `status=paused`、`manual_override=1`、`updated_at`
3. 写 `presale_admin_audit`：`action=pause / target=round:strategic / before={status:active,...} / after={status:paused,...}`
4. （非阻塞）通过 Lark webhook 通知运营群"战略轮已暂停"

**注意**：pause 不阻止链上 USDT Transfer 入账。pause 期间到账走 `paused_arrival` 信息流（详见 anomaly 处理）。

---

### 5.2 `POST /admin/presale/rounds/:id/resume`

校验 `status ∈ {paused}`，更新 `status=active`、`manual_override=1`。

---

### 5.3 `POST /admin/presale/rounds/:id/reopen`

**前置**：轮次必须 `status = ended` 且确实有"再开"诉求（大客户回补、运营临时插入等）。

**请求**

```json
{ "note": "大客户 X 想补种子轮份额，临时 reopen" }
```

**后端动作**：

1. 校验 `status = ended`（否则 `40901`）
2. 更新 `status = active`、`manual_override = 1`，**`end_ts` 不动**
3. cron 不会因 `now > end_ts` 把这一轮再推回 ended（受 `manual_override` 约束）
4. 运营在补完后必须显式 `POST .../close`

---

### 5.4 `POST /admin/presale/rounds/:id/close`

校验 `status ∈ {active, paused}`，更新 `status = ended`、`manual_override = 1`。
适用场景：reopen 后回收，或 active 期间运营提前关闭。

---

### 5.5 `PATCH /admin/presale/rounds/:id`

改 round 字段。super_admin only。

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

字段全部可选；只传需要改的。所有改动落 `audit.before_json / after_json`。

**校验**：

- `price > 0` / `supply > 0`
- `end_ts > start_ts`
- 若 `supply < sold_odd` → `40011 INVALID_TARGET_ROUND` 阻断
- `referral_reward_pct` 走单独的 `PATCH .../referral-pct` 接口（高频，权限低）

---

### 5.6 `PATCH /admin/presale/rounds/:id/referral-pct`

```json
{ "referralRewardPct": "12.5000", "note": "种子轮大客户邀请活动" }
```

operator+ 可改。改完**不影响历史 deposit**（已入账的 `referral_reward_pct` 是快照值，逐笔独立）。

---

### 5.7 `GET /admin/presale/config` / `PATCH /admin/presale/config`

```json
{
  "tgeTs": 1749571200000,
  "tgeOpenPriceUsd": "0.1",
  "vaultAddress": "0xINV...A2F1",
  "minSubscribeUsd": "1000",
  "boundaryToleranceMin": 5,
  "totalTargetUsd": "20000000",
  "auditLabel": "CertiK",
  "larkWebhookUrl": "https://open.larksuite.com/..."
}
```

PATCH 字段全部可选。`vault_address` 改完后端返回提示：

```json
{
  "warning": "vault_address 已更新到 0xNEW...，但 env PRESALE_VAULT_POOL 仍需同步且重启 presale-worker 进程后才会生效。监听器扫到老地址的入账时仍按 vault_address 快照入账（多地址池支持）。"
}
```

**TGE 改期不会自动联动 round 时间窗**（解耦设计）；运营如需同步改 round.end_ts，必须单独 PATCH。

---

### 5.8 `POST /admin/presale/deposits/:txHash/migrate-round`

把一笔已入账的 deposit 从 round A 迁移到 round B（修订错误轮次归属，常用于边界切轮投诉）。

**请求**

```json
{
  "targetRoundId": "seed",
  "note": "用户 0xUSR... 投诉边界切轮，原入战略轮，按种子轮重算"
}
```

**后端动作**（事务内）：

1. 取 `presale_deposit(tx_hash)`，校验 `status = confirmed`
2. 校验 `targetRoundId` 存在
3. **校验 block_timestamp ∈ [target.start_ts - 容差, target.end_ts + 容差]**（防止跨好几轮乱迁）→ 否则 `42201`
4. 取 `target_round.price_usd`，重算 `shares_odd = amount_usdt / target.price`、`referral_reward_odd = shares_odd × target.referral_reward_pct / 100`
5. **回滚旧轮次的 holding 影响**：减去 `holding(user, old_round, source=invest).total_odd / invested_usd`，重算 `locked_price_avg`
6. **应用新轮次的 holding 影响**：upsert `holding(user, new_round, source=invest)`
7. 同理处理 referral holding
8. 更新 `presale_deposit.round_id / price_usd / shares_odd / referral_reward_odd / referral_reward_pct`
9. 写 audit：详细 `before / after` JSON
10. （非阻塞）Lark 通知"运营已修订 deposit ... 从 A 轮迁到 B 轮"

**注意**：本接口是预案脚本的"接口版"。运营也可以直接跑 `web-api/scripts/presale-ops/migrate-round.go` 走 SSH 执行，效果等价。两条路径都落 audit。

---

### 5.9 `POST /admin/presale/anomaly/:id/resolve`

处理异常事件。

**请求**

```json
{
  "resolution": "convert_to_deposit",
  "targetRoundId": "seed",
  "note": "用户 0xUSR 联系客服确认，把 unclaimed 转账落入种子轮"
}
```

`resolution` 枚举：

| 值 | 含义 |
|---|---|
| `convert_to_deposit` | 把异常事件落成正式 `presale_deposit`（unclaimed / late_arrival 等） |
| `partial_credit` | 部分入账（overflow 场景，超出部分挂账） |
| `reject` | 拒绝处理（用户撤回 / 已退款） |

**后端动作**：

1. 取 ops_event，校验 `status ∈ {pending, notified}`
2. 按 resolution 类型走对应逻辑
3. 更新 `presale_ops_event(status=resolved, resolved_by, resolved_at, resolve_note)`
4. 落 audit
5. （非阻塞）Lark 群回帖"已处理"

---

### 5.10 `GET /admin/presale/audit`

**query**：`operator` / `action` / `target_type` / `target_id` / `from_ts` / `to_ts` / `page` / `size`

返回审计日志列表（含 before / after JSON diff）。前端高亮 diff。

## 6 实施分布

| 仓库 | 内容 |
|---|---|
| `oddfi-admin-backend` | 全部 `/admin/presale/*` handler / service / repository / RBAC 注册 |
| `oddfi-admin-backend/docs/presale-admin/README.md` | 镜像本文档 + RBAC 矩阵 + 各接口 curl 示例 |
| `oddfi-admin-backend/migrations/0002_create_presale_admin_audit.sql` | audit 表 migration（业务表 migration 在 web-api 仓库） |
| `oddfi-admin-backend/.claude/rules/rbac.md` | 补 `/admin/presale/*` 权限映射 |
| `oddfi-admin-backend/internal/middleware/presale_audit.go` | mutate 接口前后写 audit 的中间件 |
| `oddfi-backend/web-api` | 不实现 admin 接口；仅业务表 schema + worker + 用户接口 |

## 7 安全约束

- 所有 admin 接口必须 `note` 字段；空 note 直接拒绝（40010）
- 高敏接口（PATCH /config / migrate-round / PATCH /rounds）限流 10/min
- audit 表不支持 DELETE / UPDATE（应用层禁止；DB 层只授 INSERT 权限）
- `vault_address` 改值时强制 `PATCH /config` + 重启 worker 双步确认（不允许"改了就生效"避免误操作）
- 所有响应不包含敏感信息（如 Lark webhook URL 完整地址、其他用户 EOA）

## 8 与预案脚本的对应关系

预案脚本（`web-api/scripts/presale-ops/*.go`）和 admin HTTP 接口**功能等价**，提供两条路径：

| 场景 | HTTP 接口 | 预案脚本 |
|---|---|---|
| pause / resume / reopen / close | `POST /admin/presale/rounds/:id/...` | `round-pause.go` / `round-resume.go` |
| 迁移 round_id | `POST /admin/presale/deposits/:txHash/migrate-round` | `migrate-round.go` |
| 处理异常 | `POST /admin/presale/anomaly/:id/resolve` | `anomaly-resolve.go` |
| 改 config | `PATCH /admin/presale/config` | 不提供脚本（高敏，仅 super_admin 走 HTTP） |

脚本路径**仍写 `presale_admin_audit`**，`operator = "script:filename"`，`source = "script"`。

详细脚本设计见 [batches/B4-ops-scripts.md](batches/B4-ops-scripts.md)。
