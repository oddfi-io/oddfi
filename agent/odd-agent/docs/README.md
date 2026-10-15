# 文档地图

本目录是 **odd_agent** 当前真实实现状态的设计、开发、测试与进度入口。文档按分类目录保留，再在分类目录下按功能划分。

当前运行时只保留：

- Foundation 基础组件。
- Memory v3 独立长期语义记忆 SDK。
- Chat Agent 单 Agent SSE 对话接口。
- 用户标签推送服务。

旧多 Agent / Chat / Workflow 文档已删除，不再作为当前实现依据。

## 阅读顺序

1. `docs/architecture/odd-agent-current-function-architecture.png`：当前整体功能架构图。
2. `docs/architecture/foundation/架构设计.md`：Foundation 组件当前架构。
3. `docs/architecture/memory/架构设计.md`：Memory v3 当前架构。
4. `docs/architecture/user-tag/架构设计.md`：用户标签推送当前架构。
5. `docs/architecture/chat-agent/架构设计.md`：单 Agent Chat SSE 当前架构。
6. `docs/development/foundation/功能文档.md`：Logger / DB / Redis / Embedding DB / LLM / Memory foundation 组件实现口径。
7. `docs/development/memory/功能设计.md`：Memory v3 详细设计。
8. `docs/development/memory/功能文档.md`：Memory v3 对外接口和实现摘要。
9. `docs/development/chat-agent/功能设计.md`：Chat Agent 接口、prompt、Memory 编排与测试页面设计。
10. `docs/development/user-tag/功能文档.md`：Tweet Catcher、标签匹配、Centrifugo 推送链路。
11. `docs/development/user-tag/接口设计.md`：用户标签 HTTP 接口（含 DD-134 `/internal/*` 鉴权与 `/internal/memory/list`）。
12. `docs/development/user-tag/表设计.md`：用户标签相关表设计。
12.1. `docs/architecture/internal-api/架构设计.md`：DD-134 internal API 安全模型与集成边界。
12.2. `docs/development/internal-api/集成开发方案_DD-134.md`：DD-134 AI Agent 侧实现细节与测试矩阵。
13. `docs/deployment/迁移说明.md`：SQL migration 与废弃表处理。
14. `docs/deployment/生产部署说明.md`：生产部署目录、systemd、Centrifugo 与验收步骤。
15. `docs/deployment/nginx-jwt-auth.md`：Nginx/OpenResty 边界 JWT 鉴权 Lua 脚本接入说明。
16. `docs/progress/foundation/功能现状.md`：Foundation 与 Memory 当前验收状态。
17. `docs/progress/chat-agent/功能现状.md`：Chat Agent 当前验收状态。
18. `docs/progress/user-tag/功能现状.md`：用户标签当前验收状态。
19. `docs/testing/chat-agent/本地测试报告_2026-05-23.md`：Chat Agent 本地测试报告。
20. `docs/testing/memory/真实场景测试报告_2026-05-22.md`：Memory provider 注入的 Embedding DB 事实源口径，真实 MiniMax + Qdrant/Pinecone + Ollama 场景报告。
21. `docs/testing/memory/真实场景测试报告_2026-05-20.md`：Memory 历史 PostgreSQL 主表口径的真实 MiniMax + pgvector + Ollama 场景报告。
22. `docs/testing/foundation/embedding-db-真实场景回归_2026-05-20.md`：Embedding DB pgvector、Qdrant、Chroma、Milvus、Pinecone 与 memory provider 回归。
23. `docs/testing/user-tag/真实链路测试报告_2026-05-20.md`：用户标签真实链路报告。

## 当前目录结构

```text
docs/
├── README.md
├── architecture/
│   ├── odd-agent-current-function-architecture.png
│   ├── internal-api/
│   │   └── 架构设计.md
│   ├── foundation/
│   │   └── 架构设计.md
│   ├── memory/
│   │   └── 架构设计.md
│   ├── chat-agent/
│   │   └── 架构设计.md
│   └── user-tag/
│       └── 架构设计.md
├── deployment/
│   ├── nginx-jwt-auth.md
│   ├── 生产部署说明.md
│   └── 迁移说明.md
├── development/
│   ├── internal-api/
│   │   └── 集成开发方案_DD-134.md
│   ├── foundation/
│   │   └── 功能文档.md
│   ├── memory/
│   │   ├── 功能文档.md
│   │   └── 功能设计.md
│   ├── chat-agent/
│   │   └── 功能设计.md
│   └── user-tag/
│       ├── 功能文档.md
│       ├── 接口设计.md
│       └── 表设计.md
├── progress/
│   ├── foundation/
│   │   └── 功能现状.md
│   ├── chat-agent/
│   │   └── 功能现状.md
│   └── user-tag/
│       └── 功能现状.md
└── testing/
    ├── chat-agent/
    │   └── 本地测试报告_2026-05-23.md
    ├── foundation/
    │   └── embedding-db-真实场景回归_2026-05-20.md
    ├── memory/
    │   ├── 真实场景测试报告_2026-05-20.md
    │   └── 真实场景测试报告_2026-05-22.md
    └── user-tag/
        └── 真实链路测试报告_2026-05-20.md
```

## 配置口径

唯一运行时配置仍为 `config/odd-agent.yaml`，仓库模板为 `config/odd-agent.example.yaml`。当前顶层 section：

- `server`：HTTP 服务配置。
- `logger`：共享结构化日志配置。
- `db`：共享 PostgreSQL 配置。
- `redis`：共享 Redis 配置。
- `centrifugo`：共享 Centrifugo HTTP publish 配置。
- `internal_auth`：`/internal/*` 服务间 X-Service-Token 鉴权配置（DD-134）；`service_token_secret_ref` 走 secret provider 解析，启动期缺失 fail-fast。
- `tweet_catcher`：共享 Tweet Catcher WebSocket 配置。
- `user_tag`：用户标签功能配置，包括 `snapshot_refresh_interval_ms` 和 `llm`。
- `chatllm`：单 Agent Chat 用户可见回答 LLM 配置。
- `tools`：Chat Agent 工具配置，包括通用 `web_search` 的 Brave Search MCP 配置与单次请求最大工具调用次数。
- `memory`：Memory v3 配置；其下包含 `llm`、`embedding-llm` 和 `embedding-db`。
- `local_secrets`：本地 ignored secret 覆盖。

不得恢复 `foundation`、`memory_component`、`chat_agent`、`supervisor_agent`、`market_copilot_agent`、`agents`、`worker_agents`、`jobs`、旧顶层 `tag_llm` 或旧顶层 `vector_store`。

## 维护规则

- 架构变化先更新 `docs/architecture/<功能>/架构设计.md`。
- Foundation 接口或配置变化更新 `docs/development/foundation/功能文档.md` 和 `docs/progress/foundation/功能现状.md`。
- Memory 组件变化更新 `docs/architecture/memory/`、`docs/development/memory/` 和 `docs/testing/memory/`。
- Chat Agent 功能、接口或 prompt 变化更新 `docs/architecture/chat-agent/`、`docs/development/chat-agent/` 和 `docs/progress/chat-agent/`。
- 用户标签功能、接口、表变化更新 `docs/architecture/user-tag/` 与 `docs/development/user-tag/`。
- 新功能必须在相关分类下新增自己的功能子目录，不要把多个功能继续堆在一个分类根目录文件里。
