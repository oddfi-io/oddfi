# 前端交付报告 · REQ-002 / REQ-004

**仓库**: `oddfi-admin-frontend`
**分支**: 已合并 `main` 并部署上线（HEAD `3c3b4d7`，线上 bundle `index-BnrA_9vt.js`）
**日期**: 2026-05-29
**负责人**: admin-frontend agent
**状态**: ✅ 代码完成、已部署、静态验证全绿；⏳ super_admin 浏览器复测

---

## ⚠️ 重要勘误（2026-05-29 补）：note 必填 ≥10 字，非选填

本报告初版（下文 §"两处与需求文档默认假设不同"第 2 点）**错误地**写了"note 选填、无 ≥10 校验"。
实际：`router.go` 给**所有 presale 写接口**（含 KOL POST/PATCH/DELETE）挂了 `noteValidatorMW`，
**强制 note ≥10 runes，且 DELETE 也必须带 JSON body（含 note）**，否则 400（`NOTE_REQUIRED` / `INVALID_PARAM`）。

- 该错误导致前端首版把 note 当选填 → 同事测试新增（备注"测试"2 字）报 400 `NOTE_REQUIRED`，前端误显示为"服务异常"。
- 已修复（commit `3c3b4d7`）：新增/编辑表单备注必填 ≥10；删除走带备注确认框；DELETE 带 `{note}` body。
- **遗留约束提醒后端**：KOL 的 `note` 字段是**单字段双用途** —— 既被 web-api 存为 KOL 记录备注，又被 `noteValidatorMW` 当审计备注校验（≥10）。即 REQ-004 原设想的"备注可选、≤200"在当前中间件下**不成立**，备注事实上必填 ≥10。若产品要让 KOL 备注真可选，需后端把 KOL 路由从 `noteValidatorMW` 摘出（届时知会前端同步放开校验）。

---

## 一句话结论

REQ-002（菜单文案 + EOA 全量展示）、REQ-004（KOL 特殊返佣 Tab）两个需求前端已全部实现并自测通过。REQ-004 已按 admin-backend 既有接口对接完成，**web-api（Step 2）一旦就绪即可直接联调**，无需前端再改结构。

---

## REQ-002 — 管理后台 UI 微调

| 项 | 改动 | 文件 |
|----|------|------|
| A. 菜单文案 | 「全局配置」→「金库及TGE配置」（侧边栏 + 页面标题同步） | `src/App.tsx`、`src/pages/config/index.tsx` |
| B. EOA 全量展示 | 入账记录 EOA 列改为完整 42 位（采用文档推荐方案 1：给 `TxHashLink` 加 `truncate` prop） | `src/components/TxHashLink.tsx`、`src/pages/deposits/list.tsx` |

- `TxHashLink` 新增 `truncate?: boolean`（默认 `true`，**向后兼容**，其余调用点不受影响）；EOA 列传 `truncate={false}`。
- TxHash 列**保持截断**（按验收要求未动）。
- 验收 4 项全部满足。

**Commit**: `b8b73a8`

---

## REQ-004 — KOL 特殊返佣 Tab

在「认购」菜单下「操作审计」之后新增「特殊返佣」入口（路由 `/kol-referral`），提供 KOL 自定义返佣比例的 CRUD。

### 对接的后端接口（已核对源码确认契约）

| Method | Path | RBAC | 前端落地 |
|--------|------|------|---------|
| GET | `/admin/presale/kol-referral?eoa=&page=&size=` | 全角色 | `useTable` 列表 + EOA 模糊搜索 |
| POST | `/admin/presale/kol-referral` | super_admin | 新增弹窗 |
| PATCH | `/admin/presale/kol-referral/:eoa` | super_admin | 编辑弹窗（EOA 只读） |
| DELETE | `/admin/presale/kol-referral/:eoa` | super_admin | 二次确认删除 |

### ⚠️ 两处与需求文档默认假设不同（已读后端源码后按真实契约实现）

1. **无幂等中间件**：KOL 路由只挂 `auditMW`，不像 deposit/config 那样有 `requireIdempotencyKey` → 前端**不发** `X-Idempotency-Key` 头。
2. **`note` 选填、无 ≥10 字校验**：故前端用普通 `Modal + Form`，**不套** `ConfirmMutationModal`（那是给"必填审计备注 ≥10 字"的高敏操作用的）。

> 这两点是源码实测结论（`internal/handler/presale_kol_referral.go` + `internal/router/presale_routes.go`），与 admin-backend 当前实现一致。**若后端后续要给 KOL 写操作加幂等/强制备注，请提前知会前端同步改。**

### 实现要点

- 列表列：EOA（全量 + bscscan 链接）、返佣比例（`8.00%`）、备注、操作人、更新时间、操作。
- 返佣比例：`InputNumber stringMode` 0–100、`decimal.js` 格式化，**全程 string 不数字化**（与后端 `shopspring/decimal` 对齐）。
- 增删改按钮：`RoleGuard allow={["super_admin"]}`；后端 `RoleRequired("super_admin")` 兜底。

**Commit**: `417498b`

### 🟡 需总统筹/后端确认的一个 RBAC 取舍

- 后端 `GET /admin/presale/kol-referral` 放行**全部 4 角色（含 finance）**。
- 但前端 finance 角色**本就没有任何"认购"模块入口**（presale 父菜单用 `R_VIEW = super_admin/operator/customer_service`，finance 登录后落空态页）。
- 为与"认购"下其它页保持一致，前端把「特殊返佣」也设为 `R_VIEW`。**结果：finance 看不到该 Tab。**
- **若产品要求 finance 也能查看 KOL 返佣**，需要调整整个"认购"父级的角色范围（牵连总览/轮次/入账等所有页），属于跨页决策 —— **请确认是否需要，需要的话我另开处理。**

---

## 验证结果（静态）

| 检查 | 结果 |
|------|------|
| `pnpm type-check` | ✅ 通过 |
| `pnpm lint` | ✅ 通过 |
| `pnpm test` | ✅ **457 passed**（原 443 + 新增 14：TxHashLink 4 / KOL hook 9 / dataProvider 路径 1） |
| `pnpm build` | ✅ 成功（chunk-size 警告为既有问题，与本次无关） |

## ⏳ 待办（不阻断验收，需人工/联调）

1. **浏览器实测**：自动环境无法驱动浏览器 + 联调后端，golden path 未跑。建议本地 `pnpm dev` 验证：① 菜单文案 ② EOA 全量 ③ KOL Tab 增删改 + 角色可见性。
2. **web-api 联调（Step 2）**：web-api 侧逻辑就绪后做端到端联调；前端结构已 ready，预计无需改动。

---

## 改动文件清单（12 文件，+578/−5）

```
 src/App.tsx                              # 菜单文案 + KOL resource/route
 src/pages/config/index.tsx              # 页面标题
 src/components/TxHashLink.tsx           # truncate prop
 src/components/TxHashLink.test.tsx      # 新增
 src/pages/deposits/list.tsx             # EOA truncate={false}
 src/pages/kol-referral/list.tsx         # 新增（列表+搜索+弹窗+删除）
 src/hooks/useKolReferralActions.ts      # 新增（POST/PATCH/DELETE 薄壳）
 src/hooks/useKolReferralActions.test.ts # 新增
 src/types/presale.ts                    # KolReferral 类型
 src/lib/rbac.ts                         # RESOURCE_ROLES 注册
 src/providers/dataProvider.ts           # kol-referral 路径
 src/providers/dataProvider.test.ts      # 路径用例
```
