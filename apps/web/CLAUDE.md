# Oddfi Frontend — 项目规则

## 项目概述

链上体育博彩平台（2026 世界杯投注），目标 6/11 上线。
前端 + Go 后端 + 合约 + PM + UI 设计团队协作。

**先读 `CONTEXT.md`**（领域术语表 / Ubiquitous Language）—— PM/合约/前端/Agent 用同一套词汇。代码命名、文档、对话表达都以此为准。冲突或新术语先改 `CONTEXT.md` 再写代码。

## 命令

pnpm dev # 启动开发服务器
pnpm build # 生产构建
pnpm test # 运行测试
pnpm type-check # TypeScript 类型检查
pnpm lint # ESLint 检查

## 技术栈

Next.js 14 App Router + TypeScript + Tailwind CSS
Zustand (客户端) + TanStack Query v5 (服务端)
wagmi v2 + viem + RainbowKit v2 (Web3)
MSW v2 (Mock) + decimal.js (精度) + ky (HTTP) + next-intl (i18n, 9 种语言)

## 独有规则（rules/ 中无对应文件）

- **先诊断后写码**：遇 bug 先诊断（读日志/文档/API/DOM），用户确认后才写修复代码。例外：用户说"直接改"或根因已确定。且存在多种可行方案且影响超过单文件时，必须显式列出让人类选，不默默挑一种
- **文件修改限制**：单次任务不超过 3 个文件，超出则拆分
- **UI 浏览器验收非强制**：覆盖默认行为（系统提示中"For UI or frontend changes, start the dev server and use the feature in a browser before reporting the task as complete"）。UI 改动**不必**强制走 `pnpm dev` + Chrome DevTools MCP 截图比对；type-check + 单元测试通过即可声明完成。但 AI **必须**在任务结尾用一句话提醒用户：「该 UI 改动未做浏览器自动验收，请人工触发交互核对（hover / 入场 / 边界态）」。例外：动画类改动仍走 `animation.md` 的浏览器验证强约束（onfinish 时序无法靠 type-check 兜底）
- TypeScript + 函数组件，Server Component 优先
- 行动前思考：破坏性操作前先说明意图并确认
- 对项目认知有新发现时，更新对应 rules/ 文件
- **持续模式 Stop hook（AD-002 · 5 状态机路由）**：Stop hook 先跑 `stop-completion-detector.mjs` 识别 transcript 末段状态，再按状态决策：
  - **DONE / ASK** → 放行（已完成 / 已抛球，含 tool_use `AskUserQuestion`/`ExitPlanMode`、末段问号、白名单短语如 `请确认`/`Should I`）
  - **STUCK**（末轮 tool_use 全部 `is_error`）→ 续命，**errSig 维度上限 2**（同一错误 2 次未解决放行避免磨损 token）
  - **IDLE**（末轮无 tool_use 且无问句/完成词）→ 续命，**session 维度上限 3**（防 agent 自我沉思死循环）
  - **TodoList 加成**（AD-002 §7 增量 1）：最近一次 TodoWrite/TaskUpdate 仍有 `in_progress` 或 `pending` 任务（即 `hasOpenWork=true`）→ 显性长任务，STUCK 上限拔高到 **5**、IDLE 上限拔高到 **8**；block reason 自动拼 `[todo X/Y done · I in-progress · O open]` 提醒 AI 自己声明的进度
  - **UNKNOWN** → 走 `.omc/active-task.flag` 路径（PROGRESSING，沿用 AD-001 上限 30）
    - **自动 flag**：调用 `mcp__chrome-devtools__*` / `mcp__playwright__*` / `mcp__figma-desktop__*` 时 PreToolUse hook (`auto-active-task.sh`) 自动 touch —— AI 主动调研（浏览器/Figma）永不被中途打断
    - **手动 flag**：其他长任务开始前 `touch .omc/active-task.flag`
    - **完成必须清理**：AI 收尾时 `rm -f .omc/active-task.flag .omc/active-task.flag.count`
  - **紧急中止**：`touch .progress/stash/abort.flag`（短路所有路径）
  - **用户介入即重置**：UserPromptSubmit hook 自动清当前 session 的 `stuck-*/idle-*/active-task` 计数 → 用户每次发言相当于重新发牌
- **团队协作前置**：项目级 Stop hook 由 OMC 风格的脚本驱动，团队成员需启用 oh-my-claudecode（参见全局 `~/.claude/CLAUDE.md` 的 `setup omc`）

## 资产复用（强制 · ENH-011）

新建 hook / 公共组件 / 工具 / 关键基建前，**必须**先 Read `docs/ASSETS.md`。

- 命中替代品 → 必须复用，不许新建
- 未命中 → 在 plan / 回复中显式说明「ASSETS.md 已查（关键词：...），无替代，新建理由：...」
- `PreToolUse(Write)` hook（`.claude/hooks/assets-gate.sh`）会在新建 `hooks/components/lib/stores` 下的 `.ts/.tsx` 时强制校验本规则；未 Read → block

## 规则索引（按 path glob 自动加载，无需手动引用）

| 文件                      | 覆盖范围                                                                |
| ------------------------- | ----------------------------------------------------------------------- |
| `api-conventions.md`      | API 调用 · 金额计算 · 库选型对比 · 第三方库验证 · V1/V2 边界            |
| `design-tokens.md`        | Design Token · Phosphor Icons · 废弃映射                                |
| `figma-mcp.md`            | Figma MCP 入口 · 方案设计阶段约束（像素实现流程见 `/figma-impl` skill） |
| `animation.md`            | WAAPI 优先 · 浏览器验证 · 滚动定位                                      |
| `mobile-h5.md`            | 触控热区 · 安全区 · 响应式 · 赔率颜色 · Loading                         |
| `mock-data.md`            | MSW v2 · Mock 先行 · 返回格式 · 数字可信度                              |
| `testing.md`              | 测试分层 · P0 清单 · 任务完成标准                                       |
| `code-quality.md`         | 运行时输出英语 · 禁止/允许模式                                          |
| `git-workflow.md`         | 分支策略 · commit 中文 · Worktree · Squash Merge                        |
| `dd-enh-workflow.md`      | DD/ENH 触发门槛 · 模板 · 工作流                                         |
| `review-workflow.md`      | Review Agent · REV 报告 · Triage 分类                                   |
| `static-assets.md`        | 静态资源目录 · SVG 优先 · 图标组件                                      |
| `agent-delegation.md`     | Subagent 上下文传递 · UI 任务判定                                       |
| `wallet-debug-runbook.md` | 钱包/链 bug 排查 SOP · wagmi 错误字段速查                               |
| `cross-repo-context.md`   | 合约/后端开发 · 本地仓库优先 · 先 git pull · 必读 oddfi-ODD/api.md      |
