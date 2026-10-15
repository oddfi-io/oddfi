# ISSUE-002 · migrate / anomaly 两类客户端错误无专属 4xx 码，落 500

- **状态**：Open
- **严重度**：Medium
- **类型**：契约 / 错误处理
- **发现日期**：2026-05-27
- **主要仓库**：`oddfi-backend/web-api`
- **关联**：前端方案 `docs/spa-presale-admin/02-data-layer.md` §4.4

## 现象

两类**本质是客户端输入错误（4xx）** 的失败，web-api 当前返回 `INTERNAL_ERROR`(500)，前端无法精准提示，用户只见通用「服务异常」文案。

## 源码实际（证据）

1. **migrate-round「目标轮不存在」**
   - `oddfi-backend/web-api/internal/service/presale_admin_deposit.go:162` — `return nil, fmt.Errorf("[PresaleAdminDepositService] target round not found: %s", targetRoundID)`（裸 error，无 sentinel）。
   - `oddfi-backend/web-api/internal/handler/admin/deposit.go` — `depositAbortErr` 无匹配分支 → default → `INTERNAL_ERROR`(500)。
   - 对比：同 handler 的 `MIGRATE_LIMIT_EXCEEDED`(422, deposit.go:152)、`BLOCK_TIMESTAMP_OUT_OF_RANGE`(422, deposit.go:156) 都有专属码，唯独「目标轮不存在」漏了。

2. **anomaly resolve「resolution 非法 / 目标轮非法」**
   - `oddfi-backend/web-api/internal/service/presale_admin_anomaly.go:140,172` — 裸 `fmt.Errorf`，无 sentinel。
   - handler `anomalyAbortErr` default → `INTERNAL_ERROR`(500)。

> 补充：config「vault 地址非法」走的是 `INVALID_PARAM`(400)（`config.go:113` 把 `UpdateConfig` 所有 error 统一映射成 `INVALID_PARAM`），属可接受现状，不在本 issue 修复范围，但建议未来给 vault 一个专属码 `VAULT_ADDRESS_INVALID` 便于前端精准提示。

## 影响

- 500 表示"服务端异常"，会触发前端通用错误页 + 追踪号文案，**误导运营以为系统故障**，实际是他们填错了目标轮 / resolution。
- 500 通常还会触发前端/监控告警、重试逻辑，污染错误率指标。

## 建议修复

在 web-api 增加 sentinel error + handler 映射为 4xx：

| 场景 | 建议 code | HTTP | 位置 |
|---|---|---|---|
| migrate 目标轮不存在 | `INVALID_TARGET_ROUND` 或 `TARGET_ROUND_NOT_FOUND` | 400 / 404 | deposit service + handler |
| resolve resolution 非法 | `INVALID_RESOLUTION` | 400 | anomaly service + handler |
| resolve 目标轮非法 | `INVALID_TARGET_ROUND` | 400 / 404 | anomaly service + handler |
| （可选）config vault 非法 | `VAULT_ADDRESS_INVALID` | 400 | config handler |

定好后**同步更新** `oddfi-admin-backend/docs/api.md` + `presale-admin/README.md` + 通知前端补错误码映射（前端 `02-data-layer.md §4.4`）。

## 前端已做的缓解

前端用预校验规避触发：`targetRoundId` 用下拉只列合法轮（不让手填）、`resolution` 用固定单选枚举。但用户仍可能命中边界（如目标轮刚被删），此时只能落通用 500 文案。

## 验收

- [ ] 上述场景返回对应 4xx + 专属 code 字符串（curl 构造非法入参确认）。
- [ ] docs（api.md / presale-admin README）同步新码。
