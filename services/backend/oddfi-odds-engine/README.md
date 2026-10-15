# 项目架构
oddfi-odds-engine/
├── cmd/
│   └── engine/
│       └── main.go                 # 服务入口，初始化依赖、启动 Worker 和 HTTP/WS
├── config/
│   └── config.yaml                 # 配置文件 (RDS, WebSocket 等参数)
├── internal/
│   ├── model/
│   │   ├── market.go               # 数据库模型 (Market, Outcome, Bet)
│   │   └── event.go                # 内部流转的事件结构体 (BetEvent)
│   ├── storage/
│   │   └── mysql.go                # DB 连接池封装
│   ├── engine/
│   │   ├── calculator.go           # 纯函数：赔率风控算法 (无状态，方便单测)
│   │   └── worker.go               # 异步消费核心：处理下注事件、加锁、落库、发通知
│   └── api/
│       ├── ws_hub.go               # WebSocket 广播中心
│       └── handlers.go             # 留给前端的 HTTP 接口 (如预算滑点接口)
├── go.mod
└── go.sum

# 项目功能
- internal/engine/calculator.go (赔率核心算法)
- internal/engine/worker.go (异步事务处理与并发锁) 系统的“心脏”，处理从 Channel 或 MQ 来的下注事件，使用 DB 行锁保证计算原子性。
- internal/api/ws_hub.go (WebSocket 广播中心) 实时推送的核心。它管理所有在线的前端连接，并负责将 OddsWorker 计算出的结果推送到前端。