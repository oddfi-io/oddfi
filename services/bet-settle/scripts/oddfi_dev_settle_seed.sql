USE oddfi_dev;

-- 本地联调资金承接依赖 claimable_balance；用 information_schema 做兼容判断，避免不同 MySQL 版本不支持 ADD COLUMN IF NOT EXISTS。
SET @add_claimable_balance_sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE user_balance ADD COLUMN claimable_balance DECIMAL(40,18) NOT NULL DEFAULT 0.000000000000000000 AFTER available_balance',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'user_balance'
    AND column_name = 'claimable_balance'
);
PREPARE add_claimable_balance_stmt FROM @add_claimable_balance_sql;
EXECUTE add_claimable_balance_stmt;
DEALLOCATE PREPARE add_claimable_balance_stmt;

-- 覆盖 VOID 场景需要一条取消赛事；使用高位自测 ID，避免污染现有欧冠 fixture_id 区间。
INSERT INTO oddfi_fixtures
  (id, league_id, name, starting_at, starting_at_timestamp, state_id,
   home_team_id, home_team_name, away_team_id, away_team_name, has_odds,
   created_at, updated_at)
VALUES
  (99000001, 999, 'Local VOID Home vs Local VOID Away', NOW(), UNIX_TIMESTAMP(NOW()), 12,
   990001, 'Local VOID Home', 990002, 'Local VOID Away', 1,
   NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE
  state_id = VALUES(state_id),
  updated_at = NOW(3);

INSERT INTO oddfi_fixture_results
  (fixture_id, state_id, state_code, state_name,
   home_score_full, away_score_full, home_score_half, away_score_half,
   home_score_extra, away_score_extra, home_score_penalty, away_score_penalty,
   raw_score_data, raw_state_date, settlement_status, remark, created_at, updated_at)
VALUES
  (99000001, 12, 'CANCELLED', 'Cancelled',
   0, 0, 0, 0,
   NULL, NULL, NULL, NULL,
   JSON_ARRAY(), JSON_OBJECT('id', 12, 'state', 'CANCELLED', 'name', 'Cancelled'),
   'PENDING', '', NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE
  state_id = VALUES(state_id),
  state_code = VALUES(state_code),
  state_name = VALUES(state_name),
  raw_score_data = VALUES(raw_score_data),
  raw_state_date = VALUES(raw_state_date),
  settlement_status = 'PENDING',
  remark = '',
  updated_at = NOW(3);

INSERT INTO oddfi_odds
  (odd_id, fixture_id, market_id, bookmaker_id, label, fixture_name, fixture_time,
   value, market_description, handicap, total, winning, stopped, selection, updated_at)
VALUES
  (9900000101, 99000001, 1, 20, 'Home', 'Local VOID Home vs Local VOID Away', DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'),
   '2.0000', 'Match Winner', '', '', 0, 0, 'Home 2.00', UNIX_TIMESTAMP(NOW()))
ON DUPLICATE KEY UPDATE
  fixture_id = VALUES(fixture_id),
  value = VALUES(value),
  updated_at = VALUES(updated_at);

-- 重置本轮自测注单，保证脚本可重复执行；只删除本脚本写入的 client_ref_id 前缀数据。
DELETE FROM user_bet_holding
WHERE client_ref_id LIKE 'settle-local-%';

DELETE FROM asset_ledger
WHERE ref_id LIKE 'settle-local-%';

DELETE FROM user_balance
WHERE user_id IN (2042417265130868736, 2042177720615440384);

-- 使用用户给出的两个 mock user_id；由于当前注单模型没有 coin_symbol，必须保证每个用户只有一条可扣 bet_lock 的余额行。
INSERT INTO user_balance
  (user_id, coin_symbol, available_balance, claimable_balance, frozen_balance,
   bet_lock_balance, stake_lock_balance, liq_lock_balance, update_time)
VALUES
  (2042417265130868736, '', 9600.500000000000000000, 0.000000000000000000, 0.000000000000000000,
   150.000000000000000000, 0.000000000000000000, 0.000000000000000000, NOW()),
  (2042177720615440384, '', 8500.500000000000000000, 0.000000000000000000, 0.000000000000000000,
   100.000000000000000000, 0.000000000000000000, 0.000000000000000000, NOW());

-- asset_ledger 当前 worker 不读取也不写入；这里补 mock 流水是为了本地联调库的账务上下文完整。
INSERT INTO asset_ledger
  (user_id, business_type, amount, balance_before, balance_after, ref_id, token_address, created_at,
   frozen_before, frozen_after, bet_lock_before, stake_lock_before, liq_lock_before,
   bet_lock_after, stake_lock_after, liq_lock_after)
VALUES
  (2042417265130868736, 'single', -150.000000000000000000, 9750.500000000000000000, 9600.500000000000000000,
   'settle-local-lock-2042417265130868736', '', NOW(),
   0, 0, 0, 0, 0, 150.000000000000000000, 0, 0),
  (2042177720615440384, 'single', -100.000000000000000000, 8600.500000000000000000, 8500.500000000000000000,
   'settle-local-lock-2042177720615440384', '', NOW(),
   0, 0, 0, 0, 0, 100.000000000000000000, 0, 0);

-- 复用已有欧冠 FT 数据，并补一条本地取消赛：
-- 19683236: FT 2-0，覆盖 fulltime_result WON/LOST。
-- 19683229: FT 0-2，覆盖 overunder WON。
-- 19683230: FT 0-0，覆盖 handicap PUSH。
-- 99000001: CANCELLED，覆盖 VOID。
UPDATE oddfi_fixture_results
SET settlement_status = 'PENDING',
    remark = '',
    updated_at = NOW(3)
WHERE fixture_id IN (19683236, 19683229, 19683230, 99000001);

INSERT INTO user_bet_holding
  (user_id, odd_id, stake, odds, payout, status, type, market, label,
   handicap_line, estimated_payout, actual_payout, created_at, updated_at, client_ref_id)
VALUES
  (2042417265130868736, 227862806199, 50.00, 1.7800, 89.00, 'live', 'single',
   'fulltime_result', '1', 0.00, 89.00, 0.00, NOW(3), NOW(3), 'settle-local-won-home'),
  (2042417265130868736, 227862806203, 50.00, 4.2400, 212.00, 'live', 'single',
   'fulltime_result', '2', 0.00, 212.00, 0.00, NOW(3), NOW(3), 'settle-local-lost-away'),
  (2042417265130868736, 230185084183, 50.00, 1.8500, 92.50, 'live', 'single',
   'overunder', 'under', 3.50, 92.50, 0.00, NOW(3), NOW(3), 'settle-local-won-under'),
  (2042177720615440384, 230254558292, 50.00, 1.2100, 60.50, 'live', 'single',
   'handicap', '1', 0.00, 60.50, 0.00, NOW(3), NOW(3), 'settle-local-push-home'),
  (2042177720615440384, 9900000101, 50.00, 2.0000, 100.00, 'live', 'single',
   'fulltime_result', '1', 0.00, 100.00, 0.00, NOW(3), NOW(3), 'settle-local-void');
