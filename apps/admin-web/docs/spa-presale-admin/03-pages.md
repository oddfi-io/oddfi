# 03 · 页面实现 · page → endpoint → DTO 映射

> 契约：api.md §3、presale-admin §4–5、03-admin-api-contract §5、01-data-model §3（字段形状）。
> 规则：`refine-conventions.md`（List/Show、useTable、不发明视图模式、不写 create/edit 除非真有创建）。

---

## 0. resource 声明（替换 App.tsx 现有占位）

**导航架构 = 两级、按"大模块"分组，为未来扩展预留**：

- **一级**：大模块分组（可折叠），当前只有「认购」。未来每加一个大模块（结算/风控/用户运营…），就**并列**加一个 group 资源。
- **二级**：该模块下的具体功能页。
- 实现方式：Refine 的 `meta.parent`——声明一个**无路由的 group 资源**作为一级，功能页用 `meta.parent` 指过去，`ThemedLayout` 的 Sider 自动渲染成可折叠父子菜单。

```tsx
const R_VIEW = ["super_admin", "operator", "customer_service"]; // finance 本期无预售权限

resources={[
  // ── 一级：认购模块（无 list/show → Sider 渲染为可折叠父节点，默认展开）──
  { name: "presale", meta: { label: "认购", roles: R_VIEW } },

  // ── 二级：认购下的功能页（meta.parent 指向 "presale"）──
  { name: "dashboard", list: "/dashboard", meta: { label: "总览",     parent: "presale", roles: R_VIEW } },
  { name: "rounds",    list: "/rounds",    show: "/rounds/:id",       meta: { label: "轮次管理", parent: "presale", roles: R_VIEW } },
  { name: "deposits",  list: "/deposits",  show: "/deposits/:txHash", meta: { label: "入账记录", parent: "presale", roles: R_VIEW } },
  { name: "anomaly",   list: "/anomaly",   show: "/anomaly/:id",      meta: { label: "异常事件", parent: "presale", roles: R_VIEW } },
  { name: "config",    list: "/config",    meta: { label: "全局配置", parent: "presale", roles: R_VIEW } },
  { name: "audit",     list: "/audit",     meta: { label: "操作审计", parent: "presale", roles: R_VIEW } },

  // ── 平台级（跨模块治理，不属于"认购"，保持顶层）──
  { name: "admin-users", list: "/admin-users", create: "/admin-users/create", meta: { label: "管理员管理", roles: ["super_admin"] } },
]}
```

**约定与理由**：
- 一级分组资源（`presale`）**不给 `list`/`show`/`create`**，纯当折叠容器；点击展开/收起，**默认展开**。
- `dashboard`（总览）是**认购模块的总览**（6 轮卡+认购 config+认购 audit），所以归在「认购」下，不是全局首页。未来若需要"全平台首页"，再单独加一个顶层 `home`。
- `admin-users`（管理员管理）治理的是**整个后台**的访问账号（跨所有模块），属平台级，**保持顶层**；未来可收进「系统/平台」一级分组。
- 路由：一级分组无路由；`index` 仍 `NavigateToResource resource="dashboard"`。
- **未来加大模块的最小动作**（示例：结算）：
  ```tsx
  { name: "settlement", meta: { label: "结算", roles: [...] } },           // 一级
  { name: "payouts", list: "/payouts", meta: { label: "出款", parent: "settlement", roles: [...] } }, // 二级
  ```
  Sider 自动多出一个可折叠的「结算」分组，与「认购」并列。

> 删除现有 `users / bets / withdrawals` 资源（后端无此接口，见 README §2 偏差 1）。

**DTO 类型**（`src/types/presale.ts`）— ✅ **已从后端源码确认**：字段 = `oddfi-admin-backend/internal/client/types.go` 的 DTO，即前端收到的**真实 shape**（薄壳 `response.OK(c, out)` 把这些 typed struct 原样序列化）。

> ⚠️ **这是唯一真值，比 `data-model.md` 的 DB 模型字段少很多**。DB 里有、但下面没有的字段 = 后端没透出，前端**拿不到**（如 `name / targetRaiseUsd / anomalyReason / payloadJson / blockNumber / referrer*`）。落地时若要新增字段，**先改后端 `client/types.go` + web-api handler**，不能前端自己假设。

```ts
export type RoundStatus = "upcoming" | "active" | "paused" | "ended";
export interface Round {
  id: string;                 // seed/strategic/ecosystem/public_a/public_b/public_c
  status: RoundStatus;
  priceUsd: string; supplyOdd: string; soldOdd: string; raisedUsd: string;
  startTs: number; endTs: number;          // epoch ms
  minPerOrderUsd: string;     // 可能为 "" / "0"（后端 string，非 null）
  maxPerWalletUsd: string;
  tgeReleasePct: string;      // ⚠️ string（DECIMAL 序列化），不是 number
  linearReleaseDays: number;
  referralRewardPct: string;
  manualOverride: boolean;
  createdAt: number; updatedAt: number;
}
// ⚠️ 后端 RoundItem 不含 name / roundType / targetRaiseUsd / badge / sortOrder。
//    展示名走前端映射；募集进度用 soldOdd/supplyOdd（无 targetRaiseUsd）。
export const ROUND_NAMES: Record<string, string> = {
  seed: "种子轮", strategic: "战略轮", ecosystem: "生态轮",
  public_a: "公募 A 轮", public_b: "公募 B 轮", public_c: "公募 C 轮",
};

export type DepositStatus = "pending" | "confirmed" | "anomaly";
export interface Deposit {
  txHash: string; roundId: string; eoaAddress: string; vaultAddress: string;
  amountUsdt: string; sharesOdd: string; status: DepositStatus;
  blockTs: number;            // ⚠️ blockTs（不是 blockTimestamp），epoch ms
  createdAt: number; updatedAt: number;
}
// ⚠️ 不含 logIndex/blockNumber/priceUsd/referrer*/referralReward*/anomalyReason/source。
export interface MigrateResult {  // migrate-round 响应
  txHash: string; oldRoundId: string; newRoundId: string;
  oldSharesOdd: string; newSharesOdd: string; deposit: Deposit;
}

export interface AnomalyEvent {
  id: number; eventType: string; txHash: string; eoaAddress: string; amountUsdt: string;
  status: "pending" | "notified" | "resolved" | "rejected";
  resolution: string; note: string; operatorId: string;   // resolve 后才有值
  createdAt: number; updatedAt: number;
}
// ⚠️ 不含 payloadJson/depositId/resolvedBy/resolvedAt/resolveNote。

export interface PresaleConfig {
  tgeTs: number; tgeOpenPriceUsd: string; vaultAddress: string; minSubscribeUsd: string;
  boundaryToleranceMin: number; totalTargetUsd: string;
  auditLabel: string; larkWebhookUrl: string; updatedAt: number; // webhook 可能被 mask
}
export interface UpdateConfigResult { config: PresaleConfig; warning?: string; }

export interface AuditLog {
  id: number; operator: string; operatorRole: string; action: string;
  targetType: "round" | "deposit" | "config" | "anomaly"; targetId: string;
  beforeJson: string | null; afterJson: string | null;   // *string，可空
  source: "api" | "script"; ip: string | null; note: string; createdAt: number;
}
```

**分页响应形状**（已确认 `client/types.go`）：
- `rounds`：`{ list, total }` —— **无 page/size，返回全部 6 轮，不分页**（前端不传分页参数）。
- `deposits` / `anomaly` / `audit`：`{ list, total, page, size }` —— 服务端分页，参数 `page` / `size`。
- `admin-users`：`{ list, total, page, page_size }` —— 参数 `page` / `page_size`（api.md §3.6）。

---

## 1. `/login` — Lark 登录入口

- **数据流**：纯客户端。读 `sessionStorage['lark_login_error']`（bootstrap 写入，见 00-architecture §3）按 §02 §4.2 展示文案。
- **组件**：居中卡片 + 「使用 Lark 登录」主按钮 → `authProvider.login()`（整页跳 `/auth/lark/login`）。
- **NOT_ADMIN 特例**：展示独立「未授权」态（不是错误 toast），引导联系超级管理员，**无重试按钮**。
- **样式**：单卡片，无 hero/插画（design-tokens.md）。

## 2. `/dashboard` — 总览

| 区块 | endpoint | 说明 |
|---|---|---|
| 6 轮状态卡 | `GET /admin/presale/rounds`（返回全部 6 轮，不分页） | 每卡：`ROUND_NAMES[id]` + `RoundStatusTag` + 进度（**`soldOdd/supplyOdd`**，无 targetRaiseUsd）+ `raisedUsd` + 时间窗。 |
| config 摘要 | `GET /admin/presale/config` | TGE 时间、金库地址（截断显示）、min_subscribe_usd、容差。 |
| 最近 5 条 audit | `GET /admin/presale/audit?size=5` | operator + action + targetId + 相对时间。 |
| cutover 横幅 | 由 config 派生 | `minSubscribeUsd === "0.01"` → 显示 `CutoverBanner`（见 04-components §3）。 |

- **数据流**：3 个并行 `useList`/`useCustom`，各自 loading。卡片用 AntD `Card` + `Statistic`（负字距已在 vercel.css）。
- **空窗期处理**（seed SQL：5/30–6/1 无 active 轮）：无 active 轮时顶部提示「当前无进行中的轮次」。

## 3. `/rounds` + `/rounds/:id` — 轮次管理

**List**（`useTable` + `<Table>`，refine-conventions）：
- endpoint：`GET /admin/presale/rounds`（**返回全部 6 轮，不分页** → `pagination: { mode: "off" }`，不传 page/size）。
- 列：`ROUND_NAMES[id]`（后端无 name）、`RoundStatusTag`、priceUsd（`AmountText` USD）、soldOdd/supplyOdd、referralRewardPct、时间窗（`formatTs`）、manualOverride（手动干预标记）。
- 行操作 → 跳 `/rounds/:id`。

**Show**（`useShow` + `<Descriptions>` + 操作区）：
- endpoint：`GET /admin/presale/rounds/:id`
- 顶部：`RoundStatusFlow`（状态机可视化，04-components §2）高亮当前 status。
- 操作区（每个按钮 `RoleGuard` + `ConfirmMutationModal`）：

| 按钮 | endpoint | RBAC | 状态机前置 | 模态影响摘要 |
|---|---|---|---|---|
| 暂停 | `POST /rounds/:id/pause` | operator+ | status=active | 「暂停后用户端停止认购入口；链上到账仍会发生（走 paused_arrival）」 |
| 恢复 | `POST /rounds/:id/resume` | operator+ | status=paused | 「恢复 active，用户可继续认购」 |
| 重开 | `POST /rounds/:id/reopen` | operator+ | status=ended | 「重开已结束轮次；end_ts 不变；补仓完成后须手动关闭」 |
| 关闭 | `POST /rounds/:id/close` | operator+ | status∈{active,paused} | 「手动结束本轮，cron 不再自动推进」 |
| 改返佣 | `PATCH /rounds/:id/referral-pct` | operator+ | — | 「仅影响后续入账，历史 deposit 快照不变」+ 数字输入 |
| 改字段（价格/供给/时间窗） | `PATCH /rounds/:id` | **super_admin** | supply≥soldOdd | 「高敏：改价格/供给/时间窗，10/min 限流」+ 多字段表单 |

- 危险操作（pause/close）按钮用 `danger`（红，colorError，design-tokens 允许的既有强调色）。
- 操作成功后 `useShow` invalidate 重新拉，状态机图随之更新。
- 状态机非法转换由后端 `INVALID_STATE_TRANSITION` 兜底；前端**也按 status 预判** disable 不合法按钮（如 ended 轮的"暂停"灰掉），减少无效请求。

## 4. `/deposits` + `/deposits/:txHash` — 入账记录

**List**：
- endpoint：`GET /admin/presale/deposits`，query：`round_id` / `eoa_address` / `status` / `vault_address` / `from_ts` / `to_ts` / `page` / `size`（presale §4.9）。
- 筛选器：顶部 `<Form>` → `setFilters`（round_id 下拉、status 下拉、EOA 文本、时间范围 → from_ts/to_ts epoch ms）。
- 列（仅后端透出的字段）：txHash（`TxHashLink` → BSCscan）、eoaAddress（截断）、roundId（`ROUND_NAMES`）、amountUsdt（`AmountText`）、sharesOdd、status（Tag：confirmed=success / pending=processing / anomaly=error）、blockTs（`formatTs`）。⚠️ `anomalyReason` **后端未透出**，不能做列/筛选展示——异常原因在 `/anomaly` 资源看。
- 分页：服务端 `page`/`size`，默认 20，`syncWithLocation`（URL 带 `?current=&pageSize=`）。

**Show**：
- endpoint：`GET /admin/presale/deposits/:txHash`（id 即 txHash）。
- `<Descriptions>` 展示 `Deposit` 的 10 个字段（无 blockNumber/logIndex/priceUsd/referrer*）。txHash + eoaAddress + vaultAddress 用 `TxHashLink`/截断+复制。
- 操作：**迁移轮次**（`POST /deposits/:txHash/migrate-round`，operator+，高敏 10/min）。`ConfirmMutationModal` 内含 `targetRoundId` 下拉（排除当前轮）+ 强提示「将回滚旧轮持仓并按目标轮价格重算份额，影响 holding」。成功响应 `MigrateResult`（oldRoundId/newRoundId/old/newSharesOdd）→ 展示份额重算前后对比。失败码（源码真值，见 02 §4.4）：`BLOCK_TIMESTAMP_OUT_OF_RANGE`(422) / `MIGRATE_LIMIT_EXCEEDED`(422) 就近展示；「目标轮不存在」后端返 500（用下拉只列合法轮规避）。

## 5. `/anomaly` + `/anomaly/:id` — 异常事件

**List**：
- endpoint：`GET /admin/presale/anomaly`（分页 `page`/`size`），列：id、eventType（Tag）、txHash（`TxHashLink`）、eoaAddress、amountUsdt（`AmountText`）、status（pending/notified/resolved/rejected）、createdAt。
- 默认筛选 `status=pending`（待处理优先）。

**Show**：
- endpoint：`GET /admin/presale/anomaly/:id`。
- 展示 `AnomalyEvent` 字段：eventType / txHash / eoaAddress / amountUsdt / status；已处理的还有 resolution / note / operatorId。⚠️ 后端**未透出 `payloadJson`**（期望轮次/金额上下文拿不到）——只能按 eventType + 链上 tx 人工判断。
- 操作：**处理**（`POST /anomaly/:id/resolve`，**customer_service+**，注意比 migrate 权限低）。`ConfirmMutationModal` 内含 `resolution` 单选（`convert_to_deposit` / `partial_credit` / `reject`）；选 `convert_to_deposit`/`partial_credit` 时显示 `targetRoundId` 下拉（reject 时隐藏）。note 必填。

## 6. `/config` — 全局配置

- **读**：`GET /admin/presale/config`（cs+ 可见）。`<Descriptions>` 展示全字段。
- **⚠️ `larkWebhookUrl` 安全处理**（已确认后端**未实现** README §7 声称的 mask，`GetConfig` 返回明文）：webhook URL 末段 `…/hook/<uuid>` 即推送凭据，而 config 是 cs+ 都能读的。**前端展示前必须自行打码**（仅显示 `…/hook/****`），**且不给该字段加复制按钮**。同时给 backend 提 issue 落实 README §7 的 mask（根因在后端，前端只能缓解）。
- **写**：`PATCH /admin/presale/config`（**super_admin only**，高敏 10/min）。`<Form>` 全字段可选（tgeTs/tgeOpenPriceUsd/vaultAddress/minSubscribeUsd/boundaryToleranceMin/totalTargetUsd/auditLabel/larkWebhookUrl）。
- 保存按钮 `RoleGuard allow=["super_admin"]`；点击走 `ConfirmMutationModal`（note 必填）。
- **响应形状**：`UpdateConfigResult = { config, warning? }`（不是裸 config）。保存后用 `data.config` 刷新表单，`data.warning` 非空时（改 vault_address，presale §4.8）**用 `Modal.warning` 强提示** warning 全文（「env PRESALE_VAULT_POOL 需同步 + 重启 presale-worker 才生效」），不能只 toast 一闪而过。
- 时间字段（tgeTs）用 AntD `DatePicker showTime` + `formatTs` 双向转换 epoch ms ↔ dayjs。
- 金额字段（tgeOpenPriceUsd/minSubscribeUsd/totalTargetUsd）字符串输入，用 AntD Form validator 校验为合法 decimal 字符串（`new Decimal(v)` 不抛错），**不转 number**。

## 7. `/audit` — 操作审计

- endpoint：`GET /admin/presale/audit`，query：`operator` / `action` / `target_type` / `target_id` / `from_ts` / `to_ts` / `page` / `size`（presale §4.12）。
- 列：createdAt（`formatTs`）、operator、operatorRole、action（Tag）、targetType:targetId、note、source（api/script）。
- 展开行：`AuditDiff` 高亮 beforeJson/afterJson（04-components §4）。
- **实时刷新**（brief §七）：`useList` 设 `refetchInterval: 5000`（TanStack Query 轮询）。仅在 audit 页激活时轮询（页面卸载自动停）。新行高亮 1.5s 淡出。
- 过滤器同 deposits 模式（顶部 Form + setFilters）。

## 8. `/admin-users` — 管理员管理（super_admin only）

| 操作 | endpoint | 说明 |
|---|---|---|
| 列表 | `GET /admin/admin-users`（api.md §3.6） | query `page/page_size/role/q`（**注意 page_size 不是 size**）。响应 snake_case：`user_id/name/email/avatar/role/created_by/created_at(RFC3339)`。 |
| 新增 | `POST /admin/admin-users`（§3.7） | create 页表单：`lark_user_id/lark_name/lark_email?/lark_avatar?/role`。`created_by` 后端自动填，前端不传。 |
| 改角色 | `PATCH /admin/admin-users/:lark_user_id/role`（§3.8） | 行内角色下拉 → ConfirmMutationModal。**注意此接口无 note 要求**（非 presale 路由，不经 noteValidator）。 |
| 删除 | `DELETE /admin/admin-users/:lark_user_id`（§3.9） | 行内删除，二次确认。 |

**响应 shape**（snake_case，供 `useCreate`/`useUpdate`/`useDelete` 的 onSuccess 处理）：create 返回完整 `AdminUser`（`user_id/name/email/avatar/role/created_by/created_at(RFC3339)/updated_at`）；改角色返回 `{ updated: true }`；删除返回 `{ deleted: true }`。

- **自删保护 UX**：当前登录用户（`getIdentity().user_id`）那一行的删除按钮 disable + tip「不能删除自己」（后端 `CANNOT_REMOVE_SELF` 兜底）。
- **最后 super_admin 保护 UX**：降级/删除最后一个 super_admin 时后端返 `LAST_SUPER_ADMIN`，模态内报错。前端可选：列表里 super_admin 仅剩 1 个时禁用其降级/删除（需统计当前页+total，简单起见以后端兜底为准 + 友好报错）。
- created_at 是 **RFC3339 字符串**（不是 epoch ms），`formatTs` 需同时支持两种输入。

---

## 9. 通用列表/交互约定（refine-conventions.md）

- 筛选：顶部 `<Form>` + `setFilters`，或 `<Table>` filterDropdown；**禁止**页面里搓自定义筛选 state。
- 分页：默认 20/页，可选 [10,20,50,100]，服务端分页 + `syncWithLocation`。
- 空态：AntD `<Empty>`。加载：`tableProps.loading`（不写额外 Spinner）。
- 金额：一律 `AmountText`/`formatAmount`（decimal.js），**禁止 `toFixed`/`parseFloat`**。
- 时间：一律 `formatTs`（+08:00），epoch ms 与 RFC3339 都支持。
- 链上：txHash/address 一律 `TxHashLink`（BSCscan，BSC 主网 `https://bscscan.com/tx/<hash>` / `/address/<addr>`）。
