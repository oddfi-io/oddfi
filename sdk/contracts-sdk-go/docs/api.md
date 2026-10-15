# oddfi-contracts-sdk · 方法调用文档

> 自动梳理自源码,涵盖 `sdk/` 下的所有 **公开方法 / 函数 / 类型构造器**。
> 编译状态:`go build ./...` 全绿 ✓ · 测试:`go test ./...` 全绿 ✓
>
> 阅读顺序建议:`sdk/client → sdk/{admin,multisig,reader,signer,errs}`。
>
> 业务适配层(ChainAction、Watcher、Resolver、按业务 ID 包装等)已剥离,由各业务项目自行实现。

## 目录

- [SDK 层 (`sdk/`)](#sdk-层)
  - [client](#client) — Connection 与启动校验
  - [config](#config) — 内嵌环境配置
  - [errs](#errs) — Revert 解码
  - [signer](#signer) — 私钥/Keystore 签名
  - [admin](#admin) — Admin 角色 13 个写方法
  - [multisig](#multisig) — Multisig 角色 14 个写方法 (Calldata/Execute/Propose/Simulate)
  - [multisig/safetx](#multisigsafetx) — Safe Transaction Service HTTP client
  - [reader](#reader) — 视图 + 三层事件 API
  - [fixtures / testutil](#fixtures--testutil) — 测试专用

---

## SDK 层

### client

`github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/client` — 单一入口,持有 RPC client、chainID、合约地址(从内嵌 per-env 配置加载),并在启动时对 admin/multisig 角色做一致性校验。

#### `func NewConnection(cfg ConnectionConfig) (*Connection, error)`

构造连接。`ConnectionConfig` 字段:`Env` (Testnet / Mainnet)、`RPC`(必填)、`HTTPTimeout`、`Logger`。
启动时:
1. dial RPC,读取 chainID 并与配置比对(不匹配 → `*ErrChainIDMismatch`)。
2. 调用 `BettingPool.admin()` / `multisig()`,与配置中的预期值比对(不匹配 → `*ErrRoleMismatch`)。

#### `*Connection` 方法

| 方法 | 返回 | 说明 |
|---|---|---|
| `BettingPool()` | `*bettingpool.BettingPool` | abigen 绑定对象,供 Layer 0 直接调用 |
| `BettingPoolAddr()` | `common.Address` | 当前环境合约地址 |
| `USDTAddr()` | `common.Address` | 计价 USDT 地址 |
| `ChainID()` | `*big.Int` | 链 ID |
| `Env()` | `Env` | `Testnet` / `Mainnet` 枚举 |
| `EnvConfig()` | `*config.EnvConfig` | 当前环境完整配置 |
| `EthClient()` | `*ethclient.Client` | 底层 RPC client(仅在确实需要绕过 SDK 时使用) |
| `OnchainAdmin()` | `common.Address` | 启动时从合约读到的 admin 地址 |
| `OnchainMultisig()` | `common.Address` | 启动时从合约读到的 multisig 地址 |
| `HTTPTimeout()` | `time.Duration` | RPC 请求默认超时 |
| `Logger()` | `*slog.Logger` | 配置注入的结构化日志 |
| `Close()` | `error` | 关闭底层连接 |

#### 错误类型
- `*ErrChainIDMismatch` / `*ErrRoleMismatch`:都实现 `Error()`。
- `var ErrRPCRequired`:`ConnectionConfig.RPC` 为空时返回。

#### 枚举
- `Env`(`Testnet=0` / `Mainnet=1`),方法 `String()`、`IsMainnet()`。

---

### config

`github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/config` — 通过 `go:embed` 把 `sdk/config/*.json` 打包进二进制。

| 函数 | 签名 | 说明 |
|---|---|---|
| `Load` | `Load(envName string) (*EnvConfig, error)` | `envName` 取 `"testnet"` / `"mainnet"`,其它返回错误 |

#### `*EnvConfig` 方法
- `BettingPoolAddress()` `common.Address`
- `USDTAddress()` `common.Address`
- `ExpectedAdmin()` `common.Address`
- `ExpectedMultisig()` `common.Address`

`EnvConfig` 同时暴露字段 `ChainID *big.Int` 和子结构 `Contracts` / `ExpectedRoles`。

---

### errs

`github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/errs` — 将原始 RPC revert 错误解析为带类型的 `*ContractError`,callers 可通过 `errors.As` + `cerr.Name` switch。

| 函数 | 签名 | 说明 |
|---|---|---|
| `Wrap` | `Wrap(err error, method string, parser ErrorParser) error` | 顶层包装。`nil` 入参直接返回 `nil`;无 ErrorData 的非合约错误原样返回;能解析的 selector 返回 `*ContractError`,无法识别时返回带 selector 前缀的普通 error |
| `NewABIParser` | `NewABIParser(parsed abi.ABI) ErrorParser` | 用一个已 parse 的 ABI 构造一个解析器 |

#### `*ContractError`(实现 `error` 与 `errors.Is`/`Unwrap`)
- `Name string` — 比如 `"InsufficientBalance"`、`"MarketClosed"`。
- `Args map[string]interface{}` — 解码后的参数。
- `Method string` — 触发 revert 的方法名(由 caller 传入)。
- `Cause error` — 原始 RPC 错误。
- 方法:`Error()`、`Unwrap()`、`Is(target error)`(支持按 `Name` 比对)。

#### `ErrorParser` interface
```go
type ErrorParser interface {
    ParseError(data []byte) (name string, args map[string]interface{}, ok bool)
}
```
内部默认实现 `abiParser` 来自 `NewABIParser`。

---

### signer

`github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/signer` — 抽象签名,支持 hex string / 文件 / keystore / 自动选择。

| 函数 | 签名 | 说明 |
|---|---|---|
| `NewFromHex` | `NewFromHex(hexKey string) (Signer, error)` | 直接传裸十六进制私钥(可带 `0x`)。空入参 → `ErrEmptyKeyMaterial` |
| `NewFromSecretFile` | `NewFromSecretFile(path string) (Signer, error)` | 从文件读取裸私钥 hex。文件必须存在且非空 |
| `NewFromKeystoreFile` | `NewFromKeystoreFile(path, password string) (Signer, error)` | 从标准 Geth keystore JSON 解锁 |
| `NewAuto` | `NewAuto(env IsMainnetCheck, opts AutoOpts) (Signer, error)` | 优先环境变量 `opts.EnvVar`,失败回落 `opts.FilePath`。Mainnet 强制禁用环境变量(防生产泄露) |

#### `Signer` interface
```go
type Signer interface {
    Address() common.Address
    SignTx(ctx context.Context, tx *types.Transaction, chainID *big.Int) (*types.Transaction, error)
    SignHash(ctx context.Context, hash common.Hash) ([]byte, error)
}
```

#### `AutoOpts` 字段
- `EnvVar string` — 例如 `"TEST_PK"`(非 mainnet 时优先尝试)。
- `FilePath string` — secret 文件路径,作为回落。

#### `IsMainnetCheck` interface
```go
type IsMainnetCheck interface{ IsMainnet() bool }
```
`*client.Connection` 已实现,直接传即可。

---

### admin

`github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/admin` — Admin 角色 13 个写方法 + 13 个 Simulate 对应方法。

#### 构造与 Option

```go
admCli, err := admin.New(conn,
    admin.WithSigner(s),
    admin.WithGasLimit(0),                // 0 = 自动估算
    admin.WithTxTimeout(30*time.Second),
)
```

| 函数 | 签名 |
|---|---|
| `New` | `New(conn *client.Connection, opts ...Option) (*Client, error)` |
| `WithSigner` | `WithSigner(s signer.Signer) Option` |
| `WithGasLimit` | `WithGasLimit(g uint64) Option` |
| `WithGasFeeCap` | `WithGasFeeCap(g *big.Int) Option` |
| `WithGasTipCap` | `WithGasTipCap(g *big.Int) Option` |
| `WithTxTimeout` | `WithTxTimeout(d time.Duration) Option` |

`var ErrNoSigner = errors.New("admin: no signer configured (use WithSigner)")`

#### `*Client` 写方法(每个都有 `SimulateXxx` 同名方法,做 eth_call 干跑、不广播)

| 方法 | Args 类型 | 用途 |
|---|---|---|
| `CreditDeposit` | `CreditDepositArgs{User, Amount, TxHash}` | 把链下入金记入合约内余额。`TxHash` 用作一次性去重 key |
| `OpenMarket` | `OpenMarketArgs{MatchID, Market, Line}` | 打开 (matchId, market, line) 桶 |
| `CloseMarket` | `CloseMarketArgs` | 关闭某桶 |
| `BatchOpenMarkets` | `BatchOpenMarketsArgs{MatchID, Markets, Lines}` | 批量打开,`len(Markets)==len(Lines)` |
| `BatchCloseMarkets` | `BatchCloseMarketsArgs` | 批量关闭 |
| `LockBet` | `LockBetArgs{BetID, User, Amount, MatchID, Market, Outcome, Line, LockedOdds}` | 锁单。`LockedOdds` 是 ×1000 的整数赔率 |
| `LockCreditBet` | `LockCreditBetArgs{..., CollateralBetID}` | 用前一笔未结算注的潜在 payout 做担保 |
| `UnlockBet` | `UnlockBetArgs{BetID, CreditBetIDs}` | 取消注、退款,顺带回滚以它做担保的 credit bets |
| `LockParlay` | `LockParlayArgs{ParlayID, User, Stake, MatchIDs, Markets, Outcomes, Lines, LegOdds, LegBetIDs}` | 串关。各 leg 切片必须等长 |
| `UnlockParlay` | `UnlockParlayArgs{ParlayID}` | 串关退款 |
| `UpdateSignal` | `UpdateSignalArgs{MatchID, Market, Line, HeavyAmount, HeavySide, Color}` | 上报市场重仓侧 / 信号灯颜色 |

返回值:`(*types.Transaction, error)`。建议调用模式:
```go
if err := admCli.SimulateLockBet(ctx, args); err != nil { return err }
tx, err := admCli.LockBet(ctx, args)
```

#### 枚举

- `MarketType uint8`:`MarketX12=0`、`MarketAH=1`、`MarketOU=2`,`String()` 返回 `"X12"/"AH"/"OU"`。
- `SignalColor uint8`:`SignalGreen=0`、`SignalYellow=1`、`SignalRed=2`,`String()` 返回 `"Green"/"Yellow"/"Red"`。

#### 工具
- `c.Address() common.Address` — 当前 signer 地址(无 signer 返回 `common.Address{}`)。

---

### multisig

`github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/multisig` — Multisig 角色 14 个方法,**每个方法返回 `*Handle`**,`Handle` 暴露四种执行模式:

```go
h := msCli.Settle(args)
calldata, _ := h.Calldata(ctx)   // 纯客户端打包 {to, value, data}
err = h.Simulate(ctx)            // eth_call 干跑(类型化错误)
tx, err := h.Execute(ctx)        // 直接执行 execTransaction(testnet 1-of-1 only)
prop, err := h.Propose(ctx)      // 提交 SafeTx 到 Safe Transaction Service(mainnet 默认)
```

#### 构造与 Option

| 函数 | 签名 |
|---|---|
| `New` | `New(conn *client.Connection, opts ...Option) (*Client, error)` |
| `WithProposer` | `WithProposer(s signer.Signer) Option` (Propose 模式:用此 key 对 safeTxHash 做 EIP-712 签名) |
| `WithSafeOwner` | `WithSafeOwner(s signer.Signer) Option` (Execute 模式:用此 key 广播 execTransaction) |
| `WithSafeTxServiceURL` | `WithSafeTxServiceURL(url string) Option` |
| `WithCalldataOnly` | `WithCalldataOnly(b bool) Option` (强制只允许 Calldata) |
| `WithDirectExecute` | `WithDirectExecute(b bool) Option` |
| `WithHTTPClient` | `WithHTTPClient(h *http.Client) Option` |
| `WithTxTimeout` | `WithTxTimeout(d time.Duration) Option` |

#### 常量与错误
```go
const SafeTxServiceBSCMainnet = "https://safe-transaction-bsc.safe.global"
const SafeTxServiceBSCTestnet = "https://safe-transaction-bsc-testnet.safe.global"
var ErrDirectExecuteForbiddenOnMainnet = errors.New(...)  // mainnet 拒绝 Execute
```

`*ErrModeNotConfigured` — 当未配置对应 signer 时返回(实现 `Error() string`)。

#### `*Client` 元数据方法
- `SafeAddress() common.Address`
- `ProposerAddress() common.Address`
- `SafeOwnerAddress() common.Address`
- `TxService() *safetx.Client`
- `GetProposal(ctx, safeTxHash) (*Proposal, error)` — 通过 safetx 客户端查询提案状态。

#### 14 个方法(每个 → `*Handle`)

| 方法 | Args |
|---|---|
| `Settle` | `SettleArgs{MatchID, Market, Line, WinningOutcome, BetIDs}` |
| `CancelMatch` | `CancelMatchArgs{MatchID, Market, Line, BetIDs}` |
| `BatchCancelMatch` | `BatchCancelMatchArgs{MatchID, Markets, Lines, BetIDsByMarket}` |
| `ReleaseOrForfeiture` | `ReleaseOrForfeitureArgs{CreditBetID}` |
| `ReopenMarket` | `ReopenMarketArgs{MatchID, Market, Line}` |
| `ExecuteLargeWithdrawal` | `ExecuteLargeWithdrawalArgs{RequestID}` |
| `RejectLargeWithdrawal` | `RejectLargeWithdrawalArgs{RequestID}` |
| `WithdrawPlatform` | `WithdrawPlatformArgs{To, Amount}` |
| `SetMaxMarketsPerMatch` | `SetMaxMarketsPerMatchArgs{Max}` |
| `SetRedLightThreshold` | `SetRedLightThresholdArgs{Threshold}` |
| `SetAdmin` | `SetAdminArgs{NewAdmin}` |
| `SetLpShareBps` | `SetLpShareBpsArgs{NewBps}` |
| `Pause` | `PauseArgs{}`(零参) |
| `Unpause` | `UnpauseArgs{}`(零参) |

#### `*Handle` 方法

| 方法 | 签名 | 说明 |
|---|---|---|
| `Calldata` | `Calldata(ctx) (CalldataPacket, error)` | 纯客户端打包,不接 RPC、不签名 |
| `Simulate` | `Simulate(ctx) error` | eth_call 干跑,返回类型化 `*ContractError` |
| `Execute` | `Execute(ctx) (*types.Transaction, error)` | 仅 testnet 1-of-1 |
| `Propose` | `Propose(ctx) (*Proposal, error)` | mainnet 推荐 |
| `MethodName()` | `string` | 比如 `"settle"` |
| `Args()` | `[]interface{}` | ABI 编码用的入参列表 |

#### 类型
- `CalldataPacket{To common.Address; Value *big.Int; Data []byte}`
- `Proposal{SafeTxHash, SafeUIURL, Nonce, ConfirmationsRequired, ConfirmationsCount, Status, OnChainTxHash}`
- `*SafeTx` 暴露 `SafeTxHash(chainID, safeAddr) common.Hash` 与 `PackExecTransaction(signatures []byte) ([]byte, error)`(EIP-712 实现细节)。

---

### multisig/safetx

`github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/multisig/safetx` — Gnosis Safe Transaction Service HTTP 客户端,刻意做薄。

| 函数 | 签名 | 说明 |
|---|---|---|
| `New` | `New(baseURL string) *Client` | 构造客户端,自动剥尾 `/`,默认 30s timeout、`http.DefaultClient` |
| `EncodeData` | `EncodeData(data []byte) string` | bytes → `0xhex...`(空数据 → `"0x"`) |

#### `*Client` 方法

| 方法 | 签名 | 行为 |
|---|---|---|
| `Propose` | `Propose(ctx, safe common.Address, req *ProposeRequest) (common.Hash, error)` | POST `/api/v1/safes/{safe}/multisig-transactions/`,返回 safeTxHash |
| `Get` | `Get(ctx, safeTxHash common.Hash) (*GetResponse, error)` | GET `/api/v1/multisig-transactions/{safeTxHash}/`。404 → `ErrProposalNotFound` |
| `BaseURL()` | `string` | 当前 baseURL |
| `WithHTTPClient` | `WithHTTPClient(h HTTPClient) *Client` | 链式注入自定义 HTTP client(测试常用) |
| `WithTimeout` | `WithTimeout(d time.Duration) *Client` | 链式覆盖默认超时 |

#### 错误
- `var ErrProposalNotFound = errors.New("safetx: proposal not found")`
- `*ErrServiceRejected{Status int, Body string}` — 4xx/5xx 时返回。

#### 类型
- `ProposeRequest{To, Value, Data, Operation, SafeTxGas, BaseGas, GasPrice, GasToken, RefundReceiver, Nonce, ContractTransactionHash, Sender common.Address, Signature []byte}`
- `GetResponse{SafeTxHash, Nonce, ConfirmationsRequired, Confirmations []Confirmation, IsExecuted, TransactionHash, ...}`
- `Confirmation{Owner common.Address; Submission time.Time; Signature []byte; ...}`
- `HTTPClient interface{ Do(*http.Request) (*http.Response, error) }`

---

### reader

`github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/reader` — 视图 + 三层事件 API。

| 函数 | 签名 |
|---|---|
| `New` | `New(conn *client.Connection) (*Client, error)` |
| `Topic0For` | `Topic0For(kind EventKind) (common.Hash, bool)` |
| `AllEventKinds` | `AllEventKinds() []EventKind` |

#### `*Client` 视图方法

| 方法 | 签名 | 链上方法 |
|---|---|---|
| `LockedBalance` | `LockedBalance(ctx, user) (*big.Int, error)` | `lockedBalance(user)` |
| `LpShares` | `LpShares(ctx, provider) (*big.Int, error)` | `lpShares(provider)` |
| `PlatformBalance` | `PlatformBalance(ctx) (*big.Int, error)` | `platformBalance()` |
| `IsAccepting` | `IsAccepting(ctx, matchID, market, line, outcome uint8) (bool, error)` | `isAccepting(...)` |
| `Paused` | `Paused(ctx) (bool, error)` | `paused()` |
| `Admin` | `Admin(ctx) (common.Address, error)` | `admin()` |
| `Multisig` | `Multisig(ctx) (common.Address, error)` | `multisig()` |
| `USDTBalance` | `USDTBalance(ctx, holder) (*big.Int, error)` | USDT.balanceOf |
| `USDTAllowance` | `USDTAllowance(ctx, owner, spender) (*big.Int, error)` | USDT.allowance |

#### `*Client` 元数据
- `Connection() *client.Connection`
- `BettingPool() *bettingpool.BettingPool`
- `USDT() *erc20.ERC20`
- `Filterer() *bettingpool.BettingPoolFilterer`(Layer 0 直通)。

#### 事件 Layer 1
```go
events, err := rdr.FilterEvents(ctx, FilterOpts{FromBlock: 100, ToBlock: 200, Kinds: []EventKind{...}})
```
内部跑 `eth_getLogs`,绕过 `bind.FilterOpts` 的若干坑。

#### 事件 Layer 2
```go
stream := rdr.Stream(ctx, StreamOpts{...})
for ev := range stream.Events() { ... }
stream.Cancel()  // 主动停止
```
`StreamOpts` 字段:`FromBlock`、`Kinds`、`PageSize`(默认 500)、`PollInterval`(默认 3s)、`HistoricalLatency` 等。
`*EventStream` 方法:`Cancel()`、(实现侧) `Events() <-chan *Event`、`Errs() <-chan error`。

#### `EventKind` 枚举
覆盖所有 BettingPool 事件:`EventDeposited`、`EventBetLocked`、`EventBetSettled`、`EventMarketOpened`、… 等(共 ~15 个)。`String()` 返回稳定 label。

#### `Event`
```go
type Event struct {
    Kind        EventKind
    Raw         types.Log
    BlockNumber uint64
    BlockHash   common.Hash
    TxHash      common.Hash
    LogIndex    uint
    Removed     bool
    // 解码后的 typed payload (interface{}, 按 Kind 分类)
    Decoded interface{}
}
```

---

### fixtures / testutil

| 包 | API | 用途 |
|---|---|---|
| `fixtures` | `LoadPinnedBlocks() (*PinnedBlocks, error)` | 加载 `pinned-blocks.json`(每季度 PR bump) |
| `testutil` | `ForkTestnet(t *testing.T) *ForkEnv` / `ForkMainnet(t *testing.T) *ForkEnv` | 启动 `anvil --fork-url` 至 pinned block |

`*ForkEnv` 暴露字段:`RPC string`、`Chain *big.Int` 等(用于在测试里直接构造 `Connection`)。

---

## 调用速记

```go
// 1. 启动
conn, _ := client.NewConnection(client.ConnectionConfig{Env: client.Mainnet, RPC: rpc, ...})
defer conn.Close()

// 2. SDK 角色
adminCli, _ := admin.New(conn, admin.WithSigner(s))
msCli,    _ := multisig.New(conn, multisig.WithProposer(s), multisig.WithSafeTxServiceURL(multisig.SafeTxServiceBSCMainnet))
rdr,      _ := reader.New(conn)

// 3. 写交易(推荐先 Simulate)
if err := adminCli.SimulateLockBet(ctx, args); err != nil { return err }
tx, err := adminCli.LockBet(ctx, args)
```
