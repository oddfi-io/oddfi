# DD002-OPS-01c · web-api /internal/admin/events/* 五端点 + admin_risk_decisions + 阈值配置

> 方案：[`../DD.md`](../DD.md) §3.1 / §3.3（契约全文）
> 索引：[`../process/README.md`](../process/README.md)
> 前置：OPS-01a（敞口数据）、OPS-01b（HMAC 骨架）
> 下游：联调 B
> ⚠️ 仓库：`~/work/oddfi-backend/web-api`（C 端侧协作交付，本文件即接口交接契约）

## 目标

信号灯聚合与判级的**唯一实现点**。五端点 + 决策表 + 阈值配置。

## 操作步骤（实现要求）

### 1. 阈值配置（yaml）

```yaml
admin_risk:
  threshold_yellow: 8000    # 与 BettingPool 合约常量对齐，改合约必须同步改这里
  threshold_orange: 18000
  threshold_red:    28000
  cache_ttl_sec:    60      # summary/list 聚合缓存；signal 含 red 的查询绕过
```

### 2. 核心计算（service 层，中文注释强制）

```
数据源：oddfi_onchain_markets（fixture↔market 映射）
      × market_odds_snapshot 最新行（currentOdds，已有 MAX(quote_version) 自连接模式 market.go:84-103）
      × market_exposure_snapshot 最新行（totalStake_i，OPS-01a）
      × FixtureDB（状态/时间）× oddfi_odds（第三方赔率+bookmaker）

方向 Li      = totalStake_i × (currentOdds_i − 1) − otherStake
方向 sig     = 判级(Li)
★ 事件判级 maxL    = max(全场所有方向 Li)     → signal（灯色/计数/入队唯一依据）
★ 事件展示 adjMaxL = Σ 各玩法 max(方向 Li)    → max_exposure 字段（仅展示）
opened=false（无已开盘 market）→ signal/bet/exposure/yield 全 null，不计 summary 四色
signal 对外字符串 green/yellow/orange/red；ID 全部 ,string
```

### 3. 决策表 migration（web-api 库）

```sql
CREATE TABLE admin_risk_decisions (
    id           BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    event_id     BIGINT UNSIGNED NOT NULL,            -- fixture_id
    action       VARCHAR(32) NOT NULL,                -- approve_continue / stop
    remark       VARCHAR(512) NOT NULL,
    decided_by   VARCHAR(128) NOT NULL,               -- 从 X-Admin-JWT 解码，禁止 body 传入
    quote_version BIGINT UNSIGNED NOT NULL,           -- 决策时点的快照版本（红灯重升判定锚点）
    decided_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_event_quote (event_id, quote_version),   -- 同版本重复决策 → RISK_DECISION_CONFLICT
    KEY idx_event (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 4. 五端点（请求/响应 JSON 以 admin-backend `docs/api.md` §3.12 为唯一契约，此处列行为要点）

| 端点 | 行为要点 |
|---|---|
| `GET …/risk/summary` | 四色计数（不含未开盘）+ `red_pending_count`（red 且无有效决策）+ `active/pending/settled_count` + `max_event_exposure`（全局最大单场 adjMaxL）|
| `GET …/risk/list` | `signal` 逗号多值 split；`pending_decision` 过滤参数；分页 page/page_size；排序 bet/exposure/time |
| `GET …/{event_id}` | markets[]→directions[] 全字段；第三方赔率从 oddfi_odds 取 |
| `GET …/{event_id}/adjust-history` | 快照衍生：seq=quote_version 序、time=updated_at、odds=quoted_odds_json、source="Auto"；exposure 自 OPS-01a 上线时点起有值、lp_ratio 暂 null |
| `POST …/{event_id}/risk-decision` | 校验当前 signal=red（否则 EVENT_NOT_RED_SIGNAL）→ 落库（uk 冲突→RISK_DECISION_CONFLICT）→ 返回 effective_signal/queue_cleared |

**决策态判定**（D2 拍板，一期不触链上）：`pending_decision = (signal==red) && 不存在 decided_quote_version >= 当前 quote_version 的决策记录`——链上红灯重升（新 quote_version）自动重新入队。

### 5. 暂 null 字段（D6，契约保留）

`lp_pool_amount` / `yield_ratio` / `score` / `settle_pl` / `times.settle` / 调整历史 `lp_ratio` → 一律返回 null，待 OPS-01d 点亮。**不要返回 0 或空字符串冒充**。

## 验收 checklist

- [ ] admin-backend `docs/risk-signal-curl.md` 契约集全数通过（联调 B 入口）
- [ ] 判级单测：maxL 判级 ≠ adjMaxL 展示（构造两值跨档的夹具）、四档边界值（=8000 归绿 / >8000 归黄等按 calc.go 同语义）、未开盘 null、red 重升重入队
- [ ] `signal=red` 查询绕缓存（红灯出现 ≤ 数秒可见）
- [ ] 50 事件规模 list p95 < 300ms（web-api 侧，不含 admin 往返）

## 注意

- 决策不触链上：表里只记录，合约自治不受影响（D2 一期口径，PRD §7.1 的"开盘/停单"语义=运营记录）
- decided_by 取 JWT，永不信任 body
