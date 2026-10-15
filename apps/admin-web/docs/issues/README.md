# 后端 Issue 清单（预售运营后台前端方案对照源码发现）

> **来源**：编写 `docs/spa-presale-admin/` 前端实施方案时，以**认购后端源码为唯一真值**逐行核对，发现以下后端侧问题（非前端可自行解决，需后端修）。
> **发现日期**：2026-05-27
> **用途**：交给后端 agent 审查 / 修复。每个 issue 自带仓库路径 + `file:line` 证据 + 影响 + 建议修复 + 验收，可独立阅读。
> **前端缓解情况**：前端方案已对能缓解的部分（webhook 打码、错误码按源码对齐、预校验规避无码失败）做了处理，但根因在后端。

## 索引

| 编号 | 标题 | 严重度 | 主要仓库 | 类型 |
|---|---|---|---|---|
| [ISSUE-001](./ISSUE-001-lark-webhook-not-masked.md) | `GET /admin/presale/config` 返回 Lark webhook 完整 URL（明文凭据泄漏） | **High** | web-api | 安全 |
| [ISSUE-002](./ISSUE-002-missing-4xx-codes.md) | migrate / anomaly 两类客户端错误无专属 4xx 码，落 500 | Medium | web-api | 契约 |
| [ISSUE-003](./ISSUE-003-admin-docs-error-code-drift.md) | admin-backend `docs/` 的 presale 错误码与 web-api 源码脱节 | Medium | admin-backend（docs） | 文档债 |
| [ISSUE-004](./ISSUE-004-hmac-query-string-sig-mismatch.md) | HMAC 签名含 query、web-api 验签不含 query → 带 query 的 presale 接口（deposits/audit/anomaly）全 401 **（prod 也挂）** | **High** | admin-backend + web-api | 鉴权 |
| [ISSUE-005](./ISSUE-005-deposit-confirmed-not-pushed.md) | `deposit_confirmed` Lark 推送从未触发 — worker `processLog` 调 repository 层 `ConfirmDeposit`，跳过 service 层发推代码 | **Medium** | web-api（chain + service） | Lark 通知 / worker confirm 路径 |

## 仓库速查

- **web-api**：`~/work/oddfi-backend/web-api`（上游业务 + 预售 admin internal endpoint 真实实现）
- **admin-backend**：`~/work/oddfi-admin-backend`（薄壳代理 + Lark OAuth + RBAC + docs）
- **前端方案**：`~/work/oddfi-admin-frontend/docs/spa-presale-admin/`（引用本目录 issue）

## 附录 · web-api 预售 admin 真实错误码全集（源码提取，供核对）

`grep '"code"' internal/handler/admin/ internal/middleware/` 结果（`gin.H{"code": "..."}`）：

- handler（presale）：`ROUND_NOT_FOUND` `DEPOSIT_NOT_FOUND` `ANOMALY_NOT_FOUND` `INVALID_STATE_TRANSITION`(409) `MIGRATE_LIMIT_EXCEEDED`(422) `BLOCK_TIMESTAMP_OUT_OF_RANGE`(422) `INVALID_BODY`(400) `INVALID_PARAM`(400) `INTERNAL_ERROR`(500) `NO_TX`(500)
- middleware（鉴权/幂等/审计）：`SERVICE_SIG_INVALID` `IDEMPOTENCY_KEY_REQUIRED`(400) `IDEMPOTENCY_BODY_MISMATCH`(409) `IDEM_NO_TX` `IDEM_LOOKUP_FAILED` `IDEM_INSERT_FAILED` `AUDIT_NO_TX` `AUDIT_INSERT_FAILED` `AUDIT_LINK_FAILED` `COMMIT_FAILED` `BODY_READ_FAILED`
- admin-backend（前置）：`IDEMPOTENCY_KEY_REQUIRED`(400) `NOTE_REQUIRED`(400, noteValidatorMW) `INVALID_PARAM`(400)
