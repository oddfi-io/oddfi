USE project_oddfi;

-- 欧冠 5 分钟 mock 盘基础数据。生产执行时先切到目标库，fixture_id/odd_id 使用高位固定 ID，避免碰撞真实 SportMonks 数据。
SET @mock_fixture_id := 99200001;
SET @mock_close_at := DATE_ADD(NOW(), INTERVAL 240 SECOND);

-- 结算 worker 会写 raw_state_data；老库如果只有 raw_state_date，需要先补兼容列。
SET @add_raw_state_data_sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE oddfi_fixture_results ADD COLUMN raw_state_data JSON NULL AFTER raw_state_date',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'oddfi_fixture_results'
    AND column_name = 'raw_state_data'
);
PREPARE add_raw_state_data_stmt FROM @add_raw_state_data_sql;
EXECUTE add_raw_state_data_stmt;
DEALLOCATE PREPARE add_raw_state_data_stmt;

INSERT INTO oddfi_fixtures
  (id, league_id, name, starting_at, starting_at_timestamp, state_id,
   stage_id, season_id,
   home_team_id, home_team_name, home_team_logo, home_team_country_id,
   home_team_meta_location, home_type, home_team_meta_winner, home_team_short_code,
   away_team_id, away_team_name, away_team_logo, away_team_country_id,
   away_team_meta_location, away_type, away_team_meta_winner, away_team_short_code,
   has_odds, created_at, updated_at)
VALUES
  (@mock_fixture_id, 2, '葡萄牙 vs 阿根廷', @mock_close_at, UNIX_TIMESTAMP(@mock_close_at), 1,
   992, 202604,
   992001, '葡萄牙', 'https://cdn.sportmonks.com/images/soccer/teams/13/18701.png', 20,
   'home', 'team', 0, 'POR',
   992002, '阿根廷', 'https://cdn.sportmonks.com/images/soccer/teams/20/18644.png', 44,
   'away', 'team', 0, 'ARG',
   1, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE
  league_id = VALUES(league_id),
  name = VALUES(name),
  starting_at = VALUES(starting_at),
  starting_at_timestamp = VALUES(starting_at_timestamp),
  state_id = 1,
  stage_id = VALUES(stage_id),
  season_id = VALUES(season_id),
  home_team_id = VALUES(home_team_id),
  home_team_name = VALUES(home_team_name),
  home_team_logo = VALUES(home_team_logo),
  home_team_country_id = VALUES(home_team_country_id),
  home_team_meta_location = VALUES(home_team_meta_location),
  home_type = VALUES(home_type),
  home_team_meta_winner = 0,
  home_team_short_code = VALUES(home_team_short_code),
  away_team_id = VALUES(away_team_id),
  away_team_name = VALUES(away_team_name),
  away_team_logo = VALUES(away_team_logo),
  away_team_country_id = VALUES(away_team_country_id),
  away_team_meta_location = VALUES(away_team_meta_location),
  away_type = VALUES(away_type),
  away_team_meta_winner = 0,
  away_team_short_code = VALUES(away_team_short_code),
  has_odds = 1,
  updated_at = NOW(3);

INSERT INTO oddfi_fixture_results
  (fixture_id, state_id, state_code, state_name,
   home_score_full, away_score_full, home_score_half, away_score_half,
   home_score_extra, away_score_extra, home_score_penalty, away_score_penalty,
   raw_score_data, raw_state_data, settlement_status, remark, created_at, updated_at)
VALUES
  (@mock_fixture_id, 1, 'NS', 'Not Started',
   0, 0, 0, 0,
   NULL, NULL, NULL, NULL,
   JSON_ARRAY(), JSON_OBJECT('id', 1, 'state', 'NS', 'name', 'Not Started'),
   'PENDING', JSON_OBJECT('activity_id', 'UCL_MOCK_5MIN'), NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE
  state_id = 1,
  state_code = 'NS',
  state_name = 'Not Started',
  home_score_full = 0,
  away_score_full = 0,
  raw_score_data = JSON_ARRAY(),
  raw_state_data = JSON_OBJECT('id', 1, 'state', 'NS', 'name', 'Not Started'),
  settlement_status = 'PENDING',
  remark = JSON_OBJECT('activity_id', 'UCL_MOCK_5MIN'),
  updated_at = NOW(3);

INSERT INTO oddfi_odds
  (odd_id, fixture_id, market_id, bookmaker_id, label, fixture_name, fixture_time,
   value, market_description, handicap, total, winning, stopped, selection, updated_at)
VALUES
  (9920000101, @mock_fixture_id, 1, 20, 'Home', '葡萄牙 vs 阿根廷', DATE_FORMAT(@mock_close_at, '%Y-%m-%d %H:%i:%s'),
   '2.10', 'Fulltime Result', '', '', 0, 0, 'Home', UNIX_TIMESTAMP(NOW(3)) * 1000),
  (9920000102, @mock_fixture_id, 1, 20, 'Draw', '葡萄牙 vs 阿根廷', DATE_FORMAT(@mock_close_at, '%Y-%m-%d %H:%i:%s'),
   '3.40', 'Fulltime Result', '', '', 0, 0, 'Draw', UNIX_TIMESTAMP(NOW(3)) * 1000),
  (9920000103, @mock_fixture_id, 1, 20, 'Away', '葡萄牙 vs 阿根廷', DATE_FORMAT(@mock_close_at, '%Y-%m-%d %H:%i:%s'),
   '3.20', 'Fulltime Result', '', '', 0, 0, 'Away', UNIX_TIMESTAMP(NOW(3)) * 1000),
  (9920000104, @mock_fixture_id, 6, 20, 'Home', '葡萄牙 vs 阿根廷', DATE_FORMAT(@mock_close_at, '%Y-%m-%d %H:%i:%s'),
   '1.95', 'Asian Handicap', '-0.5', '', 0, 0, 'Home', UNIX_TIMESTAMP(NOW(3)) * 1000),
  (9920000105, @mock_fixture_id, 6, 20, 'Away', '葡萄牙 vs 阿根廷', DATE_FORMAT(@mock_close_at, '%Y-%m-%d %H:%i:%s'),
   '1.85', 'Asian Handicap', '0.5', '', 0, 0, 'Away', UNIX_TIMESTAMP(NOW(3)) * 1000),
  (9920000106, @mock_fixture_id, 6, 20, 'Home', '葡萄牙 vs 阿根廷', DATE_FORMAT(@mock_close_at, '%Y-%m-%d %H:%i:%s'),
   '2.50', 'Asian Handicap', '-1.0', '', 0, 0, 'Home', UNIX_TIMESTAMP(NOW(3)) * 1000),
  (9920000107, @mock_fixture_id, 6, 20, 'Away', '葡萄牙 vs 阿根廷', DATE_FORMAT(@mock_close_at, '%Y-%m-%d %H:%i:%s'),
   '1.55', 'Asian Handicap', '1.0', '', 0, 0, 'Away', UNIX_TIMESTAMP(NOW(3)) * 1000),
  (9920000108, @mock_fixture_id, 6, 20, 'Home', '葡萄牙 vs 阿根廷', DATE_FORMAT(@mock_close_at, '%Y-%m-%d %H:%i:%s'),
   '3.10', 'Asian Handicap', '-1.5', '', 0, 0, 'Home', UNIX_TIMESTAMP(NOW(3)) * 1000),
  (9920000109, @mock_fixture_id, 6, 20, 'Away', '葡萄牙 vs 阿根廷', DATE_FORMAT(@mock_close_at, '%Y-%m-%d %H:%i:%s'),
   '1.35', 'Asian Handicap', '1.5', '', 0, 0, 'Away', UNIX_TIMESTAMP(NOW(3)) * 1000),
  (9920000110, @mock_fixture_id, 7, 20, 'Over', '葡萄牙 vs 阿根廷', DATE_FORMAT(@mock_close_at, '%Y-%m-%d %H:%i:%s'),
   '1.40', 'Asian Over/Under', '', '1.5', 0, 0, 'Over', UNIX_TIMESTAMP(NOW(3)) * 1000),
  (9920000111, @mock_fixture_id, 7, 20, 'Under', '葡萄牙 vs 阿根廷', DATE_FORMAT(@mock_close_at, '%Y-%m-%d %H:%i:%s'),
   '2.85', 'Asian Over/Under', '', '1.5', 0, 0, 'Under', UNIX_TIMESTAMP(NOW(3)) * 1000),
  (9920000112, @mock_fixture_id, 7, 20, 'Over', '葡萄牙 vs 阿根廷', DATE_FORMAT(@mock_close_at, '%Y-%m-%d %H:%i:%s'),
   '1.90', 'Asian Over/Under', '', '2.5', 0, 0, 'Over', UNIX_TIMESTAMP(NOW(3)) * 1000),
  (9920000113, @mock_fixture_id, 7, 20, 'Under', '葡萄牙 vs 阿根廷', DATE_FORMAT(@mock_close_at, '%Y-%m-%d %H:%i:%s'),
   '1.90', 'Asian Over/Under', '', '2.5', 0, 0, 'Under', UNIX_TIMESTAMP(NOW(3)) * 1000),
  (9920000114, @mock_fixture_id, 7, 20, 'Over', '葡萄牙 vs 阿根廷', DATE_FORMAT(@mock_close_at, '%Y-%m-%d %H:%i:%s'),
   '2.70', 'Asian Over/Under', '', '3.5', 0, 0, 'Over', UNIX_TIMESTAMP(NOW(3)) * 1000),
  (9920000115, @mock_fixture_id, 7, 20, 'Under', '葡萄牙 vs 阿根廷', DATE_FORMAT(@mock_close_at, '%Y-%m-%d %H:%i:%s'),
   '1.45', 'Asian Over/Under', '', '3.5', 0, 0, 'Under', UNIX_TIMESTAMP(NOW(3)) * 1000)
ON DUPLICATE KEY UPDATE
  fixture_id = VALUES(fixture_id),
  market_id = VALUES(market_id),
  bookmaker_id = VALUES(bookmaker_id),
  label = VALUES(label),
  fixture_name = VALUES(fixture_name),
  fixture_time = VALUES(fixture_time),
  value = VALUES(value),
  market_description = VALUES(market_description),
  handicap = VALUES(handicap),
  total = VALUES(total),
  winning = 0,
  stopped = 0,
  selection = VALUES(selection),
  updated_at = VALUES(updated_at);

SELECT 'UCL_MOCK_5MIN_SEED_OK' AS seed_result,
       @mock_fixture_id AS fixture_id,
       @mock_close_at AS round_close_at;
