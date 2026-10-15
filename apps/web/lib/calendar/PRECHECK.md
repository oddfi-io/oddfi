# DD-091 B0 前置实查报告

**Date**: 2026-04-30
**Worktree**: `.claude/worktrees/calendar`
**Branch**: `feat/calendar`
**目的**: B1 编码起步前，对 DD v2 中所有「未验证假设」做实查并把结果回钉。

---

## 1. floating-ui 是否安装

| 命令                           | 结果                |
| ------------------------------ | ------------------- |
| `pnpm list @floating-ui/react` | ❌ 未安装（输出空） |
| `pnpm list @floating-ui/dom`   | ❌ 未安装           |

**应对**：DD v2 §3.5(5) 已落实纯 `getBoundingClientRect()` 计算方案。Hover popover 定位无需引入新库。

---

## 2. `marketsLayoutStore` 实际 API

读 `stores/marketsLayoutStore.ts`：

| DD v1 错误假设          | 实际 API                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `openDetail(fixtureId)` | ✅ 实际名 = **`selectFixture(id: number)`**                                            |
| `closeDetail()`         | ✅ 实际名 = **`closeDetail()`**（一致）                                                |
| 派生布局态              | 已有 `useLayoutState()` hook，返回 `'default' / 'detail' / 'betslip' / 'betslip-only'` |

**应对**：

- DD v2 §3.4 wrapper 代码 `closeDetail` 引用正确
- DD v2 §3.6 / §3.4 中 `openMatch(id)` 内部应改调 `selectFixture(id)` 而非 `openDetail` — B4 接入时落实
- B4 详情面板挂载时直接订阅 `useLayoutState()` 决定收缩态

---

## 3. `next.config.mjs` SVG / CDN 配置

| 配置项                     | 值                                                |
| -------------------------- | ------------------------------------------------- |
| `images.remotePatterns[0]` | `raw.githubusercontent.com/trustwallet/assets/**` |
| `images.remotePatterns[1]` | **`cdn.sportmonks.com/images/soccer/**`\*\* ✅    |
| `images.remotePatterns[2]` | `coin-images.coingecko.com/coins/images/**`       |
| `dangerouslyAllowSVG`      | 未设置（默认 false）                              |

**应对**：Calendar mock 数据中 `participants[].image_path` = `https://cdn.sportmonks.com/images/soccer/teams/...png`（PNG，非 SVG）— 已在白名单内，**`next.config.mjs` 无需改动**。reviewer C2-2「SVG default-deny 会空白」实为不存在的问题（数据源是 PNG）。

---

## 4. i18n namespace `calendar` 占用

```
$ grep '"calendar":' messages/en.json
    "calendar": "Calendar",
$ grep -rn 'useTranslations("calendar"' app components
$ grep -rn "useTranslations('calendar'" app components
（均未命中 = 顶层字符串占用，但无 sub-key caller）
```

**应对**：

- 占用层级 = **顶层字符串** `messages.calendar = "Calendar"`，未做命名空间用
- 没有任何 `useTranslations('calendar')` caller 与 `t('xxx')` 子键调用
- DD v2 §3.9 改用 `calendarPage.*` 子命名空间 — **不会与现有冲突**
- 现有 `messages.calendar = "Calendar"` 顶层字符串保持不动

---

## 5. `SportIcon` 是否原生支持 SportMonks CDN URL

读 `components/ui/SportIcon.tsx`：

- 使用 Next.js `<Image src={src} />`，`src` 形参直传外部 URL
- `next.config.mjs.images.remotePatterns` 已白名单 `cdn.sportmonks.com/images/soccer/**`
- `onError` 自动降级为透明圆形占位

**结论**：✅ Calendar 直接 `<SportIcon src={participant.image_path} size={20} withBg={false} />` 即用即走，无需 wrapper。

---

## 6. ASSETS.md 复用查询（ENH-011 强制）

| 关键词                                      | 命中                                                                                                             | 复用决策                                                                                                                                                                                      |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `时间处理 / UTC / 日期 offset`              | `lib/date-utils.ts` (`getTodayUTC`, `getDateOffsetUTC`, `getDateFromBaseUTC`, `dateDiffDays`, `formatDateLabel`) | ✅ 复用：日期计算 + diff（B1 `lib/calendar/grid-layout.ts` 内部使用）                                                                                                                         |
| `比赛日期 / kickoff 时间格式化`             | `lib/format-utils.ts` (`formatMatchDate`, `formatMatchTime`, `formatMatchDateTime`)                              | ✅ 复用：CalendarMatchCard / HoverPopover 显示                                                                                                                                                |
| `UTC ISO → 本地时区`                        | `lib/format/relative-time.ts` (`formatDateLineLocal`, `formatTimeLineLocal`, `formatRelativeTime`)               | ⚠️ 部分复用：仅支持「浏览器本地」，不支持「显式 IANA tz toggle」                                                                                                                              |
| `IANA 时区切换 / Y_TIMES 平移 / 跨日重派列` | **未命中**                                                                                                       | 🆕 新建 `lib/calendar/timezone.ts` — 理由：Calendar PRD §3.6/A.1 强制 UTC ↔ Local toggle + 跨日重派网格列；现有工具均为「单一时区/浏览器隐式」，无法承担「显式 IANA tz 切换 + 行/列双重派位」 |
| `金额 / 赔率 / 精度`                        | `lib/decimal.ts` (`add` / `mul` / `formatAmount` / `convertOdd`)                                                 | ✅ 复用：Hover popover / 详情列赔率展示                                                                                                                                                       |
| `i18n 翻译入口`                             | `useTranslations('namespace')`                                                                                   | ✅ 复用：`calendarPage` namespace 写 `messages/{locale}.json`                                                                                                                                 |
| `BetSelection 加单 / store`                 | `hooks/useBetSelectionToggle` + `stores/betSlipStore`                                                            | ✅ 复用：Hover 三胶囊 + 详情列 cell 共用                                                                                                                                                      |
| `详情列 1x2 / AH / Asian Total`             | `components/game-markets/MatchDetailPanel.tsx`                                                                   | ⚠️ B1.5 重构：抽出 `MatchDetailContent` 纯展示组件，`MatchDetailPanel` 包薄 wrapper                                                                                                           |
| `球队头像`                                  | `components/ui/SportIcon`                                                                                        | ✅ 复用：原生支持 SportMonks CDN                                                                                                                                                              |
| `flags 资产 (public/images/flags/)`         | 234 国 SVG                                                                                                       | ❌ **不复用**：mock 数据自带 `image_path` CDN PNG，flags 资产是 banner/榜单用，不是球队识别用                                                                                                 |

---

## 7. wc-fixtures.json 数据完整性

```
$ pnpm tsx scripts/fetch-wc-fixtures.ts
[fetch-wc-fixtures] Starting — league=732
[fetch-wc-fixtures] Page 1: +25 (total=25)
[fetch-wc-fixtures] Page 2: +25 (total=50)
[fetch-wc-fixtures] Page 3: +25 (total=75)
[fetch-wc-fixtures] Page 4: +25 (total=100)
[fetch-wc-fixtures] Page 5: +4 (total=104)
[fetch-wc-fixtures] Done — fixtures=104 stages=7 dates=35
[fetch-wc-fixtures] Saved → lib/calendar/data/wc-fixtures.json
```

| 维度                        | 实测                    | PRD 期望                                    | 一致性       |
| --------------------------- | ----------------------- | ------------------------------------------- | ------------ |
| 总场数                      | **104**                 | 104                                         | ✅           |
| stage_id 数                 | 7                       | 7（GS / R32 / R16 / QF / SF / 3rd / Final） | ✅           |
| match days                  | 35                      | 34（PRD 漏标 7/12）                         | ⚠️ 按真实 35 |
| 时间窗                      | 2026-06-11 ~ 2026-07-19 | 同                                          | ✅           |
| `has_odds`                  | 全 false                | pre_open                                    | ✅           |
| `enable_bet`                | 全 false                | pre_open 不可下注                           | ✅           |
| `participants[].image_path` | SportMonks CDN PNG URL  | —                                           | ✅           |

---

## 8. B1 阻塞检查（绿/黄/红）

| 项                      | 状态                                        |
| ----------------------- | ------------------------------------------- |
| floating-ui 假设        | 🟢 已修方案                                 |
| marketsLayoutStore API  | 🟢 已确认 `selectFixture` + `closeDetail`   |
| next.config SVG 风险    | 🟢 不存在（数据是 PNG）                     |
| i18n namespace 冲突     | 🟢 改 `calendarPage` 后无冲突               |
| SportIcon 兼容          | 🟢 原生支持                                 |
| ASSETS.md 复用          | 🟢 全部命中或合理新建                       |
| wc-fixtures.json 完整性 | 🟢 104 场全量                               |
| 详情列重构方案          | 🟡 B1.5 待执行（剥离 `MatchDetailContent`） |

**B1 起步条件全部满足，可进入数据层 + 类型 + 工具的 TDD 实现。**

---

## 附录：DD v2 待回填修订项

`.progress/designs/DD-091-calendar-page.md` 中以下位置需在 B4 实施时核对并替换（不阻塞 B1~B3）：

- §3.4 wrapper code: `marketsLayoutStore.<openDetail>` → `selectFixture(fixtureId)`
- §3.6 actions 注释：`marketsLayoutStore.openMatch` 同上
