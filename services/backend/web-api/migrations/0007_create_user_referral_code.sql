-- migrations/0007_create_user_referral_code.sql
-- 邀请码表（站点级，无 presale_ 前缀，后续其他业务可复用）
-- 格式: 0x + 6 位 [2-9A-HJ-NP-Z]（30 字符集，去 0/O/1/I/L），30^6 ≈ 729M 空间
-- 用户首次钱包登录时由 JWT middleware hook 自动生成（CSPRNG + 5 次重试）

CREATE TABLE `user_referral_code` (
  `user_id`     BIGINT UNSIGNED NOT NULL,
  `eoa_address` VARCHAR(42)     NOT NULL,
  `code`        VARCHAR(8)      NOT NULL COMMENT '格式: 0x + 6 位 [2-9A-HJ-NP-Z], 例 0xH7K9X2',
  `created_at`  BIGINT          NOT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uk_code` (`code`),
  UNIQUE KEY `uk_eoa` (`eoa_address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邀请码 (站点级, 用户首次登录自动生成)';
