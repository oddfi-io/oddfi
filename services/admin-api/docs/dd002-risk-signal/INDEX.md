# DD002 · 管理后台信号灯（赛事风险）— 文档索引

> 一句话：把链上信号灯机制（BettingPool 合约判级 → spider 快照 → web-api）接入管理后台——赛事级风险聚合、四色 KPI、两级风险列表、红灯人工审批闭环。
> 状态（2026-06-06）：三轨开发 ✅ · 联调 A/B ✅ · 合入部署 ✅（admin main + C 端 dev，events 双上游分流态）· **联调 C 进行中** · 实时进度见 [`process/INTEGRATION-STATUS.md`](./process/INTEGRATION-STATUS.md)。

## 目录结构

```
docs/dd002-risk-signal/
├── INDEX.md          ← 本文件（导航）
├── DD.md             ← 方案 v2（唯一权威：架构/契约/判级规约/D1-D7 决策）
├── DISCUSSION.md     ← 决策讨论记录（PRD 冲突仲裁、D1-D7 拍板过程、review 处理）
├── prd/              ← 需求源文件（PRD ×3 + 高保真原型 html）
├── handoff/          ← 跨角色交接（3 份 KICKOFF + 4 份 C 端 OPS 契约）
├── process/          ← 执行过程（任务索引/波次/联调方案 + T01-T08 任务卡）
├── reviews/          ← 双代理 review 报告归档（critic + architect）
└── result/           ← 交付归档（commit 列表/验收记录，完工后回填）
```

## 按角色快速入口

| 你是谁 | 先读 | 然后 |
|---|---|---|
| **管理后台后端**（本仓 T01-T05） | [`handoff/KICKOFF-admin-backend.md`](./handoff/KICKOFF-admin-backend.md) | [`process/README.md`](./process/README.md) → T01-T05 任务卡 |
| **管理后台前端**（oddfi-admin-frontend T06-T08） | [`handoff/KICKOFF-admin-frontend.md`](./handoff/KICKOFF-admin-frontend.md) | T06-T08 任务卡 + `DD.md` §3.4 |
| **C 端后端**（oddfi-backend OPS-01a-d） | [`handoff/KICKOFF-webapi-ops.md`](./handoff/KICKOFF-webapi-ops.md) | OPS-01b → 01a → 01c 契约文件 + `DD.md` §3.1 |
| **PM / 验收** | `DD.md` §2.1（PRD 冲突仲裁）+ §3.6（决策） | [`process/README.md`](./process/README.md) §4 联调 C 验收表 |
| **reviewer / 后来者** | 本文件 → `DD.md` | [`DISCUSSION.md`](./DISCUSSION.md) + `reviews/` |

## 关键文件清单

### 顶层
- [`DD.md`](./DD.md) — 方案 v2：§1 背景 / §2 Research（含数据可得性总表）/ §3 三仓方案 / §3.6 D1-D7 / §4 实施计划
- [`DISCUSSION.md`](./DISCUSSION.md) — 为什么这么定：判级源 maxL vs adjMaxL、队列只收 red、一期不触链上等

### prd/（需求真值源）
- `01. 数据分析看板 PRD.md` — §0.3 / §4 / §7.1 信号灯需求
- `01. Admin_Backend 接口设计V2.md` — §5 / §9 接口定义
- `02. Admin_Forntend 接口设计V2.md` — 前端字段映射
- `0001_Oddfi_Admin_v3.html` — 高保真原型（**交互真值源**，关键行号索引见 DD.md §2.1/§2.2；视觉不采用）

### handoff/（交接 + 运维）
- **`RUNBOOK-dd002-ops.md` — 运维总册（部署拓扑/secret 索引/发版/回滚/排障速查/待办登记）★ 运维入口**
- `RUNBOOK-events-upstream-switch.md` — events 上游切换专项手册（dev ⇄ 生产，一条命令合流）
- [`../../deploy-dev-webapi.md`](../../deploy-dev-webapi.md) — **dev web-api 核心部署规范（团队必读；跨需求，存放于 docs/ 根）**
- `KICKOFF-admin-backend.md` / `KICKOFF-admin-frontend.md` / `KICKOFF-webapi-ops.md` — 三角色启动文件（任务边界/文件夹地图/硬规则/验收出口）
- `DD002-OPS-01a-exposure-snapshot.md` — spider 敞口快照表（含 DDL）
- `DD002-OPS-01b-internal-hmac.md` — web-api internal HMAC 骨架核实/合并
- `DD002-OPS-01c-internal-endpoints.md` — internal 五端点 + admin_risk_decisions 表 + 判级规约
- `DD002-OPS-01d-data-backfill.md` — null 组数据补齐（可后置）

### result/（交付报告）
- `dev-report-admin-backend.md` — 轨道 A 开发报告（T01-T05 + review 处理对照）
- `RESULT-frontend.md` — 轨道 B 交付报告（T06-T08 + 联调 A）
- 轨道 C 交付报告在 oddfi-backend 仓：`docs/dd002-risk-signal/result/RESULT-webapi-ops.md`（含 §7 部署验收 / §8 internal 改绑记录）
- `README.md` — 归档模板（完工 commit 链 / 联调记录 / 签收，Step 5 收尾时回填）

### process/（执行）
- [`INTEGRATION-STATUS.md`](./process/INTEGRATION-STATUS.md) — **联调进度看板（联调期间唯一进度真值源，统筹方维护）**：Step 0-5 状态 / 合入顺序门禁 / 各步 checklist / 完成记录
- [`README.md`](./process/README.md) — 任务索引 + 依赖图 + **统一执行波次（W0-W7）** + **三段联调方案（A/B/C + checklist）**
- `DD002-T01..T05` — 后端任务卡（errcode/proxy/counts/路由 RBAC/api 文档）
- `DD002-T06..T08` — 前端任务卡（地基/列表页/弹窗 badge）

### reviews/
- `review-01-critic-prd-html.md` — 方案期：PRD/原型一致性 review（判 REVISE → 已并入 DD.md v2）
- `review-02-architect-feasibility.md` — 方案期：代码可行性 review（C-Data-1/2、C-Arch-1 → 转 OPS-01a/b + D7）
- `review-03-fe-code.md` / `review-04-fe-security.md` — 前端实现期双代理 review（REQUEST CHANGES→已修 / LOW 无可利用漏洞）

## 关联

- 接口契约（开发期同步）：`docs/api.md` §3.12（T05 产出）
- 本仓既有模式：`docs/presale-ops-enhancements/`（REQ-004 三方交付参照）
- 项目规则：`.claude/rules/{rbac,api-conventions,api-docs-required,dd-flow}.md`
