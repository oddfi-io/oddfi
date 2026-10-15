# DD-003 Cutover Runbook（admin RPC 模式上线）

> **生效日期**：DD-003 v3.1 全部 8 batch 实施完成（2026-05-26）
> **关联**：[DD-003 v3.1](../DD-003-admin-rpc-rework.md) · [ADR-0001](../adr/ADR-0001-admin-rpc-not-shared-db.md) · [ADR-0002](../adr/ADR-0002-deferred-mtls-jwt-blacklist-legacy-admin.md) · [ADR-0003](../adr/ADR-0003-tx-in-context-dual-pattern.md) · [ADR-0004](../adr/ADR-0004-prod-architecture-snapshot.md)
> **执行人**：DevOps + DD-INVEST 总督导
> **预估窗口**：~3h 操作 + 72h 观察

---

## 0 前置 check（部署前 24h 完成）

| # | 检查项 | 命令 / 验证 |
|---|---|---|
| 1 | admin EC2 已绑 Elastic IP（防漂移） | AWS console: oddfi-admin instance → Elastic IP `<SERVER_IP>` associated |
| 2 | oddfi-backend EC2 已绑 Elastic IP（防漂移） | AWS console: oddfi-backend instance → EIP `<SERVER_IP>`（单 ENI 单 EIP，IMDS 实测确认 2026-05-26） |
| 3 | DNS：admin-api.oddfi.io A 记录 → <SERVER_IP>（与 api.oddfi.io 同 IP） | `dig admin-api.oddfi.io` 返 <SERVER_IP> |
| 4 | 两侧密钥已生成并落配 | 见 §1 |
| 5 | `seed/presale_init.sql` 真值与运营确认 | 6 轮时间窗 + min_subscribe_usd 测试期 0.01 |
| 6 | web-api 主仓库 main 已 squash merge `feat/presale-v3`（待执行） | `git log origin/main --oneline -1` |
| 7 | admin-backend 主仓库 main 已 squash merge `impl/presale-admin`（待执行） | `git log origin/main --oneline -1` |
| 8 | prod RDS 备份完成（DDL 变更前） | `mysqldump -h <RDS_HOST> -u admin -p project_oddfi > ~/backup/project_oddfi-pre-dd003.sql`（在 oddfi-backend EC2 上执行）|
| 9 | 本地 docker login 到 herongwei 账号可用 | `docker login` → 确认 `herongwei` 账号已登录 |
| 10 | 本地 `web-api/config_prod.yaml` 已加 DD-003 五个新字段 | 见 §2.2 |

---

## 1 生成共享密钥（**必须在两侧同一时刻配齐**）

在工作机生成两个密钥（每个 ≥ 48 字节 base64）：

```bash
# 1. service-token (HMAC secret) — 用于 admin → web-api HMAC 签名
SERVICE_TOKEN=$(openssl rand -base64 48)
echo "SERVICE_TOKEN=$SERVICE_TOKEN" | tee -a ~/.ssh/dd003-secrets-PROD.txt

# 2. admin JWT secret — 与 admin-backend 共享，从 admin EC2 env.production 取现有值
ADMIN_JWT_SECRET=$(ssh oddfi-admin "sudo grep ADMIN_JWT_SECRET /etc/oddfi-admin/env.production | cut -d= -f2-")
echo "ADMIN_JWT_SECRET=$ADMIN_JWT_SECRET" | tee -a ~/.ssh/dd003-secrets-PROD.txt
```

⚠️ **绝对不要 echo / git commit / scp secrets 文件**。所有传输走 SSH session 内手填。

---

## 2 Step 1：web-api 部署 prod（含 internal listener）

### 2.1 跑 migration（含验证）

⚠️ **INC-002 教训**：本步骤曾因「假设 0001-0008 已存在于 prod」而漏跑 8 张表，潜伏 12h。
现强制：**列 manifest → apply pending → 跑 verify-migration.sh → exit 0 才算完成**。

#### 步骤 1 · 列出 manifest

参见 [`web-api/migrations/README.md`](../../../migrations/README.md) — 当前期望 10 张表。

#### 步骤 2 · Apply pending migration

`migration SQL 文件无 USE 语句，直接指定 DB project_oddfi 执行。`

```bash
# scp 全部 migration 到 oddfi-backend EC2（RDS 同 VPC，本机有 mysql 客户端）
scp web-api/migrations/00*_*.sql oddfi-backend:/tmp/

# 在 oddfi-backend 上按序 apply（已存在的表会 fail；如要忽略重复请手工 grep）
ssh oddfi-backend 'bash -s' <<'EOF'
set -e
export MYSQL_PWD=<rds_pwd>  # 或从 /etc/oddfi/config_prod.yaml database.password 取
RDS_HOST="<RDS_HOST>"
for f in /tmp/00*_*.sql; do
  echo "▶ apply $f"
  mysql -h "$RDS_HOST" -u admin project_oddfi < "$f" && echo "  ✅ done" || { echo "  ❌ FAIL"; break; }
done
rm -f /tmp/00*_*.sql
EOF
```

#### 步骤 3 · 必须跑 verify-migration.sh（**任务完成判据**）

```bash
scp web-api/scripts/verify-migration.sh oddfi-backend:/tmp/
ssh oddfi-backend 'sudo /tmp/verify-migration.sh'
```

期望输出末尾：

```
✅ 全部 10 张表存在
✅ presale_config 单行 seed OK（vault_address 长度=42）
🎉 migration verify PASSED
```

**未看到 `🎉 PASSED` 不得标 §2.1 完成**（详见 `.claude/rules/migration-deploy.md`）。

#### 步骤 4 · 首次部署 seed 真实值（presale_config）

migration `0003` 自带 `INSERT IGNORE id=1` 占位行（vault=`0x0000...0001` / lark=''）。首次部署后必须 UPDATE 真实值：

```bash
ssh oddfi-backend 'bash -s' <<'EOF'
export MYSQL_PWD=<rds_pwd>
mysql -h <rds_host> -u admin project_oddfi <<SQL
UPDATE presale_config SET
  vault_address    = '<真实 vault 地址>',
  lark_webhook_url = '<真实 Lark webhook URL>',
  updated_at       = UNIX_TIMESTAMP(NOW())*1000
WHERE id=1;
SQL
EOF
```

后续 vault / webhook 变更走 admin SPA 的 `PATCH /admin/presale/config` 接口，不再直接改 DB。

### 2.2 config_prod.yaml 加 DD-003 字段

在本地 `web-api/config_prod.yaml`（gitignored）的 `admin_api:` 节下确认以下五个字段已写入。字段名来自 `AdminAPIConfig` yaml tag（见 `internal/config/config.go`）：

```yaml
admin_api:
  internal_port: 8081
  service_tokens:
    - <paste SERVICE_TOKEN from §1>
  jwt_secret: <paste ADMIN_JWT_SECRET from §1>
  hmac_window_ms: 60000
  idempotency_ttl_days: 90
```

⚠️ `config_prod.yaml` 在 build 时 `COPY` 进镜像 → `/app/config.yaml`，**禁止 git commit 该文件**。

### 2.3 构建 + 推 Docker 镜像 + 拉取部署

```bash
# 工作机本地构建并推送（web-api/ 目录内）
cd /Users/hang/work/oddfi-backend
./web-api/deploy/docker-build-and-push.sh
# 脚本内部：docker build -t hankdong/account-web-api:prod web-api/ && docker push hankdong/account-web-api:prod

# ssh 到 oddfi-backend，拉新镜像
ssh oddfi-backend

# 备份当前运行容器（便于快速回滚，见 §7）
sudo docker rename web-api web-api.bak

# 拉新镜像（首次用 :prod_dd003 fallback tag；验证通过后再 promote :prod）
sudo docker pull hankdong/account-web-api:prod_dd003

# 启动新容器
# 公网端口由 config_prod.yaml `server.port: 80` 决定 — 与旧版一致，drop-in 替换
# 新增 127.0.0.1:8081（internal admin endpoint，由 admin_api.internal_port 决定）
# 加 --restart unless-stopped 修正旧版 RestartPolicy=no 的 hidden risk
sudo docker run -d \
  --network host \
  --restart unless-stopped \
  --log-opt max-size=1000m \
  --log-opt max-file=3 \
  --name web-api \
  hankdong/account-web-api:prod_dd003

# 验证：journalctl 不可用（Docker 不是 systemd），看 docker logs
sudo docker logs web-api --tail 50 | grep -E "(public server starting|internal admin server starting|presale module)"
# 期望：
#   [main] presale module enabled=true (vault_pool_count=N)
#   public server starting on 0.0.0.0:80
#   [main] internal admin server starting on 127.0.0.1:8081 (loopback only)
```

> **public 端口不变（:80）**：新旧版都监听 host 的 :80，api.oddfi.io 无感切换（除 docker stop/run 那 5-10s）。
> **新增 :8081 loopback** 给 admin-api.oddfi.io vhost 反代用，不对公网暴露。

### 2.4 进程级自检（**3 类路径都要覆盖** — INC-002 教训）

INC-002 之前 §2.4 只覆盖 internal 路径，让缺表问题潜伏 12h。现强制至少覆盖以下 3 类：

```bash
ssh oddfi-backend 'bash -s' <<'EOF'
set +e
echo "▶ 1. Health (internal 8081)"
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:8081/health
# 期望：200

echo "▶ 2. Public business 无鉴权（INC-002 防回归 — public presale 路径必测）"
curl -sS -o /tmp/cfg.json -w 'HTTP %{http_code}\n' http://127.0.0.1:80/api/v1/presale/config
head -c 200 /tmp/cfg.json; echo
# 期望：HTTP 200，body 含 vault.depositAddress

echo "▶ 3. Public business 鉴权（INC-001 防回归 — 用户登录 DB 链路必测）"
curl -sS -o /tmp/login.json -w 'HTTP %{http_code}\n' -X POST \
  -H 'Content-Type: application/json' \
  -d '{"address":"0x0000000000000000000000000000000000000001"}' \
  http://127.0.0.1:80/account/login_by_wallet
# 期望：HTTP 400 validation（说明 DB 连得上 — 防 1045 INC-001 重现）

echo "▶ 4. Internal admin（签名一道关）"
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:8081/internal/admin/presale/rounds
# 期望：HTTP 401 SERVICE_SIG_INVALID
EOF
```

**4 行 HTTP 码都符合期望才能标 §2.4 完成**。任一项错就回到 §2.1 / §2.3 排查。

---

## 3 Step 2：web-api EC2 装 nginx + admin-api.oddfi.io vhost

web-api EC2（oddfi-backend）当前**未安装 nginx**，本步骤新装并配置 vhost。

### 3.1 安装 nginx + certbot

```bash
ssh oddfi-backend
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

### 3.2 部署 vhost 配置

vhost 配置文件已预制在 `web-api/deploy/nginx/admin-api.oddfi.io.conf`，直接 scp 上去：

```bash
# 工作机执行
scp web-api/deploy/nginx/admin-api.oddfi.io.conf oddfi-backend:/tmp/admin-api.oddfi.io.conf
ssh oddfi-backend "sudo cp /tmp/admin-api.oddfi.io.conf /etc/nginx/sites-available/admin-api.oddfi.io"
ssh oddfi-backend "sudo ln -sf /etc/nginx/sites-available/admin-api.oddfi.io /etc/nginx/sites-enabled/"
```

### 3.3 申请 Let's Encrypt 证书

```bash
ssh oddfi-backend
sudo certbot certonly --nginx -d admin-api.oddfi.io
# 期望：成功生成 /etc/letsencrypt/live/admin-api.oddfi.io/{fullchain,privkey}.pem
```

### 3.4 全局 limit_req_zone 注册 + 启动

```bash
# 在 nginx.conf http {} 内追加全局限流 zone（只加一次）
sudo grep -q "limit_req_zone.*admin_internal" /etc/nginx/nginx.conf || \
  sudo sed -i '/http {/a\    limit_req_zone $binary_remote_addr zone=admin_internal:10m rate=10r/s;' /etc/nginx/nginx.conf

sudo nginx -t && sudo systemctl enable nginx && sudo systemctl reload nginx
```

### 3.5 部署后 e2e 自检

```bash
# 从工作机（非 admin IP）：必须 403
curl -i https://admin-api.oddfi.io/internal/admin/presale/rounds
# 期望：HTTP/2 403

# 从 admin EC2（admin IP <SERVER_IP>）：无签名应 401
ssh oddfi-admin "curl -i https://admin-api.oddfi.io/internal/admin/presale/rounds"
# 期望：HTTP/2 401 SERVICE_SIG_INVALID
```

---

## 4 Step 3：admin-backend 升级（薄壳化）

### 4.1 配置 EnvironmentFile

```bash
ssh oddfi-admin
sudo vim /etc/oddfi-admin/env.production
```

追加：

```
# DD-003 web-api internal endpoint
WEBAPI_INTERNAL_URL=https://admin-api.oddfi.io
WEBAPI_SERVICE_TOKEN=<同 §1 的 SERVICE_TOKEN，与 web-api 端 service_tokens[0] 一致>
WEBAPI_TIMEOUT_SEC=5
WEBAPI_MAX_RETRIES=3
```

确认 `ADMIN_JWT_SECRET` 值不变（已与 web-api `jwt_secret` 对齐）。

⚠️ 收紧 `ADMIN_JWT_TTL` 至 ≤ 2h（ADR-0002 Debt-2 缓解措施）：

```yaml
# /etc/oddfi-admin/config.yaml
jwt:
  ttl: 2h   # 从默认 24h 收紧
```

> 检查：如果 `env.production` 里有遗留 mysql DSN 相关 env（DD-002 时代写入的），**保留但标注 DEPRECATED**，待 §6 admin DB DROP 完成后再清理，避免误删导致回滚困难。

### 4.2 部署新 binary

```bash
cd /Users/hang/work/oddfi-admin-backend
git checkout main && git pull origin main
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o bin/admin-server-linux ./cmd/server
scp bin/admin-server-linux oddfi-admin:/tmp/admin-server.new

ssh oddfi-admin
sudo install -m 755 -o root -g root /tmp/admin-server.new /usr/local/bin/oddfi-admin-server
sudo systemctl restart oddfi-admin-server

# 验证启动（systemd，journalctl 可用）
sudo journalctl -u oddfi-admin-server --since "30 sec ago" -n 30
# 期望：mysql connected / redis connected / admin server listening
```

### 4.3 联调烟测（运营用真实 Lark 账号登录后操作）

```
1. 浏览器：登 admin.oddfi.io → Lark OAuth → 拿到 admin JWT
2. 点 "查看预售轮次" → 期望返 6 轮列表（web-api DB seed）
3. 点 "暂停种子轮" + note 填 "DD-003 cutover 烟测暂停" → 期望 200
4. 验证 web-api 端 audit 落库：
   ssh oddfi-backend "mysql -h $RDS_HOST -u admin -p -N -B project_oddfi -e \
     'SELECT operator, action, target_id, created_at FROM presale_admin_audit ORDER BY id DESC LIMIT 5;'"
5. 验证 admin_idempotency 表 1 行 + audit_id 链接：
   ssh oddfi-backend "mysql -h $RDS_HOST -u admin -p -N -B project_oddfi -e \
     'SELECT idempotency_key, audit_id, response_status FROM admin_idempotency ORDER BY id DESC LIMIT 5;'"
6. 立刻 "恢复种子轮" 还原状态机
```

---

## 5 Step 4：72h 观察 + 17 endpoint 全覆盖

按 DD-003 §6.3 验收标准：

### 5.1 endpoint 覆盖矩阵（72h 内完成）

| # | endpoint | 运营触发方式 |
|---|---|---|
| 1 | GET /presale/rounds | 自然查看 |
| 2 | GET /presale/rounds/:id | 自然查看 |
| 3 | POST /pause | 烟测：暂停 + 恢复 |
| 4 | POST /resume | 烟测：暂停 + 恢复 |
| 5 | POST /reopen | 需 1 个 ended 轮次（5/28 SEED 结束后） |
| 6 | POST /close | 配合 reopen 用 |
| 7 | PATCH /referral-pct | 烟测：改 → 改回 |
| 8 | PATCH /rounds/:id | 烟测：改 priceUsd 一档 → 改回 |
| 9 | GET /deposits | 自然查看 |
| 10 | GET /deposits/:txHash | 用现有真链 7 笔之一查 |
| 11 | POST /migrate-round | **需手工构造**：用测试金库发一笔到 boundary，触发 migrate（带 note "cutover_smoketest_migrate"） |
| 12 | GET /config | 自然查看 |
| 13 | PATCH /config | 烟测：改 min_subscribe_usd 0.01 → 0.02 → 0.01 |
| 14 | GET /anomaly | 自然查看 |
| 15 | GET /anomaly/:id | 用 5/26 测试期 anomaly 之一 |
| 16 | POST /anomaly/resolve | **需手工构造**：触发一个 overflow anomaly 然后 resolve（带 note "cutover_smoketest_resolve"） |
| 17 | GET /audit | 自然查看（应能看到上面所有操作的 audit log） |

### 5.2 三方对账（必须每天跑一次）

```bash
RDS_HOST="<RDS_HOST>"
CUTOVER_START_MS=<cutover 开始时间戳，毫秒>

# 1. audit 行数（project_oddfi DB，web-api EC2 执行）
ssh oddfi-backend "mysql -h $RDS_HOST -u admin -p -N -B project_oddfi <<SQL
SELECT
  (SELECT COUNT(*) FROM presale_admin_audit WHERE created_at > $CUTOVER_START_MS) AS audit_count,
  (SELECT COUNT(*) FROM admin_idempotency WHERE created_at > $CUTOVER_START_MS AND audit_id IS NOT NULL) AS idem_count;
SQL"

# 2. admin-backend forward 成功计数（oddfi-admin EC2 执行，systemd journalctl 可用）
ssh oddfi-admin "journalctl -u oddfi-admin-server --since '<cutover_start_datetime>' | grep -c '\[webapi-client\] forward success'"

# 三个数字应一致（容忍 ±1 in-flight）
```

---

## 6 Step 5：admin DB DROP 旧 audit 表（72h 验收通过后）

⚠️ **不可回滚**。执行前先确认：

```bash
# 先查 admin EC2 本机 oddfi_admin DB 有哪些表及行数
ssh oddfi-admin "sudo mysql oddfi_admin -e 'SHOW TABLES;'"
# 如果 presale_admin_audit 表存在：
ssh oddfi-admin "sudo mysql oddfi_admin -e 'SELECT COUNT(*) FROM presale_admin_audit;'"
# 期望：0（DD-002 时代未真写）
# 如果不为 0：保留并 flag，暂不 DROP，待人工确认数据迁移后再操作
```

确认条件满足（三条全 ✅）再执行 DROP：
1. 17 endpoint 全覆盖 ✅
2. 三方对账 ≥3 天数字一致 ✅
3. 0 个 admin operator 报告异常 ✅

```bash
ssh oddfi-admin
sudo mysql oddfi_admin

mysql> SELECT COUNT(*) FROM presale_admin_audit;  -- 期望 0
mysql> DROP TABLE presale_admin_audit;
mysql> SHOW TABLES;  -- 期望只剩 admin_users
mysql> EXIT;
```

---

## 7 回滚预案

### 7.1 Step 1 失败（migration）

```bash
RDS_HOST="<RDS_HOST>"
ssh oddfi-backend "mysql -h $RDS_HOST -u admin -p project_oddfi <<'SQL'
DROP TABLE IF EXISTS admin_idempotency;
DROP TABLE IF EXISTS presale_admin_audit;
SQL"
```

### 7.2 Step 1 失败（Docker 容器）

```bash
ssh oddfi-backend
# 停掉新容器
sudo docker stop web-api && sudo docker rm web-api
# 恢复备份容器（§2.3 rename 的 web-api.bak）
sudo docker rename web-api.bak web-api
sudo docker start web-api

# 验证
sudo docker logs web-api --tail 20
```

### 7.3 Step 2 失败（Nginx）

```bash
ssh oddfi-backend
sudo rm -f /etc/nginx/sites-enabled/admin-api.oddfi.io
sudo nginx -t && sudo systemctl reload nginx
```

### 7.4 Step 3 失败（admin-backend binary）

```bash
ssh oddfi-admin
sudo cp /usr/local/bin/oddfi-admin-server.backup /usr/local/bin/oddfi-admin-server
sudo systemctl restart oddfi-admin-server
```

### 7.5 Step 5 (admin DB DROP) 不可回滚

唯一保护：§0 check #8 的 mysqldump 备份。需要时在 oddfi-admin 上 restore：

```bash
# ⚠️ admin EC2 → RDS 直连 timeout（设计意图），需从 oddfi-backend 上 restore
scp ~/backup/project_oddfi-pre-dd003.sql oddfi-backend:/tmp/
ssh oddfi-backend "mysql -h $RDS_HOST -u admin -p project_oddfi < /tmp/project_oddfi-pre-dd003.sql"
```

---

## 8 监控告警（部署后立即配）

| 指标 | 阈值 | 告警目标 |
|---|---|---|
| admin internal endpoint 5xx 率 | > 1% / 5min | Lark 运营群 |
| audit 写入失败（应该 0） | > 0 | Lark 运营群（合规事件） |
| Docker web-api 容器非预期退出 | 任意次 | DevOps（RestartPolicy=no，容器挂不自启） |
| admin-backend webapi-client retry exhausted | > 0 | Lark 运营群 |
| Nginx admin-api.oddfi.io 4xx 率 | > 5% / 5min | DevOps（可能扫描器） |
| Nginx admin-api.oddfi.io 403 计数 | > 100/hour | DevOps（DDoS 预警） |

---

## 9 完成判定

- ✅ §1-§6 全部步骤完成
- ✅ 72h 观察期 0 个 P0/P1 事件
- ✅ 三方对账数字一致
- ✅ 旧 audit 表已 DROP（或已 flag 保留并记录原因）
- ✅ 监控告警配齐
- ✅ DD-003 / tasks.md 状态全部 ✅

→ DD-003 RPC 模式 prod 上线**完成**。
