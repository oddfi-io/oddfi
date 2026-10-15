# web-api ── 登录流程 + 链上调用接入 Magic Signer

**Date**: 2026-05-21
**Status**: 待评审
**Author**: brainstorming with niall
**Depends on**:
- [2026-05-21-magic-signer-service-spec.md](./2026-05-21-magic-signer-service-spec.md)（magic-signer 服务 + client SDK，位于 `D:\everything_finance\magic_client`）
- [2026-05-21-relay-magic-signer-integration.md](./2026-05-21-relay-magic-signer-integration.md)（relay 库改造）

**实施顺序**：必须**最后**改这个，因为它依赖前两个仓库先发版。

**项目路径**：`D:\everything_finance\org\oddfi-backend_dev\web-api`

---

## 0. 目标

把 web-api 从"托管钱包模型（用户资金挂在 `deposit_address.address`，pk 存 DB 明文）"切换到"Magic TEE 托管模型（用户资金挂在 Magic 给的 EOA，pk 在 Magic TEE 后端）"。

### 改了什么

1. **登录 step2**：新用户创建时不再从 deposit_address 池抽地址，而是调 Magic TEE 拿用户专属 EOA 落库
2. **链上调用**：onchain_tx.go 不再读 `deposit_address.pk`，改成把 `user_id + magic_address` 传给 relay 库
3. **充值地址展示**：`GetUserDepositAddress` 返回 `user.magic_address` 而不是 `deposit_address.address`
4. **表层**：废弃 `deposit_address` 整张表（含 pk 列）、`user_deposit_address` 表

### 没改什么

- ✅ SIWE step1/step2 的鉴权机制不变（用户依然用外部钱包签 SIWE message）
- ✅ JWT 签发、access/refresh token 流程不变
- ✅ user 表中 `signing_address`（外部钱包地址）字段含义不变，**只是新加一列 `magic_address`**
- ✅ 前端 API 接口形态完全不变
- ✅ 所有非链上业务（余额、注单查询、Banner 下注等）零改动

---

## 1. 硬约束

### 1.1 概念分离

- **`user.signing_address`** = 用户外部钱包地址（MetaMask / WalletConnect 等），**只用于登录鉴权**，不参与链上交易。
- **`user.magic_address`** = Magic TEE 为该 user 创建的链上 EOA，**所有 onchain 操作的对象都是它**。
- 这两个地址**必然不同**。前端展示充值地址时必须展示 `magic_address`。

### 1.2 一次性绑定

- `user.magic_address` 在用户首次走完 SIWE step2 时通过 Magic `/v1/wallet` 一次性落库
- 之后所有 onchain 调用直接读 `user.magic_address`，不再调 `/v1/wallet`
- Magic 端的 `user_id ↔ EOA` 映射是**确定性**的（同一 user_id 调多次 `/v1/wallet` 返同一地址），即使 magic_address 因故丢失也能再查回来

### 1.3 不允许的事

- ❌ 不要保留 `deposit_address.pk` 任何读取路径
- ❌ 不要写 `pk` 字段（即使保留列也不能再写）
- ❌ 不要在 relay 调用里手工生成或缓存 ecdsa.PrivateKey
- ❌ 不要在 handler / service 层临时调 Magic：所有 Magic 调用要么在登录服务里（落库），要么在 relay 库里（签名）

### 1.4 数据迁移

按 [2026-05-21-relay-magic-signer-integration.md](./2026-05-21-relay-magic-signer-integration.md) 前置讨论的约定，**deposit_address 表彻底废弃**（用户已确认）。但生产数据库里如果已经有现存用户跟 deposit_address 绑定过，需要做：

1. 给所有 `user_deposit_address` 中已有 user 跑一遍补登流程，调 Magic `/wallet` 拿到他们的 magic_address，UPDATE 到 `user.magic_address`
2. 把 deposit_address 上挂着的资金链上转移到对应的 magic_address（**这一步在本设计文档范围外**，需要单独的"链上资金迁移"任务）

如果生产数据是空的（开发环境 / 内测中），跳过迁移，直接用新表结构。

**回滚开关**：用 `config.MagicSigner.Enabled` 配置项控制。`false` 时整个 onchain_tx 服务返 503（"暂时不可用"）；不再退回旧 `deposit_address.pk` 路径——因为新用户已经没有 deposit_address.pk 落库了，混用会造成账本错乱。回滚 = 暂停服务，不 = 切换路径。

---

## 2. 数据库改动

### 2.1 新增列

```sql
ALTER TABLE user
    ADD COLUMN magic_address VARCHAR(128) NOT NULL DEFAULT '' AFTER signing_address,
    ADD INDEX idx_magic_address (magic_address);
```

理由：`magic_address` 跟 `signing_address` 是两个不同的地址，需要分别存。索引是为了后续按链上地址反查用户（例如链上事件 indexer 看到 BetPlaced 事件想找对应 user_id）。

### 2.2 废弃表

```sql
-- 阶段 1（上线时）：保留 deposit_address / user_deposit_address，但代码不再读写。
-- 阶段 2（稳定 2 周后）：物理删除。
DROP TABLE deposit_address;
DROP TABLE user_deposit_address;
```

并删除：
- `internal/model/deposit_address.go`
- `internal/model/user_deposit_address.go`
- 相关 repository 方法（见下）

### 2.3 不动的表

- `user`（加列，不动旧字段）
- `user_balance`
- `user_login_logs`
- `wallet_session`
- `onchain_tx_orders`（字段不动，但语义上 `user_id` 现在指 user.id，跟 magic_address 关联）
- `oddfi_onchain_markets`、`oddfi_fixtures` 等链上 indexer 表

---

## 3. 文件级改动清单

### 3.1 新增依赖

`go.mod`：
```
require (
    github.com/Crypto-Barrett/magic-signer/client v0.0.1
    github.com/Crypto-Barrett/contracts-business-layer v<update>
)
```

**重要**：`magic-signer/client` 只是 HTTP 客户端 SDK；真正的 Magic 调用、JWT 签发、私钥都在独立部署的 magic-signer 服务里（位置：`D:\everything_finance\magic_client`）。web-api 这边**不再持有 OIDC RSA 私钥**，安全面收窄到只持有一个调用 token。

### 3.2 新增配置

由于 magic-signer 服务有自己的全套配置，web-api 这边只需要两件事：**服务 URL** 和 **调用 token**。

`internal/config/config.go` 加：

```go
type MagicSignerConfig struct {
    Enabled   bool          // 默认 false；开启后才接入 magic-signer
    URL       string        // e.g. https://magic-signer.svc.cluster.local
    AuthToken string        // 调用方明文 token（不是 sha256）；来自 K8s Secret
    Timeout   time.Duration // 单次 HTTP 调用超时，默认 10s
}

type Config struct {
    // ... 已有字段
    MagicSigner MagicSignerConfig
}
```

`config_dev.yaml` / `config_prod.yaml` 加：

```yaml
magic_signer:
  enabled: true
  url: ${MAGIC_SIGNER_URL}        # e.g. https://magic-signer.svc.cluster.local
  auth_token: ${MAGIC_SIGNER_TOKEN} # 来自 K8s Secret，明文 token
  timeout: 10s
```

### 3.3 新增 wiring 文件

`internal/chain/magic_signer.go`（新文件，远比原方案简单）：

```go
package chain

import (
    "errors"
    "time"

    "everything_finance/org/web-api/internal/config"
    magicclient "github.com/Crypto-Barrett/magic-signer/client"
)

// NewMagicSigner 构造一个 client SDK 实例，指向独立部署的 magic-signer 服务。
// 同一进程只构造一次；既给 relay 库注入做签名，也给 login 服务直接调 WalletAddress 落库。
func NewMagicSigner(cfg config.MagicSignerConfig) (*magicclient.Client, error) {
    if !cfg.Enabled {
        return nil, errors.New("magic_signer disabled")
    }
    timeout := cfg.Timeout
    if timeout == 0 {
        timeout = 10 * time.Second
    }
    return magicclient.New(magicclient.Config{
        BaseURL:   cfg.URL,
        AuthToken: cfg.AuthToken,
        Timeout:   timeout,
    })
}
```

### 3.4 修改文件清单

| 文件                                              | 改动概要                                                          |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| `cmd/<entry>.go`（main / serve）                  | 启动时 `chain.NewMagicSigner(cfg.MagicSigner)`，把 signer 注入 RelayClient 构造 |
| `internal/chain/relay_client.go`                  | `NewRelayClient` 接收 magic signer；6 个 user-facing 方法签名从 `*ecdsa.PrivateKey` 改成 `userID string, userAddr common.Address` |
| `internal/service/onchain_tx.go`                  | 删 `userPrivateKey` 函数；所有 chain client 调用改成传 user_id + magic_address |
| `internal/service/auth.go`                        | `handleWalletLoginStep2` 在新建 user 后调 magicSigner.WalletAddress 落库；`GetUserDepositAddress` 改成读 magic_address |
| `internal/repository/user.go`                     | `CreateAllUserIDWithSigningAddress` 删除 deposit_address 分配段；新增 `SetMagicAddress(userID, addr)` 方法；`GetByID` / `GetByEmail` 返回里包含 magic_address；删除 `GetDepositAddress` / `GetUserDepositAddress` 旧实现 |
| `internal/model/user.go`                          | User 结构加 `MagicAddress string`字段，gorm tag `magic_address` |
| `internal/model/deposit_address.go`               | **删除**                                                          |
| `internal/model/user_deposit_address.go`          | **删除**                                                          |
| `internal/model/response.go`                      | `DepositAddressResponse.Address` 语义改为 magic 地址；JSON 字段名不变（前端兼容） |
| `internal/handler/auth.go`                        | 不动（响应字段名不变）                                            |
| `utils/key.go`                                    | `GetRedisDepositAddressesKey` 函数可删（Redis 那套预分配池作废）  |
| 各种 `*_test.go`                                  | 改 fixture：不再 mock deposit_address.pk；改 mock magic signer    |

---

## 4. 关键代码改动（diff 形式）

### 4.1 `internal/model/user.go`

```diff
 type User struct {
     UserID         uint64    `gorm:"column:user_id;primaryKey"`
     Email          string    `gorm:"column:email;size:128;index"`
     PasswordHash   string    `gorm:"column:password_hash"`
     SigningAddress string    `gorm:"column:signing_address;size:128;index"`
+    MagicAddress   string    `gorm:"column:magic_address;size:128;index"`
     Nickname       string    `gorm:"column:nickname"`
     Status         int8      `gorm:"column:status"`
     KycLevel       int8      `gorm:"column:kyc_level"`
     TwoFAEnable    int8      `gorm:"column:two_fa_enable"`
     CreatedAt      time.Time `gorm:"column:created_at;autoCreateTime"`
     UpdatedAt      time.Time `gorm:"column:updated_at;autoUpdateTime"`
 }
```

### 4.2 `internal/repository/user.go`：CreateAllUserIDWithSigningAddress

```diff
 func (r *userRepo) CreateAllUserIDWithSigningAddress(ctx context.Context, chain, address string) (*model.User, error) {
     var user *model.User
-    var depositAddr model.DepositAddress
-    var depositAddress string

     err := r.gdb.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
         // 1. 创建 user 行（magic_address 暂时为空，由 service 后续填）
         user = &model.User{
             UserID:         snowflake.GenerateID(),
             SigningAddress: address,
+            // MagicAddress 此时为空字符串，service.handleWalletLoginStep2 拿到后再 UPDATE
             PasswordHash:   "",
             Status:         1,
         }
         if err := tx.Create(user).Error; err != nil {
             return err
         }

-        // 2. 从 deposit_address 池抽地址 — 删除整段
-        if err := tx.Where("chain = ? AND status = ?", chain, model.DepositAddressStatusUnused).
-            First(&depositAddr).Error; err != nil {
-            return err
-        }
-        // 3. 乐观锁更新 deposit_address.status = 1 — 删除整段
-        // 4. 写 user_deposit_address — 删除整段

         // 5. user_balance 不变
         userBalance := &model.UserBalance{ /* ... */ }
         if err := tx.Create(userBalance).Error; err != nil {
             return err
         }

         // 6. user_login_logs 不变
         loginLog := &model.UserLoginLog{ /* ... */ }
         if err := tx.Create(loginLog).Error; err != nil {
             return err
         }
         return nil
     })
     if err != nil {
         return nil, err
     }

-    // 删除 Redis SAdd 那一段
     return user, nil
 }
```

### 4.3 `internal/repository/user.go`：新增 SetMagicAddress

```go
func (r *userRepo) SetMagicAddress(ctx context.Context, userID uint64, magicAddr string) error {
    if magicAddr == "" {
        return errors.New("magic_address cannot be empty")
    }
    res := r.gdb.WithContext(ctx).Model(&model.User{}).
        Where("user_id = ? AND (magic_address = '' OR magic_address IS NULL)", userID).
        Update("magic_address", magicAddr)
    if res.Error != nil {
        return res.Error
    }
    if res.RowsAffected == 0 {
        // 已有值或 user 不存在；前者属于幂等成功（同一个值），后者属于异常
        var user model.User
        if err := r.gdb.WithContext(ctx).Where("user_id = ?", userID).First(&user).Error; err != nil {
            return err
        }
        if !strings.EqualFold(user.MagicAddress, magicAddr) {
            return fmt.Errorf("user %d already has different magic_address: existing=%s incoming=%s",
                userID, user.MagicAddress, magicAddr)
        }
    }
    return nil
}

// 加到 UserRepo 接口里
type UserRepo interface {
    // ... 已有方法
    SetMagicAddress(ctx context.Context, userID uint64, magicAddr string) error
    GetMagicAddress(ctx context.Context, userID uint64) (string, error)
}

func (r *userRepo) GetMagicAddress(ctx context.Context, userID uint64) (string, error) {
    var user model.User
    if err := r.gdb.WithContext(ctx).Select("magic_address").Where("user_id = ?", userID).First(&user).Error; err != nil {
        return "", err
    }
    return user.MagicAddress, nil
}
```

### 4.4 `internal/service/auth.go`：handleWalletLoginStep2

```diff
+import (
+    magicclient "github.com/Crypto-Barrett/magic-signer/client"
+)

 type authService struct {
     // ... 已有字段
+    magicSigner magicclient.Signer   // 可为 nil（未启用 Magic 时）
 }

 func NewAuthService(
     userRepo repository.UserRepo,
     tokenRepo repository.TokenRepo,
     walletSessionRepo repository.WalletSessionRepo,
     cfg *config.Config,
     onchainRepo repository.OnchainTxRepo,
     marketRepo repository.MarketRepo,
+    magicSigner magicclient.Signer,
 ) AuthService {
     return &authService{
         /* ... 已有 */
+        magicSigner: magicSigner,
     }
 }

 func (s *authService) handleWalletLoginStep2(ctx context.Context, req *model.WalletLoginRequest) (*model.WalletLoginResponse, error) {
     // ... 已有的签名校验、nonce 校验

     user, err := s.userRepo.GetByWalletAddress(ctx, req.Address)
     if err != nil { return nil, err }

     if user == nil {
         newUser, err := s.userRepo.CreateAllUserIDWithSigningAddress(ctx, strings.ToLower(req.Chain), req.Address)
         if err != nil { return nil, err }
         user = newUser
     }

+    // 确保 user.magic_address 已落库；缺失就调 Magic 拉一次然后写回
+    if user.MagicAddress == "" {
+        if s.magicSigner == nil {
+            return nil, errors.New("magic signer not configured but user has no magic_address")
+        }
+        addr, err := s.magicSigner.WalletAddress(ctx, strconv.FormatUint(user.UserID, 10))
+        if err != nil {
+            return nil, fmt.Errorf("provision magic address for user %d: %w", user.UserID, err)
+        }
+        if err := s.userRepo.SetMagicAddress(ctx, user.UserID, addr.Hex()); err != nil {
+            return nil, err
+        }
+        user.MagicAddress = addr.Hex()
+    }

     // ... 后续 JWT 生成不变
 }
```

### 4.5 `internal/service/auth.go`：GetUserDepositAddress

```diff
 func (s *authService) GetUserDepositAddress(ctx context.Context, userId uint64, chain string) (*model.DepositAddressResponse, error) {
-    depositAddress, err := s.userRepo.GetUserDepositAddress(ctx, userId, chain)
+    addr, err := s.userRepo.GetMagicAddress(ctx, userId)
     if err != nil {
         return nil, err
     }
+    if addr == "" {
+        return nil, errors.New("user has no magic address; please complete login flow first")
+    }
     return &model.DepositAddressResponse{
-        Address: depositAddress.Address,
+        Address: addr,
         Chain:   chain,
     }, nil
 }
```

### 4.6 `internal/chain/relay_client.go`

```diff
+import (
+    magicclient "github.com/Crypto-Barrett/magic-signer/client"
+)

 type RelayClient struct {
     cfg     config.ChainConfig
     clients *business.RelayClients
     eth     *ethclient.Client
+    signer  magicclient.Signer
 }

-func NewRelayClient(ctx context.Context, cfg config.ChainConfig, db *gorm.DB) (*RelayClient, error) {
+func NewRelayClient(ctx context.Context, cfg config.ChainConfig, db *gorm.DB, signer magicclient.Signer) (*RelayClient, error) {
     c := &RelayClient{cfg: cfg}
     // ... 已有的 enabled / dryRun 校验
+    if signer == nil {
+        return nil, errors.New("magic signer is required")
+    }
+    c.signer = signer

     // ... 已有的 sponsor key 读取、eth dial 等

     clients, err := business.NewRelayClients(ctx, business.RelayConfig{
         RPCURL:            cfg.RPCURL,
         ChainID:           big.NewInt(cfg.ChainID),
         SponsorPrivateKey: sponsorKey,
+        UserSigner:        signer,                   // ← 新增
         SponsorImpl:       common.HexToAddress(cfg.SponsorImplAddress),
         // ... 其余不变
     })
     /* ... */
 }

-// 删除 ParsePrivateKey 函数（不再有调用方）
-// 删除 UserAddress(privateKey *ecdsa.PrivateKey) common.Address 方法

-func (c *RelayClient) Approve(ctx context.Context, privateKey *ecdsa.PrivateKey, spender common.Address, value *big.Int, idem string) (TxResult, error) {
+func (c *RelayClient) Approve(ctx context.Context, userID string, userAddr common.Address, spender common.Address, value *big.Int, idem string) (TxResult, error) {
     if c.cfg.DryRun || c.clients == nil { return dryRunResult("approve", idem), nil }
-    res, err := c.clients.Relay.Approve(ctx, relay.ApproveRequest{PrivateKey: privateKey, Spender: spender, Value: value, IdempotencyKey: idem})
+    res, err := c.clients.Relay.Approve(ctx, relay.ApproveRequest{
+        UserID: userID, UserAddr: userAddr,
+        Spender: spender, Value: value, IdempotencyKey: idem,
+    })
     return asyncResult(res.TxHash, res.ActionID, idem), err
 }

-func (c *RelayClient) PlaceBet(ctx context.Context, privateKey *ecdsa.PrivateKey, market coretypes.MarketKey, ...) (PlaceBetResult, error) {
+func (c *RelayClient) PlaceBet(ctx context.Context, userID string, userAddr common.Address, market coretypes.MarketKey, ...) (PlaceBetResult, error) {
     if c.cfg.DryRun || c.clients == nil { /* ... */ }
-    req := relay.PlaceBetRequest{PrivateKey: privateKey, Market: market, ...}
+    req := relay.PlaceBetRequest{UserID: userID, UserAddr: userAddr, Market: market, ...}
     res, err := c.clients.Relay.PlaceBet(ctx, req)
     return PlaceBetResult{TxResult: asyncResult(res.TxHash, res.ActionID, idem)}, err
 }

// ClaimPayout / DepositGlobal / DepositMatch / RequestUnbond / Withdraw — 同样改造
```

### 4.7 `internal/service/onchain_tx.go`

```diff
 type onchainTxService struct {
     relay       *chainclient.RelayClient
     userRepo    repository.UserRepo
     onchainRepo repository.OnchainTxRepo
 }

-func (s *onchainTxService) userPrivateKey(ctx context.Context, userID uint64) (*ecdsa.PrivateKey, error) {
-    // 整段删除
-}

+// userMagicCtx 是替代 userPrivateKey 的辅助：返回 user_id（字符串形式，给 Magic 用）和 magic_address。
+func (s *onchainTxService) userMagicCtx(ctx context.Context, userID uint64) (string, common.Address, error) {
+    if s.userRepo == nil {
+        return "", common.Address{}, errors.New("user repo is required")
+    }
+    if userID == 0 {
+        return "", common.Address{}, errors.New("user_id is required")
+    }
+    addr, err := s.userRepo.GetMagicAddress(ctx, userID)
+    if err != nil {
+        return "", common.Address{}, err
+    }
+    if !common.IsHexAddress(addr) {
+        return "", common.Address{}, fmt.Errorf("user %d has invalid or missing magic_address; complete login flow first", userID)
+    }
+    return strconv.FormatUint(userID, 10), common.HexToAddress(addr), nil
+}

 func (s *onchainTxService) Approve(ctx context.Context, userID uint64, req model.OnchainApproveRequest) (*model.OnchainTxResponse, error) {
     if s.relay == nil { return nil, ErrOnchainClientDisabled }
-    key, err := s.userPrivateKey(ctx, userID)
+    uidStr, userAddr, err := s.userMagicCtx(ctx, userID)
     if err != nil { return nil, err }

     amount, err := chainclient.ParseWei(req.AmountWei, "amount_wei")
     if err != nil { return nil, err }

-    res, err := s.relay.Approve(ctx, key, common.HexToAddress(req.Spender), amount, req.IdempotencyKey)
+    res, err := s.relay.Approve(ctx, uidStr, userAddr, common.HexToAddress(req.Spender), amount, req.IdempotencyKey)
     if err != nil { return nil, err }

     /* ... saveTxOrder 不变 */
 }

 // 其余 7 个方法（PlaceBet / ClaimPayout / DepositGlobal / DepositMatch / RequestUnbond / Withdraw / GetOrder 除外）同样改造
```

---

## 5. 测试要求

### 5.1 单测改造

- `internal/repository/user_test.go`：
  - `CreateAllUserIDWithSigningAddress`：验证不再写 deposit_address，user 行 magic_address 字段是空字符串
  - 新增 `SetMagicAddress` / `GetMagicAddress` 单测：第一次 SET 成功，第二次 SET 同样值幂等，第二次 SET 不同值返错误
- `internal/service/auth_test.go`：
  - `handleWalletLoginStep2`：mock magicSigner.WalletAddress，断言 user.magic_address 被正确落库
  - 新用户首次登录调一次 magic；老用户已有 magic_address 时不再调 magic
- `internal/service/onchain_tx_test.go`：
  - 用户没有 magic_address → 返 error，不调 relay
  - 正常路径 → relay 收到正确的 user_id + user_addr

### 5.2 集成测试

`internal/service/verify_test.go` 改造：跑一遍完整登录 → Approve → PlaceBet 流程，用 `fakeMagicSigner`（map 存内存的实现）替代真实 Magic。

### 5.3 端到端测试

在 staging Magic + BSC testnet 环境跑：

1. 新用户用 MetaMask 登录 → 验证 user 表里 signing_address 和 magic_address 都有，且不同
2. 调 `GET /api/user/deposit_address?chain=bsc` → 返 magic_address
3. 给 magic_address 充值 0.1 ODD（用 faucet）
4. 调 Approve → 验证 tx 成功，BettingPool 对 magic_address 有 allowance
5. 调 PlaceBet → 验证 tx 成功，链上事件 BetPlaced 的 better 字段 = magic_address
6. 调 ClaimPayout（假设市场已结算，且这是赢的注单）→ 验证收到 payout

---

## 6. 实施顺序（关键 — 必须严格按序）

1. **前置**：`oddfi-magic-client` v0.0.1 已发版（按 magic 库 spec）
2. **前置**：`contracts-business-layer` v<x.y.z> 已发版且新版本接受 `UserSigner`（按 relay spec）
3. 创建 db migration：`ALTER TABLE user ADD COLUMN magic_address`，在测试库验证后上 staging
4. 改 `internal/model/user.go` 加 `MagicAddress` 字段
5. 改 `internal/repository/user.go`：删旧的 deposit 段，加 `SetMagicAddress` / `GetMagicAddress`
6. 改 `internal/service/auth.go`：注入 magicSigner，handleWalletLoginStep2 写 magic_address
7. 改 `internal/chain/relay_client.go`：6 个方法签名调整
8. 改 `internal/service/onchain_tx.go`：删 userPrivateKey，加 userMagicCtx
9. 改 `cmd/<entry>.go`：启动时构造 magicSigner 并注入 RelayClient + AuthService
10. 跑全套单测
11. 跑 staging 端到端测试（步骤 5.3）
12. 上线（先开 feature flag false，灰度后切 true）
13. 稳定 2 周后跑 `DROP TABLE deposit_address; DROP TABLE user_deposit_address`，删除相关 model 文件

---

## 7. 回滚策略

如发现 Magic 端有严重 bug 需要回滚：

- 把 `config.MagicSigner.Enabled` 设为 `false`
- 老的 `deposit_address` 表如果还在（阶段 1 内）就能直接退回去
- 此时需要紧急写一个临时 fallback：onchain_tx.go 检测 magic disabled → 报 503 / 友好提示"暂时不可下单，5 分钟后再试"，**不要**自动退回 deposit_address.pk 路径——那会绕过 Magic 的资产托管模型，造成资金账户混乱

---

## 8. 验收清单

- [ ] DB migration 成功执行，所有现存 user 行 magic_address 字段存在
- [ ] 新用户走 SIWE 后 user.magic_address 已落库且符合 EOA 地址格式
- [ ] 老用户首次访问 / login refresh 时补登 magic_address
- [ ] `GET /api/user/deposit_address` 返回 magic_address
- [ ] 充值流程文档更新（用户充值地址换成 magic_address）
- [ ] Approve / PlaceBet / ClaimPayout / Deposit / Unbond / Withdraw 在 staging 全跑通
- [ ] `go test ./... -race` 全绿
- [ ] 监控面板上 Magic API 错误率 / 延迟 dashboards 部署
- [ ] 灰度上线 → 100% 切换 → 删除旧表

---

## 9. 未在本文档解决的问题

- ❓ **存量资金迁移**：如果生产已有用户在 deposit_address 上有 ODD 余额，需要一个一次性工具（链上 transfer + 链下账本调整）。这是独立任务。
- ❓ **Magic 服务降级**：Magic 全挂时整个链上操作不可用。需不需要"读请求继续可用，写请求返 503"的分级降级？属于运维加固，独立做。
- ❓ **多链支持**：当前 Magic API 头部 `X-Magic-Chain: ETH` 硬编码。如果未来要支持非 EVM 链（如 Solana），那时再扩展。本设计假定全链都是 EVM。
