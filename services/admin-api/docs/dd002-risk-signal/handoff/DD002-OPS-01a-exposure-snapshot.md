# DD002-OPS-01a · spider 落 market_exposure_snapshot（每方向 stake）

> 方案：[`../DD.md`](../DD.md) §2.3 / D7（已拍板：方案 a）
> 索引：[`../process/README.md`](../process/README.md)
> 前置：无
> 下游：OPS-01c（判级主链路输入）
> ⚠️ 仓库：`~/work/oddfi-backend/oddfi-web-spider`（C 端侧协作交付，本文件即交接契约）

## 目标

补全全系统缺失的"每方向投注额"落库：判级公式 `Li = totalStake_i × (odds_i − 1) − otherStake` 的 totalStake 输入当前链读后即弃（`onchain_market_svc.go:308-327`），无任何持久化。

## 操作步骤

1. 新表 migration（命名循 spider 仓惯例）：

```sql
CREATE TABLE market_exposure_snapshot (
    id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    market_id       VARCHAR(66) NOT NULL,
    staked_json     JSON        NOT NULL,   -- TotalStakedByOutcome 数组，按 outcome 下标
    quote_version   BIGINT UNSIGNED NOT NULL,
    block_number    BIGINT UNSIGNED NOT NULL DEFAULT 0,
    tx_hash         VARCHAR(66) NOT NULL,
    log_index       INT UNSIGNED NOT NULL,
    created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_market_quote (market_id, quote_version),
    UNIQUE KEY uk_tx_log (tx_hash, log_index),
    KEY idx_market (market_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

2. `odds_updated_consumer` 改造：handleLog 回查 `GetMarketOdds` 的同一时机，链读 `TotalStakedByOutcome`（`betting_pool_client.go:59` 已有 client 方法），与 odds 快照同事务 Upsert 本表（uk 幂等，与 `market_odds_snapshot` 同款去重键）
3. 失败处理：链读 stake 失败**不阻塞** odds 快照落库（降级只记 Error 日志），下轮事件自然补

## 验收 checklist

- [ ] 新产生 OddsUpdated 后，表内出现对应 market_id + quote_version 行，`staked_json` 与链上 `TotalStakedByOutcome` 逐元素一致（抽 3 个 market 人工核对）
- [ ] 重放同一事件不产生重复行（uk 生效）
- [ ] spider 重启 / cursor 回退场景无 panic、无重复
- [ ] 与 `market_odds_snapshot` 行数比例 ≈ 1:1（允许降级缺口）

## 注意

- 历史存量不回填（信号灯只看当前态 + 决策后增量；调整历史的 exposure 列从本表上线时点起才有值，之前的记录 null——已在 admin 契约标注）
- 本表只增不改；清理策略与 odds 快照表对齐（如有 TTL 任务一并纳入）
