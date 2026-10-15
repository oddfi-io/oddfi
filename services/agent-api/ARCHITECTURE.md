# Architecture — oddfi-agent-backend

> 每次代码有更新后，**必须**回写本文件，确保文档与实际架构一致。
> 最近一次大改：DD-001 历史缓存持久化 + REST 首屏 + SSE 持续推送（2026-05-19）。

---

## 1. 服务定位

OddFi Agent 后端：**事件驱动的 LLM 推送 Agent**。

- 上游：Tweet Catcher WebSocket（订阅 30+ 体育账号）
- 中游：Kimi/Moonshot（OpenAI 兼容 API）解析推文为结构化 PushCard
- 下游：HTTP API（首屏）+ SSE（持续推送）给前端 Agent UI（`oddfi-agent-dyson`）

依然是单实例、无鉴权（`/api/dev/*` 走 env gate）；新增 SQLite 本地持久化。

---

## 2. 模块结构

```
main.go                                     ← 装配 store + repo + bus + persister + pool + kimi + tc + server
internal/
├── config/      config.go                  ← .env 加载（含 DB_PATH / MAX_SSE_CONNS / DEV_API_ENABLED 等）
├── handles/     data.go                    ← 30 个订阅 handle 元数据
├── pushtypes/   types.go                   ← PushCard（含 IngestedAt/EnrichStatus）+ BuildBaseCard + ApplyEnrichment + Mark*
├── tweetcatcher/
│   ├── events.go                           ← op codes + Envelope + PostData
│   └── client.go                           ← WS 心跳 + 指数退避重连
├── kimi/
│   ├── client.go                           ← OpenAI SDK 包装
│   ├── chat.go                             ← Chat system prompt + ChatComplete
│   └── prompt.go                           ← Enrich system prompt + EnrichTweet（输出 EnrichmentResult）
├── store/       memory.go                  ← in-memory 热缓存 FIFO 1000 条 + LoadFromDB/SeedFromDB + ListBefore + OldestIngestedAt
├── persist/                                ← 【新增】 SQLite 持久化层
│   ├── sqlite.go                           ← Repo: Open + PRAGMA + InsertCard/UpdateEnrich/QueryCardsSince/Before/LoadRecent
│   ├── persister.go                        ← 单 goroutine 串行写 worker（channel buf 512 + drop-on-full + drain shutdown）
│   └── sanitize.go                         ← bluemonday HTML allow-list + SanitizeEnrichError 脱敏
├── events/      bus.go                     ← 【新增】 进程内 pub/sub（CardNew / CardUpdate）+ slow-consumer 踢出 + 幂等 Unsubscribe
├── enrich/      pool.go                    ← 【新增】 enrich worker pool（固定 4 worker + 100 queue + 三态判定 + bus.Publish）
└── server/
    ├── server.go                           ← /healthz, /api/push（cursor 分页+冷热路径）, /api/chat, /api/dev/*（env gate）
    └── sse.go                              ← /api/push/stream（Origin 白名单 + activeSSE 上限 + Last-Event-ID + subscribe-then-backlog + dedup + ping）
```

---

## 3. 数据流（关键时序）

```
┌──────────────────────┐
│ Tweet Catcher WS     │  wss://monitor-api.tweet-catcher.com/websocket
└──────────┬───────────┘
           │  op=0 Dispatch {event, data:PostData}
           ▼
┌──────────────────────────────────────────────────────────┐
│ main.go::handleEvent(evt)  —— DD-001 §6.2 不变量          │
│   1. base := BuildBaseCard(...)                          │
│   2. mem.Add(base)                                       │
│   3. persister.Enqueue(InsertOp{base})  ← 非阻塞，满则 drop+log │
│   4. bus.Publish(CardNew{base})        ← SSE fan-out      │
│   5. pool.Submit(base.ID, post, srcHandle) ← enrich 反压队列  │
└──────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                ┌──────────────────────────────┐
                │ enrich worker (4× concurrency)│
                │   ctx, 30s timeout            │
                │   enr, err := kimi.EnrichTweet│
                │   三态：ok / skipped / failed  │
                │   ↓                           │
                │   mem.Update(id, mutator)     │
                │   persister.Enqueue(UpdateOp) │
                │   bus.Publish(CardUpdate)     │
                └──────────────────────────────┘

           ┌────────────────────────────────────────────────────────┐
           │ HTTP / SSE Server                                       │
           │                                                         │
           │  GET /api/push?before=<ms>&limit=20                     │
           │      → 冷热路径：before > 内存最旧 → store.ListBefore     │
           │                  否则 → repo.QueryCardsBefore（SQLite）  │
           │      ← {items, count, cursor:{next,latest}, hasMore,    │
           │         truncated}                                       │
           │                                                         │
           │  GET /api/push/stream?since=<ms>                        │
           │      (a) Origin 白名单                                   │
           │      (b) activeSSE > MaxSSEConns → 503                  │
           │      (c) Last-Event-ID > ?since，clamp 到 now-72h        │
           │      (d) ★先 bus.Subscribe★                              │
           │      (e) backlog := repo.QueryCardsSince(since-100ms)    │
           │      (f) for ev := range sub.Ch: dedup + writeSSE        │
           │      (ping 15s 心跳)                                     │
           └────────────────────────────────────────────────────────┘
```

### 关键设计取舍

- **基础卡先入库（mem.Add）→ 持久化入队 → bus.Publish → enrich.Submit**：顺序保证 SSE 收到 card.new 后立即调 REST 翻页也能查到（DD-001 §6.2 不变量）
- **LLM 软依赖**：enrich 超时/失败仅 mark `enrichStatus=failed`，基础卡保留可见
- **WAL + busy_timeout=5000**：读写并发不互斥，SSE backlog 查询不被 writer 阻塞
- **subscribe-then-backlog**：先订阅总线再查 DB，防 race（DD-001 §6.3 R-C1）
- **bluemonday allow-list**：AI HTML 字段写入前剥到只剩 `<b class="delta-up|down">`（DD-001 §4.1 R-C4）
- **SSE Origin 白名单 + 全局连接上限 100**：防 EventSource 无 preflight 导致的 DoS（DD-001 §6.4 R-C2 / R-m6）
- **72h 回溯窗口 clamp + LIMIT 500 backlog / LIMIT 100 翻页**：防 `since=0` 全表扫描放大（R-C3）

---

## 4. PushCard 数据结构

```go
type PushCard struct {
    ID            string      `json:"id"`                    // tweet id（去重键）
    Tag           string      `json:"tag,omitempty"`         // odds | match | market
    TagLabel      string      `json:"tagLabel,omitempty"`    // 赔率剧变 | 球赛变更 | 市场变化
    Time          string      `json:"time"`                  // [deprecated] 前端用 createdAt 自算
    Title         string      `json:"title,omitempty"`       // LLM 中文标题（≤20 字）
    OriginalText  string      `json:"originalText"`          // 推文原文（必有）
    Source        string      `json:"source"`                // "🐦 @Romano"
    SourceURL     string      `json:"sourceUrl"`
    AuthorName    string      `json:"authorName,omitempty"`
    Match         string      `json:"match,omitempty"`
    AiAnalysis    *AiAnalysis `json:"aiAnalysis,omitempty"`  // 写入前经过 bluemonday 清洗
    Suggest       *Suggest    `json:"suggest,omitempty"`
    Position      *Position   `json:"position,omitempty"`
    CreatedAt     int64       `json:"createdAt"`             // unix ms
    IngestedAt    int64       `json:"ingestedAt"`            // 【新增】入库时间，cursor 排序键
    EnrichStatus  string      `json:"enrichStatus"`          // 【新增】 pending|ok|skipped|failed
    AiEnriched    bool        `json:"aiEnriched"`            // [deprecated] 前端用 enrichStatus 替代
}
```

### SQLite Schema（push_cards 表）

```sql
CREATE TABLE push_cards (
  id            TEXT PRIMARY KEY,
  created_at    INTEGER NOT NULL,
  ingested_at   INTEGER NOT NULL,
  source_handle TEXT NOT NULL,
  author_handle TEXT NOT NULL,
  author_name   TEXT,
  original_text TEXT NOT NULL,
  source_url    TEXT,
  tag, tag_label, title, match_name TEXT,
  ai_analysis   TEXT,            -- JSON
  suggest       TEXT,            -- JSON
  enrich_status TEXT NOT NULL DEFAULT 'pending',
  enrich_error  TEXT,            -- 脱敏后
  updated_at    INTEGER NOT NULL
);
CREATE INDEX idx_push_cards_ingested ON push_cards(ingested_at DESC);
CREATE INDEX idx_push_cards_created  ON push_cards(created_at  DESC);
```

PRAGMA：`journal_mode=WAL` / `busy_timeout=5000` / `synchronous=NORMAL` / `temp_store=MEMORY`。

### 字段对齐红线

`PushCard` 必须与前端 `oddfi-agent-dyson` 的 `DockPush` 类型完全对齐。
兼容期（DD-001 §4.4）：后端同时输出 `time` + `aiEnriched`（deprecated）和 `enrichStatus` + `ingestedAt`（新）；前端切换字段后下个版本移除 deprecated。

---

## 5. HTTP / SSE API

| 方法 | 路径 | 用途 | 限流 / 鉴权（ENH-002） |
|------|------|------|------|
| GET  | `/healthz` | 健康检查 + 卡数 + SSE 连接数 | 无 |
| GET  | `/api/push?before=<ms>&limit=20` | 首屏 / 翻页（cursor 分页，max 100 条，72h 回溯） | per-IP 60/min burst 3 → 429 + `Retry-After: 60` |
| GET  | `/api/push/stream?since=<ms>` | SSE 持续推送（card.new / card.update / ping） | Origin 白名单 + 全局上限 100（80% 软上限 503 + Retry-After: 30）+ per-IP ≤ 3 → 429 + Retry-After: 60 |
| POST | `/api/chat` | Cat 角色对话 → LLM | per-IP 10/min burst 2 → 429 + `Retry-After: 60` |
| GET  | `/api/analysis` | 锁定比赛 AI 整合分析（单 slot 缓存） | 无（开销低，单内存读） |
| POST | `/api/dev/inject` | 直接注入成型 PushCard | env gate `DEV_API_ENABLED=true` |
| POST | `/api/dev/inject-tweet` | 注入原始 tweet 走全链路 | env gate `DEV_API_ENABLED=true` |
| POST | `/api/dev/analysis/regen` | 手动重生成分析 | env gate `DEV_API_ENABLED=true` |

### `/api/push` 响应

```jsonc
{
  "items": [PushCard, ...],
  "count": 20,
  "hasMore": true,
  "truncated": false,    // before 早于 72h 时为 true
  "cursor": {
    "next": 1700000000000,    // 下一页 before=
    "latest": 1700000999000   // 客户端开 SSE：?since=
  }
}
```

### `/api/push/stream` 事件

```
id: 1700000000000
event: card.new
data: {...PushCard...}

id: 1700000005000
event: card.update
data: {...PushCard with enrichStatus="ok"...}

event: ping
data: {"t":1700000010000}
```

每帧 `id:` 字段值为 `ingestedAt`；浏览器 EventSource 自动重连时通过 `Last-Event-ID` 请求头补发。

CORS 通过 `CORS_ALLOWED_ORIGINS` 控制，逗号分隔多源，**精确匹配**（ENH-002 用户决策不支持 regex/通配）。SSE 在 CORS 之外**额外**做服务端 Origin 白名单校验（EventSource 不发 preflight），两处共用 `Server.originAllowed`（`internal/server/cors.go`）保证决策不漂移。

应急 IP 黑名单走 nginx 层 `geo $blocklist {}`（部署在 `/etc/nginx/conf.d/blocklist.conf`，详见 `deploy/install-blocklist.sh`），命中返回 444。

---

## 6. LLM 调用规范

### Enrich（tweet → PushCard）

- system prompt：`internal/kimi/prompt.go::systemPrompt`
- temperature: 0.3
- response_format: `{type: "json_object"}`
- 输出 schema：`kimiResponse`（skip / tag / tagLabel / title / match / aiAnalysis / suggest）
- 默认应生成增强字段；只有广告/无关/无意义才 `skip:true`

### Chat（Cat 角色）

- system prompt：`internal/kimi/chat.go::chatSystemPrompt`
- temperature: 0.7
- 风格：陪伴派、≤200 字、不承诺盈利、命中 Tilt 信号要劝阻

### 红线（代码层兜底）

- enrich 失败 → 卡保留，`enrichStatus="failed"`，错误经 `persist.SanitizeEnrichError` 脱敏后落库
- enrich skip → 卡保留，`enrichStatus="skipped"`
- enrich 完成时目标卡已被 FIFO 淘汰 → 日志 `enrich target gone`，跳过 update

---

## 7. 配置（.env）

| 变量 | 默认 | 必填 | 用途 |
|------|------|------|------|
| `TWEET_CATCHER_TOKEN` | — | 否 | 空则跳过 WS，仅 HTTP（本地调试） |
| `AI_API_KEY` | — | **是** | LLM API key（provider-agnostic：Moonshot/xAI/DeepSeek/OpenAI 等） |
| `AI_BASE_URL` | `https://api.moonshot.cn/v1` | 否 | OpenAI 兼容 endpoint |
| `AI_MODEL` | `moonshot-v1-8k` | 否 | 模型名 |
| `SERVER_ADDR` | `:8080` | 否 | HTTP 监听地址 |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000` | 否 | 逗号分隔多源；`*` 允许全部 |
| `DB_PATH` | `./data/cards.db` | 否 | SQLite 路径。prod=`/var/lib/oddfi-agent/prod/cards.db`，dev=`/var/lib/oddfi-agent/dev/cards.db`，**禁止共享** |
| `MAX_SSE_CONNS` | `100` | 否 | SSE 全局连接硬上限；超出 503 |
| `DEV_API_ENABLED` | `false` | 否 | 设 `true` 才挂载 `/api/dev/*`；生产必须 false |
| `ENRICH_WORKERS` | `4` | 否 | enrich worker 并发度 |
| `ENRICH_QUEUE_CAP` | `100` | 否 | enrich 队列容量；满则当条 tweet 跳过增强（基础卡仍可见） |
| `SSE_PER_IP_LIMIT` | `3` | 否 | 单 IP 同时 SSE 连接上限（ENH-002） |
| `SSE_SOFT_LIMIT_PCT` | `80` | 否 | SSE 全局软上限 % `[1,100]`：到达后新连接 503 + Retry-After: 30（ENH-002） |
| `SSE_MAX_TRACKED_IPS` | `50000` | 否 | SSE per-IP map 硬上限（防 map 攻击，ENH-002） |
| `REST_RATE_PER_IP` | `60` | 否 | `/api/push` per-IP 每分钟请求数（ENH-002） |
| `REST_RATE_BURST` | `3` | 否 | `/api/push` 突发容量（ENH-002） |
| `CHAT_RATE_PER_IP` | `10` | 否 | `/api/chat` per-IP 每分钟（ENH-002） |
| `CHAT_RATE_BURST` | `2` | 否 | `/api/chat` 突发（ENH-002） |
| `RATELIMIT_MAX_TRACKED_IPS` | `50000` | 否 | REST IPLimiter map 硬上限（ENH-002） |

---

## 8. 优雅退出

收到 `SIGINT` / `SIGTERM`：

1. `httpServer.Shutdown(10s timeout)` —— 停止接受新连接，等已有 SSE 连接自然结束（ctx.Done）
2. `pool.Shutdown()` —— 等所有 enrich worker 处理完当前 job
3. `persister.Shutdown()` —— drain channel 里剩余 ops 一次性落盘
4. `repo.Close()` —— 关闭 SQLite 连接池
5. 打印 stats（dropped/wrote/failed/enriched/skipped）

---

## 9. 当前限制 & 已知技术债

1. ~~**内存存储** —— 重启即丢卡~~ ✅ DD-001 解决（SQLite + LoadRecent 恢复）
2. **单实例** —— 仍无横向扩展能力（bus 是进程内）。多实例需引入 Redis pub/sub（DD-002）
3. ~~**无鉴权** —— `/api/dev/*` 在生产应关闭~~ ✅ DD-001 `DEV_API_ENABLED` env gate
4. **LLM 单点** —— Moonshot 限流时 enrich 全断，无 fallback provider（DD-003）
5. **WS 单订阅** —— Tweet Catcher 限单连接，没有 cluster 概念
6. **SSE slow consumer 被踢出** —— bus 满则关闭对应 sub；客户端应在 onerror 重连（EventSource 原生支持）
7. **未做 LLM HTML 输出完整性验证** —— bluemonday 只能保 XSS 不出；如果 LLM 故意输出错误的 delta-up/down 标记，前端会看到风格漂移（产品边界，不修）

---

## 10. 演进方向（按优先级）

1. ~~补单元测试~~ ✅ DD-001 各包覆盖：persist 17 / events 8 / store 17 / pushtypes 9 / server 12 / enrich 7（共 70+ 用例）
2. ~~持久化~~ ✅ DD-001 SQLite + WAL
3. ~~`/api/dev/*` env gate~~ ✅ DD-001
4. LLM provider 抽象 + fallback（DD-003 候选）
5. 多实例横向扩展（Redis pub/sub 替代 events.Bus，DD-002 候选）
6. Prometheus 指标暴露（当前已有 Stats() 方法，缺 HTTP /metrics 端点）
7. 全文检索 / 标签筛选 API（看产品诉求）
