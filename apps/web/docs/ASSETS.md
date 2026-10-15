# ASSETS — 资产清单（ENH-011 唯一数据源）

> 本文件为 Agent / 人类新建 hook / 组件 / 工具 / 关键基建前的**强制查询表**。
> `PreToolUse(Write)` hook 会校验 Agent 在新建前是否 Read 过此文件。

**结构分层**（两层定位不同，不应同步）：

1. **业务分类区 §1–§25**（人工维护）— 按业务场景分组 + file-level 说明，**复用判断的主入口**
2. **AUTO-GENERATED 块**（脚本维护）— 完整路径 + export 列表，**新 export 不遗漏的兜底索引**

**使用流程**：

1. 先读业务分类区，按场景关键词定位候选路径
2. 命中 → 直接用；不确定 → grep AUTO 块兜底搜索符号名
3. 都未命中 → 在计划里说明「已查 ASSETS.md（关键词：…），无替代，新建理由：…」
4. 生成：`pnpm gen-assets`（只替换 AUTO 块，业务分类区保留）

---

# 一、函数侧

## 1. 时间处理

> 赛事 kickoff / 日期筛选 / 相对时间（"3 分钟前"）/ 当地时间行全部在这里。已处理 UTC 基准 + 用户本地时区切换，别直接用 `new Date().toLocaleString`，也别自己拼 `Intl.DateTimeFormat`。

- `lib/date-utils.ts` — `getTodayUTC` / `getDateOffsetUTC` / `getDateFromBaseUTC` / `dateDiffDays` / `formatDateLabel`
- `lib/format-utils.ts` — `formatMatchDate` / `formatMatchTime` / `formatMatchDateTime`
- `lib/format/relative-time.ts` — `formatRelativeTime` / `formatDateLineLocal` / `formatTimeLineLocal`
- `hooks/useRelativeTime.ts` — `useRelativeTime`
- `hooks/useDateRange.ts` — `useDateRange`

## 2. 金额 / 精度 / 格式化（禁用原生浮点）

> **唯一允许做金融计算的入口**。赔率换算 / 盈亏比 / 预估收益已全在内；展示侧 `formatAmount` / `formatBalance` / `formatPrice` 覆盖千分位 / 紧凑（K/M）/ 小额精度。绝对禁止 `toFixed` / `amount * odds` / `Number(...)` 做金融计算。

- `lib/decimal.ts` — 计算：`add` / `sub` / `mul` / `div` / `cmp` / `isGt` / `isValidAmount` / `convertOdd` / `oddToUsd` / `calcEstimatedReturn` / `calcEstimatedShares` / `calcProfitRatio`
- `lib/decimal.ts` — 展示：`formatAmount` / `formatBalance` / `formatCompact` / `formatDisplayAmount` / `formatPercent` / `formatPrice`

## 3. 全局登录 / 钱包连接

> 页面层**禁止**直接调 wagmi，一律走这套 hook：`useAuth` 管 JWT 会话、`useRequireWallet` 管"动作前必须登录"的弹窗式守门、`useWalletConnect` 管连接流程、`useNetworkGuard` 管链切换。签名消息、钱包 env 探测、移动端 DappBrowser 跳转已封装。

- `hooks/useAuth.ts` — `useAuth` / `triggerGlobalLogout` (+ localStorage keys: `EXPLICIT_CONNECT_KEY` / `EXPLICIT_CONNECT_TS_KEY` / `LAST_CONNECTOR_ID_KEY` / `SELECTED_WALLET_KEY`)
- `hooks/useWallet.ts` — `useWallet`
- `hooks/useWalletConnect.ts` — `useWalletConnect` / `useDappBrowserConnect`
- `hooks/useRequireWallet.ts` — `useRequireWallet` + `WalletConnectCancelError` / `WalletRequiredError`
- `hooks/useConnectedWalletIcon.ts` — `useConnectedWalletIcon`
- `hooks/useNetworkGuard.ts` — `useNetworkGuard`
- `stores/authStore.ts` — `useAuthStore` / `useAuthUIState` / `deriveAuthUIState` / `hydrateAuthStore` / `rehydrateAuthStore` + type `AuthUIState`
- `lib/auth.ts` — `buildSignMessage` / `decodeJwtAddress` / `mapChainName` / `mapWalletType`
- `lib/connectors.ts` — `walletConnectors`
- `lib/wagmi.config.ts` — `wagmiConfig` / `CORE_CHAIN` / `SUPPORTED_CHAINS`
- `lib/wallet-env.ts` — `detectWalletEnv` + types `WalletEnv` / `WalletId`
- `lib/mobile-wallet-detect.ts` — `detectMobileWalletEnv` / `getWalletAppLink` / `getWalletOpenLink` / `getWalletOpenLinkForCurrentPage` / `getWcDeepLink` + types `DappBrowserWallet` / `MobileWalletEnv`

## 4. 代币价格 / 汇率

> `useTokenPricesApi` 多链批量拉价（经 market-api），返回带 chainId + symbol 归一化 key；`useTokenPrices` 是以前的 CoinGecko 通道（已经淘汰到 FALLBACK_PRICES）。别新建价格 hook，先看这两个。

- `hooks/useTokenPrices.ts` — `useTokenPrices` + `FALLBACK_PRICES`
- `hooks/useTokenPricesApi.ts` — `useTokenPricesApi` + `lookupPrice` / `lookupTokenIcon` / `lookupChainIcon` / `makePriceKey` + types `PriceKey` / `TokenPriceData`

## 5. 平台币（OFI）

> 平台币切换的**唯一入口**。`PLATFORM_TOKEN` 是后端配置驱动的动态符号（现在 OFI，可能换），页面只读 `PLATFORM_TOKEN_SYMBOL` / `PLATFORM_TOKEN_DISPLAY`。价格请用 `useOddPrice`（后端 `?symbol=odd` 接口，已含平台币税费逻辑），不要用通用 `useTokenPricesApi`。

- `hooks/useOddPrice.ts` — `useOddPrice`
- `lib/platform-token.ts` — `PLATFORM_TOKEN` / `PLATFORM_TOKEN_SYMBOL` / `PLATFORM_TOKEN_NAME` / `PLATFORM_TOKEN_DISPLAY` / `IS_PLATFORM_TOKEN_PROXY`

## 6. 货币显示 / 法币换算

> 所有 "$X.XX" / "¥X.XX" 展示必须走这两个 hook：`useDisplayBalance` 输入原始余额 + 当前币种 → 返回格式化串；`useCurrencyDisplay` 做多币种切换（USD/CNY/...）。汇率和展示币种由 `currencyStore` 统一管理，别自己存 localStorage。

- `hooks/useCurrencyDisplay.ts` — `useCurrencyDisplay` + type `CurrencyDisplayResult`
- `hooks/useDisplayBalance.ts` — `useDisplayBalance`
- `stores/currencyStore.ts` — `useCurrencyStore` / `selectCurrency` / `hydrateCurrencyStore` + type `DisplayCurrency`

## 7. i18n 文案

> 通用翻译直接 `useTranslations('namespace')`（next-intl，9 种语言在 `messages/*.json`）。本节只放**代码里动态映射**的特殊表：`translateMarketType` 把后端市场枚举（`1X2` / `OU` / `AH`...）翻成多语言。别在组件里写 switch-case 翻译。

- `lib/market-type-i18n.ts` — `translateMarketType`

## 8. Swap 流程（Pancake / Relay 自动切换）

> `selectSwapRoute(from, to)` 是统一入口：同链 BSC → Pancake V2，跨链 → Relay 聚合器。Pancake 路径用 `computePancakeQuote` + `createPancakeSwap`，Relay 走 `useRelayQuote` + `useRelayExecute`。别直连 DEX Router。跨链充值（Relay → Deposit）用 `useRelayDepositTx`，含 phase 状态机。

- `lib/swap/route-selector.ts` — `selectSwapRoute` + type `SwapRoute`
- `lib/swap/amount-clamp.ts` — `clampAmountToBalance` / `shouldTriggerSwitchAndQuote`
- `lib/swap/picker-popular.ts` — `resolvePopularTokens` + `POPULAR_TOKEN_IDS`
- `lib/swap/resolve-to-token-list.ts` — `resolveToTokenList` / `resolveDefaultToToken`
- `lib/swap/pancake-adapter.ts` — `computePancakeQuote` / `createPancakeSwap` / `usePancakeQuote` / `buildPath` + types `PancakeQuote` / `PancakeSwapParams`
- `lib/swap/constants.ts` — `PANCAKE_ROUTER_V2` / `DEX_ROUTER` / `ROUTER_ABI` / `ERC20_ABI` / `getDeadline`
- `lib/relay/client.ts` — `getRelayClient`
- `lib/relay/types.ts` — types `BridgeExecutionState` / `BridgeExecutionStatus` / `RelayQuoteDetails` / `RelayQuoteParams` / `RelayQuoteState`
- `hooks/useRelayQuote.ts` — `useRelayQuote`
- `hooks/useRelayExecute.ts` — `useRelayExecute`
- `hooks/useRelayTokenList.ts` — `useRelayTokenList`
- `hooks/useRelayDepositTx.ts` — `useRelayDepositTx` + type `RelayDepositPhase`
- `hooks/useTokenPickerSource.ts` — `useTokenPickerSource` + types `ChainTab` / `PickerDataResult`

## 9. Deposit / Withdraw / Claim 流程

> 三条链上动作的状态机 hook：内部 phase 枚举（`DepositStep` / `WithdrawStep` / `ClaimStep`）驱动 UI 分步，组件只订阅 phase 渲染对应 section。Sheet 开关由 `depositSheetStore` 统一控制，别自己新开 `useState`。V1 链上交互一律经 Proxy Wallet（见 §10）。

- `hooks/useDepositFlow.ts` — `useDepositFlow` + type `DepositStep`
- `hooks/useDepositTx.ts` — `useDepositTx` + types `DepositQuoteData` / `DepositTxPhase`
- `hooks/useWithdrawFlow.ts` — `useWithdrawFlow` + type `WithdrawStep`
- `hooks/useWithdrawFee.ts` — `useWithdrawFee`（链上提现 gas / 平台手续费拆分查询）
- `hooks/useWithdrawStatus.ts` — `useWithdrawStatus`（提现单据轮询：pending → success/failed）
- `hooks/useWithdrawTx.ts` — `useWithdrawTx`（提现交易提交 + 哈希追踪）
- `hooks/useClaimFlow.ts` — `useClaimFlow` + type `ClaimStep`
- `stores/depositSheetStore.ts` — `useDepositSheetStore` + type `TxResultData`

## 10. Proxy Wallet（V1 多签代理）

> V1 阶段所有链上写操作的**唯一出口**：`useProxyWalletTx` 包装签名 + 提交 + 轮询，`TxPhase` 枚举覆盖 idle/signing/pending/success/failed。V2 前端直连合约时整块下线，新代码别依赖 proxy wallet 的 UI 形态；只依赖它的 action 语义。

- `hooks/useProxyWallet.ts` — `useProxyWallet`
- `hooks/useProxyWalletTx.ts` — `useProxyWalletTx` + type `TxPhase`
- `stores/proxyWalletStore.ts` — `useProxyWalletStore`
- `lib/proxy-wallet/types.ts` — types `ProxyTxRequest` / `ProxyTxResult` / `ProxyWalletBalance` / `ProxyWalletInfo` / `TxAction` / `TxConfirmSummary`
- `lib/proxy-wallet/utils.ts` — `buildTxSummary` / `truncateAddress`

## 11. 代币余额 / 授权 / 注册表

> `TOKEN_REGISTRY` 是多链 token 元数据（symbol / address / decimals / icon）**唯一来源**，按场景选：`getTokenBySymbol` / `getTokenByChainAndSymbol` / `getTokensForChain`。余额分三层：单链单币 `useTokenBalance`、多链多币 `useMultiChainBalances`、Portfolio 级聚合 `useMultiChainPortfolio`。授权用 `useTokenApproval`（带 allowance 缓存）。

- `hooks/useTokenBalance.ts` — `useTokenBalance` + type `UseTokenBalanceResult`
- `hooks/useTokenApproval.ts` — `useTokenApproval` + type `UseTokenApprovalResult`
- `hooks/useAccountBalance.ts` — `useAccountBalance`
- `hooks/useMultiChainBalances.ts` — `useMultiChainBalances` + type `ChainTokenBalance`
- `hooks/useMultiChainPortfolio.ts` — `useMultiChainPortfolio` + type `PortfolioToken`
- `lib/token-registry.ts` — `TOKEN_REGISTRY` / `TOKEN_BY_SYMBOL` / `SWAP_TOKENS` / `DEPOSIT_TOKEN_SYMBOLS` / `WBNB_ADDRESS` / 链分组 (`ARB_TOKENS` / `BASE_TOKENS` / `BSC_TOKENS` / `ETH_TOKENS` / `POLYGON_TOKENS`) / `CHAIN_ID_MAP` / `CHAIN_ID_REVERSE_MAP` / `CHAIN_ICON_MAP` / `getTokenBySymbol` / `getTokenByChainAndSymbol` / `getTokensForChain` + type `TokenMeta`

## 12. 链注册表 / 网络配置

> 项目支持链的 **Single Source**：新增链只改 `chains.ts`（+ `chain-registry.ts` 元数据，+ `fallback-priority.ts` 兜底顺序）。`SUPPORTED_CHAINS` = 可连钱包的链，`BALANCE_READ_CHAINS` = 需要读余额的链，`CORE_CHAIN` = 平台主链（BSC）。链图标走 `getChainMeta().icon`，别直接拼 `/images/chains/xxx.svg` 路径。

- `lib/chains.ts` — `SUPPORTED_CHAINS` / `ALL_CHAINS` / `CORE_CHAIN` / `ALL_CHAIN_RPC` / `CHAIN_RPC` / `BALANCE_READ_CHAINS` / `BALANCE_CHAIN_RPC` / `isSupportedChain` / `isCoreChain` + type `SupportedChain`
- `lib/chain-registry.ts` — `getChainMeta` / `DEFAULT_CHAIN_META` + type `ChainMeta`
- `lib/chains/fallback-priority.ts` — `pickDefaultFromAsset` / `pickFallbackChainId` / `CHAIN_FALLBACK_PRIORITY` / `CHAIN_FALLBACK_PRIORITY_IDS`

## 13. 赛事 / 赔率数据

> `match-utils` 把后端 fixture payload 聚合成展示结构（主客队信息、赔率入口、主盘口），**任何组件从 fixture 里取值都先找这里的 getter**。`fixture-state` 统一 live / upcoming / finished 判定（别自己 switch status ID）。`featured-matches` 是首页推荐赛事评分 + 联赛分组。`getFeaturedMatches` 是主入口。

- `hooks/useMarketData.ts` — `useMarketData` + type `TeamOption`
- `hooks/useBnbKline.ts` — `useBnbKline`
- `hooks/useOddsDirection.ts` — `useOddsDirection`
- `lib/match-utils.ts` — `getTeam` / `getTeamName` / `getTeamLogo` / `formatKickoff` / `getOddsByMarketId` / `getOddsDisplay` / `getAllOddsDisplay` / `getOddsEntries` / `getFirstLineEntries` / `getMainHandicapLine` / `getMainTotalLine` / `get1X2Entry` + types `OddsDisplay` / `OddsEntries` / `TripleOddsData`
- `lib/league-utils.ts` — `groupLeaguesByRegion`
- `lib/featured-matches.ts` — `getFeaturedMatches` / `getActiveFeaturedTeamsForFixtures` / `scoreFeaturedMatch` / `sortLeagueGroups` / `getLeagueWeight` / `detectCompetitionContext` + type `FeaturedTeamsConfig`
- `lib/fixture-state.ts` — `getFixtureStatus` / `getStatePeriodKey` + `LIVE_STATE_IDS` / `UPCOMING_STATE_IDS` / `FINISHED_STATE_IDS` + type `FixtureStatus`
- `lib/odds.ts` — `toOdds` / `toOddsDisplay`
- `lib/format/fixture.ts` — `parseFixtureName`

## 14. 投注车 / 投注记录

> `betSlipStore` 是投注车状态**唯一源**（用 selector 订阅，别 `.getState()` 直读）；`makeSelectionId` 算选项唯一 key（保持一致性否则 dedup 失效）。动画两套分开：移动端 FAB → `betslip-animations.ts`，PC 面板 → `betslip-animations-pc.ts`（都走 WAAPI，不要写 Tailwind `animate-*`）。成功下注缓存走 `recentBetsCache`。

- `stores/betSlipStore.ts` — `useBetSlipStore` + selectors (`selectActiveTab` / `selectHasConflict` / `selectIsSelected` / `selectPotentialWin` / `selectSelectionCount` / `selectTotalBet` / `selectTotalOdds`) + type `BetSlipStore`
- `lib/betslip-animations.ts` — 移动端：`flyChipToFab` / `bounceFab` / `glowFab` / `rippleFab` / `shakeFab` / `shrinkFab` / `flashOddsBtn` / `isRapidAdd`
- `lib/betslip-animations-pc.ts` — PC：`flyChipToPanel` / `panelPulse` / `badgeBounce` / `flashOddsBtn` / `shakePanel` / `scrollToNewest` / `isPcRapidAdd`
- `lib/betslip-click-handler.ts` — `handleOddsClickAction`
- `lib/recentBetsCache.ts` — `cacheSuccessfulBets` / `loadRecentBets` / `getSnapshotByOddId` + type `BetSelectionSnapshot`
- `lib/bet-tag-classes.ts` — `tagClasses`
- `lib/selection-id.ts` — `makeSelectionId`

## 15. Portfolio / 历史

> 后端 ledger 格式 → UI 结构的转换层：`ledgerToBet` / `ledgerToTransaction` 把原始流水拆成投注和资金两侧，`mapBusinessType` / `mapStatus` 做枚举翻译。历史数据用 `usePortfolioHistoryInfinite`（分页 + 无限滚动），别在页面里自己拼 React Query `useInfiniteQuery`。

- `hooks/usePortfolioHistory.ts` — `usePortfolioHistory` + type `HistoryPreset`
- `hooks/usePortfolioHistoryInfinite.ts` — `usePortfolioHistoryInfinite` + `HISTORY_PAGE_SIZE`
- `lib/adapters/portfolio.ts` — `ledgerToBet` / `ledgerToTransaction` / `mapBusinessType` / `mapStatus` / `deriveMatchStatus` / `absAmount` / `TEAM_ICON_FALLBACK`
- `lib/mock/portfolio.ts` — `MOCK_SUMMARY` + type `PortfolioSummaryData`
- `components/portfolio/common/PortfolioSearchInput.tsx` — `PortfolioSearchInput`（props: `value`, `onChange`, `placeholder?`, `hasActiveSearch?`, `onH5OpenChange?`；PC 240px 输入框 + H5 折叠按钮；Bet/History 页搜索框统一复用）
- `components/portfolio/common/LoadMoreButton.tsx` — `LoadMoreButton`（props: `hasNextPage`, `isFetchingNextPage`, `onLoadMore`；Portfolio Active/Settled/History 列表底部加载更多按钮统一复用）

## 16. 响应式 / 布局 UI 状态

> 移动端判定**唯一入口**：`useIsPhone`（boolean，断点 768px）/ `useResponsiveMode`（返回 `mobile | tablet | desktop`）/ `useIsTripleOdds`（赔率行布局判定）。禁止 `window.matchMedia` / `window.innerWidth < 768` 直写。市场页布局状态（侧栏折叠、分类/联赛选中、filter）全在 `marketsLayoutStore`，有分好的 selector，别全量订阅。

- `hooks/useIsPhone.ts` — `useIsPhone`
- `hooks/useResponsiveMode.ts` — `useResponsiveMode` / `useIsTripleOdds` + type `ResponsiveMode`
- `stores/marketsLayoutStore.ts` — `useMarketsLayoutStore` / `useLayoutState` + 多个 selector + types `LayoutState` / `MarketsLayoutStore` / `CategoryKey` / `ChipKey` / `TeamFilter` / `TimeFilter`
- `stores/mobileMenuStore.ts` — `useMobileMenuStore` / `selectMobileMenuOpen`
- `stores/walletDisplayStore.ts` — `useWalletDisplayStore`
- `stores/walletSheetStore.ts` — `useWalletSheetStore` / `selectWalletSheetOpen`

## 17. 跨链桥状态

> Relay 跨链动作的 UI 状态（source / target chain + token，跨链阶段、quote、execute 结果）。主要由 Deposit / Swap 流程消费，不要新页面自建 bridge state。

- `stores/bridgeStore.ts` — `useBridgeStore`

## 18. 基础设施 / 工具

> 高频复用点：`cn`（clsx + tailwind-merge，所有条件 className 用它）、`showToast` + 语义化 `toastSuccess/Error/Info/Warning`（别用 react-hot-toast API 直调，要走 `lib/toast.ts` 的统一样式）、`accountKeys` 是 TanStack Query 的账户域 key factory、`captureBetError` 是 Sentry 的下注失败埋点。Route Handler 代理一律走 `proxyRequest`。业务幂等 key（下单 / 提现 / 结算等同类写操作的去重 key）统一走 `useIdempotentRefId`：挂起期间 `getOrCreate` 复用同一 uuid（网络错/超时/自动 retry），明确响应后 `clear` 切换下一笔。

- `lib/utils.ts` — `cn`（clsx + tailwind-merge）
- `lib/toast.ts` — `showToast` / `toastSuccess` / `toastError` / `toastInfo` / `toastWarning`
- `lib/query-keys.ts` — `accountKeys`
- `lib/http/searchParams.ts` — `toSearchParams`
- `lib/sentry.ts` — `captureBalanceAnomaly` / `captureBetError` / `setSentryUser` / `clearSentryUser`
- `lib/logger.ts` — `logger`（`debug` 仅 dev 输出，`info` / `warn` / `error` 始终输出）
- `lib/proxy.ts` — `proxyRequest` / `sanitizePath`
- `lib/design-tokens.ts` — `tokens` + type `TokenKey`
- `hooks/useIdempotentRefId.ts` — `useIdempotentRefId` + type `IdempotentRefId`
- `stores/devToolsStore.ts` — `useDevToolsStore` / `hydrateDevToolsStore`

## 19. API 聚合（`lib/api.ts`，按子域使用）

> HTTP 接口**唯一入口**，禁止页面 `fetch`。双 client：`client`（MSW 拦截，业务 mock）+ `authClient`（真后端代理，自动附 JWT）。新增接口一定要放进 `lib/api.ts`，page/hook 只 import 命名函数，不碰 ky instance。错误 → `MarketApiError` 类型守卫。

- **认证**：`loginByWalletStep1` / `loginByWalletStep2` / `logoutApi`
- **账户**：`getAccountBalance` / `getPortfolioHistory`
- **价格**：`getBatchTokenPrices` / `getOddTokenPrice` / `getPrices` + types `BatchPriceItem` / `BatchPriceReq` / `MarketApiError`
- **赛事**：`getMarketFixtures` / `getMarketFixturesByDate` / `getMarketFixtureDetail` / `getKlineData`
- **投注**：`placeBet` / `cancelBets`
- **Swap**：`getSwapQuote` / `executeSwap`
- **充提**：`getDepositAddress` / `withdrawApply` / `cancelWithdraw` / `getWithdrawRecords`
- **奖励**：`claimPrize` / `claimReward`
- **借贷**：`getLendingPositions` / `getLendingBorrows` / `borrowFromPosition` / `repayBorrow`
- **邀请**：`getInviteInfo` / `getInviteRecords` / `getInviteRewards` / `getInviteStats`
- **基础**：`doRefreshSingleton`

---

# 二、组件侧

## 20. 公共交互组件

> `Button` / `Select` / `DropdownMenu` 已按 Figma 打磨、包含 hover / disabled / loading 状态。**禁止复制样式自己拼** `<button className="...">`。Select 基于 Radix，多层 Content/Item 结构已封装，组件接口保持受控模式。

- `components/ui/Button.tsx` — `Button`
- `components/ui/Select.tsx` — `Select` / `SelectContent` / `SelectGroup` / `SelectItem` / `SelectTrigger` / `SelectValue`
- `components/ui/DropdownMenu.tsx` — `DropdownMenu` / `DropdownMenuItem`

## 21. 弹窗（PC 居中 Modal）

> 所有需要遮罩 + 居中的对话框都走 `Modal`：已含 backdrop、ESC 关闭、焦点陷阱。禁止 `fixed inset-0` 自己拼。移动端走 §22 的 BottomSheet，两者**不要混用**——同一个业务弹窗要按响应式在两端切换（参照 `useResponsiveMode`）。

- `components/ui/Modal.tsx` — `Modal`

## 22. H5 Bottom Sheet（移动端底部抽屉）

> 移动端从底部上滑的所有场景统一用 `MobileBottomSheet`：已处理 `env(safe-area-inset-bottom)`、下拉关闭手势、遮罩 blur。组件 props 接收 `open` + `onClose` + `children`，别自己写 `fixed bottom-0` 抽屉，不然安全区会漏处理。

- `components/ui/MobileBottomSheet.tsx` — `MobileBottomSheet`

## 23. 状态反馈

> `EmptyState` 是统一空态（图标 + 标题 + 说明 + CTA 槽），别自己拼空数据页；`Skeleton` 是骨架屏（按 mobile-h5 规则：所有数据区 loading 都用骨架，不用 Spinner）；`Toaster` 全局只能挂一次（在 root layout 里），别组件内重复挂；`LocatorSetup` 是 E2E 测试的 data-testid 定位辅助，通常自动生效，业务代码别直接引用。

- `components/ui/EmptyState.tsx` — `EmptyState`
- `components/ui/Skeleton.tsx` — `Skeleton`
- `components/ui/Toaster.tsx` — `Toaster`（全局挂在 layout 根，别重复挂）
- `components/ui/LocatorSetup.tsx` — `LocatorSetup`（E2E 定位辅助）

## 24. 代币 / 链 / 运动 / 队标图标组件

> `TokenIconWithChain` = 代币图标（默认右下角叠链图标，传 `hideChainBadge` 可隐藏链标）；充值/桥接/Portfolio/平台币展示都用它，别手写叠图，也别为平台币写专用图标组件。`ChainIcon` = 纯链标（只表达"钱包/地址在哪条链上"），仅用于**目标/来源钱包行**前置图标，chainId 缺省走 `CORE_CHAIN`（BSC），别用它替代代币展示。`SportIcon` 是运动项目图标（足球/篮球等）；`TeamVsAvatars` = 主客队双圆叠加头像（Portfolio Bet/History 列表都用它），URL 缺失自动 fallback 到首字母圆底。图标资源走 `public/images/tokens/` 和 `chains/`（文件名规则见 `static-assets.md`），不要本地 import `.svg`。

- `components/ui/TokenIconWithChain.tsx` — `TokenIconWithChain`（含 `hideChainBadge` 模式）
- `components/ui/ChainIcon.tsx` — `ChainIcon`（`chainId` 缺省 = BSC）
- `components/ui/SportIcon.tsx` — `SportIcon`
- `components/ui/TeamVsAvatars.tsx` — `TeamVsAvatars`
- `public/images/match-stats/{goals,corners,red-card,yellow-card,stats-toggle,ai-badge}.svg` — 比赛统计散件 SVG（足球进球 / 角球 / 红黄牌 / 统计入口 / AI 徽标），通过 `<img src>` 或 `next/image` 引用，**禁止**复制粘贴新建

## 25. 通用 SVG 图标（`components/icons/`）

> 通用 UI 图标**优先** Phosphor Icons（`import { XIcon } from "@phosphor-icons/react"`），本目录只放 Phosphor 没有或项目定制的。新增自定义 SVG 必须封装成 `XxxIcon.tsx` 组件（禁止裸 `<svg>` 散落在业务组件），文件位置见 `static-assets.md`。品牌 / 运动定制图标（进球、黄牌、PancakeSwap logo 等）一律自建，禁止用 Phosphor 替代。

- 箭头 / 返回：`ArrowRightIcon` / `BackIcon` / `CaretDownIcon` / `CaretDownCustomIcon`
- 用户 / 设置 / 全球：`AvatarIcon` / `SettingsIcon` / `GlobeCustomIcon`
- 交易 / 价格：`ExchangeIcon` / `PancakeSwapIcon` / `RelayIcon` / `KLineIcon`
- 状态：`FireIcon` / `LiveDotIcon` / `ToastStatusIcon` / `WarningRectIcon` / `SearchEmptyIcon`
- 功能：`PlusSquareIcon` / `SortIcon`
- 圆形国旗：`CircleFlag`（消费 `public/images/flags/{code}.svg`，已圆形化无需外层裁剪；区别于 `home-banner/parts/CountryFlag.tsx` 的矩形 `country-flag-icons` 库）

---

# 三、完整机器清单（AUTO-GENERATED）

下方由 `pnpm gen-assets` 自动维护，纯路径 + export 名索引，保证不遗漏任何 export。说明请写在上方业务分类区，AUTO 块不重复维护注释。

<!-- AUTO-GENERATED:BEGIN -->

## hooks

- useAccountBalance — hooks/useAccountBalance.ts
- AgentConfigDraft / useAgentConfigDraft — hooks/useAgentConfigDraft.ts
- SendOptions / useAiChat — hooks/useAiChat.ts
- triggerGlobalLogout / useAuth — hooks/useAuth.ts
- useBannerDetail — hooks/useBannerDetail.ts
- BetSelectionMode / runBetClick / useBetSelectionToggle — hooks/useBetSelectionToggle.ts
- useBetSlipPanel — hooks/useBetSlipPanel.ts
- useBnbKline — hooks/useBnbKline.ts
- UseCalendarActiveStageReturn / useCalendarActiveStage — hooks/useCalendarActiveStage.ts
- useCalendarMatchById / useCalendarMatches / useCalendarTournament — hooks/useCalendarData.ts
- HoverBindings / UseCalendarHoverIntentReturn / useCalendarHoverIntent — hooks/useCalendarHoverIntent.ts
- UseCalendarTimezoneReturn / useCalendarTimezone — hooks/useCalendarTimezone.ts
- ChatOpener / useChatOpener — hooks/useChatOpener.ts
- useClaimBet — hooks/useClaimBet.ts
- ClaimStep / useClaimFlow — hooks/useClaimFlow.ts
- useConnectedWalletIcon — hooks/useConnectedWalletIcon.ts
- useCopyToClipboard — hooks/useCopyToClipboard.ts
- Countdown / parseUtcEndTime / useCountdown — hooks/useCountdown.ts
- UseCreateAgentWizardResult / WIZARD_TABS / WizardTab / useCreateAgentWizard — hooks/useCreateAgentWizard.ts
- CurrencyDisplayResult / useCurrencyDisplay — hooks/useCurrencyDisplay.ts
- useDateRange — hooks/useDateRange.ts
- DepositStep / useDepositFlow — hooks/useDepositFlow.ts
- DepositGlobalTxPhase / UseDepositGlobalTxResult / useDepositGlobalTx — hooks/useDepositGlobalTx.ts
- DepositMatchTxPhase / UseDepositMatchTxResult / useDepositMatchTx — hooks/useDepositMatchTx.ts
- DepositQuoteData / DepositTxPhase / useDepositTx — hooks/useDepositTx.ts
- useDisplayBalance — hooks/useDisplayBalance.ts
- PENDING_POLL_LEAD_MS / UseFixtureStreamsResult / shouldPollPending / shouldRetryStreams / useFixtureStreams — hooks/useFixtureStreams.ts
- IdempotentRefId / KeyedIdempotentRefId / useIdempotentRefId / useKeyedIdempotentRefId — hooks/useIdempotentRefId.ts
- UseInViewportOpts / useInViewport — hooks/useInViewport.ts
- useIsPhone — hooks/useIsPhone.ts
- LpMatchPoolData / UseLiquidityFeaturedPoolsResult / assemblePoolsData / useLiquidityFeaturedPools — hooks/useLiquidityFeaturedPools.ts
- useLiquidityPoolStats — hooks/useLiquidityPoolStats.ts
- UseLiveOddsArgs / UseLiveOddsResult / useLiveOddsForEntry — hooks/useLiveOddsForEntry.ts
- UseLiveTotalOddsResult / useLiveTotalOdds — hooks/useLiveTotalOdds.ts
- LpPoolDisplay / LpPositionData / UseLpPositionsResult / derivePoolDisplay / mapLpPosition / useLpPositions — hooks/useLpPositions.ts
- MAX_ITEMS_PER_BANNER / normalizeBanners / useMarketBanners — hooks/useMarketBanners.ts
- InfinitePageContext / LeagueCountryOption / TeamOption / buildInfinitePageContext / getNextPageParam / injectHeadFixtures / remapOnchainTestOddsIds / shouldRetry / useMarketData — hooks/useMarketData.ts
- UseMatchDetailH2HResult / useMatchDetailH2H — hooks/useMatchDetailH2H.ts
- UseMatchDetailLineupsResult / useMatchDetailLineups — hooks/useMatchDetailLineups.ts
- UseMatchDetailOverviewResult / useMatchDetailOverview — hooks/useMatchDetailOverview.ts
- UseMatchDetailStandingsResult / useMatchDetailStandings — hooks/useMatchDetailStandings.ts
- useMediaQuery — hooks/useMediaQuery.ts
- UseMoneylineHistoryResult / isLiveMoneylineState / toMoneylineTrend / useMoneylineHistory — hooks/useMoneylineHistory.ts
- ChainTokenBalance / useMultiChainBalances — hooks/useMultiChainBalances.ts
- PortfolioToken / useMultiChainPortfolio — hooks/useMultiChainPortfolio.ts
- useNetworkGuard — hooks/useNetworkGuard.ts
- FeedStatus / SseStatus / UseNewsFeedResult / useNewsFeed — hooks/useNewsFeed.ts
- useOddPrice — hooks/useOddPrice.ts
- useOddsDirection — hooks/useOddsDirection.ts
- useOnchainCashout — hooks/useOnchainCashout.ts
- useOnchainClaim — hooks/useOnchainClaim.ts
- OnchainMarketLookupArgs / OnchainMarketLookupResult / UseOnchainMarketsByFixtureResult / selectOnchainMarketForEntry / selectionLabelToOutcomeIndex / useOnchainMarketsByFixture — hooks/useOnchainMarketBySelection.ts
- OnchainOddsStatus / UseOnchainOddsArgs / UseOnchainOddsResult / useOnchainOdds — hooks/useOnchainOdds.ts
- usePendingOnchainBets — hooks/usePendingOnchainBets.ts
- useCancelBet — hooks/usePortfolioBets.ts
- HistoryPreset / PRESET_CONFIG / usePortfolioHistory — hooks/usePortfolioHistory.ts
- HISTORY_PAGE_SIZE / usePortfolioHistoryInfinite — hooks/usePortfolioHistoryInfinite.ts
- PreviewError / PreviewSignalState / UsePreviewSignalArgs / usePreviewSignal — hooks/usePreviewSignal.ts
- useProxyWallet — hooks/useProxyWallet.ts
- TxPhase / useProxyWalletTx — hooks/useProxyWalletTx.ts
- UseReferralAutoBindParams / useReferralAutoBind — hooks/useReferralAutoBind.ts
- useRelativeTime — hooks/useRelativeTime.ts
- RelayDepositPhase / useRelayDepositTx — hooks/useRelayDepositTx.ts
- useRelayExecute — hooks/useRelayExecute.ts
- useRelayQuote — hooks/useRelayQuote.ts
- useRelayTokenList — hooks/useRelayTokenList.ts
- WalletConnectCancelError / WalletRequiredError / useRequireWallet — hooks/useRequireWallet.ts
- DRAG_HANDLE_CLASSNAME / useResizableModal — hooks/useResizableModal.ts
- ResponsiveMode / useIsTripleOdds / useResponsiveMode — hooks/useResponsiveMode.ts
- UseStakeHistoryResult / mapStakeHistory / useStakeHistory — hooks/useStakeHistory.ts
- StakeTxPhase / UseStakeTxResult / useStakeTx — hooks/useStakeTx.ts
- useIsStakingAvailable / useOddBalance / useStakingGlobalStats / useUserStaking — hooks/useStakingData.ts
- TierSaleBuyPhase / UseTierSaleBuyResult / useTierSaleBuy — hooks/useTierSaleBuy.ts
- UseTokenApprovalResult / useTokenApproval — hooks/useTokenApproval.ts
- UseTokenBalanceResult / useTokenBalance — hooks/useTokenBalance.ts
- ChainTab / PickerDataResult / useTokenPickerSource — hooks/useTokenPickerSource.ts
- FALLBACK_PRICES / useTokenPrices — hooks/useTokenPrices.ts
- PriceKey / TokenPriceData / lookupChainIcon / lookupPrice / lookupTokenIcon / makePriceKey / useTokenPricesApi — hooks/useTokenPricesApi.ts
- BindResultAction / decideBindResult / useTwitterBindResult — hooks/useTwitterBindResult.ts
- UseTxStatusState / useTxStatus — hooks/useTxStatus.ts
- UseUclWcFixturesOpts / UseUclWcFixturesResult / filterEndedFixtures / filterTestFixtures / mergeAndDedupFixtures / useUclWcFixtures — hooks/useUclWcFixtures.ts
- UnbondLpTxPhase / UseUnbondLpTxResult / useUnbondLpTx — hooks/useUnbondLpTx.ts
- UnstakeTxPhase / UseUnstakeTxResult / useUnstakeTx — hooks/useUnstakeTx.ts
- SocialConnection / UserProfile / loadProfile / saveProfile / useUserProfile — hooks/useUserProfile.ts
- useWallet — hooks/useWallet.ts
- useDappBrowserConnect / useWalletConnect — hooks/useWalletConnect.ts
- useWithdrawFee — hooks/useWithdrawFee.ts
- WithdrawStep / useWithdrawFlow — hooks/useWithdrawFlow.ts
- UseWithdrawLpTxResult / WithdrawLpTxPhase / useWithdrawLpTx — hooks/useWithdrawLpTx.ts
- UseWithdrawStatusReturn / useWithdrawStatus — hooks/useWithdrawStatus.ts
- WithdrawErrorKey / WithdrawPhase / useWithdrawTx — hooks/useWithdrawTx.ts

## components/ui

- Button — components/ui/Button.tsx
- ChainIcon — components/ui/ChainIcon.tsx
- DropdownMenu / DropdownMenuItem — components/ui/DropdownMenu.tsx
- EmptyState — components/ui/EmptyState.tsx
- LocatorSetup — components/ui/LocatorSetup.tsx
- MobileBottomSheet — components/ui/MobileBottomSheet.tsx
- Modal — components/ui/Modal.tsx
- NumberInput / NumberInputProps — components/ui/NumberInput.tsx
- NumberedSection / NumberedSectionProps — components/ui/NumberedSection.tsx
- PillSwitcher / PillSwitcherItem — components/ui/PillSwitcher.tsx
- SegmentedChipItem / SegmentedChips — components/ui/SegmentedChips.tsx
- SegmentedTabItem / SegmentedTabs — components/ui/SegmentedTabs.tsx
- Select / SelectContent / SelectGroup / SelectItem / SelectTrigger / SelectValue — components/ui/Select.tsx
- Skeleton — components/ui/Skeleton.tsx
- SportIcon — components/ui/SportIcon.tsx
- TeamCircle / TeamInfo / TeamVsAvatars / initialOf — components/ui/TeamVsAvatars.tsx
- Toaster — components/ui/Toaster.tsx
- Toggle / ToggleProps — components/ui/Toggle.tsx
- TokenIconWithChain — components/ui/TokenIconWithChain.tsx
- UnderlineTabItem / UnderlineTabs / UnderlineTabsSize — components/ui/UnderlineTabs.tsx
- Calendar / CalendarProps — components/ui/calendar.tsx
- Popover / PopoverAnchor / PopoverContent / PopoverTrigger — components/ui/popover.tsx

## components/icons

- AiInsightIcon — components/icons/AiInsightIcon.tsx
- ArrowRightIcon — components/icons/ArrowRightIcon.tsx
- AvatarIcon — components/icons/AvatarIcon.tsx
- BackIcon — components/icons/BackIcon.tsx
- FireBannerIcon / FootballBannerIcon / GoldenBootIcon / GoldenGloveIcon / MvpIcon — components/icons/BannerTabIcons.tsx
- CaretDownCustomIcon — components/icons/CaretDownCustomIcon.tsx
- CaretDownIcon — components/icons/CaretDownIcon.tsx
- ChatClearIcon — components/icons/ChatClearIcon.tsx
- CircleFlag — components/icons/CircleFlag.tsx
- ExchangeIcon — components/icons/ExchangeIcon.tsx
- FireIcon — components/icons/FireIcon.tsx
- GlobeCustomIcon — components/icons/GlobeCustomIcon.tsx
- KLineIcon — components/icons/KLineIcon.tsx
- LiveDotIcon — components/icons/LiveDotIcon.tsx
- MatchWinnerArrow — components/icons/MatchWinnerArrow.tsx
- NavAiAgentIcon — components/icons/NavAiAgentIcon.tsx
- NavLiquidityIcon — components/icons/NavLiquidityIcon.tsx
- NavMarketsIcon — components/icons/NavMarketsIcon.tsx
- PancakeSwapIcon — components/icons/PancakeSwapIcon.tsx
- PlusSquareIcon — components/icons/PlusSquareIcon.tsx
- RelayIcon — components/icons/RelayIcon.tsx
- RewardRulesIcon — components/icons/RewardRulesIcon.tsx
- SearchEmptyIcon — components/icons/SearchEmptyIcon.tsx
- SettingsIcon — components/icons/SettingsIcon.tsx
- SortIcon — components/icons/SortIcon.tsx
- SparkleIcon — components/icons/SparkleIcon.tsx
- ToastStatusIcon — components/icons/ToastStatusIcon.tsx
- WarningRectIcon — components/icons/WarningRectIcon.tsx
- WorldCupTrophyIcon — components/icons/WorldCupTrophyIcon.tsx
- CtaCenterDecorIcon — components/icons/landing/CtaCenterDecorIcon.tsx
- PoweredByAISparkIcon — components/icons/landing/PoweredByAISparkIcon.tsx
- RoadmapMarkerIcon — components/icons/landing/RoadmapMarkerIcon.tsx

## lib

- LIQUIDITY_POOL_ABI / LP_DEPLOY_BLOCK / LP_POSITION_STATE / LpPositionState / POOL_TYPE — lib/abi/liquidityPool.ts
- ODD_TOKEN_ABI — lib/abi/oddToken.ts
- STAKING_POOL_ABI — lib/abi/stakingPool.ts
- TIER_SALE_ABI — lib/abi/tierSale.ts
- PendingBetDisplayInput / buildPendingPortfolioBet — lib/adapters/pending-onchain-bet.ts
- absAmount / deriveMatchStatus / ledgerToBet / ledgerToTransaction / mapBusinessType / mapStatus / parlayLegToBetLeg / parseFixtureTimeMs / parseOnchainOrderId / parseScoreString — lib/adapters/portfolio.ts
- BuildContextOptions / ContextUnavailableError / H2H_SMALL_SAMPLE_THRESHOLD / MatchDataBundle / assembleContext / buildMatchContext / fetchMatchData / resetInflightForTest — lib/ai/context/match-context.ts
- LayoutInput / Position / ResolvedLayout / Size / Viewport / resolveLayout — lib/ai/layout-clamp.ts
- ExtractedPicks / extractPicksBlock / hidePartialPicksBlock — lib/ai/picks.ts
- AiConfigError / AiEnv / AiUpstreamError / ChatMessage / ChatRole / ChatUsage / PROVIDERS / ProviderId / ResolvedProvider / StreamChunk / StreamPhase / callChat / getProvider — lib/ai/provider.ts
- RateLimiter / createMemoryLimiter / memoryLimiter — lib/ai/rate-limit.ts
- ChatRequest / Intent / Persona / chatMessageSchema / chatRequestSchema / intentSchema / personaSchema — lib/ai/schema.ts
- AgentPersona / AgentTone / BuildPromptInput / PromptIntent / buildFreeChatContext / buildSystemPrompt / todayISO — lib/ai/system-prompt.ts
- BatchPriceItem / BatchPriceReq / EarlyAccessError / EarlyAccessErrorKind / LeagueCountryWire / MarketApiError / MarketChipsResponse / TeamChipWire / authGet / authPost / borrowFromPosition / cancelBets / cancelWithdraw / claimPrize / claimReward / doRefreshSingleton / executeSwap / getAccountBalance / getBatchTokenPrices / getDepositAddress / getFixtureStreams / getInviteInfo / getInviteRecords / getInviteRewards / getInviteStats / getKlineData / getLendingBorrows / getLendingPositions / getLiquidityGlobalPlans / getLiquidityMatchPools / getLiquidityPositions / getLiquidityWithdrawable / getMarketBannerDetail / getMarketBanners / getMarketChips / getMarketFixtureDetail / getMarketFixtures / getMarketFixturesByDate / getMatchDetailH2H / getMatchDetailLineups / getMatchDetailOverview / getMatchDetailStandings / getMoneylineHistory / getOddTokenPrice / getOnchainMarkets / getOnchainOrder / getOnchainTestFixtures / getPortfolioHistory / getPrices / getStakeHistory / getStakeStats / getSwapQuote / getWithdrawFee / getWithdrawRecordInfo / getWithdrawRecords / loginByWalletStep1 / loginByWalletStep2 / logoutApi / onchainApprove / onchainCashOut / onchainClaimPayout / onchainDepositGlobal / onchainDepositMatch / onchainEarlyUnstake / onchainPlaceBet / onchainRequestUnbond / onchainStake / onchainUnstake / onchainWithdrawLp / placeBannerBet / placeBet / previewSignal / registerEarlyAccess / repayBorrow / withdrawApply — lib/api.ts
- assertUniqueKeys — lib/assert-unique-keys.ts
- buildSignMessage / decodeJwtAddress / mapChainName / mapWalletType — lib/auth.ts
- bannerItemToBetSelection / isBannerSelection — lib/banner-bet-mapper.ts
- BANNER_DETAIL_FIXTURES / BannerCountdownMock / BannerDetailFixture / TrendSeriesMock — lib/banner-detail-fixtures.ts
- bannerTitleFromMarket — lib/banner-portfolio-meta.ts
- tagClasses — lib/bet-tag-classes.ts
- badgeBounce / clearFlyingChips / flashOddsBtn / flashOddsDirection / flyChipToPanel / isPcRapidAdd / panelPulse / scrollToNewest / shakePanel — lib/betslip-animations-pc.ts
- bounceFab / dimOdds / flashOddsBtn / flashOddsDirection / flyChipToFab / getBrandRgba / glowFab / isRapidAdd / rippleFab / shakeFab / shrinkFab — lib/betslip-animations.ts
- handleOddsClickAction — lib/betslip-click-handler.ts
- MIN_BET_ODD / ONCHAIN_TEST_FIXTURE_ID_MAX / ONCHAIN_TEST_FIXTURE_ID_MIN / TEST_FIXTURE_IDS / USER_SLIPPAGE_BPS_DEFAULT / isAnyTestFixture / isOnchainTestFixture / isStakeBelowMin / isTestFixtureId / toOddAmount — lib/betting/constants.ts
- ensureBettingAllowance — lib/betting/ensure-betting-allowance.ts
- MinOddsInput / computeMinOddsBps — lib/betting/min-odds.ts
- CASHOUT_CONTRACT_MIN_ODD / CashoutErrorKind / CashoutEstimate / CashoutEstimateInput / CashoutQuote / CashoutQuoteArgs / CashoutQuoteUnavailableError / CashoutQuoteUnavailableReason / OnchainCashoutInput / OnchainCashoutResult / OnchainCashoutRevertedError / calcCashoutEstimate / classifyCashoutError / fetchCashoutQuote / submitOnchainCashout — lib/betting/onchain-cashout.ts
- ClaimErrorKind / OnchainClaimInput / OnchainClaimResult / OnchainClaimRevertedError / classifyClaimError / getOnchainBetId / isOnchainBetNotReadyError / submitOnchainClaim — lib/betting/onchain-claim.ts
- formatRevertArgs / revertKindToI18nKey — lib/betting/onchain-error-i18n.ts
- AnalysisPick / BackendRecommendation / FulltimeLabel / PickConfidence / PickMarket / RecommendedSelection / deriveRecommendedSelection / deriveSelectionForPick / sortPicksByConfidence — lib/betting/recommend-selection.ts
- RefreshOffchainOddsDeps / refreshOffchainOdds — lib/betting/refresh-offchain-odds.ts
- ApproveRevertedError / BetRevertedError / OnchainBetInput / OnchainBetResult / OnchainBetState / submitOnchainBet — lib/betting/submit-onchain-bet.ts
- OnchainMarketNotFoundError / OnchainSelectionInput / UnsupportedSelectionError / findOnchainMarket / selectionToOnchainOutcome / submitOnchainBetFromSelection — lib/betting/submit-onchain-from-selection.ts
- BRACKET_GROUPS / BRACKET_MATCHES / BRACKET_TEAMS / MOCK_BRACKET — lib/bracket/mock-data.ts
- BracketMatch / BracketTeam / GroupCell / GroupKey / RoundKey / TournamentBracket — lib/bracket/types.ts
- getCalendarMatchById / getCalendarMatches / getCalendarTournament — lib/calendar/api.ts
- COL_GAP / COL_WIDTH_PC / COL_WIDTH_PC_PAIR / DATE_AXIS_HEIGHT / HOVER_ENTER_MS / HOVER_LEAVE_MS / LEAGUE_ID / MATCH_CARD_HEIGHT / MOCK_API_DELAY_MS / ROW_GAP / ROW_HEIGHT / STAGE_ID_MAP / STAGE_LABEL / STAGE_ORDER / STAGE_PALETTE / TIME_AXIS_WIDTH / TOURNAMENT_ID / TZ_PREF_KEY / Y_TIMES_UTC — lib/calendar/constants.ts
- buildStageOrdinalMap / getFlagSrc / getHomeAway / getMarketStatus / getStageId / getTeamShortCode — lib/calendar/derivers.ts
- CellPosition / getCellPosition / getStageStartCol / groupFixturesByCell — lib/calendar/grid-layout.ts
- KickoffDisplay / KickoffParts / TimeAxisCell / TimezoneMode / buildTimeAxis / dayKey / formatKickoffDisplay / formatKickoffInTz / getBrowserTimezone / todayKey — lib/calendar/timezone.ts
- deriveTournamentMeta — lib/calendar/tournament-meta.ts
- ChainMeta / DEFAULT_CHAIN_META / getChainMeta — lib/chain-registry.ts
- ALL_CHAINS / ALL_CHAIN_RPC / BALANCE_CHAIN_RPC / BALANCE_READ_CHAINS / CHAIN_RPC / CORE_CHAIN / SUPPORTED_CHAINS / SupportedChain / isCoreChain / isSupportedChain — lib/chains.ts
- CHAIN_FALLBACK_PRIORITY / CHAIN_FALLBACK_PRIORITY_IDS / pickDefaultFromAsset / pickFallbackChainId — lib/chains/fallback-priority.ts
- CODEX_PETS / CODEX_PET_STATES / CodexPet / CodexPetState / DEFAULT_PET_ID / SPRITE_COLS / SPRITE_ROWS / buildSpriteUrl / findPet / preloadPetSprites / stateDurationMs — lib/codex-pets/registry.ts
- walletConnectors — lib/connectors.ts
- CONTRACTS / ContractAddresses / getContracts / requireContract — lib/contracts.ts
- dateDiffDays / formatDateLabel / getDateFromBaseUTC / getDateOffsetUTC / getTodayUTC — lib/date-utils.ts
- add / calcEstimatedReturn / calcEstimatedShares / calcProfitRatio / cmp / convertOdd / div / formatAdaptiveAmount / formatAmount / formatBalance / formatCompact / formatDisplayAmount / formatPercent / formatPrice / isGt / isValidAmount / mul / oddToUsd / sub — lib/decimal.ts
- TokenKey / tokens — lib/design-tokens.ts
- useForceDisableBet — lib/dev-toggles.ts
- EB_BYPASS_COOKIE / IS_EARLY_BIRD_MODE / isEarlyBirdBypassValid — lib/early-bird-mode.ts
- buildFrameSrc / getStreamFrameHosts — lib/embed-allowlist.ts
- IS_LEND_ENABLED / IS_SWAP_ENABLED / isDisabledFeatureRoute / isNavItemLaunchHidden — lib/feature-flags.ts
- FeaturedTeamsConfig / detectCompetitionContext / getActiveFeaturedTeamsForFixtures / getFeaturedMatches / getLeagueWeight / scoreFeaturedMatch / sortLeagueGroups — lib/featured-matches.ts
- ANOMALY_STATE_IDS / FINISHED_STATE_IDS / FixtureStatus / LIVE_STATE_IDS / TERMINAL_STATE_IDS / UPCOMING_STATE_IDS / getFixtureStatus / getStatePeriodKey — lib/fixture-state.ts
- formatMatchDate / formatMatchDateTime / formatMatchTime / parseMatchTime / resolveKickoffSeconds — lib/format-utils.ts
- formatMatchTitle / parseFixtureName — lib/format/fixture.ts
- PlayerNameParts / getPlayerLastName / splitPlayerName — lib/format/player-name.ts
- formatLocalDateTime / relativeFromTs — lib/format/relative-time-core.ts
- formatAbsoluteDateTime / formatDateLineLocal / formatMatchTimeLocal / formatRelativeTime / formatTimeLineLocal — lib/format/relative-time.ts
- Rect / rectArea / rectOverlapArea — lib/geometry.ts
- BANNER_DECORATIONS / BANNER_DEFAULT_DECORATION / BANNER_TAG_BACKGROUNDS / BANNER_TAG_ICONS / PROMO_BANNER_CARD_BG / PROMO_BANNER_THEMES / PromoBannerTheme / PromoIllustrationSpec / resolveDecoration — lib/home-banner-decorations.ts
- toSearchParams — lib/http/searchParams.ts
- groupLeaguesByRegion — lib/league-utils.ts
- DepositRevertedError / OnchainDepositGlobalInput / OnchainDepositMatchInput / OnchainDepositState / OnchainLpPositionInput / OnchainUnbondState / OnchainWithdrawState / UnbondRevertedError / WithdrawRevertedError / submitOnchainDepositGlobal / submitOnchainDepositMatch / submitOnchainRequestUnbond / submitOnchainWithdrawLp — lib/liquidity/submit-onchain-lp.ts
- logger — lib/logger.ts
- LP_PLAN_OPTIONS / LpPlanId / getLpPlan — lib/lp-plans.ts
- MARKET_API_BASE — lib/market-api.ts
- translateMarketType — lib/market-type-i18n.ts
- AWAY_ORANGE / HOME_BLUE / OUTCOME_BG_CLASS / OUTCOME_HEX — lib/match-colors.ts
- parseBackendDateTime / toMatchH2HDomain / toMatchLineupsDomain / toMatchOverviewDomain / toMatchStandingsDomain — lib/match-detail-adapter.ts
- fixtureIdToMatchId — lib/match-id.ts
- OddsDisplay / OddsEntries / TripleOddsData / formatKickoff / formatKickoffLong / get1X2Entry / getAllOddsDisplay / getFirstLineEntries / getMainHandicapLine / getMainTotalLine / getOddsByMarketId / getOddsDisplay / getOddsEntries / getTeam / getTeamLogo / getTeamName / participantToMatchTeam — lib/match-utils.ts
- DappBrowserWallet / MobileWalletEnv / detectMobileWalletEnv / getWalletAppLink / getWalletOpenLink / getWalletOpenLinkForCurrentPage / getWcDeepLink — lib/mobile-wallet-detect.ts
- MOCK_SUMMARY / PortfolioSummaryData — lib/mock/portfolio.ts
- teaserStatsMock — lib/moneyline-teaser.ts
- ACTIVE_CORE_CHAIN / ACTIVE_NETWORK / IS_TESTNET / LIVE_ODDS_SOURCE / NetworkMode — lib/network-mode.ts
- normalizeTeamName / resolveFixtureByText — lib/news-fixture-match.ts
- FetchPushParams / NewsRateLimitError / PushStreamHandlers / fetchPush / isNewsApiConfigured / openPushStream — lib/news/api.ts
- NOTIFY_SOUND_THROTTLE_MS / playNotifySound / resetNotifySoundThrottleForTest — lib/news/notify-sound.ts
- formatRelativeTimeMs — lib/news/relative-time-ms.ts
- sanitizeDeltaHtml — lib/news/sanitize.ts
- normalizeBetStatus — lib/normalize-bet-status.ts
- ODDS_LOCKED_CLASS / ODDS_LOCKED_TEXT / formatContractOdds / formatOddWei / formatOdds / toOdds / toOddsDisplay — lib/odds.ts
- filterLinesToOnchain / hasOnchainLine / lineToBasis / pickOnchainAlignedLine / shouldAlignToOnchain — lib/onchain-line-filter.ts
- InvalidMarketIdError / isValidMarketId / normalizeMarketId — lib/onchain/market-id.ts
- compareQuoteVersion / restBaseOddsToContractStrings — lib/onchain/odds-format.ts
- OrderBetReadyInconsistentError / OrderNotReadyTimeoutError / WaitForBetReadyOpts / WaitForBetReadyResult / waitForOnchainBetReady — lib/onchain/order-poller.ts
- ReceiptClient / ReceiptStatus / ReceiptTimeoutError / WaitForReceiptOpts / WaitForReceiptResult / waitForReceipt — lib/onchain/receipt-poller.ts
- DecodedRevert / RevertKind / decodeRevertedTx / extractRevertData / parseRevertData — lib/onchain/revert-decoder.ts
- toUserTxMessage — lib/onchain/tx-error.ts
- OddsLine / parseOddsLines — lib/parse-odds-lines.ts
- IS_PLATFORM_TOKEN_PROXY / PLATFORM_TOKEN / PLATFORM_TOKEN_DISPLAY / PLATFORM_TOKEN_NAME / PLATFORM_TOKEN_SYMBOL — lib/platform-token.ts
- FilterApiParams / FilterStatus / statusToApiParams — lib/portfolio-filter.ts
- SettledResultI18nKey / claimButtonKey / payoutDisplay / statusColor / statusI18nKey — lib/portfolio/settle-display.ts
- activityColor / activityI18nKey / cashColor — lib/portfolio/transaction-display.ts
- bindReferral / getDeposit / getDepositList / getPosition / getPresaleConfig / getReferralList / getReferralMe / reportDepositTx — lib/presale/api.ts
- DepositValidationError / ValidateDepositParams / validateDeposit — lib/presale/deposit-validation.ts
- DepositErrorForm / MappedAnomaly / MappedDepositError / mapAnomalyReason / mapBindErrorCode / mapDepositErrorCode / mapDepositValidationError — lib/presale/error-map.ts
- useBindReferral — lib/presale/hooks/useBindReferral.ts
- DepositPhase / DepositUiError / REPORT_TX_MAX_RETRIES / ReportTxAction / ReportTxOutcome / UseDepositResult / classifyReportTxError / reportTxBackoffMs / reportTxWithRetry / useDeposit — lib/presale/hooks/useDeposit.ts
- useDepositList — lib/presale/hooks/useDepositList.ts
- DEPOSIT_POLL_INTERVAL_MS / useDepositStatus — lib/presale/hooks/useDepositStatus.ts
- usePosition — lib/presale/hooks/usePosition.ts
- usePresaleConfig — lib/presale/hooks/usePresaleConfig.ts
- useReferralList — lib/presale/hooks/useReferralList.ts
- nextReferralPollInterval / useReferralMe — lib/presale/hooks/useReferralMe.ts
- IS_PRESALE_ENABLED — lib/presale/presale-visibility.ts
- ReferralEntry / decideReferralEntry / isValidReferralCode / normalizeReferralCode — lib/presale/referral-entry.ts
- AnomalyReason / AnomalyReasonRaw / BindReq / BindRes / Deposit / DepositListResult / DepositListWire / DepositStatus / ListQuery / PerRoundPosition / Position / PresaleConfig / PresaleRound / PresaleVault / ReferralDeposit / ReferralListItem / ReferralListResult / ReferralListWire / ReferralMe / ReferralMeWire / ReferralStats / Referrer / ReportTxReq / ReportTxRes / RoundStatus / RoundType / adaptDepositList / adaptReferralList / adaptReferralMe — lib/presale/types.ts
- ProxyTxRequest / ProxyTxResult / ProxyWalletBalance / ProxyWalletInfo / TxAction / TxConfirmSummary — lib/proxy-wallet/types.ts
- buildTxSummary / truncateAddress — lib/proxy-wallet/utils.ts
- proxyRequest / sanitizePath — lib/proxy.ts
- accountKeys / liquidityKeys / presaleKeys / referralKeys / twitterKeys — lib/query-keys.ts
- ONCHAIN_MARKETS — lib/react-query-keys.ts
- BetSelectionSnapshot / cacheSuccessfulBets / getSnapshotByOddId / loadRecentBets — lib/recentBetsCache.ts
- getRelayClient — lib/relay/client.ts
- BridgeExecutionState / BridgeExecutionStatus / RelayQuoteDetails / RelayQuoteParams / RelayQuoteState — lib/relay/types.ts
- REWARD_RECORDS / TASK_GROUPS — lib/rewards/fixtures.ts
- getGroupProgress / getRewardsByStatus — lib/rewards/selectors.ts
- RewardRecord / RewardStatus / TaskGroup / TaskItem / TaskItemStatus / TaskVerifyKind — lib/rewards/types.ts
- makeSelectionId — lib/selection-id.ts
- captureBalanceAnomaly / captureBetError / clearSentryUser / setSentryUser — lib/sentry.ts
- LockDays / LockHoursKey / STAKING_PLANS / StakingPlan / getPlanById / isValidPlanId — lib/staking-plans.ts
- STAKE_POSITION_STATUS / StakePositionRaw / StakePositionStatus / derivePositionStatus — lib/staking-state.ts
- OnchainStakeInput / OnchainStakeState / OnchainUnstakeInput / OnchainUnstakeState / StakeRevertedError / UnstakeOp / UnstakeRevertedError / submitOnchainStake / submitOnchainUnstake — lib/staking/submit-onchain-stake.ts
- BLOB_STORE / idbDelete / idbGet / idbSet — lib/storage/indexed-db.ts
- IS_SUBSCRIPTION_MODE — lib/subscription-mode.ts
- clampAmountToBalance / shouldTriggerSwitchAndQuote — lib/swap/amount-clamp.ts
- DEX_ROUTER / ERC20_ABI / PANCAKE_ROUTER_V2 / PANCAKE_TESTNET_ROUTER_V2 / ROUTER_ABI / WBNB_TESTNET_ADDRESS / getDeadline — lib/swap/constants.ts
- PancakeQuote / PancakeSwapParams / buildPath / computePancakeQuote / createPancakeSwap / usePancakeQuote — lib/swap/pancake-adapter.ts
- POPULAR_TOKEN_IDS / resolvePopularTokens — lib/swap/picker-popular.ts
- resolveDefaultToToken / resolveToTokenList — lib/swap/resolve-to-token-list.ts
- SwapRoute / selectSwapRoute — lib/swap/route-selector.ts
- TEAM_ALIASES_BY_SHORT_CODE — lib/team-name-aliases.ts
- approveTierSale / buyTierSale / estimateTierSale — lib/tiersale/api.ts
- TierSaleApproveRevertedError / TierSaleBuyInput / TierSaleBuyResult / TierSaleBuyRevertedError / TierSaleBuyState / isSlippageExceeded / submitTierSaleBuy — lib/tiersale/submit-tiersale-buy.ts
- TierSaleBuyReq / TierSaleEstimateReq / TierSaleEstimateRes — lib/tiersale/types.ts
- showToast / toastError / toastInfo / toastSuccess / toastWarning — lib/toast.ts
- ARB_TOKENS / BASE_TOKENS / BSC_TESTNET_TOKENS / BSC_TOKENS / CHAIN_ICON_MAP / CHAIN_ID_MAP / CHAIN_ID_REVERSE_MAP / DEPOSIT_TOKEN_SYMBOLS / ETH_TOKENS / POLYGON_TOKENS / SWAP_TOKENS / TOKEN_BY_SYMBOL / TOKEN_REGISTRY / TokenMeta / WBNB_ADDRESS / getTokenByChainAndSymbol / getTokenBySymbol / getTokensForChain — lib/token-registry.ts
- checkTwitterFollow / classifyBindUrlError / getTwitterBindUrl / getTwitterBinding / reasonOf / statusOf / unbindTwitter — lib/twitter/api.ts
- useBindTwitter — lib/twitter/hooks/useBindTwitter.ts
- useTwitterBinding — lib/twitter/hooks/useTwitterBinding.ts
- useTwitterFollow — lib/twitter/hooks/useTwitterFollow.ts
- useUnbindTwitter — lib/twitter/hooks/useUnbindTwitter.ts
- BindUrlErrorKind / CheckFollowErrorKind / CheckFollowResult / FollowStatus / TwitterBindUrlError / TwitterBinding / TwitterCheckFollowError / TwitterInfo — lib/twitter/types.ts
- USERNAME_MAX_LENGTH / USERNAME_MIN_LENGTH / UsernameErrorCode / isValidUsername / validateUsername — lib/username-validation.ts
- cn — lib/utils.ts
- CORE_CHAIN / SUPPORTED_CHAINS / wagmiConfig — lib/wagmi.config.ts
- ensureCoreChain — lib/wallet-chain.ts
- WalletEnv / WalletId / detectWalletEnv — lib/wallet-env.ts
- LoginPhase / WalletErrorInfo / WalletErrorKind / WalletErrorSeverity / classifyWalletError / getWalletErrorInfo / isUserCanceledMessage / mapWalletError / shouldReportToSentry — lib/wallet-error.ts
- makeRdnsLockedWallet / setIsMobileForTestOnly / setMipdStoreForTestOnly — lib/wallet-mipd-lock.ts
- waitForConnectorRecovery — lib/wallet-recovery.ts
- forceWagmiReset — lib/wallet-reset.ts
- EXPLICIT_CONNECT_KEY / EXPLICIT_CONNECT_TS_KEY / LAST_CONNECTOR_ID_KEY / SELECTED_WALLET_KEY / clearWalletSessionStorage / revokeWalletPermissions — lib/wallet-session.ts
- subscribeUntil — lib/wallet-store-subscribe.ts
- WsClient — lib/ws/client.ts
- OddsWsConfig / TxWsConfig / getOddsWsConfig / getTxWsConfig — lib/ws/config.ts
- OddsServerPushData / OddsWsManager / OddsWsManagerOpts / injectMockOddsPush / oddsWs / resetOddsWsForTest — lib/ws/odds-ws.ts
- TxFinalStatus / TxWsManager / TxWsManagerOpts / resetTxWsForTest / txWs — lib/ws/tx-ws.ts
- WS_ERR_CODES / WsClientLogger / WsClientOpts / WsDisabledError / WsErrCode / WsError / WsEvent / WsRequest / WsResponse / WsState / WsTimeoutError / isTerminalAuthError — lib/ws/types.ts

## stores

- AgentChannelId / AgentConfig / AgentPushChannel / AgentSound / AgentTone / AiAgentStore / DEFAULT_AGENT_CONFIG / VALID_CHANNEL_IDS / useAiAgentStore — stores/aiAgentStore.ts
- CHAT_MODAL_DEFAULT_HEIGHT / CHAT_MODAL_DEFAULT_INSET / CHAT_MODAL_DEFAULT_WIDTH / CHAT_MODAL_MIN_HEIGHT / CHAT_MODAL_MIN_WIDTH / CHAT_MODAL_VIEWPORT_INSET / ChatModalLayout / useAiChatLayoutStore — stores/aiChatLayoutStore.ts
- AiChatSessionStore / AutoSendPayload / ChatMessageStatus / ChatMode / ChatMsg / ChatTab / LastChatMode / OpenWithIntentPayload / useAiChatSessionStore — stores/aiChatSessionStore.ts
- AuthUIState / deriveAuthUIState / hydrateAuthStore / rehydrateAuthStore / useAuthStore / useAuthUIState — stores/authStore.ts
- BetSlipStore / selectActiveTab / selectHasConflict / selectIsSelected / selectPotentialWin / selectSelectionCount / selectTotalBet / selectTotalOdds / useBetSlipStore — stores/betSlipStore.ts
- useBridgeStore — stores/bridgeStore.ts
- CalendarStore / CalendarTzPref / selectActiveStage / selectDateRange / selectOpenMatchId / selectPinnedStage / selectSelectedGroups / selectTzPref / useCalendarStore — stores/calendarStore.ts
- CashingOutBetsStore / selectCashingOutByBetId / useCashingOutBetsStore — stores/cashingOutBetsStore.ts
- DisplayCurrency / hydrateCurrencyStore / selectCurrency / useCurrencyStore — stores/currencyStore.ts
- TxResultData / useDepositSheetStore — stores/depositSheetStore.ts
- useDevToolsStore — stores/devToolsStore.ts
- useLpRefetchStore — stores/lpRefetchStore.ts
- CategoryKey / ChipKey / LayoutState / MarketsLayoutStore / TeamFilter / TimeFilter / selectSelectedCategory / selectSelectedChip / selectSelectedFixtureId / selectSelectedLeagueCountryId / selectSelectedTeamFilter / selectSelectedTimeFilter / selectSelectedTournament / selectSidebarCollapsed / useLayoutState / useMarketsLayoutStore — stores/marketsLayoutStore.ts
- selectMobileMenuOpen / useMobileMenuStore — stores/mobileMenuStore.ts
- MarketOddsState / OnchainOddsServerData / onchainOddsStore / selectMarketOdds — stores/onchainOddsStore.ts
- PendingOnchainBet / PendingOnchainBetStatus / PendingOnchainBetsStore / selectPendingByOrderId / toPendingBetList / usePendingOnchainBetsStore — stores/pendingOnchainBetsStore.ts
- useProxyWalletStore — stores/proxyWalletStore.ts
- Theme / hydrateThemeStore / selectTheme / useThemeStore — stores/themeStore.ts
- TxLockKind / useIsTxLockedByOther / useTxLockStore — stores/txLockStore.ts
- useWalletDisplayStore — stores/walletDisplayStore.ts
- selectWalletSheetOpen / useWalletSheetStore — stores/walletSheetStore.ts

<!-- AUTO-GENERATED:END -->
