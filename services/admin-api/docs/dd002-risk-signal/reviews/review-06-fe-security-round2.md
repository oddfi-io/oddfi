# Review 06 · 前端二轮安全 review（合入+发布前，security-reviewer agent）

> 日期：2026-06-06 ｜ 对象：oddfi-admin-frontend `feat/risk-signal` 联调 A 增量 + 发布态安全面
> 结论：**APPROVE（LOW，零新增可利用面），不阻断合入与发布**

## 逐点核验（5/5 过）

| 点 | 结论 |
|---|---|
| 增量渲染面（formatScore/SignedOdds/RatioPercent、applyTab URL 面） | ✅ 全部 React children 转义；filter 值=固定枚举+白名单 fallback，URL 篡改最坏落 all |
| 发布态 | ✅ 无 import.meta.env.DEV 分支/调试 flag/硬编码 host 进产物（vite.config 的 127.0.0.1 仅 dev proxy 默认值，不进 dist）；无 .env 入库 |
| localStorage JWT 回归 | ✅ 增量改动文件不含 JWT 读写面 |
| 「生产页展示 dev 数据」外延 | ✅ dev 脏字符串全经转义，属数据正确性非安全问题 |
| 决策 POST 面 | ✅ body 仍仅 {action,remark}，幂等走 header，eventId 已编码 |

## 登记项（不阻断）

- INFO-1：传递依赖 CVE ×4（path-to-regexp/postcss 经 geist>next、qs 经 @refinedev/core）——运行时不可达（Next 不加载/build-time/filter 固定枚举），既存噪声非本轮引入。建议排期 `pnpm.overrides` 清理（= FE-ENH-1）。
