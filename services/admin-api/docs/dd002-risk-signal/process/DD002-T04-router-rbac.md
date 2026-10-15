# DD002-T04 · 路由注册 + RBAC + 限流 + rbac.md 矩阵

> 方案：[`../DD.md`](../DD.md) §3.2
> 索引：[`./README.md`](./README.md)
> 前置：T02、T03（handler 就绪）
> 下游：T05（文档）、联调 A

## 目标

events/approval 路由组注册（照 `presale_routes.go` 模式独立文件），RBAC 声明式矩阵 + 限流桶，同步 `.claude/rules/rbac.md`。

## 文件清单

- `internal/router/events_routes.go` — 新建
- `internal/router/router.go` — 修改：装配 EventsRisk/ApprovalCounts handler + 挂载
- `internal/router/events_routes_test.go` — 新建：路由×角色矩阵测试
- `.claude/rules/rbac.md` — 修改：矩阵表追加 6 行

## 接口设计 / 行为约定（路由表）

| 路由 | 方法 | RoleRequired | 限流桶 |
|---|---|---|---|
| `/admin/events/risk/summary` | GET | operator, finance, customer_service, super_admin | default 60/min |
| `/admin/events/risk/list` | GET | 同上 | default |
| `/admin/events/:event_id` | GET | 同上 | default |
| `/admin/events/:event_id/adjust-history` | GET | 同上 | default |
| `/admin/events/:event_id/risk-decision` | POST | operator, super_admin | sensitive 10/min |
| `/admin/approval/counts` | GET | 全部四角色 | default |

## 实施要点

- **super_admin 必须显式写进每行 allow**（rbac.md 硬规则：不自动通行）
- 禁止 handler 内写 role 判断，全部路由级 `RoleRequired`
- 限流复用现有 `sensitive` 桶建法（presale 同款 `RateLimiter.Group`）
- ⚠️ gin 路由冲突注意：`/admin/events/risk/summary` 与 `/admin/events/:event_id` 同组——gin 静态段优先于参数段，`risk` 不会被吞进 `:event_id`，但 `:event_id` handler 已有数字校验兜底（T02），测试需覆盖 `GET /admin/events/risk` 404

## 测试要求

table-driven 全矩阵（6 路由 × 4 角色 + 空 role + 未知 role）：

| 用例 | 期望 |
|---|---|
| finance GET summary | 200 |
| finance POST risk-decision | 403 INSUFFICIENT_ROLE |
| customer_service POST risk-decision | 403 |
| operator / super_admin POST risk-decision | 通过（到 handler） |
| 空 role 任意路由 | 403 |
| GET /admin/events/risk（无尾段） | 404 |

## 验收

`go build ./... && go test ./...` 绿；本地起 server 用 dev-token 四角色 token 实测矩阵；rbac.md 与代码逐行一致。
