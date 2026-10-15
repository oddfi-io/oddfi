# RUNBOOK · DD002 信号灯运维总册

> 一页纸搞定 DD002 相关的全部运维操作：部署拓扑、secret 索引、切换、回滚、排障。
> 专项手册：上游切换详细步骤见 [`RUNBOOK-events-upstream-switch.md`](./RUNBOOK-events-upstream-switch.md)。

## 1. 部署拓扑（2026-06-06 现状）

```
┌─ admin-server（<SERVER_IP>，SSH 别名 oddfi-admin）
│   oddfi-admin-server.service（systemd）:8081 ← Nginx(admin.oddfi.io) 反代
│   binary: /usr/local/bin/oddfi-admin-server   config: /etc/oddfi-admin/config.yaml
│   ├─ presale 上游 → https://admin-api.oddfi.io（C 端生产 <SERVER_IP>）
│   └─ events  上游 → http://<SERVER_IP>:8082（C 端 dev，WEBAPI_EVENTS_* 覆盖）
│
├─ oddfi-dev（<SERVER_IP>，C 端 dev 主机）
│   web-api 容器（host network）：公网 :80 + internal 0.0.0.0:8082
│   8082 入站仅 SG 白名单放行 admin-server（launch-wizard-5 安全组）
│   部署唯一入口：~/bin/deploy-web-api.sh <image> <部署人> [原因]（自动登记 DEPLOY_LOG.md）
│   ★ 核心部署规范（团队必读）：docs/deploy-dev-webapi.md
│
└─ oddfi-market-dev（<SERVER_IP>）
    web-spider 容器：OddsUpdated consumer → market_odds_snapshot + market_exposure_snapshot
```

## 2. Secret 索引（只记位置与对齐关系，值绝不入文档）

| 位置 | 文件 | 关键键 | 对齐关系 |
|---|---|---|---|
| admin-server | `/etc/oddfi-admin/env.production`（600） | `ADMIN_JWT_SECRET` | = oddfi-dev 的 `ADMIN_API_JWT_SECRET`（透传 X-Admin-JWT 验签用，2026-06-06 已对齐） |
| 同上 | 同上 | `WEBAPI_SERVICE_TOKEN` | = C 端**生产** web-api 的 service tokens（presale 链路） |
| 同上 | 同上 | `WEBAPI_EVENTS_SERVICE_TOKEN` | = oddfi-dev 的 `ADMIN_API_SERVICE_TOKENS`（events 联调期链路） |
| oddfi-dev | `~/oddfi-secrets/web-api-runtime.env`（600） | `ADMIN_API_*` 三件套 | 见上 |

⚠️ **改 oddfi-dev 的 env 后必须走 `deploy-web-api.sh` 重建容器**——`docker restart` 不重读 env-file（2026-06-06 实测踩坑）。

## 3. 高频操作

### 3.1 events 上游切换（dev ⇄ 生产）

→ 专项手册 [`RUNBOOK-events-upstream-switch.md`](./RUNBOOK-events-upstream-switch.md)。一句话版：删/加 `WEBAPI_EVENTS_*` 两行 env + `systemctl restart oddfi-admin-server`。

### 3.2 admin-backend 发版（标准流）

```bash
# 本机
GOOS=linux GOARCH=amd64 go build -o /tmp/oddfi-admin-server-NEW ./cmd/server
scp /tmp/oddfi-admin-server-NEW oddfi-admin:/tmp/
# 服务器（先备份再替换）
ssh oddfi-admin 'sudo cp /usr/local/bin/oddfi-admin-server /usr/local/bin/oddfi-admin-server.bak-$(date +%m%d) && sudo install -m 755 /tmp/oddfi-admin-server-NEW /usr/local/bin/oddfi-admin-server && sudo systemctl restart oddfi-admin-server && curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8081/health'
```

发版后回归两条：presale 实签 200 + events 实签 200（dev-token 流程见 `docs/risk-signal-curl.md` §0）。

### 3.3 回滚锚点

| 服务 | 回滚命令 | 锚点 |
|---|---|---|
| admin-backend | `sudo cp /usr/local/bin/oddfi-admin-server.bak-pre-dd002 /usr/local/bin/oddfi-admin-server && sudo systemctl restart oddfi-admin-server` | binary 备份 |
| dev web-api | `~/bin/deploy-web-api.sh <旧镜像tag> <操作人> "回滚"` | DEPLOY_LOG.md 查上一版 tag |
| dev spider | `docker rename` 流（RESULT-webapi-ops §7） | `web-spider-old` 容器 |

### 3.4 CORS 临时放行清理（联调 C 验收后必做）

```bash
ssh oddfi-admin 'sudo sed -i "/localhost:5173/d" /etc/oddfi-admin/config.yaml && sudo systemctl restart oddfi-admin-server'
```

## 4. 排障速查（events 接口异常时）

| 症状（admin 侧响应） | 大概率根因 | 查什么 |
|---|---|---|
| `UPSTREAM_UNAVAILABLE` 503 | dev 8082 不可达 | ① `ssh oddfi-dev 'ss -tlnp \| grep 8082'`；② **DEPLOY_LOG.md 看是否被别人部署顶掉**（dev 共享环境，发生过：未登记部署丢 ADMIN env 致 8082 断） |
| `ADMIN_JWT_INVALID` | 两侧 JWT secret 漂移 | §2 对齐关系；改 env 后是否重建容器（不是 restart） |
| 上游 401（HMAC） | service token 漂移 / 时钟偏差 | token 指纹比对；`hmac_window_ms` 默认 60s |
| `upstream error (HTTP 404)` | events 上游指了**生产**但 C 端还没发版 DD002 | `sudo grep WEBAPI_EVENTS /etc/oddfi-admin/env.production` 确认覆盖在位 |
| 数据全绿/敞口 null | 正常——dev 链上没有新 OddsUpdated 事件，敞口快照事件驱动 | `market_exposure_snapshot` 最新行时间 |

## 5. 待办登记（截至 2026-06-06）

- [ ] 联调 C 验收后：移除 CORS localhost:5173（§3.4）
- [ ] C 端 DD002 发版生产（切换前置 4 条见切换手册）→ 切 events 上游合流
- [ ] dev/admin 两机 `*-old` / `.bak-pre-dd002` 锚点：稳定后清理（≈2026-06-08）
- [ ] bookmaker ID 20 显示名待运营确认（detail 第三方赔率来源）
