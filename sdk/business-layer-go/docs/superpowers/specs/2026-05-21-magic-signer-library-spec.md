# Magic Signer Library — 设计文档（已废弃 / SUPERSEDED）

> ⚠️ **本文档已被 [2026-05-21-magic-signer-service-spec.md](./2026-05-21-magic-signer-service-spec.md) 替代。**
>
> 用户决策（2026-05-21）：因为预计有 ≥ 3 个服务调用此签名能力，改为独立 HTTP 服务部署形态。
> 内部实现（JWT minter、Magic API client、缓存策略、重试逻辑）大致沿用本文档，但对外接口从 Go package 改为 HTTP API + 配套 client SDK。

**Date**: 2026-05-21
**Status**: 已废弃
**Author**: brainstorming with niall
**Reference impl**: `D:\everything_finance\magic_alchmey\internal\magic\client.go` + `internal\config\config.go`

---

## 0. 目标与适用范围

抽象一个独立的 Go 库 `oddfi-magic-client`，封装对 [Magic TEE Express](https://tee.express.magiclabs.com) 的所有调用，让上层（`contracts-business-layer` 的 relay 库、`oddfi-backend_dev/web-api` 的登录服务）通过 **user_id**（字符串）就能完成两件事：

1. 查询 / 创建该 user 对应的链上 EOA 地址
2. 让该 EOA 对任意 32 字节 digest 出 65 字节 secp256k1 签名（r ‖ s ‖ v，v ∈ {27, 28}）

库的实现参考 `magic_alchmey/internal/magic/client.go` 和 `magic_alchmey/internal/config/config.go`，但要做产品化改造（HA、缓存、可测、可观测、零内嵌 demo 代码）。

### 不在范围内

- ❌ Magic 客户端 JS SDK（这是 server-side 库）
- ❌ ERC-4337 / Smart Account 部署（属于交易路径，不在本库职责）
- ❌ EIP-7702 协议本身的封装（属于 relay 库职责）
- ❌ Magic 用户管理（注册、登录、登出 UI）—— 那是 SIWE/JWT 的事

---

## 1. 硬约束（实现时不可违反）

### 1.1 接口签名形式

- **公开 API 只接受 `userID string` 一个标识用户的入参**，不要求调用方传入任何 JWT、地址、密钥或会话凭证。其余参数都是该次操作的业务参数（如 digest）。
- 内部完成 OIDC JWT 现场签发、缓存、HTTP 调用、签名结果解析、错误重试。
- 库**不持久化** user_id ↔ address 的映射；缓存只在进程内内存里，TTL 可配。落库由上层（web-api 的 `user.magic_address` 列）负责。

### 1.2 OIDC JWT 模型（参考实现，必须保留）

参考 `magic_alchmey/internal/config/config.go:139-160` 的 `mockJWT`：

```
RSA private key (持有方: 你)  ──→ 现场签 RS256 JWT
                                  claims = {
                                    sub: <userID>,
                                    aud: <Audience>,        // 默认 "oddfi-app"
                                    iss: <Issuer>,          // 默认 "https://www.oddfi.io/"
                                    iat: now,
                                    exp: now + JWTLifetime, // 默认 30min
                                  }
                                  header.kid = <ConfigKid>  // 默认 "uniq-123"
                                  header.alg = "RS256"

JWKS (公钥, 已注册到 Magic 后台)  ──→ Magic 用此校验 JWT
```

**约束**：
- JWT 算法**必须** `RS256`，不能用 HS256 / EdDSA（Magic 后台只接受 RSA 公钥）
- `kid`、`iss`、`aud` 必须能配置，因为生产/测试可能用不同 OIDC provider
- JWT lifetime 必须远短于 RSA key 的 rotation 周期；默认 30 分钟够短到泄露后影响可控，又长到能命中缓存

### 1.3 Magic TEE Express 接口约束（实测要求）

**端点**（参考 `magic_alchmey/internal/magic/client.go:15`）：

| 操作       | Method | URL                                                       | Body                                  |
| ---------- | ------ | --------------------------------------------------------- | ------------------------------------- |
| 创建/查询钱包 | POST   | `https://tee.express.magiclabs.com/v1/wallet`             | `{}` （空对象）                       |
| 签名 digest   | POST   | `https://tee.express.magiclabs.com/v1/wallet/sign/data`   | `{"raw_data_hash": "0x..."}` (32 字节) |

**必带请求头**（参考 `client.go:50-58` 和 `client.go:111-119`）：

```
Authorization:        Bearer <现场签的 OIDC JWT>
X-Magic-API-Key:      <APIKey, 形如 pk_live_*** / pk_test_***>
X-OIDC-Provider-ID:   <OIDCProviderID, UUID 形式>
X-Magic-Chain:        ETH
X-Magic-Referrer:     <Referrer, e.g. https://www.oddfi.io>
Content-Type:         application/json
```

**响应格式约束**：
- `/v1/wallet` 返回 `{"public_address": "0x..."}`（注意：是 `public_address`，不是 `address`）
- `/v1/wallet/sign/data` 返回 `{"r": "0x...", "s": "0x...", "v": "0"}`
  - `v` 是 **y-parity 字符串 "0" 或 "1"**，不是 EIP-155 的 27/28
  - 库内部必须做 `v_final = 0x1b + parityInt` 转换（参考 `client.go:185`）
  - 返回给调用方的 65 字节签名格式：`r(32) ‖ s(32) ‖ v(1)`，v ∈ {27, 28}

### 1.4 并发与线程安全

- `Client` 一个进程一份，所有 goroutine 共用 → 内部所有可变状态（JWT 缓存、metrics）必须并发安全
- `http.Client` 复用同一个实例（默认 Go transport 已支持 keep-alive 和并发）
- JWT 缓存用 `sync.Map` 或带 `sync.RWMutex` 的 map，键是 userID

### 1.5 不允许的事

- ❌ 不要在库里写日志到具体后端（zap/log/glog）。日志通过注入的 `Logger` 接口或者 `slog.Default()`
- ❌ 不要在库里直接读环境变量。所有配置走 `Config` 结构
- ❌ 不要从磁盘文件读 RSA key。`Config.OIDCPrivateKey *rsa.PrivateKey` 由调用方加载好传入
- ❌ 不要 panic。一切错误用 typed error 返回
- ❌ 不要把 JWT、digest、signature 写到日志（机密信息泄露风险）

---

## 2. 包布局

```
oddfi-magic-client/
├── go.mod                              # module github.com/Crypto-Barrett/oddfi-magic-client
├── go.sum
├── README.md                           # 使用示例 + Magic 后台注册步骤
├── LICENSE
│
├── client.go                           # Client 主结构 + 构造 + Close
├── config.go                           # Config + Validate + defaults
├── interface.go                        # Signer 接口（供 mock）
├── types.go                            # Address / Signature / 公开类型别名
├── errors.go                           # 类型化错误
│
├── internal/
│   ├── jwt/
│   │   ├── minter.go                   # OIDC JWT 现场签发
│   │   ├── cache.go                    # JWT 缓存（按 userID）
│   │   └── minter_test.go
│   │
│   ├── transport/
│   │   ├── transport.go                # http.Client + 重试 + 熔断
│   │   ├── retry.go                    # 指数退避策略
│   │   └── transport_test.go
│   │
│   └── magicapi/
│       ├── wallet.go                   # POST /v1/wallet 调用
│       ├── sign.go                     # POST /v1/wallet/sign/data 调用
│       ├── headers.go                  # 6 个必带 header 的组装
│       └── magicapi_test.go            # httptest 单测
│
├── client_test.go                      # 集成性单测（端到端模拟 Magic TEE）
└── examples/
    └── basic/main.go                   # 最小可运行示例
```

**关键设计决策**：
- `internal/` 下的子包对外不可导入。`Client` 在 `client.go` 用组合方式聚合 JWT minter + transport + magicapi。
- `interface.go` 里声明 `Signer` interface，用于 relay 库的 mock 和 web-api 的依赖反转。
- `Config` 一个结构搞定所有配置；调用方调 `Validate()` 自检后传入 `New()`。

---

## 3. 公开 API（精确签名）

### 3.1 `package magicclient`（顶层）

```go
package magicclient

import (
    "context"
    "crypto/rsa"
    "log/slog"
    "net/http"
    "time"

    "github.com/ethereum/go-ethereum/common"
)

// ─── 类型 ──────────────────────────────────────────────────────────────

// Signature 是 65 字节 secp256k1 签名 r(32) || s(32) || v(1)，v ∈ {27, 28}。
type Signature [65]byte

// ─── Config ────────────────────────────────────────────────────────────

// Config 是构造 Client 的唯一入参。必填字段在 Validate() 中检查。
type Config struct {
    // ─── Magic 后台 ────────────────────────────────────────────────────
    APIKey         string // 必填，X-Magic-API-Key, e.g. "pk_live_057BA3017E24A6F6"
    OIDCProviderID string // 必填，X-OIDC-Provider-ID, UUID 形式
    Referrer       string // 必填，X-Magic-Referrer, e.g. "https://www.oddfi.io"
    Chain          string // 选填，X-Magic-Chain, 默认 "ETH"

    // ─── OIDC JWT 签发 ─────────────────────────────────────────────────
    OIDCPrivateKey *rsa.PrivateKey // 必填，RSA 2048+ 私钥
    Kid            string          // 必填，JWT header 的 kid，需与 JWKS 中的 kid 一致
    Issuer         string          // 必填，JWT iss，必须与 Magic 后台注册的 issuer 一致
    Audience       string          // 必填，JWT aud, e.g. "oddfi-app"
    JWTLifetime    time.Duration   // 选填，JWT 有效期，默认 30min；JWT 缓存窗口 = JWTLifetime - 1min

    // ─── HTTP 行为 ────────────────────────────────────────────────────
    Endpoint       string        // 选填，默认 "https://tee.express.magiclabs.com"，便于测试覆盖
    Timeout        time.Duration // 选填，单次 HTTP 调用超时，默认 5s
    MaxRetries     int           // 选填，5xx / 网络错误最大重试次数，默认 3
    RetryBaseDelay time.Duration // 选填，指数退避基准，默认 200ms

    // ─── 可观测性 ─────────────────────────────────────────────────────
    Logger      *slog.Logger // 选填，默认 slog.Default()。库自己日志只输出到 DEBUG 级别
    HTTPClient  *http.Client // 选填；调用方想注入自己的（如带 trace propagator）就传入

    // ─── 钱包地址缓存 ─────────────────────────────────────────────────
    AddressCacheTTL time.Duration // 选填，user_id → address 的进程内缓存 TTL，默认 24h；调 WalletAddress 时命中
    AddressCacheMax int           // 选填，最大缓存条目，默认 10000；LRU 淘汰
}

// Validate 检查必填字段。New() 内部调用；调用方也可以提前调用做配置校验。
func (c *Config) Validate() error

// ─── Client ────────────────────────────────────────────────────────────

// Client 是 Magic TEE 的服务端 SDK 句柄。进程级单例。线程安全。
type Client struct { /* unexported */ }

// New 用 cfg 构造 Client。cfg.Validate() 失败时返回 ErrInvalidConfig 包装的细节。
func New(cfg Config) (*Client, error)

// Close 释放资源（当前是 no-op，预留用于 HTTP 连接池关闭、metric flush 等）。
func (c *Client) Close() error

// ─── Signer 接口实现 ───────────────────────────────────────────────────
// 这两个方法构成 Signer 接口，是上层（relay 库）唯一关心的能力。
// 任何实现这两个方法的类型都可以替代 *Client，便于测试 mock。

// WalletAddress 返回 userID 对应的链上 EOA 地址。
//
// 行为：
//   1. 命中地址缓存（24h TTL）→ 立即返回，零网络
//   2. 未命中 → 现场签 JWT → POST /v1/wallet → 解析 public_address → 写缓存 → 返回
//
// 错误：
//   ErrUnauthorized      / ErrInvalidConfig / ErrMagicAPI / ErrNetwork / ErrInvalidResponse
//
// 不会写日志暴露 userID（仅 DEBUG 级别打印前 4 位 hash）。
func (c *Client) WalletAddress(ctx context.Context, userID string) (common.Address, error)

// SignDigest 对 32 字节 digest 出 65 字节 ECDSA 签名。
//
// 行为：
//   1. 现场签 JWT（命中 JWT 缓存则跳过签发）
//   2. POST /v1/wallet/sign/data { "raw_data_hash": "0x<digest>" }
//   3. 解析 { r, s, v }，把 v 从 y-parity（"0" / "1"）转成 EIP-155 的 27/28
//   4. 返回 Signature{r(32), s(32), v(1)}
//
// 约束：
//   - digest 必须严格 32 字节；不是 32 字节直接返 ErrInvalidDigest
//   - 不重试 4xx（业务错误）；只重试 5xx 和网络错误（最多 MaxRetries 次）
//
// 错误：
//   ErrInvalidDigest / ErrUnauthorized / ErrMagicAPI / ErrNetwork / ErrInvalidResponse
func (c *Client) SignDigest(ctx context.Context, userID string, digest [32]byte) (Signature, error)
```

### 3.2 `Signer` 接口（用于依赖注入和测试 mock）

`interface.go`：

```go
package magicclient

import (
    "context"
    "github.com/ethereum/go-ethereum/common"
)

// Signer 是上层（relay 库）依赖的最小能力面。
// *Client 实现此接口。测试时用 mock 实现替代。
type Signer interface {
    WalletAddress(ctx context.Context, userID string) (common.Address, error)
    SignDigest(ctx context.Context, userID string, digest [32]byte) (Signature, error)
}

// 编译期断言 *Client 实现 Signer。
var _ Signer = (*Client)(nil)
```

### 3.3 类型化错误

`errors.go`：

```go
package magicclient

import "errors"

// 顶层错误，调用方用 errors.Is 判定。
var (
    ErrInvalidConfig    = errors.New("magicclient: invalid config")
    ErrInvalidDigest    = errors.New("magicclient: digest must be exactly 32 bytes")
    ErrUnauthorized     = errors.New("magicclient: magic rejected JWT (4xx)")     // 401/403
    ErrMagicAPI         = errors.New("magicclient: magic API returned error")     // 4xx 业务错误
    ErrNetwork          = errors.New("magicclient: network failure or timeout")    // 网络/5xx 重试耗尽
    ErrInvalidResponse  = errors.New("magicclient: failed to parse magic response")
)

// HTTPError 携带 Magic API 返回的具体状态码和响应体，便于上层日志。
type HTTPError struct {
    StatusCode int
    Body       string // 已截断到 1KB，避免日志爆炸
    URL        string
}
func (e *HTTPError) Error() string { /* ... */ }
func (e *HTTPError) Unwrap() error { /* 视 status 包装为 ErrUnauthorized/ErrMagicAPI/ErrNetwork */ }
```

---

## 4. 内部实现细节

### 4.1 JWT 现场签发（`internal/jwt/minter.go`）

```go
type Minter struct {
    privateKey *rsa.PrivateKey
    issuer     string
    audience   string
    kid        string
    lifetime   time.Duration
}

// Mint 为 userID 现场签 RS256 JWT。
// 不缓存；缓存在 Cache 层处理。
func (m *Minter) Mint(userID string) (token string, expiresAt time.Time, err error) {
    now := time.Now()
    expiresAt = now.Add(m.lifetime)

    token = jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
        "sub": userID,
        "aud": m.audience,
        "iss": m.issuer,
        "iat": now.Unix(),
        "exp": expiresAt.Unix(),
    })
    token.Header["kid"] = m.kid    // ← 关键，必须设；Magic 用 kid 在 JWKS 里找公钥
    token.Header["alg"] = "RS256"

    signed, err := token.SignedString(m.privateKey)
    return signed, expiresAt, err
}
```

依赖：`github.com/golang-jwt/jwt/v5`（与 `magic_alchmey` 一致，已验证可用）。

### 4.2 JWT 缓存（`internal/jwt/cache.go`）

```go
type cachedJWT struct {
    token     string
    expiresAt time.Time
}

type Cache struct {
    mu     sync.RWMutex
    items  map[string]cachedJWT // key: userID
    safety time.Duration         // 提前过期时间（默认 1min），防止边界 race
}

// GetOrMint 命中且未过期 → 返回缓存；否则调 minter 重签并写回。
// 用 single-flight 防止并发请求同一 user 时多次 mint。
func (c *Cache) GetOrMint(userID string, minter *Minter) (string, error)
```

实现要点：
- 用 `golang.org/x/sync/singleflight` 防 thundering herd
- `safety = 1*time.Minute`：JWT 还有 1 分钟过期时就提前 refresh，避免到 Magic 那头 JWT 刚好过期被拒
- 不需要 LRU：user 数量远小于 JWT lifetime；最大也就几万条字符串，常驻内存可接受

### 4.3 HTTP transport + 重试（`internal/transport/transport.go`）

```go
type Transport struct {
    client      *http.Client
    baseURL     string
    maxRetries  int
    baseDelay   time.Duration
    logger      *slog.Logger
}

// Do 执行 HTTP 请求，自动重试。返回响应体或类型化错误。
//   - 4xx (除 429) 不重试，直接包成 *HTTPError 返回（语义：业务错误）
//   - 5xx / 429 / 网络错误 / context 超时（非取消）→ 重试，指数退避
//   - ctx.Done 立刻终止，不重试
//
// 重试间隔: baseDelay * 2^attempt，加 ±25% jitter
func (t *Transport) Do(ctx context.Context, method, path string, body any, headers http.Header) ([]byte, error)
```

实现要点：
- 用 `bytes.NewReader` 而非 `bytes.NewBuffer`，body reader 重试时 reset
- `req.Body = io.NopCloser(bytes.NewReader(bodyBytes))` 每次重试前重新设置
- 单次 timeout 通过 `ctx, cancel := context.WithTimeout(parentCtx, t.client.Timeout)` 控制
- 429 响应：尊重 `Retry-After` header；没给就走指数退避

### 4.4 钱包地址缓存（`client.go` 内部）

```go
type addressCacheEntry struct {
    addr      common.Address
    expiresAt time.Time
}

type addressCache struct {
    mu      sync.RWMutex
    items   map[string]addressCacheEntry
    ttl     time.Duration
    max     int
    lruList *list.List           // container/list
    lruIdx  map[string]*list.Element
}

// Get 命中且未过期 → addr, true。否则 false。
func (c *addressCache) Get(userID string) (common.Address, bool)

// Put 写入缓存，超过 max 时按 LRU 淘汰。
func (c *addressCache) Put(userID string, addr common.Address)
```

注意：地址缓存命中率应该极高（每次下注 / 提现都会用，但是地址常驻），24h TTL 是为了应对 Magic 后台用户被删除的边缘情况。

### 4.5 调用拼装（`internal/magicapi/wallet.go` 和 `sign.go`）

```go
// wallet.go
type walletResponse struct {
    PublicAddress string `json:"public_address"`
}

func (a *API) GetOrCreateWallet(ctx context.Context, jwt string) (common.Address, error) {
    headers := a.buildHeaders(jwt)
    body, err := a.transport.Do(ctx, "POST", "/v1/wallet", struct{}{}, headers)
    if err != nil { return common.Address{}, err }

    var resp walletResponse
    if err := json.Unmarshal(body, &resp); err != nil {
        return common.Address{}, fmt.Errorf("%w: %v", ErrInvalidResponse, err)
    }
    if !common.IsHexAddress(resp.PublicAddress) {
        return common.Address{}, fmt.Errorf("%w: invalid address %q", ErrInvalidResponse, resp.PublicAddress)
    }
    return common.HexToAddress(resp.PublicAddress), nil
}

// sign.go
type signDataRequest struct {
    RawDataHash string `json:"raw_data_hash"`
}

type signatureResponse struct {
    R string `json:"r"`
    S string `json:"s"`
    V string `json:"v"`
}

func (a *API) SignData(ctx context.Context, jwt string, digest [32]byte) (Signature, error) {
    payload := signDataRequest{RawDataHash: "0x" + hex.EncodeToString(digest[:])}
    headers := a.buildHeaders(jwt)
    body, err := a.transport.Do(ctx, "POST", "/v1/wallet/sign/data", payload, headers)
    if err != nil { return Signature{}, err }

    var resp signatureResponse
    if err := json.Unmarshal(body, &resp); err != nil {
        return Signature{}, fmt.Errorf("%w: %v", ErrInvalidResponse, err)
    }
    rBytes := common.FromHex(resp.R)
    sBytes := common.FromHex(resp.S)
    if len(rBytes) != 32 || len(sBytes) != 32 {
        return Signature{}, fmt.Errorf("%w: r/s wrong length", ErrInvalidResponse)
    }
    vInt, err := strconv.Atoi(resp.V)
    if err != nil || (vInt != 0 && vInt != 1) {
        return Signature{}, fmt.Errorf("%w: invalid v %q", ErrInvalidResponse, resp.V)
    }
    var sig Signature
    copy(sig[:32], rBytes)
    copy(sig[32:64], sBytes)
    sig[64] = byte(0x1b + vInt)   // ← 与 magic_alchmey/client.go:185 一致
    return sig, nil
}
```

### 4.6 6 个必带 header（`internal/magicapi/headers.go`）

```go
func (a *API) buildHeaders(jwt string) http.Header {
    h := http.Header{}
    h.Set("Authorization",      "Bearer " + jwt)
    h.Set("X-Magic-API-Key",    a.apiKey)
    h.Set("X-OIDC-Provider-ID", a.oidcProviderID)
    h.Set("X-Magic-Chain",      a.chain)        // 默认 "ETH"
    h.Set("X-Magic-Referrer",   a.referrer)
    h.Set("Content-Type",       "application/json")
    return h
}
```

---

## 5. 测试要求

### 5.1 单测覆盖率目标 ≥ 85%

- `internal/jwt/minter_test.go`：
  - 验证生成的 JWT 能被同一个 RSA 公钥校验
  - 验证 claims 含 sub/aud/iss/iat/exp，header 含 kid/alg
- `internal/jwt/cache_test.go`：
  - 第一次调用触发 mint，第二次命中缓存（无 mint）
  - 接近过期触发提前 refresh
  - 并发 100 个 goroutine 调同一 userID，只 mint 一次（singleflight）
- `internal/transport/transport_test.go`：
  - 502 → 重试 3 次后失败，返回 `ErrNetwork`
  - 400 → 不重试，返回 `*HTTPError` + `ErrMagicAPI`
  - 401 → 不重试，返回 `*HTTPError` + `ErrUnauthorized`
  - 429 with `Retry-After: 2` → 等 2s 后重试
  - 网络超时（httptest server hang）→ ctx timeout 立即返回
- `internal/magicapi/magicapi_test.go`：
  - `/v1/wallet` 返回正常地址 → 解析正确
  - 返回畸形 JSON → `ErrInvalidResponse`
  - `/v1/wallet/sign/data` 返回 v="0" → final sig 末字节 = 27
  - 返回 v="1" → final sig 末字节 = 28
  - 返回 v="2" → `ErrInvalidResponse`

### 5.2 集成测试（`client_test.go`）

用 `httptest.NewServer` 模拟整个 Magic TEE，断言：
- `WalletAddress` 第二次调用不发 HTTP（命中地址缓存）
- `SignDigest` 100 次并发，每次都成功
- `SignDigest` 接收非 32 字节 digest → `ErrInvalidDigest`，且不发 HTTP

### 5.3 实测 staging Magic

提供一个独立的 `examples/staging-smoke/` 子目录，可用环境变量驱动跑一遍：
```
MAGIC_API_KEY, MAGIC_OIDC_PROVIDER_ID, MAGIC_REFERRER,
MAGIC_KID, MAGIC_ISSUER, MAGIC_AUDIENCE, MAGIC_PRIVATE_KEY_FILE,
MAGIC_TEST_USER_ID
```
跑完打印拿到的地址和签名，方便上线前手动验证。

---

## 6. 使用示例

```go
package main

import (
    "context"
    "crypto/rsa"
    "crypto/x509"
    "encoding/pem"
    "log"
    "os"

    magicclient "github.com/Crypto-Barrett/oddfi-magic-client"
)

func main() {
    // 1) 加载 RSA 私钥
    pemBytes, _ := os.ReadFile("rsa_private_key.pem")
    block, _ := pem.Decode(pemBytes)
    rsaKey, _ := x509.ParsePKCS8PrivateKey(block.Bytes)

    // 2) 构造 Client
    cli, err := magicclient.New(magicclient.Config{
        APIKey:         os.Getenv("MAGIC_API_KEY"),
        OIDCProviderID: os.Getenv("MAGIC_OIDC_PROVIDER_ID"),
        Referrer:       "https://www.oddfi.io",
        OIDCPrivateKey: rsaKey.(*rsa.PrivateKey),
        Kid:            "uniq-123",
        Issuer:         "https://www.oddfi.io/",
        Audience:       "oddfi-app",
    })
    if err != nil { log.Fatal(err) }
    defer cli.Close()

    ctx := context.Background()

    // 3) 查地址
    addr, _ := cli.WalletAddress(ctx, "user-1234")
    log.Printf("user-1234 magic addr = %s", addr.Hex())

    // 4) 签 digest
    var digest [32]byte
    copy(digest[:], []byte("dummy 32-byte digest --32 bytes--"))
    sig, _ := cli.SignDigest(ctx, "user-1234", digest)
    log.Printf("signature = 0x%x", sig)
}
```

---

## 7. 仓库 / 发布

- **新仓库**：`github.com/Crypto-Barrett/oddfi-magic-client`
- 私有 repo，跟 `oddfi-ODD-SDK` 一个 org
- 版本：`v0.0.1` 起步，遵循 semver；breaking change 升 major
- README 必须包含：
  1. 安装命令
  2. Magic 后台 OIDC Provider 注册步骤截图（如 JWKS URL 配置在哪、kid 怎么对齐）
  3. 本文档章节 6 的最小示例
  4. 错误处理对照表

---

## 8. 实现顺序（推荐）

实现 AI agent 按此顺序：

1. 初始化仓库，`go mod init`，添加依赖 `github.com/golang-jwt/jwt/v5`、`github.com/ethereum/go-ethereum`、`golang.org/x/sync`
2. 写 `errors.go` 全部错误类型
3. 写 `config.go` Config + Validate
4. 写 `internal/jwt/minter.go` + 单测
5. 写 `internal/jwt/cache.go` + 单测
6. 写 `internal/transport/transport.go` + retry + 单测
7. 写 `internal/magicapi/headers.go`
8. 写 `internal/magicapi/wallet.go` + 单测
9. 写 `internal/magicapi/sign.go` + 单测
10. 写 `client.go` 聚合所有组件 + 地址缓存
11. 写 `interface.go`
12. 写 `client_test.go` 集成单测
13. 写 `examples/basic/main.go`
14. 跑 `go test ./... -race -cover`，达到 ≥85%
15. 用 staging Magic 跑 `examples/staging-smoke` 实测一把

---

## 9. 已知未决问题

1. **JWKS 怎么发布**：Magic 后台需要一个 HTTPS URL 拉 JWKS。生产 issuer 用 `https://www.oddfi.io/.well-known/jwks.json` 还是 `https://api.oddfi.io/.well-known/jwks.json`？这是部署侧决策，本库不关心。
2. **RSA key rotation 策略**：当前设计是一对 key 全局用。未来如果要 rotation，需要在 `Config.Kid` 上做版本前缀（如 `kid-2026q2`），同时 JWKS 同时挂老 + 新两把公钥的过渡期。**本版本不实现**，记录在 README 的 "Future work" 一节。
3. **Magic TEE 全球区域**：endpoint 现在硬编码 `tee.express.magiclabs.com`。如果未来 Magic 提供地区 endpoint（如 `tee-us.express.magiclabs.com`），靠 `Config.Endpoint` 已经能覆盖，无须 lib 改动。

---

## 10. 验收标准

- [ ] `go test ./... -race` 全绿
- [ ] `go test -cover` 覆盖率 ≥ 85%
- [ ] `examples/basic/main.go` 可独立编译
- [ ] `examples/staging-smoke` 用真实 Magic key 能跑通
- [ ] README 写完，附 Magic 后台注册截图
- [ ] 库 import 后 `go vet` 无 warning
- [ ] `golangci-lint run` 无 warning
