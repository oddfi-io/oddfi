-- migrations/0001_create_presale_round.sql
-- 预售轮次配置表（V3 Deposit-first 模型）
-- manual_override=1 时 cron 不自动推进状态，运营干预后须手动操作

CREATE TABLE `presale_round` (
  `id`                    VARCHAR(32)      NOT NULL COMMENT '轮次 ID, e.g. seed/strategic/ecosystem/public_a/public_b/public_c',
  `name`                  VARCHAR(64)      NOT NULL COMMENT '展示名, e.g. 种子轮',
  `round_type`            VARCHAR(16)      NOT NULL DEFAULT 'public' COMMENT 'private/public, 私募/公募',
  `price_usd`             DECIMAL(38,18)   NOT NULL COMMENT '单价 USD',
  `supply_odd`            DECIMAL(38,18)   NOT NULL COMMENT '本轮 ODD 总额度',
  `sold_odd`              DECIMAL(38,18)   NOT NULL DEFAULT 0 COMMENT '已售 ODD',
  `raised_usd`            DECIMAL(38,18)   NOT NULL DEFAULT 0 COMMENT '已募 USD',
  `target_raise_usd`      DECIMAL(38,18)   NOT NULL COMMENT '目标募集 USD (≈ supply × price)',
  `min_per_order_usd`     DECIMAL(20,6)    NULL     COMMENT '单笔下限 (NULL=无限制, 本期初始不配)',
  `max_per_wallet_usd`    DECIMAL(20,6)    NULL     COMMENT '单钱包累计上限 (NULL=无限制, 本期初始不配)',
  `tge_release_pct`       DECIMAL(5,2)     NOT NULL COMMENT 'TGE 即时释放比例 % (0~100), schema 落定本期不计算',
  `linear_release_days`   INT UNSIGNED     NOT NULL COMMENT '剩余线性释放天数, schema 落定本期不计算',
  `referral_reward_pct`   DECIMAL(10,4)    NOT NULL DEFAULT 10.0000 COMMENT '邀请奖励 % (基于被邀人本次 ODD 份额)',
  `referral_release_pct`  DECIMAL(5,2)     NOT NULL DEFAULT 100.00 COMMENT '邀请奖励 TGE 释放比例 (默认全释), schema 落定本期不计算',
  `referral_linear_days`  INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT '邀请奖励线性释放天数 (默认 0=一次性), schema 落定本期不计算',
  `start_ts`              BIGINT           NOT NULL COMMENT '开放时间 ms',
  `end_ts`                BIGINT           NOT NULL COMMENT '结束时间 ms',
  `status`                VARCHAR(16)      NOT NULL DEFAULT 'upcoming' COMMENT 'upcoming/active/paused/ended',
  `manual_override`       TINYINT(1)       NOT NULL DEFAULT 0 COMMENT '1=运营手动干预过, cron 不再自动推进',
  `badge`                 VARCHAR(16)      NULL     COMMENT 'hot/rec, 营销标签',
  `sort_order`            INT              NOT NULL DEFAULT 0,
  `created_at`            BIGINT           NOT NULL,
  `updated_at`            BIGINT           NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_status_sort` (`status`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预售轮次配置';
