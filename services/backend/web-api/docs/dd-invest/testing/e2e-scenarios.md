# E2E 业务流测试（V3 · 模型 B）

> 契约源真值：[02-api-contract.md](../02-api-contract.md)（用户接口）、[03-admin-api-contract.md](../03-admin-api-contract.md)（admin 接口）、[01-data-model.md §4](../01-data-model.md)（状态机）。
> V3 砍掉：`presale_order`、vesting cron、claim、EIP-191、热钱包、ODD 价格抓取。无 pending/expired/mismatch 订单中间态。
> 用例 ID 格式：`E2E-<seq>`。

## 执行框架

```
tests/e2e/
├── setup.go        — 起 Anvil / MySQL / Redis / 部署 mock USDT 合约
├── harness.go      — 封装 HTTP client（带 JWT）+ 链上发 USDT.transfer 工具函数
└── e2e_*_test.go   — 各场景
```

跑：`go test ./tests/e2e/... -count=1 -timeout 15m -tags=e2e`

CI 独立 job，不阻塞单测；本地手动跑。

---

## E2E-01 · 正常入账完整链路（Happy Path）

**参与者**：用户 / presale-worker

**前置**：B0 + B1 + B2 已交付；seed 轮 `status=active`；`min_subscribe_usd=1000`

**步骤序列**

| 步 | 操作 | 参与者 |
|---|---|---|
| 1 | 注册 + 连钱包，拿 JWT；系统自动生成邀请码（`INSERT IGNORE user_referral_code`） | 用户 |
| 2 | `GET /api/v1/presale/config` → 取 seed 轮价格 `0.03`、金库地址 | 用户 |
| 3 | `POST /api/v1/referral/bind { code: "<邀请人 code>", source: "link", business: "presale" }` | 用户 |
| 4 | 前端校验：`round.status=active`、金额 ≥ 1000、距 `end_ts` ≥ 2min；弹 MetaMask | 用户 |
| 5 | 链上 `USDT.transfer(vault, 1000)`；Anvil mine 1 个块；拿 `txHash` | 用户 |
| 6 | `POST /api/v1/presale/deposit/report-tx { txHash, expectedRoundId:"seed", expectedAmountUsdt:"1000" }` | 用户 |
| 7 | 后端查 receipt，校验 from/to/token；INSERT `presale_deposit(status='pending', source='frontend')` | web-api |
| 8 | presale-worker 扫块，confirm-tx service 执行幂等 INSERT（uk 冲突，忽略）；等 ≥ 3 块确认 | Worker |
| 9 | Worker 推进 `status: pending → confirmed`；UPSERT `presale_holding` | Worker |
| 10 | 用户轮询 `GET /api/v1/presale/deposit/:txHash`，取到 `status='confirmed'` | 用户 |
| 11 | `GET /api/v1/presale/position` → 核对持仓 | 用户 |

**期望状态**

| 字段 | 期望值 |
|---|---|
| `presale_deposit.status` | `confirmed` |
| `presale_deposit.shares_odd` | `33333.333333...`（1000 / 0.03） |
| `presale_deposit.referral_reward_odd` | `3333.333...`（shares × 10%） |
| `presale_round(seed).sold_odd` | 增加 33333.33 |
| `presale_round(seed).raised_usd` | 增加 1000 |
| `presale_holding(user, seed, source=invest).total_odd` | 33333.33 |
| `presale_holding(referrer, seed, source=referral).total_odd` | 3333.33 |

**验证 SQL**

```sql
-- 入账确认
SELECT status, shares_odd, referral_reward_odd
FROM presale_deposit WHERE tx_hash = '<txHash>';

-- 持仓对账（INV-2）
SELECT r.id, r.sold_odd, SUM(h.total_odd) AS holding_sum
FROM presale_round r
JOIN presale_holding h ON h.round_id = r.id AND h.source = 1
WHERE r.id = 'seed'
GROUP BY r.id;

-- 邀请奖励
SELECT total_odd FROM presale_holding
WHERE user_id = <referrer_id> AND round_id = 'seed' AND source = 2;
```

---

## E2E-02 · 边界切轮兜底（5min 容差 + 预案）

**参与者**：用户 / presale-worker / 运营

**前置**：seed 轮 `end_ts = T`；strategic 轮 `start_ts = T`；两轮无空窗

**步骤序列**

| 步 | 操作 | 参与者 |
|---|---|---|
| 1 | 用户在 `T - 90s`（满足前端 2min 禁下单前）弹出 MetaMask，签出交易 | 用户 |
| 2 | 链上 tx 在 `T + 90s` 才被打包（网络拥堵）；`block_timestamp = T + 90s` | 链上 |
| 3 | Worker 扫到 log；找轮次：`block_timestamp = T + 90s`，seed `end_ts = T`，差值 90s < 5min 容差 | Worker |
| 4 | 按 strategic 轮算（下一轮 active）；deposit `round_id='strategic'` | Worker |
| 5 | 用户 `report-tx` 携带 `expectedRoundId='seed'` → 与实际 `'strategic'` 不符 → `anomaly_reason='round_mismatch'` 附加记录 + Lark 通知（但 deposit 正常 confirmed） | web-api |
| 6 | 用户投诉"我明明在种子轮付款" → 运营查 `GET /admin/presale/deposits/:txHash` 核实 | 运营 |
| 7 | 运营 `POST /admin/presale/deposits/:txHash/migrate-round { targetRoundId:"seed", note:"用户边界切轮..." }` | 运营 |
| 8 | migrate-round 校验 `block_timestamp ∈ [seed.start_ts, seed.end_ts + 5min]`（成立）；重算 shares_odd 用 seed 价格；更新 holding | admin-backend |

**期望状态（migrate 后）**

| 字段 | 期望值 |
|---|---|
| `presale_deposit.round_id` | `seed` |
| `presale_deposit.price_usd` | `0.03`（seed 价格） |
| `presale_deposit.shares_odd` | 按 seed 价重算 |
| `presale_admin_audit.action` | `migrate_round_id` |
| strategic 轮 holding | 回滚（减去原来的量） |
| seed 轮 holding | 新增（加入本笔） |

**验证 SQL**

```sql
-- 迁移后 deposit
SELECT round_id, price_usd, shares_odd FROM presale_deposit WHERE tx_hash = '<txHash>';

-- audit 记录
SELECT action, before_json, after_json FROM presale_admin_audit
WHERE target_type = 'deposit' AND target_id = '<txHash>'
ORDER BY created_at DESC LIMIT 1;

-- 旧轮次 holding 已回滚
SELECT total_odd FROM presale_holding
WHERE user_id = <uid> AND round_id = 'strategic' AND source = 1;
```

---

## E2E-03 · 邀请关系完整链路（A 邀 B → B 下单 → A 拿奖励）

**参与者**：用户 A（邀请人）/ 用户 B（被邀请人）

**步骤序列**

| 步 | 操作 | 参与者 |
|---|---|---|
| 1 | A 登录，`GET /referral/me` 取 `myCode='0xABC123'` + `shareLink` | A |
| 2 | A 把 shareLink 发给 B | A |
| 3 | B 打开 shareLink，URL 携带 `?ref=0xABC123`，LocalStorage 存意图 | B |
| 4 | B 连钱包登录（JWT）；前端读 LocalStorage，自动 `POST /referral/bind { code:"0xABC123", source:"link" }` | B |
| 5 | B `GET /config` 取 seed 轮；链上 `USDT.transfer(vault, 500)` | B |
| 6 | B `POST /deposit/report-tx { txHash, expectedRoundId:"seed", expectedAmountUsdt:"500" }` | B |
| 7 | Worker 确认；B 的 deposit `referrer_user_id = A.user_id`，`referral_reward_odd = shares_odd × 10%` | Worker |
| 8 | A `GET /referral/list` → 看到 B 的 deposit 记录 + 奖励 ODD | A |
| 9 | A `GET /referral/me` → `stats.invitedCount=1`，`totalRewardOdd` 增加 | A |
| 10 | A `GET /position` → holding(source=referral) 有增量 | A |

**期望状态**

| 字段 | 期望值 |
|---|---|
| `presale_deposit(B).referrer_user_id` | A.user_id |
| `presale_deposit(B).referral_reward_odd` | `B.shares_odd × 10% / 100` |
| `presale_holding(A, seed, source=2).total_odd` | = B 的 referral_reward_odd |
| `GET /referral/list` A | 列表包含 B，deposit 金额 / 奖励正确 |

**验证 SQL**

```sql
-- 邀请绑定时间戳必须 < block_timestamp（INV-6）
SELECT b.bound_at, d.block_timestamp
FROM user_referral_bind b
JOIN presale_deposit d ON d.user_id = b.user_id
WHERE b.user_id = <B_user_id>;

-- A 的 referral holding
SELECT total_odd FROM presale_holding
WHERE user_id = <A_user_id> AND source = 2 AND round_id = 'seed';
```

---

## E2E-04 · 超额到账预案（overflow anomaly）

**参与者**：用户 / 运营

**前置**：seed 轮 `supply_odd = 10000000`，`sold_odd = 9990000`，剩余 10000 ODD（≈ 300 USDT at 0.03）

**步骤序列**

| 步 | 操作 | 参与者 |
|---|---|---|
| 1 | 用户链上转 1000 USDT（对应 33333 ODD，远超剩余 10000） | 用户 |
| 2 | Worker 确认到账；计算 `shares_odd=33333 > 剩余 10000` | Worker |
| 3 | deposit 落 `anomaly_reason='overflow'`；`presale_round.sold_odd` 不超 `supply_odd`（INV-1） | Worker |
| 4 | `presale_ops_event(event_type='overflow', status='pending')` 写入；Lark Webhook 推运营群 | Worker |
| 5 | 运营收到 Lark 通知，查 `GET /admin/presale/anomaly/:id` 核实金额 | 运营 |
| 6 | 运营决策：本轮按剩余 300 USDT 算；超出 700 USDT 转入下一轮（或退款链下处理） | 运营 |
| 7 | 运营 `POST /admin/presale/anomaly/:id/resolve { resolution:"partial_credit", targetRoundId:"strategic", note:"..." }` | 运营 |
| 8 | `presale_ops_event.status = resolved`；audit 写入 | admin-backend |

**期望状态**

| 字段 | 期望值 |
|---|---|
| `presale_round(seed).sold_odd` | ≤ `supply_odd`（不超） |
| `presale_ops_event.status` | `resolved`（处理后） |
| `presale_admin_audit.action` | `anomaly_resolve` |
| Lark mock | 收到 overflow 通知 |

**验证 SQL**

```sql
-- INV-1 不变量
SELECT id, sold_odd, supply_odd FROM presale_round
WHERE sold_odd > supply_odd;  -- 空

-- anomaly 处理
SELECT status, resolved_by, resolve_note FROM presale_ops_event
WHERE event_type = 'overflow' AND deposit_id = <deposit_id>;
```

---

## E2E-05 · 无主转账确认（用户绕前端直转）

**参与者**：用户（链外操作）/ presale-worker / 运营 / 客服

**步骤序列**

| 步 | 操作 | 参与者 |
|---|---|---|
| 1 | 用户直接从交易所提 USDT 到金库地址（`tx.from` 为交易所热钱包，非系统已知 EOA） | 用户 |
| 2 | Worker 扫到 Transfer 事件；查 `user` 表找不到 `eoa_address = tx.from` | Worker |
| 3 | deposit 落 `anomaly_reason='unclaimed'`（from_mismatch 的特例：EOA 完全不在系统） + `presale_ops_event` | Worker |
| 4 | Lark 推送运营群，包含 `tx_hash / amount / from_eoa` | Worker |
| 5 | 客服联系用户，确认用户身份（用户提供自己的 EOA） | 客服 |
| 6 | 运营 `POST /admin/presale/anomaly/:id/resolve { resolution:"convert_to_deposit", targetRoundId:"seed", note:"用户 EOA=0x...，交易所代付确认" }` | 运营 |
| 7 | 系统创建 deposit 行，绑到对应 user；holding 更新 | admin-backend |

**期望状态**

| 字段 | 期望值 |
|---|---|
| `presale_ops_event.event_type` | `unclaimed` |
| Lark mock | 收到 unclaimed 通知，含 tx_hash 和金额 |
| resolve 后 deposit | `status='confirmed'`；绑到正确 user |
| audit | `action='anomaly_resolve'`，`source='api'` |

**验证 SQL**

```sql
SELECT event_type, tx_hash, amount_usdt, status
FROM presale_ops_event WHERE event_type = 'unclaimed';

-- resolve 后
SELECT status, user_id, round_id FROM presale_deposit
WHERE tx_hash = '<unclaimed_txHash>';
```

---

## E2E-06 · 金库切换演练（多地址池）

**参与者**：运营 / 系统管理员 / presale-worker

**步骤序列**

| 步 | 操作 | 参与者 |
|---|---|---|
| 1 | 当前金库 `0xOLD`；`PRESALE_VAULT_POOL=["0xOLD"]` | 初始状态 |
| 2 | 运营 `PATCH /admin/presale/config { vaultAddress:"0xNEW", note:"切换到新多签地址" }` | 运营 |
| 3 | 响应包含 warning：需同步 env + 重启 Worker | admin-backend |
| 4 | Ops 更新 env：`PRESALE_VAULT_POOL=["0xOLD","0xNEW"]`；重启 presale-worker | 运营 |
| 5 | Worker 重启后从 `presale_event_cursor` 各地址独立游标继续监听（`0xOLD` 和 `0xNEW` 各一条游标） | Worker |
| 6 | 有 USDT Transfer 打到 `0xOLD`（老用户旧收藏地址）→ Worker 仍监听 `0xOLD`，正常入账 | 链上 |
| 7 | 有 USDT Transfer 打到 `0xNEW`（前端展示新地址）→ Worker 监听 `0xNEW`，正常入账 | 链上 |
| 8 | `GET /config` 返回 `vault.depositAddress = "0xNEW"`（前端付款地址已更新） | 用户 |

**期望状态**

| 字段 | 期望值 |
|---|---|
| `presale_event_cursor` | 两行：`vault_address='0xOLD'` + `vault_address='0xNEW'` |
| 老地址 deposit | `vault_address='0xOLD'`（快照），正常 confirmed |
| 新地址 deposit | `vault_address='0xNEW'`，正常 confirmed |
| `presale_config.vault_address` | `0xNEW` |

**验证 SQL**

```sql
-- 游标双轨
SELECT vault_address, last_block_number FROM presale_event_cursor;

-- 老地址 deposit 仍正常入账
SELECT vault_address, status FROM presale_deposit
WHERE vault_address = '0xOLD' ORDER BY created_at DESC LIMIT 5;
```

---

## E2E-07 · Pause + Reopen 全周期

**参与者**：运营 / 用户

**步骤序列**

| 步 | 操作 | 参与者 |
|---|---|---|
| 1 | 战略轮 `status=active`；运营 `POST /admin/presale/rounds/strategic/pause { note:"..." }` | 运营 |
| 2 | 响应：`{ previousStatus:"active", currentStatus:"paused", manualOverride:true }` | admin-backend |
| 3 | cron 下一个周期（5min）：战略轮 `manual_override=1`，cron 跳过不自动推进 | cron |
| 4 | 暂停期间链上有 USDT 打到金库 → deposit 入账 `anomaly_reason='paused_arrival'`（信息流，非阻塞）+ Lark 通知 | Worker |
| 5 | 种子轮 reopen（大客户回补）：`POST /admin/presale/rounds/seed/reopen { note:"..." }`；seed `status=active, manual_override=1` | 运营 |
| 6 | 大客户在 seed 轮下单 10000 USDT → 正常入账 confirmed | 用户 |
| 7 | 运营 close seed 轮：`POST /admin/presale/rounds/seed/close`；seed `status=ended` | 运营 |
| 8 | 运营 resume 战略轮：`POST /admin/presale/rounds/strategic/resume`；strategic `status=active` | 运营 |

**期望状态**

| 步骤 | 字段 | 期望值 |
|---|---|---|
| 步 2 | `presale_round(strategic).status` | `paused` |
| 步 3 | cron 日志 | `skip round=strategic: manual_override=1` |
| 步 4 | `presale_deposit.anomaly_reason` | `paused_arrival`（仍 confirmed） |
| 步 5 | `presale_round(seed).status` | `active`，`manual_override=1` |
| 步 7 | `presale_round(seed).status` | `ended` |
| 步 8 | `presale_round(strategic).status` | `active` |
| audit | `presale_admin_audit` 行数 | 5 条（pause + reopen + 大客户单 + close + resume） |

**验证 SQL**

```sql
-- 状态机流水
SELECT action, target_id, created_at FROM presale_admin_audit
WHERE target_type = 'round'
ORDER BY created_at;

-- paused_arrival deposit 仍 confirmed
SELECT status, anomaly_reason FROM presale_deposit
WHERE round_id = 'strategic' AND anomaly_reason = 'paused_arrival';
```

---

## 验收矩阵

| Batch Gate | 必跑用例 | 可选 |
|---|---|---|
| B1 gate | E2E-03（邀请链路） | — |
| B2 gate | E2E-01（正常入账）、E2E-02（边界切轮）、E2E-04（超额）、E2E-05（无主转账）、E2E-06（金库切换） | — |
| B3 gate | E2E-07（pause + reopen） | — |
| 全回归 | E2E-01 ~ E2E-07 全部 | INV-1~8 SQL 对账全通过 |

**全量验收条件**：

- 所有 e2e 用例 pass，总耗时 < 15min
- INV-1~8 SQL 对账全部返空（无违规行）
- Lark mock webhook 在对应场景收到通知
- `presale_admin_audit` 无遗漏条目
