# OddFi Agent Backend

Go 后端：监听 Tweet Catcher WS → Kimi 解析推文 → 推送卡缓存 → HTTP API 给前端拉。

## 快速开始

```bash
cp .env.example .env   # 填入 keys（首次必须）
go mod tidy
go run .
```

服务监听 `:8080`。

## API

| 路径 | 用途 |
|------|------|
| `GET  /healthz` | 健康检查 |
| `GET  /api/push?limit=20` | 最新推送卡列表（前端 PushPanel 拉这个）|
| `POST /api/dev/inject` | 开发：直接注入一张成型的 PushCard JSON（跳过 Kimi）|
| `POST /api/dev/inject-tweet` | 开发：注入一条原始 tweet，触发 Kimi 解析全流程 |

## 一键测试 Kimi 解析

服务跑起来后，新开终端执行：

```bash
make inject
```

或手动：

```bash
curl -X POST http://localhost:8080/api/dev/inject-tweet \
  -H 'Content-Type: application/json' \
  -d '{
    "handle": "@FabrizioRomano",
    "post": {
      "id": "test_001",
      "type": "post",
      "text": "BREAKING: Real Madrid agreed personal terms with Alphonso Davies. Here we go soon.",
      "author": {"handle": "@FabrizioRomano", "name": "Fabrizio Romano"}
    }
  }' | jq
```

## 架构

```
Tweet Catcher WS (wss://monitor-api.tweet-catcher.com/websocket)
  ↓  op=2 identify {token}
  ↓  op=0 dispatch {event_id, event, task_info, data:PostData}
[Go worker - main.go]
  ↓  evt → kimi.ParseTweet (中文 system prompt + JSON mode)
  ↓  → pushtypes.PushCard
[store/memory.go] FIFO 100 条 + 去重
  ↓
[server/server.go] /api/push (CORS for localhost:3000)
  ↓
[前端 oddfi-agent-dyson PushPanel]
```

## 文件结构

```
main.go                            ← 入口：装配三大组件
internal/
├── config/   config.go            ← .env 加载
├── handles/  data.go              ← 30 个 Twitter handle 元数据
├── pushtypes/types.go             ← PushCard（和前端 DockPush 对齐）
├── tweetcatcher/
│   ├── events.go                  ← op codes + PostData 类型
│   └── client.go                  ← WS 连接 + 心跳 + 重连
├── kimi/
│   ├── client.go                  ← OpenAI 兼容 SDK 包装
│   └── prompt.go                  ← Tweet → PushCard 解析（统一中文）
├── store/    memory.go            ← in-memory + sync.RWMutex
└── server/   server.go            ← HTTP + CORS
```
