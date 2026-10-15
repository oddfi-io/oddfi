# THEME-MAPPING — Vercel design.md → AntD 5 ConfigProvider

**Date**: 2026-05-15
**上游来源**：`docs/DESIGN-SYSTEM.md`（Vercel design.md 原文快照）
**落地代码**：`src/theme/vercelTheme.ts` + `src/theme/vercel.css`
**强制约束**：`.claude/rules/design-tokens.md`

本文档作用：

1. 把 design.md 的 token 名 ↔ AntD ConfigProvider token 对应关系**显式列出**，AI 改主题时不用反复推断
2. 记录"为什么后台只取 design.md 的子集"的**决策**（哪些舍弃 / 哪些重映射 / 哪些是"in-app 后台"专属选择）
3. 改主题（颜色 / 字号 / 圆角）的"权威落地点"清单 — 改一处必须同步另一处

---

## 1. 范式决策（一次性，后续别再争论）

| 决策 | 选择 | 原因（doc 原话或推论） |
| --- | --- | --- |
| **按钮圆角** | 6px 方角 | doc Don't 明确："Don't pair the marketing 100-px pill CTA shape with the 6-px nav radius on the same screen — pick a scale and stay there." 后台属 in-app 场景，统一 6px (`{rounded.sm}` = `--geist-radius`) |
| **mesh gradient hero** | ❌ 不用 | "The gradient lives at hero scale only" — 后台没有 hero 区 |
| **pricing-card / logo-strip / showcase-band** | ❌ 不用 | Marketing 元素，后台不需要 |
| **字体** | Geist (开源 npm 包) | doc 推荐 "Inter" 作为开源替代，但 Vercel 已开源 Geist，直接用 `geist` npm 包 |
| **字重上限** | 600 | doc 强约束："Don't promote the geometric sans to weight 700" |
| **headline 字距** | 负值（`-2.4px / -1.28px`）| doc 强约束："Negative tracking is part of the voice. Reverting to default tracking breaks the brand." 后台仅大数字面板（Statistic）用得到 |
| **shadow 风格** | stacked 多层小投影 | doc Don't："Don't drop a single heavy drop-shadow on cards" |
| **强调色数量** | 黑 + 蓝（link）+ 4 状态色 | doc Don't："Don't introduce a sixth accent colour" |

---

## 2. 颜色映射

### 2.1 Brand & Surface

| design.md token | 值 | AntD ConfigProvider token | 用法 |
| --- | --- | --- | --- |
| `colors.primary` (ink) | `#171717` | `colorPrimary` | 单一 CTA 黑、Header 文字、Sider 激活态左边框 |
| `colors.on-primary` | `#ffffff` | （继承 colorBgBase）| 黑底白字 |
| `colors.canvas` | `#ffffff` | `colorBgBase` / `colorBgContainer` / `colorBgElevated` | 卡片 / 弹窗白底 |
| `colors.canvas-soft` | `#fafafa` | `colorBgLayout` | 页面底色 / Sider 底色 / 表头底色 |
| `colors.canvas-soft-2` | `#f5f5f5` | `colorBorderSecondary` | 浅分隔 / hover bg |
| `colors.hairline` | `#ebebeb` | `colorBorder` | 1px 分隔线 / 表格行 / 卡片边 / Input 边 |
| `colors.hairline-strong` | `#a1a1a1` | `colorTextQuaternary` | 强分隔 / 极次要文字 |

### 2.2 Text

| design.md token | 值 | AntD token | 说明 |
| --- | --- | --- | --- |
| `colors.ink` | `#171717` | `colorTextBase` | 主文字 / 标题 |
| `colors.body` | `#4d4d4d` | `colorTextSecondary` | 副标题 / nav-link 默认 / 表头 |
| `colors.mute` | `#888888` | `colorTextTertiary` | placeholder / 提示 |

### 2.3 Semantic

| design.md token | 值 | AntD token |
| --- | --- | --- |
| `colors.link` (== success) | `#0070f3` | `colorInfo` + `colorSuccess` + `colorLink` |
| `colors.link-deep` | `#0761d1` | `colorLinkActive` |
| `colors.error` | `#ee0000` | `colorError` |
| `colors.warning` | `#f5a623` | `colorWarning` |

### 2.3.1 风险语义色（DD002 信号灯，2026-06-05 扩展决策）

信号灯四色是**风险语义色**，不是品牌强调色——不违反「不引第六种强调色」（那条约束 brand accent）。
落地方式：**不扩 vercelTheme token**，色值一律取 AntD Tag preset（`green` / `gold` / `orange` / `red`），
收敛在 `SignalTag.tsx` 与 events 页 Tag 用法内；红灯 KPI 脉冲动画在 `vercel.css`（box-shadow 基于
`colorError #ee0000` 的 rgba，不引入新填充色）。原型暗色值（`#ff6b35` 等）一律禁止。

| 语义 | 载体 | 色源 |
| --- | --- | --- |
| 绿灯（安全）| `<Tag color="green">` | AntD preset |
| 黄灯（关注）| `<Tag color="gold">` | AntD preset |
| 橙灯（预警）| `<Tag color="orange">` | AntD preset |
| 红灯（风险）| `<Tag color="red">` + `.of-signal-pulse` | AntD preset + colorError rgba |

### 2.4 不映射的 token（落地页专属）

以下 design.md token 后台**不引用**，留在 `DESIGN-SYSTEM.md` 仅作参考：

- `gradient-develop-*`, `gradient-preview-*`, `gradient-ship-*` — mesh gradient
- `cyan` / `cyan-soft` / `cyan-deep` — gradient 用色
- `violet` / `violet-soft` / `violet-deep` — gradient 用色
- `highlight-pink` / `highlight-magenta` — gradient 用色
- `link-bg-soft` — 落地页"What's New"banner 背景
- `selection-bg` / `selection-fg` — 已通过 `vercel.css` 直接 CSS 实现

---

## 3. 字号映射

design.md 的字号系统是**完整型录**；后台只把常用 4-5 个映射到 AntD `fontSize*`，其余通过组件内 `style` 或 className 局部使用。

| design.md token | size | AntD token | 用法 |
| --- | --- | --- | --- |
| `body-sm` | 14 | `fontSize` (base) | 后台默认正文 / 表格 cell / Form label |
| `caption` | 12 | `fontSizeSM` | badge / 微小提示 / 表头 mono |
| `body-md` | 16 | `fontSizeLG` | 卡片标题 / Form 输入框文字 |
| `display-sm` | 20 | `fontSizeXL` | 页面 H1 / Card title |
| `display-md` (24) | — | （组件 style 内）| Statistic / Dashboard 大数 |
| `display-lg` (32) | — | （仅 Dashboard 顶部）| 极少用 |
| `display-xl` (48) | — | **不用** | Marketing hero 专用 |

**字距强约束**：display 系列必须负字距，已在 `vercel.css` 给 `.ant-statistic-content-value` 全局设了 `letter-spacing: -1.28px`。其他场景如果用 `display-md`+，必须**手写** `letterSpacing: '-0.96px'`。

**字体族**：`fontFamily: "Geist, Inter, system-ui, ..."` + `fontFamilyCode: "Geist Mono, ui-monospace, ..."` 由 ConfigProvider 全局注入。Geist CSS 在 `vercel.css` 顶部 `@import "geist/font/sans"`。

---

## 4. 圆角映射

| design.md token | 值 | AntD token | 后台用法 |
| --- | --- | --- | --- |
| `rounded.xs` | 4 | `borderRadiusXS` / `borderRadiusSM` | 最紧 |
| `rounded.sm` | 6 | `borderRadius` (base) | **后台主圆角** — 按钮 / Input / Dropdown |
| `rounded.md` | 8 | `borderRadiusLG` | Card |
| `rounded.lg` | 12 | （组件 style）| 大 Modal |
| `rounded.pill` | 100 | **不用** | 这是 marketing CTA 专用，doc Don't |

---

## 5. 间距映射

design.md 用 `xxs/xs/sm/md/lg/xl/2xl/...` 命名；AntD 用 `padding/paddingSM/paddingLG/paddingXL`。

| design.md | 值 | AntD |
| --- | --- | --- |
| `xs` | 8 | `paddingXS` |
| `sm` | 12 | `paddingSM` |
| `md` | 16 | `padding` (base) |
| `lg` | 24 | `paddingLG` |
| `xl` | 32 | `paddingXL` |

更大间距（`2xl`/`3xl`/`4xl`/`5xl` = 40/48/64/96）后台基本用不上，需要时直接写 px。

---

## 6. 阴影映射

design.md 定义 5 级 elevation，全部 stacked。AntD 只暴露 `boxShadow` / `boxShadowSecondary` / `boxShadowTertiary`。

| design.md Level | 值 | AntD token | 后台用法 |
| --- | --- | --- | --- |
| Level 1 (inset hairline) | `0 0 0 1px #00000014 inset` | （走 border）| Card 默认 |
| Level 2 (subtle drop) | `0 1px 1px #00000005, 0 2px 2px #0000000a` | `boxShadow` | 默认浮起卡片 |
| Level 3 (soft stack) | `0 2px 2px #0000000a, 0 8px 8px -8px #0000000a` | `boxShadowSecondary` | feature cluster |
| Level 4 (float stack) | 同 + 8px 16px | （组件内 style）| 大 callout |
| Level 5 (modal) | `0 1px 1px ..., 0 8px 16px -4px ..., 0 24px 32px -8px ...` | （Modal 自带）| Modal / Dropdown |

---

## 7. 组件级覆盖（components 块）

`vercelTheme.ts` 的 `components` 段已配：

| AntD 组件 | 关键 token 来源 |
| --- | --- |
| `Table` | doc `ex-data-table-cell`：headerBg=canvas-soft, headerColor=body, hairline 行 |
| `Menu` | doc `ex-app-shell-row`：active 用 canvas-soft 底 + 左 3px ink indicator (CSS) |
| `Button` | doc `nav-cta-*`：6px 方角、ink/canvas、controlHeight 32 |
| `Card` | borderRadiusLG 8 = doc `card-marketing` |
| `Input` | doc `form-input`：6px 圆角、40px 高、hairline 边 |
| `Layout` | doc `nav-bar`：64px 高、12/24 padding、canvas 顶栏、canvas-soft 侧栏 |
| `Tabs` | inkBarColor=ink，颜色继承 body/ink |

---

## 8. 改主题流程（约束 AI / 人类）

> **Single Source of Truth**：`src/theme/vercelTheme.ts` 是落地权威。

### 改颜色

1. 检查 design.md 是否已定义该色 → 已有就直接用
2. 没有 → 这是 design.md 的"扩展"，必须**先在本文档 §2 加一行映射**说明用途和决策原因
3. 改 `vercelTheme.ts` 对应 token
4. （如需）在 `vercel.css` 加 component 级覆盖
5. 同 commit 提交三处改动

### 改字号

同上，但要确认是否违反 design.md 字重上限（600）和负字距规则。

### 引入新的 AntD 组件 token

`vercelTheme.ts` 的 `components` 段加一节，对照 doc `ex-*` 章节看有没有现成范式。没有的话写 PR description 说明取什么范式（`ex-modal-card`? `card-marketing`?）。

### 改布局壳（Sider/Header）

直接改 `<ThemedLayoutV2>` 自定义槽，**不要**改 design tokens。

---

## 9. 反模式（绝对不允许）

- ❌ 在组件 inline `style={{ color: '#171717' }}` —— 必须用 token
- ❌ 引入新颜色（如紫色 / 粉色），违反 doc "Don't introduce a sixth accent colour"
- ❌ 用 100px pill 按钮 —— 后台是 in-app 范式
- ❌ 用 mesh gradient / 大插画 —— marketing 元素
- ❌ 字重 700/800/Bold —— doc 上限 600
- ❌ headline 用默认字距（不加负字距）
- ❌ Material 风格的重投影
- ❌ 修改 `docs/DESIGN-SYSTEM.md` 里的 token 值（那是上游快照）
