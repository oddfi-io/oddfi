# ODDToken 锁仓与发售 MVP 架构补充

**日期：** 2026-06-12
**状态：** 已实现；HouseVault 到 BettingPool L4 注资路径已升级到 BSC Testnet 当前 proxy
**基线：** `docs/product/ODD代币合约需求文档.docx`、当前 `src/modules/token/ODDToken.sol`

## 1. 背景

当前代码中的 `ODDToken` 已从纯 ERC20 底座扩展为来源与转账限制聚合根，承担销售锁仓、奖励锁仓、白名单业务来源快照、`poolLaunchTime`、treasury sink 和初始分配控制。`TierSale / HouseVault / DexLaunchController / EcosystemRewards` 配套合约主干已实现；`DexLpLocker` 用于闭合 Pancake V3 LP NFT 12 个月强制锁定；`BettingPool / StakingPool / LiquidityPool` 已按最小改动原则接入 ODDToken 业务来源入口。

这是一次 Token 边界扩展。扩展后 `ODDToken` 仍不 owner 下注、赔率、LP 瀑布、推荐关系和质押收益规则，但会 owner 用户 ODD 来源账本与可转额度判断。

## 2. 新边界结论

### 2.1 `ODDToken` 新职责

`ODDToken` 在 MVP 中成为 ODD 来源与转账限制聚合根，负责：

- ERC20 余额与授权；
- pause / unpause / UUPS upgrade；
- 初始化时固定总量铸造到 `ODDToken` 自身地址；
- 初始供应一次性分配到 TierSale / HouseVault / DexLaunchController / EcosystemRewards / OpsTreasuryVault 或 Timelock；
- 固定来源地址、业务白名单、treasury sink 管理；
- DEX restricted target 管理，防止 Pancake V3 Router、V3 Pool、NonfungiblePositionManager、旧 V2 Pair / Router 或聚合器地址被误加入普通业务白名单；
- 销售锁仓、奖励锁仓、业务来源快照和当前可转额度计算；
- 普通 `transfer / transferFrom` 的锁仓限制；
- 白名单业务入口的来源消耗、业务出金登记、净盈利可转和亏损确认；
- DEX 建池时间 `poolLaunchTime` 写入与解锁曲线计算；
- 用户自愿 `burn` 时同步消耗来源账本；
- 产品要求的状态变更事件、业务 snapshot view、累计亏损记录和 48 小时 Timelock 部署 gate。

### 2.2 `ODDToken` 仍不负责的事项

`ODDToken` 不重新成为 betting 业务中心，不负责：

- market 创建、赔率更新、下注风控；
- 普通单注、串关、Cash Out、退款、赛果结算；
- LP margin / loss / payout window；
- staking reward 公式；
- 推荐关系绑定和推荐奖励归集；
- 平台税率、派奖税率、瀑布策略；
- PancakeSwap V3 建池参数计算。
- 交易税、黑名单或管理员任意转移用户余额。

这些仍由现有业务合约或新增配套合约负责。Token 只根据业务合约提交的业务 ID、实际入金、实际出金和终态标记维护来源账本。

## 3. 最小改动原则

除 `ODDToken` 外，现有合约遵循最小改动原则：

- 不重写 `BettingPool / StakingPool / LiquidityPool` 的业务状态机；
- 不迁移现有业务 storage；只有现有 ID 不能推导全局业务 ID 时，才允许补充最小必要字段；
- 不改变现有外部 ABI，除非新增 Token 接口调用必须暴露新配置；
- 不改变下注、串关、Cash Out、退款、claim、unstake、withdraw 的产品语义；
- 不把来源账本复制到业务合约 storage；
- 不新增业务合约内的锁仓计算逻辑；
- 业务合约只负责在资金入口/出口调用 Token 扩展接口。

新增配套合约 `TierSale / HouseVault / DexLaunchController / EcosystemRewards / DexLpLocker` 不属于既有合约改造，可以按产品需求新建，但应保持职责单一。

## 4. 跨模块资金方向

### 4.1 用户业务入金

普通 ERC20 路径：

```text
user -> transfer/transferFrom -> whitelist business contract
```

必须失败。该规则用于阻止没有 `businessId` 和来源快照的孤儿入金。

有效业务入口：

```text
user
  -> BettingPool / StakingPool / LiquidityPool 业务方法
      -> ODDToken.consumeBusinessInflow(user,businessType,rawId,amount)
          -> Token 消耗来源账本
          -> Token 使用 allowance 从 user 搬运 ODD 到业务合约
          -> Token 记录 businessId 来源快照
```

`consumeBusinessInflow` 内部应使用 `allowance(user, businessContract)`，保持前端 approve 习惯不变。

### 4.2 用户业务出金

业务合约不再直接 `safeTransfer(user, amount)` 完成用户回款。有效路径：

```text
business contract
  -> ODDToken.registerBusinessOutcomeDelta(user,businessId,businessOutDelta,finalized)
      -> Token 累计 totalBusinessOut
      -> Token 还原本金来源
      -> Token 确认净盈利为可转余额
      -> Token 在 finalized 时确认剩余亏损
      -> Token 从业务合约转账给 user
```

Token 可从 `businessIn`、`totalBusinessOut`、`businessOutDelta` 和 `finalized` 推导 `principalReturnedDelta / profitDelta / lossDelta`，并通过事件暴露这些值。业务合约不需要自行计算来源拆分。

Token storage 需保存累计字段，包括 `principalReturned`、`profitRecognized`、`lossRecognized` 和 `finalizedAt`。每次 outcome delta 不保存无上限数组，历史 delta 通过事件索引；view 暴露当前累计结果，满足产品文档对亏损扣减记录和业务快照查询的要求。

Token 扩展接口必须使用受控转账上下文处理内部资金流，例如初始分配、销售发放、奖励发放、业务入金、业务出金、业务净收益和 HouseVault 治理划转。普通 `transfer / transferFrom` 不得因为合约是白名单就被永久豁免；上下文只能在扩展接口内部的单次 `_transfer` 生效，完成后立即恢复，且上下文打开期间不得执行外部调用。

`BettingPool.claimUSDTReferralRewards` 是特殊路径：用户选择把已确认的 ODD 推荐净收益直接通过 Pancake V3 Router 换成 USDT。该路径应通过 Token 记录一次性 `BusinessProfitSwap` / DEX spend allowance，限定 `from == BettingPool`、`spender == Pancake V3 Router`、`to == expected ODD/USDT V3 Pool` 和金额，不得把 Router 或 Pool 加入普通业务白名单，也不得消费用户锁定本金。

### 4.3 平台资金路径

以下路径不登记为用户业务出金：

- treasury sink / HouseVault -> BettingPool 的平台储备注资；
- 白名单业务合约 -> treasury sink；
- BettingPool -> StakingPool 的派奖税 staking share；
- BettingPool / StakingPool -> platformTreasury / OpsTreasuryVault；
- LiquidityPool -> BettingPool 的 payout liquidity；
- HouseVault -> 白名单合约或 treasury sink 的治理划转。

这些路径只执行标准余额转移或受控 Token 扩展转移，不改变用户来源账本。外部注资到白名单业务合约时，资金来源必须是已登记 `treasurySink`、`HouseVault` 或 timelock 控制地址，普通用户仍不得通过 ERC20 `transfer / transferFrom` 直接转入白名单业务合约。

HouseVault 注入 BettingPool 的 L4 平台准备金必须走专用记账入口，不得只向 `BettingPool` 普通转账。标准路径为：

```text
HouseVault.fundBettingPlatformReserve(bettingPool, amount)
  -> HouseVault approve BettingPool amount
  -> BettingPool.addPlatformReserve(amount)
      -> transferFrom(HouseVault, BettingPool, amount)
      -> platformReserve += amount
      -> accountedBalance += amount
```

`BettingPool.addPlatformReserve` 只接受管理员或 `ODDToken.fixedSources().houseVault` 调用，避免任意白名单合约、普通 treasury sink 或用户把未记账余额打入 BettingPool。`HouseVault.transferOdd(BettingPool, amount)` 仍只是普通划转，不应作为 L4 注资流程使用。

## 5. 业务 ID 规则

Token 统一生成全局唯一业务 ID：

```solidity
businessId = keccak256(abi.encode(businessContract, businessType, rawId));
```

建议业务类型常量：

| businessType | rawId |
| --- | --- |
| `BET_SINGLE` | `betId` |
| `BET_PARLAY` | `parlayId` |
| `STAKING_POSITION` | `positionId` |
| `LP_POSITION` | `positionId` |
| `REFERRAL_REWARD` | `claimNonce` 或 claim hash |
| `SALE_PURCHASE` | sale purchase nonce |
| `ECOSYSTEM_REWARD` | reward claim nonce |

已存在业务 ID 的模块优先复用现有 ID，不新增重复 ID 体系。

## 6. 来源账本模型

用户维度保留三类锁定来源：

- sale source：TierSale 发放；
- reward source：EcosystemRewards claim；
- business locked source：仅作为治理批准的保守锁定或兼容字段，标准业务回款不应新增该来源。

业务入金时，Token 将用户来源从用户账本移到 `BusinessSnapshot`：

```text
user sale/reward/business locked source
  -> business snapshot locked source
```

业务本金返还时，Token 按“已返还本金 / businessIn”的累计比例把 snapshot 中对应来源还原回用户账本。业务最终亏损时，未返还的 snapshot 来源留在业务内作为已消耗来源，不再二次扣减用户账本。

这满足“用户亏损减少锁仓来源”的产品目标，同时避免同一亏损被扣两次。

## 7. 解锁锚点

`poolLaunchTime` 只由 `DEX_LAUNCHER_ROLE` 授权的 `DexLaunchController` 或 timelock 授权地址写入一次。

Token 层只校验：

- 调用者具备权限；
- `launchTime != 0`；
- `launchTime <= block.timestamp`；
- 尚未写入过。

`TierSale` 是否售罄、是否 `forceFinalize`、实际建池 USDT/ODD 是否满足产品经济下限，由 `DexLaunchController.launchPool` 在调用 Token 前校验。

DexLaunchController 建池目标固定为 PancakeSwap V3。它应使用 V3 Factory / NonfungiblePositionManager 创建或复用 ODD/USDT pool，按治理配置的 `poolFee`、初始价格、tick range、deadline 和最小入池数量 mint LP position。PancakeSwap V3 LP NFT / position token 必须进入 `DexLpLocker` 或等价锁仓合约锁定 12 个月，不使用 PancakeSwap V2 Pair / Router，也不把 V3 Router、V3 Pool 或 NonfungiblePositionManager 加入普通业务白名单。

`DexLpLocker` 只负责 LP NFT 锁定，不参与建池参数、做市资金或 ODD 来源账本。DexLaunchController mint LP NFT 时 recipient 必须是 `DexLpLocker`，随后调用 locker 记录 `tokenId / unlockAt / beneficiary`。`unlockAt` 之前任何释放都必须失败；到期后只能由治理/授权角色释放到指定接收地址。

本地实现必须把以下 DEX launch 约束固化到合约和部署 gate，而不是只依赖运营流程：

- `DexLaunchController.launch` 的 `oddAmountDesired / usdtAmountDesired` 必须分别等于 `TierSale.launchApproval()` 返回的已批准 ODD / USDT 数量；Pancake V3 mint 实际消耗可以因价格区间小于 desired，但发起建池不能少用或多用已批准额度。
- `sweepRemainder` 对 ODD 和 USDT 等任意剩余资产都只能扫到 `ODDToken.isTreasurySink(to) == true` 的地址。
- `DexLpLocker.releasePosition` 只能释放到锁定记录中的 `beneficiary`，治理如需改收款方必须先在锁定前确定默认 beneficiary。
- `EcosystemRewards` 所有类别预算合计和累计 claimable 分配都不得超过 15,000,000 ODD。
- `BettingPool / StakingPool` 的 `platformTreasury` 更新入口必须校验目标已在 ODDToken 登记为 treasury sink，避免平台税、无人质押奖励等平台路径落到普通 EOA。

由于 Pancake V3 mint 会由 NonfungiblePositionManager 通过 ERC20 `transferFrom(DexLaunchController,V3Pool,amount)` 拉取 ODD，Token 必须为 DexLaunchController 建池提供一次性 `dexLiquidityTransferableAllocation` 校验：只有 `from == DexLaunchController`、`spender == configured NonfungiblePositionManager`、`to == configured V3 Pool` 且金额不超过剩余额度时才放行并扣减额度。DexLaunchController 向普通 EOA、未登记 DEX target 或非 treasury sink 地址转出 ODD 必须失败，建池后剩余资产退回 treasury sink。

当前代码中的 `BettingPool` 推荐奖励 USDT swap 已使用 Pancake V3 Router `exactInputSingle` 和 `referralSwapPoolFee`；仓库中 Pancake V2 Router 仅用于 fork/test 脚本准备测试 USDT，不属于生产 BettingPool 资金路径。

## 8. 事件与治理约束

所有状态变更必须发事件，至少覆盖固定来源配置、初始分配、白名单变更、treasury sink 变更、销售发放、奖励 claim、业务入金、业务出金、业务净收益、亏损确认、burn 和 DEX launch 时间写入。

治理权限默认由 OpenZeppelin `TimelockController` 持有，最小延迟 48 小时。Safe 仅作为 proposer / canceller；`PAUSER_ROLE` 作为应急权限可由多签直接持有，不走 48 小时时间锁。

## 9. 部署拓扑

本需求默认全量重新部署：

- 新 `ODDToken` proxy；
- 新 `TierSale / HouseVault / DexLaunchController / EcosystemRewards / DexLpLocker`；
- 新 `TimelockController` 或极薄 `OpsTreasuryVault`，运营金库对外划转必须受 48 小时时间锁约束；
- 新或重新部署指向新 ODD 的 `BettingPool / StakingPool / LiquidityPool`；
- 新部署脚本和测试 helper。

所有 proxy 必须通过构造器 `initData` 完成最小初始化，不得留下可被第三方抢先 `initialize` 的窗口。部署 gate 必须断言所有新业务合约、配套合约和脚本引用的新 `ODDToken` 地址一致，且没有残留旧 ODD 地址。

若坚持 2026-06-08 BSC Testnet 旧 proxy 原址升级，将产生额外迁移问题：已部署旧 ODDToken 总量已经 mint 到 admin，且没有历史来源账本，不能直接满足“初始供应先在 ODDToken 自身再分配”的产品口径。因此旧 proxy 迁移不作为 MVP 默认路径；当前本地新实现已改为总量 mint 到 `address(this)`。

销售取消退款的链上可执行前提：由于产品同时禁止管理员任意转移用户余额，TierSale 取消后只能在用户交回对应销售 ODD 时退还该笔 USDT。若用户已将销售 ODD 用于下注、质押、LP 或 burn 且余额/销售来源不足，合约不得无条件退款或强制 clawback；如产品要求所有买家无条件全额退款，则部署 gate 必须在 launch/cancel 决策前保持 bet / stake / LP 入口关闭。

## 10. 需要同步的架构文档

开发中必须持续同步：

- `docs/architecture/oddfi-mvp-总体架构.md`
- `docs/architecture/solidity-ddd-mapping.md`
- `docs/development/api.md`
- `docs/progress/当前开发现状.md`
- 各模块当前实现文档

本文件作为 2026-06-12 ODDToken 锁仓与发售 MVP 架构补充，直到主架构文档完全合并该需求前保持有效。
