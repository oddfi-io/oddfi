# 欧冠 5 分钟 Mock 赛事结算方案

## 1. 文档定位

本文档用于把 `prd.md` 中的欧冠 5 分钟一轮 mock 结算需求，整理成后端可评审、可开发、可联调、可上线检查的落地方案。

目标是上线 1 场欧冠市场 mock 比赛：`葡萄牙 vs 阿根廷`。用户在前端看到的是一场欧冠赛事，下注走真实 `web-api` 账户和下注接口，市场数据走真实 `oddfi-web-api` 查询接口，结算走真实 `oddfi-bet-settle` worker，资金承接到 `user_balance.claimable_balance`。

核心原则：

- 不绕过真实下注链路。
- 不新增复杂业务表。
- 不把 mock 做成前端孤立假数据。
- 不重写 `JudgeBet` 盘口判定逻辑。
- mock 只负责生成可下注赛事、盘口、5 分钟轮次状态和随机比分。

## 2. 总体结论

本需求推荐按数据库真链路落地，而不是只在接口内存中返回 mock JSON。

原因是用户体验链路必须闭环：

```text
oddfi_fixtures
  -> oddfi_odds
  -> web-api /account/bet_place
  -> user_bet_holding
  -> oddfi_fixture_results
  -> oddfi-bet-settle worker
  -> user_balance.bet_lock_balance / claimable_balance
  -> web-api /account/bet_holding /account/bet_claim
```

如果只改 `oddfi-web-api` 返回 JSON，前端能看到比赛，但 `web-api` 下单时仍会按 `odd_id -> oddfi_odds -> oddfi_fixtures` 校验，最终会出现“看得到但下不了单”或“下注后无法结算”的断链问题。

## 3. 四服务改动结论

| 服务 | 是否改动 | 结论 | 最小改动点 |
| --- | --- | --- | --- |
| `oddfi-bet-settle` | 必改 | 负责 mock 轮次状态机和自动结算 | 新增 mock 常量、5 分钟 loop、封盘、随机比分、复用现有 `settleMatch` |
| `web-api` | 必改 | 负责真实下注、余额锁仓、持仓和 claim | 修复盘口校验失败仍建单问题；服务端归一化 `market/label/handicap_line`；余额响应补 `claimable_balance` |
| `oddfi-web-api` | 必改 | 负责市场数据下发 | 从 MySQL 下发 mock fixture 和 15 条赔率；返回 `enable_bet` 和 mock 倒计时信息 |
| `oddfi-web-spider` | 原则上不改 | 继续采集真实赛事，mock 数据不由 spider 覆盖 | 上线 SOP 明确 mock fixture 由 seed 和 settlement worker 维护，不加入 SportMonks 抓取列表 |

## 4. 为什么把结算 loop 放在 worker

`prd.md` 写的是：

- `MockMatches` 放 `internal/service/mock_data.go`
- `StartMockSettleLoop` 放 `internal/service/mock_settle.go`
- `cmd/server/main.go` 启动时 `go StartMockSettleLoop()`

结合当前代码，推荐做一个工程化微调：

| PRD 位置 | 推荐位置 | 原因 |
| --- | --- | --- |
| `internal/service/mock_data.go` | 保持 | mock 常量和盘口表是纯业务数据，适合放 service |
| `internal/service/mock_settle.go` | 调整为 `cmd/worker/mock_ucl.go` 或 worker 包内文件 | 当前 DB 事务、锁注单、资金落账都在 `cmd/worker/worker.go`，mock 结算需要复用 `settleMatch` 和 `updateFixtureSettlement` |
| `cmd/server/main.go` | 保持启动入口 | 当前服务本身就是后台 worker 入口 |

这样做可以避免把 DB 事务逻辑复制到 `internal/service`，减少重复实现和资金风险。

## 5. Mock 活动规则

| 字段 | 值 |
| --- | --- |
| `activity_id` | `UCL_MOCK_5MIN` |
| `market_group` | `欧冠 / UEFA Champions League` |
| `league_id` | `2` |
| `fixture_id` | `99200001`，建议固定高位 ID，避免碰撞 SportMonks 真实 ID |
| `settle_period_sec` | `300` |
| `bet_open_sec` | `0-240` |
| `bet_close_sec` | `240` |
| `settle_at_sec` | `300` |
| `score_random_range` | 主客比分独立 `rand.Intn(5)`，范围 `[0,4]` |
| `loop` | `true` |

轮次时间建议复用现有字段：

- `oddfi_fixtures.starting_at` 表示本轮封盘时间。
- `starting_at + 60s` 表示本轮结算时间。
- 下一轮结算完成后把 `starting_at` 更新为 `now + 240s`。

这样不新增 round 表，也能让现有 `web-api` 的“开赛后拒单”逻辑自然复用。

## 6. 盘口表

固定 1 场赛事，15 个投注选项：

| odd_id | market | market_id | line | label | selection | odds |
| --- | --- | ---: | --- | --- | --- | ---: |
| `9920000101` | `1x2` | `1` | `0` | `1` | `Home` | `2.10` |
| `9920000102` | `1x2` | `1` | `0` | `X` | `Draw` | `3.40` |
| `9920000103` | `1x2` | `1` | `0` | `2` | `Away` | `3.20` |
| `9920000104` | `handicap` | `6` | `-0.5` | `1` | `Home` | `1.95` |
| `9920000105` | `handicap` | `6` | `+0.5` | `2` | `Away` | `1.85` |
| `9920000106` | `handicap` | `6` | `-1.0` | `1` | `Home` | `2.50` |
| `9920000107` | `handicap` | `6` | `+1.0` | `2` | `Away` | `1.55` |
| `9920000108` | `handicap` | `6` | `-1.5` | `1` | `Home` | `3.10` |
| `9920000109` | `handicap` | `6` | `+1.5` | `2` | `Away` | `1.35` |
| `9920000110` | `overunder` | `7` | `1.5` | `over` | `Over` | `1.40` |
| `9920000111` | `overunder` | `7` | `1.5` | `under` | `Under` | `2.85` |
| `9920000112` | `overunder` | `7` | `2.5` | `over` | `Over` | `1.90` |
| `9920000113` | `overunder` | `7` | `2.5` | `under` | `Under` | `1.90` |
| `9920000114` | `overunder` | `7` | `3.5` | `over` | `Over` | `2.70` |
| `9920000115` | `overunder` | `7` | `3.5` | `under` | `Under` | `1.45` |

注意事项：

- 让球盘按投注方视角写入 `handicap_line`：主队让球为负，客队受让为正；当前 `JudgeBet` 采用“投注方差值 + handicap_line”的判断方式。
- `oddfi_odds.label` 必须对齐 SportMonks 原始格式：只放 `Home / Draw / Away / Over / Under`，让球数值放 `handicap`，大小球数值放 `total`；`web-api` 落单后会统一归一成 `1 / x / 2 / over / under` 存入 `user_bet_holding.label`。
- 大小球方向在 `user_bet_holding.label` 中保存 `over / under`，盘口线保存在 `handicap_line`。
- 整数让球 `-1.0` 有 PUSH，PUSH 派彩为本金 `90%`。

## 7. 表数据构造

### 7.1 `oddfi_fixtures`

最小字段：

```sql
INSERT INTO oddfi_fixtures
  (id, league_id, name, starting_at, starting_at_timestamp, state_id,
   stage_id, season_id,
   home_team_id, home_team_name, home_team_logo, home_team_country_id,
   home_team_meta_location, home_type, home_team_meta_winner, home_team_short_code,
   away_team_id, away_team_name, away_team_logo, away_team_country_id,
   away_team_meta_location, away_type, away_team_meta_winner, away_team_short_code,
   has_odds, created_at, updated_at)
VALUES
  (99200001, 2, '葡萄牙 vs 阿根廷',
   DATE_ADD(NOW(), INTERVAL 240 SECOND), UNIX_TIMESTAMP(DATE_ADD(NOW(), INTERVAL 240 SECOND)), 1,
   992001, 992001,
   992101, '葡萄牙', '', 20,
   'home', 'national', 0, 'POR',
   992102, '阿根廷', '', 44,
   'away', 'national', 0, 'ARG',
   1, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE
  league_id = VALUES(league_id),
  name = VALUES(name),
  starting_at = VALUES(starting_at),
  starting_at_timestamp = VALUES(starting_at_timestamp),
  state_id = 1,
  has_odds = 1,
  updated_at = NOW(3);
```

### 7.2 `oddfi_fixture_results`

开盘态：

```sql
INSERT INTO oddfi_fixture_results
  (fixture_id, state_id, state_code, state_name,
   home_score_full, away_score_full, home_score_half, away_score_half,
   home_score_extra, away_score_extra, home_score_penalty, away_score_penalty,
   raw_score_data, raw_state_data, settlement_status, remark, created_at, updated_at)
VALUES
  (99200001, 1, 'NS', 'Not Started',
   0, 0, 0, 0,
   NULL, NULL, NULL, NULL,
   JSON_ARRAY(), JSON_OBJECT('id', 1, 'state', 'NS', 'name', 'Not Started'),
   'PENDING', '', NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE
  state_id = VALUES(state_id),
  state_code = VALUES(state_code),
  state_name = VALUES(state_name),
  home_score_full = 0,
  away_score_full = 0,
  raw_score_data = JSON_ARRAY(),
  raw_state_data = VALUES(raw_state_data),
  settlement_status = 'PENDING',
  remark = '',
  updated_at = NOW(3);
```

结算瞬间由 worker 更新为：

```sql
UPDATE oddfi_fixture_results
SET state_id = 5,
    state_code = 'FT',
    state_name = 'Fulltime',
    home_score_full = <HOME_SCORE>,
    away_score_full = <AWAY_SCORE>,
    raw_score_data = JSON_ARRAY(
      JSON_OBJECT('description', 'CURRENT', 'score', JSON_OBJECT('goals', <HOME_SCORE>, 'participant', 'home')),
      JSON_OBJECT('description', 'CURRENT', 'score', JSON_OBJECT('goals', <AWAY_SCORE>, 'participant', 'away'))
    ),
    raw_state_data = JSON_OBJECT('id', 5, 'state', 'FT', 'name', 'Fulltime'),
    settlement_status = 'PROCESSING',
    remark = JSON_OBJECT('activity_id', 'UCL_MOCK_5MIN'),
    updated_at = NOW(3)
WHERE fixture_id = 99200001;
```

### 7.3 `oddfi_odds`

写入 15 条赔率，核心字段要求：

- `fixture_id = 99200001`
- `bookmaker_id = 20`
- `market_id = 1 / 6 / 7`
- `value` 必须和前端下注传入赔率一致
- `stopped = 0` 表示可下注
- `stopped = 1` 表示封盘

推荐 seed 脚本落在：

```text
scripts/ucl_mock_5min_seed.sql
```

推荐断言脚本落在：

```text
scripts/ucl_mock_5min_assert.sql
```

## 8. `oddfi-bet-settle` 改动设计

### 8.1 配置

在 `config/config_prod.yaml` 增加 mock 开关，默认生产可控：

```yaml
settlement:
  user_id: 0
  mock_ucl:
    enabled: true
    fixture_id: 99200001
    period_sec: 300
    bet_open_sec: 240
    lock_name: "oddfi_ucl_mock_5min"
```

说明：

- `enabled=false` 时完全不启动 mock loop。
- `fixture_id` 固定到 `99200001`。
- `lock_name` 用于多实例保护。

### 8.2 启动入口

`cmd/server/main.go` 启动普通结算 worker 后，再按配置启动 mock loop：

```text
startSettleWorker(ctx, dbStorage, cfg)
startMockUCLWorker(ctx, dbStorage, cfg)
```

### 8.3 状态机逻辑

worker 每 1 秒或 5 秒检查一次当前轮次，但只在边界状态执行 DB 更新：

| 阶段 | 条件 | DB 状态 |
| --- | --- | --- |
| 开盘 | `now < starting_at` | `fixture.state_id=1`，`odds.stopped=0` |
| 封盘 | `starting_at <= now < starting_at+60s` | `odds.stopped=1` |
| 结算 | `now >= starting_at+60s` | 写 FT 随机比分，调用 `settleMatch` |
| 下一轮 | 结算成功后 | `starting_at=now+240s`，`state_id=1`，`odds.stopped=0` |

### 8.4 并发保护

多实例部署时必须加 DB 锁：

```sql
SELECT GET_LOCK('oddfi_ucl_mock_5min', 0);
SELECT RELEASE_LOCK('oddfi_ucl_mock_5min');
```

为什么需要锁：

- 随机比分只能生成一次，否则用户看到的比分和结算结果可能不一致。
- `fixture_results` 是赛事级状态，多实例同时更新会造成状态抖动。
- 虽然注单结算有行锁和状态幂等，但比分生成和下一轮重开仍然需要单实例执行。

### 8.5 复用现有判定

结算时不新增玩法判定：

```text
score := service.Score{Home: rand.Intn(5), Away: rand.Intn(5)}
w.settleMatch(99200001, score)
```

`settleMatch` 已经完成：

- 锁定同场未结注单
- 调用 `service.JudgeBet`
- 写 `user_bet_holding.status`
- 写 `user_bet_holding.actual_payout`
- 扣减 `user_balance.bet_lock_balance`
- 增加 `user_balance.claimable_balance`

## 9. `web-api` 改动设计

### 9.1 必修风险

当前 `CreateBetRecord` 中 `validateBetSnapshot` 报错后仍继续建单。这对 mock 上线是硬风险：

- 封盘后仍可能下注成功。
- 赔率变动后仍可能按客户端赔率建单。
- 无效盘口可能进入结算，最终 `JudgeBet` 返回 `VOID`。

必须改为校验失败直接返回错误。

### 9.2 服务端归一化下注字段

下注请求里虽然有 `market / label / handicap_line / odds`，但最终入库应该以后端 `oddfi_odds` 为准。

归一化规则：

| `oddfi_odds.market_id` | 入库 `market` | 入库 `label` | 入库 `handicap_line` |
| ---: | --- | --- | --- |
| `1` | `1x2` | `Home -> 1`，`Draw -> x`，`Away -> 2` | `0` |
| `6` | `handicap` | `Home -> 1`，`Away -> 2` | `oddfi_odds.handicap` |
| `7` | `overunder` | `Over -> over`，`Under -> under` | `oddfi_odds.total` |

这样可以保证 `user_bet_holding` 与 `JudgeBet` 需要的字段完全对齐。

实际实现里，客户端传入的 `market / label / handicap_line` 只做一致性校验；最终落库字段从 `oddfi_odds.market_id / selection / handicap / total` 反推。这样即使前端展示文案变化，也不会污染结算字段。

### 9.3 余额响应

`/account/balance` 建议增加：

```json
{
  "claimable_balance": "0.000000000000000000"
}
```

否则结算后用户只能看到注单状态变化，看不到可领取金额变化，体验闭环不完整。

### 9.4 下单接口示例

```bash
curl -X POST 'http://<web-api-host>/account/bet_place' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "odd_ids": [9920000101],
    "stakes": ["10"],
    "type": "single",
    "market": ["1x2"],
    "label": ["1"],
    "handicap_line": ["0"],
    "odds": ["2.10"],
    "ref_id": "ucl-mock-<uuid>"
  }'
```

期望：

- 开盘期返回 `SUCCESS`。
- 封盘期返回 `MARKET_CLOSED` 或 `ODD_STOPPED`。
- 重复 `ref_id` 返回同一笔下注结果，不重复扣款。

## 10. `oddfi-web-api` 改动设计

### 10.1 市场下发原则

继续读 MySQL，不新增内存假接口。

需要确保以下接口能返回 mock 比赛：

```text
GET /api/v1/detail/fixture_date/{YYYY-MM-DD}?locale=zh
GET /api/v1/detail/fixture_between/{start_date}/{end_date}?locale=zh
GET /api/v1/detail/fixture/99200001?type=preview&locale=zh
```

### 10.2 `enable_bet`

当前 `enable_bet` 只看赛事状态和赔率数量还不够，mock 封盘时还需要看 `odds.stopped`。

推荐规则：

```text
enable_bet = fixture.state_id IN (1, 13)
             AND len(odds) > 0
             AND at least one odd.stopped = false
```

### 10.3 Mock 倒计时字段

为了前端体验，建议对 `fixture_id=99200001` 附加可选字段：

```json
{
  "mock_activity": {
    "activity_id": "UCL_MOCK_5MIN",
    "period_sec": 300,
    "bet_close_sec": 240,
    "settle_at_sec": 300,
    "phase": "open",
    "remaining_sec": 123,
    "bet_close_at": "2026-04-28 12:34:56",
    "settle_at": "2026-04-28 12:35:56"
  }
}
```

兼容策略：

- 前端未接该字段时，不影响原页面展示。
- 前端接入后，可用 `phase` 和 `remaining_sec` 做倒计时和封盘提示。

## 11. `oddfi-web-spider` 处理方式

推荐不改核心代码。

原因：

- spider 当前职责是采集真实 SportMonks 数据。
- mock fixture 使用固定高位 ID，不在 spider 的固定真实 fixture ID 列表中。
- spider 当前是 upsert，不会主动删除 mock 行。

上线要求：

- 不把 `99200001` 加入 `utils.FixtureEuAllIDs`。
- 不让 spider 写 `fixture_id=99200001`。
- 如果后续要自动 seed，也应做成独立脚本或 settlement worker 初始化，不塞进真实采集流程。

## 12. 本地测试部署 SOP

### 12.1 前置条件

确认本地库字段齐全：

```sql
SHOW COLUMNS FROM user_balance LIKE 'claimable_balance';
SHOW COLUMNS FROM user_bet_holding LIKE 'actual_payout';
SHOW COLUMNS FROM oddfi_fixture_results LIKE 'settlement_status';
```

确认表名一致：

```sql
SHOW TABLES LIKE 'oddfi_fixtures';
SHOW TABLES LIKE 'oddfi_odds';
SHOW TABLES LIKE 'oddfi_fixture_results';
SHOW TABLES LIKE 'user_bet_holding';
SHOW TABLES LIKE 'user_balance';
```

### 12.2 初始化 mock 数据

执行：

```bash
mysql --protocol=tcp -h127.0.0.1 -uroot -p123456 < scripts/ucl_mock_5min_seed.sql
```

检查：

```sql
SELECT id, league_id, name, starting_at, state_id, has_odds
FROM oddfi_fixtures
WHERE id = 99200001;

SELECT fixture_id, COUNT(*) AS odds_count, SUM(stopped = 0) AS open_count
FROM oddfi_odds
WHERE fixture_id = 99200001
GROUP BY fixture_id;

SELECT fixture_id, state_id, state_code, home_score_full, away_score_full, settlement_status
FROM oddfi_fixture_results
WHERE fixture_id = 99200001;
```

期望：

- fixture 存在，`league_id=2`。
- odds 数量为 `15`。
- 开盘期 `open_count=15`。
- fixture result 为 `NS/PENDING`。

### 12.3 启动顺序

推荐顺序：

1. MySQL。
2. Redis。
3. 执行 mock seed。
4. 启动 `oddfi-web-api`。
5. 启动 `web-api`。
6. 启动 `oddfi-bet-settle`。
7. `oddfi-web-spider` 可按真实采集需要启动，但不是 mock 链路依赖。

本地命令示例：

```bash
cd oddfi-web-api
go run . --config config/config_local.yaml
```

```bash
cd web-api
go run ./cmd/server --config config_dev.yaml
```

```bash
cd .
go run ./cmd/server --config config/config_prod.yaml
```

具体配置文件以本地环境为准，关键是三个服务必须指向同一套 MySQL 表。

### 12.4 市场接口验收

查日期列表：

```bash
curl 'http://127.0.0.1:8080/api/v1/detail/fixture_date/<YYYY-MM-DD>?locale=zh'
```

查详情：

```bash
curl 'http://127.0.0.1:8080/api/v1/detail/fixture/99200001?type=preview&locale=zh'
```

期望：

- 返回 `id=99200001`。
- `league_id=2`。
- `league.name` 是 `欧冠` 或 `Champions League`。
- `participants` 有葡萄牙和阿根廷。
- `odds` 有 15 条。
- 开盘期 `enable_bet=true`。
- 封盘期 `enable_bet=false` 或赔率 `stopped=true`。

### 12.5 下注验收

下注前查余额：

```sql
SELECT user_id, available_balance, bet_lock_balance, claimable_balance
FROM user_balance
WHERE user_id = <TEST_USER_ID>;
```

执行前端真实下注或 curl 下单。

下注后查注单：

```sql
SELECT
  b.id AS bet_id,
  b.user_id,
  b.odd_id,
  b.status,
  b.market,
  b.label,
  b.handicap_line,
  b.stake,
  b.odds,
  b.payout,
  b.actual_payout,
  o.fixture_id
FROM user_bet_holding b
JOIN oddfi_odds o ON o.odd_id = b.odd_id
WHERE b.user_id = <TEST_USER_ID>
  AND o.fixture_id = 99200001
ORDER BY b.id DESC
LIMIT 20;
```

期望：

- `status=live` 或 `PENDING`，按当前下注服务状态约定。
- `market/label/handicap_line` 完整且能被 `JudgeBet` 识别。
- `odd_id -> fixture_id=99200001` 链路能连上。

下注后查余额：

```sql
SELECT user_id, available_balance, bet_lock_balance, claimable_balance
FROM user_balance
WHERE user_id = <TEST_USER_ID>;
```

期望：

- `available_balance` 减少下注本金。
- `bet_lock_balance` 增加下注本金。
- `claimable_balance` 暂不变化。

### 12.6 封盘验收

等到本轮第 240 秒后，检查：

```sql
SELECT COUNT(*) AS closed_count
FROM oddfi_odds
WHERE fixture_id = 99200001
  AND stopped = 1;
```

期望 `closed_count=15`。

此时再次请求下注，应失败：

```text
ODD_STOPPED 或 MARKET_CLOSED
```

并确认没有新增注单：

```sql
SELECT COUNT(*) AS live_mock_bets
FROM user_bet_holding b
JOIN oddfi_odds o ON o.odd_id = b.odd_id
WHERE o.fixture_id = 99200001
  AND b.created_at >= NOW() - INTERVAL 2 MINUTE;
```

### 12.7 自动结算验收

等到第 300 秒后检查：

```sql
SELECT fixture_id, state_id, state_code, home_score_full, away_score_full, settlement_status, remark, updated_at
FROM oddfi_fixture_results
WHERE fixture_id = 99200001;
```

期望：

- 结算瞬间会变成 `FT` 并有随机比分。
- 本次实现结算和开启下一轮在同一个事务里完成；外部查询通常会看到下一轮 `NS/PENDING`，上一轮比分保存在 `remark.last_score`。
- 这样做是为了避免下一轮新下注遇到 `fixture_results=FT` 后被普通结算 worker 误结算。

查注单：

```sql
SELECT
  b.id,
  b.status,
  b.stake,
  b.odds,
  b.actual_payout,
  b.updated_at
FROM user_bet_holding b
JOIN oddfi_odds o ON o.odd_id = b.odd_id
WHERE o.fixture_id = 99200001
  AND b.user_id = <TEST_USER_ID>
ORDER BY b.id DESC
LIMIT 20;
```

期望：

- `status` 为 `WON / LOST / PUSH`。
- `LOST` 的 `actual_payout=0`。
- `WON` 的 `actual_payout=stake * odds`。
- `PUSH` 的 `actual_payout=stake * 90%`。

查余额：

```sql
SELECT user_id, available_balance, bet_lock_balance, claimable_balance
FROM user_balance
WHERE user_id = <TEST_USER_ID>;
```

期望：

- 该轮已结本金从 `bet_lock_balance` 扣回。
- 非 `LOST` 派彩进入 `claimable_balance`。

### 12.8 Claim 验收

对 `WON / PUSH` 注单调用：

```bash
curl -X POST 'http://<web-api-host>/account/bet_claim' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "bet_id": <BET_ID>,
    "amount": "<ACTUAL_PAYOUT>"
  }'
```

期望：

- `claimable_balance` 减少。
- `available_balance` 增加。
- 重复 claim 返回幂等结果，不重复加钱。

### 12.9 延迟领取验收

结论：不做过期，跨轮延迟领取仍然允许。

原因：

- 结算时资金已经从 `bet_lock_balance` 释放，并把 `WON / PUSH / VOID` 的 `actual_payout` 汇总进入 `claimable_balance`。
- 用户是否领取只是把 `claimable_balance` 转到 `available_balance`，不应该受下一轮开盘影响。
- 领取接口以 `bet_id` 对应的 `claim_prize` 流水做幂等保护，重复领取不会二次加钱。
- 下一轮复用同一个 `fixture_id / odd_id` 时，结算 worker 只处理 `live / PENDING` 注单；上一轮已结状态 `WON / LOST / PUSH / VOID` 不会再次结算。

需要额外验收：

1. 第 N 轮下注并等待自动结算。
2. 不调用 claim，等待第 N+1 轮重新开盘。
3. 第 N+1 轮开盘后再 claim 第 N 轮的 `bet_id`。
4. 期望 claim 成功，`available_balance` 增加，重复 claim 返回 `already_claimed=true`。

## 13. 预发和生产上线 SOP

### 13.1 上线前检查

必须确认：

- `user_balance.claimable_balance` 已存在。
- `web-api` 已修复下注校验失败继续建单问题。
- `web-api` 已能返回或展示 `claimable_balance`。
- 四个服务的 MySQL 表配置一致。
- `oddfi-bet-settle` mock 开关可控。
- 只有一个 settlement worker 实例能持有 mock DB lock。
- mock fixture ID 不与真实赛事 ID 冲突。

### 13.2 发布顺序

推荐发布顺序：

1. 上线数据库字段补丁，确认无锁表风险。
2. 上线 `web-api`，先不开 mock，确认真实下注接口正常。
3. 上线 `oddfi-web-api`，先不开 mock 或 seed 未执行时不影响现有市场。
4. 执行 mock seed。
5. 上线 `oddfi-bet-settle`，打开 `settlement.mock_ucl.enabled=true`。
6. 验证市场接口返回 mock fixture。
7. 用测试账号完成一轮下注和结算。
8. 前端开放入口。

### 13.3 单用户灰度

上线初期建议保留：

```yaml
settlement:
  user_id: <TEST_USER_ID>
```

灰度意义：

- 只结算测试用户，避免历史脏单被误触发。
- 同场若有其他用户注单，锁单阶段也会过滤用户。

灰度通过后再改：

```yaml
settlement:
  user_id: 0
```

注意：改配置后必须重启 `oddfi-bet-settle`。

### 13.4 线上接口检查

市场下发：

```bash
curl 'https://<oddfi-web-api-host>/api/v1/detail/fixture/99200001?type=preview&locale=zh'
```

下注：

```bash
curl -X POST 'https://<web-api-host>/account/bet_place' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "odd_ids": [9920000101],
    "stakes": ["1"],
    "type": "single",
    "market": ["fulltime_result"],
    "label": ["1"],
    "handicap_line": ["0"],
    "odds": ["2.10"],
    "ref_id": "prod-ucl-mock-smoke-<timestamp>"
  }'
```

持仓：

```bash
curl 'https://<web-api-host>/account/bet_holding' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

余额：

```bash
curl 'https://<web-api-host>/account/balance' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

## 14. 上线监控和排查 SQL

### 14.1 mock fixture 状态

```sql
SELECT
  f.id,
  f.name,
  f.starting_at,
  f.state_id AS fixture_state_id,
  fr.state_id AS result_state_id,
  fr.state_code,
  fr.home_score_full,
  fr.away_score_full,
  fr.settlement_status,
  fr.remark,
  f.updated_at,
  fr.updated_at AS result_updated_at
FROM oddfi_fixtures f
LEFT JOIN oddfi_fixture_results fr ON fr.fixture_id = f.id
WHERE f.id = 99200001;
```

### 14.2 odds 开关

```sql
SELECT fixture_id, COUNT(*) AS odds_count, SUM(stopped = 1) AS stopped_count, SUM(stopped = 0) AS open_count
FROM oddfi_odds
WHERE fixture_id = 99200001
GROUP BY fixture_id;
```

### 14.3 未结注单

```sql
SELECT
  b.id,
  b.user_id,
  b.odd_id,
  b.status,
  b.market,
  b.label,
  b.handicap_line,
  b.stake,
  b.odds,
  b.created_at
FROM user_bet_holding b
JOIN oddfi_odds o ON o.odd_id = b.odd_id
WHERE o.fixture_id = 99200001
  AND b.status IN ('PENDING', 'live')
ORDER BY b.created_at DESC;
```

### 14.4 已结注单

```sql
SELECT
  b.id,
  b.user_id,
  b.odd_id,
  b.status,
  b.stake,
  b.odds,
  b.actual_payout,
  b.updated_at
FROM user_bet_holding b
JOIN oddfi_odds o ON o.odd_id = b.odd_id
WHERE o.fixture_id = 99200001
  AND b.status IN ('WON', 'LOST', 'PUSH', 'VOID')
ORDER BY b.updated_at DESC
LIMIT 100;
```

### 14.5 资金核对

```sql
SELECT
  ub.user_id,
  ub.available_balance,
  ub.bet_lock_balance,
  ub.claimable_balance,
  COUNT(b.id) AS mock_bet_count
FROM user_balance ub
LEFT JOIN user_bet_holding b ON b.user_id = ub.user_id
LEFT JOIN oddfi_odds o ON o.odd_id = b.odd_id AND o.fixture_id = 99200001
WHERE ub.user_id = <TEST_USER_ID>
GROUP BY ub.user_id, ub.available_balance, ub.bet_lock_balance, ub.claimable_balance;
```

## 15. 回滚 SOP

回滚不能直接删除 mock fixture 和 odds，因为历史持仓、流水和结算记录仍需要关联展示。

正确顺序：

1. 关闭新下注：

```sql
UPDATE oddfi_odds
SET stopped = 1,
    updated_at = UNIX_TIMESTAMP(NOW())
WHERE fixture_id = 99200001;
```

2. 关闭服务开关并重启 `oddfi-bet-settle`：

```yaml
settlement:
  mock_ucl:
    enabled: false
```

3. 检查是否还有未结注单：

```sql
SELECT COUNT(*) AS unsettled_count
FROM user_bet_holding b
JOIN oddfi_odds o ON o.odd_id = b.odd_id
WHERE o.fixture_id = 99200001
  AND b.status IN ('PENDING', 'live');
```

4. 如果 `unsettled_count > 0`，二选一：

- 等当前最后一轮结算完成。
- 人工将 `fixture_results` 置为取消态，让 worker 统一 `VOID` 退款。

5. 保留 `oddfi_fixtures / oddfi_odds / oddfi_fixture_results` 历史数据，不删除。

## 16. 验收通过标准

一轮完整验收必须满足：

- 市场列表能看到 `葡萄牙 vs 阿根廷`，归属欧冠。
- 详情页能看到 15 个投注选项。
- 开盘期能下注，封盘期不能下注。
- 下注后 `available_balance` 减少，`bet_lock_balance` 增加。
- 5 分钟内自动生成比分并结算。
- 注单状态为 `WON / LOST / PUSH`，没有异常 `VOID`。
- `actual_payout` 与 `JudgeBet` 规则一致。
- `bet_lock_balance` 正确释放。
- `claimable_balance` 正确增加。
- claim 后 `claimable_balance` 减少，`available_balance` 增加。
- 跨轮延迟 claim 不过期，且仍按 `bet_id` 幂等。
- 重复下注 `ref_id` 幂等。
- 重复 claim 幂等。

## 17. 开发任务拆分建议

推荐按以下顺序开发，方便每一步独立验证：

1. 新增 `scripts/ucl_mock_5min_seed.sql` 和断言 SQL。
2. 修复 `web-api` 下注校验失败继续建单问题。
3. `web-api` 增加服务端盘口字段归一化。
4. `web-api` 余额响应增加 `claimable_balance`。
5. `oddfi-web-api` 从 DB 下发 mock fixture，并按 `odds.stopped` 修正 `enable_bet`。
6. `oddfi-web-api` 增加可选 `mock_activity` 字段。
7. `oddfi-bet-settle` 增加 mock UCL 配置和 loop。
8. `oddfi-bet-settle` 增加 DB lock，防止多实例重复推进轮次。
9. 本地跑完整 5 分钟链路。
10. 预发单用户灰度。
11. 生产小流量开放。

## 18. 不做事项

本期不做：

- 不新增多场 mock 赛事。
- 不接真实欧冠赛果源。
- 不新增独立 round 表。
- 不做半赢、半输、四分之一盘口。
- 不做串关专项规则扩展。
- 不把 mock 注单写入 `banner_bet_order`。
- 不由 `oddfi-web-spider` 采集或覆盖 mock 赛事。

## 19. 待确认项

上线前需要产品或前端确认：

- 是否需要页面明确展示“5 分钟体验赛”字样。
- 是否需要展示上轮随机比分。
- `mock_activity` 字段前端是否接入倒计时。
- 封盘后的按钮文案是 `Closed`、`Suspended` 还是中文封盘。
- claimable 余额在页面哪个位置展示。
