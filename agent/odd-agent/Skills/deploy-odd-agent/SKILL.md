---
name: deploy-odd-agent
description: 把 oddfi-ODD-Agent（Node Fastify，用户标签推送 + Chat + Memory 服务）部署到目标机的标准流程。当需要发布 odd_agent 到服务器、重新部署、回滚、或排查部署后服务异常时使用；也覆盖 DD-134 internal API 鉴权的专项部署增量。
---

# 部署 odd_agent 服务

> 现场考古 + 部署脚本反推还原的真实流程。仓库内 `deploy/` 只覆盖「目标机仓库根之后」的步骤，本 skill 补全「本机 → 目标机」前置一步并固化全链路。

## 1. 目标机与架构（实测 2026-06-08）

| 项          | 值                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| SSH 别名    | `oddfi-market`（→ <SERVER_IP>，与 market-api **共机**）                                                                |
| OS / 运行时 | Ubuntu 24.04 LTS / Node v22.x / npm 10.x，部署用户 `ubuntu`（sudo NOPASSWD）                                              |
| 部署根      | `/opt/odd_agent`：`current`(软链) → `releases/<UTC时间戳>`，`shared/odd-agent.yaml`(600) 唯一真配置                       |
| 日志        | `/data/logs/odd_agent/odd-agent-<YYYY-MM-DD>.log` + `journalctl -u odd-agent.service`                                     |
| 服务        | systemd `odd-agent.service`（`node dist/src/main.js`，监听 `0.0.0.0:3000`）                                               |
| 推送依赖    | systemd `centrifugo.service`（docker `odd-agent-centrifugo`，`127.0.0.1:18000`），配置 `/opt/centrifugo/config.json`(600) |

> ⚠️ 这是 market-api 生产机的共用环境，odd_agent 当前作为**测试/联调环境**运行。任何操作前确认不影响同机 market-api。

## 2. 一键部署（推荐）

本机仓库根执行：

```bash
bash Skills/deploy-odd-agent/scripts/sync-and-deploy.sh
# 预演（不真同步/部署）：DRY_RUN=1 bash Skills/deploy-odd-agent/scripts/sync-and-deploy.sh
```

脚本三步：① rsync 工作树 → 目标机统一 stage `/tmp/odd_agent_src`（取代历史随机命名）；② 远程 `cd stage && bash deploy/scripts/deploy-remote.sh`；③ 远程只读验收 health + systemctl。

> **部署的是工作树当前内容**，不是 git 分支——同步前确认本机在正确分支且已 `git pull`/构建无误。Stage 同步用 `--delete`，与本机严格一致。

## 3. 手动部署（理解每步在做什么）

```bash
# 本机：同步工作树到目标机 stage（排除 .git/node_modules/dist/.DS_Store/._*/真实配置）
rsync -az --delete \
  --exclude '.git' --exclude 'node_modules' --exclude 'dist' \
  --exclude 'logs' --exclude 'tmp' --exclude 'coverage' \
  --exclude '.DS_Store' --exclude '._*' --exclude '__MACOSX' \
  --exclude '.omc' --exclude '.claude' --exclude 'config/odd-agent.yaml' \
  ./ oddfi-market:/tmp/odd_agent_src/

# 目标机：在 stage 根跑官方部署脚本
ssh oddfi-market 'cd /tmp/odd_agent_src && bash deploy/scripts/deploy-remote.sh'
```

`deploy/scripts/deploy-remote.sh` 在目标机做：`npm ci` → `npm run build` → rsync 到 `releases/<UTC时间戳>` → `npm ci --omit=dev` → 把 `shared/odd-agent.yaml` 覆盖进 `config/` 与 `dist/config/` → 复制 `db/migrations` 到 `dist/db/` → **`node dist/src/bin/migrate.js`（自动跑全部 migration，幂等）** → 软链 `current` → 安装/重启 systemd unit（centrifugo 先于 odd-agent）。

## 4. 配置管理（红线：secret 不进 git）

- 唯一运行时配置：目标机 `/opt/odd_agent/shared/odd-agent.yaml`（600，属 ubuntu）。本机改的是 `config/odd-agent.example.yaml` 模板，真实值只在目标机这份里。
- 顶层段（实测）：`server / logger / db / redis / centrifugo / tweet_catcher / user_tag / chatllm / tools / memory / local_secrets`。
- 改配置 = SSH 上去 `vim`（`EDITOR=vim`）编辑 shared 文件 → `sudo systemctl restart odd-agent.service`。配置非法或 schema 校验失败会 **fail-fast 起不来**，改完务必看 `journalctl -u odd-agent -n 50`。
- 生产关键项见 `docs/deployment/生产部署说明.md` §2（host 0.0.0.0 / Supabase pooler IPv4 连接串 / Pinecone namespace oddfi 等）。

## 5. 验收（部署后必跑）

```bash
ssh oddfi-market 'set -e
  systemctl is-active odd-agent.service centrifugo.service
  curl -fsS http://127.0.0.1:3000/health        # features 应含 foundation/memory/chat_agent/user_tag
  curl -fsS "http://127.0.0.1:3000/internal/tag/tags?page=1&page_size=1"  # tags.total 应为 58
  # error 检查只看本次启动以来，避免历史失败启动（如旧的 embedding key 换行）混入误报
  SINCE=$(systemctl show -p ActiveEnterTimestamp --value odd-agent.service)
  journalctl -u odd-agent.service --since "$SINCE" --no-pager | grep -iE "error|fail" || echo "本次启动以来无 error"
'
```

> 注意：`journalctl -n <N>` 会把**历史**失败启动的 stack trace 也数进来——验收要以 `systemctl is-active` + `/health` 为准，error 检查务必用上面的 `--since 本次激活时间` 限定。

Tweet Catcher 正常链路日志、异常关注项见 `docs/deployment/生产部署说明.md` §4。

## 6. 回滚

```bash
ssh oddfi-market 'ls -1 /opt/odd_agent/releases'                       # 看历史 release
ssh oddfi-market 'ln -sfn /opt/odd_agent/releases/<旧时间戳> /opt/odd_agent/current && sudo systemctl restart odd-agent.service'
```

migration 不随回滚自动倒退；若新 release 加了 migration，回滚前评估是否需要手工处理（本服务 migration 均为 `IF NOT EXISTS` / 幂等，通常向后兼容，回滚代码安全）。

## 7. DD-134 专项部署

部署含 DD-134 的分支（`feat/dd-134-internal-api`）**不能只同步代码**——middleware 强制 `/internal/*` 带 token，配置缺段会 fail-fast。务必先按 **[references/dd-134-deployment.md](./references/dd-134-deployment.md)** 补 `internal_auth` 配置段 + `SERVICE_TOKEN` secret，再部署。

## 8. 故障速查

IPv6 DB 不可达 / `._*.sql` migration 误执行 / 配置缺段 fail-fast / Centrifugo 未起 等见 **[references/troubleshooting.md](./references/troubleshooting.md)**。
