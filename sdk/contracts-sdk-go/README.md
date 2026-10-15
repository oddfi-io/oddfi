# oddfi-contracts-sdk

OddFi BettingPool 智能合约的 Go SDK。对应上游合约仓库 [`oddfi-contracts`](https://github.com/Crypto-Barrett/oddfi-contracts)，部署在 BNB Smart Chain 上。

> 业务适配层（按业务 ID 包装、ChainAction/Watcher、Resolver 等）已从本仓库剥离，由各业务项目自行实现。本仓库只维护干净的 L1 SDK。

---

## 1. 仓库结构

```
oddfi-contracts-sdk/
├── go.work                          # 单 module workspace
├── Makefile                         # pull-abi / sdk-sync / sdk-verify / test*
├── .contracts-version               # 锚定的 oddfi-contracts release tag
├── .github/workflows/ci.yml         # CI matrix
│
└── sdk/                             # ─── L1 module ──────────────────────────
    │   github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk
    ├── client/                      # Connection / Env / 启动一致性校验
    ├── signer/                      # Local / Keystore / NewAuto / (KMS 子包待加)
    ├── admin/                       # admin 写方法
    ├── multisig/                    # Gnosis Safe 三模式（Propose/Direct/Calldata）
    ├── reader/                      # view + 事件 Layer 0/1/2
    ├── errs/                        # typed ContractError
    ├── bindings/                    # abigen 生成（提交进 git）
    ├── abi/                         # ABI JSON（来自 oddfi-contracts release）
    ├── config/                      # //go:embed testnet.json / mainnet.json
    ├── testutil/                    # ForkTestnet / ForkMainnet helper
    └── testdata/                    # pinned-blocks.json / revert/event 样本
```

---

## 2. 前置依赖

| 工具 | 版本 | 用途 |
|---|---|---|
| Go | ≥ 1.22 | SDK 本体 |
| [Foundry](https://getfoundry.sh) (`forge` / `anvil`) | latest | 上游合约 ABI 来源 + L1 Anvil fork 测试 |
| [GitHub CLI](https://cli.github.com/) (`gh`) | ≥ 2.0 | `make pull-abi` 拉取上游 release artifact |
| `jq` | ≥ 1.6 | Makefile 解析 JSON |

---

## 3. Quick Start

```bash
# 1. clone
git clone git@github.com:Crypto-Barrett/oddfi-contracts-sdk.git
cd oddfi-contracts-sdk

# 2. 安装依赖
cd sdk && go mod download && cd ..

# 3. 编译验证
go build ./sdk/...
# 或者
make build

# 4. （后续）拉取 ABI 并生成 binding——需要 oddfi-contracts 已发 release
echo "v1.0.0" > .contracts-version
make pull-abi
make sdk-sync
```

---

## 4. 测试方法

### 4.1 L1 测试三层

| 命令 | 内容 | 触发 | 依赖 |
|---|---|---|---|
| `make test` | L1 unit：simulated backend，验证参数校验 / ABI 编码 / typed error 解析 / Simulate / event 解码 | 每 PR | 无 |
| `make test-fork` | L1 anvil fork：真起 anvil fork BSC testnet/mainnet，固定块号，全量读+写 | 每 PR | foundry, `BSC_TESTNET_RPC` / `BSC_MAINNET_RPC` env |
| `make test-dryrun` | L1 mainnet dry-run：真 mainnet RPC，仅 `eth_call` / `estimateGas`，**绝不广播**（测试 helper 强制 signer=nil） | 每 PR | `BSC_MAINNET_RPC` env |
| `make test-e2e` | E2E smoke：anvil fork + 真发交易，跑端到端业务流程 | 仅 nightly + release | foundry + RPC env |

### 4.2 ABI 同步检查

```bash
make sdk-verify
# 等价于 make pull-abi && make sdk-sync && git diff --exit-code sdk/abi sdk/bindings
# 在 CI 里跑，保证 oddfi-contracts 改了但 SDK 没跟上的 PR 直接挂掉
```

### 4.3 覆盖率门槛

| 模块 | 阈值 | 排除 |
|---|---|---|
| `sdk/` | 85% | `bindings/`（自动生成）、`signer/awskms/`（占位） |

CI fail-on-decrease：新 PR 不能让覆盖率下降。

---

## 5. 调用方法

### 5.1 构造 Connection 与 Role Client

```go
package main

import (
    "context"
    "log"
    "log/slog"
    "os"

    "github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/admin"
    "github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/client"
    "github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/multisig"
    "github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/reader"
    "github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/signer"
)

func main() {
    ctx := context.Background()

    // 1. 建 Connection（启动时校验 chain id 与链上 admin/multisig 一致）
    conn, err := client.NewConnection(client.ConnectionConfig{
        Env:    client.Mainnet,           // client.Testnet 切测试网
        RPC:    os.Getenv("BSC_RPC"),     // 必填，无默认（mainnet 安全）
        Logger: slog.Default(),
    })
    if err != nil {
        log.Fatal(err)
    }
    defer conn.Close()

    // 2. Signer：testnet 走 env var，mainnet 走 k8s/docker secret 文件
    var sgnr signer.Signer
    if conn.Env() == client.Testnet {
        sgnr, err = signer.NewFromHex(os.Getenv("ADMIN_PK"))
    } else {
        sgnr, err = signer.NewFromSecretFile("/run/secrets/admin_pk")
    }
    if err != nil {
        log.Fatal(err)
    }

    // 3. 各 role client
    adminCli, _ := admin.New(conn, admin.WithSigner(sgnr))
    msCli, _ := multisig.New(conn,
        multisig.WithProposer(sgnr),
        multisig.WithSafeTxServiceURL("https://safe-transaction-bsc.safe.global"),
    )
    readerCli := reader.New(conn)

    _ = adminCli
    _ = msCli
    _ = readerCli
}
```

### 5.2 admin 写交易（Simulate 预校验 + typed error）

```go
import (
    "errors"
    "github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/admin"
    "github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/errs"
)

args := admin.LockBetArgs{
    BetID:      betID32,                 // [32]byte
    User:       userAddr,                // common.Address
    Amount:     amountWei,               // *big.Int (USDT 6 decimals)
    MatchID:    matchID32,
    Market:     admin.MarketX12,
    Outcome:    0,                       // 0=主胜
    Line:       0,
    LockedOdds: big.NewInt(1818),        // 赔率 ×1000
}

// 推荐：先 Simulate（eth_call dry-run），通不过解析为 typed error
if err := adminCli.SimulateLockBet(ctx, args); err != nil {
    var cerr *errs.ContractError
    if errors.As(err, &cerr) {
        switch cerr.Name {
        case "InsufficientBalance":   // 余额不够，业务侧友好提示
        case "MarketClosed":          // 盘口已封，不重试
        default:                      // 其他：记日志
        }
    }
    return err
}

// Simulate 通过 → 真发交易
tx, err := adminCli.LockBet(ctx, args)
if err != nil {
    return err
}
log.Printf("tx submitted: %s", tx.Hash().Hex())
```

### 5.3 multisig 三种模式

```go
// Mode 1: Propose 到 Safe Transaction Service（Mainnet 默认）
prop, err := msCli.Settle.Propose(ctx, multisig.SettleArgs{
    MatchID: matchID32, Market: 0, Line: 0,
    WinningOutcome: 0, BetIDs: [][32]byte{betID32},
})
fmt.Println(prop.SafeTxHash, prop.SafeUIURL)
fmt.Println(prop.ConfirmationsCount, "/", prop.ConfirmationsRequired)

// 后续轮询
status, _ := msCli.GetProposal(ctx, prop.SafeTxHash)
if status.Executed {
    fmt.Println("on-chain tx:", status.OnChainTxHash)
}

// Mode 2: Direct Execute（仅 Testnet 1-of-1，mainnet 启动 ERROR）
tx, err := msCli.Settle.Execute(ctx, args)

// Mode 3: Calldata-only（不需要 signer，最低风险 fallback）
cd, err := msCli.Settle.Calldata(ctx, args)
fmt.Printf("paste to Safe UI: to=%s value=%s data=%x\n", cd.To, cd.Value, cd.Data)
```

### 5.4 reader 视图 + 事件订阅

```go
// 视图调用
balance, _ := readerCli.UserBalance(ctx, userAddr)
bet, _ := readerCli.GetBet(ctx, betID32)
ok, _ := readerCli.IsAccepting(ctx, reader.IsAcceptingArgs{...})

// 事件 Layer 1：单事件
iter, _ := readerCli.Deposited.Filter(ctx, reader.FilterOpts{
    FromBlock: big.NewInt(int64(deployBlock)),
    ToBlock:   nil,
    Users:     []common.Address{userAddr},
})
for iter.Next() {
    e := iter.Event
    fmt.Printf("%s deposited %s\n", e.User.Hex(), e.Amount)
}

// 事件 Layer 2：统一流（自动回放→实时切换）
stream, _ := readerCli.Stream(ctx, reader.StreamOpts{
    FromBlock:      uint64(lastProcessedBlock),
    BatchSize:      5000,                      // BSC eth_getLogs 上限
    EventKinds:     []reader.EventKind{reader.EventDeposited, reader.EventBetLocked},
    SwitchToLiveAt: 5,                         // 切实时缓冲块数
})
for {
    select {
    case e := <-stream.Events:
        handle(e)
    case err := <-stream.Errors:
        log.Println("stream error:", err)
    case <-ctx.Done():
        return
    }
}
```

### 5.5 错误类型一览

```go
var cerr *errs.ContractError
if errors.As(err, &cerr) {
    cerr.Name      // "InsufficientBalance" / "MarketClosed" / "Error(string)" / "Unknown"
    cerr.Args      // map[string]interface{}, e.g. {"required": 1000, "available": 500}
    cerr.Method    // "LockBet"
    cerr.Raw       // 原始 revert data（调试用）
    cerr.Inner     // 原始 err（用 errors.Unwrap 也能拿）
}
```

---

## 6. ABI 同步流程

ABI 来自上游 `oddfi-contracts` 的 GitHub Release artifact（合约仓库的 release workflow 在 tag 时自动 attach `abi.tar.gz`）。

```bash
# 1. 看当前锚定哪个版本
cat .contracts-version
# main

# 2. 升级合约：改 .contracts-version → 拉新 ABI → 重生 binding → commit
echo "v1.0.0" > .contracts-version
make pull-abi          # gh release download v1.0.0 → 解压到 sdk/abi/
make sdk-sync          # go generate ./bindings/... → 重生 abigen 绑定 + go build 验证
git add sdk/abi sdk/bindings .contracts-version
git commit -m "feat: bump contracts to v1.0.0"
```

CI 跑 `make sdk-verify` 把关：保证 PR 里的 ABI / binding / `.contracts-version` 三者一致。

---

## 7. 配置（`sdk/config/*.json`，编译时 `//go:embed`）

```jsonc
// sdk/config/testnet.json
{
  "name": "testnet",
  "chainId": 97,
  "contracts": {
    "bettingPool": "0xCcAD84d0772262AeDe15B1B702d1Bd69D02f177D",
    "usdt":        "0xd8f86e84b4475d7bd398788e594124429e7700cf"
  },
  "expectedRoles": {
    "admin":    "0x...",   // 部署 deployer 地址，待手工填
    "multisig": "0x..."
  },
  "deployBlock": 0,
  "explorer":    "https://testnet.bscscan.com"
}

// sdk/config/mainnet.json — 主网部署当天通过 PR 填入
```

启动校验：`NewConnection` 拉链上 `admin()` / `multisig()`，与 `expectedRoles` 比对。
- **Mainnet** 不一致：默认 ERROR 拒启动（可通过 `AllowAdminMismatch` 降级 WARN）
- **Testnet** 不一致：默认 WARN 但启动

---

## 8. 私钥管理

| 角色 | testnet | mainnet |
|---|---|---|
| Admin | env var `ADMIN_PK` | k8s Secret 挂 `/run/secrets/admin_pk`（raw key） |
| Multisig 提案者 | env var `PROPOSER_PK` | k8s Secret 挂 `/run/secrets/proposer_pk` |
| Multisig 签名者 | Ledger / Safe UI（不在 SDK 范围） | 同左 |
| Reader | 不需要 | 不需要 |

`signer.NewAuto`：testnet 优先 env，没有再读 file；**mainnet 强制 file only**——env 中如果发现同名变量直接 ERROR（防误传）。

读取流程：read raw bytes → parse `*ecdsa.PrivateKey` → **zero out raw byte buffer** → log `signer.local loaded source=file path=... addr=0x...（脱敏）`。

---

## 9. CI Matrix

`.github/workflows/ci.yml` 包含：

| Job | 触发 | 内容 |
|---|---|---|
| `unit` | 每 PR | `cd sdk && go test ./...` |
| `fork` | 每 PR | foundry + `cd sdk && go test -tags=fork ./...`（需 RPC secret） |
| `dryrun` | 每 PR | `cd sdk && go test -tags=dryrun ./...`（需 mainnet RPC secret） |
| `abi-sync-check` | 每 PR | `make pull-abi && make sdk-sync && git diff --exit-code` |
| `e2e` | schedule + release | foundry + `make test-e2e` |

需要在 GitHub repo settings 配置的 secret：
- `BSC_TESTNET_RPC` — Testnet RPC URL
- `BSC_MAINNET_RPC` — Mainnet RPC URL（dry-run 用，无需写权限）

---

## 10. 许可

Internal use only. 后续按需开源时再调整。
