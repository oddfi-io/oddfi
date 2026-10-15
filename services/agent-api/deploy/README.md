# 部署说明（DD-002）

oddfi-agent-backend 部署到 AWS EC2，采用 Docker + nginx + Let's Encrypt 模式，
与 sibling 项目 market-api / dev-market-api 同机共驻。

| 环境 | 域名 | 服务器 | SSH 别名 | 数据目录 |
|---|---|---|---|---|
| prod | news-api.oddfi.io | <SERVER_IP> | `backend-03` | `/var/lib/oddfi-agent-backend/prod/` |
| dev  | dev-news-api.oddfi.io | <SERVER_IP> | `test-market-api` | `/var/lib/oddfi-agent-backend/dev/` |

详细方案见 `.progress/designs/DD-002-deploy-to-aws.md`。

---

## 文件清单

```
Dockerfile                       多阶段构建（amd64 静态二进制 + HEALTHCHECK）
.dockerignore                    避免 .env / .progress / data 进镜像
deploy/
  ├─ deploy.sh                   服务器侧：prune / pull / 替换 / healthz / 失败保留 _prev 回滚
  ├─ build-push.sh               本地侧：buildx --platform linux/amd64 + registry cache + push
  ├─ nginx/
  │   ├─ news-api.conf.template          完整 nginx site（TLS + SSE + 安全头 + dev gate 兜底）
  │   └─ news-api.http-only.conf.template 首次 certbot 引导用
  └─ README.md                   本文件
```

---

## 首次部署完整流程

> 以 dev 为例；prod 流程完全相同（dev→prod、dev-news-api→news-api）。

### 0. 一次性准备（每台机器只做一次）

```bash
# A. DNS：GoDaddy 加 A 记录
#    news-api      → <SERVER_IP>   TTL 600
#    dev-news-api  → <SERVER_IP>      TTL 600
# dig +short dev-news-api.oddfi.io 确认能解析

# B. AWS Security Group 校验（重要！）
#    入站只能允许 22 / 80 / 443，禁止暴露 8090
#    --network host 模式下后端会 bind 宿主机端口，SG 误开 8090 = nginx 鉴权被绕过

# C. SSH 上服务器创建数据目录（uid 1000 与容器内 app 用户一致）
ssh test-market-api 'sudo install -d -o 1000 -g 1000 -m 700 /var/lib/oddfi-agent-backend/dev'
ssh test-market-api 'mkdir -p /home/ubuntu/oddfi-agent-backend && mkdir -p /var/www/html'
```

### 1. 准备 .env 文件（本地）

```bash
cp .env.example .env.dev
# 编辑填入真实 AI_API_KEY / TWEET_CATCHER_TOKEN / SERVER_ADDR=127.0.0.1:8090
chmod 600 .env.dev
```

`.env.dev` / `.env.prod` 永远不入 git。

### 2. 分发 .env 与 deploy.sh 到服务器

```bash
# 用 install -m 600 一步到位（避免 scp 后 chmod 之间的明文窗口）
ssh test-market-api 'umask 077 && touch /home/ubuntu/oddfi-agent-backend/.env.dev && chmod 600 /home/ubuntu/oddfi-agent-backend/.env.dev'
scp .env.dev test-market-api:/home/ubuntu/oddfi-agent-backend/.env.dev
ssh test-market-api 'chmod 600 /home/ubuntu/oddfi-agent-backend/.env.dev'

scp deploy/deploy.sh test-market-api:/home/ubuntu/oddfi-agent-backend/deploy.sh
ssh test-market-api 'chmod +x /home/ubuntu/oddfi-agent-backend/deploy.sh'
```

### 3. 本地构建并推送镜像

```bash
docker login            # 首次需要
bash deploy/build-push.sh dev
# 别人用自己账号：IMAGE_NAMESPACE=alice bash deploy/build-push.sh dev
```

第一次 build 会创建 `:buildcache` tag，后续 build 复用层省 ~70% 时间。

### 4. 服务器拉取并启动容器

```bash
ssh test-market-api 'bash /home/ubuntu/oddfi-agent-backend/deploy.sh dev'
# 期望尾部输出："[Deploy] healthz OK" + "[Deploy] done"
```

容器健康后监听 `127.0.0.1:8090`，但还没对外（nginx 未配）。

### 5. nginx + TLS 引导（首次签证书 — `certonly --webroot` 模式）

> **关键**：不要用 `certbot --nginx`。该模式会改写 nginx 配置文件、注入 ssl 块、
> 把已有的 SSE 优化和 /api/dev/ 兜底**永久丢失**。我们走 `certonly --webroot`，
> 证书与 nginx 配置完全解耦，nginx 文件永远是 `deploy/nginx/*.template` 的 source of truth。

```bash
# A. 分发 HTTP-only 引导配置（供 certbot 拿证书用）
sed 's/__DOMAIN__/dev-news-api.oddfi.io/g' \
  deploy/nginx/news-api.http-only.conf.template \
  | ssh test-market-api 'sudo tee /etc/nginx/sites-available/dev-news-api > /dev/null'

ssh test-market-api 'sudo ln -sf /etc/nginx/sites-available/dev-news-api /etc/nginx/sites-enabled/dev-news-api'
ssh test-market-api 'sudo nginx -t && sudo systemctl reload nginx'

# B. certonly --webroot 签发（不让 certbot 碰 nginx 配置）
ssh test-market-api 'sudo certbot certonly --webroot -w /var/www/html -d dev-news-api.oddfi.io --non-interactive --agree-tos -m admin@oddfi.io'

# C. 覆盖为完整 SSE 配置
sed 's/__DOMAIN__/dev-news-api.oddfi.io/g' \
  deploy/nginx/news-api.conf.template \
  | ssh test-market-api 'sudo tee /etc/nginx/sites-available/dev-news-api > /dev/null'

ssh test-market-api 'sudo nginx -t && sudo systemctl reload nginx'
```

后续证书续期由 certbot 的 systemd timer 自动跑（`systemctl list-timers | grep cert`），
仅刷 `/etc/letsencrypt/live/`，**不会**改 nginx 配置 ── 这就是用 `certonly` 的目的。

### 5.5 ENH-002 限流兜底设施（首次部署 / 升级到 ENH-002 后必做）

应用层限流 / per-IP / 软上限通过 env 自动生效，**无需**额外操作。
但 nginx 应急 IP 黑名单依赖 `geo $blocklist` 变量，必须先在 `/etc/nginx/conf.d/blocklist.conf` 安装才能使用。

```bash
# 1) 先装 conf.d/blocklist.conf（含 nginx -t 守护，失败立即 abort 不 reload）
ssh test-market-api 'bash -s' < deploy/install-blocklist.sh   # dev
ssh backend-03      'bash -s' < deploy/install-blocklist.sh   # prod

# 2) 再 reload site 配置（news-api.conf 引用 $blocklist 变量）
# 注意：如果跳过第 1 步直接 reload site，nginx 会因 unknown variable $blocklist 报错，
# 整台机器的 news-api + market-api 一起拒绝 reload —— 必须按顺序。
ssh backend-03 'sudo nginx -t && sudo systemctl reload nginx'
```

应急封禁 IP（已装好 blocklist.conf 后）：

```bash
ssh backend-03 'sudo tee -a /etc/nginx/conf.d/blocklist.conf >/dev/null <<<"    1.2.3.4 1;"'
ssh backend-03 'sudo nginx -t && sudo systemctl reload nginx'   # 必须先 -t 再 reload
```

> ⚠ **混部硬约束**：两台服务器 nginx 进程同时服务 news-api + market-api，任何
> `nginx -t` syntax error 都会让两个 site 一起拒绝 reload。每次改 nginx 配置
> **必须**先 `nginx -t` 单独验证再 `systemctl reload`，install-blocklist.sh 已内置此守护。

---

### 6. 验收

```bash
# T1 健康检查
curl -sS https://dev-news-api.oddfi.io/healthz
# 期望：ok

# T2 REST
curl -sS 'https://dev-news-api.oddfi.io/api/push?limit=5'
# 期望：{"items":[...], "count":N}

# T3 SSE（10 秒内应收到 ping 心跳）
curl -N -H 'Origin: https://oddfi.io' \
  https://dev-news-api.oddfi.io/api/push/stream
# 期望：event: ping (每 30s 一次)

# T4 Origin 白名单
curl -i -H 'Origin: https://attacker.com' \
  https://dev-news-api.oddfi.io/api/push/stream
# 期望：HTTP/2 403

# T5 /api/dev/* 双层拒绝（nginx 第一层 + 后端 dev gate 第二层）
curl -i -X POST https://dev-news-api.oddfi.io/api/dev/inject
# 期望：HTTP/2 404（nginx 兜底）

# T6 容器重启数据不丢
ssh test-market-api 'docker restart oddfi-agent-backend && sleep 5'
curl -sS 'https://dev-news-api.oddfi.io/api/push?limit=20' | jq '.count'
# 期望：≥ 重启前的数量

# T7 安全头
curl -sI https://dev-news-api.oddfi.io/healthz | grep -E 'Strict-Transport|X-Content-Type|X-Frame|Referrer'
# 期望：4 行都在
```

---

## 日常升级（已部署后）

### 一行命令（最常用：代码改动 → 上线）

```bash
# dev（test-market-api / dev-news-api.oddfi.io）
bash deploy/build-push.sh dev  && ssh test-market-api 'bash /home/ubuntu/oddfi-agent-backend/deploy.sh dev'

# prod（backend-03 / news-api.oddfi.io）
bash deploy/build-push.sh prod && ssh backend-03        'bash /home/ubuntu/oddfi-agent-backend/deploy.sh prod'
```

整个升级 ~2-3 分钟（buildx + push + pull + 替换 + healthz）。容器以 `_prev` 名保留，healthz 通过后自动清掉；失败自动 exit 1 给你恢复线索。

### 不同改动场景的最小路径

按改动类型选择最小步骤，能省时间也能减少出错面：

| 改动 | 需要 rebuild image？ | 需要重启容器？ | 命令 |
|---|---|---|---|
| **Go 代码 / prompt** | ✓ rebuild | ✓ deploy.sh | `bash deploy/build-push.sh <env> && ssh <host> 'bash /home/ubuntu/oddfi-agent-backend/deploy.sh <env>'` |
| **.env 配置**（密钥 / CORS / MAX_SSE_CONNS 等） | ✗ 不用 | ✓ 重启读新 env | `scp .env.<env> <host>:/home/ubuntu/oddfi-agent-backend/.env.<env> && ssh <host> 'docker restart oddfi-agent-backend'` |
| **nginx site**（SSE 调参 / 安全头 / location） | ✗ 不用 | ✗ 容器不动 | `sed s/__DOMAIN__/<domain>/g deploy/nginx/news-api.conf.template \| ssh <host> 'sudo tee /etc/nginx/sites-available/<domain> > /dev/null && sudo nginx -t && sudo systemctl reload nginx'` |
| **AI provider 切换**（xai ↔ moonshot ↔ deepseek） | ✗ 不用（env 即可） | ✓ 重启 | 同「.env 配置」行 |
| **回滚到旧镜像** | ✗ 不用 | ✓ deploy.sh 带 tag | `ssh <host> 'bash /home/ubuntu/oddfi-agent-backend/deploy.sh <env> <env>_YYYYMMDD_<sha>'` |
| **DNS / 域名变更** | ✗ 不用 | nginx server_name 改 + reload + 重签证书 | GoDaddy 改记录 → 跑 §5 nginx + certbot 重做 |
| **新增 sibling 部署机器** | ✗ 不用 | 从 §0 走 | 完整首次部署 |

### "下次部署"心智模型

```
代码改 / prompt 改 / Dockerfile 改  →  build-push + deploy        （~3 min）
.env 改 / 切 AI provider             →  scp + docker restart       （~5 秒）
nginx 改                             →  sed + tee + reload         （~2 秒）
回滚                                 →  deploy.sh <env> <old-tag>  （~30 秒）
```

3 句口诀：
1. **改代码 = 走 build-push 全流程**
2. **改配置 = scp + restart**
3. **改 nginx = 服务器上 reload 不重启容器**

### 镜像 tag 命名（dated tag 用于回滚）

`build-push.sh` 每次推两个 tag：
- `:dev_latest` / `:prod` — 移动指针，`deploy.sh` 默认拉这个
- `:dev_YYYYMMDD_<gitsha>` / `:prod_YYYYMMDD_<gitsha>` — 不可变历史快照，回滚用

```bash
# 查 dockerhub 上有哪些 dated tag 可回滚
docker buildx imagetools inspect hankdong/oddfi-agent-backend:dev_latest
# 或浏览 https://hub.docker.com/r/hankdong/oddfi-agent-backend/tags
```

## 回滚

deploy.sh 在升级时会把旧容器 rename 为 `oddfi-agent-backend_prev`，healthz 通过后才删。
若新版本启动后 ≥1h 又出问题，可手动 pull 旧 dated tag：

```bash
# 指定历史 dated tag 回滚（前提是 image 仍在 dockerhub）
ssh test-market-api 'bash /home/ubuntu/oddfi-agent-backend/deploy.sh dev dev_20260518_abcd1234'
```

---

## 常见操作 Runbook

### 看实时日志

```bash
ssh test-market-api 'docker logs -f oddfi-agent-backend'
```

### 查容器资源占用（dev 内存紧，常巡）

```bash
ssh test-market-api 'docker stats --no-stream oddfi-agent-backend'
ssh test-market-api 'docker inspect oddfi-agent-backend | jq ".[0].State.OOMKilled"'
# OOMKilled=true → 触发了 256m 上限；考虑降 MAX_SSE_CONNS / ENRICH_WORKERS 或加 swap
```

### 进入容器调试

```bash
ssh test-market-api 'docker exec -it oddfi-agent-backend sh'
# /data 内可以看到 cards.db / cards.db-wal
```

### SQLite 数据备份（用 .backup 而非 tar，避免 WAL 不一致快照）

```bash
ssh test-market-api '
  docker exec oddfi-agent-backend sh -c "sqlite3 /data/cards.db \".backup /data/cards.db.bak\""
  sudo tar czf - -C /var/lib/oddfi-agent-backend/dev cards.db.bak
' > backup-dev-$(date +%Y%m%d).tar.gz
# 备份范围仅 /var/lib/...；不含 /home/ubuntu/oddfi-agent-backend/.env.*（密钥）
```

### 证书续期验证（systemd timer 自动跑）

```bash
ssh test-market-api 'sudo certbot renew --dry-run'
ssh test-market-api 'sudo systemctl list-timers | grep cert'
```

---

## 故障排查

| 症状 | 排查 |
|---|---|
| `deploy.sh` 报 `missing env file` | 检查 `/home/ubuntu/oddfi-agent-backend/.env.{prod,dev}` 是否存在、chmod 600 |
| `deploy.sh` 报 `missing data dir` | 跑首次 sudo install 命令（见 §0.C） |
| `deploy.sh` 报 `do not run as root` | 切到 ubuntu 用户：`sudo -iu ubuntu` |
| `docker pull` 失败 `no space left` | 手动跑 `docker image prune -af`（首次清理，会清掉 sibling 镜像也只是迫使下次重拉） |
| `healthz` 失败 | `docker logs --tail 100 oddfi-agent-backend` 看启动错误；`docker rename oddfi-agent-backend_prev oddfi-agent-backend && docker start oddfi-agent-backend` 回到上一版本 |
| `502 Bad Gateway` | nginx 反代到 8090 失败 → 检查容器是否在跑、`--network host` 生效 |
| `403 forbidden origin` | 浏览器 origin 不在 `CORS_ALLOWED_ORIGINS` → 改 .env 后重新 deploy |
| SSE 5-10 秒后断流 | nginx 模板被覆盖丢了 SSE 优化（特别注意 certbot 修改）；重新 `sed __DOMAIN__ ... tee` 覆盖 |
| dev OOM | `docker stats` + `docker inspect ... OOMKilled` 确认；降 `MAX_SSE_CONNS` 到 30、`ENRICH_WORKERS` 到 2、加 `GOMEMLIMIT=180MiB` |

---

## 镜像账号自定义

`build-push.sh` 与 `deploy.sh` 都支持 `IMAGE_NAMESPACE` 环境变量覆盖默认 `hankdong/`：

```bash
# 本地构建
IMAGE_NAMESPACE=alice bash deploy/build-push.sh dev

# 服务器拉取（如果用了自定义 namespace，deploy.sh 也要带上）
ssh test-market-api 'IMAGE_NAMESPACE=alice bash /home/ubuntu/oddfi-agent-backend/deploy.sh dev'
```

namespace 与 tag 都有白名单校验（`^[a-z0-9_.-]{2,64}$` / `^[A-Za-z0-9._-]{1,128}$`），
不接受 `;` `&` `|` 等任何会拼接成 shell 命令的字符。

---

## dev 环境快速 Runbook

> **服务器**：`test-market-api`（<SERVER_IP>）  
> **域名**：`dev-news-api.oddfi.io`  
> **SSH key**：`~/.ssh/test-server-key.pem`  
> **AI provider**：xAI Grok（`.env.dev` 配置）  
> **内存上限**：256 m（比 prod 512 m 小，注意 OOM）

### 日常代码改动上线（最常用）

```bash
# 1. 推代码
git push

# 2. 构建并推 DockerHub（~2-3 分钟）
bash deploy/build-push.sh dev

# 3. 服务器拉镜像重启（~30 秒）
ssh test-market-api 'bash /home/ubuntu/oddfi-agent-backend/deploy.sh dev'
```

合并一行：

```bash
git push && bash deploy/build-push.sh dev && ssh test-market-api 'bash /home/ubuntu/oddfi-agent-backend/deploy.sh dev'
```

### 部署后验收

```bash
# 健康检查
curl -sS https://dev-news-api.oddfi.io/healthz
# 期望：ok · cards=N · sse=0/100 · analysis=...

# REST 分页
curl -sS 'https://dev-news-api.oddfi.io/api/push?limit=5' | jq '{count,hasMore}'

# SSE 连通（30 秒内应收到 ping 心跳）
curl -N -H 'Origin: https://oddfi.io' \
  https://dev-news-api.oddfi.io/api/push/stream

# BUG-019 验证：限流触发时应返回 retry: 帧而非 HTTP 429
# 在浏览器多开 tab 观察 Network 面板，确认无每 3 秒重连风暴；
# 被限流的连接 status=200、响应体含 "retry: 60000"

# Origin 白名单
curl -i -H 'Origin: https://attacker.com' \
  https://dev-news-api.oddfi.io/api/push/stream
# 期望：403 forbidden origin
```

### 仅改 .env（不重新 build）

```bash
# 本地编辑 .env.dev 后
scp .env.dev test-market-api:/home/ubuntu/oddfi-agent-backend/.env.dev
ssh test-market-api 'docker restart oddfi-agent-backend'
# ~5 秒生效
```

### 切换 AI provider（env 即可，不用 build）

```bash
# .env.dev 改 AI_BASE_URL / AI_API_KEY / AI_MODEL 后
scp .env.dev test-market-api:/home/ubuntu/oddfi-agent-backend/.env.dev
ssh test-market-api 'docker restart oddfi-agent-backend'
```

### 看实时日志

```bash
ssh test-market-api 'docker logs -f oddfi-agent-backend'
# Ctrl+C 退出
```

### 资源巡查（dev 内存紧，常跑）

```bash
ssh test-market-api 'docker stats --no-stream oddfi-agent-backend'
ssh test-market-api 'docker inspect oddfi-agent-backend | jq ".[0].State.OOMKilled"'
# OOMKilled=true → 触发 256 m 上限；降低 .env.dev 的 MAX_SSE_CONNS / ENRICH_WORKERS
```

### 注入 mock tweet 调试全链路

```bash
# 服务需提前开启 DEV_API_ENABLED=true
curl -sS -X POST https://dev-news-api.oddfi.io/api/dev/inject-tweet \
  -H 'Content-Type: application/json' \
  -d '{"handle":"@FabrizioRomano","post":{"id":"dev_001","type":"post","text":"BREAKING: Real Madrid sign Alphonso Davies. Here we go!","author":{"handle":"@FabrizioRomano","name":"FR"}}}' | jq

# 确认入库
curl -sS 'https://dev-news-api.oddfi.io/api/push?limit=3' | jq '.items[0]'
```

### 回滚到上一个 dated tag

```bash
# 查可用历史 tag
# https://hub.docker.com/r/hankdong/oddfi-agent-backend/tags

# 回滚（替换 <tag> 为实际历史 tag，如 dev_20260601_a1b2c3d4）
ssh test-market-api 'bash /home/ubuntu/oddfi-agent-backend/deploy.sh dev dev_<YYYYMMDD>_<sha>'
```

### dev 故障速查

| 症状 | 排查命令 |
|---|---|
| healthz 返回 502 | `ssh test-market-api 'docker ps \| grep oddfi'` 看容器是否存活 |
| SSE 连接即断 | `docker logs --tail 50 oddfi-agent-backend` 看 origin 拒绝日志 |
| LLM 调用失败 | 日志找 `[Kimi] enrich error`；基础卡正常入库，前端显示"解读中…" |
| OOM 重启 | `docker inspect ... OOMKilled=true` → 降 `MAX_SSE_CONNS=30` + `ENRICH_WORKERS=2` |
| 容器反复重启 | `docker logs oddfi-agent-backend` 看 panic；检查 `.env.dev` 必填项是否缺失 |
| nginx 504 | SSE 响应超时 → 检查 nginx 模板的 `proxy_read_timeout` 是否为 `3600s` |
