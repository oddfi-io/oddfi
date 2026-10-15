## 接手项目指南.md

# 新同事接手项目指南

更新时间：2026-04-30  
项目：oddfi-web-spider  
定位：SportMonks 足球赛事数据采集 Worker，不是对外 HTTP API 服务。

## 1. 项目整体用途

`oddfi-web-spider` 是 OddFi 后端里的体育赛事数据采集服务。它的工作很直接：定时去 SportMonks 拉足球赛事详情、参赛队伍、赔率、统计、比分和状态，然后清洗成更适合前端和结算侧查询的 MySQL 表。

这个服务当前不提供 HTTP 接口，也没有启动 Gin/Fiber/NetHTTP server。它更像一个后台 Worker：

1. 启动后加载配置。
2. 连接 MySQL。
3. 创建 SportMonks REST Client。
4. 每小时跑一次固定 fixture id 列表采集。
5. 把采集结果 upsert 到 MySQL。
6. `oddfi-web-api` 等其他服务再查 MySQL 对外提供接口。

从历史改动看，这个项目最初偏“采集首页/详情页数据”，后来逐步补了赔率、统计、赛果底表 `fixture_results`、状态比分解析、结算触发的雏形，以及宿主机侧 Docker + Lark 监控脚本。Kafka、WS、Prometheus、应用内健康检查目前都属于“有设计或预留，但主流程没真正接上”。

## 2. 目录结构说明

```text
.
├── main.go
├── client/
│   └── rest.go
├── config/
│   ├── config.go
│   ├── config.yaml
│   └── config_local.yaml
├── kafka/
│   └── producer.go
├── model/
│   └── model.go
├── runner/
│   └── api_runner.go
├── service/
│   ├── spider_svc.go
│   └── spider_svc_test.go
├── storage/
│   └── mysql.go
├── utils/
│   └── utils.go
├── scripts/
│   └── monitor_docker_lark.py
├── docs/
│   ├── ARCHITECTURE.md
│   └── MONITORING.md
├── ARCHITECTURE.md
├── README.md
├── deploy.md
├── Dockerfile
├── build.sh
├── api_resp.json
├── go.mod
└── go.sum
```

核心目录说明：

| 路径 | 说明 |
| --- | --- |
| `main.go` | 程序入口，负责参数解析、配置加载、依赖初始化、运行模式分发、优雅退出 |
| `client/rest.go` | SportMonks REST API 封装，包含请求、重试、解析 wrapper、限流休眠 |
| `config/config.go` | Viper 配置加载，全局 `Config` 结构 |
| `config/config.yaml` | 当前 dev 配置，表名指向 `oddfi_prod_*`，包含 MySQL、SportMonks、Kafka 配置 |
| `config/config_local.yaml` | 本地配置，`app.env=local`，表名指向 `oddfi_*` |
| `model/model.go` | API DTO、数据库模型、动态表名 `TableName()` |
| `runner/api_runner.go` | 定时任务调度器，目前只注册 `all_sport_fixtures` |
| `service/spider_svc.go` | 核心业务层：拉数据、清洗、拆表、构建赛果、并行写库 |
| `storage/mysql.go` | GORM 初始化、连接池、AutoMigrate、批量 Upsert |
| `utils/utils.go` | 硬编码 fixture id 列表和时间解析工具 |
| `kafka/producer.go` | Kafka Writer 预留实现，当前主流程未初始化也未调用 |
| `scripts/monitor_docker_lark.py` | 宿主机侧 Docker 容器状态巡检和 Lark 异常告警脚本 |
| `docs/ARCHITECTURE.md` | 当前最完整的技术架构文档 |
| `ARCHITECTURE.md` | 根目录入口文档，主要指向 `docs/ARCHITECTURE.md` 和监控文档 |
| `api_resp.json` | SportMonks fixture 详情样例响应，代码不会读取它 |

## 3. 程序启动入口

入口是 `main.go`。

启动参数：

```bash
./web-spider -mode api -config config/config_local.yaml
```

参数说明：

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `-mode` | `api` | 当前只有 `api` 真正可用；`ws` 只打印“待实现” |
| `-config` | `config/config_prod.yaml` | 默认指向生产配置，但仓库里没有这个文件 |

启动流程：

1. `flag.Parse()` 解析 `-mode` 和 `-config`。
2. `config.LoadConfig(path)` 用 Viper 读取 YAML。
3. `storage.NewDBStorage(cfg.MySQL.DSN)` 初始化 GORM、连接池和 AutoMigrate。
4. 通过 `dbStorage.GetDB().DB()` 拿到底层 `*sql.DB`，退出时关闭连接池。
5. `client.NewRestClient(cfg.SportMonks.ApiToken)` 创建 SportMonks REST Client。
6. `service.NewSpiderService(restClient, dbStorage)` 组装业务服务。
7. `signal.NotifyContext` 监听 `os.Interrupt` 和 `SIGTERM`。
8. `-mode api` 时启动 `runner.APIRunner.StartForAllSport(ctx)`。
9. 收到退出信号后等待调度 goroutine 结束，再关闭 DB。

注意：直接执行默认命令大概率会失败，因为 `config/config_prod.yaml` 被 `.gitignore` 忽略，当前仓库不包含它。本地开发要显式指定 `config/config_local.yaml`。

## 4. 核心业务流程

当前主流程只有一个定时任务：`all_sport_fixtures`。

执行路径：

```text
main.go
  -> runner.NewAPIRunner(spiderSvc)
  -> APIRunner.StartForAllSport(ctx)
  -> scheduleTaskWithCtx
  -> runTaskSafely
  -> SpiderService.SyncFixturesAll / SyncFixturesAllLocal
  -> client.RestClient.Get*FixtureByID
  -> SpiderService.processAndSaveFixtures
  -> storage.DBStorage.Upsert*
  -> MySQL
```

调度逻辑：

| 环境 | 方法 | 采集范围 |
| --- | --- | --- |
| `app.env == local` | `SyncFixturesAllLocal` | 只采集 `utils.FixtureEuAllIDs` |
| 其他环境 | `SyncFixturesAll` | 采集世界杯、欧冠、其他联赛 fixture id 列表 |

采集逻辑：

1. 按硬编码 fixture id 列表串行请求 SportMonks。
2. 世界杯走 `GetWCFixtureByID`。
3. 欧冠走 `GetEUFixtureByID`。
4. 其他联赛走 `GetOtherFixtureByID`。
5. 每个 fixture 请求后固定 `time.Sleep(1 * time.Second)`，降低 API 压力。
6. 单个 fixture 请求失败时只打日志并跳过，不中断本轮。
7. 当前 `state_id=5` 的完赛比赛不会被过滤掉，历史提交特意修过这个点，原因是完赛数据仍然要正常更新，避免阻碍后续结算。

清洗和落库逻辑在 `processAndSaveFixtures`：

1. 把 `APIFixture` 转成 `model.Fixture`。
2. 解析 `starting_at`，生成 `StartingAt` 和 `StartingAtTimestamp`。
3. 要求 `participants` 至少 2 个，否则跳过该 fixture。
4. 根据 `participant.meta.location` 拍平主队和客队字段。
5. 过滤赔率，只保留 bookmaker `2` 或 `20`，market `1`、`6`、`7`。
6. 构建 `OddDB`，以 SportMonks odd id 作为主键。
7. 构建 `StatisticDB`，当前实际是全量保存 statistics，没有按注释里的 type_id 白名单过滤。
8. 根据 `scores` 和 `state` 构建 `FixtureResultDB`。
9. 用 `errgroup.Group` 并行写三条链路：
   - `UpsertFixtures(ctx, dbFixtures)` 后接 `UpsertFixtureResults(ctx, fixtureResults)`
   - `UpsertOdds(allOdds)`
   - `UpsertStatistics(allStatistics)`

赛果构建逻辑：

| 字段 | 来源 |
| --- | --- |
| `home_score_full` / `away_score_full` | 默认取 `CURRENT` |
| AET / FT_PEN 的常规全场比分 | 改取 `2ND_HALF`，避免把加时/点球后的比分当常规时间比分 |
| `home_score_half` / `away_score_half` | 取 `1ST_HALF` |
| `home_score_extra` / `away_score_extra` | 优先取 `EXTRA_TIME`，缺失时 AET/FT_PEN 用 `CURRENT` 兜底 |
| `home_score_penalty` / `away_score_penalty` | 取 `PENALTIES` |
| `raw_score_data` | 原始 scores JSON |
| `raw_state_date` | 原始 state JSON，字段名历史上写成 date，实际含义是 data/payload |

## 5. 配置加载方式

配置结构定义在 `config/config.go`：

```yaml
app:
  env: "local|dev|prod"

mysql:
  dsn: ""
  tables:
    leagues: ""
    fixtures: ""
    odds: ""
    statistics: ""
    states: ""
    fixture_results: ""

sportmonks:
  api_token: ""
  base_url: ""

kafka:
  brokers: []
  topic: ""
```

加载方式：

1. `main.go` 显式调用 `config.LoadConfig(*configPath)`。
2. `LoadConfig` 使用 `viper.SetConfigFile(path)` 和 `viper.ReadInConfig()`。
3. 读取失败或解析失败会 `log.Fatalf` 直接退出。
4. `config.GetConfig()` 内部有 `sync.Once`，如果外部没先加载，会默认加载 `config/config.yaml`。
5. 数据库模型的 `TableName()` 会动态读取 `config.GetConfig().MySQL.Tables`，为空时使用默认表名。

当前配置注意点：

| 配置点 | 当前状态 | 接手时要知道 |
| --- | --- | --- |
| `config/config_local.yaml` | 本地配置，`app.env=local` | Runner 只采集欧冠 fixture id |
| `config/config.yaml` | dev 配置 | 表名叫 `oddfi_prod_*`，容易误解 |
| `config/config_prod.yaml` | 仓库没有 | Dockerfile 和 `main.go` 默认都指向它 |
| `sportmonks.base_url` | 配了但未生效 | `NewRestClient` 里硬编码了 `https://api.sportmonks.com/v3/football` |
| 密钥/DSN | 当前 YAML 里有明文 | 后续应迁移到环境变量或 Secret，现有 token 建议轮换 |

## 6. Redis / MySQL / Kafka / HTTP Client 使用位置，核心数据模型结构

### Redis

当前项目没有 Redis 依赖、没有 Redis 配置、没有 Redis 客户端初始化，也没有实际 Redis 调用。

唯一相关位置是 `storage/mysql.go` 里注释掉的结算伪代码提到过 `Kafka / Redis Stream`。所以接手时不要误判：Redis 目前不是运行时依赖。

### MySQL

MySQL 是当前唯一真正承载业务数据的存储。

使用位置：

| 文件 | 作用 |
| --- | --- |
| `storage/mysql.go` | 初始化 GORM、连接池、AutoMigrate、批量 Upsert |
| `model/model.go` | 定义 DB Model 和动态表名 |
| `service/spider_svc.go` | 清洗数据后调用 `s.db.Upsert*` |
| `main.go` | 用配置里的 DSN 创建 `DBStorage` |

连接池配置：

| 项 | 当前值 |
| --- | --- |
| MaxIdleConns | 10 |
| MaxOpenConns | 100 |
| ConnMaxLifetime | 1 hour |
| GORM SkipDefaultTransaction | true |

启动时 AutoMigrate 的模型：

| Model | 表 |
| --- | --- |
| `League` | 联赛表 |
| `Fixture` | 赛事基础表 |
| `OddDB` | 赔率表 |
| `StatisticDB` | 统计表 |
| `FixtureResultDB` | 赛果/结算底表 |

`StateDB` 有模型和 `TableName()`，但当前没有加入 AutoMigrate。

主要表模型：

| 表/模型 | 主键 | 用途 |
| --- | --- | --- |
| `Fixture` | `id` | 赛事基础视图表，拍平主客队，供列表和详情查询 |
| `OddDB` | `odd_id` | 赔率表，保存 1X2、亚洲让球、亚洲大小球 |
| `StatisticDB` | `id` | 赛事统计表，保存射门、角球、牌等统计数据 |
| `FixtureResultDB` | `fixture_id` | 赛果和结算底表，保存状态、半全场、加时、点球、原始 payload |
| `League` | `id` | 联赛元数据，当前同步逻辑被注释 |
| `StateDB` | `id` | 状态字典，当前标记废弃且未迁移 |

### Kafka

Kafka 代码存在，但当前主流程没有接入。

使用位置：

| 文件 | 当前状态 |
| --- | --- |
| `kafka/producer.go` | 定义 `InitKafka`、`PublishLeaguesUpdate`、`Close` |
| `config/*.yaml` | 有 brokers/topic 配置 |
| `main.go` | 没有调用 `kafka.InitKafka()` |
| `service/spider_svc.go` | upsert 后没有发布 Kafka 消息 |

所以当前 Kafka 不是运行时必需依赖。历史设计里希望在联赛或赔率变化后分发消息，但现在只是预留。

### HTTP Client

HTTP Client 用于请求 SportMonks REST API。

使用位置：

| 文件 | 作用 |
| --- | --- |
| `client/rest.go` | 封装 `RestClient` |
| `main.go` | `client.NewRestClient(cfg.SportMonks.ApiToken)` |
| `service/spider_svc.go` | 调用 `GetWCFixtureByID`、`GetEUFixtureByID`、`GetOtherFixtureByID` 等 |

请求特性：

| 项 | 当前实现 |
| --- | --- |
| baseURL | 硬编码 `https://api.sportmonks.com/v3/football` |
| timeout | 30 秒 |
| token | 每次请求 query 自动加 `api_token` |
| 重试 | 最多 3 次 |
| 可重试错误 | 网络错误、HTTP 429、HTTP 5xx |
| 不重试错误 | 其他 4xx |
| 退避 | 1s、2s、4s，无 jitter |
| 限流处理 | `rate_limit.remaining < 20` 时 sleep 到 reset 后 2 秒 |
| wrapper 解析 | 解析 `data`、`pagination`、`rate_limit` |

当前主要 API：

| 方法 | 路径 | include | filters |
| --- | --- | --- | --- |
| `GetWCFixtureByID` | `/fixtures/{id}` | `participants;odds;league;statistics;state;scores` | `bookmakers:20;markets:1,6,7;fixtureLeagues:2,732,720,726,717,714,711,723,729` |
| `GetEUFixtureByID` | `/fixtures/{id}` | 同上 | `bookmakers:20;markets:1,6,7;fixtureLeagues:2` |
| `GetOtherFixtureByID` | `/fixtures/{id}` | 同上 | `bookmakers:20;markets:1,6,7` |
| `GetFixturesByDate` | `/fixtures/date/{date}` | `participants;odds` | 无 |
| `GetFixturesBetween` | `/fixtures/between/{start}/{end}` | `participants` | 无 |
| `GetFixtureScoreByID` | `/fixtures/{id}` | `scores;state` | 预留，当前主流程没用 |

## 7. 关键数据结构

### `model.APIFixture`

SportMonks fixture 原始 DTO，核心字段：

| 字段 | 说明 |
| --- | --- |
| `ID` | fixture id |
| `LeagueID` | 联赛 id |
| `Name` | 比赛名 |
| `StageID` / `SeasonID` | 阶段和赛季 |
| `StartingAt` | API 返回的开赛时间字符串 |
| `StateID` | 赛事状态 id |
| `Participants` | 主客队列表 |
| `HasOdds` | 是否有赔率 |
| `Odds` | 赔率列表 |
| `Statistics` | 统计数据 |
| `Scores` | 比分数据 |
| `State` | 状态详情 |

### `model.Fixture`

落库后的赛事基础表模型。它是反范式设计，会把 `participants` 拍平成 `home_*` 和 `away_*` 字段，避免查询侧大量 join。

关键字段：

| 字段 | 说明 |
| --- | --- |
| `ID` | fixture id，主键 |
| `LeagueID` | 联赛 id |
| `Name` | 比赛名 |
| `StartingAt` | 开赛时间 |
| `StartingAtTimestamp` | Unix 秒级时间戳 |
| `StateID` | 状态 id |
| `StageID` / `SeasonID` | 阶段和赛季 |
| `HomeTeam*` / `AwayTeam*` | 主客队拍平字段 |
| `HasOdds` | 是否有赔率 |
| `CreatedAt` / `UpdatedAt` | 创建和更新时间 |

### `model.OddDB`

赔率表模型，主键是 SportMonks 返回的 `odd_id`。

关键字段：

| 字段 | 说明 |
| --- | --- |
| `OddID` | 赔率 id，主键 |
| `FixtureID` | 赛事 id |
| `MarketID` | 盘口类型，1=1X2，6=亚让，7=亚大小 |
| `BookmakerID` | 做市商 id |
| `Label` | Home/Draw/Away/Over/Under 等 |
| `Value` | 赔率值，字符串保存 |
| `MarketDescription` | 盘口描述 |
| `Handicap` | 让球线 |
| `Total` | 大小球线 |
| `Selection` | 拼接后的展示选择文本 |
| `Winning` / `Stopped` | 模型有字段，但当前清洗时没有从 API 赋值 |
| `UpdatedAt` | 当前写入 Unix 秒级时间戳，但字段注释写的是毫秒级 |

### `model.StatisticDB`

赛事统计表模型。

关键字段：

| 字段 | 说明 |
| --- | --- |
| `ID` | statistics id，主键 |
| `FixtureID` | 赛事 id |
| `TypeID` | 统计类型 |
| `ParticipantID` | 队伍 id |
| `Value` | 统计值 |
| `Location` | home / away |

### `model.FixtureResultDB`

赛果和结算底表模型。这个表对后续派彩很关键。

关键字段：

| 字段 | 说明 |
| --- | --- |
| `FixtureID` | fixture id，主键 |
| `StateID` / `StateCode` / `StateName` | 官方状态 |
| `HomeScoreFull` / `AwayScoreFull` | 常规全场结算比分 |
| `HomeScoreHalf` / `AwayScoreHalf` | 半场比分 |
| `HomeScoreExtra` / `AwayScoreExtra` | 加时比分，指针类型表示可能不存在 |
| `HomeScorePenalty` / `AwayScorePenalty` | 点球比分，指针类型表示可能不存在 |
| `RawScoreData` | 原始 scores JSON |
| `RawStateDate` | 原始 state JSON，字段名有历史拼写问题 |
| `SettlementStatus` | PENDING / PROCESSING / PROCESSED / ERROR |
| `Remark` | 结算备注或错误信息 |

`UpsertFixtureResults` 更新时不会覆盖 `settlement_status` 和 `remark`。这是正确的，避免采集任务把结算服务已经处理过的状态洗掉。

## 8. 潜在风险点

1. 默认配置风险：`main.go` 和 Dockerfile 默认用 `config/config_prod.yaml`，但仓库没有这个文件。
2. 密钥风险：当前 YAML 中存在明文 SportMonks token 和 MySQL DSN，应该迁移到环境变量或 Secret，并轮换已暴露 token。
3. `sportmonks.base_url` 配置未生效：客户端硬编码 baseURL，配置项现在是“看起来有用但实际没用”。
4. 生产 AutoMigrate 风险：服务启动会直接 AutoMigrate，生产库表结构可能被意外变更。
5. 采集 fixture id 硬编码：所有赛事池都在 `utils.go`，维护成本高，无法动态上下线赛事。
6. fixture id 有重复风险：例如欧冠列表里 `19683229` 出现重复，当前没有启动去重。
7. 串行采集耗时长：每个 fixture 请求后 sleep 1 秒，列表变大后单轮可能超过 1 小时。
8. sleep 不可取消：固定 sleep 和限流 sleep 都没有监听 context，退出信号到达后可能要等。
9. 无事务边界：fixtures、fixture_results、odds、statistics 分三路并行写库，部分成功会产生不一致。
10. `UpsertOdds` / `UpsertStatistics` 不接收 context：取消信号不会传入 GORM。
11. `errgroup` 没有用 `errgroup.WithContext`：任一路失败不会主动取消其他写入。
12. odds 的 `Winning` 和 `Stopped` 没有从 API 写入 DB：前端禁投和赛后赢注展示可能拿不到真实状态。
13. statistics 注释和实现不一致：注释说只存部分 type_id，代码实际全量保存。
14. `participants < 2` 会跳过整个 fixture：如果 API 返回了 state/scores 但参赛方异常，赛果也会丢。
15. `starting_at` 解析失败时不打 fixture id 和原始值，后续排查困难。
16. `GetAllLeagues` 内部 `log.Fatalf`：虽然当前没接主流程，但恢复联赛同步前必须改成返回 error。
17. Kafka 代码未接入：不要以为当前 upsert 后会发消息。
18. Redis 当前不存在：结算注释里提到 Redis Stream，但仓库无实现。
19. 没有应用内 health/readiness/metrics：目前只能靠宿主机 Docker 存活监控，不能判断采集是否真的成功。
20. `api_resp.json` 只是样例，不参与测试回放；当前缺少稳定的 SportMonks mock。

## 9. 本地运行方式

前置条件：

| 依赖 | 说明 |
| --- | --- |
| Go | `go.mod` 声明 Go 1.24.1 |
| MySQL | 本地配置默认连 `127.0.0.1:3306` |
| SportMonks token | 当前配置文件里有值，但建议改成本地私有配置或环境注入 |
| Kafka | 当前主流程不需要 |
| Redis | 当前项目不需要 |

本地初始化建议：

```bash
cd /Users/rongweihe/Desktop/Oddfi-Code/oddfi-backend/oddfi-web-spider
```

确认配置：

```bash
sed -n '1,120p' config/config_local.yaml
```

确保本地 MySQL 有对应数据库，例如：

```sql
CREATE DATABASE IF NOT EXISTS oddfi_dev DEFAULT CHARACTER SET utf8mb4;
```

运行测试：

```bash
go test ./...
```

本地启动：

```bash
go run main.go -mode api -config config/config_local.yaml
```

编译：

```bash
go build -o web-spider main.go
```

或使用仓库脚本：

```bash
./build.sh
```

Docker 构建：

```bash
docker build -t web-spider:latest .
```

Docker 运行要特别注意：Dockerfile 默认启动参数是 `-config config/config_prod.yaml`，仓库里没有这个文件。生产部署必须通过镜像构建、挂载或 Secret 注入提供该配置，否则容器会启动失败。

监控脚本本地单次验证：

```bash
python3 scripts/monitor_docker_lark.py \
  --container-name web-spider \
  --service-name oddfi-web-spider \
  --instance-name local-dev \
  --once
```

## 10. 后续最值得重构或补测试的 10 个点

1. 配置和密钥治理  
   把 SportMonks token、MySQL DSN 从仓库 YAML 中移走，支持环境变量/Secret 注入；补启动配置校验，缺失时输出明确错误。

2. 让 `sportmonks.base_url` 真正生效  
   `NewRestClient` 应接收 baseURL 或完整配置，避免配置文件和实际请求地址不一致。

3. fixture id 采集策略配置化  
   把 `utils.go` 中的硬编码列表迁移到配置、数据库或后台管理；启动时做去重、非法 id 校验和分组说明。

4. 引入 bounded worker pool + 全局限流器  
   当前串行采集太慢。建议初始并发 2-5，并用全局 rate limiter 管住 SportMonks 请求，而不是每个请求局部 sleep。

5. 把 sleep 改成可取消  
   固定 1 秒 sleep、指数退避 sleep、rate limit sleep 都应该监听 `ctx.Done()`，避免服务关闭卡住。

6. 写库链路补 context、事务和失败补偿  
   `UpsertOdds`、`UpsertStatistics` 增加 context；fixtures + fixture_results 可考虑同事务；失败 fixture id 要记录下来，下一轮优先补偿。

7. 修正 odds 字段清洗  
   把 API 的 `winning`、`stopped` 写入 `OddDB`；统一 `UpdatedAt` 是 Unix 秒、毫秒还是 `time.Time`，避免 ORM tag 和业务语义冲突。

8. 扩充赛果和盘口测试  
   现有测试主要覆盖 `buildFixtureResult` 的基础场景。应补 AET/FT_PEN 缺字段、score only、state only、participants 缺失、home/away 乱序、赔率重复 id、盘口过滤等用例。

9. 增加应用内健康检查和指标  
   至少补 `/healthz`、`/readyz`、`/metrics` 或等价机制，记录最近成功同步时间、API 错误数、DB 错误数、跳过 fixture 数、单轮耗时。

10. 明确 Kafka/结算触发边界  
   当前 `UpsertFixturesPro` 和 Kafka producer 都没接主流程。后续如果要触发派彩，不建议直接 upsert 后裸发 Kafka，优先考虑 outbox 表或事务后发布，保证 DB 与消息一致性。

## 附：当前测试基线

本次接手梳理执行过：

```bash
GOCACHE=/private/tmp/oddfi-web-spider-gocache go test ./...
```

结果：通过。

当前测试覆盖集中在 `service.buildFixtureResult` 的状态和比分映射。HTTP Client、DB Upsert、Runner 退出、配置校验、SportMonks mock 回放、fixture id 策略都还没有测试。
```

本轮我没有回写 `ARCHITECTURE.md` 或创建 `新同事接手项目指南.md`，因为你明确要求先完整阅读且不要修改任何文件。