-- migrations/0006_create_presale_ops_event.sql
-- 预售异常事件待处理表
-- 所有校验失败（overflow/unclaimed/round_mismatch/...）都落此表，由运营通过 admin 后台 + 预案脚本处理

CREATE TABLE `presale_ops_event` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_type`     VARCHAR(32)     NOT NULL COMMENT 'overflow/unclaimed/round_mismatch/late_arrival/...（同 anomaly_reason）',
  `deposit_id`     BIGINT UNSIGNED NULL COMMENT '关联 presale_deposit.id (unclaimed 类无关联)',
  `tx_hash`        VARCHAR(66)     NULL,
  `eoa_address`    VARCHAR(42)     NULL,
  `amount_usdt`    DECIMAL(38,18)  NULL,
  `payload_json`   TEXT            NULL COMMENT '额外上下文 (期望轮次 / 期望金额 / referrer_code / 等)',
  `status`         VARCHAR(16)     NOT NULL DEFAULT 'pending' COMMENT 'pending/notified/resolved/rejected',
  `lark_msg_id`    VARCHAR(64)     NULL COMMENT 'Lark webhook 推送返回的 message_id',
  `resolved_by`    VARCHAR(64)     NULL COMMENT 'admin user / script:filename',
  `resolved_at`    BIGINT          NULL,
  `resolve_note`   TEXT            NULL,
  `created_at`     BIGINT          NOT NULL,
  `updated_at`     BIGINT          NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_status_created` (`status`, `created_at`),
  KEY `idx_tx` (`tx_hash`),
  KEY `idx_deposit` (`deposit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预售异常事件待处理';
