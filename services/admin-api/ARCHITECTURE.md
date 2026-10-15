# 接手项目指南

## 1. 项目整体用途

OddFi 运营后台后端服务。给 `oddfi-admin-frontend`（Refine + Ant Design 单页应用）提供 Lark OAuth 登录回调和运营 CRUD API。所有路由分两类：

- `/auth/lark/*` — Lark OIDC 三步登录回调
- `/admin/*` — 运营 CRUD，4 角色 RBAC

**与 C 端的关系**：

- 同一 MySQL 实例（直接 JOIN `users` / `user_balance` / `user_bet_holding` / `withdraw_record` 等业务表）
- 独立 Go 进程（端口 `:8081`），由 Nginx 反代到 `admin.oddfi.io`
- 独立 `admin_users` 表（不与 C 端 `user` 表混用）
- **不走** C 端 `/api/*` 业务接口，避免循环依赖

## 2. 目录结构

```
oddfi-admin-backend/
├── cmd/server/main.go                # 启动入口
├── internal/
│   ├── config/                       # YAML 配置加载 + env 覆盖 + 严格 validate
│   ├── router/                       # Gin 路由注册（health / auth / admin）+ 依赖装配
│   ├── handler/                      # HTTP 参数绑定、响应包装（auth / admin_users / health）
│   ├── service/                      # 业务编排（lark_oauth：state CSRF + code 换 token + 白名单）
│   ├── repository/                   # MySQL 访问（admin_users：CRUD + 事务内最后一个 super_admin 阻断）
│   ├── model/                        # DTO + GORM 模型（admin_user / role 枚举）
│   ├── middleware/                   # auth / rbac / cors / request_id / ratelimit / security_headers
│   └── pkg/                          # 通用封装：logger / response / errcode / mysql / redis / jwt
├── migrations/0001_create_admin_users.sql
├── docs/                             # api.md（接口契约）/ lark-app-binding.md（Lark 应用绑定）
├── deploy/                           # 生产部署 artifact：systemd unit / env 模板 / nginx 模板 / runbook
├── scripts/dev-server.sh             # 本地 dev：从 macOS keychain 读 secret 注入后跑 go server
├── cmd/dev-token/                    # 本地 dev：跳过 OAuth 直接签 admin JWT 给 curl/Postman 用
├── .progress/design/oauth/           # DD001 方案 + tasks 索引（本地，未入库）
├── config.example.yaml               # 配置示例（实际 config.yaml 不入库）
├── Makefile
└── README.md / CLAUDE.md / AGENTS.md / ARCHITECTURE.md
```

## 3. 程序启动入口

入口 `cmd/server/main.go`。启动顺序：

1. 初始化 logger（zerolog）
2. 读取配置文件（`-config` flag，默认 `./config.yaml`；生产 systemd 用 `/etc/oddfi-admin/config.yaml`）、应用 env 覆盖、严格 validate（JWT secret ≥ 32B、TTL ≤ 24h、Lark 必填、redirect_uri 必填）
3. `router.Setup`（10s 超时 ctx 内完成）：
   - 连接 MySQL（GORM，SkipDefaultTransaction、PrepareStmt、UTC NowFunc）
   - 连接 Redis（go-redis/v9）
   - 初始化 JWT service（HS256、jti uuid、Redis 黑名单 fail-closed）
   - 初始化 admin_users repository
   - 初始化 Lark OAuth service（独立 http.Client、10s timeout）
   - 装配 handler，注册全局中间件（RequestID / SecurityHeaders / CORS）和路由
   - 限流容器 `RateLimiter`：default 60/min（配置覆盖），lark_auth 10/min，presale_sensitive 10/min，events_sensitive 10/min（DD002 红灯决策）；后台 GC 30 分钟闲置回收
   - `SetTrustedProxies(["127.0.0.1/32","::1/128"])`，禁止伪造 XFF 绕过限流
4. 启动 HTTP Server，监听 `:8081`
5. 优雅退出：收到 SIGINT/SIGTERM 后最多 30s 关闭 HTTP，再关 Redis → MySQL（LIFO）

### 主要路由（DD001 已落地部分）

| 方法 | 路径 | 鉴权 | 限流 | RBAC |
|---|---|---|---|---|
| GET | `/health` | — | — | — |
| GET | `/auth/lark/login` | — | lark_auth 10/min | — |
| GET | `/auth/lark/callback` | — | lark_auth 10/min | — |
| GET | `/auth/me` | AdminAuth | default | — |
| POST | `/auth/logout` | AdminAuth | default | — |
| GET | `/admin/admin-users` | AdminAuth | default | super_admin |
| POST | `/admin/admin-users` | AdminAuth | default | super_admin |
| PATCH | `/admin/admin-users/:lark_user_id/role` | AdminAuth | default | super_admin |
| DELETE | `/admin/admin-users/:lark_user_id` | AdminAuth | default | super_admin |

预售运营路由（B3 已落地）：

| 方法 | 路径 | RBAC |
|---|---|---|
| GET | `/admin/presale/rounds` | customer_service+ |
| GET | `/admin/presale/rounds/:roundId` | customer_service+ |
| PATCH | `/admin/presale/rounds/:roundId` | super_admin |
| POST | `/admin/presale/rounds/:roundId/pause` | operator+ |
| POST | `/admin/presale/rounds/:roundId/resume` | operator+ |
| POST | `/admin/presale/rounds/:roundId/reopen` | operator+ |
| POST | `/admin/presale/rounds/:roundId/close` | operator+ |
| PATCH | `/admin/presale/rounds/:roundId/referral-pct` | operator+ |
| GET | `/admin/presale/deposits` | customer_service+ |
| GET | `/admin/presale/deposits/:txHash` | customer_service+ |
| POST | `/admin/presale/deposits/:txHash/migrate-round` | operator+ |
| GET | `/admin/presale/config` | customer_service+ |
| PATCH | `/admin/presale/config` | super_admin |
| GET | `/admin/presale/anomaly` | customer_service+ |
| GET | `/admin/presale/anomaly/:id` | customer_service+ |
| POST | `/admin/presale/anomaly/:id/resolve` | customer_service+ |
| GET | `/admin/presale/audit` | customer_service+ |

赛事风险信号灯路由（DD002 已落地，纯 proxy 转发 web-api internal）：

| 方法 | 路径 | RBAC | 限流 |
|---|---|---|---|
| GET | `/admin/events/risk/summary` | 四角色全开 | default |
| GET | `/admin/events/risk/list` | 四角色全开 | default |
| GET | `/admin/events/:event_id` | 四角色全开 | default |
| GET | `/admin/events/:event_id/adjust-history` | 四角色全开 | default |
| POST | `/admin/events/:event_id/risk-decision` | operator+ | events_sensitive 10/min |
| GET | `/admin/approval/counts` | 四角色全开 | default |

- handler：`internal/handler/events_risk.go`（5 端点透传薄壳）+ `approval_counts.go`（铃铛 badge 聚合，上游挂 → 503 UPSTREAM_UNAVAILABLE 降级）
- 路由注册：`internal/router/events_routes.go`；判级逻辑零实现（唯一实现点在 web-api，DD002 §3.0）
- **events 专用上游覆盖**：`WEBAPI_EVENTS_INTERNAL_URL` / `WEBAPI_EVENTS_SERVICE_TOKEN` env（联调期指 C 端 dev:8082；任一为空回落主上游 → C 端发版生产后删两行 env 重启即合流，切换手册见 `docs/dd002-risk-signal/handoff/RUNBOOK-events-upstream-switch.md`）
- 联调 mock 上游：`cmd/mock-webapi`（默认 127.0.0.1:9090，8 事件夹具，risk-decision 内存有状态，**仅本地联调禁部署**）
- 契约：`docs/api.md` §3.12 + `docs/risk-signal-curl.md`（实跑 curl 集）

后续业务路由（users / bets / withdrawals / settlements）走各自 DD，**尚未落地**：
- `/admin/users/*` — 用户管理（operator+ 可访问）
- `/admin/bets/*` — 注单查看（operator/finance/super_admin）
- `/admin/withdrawals/*` — 出金审核（finance+）
- `/admin/settlements/*` — 结算操作（operator+）

详细路径与 RBAC 矩阵见 `.claude/rules/rbac.md` 与 DD-098 §3.4。

## 4. 核心业务流程

### Lark OAuth 登录

详见 `docs/lark-oauth-flow.md`。

简版：

1. 前端访问 `/auth/lark/login`
2. 后端生成 `state`（CSRF 防护，写 Redis `lark_oauth_state:{state}`，TTL 10 分钟），重定向到 Lark 授权页
3. 用户在 Lark 完成授权，Lark 回调 `/auth/lark/callback?code=...&state=...`
4. 后端校验 state，删除 Redis 条目（一次性）
5. `code` → `user_access_token`（POST `https://open.larksuite.com/open-apis/authen/v1/oidc/access_token`）
6. `user_access_token` → 用户信息（GET `https://open.larksuite.com/open-apis/authen/v1/user_info`）
7. 查 `admin_users` 表确认 lark_user_id 已被授权
8. 签发内部 JWT（含 user_id、role、name、avatar、exp = 8h）
9. 302 到 `https://admin.oddfi.io/auth/lark/callback?token=<jwt>`

### JWT 鉴权

`AdminAuthMiddleware`：

- 请求头 `Authorization: Bearer <token>`
- 校验签名 + 过期时间
- 查 Redis `admin_jwt_blacklist:{jti}` 判断是否被注销
- 通过后注入 `c.Set("admin_user_id", ...)`、`c.Set("role", ...)`、`c.Set("name", ...)`

### RBAC 路由声明

```go
admin := r.Group("/admin", middleware.AdminAuthMiddleware())
{
    admin.GET("/bets",
        middleware.RoleRequired("operator", "finance", "super_admin"),
        handler.ListBets)

    admin.POST("/withdrawals/:id/approve",
        middleware.RoleRequired("finance", "super_admin"),
        handler.ApproveWithdrawal)

    admin.POST("/admin-users",
        middleware.RoleRequired("super_admin"),
        handler.CreateAdminUser)
}
```

## 5. 配置加载

默认读 `./config.yaml`。**生产环境**通过环境变量覆盖敏感字段：

- `ADMIN_DB_DSN` — MySQL 连接
- `ADMIN_REDIS_ADDR` — Redis 地址
- `ADMIN_JWT_SECRET` — JWT 签名密钥
- `ADMIN_LARK_APP_ID` / `ADMIN_LARK_APP_SECRET` — Lark 应用凭据
- `ADMIN_FRONTEND_URL` — 回调跳转的前端域名（默认 `https://admin.oddfi.io`）

`config.example.yaml` 入库作为模板；`config.yaml` 加入 `.gitignore`。

## 6. Redis / MySQL 使用位置

MySQL：

- `admin_users` 表（本服务独立维护）
- 业务表只读 JOIN：`users`、`user_balance`、`user_bet_holding`、`banner_bet_order`、`asset_ledger`、`withdraw_record`（与 C 端共享）
- **写业务表**仅限严格审批后的操作（如 `/admin/withdrawals/:id/approve` 改 `withdraw_record.status`），所有写必须走事务 + asset_ledger 流水

Redis：

- `lark_oauth_state:{state}` — Lark OAuth state CSRF token（TTL 10 分钟）
- `admin_jwt_blacklist:{jti}` — JWT 黑名单（用户主动登出后）
- `admin_rate_limit:{ip}` — IP 限流（IP × min 滑动窗口）

## 7. 关键数据结构

```sql
CREATE TABLE admin_users (
    lark_user_id  VARCHAR(64)  PRIMARY KEY,
    lark_name     VARCHAR(64)  NOT NULL,
    lark_email    VARCHAR(128),
    role          VARCHAR(32)  NOT NULL,         -- super_admin | operator | customer_service | finance
    created_by    VARCHAR(64),                   -- 添加此人的 lark_user_id
    created_at    TIMESTAMP    DEFAULT NOW(),
    updated_at    TIMESTAMP    DEFAULT NOW(),
    INDEX idx_role (role)
);
```

四角色权限矩阵见 `.claude/rules/rbac.md`。

## 8. 潜在风险点

- **Lark App Secret 不能入库**：必须通过环境变量注入，CI/CD pipeline 用 GitHub Secrets
- **JWT 密钥强度**：生产环境用 ≥ 32 字节随机串
- **state 必须一次性**：Redis 删除失败时拒绝登录（防 CSRF）
- **admin_users 删除**：删除最后一个 `super_admin` 必须显式确认（不然没人能再添加管理员）
- **跨表写入幂等**：审核出金等会改 C 端业务表的操作，必须用 `asset_ledger.ref_id` 保证幂等
- **CORS**：仅放行 `https://admin.oddfi.io` 和 `http://localhost:5173`（dev）

## 9. 本地运行

1. 安装 Go 1.24+、MySQL 8、Redis 7
2. 拷贝 `config.example.yaml` → `config.yaml`，填入本地 DB / Redis / Lark App 凭据
3. 跑 migrations：`mysql -u root oddfi < migrations/0001_create_admin_users.sql`
4. 在 `admin_users` 插入一条 `super_admin` 记录，确保自己能登录
5. `go mod tidy` 拉依赖
6. `go run cmd/server/main.go`，监听 `:8081`，健康检查 `curl http://localhost:8081/health`

本地联调 Lark OAuth：Lark 应用回调 whitelist 需加 `http://localhost:5173/auth/lark/callback`（前端 dev 端口），前端 Vite proxy 把 `/auth` 和 `/admin` 转发到 `http://localhost:8081`。

## 10. 后续值得补的 5 件事

1. **Swagger 自动生成**：参考 web-api 的 `scripts/swagger/gen.sh`，扫描 handler 注释生成 OpenAPI
2. **审计日志**：所有 `/admin/*` POST/PATCH/DELETE 写入 `admin_audit_log` 表（who/when/what/old/new）
3. **2FA**：sensitive 操作（删管理员、调整余额、批量审核出金）要求 Lark 二次确认
4. **CI/CD**：GitHub Actions 跑 `go vet`、`go test`、`gofmt` 检查；merge 后 SSH 部署到 EC2
5. **Prometheus metrics**：暴露 `/metrics`，监控 JWT 签发量、Lark OAuth 失败率、出金审核耗时
