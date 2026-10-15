# ISSUE-001 · `GET /admin/presale/config` 返回 Lark webhook 完整 URL（明文凭据泄漏）

- **状态**：Open（⚠️ 2026-05-27 prod 实测 `GET /admin/presale/config` 返回的 `larkWebhookUrl` 已是 `…/hook/****` → 后端疑似已落 mask；待确认后端代码后可关闭）
- **严重度**：**High**（凭据泄漏）
- **类型**：安全
- **发现日期**：2026-05-27
- **主要仓库**：`oddfi-backend/web-api`（根因）；`oddfi-admin-backend`（契约声明 + 薄壳透传）
- **关联**：前端方案 `docs/spa-presale-admin/03-pages.md` §6（config 页）、`06-acceptance-and-tasks.md` §4

## 现象 / 契约

`oddfi-admin-backend/docs/presale-admin/README.md:626` 安全约束明确声称：

> 所有响应不包含敏感信息（如 Lark webhook 完整 URL（返回时 mask 最后 16 字符）、其他用户 EOA）

即契约承诺 `GET /admin/presale/config` 返回的 `larkWebhookUrl` 已被 mask。

## 源码实际（证据）

**未实现 mask，返回明文**：

- `oddfi-backend/web-api/internal/service/presale_admin_config.go:66` — `GetConfig` 直接返回 `model.PresaleConfig`，无任何 mask 处理。
- `oddfi-backend/web-api/internal/handler/admin/config.go:17` — handler `get` 原样 `data: cfg` 下发。
- `oddfi-admin-backend/internal/handler/presale_config.go` — 薄壳把 web-api 响应原样透传给前端。

最终前端拿到的是完整 `larkWebhookUrl`。

## 影响

- Lark 自定义机器人 webhook 形如 `https://open.larksuite.com/open-apis/bot/v2/hook/<secret-uuid>`，其中 `<secret-uuid>` **即推送凭据**，任何人持有即可向运营群发送伪造告警 / 钓鱼消息。
- `GET /admin/presale/config` 的 RBAC 是 **`customer_service+`（读权限）**，比写 config 的权限（`super_admin` only）**宽**。任一可读角色（含客服）打开 config 页 → 浏览器即拿到明文凭据 → 凭据外泄面扩大。

## 建议修复

1. **web-api（根因）**：在 `GetConfig` 组装响应 DTO 时对 `larkWebhookUrl` 做 mask（保留可识别前缀，末段打码，如 `…/hook/****`），落实 `README.md §7` 已声明的契约。注意：写回（`UpdateConfig`）入参仍接受完整 URL，仅**出参**打码。
2. **admin-backend docs**：确认 `presale-admin/README.md §7` 与实现一致后无需改；若决定不在后端 mask，需删除该条声明并通知前端（前端当前已自行打码兜底）。

## 前端已做的缓解（不替代后端修复）

前端方案已规定：config 页展示前自行截断 `larkWebhookUrl`（仅显示末段打码），且该字段**不提供复制按钮**。但明文仍通过网络下发到浏览器，根因须后端修。

## 验收

- [ ] `GET /admin/presale/config` 响应的 `larkWebhookUrl` 不含完整 `<secret-uuid>`（curl 抓包确认）。
- [ ] `PATCH /admin/presale/config` 仍能用完整 URL 写入（出参打码不影响入参）。
- [ ] README §7 契约与实现一致。
