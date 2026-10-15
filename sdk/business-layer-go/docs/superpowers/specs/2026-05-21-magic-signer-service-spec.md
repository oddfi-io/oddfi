# Magic Signer Service — 设计文档

**Date**: 2026-05-21
**Status**: 待评审
**Author**: brainstorming with niall
**Supersedes**: `2026-05-21-magic-signer-library-spec.md`（库形态版本，已废弃）
**Reference impl**: `D:\everything_finance\magic_alchmey\internal\magic\client.go` + `internal\config\config.go`

---

## 0. 目标与适用范围

### 0.1 部署形态

**这是一个独立的 HTTP 服务**，不是 Go 库。

```
┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐
│  web-api (caller)  │   │ admin-svc (caller) │   │ batch-job (caller) │
└────────┬───────────┘   └────────┬───────────┘   └────────┬───────────┘
         │ HTTPS (内网)            │ HTTPS (内网)           │ HTTPS (内网)
         │ X-Service-Auth          │ X-Service-Auth         │ X-Service-Auth
         └───────────┬─────────────┴────────────────────────┘
                     ▼
        ┌──────────────────────────────────────┐
        │   magic-signer-svc (本服务)          │
        │   - 持有 OIDC RSA 私钥               │
        │   - 持有 Magic APIKey                │
        │   - JWT cache (in-memory)            │
        │   - 地址 cache (in-memory)           │
        └────────────────┬─────────────────────┘
                         │ HTTPS
                         ▼
            ┌─────────────────────────────┐
            │   Magic TEE Express (SaaS)  │
            └─────────────────────────────┘
```

### 0.2 服务能力

只对内网消费者提供两个原子能力：

1. **查询 user 对应的链上 EOA 地址** — `POST /v1/wallet/address`
2. **让 user 对应的私钥对 32 字节 digest 签名** — `POST /v1/wallet/sign`

### 0.3 不在范围内

- ❌ Magic 客户端 JS SDK（这是后端服务）
- ❌ ERC-4337 / Smart Account 部署
- ❌ EIP-7702 协议本身的封装（属于 relay 库职责）
- ❌ 用户认证 / SIWE / OIDC 用户注册（这是 web-api 职责）
- ❌ 对外暴露（仅服务内部 mesh 可达，绝不上公网）

---

## 1. 硬约束

### 1.1 环境严格隔离（**核心安全约束**）

**正式环境与测试环境必须用不同的 Magic App + 不同的 RSA 私钥**，确保即使同一 `user_id` 在两个环境调用，得到的地址也是不同的。

**实现方式：每个环境一套独立部署**，配置不共享。

```
┌──────────────────────────────────────────────────────────────────┐
│  生产部署 (magic-signer-svc-prod)                                │
│    APP_ENV               = "prod"                                │
│    MAGIC_API_KEY         = pk_live_***                           │
│    OIDC_PROVIDER_ID      = <prod 的 UUID>                        │
│    OIDC_PRIVATE_KEY_FILE = /etc/magic-signer/prod-rsa.pem        │
│    OIDC_ISSUER           = https://www.oddfi.io/                 │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  测试部署 (magic-signer-svc-test)                                │
│    APP_ENV               = "test"                                │
│    MAGIC_API_KEY         = pk_test_***                           │
│    OIDC_PROVIDER_ID      = <test 的 UUID, 与 prod 不同>          │
│    OIDC_PRIVATE_KEY_FILE = /etc/magic-signer/test-rsa.pem        │
│    OIDC_ISSUER           = https://test.oddfi.io/                │
└──────────────────────────────────────────────────────────────────┘
```

**强制启动检查**：
- 服务启动时必须能读到 `APP_ENV` 环境变量，否则 fatal exit
- `APP_ENV` 只接受 `"prod"` 或 `"test"` 两个值，其他值 fatal exit
- 启动时打印 `[STARTUP] magic-signer-svc env=prod oidc_provider_id=<前 8 位>`，方便运维交叉确认部署是否对的环境

**禁止单服务内多租户混用**：不要试图在一个进程里同时服务 prod 和 test。原因：
- RSA 私钥泄露面变大
- 误路由风险（一个 bug 把 prod 请求路由到 test 配置）
- 日志监控难分

### 1.2 仅内网可达

- 服务监听地址默认 `127.0.0.1:8443` 或 K8s 内部 ClusterIP，**不暴露 LoadBalancer / Ingress 到公网**
- 部署时强制走内网 DNS（如 `magic-signer.svc.cluster.local`）
- 不允许 0.0.0.0:* 监听到 Pod 外部网络
- 网络策略（NetworkPolicy / Security Group）限制：只允许已知 caller 服务的 IP/SA 访问

### 1.3 调用方鉴权

每个调用方在请求头里必须带 `X-Service-Auth: Bearer <token>`，否则返 401。

```
配置示例（服务端）：
  callers:
    - name: "web-api"
      token_sha256: "abc123..."        ← 不存明文
      allowed_ops: ["address", "sign"]
    - name: "admin-svc"
      token_sha256: "def456..."
      allowed_ops: ["address"]          ← admin 只能查地址，不能签名
    - name: "batch-job"
      token_sha256: "789ghi..."
      allowed_ops: ["address", "sign"]
```

- 服务启动时把 `token_sha256` 加载到内存，请求时 `sha256(req.Token) == cfg.TokenSha256` 比较
- 每个 caller 一个独立 token，不共用
- 同一个 caller 在 prod 和 test 的 token 必须不同（双重保险）
- token 30 天轮换一次（运维流程，与服务实现无关）

### 1.4 日志规则

**全部请求强制 structured JSON log**，必带字段：

```json
{
  "ts": "2026-05-21T14:23:45.123456789Z",
  "level": "info",
  "svc": "magic-signer-svc",
  "env": "prod",
  "request_id": "req_a1b2c3d4e5",
  "caller": "web-api",
  "caller_ip": "10.0.1.42",
  "op": "sign",
  "user_id": "1234567890",
  "digest_hash_prefix": "0xabcd...ef01",
  "magic_latency_ms": 87,
  "duration_ms": 92,
  "status": 200,
  "result": "success"
}
```

**禁止打到日志的内容**（机密泄露风险）：
- ❌ OIDC JWT 完整内容
- ❌ 完整签名（只能打 sig 的前 4 字节 hex 作为关联标识）
- ❌ Magic APIKey
- ❌ X-Service-Auth token

**允许打**：
- ✅ user_id（业务侧已经知道）
- ✅ digest（它本身就是 hash，公开后无价值）
- ✅ Magic API status code + 错误 body 的前 200 字节
- ✅ caller IP

**日志输出**：到 stdout，让容器编排系统采集（不直接写文件，不直接发 Loki/ES）

### 1.5 不允许的事

- ❌ 服务监听 0.0.0.0 公网接口
- ❌ 任何接口不带 X-Service-Auth 就能调用
- ❌ 把 RSA 私钥放进 Git 仓库 / 配置文件里（必须挂 Secret 卷）
- ❌ 把 Magic APIKey 写到日志或错误响应里
- ❌ 在一个 binary 里同时支持多环境 / 多租户
- ❌ panic（任何 panic 必须 recover 并打 fatal log 后退出）

---

## 2. HTTP API 规范

所有接口：
- HTTPS only（开发环境 HTTP 也可，由部署决定）
- `Content-Type: application/json`
- 必带请求头：
  - `X-Service-Auth: Bearer <token>`
  - `X-Request-ID: <id>`（如果调用方不传，服务自动生成）

### 2.1 `POST /v1/wallet/address`

查询 / 创建 user 对应的 Magic EOA 地址。

**Request**:
```json
{
  "user_id": "1234567890"
}
```

**Response 200**:
```json
{
  "address": "0x1234567890123456789012345678901234567890",
  "user_id": "1234567890",
  "env": "prod",
  "cached": true
}
```

- `cached: true` 表示命中地址缓存；`false` 表示新从 Magic 拉的
- `env` 必须在响应里回写，方便调用方做双重校验

**Response 4xx/5xx**:
```json
{
  "error_code": "USER_ID_REQUIRED",
  "error_message": "user_id must be non-empty",
  "request_id": "req_a1b2c3d4e5"
}
```

**错误码表**（全部错误都用 `error_code` 字符串，调用方按此分支）：

| HTTP | error_code              | 含义                                                           | 调用方应对策略   |
| ---- | ----------------------- | -------------------------------------------------------------- | ---------------- |
| 400  | `USER_ID_REQUIRED`      | user_id 字段缺失或为空                                         | 修请求           |
| 400  | `USER_ID_TOO_LONG`      | user_id 超过 128 字符                                          | 修请求           |
| 401  | `UNAUTHORIZED`          | 缺 X-Service-Auth 或 token 无效                                | 修部署配置       |
| 403  | `OP_NOT_ALLOWED`        | caller 没有此操作权限（白名单未配置）                          | 修服务配置       |
| 502  | `MAGIC_UNAUTHORIZED`    | Magic 拒签 JWT（4xx）                                          | 看告警，修 OIDC 配置 |
| 502  | `MAGIC_API_ERROR`       | Magic 业务错误（4xx 非 401/403）                               | 看告警           |
| 503  | `MAGIC_NETWORK_ERROR`   | Magic 网络错误 / 5xx 重试耗尽                                   | 调用方退避重试   |
| 500  | `INTERNAL_ERROR`        | 服务内部错误（panic recover / 配置异常）                       | 紧急告警         |

### 2.2 `POST /v1/wallet/sign`

让 user 对应的私钥对 32 字节 digest 签名。

**Request**:
```json
{
  "user_id": "1234567890",
  "digest":  "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
}
```

- `digest` 必须是 `0x` 前缀 + 64 个 hex 字符（= 32 字节）；其他格式返 400
- digest 内容由调用方负责（可能是 EIP-712 hash、EIP-7702 auth digest、ERC-4337 userOpHash 等），服务不解释

**Response 200**:
```json
{
  "signature": "0xrrrrrrrr...ssssssss...vv",
  "user_id":   "1234567890",
  "env":       "prod",
  "address":   "0x1234567890123456789012345678901234567890"
}
```

- `signature`：`0x` + 130 个 hex 字符（= 65 字节 r ‖ s ‖ v，v ∈ {27, 28}）
- `address`：响应里回带这个 user 的 Magic EOA，方便调用方做最后一次断言（防止配置错乱）

**错误码补充**：

| HTTP | error_code         | 含义                                | 调用方应对策略 |
| ---- | ------------------ | ----------------------------------- | -------------- |
| 400  | `DIGEST_REQUIRED`  | digest 字段缺失                     | 修请求         |
| 400  | `DIGEST_FORMAT`    | digest 不是 0x + 64 hex 格式        | 修请求         |
| ... | （其他同 2.1）       |                                     |                |

### 2.3 `GET /healthz`

健康检查，**不**鉴权（K8s livenessProbe 用）。

**Response 200**:
```json
{
  "status": "ok",
  "env": "prod",
  "uptime_seconds": 123456,
  "git_sha": "abc123",
  "magic_reachable": true,
  "last_magic_check_at": "2026-05-21T14:20:00Z"
}
```

服务后台每 30 秒探测一次 Magic 可达性（轻量 ping，不走真签名），结果缓存到 `magic_reachable`。`false` 时 healthz 仍返 200 但字段为 false，调用方可以根据该字段决定是否切流。

### 2.4 `GET /metrics`

Prometheus 格式 metrics。**需要鉴权**（同 X-Service-Auth）。

暴露指标：
- `magic_signer_requests_total{caller, op, status, env}`
- `magic_signer_request_duration_seconds{caller, op, env}` (histogram)
- `magic_signer_magic_api_duration_seconds{op, env}` (histogram)
- `magic_signer_magic_api_errors_total{error_code, env}`
- `magic_signer_jwt_cache_hits_total{env}` / `_misses_total{env}`
- `magic_signer_address_cache_hits_total{env}` / `_misses_total{env}`
- `magic_signer_active_users` (gauge, 地址缓存里的条目数)

---

## 3. 服务实现细节

### 3.1 代码布局

```
magic-signer-svc/
├── go.mod                              # module github.com/Crypto-Barrett/magic-signer-svc
├── go.sum
├── README.md                           # 部署 + 调用方接入说明
├── Dockerfile
├── deploy/
│   ├── k8s-prod.yaml                   # K8s manifest，prod 环境
│   ├── k8s-test.yaml
│   └── config-template.yaml
│
├── cmd/server/main.go                  # 启动入口
│
├── internal/
│   ├── config/
│   │   ├── config.go                   # 配置加载 + 校验
│   │   └── env.go                      # APP_ENV 严格校验（prod/test）
│   │
│   ├── auth/
│   │   ├── auth.go                     # X-Service-Auth 中间件
│   │   ├── token_table.go              # caller → token_sha256 → allowed_ops 映射
│   │   └── auth_test.go
│   │
│   ├── handler/
│   │   ├── address.go                  # POST /v1/wallet/address
│   │   ├── sign.go                     # POST /v1/wallet/sign
│   │   ├── health.go                   # GET /healthz
│   │   ├── errors.go                   # 错误码定义 + HTTP 映射
│   │   ├── request_id.go               # request_id 中间件
│   │   ├── logging.go                  # access log 中间件
│   │   └── *_test.go
│   │
│   ├── jwt/
│   │   ├── minter.go                   # OIDC JWT 现场签发 (RS256)
│   │   ├── cache.go                    # JWT 缓存 (sync.Map + singleflight)
│   │   └── *_test.go
│   │
│   ├── magicapi/
│   │   ├── client.go                   # 调 Magic TEE 的 HTTP client
│   │   ├── wallet.go                   # POST /v1/wallet
│   │   ├── sign.go                     # POST /v1/wallet/sign/data
│   │   ├── retry.go                    # 指数退避，3 次
│   │   ├── headers.go                  # 6 个必带 header 组装
│   │   └── *_test.go
│   │
│   ├── addrcache/
│   │   ├── cache.go                    # 地址 LRU 缓存
│   │   └── cache_test.go
│   │
│   ├── healthcheck/
│   │   └── monitor.go                  # 后台 ping Magic
│   │
│   └── metrics/
│       └── metrics.go                  # Prometheus collectors
│
├── client/                             # 调用方接入用的小 SDK（与 server 一仓发布）
│   ├── client.go
│   ├── types.go
│   ├── errors.go
│   └── client_test.go
│
└── examples/
    └── caller/main.go                  # 用 client/ 调本服务的最小示例
```

### 3.2 服务启动检查（`cmd/server/main.go`）

启动时必须按序通过下列检查，**任何一项失败 → fatal exit code 1**：

```go
func main() {
    // 1. APP_ENV 严格校验
    env := os.Getenv("APP_ENV")
    if env != "prod" && env != "test" {
        logfatal("APP_ENV must be 'prod' or 'test', got %q", env)
    }

    // 2. 加载配置
    cfg, err := config.Load()
    if err != nil { logfatal("config: %v", err) }
    if err := cfg.Validate(); err != nil { logfatal("config validate: %v", err) }

    // 3. 加载 RSA 私钥（PEM PKCS8）
    rsaKey, err := loadRSAKey(cfg.OIDCPrivateKeyFile)
    if err != nil { logfatal("rsa key: %v", err) }
    if rsaKey.N.BitLen() < 2048 { logfatal("RSA key must be at least 2048 bits") }

    // 4. 加载 caller 鉴权表
    if len(cfg.Callers) == 0 { logfatal("must configure at least one caller") }
    authTable := auth.NewTable(cfg.Callers)

    // 5. 启动 magic api client + caches
    jwtMinter := jwt.NewMinter(rsaKey, cfg.OIDC)
    jwtCache := jwt.NewCache(jwtMinter, cfg.JWTLifetime, 1*time.Minute /* safety */)
    addrCache := addrcache.New(cfg.AddressCacheTTL, cfg.AddressCacheMax)
    magicClient := magicapi.New(cfg.MagicAPI)

    // 6. 后台健康检查
    healthMonitor := healthcheck.Start(magicClient, jwtCache, "system-health-user")

    // 7. 启动 HTTP server
    mux := buildRouter(authTable, jwtCache, magicClient, addrCache, healthMonitor, cfg.Env)
    srv := &http.Server{
        Addr:              cfg.ListenAddr,
        Handler:           mux,
        ReadHeaderTimeout: 5 * time.Second,
        ReadTimeout:       10 * time.Second,
        WriteTimeout:      30 * time.Second,  // 给 Magic 重试留余量
        IdleTimeout:       120 * time.Second,
    }

    // 8. 启动日志（结构化）
    log.Info("magic-signer-svc starting",
        "env", env,
        "listen", cfg.ListenAddr,
        "git_sha", buildinfo.GitSHA,
        "oidc_provider_id_prefix", cfg.OIDC.ProviderID[:8],
        "allowed_callers", authTable.CallerNames(),
    )

    // 9. graceful shutdown
    go func() { /* listen SIGTERM/SIGINT, srv.Shutdown(ctx) */ }()
    if err := srv.ListenAndServe(); err != http.ErrServerClosed {
        logfatal("listen: %v", err)
    }
}
```

### 3.3 配置（`internal/config/config.go`）

```go
type Config struct {
    // ─── 环境标识 ─────────────────────────────────────────────────────
    Env string  // "prod" or "test"，由 APP_ENV 注入

    // ─── HTTP server ─────────────────────────────────────────────────
    ListenAddr string  // 默认 "127.0.0.1:8443"，不允许 0.0.0.0/0.0.0.0:* 公网监听

    // ─── caller 鉴权 ────────────────────────────────────────────────
    Callers []CallerConfig

    // ─── Magic 后台（per env，不同的 app）────────────────────────────
    MagicAPI MagicAPIConfig

    // ─── OIDC JWT 签发 ──────────────────────────────────────────────
    OIDC OIDCConfig

    // ─── 缓存 ───────────────────────────────────────────────────────
    JWTLifetime     time.Duration  // 默认 30min
    AddressCacheTTL time.Duration  // 默认 24h
    AddressCacheMax int            // 默认 100000 条
}

type CallerConfig struct {
    Name        string   // e.g. "web-api"
    TokenSHA256 string   // 调用方 token 的 sha256（hex），明文 token 不入配置
    AllowedOps  []string // ["address", "sign"] 子集；空 = 允许全部
}

type MagicAPIConfig struct {
    APIKey         string         // X-Magic-API-Key
    OIDCProviderID string         // X-OIDC-Provider-ID
    Referrer       string         // X-Magic-Referrer
    Chain          string         // X-Magic-Chain，默认 "ETH"
    Endpoint       string         // 默认 "https://tee.express.magiclabs.com"
    Timeout        time.Duration  // 单次 5s
    MaxRetries     int            // 默认 3
    RetryBaseDelay time.Duration  // 默认 200ms
}

type OIDCConfig struct {
    PrivateKeyFile string  // RSA private key PEM 文件路径
    Kid            string  // JWT header.kid，与 JWKS 中的 kid 一致
    Issuer         string  // JWT iss，必须与 Magic 后台注册的 issuer 一致
    Audience       string  // JWT aud, e.g. "oddfi-app"
    ProviderID     string  // 取自 MagicAPIConfig.OIDCProviderID（冗余但便利）
}
```

**Validate 必检项**：
- `Env` 非空且为 `"prod"` 或 `"test"`
- `ListenAddr` 不能是 `0.0.0.0:*` 形式（除非 `ALLOW_PUBLIC_LISTEN=1` 显式覆盖，且日志告警）
- `Callers` 非空，每个 caller 的 `Name` 唯一，`TokenSHA256` 是 64 hex
- `MagicAPI.APIKey` 以 `pk_live_` 或 `pk_test_` 开头；env=prod 时强制 `pk_live_`，env=test 时强制 `pk_test_`（**这是防止部署搞错环境的最后一道防线**）
- `OIDC.PrivateKeyFile` 存在、可读、是有效 PEM PKCS8 RSA 私钥、密钥长度 ≥ 2048 bit
- `OIDC.Issuer` 是合法 URL

### 3.4 鉴权中间件（`internal/auth/auth.go`）

```go
type Authenticated struct {
    Caller     string   // "web-api"
    AllowedOps []string // ["address", "sign"]
}

type ctxKey int
const callerCtxKey ctxKey = 1

func Middleware(table *Table) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            authHeader := r.Header.Get("X-Service-Auth")
            token, ok := strings.CutPrefix(authHeader, "Bearer ")
            if !ok || token == "" {
                writeError(w, r, 401, "UNAUTHORIZED", "missing X-Service-Auth")
                return
            }

            tokenHash := sha256Hex(token)
            caller, allowedOps, found := table.Lookup(tokenHash)
            if !found {
                writeError(w, r, 401, "UNAUTHORIZED", "invalid token")
                return
            }

            ctx := context.WithValue(r.Context(), callerCtxKey, Authenticated{
                Caller:     caller,
                AllowedOps: allowedOps,
            })
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }
}

// 路由时配合：
func requireOp(op string, h http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        a := r.Context().Value(callerCtxKey).(Authenticated)
        if len(a.AllowedOps) > 0 && !contains(a.AllowedOps, op) {
            writeError(w, r, 403, "OP_NOT_ALLOWED", fmt.Sprintf("caller %s not allowed to %s", a.Caller, op))
            return
        }
        h(w, r)
    }
}
```

**实现细节**：
- `sha256Hex(token)` 与配置里的 `TokenSHA256` 比较是 **constant-time** 的（用 `subtle.ConstantTimeCompare`）防 timing attack
- caller name 写入 context，给后续日志中间件用
- 401 / 403 不要泄漏"是 token 无效还是 op 不允许"的细节给响应；日志里详细记录

### 3.5 日志中间件（`internal/handler/logging.go`）

```go
func LoggingMiddleware(env string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            start := time.Now()
            requestID := r.Header.Get("X-Request-ID")
            if requestID == "" { requestID = "req_" + randHex(10) }

            // 把 request_id 写回 context 和响应头，方便调用方关联
            ctx := context.WithValue(r.Context(), reqIDKey, requestID)
            w.Header().Set("X-Request-ID", requestID)

            // 包一层 ResponseWriter 捕获 status 和 body size
            rw := &recordingResponseWriter{ResponseWriter: w, status: 200}

            next.ServeHTTP(rw, r.WithContext(ctx))

            // 提取 caller 信息（鉴权中间件先跑）
            caller := "unknown"
            if a, ok := r.Context().Value(callerCtxKey).(Authenticated); ok {
                caller = a.Caller
            }

            // 业务级字段从 handler 写到 context 里
            extra := extractExtra(r.Context())  // user_id, op, magic_latency_ms, etc.

            log.Info("http_request",
                "env",                 env,
                "request_id",          requestID,
                "caller",              caller,
                "caller_ip",           clientIP(r),
                "method",              r.Method,
                "path",                r.URL.Path,
                "status",              rw.status,
                "duration_ms",         time.Since(start).Milliseconds(),
                "user_id",             extra.UserID,
                "op",                  extra.Op,
                "digest_hash_prefix",  extra.DigestPrefix,   // 前 6 字节 hex
                "magic_latency_ms",    extra.MagicLatencyMs,
                "magic_status",        extra.MagicStatus,
                "cached",              extra.Cached,
                "result",              extra.Result,         // success / error
                "error_code",          extra.ErrorCode,
            )
        })
    }
}
```

每个 handler 通过 helper 把业务字段往 context 里塞：

```go
func (h *AddressHandler) Handle(w http.ResponseWriter, r *http.Request) {
    var req addressRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, r, 400, "BAD_REQUEST", err.Error())
        return
    }

    setLogExtra(r.Context(), logExtra{Op: "address", UserID: req.UserID})

    addr, cached, magicLatency, err := h.svc.GetAddress(r.Context(), req.UserID)
    setLogExtra(r.Context(), logExtra{Cached: cached, MagicLatencyMs: magicLatency})

    if err != nil {
        writeMagicError(w, r, err)   // 自动设置 error_code 到 log extra
        return
    }
    writeJSON(w, 200, addressResponse{
        Address: addr.Hex(), UserID: req.UserID, Env: h.env, Cached: cached,
    })
    setLogExtra(r.Context(), logExtra{Result: "success"})
}
```

### 3.6 JWT minter + cache（与原 library 设计完全一致，搬过来）

`internal/jwt/minter.go` 和 `cache.go` 内部实现跟前一版库的设计相同，只是放在服务内：

- RS256，claims = {sub, aud, iss, iat, exp}, header.kid 必填
- 缓存键 = `<env>:<userID>` (env 加前缀**做双重防御**，防错配)
- singleflight 防 thundering herd
- safety 提前 1min 续签

### 3.7 Magic API client（与原 library 设计完全一致，搬过来）

`internal/magicapi/` 包含：

- 6 个必带 header 组装（参考 `magic_alchmey/internal/magic/client.go:50-58`）
- POST /v1/wallet 解析 `public_address`
- POST /v1/wallet/sign/data 解析 `{r, s, v}`，v 从 y-parity 字符串 ("0"/"1") 转成 27/28
- 指数退避重试：5xx / 429 / 网络错误 → 重试 3 次，间隔 200ms × 2^attempt × jitter(±25%)
- 4xx（非 429）直接返
- 每次调用记录 magic_latency_ms 和 magic_status 到 ctx，给日志中间件用

### 3.8 地址 cache（与原 library 设计一致）

`internal/addrcache/cache.go`：LRU + TTL + RWMutex，键加 env 前缀 `<env>:<userID>`，TTL 默认 24h。

---

## 4. Client SDK（同仓发布，供调用方 import）

调用方通过这个 SDK 调用本服务，不用自己手撸 HTTP。

### 4.1 包路径

`github.com/Crypto-Barrett/magic-signer-svc/client`

### 4.2 公开 API

```go
package client

import (
    "context"
    "crypto/sha256"
    "encoding/hex"
    "encoding/json"
    "errors"
    "fmt"
    "io"
    "log/slog"
    "net/http"
    "strings"
    "time"

    "github.com/ethereum/go-ethereum/common"
)

// Config 是 client 的入参。
type Config struct {
    BaseURL    string        // 必填，e.g. "https://magic-signer.svc.cluster.local"
    AuthToken  string        // 必填，对应服务端配置里某个 caller 的 token（不是 hash）
    Timeout    time.Duration // 默认 10s
    Logger     *slog.Logger  // 默认 slog.Default()
    HTTPClient *http.Client  // 默认 &http.Client{Timeout: ...}
}

// Client 是 magic-signer-svc 的客户端。线程安全，进程级单例。
type Client struct { /* unexported */ }

// New 构造 Client。
func New(cfg Config) (*Client, error)

// Signature 是 r(32) || s(32) || v(1) 共 65 字节。
type Signature [65]byte

// ─── Signer 接口 ───
// 调用方（contracts-business-layer 的 relay 库、web-api 的 auth 服务）只看这两个方法。
// 接口形态与原 library 完全一致，方便 mock。

func (c *Client) WalletAddress(ctx context.Context, userID string) (common.Address, error)

func (c *Client) SignDigest(ctx context.Context, userID string, digest [32]byte) (Signature, error)

// ─── Signer interface alias ───
type Signer interface {
    WalletAddress(ctx context.Context, userID string) (common.Address, error)
    SignDigest(ctx context.Context, userID string, digest [32]byte) (Signature, error)
}
var _ Signer = (*Client)(nil)

// ─── Error 哨兵 ───
var (
    ErrInvalidConfig      = errors.New("magicclient: invalid config")
    ErrUnauthorized       = errors.New("magicclient: 401 from service") // 401, 调用方配置问题
    ErrOpNotAllowed       = errors.New("magicclient: 403 from service") // 403, caller 没权限
    ErrBadRequest         = errors.New("magicclient: 400 from service") // 入参格式错
    ErrMagicNetwork       = errors.New("magicclient: magic upstream unavailable") // 503
    ErrMagicAPI           = errors.New("magicclient: magic upstream rejected request") // 502
    ErrServerInternal     = errors.New("magicclient: signer service internal error")   // 500
    ErrNetwork            = errors.New("magicclient: network failure to signer svc")    // client→svc 失败
)

// ServiceError 是结构化错误，wrap 上面的哨兵之一。
type ServiceError struct {
    HTTPStatus int
    ErrorCode  string  // 服务端返的 error_code
    Message    string
    RequestID  string  // 服务端的 X-Request-ID
}
func (e *ServiceError) Error() string { /* ... */ }
func (e *ServiceError) Unwrap() error { /* 按 HTTPStatus 映射到哨兵 */ }
```

### 4.3 Client 行为约束

- **不再做地址 cache**（已在服务端做了；client 多缓一份只是浪费内存、引入不一致）
- 必须把 `X-Service-Auth: Bearer <AuthToken>` 设置上
- 必须生成并发送 `X-Request-ID`（如果调用方上下文里已有 trace id 就用它，没有就自动生成）
- 客户端**不自动重试**（服务端已经把 Magic 调用的重试做完了；客户端再重试 = 重复请求）
  - 例外：网络层失败（DNS 解析失败、连接超时、连接被重置）可以重试 1 次
- 单次请求 timeout 默认 10s（要给服务端留够时间做 Magic 的 3 次重试，但又不能无限等）

### 4.4 Client 使用示例

```go
// 在 web-api 的启动代码里：
import magicclient "github.com/Crypto-Barrett/magic-signer-svc/client"

signerCli, err := magicclient.New(magicclient.Config{
    BaseURL:   os.Getenv("MAGIC_SIGNER_URL"),
    AuthToken: os.Getenv("MAGIC_SIGNER_TOKEN"),   // 来自 K8s secret
    Timeout:   10 * time.Second,
})
if err != nil { log.Fatal(err) }

// 用法 1: 登录时落 magic 地址
addr, _ := signerCli.WalletAddress(ctx, fmt.Sprint(userID))

// 用法 2: 注入到 relay 库做签名
relayClients, _ := business.NewRelayClients(ctx, business.RelayConfig{
    UserSigner: signerCli,  // ← 实现了 Signer 接口，直接注入
    ...
})
```

---

## 5. 测试要求

### 5.1 服务端单测覆盖率 ≥ 85%

- `internal/jwt/`：mint + cache 行为同原 library 测试
- `internal/magicapi/`：用 httptest 模拟 Magic TEE，覆盖 200/400/401/429/500 各路径
- `internal/auth/`：缺 token / 错 token / op 不在白名单 → 各返对应 401/403
- `internal/handler/`：
  - POST /v1/wallet/address: 正常 / user_id 空 / cached vs uncached
  - POST /v1/wallet/sign: 正常 / digest 错格式 / Magic 重试耗尽返 503
  - 所有路径都断言响应里的 `env` 字段正确
  - 日志中间件断言每条 log 都包含必要字段

### 5.2 集成测试（`integration_test.go`）

跑完整的 HTTP 流程：
1. 启动 fake Magic server (httptest.NewServer) 模拟 Magic TEE
2. 起 magic-signer-svc 进程或 in-process Listener
3. 用 client/ SDK 调本服务
4. 验证：
   - 200 路径返地址 / 签名格式正确
   - 401 路径：故意改 token → client 返 ErrUnauthorized
   - prod env 配置 + pk_test_* 启动 → 服务拒绝启动 fatal exit
   - test env 配置 + pk_live_* 启动 → 同上

### 5.3 环境隔离冒烟测试（重要）

`scripts/env-isolation-smoke.sh`：

1. 用 prod 配置起一个服务 (cfg-prod.yaml, listen :9001)
2. 用 test 配置起另一个 (cfg-test.yaml, listen :9002)
3. 对**同一个 user_id="9999999"** 分别调两个服务的 `/v1/wallet/address`
4. **断言返回的两个地址不同**
5. 如果相同 → fatal，环境配错了，必须停止上线

这个脚本要在 CD pipeline 里每次部署后跑一遍。

### 5.4 Client SDK 单测

- mock magic-signer-svc 响应，覆盖 200/400/401/403/500/503
- 验证每种错误正确映射到对应的 ServiceError + 哨兵 unwrap

---

## 6. 部署要求

### 6.1 K8s manifest 关键点

```yaml
# deploy/k8s-prod.yaml 摘要
apiVersion: v1
kind: Service
metadata:
  name: magic-signer-svc
  namespace: prod
spec:
  type: ClusterIP    # ← 内网 only，不要 LoadBalancer
  selector: { app: magic-signer-svc, env: prod }
  ports:
    - port: 443
      targetPort: 8443
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: magic-signer-svc, namespace: prod }
spec:
  podSelector: { matchLabels: { app: magic-signer-svc } }
  ingress:                        # ← 只允许已知 caller 访问
    - from:
        - podSelector: { matchLabels: { app: web-api } }
        - podSelector: { matchLabels: { app: admin-svc } }
        - podSelector: { matchLabels: { app: batch-job } }
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: magic-signer-svc
  namespace: prod
spec:
  replicas: 3      # ← 多副本，但每个副本独立缓存（缓存丢失不影响正确性）
  template:
    spec:
      containers:
        - name: server
          image: magic-signer-svc:v1.0.0
          env:
            - name: APP_ENV
              value: "prod"               # ← 写死，绝不从外部 input
          envFrom:
            - secretRef: { name: magic-signer-secrets-prod }
          volumeMounts:
            - name: oidc-key
              mountPath: /etc/magic-signer
              readOnly: true
          livenessProbe:
            httpGet: { path: /healthz, port: 8443 }
            periodSeconds: 30
          readinessProbe:
            httpGet: { path: /healthz, port: 8443 }
            periodSeconds: 10
      volumes:
        - name: oidc-key
          secret: { secretName: magic-signer-oidc-key-prod }
```

### 6.2 Secret 管理

- `magic-signer-secrets-prod` Secret 包含：
  - `MAGIC_API_KEY` = `pk_live_***`
  - `CALLER_TOKEN_WEB_API` / `CALLER_TOKEN_ADMIN_SVC` / `...` （或一个聚合的 JSON 文件，按部署习惯）
- `magic-signer-oidc-key-prod` Secret 包含：
  - `prod-rsa.pem`（RSA 私钥 PEM PKCS8）

- prod 和 test 必须挂**不同的** Secret，运维流程上禁止任何"通用"密钥

### 6.3 监控告警

至少配置：
- `rate(magic_signer_requests_total{status!~"2.."}[5m]) / rate(magic_signer_requests_total[5m]) > 0.05`：错误率 > 5% 告警
- `histogram_quantile(0.99, rate(magic_signer_request_duration_seconds_bucket[5m])) > 2.0`：p99 延迟 > 2s 告警
- `rate(magic_signer_magic_api_errors_total{error_code="MAGIC_UNAUTHORIZED"}[1m]) > 0`：OIDC 配置失效，立即告警
- `up{job="magic-signer-svc"} == 0`：实例挂了

---

## 7. 实现顺序（推荐）

1. `go mod init` + 项目骨架
2. `internal/config/`：Config + Validate（env 校验最优先）
3. `internal/jwt/`：minter + cache
4. `internal/magicapi/`：HTTP client + retry
5. `internal/addrcache/`：LRU
6. `internal/auth/`：bearer token 鉴权 + caller table
7. `internal/handler/`：四个 endpoint
8. 日志中间件 + request_id 中间件
9. `cmd/server/main.go` 启动 wiring
10. `client/` SDK
11. `internal/healthcheck/`：后台 ping Magic
12. `internal/metrics/`：Prometheus
13. Dockerfile + K8s manifest
14. 单测覆盖到 85%
15. `scripts/env-isolation-smoke.sh`
16. 用 staging Magic 跑 client SDK 实测一遍

---

## 8. 已知未决问题

1. **mTLS vs Bearer token**：当前用 bearer token 做 caller 鉴权。如果集群已经有 service mesh（Istio / Linkerd）做 mTLS，就可以把 bearer 这一层省掉。设计上保留 bearer，是为了不依赖特定 mesh。
2. **多副本 cache 不一致**：3 个副本各持自己的 JWT cache + 地址 cache。地址 cache 一致性不重要（同一 user_id 在 Magic 端是确定性的）；JWT cache 不一致只是导致多签了几次 JWT，没有正确性问题。所以**不引入 Redis**。
3. **跨 region 部署**：当前 spec 假定单 region。多 region 部署时，调用方就近路由即可，无须 service 改动。
4. **RSA key rotation**：跟原库一样，本版本不实现 rotation；用 kid 加版本前缀（如 `kid-2026q2`）可以实现 hot swap，留作 v2 工作。

---

## 9. 验收清单

- [ ] 服务用 prod 配置启动，对 user_id=X 调 /v1/wallet/address 返地址 A
- [ ] 服务用 test 配置启动，对**同一** user_id=X 调 /v1/wallet/address 返地址 B
- [ ] **A ≠ B**（环境隔离冒烟测试通过）
- [ ] 不带 X-Service-Auth → 401
- [ ] 带错 token → 401，且响应 body 不暴露"是 token 错还是格式错"
- [ ] 带正确 token 但调用方 op 白名单不含 sign → 403
- [ ] 每个请求的 access log 都包含：env / caller / user_id / op / duration_ms / status / request_id
- [ ] 同一 user_id 第二次调 address → `cached: true`
- [ ] Magic 返 502 → 重试 3 次 → 最终返 503 `MAGIC_NETWORK_ERROR`
- [ ] /healthz 返 200 + env 字段对
- [ ] /metrics 暴露 ≥ 7 个核心指标
- [ ] `go test ./... -race` 全绿
- [ ] 覆盖率 ≥ 85%
- [ ] env-isolation-smoke.sh 通过
- [ ] K8s manifest 验证：Service 类型 ClusterIP，NetworkPolicy 限制 caller
- [ ] 启动日志包含 env / git_sha / oidc_provider_id 前缀
- [ ] prod 配置 + pk_test_* → fatal exit；test 配置 + pk_live_* → fatal exit
