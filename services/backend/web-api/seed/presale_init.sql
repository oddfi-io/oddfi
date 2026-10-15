-- web-api/seed/presale_init.sql
-- DD-INVEST V3 预售模块上线初始化数据
--
-- 来源真值：Lark TGE 文档 https://ygb8h37py5b.sg.larksuite.com/wiki/VLQ7w69bZiLC3kk4ivxlIFLBgsh
-- 修订日期：2026-05-26
-- 修订说明：原 Lark 文档时间窗 5/20-5/26 已过期，本次按今天 (2026-05-26) 重新安排前三轮
--           （SEED 5/26-5/28，STRATEGIC 5/28-5/29，ECOSYSTEM 5/29-5/30）；
--           PUBLIC_A/B/C 沿用 Lark 原计划 6/1 - 6/10。
--           5/30 - 6/1 有 2 天空窗期（无 active 轮次），前端 currentStage 需特殊态处理。
--
-- 幂等：`ON DUPLICATE KEY UPDATE id=id` 保证重跑不报错；
-- 注意：sold_odd / raised_usd 不在 UPDATE 列表，避免重跑覆盖累计值。
--
-- 上线前 cutover 必改字段（见 tasks.md §6）：
--   1. presale_config.vault_address：测试金库 → 正式金库（人类提供后由 SQL UPDATE 或 admin PATCH）
--   2. presale_config.min_subscribe_usd：0.01 → 1000（合并测试金库切换时一起做）

-- ============================================================================
-- 1. 6 轮预售配置
-- ============================================================================
INSERT INTO presale_round
    (id, name, round_type, price_usd, supply_odd, sold_odd, raised_usd,
     target_raise_usd, min_per_order_usd, max_per_wallet_usd,
     tge_release_pct, linear_release_days,
     referral_reward_pct, referral_release_pct, referral_linear_days,
     start_ts, end_ts, status, manual_override, sort_order,
     created_at, updated_at)
VALUES
    -- # 1 种子轮 SEED — 2026-05-26 00:00 → 2026-05-28 00:00 (UTC+8)
    ('seed',       '种子轮',    'private', 0.030000000000000000,  3000000, 0, 0,    90000, NULL, NULL, 10,  90, 10.0000, 100.00, 0, 1779724800000, 1779897600000, 'upcoming', 0, 1, UNIX_TIMESTAMP(NOW())*1000, UNIX_TIMESTAMP(NOW())*1000),
    -- # 2 战略轮 STRATEGIC — 2026-05-28 → 2026-05-29
    ('strategic',  '战略轮',    'private', 0.050000000000000000,  5000000, 0, 0,   250000, NULL, NULL, 20,  90, 10.0000, 100.00, 0, 1779897600000, 1779984000000, 'upcoming', 0, 2, UNIX_TIMESTAMP(NOW())*1000, UNIX_TIMESTAMP(NOW())*1000),
    -- # 3 生态轮 ECOSYSTEM — 2026-05-29 → 2026-05-30
    ('ecosystem',  '生态轮',    'private', 0.080000000000000000,  7000000, 0, 0,   560000, NULL, NULL, 30,  90, 10.0000, 100.00, 0, 1779984000000, 1780070400000, 'upcoming', 0, 3, UNIX_TIMESTAMP(NOW())*1000, UNIX_TIMESTAMP(NOW())*1000),
    -- # 4 公募 A PUBLIC_A — 2026-06-01 → 2026-06-04（空窗期 5/30-6/1）
    ('public_a',   '公募 A 轮', 'public',  0.085000000000000000,  3000000, 0, 0,   255000, NULL, NULL, 50,  30, 10.0000, 100.00, 0, 1780243200000, 1780502400000, 'upcoming', 0, 4, UNIX_TIMESTAMP(NOW())*1000, UNIX_TIMESTAMP(NOW())*1000),
    -- # 5 公募 B PUBLIC_B — 2026-06-04 → 2026-06-07
    ('public_b',   '公募 B 轮', 'public',  0.090000000000000000,  4000000, 0, 0,   360000, NULL, NULL, 70,  15, 10.0000, 100.00, 0, 1780502400000, 1780761600000, 'upcoming', 0, 5, UNIX_TIMESTAMP(NOW())*1000, UNIX_TIMESTAMP(NOW())*1000),
    -- # 6 公募 C PUBLIC_C — 2026-06-07 → 2026-06-10 (距 TGE 8 小时)
    ('public_c',   '公募 C 轮', 'public',  0.100000000000000000,  5000000, 0, 0,   500000, NULL, NULL, 100,  0, 10.0000, 100.00, 0, 1780761600000, 1781020800000, 'upcoming', 0, 6, UNIX_TIMESTAMP(NOW())*1000, UNIX_TIMESTAMP(NOW())*1000)
ON DUPLICATE KEY UPDATE id=id;

-- 合计 supply: 27,000,000 ODD / target_raise: $2,015,000

-- ============================================================================
-- 2. 全局配置（单行）
-- ============================================================================
-- tge_ts = 2026-06-10 08:00:00 +08:00 = 1781049600000 ms
-- vault_address = 测试金库（用户自有，上线前替换为正式金库）
-- min_subscribe_usd = 0.01 USDT（测试期，上线前改 1000；与金库切换一起做）
INSERT INTO presale_config
    (id, tge_ts, tge_open_price_usd, vault_address,
     min_subscribe_usd, boundary_tolerance_min, total_target_usd,
     audit_label, lark_webhook_url, updated_at)
VALUES
    (1, 1781049600000, 0.100000000000000000,
     '0xf4b6036d2423B1254f273272929364A120a50c7C',
     0.010000, 5, 2015000.000000000000000000,
     NULL, NULL,
     UNIX_TIMESTAMP(NOW())*1000)
ON DUPLICATE KEY UPDATE
    tge_ts = VALUES(tge_ts),
    tge_open_price_usd = VALUES(tge_open_price_usd),
    vault_address = VALUES(vault_address),
    min_subscribe_usd = VALUES(min_subscribe_usd),
    boundary_tolerance_min = VALUES(boundary_tolerance_min),
    total_target_usd = VALUES(total_target_usd),
    updated_at = VALUES(updated_at);
