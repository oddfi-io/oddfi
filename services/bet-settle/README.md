# oddfi-bet-settle
## 结算服务引擎

## 项目架构
```json
├── cmd                         # 项目入口
│   └── server                  # 后台结算 worker 启动入口
│   └── worker                  # 异步结算脚本/定时任务入口
├── internal                    # 私有业务逻辑
│   ├── service                 # 核心业务逻辑 (结算、判定、派彩)
│   ├── repository              # 数据库操作 (MySQL/Redis)
│   ├── model                   # 数据模型与常量定义 (MatchState, BetStatus)
│   ├── ws                      # WebSocket 逻辑
│   └── pkg                     # 内部通用工具 (计算逻辑、格式化)
├── config                      # 配置文件
├── test                        # 集成测试与 Mock 数据
├── scripts                     # 部署与运维脚本
├── Dockerfile                  # 镜像构建
└── go.mod                      # 依赖管理
```

## 模块功能
根据文档需求，核心模块的功能划分如下：
```json
模块名称 | 核心功能 | 文档对应逻辑
Settle Service | 核心结算引擎：执行轮询、状态分流、比分提取。| "PollLiveMatches, handleState, extractScore"
Judge Service | 玩法判定：实现 1x2、让球 (Handicap)、大小球 (OverUnder) 的胜平负判定。| "judgeBet (九条判定)"
Payout Service | 派彩计算：根据赔率和判定结果计算最终金额。| "calcPayout (WON/PUSH/VOID)"
Repository | 数据持久化：负责注单状态更新、余额变动（事务处理）。| "settleMatch (单事务处理)"
```


## 测试与部署步骤
1. 测试步骤

- 单元测试 (Unit Test)：针对 judgeBet 和 calcPayout 编写测试用例，覆盖各种比分（如 2:2 平局、加时赛 1:0 等）。

- 幂等性测试：多次并发调用 claim 接口，确认 balance 仅增加一次。

- 状态机测试：模拟 Match 状态从 5 (In-play) 到 7 (AET) 或 8 (FT_PEN) 的流转，确保结算触发逻辑正确。

- 压力测试：模拟大量注单同时结算时的数据库事务延迟和 WebSocket 推送压力。

2. 部署步骤

- 环境准备：配置 MySQL (InnoDB 引擎以支持 FOR UPDATE) 和 Redis (用于分布式锁或缓存)。

- CI/CD：通过 GitHub Actions 或 GitLab CI 构建 Docker 镜像。

- 高可用部署：

- Worker 节点：建议使用独占节点运行轮询调度，并配合分布式锁防止多机同时重复结算。对外 API 统一由 web-api 服务承接。

## 四、 核心设计：结算触发时机方案
文档中目前采用的是 30s 轮询 (PollLiveMatches)。在实际工程中，为了平衡实时性和系统负载，建议采用以下优化方案：

- 1. 推荐触发时机：混合触发模式 不要仅依赖轮询，建议组合使用：
- 因为数据源 sportmonks api 只有 api 轮询机制，所以只能依赖 api 轮询触发结算。
- 差异化轮询 (保底)：
- 对不同阶段的比赛设置不同频率。
- 进行中 (In-play)：30s - 60s 轮询一次比分。
- 已接近终场 (如 85 分钟后)：提高频率至 10s 一次。
- 待结算 (Waiting for Settle)：一旦检测到状态码变为 5/7/8，立即进入结算流程。

手动触发 (应急)：在 Admin 后台保留“强制重新结算”按钮，用于修复数据源错误导致的比分异常。

- 2. 结算逻辑的安全保障
关键点：结算必须具备 原子性。

事务处理：在 settleMatch 时，必须使用数据库事务。先更新注单状态为已结算，再增加用户的 claimable 账户金额，最后记录日志。

幂等校验：利用 fixture_id + state_id 作为幂等标识，防止同一场比赛因为轮询多次而被重复计算派彩。

## 五、 总结建议
针对您的文档，后端开发的重中之重是 internal/service/settle_service.go 的健壮性。
- 架构提示： 由于涉及金钱结算，建议在 calcPayout 模块中增加 审计日志，记录下每一笔派彩的原始比分、玩法类型和计算公式，以便在出现争议时进行回溯。

## 6. 异步结算脚本
- 关键改造点说明：

- 脱离浮点数陷阱：使用 decimal 库计算赔付和盘口线，这是金融类/博彩类后端的铁律，防止 0.1 + 0.2 = 0.30000000000000004 导致 JudgeHandicap 的边缘条件（如刚好卡在盘口线上走水）判断失误。

- 聚簇结算 (Batch by MatchID)：在轮询时，不要全表扫描 PENDING 的注单，而是根据 MatchID 维度聚拢。先确定哪场比赛完赛了，再一把抓取该比赛的所有 PENDING 注单进行事务处理。这能极大降低数据库锁争用。

## 7.涉及的上下游数据库
- 资产流水表 asset_leager
- 用户注单表 user_bet_holding

## 启动服务命令
```bash
sudo docker run -d \
  --log-opt max-size=1000m \
  --log-opt max-file=3 \
  --name oddfi-bet-settle \
  --restart always \
  -e TZ=Asia/Shanghai \
  herongwei/oddfi-bet-settle:prod
```

注意：当前 Docker 镜像会把 `config/` 目录一起打包进去，默认启动 `config/config_prod.yaml`。构建生产镜像前必须确认本地 `config/config_prod.yaml` 已经是线上配置。
