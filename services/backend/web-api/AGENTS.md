# 项目专属 Codex 编码规范

## 启动要求

- 每次对话开始处理本项目代码前，必须先读取并遵守本文件。
- 如果用户在对话中补充了更严格的规则，以用户最新要求为准。

## 中文注释要求

每次新增或修改代码时，必须为新增或修改的关键逻辑补充清晰的中文注释。

注释重点包括：

1. 复杂业务逻辑
2. 状态机逻辑
3. 并发控制逻辑
4. 错误处理逻辑
5. 边界条件
6. 金融、交易、链上、价格、风控相关逻辑
7. 不直观的算法或数据结构

要求：

- 注释使用中文。
- 注释解释“为什么这么做”，不要只复述代码做什么。
- 简单自解释代码不需要强行加废话注释。
- 修改已有函数时，如果行为发生变化，需要同步更新函数注释或附近说明。

## 回写项目根目录的 ARCHITECTURE.md 文件
- 每次代码有更新，之后，需要回写项目根目录的 ARCHITECTURE.md 文件，确保文件内容与项目架构一致。

---

## AI 开发基建结构（2026-05-14 新增）

本项目已配置完整的 AI 开发基础设施，目录结构如下：

### `.claude/`（入库，团队共享）

```
.claude/
├── settings.json          # Hook 配置（PreToolUse/PostToolUse）
├── rules/                 # 项目规则文件
│   ├── git-workflow.md    # Git 分支策略、commit 规范
│   ├── dd-enh-workflow.md # DD/ENH 设计文档工作流
│   ├── code-quality.md    # Go 代码质量规范（zerolog、error handling）
│   ├── testing.md         # Go 测试规范（单测/集成测试）
│   ├── api-conventions.md # REST API 规范、Go handler 规范
│   ├── review-workflow.md # 代码审查工作流
│   └── agent-delegation.md# AI Agent 任务委托规范
├── hooks/                 # 自动运行的 hook 脚本
│   ├── guard-bash.sh      # PreToolUse: 拦截危险 Bash 命令
│   └── go-check.sh        # PostToolUse: 编辑 .go 文件后自动 go vet
└── commands/
    └── partial-commit.md  # 部分提交操作指南
```

### `.progress/`（不入库，本地 AI 工作空间）

```
.progress/
├── GUIDE.md               # 目录使用指南
├── designs/               # DD 新功能设计文档（DD-NNN）
├── enh/                   # ENH 优化/重构文档（ENH-NNN）
├── adr/                   # 架构决策记录（ADR-NNNN）
├── research/              # 技术调研报告（RES-NNN）
├── bug/                   # Bug 复盘文档（BUG-NNN）
├── reviews/               # 代码审查报告（REV-NNN）
├── lessons/               # 踩坑经验沉淀
├── runbooks/              # 运维/迁移操作手册
└── stash/                 # 草稿和临时文件
```

### Hook 行为说明

| Hook | 触发时机 | 行为 |
|------|----------|------|
| `guard-bash.sh` | AI 执行 Bash 前 | 拦截 git push、危险 DB 操作、敏感文件暂存等 |
| `go-check.sh` | AI 编辑 .go 文件后 | 自动运行 `go vet ./...`，如有 golangci-lint 也运行 |

### 设计文档工作流

新功能开发遵循：**设计文档 → 人类确认 → 编码**，不允许跳过设计直接编码（满足触发门槛时）。详见 `.claude/rules/dd-enh-workflow.md`。