-- 预售运营操作审计表（admin → web-api RPC，从 admin DB 搬迁到 web-api DB）
-- DD-003 v3.1：admin-backend 通过 internal endpoint 调 web-api，业务 + audit + idempotency 同事务原子写入
-- 回滚：DROP TABLE presale_admin_audit;
CREATE TABLE `presale_admin_audit` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `operator`          VARCHAR(64)     NOT NULL COMMENT 'lark_user_id（admin JWT.sub 去掉 lark: 前缀）',
  `operator_role`     VARCHAR(32)     NULL     COMMENT 'super_admin / operator / customer_service / finance',
  `action`            VARCHAR(48)     NOT NULL COMMENT 'pause / resume / reopen / close / update_round / update_config / anomaly_resolve / migrate_round',
  `target_type`       VARCHAR(32)     NOT NULL COMMENT 'round / deposit / config / anomaly',
  `target_id`         VARCHAR(64)     NOT NULL,
  `before_json`       TEXT            NULL     COMMENT '变更前快照 JSON',
  `after_json`        TEXT            NULL     COMMENT '变更后快照 JSON',
  `source`            VARCHAR(16)     NOT NULL DEFAULT 'api' COMMENT 'api / script',
  `ip`                VARCHAR(64)     NULL     COMMENT 'admin-backend 透传的 operator 真实 IP（X-Forwarded-For）',
  `note`              TEXT            NOT NULL COMMENT '操作人必填备注（≥10 字符）',
  `service_secret_id` VARCHAR(16)     NULL     COMMENT 'HMAC secret 哈希前 8 字节（DD-003 v3 §4.3），泄漏排查用',
  `original_request_id` VARCHAR(64)   NULL     COMMENT 'admin-backend 透传的 X-Request-ID，重放追踪',
  `created_at`        BIGINT          NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_operator_ts` (`operator`, `created_at`),
  KEY `idx_target` (`target_type`, `target_id`),
  KEY `idx_action_ts` (`action`, `created_at`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='admin 操作审计（web-api 进程内同 tx 写入）';

-- DB 权限约定：prod 环境 web-api 用户对本表有 INSERT + SELECT 权限即可（admin operator 操作触发）
-- 监管合规要求 5-7 年留存，永不 DELETE
