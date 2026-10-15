# DD-134 专项部署增量

部署 `feat/dd-134-internal-api` 分支时，除常规部署外必须做的额外步骤。**漏做会导致服务 fail-fast 起不来或主后端调用全 401。**

## 为什么不能只同步代码

DD-134 引入两个**破坏性变更**：

1. `/internal/*` 全部前置 `X-Service-Token` 校验，启动期解析 `internal_auth.service_token_secret_ref`。**配置缺 `internal_auth` 段 → 启动 fail-fast，服务起不来。**
2. 现有任何裸调 `/internal/tag/*`（无 token）的调用方，部署后**立即 401**。验收命令也要随之带 token。

当前目标机 `shared/odd-agent.yaml` 实测**没有** `internal_auth` 段，migrations 停在 `0002 + 0006`。

## 部署前：改目标机 shared 配置

SSH 上去编辑 `/opt/odd_agent/shared/odd-agent.yaml`（`EDITOR=vim`），加两处：

```yaml
# 1) 新增顶层段（放在 centrifugo 段附近即可，顶层顺序不影响解析）
internal_auth:
  service_token_secret_ref: "SERVICE_TOKEN"

# 2) local_secrets 段内新增一行真实 token（与主后端 AI_AGENT_SERVICE_TOKEN 同值）
local_secrets:
  SERVICE_TOKEN: "<32字节随机值>"
  # ...其余既有 secret 保持不动
```

生成 token：`openssl rand -hex 32`。**dev / prod 各一份，与主后端容器注入的 `AI_AGENT_SERVICE_TOKEN` 必须同值**（主后端 env 名是 `AI_AGENT_SERVICE_TOKEN`，本服务读的是 secretRef `SERVICE_TOKEN`，同值不同名）。

> 注意：本服务通过 `EnvSecretProvider` 解析 secretRef——可写进 `local_secrets`，也可改注入同名环境变量 `SERVICE_TOKEN` 到 systemd unit。沿用现有 `local_secrets` 方式最简单一致。

## 部署：照常一键

```bash
bash Skills/deploy-odd-agent/scripts/sync-and-deploy.sh
```

`migrate.js` 会自动跑新增的 `db/migrations/0007_tags_category_en_unique.sql`（先软删去重重复活跃 tag，再建 partial unique index；幂等，重复部署安全）。

## 部署后验收（注意带 token）

```bash
TOKEN="<上面的 SERVICE_TOKEN 值>"
ssh oddfi-market "set -e
  curl -fsS http://127.0.0.1:3000/health
  # 不带 token → 预期 401
  curl -s -o /dev/null -w 'no-token  -> %{http_code}\n' http://127.0.0.1:3000/internal/tag/tags
  # 带 token → 预期 200
  curl -s -o /dev/null -w 'with-token-> %{http_code}\n' -H \"x-service-token: ${TOKEN}\" 'http://127.0.0.1:3000/internal/tag/tags?page=1&page_size=1'
  # 新 endpoint：memory list（带 token + x-user-id）
  curl -s -o /dev/null -w 'memory    -> %{http_code}\n' -H \"x-service-token: ${TOKEN}\" -H 'x-user-id: smoke_user' 'http://127.0.0.1:3000/internal/memory/list?limit=1'
"
```

预期：no-token → 401，with-token → 200，memory → 200。

## 回滚要点

DD-134 的 middleware 是配置驱动的——回滚到旧 release（不含 middleware）后，`internal_auth` 段留在 shared 里**无害**（旧代码忽略未知段）。`0007` migration 是 `IF NOT EXISTS` + partial unique index，回滚代码不需要倒退 DDL（unique 约束对旧逻辑兼容）。如确需移除：`DROP INDEX IF EXISTS tags_category_en_active_unique;`。

## 与三方联调的衔接

- 本服务 dev 就绪后，把 `SERVICE_TOKEN` 值同步给主后端（注入其 `AI_AGENT_SERVICE_TOKEN`）+ 提供本机 dev 可达地址（主后端 `AI_AGENT_BASE_URL`）。
- 详见 DD-134 联调计划 `integration-plan/PLAN.md` 的 L1.C / L2.2。
