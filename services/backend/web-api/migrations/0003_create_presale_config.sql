-- migrations/0003_create_presale_config.sql
-- 预售全局配置单行表
-- CHECK (id = 1) 保证单行约束（MySQL 8.0+），升级 5.7 时需去掉该约束改用 GORM BeforeCreate 硬编码 id=1

CREATE TABLE `presale_config` (
  `id`                  TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '单行表, PK=1',
  `tge_ts`              BIGINT           NOT NULL COMMENT 'TGE 时间 ms (运营可改, 与轮次时间窗解耦)',
  `tge_open_price_usd`  DECIMAL(38,18)   NOT NULL COMMENT 'PRD 设定的 TGE 开盘基准价 (营销折扣计算用, 不依赖市价)',
  `vault_address`       VARCHAR(42)      NOT NULL COMMENT '当前金库地址 (env 备份, 此处为运营友好可见)',
  `min_subscribe_usd`   DECIMAL(20,6)    NOT NULL DEFAULT 1000 COMMENT '全局最小认购 (前端预校验)',
  `boundary_tolerance_min` INT           NOT NULL DEFAULT 5 COMMENT '轮次切换后端容差分钟数',
  `total_target_usd`    DECIMAL(38,18)   NOT NULL DEFAULT 20000000 COMMENT 'PRD 全局目标 USD (独立于 6 轮 supply 之和)',
  `audit_label`         VARCHAR(64)      NULL     COMMENT '审计机构标签 (e.g. CertiK)',
  `lark_webhook_url`    VARCHAR(255)     NULL     COMMENT 'anomaly Lark 通知 URL',
  `updated_at`          BIGINT           NOT NULL,
  PRIMARY KEY (`id`),
  CHECK (`id` = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预售全局配置 (单行表)';

-- 初始行：上线前替换真实金库地址和 Lark webhook URL
INSERT IGNORE INTO presale_config
    (id, tge_ts, tge_open_price_usd, vault_address,
     min_subscribe_usd, boundary_tolerance_min, total_target_usd,
     lark_webhook_url, updated_at)
VALUES
    (1,
     1749571200000,
     0.100000000000000000,
     '0x0000000000000000000000000000000000000001',
     1000.000000,
     5,
     20000000.000000000000000000,
     '',
     UNIX_TIMESTAMP(NOW())*1000
    );
