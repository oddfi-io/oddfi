# OddFi Admin Backend HTTP API

> 唯一接口契约。前后端 / AI 协作时**以本文件为准**，handler 注释和测试用例视为辅助。
> 每次 handler 或路由改动后，必须在同一 PR 更新本文件（参见 §7 变更协议）。

---

## 1. Quick Reference

| 项 | 值 |
|---|---|
| Base URL（本地） | `http://localhost:8081`（开发；前端走 vite proxy 转发 `/auth` `/admin`） |
| Base URL（生产） | `https://admin.oddfi.io`（Nginx 反代到内网 `:8081`） |
| 鉴权方式 | `Authorization: Bearer <JWT>`（HS256），登录入口走 Lark OAuth |
| Content-Type | 请求/响应统一 `application/json; charset=utf-8` |
| 字符集 | UTF-8 |
| 时区 | DB 存 UTC；API 输出 RFC 3339（带时区偏移） |
| 金额类型 | `string`（`decimal.Decimal` 序列化），**禁止** `float64` |
| ID 类型 | `string`（含 `lark_user_id` 形如 `ou_xxxxxxxxxxxx`） |

### 1.1 全局响应包装

**所有响应** 都遵守 `ApiResponse` 结构：

```jsonc
{
  "code": 0 | "ERROR_CODE_STRING",
  "message": "ok" | "<human readable>",
  "data": <T> | null
}
```

- `code` = `0`（数字 0）→ 成功；`code` = 大写 SNAKE_CASE 字符串 → 业务/系统错误
- HTTP 状态码与 `code` 字段配合：成功 `200`，参数错 `400`，未授权 `401`，权限不足 `403`，未找到 `404`，限流 `429`，上游故障 `502`，服务关闭中 `503`，未分类异常 `500`
- 失败响应的 `data` 永远为 `null`
- 前端 / AI 客户端**按 `code` 字段字符串分支**（不要按 HTTP 码），便于跨业务码统一处理

### 1.2 通用错误码

| code | HTTP | 含义 |
|---|---|---|
| `0`（int） | 200 | 成功 |
| `INVALID_PARAM` | 400 | 参数缺失 / 格式错 / 角色枚举非法 |
| `UNAUTHORIZED` | 401 | 缺 Bearer / token 无法解析 / session 已被吊销 |
| `TOKEN_EXPIRED` | 401 | JWT exp 已过 |
| `TOKEN_INVALID` | 401 | 签名错 / 算法非 HS256 / 篡改 |
| `INSUFFICIENT_ROLE` | 403 | 鉴权通过但角色不在路由 allow 列表 |
| `RATE_LIMITED` | 429 | 命中限流桶（默认 60/min/IP；`/auth/lark/*` 10/min/IP） |
| `INTERNAL_ERROR` | 500 | 服务端未分类异常 |

### 1.3 Lark OAuth 专属错误码

| code | HTTP | 触发场景 |
|---|---|---|
| `LARK_STATE_MISMATCH` | 400 | 回调 state 未在 Redis 命中 / 被 replay / TTL 过 |
| `LARK_EXCHANGE_FAILED` | 502 | Lark token 端点返回非 200 或 `access_token` 为空 |
| `LARK_USER_INFO_FAILED` | 502 | Lark user_info 端点失败或缺 `open_id` |
| `NOT_ADMIN` | 403 | Lark 用户授权成功但不在 `admin_users` 白名单 |

### 1.4 admin_users CRUD 业务错误码

| code | HTTP | 触发场景 |
|---|---|---|
| `ADMIN_USER_EXISTS` | 400 | Create 时 `lark_user_id` 已存在 |
| `ADMIN_USER_NOT_FOUND` | 404 | UpdateRole / Delete 目标不存在 |
| `LAST_SUPER_ADMIN` | 400 | Delete / UpdateRole 触发"最后一个 super_admin"保护 |
| `CANNOT_REMOVE_SELF` | 400 | 当前管理员尝试删除自己 |

### 1.4.1 预售 KOL 特殊返佣错误码（REQ-004）

| code | HTTP | 触发场景 |
|---|---|---|
| `KOL_NOT_FOUND` | 404 | PATCH / DELETE 指定 EOA 在 `presale_kol_referral_pct` 无记录 |
| `KOL_REFERRAL_PCT_INVALID` | 400 | `referralPct` 非合法 decimal / 超出 `[0, 100]` 范围 |

### 1.4.2 赛事风险信号灯错误码（DD002）

| code | HTTP | 触发场景 |
|---|---|---|
| `EVENT_NOT_FOUND` | 404 | 指定 `event_id` 不存在（web-api 透传） |
| `EVENT_NOT_RED_SIGNAL` | 200* | risk-decision 目标事件当前非红灯——仅红灯允许人工决策（web-api 业务错误壳透传） |
| `RISK_DECISION_CONFLICT` | 200* | 同一事件同一轮风险已有决策记录（`admin_risk_decisions` 唯一约束，web-api 业务错误壳透传） |
| `UPSTREAM_UNAVAILABLE` | 503 | web-api internal 不可达 / 5xx；前端约定 badge 保持上次值不弹错 |

> *web-api 业务错误为 HTTP 200 + code 非 0 字符串壳，admin-backend 原样透传；具体以 §3.12（T05 定稿）为准。

### 1.5 角色枚举

| 值 | 说明 |
|---|---|
| `super_admin` | 全部权限，包括 admin_users CRUD |
| `operator` | 用户管理、结算操作、用户封禁 |
| `customer_service` | 用户查询、客服工单 |
| `finance` | 出金审核、财务报表 |

> **重要**：`super_admin` **不会**自动通过其他角色路由。访问任何受 `RoleRequired(...)` 保护的路由时，当前 role 必须显式在 allow 列表里。这是为了防止"忘了把 super_admin 加进去"导致越权。

### 1.6 路由总览 / RBAC 矩阵

| 方法 + 路径 | 鉴权 | 允许角色 | 限流桶 |
|---|---|---|---|
| `GET /health` | 无 | 任何人 | default 60/min/IP |
| `GET /auth/lark/login` | 无 | 任何人 | `lark_auth` 10/min/IP |
| `GET /auth/lark/callback` | 无 | 任何人 | `lark_auth` 10/min/IP |
| `GET /auth/me` | Bearer | 任何已登录角色 | default |
| `POST /auth/logout` | Bearer | 任何已登录角色 | default |
| `GET /admin/admin-users` | Bearer | `super_admin` | default |
| `POST /admin/admin-users` | Bearer | `super_admin` | default |
| `PATCH /admin/admin-users/:lark_user_id/role` | Bearer | `super_admin` | default |
| `DELETE /admin/admin-users/:lark_user_id` | Bearer | `super_admin` | default |
| `GET /admin/presale/rounds` | Bearer | `customer_service`+ | default |
| `GET /admin/presale/rounds/:id` | Bearer | `customer_service`+ | default |
| `PATCH /admin/presale/rounds/:id` | Bearer | `super_admin` | `presale_sensitive` 10/min |
| `POST /admin/presale/rounds/:id/pause` | Bearer | `operator`+ | default |
| `POST /admin/presale/rounds/:id/resume` | Bearer | `operator`+ | default |
| `POST /admin/presale/rounds/:id/reopen` | Bearer | `operator`+ | default |
| `POST /admin/presale/rounds/:id/close` | Bearer | `operator`+ | default |
| `PATCH /admin/presale/rounds/:id/referral-pct` | Bearer | `operator`+ | default |
| `GET /admin/presale/config` | Bearer | `customer_service`+ | default |
| `PATCH /admin/presale/config` | Bearer | `super_admin` | `presale_sensitive` 10/min |
| `GET /admin/presale/deposits` | Bearer | `customer_service`+ | default |
| `GET /admin/presale/deposits/:txHash` | Bearer | `customer_service`+ | default |
| `POST /admin/presale/deposits/:txHash/migrate-round` | Bearer | `operator`+ | `presale_sensitive` 10/min |
| `GET /admin/presale/anomaly` | Bearer | `customer_service`+ | default |
| `GET /admin/presale/anomaly/:id` | Bearer | `customer_service`+ | default |
| `POST /admin/presale/anomaly/:id/resolve` | Bearer | `customer_service`+ | default |
| `GET /admin/presale/audit` | Bearer | `customer_service`+ | default |
| `GET /admin/presale/kol-referral` | Bearer | 全部已登录角色 | default |
| `POST /admin/presale/kol-referral` | Bearer | `super_admin` | default |
| `PATCH /admin/presale/kol-referral/:eoa` | Bearer | `super_admin` | default |
| `DELETE /admin/presale/kol-referral/:eoa` | Bearer | `super_admin` | default |
| `GET /admin/events/risk/summary` | Bearer | 全部已登录角色 | default |
| `GET /admin/events/risk/list` | Bearer | 全部已登录角色 | default |
| `GET /admin/events/:event_id` | Bearer | 全部已登录角色 | default |
| `GET /admin/events/:event_id/adjust-history` | Bearer | 全部已登录角色 | default |
| `POST /admin/events/:event_id/risk-decision` | Bearer | `operator`+ | `events_sensitive` 10/min |
| `GET /admin/approval/counts` | Bearer | 全部已登录角色 | default |

> `customer_service`+ = `customer_service / operator / super_admin`；`operator`+ = `operator / super_admin`。`finance` 本期无预售权限（KOL 查询除外：`GET /admin/presale/kol-referral` 四角色全可访问）。
> 全部 presale mutate 接口（POST/PATCH）经 `PresaleAudit` 中间件自动落 `presale_admin_audit` 表，要求请求体 `note` ≥ 10 字符。

---

## 2. JWT 契约

后端签发的 admin JWT 用 **HS256**，secret 来自 `jwt.secret` 配置（≥32 字符强随机）。

### 2.1 Claims

| 字段 | 类型 | 含义 |
|---|---|---|
| `sub` | string | `lark_user_id`（open_id，主键） |
| `role` | string | 4 角色之一 |
| `name` | string | Lark 显示名 |
| `email` | string | Lark 邮箱（可能为空） |
| `avatar` | string | Lark 头像 URL（可能为空） |
| `jti` | string | UUID v4，用于登出黑名单 |
| `iss` | string | 固定 `oddfi-admin` |
| `iat` | int | 签发时间（Unix 秒） |
| `exp` | int | 过期时间（默认 `iat + 8h`） |

### 2.2 交付契约（关键）

后端 `/auth/lark/callback` 成功后 302 到 `frontend.callback_url`，token 写在 **URL fragment** 而非 query：

```
Location: https://admin.oddfi.io/#token=eyJhbGciOi...
```

**理由（C-Sec-1 缓解）**：fragment 不会被浏览器塞进 Referer / Nginx access_log / 浏览器历史 URL，二次泄漏面比 query 小一个量级。

**前端约定**：

1. SPA 入口读 `window.location.hash` → 解析 `token=...` → 写 localStorage
2. **立刻** `history.replaceState(null, '', location.pathname)` 抹掉 hash，避免用户分享 URL 时附带 JWT
3. 后续 API 调用统一 `Authorization: Bearer <token>` header

### 2.3 黑名单

`/auth/logout` 写 Redis key `admin_jwt_blacklist:{jti}`，TTL 至原 `exp`。`AdminAuthMiddleware` 每次请求都 `EXISTS` 校验，命中即 401。

**Redis 故障时 fail-closed**：黑名单检查失败也拒绝请求（安全 > 可用性）。

---

## 3. Endpoints

### 3.1 `GET /health`

健康检查。无鉴权，无副作用。

**响应**：

```http
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{ "code": 0, "message": "ok", "data": { "status": "ok" } }
```

**curl**：

```bash
curl http://localhost:8081/health
```

---

### 3.2 `GET /auth/lark/login`

启动 OAuth 流程。生成 32 字节随机 state 写 Redis（TTL 10min），302 重定向到 Lark 授权页。

**鉴权**：无

**Query Parameters**：无

**响应**：HTTP 302

```http
HTTP/1.1 302 Found
Location: https://open.larksuite.com/open-apis/authen/v1/authorize?app_id=cli_xxx&redirect_uri=...&scope=contact:user.base:readonly&state=<32B base64url>
```

**错误**：

| 触发条件 | code | HTTP |
|---|---|---|
| Redis 写入失败 | `INTERNAL_ERROR` | 500 |
| 命中 `lark_auth` 限流（10/min/IP） | `RATE_LIMITED` | 429 |

**curl**：

```bash
curl -i http://localhost:8081/auth/lark/login
```

---

### 3.3 `GET /auth/lark/callback`

OAuth 回调端点。Lark 重定向到此。校验 state → 换 token → 拉 user_info → 白名单匹配 → 签 JWT → 302 到前端。

**鉴权**：无（state 自身就是 CSRF token）

**Query Parameters**：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `code` | string | 是 | Lark 授权码（一次性） |
| `state` | string | 是 | 必须命中 `lark_oauth_state:{state}` Redis key |

**成功响应**：HTTP 302

```http
HTTP/1.1 302 Found
Location: https://admin.oddfi.io/#token=eyJhbGciOiJIUzI1NiJ9....
```

JWT 在 URL fragment（见 §2.2）。

**错误**：

| 触发条件 | code | HTTP |
|---|---|---|
| `code` 或 `state` 缺失 | `INVALID_PARAM` | 400 |
| state 未命中 / replay / 过期 | `LARK_STATE_MISMATCH` | 400 |
| Lark token 端点失败 / `access_token` 空 | `LARK_EXCHANGE_FAILED` | 502 |
| Lark user_info 端点失败 / 缺 `open_id` | `LARK_USER_INFO_FAILED` | 502 |
| Lark 用户不在 `admin_users` 白名单 | `NOT_ADMIN` | 403 |
| 客户端断开 / context 超时 | `INTERNAL_ERROR` | 503 |

**curl**（仅用于异常路径测试 —— 正常流程必须由浏览器从 Lark 跳过来）：

```bash
curl -i "http://localhost:8081/auth/lark/callback?code=fake&state=fake"
# → 400 LARK_STATE_MISMATCH
```

---

### 3.4 `GET /auth/me`

返回当前登录管理员的身份信息。

**鉴权**：必填 Bearer
**允许角色**：任何已登录角色（无 `RoleRequired`）

**成功响应**：HTTP 200

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "user_id": "ou_12d3776bcf5f20c5289d3cd0767aade1",
    "name": "Hank",
    "email": "",
    "avatar": "",
    "role": "super_admin"
  }
}
```

**错误**：

| 触发条件 | code | HTTP |
|---|---|---|
| 缺 Bearer | `UNAUTHORIZED` | 401 |
| JWT 签名错 / 算法非 HS256 / 篡改 | `TOKEN_INVALID` | 401 |
| JWT 已过期 | `TOKEN_EXPIRED` | 401 |
| 已登出（jti 在黑名单） | `UNAUTHORIZED` ("session revoked") | 401 |
| JWT 合法但 admin_users 已被删除 | `UNAUTHORIZED` ("admin not found") | 401 |

**curl**：

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:8081/auth/me
```

---

### 3.5 `POST /auth/logout`

写入 jti 黑名单，使当前 JWT 立即失效（不影响其他 session）。

**鉴权**：必填 Bearer
**允许角色**：任何已登录角色

**Request Body**：无

**成功响应**：HTTP 200

```json
{ "code": 0, "message": "ok", "data": { "revoked": true } }
```

**错误**：

| 触发条件 | code | HTTP |
|---|---|---|
| 缺 Bearer / token 不合法 | `UNAUTHORIZED` / `TOKEN_INVALID` | 401 |
| Redis 写黑名单失败 | `INTERNAL_ERROR` | 500 |

**curl**：

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:8081/auth/logout
```

---

### 3.6 `GET /admin/admin-users`

列出所有运营管理员。

**鉴权**：必填 Bearer
**允许角色**：`super_admin`

**Query Parameters**：

| 参数 | 类型 | 默认 | 上限 | 说明 |
|---|---|---|---|---|
| `page` | int | `1` | — | 1-based 页号 |
| `page_size` | int | `20` | `100` | 单页条数；>100 截断为 100，≤0 重置为 20 |
| `role` | string | — | — | 可选，按角色精确过滤 |
| `q` | string | — | — | 可选，模糊匹配 `lark_name` / `lark_email` |

**成功响应**：HTTP 200

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "user_id": "ou_12d3776bcf5f20c5289d3cd0767aade1",
        "name": "Hank",
        "email": "",
        "avatar": "",
        "role": "super_admin",
        "created_by": "BOOTSTRAP",
        "created_at": "2026-05-18T06:09:41+10:00",
        "updated_at": "2026-05-18T06:09:41+10:00"
      }
    ],
    "total": 1,
    "page": 1,
    "page_size": 20
  }
}
```

> `page` / `page_size` 字段返回的是**服务端实际生效**的值，前端可据此校验入参。

**错误**：

| 触发条件 | code | HTTP |
|---|---|---|
| 标准鉴权错误 | `UNAUTHORIZED` / `TOKEN_*` | 401 |
| 当前角色非 `super_admin` | `INSUFFICIENT_ROLE` | 403 |
| DB 故障 | `INTERNAL_ERROR` | 500 |

**curl**：

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8081/admin/admin-users?page=1&page_size=20&role=operator&q=zhang"
```

---

### 3.7 `POST /admin/admin-users`

新增运营管理员（白名单准入）。

**鉴权**：必填 Bearer
**允许角色**：`super_admin`

**Request Body**：

```json
{
  "lark_user_id": "ou_xxxxxxxxxxxx",
  "lark_name": "张三",
  "lark_email": "zhangsan@oddfi.io",
  "lark_avatar": "https://...",
  "role": "operator"
}
```

| 字段 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `lark_user_id` | string | 是 | Lark `open_id`，主键 |
| `lark_name` | string | 是 | 显示名 |
| `lark_email` | string | 否 | 可空 |
| `lark_avatar` | string | 否 | 可空 |
| `role` | string | 是 | 必须是 4 个有效角色之一 |

**成功响应**：HTTP 200

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "user_id": "ou_xxxxxxxxxxxx",
    "name": "张三",
    "email": "zhangsan@oddfi.io",
    "avatar": "https://...",
    "role": "operator",
    "created_by": "ou_12d3776bcf5f20c5289d3cd0767aade1",
    "created_at": "2026-05-18T06:30:00+10:00",
    "updated_at": "2026-05-18T06:30:00+10:00"
  }
}
```

> `created_by` 自动填为当前调用方的 `lark_user_id`，**不接受**请求体覆盖。

**错误**：

| 触发条件 | code | HTTP |
|---|---|---|
| 必填字段缺失 / JSON 不合法 | `INVALID_PARAM` | 400 |
| `role` 不在枚举内 | `INVALID_PARAM` | 400 |
| `lark_user_id` 已存在 | `ADMIN_USER_EXISTS` | 400 |
| 标准鉴权错误 | `UNAUTHORIZED` / `TOKEN_*` | 401 |
| 角色不是 `super_admin` | `INSUFFICIENT_ROLE` | 403 |

**curl**：

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "lark_user_id": "ou_xxxxxxxxxxxx",
    "lark_name": "张三",
    "lark_email": "zhangsan@oddfi.io",
    "role": "operator"
  }' \
  http://localhost:8081/admin/admin-users
```

---

### 3.8 `PATCH /admin/admin-users/:lark_user_id/role`

变更指定管理员的角色。

**鉴权**：必填 Bearer
**允许角色**：`super_admin`

**Path Parameters**：

| 参数 | 类型 | 说明 |
|---|---|---|
| `lark_user_id` | string | 目标管理员 ID |

**Request Body**：

```json
{ "role": "finance" }
```

**安全规则**：

- **自降保护**：当前调用方不允许把自己降级为非 `super_admin`（避免连环死锁）
- **最后一个 super_admin 保护**：repository 在事务内拒绝最后一个 `super_admin` 被降级

**成功响应**：HTTP 200

```json
{ "code": 0, "message": "ok", "data": { "updated": true } }
```

**错误**：

| 触发条件 | code | HTTP |
|---|---|---|
| Body / role 不合法 | `INVALID_PARAM` | 400 |
| 自己降级自己为非 super_admin | `INVALID_PARAM` ("cannot demote yourself") | 400 |
| 降级最后一个 super_admin | `LAST_SUPER_ADMIN` | 400 |
| 目标不存在 | `ADMIN_USER_NOT_FOUND` | 404 |
| 标准鉴权 / RBAC 错误 | `UNAUTHORIZED` / `INSUFFICIENT_ROLE` | 401 / 403 |

**curl**：

```bash
curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"finance"}' \
  http://localhost:8081/admin/admin-users/ou_xxxxxxxxxxxx/role
```

---

### 3.9 `DELETE /admin/admin-users/:lark_user_id`

移除运营管理员。

**鉴权**：必填 Bearer
**允许角色**：`super_admin`

**Path Parameters**：

| 参数 | 类型 | 说明 |
|---|---|---|
| `lark_user_id` | string | 目标管理员 ID |

**安全规则**：

- **自删保护**：当前调用方不允许删除自己（handler 层拦）
- **最后一个 super_admin 保护**：repository 事务内拦（防 race condition）

**成功响应**：HTTP 200

```json
{ "code": 0, "message": "ok", "data": { "deleted": true } }
```

**错误**：

| 触发条件 | code | HTTP |
|---|---|---|
| 目标 ID 等于当前 ID | `CANNOT_REMOVE_SELF` | 400 |
| 删除最后一个 super_admin | `LAST_SUPER_ADMIN` | 400 |
| 目标不存在 | `ADMIN_USER_NOT_FOUND` | 404 |
| 标准鉴权 / RBAC 错误 | `UNAUTHORIZED` / `INSUFFICIENT_ROLE` | 401 / 403 |

**curl**：

```bash
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://localhost:8081/admin/admin-users/ou_xxxxxxxxxxxx
```

---

### 3.10 Presale 预售管理接口（DD-INVEST V3）

预售运营后台共 17 个接口，**完整请求/响应/错误码契约见** [`docs/presale-admin/README.md`](presale-admin/README.md)（上游 DD 源真值：`oddfi-backend/web-api/docs/dd-invest/03-admin-api-contract.md`）。

| 分类 | 接口 |
|---|---|
| 轮次查询 | `GET /admin/presale/rounds` · `GET /admin/presale/rounds/:id` |
| 轮次状态机 | `POST /admin/presale/rounds/:id/{pause,resume,reopen,close}` |
| 轮次字段调整 | `PATCH /admin/presale/rounds/:id`（super_admin） · `PATCH /admin/presale/rounds/:id/referral-pct`（operator+） |
| 全局配置 | `GET /admin/presale/config` · `PATCH /admin/presale/config`（super_admin） |
| 入账记录 | `GET /admin/presale/deposits` · `GET /admin/presale/deposits/:txHash` · `POST /admin/presale/deposits/:txHash/migrate-round` |
| 异常事件 | `GET /admin/presale/anomaly` · `GET /admin/presale/anomaly/:id` · `POST /admin/presale/anomaly/:id/resolve` |
| 操作审计 | `GET /admin/presale/audit` |
| KOL 特殊返佣 | `GET /admin/presale/kol-referral`（全角色读） · `POST/PATCH/DELETE /admin/presale/kol-referral[/:eoa]`（super_admin 写） |

**关键约束**：

- 所有 mutate（POST/PATCH）接口请求体必须含 `note` 字段（按 rune 计算 ≥ 10 字符），缺失返 `400 NOTE_REQUIRED`
- `PresaleAudit` 中间件在 handler 同事务内自动写 `presale_admin_audit`；handler 失败回滚后 audit 不写入
- 状态机非法转换返 `409 INVALID_STATE_TRANSITION`
- `migrate-round` 校验 `block_timestamp ∈ [target.start_ts - tolerance, target.end_ts + tolerance]`，越界返 `422 BLOCK_TIMESTAMP_OUT_OF_RANGE`；同 txHash 反复迁移历史 ≥ 3 次返 `422 MIGRATE_LIMIT_EXCEEDED`；目标轮次不存在返 `404 TARGET_ROUND_NOT_FOUND`
- `PATCH /config` 改 `vault_address` 时响应含 `warning` 字段提示运营同步 env 并重启 `presale-worker`
- 高敏接口（`PATCH /config` · `PATCH /rounds/:id` · `migrate-round`）走 `presale_sensitive` 限流桶 10/min/IP

---

### 3.11 KOL 特殊返佣（REQ-004）

为单个 KOL EOA 地址配置独立返佣比例，deposit 确认时优先使用该值覆盖轮次全局 `referral_reward_pct`。

#### `GET /admin/presale/kol-referral`

**鉴权**：Bearer · 允许角色：全部已登录角色

**Query Parameters**：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `eoa` | string | 否 | EOA 地址模糊搜索 |
| `page` | int | 否 | 默认 1 |
| `size` | int | 否 | 默认 20，上限 100 |

**成功响应**：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "referrerEoa": "0xabc123...",
        "referralPct": "8.0000",
        "note": "KOL A 独家协议",
        "createdBy": "ou_lark_user_id",
        "createdAt": 1748390400000,
        "updatedAt": 1748390400000
      }
    ],
    "total": 5
  }
}
```

**curl**：

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8081/admin/presale/kol-referral?page=1&size=20"
```

---

#### `POST /admin/presale/kol-referral`

**鉴权**：Bearer · 允许角色：`super_admin`

**幂等**：同一 `referrerEoa` 重复提交覆盖更新，不报错。

**请求体**：

```json
{
  "referrerEoa": "0xabc123...",
  "referralPct": "8.00",
  "note": "KOL A 独家协议（10字以上）"
}
```

| 字段 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `referrerEoa` | string | 是 | `^0x[0-9a-fA-F]{40}$`，写入前小写标准化 |
| `referralPct` | string | 是 | decimal，范围 `[0, 100]`，≤ 4 位小数 |
| `note` | string | 是 | ≥ 10 字符 |

**成功响应**：

```json
{ "code": 0, "message": "ok", "data": { "kol": { ...KolReferralItem } } }
```

**错误响应**：

| code | HTTP | 触发场景 |
|---|---|---|
| `INVALID_PARAM` | 400 | EOA 格式错 / referralPct 非法 |
| `KOL_REFERRAL_PCT_INVALID` | 400 | referralPct 超出 [0, 100] |
| `NOTE_REQUIRED` | 400 | note 缺失或 < 10 字符 |

---

#### `PATCH /admin/presale/kol-referral/:eoa`

**鉴权**：Bearer · 允许角色：`super_admin`

**Path Parameters**：`:eoa` — URL encoded EOA 地址

**请求体**：

```json
{ "referralPct": "10.00", "note": "谈判后调整返佣比例" }
```

**成功响应**：

```json
{ "code": 0, "message": "ok", "data": { "kol": { ...KolReferralItem } } }
```

**错误响应**：

| code | HTTP |
|---|---|
| `KOL_NOT_FOUND` | 404 |
| `KOL_REFERRAL_PCT_INVALID` | 400 |
| `NOTE_REQUIRED` | 400 |

---

#### `DELETE /admin/presale/kol-referral/:eoa`

**鉴权**：Bearer · 允许角色：`super_admin`

删除后该 KOL 回归轮次全局返佣比例，**已有 deposit 历史记录不受影响**（比例已快照）。

**成功响应**：

```json
{ "code": 0, "message": "ok", "data": { "referrerEoa": "0xabc123..." } }
```

**错误响应**：`KOL_NOT_FOUND` 404

**curl**：

```bash
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"note":"KOL协议终止，回归全局比例"}' \
  "http://localhost:8081/admin/presale/kol-referral/0xabc123..."
```

---

### 3.12 赛事风险与信号灯（DD002）

> 方案：`docs/dd002-risk-signal/DD.md`。admin-backend 为纯 proxy（RBAC + 限流 + 透传），
> 判级唯一实现点在 web-api internal。联调 A 阶段可用 `go run ./cmd/mock-webapi`（:9090）替代真上游。
> ID 一律字符串序列化（`,string`）；`signal` 枚举 `green / yellow / orange / red`。
> 联调 curl 契约集（每端点成功 + 各错误码触发，已实跑验证）：`docs/risk-signal-curl.md`。

#### `GET /admin/events/risk/summary`

**鉴权**：Bearer · 允许角色：`operator / finance / customer_service / super_admin`

四色计数（**不含未开盘事件**）+ 全局最大单场敞口 + 状态分布。

```json
{
  "code": 0, "message": "ok",
  "data": {
    "total_bet_amount": "336910.00",
    "total_events": 8,
    "active_count": 5, "pending_count": 2, "settled_count": 1,
    "on_sale_event_count": 5, "on_sale_market_count": 9,
    "green_count": 3, "yellow_count": 1, "orange_count": 2, "red_count": 1,
    "red_pending_count": 1,
    "max_event_exposure": "21300.00",
    "max_exposure_event_id": "3",
    "max_exposure_event_name": "Nadal vs Federer"
  }
}
```

⚠️ **`max_event_exposure` 双义注释**：此处为「全局最大单场展示敞口（adjMaxL）」；与列表行内 `max_exposure`（该场 adjMaxL）同词根不同义，且**均不是判级源**——判级用方向级 maxL，红灯事件的 adjMaxL 可能反而小于橙灯事件（见 DD §3.1）。

`red_pending_count` = 链上 red 且本轮未决策的事件数（D4：审批队列只收 red），即铃铛 badge 来源。

**ENH-008 增量（2026-06-12）**：

- summary/list 新增查询参数 `include_test` / `include_archived`（bool，默认 false；web-api `ParseBool` 严格解析，非法值 400 `INVALID_PARAM`；前端约定 **false→省略不传**、true→传 `"true"`，禁止 `"false"` 字面量）。默认响应 = **过滤后宇宙**：排除测试体验盘合成赛事（fixture_id 区间识别）与「已结算且开赛超 `admin_risk.archive_days`（默认 7 天）」的归档赛事。⚠️ 属有意行为变更：`total_events` 从 ~1374 量级降到 ~82，`settled_count` / `leagues` / 四色计数 / `red_pending_count`（badge 不再被测试盘红灯污染）/ `total_bet_amount` 同步收敛——非 bug，勿回报。
- summary 新增 `on_sale_event_count`（在售可下注赛事数）/ `on_sale_market_count`（在售盘数）：在售 = market `OPENED/UPDATED` 且未到 `lock_at`，与 `active_count`（比赛进行中 live）是**不同维度**，杜绝再把 live=0 误读成"没开盘"。
- list 行新增 `is_test`（bool）：测试体验盘标记，仅 `include_test=true` 时才会出现 true 行（前端打「测试」Tag）。
- detail / adjust-history / risk-decision 按 ID 直查**不过滤**，QA 直达测试盘流程不受影响。
- admin-backend **零代码改动**（RawQuery + RawMessage 透传自动覆盖）；真源契约：oddfi-backend `web-api/docs/enh-008-admin-events-display-hygiene/ENH.md` §5。

#### `GET /admin/events/risk/list`

**鉴权**：同 summary。

| Query | 类型 | 默认 | 说明 |
|---|---|---|---|
| `status` | string | `all` | `all / active / pending / settled` |
| `signal` | string | `all` | **逗号分隔多值单 key**：`?signal=red,orange`（admin-backend RawQuery 原样透传，web-api 按逗号 split） |
| `sort_by` | string | — | `bet / exposure / time` |
| `sort_order` | string | desc | `asc / desc` |
| `pending_decision` | bool | — | `true` 时仅返回待决策红灯事件（审批队列查询用；web-api 侧过滤） |
| `include_test` | bool | false | ENH-008：`true` 包含测试体验盘（非法值 400） |
| `include_archived` | bool | false | ENH-008：`true` 包含归档赛事（已结算且开赛超 7 天；非法值 400） |
| `page` / `page_size` | int | 1 / 20 | page_size 上限 100 |

```json
{
  "code": 0, "message": "ok",
  "data": {
    "list": [
      {
        "event_id": "5", "sport": "足球", "league": "英超",
        "event_name": "Arsenal vs Chelsea",
        "status": "active", "opened": true, "score": null,
        "times": {"open": "2026-06-05T18:00:00Z", "lock": "2026-06-07T02:00:00Z", "kickoff": "2026-06-07T02:30:00Z", "settle": null},
        "lp_pool_amount": null,
        "bet_amount_total": "73955.00",
        "max_exposure": "19246.00",
        "settle_pl": null,
        "signal": "red",
        "market_count": 2, "direction_count": 5,
        "yield_ratio": null,
        "pending_decision": true,
        "decision": {"action": "approve_continue", "decided_by": "lark:ou_xx", "decided_at": "2026-06-04T09:12:00Z", "remark": "..."}
      }
    ],
    "total": 8, "page": 1, "page_size": 20
  }
}
```

字段要点：

- `signal` 为**展示信号**：链上 red 且本轮已决策 → 降级 `orange` 并带 `decision` 对象（「已人工处理」）；链上重升（决策后 quote_version 更新）→ `pending_decision` 重新 `true`（决策态状态机，DD §3.3）
- `opened=false`（未开盘）：`signal / bet_amount_total / max_exposure / yield_ratio` 全 `null`，不计入 summary 四色计数
- **null 组字段**（待 OPS-01d 点亮，真上游当前恒 `null`，前端显示「—」）：`lp_pool_amount` / `yield_ratio` / `score` / `settle_pl` / `times.settle`。mock 上游对已结算夹具预先点亮 score/settle_pl/settle 供前端先行开发
- `score` 仅 settled 非空：`{"home": 2, "away": 1}`
- `sport` 本期**恒「足球」**（数据源 SportMonks 足球单运动，常量占位；多运动接入后由 `oddfi_leagues.sport_id` 映射——C 端 RESULT §4-4 口径）。前端勿按 sport 做分组/图标分支
- 第三方赔率（detail 端点 `third_party_*`）本期**仅 1X2 玩法**回填，让球/大小恒 `null`（盘口线与链上 Line 编码无对齐证据，防误导运营——C 端 RESULT §4-3 口径）

#### `GET /admin/events/:event_id`

**鉴权**：同 summary。`event_id` 必须纯数字，否则 400 `INVALID_PARAM`（不打上游）。

赛事明细 = 列表行全部字段 + `markets[] → directions[]`：

```json
{
  "code": 0, "message": "ok",
  "data": {
    "event_id": "5", "...": "（列表行字段省略）",
    "markets": [
      {
        "market_id": "501", "market_name": "胜负",
        "settle": null,
        "directions": [
          {
            "direction_id": "50101",
            "direction_name": "Djokovic 胜",
            "bet_amount": "45000.00",
            "original_odds": 1.75,
            "third_party_odds": 1.80, "third_party_source": "Bet365",
            "odds_diff": 0.09,
            "adjusted_odds": 1.71,
            "original_exposure": "31200.00", "adjusted_exposure": "29100.00",
            "adjust_ratio": -0.07,
            "signal": "red",
            "adjust_history_count": 3
          }
        ]
      }
    ]
  }
}
```

- `market.settle` 仅已结算非空：`{"winners": ["拜仁胜"], "payout": "21400.00", "platform_pl": "3200.00"}`（正=平台盈利）
- 已结算方向 `direction_name` 带胜负态标注（`✓ 胜出 / 未中 / 走盘`）
- `adjusted_*` 未调整时为 `null`；`odds_diff` = 第三方 − 当前（base=新赔率，未调整=开盘赔率）

**错误**：`EVENT_NOT_FOUND` 404

#### `GET /admin/events/:event_id/adjust-history`

**鉴权**：同 summary。Query：`market` / `direction`（按名称过滤，可选）。

```json
{
  "code": 0, "message": "ok",
  "data": {
    "list": [
      {"seq": 1, "time": "2026-06-05T22:00:00Z", "odds": 1.74, "exposure": null, "lp_ratio": null, "source": "Auto", "market_name": "胜负", "direction_name": "Djokovic 胜"}
    ],
    "total": 3
  }
}
```

- `exposure` / `lp_ratio` 属 null 组（待 OPS-01a/01d 落库后点亮）
- `source` 本期恒 `Auto`（人工调赔率通道落地后启用 `Manual`）

#### `POST /admin/events/:event_id/risk-decision`

**鉴权**：Bearer · 允许角色：`operator / super_admin`（finance / customer_service 403）

**Headers**：`X-Idempotency-Key` **必带**（前端生成 uuid，缺 → 400 `INVALID_PARAM`）

**Body**：

```json
{ "action": "approve_continue", "remark": "人工评估后恢复开盘" }
```

- `action` ∈ `approve_continue / stop`；`remark` 必填且非全空白（审批留痕），**上限 500 字符**
- `X-Idempotency-Key` 上限 128 字符（uuid 富余）；`event_id` 纯数字且 ≤ 20 位——超限均 400 `INVALID_PARAM`
- **不接受 body 传 operator**——决策人由 web-api 从透传的 `X-Admin-JWT` 解码注入（修正 PRD §5.5 安全瑕疵），body 多余字段丢弃

**成功响应**：

```json
{
  "code": 0, "message": "ok",
  "data": {
    "event_id": "5", "action": "stop",
    "decided_by": "lark:ou_xx", "decided_at": "2026-06-05T06:05:27Z",
    "effective_signal": "orange", "queue_cleared": true
  }
}
```

决策态语义（一期不触链上，停单是合约即时自治行为，人工决策仅事后记录）：决策后该事件 `pending_decision=false`、退出审批队列、badge 减一、列表行 `signal` 展示降级 `orange`；链上 signal 再次升 red 且 quote_version 晚于决策时间 → 重新入队。

**错误响应**：

| code | HTTP | 触发 |
|---|---|---|
| `INVALID_PARAM` | 400 | 缺/超长 `X-Idempotency-Key`（>128）/ `action` 非法 / `remark` 空白或超长（>500）/ `event_id` 非数字或超 20 位 |
| `EVENT_NOT_FOUND` | 404 | 事件不存在 |
| `EVENT_NOT_RED_SIGNAL` | 200（业务壳） | 目标事件链上信号非 red |
| `RISK_DECISION_CONFLICT` | 200（业务壳） | 本轮风险已有决策记录 |
| `UPSTREAM_UNAVAILABLE` | 503 | web-api internal 不可达 / 5xx |
| `INSUFFICIENT_ROLE` | 403 | finance / customer_service 调用 |

#### `GET /admin/approval/counts`

**鉴权**：Bearer · 允许角色：全部四角色。

铃铛红点聚合。`event_count` = upstream summary `red_pending_count`；`claim_count` / `withdraw_count` 本期占位 0（Claim / Withdraw 审批接入时替换为真实聚合）。

```json
{ "code": 0, "message": "ok", "data": { "event_count": 1, "claim_count": 0, "withdraw_count": 0 } }
```

**降级语义**：上游不可达 → 503 `UPSTREAM_UNAVAILABLE`，**前端 badge 保持上次值、不弹错**（30s 轮询下一次自动恢复）。

---

## 4. 全局横切

### 4.1 CORS

允许 origin 来自配置 `cors.allowed_origins`（生产 `https://admin.oddfi.io`，本地加 `http://localhost:5173`）。

- `Access-Control-Allow-Credentials: false`（JWT 走 header，不用 cookie）
- 允许方法：`GET, POST, PUT, PATCH, DELETE, OPTIONS`
- 允许头：`Authorization, Content-Type, X-Request-ID`
- `OPTIONS` 预检返回 `204 No Content`

### 4.2 安全 Headers（全局响应）

| Header | 值 |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `no-referrer` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `Cache-Control` | `no-store` |
| `X-Request-Id` | 服务端生成或透传客户端的 `X-Request-ID` |

### 4.3 限流

`golang.org/x/time/rate` 实现的 token bucket，按 (group, IP) 维度：

| Group | 适用路由 | 限制 |
|---|---|---|
| `lark_auth` | `/auth/lark/login`, `/auth/lark/callback` | 10/min/IP |
| `default` | 其余所有路由 | 60/min/IP |

超限返回 `429` + `RATE_LIMITED`。

### 4.4 Request ID

每个请求注入 `X-Request-Id`（UUID v4 或透传客户端值），写进 zerolog 字段 `request_id`，便于跨服务追踪。客户端建议主动带 `X-Request-ID` 以串联前端日志。

---

## 5. 错误响应统一示例

### 5.1 业务错误（HTTP 4xx + code 字符串）

```http
HTTP/1.1 403 Forbidden
Content-Type: application/json
```

```json
{
  "code": "INSUFFICIENT_ROLE",
  "message": "role operator not allowed",
  "data": null
}
```

### 5.2 系统错误（HTTP 5xx）

```http
HTTP/1.1 500 Internal Server Error
```

```json
{
  "code": "INTERNAL_ERROR",
  "message": "internal error",
  "data": null
}
```

> `message` 文案对用户友好但不暴露内部细节；详细错误进 zerolog 日志（含 `request_id` 字段，可关联）。

---

## 6. 客户端实现要点

### 6.1 登录流程伪代码

```
1. 浏览器 → GET /auth/lark/login                            # 后端 302
2. 浏览器 → 跟随到 Lark 授权页
3. 用户点"同意"                                              # Lark 302 回
4. 浏览器 → GET /auth/lark/callback?code=...&state=...      # 后端 302 到前端
5. 浏览器 → 前端 SPA 入口                                    # URL: <frontend>#token=<JWT>
6. SPA 解析 location.hash → 存 localStorage → history.replaceState 抹 hash
7. 后续请求 → Authorization: Bearer <JWT>
```

### 6.2 错误处理路由表

| `code` | 客户端动作 |
|---|---|
| `0` (int) | 正常处理 `data` |
| `UNAUTHORIZED` / `TOKEN_EXPIRED` / `TOKEN_INVALID` | 清 localStorage → 跳 `/auth/lark/login` |
| `INSUFFICIENT_ROLE` | 提示"无权限" + 路由守卫切回首页 |
| `RATE_LIMITED` | 退避重试 |
| `NOT_ADMIN` | 显示"未加入白名单"提示页，不重试 |
| `LARK_STATE_MISMATCH` | 提示"登录已过期，请重试"，跳回 `/auth/lark/login` |
| `LARK_EXCHANGE_FAILED` / `LARK_USER_INFO_FAILED` | 提示"Lark 服务异常"，提供"重试"按钮 |
| 其他 `INTERNAL_ERROR` | 显示通用错误页，附 `X-Request-Id`（让用户报错用） |

### 6.3 dev 工具：跳过 OAuth 直接拿 JWT

本地开发可跳过浏览器 OAuth：

```bash
# 前置：admin_users 表已有对应记录
TOKEN=$(go run ./cmd/dev-token -user ou_xxxxxxxxxxxx 2>/dev/null)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8081/auth/me
```

详见 `docs/lark-app-binding.md §10.0`。

---

## 7. 变更协议

每次改动接口需同时更新：

- [ ] 本文件对应 §3.X endpoint section
- [ ] 路由表 §1.6
- [ ] 错误码表 §1.2–§1.4（新增的话）
- [ ] 测试用例（service / handler 层）
- [ ] 前端 dataProvider 适配（`~/work/oddfi-admin-frontend/src/providers/dataProvider.ts`，若已实现）

**破坏性变更**（删字段、改字段类型、移路径）：

1. 起 DD 文档
2. PR 标题加 `BREAKING:`
3. 与前端 owner 同步评审

---

## 8. 关联文档

- `docs/lark-app-binding.md` — Lark 应用 ↔ 后端配置绑定 + Secret 轮换
- `ARCHITECTURE.md` — 启动顺序、目录结构、依赖关系
- `.claude/rules/api-conventions.md` — 后端编码规约（响应包装、错误码、JWT、分页）
- `.claude/rules/rbac.md` — RBAC 4 角色定义 + RoleRequired 中间件
- `.claude/rules/lark-oauth.md` — Lark OAuth 实现硬规则
