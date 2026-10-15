# DD-INVEST V3 上线部署计划（prod-direct）

> **策略**：main 分支直接部署到生产 `oddfi-backend` 服务器，真链测试在 prod 上跑（用测试金库 + 小额 USDT 控风险）。dev 分支最后 cherry-pick 仅做代码同步，dev-api 服务器靠运行时门控自动禁用预售模块（dev/testnet 无副作用）。
> **作者**：DD-INVEST V3 总督导 Claude · 2026-05-26（2026-05-26 修订：纠正 staging 误判，prod 即唯一部署目标）
> **关联**：[tasks.md](tasks.md)（执行追踪表） · [frontend-integration.md](../frontend-integration.md) · [phase5-report.md](../testing/phase5-report.md) · [cutover-dd003.md](cutover-dd003.md)

---

## 0 总览

按 5 步顺序执行：

| Step | 内容 | 负责 | 风险 |
|---|---|---|---|
| 1 | web-api 合 main + `oddfi-backend` prod 服务器部署 | 我执行（已显式授权） | 🟡 中（依赖 prod MySQL migration + Worker 进程） |
| 2 | admin-backend 合 main + `oddfi-admin` 服务器部署 | ✅ 已完成（2026-05-26） | 🟢 |
| 3 | prod 全量联调（真链 + 真接口） | 我 + 人类 review | 🟡 中（真金白银上链；用测试金库 + 小额 USDT 兜底） |
| 4 | 前端基于 [frontend-integration.md](../frontend-integration.md) 适配 | 前端 agent | 🟢 |
| 5 | cherry-pick 回 dev + 推送到 dev-api（仅代码同步） | 我执行 | 🟢 低（门控自动禁用） |

**核心设计**：web-api 用 `cfg.Presale.VaultPool` 维度门控，零配置即禁用。prod 服务器配齐 PRESALE_VAULT_POOL 等 env → 预售模块启用；dev 分支同步代码后部署到 dev-api 服务器（不配 env）→ 整模块自动禁用，testnet 无副作用。

---

## Step 1 · web-api 合 main + `oddfi-backend` prod 部署

### 1.1 本地合 main + push（在工作机）

```bash
cd /Users/hang/work/oddfi-backend
git fetch origin
git checkout main && git pull origin main

# squash merge：impl/presale-v3 上 7 个细颗粒 commits 合成 1 个
git merge --squash impl/presale-v3
git commit -F /tmp/web-api-merge-msg.txt   # commit message 见 §6.1
git push origin main
```

**待 push 前确认**：
- worktree `impl/presale-v3` 当前 HEAD 包含 7 commits（B0/B1/B2/Phase5-P0/B4/P1/门控）
- 主仓库 main 当前 HEAD 没有冲突源

### 1.2 `oddfi-backend` 服务器准备（prod 直接部署）

#### 1.2.1 跑 8 张业务表 migration

```bash
# 8 个文件全部是纯 CREATE TABLE（零 ALTER/INSERT/DROP），无冲突源
ssh oddfi-backend
cd /opt/oddfi-web-api && git pull origin main

cd web-api/migrations
# 假设 prod MySQL 凭据通过 ~/.my.cnf 或 systemd EnvironmentFile 拿（人类填密码）
for f in 0001_*.sql 0002_*.sql 0003_*.sql 0004_*.sql 0005_*.sql 0006_*.sql 0007_*.sql 0008_*.sql; do
  echo "Applying $f ..."
  mysql -u <prod-user> -p oddfi < "$f" || { echo "FAILED $f"; exit 1; }
done

# 验证 8 张表 + 索引
mysql -u <prod-user> -p oddfi -e \
  "SHOW TABLES LIKE 'presale_%'; SHOW TABLES LIKE 'user_referral_%';"
```

⚠️ **关键约束**：9 张表必须全部建好后才部署 web-api server，否则启动时 GORM 装配 9 个 repo 会报错。

#### 1.2.2 跑 seed（含 6 轮初始数据 + 全局配置单行）

```bash
mysql -h "$DB_HOST" -u "$DB_USER" -p "$DB_NAME" < ../seed/presale_rounds.sql
```

⚠️ **运营提供真值**：seed 文件中以下字段必须与运营/产品对齐后再上线：
- `presale_round.price_usd` / `supply_odd` / `start_ts` / `end_ts`（6 轮）
- `presale_config.vault_address`（金库地址）
- `presale_config.tge_ts` / `tge_open_price_usd`
- `presale_config.lark_webhook_url`（运营群 webhook）
- `presale_config.min_subscribe_usd`（最小认购）

#### 1.2.3 配置 systemd EnvironmentFile

```bash
sudo install -m 600 /dev/null /etc/oddfi/web-api.env
sudo tee /etc/oddfi/web-api.env <<'EOF'
# 预售模块门控：配齐 PRESALE_VAULT_POOL 即启用整个预售 + 邀请模块
PRESALE_BSC_RPC_URL=https://bnb-mainnet.g.alchemy.com/v2/<ALCHEMY_KEY>
PRESALE_VAULT_POOL=0xVAULT_ADDRESS_MAINNET
PRESALE_USDT_ADDRESS=0x55d398326f99059fF775485246999027B3197955
PRESALE_CONFIRM_BLOCKS=3
PRESALE_POLL_INTERVAL_SEC=6
PRESALE_BOUNDARY_TOLERANCE_MIN=5
PRESALE_LARK_WEBHOOK_URL=https://open.larksuite.com/open-apis/bot/v2/hook/<LARK_BOT_ID>
PRESALE_REDIS_LEADER_KEY=presale:worker:leader
PRESALE_REDIS_LEADER_TTL_SEC=30
EOF
sudo chown root:root /etc/oddfi/web-api.env
```

⚠️ **环境变量缺一不可**：如不配 PRESALE_VAULT_POOL，门控会把整个模块禁用（与 testnet 一致）。

### 1.3 部署 web-api server（docker 模式，2026-05-27 修订）

> **历史背景**：本节原文为 systemd unit + 本地 `go build` 部署，prod 实际生态在 Phase 3（2026-05-26）已切到 docker。systemd 段已弃用，详见 [deploy-state-audit-2026-05-27.md](archive/deploy-state-audit-2026-05-27.md) §3。

```bash
# 1) 本地构建 + push（双 binary 镜像；Mac M 自动 multi-arch buildx）
cd /Users/hang/work/oddfi-backend
./web-api/deploy/docker-build-and-push.sh hankdong/account-web-api:prod_dd003-v<N>

# 2) prod 拉镜像 + 滚动重启
ssh oddfi-backend "
  sudo docker pull hankdong/account-web-api:prod_dd003-v<N>
  sudo docker stop web-api && sudo docker rm web-api
  sudo docker run -d --name web-api --network host --restart unless-stopped \
    -v /etc/oddfi/config_prod.yaml:/app/config.yaml:ro \
    -e PRESALE_VAULT_POOL=<vault address> \
    -e PRESALE_BSC_RPC_URL=<bsc rpc url> \
    hankdong/account-web-api:prod_dd003-v<N>
"

# 3) 验证启动日志含 presale enabled
ssh oddfi-backend "sudo docker logs web-api --tail 30 2>&1 | grep -i presale"
# 期望：[main] presale module enabled=true (vault_pool_count=1)
```

### 1.4 部署 presale-worker 独立容器（docker 模式，2026-05-27 修订）

> **历史背景**：本节原文为 `go build ./cmd/presale-worker` + `systemd unit`，但 prod 没装 Go 编译器、`/opt/oddfi-web-api/` 不存在。Phase 3 docker 化后改造方式：单镜像双 binary，worker 用 `docker run` 时 CMD 覆盖。

```bash
# 镜像已含 ./presale-worker binary（§1.3 build 出来的同一个镜像）
ssh oddfi-backend "
  sudo docker run -d --name presale-worker --network host --restart unless-stopped \
    -v /etc/oddfi/config_prod.yaml:/app/config.yaml:ro \
    -e PRESALE_VAULT_POOL=<vault address> \
    -e PRESALE_BSC_RPC_URL=<bsc rpc url> \
    hankdong/account-web-api:prod_dd003-v<N> \
    ./presale-worker
"

# 监控启动（应在 ~10 秒内看到 listener log）
ssh oddfi-backend "sudo docker logs presale-worker -f"
```

⚠️ **关键检查项**：
- `[presale-worker] bsc rpc connected: https://...` ← RPC 连通
- `[presale-worker] ensured cursors for 1 vault addresses (init_block=<当前 BSC head>)` ← P1-2 修复后从 head 开始扫
- `[presale-worker] acquired leader lock, starting crons` ← leader 抢锁

**强制 verify 门槛（INC-002 同型防御）**：任何 worker 部署 / 重启操作必须以 `verify-worker.sh PASSED` 为完成判据：

```bash
scp web-api/scripts/verify-worker.sh oddfi-backend:/tmp/
ssh oddfi-backend "sudo install -m 755 /tmp/verify-worker.sh /usr/local/bin/ && sudo /usr/local/bin/verify-worker.sh"
# 期望末尾：🎉 worker verify PASSED
```

未看到 PASSED 不得标 §1.4 完成（4 项检查：容器 running / Redis leader 锁 / 启动日志 3 句关键句 / cursor 在推进）。

### 1.5 验证清单

```bash
# (a) 健康
curl https://api.oddfi.io/health

# (b) 预售配置接口（公开）
curl https://api.oddfi.io/api/v1/presale/config | jq .data.vault.depositAddress
# 应返回金库地址

# (c) 现有功能未受损（钱包登录）
curl -X POST https://api.oddfi.io/account/login_by_wallet -d '{...}'
# 应返回 access_token（与历史行为一致）

# (d) DB 状态
mysql -h "$DB_HOST" ... -e "SELECT * FROM presale_event_cursor;"
# cursor 应持续推进（每 6s 一次）
```

---

## Step 2 · admin-backend 合 main + 部署

### 2.1 准备 admin DB

```bash
ssh admin-server
mysql -u root oddfi_admin < /path/to/migrations/0002_create_presale_admin_audit.sql
mysql -u root -e "USE oddfi_admin; SHOW CREATE TABLE presale_admin_audit\G"
```

### 2.2 合 main + push

```bash
cd /Users/hang/work/oddfi-admin-backend
git fetch origin
git checkout main && git pull origin main
git merge --squash impl/presale-admin
git commit -F /tmp/admin-merge-msg.txt   # commit message 见 §6.2
git push origin main
```

### 2.3 部署

```bash
ssh admin-server
cd /opt/oddfi-admin-backend && git pull origin main
go build -o bin/admin-server ./cmd/server
sudo systemctl restart admin-server

curl https://admin.oddfi.io/health
# {"code":0,"message":"ok","data":{"status":"ok"}}
```

### 2.4 烟测 1 个 presale 接口

```bash
# 用 cmd/dev-token 签一个 super_admin token
TOKEN=$(/opt/oddfi-admin-backend/bin/dev-token --role super_admin)
curl -H "Authorization: Bearer $TOKEN" https://admin.oddfi.io/admin/presale/rounds | jq
# 应返回 6 轮列表
```

---

## Step 3 · 全量联调（真链验证）

### 3.1 测试场景清单

| 场景 | 方式 | 期望 |
|---|---|---|
| 正常入账 | 测试 EOA 发 0.01 USDT 到金库 | worker 扫到 → confirmed → holding upsert |
| 边界切轮 | 临时改 `seed.end_ts = now - 2min` → 发 tx | block_ts ∈ end+5min 容差，归属 seed |
| 邀请奖励 | 新 user_B 绑定到 user_A → user_B 发 tx | deposit.referrer_user_id=A + UpsertReferral |
| 超额 anomaly | 临时改 supply ≈ sold → 发超额 tx | anomaly=overflow + ops_event + sold 不污染 |
| 无主转账 | 用未注册 EOA 发 tx | ops_event=unclaimed + deposit 不入 |
| paused 信息流 | admin 调 pause → 发 tx | deposit confirmed + anomaly_reason=paused_arrival + ops_event |
| migrate-round | admin 调 migrate-round 接口 | 旧轮 holding 减 + 新轮 holding 加 + audit 落库 |

### 3.2 测试资金来源

- 现有测试 EOA `0x9d9BcdfEe0Ca1701cBB161A583241eE8C4656490` 剩余 8.91 USDT + 0.00992 BNB
- 私钥见 `~/.ssh/PRESALE-E2E-WALLET.md`
- 测试金库 `0xf4b6036d2423B1254f273272929364A120a50c7C`（用户自己钱包）

### 3.3 admin-backend 接口烟测

按 [03-admin-api-contract.md](../03-admin-api-contract.md) 抽样测试 17 接口 RBAC 矩阵（每接口 1 个允许角色 + 1 个被拒角色）。

---

## Step 4 · 前端适配

参考 [frontend-integration.md](../frontend-integration.md) §8 P0/P1 工作清单：

| Base URL | 服务 |
|---|---|
| `https://api.oddfi.io` | web-api（8 个用户接口） |
| `https://admin.oddfi.io` | admin-backend（运营内部用，用户前端不调） |

前端联调 OK 后人类拍板 → 进 Step 5。

---

## Step 5 · cherry-pick 回 dev + 部署 oddfi-dev（仅代码同步）

> **不承担测试责任**，纯粹让 dev 与 main 不分叉；dev-api 服务器预售模块由门控自动禁用。

### 5.1 cherry-pick squashed commit 到 dev

```bash
cd /Users/hang/work/oddfi-backend
git checkout dev && git pull origin dev

MAIN_SHA=$(git rev-parse origin/main)
git cherry-pick $MAIN_SHA
# 冲突大概率在 go.mod / go.sum（dev 上其他业务可能动过依赖），手动 resolve
git push origin dev
```

### 5.2 部署到 oddfi-dev 服务器（testnet）

```bash
ssh oddfi-dev
cd /opt/oddfi-web-api && git checkout dev && git pull origin dev
# **不**配 PRESALE_VAULT_POOL → 启动时门控自动禁用预售 + 邀请模块
sudo systemctl restart web-api
sudo journalctl -u web-api -n 30 --no-pager | grep -i presale
# 期望见：[main] presale module DISABLED — /api/v1/presale/* and /api/v1/referral/* routes not registered
```

**绝对不要**在 dev-api 服务器启动 presale-worker（设计为只在 prod 跑链上监听）。

---

## 6 Commit Message 文本

### 6.1 web-api main squashed commit message

存到 `/tmp/web-api-merge-msg.txt`：

```
feat(presale): DD-INVEST V3 预售模块完整实施（B0-B4 + Phase 5 e2e + 配置门控）

【范围】
- 9 张业务表 migration（presale_* 7 张 + user_referral_* 2 张）
- 8 个用户接口：5 个 /api/v1/presale/* + 3 个 /api/v1/referral/*
- USDT Transfer 监听器（cmd/presale-worker 独立 binary）
- Round status cron + confirm-deposit 大事务（双轨幂等 uk_(tx_hash, log_index)）
- 邀请系统（CSPRNG + 32 字符集 + 自动绑邀 + 异步 hook）
- 5 个运营预案脚本 + Lark Webhook + Claude skill
- cfg.Presale.VaultPool 维度门控：零配置即禁用（testnet/dev 友好）

【真链 e2e 验证】
BSC mainnet 跑通 7 笔真实 USDT.transfer 演练，INV-1/3/6/7 全部断言通过
P0 修复 confirm-deposit 大事务表名硬编码 trap
P1 修复 paused_arrival 信息流 + EnsureAll head block 初始值

【新增依赖】
- go-ethereum 间接依赖补齐（go-winio / wmi / golang-set 等）
- DATA-DOG/go-sqlmock v1.5.0（test-only）

【上线检查】
1. 跑 9 个 web-api/migrations/*.sql 到生产 RDS
2. seed 6 行 presale_round + 1 行 presale_config（运营提供真值）
3. 配齐 systemd EnvironmentFile：PRESALE_BSC_RPC_URL / VAULT_POOL / USDT_ADDRESS / LARK_WEBHOOK_URL 等
4. 部署 web-api server + 部署 presale-worker 进程（新 systemd unit）
5. 验证 worker 启动日志含 "ensured cursors for N vault addresses (init_block=<BSC_head>)"

详见：
- web-api/docs/dd-invest/README.md
- web-api/docs/dd-invest/frontend-integration.md
- web-api/docs/dd-invest/testing/phase5-report.md
- web-api/docs/dd-invest/ops/release-rollout-plan.md
```

### 6.2 admin-backend main squashed commit message

存到 `/tmp/admin-merge-msg.txt`：

```
feat(presale-admin): DD-INVEST V3 预售运营后台 — 17 接口 + audit middleware + RBAC

【范围】
- migrations/0002_create_presale_admin_audit.sql：运营操作审计表
- internal/model：6 个 GORM 模型（presale_round/deposit/config/holding/ops_event/admin_audit）
- internal/repository：6 个 repository（含 RoundSoldOddAdjust + holding upsert/subtract）
- internal/service：4 个 service
  · presale_round：状态机 validTransitions + SELECT FOR UPDATE + manual_override=true
  · presale_deposit：migrate-round 大事务（holding 回滚 + 重算 + round.sold_odd 同步 + audit 历史限 3 次）
  · presale_config：vault_address 修改返 warning 提示重启 worker
  · presale_anomaly：3 种 resolution（convert_to_deposit / partial_credit / reject）
- internal/handler：5 个 handler；error 分支统一 presaleAbortErr（写响应+Abort）
- internal/middleware/presale_audit.go：mutate 接口自动写 presale_admin_audit
  · note ≥ 10 字符（按 rune 兼容汉字）
  · db.Begin() 共享事务注入 c.Set("db_tx", tx) 供 handler 复用
- internal/router/presale_routes.go：抽出 RegisterPresaleRoutes 函数
  · 17 路由按 RBAC 矩阵精确分组（finance 本期无预售权限）
  · 3 高敏接口（PATCH /config · PATCH /rounds/:id · migrate-round）套 10/min 限流
- docs/api.md §1.6 + §3.10：追加 17 路由表 + presale 接口索引
- docs/presale-admin/README.md：668 行完整契约 + curl 示例
- .claude/rules/rbac.md：追加预售路径权限映射表

【现有功能影响】
零。/auth/lark/* / /auth/me / /admin/admin-users/* 完全不变；
新增 PresaleAudit middleware 只挂在 presale mutate 路由上。

【上线检查】
1. 跑 migrations/0002 到生产 admin DB（oddfi_admin 库）
2. systemctl restart admin-server
3. 用 cmd/dev-token 签 super_admin token 烟测 GET /admin/presale/rounds

新增依赖：shopspring/decimal v1.4.0（admin-backend CLAUDE.md 已约定金额必备）
```

---

## 7 风险评估 + 回滚预案

| 阶段 | 风险 | 缓解 | 回滚 |
|---|---|---|---|
| Step 1.2 跑 migration | 表已存在 / 字段冲突 | 9 张全部新建，不动现有表 | `DROP TABLE presale_*; DROP TABLE user_referral_*;` |
| Step 1.3 web-api 启动 | 装配失败（表缺失 / env 缺） | 启动前确认 1.2 全部完成 | `git revert <main-squash-sha>` + `systemctl restart web-api` |
| Step 1.4 worker 启动 | BSC RPC 不通 / leader 抢锁失败 | 启动日志检查 + Redis 连通性 | `systemctl stop presale-worker` 不影响 web-api |
| Step 2.1 admin migration | 表已存在 | 0002 是新表 | `DROP TABLE presale_admin_audit` |
| Step 2.3 admin 部署 | 启动失败 | dry-run 配置 validate | `git revert + systemctl restart admin-server` |
| Step 3 真链测试 | 资金安全 | 测试金库 = 用户自己钱包；只发 0.01 USDT 级别小额 | 单笔损失上限 0.01 USDT |
| Step 5 cherry-pick | go.mod 冲突 | 手动 resolve（dev 上其他业务可能动过依赖） | `git cherry-pick --abort` |

---

## 8 完成判定

5 步全部 ✅ 后认为 DD-INVEST V3 staging 上线完成。后续灰度切流到 prod（api.oddfi.io）由人类按运营节奏决策（白名单 EOA → 内部 10 人 → 100 人 → 全开）。

---

## 9 关联文档

- [README.md](../README.md) — V3 决策总览
- [00-architecture.md](../00-architecture.md) — 双服务架构 + 不变量
- [01-data-model.md](../01-data-model.md) — 9 表 schema 真值
- [02-api-contract.md](../02-api-contract.md) — 用户接口契约
- [03-admin-api-contract.md](../03-admin-api-contract.md) — admin 接口契约
- [frontend-integration.md](../frontend-integration.md) — 前端对接清单
- [testing/phase5-report.md](../testing/phase5-report.md) — 真链 e2e 报告
- [ops/cutover-dd003.md](cutover-dd003.md) — DD-003 cutover runbook（admin RPC + 双服务 + 金库切换历史）
- [ops/reset-and-vault-switch-runbook.md](reset-and-vault-switch-runbook.md) — 重置 + 金库切换 SOP（替代旧 deploy-cutover §金库切换）
- [ops/monitoring-alerts.md](monitoring-alerts.md) — 监听器游标 / Worker leader / anomaly 告警
