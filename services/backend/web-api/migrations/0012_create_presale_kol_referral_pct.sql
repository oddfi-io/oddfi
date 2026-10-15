-- REQ-004 · KOL 独立返佣比例表
--
-- 用途：admin 后台维护"按 KOL EOA 自定义返佣 %"白名单。
-- deposit 确认（ConfirmDeposit / ReportTx 落 confirmed 时）按 referrer_eoa
-- 查此表，命中则用 referral_pct 覆盖 round.referral_reward_pct；未命中走
-- 全局轮次比例（默认行为不变）。
--
-- 设计要点：
--   - referrer_eoa 强制小写存（写入侧 strings.ToLower），PK 自带唯一保护
--   - referral_pct ∈ [0, 100]，精度 4 位（8.0000 = 8%）
--   - 不区分轮次 — 一个 EOA 一个比例，跨轮共用（REQ-004 §"不做什么"明文）
--   - 历史 deposit 已快照 referral_reward_pct，本表只影响新增 deposit
--
-- 回滚（运维窗口外不再需要时）：DROP TABLE presale_kol_referral_pct;

CREATE TABLE IF NOT EXISTS `presale_kol_referral_pct` (
    `referrer_eoa`  VARCHAR(42)   NOT NULL              COMMENT 'KOL EOA 地址（小写存）',
    `referral_pct`  DECIMAL(10,4) NOT NULL              COMMENT '自定义返佣比例（%），如 8.0000 表示 8%',
    `note`          VARCHAR(256)  DEFAULT NULL          COMMENT '运营备注（可空）',
    `created_by`    VARCHAR(64)   NOT NULL              COMMENT '操作者 lark_user_id（同 admin_audit）',
    `created_at`    BIGINT        NOT NULL              COMMENT '创建时刻 unix ms',
    `updated_at`    BIGINT        NOT NULL              COMMENT '更新时刻 unix ms',
    PRIMARY KEY (`referrer_eoa`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='REQ-004 KOL 独立返佣比例（admin 维护，deposit 落 confirmed 时读取覆盖轮次默认比例）';
