# DD002: 管理后台信号灯（赛事风险）功能 — 前后端方案

**Date**: 2026-06-05
**Version**: v2（已并入 team:2 review 修订：critic=PRD/HTML 一致性 + architect=代码可行性）
**Branch**: feat/risk-signal（待开发时创建）
**Status**: Draft v2 · D1-D7 已全部拍板（2026-06-05）：D2=一期落库+状态翻转、D4=队列只收 red、D7=spider 落 market_exposure_snapshot；其余 D1/D3/D5/D6 按方案建议。待整体确认后进入阶段 2 拆 task
**PRD 来源**: `Admin V3.zip` → 数据分析看板 PRD §0.3 / §4 / §7.1，Admin_Backend 接口设计 V2 §5 / §9.1-9.2，高保真原型 `0001_Oddfi_Admin_v3.html`

> v2 变更摘要：① 判级源修正为方向级 maxL（C-PRD-1）；② 数据可得性逐字段核实，新增 C 端落库前置（C-Data-1/2）；③ risk-decision 决策态状态机补全（H-PRD-2）；④ 前端交互 checklist 补全 + 4 色风格边界（H-PRD-3/H-STYLE-1）；⑤ OPS-01 拆三段（C-Arch-1）；⑥ D4 重写论证依据（H-PRD-1）。

---

## 1. 背景与范围

### 1.1 信号灯机制现状（调研结论）

| 层 | 现状 | 关键位置 |
|---|---|---|
| **判级真值源** | BettingPool 合约按"最坏亏损 L"自治判级，`signal uint8`：0=绿 ≤$8k / 1=黄 ≤$18k / 2=橙 ≤$28k / 3=红 >$28k（红灯合约自动停止接单）。链下 odds-engine 有同阈值镜像常量（`oddfi-odds-engine/internal/engine/calc.go:10-16`），但 worker 已注释、不在线 | 合约 + calc.go |
| **数据搬运** | spider 3 秒轮询 `OddsUpdated` 事件 → 解码 signal/quoteVersion → 落 `market_odds_snapshot`（每次变更一条）+ 同步 `oddfi_onchain_markets.signal` + Redis Pub/Sub。⚠️ 快照只有 odds JSON + signal，**不含每方向 totalStake**；链上 `TotalStakedByOutcome` 在 spider 里用完即弃不落库（`onchain_market_svc.go:308-327`） | `oddfi-web-spider/service/odds_updated_consumer.go` |
| **web-api 输出** | ① `GET /market/onchain` 输出 `signal *uint8`（读快照，不重算）② `POST /market/:id/preview-signal` 实时链读。**`/admin` 前缀目前只有提现审批**。⚠️ presale internal HMAC 中间件（`service_auth.go`）尚在 worktree `presale-impl`，**未合并主干 dev** | `web-api/internal/handler/market.go` |
| **C 端前端** | WS 推送 + REST 预览双路径，完全信任后端 signal，无本地判级 | `oddfi-frontend/stores/onchainOddsStore.ts` 等 |
| **admin-backend** | 纯 HTTP proxy 到 web-api internal（HMAC-SHA256 + X-Admin-JWT 透传），presale 模块即此模式。无 events/risk/signal 代码 | `internal/client/webapi.go` |
| **admin-frontend** | Refine 5 + AntD 5 + ky；dataProvider 信封拆包 `{code:0,data:{list,total}}`；双层 RBAC；无图表库；`refetchInterval` 轮询已有实战（`audit/list.tsx:31`） | `src/providers/dataProvider.ts` |

**关键缺口**：现有 signal 是 market 级 uint8；PRD/原型要的是**赛事级判级 + 方向级明细 + 红灯人工审批闭环**，这一聚合层全系统不存在。且判级所需的**每方向投注额（totalStake）与按赛事 LP 底池均未落库**（见 §2.3），是本方案最大前置。

### 1.2 本期范围（管理后台 V3 中信号灯相关切片）

✅ 做：
1. **赛事风险总览** — 信号灯四色分布 KPI、全局最大敞口（看板 PRD §4.1/§4.2，首页 §0.3 复用同数据）
2. **赛事风险列表** — 两级结构：赛事行（折叠态）+ 玩法/方向明细，状态/灯色筛选 + 排序（§4.3）
3. **调整历史** — 方向赔率调整记录弹窗（§4.3.2 / 接口 §5.4）
4. **红灯人工决策** — 审批中心赛事 Tab：开盘 / 停单（§7.1 / 接口 §5.5）
5. **审批计数** — 铃铛红点 `event_count`（接口 §9.1；claim/withdraw 留占位 0，Claim Tab 前端渲染占位置灰）

❌ 不做：用户/资产/返佣/手续费/看板图表全家桶；Claim 审批；C 端合约与赔率逻辑（不写赔率、不读合约——链上数据一律经 web-api）。

---

## 2. Research 要点（v2 修订版，设计依据）

### 2.1 真值源仲裁：原型 JS vs 接口设计文档冲突清单 ★

review 发现 PRD 自身两份材料互相矛盾，本方案的取舍记录（开发与验收以此为准）：

| # | 冲突点 | 原型 JS（`0001_Oddfi_Admin_v3.html`） | 接口设计 V2 | 本方案取舍 |
|---|---|---|---|---|
| 1 | **事件判级源** | `sig = signalLight(maxL)`（:4239），maxL=全场**单方向最坏敞口**；行内"总计最大敞口"卡另行展示 adjMaxL（:4624） | §5.2 注释"signal 基于 max_exposure 判级"（max_exposure=adjMaxL） | **从原型**：判级按 maxL，展示按 adjMaxL，两个量分开（见 §3.1）。理由：单玩法阈值（8k/18k/28k）是按"单方向最坏亏损"定义的（与合约 calc.go 同义），用多玩法求和值套同阈值会系统性误报 |
| 2 | **审批队列口径** | 队列只收 red（`workflow.stage==='blocked'`，:4384/:4062） | §9.1 样例 `event_count:2` ≠ §5.1 `red_count:1`，概述 :1497 写"red/orange 自动入审" | **从原型**：队列只收 red（与 §5.5"仅 red 允许操作"一致）；`event_count = red 且未决策数`。orange 仅列表可筛不入队（D4） |
| 3 | **阈值数值** | mock 写 80k/180k/280k（:4021，放大 10× 造数） | §4.2 文案 8k/18k/28k | **从接口文档**：8k/18k/28k（=合约常量）。原型数值是 mock 放大，实现者勿照抄（D1） |
| 4 | **橙灯筛选语义** | orange Tab 实际 `=='orange'||=='red'`（:4455，橙含红） | 未提 | **从原型**：前端橙 Tab 发 `signal=orange,red`；契约层 signal 多值是纯并集语义，包含关系由前端组装 |

### 2.2 原型关键交互（前端必须复刻的行为骨架）

- 决策"停单"后原型将该事件 **red→orange 就地降级** 并退出队列消红点（:4429/:4435）；"开盘"同样退出队列。→ 决策态状态机见 §3.3。
- settled 态："该盘总盈利/赔付"卡**替换**"总计最大敞口"卡（:4622）；方向行标「✓ 胜出 / 未中 / 走盘」。
- 时间 chip hover 弹竖向时间线，按当前阶段高亮（:4600-4609：未开盘=open / pending=kickoff / active=lock / settled=settle）。
- KPI 点击：red→筛 red、orange→筛 orange，**green/yellow→落到 all**（:4649，列表无独立绿黄 Tab）。
- 全局最大敞口卡可点击 → 跳转/定位最高风险赛事行（`jumpToMaxRisk`，:1080）。
- 未开盘：四色计数不含未开盘事件（:4315）；行内风险/赔率类卡全部置灰「—」。
- 收益率三态色：>50% 红 / >30% 黄 / 其余绿（:4628）。

### 2.3 数据可得性总表（architect 逐字段核实，C 端代码证据）★

| 输入字段 | 状态 | 证据 | 说明 |
|---|---|---|---|
| 阈值 / Li 公式形态 | ✅ | `calc.go:10-12 / 35-37` | 与方案一致 |
| **每方向 totalStake** | ❌ **未落库** | 快照无 stake 列；spider 链读后即弃 | **C-Data-1，判级主链路最致命缺口** → OPS-01a |
| currentOdds（每方向） | ✅ | 快照 `quoted_odds_json` | |
| otherStake | ⚠️ 推导 | = ΣtotalStake − totalStake_i | 随 totalStake |
| **lp_pool_amount（按赛事）** | ❌ **未落库** | web-api 零命中；liquidity.go 仅用户持仓+池映射 | **C-Data-2** → 暂 null，yield_ratio 同步 null |
| fixture 状态 | ✅ | `FixtureDB.StateID` | 需 state→opened 映射 |
| 时间四点 | ⚠️ 部分 | kickoff/lock/start 可得；**settle 无独立列** | settle 暂 null，前端「—」 |
| **score** | ❌ | web-api model 无 score 字段 | 暂 null（H-Data-3） |
| settle_pl | ❌（暂） | 仅单注级 payout，无聚合 | 暂 null（D6） |
| 第三方赔率 + 来源 | ✅ **可得** | `OddDB`（表 `oddfi_odds`，含 BookmakerID/Value/FixtureID） | **比 v1 估计乐观，D6 上调为可交付** |
| market_count / direction_count | ✅ | onchain_markets count by fixture | |
| 调整历史 seq/time/odds/source | ✅ | 快照 quote_version/updated_at/quoted_odds_json，source=Auto 常量 | |
| 调整历史 **exposure / lp_ratio** | ❌ | 快照无此列 | 随 C-Data-1/2 落库后才有；落库前返回 null（H-Data-4） |

**结论**：v1 的"快照即调整历史，不需要新表"只对 seq/time/odds/source 成立；**判级主链路必须先在 C 端落库每方向 exposure**（推荐：spider 跟随 OddsUpdated 链读 `TotalStakedByOutcome` 落新表 `market_exposure_snapshot`，最贴合约真值；备选：从 `onchain_tx_orders` SUM 聚合，口径会因部分成交/退款漂移且查询重）。

---

## 3. 方案设计

### 3.0 总体架构（三仓解耦，后端主导）

```
┌─ oddfi-backend（数据与聚合主导）
│   ① spider：新增 market_exposure_snapshot 落每方向 stake（OPS-01a）
│   ② web-api：合并 internal HMAC 骨架（OPS-01b）→ /internal/admin/events/* 聚合+唯一判级点（OPS-01c）
│
├─ oddfi-admin-backend（契约与权限主导 ★proxy 层，本仓）
│   RBAC + 限流 + 审计 + 幂等，HTTP proxy；暴露 /admin/events/* + /admin/approval/counts
│
└─ oddfi-admin-frontend（纯适配）
    风险列表页 + 信号灯 KPI 卡 + 审批中心弹窗 + 铃铛 badge；30s 轮询
```

判级逻辑**只在 web-api 一处实现**；admin-backend 与前端零判级（延续 C 端"完全信任后端 signal"模式）。

### 3.1 web-api 侧（C 端仓库，internal 接口契约）★ 前置依赖

新增 `/internal/admin/events/*` 五端点（HMAC `X-Service-Sig` 校验；**internal 端点信任 admin-backend 已做 RBAC，不重复 RoleRequired，仅验 HMAC + 透传 X-Admin-JWT 解码取 operator 落审计**）：

| 端点 | 对应 admin 外显 | 说明 |
|---|---|---|
| `GET /internal/admin/events/risk/summary` | §5.1 | 四色计数（不含未开盘）+ 全局最大单场敞口 + 状态分布计数 |
| `GET /internal/admin/events/risk/list` | §5.2 | 赛事行折叠态；`signal` 接受逗号分隔多值 |
| `GET /internal/admin/events/{event_id}` | §5.3 | markets[] → directions[] 明细 |
| `GET /internal/admin/events/{event_id}/adjust-history` | §5.4 | 快照衍生；exposure/lp_ratio 待 OPS-01a 后补 |
| `POST /internal/admin/events/{event_id}/risk-decision` | §5.5 | 决策落库（web-api 库新表 `admin_risk_decisions`，唯一约束防重复）|

**核心计算约定（v2 修正：判级源与展示源分离）**：

```
event = fixture（event_id = fixture_id，int64，json 带 ,string）

方向敞口 Li      = totalStake_i × (currentOdds_i − 1) − otherStake      ← calc.go 同式
                  totalStake 来源 = market_exposure_snapshot（OPS-01a 落库）
方向 sig         = signalLight(Li)，按 8k/18k/28k 判级

★ 事件判级源 maxL = max(全场所有方向 Li)        ← 单方向最坏，对齐原型 :4239 与合约语义
  事件 signal     = signalLight(maxL)            ← 灯色 / 四色计数 / 审批入队 全部用它
★ 事件展示量 adjMaxL = Σ 各玩法最坏方向敞口      ← 「总计最大风险敞口」卡专用，不参与判级
                       （正=平台风险红显示，负=平台盈利绿显示）

opened           = 该 fixture 存在已开盘 market；false 时 signal/bet/exposure/yield 全 null，
                   且不计入 summary 四色计数（对齐原型 :4315）
yield_ratio      = |adjMaxL| / lp_pool_amount（lp_pool 落库前返回 null）
阈值              = yaml 配置，默认值=合约常量；注释强制标注"与 BettingPool 合约对齐，改合约必须同步"
```

**signal 序列化**：内部 uint8 → 对外字符串 `green/yellow/orange/red`。所有 uint64/int64 ID 带 `,string`。
**契约注意**：summary 的全局量命名 `max_event_exposure`（全局最大单场），list 行内命名 `max_exposure`（该场 adjMaxL）——同词根不同义，docs/api.md 必须分别注释（review Open-Q 采纳）。

### 3.2 admin-backend 路由 / RBAC / 限流（本仓核心交付）

| 路由 | 方法 | 允许角色 | 限流桶 |
|---|---|---|---|
| `/admin/events/risk/summary` | GET | operator, finance, customer_service, super_admin | default 60/min |
| `/admin/events/risk/list` | GET | 同上 | default |
| `/admin/events/:event_id` | GET | 同上 | default |
| `/admin/events/:event_id/adjust-history` | GET | 同上 | default |
| `/admin/events/:event_id/risk-decision` | POST | operator, super_admin | sensitive 10/min |
| `/admin/approval/counts` | GET | 全部四角色 | default |

- handler 照搬 presale proxy 薄壳（`presale_audit.go` 的 **RawQuery 透传**模式——`signal=red,orange` 逗号多值随 query 原样透传，前端/后端零特殊处理）。
- `risk-decision`：`X-Idempotency-Key` 必带；**operator 从 X-Admin-JWT 由 web-api 解码注入，不信任 body 传入**（修正 PRD §5.5 安全瑕疵）。
- `/admin/approval/counts`：并发调 web-api summary 取 `red_pending_count`；claim/withdraw 返 0 占位。**上游失败降级**：返回 `UPSTREAM_UNAVAILABLE`，前端 badge 保持上次值不弹错（M-Arch-4）。
- 同步义务：docs/api.md §1.6/§3.12 + `.claude/rules/rbac.md` 矩阵 + 前端 `lib/rbac.ts`（commit-msg hook 强制）。

**新增错误码**：

```go
EventNotFound        = "EVENT_NOT_FOUND"
EventNotRedSignal    = "EVENT_NOT_RED_SIGNAL"     // 仅红灯允许人工决策
RiskDecisionConflict = "RISK_DECISION_CONFLICT"   // 依赖 admin_risk_decisions 唯一约束
UpstreamUnavailable  = "UPSTREAM_UNAVAILABLE"
```

### 3.3 admin-backend 接口契约（外显）

响应壳 `{code:0,message:"ok",data:...}`；列表壳 `{list,total,page,page_size}`（PRD 写 `items[]`，本仓统一 `list`，交接文档标注）。**分页参数定死：入参 `page` / `page_size`，前端 dataProvider `PAGE_PARAM` 加 `events: {page:"page", size:"page_size"}`**（H-FE-2 收敛，与 admin-users 同款）。

`GET /admin/events/risk/list` 单条（ID 一律字符串序列化）：

```json
{
  "event_id": "5", "sport": "网球", "league": "ATP",
  "event_name": "Djokovic vs Alcaraz",
  "status": "active", "opened": true, "score": null,
  "times": {"open": "...", "lock": "...", "kickoff": "...", "settle": null},
  "lp_pool_amount": null, "bet_amount_total": "73955.00",
  "max_exposure": "19246.00",          // 展示量 adjMaxL
  "settle_pl": null,
  "signal": "orange",                   // 判级量 maxL 判出，两者来源不同 ★
  "market_count": 2, "direction_count": 5,
  "yield_ratio": null,
  "pending_decision": false,            // 红灯且 admin_risk_decisions 无记录 = true
  "decision": null                      // 已决策时: {"action":"...","decided_by":"...","decided_at":"..."}
}
```

`GET /admin/events/risk/summary` 增补状态分布（M-PRD-2，供"赛事总数"副文案）：

```json
{
  "total_bet_amount": "286910.00", "total_events": 8,
  "active_count": 4, "pending_count": 2, "settled_count": 2,
  "green_count": 3, "yellow_count": 2, "orange_count": 2, "red_count": 1,
  "red_pending_count": 1,
  "max_event_exposure": "19246.00",
  "max_exposure_event_id": "5", "max_exposure_event_name": "Djokovic vs Alcaraz"
}
```

**`POST /admin/events/:event_id/risk-decision` 决策态状态机（H-PRD-2 补全）★**：

```json
// req:  {"action": "approve_continue" | "stop", "remark": "人工评估后恢复开盘"}
// resp: {"event_id": "5", "action": "stop", "decided_by": "lark:ou_xx",
//        "decided_at": "...", "effective_signal": "orange", "queue_cleared": true}
```

决策态语义（一期不触链上，链上 signal 仍自治）：
- **决策记录盖过链上 signal 的"展示与队列"**：已决策事件 `pending_decision=false`、退出审批队列、badge 减一；list 行 `effective_signal` 规则 = 链上仍 red 且已决策 → 展示降级 `orange`（对齐原型 :4429），并带 `decision` 对象供前端标注「已人工处理」。
- 链上 signal 后续**升回 red 且 quote_version 晚于决策时间** → 视为新一轮风险，`pending_decision` 重新 true（防"决策一次永久消音"）。判定依据：`admin_risk_decisions.decided_at` vs 快照 `updated_at`。
- 时效说明：60s 聚合缓存 + 30s 前端轮询，红灯发现端到端最坏 ~90s。**可接受**——停单是合约即时自治行为，人工决策仅事后记录；`signal=red` 的 list 查询**绕过缓存**进一步压缩（M-Perf-1）。

其余端点字段照 PRD §5.1/§5.3/§5.4（§5.3 的 `direction_name` 带胜负态标注，接口设计 :692 已定义；adjust-history 的 `source` 本期恒 `Auto`，Manual 待人工调赔率通道落地后启用）。

### 3.4 admin-frontend 适配方案

#### 风格边界（H-STYLE-1）★

- **视觉一律不带入原型**：暗色背景、`rgba()` 描边、`--surface`/`#ff6b35` 等色值全部不要；沿用 Vercel 风格 AntD 主题。
- **交互骨架照原型复刻**：两级 expandable 表格、KPI 点击联动、时间线 hover、审批弹窗动作流。
- **信号灯四色是语义色，不是品牌强调色**：现有 `RoundStatusTag` 头注释"不引第六种强调色"约束的是品牌 accent；信号灯属风险语义色，允许在主题 token 内**新增一组 risk-signal 专用 token**（green/yellow/orange/red），色值取 AntD 内置 preset（success-green / gold / orange / error-red），不污染既有 3 accent。新建 `SignalTag.tsx`（结构参照 RoundStatusTag，色组独立）+ 头注释写明此边界。

#### 交付件 checklist（H-PRD-3 补全；标注 [前端纯展示] / [需契约字段]）

| 交付件 | 要点 |
|---|---|
| **风险总览 KPI** `pages/events/list.tsx` 顶部 | 四色 KPI（不含未开盘，[契约] summary 即此口径）；红灯 KPI CSS 脉冲；点击联动：red→筛 red、orange→筛 orange、**green/yellow→清筛选 all**（原型 :4649）[前端]；最大敞口卡**可点击定位该事件行**（[契约] `max_exposure_event_id`）；赛事总数副文案显示状态分布（[契约] `active/pending/settled_count`）|
| **风险列表（两级 Table）** | 折叠态=赛事行，expandable 展开=每玩法一张内嵌表；筛选 Tab：全部/进行中/待开始/已结算/红灯/橙灯（**橙 Tab 发 `signal=orange,red`**，原型包含语义）；排序映射 `sort_by/sort_order`；**settled 态：盈亏卡替换敞口卡 + 方向行 ✓胜出/未中/走盘**（[契约] settle/direction 胜负态）；**时间 chip hover 时间线 + 当前阶段高亮**（阶段映射见 §2.2）[前端]；**未开盘：风险/赔率卡全置灰「—」+ 灰 Tag「未开盘」**；收益率三态色 >50% 红 / >30% 黄 / 其余绿 [前端]；`lp_pool_amount/yield_ratio/score/settle_pl` 为 null 时显示「—」 |
| **调整历史弹窗** | Modal 时间线 Table，方向行「调整 n 次」触发；exposure/lp_ratio 为 null 显示「—」 |
| **审批中心弹窗 + 铃铛** | Badge 数 = `red_pending_count`，30s 轮询（`refetchInterval`，audit 页已有实战）；**轮询失败 badge 保持上次值，不弹错**；双 Tab：赛事审批 + **Claim 审批占位置灰**（badge 0）；赛事 Tab：红灯卡片 + 开盘/停单（`ConfirmMutationModal` 复用，强制 remark）；**决策成功后本地乐观更新：该事件退队、badge−1、行内灯降级 orange + 「已人工处理」标注**（对齐 §3.3 状态机）；规则说明折叠区文案写四档阈值 + 压缩率（**仅展示文案非判级源，改阈值需手动同步此文案** —— D1 边界注记）；决策按钮 RoleGuard：operator/super_admin |

- dataProvider：`PATH` 加 events；`PAGE_PARAM` 加 `events: page/page_size`；多值 signal 用**逗号分隔单 key**（`?signal=red,orange`——dataProvider `searchParams.set` 不支持重复 key，H-FE-1 收敛，后端 RawQuery 透传 + web-api 按逗号 split）。
- RBAC：`RESOURCE_ROLES.events = ["super_admin","operator","finance","customer_service"]`（与后端矩阵、rbac.md 三处同步）。
- 类型：`src/types/events.ts`，`Signal = "green"|"yellow"|"orange"|"red"`。

### 3.5 数据流（端到端）

```
合约 OddsUpdated ─(spider 3s)→ market_odds_snapshot ＋ market_exposure_snapshot(新, OPS-01a)
                                        │
        web-api /internal/admin/events/*  ←─ maxL 判级 + adjMaxL 聚合；summary/list 60s 缓存
                                        │     （signal=red 查询绕过缓存）
        admin-backend /admin/events/*     ←─ RBAC+限流+审计+幂等（HMAC）
                                        │
        admin-frontend 列表/KPI/审批弹窗  ←─ 30s 轮询；红灯端到端最坏 ~90s（可接受，见 §3.3）
```

### 3.6 关键决策点（v2 修订，需要你拍板 ⚠️）

| # | 问题 | 方案建议 | 备注 |
|---|---|---|---|
| **D1 阈值真值源** | 合约+engine 双硬编码 | web-api yaml 配置，默认=合约常量；admin/前端零判级（前端规则说明折叠区文案除外，已标注非判级源）。**原型 mock 阈值放大 10×（80k/180k/280k）仅为造数，实现以 8k/18k/28k 为准** | — |
| **D2 红灯决策执行面** | 链上无"人工恢复开盘"通道 | **两期走**：一期 risk-decision 仅落库 + 决策态盖过展示/队列（§3.3 状态机，红灯重升自动重新入队），不触链上；二期等合约/web-api pause/resume 能力再接真执行 | 一期就真执行 → 阻塞在合约团队 |
| **D3 event 映射** | PRD event_id int vs fixture_id int64 | event = fixture，ID 全链路 `,string` 序列化 | — |
| **D4 审批队列口径** | **PRD 自相矛盾**：原型 JS 只收 red（:4384）；接口文档 §9.1 样例 event_count:2≠red_count:1、概述 :1497 写 red+orange 入审 | **从原型：只收 red**（与 §5.5"仅 red 可操作"自洽；orange 列表可筛、不入队不计 badge）。`event_count = red_pending_count` | 若产品最终要 red+orange 入队：counts 聚合与前端 badge 需返工，请在确认时明示 |
| **D5 路由前缀** | PRD `/api/v1/admin/...` | 沿本仓 `/admin/...`（独立 8081 服务，Nginx 现行反代） | — |
| **D6 字段可得性分级**（v2 重排） | 见 §2.3 总表 | **可交付**：第三方赔率+来源（oddfi_odds 表，上调）；**暂 null（契约保留，前端「—」）**：score、settle_pl、lp_pool_amount、yield_ratio、times.settle、调整历史 exposure/lp_ratio；**落库后补**：null 组中依赖 OPS-01a/01d 的项 | lp_pool 若实为全局池非赛事池，yield_ratio 口径需产品重定义 |
| **D7 C 端落库前置（新增）** | 每方向 totalStake 未落库，判级主链路断裂 | spider 新增 `market_exposure_snapshot`（跟随 OddsUpdated 链读 `TotalStakedByOutcome` 落库，最贴合约真值）= OPS-01a | 备选：web-api 从 `onchain_tx_orders` SUM 聚合——口径漂移（部分成交/退款）+ 查询重，不建议 |

---

## 4. 实施计划（确认后按 dd-flow 拆 tasks）

外部前置（oddfi-backend 仓，C 端侧协作交付，照 REQ-004 模式出 STATUS 交接文档）：

- [ ] **OPS-01a** spider：`market_exposure_snapshot` 新表 + OddsUpdated 时链读 TotalStakedByOutcome 落库（D7，**判级主链路前置**）
- [ ] **OPS-01b** web-api：合并/补齐 internal HMAC 骨架（`service_auth.go` 现仅在 presale-impl worktree，**先核实 presale internal 是否已上主干**）
- [ ] **OPS-01c** web-api：`/internal/admin/events/*` 五端点 + `admin_risk_decisions` migration（唯一约束支撑 RISK_DECISION_CONFLICT）+ 阈值 yaml 配置
- [ ] **OPS-01d**（可后置）：lp_pool 按赛事落库 / settle 时间与比分来源，解锁 D6 null 组

本仓 + 前端仓（T02 可对 internal 契约 httptest 打桩，不被 OPS-01 阻塞；上游交付后回归）：

- [ ] T01 errcode + client 路径常量
- [ ] T02 events proxy handler × 5 + 单测（含 RawQuery 透传、幂等、decision 状态机字段透传）
- [ ] T03 approval/counts 聚合 + 降级语义 + 单测
- [ ] T04 router 注册 + RBAC + 限流 + rbac.md 矩阵
- [ ] T05 docs/api.md §1.6/§3.12 + 错误码表 + max_exposure 双义注释
- [ ] T06（前端）SignalTag（4 色语义 token）+ types + dataProvider（PATH/PAGE_PARAM/逗号多值）+ rbac.ts
- [ ] T07（前端）风险列表页（KPI 联动 + 两级 Table + settled 卡替换 + 时间线 hover + 未开盘态 + 收益率三态色）
- [ ] T08（前端）调整历史弹窗 + 审批中心弹窗（双 Tab 占位 + 决策乐观更新 + badge 降级）
- [ ] 阶段 4：team:2 review → 阶段 5 修复 → 阶段 6 归档

## 5. 关联

- PRD：`docs/dd002-risk-signal/prd/`（看板 §0.3/§4/§7.1；接口设计 §5/§9；原型 html 行号见 §2.1/§2.2）
- C 端证据：`oddfi-odds-engine/internal/engine/calc.go`、`oddfi-web-spider/{model/market_odds_snapshot.go, service/odds_updated_consumer.go, service/onchain_market_svc.go}`、`web-api/internal/model/{user_bet_holding.go, onchain_market.go, onchain_tx_order.go, liquidity.go}`
- 本仓参照：presale proxy（`internal/client/webapi.go`、`internal/handler/presale_audit.go`）、REQ-004 三方交付模式
- 前端仓：`src/providers/dataProvider.ts`、`src/lib/rbac.ts`、`src/components/RoundStatusTag.tsx`（色组纪律参照）、`src/pages/audit/list.tsx`（轮询参照）
- review 记录：本文件 v2 即 review 修订结论的归并（critic REVISE → 已全部处理；architect Critical×3 → C-Data-1/2 转 OPS-01a/01d + D7，C-Arch-1 转 OPS-01b）
