# DD002 · 前端轨道（B）交付报告 — T06/T07/T08

> 日期：2026-06-05 → **2026-06-06 已合入并发布**
> 终态：squash 合入 main `38d1a63` → 推送 → 生产部署 `deploy/2026-06-06`（bundle `index-CzU109Ax.js`，备份锚点 `/var/www/oddfi-admin.bak.1780728491`）
> 发布前验证链：联调 A 7/7（25 项浏览器断言）→ 对合并后 admin-backend main 全量回归 25/25 → 生产侧只读 smoke 4/4（health/401 壳/CORS 预检/双上游在位）→ 二轮双代理 review 双 APPROVE（reviews/05、06）→ 合后门禁（tsc/lint/527 vitest/build）全绿
> 注意：events 上游联调期指 C 端 dev（双上游分流）；**联调 C 人工项（Lark SSO 四角色 / PM 签收）与 CORS 5173 清理仍待统筹收口**

## 1. 完工 commit 列表（feat/risk-signal）

| 波次 | commit | 内容 |
|---|---|---|
| W3 / T06 | `2245a45` | 地基：SignalTag 四色语义 Tag(+测试) / types/events.ts 全契约类型 / dataProvider（PATH=admin/events/risk/list、PAGE_PARAM page/page_size、数组 filter 逗号 join 单 key、sort_by/sort_order）(+测试) / RESOURCE_ROLES.events 四角色 / App.tsx 资源+路由+finance 首页落点改 events |
| W4 / T07 | `57e1430` | 列表页：RiskKpiCards（四色 KPI+红灯脉冲+点击联动+最大敞口定位+状态分布副文案）/ 筛选 Tab（橙含红 signal=orange,red）+ 排序控件 / 两级展开 Table（懒加载明细、settle 结算条、方向胜负态原样渲染）/ TimeChips hover 时间线(+测试) / settled 盈亏替换敞口 / 收益率三态色(+测试) / 未开盘整行置灰 / 30s 轮询 / THEME-MAPPING §2.3.1 风险语义色决策入档 |
| W4 / T08 | `8f6ac62` | 审批闭环：ApprovalCenterModal（双 Tab、Claim 占位置灰、规则说明折叠区[展示文案非判级源 D1]、决策乐观更新退队+badge−1）/ AdjustHistoryModal / AdminHeader 铃铛 Badge / useApprovalCounts（失败保持上次值不弹错 M-Arch-4）(+测试) / useRiskDecision（幂等 header+终态错误码分支）(+测试) / ERROR_MAP 四码补齐 / 新增直接依赖 @ant-design/icons@5.6.1 |
| W5 修复 | `883ed1b` | 双代理 review 修复：H-Code-1（custom 转发 query+回归测试）/ M-Code-3 / M-Code-5 / L-Code-1 / L-Sec-1（明细见 reviews/review-03、04） |

## 2. 完工口径证据

- `pnpm type-check`（tsc -b）✅ ｜ `type-check:test` ✅ ｜ `pnpm lint` ✅ ｜ `pnpm build` ✅
- `pnpm test`：**517 passed**（其中本 DD 新增 ~21 条：SignalTag×4、dataProvider events/多值/排序/custom-query×9、tab 映射往返×8 内含、_format 三态色边界×12 内含、TimeChips 阶段映射、useRiskDecision 请求形态/终态码、badgeValue 钳制）
- review：reviews/review-03-fe-code.md（REQUEST CHANGES → 已处理）+ review-04-fe-security.md（LOW，无可利用漏洞）

## 3. 联调 A 前端侧自检状态（vs process/README §4 checklist）

| 条目 | 状态 |
|---|---|
| 信封拆包 / ID string / 分页 page_page_size / 逗号多值单 key | ✅ 单测覆盖（实测待 mock 上游） |
| 决策幂等 header / 终态错误码分支 / 乐观更新链路 | ✅ 单测+实现（实测待 mock） |
| counts 失败 badge 保持上次值 | ✅ 实现（「停 mock」实测待联调 A） |
| null 组「—」/ 未开盘置灰 / KPI 联动 / 橙含红 / settled 卡替换 / 时间线 hover | ✅ 实现+部分单测（**浏览器 golden path 实测待 mock-webapi**——本机无浏览器自动化，联调 A 时人工过 checklist） |
| 四角色 RBAC 实测 | ⏸ 待联调 A（需后端 dev-token 四角色签发） |

## 4. 留人工 / 待办（前端视角）

| # | 事项 | 谁 / 何时 |
|---|---|---|
| FE-OPS-1 | 联调 A：`go run ./cmd/mock-webapi` + admin-backend + `pnpm dev` 过 §4 checklist 前端条目（含停 mock 验 badge） | hang，后端 T02 交付后 |
| FE-OPS-2 | T05 `docs/api.md §3.12` 落地后与 `src/types/events.ts` 做 schema diff（重点 `,string`、signal 枚举、max_exposure 双义、adjust-history 响应是否 `{list}` 壳） | 前端，T05 后 |
| FE-OPS-3 | 后端确认 list 端点是否支持 `pending_decision` 筛选参数（前端已发该参数 + 客户端兜底过滤，见 M-Code-5） | 后端 T02/T04 |
| FE-OPS-4 | 规则说明折叠区阈值文案（8k/18k/28k）为纯展示非判级源——**改合约/yaml 阈值必须手动同步** `ApprovalCenterModal.tsx` RULES_TEXT（D1 边界） | 长期口径 |
| FE-ENH-1 | 传递依赖 CVE bump（path-to-regexp/qs/postcss，存量非本分支引入，内部 SPA 可达性 ~nil）独立 chore 处理 | 不阻断上线 |
| FE-ENH-2 | badge 乐观减扣在生产 60s 聚合缓存窗口内可能短暂回弹（最终一致，DD §3.3 时效口径内）；如产品在意可等缓存失效再收敛 | 可选 |

## 5. 风格边界执行记录

视觉零原型带入（无暗色/#ff6b35/rgba 描边）；信号灯四色=风险语义色走 AntD preset（决策入档前端仓 `docs/THEME-MAPPING.md §2.3.1`）；红灯脉冲 `.of-signal-pulse` 在 `vercel.css`（rgba 基于 colorError）；字重≤600；无新品牌强调色。
