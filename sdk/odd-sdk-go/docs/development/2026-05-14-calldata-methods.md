# Calldata-only 方法补齐

**日期：** 2026-05-14
**范围：** `pkg/oddfi` + `internal/infrastructure/contracts`
**目的：** 为 4 个合约的全部 14 个写方法补一组 `XxxCalldata` 函数，输入与原写方法一致，输出 `([]byte, error)`，**不签名、不广播、不查 RPC**。

> 2026-05-25 更新：BettingPool 结算 ABI 已迁移到 score-based API。本文中的 `SettleMarketCalldata -> settleMarket` 设计已被 [`2026-05-25-settlement-score-api-adapter.md`](./2026-05-25-settlement-score-api-adapter.md) 取代；当前代码使用 `SettleMarketBetsByScoreCalldata` 与 `FinalizeMarketSettlementCalldata`，且 ABI 不再包含 `pushRefundMarket`。

---

## 1. 背景

下游业务库 `contracts-business-layer` 需要把链上写入拆成两种执行路径：

1. **Admin 直发** — 业务层用 admin 私钥签名并通过自己的 `SubmitPipeline` 广播（接管 nonce 锁、幂等、watcher）。
2. **EIP-7702 代付** — 用户私钥签 7702 authorization + inner Execute，admin 付 gas 广播外层 SetCodeTx。inner Execute 的载荷是一组 `(to, value, data)`，其中 `data` 就是目标合约的 calldata。

两条路径共同的需求是：**给定参数，拿到 ABI 编码后的 calldata**，不要 SDK 帮我签名也不要它去 estimateGas / 拉 nonce / 广播。

当前 SDK 的写方法签名是：

```go
func (p *BettingPool) PlaceBet(opts *bind.TransactOpts, marketID [32]byte, ...) (*types.Transaction, error)
```

内部走 `BoundContract.Transact`，强制要 `Signer`、`From`、`Nonce`、`GasLimit` 等字段；即便设 `NoSend: true` 也要塞一个不会用到的签名函数 + 手动钉住 nonce/gas 才能避免 RPC。所以业务层目前的做法（见 `contracts-business-layer/sponsored/withdraw.go` 的 `packWithdraw`）是 **手写 selector + `abi.Arguments.Pack`**，每加一个 7702 入口都要重复一遍，而且会和 SDK 的 ABI 静默漂移。

补一组 `XxxCalldata`，下游全部走 `abi.ABI.Pack`，和 SDK 内置 ABI 共用真理源，永远不会漂移。

---

## 2. 待新增方法清单（共 14 个）

> **方法名验证状态：** 全部 14 个 Solidity 方法名已于 **2026-05-14** 用下述 `rg` 命令在 `internal/infrastructure/bindings/` 中比对确认；`placeBet` 的 4-arg / 5-arg 重载（见 §4.1 末尾）也已确认。文档与 binding 一致，可直接按本表实施。

| 合约 | 方法 | Solidity 名 | 备注 |
| --- | --- | --- | --- |
| `ODDToken` | `TransferCalldata` | `transfer` | 已确认 |
| `ODDToken` | `ApproveCalldata` | `approve` | 已确认 |
| `BettingPool` | `AddPlatformReserveCalldata` | `addPlatformReserve` | 已确认 |
| `BettingPool` | `GrantRoleCalldata` | `grantRole` | 已确认 |
| `BettingPool` | `OpenMarketCalldata` | `openMarket` | 已确认 |
| `BettingPool` | `PlaceBetCalldata` | `placeBet` | 已确认，含 `QuoteGuardInput` 转换；目标重载为不带 `referrer` 的 4-arg 版本 |
| `BettingPool` | `SettleMarketCalldata` | `settleMarket` | 已确认 |
| `BettingPool` | `ClaimPayoutCalldata` | `claimPayout` | 已确认 |
| `StakingPool` | `StakeCalldata` | `stake` | 已确认 |
| `StakingPool` | `UnstakeCalldata` | `unstake` | 已确认 |
| `LiquidityPool` | `DepositGlobalCalldata` | `depositGlobal` | 已确认 |
| `LiquidityPool` | `DepositMatchCalldata` | `depositMatch` | 已确认 |
| `LiquidityPool` | `RequestUnbondCalldata` | `requestUnbond` | 已确认 |
| `LiquidityPool` | `WithdrawCalldata` | `withdraw` | 已确认 |

### 方法名回归校验命令（仅供 binding 重新生成时使用）

如果 `internal/infrastructure/bindings/` 因合约升级被 abigen 重新生成，先跑下面这条命令复核 14 个名字仍然全部出现；任意一个对不上时**先停下修正本文档再写代码**，不要按本文档原文实施。

```powershell
rg -n 'contract\.Transact\(opts, "(transfer|approve|addPlatformReserve|grantRole|openMarket|placeBet|settleMarket|claimPayout|stake|unstake|depositGlobal|depositMatch|requestUnbond|withdraw)"' internal\infrastructure\bindings
```

---

## 3. 代码层结构

新增两层薄包装（与现有 read / write 分层保持一致）：

```
pkg/oddfi/<contract>.go                                   ← 公开 facade，类型转换 + 错误包装
    └── internal/infrastructure/contracts/<contract>.go   ← adapter，调 MetaData.GetAbi().Pack
              └── internal/infrastructure/bindings/<contract>/<contract>.go   ← abigen 输出，只读
```

`internal/infrastructure/bindings/` 是 abigen 生成的，**严禁手改**（与 [`AGENTS.md`](../../AGENTS.md) §3 一致）。

**文件物理拆分**：calldata 方法既可以并入对应合约的现有 facade / adapter 文件，也可以新建同 package 的 `<contract>_calldata.go` / `<contract>_calldata.go`（建议按行数取舍：合并后超过 ~600 行时拆出）。**禁止**新建跨合约汇总文件（如 `pkg/oddfi/calldata.go`），以免破坏"一个合约一个文件"的导读结构。

---

## 4. 实现模板

### 4.1 Adapter 层（`internal/infrastructure/contracts/`）

在每个合约 adapter 文件里追加一个内部辅助函数 + 每个方法一个 `XxxCalldata`。

**辅助函数**（每个合约 adapter 文件加一份，避免每次调 GetAbi）：

```go
// internal/infrastructure/contracts/bettingpool.go

import (
    "github.com/ethereum/go-ethereum/accounts/abi"
    "github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/bindings/bettingpool"
)

var bettingPoolABI = mustLoadBettingPoolABI()

func mustLoadBettingPoolABI() abi.ABI {
    parsed, err := bettingpool.BettingPoolMetaData.GetAbi()
    if err != nil {
        panic("bind betting pool abi: " + err.Error())
    }
    if parsed == nil {
        panic("bind betting pool abi: nil abi")
    }
    return *parsed
}
```

> 用 `mustLoad*` + 包级变量缓存，避免每次 Pack 时 re-parse；abigen 内嵌的 ABI 字符串静态正确，panic 在 init 阶段是可接受的。

**Calldata 方法模板**：

```go
// AddPlatformReserveCalldata returns ABI-encoded calldata for addPlatformReserve(uint256).
func (a *BettingPoolAdapter) AddPlatformReserveCalldata(amount *big.Int) ([]byte, error) {
    data, err := bettingPoolABI.Pack("addPlatformReserve", amount)
    if err != nil {
        return nil, fmt.Errorf("betting pool add platform reserve abi pack: %w", err)
    }
    return data, nil
}
```

> **错误前缀约定（避免 facade ↔ adapter 双重前缀重复）：**
> - **Adapter 层**用 `"<contract> <method> abi pack: %w"` —— 表示"在 abi.Pack 阶段失败"。
> - **Facade 层**用 `wrapUserError("<contract> <method> calldata", err)` —— 表示"calldata 生产失败"。
> - 两层前缀**互补不重叠**，组合出来的信息是 `user <contract> <method> calldata: <contract> <method> abi pack: <底层 err>`，对下游 `errors.As(&UserError{})` 判型不影响，但读起来不重复。

对 `PlaceBet` 这种带结构体参数的，要先把 public 类型转换到 binding 类型（与现有 `PlaceBet` 写方法里的转换一致）：

```go
func (a *BettingPoolAdapter) PlaceBetCalldata(marketID [32]byte, outcome uint8, requestedAmount *big.Int, guard bettingpool.QuoteGuardInput) ([]byte, error) {
    data, err := bettingPoolABI.Pack("placeBet", marketID, outcome, requestedAmount, guard)
    if err != nil {
        return nil, fmt.Errorf("betting pool place bet abi pack: %w", err)
    }
    return data, nil
}
```

> 注意：adapter 这一层用的是 **binding 类型** `bettingpool.QuoteGuardInput`，**不是** `pkg/oddfi.QuoteGuardInput`。public ↔ binding 的字段映射保持在 `pkg/oddfi` 那一层做（见 4.2）。这与现有 `(*BettingPoolAdapter).PlaceBet` 的形态一致。

> **PlaceBet ABI 重载注意：** BettingPool 在 Solidity 端有两个同名 `placeBet`：4-arg（不带 `referrer`）和 5-arg（带 `referrer`）。go-ethereum 解析 ABI JSON 时会把先出现的保持原名、后出现的重命名为 `placeBet0`，因此 `bettingPoolABI.Pack("placeBet", marketID, outcome, requestedAmount, guard)` 解析的是 4-arg 重载，与现有 `(*BettingPoolTransactor).PlaceBet` 一致。**本次只新增 4-arg 形态的 `PlaceBetCalldata`**；如未来要暴露 5-arg referrer 重载，需要 `Pack("placeBet0", …)` 并另起一个方法名（如 `PlaceBetWithReferrerCalldata`），不在本文档范围内。

### 4.2 Public facade 层（`pkg/oddfi/`）

每个 facade 方法与现有写方法一一对应。**不需要 `*bind.TransactOpts`，不需要 `ctx`**（纯本地编码）。

```go
// pkg/oddfi/bettingpool.go

// PlaceBetCalldata returns ABI-encoded calldata for BettingPool.placeBet.
// The returned bytes can be used as the data field of an EIP-7702 inner call
// or any other context that needs raw calldata.
func (p *BettingPool) PlaceBetCalldata(marketID [32]byte, outcome uint8, requestedAmount *big.Int, guard QuoteGuardInput) ([]byte, error) {
    if err := ensureBettingPool(p); err != nil {
        return nil, err
    }
    bindingGuard := bettingpool.QuoteGuardInput{
        QuoteVersion:      guard.QuoteVersion,
        QuotedAt:          guard.QuotedAt,
        MinOdds:           guard.MinOdds,
        MinAcceptedAmount: guard.MinAcceptedAmount,
        Deadline:          guard.Deadline,
    }
    data, err := p.adapter.PlaceBetCalldata(marketID, outcome, requestedAmount, bindingGuard)
    if err != nil {
        return nil, wrapInfraError("betting pool place bet calldata", err)
    }
    return data, nil
}
```

简单参数的方法更短：

```go
func (p *BettingPool) ClaimPayoutCalldata(betID [32]byte) ([]byte, error) {
    if err := ensureBettingPool(p); err != nil {
        return nil, err
    }
    data, err := p.adapter.ClaimPayoutCalldata(betID)
    if err != nil {
        return nil, wrapInfraError("betting pool claim payout calldata", err)
    }
    return data, nil
}
```

### 4.3 规则与不变量

- **每个 Calldata 方法的入参签名与对应写方法完全一致**，只是**去掉 `*bind.TransactOpts`，没有新增任何入参**。
- **`pkg/oddfi` 上的 Calldata 方法不接收 `ctx`**（无 IO）。
- **错误分类（与 [`AGENTS.md`](../../AGENTS.md) §4.2 一致）：**
  - `abi.Pack` 失败的根因是**调用方传的参数类型/形状不对**（例如 `baseOdds` 切片长度不符、tuple 字段缺失），按错误分类应为 **`UserError`**。
  - facade 层用 `wrapUserError("xxx calldata", err)`（`pkg/oddfi/client.go` 已存在）。
  - adapter 层仍用 `fmt.Errorf("xxx calldata: %w", err)` 包一层做现场标注，不引入错误类型。
  - **不要**用 `wrapInfraError` —— calldata 路径没有任何 RPC / 基础设施 I/O，那条语义错位会污染下游 `errors.As` 判型。
- **nil receiver / nil adapter 仍然要先过 `ensureXxx(p)`**，与现有方法一致；不要为了"calldata 无副作用"省掉。nil receiver 返回的是 `ConfigError`，这是既有约定。
- **必填 `*big.Int` 入参的 nil 校验**：facade 层先校验所有必填 `*big.Int` 参数（如 `amount` / `requestedAmount` / `positionID` / `QuoteGuardInput` 的各字段）非 nil，否则返回 `wrapUserError(op, ErrXxx)`。不要放任 `abi.Pack` 在 nil 上 panic 或抛低层错误。
  - 复用既有的哨兵错误模式（`pkg/oddfi/errors.go`），如有需要新增 `var ErrNilBigIntParam = errors.New("nil *big.Int parameter")`。
  - 校验顺序：`ensureXxx(p)` → nil-参数校验 → `adapter.XxxCalldata(...)`。
- **Calldata 不依赖 transactor**：现有 adapter 写方法在 `transactor == nil` 时短路 `chain.ErrMissingRPCClient`；**Calldata 方法不能加这条短路**。它只依赖 `<contract>MetaData.GetAbi()`（abigen 内嵌的静态 ABI），与 RPC 后端、`transactor` 字段无关，必须在**只读 client**（甚至没有 RPC dial 成功的情况下）也能产出 calldata 字节。这是本次设计的核心动机之一：业务层用纯只读 SDK 编码，由上层 EIP-7702 路径广播。
- **godoc 要求**：每个 `XxxCalldata` 的 godoc **第一句**必须明示"returns ABI-encoded calldata for `<solidityName>`; does not sign, broadcast, or query RPC."。这是为了避免复制粘贴后 godoc 退化成与读方法雷同的描述，进而误导下游。
- **不要把 calldata 方法定义在 `bind.MetaData` 全局变量之外**：每个合约的方法放在该合约自己的 facade / adapter 文件中（或同 package 拆分为 `<contract>_calldata.go`，见 §3）；禁止跨合约汇总文件。

---

## 5. 单元测试

每个合约新建一份 `*_calldata_test.go` 测试文件（或者并入现有 `pools_test.go` / `oddtoken_test.go`，看仓库习惯），覆盖：

1. **Happy path（全部 14 个方法都要做）：** 对每个方法用固定参数 Pack 一次，断言：
   - `len(data) >= 4`（含 4-byte selector）
   - 前 4 字节等于 `crypto.Keccak256([]byte(signature))[:4]`，其中 `signature` 是该方法的完整 Solidity 签名（例如 `"placeBet(bytes32,uint8,uint256,(uint256,uint64,uint256,uint256,uint256))"`，tuple 字段顺序 `(quoteVersion,quotedAt,minOdds,minAcceptedAmount,deadline)` 已对照 binding 的 ABI JSON 确认）。
   - 与"全量构造一个 `bind.TransactOpts{NoSend:true, Signer: dummy, Nonce: 1, GasLimit: 1, GasFeeCap: big.NewInt(1), GasTipCap: big.NewInt(1)}` 后调原写方法 + `tx.Data()`"得到的字节**完全一致**。

   第三条等价性断言是最重要的 —— 它锁住 calldata 路径和正式写路径产生同一份编码。**14 个方法每个都要写**，因为 `abi.Pack` 第一个参数的方法名字符串是手写的、每一个都可能拼错；selector 等价测试是本次唯一能机械锁死方法名 / tuple 顺序的手段。

2. **参数错误（每个合约至少一例）：**
   - 用 nil receiver 调 → 返回 `*ConfigError`（断言 `errors.As(err, &cfg)` 成立，且 `errors.Is(err, ErrMissingBettingPool)` / 等价）。
   - 必填 `*big.Int` 入参传 nil → 返回 `*UserError`（断言 `errors.As(err, &ue)` 成立）。
   - 用错误形状的复杂参数（例如 `OpenMarketCalldata` 传一个能让 `Pack` 失败的 `baseOdds`）→ `Pack` 返回错误，断言被包装为 **`*UserError`**（不是 `InfraError`）。

3. **不要触发 RPC：** 用一个**不 dial 任何后端**的 facade 直接构造（例如 `&BettingPool{adapter: ...}`，参考现有 `pools_test.go` 写法）。calldata 测试**必须**能在离线环境跑通；如果通过 `NewClient` 会触发 RPC dial，**不要**在 calldata 单元测试里走 `NewClient` 路径。

> Selector 等价性断言失败时，先用 `cast sig '<signature>'` 或 `keccak256` 对照 binding 里的 ABI JSON 反推真正的签名 —— 但**不要回头改本文档里的签名字符串**：本文档已经在 §2 与 §5 锁定的字符串与 binding 一致，对不上意味着 binding 被重新生成且语义漂移，应当先按 §2"方法名回归校验命令"全量复核，再处理。

### 测试样例（PlaceBet）

```go
func TestBettingPool_PlaceBetCalldata(t *testing.T) {
    pool := newOfflineBettingPool(t) // helper that builds *BettingPool without RPC

    marketID := [32]byte{0x01, 0x02}
    guard := QuoteGuardInput{
        QuoteVersion:      big.NewInt(7),
        QuotedAt:          1_700_000_000,
        MinOdds:           big.NewInt(18_180),
        MinAcceptedAmount: big.NewInt(100_000_000),
        Deadline:          big.NewInt(1_700_000_300),
    }

    data, err := pool.PlaceBetCalldata(marketID, 1, big.NewInt(100_000_000), guard)
    require.NoError(t, err)
    require.GreaterOrEqual(t, len(data), 4)

    sig := "placeBet(bytes32,uint8,uint256,(uint256,uint64,uint256,uint256,uint256))"
    want := crypto.Keccak256([]byte(sig))[:4]
    require.Equal(t, want, data[:4])
}
```

> Tuple 元素的**顺序**按 Solidity 源码 struct 字段顺序（Go 端的字段大小写不影响 ABI 编码）。本文档里 `QuoteGuardInput` 的顺序 `(quoteVersion uint256, quotedAt uint64, minOdds uint256, minAcceptedAmount uint256, deadline uint256)` 已对照 `internal/infrastructure/bindings/bettingpool/bettingpool.go` 的 `BettingPoolMetaData.ABI` JSON 确认。如哈希对不上，应当走 §2 的回归校验命令，而不是改本测试里的签名字符串去迁就。

---

## 6. 文档同步（按 `AGENTS.md` 强约束）

按仓库 `docs/README.md` 第 5 节 "文档与代码必须双向同步"，本次变更必须同步更新以下文档：

1. **`docs/architecture/contract_api.md`**
   - 不需要新增章节（公开 API 形状没变，只是多了 calldata 路径）。
   - 在文档头部 / 总览处加一句说明：每个 mutating method 现在配套一个 `XxxCalldata` 返回纯 calldata，用于账户抽象 / 多签 / 离线签等场景。
   - 列一个简表，跟本文档第 2 节对齐。

2. **`docs/progress/sdk-foundation.md`**（或当前进度文件中负责"写交易支持"那一项）
   - 把"提供 ABI 编码 calldata 入口"标记为已实现。

3. **`CHANGELOG.md`**
   - 在 Unreleased / 下一个 minor 版本下加一条：`feat(sdk): expose XxxCalldata for all mutating methods to support EIP-7702 / multisig integrations`。

4. **`pkg/oddfi/example_test.go`** 加一段 `ExampleBettingPool_PlaceBetCalldata`。**两条硬要求：**
   - 不得用 `var pool *oddfi.BettingPool` 这种 nil receiver 写法 —— 那样 `ensureBettingPool` 会返回 `*ConfigError`，`data` 为 nil，后续 `data[:4]` 会 panic，CI 直接红。
   - 与 `ExampleNewClient` 保持同一种 env-driven 形态：从 `ODDFI_RPC_URL` 拉 RPC，env 未设置或 dial 失败时静默返回；**不写 `// Output:` 注释**（calldata 4-byte selector 是确定的，但前置 client 构造非确定，按现有 `ExampleNewClient` 的约定）。

```go
func ExampleBettingPool_PlaceBetCalldata() {
    ctx := context.Background()
    rpcURL := os.Getenv("ODDFI_RPC_URL")
    client, err := oddfi.NewClient(ctx, oddfi.Config{
        RPCURL:             rpcURL,
        ODDTokenProxy:      oddfi.MustParseAddress("0x5530dA4357803bD0ed806a999a1f1fcc3c45Dc8C"),
        StakingPoolProxy:   oddfi.MustParseAddress("0x65fd4A2529010693BA474d1993631e305a42E061"),
        LiquidityPoolProxy: oddfi.MustParseAddress("0xdf0c59B387DfDf9f18969880DDCF1216BFEe318f"),
        BettingPoolProxy:   oddfi.MustParseAddress("0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F"),
    })
    if err != nil {
        return
    }
    defer func() { _ = client.Close(ctx) }()

    guard := oddfi.QuoteGuardInput{
        QuoteVersion:      big.NewInt(1),
        QuotedAt:          1_700_000_000,
        MinOdds:           big.NewInt(18_180),
        MinAcceptedAmount: big.NewInt(100_000_000),
        Deadline:          big.NewInt(1_700_000_300),
    }
    data, err := client.BettingPool().PlaceBetCalldata([32]byte{0x01}, 1, big.NewInt(100_000_000), guard)
    if err != nil {
        return
    }
    fmt.Println(hex.EncodeToString(data[:4]))
}
```

> 如果觉得 example 仅为展示一个纯本地编码却要 dial RPC 过于浪费，可以**额外**在 `pkg/oddfi/bettingpool_calldata_test.go` 里写一份不依赖 `NewClient`、走"裸 adapter 构造"的离线样例（与单元测试同形）；但 `example_test.go` 这一份必须按现有 `ExampleNewClient` 的形态来，以满足 [`AGENTS.md`](../../AGENTS.md) §4.7 "ExampleXxx CI 必须可编译运行"。

---

## 7. 不在范围内

以下内容**本次不动**：

- `internal/infrastructure/bindings/` 下的任何文件（abigen 生成）。
- 现有 `Transfer / Approve / PlaceBet / ...` 等写方法的签名和实现。
- 业务方传入 ABI / selector 的"自定义 Pack"低阶口子（如果将来需要再单独评估）。
- 任何与 `bind.TransactOpts` / `NoSend` 模式相关的改动。
- 任何 RPC / 客户端 / 签名相关的改动。

---

## 8. 验收清单

执行 AI 提交前必须自查：

- [ ] 14 个 facade 方法 + 14 个 adapter 方法已新增（清单与 §2 表格 1:1 对应）。
- [ ] 4 个 adapter 文件里都加了 `<contract>ABI` 包级缓存变量 + `mustLoad<Contract>ABI()` init helper（见 §4.1）。
- [ ] 所有 Calldata 方法对 nil receiver 返回 `*ConfigError`（走 `ensureXxx`），与现有方法一致。
- [ ] 所有 Calldata 方法对必填 `*big.Int` 入参做了 nil 校验，nil 时返回 `*UserError`（见 §4.3）。
- [ ] `abi.Pack` 失败被包装为 `*UserError`（不是 `*InfraError`），下游 `errors.As(&UserError{})` 可判别。
- [ ] Adapter 实现里**没有**为 Calldata 方法加 `if a.transactor == nil` 短路；只读 client 上 Calldata 方法可用（见 §4.3）。
- [ ] 每个 Calldata 方法的 godoc 第一句明示 "returns ABI-encoded calldata for `<solidityName>`; does not sign, broadcast, or query RPC"。
- [ ] **14 个方法每个**都有 selector 等价性测试，与"NoSend tx.Data()"得到的字节完全一致（见 §5 happy path）。
- [ ] 单元测试在**离线环境**（无 `ODDFI_RPC_URL`）能跑通；calldata 单测不走 `NewClient` 路径。
- [ ] `pkg/oddfi/example_test.go` 的 `ExampleBettingPool_PlaceBetCalldata` 按 §6 模板写成，**不**含 `var pool *oddfi.BettingPool` 这种 nil receiver 写法。
- [ ] `docs/architecture/contract_api.md`、`docs/progress/sdk-foundation.md`、`CHANGELOG.md` 已同步更新（见 §6）。
- [ ] `go vet ./...`、`go build ./...`、`go test -race ./pkg/oddfi/... -run Calldata` 全部通过。
- [ ] 没有引入新依赖（只能用已有的 `go-ethereum/accounts/abi`、`go-ethereum/crypto` 等）。

---

## 9. 下游引用预告（供执行 AI 参考用法，不需要在本仓改）

业务库 `contracts-business-layer/sponsored/` 会按下面这种形态使用新 API：

```go
// 替代手写的 packWithdraw
data, err := sdkClient.BettingPool().ClaimPayoutCalldata(betID)
if err != nil { return ... }
calls := []eip7702.Call{{To: bettingPoolProxy, Value: big.NewInt(0), Data: data}}
// ... 7702 流水线
```

直发路径也是同一份 Calldata + 业务层 `SubmitPipeline`，不再依赖 SDK 的 `bind.TransactOpts` 路径。本仓不要为这条下游用法在 SDK 里加任何"半成品 tx 模板"或"build unsigned tx"方法 —— 那些是下游业务层的职责。
