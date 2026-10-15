# oddfi-web-spider 架构设计与运行说明

更新时间：2026-04-30  
适用仓库：`oddfi-web-spider`  
当前实现状态：Go 定时轮询采集服务，主要通过 SportMonks REST API 拉取足球赛事详情、赔率、统计和比分状态，清洗后写入 MySQL，供 `oddfi-web-api` 等上游查询服务消费。

## 1. 服务定位

`oddfi-web-spider` 是 OddFi 体育赛事数据采集服务，核心职责是把 SportMonks 返回的嵌套赛事数据转成前端和结算侧更容易查询的反范式 MySQL 表。

当前代码的主路径是：

1. 定时拉取指定 fixture id 的比赛详情。
2. 解析赛事基础信息、主客队、赔率、统计、比分和状态。
3. 分别 upsert 到 `fixtures`、`fixture_results`、`odds`、`statistics` 表。
4. 由其他服务直接查询 MySQL 获取首页、详情页、盘口和赛果数据。

当前未启用或未完成的能力：

| 能力 | 当前状态 | 说明 |
| --- | --- | --- |
| `api` 轮询模式 | 已启用 | `main.go` 默认进入 `runner.APIRunner.StartForAllSport` |
| `ws` 模式 | 未实现 | `main.go` 仅打印 `WS 模式待实现...` |
| Kafka 分发 | 代码存在但未接入主流程 | `kafka/producer.go` 未在 `main.go` 初始化，也没有在 upsert 后发布消息 |
| 联赛全量同步 | 代码被注释 | `SyncLeagues` 依赖未实现的 `UpsertLeagues` |
| 日期/区间同步 | 方法存在但当前 Runner 未注册 | `SyncFixturesByDate`、`SyncFixturesRange` 只保留为可复用能力 |
| 结算里程碑触发 | 代码存在但未被主流程调用 | `storage.UpsertFixturesPro` 可识别终态跃迁，但当前 `processAndSaveFixtures` 调用的是 `UpsertFixtures` |
| 应用内健康检查/Prometheus | 未实现 | 代码中没有 HTTP server；当前先通过 `scripts/monitor_docker_lark.py` 做外部 Docker 存活监控 |
| 生产配置文件 | 仓库未包含 | `main.go` 和 `Dockerfile` 默认引用 `config/config_prod.yaml`，当前仓库只有 `config.yaml` 和 `config_local.yaml` |

## 2. 技术栈

| 层次 | 技术/库 | 用途 |
| --- | --- | --- |
| 语言 | Go 1.24.1 | 服务主体 |
| 配置 | Viper | 读取 YAML 配置 |
| HTTP Client | `net/http` | 请求 SportMonks REST API |
| 并发 | goroutine、`sync.WaitGroup`、`errgroup` | 调度任务和并行写库 |
| ORM | GORM | MySQL 连接、AutoMigrate、批量 Upsert |
| MySQL Driver | `gorm.io/driver/mysql` | MySQL 存储 |
| Kafka | `segmentio/kafka-go` | 预留消息发布能力，当前主流程未启用 |
| 部署 | Docker 多阶段构建 | 构建静态 Linux 二进制并运行 |

## 3. 目录结构

```text
.
├── main.go                 # 程序入口：参数解析、配置加载、依赖初始化、运行模式分发
├── client/
│   └── rest.go             # SportMonks REST Client：请求封装、重试、限流休眠、API 方法
├── config/
│   ├── config.go           # Viper 配置结构和全局配置加载
│   ├── config.yaml         # dev 配置，表名指向 oddfi_prod_*，含 MySQL / SportMonks / Kafka
│   └── config_local.yaml   # local 配置，表名指向 oddfi_*，本地库 oddfi_dev
├── kafka/
│   └── producer.go         # Kafka Writer 预留实现，当前主流程未使用
├── model/
│   └── model.go            # API DTO、DB Model、动态 TableName 映射
├── runner/
│   └── api_runner.go       # API 轮询调度器：注册定时任务、panic recover、优雅退出
├── service/
│   ├── spider_svc.go       # 核心业务：拉取 fixture、清洗、拆表、构建赛果、并行写库
│   └── spider_svc_test.go  # 赛果构建单测
├── storage/
│   └── mysql.go            # MySQL 初始化、连接池、AutoMigrate、批量 Upsert
├── utils/
│   └── utils.go            # 固定采集的 fixture id 列表和时间转换工具
├── scripts/
│   └── monitor_docker_lark.py # AWS Docker 容器状态检测和 Lark 富文本推送脚本
├── docs/
│   ├── ARCHITECTURE.md     # 当前架构说明
│   └── MONITORING.md       # Docker + Lark 监控部署说明
├── Dockerfile              # 多阶段构建和容器启动命令
├── README.md               # 前端所需字段和接口场景说明
└── deploy.md               # Docker 构建和运行说明
```

## 4. 分层架构

当前代码实际采用轻量分层：

```text
┌────────────────────────────────────────────────────────────┐
│ main.go                                                     │
│ - 解析 -mode / -config                                      │
│ - 加载配置                                                  │
│ - 初始化 DBStorage / RestClient / SpiderService             │
│ - 监听 SIGINT / SIGTERM                                     │
└─────────────────────────────┬──────────────────────────────┘
                              │
┌─────────────────────────────▼──────────────────────────────┐
│ runner.APIRunner                                             │
│ - 注册 all_sport_fixtures 每小时任务                         │
│ - 首次启动立即执行                                           │
│ - ticker 周期执行                                            │
│ - panic recover + 执行耗时日志                               │
└─────────────────────────────┬──────────────────────────────┘
                              │
┌─────────────────────────────▼──────────────────────────────┐
│ service.SpiderService                                        │
│ - 按 fixture id 拉详情                                       │
│ - 清洗 participants / odds / statistics / scores / state      │
│ - 构建 DB Model                                              │
│ - errgroup 并行写 fixtures+fixture_results / odds / statistics │
└───────────────┬──────────────────────────────┬──────────────┘
                │                              │
┌───────────────▼──────────────┐   ┌───────────▼──────────────┐
│ client.RestClient             │   │ storage.DBStorage         │
│ - SportMonks REST API          │   │ - GORM / MySQL            │
│ - timeout / retry / rate limit │   │ - AutoMigrate             │
│ - JSON wrapper 解析            │   │ - CreateInBatches Upsert  │
└───────────────────────────────┘   └──────────────────────────┘
```

## 5. 启动流程

入口文件：`main.go`

启动参数：

```bash
./web-spider -mode api -config config/config_local.yaml
```

默认值：

| 参数 | 默认值 | 当前风险 |
| --- | --- | --- |
| `-mode` | `api` | 只有 `api` 可用，`ws` 未实现 |
| `-config` | `config/config_prod.yaml` | 仓库没有该文件，直接运行默认命令会配置加载失败 |

启动步骤：

1. `flag.Parse()` 读取运行模式和配置路径。
2. `config.LoadConfig(path)` 使用 Viper 读取 YAML。
3. `storage.NewDBStorage(cfg.MySQL.DSN)` 初始化 GORM、连接池、AutoMigrate。
4. 从 GORM 取底层 `*sql.DB`，在退出时 `Close()`。
5. `client.NewRestClient(cfg.SportMonks.ApiToken)` 创建 SportMonks 客户端。
6. `service.NewSpiderService(restClient, dbStorage)` 组装业务服务。
7. `signal.NotifyContext` 监听 `os.Interrupt` 和 `SIGTERM`，支持优雅退出。
8. `-mode api` 时启动 `runner.APIRunner.StartForAllSport(ctx)`。

## 6. 当前运行模式

### 6.1 API 轮询模式

当前实际只注册了一个任务：

| 任务名 | 周期 | 首次执行 | 调用路径 |
| --- | --- | --- | --- |
| `all_sport_fixtures` | 1 小时 | 是 | `APIRunner.scheduleTaskWithCtx -> runTaskSafely -> SpiderService.SyncFixturesAll/SyncFixturesAllLocal` |

运行环境差异：

| `app.env` | 调用方法 | 采集范围 |
| --- | --- | --- |
| `local` | `SyncFixturesAllLocal` | 只采集 `utils.FixtureEuAllIDs` |
| 非 `local` | `SyncFixturesAll` | 采集世界杯、欧冠、其他联赛 fixture id 列表 |

调度行为：

1. 服务启动后立即执行一次任务。
2. 后续每 1 小时由 ticker 触发。
3. 每次任务在同一个 goroutine 内同步执行，任务执行时间超过 1 小时时不会并发重入，但 ticker 事件可能被延后消费。
4. `runTaskSafely` 使用 `recover()` 捕获 panic，防止单次任务 panic 退出整个进程。
5. 收到 `ctx.Done()` 后停止 ticker 并等待任务 goroutine 退出。

### 6.2 预留 API 能力

`SpiderService` 还保留了两个未注册到当前 Runner 的方法：

| 方法 | API | 用途 |
| --- | --- | --- |
| `SyncFixturesByDate(ctx, date)` | `/fixtures/date/{date}` | 按日同步，include `participants;odds` |
| `SyncFixturesRange(ctx, start, end)` | `/fixtures/between/{start}/{end}` | 按区间同步，include `participants` |

这些方法可用于恢复旧版“未来 7 天 + 近 3 天窗口”的调度模式，但当前 `StartOld` 已整体注释。

## 7. SportMonks 请求设计

核心 Client：`client/rest.go`

### 7.1 通用请求封装

`RestClient.get(ctx, path, query, target)` 统一处理：

1. 自动添加 `api_token`。
2. 构造 `GET {baseURL}/{path}?{query}`。
3. 注入上层 context。
4. 最多重试 3 次。
5. 网络错误、HTTP 429、HTTP 5xx 触发指数退避。
6. 4xx 业务错误直接返回。
7. 解析 SportMonks wrapper：

```json
{
  "data": {},
  "pagination": {},
  "rate_limit": {}
}
```

8. 将 `data` 反序列化到业务 target。
9. 当 `rate_limit.remaining < 20` 时，按 `resets_in_seconds + 2s` 主动休眠。

### 7.2 当前 fixture 详情 API

| 方法 | include | filters | 说明 |
| --- | --- | --- | --- |
| `GetWCFixtureByID` | `participants;odds;league;statistics;state;scores` | `bookmakers:20;markets:1,6,7;fixtureLeagues:2,732,720,726,717,714,711,723,729` | 世界杯/相关联赛详情 |
| `GetEUFixtureByID` | 同上 | `bookmakers:20;markets:1,6,7;fixtureLeagues:2` | 欧冠详情 |
| `GetOtherFixtureByID` | 同上 | `bookmakers:20;markets:1,6,7` | 其他联赛详情 |
| `GetFixtureScoreByID` | `scores;state` | `bookmakers:20;markets:1,6,7;fixtureLeagues:2` | 赛果补拉预留，当前未被主流程调用 |

业务清洗层会再过滤赔率：

```text
bookmaker_id in (2, 20)
market_id in (1, 6, 7)
```

其中：

| market_id | 含义 |
| --- | --- |
| `1` | 1X2 / Fulltime Result |
| `6` | 亚洲让球 |
| `7` | 亚洲大小球 |

注意：README 中仍提到 `bookmakers:2`，但当前 fixture 详情接口的 filter 主要使用 `bookmakers:20`，清洗层兼容 `2` 和 `20`。

## 8. 数据流运行逻辑

### 8.1 总体链路

```text
定时器触发
  │
  ▼
SyncFixturesAll / SyncFixturesAllLocal
  │
  ├─ 遍历 utils.FixtureWorldCupAllIDs
  │    └─ GetWCFixtureByID(ctx, id)
  │
  ├─ 遍历 utils.FixtureEuAllIDs
  │    └─ GetEUFixtureByID(ctx, id)
  │
  ├─ 遍历 utils.FixtureOtherAllIDs
  │    └─ GetOtherFixtureByID(ctx, id)
  │
  ▼
聚合 []model.APIFixture
  │
  ▼
processAndSaveFixtures(ctx, rawFixtures)
  │
  ├─ 构建 []model.Fixture
  ├─ 构建 []model.FixtureResultDB
  ├─ 构建 []model.OddDB
  └─ 构建 []model.StatisticDB
  │
  ▼
errgroup 并行写库
  │
  ├─ UpsertFixtures -> UpsertFixtureResults
  ├─ UpsertOdds
  └─ UpsertStatistics
  │
  ▼
MySQL 供 oddfi-web-api 查询
```

### 8.2 采集阶段

`SyncFixturesAll(ctx)` 会按固定顺序采集：

1. `utils.FixtureWorldCupAllIDs`
2. `utils.FixtureEuAllIDs`
3. `utils.FixtureOtherAllIDs`

每个 fixture id 请求完成后固定 `time.Sleep(1 * time.Second)`，用于降低 SportMonks API 压力。单个 fixture 请求失败时只记录日志并 `continue`，不会中断本轮同步。

`SyncFixturesAllLocal(ctx)` 只遍历 `utils.FixtureEuAllIDs`，适合本地开发减少外部 API 调用量。

### 8.3 清洗阶段

核心方法：`processAndSaveFixtures(ctx, rawItems)`

对每个 `model.APIFixture` 执行：

1. 构建 `model.Fixture`：
   - `id`
   - `league_id`
   - `name`
   - `state_id`
   - `stage_id`
   - `season_id`
   - `starting_at`
   - `starting_at_timestamp`
   - `has_odds`

2. 解析开赛时间：
   - 输入格式：`2006-01-02 15:04:05`
   - 成功时写入 `StartingAt` 和 Unix 秒级时间戳。
   - 失败时当前不会中断，只保留零值时间。

3. 校验参赛方：
   - `len(raw.Participants) < 2` 时跳过该 fixture。
   - 这是当前最重要的数据完整性保护，因为首页和详情页依赖主客队字段。

4. 扁平化主客队：
   - 根据 `participant.meta.location == home/away` 填充主队/客队字段。
   - 写入队伍 ID、名称、logo、国家、类型、胜负标记和 short code。

5. 过滤并构建赔率：
   - 跳过 `odd.id == 0`。
   - 只保留 bookmaker `2` 或 `20`。
   - 只保留 market `1`、`6`、`7`。
   - `OddID` 使用 SportMonks 赔率 ID，作为数据库主键。
   - `Selection` 根据 `total` 或 `value` 拼接，方便前端投注项展示。

6. 构建统计数据：
   - 当前将 `raw.Statistics` 全量落入 `StatisticDB`。
   - 模型注释提到“只存储 TypeID = 34, 41, 84, 85”，但代码没有实际过滤，需要后续统一。

7. 构建赛果底表：
   - 当 fixture 含 `scores` 或 `state` payload 时，调用 `buildFixtureResult`。
   - 默认 `SettlementStatus = PENDING`。
   - 保留 `RawScoreData` 和 `RawStateDate` JSON 作为兜底审计数据。

### 8.4 赛果构建逻辑

核心方法：

```text
buildFixtureResult
  ├─ hasFixtureResultPayload
  ├─ hasStatePayload
  └─ populateFixtureResultScores
       ├─ lookupScorePair
       └─ isExtraTimeFinalState
```

当前比分映射策略：

| 字段 | 来源 |
| --- | --- |
| `home_score_full` / `away_score_full` | 默认取 `CURRENT` |
| AET / FT_PEN 的全场结算比分 | 改取 `2ND_HALF`，避免把加时或点球后的比分当常规时间比分 |
| `home_score_half` / `away_score_half` | 取 `1ST_HALF` |
| `home_score_extra` / `away_score_extra` | 优先取 `EXTRA_TIME`；若 AET/FT_PEN 且没有 `EXTRA_TIME`，使用 `CURRENT` 兜底 |
| `home_score_penalty` / `away_score_penalty` | 取 `PENALTIES` |

这个逻辑已有单元测试覆盖：

1. 只有状态没有比分时仍构建赛果记录。
2. AET/FT_PEN 下常规全场、加时、点球比分分开写入。
3. 没有状态和比分的空 payload 跳过。

### 8.5 结算触发现状

`storage/mysql.go` 中存在 `UpsertFixturesPro` 和 `isSettlementMilestone`，设计目标是：

1. 批量查询旧的 fixture `state_id`。
2. upsert 新 fixture。
3. 对比新旧状态。
4. 当状态进入 FT、AET、FT_PEN、CANCELLED、POSTPONED、ABANDONED、WO、AWARDED 等终态时触发结算流程。

但当前主链路没有调用 `UpsertFixturesPro`，而是调用 `UpsertFixtures`。因此当前服务只负责写入 `fixtures` 和 `fixture_results`，不会实际投递结算消息，也不会真正触发派彩流程。

## 9. 存储设计

### 9.1 连接池与迁移

`storage.NewDBStorage(dsn)` 当前行为：

1. `gorm.Open(mysql.Open(dsn), &gorm.Config{SkipDefaultTransaction: true})`
2. 底层连接池配置：
   - `SetMaxIdleConns(10)`
   - `SetMaxOpenConns(100)`
   - `SetConnMaxLifetime(time.Hour)`
3. 启动时 `AutoMigrate`：
   - `model.League`
   - `model.Fixture`
   - `model.OddDB`
   - `model.StatisticDB`
   - `model.FixtureResultDB`

注意：`model.StateDB` 有表模型和 `TableName()`，但当前未加入 `AutoMigrate`。

### 9.2 动态表名

DB Model 的 `TableName()` 会读取配置中的 `mysql.tables`，为空时使用默认值。

| Model | 配置项 | 默认表名 |
| --- | --- | --- |
| `League` | `mysql.tables.leagues` | `oddfi_leagues` |
| `Fixture` | `mysql.tables.fixtures` | `oddfi_fixtures` |
| `OddDB` | `mysql.tables.odds` | `oddfi_odds` |
| `StatisticDB` | `mysql.tables.statistics` | `oddfi_statistics` |
| `FixtureResultDB` | `mysql.tables.fixture_results` | `oddfi_fixture_results` |
| `StateDB` | `mysql.tables.states` | `oddfi_states` |

### 9.3 核心表

#### `fixtures`

定位：赛事基础视图表，采用反范式拍平主客队，减少查询侧 join。

关键字段：

| 字段 | 说明 |
| --- | --- |
| `id` | SportMonks fixture id，主键 |
| `league_id` | 联赛 ID |
| `name` | 比赛名称 |
| `starting_at` | 开赛时间 |
| `starting_at_timestamp` | Unix 秒级时间戳 |
| `state_id` | 赛事状态 |
| `stage_id` / `season_id` | 阶段和赛季 |
| `home_*` / `away_*` | 主客队扁平字段 |
| `has_odds` | 是否有赔率 |
| `created_at` / `updated_at` | 创建和更新时间 |

索引：

| 索引 | 说明 |
| --- | --- |
| `primaryKey(id)` | upsert 冲突键 |
| `league_id` | 联赛过滤 |
| `starting_at` | 时间范围查询 |
| `idx_league_time(league_id, starting_at)` | 联赛内时间排序和范围查询 |
| `state_id` | Live/Upcoming/Finished 分类 |
| `home_team_id` / `away_team_id` | 队伍历史查询 |

#### `fixture_results`

定位：结算和赛果详情底表，记录状态、半全场、加时、点球和原始 payload。

关键字段：

| 字段 | 说明 |
| --- | --- |
| `fixture_id` | 主键，与 fixture 一对一 |
| `state_id` / `state_code` / `state_name` | 官方状态 |
| `home_score_full` / `away_score_full` | 常规全场结算比分 |
| `home_score_half` / `away_score_half` | 半场比分 |
| `home_score_extra` / `away_score_extra` | 加时比分，nil 表示未提供 |
| `home_score_penalty` / `away_score_penalty` | 点球比分，nil 表示未提供 |
| `raw_score_data` | 原始 scores JSON |
| `raw_state_date` | 原始 state JSON。字段名为 `date`，当前含义实际是 data/payload |
| `settlement_status` | `PENDING`、`PROCESSING`、`PROCESSED`、`ERROR` |
| `remark` | 结算错误或备注 |

Upsert 策略：

`UpsertFixtureResults` 以 `fixture_id` 为冲突键，只更新状态、比分、原始 JSON 和 `updated_at`，不会覆盖 `settlement_status` 和 `remark`。

#### `odds`

定位：高频赔率表。

关键字段：

| 字段 | 说明 |
| --- | --- |
| `odd_id` | SportMonks odd id，主键 |
| `fixture_id` | 赛事 ID |
| `market_id` | 盘口类型 |
| `bookmaker_id` | 做市商 |
| `label` | 投注项 |
| `value` | 赔率值，字符串保存 |
| `handicap` | 让球线 |
| `total` | 大小球线 |
| `winning` | 是否赢注 |
| `stopped` | 是否暂停 |
| `selection` | 清洗后的展示/选择文本 |
| `updated_at` | 更新时间 |

Upsert 策略：

`UpsertOdds` 以 `odd_id` 为冲突键，`UpdateAll` 更新所有字段，批量大小 500。

#### `statistics`

定位：赛事统计表。

关键字段：

| 字段 | 说明 |
| --- | --- |
| `id` | API statistics id，主键 |
| `fixture_id` | 赛事 ID |
| `type_id` | 统计类型 |
| `participant_id` | 队伍 ID |
| `value` | 统计值 |
| `location` | `home` / `away` |

Upsert 策略：

`UpsertStatistics` 使用主键冲突 `UpdateAll`，批量大小 500。

## 10. 并发模型

当前并发点很少，主要集中在调度和写库。

### 10.1 调度并发

`APIRunner.StartForAllSport` 会为每个 task 启动一个 goroutine。当前只有 `all_sport_fixtures` 一个任务。

优势：

1. 结构简单。
2. 单任务不会并发重入。
3. panic 被局部恢复。
4. 收到系统信号后可以等待调度 goroutine 退出。

限制：

1. 采集 fixture id 是串行的，整体耗时与 fixture 数量线性相关。
2. 每个请求后固定 `1s` sleep，若 fixture id 很多，本轮耗时会很长。
3. `time.Sleep` 不感知 context，关闭信号到达时可能需要等当前 sleep 和请求链路结束。

### 10.2 写库并发

`processAndSaveFixtures` 使用 `errgroup.Group` 并行写三条链路：

```text
goroutine 1: UpsertFixtures(ctx, dbFixtures) -> UpsertFixtureResults(ctx, fixtureResults)
goroutine 2: UpsertOdds(allOdds)
goroutine 3: UpsertStatistics(allStatistics)
```

优势：

1. fixtures 和 fixture_results 保持顺序，先有基础赛事再写赛果。
2. odds/statistics 与基础赛事并行，减少总体写入耗时。
3. 所有写入方法都是批量 upsert，避免逐条 SQL。

风险：

1. 三条链路没有事务边界，部分成功、部分失败时会出现短暂或长期不一致。
2. `UpsertOdds` 和 `UpsertStatistics` 未接收 context，无法响应取消。
3. `errgroup` 未使用 `errgroup.WithContext`，某一路失败不会主动取消其他写入。
4. GORM 连接池最大打开连接数是 100，未来增加并发请求和并发写库时需要同步压测 MySQL 承载。

## 11. 错误处理与鲁棒性现状

| 场景 | 当前行为 | 风险 |
| --- | --- | --- |
| 配置读取失败 | `log.Fatalf` 退出 | 合理，但默认配置文件缺失会导致容器无法启动 |
| DB 连接失败 | `log.Fatalf` 退出 | 合理，但没有重试等待 DB ready |
| AutoMigrate 失败 | `log.Fatalf` 退出 | 合理，但生产环境直接 AutoMigrate 有变更风险 |
| 单个 API 请求失败 | 记录日志并跳过该 fixture | 不阻断本轮，但没有失败重试队列 |
| HTTP 429/5xx | 最多 3 次指数退避 | 没有 jitter，也没有全局限流器 |
| API 剩余额度低 | 当前 goroutine sleep 到 reset | 简单有效，但不可取消，会拖慢关闭 |
| JSON 解析失败 | 返回错误并跳过 | 缺少 payload 采样和告警 |
| participants 不足 | 跳过 fixture | 保护查询模型，但可能丢失状态和赛果 |
| 写库失败 | 记录错误，本轮继续结束 | 没有补偿、重试和告警 |
| panic | Runner 层 recover | 单任务可恢复，但 panic 细节没有堆栈 |
| `GetAllLeagues` 失败 | 当前方法内部 `log.Fatalf` | 该方法虽未接入主流程，但恢复联赛同步前需要改成返回 error，避免库函数直接杀进程 |

## 12. 配置与部署

### 12.1 配置结构

```yaml
app:
  env: "local|dev|prod"
mysql:
  dsn: "user:pass@tcp(host:3306)/db?charset=utf8mb4&parseTime=True&loc=Local"
  tables:
    leagues: ""
    fixtures: ""
    odds: ""
    statistics: ""
    fixture_results: ""
sportmonks:
  api_token: ""
  base_url: ""
kafka:
  brokers: []
  topic: ""
```

当前注意点：

1. `sportmonks.base_url` 已配置但 `client.NewRestClient` 里硬编码为 `https://api.sportmonks.com/v3/football`，配置未生效。
2. `api_token` 和 MySQL 密码出现在仓库配置文件中，生产环境应改为环境变量或密钥管理。
3. Dockerfile 默认 `-config config/config_prod.yaml`，但该文件没有纳入仓库；部署时必须挂载或构建时提供。

### 12.2 Docker

构建阶段：

1. 基于 `golang:1.24-alpine`。
2. 设置 `GOPROXY=https://goproxy.cn,direct`。
3. `go mod download`。
4. `CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o web-spider main.go`。

运行阶段：

1. 基于 `alpine:latest`。
2. 安装 `ca-certificates` 和 `tzdata`。
3. 拷贝二进制和 `config` 目录。
4. 默认入口：

```bash
./web-spider -mode api -config config/config_prod.yaml
```

## 13. 代码审计方案

审计目标：确认采集数据正确、服务长期运行稳定、资源消耗可控、失败可恢复、部署配置不会造成生产事故。

### 13.1 基线审计

| 审计项 | 方法 | 产出 |
| --- | --- | --- |
| 模块依赖关系 | 梳理入口、包调用、未使用包 | 架构依赖图和死代码清单 |
| 配置完整性 | 对比 `main.go`、Dockerfile、`config/*.yaml` | 必填配置清单、默认值风险 |
| 密钥安全 | 扫描 token、密码、DSN | 敏感信息迁移建议 |
| 依赖安全 | `go list -m all`、漏洞扫描 | 依赖升级建议 |
| 编译测试 | `go test ./...` | 当前测试基线 |
| 部署一致性 | 对比 `server.yaml`、Dockerfile、代码实现 | 已实现/未实现能力矩阵 |

### 13.2 数据正确性审计

重点关注体育数据和结算相关字段：

1. fixture id 列表是否有重复、过期、遗漏。
2. SportMonks filter 与业务预期是否一致，尤其是 `bookmaker_id` 和 `market_id`。
3. `starting_at` 时区解释是否符合前端和结算服务预期。
4. 参赛方不足时直接跳过是否会导致赛果无法更新。
5. `state_id`、`state.state`、`state.name` 是否需要以 `state.id` 优先。
6. AET/FT_PEN 下常规时间、加时、点球比分拆分是否符合结算规则。
7. `fixture_results.settlement_status` 是否允许被采集任务覆盖，当前实现不会覆盖，需要保持。
8. `statistics` 注释与代码过滤策略不一致，需要确认前端到底需要全量还是白名单。
9. `winning`、`stopped` 当前没有从 API odd 写入，模型字段默认 false，需确认是否影响前端禁投和赛后展示。

建议补充用例：

1. `participants` 顺序颠倒但 `meta.location` 正确。
2. 缺少 home 或 away 的异常 payload。
3. `starting_at` 解析失败。
4. 同一 fixture 中 odds 出现重复 odd id。
5. `CURRENT`、`2ND_HALF`、`EXTRA_TIME`、`PENALTIES` 缺失组合。
6. state only、score only、state+score 三类 payload。
7. fixture result upsert 不覆盖 `settlement_status` 的集成测试。

### 13.3 并发审计

审计点：

1. 单任务是否可能重入。
2. fixture 采集是否需要 bounded worker pool。
3. SportMonks API 全局限流是否足够。
4. DB 写库并发与连接池是否匹配。
5. `time.Sleep` 是否可被 context 取消。
6. `errgroup` 任一路失败是否需要取消其他写入。
7. shutdown 时是否会卡在 API 限流 sleep 或固定 sleep。

建议验证：

1. 使用 mock SportMonks 服务压测 100、500、1000 个 fixture id。
2. 对比串行采集、并发 2、并发 5、并发 10 的 API 错误率和耗时。
3. 观察 MySQL `Threads_connected`、慢 SQL、锁等待、连接池等待。
4. 使用 `go test -race ./...` 做竞态检测。

### 13.4 内存审计

当前 `SyncFixturesAll` 会把所有 API 结果聚合到 `rawFixturesAll`，再统一清洗和写库。

审计点：

1. 大型 fixture 列表下 `rawFixturesAll`、`allOdds`、`allStatistics` 峰值内存。
2. JSON 原始字段 `RawScoreData`、`RawStateDate` 的大小。
3. 日志量和容器日志文件大小。
4. GORM batch size 与 `max_allowed_packet`。

建议验证：

1. 开启 `pprof` 或在压测环境采集 heap profile。
2. 构造高赔率/高统计 payload，测量单轮同步内存峰值。
3. 观察 GC pause 和容器 RSS。

### 13.5 服务健壮性审计

审计点：

1. DB 未 ready 时服务是否需要等待重试。
2. API token 失效时是否能快速暴露告警。
3. SportMonks 长时间 429 时是否会雪崩式重试。
4. 单轮大量失败是否需要进入失败队列。
5. 写库部分失败是否需要补偿任务。
6. 容器健康检查是否能发现“进程活着但采集停止”的状态。

建议补充指标：

| 指标 | 说明 |
| --- | --- |
| `spider_task_duration_seconds` | 单轮任务耗时 |
| `spider_task_last_success_timestamp` | 最近成功时间 |
| `spider_api_requests_total` | API 请求数，按 status/endpoint 分类 |
| `spider_api_errors_total` | API 错误数 |
| `spider_api_rate_limit_remaining` | SportMonks 剩余额度 |
| `spider_db_upsert_rows_total` | upsert 行数 |
| `spider_db_errors_total` | DB 错误数 |
| `spider_fixture_skipped_total` | 被跳过 fixture 数 |

## 14. 优化建议

### P0：部署和安全基线

1. 补齐 `config/config_prod.yaml` 的部署策略，或者修改 Dockerfile 默认使用明确存在的配置路径，并在生产用 Secret/环境变量注入敏感字段。
2. 移除仓库中的真实 SportMonks token、MySQL 密码，改为 `.env`、Kubernetes Secret、AWS Secrets Manager 或容器环境变量。
3. 让 `sportmonks.base_url` 真正传入 `RestClient`，避免配置项失效。
4. 增加启动配置校验：DSN、API token、表名、env 缺失时输出明确错误。
5. 明确 `server.yaml` 是设计草案还是运行配置，避免其中 Kafka、WS、Prometheus、health check 与实际代码不一致。

### P1：并发与限流优化

1. 将 fixture id 串行采集改成 bounded worker pool：
   - 初始并发建议 2-5。
   - 并发数配置化。
   - 每个 worker 共享全局 rate limiter。
   - 对 429 使用全局降速，而不是单请求局部重试。

2. 将固定 `time.Sleep(1s)` 改为可取消 sleep：

```go
select {
case <-ctx.Done():
    return
case <-time.After(delay):
}
```

3. 请求重试增加 jitter，避免多个实例同时恢复时打爆 SportMonks。

4. 为单轮任务增加超时 context，例如 `task_timeout`，防止单轮卡住影响后续周期。

5. 按失败类型区分重试：
   - 网络错误、429、5xx：可重试。
   - 401、403：配置/权限错误，应告警并快速失败。
   - 404 fixture 不存在：记录并加入无效 ID 清单。

### P1：内存与批处理优化

1. 避免把全部 fixture 聚合后一次性处理。可以按 chunk 采集和落库：

```text
fixture ids -> 每 N 个一批请求 -> 清洗 -> upsert -> 释放内存 -> 下一批
```

2. 对 odds/statistics 设置清洗后数量上限或按 fixture 分批写入，避免单轮 payload 异常导致内存峰值过高。
3. `rawFixturesAll`、`allOdds`、`allStatistics` 可预估容量后初始化，减少扩容。
4. 对 `RawScoreData` 和 `RawStateDate` 保留大小做监控，必要时只保留结算必需字段和原始 payload hash。
5. 根据实际 MySQL `max_allowed_packet` 和平均行大小调整 `CreateInBatches` 的 500 行批量大小。

### P1：数据库一致性与健壮性

1. 对 `fixtures + fixture_results` 保持当前顺序，但建议引入同一事务，至少保证基础赛事和赛果底表的一致性。
2. 对 odds/statistics 失败建立补偿机制，记录本轮失败 fixture id，下一轮优先重试。
3. `UpsertOdds`、`UpsertStatistics` 增加 `context.Context`，并使用 `db.WithContext(ctx)`。
4. `processAndSaveFixtures` 使用 `errgroup.WithContext`，当关键写入失败时可以取消非关键写入。
5. 对 `AutoMigrate` 建议生产环境可配置关闭，改用显式 migration，降低意外改表风险。
6. 补充索引：
   - `odds(fixture_id, market_id, bookmaker_id)`
   - `statistics(fixture_id, type_id, location)`
   - `fixture_results(state_id, settlement_status)`

### P1：数据正确性优化

1. 修复 `statistics` 注释和实现不一致：确认是全量存储，还是只保留前端需要的 type id 白名单。
2. `APIOdd.Winning`、`APIOdd.Stopped` 应写入 `OddDB`，否则前端和结算可能拿不到 API 的暂停/赢注状态。
3. `OddDB.UpdatedAt` 当前声明 `gorm:"autoUpdateTime"` 但手动写 Unix 秒，建议统一为 `time.Time` 或明确为 Unix 秒字段，避免 ORM 语义误解。
4. `RawStateDate` 建议改名为 `RawStateData`。如果已上线不能改字段，至少在文档和代码注释中说明兼容历史拼写。
5. 处理 `time.Parse` 失败时应记录 fixture id 和原始时间，便于定位 API 格式变化。
6. 对 `FixtureEuAllIDs` 中重复 ID 做启动时去重，降低重复 API 调用。
7. fixture id 列表建议迁移到配置、数据库或后台管理，而不是硬编码在 `utils.go`。

### P2：可观测性与运维

1. 增加 HTTP health server：
   - `/healthz`：进程和 DB 连接是否正常。
   - `/readyz`：最近一次成功同步时间是否在阈值内。
   - `/metrics`：Prometheus 指标。

2. 日志结构化：
   - 增加 `task_name`、`fixture_id`、`league_id`、`endpoint`、`duration_ms`、`error_type`。
   - 避免在日志中输出 token 或完整带 token URL。

3. 任务状态持久化：
   - 记录每轮开始、结束、成功数、失败数、跳过数。
   - 支持查看最近 N 轮失败 fixture。

4. 告警：
   - 连续 N 轮全部失败。
   - SportMonks 429 持续超过阈值。
   - DB upsert 错误。
   - 最近成功同步时间超过 2 个周期。

### P2：架构演进

1. 如果赔率实时性要求提高，恢复或实现 WS 模式，但需要明确断线重连、快照补偿和消息幂等。
2. Kafka 若要启用，应避免直接在 upsert 成功前发布；建议采用 outbox 表或事务后发布，保证 DB 与消息一致性。
3. 引入 repository/service interface，便于 mock API 和 DB，提升单测覆盖率。
4. 把“采集哪些赛事”的策略抽象出来：
   - 静态配置策略。
   - 数据库赛事池策略。
   - 按日期/联赛自动发现策略。
   - 热门赛事优先级策略。

## 15. 建议落地路线

### 第一阶段：一周内

1. 修复配置和密钥问题。
2. 补充生产配置注入说明。
3. 让 `base_url` 配置生效。
4. `time.Sleep` 改为 context 可取消。
5. `go test -race ./...` 纳入检查。
6. 为 `buildFixtureResult` 增加更多比分边界测试。

### 第二阶段：两到三周

1. 引入 bounded worker pool 和全局 rate limiter。
2. 分批采集、分批清洗、分批写库，降低峰值内存。
3. odds/statistics 写库增加 context 和补偿重试。
4. 增加 health/readiness 和基础 Prometheus metrics。
5. 清理 `server.yaml`、README 与真实代码不一致的描述。

### 第三阶段：一个月以上

1. fixture id 采集策略配置化/后台化。
2. Kafka outbox 或事件发布链路落地。
3. WS 实时赔率模式设计和实现。
4. 显式数据库 migration 替代生产 AutoMigrate。
5. 建立 SportMonks mock server 和端到端数据回放测试。

## 16. 外部服务监控

当前新增了一个仓库外部运维脚本：

```text
scripts/monitor_docker_lark.py
```

它不嵌入 `web-spider` 容器内部，而是建议放在 AWS 宿主机上用 `nohup` 或 systemd 常驻运行。这样即使业务容器本身已经退出，监控脚本仍然能从宿主机读取 Docker 状态，并且只在发现异常容器时向 Lark 群推送消息；所有容器正常时只打印本地日志。

监控链路：

```text
nohup / systemd
  │
  ▼
python3 scripts/monitor_docker_lark.py
  │
  ├─ 每 3600 秒执行一轮检测
  ├─ docker inspect web-spider[,web-api,...]
  │
  ├─ 解析 Running / Restarting / Paused / Dead / ExitCode / OOMKilled / Health
  │
  ├─ 正常容器只打印日志
  └─ 异常容器聚合后通过 LARK_WEBHOOK_URL 推送 Lark post 富文本
```

默认配置：

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `DOCKER_CONTAINER_NAMES` / `DOCKER_CONTAINER_NAME` / `--container-name` | `web-spider` | AWS 机器上的 Docker 容器名，支持逗号分隔、多次传参，并兼容逗号后带空格的命令行写法 |
| `MONITOR_SERVICE_NAME` / `--service-name` | `oddfi-web-spider` | Lark 消息中的服务名 |
| `MONITOR_INSTANCE_NAME` / `--instance-name` | hostname | Lark 消息中的实例名，生产建议显式传入 |
| `LARK_WEBHOOK_URL` / `--webhook-url` | 空 | Lark 群自定义机器人 webhook |
| `DEFAULT_INTERVAL_SECONDS` | `3600` | 巡检间隔固定写在脚本代码中，不再暴露命令行参数 |

推荐生产运行方式见 `docs/MONITORING.md`。这个脚本解决的是“进程/容器是否存活”的第一层监控，后续仍建议补充应用内 `/healthz`、`/readyz` 和 Prometheus 指标，用来判断采集任务是否真的持续成功。

## 17. 当前验证结果

本次梳理后执行：

```bash
go test ./...
```

结果：通过。

当前已有测试主要覆盖 `service.buildFixtureResult` 的状态和比分映射逻辑。其他层如 HTTP Client、DB Upsert、Runner graceful shutdown、配置校验、fixture id 采集策略尚缺少测试。
