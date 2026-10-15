# 06 · 验收 checklist + 开发任务拆解

> 完工口径（dd-flow.md）：`pnpm exec tsc -b` + `pnpm lint` + `pnpm build` 全绿；UI 变更 `pnpm dev` 浏览器走 golden path + 边缘 case，console 无 warning/error。

---

## 1. 验收 checklist（4 角色 × 关键路径，必须逐角色跑）

### 1.1 鉴权 / 会话（所有角色通用）

- [ ] 未登录访问任意页 → 跳 `/login`。
- [ ] 点「Lark 登录」→ 跳 `/auth/lark/login` → Lark 授权 → 回 `/#token=...` → 自动落地 Dashboard，**地址栏 hash 已被抹掉**（无 `#token`）。
- [ ] 白名单外账号登录 → `#error=NOT_ADMIN` → /login 展示「未加入白名单」，无重试按钮。
- [ ] JWT 本地过期 → 任意路由切换跳 /login。
- [ ] API 返 401（TOKEN_EXPIRED/INVALID）→ 清 token + 跳 /login。
- [ ] 退出 → `POST /auth/logout` + 清 token + 跳 /login；用旧 token 再请求 → 401（黑名单生效）。

### 1.2 super_admin（全权限）

- [ ] 7 个菜单全可见（dashboard/rounds/deposits/anomaly/config/audit/admin-users）。
- [ ] 轮次：pause/resume/reopen/close/referral-pct/**改字段(PATCH)** 全可操作，二次确认模态 + note≥10 校验生效。
- [ ] config：可 PATCH；改 vault_address 时 **warning 强提示模态**出现。
- [ ] deposits：可 migrate-round；越界报 `BLOCK_TIMESTAMP_OUT_OF_RANGE`(422)。
- [ ] anomaly：可 resolve（3 种 resolution）。
- [ ] admin-users：可增/改角色/删；**删自己被禁**（CANNOT_REMOVE_SELF）；降级最后一个 super_admin 报 `LAST_SUPER_ADMIN`。
- [ ] audit：5s 实时刷新；自己刚做的操作秒级出现在审计列表。

### 1.3 operator

- [ ] 菜单：dashboard/rounds/deposits/anomaly/config/audit 可见；**admin-users 不可见**。
- [ ] 轮次：pause/resume/reopen/close/referral-pct 可操作；**改字段(PATCH /rounds/:id) 按钮不可见**（super_admin only）。
- [ ] config：可**查看**；**保存按钮不可见**（PATCH super_admin only）。直敲 PATCH → 后端 403 兜底。
- [ ] deposits：可 migrate-round。anomaly：可 resolve。
- [ ] 直接访问 `/admin-users` URL → Forbidden 页（前端）+ 后端 403。

### 1.4 customer_service（只读 + anomaly resolve）

- [ ] 菜单：dashboard/rounds/deposits/anomaly/config/audit 可见；admin-users 不可见。
- [ ] 轮次：**所有状态机/字段/referral 按钮不可见**（只读）。
- [ ] **anomaly resolve 可操作**（cs+ 特例！）。
- [ ] migrate-round 按钮**不可见**（operator+，cs 无）。
- [ ] config 只读，无保存按钮。

### 1.5 finance（本期无预售权限）

- [ ] 登录成功（白名单内）。
- [ ] 预售菜单**全部不可见** → 落「本期无可用模块」空态页，**不白屏**。
- [ ] 直敲任意预售 URL → Forbidden / 后端 403。

### 1.6 数据正确性 / UX

- [ ] 金额全程用 decimal.js 渲染，无 `parseFloat`/精度丢失（抽查大额 `12000000` / 小额 `0.01`）。
- [ ] 时间全部 +08:00；presale epoch ms 与 admin-users RFC3339 都正确显示。
- [ ] txHash/address → BSCscan 正确跳转。
- [ ] 空窗期（无 active 轮）Dashboard 提示正常。
- [ ] cutover 横幅在 `minSubscribeUsd==="0.01"` 时出现。
- [ ] idempotency：模态提交失败 4xx 后改内容重试不报 BODY_MISMATCH（key 已轮换）；网络超时原样重试不重复执行。

---

## 2. 开发任务拆解（按 milestone，每个可独立 ship）

> 依赖顺序：M0 基建 → M1 只读 → M2/M3 mutation → M4 admin-users → M5 打磨。M2/M3 内部可并行（不同 hooks/页）。
> 每个 milestone 一个 `feat/` 分支，波次提交（dd-flow.md），commit 中文、无 Co-Authored-By。

> **进度（2026-05-27）**：M0 ✅ · M1 ✅（均已上 prod）｜ M2 / M3 / M4 / M5 ⬜ 未开始。详见 §5。

### M0 · 基建（阻塞后续全部）✅ 已完成（`af43410`）

```
T01 类型 + 时间插件   建 types/{api,presale,admin-user}.ts；接入 dayjs utc/timezone（无新依赖）；
                     dayjs utc/timezone 插件接入
T02 lib 层           lib/{api,amount,time,jwt,bscscan,schemas}.ts
T03 providers        providers/{dataProvider,authProvider,accessControlProvider}.ts
T04 main.tsx         bootstrapAuthFromHash()（mount 前解析 #token）
T05 App.tsx 重构     替换 resources（删 users/bets/withdrawals，加 presale 7 资源）；
                     <Authenticated> 路由骨架；AdminHeader；Forbidden
T06 RoleGuard        components/RoleGuard.tsx + usePermissionRole hook
验收：能 Lark 登录、Dashboard 空壳、401 跳登录、菜单按角色显隐
```

### M1 · 只读全覆盖（customer_service 完整可用）✅ 已完成（`072bc91`，含白屏/401 修复 `385e460`/`710116f`）

```
T07 rounds list+show（含 RoundStatusTag）
T08 deposits list（筛选器）+ show（含 TxHashLink）
T09 anomaly list+show
T10 config 只读页（GET）
T11 audit list（筛选 + 列）
T12 admin-users list（super_admin，GET）
T13 dashboard（6 轮卡 + config 摘要 + 最近 5 audit + 空窗提示）
验收：1.4 customer_service 全过；1.2 的查看部分过
```

### M2 · 轮次状态机 + 二次确认 + idempotency（operator 可用）⬜ 未开始

```
T14 useIdempotencyKey hook（生命周期）
T15 ConfirmMutationModal（可复用，note 校验 + idempotency 集成）
T16 useRoundActions（pause/resume/reopen/close/referral-pct）
T17 rounds/show 接操作按钮（RoleGuard + 状态预判 disable + danger 红）
验收：operator pause→resume→close 全链路；note<10 拦截；状态机非法转换报错
```

### M3 · 高敏 mutation ⬜ 未开始

```
T18 PATCH /rounds/:id 表单（super_admin，多字段）
T19 useConfigMutation + config PATCH（super_admin，vault warning 强提示）
T20 useDepositActions migrate-round（targetRoundId 下拉，边界报错就近）
T21 useAnomalyActions resolve（resolution 单选 + 条件 targetRoundId）
验收：1.2 super_admin mutation 部分全过；各高敏错误码就近展示
```

### M4 · admin-users CRUD（super_admin 完整）⬜ 未开始（注：`admin-users/create.tsx` 已有 M1 占位骨架，待 M4 接 POST）

```
T22 admin-users create 页（POST，表单 + role 下拉）
T23 行内改角色（PATCH role，无 note）+ 删除（DELETE，二次确认）
T24 自删保护 + 最后 super_admin 保护 UX
验收：1.2 admin-users 全过
```

### M5 · 打磨 + 验收 ⬜ 未开始（T29 deploy.sh + nginx 已提前落地，见下）

```
T25 RoundStatusFlow 状态机可视化
T26 AuditDiff（before/after 高亮）+ audit 5s 实时刷新
T27 CutoverBanner
T28 4 角色全量验收（§1）+ 浏览器 golden path
T29 deploy.sh + nginx vhost（OPS，需 SSH，见 05-deploy）
验收：§1 全部 checklist 通过
```

---

## 3. team:2 review（dd-flow 阶段 4，每个 milestone 完工后）

并行派两个 reviewer（同 message 内两个 Agent，禁串行）：
- `code-reviewer`：hook 依赖、类型安全、Refine 资源/dataProvider 错误处理、死代码、`console.log` 漏网、命名、金额未走 decimal、时间未走 formatTs。
- `security-reviewer`：JWT 存储与 hash 抹除时机、OAuth fragment 解析、route guard 绕过、RBAC 角色判定前端泄漏、idempotency key 生命周期、`dangerouslySetInnerHTML`（AuditDiff JSON 渲染勿用）、XSS、CSP/clickjacking。

每个 reviewer prompt 必传（agent-delegation.md）：仓库根 + 受影响文件清单（`git show HEAD --stat`）+ 硬规则路径（`refine-conventions/design-tokens/lark-oauth/rbac.md`）+ 后端契约 `~/work/oddfi-admin-backend/docs/api.md` + Vercel 设计决策矩阵。

---

## 4. ⚠️ 已知缺口 / 后续 ENH（不阻断上线）

**前端侧缺口 / ENH：**

| 缺口 | 说明 | 建议 |
|---|---|---|
| **无单元测试** | 仓库未装 vitest（testing.md 要求 P0 覆盖 dataProvider/authProvider/RoleGuard/decimal）。 | ENH：上 vitest + testing-library，`test.each` 表驱动覆盖 providers/lib/hooks 纯函数层。**优先 dataProvider 拆包 + idempotency 生命周期 + RoleGuard 4 角色矩阵 + 错误码映射**。 |
| **JWT TTL 可能缩到 2h** | DD-003 R-D3-12，admin logout 黑名单跨服务不可见的缓解。 | 软过期提示可在剩余 <10min 时 toast「登录即将过期」。 |
| **错误码以源码为准，仍须联调抓包** | DTO/casing/idempotency 已从后端源码确认（✅）；错误码已按 web-api 源码修正（02 §4.4）。但 docs 与源码曾脱节，落地仍要抓真实 4xx/5xx 响应再核一遍。 | M0/M2 联调首个 mutation 时抓包核对 code 字符串 + `_replayed` body 字段。 |

**需给 backend（web-api / admin-backend）提的 issue（不阻断前端上线，但影响 UX/安全）：**

| issue | 现状（已确认源码） | 影响 |
|---|---|---|
| **Lark webhook 未 mask** | `presale-admin/README.md §7` 声称响应 mask webhook，但 web-api `GetConfig` 返明文。 | cs+ 可读 config → webhook 凭据泄漏。前端已自行打码缓解，根因仍需后端修。 |
| **2 类失败无专属 4xx 码** | migrate「目标轮不存在」、anomaly「resolution 非法」→ 裸 error → `INTERNAL_ERROR`(500)。 | 前端只能预校验规避 + 500 通用文案，无法精准提示。建议加 4xx 码。 |
| **admin-backend docs 错误码陈旧** | `docs/api.md` / `presale-admin/README.md` 的 4 个 presale 码与 web-api 实现不符。 | 误导后续读 docs 的人。建议同步 docs 到源码真值。 |

---

## 5. 端到端交付摘要（滚动回填）

### 5.1 已交付（截至 2026-05-27，已上 prod `admin.oddfi.io`）

| milestone | commit | 内容 |
|---|---|---|
| M0 基建 | `af43410` | providers / lib / types / 布局 / 鉴权骨架（T01-T06） |
| M1 只读 | `072bc91` | rounds / deposits / anomaly / config / audit / admin-users 列表 + dashboard（T07-T13） |
| 修复 | `385e460` | 未登录 fallback 改 `<Navigate to="/login">`，修白屏 |
| 修复 | `710116f` | 仅会话类 401 才登出，避免 `SERVICE_SIG_INVALID` 误登出 |
| 修复 | （dataProvider） | Refine 6 分页字段 `current`→`currentPage` |
| OPS | `e18730c` | vite 代理 env 驱动 `VITE_PROXY_TARGET`（联调可指 prod） |
| OPS | `1252a22`→`2127f83` | 部署 runbook（`docs/ops/deploy-runbook.md`）+ 一键 `deploy/deploy.sh` + nginx 缓存策略（index.html no-cache / assets 长缓存） |

- **完工口径**：tsc + lint + build 全绿；M1 浏览器 golden path 已走（proxy→prod 真机看到真实数据）。
- **联调状态**：前端→proxy→prod admin-backend→web-api→DB 全链路打通；presale **5 类只读接口全 200**（ISSUE-004 后端修复后，deposits/audit/anomaly 解除阻塞，已真机验证）。

### 5.2 后端协作 issue 收口

- ISSUE-001（webhook 未 mask）→ prod 实测已 mask。
- ISSUE-002 / 003（4xx 码缺失 / docs 漂移）→ 后端已修，错误码字典已对齐（见 02 §4.4）。
- **ISSUE-004（HMAC 验签丢 query）→ 已修复并上 prod（web-api `bbbbaf5` / 镜像 `prod_dd003-v5`），2026-05-27 真机验证通过。**

### 5.3 待办（见 §2 的 M2-M5 + §4 缺口）

- **代码**：M2 轮次状态机写操作 → M3 高敏 mutation → M4 admin-users CRUD → M5 打磨验收。
- **工程缺口**：vitest 引入（testing.md P0：dataProvider/authProvider/RoleGuard/decimal）、CSP nginx 头、路由级 code-splitting、CI（PR 跑 tsc+lint+build）。
- ⚠️ **mutation 前必做**：dev proxy 从 `admin.oddfi.io` 切回本地/staging 后端，写操作不得打 prod。
