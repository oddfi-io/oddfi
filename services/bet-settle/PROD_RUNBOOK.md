# oddfi-bet-settle 上线运行手册

这份文档是 `oddfi-bet-settle` 正式环境和预发环境的上线检查、配置检查、SQL 核对和运行归档。当前服务定位是后台结算 worker，不对外暴露 HTTP API。

**重要结论先看：生产 `user_balance` 目前如果没有 `claimable_balance` 字段，不能直接启动当前版本。当前代码会在锁定余额和资金落账时映射/更新该字段，缺字段会触发 MySQL `Unknown column 'claimable_balance'`。上线前必须先完成余额表字段兼容，或者先改代码为不依赖该字段后再部署。**

## 1. 服务边界

当前版本负责：

- 从 MySQL 读取 spider 已落库的赛事、赔率、赛果快照。
- 轮询未结算注单：`PENDING`、`live`。
- 按赛事终局状态判定 `WON / LOST / PUSH / VOID`。
- 更新 `user_bet_holding.status`、`user_bet_holding.actual_payout`。
- 扣减 `user_balance.bet_lock_balance`。
- 将中奖、走水、退款金额累加到 `user_balance.claimable_balance`。

当前版本不负责：

- Claim 接口。
- 对外 HTTP API；比赛状态、下注、资金接口统一收敛到 `web-api` 服务。
- `asset_ledger` / `asset_leager` 资产流水写入。
- WebSocket / Kafka 结算广播。
- 官方改判后的 resettle。
- 多 worker 分布式锁。
- 48 小时延期自动 VOID。

## 2. 生产硬性前置条件

以下任一项不满足，暂停上线：

- `user_balance` 缺少 `claimable_balance`。
- `web-api` 或资金服务还没有约定从 `claimable_balance` 发起 claim/提现/可领取金额展示。
- `config/config_prod.yaml` 未配置真实赛果快照表名 `mysql.tables.fixture_results`。
- `user_bet_holding.odd_id` 不能关联 `oddfi_odds.odd_id`。
- `oddfi_odds.fixture_id` 不能关联 `oddfi_fixture_results.fixture_id`。
- 待结注单对应用户没有足够 `user_balance.bet_lock_balance`。
- 同一用户存在多条可扣 `bet_lock_balance >= stake` 的余额行，但注单表没有币种字段。
- `raw_score_data` 大量非法 JSON。
- 生产配置指向测试库。
- 未确认当前启动逻辑会执行 GORM `AutoMigrate`；生产库账号没有 DDL 权限会启动失败，有 DDL 权限则需要接受自动同步 spider 相关表结构的风险。
- 多实例部署但没有外层分布式锁。

## 3. 数据链路

worker 不通过注单 `match_id` 找比赛；当前注单模型没有可靠 `match_id`，所以通过赔率快照反查：

```text
user_bet_holding.odd_id
  -> oddfi_odds.odd_id
  -> oddfi_odds.fixture_id
  -> oddfi_fixture_results.fixture_id
```

候选注单必须满足：

- `user_bet_holding.status IN ('PENDING', 'live')`
- `user_bet_holding.odd_id = oddfi_odds.odd_id`
- `oddfi_odds.fixture_id = oddfi_fixture_results.fixture_id`
- `oddfi_fixture_results.state_id` 属于可结算或可退款状态

资金更新规则：

- `user_balance` 必须存在对应 `user_id` 的余额行。
- `user_balance.bet_lock_balance >= user_bet_holding.stake`。
- 当前注单表没有 `coin_symbol`，worker 会按 `user_id` 查找唯一一条可扣余额；如果同一用户存在多条满足条件的余额行，worker 会拒绝猜测扣哪条。

## 4. 生产配置

生产配置建议使用私有 `config/config_prod.yaml`，至少包含下面字段。赛果快照表名必须和 spider 落库表一致；本项目当前生产/联调表名按 `oddfi_fixture_results` 处理。

```yaml
app:
  env: "prod"

mysql:
  dsn: "用户名:密码@tcp(MySQL地址:3306)/数据库名?charset=utf8mb4&parseTime=True&loc=Local"
  tables:
    leagues: "oddfi_leagues"
    fixtures: "oddfi_fixtures"
    fixture_results: "oddfi_fixture_results"
    odds: "oddfi_odds"
    statistics: "oddfi_statistics"

settlement:
  user_id: 0

sportmonks:
  api_token: ""
  base_url: ""

kafka:
  brokers: []
  topic: ""
```

配置说明：

- `app.env=prod` 时，worker 使用 `user_bet_holding`、`user_balance`。
- `app.env=dev` 时，worker 使用 `user_dev_bet_holding`、`user_dev_balance`。
- `mysql.tables.fixture_results` 不能省略；省略后代码会回退到默认表名 `fixture_results`，如果生产真实表是 `oddfi_fixture_results`，worker 会查错表。
- `settlement.user_id=0` 表示不限制用户；如果线上灰度只想结算一个新注册测试用户，把这里改为该用户的 `user_id` 并重启 worker。
- 当前 worker 不直接请求 SportMonks，也不消费 Kafka；这两个配置块仅保留结构兼容。

## 5. 必须表和字段

### `oddfi_fixtures`

至少需要：

- `id`
- `state_id`
- `name`
- `starting_at`
- `updated_at`

### `oddfi_fixture_results`

至少需要：

- `fixture_id`
- `state_id`
- `state_code`
- `state_name`
- `home_score_full`
- `away_score_full`
- `raw_score_data`
- `settlement_status`
- `remark`
- `updated_at`

### `oddfi_odds`

至少需要：

- `odd_id`
- `fixture_id`
- `market_id`
- `bookmaker_id`
- `label`
- `value`
- `handicap`
- `total`
- `selection`
- `updated_at`

### `user_bet_holding`

至少需要：

- `id`
- `user_id`
- `odd_id`
- `client_ref_id`
- `market`
- `label`
- `handicap_line`
- `stake`
- `odds`
- `payout`
- `estimated_payout`
- `actual_payout`
- `status`
- `type`
- `created_at`
- `updated_at`

### `user_balance`

至少需要：

- `id`
- `user_id`
- `coin_symbol`
- `available_balance`
- `claimable_balance`
- `frozen_balance`
- `bet_lock_balance`
- `stake_lock_balance`
- `liq_lock_balance`
- `update_time`

`claimable_balance` 是当前版本硬依赖字段，不是可选字段。没有这个字段时，GORM 查询余额会因为模型字段不存在而报错，赢注/走水/退款落账也无法完成。

## 6. `claimable_balance` 生产兼容方案

当前线上 `user_balance` 表结构没有 `claimable_balance`：

```sql
DESC user_balance;
```

关键字段顺序现状：

```text
available_balance
frozen_balance
update_time
bet_lock_balance
stake_lock_balance
liq_lock_balance
```

Go 代码按字段名读写，不依赖字段顺序。生产环境优先推荐把 `claimable_balance` 追加到表末尾，这样在支持 Instant DDL 的 MySQL 8.0 版本上通常可以避免表拷贝，降低锁表风险。

先检查生产字段是否存在：

```sql
SELECT
  table_name,
  column_name,
  column_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'user_balance'
  AND column_name = 'claimable_balance';
```

如果没有返回行，生产推荐执行下面这组 SQL。`lock_wait_timeout` 是为了避免上线时被长事务或元数据锁长时间卡住；如果拿不到锁，让它快速失败，排查阻塞会话后再重试：

```sql
SET SESSION lock_wait_timeout = 5;

ALTER TABLE user_balance
  ADD COLUMN claimable_balance DECIMAL(40,18) NOT NULL DEFAULT 0.000000000000000000 COMMENT '结算后待用户领取余额',
  ALGORITHM=INSTANT;
```

说明：

- `DECIMAL(40,18)` 与现有 `available_balance / frozen_balance / bet_lock_balance` 精度保持一致。
- `NOT NULL DEFAULT 0.000000000000000000` 保证历史用户行自动得到 0，不需要额外回填。
- 不加 `AFTER available_balance` 是有意的；字段顺序对 GORM 和 SQL 更新没有意义，追加字段对生产表更稳。
- `ALGORITHM=INSTANT` 用来约束这次变更必须走 Instant DDL；如果数据库版本或表状态不支持，会直接报错，不会悄悄退化成高风险表拷贝。
- MySQL 8.4 中 `ALGORITHM=INSTANT` 只允许 `LOCK=DEFAULT`；不要写 `LOCK=NONE`，否则会报 `ERROR 1221 (HY000): Incorrect usage of ALGORITHM=INSTANT and LOCK=NONE/SHARED/EXCLUSIVE`。
- Instant DDL 仍然需要短暂元数据锁；如果线上 MySQL 不支持 Instant DDL，或者 `user_balance` 是大表且变更失败，需要改用 gh-ost / pt-online-schema-change / 云厂商在线 DDL，不建议在业务高峰期直接执行普通 `ALTER TABLE`。

如果团队强制要求字段顺序放在 `available_balance` 后面，可以在维护窗口使用下面语句，但这可能在部分 MySQL 版本触发表重建，执行前必须在预发或影子库验证耗时和锁影响：

```sql
SET SESSION lock_wait_timeout = 5;

ALTER TABLE user_balance
  ADD COLUMN claimable_balance DECIMAL(40,18) NOT NULL DEFAULT 0.000000000000000000 COMMENT '结算后待用户领取余额'
  AFTER available_balance;
```

字段补齐后复查：

```sql
SHOW COLUMNS FROM user_balance LIKE 'claimable_balance';
```

期望结果类似：

```text
+-------------------+----------------+------+-----+----------------------+-------+
| Field             | Type           | Null | Key | Default              | Extra |
+-------------------+----------------+------+-----+----------------------+-------+
| claimable_balance | decimal(40,18) | NO   |     | 0.000000000000000000 |       |
+-------------------+----------------+------+-----+----------------------+-------+
```

再检查历史数据是否都被默认值覆盖：

```sql
SELECT COUNT(*) AS null_claimable_rows
FROM user_balance
WHERE claimable_balance IS NULL;
```

期望 `null_claimable_rows = 0`。

上线前还要确认资金侧语义：

- 下注时资金仍进入 `bet_lock_balance`。
- 结算成功后，worker 扣 `bet_lock_balance`。
- `WON / PUSH / VOID` 的 `actual_payout` 累加到 `claimable_balance`。
- `LOST` 只扣 `bet_lock_balance`，不会增加 `claimable_balance`。
- 用户后续 claim 的扣减逻辑应由 `web-api` / 资金服务承接，本 worker 不处理 claim。

## 7. 上线前 SQL 核对

以下 SQL 按当前生产配置表名编写，赛果快照表使用 `oddfi_fixture_results`。

确认表存在：

```sql
SHOW TABLES LIKE 'oddfi_fixtures';
SHOW TABLES LIKE 'oddfi_fixture_results';
SHOW TABLES LIKE 'oddfi_odds';
SHOW TABLES LIKE 'user_bet_holding';
SHOW TABLES LIKE 'user_balance';
```

确认关键字段存在：

```sql
SHOW COLUMNS FROM oddfi_fixtures;
SHOW COLUMNS FROM oddfi_fixture_results;
SHOW COLUMNS FROM oddfi_odds;
SHOW COLUMNS FROM user_bet_holding;
SHOW COLUMNS FROM user_balance;
```

确认关键索引：

```sql
SHOW INDEX FROM oddfi_fixtures;
SHOW INDEX FROM oddfi_fixture_results;
SHOW INDEX FROM oddfi_odds;
SHOW INDEX FROM user_bet_holding;
SHOW INDEX FROM user_balance;
```

至少应关注：

- `oddfi_fixtures.id` 是主键或唯一键。
- `oddfi_fixture_results.fixture_id` 是主键或唯一键。
- `oddfi_odds.odd_id` 是主键或唯一键。
- `oddfi_odds.fixture_id` 有索引。
- `user_bet_holding.odd_id` 有索引。
- `user_bet_holding.status` 或 `(status, odd_id)` 有索引。
- `user_balance.user_id` 有索引。

## 8. worker 候选联查

这条 SQL 用于判断 worker 是否有机会处理注单。它必须能在生产库直接执行：

```sql
SELECT
  b.id AS bet_id,
  b.user_id,
  b.odd_id,
  b.status AS bet_status,
  b.market,
  b.label,
  b.handicap_line,
  b.stake,
  o.fixture_id,
  fr.state_id,
  fr.state_code,
  fr.home_score_full,
  fr.away_score_full,
  fr.settlement_status,
  ub.id AS balance_id,
  ub.bet_lock_balance,
  ub.claimable_balance
FROM user_bet_holding AS b
JOIN oddfi_odds AS o ON o.odd_id = b.odd_id
JOIN oddfi_fixture_results AS fr ON fr.fixture_id = o.fixture_id
LEFT JOIN user_balance AS ub ON ub.user_id = b.user_id
WHERE b.status IN ('PENDING', 'live')
ORDER BY fr.updated_at DESC, b.id DESC
LIMIT 100;
```

如果这条 SQL 查不到结果，worker 大概率只会空跑。继续分段检查：

```sql
SELECT COUNT(*) AS unsettled_bets
FROM user_bet_holding
WHERE status IN ('PENDING', 'live');

SELECT COUNT(*) AS odds_rows
FROM oddfi_odds;

SELECT COUNT(*) AS result_rows
FROM oddfi_fixture_results;
```

检查 `odd_id` 是否断链：

```sql
SELECT b.id, b.user_id, b.odd_id, b.status
FROM user_bet_holding AS b
LEFT JOIN oddfi_odds AS o ON o.odd_id = b.odd_id
WHERE b.status IN ('PENDING', 'live')
  AND o.odd_id IS NULL
LIMIT 50;
```

检查 `fixture_id` 是否断链：

```sql
SELECT b.id, b.odd_id, o.fixture_id
FROM user_bet_holding AS b
JOIN oddfi_odds AS o ON o.odd_id = b.odd_id
LEFT JOIN oddfi_fixture_results AS fr ON fr.fixture_id = o.fixture_id
WHERE b.status IN ('PENDING', 'live')
  AND fr.fixture_id IS NULL
LIMIT 50;
```

检查余额歧义：

```sql
SELECT user_id, COUNT(*) AS eligible_balance_rows
FROM user_balance
WHERE bet_lock_balance > 0
GROUP BY user_id
HAVING COUNT(*) > 1
LIMIT 20;
```

当前注单表不带币种时，上面查出数据就存在扣哪条余额的歧义。需要先保证每个待结用户只有一条可扣余额，或改造注单表/worker 加入币种维度。

## 9. 状态机规则

正常结算状态：

- `5 FT`
- `7 AET`
- `8 FT_PEN`

全单退款为 `VOID`：

- `12 CANCELLED`
- `14 WO`
- `15 ABANDONED`
- `17 AWARDED`
- `20 DELETED`

其他状态：

- `scheduled / live / hold / pending`
- worker 不推进资金，等待 spider 后续刷新或人工处理

比分规则：

- `FT` 使用 `CURRENT`。
- `AET / FT_PEN` 使用 `2ND_HALF`。
- 优先从 `raw_score_data` 解析。
- `raw_score_data` 为空时回退到 `home_score_full / away_score_full`。
- 当前兼容 `participant` 位于顶层或 `score.participant` 两种 SportMonks 落库格式。

## 10. 编译、镜像与启动

编译前先跑测试：

```bash
go test ./...
go build -o bin/oddfi-bet-settle ./cmd/server
```

本地或服务器直接启动 worker：

```bash
./bin/oddfi-bet-settle -config config/config_prod.yaml
```

构建 Docker 镜像：

```bash
./deploy.sh build
```

启动或重启容器：

```bash
TAG=prod ./deploy.sh restart
```

如果不用 `deploy.sh`，也可以手动 `docker run`：

```bash
docker run -d \
  --name oddfi-bet-settle \
  --restart unless-stopped \
  -e TZ=Asia/Shanghai \
  oddfi-bet-settle:prod
```

容器不会映射端口；这个服务只运行后台结算 worker。当前镜像会把 `config/` 目录一起打包进去，并默认加载 `config/config_prod.yaml`；构建生产镜像前必须确认本地 `config/config_prod.yaml` 已经是线上配置。多实例部署时，worker 外层必须配分布式锁，或者只保留单 worker 实例。

## 11. 运行后验证

看赛果推进：

```sql
SELECT fixture_id, state_id, state_code, settlement_status, remark, updated_at
FROM oddfi_fixture_results
ORDER BY updated_at DESC
LIMIT 20;
```

看注单推进：

```sql
SELECT id, user_id, odd_id, market, label, stake, odds, status, actual_payout, updated_at
FROM user_bet_holding
WHERE status IN ('PENDING', 'live', 'WON', 'LOST', 'PUSH', 'VOID')
ORDER BY updated_at DESC
LIMIT 50;
```

看资金承接：

```sql
SELECT user_id, available_balance, bet_lock_balance, claimable_balance, update_time
FROM user_balance
ORDER BY update_time DESC
LIMIT 50;
```

看结算异常：

```sql
SELECT fixture_id, state_id, settlement_status, remark, updated_at
FROM oddfi_fixture_results
WHERE settlement_status = 'ERROR'
ORDER BY updated_at DESC
LIMIT 50;
```

## 12. 上线当天顺序

1. 确认 `user_balance.claimable_balance` 已存在，且资金侧认可该字段语义。
2. 确认生产配置 `mysql.tables.fixture_results = "oddfi_fixture_results"`。
3. 确认 spider 持续写入 `oddfi_fixtures`、`oddfi_fixture_results`、`oddfi_odds`。
4. 确认下注服务写入 `user_bet_holding.odd_id`。
5. 确认资金服务下注时已冻结 `user_balance.bet_lock_balance`。
6. 执行第 7 节和第 8 节 SQL。
7. 执行 `go test ./...` 和镜像构建。
8. 发布并启动单 worker。
9. 观察 `settlement_status`、注单状态、`bet_lock_balance`、`claimable_balance`。
10. 确认没有持续增长的 `ERROR`。

## 13. 常见问题

### 启动后报 `Unknown column 'claimable_balance'`

原因：生产 `user_balance` 没有 `claimable_balance` 字段，当前 worker 模型和资金更新都依赖它。

处理：

1. 停止 worker。
2. 执行第 6 节字段检查。
3. 按线上变更流程补字段。
4. 重新启动 worker。

### worker 空跑

优先检查：

```sql
SELECT COUNT(*) AS unsettled_bets
FROM user_bet_holding
WHERE status IN ('PENDING', 'live');

SELECT COUNT(*) AS odds_rows
FROM oddfi_odds;

SELECT COUNT(*) AS result_rows
FROM oddfi_fixture_results;
```

再执行第 8 节候选联查。

常见原因：

- `config/config_prod.yaml` 没有配置 `fixture_results: "oddfi_fixture_results"`，导致代码回退查询 `fixture_results`。
- `odd_id` 无法关联赔率表。
- `fixture_id` 无法关联赛果快照。
- 赛事还不是终局状态。

### `settlement_status=ERROR`

先看：

```sql
SELECT fixture_id, state_id, remark, updated_at
FROM oddfi_fixture_results
WHERE settlement_status = 'ERROR'
ORDER BY updated_at DESC
LIMIT 50;
```

常见原因：

- `raw_score_data` 不是合法 JSON。
- `raw_score_data` 缺少目标比分。
- `user_balance` 没有对应用户余额行。
- `bet_lock_balance < stake`。
- 同一用户存在多条可扣余额，worker 拒绝猜测扣款行。

### 注单一直是 `live`

检查：

```sql
SELECT b.id, b.odd_id, o.fixture_id, fr.state_id, fr.state_code
FROM user_bet_holding AS b
LEFT JOIN oddfi_odds AS o ON o.odd_id = b.odd_id
LEFT JOIN oddfi_fixture_results AS fr ON fr.fixture_id = o.fixture_id
WHERE b.status IN ('PENDING', 'live')
LIMIT 50;
```

常见原因：

- `odd_id` 无法关联赔率表。
- `fixture_id` 无法关联赛果快照。
- 赛事还不是终局状态。
- 赛事处于 hold 状态，等待 spider 刷新。

### 资金没进 `claimable_balance`

检查：

```sql
SELECT
  b.id,
  b.user_id,
  b.stake,
  b.status,
  b.actual_payout,
  ub.bet_lock_balance,
  ub.claimable_balance
FROM user_bet_holding AS b
LEFT JOIN user_balance AS ub ON ub.user_id = b.user_id
WHERE b.status IN ('WON', 'PUSH', 'VOID')
ORDER BY b.updated_at DESC
LIMIT 50;
```

如果注单已经变成 `WON / PUSH / VOID` 但余额没变，优先查 worker 日志里的余额更新错误，再排查是否有外部资金服务并发覆盖余额。

## 14. 当前版本已知限制

- `user_balance.claimable_balance` 是硬依赖，生产没有该字段时不能上线。
- 注单表没有 `coin_symbol`，所以一用户多币种或多余额行场景存在扣款歧义。
- 当前 `internal/db.NewDBStorage` 启动时会 `AutoMigrate` `OddDB`、`FixtureDB`、`FixtureResult`；正式生产如果不希望 worker 自动改 spider 表，需要先改代码关闭自动迁移。
- 没有分布式锁；多实例部署可能重复竞争同一批注单，虽然行锁和状态条件能降低重复入账风险，但正式生产建议只跑单实例或加外层锁。
- `asset_ledger` / `asset_leager` 当前不写入；如果财务对账要求每笔 settlement 有流水，需要补齐资产流水逻辑后再上线。
- 官方赛果改判、重结算、人工修正不在当前版本内。
