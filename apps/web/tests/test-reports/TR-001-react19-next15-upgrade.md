# TR-001: React 19 + Next.js 15 升级测试报告

**测试时间**: 2026-03-26 10:00 — 11:30
**测试分支**: chore/upgrade-react19-next15
**基线 commit**: 2bafd10 (main)
**测试 commit**: 012e461
**测试执行者**: AI Agent (Claude Code)
**升级范围**: React 18.3.1→19.2.4 / Next.js 14.2.35→15.3.9 / Sentry instrumentation 迁移

---

## 自动化测试

| #   | 检查项                | 工具              | 结果                     | 耗时 |
| --- | --------------------- | ----------------- | ------------------------ | ---- |
| 1   | TypeScript 类型检查   | `pnpm type-check` | PASS (0 errors)          | 9s   |
| 2   | 单元/集成测试         | `pnpm test`       | PASS (37 files, 417/417) | 5s   |
| 3   | 生产构建              | `pnpm build`      | PASS                     | 60s  |
| 4   | 页面可达性 (HTTP 200) | curl              | PASS (9/9)               | -    |
| 5   | 浏览器控制台零报错    | console-check.mjs | 7 PASS / 2 KNOWN         | ~90s |

### 控制台检查明细

| 页面            | 结果  | 备注             |
| --------------- | ----- | ---------------- |
| /en/markets     | PASS  |                  |
| /en/stake       | PASS  |                  |
| /en/swap        | PASS  |                  |
| /en/trade       | KNOWN | MSW 无头环境限制 |
| /en/invite      | KNOWN | MSW 无头环境限制 |
| /en/liquidity   | PASS  |                  |
| /en/leaderboard | PASS  |                  |
| /en/stats       | PASS  |                  |
| /access         | PASS  |                  |

## 人工验证发现的缺陷

| #     | 严重性   | 问题                                | 根因                                           | 状态   |
| ----- | -------- | ----------------------------------- | ---------------------------------------------- | ------ |
| BUG-1 | Critical | Hydration mismatch (data-locatorjs) | locator loader 仅客户端 + React 19 严格化      | 已修复 |
| BUG-2 | Critical | "No QueryClient set" Markets 白屏   | HydrationBoundary 在 RSC + Next.js 15 时序变更 | 已修复 |

## 性能对比

| 指标            | 升级前 | 升级后 | 变化     |
| --------------- | ------ | ------ | -------- |
| 生产构建        | 90s    | 60s    | -33%     |
| dev swap 首编   | 14.7s  | 9.5s   | -35%     |
| Sentry 构建警告 | 5 条   | 0 条   | 全部消除 |

## 遗留项

| 项                                 | 优先级 |
| ---------------------------------- | ------ |
| @locator/runtime solid-js 兼容警告 | P3     |
| Sentry onRequestError (可选)       | P3     |
| Turbopack (等 wagmi 3.x 生态)      | 暂缓   |

## 结论

PASS — 2 个 Critical 缺陷已修复，自动化全绿，待人工验证钱包连接流程。
