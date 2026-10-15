# 服务清单

> 每个服务一段定位 + 入口 + 端口 + 状态。深度文档跟随各自仓库 `*/docs/`。
> 想看跨服务的关系，先读 [`ARCHITECTURE.md`](./ARCHITECTURE.md)。

## 在线服务（生产链路上）

### oddfi-web-spider —— 体育数据采集

- **定位**：定时拉 SportMonks REST API，把嵌套结构清洗成反范式 MySQL 表，供其他服务直接 SELECT。
- **入口**：[`oddfi-web-spider/main.go`](../oddfi-web-spider/main.go)，启动参数 `-mode api -config config/config_xxx.yaml`
- **端口**：无（仅出站 HTTP）
- **调度**：1 小时一次 `all_sport_fixtures`，启动立即跑一次。`app.env=local` 用 `SyncFixturesAllLocal`，其他环境用 `SyncFixturesAll`。
- **写库**：`oddfi(_dev)_fixtures` / `_odds` / `_statistics` / `_fixture_results` / `oddfi_moneyline_snapshots` 等。Upsert 通过 GORM `CreateInBatches` + `OnConflict`。
- **预留未启用**：`ws` 模式、Kafka producer、`SyncLeagues`、`SyncFixturesByDate/Range`、`UpsertFixturesPro` 终态跃迁。
- **配套监控**：`scripts/monitor_docker_lark.py` 跑在宿主机上，每 1h 巡检容器存活，异常推 Lark。
- **深入**：[`oddfi-web-spider/docs/ARCHITECTURE.md`](../oddfi-web-spider/docs/ARCHITECTURE.md)、[`MONITORING.md`](../oddfi-web-spider/docs/MONITORING.md)、[`MONEYLINE_TABLE_DEPLOY.md`](../oddfi-web-spider/docs/MONEYLINE_TABLE_DEPLOY.md)

---

### oddfi-web-api —— 详情页 / 行情查询 API

- **定位**：Gin HTTP 服务，只读 spider 写好的赛事/赔率/统计 + Redis 喂价，给前端提供"详情页 + 流动池 + Banner + K 线 + Moneyline + 早鸟"等查询。**不参与资金状态**。
- **入口**：[`oddfi-web-api/main.go`](../oddfi-web-api/main.go)，启动参数 `-config config/config_prod.yaml`
- **端口**：`:8080`
- **路由命名空间**：`/health_check`、`/api/v1/detail/*`、`/api/v1/liquidity/*`、`/api/v1/market/*`、`/api/v1/moneyline/*`、`/api/v1/token/*`、`/api/v1/early_access/*`
- **WebSocket**：`GET /api/v1/detail/ws`（K 线推送，依赖后台 `StartPriceFetcher` goroutine）
- **依赖**：MySQL（只读）+ Redis + `config/fixture_language_mapping.json`
- **部署**：双套 EC2 `dev-market-api` / `market-api`，详见 [`.omc/wiki/infra-oddfi-web-api-dev-market-api-market-api.md`](../.omc/wiki/infra-oddfi-web-api-dev-market-api-market-api.md)

---

### web-api —— 账户 / 交易 / 预售 / 邀请 API

- **定位**：Gin HTTP 服务，承载所有需要登录的用户操作（钱包登录、JWT、余额、下注、撤单、领奖、提现、Banner 下注、Presale 用户侧、Referral）+ 老 admin 提现审核 + 新 admin presale 后台。
- **入口**：[`web-api/cmd/server/main.go`](../web-api/cmd/server/main.go)
- **端口**：
  - 公网：`:8082`（dev）/ `:80`（prod，来自 `config_prod.yaml`）
  - Admin internal：`127.0.0.1:8081` loopback（独立 `*gin.Engine`）
- **公网路由命名空间**：
  - `/health`
  - `/account/*` — 用户资金、下注、撤单、领奖、提现、History
  - `/admin/order/*` — 老提现审核，**明文密码鉴权（Redis `admin:user:{user}`）**
  - `/market/price` — token 单价
  - `/api/v1/referral/*` — 邀请码、绑定、列表
  - `/api/v1/presale/*` — 预售配置、上报 tx、查持仓
- **Internal 路由**：`/internal/admin/presale/*` 17 个接口，中间件链 `ServiceAuth → AdminJWT → AdminAudit → Idempotency`，RBAC 在 admin-backend 完成，web-api 只信任 JWT 透传的 operator role。详见 [`web-api/docs/dd-invest/`](../web-api/docs/dd-invest/)。
- **依赖**：MySQL（读写）+ Redis（session/JWT 黑名单/admin 密码/喂价/流动池热度）
- **接手指南**：[`web-api/AGENTS.md`](../web-api/AGENTS.md)（强烈建议新同事先读）
- **深入**：[`web-api/ARCHITECTURE.md`](../web-api/ARCHITECTURE.md) / [`DEPLOY.md`](../web-api/DEPLOY.md) / [`BANNER_BET_DEPLOY.md`](../web-api/BANNER_BET_DEPLOY.md)

---

### web-api/cmd/presale-worker —— 链上认购监听

- **定位**：与 web-api HTTP server 同机但**独立进程**，监听 BSC USDT Transfer，把链上充值落到 `presale_deposit` / `holding` / 游标。
- **入口**：[`web-api/cmd/presale-worker/main.go`](../web-api/cmd/presale-worker/main.go)
- **端口**：无
- **运行机制**：
  1. 启动时 `EnsureAll(PRESALE_VAULT_POOL)` 初始化游标
  2. Redis `SET NX EX` 抢 leader，TTL/3 续约；非 leader 空转
  3. `runRoundStatusCron`（5min tick）+ `runConfirmCron`（`PollIntervalSec` tick）
  4. SIGINT/SIGTERM → cancel ctx → 2s drain → 关 Redis/MySQL
- **配置**：env 优先于 yaml，前缀 `PRESALE_*`
- **深入**：[`web-api/docs/dd-invest/batches/`](../web-api/docs/dd-invest/batches/) 系列文档

---

## 占位 / 未上线（**不在生产链路**）

### oddfi-data-ws —— 详情页数据推送

- **状态**：⛔ 仓库内**只有一个 README**（"## 详情页数据推送服务"），无代码。
- **风险**：与 oddfi-web-api 内部的 `/api/v1/detail/ws`（K 线 WSHub）定位重叠。要做之前必须先决定：是把现有 WSHub 抽离独立服务，还是新增一个并行的 WS 服务。
- **当前 owner**：未指定

### oddfi-odds-engine —— 自营盘动态赔率引擎

- **状态**：⛔ **未上线**。
  - [`cmd/engine/main.go`](../oddfi-odds-engine/cmd/engine/main.go) 还有硬编码 DSN（`user:pass@tcp(rds-endpoint:...)`）
  - 主流程靠内存 channel `betEventQueue`，但 web-api 下注路径**不发任何外部信号**，没有上游
  - DB 行锁算法（`internal/engine/worker.go`）+ WS 广播中心（`internal/api/ws_hub.go`）原型存在
- **想上线必须**：1) 在 web-api 下注事务后发事件（HTTP / channel / Kafka 任选）；2) 替换硬编码配置；3) 与现有 oddfi-web-api 的 WS 协议对齐。
- **深入**：[`oddfi-odds-engine/README.md`](../oddfi-odds-engine/README.md)

---

## Owner / 提问入口

| 服务 | 主要 owner | 提问/PR 频道 |
|---|---|---|
| oddfi-web-spider | TBD | GitHub Issue + `#odd5-backend` |
| oddfi-web-api | TBD | 同上 |
| web-api（HTTP + worker） | hang / khan | 同上 |
| oddfi-data-ws | 待认领 | 同上 |
| oddfi-odds-engine | 待认领 | 同上 |

> **建议**：每个服务在自己 README 顶部加一行 `**Owner**: @xxx`，避免新同事问"这个服务谁负责"的时候找不到人。
