# oddfi-agent-backend — Codex / 通用 AI 工具规范

## 启动要求

- 每次对话开始处理本项目代码前，必须先读取并遵守本文件
- 如果用户在对话中补充了更严格的规则，以用户最新要求为准
- 完整项目规则见 `CLAUDE.md`，本文件是给 Codex / Cursor / Gemini 等非 Claude 工具的精简版

---

## 项目一行解释

体育博彩 AI 推送 Agent 后端：Tweet Catcher WS → Kimi/Grok 解析 → 内存卡池 → HTTP API。

技术栈：Go 1.26 + 标准库 `net/http` + `gorilla/websocket` + `sashabaranov/go-openai`。
**没有** Gin / GORM / MySQL / Redis / JWT，不要按金融账户系统的模板去扩展。

---

## 中文注释要求

每次新增或修改代码时，必须为新增或修改的关键逻辑补充清晰的中文注释。

注释重点：

1. WS 协议处理（op codes、心跳、重连退避）
2. LLM 提示词约束 / 解析失败兜底
3. 并发：基础卡先入库 + 异步 enrich
4. 内存卡池 FIFO 淘汰策略
5. CORS / 鉴权策略（如未来引入）
6. 边界条件（空推文、纯 emoji、URL-only）
7. 与前端字段对齐的取舍

要求：

- 注释使用中文
- 注释解释「为什么这么做」，不要复述代码做什么
- 简单自解释代码不需要强行加废话注释
- 修改已有函数时，如果行为发生变化，需要同步更新函数注释或附近说明

---

## 运行时输出（强制英文 + 模块前缀）

```go
// ❌ 中文 log
log.Printf("收到推文")

// ✅ [Module] verb subject
log.Printf("[TweetCatcher] received post id=%s", id)
log.Printf("[Kimi] enrich failed id=%s err=%v", id, err)
log.Printf("[Server] HTTP listening on %s", addr)
```

理由：日志面向运维/排错，统一英文 + 模块前缀方便 grep。中文注释是给读代码的人看。

---

## ARCHITECTURE.md 同步

每次代码有更新后，需要回写项目根目录的 `ARCHITECTURE.md`，确保文件内容与项目架构一致。

---

## AI 基建目录速查

```
.claude/
├── settings.json          # Hook 配置
├── rules/                 # 项目规则（自动加载）
│   ├── git-workflow.md    # 分支策略、commit 规范
│   ├── code-quality.md    # Go 错误处理、日志规范
│   ├── testing.md         # 测试规范
│   ├── api-conventions.md # REST API 约定
│   ├── llm-prompt.md      # ⭐ 本项目专属：prompt 修改红线
│   ├── dd-enh-workflow.md # 设计文档触发门槛
│   ├── review-workflow.md # 代码审查
│   └── agent-delegation.md
├── hooks/
│   ├── guard-bash.sh      # PreToolUse: 拦截 git push / 危险命令
│   └── go-check.sh        # PostToolUse: 编辑 .go 后自动 go vet
└── commands/
    └── partial-commit.md

.progress/                 # 本地 AI 工作空间（gitignored）
├── designs/               # DD-NNN
├── enh/                   # ENH-NNN
├── bug/                   # BUG-NNN
├── research/
├── lessons/
└── stash/
```

---

## Hook 行为

| Hook | 触发时机 | 行为 |
|------|----------|------|
| `guard-bash.sh` | 执行 Bash 前 | 拦截 `git push` / 危险 DB 操作 / `rm -rf` / `Co-Authored-By` |
| `go-check.sh` | 编辑 .go 文件后 | 自动 `go vet ./...`，golangci-lint 如已装也跑 |

---

## DD/ENH 触发门槛

满足任一条件必须先写设计文档并等用户确认：

- 新增 API 端点 ≥ 2 个
- 新增/替换上游数据源（Tweet Catcher → X API / Truth Social / RSS）
- 引入持久化存储（Redis / SQLite / Postgres）
- 替换或新增 LLM provider（Kimi → Grok / Claude / GPT）
- 修改 `PushCard` JSON schema

未触发门槛时可以直接编码（小修小补、bug fix、注释、测试）。

---

## 关键禁止

- ❌ 修改 `internal/kimi/prompt.go` / `chat.go` 中的 system prompt 不和用户对齐
- ❌ 把 LLM 错误直接 500 返给前端（必须降级到基础卡）
- ❌ 把 required PushCard 字段加 `omitempty`（前端会断）
- ❌ 引入 Gin / GORM / MySQL / Redis（当前规模用不上）
- ❌ 在 commit message 中包含 `Co-Authored-By`
- ❌ `git push` 由 AI 自主执行（需用户明确指示）
