-- migrations/0005_create_presale_event_cursor.sql
-- 监听器游标表：每个金库地址一条记录，Worker 启动时通过 EnsureAll 按 env PRESALE_VAULT_POOL 初始化
-- 游标和 deposit 在同一事务内提交，保证漏块/重放时能安全 replay

CREATE TABLE `presale_event_cursor` (
  `vault_address`     VARCHAR(42)     NOT NULL COMMENT '金库地址 (多金库地址池每个一条游标)',
  `last_block_number` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `last_log_index`    INT UNSIGNED    NOT NULL DEFAULT 0,
  `updated_at`        BIGINT          NOT NULL,
  PRIMARY KEY (`vault_address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='监听器游标 (每金库地址一条)';
