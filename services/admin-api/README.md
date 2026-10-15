# oddfi-admin-backend

OddFi 运营后台后端（Go + Gin + GORM）。Lark OAuth SSO + 4 角色 RBAC。监听 `:8081`。

## 与前端的关系

| | 仓库 | 端口 | 角色 |
|---|---|---|---|
| **后端**（本仓库） | `oddfi-admin-backend` | `:8081` | Lark OAuth 回调、JWT 签发、`/admin/*` CRUD、RBAC |
| 前端 | `oddfi-admin-frontend`（`~/work/oddfi-admin-frontend`） | `:5173`（本地 dev） | React 19 + Vite + Refine，SPA |

**联调链路：**

```
浏览器 :5173
  → vite dev proxy（前端 vite.config.ts 把 /auth /admin 转发到 :8081）
  → 后端 :8081
  → Lark OAuth（外部）
  → 后端 :8081 /auth/lark/callback 签发 JWT
  → 302 回前端 :5173/#token=<JWT>
```

生产环境 Nginx 代替 vite dev proxy（见 `deploy/nginx.conf.example`），前后端同源部署在 `admin.oddfi.io`。

详细文档：

- `CLAUDE.md` — AI 协作规则
- `AGENTS.md` — 编码规范（中文注释 / 回写 ARCHITECTURE.md）
- `ARCHITECTURE.md` — 接手项目指南
- `docs/lark-app-binding.md` — Lark 应用 ↔ 后端配置绑定（权限、回调白名单、版本历史、Secret 轮换协议；每次 Lark 后台改动同步维护）
- `.claude/rules/` — 分领域规则索引

## 快速启动

```bash
# 0. clone 后一次性启用守门钩子（commit-msg 校验 docs/api.md 同步）
make setup-hooks

# 1. 安装依赖（首次必须执行）
# 国内网络如果 proxy.golang.org 超时，加 GOPROXY：
#   GOPROXY=https://goproxy.cn,direct go mod tidy
go mod tidy

# 2. 准备配置
cp config.example.yaml config.yaml
# 编辑 config.yaml 填入 DB / Redis / Lark App 凭据

# 3. 跑 migrations
mysql -u root oddfi < migrations/0001_create_admin_users.sql

# 4. 启动服务
go run cmd/server/main.go
# 监听 :8081，健康检查 http://localhost:8081/health
```

## 部署

`<SERVER_IP>` Ubuntu 24.04，由 `systemd` 管理服务，Nginx 反代 `/auth/*` 和 `/admin/*` 到本服务。

## License

Internal use only.
