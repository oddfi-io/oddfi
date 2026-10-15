# magic-signer — 服务 + Client SDK 设计文档

**Date**: 2026-05-21
**Status**: 待评审
**Project root**: `D:\everything_finance\magic_client`
**Go module**: `github.com/Crypto-Barrett/oddfi-magic-client`
**Reference impl**: `D:\everything_finance\magic_alchmey\internal\magic\client.go` + `internal\config\config.go`

---

## 0. 一句话定位

一个**仓库**同时交付两样东西：
1. **`magic-signer`（服务端 binary）** — 独立 HTTP 服务，所有配置走环境变量，仅内网可达。
2. **`magic-signer/client`（Go SDK 库）** — 给其他项目（web-api、contracts-business-layer 的 relay 库、admin-svc、batch-job 等）import，初始化时填服务的 URL + token 就能调。

调用方代码示例：

```go
import "github.com/Crypto-Barrett/oddfi-magic-client/client"

cli, _ := client.New(client.Config{
    BaseURL:   "https://magic-signer.svc.cluster.local",
    AuthToken: os.Getenv("MAGIC_SIGNER_TOKEN"),
})
addr, _ := cli.WalletAddress(ctx, "1234")
sig,  _ := cli.SignDigest(ctx, "1234", digest)
```

---

## 1. 部署形态

```
┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐
│  web-api           │   │  admin-svc         │   │  batch-job         │
│   import .../client│   │   import .../client│   │   import .../client│
└────────┬───────────┘   └────────┬───────────┘   └────────┬───────────┘
         │ HTTPS (内网)            │ HTTPS (内网)           │ HTTPS (内网)
         │ X-Service-Auth          │ X-Service-Auth         │ X-Service-Auth
         └───────────┬─────────────┴────────────────────────┘
                     ▼
        ┌──────────────────────────────────────┐
        │  magic-signer 服务进程               │
        │  - 持有 OIDC RSA 私钥                │
        │  - 持有 Magic APIKey                 │
        │  - JWT cache (in-memory)             │
        │  - 地址 cache (in-memory)            │
        └────────────────┬─────────────────────┘
                         │ HTTPS
                         ▼
            ┌─────────────────────────────┐
            │   Magic TEE Express (SaaS)  │
            └─────────────────────────────┘
```

部署粒度：
- **每个环境一份独立部署**：prod 一份 + test 一份（详见 §3 环境隔离硬约束）
- 服务多副本无状态：缓存丢失不影响正确性

---

## 2. 服务暴露的能力（HTTP 接口）

只对内网调用方提供 3 个业务接口 + 2 个运维接口：

| Method | Path                    | 用途                                     | 鉴权               |
| ------ | ----------------------- | ---------------------------------------- | ------------------ |
| POST   | `/v1/wallet/address`    | 查 / 创建 user 对应的 Magic EOA 地址     | X-Service-Auth     |
| POST   | `/v1/wallet/sign`       | 用 user 私钥对 32 字节 digest 签名       | X-Service-Auth     |
| GET    | `/healthz`              | 健康检查                                 | 不鉴权             |
| GET    | `/metrics`              | Prometheus 指标                          | X-Service-Auth     |
| GET    | `/version`              | git_sha + build_time + env               | 不鉴权             |

详细请求 / 响应格式见 §7。

---

## 3. 硬约束

### 3.1 环境严格隔离（最重要的安全约束）

正式环境与测试环境必须用**完全不同的 Magic App + 完全不同的 RSA 私钥**，确保同一 `user_id` 在两个环境调用得到的地址**不同**。

**实现方式：每个环境独立部署一份 binary**，配置通过环境变量注入，不共享。

```
┌──────────────────────────────────────────────────────────────┐
│  生产部署                                                     │
│    APP_ENV                = "prod"                            │
│    MAGIC_API_KEY          = pk_live_***                       │
│    MAGIC_OIDC_PROVIDER_ID = <prod 的 UUID>                    │
│    OIDC_PRIVATE_KEY_PEM   = <prod RSA 私钥 PEM 内容>          │
│    OIDC_ISSUER            = https://www.oddfi.io/             │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  测试部署                                                     │
│    APP_ENV                = "test"                            │
│    MAGIC_API_KEY          = pk_test_***                       │
│    MAGIC_OIDC_PROVIDER_ID = <test 的 UUID, 与 prod 不同>      │
│    OIDC_PRIVATE_KEY_PEM   = <test RSA 私钥 PEM 内容>          │
│    OIDC_ISSUER            = https://test.oddfi.io/            │
└──────────────────────────────────────────────────────────────┘
```

**启动时的强制校验**（任何一项失败 → 进程立即退出 code=1）：
- `APP_ENV` 必须存在且 ∈ `{"prod", "test"}`
- `MAGIC_API_KEY` 必须存在
  - 当 `APP_ENV=prod` 时，`MAGIC_API_KEY` 必须以 `pk_live_` 开头
  - 当 `APP_ENV=test` 时，`MAGIC_API_KEY` 必须以 `pk_test_` 开头
  - **这是为了在运维层面防止把测试 key 装到生产部署**
- `OIDC_PRIVATE_KEY_PEM` 必须能解析为 RSA ≥ 2048 bit
- 至少有 1 个 caller token 注册

**JWT / 地址 cache 的 key 强制加 env 前缀**：缓存键 = `<env>:<userID>`，作为代码层的双重防御，即使配置错乱也不会跨环境混缓存。

### 3.2 配置只走环境变量

**所有配置项通过环境变量注入**，不读 yaml/json 配置文件。

- 部署时由 K8s Secret + ConfigMap 注入到 Pod 的 `env`
- 本地开发可通过 `.env` 文件（用 `joho/godotenv`）但**生产严禁使用 .env**
- 配置加载在 main.go 一次性完成，加载失败立即退出

环境变量完整清单见 §5。

### 3.3 仅内网可达

- 监听地址默认 `0.0.0.0:8443`（容器内绑全部接口），由 K8s Service `ClusterIP` 限定网络可见性
- **禁止暴露**到 K8s LoadBalancer / Ingress / NodePort 到公网
- 通过 NetworkPolicy 限定只允许已知 caller Pod 访问

### 3.4 调用方鉴权

每个 HTTP 业务请求必须带 `X-Service-Auth: Bearer <token>`。

- 服务端通过 env vars 加载 caller token 表：`CALLER_TOKEN_<NAME>=<token_sha256_hex>`
  - 例：`CALLER_TOKEN_WEB_API=abc123...` （value 是 token 明文的 sha256 hex）
- 服务端把请求里的 token 做 sha256 后用 `subtle.ConstantTimeCompare` 与配置比对
- 命中的 caller name 记入日志的 `caller` 字段
- 默认每个 caller 同时拥有 `address` 和 `sign` 两种 op 权限；如需限制：`CALLER_OPS_<NAME>=address,sign`

### 3.5 强制结构化日志（每个请求一条）

JSON 单行，必带字段：

```json
{
  "ts": "2026-05-21T14:23:45.123456789Z",
  "level": "info",
  "svc": "magic-signer",
  "env": "prod",
  "request_id": "req_a1b2c3d4e5",
  "caller": "web-api",
  "caller_ip": "10.0.1.42",
  "op": "sign",
  "user_id": "1234567890",
  "digest_prefix": "0xabcd...",
  "magic_latency_ms": 87,
  "duration_ms": 92,
  "status": 200,
  "cached": false,
  "result": "success",
  "error_code": ""
}
```

**严禁打到日志的内容**：完整 JWT、完整签名、Magic APIKey、X-Service-Auth token。
**允许打**：user_id（业务侧已经知道）、digest（本身是 hash）、Magic 返回的 status code、caller IP、request_id。

每条日志直接到 stdout，由容器编排系统负责采集。

### 3.6 禁忌

- ❌ 监听 0.0.0.0:* 并暴露到公网
- ❌ 把任何 token / 私钥 / APIKey 写进代码、写进 Git、写进日志
- ❌ 一个进程内同时跑 prod 和 test 模式
- ❌ panic 不 recover（任何 panic 必须 fatal log + exit）
- ❌ 客户端 SDK 内做地址缓存（避免与服务端缓存不一致；服务端已经缓了）

---

## 4. 代码布局（仓库结构）

```
D:\everything_finance\magic_client\          (= github.com/Crypto-Barrett/oddfi-magic-client)
│
├── go.mod                                    module github.com/Crypto-Barrett/oddfi-magic-client
├── go.sum
├── README.md                                 部署 + 接入说明（含代码示例）
├── DESIGN.md                                 本文档
├── Dockerfile
├── .gitignore
├── .env.example                              本地开发模板（生产严禁用）
│
├── cmd/
│   └── server/
│       └── main.go                           启动入口 + 严格 env 校验
│
├── internal/                                 仅服务端使用，不对外暴露
│   ├── config/
│   │   ├── config.go                         从 env vars 加载所有配置
│   │   ├── config_test.go
│   │   └── env_strict.go                     APP_ENV + APIKey 前缀的严格校验
│   │
│   ├── auth/
│   │   ├── auth.go                           X-Service-Auth 中间件
│   │   ├── table.go                          caller token 表（从 env 加载）
│   │   └── auth_test.go
│   │
│   ├── handler/
│   │   ├── address.go                        POST /v1/wallet/address
│   │   ├── sign.go                           POST /v1/wallet/sign
│   │   ├── health.go                         GET /healthz
│   │   ├── version.go                        GET /version
│   │   ├── errors.go                         错误码 + HTTP 映射
│   │   ├── request_id.go                     request_id 中间件
│   │   ├── logging.go                        access log 中间件
│   │   └── *_test.go
│   │
│   ├── jwt/
│   │   ├── minter.go                         OIDC JWT 现场签发 (RS256)
│   │   ├── cache.go                          JWT 缓存
│   │   └── *_test.go
│   │
│   ├── magicapi/
│   │   ├── client.go                         调 Magic TEE 的 HTTP client
│   │   ├── wallet.go                         POST /v1/wallet
│   │   ├── sign.go                           POST /v1/wallet/sign/data
│   │   ├── retry.go                          重试 3 次，指数退避
│   │   ├── headers.go                        6 个必带 header 组装
│   │   └── *_test.go
│   │
│   ├── addrcache/
│   │   ├── cache.go                          地址 LRU 缓存
│   │   └── cache_test.go
│   │
│   ├── healthcheck/
│   │   └── monitor.go                        后台 ping Magic
│   │
│   └── metrics/
│       └── metrics.go                        Prometheus collectors
│
├── client/                                   ★ 给调用方 import 的 SDK
│   ├── client.go                             Client 结构 + 构造
│   ├── config.go                             Config + 默认值
│   ├── address.go                            WalletAddress 实现
│   ├── sign.go                               SignDigest 实现
│   ├── types.go                              Signature / Signer interface
│   ├── errors.go                             错误哨兵
│   ├── doc.go                                包级 godoc
│   └── client_test.go                        ★ 单测：用 httptest 模拟服务端
│
├── integration_test/                         ★ 端到端：起服务 + client 调
│   ├── address_test.go                       create address 测试
│   ├── sign_test.go                          签名测试
│   ├── env_isolation_test.go                 prod/test 环境隔离测试
│   └── helpers.go                            起服务的辅助函数（in-process）
│
├── examples/
│   ├── caller/main.go                        最小调用示例（给文档用）
│   └── staging-smoke/main.go                 staging 实测脚本
│
└── deploy/
    ├── k8s-prod.yaml
    ├── k8s-test.yaml
    └── grafana-dashboard.json
```

**关键点**：
- `internal/` 下的子包**不对外可导入**（Go internal 规则）
- `client/` 是**唯一对外暴露的 Go 包**，调用方通过 `go get github.com/Crypto-Barrett/oddfi-magic-client/client` 拉
- `integration_test/` 用一个独立的目录而非 `_test.go` 文件，方便 CI 单独跑（标签 `-tags=integration`）

---

## 5. 环境变量完整清单

### 5.1 服务端必填

| 变量名                        | 类型     | 用途                                                              | 校验            |
| ----------------------------- | -------- | ----------------------------------------------------------------- | --------------- |
| `APP_ENV`                     | string   | 部署环境标识                                                      | `prod` / `test` |
| `LISTEN_ADDR`                 | string   | HTTP 监听地址                                                     | 默认 `:8443`    |
| `MAGIC_API_KEY`               | string   | X-Magic-API-Key                                                   | env=prod 需 `pk_live_` 开头；env=test 需 `pk_test_` 开头 |
| `MAGIC_OIDC_PROVIDER_ID`      | string   | X-OIDC-Provider-ID                                                | UUID 形式       |
| `MAGIC_REFERRER`              | string   | X-Magic-Referrer                                                  | URL             |
| `OIDC_PRIVATE_KEY_PEM`        | string   | OIDC 签发 RSA 私钥的 **PEM 内容**（不是路径）                     | PKCS8, ≥ 2048b  |
| `OIDC_KID`                    | string   | JWT header.kid，与 JWKS 一致                                      | 非空            |
| `OIDC_ISSUER`                 | string   | JWT iss                                                           | https URL       |
| `OIDC_AUDIENCE`               | string   | JWT aud                                                           | 非空            |

### 5.2 服务端选填

| 变量名                        | 类型      | 默认                                  | 用途                                  |
| ----------------------------- | --------- | ------------------------------------- | ------------------------------------- |
| `MAGIC_CHAIN`                 | string    | `ETH`                                 | X-Magic-Chain                          |
| `MAGIC_ENDPOINT`              | string    | `https://tee.express.magiclabs.com`   | Magic API 根                          |
| `MAGIC_TIMEOUT`               | duration  | `5s`                                  | 单次 Magic 调用超时                   |
| `MAGIC_MAX_RETRIES`           | int       | `3`                                   | Magic 调用重试次数                    |
| `MAGIC_RETRY_BASE_DELAY`      | duration  | `200ms`                               | 重试退避基准                          |
| `JWT_LIFETIME`                | duration  | `30m`                                 | 单次 JWT 有效期                       |
| `JWT_REFRESH_SAFETY`          | duration  | `1m`                                  | JWT 缓存提前续签的安全窗口            |
| `ADDR_CACHE_TTL`              | duration  | `24h`                                 | 地址缓存 TTL                          |
| `ADDR_CACHE_MAX`              | int       | `100000`                              | 地址缓存最大条目（LRU 淘汰）          |
| `HEALTH_CHECK_INTERVAL`       | duration  | `30s`                                 | 后台 Magic ping 周期                  |
| `LOG_LEVEL`                   | string    | `info`                                | debug / info / warn / error           |

### 5.3 服务端 caller 鉴权配置

变量名前缀 `CALLER_TOKEN_<NAME>`，值是 caller token 的 **sha256 hex**（不是明文）。

`<NAME>` 大写，下划线分隔（如 `WEB_API`、`ADMIN_SVC`），实际 caller 名称在日志里以小写连字符形式出现（`web-api`、`admin-svc`）。

| 变量名                            | 类型     | 用途                                  |
| --------------------------------- | -------- | ------------------------------------- |
| `CALLER_TOKEN_WEB_API`            | sha256   | web-api 服务的 token sha256           |
| `CALLER_TOKEN_ADMIN_SVC`          | sha256   | admin-svc 服务的 token sha256         |
| `CALLER_TOKEN_BATCH_JOB`          | sha256   | batch-job 服务的 token sha256         |
| `CALLER_OPS_WEB_API`              | csv      | 选填，限定 op，默认 `address,sign`    |
| `CALLER_OPS_ADMIN_SVC`            | csv      | 选填，例如只给 `address`              |

启动时扫描所有 `CALLER_TOKEN_*` 前缀，构造 token 表。**没有任何 CALLER_TOKEN_** 时启动失败。

### 5.4 .env.example

```env
# Required
APP_ENV=test
LISTEN_ADDR=:8443
MAGIC_API_KEY=pk_test_xxxxxxxx
MAGIC_OIDC_PROVIDER_ID=852163cb-5a5c-4ca9-923d-49eec471cc70
MAGIC_REFERRER=https://www.oddfi.io
OIDC_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----
MIIEvQI...
-----END PRIVATE KEY-----"
OIDC_KID=uniq-123
OIDC_ISSUER=https://www.oddfi.io/
OIDC_AUDIENCE=oddfi-app

# Optional (defaults shown)
# MAGIC_CHAIN=ETH
# MAGIC_ENDPOINT=https://tee.express.magiclabs.com
# MAGIC_TIMEOUT=5s
# MAGIC_MAX_RETRIES=3
# JWT_LIFETIME=30m
# ADDR_CACHE_TTL=24h
# ADDR_CACHE_MAX=100000

# Callers (sha256 of token hex)
CALLER_TOKEN_WEB_API=abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abcd
CALLER_TOKEN_ADMIN_SVC=def456def456def456def456def456def456def456def456def456def456defa
```

---

## 6. 服务端启动流程（`cmd/server/main.go`）

```go
package main

import (
    "context"
    "log/slog"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/Crypto-Barrett/oddfi-magic-client/internal/auth"
    "github.com/Crypto-Barrett/oddfi-magic-client/internal/config"
    "github.com/Crypto-Barrett/oddfi-magic-client/internal/handler"
    "github.com/Crypto-Barrett/oddfi-magic-client/internal/healthcheck"
    "github.com/Crypto-Barrett/oddfi-magic-client/internal/jwt"
    "github.com/Crypto-Barrett/oddfi-magic-client/internal/magicapi"
    "github.com/Crypto-Barrett/oddfi-magic-client/internal/metrics"
)

func main() {
    log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
    slog.SetDefault(log)

    // 1. 加载并严格校验配置（任何错误 fatal exit）
    cfg, err := config.LoadFromEnv()
    if err != nil {
        log.Error("config load failed", "err", err.Error())
        os.Exit(1)
    }

    // 2. 启动日志（结构化，强制带 env / git_sha）
    log.Info("magic-signer starting",
        "env",                      cfg.Env,
        "listen",                   cfg.ListenAddr,
        "git_sha",                  buildGitSHA,
        "oidc_provider_id_prefix",  cfg.MagicAPI.OIDCProviderID[:8],
        "magic_api_key_prefix",     cfg.MagicAPI.APIKey[:10],   // 只打 prefix
        "callers",                  cfg.AuthTable.CallerNames(),
    )

    // 3. 构造 JWT minter + cache
    jwtMinter := jwt.NewMinter(cfg.OIDC.PrivateKey, cfg.OIDC)
    jwtCache := jwt.NewCache(jwtMinter, cfg.JWTLifetime, cfg.JWTRefreshSafety)

    // 4. 构造 Magic API client
    magicCli := magicapi.New(cfg.MagicAPI)

    // 5. 地址 cache（key 加 env 前缀做双重防御）
    addrCache := addrcache.New(cfg.Env, cfg.AddressCacheTTL, cfg.AddressCacheMax)

    // 6. Prometheus metrics
    metricsReg := metrics.NewRegistry(cfg.Env)

    // 7. 后台健康检查（用一个特殊 user_id 探测）
    health := healthcheck.Start(magicCli, jwtCache, cfg.HealthCheckInterval, cfg.Env)

    // 8. 装路由
    mux := handler.NewRouter(handler.Deps{
        Env:       cfg.Env,
        AuthTable: cfg.AuthTable,
        JWTCache:  jwtCache,
        MagicCli:  magicCli,
        AddrCache: addrCache,
        Metrics:   metricsReg,
        Health:    health,
        Log:       log,
    })

    // 9. 启动 HTTP server
    srv := &http.Server{
        Addr:              cfg.ListenAddr,
        Handler:           mux,
        ReadHeaderTimeout: 5 * time.Second,
        ReadTimeout:       10 * time.Second,
        WriteTimeout:      30 * time.Second,
        IdleTimeout:       120 * time.Second,
    }

    // 10. graceful shutdown
    sigCh := make(chan os.Signal, 1)
    signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
    go func() {
        <-sigCh
        ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
        defer cancel()
        _ = srv.Shutdown(ctx)
    }()

    log.Info("listening", "addr", cfg.ListenAddr)
    if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
        log.Error("server failed", "err", err.Error())
        os.Exit(1)
    }
}
```

---

## 7. HTTP API 详细规范

### 7.1 `POST /v1/wallet/address`

**Headers**:
- `X-Service-Auth: Bearer <token>` (必需)
- `X-Request-ID: <id>` (选填，服务自动生成)
- `Content-Type: application/json`

**Request body**:
```json
{ "user_id": "1234567890" }
```

**Response 200**:
```json
{
  "address":  "0x1234567890123456789012345678901234567890",
  "user_id":  "1234567890",
  "env":      "prod",
  "cached":   true,
  "request_id": "req_a1b2c3d4e5"
}
```

**Error response**:
```json
{
  "error_code":    "USER_ID_REQUIRED",
  "error_message": "user_id must be non-empty",
  "request_id":    "req_a1b2c3d4e5",
  "env":           "prod"
}
```

### 7.2 `POST /v1/wallet/sign`

**Headers**: 同上

**Request body**:
```json
{
  "user_id": "1234567890",
  "digest":  "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
}
```

`digest` 必须是 `0x` + 64 hex 字符（= 32 字节）。

**Response 200**:
```json
{
  "signature":  "0xrrrr...ssss...vv",
  "user_id":    "1234567890",
  "address":    "0x1234567890123456789012345678901234567890",
  "env":        "prod",
  "request_id": "req_a1b2c3d4e5"
}
```

`signature` 是 `0x` + 130 hex 字符（= 65 字节 r ‖ s ‖ v，v ∈ {27, 28}）。

### 7.3 错误码表

| HTTP | error_code              | 含义                                                  |
| ---- | ----------------------- | ----------------------------------------------------- |
| 400  | `USER_ID_REQUIRED`      | user_id 字段缺失或为空                                |
| 400  | `USER_ID_TOO_LONG`      | user_id 超过 128 字符                                 |
| 400  | `DIGEST_REQUIRED`       | digest 字段缺失                                       |
| 400  | `DIGEST_FORMAT`         | digest 不是 0x + 64 hex 格式                          |
| 401  | `UNAUTHORIZED`          | 缺 X-Service-Auth 或 token 无效                       |
| 403  | `OP_NOT_ALLOWED`        | caller 没有此操作权限                                 |
| 502  | `MAGIC_UNAUTHORIZED`    | Magic 拒签 JWT（4xx）                                 |
| 502  | `MAGIC_API_ERROR`       | Magic 业务错误                                        |
| 503  | `MAGIC_NETWORK_ERROR`   | Magic 网络错误 / 5xx 重试耗尽                         |
| 500  | `INTERNAL_ERROR`        | 服务内部错误（panic recover 等）                      |

### 7.4 `GET /healthz`

不鉴权。

**Response 200**:
```json
{
  "status":              "ok",
  "env":                 "prod",
  "uptime_seconds":      123456,
  "git_sha":             "abc123",
  "magic_reachable":     true,
  "last_magic_check_at": "2026-05-21T14:20:00Z"
}
```

### 7.5 `GET /version`

不鉴权。

**Response 200**:
```json
{
  "git_sha":    "abc123",
  "build_time": "2026-05-21T10:00:00Z",
  "env":        "prod",
  "go_version": "go1.22.0"
}
```

### 7.6 `GET /metrics`

需鉴权。返回 Prometheus 格式：

```
magic_signer_requests_total{caller="web-api",op="address",status="200",env="prod"} 1234
magic_signer_request_duration_seconds_bucket{caller="web-api",op="sign",env="prod",le="0.1"} 1100
magic_signer_magic_api_duration_seconds_bucket{op="sign",env="prod",le="0.5"} 1200
magic_signer_magic_api_errors_total{error_code="MAGIC_UNAUTHORIZED",env="prod"} 0
magic_signer_jwt_cache_hits_total{env="prod"} 5000
magic_signer_jwt_cache_misses_total{env="prod"} 50
magic_signer_address_cache_hits_total{env="prod"} 12000
magic_signer_address_cache_misses_total{env="prod"} 30
magic_signer_active_users{env="prod"} 25
```

---

## 8. Client SDK（`client/` 包）详细规范

### 8.1 公开 API

```go
package client

import (
    "context"
    "log/slog"
    "net/http"
    "time"

    "github.com/ethereum/go-ethereum/common"
)

// Config 是 Client 的入参，调用方必须填 BaseURL + AuthToken。
type Config struct {
    BaseURL    string        // 必填，e.g. "https://magic-signer.svc.cluster.local"
    AuthToken  string        // 必填，明文 token（不是 sha256），对应服务端注册的某个 caller
    Timeout    time.Duration // 选填，单次请求超时，默认 10s
    Logger     *slog.Logger  // 选填，默认 slog.Default()
    HTTPClient *http.Client  // 选填，默认 &http.Client{Timeout: Timeout}
    UserAgent  string        // 选填，默认 "magic-signer-client/<version>"
}

// Validate 检查必填字段。
func (c *Config) Validate() error

// Client 是 magic-signer 服务的 HTTP client。线程安全，应该进程级单例。
type Client struct { /* unexported */ }

// New 构造 Client。
func New(cfg Config) (*Client, error)

// ─── Signature 类型 ───
// 65 字节 secp256k1 签名 r(32) || s(32) || v(1)，v ∈ {27, 28}。
type Signature [65]byte

// ─── Signer 接口（让调用方能做 mock）───
type Signer interface {
    WalletAddress(ctx context.Context, userID string) (common.Address, error)
    SignDigest(ctx context.Context, userID string, digest [32]byte) (Signature, error)
}
var _ Signer = (*Client)(nil)

// ─── 方法 ───
// WalletAddress 查询 user_id 对应的 Magic EOA 地址。
// 服务端会做缓存；client 不缓存（避免数据不一致）。
func (c *Client) WalletAddress(ctx context.Context, userID string) (common.Address, error)

// SignDigest 用 user_id 对应的私钥对 32 字节 digest 签名。
// 返回 65 字节签名（v ∈ {27, 28}）。
func (c *Client) SignDigest(ctx context.Context, userID string, digest [32]byte) (Signature, error)

// ─── 错误哨兵 ───
var (
    ErrInvalidConfig   = errors.New("magic-signer/client: invalid config")
    ErrUnauthorized    = errors.New("magic-signer/client: 401 from service")
    ErrOpNotAllowed    = errors.New("magic-signer/client: 403 from service")
    ErrBadRequest      = errors.New("magic-signer/client: 400 from service")
    ErrMagicUpstream   = errors.New("magic-signer/client: magic upstream error (502)")
    ErrMagicNetwork    = errors.New("magic-signer/client: magic network error (503)")
    ErrServerInternal  = errors.New("magic-signer/client: service internal error (500)")
    ErrNetwork         = errors.New("magic-signer/client: network failure to service")
)

// ─── ServiceError ───
// 详细错误结构，wrap 上面的哨兵之一。调用方可以用 errors.As 取出来。
type ServiceError struct {
    HTTPStatus int
    ErrorCode  string
    Message    string
    RequestID  string
    Env        string  // 服务端返回的环境标识，方便调用方做交叉校验
}
func (e *ServiceError) Error() string
func (e *ServiceError) Unwrap() error  // 按 HTTPStatus 返回对应哨兵
```

### 8.2 Client 内部行为

- **不做地址缓存**（服务端已经做了）
- **不做重试**（服务端已经处理了对 Magic 的重试；客户端再重试会重复请求，但是这是幂等操作所以不会出错——为了简单先不做，需要时再加）
- 例外：网络层失败（连接 reset / EOF / DNS）可以重试 1 次，间隔 100ms
- 每个请求自动生成 `X-Request-ID`（如果 ctx 里有 trace id 优先用）
- 每个请求自动加 `X-Service-Auth: Bearer <AuthToken>`
- 响应非 2xx → 解析 error_code + message → 包成 `*ServiceError`，按 HTTPStatus 选择 unwrap 哨兵
- HTTP timeout 默认 10s，给服务端留够时间做 Magic 的 3 次重试

### 8.3 调用方使用示例

```go
package main

import (
    "context"
    "fmt"
    "log/slog"
    "os"
    "time"

    "github.com/Crypto-Barrett/oddfi-magic-client/client"
)

func main() {
    cli, err := client.New(client.Config{
        BaseURL:   os.Getenv("MAGIC_SIGNER_URL"),
        AuthToken: os.Getenv("MAGIC_SIGNER_TOKEN"),
        Timeout:   10 * time.Second,
        Logger:    slog.Default(),
    })
    if err != nil { panic(err) }

    ctx := context.Background()

    addr, err := cli.WalletAddress(ctx, "user-1234")
    if err != nil { panic(err) }
    fmt.Println("address:", addr.Hex())

    var digest [32]byte
    copy(digest[:], []byte("32-byte digest goes right here..."))
    sig, err := cli.SignDigest(ctx, "user-1234", digest)
    if err != nil { panic(err) }
    fmt.Printf("signature: 0x%x\n", sig)
}
```

---

## 9. 测试要求（含单测 + 集成测试）

### 9.1 服务端 internal 单测

每个 `internal/*` 子包配对的 `*_test.go`，覆盖率目标 ≥ 85%。

- `internal/config/config_test.go`：
  - 加载完整 env vars → 校验通过
  - 缺 `APP_ENV` → 报错
  - `APP_ENV=invalid` → 报错
  - prod + `pk_test_*` 组合 → 报错
  - test + `pk_live_*` 组合 → 报错
  - RSA key 长度 1024 → 报错
  - 没有任何 CALLER_TOKEN_* → 报错
- `internal/jwt/minter_test.go`：JWT 签出来能被公钥校验，claims 字段齐
- `internal/jwt/cache_test.go`：命中缓存不重签，过期前重签，并发同 userID singleflight
- `internal/magicapi/*_test.go`：用 `httptest.NewServer` 模拟 Magic TEE
  - 200 路径
  - 401/403 → 返 ErrUnauthorized，不重试
  - 429 with Retry-After → 等待后重试
  - 502/503/网络错误 → 重试 3 次后返 ErrNetwork
  - 返回畸形 JSON → ErrInvalidResponse
- `internal/auth/auth_test.go`：
  - 缺 header → 401
  - 错 token → 401
  - 对的 token 但 op 不在白名单 → 403
  - 对的 token + op 允许 → context 注入 caller 信息
- `internal/handler/*_test.go`：
  - address handler 正常路径
  - sign handler 正常路径
  - digest 格式错 → 400 `DIGEST_FORMAT`
  - user_id 空 → 400 `USER_ID_REQUIRED`
  - 检查响应里的 `env` 字段与服务配置一致

### 9.2 Client SDK 单测（`client/client_test.go`）

用 `httptest.NewServer` **mock 服务端**：

```go
func TestClientWalletAddress_Success(t *testing.T) {
    srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // 断言请求带正确的 X-Service-Auth
        if r.Header.Get("X-Service-Auth") != "Bearer test-token" {
            t.Fatalf("missing auth header")
        }
        // 断言路径
        if r.URL.Path != "/v1/wallet/address" {
            t.Fatalf("wrong path: %s", r.URL.Path)
        }
        // 返成功
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(map[string]any{
            "address": "0x1234567890123456789012345678901234567890",
            "user_id": "test-user",
            "env":     "test",
            "cached":  false,
        })
    }))
    defer srv.Close()

    cli, err := client.New(client.Config{BaseURL: srv.URL, AuthToken: "test-token"})
    if err != nil { t.Fatal(err) }

    addr, err := cli.WalletAddress(context.Background(), "test-user")
    if err != nil { t.Fatal(err) }
    if addr.Hex() != "0x1234567890123456789012345678901234567890" {
        t.Fatalf("got %s", addr.Hex())
    }
}

func TestClientWalletAddress_Unauthorized(t *testing.T) { /* 服务返 401 → 断言 ErrUnauthorized */ }
func TestClientWalletAddress_BadRequest(t *testing.T)   { /* 服务返 400 → 断言 ErrBadRequest */ }
func TestClientWalletAddress_Magic5xx(t *testing.T)      { /* 服务返 503 → 断言 ErrMagicNetwork */ }
func TestClientWalletAddress_NetworkFail(t *testing.T)   { /* server.Close() → client 该 ErrNetwork */ }

func TestClientSignDigest_Success(t *testing.T)          { /* 类似 */ }
func TestClientSignDigest_DigestFormat(t *testing.T)     { /* 服务返 400 */ }

func TestClient_RequestIDPropagation(t *testing.T) {
    // 验证 client 自动生成 X-Request-ID 并发到服务端
}

func TestClient_TimeoutEnforced(t *testing.T) {
    // 服务端故意 hang 20s，client timeout=2s → ctx.DeadlineExceeded
}
```

### 9.3 集成测试（`integration_test/`）

**端到端：起服务 → 用 client 调 → 验证**。

`integration_test/helpers.go`：

```go
// startTestServer 启动一个 in-process magic-signer 服务，连接到 fakeMagic（伪 Magic TEE）。
// 返回 base URL 和清理函数。
func startTestServer(t *testing.T, env string) (baseURL string, cleanup func()) {
    // 1. 生成一对临时 RSA key
    rsaKey, _ := rsa.GenerateKey(rand.Reader, 2048)
    pemBlock := &pem.Block{Type: "PRIVATE KEY", Bytes: mustMarshalPKCS8(rsaKey)}
    pemBytes := pem.EncodeToMemory(pemBlock)

    // 2. 起 fakeMagic（伪 Magic TEE）—— 用 httptest.NewServer
    fakeMagic := newFakeMagicServer(t, env, rsaKey)  // 见下

    // 3. 准备 env vars
    os.Setenv("APP_ENV", env)
    os.Setenv("LISTEN_ADDR", "127.0.0.1:0")  // 让系统分配端口
    if env == "prod" {
        os.Setenv("MAGIC_API_KEY", "pk_live_integration_test")
    } else {
        os.Setenv("MAGIC_API_KEY", "pk_test_integration_test")
    }
    os.Setenv("MAGIC_OIDC_PROVIDER_ID", "11111111-1111-1111-1111-111111111111")
    os.Setenv("MAGIC_REFERRER", "https://test.oddfi.io")
    os.Setenv("MAGIC_ENDPOINT", fakeMagic.URL)
    os.Setenv("OIDC_PRIVATE_KEY_PEM", string(pemBytes))
    os.Setenv("OIDC_KID", "integration-test-kid")
    os.Setenv("OIDC_ISSUER", "https://"+env+".oddfi.io/")
    os.Setenv("OIDC_AUDIENCE", "oddfi-app")

    tokenSHA := sha256Hex("integration-token")
    os.Setenv("CALLER_TOKEN_TEST_CALLER", tokenSHA)

    // 4. 调 main() 同样的启动逻辑（重构出 buildServer 函数）
    srv, addr := buildAndStart(t)
    t.Cleanup(func() {
        srv.Shutdown(context.Background())
        fakeMagic.Close()
        // unset env vars
    })
    return "http://" + addr, func() {}
}

// fakeMagicServer 模拟 Magic TEE 端点：
//   - POST /v1/wallet 返回一个跟 (env, user_id) 确定相关的地址
//   - POST /v1/wallet/sign/data 用 rsaKey 派生出来的 ECDSA key 实际签 digest
//
// 关键点：同一个 user_id 在 env=prod 和 env=test 必须返回不同地址。
//        实现方式：把 env 字符串混进 keccak256(env + ":" + user_id) 当 seed。
func newFakeMagicServer(t *testing.T, env string, _ *rsa.PrivateKey) *httptest.Server {
    return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // 解析 JWT 拿到 sub
        token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
        sub := parseSubFromJWT(t, token)

        switch r.URL.Path {
        case "/v1/wallet":
            // 派生确定性 ECDSA key
            seed := crypto.Keccak256([]byte(env + ":" + sub))
            ecdsaKey, _ := crypto.ToECDSA(seed)
            addr := crypto.PubkeyToAddress(ecdsaKey.PublicKey)
            json.NewEncoder(w).Encode(map[string]string{
                "public_address": addr.Hex(),
            })
        case "/v1/wallet/sign/data":
            var req struct{ RawDataHash string `json:"raw_data_hash"` }
            json.NewDecoder(r.Body).Decode(&req)
            digest := common.FromHex(req.RawDataHash)

            seed := crypto.Keccak256([]byte(env + ":" + sub))
            ecdsaKey, _ := crypto.ToECDSA(seed)
            sig, _ := crypto.Sign(digest, ecdsaKey)
            // crypto.Sign 返 v ∈ {0, 1}（Magic TEE 也是返这个）
            r, s, v := sig[:32], sig[32:64], sig[64]
            json.NewEncoder(w).Encode(map[string]string{
                "r": "0x" + hex.EncodeToString(r),
                "s": "0x" + hex.EncodeToString(s),
                "v": fmt.Sprint(v),
            })
        }
    }))
}
```

#### 测试用例

`integration_test/address_test.go`：

```go
func TestAddress_CreateAndCache(t *testing.T) {
    baseURL, _ := startTestServer(t, "test")
    cli, _ := client.New(client.Config{BaseURL: baseURL, AuthToken: "integration-token"})

    addr1, err := cli.WalletAddress(context.Background(), "user-12345")
    require.NoError(t, err)
    require.True(t, common.IsHexAddress(addr1.Hex()))

    // 第二次调，服务端命中缓存
    addr2, err := cli.WalletAddress(context.Background(), "user-12345")
    require.NoError(t, err)
    require.Equal(t, addr1, addr2)  // 同一 user 同一 env，地址必须一样
}

func TestAddress_DifferentUsersDifferentAddresses(t *testing.T) {
    baseURL, _ := startTestServer(t, "test")
    cli, _ := client.New(client.Config{BaseURL: baseURL, AuthToken: "integration-token"})

    a, _ := cli.WalletAddress(context.Background(), "user-1")
    b, _ := cli.WalletAddress(context.Background(), "user-2")
    require.NotEqual(t, a, b)
}

func TestAddress_Unauthorized(t *testing.T) {
    baseURL, _ := startTestServer(t, "test")
    cli, _ := client.New(client.Config{BaseURL: baseURL, AuthToken: "WRONG-TOKEN"})

    _, err := cli.WalletAddress(context.Background(), "user-1")
    require.ErrorIs(t, err, client.ErrUnauthorized)
}
```

`integration_test/sign_test.go`：

```go
func TestSign_VerifyRecoverable(t *testing.T) {
    baseURL, _ := startTestServer(t, "test")
    cli, _ := client.New(client.Config{BaseURL: baseURL, AuthToken: "integration-token"})

    // 1. 拿到 user 的地址
    addr, _ := cli.WalletAddress(context.Background(), "user-XYZ")

    // 2. 准备一个 digest
    var digest [32]byte
    copy(digest[:], crypto.Keccak256([]byte("some payload")))

    // 3. 签名
    sig, err := cli.SignDigest(context.Background(), "user-XYZ", digest)
    require.NoError(t, err)

    // 4. 验签：用 ECDSA recover 还原 pubkey，转地址，与 1 一致
    sigBytes := sig[:]
    if sigBytes[64] >= 27 {
        sigBytes[64] -= 27   // recover 需要 v ∈ {0, 1}
    }
    pubKey, err := crypto.SigToPub(digest[:], sigBytes)
    require.NoError(t, err)
    recovered := crypto.PubkeyToAddress(*pubKey)
    require.Equal(t, addr, recovered)   // ★ 签名能正确恢复出 user 地址
}

func TestSign_BadDigestFormat(t *testing.T) {
    baseURL, _ := startTestServer(t, "test")
    cli, _ := client.New(client.Config{BaseURL: baseURL, AuthToken: "integration-token"})

    // SDK 层 [32]byte 已经保证长度；这个测试直接 hit HTTP
    resp, _ := http.Post(baseURL+"/v1/wallet/sign", "application/json",
        bytes.NewBufferString(`{"user_id":"u","digest":"0x1234"}`))
    require.Equal(t, 400, resp.StatusCode)
}
```

`integration_test/env_isolation_test.go`（**最关键**）：

```go
// TestEnvIsolation_ProdAndTestProduceDifferentAddresses 是环境隔离的核心冒烟测试。
// 起两个服务（一个 prod 配置一个 test 配置），对同一 user_id 调地址接口，
// 必须返回不同地址。否则整个生产部署有安全问题。
func TestEnvIsolation_ProdAndTestProduceDifferentAddresses(t *testing.T) {
    prodURL, _ := startTestServer(t, "prod")
    testURL, _ := startTestServer(t, "test")

    prodCli, _ := client.New(client.Config{BaseURL: prodURL, AuthToken: "integration-token"})
    testCli, _ := client.New(client.Config{BaseURL: testURL, AuthToken: "integration-token"})

    addrProd, err := prodCli.WalletAddress(context.Background(), "same-user-id-99999")
    require.NoError(t, err)

    addrTest, err := testCli.WalletAddress(context.Background(), "same-user-id-99999")
    require.NoError(t, err)

    require.NotEqual(t, addrProd, addrTest, "BUG: same user_id produces same address across envs — environment isolation broken!")
}

// TestEnvIsolation_RefuseWrongAPIKey 验证 prod 配置 + test API key 必须启动失败。
func TestEnvIsolation_RefuseWrongAPIKey(t *testing.T) {
    os.Setenv("APP_ENV", "prod")
    os.Setenv("MAGIC_API_KEY", "pk_test_should_be_refused")   // ← 故意错配
    // ... 设置其他必填 env ...

    _, err := config.LoadFromEnv()
    require.Error(t, err)
    require.Contains(t, err.Error(), "pk_live_")
}
```

跑集成测试的命令：

```bash
cd D:\everything_finance\magic_client
go test ./integration_test/... -tags=integration -v
```

### 9.4 实测 staging Magic

`examples/staging-smoke/main.go`：用真实 staging Magic（pk_test_* + 真 OIDC 配置）跑：
1. 起本服务（in-process 也行）
2. 用 client SDK 调一遍 WalletAddress + SignDigest
3. 打印结果

用环境变量驱动：

```bash
export MAGIC_API_KEY=pk_test_<your_real_key>
export MAGIC_OIDC_PROVIDER_ID=<your_real_provider_id>
export MAGIC_REFERRER=https://www.oddfi.io
export OIDC_PRIVATE_KEY_PEM="$(cat ~/.rsa_test.pem)"
export OIDC_KID=uniq-123
export OIDC_ISSUER=https://www.oddfi.io/
export OIDC_AUDIENCE=oddfi-app
export TEST_USER_ID=staging-user-99999

go run ./examples/staging-smoke
```

### 9.5 测试运行 CI 集成

`.github/workflows/test.yml`（或对应 CI 系统）：

```yaml
- name: Unit tests
  run: go test ./... -race -coverprofile=coverage.out

- name: Integration tests
  run: go test ./integration_test/... -tags=integration -race -v

- name: Coverage gate
  run: |
    go tool cover -func=coverage.out | grep total | awk '{print $3}' | sed 's/%//' \
      | xargs -I {} sh -c 'if [ $(echo "{} < 85" | bc) -eq 1 ]; then exit 1; fi'
```

---

## 10. 部署（K8s 例）

每个环境的部署独立，env 变量来自 Secret + ConfigMap。

```yaml
# deploy/k8s-prod.yaml
apiVersion: v1
kind: Service
metadata:
  name: magic-signer
  namespace: prod
spec:
  type: ClusterIP   # ← 内网 only
  selector: { app: magic-signer }
  ports: [{ port: 443, targetPort: 8443 }]
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: magic-signer, namespace: prod }
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: server
          image: magic-signer:v1.0.0
          ports: [{ containerPort: 8443 }]
          env:
            - name: APP_ENV
              value: "prod"                 # ← 硬编码到 manifest
            - name: LISTEN_ADDR
              value: ":8443"
            - name: MAGIC_API_KEY
              valueFrom: { secretKeyRef: { name: magic-signer-secrets-prod, key: magic_api_key } }
            - name: MAGIC_OIDC_PROVIDER_ID
              valueFrom: { secretKeyRef: { name: magic-signer-secrets-prod, key: oidc_provider_id } }
            - name: OIDC_PRIVATE_KEY_PEM
              valueFrom: { secretKeyRef: { name: magic-signer-secrets-prod, key: oidc_private_key_pem } }
            - name: OIDC_KID
              value: "uniq-prod-2026"
            - name: OIDC_ISSUER
              value: "https://www.oddfi.io/"
            - name: OIDC_AUDIENCE
              value: "oddfi-app"
            - name: MAGIC_REFERRER
              value: "https://www.oddfi.io"
            - name: CALLER_TOKEN_WEB_API
              valueFrom: { secretKeyRef: { name: magic-signer-secrets-prod, key: caller_token_web_api } }
            - name: CALLER_TOKEN_ADMIN_SVC
              valueFrom: { secretKeyRef: { name: magic-signer-secrets-prod, key: caller_token_admin_svc } }
            - name: CALLER_TOKEN_BATCH_JOB
              valueFrom: { secretKeyRef: { name: magic-signer-secrets-prod, key: caller_token_batch_job } }
          livenessProbe:
            httpGet: { path: /healthz, port: 8443 }
            periodSeconds: 30
          readinessProbe:
            httpGet: { path: /healthz, port: 8443 }
            periodSeconds: 10
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: magic-signer, namespace: prod }
spec:
  podSelector: { matchLabels: { app: magic-signer } }
  ingress:
    - from:
        - podSelector: { matchLabels: { app: web-api } }
        - podSelector: { matchLabels: { app: admin-svc } }
        - podSelector: { matchLabels: { app: batch-job } }
```

---

## 11. 实现顺序（推荐 AI 实现 agent 按此顺序）

1. `go mod init github.com/Crypto-Barrett/oddfi-magic-client`，加依赖
2. `internal/config/`：从 env vars 加载 + 严格校验，含 prod/test + pk_live/pk_test 互斥校验
3. `internal/auth/`：bearer token 中间件 + caller table 从 env 加载
4. `internal/jwt/`：minter + cache（key 加 env 前缀）
5. `internal/magicapi/`：HTTP client + retry（3 次，指数退避）+ 6 header
6. `internal/addrcache/`：LRU + TTL（key 加 env 前缀）
7. `internal/handler/`：4 个 endpoint + 中间件 + 错误码映射
8. `cmd/server/main.go`：wiring + graceful shutdown
9. `client/`：完整的 client SDK（含错误哨兵 + ServiceError）
10. `integration_test/helpers.go`：startTestServer + fakeMagicServer
11. `integration_test/address_test.go` + `sign_test.go` + `env_isolation_test.go`
12. `client/client_test.go`：所有错误路径的 mock 单测
13. `examples/caller/main.go` + `examples/staging-smoke/main.go`
14. Dockerfile + deploy/k8s-*.yaml
15. Prometheus metrics
16. 跑 `go test ./... -race -cover` + `go test ./integration_test/... -tags=integration`
17. 用 staging Magic 跑 staging-smoke 通

---

## 12. 验收清单

服务端：
- [ ] `APP_ENV` 必须显式 `prod`/`test`，其他值 fatal exit
- [ ] `MAGIC_API_KEY` 与 `APP_ENV` 前缀不匹配 → fatal exit
- [ ] 没有任何 `CALLER_TOKEN_*` → fatal exit
- [ ] 启动日志包含 env / git_sha / oidc_provider_id 前缀 / api_key 前缀
- [ ] 每个 HTTP 请求一条 access log，含 env/caller/user_id/op/duration_ms/status/request_id
- [ ] 401 / 403 / 400 / 502 / 503 错误码语义正确
- [ ] 同一 user 第二次调 address 服务端 `cached: true`
- [ ] `/healthz` 返 200，包含 env 字段 + magic_reachable
- [ ] `/metrics` 暴露 ≥ 7 个核心指标，全部带 env label

Client SDK：
- [ ] `New` 缺 BaseURL / AuthToken → `ErrInvalidConfig`
- [ ] WalletAddress / SignDigest 实现 `Signer` interface
- [ ] 服务端 401 → client 返 `ErrUnauthorized`
- [ ] 服务端 503 → client 返 `ErrMagicNetwork`
- [ ] 服务端不可达 → `ErrNetwork`
- [ ] 每个请求自动加 `X-Service-Auth` + `X-Request-ID`

集成测试：
- [ ] `TestAddress_CreateAndCache` 通过
- [ ] `TestSign_VerifyRecoverable` 通过（签名能 ECDSA recover 回正确地址）
- [ ] **`TestEnvIsolation_ProdAndTestProduceDifferentAddresses` 通过** ← 这是核心
- [ ] `TestEnvIsolation_RefuseWrongAPIKey` 通过

覆盖率：
- [ ] `go test -cover` 总覆盖率 ≥ 85%
- [ ] `go vet ./...` 无 warning
- [ ] `golangci-lint run` 无 warning
