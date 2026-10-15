-- migrations/0008_create_user_referral_bind.sql
-- 邀请绑定关系表（站点级，一旦绑定不可撤销/不可改）
-- 单层关系：A 邀 B，B 邀 C，C 下单时只有 B 拿奖励（不递归到 A）
-- bound_at < block_timestamp 才能算作有效邀请关系（deposit 落库校验）

CREATE TABLE `user_referral_bind` (
  `user_id`           BIGINT UNSIGNED NOT NULL COMMENT '被邀请人',
  `eoa_address`       VARCHAR(42)     NOT NULL,
  `referrer_user_id`  BIGINT UNSIGNED NOT NULL COMMENT '邀请人',
  `referrer_eoa`      VARCHAR(42)     NOT NULL,
  `referrer_code`     VARCHAR(8)      NOT NULL COMMENT '快照绑定时的 code',
  `source`            VARCHAR(16)     NOT NULL COMMENT 'link/manual, 仅埋点',
  `business`          VARCHAR(32)     NOT NULL DEFAULT 'presale' COMMENT '触发绑定的业务来源 (站点级扩展用)',
  `bound_at`          BIGINT          NOT NULL,
  PRIMARY KEY (`user_id`),
  KEY `idx_referrer` (`referrer_user_id`, `bound_at`),
  KEY `idx_referrer_eoa` (`referrer_eoa`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邀请绑定 (站点级, 一次绑定不可改)';
