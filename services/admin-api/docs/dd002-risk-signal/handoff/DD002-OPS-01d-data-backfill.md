# DD002-OPS-01d · D6 null 组数据源补齐（可后置，不阻塞上线）

> 方案：[`../DD.md`](../DD.md) §2.3 / D6
> 索引：[`../process/README.md`](../process/README.md)
> 前置：无（独立推进）
> 下游：点亮契约中暂 null 字段（admin 前后端零改动，字段自动有值）
> ⚠️ 仓库：`~/work/oddfi-backend`（C 端侧，按数据项分别排期）

## 目标

契约已保留、当前恒 null 的字段，逐项补数据源。**每补一项，web-api 聚合层填值即可，admin-backend / 前端零改动**（前端已按 null→「—」兜底）。

## 操作步骤（按优先级）

| 优先 | 字段 | 缺口 | 建议数据源 |
|---|---|---|---|
| P1 | `lp_pool_amount` + `yield_ratio` | 按赛事 LP 底池无落库（liquidity.go 仅用户持仓+池映射） | **先回答口径问题：LP 是按赛事池还是全局池？** 全局池则 yield_ratio 需产品重定义；按赛事池则链读池余额落快照或实时 read |
| P2 | `score`（终场比分） | FixtureDB 无比分字段 | spider 从第三方赛果源补抓 → FixtureDB 加列或新表 |
| P2 | `settle_pl` | 仅单注级 payout，无按场聚合 | 结算事件消费时按 fixture 聚合落表，或 onchain_tx_orders 按 fixture SUM |
| P3 | `times.settle` | 无独立列 | 结算事件首条时间戳 |
| P3 | 调整历史 `lp_ratio` | 依赖 P1 | P1 完成后随快照计算 |

## 验收 checklist

- [ ] 每项点亮后：admin `GET /admin/events/risk/list` 对应字段非 null 且口径与 PRD §4.3.1 定义一致
- [ ] 前端无需发版自动显示（null 兜底自然让位）
- [ ] docs/api.md §3.12 的「待 OPS-01d 点亮」标注同步移除（admin-backend 仓 docs PR）

## 注意

- P1 的 LP 口径问题需要产品/合约侧先给答案，不要工程侧擅自定义
- 本 task 不阻塞 DD002 上线；上线时给 PM 的验收说明里已声明这些字段「—」为预期行为
