# 部署 artifact 总览

> 本目录是生产部署需要的所有静态文件。
>
> 不放 secret。所有敏感字段都在 EC2 上手填。
>
> EC2 端 step-by-step 安装见 [`bootstrap.md`](./bootstrap.md)。

## 文件清单

| 文件 | 部署目标路径 | 权限 | 说明 |
|---|---|---|---|
| `oddfi-admin-server.service` | `/etc/systemd/system/oddfi-admin-server.service` | 644 root:root | systemd 单元，监听 :8081（127.0.0.1 only），用 `-config /etc/oddfi-admin/config.yaml` 启动 |
| `env.production.example` | 拷贝为 `/etc/oddfi-admin/env.production` 后**手填**实际值 | **600 root:root** | EnvironmentFile，敏感凭据集中注入。Lark 非敏感字段（authorize_url/scope/redirect_uri）走 config.yaml |
| `nginx.conf.example` | `/etc/nginx/sites-available/admin.oddfi.io` | 644 root:root | TLS + 反代 :8081 |
| `bootstrap.md` | — | — | EC2 从零到服务运行的完整 runbook |

## 字段对照（env ↔ config.yaml）

| Key | 来源 | 优先级 |
|---|---|---|
| `mysql.dsn` | `ADMIN_DB_DSN` | env > yaml |
| `redis.addr` | `ADMIN_REDIS_ADDR` | env > yaml |
| `redis.password` | `ADMIN_REDIS_PASSWORD` | env > yaml |
| `jwt.secret` | `ADMIN_JWT_SECRET` | env > yaml |
| `lark.app_id` | `ADMIN_LARK_APP_ID` | env > yaml |
| `lark.app_secret` | `ADMIN_LARK_APP_SECRET` | env > yaml |
| `frontend.callback_url` | `ADMIN_FRONTEND_URL` | env > yaml |
| `lark.redirect_uri` | ❌ 仅 yaml | yaml only |
| `lark.scope` / `*_url` | ❌ 仅 yaml | yaml only |
| `cors.allowed_origins` | ❌ 仅 yaml | yaml only |
| `server.port` / `*timeout` | ❌ 仅 yaml | yaml only |
| `rate_limit.*` | ❌ 仅 yaml | yaml only |

实现见 `internal/config/config.go::applyEnvOverride`。新增 env override 必须同步本表 + `env.production.example` 注释。

## 快速校验

部署完成后在 EC2 上跑：

```bash
sudo systemctl status oddfi-admin-server                    # active (running)
sudo journalctl -u oddfi-admin-server -n 50 --no-pager      # mysql/redis connected + listening
curl -s http://127.0.0.1:8081/health | jq .                 # {"code":0,...,"status":"ok"}
sudo ls -la /etc/oddfi-admin/env.production                 # -rw------- root root
```

完整验收清单见 [`bootstrap.md §9`](./bootstrap.md#9-验收)。
