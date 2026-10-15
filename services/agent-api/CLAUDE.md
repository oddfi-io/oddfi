# oddfi-agent-backend — Claude 项目规则

## 启动要求

每次对话开始前必须读取本文件。用户在对话中补充的规则优先级更高。

---

## 项目定位

**OddFi Agent Backend** — 体育博彩 AI 推送 Agent 的 Go 后端：

```
Tweet Catcher WS  →  Kimi/Grok LLM 解析  →  PushCard 入内存  →  HTTP API 供前端拉
```

不是金融账户/链上交易系统，**不要**把它当 web-api 那种规模来设计。本服务的关键词是：**事件驱动、LLM 增强、低延迟推送**。

---

## 代码库信息

| 代码库 | 本地路径 | GitHub |
|--------|----------|--------|
| **backend**（当前） | `/Users/hang/work/oddfi-agent-backend` | github.com/Crypto-Barrett/oddfi-agent-backend |
| **frontend (Agent UI)** | `/Users/hang/work/oddfi-agent-dyson` | — |
| **sibling: 金融后端** | `/Users/hang/work/oddfi-backend/web-api` | github.com/Crypto-Barrett/oddfi-backend |

### 跨库协作

涉及前端字段对齐（`PushCard` ↔ `DockPush`）、接口联调时，**先拉对应仓库最新 main 再判断，禁止凭印象猜测字段**。

---

## 技术栈

- Go 1.26 · 标准库 `net/http`（无 Gin/Echo）
- 依赖：`gorilla/websocket`、`joho/godotenv`、`sashabaranov/go-openai`
- 存储：**纯内存**（`store.MemoryStore`，FIFO 100 条）；无 MySQL / 无 Redis / 无 GORM / 无 JWT
- LLM：OpenAI 兼容协议（Kimi/Moonshot 默认；可切 Grok / DeepSeek）
- 日志：标准库 `log`
- 配置：`.env` + `godotenv`

> 不要引入 Gin/GORM/zerolog/decimal —— 当前规模用标准库足够，引入即过度工程。

---

## 核心架构（30 秒读完）

```
main.go
  │
  ├── config.Load()            ← 加载 .env
  ├── store.NewMemoryStore()   ← 内存卡池
  ├── kimi.NewClient()         ← OpenAI SDK 包装 Moonshot
  │
  ├── tweetcatcher.NewClient(token, handleEvent)
  │     · op=2 identify / op=1 heartbeat / op=0 dispatch
  │     · 指数退避重连
  │
  └── handleEvent(evt):
        1. 立刻入"基础卡"（不阻塞）
        2. go enrich → kimi.EnrichTweet → store.Update 同 ID
        3. enrich 30s 超时，超时/失败不影响基础卡

server.New() 提供：
  GET  /healthz
  GET  /api/push?limit=20
  POST /api/chat            ← 前端 Chat 与 Kimi 对话
  POST /api/dev/inject      ← 直接注入成型 PushCard（跳过 LLM）
  POST /api/dev/inject-tweet← 注入原始 tweet 走全链路（调试用）
```

详细架构见 `ARCHITECTURE.md`，每次代码变更后**必须同步**。

---

## 核心规则

### 中文注释

- 复杂业务逻辑、并发控制、LLM 提示词约束、WS 协议处理 → **必须加中文注释**
- 注释解释「为什么」，不复述代码做什么
- 简单自解释代码不加废话注释
- 函数行为变化时同步更新函数注释

### 运行时输出（日志）

```go
// ❌ 中文 log
log.Printf("收到推文 %s", id)

// ✅ 英文 + 模块前缀 [Module] verb subject
log.Printf("[TweetCatcher] received post id=%s handle=%s", id, handle)
log.Printf("[Kimi] enrich failed id=%s err=%v", id, err)
```

格式：`[ModuleName] verb subject — reason`

### LLM Prompt 修改红线

`internal/kimi/prompt.go` 和 `internal/kimi/chat.go` 中的 system prompt 是 **产品策略级资产**：

- 修改 prompt **必须先和用户对齐**，不要自作主张改"严格要求"条款
- 改完后必须用 `make inject` 跑一条 mock tweet 看输出
- 中文/英文 prompt 强制：所有 LLM 输出统一**简体中文**
- 任何输出格式变更（新增/移除 JSON 字段）→ 同步检查前端 `DockPush` 字段对齐

### 字段对齐红线

`pushtypes.PushCard` 必须和前端 `oddfi-agent-dyson` 的 `DockPush` 保持字段一致：

- 增删字段前先看前端组件 `components/agent/dock/tabs/PushPanel.tsx`
- `omitempty` 的字段对前端是 optional —— 不要把 required 字段加 `omitempty`
- `AiEnriched=false` 时前端展示"解读中…"，保留这个语义

### 错误处理

```go
// ❌ 吞错误
if err != nil { return }

// ❌ 把 LLM 错误直接 500 给前端
http.Error(w, err.Error(), 500)

// ✅ 附上下文向上传递
return fmt.Errorf("[Kimi] enrich tweet id=%s: %w", id, err)

// ✅ LLM 失败不阻断推送 —— 基础卡已入库，enrich 失败只 log
log.Printf("[Kimi] ⊘ enrich error id=%s: %v", id, err)
```

**LLM 调用永远是软依赖**：超时/失败必须降级到基础卡，不能让 WS 流水线卡住。

### 方案先行（DD/ENH 门槛）

满足以下任一条件必须先写设计文档并等用户确认：

- 新增 API 端点 ≥ 2 个
- 新增/替换上游数据源（如从 Tweet Catcher 换 X API、新增 Truth Social）
- 引入持久化存储（Redis/SQLite/Postgres）
- 替换或新增 LLM provider（Kimi → Grok / Claude / GPT）
- 改 PushCard JSON schema

详见 `.claude/rules/dd-enh-workflow.md`。

### 文件修改限制

单次任务不超过 5 个文件；超出则拆分任务或与用户对齐范围。

### 库选型对比（强制）

引入新依赖前必须先输出 top-N 候选对比给用户 review：

| 候选 | star | last commit | 是否维护 | 推荐？理由 |
|------|------|-------------|----------|-----------|

确认后才执行 `go get`。

---

## AI 基建结构

```
oddfi-agent-backend/
├── CLAUDE.md              ← 本文件（持续迭代）
├── AGENTS.md              ← Codex / 其他 AI 工具规范
├── ARCHITECTURE.md        ← 架构说明（每次代码变更后同步）
├── .claude/
│   ├── settings.json      ← Hook 配置（PreToolUse / PostToolUse）
│   ├── rules/             ← 详细规范（按 globs 自动加载）
│   │   ├── git-workflow.md
│   │   ├── code-quality.md
│   │   ├── testing.md
│   │   ├── api-conventions.md
│   │   ├── llm-prompt.md          ← 本项目专属：LLM 提示词修改规范
│   │   ├── dd-enh-workflow.md
│   │   ├── review-workflow.md
│   │   └── agent-delegation.md
│   ├── hooks/
│   │   ├── guard-bash.sh          ← PreToolUse: 拦截 git push / 危险命令
│   │   └── go-check.sh            ← PostToolUse: 编辑 .go 后自动 go vet
│   └── commands/
│       └── partial-commit.md
└── .progress/             ← 本地 AI 工作空间（gitignored）
    ├── designs/           ← DD-NNN 新功能设计
    ├── enh/               ← ENH-NNN 优化方案
    ├── bug/               ← BUG-NNN 复盘
    ├── research/          ← RES-NNN 调研
    ├── lessons/           ← 踩坑沉淀
    └── stash/             ← 草稿
```

---

## 常用本地命令

```bash
make run          # go run .
make tidy         # go mod tidy
make inject       # 注入 mock tweet 走全链路（要先 make run）
make inject-card  # 直接注入成型 PushCard（跳过 LLM）
make list         # 拉最新 push 卡

# 测试链路
go vet ./...
go test ./... -count=1
```

服务跑在 `:8080`，前端跑在 `:3000`（CORS 已放通 localhost:3000）。

---

## 调试技巧

- **没有 Tweet Catcher token？** → `.env` 留空 `TWEET_CATCHER_TOKEN`，服务会跳过 WS，只跑 HTTP 部分，用 `/api/dev/inject-tweet` 注入 mock
- **Kimi 限流/超时？** → 看 `[Kimi] enrich error` 日志，基础卡仍会入库，前端会显示"解读中…"
- **WS 断线重连？** → `tweetcatcher.Client.Run` 指数退避 1s→30s，重连日志带 `WS session ended`
- **卡池满了？** → 默认 FIFO 100，旧卡被淘汰，前端拉 `?limit=20` 即可
