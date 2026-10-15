# oddfi-bet-settle 本地自测部署文档

这份文档按当前代码路径编写，用于在本地 MySQL 已启动的情况下，立刻把服务跑起来并验证一轮结算。

当前结算链路是：

`fixture_results 赛果快照 -> oddfi_odds_dev.fixture_id -> user_dev_bet_holding.odd_id -> worker 判定 -> user_dev_bet_holding.actual_payout/status -> user_dev_balance.bet_lock 扣减 -> user_dev_balance.claimable 增加`

## 0. 当前代码关键变化

这次版本已经不再让结算 worker 直接请求 SportMonks，也不再依赖早期的 `matches_dev.match_id` 链路。

本地自测必须注意：

- `cmd/server` 是后台 worker 主入口，只负责启动结算轮询。
- worker 启动后会立即轮询一次，之后每 30 秒轮询一次。
- worker 只处理注单状态 `PENDING` / `live`。
- worker 通过 `user_dev_bet_holding.odd_id` 关联 `oddfi_odds_dev.odd_id`，再用 `oddfi_odds_dev.fixture_id` 找 `fixture_results.fixture_id`。
- `app.env=dev` 时，注单表是 `user_dev_bet_holding`，余额表是 `user_dev_balance`。
- 当前 `UserBetHolding` 模型不再携带 `match_id` / `coin_symbol` / `selection`，大小球方向写在 `label`，例如 `over` / `under`。
- 因为注单没有 `coin_symbol`，worker 会按 `user_id` 锁定唯一一条 `bet_lock_balance >= stake` 的余额行；本地自测要保证同一个用户只有一条满足条件的余额行，否则会拒绝猜测扣哪条余额。

我已按全局 Codex 配置核对过：当前项目是 trusted，沙箱是 `workspace-write`，网络默认受限；本地自测文档尽量只依赖本机 MySQL 和 Go，不要求联网下载额外服务。

## 1. 前置条件

本地需要准备：

- Go 版本满足 `go.mod`，当前仓库声明为 `go 1.24.1`
- MySQL 8.x 或兼容版本
- MySQL 表引擎使用 InnoDB
- 本地能连接 MySQL，例如 `用户名:密码@tcp(127.0.0.1:3306)`
- 不使用生产库，建议单独建库 `oddfi_settle_selftest`

先在仓库根目录跑一次单测：

```bash
go test ./...
```

预期所有包通过。

## 2. 本地配置文件

建议新增本地自测配置文件 `config/config_selftest.yaml`：

```yaml
app:
  env: "dev"

mysql:
  dsn: "用户名:密码@tcp(127.0.0.1:3306)/oddfi_settle_selftest?charset=utf8mb4&parseTime=True&loc=Local"
  tables:
    leagues: "oddfi_leagues_dev"
    fixtures: "oddfi_fixtures_dev"
    odds: "oddfi_odds_dev"
    statistics: "oddfi_statistics_dev"

sportmonks:
  api_token: "selftest-token"
  base_url: "http://127.0.0.1:18080/v3/football"

kafka:
  brokers:
    - "127.0.0.1:9092"
  topic: "league_updates"
```

说明：

- 当前结算 worker 不会访问 `sportmonks` 和 `kafka`，但配置结构保留，避免解析配置时缺字段。
- 如果你的 MySQL 用户、密码、端口不同，只改 `mysql.dsn`。

## 3. 需要准备哪些表

当前代码启动时 `internal/db/db.go` 会自动迁移三张表：

- `oddfi_odds_dev`
- `oddfi_fixtures_dev`
- `fixture_results`

但资金和注单表不会自动迁移，所以本地自测至少要手动准备：

- `user_dev_bet_holding`
- `user_dev_balance`

为了避免历史结构残留影响自测，建议本地自测库直接全量重建以下五张核心表：

- `oddfi_fixtures_dev`：赛事主档，worker 依赖赔率表中的 `fixture_id` 与赛果快照关联。
- `fixture_results`：赛果快照，worker 只从这里读取最终状态和比分。
- `oddfi_odds_dev`：赔率快照，worker 用 `odd_id -> fixture_id` 找到同场注单。
- `user_dev_bet_holding`：待结算注单。
- `user_dev_balance`：用户余额，结算时扣 `bet_lock_balance`，赢/走水/退款增加 `claimable_balance`。

`asset_leager_dev` 当前模型存在，但 worker 目前不会写资产流水。本地跑通结算不需要准备它。

## 4. 建库建表 SQL

登录 MySQL 后执行：

```sql
CREATE DATABASE IF NOT EXISTS oddfi_settle_selftest
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE oddfi_settle_selftest;
```

重建自测表：

```sql
DROP TABLE IF EXISTS user_dev_bet_holding;
DROP TABLE IF EXISTS user_dev_balance;
DROP TABLE IF EXISTS fixture_results;
DROP TABLE IF EXISTS oddfi_odds_dev;
DROP TABLE IF EXISTS oddfi_fixtures_dev;

CREATE TABLE oddfi_fixtures_dev (
  id BIGINT NOT NULL,
  league_id BIGINT NOT NULL DEFAULT 0,
  name VARCHAR(255) NOT NULL DEFAULT '',
  starting_at DATETIME NULL,
  starting_at_timestamp BIGINT NOT NULL DEFAULT 0,
  state_id BIGINT NOT NULL DEFAULT 1,
  stage_id BIGINT NOT NULL DEFAULT 0,
  season_id BIGINT NOT NULL DEFAULT 0,
  home_team_id BIGINT NOT NULL DEFAULT 0,
  home_team_name VARCHAR(255) NOT NULL DEFAULT '',
  home_team_logo VARCHAR(500) NOT NULL DEFAULT '',
  home_team_country_id BIGINT NOT NULL DEFAULT 0,
  home_team_meta_location VARCHAR(50) NOT NULL DEFAULT '',
  home_type VARCHAR(50) NOT NULL DEFAULT '',
  home_team_meta_winner BOOLEAN NOT NULL DEFAULT FALSE,
  home_team_short_code VARCHAR(50) NOT NULL DEFAULT '',
  away_team_id BIGINT NOT NULL DEFAULT 0,
  away_team_name VARCHAR(255) NOT NULL DEFAULT '',
  away_team_logo VARCHAR(500) NOT NULL DEFAULT '',
  away_team_country_id BIGINT NOT NULL DEFAULT 0,
  away_team_meta_location VARCHAR(50) NOT NULL DEFAULT '',
  away_type VARCHAR(50) NOT NULL DEFAULT '',
  away_team_meta_winner BOOLEAN NOT NULL DEFAULT FALSE,
  away_team_short_code VARCHAR(50) NOT NULL DEFAULT '',
  has_odds BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_state_id (state_id),
  KEY idx_league_time (league_id, starting_at),
  KEY idx_starting_at_timestamp (starting_at_timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE fixture_results (
  fixture_id BIGINT NOT NULL,
  state_id BIGINT NOT NULL DEFAULT 0,
  state_code VARCHAR(20) NOT NULL DEFAULT '',
  state_name VARCHAR(20) NOT NULL DEFAULT '',
  home_score_full BIGINT NOT NULL DEFAULT 0,
  away_score_full BIGINT NOT NULL DEFAULT 0,
  home_score_half BIGINT NOT NULL DEFAULT 0,
  away_score_half BIGINT NOT NULL DEFAULT 0,
  home_score_extra BIGINT NULL,
  away_score_extra BIGINT NULL,
  home_score_penalty BIGINT NULL,
  away_score_penalty BIGINT NULL,
  raw_score_data JSON NULL,
  raw_state_data JSON NULL,
  settlement_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  remark TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (fixture_id),
  KEY idx_state_id (state_id),
  KEY idx_state_code (state_code),
  KEY idx_state_name (state_name),
  KEY idx_settlement_status (settlement_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE oddfi_odds_dev (
  odd_id BIGINT NOT NULL,
  fixture_id BIGINT NOT NULL,
  market_id BIGINT NOT NULL,
  bookmaker_id BIGINT NOT NULL,
  label VARCHAR(191) NOT NULL,
  fixture_name VARCHAR(255) NOT NULL DEFAULT '',
  fixture_time VARCHAR(255) NOT NULL DEFAULT '',
  value VARCHAR(20) NOT NULL,
  market_description VARCHAR(255) NOT NULL DEFAULT '',
  handicap VARCHAR(50) NOT NULL DEFAULT '',
  total VARCHAR(50) NOT NULL DEFAULT '',
  winning BOOLEAN NOT NULL DEFAULT FALSE,
  stopped BOOLEAN NOT NULL DEFAULT FALSE,
  selection VARCHAR(50) NOT NULL DEFAULT '',
  updated_at BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (odd_id),
  KEY idx_fixture_id (fixture_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE user_dev_balance (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  coin_symbol VARCHAR(20) NOT NULL,
  available_balance DECIMAL(40,18) NOT NULL DEFAULT 0,
  claimable_balance DECIMAL(40,18) NOT NULL DEFAULT 0,
  frozen_balance DECIMAL(40,18) NOT NULL DEFAULT 0,
  bet_lock_balance DECIMAL(40,18) NOT NULL DEFAULT 0,
  stake_lock_balance DECIMAL(40,18) NOT NULL DEFAULT 0,
  liq_lock_balance DECIMAL(40,18) NOT NULL DEFAULT 0,
  update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_coin (user_id, coin_symbol),
  KEY idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_dev_bet_holding (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  odd_id BIGINT NOT NULL,
  client_ref_id VARCHAR(64) NULL,
  market VARCHAR(20) NOT NULL,
  label VARCHAR(20) NOT NULL,
  handicap_line DECIMAL(8,2) NOT NULL DEFAULT 0,
  estimated_payout DECIMAL(16,2) NOT NULL DEFAULT 0,
  actual_payout DECIMAL(16,2) NOT NULL DEFAULT 0,
  stake DECIMAL(16,2) NOT NULL DEFAULT 0,
  odds DECIMAL(8,4) NOT NULL DEFAULT 0,
  payout DECIMAL(16,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  type VARCHAR(20) NOT NULL DEFAULT 'SINGLE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_user_client_ref_odd (user_id, client_ref_id, odd_id),
  KEY idx_user_status (user_id, status),
  KEY idx_odd_id (odd_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## 5. 准备自测数据

这组数据覆盖：

- `900001`：正常完赛 FT，比分 `2-1`，覆盖 WON / LOST / PUSH / over WON。
- `900002`：加时完赛 AET，`CURRENT=3-2`，`2ND_HALF=2-2`，验证加时赛按 90 分钟比分结算。
- `900003`：取消 CANCELLED，触发 VOID，本金退回 claimable。

执行：

```sql
USE oddfi_settle_selftest;

TRUNCATE TABLE user_dev_bet_holding;
TRUNCATE TABLE user_dev_balance;
TRUNCATE TABLE fixture_results;
TRUNCATE TABLE oddfi_odds_dev;
TRUNCATE TABLE oddfi_fixtures_dev;

INSERT INTO oddfi_fixtures_dev
  (id, league_id, name, starting_at, starting_at_timestamp, state_id,
   home_team_id, home_team_name, away_team_id, away_team_name, has_odds)
VALUES
  (900001, 1, 'Selftest Home vs Selftest Away', NOW(), UNIX_TIMESTAMP(NOW()), 5, 101, 'Selftest Home', 102, 'Selftest Away', TRUE),
  (900002, 1, 'AET Home vs AET Away', NOW(), UNIX_TIMESTAMP(NOW()), 7, 201, 'AET Home', 202, 'AET Away', TRUE),
  (900003, 1, 'Void Home vs Void Away', NOW(), UNIX_TIMESTAMP(NOW()), 12, 301, 'Void Home', 302, 'Void Away', TRUE);

INSERT INTO fixture_results
  (fixture_id, state_id, state_code, state_name,
   home_score_full, away_score_full, home_score_half, away_score_half,
   home_score_extra, away_score_extra, raw_score_data, raw_state_data, settlement_status)
VALUES
  (
    900001, 5, 'FT', 'FT',
    2, 1, 1, 0,
    NULL, NULL,
    JSON_ARRAY(
      JSON_OBJECT('description', 'CURRENT', 'participant', 'home', 'score', JSON_OBJECT('goals', 2)),
      JSON_OBJECT('description', 'CURRENT', 'participant', 'away', 'score', JSON_OBJECT('goals', 1))
    ),
    JSON_OBJECT('id', 5, 'state', 'FT', 'name', 'Fulltime'),
    'PENDING'
  ),
  (
    900002, 7, 'AET', 'AET',
    2, 2, 1, 1,
    1, 0,
    JSON_ARRAY(
      JSON_OBJECT('description', 'CURRENT', 'participant', 'home', 'score', JSON_OBJECT('goals', 3)),
      JSON_OBJECT('description', 'CURRENT', 'participant', 'away', 'score', JSON_OBJECT('goals', 2)),
      JSON_OBJECT('description', '2ND_HALF', 'participant', 'home', 'score', JSON_OBJECT('goals', 2)),
      JSON_OBJECT('description', '2ND_HALF', 'participant', 'away', 'score', JSON_OBJECT('goals', 2))
    ),
    JSON_OBJECT('id', 7, 'state', 'AET', 'name', 'After Extra Time'),
    'PENDING'
  ),
  (
    900003, 12, 'CANCELLED', 'CANCELLED',
    0, 0, 0, 0,
    NULL, NULL,
    JSON_ARRAY(),
    JSON_OBJECT('id', 12, 'state', 'CANCELLED', 'name', 'Cancelled'),
    'PENDING'
  );

INSERT INTO oddfi_odds_dev
  (odd_id, fixture_id, market_id, bookmaker_id, label, fixture_name, value, market_description, handicap, total, selection, updated_at)
VALUES
  (910001, 900001, 1, 1, 'Home', 'Selftest Home vs Selftest Away', '2.0000', 'Fulltime Result', '', '', 'Home', UNIX_TIMESTAMP(NOW())),
  (910002, 900001, 1, 1, 'Away', 'Selftest Home vs Selftest Away', '2.0000', 'Fulltime Result', '', '', 'Away', UNIX_TIMESTAMP(NOW())),
  (910003, 900001, 6, 1, 'Home', 'Selftest Home vs Selftest Away', '2.1000', 'Asian Handicap', '-1', '', 'Home', UNIX_TIMESTAMP(NOW())),
  (910004, 900001, 7, 1, 'Over', 'Selftest Home vs Selftest Away', '1.8000', 'Asian Over/Under', '', '2.5', 'Over', UNIX_TIMESTAMP(NOW())),
  (920001, 900002, 1, 1, 'Draw', 'AET Home vs AET Away', '3.2000', 'Fulltime Result', '', '', 'Draw', UNIX_TIMESTAMP(NOW())),
  (930001, 900003, 1, 1, 'Home', 'Void Home vs Void Away', '2.0000', 'Fulltime Result', '', '', 'Home', UNIX_TIMESTAMP(NOW()));

INSERT INTO user_dev_balance
  (user_id, coin_symbol, available_balance, claimable_balance, bet_lock_balance)
VALUES
  (1001, 'USDT', 1000, 0, 400),
  (1002, 'USDT', 1000, 0, 100),
  (1003, 'USDT', 1000, 0, 100);

INSERT INTO user_dev_bet_holding
  (user_id, odd_id, client_ref_id, market, label, handicap_line,
   stake, odds, estimated_payout, payout, actual_payout, status, type)
VALUES
  (1001, 910001, 'selftest-900001-home-win',  '1x2',       '1',    0.00, 100, 2.0000, 200, 200, 0, 'PENDING', 'SINGLE'),
  (1001, 910002, 'selftest-900001-away-lost', '1x2',       '2',    0.00, 100, 2.0000, 200, 200, 0, 'PENDING', 'SINGLE'),
  (1001, 910003, 'selftest-900001-ah-push',   'handicap',  '1',   -1.00, 100, 2.1000, 210, 210, 0, 'PENDING', 'SINGLE'),
  (1001, 910004, 'selftest-900001-over-win',  'overunder', 'over',  2.50, 100, 1.8000, 180, 180, 0, 'PENDING', 'SINGLE'),
  (1002, 920001, 'selftest-900002-draw-win',  '1x2',       'X',    0.00, 100, 3.2000, 320, 320, 0, 'PENDING', 'SINGLE'),
  (1003, 930001, 'selftest-900003-void',      '1x2',       '1',    0.00, 100, 2.0000, 200, 200, 0, 'PENDING', 'SINGLE');
```

## 6. 启动服务

在仓库根目录执行：

```bash
go test ./...
go run ./cmd/server -config config/config_selftest.yaml
```

看到类似日志说明已启动：

```text
配置文件加载成功
数据库表结构同步完成，使用自定义表名
Settlement Worker started (Polling every 30s)...
```

worker 启动后会立即跑一轮。如果你先启动服务、后插入数据，最多等 30 秒下一轮会处理。

## 8. 验证结算结果

第一轮 worker 跑完后，执行：

```sql
USE oddfi_settle_selftest;

SELECT
  b.id,
  b.user_id,
  b.odd_id,
  o.fixture_id,
  b.market,
  b.label,
  b.handicap_line,
  b.stake,
  b.odds,
  b.status,
  b.actual_payout
FROM user_dev_bet_holding b
JOIN oddfi_odds_dev o ON o.odd_id = b.odd_id
ORDER BY b.id;

SELECT
  user_id,
  coin_symbol,
  available_balance,
  bet_lock_balance,
  claimable_balance
FROM user_dev_balance
ORDER BY user_id;

SELECT
  fixture_id,
  state_id,
  state_code,
  settlement_status,
  remark
FROM fixture_results
ORDER BY fixture_id;
```

预期注单结果：

| 用户 | fixture_id | 玩法 | 投注项 | 预期状态 | actual_payout |
| --- | --- | --- | --- | --- | --- |
| 1001 | 900001 | 1x2 | 1 | WON | 200 |
| 1001 | 900001 | 1x2 | 2 | LOST | 0 |
| 1001 | 900001 | handicap | 1 / -1 | PUSH | 90 |
| 1001 | 900001 | overunder | over / 2.5 | WON | 180 |
| 1002 | 900002 | 1x2 | X | WON | 320 |
| 1003 | 900003 | 1x2 | 1 | VOID | 100 |

预期余额结果：

| user_id | bet_lock_balance | claimable_balance |
| --- | ---: | ---: |
| 1001 | 0 | 470 |
| 1002 | 0 | 320 |
| 1003 | 0 | 100 |

预期 `fixture_results`：

- `900001 settlement_status=PROCESSED`
- `900002 settlement_status=PROCESSED`
- `900003 settlement_status=PROCESSED`
- `remark` 为空

## 9. worker 空跑时的排查 SQL

如果服务启动了但没有结算，先执行这条核心联查：

```sql
SELECT
  b.id AS bet_id,
  b.user_id,
  b.odd_id,
  b.status AS bet_status,
  b.stake,
  o.fixture_id,
  fr.state_id,
  fr.state_code,
  fr.home_score_full,
  fr.away_score_full,
  fr.settlement_status,
  ub.id AS balance_id,
  ub.coin_symbol,
  ub.bet_lock_balance
FROM user_dev_bet_holding b
JOIN oddfi_odds_dev o ON o.odd_id = b.odd_id
JOIN fixture_results fr ON fr.fixture_id = o.fixture_id
LEFT JOIN user_dev_balance ub ON ub.user_id = b.user_id
WHERE b.status IN ('PENDING', 'live')
ORDER BY fr.updated_at DESC, b.id DESC;
```

这条 SQL 查不到数据，worker 就没有候选可以处理。

再检查终局状态：

```sql
SELECT fixture_id, state_id, state_code, settlement_status, remark
FROM fixture_results
ORDER BY fixture_id;
```

只有以下状态会推进：

- 正常结算：`5 FT`、`7 AET`、`8 FT_PEN`
- 退款 VOID：`12 CANCELLED`、`14 WO`、`15 ABANDONED`、`17 AWARDED`、`20 DELETED`

其它状态会 hold 或 none，不会结算。

## 10. 常见问题

### 10.1 `Table 'oddfi_settle_selftest.user_dev_bet_holding' doesn't exist`

原因：`db.NewDBStorage` 当前只 AutoMigrate 赔率、赛事、赛果三张表，不迁移注单和余额表。

处理：执行第 4 节 SQL 创建 `user_dev_bet_holding` 和 `user_dev_balance`。

### 10.2 余额更新报 `multiple eligible balance rows`

原因：当前注单模型没有 `coin_symbol`，worker 不能安全判断该扣哪个币种余额。

处理：本地自测时保证每个 `user_id` 只有一条 `bet_lock_balance >= stake` 的余额行。真实生产建议下注表恢复币种字段，或在结算侧补充可验证的币种来源。

### 10.3 注单一直是 `PENDING`

按顺序检查：

```sql
SELECT id, odd_id, status FROM user_dev_bet_holding;
SELECT odd_id, fixture_id FROM oddfi_odds_dev;
SELECT fixture_id, state_id, raw_score_data, settlement_status, remark FROM fixture_results;
```

常见原因：

- `user_dev_bet_holding.odd_id` 在 `oddfi_odds_dev` 中不存在。
- `oddfi_odds_dev.fixture_id` 在 `fixture_results` 中不存在。
- `fixture_results.state_id` 不是可结算或可退款状态。
- `raw_score_data` JSON 不合法，或缺少目标比分。

### 10.4 AET / 点球后的比分和预期不一致

当前规则：

- `FT` 取 `CURRENT`
- `AET` / `FT_PEN` 取 `2ND_HALF`

这是为了避免加时或点球后的 `CURRENT` 污染常规盘口结算。

### 10.5 大小球没有按预期结算

当前 `overunder` 方向读取 `user_dev_bet_holding.label`，必须是：

- `over`
- `under`
- 兼容中文：`大` / `小`

旧字段 `selection` 已不再参与判定。

## 11. 重跑一轮自测

如果想清空结果重新跑：

```sql
UPDATE user_dev_bet_holding
SET status = 'PENDING', actual_payout = 0, updated_at = NOW();

UPDATE user_dev_balance
SET claimable_balance = 0,
    bet_lock_balance = CASE user_id
      WHEN 1001 THEN 400
      WHEN 1002 THEN 100
      WHEN 1003 THEN 100
      ELSE bet_lock_balance
    END,
    update_time = NOW();

UPDATE fixture_results
SET settlement_status = 'PENDING',
    remark = '',
    updated_at = NOW();
```

然后等待 worker 下一次 30 秒轮询，或重启服务立即触发一轮。

## 12. 本地最小启动顺序

完整顺序如下：

1. 启动本地 MySQL。
2. 创建 `config/config_selftest.yaml`。
3. 执行第 4 节建库建表 SQL。
4. 执行第 5 节自测数据 SQL。
5. 在仓库根目录执行 `go test ./...`。
6. 执行 `go run ./cmd/server -config config/config_selftest.yaml`。
7. 执行第 8 节 SQL 验证注单、余额、赛果结算状态。
