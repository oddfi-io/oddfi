# 数据缓存策略

> 本文档是项目数据缓存策略的**唯一权威来源**。所有缓存相关的调整、新增路由的缓存配置，都应先查阅本文档，修改后同步更新。

---

## 1. 架构总览

```
浏览器 → TanStack Query（客户端缓存） → Vercel CDN（边缘缓存） → Next.js Route Handler → 后端
```

两层缓存独立运作：

- **客户端缓存**（TanStack Query）：减少请求发送频率，由 `staleTime` / `refetchInterval` 控制
- **CDN 缓存**（Vercel Edge）：减少回源到后端的次数，由 `Cache-Control` 响应头控制

本文档聚焦 **CDN 缓存层**（Route Handler 设置的 `Cache-Control`）。

---

## 2. 路由与缓存策略

### 2.1 V1 市场数据（`/api/v1/[...path]` → `market-api.oddfi.io`）

公开数据，所有用户看到相同内容。

| 路径                          | `s-maxage` | `stale-while-revalidate` | 数据特性                |
| ----------------------------- | ---------- | ------------------------ | ----------------------- |
| `detail/sports_all`           | 60 (1min)  | 300 (5min)               | 赛事列表，分钟级变动    |
| `detail/sports_all?type=live` | 10 (10s)   | 30                       | 实时比分，秒级变动      |
| `detail/fixture/{id}`         | 10 (10s)   | 30                       | 单场详情+赔率，秒级变动 |
| `detail/fixture_date/{date}`  | 动态       | 动态                     | 按日期查赛程，见下表    |
| 其他 V1 路径                  | 15         | 60                       | 默认兜底                |

#### `fixture_date` 日期距离动态 TTL

| 日期距离                   | `s-maxage`  | `stale-while-revalidate` | 原因                 |
| -------------------------- | ----------- | ------------------------ | -------------------- |
| 今天（diffDays ≤ 0）       | 60          | 300                      | 比分/状态实时变动    |
| 明天（diffDays = 1）       | 300 (5min)  | 600 (10min)              | 阵容公布期，中等变动 |
| 后天及以后（diffDays ≥ 2） | 600 (10min) | 1800 (30min)             | 赛程基本固定         |

**代码位置**：`app/api/v1/[...path]/route.ts` — `getCacheControl()` 函数。

### 2.2 Account 用户数据（`/api/account/[...path]` → `api.oddfi.io`）

用户私有数据（余额、充值地址等），**绝不能被 CDN 缓存**。

| 请求方法 | `Cache-Control`     | 原因                 |
| -------- | ------------------- | -------------------- |
| GET      | `private, no-store` | 金融数据不可共享缓存 |
| POST     | `private, no-store` | 同上                 |

**代码位置**：`app/api/account/[...path]/route.ts`。

### 2.3 客户端缓存参考（TanStack Query）

与 CDN 缓存独立，仅供交叉参考：

| Hook                  | `staleTime` | `refetchInterval` | 说明         |
| --------------------- | ----------- | ----------------- | ------------ |
| `useMarketData`       | 30s         | 30s               | 赛事列表轮询 |
| `FixtureDetailClient` | 15s         | 15s               | 单场详情轮询 |

---

## 3. 关键设计决策

### Auth header 剥离（V1 GET）

V1 GET 请求调用 `proxyRequest()` 时传 `null` 代替实际 Auth token。

**原因**：

- 市场数据是公开数据，不依赖 Auth 做个性化返回
- RFC 7234 §3.2：Vercel CDN 默认不缓存带 `Authorization` header 的请求
- 如果转发 Auth，CDN 会按每个用户 token 分裂缓存条目，命中率归零

**回退方案**：如果后端确实需要 Auth 校验 V1 GET 请求，则保留 Auth 并依靠 `public` 指令覆盖 CDN 默认行为。

### 只缓存成功响应

`getCacheControl()` 返回的头只在 `response.status === 200` 时设置。502/4xx/5xx 错误响应不能被 CDN 缓存，否则错误会被分发给所有用户直到 TTL 过期。

### 不设 Vary header

所有响应差异通过 URL query string 区分（`app_lang`、`type`、`page`、`league`），Vercel CDN 默认按完整 URL（含 query string）做缓存 key。设 `Vary: Authorization` 只会无意义地分裂缓存。

### POST 不缓存

V1 POST handler 不设置任何 `Cache-Control`，HTTP 规范默认不缓存 POST。Account POST 显式设 `private, no-store` 作为防御性措施。

### 缓存行为说明

- **`s-maxage=60`**：CDN 在 60 秒内直接返回缓存，不回源
- **`stale-while-revalidate=300`**：60–360 秒间，CDN 返回旧缓存 + 后台异步刷新
- Vercel CDN 消费 `s-maxage` 后会从浏览器可见的 `Cache-Control` 中移除该字段（正常行为）
- 验证缓存是否生效应看 `x-vercel-cache` 响应头，而非 `Cache-Control` 值

---

## 4. 新增路由的缓存配置指引

1. **判断数据性质**：公开（所有用户相同）→ `public, s-maxage=N`；私有（用户相关）→ `private, no-store`
2. **判断变动频率**：实时（秒级）→ `s-maxage=10`；准实时（分钟级）→ `s-maxage=60`；静态（小时级）→ `s-maxage=3600`
3. **设 `stale-while-revalidate`**：一般为 `s-maxage` 的 3–5 倍，平衡新鲜度与回源压力
4. **只缓存 200**：错误响应不设 Cache-Control
5. **Auth header**：公开数据路由剥离 Auth；私有数据路由保留 Auth

---

## 5. 生产验证

```bash
# 1. 赛事列表 — 首次 MISS，第二次 HIT
curl -sI "https://www.oddfi.io/api/v1/detail/sports_all?league=732&page=1" \
  | grep -i x-vercel-cache

# 2. 单场详情 — s-maxage=10
curl -sI "https://www.oddfi.io/api/v1/detail/fixture/12345?type=preview" \
  | grep -i x-vercel-cache

# 3. 按日期 — 今天 s-maxage=60
curl -sI "https://www.oddfi.io/api/v1/detail/fixture_date/$(date +%Y-%m-%d)" \
  | grep -i x-vercel-cache

# 4. 账户接口 — 应始终 MISS（private, no-store）
curl -sI -H "Authorization: Bearer xxx" \
  "https://www.oddfi.io/api/account/balance" \
  | grep -i x-vercel-cache
```

| `x-vercel-cache` | 含义                       |
| ---------------- | -------------------------- |
| `HIT`            | 缓存命中，边缘节点直接返回 |
| `STALE`          | 返回旧缓存 + 后台异步刷新  |
| `MISS`           | 未命中，回源请求           |

---

## 6. 风险与回退

| 风险                                | 应对                                         |
| ----------------------------------- | -------------------------------------------- |
| 后端 V1 GET 要求 Auth 校验          | 剥离后返回 401 → 保留 Auth + `public` 指令   |
| 实时比分延迟（10s 内旧数据）        | 将 live 的 `s-maxage` 降至 5 或设 0 跳过 CDN |
| 错误被缓存（如意外对非 200 设了头） | 检查 `getCacheControl` 调用处的 status 判断  |

---

## 变更记录

| 日期       | 变更                                                                        |
| ---------- | --------------------------------------------------------------------------- |
| 2026-04-08 | V2 迁移：策略从旧 SportMonks 路由迁移到 V1/Account 路由；新增 Auth 剥离决策 |
| 2026-03-20 | 初版：SportMonks 响应瘦身 + 分层缓存                                        |
