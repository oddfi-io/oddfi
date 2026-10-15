# StakingPool 链上数据流

> 前端如何与 `StakingPool.sol` 合约对接：读取 / 写入 / 事件订阅 / 自动刷新 / 已知陷阱。
> 对齐 `docs/contract/liquidity-pool-flow.md` 结构。DD-107 实施完成。

---

## 1. 一句话定位

`StakingPool` 是 OFI 单边质押合约：用户锁仓 OFI 选档位（6 档 `planId 0..5`），到期 `unstake` 拿本金 + 收益；未到期可 `earlyUnstake` 退本金但放弃收益。前端在 stake 页面驱动整套流程。

---

## 2. 链上对象关系

```
StakingPool
├── positions(positionId) → StakePosition struct
│     { owner, principal, weight, unlockAt, rewardDebt, planId, sourceType, active }
├── nextPositionId() → 仓位计数上界（已发 id + 1）
├── accRewardPerShare() → 全局累积每 share 奖励（reward distribution 累加器）
├── totalWeightedShares() → 全局加权 share 总量
├── accountedOddBalance() → 合约托管 OFI 总额（活跃 + pending reward）
├── minStakeAmount() → 最小质押额（默认 100 OFI）
└── 用户级派生 view（VIP 系统）：
      getActiveStakeAmount(user) → 用户活跃本金总和（不含已退出）
      getUserTier(user) → 0..10
      getUserDailyLimit(user) → 用户 BettingPool 投注限额（与 VIP 联动）
      isActiveStaker(user) → 是否有任一活跃仓位
```

合约**没有显式状态枚举**。仓位状态由 `position.active: bool` + `position.unlockAt: uint64` **隐式表达**。

---

## 3. 状态机（3 态）

| UI 状态     | 合约表达                            | 行为                                    |
| ----------- | ----------------------------------- | --------------------------------------- |
| `active`    | `active=true && unlockAt > now`     | 锁定中，只能调 `earlyUnstake`           |
| `ready`     | `active=true && unlockAt <= now`    | 到期，调 `unstake` 拿本金 + 收益        |
| `withdrawn` | `active=false`（正常退 / 早退合并） | 终态，不进 active list（在 history 区） |

集中 derive：`lib/staking-state.ts → derivePositionStatus(pos, nowSec)` 纯函数。**任何 UI 不得 inline ternary 判断**。

---

## 4. 用户路径

### 4.1 Stake（开仓）

`useStakeTx.execute(amount, planId)`：

1. 校验 `planId ∈ [0,5]`（防 dev tools 注入越界值）
2. 校验 `allowance(user, stakingPool) >= amount`：不足 → 走 `approve(maxUint256)`
3. approve 确认后自动 chain `stake(amount, planId)`
4. stake 确认 → onSuccess 边沿守卫触发一次 → refetch positions

phase: `idle → approving → staking → confirming → success / failed`

### 4.2 Unstake（正常退出）

合约要求 `unlockAt <= now`。`useUnstakeTx.executeUnstake(positionId)`：

- 直接调 `unstake(positionId)`
- 合约转 `principal + pendingReward` 给用户

`lastOp = "unstake"`，phase: `idle → executing → confirming → success / failed`。

### 4.3 EarlyUnstake（早退）

合约要求 `unlockAt > now`，**本金退还，收益丢失**（合约把它注入 `accRewardPerShare` 重分配给剩余质押者，emit `RewardNotified`；若 `totalWeightedShares=0` 则转 `platformTreasury`，emit `RewardRedirectedToPlatform`）。

`useUnstakeTx.executeEarlyUnstake(positionId)` 路径同 unstake，仅 `functionName: "earlyUnstake"`，`lastOp = "earlyUnstake"`。

UI 入口：PositionCard active 状态显示 "Early Unstake" 二级按钮 → 触发 `EarlyUnstakeModal` 二次确认 → 调 `executeEarlyUnstake`。

---

## 5. 前端 hook 责任分层

| Hook                    | 职责                                                                         |
| ----------------------- | ---------------------------------------------------------------------------- |
| `useIsStakingAvailable` | 当前网络是否已部署合约（mainnet 未部署 → false）                             |
| `useOddBalance`         | 用户 OFI 余额                                                                |
| `useStakingGlobalStats` | 全局 stats：accountedOddBalance / totalWeightedShares / accRewardPerShare 等 |
| `useUserStaking`        | 用户活跃仓位 + 历史 + 事件订阅自动刷新                                       |
| `useStakeTx`            | approve → stake 链路 + onSuccess 边沿守卫 + planId 校验                      |
| `useUnstakeTx`          | unstake / earlyUnstake + lastOp 生命周期 + onSuccess 边沿守卫                |

`UserStakeStats` 组件内部直接 `useReadContracts` multicall 4 个 VIP view（不抽 hook，N=1 调用方 Deletion Test 失败）。

---

## 6. 自动刷新机制

`useUserStaking` 订阅 3 条事件：

| 事件             | onLogs 副作用                                                       |
| ---------------- | ------------------------------------------------------------------- |
| `StakeCreated`   | owner filter → push positionId 进 useState → refetch positions      |
| `StakeWithdrawn` | owner filter → refetch positions + refetch accRewardPerShare + 历史 |
| `RewardNotified` | 全员事件（不带 user）→ refetch accRewardPerShare 让 pending 跳变    |

**所有 onLogs 必须 `useCallback`** — wagmi 内部把 onLogs 放进 useEffect deps，inline 箭头每次新引用会触发 unwatch+rewatch RPC 抖动。

---

## 7. 已知陷阱

### 7.1 `SECONDS_PER_DAY = 3600`（testnet 把"天"压缩为 1 小时）

合约 `PrecisionConstants.SECONDS_PER_DAY = 3600`（非标准）。`StakingConstants.STAKE_PLAN_N_LOCK_DAYS` 变量名虽是"天"但语义是"小时"。

前端 `lib/staking-plans.ts` PLAN_MAP `hours: 8/16/24/32/40/48` 数值与合约一致 ✓。

**若未来合约修正 `SECONDS_PER_DAY=86400` 真实天，前端必须把 hours 字段同步改成 days，否则锁仓时间会变成 24 倍**。

### 7.2 earlyUnstake 的 reward 不归用户

`StakeWithdrawn(early=true)` 事件的 `reward` 字段是计算值，但**用户实际未收到**：

- 当 `totalWeightedShares > 0` → 合约把它注入 `accRewardPerShare` 重分配
- 当 `totalWeightedShares = 0` → 合约转 `platformTreasury`

UI History 行：`action === "early_unstake"` 时**不展示 reward 数字**，改文案 "Forfeited & redistributed"（i18n key `historyEarlyForfeited`）。

### 7.3 数据源不一致的瞬时（< 1s）

`UserStakeStats` 4 卡：

- `totalActiveStake` 来自合约 view（实时）
- `totalPendingReward` 来自前端 derive（依赖 `accRewardPerShare`）

两者刷新时机不完全同步，可能出现 < 1s 瞬时不一致。用户感知极小，不阻断。

### 7.4 `fromBlock: 0n` 全量扫描

`useUserStaking` 当前用 `getLogs({ fromBlock: 0n })` 拉全量历史日志。testnet 当前数百级别可承受，长期是性能定时炸弹。

→ 转入 enh-todo：换成事件回放分段 / 后端缓存（与 LP 同一性质问题）。

### 7.5 onSuccess 边沿守卫

`useWaitForTransactionReceipt` 的 `isConfirmed` 在确认后**长真**直到下次 tx。父组件 re-render 时 isConfirmed 仍为 true，若 onSuccess 不加守卫会被反复调用导致重复 refetch / toast。

`useStakeTx` / `useUnstakeTx` 用 `firedForHashRef`：每个 tx hash 只触发一次 onSuccess。reset() 时必须清 ref。

### 7.6 wagmi watcher onLogs 必须 useCallback

inline arrow → wagmi 内部 useEffect deps 命中 → 反复 unwatch+watch RPC 订阅 → 节点限速 + 监听空窗期。已在 LP 实证（feedback_wagmi_watcher_onlogs_usecallback）。

---

## 8. 测试覆盖矩阵

| 文件                                         | 覆盖点                                                             |
| -------------------------------------------- | ------------------------------------------------------------------ |
| `lib/staking-state.test.ts`                  | derivePositionStatus 5 用例（3 态 + 边界 + 跨中点过渡）            |
| `hooks/useStakingData.test.ts`               | 仓位组装 / 事件 owner filter / RewardNotified refetch / early flag |
| `hooks/useStakeTx.test.ts`                   | planId 边界校验 / approve 路径 / 直 stake 路径 / reset             |
| `hooks/useUnstakeTx.test.ts`                 | lastOp 生命周期 / 双路径 dispatch / reset                          |
| `components/staking/PositionCard.test.tsx`   | 3 态按钮可见性 + click 触发回调                                    |
| `components/staking/UserStakeStats.test.tsx` | 未连接 / 非活跃质押者不渲染 / 4 卡渲染                             |

---

## 9. 关联文档

- 合约 API 全景：`oddfi-ODD/docs/development/api.md` §10
- 合约当前实现：`oddfi-ODD/docs/development/2026-04-22-StakingPool-当前实现.md`
- LP 对照范式：`docs/contract/liquidity-pool-flow.md`
- DD：`.progress/designs/DD-107-staking-onchain-full-flow.md`
- 个人记忆：`feedback_wagmi_watcher_onlogs_usecallback`
