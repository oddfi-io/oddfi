# DD-INVEST V3 上线执行追踪表

> **作用**：release-rollout-plan.md 是策略与命令模板；本文是**真实执行的进度看板** + 风险登记 + 回滚预案 + 清理待办。
> **状态记号**：⬜ 未开始 · 🟡 进行中 · ✅ 完成 · 🔴 阻塞 · ⏸️ 暂停
> **最近更新**：2026-05-26
> **关联**：[release-rollout-plan.md](release-rollout-plan.md)（策略文档）· [frontend-integration.md](../frontend-integration.md) · [phase5-report.md](../testing/phase5-report.md)

---

## 0 现状快照

| 项 | 状态 | 备注 |
|---|---|---|
| 部署策略确认 | ✅ | 直接 prod（`oddfi-backend`）；dev 分支仅作代码同步 |
| 双服务 DB 架构方案 | ✅ | 方案 A（admin 跨主机指向 prod MySQL） |
| 测试金库地址 | ✅ | 沿用 `0xf4b6036d2423B1254f273272929364A120a50c7C`（测试期）；正式金库地址待人类后续提供 |
| Step 2 admin-backend 部署（v1 单 DSN） | ✅ | 2026-05-26；main HEAD `7175fb9`；prod active running |
| **DD-002 admin 双 DSN 代码改造** | ✅ | impl/presale-admin 4 Phase 全部 commit；详见 §2.1 |
| seed 文件按 Lark 真值重写 | ✅ | seed/presale_init.sql（6 轮 + 全局配置） |
| Step 1 web-api → prod 部署 | ✅ (2026-05-27) | 见 §1；docker 模式重新落地，含 presale-worker；https 兜底待补（[deploy-state-audit-2026-05-27.md](archive/deploy-state-audit-2026-05-27.md) §6） |
| Step 1.5 跨主机 MySQL 通道 + admin 升级 | ⬜ | 见 §2 部署清单 |
| Step 3 真链全量 e2e | ⬜ | 依赖 Step 1 + 1.5 完成 |
| Step 4 前端适配 | ⬜ | 前端 agent 独立任务，见 frontend-integration.md |
| Step 5 cherry-pick → dev | ⬜ | 最后一步 |
| 清理与初始化（§3） | ⬜ | 所有上线动作完成后做 |

---

## 1 Step 1 · web-api → `oddfi-backend` prod 部署

### 1.1 任务清单

| # | 任务 | 状态 | 备注 |
|---|---|---|---|
| 1.1 | 主仓库切 main + squash merge `impl/presale-v3` | ⬜ | commit msg 取自 release-rollout-plan §6.1 |
| 1.2 | push origin main | ⬜ | 不可逆动作；执行前打 stop 给人 review |
| 1.3 | scp 8 个 migration 文件到 `oddfi-backend:/tmp/` | ⬜ | 文件路径见命令 |
| 1.4 | 在 prod MySQL 跑 8 个 migration | ⬜ | 详见 §1.2 风险评估 |
| 1.5 | 验证 8 张新表已建 + 索引齐全 | ⬜ | `SHOW TABLES LIKE 'presale_%'` + `SHOW TABLES LIKE 'user_referral_%'` |
| 1.6 | seed `presale_round` + `presale_config` 真值（运营提供） | 🔴 阻塞 | **运营未提供** 6 轮的 price_usd / supply_odd / start_ts / end_ts；min_subscribe_usd；TGE 配置 |
| 1.7 | systemd EnvironmentFile 写 PRESALE_* env | ⬜ | 必须配 PRESALE_VAULT_POOL（用测试金库）+ ALCHEMY_KEY |
| 1.8 | ~~本机交叉编译 Linux amd64 二进制~~ → 改 docker 镜像 build | ✅ | docker buildx multi-arch；见 `web-api/deploy/docker-build-and-push.sh` |
| 1.9 | ~~scp + install + systemctl restart~~ → docker pull + run web-api | ✅ | 2026-05-27 部署到 `prod_dd003-v4`；启动日志 `presale module enabled=true (vault_pool_count=1)` 已见 |
| 1.10 | ~~交叉编译 presale-worker~~ → 同镜像双 binary（Dockerfile 改造） | ✅ | 2026-05-27 改造完成；镜像 `/app/` 含 web-api + presale-worker |
| 1.11 | ~~部署 presale-worker systemd unit~~ → docker run presale-worker 容器 | ✅ | 2026-05-27；`docker run ... <image> ./presale-worker`（CMD 覆盖） |
| 1.12 | 验证 worker leader 抢锁 + listener 推进 cursor | ✅ | 2026-05-27 `verify-worker.sh PASSED`（leader TTL=13s，cursor 8s 推进 27 blocks） |
| 1.13 | 验证 `/api/v1/presale/config` 公开接口可访问 | 🟡 | `curl http://api.oddfi.io/api/v1/presale/config` OK；https 待加 nginx server 块（[deploy-state-audit-2026-05-27.md](archive/deploy-state-audit-2026-05-27.md) §6） |
| 1.14 | 验证现有钱包登录等接口未破坏 | ⬜ | 跑一次 `/account/login_by_wallet` |

### 1.2 风险评估：8 个 migration 在 prod MySQL 执行

**migration 内容审计**（已完成扫描）：

```
0001_create_presale_round.sql      → CREATE TABLE
0002_create_presale_deposit.sql    → CREATE TABLE
0003_create_presale_config.sql     → CREATE TABLE
0004_create_presale_holding.sql    → CREATE TABLE
0005_create_presale_event_cursor.sql → CREATE TABLE
0006_create_presale_ops_event.sql  → CREATE TABLE
0007_create_user_referral_code.sql → CREATE TABLE
0008_create_user_referral_bind.sql → CREATE TABLE
```

**关键结论：8 个文件全部为纯 `CREATE TABLE`，无 ALTER、INSERT、UPDATE、DROP 语句。**

### 1.3 风险矩阵

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| 表名冲突（prod 已有同名表） | 🟢 极低 | 高（CREATE 直接失败） | migration 前 grep prod `SHOW TABLES`；presale_* / user_referral_* 都是 V3 全新命名 |
| InnoDB DDL 锁导致其他写阻塞 | 🟢 极低 | 中 | InnoDB CREATE TABLE 不锁其他表；仅锁数据字典 < 1s |
| 字符集 / 排序规则不匹配 prod DB | 🟡 中 | 低 | migration 文件应用 `utf8mb4 / utf8mb4_0900_ai_ci`，与 prod oddfi DB 期望一致；执行前用 `mysql -e "SELECT @@character_set_database, @@collation_database"` 核对 |
| 索引创建慢（如某表很大） | 🟢 极低 | 低 | 8 张全新空表，无数据 |
| migration 部分成功（第 5 张挂） | 🟡 中 | 高 | 用 `\|\| { exit 1; }` 串行，挂则停；回滚只需 DROP 已建的 |
| seed 数据不齐就启动服务 | 🟡 中 | 高 | **业务表为空时 web-api 启动 OK**（GORM 装配 repo 不查数据），但 `/api/v1/presale/config` 会返空；前端体验差但不崩 |
| presale-worker 起来后从 BSC head 0 块开始扫 | 🟢 已修复 | 高（扫 ~100M 块约 10 天） | P1-2 修复已确认：EnsureAll 在 init 时查 head block → 从当前高度起扫 |
| 启动后被门控误关 | 🟡 中 | 中 | EnvironmentFile 必须配 `PRESALE_VAULT_POOL`，否则启动日志会显示 `presale module DISABLED` |

### 1.4 操作步骤（人类 SSH 凭据，AI 执行）

> 详见 [release-rollout-plan.md](release-rollout-plan.md) §1.1 - §1.5。本节只补充 prod 特有的环境差异。

**Pre-check（执行前必看）**：

```bash
ssh oddfi-backend
# 确认 web-api 当前在 main 分支（否则 git pull 会乱）
cd /opt/oddfi-web-api && git status && git rev-parse HEAD

# 确认 prod MySQL 字符集
mysql -u <user> -p oddfi -e "SELECT @@character_set_database, @@collation_database;"
# 期望：utf8mb4 / utf8mb4_0900_ai_ci

# 确认现有表无冲突
mysql -u <user> -p oddfi -e "SHOW TABLES LIKE 'presale_%'; SHOW TABLES LIKE 'user_referral_%';"
# 期望：Empty set
```

### 1.5 回滚预案

**触发条件**：
- 任一 migration 执行失败
- web-api 启动后日志报错（GORM 装配失败 / repo 报字段不匹配）
- presale-worker 起来后疯狂 panic
- 现有接口（钱包登录 / 行情 / 后台）出现 5xx

**回滚动作**（严格按顺序）：

```bash
# 1. 停 web-api 写入（先 stop worker 防新 deposit 进表）
ssh oddfi-backend
sudo systemctl stop presale-worker

# 2. 回滚 web-api 二进制（保留上一版本 /usr/local/bin/web-api.previous）
sudo cp /usr/local/bin/web-api.previous /usr/local/bin/web-api
sudo systemctl restart web-api

# 3. 回滚 prod MySQL schema
mysql -u <user> -p oddfi <<'EOF'
SET FOREIGN_KEY_CHECKS=0;
DROP TABLE IF EXISTS user_referral_bind;
DROP TABLE IF EXISTS user_referral_code;
DROP TABLE IF EXISTS presale_ops_event;
DROP TABLE IF EXISTS presale_event_cursor;
DROP TABLE IF EXISTS presale_holding;
DROP TABLE IF EXISTS presale_config;
DROP TABLE IF EXISTS presale_deposit;
DROP TABLE IF EXISTS presale_round;
SET FOREIGN_KEY_CHECKS=1;
SHOW TABLES LIKE 'presale_%';
SHOW TABLES LIKE 'user_referral_%';
EOF
# 期望：Empty set

# 4. 回滚 git main 到上一个 commit
cd /Users/hang/work/oddfi-backend
git revert <web-api-squash-sha>
git push origin main
```

**Pre-commit 保险**：执行 §1.9 (install binary) 之前必备份：
```bash
ssh oddfi-backend "sudo cp /usr/local/bin/web-api /usr/local/bin/web-api.previous"
```

---

## 2 Step 1.5 · 跨主机 MySQL 通道（方案 A 实施）

> 让 `oddfi-admin` 服务器的 admin-backend 能跨网络读写 `oddfi-backend` prod MySQL 的 `presale_*` 表。

### 2.1 任务清单

| # | 任务 | 状态 | 备注 |
|---|---|---|---|
| **2.0 代码改造** | DD-002 admin 双 DSN（4 个 Phase） | ✅ 完成 | impl/presale-admin 分支累加 4 commits（6ad6023 + ed89942 + b7f0d4e + 待推送） |
| 2.0.P2 | config 双 DSN + fail-fast | ✅ | 6ad6023 |
| 2.0.P3 | repository 分流 + best-effort audit | ✅ | ed89942 |
| 2.0.P4 | WAL 兜底 + 后台重试 goroutine | ✅ | b7f0d4e |
| 2.0.P5 | docker compose 集成测试 + Makefile target | ✅ | 待最终 commit |
| **2.1** | prod MySQL `bind-address` 改 `0.0.0.0`（或仅监听 EC2 内网 IP） | ⬜ | 部署前操作 |
| 2.2 | 启用 prod MySQL TLS（生成 server cert + 改 my.cnf） | ⬜ | 部署前操作 |
| 2.3 | AWS Security Group 放行：`oddfi-admin` IP (<SERVER_IP>) → `oddfi-backend` :3306 | ⬜ | 部署前操作 |
| 2.4 | prod MySQL 建跨主机账号 + 授权 | ⬜ | 部署前操作 |
| 2.5 | admin 服务器测试连通 | ⬜ | 部署前验证 |
| 2.6 | 修改 admin env.production 加 `ADMIN_BUSINESS_DB_DSN` | ⬜ | 部署前操作 |
| 2.7 | 部署新 admin binary + 重启 + 烟测 17 接口 | ⬜ | 部署 |
| 2.8 | 验证 `presale_admin_audit` 仍指向 admin 自己 DB | ⬜ | 代码层已保证；上线时复查 |
| 2.9 | 创建 `/var/log/oddfi-admin/audit-fallback/` 目录 + chown oddfi:oddfi + 0750 | ⬜ | 部署前操作（WAL 兜底需要） |

### 2.2 关键技术决策：admin 同时连两个 DB

详细方案见 admin-backend 仓库 `docs/presale-admin/DD-002-admin-dual-dsn.md`（reviewer 已 APPROVED v2，含 WAL 兜底 + 两阶段 audit + fail-fast）。

**核心要点**：
- admin-backend 升级双 DSN（admin_dsn 本机 + business_dsn 跨主机）
- repository 分流：admin_users / presale_admin_audit → AdminDB；其余业务表 → BusinessDB
- audit middleware 改造：business tx 独立 commit + audit 用独立 admin 连接 best-effort 写入
- **WAL 兜底**：audit 写失败落 `/var/log/oddfi-admin/audit-fallback/audit-YYYY-MM-DD.wal`，后台 goroutine 每 30s 重试
- **高敏操作两阶段**：migrate-round 等先写 pending audit → business commit → mark committed
- **fail-fast**：prod 环境 business_dsn 缺失直接 log.Fatal 退出（移除 fallback）

工时重估 14-16h（reviewer 评估），由独立子 agent 在 admin worktree 执行。

### 2.3 风险评估

| 风险 | 影响 | 缓解 |
|---|---|---|
| MySQL :3306 公网暴露被扫描攻击 | 极高 | SG 白名单只放 admin IP；强密码 32+ 字符；TLS 强制；密码不入 git |
| TLS 证书过期 | 高（admin 断连） | Let's Encrypt 不能用（非域名）→ 自签 10 年；记到日历 |
| admin 服务器 IP 漂移导致 SG 失效 | 高 | 给 admin EC2 绑 Elastic IP（如尚未） |
| 跨网络延迟拖慢 admin 接口 | 低 | admin 流量小 (< 5 QPS)，延迟 1-3ms 无感知 |
| 双 DSN 改造引入 bug（事务跨库失败） | 中 | audit 写本地（无跨库事务）；business 写跨主机（独立事务）— 不存在跨 DB transaction 需求 |

### 2.4 回滚预案

```bash
# 步骤回退到方案 A 实施前
# 1. admin DSN 改回 127.0.0.1
ssh oddfi-admin
sudo sed -i 's|ADMIN_DB_DSN=.*|ADMIN_DB_DSN="admin:<pwd>@tcp(127.0.0.1:3306)/oddfi_admin?charset=utf8mb4&parseTime=true&loc=Local&timeout=5s"|' /etc/oddfi-admin/env.production
sudo systemctl restart oddfi-admin-server

# 2. 关掉 prod MySQL 跨主机
ssh oddfi-backend
# 撤销 SG 规则（AWS console 或 awscli）
sudo sed -i 's/bind-address = 0.0.0.0/bind-address = 127.0.0.1/' /etc/mysql/mysql.conf.d/oddfi.cnf
sudo systemctl restart mysql
mysql -u root -e "DROP USER IF EXISTS 'admin_remote'@'<SERVER_IP>';"
```

---

## 3 Step 3 · 真链全量 e2e（用测试金库）

### 3.1 测试场景清单（沿用 release-rollout-plan §3.1）

| # | 场景 | 测试金库 | 预期 | 状态 |
|---|---|---|---|---|
| 3.1.1 | 正常入账 | 0xf4b6036d... | worker 扫到 → confirmed → holding upsert | ⬜ |
| 3.1.2 | 边界切轮容差 | 同上 | 临时改 end_ts → 发 tx 验证 ±5min 容差归属 | ⬜ |
| 3.1.3 | 邀请奖励链路 | 同上 | user_B 绑 A → user_B 发 tx → deposit.referrer_user_id=A | ⬜ |
| 3.1.4 | 超额 anomaly | 同上 | 临时改 supply ≈ sold → 超额 → ops_event=overflow | ⬜ |
| 3.1.5 | 无主转账 | 同上 | 未注册 EOA 发 tx → ops_event=unclaimed | ⬜ |
| 3.1.6 | paused 期间到账 | 同上 | admin pause → tx → anomaly_reason=paused_arrival | ⬜ |
| 3.1.7 | migrate-round | 同上 | admin migrate → 旧轮 holding 减 + 新轮加 + audit 写入 | ⬜ |
| 3.1.8 | admin 17 接口 RBAC 矩阵抽样 | — | 每接口 1 个允许角色 + 1 个拒绝角色 | ⬜ |

### 3.2 资金管理

- 测试 EOA：`0x9d9BcdfEe0Ca1701cBB161A583241eE8C4656490`（私钥见 `~/.ssh/PRESALE-E2E-WALLET.md`）
- 剩余余额：~8.91 USDT + ~0.00992 BNB
- 测试金库（用户自有）：`0xf4b6036d2423B1254f273272929364A120a50c7C`
- 单笔上限：建议 ≤ 0.1 USDT，控制总耗

### 3.3 测试用 SQL 临时改动（每次测前后必复位）

> 用于触发 anomaly 等边界场景

```sql
-- 制造超额：把某 round 的 supply_odd 改成接近 sold_odd
UPDATE presale_round SET supply_odd = sold_odd + 1 WHERE id = '<round-id>';
-- 测试完毕复位
UPDATE presale_round SET supply_odd = <original-value> WHERE id = '<round-id>';
```

---

## 4 Step 4 · 前端适配

任务在 [frontend-integration.md](../frontend-integration.md) §8 P0/P1 清单中追踪，本表不重复。

| # | 任务 | 状态 |
|---|---|---|
| 4.1 | 前端 base URL 切到 `api.oddfi.io` | ⬜ |
| 4.2 | 8 个接口对接（5 presale + 3 referral） | ⬜ |
| 4.3 | JWT auth 链路联通（前端登录 → access_token → 调预售接口） | ⬜ |

---

## 5 Step 5 · cherry-pick → dev

| # | 任务 | 状态 |
|---|---|---|
| 5.1 | git cherry-pick main squash sha → dev | ⬜ |
| 5.2 | resolve go.mod / go.sum 冲突 | ⬜ |
| 5.3 | push origin dev | ⬜ |
| 5.4 | ssh oddfi-dev → git pull dev → systemctl restart web-api | ⬜ |
| 5.5 | journalctl 验证日志含 `presale module DISABLED` | ⬜ |
| 5.6 | 验证 oddfi-dev 上**未**启动 presale-worker | ⬜ |

---

## 6 清理与初始化（上线全部完成后做）

### 6.1 测试资产回收

| # | 任务 | 状态 |
|---|---|---|
| 6.1 | 测试 EOA 残余 USDT 转回主钱包 | ⬜ |
| 6.2 | 测试 EOA 残余 BNB 转回主钱包（保留少量 gas 等下次） | ⬜ |
| 6.3 | 删除 `~/.ssh/PRESALE-E2E-WALLET.md`（私钥销毁） | ⬜ |
| 6.4 | git history 检查私钥未泄漏 | ⬜ |

### 6.2 测试金库 → 正式金库切换（关键）

| # | 任务 | 状态 |
|---|---|---|
| 6.5 | 接收用户提供的正式金库地址 | 🔴 等待 |
| 6.6 | admin 调 `PATCH /admin/presale/config` 改 vault_address | ⬜ |
| 6.7 | systemd EnvironmentFile 更新 `PRESALE_VAULT_POOL` 加入新金库地址（保留旧地址以处理迟到 tx，30 天后下线） | ⬜ |
| 6.8 | 重启 presale-worker（让 listener 监听新金库） | ⬜ |
| 6.9 | 验证 worker 启动日志含两个 vault 的 cursor | ⬜ |
| 6.10 | 业务公告：用户充值地址变更（如已有用户在用） | ⬜ |

### 6.3 测试数据清理

| # | 任务 | 状态 |
|---|---|---|
| 6.11 | 删除测试期间产生的 deposits / holdings / ops_events 数据 | ⬜ |
| 6.12 | 重置 presale_event_cursor.last_block_number 到正式金库部署的块高 | ⬜ |
| 6.13 | 重置 presale_round.sold_odd / raised_usd 到 0 | ⬜ |
| 6.14 | 清理 admin 测试期间的 audit log（可选；金融场景建议保留） | ⬜ |

### 6.4 文档归档

| # | 任务 | 状态 |
|---|---|---|
| 6.15 | release-rollout-plan.md / tasks.md 状态全部置 ✅ + 加上线日期 | ⬜ |
| 6.16 | 把 `cmd/dev-token` 从 prod admin 部署移除（已不在 prod 二进制里，仅本地用） | ✅ 设计如此 |
| 6.17 | START-PROMPT.md 标记为 ARCHIVED | ⬜ |
| 6.18 | 把执行过程的关键决策（方案 A、字段定值、运营反馈）回写 ARCHITECTURE.md | ⬜ |
| 6.19 | 重要 ADR 移到 docs/adr/ 长期保存 | ⬜ |

### 6.5 监控告警

| # | 任务 | 状态 |
|---|---|---|
| 6.20 | 配 Grafana：presale_event_cursor 推进 lag > 5min 告警 | ⬜ |
| 6.21 | 配 Lark webhook：anomaly 计数 / hour > 阈值告警 | ⬜ |
| 6.22 | 配监控：presale-worker leader 抢锁失败次数告警 | ⬜ |
| 6.23 | 配监控：admin 跨主机 MySQL 连接失败次数告警 | ⬜ |
| 6.24 | 配监控：admin audit WAL fallback 计数 > 0 告警 | ⬜ |
| 6.25 | 配监控：admin audit WAL backlog > 100 告警 | ⬜ |
| 6.26 | 配监控：admin audit critical_failures（连 WAL 都失败）> 0 立即告警 | ⬜ |

### 6.6 手动补单 SOP（admin audit WAL 兜底流程）

**触发场景**：admin audit 写入 admin DB 失败，落到 WAL 文件，但后台重试 goroutine 也连续失败（admin DB 长时间不可用 / 表结构异常）。

**运维操作步骤**：

```bash
# 1. SSH 进 admin 服务器
ssh oddfi-admin

# 2. 检查 WAL 目录积压
ls -la /var/log/oddfi-admin/audit-fallback/
# 期望：每天一个 audit-YYYY-MM-DD.wal 文件
# 已处理的会追加 .done 后缀

# 3. 查看具体未处理的 WAL 文件
sudo cat /var/log/oddfi-admin/audit-fallback/audit-$(date -u +%F).wal | head -20
# 每行是一条 JSON 序列化的 audit entry

# 4. 验证 admin DB 是否已恢复
MYSQL_PWD='<admin-pwd>' mysql -u admin -h 127.0.0.1 oddfi_admin -e "SELECT COUNT(*) FROM presale_admin_audit;"

# 5. 手动重放 WAL（若后台 goroutine 卡住）
sudo systemctl stop oddfi-admin-server  # 停服防止并发写
sudo /usr/local/bin/oddfi-admin-server -mode wal-replay -wal-file /var/log/oddfi-admin/audit-fallback/audit-YYYY-MM-DD.wal
# wal-replay 子命令逐行 INSERT，成功的行从 wal 文件移除并写入 .done

# 6. 重启服务
sudo systemctl start oddfi-admin-server

# 7. 验证重放完整性
MYSQL_PWD='<admin-pwd>' mysql -u admin -h 127.0.0.1 oddfi_admin \
  -e "SELECT operator, action, target_id, created_at FROM presale_admin_audit ORDER BY id DESC LIMIT 20;"

# 8. 归档已 .done 的 WAL 文件
sudo mv /var/log/oddfi-admin/audit-fallback/*.done /var/log/oddfi-admin/audit-archive/
```

**critical_failures > 0 处置流程**（WAL 也写不进）：
1. **立即**检查磁盘空间：`df -h /var/log`
2. 检查 admin 进程文件权限：`ls -la /var/log/oddfi-admin/`
3. 退化方案：admin journalctl 中应有完整 audit 内容（带 `[PresaleAudit] CRITICAL` 标签），grep 后人工 INSERT
   ```bash
   sudo journalctl -u oddfi-admin-server --since "1 hour ago" | grep -E '\[PresaleAudit\] CRITICAL' > /tmp/lost-audit.log
   ```
4. 财务 / 合规 review 后批量重放

**法务 / 合规留痕要求**：
- WAL 文件保留期：≥ 90 天（与 RDS dump 一致）
- 重放完成的 `.done` 文件归档到 `/var/log/oddfi-admin/audit-archive/`
- 每次手动重放需在 admin 操作日志（独立的人工运维 log）记录：时间 / 操作人 / 重放条数 / 验证 SQL 结果

### 6.6 二进制 / 数据 backup 策略

| # | 任务 | 状态 |
|---|---|---|
| 6.24 | prod oddfi DB 每日 dump 到 S3，保留 30 天 | ⬜ |
| 6.25 | admin oddfi_admin DB 每日 dump（含 audit log） | ⬜ |
| 6.26 | 保留 web-api / admin / presale-worker 每次发版的二进制（命名 `<bin>.YYYYMMDD-<sha>`） | ⬜ |

---

## 7 风险登记簿（贯穿全周期）

| ID | 风险 | 概率 | 影响 | 当前缓解 | Owner |
|---|---|---|---|---|---|
| R-01 | 运营未提供 seed 数据（6 轮真值） | 🔴 当前 | 极高（无法上线） | 直接阻塞 §1.6 | 运营 |
| R-02 | 正式金库地址未确定 | 🟡 中 | 高（影响 §6.5+） | 用户后续提供 | 用户 |
| R-03 | 跨主机 MySQL TLS 证书运维负担 | 🟢 低 | 中 | 自签 10 年 + 日历提醒 | DevOps |
| R-04 | prod MySQL 暴露 :3306 被扫描 | 🟡 中 | 极高 | SG 白名单 + 强密码 + TLS 强制 + fail2ban 监控登录失败 | DevOps |
| R-05 | seed 真值与 BSC 链上实际状态不一致 | 🟡 中 | 高 | seed 后人工核对一次 | 后端 + 运营 |
| R-06 | presale-worker 多实例 leader 抢锁 race | 🟢 已修复 | 高 | Redis SET NX EX + atomic.Bool 双层 | — |
| R-07 | 真链小额测试金额超出预算 | 🟢 极低 | 低 | 单笔 ≤ 0.1 USDT；总耗 < 2 USDT | AI 自管 |
| R-08 | admin 双 DSN 改造引入 bug | 🟡 中 | 中 | DD-002 v2 + reviewer 已 APPROVED；改造在 admin worktree 隔离；含单测 + 集成测试 + e2e | AI 子 agent |
| R-09 | admin audit 写失败丢失记录（金融合规风险） | 🟢 已缓解 | 极高 | WAL 兜底 + 后台重试 + critical_failures 告警；手动补单 SOP 见 §6.6 | DevOps |
| R-10 | admin 部署后 business_dsn 漏配静默读空 DB | 🟢 已缓解 | 极高 | fail-fast：prod env business_dsn 缺失直接 log.Fatal | DevOps |

---

## 8 决策记录

| 日期 | 决策 | 影响 |
|---|---|---|
| 2026-05-26 | 部署策略：prod 直接（不走 dev-api staging） | 简化流程；测试在 prod 上做（测试金库兜底） |
| 2026-05-26 | DB 架构：方案 A 跨主机 MySQL | admin 服务保留独立故障域；需做 TLS + SG 配置 |
| 2026-05-26 | 测试金库继续用 `0xf4b6036d...` 直到全部 e2e 通过 | 控成本 + 保持现有测试链路 |
| 2026-05-26 | 正式金库地址人类后续提供 | 阻塞 §6 切换流程 |
| 2026-05-26 | dev 分支仅做代码同步，不承担测试责任 | 门控自动禁用预售 |
| 2026-05-26 | DD-002 v2 approved：audit best-effort + WAL 兜底 + 两阶段 + fail-fast | 解决合规问题；admin 14-16h 改造 |
| 2026-05-26 | 5/30 - 6/1 两天空窗期保持原计划 | 需告知前端做特殊态展示（无 active 轮次） |
| 2026-05-26 | seed 文件按 Lark 真值重写：6 轮 27M ODD / $2.015M 目标 | 与 Lark TGE 文档一致；之前 seed 数值错误 |
