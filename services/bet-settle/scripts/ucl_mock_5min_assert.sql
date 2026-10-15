USE oddfi_dev;

SET @mock_fixture_id := 99200001;

SELECT
  f.id,
  f.league_id,
  f.name,
  f.starting_at,
  f.state_id,
  f.has_odds,
  fr.state_code,
  fr.settlement_status,
  COUNT(o.odd_id) AS odds_count,
  SUM(CASE WHEN o.stopped = 0 THEN 1 ELSE 0 END) AS open_odds_count
FROM oddfi_fixtures f
LEFT JOIN oddfi_fixture_results fr ON fr.fixture_id = f.id
LEFT JOIN oddfi_odds o ON o.fixture_id = f.id
WHERE f.id = @mock_fixture_id
GROUP BY
  f.id, f.league_id, f.name, f.starting_at, f.state_id, f.has_odds,
  fr.state_code, fr.settlement_status;

SET @mock_fixture_missing_count := (
  SELECT IF(COUNT(*) = 1, 0, 1)
  FROM oddfi_fixtures
  WHERE id = @mock_fixture_id
    AND league_id = 2
    AND name = '葡萄牙 vs 阿根廷'
    AND home_team_logo = 'https://cdn.sportmonks.com/images/soccer/teams/13/18701.png'
    AND away_team_logo = 'https://cdn.sportmonks.com/images/soccer/teams/20/18644.png'
    AND has_odds = 1
);

SET @mock_result_missing_count := (
  SELECT IF(COUNT(*) = 1, 0, 1)
  FROM oddfi_fixture_results
  WHERE fixture_id = @mock_fixture_id
);

SET @mock_odds_mismatch_count := (
  SELECT IF(COUNT(*) = 15, 0, 1)
  FROM oddfi_odds
  WHERE fixture_id = @mock_fixture_id
);

SET @mock_required_market_count := (
  SELECT IF(COUNT(DISTINCT market_id) = 3, 0, 1)
  FROM oddfi_odds
  WHERE fixture_id = @mock_fixture_id
    AND market_id IN (1, 6, 7)
);

SET @mock_label_mismatch_count := (
  SELECT COUNT(*)
  FROM oddfi_odds
  WHERE fixture_id = @mock_fixture_id
    AND (
      fixture_name <> '葡萄牙 vs 阿根廷'
      OR (market_id = 1 AND label NOT IN ('Home', 'Draw', 'Away'))
      OR (market_id = 6 AND (label NOT IN ('Home', 'Away') OR handicap = ''))
      OR (market_id = 7 AND (label NOT IN ('Over', 'Under') OR total = ''))
    )
);

SET @mock_failure_count :=
  @mock_fixture_missing_count
  + @mock_result_missing_count
  + @mock_odds_mismatch_count
  + @mock_required_market_count
  + @mock_label_mismatch_count;

SELECT
  @mock_fixture_missing_count AS fixture_missing_count,
  @mock_result_missing_count AS result_missing_count,
  @mock_odds_mismatch_count AS odds_mismatch_count,
  @mock_required_market_count AS required_market_count,
  @mock_label_mismatch_count AS label_mismatch_count,
  @mock_failure_count AS failure_count;

SET @mock_assert_sql := IF(
  @mock_failure_count = 0,
  'SELECT ''UCL_MOCK_5MIN_ASSERT_PASS'' AS assertion_result',
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''UCL_MOCK_5MIN_ASSERT_FAIL'''
);
PREPARE mock_assert_stmt FROM @mock_assert_sql;
EXECUTE mock_assert_stmt;
DEALLOCATE PREPARE mock_assert_stmt;
