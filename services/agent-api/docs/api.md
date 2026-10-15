# OddFi Agent Backend — API 接入文档（前端版）

> 面向 **oddfi-agent-dyson** 前端工程师。后端服务：体育博彩 AI 推送 Agent。
>
> 任何字段疑问 → 看本文档 §3 `PushCard` schema 或后端 `internal/pushtypes/types.go`。

---

## 1. 环境与域名

| 环境 | Base URL | 说明 |
|------|----------|------|
| 本地 dev | `http://localhost:8080` | 后端 `make run` 起来；CORS 默认放通 `http://localhost:3000` |
| Dev 服 | `https://dev-news-api.oddfi.io` | 联调用，xAI/Grok provider（<SERVER_IP>） |
| Prod | `https://news-api.oddfi.io` | 线上（<SERVER_IP>） |

> 服务器 / DNS / SSH 接入信息看 `docs/INFRA.md`。

所有路径前缀：`/api/...`，健康检查除外（`/healthz`）。

### CORS

- 后端按 `CORS_ALLOWED_ORIGINS`（逗号分隔，**精确匹配**）放通指定 origin
- 浏览器直连 fetch / EventSource 都 OK
- **不要**传 `credentials: 'include'`（后端没启 `Allow-Credentials`，会被浏览器拒）
- **不支持** Vercel preview / 通配 / regex（用户决策，简化攻击面）

当前白名单（ENH-002 实施后）：

| 环境 | 放通的 origin |
|---|---|
| **prod** (news-api.oddfi.io) | `https://oddfi.io`、`https://www.oddfi.io`、`https://app.oddfi.io`、`https://testnet.oddfi.io`、`https://pre.oddfi.io`、`https://dev.oddfi.io` |
| **dev** (dev-news-api.oddfi.io) | prod 的全部 + `http://localhost:4000` / `:4001` / `:4002` / `:3000`（前端 dev 三端口 + 后端 demo 端口） |

如需新增 origin（如别的正式域名 / 新部署环境），改后端 `.env.dev` / `.env.prod` 的 `CORS_ALLOWED_ORIGINS`，restart 容器即可（无须 rebuild）。

### 鉴权

当前裸奔，无 token / cookie。未来引入鉴权属于 DD 级变更，会提前通知。

---

## 2. 接口清单

| Method | Path | 用途 | 频率 |
|--------|------|------|------|
| GET | `/healthz` | 健康检查 / 看卡池条数 / SSE 在线数 | 监控用 |
| GET | `/api/push` | **首屏 + 翻页**（cursor 分页，冷热路径自动合并） | 进入页面 1 次 + 滚到底翻页 |
| GET | `/api/push/stream` | **SSE 实时推送**（断线 Last-Event-ID 自动 resume） | 长连接 |
| POST | `/api/chat` | Cat 角色聊天（OpenAI-compatible 多轮上下文） | 用户对话触发 |
| GET | `/api/analysis` | 锁定比赛的赛前分析卡（单 slot 缓存） | 30s/次轮询 或 进入 Tab 时 |
| POST | `/api/dev/inject` | **仅 dev**：直接灌一张成型卡（跳过 LLM） | 调试 |
| POST | `/api/dev/inject-tweet` | **仅 dev**：注入原始 tweet 走全链路 | 调试 |
| POST | `/api/dev/analysis/regen` | **仅 dev**：手动触发分析重生成 | 调试 |

> `/api/dev/*` 在生产由 `DEV_API_ENABLED=false` 关闭，调用返回 404。请勿在前端 prod 代码里写死。

---

## 3. PushCard Schema（最关键 ⭐）

```ts
// 与后端 internal/pushtypes/types.go::PushCard 一一对应
type PushCard = {
  id: string;                  // 推文原 ID（天然去重键）
  originalText: string;        // 推文原文（必有）
  source: string;              // "🐦 @Romano"
  sourceUrl: string;           // "x.com/Romano/status/123"
  authorName?: string;
  createdAt: number;           // unix ms（推文发布时间）
  ingestedAt: number;          // unix ms（入库时间）—— 翻页 / SSE resume 的 cursor
  enrichStatus:                // ⭐ 决定 UI 状态文案
    | "pending"                //   解读中…
    | "ok"                     //   解读完成（下面 tag/title/aiAnalysis 才有）
    | "skipped"                //   非体育内容跳过（保留基础卡）
    | "failed";                //   LLM 调用失败（保留基础卡）

  // —— 以下字段仅 enrichStatus === "ok" 时存在 ——
  tag?: "odds" | "match" | "market";
  tagLabel?: string;           // "赔率剧变" | "球赛变更" | "市场变化"
  title?: string;              // 中文标题，≤20 字
  match?: string;              // "Real Madrid vs PSG"，没有则空
  aiAnalysis?: {
    change: string;            // 一句中文核心要点（纯文本）
    priceImpact: string;       // 仅此字段允许 <b class="delta-up">+5%</b> / <b class="delta-down">-9%</b>
    probImpact: string;        // 同上
  };
  suggest?: {
    text: string;              // 一句中文建议（纯文本）
    action: string;            // ≤8 字主按钮
    alt: string;               // ≤8 字副按钮
  };
  position?: {                 // 当前仅 dev inject 注入；线上暂不产出
    pick: string;
    entryOdd: number;
    stake: number;
    newOdd: number;
    pnl: number;
  };

  // —— deprecated（兼容期保留，下个版本删除） ——
  time?: string;               // 后端预算好的相对时间，如 "5 分钟前"；前端请用 createdAt 自算
  aiEnriched?: boolean;        // = (enrichStatus === "ok")；新代码用 enrichStatus
};
```

### enrichStatus → UI 对照

| enrichStatus | 期望渲染 |
|--------------|---------|
| `pending` | 显示原文 + 「解读中…」骨架 |
| `ok` | 完整卡（标题 / tag / aiAnalysis / suggest） |
| `skipped` | 显示原文，不显示 AI 分析区块；可加灰色「非体育内容」小标 |
| `failed` | 显示原文，AI 区块显示「解读失败」 |

### HTML 安全

- **只有** `aiAnalysis.priceImpact` / `aiAnalysis.probImpact` 允许 HTML，且**只允许**这一种标签：
  `<b class="delta-up">+5%</b>` 或 `<b class="delta-down">-9%</b>`
- 其余所有字段是**纯文本**，前端按文本渲染即可

---

## 4. GET `/api/push` — 首屏 / 翻页

### Query

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `limit` | int | 20 | 单页条数，clamp 到 [1, 100] |
| `before` | int (unix ms) | now | 取 `ingestedAt < before` 的卡；翻页用 `cursor.next` |

> ⚠️ `before` 最远只能回溯 72h；超出会被 clamp 并返回 `truncated: true`。

### Response

```json
{
  "items": [PushCard, ...],
  "count": 20,
  "hasMore": true,
  "truncated": false,
  "cursor": {
    "next":   1747700000000,
    "latest": 1747720000000
  }
}
```

- `items`：按 `ingestedAt` **DESC**（最新在前）
- `hasMore`：满页就认为还有；为 `false` 时停止下拉翻页
- `truncated`：`before` 被 72h 上限 clamp 了，提示用户「展示到 3 天前」
- `cursor.next`：下一页用 `?before=<next>&limit=...`
- `cursor.latest`：本批最新一条的 `ingestedAt`，可用作 SSE `?since=`

### 前端典型用法

```ts
// 首屏
const r = await fetch(`${base}/api/push?limit=20`);
const { items, cursor, hasMore } = await r.json();

// 翻页
const more = await fetch(`${base}/api/push?limit=20&before=${cursor.next}`);
```

---

## 5. GET `/api/push/stream` — SSE 实时推送 ⭐

服务发布的每条新卡 / enrich 状态变化都会推到所有在线连接。

### 连接

```ts
const es = new EventSource(`${base}/api/push/stream?since=${cursor.latest}`);
// 浏览器断线后会自动用 Last-Event-ID 重连，服务端会补发缺失的 backlog
```

### Query / Header

| 字段 | 说明 |
|------|------|
| `?since=<ingestedAt>` | 首次连接传上次拿到的最新 `ingestedAt`，服务端补发这之后的卡；最远 72h |
| `Last-Event-ID` | 浏览器 EventSource 自动带；优先级高于 `?since` |

### 事件类型

```
event: card.new
id: 1747720000000
data: { ... PushCard ... }

event: card.update
id: 1747720001500
data: { ... PushCard ... }    // enrich 完成后会推一条 update（同 id）

event: ping
data: { "t": 1747720010000 }   // 30s 一次心跳，前端忽略即可（防代理超时）
```

### 前端典型用法

```ts
es.addEventListener("card.new", (e) => {
  const card: PushCard = JSON.parse(e.data);
  // prepend 到列表头
});

es.addEventListener("card.update", (e) => {
  const card: PushCard = JSON.parse(e.data);
  // 按 card.id 替换列表里同 ID 的卡（enrich 完成会触发）
});

es.addEventListener("ping", () => { /* no-op */ });

es.onerror = () => {
  // EventSource 会自动重连；不需要手动 reconnect
  // 真要彻底关：es.close()
};
```

### 注意事项

- **dedup**：同一条 `card.new` 可能在 backlog 和实时流里同时出现 → **前端必须按 `id` 去重**（覆盖更新而非追加）
- **顺序**：`card.update` 一定在对应 `card.new` 之后；按 `card.id` 找到原卡覆盖即可
- **per-IP 上限**（ENH-002）：单 IP 同时 ≤ **3** 个 SSE 连接。同 tab 多 EventSource、隐身窗 + 正常窗叠加都会触发 429 + `Retry-After: 60`
- **全局软上限**：服务端 SSE 用量到达 80%（默认 80/100）时新连接 503 + `Retry-After: 30`（已建连接不受影响）
- **EventSource 自动重连**：浏览器原生会按 retry hint 重连，命中 429/503 会自然降级 reconnecting；前端无需手写 backoff
- **不要**走 `fetch + ReadableStream`：用原生 `EventSource`，省事且 Last-Event-ID 自动续传

---

## 6. POST `/api/chat` — Cat 角色聊天

### Request

```json
{
  "messages": [
    { "role": "user",      "content": "Real Madrid 今晚赔率怎么看？" },
    { "role": "assistant", "content": "..." },
    { "role": "user",      "content": "那对面呢？" }
  ]
}
```

- `messages` 为多轮上下文数组，前端自行维护（OpenAI Chat Completions 同款）
- body 上限 1 MiB

### Response

```json
{ "reply": "...", "timestamp": 1747720000000 }
```

### 错误

| HTTP | 含义 |
|------|------|
| 400 | `messages` 为空 / 请求体非合法 JSON |
| 429 | 单 IP 超 chat 限流（默认 10 req/min，burst 2）；带 `Retry-After: 60`。文案展示「Cat 喘口气，稍后再问」 |
| 503 | LLM 不可用（限流 / 网络 / 配置缺失）—— 文案展示「Cat 暂时离线」，不要展示后端原始错误 |

> Chat 是软依赖：失败不会影响推送流。
> 429 时**不要**自动重试；让用户明确手动再发一次。

---

## 7. GET `/api/analysis` — 赛前分析卡

锁定比赛（当前周期为某场欧冠/重要赛事）的 AI 整合分析，单 slot 缓存。

### 启动时序

服务启动后约 **30 秒**才会出现首条分析。在此之前调用接口返回 `ready: false`。

### Response（未就绪）

```json
{ "ready": false, "reason": "等待首次生成（启动后约 30 秒）" }
```

### Response（就绪）

```json
{
  "ready": true,
  "analysis": {
    "match": "Real Madrid vs PSG",
    "startTime": "2026-05-30 22:00 CET",
    "hoursToStart": 12.5,
    "aiProb":     { "home": 45, "draw": 28, "away": 27 },
    "marketProb": { "home": 50, "draw": 26, "away": 24 },
    "evidence":   ["近 5 场 Real 主场 4 胜 1 平", "..."],
    "unknown":    "Vinicius 是否首发未确认",
    "suggestionRange": "≤ 5% 仓位",
    "pickLabel":  "主胜",
    "pickOdds":   2.10,
    "summary":    "AI 略偏看好主队，但与市场分歧不大",
    "updatedAt":  1747720000000,
    "basedOnTweets": 17
  }
}
```

### 前端建议

- 进入 Analysis Tab 立刻拉一次
- 之后每 30s 轮询一次足够（后台每 1-2 min 重生成）
- 注意 `aiProb` 三个百分比理论上加起来 = 100，但 LLM 偶发 ±2 也算正常

---

## 8. Dev-only Endpoints（仅本地 / dev 环境）

**所有 `/api/dev/*` 在 prod 关闭（404）。前端不要硬编码这些路径。**

### POST `/api/dev/inject` — 灌成型卡

```bash
curl -X POST $BASE/api/dev/inject -H "Content-Type: application/json" -d '{
  "id":"manual1",
  "originalText":"测试推文",
  "title":"测试标题",
  "tag":"match",
  "tagLabel":"球赛变更",
  "createdAt":1747720000000
}'
# → { "added": true, "id": "manual1" }
```

### POST `/api/dev/inject-tweet` — 注入原始 tweet 走全链路

```bash
curl -X POST $BASE/api/dev/inject-tweet -H "Content-Type: application/json" -d '{
  "handle":"@FabrizioRomano",
  "post":{
    "id":"smoke1",
    "type":"post",
    "text":"Real Madrid odds shift after Vinicius injury",
    "author":{"handle":"@FabrizioRomano","name":"FR"}
  }
}'
# → { "added": true, "id": "smoke1", "enrichStatus": "ok", "skipped": false, "enrichErr": "" }
```

### POST `/api/dev/analysis/regen` — 手动触发分析重生成

```bash
curl -X POST $BASE/api/dev/analysis/regen
# → { "ok": true, "analysis": { ... } }
```

---

## 9. GET `/healthz`

```
ok · cards=42 · sse=3/100 · analysis=Real Madrid vs PSG
```

纯文本，监控用。不要在前端业务逻辑里依赖格式。

---

## 10. 错误响应通用约定

- 非 200 时返回**纯文本**（`text/plain`），格式：单行简短英文
- **不会**透传 LLM provider 错误细节到前端
- 4xx 给具体原因（如 `"messages required"`、`"rate limit exceeded"`、`"too many SSE connections from this client"`）
- 5xx 给模糊原因（如 `"chat service unavailable"`、`"service degraded, retry later"`）—— 前端用统一文案处理即可

### 限流响应（ENH-002 新增）

| HTTP | 端点 | 触发 | Header | 前端建议 |
|---|---|---|---|---|
| 429 | `/api/push` | 单 IP > 60 req/min（burst 3） | `Retry-After: 60` | 列表上提示「请求过频」，停止下拉翻页；用户主动操作不重试 |
| 429 | `/api/chat` | 单 IP > 10 req/min（burst 2） | `Retry-After: 60` | 「Cat 喘口气，稍后再问」 |
| 429 | `/api/push/stream` | 单 IP 同时 > 3 个 SSE | `Retry-After: 60` | EventSource 浏览器自动重连，无需手动处理 |
| 503 | `/api/push/stream` | 全局 SSE 用量 ≥ 80% | `Retry-After: 30` | 同上，EventSource 自动 reconnect |
| 503 | `/api/push/stream` | 全局 SSE 用量达硬上限 100 | （无 `Retry-After`） | 同上 |

**通用原则**：浏览器对 429/503 + `Retry-After` 的处理：

- `fetch`：不会自动重试，需前端 catch 并显示文案
- `EventSource`：自动按 retry hint 重连，前端无须显式处理

> **后端运维说明（与前端无关）**：环境变量调大限流阈值（如 `REST_RATE_PER_IP=999999`）
> 是"软关闭"——只是让阈值高到几乎不触发，限流中间件仍在跑。真正禁用必须重新部署
> 去掉 middleware 注册（属于回滚 Level 2 / 3，见 ENH-002 §8）。前端 UI 无须感知。

---

## 11. 接入 Checklist（前端联调起步）

- [ ] 拉一次 `GET /api/push?limit=20` 渲染列表
- [ ] 用 `cursor.latest` 起 `EventSource('/api/push/stream?since=...')` 长连接
- [ ] 监听 `card.new` 插到列表头；监听 `card.update` 按 `id` 覆盖原卡
- [ ] 处理 `enrichStatus` 四态文案（pending / ok / skipped / failed）
- [ ] `aiAnalysis.priceImpact / probImpact` 允许 HTML 渲染（白名单 `<b class="delta-up|delta-down">`），其余字段纯文本
- [ ] 滚到底拿 `cursor.next` 翻页；`hasMore=false` 或 `truncated=true` 时停止
- [ ] `POST /api/chat` 失败展示「Cat 暂时离线」，不阻塞主流
- [ ] `GET /api/analysis` 在 `ready=false` 时展示「分析生成中…」

---

## 12. 字段对齐红线（后端约束，前端无需关心但需知道）

后端 `PushCard` 与前端 `oddfi-agent-dyson::DockPush` 必须字段一致。任何 schema 变更走以下流程：

1. 后端写 DD 文档
2. 用户确认
3. 后端实现 + 前端同步 TS 类型
4. 联调

若你在前端发现字段缺失 / 命名不一致，**先看本文档 §3 是否同步**，再到 `internal/pushtypes/types.go` 核对，最后再喊后端。
