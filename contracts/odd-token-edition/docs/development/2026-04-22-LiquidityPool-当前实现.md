# LiquidityPool 当前实现

**状态：** 当前有效，已接入 ODDToken 业务来源接口
**日期：** 2026-06-12
**基线：** 当前 `src/modules/liquidity/LiquidityPool.sol`

## 1. 当前定位

`LiquidityPool` 当前只负责 LP 账本，不负责推荐、税或平台准备金。

它负责：

- Global Pool / Match Pool
- LP 仓位
- margin / loss 会计
- requestable liquidity
- payout window
- unbond / withdraw

2026-06-12 补充：在 ODDToken 锁仓与发售 MVP 中，`LiquidityPool` 已按最小改动接入 Token 业务来源接口：

- `depositGlobal` 和 `depositMatch` 不再直接 `safeTransferFrom` 用户 ODD，而是调用 `ODDToken.consumeBusinessInflow(user, LP_POSITION, positionId, principal)`；
- `withdraw` 不再普通转账给用户，而是调用 `registerBusinessOutcomeDelta`；
- LP 正收益会被 Token 识别为净盈利并成为可转 ODD；
- LP 亏损或清零会通过 finalized outcome 确认来源亏损；
- `requestPayoutLiquidity` 仍是 `LiquidityPool -> BettingPool` 池间资金划转，不登记用户 outcome。

## 2. 当前核心状态

### 池级

| 状态 | 作用 | 为什么存在 |
|---|---|---|
| `pools` | 存储 Global 和 Match Pool | 池级账本 |
| `totalActiveDeposited` | 全体活跃本金 | 提供全局可见的资金规模 |
| `requestableLiquidity` | 当前可接单流动性 | 给 `BettingPool` 风控读 |
| `totalOutstandingPayoutReserved` | 尚未实际划拨的赔付预留 | 防止赔付窗口和可接单额度混淆 |
| `payoutWindows` | 比赛赔付窗口 | 让结算后资金划拨有界 |

### 仓位级

| 状态 | 作用 |
|---|---|
| `positions` | LP 仓位 |
| `nextLpPositionId` | 仓位自增 ID |
| `epochStart` | unbond epoch 基准 |
| `minDeposit` | 最小存入门槛 |
| `unbondEpochs` | 解绑等待周期数 |

## 3. 当前会计口径

当前仍保留旧字段名：

- `rewardPerWeight`
- `lossPerPrincipal`

但当前实现含义已经是：

- Global Pool 新存入时 `weight = principal`
- Match Pool 仍按固定 multiplier 计算 `weight`
- `distributeLoss` 会回传 L2 实际承担量

为什么没直接改字段名：

- 当前代码优先保证行为正确
- 直接改字段名会把 upgrade / migration 风险放大

## 4. 接口实现说明

## 4.0 constructor

当前 implementation 构造器会调用 `_disableInitializers()`。

这只锁住 implementation 合约本体，防止直接初始化 implementation；proxy 初始化和后续通过 proxy 执行的 UUPS `upgradeToAndCall` / `reinitializer` 不受影响。

## 4.1 `initialize(address admin, address oddTokenAddress, address initialBettingPool)`

### 参数含义

| 参数 | 类型 | 含义 |
|---|---|---|
| `admin` | `address` | 初始治理地址 |
| `oddTokenAddress` | `address` | ODDToken 地址 |
| `initialBettingPool` | `address` | 初始 BettingPool 地址 |

### 参数来源

- 部署脚本

### 实现步骤

1. 校验 3 个地址非零
2. 初始化 `AccessControlUpgradeable` + `PausableUpgradeable`
3. 写角色
4. 写：
   - `oddToken`
   - `bettingPool`
   - `epochStart`
   - `minDeposit`
   - `unbondEpochs`
   - `nextLpPositionId = 1`
   - `_reentrancyStatus = 1`
   - `requestableLiquidity = 0`
5. 初始化 `pools[0]` 作为 Global Pool
6. 发 `LiquidityConfigUpdated`

### 为什么这么实现

- Global Pool 必须在初始化时即存在，避免后续判断大量分支
- `epochStart` 固定到整天边界，方便 unbond epoch 计算
- `unbondEpochs` 初始化为 `LiquidityConstants.UNBOND_EPOCHS`

## 4.2 `setBettingPool(address newBettingPool)`

### 参数含义

| 参数 | 类型 | 含义 |
|---|---|---|
| `newBettingPool` | `address` | 新的 BettingPool 地址 |

### 参数来源

- 升级脚本或治理配置

### 实现步骤

1. 校验非零地址
2. 写入 `bettingPool`
3. 发 `LiquidityConfigUpdated`

### 为什么这么实现

- `LiquidityPool` 有多条 onlyBettingPool 路径
- 地址切换必须显式可控

## 4.3 `setMinDeposit(uint256 newMinDeposit)`

### 参数含义

| 参数 | 类型 | 含义 |
|---|---|---|
| `newMinDeposit` | `uint256` | 新的最小 LP 存入门槛 |

### 参数来自哪里

- 治理参数调整。

### 代码里怎么实现

1. 校验 `newMinDeposit > 0`；
2. 更新 `minDeposit`；
3. 触发 `MinDepositUpdated`。

### 为什么要这么实现

- 产品规则要求最小存入门槛可调；
- 该值直接决定 dust LP 是否允许进入。

## 4.3B `setUnbondEpochs(uint32 newUnbondEpochs)`

### 参数含义

| 参数 | 类型 | 含义 |
|---|---|---|
| `newUnbondEpochs` | `uint32` | 新的解绑等待 Epoch 数 |

### 参数来自哪里

- 治理参数调整。

### 代码里怎么实现

1. 校验 `newUnbondEpochs > 0`；
2. 更新 `unbondEpochs`；
3. 触发 `UnbondEpochsUpdated`。

### 为什么要这么实现

- 产品规则要求解绑等待期可以调整；
- withdraw 成熟判断直接依赖这个值。

## 4.3C `previewWithdraw(uint256 positionId)`

### 参数含义

| 参数 | 类型 | 含义 |
|---|---|---|
| `positionId` | `uint256` | LP 仓位 ID |

### 实现步骤

1. 读取仓位并计算有效状态；
2. 若仓位尚未进入 `Unbonding / Withdrawable`，返回 `withdrawAmount = 0`、`netPnl = 0` 和有效状态；
3. 若已进入解绑提款路径，复用 `withdraw` 的冻结收益/亏损口径计算 `withdrawAmount` 与 `netPnl`；
4. 返回当前有效状态，方便前端判断是否已经真正可提款。

### 为什么这么实现

- 当前仓位按 `positionId` 管理，链上没有 `address -> positionIds` 索引；
- 只补按仓位预览的 view，不新增 storage，不引入历史仓位迁移；
- 计算口径与 `withdraw` 保持一致，避免前端/后端重复实现公式后出现展示偏差。

## 4.4 `depositGlobal(uint256 amount, uint16 planId)`

### 参数含义

| 参数 | 类型 | 含义 |
|---|---|---|
| `amount` | `uint256` | 本次存入 Global Pool 的 ODD 数量 |
| `planId` | `uint16` | Global Pool 的锁仓计划编号 |

### 参数来源

- 用户输入 `amount`
- 前端固定计划表提供 `planId`

### 实现步骤

1. 校验 `amount >= minDeposit`
2. 读取 Global plan 的 `lockDays`
3. 当前实现直接使用 `weight = amount`
4. 创建 LP 仓位
5. 增加：
   - pool totals
   - `totalActiveDeposited`
   - `requestableLiquidity`
6. 转入 ODD
7. 发 `LiquidityDeposited` 和 snapshot

### 为什么这么实现

- 现在 Global Pool 已按本金口径工作
- 这样更符合当前 v2 风险和瀑布口径

## 4.5 `depositMatch(bytes32 matchId, uint256 amount)`

### 参数含义

| 参数 | 类型 | 含义 |
|---|---|---|
| `matchId` | `bytes32` | 比赛 ID |
| `amount` | `uint256` | 本次存入的 ODD 数量 |

### 参数来源

- 前端从比赛页拿到 `matchId`
- 用户输入 `amount`

### 实现步骤

1. 校验最小存入
2. 找到 `matchId` 对应池
3. 校验池存在、允许存入、未过 `depositCloseAt`
4. 计算 `weight = amount * MATCH_POOL_MULTIPLIER_BPS / 10000`
5. 建仓
6. 增加 pool totals / active totals / requestable liquidity
7. 转入 ODD
8. 发事件

### 为什么这么实现

- Match Pool 相对 Global Pool 允许使用单独倍率
- 比赛池必须在开赛前关闭存入，避免赛后补池

## 4.6 `openMatchPool(bytes32 matchId, uint64 matchStartTime, uint64 matchEndTime)`

### 参数含义

| 参数 | 类型 | 含义 |
|---|---|---|
| `matchId` | `bytes32` | 比赛 ID |
| `matchStartTime` | `uint64` | 开赛时间 |
| `matchEndTime` | `uint64` | 比赛结束时间 |

### 参数来源

- `BettingPool.openMarket` 首次为该比赛开盘时传入

### 实现步骤

1. 校验：
   - `matchId != 0`
   - `matchStartTime > 0`
   - `matchEndTime > matchStartTime`
2. 计算 `poolId = uint256(matchId)`
3. 校验同池未重复创建
4. 创建 Match Pool：
   - `depositCloseAt = matchStartTime`
   - `unlockAt = matchEndTime`
5. 发 `MatchPoolOpened`

### 为什么这么实现

- 同一比赛下多个 market 共用一个 Match Pool
- pool 维度按 `matchId` 比按 `marketId` 更符合赔付与退出边界

## 4.7 `closeMatchPoolDeposit(bytes32 matchId)`

参数：`matchId`

实现目的：

- 显式关闭赛池存入
- 避免继续追加比赛流动性

## 4.8 `distributeMargin(bytes32 matchId, uint256 lpMarginShare)`

### 参数来源

- 来自 `BettingPool.finalizeMarketSettlement(marketId,0)` 正常比分结算算出来的 LP margin 份额

### 实现步骤

1. 取 Global / Match pool 当前权重
2. 如果总权重为 0 或 `lpMarginShare == 0`：直接记录空分配
3. 否则按权重比例拆成：
   - `globalShare`
   - `matchShare`
4. 更新 reward 累加器
5. 增加 `requestableLiquidity`

### 为什么这么实现

- margin 是增量收益，应该回流到 LP 账本
- requestable liquidity 随 margin 增加而增加，符合“LP 更厚可以接更多单”的口径

## 4.9 `distributeLoss(bytes32 matchId, uint256 netLoss)`

### 参数来源

- 来自 `BettingPool._waterfall` 的 L2 缺口

### 实现步骤

1. 取 Global / Match 的当前 active principal
2. 如果没有 active principal 或 `requestableLiquidity == 0`：
   - 记录 0
   - 返回 0
3. 否则 `lpLossBooked = min(netLoss, requestableLiquidity)`
4. 按 active principal 比例拆 Global / Match
5. 更新 loss 累加器
6. `requestableLiquidity -= lpLossBooked`
7. 同步 payout reserved
8. 返回 `lpLossBooked`

### 为什么这么实现

- `BettingPool` 必须知道 L2 实际吃掉了多少，才能继续 L3/L4
- 不能盲目假设 LP 一定吃满所有缺口

## 4.10 `requestUnbond(uint256 positionId)`

### 参数来源

- 用户自己的 LP 仓位

### 实现步骤

1. 校验 owner
2. 校验仓位必须 `Active`
3. 校验时间已过 `unlockAt`
4. 如果是 Match Pool，还要校验比赛已终态
5. 冻结当前 reward/loss 快照
6. 状态改为 `Unbonding`
7. 从：
   - pool totals
   - `totalActiveDeposited`
   - `requestableLiquidity`
   中扣除该仓位影响

### 为什么这么实现

- unbond 之后就不应继续参与可接单流动性
- 必须先冻结快照，否则退出期间账会漂移

## 4.11 `withdraw(uint256 positionId)`

### 参数来源

- 用户自己的 LP 仓位

### 实现步骤

1. 校验 owner
2. 校验状态在允许退出集合内
3. 校验 epoch 已成熟（`position.unbondingEpoch + unbondEpochs + 1`）
4. 计算：
   - `accruedReward`
   - `accruedLoss`
   - `netPnl`
5. 若 `netPnl >= 0`：
   - 本金 + 收益退出
   - 状态 `Withdrawn`
6. 若 `netPnl < 0`：
   - 先用本金 absorb loss
   - 若本金被完全打穿，状态 `Liquidated`
   - 否则状态 `Withdrawn`
7. 发 `LiquidityWithdrawn`

### 为什么这么实现

- 当前 LP 退出必须真实反映历史盈亏
- 允许仓位被损失打穿，不能强行保本

## 4.12 `requestPayoutLiquidity(bytes32 matchId, uint256 amount)`

### 参数来源

- `BettingPool.claimPayout` 在池内 ODD 不够时调用

### 实现步骤

1. 读取 payout window
2. 校验还有足够未划拨 reserved
3. 校验池内实际余额足够
4. `paidOutAmount += amount`
5. `totalOutstandingPayoutReserved -= amount`
6. 把 ODD 转给 `bettingPool`

### 为什么这么实现

- 赔付窗口必须有界
- 预留的赔付额度和实际划拨额度必须拆开记账

## 4.13 `getPositionState(uint256 positionId)`

### 参数含义

| 参数 | 类型 | 含义 |
|---|---|---|
| `positionId` | `uint256` | LP 仓位 ID |

### 参数来自哪里

- 前端仓位列表；
- 后端状态看板。

### 代码里怎么实现

1. 读取仓位当前存储状态；
2. 若存储状态为 `Active` 且已过 `unlockAt`，对外返回 `Ready`；
3. 若存储状态为 `Unbonding` 且等待期已满足，返回 `Withdrawable`；
4. 否则返回原始状态。

### 为什么要这么实现

- 产品侧要求用户能看到 `Ready / Withdrawable` 这类状态；
- 直接把这些状态做成只读映射，比额外链上写状态更省 gas；
- 同时不破坏当前存储结构。
