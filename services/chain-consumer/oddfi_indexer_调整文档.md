# OddFi 链上行为索引 —— 调整文档（待确认，确认后实施）

> 目标：在 `func (s *EVMService) HandleMessage` 现有架构下，新增解析 OddFi 4 个合约的事件日志，
> 分别写入 `admin_onchain_action`（管理员特权操作审计）与 `user_onchain_action`（用户行为流水），
> 沿用「abigen 处理 abi.json 生成 Go 绑定 → 用生成的 ParseXxx 过滤 log」的方式（同 `ParseBetPlaced`），
> 沿用现有 `errgroup` 并发处理风格。

---

## 0. 我已确认的事实（代码核对结果）

1. **过滤机制**：`betPlacedparser.ParseBetPlaced(log)` 等 abigen 生成方法，**只按 `log.Topics[0]`（事件签名哈希）匹配**，
   底层 `bind.BoundContract.UnpackLog` 在 topic0 不一致时返回 error。**它不校验 `log.Address`**。
   - 推论：必须自己加「合约地址白名单」，否则 `BettingSettlementModule`（delegatecall，事件以 BettingPool 代理地址出）
     或任何第三方合约发出的同签名事件都会被误收。
2. **现有 `BettingPool` 绑定（`service/evm/contract/bettingPool.go`）已包含本次需要的全部 BettingPool 事件**
   （BetPlaced/BetClaimed/PayoutClaimed/BetRefunded/Referral*/ReferrerBound/MarketOpened/MarketSettled/
   OddsUpdated/PushRefunded/PlatformReserveUpdated/Role*/Paused/Unpaused/Upgraded/Initialized）。**无需重新生成。**
3. **缺 3 个合约的 Go 绑定**：`StakingPool` / `LiquidityPool` / `ODDToken`。已在 `D:\everything_finance\oddfi-ODD\out\*.sol\*.json`
   找到 Foundry 编译产物（artifact 里 ABI 在 `.abi` 字段下，需提取成纯 ABI 数组再喂给 abigen）。
4. **事件覆盖核对：4 个合约的 artifact 事件签名与两份 md 要求逐项核对，全部存在**（详见第 8 节映射表）。
5. **字段可得性**：
   - `contract_address` = `log.Address`、`block_number` = `log.BlockNumber`、`log_index` = `log.Index`、
     `block_hash` = `log.BlockHash`、`tx_hash` = `log.TxHash` —— 均来自 `types.Log` ✓
   - `tx_from` = `EvmReceipts.From`（在 receipt 上，不在 log 上；现有 `checkBscReceipts` 遍历 log 时**没把 receipt.From 带进去**，需补） ✓
   - `block_time` = **log 里没有**，需解析 `EvmResult.Block.timestamp`（当前是 `json.RawMessage` 未使用），整块共用一个时间戳 ⚠️
6. **合并键**：`BetClaimed` 与 `PayoutClaimed` 都带 indexed `betId`，可在同一 tx 内按 `(tx_hash, betId)` 配对合并成一条 `BET_CLAIMED`。
7. **abigen 可用**：`service/tron/contract/contract.go:20` 注释显示本机已装 `C:\Users\Administrator\go\bin\abigen.exe`。

---

## 1. 配置方案（已确认）

> 背景：你最初选了「eth_chainId 获取」，但代码核对发现 `EVMService` 拿到的 `RpcUrl`
> （`internal/chain_crawler/client.go:39` 用作 `RpcUrl + "/web3-chaincrawler/backward"`）是**链爬虫中继服务地址，不是 EVM JSON-RPC 节点**，发 `eth_chainId` 会失败。
> **已确认改用「配置」方案，且 chain_id 与 4 个合约地址都进配置，本次只跑测试网（chain_id=97）。**

在 `global.ChainConfig` 下增加 OddFi 专属配置块（per-chain，挂在 bsc 下）：

```yaml
bsc:
  kafka: { ... }
  is_debug_trace: false
  oddfi:
    chain_id: 97
    betting_pool:   "0xbbc6ef3f665bf65cb531172e5f2252155e80ce1f"
    staking_pool:   "0x65fd4a2529010693ba474d1993631e305a42e061"
    liquidity_pool: "0xdf0c59b387dfdf9f18969880ddcf1216bfee318f"
    odd_token:      "0x5530da4357803bd0ed806a999a1f1fcc3c45dc8c"
```

```go
type OddFiConfig struct {
    ChainID       int64  `yaml:"chain_id" json:"chain_id"`
    BettingPool   string `yaml:"betting_pool" json:"betting_pool"`
    StakingPool   string `yaml:"staking_pool" json:"staking_pool"`
    LiquidityPool string `yaml:"liquidity_pool" json:"liquidity_pool"`
    ODDToken      string `yaml:"odd_token" json:"odd_token"`
}
type ChainConfig struct {
    Kafka        KafkaConfig `yaml:"kafka" json:"kafka"`
    IsDebugTrace bool        `yaml:"is_debug_trace" json:"is_debug_trace"`
    OddFi        OddFiConfig `yaml:"oddfi" json:"oddfi"`   // 新增
}
```

`NewEVMService` 把 `cfg.OddFi` 注入 `EVMService`：地址统一 `strings.ToLower` 后构建白名单 map（`addr -> kind`），`chainID` 存为 int64。
主网上线时只改 YAML（换地址、chain_id 改 56），代码不动。

---

## 2. 已确认的设计决策（来自你的回答）

| 决策点 | 结论 |
|---|---|
| match_id 回填 | **实时查映射表回填，查不到存 NULL**（命中率高，逻辑简单；漏的可后续补扫 SQL 修 NULL） |
| reorg 回滚 | **只做幂等入库（OnConflict DoNothing），不做 reorg 回滚**（贴合现有 Kafka 流式被动消费，不引入主动扫块/checkpoint） |
| market_settlement 可选表 | **本次不做**（MarketSettled 已作为 BUSINESS_OPS 进 admin 审计表） |
| chain_id 来源 | **配置（方案 A）**，`bsc.oddfi.chain_id`，本次只跑测试网 = **97** |
| 合约地址 | **进配置**（`bsc.oddfi.*`），本次填 4 个测试网代理地址；主网上线只改 YAML |
| block_time 取不到 | **回退用 `time.Now().UTC()`**（已确认） |

---

## 3. 总体数据流（在现有 HandleMessage 内）

```
HandleMessage
  └─ 解析 Message → EvmResult
     ├─ 解析 EvmResult.Block 一次，得到 blockTime（整块共用）           ← 新增
     └─ checkBscReceipts(receipts, blockTime)                          ← 改造：返回更多结果集
          for each receipt:                                            ← 带上 receipt.From 作为 tx_from
            for each log:
              ├─ ERC20 Transfer 充值过滤（保持原样不动）
              ├─ ParseBetPlaced 回填 onchain_bet_id（保持原样不动）
              ├─ 若 log.Address ∈ 白名单：                              ← 新增：地址路由
              │    ├─ 按 contract 选对应 parser，逐事件尝试 ParseXxx
              │    ├─ 命中 admin 事件 → 收集到 []adminActionRow
              │    ├─ 命中 user 事件  → 收集到 []userActionRow
              │    ├─ 命中 MarketOpened/MatchPoolOpened → 收集到映射表行
              │    └─ 命中 MarketSettlementFinalized → 额外收集一条 onchain_tx_orders 结算行（与 admin 审计并存）
  └─ errgroup 并发（沿用现有风格）：
       ├─ eg.Go: handleEvmTxInfos（原样）
       ├─ eg.Go: handleEvmBetPlaced（原样）
       ├─ eg.Go: handleAdminActions(rows)            ← 新增
       ├─ eg.Go: handleUserActions(rows, maps)       ← 新增（含 match_id 实时回填）
       └─ eg.Go: handleMarketSettlements(orders)     ← 新增（MarketSettlementFinalized → INSERT onchain_tx_orders 结算行）
```

**原则：现有 ERC20 充值逻辑、`onchain_bet_id` 回填逻辑一律不动，新逻辑并行追加。**

---

## 4. 设计细节

### 4.1 ABI → Go 绑定生成（沿用 ParseBetPlaced 方式）

为 3 个合约各生成绑定，落到 `service/evm/contract/`：

| 合约 | 提取 ABI 来源 | 生成文件 | 包内类型 |
|---|---|---|---|
| StakingPool | `oddfi-ODD/out/StakingPool.sol/StakingPool.json` 的 `.abi` | `stakingPool.json` + `stakingPool.go` | `StakingPoolFilterer` |
| LiquidityPool | `oddfi-ODD/out/LiquidityPool.sol/LiquidityPool.json` 的 `.abi` | `liquidityPool.json` + `liquidityPool.go` | `LiquidityPoolFilterer` |
| ODDToken | `oddfi-ODD/out/ODDToken.sol/ODDToken.json` 的 `.abi` | `oddToken.json` + `oddToken.go` | `ODDTokenFilterer` |

生成命令（与 tron 注释同款 abigen）：
```
abigen --abi stakingPool.json   --pkg contract --type StakingPool   --out stakingPool.go
abigen --abi liquidityPool.json --pkg contract --type LiquidityPool --out liquidityPool.go
abigen --abi oddToken.json      --pkg contract --type ODDToken      --out oddToken.go
```
`EVMService` 新增 3 个 filterer 字段，`NewEVMService` 里 `NewXxxFilterer(common.HexToAddress(""), nil)` 初始化（同现有 `betPlacedparser`）。

### 4.2 合约地址白名单（解决 delegatecall / 误收）—— 来自配置

地址不再硬编码，**从 `bsc.oddfi.*` 配置读取**（第 1 节）。`EVMService` 启动时构建白名单：
`map[string]ContractKind`（key=小写地址，value ∈ {BettingPool/StakingPool/LiquidityPool/ODDToken}），
并提供方法 `s.contractKindOf(addr) -> (kind, ok)`。

本次测试网配置 4 个代理地址：
```
BettingPool   0xbbc6ef3f665bf65cb531172e5f2252155e80ce1f
StakingPool   0x65fd4a2529010693ba474d1993631e305a42e061
LiquidityPool 0xdf0c59b387dfdf9f18969880ddcf1216bfee318f
ODDToken      0x5530da4357803bd0ed806a999a1f1fcc3c45dc8c
```
> 注意：`ODDToken` 地址 = 现有 `bscCheckToken1`（充值过滤用的临时 ODD token），两套逻辑共用同地址但解析不同事件，互不冲突。
> 主网上线只改 YAML 配置（换地址 + chain_id 改 56），代码不动。

`checkBscReceipts` 里先 `kind, ok := s.contractKindOf(log.Address)`；`!ok` 跳过新逻辑（老 ERC20/betPlaced 逻辑照跑）。
按 `kind` 决定用哪个 parser、尝试哪些事件，避免对每条 log 盲试所有合约的所有事件。

### 4.3 区块时间 / tx_from 获取

- `block_time`：在 `HandleMessage` 里解析一次 `EvmResult.Block`（用 `EvmDataBlock`，`Timestamp` 是 hex 字符串 → 解析 → `time.Unix(sec,0).UTC()`），
  作为参数透传给 `checkBscReceipts`。**取不到时（Block 为空 / timestamp 缺失 / 解析失败）回退用 `time.Now().UTC()`**（已确认），并打一条 warn 日志。
- `tx_from`：`checkBscReceipts` 改为外层遍历 `receiptsData` 时记住 `receiptsData.From`，构造行时填入。

### 4.4 admin_onchain_action 入库

- 新建 `internal/mysql/admin_onchain_action.go`：GORM 模型 + `BatchInsertAdminActions`（`clause.OnConflict{Columns: chain_id+tx_hash+log_index, DoNothing:true}`）。
- `params JSON`：每个事件构造 `map[string]any`，**大整数（uint256/int256）一律 `.String()` 存字符串**，地址 `strings.ToLower(Hex())`，bytes32 `common.Hash(v).Hex()`。
- `category` / `operator` / `role` / `target_address` 按 md「字段映射」逐事件硬编码（22 个事件，见第 8 节）。
- **特殊过滤**：`PlatformReserveUpdated` 仅 `reason==0` 入库，其余丢弃。
- `operator` 取值规则按 md：自带 operator/sender/account/admin 字段的取字段值，否则取 `tx_from`。
- 解析侧：`Role*/Paused/Unpaused/Upgraded/Initialized` 四合约通用事件，**靠 `log.Address` 区分来源合约**（admin 表按 contract_address 区分，不需要 contract_name）。

### 4.5 user_onchain_action 入库 + 映射表

- 新建 `internal/mysql/user_onchain_action.go`、`market_match_map.go`、`pool_match_map.go`（GORM 模型 + 幂等插入）。
- `action_type` / `user_address` / `counterparty_address` / `amount*` / `extra` 按 md 逐事件映射（见第 8 节）。
- **user_address 一律取事件 indexed 字段，绝不用 tx.from**。
- **match_id 回填（实时查，查不到 NULL）**：
  - `MarketOpened` → upsert `market_match_map`（同时该事件也进 admin 审计表，两处都写）。
  - `MatchPoolOpened` → upsert `pool_match_map`。
  - 写 user 行时：BET_* 用 `market_id` 查 `market_match_map`；LIQUIDITY_* 用 `pool_id` 查 `pool_match_map`；查不到则 `match_id = NULL`。
  - 注意同一区块内 MarketOpened 与 BetPlaced 可能并存：**先处理映射表写入，再处理 user 行回填**（同一 HandleMessage 内保证顺序）。
- 金额 `DECIMAL(65,0)` 存原始 wei 整数（`decimal.Decimal` from `*big.Int`），展示层再按 decimals 格式化。

### 4.6 BET_CLAIMED 合并（BetClaimed + PayoutClaimed）

同一 tx 内按 `(tx_hash, betId)` 配对：`BetClaimed` 提供 `betId/marketId/user/executor`，`PayoutClaimed` 提供 `grossPayout/taxAmount/netPayout`。
合并成一条 `BET_CLAIMED`：`amount=netPayout`、`amount_gross=grossPayout`、`amount_tax=taxAmount`、`counterparty=executor`。
- 二者必在同一 tx、同一区块、同一 Kafka 消息内，故在 `checkBscReceipts` 收集阶段用 map 按 betId 暂存配对即可。
- 边界：若只出现其中一条（理论不会），按已有字段入库，缺失金额列留 NULL。

### 4.7 幂等

三张表 + 两张映射表统一 `UNIQUE(chain_id, tx_hash, log_index)` + `clause.OnConflict{DoNothing:true}`，重复消费同一区块不会重复入库。**不做 reorg 回滚**（已确认）。

### 4.8 MarketSettlementFinalized → `onchain_tx_orders` 结算行（新增 INSERT）

`MarketSettlementFinalized`（盘口级结算定盘，一个盘口一次）除了照常进 `admin_onchain_action`（§7.1 #3b），**额外单开一个并发分支**把它**新增**成 `onchain_tx_orders` 的一行。

- **只 INSERT，不匹配/不更新已有订单行**（结算 tx ≠ 下注 tx，本就匹配不到下注单）；全部参数塞 `request_json`。
- 收集：在 `collectOddFiLog` 里新增 `collectSettlementOrder`（仅 BettingPool，`ParseMarketSettlementFinalized` 命中即生成一行），追加到 `oddfiBatch.settlementOrders`。
- 落库：新增 `eg.Go: handleMarketSettlements` → `mysql.BatchInsertSettlementOrders`。
- **幂等**：该表无 `UNIQUE(chain_id,tx_hash,log_index)`，靠唯一键 `idempotency_key` + `OnConflict(idempotency_key) DoNothing`。

INSERT 列（其余列不写，留 relay / DB 默认 NULL）：

| 列 | 值 |
|---|---|
| `user_id` | `0`（系统/管理员，无具体用户） |
| `chain` | `bsc`（= `s.GetChainName()`） |
| `op` | `market_settlement_finalized` |
| `idempotency_key` | `market_settlement_finalized:{chainId}:{txHash}:{logIndex}` |
| `tx_hash` | 结算交易 hash（小写） |
| `status` | `confirmed` |
| `request_json` | `{marketId,resultKind,scoreSettled,homeScore,awayScore,grossPayout,lpMarginShare,platformMarginShare,quoteVersion}`（大整数字符串） |
| `settlement_status` | 空串 `""`（本次不映射 resultKind，先留空） |
| `actual_payout_wei` | `grossPayout`（wei 字符串） |
| `settled_at` / `created_at` / `updated_at` | 区块时间（UTC） |

---

## 5. 新增 / 改动文件清单

**新增：**
- `service/evm/contract/stakingPool.json` / `stakingPool.go`（abigen 生成）
- `service/evm/contract/liquidityPool.json` / `liquidityPool.go`（abigen 生成）
- `service/evm/contract/oddToken.json` / `oddToken.go`（abigen 生成）
- `service/evm/handle_admin_action.go`（`handleAdminActions` + 22 事件 → row 映射）
- `service/evm/handle_user_action.go`（`handleUserActions` + 用户事件 → row 映射 + match_id 回填 + BET_CLAIMED 合并）
- `service/evm/handle_market_settlement.go`（`collectSettlementOrder` + `handleMarketSettlements`：MarketSettlementFinalized → onchain_tx_orders 结算行 INSERT）
- `internal/mysql/admin_onchain_action.go`
- `internal/mysql/user_onchain_action.go`
- `internal/mysql/market_match_map.go`
- `internal/mysql/pool_match_map.go`
- `internal/mysql/table.sql` 追加 4 张建表 SQL（admin/user/market_match_map/pool_match_map）

**改动：**
- `global/config.go`：`ChainConfig` 增加 `OddFi OddFiConfig`（chain_id + 4 个地址），新增 `OddFiConfig` 类型
- `service/evm/contract/address.go`：定义 `ContractKind` 枚举（地址值改由配置注入，不再硬编码常量）
- `service/evm/message.go`：`betPlacedInfo` 旁新增 `adminActionRow`/`userActionRow`/映射行结构体
- `service/evm/oddfi_action.go`：`oddfiBatch` 新增 `settlementOrders []*mysql.OnchainTxOrder`；`collectOddFiLog` 末尾调 `collectSettlementOrder`
- `internal/mysql/onchain_tx_order.go`：`OnchainTxOrder` 结构体补齐结算行所需列（user_id/chain/op/idempotency_key/status/request_json/settlement_status/actual_payout_wei/settled_at/created_at/updated_at）；新增 `BatchInsertSettlementOrders`（`OnConflict(idempotency_key) DoNothing`）
- `service/evm/evm.go`：
  - `EVMService` 加 `chainID int64`、`oddfiAddrs map[string]ContractKind` + 3 个 filterer 字段
  - `NewEVMService` 从 `cfg.OddFi` 注入 chainID/地址白名单，初始化 3 个 filterer
  - `HandleMessage` 解析 block 得 blockTime（取不到用 now）；新增 3 个 `eg.Go` 分支（admin / user / **market settlement**）
  - `checkBscReceipts` 改签名（带 blockTime、返回 admin/user/map 结果集；带 receipt.From）
- 配置 YAML 文件：在 bsc 块下补 `oddfi:` 配置段（测试网值）

---

## 6. 风险 / 遗留

1. ~~chain_id 取值方式~~ → 已定：配置 `bsc.oddfi.chain_id=97`。
2. ~~block_time 兜底~~ → 已定：取不到用 `time.Now().UTC()` + warn 日志。
3. ~~主网地址~~ → 本次只跑测试网；地址走配置，上主网改 YAML 即可。
4. 单 message = 单区块假设：现有 `evmResult.BlockNumber` 是单值，故 block_time 整块共用成立；若一个 message 可能含多区块 receipts，需再调整（实施时核对，必要时按 log.BlockNumber 分组取时间）。
5. 性能：每条命中的 user 行会查一次映射表回填 match_id。实现时采用批量查（先收集本批 marketId/poolId 去重后一次 `IN` 查询，再回填），避免逐条查库。

---

## 7. 事件 → 表 完整映射核对表（artifact 已逐项核对存在）

### 7.1 admin_onchain_action（22 个，category / operator 来源）

| # | 事件 | 来源合约 | category | operator 来源 | 备注 |
|---|---|---|---|---|---|
| 1 | MarketOpened | BettingPool | BUSINESS_OPS | tx.from | 同时写 market_match_map |
| 2 | OddsUpdated | BettingPool | BUSINESS_OPS | tx.from | |
| 3a | MarketSettlementScoreBatchProcessed | BettingPool | BUSINESS_OPS | tx.from | 按比分批量结算(SETTLER)，替代旧 MarketSettled。delegatecall 出，log.address=BettingPool |
| 3b | MarketSettlementFinalized | BettingPool | BUSINESS_OPS | tx.from | 结算定盘(SETTLER)，替代旧 MarketSettled；winningOutcome 改为 scoreSettled+homeScore+awayScore。**并额外 INSERT 一条 onchain_tx_orders 结算行（见 §4.8）** |
| ~~4~~ | ~~PushRefunded~~ | — | — | — | 已从合约移除；退款明细由每注 BetRefunded 覆盖(进 user 表) |
| 5 | PlatformReserveUpdated | BettingPool | BUSINESS_OPS | tx.from | **仅 reason==0** |
| 6 | StakingConfigUpdated | StakingPool | CONFIG | operator(idx) | target=treasury |
| 7 | BettingPoolUpdated | StakingPool | CONFIG | operator(idx) | target=bettingPool |
| 8 | MinStakeAmountUpdated | StakingPool | CONFIG | operator(idx) | |
| 9 | VipTierConfigUpdated | StakingPool | CONFIG | operator(idx) | |
| 10 | VipConfigUpdated | StakingPool | CONFIG | operator(idx) | |
| 11 | LiquidityConfigUpdated | LiquidityPool | CONFIG | operator(idx) | target=newBettingPool |
| 12 | MinDepositUpdated | LiquidityPool | CONFIG | operator(idx) | |
| 13 | UnbondEpochsUpdated | LiquidityPool | CONFIG | operator(idx) | |
| 14 | RoleGranted | 4 合约 | ROLE | sender(idx) | role+target=account |
| 15 | RoleRevoked | 4 合约 | ROLE | sender(idx) | role+target=account |
| 16 | RoleAdminChanged | 4 合约 | ROLE | tx.from | role=role(idx) |
| 17 | Paused | 4 合约 | PAUSE | account | |
| 18 | Unpaused | 4 合约 | PAUSE | account | |
| 19 | Upgraded | 4 合约 | UPGRADE | tx.from | target=implementation |
| 20 | Initialized | 4 合约 | INIT | tx.from | |
| 21 | TokenInitialized | ODDToken | INIT | admin(idx) | |
| 22 | StakingInitialized | StakingPool | INIT | admin(idx) | target=oddToken |

### 7.2 user_onchain_action

| 事件 | 来源合约 | action_type | user_address | 关键字段 |
|---|---|---|---|---|
| BetPlaced | BettingPool | BET_PLACED | user | amount=acceptedAmount, amount_secondary=requestedAmount, extra={lockedOdds,quoteVersion,outcome}, market_id |
| BetClaimed+PayoutClaimed | BettingPool | BET_CLAIMED | user | amount=netPayout, gross/tax, counterparty=executor, bet_id, market_id |
| BetRefunded | BettingPool | BET_REFUNDED | user | amount=refundAmount, extra={reason,quoteVersion}, bet_id, market_id |
| ReferrerBound | BettingPool | REFERRER_BOUND | user | counterparty=referrer |
| ReferralRewardAccumulated | BettingPool | REFERRAL_REWARD_ACCRUED | referrer | amount, counterparty=from, extra={kind} |
| ReferralClaimed | BettingPool | REFERRAL_CLAIMED | referrer | amount=oddAmount |
| ReferralClaimedUSDT | BettingPool | REFERRAL_CLAIMED_USDT | referrer | amount=oddAmount, amount_secondary=usdtAmount, extra={currentPriceX18} |
| StakeCreated | StakingPool | STAKE_CREATED | user | amount=principal, position_id, extra={planId,sourceType,weight,unlockAt} |
| StakeWithdrawn | StakingPool | STAKE_WITHDRAWN | user | amount=principal, amount_secondary=reward, extra={early} |
| LiquidityDeposited | LiquidityPool | LIQUIDITY_DEPOSITED | user | amount, position_id, match_id(查 pool_match_map), extra={poolId,weight,planId,unlockAt} |
| UnbondRequested | LiquidityPool | LIQUIDITY_UNBOND_REQUESTED | user | position_id, extra={unbondingEpoch,frozenRewardPerWeight,frozenLossPerPrincipal} |
| LiquidityWithdrawn | LiquidityPool | LIQUIDITY_WITHDRAWN | user | amount=withdrawAmount, amount_secondary=netPnl(int256,可负), extra={finalState} |
| MarketOpened | BettingPool | （映射）market_match_map | — | market_id→match_id |
| MatchPoolOpened | LiquidityPool | （映射）pool_match_map | — | pool_id→match_id |

---

## 8. 确认状态

| 事项 | 状态 |
|---|---|
| chain_id | ✅ 配置 `bsc.oddfi.chain_id=97`（只跑测试网） |
| 合约地址 | ✅ 进配置，填 4 个测试网代理地址 |
| block_time 兜底 | ✅ 取不到用 `time.Now().UTC()` |
| reorg | ✅ 不做，只幂等 |
| market_settlement | ✅ 本次不做 |
| match_id | ✅ 实时查映射表，查不到存 NULL |

> 全部关键点已确认。等你对本文档整体点头，我就：① abigen 生成 3 个绑定 → ② 按本文档实现 → ③ 自测编译。
