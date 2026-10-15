# sdk/e2e — 端到端合约调用测试

> 真实 BSC testnet 上跑各业务流程的 e2e 测试。已实现:
> - **Flow 1**(单注):充值 → 下注 → 结算 → 提现
> - **Flow 2**(串关):2 腿全胜
> - **Flow 3**(信用仓位):A 抵押单 → B 信用单,A 先结算 B 后结算,A/B 都赢
>
> 所有文件 `//go:build e2e`,普通 `go test ./...` **不会触发**,只在显式 `-tags=e2e` 时启用。

## 测试方法清单

| 测试函数 | 文件 | 作用 | 是否发 tx |
|---|---|---|---|
| `TestPreflight` | `preflight_test.go` | 派生 admin/user 地址、查 BNB/USDT/合约 USDT 余额、对比配置中预期 admin、报告链上状态 | ❌(只读) |
| `TestFlow1` | `flow1_test.go` | Flow 1 单注全程 7 笔 tx,带每步断言 + 终末账目 | ✅ 7 笔 |
| `TestFlow1Resume` | `flow1_resume_test.go` | 当 `TestFlow1` 中途失败、合约里挂着未结算 bet 时,用它把 stuck 状态收尾(CloseMarket → Settle → Withdraw) | ✅ 1~3 笔(取决于状态) |
| `TestFlow2` | `flow2_test.go` | Flow 2 串关全程 10 笔 tx,2 腿全胜,验证 `combinedOdds` 与 `payout = stake × combined / 1000` | ✅ 10 笔 |
| `TestFlow3` | `flow3_test.go` | Flow 3 信用仓位 11 笔 tx,A 先 B 后两单全胜,验证 profit_A 与 profit_B 直接入账(本分支无 Release 需求) | ✅ 11 笔 |

> 命名约定:`TestFlow{N}` 跑流程 N,`TestFlow{N}Resume` 收尾该流程的中断态。流程 N 专属常量在 `flow{N}_test.go` 中以 `f{N}` 前缀(如 `f1Stake`、`f1Odds`)避免跨流程撞名。新增流程 2 / 3 时按这个规则加文件即可,无需改动 `helpers_test.go`。

---

## 必需的环境变量

| 变量 | 用途 | 示例 |
|---|---|---|
| `E2E_RPC` | BSC testnet RPC URL | `https://bnb-testnet.g.alchemy.com/v2/<key>` |
| `E2E_ADMIN_PK` | admin/multisig 私钥(必须对应 `sdk/config/testnet.json` 里的 `expectedRoles.admin`,即 `0x7501...4064`) | `0x...` |
| `E2E_USER_PK` | 任意 EOA 私钥,需要少量 BNB 付 gas + ≥ 1 USDT 用于充值步骤 | `0x...` |
| `E2E_RESUME_MATCH_ID` | 仅 `TestFlow1Resume` 使用,32 字节 hex | `0xdc0c...9817` |
| `E2E_RESUME_BET_ID` | 仅 `TestFlow1Resume` 使用,32 字节 hex | `0xacca...5491` |

> **凭据只走 env,绝不写进代码或 commit。** 测试代码用 `redactRPC()` 截掉 RPC URL 的 API key 再打日志。

---

## 启动命令

### 1) Preflight(只读,先跑这个)

```bash
cd sdk && \
  E2E_RPC='https://bnb-testnet.g.alchemy.com/v2/deHKMj6sxxxUn7h0uIzHt' \
  E2E_ADMIN_PK='0xf56381db8696b0121b7cdb1d00437c7b6c5f053b04602bfba8947280f407e796' \
  E2E_USER_PK='0xadadadadadadadadadadadadadadadadadadadadadadadadadadadadadadadad' \
  go test -tags=e2e -count=1 -v -run TestPreflight ./e2e/...
```

### 2) Flow 1 全程(发 7 笔 tx)

```bash
cd sdk && \
  E2E_RPC='https://bnb-testnet.g.alchemy.com/v2/deHKMj6sxxxUn7h0uIzHt' \
  E2E_ADMIN_PK='0xf56381db8696b0121b7cdb1d00437c7b6c5f053b04602bfba8947280f407e796' \
  E2E_USER_PK='0xadadadadadadadadadadadadadadadadadadadadadadadadadadadadadadadad' \
  go test -tags=e2e -count=1 -v -timeout=10m -run TestFlow1 ./e2e/...
```

### 2b) Flow 2 串关(发 10 笔 tx)

```bash
cd sdk && \
  E2E_RPC='https://bnb-testnet.g.alchemy.com/v2/deHKMj6sxxxUn7h0uIzHt' \
  E2E_ADMIN_PK='0xf56381db8696b0121b7cdb1d00437c7b6c5f053b04602bfba8947280f407e796' \
  E2E_USER_PK='0xadadadadadadadadadadadadadadadadadadadadadadadadadadadadadadadad' \
  go test -tags=e2e -count=1 -v -timeout=15m -run TestFlow2 ./e2e/...
```

### 2c) Flow 3 信用仓位(发 11 笔 tx)

```bash
cd sdk && \
  E2E_RPC='https://bnb-testnet.g.alchemy.com/v2/deHKMj6sxxxUn7h0uIzHt' \
  E2E_ADMIN_PK='0xf56381db8696b0121b7cdb1d00437c7b6c5f053b04602bfba8947280f407e796' \
  E2E_USER_PK='0xadadadadadadadadadadadadadadadadadadadadadadadadadadadadadadadad' \
  go test -tags=e2e -count=1 -v -timeout=15m -run TestFlow3 ./e2e/...
```

### 3) Resume 卡住的 bet

```bash
cd sdk && \
  E2E_RPC='https://bnb-testnet.g.alchemy.com/v2/deHKMj6sxxxUn7h0uIzHt' \ E2E_ADMIN_PK='0xf56381db8696b0121b7cdb1d00437c7b6c5f053b04602bfba8947280f407e796' \ E2E_USER_PK='0xadadadadadadadadadadadadadadadadadadadadadadadadadadadadadadadad' \
  E2E_RESUME_MATCH_ID='0x<32-byte hex>' \
  E2E_RESUME_BET_ID='0x<32-byte hex>' \
  go test -tags=e2e -count=1 -v -timeout=5m -run TestFlow1Resume ./e2e/...
```

> 当 `TestFlow1` 在 step 3+ 之后失败时,先把日志里的 `matchID = 0x...` 与 `betID = 0x...` 抠出来,跑这个把状态清干净,再重跑 `TestFlow1`。

### Makefile 等价命令

`make test-e2e` 会跑 sdk 下所有 e2e tag 的测试(env 变量需自行 export)。

---

## Flow 1 — 单注 调用先后顺序(7 步)

```
┌─────────┬──────────────────┬─────────────────┬────────────────────────────────┐
│  Step   │ 调用者           │ 方法            │ 用途                           │
├─────────┼──────────────────┼─────────────────┼────────────────────────────────┤
│   0     │ Admin            │ OpenMarket      │ 打开 (matchID, X12, line=0) 桶 │
│   1     │ User             │ USDT.Transfer   │ 把 stake 打到 BettingPool 地址 │
│   2     │ Admin            │ CreditDeposit   │ 把入金记入 user.userBalances   │
│   3     │ Admin            │ LockBet         │ 锁定 bet,locked += stake       │
│  3.5    │ Admin            │ CloseMarket     │ 关投注窗口(必须早于 Settle)   │
│   4     │ Multisig EOA     │ Settle          │ 结算:locked 清 0,userBalances │
│         │ (== admin EOA)   │                 │ 增至 payout = stake × odds/1e3 │
│   5     │ User             │ Withdraw        │ 把 userBalances 提到 USDT 钱包 │
└─────────┴──────────────────┴─────────────────┴────────────────────────────────┘
```

### 参数(`flow1_test.go` 里的常量)

```go
const (
    f1Stake      int64 = 1_000_000  // 1 USDT (6 decimals raw)
    f1Odds       int64 = 1818       // 1.818x (×1000 编码)
    f1Market     uint8 = 0          // X12
    f1Line       uint8 = 0
    f1BetOutcome uint8 = 1          // user 赌 outcome=1
    f1Winning    uint8 = 1          // 结算时 winningOutcome=1 → user 赢
)
```

> 流程 N 专属常量统一 `f{N}` 前缀,跨流程不撞名。

### 每步代码骨架

```go
// Step 0: Admin opens the market bucket
admCli.SimulateOpenMarket(ctx, args)        // eth_call 干跑
admCli.OpenMarket(ctx, args)                // 上链
waitMined(...)                              // 阻塞到 receipt status=1

// Step 1: User pays stake to BettingPool (普通 ERC20 转账)
uOpts, _ := txOpts(ctx, conn, usrSigner)
transferTx, _ := usdt.Transfer(uOpts, bpAddr, stakeWei)
depositTxHash := transferTx.Hash()          // ← 用作 step 2 的 dedup key

// Step 2: Admin records the deposit (TxHash 是 [32]byte one-shot dedup key)
admCli.SimulateCreditDeposit(ctx, ...)
admCli.CreditDeposit(ctx, sdkadmin.CreditDepositArgs{
    User: user, Amount: stakeWei, TxHash: depositTxHash,
})

// Step 3: Admin locks the bet
admCli.SimulateLockBet(ctx, ...)
admCli.LockBet(ctx, sdkadmin.LockBetArgs{
    BetID: betID, User: user, Amount: stakeWei, MatchID: matchID,
    Market: sdkadmin.MarketX12, Outcome: f1BetOutcome, Line: f1Line,
    LockedOdds: big.NewInt(f1Odds),
})

// Step 3.5: Admin closes the market (else Settle 会 "not open" revert)
admCli.SimulateCloseMarket(ctx, ...)
admCli.CloseMarket(ctx, ...)

// Step 4: Multisig EOA calls BettingPool.Settle directly via abigen binding.
// 注意:这里 multisig 是 EOA,不是 Gnosis Safe,所以**绕过 sdk/multisig 包**。
mOpts, _ := txOpts(ctx, conn, admSigner)    // admin == multisig 同把 key
bp.Settle(mOpts, matchID, f1Market, f1Line, f1Winning, [][32]byte{betID})

// Step 5: User withdraws (whatever payout is in userBalances)
payout := userBalances // 直接读链上,不依赖客户端算 odds
uOpts2, _ := txOpts(ctx, conn, usrSigner)
bp.Withdraw(uOpts2, payout)
```

---

## Flow 2 — 串关 (Parlay) 调用先后顺序(10 步)

```
┌─────────┬──────────────────┬─────────────────┬──────────────────────────────────┐
│  Step   │ 调用者           │ 方法            │ 用途                             │
├─────────┼──────────────────┼─────────────────┼──────────────────────────────────┤
│  0a/0b  │ Admin            │ OpenMarket × 2  │ 打开两个不同 matchID 的盘口      │
│   1     │ User             │ USDT.Transfer   │ 把串关 stake 打进 BettingPool    │
│   2     │ Admin            │ CreditDeposit   │ 入账,user.userBalances += stake  │
│   3     │ Admin            │ LockParlay      │ 一次性创建 Parlay + 各腿 Bet,    │
│         │                  │                 │ user.lockedBalances += stake     │
│         │                  │                 │ 合约自算 combinedOdds=Π/1000^(n-1)│
│ 3.5a/b  │ Admin            │ CloseMarket × 2 │ 两个盘口收注后各自关窗           │
│  4a/b   │ Multisig EOA     │ Settle × 2      │ 各腿独立结算,解算最后一腿时合约  │
│         │                  │                 │ finalize parlay → 全胜则        │
│         │                  │                 │ user.userBalances += stake×      │
│         │                  │                 │ combinedOdds/1000               │
│   5     │ User             │ Withdraw        │ 提走 payout                      │
└─────────┴──────────────────┴─────────────────┴──────────────────────────────────┘
```

### 参数(`flow2_test.go`)

```go
const (
    f2Stake     int64 = 1_000_000  // 1 USDT
    f2LegOdds   int64 = 1500       // 1.5x per leg → combinedOdds = 1500*1500/1000 = 2250
    f2Market    uint8 = 0          // X12
    f2Line      uint8 = 0
    f2Outcome   uint8 = 1          // user picks outcome=1 on every leg
    f2Winning   uint8 = 1          // ditto on settle
    f2NumLegs         = 2
)
```

### 关键合约语义

- `parlays[parlayId]` 字段:`User / Stake / CombinedOdds / MaxPayout / Status / SettledLegs / WonLegs / CancelledLegs`
- 每腿 Settle 触发 parlay 内部状态机更新 `SettledLegs`、`WonLegs`
- 当 `SettledLegs == NumLegs`:
  - `WonLegs == NumLegs` → 全胜,合约把 `MaxPayout` 转入 user.userBalances
  - 其它 → 输串关或部分取消(本测试只覆盖全胜分支)
- `MaxPayout = stake × CombinedOdds / 1000`,与启动时 `LockParlay` 计算一致(也是上限,合约会与 $10,000 USDT 对齐再 require)

---

## Flow 3 — 信用仓位 (Credit Bet / Lending) 调用先后顺序(11 步)

```
┌─────────┬──────────────────┬───────────────────────┬────────────────────────────────┐
│  Step   │ 调用者           │ 方法                  │ 用途                           │
├─────────┼──────────────────┼───────────────────────┼────────────────────────────────┤
│  0a/0b  │ Admin            │ OpenMarket × 2        │ 打开 matchA(抵押)/ matchB(信用) │
│   1     │ User             │ USDT.Transfer(stakeA) │ 全部入金做抵押,Pool 收钱      │
│   2     │ Admin            │ CreditDeposit(stakeA) │ user.userBalances = stakeA     │
│   3     │ Admin            │ LockBet A             │ 普通注单:locked += stakeA      │
│   4     │ Admin            │ LockCreditBet B       │ 信用注单 amountB ≤ stakeA × 0.5 │
│         │                  │ (collateral=A)        │ B 的资金来自 bettingPool,**不动│
│         │                  │                       │ user.userBalances**            │
│   5     │ Admin            │ CloseMarket A         │                                │
│   6     │ Multisig EOA     │ Settle A (A wins)     │ locked -= stakeA;             │
│         │                  │                       │ userBalances += profit_A       │
│   7     │ Admin            │ CloseMarket B         │                                │
│   8     │ Multisig EOA     │ Settle B (B wins)     │ A 已赢 → **直接入账**:        │
│         │                  │                       │ userBalances += profit_B       │
│         │                  │                       │ (frozenPayouts[B] 保持 0,     │
│         │                  │                       │ Release 不需要)                │
│   9     │ User             │ Withdraw              │ 提走 stakeA + profit_A + profit_B │
└─────────┴──────────────────┴───────────────────────┴────────────────────────────────┘
```

```
profit_A = stakeA × (oddsA − 1000) / 1000
profit_B = amountB × (oddsB − 1000) / 1000   ← 信用扣除后的净利润
```

### 参数(`flow3_test.go`)

```go
const (
    f3StakeA  int64 = 2_000_000  // 2 USDT collateral
    f3AmountB int64 = 1_000_000  // 1 USDT credit (= 50% of A,刚到 cap)
    f3Odds    int64 = 1500       // 1.5x for both legs
    f3Market  uint8 = 0          // X12
    f3Line    uint8 = 0
    f3Outcome uint8 = 1
    f3Winning uint8 = 1
)
```

### 两条结算分支(本测试只覆盖第一条)

| 顺序 | Settle B 时的处理 | 是否需要 ReleaseOrForfeiture |
|---|---|---|
| **A 先 B 后**(本测试) | `userBalances += profit_B` 直接入账 | ❌ 不需要 |
| **B 先 A 后** | `frozenPayouts[B] = gross payout`,B 利润冻结 | ✅ 必须 — A 结算后调 `Multisig.ReleaseOrForfeiture(B)`:<br>A 赢 → 释放净利润给用户;A 输 → forfeit 给 platformBalance |

> 直接调 binding(因为本 testnet multisig 是 EOA),即 `bp.ReleaseOrForfeiture(opts, betB)`。
> 在"A 先 B 后"分支强行调它会 revert(没有可释放的冻结金额)。

---

## 这次测试结果(2026-04-30 ~ 05-01 BSC testnet)

### TestFlow1 全程 PASS · 47.33s · 7 笔 tx 全部 mined

```
== START ==  user.USDT=102.636000  bp.USDT=12406.564000
matchID = 0xee9edf7b95e7e74c47e66dd8504f3a289321ce1dfc96cd123977e9f66179a594
betID   = 0xf5ad9dfd153ebdb8c2a161966d8464fc4e6847db134c0f1fe2fc91713d8311d8

STEP 0   admin.OpenMarket          gasUsed=101_478   block=104716296
STEP 1   user → BettingPool USDT   gasUsed= 34_126   block=104716305  (BettingPool +1.000000 USDT ✓)
STEP 2   admin.CreditDeposit       gasUsed= 99_563   block=104716313  (user.userBalances = 1.000000 ✓)
STEP 3   admin.LockBet             gasUsed=212_232   block=104716339  (locked=1.000000 spendable=0.000000 ✓)
STEP 3.5 admin.CloseMarket         gasUsed= 37_056   block=104716368
STEP 4   multisig.Settle           gasUsed=120_094   block=104716376  (locked=0 userBalances=1.818000 ✓)
STEP 5   user.Withdraw             gasUsed= 57_789   block=104716386

== DONE ==
stake placed        : -1.000000 USDT
settle payout (gross): +1.818000 USDT
net to user wallet   : +0.818000 USDT
user wallet 102.636 → 103.454 USDT
```

### 7 笔 tx 的 bscscan 链接

| # | 步骤 | tx hash |
|---|---|---|
| 0 | OpenMarket | https://testnet.bscscan.com/tx/0x51b70a2724f216088e3d3bc69a06bd837146a31205ff64a348bf91d85e0db904 |
| 1 | USDT.Transfer | https://testnet.bscscan.com/tx/0xe9ea5c3209742a56708f8f704c7aa5ee9c6995eac81a2933ddd7cfe8464aa3c5 |
| 2 | CreditDeposit | https://testnet.bscscan.com/tx/0x4c24734abb15f26f8caca5fbfd5ee984b2097672c769a7c72df62cd8062c656d |
| 3 | LockBet | https://testnet.bscscan.com/tx/0xfeba3039969b2b9423e149b73a58cc81348bffa564165c9ed0629af2dfed5439 |
| 3.5 | CloseMarket | https://testnet.bscscan.com/tx/0xbf144511b2e51cb2e2b0933ac8b033e36f4b8655262166751aa681fa55528c23 |
| 4 | Settle | https://testnet.bscscan.com/tx/0xed23059e31355639826f91a895db440198a2eff936fb720f339cbf1af368a897 |
| 5 | Withdraw | https://testnet.bscscan.com/tx/0xccfee112eb7f728d358dfeaa1ec39ef45b6fdfdccabe0863bcb6516082292cdf |

### TestFlow2 全程 PASS · 58.11s · 10 笔 tx 全部 mined

```
== START ==  user.USDT=103.454000  bp.USDT=12405.746000
parlayID = 0xfd175b104fa0539077cf9bbd493ac50a512dc77ccac0b11f6da20ff99e2ce9e9
  leg 0: matchID=0x4a02910a... betID=0xd6242f7b...
  leg 1: matchID=0x2c9dd792... betID=0x4481cb6e...

STEP 0a  admin.OpenMarket           gasUsed=101_478   block=104722144
STEP 0b  admin.OpenMarket           gasUsed=101_478   block=104722154
STEP 1   user → BettingPool USDT    gasUsed= 34_126   block=104722163
STEP 2   admin.CreditDeposit        gasUsed= 99_563   block=104722172
STEP 3   admin.LockParlay           gasUsed=548_883   block=104722206  (parlay.combinedOdds=2250 maxPayout=2.250000 ✓)
STEP 3.5a admin.CloseMarket         gasUsed= 37_056   block=104722216
STEP 3.5b admin.CloseMarket         gasUsed= 37_056   block=104722224
STEP 4a  multisig.Settle leg=0      gasUsed=125_126   block=104722232  (settled=1 won=1, parlay status=0)
STEP 4b  multisig.Settle leg=1      gasUsed=132_568   block=104722241  (settled=2 won=2, parlay status=1 ✓)
STEP 5   user.Withdraw              gasUsed= 57_789   block=104722252

== DONE ==
stake placed         : -1.000000 USDT
parlay payout (gross): +2.250000 USDT  (= stake × combinedOdds 2250 / 1000)
net to user wallet   : +1.250000 USDT
user wallet 103.454 → 104.704 USDT
```

### TestFlow2 — 10 笔 tx 的 bscscan 链接

| # | 步骤 | tx hash |
|---|---|---|
| 0a | OpenMarket leg=0 | https://testnet.bscscan.com/tx/0x81ffdbdfc197d711429aef45919ab1d13338eee01b7eb03b6806d95eeb783378 |
| 0b | OpenMarket leg=1 | https://testnet.bscscan.com/tx/0x14bd23bf5ef2bed74f1f6884f0d949a74ee5e20814836787fe356fdd2ba2be46 |
| 1 | USDT.Transfer | https://testnet.bscscan.com/tx/0x13946a5acc3499dab07134a2a42d04cf8f37e93e2bf46aaf94c3cc1015b31814 |
| 2 | CreditDeposit | https://testnet.bscscan.com/tx/0xa21d252ef0f822967e99e0f63dfdb951ae2a0eb2c1deb9ca855cb3328944f957 |
| 3 | LockParlay | https://testnet.bscscan.com/tx/0x05b0200ca239b74ab957165532367d07c6854725011ca052b5b851eeb46b9d0d |
| 3.5a | CloseMarket leg=0 | https://testnet.bscscan.com/tx/0x4b67dd8a245a7a6473ab1f3a9d91c7f749601f722bf5d9017770c02992ffb007 |
| 3.5b | CloseMarket leg=1 | https://testnet.bscscan.com/tx/0x8b8545f126a863c1fc9403cdca7ba048f59c3e4df78c9998a6bf2515e46f6c55 |
| 4a | Settle leg=0 | https://testnet.bscscan.com/tx/0x586e37615b12c39561b8b7e5e5678cbfa83f148300d970107c90a145d5d9fe60 |
| 4b | Settle leg=1 | https://testnet.bscscan.com/tx/0xa5af25a40ea67640692029903e621e7a2580fbc16cbea0edc1bb40d7098f366a |
| 5 | Withdraw | https://testnet.bscscan.com/tx/0xe56fe90b7e2005b874e7351e2878a824863b4f8f670768ad64c7b9fc4365f5a0 |

### TestFlow3 全程 PASS · 47.67s · 11 笔 tx 全部 mined(第 3 次重跑)

注:Flow3 经历 2 次失败迭代才通了 — 第 1 次过度断言"LockBet 后 userBalances 应清零",第 2 次因为 RPC 返回旧值误判"Settle B 后 payout 冻结"。第 3 次改成相对 baseline 的 delta 断言后稳定通过。

```
== START ==  user.USDT=101.704000  bp.USDT=12407.496000
matchA=0x0a93ad4d... betA=0xaba2e2e4... (collateral)
matchB=0x0e328a71... betB=0xf70e9142... (credit)
baseline userBalances = 9.500000 (累积自前几次失败留下的残余)

STEP 0a  admin.OpenMarket A         gasUsed=101_478   block=104723860
STEP 0b  admin.OpenMarket B         gasUsed=101_478   block=104723869
STEP 1   user → BettingPool USDT    gasUsed= 34_126   block=104723877
STEP 2   admin.CreditDeposit        gasUsed= 82_463   block=104723885
STEP 3   admin.LockBet A            gasUsed=212_232   block=104723896
STEP 4   admin.LockCreditBet B      gasUsed=267_874   block=104723905   (locked stays at stakeA = 2; B 用 Pool 资金)
STEP 5   admin.CloseMarket A        gasUsed= 37_056   block=104723917
STEP 6   multisig.Settle A          gasUsed=123_073   block=104723923   (delta=+1.000000 = profit_A ✓)
STEP 7   admin.CloseMarket B        gasUsed= 37_056   block=104723933
STEP 8   multisig.Settle B          gasUsed=105_614   block=104723941   (delta=+0.500000 = profit_B,frozen=0 直接入账 ✓)
STEP 9   user.Withdraw              gasUsed= 57_789   block=104723952

== DONE ==
collateral paid       : -2.000000 USDT
withdrawn (gross)     : +11.000000 USDT  (含本次 +1.5 + 历次累积残余 9.5)
net to user wallet    : +9.000000 USDT
  break-down:
    A (regular) profit: +1.000000 USDT  (= stakeA × 0.5)
    B (credit)  profit: +0.500000 USDT  (= amountB × 0.5,= gross 1.5 − 信用 1)
```

### TestFlow3 — 11 笔 tx 的 bscscan 链接

| # | 步骤 | tx hash |
|---|---|---|
| 0a | OpenMarket A | https://testnet.bscscan.com/tx/0x59cd8bdf35e2e06afae5ea0f4d0ff47da2f776029abd30d1cdcbadb48afe9872 |
| 0b | OpenMarket B | https://testnet.bscscan.com/tx/0xad43f5d1d10d60f47f6432ae9b510443cb0f62821b2c61343de4b3f19a20e953 |
| 1 | USDT.Transfer | https://testnet.bscscan.com/tx/0x0cf458e0869bb5d7de8bdc77b57145678fb1c1bb6152736c737f02160d2fca9d |
| 2 | CreditDeposit | https://testnet.bscscan.com/tx/0x8fe0772aef2505a66edc9717fbd0ba7dc8f06f69e51aeded285d5f4a7d7329b4 |
| 3 | LockBet A | https://testnet.bscscan.com/tx/0x79e1a6c4cb8a92a9017222f941d87441e8df7e27307109c79694d4fd0ab2d54d |
| 4 | LockCreditBet B | https://testnet.bscscan.com/tx/0x49ca693c2596c63a313e7cf165c86ebb76aff336c3570ada100acd6ebe02ac35 |
| 5 | CloseMarket A | https://testnet.bscscan.com/tx/0x427ce3d6a34ff1ccb6f0a2b59b98fa6eeab7d1208d96e0113a6f39dfa5a5b110 |
| 6 | Settle A | https://testnet.bscscan.com/tx/0xb23db704f2b25a67a20e0dbfdafed9fb85bc2ba5e946c74c2cfe5d96ad7e7b91 |
| 7 | CloseMarket B | https://testnet.bscscan.com/tx/0xa896c0cd61a34a7053526be2fc743424c19918dcb43379f92305a8a9ae33733f |
| 8 | Settle B | https://testnet.bscscan.com/tx/0xed3b6419a35e8585ef5d92fe25a655ffa6f06914f12548e64dbfe367d6f1c7a4 |
| 9 | Withdraw | https://testnet.bscscan.com/tx/0x6f6d40e2210addd9535cd8811e0c4163d78de3a571c1473cb59778fe54ce855b |

### TestPreflight 报告(本次启动时)

```
RPC:               https://bnb-testnet.g.alchemy.com/<redacted>  (chain 97)
BettingPool:       0xCcAD84d0772262AeDe15B1B702d1Bd69D02f177D
USDT:              0xd8F86E84B4475D7Bd398788e594124429e7700cf
Expected admin:    0x7501bCBFAAa99e6390577277D051A32ec2e64064
Expected multisig: 0x7501bCBFAAa99e6390577277D051A32ec2e64064
Onchain admin:     0x7501bCBFAAa99e6390577277D051A32ec2e64064
Onchain multisig:  0x7501bCBFAAa99e6390577277D051A32ec2e64064  ← 同 EOA,非 Gnosis Safe
Admin signer addr: 0x7501bCBFAAa99e6390577277D051A32ec2e64064
User signer addr:  0x45C4Ef602bC5EB4493070d69B4F3b6a74f952216

admin (signer)     gas=16.117896 BNB  usdt=690.800000 USDT
user  (signer)     gas=0.098705  BNB  usdt=  1.000000 USDT(后续手动充至 100+)
BettingPool        gas=0.000000  BNB  usdt=12408.200000 USDT
Contract paused:   false
User locked bal:   0 USDT
User in-contract:  0 USDT (spendable)
Latest block:      104714806
```

## 沿途学到的合约语义(写代码必看)

1. **`userBalances` 不是"可花余额",是"总入账"**
   - `LockBet` 不会减 `userBalances`,只增 `lockedBalances`。
   - 真正的可花余额 = `userBalances - lockedBalances`。
   - `Settle` 后:locked 清 0,userBalances 增至 payout(`payout = stake × LockedOdds / 1000`)。

2. **`IsAccepting(matchID, market, line, outcome)` view 不反映 OpenMarket / CloseMarket 状态**
   - CloseMarket 后这个 view 仍返回 true。
   - 它检查的是 `paused == false` + LP 流动性 + 信号灯,**不是**市场桶的 open/closed flag。
   - 真正的关门兜底来自 `Settle` 自己的 require — 关市场前 settle 直接 revert `Error("not open")`。

3. **Settle 必须先 CloseMarket**
   - 没关就 settle:`closeMarket reverted: Error(string) args=map[message:not open]`(实际是 settle 触发的 require,但走 closeMarket 路径上 simulate 也命中)。
   - 标准顺序:Open → 收注期 → Close → Settle。

4. **`creditDeposit` 的 `TxHash` 是 one-shot dedup key**
   - 类型 `[32]byte`,合约里存进 `processedDeposits[txHash] = true`。
   - 同一个 hash 第二次会 revert。
   - 测试里直接用 step 1 USDT.Transfer 的 `tx.Hash()`(`common.Hash` 即 `[32]byte`),既符合"链下入金引用"语义又天然唯一。

5. **multisig 在本 testnet 是 EOA,不是 Gnosis Safe**
   - `sdk/multisig` 包是给真 Gnosis Safe 用的(打包 `execTransaction(...)`),如果对一个 EOA 用 Direct Execute,calldata 发到 EOA 会落空。
   - 在这里 admin EOA == multisig EOA(同一把 key),**绕过 `sdk/multisig`,直接 `bp.Settle(opts, ...)` 用 admin 的 signer**。
   - 上 mainnet 切真 Safe 后,这一步要改回 `msCli.Settle(args).Propose(ctx)`。

6. **EIP-1559 + nonce 通过 `bind.TransactOpts` 注入**
   - `txOpts()` 帮助函数从 Signer 拉 PendingNonceAt,把 ChainID 喂给 SignTx 闭包。
   - `GasFeeCap` / `GasTipCap` / `GasLimit` 都留 nil,让 binding 自动 estimate(Alchemy testnet RPC 答得稳定)。

7. **Parlay 由各腿 Settle 触发自动 finalize**
   - `LockParlay` 一次性写完 parlay 结构 + 每条 leg bet,`combinedOdds` 由合约根据各腿 odds 计算。
   - 各腿独立 `Settle`,合约在 `parlays[parlayId]` 上更新 `SettledLegs/WonLegs`。
   - 当 `SettledLegs == NumLegs` 触发 finalize:全胜则 `userBalances += MaxPayout`;有一腿输则全输并按 70/30 切分 stake。
   - **不需要单独的 finalize 调用** —— 最后一腿的 Settle 自动收尾。

8. **Credit Bet 的双分支结算逻辑**
   - "A 先 B 后" 分支(本测试覆盖):Settle B 时合约知道 A 已结算,**直接**把 `profit_B = amountB × (oddsB−1000)/1000` 入账,`frozenPayouts[B]` 保持 0。
   - "B 先 A 后" 分支(本测试不覆盖):Settle B 时 A 仍 Pending,合约把 gross payout 冻结到 `frozenPayouts[B]`;之后 A 结算后必须调 `Multisig.ReleaseOrForfeiture(B)`:A 赢 → 释放净利润给 user;A 输 → forfeit 给 platformBalance。
   - **在 A-first 分支强行调 ReleaseOrForfeiture(B) 会 revert**(实测错误码 `0xdbfed878`),因为没有冻结金额可释放。

9. **abigen 的 `*big.Int` 返回偶发 nil**
   - `BettingPoolCaller.FrozenPayouts(...)` 在 RPC 短暂抖动时返回 `(nil, err)`(而不是 `(0, nil)`)。
   - 调用处必须 nil-check,否则 `(*big.Int)(nil).Sign()` 直接 panic。模板写法:
     ```go
     v, err := caller.SomeMapping(nil, key)
     switch {
     case err != nil:    // RPC blip; treat as 0 or retry
     case v == nil:      // decode hiccup; treat as 0
     default:            // use v normally
     }
     ```

---

## 测试结构与辅助函数

现状:

```
sdk/e2e/
├── README.md                ← 本文件
├── helpers_test.go          ← 跨流程共享:envOrSkip / connectE2E / loadSigner /
│                              txOpts / waitMined / rand32 / parseHex32 /
│                              usdt6 / signed / usdtSuffixed / bnb / redactRPC
├── preflight_test.go        ← TestPreflight(只读链上 sanity)
├── flow1_test.go            ← f1* 常量 + TestFlow1            (单注)
├── flow1_resume_test.go     ← TestFlow1Resume
├── flow2_test.go            ← f2* 常量 + TestFlow2            (串关)
└── flow3_test.go            ← f3* 常量 + TestFlow3            (信用仓位)
```

> Flow 2 / Flow 3 暂未提供 resume 测试 —— 它们涉及多个 matchID 的 state,清理逻辑比单注复杂。如果将来需要,按 `flow{N}_resume_test.go` 命名建文件即可,helpers/preflight 不动。

| 辅助函数 | 用途 |
|---|---|
| `envOrSkip(t, key)` | env 缺失则 `t.Skip`(让部分配置跑部分测试,而不是噪声 fail) |
| `connectE2E(t)` | 用 `client.NewConnection` 建连,启动校验 chainID + admin/multisig 角色 |
| `loadSigner(t, envKey)` | env hex → `signer.Signer` |
| `txOpts(ctx, conn, s)` | 从 Signer 构造 `bind.TransactOpts`(nonce + Signer 闭包) |
| `waitMined(t, ctx, conn, tx, label)` | `bind.WaitMined`,断言 `Status==1`,打日志 + bscscan 链接 |
| `rand32(t)` | 随机 32 字节,用于 matchID/betID |
| `parseHex32(t, key)` | env 0x 前缀 hex → `[32]byte`,长度强校验 |
| `usdt6(v)` | `*big.Int` → `"x.yyyyyy"` 字符串(USDT 6 decimals) |
| `signed(v)` | `usdt6` 但正数前缀 `+` |
| `usdtSuffixed(v)` | 同 `usdt6` 但加 `" USDT"` 后缀(给 preflight 报告用) |
| `bnb(v)` | wei → `"x.xxxxxx BNB"`(18 decimals) |
| `redactRPC(u)` | 隐藏 RPC URL 里的 API key |

---

## 排错清单

| 现象 | 可能原因 | 处理 |
|---|---|---|
| `t.Skip` "env X not set" | 环境变量没传 | export 三个必需 env |
| `admin signer ... does NOT match expected admin` | `E2E_ADMIN_PK` 不是 `0x7501...4064` 的私钥 | 换私钥;或更新 `sdk/config/testnet.json` |
| 启动报 `*ErrChainIDMismatch` | RPC 不是 BSC testnet (chain 97) | 换 RPC |
| 启动报 `*ErrRoleMismatch` | 部署上 admin/multisig 已经轮换,与 config 不符 | 同步 config |
| Step 1 报 `user wallet has 0.000000 USDT < required 1.000000` | user 钱包没 USDT | 转点 testnet USDT 进 user 地址 |
| Step 4 Settle revert | 没跑 Step 3.5 CloseMarket | 已在测试里串上,正常不会 |
| 中途 fail,bet 卡住 | 任何 step 4 之前的 fail | 用 `TestFlow1Resume` + log 里抠出的 matchID/betID 收尾 |
| `creditDeposit` revert(下次跑) | 同一个 USDT 转账 hash 重复用 | 每次跑会随机新 matchID/betID,且 step 1 总会产生新 tx hash,正常不会 |
| Flow2 LockParlay revert | leg 切片长度不一致 / 红灯 / 流动性不够 / `MaxPayout > $10,000` | 检查 `len(matchIDs)==len(legBetIDs)==NumLegs` 等;减小 stake/odds |
| Flow3 LockCreditBet revert | `amountB > stakeA × 0.5` / 抵押单本身是 credit 或 parlay / Pool 流动性不够 | 减小 amountB,确保 collateralBetID 是 LockBet(非 LockCreditBet/LockParlay)产物 |
| Flow3 ReleaseOrForfeiture revert (`0xdbfed878`) | "A 先 B 后" 分支不该调 Release | 删掉调用,Settle B 已经直接入账 |
| Flow3 第一次跑 userBalances 比预期多 0.5 | 上次失败留下的残余 in-contract 余额 | 测试已改用 delta 断言,robust 不依赖初值;实在不放心可手动 `bp.Withdraw(remaining)` 收尾 |
| `(*big.Int)(nil).Sign()` panic | abigen 调用偶发返回 nil | 包一层 nil-check 再 `Sign()`,见上文"沿途学到的合约语义"第 9 条 |

---

## 上线前要切回的事(指 mainnet)

- `client.Testnet` → `client.Mainnet`
- 多签从 EOA 切到真 Gnosis Safe → step 4 改回 `msCli.Settle(args).Propose(ctx)`(异步 Safe UI 再签)
- E2E 在 mainnet 不能一次性跑完(等 owner 集齐签名),只能分段验证
