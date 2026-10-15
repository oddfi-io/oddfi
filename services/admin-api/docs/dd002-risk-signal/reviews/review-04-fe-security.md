# Review 04 · 前端安全 review（T06-T08，security-reviewer agent）

> 日期：2026-06-05 ｜ 对象：oddfi-admin-frontend `feat/risk-signal`（2245a45 / 57e1430 / 8f6ac62）
> 结论：**LOW 风险，无可利用漏洞**；1 项加固已处理（修复 commit `883ed1b`），1 项转 backlog

## 发现与处置对照

| # | 级别 | 问题 | 处置 |
|---|---|---|---|
| M-Sec-1 | Medium | `pnpm audit` 4 条传递依赖 CVE（path-to-regexp ReDoS via @refinedev/antd、qs DoS via @refinedev/core、postcss via geist——**全部存量，非本分支引入**；内部已鉴权 SPA 可达性 ~nil） | ⏸ 转 backlog ENH：独立 dep bump（`pnpm up @refinedev/antd @refinedev/core` 或 pnpm overrides），不阻断本 DD |
| L-Sec-1 | Low | `/events` 路由未包 `<CanAccess>`（与 admin-users 不对称；当前四角色全读无实际越权面） | ✅ 自动修：CanAccess + Forbidden 对称加固，防将来收紧矩阵时静默漏守卫 |
| L-Sec-2 | Low | 后端展示串（odds_diff/direction_name 等）原样渲染的信任边界提示 | 确认安全：全部 JSX 文本节点自动转义，diff 内零 dangerouslySetInnerHTML/innerHTML/eval；不修 |
| L-Sec-3 | Low | event_id 进 CSS 选择器 / URL 路径 | 确认安全：`CSS.escape` + `encodeURIComponent` 全覆盖（含测试） |

## 确认安全项（要点）

- **XSS**：无 raw-HTML sink；所有后端字段经 React 自动转义 ✅
- **JWT**：新代码不触 `oddfi_admin_jwt` 之外存储；日志无 token/PII ✅
- **RBAC**：决策按钮 `RoleGuard(operator/super_admin)` 与后端矩阵一致；前端仅 UI 可见性，后端 403 兜底 ✅
- **幂等**：X-Idempotency-Key = crypto UUID v4，ApiError 后轮换 / 网络错误保留重试，不可预测 ✅
- **决策 body 只含 `{action, remark}`**，无 operator 字段（operator 由 web-api 从 X-Admin-JWT 解码，前端不可冒充）✅
- **乐观更新不可滥用**：仅服务端确认 `decided` 才本地退队；终态错误走 invalidate 重新同步，红灯不会被前端"静默消音" ✅
- **供应链**：新增直接依赖仅 `@ant-design/icons@5.6.1`（AntD 官方配套，精确锁版）✅
