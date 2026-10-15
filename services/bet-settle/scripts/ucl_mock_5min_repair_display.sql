USE project_oddfi;

-- 只修复 99200001 mock 赛事的静态展示字段，不改 starting_at/stopped/比分/注单，避免打断当前 5 分钟轮次。
SET @mock_fixture_id := 99200001;

UPDATE oddfi_fixtures
SET
  name = '葡萄牙 vs 阿根廷',
  home_team_name = '葡萄牙',
  home_team_logo = 'https://cdn.sportmonks.com/images/soccer/teams/13/18701.png',
  home_team_short_code = 'POR',
  away_team_name = '阿根廷',
  away_team_logo = 'https://cdn.sportmonks.com/images/soccer/teams/20/18644.png',
  away_team_short_code = 'ARG',
  updated_at = NOW(3)
WHERE id = @mock_fixture_id;

-- label 对齐 SportMonks：盘口方向只放 Home/Away/Over/Under，具体让球/大小球数值继续放 handicap/total。
UPDATE oddfi_odds
SET
  fixture_name = '葡萄牙 vs 阿根廷',
  label = CASE odd_id
    WHEN 9920000101 THEN 'Home'
    WHEN 9920000102 THEN 'Draw'
    WHEN 9920000103 THEN 'Away'
    WHEN 9920000104 THEN 'Home'
    WHEN 9920000105 THEN 'Away'
    WHEN 9920000106 THEN 'Home'
    WHEN 9920000107 THEN 'Away'
    WHEN 9920000108 THEN 'Home'
    WHEN 9920000109 THEN 'Away'
    WHEN 9920000110 THEN 'Over'
    WHEN 9920000111 THEN 'Under'
    WHEN 9920000112 THEN 'Over'
    WHEN 9920000113 THEN 'Under'
    WHEN 9920000114 THEN 'Over'
    WHEN 9920000115 THEN 'Under'
    ELSE label
  END,
  selection = CASE odd_id
    WHEN 9920000101 THEN 'Home'
    WHEN 9920000102 THEN 'Draw'
    WHEN 9920000103 THEN 'Away'
    WHEN 9920000104 THEN 'Home'
    WHEN 9920000105 THEN 'Away'
    WHEN 9920000106 THEN 'Home'
    WHEN 9920000107 THEN 'Away'
    WHEN 9920000108 THEN 'Home'
    WHEN 9920000109 THEN 'Away'
    WHEN 9920000110 THEN 'Over'
    WHEN 9920000111 THEN 'Under'
    WHEN 9920000112 THEN 'Over'
    WHEN 9920000113 THEN 'Under'
    WHEN 9920000114 THEN 'Over'
    WHEN 9920000115 THEN 'Under'
    ELSE selection
  END,
  handicap = CASE odd_id
    WHEN 9920000104 THEN '-0.5'
    WHEN 9920000105 THEN '0.5'
    WHEN 9920000106 THEN '-1.0'
    WHEN 9920000107 THEN '1.0'
    WHEN 9920000108 THEN '-1.5'
    WHEN 9920000109 THEN '1.5'
    ELSE handicap
  END,
  total = CASE odd_id
    WHEN 9920000110 THEN '1.5'
    WHEN 9920000111 THEN '1.5'
    WHEN 9920000112 THEN '2.5'
    WHEN 9920000113 THEN '2.5'
    WHEN 9920000114 THEN '3.5'
    WHEN 9920000115 THEN '3.5'
    ELSE total
  END,
  updated_at = UNIX_TIMESTAMP(NOW(3)) * 1000
WHERE fixture_id = @mock_fixture_id
  AND odd_id BETWEEN 9920000101 AND 9920000115;

SELECT
  f.id,
  f.name,
  f.home_team_logo,
  f.away_team_logo,
  COUNT(o.odd_id) AS odds_count,
  SUM(CASE WHEN o.market_id = 6 AND o.label IN ('Home', 'Away') AND o.handicap <> '' THEN 1 ELSE 0 END) AS handicap_label_ok_count,
  SUM(CASE WHEN o.market_id = 7 AND o.label IN ('Over', 'Under') AND o.total <> '' THEN 1 ELSE 0 END) AS total_label_ok_count
FROM oddfi_fixtures f
LEFT JOIN oddfi_odds o ON o.fixture_id = f.id
WHERE f.id = @mock_fixture_id
GROUP BY f.id, f.name, f.home_team_logo, f.away_team_logo;
