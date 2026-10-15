# LESSONS.md — 复盘经验总索引

> **AI 使用指引（开发 Agent）**
> 开始任何开发任务前，**必须先查阅本文件**，找到与当前任务相关的章节，提前阅读经验教训，避免重复踩坑。
> 本文件汇聚了来自 `lessons/`（Bug 复盘）和 `reviews/`（高频 Critical 问题）的教训。

---

## 按主题快速导航

| 主题                                           | 章节                                                                   | 相关页面/组件                                                                               |
| ---------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| CSS 层叠与背景配置                             | [§1](#1-css-层叠与背景配置)                                            | 全局布局、TopNav、页面容器                                                                  |
| 设计 Token 与颜色规范                          | [§2](#2-设计-token-与颜色规范)                                         | 所有组件                                                                                    |
| 触控热区（Apple HIG）                          | [§3](#3-触控热区-apple-hig)                                            | 所有可点击元素                                                                              |
| React Hooks 陷阱                               | [§4](#4-react-hooks-陷阱)                                              | 含 useRef/useEffect 的组件                                                                  |
| 精度计算规范                                   | [§5](#5-精度计算规范)                                                  | 所有金融数字展示                                                                            |
| TypeScript 类型安全                            | [§6](#6-typescript-类型安全)                                           | 所有组件                                                                                    |
| 动画与 Keyframes                               | [§7](#7-动画与-keyframes)                                              | Modal、StakeModal 等含动画组件                                                              |
| 状态管理陷阱                                   | [§8](#8-状态管理陷阱)                                                  | Zustand stores、Modal 组件                                                                  |
| 语言规范                                       | [§9](#9-语言规范)                                                      | globals.css、所有注释                                                                       |
| 分页与列表边界                                 | [§10](#10-分页与列表边界)                                              | 市场列表、做市页等                                                                          |
| **Git 提交安全**                               | [**§11**](#11-git-提交安全)                                            | **任何 git add / commit 操作**                                                              |
| **第三方 API 接入**                            | [**§12**](#12-第三方-api-接入规范)                                     | **任何外部 API 集成 / Edge Runtime 代理**                                                   |
| **Web3 链上交互**                              | [**§13**](#13-web3-链上交互规范)                                       | **任何 wagmi writeContract / 钱包状态判断 / ERC-20 approve 流程**                           |
| **MCP 设计还原**                               | [**§14**](#14-mcp-figma-设计还原规范)                                  | **任何基于 Figma MCP 的像素级还原任务**                                                     |
| **API 数据规范化**                             | [**§15**](#15-api-数据规范化层设计)                                    | **任何对外部 API 响应做 normalize/transform 的代码**                                        |
| **后台进程管理**                               | [**§16**](#16-后台进程管理)                                            | **任何 `run_in_background` 启动的长时间进程**                                               |
| **CSS Grid 布局溢出**                          | [**§17**](#17-css-grid-布局溢出与诊断方法)                             | **任何多列 Grid 布局、固定宽度容器、含 `shrink-0` 子元素的弹性布局**                        |
| **Hover 显隐动画：transition 替代 animation**  | [**§18**](#18-hover-下拉菜单显隐动画css-transition-替代-css-animation) | **任何 hover 触发的 dropdown/tooltip/popover 组件**                                         |
| **Vercel Edge fetch IP 限制**                  | [**§12-I**](#教训-12-i-edge-runtime-禁止-fetch-直连-ip-地址生产事故)   | **任何 Edge Runtime 中 fetch 外部服务的代码**                                               |
| **SSR Hydration + QueryClient**                | [**§19**](#19-ssr-hydration-与-tanstack-query-服务端渲染)              | **任何 Zustand Store 读 localStorage / TanStack Query Server prefetch / HydrationBoundary** |
| **EIP-55 Checksum 与 Multicall 连坐**          | [**§20**](#20-eip-55-checksum-与-multicall-连坐)                       | **任何新增合约地址 / `useReadContracts` multicall / token-registry 维护**                   |
| **CSS 渐变描边 + Figma CSS 陷阱**              | [**§21**](#21-css-渐变描边--figma-css-export-陷阱)                     | **任何 mask-composite 渐变描边 / Figma 玻璃边框还原 / sub-pixel border 调试**               |
| **AI Provider / LLM 上游调试**                 | [**§22**](#22-ai-provider--llm-上游调试)                               | **任何第三方 LLM 接入（xAI / DeepSeek / Kimi）、provider 切换、上游 4xx/5xx 排查**          |
| **Sprite-Sheet 无缝循环 + 第三方协议反向工程** | [**§23**](#23-sprite-sheet-无缝循环-第三方协议反向工程)                | **任何 sprite-sheet / 帧动画接入、CSS steps() 调试、第三方资源 API 缺关键字段时的反向工程** |

---

## 1. CSS 层叠与背景配置

**来源**：`lessons/post-mortem-layout-black-borders.md`
**影响范围**：全局布局、任何深色毛玻璃 UI

### 教训 1-A：暗色玻璃态 UI 的正确层叠顺序

```
❌ 错误理解：body 设置纯黑 bg-bg-base，子元素设置渐变
✅ 正确做法：body 设置品牌渐变，子元素使用低透明度暗色 + 毛玻璃滤镜
```

**正确配置**：

- `app/layout.tsx` 的 `body`：`bg-brand-gradient`（鲜艳渐变在最底层）
- 页面容器：`bg-black/75` + `backdrop-blur-xl`（半透明暗色罩在渐变上）
- 卡片：`rgba(10,10,10,0.75)` + 左上红光 + 右下蓝光 radial-gradient

**原理**：深色设计不是单纯黑色，而是 `rgba(0,0,0,0.x)` 半透明罩在鲜艳底层，形成毛玻璃色彩渗透效果。

### 教训 1-B：布局"色带"排查流程

发现 UI 四周出现奇怪色带时，排查顺序：

1. **首先**：检查外层 padding/margin 是否暴露了根节点底色
2. **其次**：用浏览器 Inspector 审查 `body` 的真实 `background`
3. **再次**：检查子路由 layout.tsx 是否有背景配置与父级冲突
4. **最后**：对比毛玻璃效果是否因底色错配而失效

### 教训 1-C：底部安全区用 padding 而非 margin

```tsx
❌ mb-[env(safe-area-inset-bottom)] mb-10   // 双 mb 冲突，背景色无法覆盖安全区
✅ pb-[env(safe-area-inset-bottom)]          // padding 才能让背景色延伸到安全区
```

---

## 2. 设计 Token 与颜色规范

**来源**：REV-3（Markets）、REV-2（Homepage）、REV-5（UIComp）
**影响范围**：所有组件的颜色相关代码

### 教训 2-A：禁止硬编码十六进制颜色

```tsx
❌ className="text-[#8fbeff]"    // 硬编码，无法跟随 Token 全局修改
❌ className="bg-[#ff8f96]"
❌ style={{ color: '#38bdf8' }}
✅ className="text-brand-blue-muted"   // 使用 Design Token
```

**检查方法**：开发后搜索 `text-\[#`、`bg-\[#`、`border-\[#`，发现即修复。

### 教训 2-B：新颜色需求先扩展 tailwind.config.ts

若现有 Token 无法覆盖设计需求，**正确做法**是向 `tailwind.config.ts` 添加新 Token，而不是写硬编码值：

```ts
// tailwind.config.ts → extend.colors
'brand-blue-muted': '#8fbeff',
'brand-red-muted': '#ff8f96',
```

### 教训 2-C：inline style 色值同样违规

即使写在 `style={{}}` 里的颜色也需要替换为 CSS 变量或 Token，特殊情况须在代码中注释说明原因。

---

## 3. 触控热区（Apple HIG）

**来源**：REV-1（Layout）、REV-4（MarketDetail）、REV-5（UIComp）、REV-6（Stake），共 **5 次**，是本项目最高频问题
**影响范围**：所有可点击元素（按钮、链接、Tab、图标按钮）

### 教训 3-A：最小触控热区必须 44px

```tsx
❌ className="h-8"          // 32px，触控困难
❌ className="h-9"          // 36px，仍不足
❌ className="h-10"         // 40px，仍不足（常见误判）
✅ className="min-h-[44px]" // Apple HIG 最低标准
```

**注意**：用 `min-h-[44px]` 而非 `h-[44px]`，允许内容撑大但不缩小。

### 教训 3-B：图标按钮同样适用

```tsx
❌ <button className="p-1"><Icon /></button>      // 实际热区可能 < 44px
✅ <button className="min-h-[44px] min-w-[44px] flex items-center justify-center">
```

### 教训 3-C：开发后的自查清单

新增任何可点击元素后，必须检查：

- `<button>` 是否有 `min-h-[44px]`
- `<a>` 链接块是否有足够高度
- 自定义 Tab/切换控件每个选项是否满足热区要求

---

## 4. React Hooks 陷阱

**来源**：REV-4（MarketDetail/Toast）、REV-4（useEffect 依赖）
**影响范围**：含 useRef/useEffect/useState 的所有组件

### 教训 4-A：useRef 修改不触发重渲染

```tsx
❌ // Toast 使用 useRef 存储显示状态 → 修改 ref.current 不触发 re-render → Toast 永不显示
const toastRef = useRef(false)
toastRef.current = true  // 页面不更新！

✅ // 需要触发渲染的状态必须用 useState
const [isVisible, setIsVisible] = useState(false)
setIsVisible(true)  // 触发 re-render
```

**判断原则**：只有需要持久化但**不需要触发渲染**的值（如 DOM 引用、定时器 ID、上一次值对比）才用 `useRef`。凡是影响 UI 显示的，用 `useState`。

### 教训 4-B：useEffect 依赖数组不可省略

```tsx
❌ useEffect(() => {
  processHistories(histories)  // histories 变化时不会重新执行！
}, [])   // 依赖遗漏

✅ useEffect(() => {
  processHistories(histories)
}, [histories])
```

### 教训 4-C：SSR 水合保护

涉及浏览器 API（`window`、`navigator` 等）的 state 初始值需要水合保护：

```tsx
const [isClient, setIsClient] = useState(false);
useEffect(() => setIsClient(true), []);
if (!isClient) return null; // 服务端不渲染
```

---

## 5. 精度计算规范

**来源**：REV-3（Markets）、REV-6（Stake）、REV-7（Trade），共 **3 次**
**影响范围**：所有金融数字计算和格式化

### 教训 5-A：禁止原生 JS 浮点运算

```tsx
❌ const result = amount * 0.1 + 0.2   // 浮点精度问题
❌ const shares = (Number(amount) * 2.35).toFixed(2)  // 双重违规
❌ const formatted = value.toFixed(4)   // 禁止直接调用

✅ import { add, mul, formatAmount } from '@/lib/decimal'
✅ const result = add(amount, '0.2')
✅ const shares = mul(amount, LP_RATIO)  // LP_RATIO = '2.35'
✅ const formatted = formatAmount(value, 4)
```

### 教训 5-B：常量化魔数

计算中的比率、倍数等应提取为命名常量：

```tsx
❌ mul(amount, '2.35')      // 魔数，含义不明
✅ const LP_RATIO = '2.35'
   mul(amount, LP_RATIO)    // 明确语义
```

### 教训 5-C：数字格式化统一入口

- `formatAmount(value, decimals)` → 通用金融数字
- `formatPercent(value, decimals)` → 百分比（来自 `lib/decimal.ts`）
- `formatCompact(value)` → 大数紧凑展示（K/M/B）
- **禁止**：`Number().toLocaleString()`、`.toFixed()`、手动拼接单位

---

## 6. TypeScript 类型安全

**来源**：REV-2（Homepage）、REV-8（Swap）
**影响范围**：所有 TypeScript 文件

### 教训 6-A：严格模式下的 import 不可省略

```tsx
// tsconfig.json 已开启 strict 模式
❌ const icon: ReactNode = ...   // ReactNode 未 import，strict 模式报错
✅ import type { ReactNode } from 'react'
```

### 教训 6-B：禁止 `any` 逃避类型检查

```tsx
❌ const chart: any = chartRef.current  // 绕过类型系统
❌ (e: any) => { ... }

✅ import type { IChartApi } from 'lightweight-charts'
   const chart: IChartApi | null = chartRef.current
```

### 教训 6-C：变量命名不可遮蔽全局

```tsx
❌ const setInterval = useState(...)   // 遮蔽 window.setInterval，造成混淆
✅ const setSelectedInterval = useState(...)  // 清晰命名
```

---

## 7. 动画与 Keyframes

**来源**：REV-5（UIComp）、REV-6（Stake）
**影响范围**：所有含 CSS 动画的组件

### 教训 7-A：Tailwind 自定义动画必须在 config 中注册

```tsx
❌ className="animate-slideUp"   // 动画类使用了但 tailwind.config.ts 未定义 → 动画无效，无报错
```

**正确流程**：

1. 在 `tailwind.config.ts` 的 `extend.keyframes` 中定义动画帧
2. 在 `extend.animation` 中注册动画名称
3. 在组件中使用 `animate-{name}` class

```ts
// tailwind.config.ts
extend: {
  keyframes: {
    slideUp: {
      from: { transform: 'translateY(100%)', opacity: '0' },
      to: { transform: 'translateY(0)', opacity: '1' },
    },
  },
  animation: {
    slideUp: 'slideUp 0.3s ease-out',
  },
}
```

### 教训 7-B：特殊动画 inline style 的使用边界

**仅**在以下情况允许 inline style：

- 动态计算的动画参数（如 `animationDelay: ${index * 0.1}s`）
- 无法通过 Tailwind 表达的复杂渐变动画

---

## 8. 状态管理陷阱

**来源**：REV-3（Markets，store 状态跨组件泄漏）、REV-6（Stake，关闭弹窗未清理状态）
**影响范围**：Zustand stores、Modal 组件、任何使用全局状态的组件

### 教训 8-A：弹窗关闭时必须清理关联状态

```tsx
❌ const closeModal = () => {
  setIsOpen(false)
  // selectedPlan 仍保留上次选择，下次打开显示旧数据！
}

✅ const closeModal = () => {
  setIsOpen(false)
  setSelectedPlan(null)   // 重置所有关联状态
  setAmount('')
}
```

**原则**：Modal 的 close handler 必须将弹窗内所有 form/selection state 重置为初始值。

### 教训 8-B：列表页不应展示详情页专属的 store 状态

```tsx
// tradeStore 中的 activeMarketId 是为详情页 TradePanel 设计的
❌ // MarketCard 列表页也读取 tradeStore.activeMarketId 来渲染激活态 → 跨卡片残留
✅ // 列表页完全不使用 tradeStore；激活态仅在 market-detail 页面中使用
```

**原则**：store 的使用范围应严格匹配其设计意图，不要在未设计到的组件中复用。

---

## 9. 语言规范

**来源**：REV-5（UIComp，`globals.css` 韩语注释）
**影响范围**：所有文件的注释

### 教训 9-A：代码注释必须使用简体中文

```css
❌ /* 오른쪽에서 슬라이드인 */   /* 韩语，严重违规 */
❌ /* 右からスライドイン */        /* 日语，严重违规 */
✅ /* 从右侧滑入 */               /* 简体中文 ✅ */
```

**注意**：AI 自动生成的代码注释也可能包含韩语/日语，提交前必须审查 `globals.css` 及所有新增注释。

---

## 10. 分页与列表边界

**来源**：REV-7（Trade，分页固定 5 页越界）
**影响范围**：所有含分页的列表组件

### 教训 10-A：分页窗口必须动态计算

```tsx
❌ // 固定渲染页码 1-5，totalPages=8 时 6/7/8 页永远无法访问
const pages = [1, 2, 3, 4, 5]

✅ // 滑动窗口：始终显示 [当前页-2, 当前页+1] 范围内的页码
const getPageWindow = (current: number, total: number) => {
  const start = Math.max(1, current - 2)
  const end = Math.min(total, current + 2)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}
```

---

## 11. Git 提交安全

**来源**：REV-DD010（2026-03-10）—— AI Agent 误用 `git add -f` 提交 `.gitignore` 文件
**影响范围**：任何涉及 `git add` / `git commit` 的操作

### 根本原因（双重失效）

1. **规则冲突**：`common-rules.md` §十二"可直接提交 main"列表中错误包含了
   `".progress/ 目录文档更新"`，但该目录明确在 `.gitignore` 里——规则自相矛盾
2. **AI 行为失当**：git 报错 `"path is ignored by .gitignore"` 时，
   AI 选择用 `-f` 绕过而不是停止并告警

### 教训 11-A：`.gitignore` 报错是硬停止信号

```bash
# git 提示以下内容时，必须立即停止，告知用户，绝不使用 -f 绕过：
The following paths are ignored by one of your .gitignore files:
.progress
hint: Use -f if you really want to add them.
```

**正确处理**：报告给用户 → 由用户决策，AI 不得擅自使用 `--force` / `-f`。

### 教训 11-B：永远不对以下路径执行 `git add`

| 路径         | 理由                                |
| ------------ | ----------------------------------- |
| `.progress/` | AI 本地工作目录，仅存在于开发者本机 |
| `CLAUDE.md`  | AI 端配置，gitignored               |
| `rules.md`   | AI 端配置，gitignored               |

### 教训 11-C：commit 前心智检查

```bash
# 提交前强制问自己：
# 1. 这些文件在 .gitignore 吗？
# 2. 有没有使用 -f / --force？
# 3. git status 里有没有意外文件？
git status  # 永远先看，再 add
```

---

## 12. 第三方 API 接入规范

**来源**：`lessons/post-mortem-sportmonks-integration.md`（SportMonks v3，4 轮调试失败）
**影响范围**：任何接入外部 API 的 Route Handler / 服务端代理

### 教训 12-A：鉴权方式必须 curl 验证，不假设

```typescript
// ❌ 假设 Bearer token 方式（可能被 CDN 层拦截，返回 HTML 400）
fetch(url, { headers: { Authorization: `Bearer ${token}` } })

// ✅ 先用 curl 手工测试鉴权方式
curl -s "https://api.example.com/endpoint?api_token=YOUR_TOKEN"
// 确认成功后再写代码
```

**SportMonks 教训**：文档说支持 Bearer header，但 Cloudflare CDN 返回 HTML 400。
必须用 `api_token` query param。

**判断信号**：收到 HTML 400（非 JSON）→ 优先怀疑 CDN 拦截，不是 API 逻辑问题。

### 教训 12-B：include/expand 分隔符必须从原始文档提取

```bash
# ❌ 信任文档摘要（说"逗号"，实际是分号）
GET /rounds?include=fixtures,league   # → 5001 "does not exist"

# ✅ 先单个 include 验证，再加第二个测试分隔符
GET /rounds?include=fixtures          # 先确认 fixtures 单独 OK
GET /rounds?include=fixtures;league   # 再验证分号是否工作
```

**SportMonks 教训**：所有端点统一用 `;` 分隔，文档摘要中的逗号示例是错误的。

### 教训 12-C：响应字段 ≠ 可过滤参数

```typescript
// ❌ is_current 是响应字段，不是 filter 参数
GET / rounds ? (filters = is_current) : 1; // → HTML 400

// ✅ 先查官方文档 Filters 章节，确认有明确列出的 filter 名称
// 若无对应 filter，拉取分页数据后客户端过滤
const allRounds = await fetchAllPages();
const current = allRounds.find((r) => r.is_current === true);
```

### 教训 12-D：确认关键字段的实际值格式，不假设语义

```typescript
// ❌ 假设赔率标签用英文全称
getOdds(fixture.odds, "Home"); // → 全部返回 '—'

// ✅ 先打印原始响应，确认 label 实际值
// SportMonks 1X2 market: label 是 "1" / "X" / "2"，不是 "Home" / "Draw" / "Away"
getOdds(fixture.odds, "1"); // Home win
getOdds(fixture.odds, "X"); // Draw
getOdds(fixture.odds, "2"); // Away win
```

### 教训 12-E：第三方 API 接入标准 SOP

```
1. curl 验证鉴权（header vs query param）
2. 最简端点验证（无 include/filter）
3. 逐个添加 include（验证分隔符）
4. 验证 filter 名称是否在文档 Filters 章节中明确列出
5. 打印原始响应，确认关键字段的实际格式
6. 写服务端 Route Handler（proxy，token 不暴露给客户端）
7. 写 UI 组件（基于确认后的响应结构）
```

### 教训 12-F：MSW bypass + Next.js Route Handler 架构已验证可行

```
浏览器 → MSW (bypass unhandled) → Next.js Route Handler → 外部 API
```

对于服务端代理路由（`/api/external/*`），**无需添加 MSW handler**。
MSW 的 `onUnhandledRequest: "bypass"` 会自动放行，不会拦截这些请求。

### 教训 12-G：Edge Runtime 代理路由的 IP 来源陷阱

> **状态更新（2026-03-26）**：此条目描述的问题已被 §12-I 覆盖。当前两个 SportMonks 路由均已切换到 Node.js Runtime（DD-042），后端地址已域名化为 `api.oddfi.io`。保留此条目作为历史参考。

**事件**：DD-029 将 `[...path]/route.ts` 加 `runtime = 'edge'`，本地 `next dev` 正常，部署后后端返回 403。

**根因**：Edge Function 从全球边缘节点（如悉尼 `syd1`）发起请求，IP 与 Serverless（固定区域）不同。后端 `<SERVER_IP>` 有来源限制，不认识边缘节点 IP → 403 Forbidden。

**本地不可复现**：`next dev` 不区分 Edge/Serverless，且本地开启 MSW mock 不走真实后端。

**判断规则（已更新，综合 §12-G + §12-I）**：

```
Route Handler 需要 outbound fetch 吗？
├── 是 → 目标地址是裸 IP 吗？
│   ├── 是 → ❌ 禁用 Edge（Vercel Edge 禁止 fetch IP）
│   └── 否（域名）→ 目标是公网还是私有？
│       ├── 公网 API → ✅ 可用 Edge（但 Vercel 官方推荐 Node.js）
│       └── 私有后端 → ❌ 禁用 Edge，用 Node.js
└── 否（纯计算/路由）→ ✅ 可用 Edge
```

**加速替代方案**：不用 Edge 也能加速 —— `Cache-Control: s-maxage` 在 Vercel CDN 层生效，与 Runtime 无关。缓存命中时边缘节点直接返回，不回源。

### 教训 12-H：API 参数变更必须追踪消费链（生产事故）

**事件**：DD-031 Phase 0 给 `getSMFixturesByDate` 加了 `filters=bookmakers:2;markets:1,6,7`，API 响应从 11.7 MB 降至 66 KB。curl 验证返回数据正确（HTTP 200 + 赔率值存在），直接推 main。部署后**所有赔率列显示 "—"**，线上页面赔率全部丢失。

**根因**：组件通过 `market_description` 字符串匹配赔率（如 `'Fulltime Result'`），不同 bookmaker 对同一 market 返回不同的 description（bookmaker=2 返回 `'Full Time Result'`，其他返回 `'Fulltime Result'`）。过滤到仅 bookmaker=2 后，字符串匹配失败。

**错误推理链**：

```
"组件只用 bookmaker=2 的数据" → "API 只返回 bookmaker=2 = 无影响" → "零前端改动"
                                                                        ↑ 错误结论
实际：组件通过字符串匹配，依赖了其他 bookmaker 的 description 值
```

**三条强制规则**：

1. **API 响应变更 → grep 消费链**：改 API 请求参数/响应内容前，必须 `grep` 所有使用该数据的组件，确认字段匹配方式不受影响。本次如果 grep 了 `market_description`，1 秒发现问题。

2. **推 main 前必须本地视觉验证**：任何影响数据展示的改动，`git push` 前必须在 localhost 打开相关页面确认渲染正常。**curl 验证 API ≠ 验证 UI**。

3. **"零影响"结论需代码级证据**：不能凭假设判断"零前端改动"。必须实际阅读消费端代码，用代码证据支撑结论。

**检查清单**（API 参数变更时执行）：

```
□ grep 所有消费该 API 响应的组件
□ 确认组件的字段匹配方式（字符串 vs 数字 vs 枚举）
□ 确认过滤后剩余数据的字段值是否与组件期望一致
□ localhost 启动，打开相关页面视觉验证
□ 确认无误后才 git push
```

**修复方式**：将 3 个组件的赔率匹配从 `market_description`（字符串，因 bookmaker 不同而不同）改为 `market_id`（数字，跨 bookmaker 稳定）。

**与 §12-D 的关系**：§12-D 说"确认关键字段的实际值格式，不假设语义"。本教训的推论 —— 即使你确认了字段值，仍需追踪**谁在消费这些值**以及**消费方式是否依赖你正在改变的条件**。

### 教训 12-I：Edge Runtime 禁止 fetch 直连 IP 地址（生产事故）

**事件**：线上 www.oddfi.io 所有 `/api/sportmonks/*` 接口返回 403，页面无数据。持续时间不确定。

**根因**：Route Handler 配置 `runtime = "edge"`，环境变量 `SPORTMONKS_BACKEND_URL=http://<SERVER_IP>:8080` 使用裸 IP。Vercel Edge Runtime 的 outbound proxy 禁止 `fetch()` 直连 IP 地址，静默返回 403。

**与 §12-G 的区分**：

```
§12-G：边缘节点 IP 不在后端白名单 → 后端返回 403（tcpdump 可见 403）
§12-I：Edge 禁止 fetch 直连 IP    → Vercel proxy 注入 403（tcpdump 显示后端返回 200）
```

**鉴别方法**：tcpdump 显示后端返回 200 但调用方收到 403 → 403 来自平台层，非后端。此时直接查 `vercel logs`，不要继续排查防火墙/安全组。

**综合判断规则（更新 §12-G）**：

```
Route Handler 的上游是什么？
├── 公网 API（有域名）                → 可用 Edge Runtime
├── 私有后端（有域名，无 IP 限制）      → 可用 Edge Runtime
├── 私有后端（有域名，有 IP 白名单）    → 禁用 Edge，用 Serverless（§12-G）
└── 私有后端（裸 IP 地址）             → 禁用 Edge，用 Serverless（§12-I）
                                       或先配域名再用 Edge
```

**强制规则**：环境变量中的后端服务地址，一律使用域名，禁止裸 IP。裸 IP 的三个隐患：

1. Vercel Edge Runtime 禁止 fetch 直连 IP（本次事故）
2. 换 IP 需改环境变量重新部署，域名只改 DNS
3. 域名可配 HTTPS，裸 IP 通常只能 HTTP 明文

**诊断 SOP（Vercel 部署的 Route Handler 出 403 时）**：

```
1. curl 直连后端 → 200？→ 后端无问题
2. 检查后端代码有无 403 路径 → 无？→ 403 不来自后端
3. vercel logs 查看 Edge Function 日志 → 找到平台级错误信息
   （反模式：在 1-2 确认后端正常后继续排查防火墙/安全组 → 浪费时间）
```

---

## 13. Web3 链上交互规范

**来源**：`lessons/post-mortem-swap-flow.md`（PancakeSwap V2 兑换，3 轮反复调试）
**影响范围**：所有 wagmi `writeContract` 调用、钱包状态判断、ERC-20 approve 流程

### 教训 13-A：钱包状态用 `!!address`，禁用 `isConnected`

wagmi `ssr: true` 下，重连阶段 `isConnected = false` 但 `address` 已有值。用 `isConnected` 做守卫会在重连期间错误阻断操作。

```tsx
❌ canOperate: isConnected && !isWrongNetwork    // 重连阶段为 false
❌ isDisconnected: !isConnected                   // 重连阶段为 true
✅ canOperate: !!address && !isWrongNetwork
✅ isDisconnected: !address
```

**规则**：所有 "用户是否有钱包" 的判断，统一用 `!!address`。

### 教训 13-B：`writeContract` 必须用 mutation callbacks，禁止 try-catch

wagmi 的 `writeContract` 是 TanStack Query mutation 的 `mutate`，异步错误（wallet 拒绝、链上模拟失败）走 mutation error state，**不抛 JS 异常**。

```tsx
❌ try { sendSwap({...}); toast("OK"); } catch { toast("Failed"); }
// sendSwap 是 fire-and-forget，catch 永远不执行，wallet 拒绝无反馈

✅ sendSwap({...}, {
  onSuccess() { toast("Submitted", "info"); },
  onError(err) { toast(`Failed — ${err.message}`, "error"); },
});
```

**规则**：项目中任何 `writeContract` / `sendTransaction` 调用，必须有 `onSuccess` + `onError` callback。

### 教训 13-C：Approve + 下游操作必须自动串联

用户点击一个按钮后，不应被迫再点第二次完成同一意图。

```
❌ 用户点 "Swap" → 弹 Approve 弹窗 → 授权完成 → 页面无事发生 → 需再点 "Swap"
✅ 用户点 "Approve & Swap" → Approving... → 授权确认 → 自动拉起 Swap 签名 → Swapping... → 完成
```

**实现模式**：`autoSwapPending` 状态 + `useEffect` 监听 `isApproveConfirmed` + `executeSwapRef` 稳定引用。

### 教训 13-D：链上写操作后必须刷新所有受影响的读缓存

wagmi 的 `useReadContract` / `useBalance` 数据是缓存的，链上写操作不会自动失效缓存。

```
approve 后 → 必须 refetchAllowance()    (allowance ↑)
swap 后   → 必须 refetchAllowance()    (allowance ↓)
swap 后   → 必须 refetchFromBalance()   (balance ↓)
swap 后   → 必须 refetchToBalance()     (balance ↑)
```

**规则**：每个 `writeContract` 调用，写完后列出所有受影响的读缓存，在 `onSuccess` 或 `useEffect(isSuccess)` 中逐一 refetch。

### 教训 13-E：同模式 bug 必须全量修复

修一个 `isConnected` 用法时，必须 grep 全项目同模式代码一次性全修。只修 `isDisconnected` 而遗漏 `canOperate` = 浪费一整轮调试。

```bash
# 修复前强制执行：
grep -rn "isConnected" hooks/ components/  # 列出所有使用点，逐一确认
```

### 教训 13-F：注释 ≠ 实现 — Code Review 必须验证代码

```tsx
❌ // Refetch allowance after approval tx confirms  ← 注释存在
   const needsApproval = ...                        ← 但 refetchAllowance() 从未被调用
```

**规则**：Review 时对 "解释性注释" 后面的代码块做实际验证，注释给人 "已处理" 的错觉。

### 教训 13-G：Web3 功能开发检查清单

```markdown
□ 钱包状态判断用 !!address 而非 isConnected
□ 所有 writeContract 调用都有 onSuccess + onError callbacks
□ approve + 下游操作自动串联（用户不手动触发第二步）
□ 链上写操作后列出所有受影响的读缓存并 refetch
□ useWaitForTransactionReceipt 的 isSuccess 触发了必要副作用
□ 按钮 disabled 状态覆盖所有中间态（approving / swapping / confirming）
□ 注释声明的功能有对应的实际代码实现
```

### 教训 13-H：wagmi 错误**禁止**裸透传到 UI loginError

**来源**：BUG-007（`ConnectorChainMismatchError` cache vs live 失配）

`signMessageAsync` 抛出的 wagmi 内部错误（`ConnectorChainMismatchError` / `UserRejectedRequestError` / `ConnectorAccountChainMismatchError` 等）`message` 字段是面向开发者的英文长串，含 `Version: @wagmi/core@x.x.x` / 内部链 ID 字面量，**直接 setLoginError(err.message) 会把这些泄露给 C 端用户**。

```ts
❌ catch (err) {
  setLoginError(err instanceof Error ? err.message : "Login failed");
  // → UI 显示 "The current chain of the connector (id: 56) does not match
  //         the connection's chain (id: 97). Version: @wagmi/core@2.22.1"
}

✅ import { mapWalletError, classifyWalletError } from "@/lib/wallet-error";
catch (err) {
  setLoginError(mapWalletError(err));
  Sentry.captureException(err, {
    tags: { domain: "wallet", phase: "performLogin", error_kind: classifyWalletError(err) },
  });
}
```

**规则**：

- 钱包/签名相关 catch 块统一走 `lib/wallet-error.ts` 的 `mapWalletError` 翻译
- Sentry 上报必带 `error_kind` tag（`connector-chain-mismatch` / `user-rejected` / `sign-timeout` / `unknown`），便于线上聚合
- `console.error` 保留原始 err（带 stack），便于本地排查

注意：文案替换只解决"用户看到的字"，**不修根因**——对 cache vs live 失配的实际重试策略见 `BUG-007` 排查 runbook + Phase 2/3 规划。

---

## 14. MCP Figma 设计还原规范

**来源**：

- UserAvatarDropdown 毛玻璃效果还原（3 轮才成功）
- WalletConnectModal 像素级还原（3 轮，用户明确表示"失望"）→ `lessons/post-mortem-wallet-connect-modal.md`

**影响范围**：所有基于 Figma MCP 读取设计稿进行像素级还原的任务

### 两类根本原因

**根因类型 1（WalletConnectModal）**："输入不完整" — 节点选错、资源遗漏、样式近似

MCP 返回了正确的设计数据，但 AI 在**获取和使用**阶段犯了 5 个错误：查错节点、不下载图片、用 Tailwind 语义 class 近似替代精确值、不传 forceCode、不做视觉验证。

**根因类型 2（UserAvatarDropdown）**："规格即实现"谬误

MCP `get_design_context` 返回的效果类 CSS 值是 Figma 渲染上下文中的值，不是在目标 App 中能产生相同视觉效果的值。

```
❌ 错误心智模型：MCP 读到的 CSS 值 → 直接写进代码 → 完成
✅ 正确心智模型：MCP 截图（视觉意图）+ CSS 值（参考线索）→ 结合实际渲染环境适配 → 视觉验证 → 完成
```

### 教训 14-0：MCP 调用的 6 步标准 SOP（强制前置流程）

任何 Figma MCP 像素级还原任务，**必须按顺序执行以下 6 步**，不可跳过：

```markdown
□ Step 1: 确认节点粒度

- 用 get_metadata 检查目标 node 在层级中的位置
- 永远选最外层容器（Modal → 选 overlay 层，非内容层）
- 若用户给的 node-id 是子节点，主动往上找父容器

□ Step 2: get_design_context 必传 forceCode: true

- 不传此参数，大型组件可能返回截断结果

□ Step 3: get_screenshot 获取视觉基准

- 截图是"做对了长什么样"的唯一判断标准

□ Step 4: 下载所有 localhost:3845/assets/ 图片

- 识别 MCP 返回代码中的所有 localhost URL
- curl 下载到 public/images/ 对应目录
- 在组件中引用本地路径
- ⚠️ 忽略图片 = 组件缺少图标/图片（WalletConnectModal 第一版的致命错误）

□ Step 5: 转录（非解读）MCP 的精确像素值

- MCP 返回 gap-[32px] → 写 gap-[32px]，禁止替换为 gap-8
- MCP 返回 p-[40px] → 写 p-[40px]，禁止替换为 p-10
- MCP 返回 rounded-bl-[16px] → 写 rounded-bl-[16px]，禁止替换为 rounded-l-2xl
- MCP 返回 rgba(4,6,12,0.5) → 写 rgba(4,6,12,0.5)，禁止用项目 .modal-overlay class 替代
- 唯一例外：项目 Design Token 在 tailwind.config.ts 中已有精确匹配时可替换

□ Step 6: 浏览器截图 → 与 Figma 截图对比

- 不对比不算完成
- 发现偏差 → 修正 → 重新截图 → 再对比
```

**WalletConnectModal 教训**：第一版跳过了 Step 1（查错节点）、Step 2（未传 forceCode）、Step 4（未下载图片）、Step 5（用语义 class 近似）、Step 6（未截图验证），导致交付结果与设计稿差距巨大。

### 教训 14-A：MCP 的两类产出有不同信任等级

| MCP 产出                     | 信任等级                                    | 用途                             |
| ---------------------------- | ------------------------------------------- | -------------------------------- |
| **截图**（`get_screenshot`） | ★★★ 高 — 这是设计的**视觉意图**，是最终目标 | 作为"做对了没有"的唯一判断基准   |
| **布局/间距/字体/颜色**      | ★★☆ 中 — 绝对值通常可直接用                 | 间距、圆角、字号、字重可直接采用 |
| **透明度/模糊/阴影/渐变**    | ★☆☆ 低 — 效果类属性**强依赖渲染环境**       | 仅作为参考起点，必须结合环境适配 |

**核心区分**：布局类属性（spacing/sizing/typography）是**绝对的**，效果类属性（opacity/blur/shadow/gradient）是**相对的** — 它们的视觉结果取决于底层内容。

### 教训 14-B：效果类属性必须走"环境适配"流程

```
1. 读取 MCP 截图 → 记住视觉意图（"这个下拉菜单应该有可见的毛玻璃效果"）
2. 读取 MCP CSS 值 → 记为参考基线（rgba(25,27,32,0.9) + blur(6.5px)）
3. 分析实际渲染环境：
   - 元素背后是什么？（深色页面 #020617？浅色内容区？图片？）
   - 父容器是否有不透明背景？（TopNav background: #04060C）
   - 项目中同类效果用什么参数？（.glass-card: 0.75 opacity + 14px blur）
4. 判断 MCP 值在实际环境中能否产生截图所示的视觉效果
5. 若不能 → 以项目现有同类效果的参数为基准进行适配
```

**本次实例**：

```
Figma 值：rgba(25,27,32,0.9) + blur(6.5px)
  → 在 Figma 预览中（较亮背景）= 可见毛玻璃 ✅
  → 在实际 App 中（#020617 纯黑底）= 肉眼看不到任何透明度 ❌

项目已有基准：.glass-card → rgba(10,10,10,0.75) + blur(14px) = 可见毛玻璃 ✅
适配结果：rgba(20,22,28,0.78) + blur(14px) = 可见毛玻璃 ✅
```

### 教训 14-C：项目现有同类效果是最可靠的参考系

```
❌ 第一反应是复制 Figma 值
❌ 第二反应是猜测 CSS 前缀问题
✅ 正确第一反应：grep 项目中相同视觉效果的已有实现

# 遇到"毛玻璃效果"需求 → 先找项目中已有的毛玻璃
grep -r "backdrop-filter\|backdrop-blur" app/ components/ --include="*.css" --include="*.tsx"
# 找到 .glass-card → 对照其参数来适配新组件
```

**原则**：项目中**已经在用户面前工作的代码**，永远比 Figma 导出的 CSS 值更可靠。

### 教训 14-D：视觉验证是唯一的"完成"标准

```
❌ "代码写对了" = 完成        // 本次错误：CSS 语法正确但视觉效果不对
❌ "匹配 Figma 值" = 完成    // 本次错误：值一样但环境不同导致效果不同
✅ "在实际 App 中视觉匹配截图" = 完成
```

任何效果类实现完成后，**必须在浏览器中实际查看**。不看不算完。

### 教训 14-E：MCP 设计还原标准 SOP

```markdown
□ 1. 调用 get_screenshot → 截图存为视觉基准（"做对了长什么样"）
□ 2. 调用 get_design_context → 提取布局值（间距/圆角/字号）和效果值（透明度/模糊/阴影）
□ 3. 布局值 → 直接采用（间距、圆角、字号、字重通常可直接用）
□ 4. 效果值 → 环境适配流程：
a. 分析元素的实际渲染背景（父容器、页面底色、层叠上下文）
b. grep 项目中同类视觉效果的现有实现
c. 以现有实现为基准适配，而非直接套用 Figma 值
□ 5. 浏览器实际查看 → 与步骤 1 的截图对比
□ 6. 不匹配 → 调整效果参数，重复步骤 5
```

### 教训 14-F：图标资源分类 — 禁止擅自替代设计稿图标

**来源**：MatchDetailPanel 统计图标（进球/黄牌/红牌/角球）被 AI 自作主张用 Phosphor Icons + 手写 div 替代，与设计稿视觉差异大

**三类图标的处理规则**：

| 类型             | 识别方式                                                 | 处理方式                       |
| ---------------- | -------------------------------------------------------- | ------------------------------ |
| **通用 UI 图标** | 菜单/箭头/搜索/关闭/展开等                               | Phosphor Icons 库引用          |
| **品牌资产**     | Logo/代币图标/合作方标识                                 | Figma MCP 导出 → `public/`     |
| **定制功能图标** | 设计稿中有特定视觉设计的图标（如带字母的卡片、特殊形状） | **先问用户确认**，再按指示处理 |

**核心规则**：

```
❌ 设计稿有自定义进球图标 → 自行用 Phosphor 的 ChartLineUp 替代
❌ 设计稿有带"Y"标记的黄牌 → 自行用 div + bg-[#F5A623] 模拟
✅ 遇到非通用图标 → 停下来问用户："这几个图标资源应该怎么处理？"
✅ 用户确认 MCP 导出 → get_design_context 获取 SVG URL → curl 下载 → public/icons/
```

**判断标准**：如果图标有**特定的视觉设计**（形状、颜色、内嵌文字），而不仅仅是一个概念符号，那它就是定制功能图标，不要用通用库替代。

---

## 15. API 数据规范化层设计

**来源**：`sportmonks-normalize.ts` — `normalizeLine` 函数对非数值 handicap 值误报 Invalid 并丢弃
**影响范围**：任何对外部 API 响应做 normalize / transform 的代码

### 根本原因：反应式设计 vs 主动式设计

`normalizeLine` 的诞生动机是修复 split line（`"0,0.5"`）导致的组件崩溃。设计时的思维路径：

```
crash → 原因是 split line → 写函数处理 split line → 顺便校验数值合法性 → 非数值？报 warn + 返回 null
```

这是"以症状定义问题"——把 `handicap` 字段假设为"应该是数值"，而没有先穷举该字段在所有盘口类型中的合法形态。

SportMonks API 中 `handicap` 是一个**多态字段**，语义由 `market_id` 决定：

| Market 类型         | handicap 字段含义 | 示例值                |
| ------------------- | ----------------- | --------------------- |
| Asian Handicap      | 数值盘口线        | `"-0.5"`, `"0,0.5"`   |
| Over/Under          | 数值总分线        | `"2.5"`, `"3.5"`      |
| Both Teams To Score | 是/否标签         | `"Yes"`, `"No"`       |
| Goal Before X       | 时间区间标签      | `"Goal Before 79:00"` |
| Minute Range        | 区间标签          | `"55 To 65"`          |

### 教训 15-A：规范化层只做"格式转换"，不做"合法性判断"

```typescript
// ❌ 规范化层假设所有值都应该是数值，非数值 = 无效
if (!isNumeric(value)) {
  warn("Invalid");
  return null;
}

// ✅ 规范化层只转换它明确知道如何处理的格式，其余原样透传
if (isSplitLine(value)) return averageSplitLine(value);
return value; // 不认识的值 → 透传，不丢弃
```

**原则**：规范化层的职责是"格式归一"，不是"数据校验"。不认识的值应该透传给下游，由消费方按业务语义决定如何处理。

### 教训 15-B：设计规范化函数前，必须先穷举上游数据的所有合法形态

```markdown
□ 1. 阅读 API 文档中该字段的完整定义（不只看当前用到的 market 类型）
□ 2. 用 curl / 日志打印实际响应，确认真实数据的值域
□ 3. 按"我需要转换的" vs "我不认识的"分类，而非"合法" vs "非法"
□ 4. 不认识的值 → 透传（不是 null，不是 warn）
```

> **与 §12-D 的关系**：§12-D 说"确认关键字段的实际值格式，不假设语义"。本教训是 §12-D 的推论——如果你没穷举字段的所有合法形态，你写的 normalize 函数就会错误地丢弃你没见过的合法值。

### 教训 15-C：console.warn 的滥用比沉默更危险

```
❌ 大量 warn 刷屏 → 开发者习惯性忽略 → 真正的问题被噪音淹没
✅ warn 只在真正异常时触发（如 split line 无法解析为数值 → 数据确实损坏）
```

**判断标准**：如果一个 warn 在正常数据下就会高频触发，那说明你的"正常"定义有误，不是数据有问题。

---

## 16. 后台进程管理

**来源**：Insights 分析（2026-03-24），SSR 基线测试 + H5 开发中 15 次 OOM 失败
**影响范围**：任何使用 `run_in_background` 的场景

### 教训 16-A：禁止后台启动内存密集型进程

`next build`、`next start`、`pnpm dev` 等进程内存开销大，通过 `run_in_background` 启动极易被 macOS OOM killed（exit code 137）。

```
❌ run_in_background: true + next start     → 反复 OOM，3-5 次来回
✅ 前台执行 + timeout: 120000              → 稳定运行，超时自动退出
✅ 让用户在另一个终端手动启动               → 最可靠
```

### 教训 16-B：后台任务仅用于轻量操作

适合 `run_in_background` 的场景：`git` 操作、`pnpm test`、文件搜索等秒级完成的命令。
不适合的场景：dev server、build、任何需要持续运行的进程。

---

## 复盘文档索引

| 文件                                                                                 | 日期       | 主题                                                  | 核心教训                                                                                                                        |
| ------------------------------------------------------------------------------------ | ---------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| [post-mortem-layout-black-borders.md](./post-mortem-layout-black-borders.md)         | 2026-03-01 | 全局布局黑框与玻璃态失效                              | 暗色 UI 层叠顺序；底部安全区用 padding                                                                                          |
| [post-mortem-sportmonks-integration.md](./post-mortem-sportmonks-integration.md)     | 2026-03-11 | SportMonks v3 API 集成（4 轮失败）                    | 鉴权 query param；include 分号；label 格式；is_current 无 filter                                                                |
| [post-mortem-swap-flow.md](./post-mortem-swap-flow.md)                               | 2026-03-13 | PancakeSwap V2 Swap 流程（3 轮反复）                  | wagmi SSR `!!address`；mutation callbacks；approve→swap 串联；allowance 双向 refetch                                            |
| [post-mortem-wallet-connect-modal.md](./post-mortem-wallet-connect-modal.md)         | 2026-03-16 | WalletConnectModal Figma MCP 还原失败（3 轮）         | 节点粒度；forceCode；下载图片资源；转录精确值；截图验证                                                                         |
| [REWIND-005-vercel-edge-ip-403.md](./REWIND-005-vercel-edge-ip-403.md)               | 2026-03-26 | Vercel Edge Runtime 禁止 fetch 直连 IP（线上 P0）     | Edge fetch 不可用裸 IP；平台级 403 vs 应用级 403 鉴别；vercel logs 终极诊断；后端地址必须用域名                                 |
| [post-mortem-eip55-checksum-multicall.md](./post-mortem-eip55-checksum-multicall.md) | 2026-04-03 | DSU 地址 EIP-55 checksum 错误导致全量 ERC-20 余额为 0 | 合约地址必须 getAddress() 校验；multicall 一个错全挂（连坐）；useReadContracts 失败先打 result.error                            |
| [post-mortem-wallet-disconnect-flash.md](./post-mortem-wallet-disconnect-flash.md)   | 2026-04-24 | MetaMask 断连后再连接「只闪一下」（3 轮补丁）         | wagmi `disconnect()` 不撤 EIP-2255 授权；必须 `wallet_revokePermissions` 先撤权再断；断开清理统一沉淀到 `lib/wallet-session.ts` |

---

## 17. CSS Grid 布局溢出与诊断方法

**来源**：`lessons/post-mortem-three-column-layout.md`
**影响范围**：任何使用 CSS Grid 的多列布局，尤其是含固定宽度子元素的窄列

### 教训 17-A：布局溢出/重叠必须用 DOM 数据诊断，禁止仅凭截图

```
❌ 看截图 → 猜测问题 → 改 CSS → 再截图 → 4 轮循环浪费 token
✅ 第一步 evaluate_script 检查 computed width → 找到溢出层级 → 1 轮修复
```

遇到布局溢出时的**强制诊断流程**：

1. 用 `evaluate_script` / DevTools 从外到内逐层检查 `getBoundingClientRect().width`
2. 找到 "父容器宽度正确、子元素宽度异常" 的突变层级
3. 在突变层级修复，不要在更外层改布局方式

**反模式**：问题出在子元素宽度溢出，却反复修改父容器的布局方式（flex → grid → grid+空列）。这是"在错误的层级修 Bug"。

### 教训 17-B：CSS Grid `1fr` 有隐含最小宽度，窄列必须用 `minmax(0, 1fr)`

```css
/* ❌ 1fr = minmax(auto, 1fr)，auto 由内容最小宽度决定 */
grid-template-columns: 278px 1fr 442px;

/* ✅ minmax(0, 1fr) 允许列宽压缩到 0 */
grid-template-columns: 278px minmax(0, 1fr) 442px;
```

当 grid item 内部有 `w-[186px] shrink-0` 等固定宽度元素时，`auto` 最小宽度会大于分配的 track 空间，导致 track 被撑大、与相邻列重叠。

**适用场景**：

- 固定宽度窄列（< 400px）
- 响应式布局中需要内容收缩的列
- 内部含 `shrink-0` / `w-[Npx]` 子元素的容器

### 教训 17-C：固定宽度子元素 + 弹性容器 = 必须加 `overflow-hidden`

当弹性容器（grid/flex item）内部有不可收缩的固定宽度子元素时，容器不会自动约束子元素宽度。

```tsx
/* ❌ 卡片自然宽度 320px > 容器 278px，溢出 */
<div className="bg-secondary rounded-[16px] p-[16px]">
  <div className="w-[186px] shrink-0">赔率</div>
</div>

/* ✅ overflow-hidden 让卡片尊重容器边界 */
<div className="bg-secondary rounded-[16px] p-[16px] overflow-hidden">
  <div className="w-[186px] shrink-0">赔率</div>
</div>
```

替代方案：容器加 `min-w-0`，或子元素去掉 `shrink-0` 改为可收缩。

### 教训 17-D：Grid 列间距用空列，不用 margin

```css
/* ❌ margin 在 cell 内部偏移，不创建列间隔 */
grid-template-columns: 278px 1fr 442px;
/* detail: ml-[34px] mr-[14px] */

/* ✅ 空列物理隔开，间距精确 */
grid-template-columns: 278px 34px minmax(0, 1fr) 14px 442px;
/* items 通过 gridColumn: 1/3/5 跳列放置 */
```

当不同列间需要不同间距（如 34px 和 14px）时，CSS Grid 的 `column-gap` 只能设统一值。用空列做间距可以实现不同间距值。

---

---

## §18 Hover 下拉菜单显隐动画：CSS transition 替代 CSS animation

> **来源**：UserAvatarDropdown hover 下拉菜单，鼠标移出后闪烁 2-3 次才消失。经历 4 轮修复（含 18-A/B/C 三条补丁），最终确认根因是架构层面的问题，非补丁可修。
> **影响范围**：所有需要入场/退场动画的 hover 组件（dropdown、tooltip、popover）

### 18-ROOT 禁止用 CSS `animation` 做状态驱动的显隐过渡

**根因（5-Why）**：

1. CSS `animation` 没有 `fill-mode: forwards` → 动画结束后元素 snap-back 到 `opacity: 1`
2. `setTimeout` 和 CSS `animation` 由不同线程驱动（JS event loop vs compositor），精度永远无法完美对齐
3. `isClosing` 中间态引入第三个状态维度，与 mouseenter/mouseleave 的时序竞争产生闪烁循环
4. 在此架构上打补丁（timer 替代 onAnimationEnd / pointer-events:none / isClosing 守卫）只能降低概率，无法根除

**核心原则**：CSS `animation` 是"播放一次性动画"的工具；状态驱动的显隐过渡应使用 CSS `transition`。

```typescript
// ❌ 错误架构：CSS animation + 条件渲染 + isClosing 状态机
const [isClosing, setIsClosing] = useState(false);
const closeAnimTimerRef = useRef(null);

const startClose = useCallback(() => {
  setIsClosing(true);
  closeAnimTimerRef.current = setTimeout(() => {
    setIsOpen(false);
    setIsClosing(false);
  }, 150);
}, []);

// JSX:
{isOpen && (
  <div className={isClosing ? "animate-dropdown-out" : "animate-dropdown-in"}>
    ...
  </div>
)}

// ✅ 正确架构：CSS transition + 常驻 DOM + 纯二态
// 无 isClosing，无 closeAnimTimerRef，无 startClose

// JSX:
<div
  className={isOpen
    ? "opacity-100 translate-y-0 scale-100"
    : "opacity-0 -translate-y-2 scale-[0.96] pointer-events-none"
  }
  style={{
    visibility: isOpen ? "visible" : "hidden",
    transition: isOpen
      ? "opacity 200ms ease-out, transform 200ms ease-out, visibility 0s 0s"
      : "opacity 150ms ease-in, transform 150ms ease-in, visibility 0s 150ms",
  }}
  aria-hidden={!isOpen}
>
  ...
</div>
```

**为什么 CSS transition 能根治**：

- `transition` 在两个静态 CSS 值之间插值，结束后**停留在目标值**（`opacity: 0`），无 snap-back
- 不需要 JS timer 同步，浏览器自行管理过渡时序
- 不需要 `isClosing` 中间态，状态机从 3 态降为 2 态（开/关）
- 不需要条件渲染，避免 mount/unmount 导致的动画重放
- `pointer-events-none` 随 `isOpen=false` 立即生效（非动画属性，无过渡延迟）
- `visibility: hidden` 通过 `transition-delay` 在退出动画结束后才触发，确保过渡期间元素可见

### Checklist（开发含显隐动画的 hover 组件时）

- [ ] 用 CSS `transition`（opacity/transform/visibility），不用 CSS `animation`
- [ ] 元素常驻 DOM，用 `visibility` + `opacity` + `pointer-events` 控制显隐
- [ ] 关闭时 `pointer-events-none` 立即生效（CSS class 切换，非过渡）
- [ ] 关闭时 `visibility: hidden` 延迟到过渡结束（`transition: visibility 0s 150ms`）
- [ ] 无 `isClosing` 中间状态，无 `closeAnimTimerRef`
- [ ] 开启时 `visibility: visible` 立即生效（`transition: visibility 0s 0s`）

---

## 19. SSR Hydration 与 TanStack Query 服务端渲染

**来源**：`lessons/REWIND-006-ssr-hydration-queryclient.md`（3 轮修复，含 1 次 S-3 回退导致错误从 2→5 个）
**影响范围**：所有 Zustand Store 读 localStorage / TanStack Query Server prefetch / HydrationBoundary 使用

### 教训 19-A：Zustand Store + SSR 必须延迟 hydrate

Zustand `create()` 的初始值**禁止**调用有副作用的函数（localStorage / cookie / URL 参数读取），否则服务端和客户端初始状态不一致 → Hydration Mismatch。

```typescript
// ❌ 模块顶层读 localStorage → SSR='10000', CSR='8300' → mismatch
const initialState = loadFromStorage();
export const useStore = create(() => ({ balance: initialState.balance }));

// ✅ 默认值初始化 + 延迟 hydrate
export const useStore = create(() => ({ balance: DEFAULT_BALANCE }));

let _hydrated = false;
export function hydrateStore() {
  if (_hydrated || typeof window === "undefined") return;
  _hydrated = true;
  useStore.setState(loadFromStorage());
}
// 在 app/providers.tsx 的 useEffect 中调用 hydrateStore()
```

### 教训 19-B：QueryClient 禁止模块顶层 `new QueryClient()`

模块级单例在服务端被所有请求共享，导致跨用户数据泄漏。

```typescript
// ❌ providers.tsx 模块顶层
const queryClient = new QueryClient({...});

// ✅ getQueryClient() 工厂函数（app/get-query-client.ts）
import { isServer } from "@tanstack/react-query";
let browserClient: QueryClient | undefined;
export function getQueryClient() {
  if (isServer) return new QueryClient({...});  // 服务端：每请求新建
  if (!browserClient) browserClient = new QueryClient({...}); // 浏览器：复用单例
  return browserClient;
}
```

### 教训 19-C：HydrationBoundary 必须在 Client Component 内部使用

`HydrationBoundary` 内部调用 `useQueryClient()` 需要 `QueryClientProvider` 上下文。在 Server Component 中使用时，RSC 序列化阶段该上下文不可达 → 报错 "No QueryClient set"。

```tsx
// ❌ 在 Server Component 中使用 → RSC 阶段找不到 Provider 上下文
// page.tsx (Server Component)
return (
  <HydrationBoundary state={dehydrate(queryClient)}>
    <ClientComp />
  </HydrationBoundary>
);

// ✅ 方式一：dehydratedState 透传给 Client Component，在其内部包裹
// PageClient.tsx ('use client')
return <HydrationBoundary state={dehydratedState}>{/* ... */}</HydrationBoundary>;

// ✅ 方式二：不用 Server prefetch，Client Component 自行 useQuery + Skeleton
// page.tsx — 最简方案，适合已有完整加载态的组件
return <ClientComp fixtureId={fixtureId} />;
```

### 教训 19-D：SSR 修复后必须浏览器实际验证

TypeScript 编译通过 ≠ 运行时无 Hydration 错误。SSR/Hydration 问题**只有**在浏览器中刷新页面并检查 Error Overlay + Console 才能确认。

### Checklist（新建 Zustand Store 或 TanStack Query 页面时）

- [ ] Store `create()` 初始值是否有副作用函数？→ 改为默认值 + 延迟 hydrate
- [ ] `new QueryClient()` 是否在模块顶层？→ 改为 `getQueryClient()`
- [ ] `HydrationBoundary` 是否在 Server Component 中？→ 移到 Client Component 内部或去掉
- [ ] 修改后是否在浏览器中实际刷新验证？→ 截图 + Console 检查
- [ ] 退出动画 CSS 带 `forwards` fill-mode（兜底防闪）

---

## 20. EIP-55 Checksum 与 Multicall 连坐

**来源**: `lessons/post-mortem-eip55-checksum-multicall.md`（DSU 地址 checksum 错误，Deposit 全量 ERC-20 余额为 0）
**影响范围**: 任何新增合约地址、`useReadContracts` multicall 调用、`token-registry.ts` 维护

### 教训 20-A: 合约地址必须用 `getAddress()` 校验 checksum

手写合约地址时，肉眼无法可靠判断 EIP-55 checksum 大小写。**任何新增或修改合约地址必须通过 viem `getAddress()` 校验**。

```typescript
import { getAddress } from "viem";

// ❌ 手抄地址，checksum 可能错误（大小写不对 → viem 静默拒绝）
address: "0x1674b2a61108b38493A0549F143AF0B56E6BA98e";

// ✅ 用 getAddress() 生成正确 checksum
address: getAddress("0x1674b2a61108b38493a0549f143af0b56e6ba98e");
// → "0x1674B2a61108b38493A0549f143Af0B56E6ba98E"
```

**验证脚本**（新增代币时执行）：

```bash
node -e "const {getAddress}=require('viem'); console.log(getAddress('你的地址'))"
```

### 教训 20-B: viem 地址校验是阻断性的 — 一个错全部挂

viem v2 对所有地址进行严格 EIP-55 校验。在 `useReadContracts` multicall 场景下：

```
❌ 8 个合约调用中 1 个地址 checksum 错误
   → 不是只有那 1 个失败
   → 整个 multicall 批次全部失败
   → 8 个 ERC-20 余额全部显示 0
   → bug 表现（USDT 余额 0）与根因（DSU 地址错）完全分离
```

**为什么危险**: 你改了 token A 的地址 → token B 的余额坏了。这种"连坐"机制让排查方向完全错误。

### 教训 20-C: wagmi `useReadContracts` 失败时的诊断方法

`allowFailure: true`（默认值）会吞掉所有错误，UI 只看到余额为 0，无任何 console 报错。

```typescript
// ❌ 看到余额为 0 → 怀疑 RPC 问题 → 怀疑链 ID → 读 wagmi 源码 → 40min
// ✅ 第一步就打印 result 的 status + error → 1min 定位

const { data: results } = useReadContracts({...});
// 诊断时加：
results?.forEach((r, i) => {
  if (r?.status === 'failure') {
    console.error(`[multicall] ${tokens[i].symbol} FAILED:`, r.error);
  }
});
```

**最短路径**: 遇到链上数据读取异常 → 先打印完整 result（含 error） → 不要先猜 RPC / 先读源码。

### 教训 20-D: token-registry 维护 Checklist

```markdown
□ 新增代币地址用 getAddress() 校验 checksum
□ 修改后跑一遍 useTokenPortfolio，确认所有 ERC-20 的 status === "success"
□ 确认 decimals 与链上合约一致（BSC USDT = 18，ETH USDT = 6）
□ iconUrl 的 checksum 地址与 address 字段一致
```

---

## 21. CSS 渐变描边 + Figma CSS export 陷阱

**来源**：Roadmap popover hover 卡片边框还原，3 轮迭代才落到正解（2026-05-06）
**影响范围**：任何 mask-composite 渐变描边、Figma 玻璃 / 高光边框还原、sub-pixel border 调试

### 复盘：3 轮迭代分别错在哪里

设计图（Figma 4218:192010）：popover 边框「TL/BR 角白色高亮 → 沿 edge 渐变衰减 → 中段透明」。

| 轮次             | 实现                                                                                                          | 视觉结果                                   | 错在哪                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------ |
| v1（原始）       | 2 个 radial-gradient span（circle 320px / alpha 0.7 at TL & BR）                                              | 角不够亮，整圈描边偏均匀                   | 半径 320px 太大，brightness 在角部和对角中点差异不明显 |
| v2（我的尝试 1） | 4 条 edge linear-gradient 各占 1px 边宽，从角端 0.85 → 50% 处透明                                             | 边渐变效果对了，**TL/BR 角变暗**（缺一块） | rounded corner 弧线段不在 edge 矩形内（见下方根因 3）  |
| v3（我的尝试 2） | 外层 div 加 `border: 0.5px solid #FFF` base + 1 层小 radial 角加亮                                            | **整圈粗白边**，与设计图差距巨大           | Chrome 把 0.5px sub-pixel 渲染成 1px（见下方根因 2）   |
| v4（最终）       | Layer 1: 4 条 edge linear-gradient + Layer 2: TL/BR circle 60px radial 圆形高光，**双层 mask-composite span** | 完美匹配设计图                             | —                                                      |

### 教训 21-A：Figma CSS export 不包含 Effects 层，**别凭它推断视觉**

Figma 给的 CSS（如 `border: 0.5px solid #FFF; backdrop-filter: blur(24px);`）是**基础样式**，**不导出 Effects 面板**（Inner Shadow / Inner Glow / 单独的渐变 stroke layer）。设计图上看到的"角亮、中段暗"完全靠 Effects 实现，CSS 里看不到。

```
❌ 看到 Figma 给的 CSS 是 0.5px solid #FFF → 直接用 → 渲染成粗白边
✅ 用 Figma MCP 读 Effects（mcp__figma-desktop__get_metadata 看节点的 effects 字段）
✅ 设计图与导出 CSS 视觉不一致时，直接问设计师确认 Effects 配置
```

### 教训 21-B：Chrome 把 `border: 0.5px` 渲染为 1px

`getComputedStyle(el).border` 实测返回 `1px solid rgb(255, 255, 255)` —— Chrome（及 Safari）会把 sub-pixel border 向上取整为 1px。Figma 写 0.5px 想要的"几乎不可见的细线"在 Chrome 里就是粗白边。

```
❌ 凭 spec 假设 0.5px 会渲染半透明细线
✅ 实测 getComputedStyle，看实际渲染值
```

**复用建议**：需要"细于 1px"视觉时，用 mask-composite + linear-gradient 控制 alpha（如 0.3-0.5）替代 sub-pixel border。

### 教训 21-C：rounded corner 会把 edge linear-gradient 的角点削掉，导致 corner 缺一块

mask-composite + `padding: 1px` + `linear-gradient ... 100% 1px no-repeat` 这套描边 trick，**只能渲染矩形 4 条边的 1px 带**。当容器 `border-radius: 16px`：

- 几何上的 (0,0) 顶点在圆角弧线之外（透明区），edge 矩形的角点被裁掉
- 圆角弧线段（约 16×16 的 1/4 圆）**不在任何 edge 矩形内**
- 结果：4 条 edge gradient 在每个 corner 留出 ~16px 的"无 stroke"缺口 → 角部变暗

```
❌ 只用 4 条 edge linear-gradient，期望覆盖整个圆角描边
✅ 4 条 edge gradient（盖直线段）+ 4 个 corner radial-gradient（盖弧线段）双层 mask-composite span
```

### 教训 21-D：正解模板 — 双层 mask-composite

```tsx
{
  /* Layer 1: 4 条 edge linear-gradient，盖 4 条直线段 */
}
<span
  aria-hidden
  className="pointer-events-none absolute inset-0 rounded-[16px]"
  style={{
    padding: 1,
    background: [
      "linear-gradient(90deg,  rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 50%) 0 0   / 100% 1px no-repeat",
      "linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 50%) 0 0   / 1px 100% no-repeat",
      "linear-gradient(270deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 50%) 100% 100% / 100% 1px no-repeat",
      "linear-gradient(0deg,   rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 50%) 100% 100% / 1px 100% no-repeat",
    ].join(", "),
    WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
    WebkitMaskComposite: "xor",
    maskComposite: "exclude",
  }}
/>;
{
  /* Layer 2: TL/BR 圆形 radial，盖 rounded corner 弧线段（仅高光角；其余 2 角同理） */
}
<span
  aria-hidden
  className="pointer-events-none absolute inset-0 rounded-[16px]"
  style={{
    padding: 1,
    background:
      "radial-gradient(circle 60px at 0% 0%,     rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%), " +
      "radial-gradient(circle 60px at 100% 100%, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)",
    WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
    WebkitMaskComposite: "xor",
    maskComposite: "exclude",
  }}
/>;
```

**参数选取**：

- edge linear-gradient 衰减位（`50%`）控制"亮 → 暗"中点
- corner radial 半径（`60px`）应略大于 `border-radius`（16px）确保弧线段被覆盖
- corner radial alpha（`1.0`）一般等于或略高于 edge gradient peak（`0.85`）以让角更亮

### 教训 21-E：流程教训 — 减少迭代浪费

3 轮迭代根本上是因为 **没有先理解"渐变描边在 rounded corner 弧线段会缺一块"这个几何事实**。如果第一轮就把 corner 弧线段的渲染范围算清楚，会直接落到 v4 正解。

```
❌ 看截图说"角变暗了" → 改 alpha → 改 padding → 改半径 → 反复试
✅ 在白板算清"哪些像素被 mask 保留 / 哪些被裁" → 一次写出双层 span
```

实施这类描边任务前，**必须心算或用浏览器 inspector 验证**：

1. mask-composite 的 padding/content-box 留下的"可见 ring"具体覆盖哪些坐标
2. `border-radius` 把哪些 corner 像素裁掉
3. 每个 background-image 的 size/position 在那个 ring 上对应什么数值

---

## 22. AI Provider / LLM 上游调试

**来源**：DD-106 AI Agent 浮窗 / 全屏页 / xAI provider 接入复盘（2026-05-19）
**影响范围**：`lib/ai/provider.ts`、`/api/ai/chat` route、任何引入新 LLM 供应商或切换 provider 的工作

### 教训 22-A：服务端错误**必须**先看 dev server 终端日志，不要光盯浏览器 Network

DD-106 xAI 集成「改了几次 env 都不行」绕了 3 轮假设：

| 轮次 | 假设                | 改动                                 | 结果       |
| ---- | ------------------- | ------------------------------------ | ---------- |
| 1    | env 没生效          | 重启 dev server                      | 还是错     |
| 2    | localStorage 脏数据 | 加 `status === "ok"` 过滤 + 清浏览器 | 还是错     |
| 3    | 凭代码推断          | 反复读 useAiChat + schema            | 找不到根因 |

最后用 Chrome DevTools MCP 抓到 Response body：

```json
{ "code": "AI_UPSTREAM_ERROR", "message": "AI service unavailable", ... }
```

—— 不是 `AI_BAD_REQUEST`！这是 **xAI 上游返回 400**，与前端 / zod 完全无关。

如果**第一步就看 dev server 终端**，会看到 `provider.ts:110` 打的日志：

```
[ai/provider] upstream error { provider: 'xai', status: 400, snippet: '{"error":"Model not found: grok-2-latest"}' }
```

—— **10 秒定位**，不用绕 3 轮。

#### 强制门控（沿用 `wallet-debug-runbook.md` 日志优先原则）

诊断 `/api/ai/*` / 任何 server-side route 报错的顺序：

1. **dev server 终端最近 50 行**（这里有 console.error 的完整 snippet）
2. 浏览器 Network → Response body（看 code 字段是 `AI_BAD_REQUEST` / `AI_UPSTREAM_ERROR` / `AI_NOT_CONFIGURED` / `AI_RATE_LIMITED`）
3. 浏览器 Network → Request body（确认客户端发了什么）
4. 用 curl 直接打上游 API（绕过我们 server，看上游纯净响应）

**禁止**：未看 server 日志就假设是前端 bug，凭直觉改前端代码。

### 教训 22-B：HTTP status 透传规则要记牢

`lib/ai/provider.ts:115`：

```ts
const status = res.status >= 500 ? 502 : res.status;
throw new AiUpstreamError("AI_UPSTREAM_ERROR", status);
```

**4xx 透传，5xx 归一为 502**。所以：

| 看到的状态码 | 真实含义                                            |
| ------------ | --------------------------------------------------- |
| `400`        | **上游 4xx** —— 模型名错 / 请求格式错 / key 无效    |
| `429`        | 我们 server 自己的限流（route.ts:67-73 ANON 5/min） |
| `502`        | 上游 5xx —— 上游挂了 / 限流 / 超时                  |
| `503`        | `AiConfigError` —— env 缺 key 或 provider 未识别    |
| `500`        | 我们代码 bug                                        |

记住：**`400` ≠ 一定是请求格式错**。还要看 response body 里 `code` 是 `AI_BAD_REQUEST`（zod 拒）还是 `AI_UPSTREAM_ERROR`（上游 4xx 透传）。

### 教训 22-C：LLM 模型名会下线，**禁止**把模型名当稳态常量

xAI 的 `grok-2-latest` 模型在 2026-05 已下线，但 `lib/ai/provider.ts` 把它写成 `PROVIDERS.xai.model` 硬编码。这种"模型名硬编码"的反模式在 DeepSeek、Kimi、Moonshot 等所有 OpenAI-compatible provider 上都会出现：

- 上游周期性 deprecate / rename / 切默认版本
- 项目代码不动，但接口悄悄失效，复现时已经"为什么？"

#### 防御措施（每次引入新 provider 必做）

1. **接入前先 curl 一遍模型存在性**：
   ```bash
   curl -sS https://<vendor>/v1/models -H "Authorization: Bearer $KEY" | jq '.data[].id'
   ```
2. **在 provider.ts 注释里记录**「当前模型 ID + 实测日期 + GET /v1/models 兜底来源」
3. **定期复测**：DD-106 等长生命周期功能，每月跑一次「provider smoke test」（curl 一遍每个 provider 的实测模型）

### 教训 22-D：客户端持久化 store + 状态机错误 = 脏数据 sink

`hooks/useAiChat.ts` 上下文窗口构造时只过滤 `status !== "error"`，**漏掉了 `status === "pending"`**。`aiChatSessionStore` 又用 localStorage 持久化，导致：

- 任何一次 fetch 失败 / 用户中途刷新页面 → 留下 `status="pending"` + `content=""` 的助手消息
- 下次 send 时该消息被当作 context 上下文发出 → server zod `content.min(1)` 拒 → 400

#### 通用原则：构造 LLM 上下文窗口时，**只发 `status === "ok"` 且 content 非空**的消息

```ts
// ✅ 正确：白名单
.filter(m => m.status === "ok" && m.content.trim().length > 0)

// ❌ 错误：黑名单（漏 pending）
.filter(m => m.status !== "error")
```

**判定标准**：黑名单只能用在状态枚举**已封闭且永远不会扩展**的场景。`status` 是 `"ok" | "pending" | "error"`，**未来一定会加**（streaming / aborted / partial 等），白名单更稳。

### 教训 22-E：env 改动的"重启确实生效了吗" 验证清单

DD-106 排查时一度怀疑「dev server 没重启」/「.env.local 没读到」。下次同类怀疑直接跑这个清单：

```js
// 浏览器 Console 跑：
fetch("/api/ai/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ messages: [{ role: "user", content: "ping" }] }),
})
  .then((r) => r.json())
  .then(console.log);
```

返回 `code`：

- `AI_NOT_CONFIGURED` (503) → env 真没生效，重启 dev server
- `AI_UPSTREAM_ERROR` (400/502) → env OK，上游有问题（看终端日志）
- `AI_BAD_REQUEST` (400) → env OK，客户端 body 不合法
- `{ code: 0, data: { content } }` → 全通

—— 一条命令就能区分「env 没生效」vs「env OK 但上游挂」，比反复改 `.env.local` 高效得多。

### 教训 22-F：worktree 下 `.env.local` 是 symlink，改主仓即可

DD-106 期间用户多次困惑「我已经改了 env 了为什么不生效」。worktree 的 `.env.local` 是 `ln -sf ../../../.env.local` 指向主仓的 symlink。

- ✅ 在主仓 `/Users/hang/work/oddfi-frontend/.env.local` 改 → worktree 立即跟随
- ❌ 在 worktree `.claude/worktrees/<name>/.env.local` 改 → 会破坏 symlink，主仓不变 worktree 跟着不变
- ⚠️ 即使 symlink 对了，**Next.js dev server 启动时只读一次 env**，改完必须 Ctrl+C 重启

详见 `rules/git-workflow.md` Worktree 规范段。

---

## 23. Sprite-Sheet 无缝循环 + 第三方协议反向工程

**来源**：`lessons/post-mortem-codex-pets-sprite-loop-flicker.md`
**影响范围**：任何接入第三方 sprite-sheet / 帧动画协议、CSS `steps()` 调试、外部 API metadata 缺字段时的反向工程

### 教训 23-A：第三方协议 API 缺关键字段时必须反向工程，不能猜测

**事故 case**：DD-112 假设 codex-pets "每行 8 帧"，实际 9 个 state 帧数完全不同（idle=6 / run-right=8 / run-left=8 / waving=4 / jumping=5 / failed=8 / waiting=6 / running=6 / review=6）。把 sprite 跑到 col 6/col 7 时实际是噪点 / 下一 state 边界 → 每秒闪一次。4 个 fix-up commit 才命中根因。

**判断标准**：

- API response 是否包含动画播放需要的所有字段？（codex-pets API 只返回 `statesDetected: 9`，没给 per-state frame count）
- DD §2.1 写"假设每行 N 帧"或"应该是 N"时 → ⚠️ 信号

**SOP**（接入第三方 sprite / sound / 协议时）：

```
Step 1: 读官方文档 → 列出协议中"我们要用"的所有字段
Step 2: 找出 API 不返回的字段 → 标红
Step 3: 对标红字段，去官网开 DevTools 实证：
   - el.style.cssText 看 CSS 变量
   - Array.from(document.styleSheets).flatMap(s => Array.from(s.cssRules)) 看 @keyframes
   - list_network_requests 看是否有 manifest fetch
   - curl + grep minified JS bundle 找字面量配置
Step 4: 至少 2 个 asset 交叉验证（确认是协议级 hardcoded 还是 per-asset 配置）
Step 5: 在 DD §2.1 中标注「来自反向工程，源：xxx」
Step 6: 单元测试覆盖关键字段值
Step 7: 浏览器实测一个完整动画周期（不只 type-check）
```

### 教训 23-B：动画 bug 必须浏览器实测，type-check + vitest 通过不算修复

DD-112 前 2 个 fix-up commit 全是"看代码 / 数学推导 / vitest 29/29 通过 → 自信交付"。**vitest 测的是 keyframes 数据结构，不测视觉播放**。

CLAUDE.md 早就写：

> 动画类改动仍走 `animation.md` 的浏览器验证强约束（onfinish 时序无法靠 type-check 兜底）

但前 2 轮违反了这条。被用户"你自己去验证"踢一脚才用 Chrome DevTools MCP。

**红线**：动画 / sprite-sheet / WAAPI / 自定义 CSS animation 类改动，**第 1 步**永远是浏览器 `evaluate_script` 抓 anim 实际播放采样，看代码次之。

**Chrome DevTools 速查**：

```js
// 1. 抓 element 的 anim 配置
const el = document.querySelector('[role="img"][aria-label="..."]');
const anim = el.getAnimations()[0];
({
  duration: anim.effect.getComputedTiming().duration,
  easing: anim.effect.getComputedTiming().easing,
  iterations: anim.effect.getComputedTiming().iterations,
  keyframes: anim.effect.getKeyframes(),
});

// 2. 时间采样实际渲染值（确认 bgPos / transform 变化序列）
const samples = [];
const start = performance.now();
for (let i = 0; i < 10; i++) {
  while (performance.now() - start < i * 200) await new Promise((r) => setTimeout(r, 5));
  samples.push({ t: i * 200, bg: getComputedStyle(el).backgroundPosition });
}

// 3. 跨域对比：navigate 到官方实现，evaluate_script 抓他们的配置 diff
```

### 教训 23-C：CSS `steps(N)` 实际语义 ≠ 字面理解

容易理解错。**准确语义（CSS Easing Level 2）**：

- `steps(N)` = `steps(N, jump-end)`（默认）
- jump-end "each step is at the end of the interval"：N 个 jumps 发生在 progress = 1/N, 2/N, ..., N/N
- 在 interval `[k/N, (k+1)/N)` 内，output = lerp(from, to, k/N) —— **是 interval 起点的 step value**，hold 到 interval 末尾才 jump 到下一 step
- 第 0 个 step（k=0）显示 [0, 1/N)；第 N-1 个 step（k=N-1）显示 [(N-1)/N, 1)；progress=1 瞬间是 to value 但立即 wrap

**应用到 sprite-sheet 帧动画**（from=0%, to=N×W%，bgSize 800% × 900%）：

- step 0: bgPos 0% (col 0) 显示 [0, 1/N)
- step k: bgPos k/(COLS-1) × 100% (col k) 显示 [k/N, (k+1)/N)
- 共 N 个有效 step，col 0..col (N-1)，col N 仅 progress=1 瞬间出现立即 wrap → 不可见

**要让 anim 跑 N 帧 col 0..col (N-1)**：

```ts
el.animate(
  [
    { backgroundPosition: `0% ${(row / (ROWS - 1)) * 100}%` },
    { backgroundPosition: `${(N / (COLS - 1)) * 100}% ${(row / (ROWS - 1)) * 100}%` }, // ← 分母 COLS-1，不是 COLS
  ],
  {
    duration: Math.max(N * 260, 1400), // codex-pets 默认 frame rate
    easing: `steps(${N})`,
    iterations: Infinity,
  }
);
```

### 教训 23-D：sprite-sheet 动画首选"单 keyframe pair + steps(N)"，不要用多 keyframes 模拟

DD-112 期间换了 3 种 WAAPI keyframe 方案：

| 方案                                                                      | 问题                                                                             |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| ❌ N 个 keyframes 无 offset + `easing: "step-start"`                      | WAAPI 自动按 1/(N-1) 均分，col N-1 落 progress=1 瞬间，闪一下 wrap               |
| ❌ N+1 个 keyframes 显式 `offset: col/N` + sentinel at 1.0                | 数学对，但跑到不存在的 col N 时仍闪（sprite 那里是噪点）                         |
| ✅ 单 keyframe pair `from "0% Y%" → to "endX% Y%"` + `easing: "steps(N)"` | 与 codex-pets 官方完全等价，与 CSS `@keyframes from-to + steps(N) infinite` 等价 |

**红线**：sprite-sheet / 逐帧跳变动画**首选**单 keyframe pair + `easing: steps(N)`。不要用多 keyframes + `step-start/step-end` 模拟。

### 教训 23-E：DD review 阶段必须实证"来自外部 API/协议"的字段

DD-112 v1 双 sonnet reviewer 都没怀疑"DD §2.1 的每行 8 帧"，把 reviewer prompt 中的"verify"理解为"check internal consistency"而非"check external truth"。

**修订建议**（review prompt 加一行）：

> DD / 实现中所有来自外部 API、第三方协议、SDK 文档的字段值，必须给出至少 1 个实证来源（抓包 URL / 官网 DevTools 截图 / SDK 源码行号引用）。没有实证的"应该是 X" → Critical。

### 教训 23-F：找到一个 bug ≠ 找到根因

DD-112 第 2 轮修复 keyframe offset 是**合理的**（1/(N-1) 均分确实是 bug），但**它不是闪烁的真实根因**（真根因是 idle row 0 col 6/7 是噪点）。AI 把"找到 a bug"等同于"找到 the bug"，自信交付。

**判断标准**：

- 修一个 bug 后，**必须**复现用户原报告路径，确认现象消失，不能只跑单测
- 用户复述"还是不行"时，**默认假设之前的修复未触及根因**，重新收集证据
- 同一 bug 报告 ≥ 2 次"还是不行" → 直接进 Chrome DevTools MCP 实测，停止脑补

| 版本 | 日期       | 变更说明                                                                                                                                                                                                                                                                                          |
| ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1   | 2026-03-03 | 初始版本，汇总来自 8 份 Review 报告和 1 份复盘文档的经验                                                                                                                                                                                                                                          |
| v2   | 2026-03-10 | 新增 §11 Git 提交安全；修复 common-rules.md 中允许提交 `.progress/` 的错误规则                                                                                                                                                                                                                    |
| v3   | 2026-03-12 | 新增 §12 第三方 API 接入规范；来源：SportMonks v3 集成 4 轮失败复盘                                                                                                                                                                                                                               |
| v4   | 2026-03-13 | 新增 §13 Web3 链上交互规范；来源：PancakeSwap V2 Swap 流程 3 轮调试复盘                                                                                                                                                                                                                           |
| v5   | 2026-03-16 | 新增 §14 MCP Figma 设计还原规范；来源：UserAvatarDropdown 毛玻璃效果 3 轮才成功                                                                                                                                                                                                                   |
| v6   | 2026-03-16 | 扩展 §14 新增 14-0 标准 SOP；来源：WalletConnectModal 像素级还原 3 轮失败复盘（节点粒度、forceCode、图片下载、精确值转录、截图验证）                                                                                                                                                              |
| v7   | 2026-03-17 | 新增 §15 API 数据规范化层设计；来源：sportmonks-normalize.ts 对非数值 handicap 误报 Invalid 并丢弃                                                                                                                                                                                                |
| v8   | 2026-03-19 | 扩展 §12 新增 12-G Edge Runtime IP 来源陷阱；来源：DD-029 代理路由部署后 403                                                                                                                                                                                                                      |
| v9   | 2026-03-20 | 扩展 §12 新增 12-H API 参数变更必须追踪消费链（**生产事故**）；来源：DD-031 Phase 0 赔率 filter 导致线上赔率全部丢失                                                                                                                                                                              |
| v10  | 2026-03-24 | 新增 §16 后台进程管理；来源：Insights 分析，SSR/H5 开发中 15 次 OOM 失败                                                                                                                                                                                                                          |
| v11  | 2026-03-24 | 新增 §17 CSS Grid 布局溢出与诊断方法；来源：三列布局 4 轮失败复盘（`1fr` 隐含最小宽度、DOM 级诊断、overflow-hidden）                                                                                                                                                                              |
| v12  | 2026-03-24 | 扩展 §14 新增 14-F 图标资源分类规则；来源：MatchDetailPanel 统计图标被擅自用 Phosphor + 手写 div 替代                                                                                                                                                                                             |
| v13  | 2026-03-24 | 新增 §18 Hover 下拉菜单关闭动画闪烁；来源：UserAvatarDropdown/MenuButton 鼠标移出闪烁 3 轮修复                                                                                                                                                                                                    |
| v14  | 2026-03-26 | 扩展 §12 新增 12-I Edge Runtime 禁止 fetch 直连 IP 地址（**P0 生产事故**）；来源：线上全部 sportmonks 接口 403，Vercel outbound proxy 拦截裸 IP fetch                                                                                                                                             |
| v15  | 2026-04-03 | 新增 §20 EIP-55 Checksum 与 Multicall 连坐；来源：DSU 地址 checksum 错误导致 Deposit 全量 ERC-20 余额为 0（一个地址错 → 8 个代币全挂）                                                                                                                                                            |
| v16  | 2026-04-24 | 新增复盘 `post-mortem-wallet-disconnect-flash.md`；来源：MetaMask 断连后再连接只闪一下，3 轮补丁才触及根因（wagmi `disconnect` 不撤 EIP-2255 授权，必须 `wallet_revokePermissions`）                                                                                                              |
| v17  | 2026-05-06 | 新增 §21 CSS 渐变描边 + Figma CSS export 陷阱；来源：Roadmap popover hover 卡片边框 3 轮迭代复盘（Figma export 漏 Effects、Chrome 把 0.5px 取整为 1px、edge linear-gradient 在 rounded corner 弧线段缺一块）                                                                                      |
| v18  | 2026-05-19 | 新增 §22 AI Provider / LLM 上游调试；来源：DD-106 xAI 集成「改了几次都不行」3 轮假设全错复盘（xAI 已下线 `grok-2-latest` 返 400 透传，绕了 env / localStorage / 凭代码推断 3 个错误假设。教训：server-side 错误第一步看 dev server 终端日志）                                                     |
| v19  | 2026-05-20 | 新增 §23 Sprite-Sheet 无缝循环 + 第三方协议反向工程；来源：DD-112 codex-pets 头像接入 4 轮 fix-up 复盘（DD §2.1 假设"每行 8 帧"是猜测，实际 codex-pets 9 个 state 帧数不同 idle=6/run=8/wave=4/jump=5；前 3 轮全靠脑补 + 数学推导，第 4 轮才开 Chrome DevTools + 反向工程官方 bundle 才命中根因） |
