# contracts-business-layer Relay 库 ── Magic Signer 集成改造

**Date**: 2026-05-21
**Status**: 待评审
**Author**: brainstorming with niall
**Depends on**: [2026-05-21-magic-signer-service-spec.md](./2026-05-21-magic-signer-service-spec.md)（新 magic 签名服务 + client SDK）

---

## 修正记录（2026-05-23，对照真实 SDK + 真实代码后）

把 spec 与实际产物对齐后修正了 5 处，正文已就地更新：

1. **依赖路径 / module 名**：实际 module 是 `github.com/Crypto-Barrett/oddfi-magic-client`（包在 `client/` 子目录），物理路径 `D:\everything_finance\oddfi-magic-client`。原文写的 `magic-signer` / `magic_client` 均不存在。当前阶段用 `replace` 指向本地路径，远程发布后再换正式版本。
2. **`Signer` 接口有两个方法**：`WalletAddress` + `SignDigest`。relay 不调 `WalletAddress`，但所有 mock / fakeMagicSigner 必须把两个方法都实现。
3. **`SignDigest` 收 `[32]byte`**：`ExecuteRequestDigest` 改成返回 `[32]byte`（与 `AuthorizationDigest` 统一），避免 `[]byte`→`[32]byte` 转换。
4. **`AuthorizationDigest` 直接用 `(*types.SetCodeAuthorization).SigHash()`**：go-ethereum v1.17.2（本仓版本）已导出，删掉手写 `computeSetCodeAuthHash`。
5. **`crypto_pubToAddr` 不能整删**：`relay/client.go` 仍用它从 sponsor 私钥推地址。保留该函数（只服务 sponsor），仅删除其 user-side 调用点。

---

## 0. 目标

把 relay 库里所有 user-side 签名（A 的签名）从"调用方传入 `*ecdsa.PrivateKey`"切换为"调用方传入 `userID string`，库内部通过注入的 `Signer` 接口调 Magic TEE"。

**显式不变的部分**：
- ✅ EIP-7702 + Sponsor B 链上路径完全不动
- ✅ relay 所有 user-side 方法（共 10 个：PlaceBet / ClaimPayout / DepositGlobal / DepositMatch / RequestUnbond / Withdraw / Stake / Unstake / Transfer / Approve）的对外名字、`AsyncResult` / `WithReceipt` 双形态、chain_actions 幂等表全部保留
- ✅ Sponsor B 的私钥仍由 BE 持有，仍负责签 SetCodeTx 并广播
- ✅ Admin client 完全不动（admin 自己签自己发，没用过 user pk）

---

## 1. 硬约束

1. **break compat ok**：这是 v0.x 的内部库，对外接口可以改名 / 改字段，不要做兼容垫片。
2. **签名分两次依赖关系**：每次 relay 操作要调 Magic 2 次 `/sign/data`（一次 7702 auth digest，一次 EIP-712 execute digest），不调 `WalletAddress`（**用户地址由调用方在 web-api 登录时已落库到 `user.magic_address`，relay 调用时直接传地址进来**）。
3. **Signer 接口只 import magicclient 的 `Signer` interface**，不要 import `*Client` 具体类型 → 保持测试 mock 能力。注意该接口含 **两个方法**：`WalletAddress(ctx, userID)` 和 `SignDigest(ctx, userID, digest [32]byte)`。relay 只调 `SignDigest`，但 mock / fakeMagicSigner **必须把两个方法都实现**才能满足接口。
4. **10 个 user-side relay 方法在自己的 Request 结构里都必须带 `UserID` 和 `UserAddr`**：
   - `UserID`：给 Signer 调 Magic 用
   - `UserAddr`：avoid relay 内部每次重复调 `WalletAddress`，且 chain_actions 的 `signer_address` 列要存这个
   - 上层（web-api）保证两者匹配；不一致是上层 bug
5. **删除 `*ecdsa.PrivateKey` 相关的所有 user-side 字段和代码路径**，包括但不限于：
   - 所有 `relay.*Request.PrivateKey` 字段（10 处，分布在 `place_bet.go` 和 `stubs.go`）
   - `relay/service.go:33` 的 `crypto_pubToAddr`（已无用）
   - `relay/service.go:40` `submitJob.UserKey` 字段
6. **`internal/eip7702/signer.go` 和 `auth.go` 中的签名函数要拆解**：digest 计算保留，签名步骤改成调外部 Signer。
7. **错误处理**：magic-signer client SDK 返回的错误统一通过 `coretypes.WrapRetryable` / `coretypes.WrapBusiness` 包装：
   - `magicclient.ErrUnauthorized` / `ErrBadRequest` / `ErrOpNotAllowed` → `coretypes.ErrParamInvalid` (配置/请求错误，不重试)
   - `magicclient.ErrMagicUpstream` (502) → `coretypes.ErrInfraRPC`（可重试）
   - `magicclient.ErrMagicNetwork` (503) → `coretypes.ErrInfraRPC`（可重试）
   - `magicclient.ErrServerInternal` (500) → `coretypes.ErrInternalInvariant`（不可恢复）
   - `magicclient.ErrNetwork` → `coretypes.ErrInfraRPC`（client→service 网络不通，可重试）
8. **依赖路径**：`github.com/Crypto-Barrett/oddfi-magic-client/client`（来自独立部署的 magic-signer 服务，**不在本仓内**，位于 `D:\everything_finance\oddfi-magic-client`）。本仓统一用 import 别名 `magicclient "github.com/Crypto-Barrett/oddfi-magic-client/client"`。当前阶段 go.mod 用 `replace` 指向本地路径。

---

## 2. 改动清单（文件级）

### 2.1 新增文件

| 文件                                              | 内容                                                  |
| ------------------------------------------------- | ----------------------------------------------------- |
| `relay/signer.go`                                 | 重新导出 `magicclient.Signer` 类型别名；定义 chain_actions 用的辅助函数 |

### 2.2 修改文件

| 文件                            | 改动                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| `go.mod`                        | `+ require github.com/Crypto-Barrett/oddfi-magic-client v0.0.0` + `replace github.com/Crypto-Barrett/oddfi-magic-client => D:/everything_finance/oddfi-magic-client`（远程发布后去掉 replace、换正式 tag） |
| `clients.go`                    | `RelayConfig` + `Config` 加 `UserSigner magicclient.Signer` 字段，传给 `relay.Config`     |
| `relay/client.go`               | `Config` 去掉对 user pk 的需求；加 `UserSigner Signer` 字段（必填）；`Client` 内持有 signer |
| `relay/service.go`              | `submitJob.UserKey` 改成 `UserAddr`（已有）；`submit()` 里 signAuth + signExecute 改成调 signer.SignDigest 拼装 |
| `relay/place_bet.go`            | `PlaceBetRequest.PrivateKey` → `UserID string` + `UserAddr common.Address`；validatePlaceBet 改 |
| `relay/stubs.go`                | 同上，9 个 Request 全改：ClaimPayout / DepositGlobal / DepositMatch / RequestUnbond / Withdraw / Stake / Unstake / Transfer / Approve |
| `relay/sponsored.go`            | `signExecute` / `signAuth` 别名删掉，因为不再直接签；改成 export digest 计算函数             |
| `internal/eip7702/signer.go`    | `SignExecute` 拆成 `ExecuteDigest`（保留）+ caller 自己调 Signer + `AssembleExecuteSig`     |
| `internal/eip7702/auth.go`      | `SignAuthorization` 拆成 `AuthorizationDigest`（新增）+ `AssembleAuthorization`（吃外部签名） |

### 2.3 删除文件 / 代码段

- **保留** `relay/service.go` 的 `crypto_pubToAddr`：`relay/client.go` 仍用它从 sponsor 私钥推地址（`sponsorAt := crypto_pubToAddr(cfg.SponsorPrivateKey)`）。只删它的 **user-side 调用点**（10 个方法里的 `userAddr := crypto_pubToAddr(req.PrivateKey)`），函数本身不动。
- 删除 `*ecdsa.PrivateKey` 在 relay 包内 **user-side** 的所有引用（sponsor 路径的 `*ecdsa.PrivateKey` 保留）。
- `go.mod` 不能直接删 ethereum/crypto；relay 包内 `crypto` import 仍被 sponsor 路径（`crypto_pubToAddr`）需要，**不能删**。

---

## 3. 具体类型 / 函数签名（diff 形式）

### 3.1 `relay/signer.go`（新文件）

```go
// relay/signer.go — re-export Signer interface from magicclient to keep
// callers from having to dual-import the relay and magic-client packages.

package relay

import (
    magicclient "github.com/Crypto-Barrett/oddfi-magic-client/client"
)

// Signer is the user-side signing capability injected into Client.
// Implementations sign on behalf of the user identified by UserID.
//
// In production this is *magicclient.Client; tests inject a mock.
type Signer = magicclient.Signer
```

### 3.2 `relay/client.go`

```diff
 type Config struct {
-    SponsorPrivateKey *ecdsa.PrivateKey
+    SponsorPrivateKey *ecdsa.PrivateKey   // 不变；sponsor B 仍是本地私钥
+
+    // UserSigner 用 user_id 替用户签 7702 auth + EIP-712 execute。
+    // 必填。实现见 oddfi-magic-client/client 库。
+    UserSigner Signer

     ImplAddress       common.Address
     SignatureDeadline time.Duration
     ChainID           *big.Int
     Confirmations     int
     MulticallAddress  common.Address
     Addresses         Addresses
 }

 type Client struct {
     cfg       Config
     eth       *ethclient.Client
     sdk       *oddfi.Client
     mc        *multicall.Client
     actions   *action.Repo
     watcher   *watcher.Watcher
     sponsorAt common.Address
+    signer    Signer        // = cfg.UserSigner，便于内部使用
 }

 func New(eth *ethclient.Client, sdk *oddfi.Client, ...) (*Client, error) {
     // ... 已有校验
+    if cfg.UserSigner == nil {
+        return nil, errors.New("relay: missing UserSigner")
+    }
     return &Client{
         cfg: cfg, eth: eth, sdk: sdk, mc: mc, actions: actions,
         watcher: w, sponsorAt: sponsorAt,
+        signer: cfg.UserSigner,
     }, nil
 }
```

### 3.3 `relay/place_bet.go`

```diff
 type PlaceBetRequest struct {
-    PrivateKey        *ecdsa.PrivateKey
+    UserID            string         // ← Magic 用 user_id 索引
+    UserAddr          common.Address // ← user 的 Magic EOA，由 web-api 从 user.magic_address 落库读出后传入
     Market            coretypes.MarketKey
     Outcome           uint8
     Amount            *big.Int
     MinAcceptedAmount *big.Int
     MinOdds           *big.Int
     Deadline          uint64
     IdempotencyKey    string
 }

 func (c *Client) PlaceBet(ctx context.Context, req PlaceBetRequest) (AsyncResult, error) {
     if err := validatePlaceBet(req); err != nil {
         return AsyncResult{}, err
     }
-    userAddr := crypto_pubToAddr(req.PrivateKey)
+    userAddr := req.UserAddr
     marketID := req.Market.MarketID()

     pre, err := c.prePlaceBet(ctx, userAddr, req.Amount, marketID)
     // ... 不变
     res, err := c.submit(ctx, submitJob{
         Method:         "PlaceBet",
-        UserKey:        req.PrivateKey,
+        UserID:         req.UserID,
         UserAddr:       userAddr,
         Target:         c.cfg.Addresses.BettingPool,
         Data:           calldata,
         IdempotencyKey: req.IdempotencyKey,
         ArgsJSON:       map[string]any{ /* ... 不变 */ },
     })
     // ... 不变
 }

 func validatePlaceBet(req PlaceBetRequest) error {
     op := "PlaceBet"
-    if req.PrivateKey == nil {
-        return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("nil PrivateKey"))
+    if req.UserID == "" {
+        return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("empty UserID"))
+    }
+    if req.UserAddr == (common.Address{}) {
+        return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("zero UserAddr"))
     }
     // ... 其余不变
 }
```

### 3.4 `relay/service.go`（核心改动）

```diff
 type submitJob struct {
     Method         string
-    UserKey        *ecdsa.PrivateKey
+    UserID         string
     UserAddr       common.Address
     Target         common.Address
     Value          *big.Int
     Data           []byte
     IdempotencyKey string
     ArgsJSON       map[string]any
 }

 func (c *Client) submit(ctx context.Context, job submitJob) (submitResult, error) {
     // 1) Insert chain_actions row — 完全不变
     // 2) Read chainID, A's tx-nonce — 完全不变

-    // 3) Sign SetCodeAuthorization
-    auth, err := signAuth(signAuthInput{
-        ChainID:        chainID,
-        Implementation: c.cfg.ImplAddress,
-        AuthNonce:      aTxNonce,
-        PrivateKey:     job.UserKey,
-    })
+    // 3) Sign SetCodeAuthorization via Magic
+    authDigest, err := eip7702.AuthorizationDigest(chainID, c.cfg.ImplAddress, aTxNonce)
+    if err != nil {
+        return submitResult{}, coretypes.WrapInternal(coretypes.ErrInternalInvariant, job.Method+".AuthorizationDigest", err)
+    }
+    authSig, err := c.signer.SignDigest(ctx, job.UserID, authDigest)
+    if err != nil {
+        return submitResult{}, wrapMagicErr(job.Method+".SignAuthorization", err)
+    }
+    auth, err := eip7702.AssembleAuthorization(chainID, c.cfg.ImplAddress, aTxNonce, authSig)
+    if err != nil {
+        return submitResult{}, coretypes.WrapInternal(coretypes.ErrInternalInvariant, job.Method+".AssembleAuthorization", err)
+    }

-    // 4) Sign Execute typed data
-    sig, err := signExecute(signExecuteInput{
-        ChainID:           chainID,
-        VerifyingContract: job.UserAddr,
-        Calls:             calls,
-        Nonce:             execNonce,
-        Deadline:          deadline,
-        PrivateKey:        job.UserKey,
-    })
+    // 4) Sign Execute typed data via Magic
+    execDigest, err := eip7702.ExecuteRequestDigest(eip7702.ExecuteDigestInput{
+        ChainID:           chainID,
+        VerifyingContract: job.UserAddr,
+        Calls:             calls,
+        Nonce:             execNonce,
+        Deadline:          deadline,
+    })
+    if err != nil {
+        return submitResult{}, coretypes.WrapInternal(coretypes.ErrInternalInvariant, job.Method+".ExecuteDigest", err)
+    }
+    sig, err := c.signer.SignDigest(ctx, job.UserID, execDigest)
+    if err != nil {
+        return submitResult{}, wrapMagicErr(job.Method+".SignExecute", err)
+    }

     // 5) onwards 完全不变 (EncodeBatchExecute, buildSetCodeTx, types.SignTx with sponsor key, SendTransaction)
 }
```

### 3.5 `internal/eip7702/signer.go`（拆解）

```diff
-type SignExecuteInput struct {
-    ChainID           *big.Int
-    VerifyingContract common.Address
-    Calls             []Call
-    Nonce             *big.Int
-    Deadline          *big.Int
-    PrivateKey        *ecdsa.PrivateKey
-}
+// ExecuteDigestInput 是计算 Execute typed-data digest 所需的纯数据。
+// 不包含私钥；签名由外部 Signer 完成。
+type ExecuteDigestInput struct {
+    ChainID           *big.Int
+    VerifyingContract common.Address
+    Calls             []Call
+    Nonce             *big.Int
+    Deadline          *big.Int
+}

 func BuildExecuteTypedData(in ExecuteDigestInput) apitypes.TypedData { /* 不变 */ }

-func ExecuteRequestDigest(in SignExecuteInput) ([]byte, error) {
+// 返回 [32]byte（不是 []byte），直接喂给 magicclient.Signer.SignDigest(... [32]byte)。
+func ExecuteRequestDigest(in ExecuteDigestInput) ([32]byte, error) {
     td := BuildExecuteTypedData(in)
     digest, _, err := apitypes.TypedDataAndHash(td)
-    return digest, err
+    if err != nil {
+        return [32]byte{}, fmt.Errorf("typed data hash: %w", err)
+    }
+    var out [32]byte
+    copy(out[:], digest) // TypedDataAndHash 返回 32 字节
+    return out, nil
 }

-// 删除 SignExecute——签名由 service.go 通过外部 Signer 完成
-func SignExecute(in SignExecuteInput) ([]byte, error) { /* 删 */ }
```

> 注意：`ExecuteRequestDigest` 当前返回 `[]byte`，被旧的 `SignExecute` 调用。改成 `[32]byte` 后旧 `SignExecute` 一并删除，唯一调用方变成 `relay/service.go`。

### 3.6 `internal/eip7702/auth.go`（拆解）

```diff
-type SignAuthorizationInput struct {
-    ChainID        *big.Int
-    Implementation common.Address
-    AuthNonce      uint64
-    PrivateKey     *ecdsa.PrivateKey
-}

-func SignAuthorization(in SignAuthorizationInput) (types.SetCodeAuthorization, error) { /* 删 */ }

+// AuthorizationDigest 返回 EIP-7702 SetCodeAuthorization 的 32 字节 digest，
+// 即 keccak256(0x05 || rlp([chainId, address, nonce]))。
+// 这个 digest 由外部 Signer 签名。
+//
+// go-ethereum v1.17.2 已导出 (*types.SetCodeAuthorization).SigHash()，直接复用，
+// 不再手写 RLP/keccak，保证与 types.SignSetCode 算的 digest 逐字节一致。
+func AuthorizationDigest(chainID *big.Int, impl common.Address, nonce uint64) ([32]byte, error) {
+    cid, overflow := uint256.FromBig(chainID)
+    if overflow { return [32]byte{}, fmt.Errorf("chainID overflows uint256") }
+    auth := types.SetCodeAuthorization{
+        ChainID: *cid,
+        Address: impl,
+        Nonce:   nonce,
+    }
+    return auth.SigHash(), nil // common.Hash 即 [32]byte
+}

+// AssembleAuthorization 接收外部 Signer 给出的 65 字节签名，
+// 组装出 go-ethereum 的 SetCodeAuthorization 结构（含 V/R/S）。
+//
+// 关键转换：magicclient.Signature 末字节是 EIP-155 的 v ∈ {27, 28}，
+// 但 SetCodeAuthorization.V 是 y-parity ∈ {0, 1}，所以要减 27。
+func AssembleAuthorization(chainID *big.Int, impl common.Address, nonce uint64, sig [65]byte) (types.SetCodeAuthorization, error) {
+    cid, overflow := uint256.FromBig(chainID)
+    if overflow { return types.SetCodeAuthorization{}, fmt.Errorf("chainID overflows uint256") }
+    if sig[64] != 27 && sig[64] != 28 {
+        return types.SetCodeAuthorization{}, fmt.Errorf("invalid v byte in signature: %d", sig[64])
+    }
+    var r, s uint256.Int
+    r.SetBytes(sig[0:32])
+    s.SetBytes(sig[32:64])
+    return types.SetCodeAuthorization{
+        ChainID: *cid,
+        Address: impl,
+        Nonce:   nonce,
+        V:       sig[64] - 27,   // EIP-155 v → y-parity
+        R:       r,
+        S:       s,
+    }, nil
+}
```

**重要说明（已确认）**：本仓用 go-ethereum **v1.17.2**，`core/types/tx_setcode.go` 已导出：

- `(*SetCodeAuthorization).SigHash() common.Hash` —— 直接给 `AuthorizationDigest` 用。
- `SetCodeAuthorization` 的 `V uint8`（y-parity，**`{0,1}` 而非 `{27,28}`**）、`R/S uint256.Int` 字段。`SignSetCode` 内部 `V: sig[64]`（crypto.Sign 给 `{0,1}`），所以 `AssembleAuthorization` 把 magic 的 `{27,28}` 减 27 是正确的。

因此原 spec 里手写的 5 行 `computeSetCodeAuthHash` 不需要了。

### 3.7 `clients.go`（顶层工厂）

```diff
+import magicclient "github.com/Crypto-Barrett/oddfi-magic-client/client"

 type Config struct {
     // ... 不变
+    UserSigner magicclient.Signer // 必填
 }
 type RelayConfig struct {
     // ... 不变
+    UserSigner magicclient.Signer // 必填
 }

 func NewClients(ctx context.Context, cfg Config) (*Clients, error) {
+    if cfg.UserSigner == nil {
+        return nil, errors.New("business: Config.UserSigner is required")
+    }
     // ... 不变
     relayCli, err := relay.New(eth, sdk, actions, cfg.Watcher, relay.Config{
+        UserSigner: cfg.UserSigner,
         // ... 其余不变
     })
 }

 func NewRelayClients(ctx context.Context, cfg RelayConfig) (*RelayClients, error) {
+    if cfg.UserSigner == nil {
+        return nil, errors.New("business: RelayConfig.UserSigner is required")
+    }
     // ... 类似
 }
```

---

## 4. 错误转换辅助函数

`relay/service.go` 加一个 helper：

```go
// wrapMagicErr 把 magic-signer client SDK 返回的错误转成 coretypes 的标准错误体系。
func wrapMagicErr(op string, err error) error {
    switch {
    case errors.Is(err, magicclient.ErrInvalidConfig),
         errors.Is(err, magicclient.ErrBadRequest):
        // 调用方传错参数 → 业务错误，不重试
        return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, err)
    case errors.Is(err, magicclient.ErrUnauthorized),
         errors.Is(err, magicclient.ErrOpNotAllowed):
        // 配置/部署错误 → 业务错误，不应重试，立刻告警
        return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, err)
    case errors.Is(err, magicclient.ErrMagicUpstream),
         errors.Is(err, magicclient.ErrMagicNetwork),
         errors.Is(err, magicclient.ErrNetwork):
        // upstream Magic 不可达 / client→service 网络问题 → 可重试
        return coretypes.WrapRetryable(coretypes.ErrInfraRPC, op, err)
    case errors.Is(err, magicclient.ErrServerInternal):
        return coretypes.WrapInternal(coretypes.ErrInternalInvariant, op, err)
    default:
        return coretypes.WrapRetryable(coretypes.ErrInfraRPC, op, err)
    }
}
```

---

## 5. 测试要求

> **测试现状（已核实）**：relay 包**目前没有任何 `_test.go`**。所有用到私钥的测试都在仓库根目录（package `business`）：`scenario_e2e_test.go`、`refund_methods_e2e_test.go`。`placebet_simulate_test.go` 只用 `crypto.HexToECDSA` 推 `bettorAddr`，**不调任何 relay.\*Request、也不用被删的 `SignExecute`/`SignAuthorization`，因此不需要改**（原 spec 误列了它）。

### 5.1 新增单测

- `internal/eip7702/auth_test.go`：用已知私钥跑 `crypto.Sign(AuthorizationDigest(...))` 后 `sig[64]+=27`，再喂给 `AssembleAuthorization`，断言得到的 `SetCodeAuthorization` 的 V/R/S 与 `types.SignSetCode(key, auth)` 完全一致 → 证明 digest 计算 + v 转换正确。
- `relay/place_bet_test.go`、`relay/service_test.go`：
  - 用 mock Signer（实现 `Signer` 接口的 **两个**方法：`WalletAddress` 返回零值/error 即可，`SignDigest` 才是被测的）
  - 验证 `submit()` 调用 `signer.SignDigest` 两次，且：
    - 第一次 digest 等于 `eip7702.AuthorizationDigest(...)` 的输出
    - 第二次 digest 等于 `eip7702.ExecuteRequestDigest(...)` 的输出
  - 验证组装出的 `SetCodeAuthorization` 中 V/R/S 与 mock 返回的 sig 一致
  - 验证 `wrapMagicErr` 正确分类每种 Magic 错误（逐个 `errors.Is`）

### 5.2 e2e 测试改造（**全部改完**）

新增一个 `fakeMagicSigner`（建议放 `magic_test_helpers.go`，package `business`，仅 test 编译）：

```go
// fakeMagicSigner 实现 magicclient.Signer（两个方法都要实现）。
type fakeMagicSigner struct{ keys map[string]*ecdsa.PrivateKey }

func newFakeMagicSigner(keys map[string]*ecdsa.PrivateKey) *fakeMagicSigner {
    return &fakeMagicSigner{keys: keys}
}
func (f *fakeMagicSigner) WalletAddress(_ context.Context, userID string) (common.Address, error) {
    k, ok := f.keys[userID]
    if !ok { return common.Address{}, fmt.Errorf("unknown user %q", userID) }
    return crypto.PubkeyToAddress(k.PublicKey), nil
}
func (f *fakeMagicSigner) SignDigest(_ context.Context, userID string, digest [32]byte) (magicclient.Signature, error) {
    k, ok := f.keys[userID]
    if !ok { return magicclient.Signature{}, fmt.Errorf("unknown user %q", userID) }
    sig, err := crypto.Sign(digest[:], k) // 返回 v ∈ {0,1}
    if err != nil { return magicclient.Signature{}, err }
    sig[64] += 27 // 对齐真实 Magic 的 v ∈ {27,28}
    var out magicclient.Signature
    copy(out[:], sig)
    return out, nil
}
```

**逐文件改动**：

| 文件 | 要改的 relay 调用 | 改法 |
| --- | --- | --- |
| `scenario_e2e_test.go` | `ApproveRequest`(×2)、`DepositMatchRequest`、`PlaceBetRequest`、`ClaimPayoutRequest`、`RequestUnbondRequest`、`WithdrawRequest` | 每处 `PrivateKey: bettorKey/lpKey` → `UserID: "<user>"` + `UserAddr: <addr>` |
| `refund_methods_e2e_test.go` | `ApproveRequest`(×4)、`DepositMatchRequest`(×2)、`PlaceBetRequest`(×2) | 同上 |

两个文件**还要**：
- 构造 `fakeMagicSigner`，把所有 user key（bettorKey / lpKey / …）按 `user_id` 注册进去；
- 在构造 relay client 的 config（`business.RelayConfig` / `business.Config`，即现有 `SponsorPrivateKey: adminKey` 那块）里加 `UserSigner: fakeMagic`；
- `UserAddr` 用现成的 `bettorAddr` / `lpAddr`（这些已由 `crypto.PubkeyToAddress` 算好，保留）。

`placebet_simulate_test.go`：**不改**。

### 5.3 验收

```
cd D:/everything_finance/org/contracts-business-layer
go build ./...
go vet ./...
go vet -tags e2e ./...   # 让 e2e 测试也参与编译检查
go test ./...            # 注：本机为 windows/386，-race 不支持；其他平台加 -race
golangci-lint run        # 若已安装；否则 gofmt + go vet 已覆盖
```

全部绿，无 warning。

> 实测（2026-05-23, windows/386）：`go build` / `go vet` / `go vet -tags e2e` / `go test ./...` 全部 exit 0。`-race` 在 windows/386 不可用（Go 工具链限制），其余平台应带上。`golangci-lint` 本机未装。

---

## 5.4 调用方 wiring（web-api 启动时怎么注入）

```go
// web-api/cmd/<entry>/main.go
import (
    magicclient "github.com/Crypto-Barrett/oddfi-magic-client/client"
    business "github.com/Crypto-Barrett/contracts-business-layer"
)

func main() {
    // 1. 构造 magic-signer client（其实是 HTTP 客户端，指向独立部署的 magic-signer 服务）
    signerCli, err := magicclient.New(magicclient.Config{
        BaseURL:   os.Getenv("MAGIC_SIGNER_URL"),     // e.g. https://magic-signer.svc.cluster.local
        AuthToken: os.Getenv("MAGIC_SIGNER_TOKEN"),   // 调用方明文 token，sha256 在服务端配置
        Timeout:   10 * time.Second,
    })
    if err != nil { log.Fatal(err) }

    // 2. 注入 relay client。同一份 signerCli 也可以注入到 web-api 自己的 auth service。
    relayClients, err := business.NewRelayClients(ctx, business.RelayConfig{
        ...
        UserSigner: signerCli,  // ← 实现了 relay.Signer (= magicclient.Signer)
    })
}
```

**关键点**：
- magic-signer 服务**不在 contracts-business-layer 仓内**，是 `D:\everything_finance\oddfi-magic-client` 项目独立部署的 HTTP 服务
- contracts-business-layer 只 import 它的 `client/` SDK，不依赖具体实现
- 一份 `*magicclient.Client` 进程级单例，同时给 relay 和 web-api 用

---

## 5.5 日志要求（relay 内部打印）

relay 包**当前没有任何日志**。本次改造给它接入仓库统一的 **zap**（watcher 已用 `*zap.Logger`，已是现有依赖，无需新增）。

**logger 来源 / wiring**：
- `relay.Config` 加可选字段 `Logger *zap.Logger`；`relay.New` 里 `if cfg.Logger == nil { logger = zap.NewNop() }`，存到 `Client.log`。
- 顶层 `clients.go` 的 `Config` / `RelayConfig` 加可选 `Logger *zap.Logger`，透传给 `relay.Config`（不传则 nop，零行为变化）。

**打印位置**：集中在 `relay/service.go` 的 `submit()`（10 个方法都汇流到这里，一处即覆盖"方法名 + userID"），**不在 10 个方法里重复**。字段用 zap 结构化字段，不要 `fmt.Println`：

```go
// submit() 入口（拿到 job 之后）
c.log.Info("relay.submit start",
    zap.String("method", job.Method),       // 调用的方法，如 "PlaceBet"
    zap.String("user_id", job.UserID),       // ← 拿到的 userID 具体值
    zap.String("user_addr", job.UserAddr.Hex()),
    zap.String("target", job.Target.Hex()),
    zap.String("idempotency_key", job.IdempotencyKey),
)

// 算完 7702 auth digest（签名前）
c.log.Debug("relay.submit auth digest",
    zap.String("method", job.Method), zap.String("user_id", job.UserID),
    zap.String("auth_digest", hexutil.Encode(authDigest[:])),
    zap.Uint64("auth_nonce", aTxNonce))

// 算完 EIP-712 execute digest（签名前）
c.log.Debug("relay.submit execute digest",
    zap.String("method", job.Method), zap.String("user_id", job.UserID),
    zap.String("execute_digest", hexutil.Encode(execDigest[:])),
    zap.String("execute_nonce", execNonce.String()))

// 两次 Magic 签名各自成功后（v 字节便于排查 27/28 问题；不打 r/s 避免噪声）
c.log.Debug("relay.submit magic signed auth", zap.String("user_id", job.UserID), zap.Uint8("v", authSig[64]))
c.log.Debug("relay.submit magic signed execute", zap.String("user_id", job.UserID), zap.Uint8("v", sig[64]))

// 广播成功后
c.log.Info("relay.submit broadcast",
    zap.String("method", job.Method), zap.String("user_id", job.UserID),
    zap.String("tx_hash", hash.Hex()), zap.Int64("action_id", int64(actionID)),
    zap.Uint64("sponsor_nonce", bNonce))

// Magic 签名失败 / 广播失败时也各打一条 Warn（带 method + user_id + error）
```

**级别约定**：里程碑（入口 / 广播）用 `Info`；digest、签名细节用 `Debug`（生产默认不刷屏，开 debug 即可排查）；失败用 `Warn`。**绝不打印任何私钥**（本来 relay 也拿不到），签名只打 v 字节。

---

## 6. 实现顺序（推荐）

1. 部署 `magic-signer` 服务（按 `D:\everything_finance\oddfi-magic-client\DESIGN.md`）
2. 给 contracts-business-layer 进程发一个 caller token，注册到 magic-signer 的 `CALLER_TOKEN_*` env
3. `go.mod` 加 `require github.com/Crypto-Barrett/oddfi-magic-client v0.0.0` + `replace ... => D:/everything_finance/oddfi-magic-client`，`go mod tidy`（远程发布后去掉 replace、换正式 tag）
4. 写 `internal/eip7702/auth.go` 的 `AuthorizationDigest`（= `auth.SigHash()`）+ `AssembleAuthorization`（先纯函数）
5. 写 `internal/eip7702/auth_test.go`：用一个已知私钥跑 `crypto.Sign(AuthorizationDigest(...))` 后 `+27`，对比 `types.SignSetCode` 的 V/R/S，保证 digest + 组装一致
6. 改 `internal/eip7702/signer.go`：`SignExecuteInput` → `ExecuteDigestInput`，`ExecuteRequestDigest` 返回 `[32]byte`，删除 `SignExecute`
7. 写 `relay/signer.go`
8. 改 `relay/service.go`：`submitJob` 字段调整 + `submit()` 改造 + `wrapMagicErr`
9. 改 `relay/client.go`：Config / Client 加字段（含可选 `Logger *zap.Logger` → `Client.log`，nil 则 nop）+ 校验
10. 改 `relay/place_bet.go` + `relay/stubs.go`：10 个 Request 全改
11. 改 `relay/sponsored.go`：清掉 `signExecute` / `signAuth` 别名
12. 改 `clients.go`：两个 Config 加 UserSigner（+ 可选 `Logger *zap.Logger` 透传给 relay）
13. 写 `relay/place_bet_test.go` 等单测（含 mock Signer，实现 `WalletAddress` + `SignDigest` 两方法）
14. **改全部 relay 测试**：见 §5.2，把所有 `_test.go` 里 `crypto.GenerateKey()` + `PrivateKey:` 字段的用法换成 `fakeMagicSigner` + `UserID`/`UserAddr`
15. `go test ./... -race` 全绿

---

## 7. 验收清单

- [ ] `go test ./... -race` 全绿
- [ ] 10 个 relay 方法的 Request 结构里都有 `UserID` 和 `UserAddr`，没有 `*ecdsa.PrivateKey`
- [ ] `internal/eip7702` 里 user-side 没有 `*ecdsa.PrivateKey`（`SignExecute`/`SignAuthorization` 已删）
- [ ] `relay` 包内 `crypto_pubToAddr` **保留**（sponsor 用），user-side 调用点已清空
- [ ] `clients.go` 两个 Config 都需要传 `UserSigner` 才能构造成功
- [ ] `scenario_e2e_test.go` + `refund_methods_e2e_test.go` 全部 relay 调用改用 `fakeMagicSigner` + `UserID`/`UserAddr`，并跑通 PlaceBet → ClaimPayout
- [ ] `placebet_simulate_test.go` 未被改动（确认无回归）
- [ ] `usage-examples.md`（`docs/usage-examples.md`）更新成新的 API 用法
- [ ] `submit()` 内有结构化日志：入口打 `method` + `user_id`，广播打 `tx_hash`（见 §5.5），且不打印任何私钥/r/s
