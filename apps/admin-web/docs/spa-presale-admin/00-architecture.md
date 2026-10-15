# 00 · 架构 · 技术栈选型 + 目录结构 + OAuth 流程

> 上游：[`README.md`](./README.md) §1 概要。本文展开技术栈论证、目录树、Lark OAuth 流程图。

---

## 1. 技术栈选型（逐项论证）

| 关注点 | 选型 | 论证 |
|---|---|---|
| 框架 | **Refine 5**（core@5 / antd@6 / react-router@2） | 仓库已装。dataProvider/authProvider/accessControlProvider 与后端契约 1:1，省掉大量胶水。 |
| UI | **AntD 5** + Vercel 主题 | 企业组件齐全；`vercelTheme.ts` 已落地，禁止再引第二套样式系统（Tailwind/styled-components）。 |
| 服务端状态 | **TanStack Query（Refine 内置）** | 满足 brief §八 诉求。直接用 Refine hooks（`useList/useOne/useCustom/useCustomMutation`），不手动 new QueryClient。 |
| HTTP | **ky**（已装） | 轻量，hooks 机制适合注入 `Authorization` + `X-Idempotency-Key` + 401 拦截。收敛到 `src/lib/api.ts`，禁止页面里直接 `fetch/ky`。 |
| 金额 | **decimal.js**（已装） | API 金额全是 `string`（`DECIMAL(38,18)`）。**禁止 `parseFloat`**，统一 `formatAmount()`。 |
| 时间 | **dayjs + utc + timezone**（dayjs 已装，插件需引） | presale 时间是 epoch ms，admin-users 是 RFC3339；统一 `formatTs()` 转 `Asia/Shanghai (+08:00)`。 |
| 校验 | **AntD Form 原生 `rules` + 小 helper**（**不引 zod**） | `note ≥ 10 rune`、decimal 字符串、必填用 AntD validator 实现。校验逻辑简单，无需引第三方 schema 库，符合轻开发。 |
| idempotency key | **`crypto.randomUUID()`**（浏览器原生，无库） | DD-003 要求 UUIDv4。原生 API 现代浏览器全支持，admin 后台无低版本兼容负担。 |
| 状态机可视化 | **自研轻量组件**（CSS/SVG），不引 `@ant-design/charts` | 4 节点固定图，自研 < 80 行；charts 仅在真要数据图表（Dashboard 募集进度）时引。design-tokens.md 禁止 mesh/插画。 |

**M0 不新增任何 npm 依赖**：dayjs 的 `utc` / `timezone` 是 dayjs 自带插件（无新包），校验用 AntD Form。后续若上单测（ENH）需新增 vitest + testing-library，届时按 `api-conventions.md` 出选型对比表再确认。

---

## 2. 目录结构

现状：`src/` 仅有 `App.tsx`、`main.tsx`、`theme/`。目标树（新增标 `+`）：

```
src/
├── main.tsx                      # 入口；mount 前先跑 bootstrapAuthFromHash()（解析 #token）
├── App.tsx                       # ✎ 替换 resources：dashboard/rounds/deposits/anomaly/config/audit/admin-users
├── lib/
│   ├── api.ts                  + # ky 单例：注入 JWT + X-Idempotency-Key + 401 拦截
│   ├── amount.ts               + # formatAmount / decimal 包装（禁 parseFloat）
│   ├── time.ts                 + # formatTs（epoch ms / RFC3339 → +08:00）、tsToDayjs
│   ├── jwt.ts                  + # 仅本地解 exp 做软过期检查（不做安全判定）
│   ├── bscscan.ts              + # txHash/address → BSCscan URL
│   └── validators.ts           + # AntD Form validator helpers（note≥10 rune / decimal 字符串）
├── providers/
│   ├── dataProvider.ts         + # 信封拆包 + 分页参数适配（per-resource）
│   ├── authProvider.ts         + # Lark login/check/logout/onError/getIdentity/getPermissions
│   └── accessControlProvider.ts+ # 基于 role 的 can() —— 菜单/按钮可见性
├── hooks/
│   ├── usePermissionRole.ts    + # 包 usePermissions，返回当前 role（类型安全）
│   ├── useRoundActions.ts      + # pause/resume/reopen/close/referral-pct（useCustomMutation）
│   ├── useDepositActions.ts    + # migrate-round
│   ├── useAnomalyActions.ts    + # resolve
│   └── useConfigMutation.ts    + # config PATCH（含 vault warning 处理）
├── components/
│   ├── RoleGuard.tsx           + # 仅控制可见性（rbac.md 模板）
│   ├── ConfirmMutationModal.tsx+ # 唯一必须自研的件（影响摘要 + note + idempotency）
│   ├── RoundStatusTag.tsx      + # status → AntD Tag（薄封装）
│   ├── AmountText.tsx          + # 金额渲染（decimal.js + mono，薄封装）
│   ├── TxHashLink.tsx          + # BSCscan 跳转（薄封装）
│   └── CutoverBanner.tsx       + # min_subscribe_usd≈0.01 警示横幅（薄封装 Alert）
│   # 状态机用 AntD <Steps>、audit diff 用 <Descriptions> —— 内联即可，不单独建组件
├── pages/
│   ├── auth/
│   │   ├── login.tsx           + # Lark 登录入口（按钮 → authProvider.login）
│   │   └── callback.tsx        + # 兜底：若后端改回 query 模式时用（默认 hash 在 main.tsx 处理）
│   ├── dashboard/index.tsx     + # 6 轮状态卡 + config 摘要 + 最近 5 audit
│   ├── rounds/{list,show}.tsx  + # 列表 + 详情（状态机操作入口）
│   ├── deposits/{list,show}.tsx+ # 列表（过滤）+ 详情（migrate 入口）
│   ├── anomaly/{list,show}.tsx + # 列表 + 详情（resolve 入口）
│   ├── config/index.tsx        + # 全局配置读 + PATCH（super_admin）
│   ├── audit/list.tsx          + # 审计日志（过滤 + 实时刷新）
│   └── admin-users/{list,create}.tsx + # super_admin 管理
├── types/
│   ├── api.ts                  + # ApiResponse<T> / ApiError / Paginated<T>
│   ├── presale.ts              + # Round/Deposit/Anomaly/Config/Audit DTO（camelCase）
│   └── admin-user.ts           + # AdminUser DTO（snake_case）
└── theme/                        # 现有 vercelTheme.ts + vercel.css（不动）
```

**约束复述**（`refine-conventions.md`）：resource 名 = 后端路径段 = 文件夹名；不写 create/edit 页除非真有创建场景（rounds/deposits/anomaly/config 都没有"新建"，操作走行内/详情页按钮）。

---

## 3. Lark OAuth 流程（fragment 模式，api.md §2.2 / §6.1）

```
┌──────────┐  1. 访问 admin.oddfi.io，authProvider.check 无 JWT
│  用户浏览器 │ ───────────────────────────────────────────────┐
└──────────┘                                                  ▼
      ▲                                          authProvider.login()
      │                                          window.location = "/auth/lark/login"
      │                                                        │
      │ 6. 落地根路径 /#token=<JWT>                              ▼ (Vite proxy / Nginx → :8081)
      │    main.tsx bootstrapAuthFromHash():               ┌─────────────────┐
      │    - 解析 location.hash 的 token=                   │  admin-backend   │
      │    - localStorage['oddfi_admin_jwt'] = token       │  GET /auth/lark/ │
      │    - history.replaceState(null,'','/')  ← 抹 hash  │  login           │
      │    - 然后才 mount <App/>                            └────────┬────────┘
      │                                                            │ 2. 302 + state 写 Redis(10min)
      │                                                            ▼
      │                                            ┌───────────────────────────┐
      │                                            │ open.larksuite.com/authorize│
      │                                            │ 用户点「同意」               │
      │                                            └──────────────┬────────────┘
      │                                                           │ 3. 302 回 callback
      │                                            ┌──────────────▼────────────┐
      │                                            │ GET /auth/lark/callback     │
      │  5. 302 Location:                          │  ?code=..&state=..          │
      └─────── https://admin.oddfi.io/#token=JWT ──│  校验 state→换 token→拉      │
                                                   │  user_info→白名单→签 HS256  │
                                                   │  JWT(8h, claims §2.1)       │
                                                   └─────────────────────────────┘
                                            4. 不在白名单 → 302 ...#error=NOT_ADMIN
```

**前端实现要点**：

- **fragment 在根路径 `/` 解析**，不是 `/auth/lark/callback`。在 `main.tsx` 里 mount `<App/>` **之前**同步执行 `bootstrapAuthFromHash()`，避免 React Router 先吃掉路由。
- 解析后**立刻** `history.replaceState(null, '', location.pathname)` 抹掉 `#token`（api.md §2.2，防书签/分享泄漏 JWT）。
- 错误也走 fragment：`/#error=NOT_ADMIN`（或 `LARK_STATE_MISMATCH` 等）。bootstrap 解析到 `error` → 存进内存 → 跳 `/login?error=<code>` 展示对应文案（错误码→文案见 [`02-data-layer.md`](./02-data-layer.md) §5）。
- **禁止把 JWT 写 Cookie**（api.md §4.1 `Allow-Credentials: false`，纯 header 鉴权）。

```ts
// src/main.tsx（节选）—— mount 前 bootstrap
function bootstrapAuthFromHash() {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return;
  const params = new URLSearchParams(hash);
  const token = params.get("token");
  const error = params.get("error");
  if (token) {
    localStorage.setItem("oddfi_admin_jwt", token);
    window.history.replaceState(null, "", window.location.pathname); // 抹 hash
  } else if (error) {
    // ⚠️ error 来自 URL fragment，用户可任意构造（#error=<payload>）。
    // 必须白名单过滤后再存，且 /login 页只能按 code 查表渲染纯文本，绝不把原值插入 DOM/href（防反射 XSS）。
    const KNOWN = new Set(["NOT_ADMIN", "LARK_STATE_MISMATCH", "LARK_EXCHANGE_FAILED", "LARK_USER_INFO_FAILED"]);
    sessionStorage.setItem("lark_login_error", KNOWN.has(error) ? error : "UNKNOWN");
    window.history.replaceState(null, "", "/login");
  }
}
bootstrapAuthFromHash();
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
```

> **`crypto.randomUUID()` 仅在 secure context（HTTPS / localhost）可用**。生产 `admin.oddfi.io` 是 HTTPS、本地 `localhost:5173` 也算，正常无碍；但若有人用 `http://<IP>` 或非 localhost http 域名联调，`randomUUID` 抛错会连带打挂 `beforeRequest`（X-Request-ID）+ idempotency key 生成 → 所有 mutation 不可用。`lib/api.ts` 的 UUID 生成建议加 fallback：`crypto.randomUUID?.() ?? <getRandomValues 拼 v4>`。
