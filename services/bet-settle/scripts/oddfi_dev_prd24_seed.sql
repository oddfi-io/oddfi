USE oddfi_dev;

-- PRD 24 条用例的 worker E2E 数据脚本：
-- 1. 每条用例一场独立 FT 赛事，避免同场 fixture_results 状态互相影响。
-- 2. 所有注单统一 stake=100、odds=2.0，便于按 prd.md 直接核对派彩。
-- 3. 当前注单表没有 coin_symbol，使用单用户单余额行，避免 worker 在资金扣减时出现币种歧义。
SET @prd24_user_id := 2043000000000000024;

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

DROP TEMPORARY TABLE IF EXISTS prd24_cases;
CREATE TEMPORARY TABLE prd24_cases (
  id INT NOT NULL PRIMARY KEY,
  title VARCHAR(64) NOT NULL,
  market VARCHAR(20) NOT NULL,
  label VARCHAR(20) NOT NULL,
  handicap_line DECIMAL(8,2) NOT NULL,
  home_score INT NOT NULL,
  away_score INT NOT NULL,
  expected_status VARCHAR(20) NOT NULL,
  expected_payout DECIMAL(16,2) NOT NULL
);

INSERT INTO prd24_cases
  (id, title, market, label, handicap_line, home_score, away_score, expected_status, expected_payout)
VALUES
  (1,  '1x2 客胜命中',       'fulltime_result', '2',     0.00, 1, 2, 'WON',  200.00),
  (2,  '1x2 客胜未命中',     'fulltime_result', '2',     0.00, 2, 1, 'LOST',   0.00),
  (3,  '让球 -0.5 命中',     'handicap',        '2',    -0.50, 1, 2, 'WON',  200.00),
  (4,  '让球 -0.5 未命中',   'handicap',        '2',    -0.50, 2, 2, 'LOST',   0.00),
  (5,  '让球 -1 命中',       'handicap',        '2',    -1.00, 0, 2, 'WON',  200.00),
  (6,  '让球 -1 走水',       'handicap',        '2',    -1.00, 1, 2, 'PUSH',  90.00),
  (7,  '让球 -1 未命中',     'handicap',        '2',    -1.00, 2, 2, 'LOST',   0.00),
  (8,  '让球 -1.5 命中',     'handicap',        '2',    -1.50, 0, 2, 'WON',  200.00),
  (9,  '让球 -1.5 未命中',   'handicap',        '2',    -1.50, 1, 2, 'LOST',   0.00),
  (10, '1x2 主胜命中',       'fulltime_result', '1',     0.00, 2, 1, 'WON',  200.00),
  (11, '1x2 主胜未命中',     'fulltime_result', '1',     0.00, 1, 2, 'LOST',   0.00),
  (12, '让球 -0.5 命中',     'handicap',        '1',    -0.50, 2, 1, 'WON',  200.00),
  (13, '让球 -0.5 未命中',   'handicap',        '1',    -0.50, 2, 2, 'LOST',   0.00),
  (14, '让球 -1 命中',       'handicap',        '1',    -1.00, 2, 0, 'WON',  200.00),
  (15, '让球 -1 走水',       'handicap',        '1',    -1.00, 2, 1, 'PUSH',  90.00),
  (16, '让球 -1 未命中',     'handicap',        '1',    -1.00, 2, 2, 'LOST',   0.00),
  (17, '让球 -1.5 命中',     'handicap',        '1',    -1.50, 2, 0, 'WON',  200.00),
  (18, '让球 -1.5 未命中',   'handicap',        '1',    -1.50, 2, 1, 'LOST',   0.00),
  (19, '大 1.5 命中',        'overunder',       'over',  1.50, 1, 1, 'WON',  200.00),
  (20, '大 1.5 未命中',      'overunder',       'over',  1.50, 0, 1, 'LOST',   0.00),
  (21, '小 2.5 命中',        'overunder',       'under', 2.50, 1, 1, 'WON',  200.00),
  (22, '小 2.5 未命中',      'overunder',       'under', 2.50, 2, 1, 'LOST',   0.00),
  (23, '大 3.5 命中',        'overunder',       'over',  3.50, 2, 2, 'WON',  200.00),
  (24, '大 3.5 未命中',      'overunder',       'over',  3.50, 1, 2, 'LOST',   0.00);

DELETE FROM user_bet_holding WHERE client_ref_id LIKE 'prd24-%';
DELETE FROM asset_ledger WHERE ref_id LIKE 'prd24-%';
DELETE FROM user_balance WHERE user_id = @prd24_user_id;

DELETE FROM oddfi_odds WHERE odd_id BETWEEN 9910000001 AND 9910000024;
DELETE FROM oddfi_fixture_results WHERE fixture_id BETWEEN 99100001 AND 99100024;
DELETE FROM oddfi_fixtures WHERE id BETWEEN 99100001 AND 99100024;

INSERT INTO oddfi_fixtures
  (id, league_id, name, starting_at, starting_at_timestamp, state_id,
   home_team_id, home_team_name, away_team_id, away_team_name, has_odds,
   created_at, updated_at)
SELECT
  99100000 + id,
  991,
  CONCAT('PRD24 Case ', LPAD(id, 2, '0'), ' ', title),
  NOW(),
  UNIX_TIMESTAMP(NOW()),
  5,
  991001,
  'PRD24 Home',
  991002,
  'PRD24 Away',
  1,
  NOW(3),
  NOW(3)
FROM prd24_cases;

INSERT INTO oddfi_fixture_results
  (fixture_id, state_id, state_code, state_name,
   home_score_full, away_score_full, home_score_half, away_score_half,
   home_score_extra, away_score_extra, home_score_penalty, away_score_penalty,
   raw_score_data, raw_state_date, settlement_status, remark, created_at, updated_at)
SELECT
  99100000 + id,
  5,
  'FT',
  'Fulltime',
  home_score,
  away_score,
  0,
  0,
  NULL,
  NULL,
  NULL,
  NULL,
  JSON_ARRAY(
    JSON_OBJECT('description', 'CURRENT', 'score', JSON_OBJECT('goals', home_score, 'participant', 'home')),
    JSON_OBJECT('description', 'CURRENT', 'score', JSON_OBJECT('goals', away_score, 'participant', 'away'))
  ),
  JSON_OBJECT('id', 5, 'state', 'FT', 'name', 'Fulltime'),
  'PENDING',
  '',
  NOW(3),
  NOW(3)
FROM prd24_cases;

INSERT INTO oddfi_odds
  (odd_id, fixture_id, market_id, bookmaker_id, label, fixture_name, fixture_time,
   value, market_description, handicap, total, winning, stopped, selection, updated_at)
SELECT
  9910000000 + id,
  99100000 + id,
  CASE market WHEN 'fulltime_result' THEN 1 WHEN 'handicap' THEN 6 ELSE 7 END,
  20,
  label,
  CONCAT('PRD24 Case ', LPAD(id, 2, '0'), ' ', title),
  DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'),
  '2.0000',
  CASE market WHEN 'fulltime_result' THEN 'Match Winner' WHEN 'handicap' THEN 'Asian Handicap' ELSE 'Goal Line' END,
  CASE WHEN market = 'handicap' THEN CAST(handicap_line AS CHAR) ELSE '' END,
  CASE WHEN market = 'overunder' THEN CAST(handicap_line AS CHAR) ELSE '' END,
  0,
  0,
  label,
  UNIX_TIMESTAMP(NOW())
FROM prd24_cases;

INSERT INTO user_balance
  (user_id, coin_symbol, available_balance, claimable_balance, frozen_balance,
   bet_lock_balance, stake_lock_balance, liq_lock_balance, update_time)
VALUES
  (@prd24_user_id, '', 100000.000000000000000000, 0.000000000000000000, 0.000000000000000000,
   2400.000000000000000000, 0.000000000000000000, 0.000000000000000000, NOW());

INSERT INTO asset_ledger
  (user_id, business_type, amount, balance_before, balance_after, ref_id, token_address, created_at,
   frozen_before, frozen_after, bet_lock_before, stake_lock_before, liq_lock_before,
   bet_lock_after, stake_lock_after, liq_lock_after)
VALUES
  (@prd24_user_id, 'single', -2400.000000000000000000, 102400.000000000000000000, 100000.000000000000000000,
   'prd24-lock', '', NOW(),
   0, 0, 0, 0, 0, 2400.000000000000000000, 0, 0);

INSERT INTO user_bet_holding
  (user_id, odd_id, stake, odds, payout, status, type, market, label,
   handicap_line, estimated_payout, actual_payout, created_at, updated_at, client_ref_id)
SELECT
  @prd24_user_id,
  9910000000 + id,
  100.00,
  2.0000,
  200.00,
  'live',
  'single',
  market,
  label,
  handicap_line,
  200.00,
  0.00,
  NOW(3),
  NOW(3),
  CONCAT('prd24-', LPAD(id, 2, '0'))
FROM prd24_cases;

SELECT
  COUNT(*) AS prd24_bet_count,
  COUNT(*) * 100 AS total_stake,
  SUM(expected_payout) AS expected_claimable
FROM prd24_cases;
