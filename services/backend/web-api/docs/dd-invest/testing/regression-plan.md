# 全量回归 Checklist（V3 · 模型 B）

> 契约源真值：[README.md §4](../README.md)（gate 要求）、[01-data-model.md §5](../01-data-model.md)（INV-1~8）、[00-architecture.md §7](../00-architecture.md)（风险与缓解）。
> V3 砍掉：vesting cron、claim worker、EIP-191 签名、热钱包、ODD 价格抓取、`presale_order`。
> 三步走：**testnet → staging → prod**；每步均为 task-driven，不设固定时间预算，全部 checklist 通过才进下一步。
> 用例 ID 格式：`REG-<步骤>-<seq>`。

---

## Step 1 · Testnet（dev-api.oddfi.io + BSC Testnet + testnet USDT）

**环境**：`dev-api.oddfi.io`；BSC Testnet（chainId=97）；mock testnet USDT（已部署到测试网）；admin-backend dev 环境。

**目标**：覆盖全部 e2e 子集 + 对抗矩阵 P0/P1；用测试网代币，零真实资金风险。

### REG-1 自动化（CI 跑）

- [ ] REG-1-01 `go vet ./...` 零告警
- [ ] REG-1-02 `go build ./cmd/web-api/... ./cmd/presale-worker/...` 零错误
- [ ] REG-1-03 `go test ./internal/... -count=1 -race -timeout 5m` 全绿（无 data race）
- [ ] REG-1-04 `go test ./tests/e2e/... -count=1 -timeout 15m -tags=e2e` 全绿
- [ ] REG-1-05 `go test ./internal/handler -fuzz=. -fuzztime=2m -tags=fuzz` 无 5xx / panic
- [ ] REG-1-06 admin-backend `go test ./... -count=1 -race` 全绿（含 RBAC 矩阵 68 组）
- [ ] REG-1-07 OpenAPI schema diff：接口契约无 breaking change（vs 上一 tag）

### REG-1 业务流验证（e2e 子集）

| ID | 对应用例 | 优先级 |
|---|---|---|
| REG-1-08 | [E2E-01](e2e-scenarios.md) 正常入账完整链路（连钱包→绑邀请→转账→confirmed→持仓） | P0 |
| REG-1-09 | [E2E-03](e2e-scenarios.md) 邀请关系完整链路（A邀B→B下单→A拿奖励→list核对） | P0 |
| REG-1-10 | [E2E-02](e2e-scenarios.md) 边界切轮兜底（2min 禁下单 + 5min 容差 + migrate-round） | P0 |
| REG-1-11 | [E2E-04](e2e-scenarios.md) 超额到账预案（overflow → ops_event → resolve） | P1 |
| REG-1-12 | [E2E-05](e2e-scenarios.md) 无主转账确认（unclaimed → Lark 通知 → 客服联系 → 转单） | P1 |
| REG-1-13 | [E2E-07](e2e-scenarios.md) pause + reopen 全周期 | P1 |

### REG-1 对抗矩阵（P0/P1）

| ID | 对应用例 | 优先级 |
|---|---|---|
| REG-1-20 | [ADV-REF-02](adversarial-cases.md) 自邀阻断 | P0 |
| REG-1-21 | [ADV-REF-03](adversarial-cases.md) 重复绑定幂等 | P0 |
| REG-1-22 | [ADV-REF-06](adversarial-cases.md) bound_at ≥ block_timestamp 边界（不发奖励） | P0 |
| REG-1-23 | [ADV-DEP-01](adversarial-cases.md) 双轨竞态幂等（uk_(tx_hash,log_index)） | P0 |
| REG-1-24 | [ADV-DEP-06](adversarial-cases.md) tx.from ≠ 登录态 EOA（F1 严格匹配） | P0 |
| REG-1-25 | [ADV-DEP-10](adversarial-cases.md) 超额到账不破坏 INV-1 | P0 |
| REG-1-26 | [ADV-DEP-14](adversarial-cases.md) Worker 重启游标重放（无丢无重） | P0 |
| REG-1-27 | [ADV-INV-01~08](adversarial-cases.md) 全部不变量 SQL 断言 | P0 |
| REG-1-28 | [ADV-ADM-04](adversarial-cases.md) audit 表 UPDATE/DELETE 被 DB 层拒绝 | P0 |
| REG-1-29 | [ADV-ADM-01~03](adversarial-cases.md) 非法 RBAC（CS/FI 访问高权限接口） | P1 |
| REG-1-30 | [ADV-DEP-11](adversarial-cases.md) pause 期间到账（信息流，非阻塞） | P1 |
| REG-1-31 | [ADV-DEP-16](adversarial-cases.md) 多金库地址池（旧地址仍监听） | P1 |

### REG-1 接口 fuzz

| ID | 接口 | 时长 |
|---|---|---|
| REG-1-40 | [FUZZ-RT-01~22](fuzz-spec.md) `POST /deposit/report-tx` | 5min |
| REG-1-41 | [FUZZ-BIND-01~18](fuzz-spec.md) `POST /referral/bind` | 5min |
| REG-1-42 | [FUZZ-CFG-01~06](fuzz-spec.md) `GET /config` 负载测试 | 30s/100QPS |
| REG-1-43 | [FUZZ-ADM-01~17](fuzz-spec.md) admin RBAC 矩阵（68 组） | 单次全跑 |

### REG-1 数据一致性（testnet 对账）

- [ ] REG-1-50 `SELECT * FROM presale_round WHERE sold_odd > supply_odd` → 空（INV-1）
- [ ] REG-1-51 `Σ holding(source=invest, round=R) = round.sold_odd` for all rounds（INV-2）
- [ ] REG-1-52 `SELECT tx_hash, log_index, COUNT(*) FROM presale_deposit GROUP BY tx_hash, log_index HAVING COUNT(*) > 1` → 空（INV-3）
- [ ] REG-1-53 `SELECT user_id, COUNT(*) FROM user_referral_bind GROUP BY user_id HAVING COUNT(*) > 1` → 空（INV-4）
- [ ] REG-1-54 INV-7：`referral_reward_odd = shares_odd × referral_reward_pct / 100`（随机抽查 10 行）

### REG-1 验收标准

- 全部 P0 checklist 100% 通过
- P1 checklist 100% 通过（允许已知 bug 挂 issue 但不阻塞 Step 2，需 owner 确认）
- 无任何 5xx / panic / DB error log
- INV-1~8 SQL 断言全部返空

---

## Step 2 · Staging（内部钱包 + mainnet RPC + 临时金库地址）

**环境**：`api.oddfi.io`（staging 分支）；BSC mainnet RPC；临时多签金库地址（与正式金库隔离）；内部钱包小额真实 USDT（每笔 ≤ 10 USDT）。

**目标**：用真实 mainnet 链验证 RPC 集成、真实出块速度（~3s）、Gas 费、多地址池切换；不动正式资金。

### REG-2 环境检查

- [ ] REG-2-01 `PRESALE_VAULT_POOL` env 包含临时金库地址（≠ 正式多签地址）
- [ ] REG-2-02 `presale_event_cursor` 初始化到 staging 部署时的当前块高（不从 0 开始）
- [ ] REG-2-03 presale-worker Redis leader lock 工作正常（单实例）
- [ ] REG-2-04 Lark webhook 可达（测试推送一条 anomaly 通知）
- [ ] REG-2-05 admin-backend staging 环境鉴权正常（Lark OAuth 回调 URL 已配）

### REG-2 业务流（真实链）

| ID | 场景 | 金额 | 验证点 |
|---|---|---|---|
| REG-2-10 | 正常入账（内部钱包 → 临时金库） | 10 USDT | confirmed；holding 更新；`block_timestamp` 真实；出块 ≤ 15s |
| REG-2-11 | 双轨会师（report-tx + Worker 同时到） | 10 USDT | uk 幂等，1 行 deposit |
| REG-2-12 | report-tx 快于 Worker（前端先上报） | 10 USDT | pending → confirmed 推进正常 |
| REG-2-13 | Worker 快于 report-tx（Worker 先扫到） | 10 USDT | source='worker'；report-tx 再到走幂等 |
| REG-2-14 | tx.from ≠ JWT EOA（内部另一个钱包发） | 10 USDT | `40902 WALLET_MISMATCH`；anomaly 落库；Lark 通知 |

### REG-2 多金库地址池切换

| ID | 步骤 | 验证点 |
|---|---|---|
| REG-2-20 | `PATCH /admin/presale/config { vaultAddress:"0xNEW_STAGING" }` | 响应含 warning；config 表已更新 |
| REG-2-21 | 更新 env `PRESALE_VAULT_POOL=["0xOLD_STAGING","0xNEW_STAGING"]`；重启 Worker | `presale_event_cursor` 新增 `0xNEW_STAGING` 行 |
| REG-2-22 | 内部钱包打 10 USDT 到 `0xOLD_STAGING`（老地址） | 正常 confirmed；`vault_address='0xOLD_STAGING'` |
| REG-2-23 | 内部钱包打 10 USDT 到 `0xNEW_STAGING`（新地址） | 正常 confirmed；`vault_address='0xNEW_STAGING'` |
| REG-2-24 | `GET /config` 返回新地址 | `vault.depositAddress = "0xNEW_STAGING"` |

### REG-2 监控 + 告警验证

- [ ] REG-2-30 Worker 游标 `updated_at` 每分钟前进（见 [ops/monitoring-alerts.md](../ops/monitoring-alerts.md)）
- [ ] REG-2-31 手动制造 anomaly（打到非金库地址）→ Lark 收到通知 ≤ 30s
- [ ] REG-2-32 手动 kill Worker 进程 → 30s 内 Redis leader lock 释放；重启后游标从断点继续
- [ ] REG-2-33 `GET /config` p95 < 50ms（Redis 命中）；`GET /position` p95 < 100ms

### REG-2 安全

- [ ] REG-2-40 `security-reviewer` 跑过：重点审核 `tx.from` 严格匹配 / vault 多地址池 / admin RBAC / audit 不可篡改
- [ ] REG-2-41 检查 secret 不落日志：`grep -ri 'private_key\|jwt_secret\|webhook_url' logs/ | wc -l` = 0
- [ ] REG-2-42 `presale_admin_audit` 无 UPDATE/DELETE（直连 DB 验证 `SHOW GRANTS FOR 'app_user'@'%'` 仅含 INSERT）
- [ ] REG-2-43 限流配置已上 nginx：`report-tx` 10/min/user；`bind` 5/min/user

### REG-2 验收标准

- REG-2-10~13 全部真实链验证通过
- 多金库切换演练（REG-2-20~24）全通过
- 监控 + 告警（REG-2-30~33）全通过
- 安全扫描（REG-2-40~43）全通过
- INV-1~8 SQL 断言在 staging DB 全部返空

---

## Step 3 · Prod（正式金库 + 灰度 + 监控闸值）

**环境**：`api.oddfi.io`（main 分支）；BSC mainnet；正式多签金库地址；前端开关白名单 EOA 灰度。

**目标**：生产上线后的有序验证，最小化首批用户风险，确认全链路在真实流量下正确运行。

### REG-3 上线前 checklist

- [ ] REG-3-01 migration 在 prod DB 跑通（staging 已验，直接 apply；先备份）
- [ ] REG-3-02 `presale_config` 初始化：`vault_address`、`tge_ts`、`tge_open_price_usd`、`min_subscribe_usd` 全部确认
- [ ] REG-3-03 正式多签金库地址（multisig）已就绪，测试过签名流程
- [ ] REG-3-04 `PRESALE_VAULT_POOL` env 已设置正式地址；presale-worker 启动后日志显示监听正式地址
- [ ] REG-3-05 `presale_event_cursor` 初始化到生产部署时的当前块高（由 ops 确认）
- [ ] REG-3-06 Lark webhook 指向正式运营群（不是测试群）
- [ ] REG-3-07 前端灰度开关（白名单 EOA）已配置，首批 ≤ 10 个内部 EOA
- [ ] REG-3-08 监控大盘已上线，所有指标有数据（见 [ops/monitoring-alerts.md](../ops/monitoring-alerts.md)）
- [ ] REG-3-09 运营 PD 已知预售流程 SOP：anomaly 处理 / migrate-round / pause-resume 操作手册

### REG-3 灰度验证（内部 EOA 白名单，首批）

| ID | 场景 | 金额 | 验证点 |
|---|---|---|---|
| REG-3-10 | 内部 EOA 正常入账（正式金库） | ≤ 100 USDT | confirmed；holding 更新；`block_timestamp` 真实 |
| REG-3-11 | 邀请链路（内部 A 邀 B → B 下单） | ≤ 100 USDT | referral_reward_odd 正确；list 可见 |
| REG-3-12 | `GET /position` 数据正确 | — | holdings / investedUsd / lockedPriceAvg 精度正确 |
| REG-3-13 | admin 查 `GET /admin/presale/deposits` 可见首批 deposit | — | 列表有数据，金额 / txHash 与链上一致 |

### REG-3 监控告警闸值验证

| ID | 告警类型 | 触发方式 | 验收 |
|---|---|---|---|
| REG-3-20 | `listener_lag > 60s` | 临时停 Worker 60s 再重启 | Lark 运营群 ≤ 90s 内收到告警 |
| REG-3-21 | anomaly 积压 > 10 条 | 手动插 10 条 `presale_ops_event(status='pending')` | 监控大盘告警触发 |
| REG-3-22 | Worker 游标停滞 | kill Worker 30s | 游标 `updated_at` 停止前进；告警触发 |

### REG-3 上线后 24h 观察 checklist

- [ ] REG-3-30 每小时检查：`presale_ops_event(status='pending')` 数量 / Worker 游标前进 / anomaly 率
- [ ] REG-3-31 首笔真实用户 deposit confirmed → 全链路手工 SQL 对账（deposit / holding / round.sold_odd）
- [ ] REG-3-32 首笔 anomaly（若有）→ Lark 通知到达；运营按 SOP 处理；ops_event resolved
- [ ] REG-3-33 `GET /referral/list` 首批有效邀请关系显示正确
- [ ] REG-3-34 INV-1~8 SQL 断言在 prod DB 全部返空（24h 后跑一次）

### REG-3 验收标准

- REG-3-10~13 灰度批次全部通过
- REG-3-20~22 告警闸值验证通过
- REG-3-30~34 24h 观察全绿
- INV-1~8 SQL 断言返空
- 若 24h 内出现高频 anomaly（> 5%）→ 触发回滚预案（见 [ops/cutover-dd003.md](../ops/cutover-dd003.md) §回滚）

---

## 全量对账 SQL（三步通用）

```sql
-- INV-1：轮次不超额
SELECT id, sold_odd, supply_odd FROM presale_round
WHERE sold_odd > supply_odd;

-- INV-2：holding 与 round 对账
SELECT r.id, r.sold_odd,
       COALESCE(SUM(h.total_odd), 0) AS holding_sum,
       r.sold_odd - COALESCE(SUM(h.total_odd), 0) AS diff
FROM presale_round r
LEFT JOIN presale_holding h ON h.round_id = r.id AND h.source = 1
GROUP BY r.id, r.sold_odd
HAVING ABS(diff) > 0.000001;

-- INV-3：deposit 幂等键唯一性
SELECT tx_hash, log_index, COUNT(*) c
FROM presale_deposit
GROUP BY tx_hash, log_index HAVING c > 1;

-- INV-4：bind 单用户唯一
SELECT user_id, COUNT(*) c FROM user_referral_bind
GROUP BY user_id HAVING c > 1;

-- INV-5：邀请码全局唯一
SELECT code, COUNT(*) c FROM user_referral_code
GROUP BY code HAVING c > 1;

-- INV-6：有效邀请 bound_at < block_timestamp
SELECT d.id, d.tx_hash, b.bound_at, d.block_timestamp
FROM presale_deposit d
JOIN user_referral_bind b ON b.user_id = d.user_id
WHERE d.referrer_user_id IS NOT NULL
  AND b.bound_at >= d.block_timestamp;

-- INV-7：referral_reward_odd 公式校验（允许 1e-6 精度误差）
SELECT id, shares_odd, referral_reward_pct, referral_reward_odd,
       ABS(referral_reward_odd - shares_odd * referral_reward_pct / 100) AS delta
FROM presale_deposit
WHERE referrer_user_id IS NOT NULL
  AND ABS(referral_reward_odd - shares_odd * referral_reward_pct / 100) > 0.000001;
```

---

## 回滚预案入口

见 [ops/cutover-dd003.md](../ops/cutover-dd003.md) §回滚。触发条件：

- 生产 anomaly 率 > 5%（24h 内）
- Worker 游标连续 10min 不前进且无法自愈
- INV-1 被破坏（sold_odd > supply_odd）
- admin-backend 鉴权失效（任何角色可调高权限接口）
