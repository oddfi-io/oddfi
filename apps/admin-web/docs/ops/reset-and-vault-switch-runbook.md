> ⚠️ **本文是 backend 副本(mirror)**
> - **真值源**:`/Users/hang/work/oddfi-backend/web-api/docs/dd-invest/ops/reset-and-vault-switch-runbook.md`
> - 本副本同步时间:2026-05-29
> - 本仓库放此文档仅为运营 / 前端侧能就近查阅。**正式执行前请去 backend 仓库拉最新版**(`git -C ~/work/oddfi-backend pull --ff-only`),避免按过时版本操作。
> - 此文档涉及**生产 DB / 金库地址切换**,执行需 backend agent + 真人共同审 SQL,**前端 agent 不应单独跑里面任何步骤**。

---

# 重置流程 + 金库地址切换 Runbook

> **适用场景**：DD-INVEST V3 测试期结束，正式上线前需要把 prod DB 从"测试数据 + 测试金库"状态切到"干净库 + 正式金库"。
> **作者**：oddfi-backend agent · 2026-05-28
> **关联**：[release-rollout-plan.md §6.2](release-rollout-plan.md)（早期粗略 SOP，本文是真值源） · [cutover-dd003.md](cutover-dd003.md) · [tasks.md §6](tasks.md)
> **执行人**：oddfi-backend agent（你授权后）+ 你（提供正式金库地址 + 审 SQL）

---

## 0 总览

| 阶段 | 动作 | 可逆性 |
|---|---|---|
| §1 前置准备 | 备份当前 DB + 通知前端 maintenance window | ✅ 可逆 |
| §2 收集 + 校验正式金库地址 | 你提供地址 + 我做 EIP-55 校验 + 链上余额查询 | ✅ 可逆（未动 DB）|
| §3 stop worker | 停链上监听，避免数据清理与新写入打架 | ✅ 可逆（重启即恢复） |
| §4 admin 端配置更新 | PATCH `/admin/presale/config` 改 vault_address | 🟡 半可逆（audit 留痕，可再 PATCH 回） |
| §5 测试数据清理 SQL | TRUNCATE deposits/holdings/ops_events + UPDATE round + DELETE cursor | ⛔ **不可逆**，靠 §1 备份恢复 |
| §6 **双容器** env 更新 + 重启 | `web-api` + `presale-worker` 两个容器都改 PRESALE_VAULT_POOL（**漏 web-api 会导致 report-tx 40007**）| ✅ 可逆（重设 env 即恢复）|
| §7 验证 | verify-worker + e2e tx 小额测试 + Lark 推送链路 | ✅ 可逆 |
| §8 24h 观察 | watch cursor 推进 / Lark 接收 / 异常计数 | — |

**关键约束**：§5 是真正的不可逆步骤。**§1 备份必须 100% 完成后才能进 §5**，否则一旦发现新金库地址给错就只能靠 RDS snapshot 时间点恢复（更重）。

---

## 1 前置准备（必做，不能跳）

### 1.1 备份当前 prod DB（业务表全部）

```bash
ssh oddfi-backend
TS=$(date +%Y-%m-%d_%H%M%S)
sudo mkdir -p /var/backup/oddfi/reset-${TS}
cd /var/backup/oddfi/reset-${TS}

# 从 config_prod.yaml 抽凭据（与 backup-presale-config.sh 同源）
CFG=/etc/oddfi/config_prod.yaml
MYSQL_BLOCK=$(sudo sed -n '/^database:/,/^[a-zA-Z]/{/^database:/!{/^[a-zA-Z]/!p}}' "$CFG")
extract_val() {
  echo "$MYSQL_BLOCK" | sed -nE "s/^[[:space:]]*$1:[[:space:]]*\"?([^\"]+)\"?[[:space:]]*$/\1/p" | head -1
}
export MYSQL_PWD=$(extract_val password)
MYSQL_HOST=$(extract_val host)
MYSQL_USER=$(extract_val username)
MYSQL_DB=$(extract_val dbname)

# 业务表 dump（RDS flags 沿用 backup-presale-config.sh 实战版本）
sudo MYSQL_PWD="$MYSQL_PWD" mysqldump -h "$MYSQL_HOST" -u "$MYSQL_USER" \
  --no-tablespaces --column-statistics=0 \
  --lock-tables=false --skip-add-locks --set-gtid-purged=OFF \
  "$MYSQL_DB" \
  presale_deposit presale_holding presale_ops_event presale_round \
  presale_event_cursor presale_config \
  user_referral_code user_referral_bind \
  | sudo tee pre-reset-business-tables.sql >/dev/null
sudo gzip pre-reset-business-tables.sql

sudo ls -la /var/backup/oddfi/reset-${TS}/
# 期望：pre-reset-business-tables.sql.gz 几十 KB 起
```

**验收门槛**：dump 文件大小 ≥ 10KB（业务表 schema + 现有数据），可 gunzip + grep CREATE/INSERT 验完整性。

### 1.2 通知前端 maintenance window

把这条丢给前端 / 运营群：

> 「预售模块切金库地址 + 测试数据清理，预计 30 分钟。期间 `https://api.oddfi.io/api/v1/presale/*` 接口会短暂返空数据（不会 5xx）。`/account/login_by_wallet` 等其他接口不受影响。建议前端在 banner 显示『预售功能维护中』，30 分钟后撤。」

### 1.3 检查 prod 现状（baseline）

```bash
ssh oddfi-backend "
echo '=== 容器状态 + image tag（要记下来，回滚时用）==='
sudo docker inspect web-api presale-worker --format '{{.Name}}: {{.State.Status}} (image: {{.Config.Image}})'
echo
echo '=== 双容器 PRESALE_* env（重点看 VAULT_POOL，确认两边一致）==='
echo '--- web-api ---'
sudo docker inspect web-api --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^PRESALE_'
echo '--- presale-worker ---'
sudo docker inspect presale-worker --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^PRESALE_'
echo
echo '=== Redis leader ==='
redis-cli get presale:worker:leader
redis-cli ttl presale:worker:leader
"
```

记录基线快照（vault / image tag / leader 状态），完成后回滚要用。**两个容器的 `PRESALE_VAULT_POOL`
必须一致** — 不一致说明上次 cutover 没收尾干净，先修齐再开切换流程。

---

## 2 收集 + 校验正式金库地址

### 2.1 你提供地址 — 必须满足

| 校验项 | 检查方法 |
|---|---|
| EIP-55 大小写校验和正确 | `geth-utils checksum 0x...` 或在线工具；非 checksum 会被前端 ethers.js 拒绝 |
| 不是合约地址（应是 EOA / Safe multisig 等可控地址） | `eth_getCode` 返 `0x` 或合约 ABI 已知（Safe 是 multisig 例外）|
| BSC mainnet 上有 1+ tx 历史（非空地址） | BscScan 查看历史 tx |
| 已和正式合约 + 财务确认拥有控制权 | 必须用财务可签名 / 钥匙在受信硬件 |

### 2.2 我做的校验（你给地址后我跑）

```bash
# checksum 校验
echo "$NEW_VAULT" | /usr/bin/awk '
{
  # 简单 EIP-55 提示：含大小写混合即可能是 checksum 格式
  if (match($0, /^0x[a-fA-F0-9]{40}$/)) print "格式 OK"; else print "格式错误"
  if (match($0, /[A-F]/) && match($0, /[a-f]/)) print "看起来是 checksum"; else print "⚠️ 全小写或全大写，请确认是否漏了 EIP-55"
}'

# BscScan 余额 + tx 历史（用 Alchemy / 公共 RPC）
/usr/bin/curl -s "https://bnb-mainnet.g.alchemy.com/v2/H35XdJCol-9YDMElNIXe3" \
  -H 'Content-Type: application/json' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getBalance\",\"params\":[\"${NEW_VAULT}\",\"latest\"]}"
```

不通过任何一项 → STOP，回到 §2.1 让你重新提供。

---

## 3 stop worker（释放链上扫描）

```bash
ssh oddfi-backend "sudo docker stop presale-worker"
# 确认 Redis leader 锁会在 TTL 过期后自然失效（无 worker 续约）
ssh oddfi-backend "redis-cli ttl presale:worker:leader"
# 等到返回 -2（key 不存在）或 <5（即将过期）再进 §4
```

> **为什么先停 worker？** 防止 §5 TRUNCATE 期间 worker 正好扫到新块 → INSERT 进刚被清空的表 → 数据不一致。

---

## 4 admin 端配置更新（vault_address 字段）

### 4.1 PATCH `/admin/presale/config`

通过 admin-frontend 操作，或直接 curl（需要 super_admin JWT）：

```bash
JWT='<super_admin token>'
NEW_VAULT='0x<正式金库 EIP-55 地址>'

/usr/bin/curl -s -X PATCH "https://admin.oddfi.io/admin/presale/config" \
  -H "authorization: Bearer $JWT" \
  -H 'content-type: application/json' \
  -H "X-Idempotency-Key: $(uuidgen)" \
  -d "{\"vault_address\":\"$NEW_VAULT\",\"note\":\"DD-INVEST V3 正式上线 — 测试金库→正式金库切换\"}"
# 期望返 200，data 含 warning 字段提示重启 worker
```

### 4.2 验证写入

```bash
/usr/bin/curl -s "https://api.oddfi.io/api/v1/presale/config" | /usr/bin/jq '.data.vault.depositAddress'
# 期望返回新的 $NEW_VAULT（注意：返回的会自动 lowercase，与 PATCH 入参 EIP-55 大小写无关）
```

### 4.3 检查 audit 留痕

```bash
ssh oddfi-backend "
MYSQL_PWD=\"$MYSQL_PWD\" mysql -h $MYSQL_HOST -u $MYSQL_USER $MYSQL_DB -e \
  'SELECT id, action, operator, before_state, after_state, note, created_at
   FROM presale_admin_audit
   WHERE action LIKE \"%config%\" ORDER BY id DESC LIMIT 3\G'
"
# 期望见 1 条 UPDATE_CONFIG（或同义 action），note 包含本次切换说明
```

---

## 5 测试数据清理（不可逆，最危险一步）

### 5.1 dry-run：先列出会被清理的数据量

```bash
ssh oddfi-backend "
MYSQL_PWD=\"$MYSQL_PWD\" mysql -h $MYSQL_HOST -u $MYSQL_USER $MYSQL_DB -e \"
SELECT 'presale_deposit'   AS table_, COUNT(*) AS rows_ FROM presale_deposit
UNION ALL SELECT 'presale_holding',   COUNT(*) FROM presale_holding
UNION ALL SELECT 'presale_ops_event', COUNT(*) FROM presale_ops_event
UNION ALL SELECT 'presale_event_cursor', COUNT(*) FROM presale_event_cursor
UNION ALL SELECT 'user_referral_bind',  COUNT(*) FROM user_referral_bind
UNION ALL SELECT 'user_referral_code',  COUNT(*) FROM user_referral_code;
SELECT id, sold_odd, raised_usd FROM presale_round ORDER BY start_ts;
\"
"
```

把输出粘到对话里，你 review 后确认 → 进 §5.2。

### 5.2 执行清理（生产）

```bash
ssh oddfi-backend "
MYSQL_PWD=\"$MYSQL_PWD\" mysql -h $MYSQL_HOST -u $MYSQL_USER $MYSQL_DB <<'SQL'
START TRANSACTION;
TRUNCATE presale_deposit;
TRUNCATE presale_holding;
TRUNCATE presale_ops_event;
DELETE FROM presale_event_cursor;
UPDATE presale_round SET sold_odd=0, raised_usd=0;
-- 邀请绑定 / 邀请码是否保留请确认；测试期产生的可能想留作 demo，但生产建议清
-- TRUNCATE user_referral_bind;
-- TRUNCATE user_referral_code;
COMMIT;
SQL
"
```

> **referral 表是否清，看你决策**：
> - 清：完全干净启动；测试期邀请码作废
> - 不清：保留邀请关系（如有内部测试用户已绑定）

### 5.3 验证清理

```bash
ssh oddfi-backend "
MYSQL_PWD=\"$MYSQL_PWD\" mysql -h $MYSQL_HOST -u $MYSQL_USER $MYSQL_DB -e \"
SELECT COUNT(*) AS deposit_rows FROM presale_deposit;
SELECT COUNT(*) AS holding_rows FROM presale_holding;
SELECT COUNT(*) AS cursor_rows  FROM presale_event_cursor;
SELECT id, sold_odd, raised_usd FROM presale_round;
\"
"
# 期望：deposit_rows=0, holding_rows=0, cursor_rows=0, round 各行 sold=0/raised=0
```

---

## 6 双容器 env 更新 + 重启（web-api + presale-worker）

> ⚠️ **2026-05-28 实战教训 — 必看**：原版本节只写 worker。**web-api 容器**也通过 env 读
> `PRESALE_VAULT_POOL`（在 `cfg.VaultPool` 字段），`POST /api/v1/presale/deposit/report-tx`
> 校验 `tx.to == cfg.VaultPool` 用的就是这个值。漏改 web-api env 的话：
> - 前端 transfer 打到 NEW vault ✅
> - 前端调 report-tx → web-api 比对 OLD vault → **40007 TX_NOT_TO_VAULT**
> - 但 worker 已切到 NEW vault → 双轨兜底入账，资金没丢但 UX 差（前端弹窗失败 + 重试会让用户再付一次）
>
> 修复：**两个容器都要按 §6.1（worker）+ §6.2（web-api）流程改 env**。先后顺序都行。

### 6.1 改 presale-worker 容器（链上监听 + DB INSERT）

worker 通过 docker `-e PRESALE_VAULT_POOL=<addr>` 传金库。当前镜像没有 systemd EnvironmentFile，env 直接在 `docker run` 命令里。

> ⚠️ **ISSUE-005 教训（2026-05-28）**：原版只显式抽 `PRESALE_BSC_RPC_URL`，会丢掉
> `PRESALE_LARK_WEBHOOK_URL`（v2 cutover 才注入的）→ worker 重启后 alerter 又退化成 noop
> → 运营群没卡片，无声故障。
>
> 修复后：抽**所有 `PRESALE_*` 前缀 env**（含 RPC / VAULT / LARK_WEBHOOK_URL / 未来任何新 env），
> 只覆盖 VAULT_POOL，其余原样保留。

实战推荐用 `--env-file` 临时文件（root-only 600）保留其它 PRESALE_* env，单独 `-e` 覆盖 VAULT_POOL —
比 `awk` 拼 `-e` 字符串再 unquoted 展开更稳，也不需要 shellcheck disable：

```bash
ssh oddfi-backend "
set -e
NEW_VAULT='0x<正式金库 EIP-55>'
IMAGE=\$(sudo docker inspect presale-worker --format '{{.Config.Image}}')
ENV_TMP=/tmp/worker-env-\$\$.txt

# 抽除 VAULT_POOL 外的所有 PRESALE_* env 到 root-only 临时文件
sudo bash -c \"docker inspect presale-worker --format '{{range .Config.Env}}{{println .}}{{end}}' \\
  | grep '^PRESALE_' | grep -v '^PRESALE_VAULT_POOL=' > '\$ENV_TMP'\"
sudo chmod 600 \"\$ENV_TMP\"
echo '保留 env keys:'; sudo cat \"\$ENV_TMP\" | cut -d= -f1 | sed 's/^/  /'

sudo docker rm presale-worker

sudo docker run -d \\
  --name presale-worker \\
  --restart unless-stopped \\
  --network host \\
  --log-opt max-size=1000m --log-opt max-file=3 \\
  -v /etc/oddfi/config_prod.yaml:/app/config.yaml \\
  --env-file \"\$ENV_TMP\" \\
  -e PRESALE_VAULT_POOL=\"\$NEW_VAULT\" \\
  \"\$IMAGE\" \\
  ./presale-worker > /dev/null

sudo rm \"\$ENV_TMP\"
sleep 15
"
```

**启动后必须验证 LARK_WEBHOOK_URL 被保留**（防呆）：

```bash
ssh oddfi-backend "sudo docker logs presale-worker --tail 30 2>&1 | grep -E 'LarkWebhookService initialized|LarkWebhookUrl not configured'"
# 期望看到：[presale-worker] LarkWebhookService initialized fallback_url=https://... + DB lazy fetch
# 若看到 "LarkWebhookUrl not configured" — env 没保留好，立即 stop + 重做
```

启动日志再核对 6 句关键句：

```bash
ssh oddfi-backend "sudo docker logs presale-worker --tail 30 2>&1 | grep -E 'vault_pool|EnsureAll|ensured cursors|acquired leader|bsc rpc connected|LarkWebhookService'"
# 期望：
#   [presale-worker] starting, env=prod vault_pool=[<NEW_VAULT>]
#   [presale-worker] EnsureAll init block from BSC head: <current head>
#   [presale-worker] ensured cursors for 1 vault addresses (init_block=<...>)
#   [presale-worker] bsc rpc connected
#   [presale-worker] LarkWebhookService initialized ... + DB lazy fetch
#   [presale-worker] acquired leader lock, starting crons
```

### 6.2 改 web-api 容器（HTTP report-tx 校验）

**为什么也要改**：`presale_deposit_impl.go:parseUsdtTransferLog` 用 `s.cfg.VaultPool` 比对
`tx.to`，这个 cfg 在 web-api 容器启动时从 env 读取。漏改 → 前端任何 report-tx 都返
40007。worker 那条幂等保护不会救前端 UX。

操作流程**和 §6.1 一样**，只是容器名换：

```bash
ssh oddfi-backend "
set -e
NEW_VAULT='0x<正式金库 EIP-55>'
IMAGE=\$(sudo docker inspect web-api --format '{{.Config.Image}}')
MOUNTS=\$(sudo docker inspect web-api --format '{{range .Mounts}}-v {{.Source}}:{{.Destination}}{{if eq .Mode \"ro\"}}:ro{{end}} {{end}}')
ENV_TMP=/tmp/webapi-env-\$\$.txt

# 抽除 VAULT_POOL 外的所有 PRESALE_* env
sudo bash -c \"docker inspect web-api --format '{{range .Config.Env}}{{println .}}{{end}}' \\
  | grep '^PRESALE_' | grep -v '^PRESALE_VAULT_POOL=' > '\$ENV_TMP'\"
sudo chmod 600 \"\$ENV_TMP\"

sudo docker stop web-api
sudo docker rm web-api

# shellcheck disable=SC2086 — 故意不引号 MOUNTS 让 -v 展开为多个参数
sudo docker run -d \\
  --name web-api \\
  --restart unless-stopped \\
  --network host \\
  --log-opt max-size=1000m --log-opt max-file=3 \\
  \$MOUNTS \\
  --env-file \"\$ENV_TMP\" \\
  -e PRESALE_VAULT_POOL=\"\$NEW_VAULT\" \\
  \"\$IMAGE\" > /dev/null

sudo rm \"\$ENV_TMP\"
sleep 8
"
```

**4 探针验证**（web-api 健康 + 路径未坏）：

```bash
ssh oddfi-backend "
HEALTH=\$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8081/health)
CONFIG=\$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:80/api/v1/presale/config)
POSITION=\$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:80/api/v1/presale/position)
LOGIN=\$(curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:80/account/login_by_wallet)
echo \"health: \$HEALTH (期望 200)\"
echo \"presale/config: \$CONFIG (期望 200)\"
echo \"presale/position: \$POSITION (期望 401)\"
echo \"login_by_wallet: \$LOGIN (期望 400)\"
"
```

**确认新 env 写入**（防呆）：

```bash
ssh oddfi-backend "sudo docker inspect web-api --format '{{range .Config.Env}}{{println .}}{{end}}' | grep PRESALE_VAULT_POOL"
# 必须 = PRESALE_VAULT_POOL=<NEW_VAULT>
```

### 6.3 跑 verify-worker.sh + 容器健康终态

```bash
ssh oddfi-backend "sudo /usr/local/bin/verify-worker.sh"
# 必须看到 🎉 worker verify PASSED
ssh oddfi-backend "sudo docker inspect web-api presale-worker --format '{{.Name}}: {{.State.Status}} image={{.Config.Image}}'"
# 两个容器都应 running，image tag 一致
```

---

## 7 端到端验证（最关键）

### 7.1 公开接口返回新金库

```bash
/usr/bin/curl -s "https://api.oddfi.io/api/v1/presale/config" | /usr/bin/jq '.data.vault.depositAddress'
# 必须 = $NEW_VAULT (lowercase)
```

### 7.2 准备小额真链测试

用一个**新生成的测试钱包**（不要用之前 0x9d9bcdf... 那个 retired wallet）做：

```text
1. 拿运营 / 你自己的 test wallet 发 0.05 USDT 到 $NEW_VAULT
2. 记录 txHash
3. 等 confirm_blocks=3 ≈ 9-15s
4. 前端 / curl 调 /api/v1/presale/deposit/:txHash
5. 期望：status=confirmed，roundId 不空
6. Lark 群应收到 🎉 deposit_confirmed 卡片（金额 0.05，roundId 同上）
7. 调 /api/v1/presale/position 看持仓增加
8. admin 端 GET /admin/presale/deposits 看到这笔
```

任何一步缺失都视为切换失败 → 进 §9 回滚。

### 7.3 cursor 推进 + raised 累计

```bash
ssh oddfi-backend "
MYSQL_PWD=\"$MYSQL_PWD\" mysql -h $MYSQL_HOST -u $MYSQL_USER $MYSQL_DB -e \"
SELECT vault_address, last_block_number, FROM_UNIXTIME(updated_at/1000) AS updated_at_utc
FROM presale_event_cursor;
SELECT id, sold_odd, raised_usd FROM presale_round WHERE sold_odd > 0;
\"
"
```

cursor 应每 6s 推进，sold/raised 应反映你 §7.2 那笔 0.05 USDT。

---

## 8 24h 观察

- `verify-worker.sh` 每 5 分钟跑一次（cron）持续 24h
- Lark 群有任何告警立即响应
- admin 后台 GET /admin/presale/deposits 计数应稳步增长（如有真实流量）
- 监控 cursor 推进 lag（手动跑：`SELECT NOW(), FROM_UNIXTIME(updated_at/1000) FROM presale_event_cursor;`，间隔不能 > 60s）

24h 全绿 → DD-INVEST V3 正式生效。

---

## 9 回滚预案（§5 之前）

### 9.1 §4 配置改回（admin 端）

```bash
/usr/bin/curl -s -X PATCH "https://admin.oddfi.io/admin/presale/config" \
  -H "authorization: Bearer $JWT" \
  -H 'content-type: application/json' \
  -H "X-Idempotency-Key: $(uuidgen)" \
  -d "{\"vault_address\":\"0xf4b6036d2423B1254f273272929364A120a50c7C\",\"note\":\"回滚到测试金库 — 切换失败\"}"
```

### 9.2 §6 双容器 env 回退

**两个容器都要回**（web-api + presale-worker）。Docker 不支持 update env，必须 stop + rm + run，
所以照 §6.1（worker）+ §6.2（web-api）完整命令重做，把 `NEW_VAULT` 改回旧地址即可。

```bash
NEW_VAULT=0xf4b6036d2423B1254f273272929364A120a50c7C   # 或当时切走前的旧地址
# 复用 §6.1 worker docker run + §6.2 web-api docker run 命令，
# 唯一变量是 NEW_VAULT，其余 env 走 --env-file 自动保留
```

回滚后同样跑：
- §6.1 末尾的"LarkWebhookService initialized"防呆检查
- §6.2 末尾的 4 探针 + `inspect web-api ... PRESALE_VAULT_POOL` 防呆检查
- §6.3 verify-worker.sh PASSED

**漏改任何一个容器都会让 cutover/rollback 不完整**（双轨假设下数据可能仍然进，但 UX 全坏）。

## 10 回滚预案（§5 之后 — 严重）

测试数据 TRUNCATE 后无法靠应用层回滚，只能从 §1 备份恢复：

```bash
ssh oddfi-backend "
cd /var/backup/oddfi/reset-<TS>
gunzip -c pre-reset-business-tables.sql.gz | \
  MYSQL_PWD=\"$MYSQL_PWD\" mysql -h $MYSQL_HOST -u $MYSQL_USER $MYSQL_DB
"
# 然后跑 §1.3 baseline check 确认数据回来了
```

⚠️ **此回滚会丢掉 §5.2 之后产生的所有新 deposit 数据**（如果切换中有真实用户入金）。所以 §5 启动前**必须确认没有真实流量**（你可以 §2 maintenance window 通知前端把入口关掉）。

---

## 关联

- [release-rollout-plan.md §6.2](release-rollout-plan.md) — 老版粗略 SOP
- [tasks.md §6](tasks.md) — 清理 / 切换的 checklist
- [backup-presale-config.sh](../../../scripts/backup-presale-config.sh) — 单行配置每日备份（依然跑，跟本 runbook 独立）
- [verify-worker.sh](../../../scripts/verify-worker.sh) — worker 健康验证
