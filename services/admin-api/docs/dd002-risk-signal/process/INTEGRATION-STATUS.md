# DD002 · 联调进度看板（INTEGRATION-STATUS）

> 用法：任一轨道完成一项后把结果报给统筹方（主会话），由统筹方更新本文档并发出下一步指令。**本文件是联调期间唯一进度真值源**，状态只由统筹方改。
> 关联：联调 checklist 详情见 [`README.md`](./README.md) §4；三仓 review 报告见 [`../reviews/`](../reviews/)；交付报告见 [`../result/`](../result/)。

---

## 📍 当前状态（统筹方维护）

- **当前步骤**：Step 4 · 联调 C 就绪，**等前端启动**（dev 端到端验收）
- **下一步行动**：前端本地 dev server（localhost:5173，CORS 已临时放行）对生产 admin API 跑联调 C checklist → PM 签收 → Step 5 前端合入部署 + 收尾归档；并行：跟 C 端排期「DD002 发版生产」（events 生产可用最终前置，RUNBOOK 已备好切换手册）
- **最后更新**：2026-06-06 · **环境错位已用「events 专用上游覆盖」机制解决**（用户拍板）：生产 admin 单实例双上游分流验证通过（presale→生产 200 / events→dev 200 真数据 / counts 200）

## 三仓基线（统筹 review 时点）

| 轨道 | 仓库 @ 分支 | 头 commit | review 结论 |
|---|---|---|---|
| A 管理后台后端 | oddfi-admin-backend @ feat/risk-signal | `dc2fbff` | APPROVE（契约 8 项 ✅，vet/test/build 绿） |
| B 管理后台前端 | oddfi-admin-frontend @ feat/risk-signal | `c7496c8` | APPROVE（契约 22✅/2⚠️ 已兜底，517 测试绿，T07 交互 12/12） |
| C 主后端 | oddfi-backend @ feat/dd002-risk-signal（worktree，**未 push**） | `403ad03` | APPROVE（互通三硬判定 HMAC/路径/壳全 ✅，判级单测全覆盖） |

---

## 总流程一览

| 步骤 | 内容 | 主导 | 状态 |
|---|---|---|---|
| **Step 0** | 微修三处 | 各仓 | ✅ |
| **Step 1** | 联调 A：前端 ↔ admin-backend（本地，mock 上游，全分支态） | 前端 | ✅ 7/7 |
| **Step 2** | 联调 B：admin-backend ↔ web-api（**对 dev 真上游，SSH 隧道**，admin 合入前契约清零） | admin 后端 | ✅ 通过 |
| **Step 3** | 合入 + 部署：① C 端 ✅ ② admin-backend ✅（合入+生产部署+回归零破坏） | 统筹 | ✅ |
| **Step 4** | 联调 C：dev 端到端验收（生产 admin 双上游分流态） | 前端 | 🔄 就绪待启动 |
| **Step 5** | 前端合入 + 部署 + 三仓 result 回填归档 | 统筹 | ⬜ |

> 原则：**前端为主、契约先行、分支先联调后合入**。最终验收以前端 golden path 为准，但接口层 diff 必须在 curl 层清零后才让前端对真上游。

---

## Step 0 · 微修（进行中）

| # | 事项 | 仓 | 状态 |
|---|---|---|---|
| 0-1 | `docs/api.md` §3.12 list query 表补登 `pending_decision` 参数（web-api 已实现，扶正前端"幽灵参数"；FE-OPS-3 随之关闭） | admin-backend | ✅ `2447d0f` |
| 0-2 | `sport` 口径对齐：已选「api.md 加注」路径——sport 恒足球 + 第三方赔率仅 1X2 两条口径注记（C 端 RESULT §4 声明，前端勿按 sport 分支） | admin-backend docs | ✅ `2447d0f` |
| 0-3 | `useRiskDecision` 给 UPSTREAM_UNAVAILABLE 走"可重试"路径补注释 | admin-frontend | ✅ `e02f3c1` |

登记不修（已知边界，进 RESULT）：client `isRetryable` 死代码；前端 remark minLength=10（严于契约，UX 收紧）；universe 全量无上限（容量边界=当前赛事量级）；50 事件 p95 转 Step 2 验收项。

**出口标准**：三项 commit 完成并报回。

---

## Step 1 · 联调 A（前端 ↔ admin-backend，本地 mock）

环境（全分支态，零外部依赖）：

```bash
# admin-backend 仓 feat/risk-signal
go run ./cmd/mock-webapi          # :9090（8 事件夹具 + decision 内存状态机）
go run cmd/server/main.go         # :8081（config 上游指 :9090）
# admin-frontend 仓 feat/risk-signal
npm run dev                       # :5173
```

checklist（详版见 [`README.md`](./README.md) §4 联调 A；浏览器部分人工 = 原 FE-OPS-1）：

- [ ] 信封/分页/`,string`/逗号多值透传（network 面板核形态）
- [ ] 四角色 RBAC 实测（finance/customer_service 决策按钮不可见且 API 403）
- [ ] 决策闭环：决策→退队→badge−1→行内降级 orange；重复决策 CONFLICT；非红灯 EVENT_NOT_RED_SIGNAL
- [ ] 停 mock：badge 保持上次值不弹错；恢复后自愈
- [ ] null 组「—」、未开盘置灰、settled 卡替换、时间线 hover、KPI 联动（绿黄落 all）、橙 Tab 含红
- [ ] 红灯重升夹具（e5）重新入队
- [ ] 浏览器 golden path 人工过一遍（登录→列表→展开→调整历史→审批→决策）

**出口标准**：checklist 全勾；发现的问题修复 commit 报回。
**完成记录（2026-06-06 · 前端侧执行，7/7 全过）**：
- 验证方式：curl + 浏览器 network 双核 + **headless Chrome 自动化 25 项断言**（登录态→列表→展开→调整历史→审批→决策 golden path）
- 联调发现并修复 3 处（修复后 527 测试 + tsc/lint/build 全绿）：
  - `d7c8dfc` schema diff①：odds_diff/adjust_ratio 实为 number → 补符号/百分比格式化
  - `25a63b0` schema diff②（浏览器才抓到的崩树级）：score 是 `{home,away}` 对象，直接渲染崩 React 树 → formatScore
  - `e4f09a8` 浏览器实测③：`setFilters([],"replace")` 清不掉筛选致「落 all」失效 → merge+undefined 移除语义；默认分页 10→20 对齐规范；summary 轮询失败改静默保持旧值
- 已知边界（不阻塞，登记）：停 mock 时列表主数据页面级 503 提示保留（仅 badge/summary/counts 静默）；上游中断时 ky GET 重试 × TanStack 重试叠加可能瞬时触发限流 429（恢复后自愈，可作 ENH 调 retry 配置）
- 前端分支 commit 链共 9 个（`2245a45..e4f09a8`），**已批准 push 远端备份（不开 PR 不合入，合入等 Step 4 验收后）**

---

## Step 2 · 联调 B（admin-backend ↔ web-api 真上游，admin 合入前）

环境（已升级：C 端已部署 dev，**不再本地起 web-api**，改 SSH 隧道直连真上游）：

```bash
ssh -N -L 8082:127.0.0.1:8082 oddfi-dev   # 隧道：本地 8082 → dev internal listener
# admin-backend 本地 config.yaml：webapi.internal_url 指 http://127.0.0.1:8082
#（service_token 已配好，与 dev 主机 ~/oddfi-secrets/web-api-runtime.env 一致——C 端 RESULT §3/§6）
go run cmd/server/main.go                  # :8081，分支 feat/risk-signal
```

- [x] `docs/risk-signal-curl.md` 契约集通过（summary/list/detail/adjust-history/decision 非红分支/counts + 404/400/401/403/缺幂等 400 全部命中预期）
- [x] 真实响应 vs mock 夹具 schema diff 清零（list 壳 + 行 18 字段逐一对上；event_id=str、signal 字符串枚举、sport=足球、null 组恒 null、adjust-history `{list,total}` 壳 + source=Auto）
- [x] HMAC 负向：直打 8082 无鉴权 → 401、假 X-Service-Sig → 401（篡改 body/过期 ts/错 secret 由 C 端 dev 17/17 已实签实测）
- [x] 决策状态机真库：非红分支 ✅（EVENT_NOT_RED_SIGNAL 200 业务壳）；**成功/CONFLICT/红灯重升分支转移核销**——dev 当前 50 事件全绿无红灯，数据条件不具备（逻辑已被 mock 状态机演练 + C 端单测 + 联调 A 浏览器实操三层覆盖）→ 并入联调 C 数据预热后回验
- [x] `signal=red` 绕缓存：连续两次均 ~149ms 现算（非缓存命中形态）
- [x] 50 事件 list p95 实测 **280ms** < 500ms（n=20，min=119 / p50=234 / max=313ms，含 SSH 隧道 RTT ~120ms 底噪；剔除隧道后与 C 端本机 39ms 量级吻合）

**完成记录（2026-06-06 · 统筹执行，通过）**：
- 环境：`ssh -N -L 8082` 隧道 → admin-server 本地 :8081（`WEBAPI_INTERNAL_URL=http://127.0.0.1:8082` env 覆盖，token 走 config）→ dev-token 三角色实签
- 真数据快照：50 事件（49 绿 + 1 未开盘），detail 第三方赔率 1X2 已回填（`4.07 Bookmaker#20`——ID 20 显示名待运营确认，口径符合 RESULT §4-3）
- 新增观察项（轻微不阻断）：`sort_by=bet` 降序时未开盘 null 行排最前 → 建议 web-api 后续把 null 排末尾（UX 向，登记 ENH）
- 联调后环境已清理（本地 server + 隧道）；config.yaml 的 `webapi.base_url` 仍指公网 IP，**部署 admin-server 时需配 dev 内网可达地址或反代**（Step 3② 部署事项）

---

## Step 3 · 合入 + 部署 dev（合入顺序硬约束）

```
① oddfi-backend：feat/dd002-risk-signal → push → 合入 dev
   🔴 门禁：必须确认合入的是 46f5c18 这版（HMAC 验签覆盖 query）。
            绝不能误用 presale-impl 旧骨架（只签 Path，带参 GET 全 401）。
   部署内部顺序：spider migration（market_exposure_snapshot 建表）
              → 部署 spider（开始积累敞口快照）
              → 部署 web-api（internal_port=8082 + env 三件套 + /internal 仅放行 admin-server IP）
② admin-backend：feat/risk-signal → squash merge main → 部署 admin-server
   （config webapi.internal_url 指 C 端内网地址，service token 两侧对齐）
③ admin-frontend：⚠️ 此步不合，等 Step 4 验收通过
```

- [x] ① C 端 push + 合入 dev + migration + spider + web-api 部署（2026-06-05，提前于 Step 1/2 完成）
- [x] 部署 checklist：internal 127.0.0.1:8082（host network 回环）/ ServiceTokens / JWTSecret（`~/oddfi-secrets/` 600）/ 公网不可达 四件全落位
- [x] ②-前置 网络通路方案 a（internal 0.0.0.0 + SG 白名单）：主站后端侧 ✅（2026-06-06）——config `948c86a` 推 dev、镜像 dev-dd002 重建切换（二进制层未变）、自验 3/3（回环 401 / 绑定 *:8082 / 公网 000）+ 回归 2/2（公网 :80 200、回滚锚点未动）、部署记录 RESULT §8 `1260510`；**AWS SG 白名单（<SERVER_IP>/32 → 8082）待权限负责人配置** ⏳
- [x] ②-跨机核验（2026-06-06）：SG 白名单生效——admin-server→8082 = 401（通路开+鉴权挡）✅ 非白名单公网→8082 = 000 ✅ 主站 :80 = 200 ✅
- [x] ② admin-backend 合入 main `20eb679`（squash 11 commits，已 push）+ 合并后全量回归 10 包 ok + 部署生产 admin-server（binary 替换，回滚备份 `.bak-pre-dd002`）
- [x] ②-部署后回归：presale 实签 200（**生产零破坏**）/ events 路由 401 正常 / events 实签 → 上游 404（生产 web-api 无 DD002 端点，预期形态，见下）

**✅ 环境错位解决方案（用户拍板：做成正式可切换机制，弃 :8083 双实例）**：
- 机制：`WEBAPI_EVENTS_INTERNAL_URL/SERVICE_TOKEN` env 覆盖（main `710ba33`）——events/counts 走专用 client，任一为空回落主上游；**切生产 = 删两行 env + restart**，单测锁死回落语义；切换手册 [`../handoff/RUNBOOK-events-upstream-switch.md`](../handoff/RUNBOOK-events-upstream-switch.md)
- 落地验证（2026-06-06）：生产 admin-server 部署 + env 注入 → presale(生产上游) 200 / events(dev 上游) 200 真数据（52 事件）/ counts 200
- 排障记录：① dev web-api 的 `ADMIN_API_JWT_SECRET` 是联调 B 本地套 → 已对齐生产 admin 套；② `docker restart` 不重读 env-file → 走 `deploy-web-api.sh` 标准脚本重建容器（已登记 DEPLOY_LOG）；③ **dev 环境漂移发现**：登记簿显示 dd002 镜像曾被同事未登记部署顶掉（丢 ADMIN env、8082 断过），现役 `dev-lp-matchinfo` 含 DD002 代码——dev 共享环境，联调 C 期间若 8082 再断先查 DEPLOY_LOG
- 挂账项①顺手核销：链上新事件后 `max_event_exposure=217.00` 非 null → **敞口快照已开始落表**（与链上逐字段核对仍留联调 C）
- CORS：生产临时放行 `http://localhost:5173`（联调 C 用，**验收后移除**——Step 5 收尾清单）

**（原始发现记录）Step 3② 环境错位（统筹 2026-06-06）**：
- 事实：`admin-api.oddfi.io`（生产 admin-backend 的 WEBAPI 上游）→ <SERVER_IP> = **C 端生产机**；DD002 轨道 C 部署在 **C 端 dev**（<SERVER_IP>）。生产 env 的 token 与 dev 套不同（指纹比对确认）。
- 约束：不能改生产 env 的 WEBAPI 两值——presale proxy 正在生产使用同一上游，切到 dev = 破坏现网。
- 当前生产 events 形态：接口可达但上游 404（`INTERNAL_ERROR upstream error (HTTP 404)`）——前端生产无 events 页面，无人调用，可接受的中间态。
- **三步走**：① 生产 binary 先行（✅ 已完成，本次）② 联调 C 用 admin-server 临时 dev 实例 :8083（同 binary，仅覆盖 WEBAPI 两值指 dev 8082，与生产共用 JWT/DB/Lark → SSO/RBAC 真实链路；验收完即停）**待用户确认** ③ C 端把 DD002 发版生产 + 生产开 internal/token → 恢复单上游，events 生产可用（**需 C 端排期，新增 OPS 事项**）
- [ ] dev 上 curl 契约集全绿（并入 Step 2，隧道直打 dev 即同一动作）

**完成记录（① C 端）**：
- 合入链：dev `1b40608`（主体）→ `b70d769`（端口）→ `fa4b8d6`（热修）→ `67877e7`（验收记录）
- 部署：web-api `hankdong/web-api:dev-dd002` @ oddfi-dev；spider `hankdong/web-spider:dev-dd002` @ oddfi-market-dev；回滚锚点 *-old 容器保留（RESULT §7 一条命令回滚）
- C 端自验 17/17 通过（鉴权矩阵 / 五端点真数据 / 契约细节 / 公网回归 / p95=39ms）
- **统筹独立验收（2026-06-05）6/6 通过**：① dev 合并链与本地 dev 分支一致 ✅ ② 本地全量回归 web-api 4 包 + spider 全 `ok` ✅ ③ oddfi-dev 容器 Up + 8082 仅绑 127.0.0.1 ✅ ④ internal 端点无鉴权 → 401（注册+鉴权生效）✅ ⑤ 公网直打 :8082 不可达（000）、/health 200 ✅ ⑥ market-dev spider 容器 Up ✅
- 部署热修 `fa4b8d6`：`signal` 为 MySQL 8 保留字（裸列名 1064 → detail/adjust-history 500），单测 fake repo 盲区——教训：repo 层新 SQL 上线前真库冒烟

**Step 3① 挂账项（不阻塞，后续核销）**：
- [x] 敞口快照落表观察：✅ 已确认落表生效（2026-06-06 链上新事件后 max_event_exposure=217.00 非 null，判级链路在用 stake 数据）；与链上逐字段一致性核对留联调 C 顺带
- [ ] *-old 回滚容器/旧镜像：稳定 1-2 天后清理（≈2026-06-07）

**C 端 RESULT §4 口径声明（影响前端/PM 预期，已确认 admin 侧无需改代码）**：
- summary 四色按**展示信号**计数（red 已决策计入 orange，与 mock e7 一致）
- 第三方赔率**仅 1X2** 回填，让球/大小暂 null（盘口线对齐无证据，防误导）；bookmaker ID 20 显示名待运营确认
- 存量盘（无 stake 快照）判级回退链上 signal；增量盘自动转本地判级
- sport 恒「足球」（多运动接入后映射）→ Step 0-2 仅剩 api.md 加注

---

## Step 4 · 联调 C（dev 端到端验收，前端主导）

⚠️ **数据预热提醒**：`market_exposure_snapshot` 不回填历史，spider 部署后只有新 `OddsUpdated` 事件才落数据。初期部分 market 敞口/方向灯为空属预期——按「快照覆盖率」观察，不当 bug 报；可主动触发赔率变更预热。

- [ ] Lark SSO 真登录，四角色账号各过菜单可见性 + 操作权限
- [ ] 红灯端到端时效实测 ≤ 90s（合约→spider→聚合→badge）
- [ ] 审批闭环演练：红灯→铃铛红点→决策（强制 remark）→消红点→audit 留痕（decided_by=JWT 身份）
- [ ] 红灯重升重入队真环境验证
- [ ] 前端 golden path 全流程（真数据）
- [ ] PM 验收签收（含 D6 null 字段「待 OPS-01d 点亮」预期说明）

**出口标准**：PM 签收。
**完成记录**：_待回填_

---

## Step 5 · 收尾归档

- [ ] admin-frontend feat/risk-signal → squash merge main → 部署
- [ ] 移除生产 CORS 临时放行 localhost:5173（联调 C 专用）
- [ ] 跟 C 端排期：DD002 发版生产 + 生产 internal 通路（RUNBOOK 前置确认 4 条）→ 完成后删 WEBAPI_EVENTS_* 两行 env 合流
- [ ] 三仓 `result/` 回填：完整 commit 链、联调 A/B/C 记录、签收表
- [ ] `process/README.md` 状态表全 ✅；本文档状态置「已完成」
- [ ] OPS-01d 排期留口登记（lp_pool 口径问题 → 产品/合约侧）
- [ ] 可选 ENH 登记：WS 推送替代轮询、依赖 CVE 升级（FE-ENH-1）

---

## 变更日志

| 日期 | 事件 |
|---|---|
| 2026-06-06 | **🚨 事故 #2（同类复发）·已修复**：events 全线 503——herongwei `account-web-api:dev_0606_2` **未登记部署**（11:53Z 前后）裸跑顶掉容器，丢 `ADMIN_API_*` 两 env → 8082 断。按 RUNBOOK §4 第一条 5 分钟定位；同镜像走 `deploy-web-api.sh` 重建补回 env（**未动同事代码**，其镜像已含 DD002）。实签验证 summary 真数据 52 事件 / list 200 / presale 回归 200。**待办：再次向团队同步"换容器必须走脚本"** |
| 2026-06-06 | **环境错位机制化解决（用户拍板）**：events 专用上游覆盖上线（main 710ba33+2dd2eca），生产双上游分流验证通过；dev web-api JWT secret 对齐 + 标准脚本重建；发现 dev 环境漂移（未登记部署顶掉事件，DEPLOY_LOG 制度已立）；敞口落表挂账项核销；CORS 临时放行 5173。**Step 4 联调 C 就绪** |
| 2026-06-05 | 统筹 review 三仓全 APPROVE（reviews/ 05-07 待归档编号沿用本看板基线表）；联调流程启动，进入 Step 0 |
| 2026-06-05 | **C 端提前完成 Step 3①**：合入 dev（1b40608..67877e7）+ 双机部署 + 自验 17/17；部署热修 fa4b8d6（signal 保留字）。统筹独立验收 6/6 通过。Step 2 环境升级为 SSH 隧道直连 dev；Step 0-2 简化为 api.md 加注；新增挂账 2 项（敞口落表观察 / 回滚锚点清理） |
| 2026-06-06 | **Step 3② 全部完成**：SG 白名单（PM 配置，launch-wizard-5）+ 跨机核验 3/3 → squash merge main 20eb679 + push → 生产部署（回滚备份留存）→ presale 回归 200 零破坏。**发现环境错位**（admin 生产上游=C 端生产 ≠ DD002 所在 dev），三步走方案待确认 |
| 2026-06-06 | **方案 a 指令一完成（主站后端侧）**：internal_host 改绑 0.0.0.0（948c86a + 镜像重建切换），自验 3/3 + 主站零影响回归 2/2；动手前实测无公网裸奔窗口（SG 默认拒绝兜底）。等 AWS SG 白名单后跨机核验 |
| 2026-06-06 | **联调 B 通过（统筹执行）**：隧道直连 dev 真上游，契约集/schema diff/HMAC 负向/red 绕缓存/p95=280ms 全过；决策成功分支因 dev 无红灯转联调 C 回验；新增观察项 bet 排序 null 居首（ENH 登记）。**进入 Step 3② 等合入确认** |
| 2026-06-06 | **Step 0 全清 + 联调 A 完成（7/7）**：前端 0-3 注释 e02f3c1；headless Chrome 25 项断言全过；联调修复 3 处（d7c8dfc/25a63b0/e4f09a8，含 score 对象崩树、setFilters replace 失效两个真 bug）；前端分支 9 commits 批准 push 备份不合入。进入 Step 2 联调 B（统筹执行） |
