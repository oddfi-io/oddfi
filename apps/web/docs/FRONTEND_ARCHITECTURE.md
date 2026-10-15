# Oddfi Frontend Architecture Document

> **Version:** 1.0.0 | **Last Updated:** 2026-03-31 | **Owner:** Frontend Team
> **Status:** Living Document — 随代码演进持续更新

---

## Table of Contents

1. [项目概览](#1-项目概览)
2. [技术栈全景](#2-技术栈全景)
3. [目录结构](#3-目录结构)
4. [路由与页面架构](#4-路由与页面架构)
5. [组件分层体系](#5-组件分层体系)
6. [状态管理架构](#6-状态管理架构)
7. [数据流与请求层](#7-数据流与请求层)
8. [Web3 集成架构](#8-web3-集成架构)
9. [国际化方案](#9-国际化方案)
10. [Design Token 体系](#10-design-token-体系)
11. [Mock 与测试架构](#11-mock-与测试架构)
12. [性能优化策略](#12-性能优化策略)
13. [工程化配置](#13-工程化配置)
14. [部署与监控](#14-部署与监控)
15. [架构决策记录](#15-架构决策记录)

---

## 1. 项目概览

### 1.1 产品定位

链上体育博彩平台（2026 世界杯投注），目标 **2026-06-11** 上线。

### 1.2 核心业务模块

| 模块          | 路由                           | 状态       | 说明                           |
| ------------- | ------------------------------ | ---------- | ------------------------------ |
| 市场大厅      | `/markets`                     | Production | 赛事列表 + 赔率展示 + 投注面板 |
| 比赛详情      | `/markets/fixture/[fixtureId]` | Production | 单场赛事全部盘口               |
| 做市 (Trade)  | `/trade`                       | Mock       | 流动性做市                     |
| 质押 (Stake)  | `/stake`                       | Mock       | OFI Token 质押                 |
| 兑换 (Swap)   | `/swap`                        | Mock       | Token 兑换                     |
| 邀请 (Invite) | `/invite`                      | Mock       | 邀请奖励                       |

### 1.3 团队协作

```
Frontend ←→ Go Backend ←→ Smart Contracts
    ↑             ↑
    PM          UI Design
```

- **前后端通信**：REST API（V1），合约直调（V2 / 4 月底）
- **数据源**：SportMonks API（赛事 + 赔率，后端代理 `data.oddfi.io`）
- **链**：BSC（BNB Smart Chain），Mainnet chainId=56

---

## 2. 技术栈全景

### 2.1 核心框架

| 层级      | 技术                 | 版本   | 职责                        |
| --------- | -------------------- | ------ | --------------------------- |
| Framework | Next.js (App Router) | 15.3.x | SSR/SSG + 路由 + API Routes |
| Runtime   | React                | 19.x   | UI 渲染                     |
| Language  | TypeScript           | 5.x    | 类型安全，strict mode       |
| Styling   | Tailwind CSS         | 3.4.x  | 原子化 CSS + Design Token   |

### 2.2 状态与数据

| 技术           | 版本   | 职责                                   |
| -------------- | ------ | -------------------------------------- |
| Zustand        | 4.5.x  | 客户端全局状态（投注单、Auth、UI）     |
| TanStack Query | 5.x    | 服务端状态缓存、轮询、SSR 脱水         |
| ky             | 1.14.x | HTTP Client（3.3KB，零依赖）           |
| MSW            | 2.12.x | Mock Service Worker（开发期 API 模拟） |

### 2.3 Web3

| 技术       | 版本   | 职责                       |
| ---------- | ------ | -------------------------- |
| wagmi      | 2.19.x | React Hooks for Ethereum   |
| viem       | 2.46.x | TypeScript Ethereum 底层库 |
| RainbowKit | 2.2.x  | 钱包连接 UI                |

### 2.4 辅助

| 技术               | 版本   | 职责             |
| ------------------ | ------ | ---------------- |
| next-intl          | 4.8.x  | i18n（9 种语言） |
| decimal.js         | 10.6.x | 金融精度计算     |
| framer-motion      | 12.x   | 动画             |
| Sentry             | 10.x   | 错误监控         |
| sonner             | 2.0.x  | Toast 通知       |
| lightweight-charts | 5.1.x  | K 线图           |
| Phosphor Icons     | 2.1.x  | UI 图标库        |

### 2.5 开发工具链

| 工具                     | 用途              |
| ------------------------ | ----------------- |
| Vitest + Testing Library | 单元/组件测试     |
| Playwright               | E2E 测试          |
| ESLint + Prettier        | 代码质量          |
| Husky + lint-staged      | Pre-commit 自动化 |
| Vercel                   | 部署平台          |

---

## 3. 目录结构

```
oddfi-frontend/
├── app/                          # Next.js App Router
│   ├── [locale]/                 # i18n 动态路由段
│   │   ├── layout.tsx            # 全局导航 + Providers
│   │   ├── page.tsx              # 首页
│   │   ├── markets/              # 市场大厅（核心页面）
│   │   │   ├── page.tsx          # Server Component: SSR 数据预取
│   │   │   ├── layout.tsx        # Markets 布局
│   │   │   ├── MarketsPageClient.tsx  # Client: 交互逻辑
│   │   │   └── fixture/[fixtureId]/   # 比赛详情
│   │   ├── trade/                # 做市页
│   │   ├── stake/                # 质押页
│   │   ├── swap/                 # 兑换页
│   │   └── invite/               # 邀请页
│   ├── api/                      # API Route Handlers
│   │   ├── auth/verify/          # 邀请码校验
│   │   ├── backend/[...path]/    # 后端代理（CORS + 密钥屏蔽）
│   │   └── sportmonks/[...path]/ # SportMonks 数据代理
│   ├── providers.tsx             # Context Providers 注册
│   ├── layout.tsx                # Root Layout
│   ├── globals.css               # 全局样式 + @font-face
│   └── design-tokens.css         # Figma 同步的 CSS 变量（自动生成）
│
├── components/                   # React 组件
│   ├── ui/                       # 通用 UI 原语（Button, Modal, Skeleton...）
│   ├── layout/                   # 布局组件（TopNav, SideNav, MobileTabBar）
│   ├── game-markets/             # 赛事市场核心组件 (22 files)
│   ├── bet-slip/                 # 投注单组件 (11 files)
│   ├── match-detail/             # 比赛详情组件
│   ├── market/                   # 市场卡片与赔率组件
│   ├── wallet/                   # 钱包连接与余额 (18 files)
│   ├── deposit/                  # 充值流程 (14 files)
│   ├── pools/                    # 流动性池 (15 files)
│   ├── staking/                  # 质押界面 (17 files)
│   ├── swap/                     # Token 兑换
│   ├── trade/                    # 做市交易
│   ├── home/                     # 首页组件
│   ├── icons/                    # 自定义 SVG 图标组件
│   ├── transaction/              # 交易确认组件
│   └── dev/                      # 开发工具（DevTools, MockIndicator）
│
├── hooks/                        # 自定义 React Hooks (29 files)
├── stores/                       # Zustand 状态管理 (10 stores)
├── lib/                          # 工具库与核心逻辑 (44 files)
│   ├── api.ts                    # HTTP Client（apiClient + authClient）
│   ├── api-server.ts             # Server-side API 调用
│   ├── decimal.ts                # 金融精度工具
│   ├── fixture-state.ts          # 赛事状态分类
│   ├── token-registry.ts         # Token 元数据注册表
│   ├── platform-token.ts         # 平台币配置
│   ├── wagmi.config.ts           # wagmi 链配置
│   └── proxy-wallet/             # 代理钱包模块
│
├── mocks/                        # MSW Mock 数据
│   ├── browser.ts                # Service Worker 入口
│   ├── data/                     # 静态 Mock 数据集
│   └── handlers/                 # 按域分组的 Handler (7 modules)
│
├── types/                        # TypeScript 类型定义
├── config/                       # 业务配置（精选联赛、队伍）
├── i18n/                         # next-intl 配置
├── messages/                     # 翻译文件 (9 languages)
├── tokens/figma/                 # Figma Design Token 源文件
├── scripts/                      # 构建脚本（sync-tokens）
├── tests/                        # 测试工具
├── __tests__/                    # 集成测试
└── public/                       # 静态资源
    ├── images/                   # Logo、Banner、钱包图标
    ├── icons/                    # 自定义 SVG 图标
    └── fonts/                    # Pilat Extended 字体族
```

### 3.1 文件组织原则

| 原则               | 说明                                                               |
| ------------------ | ------------------------------------------------------------------ |
| **Co-location**    | 组件测试文件放在源文件旁（`Component.tsx` + `Component.test.tsx`） |
| **Feature-first**  | 按业务功能分目录（`game-markets/`, `bet-slip/`），非按技术类型     |
| **Barrel Exports** | 仅 `layout/` 等少量目录使用 `index.ts`，避免循环依赖               |
| **单一职责**       | 每个文件 ≤ 300 行，超出即拆分                                      |

---

## 4. 路由与页面架构

### 4.1 路由表

```
/                          → 重定向到 /markets
/[locale]/markets           → 市场大厅（核心）
/[locale]/markets/[id]      → 旧版市场详情
/[locale]/markets/fixture/[fixtureId] → 比赛详情（移动端全屏）
/[locale]/trade             → 做市
/[locale]/stake             → 质押
/[locale]/swap              → 兑换
/[locale]/invite            → 邀请
/[locale]/leaderboard       → 排行榜
/[locale]/stats             → 统计
/[locale]/liquidity         → 流动性
/access                     → 邀请码验证（无 locale 前缀）
```

### 4.2 Server / Client 分界

```
Server Component (page.tsx)          Client Component (PageClient.tsx)
┌──────────────────────────┐         ┌──────────────────────────┐
│ 1. getQueryClient()      │         │ 1. HydrationBoundary     │
│ 2. prefetchQuery(...)    │  ──→    │ 2. useQuery() 复用缓存    │
│ 3. dehydrate(client)     │         │ 3. useState / useEffect  │
│ 4. <Client state={...}/> │         │ 4. 交互事件处理           │
└──────────────────────────┘         └──────────────────────────┘
```

**原则**：

- **Page** = Server Component，负责数据预取
- **PageClient** = Client Component（`"use client"`），负责交互
- 通过 React Query `dehydrate/HydrationBoundary` 桥接

### 4.3 Layout 层级

```
RootLayout (app/layout.tsx)
  └── LocaleLayout (app/[locale]/layout.tsx)
        ├── NextIntlClientProvider
        ├── Providers (Wagmi → QueryClient → RainbowKit → AuthGate)
        ├── TopNav (sticky)
        ├── WrongNetworkBanner
        ├── {children}  ← 页面内容
        ├── Toaster (Sonner)
        └── Analytics (Vercel)
```

### 4.4 Middleware

```typescript
// middleware.ts
export default function middleware(request) {
  // 1. next-intl 路由（locale 前缀处理）
  // 2. 邀请码校验（access-token cookie）
  // 3. 未授权重定向 → /access
}
```

---

## 5. 组件分层体系

### 5.1 四层组件模型

```
┌─────────────────────────────────────────────┐
│  Page Layer         app/[locale]/*/page.tsx  │  SSR 入口，数据预取
├─────────────────────────────────────────────┤
│  Feature Layer      components/game-markets/ │  业务组件，含状态订阅
│                     components/bet-slip/     │
│                     components/wallet/       │
├─────────────────────────────────────────────┤
│  Shared Layer       components/ui/           │  无状态 UI 原语
│                     components/layout/       │
│                     components/icons/        │
├─────────────────────────────────────────────┤
│  Foundation Layer   lib/ + hooks/ + stores/  │  纯逻辑，无 UI
└─────────────────────────────────────────────┘
```

### 5.2 核心 Feature 组件关系

#### Markets 页面组件树

```
MarketsPageClient
├── MarketsToolbar
│   ├── ContentTypeTabs (Matches / News)
│   ├── LeagueChips (横向联赛过滤)
│   └── SearchBar
├── LeagueSidebar (桌面端侧边栏)
├── TimelineMatchList ← 核心列表组件
│   ├── DateSectionHeader ("LIVE" / "Today" / "Tomorrow" / ...)
│   └── LeagueGroupSection (按联赛分组)
│       ├── LeagueGroupHeader (联赛名 + 折叠)
│       └── MatchCard × N (赛事卡片 + 赔率按钮)
├── MatchDetailPanel (桌面端右侧详情面板)
│   ├── MatchBanner (球队 + 比分)
│   └── MarketSection × N (盘口组)
│       └── OddsButton × N
└── BetSlipPanel (投注单面板)
    └── BetSlip
        ├── BetCard × N
        ├── QuickAmountBar
        └── BetSummary
```

#### 桌面端 Grid 布局状态

```
State A: "default"          无面板
┌────────────────────────────────────┐
│              MatchList              │
└────────────────────────────────────┘

State B: "detail"           右侧详情
┌──────────────────┬─────────────────┐
│    MatchList     │  DetailPanel    │
└──────────────────┴─────────────────┘

State C: "betslip-only"    右侧投注单
┌──────────────────┬─────────────────┐
│    MatchList     │   BetSlip       │
└──────────────────┴─────────────────┘

State D: "betslip"          详情 + 投注单
┌───────┬──────────┬─────────────────┐
│Sidebar│ MatchList│Detail + BetSlip │
└───────┴──────────┴─────────────────┘
```

### 5.3 移动端 / 桌面端差异

| 场景     | 桌面端 (≥ 1024px)       | 移动端 (< 1024px)      |
| -------- | ----------------------- | ---------------------- |
| 赛事详情 | 右侧 inline 面板        | 路由跳转全屏页         |
| 投注单   | 右侧 sticky 面板        | Bottom Sheet           |
| 导航菜单 | 顶部 Nav + 左侧 Sidebar | 底部 TabBar + 汉堡菜单 |
| 钱包连接 | Modal 弹窗              | 全屏 Bottom Sheet      |

**实现方式**：

```typescript
// 运行时判断视口，非渲染时
if (window.innerWidth >= 1024) {
  selectFixture(id); // 桌面：打开 inline 面板
} else {
  router.push(`/fixture/${id}`); // 移动：路由跳转
}
```

---

## 6. 状态管理架构

### 6.1 状态分类策略

```
┌──────────────────────────────────────────────────────┐
│                     数据来源                          │
├──────────────────┬──────────────────┬────────────────┤
│   服务端状态      │   客户端状态      │   链上状态      │
│  TanStack Query  │    Zustand       │   wagmi hooks  │
├──────────────────┼──────────────────┼────────────────┤
│ 赛事/赔率/市场    │ 投注单           │ Token 余额     │
│ 联赛列表         │ Auth Token       │ 链上价格       │
│ 账户余额         │ UI 面板状态       │ 合约读取       │
│ 充值地址         │ 移动端菜单       │ 交易签名       │
└──────────────────┴──────────────────┴────────────────┘
```

### 6.2 Zustand Store 一览

| Store                  | 文件                           | 持久化       | 核心状态                                              |
| ---------------------- | ------------------------------ | ------------ | ----------------------------------------------------- |
| **authStore**          | `stores/authStore.ts`          | localStorage | accessToken, refreshToken, isAuthenticated            |
| **betSlipStore**       | `stores/betSlipStore.ts`       | —            | selections[], mode, amounts, settings                 |
| **marketsLayoutStore** | `stores/marketsLayoutStore.ts` | —            | selectedFixtureId, sidebarCollapsed, selectedCategory |
| **tradeStore**         | `stores/tradeStore.ts`         | —            | marketId, selectedOutcome, activeTab, amount          |
| **mockBalanceStore**   | `stores/mockBalanceStore.ts`   | localStorage | balance, orders[], displayMode                        |
| **depositSheetStore**  | `stores/depositSheetStore.ts`  | —            | isOpen, step, selectedAsset                           |
| **walletSheetStore**   | `stores/walletSheetStore.ts`   | —            | open, connectTrigger                                  |
| **walletDisplayStore** | `stores/walletDisplayStore.ts` | —            | activeSymbol, balanceVersion                          |
| **proxyWalletStore**   | `stores/proxyWalletStore.ts`   | —            | proxyWallet, isAssigning                              |
| **mobileMenuStore**    | `stores/mobileMenuStore.ts`    | —            | open                                                  |
| **devToolsStore**      | `stores/devToolsStore.ts`      | localStorage | overrideProxyAddress                                  |

### 6.3 Zustand 最佳实践

```typescript
// 1. 细粒度选择器 — 避免不必要的重渲染
const isSelected = useBetSlipStore(selectIsSelected(selectionId));

// 2. 计算属性导出为独立 selector
export const selectTotalOdds = (s: BetSlipStore) => s.totalOdds();
export const selectPotentialWin = (s: BetSlipStore) => s.potentialWin();

// 3. 多字段订阅用 useShallow
const { selections, mode } = useBetSlipStore(
  useShallow((s) => ({ selections: s.selections, mode: s.mode }))
);

// 4. SSR 安全的持久化水合
useEffect(() => {
  hydrateAuthStore();
}, []); // 仅客户端执行
```

### 6.4 React Query 缓存策略

| 数据     | staleTime           | refetchInterval | 说明             |
| -------- | ------------------- | --------------- | ---------------- |
| 今日赛事 | 5s (有直播时) / 60s | 同左            | 直播赛事高频刷新 |
| 明日赛事 | 60s                 | 60s             | 次日赛事低频刷新 |
| 未来赛事 | 15min               | —               | 按需加载，懒刷新 |
| 联赛列表 | 30min               | —               | 变动极少         |
| 赛事详情 | 15s                 | 15s             | 盘口实时更新     |
| 账户余额 | 30s                 | 60s             | 余额适度刷新     |

---

## 7. 数据流与请求层

### 7.1 双层 API Client

```
┌─────────────────────────────────────────────────────┐
│                    前端应用层                         │
│                                                     │
│   apiClient (ky)              authClient (ky)       │
│   ├── /api/markets/*          ├── /api/backend/*    │
│   ├── /api/bets/*             │   (自动注入 Bearer)  │
│   └── /api/trade/*            │                     │
│       ↓ MSW 拦截               ↓ 直连后端            │
├─────────────────────────────────────────────────────┤
│                Next.js API Routes                    │
│                                                     │
│   /api/backend/[...path]  → 代理至 BACKEND_URL      │
│   /api/sportmonks/[...path] → 代理至 data.oddfi.io  │
│   /api/auth/verify        → 邀请码校验               │
└─────────────────────────────────────────────────────┘
```

### 7.2 Mock / 真实模块边界

| 模块                   | 状态     | Client          | 说明         |
| ---------------------- | -------- | --------------- | ------------ |
| 钱包登录 / Token 刷新  | **真实** | authClient      | JWT 签名登录 |
| 账户余额 / 充值地址    | **真实** | authClient      | —            |
| SportMonks 赛事 + 赔率 | **真实** | API Route 代理  | 服务端直连   |
| 链上交互               | **真实** | wagmi hooks     | 不走 HTTP    |
| markets / orders       | Mock     | apiClient + MSW | 等后端       |
| betting / trade / swap | Mock     | apiClient + MSW | 等后端       |
| invite / token prices  | Mock     | apiClient + MSW | 等后端       |

### 7.3 数据加载模式

#### SSR 预取 + 客户端水合

```typescript
// Server Component (page.tsx)
async function MarketsPage() {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(["sm-leagues", locale]),
    queryClient.prefetchQuery(["sm-fixtures-date", today, locale]),
    queryClient.prefetchQuery(["sm-fixtures-date", tomorrow, locale]),
  ]);
  return <MarketsPageClient dehydratedState={dehydrate(queryClient)} />;
}

// Client Component
function MarketsPageClient({ dehydratedState }) {
  return (
    <HydrationBoundary state={dehydratedState}>
      {/* useQuery 自动复用 SSR 缓存 */}
    </HydrationBoundary>
  );
}
```

#### 三轨赛事加载（useTimelineFixtures）

```
Track 1: Eager (今天+明天)          ← useQueries, SSR 水合
  └── 今天: 5-10s 自动刷新（如有直播）
  └── 明天: 60s 自动刷新

Track 2: Future (后天起)            ← useInfiniteQuery, 滚动触发
  └── 7 天为一页
  └── IntersectionObserver 200px 预触发
  └── 连续 3 页空数据自动停止（非赛季保护）
  └── 硬截止: 2026-07-15

Track 3: Leagues                   ← useQuery, 30min stale
  └── 联赛元数据（名称、国家、图标）
```

---

## 8. Web3 集成架构

### 8.1 认证流程

```
用户点击 Connect
    │
    ▼
wagmi 连接钱包 (MetaMask / OKX / WalletConnect / Coinbase / Binance)
    │
    ▼
useAuth Effect 检测 explicit connect flag (sessionStorage)
    │
    ▼
Step 1: loginByWalletStep1() → 获取 nonce
    │
    ▼
Sign Message (30s 超时保护)
    │
    ▼
Step 2: loginByWalletStep2(signature) → 获取 JWT (access + refresh)
    │
    ▼
authStore 持久化 → authClient 自动注入 Bearer
    │
    ▼
getDepositAddress() → proxyWalletStore
```

### 8.2 Token 注册表

```typescript
// lib/token-registry.ts — 单一数据源
BSC_TOKENS = [
  { symbol: "BNB", decimals: 18, tier: 1, isNative: true },
  { symbol: "USDT", decimals: 18, tier: 1 },
  { symbol: "USDC", decimals: 18, tier: 1 },
  { symbol: "MDAO", decimals: 18, tier: 2 },
  // ...共 9 个
];

// lib/platform-token.ts — 平台币配置（一行切换）
PLATFORM_TOKEN_SYMBOL = "USDT"; // 改这一行即可切换到 OFI
```

### 8.3 链上数据读取

| 数据       | 方式                                    | Hook              |
| ---------- | --------------------------------------- | ----------------- |
| Token 余额 | wagmi `useBalance`                      | `useTokenBalance` |
| Token 价格 | Chainlink 预言机 `useReadContracts`     | `useTokenPrices`  |
| Swap 报价  | PancakeSwap V2 Router `useReadContract` | `useSwapQuote`    |

---

## 9. 国际化方案

### 9.1 支持语言

| Code | 语言           | 文件               |
| ---- | -------------- | ------------------ |
| en   | English (默认) | `messages/en.json` |
| zh   | 简体中文       | `messages/zh.json` |
| es   | Español        | `messages/es.json` |
| fr   | Français       | `messages/fr.json` |
| de   | Deutsch        | `messages/de.json` |
| ja   | 日本語         | `messages/ja.json` |
| pt   | Português      | `messages/pt.json` |
| hi   | हिन्दी         | `messages/hi.json` |
| tr   | Türkçe         | `messages/tr.json` |

### 9.2 架构

```
next-intl (Server-side message loading)
    │
    ├── middleware.ts → locale 路由前缀
    ├── i18n/routing.ts → 支持的 locale 列表
    ├── i18n/request.ts → 按请求加载消息
    └── i18n/navigation.ts → Link / useRouter / redirect
```

### 9.3 使用约定

```typescript
// 组件中
const t = useTranslations("betSlip");
return <h2>{t("title")}</h2>;

// 复数形式
t("matchCount", { count: 3 });
// en: "{count, plural, one {# match} other {# matches}}"

// 运行时输出必须用英语（不走 i18n）
console.error("[BetSlip] Failed to place bet — insufficient balance");
toast.error("Network error, please try again");
```

---

## 10. Design Token 体系

### 10.1 流程

```
Figma Design Tokens
    │
    ▼ pnpm sync-tokens
tokens/figma/Dark.tokens.json
tokens/figma/Light.tokens.json
    │
    ▼ scripts/sync-tokens.ts
app/design-tokens.css (CSS Variables)
    │
    ▼ tailwind.config.ts 引用
Tailwind Design Token Classes
```

### 10.2 核心 Token

| 类别     | 示例                                                     | 用途           |
| -------- | -------------------------------------------------------- | -------------- |
| 文字色   | `text-primary` / `text-secondary` / `text-tertiary`      | 主/次/弱化文字 |
| 背景色   | `bg-primary` / `bg-secondary` / `bg-tertiary`            | 页面/卡片/嵌套 |
| 按钮背景 | `bg-btn-primary` / `bg-btn-primary-hover`                | 按钮状态变体   |
| 语义色   | `text-fn-green` / `text-fn-red` / `text-fn-brand`        | 涨跌/品牌      |
| 边框     | `border-divider` / `border-dt-hover` / `border-dt-error` | 分割线/状态    |
| 填充     | `bg-fill-input` / `bg-fill-modal` / `bg-fill-dropdown`   | 表单/弹窗      |
| 渐变     | `bg-brand-gradient`                                      | 品牌渐变背景   |
| 圆角     | `rounded-card` (16px) / `rounded-shell` (22px)           | 卡片/Shell     |
| 阴影     | `shadow-card` / `shadow-modal` / `shadow-glow`           | 层级阴影       |

### 10.3 强制规则

```typescript
// ❌ 禁止 inline hex
<p style={{ color: '#5972FE' }}>文字</p>
<div className="text-[#2DB270]">涨</div>

// ✅ 必须 Design Token
<p className="text-brand-default">文字</p>
<div className="text-fn-green">涨</div>
```

---

## 11. Mock 与测试架构

### 11.1 Mock 架构 (MSW v2)

```
mocks/
├── browser.ts              # setupWorker() 入口
├── data/markets.ts         # 静态 Mock 数据集
└── handlers/
    ├── markets.ts          # /api/markets/*
    ├── betting.ts          # /api/bets/*
    ├── trade.ts            # /api/trade/*
    ├── swap.ts             # /api/swap/*
    ├── invite.ts           # /api/invite/*
    ├── token-prices.ts     # /api/prices
    └── proxy-wallet.ts     # /api/proxy-wallet/*
```

**启用条件**：`NEXT_PUBLIC_ENABLE_MSW=true`

**统一返回格式**：

```typescript
{ code: 0, message: "ok", data: T }       // 成功
{ code: "ERR_CODE", message: "说明", data: null }  // 失败
```

### 11.2 测试分层

| 类型       | 位置                             | 框架                     | 优先级 |
| ---------- | -------------------------------- | ------------------------ | ------ |
| 单元测试   | co-location (`lib/*.test.ts`)    | Vitest                   | P0     |
| Store 测试 | co-location (`stores/*.test.ts`) | Vitest                   | P0     |
| 组件测试   | co-location (`*.test.tsx`)       | Vitest + Testing Library | P1     |
| 集成测试   | `__tests__/integration/`         | Vitest + MSW             | P0     |
| E2E 测试   | `e2e/`                           | Playwright               | P2     |

### 11.3 P0 必测清单

- `lib/decimal.ts` — 所有金融计算函数
- `stores/*.ts` — 核心 action（betSlip, auth, mockBalance）
- MSW Handler — API 契约（请求/响应格式）

---

## 12. 性能优化策略

### 12.1 渲染优化

| 策略                  | 实现                            | 位置                                    |
| --------------------- | ------------------------------- | --------------------------------------- |
| **SSR 数据预取**      | React Query dehydrate           | `markets/page.tsx`                      |
| **细粒度 Store 订阅** | Zustand selector + `useShallow` | `BetCard`, `OddsButton`                 |
| **组件 memo**         | `React.memo()` 包裹重渲染热点   | `LeagueGroupSection`, `MatchCard`       |
| **useMemo 计算缓存**  | 赛事分组、分类索引              | `useTimelineFixtures`, `useCategoryMap` |
| **Skeleton 骨架屏**   | 数据加载时展示骨架              | 全部数据区域                            |
| **keepPreviousData**  | 切换时保留旧数据                | React Query 选项                        |

### 12.2 加载优化

| 策略           | 实现                                                           |
| -------------- | -------------------------------------------------------------- |
| **懒加载赛事** | IntersectionObserver 双触发（200px 预启用 + 600px 预取）       |
| **图片懒加载** | `loading="lazy" decoding="async"`                              |
| **包体积优化** | `optimizePackageImports` (Phosphor, RainbowKit, framer-motion) |
| **非赛季断路** | 连续 3 页空数据自动停止无限滚动                                |

### 12.3 网络优化

| 策略             | 实现                                                |
| ---------------- | --------------------------------------------------- |
| **服务端代理**   | SportMonks / 后端 API 经 Next.js Route Handler 代理 |
| **智能轮询**     | 直播赛事 5s，非直播 60s，未来 15min                 |
| **SSR 水合**     | 首屏 0 请求（数据已在 HTML）                        |
| **API 响应缓存** | SportMonks 服务端缓存层 (`lib/sportmonks-cache.ts`) |

---

## 13. 工程化配置

### 13.1 TypeScript

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "strict": true,
    "paths": { "@/*": ["./*"] }
  }
}
```

### 13.2 ESLint 自定义规则

| 规则              | 说明                                |
| ----------------- | ----------------------------------- |
| 禁止 `.toFixed()` | 必须用 `formatAmount()`（金融精度） |
| 例外白名单        | `lib/decimal.ts`, `mocks/**`        |

### 13.3 Git Hooks

```
Pre-commit (Husky + lint-staged):
  *.{ts,tsx,js,jsx}  → eslint --fix → prettier --write
  *.{json,md,css}    → prettier --write
```

### 13.4 Scripts

| 命令               | 用途                    |
| ------------------ | ----------------------- |
| `pnpm dev`         | 启动开发服务器          |
| `pnpm build`       | 生产构建                |
| `pnpm test`        | Vitest 单元测试         |
| `pnpm type-check`  | TypeScript 类型检查     |
| `pnpm lint`        | ESLint 检查             |
| `pnpm format`      | Prettier 格式化         |
| `pnpm sync-tokens` | 同步 Figma Design Token |

---

## 14. 部署与监控

### 14.1 部署

| 项       | 配置                  |
| -------- | --------------------- |
| 平台     | Vercel                |
| 运行时   | Node.js (API Routes)  |
| 域名     | 待配置                |
| 环境变量 | Vercel Dashboard 管理 |
| 构建触发 | git push 自动触发     |

### 14.2 监控

| 工具                      | 用途                       |
| ------------------------- | -------------------------- |
| Sentry (`@sentry/nextjs`) | 错误追踪 + Source Map 上传 |
| Vercel Analytics          | Web 性能分析               |
| Vercel Speed Insights     | Core Web Vitals 监控       |

### 14.3 后端服务

| 服务             | 地址                                     | 说明         |
| ---------------- | ---------------------------------------- | ------------ |
| Go Backend       | `api.oddfi.io` (AWS EC2, ap-southeast-1) | 业务 API     |
| SportMonks Proxy | `data.oddfi.io`                          | 赛事数据代理 |

---

## 15. 架构决策记录

### ADR-001: HTTP Client 选型 — ky over axios

**决策**：采用 ky 作为 HTTP Client
**原因**：3.3KB vs 11.7KB（axios），零依赖，内置 retry/timeout/hooks，原生 fetch 封装
**时间**：2026-03

### ADR-002: 状态管理 — Zustand + React Query 双轨

**决策**：Zustand 管客户端状态，React Query 管服务端状态
**原因**：Zustand 无 Provider 开销、细粒度订阅；React Query SSR 脱水 + 自动缓存
**时间**：2026-03

### ADR-003: API Route Runtime — Node.js over Edge

**决策**：所有 API Route Handler 使用 Node.js Runtime
**原因**：Edge Runtime 在 Vercel 部署时出现 IP 限制问题（SportMonks API），Node.js Runtime 更稳定
**时间**：2026-03（DD-042）

### ADR-004: 金融计算 — decimal.js

**决策**：所有金额计算禁止 JS 原生浮点数，统一使用 decimal.js
**原因**：`0.1 + 0.2 = 0.30000000000000004`，博彩场景精度错误不可接受
**时间**：2026-03

### ADR-005: 赛事数据加载 — 三轨模型

**决策**：Eager (今明两天) + Future (无限滚动) + Leagues (低频)
**原因**：平衡首屏速度与数据完整性，SSR 水合今日数据，滚动触发未来数据
**时间**：2026-03

### ADR-006: V1/V2 阶段分离

**决策**：V1 不直接调合约，后端封装 REST；V2（4 月底）前端直接与合约交互
**原因**：降低 V1 复杂度，快速 MVP；V2 实现去中心化
**时间**：2026-03

---

## Appendix

### A. 环境变量清单

| 变量                                    | Scope  | 说明                |
| --------------------------------------- | ------ | ------------------- |
| `NEXT_PUBLIC_API_BASE_URL`              | Client | API 基础路径        |
| `NEXT_PUBLIC_ENABLE_MSW`                | Client | 启用 MSW Mock       |
| `NEXT_PUBLIC_SHOW_DEV_TOOLS`            | Client | 显示开发工具        |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | Client | WalletConnect ID    |
| `NEXT_PUBLIC_CHAIN_ID`                  | Client | 目标链 ID (56=BSC)  |
| `NEXT_PUBLIC_SENTRY_DSN`                | Client | Sentry DSN          |
| `BACKEND_URL`                           | Server | 后端 API 地址       |
| `SPORTMONKS_BACKEND_URL`                | Server | SportMonks 代理地址 |
| `SPORTMONKS_API_TOKEN`                  | Server | SportMonks Token    |
| `INVITE_CODE`                           | Server | 邀请码              |
| `SENTRY_AUTH_TOKEN`                     | Server | Sentry 部署 Token   |

### B. 统计概览

| 指标           | 数值     |
| -------------- | -------- |
| 组件文件       | ~143 TSX |
| 工具库文件     | 44 TS    |
| 自定义 Hooks   | 29       |
| Zustand Stores | 10       |
| MSW Handlers   | 7 模块   |
| 路由           | 15+      |
| 支持语言       | 9        |
| 生产依赖       | 20+      |
| 开发依赖       | 18+      |
