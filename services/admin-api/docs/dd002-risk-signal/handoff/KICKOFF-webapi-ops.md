# 🚀 KICKOFF · C 端后端（oddfi-backend，轨道 C：OPS-01a/b/c/d）

> 角色一句话：为管理后台信号灯功能提供数据与聚合层 —— spider 落每方向敞口快照、web-api 立 internal HMAC 骨架并实现 `/internal/admin/events/*` 五端点（**判级逻辑全系统唯一实现点在你这**）、决策表落库。admin 侧（proxy/前端）不等你，但联调 B 起需要你交付。

## 1. 方案与交接契约在哪（统一在 admin-backend 仓 docs/dd002-risk-signal/）

| 文件（绝对路径） | 用途 |
|---|---|
| `/Users/hang/work/oddfi-admin-backend/docs/dd002-risk-signal/DD.md` | 方案 v2 唯一权威。重点读：**§3.1 计算约定（maxL 判级 / adjMaxL 展示分离！）**、§2.3 数据可得性总表、§3.6 D1-D7 拍板记录 |
| `…/handoff/DD002-OPS-01b-internal-hmac.md` | **先做这个**：核实/合并 internal HMAC 骨架（service_auth 目前只在 presale-impl worktree，主干没有） |
| `…/handoff/DD002-OPS-01a-exposure-snapshot.md` | spider 敞口快照表（**含完整 DDL**；判级主链路前置，与 01b 并行） |
| `…/handoff/DD002-OPS-01c-internal-endpoints.md` | 五端点实现规约（**含判级公式、admin_risk_decisions DDL、决策状态机、暂 null 字段清单、验收 checklist**） |
| `…/handoff/DD002-OPS-01d-data-backfill.md` | 可后置数据补齐（P1 的 LP 池口径问题需先找产品/合约确认） |
| `…/process/README.md` | 依赖图 + 联调 B 方案（你的交付验收入口） |

（`…` = `/Users/hang/work/oddfi-admin-backend/docs/dd002-risk-signal`）

## 2. 文件夹地图（本仓你要动的 / 参照的）

```
/Users/hang/work/oddfi-backend/
├── oddfi-web-spider/                          ← OPS-01a
│   ├── service/odds_updated_consumer.go       ← 改造点：handleLog 同时机链读 stake 落新表
│   ├── service/onchain_market_svc.go:308-327  ← 现状证据：TotalStakedByOutcome 用完即弃
│   ├── chain/betting_pool_client.go:59        ← 已有链读方法，直接复用
│   └── model/market_odds_snapshot.go          ← 新表 model 参照（uk 去重键同款）
├── web-api/                                   ← OPS-01b / 01c
│   ├── .claude/worktrees/presale-impl/web-api/internal/middleware/service_auth.go
│   │                                          ← OPS-01b：待合并主干的 HMAC 中间件
│   ├── internal/router/admin.go               ← internal 路由组挂载点
│   ├── internal/repository/market.go:84-103   ← ★参照：最新快照 MAX(quote_version) 自连接查询
│   ├── internal/model/user_bet_holding.go     ← FixtureDB（状态/时间）+ OddDB（第三方赔率，表 oddfi_odds）
│   └── internal/model/onchain_market.go       ← fixture↔market 映射
└── oddfi-odds-engine/internal/engine/calc.go:10-37  ← ★阈值常量 + Li 公式真值源（镜像进 yaml 配置，注释标注对齐合约）
```

## 3. 必守关键点（review 会逐条核）

- **判级源分离**：事件灯色/计数/入队用 `maxL = max(全场方向 Li)`；`max_exposure` 展示字段用 `adjMaxL = Σ各玩法最坏方向`。**两者不能复用同一值**（原型与合约语义如此，方案 §2.1 仲裁记录）
- signal 对外字符串 `green/yellow/orange/red`；所有 int64/uint64 ID 带 `,string` json tag
- `decided_by` 从透传的 X-Admin-JWT 解码，**永不信任 body**；决策不触链上（D2 一期口径）
- 红灯重升重入队：`pending_decision` 以 `decided_quote_version >= 当前 quote_version` 判定
- 暂 null 字段（lp_pool/yield/score/settle_pl/times.settle/lp_ratio）返回 **null**，不要用 0/空串冒充
- HMAC 签名与 admin 侧逐字对齐：`/Users/hang/work/oddfi-admin-backend/internal/client/webapi.go:226-243`（ComputeServiceSig）
- `/internal/*` 仅放行 admin-server IP（<SERVER_IP>），公网不可达

## 4. 交付验收入口

- 单测：OPS-01c 文件内 checklist（判级边界值 / maxL≠adjMaxL 夹具 / 未开盘 null / 红灯重升）
- 联调 B：admin 侧提供 `docs/risk-signal-curl.md` 契约 curl 集（admin-backend T05 产出），全数打通 = 交付完成
- mock 对照：admin 侧 `cmd/mock-webapi` 夹具即契约期望形态，你的真实响应与之 schema diff 应为零
