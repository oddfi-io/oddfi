# oddfi-admin-frontend

OddFi 运营后台 · 前端（React 19 + Vite + Refine + Ant Design）。

仅供 OddFi 内部运营 / 客服 / 财务使用，通过 **Lark SSO** 登录。

---

## 与后端的关系

| | 仓库 | 端口 | 角色 |
|---|---|---|---|
| 前端 | `oddfi-admin-frontend`（本仓库） | `:5173`（本地 dev） | SPA，Refine 框架壳子 |
| 后端 | `oddfi-admin-backend`（`~/work/oddfi-admin-backend`） | `:8081` | Lark OAuth 回调 + `/admin/*` CRUD API |

**两者关系：**

- 前端不存任何用户密码 —— 登录入口是 Lark SSO
- 登录跳转链路：前端按钮 → 后端 `GET /auth/lark/login` → Lark 授权页 → 后端 `GET /auth/lark/callback` → 后端签发 JWT → 重定向回前端首页 `#token=<JWT>`（写到 URL fragment，避开 Referer/log 泄漏）
- 前端从 `window.location.hash` 取 JWT 存 localStorage，后续 API 调用走 `Authorization: Bearer <JWT>`
- 所有业务接口前缀 `/admin/*`，受后端 `AdminAuthMiddleware + RoleRequired` 双重保护

详细 OAuth 流程见后端仓库 `docs/lark-oauth-flow.md`。

---

## 设备准入(mTLS,Lark 之外的第二道门)

生产 `admin.oddfi.io` 启用 **mTLS 客户端证书白名单**:只有装了我们自签 CA 证书的设备才能访问(enforce 模式下无证书直接 403,连登录页都看不到),之后才轮到 Lark SSO 鉴权。

```bash
ssh oddfi-admin 'sudo oddfi-mtls issue <人名-设备>'   # 新设备发证
ssh oddfi-admin 'sudo oddfi-mtls revoke <name>'      # 吊销(离职/丢设备)
ssh oddfi-admin 'sudo oddfi-mtls enforce on|off'     # 强制 / 观察模式
```

- 完整指南(发证/导入/吊销/排障):[`docs/ops/mtls-runbook.md`](docs/ops/mtls-runbook.md)
- 日常操作有 skill:对 Claude Code 说「给 alice 发证书」即可(`.claude/skills/mtls-device-cert`)
- 本地 dev(`localhost:5173`)不走 mTLS,只管生产域名

---

## 本地开发

### 前置

1. 后端已起：在 `~/work/oddfi-admin-backend` 跑 `go run cmd/server/main.go`（监听 `:8081`）
2. 后端 `config.yaml` 里：
   - `lark.redirect_uri` = `http://localhost:5173/auth/lark/callback`
   - `cors.allowed_origins` 含 `http://localhost:5173`
   - `frontend.callback_url` = `http://localhost:5173/auth/lark/callback`（后端 OAuth 成功后 302 回此地址，附 `#token=<JWT>` fragment）
3. Lark 开放平台「重定向 URL 白名单」已加 `http://localhost:5173/auth/lark/callback`

### 启动

```bash
pnpm install
pnpm dev
# 监听 http://127.0.0.1:5173
```

### 端口约定（重要）

**前端固定 `5173`，不要改。**

理由：
- 这个端口字符串写进了 **Lark 开放平台「重定向 URL 白名单」**，OAuth 校验是字面量匹配，端口飘走就直接 403
- `vite.config.ts` 里设了 `strictPort: true` —— 端口被占用会直接报错而不是 Vite 默认的 fallback 行为（避免静默漂移到 5174 导致 OAuth 失败）

**为什么不用 5000**：macOS Monterey+ 的 AirPlay Receiver 默认占用 5000，会冲突。Vite 默认 5173 安全且是社区惯例。

### Dev 代理

`vite.config.ts` 已配 `/auth` `/admin` → `http://127.0.0.1:8081`：

- 浏览器请求 `http://localhost:5173/admin/users` 实际打到后端 `:8081`
- 同源访问，dev 环境不踩 CORS / SameSite cookie

生产环境由 Nginx 反代承担同样职责（见后端仓库 `deploy/nginx.conf.example`）。

---

## 目录结构（计划）

```
src/
├── main.tsx              # Refine 入口
├── App.tsx               # 路由 + Refine resources
├── providers/
│   ├── authProvider.ts   # Lark SSO 登录 / JWT 校验 / 登出
│   └── dataProvider.ts   # 基于 Refine simple-rest 适配后端 ApiResponse 包装
├── pages/
│   ├── login/            # /login —— 单独的"用 Lark 登录"按钮页
│   ├── users/            # /admin/users CRUD
│   ├── withdrawals/      # /admin/withdrawals 审核
│   ├── settlements/      # /admin/settlements 结算操作
│   └── admin-users/      # /admin/admin-users（仅 super_admin）
└── components/
    └── icons/            # 自定义 SVG 图标（项目规则：不擅用 Phosphor 替代品牌图标）
```

> 当前 DD001 阶段：后端 Lark OAuth + RBAC + admin-users CRUD 已完工。前端尚未接入，待后端部署 + 拿到 App ID/Secret 后开始 `authProvider` + 登录页。

---

## 后端响应契约

后端统一响应壳（见后端仓库 `internal/pkg/response`）：

```jsonc
// 成功
{ "code": 0, "message": "ok", "data": <T> }

// 业务错误（HTTP 4xx/5xx + code 字符串）
{ "code": "INSUFFICIENT_ROLE", "message": "operator role not allowed", "data": null }
```

`dataProvider.ts` 需要剥一层 `data` 字段，并按错误 code 分支路由（`UNAUTHORIZED` → 跳登录，`INSUFFICIENT_ROLE` → 提示无权限）。

错误码常量见后端 `internal/pkg/errcode/errcode.go`。

---

## 联调 checklist

- [ ] 后端在 `:8081` 起来，`curl http://127.0.0.1:8081/health` 返回 `{"status":"ok"}`
- [ ] Lark App ID/Secret 注入后端环境变量（参见后端 `.progress/design/oauth/tasks/DD001-OPS-02-ec2-systemd-env.md` 或本地用 `config.yaml`）
- [ ] 后端 `lark.redirect_uri` 与 Lark 白名单字符串完全一致
- [ ] 浏览器开 `http://localhost:5173`，点"用 Lark 登录"，能跳到 Lark 授权页（不是 redirect_uri 报错页）
- [ ] 授权完回到前端 `#token=...`，前端能取出 JWT 并调通 `/admin/admin-users`

---

## License

Internal use only.
