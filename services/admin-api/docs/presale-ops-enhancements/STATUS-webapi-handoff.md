# STATUS · web-api 完工交接（致 admin-backend）

**作者**: web-api agent
**日期**: 2026-05-29
**适用需求**: REQ-001 / REQ-004

> 本文给 admin-backend agent / 运维 review，告知 web-api 这一侧本轮做了什么、API 契约是什么、admin-backend 下一步该如何衔接 + 联调。
> REQ-001 / REQ-004 实现两条分支已在 `oddfi-backend` 落地，分别独立提交，等审 / 等部署。

---

## 1. 已完成事项总览

| 需求 | 状态 | Commit on main |
|---|---|---|
| REQ-001 Lark 推送加邀请人 EOA | ✅ 已 merge | `7c6f9fc`（与 REQ-004 同 squash 合并）|
| REQ-004 KOL 独立返佣 — web-api 侧 | ✅ 已 merge | `7c6f9fc` |
| REV-006 follow-up（MAJ-1/MAJ-2 修复）| ✅ 已 merge | `7c6f9fc` |

仓库根：`oddfi-backend/web-api`
所有 3 个改动通过 review、squash 合入 `main`、已 push（commit `7c6f9fc`）。
功能分支 `feat/REQ-001-lark-inviter-eoa` / `feat/REQ-004-kol-referral` 已删除（历史保留在 squash commit 内）。

**当前状态**: 等运维 cutover 部署，部署完成即 KOL 4 endpoint 上线，可启动 admin-backend Step 2 联调。

---

## 2. REQ-001 · 改动摘要

仅 2 个 service 文件 + 1 个 test：

| 文件 | 变更 |
|---|---|
| `internal/service/lark_webhook.go` | `LarkEvent` struct 加 `ReferrerEoa string` 字段；`buildCardContent` 在 `deposit_confirmed` 卡片"邀请人"行后追加"邀请人EOA"行 |
| `internal/service/presale_deposit_impl.go` | `NotifyDepositConfirmed` 从 `dep.ReferrerEoa` 取值传入 `LarkEvent.ReferrerEoa` |
| `internal/service/lark_webhook_test.go` | 补 `0xkol123` 断言 + 新增 `_NoReferrer` 用例验证空值 `-` |

**对 admin-backend 影响**：零。Lark 卡片格式不影响任何 admin API/前端，**admin-backend 这一侧不需要做任何配合**。

---

## 3. REQ-004 · 改动摘要

### 3.1 DB schema 变更（运维须知）

新增 migration `0012_create_presale_kol_referral_pct.sql`：

```sql
CREATE TABLE presale_kol_referral_pct (
    referrer_eoa VARCHAR(42)   NOT NULL PRIMARY KEY,
    referral_pct DECIMAL(10,4) NOT NULL,
    note         VARCHAR(256)  DEFAULT NULL,
    created_by   VARCHAR(64)   NOT NULL,
    created_at   BIGINT        NOT NULL,
    updated_at   BIGINT        NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- 已同步 `migrations/README.md` manifest（表数 11 → 12）
- 已同步 `scripts/verify-migration.sh` 的 `EXPECTED_TABLES`
- 表数据 admin-backend 无需直接访问 — 全部走 web-api 的 4 个 internal endpoint

### 3.2 新增 4 个 internal endpoint（给 admin-backend proxy 调）

挂在 `127.0.0.1:internal_port` 的 `/internal/admin/presale/kol-referral`：

| Method | Path | 用途 |
|---|---|---|
| GET    | `/internal/admin/presale/kol-referral` | 列表（带 `?page=&size=&referrerEoa=` filter） |
| POST   | `/internal/admin/presale/kol-referral` | 新增 / 覆盖（Upsert 语义，幂等） |
| PATCH  | `/internal/admin/presale/kol-referral/:eoa` | 修改（pct 和/或 note） |
| DELETE | `/internal/admin/presale/kol-referral/:eoa` | 删除 |

#### 响应格式（已与现 admin handler 一致）

```json
// 成功
{ "code": 0, "message": "ok", "data": { ... } }

// 错误
{ "code": "INVALID_PARAM"  | "KOL_NOT_FOUND" | "INVALID_BODY" | "INTERNAL_ERROR" | ...,
  "message": "..." }
```

- GET data：`{ "list": [...], "total": N, "page": P, "size": S }`
- POST / PATCH data：`{ "kol": { ...KOL 对象 } }`
- DELETE data：`{ "referrerEoa": "0x..." }`

#### KOL 对象 schema

```json
{
  "referrerEoa": "0xabc...def",   // 始终小写
  "referralPct": "8",             // 字符串十进制，最大 100，≤4 位小数
  "note": "vip kol",              // 可选；缺省时不返
  "createdBy": "ou_<lark_user_id>",
  "createdAt": 1700000000000,     // unix ms
  "updatedAt": 1700000000000
}
```

#### 校验规则

- `referrerEoa`：必须 `^0x[0-9a-fA-F]{40}$`，web-api 写入前强制 `strings.ToLower`
- `referralPct`：`[0, 100]`，精度 ≤ 4 位小数；超界 → `INVALID_PARAM`
- PATCH 至少传 `referralPct` / `note` 一项；未传值字段保留原值
- 写操作走 web-api 现有 `admin_audit` + `idempotency` middleware（audit 自动落 `presale_admin_audit`，action 字段为 `kol_referral_upsert` / `kol_referral_update` / `kol_referral_delete`，target_type=`kol_referral`，target_id=eoa）

#### RBAC 说明

**web-api 不做角色校验**。本路由的 RBAC 由 admin-backend proxy 层完成（你那边的 Step 1 已实现）。web-api 信任 `ServiceAuth` + `AdminJWT` 透传的 operator / role。

REQ-004 文档原本写"`middleware.RoleRequired("super_admin")`"那行，由于本仓库内部 admin 路径没有该 middleware（与现 17 个 endpoint 保持一致），所以**未在 web-api 侧装配**。

如果 admin-backend proxy 层尚未限制 super_admin only，那么任何持有有效 admin JWT 的运营都能调；请 admin-backend 那边确认 Step 1 已收紧。

### 3.3 业务逻辑变更（落 deposit 时使用 KOL 比例）

- `ReportTx`（前端用户上报路径）：落 deposit 前查 `kolRepo.GetByEoa(referrer_eoa)`，命中则用 KOL 自定义 pct 覆盖 `round.referral_reward_pct`
- `presale-worker` listener（链上扫块路径）：同步覆盖逻辑
- 未命中（`ErrKolNotFound`）/ DB 异常 → 静默 fallback 轮次默认比例 + warn log
- 历史 deposit 不回填（doc 明文"不做"）

---

## 4. admin-backend 下一步建议

### 4.1 不需要做的事

- ❌ 直接访问 `presale_kol_referral_pct` 表（请走 web-api endpoint）
- ❌ 在 web-api endpoint 之上再做业务校验（已含 EOA / pct 校验）
- ❌ 维护 KOL 比例缓存（web-api 每次落 deposit 都查 DB，admin-backend 路径只是 CRUD 透传）

### 4.2 需要做的事

1. **完成 proxy 层 commit + api.md 补全**
   你的描述里提到 Step 1 已实现 proxy 壳。请确认：
   - proxy 路径 → web-api 路径映射完整覆盖 4 个 endpoint
   - 错误码透传：`INVALID_PARAM` / `KOL_NOT_FOUND` / `INVALID_BODY` 应原样转发给前端
   - RBAC：`super_admin` only（建议）；列表查询可放宽到 `customer_service`/`operator`/`finance`
   - api.md 用 §3.2 的 schema 描述

2. **合并 & 部署顺序**（按你给的协作流程）
   - **Step 1**: web-api 先 merge + deploy（含 migration `0012`）→ KOL endpoint 上线
   - **Step 2**: admin-backend merge → proxy 转发生效
   - **Step 3**: admin-frontend merge → 真实接口联调，撤掉 mock

3. **联调断言点**（建议 admin-backend 提供给 frontend 验收）
   - 新增 KOL：POST 成功后 `data.kol.referrerEoa` 必小写
   - 重复 EOA POST：返回 200，`data.kol.referralPct` 是最新值（Upsert 语义）
   - 删除不存在：404 `KOL_NOT_FOUND`
   - 精度超界（如 `8.12345`）：400 `INVALID_PARAM`，message 含 "precision"
   - PATCH 空 body：400，message 含 "at least one"

---

## 5. 风险 & 注意事项

| 风险 | 说明 | 缓解 |
|---|---|---|
| migration 漏跑 | 部署 web-api 但忘了 apply `0012` → KOL endpoint 500 / Worker 落 deposit 不会用 KOL pct（fallback 安全） | `scripts/verify-migration.sh` 已加 `presale_kol_referral_pct`，cutover 必跑 |
| admin-backend proxy 提前合 | proxy 上线时 web-api endpoint 还没上 → 502/404 | 严格按"web-api 先" 顺序 |
| RBAC 未收紧 | web-api 不校验角色，proxy 层是唯一防线 | 你这边确认 Step 1 实际生效 |
| 前端先合 | mock 数据 schema 偏离实际 → 切真接口时 UI 异常 | frontend 用本文 §3.2 schema 对齐 mock |

---

## 6. 联调时遇到 web-api 问题怎么联系

- 看 web-api 容器日志：`docker logs oddfi-web-api`，过滤 `KolReferralPctRepo` / `kol referral`
- audit 落库后看 `presale_admin_audit` 表 `action LIKE 'kol_referral%'` 验证 audit chain 完整
- 我（web-api agent）随时配合调整 schema / 错误码 — 但任何接口契约变动须双方对齐后再改

---

## 关联文件

- web-api 仓库 main commit：`7c6f9fc`（REQ-001 + REQ-004 + REV-006 follow-up，squash 合并）
- 需求文档：[REQ-001](./REQ-001-lark-inviter-eoa.md) / [REQ-004 master](./REQ-004-kol-referral-master.md) / [REQ-004 webapi](./REQ-004-kol-referral-webapi.md) / [REQ-004 frontend](./REQ-004-kol-referral-frontend.md)
- web-api 部署协议：`oddfi-backend/web-api/.claude/rules/migration-deploy.md`

---

## 7. REV-006 follow-up（2026-05-29）

REV-006 复审 REQ-004 KOL handler 时揪出一个 Critical-tier 缺陷（MAJ-1）：admin handler 的写路径没有把 `audit` middleware 注入的 `gormtx` 透传到 `KolReferralPctRepository`，导致 KOL 业务写自 commit、audit insert 失败 rollback 时**审计链就断了**。属于 INC-002「假 checklist」+ DD-003 audit middleware 原子性约定的同型回归。

### 7.1 修了什么

REV-006 follow-up 已与 REQ-004 同 squash 合并入 main commit `7c6f9fc`：

| 项 | 说明 |
|---|---|
| MAJ-1 (Critical) | `KolReferralPctRepository` 新增 `UpsertTx` / `UpdateTx` / `DeleteTx` 三个 Tx 版本；handler 改用 Tx 版本 + `getByEoaTx` 用同一 tx 读 before/after 快照 |
| MAJ-2 | `List` filter 的 `referrerEoa` 改用 hex-only 正则白名单（`^0x[0-9a-fA-F]{40}$`），防 SQL LIKE 通配符注入 |
| 拼写笔误 | 顺带修正（不影响行为） |

### 7.2 修复后的原子性保证

现在 admin POST / PATCH / DELETE 三个 endpoint 走的是「同一个 `*gorm.DB` tx」：

```
audit middleware Begin tx
  → handler 从 gormtx.From(ctx) 取出 tx
  → KOL repo.UpsertTx(tx, ...) / repo.getByEoaTx(tx, ...) 在同 tx 内写读
  → audit middleware Insert audit row 用同 tx
  → idempotency 写同 tx
audit middleware Commit / Rollback
```

任一步失败 → 整笔 rollback：业务数据 + audit 行 + 幂等键三者要么全部落库、要么全部回滚。审计链不会再断。

### 7.3 对 admin-backend proxy 层的影响

**零变化**。API path / request / response / 错误码全部保持 §3.2 描述；proxy 层无须配合改动，已上线的 mock / 联调脚本不受影响。

### 7.4 给 admin-backend reviewer 的提醒

REV-006 这条教训在 admin-backend 也同型适用：**如果你们这边有任何「写业务表 + 写 audit 表」的路径，务必复核两次写是同一个 tx，而不是 service 层分别 commit**。机械化 review 问法：

> 「这一行用的 `db` 实例是从 `ctx`（tx）来还是从 `repo.db`（自 commit）来？」

凡是会被 admin endpoint 调用且过 audit middleware 的 repo 方法，都应该提供 `*Tx` 版本，由 handler 显式传 tx 进去，不要让 repo 自己拿 `r.db` 起新 tx。

---

## 关联文件（追加）

- REV-006 修复 commit：`ba51176`（`feat/REQ-004-kol-referral`）
- 同型历史教训：INC-002「假 checklist」+ DD-003 audit middleware 原子性约定
