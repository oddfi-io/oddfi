# 🚀 KICKOFF · 管理后台前端（admin-frontend，轨道 B：T06-T08）

> 角色一句话：在本仓实现「赛事风险/信号灯」前端 —— 风险列表页 + KPI 联动 + 审批中心弹窗 + 铃铛 badge。**零判级逻辑**：完全信任后端 `signal` 字段；交互骨架照原型复刻，视觉沿用本仓 Vercel 风格（禁止抄原型暗色/色值）。

## 1. 方案与任务在哪（方案统一在 admin-backend 仓 docs/dd002-risk-signal/）

| 文件（绝对路径） | 用途 |
|---|---|
| `/Users/hang/work/oddfi-admin-backend/docs/dd002-risk-signal/DD.md` | 方案 v2 唯一权威。重点读：**§3.4 前端方案（风格边界+交付件 checklist）**、§3.3 接口契约、§2.2 原型交互清单 |
| `/Users/hang/work/oddfi-admin-backend/docs/dd002-risk-signal/process/DD002-T06-fe-foundation.md` | 任务①：SignalTag + types + dataProvider/rbac 扩展 + 资源注册 |
| `/Users/hang/work/oddfi-admin-backend/docs/dd002-risk-signal/process/DD002-T07-fe-risk-list.md` | 任务②：风险列表页（**原型交互 checklist 12 条，验收逐条勾**） |
| `/Users/hang/work/oddfi-admin-backend/docs/dd002-risk-signal/process/DD002-T08-fe-modals-badge.md` | 任务③：调整历史/审批弹窗 + 铃铛 badge（决策乐观更新 + badge 失败保持上次值） |
| `/Users/hang/work/oddfi-admin-backend/docs/dd002-risk-signal/prd/0001_Oddfi_Admin_v3.html` | 高保真原型——**只看交互行为**（行号索引见方案 §2.1/§2.2），视觉不要看 |
| `/Users/hang/work/oddfi-admin-backend/docs/api.md` §3.12 | 接口契约（T05 产出；**尚未存在时以方案 §3.3 为准**） |
| `/Users/hang/work/oddfi-admin-backend/docs/dd002-risk-signal/process/README.md` | 依赖图 + 联调 A checklist（你的验收入口） |

## 2. 文件夹地图（本仓你要动的 / 参照的）

```
/Users/hang/work/oddfi-admin-frontend/src/
├── components/
│   ├── RoundStatusTag.tsx          ← ★参照：Tag 结构 + 头注释的“色组纪律”（信号灯 4 色按方案 §3.4 风格边界处理）
│   ├── ConfirmMutationModal.tsx    ← 复用：决策弹窗强制 remark
│   ├── SignalTag.tsx               ← T06 新建
│   ├── ApprovalCenterModal.tsx     ← T08 新建
│   └── AdminHeader.tsx             ← T08 修改：铃铛 + Badge
├── pages/
│   ├── audit/list.tsx:31           ← ★参照：30s refetchInterval 轮询写法
│   └── events/                     ← T07 新建：list.tsx + components/{RiskKpiCards,EventExpandedTable,TimeChips}.tsx
├── providers/dataProvider.ts       ← T06 修改：PATH + PAGE_PARAM(events: page/page_size) + 多值 filter join(",")
├── lib/rbac.ts                     ← T06 修改：RESOURCE_ROLES.events（四角色全读）
├── types/events.ts                 ← T06 新建（ID 全 string，不做 Number() 转换）
├── hooks/
│   ├── useIdempotencyKey.ts        ← 复用：决策幂等 key
│   ├── useApprovalCounts.ts        ← T08 新建
│   └── useRiskDecision.ts          ← T08 新建
└── App.tsx                         ← T06 修改：events 资源 + 菜单「赛事风险」
```

## 3. 必守约定

- 信号灯多值筛选 = **逗号单 key**（`?signal=orange,red`），不要重复 query key
- null 组字段（lp_pool/yield/score/settle_pl/times.settle）显示「—」，未开盘行各卡置灰——这是预期行为不是 bug
- 决策错误码分支：`EVENT_NOT_RED_SIGNAL` / `RISK_DECISION_CONFLICT` → toast + invalidate；counts 失败 badge 保持上次值不弹错
- 分支 `feat/risk-signal`；commit 中文

## 4. 本地联调环境（不等 C 端）

```bash
# admin-backend 仓（T02 交付后）
go run ./cmd/mock-webapi          # :9090 mock 上游（8 事件夹具覆盖全形态，决策有内存状态）
go run cmd/server/main.go         # :8081（config 指向 :9090）
# 本仓
npm run dev                       # :5173
```

验收入口 = process/README.md §4「联调 A」checklist 前端侧条目全过。
