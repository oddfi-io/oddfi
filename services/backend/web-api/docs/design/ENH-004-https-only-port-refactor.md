# ENH-004: 关闭 api.oddfi.io 的明文 HTTP 入口

**状态**：DRAFT（等你 APPROVE 后实施）
**日期**：2026-05-28
**作者**：oddfi-backend agent

---

## 1 用大白话讲：现在是什么样，要变成什么样

### 1.1 现在用户做什么会发生什么

用户能用 **两种方式**访问 api.oddfi.io：

```
浏览器/客户端 → https://api.oddfi.io/...   ✅ TLS 加密
浏览器/客户端 → http://api.oddfi.io/...    ⚠️  明文，能 work
```

两个都能拿到数据。如果用户/客户端配置写错 / 没加 `s`，**它依然能用**，请求里的 JWT / 钱包签名/ POST body 全部走明文。中间任何一跳（用户路由器、运营商、公网）能直接 sniffer 抓到。

### 1.2 目标：让 http:// 自动跳到 https://

```
浏览器/客户端 → http://api.oddfi.io/...   →  301 重定向 →  https://api.oddfi.io/...
浏览器/客户端 → https://api.oddfi.io/...  ✅ 不变
```

谁用 http 都被强制 bump 到 https，没法再走明文。

---

## 2 为什么不是改个 nginx 配置就完事

这是这个需求最绕的地方。**一句话**：`:80` 端口现在被 web-api 容器本身占着，nginx 没法监听 :80 做跳转。

### 2.1 当前 prod 端口归属（实测）

```bash
ssh oddfi-backend "ss -ltnp | grep -E ':80|:443|:8081'"
```

实测输出（删了多余行）：

```
LISTEN  *:80         users:(("web-api"  pid=97686))   ← web-api 容器（host network）
LISTEN  127.0.0.1:8081  users:(("web-api"  pid=97686))   ← internal health
LISTEN  0.0.0.0:443  users:(("nginx"   pid=96643))     ← nginx，TLS 终结
```

所以 prod 公网流量走向是：

```
公网 :443 ─── nginx (TLS 解密) ─── 反代到 127.0.0.1:80 ───┐
                                                          ├──→ 同一个 web-api 容器
公网 :80  ──────────────────────────────────── 直达 ──────┘
                                                  （绕开 nginx，明文）
```

`web-api/config_prod.yaml` 里 `server.port: 80`，容器跑 `--network host`，所以容器直接绑了宿主机的 `0.0.0.0:80`。

### 2.2 为什么不能让 nginx 也监听 :80

Linux 一个端口只能被一个进程监听。`web-api` 已经占了 :80，nginx 启动时 `bind() :80` 会返 `EADDRINUSE`。两个进程不可能同时听 :80。

### 2.3 所以必须换端口

只有两个选项：

| 选项 | 怎么做 | 后果 |
|---|---|---|
| **A. web-api 让出 :80** | 容器改听 `:8090`，nginx 接管 :80 做 301 跳转 | ✅ 推荐 — 1 次 cutover 全搞定 |
| B. 直接 SG 关 :80 | AWS SG 把 :80 inbound 撤掉 | ❌ 现存 http 客户端直接 timeout，差体验 |

本 ENH-004 选 **A**。

---

## 3 改完之后端口归属

```bash
# 改完之后的 ss 输出应该是这样
LISTEN  *:8090         users:(("web-api"))   ← web-api 容器（改听 :8090）
LISTEN  127.0.0.1:8081 users:(("web-api"))   ← internal health（不变）
LISTEN  0.0.0.0:80     users:(("nginx"))     ← nginx 接管 :80，做 301
LISTEN  0.0.0.0:443    users:(("nginx"))     ← nginx :443，不变
```

流量走向：

```
公网 :443 ─── nginx (TLS 解密) ─── 反代到 127.0.0.1:8090 ── web-api 容器
公网 :80  ─── nginx ──→ 301 redirect to https://$host$uri (永远跳走，不接业务)
```

---

## 4 具体要改哪些文件

| 文件 | 怎么改 |
|---|---|
| `web-api/config_prod.yaml`（在 prod EC2 上 `/etc/oddfi/config_prod.yaml`） | `server.port: 80` → `server.port: 8090` |
| `web-api/deploy/nginx/api.oddfi.io.conf` | （1）新增一个 `server { listen 80; server_name api.oddfi.io; return 301 https://$host$request_uri; }`<br>（2）现有 `:443 server` 块里 `proxy_pass http://127.0.0.1:80;` 改成 `proxy_pass http://127.0.0.1:8090;` |
| `web-api/scripts/redeploy.sh` | 内置 4 探针里 `http://127.0.0.1:80/...` 改成 `:8090` |
| `web-api/scripts/standard-deploy.sh` | §6 verify probes 同上 |
| `web-api/deploy/monitoring/dd003-alert-public.sh` | 如果监控探针还指 :80 内网 loopback，也得改 :8090（**注意区别**：公网那些 probe 仍打 `https://api.oddfi.io`，那些不动） |

**不动的**：
- web-api 容器仍跑 `--network host`（不切 bridge 网络，只是改监听端口）
- web-api 8081 internal health（继续只听 127.0.0.1，无公网，不动）
- admin-api.oddfi.io vhost（独立链路，无关联）
- DB / Redis / 任何应用代码

---

## 5 cutover 顺序（一次窗口完成，~5 min）

实施时机要求：**前端 `BACKEND_URL` 已切到 `https://api.oddfi.io` 至少 7 天**（避免前端服务端在我们改的时候还在 http 上调）。

```bash
# === 0. 前置 ===
# [本机] 改 web-api/deploy/nginx/api.oddfi.io.conf（加 :80 server 块 + 改 proxy 端口）
# [本机] 改 web-api/scripts/redeploy.sh + standard-deploy.sh 里的 :80 → :8090
# [本机] 改 web-api/config_prod.yaml.example（gitignored 的 config_prod.yaml 单独同步）

# === 1. 上传新版 nginx 配 + 测语法（不 reload）===
scp web-api/deploy/nginx/api.oddfi.io.conf oddfi-backend:/tmp/
ssh oddfi-backend "sudo cp /tmp/api.oddfi.io.conf /etc/nginx/sites-available/ && sudo nginx -t"
# 必须看到 nginx: configuration test is successful

# === 2. 改 host 上的 config_prod.yaml（port: 80 → 8090）===
ssh oddfi-backend "sudo sed -i.bak 's/^  port: 80$/  port: 8090/' /etc/oddfi/config_prod.yaml && sudo grep '^  port:' /etc/oddfi/config_prod.yaml"
# 必须看到 port: 8090（注意 server.port 在文件里可能与 db.port/redis.port 重名，要看 sed 范围）

# === 3. 重启 web-api 容器 ===
# 不需要新镜像（代码没变，配置走 mount），直接 stop + run 即可
# 用 redeploy.sh 跑（已经改成 :8090 探针）
sudo /usr/local/bin/redeploy.sh hankdong/account-web-api:<current-tag>
# redeploy.sh 4 探针应该全过（127.0.0.1:8090/health, :8090/api/v1/presale/config, ...）

# === 4. nginx reload（这一刻开始 :80 拒接业务，做 301）===
ssh oddfi-backend "sudo nginx -s reload"

# === 5. 公网验证 ===
/usr/bin/curl -sI http://api.oddfi.io/api/v1/presale/config
# 必须看到 HTTP/1.1 301 Moved Permanently + Location: https://api.oddfi.io/api/v1/presale/config

/usr/bin/curl -s https://api.oddfi.io/api/v1/presale/config | /usr/bin/jq '.data.vault.depositAddress'
# 必须返新金库地址（或测试期金库），证明 https 业务链路正常

# === 6. 端口归属确认 ===
ssh oddfi-backend "sudo ss -ltnp | grep -E ':80|:8090|:443'"
# 必须看到：nginx 占 :80 + :443，web-api 占 :8090
```

任何一步失败 → 进 §6 回滚。

---

## 6 回滚（< 3 分钟）

```bash
# 1. nginx 配回旧版（只听 :443，不动 :80）
ssh oddfi-backend "sudo cp /etc/nginx/sites-available/api.oddfi.io.bak /etc/nginx/sites-available/api.oddfi.io && sudo nginx -t && sudo nginx -s reload"

# 2. config_prod.yaml port 改回 80
ssh oddfi-backend "sudo sed -i 's/^  port: 8090$/  port: 80/' /etc/oddfi/config_prod.yaml"

# 3. 容器再重启
sudo /usr/local/bin/redeploy.sh hankdong/account-web-api:<current-tag>

# 4. 验证退回
/usr/bin/curl -sI http://api.oddfi.io/api/v1/presale/config
# 应该返 HTTP 200（而不是 301），说明 :80 又开始接业务了
```

---

## 7 风险

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| nginx :80 server 块语法错 → reload fail | 🟢 低 | 中 | §5 步骤 1 先 `nginx -t` 校验 |
| 容器启动后 :8090 没监听（config 改错） | 🟢 低 | 高 | redeploy.sh 4 探针抓住，自动回滚旧 tag |
| 老移动端不 follow 301 → 接口 fail | 🟡 中 | 中 | 监控 :80 流量；如果还有 http 客户端，可改成 :80 同时支持 301 + proxy_pass 兼容期 1 周 |
| 漏改 redeploy.sh 探针 → 探针误报 | 🟢 低 | 低 | §0 前置就改完 |
| 监控告警脚本 dd003-alert-public.sh 探 :80 失败 | 🟡 中 | 低（告警噪音） | §0 同步改 |

---

## 8 验证标准（DoD）

部署后 24h 内：

- [ ] `curl -I http://api.oddfi.io/api/v1/presale/config` → **301** + Location: https://...
- [ ] `curl https://api.oddfi.io/api/v1/presale/config` → **200** + JSON
- [ ] `ss -ltnp` 端口归属符合 §3 表
- [ ] redeploy.sh 一次能跑通（4 探针 + verify-migration + verify-worker）
- [ ] nginx access log 没有 5xx 飙升
- [ ] dd003-alert-public.sh cron 没漏报

---

## 9 不做的话

- 长期保留明文 :80 → 任何 PenTest / 安全审计会列为 Medium issue
- 老客户端没人催不会主动切 https
- 万一某天 :80 明文路径上有用户的 JWT 被中间人截取，事后追责会问"为什么 :443 都搞好了 :80 不关"

---

## 10 前置依赖（必须先满足）

oddfi-frontend `.env.local` 的 `BACKEND_URL` 必须先改成 `https://api.oddfi.io` 并 deploy 至少 7 天观察。原因：前端 Next.js 服务端的 API Route 代理走 `BACKEND_URL`，本 ENH-004 改完后任何 `http://api.oddfi.io` 都会被 301 跳转，Next.js fetch 默认 follow redirect 但会浪费一次 round trip + 在某些场景可能 redirect loop。

**前端切完 https 之前不要执行本 ENH-004。**

---

## 11 关联

- [api.oddfi.io.conf](../../deploy/nginx/api.oddfi.io.conf) — 当前 nginx vhost
- [redeploy.sh](../../scripts/redeploy.sh) / [standard-deploy.sh](../../scripts/standard-deploy.sh) — 部署脚本
- [cutover-dd003.md](../dd-invest/ops/cutover-dd003.md) §3 — 现有 nginx 部署历史
- ENH-002 / ENH-003 — 同 design 目录的其他待 APPROVE 提案
