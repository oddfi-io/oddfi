# DD-003 v3: admin-backend RPC 重做（合规增强 + 简化 OAuth 信任传递）

**状态**：✅ **Implemented 2026-05-26**（critic v3 STRATEGY_OK 批准 → 8 batch 实施完成）
**日期**：2026-05-26
**作者**：DD-INVEST V3 总督导
**Review 历史**：
- v1 → critic RECOMMEND_REDESIGN（4 CRITICAL）
- v2 → critic RECOMMEND_REDESIGN_AGAIN（C3 事实错位 + M3 状态机洞）
- **v3 → 待 critic 三轮 review**
**关联**：[DD-002（已废弃）](../../../../oddfi-admin-backend/.claude/worktrees/presale-admin-impl/docs/presale-admin/DD-002-admin-dual-dsn.md) · [ops/tasks.md](ops/tasks.md) · [ADR-0001](adr/ADR-0001-admin-rpc-not-shared-db.md) · [ADR-0002](adr/ADR-0002-deferred-mtls.md) · [ADR-0003](adr/ADR-0003-tx-in-context.md)
**预估工时**：40-50h（v2 基础上**减 3-4h**，因移除 Lark JWKS / /auth/me 调用 / cache）

---

## 0 v3 修订摘要（vs v2）

| Item | v2 | v3 | 来源 |
|---|---|---|---|
| **operator 鉴权** | Lark JWKS 二次验签 + 调 admin-backend /auth/me | **共享 HS256 secret 直接验 admin-backend 自签 JWT** | **C3 重写**（v2 事实错位） |
| **删除** | `internal/pkg/lark/jwks.go` + `lark_jwt_passthrough.go` | 全删 | 简化 |
| **idempotency 状态机** | 子 tx INSERT 早写占 key，外层 tx 业务 4xx 则 cache 永卡 4xx | **idempotency INSERT 移到 audit + business 同 tx**，三个写原子性 | **M3 重写** |
| **HMAC 窗口** | 5min | **60s + 让 idempotency_key 参与 HMAC 签名**（自动 nonce 绑定） | v2 次要 |
| **DDoS 隔离** | `limit_req zone` 共用 vhost | **独立 vhost `admin-api.oddfi.io`**（独立 IP 可选） | v2 半真修升级 |
| **ADR 落档时机** | "部署后补档" | **v3 落档同时写 ADR-0001/0002/0003** | v2 流程错 |
| **硬 gate** | 6/1 / 6/5 | **6/3 / 6/8**（推 2 天 buffer） | C5 |
| **前端 UUID 生命周期** | "per form session" | **form 渲染时一次性生成，提交成功/失败后立刻轮换** | v2 模糊 |
| **HMAC secret_id 字段** | c.Set 但 audit 表未列 | audit 表加 `service_secret_id` 列 | v2 漏 |

---

## 1 背景

DD-002 方案 A 被两轮 critic 判 STRATEGY_QUESTIONABLE（WAL over-engineering、明文 PII 落盘、:3306 公网暴露）。

DD-003 v1 改走 RPC 但被 critic 指出 4 CRITICAL（Nginx 单层 / DDoS 连带 / operator client-asserted / idempotency 合规冲突）。

DD-003 v2 修了 v1 的 11 项但其中：
- C3「Lark JWKS 二次验签」**基于事实错误**（admin-backend 用 HS256 自签 JWT，不是 Lark JWT），整段设计编译都跑不通
- M3 idempotency 子 tx 早提交导致业务 4xx 时 cache 永卡

DD-003 v3 修这两个核心 + critic v2 的次要项，目标是**TGE 前可上线 + 不留事实错位 + 不留状态机洞**。

---

## 2 目标架构（v3 简化）

```
                          ┌─────────────────────────┐
                          │  admin 前端 SPA          │
                          │  admin.oddfi.io          │
                          │  ↓ form 渲染生成 UUIDv4   │
                          └────────────┬────────────┘
                                       │ HTTPS
                                       │ Authorization: Bearer <admin-HS256-JWT>
                                       │ X-Idempotency-Key: <UUIDv4>
                          ┌────────────▼────────────┐
                          │  admin-backend           │
                          │  oddfi-admin EC2 :8081   │
                          │  Lark OAuth + JWT 签发    │
                          │  RBAC                    │
                          │  → HMAC sign request     │
                          │  → 透传 admin JWT + UUID │
                          └────────────┬────────────┘
                                       │ HTTPS admin-api.oddfi.io（独立 vhost）
                                       │ X-Admin-JWT: <admin-backend HS256 JWT>
                                       │ X-Idempotency-Key: <UUIDv4>
                                       │ X-Service-Sig: HMAC(secret, ts+path+body+idem_key)
                                       │ X-Timestamp: <epoch ms>
                          ┌────────────▼────────────┐
                          │  Nginx                   │
                          │  admin-api.oddfi.io vhost │
                          │  allow <SERVER_IP>;   │
                          │  deny all;                │
                          │  limit_req zone=admin    │
                          │  proxy_pass 127.0.0.1:8081 │
                          └────────────┬────────────┘
                                       │ 仅 127.0.0.1
                          ┌────────────▼────────────┐
                          │  web-api 进程            │
                          │  :8080 listener (公网)   │
                          │    ← 用户接口 /api/v1/*  │
                          │  :8081 listener (loopback)│
                          │    ← 内部 /internal/admin/*│
                          │    ServiceAuth middleware │
                          │    → HMAC 验（60s + nonce）│
                          │    AdminJWT middleware    │
                          │    → 共享 HS256 secret 验 │
                          │    → 解 claims：lark_user_id + role │
                          │    AdminAudit + Idempotency middleware │
                          │    → 三个写同一 tx       │
                          └────────────┬────────────┘
                          ┌────────────▼────────────┐
                          │  prod MySQL（本机）       │
                          │  - presale_*（业务）      │
                          │  - presale_admin_audit    │
                          │  - admin_idempotency      │
                          │  ↓ FK audit_id（同 tx 写） │
                          └─────────────────────────┘
```

**v3 关键简化（vs v2）**：
- ❌ 删除 Lark JWKS 客户端 + cache
- ❌ 删除 `/auth/me` 反向依赖
- ❌ 删除 admin_user 5min cache
- ✅ web-api 共享 `ADMIN_JWT_SECRET`，HS256 一次验签直接拿 verified operator
- ✅ idempotency / audit / business 三个写同 tx，原子性
- ✅ admin-api.oddfi.io 独立 vhost 真隔离 DDoS

---

## 3 范围

### 3.1 web-api 仓库（新增）

**新增文件**（v2 基础上 **减 2 个**：删 lark jwks + lark_jwt_passthrough）：
- `internal/handler/admin/presale_round.go`
- `internal/handler/admin/presale_deposit.go`
- `internal/handler/admin/presale_config.go`
- `internal/handler/admin/presale_anomaly.go`
- `internal/handler/admin/presale_audit.go`
- `internal/service/presale_admin_round.go`
- `internal/service/presale_admin_deposit.go`
- `internal/service/presale_admin_config.go`
- `internal/service/presale_admin_anomaly.go`
- `internal/middleware/service_auth.go` — HMAC 验签（60s 窗口 + nonce 绑定）
- `internal/middleware/admin_jwt.go` — **共享 HS256 secret 验** admin-backend JWT，解 claims 拿 operator（v3 新，替代 v2 lark_jwt_passthrough）
- `internal/middleware/admin_audit.go` — 同 tx 写 audit + idempotency
- `internal/middleware/idempotency.go` — UUID 检查 + cache response（**INSERT 移到 audit 同 tx**）
- `internal/pkg/gormtx/gormtx.go` — tx-in-context helper（M4）
- `internal/pkg/adminjwt/parser.go` — 共享 admin-backend `pkg/jwt` 解析逻辑（导出 Claims struct + Parse 函数）
- `migrations/0009_create_presale_admin_audit.sql`
- `migrations/0010_create_admin_idempotency.sql`

**修改文件**：
- `internal/router/router.go` — 拆 publicRouter / internalRouter
- `cmd/server/main.go` — 起两个 http.Server（:8080 公网 + :8081 loopback）
- `internal/repository/presale_round.go` / `presale_deposit.go` — 加 admin 操作方法
- `internal/config/config.go` — 加 `Server.InternalPort` / `WEBAPI_SERVICE_TOKENS`（多 secret）/ `ADMIN_JWT_SECRET`（共享）

### 3.2 admin-backend 仓库（删 + 改）

不变（参考 v2 §3.2）。**v3 删 17 文件 + 删 docker-compose.test.yml + 改 5 handler 薄壳化 + webapi client**。

**v3 新加**：
- `internal/config/config.go` 加 `WEBAPI_INTERNAL_URL` / `WEBAPI_SERVICE_TOKEN`（HMAC secret）
- `internal/client/webapi.go` 内 HMAC 签名 + idempotency_key 参与签名 + 透传原 JWT

### 3.3 admin 前端

每个 form 渲染时生成一次 UUIDv4，跟 form session 绑定：
- 提交成功 → 提交按钮变 disabled，UUID 不再使用（form 重置时新生成）
- 提交失败（4xx / 5xx）→ 用户改 body 重试时**生成新 UUID**（避免 body 改了 key 不变导致 409 `IDEMPOTENCY_BODY_MISMATCH`）
- 网络超时 → 同 UUID 重试（覆盖到 idempotency 缓存）

```js
const formIdempotencyKey = useRef(crypto.randomUUID());
// 提交按钮 onClick
async function onSubmit() {
  try {
    await api.pause(roundId, { note }, { idempotencyKey: formIdempotencyKey.current });
    // 成功 → form 重置 → 新 UUID
  } catch (err) {
    if (err.status >= 400 && err.status < 500) {
      // 4xx：用户改 body → 生成新 UUID
      formIdempotencyKey.current = crypto.randomUUID();
    }
    // 5xx / 超时：同 UUID 重试
  }
}
```

### 3.4 DB schema

| 操作 | 表 | DB |
|---|---|---|
| 新建 | `presale_admin_audit`（加 `service_secret_id` 列） | web-api DB |
| 新建 | `admin_idempotency` | web-api DB |
| 删除 | `presale_admin_audit`（0 行真数据已确认） | admin DB |

---

## 4 internal endpoint 安全契约（v3）

### 4.1 路径

`https://admin-api.oddfi.io/internal/admin/presale/*` — 独立 subdomain，独立 vhost，DDoS 不连坐 api.oddfi.io。

### 4.2 三层防御

#### 第一层：web-api 进程隔离（双 listener）

```go
// cmd/server/main.go
publicSrv := &http.Server{Addr: ":8080", Handler: publicRouter, ...}
internalSrv := &http.Server{Addr: "127.0.0.1:8081", Handler: internalRouter, ...}

go publicSrv.ListenAndServe()    // 公网用户接口
go internalSrv.ListenAndServe()  // 仅 loopback，物理隔离

// 优雅退出两个 srv 都 shutdown
```

router 拆分：
- `publicRouter`：现有 `/api/v1/*` + `/health` + `/admin/order/*`（legacy，暂保留，独立安全 hardening 走 ADR-0002）
- `internalRouter`：仅 `/internal/admin/*` + `/health`（health 双挂便于 LB 探活）

#### 第二层：Nginx 独立 vhost + allow/deny + 独立 zone

```nginx
# /etc/nginx/sites-enabled/admin-api.oddfi.io（新建独立 vhost）
http {
    limit_req_zone $binary_remote_addr zone=admin_internal:10m rate=10r/s;
}

server {
    server_name admin-api.oddfi.io;
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/admin-api.oddfi.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin-api.oddfi.io/privkey.pem;

    # 网络层 allow 唯一 admin IP
    allow <SERVER_IP>;
    deny all;
    error_page 403 = @forbid;

    location /internal/ {
        limit_req zone=admin_internal burst=5 nodelay;
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 10s;
    }

    location @forbid {
        return 403 '';
    }

    location / {
        return 404 '';
    }
}
```

**DNS**：`admin-api.oddfi.io` A 记录指向 `oddfi-backend` EIP `<SERVER_IP>`（与 api.oddfi.io 同一 IP，单 ENI 单 EIP）；从其他 IP 访问 → Nginx 403。

#### 第三层：应用层 HMAC + admin JWT 验签

##### 4.2.1 HMAC service signature（60s 窗口 + nonce）

admin 端：
```go
ts := strconv.FormatInt(time.Now().UnixMilli(), 10)
idemKey := req.Header.Get("X-Idempotency-Key")
bodyHash := sha256.Sum256(body)
// idem_key 参与签名 → sig 与 key 绑定，replay 自动 409
payload := ts + ":" + r.URL.Path + ":" + idemKey + ":" + hex.EncodeToString(bodyHash[:])
sig := hex.EncodeToString(hmac.New(sha256.New, []byte(serviceSecret)).Sum([]byte(payload)))

req.Header.Set("X-Timestamp", ts)
req.Header.Set("X-Service-Sig", sig)
```

web-api `service_auth.go`：
```go
ts := c.GetHeader("X-Timestamp")
sig := c.GetHeader("X-Service-Sig")
idemKey := c.GetHeader("X-Idempotency-Key")
if abs(time.Now().UnixMilli() - parseInt(ts)) > 60*1000 { abort(401, "stale timestamp") }

for _, secret := range cfg.ServiceTokens {
    expected := computeSig(ts, c.Request.URL.Path, idemKey, body, secret)
    if hmac.Equal([]byte(sig), []byte(expected)) {
        c.Set("service_secret_id", hashID(secret))   // audit 用
        c.Next()
        return
    }
}
abort(401, "invalid service-sig")
```

**关键**：idem_key 进签名 → 同 sig 不能用于不同 key 的请求 → 自动 replay 防护，无需独立 nonce 表。

##### 4.2.2 admin JWT 验签（v3 核心修复）

admin-backend 现有 `internal/pkg/jwt/jwt.go` 用 HS256 自签，claims 含：
- `sub`: `"lark:" + lark_user_id`
- `role`: `super_admin / operator / customer_service / finance`
- `name / email / avatar`：人类可读字段
- `jti`：黑名单 key
- `iss / iat / exp`

**v3 设计**：web-api 直接共享同 `ADMIN_JWT_SECRET`，复用 `golang-jwt/jwt/v5` 验签。

`internal/pkg/adminjwt/parser.go`：
```go
type Claims struct {
    LarkUserID string    // 从 sub 字段去掉 "lark:" 前缀
    Role       string
    Name       string
    Email      string
    JTI        string
    ExpiresAt  time.Time
}

func Parse(token, secret string) (*Claims, error) {
    var raw struct {
        Role   string `json:"role"`
        Name   string `json:"name"`
        Email  string `json:"email"`
        gojwt.RegisteredClaims
    }
    parsed, err := gojwt.ParseWithClaims(token, &raw, func(t *gojwt.Token) (any, error) {
        if _, ok := t.Method.(*gojwt.SigningMethodHMAC); !ok {
            return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
        }
        return []byte(secret), nil
    }, gojwt.WithIssuer("oddfi-admin"))
    if err != nil { return nil, err }
    if !parsed.Valid { return nil, fmt.Errorf("token invalid") }

    larkID := strings.TrimPrefix(raw.Subject, "lark:")
    if larkID == raw.Subject {
        return nil, fmt.Errorf("sub missing lark: prefix")
    }
    return &Claims{
        LarkUserID: larkID,
        Role:       raw.Role,
        Name:       raw.Name,
        Email:      raw.Email,
        JTI:        raw.ID,
        ExpiresAt:  raw.ExpiresAt.Time,
    }, nil
}
```

middleware `admin_jwt.go`：
```go
func AdminJWT(secret string) gin.HandlerFunc {
    return func(c *gin.Context) {
        token := c.GetHeader("X-Admin-JWT")
        if token == "" {
            abort(401, "admin_jwt required")
        }
        // 去除 "Bearer " 前缀
        token = strings.TrimPrefix(token, "Bearer ")

        claims, err := adminjwt.Parse(token, secret)
        if err != nil {
            abort(401, "admin_jwt invalid: " + err.Error())
        }
        if time.Now().After(claims.ExpiresAt) {
            abort(401, "admin_jwt expired")
        }
        // verified operator
        c.Set("operator_id", claims.LarkUserID)
        c.Set("operator_role", claims.Role)
        c.Next()
    }
}
```

**优势**：
- 无反向依赖（不调 admin-backend）
- 无 cache 一致性问题
- 一次 HMAC 验签 < 1ms
- secret 在 systemd EnvironmentFile，两个服务共享，独立轮换流程见 §4.2.3

##### 4.2.3 secret 轮换

`ADMIN_JWT_SECRET` 轮换需要**两侧同时支持新旧 secret**：
1. admin-backend 加 `ADMIN_JWT_SECRETS`（复数）支持验旧 token，签发用最新
2. web-api 加 `ADMIN_JWT_SECRETS` 支持验旧 token
3. 切换完成后下线旧 secret

实施细节：admin-backend `jwt.go` Parse 路径遍历 secrets 任一通过即可（v3 顺带修，工时 +1h）。

### 4.3 idempotency + audit 同 tx（M3 修复）

**关键**：idempotency INSERT、business UPDATE/INSERT、audit INSERT 必须在**同一 tx**，三者原子性。

middleware 顺序：
```
1. service_auth (HMAC)
2. admin_jwt (HS256 验 → operator)
3. admin_audit (开 tx 注入 ctx)
4. idempotency (在 ctx tx 里 INSERT；命中 cache 则 rollback + 返 cache)
5. handler (用 ctx tx 写 business)
6. admin_audit (handler 完成后在 ctx tx 里写 audit + 填 idempotency.audit_id → commit)
```

新的 idempotency middleware：
```go
func Idempotency(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        key := c.GetHeader("X-Idempotency-Key")
        if key == "" {
            abort(400, "idempotency_key required")
        }
        bodyBytes, _ := io.ReadAll(c.Request.Body)
        bodyHash := sha256.Sum256(bodyBytes)
        c.Request.Body = io.NopCloser(bytes.NewReader(bodyBytes))
        c.Set("body_hash", hex.EncodeToString(bodyHash[:]))

        tx := gormtx.From(c.Request.Context())  // admin_audit 已开 tx
        if tx == nil {
            abort(500, "no tx context (admin_audit middleware order wrong)")
        }

        // 查现有 idempotency 行（在 tx 内 SELECT FOR UPDATE 防并发）
        var existing AdminIdempotency
        err := tx.Where("idempotency_key = ?", key).
            Clauses(clause.Locking{Strength: "UPDATE"}).
            First(&existing).Error
        if err == nil {
            // 命中 → 校验 body 一致
            if existing.RequestBodyHash != hex.EncodeToString(bodyHash[:]) {
                gormtx.Rollback(c.Request.Context())
                response.JSON(c, 409, gin.H{"code": "IDEMPOTENCY_BODY_MISMATCH"})
                c.Abort()
                return
            }
            // 命中 + body 一致 → 返 cache 结果（不再走 handler）
            gormtx.Rollback(c.Request.Context())   // 不需要 commit（什么都没改）
            // 注入 replayed 标识 + 原始 request_id 防混淆
            c.Header("X-Replayed", "true")
            c.Header("X-Original-Request-ID", existing.OriginalRequestID)
            var snapshot map[string]any
            _ = json.Unmarshal([]byte(existing.ResponseSnapshot), &snapshot)
            snapshot["_replayed"] = true
            snapshot["_original_request_id"] = existing.OriginalRequestID
            replayedBody, _ := json.Marshal(snapshot)
            c.Data(existing.ResponseStatus, "application/json", replayedBody)
            c.Abort()
            return
        }
        if !errors.Is(err, gorm.ErrRecordNotFound) {
            gormtx.Rollback(c.Request.Context())
            abort(500, "idempotency lookup failed: "+err.Error())
        }

        // 没命中 → INSERT（同 tx，未 commit）
        row := &AdminIdempotency{
            IdempotencyKey:  key,
            RequestPath:     c.Request.URL.Path,
            RequestBodyHash: hex.EncodeToString(bodyHash[:]),
            CreatedAt:       time.Now().UnixMilli(),
            ExpiresAt:       time.Now().AddDate(0, 0, 90).UnixMilli(),
        }
        if err := tx.Create(row).Error; err != nil {
            gormtx.Rollback(c.Request.Context())
            abort(500, "idempotency insert failed: "+err.Error())
        }
        c.Set("idempotency_row_id", row.ID)

        // 截获响应体（admin_audit 提交 tx 之后调用）
        rw := &responseRecorder{ResponseWriter: c.Writer, body: &bytes.Buffer{}}
        c.Writer = rw
        c.Next()

        // 在 admin_audit middleware commit 之前回填响应
        // 流程：handler 跑完 → idempotency middleware after-next 填 row.response_* →
        //       admin_audit after-next 把 audit 写完 + commit
        if !c.IsAborted() && len(c.Errors) == 0 {
            tx.Model(&AdminIdempotency{}).Where("id = ?", row.ID).
                Updates(map[string]any{
                    "response_status":   rw.Status(),
                    "response_snapshot": string(rw.body.Bytes()),
                })
        }
    }
}
```

**关键差别 vs v2**：
- idempotency INSERT 在 audit 同 tx
- handler 业务 4xx + Abort → audit middleware rollback → idempotency 行**也回滚**，key 没被占
- handler 业务成功 + audit 成功 commit → idempotency 行真落 + business 真改 + audit 真写，三者原子
- 重复请求带同 key → SELECT FOR UPDATE 拿到上次结果 → 返 cache（不走 handler）

audit `service_secret_id` 字段：
```sql
ALTER TABLE presale_admin_audit
  ADD COLUMN `service_secret_id` VARCHAR(16) NULL COMMENT 'HMAC secret 哈希前 8 字节，泄漏排查用';
```

middleware admin_audit 写 audit 时填这个字段。

### 4.4 audit 强一致

middleware `admin_audit.go`（v3 优化）：
```go
func AdminAudit(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        if c.Request.Method == "GET" { c.Next(); return }

        ctx := gormtx.WithTx(c.Request.Context(), db)
        c.Request = c.Request.WithContext(ctx)
        c.Next()

        if c.IsAborted() || len(c.Errors) > 0 {
            gormtx.Rollback(ctx)
            return
        }
        tx := gormtx.From(ctx)

        operatorID := c.GetString("operator_id")
        role := c.GetString("operator_role")
        secretID := c.GetString("service_secret_id")
        audit := buildAuditFromContext(c, operatorID, role, secretID)
        if err := tx.Create(&audit).Error; err != nil {
            gormtx.Rollback(ctx)
            response.Internal(c, "audit insert failed")
            return
        }
        // idempotency 行的 audit_id 在 commit 前回填
        if rowID, ok := c.Get("idempotency_row_id"); ok {
            tx.Model(&AdminIdempotency{}).Where("id = ?", rowID).
                Update("audit_id", audit.ID)
        }
        if err := gormtx.Commit(ctx); err != nil {
            response.Internal(c, "commit failed")
        }
    }
}
```

注册顺序（router）：
```go
admin := internalRouter.Group("/internal/admin",
    middleware.ServiceAuth(cfg.ServiceTokens),
    middleware.AdminJWT(cfg.AdminJWTSecret),
    middleware.AdminAudit(db),        // ← 先开 tx 进 ctx
    middleware.Idempotency(db),       // ← 在 audit 的 tx 里 INSERT
)
```

### 4.5 错误码

| 错误码 | 触发 | HTTP |
|---|---|---|
| `SERVICE_SIG_INVALID` | HMAC 验签失败 / 60s timestamp 过期 | 401 |
| `ADMIN_JWT_INVALID` | HS256 验签失败 / sub 无 "lark:" 前缀 | 401 |
| `ADMIN_JWT_EXPIRED` | claims.exp 已过 | 401 |
| `IDEMPOTENCY_KEY_REQUIRED` | mutate 缺 key | 400 |
| `IDEMPOTENCY_BODY_MISMATCH` | 同 key 不同 body | 409 |

---

## 5 实施 Phase（v3，硬 gate 推迟 2 天）

> P2 (web-api) 和 P4 (admin-backend) 并行启动；P3 在 P2 部分完成后即可开始（middleware 就绪）。

| Phase | 内容 | 工时 | 启动 |
|---|---|---|---|
| **P1** | revert DD-002 P2-P6 + DD-003 v3 落档 + 3 个 ADR 落档 | 2.5h | 现在 |
| **P2** | web-api: 2 migration + 5 middleware（service_auth / admin_jwt / admin_audit / idempotency / 复用现 RateLimit）+ gormtx + adminjwt 包 + 双 listener | 10-12h | P1 完 |
| **P3** | web-api: 17 handler + 4 service + repo 扩展 | 12-16h | P2 中段（middleware 就绪即可起） |
| **P4** | admin-backend: 删 17 文件 + 5 handler 薄壳化 + webapi client（HMAC 签名 + 透传 JWT） | 6-8h | P1 完，与 P2 并行 |
| **P5** | 联调：unit + httptest 跨服务 + 真链 e2e | 6-8h | P3 + P4 完 |
| **P6** | 文档 + Nginx vhost + cutover runbook | 3h | P5 完 |
| **总** | | **40-50h** | |

关键路径：P1 (2.5h) → P2 (10-12h) → P3 (12-16h) → P5 (6-8h) → P6 (3h) = **34-42h 钟表时间** ≈ **5-6 工作日**

**v3 硬 gate**：
- **6/3** 前 P3 必须完成 → 否则切 fallback B（read-only RPC）
- **6/8** 前 P5 必须完成 → 留 2 天 cutover + 真链 e2e（vs v2 的 6/5 太紧）

---

## 6 部署切换

### 6.1 前置基础设施（DevOps 提前准备）

1. DNS：`admin-api.oddfi.io` A 记录 → `oddfi-backend` EIP `<SERVER_IP>`（与 api.oddfi.io 同 IP）
2. Let's Encrypt 证书：`certbot certonly --nginx -d admin-api.oddfi.io`
3. **不需要**改 AWS SG（已开 443）
4. `ADMIN_JWT_SECRET` 现已在 admin-backend systemd env 里，运维需把同值同步到 web-api EC2 `/etc/oddfi/web-api.env`（48 字节 base64，run `openssl rand -base64 48` 重生成更安全；轮换流程 §4.2.3）
5. `WEBAPI_SERVICE_TOKEN` 用 `openssl rand -base64 48` 生成，admin + web-api 双写

### 6.2 顺序

```
1. web-api 部新版（双 listener + middleware）
   - 启动后 :8080 和 :8081 都监听
   - Nginx 暂不放行 admin-api.oddfi.io
2. prod MySQL 跑 migration 0009 (audit) + 0010 (idempotency)
3. 进程级自检：
   ssh oddfi-backend "curl -i http://127.0.0.1:8081/internal/admin/presale/rounds"
   # 期望 401 (无 service-sig)
4. Nginx 加 admin-api.oddfi.io vhost + reload
5. 公网验证：
   curl -i https://admin-api.oddfi.io/internal/admin/presale/rounds
   # 期望 403（IP 不匹配）
6. admin EC2 验证：
   ssh oddfi-admin "curl -i https://admin-api.oddfi.io/internal/admin/presale/rounds"
   # 期望 401（无 service-sig）
7. admin-backend 部新版
   - env 加 WEBAPI_INTERNAL_URL=https://admin-api.oddfi.io
   - env 加 WEBAPI_SERVICE_TOKEN=<primary>
   - env 加 ADMIN_JWT_SECRET（应该已有）
   - 重启
8. 烟测：admin SPA 操作触发 → 全链路落 audit + business + idempotency
9. 观察 72h（覆盖至少 17 endpoint 各 1 笔 + 周末 + 夜间）
10. admin DB DROP 旧 presale_admin_audit 表
```

### 6.3 cutover 验证标准（v3.1 加严，含豁免与三方对账定义）

步骤 9 → 10 之间必须满足：

**A. endpoint 覆盖**
- **17 个 mutating endpoint 至少各 1 笔真实操作通过**
- 低频 endpoint 豁免：`migrate-round` / `anomaly-resolve` 等若 72h 内无真实业务触发场景 → **允许手动构造测试单据**（admin 用测试金库手动制造 anomaly 数据），但 audit 行必须带 `note=cutover_smoketest_<endpoint>` 标记便于事后筛选

**B. 三方对账（第三方源明确定义）**
- **第一方**：`presale_admin_audit` 行数（按时间窗口筛选 cutover 期间）
- **第二方**：`admin_idempotency` 行数（按时间窗口筛选，`audit_id IS NOT NULL` 已落 audit 的）
- **第三方**：admin-backend systemd journalctl 中 `[webapi-client]` 模块的 INFO 日志条数（每次成功 forward 一条）
  - 命令：`journalctl -u oddfi-admin-server --since "<cutover_start>" --until "<cutover_end>" | grep "\[webapi-client\] forward success" | wc -l`
- 三方计数误差 ≤ 1（容忍 1 条 in-flight）

**C. RBAC 覆盖**
- 至少 4 个不同 operator（covering super_admin / operator / customer_service / finance 四角色）

**D. 时间窗口**
- 跨夜间窗口 + 周末（≥ 72h）

### 6.4 回滚

参考 v2 §6.2，差别：步骤 10 admin DB DROP 前**强制 72h 观察 + 17 endpoint 全覆盖验证**（v2 是 24h + 5 笔）。

---

## 7 测试矩阵

### 7.1 单元测试

| 文件 | 关键 case |
|---|---|
| `service_auth_test.go` | sig 验通 / stale ts / multi-secret 重叠 / idem_key 参与签名导致跨 key replay 失败 |
| `admin_jwt_test.go` | HS256 验通 / wrong secret / expired / sub 缺 "lark:" / wrong alg (RS256 → 拒) |
| `idempotency_test.go` | 新 key INSERT 同 tx / 同 key 同 body 命中 cache / 同 key 不同 body 409 / handler 4xx → idem 行 rollback |
| `admin_audit_test.go` | 同 tx 写 audit + idem.audit_id 回填 / handler abort rollback / commit 失败回滚 idem |
| `gormtx_test.go` | WithTx / From / Commit / Rollback / 无 tx context fail-fast |
| `webapi_client_test.go` (admin) | HMAC 签名生成 / idem_key 参与签名 / 5xx 重试 / 4xx 不重试 |

### 7.2 集成测试（httptest）

E2E-1 ~ E2E-5 同 v2，额外：
- E2E-6：admin business 失败 4xx → idempotency 行没写 → 重试用同 key 正常处理
- E2E-7：admin 改 body 重试用同 key → 409 BODY_MISMATCH

### 7.3 真链 e2e（部署后）

同 v2。

---

## 8 风险登记（v3 全量）

| ID | 风险 | 缓解 |
|---|---|---|
| R-D3-1 | Nginx admin-api.oddfi.io 漏配 allow → 公网暴露 | web-api :8081 仅 loopback 兜底；部署 e2e 自检脚本 |
| R-D3-2 | api.oddfi.io DDoS 影响 admin | 独立 vhost admin-api.oddfi.io |
| R-D3-3 | service-token 泄漏 | HMAC + 60s + idem_key 绑定签名；多 token 重叠期；audit 记 secret_id |
| R-D3-4 | admin-backend secret 泄漏 → JWT 可伪造 | 共享 HS256 secret 走 systemd env 600 权限；轮换流程双写新旧 |
| R-D3-5 | tx commit + response 失败 | idempotency 同 tx + response_snapshot 第二次返 cache |
| R-D3-6 | gorm tx-in-context 与现有用户路径范式不一致 | ADR-0003 记录两套范式 + TGE+30 天统一化 debt |
| R-D3-7 | TGE 前实施时间紧 | 6/3 / 6/8 硬 gate + fallback B |
| R-D3-8 | admin_idempotency 90 天清理误删 audit | 独立表 + audit 永不删；cron 只清 idem 表 |
| R-D3-9 | admin DB DROP 旧 audit 表 | 72h 观察 + 17 endpoint 全验证 |
| R-D3-10 | Let's Encrypt 证书过期 | 启用 certbot auto-renew + 监控 |
| R-D3-11 | admin-backend HS256 secret 也作为 JWT secret 漏在 web-api log 里 | logger 严禁打 secret；config validate 校验 secret 长度 ≥ 32；env 文件 chmod 0400 + chown root |
| R-D3-12 | admin JWT 黑名单跨服务不可见（admin logout 后 web-api 仍验通） | TGE 前缓解：admin JWT TTL 缩到 ≤ 2h（admin-backend config.yaml `jwt.ttl: 2h`）+ ADR-0002 记录长期 debt（TGE+30 天补 `/internal/jwt-blacklist` 反向查询） |

---

## 9 ADR（v3 落档前置）

DD-003 v3 落档同时（非上线后）写：

- **ADR-0001**：admin-backend 不直连 prod business DB；任何「admin 新业务表」需求加 web-api internal endpoint
- **ADR-0002**：TGE 前不上 mTLS / service mesh，TGE+30 天复评；现用 HMAC bearer + 共享 HS256 secret 是已知 debt
- **ADR-0003**：web-api 引入两套事务范式（admin 路径用 tx-in-context，用户路径暂保持旧）；TGE+30 天统一化作为 debt

落档路径：`web-api/docs/dd-invest/adr/ADR-000X-*.md`，由 P1 阶段一并写。

---

## 10 critic 修订项追溯表（v3 vs v2）

| critic v2 编号 | v3 修复 |
|---|---|
| §2.1 C3 Lark JWKS 事实错位 | **§4.2.2 删 lark jwks pkg + 共享 HS256 secret + adminjwt.Parse** |
| §2.2 M3 idempotency 状态机洞 | **§4.3 idempotency INSERT 移到 audit 同 tx；SELECT FOR UPDATE** |
| §2.3 关键路径并行 | §5 硬 gate 推 2 天到 6/3 / 6/8 |
| §2.4 cutover 验证标准弱 | §6.3 加严：17 endpoint 全覆盖 + 三方对账 + 72h |
| §2.5 ADR 落档时机 | **§9 v3 落档同时写 3 ADR** |
| §2.6 cmd/server/main.go 双 listener 工时 | §5 P2 工时 +1h 单列 router 拆分 |
| §2.7 admin_users schema drift | **§4.2.2 改用 HS256 共享 secret 不再调 /auth/me，admin_users 仍归属 admin DB** |
| §2.8 service_secret_id 列未定 | **§4.3 schema 加 `service_secret_id` 列** |
| §3.1 admin_users snapshot | 不做（HS256 共享后无需 web-api 知道 admin_users） |
| §3.2 ADR-0003 两套范式 | **§9 ADR-0003 落档** |
| §3.3 frontend UUID 生命周期 | **§3.3 明确：form 渲染一次性 + 4xx 后轮换** |

**全部 11 项已采纳，无 reject**。

---

## 11 决策记录（v3 终稿）

| 决策 | 选择 | vs v2 |
|---|---|---|
| internal endpoint host | admin-api.oddfi.io 独立 vhost | 升级（v2 共用 api.oddfi.io） |
| service auth | HMAC + 60s + idem_key 参与签名 | 升级（v2 5min 无 nonce） |
| operator 鉴权 | 共享 HS256 secret 验 admin-backend 自签 JWT | 重写（v2 错用 Lark JWKS） |
| idempotency 写入 | 同 audit/business tx，原子 | 重写（v2 子 tx 早提交） |
| UUID 生成 | admin 前端 form 渲染时 | 明确（v2 模糊） |
| HMAC secret 轮换 | 多 secret 重叠期 | 不变 |
| ADM JWT secret 轮换 | 多 secret 重叠期（双侧同步） | 新增 |
| ADR 落档时机 | v3 落档同时落 ADR-0001/0002/0003 | 修正（v2 上线后补） |
| 硬 gate | 6/3 / 6/8 | 推 2 天 |
| 双 listener | web-api :8080 公网 + :8081 loopback | 不变 |
| /admin/order/* legacy | 不动；ADR-0002 跟踪 | 不变 |
