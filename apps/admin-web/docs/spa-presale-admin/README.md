# SPA 前端实施方案 · 预售运营后台

> **定位**：`oddfi-admin-frontend` 仓库的预售运营后台（`/admin/presale/*` + admin-users）前端实施方案。
> **目标读者**：后续落地的前端 dev agent。
> **契约源真值**：`~/work/oddfi-admin-backend/docs/api.md`（admin-backend HTTP 全契约）。本方案引用其 §X.Y，**不复制契约**。
> **结构**：仿 `oddfi-backend/web-api/docs/dd-invest/` 多文档编号风格，本 README 为索引 + 概要 + 里程碑。

---

## 0. 文档索引

| 文件 | 覆盖 | brief 章节 |
|---|---|---|
| [`00-architecture.md`](./00-architecture.md) | 技术栈选型论证、目录结构、Lark OAuth 流程图 | §1 §2 |
| [`01-auth-rbac.md`](./01-auth-rbac.md) | JWT 存储、authProvider、accessControlProvider、路由守卫、RBAC 矩阵 + 检查流程图 | §4 |
| [`02-data-layer.md`](./02-data-layer.md) | ky client、dataProvider 拆包、错误码→UI 映射表、idempotency_key 生命周期 | §5 §6 |
| [`03-pages.md`](./03-pages.md) | 每页实现摘要、page→endpoint→DTO 映射、关键 UX | §3 §7（UX 细节） |
| [`04-components.md`](./04-components.md) | 二次确认模态可复用组件、轮次状态机可视化、cutover 横幅、audit 轮询 | §7 §8 |
| [`05-deploy.md`](./05-deploy.md) | 部署、nginx location 改动、deploy.sh、CI、联调 | §9 |
| [`06-acceptance-and-tasks.md`](./06-acceptance-and-tasks.md) | 4 角色验收 checklist、按 milestone 任务拆解 | §10 §11 |
| [`07-ui-wireframes.md`](./07-ui-wireframes.md) | 每个页面的 ASCII 线框图（布局/字段/操作/角色显隐） | — |

---

## 1. 概要（技术栈 + 为什么）

**技术栈基线**（已与仓库 `package.json` + `CLAUDE.md` 对齐）：

- **Refine 5 + AntD 5 + @refinedev/antd 6 + react-router 7**（仓库已锁定，`CLAUDE.md` 硬约束）。Refine 内置 TanStack Query，满足 brief §八「TanStack Query 服务端状态」诉求，无需额外引入。
- **ky** 做 HTTP（已有依赖），所有请求收敛到 `src/lib/api.ts`，beforeRequest 注入 `Authorization` + `X-Idempotency-Key`。
- **decimal.js** 处理金额（已有依赖），API 金额全是 `string`，**禁止 `parseFloat`**。
- **dayjs + utc/timezone 插件** 处理时间：presale 接口时间是 epoch ms（`BIGINT`），统一转 `+08:00` 显示。
- **表单校验走 AntD Form 原生 `rules` + 小 helper（不引 zod）**：`note ≥ 10` rune、decimal 字符串、必填都用 AntD validator 实现，符合轻开发。`crypto.randomUUID()`（浏览器原生）生成 idempotency_key，**不引第三方 uuid 库**。**M0 不新增任何 npm 依赖**（dayjs utc/timezone 是自带插件）。

**为什么是 Refine 而非裸 React**：brief §八列的是裸 React + TanStack Query，但本仓库 `CLAUDE.md` 已锁定 Refine，且 Refine 的三件套 provider 与后端契约**天然 1:1**：

| Refine provider | 映射后端契约 |
|---|---|
| `dataProvider` | `{code,message,data}` 信封拆包 + `{list,total}` 分页（api.md §1.1） |
| `authProvider` | Lark OAuth + JWT + `/auth/me` 身份 + 401 拦截（api.md §2 §6.2） |
| `accessControlProvider` | 4 角色 RBAC 菜单/按钮可见性（api.md §1.5/§1.6） |

裸 React 需手写这些胶水，且与仓库现状冲突。结论：**Refine + 自定义 provider**。

---

## 2. ⚠️ 落地前必读：现状与契约的 5 个偏差（均已从后端源码确认）

dev agent 开工前必须知道，否则会照着错误的脚手架/旧规则/DB 模型写：

1. **`src/App.tsx` 现有 resources 是过时占位**（`users / bets / withdrawals / admin-users`，对应"用户管理/注单/出金审核"）。admin-backend **只实现了 presale + admin-users**，没有 bets/withdrawals。必须替换为**两级模块化导航**：一级分组「认购」（可折叠）下挂 `dashboard / rounds / deposits / anomaly / config / audit` 六个二级功能页（`meta.parent: "presale"`），`admin-users` 作平台级顶层。未来加大模块 = 并列加一个一级分组。详见 [`03-pages.md`](./03-pages.md) §0、布局见 [`07-ui-wireframes.md`](./07-ui-wireframes.md) §1。

2. **JWT 走 URL fragment，不是 query**。api.md §2.2 明确：回调成功后 `302 → https://admin.oddfi.io/#token=<JWT>`，token 在 `location.hash`，落在**根路径** `/`，不是 `/auth/lark/callback?token=`。仓库 `.claude/rules/lark-oauth.md` 里写的 `?token=` 回调页是**旧设计，已过时**——以 api.md §2.2 为准。详见 [`01-auth-rbac.md`](./01-auth-rbac.md)。

3. **所有 mutation 必须带 `X-Idempotency-Key` header** ✅（已从后端源码确认 `oddfi-admin-backend/internal/handler/presale_round.go:requireIdempotencyKey`）。缺失返 `IDEMPOTENCY_KEY_REQUIRED`（400）；admin-backend **剥掉 `Bearer ` 前缀后转成 `X-Admin-JWT`** 转发，`X-Idempotency-Key` 透传且参与 HMAC 签名发往 web-api。GET 不需要 idempotency key。生命周期见 [`02-data-layer.md`](./02-data-layer.md) §6。

4. **混合命名/类型约定** ✅（已从后端源码确认）：
   - presale 响应 **camelCase**（`roundId / blockTs / createdAt`）；admin-users/auth 响应 **snake_case**（`lark_user_id / created_by`）。
   - presale 时间是 **epoch ms 数字**（`startTs / endTs / tgeTs / blockTs`）；admin-users/auth 时间是 **RFC3339 字符串**（`created_at`）。
   - 分页参数：admin-users 用 `page` / `page_size`；deposits/anomaly/audit 用 `page` / `size`；**rounds 不分页**（返回全部 6 轮）。

5. **⚠️ 前端收到的字段集 = `oddfi-admin-backend/internal/client/types.go` 的 DTO，比 `data-model.md` 的 DB 模型小很多** ✅（已从源码确认）。后端没透出的字段前端拿不到，典型缺失：`Round.name` / `Round.targetRaiseUsd`、`Deposit.anomalyReason` / `Deposit.blockNumber`、`AnomalyEvent.payloadJson`。且 `tgeReleasePct` 是 **string**、deposit 时间字段叫 **`blockTs`**。完整确认表见 [`03-pages.md`](./03-pages.md) §0。**要新增字段须先改后端**。

---

## 3. 里程碑速览（详见 [`06-acceptance-and-tasks.md`](./06-acceptance-and-tasks.md)）

| M | 范围 | 可独立 ship 的产出 |
|---|---|---|
| **M0** | 基建：依赖、api client、dataProvider、authProvider、accessControlProvider、RoleGuard、布局壳 | 能 Lark 登录、能看空 Dashboard、401 自动跳登录 |
| **M1** | 只读全覆盖：rounds/deposits/anomaly/config/audit list+detail + admin-users 列表 | customer_service 角色完整可用（纯查看） |
| **M2** | 轮次状态机 + 二次确认模态 + idempotency：pause/resume/reopen/close + referral-pct | operator 角色可操作轮次 |
| **M3** | 高敏 mutation：round PATCH、config PATCH、migrate-round、anomaly resolve | super_admin/operator 完整可用 |
| **M4** | admin-users CRUD（create/role/delete）+ 自删/最后 super_admin 保护 UX | super_admin 完整可用 |
| **M5** | 打磨：Dashboard 状态卡、状态机可视化、audit 实时刷新、cutover 横幅、BSCscan 链接、4 角色验收 | 上线候选 |

---

## 4. 关联文档

- 后端契约：`~/work/oddfi-admin-backend/docs/api.md`、`docs/presale-admin/README.md`
- 上游 DD：`~/work/oddfi-backend/web-api/docs/dd-invest/03-admin-api-contract.md`、`01-data-model.md`、`DD-003-admin-rpc-rework.md`
- 仓库规则：`.claude/rules/{refine-conventions,design-tokens,api-conventions,lark-oauth,rbac,code-quality}.md`
- 设计语言：`docs/DESIGN-SYSTEM.md` + `docs/THEME-MAPPING.md` + `src/theme/vercelTheme.ts`
