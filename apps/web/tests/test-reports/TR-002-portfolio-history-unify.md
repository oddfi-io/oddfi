# TR-002: Portfolio History 统一接口 — 全套筛选/排序/分页适配测试报告

**测试时间**: 2026-04-19
**测试分支**: feat/portfolio-history-unify
**基线 commit**: 405a45c (dev, DD-073 接入)
**测试 commit**: ddd9c07 (Batch 3/3)
**测试执行者**: AI Agent (Claude Code)
**实施范围**: DD-073 后续 — Transaction Tab UI 接入 `/account/portfolio/history` 完整能力（search / type / result / date range / order_by / sort / pagination）

---

## 自动化测试

| #   | 检查项              | 工具              | 结果                     | 备注                                |
| --- | ------------------- | ----------------- | ------------------------ | ----------------------------------- |
| 1   | TypeScript 类型检查 | `pnpm type-check` | PASS (0 errors)          | 3 batch 每批通过                    |
| 2   | 单元/集成测试       | `pnpm test`       | PASS (56 files, 825/825) | 含新增 6 个 TransactionHistory 用例 |

## 覆盖用例

### 组件层（TransactionHistory.test.tsx — 6 cases）

- Loading 骨架屏
- 空态无筛选 → "No transactions yet"
- 有数据渲染 row
- 搜索输入 300ms debounce 后才传入 hook
- hasNextPage 时显示 Load more，点击触发 fetchNextPage
- isError 显示错误文案

### 契约层（portfolio-history.test.ts — 已存在，本次未改）

- sort asc/desc / order_by=amount / page+page_size clamp
- tab=active/settled / type=bet / result=won 过滤
- begin_date / end_date 闭区间
- search 大小写不敏感
- 非 bet 类 ledger 在 tab 或 search 非空时被丢弃

## 实施明细

### Batch 1 (`6a18041`) — 分页 Hook

- `hooks/usePortfolioHistoryInfinite.ts`：`useInfiniteQuery`，page_size=20，基于 `total` 计算 hasNextPage
- `lib/query-keys.ts`：新增 `accountKeys.historyInfinite`，与单页 key 隔离

### Batch 2 (`f0e5680`) — 子组件

- `TransactionFilterMenu.tsx`：Popover 单选；type 分组（single/parlay/claim/cashout/deposit/withdraw/cancel-withdraw/stake/unstake/add-lp/remove-lp）+ result 分组（won/lost）
- `TransactionDateRange.tsx`：原生 `<input type="date">` 起止双字段，min/max 互斥，无效区间禁用 Apply
- `messages/en.json`：portfolio.filter* / portfolio.date* / loadMore 等 28 个 key

### Batch 3 (`ddd9c07`) — 主组件整合

- `TransactionHistory.tsx`：useReducer 统一 filters；排序 cycle（desc→asc→默认）；H5 搜索图标点击展开为全宽输入
- 空态区分 noResult（有筛选）/ No transactions yet（无筛选）
- Load more 按钮（PC/H5 同构）
- 重写测试覆盖新 hook 形态
- `messages/zh.json`：对应 28 个 key 补齐

## 浏览器验证（待执行）

> 本次为自动化测试报告。浏览器侧验证由用户执行 `pnpm run dev:tst` 连接测试服务器后手动进行：
>
> 1. 搜索 → 300ms 后 URL 参数变化 + 列表刷新
> 2. 筛选 type=claim_prize → 仅返回领奖记录
> 3. 筛选 result=won（type=All）→ 仅返回 WON bet
> 4. 日期范围选起止 → 区间闭区间过滤
> 5. 点 Cash 列头 → cycle desc → asc → 回默认
> 6. 点 Time 列头 → cycle
> 7. > 20 条数据 → 显示 Load more，点击加载次页，total 不变

## 遗留项

| 项                                         | 优先级 | 说明                                                               |
| ------------------------------------------ | ------ | ------------------------------------------------------------------ |
| @figma-hardcoded Popover 背景色 / hover 色 | P3     | 设计稿未定义相关 Token，待设计师补全后统一替换                     |
| H5 日期 Popover 样式                       | P3     | UI 未出设计，先用原生 input（用户确认）                            |
| Funnel 多选                                | P3     | 后端 type 参数仅支持单值，如产品需要多选需后端配合或前端合并多请求 |

## 结论

3 个 Batch 已合入 feat/portfolio-history-unify 分支，type-check 与 825 个测试用例全通过，接口能力已全部映射到现有 UI。待用户在浏览器端完成 7 项人工验证后合并。
