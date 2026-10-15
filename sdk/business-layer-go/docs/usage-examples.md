# 调用指南 — `contracts-business-layer`

给引用本包的后端同学的完整使用手册。所有示例都是**可直接复制运行**的 Go 代码。

---

## 目录

1. [三个 client 与部署形态](#1-三个-client-与部署形态)
2. [初始化 — 三种生产部署模式](#2-初始化--三种生产部署模式)
3. [核心用户故事：代付下注](#3-核心用户故事代付下注)
4. [admin 操作示例](#4-admin-操作示例)
5. [read 操作示例](#5-read-操作示例)
6. [错误处理](#6-错误处理)
7. [幂等键用法](#7-幂等键用法)
8. [`MarketKey` vs `MarketID`](#8-marketkey-vs-marketid)
9. [A 形态 vs B 形态](#9-a-形态-vs-b-形态)
10. [chain_actions 状态查询](#10-chain_actions-状态查询)
11. [常见陷阱](#11-常见陷阱)

---

## 1. 三个 client 与部署形态

```
admin/    平台运营写        ←  admin 私钥 + DB
relay/    用户代付写        ←  sponsor 私钥 + DB（用户出自己的私钥每次传入）
read/     纯链上读          ←  无私钥, 无 DB
```

**最小权限原则**：每个微服务只持有自己需要的能力。read-svc 的私钥/DB 都拿不到 → 即便被攻破也不能动资金。

---

## 2. 初始化 — 三种生产部署模式

### 模式 A：admin 后台服务（持有 admin 私钥）

```go
import (
    "context"
    "math/big"

    "github.com/ethereum/go-ethereum/common"
    "github.com/ethereum/go-ethereum/crypto"
    "gorm.io/driver/mysql"
    "gorm.io/gorm"

    business "github.com/Crypto-Barrett/contracts-business-layer"
)

func mustBuildAdminSvc(ctx context.Context) *business.AdminClients {
    db, err := gorm.Open(mysql.Open("user:pass@tcp(.../chain_actions)?parseTime=true"), &gorm.Config{})
    if err != nil { panic(err) }

    adminKey, _ := crypto.HexToECDSA("ADMIN_PRIVATE_KEY_HEX_NO_0x")

    clients, err := business.NewAdminClients(ctx, business.AdminConfig{
        RPCURL:           "https://bsc-testnet-rpc.publicnode.com",
        ChainID:          big.NewInt(97),
        AdminPrivateKey:  adminKey,
        ODDToken:         common.HexToAddress("0x..."),
        BettingPool:      common.HexToAddress("0x..."),
        StakingPool:      common.HexToAddress("0x..."),
        LiquidityPool:    common.HexToAddress("0x..."),
        MulticallAddress: common.Address{}, // 零 = 默认 0xcA11bde...
        DB:               db,
        Confirmations:    2,
    })
    if err != nil { panic(err) }
    return clients
}

// 使用:
adminClients := mustBuildAdminSvc(ctx)
defer adminClients.Close(ctx)

adminClients.Admin.OpenMarketWithReceipt(ctx, ...)        // 主能力
status, _ := adminClients.Actions.GetStatus(ctx, actionID) // chain_actions 查询
```

### 模式 B：用户 API 网关（持有 sponsor 私钥 + Magic 签名客户端）

```go
import magicclient "github.com/Crypto-Barrett/oddfi-magic-client/client"

sponsorKey, _ := crypto.HexToECDSA("SPONSOR_KEY_HEX")

// Magic 签名客户端（指向独立部署的 magic-signer 服务）。进程级单例。
signer, err := magicclient.New(magicclient.Config{
    BaseURL:   os.Getenv("MAGIC_SIGNER_URL"),
    AuthToken: os.Getenv("MAGIC_SIGNER_TOKEN"),
    Timeout:   10 * time.Second,
})
if err != nil { panic(err) }

relayClients, err := business.NewRelayClients(ctx, business.RelayConfig{
    RPCURL:            "https://bsc-testnet-rpc.publicnode.com",
    ChainID:           big.NewInt(97),
    SponsorPrivateKey: sponsorKey,
    UserSigner:        signer,                                 // 必填: 替用户签名
    SponsorImpl:       common.HexToAddress("0x6f7522e1..."),   // SponsoredDelegator deploy address
    ODDToken:          common.HexToAddress("0x..."),
    BettingPool:       common.HexToAddress("0x..."),
    StakingPool:       common.HexToAddress("0x..."),
    LiquidityPool:     common.HexToAddress("0x..."),
    DB:                db,
    Confirmations:     2,
    SignatureDeadline: 15 * time.Minute,
    // Logger:         zapLogger,  // 可选; 打 method + user_id + tx_hash
})
if err != nil { panic(err) }
defer relayClients.Close(ctx)

// 使用 (用户每次传自己的 user_id + Magic 钱包地址，不再传私钥):
res, _ := relayClients.Relay.PlaceBetWithReceipt(ctx, relay.PlaceBetRequest{
    UserID:   userID,   // 登录时落库的 Magic user_id
    UserAddr: userAddr, // 登录时落库的 user.magic_address
    ...
})
```

### 模式 C：read 服务 / 前端 BFF（无私钥、无 DB）

```go
import "github.com/Crypto-Barrett/contracts-business-layer/cache"

readClients, err := business.NewReadClients(ctx, business.ReadConfig{
    RPCURL:        "https://bsc-testnet-rpc.publicnode.com",
    ChainID:       big.NewInt(97),
    ODDToken:      common.HexToAddress("0x..."),
    BettingPool:   common.HexToAddress("0x..."),
    StakingPool:   common.HexToAddress("0x..."),
    LiquidityPool: common.HexToAddress("0x..."),
    Cache:         cache.NewInProcess(), // 可选; nil = 每次打 RPC
})
if err != nil { panic(err) }
defer readClients.Close(ctx)

// 使用 (只读链上数据):
balance, _ := readClients.Read.BalanceOf(ctx, userAddr)
market, _ := readClients.Read.GetMarket(ctx, marketKey)
```

### 模式 D：dev / 一体化（一次性构造所有三个）

```go
clients, _ := business.NewClients(ctx, business.Config{
    RPCURL:            "...",
    ChainID:           big.NewInt(97),
    AdminPrivateKey:   adminKey,
    SponsorPrivateKey: sponsorKey, // 可选, nil = 复用 AdminPrivateKey
    UserSigner:        signer,     // 必填, *magicclient.Client
    ODDToken/BettingPool/StakingPool/LiquidityPool: ...,
    SponsorImpl:       common.HexToAddress("..."),
    DB:                db,
    Cache:             cache.NewInProcess(),
})
defer clients.Close(ctx)

clients.Admin.OpenMarketWithReceipt(...)
clients.Relay.PlaceBetWithReceipt(...)
clients.Read.GetMarket(...)
```

> **生产推荐 A/B/C 分服务**。模式 D 仅用于开发期。

---

## 3. 核心用户故事：代付下注

用户原话："**传入 ctx + A 的 user_id + 金额，调用下注接口，内部用 Magic 替 A 签名 + sponsor 代付 gas，返回上链的 hash**"。

```go
import (
    "context"
    "math/big"
    "time"

    "github.com/ethereum/go-ethereum/common"

    "github.com/Crypto-Barrett/contracts-business-layer/coretypes"
    "github.com/Crypto-Barrett/contracts-business-layer/relay"
)

// 用户 API: 用户下注
func PlaceBetForUser(
    ctx context.Context,
    relayCli *relay.Client,
    userID string,          // Magic user_id (登录时落库)
    userAddr common.Address, // user.magic_address (登录时落库)
    matchID coretypes.MatchID,
    marketType uint8, line uint8,
    outcome uint8,
    amountWei *big.Int,
    idemKey string,
) (coretypes.TxHash, coretypes.BetID, error) {
    res, err := relayCli.PlaceBetWithReceipt(ctx, relay.PlaceBetRequest{
        UserID:   userID,
        UserAddr: userAddr,
        Market: coretypes.MarketKey{
            MatchID:    matchID,
            MarketType: marketType, // 0 = 1x2 / 1 = AH / 2 = OU
            Line:       line,
        },
        Outcome:           outcome,
        Amount:            amountWei,
        MinAcceptedAmount: big.NewInt(1),
        MinOdds:           big.NewInt(10100), // 最低赔率 1.01 (1e4 精度)
        Deadline:          uint64(time.Now().Add(15 * time.Minute).Unix()),
        IdempotencyKey:    idemKey,
    })
    if err != nil {
        return "", coretypes.BetID{}, err
    }
    return res.TxHash, res.BetID, nil
}
```

**内部流程**（用户无需知道）：

1. multicall 1 个 RPC 查 `BalanceOf(user) + AccountedBalance() + GetMarketOdds(marketID)`
2. Magic 替 user 签 SetCodeAuthorization digest（EIP-7702 delegate）
3. Magic 替 user 签 EIP-712 Execute typed data digest
4. sponsor 私钥包装成 SetCodeTx（type 0x04），付 gas，广播
5. 等 2 块确认 → 解析 `BetPlaced` event 拿 BetID
6. 落 `chain_actions` 行

如果只想要 hash（不阻塞 11+ 秒等回执），用 A 形态：

```go
res, _ := relayCli.PlaceBet(ctx, req) // 几秒返回
// res.TxHash 已可用; res.ActionID 用于后续查 chain_actions
```

---

## 4. admin 操作示例

### 开盘

```go
res, err := adminCli.OpenMarketWithReceipt(ctx, admin.OpenMarketRequest{
    MatchID:        matchID,
    MarketType:     0, // 1x2
    Line:           0,
    MatchStartTime: uint64(time.Now().Add(2*time.Hour).Unix()),
    MatchEndTime:   uint64(time.Now().Add(4*time.Hour).Unix()),
    BaseOdds:       []*big.Int{big.NewInt(20000), big.NewInt(30000), big.NewInt(20000)}, // 2.0 / 3.0 / 2.0
    UpdatedAt:      uint64(time.Now().Unix()),
    IdempotencyKey: "openmarket-match42-1x2-2026-05-15",
})
```

> 调 `OpenMarket` 时合约**自动联动** `LiquidityPool.openMatchPool(matchID)`——LP 池随之就绪。

### 运营更新赔率

`UpdateOdds` 需 `OPERATOR_ROLE`。仅在 market 未终态且未到 `lockAt = matchStartTime - 5min` 时可调；`BaseOdds` 长度必须等于 market 的 `outcomeCount`，赔率精度为 `1e4`（20000 = 2.0）。

```go
_, err := adminCli.UpdateOddsWithReceipt(ctx, admin.UpdateOddsRequest{
    Market:         coretypes.MarketKey{MatchID: matchID, MarketType: 0, Line: 0},
    BaseOdds:       []*big.Int{big.NewInt(21000), big.NewInt(29000), big.NewInt(21000)}, // 2.1 / 2.9 / 2.1
    UpdatedAt:      uint64(time.Now().Unix()),
    IdempotencyKey: "updateodds-match42-1x2-v2-2026-05-15",
})
```

### 结算

```go
// 必须等到 block.timestamp >= market.matchEndTime
_, err := adminCli.SettleMarketWithReceipt(ctx, admin.SettleMarketRequest{
    Market:         coretypes.MarketKey{MatchID: matchID, MarketType: 0, Line: 0},
    ResultKind:     0, // 0 = Settled, 1 = Refunded, 2 = Cancelled
    WinningOutcome: 1,
    IdempotencyKey: "settle-match42-1x2-2026-05-15",
})
```

> `ResultKind=1/2` 只把 market 标记为 Refunded/Cancelled，pending 注单**不会**被自动退款，需要随后调 `RefundBets` 逐笔退。

### 批量退款（结算为 Refunded/Cancelled 之后）

`RefundBets` 需 `SETTLER_ROLE`。market 状态必须已经是 `Refunded` 或 `Cancelled`（通常先走 `SettleMarketWithReceipt(..., ResultKind: 1 或 2, ...)`），单批 ≤ 20 条，`BetIDs` 与 `RefundAmounts` 长度必须相等。

```go
_, err := adminCli.RefundBetsWithReceipt(ctx, admin.RefundBetsRequest{
    Market:         coretypes.MarketKey{MatchID: matchID, MarketType: 0, Line: 0},
    BetIDs:         []coretypes.BetID{betA, betB},
    RefundAmounts:  []*big.Int{big.NewInt(100_000_000_000_000_000_000), big.NewInt(50_000_000_000_000_000_000)}, // 100 / 50 ODD
    IdempotencyKey: "refundbets-match42-1x2-batch1-2026-05-15",
})
```

### 让球 Push 整盘退款

`PushRefundMarket` 需 `SETTLER_ROLE`，**仅适用 `MarketType=1, Line=1` 的让球 -1 push 场景**。调用后 market 立即变 `Refunded`，传入的 ≤ 20 条 pending 注单被全额退款；若 pending 数 > 20，剩余的要继续走 `RefundBets`。

```go
_, err := adminCli.PushRefundMarketWithReceipt(ctx, admin.PushRefundMarketRequest{
    Market:         coretypes.MarketKey{MatchID: matchID, MarketType: 1, Line: 1},
    BetIDs:         []coretypes.BetID{betA, betB, betC},
    IdempotencyKey: "pushrefund-match42-ah1-2026-05-15",
})
```

### 角色授权 / 平台注资

```go
operatorRole := crypto.Keccak256Hash([]byte("OPERATOR_ROLE"))
adminCli.GrantRoleWithReceipt(ctx, admin.GrantRoleRequest{
    Role:           operatorRole,
    Account:        operatorAddr,
    IdempotencyKey: "grant-operator-...",
})

adminCli.AddPlatformReserveWithReceipt(ctx, admin.AddPlatformReserveRequest{
    Amount:         big.NewInt(10000_000_000_000_000_000_00), // 10000 ODD
    IdempotencyKey: "add-reserve-2026-05-15",
})
```

---

## 5. read 操作示例

```go
// 用户余额
bal, _ := readCli.BalanceOf(ctx, userAddr)   // 返回 decimal.Decimal (ODD wei)

// 市场状态
mkt, _ := readCli.GetMarket(ctx, marketKey)
// mkt.Status: Open / Locked / Settled / Refunded / Cancelled

// 实时赔率
odds, _ := readCli.GetMarketOdds(ctx, marketKey)
// odds.BaseOdds / odds.QuotedOdds: []decimal.Decimal, 已自动除以 1e4 (拿到 2.0 不是 20000)

// 下注预览 (不上链)
preview, _ := readCli.PreviewSignal(ctx, marketKey, outcome, decimal.NewFromInt(100))
// preview.Color: Green/Yellow/Orange/Red
// preview.AcceptedAmount / preview.LockedOdds / preview.PartialFill

// Bet 状态
bet, _ := readCli.GetBet(ctx, betID)
// bet.SettlementState: Pending / Refunded / Lost / WonUnclaimed / WonClaimed
// bet.ClaimablePayout

// 全局信息
tax, _ := readCli.BetTaxBps(ctx)
paused, _ := readCli.BettingPoolPaused(ctx)
totalLP, _ := readCli.TotalActiveDeposited(ctx)
```

---

## 5.5 串关 (Parlay) 操作示例

串关 = 一张注单组合 2~6 条不同场次的腿，全部命中才中奖。落到三个库：
- **relay**（用户态、Magic 代付）：`PlaceParlay` / `ClaimParlayPayout`
- **admin**（SETTLER/ADMIN 角色，直签）：`SettleParlay` / `ReleasePayoutReserve` / `SetParlayModule`
- **read**（只读）：`PreviewParlay` / `GetParlay` / `GetParlayLeg` / `EstimateParlayValue` / `OpenParlayMaxPayout` / `MarketFinalResult`

> ⚠️ `PreviewParlay` / `EstimateParlayValue` 走 `BettingParlayLens` 合约，构造 client 时必须设置
> `Config.BettingParlayLens`（或 `ReadConfig.BettingParlayLens`），否则这两个读会报错。

```go
// 每条腿：MarketKey + 选项 + 用户当时看到的报价快照（防过期）
legs := []coretypes.ParlayLegInput{
    {Market: marketA, Outcome: 0, QuoteVersion: oddsA.QuoteVersion.BigInt(), QuotedAt: oddsA.UpdatedAt, MinOdds: big.NewInt(20000)},
    {Market: marketB, Outcome: 1, QuoteVersion: oddsB.QuoteVersion.BigInt(), QuotedAt: oddsB.UpdatedAt, MinOdds: big.NewInt(20000)},
}

// 1) 下注前预览（不上链）：组合赔率、封顶、剩余容量
pv, _ := readCli.PreviewParlay(ctx, legs, decimal.NewFromInt(100), userAddr)
// pv.LockedComboOdds（已除 1e4）/ pv.MaxPayout / pv.CappedByOdds / pv.CappedByPayout

// 2) 用户下注（Magic 代付）。两种形态同名：
//    A 形态返回 tx hash 立即返回；B 形态等回执并解析 ParlayPlaced。
res, _ := relayCli.PlaceParlayWithReceipt(ctx, relay.PlaceParlayRequest{
    UserID: userID, Legs: legs, Stake: stakeWei,
    MinComboOdds: big.NewInt(39000), Deadline: deadline,
    IdempotencyKey: "parlay-" + runTag,
})
parlayID := res.ParlayID // coretypes.ParlayID（来自 ParlayPlaced 事件）

// 3) 所有腿对应市场结算敲定后，SETTLER 结算整盘
adminCli.SettleParlayWithReceipt(ctx, admin.SettleParlayRequest{
    ParlayID: parlayID, IdempotencyKey: "parlay-settle-" + runTag,
})

// 4) 估值（只读，展示用，非可领金额）
est, _ := readCli.EstimateParlayValue(ctx, parlayID)
// est.State / est.EstimatedValue / est.IsFinal

// 5) 用户领奖（Magic 代付）
relayCli.ClaimParlayPayoutWithReceipt(ctx, relay.ClaimParlayPayoutRequest{
    UserID: userID, ParlayID: parlayID, IdempotencyKey: "parlay-claim-" + runTag,
})

// 6) （可选）中奖未领的储备金，SETTLER 用 parlayRiskId 释放回全局 LP
p, _ := readCli.GetParlay(ctx, parlayID) // p.ParlayRiskID
adminCli.ReleasePayoutReserveWithReceipt(ctx, admin.ReleasePayoutReserveRequest{
    RiskID: p.ParlayRiskID, IdempotencyKey: "parlay-release-" + runTag,
})
```

约束：腿数 2~6、同一 `matchId` 不能两条腿、组合赔率封顶 200x、整盘 maxPayout 受全局容量封顶。

---

## 6. 错误处理

**4 大类**——按这个 switch：

```go
import (
    "errors"
    "github.com/Crypto-Barrett/contracts-business-layer/coretypes"
)

func handle(err error) {
    if err == nil { return }

    var biz *coretypes.BusinessError
    if errors.As(err, &biz) {
        // 用户输入/状态错误，不可重试
        log.Warn("biz error", "code", biz.Code, "op", biz.Op)
        return
    }

    var retry *coretypes.RetryableError
    if errors.As(err, &retry) {
        // RPC 抖动 / Redis 故障，业务上层指数退避重试 (幂等键不变)
        log.Info("retryable", "code", retry.Code)
        return
    }

    var fatal *coretypes.FatalError
    if errors.As(err, &fatal) {
        // 合约暂停 / 配置错 / 上链 revert 兜底, 运维介入
        log.Error("fatal", "code", fatal.Code)
        return
    }

    var internal *coretypes.InternalError
    if errors.As(err, &internal) {
        // 本层 bug, 触发告警
        log.Error("BUG", "code", internal.Code)
        return
    }
}
```

**Sentinel 精确匹配**：

```go
if errors.Is(err, coretypes.ErrUserInsufficientBalance) {
    // 给前端返回 "余额不足" 友好提示
}
if errors.Is(err, coretypes.ErrBetQuoteExpired) {
    // 让前端重新拉报价后再下
}
```

完整 33 个 sentinel：`coretypes/errors_v2.go`。

---

## 7. 幂等键用法

**每个写方法必传 `IdempotencyKey`**。规则：

- 业务上层生成，建议格式 `<biz-op>-<user>-<date>-<seq>`（保证全局唯一）
- 重提相同 key **+** 相同参数 → 返回上次的 `(TxHash, ActionID)`（不重复上链）
- 重提相同 key **+** 不同参数 → `ErrIdempotencyConflict`

```go
// 业务方手册示范:
res1, _ := relayCli.PlaceBet(ctx, relay.PlaceBetRequest{
    UserID:     "alice",
    UserAddr:   aliceAddr,
    Amount:     big.NewInt(100e18),
    IdempotencyKey: "bet-alice-2026-05-15-001",
    ...
})

// 网络抖动了, alice 客户端没收到响应, 重试同一笔:
res2, _ := relayCli.PlaceBet(ctx, sameRequest)
// res1.TxHash == res2.TxHash  ← 同一笔, 不会重复上链
```

---

## 8. `MarketKey` vs `MarketID`

业务方**只传** `MarketKey`，本层 hash 成合约要的 32 字节 `MarketID`：

```go
marketKey := coretypes.MarketKey{
    MatchID:    matchID,    // [32]byte, 业务上层定义
    MarketType: 0,          // 0=1x2 / 1=AH / 2=OU
    Line:       0,          // AH/OU 的盘口分线; 1x2 总是 0
}

// 业务接口都用 MarketKey:
relayCli.PlaceBet(ctx, relay.PlaceBetRequest{Market: marketKey, ...})
adminCli.SettleMarketWithReceipt(ctx, admin.SettleMarketRequest{Market: marketKey, ...})
readCli.GetMarket(ctx, marketKey)
readCli.PreviewSignal(ctx, marketKey, outcome, amount)
```

如果遇到需要原始 32 字节 marketID（比如解析合约 event）：

```go
marketID := marketKey.MarketID()  // = keccak256(abi.encode(matchID, marketType, line))
```

---

## 9. A 形态 vs B 形态

每个写方法都有两个变体：

| 形态 | 命名 | 返回时机 | 用于 |
|---|---|---|---|
| **A** | `relayCli.PlaceBet(...)` | 立即（几秒，提交即返回 tx hash + ActionID） | 高吞吐 API；后续 async 查状态 |
| **B** | `relayCli.PlaceBetWithReceipt(...)` | 等 2 块确认（~6-9s）→ 返回 receipt + 解析 event | 用户面前显示"已成功"; 测试 |

A 形态后续查状态走 `action.Repo.GetStatus(actionID)`（admin/relay 服务持有 DB）。

```go
// A 形态 (吞吐优先):
res, _ := relayCli.PlaceBet(ctx, req)
// res.TxHash 已经能给前端 / 写日志
// 后台定时查:
status, _ := adminClients.Actions.GetStatus(ctx, res.ActionID)
// status.Status: pending / submitted / mined / confirmed / failed / dropped

// B 形态 (DX 优先):
res, _ := relayCli.PlaceBetWithReceipt(ctx, req)
// res.BetID 已经解析好, 可以直接给用户
```

---

## 10. chain_actions 状态查询

admin-svc / relay-svc 直接用 `action.Repo`：

```go
// 通过 ActionID 查 (A 形态返回的)
status, err := adminClients.Actions.GetStatus(ctx, actionID)
// status.Status / status.TxHash / status.BlockNumber / status.ConfirmedAt / status.RevertInfo

// 通过幂等键查 (用户重提 / 客户端崩溃后恢复)
status, err := adminClients.Actions.GetStatusByIdempotencyKey(ctx, "bet-alice-2026-05-15-001")
```

**read-svc 不持有 DB**，不需要此功能。如果业务需要"用户查自己的下注"，应该用链上：

```go
bet, _ := readCli.GetBet(ctx, betID)
// bet.SettlementState (Pending / Lost / WonUnclaimed / WonClaimed)
```

---

## 11. 常见陷阱

### 11.1 用户 ODD 余额不够 + 1% tax

PlaceBet 实际扣 `amount + amount * betTaxBps / 10000`（默认 1% tax）。approve 给 BettingPool 必须 ≥ `amount × 1.01`：

```go
betApproval := new(big.Int).Add(amount, new(big.Int).Div(amount, big.NewInt(100)))
relayCli.ApproveWithReceipt(ctx, relay.ApproveRequest{
    UserID:   userID,
    UserAddr: userAddr,
    Spender:  bettingPoolAddr,
    Value:    betApproval,
    ...
})
```

### 11.2 DepositMatch 必须 ≥ minDeposit（默认 **1000 ODD**）

```go
// LiquidityPool.minDeposit() 返回 1000 * 1e18; 任何 < 1000 ODD 都会 revert
```

### 11.3 DepositMatch / 任何依赖 market 的操作必须在 OpenMarket 之后

`BettingPool.openMarket()` 自动联动 `LiquidityPool.openMatchPool()`。不调 openMarket 直接 DepositMatch 会 revert。

### 11.4 SettleMarket 必须在 matchEndTime 之后

合约硬要求 `block.timestamp >= matchEndTime`。提前 settle 会 `SettlementCannotClose` revert。

### 11.5 sponsor 钱包 BNB 余额

每笔 relay 调用 sponsor 临时预扣 `gasLimit × feeCap`（通常 2M × 5 Gwei ≈ 0.01 BNB），实际消耗 ~0.0025 BNB。生产部署确保 sponsor 钱包 ≥ 1 BNB 持续可用。

### 11.6 用户私钥不在本层

relay 不再接触用户私钥——调用方只传 `UserID` + `UserAddr`，签名由 Magic TEE 完成。relay 日志只打 `user_id` / `tx_hash` / 签名的 `v` 字节，**永不打印 r/s 或任何密钥材料**。`MAGIC_SIGNER_TOKEN` 等调用方凭证从 env/vault 注入，不要硬编码。

---

## 12. 完整端到端示例

最完整的"7 步业务流 + 3 库分服务部署"参考实现：[`scenario_e2e_test.go`](../scenario_e2e_test.go)。涵盖：

1. admin OpenMarket
2. user approve LP + DepositMatch（LP 充值）
3. user approve BettingPool + PlaceBet（下注）
4. admin SettleMarket（结算）
5. user ClaimPayout（领赔付）
6. user RequestUnbond（申请退 LP）
7. user Withdraw（拿回 LP 本金 + 收益）

是后端同学接入时最佳的"对照代码"。
