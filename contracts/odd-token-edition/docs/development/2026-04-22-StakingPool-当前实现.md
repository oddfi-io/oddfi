# StakingPool 当前实现

**状态：** 当前有效，已接入 ODDToken 业务来源接口
**日期：** 2026-06-12
**基线：** 当前 `src/modules/staking/StakingPool.sol`

## 1. 模块定位

`StakingPool` 当前只负责质押域本身：

- 用户建仓；
- 奖励累加器分发；
- 到期退出；
- 提前退出；
- VIP 等级读取。

它现在已经**不负责**推荐奖励自动建仓，也不再接受 Token 侧直接注入业务奖励。

2026-06-12 补充：在 ODDToken 锁仓与发售 MVP 中，`StakingPool` 已按最小改动接入 Token 业务来源接口：

- `stake` 不再直接 `safeTransferFrom` 用户 ODD，而是调用 `ODDToken.consumeBusinessInflow(user, STAKING_POSITION, positionId, principal)`；
- `unstake` 和 `earlyUnstake` 不再普通转账给用户，而是调用 `registerBusinessOutcomeDelta`；
- 正常解押中的 `pendingReward` 会被 Token 识别为业务净盈利，成为可转 ODD；
- 提前解押只登记返还本金，未发放奖励不进入该用户 outcome；
- `notifyReward` 仍只允许 `BettingPool`，奖励注入路径和累加器公式不变。

### 为什么这样设计

- 推荐奖励已经迁到 `BettingPool` 主账；
- `StakingPool` 只保留“管仓位 + 管奖励累加器”的职责，模块边界更清晰；
- 下游 `BettingPool` 风控仍可通过 `getActiveStakeAmount/getUserTier` 读取质押信息。

---

## 2. 当前核心状态

| 状态 | 类型 | 作用 | 为什么存在 |
|---|---|---|---|
| `oddToken` | `IERC20` | ODD 资金结算媒介 | 质押本金和奖励都用 ODD |
| `platformTreasury` | `address` | 无剩余 shares 时承接奖励 | 防止奖励悬空 |
| `bettingPool` | `address` | 唯一允许注入奖励的地址 | 奖励来源收口 |
| `nextPositionId` | `uint256` | 仓位自增编号 | 便于前后端索引仓位 |
| `accRewardPerShare` | `uint256` | 全局奖励累加器 | 避免逐仓位分配 |
| `totalWeightedShares` | `uint256` | 全网总权重 | 作为奖励分母 |
| `accountedOddBalance` | `uint256` | 账面已计 ODD | 防止脏余额污染分配 |
| `minStakeAmount` | `uint256` | 当前最小质押量 | 允许治理动态调整门槛 |
| `positions` | `mapping(uint256 => StakePosition)` | 质押仓位主账 | 仓位数据来源 |
| `activeStakeAmount` | `mapping(address => uint256)` | 用户活跃本金 | VIP 和风控依赖 |
| `_vipThresholds` | `uint256[11]` | VIP 门槛表 | 支持治理调整各档位 |
| `_vipDailyLimits` | `uint256[11]` | VIP 每日限额表 | 供 `BettingPool` 风控读取 |

---

## 3. 接口逐项说明

## 3.0 constructor

当前 implementation 构造器会调用 `_disableInitializers()`。

这只锁住 implementation 合约本体，防止直接初始化 implementation；proxy 初始化和后续通过 proxy 执行的 UUPS `upgradeToAndCall` / `reinitializer` 不受影响。

## 3.1 `initialize(address admin, address oddTokenAddress, address initialPlatformTreasury)`

### 参数含义

| 参数 | 类型 | 含义 |
|---|---|---|
| `admin` | `address` | 初始治理地址 |
| `oddTokenAddress` | `address` | ODDToken 合约地址 |
| `initialPlatformTreasury` | `address` | 平台金库地址 |

### 参数来自哪里

- 部署脚本；
- `oddTokenAddress` 来自已部署的 Token；
- `initialPlatformTreasury` 来自治理配置。

### 代码里怎么实现

1. 校验三个地址都非零；
2. 初始化 `AccessControlUpgradeable` 和 `PausableUpgradeable`；
3. 赋予角色：
   - `DEFAULT_ADMIN_ROLE`
   - `UPGRADER_ROLE`
   - `PAUSER_ROLE`
4. 写入：
   - `oddToken`
   - `platformTreasury`
   - `nextPositionId = 1`
   - `_reentrancyStatus = 1`
5. 触发：
   - `StakingInitialized`
   - `StakingConfigUpdated`
   - `VipConfigUpdated`

### 为什么要这么实现

- `nextPositionId` 从 1 开始，避免 0 仓位被误读成未初始化；
- 初始化时同步发 VIP 配置 hash，便于链下确认当前常量表。

---

## 3.2 `initializeV2(address initialBettingPool)`

### 参数含义

| 参数 | 类型 | 含义 |
|---|---|---|
| `initialBettingPool` | `address` | 当前允许调用 `notifyReward` 的 BettingPool 地址 |

### 参数来自哪里

- 升级脚本；
- 或治理在部署后手动补配置。

### 代码里怎么实现

1. 校验非零地址；
2. 写入 `bettingPool`；
3. 发 `BettingPoolUpdated`。

### 为什么要这么实现

- v2 之后奖励源只认 `BettingPool`；
- 这个入口把老合约升级后的奖励来源显式锁死。

---

## 3.3 `stake(uint256 amount, uint16 planId) returns (uint256 positionId)`

### 参数含义

| 参数 | 类型 | 含义 |
|---|---|---|
| `amount` | `uint256` | 本次质押的 ODD 数量 |
| `planId` | `uint16` | 质押档位编号 |

### 参数来自哪里

- `amount`：用户输入；
- `planId`：前端根据固定计划表提供。

### 代码里怎么实现

1. 校验 `amount >= minStakeAmount`；
2. 通过 `_stakePlan(planId)` 读取：
   - `lockDays`
   - `multiplierBps`
3. 计算：
   - `weight = amount * multiplierBps / BPS_SCALE`
   - `unlockAt = block.timestamp + lockDays * 1 days`
4. 调 `_createPosition(...)` 建仓；
5. `safeTransferFrom` 把 ODD 打入池子；
6. `accountedOddBalance += amount`；
7. 发 `StakeAccountingSnapshot`。

### 为什么要这么实现

- 本金和权重分离，可以让不同锁仓周期有不同收益权重；
- 建仓先写状态再转账，再记 snapshot，符合当前账本设计。

---

## 3.4 `notifyReward(uint256 amount)`

### 参数含义

| 参数 | 类型 | 含义 |
|---|---|---|
| `amount` | `uint256` | 本次注入的 ODD 奖励金额 |

### 参数来自哪里

- 当前只来自 `BettingPool.claimPayout(...)` wrapper 委派到 `BettingSettlementModule._distributePayoutTax(...)` 后分给质押池的税份额。

### 代码里怎么实现

1. 只允许 `bettingPool` 调用；
2. 校验 `amount > 0`；
3. 不受 `StakingPool.pause()` 影响，避免质押模块暂停时阻断已结算胜单 `claimPayout`；
4. 校验当前池内真实余额足以覆盖 `accountedOddBalance + amount`；
5. `accountedOddBalance += amount`；
6. 如果 `totalWeightedShares == 0`：
   - 不更新 `accRewardPerShare`
   - 直接把奖励转给 `platformTreasury`
   - 发 `RewardRedirectedToPlatform` 和 snapshot
7. 如果存在 shares：
   - `accRewardPerShare += amount * 1e18 / totalWeightedShares`
   - 发 `RewardNotified`
   - 发 snapshot。

### 为什么要这么实现

- 奖励必须先真实到账，再允许入账分配；
- 当没有任何活跃 shares 时，不能把奖励强行分给不存在的持仓。
- pause 只冻结用户质押/赎回等主动操作，不冻结 BettingPool 已结算胜单领奖时的派奖税注入路径。

---

## 3.5 `unstake(uint256 positionId)`

### 参数含义

| 参数 | 类型 | 含义 |
|---|---|---|
| `positionId` | `uint256` | 目标质押仓位 ID |

### 参数来自哪里

- 用户自己的仓位列表；
- 前端在“可赎回仓位”列表中传入。

### 代码里怎么实现

1. 校验调用人是 owner，且仓位 active；
2. 校验当前时间已到 `unlockAt`；
3. 计算 `pendingReward`；
4. `_deactivatePosition(...)`；
5. `accountedOddBalance -= principal + pendingReward`；
6. 直接转给用户 `principal + pendingReward`；
7. 发 `StakeWithdrawn` 和 snapshot。

### 为什么要这么实现

- 到期赎回就是一次性结清本金和收益；
- 先 deactive 再转账，保证仓位状态先闭合。

---

## 3.6 `earlyUnstake(uint256 positionId)`

### 参数含义

参数同 `unstake`。

### 参数来自哪里

- 用户自己的未到期仓位。

### 代码里怎么实现

1. 校验 owner 和 active；
2. 校验当前时间 **未到** `unlockAt`；
3. 计算 `pendingReward`；
4. `_deactivatePosition(...)`；
5. 本金直接退给用户；
6. 对 `pendingReward` 分两种情况：
   - 仍有 `totalWeightedShares > 0`：重新分配给剩余用户；
   - `totalWeightedShares == 0`：转给 `platformTreasury`；
7. 发 `StakeWithdrawn` 和 snapshot。

### 为什么要这么实现

- 用户提前退出时本金始终退还；
- 已累计但未成熟的收益不能跟着走；
- 若池内没人可继续分摊，只能归平台金库，避免悬空。

---

## 3.7 `setPlatformTreasury(address newPlatformTreasury)`

### 参数含义

| 参数 | 类型 | 含义 |
|---|---|---|
| `newPlatformTreasury` | `address` | 新的平台金库地址 |

### 参数来自哪里

- 治理地址配置。

### 代码里怎么实现

1. 校验非零地址；
2. 更新 `platformTreasury`；
3. 发 `StakingConfigUpdated`。

### 为什么要这么实现

- 该地址承接无 shares 时的奖励回流，必须是可用地址。

---

## 3.8 `setMinStakeAmount(uint256 newMinStakeAmount)`

### 参数含义

| 参数 | 类型 | 含义 |
|---|---|---|
| `newMinStakeAmount` | `uint256` | 新的最小质押门槛 |

### 参数来自哪里

- 治理参数调整。

### 代码里怎么实现

1. 校验 `newMinStakeAmount > 0`；
2. 发 `MinStakeAmountUpdated`；
3. 更新 `minStakeAmount`。

### 为什么要这么实现

- 产品规则要求最小质押门槛可调整；
- 该值属于纯风控/运营门槛，适合治理可调。

---

## 3.9 `setVipTierConfig(uint8 tier, uint256 threshold, uint256 dailyLimit)`

### 参数含义

| 参数 | 类型 | 含义 |
|---|---|---|
| `tier` | `uint8` | 要调整的 VIP 档位 |
| `threshold` | `uint256` | 该档位的活跃质押门槛 |
| `dailyLimit` | `uint256` | 该档位的每日下注限额 |

### 参数来自哪里

- 治理参数调整。

### 代码里怎么实现

1. 校验 `tier < 11`；
2. 校验门槛和日限额相对前后档位保持单调；
3. 更新 `_vipThresholds[tier]` 和 `_vipDailyLimits[tier]`；
4. 发：
   - `VipTierConfigUpdated`
   - `VipConfigUpdated`

### 为什么要这么实现

- 产品文档要求 VIP 门槛和日限额可以调整；
- 必须做单调校验，否则会出现档位倒挂，前后端都无法解释。

---

## 3.10 `setBettingPool(address newBettingPool)`

### 参数含义

| 参数 | 类型 | 含义 |
|---|---|---|
| `newBettingPool` | `address` | 新的 BettingPool 地址 |

### 参数来源

- 升级脚本；
- 治理切换地址。

### 代码里怎么实现

1. 校验非零地址；
2. 更新 `bettingPool`；
3. 发 `BettingPoolUpdated`。

### 为什么要这么实现

- `notifyReward` 是强依赖 onlyBettingPool 的入口；
- 地址切换必须显式可控。

---

## 3.11 `pause()` / `unpause()`

### 参数

无参数。

### 参数来自哪里

- 具有 `PAUSER_ROLE` 的治理或应急地址。

### 为什么要这么实现

- 质押池属于资金模块，仍然必须保留应急暂停能力。

---

## 3.12 `getActiveStakeAmount(address user)`

### 参数含义

| 参数 | 类型 | 含义 |
|---|---|---|
| `user` | `address` | 目标用户 |

### 参数来自哪里

- 前端钱包地址；
- 后端风控；
- `BettingPool` 下单风控读取。

### 代码里怎么实现

- 直接返回 `activeStakeAmount[user]`。

### 为什么要这么实现

- 下注风控最关心的是“用户当前活跃本金”，所以提供最直接的读接口。

---

## 3.13 `getUserTier(address user)`

### 参数含义

同上。

### 代码里怎么实现

- 读取 `activeStakeAmount[user]`；
- 依次和当前 storage 中的 `_vipThresholds[10] ... _vipThresholds[1]` 比较；
- 返回命中的 tier。

### 为什么要这么实现

- 当前 VIP 规则完全按活跃本金实时判定；
- 不依赖链下缓存，不存在保级期。

---

## 3.14 `getUserDailyLimit(address user)`

### 参数含义

同 `getActiveStakeAmount`。

### 代码里怎么实现

1. 根据 `activeStakeAmount[user]` 算出当前 tier；
2. 返回 `_vipDailyLimits[tier]`。

### 为什么要这么实现

- `BettingPool.placeBet` 的日限额校验已经改成直接依赖这个接口；
- 这样每日下注限额从固定常量变成了可治理配置。

---

## 3.15 `isActiveStaker(address user)`

### 参数含义

同上。

### 代码里怎么实现

- 直接判断 `activeStakeAmount[user] > 0`。

### 为什么要这么实现

- 这是最便宜的“是否有活跃仓位”判断；
- 方便前端和后端快速做状态判断。
