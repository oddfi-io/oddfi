

# 接手项目指南

## 1. 项目整体用途

Oddfi Web API 是一个 Go + Gin 写的账户与交易后端服务，主要给前端提供钱包登录、JWT 鉴权、余额查询、充值地址查询、提现申请、下注、撤单、领取派奖、持仓、资产流水 History、Banner 下注、行情价格查询等接口。

它不是完整的链上系统，也不是赔率采集/结算 worker。当前服务依赖外部系统提前写入 MySQL 中的赔率、赛事、结算、充值等数据，本服务负责用户侧 API、资金账户变动和流水展示。

最近历史改动主要集中在几块：`handicapline` 旧字段兼容、亚让/大小球盘口线校验、History 顶层状态返回、History 领取入口标记、Banner 下注、领取接口稳定状态码、mock 5 分钟赛事脚本。

## 2. 目录结构说明

- `cmd/server/main.go`：服务启动入口，初始化配置、MySQL、Redis、JWT、限流、repo/service/handler/router。
- `internal/config`：YAML 配置结构和加载逻辑。
- `internal/router`：Gin 路由注册，分为 health、account、admin、market。
- `internal/handler`：HTTP 参数绑定、鉴权上下文读取、响应包装。
- `internal/service`：核心业务编排，包含钱包登录、下注、提现、History 聚合。
- `internal/repository`：MySQL / Redis 访问，资金变动事务主要集中在 `user.go`。
- `internal/model`：请求、响应、数据库模型、History 枚举。
- `internal/pkg`：MySQL、Redis、JWT、logger、response、snowflake 封装。
- `internal/middleware`：JWT 鉴权、限流、日志、CORS。
- `utils`：地址校验、Redis key、小工具。
- `scripts`：mock 5 分钟赛事 seed / repair SQL。
- `docs/swagger`：由根目录 `make swagger` 自动生成的 OpenAPI JSON/YAML，配合 GitHub Pages 给前端查看最新接口字段。
- 根目录文档：`README.md`、`ARCHITECTURE.md`、`DEPLOY.md`、`BANNER_BET_DEPLOY.md`、`prd.md`、`20260424-prd.md`。

## 3. 程序启动入口

入口是 `cmd/server/main.go`。启动顺序是：初始化 logger，读取 `./config.yaml`，连接 MySQL 原生 client 和 GORM，初始化 Snowflake 节点，连接 Redis，初始化 JWT，初始化限流器，创建 repository、service、handler，最后通过 `router.Setup` 注册 Gin 路由并启动 HTTP Server。

主要路由：

- `GET /health`：健康检查。
- `/account/*`：登录、刷新 token、退出、余额、充值地址、资产流水、History、提现、下注、撤单、持仓、领取、Banner 下注。
- `/admin/order/*`：提现后台审核相关接口，认证方式是 query/body 中的 admin 用户密码，不走 JWT。
- `GET /market/price`：从 Redis 读取指定链和 token 的价格。

服务支持优雅退出：收到 `SIGINT` / `SIGTERM` 后最多等待 30 秒关闭 HTTP Server，再关闭 MySQL / Redis。

Swagger 文档采用静态生成，不挂载到运行中的 Gin 服务，避免生产服务暴露额外调试入口。根目录 `scripts/swagger/gen.sh` 会扫描 `cmd/server`、`internal/handler` 和 `internal/model` 生成 `docs/swagger/swagger.json`、`docs/swagger/swagger.yaml`；`scripts/swagger/build-site.sh` 会把产物打包到 `api-docs-site/web-api/`，GitHub Actions 在 `main` 分支更新后发布到 GitHub Pages。

金额、余额、赔率、提现手续费等 `decimal.Decimal` 字段在 Swagger 里通过 `swaggertype:"string"` 显示为字符串。这是文档层约束，目的是提醒前端按资产精度处理，不要用 JavaScript number 承接链上/交易金额。

## 4. 核心业务流程

钱包登录分两步。第一步 `POST /account/login_by_wallet` 只带地址、钱包类型、链，服务生成 nonce 和 session_id，写入 Redis `wallet_session:{session_id}`，TTL 5 分钟。第二步带 session_id、message、signature，服务校验签名、nonce、地址；如果用户不存在，会创建用户、分配充值地址、初始化余额、写登录日志，最后返回 access token 和 refresh token。

JWT 鉴权由 `AuthMiddleware` 处理。请求头必须是 `Authorization: Bearer <token>`，服务校验 JWT 签名和过期时间，再查 Redis `token_blacklist:{jti}` 判断 access token 是否已退出登录。通过后把 `user_id`、`address`、`token_id` 放进 Gin context。

普通下注走 `POST /account/bet_place`。handler 校验数组长度、重复 odd_id、下注类型；service 把 stake、odds、handicap_line 转 decimal；repository 在事务里校验 OddDB 赔率快照、盘口线、暂停状态，然后创建 `user_bet_holding`，扣 `available_balance`，加 `bet_lock_balance`，写 `asset_ledger`。单注是逐笔事务，串关是整体事务。下注事务成功后会按赔率关联的 `fixture_id` 递增 Redis 热度计数 `liquidity:fixture:bet_count:{fixture_id}`，供 `oddfi-web-api` 流动池赛事列表排序使用；该统计是派生数据，写入失败只记录日志，不回滚资金交易。

Banner 下注走 `POST /account/banner_bet_place`。它不复用普通比赛盘口校验，只校验 BannerCode、market_id、selection_id、stake、odds、ref_id，然后在一个事务里写 `banner_bet_order`、扣余额、加 bet lock、写 `asset_ledger`。Banner 支持 `B1~B5`，也兼容历史 `BNR_001~BNR_005`。

撤单走 `POST /account/bet_cancel`。当前以 JWT 中的 user_id 为准，不再信任请求体 user_id。repository 锁定注单，只有 `live` 状态可撤，撤单后更新为 `CANCELLED`，释放 bet lock 到 available，并写 `cancel_bet` 流水。

领取走 `POST /account/bet_claim`。新逻辑不再直接用预计派彩，而是读取结算 worker 写入的 `actual_payout`，要求注单状态是 `WON` / `PUSH` / `VOID`，并通过 `asset_ledger` 中 `claim_prize + ref_id` 保证幂等。失败时会返回稳定机器状态码，例如 `CLAIM_AMOUNT_MISMATCH`、`INVALID_BET_STATUS_FOR_CLAIM`。

History 走 `GET /account/portfolio/history`。当前先取用户最近 1000 条 `asset_ledger`，在 service 内存中按 type、tab/status、result、search、begin_date、end_date 过滤，再批量补普通注单或 Banner 注单的 `event_info`。`type` 支持逗号分隔多选，合法枚举是 `all`、`bet`、`bet_cancel`、`bet_won`、`bet_lost`、`bet_banner`、`claim_prize`、`withdraw`、`deposit`、`stake`、`unstake`、`add_lp`、`remove_lp`、`cancel_withdraw`；`bet` 表示所有普通/Banner 下注流水，不按 `pending/live/WON/LOST/PUSH/VOID` 结算状态过滤，前端“全部投注”可用 `type=bet,bet_cancel,claim_prize` 聚合下注、撤单和领奖。分页后再补顶层 `status` 和 `enable_claim`：bet/claim 默认成功，withdraw 根据 `withdraw_record.status` 映射为进行中、审核中、成功、失败、已取消等；`enable_claim` 只会在普通 `single/parlay` 注单已结算为 `WON/PUSH/VOID`、`actual_payout` 为正数、且不存在同 bet_id 的 `claim_prize` 流水时返回 true，其余记录返回 false。

提现走 `/account/withdraw/*`。申请提现会校验金额、链、EVM 地址、签名时间、钱包签名和可用余额，然后在事务里冻结余额、写 `withdraw_record`、写 `asset_ledger`。取消提现只允许待审核状态，成功后解冻余额并写 `cancel_withdraw` 流水。管理员审核接口通过 Redis `admin:user:{user}` 校验密码。

## 5. 配置加载方式

实际代码只调用 `config.LoadDefault()`，固定读取当前工作目录下的 `./config.yaml`。`config_dev.yaml` 存在，但不会自动加载；`README.md` / `DEPLOY.md` 提到的环境变量覆盖也没有在当前代码里实现。

`server.env` 只影响表名选择：`env == "dev"` 时多数组表会切到 `_dev` 表，例如 `user_dev`、`user_balance_dev`、`asset_ledger_dev`、`user_bet_holding_dev`、`banner_bet_order_dev`、`oddfi_dev_odds`、`oddfi_dev_fixtures`。非 dev 则使用正式表名。

注意 Dockerfile 里写的是复制 `config_prod.yaml` 到 `/app/config.yaml`，但当前项目文件列表里没有 `config_prod.yaml`，这会影响镜像构建或部署一致性。

## 6. Redis / MySQL / Kafka / HTTP Client 使用位置

MySQL 是主存储。连接封装在 `internal/pkg/mysql/client.go`，repository 里主要使用 GORM。核心表包括用户、余额、充值地址、下注持仓、Banner 注单、资产流水、提现记录、赔率、赛事。

Redis 主要用在这些地方：钱包登录 session：`wallet_session:{session_id}`；refresh token：`refresh_token:{user_id}`；access token 黑名单：`token_blacklist:{jti}` 判断 access token 是否已退出登录；管理员密码：`admin:user:{user}`；价格缓存：`market:price:{chain}:{symbol}`；用户创建后还会把充值地址加入集合 `deposit_addresses_{chain}`；普通下注成功后会写入不过期的流动池赛事热度计数 `liquidity:fixture:bet_count:{fixture_id}`。

Kafka 当前没有使用。代码和 `go.mod` 里没有 Kafka client，也没有 producer / consumer。

HTTP Client 当前没有出站调用。`net/http` 只用于启动 HTTP Server、状态码、测试；外部行情、赔率、链上交互都不在本服务内直接调用。

## 7. 关键数据结构

- `User`：用户主表，核心字段是 `user_id`、`signing_address`、状态、KYC、2FA 信息。
- `UserBalance`：资金账户，包含 available、claimable、frozen、bet_lock、stake_lock、liq_lock。
- `AssetLedger`：资产流水，记录业务类型、金额、各类余额变动前后快照、`ref_id`。
- `UserBetHolding`：普通注单，保存 odd_id、stake、odds 快照、payout、actual_payout、market、label、handicap_line、status。
- `OddDB` / `FixtureDB`：赔率和赛事展示数据，普通下注校验依赖 `OddDB.value`、`market_id`、`handicap`、`total`、`stopped`。
- `BannerBetOrder`：首页 Banner 下注记录，独立于普通下注表。
- `WithdrawRecord`：提现单，状态为 1 待审核、2 处理中、3 完成、4 驳回、5 打款失败、6 用户取消。
- `DepositAddress` / `UserDepositAddress`：充值地址池和用户分配关系。
- `DepositRecord`：充值记录模型已定义，但当前 API 流程没有完整接入。
- `HistoryLedgerStatus`：History 顶层展示状态，1 进行中、2 审核中、3 成功、4 失败、5 申诉中、6 已取消。

## 8. 潜在风险点

配置和密钥风险较高：`config.yaml`、`config_dev.yaml` 中存在明文数据库密码、Redis/JWT 配置；启动日志还会打印完整 config，middleware 也会记录请求 body，可能把签名、提现地址、token 相关数据打进日志。

配置加载和部署文档不一致：代码只读 `config.yaml`，不读环境变量；Dockerfile 需要 `config_prod.yaml`，但当前项目没有该文件；README 中 Go 版本写 1.25+，go.mod 是 1.24.1，Dockerfile 用 1.25。

钱包登录有细节问题：Redis session TTL 是 5 分钟，但代码里过期判断是 `CreatedAt + 5*50`，实际约 250 秒；message 只解析 nonce，没有严格校验 account、chainID、issuedAt、expiration time 的可信语义。

普通下注风控还不完整：`validateBetSnapshot` 中 market / label 校验被注释掉，赛事开始时间禁止下注也被注释掉；当前主要校验 odds、stopped、handicap_line。

新用户创建仍有测试资金：`CreateAllUserIDWithSigningAddress` 会给新用户 `available_balance = 10000`，注释写着“仅测试阶段用”。

History 查询性能和准确性有限：最多只拉最近 1000 条流水后内存过滤，分页 total 只代表这 1000 条里的结果；用户流水变大后需要 SQL 层过滤和分页。

资金状态机不完整：充值、stake、LP、链上提现执行、结算 worker 都不是本服务完整闭环。History 对这些状态有部分成功占位逻辑。

安全模型偏 MVP：用户密码 hash 目前是明文函数，admin 密码存在 Redis 明文，CORS 同时设置 `*` 和 credentials，日志脱敏不足。

表结构和迁移缺失：没有统一 migration 工具，Banner 表建表 SQL 在文档里，mock SQL 脚本写的是正式表 `oddfi_odds` / `oddfi_fixtures`，但 dev 环境代码读 `oddfi_dev_odds` / `oddfi_dev_fixtures`。

限流器有内存管理缺口：IP limiter map 会持续增长，`CleanupExpired` 目前没有实际删除过期 IP，且未被启动。

## 9. 本地运行方式

1. 准备 Go、MySQL、Redis。Go 版本以 `go.mod` 的 1.24.1 和 Dockerfile 的 1.25 之间统一一个版本，建议先用 1.25。
2. 确认 `config.yaml` 指向本地 MySQL / Redis，并确认 `server.env` 与实际表名一致。`env=dev` 时必须准备 `_dev` 表。
3. 准备数据库表结构。项目没有完整 migration，需要按模型和 `BANNER_BET_DEPLOY.md` 创建核心表；Banner 表需额外建 `banner_bet_order` 或 `banner_bet_order_dev`。
4. 准备 Redis 数据。管理员接口需要 `admin:user:{user}`；市场价格接口需要 `market:price:bsc:odd`。
5. 可执行测试：`go test ./...`。当前测试主要覆盖签名、History、Banner、盘口线、handler 参数逻辑，不依赖真实 MySQL 的集成测试较少。
6. 启动服务：`go run cmd/server/main.go`。本地默认 `config.yaml` 端口是 8080，健康检查是 `GET http://localhost:8080/health`。

## 10. 后续最值得重构或补测试的 5 个点

1. 重构 History 查询：把 type、status/tab、result、date、search、分页下推到 SQL，并补索引，避免 1000 条内存过滤造成 total 不准和性能瓶颈。
2. 补全下注风控：恢复并测试 market / label 校验、赛事开始时间校验、盘口别名映射、并发幂等冲突；增加真实 MySQL 事务级集成测试。
3. 加固认证和配置：密钥改环境变量或 secret 管理，启动日志和请求日志脱敏，用户/admin 密码做 hash，严格校验钱包登录 message 的 account、chain、过期时间。
4. 梳理资金状态机：把 deposit、withdraw、claim、settlement、stake、LP 的状态来源和 `asset_ledger` 写入规则统一成明确状态机，并补失败/回滚测试。
5. 建立部署与迁移体系：补 `config_prod.yaml` 或改 Dockerfile，落地 migration，统一 dev/prod 表名策略，提供本地 docker-compose 和种子数据脚本。

---

## 11. 预售模块（DD-INVEST V3 B0 — 2026-05-25）

本节记录 B0 batch 新增的所有模块，对应设计文档 `docs/dd-invest/`。

### 11.1 新增数据表（8 张业务表）

| 表名 | 用途 | 归属 |
|---|---|---|
| `presale_round` | 轮次配置（6 行初始），状态机 upcoming/active/paused/ended | web-api |
| `presale_deposit` | 链上 USDT Transfer 入账记录，替代 V2 presale_order，幂等键 uk_(tx_hash,log_index) | web-api |
| `presale_config` | 单行全局配置（金库地址、TGE 时间、最小认购额等），PK=1 | web-api |
| `presale_holding` | 持仓聚合，按 (user_id, round_id, source) 唯一，source=1 invest / 2 referral | web-api |
| `presale_event_cursor` | 监听器游标，每个金库地址一行，与 deposit 同事务提交保证不漏块 | web-api |
| `presale_ops_event` | 异常事件待处理（overflow/unclaimed/round_mismatch/...），Lark 推送后运营处理 | web-api |
| `user_referral_code` | 邀请码（站点级，0x+6位字符），用户首次登录自动生成 | web-api |
| `user_referral_bind` | 邀请绑定关系（站点级，一次绑定不可改），bound_at 是奖励生效时间锚点 | web-api |

Migration 文件：`migrations/0001_create_presale_round.sql` … `0008_create_user_referral_bind.sql`（按顺序执行）。
Seed 文件：`seed/presale_rounds.sql`（6 轮初始数据，上线前与 PRD 和前端 stages.ts 二次对齐）。

### 11.2 新增 Model 包（`internal/model/`）

| 文件 | 关键设计 |
|---|---|
| `presale_round.go` | RoundStatus / RoundType 常量；TableName() dev 后缀；ManualOverride 阻止 cron 覆盖运营操作 |
| `presale_deposit.go` | PresaleDepositStatus 三态常量（与旧 DepositStatus int8 区分）；AnomalyReason 9 个枚举；PresaleDepositSource 双轨来源 |
| `presale_config.go` | 单行表 model，id 固定为 1，无 CreatedAt |
| `presale_holding.go` | HoldingSourceInvest=1 / HoldingSourceReferral=2；locked_price_avg 加权公式注释；vesting 字段保留但本期不维护 |
| `presale_event_cursor.go` | PrimaryKey=vault_address；无 CreatedAt |
| `presale_ops_event.go` | OpsEventStatus 四态常量 |
| `user_referral_code.go` | TableName 不加 dev 后缀（站点级基础设施） |
| `user_referral_bind.go` | TableName 不加 dev 后缀；business 字段扩展性预留 |

时间字段统一 `int64`（毫秒），`autoCreateTime:milli` / `autoUpdateTime:milli`，与现有 `asset_ledger.go` 的 `time.Time` 风格不同（DD 文档明确要求新表用毫秒 int64）。

### 11.3 新增 Repository 包（`internal/repository/`）

8 个文件，每个文件先声明 interface 再实现 struct，构造函数接受外部 `*gorm.DB`（便于 service 层注入事务 tx）。

关键设计点：

- **`PresaleRoundRepository.IncrSoldAndRaised`**：单条 UPDATE + 乐观条件 `sold_odd + delta <= supply_odd`，RowsAffected=0 返回 `ErrCapacityExceeded`，调用方走 overflow anomaly 流程。
- **`PresaleDepositRepository.CreateOrGet`**：`clause.OnConflict{DoNothing:true}` + SELECT 回已有记录，返回 `(record, created bool, err)`，双轨幂等核心。
- **`PresaleHoldingRepository.UpsertInvest`**：`INSERT ... ON DUPLICATE KEY UPDATE` 单语句内计算加权平均成本价，避免 SELECT-then-UPDATE 竞态。公式：`new_avg = (old_total×old_avg + delta×price) / (old_total + delta)`。
- **`PresaleEventCursorRepository.EnsureAll`**：`clause.OnConflict{DoNothing:true}` 批量 INSERT，已有游标不覆盖，Worker 重启后安全续扫。
- 所有 repository 方法接受外部事务参数 `tx *gorm.DB`（nil 时使用自身 db），事务边界由上层 service 管理。

### 11.4 新增 Config（`internal/config/`）

- `presale.go`：`PresaleConfig` struct，字段含 VaultPool（[]string）、UsdtAddress、BscRpcUrl、ConfirmBlocks、PollIntervalSec、BoundaryToleranceMin、LarkWebhookUrl、RedisLeaderKey、RedisLeaderTTLSec。
- `config.go`：`Config` struct 新增 `Presale PresaleConfig` 字段；`Init()` 函数新增 env 变量合并逻辑（env 优先级高于 yaml，零值字段从 env fallback，env 前缀 `PRESALE_*`）。

### 11.5 新增 Binary（`cmd/presale-worker/`）

`cmd/presale-worker/main.go` — 独立进程，与 web-api HTTP server 同机部署但进程分离。

启动方式：
```bash
go run cmd/presale-worker/main.go
# 或构建后运行
go build -o bin/presale-worker cmd/presale-worker/main.go && ./bin/presale-worker
```

本期骨架实现：
1. config + logger + DB(GORM) + Redis 初始化
2. `EnsureAll` 游标初始化（启动时按 env PRESALE_VAULT_POOL 建游标行，必须先于扫块）
3. Redis `SET NX EX` leader 抢锁循环（每 TTL/3 秒续约，非 leader 空转等待）
4. `runRoundStatusCron`：每 5min tick，本期打日志占位（B1 接入 service 层）
5. `runConfirmCron`：每 PollIntervalSec tick，本期打日志占位（B2 接入链上监听器）
6. 优雅退出：SIGINT/SIGTERM → cancel ctx → 2s drain → 关 Redis/MySQL

B2 接入时，在 `runLeaderWork` 中取消注释：
```go
// go chain.NewPresaleListener(cfg, db, log).Run(ctx)
// 对应文件：internal/chain/presale_listener.go（B2 新建）
```

### 11.6 B0 遗留注意事项

- `presale_admin_audit` 表在 admin-backend 仓库，B0 不涉及。
- P0 单测目前使用纯 Go（无 sqlmock/sqlite）：加权平均公式测试覆盖精度验证（5 cases，含 18 位小数断言）；DB 层幂等测试（CreateOrGet/EnsureAll/IncrSoldAndRaised）需集成测试（连真实 MySQL）覆盖，标记为 TODO 待 B1 补齐。
- 若需引入 `github.com/DATA-DOG/go-sqlmock`（33k star，活跃维护）可补全 P0 DB 层单测，需 orchestrator 确认后 `go get`。

### 11.7 P1 TODO（B1 前必须补齐）

- **引入 `DATA-DOG/go-sqlmock`**：B1 前引入 `github.com/DATA-DOG/go-sqlmock`，补以下 4 条 P0 case 的真 SQL 验证：
  1. `CreateOrGet` 幂等：相同 `(tx_hash, log_index)` 二次调用返回 `created=false` + 已有记录
  2. `IncrSoldAndRaised` 超额：`sold_odd + delta > supply_odd` 时 RowsAffected=0 返回 `ErrCapacityExceeded`
  3. `UpsertInvest` 加权平均：`ON DUPLICATE KEY UPDATE` 生成正确 SQL，`locked_price_avg` 按公式更新
  4. `EnsureAll` 幂等：重复调用不覆盖已有游标（`clause.OnConflict{DoNothing:true}`）
- **`invested_usd=0` 验证**：`UpsertReferral` 的 referral 行 `invested_usd` 恒为 0 语义，待 sqlmock 引入后补集成测试验证（原 `TestUpsertReferral_InvestedUsdIsZero` 因未验证实际 SQL 行为已删除）。

---

## 12. 站点级邀请系统（DD-INVEST V3 B1 — 2026-05-25）

本节记录 B1 batch 新增的邀请系统模块，对应设计文档 `docs/dd-invest/batches/B1-referral.md`。

### 12.1 模块定位

邀请系统是站点级基础设施（不依赖 presale 业务），解耦理由：
- **后续业务复用**：投注、任务等业务可通过 `business` 字段接入，无需各自实现
- **奖励计算分离**：邀请系统只管"谁邀请了谁"；ODD 奖励计算由 presale deposit service（B2）在 confirm-deposit 事务内执行
- **邀请关系永久性**：一旦绑定不可撤销/不可改

### 12.2 新增文件清单

| 文件 | 类型 | 说明 |
|---|---|---|
| `internal/service/referral.go` | 新建 | `ReferralService` interface + 实现，含 CSPRNG 邀请码生成、绑定、查询 |
| `internal/service/referral_test.go` | 新建 | 13 个 P0 单测（字符集、重试、自邀阻断、重复绑定幂等） |
| `internal/handler/referral.go` | 新建 | 3 个 HTTP handler（GET /me, POST /bind, GET /list） |
| `internal/handler/referral_test.go` | 新建 | 9 个 httptest 黑盒测试 |
| `internal/router/referral.go` | 新建 | `RegisterReferralRoutes` 注册 `/api/v1/referral/*` 路由组 |
| `scripts/presale-ops/backfill-referral-codes.go` | 新建 | 既有用户邀请码一次性补齐脚本（含 `--dry-run`） |

修改文件：

| 文件 | 修改内容 |
|---|---|
| `internal/middleware/auth.go` | 新增 `WithReferralService` option 方法；JWT 鉴权成功后异步触发 `GenerateCodeForUser` hook |
| `cmd/server/main.go` | 装配 referralService + referralHandler；注入到 authMiddleware；注册路由 |
| `internal/router/router.go` | `Setup` 函数新增 `referralHandler` 参数；调用 `RegisterReferralRoutes` |
| `internal/repository/user_referral_code.go` | 追加 `InsertIgnore` 方法（不改既有签名） |
| `internal/repository/user_referral_bind.go` | 追加 `ListByReferrerFiltered`（带 business 筛选，不改既有签名） |
| `internal/repository/presale_holding.go` | 追加 `SumReferralOdd`（按 source=2 聚合，不改既有签名） |
| `internal/repository/presale_deposit.go` | 追加 `ListByReferrerUserID`（批量查邀请入账，不改既有签名） |

### 12.3 邀请码规格

| 项目 | 值 |
|---|---|
| 字符集 | `[2-9A-HJ-NP-Z]`（去掉视觉混淆字符 0/1/I/O） |
| 字符集大小 | **32 个**（8 数字 + 24 字母）|
| 长度 | 6 位（带 `0x` 前缀共 8 字符） |
| 空间 | 32^6 ≈ 10.74 亿 |
| 碰撞策略 | CSPRNG + 5 次重试；全部失败推 Lark 告警（B4 接入） |
| 存储 | 大写存储，查询时输入归一化（`strings.ToUpper + strings.TrimSpace`） |

> **注意**：B1 spec 注释写"30 字符集"有误（实际字符串字面量 32 个），以代码字符串为准。

### 12.4 关键设计决策

**登录 hook 异步化**：`auth.go` 在 JWT 鉴权成功后启动 goroutine 异步调用 `GenerateCodeForUser`，失败仅 warn 日志，不阻断登录主链路。`referralSvc` 通过 `WithReferralService` option 方法注入，nil 时跳过（向后兼容旧装配）。

**ListReferred 两次查询 + 内存聚合**：先查 `user_referral_bind`（分页），再按被邀请人 ID 批量查 `presale_deposit`，内存 map 聚合。避免大 JOIN 竞态，binds 分页上限 100，不存在 N+1 风险。

**totalRewardOdd 从 presale_holding 聚合**：`GET /me` 的 `stats.totalRewardOdd` 从 `presale_holding.source=2` 求和，而非从 `presale_deposit` 求和，因为 holding 是经过 migrate-round 修订后的最终真相。

**自邀阻断**：`BindReferral` 校验邀请码持有人 `user_id` ≠ 当前登录 `user_id`，返回 `40004 SELF_REFERRAL`。

**幂等绑定**：先 `GetByUserID` 检查是否已绑，已绑返回 `40903 ALREADY_BOUND`（前端自动绑场景静默处理）；`CreateIdempotent` 使用 `ON DUPLICATE KEY UPDATE user_id=user_id` 作为最终安全兜底。

### 12.5 API 路由

| 方法 | 路径 | 鉴权 | 限流 |
|---|---|---|---|
| GET | `/api/v1/referral/me` | JWT | 60 req/min/user（nginx 层）|
| POST | `/api/v1/referral/bind` | JWT | 5 req/min/user（nginx 层）|
| GET | `/api/v1/referral/list` | JWT | 60 req/min/user（nginx 层）|

> Minor：per-route 精细限流待 B4 接入 redis-based rate limiter 后补充，当前 nginx 层兜底。

### 12.6 既有用户补齐

`scripts/presale-ops/backfill-referral-codes.go`（`//go:build ignore`，不参与正常构建）：

```bash
# 演练：统计需补齐用户数
go run scripts/presale-ops/backfill-referral-codes.go --dry-run --dsn="user:pass@tcp(host:3306)/db?charset=utf8mb4"

# 实际执行（生产前必须先 dry-run）
go run scripts/presale-ops/backfill-referral-codes.go --dsn="..."
```

- 分批处理（batchSize=100），批次间 10ms 间隔，避免 DB 突发压力
- TODO(B3)：接入 `presale_admin_audit`，operator="script:backfill-referral-codes"

### 12.7 DD Spec 内部矛盾记录

| 矛盾项 | Spec 描述 | 实际实现 | 说明 |
|---|---|---|---|
| 字符集大小 | 注释写"30 个" | 实际 32 个 | 字面量去掉 I/O（不去 L），regex `[2-9A-HJ-NP-Z]` 确认 32 个 |
| 碰撞空间 | "30^6 ≈ 7.29 亿" | 32^6 ≈ 10.74 亿 | 以字符串字面量为准，空间更大 |
| 去除字符 | 注释"去 0/O/1/I/L" | 实际去 0/1/I/O | L 在字符集中，M 也在，注释有误 |

---

## 13. 预案脚本 + Lark Webhook 模块（DD-INVEST V3 B4 — 2026-05-25）

本节记录 B4 batch 新增的预案脚本集合、Lark Webhook service 和 Claude Code skill 封装。

### 13.1 模块定位

B4 实现预售异常处理的完整闭环：

```
链上异常事件
    │
    ▼
presale_ops_event 落库（B2 写入）
    │
    ▼
LarkWebhookService.Notify → 运营群 @oncall
    │
    ├─── 路径 A：管理员走 admin HTTP 接口（B3 实现）
    │
    └─── 路径 B：运营 SSH 跑预案脚本（B4 实现）
              │
              ▼
         .claude/skills/presale-ops  ← Claude Code skill 封装
         运营通过自然语言触发脚本 + dry-run 确认
```

两条路径效果等价，均落 `presale_admin_audit`，`operator = "script:filename"`，`source = "script"`。

### 13.2 新增文件清单

| 文件路径 | 类型 | 说明 |
|---|---|---|
| `internal/service/lark_webhook.go` | 新建 | `LarkWebhookService` + `AnomalyAlerter` 接口 + `LarkEvent` + `Notify` 异步推送 |
| `internal/service/lark_webhook_test.go` | 新建 | mock HTTP client，验证 5 种事件 payload 字段 + 颜色模板 |
| `scripts/presale-ops/shared/flags.go` | 新建 | 统一 flag 解析 + `--note ≥10 字符`校验 + `--dry-run` 默认 true |
| `scripts/presale-ops/shared/db.go` | 新建 | `InitDB` 从 env/config 起 GORM 连接 |
| `scripts/presale-ops/shared/audit.go` | 新建 | `WriteAudit` 在事务内 INSERT `presale_admin_audit` |
| `scripts/presale-ops/shared/lark.go` | 新建 | `NewLarkFromEnv` + `NotifyScript` 脚本推送 helper |
| `scripts/presale-ops/shared/audit_test.go` | 新建 | sqlmock 验证 SQL 参数（operator/action/source/note 字段） |
| `scripts/presale-ops/unclaimed-credit.go` | 新建 | 无主转账确认转单（convert_to_deposit / reject） |
| `scripts/presale-ops/overflow-handle.go` | 新建 | 超额到账处理（partial_fill / next_round / hold） |
| `scripts/presale-ops/late-arrival.go` | 新建 | 跨轮次到账兜底（迁移 round_id） |
| `scripts/presale-ops/migrate-round.go` | 新建 | 通用 round_id 迁移，与 admin migrate-round 接口等价 |
| `scripts/presale-ops/round-pause.go` | 新建 | 紧急轮次暂停 |
| `scripts/presale-ops/README.md` | 新建 | 预案手册：快速定位表 + 环境配置 + 执行步骤 + 回滚说明 |
| `.claude/skills/presale-ops/SKILL.md` | 新建 | Claude Code skill：触发词 + 场景识别 + 命令生成模板 + 安全约束 |

修改文件：

| 文件路径 | 修改内容 |
|---|---|
| `internal/service/presale_deposit_impl.go` | 新增 `AnomalyAlerter` 字段；`NewPresaleDepositService` 增加可选 `larkAlerter` 参数（变参，向后兼容）；`recordAnomaly` 调用 `larkAlerter.SendAnomalyAlert` |
| `cmd/server/main.go` | 从 `cfg.Presale.LarkWebhookUrl` 构造 `LarkWebhookService`，注入 `NewPresaleDepositService`；URL 为空时注入 `noopAnomalyAlerter` |

### 13.3 LarkWebhookService 关键设计

| 项目 | 设计 |
|---|---|
| 接口名 | `AnomalyAlerter`（区别于 B1 referral.go 的 `LarkAlerter` 基础文本接口） |
| 异步推送 | `Notify` 在 goroutine 内执行 HTTP POST，内置 `recover` 防止 panic 传播 |
| 5 种事件类型 | `overflow`(红) / `unclaimed`(橙) / `paused_arrival`(蓝) / `round_mismatch`(橙) / `admin_op`(绿) |
| 推送格式 | Lark Card Message（`msg_type: interactive`），含 header 颜色 + 正文 Markdown + 查看详情按钮 |
| 失败处理 | HTTP 失败仅 warn 日志，不返回错误，不阻断业务事务 |
| noop 降级 | URL 未配置时使用 `noopAnomalyAlerter{}`，方法体为空，不 panic |

### 13.4 预案脚本通用设计

所有脚本遵循以下约定：

- **独立 main binary**：`//go:build ignore` 标记，`go run` 直接执行，不参与 `go build ./...`
- **默认 dry-run**：`flag.BoolVar(&dryRun, "dry-run", true, ...)`，不传参数只输出 diff
- **--note 强制校验**：`utf8.RuneCountInString(note) < 10` 时 `os.Exit(1)`
- **事务边界**：所有 DB 变更（含 audit INSERT）在单一 `db.Transaction` 内执行
- **audit 记录**：`operator = "script:filename"`，`source = "script"`，`operator_role = "script"`
- **Lark 推送**：Commit 后异步调用 `shared.NotifyScript`，失败不影响脚本退出码

### 13.5 shared/ 子包说明

`scripts/presale-ops/shared/` 是 `package shared`，被各脚本 `main` 包 import：

| 文件 | 导出函数/类型 | 说明 |
|---|---|---|
| `flags.go` | `ParseCommonFlags() *Flags` / `ValidateNote(note)` / `ConfirmOrExit()` | 统一 flag + 校验 |
| `db.go` | `InitDB(env) *gorm.DB` / `CloseDB(db)` | 连接池管理 |
| `audit.go` | `WriteAudit(tx, AuditEntry) error` | 事务内写 audit |
| `lark.go` | `NewLarkFromEnv() *LarkWebhookService` / `NotifyScript(...)` | 脚本推送 helper |

### 13.6 依赖变更

新增测试依赖：`github.com/DATA-DOG/go-sqlmock v1.5.0`（audit_test.go mock DB 验证 SQL 参数）

### 13.7 B4 遗留注意事项

- `round-resume.go` / `round-reopen.go` / `round-close.go` 未实现（admin HTTP 已覆盖）；紧急场景先用 `round-pause.go` 示例模仿手动执行
- `presale_admin_audit` 表在 admin-backend 仓库，本期 dev MySQL 若未运行 B3 migration，`WriteAudit` 会报表不存在错误；可用 mock 或本地 sqlite 模拟（测试已覆盖）
- B1 的 `LarkAlerter` 接口（`Alert(ctx, msg)`）与 B4 的 `AnomalyAlerter` 接口（`SendAnomalyAlert(LarkEvent)`）共存，职责不同：前者是简单文本告警，后者是结构化预售异常推送
