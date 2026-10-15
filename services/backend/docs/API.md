# 接口总览

> **真理源是 Swagger**，本页只做"分类 + 入口 + 鉴权 + 分支"导航。Swagger 由 `main` 分支 GitHub Actions 自动生成。
> 字段、请求体、响应体细节请直接看 Swagger，不在这里重复维护以免漂移。

## 分支生效图例

> 快照基准：`origin/main` vs `origin/dev`，diff 时间 **2026-05-27**。`origin/main` 和 `origin/dev` 是两条显著发散的分支（merge-base `ff5b961`），不是"dev 是 main 的超集"的关系——main 走 centralized presale 路线、dev 走链上结算路线，所以同时存在"main only / dev only / 双端"三态。任何分支合并发生后，本表需要重跑 diff 才能保持准确。
>
> 重跑命令模板见本文末尾 §7。

| 标记 | 含义 |
|---|---|
| 🟢 双端 | `origin/main` 与 `origin/dev` 都注册该路由 |
| 🔵 main only | 只在 `origin/main` 上注册（dev 分支无） |
| 🟡 dev only | 只在 `origin/dev` 上注册（main 分支无） |
| ⚠️ 同名异义 | 路径相同但实现路线不同，需看具体分支代码 |

## 入口

- **GitHub Pages（最新）**：
  - 总入口：https://crypto-barrett.github.io/oddfi-backend/
  - 详情页 API：https://crypto-barrett.github.io/oddfi-backend/oddfi-web-api/
  - 账户 API：https://crypto-barrett.github.io/oddfi-backend/web-api/
- **本地预览**：
  ```bash
  make swagger          # 重新扫描注释生成 swagger.json/yaml
  make swagger-site     # 打包到 api-docs-site/
  make swagger-serve    # 起 http://localhost:8088
  ```
- **生成器扫描范围**（修改 `scripts/swagger/gen.sh` 时注意）：
  - web-api：`cmd/server` + `internal/handler` + `internal/model`
  - oddfi-web-api：`main.go` + `handler` + `model`
- **首次启用 GitHub Pages** 需在仓库设置勾选 `Settings → Pages → Build and deployment → Source: GitHub Actions`。

## 1. oddfi-web-api（详情页 / 行情）

公网 `:8080`，**无 JWT**。所有路由都在 `api/v1` 前缀下（`/health_check` 除外）。

| 方法 | 路径 | 分支 | 用途 | 来源 |
|---|---|:-:|---|---|
| GET | `/health_check` | 🟢 双端 | 健康检查 | `handler/handler.go` |
| GET | `/api/v1/market/banners` | 🟢 双端 | 首页/Market 顶部 Banner（mock 数据） | `market_banner.go` |
| GET | `/api/v1/market/banners/:banner_id` | 🟢 双端 | 指定 Banner 详情 | `market_banner.go` |
| GET | `/api/v1/liquidity/details/market_all` | 🟢 双端 | 流动池精选未开赛赛事列表 | `liquidity_market.go` |
| GET | `/api/v1/liquidity/details/market_search` | 🟢 双端 | 流动池按当前语言队名搜索 | `liquidity_market.go` |
| GET | `/api/v1/detail/sports_all` | 🟢 双端 | 所有联赛 | `market.go` |
| GET | `/api/v1/detail/stages_all/:stage_id` | 🟢 双端 | 指定联赛的所有阶段 | `market.go` |
| GET | `/api/v1/detail/fixture/:fixture_id` | 🟢 双端 | 指定 fixture 详情 | `market.go` |
| GET | `/api/v1/detail/fixture_date/:date` | 🟢 双端 | 指定日期所有 fixture | `market.go` |
| GET | `/api/v1/detail/fixture_between/:start_date/:end_date` | 🟢 双端 | 区间内 fixture | `market.go` |
| GET | `/api/v1/moneyline/history/:fixtureId` | 🟢 双端 | Moneyline 历史概率曲线 | `moneyline.go` |
| GET | `/api/v1/detail/ws` | 🟢 双端 | K 线 WebSocket | `kline.go` + `WSHub` |
| GET | `/api/v1/token/price` | 🟢 双端 | 单 token 价格 | `market.go` |
| POST | `/api/v1/token/batch_price` | 🟢 双端 | 批量 token 价格 | `market.go` |
| POST | `/api/v1/early_access/register` | 🔵 main only | 早鸟登记（DD-001） | `early_access.go` |
| GET | `/api/v1/match-detail/overview/:fixtureId` | 🟡 dev only | 详情列 overview 聚合 | dev 独有 |
| GET | `/api/v1/match-detail/h2h/:fixtureId` | 🟡 dev only | HeadToHead tab | dev 独有 |
| GET | `/api/v1/match-detail/standings/:fixtureId` | 🟡 dev only | Standings tab | dev 独有 |
| GET | `/api/v1/match-detail/lineups/:fixtureId` | 🟡 dev only | Lineups tab | dev 独有 |

## 2. web-api 公网（账户 / 交易 / 预售 / 邀请）

公网 `:8082`（dev）/ `:80`（prod）。

### 2.1 账户 `/account/*`

| 方法 | 路径 | 分支 | 鉴权 | 用途 |
|---|---|:-:|---|---|
| POST | `/account/login_by_wallet` | 🟢 双端 | 否 | 钱包登录（两步） |
| POST | `/account/refresh_access_token_by_refresh` | 🟢 双端 | 否 | 用 refresh token 换 access token |
| POST | `/account/logout` | 🟢 双端 | JWT | 退出并把 jti 加入 Redis 黑名单 |
| GET | `/account/balance` | 🟢 双端 | JWT | 用户余额 |
| GET | `/account/deposit_address` | 🟢 双端 | JWT | 用户充值地址 |
| GET | `/account/asset_ledger` | 🟢 双端 | JWT | 资产流水 |
| GET | `/account/portfolio/history` | 🟢 双端 | JWT | History 聚合 |
| POST | `/account/bet_place` | 🟢 双端 | JWT | 普通下注（single / parlay）；handler/service/bet repo 双端字节一致 |
| POST | `/account/bet_cancel` | 🟢 双端 | JWT | 撤单（仅 live 状态） |
| GET | `/account/bet_holding` | 🟢 双端 | JWT | 持仓查询 |
| POST | `/account/bet_claim` | 🟢 双端 | JWT | 领取派彩（用结算 worker 写入的 `actual_payout`） |
| POST | `/account/banner_bet_place` | 🟢 双端 | JWT | Banner 下注（B1~B5） |
| GET | `/account/banner_bet_holding` | 🟢 双端 | JWT | Banner 注单查询 |
| POST | `/account/withdraw/apply` | 🟢 双端 | JWT | 提现申请 |
| POST | `/account/withdraw/cancel` | 🟢 双端 | JWT | 取消提现（仅待审核） |
| POST | `/account/withdraw/get_record_info` | 🟢 双端 | JWT | 按订单号查记录 |
| GET | `/account/withdraw/get_record` | 🟢 双端 | JWT | 提现记录列表 |
| GET | `/account/withdraw/fee` | 🟢 双端 | JWT | 提现手续费 |

### 2.2 链上交互 `/account/onchain/*`（dev 独有）

dev 分支引入的并行链上路径，对应"链上结算"路线。

| 方法 | 路径 | 分支 | 鉴权 | 用途 |
|---|---|:-:|---|---|
| POST | `/account/onchain/approve` | 🟡 dev only | JWT | 授权 |
| POST | `/account/onchain/place_bet` | 🟡 dev only | JWT | 直接链上下注 |
| GET | `/account/onchain/orders/:order_id` | 🟡 dev only | JWT | 链上订单详情 |
| POST | `/account/onchain/deposit_global` | 🟡 dev only | JWT | 全局充值 |
| POST | `/account/onchain/deposit_match` | 🟡 dev only | JWT | 单场充值 |
| POST | `/account/onchain/claim_payout` | 🟡 dev only | JWT | 链上领奖 |
| POST | `/account/onchain/request_unbond` | 🟡 dev only | JWT | 申请解锁 |
| POST | `/account/onchain/withdraw` | 🟡 dev only | JWT | 链上提现 |

### 2.3 行情 `/market/*`

| 方法 | 路径 | 分支 | 鉴权 | 用途 |
|---|---|:-:|---|---|
| GET | `/market/price` | 🟢 双端 | 否 | 从 Redis 读 `market:price:{chain}:{symbol}` |
| GET | `/market/onchain` | 🟡 dev only | 否 | 链上 markets 列表 |
| POST | `/market/:marketId/preview-signal` | 🟡 dev only | 否 | 链上下注 preview signal |

### 2.4 邀请 `/api/v1/referral/*`（DD-INVEST B1）

| 方法 | 路径 | 分支 | 鉴权 | nginx 层限流 |
|---|---|:-:|---|---|
| GET | `/api/v1/referral/me` | 🔵 main only | JWT | 60 req/min/user |
| POST | `/api/v1/referral/bind` | 🔵 main only | JWT | 5 req/min/user |
| GET | `/api/v1/referral/list` | 🔵 main only | JWT | 60 req/min/user |

详见 [`web-api/docs/dd-invest/batches/B1-referral.md`](../web-api/docs/dd-invest/batches/B1-referral.md)。

### 2.5 预售用户侧 `/api/v1/presale/*`（DD-INVEST B0~B2）

| 方法 | 路径 | 分支 | 鉴权 | 用途 |
|---|---|:-:|---|---|
| GET | `/api/v1/presale/config` | 🔵 main only | 否 | 全局配置 |
| POST | `/api/v1/presale/deposit/report-tx` | 🔵 main only | JWT | 用户上报已发链上 tx |
| GET | `/api/v1/presale/deposit/list` | 🔵 main only | JWT | 用户认购记录 |
| GET | `/api/v1/presale/deposit/:txHash` | 🔵 main only | JWT | 按 tx hash 查认购详情 |
| GET | `/api/v1/presale/position` | 🔵 main only | JWT | 用户持仓 |

### 2.6 老 Admin（提现审核）`/admin/order/*`

| 方法 | 路径 | 分支 | 鉴权 | 用途 |
|---|---|:-:|---|---|
| GET | `/admin/order/pending_orders` | 🟢 双端 | 明文密码 | 查所有 pending 提现 |
| POST | `/admin/order/approve_order` | 🟢 双端 | 明文密码 | 审批 |
| POST | `/admin/order/order_info` | 🟢 双端 | 明文密码 | 查订单 |

> ⚠️ 明文密码方案是 MVP 妥协，安全评估见 [`.omc/wiki/sec-001-admin-zero-auth.md`](../.omc/wiki/sec-001-admin-zero-auth.md)，生产必须 nginx/ALB 层 IP 白名单兜底。

## 3. web-api admin internal（loopback，🔵 main only）

监听 `127.0.0.1:8081`，**不暴露公网**。dev 分支无此模块。

中间件链：`ServiceAuth → AdminJWT → AdminAudit → Idempotency → handler`。

| 方法 | 路径 | 分支 | 用途 |
|---|---|:-:|---|
| GET | `/health` | 🔵 main only | 健康检查（scope=internal） |
| GET | `/internal/admin/presale/rounds` | 🔵 main only | 轮次列表 |
| GET | `/internal/admin/presale/rounds/:id` | 🔵 main only | 单轮次 |
| POST | `/internal/admin/presale/rounds/:id/pause` | 🔵 main only | 暂停 |
| POST | `/internal/admin/presale/rounds/:id/resume` | 🔵 main only | 恢复 |
| POST | `/internal/admin/presale/rounds/:id/reopen` | 🔵 main only | 重新开放 |
| POST | `/internal/admin/presale/rounds/:id/close` | 🔵 main only | 关闭 |
| GET | `/internal/admin/presale/deposits` | 🔵 main only | 认购列表（筛选/分页） |
| GET | `/internal/admin/presale/deposits/:txHash` | 🔵 main only | 认购详情 |
| POST | `/internal/admin/presale/deposits/:txHash/migrate-round` | 🔵 main only | 跨轮次迁移 |
| GET | `/internal/admin/presale/config` | 🔵 main only | 全局配置查询 |
| GET | `/internal/admin/presale/anomaly` | 🔵 main only | 异常事件列表 |
| GET | `/internal/admin/presale/anomaly/:id` | 🔵 main only | 异常事件详情 |
| POST | `/internal/admin/presale/anomaly/:id/resolve` | 🔵 main only | 处理异常 |
| GET | `/internal/admin/presale/audit` | 🔵 main only | 操作审计流水 |

设计文档：[`web-api/docs/dd-invest/`](../web-api/docs/dd-invest/) 系列。

## 4. WebSocket / 后台连接

| 端点 | 协议 | 分支 | 服务 | 用途 |
|---|---|:-:|---|---|
| `/api/v1/detail/ws` | WS（升级 GET） | 🟢 双端 | oddfi-web-api | K 线 / 价格订阅 |
| Redis pub/sub | — | — | — | **未使用** |
| Kafka topic `league_updates` | — | — | — | 配置存在但**主流程未启用** |

## 5. 接口契约相关约定

- **金额字段统一字符串**：余额、stake、odds、actual_payout、withdraw 金额等 `decimal.Decimal` 字段，Swagger 用 `swaggertype:"string"` 输出。前端必须按资产精度处理，禁止用 JS `number`。
- **错误码**：领取/下注关键路径用机器可读状态码（`CLAIM_AMOUNT_MISMATCH` / `INVALID_BET_STATUS_FOR_CLAIM` / `SELF_REFERRAL` / `ALREADY_BOUND` / `OVERFLOW` 等），前端按字符串匹配，不要按 message 文案。
- **JWT 头**：`Authorization: Bearer <access_token>`。Logout 后 jti 立即进 Redis 黑名单，中间件每次校验 jti。
- **CORS**：当前同时设置 `*` 和 `credentials`，是已知 MVP 风险，正式收紧前不要去掉中间件。
- **Idempotency**：`/internal/admin/*` 写接口需要 `Idempotency-Key` 头；TTL 默认 90 天。
- **限流**：账户类 nginx 层限流（具体规则与 nginx 同事对齐，见 [`.omc/wiki/enh-001-nginx.md`](../.omc/wiki/enh-001-nginx.md)）。

## 6. 共建约定

- 改接口先在对应仓库改 handler 注释 → `make swagger` 自动重生 → 合 main 后 GitHub Actions 自动发布。**不要手维护接口表**。
- 新增接口大类（不只是新增一个路由）时，再回到本页加一行进分组表，保持入口清单完整。
- 跨服务的契约变更（共享 MySQL 表 / Redis key / 错误码常量）请同时改 [`ARCHITECTURE.md`](./ARCHITECTURE.md) 的对应小节。
- **分支列只在路由集合变动时刷新**：合并 / cherry-pick 之后，跑下面的 diff 脚本对齐"分支"列。

## 7. 刷新"分支"列的 diff 脚本

```bash
# 在仓库根执行
git fetch origin

# oddfi-web-api 路由 diff
diff \
  <(git show origin/main:oddfi-web-api/handler/handler.go | grep -E "group\.(GET|POST|PUT|DELETE)") \
  <(git show origin/dev:oddfi-web-api/handler/handler.go | grep -E "group\.(GET|POST|PUT|DELETE)")

# web-api group.go（账户主路由）
diff \
  <(git show origin/main:web-api/internal/router/group.go | grep -E "\.(GET|POST|PUT|DELETE)\(") \
  <(git show origin/dev:web-api/internal/router/group.go | grep -E "\.(GET|POST|PUT|DELETE)\(")

# web-api admin internal（dev 分支可能没有此文件，git show 报错正常）
diff \
  <(git show origin/main:web-api/internal/router/admin_internal.go 2>/dev/null | grep -E "\.(GET|POST|PUT|DELETE)\(") \
  <(git show origin/dev:web-api/internal/router/admin_internal.go 2>/dev/null | grep -E "\.(GET|POST|PUT|DELETE)\(")

# referral / presale 同上：换文件名重跑
```

diff 输出 `<` 行 = 仅 main 有 → 标 🔵；`>` 行 = 仅 dev 有 → 标 🟡；都没出现 = 双端都有 → 标 🟢。

> 上次刷新：2026-05-27（main `e7a1519` vs dev `15953ad`，merge-base `ff5b961`）
