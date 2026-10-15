# 01 · 鉴权 + RBAC

> 契约：api.md §2（JWT）、§3.4（/auth/me）、§1.5/§1.6（角色 + 路由矩阵）、§6.2（错误路由）。
> 仓库规则：`.claude/rules/{lark-oauth,rbac}.md`（注意 lark-oauth.md 的 `?token=` 回调页已过时，见 [`README.md`](./README.md) §2）。

---

## 1. JWT 存哪里 + 为什么

| 决策 | 选择 | 理由 |
|---|---|---|
| 存储 | `localStorage['oddfi_admin_jwt']` | 仓库 `CLAUDE.md` 约定 key。SPA 同源、纯 header 鉴权。 |
| **不存 Cookie** | ❌ | api.md §4.1 `Access-Control-Allow-Credentials: false`，避免 CSRF。 |
| 携带方式 | `Authorization: Bearer <jwt>`（ky beforeRequest） | api.md §1 Quick Reference。 |
| 过期 | 后端 8h（`jwt.ttl` 可能缩到 2h，DD-003 R-D3-12）。前端**软检查** `exp` | 前端只读 `exp` 做"快过期"提示，**不自行续签/改签**（lark-oauth.md 硬约束）。 |
| 续期策略 | **无刷新 token**。过期即重新走 Lark OAuth | 后端无 refresh endpoint；8h 内运营会话足够，过期跳登录可接受。 |
| 黑名单 | logout 写 Redis jti 黑名单（api.md §2.3），后端每请求校验 | 前端 logout 调 `POST /auth/logout` 后清 localStorage。 |

**身份来源的关键决策**：**role 与身份以 `GET /auth/me` 为准，不信任本地解码的 JWT claims**。

- 本地 `jwt.ts` 仅解 `exp` 做软过期（解析失败/过期 → 当未登录）。
- `getIdentity` / `getPermissions` 调 `/auth/me`（api.md §3.4 返回 `{user_id,name,email,avatar,role}`），Refine 自动缓存。
- ⚠️ 整个前端 RBAC 建立在 `role` 是字符串枚举上（后端 `model.Role` 是 `type Role string`，序列化为字符串）。`getPermissions` 拿到 role 后**用 union literal + 运行时校验**它落在 4 枚举内，否则当未授权——避免后端将来改枚举类型时前端静默全角色失效。
- 这样即便 JWT claims 的 `sub` 带 `lark:` 前缀差异（DD-003 §4.2.2）也不影响展示，且 role 永远是后端权威值。

---

## 2. authProvider 实现（api.md §2 / §6）

```ts
// src/providers/authProvider.ts
import type { AuthProvider } from "@refinedev/core";
import { api } from "@/lib/api";
import { isJwtExpired } from "@/lib/jwt";
import type { Identity } from "@/types/admin-user";

const JWT_KEY = "oddfi_admin_jwt";

export const authProvider: AuthProvider = {
  // 点登录 → 整页跳后端 OAuth 入口（Vite proxy/Nginx 转 :8081）
  login: async () => {
    window.location.href = "/auth/lark/login";
    return { success: true };
  },

  // Refine 每次路由切换调用。无 token 或本地 exp 过期 → 跳 /login
  check: async () => {
    const token = localStorage.getItem(JWT_KEY);
    if (!token || isJwtExpired(token)) {
      localStorage.removeItem(JWT_KEY);
      return { authenticated: false, redirectTo: "/login" };
    }
    return { authenticated: true };
  },

  logout: async () => {
    try {
      await api.post("auth/logout"); // 写 jti 黑名单；失败不阻塞本地清理
    } catch (e) {
      console.warn("[authProvider] logout revoke failed, clearing local token anyway", e);
    }
    localStorage.removeItem(JWT_KEY);
    return { success: true, redirectTo: "/login" };
  },

  // dataProvider 抛 401/TOKEN_* 时触发（api.md §6.2）
  onError: async (error) => {
    const code = error?.errorCode as string | undefined;
    if (["UNAUTHORIZED", "TOKEN_EXPIRED", "TOKEN_INVALID"].includes(code ?? "")) {
      localStorage.removeItem(JWT_KEY);
      return { logout: true, redirectTo: "/login" };
    }
    return {};
  },

  // 权威身份：调 /auth/me（不解本地 JWT）
  getIdentity: async (): Promise<Identity | null> => {
    const token = localStorage.getItem(JWT_KEY);
    if (!token) return null;
    const me = await api.get("auth/me").json<{ code: number; data: Identity }>();
    if (me.code !== 0) return null;
    return me.data; // { user_id, name, email, avatar, role }
  },

  // role 供 accessControlProvider / RoleGuard 消费
  getPermissions: async () => {
    const id = await authProvider.getIdentity?.();
    return (id as Identity | null)?.role ?? null;
  },
};
```

> **注意 401 双通道**：ky 的 `afterResponse` 也会在 401 时清 token + 跳登录（见 [`02-data-layer.md`](./02-data-layer.md) §2），作为 Refine 流程之外（如 getIdentity 自身 401）的兜底。两者幂等（都只是清 localStorage + 跳转），不会打架。

---

## 3. RBAC 4 角色矩阵（api.md §1.5/§1.6 + presale-admin §2）

| 资源 / 操作 | super_admin | operator | customer_service | finance |
|---|:---:|:---:|:---:|:---:|
| **查看**（rounds/deposits/anomaly/config/audit list+show） | ✅ | ✅ | ✅ | ❌ |
| **轮次状态机**（pause/resume/reopen/close） | ✅ | ✅ | ❌ | ❌ |
| **改 referral-pct** | ✅ | ✅ | ❌ | ❌ |
| **migrate-round** | ✅ | ✅ | ❌ | ❌ |
| **anomaly resolve** | ✅ | ✅ | ✅ | ❌ |
| **改 round 字段（PATCH /rounds/:id）** | ✅ | ❌ | ❌ | ❌ |
| **改 config（PATCH /config）** | ✅ | ❌ | ❌ | ❌ |
| **admin-users CRUD** | ✅ | ❌ | ❌ | ❌ |

> `finance` **本期无任何预售权限**（占位角色）。finance 登录后预售菜单全空 → 落地一个"本期无可用模块"空态页，避免白屏。
> ⚠️ **anomaly resolve 是 `customer_service+`**（含客服），但 migrate-round / 状态机是 `operator+`（不含客服）—— 这两个权限边界不同，别合并判断。

**真值来源**：本矩阵的代码真相是 `App.tsx` 的 `resources[].meta.roles` + 每个操作按钮的 `<RoleGuard allow=[...]>`。改矩阵必须同步：① 本表 ② `App.tsx` ③ `.claude/rules/rbac.md` ④ 后端 `RoleRequired`。

**安全边界**：前端 RBAC **只控可见性**，不是安全保证。后端 `RoleRequired` 中间件兜底返 403（api.md §1.6）。即便前端漏隐藏按钮，后端必须挡。写按钮时先确认后端该 endpoint 的 allow 列表，再写 `RoleGuard`。

---

## 4. accessControlProvider（菜单/资源级可见性）

Refine 用 `accessControlProvider.can()` 决定资源菜单是否显示。基于 resource 的 `meta.roles`：

```ts
// src/providers/accessControlProvider.ts
import type { AccessControlProvider } from "@refinedev/core";

type Role = "super_admin" | "operator" | "customer_service" | "finance";

// 资源 → 允许角色（与 App.tsx resources[].meta.roles 同源，可抽常量复用）
const RESOURCE_ROLES: Record<string, Role[]> = {
  presale: ["super_admin", "operator", "customer_service"],   // 一级分组：任一子页可见即显示该组
  dashboard: ["super_admin", "operator", "customer_service"],
  rounds: ["super_admin", "operator", "customer_service"],
  deposits: ["super_admin", "operator", "customer_service"],
  anomaly: ["super_admin", "operator", "customer_service"],
  config: ["super_admin", "operator", "customer_service"], // 读 cs+，写 super_admin（按钮级再控）
  audit: ["super_admin", "operator", "customer_service"],
  "admin-users": ["super_admin"],
};

export const accessControlProvider: AccessControlProvider = {
  can: async ({ resource }) => {
    const role = await authProvider.getPermissions?.() as Role | null;
    if (!role) return { can: false };
    const allowed = RESOURCE_ROLES[resource ?? ""] ?? [];
    return { can: allowed.includes(role) };
  },
  options: { buttons: { enableAccessControl: true, hideIfUnauthorized: true } },
};
```

> **资源级 vs 操作级**：`accessControlProvider` 管菜单/资源可见（如 admin-users 只对 super_admin 出现）。**操作级**（同一页里 pause 按钮 cs 不可见、config 保存按钮仅 super_admin）用 `<RoleGuard>` 包裹（[`04-components.md`](./04-components.md) 引用 rbac.md 模板）。两层配合。

> **一级分组的隐藏**：`hideIfUnauthorized: true` 下，Refine 对一级分组 `presale` 调 `can()`——返 false（如 finance）时整个「认购」组连同子页都不渲染；即使分组 `can()` 漏判，Refine 也会**自动隐藏所有子项都不可见的空父组**。所以 finance 登录后 Sider 无「认购」组（落空态页，见 [`03-pages.md`](./03-pages.md) §0 / [`07-ui-wireframes.md`](./07-ui-wireframes.md) §1）。

---

## 5. 路由守卫（整页保护，不手写 if-role）

用 Refine 的 `<Authenticated>` 包整个受保护布局；资源级用上面的 `accessControlProvider`；**不要**在每个 page 里手写 `if (role !== x) return <Forbidden/>`（rbac.md 约束）。

```tsx
// App.tsx 路由骨架（节选）
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route
    element={
      <Authenticated key="protected" fallback={<NavigateToResource resource="login" />}>
        <ThemedLayout Header={AdminHeader}><Outlet /></ThemedLayout>
      </Authenticated>
    }
  >
    <Route index element={<NavigateToResource resource="dashboard" />} />
    <Route path="dashboard" element={<DashboardPage />} />
    <Route path="rounds">
      <Route index element={<RoundsList />} />
      <Route path=":id" element={<RoundsShow />} />
    </Route>
    {/* deposits / anomaly / config / audit 同构 */}
    <Route path="admin-users">
      {/* 资源级 accessControlProvider 已挡非 super_admin；越权直敲 URL 时这里再兜底 */}
      <Route index element={<CanAccess resource="admin-users" action="list" fallback={<Forbidden />}><AdminUsersList /></CanAccess>} />
      <Route path="create" element={<CanAccess resource="admin-users" action="create" fallback={<Forbidden />}><AdminUsersCreate /></CanAccess>} />
    </Route>
    <Route path="*" element={<ErrorComponent />} />
  </Route>
</Routes>
```

---

## 6. RBAC 检查流程图（一次受保护请求）

```
用户点「暂停轮次」按钮
   │
   ▼
[前端 UX 层] <RoleGuard allow=["operator","super_admin"]>
   │  role ∈ allow ?
   ├── 否 → 按钮根本不渲染（customer_service/finance 看不到）   ← 仅 UX，不是安全
   └── 是 → 渲染按钮 → 点击 → ConfirmMutationModal（note + 影响摘要）
                 │ 确认
                 ▼
        POST /admin/presale/rounds/:id/pause
        Authorization: Bearer <jwt>   X-Idempotency-Key: <uuid>   body:{note}
                 │
                 ▼
   [后端 admin-backend] AdminAuthMiddleware → 验 JWT(HS256/exp/黑名单)
                 │  通过?
                 ├── 否 → 401 {UNAUTHORIZED|TOKEN_EXPIRED|TOKEN_INVALID}
                 │         → authProvider.onError → 清 token → 跳 /login
                 └── 是 → RoleRequired("operator","super_admin")
                              │  role ∈ allow ?
                              ├── 否 → 403 {INSUFFICIENT_ROLE}  ← 前端漏隐藏时的真·安全兜底
                              │         → notification「无权限」+ 不跳转
                              └── 是 → noteValidator(note≥10) → 转发 web-api → 业务
```

**结论**：安全由后端 403 兜底；前端 RoleGuard/accessControl 只是减少误操作和无效请求。两者都要做，但职责分明。
