# 对抗性测试矩阵（V3 · 模型 B）

> 契约源真值：[01-data-model.md §5](../01-data-model.md)（不变量 INV-1~8）、[02-api-contract.md §2](../02-api-contract.md)（错误码）、[03-admin-api-contract.md §2](../03-admin-api-contract.md)（RBAC）。
> V3 砍掉：pending/expired/mismatch 订单状态机、vesting cron、claim、EIP-191 签名、热钱包发放、ODD 价格抓取。
> 用例 ID 格式：`ADV-<主题>-<seq>`。

## 共用基础设施

| 组件 | 配置 |
|---|---|
| 本地 EVM | Anvil `--fork-url https://bsc-dataseed.binance.org`（或独立链，fork 取实时状态） |
| mock USDT | OpenZeppelin ERC20 部署到 Anvil，合约地址固定写 `presale_config` |
| 测试 DB | testcontainer MySQL 8（每用例独立库或 truncate） |
| mock Redis | miniredis（单元）/ 真 Redis（e2e） |
| 执行入口 | `internal/service/*/adversarial_test.go` + `tests/adversarial/` 目录 |
| 命名规范 | `adversarial_referral_01_test.go`，`-tags=adversarial` |

---

## §REF 邀请系统对抗

### ADV-REF-01 邀请码 CSPRNG 碰撞超限

**触发条件**：模拟 `user_referral_code` 生成时，pre-insert 5 条已存在的同码记录，使 CSPRNG 重试 5 次都碰撞，触发第 6 次超限。

**期望结果**：服务返回 500；同时向 Lark 发出告警（30^6 ≈ 729M 空间，百万级用户碰撞概率 0.07%，超限属于系统异常）；`user_referral_code` 表无该用户的新行写入。

**验证方式**：
```sql
SELECT COUNT(*) FROM user_referral_code WHERE user_id = <test_user_id>;
-- 期望: 0
```
Lark mock webhook 收到告警消息，`event_type=referral_code_gen_fail`。

---

### ADV-REF-02 自邀阻断

**触发条件**：用户 A 登录后，取得自己的 `myCode`，再调 `POST /referral/bind { code: A.myCode }`（即用 `user_referral_code.user_id = 当前 user_id` 的 code 绑定自己）。

**期望结果**：`40004 SELF_REFERRAL`；`user_referral_bind` 表无任何写入；审计可追溯（日志中记录尝试）。

**验证方式**：
```sql
SELECT COUNT(*) FROM user_referral_bind WHERE user_id = <A_user_id>;
-- 期望: 0
```
HTTP 响应 `{"code":40004,"message":"SELF_REFERRAL"}`。

---

### ADV-REF-03 重复绑定幂等（相同 code）

**触发条件**：用户 B 已绑定邀请人 A（`user_referral_bind` 有记录），再次调 `POST /referral/bind { code: A.code }`（同一 code）。

**期望结果**：`40903 ALREADY_BOUND`；DB 无新行（`INSERT ... ON DUPLICATE KEY UPDATE user_id=user_id` 幂等，实际不更新任何字段）；前端静默（自动绑场景下不打扰用户）。

**验证方式**：
```sql
SELECT COUNT(*) FROM user_referral_bind WHERE user_id = <B_user_id>;
-- 期望: 1（不变）
```

---

### ADV-REF-04 重复绑定（不同 code，试图改绑）

**触发条件**：用户 B 已绑定邀请人 A，再次调 `POST /referral/bind { code: C.code }`（不同邀请人的 code，试图改绑）。

**期望结果**：同 ADV-REF-03，返 `40903 ALREADY_BOUND`；一旦绑定不可撤销不可改；`referrer_code` 字段不变。

**验证方式**：
```sql
SELECT referrer_code FROM user_referral_bind WHERE user_id = <B_user_id>;
-- 期望: 仍为 A.code，不变
```

---

### ADV-REF-05 LocalStorage 意图保留 → 连钱包后自动绑定

**触发条件**：前端 URL 携带 `?ref=0xABC123`，用户尚未连钱包，LocalStorage 存储意图；用户后续连钱包完成登录（拿到 JWT），前端读 LocalStorage，自动调 `POST /referral/bind { code:"0xABC123", source:"link", business:"presale" }`。

**期望结果**：bind 成功；`user_referral_bind.source='link'`；`GET /referral/me` 返 `referrer` 非 null；LocalStorage 清空意图（防止重复触发）。

**验证方式**：
```sql
SELECT source, referrer_code FROM user_referral_bind WHERE user_id = <user_id>;
-- 期望: source='link', referrer_code='0xABC123'
```

---

### ADV-REF-06 bound_at < block_timestamp 边界（绑定后 0ms 内的转账）

**触发条件**：用户 B 绑定邀请人 A，`bound_at = T`；链上 USDT Transfer 的 `block_timestamp = T`（差值 = 0，即同一毫秒或 `bound_at ≥ block_timestamp`）。这是 INV-6 的边界测试。

**期望结果**：该笔 deposit `referrer_user_id = NULL`（绑定时间戳 ≥ 区块时间戳，不构成有效邀请）；邀请人 A 不获得奖励；`presale_holding(A, referral)` 无新增。

**验证方式**：
```sql
SELECT referrer_user_id, referral_reward_odd
FROM presale_deposit WHERE tx_hash = '<boundary_txHash>';
-- 期望: referrer_user_id IS NULL, referral_reward_odd = '0'

SELECT total_odd FROM presale_holding
WHERE user_id = <A_user_id> AND source = 2;
-- 期望: 不变（无新增）
```

---

### ADV-REF-07 邀请码大小写归一

**触发条件**：调 `POST /referral/bind { code: "0xh7k9x2" }`（小写输入，实际存储为 `"0xH7K9X2"`）。

**期望结果**：后端将输入归一为大写后查询 `user_referral_code`，找到对应记录，bind 成功；`user_referral_bind.referrer_code = '0xH7K9X2'`（大写存储）。

**验证方式**：
```sql
SELECT referrer_code FROM user_referral_bind WHERE user_id = <user_id>;
-- 期望: '0xH7K9X2'（大写）
```

---

### ADV-REF-08 单层邀请（A 邀 B，B 邀 C，C 下单只有 B 拿奖励）

**触发条件**：A 邀 B，B 邀 C，C 下单 deposit 落库。系统按 `user_referral_bind(C).referrer_user_id = B` 查找邀请人，不做多级递归。

**期望结果**：`presale_deposit(C).referrer_user_id = B.user_id`；`presale_holding(B, referral)` 增加；A 的 holding **不变**（单层关系，不递归）。

**验证方式**：
```sql
SELECT referrer_user_id FROM presale_deposit WHERE tx_hash = '<C_txHash>';
-- 期望: B.user_id

SELECT total_odd FROM presale_holding WHERE user_id = <A_user_id> AND source = 2;
-- 期望: 不变（A 不拿奖励）
```

---

### ADV-REF-09 邀请码不存在

**触发条件**：`POST /referral/bind { code: "0xZZZZZZ" }`（随机 8 字符，不存在于 `user_referral_code`）。

**期望结果**：`40404 INVALID_CODE`；`user_referral_bind` 无写入。

**验证方式**：HTTP 响应 `{"code":40404}`；`SELECT COUNT(*) FROM user_referral_bind WHERE user_id=?` = 0。

---

### ADV-REF-10 邀请列表超大翻页

**触发条件**：`GET /api/v1/referral/list?page=99999&size=100`（超大页码，实际无数据）。

**期望结果**：返回空列表 `{list:[], total:N}`；无 panic；无 DB 全表扫描（EXPLAIN 走 `idx_referrer`）。

**验证方式**：SQL `EXPLAIN SELECT ... FROM user_referral_bind WHERE referrer_user_id=? LIMIT 100 OFFSET 9999900` 走索引；响应 `list=[]`。

---

## §DEP 入金对抗

### ADV-DEP-01 双轨竞态：前端 report-tx + Worker 同时入账

**触发条件**：前端 `POST /deposit/report-tx` 和 presale-worker 的 confirm-tx service 在同一 100ms 时间窗内处理同一 `(tx_hash, log_index)`（Goroutine 并发模拟）。

**期望结果**：`uk_(tx_hash, log_index)` DB 唯一索引保证只有 1 条 INSERT 成功，另 1 条走 `INSERT IGNORE` 忽略；两个 Goroutine 都正常返回（不 panic）；`presale_deposit` 只有 1 行；`presale_holding` 只加一次（事务内 upsert）；`presale_round.sold_odd` 只增加一次（INV-1 不破坏）。

**验证方式**：
```sql
SELECT COUNT(*) FROM presale_deposit WHERE tx_hash = '<txHash>' AND log_index = 0;
-- 期望: 1

SELECT sold_odd FROM presale_round WHERE id = 'seed';
-- 期望: 增加了 1 × shares_odd，不是 2 × shares_odd
```

---

### ADV-DEP-02 假 tx_hash（链上不存在）

**触发条件**：`POST /deposit/report-tx { txHash: "0x" + "a"*64 }`（格式合法但链上 `eth_getTransactionReceipt` 返回 null）。

**期望结果**：`40006 INVALID_TX`；无 deposit 写入；RPC 调用有超时兜底（不阻塞主线程 > 5s）。

**验证方式**：HTTP 响应 `{"code":40006}`；`SELECT COUNT(*) FROM presale_deposit WHERE tx_hash=?` = 0。

---

### ADV-DEP-03 链上已 revert 的 tx 上报

**触发条件**：在 Anvil 上构造一笔 `status=failure` 的交易（USDT transfer 但 revert），拿到 txHash 后调 `POST /deposit/report-tx`。

**期望结果**：`40006 INVALID_TX`（`receipt.status ≠ success`）；无 deposit 写入。

**验证方式**：HTTP 响应 `{"code":40006}`；deposit 表无此 tx_hash。

---

### ADV-DEP-04 收款地址不在金库池

**触发条件**：链上 USDT Transfer `to = 0xRANDOM`（不在 `env PRESALE_VAULT_POOL`），前端调 `POST /deposit/report-tx`。

**期望结果**：`40007 TX_NOT_TO_VAULT`；无 deposit 写入；错误码精确（区分于"非 USDT"）。

**验证方式**：HTTP 响应 `{"code":40007}`。

---

### ADV-DEP-05 转账 token 不是 USDT（误转 ETH 或其他 ERC20）

**触发条件**：链上发 ETH transfer（非 ERC20 Transfer 事件），或发其他 ERC20 的 Transfer 事件（`log.address ≠ USDT 合约`），前端调 `POST /deposit/report-tx`。

**期望结果**：`40008 TX_NOT_USDT`；无 deposit 写入；Worker 扫到此类 log 也跳过。

**验证方式**：HTTP 响应 `{"code":40008}`；Worker 日志 `skip: non_usdt log`。

---

### ADV-DEP-06 tx.from ≠ 登录态 EOA（F1 严格匹配 / 智能合约钱包代付）

**触发条件**：用户 A（JWT 绑定 EOA=`0xAAA`）上报一笔 `tx.from = 0xBBB`（另一个钱包，或合约钱包代付）的 txHash。

**期望结果**：`40902 WALLET_MISMATCH`；deposit 落 `anomaly`，`anomaly_reason='from_mismatch'`；同时写入 `presale_ops_event(event_type='from_mismatch')`；Lark 通知运营。

**验证方式**：
```sql
SELECT status, anomaly_reason FROM presale_deposit WHERE tx_hash = '<txHash>';
-- 期望: status='anomaly', anomaly_reason='from_mismatch'

SELECT event_type, eoa_address FROM presale_ops_event WHERE tx_hash = '<txHash>';
-- 期望: event_type='from_mismatch', eoa_address='0xBBB'
```
Lark mock webhook 收到通知。

---

### ADV-DEP-07 前端 2min 禁下单边界（block_timestamp 仍在本轮内）

**触发条件**：轮次 `end_ts = T`；用户在 `T - 90s`（满足前端 2min 禁下单前）签出 MetaMask 交易；`block_timestamp = T - 30s`（链上打包仍在本轮有效时间内）。

**期望结果**：正常按本轮算；5min 容差未触发；`presale_deposit.round_id = <本轮>`；`status='confirmed'`。

**验证方式**：
```sql
SELECT round_id, status FROM presale_deposit WHERE tx_hash = '<txHash>';
-- 期望: round_id='seed', status='confirmed'
```

---

### ADV-DEP-08 5min 容差兜底（block_timestamp 超出本轮但在容差内）

**触发条件**：`block_timestamp = end_ts + 90s`（超出轮次结束 1.5min，在 5min 容差内）；下一轮 `status=active`。

**期望结果**：按下一轮算（5min 容差兜底）；`round_id = <下一轮>`；holding 在下一轮累加；`anomaly_reason` 不触发（正常归轮）。

**验证方式**：
```sql
SELECT round_id, anomaly_reason FROM presale_deposit WHERE tx_hash = '<txHash>';
-- 期望: round_id='strategic', anomaly_reason=NULL
```

---

### ADV-DEP-09 超 5min 容差（late_arrival anomaly）

**触发条件**：`block_timestamp = end_ts + 6min`（超过 5min 容差）；下一轮 active。

**期望结果**：`anomaly_reason='late_arrival'`；进 `presale_ops_event`；Lark 通知；deposit 不归入任何轮次正常计算（由运营走预案脚本处理）。

**验证方式**：
```sql
SELECT status, anomaly_reason FROM presale_deposit WHERE tx_hash = '<txHash>';
-- 期望: status='anomaly', anomaly_reason='late_arrival'

SELECT event_type FROM presale_ops_event WHERE tx_hash = '<txHash>';
-- 期望: event_type='late_arrival'
```

---

### ADV-DEP-10 超额到账（A4 overflow）

**触发条件**：seed 轮 `supply_odd = 10000000`，`sold_odd = 9990000`（剩余 10000 ODD ≈ 300 USDT at 0.03）；用户转入 1000 USDT（对应 33333 ODD，远超剩余）。

**期望结果**：`anomaly_reason='overflow'`；`presale_round.sold_odd` 不超过 `supply_odd`（INV-1 不破坏）；超出部分进 `presale_ops_event(event_type='overflow')`；Lark 推运营群；运营走 `partial_credit` 预案（参见 [E2E-04](e2e-scenarios.md)）。

**验证方式**：
```sql
SELECT sold_odd, supply_odd FROM presale_round WHERE id = 'seed';
-- 期望: sold_odd <= supply_odd

SELECT event_type, amount_usdt FROM presale_ops_event
WHERE event_type = 'overflow' AND tx_hash = '<txHash>';
```

---

### ADV-DEP-11 pause 期间到账（paused_arrival，信息流非阻塞）

**触发条件**：战略轮 `status=paused`；用户在 pause 期间（可能不知道）链上转 USDT 到金库。

**期望结果**：deposit 仍正常落库并最终 `status='confirmed'`（pause 不阻止入账）；`anomaly_reason='paused_arrival'`（仅为信息流标记）；Lark 推运营群，提示"pause 期间有到账"。

**验证方式**：
```sql
SELECT status, anomaly_reason FROM presale_deposit WHERE tx_hash = '<txHash>';
-- 期望: status='confirmed', anomaly_reason='paused_arrival'
```
Lark mock 收到 `paused_arrival` 通知。

---

### ADV-DEP-12 多次小额转账（不合并，每笔独立处理）

**触发条件**：同一用户同一轮次，分 5 次各转 200 USDT（`log_index` 不同，或 5 笔独立 tx）。

**期望结果**：5 条独立 `presale_deposit` 行；每行 `amount_usdt='200'`；holding upsert 5 次（`total_odd` 累加）；`locked_price_avg` 加权计算正确（5 次同价，结果仍为原价）。

**验证方式**：
```sql
SELECT COUNT(*), SUM(amount_usdt) FROM presale_deposit
WHERE user_id = <uid> AND round_id = 'seed' AND status = 'confirmed';
-- 期望: COUNT=5, SUM=1000

SELECT total_odd, invested_usd FROM presale_holding
WHERE user_id = <uid> AND round_id = 'seed' AND source = 1;
-- 期望: invested_usd='1000'
```

---

### ADV-DEP-13 跨多轮迟到 tx（超过任何容差）

**触发条件**：`block_timestamp` 超过当前轮次 `end_ts + 5min`，且下一轮也已 `ended`（多轮切换后才到账）。

**期望结果**：无有效轮次可归；`status='anomaly'`，`anomaly_reason='late_arrival'`（或 `round_mismatch`）；`presale_ops_event` 待运营手动用 `migrate-round.go` 预案脚本指定轮次。

**验证方式**：
```sql
SELECT status, anomaly_reason FROM presale_deposit WHERE tx_hash = '<late_txHash>';
-- 期望: status='anomaly'

SELECT * FROM presale_ops_event WHERE tx_hash = '<late_txHash>';
-- 期望: 有记录，status='pending'
```

---

### ADV-DEP-14 监听器漏块（Worker SIGTERM + 重启游标重放）

**触发条件**：起 5 笔 pending deposit（5 笔独立 tx）；Anvil mine；Worker 处理到第 2 笔时接收 SIGTERM；重启 Worker，从 `presale_event_cursor.last_block_number` 游标重放。

**期望结果**：5 笔全 confirmed，无重复（幂等键 `uk_(tx_hash, log_index)` 保证第 3~5 笔不重复入账）；`presale_round.sold_odd` 正确（= 5 × shares_odd）；游标 `last_block_number` 单调递增。

**验证方式**：
```sql
SELECT COUNT(*) FROM presale_deposit WHERE status = 'confirmed' AND round_id = 'seed';
-- 期望: 5

SELECT sold_odd FROM presale_round WHERE id = 'seed';
-- 期望: 增加了 5 × 单笔 shares_odd（不是 10 × 或 3 ×）
```

---

### ADV-DEP-15 链上重组（已 confirmed 的 deposit 对应 block 被回滚）

**触发条件**：Worker `confirmBlocks = 3`；在 3 块确认期间（`block_number + 2`），Anvil 模拟 reorg（截断到 `block_number - 1`），使该 tx 的 block 被回滚。

**期望结果**：Worker 检测到 `block_hash` 变更（当前块高的 header hash 不匹配）；打 alarm 日志 `reorg detected block=N`；已入库的 deposit 状态标记需人工复核（或写 ops_event alarm）；人工可按 block_number 重放历史。

**验证方式**：日志包含 `reorg detected`；`presale_ops_event` 有 alarm 类型记录（若实现自动检测）；`presale_event_cursor.last_block_number` 回退到安全高度。

---

### ADV-DEP-16 多金库地址池切换（新旧地址并存）

**触发条件**：`PRESALE_VAULT_POOL = ["0xOLD", "0xNEW"]`（两个地址均在监听）；USDT Transfer 打到 `0xOLD`（历史地址）。

**期望结果**：Worker 仍监听 `0xOLD`，正常入账；`presale_deposit.vault_address = '0xOLD'`（快照值）；`presale_event_cursor` 两行（每个地址一条游标），`0xOLD` 游标独立前进。

**验证方式**：
```sql
SELECT vault_address FROM presale_deposit WHERE tx_hash = '<old_vault_tx>';
-- 期望: '0xOLD'

SELECT vault_address, last_block_number FROM presale_event_cursor;
-- 期望: 两行，各自独立 last_block_number
```

---

### ADV-DEP-17 Worker 多实例 Redis leader lock 竞争

**触发条件**：模拟 2 个 Worker 实例同时启动，同时尝试 `SET presale-worker-leader NX EX 30s`；网络分区边缘场景（双实例同时认为自己是 leader 的极端情况）。

**期望结果**：Redis `SET NX` 原子性保证只有 1 个实例成功获得 leader 锁；另 1 个实例退出本轮扫块，打日志 `skip: not leader`；即使两实例都扫到同一 log，幂等键 `uk_(tx_hash, log_index)` 兜底防重复入账。

**验证方式**：`SELECT COUNT(*) FROM presale_deposit WHERE tx_hash=?` = 1（不是 2）；日志有 `skip: not leader`。

---

## §RND 轮次运营对抗

### ADV-RND-01 pause → resume → pause 反复横跳

**触发条件**：operator 对同一轮次连续执行 pause → resume → pause（3 轮）；每次间隔 1s。

**期望结果**：每次状态机正确切换（`active ↔ paused`）；`manual_override = 1` 始终保持；cron 在 `manual_override=1` 时跳过不自动推进；`presale_admin_audit` 有 6 条记录（3 pause + 3 resume）。

**验证方式**：
```sql
SELECT action, created_at FROM presale_admin_audit
WHERE target_type = 'round' AND target_id = 'strategic'
ORDER BY created_at;
-- 期望: pause, resume, pause, resume, pause, resume (6条)

SELECT status, manual_override FROM presale_round WHERE id = 'strategic';
-- 期望: 最终 status='paused'（最后一次是 pause）, manual_override=1
```
cron 日志：`skip round=strategic: manual_override=1`。

---

### ADV-RND-02 reopen ended 轮次后再次售罄

**触发条件**：种子轮已 `status=ended`；运营 reopen（`status=active, manual_override=1`）；大客户下单使 `sold_odd ≥ supply_odd`（再次售罄）。

**期望结果**：cron 因 `manual_override=1` 不自动推 ended；轮次仍 `status=active`（需运营显式 `POST .../close`）；`sold_odd = supply_odd`（不超，INV-1 不破坏）；超额部分进 anomaly（overflow）。

**验证方式**：
```sql
SELECT status, manual_override, sold_odd, supply_odd
FROM presale_round WHERE id = 'seed';
-- 期望: status='active', manual_override=1, sold_odd <= supply_odd
```
cron 日志：`skip round=seed: manual_override=1`。

---

### ADV-RND-03 改 referral_reward_pct 不影响历史 deposit

**触发条件**：`PATCH /admin/presale/rounds/seed/referral-pct { referralRewardPct:"15.0000" }`；改后新 deposit 入账；同时验证历史已入账 deposit 的快照值。

**期望结果**：历史 deposit 的 `referral_reward_pct = '10.0000'`（快照值不变）；新 deposit 的 `referral_reward_pct = '15.0000'`；`GET /referral/list` 按笔展示各自 pct（逐笔独立，不合并）。

**验证方式**：
```sql
SELECT id, referral_reward_pct, created_at FROM presale_deposit
WHERE round_id = 'seed' ORDER BY created_at;
-- 期望: 旧行 '10.0000'，新行 '15.0000'
```

---

### ADV-RND-04 TGE 改期不联动 round 时间窗

**触发条件**：`PATCH /admin/presale/config { tgeTs: <新时间戳> }`。

**期望结果**：`presale_config.tge_ts` 更新；所有 `presale_round` 的 `start_ts / end_ts` 不变（解耦设计）；运营如需同步改 round 时间窗，必须单独 `PATCH /admin/presale/rounds/:id { endTs: ... }`。

**验证方式**：
```sql
SELECT tge_ts FROM presale_config WHERE id = 1;
-- 期望: 已更新为新值

SELECT id, start_ts, end_ts FROM presale_round;
-- 期望: 所有轮次时间窗不变
```

---

### ADV-RND-05 多轮同时 active（reopen 种子轮 + 战略轮 active）

**触发条件**：战略轮 `status=active`；运营 reopen 种子轮（`status=active, manual_override=1`）；用户发 USDT Transfer，`block_timestamp` 在两个轮次时间窗重叠区。

**期望结果**：系统允许多轮同时 active；Worker 按 `block_timestamp` 严格归轮（先找 active 轮次中时间窗覆盖该 block_timestamp 的轮次）；若时间窗有歧义（两轮都覆盖），按轮次 `sort_order` 较小（优先级较高）的轮次归入。

**验证方式**：
```sql
SELECT status FROM presale_round WHERE status = 'active';
-- 期望: 两行（seed + strategic）

SELECT round_id FROM presale_deposit WHERE tx_hash = '<overlap_txHash>';
-- 期望: 符合时间窗逻辑的轮次
```

---

### ADV-RND-06 cron 不推进 manual_override=1 的轮次

**触发条件**：轮次 `manual_override=1`，`now ≥ end_ts`（按时间应该自动 ended）；cron 下一个 5min 周期触发。

**期望结果**：cron 跳过该轮次（`manual_override=1`，不自动推进）；`presale_round.status` 不变；日志 `skip round=seed: manual_override=1`。

**验证方式**：cron 日志包含 `skip`；SQL `SELECT status FROM presale_round WHERE id='seed'` 状态不变。

---

### ADV-RND-07 PATCH supply 低于 sold_odd

**触发条件**：`PATCH /admin/presale/rounds/seed { supplyOdd:"1000000" }`，但当前 `sold_odd = 2000000`（supply < sold 阻断）。

**期望结果**：`40011 INVALID_TARGET_ROUND`；`presale_round.supply_odd` 不变。

**验证方式**：HTTP 响应 `{"code":40011}`；`SELECT supply_odd FROM presale_round WHERE id='seed'` 不变。

---

### ADV-RND-08 并发 pause 同一轮次

**触发条件**：2 个 operator 同时调 `POST /admin/presale/rounds/strategic/pause`（并发 goroutine 模拟）。

**期望结果**：DB 行锁保证只有 1 次状态变更生效；第 2 次调用返 `40901 INVALID_STATE_TRANSITION`（pause 已 paused 的轮次）或两次都 200（幂等）；`presale_admin_audit` 仅有 1 条 pause 记录（不重复）。

**验证方式**：
```sql
SELECT COUNT(*) FROM presale_admin_audit
WHERE action='pause' AND target_id='strategic';
-- 期望: 1
```

---

## §ADM Admin 对抗

| ID | 触发条件 | 期望结果 | 验证方式 |
|---|---|---|---|
| ADV-ADM-01 | `customer_service` 角色调 `PATCH /admin/presale/rounds/:id`（需 super_admin） | `40301 INSUFFICIENT_ROLE`；round 无变化 | HTTP code=40301；SQL: round 字段不变 |
| ADV-ADM-02 | `customer_service` 角色调 `POST /admin/presale/rounds/:id/pause`（需 operator+） | `40301 INSUFFICIENT_ROLE` | HTTP code=40301 |
| ADV-ADM-03 | `finance` 角色调任何 presale mutate 接口（本期 finance 无预售 grant） | `40301 INSUFFICIENT_ROLE` for all mutate paths | HTTP code=40301 for 全部 17 个接口的 mutate 子集 |
| ADV-ADM-04 | 直接对 `presale_admin_audit` 执行 `UPDATE` / `DELETE`（DBA 误操作或 SQL 注入绕过） | DB 层只授 INSERT 权限；`Access denied`；应用层从不发出此类语句 | `SHOW GRANTS FOR 'app_user'@'%'` 无 UPDATE/DELETE on audit 表；直连 DB 执行返错 |
| ADV-ADM-05 | `migrate-round` 目标轮次 `block_timestamp` 不在时间窗内（超 5min 容差） | `42201 BLOCK_TIMESTAMP_NOT_IN_TARGET_ROUND`；deposit 不被迁移 | HTTP code=42201；SQL: deposit `round_id` 不变 |
| ADV-ADM-06 | `pause` 已 `status=ended` 的轮次 | `40901 INVALID_STATE_TRANSITION` | HTTP code=40901 |
| ADV-ADM-07 | mutate 接口 `note` 字段空或 < 10 字符 | `40010 NOTE_REQUIRED`；操作不执行；audit 无新行 | HTTP code=40010；audit 行数不变 |
| ADV-ADM-08 | `PATCH /config { vaultAddress:"0xZZZ" }`（格式非法） | `40012 VAULT_ADDRESS_INVALID` | HTTP code=40012；`presale_config.vault_address` 不变 |
| ADV-ADM-09 | 改 `vault_address` 为合法新地址后未重启 Worker | 响应包含 warning 提示；Worker 仍监听老地址；新 deposit 到老地址正常入账 | 响应 `warning` 非空；Worker 日志仍 `listening vault=0xOLD` |
| ADV-ADM-10 | 直接访问 web-api `/admin/presale/*`（presale admin 全在 admin-backend） | web-api 无此路由，返 404 | HTTP 404；web-api 路由表无 `/admin/presale/*` |

---

## §INV 不变量断言（全量 SQL 验证）

> 参见 [01-data-model.md §5](../01-data-model.md)。每次对账 cron 后验证，全回归必跑。

| ID | 不变量 | 验证 SQL（返空 = 通过） |
|---|---|---|
| ADV-INV-01 | INV-1：`sold_odd ≤ supply_odd` | `SELECT id FROM presale_round WHERE sold_odd > supply_odd` |
| ADV-INV-02 | INV-2：`Σ holding(invest,R) = round.sold_odd` | `SELECT r.id, r.sold_odd - COALESCE(SUM(h.total_odd),0) diff FROM presale_round r LEFT JOIN presale_holding h ON h.round_id=r.id AND h.source=1 GROUP BY r.id HAVING ABS(diff) > 0.000001` |
| ADV-INV-03 | INV-3：`uk_(tx_hash, log_index)` 全局唯一 | `SELECT tx_hash, log_index, COUNT(*) c FROM presale_deposit GROUP BY tx_hash, log_index HAVING c > 1` |
| ADV-INV-04 | INV-4：每 user 最多 1 条 bind | `SELECT user_id, COUNT(*) c FROM user_referral_bind GROUP BY user_id HAVING c > 1` |
| ADV-INV-05 | INV-5：邀请码全局唯一 | `SELECT code, COUNT(*) c FROM user_referral_code GROUP BY code HAVING c > 1` |
| ADV-INV-06 | INV-6：有效邀请 `bound_at < block_timestamp` | `SELECT d.id FROM presale_deposit d JOIN user_referral_bind b ON b.user_id=d.user_id WHERE d.referrer_user_id IS NOT NULL AND b.bound_at >= d.block_timestamp` |
| ADV-INV-07 | INV-7：`referral_reward_odd = shares_odd × pct / 100` | `SELECT id FROM presale_deposit WHERE referrer_user_id IS NOT NULL AND ABS(referral_reward_odd - shares_odd * referral_reward_pct / 100) > 0.000001` |
| ADV-INV-08 | INV-8：`holding.locked_price_avg` 加权正确；referral 行恒 0 | 单元测试：多笔 deposit upsert 后断言公式精度 ≤ 1e-10；referral source 行 `locked_price_avg=0` |

---

## 执行约定

- 每个用例对应 `.go` 测试文件，命名 `adversarial_<topic>_<seq>_test.go`，`-tags=adversarial`
- 失败案例录 trace（DB 状态 + 日志 + tx hash），写到 `tests/adversarial/failures/`
- **Gate 通过线**：邀请系统对抗在 B1 gate 100% 通过；入金对抗在 B2 gate 100% 通过；轮次 + Admin 对抗在 B3 gate 100% 通过；INV 断言每 batch 全量跑
- 无 V3 残留（严禁出现 `presale_order`、`vesting`、`claim`、`EIP-191`、`hot_wallet`、`ODD 价格抓取` 相关断言）
