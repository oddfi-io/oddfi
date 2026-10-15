# OddFi 运营后台 · 后端 — 项目规则

## 项目概述

OddFi 运营后台独立 Go 后端。承担：

1. **Lark OAuth 登录回调** — `/auth/lark/*`
2. **运营 CRUD API** — `/admin/*`，4 角色 RBAC
3. **管理员账号管理** — `admin_users` 白名单表

服务端口 `:8081`，独立部署在 `admin-server`（`<SERVER_IP>`，Ubuntu 26.04，**独立机器**，SSH 别名见 `~/.ssh/SERVERS.md`）。本机自带 MySQL `oddfi_admin` DB + Redis（db 1），与 C 端 web-api（`<SERVER_IP>` / `api.oddfi.io`）完全隔离。

**关联仓库**：

- DD：`~/work/oddfi-frontend/.progress/designs/DD-098-admin-panel-ec2-lark-sso.md`
- 前端：`~/work/oddfi-admin-frontend`
- C 端后端（参考栈，**不修改**）：`~/work/oddfi-backend/web-api`

## 命令

```bash
go run cmd/server/main.go      # 本地启动（端口 :8081）
go build -o bin/admin-server ./cmd/server
go test ./...                  # 单元测试
go vet ./...                   # 静态检查
gofmt -l .                     # 格式检查
make swagger                   # 生成 OpenAPI（如果集成 swag）
```

## 技术栈（与 oddfi-backend/web-api 对齐）

- **语言**：Go 1.24+
- **Web 框架**：Gin（gin-gonic/gin v1.11+）
- **ORM**：GORM (gorm.io/gorm + gorm.io/driver/mysql)
- **缓存/Session**：go-redis/v9
- **日志**：rs/zerolog（结构化 JSON）
- **JWT**：golang-jwt/jwt/v5
- **金额**：shopspring/decimal（与 C 端字段对齐）
- **配置**：yaml + 环境变量覆盖
- **OAuth**：手写 Lark OIDC 流程（不引入完整 OAuth 库；Lark 接口简单）

## 核心规则（高频遗漏 → 必须执行）

### 1. 中文注释要求（继承自 web-api/AGENTS.md）

每次新增或修改代码时，必须为关键逻辑补充清晰的**中文注释**。

注释重点：
1. 复杂业务逻辑
2. 状态机逻辑
3. 并发控制逻辑
4. 错误处理逻辑
5. 边界条件
6. 金融、交易、链上、价格、风控相关逻辑
7. 不直观的算法或数据结构

注释要求：
- 注释使用**中文**
- 解释**为什么这么做**，不要只复述代码做什么
- 简单自解释代码不强行加废话注释
- 修改已有函数时，行为变化必须同步更新函数注释

### 2. 回写 ARCHITECTURE.md

每次代码有更新后，需要回写项目根目录的 `ARCHITECTURE.md`，确保文件内容与项目架构一致。

### 3. 运行时日志格式

zerolog 结构化日志，**禁止** `fmt.Println` / `log.Printf`：

```go
// ✅
logger.Info().
    Str("module", "auth_lark").
    Str("user_id", userID).
    Msg("lark oauth callback success")

// ❌
fmt.Println("lark callback ok", userID)
```

日志字段命名：snake_case，关键字段必须有：`module`, `request_id`, `user_id`（如适用）

### 4. 错误码统一

所有 HTTP 响应体走 `internal/pkg/response.go` 统一包装：

```go
response.OK(c, data)                          // {code:0, message:"ok", data}
response.Error(c, http.StatusBadRequest, "INVALID_PARAM", "lark code missing")
response.Forbidden(c, "INSUFFICIENT_ROLE", "operator role required")
```

错误码常量集中放 `internal/pkg/errcode/errcode.go`。

### 5. RBAC 中间件硬约束

- ❌ **禁止**在 handler 里手写 `if user.Role != "..."` 判断
- ✅ 必须用 `middleware.RoleRequired("finance", "super_admin")` 在路由级声明
- ✅ JWT 解出的 `role` 由 `middleware.AdminAuthMiddleware` 注入 `c.Set("role", ...)`

### 6. 数据库迁移

`admin_users` 表 DDL 放 `migrations/0001_create_admin_users.sql`。**新增字段**必须新 migration 文件（不修改历史 SQL），文件名递增。

### 7. 不重复造轮子

C 端 `oddfi-backend/web-api/internal/pkg/` 已有的封装（mysql client / redis client / logger / response / snowflake / jwt 通用结构），如果完全可复用，**复制过来本地维护**，不强行做 Go module 共享（两个仓库独立部署，分裂的代价低于跨仓库依赖管理）。

## 规则索引（按 path glob 自动加载）

| 文件                       | 覆盖范围                                                  |
| -------------------------- | --------------------------------------------------------- |
| `code-quality.md`          | 日志格式 / 错误处理 / nil 检查 / panic 边界               |
| `git-workflow.md`          | 分支策略 / commit 中文 / hook 不可绕过                    |
| `testing.md`               | 单元 / 集成 / table-driven 风格 / 必测清单                |
| `api-conventions.md`       | 路由前缀 / 响应包装 / JWT / 错误码                        |
| `lark-oauth.md`            | Lark OAuth 流程实现 / state CSRF 防护 / token 处理        |
| `rbac.md`                  | 4 角色定义 / RoleRequired 中间件 / admin_users 表设计     |
| `agent-delegation.md`      | Subagent 上下文传递                                       |
| `dd-enh-workflow.md`       | DD/ENH 触发门槛 / 模板                                    |
| `dd-flow.md`               | DD 端到端 6 阶段闭环（方案→拆 task→TDD→team:2 review→归档）|
| `api-docs-required.md`     | 改 handler/router/errcode 必须同步更新 docs/api.md（commit-msg hook 阻断）|
| `shell-paste-safety.md`    | 给用户 paste 的 shell 块禁用 heredoc，禁缩进 EOF；sed 含 URL 用 `#` 分隔符；secret 不进 stdout |

## 不做什么（明确边界）

- **不复制 C 端的钱包/合约/赛事/赔率逻辑**：admin 后台不接钱包、不读合约、不写赔率
- **不暴露 :8081 给公网**：仅 Nginx 反代访问，security group 只放 Nginx 服务器 IP
- **不实现 admin 自己的密码体系**：Lark SSO 是唯一登录入口
- **不在 admin 后台直接改 C 端 user_balance**：金额调整（`super_admin` 可用）必须走 C 端服务的内部 RPC / DB 事务，避免双写脱节
