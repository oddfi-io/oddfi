# Review 03 · 前端代码 review（T06-T08，code-reviewer agent）

> 日期：2026-06-05 ｜ 对象：oddfi-admin-frontend `feat/risk-signal`（2245a45 / 57e1430 / 8f6ac62）
> 结论：**REQUEST CHANGES → 已全部处理**（修复 commit `883ed1b`）
> 门禁证据：type-check / lint 全绿；vitest 515→517（修复含回归测试）；build 绿

## 发现与处置对照

| # | 级别 | 问题 | 处置 |
|---|---|---|---|
| H-Code-1 | **High** | `dataProvider.custom` 漏接 useCustom 的 `config.query` → AdjustHistoryModal 的 market/direction GET 参数被静默丢弃，调整历史显示未过滤/错误数据 | ✅ 自动修：custom 增加 `query` → searchParams 转发（全 method），+2 条回归测试 |
| M-Code-3 | Medium | 定位高亮 effect 依赖 dataSource 引用 → 30s 轮询落在 5s 高亮窗口内会二次滚动 | ✅ 自动修：`scrolledRef` 每次 jump 只滚一次，保留 dataSource dep 用于等待目标行渲染 |
| M-Code-5 | Medium | `pending_decision` 作为列表筛选参数未经契约确认，服务端可能忽略 → 已决策红灯混入审批队列 | ✅ 自动修：队列客户端按响应字段 `e.pending_decision` 双保险过滤。**联调 A 时与后端确认 list 是否支持该筛选参数**（见 result/ 人工事项） |
| M-Code-2 | Medium | counts 全局 30s 常驻轮询 | 按 DD §3.4 规格即此设计，不修（TanStack 默认后台 tab 暂停） |
| L-Code-1 | Low | 筛选 Tab 用 emoji 🔴🟠（第二条失控色彩通道，跨 OS 渲染不一致） | ✅ 自动修：AntD `<Badge color>` 色点（与 SignalTag 同 preset 色组） |
| L-Code-2/3/4 | Low | `result?.data` 风格不一致 / 后端展示串原样渲染 / rowKey 依赖名称唯一性 | 记录不修（防御性写法更安全 / 契约即展示串 / 体育玩法名实务唯一） |

## 通过确认项（要点）

- 信封拆包 / 逗号多值单 key / page_page_size / sort_by_order 全部有测试
- ID 全链路 string；`encodeURIComponent` 全覆盖（含 URL 注入测试）
- 终态错误码分支（NOT_RED / CONFLICT → toast+invalidate）有测试；ERROR_MAP 四码补齐
- counts 失败保持上次值（errorNotification:false + console.warn）符合 M-Arch-4
- null 组「—」/ settled 盈亏替换 / 未开盘置灰 / Decimal 纪律 / 运行时英语日志 / 色组纪律全过
- AdminHeader badge 收敛用 react.dev「渲染期调整 state」范式（非 effect）

完整 agent 报告输出已并入本摘要；T07 12 条交互 checklist 逐条核对通过。
