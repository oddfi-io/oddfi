-- BUG-001 B7 · INV-6 跨时钟域容差修复历史回填去重表
--
-- 用途：cmd/inv6-backfill 工具的应用层 + DB 层双重去重防线
-- PK=deposit_id 保证同一笔 deposit 跨多次工具运行只能被回填一次，
-- 配合 INSERT IGNORE → rows_affected=0 即 skip 后续 holding UpsertReferral。
-- 任何"误重跑 apply"都不会让 holding 总值被累加翻倍。
--
-- 回滚（运维窗口外不再需要时）：DROP TABLE inv6_backfill_applied;
-- 反向扣减历史回填（极端情况）：见 BD.md §6.2

CREATE TABLE IF NOT EXISTS `inv6_backfill_applied` (
    `deposit_id`        BIGINT UNSIGNED NOT NULL COMMENT '被回填的 presale_deposit.id（PK 兼幂等键）',
    `applied_at`        BIGINT NOT NULL          COMMENT '回填时刻 unix ms',
    `diff_ms`           BIGINT NOT NULL          COMMENT '回填判定时 bound_at - block_timestamp（毫秒，便于事后审计）',
    `referrer_user_id`  BIGINT UNSIGNED NOT NULL COMMENT '回填挂上的邀请人 user_id',
    `reward_odd`        VARCHAR(64) NOT NULL     COMMENT '本次回填累加进 holding 的 reward_odd（decimal 字符串）',
    `actor`             VARCHAR(64) NOT NULL     COMMENT '执行回填的操作员（CLI --actor 参数）',
    `reason`            VARCHAR(255)             COMMENT '运维说明（可选，便于事后追溯）',
    PRIMARY KEY (`deposit_id`),
    KEY `idx_applied_at` (`applied_at`),
    KEY `idx_referrer` (`referrer_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='BUG-001 INV-6 历史回填去重表（cmd/inv6-backfill 工具维护）';
