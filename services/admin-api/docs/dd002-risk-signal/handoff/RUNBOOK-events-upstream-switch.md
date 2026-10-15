# RUNBOOK · events 信号灯上游切换（dev ⇄ 生产）

> 背景：DD002 信号灯先发布在 C 端 dev，presale 主上游在 C 端生产——admin-backend 用 **events 专用上游覆盖**让两模块独立指向。本手册是切换操作的唯一权威。
> 机制实现：`internal/config/config.go` `EventsUpstream()`（任一覆盖字段为空 → 回落主上游）。

## 当前态（联调期）

```
presale  → WEBAPI_INTERNAL_URL        = https://admin-api.oddfi.io（C 端生产）
events   → WEBAPI_EVENTS_INTERNAL_URL = http://<SERVER_IP>:8082（C 端 dev，SG 白名单已放行）
```

`/etc/oddfi-admin/env.production`（600）含四个 WEBAPI 键 + 两个 EVENTS 覆盖键。

## 切换到生产（C 端把 DD002 发版生产之后执行）

**前置确认**（缺一不可）：
1. C 端生产 web-api 已含 DD002（internal 五端点 + HMAC query 覆盖版 service_auth）
2. 生产侧 internal 通路就绪：经 `admin-api.oddfi.io` 反代新增 `/internal/admin/events/*` location，或生产机同样开 8082 + SG 白名单
3. 生产 `ADMIN_API_SERVICE_TOKENS` 含 admin 主 token（即 WEBAPI_SERVICE_TOKEN 那套）
4. 生产 spider 已部署 OPS-01a（敞口快照开始积累）

**操作**（admin-server 上）：

```bash
# 删掉两行 events 覆盖（或注释掉），events 自动回落主上游
sudo sed -i '/^WEBAPI_EVENTS_INTERNAL_URL=/d; /^WEBAPI_EVENTS_SERVICE_TOKEN=/d' /etc/oddfi-admin/env.production
sudo systemctl restart oddfi-admin-server
```

**验证三条**：

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8081/health                 # 200
# 实签打 events summary（dev-token 流程）→ 200 且数据来自生产赛事
# 实签打 presale rounds → 200（不受影响）
```

## 回退到 dev（生产上游出问题时）

```bash
# 重新追加两行（token 值见密码管理器/与 dev web-api ADMIN_API_SERVICE_TOKENS 一致，勿明文留 shell history）
sudo sh -c 'printf "WEBAPI_EVENTS_INTERNAL_URL=http://<SERVER_IP>:8082\nWEBAPI_EVENTS_SERVICE_TOKEN=<dev套token>\n" >> /etc/oddfi-admin/env.production'
sudo systemctl restart oddfi-admin-server
```

## 注意

- **半配置 = 不生效**：只配 URL 不配 token（或反之）会整体回落主上游（防打错鉴权），单测锁死该语义（`config_test.go TestEventsUpstream`）
- 切换影响面：仅 `/admin/events/*` + `/admin/approval/counts` 六条路由；presale 永不受影响
- token 不进 git/日志/stdout；env 文件保持 600
