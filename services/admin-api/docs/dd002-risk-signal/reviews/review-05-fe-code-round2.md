# Review 05 · 前端二轮代码 review（合入前，code-reviewer agent）

> 日期：2026-06-06 ｜ 对象：oddfi-admin-frontend `feat/risk-signal` 增量（883ed1b..e4f09a8 联调 A 期 5 commit）+ 合入就绪度
> 结论：**APPROVE，可 squash 合入 main**（微调已落 `a372f44`）

## 焦点核验（5/5 过）

| 焦点 | 结论 |
|---|---|
| applyTab merge+undefined 移除语义 | ✅ 筛选面仅 signal/status 两维，无残留风险；deriveTab 跳过残留有回归测试 |
| _format 新函数边界（NaN/负零/极值） | ✅ 四象限测试覆盖；负零正确显示 "0" |
| types 与 admin-backend main api.md §3.12 逐字段比对 | ✅ score/odds_diff/adjust_ratio/market_id/direction_id 五处全一致，**无第三处漂移**（main 近 3 commit 均 no-api-surface-change） |
| summary errorNotification:false 静默分层 | ✅ 辅助 KPI 静默保旧值、主数据 toast 保留，分层合理 |
| 合入就绪度 | ✅ 无死代码/console 漏网/as any/临时产物 |

## 处置

| # | 级别 | 问题 | 处置 |
|---|---|---|---|
| M-1 | Medium | list.tsx formatScore 渲染路径双调用 | ✅ `a372f44` 单次求值 |
| L-1 | Low | formatSignedOdds 浮点尾差无兜底（当前取值域不触发） | 登记不修 |
| L-2 | Low | EventScore NaN 理论边界 | 登记不修 |
| L-3 | Low | applyTab 注释缺 Refine 版本锚点 | ✅ `a372f44` 补锚点 |

证据：tsc/lint exit 0、vitest 527/527、build 绿。
