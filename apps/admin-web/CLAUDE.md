# OddFi 运营后台 · 前端 — 项目规则

## 项目概述

OddFi 内部运营后台前端。覆盖：用户管理、注单查看、出金审核、结算操作、联赛配置、管理员管理。
仅团队 Lark 工作区成员可访问，独立部署在 EC2 `admin.oddfi.io`。

**关联文档**：

- 设计决策：`~/work/oddfi-frontend/.progress/designs/DD-098-admin-panel-ec2-lark-sso.md`
- 后端仓库：`~/work/oddfi-admin-backend`（独立 Go 服务，端口 :8081，连同生产 DB）
- C 端前端：`~/work/oddfi-frontend`（无业务耦合，仅作 AI 基建参考来源）

## 命令

```bash
pnpm dev          # 启动开发服务器（默认端口 5173）
pnpm build        # 生产构建（产物 dist/，rsync 到 EC2 /var/www/oddfi-admin/）
pnpm preview      # 本地预览生产构建
pnpm type-check   # TypeScript 类型检查
pnpm lint         # ESLint 检查
pnpm test         # Vitest 单元测试
```

## 技术栈

- **构建/语言**：Vite + React 19 + TypeScript（strict）
- **框架**：Refine（@refinedev/core@5 + @refinedev/antd@6 + @refinedev/react-router@2 + @refinedev/simple-rest@6）
- **UI**：Ant Design 5（企业组件库，无需自行设计）
- **设计语言**：**Vercel 风格**（design.md 入库为 `docs/DESIGN-SYSTEM.md`，AntD theme 落地为 `src/theme/vercelTheme.ts`）
- **字体**：Geist + Geist Mono（npm 包 `geist`）
- **路由**：react-router-dom v7（与 @refinedev/react-router@2 peerDeps 对齐）
- **HTTP**：ky（与 oddfi-frontend 保持一致，方便迁移工具函数）
- **金额**：decimal.js（与后端 shopspring/decimal 对齐，禁用原生 float）
- **测试**：Vitest + @testing-library/react

## 核心规则（高频遗漏 → 必须执行）

### 1. 后端响应格式适配

OddFi 后端统一返回 `{ code: number, message: string, data: T }`，Refine 默认 dataProvider 不识别这套结构。**所有数据请求必须经过 `providers/dataProvider.ts` 包装**，禁止页面里直接 `ky.get`。

### 2. 鉴权强约束

- JWT 存 `localStorage.oddfi_admin_jwt`（与后端 `Authorization: Bearer <token>` 格式约定一致）
- **禁止**写 Cookie（避免 CSRF；DD §5 安全模型）
- Token 过期统一在 `authProvider.check` 里捕获 → 重定向到 `/auth/lark/login`

### 3. RBAC 前端表现

前端 `RoleGuard` **只控制 UI 可见性**，不做安全保证。**所有越权校验由后端 `RoleRequired` 中间件兜底**。即便前端漏了隐藏按钮，后端必须返回 403。

### 4. 运行时输出英语强制

```ts
// ❌ console.error("获取用户列表失败", e)
// ✅ console.error("[UserList] Failed to fetch users", e)
```

详见 `.claude/rules/code-quality.md`。

### 5. 方案确认后再编码

DD/ENH 方案必须等人类确认后才能编码。规则详见 `.claude/rules/dd-enh-workflow.md`。

### 6. Design Token 强约束（Vercel 风格）

**所有颜色 / 字号 / 圆角 / 阴影**必须走 `src/theme/vercelTheme.ts` 的 token，禁止 inline 硬编码。

```tsx
// ❌ <div style={{ color: '#171717' }}>...</div>
// ✅ <Typography.Text>...</Typography.Text>
// ✅ const { token } = theme.useToken(); <div style={{ color: token.colorTextBase }} />
```

完整反模式 + 改主题 SOP：`.claude/rules/design-tokens.md`
设计语言原文：`docs/DESIGN-SYSTEM.md`
token 映射表 + 决策记录：`docs/THEME-MAPPING.md`

**核心范式决策**（已锁定，不要再争）：
- 后台属 in-app 范式 → 6px 方角，**不要** 100px pill 按钮
- 字重上限 600，display 系列必须负字距
- 不引入第六种强调色（红/蓝/橙/绿/黑 + canvas 灰阶足矣）
- 不引入 mesh gradient / 大插画

## 规则索引（按 path glob 自动加载）

| 文件                       | 覆盖范围                                                  |
| -------------------------- | --------------------------------------------------------- |
| `code-quality.md`          | 运行时输出英语 / 禁止/允许模式                            |
| `git-workflow.md`          | 分支策略 / commit 中文 / Squash Merge / 禁止绕过 hook     |
| `testing.md`               | 测试分层 / P0 清单 / 任务完成标准                         |
| `api-conventions.md`       | ky client / dataProvider / authProvider / 金额精度        |
| `refine-conventions.md`    | Refine resource 声明 / vercelTheme / List/Show 约定       |
| `design-tokens.md`         | Design Token 强约束 / Vercel 风格 / 反模式                |
| `lark-oauth.md`            | Lark OAuth 流程 / JWT 存储 / 回调处理                     |
| `rbac.md`                  | 4 角色定义 / RoleGuard 用法 / 菜单权限矩阵                |
| `agent-delegation.md`      | Subagent 上下文传递（必传 design 决策矩阵）               |
| `dd-enh-workflow.md`       | DD/ENH 触发门槛 / 模板 / 工作流                           |
| `dd-flow.md`               | DD 端到端 6 阶段闭环（方案→拆 task→实现→team:2 review→归档）|

## 资产复用

新建 hook / 公共组件 / 工具前，先在 `src/hooks/`、`src/lib/`、`src/components/` 里 grep。命中替代 → 复用；未命中 → commit message 标注「新建理由」。

## 不做什么（明确边界）

- **不复制 oddfi-frontend 的钱包逻辑**：admin 后台不接钱包，没有合约调用
- **不引入 Tailwind**：Ant Design 自带样式系统，避免双轨制
- **不引入 i18n**：内部工具仅中文界面
- **不做 PWA / SEO / OG**：内部工具
- **不做移动端响应式**：固定 PC 布局（min-width: 1280px）
