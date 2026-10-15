# 监控与告警（V3 · 模型 B · 事件驱动）

> V3 变化要点：砍掉热钱包 / claim / vesting 相关指标；新增多金库地址池监控、双轨上报延迟、presale_ops_event 积压、audit 写入频次。
> 基础设施：复用现有 Prometheus + Grafana + 告警链路；新增 presale 命名空间。

---

## 1 关键指标清单

### 1.1 监听器健康

| 指标 | 类型 | 标签 | 说明 | 告警阈值 |
|---|---|---|---|---|
| `presale_event_cursor_block_lag` | gauge | `vault_address` | `chain_head_block - cursor.last_block_number`，每金库地址独立 | ≥ 50 块告警（P0） |
| `presale_event_cursor_last_block` | gauge | `vault_address` | 游标当前区块高度 | 用于趋势图 |
| `presale_listener_events_total` | counter | `vault_address` | 每金库地址监听到的 USDT Transfer 事件数 | — |
| `presale_listener_poll_duration_seconds` | histogram | `vault_address` | eth_getLogs 轮询耗时 | p99 > 5s 告警（P1） |
| `presale_listener_errors_total` | counter | `vault_address`, `error_type` | RPC 错误计数 | rate > 0.1/min 告警（P1） |

**判断基准**：

- BSC 出块 ~3s，`PRESALE_WORKER_POLL_INTERVAL=30s`，正常情况下游标落后 ≤ 10 块
- 落后 ≥ 50 块（约 2.5min）说明监听器卡住，触发 P0 告警

### 1.2 Worker Leader 状态

| 指标 | 类型 | 说明 | 告警阈值 |
|---|---|---|---|
| `presale_worker_leader_ttl_seconds` | gauge | Redis key `presale:worker:leader` 当前 TTL | < 5s 或 key 不存在告警（P0） |
| `presale_worker_leader_switches_total` | counter | leader 切换次数（instance_id 变化） | 10min 内 > 3 次告警（P1） |
| `presale_worker_is_leader` | gauge | `instance_id` | 当前实例是否为 leader（0/1） | — |

**判断基准**：

- 正常情况 TTL 在 0~30s 之间滑动（每次任务执行前续期）
- TTL 跌到 0 且 30s 内无新实例接管 → P0 双重失联

### 1.3 anomaly 事件积压

| 指标 / SQL | 说明 | 告警阈值 |
|---|---|---|
| `presale_ops_event_pending_gauge` | `SELECT COUNT(*) FROM presale_ops_event WHERE status IN ('pending','notified')` | > 20 条 → P1；> 100 条 → P0 |
| `presale_ops_event_by_type_gauge` | 按 `event_type` 分组的积压数 | 单类型 > 50 条告警（P1） |
| `presale_ops_event_oldest_pending_age_seconds` | 最老 pending 事件距今时间 | > 3600s（1 小时）告警（P1） |

**anomaly_reason 枚举参考**：`overflow / from_mismatch / non_usdt / below_min / round_mismatch / late_arrival / paused_arrival / unclaimed / fake_referrer`

### 1.4 Lark Webhook 推送

| 指标 | 类型 | 说明 | 告警阈值 |
|---|---|---|---|
| `presale_lark_push_total` | counter | `result=success/fail` | — |
| `presale_lark_push_retries_total` | counter | retry 次数累计 | — |
| `presale_lark_push_failed_permanent_total` | counter | retry 3 次仍失败（永久失败） | > 0 条 → P1（运营未收到通知） |

### 1.5 双轨上报延迟

| 指标 | 类型 | 说明 |
|---|---|---|
| `presale_dual_track_delta_seconds` | histogram | 前端 report-tx 时间 vs Worker 确认时间的差值（abs），反映双轨会师速度 |
| `presale_dual_track_frontend_only_total` | counter | 只有前端上报、Worker 未扫到（超 5min）的 tx 数 |
| `presale_dual_track_worker_only_total` | counter | 只有 Worker 扫到、前端未上报的 tx 数 |

**判断基准**：正常情况双轨差值中位数应 < 60s（用户报 tx → Worker 扫同一块）。

### 1.6 多金库地址池命中率

| 指标 / SQL | 说明 |
|---|---|
| `presale_deposit_by_vault_total` | 按 `vault_address` 分组的 deposit 数 |
| SQL: `SELECT vault_address, COUNT(*) FROM presale_deposit GROUP BY vault_address` | 每个 vault 地址的实际入账量，用于判断金库切换是否生效 |

### 1.7 业务量指标

| 指标 | 类型 | 标签 | 说明 |
|---|---|---|---|
| `presale_deposit_total` | counter | `round_id`, `status` | 按轮次按状态的入账计数 |
| `presale_deposit_usdt_total` | counter | `round_id` | 每轮累计 USDT 到账金额 |
| `presale_deposit_odd_shares_total` | counter | `round_id` | 每轮累计 ODD 份额 |
| `presale_referral_reward_odd_total` | counter | `round_id` | 每轮累计邀请奖励 ODD |
| `presale_round_sold_pct` | gauge | `round_id` | `sold_odd / supply_odd × 100`，每轮售罄进度 |
| `presale_deposit_daily_usdt` | gauge | — | 当日 USDT 入账总量（每日对账用） |
| `presale_deposit_daily_odd` | gauge | — | 当日 ODD 份额总量 |
| `presale_referral_reward_daily_odd` | gauge | — | 当日邀请奖励 ODD 总量 |

### 1.8 Admin 审计频次

| 指标 / SQL | 说明 | 告警阈值 |
|---|---|---|
| `presale_admin_audit_writes_total` | counter | `action` | admin 操作总计数 | — |
| SQL: `SELECT action, COUNT(*) FROM presale_admin_audit WHERE created_at > UNIX_TIMESTAMP(DATE_SUB(NOW(),INTERVAL 1 HOUR))*1000 GROUP BY action` | 高敏操作（`update_config / migrate_round_id / update_round`）近 1h 频次 | > 10 次/h → P1（异常操作风暴） |

---

## 2 告警分级与分发

### 2.1 P0（立即响应，5min 内）

| 告警名 | 触发条件 |
|---|---|
| `PresaleListenerFarBehind` | 任意 `vault_address` 的 `presale_event_cursor_block_lag > 50` 持续 5min |
| `PresaleWorkerLeaderLost` | `presale:worker:leader` Redis key 不存在且持续 > 60s（所有实例失联） |
| `PresaleAnomalyExplosion` | `presale_ops_event_pending_gauge > 100` |

### 2.2 P1（30min 内响应）

| 告警名 | 触发条件 |
|---|---|
| `PresaleListenerErrors` | `rate(presale_listener_errors_total[5m]) > 0.1` |
| `PresaleAnomalyBacklog` | `presale_ops_event_pending_gauge > 20` |
| `PresaleAnomalyStale` | `presale_ops_event_oldest_pending_age_seconds > 3600` |
| `PresaleLarkPushFailed` | `presale_lark_push_failed_permanent_total > 0` |
| `PresaleWorkerLeaderFlapping` | 10min 内 leader 切换 > 3 次 |
| `PresaleAdminHighFreq` | 高敏 admin 操作近 1h > 10 次 |
| `PresalePollSlow` | `presale_listener_poll_duration_seconds` p99 > 5s |

### 2.3 P2（当日工作时间内响应）

| 告警名 | 触发条件 |
|---|---|
| `PresaleHighFreqSingleEOA` | 同一 `eoa_address` 在 1h 内 deposit 数 > 10 笔（风控） |
| `PresaleReferralCodeCollision` | `user_referral_code` 生成冲突 > 3 次（CSPRNG 告警） |
| `PresaleDualTrackLag` | `presale_dual_track_delta_seconds` p99 > 300s（双轨严重不同步） |

---

## 3 Lark 告警通道分发

| 告警类型 | 推送群 | 内容 |
|---|---|---|
| `PresaleListenerFarBehind` / `PresaleWorkerLeaderLost` / worker 重启 | oncall 群 | 游标落后块数 / leader 状态 / 实例 ID |
| `PresaleAnomalyBacklog` / `PresaleLarkPushFailed` | oncall 群 | 积压数 / event_type 分布 |
| 大额单笔入账（单笔 > $50,000 等值 USDT） | 风控群 | tx_hash / eoa / amount_usdt / round_id |
| 超额到账（`overflow` anomaly） | 风控群 | tx_hash / overflow 金额 / 当前轮次剩余容量 |
| 短时间多笔同 EOA（P2 风控） | 风控群 | eoa_address / 1h 内笔数 |
| 每日入账日报（cron 00:05 UTC+8 推送） | 财务群 | 当日 USDT 总额 / ODD 份额 / 邀请奖励 ODD / 各轮进度 |
| `PresaleAdminHighFreq` / 高敏 admin 操作 | oncall 群 | operator / action / 频次 |
| `presale:worker:leader` 正常心跳（可选，调试时开） | — | 不推送，仅记日志 |

**Lark Webhook anomaly 消息格式**（`presale_ops_event` 新建时触发）：

```json
{
  "msg_type": "interactive",
  "card": {
    "header": { "title": "⚠️ Presale Anomaly: overflow" },
    "elements": [
      { "tag": "div", "text": { "content": "tx_hash: 0xABC...\neoa: 0xUSR...\namount_usdt: 12000\nround: public_a\noverlflow_usd: 2000" } },
      { "tag": "div", "text": { "content": "ops_event_id: 42  |  created_at: 2026-05-25 14:30 UTC+8" } },
      { "tag": "action", "actions": [{ "tag": "button", "text": "查看详情", "url": "https://admin.oddfi.io/presale/anomaly/42" }] }
    ]
  }
}
```

---

## 4 Prometheus / Grafana 面板

### 4.1 面板布局（4 页）

**Page 1 · 业务概览**

| 组件 | 数据来源 |
|---|---|
| 各轮 sold 进度条（横向） | `presale_round_sold_pct{round_id="seed/strategic/..."}` |
| 累计 USDT 入账 | `sum(presale_deposit_usdt_total)` |
| 当日 USDT / ODD / 邀请奖励 | `presale_deposit_daily_*` gauge |
| 入账数 timeline（按 round_id 分色） | `rate(presale_deposit_total[5m])` |

**Page 2 · 监听器健康**

| 组件 | 数据来源 |
|---|---|
| 监听器游标趋势（多金库分线） | `presale_event_cursor_last_block{vault_address="..."}` |
| 游标 block lag（红线告警阈值 50） | `presale_event_cursor_block_lag` |
| leader TTL 仪表盘（0~30） | `presale_worker_leader_ttl_seconds` |
| leader 切换次数 timeline | `rate(presale_worker_leader_switches_total[5m])` |
| RPC 错误率 | `rate(presale_listener_errors_total[5m])` |

**Page 3 · anomaly 积压**

| 组件 | 数据来源 |
|---|---|
| anomaly 类型分布饼图 | `presale_ops_event_by_type_gauge` |
| anomaly 积压趋势曲线 | `presale_ops_event_pending_gauge` |
| Lark 推送失败计数 | `presale_lark_push_failed_permanent_total` |
| 双轨延迟 p50/p99 | `histogram_quantile(0.99, presale_dual_track_delta_seconds_bucket)` |

**Page 4 · Admin 操作审计时间线**

| 组件 | 数据来源 |
|---|---|
| admin 操作 timeline（按 action 分色） | `rate(presale_admin_audit_writes_total[5m])` by `action` |
| 高敏操作（update_config / migrate_round）频次 | `presale_admin_audit_writes_total{action=~"update_config|migrate_round_id|update_round"}` |

---

## 5 日志规范

所有 presale 相关结构化日志字段必须包含：

```json
{
  "level": "info",
  "event": "deposit_confirmed",
  "tx_hash": "0xABC...",
  "log_index": 0,
  "eoa": "0xUSR...",
  "vault": "0xVLT...",
  "amount_usdt": "1000.000000000000000000",
  "round_id": "public_a",
  "shares_odd": "25000.000000000000000000",
  "block": 38000000,
  "source": "worker"
}
```

**禁止**出现在日志中：私钥 / JWT secret / Lark webhook 完整 URL（只能 mask 最后 8 字符）。

**关键事件 level 约定**：

| 事件 | level |
|---|---|
| deposit_confirmed | info |
| anomaly_created | warn |
| lark_push_failed | error |
| leader_acquired | info |
| leader_lost | warn |
| cursor_updated | debug |
| rpc_error | error |

---

## 6 每日对账 SOP

每日 00:10 UTC+8 运行对账 SQL（cron 触发，结果推财务群）：

```sql
-- 对账 1：holding 与 round sold 对齐
SELECT
  h.round_id,
  SUM(h.total_odd) AS holding_sum_odd,
  r.sold_odd AS round_sold_odd,
  ABS(SUM(h.total_odd) - r.sold_odd) AS diff
FROM presale_holding h
JOIN presale_round r ON r.id = h.round_id
WHERE h.source = 1  -- invest
GROUP BY h.round_id, r.sold_odd
HAVING diff > 0.000001;  -- 允许小数误差

-- 对账 2：各轮当日入账汇总（发财务群）
SELECT
  round_id,
  COUNT(*) AS deposit_count,
  SUM(amount_usdt) AS total_usdt,
  SUM(shares_odd) AS total_odd,
  SUM(referral_reward_odd) AS referral_odd
FROM presale_deposit
WHERE status = 'confirmed'
  AND confirmed_at > UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 1 DAY)) * 1000
GROUP BY round_id;

-- 对账 3：anomaly 未处理积压
SELECT event_type, status, COUNT(*) AS cnt
FROM presale_ops_event
WHERE status IN ('pending', 'notified')
GROUP BY event_type, status;
```

---

## 7 运营 SOP 快查表

| 场景 | 处理路径 |
|---|---|
| 监听器游标落后 ≥ 50 块 | 检查 BSC RPC 健康 → 检查 presale-worker 日志 → 必要时重启 worker；若 RPC 不可用则切换备用 RPC → 改 `BSC_RPC_URL` env 并重启 |
| Worker leader 抢不到锁 | 检查 Redis 连接 → `redis-cli get presale:worker:leader` 查当前 holder → 手动 `redis-cli del presale:worker:leader` 释放后重试 |
| anomaly 积压 > 20 条 | 查 `presale_ops_event` 按 event_type 分类 → 走 admin HTTP 接口或预案脚本逐条处理（POST /admin/presale/anomaly/:id/resolve） |
| Lark webhook 推送失败 | 检查 `PRESALE_LARK_WEBHOOK_URL` env 是否有效 → 检查 Lark 应用权限 → presale_ops_event 仍在积压，手动补推 |
| overflow anomaly | 联系用户 → 决定按当轮 partial_credit / 下一轮 / 退款 → 走 admin resolve 接口，附 note |
| unclaimed anomaly（绕前端直转） | 客服联系用户确认身份 → 确认后走 convert_to_deposit resolve → 手动关联 user_id |
| 金库切换 | 严格按 §5 金库切换 cutover 流程执行 |
| 大额单笔（风控群告警） | 运营人工核查 EOA 背景 → 正常则 resolved_by=ops → 异常则 rejected + 联系法务 |
