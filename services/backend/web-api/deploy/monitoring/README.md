# DD-003 监控告警（MVP — Lark webhook）

## 范围

cron 每 5min 跑一次：

| # | 规则 | 阈值 | 触发点 | 跑在哪 | 脚本 |
|---|------|------|--------|--------|------|
| 1 | admin internal endpoint 5xx 率 | > 1% / 5min | nginx access log | oddfi-backend | `dd003-alert-webapi.sh` |
| 2 | audit 写入失败（idempotency 无 audit_id） | > 0（任何 1 行） | RDS query | oddfi-backend | `dd003-alert-webapi.sh` |
| 3 | admin-backend → web-api retry exhausted | > 0 / 5min | admin journalctl | oddfi-admin | `dd003-alert-admin.sh` |
| 4 | **public 接口状态码异常**（INC-002 A4 / TODO-001）| 单次探针失败即触发 | 主动 curl localhost | oddfi-backend | `dd003-alert-public.sh` |

规则 4 探 4 个 endpoint：`/health` (8081) / `/api/v1/presale/config` / `/api/v1/presale/position` / `/account/login_by_wallet`。同步防 INC-001（DB 连接性）+ INC-002（缺表 / public 接口潜伏 5xx）两类回归。

去重：每条告警 30 min 同状态不重发，避免刷屏。状态存 `/tmp/.dd003-alert-state.<rule>`。

## 部署

### 1. 拿 Lark webhook URL（手动）

Lark 群 → 设置 → 群机器人 → 添加自定义机器人 → 复制 webhook URL。
推荐开启「签名校验」（custom_keywords）防止泄露被外人滥用。

### 2. 部署 oddfi-backend 侧（规则 1 + 2）

```bash
# scp 脚本
scp web-api/deploy/monitoring/dd003-alert-webapi.sh oddfi-backend:/tmp/

# ssh 部署
ssh oddfi-backend
sudo install -m 755 -o root -g root /tmp/dd003-alert-webapi.sh /usr/local/bin/dd003-alert-webapi.sh

# 配置环境变量（密钥落 /etc/oddfi/dd003-alert.env，0400 权限）
sudo tee /etc/oddfi/dd003-alert.env > /dev/null <<EOF
LARK_WEBHOOK_URL=<paste Lark webhook URL>
MYSQL_PWD=<RDS admin password>
EOF
sudo chmod 0400 /etc/oddfi/dd003-alert.env
sudo chown root:root /etc/oddfi/dd003-alert.env

# 装 cron
echo '*/5 * * * * root . /etc/oddfi/dd003-alert.env && /usr/local/bin/dd003-alert-webapi.sh >> /var/log/dd003-alert.log 2>&1' | sudo tee /etc/cron.d/dd003-alert
sudo chmod 0644 /etc/cron.d/dd003-alert

# 干跑一次 verify
sudo bash -c 'set -a; . /etc/oddfi/dd003-alert.env; /usr/local/bin/dd003-alert-webapi.sh'
```

### 2b. 部署 oddfi-backend 侧（规则 4 — public 探针）

```bash
# scp 脚本
scp web-api/deploy/monitoring/dd003-alert-public.sh oddfi-backend:/tmp/
ssh oddfi-backend
sudo install -m 755 -o root -g root /tmp/dd003-alert-public.sh /usr/local/bin/dd003-alert-public.sh

# 复用规则 1+2 的 env 文件（已有 LARK_WEBHOOK_URL）
# 装独立 cron 文件方便单独 disable
echo "*/5 * * * * root /bin/bash -c '. /etc/oddfi/dd003-alert.env && /usr/local/bin/dd003-alert-public.sh' >> /var/log/dd003-alert.log 2>&1" \
  | sudo tee /etc/cron.d/dd003-alert-public
sudo chmod 0644 /etc/cron.d/dd003-alert-public

# 干跑一次 verify
sudo sh -c '. /etc/oddfi/dd003-alert.env && /usr/local/bin/dd003-alert-public.sh >> /var/log/dd003-alert.log 2>&1'
sudo tail -3 /var/log/dd003-alert.log
# 期望：…dd003-alert-public.sh: OK
```

### 3. 部署 oddfi-admin 侧（规则 3）

```bash
# scp 脚本
scp web-api/deploy/monitoring/dd003-alert-admin.sh oddfi-admin:/tmp/

# ssh 部署
ssh oddfi-admin
sudo install -m 755 -o root -g root /tmp/dd003-alert-admin.sh /usr/local/bin/dd003-alert-admin.sh

# 配置 webhook
sudo tee /etc/oddfi-admin/dd003-alert.env > /dev/null <<EOF
LARK_WEBHOOK_URL=<paste 同上 Lark webhook URL>
EOF
sudo chmod 0400 /etc/oddfi-admin/dd003-alert.env

# 装 cron
echo '*/5 * * * * root . /etc/oddfi-admin/dd003-alert.env && /usr/local/bin/dd003-alert-admin.sh >> /var/log/dd003-alert.log 2>&1' | sudo tee /etc/cron.d/dd003-alert
sudo chmod 0644 /etc/cron.d/dd003-alert

# 干跑一次 verify
sudo bash -c 'set -a; . /etc/oddfi-admin/dd003-alert.env; /usr/local/bin/dd003-alert-admin.sh'
```

### 4. 测试 webhook 通

任一侧 ssh 后跑：
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"msg_type":"text","content":{"text":"[DD-003] test alert"}}' \
  "$LARK_WEBHOOK_URL"
```
期望返回 `{"code":0,"msg":"ok",...}`，Lark 群里看到一条消息。

## 调优

72h 观察期可能发现：
- 假告警太多 → 调高阈值（编辑脚本顶部的 `THRESHOLD_*` 变量）
- 漏告警 → 调低阈值，或加新规则（参见 cutover-dd003.md §8 另外 3 条）
- 刷屏 → 增加 `DEDUP_WINDOW_SEC`

## 关联

- cutover-dd003.md §8 监控告警
- ADR-0004 prod 架构

## 后续

- 当前是 cron + bash MVP，无监控平台
- 长期可演进到 Prometheus + Alertmanager / Grafana / Datadog 等
- 但当前流量 + 规则数 < 10 条，MVP 完全够用
