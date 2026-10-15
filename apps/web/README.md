# Oddfi

链上预测市场平台演示版本。

## 前置依赖

- Node.js >= 20
- pnpm >= 9

## 启动

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

## 环境变量

项目根目录创建 `.env.local`，以下为完整变量清单：

### 客户端变量（NEXT_PUBLIC\_）

| 变量                                    | 必填 | 示例值               | 说明                                                                                                                                                                                    |
| --------------------------------------- | ---- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL`              | 是   | `/api`               | API 基础路径。开发环境设 `/api`（MSW 拦截），生产环境设真实后端地址                                                                                                                     |
| `NEXT_PUBLIC_ENABLE_MSW`                | 是   | `true`               | MSW 开关。`true` = 所有 API 走 Mock 数据；删除或 `false` = 走真实后端                                                                                                                   |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | 是   | `your_wc_project_id` | WalletConnect Project ID，从 [cloud.walletconnect.com](https://cloud.walletconnect.com) 获取                                                                                            |
| `NEXT_PUBLIC_NETWORK_MODE`              | 否   | `testnet`            | 网络模式（DD-079）。设 `testnet` 切到 BSC Testnet (97) + 真 ODD 合约；省略 = mainnet。仅由 `pnpm dev:testnet` 通过 `.env.testnet.local` 注入，不写入 `.env.local`                       |
| `NEXT_PUBLIC_SHOW_DEV_TOOLS`            | 否   | `true`               | DevTools 按钮 + Mock 余额指示器开关。生产环境默认隐藏，设 `true` 强制显示                                                                                                               |
| `NEXT_PUBLIC_BSC_RPC_URL`               | 否   | `https://...`        | 自定义 BSC Mainnet RPC 节点。不设则使用链默认 RPC                                                                                                                                       |
| `NEXT_PUBLIC_BSC_TESTNET_RPC_URL`       | 否   | `https://...`        | BSC Testnet RPC 节点（DD-079 联调用），公共 RPC 限流严重建议自备 Alchemy / QuickNode                                                                                                    |
| `NEXT_PUBLIC_EARLY_BIRD_MODE`           | 否   | `1`                  | 主站早鸟模式开关（DD-103）。`1` = 启用（仅主站 oddfi.io Production 设置），其他值 / 缺失 = 关闭（testnet/dev/pre 行为不变）。仅由 `pnpm dev:earlybird` 通过 `.env.earlybird.local` 注入 |

### 服务端变量

| 变量             | 必填 | 示例值                            | 说明                                               |
| ---------------- | ---- | --------------------------------- | -------------------------------------------------- |
| `INVITE_CODE`    | 是   | `your-invite-code`                | 访问保护邀请码，用于登录门控验证                   |
| `BACKEND_URL`    | 是   | `http://api.oddfi.io`             | 认证/账户后端地址（服务端代理专用）                |
| `MARKET_API_URL` | 否   | `http://market-api.oddfi.io:8080` | 赛事数据后端地址（不设则 fallback 到 BACKEND_URL） |

### Vercel 自动注入

| 变量                     | 说明                                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_VERCEL_ENV` | Vercel 部署时自动设置。`preview` = 预览部署，`production` = 生产部署。用于控制 DevTools 等开发功能的可见性 |

### 本地开发最小配置

```env
NEXT_PUBLIC_API_BASE_URL=/api
NEXT_PUBLIC_ENABLE_MSW=true
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_wc_project_id
INVITE_CODE=your-invite-code
BACKEND_URL=http://api.oddfi.io
MARKET_API_URL=http://market-api.oddfi.io:8080
```

> 开发环境下 `NEXT_PUBLIC_ENABLE_MSW=true` 时所有接口由 MSW 拦截，无需启动后端服务。

### Testnet 联调（DD-079）

需要在 BSC Testnet 上跑真实 ODD 合约联调时，**新建独立 env 文件**（git 已忽略），不与 `.env.local` 混：

```env
# .env.testnet.local — 仅 pnpm dev:testnet 通过 dotenv-cli 加载
NEXT_PUBLIC_NETWORK_MODE=testnet
NEXT_PUBLIC_BSC_TESTNET_RPC_URL=https://bnb-testnet.g.alchemy.com/v2/<your-key>
BACKEND_URL=http://dev-api.oddfi.io
MARKET_API_URL=http://dev-market-api.oddfi.io:8080
NEXT_PUBLIC_WS_KLINE_URL=wss://dev-market-api.oddfi.io/ws
NEXT_PUBLIC_ENABLE_MSW=false
```

启动：`pnpm dev:testnet`（端口 4002）。Testnet 部署参见 `testnet.oddfi.io`。

### 早鸟模式（DD-103）

主站 `oddfi.io` Production 在产品功能未对外开放期启用。行为：

- 去除邀请码闸门，所有访客直接进入 Home Landing
- 顶部 nav / CTA / 钱包选择器内任一选项点击 → 弹「早鸟登记」Modal（不进入下游路由 / 不真实连接钱包）
- 非 Home 路由（`/markets` 等）→ middleware 307 重定向回 Home 防 hack URL

仅主站 Production 启用，testnet / dev / pre 行为完全不变。本地模拟：

```env
# .env.earlybird.local — 仅 pnpm dev:earlybird 通过 dotenv-cli 加载
NEXT_PUBLIC_EARLY_BIRD_MODE=1
```

启动：`pnpm dev:earlybird`（端口 4003）。

### Vercel 部署配置

除上述必填变量外，如需在生产环境启用开发者工具（Mock 余额、DevTools 按钮），额外设置：

```
NEXT_PUBLIC_SHOW_DEV_TOOLS=true
```

## Design Token 体系

项目使用 Figma 导出的 Design Token 统一管理颜色、语义变量，支持 Dark / Light 主题切换。

### 架构概览

```
tokens/figma/Dark.tokens.json   ─┐
                                  ├─→ pnpm sync-tokens ─┬─→ app/design-tokens.css  (CSS 变量，:root + [data-theme="light"])
tokens/figma/Light.tokens.json  ─┘                      ├─→ lib/design-tokens.ts   (TS 常量，供 chart 等 JS 场景)
                                                         └─→ tailwind.config.ts     (通过 var() 引用，Tailwind class 可用)
```

### Token 使用规范

- Tailwind class 直接用语义名：`text-primary`、`bg-secondary`、`border`、`bg-btn-primary`
- 禁止硬编码 hex 色值（如 `bg-[#191b20]`、`text-[#fff]`），必须走 token
- 需要透明度时用 Tailwind 修饰符：`bg-fill-dropdown/[0.78]`
- 外部品牌色（钱包 icon 等）例外，可保留硬编码

### Token 分类速查

| Tailwind 前缀                     | 用途       | 示例                                                                  |
| --------------------------------- | ---------- | --------------------------------------------------------------------- |
| `text-{name}`                     | 文字颜色   | `text-primary` `text-secondary` `text-brand-default` `text-clr-green` |
| `bg-{name}`                       | 背景色     | `bg-primary` `bg-secondary` `bg-tertiary`                             |
| `bg-fill-{name}`                  | 填充面     | `bg-fill-input` `bg-fill-modal` `bg-fill-dropdown` `bg-fill-mask`     |
| `bg-btn-{name}`                   | 按钮状态   | `bg-btn-primary` `bg-btn-primary-hover` `bg-btn-red`                  |
| `bg-tag-{name}`                   | 标签填充   | `bg-tag-green` `bg-tag-red` `bg-tag-brand`                            |
| `border-{name}`                   | 边框       | `border`(默认) `border-divider` `border-dt-hover`                     |
| `text-fn-{name}` / `bg-fn-{name}` | 功能语义色 | `text-fn-red` `bg-fn-green` `text-fn-orange`                          |

### 更新 Token

当 Figma 设计变量有更新时，需要重新同步到项目代码。提供两种方式：

#### 方式 A：Skill 模式（推荐）

在 Claude Code 中直接调用 `/sync-tokens` skill：

```
/sync-tokens ~/Downloads/Dark.tokens.json ~/Downloads/Light.tokens.json
```

Skill 会自动完成：复制 JSON → 运行脚本 → 展示 diff → 确认提交。

#### 方式 B：手动模式

```bash
# 1. 从 Figma 导出 JSON（右侧面板 → Local variables → Export JSON）
#    分别导出 Dark 和 Light 集合

# 2. 复制到项目
cp ~/Downloads/Dark.tokens.json  tokens/figma/Dark.tokens.json
cp ~/Downloads/Light.tokens.json tokens/figma/Light.tokens.json

# 3. 运行同步脚本（自动生成 CSS 变量 + TS 常量）
pnpm sync-tokens

# 4. 检查变更
git diff app/design-tokens.css lib/design-tokens.ts

# 5. 如果 Figma 新增了全新 token 类别，还需更新 tailwind.config.ts 中的映射
```

> **注意**：`app/design-tokens.css` 和 `lib/design-tokens.ts` 是自动生成文件，禁止手动编辑。

---

## API 代理架构

前端通过 Next.js Route Handler 代理后端请求（DD-053），浏览器不直接访问后端：

| 浏览器路径       | 代理到                    | 后端服务  |
| ---------------- | ------------------------- | --------- |
| `/api/account/*` | `BACKEND_URL/account/*`   | 认证/账户 |
| `/api/v1/*`      | `MARKET_API_URL/api/v1/*` | 赛事/赔率 |
| `/api/bets/*` 等 | MSW Mock（待接入后端）    | —         |

---

## 常用命令

### 开发与构建

| 命令                 | 说明                                                                 |
| -------------------- | -------------------------------------------------------------------- |
| `pnpm dev`           | 启动开发服务器（mainnet 模式，端口 3000）                            |
| `pnpm dev:test`      | 连接 dev 测试后端（mainnet 模式，端口 4001，读 `.env.dev.local`）    |
| `pnpm dev:testnet`   | BSC Testnet 联调（DD-079，端口 4002，读 `.env.testnet.local`）       |
| `pnpm dev:earlybird` | 主站早鸟模式本地模拟（DD-103，端口 4003，读 `.env.earlybird.local`） |
| `pnpm build`         | 生产构建                                                             |
| `pnpm test`          | 运行 Vitest 测试                                                     |
| `pnpm type-check`    | TypeScript 类型检查                                                  |
| `pnpm lint`          | ESLint 检查                                                          |
| `pnpm format`        | Prettier 格式化                                                      |

### 工程辅助

| 命令                          | 说明                                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| `pnpm wt <name> <branch>`     | 创建 git worktree 到 `.claude/worktrees/<name>` 并自动 symlink env / skills（详见 `git-workflow.md`） |
| `pnpm sync:branches <target>` | 同步长期部署分支到最新 main（`<target>` 取 `testnet` / `dev` / `pre` / `all`，详见下方）              |
| `pnpm sync-tokens`            | 同步 Figma Design Token（也可通过 `/sync-tokens` skill 调用）                                         |
| `pnpm gen-assets`             | 重新生成 `docs/ASSETS.md` AUTO 块（pre-commit hook 报"AUTO 块过期"时跑这个）                          |
| `pnpm gen:favicons`           | 从 SVG 源重新生成多尺寸 favicon                                                                       |

### 同步部署分支（dev / pre / testnet）

`dev` / `pre` / `testnet` 是绑定 Vercel 部署的长期分支，定位是 main 的镜像 —— 环境差异由 Vercel Project 的 Environment Variables / Domain 控制，分支代码与 main 完全一致。

```bash
pnpm sync:branches testnet     # 只同步 testnet
pnpm sync:branches dev         # 只同步 dev
pnpm sync:branches pre         # 只同步 pre
pnpm sync:branches all         # 同步全部 3 条
```

脚本对每条分支执行：`reset --hard main` → `commit --allow-empty`（改 SHA 绕 Vercel dedupe）→ `push --force-with-lease`，全程在前置校验下安全跑（要求当前在 main、工作区 clean、本地 main 与 origin/main 同步）。详见 `.claude/rules/git-workflow.md` 「长期部署分支同步规范」段。

也可通过 `/sync-branches` skill 自然语言触发，内部调用同一个脚本。
