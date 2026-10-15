# DD002-T08 · 调整历史弹窗 + 审批中心弹窗 + 铃铛 badge

> 方案：[`../DD.md`](../DD.md) §3.3 决策状态机 + §3.4
> 索引：[`./README.md`](./README.md)
> 前置：T06（与 T07 可并行）
> 下游：联调 A
> ⚠️ 仓库：`~/work/oddfi-admin-frontend`

## 目标

信号灯闭环的交互终点：调整历史弹窗、审批中心弹窗（含红灯决策动作）、顶栏铃铛 badge。

## 文件清单

- `src/pages/events/components/AdjustHistoryModal.tsx` — 新建
- `src/components/ApprovalCenterModal.tsx` — 新建（顶栏级组件，双 Tab）
- `src/components/AdminHeader.tsx` — 修改：铃铛 + Badge
- `src/hooks/useApprovalCounts.ts` — 新建：counts 轮询 + 失败保持上次值
- `src/hooks/useRiskDecision.ts` — 新建：决策 mutation（幂等 key + 乐观更新）

## 接口设计 / 行为约定

**调整历史弹窗**：方向行「调整 n 次」触发；列 seq/time/odds/exposure/lp_ratio/source；exposure/lp_ratio null →「—」；source 本期恒 Auto。

**铃铛 badge**（`useApprovalCounts`）：
- `GET /admin/approval/counts` 30s `refetchInterval`
- **失败降级：保持上次值，不弹错不归零**（`keepPreviousData` + onError 静默 console.warn）
- badge 数 = event_count（红灯未决策数）

**审批中心弹窗**：
- 双 Tab：「赛事审批」+「Claim 审批」**占位置灰**（badge 0，文案「待接入」）
- 赛事 Tab：`GET /admin/events/risk/list?signal=red&pending_decision=true` → 红灯卡片列表（赛事信息 + 风险数据）
- 规则说明折叠区：四档阈值 + 压缩率文案（**纯展示文案非判级源**，注释标注改阈值需手动同步）
- 决策动作（`useRiskDecision`）：开盘 approve_continue / 停单 stop，复用 `ConfirmMutationModal` **强制填 remark**；`X-Idempotency-Key` 走 `useIdempotencyKey`
- **决策成功乐观更新**（§3.3 状态机）：该卡退队、badge−1、列表行灯色降级 orange +「已人工处理」标注（invalidate list + counts query 兜底）
- 决策按钮 `RoleGuard allow={["operator","super_admin"]}`；403 时按钮隐藏（卡片仍可见）

## 实施要点

- 错误码分支：EVENT_NOT_RED_SIGNAL →「该赛事已不是红灯，列表已刷新」+ invalidate；RISK_DECISION_CONFLICT →「已有人处理过」+ invalidate
- 弹窗挂 AdminHeader 层级，任何页面可呼出（对齐原型铃铛入口）

## 测试要求

`tsc + lint` 绿；对 mock 上游演练决策闭环（mock 有内存状态）：决策 → 退队 → 重复决策 CONFLICT → 红灯重升夹具重新入队。

## 验收

联调 A checklist 中决策/badge 相关条目全过（含停 mock 验证 badge 保持上次值）。
