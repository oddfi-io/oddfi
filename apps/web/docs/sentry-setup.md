# Sentry 接入指南

> 环境变量模板: [`.env.example`](../.env.example)（搜索 "Sentry" 章节）

## 1. 创建 Sentry 账号与项目

1. 使用公司账号注册 [sentry.io](https://sentry.io)
2. 创建 Organization（如 `oddfi`）
3. Data Storage Location 选 **United States (US)**（与 AWS 新加坡 + Vercel 链路更近）
4. 创建 Project，平台选 **Next.js**

## 2. 项目配置

在 Project Settings 中调整以下配置：

| 配置项 | 推荐值 | 说明 |
|--------|--------|------|
| Slug | `oddfi-web` | 默认的 `javascript-nextjs` 太通用 |
| Subject Prefix | `[oddfi]` | 邮件筛选用 |
| Spike Protection | ✅ 开启 | 防免费额度被突发流量打穿 |
| Auto Resolve | 30 天 | Issue 30 天未复现自动关闭，复发时重新打开 |
| Allowed Domains | `oddfi.io` / `*.oddfi.io` / `localhost` | 收紧来源域名，`*` 有滥用风险 |
| JavaScript source fetching | ✅ 开启 | 允许 Sentry 抓取缺失的 JS source context |

## 3. 获取 DSN

**路径**: Project Settings → Client Keys (DSN)

格式示例:
```
https://xxxxxxxxxxxx@o123456.ingest.us.sentry.io/1234567
```

写入 `.env.local`:
```env
NEXT_PUBLIC_SENTRY_DSN=<你的 DSN>
```

## 4. 创建 Auth Token

需要创建 **两种 Token**，用途不同：

### 4a. Organization Token — `SENTRY_AUTH_TOKEN`

用于构建时上传 Source Map，本地和 Vercel 用同一个值。

**路径**: Settings → Developer Settings → **Organization Tokens** → Create New Token

| 配置项 | 值 |
|--------|-----|
| Name | `vercel-build` |
| Scope | `org:ci`（固定，Source Map Upload + Release Creation） |

### 4b. Personal Token — `SENTRY_LOCAL_AUTH_TOKEN`

用于 `/sentry` Skill 查询 Issue，仅本地使用。

**路径**: Settings → Developer Settings → **Personal Tokens** → Create New Token

| 配置项 | 值 |
|--------|-----|
| Name | `oddfi-sentry-monitoring` |
| Project | Read |
| Issue & Event | Read |
| Organization | Read |
| 其他 | No Access |

Permissions Preview: `event:read`, `project:read`, `organization:read`

### 写入 `.env.local`

```env
SENTRY_AUTH_TOKEN=<Organization Token>
SENTRY_LOCAL_AUTH_TOKEN=<Personal Token>
SENTRY_ORG=oddfi
SENTRY_PROJECT=oddfi-frontend
```

> `SENTRY_AUTH_TOKEN` 在 Vercel 环境变量中也需要配置（同一个 Organization Token）。

## 5. 验证

```bash
# 验证 API 连通性
curl -s -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  "https://sentry.io/api/0/projects/$SENTRY_ORG/$SENTRY_PROJECT/" \
  | jq '{slug: .slug, status: .status}'

# 预期输出
# { "slug": "oddfi-frontend", "status": "active" }
```

## 6. 代码侧（已集成）

代码中 `@sentry/nextjs` 已接入，相关文件：

| 文件 | 说明 |
|------|------|
| `lib/sentry.ts` | 项目级封装（`captureBetError`, `captureBalanceAnomaly`, `setSentryUser`） |
| `instrumentation-client.ts` | 客户端 Sentry init + 噪声过滤 |
| `sentry.server.config.ts` | 服务端 Sentry init |
| `sentry.edge.config.ts` | Edge Runtime Sentry init |
| `app/global-error.tsx` | 全局 Error Boundary |

## 7. 关联工具

- `/sentry` Skill: 从 Sentry API 拉取未解决 Issue → 按阈值过滤 → 生成 regression 测试
- `/preflight` Check 7: 开发前自动检查是否有堆积的 Sentry Issue
