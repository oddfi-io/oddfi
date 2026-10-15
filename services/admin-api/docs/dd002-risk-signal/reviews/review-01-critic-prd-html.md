# Review ① · PRD/原型一致性（critic）— 判定 REVISE

> 日期：2026-06-05 ｜ 被审对象：DD002 v1 ｜ 处理状态：**全部发现已并入 DD.md v2**（对照表见 DISCUSSION.md）
> 审查重点：方案是否忠实覆盖 PRD 与原型 `0001_Oddfi_Admin_v3.html` 的交互；视觉是否守住"沿用既有管理后台风格"边界。

## Critical

**C-PRD-1 · 信号灯判级数据源错位：原型按方向级 maxL 判灯/入队，v1 按 adjMaxL**
原型 `:4239` `sig: signalLight(maxL)`（maxL=全场单方向最坏敞口）+ `:4316` 四色计数 + `:4384` 入队均由它驱动；行内"总计最大敞口"卡展示的才是 adjMaxL（`:4624`）。v1 §3.1 把判级挂在 adjMaxL（求和值）上——两口径可差一个量级，直接决定红橙判定与审批队列正确性。
→ 修复：判级源（maxL）与展示量（adjMaxL）分离，契约分别注释。

## Major

**H-PRD-1 · D4 用错论证依据，且漏列最强反证**
"队列只收 red"结论恰好对，但 v1 没引原型一手证据（`:4384`），也没列接口文档自相矛盾的反证（§9.1 `event_count:2` ≠ §5.1 `red_count:1`；概述 `:1497` 写 red/orange 入审）。决策者看不到真实分歧面。
→ 修复：DD.md §2.1 冲突仲裁表 + D4 重写。

**H-PRD-2 · 遗漏"停单后 red→orange 降级"，risk-decision 无状态机语义**
原型 `:4429` 决策后就地降级并退队消红点（`:4435`）。v1 响应只回流水字段；一期不触链上的话，轮询回来仍是 red → "批准开盘后赛事仍红灯仍在队列"死循环。看板 PRD §13 明确要求审批后列表/badge 同步。
→ 修复：§3.3 补 `effective_signal` / `pending_decision`（decided_quote_version 锚点）/ 红灯重升重入队 + 前端乐观更新约定。

**H-STYLE-1 · SignalTag 需 4 色，撞 `RoundStatusTag` 头注释"不引第六种强调色"纪律，v1 未标注**
信号灯 orange/red 不在既有 3 色盘；照搬 RoundStatusTag 不够，照抄原型暗色值又违反风格边界。
→ 修复：§3.4 风格边界节——四色定性为风险语义色（非品牌 accent），新增 risk-signal 专用 token，色值取 AntD preset。

**H-PRD-3 · 原型交互遗漏清单（v1 §3.4 不完整）**
- settled 态盈亏卡**替换**敞口卡（`:4622`）+ 方向行 ✓胜出/未中/走盘
- 时间 chip hover 竖向时间线 + 当前阶段高亮（`:4600-4609`：未开盘=open / pending=kickoff / active=lock / settled=settle）
- 收益率三态色（>50% 红 / >30% 黄）+ 未开盘各卡置灰「—」（`:4628/:4634`）
- KPI 绿/黄点击落到 all（`:4649`，列表无独立绿黄 Tab）
- 橙灯筛选含红（`:4455` `=='orange'||=='red'`）
→ 修复：§3.4 交付件 checklist 逐条收编（T07/T08 验收项）。

## Minor

- **M-PRD-1**：原型 mock 阈值放大 10×（80k/180k/280k，`:4021`），实现以 8k/18k/28k 为准（D1 注记）。
- **M-PRD-2**：§5.1 summary 缺状态分布计数（赛事总数副文案需要）→ 契约补 `active/pending/settled_count`。
- **M-STYLE-1**：调整历史 `source` 本期恒 Auto，PRD §10 的"人工"来源无数据 → 契约注记。

## Missing / 多视角

- 30s 轮询与红灯时效矛盾未量化（并入 H-PRD-2，v2 给出 ~90s 论证）
- 最大敞口卡点击跳转（`jumpToMaxRisk` `:1080`）漏列 → T07
- 审批弹窗 Claim Tab 占位策略未明 → T08（置灰 badge 0）
- 规则说明折叠区文案硬编码阈值，与 D1"前端不持有阈值"擦边 → 标注"展示文案非判级源"
- Open-Q：summary `max_event_exposure` 与 list `max_exposure` 同词根不同义 → docs/api.md 分别注释（已采纳）

## 裁决

REVISE（非 REJECT）：三仓解耦、判级单点、D2 外部依赖识别、operator JWT 注入修正均正确，~70% 可直接落地。升级 ACCEPT 条件（修 C-PRD-1 / 重写 D4 / 补状态机 / 风格边界 / 交互 checklist）已在 v2 全部完成。
