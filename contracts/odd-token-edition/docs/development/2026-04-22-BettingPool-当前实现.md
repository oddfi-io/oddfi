# BettingPool 当前实现

**状态：** AH 扩盘口当前实现 + BettingPool 模块化入口壳第一阶段 + ODDToken 业务来源接口最小接入
**日期：** 2026-06-12
**基线：** `docs/research/2026-05-24-AH扩盘口最小改造调研.md` 与 `docs/development/2026-05-24-AH扩盘口比分结算实施方案.md`

说明：本文已同步为 AH 扩盘口当前实现口径，`src/modules/betting/BettingPool.sol` 已删除旧结算 ABI，并改为比分分批结算入口。2026-06-08 起 `BettingPool` 第一阶段入口壳改造已在本地实现：普通单注 `placeBet` 重逻辑迁入 `BettingBetModule`，由 `BettingPool` wrapper 通过 `delegatecall` 执行；4 个查询接口已暴露回 `BettingPool` ABI。

2026-06-12 补充：在 ODDToken 锁仓与发售 MVP 中，`BettingPool` 及其 module 已按最小改动接入 Token 业务来源接口：

- 普通单注入金改为 `consumeBusinessInflow(user, BET_SINGLE, betId, stake + betTax)`，并在扣款前提前确定 `betId`；
- 普通单注 claim、refund、cashOut、score settlement refund 和 full loss 改为 `registerBusinessOutcomeDelta`；
- 串关注单入金改为 `consumeBusinessInflow(user, BET_PARLAY, parlayId, stake + betTax)`，claim 和 full loss 改为 `registerBusinessOutcomeDelta`；
- 推荐 ODD claim 改为 `registerBusinessProfitAndTransfer`，推荐 USDT claim 改为 `registerBusinessProfitForDexSwap` 后再走 Pancake V3 swap；
- 新增 `referralSwapExpectedPool`，用于限制推荐 USDT swap 中 Router 只能把 ODD 拉到预期 V3 pool；
- Betting 下注、赔率、WCL、Cash Out、结算、瀑布、推荐关系和税率状态机未重写。

## 1. 模块定位

`BettingPool` 是当前代码里的主业务聚合根。

所有与以下主题直接相关的主状态，当前都由它 owner：

- 市场与赔率；
- 注单与用户风险账本；
- 推荐关系与推荐奖励主账；
- 下注税 / 派奖税；
- taxBuffer / lpLossOffsetRemaining / platformReserve；
- 结算入口与主账 owner。

### 为什么这样设计

因为现在业务主链路就是：

`开盘 -> 报价 -> 下单 -> 结算 -> 领奖 -> 税 -> 瀑布`

这些步骤之间的资金和状态强耦合，如果分散到多个模块，账本会更难闭合。

当前实现补充：

- `BettingPool` 仍保留对外结算入口；
- 但结算 / 退款 / 瀑布重逻辑已迁至 `BettingSettlementModule`；
- 普通下注 `placeBet` 成交、风控、下注税、推荐税和 exposure/odds 刷新重逻辑已迁至 `BettingBetModule`；
- 串关下注、结算和 claim 重逻辑已迁至 `BettingParlayModule`；
- 执行方式为 `delegatecall`，状态仍写入 `BettingPool` 自身 storage。

---

## 2. 当前核心状态

### 2.1 市场与赔率

| 状态 | 作用 | 为什么存在 |
|---|---|---|
| `markets` | 市场配置 | 保存 market 的 match、盘口、状态、时间边界 |
| `marketOdds` | 基础赔率 / 报价赔率 / 版本 | 下单和前端展示都要用 |
| `marketExposure` | 各方向 stakes / payouts / signal | 用于 V2 WCL、赔率压缩和信号灯 |
| `matchMarketIds` | 一场比赛包含哪些 market | 判断比赛是否终态 |
| `marketBetIds` | 某个 market 下有哪些 bet | 结算时遍历 bet 用 |

补充：

- `MarketConfig.marketId` 已删除，market 的 key 就是 `mapping(bytes32 => MarketConfig)` 的索引本身；
- `Bet.betId` 已删除，bet 的 key 就是 `mapping(bytes32 => Bet)` 的索引本身；
- `Bet.requestedAmount` 已删除，当前产品主线只依赖 `acceptedAmount / lockedOdds / claimablePayout`，不再额外存一份请求金额。
- `MarketExposure.totalPotentialPayoutByOutcome / worstCaseLoss` 已删除，当前链上逻辑使用 `totalStakedByOutcome + payoutByOutcome + signalColor`；`payoutByOutcome` 为 V2 `P_i` 累计应付赔付额；
- `taxAllocPlatformBps` 不再单独存储，平台份额在需要时由其余三项和总税率推导。

### 2.2 注单与用户风险

| 状态 | 作用 |
|---|---|
| `bets` | 注单主账 |
| `userRiskLedger` | 用户当日下注额和未结算本金 |
| `userMarketExposure` | 用户单市场潜在赔付暴露 |

### 2.3 推荐与奖励

| 状态 | 作用 |
|---|---|
| `referrers` | 推荐关系 |
| `referrerRewardsOdd` | 推荐奖励 ODD 主账 |
| `referralClaimSigner` | USDT 领取的后端签名人 |
| `referralSwapPoolFee` | Pancake V3 fee |
| `referralSwapRouter` | USDT 推荐奖励兑换使用的治理配置 Router |
| `referralUsdtToken` | USDT 推荐奖励兑换目标 token |
| `referralSwapExpectedPool` | 推荐 USDT claim 时 Token 一次性 DEX 放行的预期 V3 pool |
| `referralClaimNonces` | 防签名重放 |

### 2.4 账务与瀑布

| 状态 | 作用 |
|---|---|
| `platformReserve` | 平台准备金 |
| `accountedBalance` | BettingPool 账面 ODD |
| `taxBuffer` | L3 缓冲 |
| `lpLossOffsetRemaining` | L2 已扣减亏损中尚未被后续派奖税缓冲份额冲抵的指标余额；不是 LP 应收债务 |
| `lpMarginShareBps` | Margin 分给 LP 的比例 |
| `wclYellowThreshold / wclOrangeThreshold / wclRedThreshold` | WCL 信号灯阈值 |
| `settlementModule` | 结算卫星模块实现地址 |
| `betModule` | 普通下注卫星模块实现地址 |
| `marketSettlementProgress` | 分批结算累计进度；用于 `settleMarketBetsByScore + finalizeMarketSettlement` |
| `marketPreClosedBetCount` | Cash Out 提前终态注单计数；用于最终结算兼容 |

---

## 3. 接口逐项说明

## 3.0 constructor

当前 implementation 构造器会调用 `_disableInitializers()`。

这只锁住 implementation 合约本体，防止直接初始化 implementation；proxy 初始化和后续通过 proxy 执行的 UUPS `upgradeToAndCall` / `reinitializer` 不受影响。

## 3.1 `initialize(address admin, address oddTokenAddress, address stakingPoolAddress, address liquidityPoolAddress)`

### 参数含义

| 参数 | 类型 | 含义 |
|---|---|---|
| `admin` | `address` | 初始治理地址 |
| `oddTokenAddress` | `address` | ODDToken 地址 |
| `stakingPoolAddress` | `address` | StakingPool 地址 |
| `liquidityPoolAddress` | `address` | LiquidityPool 地址 |

### 参数来自哪里

- 部署脚本。

### 代码里怎么实现

1. 校验 4 个地址都非零；
2. 初始化 `AccessControlUpgradeable` + `PausableUpgradeable`；
3. 赋予 `DEFAULT_ADMIN_ROLE / UPGRADER_ROLE / PAUSER_ROLE / OPERATOR_ROLE / SETTLER_ROLE / KEEPER_ROLE`；
4. 写入 `oddToken / stakingPool / liquidityPool`；
5. 初始化默认业务参数：
   - `platformTreasury = admin`
   - `betTaxBps = 1%`
   - `payoutTaxBps = 5%`
   - 默认四项分配比例 `2/1/1/1`
   - `lpMarginShareBps = 8000`
   - 固定常量口径：`BettingConstants.TAX_BUFFER_CAP = 500,000 ODD`
   - 固定常量口径：`BettingConstants.RESERVE_STEP_ALERT_SIZE = 100,000 ODD`
   - 默认 WCL 三阈值 `80k / 180k / 280k`
   - `referralSwapPoolFee = 2500`
   - `nextBetNonce = 1`
   - `_reentrancyStatus = 1`
6. 初始化完成后不额外重放参数配置事件。

补充：

- `BettingConstants.TAX_BUFFER_CAP` 和 `BettingConstants.RESERVE_STEP_ALERT_SIZE` 当前不是 `BettingPool` storage 字段；
- 代码直接读取 `BettingConstants.TAX_BUFFER_CAP` / `BettingConstants.RESERVE_STEP_ALERT_SIZE`。

### 为什么要这么实现

- `BettingPool` 是主业务中心，初始化时必须一次性把默认业务参数锁定；
- 如果这些值不在初始化时写好，结算、领奖、瀑布会直接跑不通。

---

## 3.2 `initializeV2(address treasuryAddress)`

### 参数含义

| 参数 | 类型 | 含义 |
|---|---|---|
| `treasuryAddress` | `address` | 平台金库地址 |

### 参数来自哪里

- 升级脚本；
- 或治理补配置。

### 代码里怎么实现

1. 校验非零地址；
2. 覆盖 `platformTreasury`；

### 为什么要这么实现

- 这是升级补初始化入口；
- 老代理升级后，新字段必须能被补齐，否则会留下半初始化状态。

---

## 3.3 `setBettingDependencies(address stakingPoolAddress, address liquidityPoolAddress, address oddTokenAddress)`

### 参数含义

| 参数 | 类型 | 含义 |
|---|---|---|
| `stakingPoolAddress` | `address` | StakingPool 地址 |
| `liquidityPoolAddress` | `address` | LiquidityPool 地址 |
| `oddTokenAddress` | `address` | ODDToken 地址 |

### 参数来自哪里

- 升级脚本；
- bootstrap / migration 补齐依赖操作。

### 代码里怎么实现

1. 校验三个地址非零；
2. 校验 `oddToken / stakingPool / liquidityPool` 当前均未设置；
3. 同时写入三项依赖地址；
4. 已设置过任一依赖时 revert `DependenciesAlreadyConfigured()`，避免运行期热替换跨合约账本锚点。

### 为什么要这么实现

- 三个依赖是强耦合的一组跨合约账本地址；
- 正常 UUPS 升级只替换 implementation，不应通过本函数改依赖地址；
- 该入口只保留给依赖为空的 bootstrap / migration 场景一次性补齐，避免主网运行期误切 ODDToken / StakingPool / LiquidityPool。

---

## 3.3A `setSettlementModule(address newModule)`

### 参数含义

| 参数 | 类型 | 含义 |
|---|---|---|
| `newModule` | `address` | 新的结算模块实现地址 |

### 参数来自哪里

- 升级脚本；
- 治理更新模块实现。

### 代码里怎么实现

1. 校验地址非零且 `code.length > 0`；
2. 更新 `settlementModule`；
3. 不额外发配置事件。

### 为什么要这么实现

- `BettingSettlementModule` 承载的是重结算逻辑；
- 主合约通过切换模块实现地址，就能在不迁移状态的前提下升级结算逻辑。

---

## 3.4 `setTaxConfig(...)`

### 参数含义

| 参数 | 含义 |
|---|---|
| `newBetTaxBps` | 下注税率 |
| `newPayoutTaxBps` | 派奖税率 |
| `newAllocStakingBps` | 派奖税中分给 Staking 的份额 |
| `newAllocTaxBufferBps` | 派奖税中分给 taxBuffer 的份额 |
| `newAllocPlatformBps` | 派奖税中分给平台的份额 |
| `newAllocReferrerBps` | 派奖税中分给推荐奖励主账的份额 |

### 参数来自哪里

- 治理参数调整。

### 代码里怎么实现

1. 校验下注税与派奖税不超上限；
2. 校验四项分配份额之和必须等于 `newPayoutTaxBps`；
3. 更新下注税、派奖税和三项已存储的分配比例；
4. 平台份额不单独存储，运行时通过 `newPayoutTaxBps - staking - taxBuffer - referrer` 推导；
5. 直接完成参数写入，不额外发配置事件。

### 为什么要这么实现

- 产品要求税率和四项分配比例可调；
- 四项比例必须闭合，否则账务分配会失衡。

---

## 3.6 `setRiskConfig(uint256 yellowThreshold, uint256 orangeThreshold, uint256 redThreshold)`

### 参数含义

| 参数 | 含义 |
|---|---|
| `yellowThreshold` | 黄灯 WCL 阈值 |
| `orangeThreshold` | 橙灯 WCL 阈值 |
| `redThreshold` | 红灯 WCL 阈值 |

### 参数来自哪里

- 治理参数调整。

### 代码里怎么实现

1. 校验 `yellow < orange < red`；
2. 更新三档阈值；
3. 直接完成参数写入，不额外发配置事件。

### 为什么要这么实现

- 产品角色表要求平台可调信号灯阈值；
- `previewSignal / _compressionBps / _signalFor / 红灯容量` 全部依赖这组阈值。

---

## 3.7 `setMarginSplit(uint16 newLpMarginShareBps)`

### 参数含义

| 参数 | 含义 |
|---|---|
| `newLpMarginShareBps` | Margin 中分给 LP 的比例 |

### 参数来自哪里

- 治理配置。

### 代码里怎么实现

1. 校验 `newLpMarginShareBps <= 10000`；
2. 更新 `lpMarginShareBps`；
3. 平台份额自动按 `10000 - lpMarginShareBps` 反推；
4. 直接完成参数写入，不额外发配置事件。

### 为什么要这么实现

- 产品要求 LP 分成比例可调；
- 只存 LP 一侧比例可以避免两个值不闭合。

---

## 3.8 `setPlatformTreasury(address treasuryAddress)`

### 参数来源

- 治理更新平台金库地址。

### 代码里怎么实现

1. 校验非零地址；
2. 更新 `platformTreasury`；
3. 直接完成地址写入，不额外发配置事件。

### 为什么要这么实现

- 平台税、无推荐人税、无人承接资金都可能流入 treasury；
- 零地址必须禁止。

---

## 3.9 `setReferralClaimConfig(address signer, uint24 poolFee)`

### 参数含义

| 参数 | 含义 |
|---|---|
| `signer` | 后端签名地址 |
| `poolFee` | Pancake V3 fee |

### 参数来自哪里

- 后端签名服务配置；
- 治理参数。

### 代码里怎么实现

1. 校验 `signer != 0`；
2. 校验 `poolFee != 0`；
3. 更新 `referralClaimSigner` 和 `referralSwapPoolFee`；
4. 直接完成参数写入，不额外发配置事件。

### 为什么要这么实现

- USDT 推荐奖励领取需要后端签名授权；
- Router swap 必须明确使用哪个 fee tier。

---

## 3.10 `setReferralSwapConfig(address swapRouter, address usdtToken)`

### 参数含义

| 参数 | 含义 |
|---|---|
| `swapRouter` | USDT 推荐奖励兑换使用的 Pancake V3 Router |
| `usdtToken` | USDT token 地址 |

### 代码里怎么实现

1. 校验 `swapRouter != 0` 且 `usdtToken != 0`；
2. 更新 `referralSwapRouter` 和 `referralUsdtToken`；
3. USDT Claim 时不再从用户入参读取 router/token，只使用治理配置值。

### 为什么要这么实现

- 防止推荐人拿到合法后端签名后替换 router 或 USDT token；
- 让签名授权语义与链上实际兑换路径一致；
- 保留 `setReferralClaimConfig(address,uint24)`，减少现有签名服务与部署脚本改动。

---

## 3.11 `bindReferrer(address referrer)`

### 参数含义

| 参数 | 含义 |
|---|---|
| `referrer` | 用户要绑定的推荐人地址 |

### 参数来自哪里

- 邀请链接；
- 用户前端输入。

### 代码里怎么实现

1. 校验用户尚未绑定推荐人；
2. 禁止自我推荐；
3. 禁止零地址；
4. 写入 `referrers[user]`；
5. 发 `ReferrerBound`。

### 为什么要这么实现

- 推荐关系一旦上链，就会影响后续下注税和派奖税的归属；
- 因此必须保持“单次绑定、不可覆盖”。

---

## 3.12 `addPlatformReserve(uint256 amount)`

### 参数含义

| 参数 | 含义 |
|---|---|
| `amount` | 本次补入平台准备金的 ODD 数量 |

### 参数来自哪里

- 治理补仓操作。

### 代码里怎么实现

1. 校验 `amount > 0`；
2. 只允许 `DEFAULT_ADMIN_ROLE`；
3. `safeTransferFrom` 把 ODD 打入 BettingPool；
4. 同时增加：
   - `platformReserve`
   - `accountedBalance`
5. 发资金账本事件。

### 为什么要这么实现

- 准备金必须是真实到账的 ODD；
- 不能只改账本不改余额。

---

## 3.13 `openMarket(...)`

### 参数含义

| 参数 | 含义 |
|---|---|
| `matchId` | 比赛 ID |
| `marketType` | 市场类型 |
| `line` | 盘口线 |
| `matchStartTime` | 开赛时间 |
| `matchEndTime` | 比赛结束边界 |
| `baseOdds` | 初始基础赔率数组 |
| `updatedAt` | 赔率版本生成时间 |

### 参数来自哪里

- 后端市场服务、赔率服务、运营输入。

### 代码里怎么实现

1. 根据 `marketType + line + oddsLength` 校验模板；
2. 校验赔率数组合法；
3. 生成 `marketId = keccak256(matchId, marketType, line)`；
4. 写 `MarketConfig`；
5. 初始化 `MarketOdds` 和 `MarketExposure`；
6. 如果该比赛首次开 market，则调用 `LiquidityPool.openMatchPool`；
7. 写 `matchMarketIds`；
8. 发 `MarketOpened`。

### 为什么要这么实现

- `marketId` 用确定性哈希，链下链上一致；
- AH 盘口扩展后，`marketType=1` 的合法 line 为 `0..9`；旧 `0..2` 编码保持不变，新增 line 只追加，不改变旧 marketId 语义。
- 同场多个 market 共用一个 Match Pool，结算边界更自然。
- `lockAt` 默认写为 `matchEndTime`，不再触发开赛前 5 分钟自动锁盘；若后端手动封锁，`lockAt` 会更新为实际封锁时间。

---

## 3.13A `lockMarket(bytes32 marketId)`

### 参数来源

- 后端/运营风控。

### 代码里怎么实现

1. 由 `BettingPool` wrapper 暴露，权限为 `OPERATOR_ROLE`，并带 `nonReentrant`；
2. 通过 `settlementModule` delegatecall 执行重逻辑；
3. 校验 market 存在且当前为 `Open`；
4. 校验当前时间未超过 `matchEndTime`；
5. 将 market 状态改为 `Locked`；
6. 将 `lockAt` 更新为本次封锁区块时间；
7. 调用 `LiquidityPool.closeMatchPoolDeposit(matchId)`；
8. `quoteVersion += 1`，使旧 quote guard 失效；
9. 发 `MarketManuallyLocked`。

### 为什么要这么实现

- 取消开赛前 5 分钟自动锁盘后，后端仍需要主动风控入口；
- 单 market 封锁避免按 `matchId` 链上无界遍历；
- 重逻辑放在 `BettingSettlementModule` 可继续控制 `BettingPool` runtime size。

---

## 3.14 `updateOdds(bytes32 marketId, uint256[] baseOdds, uint64 updatedAt)`

### 参数来源

- 后端赔率服务。

### 代码里怎么实现

1. 校验 market 存在；
2. 手动锁盘后、终态市场和比赛结束后禁止更新；
4. 校验赔率数组长度和步长；
5. 写新的 `baseOdds` 和 `updatedAt`；
6. `quoteVersion += 1`；
7. 重算 `quotedOdds`；
8. 发 `OddsUpdated`。

### 为什么要这么实现

- 锁单后赔率必须冻结；
- `quoteVersion` 是 `QuoteGuardInput` 的核心一致性标记。
- 未手动封锁时，赔率可持续更新到 `matchEndTime` 前。

---

## 3.15 `previewSignal(bytes32 marketId, uint8 outcome, uint256 requestedAmount)`

### 参数含义

| 参数 | 含义 |
|---|---|
| `marketId` | 市场 ID |
| `outcome` | 用户下注方向 |
| `requestedAmount` | 用户想下的 ODD 金额 |

### 参数来自哪里

- 前端下单预览；
- 后端风控预算。

### 代码里怎么实现

1. 校验市场存在且未终态；
2. 校验未到 `matchEndTime`；
3. 校验 market 未被手动封锁；
4. 调 `_previewBet(...)` 返回：
   - `signal`
   - `acceptedAmount`
   - `lockedOdds`
   - `partialFill`
   - `maxAcceptableAmount`

### 为什么要这么实现

- 前端展示的预算和链上真正能接受的成交量必须尽量共用同一套逻辑；
- 当前红灯容量计算已改成基于 `BaseOdds`，与产品口径一致。

---

## 3.16 `placeBet(...)`

### 参数含义

`QuoteGuardInput` 各字段含义：

| 字段 | 含义 | 来源 |
|---|---|---|
| `quoteVersion` | 用户看到的赔率版本号 | `getMarketOdds / previewSignal` |
| `quotedAt` | 用户看到的赔率更新时间 | 同上 |
| `minOdds` | 用户最低可接受赔率 | 前端确认 |
| `minAcceptedAmount` | 用户最低可接受成交量 | 前端确认 |
| `deadline` | 报价保护截止时间 | 前端生成 |

`referrer`：可选推荐人地址，来自邀请链接或用户输入。

### 代码里怎么实现

1. 校验市场状态、手动锁盘、终态、比赛结束时间、最小下注额；
2. 校验 `QuoteGuardInput`；
3. 如提供 `referrer` 且用户尚未绑定，则自动绑定；
4. 读取：
   - `getActiveStakeAmount`
   - `getUserDailyLimit`
5. 调 `_previewBet` 算出：
   - `acceptedAmount`
   - `lockedOdds`
6. 校验：
   - 每日限额
   - 未平仓上限
   - 单场赔付上限
   - 池子可承载能力
   - `minAcceptedAmount`
   - `minOdds`
7. 计算 `betTax`；
8. 转入 `acceptedAmount + betTax`；
9. 写 bet 和各类风险账本；
10. 刷新报价和 signal；
11. 分流 betTax：
   - 有推荐人 -> `referrerRewardsOdd`
   - 无推荐人 -> 平台金库；
12. 发事件。

### 为什么要这么实现

- 风控必须在真实转账前完成；
- `betTax` 按实际成交量算，而不是按用户请求量算，避免部分成交时多扣税。

---

## 3.16A `cashOut(bytes32 betId, uint256 expectedQuoteVersion, uint64 quotedAt, uint256 minAmountOut, uint256 deadline)`

### 参数来源

- 用户在前端确认 Cash Out quote；
- 前端从 `getBet / getMarket / getMarketOdds` 读取当前 bet、market 与赔率版本。

### 代码里怎么实现

1. 主合约 wrapper 带 `nonReentrant + whenNotPaused`；
2. 通过 `settlementModule` delegatecall 执行重逻辑；
3. 模块校验：
   - `msg.sender` 是 bet owner；
   - bet 状态为 `Pending`；
   - market 存在且为 `Open`；
   - 手动 `lockMarket` 后的 `Locked` market 不允许 Cash Out；
   - 当前时间早于 `matchEndTime`；
   - `expectedQuoteVersion` 等于当前 `quoteVersion`；
   - `quotedAt` 不晚于当前区块，且 5 秒内有效；
   - 当前时间不超过 `deadline`；
   - `cashOutAmount >= 10 ODD` 且不低于 `minAmountOut`。
4. 按当前 `quotedOdds` 计算：
   - `remainingStake = acceptedAmount - refundedAmount`
   - `releasedPayout = remainingStake * lockedOdds / 1e4`
   - `theoreticalValue = releasedPayout * 1e4 / currentOdds`
   - 距开赛超过 30 分钟收 10%，否则收 20%
   - `cashOutAmount = theoreticalValue * (10000 - feeBps) / 10000`
5. 成功后：
   - bet 改为 `CashedOut`；
   - `marketPreClosedBetCount[marketId] += 1`；
   - 释放该 bet 对应的 `S_i/P_i`、用户 `unsettledStake` 和用户 market 潜在赔付；
   - 不回滚 `dailyAcceptedAmount`；
   - 不把 `refundedAmount` 改成 `acceptedAmount`；
   - 刷新 odds/signal 并 `quoteVersion += 1`。
6. 资金出账：
   - 返还额低于本金时，差额进入 `platformReserve` 并发 `PlatformReserveUpdated(reason=5)`；
   - 返还额高于本金时，超出部分走 L2 -> L3 -> L4 瀑布，L2 booked loss 会拉取 payout liquidity；
   - 最后转 `cashOutAmount` 给用户。

### 为什么要这么实现

- Cash Out 是用户主动提前关闭，不是退款，因此用独立终态 `CashedOut`；
- 手动封锁 market 后风险由后端接管，用户只能等待最终结算或退款；
- 不回滚每日限额，避免用户通过下注和撤出循环绕过 VIP 限额；
- 通过 `marketPreClosedBetCount` 让全部注单都已 Cash Out 的 market 仍可记录比分并 finalize。

---

## 3.17 `settleMarketBetsByScore(bytes32 marketId, uint16 homeScore, uint16 awayScore, bytes32[] betIds)`

### 参数含义

| 参数 | 含义 |
|---|---|
| `marketId` | 目标市场 |
| `homeScore` | 主队最终比分 |
| `awayScore` | 客队最终比分 |
| `betIds` | 本批要处理的 Pending bet 列表；若该 market 全部注单均已 Cash Out，可传空数组记录比分 |

### 参数来自哪里

- 后端赛果服务提交最终比分；
- 后端按 `getMarketBetIds(marketId, offset, limit)` 分页读取 betIds 后分批传入。

### 代码里怎么实现

1. 主合约 wrapper 先做 `onlyRole(SETTLER_ROLE)` 和 `nonReentrant`；
2. 然后通过 `_delegateToSettlement(...)` 把 calldata 路由给 `BettingSettlementModule`；
3. 模块在 `BettingPool` 的 storage 上执行：
   - 同步锁单状态；
   - 校验 market 存在、未终态、已过 `matchEndTime`；
   - 校验 `homeScore / awayScore <= MAX_SETTLEMENT_SCORE`；
   - 通常要求 `betIds.length > 0`；仅当全部历史注单都已 Cash Out 时允许空数组；
   - 首批锁定 `homeScore / awayScore`，后续批次比分必须一致；
   - 根据 `marketType + line + homeScore + awayScore` 推导 1X2 / AH / OU 的结算结果；
   - 将每笔 Pending bet 拆成 `refundStake / winStake / lossStake`；
   - 按批累计 `processedCount / totalStake / grossPayout / loserStakes` 到 `marketSettlementProgress`；
   - `totalStake` 只累计未退回的 `winStake + lossStake`，后续 finalize 使用它计算 margin 与池内可自付赔付，不把 full push / half refund 已退本金重新计入净缺口基准。
   - 发 `MarketSettlementScoreBatchProcessed`。

### 为什么要这么实现

- `BettingPool` 保留对外主入口和权限模型；
- 重逻辑迁入模块后，主合约 runtime size 能显著下降，但数据仍保存在 `BettingPool` proxy storage 中。
- 所有正常赛果统一走 `settleMarketBetsByScore(...) + finalizeMarketSettlement(marketId,0)`，避免后端维护 1X2 / AH / OU 多套 winningOutcome 推导逻辑。
- AH full push、half win、half loss 都由合约在比分结算中完成，不再走独立 Push 退款入口。
- `CashedOut` bet 已经终态关闭，不能再传入比分结算批次。

## 3.17.1 单笔比分结算资金拆分

### 代码里怎么实现

每笔 Pending bet 先计算：

```text
currentStake = acceptedAmount - refundedAmount
releasedPotentialPayout = currentStake * lockedOdds / ODDS_RATE_SCALE
```

拆分：

| 结果 | refundStake | winStake | lossStake |
|---|---:|---:|---:|
| full win | 0 | currentStake | 0 |
| full loss | 0 | 0 | currentStake |
| full push | currentStake | 0 | 0 |
| half win | halfStake + remainder | halfStake | 0 |
| half loss | halfStake + remainder | 0 | halfStake |

`halfStake = currentStake / 2`，余数进入 `refundStake`，避免多计 win/loss、margin 或派奖税。

### 为什么要这么实现

- `SettlementContext.totalStake` 只累计 `winStake + lossStake`，不把 push/refund 本金计入 margin。
- full push 不产生 `claimablePayout`、派奖税、margin 或瀑布。
- score settlement 中的退款本金只做转账和 `refundedAmount` 记录，不复用会二次扣减风险账本的退款 rollback helper。

## 3.17.2 `finalizeMarketSettlement(bytes32 marketId, uint8 resultKindRaw)`

### 代码里怎么实现

1. 校验 market 存在、未终态、已过 `matchEndTime`；
2. 校验 `resultKindRaw` 为 `0 / 1 / 2`；
3. `resultKindRaw=0` 且 market 有 bet 时，校验 `processedCount + marketPreClosedBetCount[marketId] == marketBetIds[marketId].length`；
4. `resultKindRaw=0` 且 market 无 bet 时，允许直接进入 `Settled`；
5. `resultKindRaw=0` 时使用累计值计算 LP margin、平台 margin、net loss；其中 `totalMargin = totalStake * 1000 / 1e4`，`netLoss = max(grossPayout - (totalStake - totalMargin), 0)`，`loserStakes` 不再作为净缺口扣减基准；
6. `resultKindRaw=0` 时分配 LP margin、记账平台 margin、执行瀑布；
7. `resultKindRaw=1/2` 时只标记 market 为 `Refunded / Cancelled`，不遍历 bet、不计算 margin、不执行瀑布；
8. 已开始 score-based 分批结算后，`resultKindRaw=1/2` 必须 revert；
9. 发 `MarketSettlementFinalized`，正常分批结算收口后必须执行 `delete marketSettlementProgress[marketId]`。

### 为什么要这么实现

- finalize 不再遍历全部 bet，只做 O(1) 级别的 market 结算收口。
- `Refunded / Cancelled` 终态标记收敛到同一入口，后续真实退款仍由 `refundBets` 分批完成。
- 若全部注单均已 Cash Out，后端仍应先用空 `betIds` 调一次 `settleMarketBetsByScore` 记录比分，再 finalize。

---

## 3.18 `refundBets(bytes32 marketId, bytes32[] betIds, uint256[] refundAmounts)`

### 参数来源

- 后端在市场 `Refunded / Cancelled` 状态下整理退款列表。

### 代码里怎么实现

1. 主合约 wrapper 先做 `onlyRole(SETTLER_ROLE)` 和 `nonReentrant`；
2. 通过 `_delegateToSettlement(...)` 路由给 `BettingSettlementModule`；
3. 模块中完成：
   - 长度校验与 batch 上限校验；
   - 市场状态校验；
   - 逐笔退款、回滚风险账本、扣减 `accountedBalance`；
   - 重算 odds / exposure；
   - 发退款事件。

### 为什么要这么实现

- 退款必须同时回滚风险账本和资金账本；
- 否则市场暴露和真实余额会错位。
- 已 Cash Out 的 bet 是终态关闭，不再参与 `refundBets`。

---

## 3.19 `claimPayout(bytes32 betId)`

### 参数来源

- 用户自己持有的 `WonUnclaimed` bet。

### 代码里怎么实现

1. 主合约 wrapper 带 `nonReentrant + whenNotPaused`；
2. 通过 `settlementModule` delegatecall 执行重逻辑；
3. 模块校验 owner；
4. 模块校验 bet 状态必须是 `WonUnclaimed`；
5. 模块校验 market 状态必须是 `Settled`，避免分批结算中间态提前领奖；
6. 计算：
   - `grossPayout`
   - `taxAmount`
   - `netPayout`
   - `requiredBalance = grossPayout`
7. 把 bet 改成 `WonClaimed`；
8. 如果 BettingPool 当前余额不够：
   - 按 `grossPayout - currentBalance` 计算缺口；
   - 调 `LiquidityPool.requestPayoutLiquidity`；
9. 调 `_distributePayoutTax` 分发派奖税；
10. 扣 `accountedBalance`；
11. 转 ODD 给用户；
12. 发领奖事件和 snapshot。

### 为什么要这么实现

- 赔付流动性在 claim 时拉取，避免结算时大额资金前置搬运；
- 拉取缺口时按 gross payout 计算，避免内部派奖税份额仍留在 BettingPool 账上时低估实际赔付资金需求；
- 税在 claim 时分发，能和用户实际到账一起闭合。
- 重逻辑迁入模块后，`BettingPool` runtime size 从 Cash Out 后的 `24,265 B` 降到 `22,495 B`。

---

## 3.21 `claimReferralRewards(uint256 oddAmount)`

### 参数含义

| 参数 | 含义 |
|---|---|
| `oddAmount` | 本次要领取的 ODD 推荐奖励数量 |

### 参数来自哪里

- 用户先读取 `referrerRewardsOdd[msg.sender]` 再决定领多少。

### 代码里怎么实现

1. 读取 `availableAmount`；
2. 校验：
   - `availableAmount > 0`
   - `oddAmount > 0`
   - `oddAmount <= availableAmount`
3. 扣减 `referrerRewardsOdd`；
4. 扣减 `accountedBalance`；
5. 直接转 ODD 给用户；
6. 发 `ReferralClaimed`。

### 为什么要这么实现

- 这条路径最简单、最稳；
- 支持部分领取，减少“必须一次全领”的 UX 限制。

---

## 3.22 `claimUSDTReferralRewards(...)`

### 参数含义

| 参数 | 含义 | 来源 |
|---|---|---|
| `rewardMinUsdtOutAmount` | 后端签名绑定的最低 USDT 要求 | 后端签名服务 |
| `signatureDeadline` | 签名过期时间 | 后端签名服务 |
| `signature` | 后端签名 | 后端签名服务 |
| `minUsdtOut` | 透传给 Router 的最低输出 | 前端输入 |

### 代码里怎么实现

1. 校验：
   - `referralSwapRouter != 0`
   - `referralUsdtToken != 0`
   - `referralClaimSigner` 已配置
   - `referralSwapPoolFee != 0`
   - 当前时间未超过 `signatureDeadline`
2. 读取当前用户全部 `referrerRewardsOdd[msg.sender]` 作为本次待兑换 ODD；
3. 构造签名消息，绑定：
   - `address(this)`
   - `block.chainid`
   - `msg.sender`
   - 当前 ODD 奖励数量
   - `rewardMinUsdtOutAmount`
   - `signatureDeadline`
   - 当前 nonce
4. 用 `ECDSA.recover` 验签；
5. `nonce += 1`；
6. 清空该用户当前推荐奖励主账；
7. `accountedBalance -= oddAmount`；
8. 记录推荐人 USDT 余额；
9. 授权治理配置的 router 使用 `oddAmount`；
10. 调 Pancake V3 `exactInputSingle`；
11. 读取推荐人 USDT 余额前后差额作为真实到账量；
12. 校验真实到账量同时满足 `minUsdtOut` 和 `rewardMinUsdtOutAmount`；
13. 清回 router 授权；
14. 发 `ReferralClaimedUSDT`。

### 为什么要这么实现

- nonce 防重放；
- deadline 防签名长期滥用；
- `swapRouter / usdtAddress` 不再由用户传入，统一使用治理配置；
- 当前按“全额兑换当前 ODD 推荐奖励”执行，避免签名消息和部分领取金额之间再引入第二套口径。

---

## 4. 只读接口为什么保留

- `getMarket / getMarketOdds / getBet / getUserRiskLedger`：前端或后端读取当前市场、注单和用户基础账本；
- `isMatchTerminal`：LP / 运营判断比赛是否完全终态。
