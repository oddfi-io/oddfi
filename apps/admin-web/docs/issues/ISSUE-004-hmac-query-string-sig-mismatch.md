# ISSUE-004 · HMAC 签名 path 含 query，web-api 验签不含 query → 带 query 的 presale 接口全 401

- **状态**：**Resolved**（2026-05-27 修复并上 prod，已真机验证）
- **严重度**：**High**（**生产也受影响**：所有分页/过滤的 presale 列表在 prod 直接 401，不可用）

## 修复结论（2026-05-27）

- **采纳方案 2（改 web-api 验签侧）**：`web-api/internal/middleware/service_auth.go` 把验签 path 重建为含 query（与 admin-backend 签名侧逐字对齐），admin-backend 零改动，query 一并纳入签名完整性保护。
- **修复 commit**：`bbbbaf5`（web-api `main`）；**prod 镜像**：`hankdong/account-web-api:prod_dd003-v5`。
- **回归测试**：web-api `service_auth_test.go` 新增 2 条（with-query happy + tampered-query rejected）。
- **真机验证（前端 proxy→prod，super_admin JWT）**：

  | 端点 | 修复前 | 现在 |
  |---|---|---|
  | `deposits?page=1&size=5` | 401 `SERVICE_SIG_INVALID` | ✅ 200 `code:0`，有真实数据 |
  | `audit?page=1&size=5` | 401 | ✅ 200 `code:0`（空态 list:[]） |
  | `anomaly?page=1&size=5` | 401 | ✅ 200 `code:0` |
  | `rounds`（无 query） | 200 | ✅ 200（不回归） |

- 交接工单（已完成使命，删除）：曾位于 `.progress/stash/ISSUE-004-webapi-sig-fix-spec.md`。
- **类型**：契约 / 鉴权（admin-backend ↔ web-api HMAC service signature）
- **发现日期**：2026-05-27（本地 proxy→prod 真机联调时复现）
- **主要仓库**：`oddfi-admin-backend` + `oddfi-backend/web-api`（两侧签名口径不一致）
- **关联**：[DD-003 §4.2.1](../../../oddfi-backend/web-api/docs/dd-invest/DD-003-admin-rpc-rework.md)

## 现象（真机复现）

带你的真实 super_admin token 经 `localhost:5173` proxy 打到生产 admin-backend：

| 接口 | 结果 |
|---|---|
| `GET /auth/me` | ✅ 200 |
| `GET /admin/presale/rounds`（无 query） | ✅ 200，真数据 |
| `GET /admin/presale/config`（无 query） | ✅ 200，真数据 |
| `GET /admin/presale/deposits?page=1&size=5` | ❌ **401 `SERVICE_SIG_INVALID`** |
| `GET /admin/presale/audit?page=1&size=5` | ❌ **401 `SERVICE_SIG_INVALID`** |
| `GET /admin/presale/anomaly?...`（同样带 query） | ❌ 同上（推断） |

规律：**无 query 的过，带 query 的全挂**。

## 根因（已逐行确认）

admin-backend 签名时把 **query string 算进了 path**，web-api 验签只用 **不含 query 的 path**：

**admin-backend（签名侧）**：
- `internal/handler/presale_deposit.go:27-29`（audit/anomaly 同构）：
  ```go
  path := "/internal/admin/presale/deposits"
  if q := c.Request.URL.RawQuery; q != "" { path += "?" + q }  // ← path 带上了 ?page=1&size=5
  h.wc.Get(ctx, path, ...)
  ```
- `internal/client/webapi.go`：`url := InternalURL + path` 且 `ComputeServiceSig(secret, ts, path, idemKey, body)` —— **签名用的 `path` 含 query**。
- 即签名 payload = `ts:/internal/admin/presale/deposits?page=1&size=5:idemKey:bodyHash`

**web-api（验签侧）**：
- `internal/middleware/service_auth.go:91`：
  ```go
  payload := tsStr + ":" + c.Request.URL.Path + ":" + idemKey + ":" + hex(bodyHash)  // ← URL.Path 不含 query
  ```
- 即验签 payload = `ts:/internal/admin/presale/deposits:idemKey:bodyHash`

→ 有 query 时两边 payload 不一致 → HMAC 不匹配 → `SERVICE_SIG_INVALID`。无 query 时恰好一致 → 通过。

## 影响

- **deposits / audit / anomaly 列表（都强制带 `page`/`size`）在生产环境直接 401 不可用**。运营后台这三块完全打不开。
- rounds（不分页）、config（无 query）、各 detail（path 参数不算 query）不受影响。
- 触发前端连带问题（已在前端缓解，见下）。

## 建议修复（二选一，后端定）

- **方案 1（推荐 · 改 admin-backend）**：签名只用**不含 query 的 path**，query 只拼进实际请求 URL。即把"签名 path"和"请求 URL"分开：`ComputeServiceSig(..., urlPathNoQuery, ...)`，URL 仍 `InternalURL + pathNoQuery + "?" + rawQuery`。与 web-api 现有 `URL.Path` 口径对齐，web-api 不用动。
- **方案 2（改 web-api）**：验签改用 `c.Request.URL.RequestURI()`（path+RawQuery）。但要求两侧 query 串字节级一致（admin-backend 是把 RawQuery 原样转发的，目前满足）。

无论哪种，**统一后必须同时覆盖 deposits/audit/anomaly + 未来任何带 query 的接口**，并补一条 contract test：带 query 的请求签名能验过。

## 验证

- [ ] `curl '.../admin/presale/deposits?page=1&size=5' -H 'Authorization: Bearer <valid>'` → 200 + 数据（prod 与本地 proxy 都验）。
- [ ] audit / anomaly 同样 200。

## 前端侧已做的缓解（不替代后端修复）

前端原来对**任何 401** 都清 token + 跳 `/login`，导致这个 `SERVICE_SIG_INVALID`(401) 把用户**误登出**（dashboard 一进就被弹回登录）。已改为**只对会话类 401**（`UNAUTHORIZED`/`TOKEN_EXPIRED`/`TOKEN_INVALID`）登出；`SERVICE_SIG_INVALID` 等基础设施类 401 只报错、不登出（`src/lib/api.ts` afterResponse）。
