-- migrations/0004_create_presale_holding.sql
-- 预售持仓聚合表
-- uk_(user_id, round_id, source) 保证 upsert 正确性：
-- source=1(invest) 行维护 total_odd/invested_usd/locked_price_avg，
-- source=2(referral) 行只维护 total_odd，invested_usd/locked_price_avg 恒为 0

CREATE TABLE `presale_holding` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`           BIGINT UNSIGNED NOT NULL,
  `round_id`          VARCHAR(32)     NOT NULL,
  `source`            TINYINT         NOT NULL COMMENT '1=invest, 2=referral',
  `total_odd`         DECIMAL(38,18)  NOT NULL DEFAULT 0 COMMENT '累计获得 ODD',
  `invested_usd`      DECIMAL(38,18)  NOT NULL DEFAULT 0 COMMENT '累计投入 USD (referral 行恒为 0)',
  `locked_price_avg`  DECIMAL(38,18)  NOT NULL DEFAULT 0 COMMENT '加权平均成本价 (referral 行恒为 0)',
  `released_odd`      DECIMAL(38,18)  NOT NULL DEFAULT 0 COMMENT '已释放 ODD (本期不维护, 字段保留)',
  `claimed_odd`       DECIMAL(38,18)  NOT NULL DEFAULT 0 COMMENT '已 claim ODD (本期不维护)',
  `vesting_start_ts`  BIGINT          NULL COMMENT 'TGE_ts 锚定 (字段保留)',
  `vesting_end_ts`    BIGINT          NULL COMMENT 'TGE + linear_days (字段保留)',
  `created_at`        BIGINT          NOT NULL,
  `updated_at`        BIGINT          NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_round_source` (`user_id`, `round_id`, `source`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预售持仓聚合 (本期仅维护 total_odd / invested_usd / locked_price_avg)';
