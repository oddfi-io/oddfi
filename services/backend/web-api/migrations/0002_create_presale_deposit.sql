-- migrations/0002_create_presale_deposit.sql
-- 预售入账记录（V3 替代 presale_order）
-- uk_(tx_hash, log_index) 是双轨幂等锁核心：前端 report-tx 和 Worker 扫块都调用 CreateOrGet，
-- 只有第一个调用方落库，第二个拿到已有记录，保证同一链上事件只入账一次

CREATE TABLE `presale_deposit` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tx_hash`           VARCHAR(66)     NOT NULL COMMENT '链上 USDT Transfer tx, 小写',
  `log_index`         INT UNSIGNED    NOT NULL COMMENT '同 tx 内的 log index',
  `block_number`      BIGINT UNSIGNED NOT NULL,
  `block_timestamp`   BIGINT          NOT NULL COMMENT '区块时间戳 ms (从 receipt 解析)',
  `user_id`           BIGINT UNSIGNED NOT NULL COMMENT '按 eoa_address 反查 user.id',
  `eoa_address`       VARCHAR(42)     NOT NULL COMMENT 'tx.from, 小写 0x...',
  `vault_address`     VARCHAR(42)     NOT NULL COMMENT '收款金库地址快照 (支持多金库切换)',
  `round_id`          VARCHAR(32)     NOT NULL COMMENT '到账时所属轮次 (按 block_timestamp + 5min 容差)',
  `amount_usdt`       DECIMAL(38,18)  NOT NULL COMMENT '实际到账金额',
  `price_usd`         DECIMAL(38,18)  NOT NULL COMMENT '轮次价格快照',
  `shares_odd`        DECIMAL(38,18)  NOT NULL COMMENT 'amount_usdt / price_usd',
  `referrer_user_id`  BIGINT UNSIGNED NULL COMMENT '反查 user_referral_bind (绑定 ts < block_ts 才算)',
  `referrer_eoa`      VARCHAR(42)     NULL,
  `referral_reward_pct` DECIMAL(10,4) NULL COMMENT '快照轮次返佣比例',
  `referral_reward_odd` DECIMAL(38,18) NOT NULL DEFAULT 0 COMMENT 'shares_odd × pct / 100',
  `status`            VARCHAR(16)     NOT NULL DEFAULT 'pending' COMMENT 'pending(等区块确认)/confirmed(≥3 块)/anomaly(异常待处理)',
  `anomaly_reason`    VARCHAR(64)     NULL COMMENT 'overflow/from_mismatch/non_usdt/below_min/round_mismatch/late_arrival/no_referrer_record/...',
  `confirmed_at`      BIGINT          NULL,
  `expected_round_id` VARCHAR(32)     NULL COMMENT '前端 report-tx 携带的期望轮次 (anomaly 检测用)',
  `expected_amount`   DECIMAL(38,18)  NULL COMMENT '前端 report-tx 携带的期望金额',
  `source`            VARCHAR(16)     NOT NULL DEFAULT 'frontend' COMMENT 'frontend(前端上报)/worker(监听器扫到)',
  `created_at`        BIGINT          NOT NULL,
  `updated_at`        BIGINT          NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tx_log` (`tx_hash`, `log_index`),
  KEY `idx_user_block` (`user_id`, `block_timestamp`),
  KEY `idx_eoa_block` (`eoa_address`, `block_timestamp`),
  KEY `idx_round_status` (`round_id`, `status`),
  KEY `idx_anomaly` (`status`, `anomaly_reason`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预售入账记录 (链上 USDT Transfer 真相)';
