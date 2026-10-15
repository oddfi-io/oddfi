USE oddfi_dev;

-- PRD 24 条 worker E2E 断言脚本；任一状态、派彩、余额或赛果状态不符都会返回失败。
SET @prd24_user_id := 2043000000000000024;

DROP TEMPORARY TABLE IF EXISTS prd24_expected;
CREATE TEMPORARY TABLE prd24_expected (
  id INT NOT NULL PRIMARY KEY,
  expected_status VARCHAR(20) NOT NULL,
  expected_payout DECIMAL(16,2) NOT NULL
);

INSERT INTO prd24_expected (id, expected_status, expected_payout)
VALUES
  (1, 'WON', 200.00),
  (2, 'LOST', 0.00),
  (3, 'WON', 200.00),
  (4, 'LOST', 0.00),
  (5, 'WON', 200.00),
  (6, 'PUSH', 90.00),
  (7, 'LOST', 0.00),
  (8, 'WON', 200.00),
  (9, 'LOST', 0.00),
  (10, 'WON', 200.00),
  (11, 'LOST', 0.00),
  (12, 'WON', 200.00),
  (13, 'LOST', 0.00),
  (14, 'WON', 200.00),
  (15, 'PUSH', 90.00),
  (16, 'LOST', 0.00),
  (17, 'WON', 200.00),
  (18, 'LOST', 0.00),
  (19, 'WON', 200.00),
  (20, 'LOST', 0.00),
  (21, 'WON', 200.00),
  (22, 'LOST', 0.00),
  (23, 'WON', 200.00),
  (24, 'LOST', 0.00);

SELECT
  e.id,
  e.expected_status,
  b.status AS actual_status,
  e.expected_payout,
  b.actual_payout
FROM prd24_expected e
LEFT JOIN user_bet_holding b
  ON b.client_ref_id = CONCAT('prd24-', LPAD(e.id, 2, '0'))
WHERE b.id IS NULL
   OR BINARY b.status <> BINARY e.expected_status
   OR b.actual_payout <> e.expected_payout
ORDER BY e.id;

SET @prd24_bet_mismatch_count := (
  SELECT COUNT(*)
  FROM prd24_expected e
  LEFT JOIN user_bet_holding b
    ON b.client_ref_id = CONCAT('prd24-', LPAD(e.id, 2, '0'))
  WHERE b.id IS NULL
     OR BINARY b.status <> BINARY e.expected_status
     OR b.actual_payout <> e.expected_payout
);

SET @prd24_balance_mismatch_count := (
  SELECT COUNT(*)
  FROM user_balance
  WHERE user_id = @prd24_user_id
    AND (
      bet_lock_balance <> 0.000000000000000000
      OR claimable_balance <> 2380.000000000000000000
    )
);

SET @prd24_balance_missing_count := (
  SELECT IF(COUNT(*) = 1, 0, 1)
  FROM user_balance
  WHERE user_id = @prd24_user_id
);

SET @prd24_result_mismatch_count := (
  SELECT COUNT(*)
  FROM oddfi_fixture_results
  WHERE fixture_id BETWEEN 99100001 AND 99100024
    AND settlement_status <> 'PROCESSED'
);

SET @prd24_result_missing_count := (
  SELECT 24 - COUNT(*)
  FROM oddfi_fixture_results
  WHERE fixture_id BETWEEN 99100001 AND 99100024
);

SET @prd24_failure_count :=
  @prd24_bet_mismatch_count
  + @prd24_balance_mismatch_count
  + @prd24_balance_missing_count
  + @prd24_result_mismatch_count
  + @prd24_result_missing_count;

SELECT
  @prd24_bet_mismatch_count AS bet_mismatch_count,
  @prd24_balance_mismatch_count AS balance_mismatch_count,
  @prd24_balance_missing_count AS balance_missing_count,
  @prd24_result_mismatch_count AS result_mismatch_count,
  @prd24_result_missing_count AS result_missing_count,
  @prd24_failure_count AS failure_count;

SET @prd24_assert_sql := IF(
  @prd24_failure_count = 0,
  'SELECT ''PRD24_E2E_PASS'' AS assertion_result',
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''PRD24_E2E_FAIL'''
);
PREPARE prd24_assert_stmt FROM @prd24_assert_sql;
EXECUTE prd24_assert_stmt;
DEALLOCATE PREPARE prd24_assert_stmt;
