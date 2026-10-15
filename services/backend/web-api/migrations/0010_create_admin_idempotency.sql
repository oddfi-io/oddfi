-- admin internal endpoint 幂等表（DD-003 v3.1 §4.3）
-- 与 audit 表解耦：90 天 cron 清理只动本表，audit 永不删
-- 回滚：DROP TABLE admin_idempotency;
CREATE TABLE `admin_idempotency` (
  `id`                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `idempotency_key`     VARCHAR(64)     NOT NULL COMMENT 'admin 前端 form 渲染时 crypto.randomUUID() 生成',
  `audit_id`            BIGINT UNSIGNED NULL     COMMENT 'FK presale_admin_audit.id，handler 成功后同 tx 填入',
  `request_path`        VARCHAR(255)    NOT NULL,
  `request_body_hash`   CHAR(64)        NOT NULL COMMENT 'sha256(body) hex；同 key 不同 body 触发 409',
  `response_status`     INT             NULL     COMMENT 'HTTP 状态码缓存',
  `response_snapshot`   MEDIUMTEXT      NULL     COMMENT '处理结果 JSON 缓存；重放注入 _replayed: true',
  `original_request_id` VARCHAR(64)     NULL     COMMENT '首次处理时的 X-Request-ID',
  `created_at`          BIGINT          NOT NULL,
  `expires_at`          BIGINT          NOT NULL COMMENT '90 天后过期；cron 清理用',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_idempotency_key` (`idempotency_key`),
  KEY `idx_expires` (`expires_at`),
  KEY `idx_audit_id` (`audit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='admin 操作幂等表（与 audit 解耦，90 天 TTL）';
