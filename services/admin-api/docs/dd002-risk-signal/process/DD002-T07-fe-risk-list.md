# DD002-T07 · 赛事风险列表页（KPI 联动 + 两级 Table + 原型交互全集）

> 方案：[`../DD.md`](../DD.md) §3.4 交付件 checklist + §2.2 原型交互
> 索引：[`./README.md`](./README.md)
> 前置：T06
> 下游：联调 A
> ⚠️ 仓库：`~/work/oddfi-admin-frontend`

## 目标

`/events` 主页面：顶部风险总览 KPI 区 + 两级展开风险列表，复刻原型交互骨架、沿用 Vercel 风格视觉。

## 文件清单

- `src/pages/events/list.tsx` — 新建：页面主体
- `src/pages/events/components/RiskKpiCards.tsx` — 新建：KPI 区
- `src/pages/events/components/EventExpandedTable.tsx` — 新建：展开态玩法/方向明细
- `src/pages/events/components/TimeChips.tsx` — 新建：时间 chip + hover 时间线
- `src/hooks/useRiskList.ts` — 新建：列表查询（筛选/排序/分页状态收敛）

## 接口设计 / 行为约定（原型交互 checklist，验收逐条勾）

- [ ] KPI：四色计数（summary，不含未开盘）+ 红灯卡 CSS 脉冲；点击 red→筛 red、orange→筛 orange、**green/yellow→清筛选 all**
- [ ] 最大敞口卡可点击 → 列表定位/高亮 `max_exposure_event_id` 行；赛事总数副文案显示 active/pending/settled 分布
- [ ] 筛选 Tab：全部/进行中/待开始/已结算/🔴红灯/🟠橙灯；**橙 Tab 发 `signal=orange,red`**（含红语义）
- [ ] 排序：默认 / bet / exposure / time ↕ → `sort_by/sort_order`
- [ ] 赛事行：SignalTag、状态 pill、TimeChips（hover 竖向时间线，当前阶段高亮：未开盘=open / pending=kickoff / active=lock / settled=settle）
- [ ] **settled 态：盈亏卡替换敞口卡**（settle_pl 正绿负红）+ 终场比分 pill
- [ ] 未开盘：风险/赔率/收益率卡全部置灰「—」
- [ ] 收益率三态色：>0.5 红 / >0.3 黄 / 其余绿；null →「—」
- [ ] 展开态：每玩法一张表（方向/投注额/开盘赔率/第三方赔率+来源/差值/新赔率/原敞口/新敞口/压缩率/方向 SignalTag/调整 n 次按钮）；已结算方向标 ✓胜出/未中/走盘 + 结算条
- [ ] null 组字段（lp_pool/yield/score/settle_pl/times.settle/调整历史入口数 0）全部「—」，不报错
- [ ] 30s `refetchInterval` 轮询（audit/list.tsx:31 同款）

## 实施要点

- 视觉一律 Vercel 主题 AntD 组件，禁止从原型 html 抄任何色值/暗色样式
- 金额走既有 `AmountText`，时间走 `lib/time.ts`，与 presale 页面观感一致
- expandable 展开请求 `GET /admin/events/:id` 懒加载（点击展开才拉，Refine `useCustom`）

## 测试要求

`tsc + lint` 绿；对 mock 上游夹具人工过一遍 checklist（8 个事件形态各一行，恰好覆盖全部分支）。

## 验收

联调 A checklist 中列表相关条目全过；与 PM 按原型逐交互比对一次。
