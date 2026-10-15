# DD002-T06 · 前端地基：SignalTag + types + dataProvider/rbac 扩展 + 资源注册

> 方案：[`../DD.md`](../DD.md) §3.4
> 索引：[`./README.md`](./README.md)
> 前置：T05 契约草稿（docs/api.md §3.12）
> 下游：T07、T08
> ⚠️ 仓库：`~/work/oddfi-admin-frontend`（非本仓）

## 目标

信号灯前端公共地基：4 色语义 Tag 组件、类型定义、dataProvider/RBAC 扩展、Refine 资源与菜单注册。

## 文件清单

- `src/components/SignalTag.tsx` — 新建
- `src/types/events.ts` — 新建
- `src/providers/dataProvider.ts` — 修改：PATH + PAGE_PARAM + 多值 filter
- `src/lib/rbac.ts` — 修改：RESOURCE_ROLES.events
- `src/App.tsx` — 修改：events 资源 + 菜单「赛事风险」

## 接口设计 / 行为约定

```ts
// types/events.ts
export type Signal = "green" | "yellow" | "orange" | "red";
export interface RiskEvent { event_id: string; /* §3.3 契约全字段，ID 均 string */ }
export interface RiskSummary { /* §3.3 summary 契约 */ }

// SignalTag.tsx —— 风格边界（方案 §3.4，头注释必须写明）：
// 信号灯四色是“风险语义色”，非品牌强调色；不违反 RoundStatusTag 的
// “不引第六种强调色”纪律。色值取 AntD preset：green / gold / orange / red。
// 原型暗色值（#ff6b35 等）一律不得引入。
// props: { signal: Signal | null; opened: boolean }
//   opened=false → 灰 Tag「未开盘」；signal=null → 「—」
```

- dataProvider：`PATH.events = "/admin/events/risk/list"`；`PAGE_PARAM.events = { page: "page", size: "page_size" }`；filters 处理数组值时 `value.join(",")` 后 `searchParams.set`（**不用重复 key**——后端契约为逗号多值）
- rbac.ts：`events: ["super_admin", "operator", "finance", "customer_service"]`（与后端 T04 矩阵、rbac.md 三处一致）
- App.tsx：一级菜单「赛事风险」`/events`，list 路由

## 实施要点

- ID 全链路 string，列表 rowKey=event_id，不做 Number() 转换
- finance 角色首次获得 presale 之外的可见模块——验证 `NoModules` 兜底逻辑不再把 finance 推去空页面

## 测试要求

`npx tsc --noEmit` + lint 绿；dataProvider 多值 filter 单测（若仓内有 vitest 惯例则补；无则联调 A 用 devtools network 验证 query 形态）。

## 验收

菜单出现「赛事风险」，四角色可见性正确；空页面（T07 前占位）能挂载不报错。
