已完整阅读当前仓库的代码、现有文档、脚本和近期 git 历史；本轮没有修改任何文件。`go test ./...` 已跑通。

下面是可直接落地成 `新同事接手项目指南.md` 的版本。

# 新同事接手项目指南.md

## 1. 项目整体用途

`oddfi-bet-settle` 是 Oddfi 的后台结算 worker，不是 HTTP API 服务。它的核心职责是：从 MySQL 读取 spider 已经落库的赛事、赔率、赛果快照，找到未结算注单，按比赛最终状态和比分判定 `WON / LOST / PUSH / VOID`，再把资金从 `user_balance.bet_lock_balance` 释放到 `user_balance.claimable_balance`。

一句话边界：

`spider 管采集事实，web-api 管对外接口和下注，bet-settle 管赛后资金结算。`

最近几轮历史改动的主线是：

- 服务收敛成 worker-only，不再暴露 Gin / HTTP API。
- 普通结算不再直接请求 SportMonks，而是只消费 `FixtureDB / FixtureResult / OddDB`。
- 结算候选链路改为 `user_bet_holding.odd_id -> oddfi_odds.odd_id -> oddfi_odds.fixture_id -> oddfi_fixture_results.fixture_id`。
- 新增欧冠 5 分钟 mock 盘：`葡萄牙 vs 阿根廷`，用于前端真实下注、真实锁仓、真实结算体验。
- 补齐 `claimable_balance` 作为结算后、用户 claim 前的资金承接账户。

主要参考文件：

- [ARCHITECTURE.md](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/ARCHITECTURE.md:1)
- [PROD_RUNBOOK.md](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/PROD_RUNBOOK.md:1)
- [SELF_TEST.md](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/SELF_TEST.md:1)
- [mock_match_data.md](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/mock_match_data.md:1)

## 2. 目录结构说明

```text
.
├── cmd
│   ├── server        # 主进程入口，负责加载配置、初始化 DB、启动 worker
│   └── worker        # 普通结算 worker + UCL mock worker
├── config            # 配置结构和本地示例配置
├── internal
│   ├── db            # GORM MySQL 初始化、连接池、AutoMigrate
│   ├── model         # 表模型、状态枚举、SportMonks state_id 映射
│   └── service       # 纯结算规则：JudgeBet、CalcPayout、比分提取、单测
├── scripts           # 本地/联调/生产 mock seed、assert、repair SQL
├── ARCHITECTURE.md   # 当前服务架构说明
├── PROD_RUNBOOK.md   # 生产上线和排障手册
├── SELF_TEST.md      # 本地自测手册
├── Dockerfile        # worker-only 镜像构建
└── deploy.sh         # build/push/run/restart 容器脚本
```

注意：`internal/ws` 和 `internal/pkg` 目录目前没有实际代码；README 里早期提到 Redis / WebSocket / repository 的描述，已经和当前实现有偏差，读代码时以 `cmd/worker`、`internal/service`、`internal/model` 为准。

## 3. 程序启动入口

主入口是 [cmd/server/main.go](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/cmd/server/main.go:16)。

启动流程：

1. 读取 `-config` 参数，默认是 `config/config_prod.yaml`。
2. 调用 `config.LoadConfig` 加载 YAML。
3. 用 `db.NewDBStorage(cfg.MySQL.DSN)` 初始化 GORM MySQL。
4. 启动普通结算 worker：`StartPolling`，30 秒一轮。
5. 如果 `settlement.mock_ucl.enabled=true`，再启动 UCL mock worker。
6. 监听 `SIGINT / SIGTERM`，取消 context 并关闭 DB 连接池。

普通 worker 启动位置：

- [cmd/server/main.go](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/cmd/server/main.go:47)
- [cmd/worker/worker.go](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/cmd/worker/worker.go:68)

UCL mock worker 启动位置：

- [cmd/server/main.go](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/cmd/server/main.go:56)
- [cmd/worker/mock_ucl.go](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/cmd/worker/mock_ucl.go:89)

Docker 启动入口固定为：

```text
./oddfi-bet-settle -config config/config_prod.yaml
```

对应 [Dockerfile](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/Dockerfile:33)。

## 4. 核心业务流程

真实赛事结算流程：

1. spider 写入赛事主档、赔率、赛果快照。
2. `bet-settle` 每 30 秒查一次存在未结注单的赛事。
3. 查询链路不是按注单 `match_id`，而是按 `odd_id` 反查：
   `user_bet_holding.odd_id -> oddfi_odds.odd_id -> oddfi_odds.fixture_id -> oddfi_fixture_results.fixture_id`
4. 根据 `FixtureResult.state_id` 找业务动作：
   `5/7/8` 进入正常结算，`12/14/15/17/20` 进入退款，进行中或未知状态挂起。
5. 正常结算时，优先解析 `raw_score_data`，取不到再回退 `home_score_full / away_score_full`。
6. 对同场未结注单加 `FOR UPDATE` 行锁，逐笔调用 `JudgeBet`。
7. 更新注单：`status`、`actual_payout`、`updated_at`。
8. 更新余额：`bet_lock_balance -= stake`；如果 payout 大于 0，则 `claimable_balance += payout`。
9. 更新 `fixture_results.settlement_status` 为 `PROCESSED` 或 `ERROR`。

关键代码：

- 候选赛事查询：[cmd/worker/worker.go](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/cmd/worker/worker.go:331)
- 状态分发：[cmd/worker/worker.go](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/cmd/worker/worker.go:275)
- 锁单：[cmd/worker/worker.go](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/cmd/worker/worker.go:153)
- 注单与余额落账：[cmd/worker/worker.go](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/cmd/worker/worker.go:176)
- 玩法判定：[internal/service/settle_service.go](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/internal/service/settle_service.go:46)

UCL mock 盘流程：

1. 固定 fixture：`99200001`，名称 `葡萄牙 vs 阿根廷`。
2. 固定 15 条赔率，覆盖 1x2、让球、大小球。
3. 每轮 300 秒：前 240 秒开盘，后 60 秒封盘，到点生成随机比分。
4. mock worker 用 MySQL `GET_LOCK` 做跨进程互斥。
5. 结算瞬间把赛果写成真实 `raw_score_data` 结构，再复用真实 `settleMatchTx`。
6. 结算后立刻开启下一轮，并把 `fixture_results` 重置为 `NS/PENDING`，避免下一轮新注单被旧比分误结算。

关键代码：

- 状态机：[cmd/worker/mock_ucl.go](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/cmd/worker/mock_ucl.go:156)
- MySQL 锁：[cmd/worker/mock_ucl.go](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/cmd/worker/mock_ucl.go:197)
- 结算并开下一轮：[cmd/worker/mock_ucl.go](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/cmd/worker/mock_ucl.go:379)

## 5. 配置加载方式

配置定义在 [config/config.go](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/config/config.go:10)，使用 Viper 读取 YAML。

运行时配置关键块：

```yaml
app:
  env: "prod" # prod 使用 user_bet_holding/user_balance；dev 使用 user_dev_*

mysql:
  dsn: "..."
  tables:
    fixtures: "oddfi_fixtures"
    fixture_results: "oddfi_fixture_results"
    odds: "oddfi_odds"

settlement:
  user_id: 0
  mock_ucl:
    enabled: false
    fixture_id: 99200001
    period_sec: 300
    bet_open_sec: 240
    lock_name: "oddfi_ucl_mock_5min"

sportmonks:
  api_token: ""
  base_url: ""

kafka:
  brokers: []
  topic: ""
```

几个容易踩坑的点：

- `-config` 不传时，主程序默认读 `config/config_prod.yaml`。
- `config.GetConfig()` 如果发现全局配置还没加载，会兜底读 `config/config.yaml`。
- `mysql.tables.fixture_results` 生产必须配置成真实表名，例如 `oddfi_fixture_results`；否则代码会回退到 `fixture_results`。
- `config/config_prod.yaml`、`config/config_oddfi_dev.yaml`、`config/config_selftest.yaml` 在 `.gitignore` 中，不应提交真实 DSN。
- Dockerfile 会把整个 `config/` 目录复制进镜像；本地构建生产镜像前一定确认私有配置内容正确。

## 6. Redis / MySQL / Kafka / HTTP Client 使用位置，核心数据模型结构

MySQL 是当前唯一实际运行依赖。初始化在 [internal/db/db.go](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/internal/db/db.go:23)，使用 GORM + MySQL driver，连接池配置为 `MaxIdle=10`、`MaxOpen=100`、`ConnMaxLifetime=1h`。启动时会 `AutoMigrate` 三张表模型：`OddDB`、`FixtureDB`、`FixtureResult`。

Redis 当前没有代码依赖，也没有 go-redis 包。README 曾提到 Redis 可用于分布式锁，但当前普通结算 worker 没接 Redis；UCL mock worker 用的是 MySQL `GET_LOCK`。

Kafka 当前只有配置结构，没有 producer/consumer，也没有 Kafka SDK 依赖。结算成功后不发 Kafka 消息，WebSocket 广播也不在本服务做。

HTTP Client 当前没有实现。代码里没有 `net/http` 调 SportMonks 的路径；`sportmonks` 配置块仅为兼容保留。SportMonks 采集属于 spider 服务职责。

核心表模型：

- `UserBetHolding`：注单事实表，字段包括 `user_id`、`odd_id`、`market`、`label`、`handicap_line`、`stake`、`odds`、`status`、`actual_payout`。见 [internal/model/model.go](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/internal/model/model.go:27)。
- `FixtureResult`：赛果快照和结算状态机，字段包括 `state_id`、`home_score_full`、`away_score_full`、`raw_score_data`、`settlement_status`、`remark`。见 [internal/model/model.go](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/internal/model/model.go:60)。
- `OddDB`：赔率快照，结算通过 `odd_id -> fixture_id` 找赛事，不使用实时赔率。见 [internal/model/model.go](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/internal/model/model.go:151)。
- `UserBalance`：资金承接账户，结算扣 `bet_lock_balance`，非 LOST 派彩加 `claimable_balance`。见 [internal/model/model.go](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/internal/model/model.go:129)。
- `FixtureDB`：赛事主档，主要供 spider/web-api/mock 展示和关联。见 [internal/model/model.go](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/internal/model/model.go:182)。
- `AssetLedger`：资产流水模型存在，但当前 worker 不写资产流水。见 [internal/model/model.go](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/internal/model/model.go:100)。

## 7. 关键数据结构

`SettleWorker` 是主 worker 对象，持有 `*gorm.DB`、当前时间函数 `Now`、灰度用户 `SettlementUserID`。见 [cmd/worker/worker.go](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/cmd/worker/worker.go:29)。

`settlementCandidate` 是每轮扫描出来的赛事候选，来自注单、赔率、赛果三表联查。见 [cmd/worker/worker.go](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/cmd/worker/worker.go:36)。

`MatchStateRule` 是 SportMonks 状态到业务动作的唯一映射源。`FT/AET/FT_PEN` 结算，`CANCELLED/WO/ABANDONED/AWARDED/DELETED` 退款，未知状态 hold。见 [internal/model/match_state.go](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/internal/model/match_state.go:28)。

`Score` 是结算用比分，只保留 `Home/Away`。`SourceScore` 是解析 `raw_score_data` 的最小结构，兼容 participant 在顶层或 `score.participant` 两种格式。见 [internal/service/settle_service.go](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/internal/service/settle_service.go:24)。

`BetResult` 是单笔判定结果，包含 `Status` 和 `Payout`。见 [internal/service/settle_service.go](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/internal/service/settle_service.go:40)。

`mockUCLRuntimeConfig` 和 `mockUCLOddSeed` 是 UCL mock 盘运行配置和固定盘口种子。见 [cmd/worker/mock_ucl.go](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/cmd/worker/mock_ucl.go:49)。

## 8. 潜在风险点

1. `user_balance.claimable_balance` 是硬依赖。生产缺字段时，worker 查询或落账会失败，不能上线。

2. `user_bet_holding` 没有 `coin_symbol`。当前结算只能按 `user_id` 找唯一一条 `bet_lock_balance >= stake` 的余额行；同一用户多币种或多余额行时，worker 会拒绝猜测扣哪一条。

3. 普通结算 worker 没有全局分布式锁。它依赖注单行锁和 `WHERE status IN (...)` 做幂等保护；多实例虽然不容易重复入账，但会增加 DB 锁竞争和状态抖动。UCL mock 盘单独用了 MySQL `GET_LOCK`。

4. 启动会执行 GORM `AutoMigrate`。生产 DB 账号如果无 DDL 权限会启动失败；如果有 DDL 权限，则要接受 worker 自动同步 `odds/fixtures/fixture_results` 结构的风险。

5. `fixture_results.settlement_status` 是赛事级字段，不是用户级字段。单用户灰度模式下，worker 只处理指定用户注单，但仍会更新赛事级状态，排查时要优先看注单和余额，不要只看赛事状态。

6. 当前不写 `asset_leager / asset_ledger`。如果财务审计需要逐笔 before/after 流水，必须补齐资金流水写入，不能只依赖余额变化。

7. `raw_score_data` 解析失败会导致该赛事结算进入 `ERROR`。虽然代码有扁平字段兜底，但只在 raw 为空时兜底；raw JSON 非法会直接报错。

8. README 和 system 文档里仍有部分旧描述，例如直接请求 SportMonks、HTTP API、Redis、WebSocket 广播；以当前代码和 `ARCHITECTURE.md / PROD_RUNBOOK.md` 为准。

9. Docker 构建会复制本地 `config/`。因为私有配置是 gitignored 但不是 dockerignored，本地机器上如果有真实生产 DSN，会被打进镜像。

10. UCL mock 盘会真实写 `fixtures / odds / fixture_results` 并真实结算资金。`enabled=true` 前要确认目标库、fixture_id、seed/assert 脚本和测试用户资金都正确。

## 9. 本地运行方式

基础单测：

```bash
go test ./...
```

当前已验证通过。

本地构建：

```bash
go build -o bin/oddfi-bet-settle ./cmd/server
```

本地运行 worker：

```bash
./bin/oddfi-bet-settle -config config/config_selftest.yaml
```

或直接：

```bash
go run ./cmd/server -config config/config_selftest.yaml
```

本地自测建议按 [SELF_TEST.md](/Users/rongweihe/Desktop/Oddfi-Code/oddfi-bet-settle/SELF_TEST.md:1) 走：

1. 准备本地 MySQL。
2. 建自测库和表。
3. 导入自测 seed。
4. 启动 worker。
5. 查询注单状态、`actual_payout`、`bet_lock_balance`、`claimable_balance`。
6. 必要时跑 PRD 24 条 SQL seed/assert。

常用联调脚本：

```bash
mysql --protocol=tcp -h127.0.0.1 -uroot -p123456 < scripts/oddfi_dev_prd24_seed.sql
go run ./cmd/server -config config/config_oddfi_dev.yaml
mysql --protocol=tcp -h127.0.0.1 -uroot -p123456 < scripts/oddfi_dev_prd24_assert.sql
```

Docker 构建和启动：

```bash
./deploy.sh build
TAG=prod ./deploy.sh restart
```

注意：`deploy.sh` 启动的是 worker 容器，不映射端口，正式 API 由 `web-api` 服务承接。

## 10. 后续最值得重构或补测试的 5 个点

1. 给普通结算 worker 增加实例级互斥机制。可以选 Redis `SETNX`、MySQL advisory lock 或独立锁表，目标是减少多实例同时扫同一批赛事造成的锁竞争和状态抖动。

2. 修正资金定位模型。最好让 `user_bet_holding` 恢复或补充可验证的币种字段，结算时按 `user_id + coin_symbol` 精准锁余额行，避免当前“一用户一可扣余额行”的隐含假设。

3. 补集成测试。现在 `internal/service` 的判定单测覆盖不错，但 `cmd/worker` 的事务、锁、幂等、余额异常、raw JSON 异常、单用户灰度还缺 Go 层集成测试。

4. 处理资产流水。当前只更新余额，不写 `asset_leager / asset_ledger`。如果要满足财务审计，需要在同一事务里写入可追溯的结算流水，包含 bet_id、fixture_id、比分、玩法、公式和 before/after。

5. 关闭或隔离生产 AutoMigrate。生产 worker 启动时自动迁移 spider 相关表风险偏高，建议改成显式迁移脚本或配置开关，并在 runbook 中明确 DDL 流程。