# 流动性池前端 ↔ 合约 全流程

**Last updated**: 2026-05-19
**适用合约**: `LiquidityPool` (BSC Testnet `0xdf0c59B387DfDf9f18969880DDCF1216BFEe318f`)
**合约 API 全景**: `oddfi-ODD/docs/development/api.md` §8（**权威，本文与其冲突以 api.md 为准**）

本文聚焦**前端如何驱动 LiquidityPool 合约 + 如何读回状态展示**，不展开合约内部 L2/payout window 的会计细节。

---

## 1. 一句话定位

LP（Liquidity Provider）把 ODD 锁进 Global Pool（按 plan 7h~35h 锁定）或 Match Pool（锁到 matchEnd），承担庄家风险换取分润；到期后必须走 `requestUnbond → 等 epoch → withdraw` 两步退出，不能直接提现。

---

## 2. 链上对象关系

```
LiquidityPool (proxy)
├── pools[poolId]              ── Global Pool(0) + Match Pool(uint256(matchId))
│   ├── totalDeposited / totalWeight / rewardPerWeight / lossPerPrincipal
│   ├── depositOpen + depositCloseAt
│   └── poolType (Global | Match)
│
├── positions[positionId]      ── 用户 LP 仓位
│   ├── owner / poolId / planId
│   ├── principal / weight / unlockAt
│   ├── state (Active|Unbonding|Withdrawable|Withdrawn|Liquidated)  ← 存储态
│   └── unbondingEpoch
│
├── payoutWindows[matchId]     ── 比赛级赔付预留
└── 全局计数器
    ├── nextLpPositionId       ← 前端扫描仓位的上界
    ├── totalActiveDeposited   ← TVL
    ├── requestableLiquidity   ← 当前可接单 + 兜底亏损
    └── minDeposit / unbondEpochs
```

---

## 3. 6 态状态机（前端唯一的状态真源）

合约枚举 `LpPositionState`：

|  值 | 名称           | 触发                                             | 含义                  |
| --: | -------------- | ------------------------------------------------ | --------------------- |
|   0 | `Active`       | depositGlobal/Match 后                           | 锁定中，未到 unlockAt |
|   1 | `Unbonding`    | requestUnbond 后                                 | 已申请退出，等 epoch  |
|   2 | `Ready`        | **合约 view 动态推导**（Active + 已到 unlockAt） | 可调 requestUnbond    |
|   3 | `Withdrawable` | **合约 view 动态推导**（Unbonding + epoch 满足） | 可调 withdraw         |
|   4 | `Withdrawn`    | withdraw 成功                                    | 已提走，终态          |
|   5 | `Liquidated`   | withdraw 时亏损 ≥ 本金                           | 本金归零，终态        |

### Storage state vs Effective state（**前端必读**）

```
positions(positionId).state    ← 存储态：只有 Active / Unbonding / Withdrawn / Liquidated
getPositionState(positionId)   ← 有效态：会把 Active→Ready / Unbonding→Withdrawable 自动升级
```

**前端必须用 `getPositionState`，不能直接读 `positions().state`**，否则锁定到期 / 解绑期满的过渡看不到，UI 永远卡在 Active/Unbonding。

实现：`hooks/useLpPositions.ts:258`（每个 positionId 同时 fire `positions` + `getPositionState`，UI 用后者）。

### Effective state → 可执行动作

| Effective state | UI 状态文案 | 下一步动作                        | 触发的合约写方法            |
| --------------- | ----------- | --------------------------------- | --------------------------- |
| Active          | 锁定中      | 等待（显示倒计时到 unlockAt）     | —                           |
| Ready           | 可解绑      | 显示 `Unbond` 按钮                | `requestUnbond(positionId)` |
| Unbonding       | 解绑中      | 等待（显示倒计时到 epoch 完成）   | —                           |
| Withdrawable    | 可提取      | 显示 `Withdraw` 按钮              | `withdraw(positionId)`      |
| Withdrawn       | 已提取      | 灰态 `Withdrawn` badge，操作列 —  | —                           |
| Liquidated      | 已清算      | 红态 `Liquidated` badge，操作列 — | —                           |

---

## 4. 用户路径（4 个写操作）

### 4.1 路径 A · 存入 Global Pool

```
用户输入 amount + planId
  ↓
[Step 1] ODDToken.approve(LiquidityPool, amount)         ← 若 allowance 不足
  ↓ wait receipt
[Step 2] LiquidityPool.depositGlobal(amount, planId)
  ↓ wait receipt
  ↓
事件: LiquidityDeposited(user, positionId, poolId=0, amount, weight, unlockAt, planId)
  ↓
仓位创建: state=Active, unlockAt = now + plan.lockSeconds
```

**前端实现**：`hooks/useDepositGlobalTx.ts`
**关键校验**：合约未暂停 / `amount >= minDeposit(1000 ODD)` / `planId ∈ [0..4]` / allowance 足够。
**Approve 边沿守卫**：用 `handledApproveHashRef`（hash 边沿）确保同一 approve tx 只触发一次 deposit。

### 4.2 路径 B · 存入 Match Pool

```
前置: BettingPool.openMarket(matchId, ...) 已被首次调用
        ↓ (合约内部自动)
        LiquidityPool.openMatchPool(matchId, matchStartTime, matchEndTime)
        ↓
        Match Pool 已存在
```

```
用户输入 amount + matchId
  ↓
[Step 1] approve（同上）
  ↓
[Step 2] LiquidityPool.depositMatch(matchId, amount)
  ↓
仓位创建: state=Active, poolId=uint256(matchId), unlockAt = matchEndTime
```

**前端实现**：`hooks/useDepositMatchTx.ts`
**关键校验**：`depositOpen = true` 且 `block.timestamp < depositCloseAt`（即开赛前才能存）。

### 4.3 路径 C · 请求解绑（Ready → Unbonding）

```
[前置] effective state = Ready（合约 view 已把 Active→Ready 升级）
  ↓
LiquidityPool.requestUnbond(positionId)
  ↓ wait receipt
  ↓
事件: UnbondRequested(user, positionId, unbondingEpoch)
       + LiquidityPositionStateChanged(user, positionId, oldState=Active, newState=Unbonding)
  ↓
状态变化：
  - state: Active → Unbonding
  - 冻结当前 rewardPerWeight / lossPerPrincipal
  - 从活跃池会计移除该仓位价值
  - requestableLiquidity 减少
```

**前端实现**：`hooks/useUnbondLpTx.ts`
**关键校验**：仓位 owner = msg.sender / **effective state = Ready**（不能用 storage state，会拒 Withdrawable 之外的所有写） / Match Pool 还要求 `BettingPool.isMatchTerminal(matchId) == true`（前端目前未读这条，依赖合约 revert）。

### 4.4 路径 D · 提取（Withdrawable → Withdrawn/Liquidated）

```
[前置] effective state = Withdrawable（合约已把 Unbonding+epoch 满 → Withdrawable 升级）
  ↓
LiquidityPool.withdraw(positionId)
  ↓ wait receipt
  ↓
事件: LiquidityWithdrawn(user, positionId, withdrawAmount, netPnl, finalState)
       + LiquidityPositionStateChanged(user, positionId, oldState=Unbonding, newState=Withdrawn|Liquidated)
  ↓
状态变化：
  - 计算 withdrawAmount = principal + 收益 - 亏损
  - 若亏损 ≥ 本金 → state=Liquidated, 不转账
  - 否则 → state=Withdrawn, 转 ODD 给用户
```

**前端实现**：`hooks/useWithdrawLpTx.ts`
**关键校验**：epoch 必须达到 `unbondingEpoch + unbondEpochs + 1`（合约内部 check，前端通过 `getPositionState` 间接知道是否可写）。

---

## 5. 前端 hook 责任分层

### 读路径

| Hook                        | 合约调用                                                                  | 用途                    | 触发 refetch                                                   |
| --------------------------- | ------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------- |
| `useLpPositions`            | `nextLpPositionId` → 批 `positions` → 批 `getPositionState`               | 拉用户全部仓位 + 6 态   | LiquidityDeposited / UnbondRequested / LiquidityWithdrawn 事件 |
| `useLiquidityPoolStats`     | `totalActiveDeposited` / `minDeposit` / `paused` / `requestableLiquidity` | 池子总览 + 写前置 guard | 周期性 / 写操作完成                                            |
| `useLiquidityFeaturedPools` | `pools(poolId)` 批                                                        | 池子展示卡              | 周期性                                                         |

#### `useLpPositions` 仓位发现算法

```
1. 读 nextLpPositionId() → N
2. 一次 useReadContracts: positions(1), positions(2), ... positions(N-1)
3. 客户端 filter: owner === userAddress
4. 拿到匹配的 positionIds → 再批 getPositionState(id) 拿 effective state
5. 合并展示
```

> 性能注意：positionId 是全局自增，长期会膨胀到 4 位数+。当前实现是全量扫描，后续应换成事件回放或后端缓存。

### 写路径

| Hook                 | 合约调用                        | 前置 approve | 状态机                                                                          |
| -------------------- | ------------------------------- | ------------ | ------------------------------------------------------------------------------- |
| `useDepositGlobalTx` | `depositGlobal(amount, planId)` | ✅           | idle → approving → confirming_approve → executing → confirming → success/failed |
| `useDepositMatchTx`  | `depositMatch(matchId, amount)` | ✅           | 同上                                                                            |
| `useUnbondLpTx`      | `requestUnbond(positionId)`     | ❌           | idle → executing → confirming → success/failed                                  |
| `useWithdrawLpTx`    | `withdraw(positionId)`          | ❌           | 同上                                                                            |

写 hook 统一形态：

```typescript
const { phase, txHash, errorMessage, execute, reset } = useXxxTx(onSuccess);
```

### 事件 watchers

`useLpPositions` 内 3 条 wagmi watcher（全部走 `useCallback` handler）：

| 事件                 | handler                 | 副作用                                                         |
| -------------------- | ----------------------- | -------------------------------------------------------------- |
| `LiquidityDeposited` | `handleDepositedLogs`   | 把新 positionId 加入扫描集合（不等下次 nextLpPositionId 增加） |
| `UnbondRequested`    | `handleStateChangeLogs` | 用户相关时 `refetchPositionData()`                             |
| `LiquidityWithdrawn` | `handleStateChangeLogs` | 用户相关时 `refetchPositionData()`                             |

---

## 6. 自动刷新机制（写 → 链上事件 → UI 同步）

```
用户点击 Withdraw
  → useWithdrawLpTx.execute → wagmi writeContract
  → kuh metamask 签名 → tx 上链
  → useWaitForTransactionReceipt 收到 receipt → isConfirmed = true
  → useEffect 触发 onSuccess: toast + closeModal      ┐
                                                      │ 与下面是并行链路
  → 合约 emit LiquidityWithdrawn                       ┘
  → useLpPositions 的 wagmi watcher 收到 log
  → handleStateChangeLogs 判断 user 相关
  → refetchPositionData() 重新拉 positions + getPositionState
  → React Query 更新 → PositionRow / PositionStatsCards 自动重渲染
  → "Locked" → "Withdrawn"
```

**关键设计**：UI 刷新不依赖 `useLpPositions` 内部计数器或全局 bump store，而是**直接订阅合约事件**。这意味着无论谁触发 withdraw（用户自己 / 后端代用户 / 其他 dApp 同账户操作），UI 都能感知。

---

## 7. 已知陷阱（前端踩过的坑）

### 7.1 ⚠️ `getPositionState` 不读必踩坑

只读 `positions().state`（storage） → Active 到期后不会出现 Ready，Unbonding epoch 满了不会出现 Withdrawable → 用户永远点不到 Unbond/Withdraw 按钮。

**修复**：必须额外调 `getPositionState` 拿 effective state。

### 7.2 ⚠️ `useWatchContractEvent` 的 `onLogs` 必须 `useCallback`

inline arrow function 每次 render 都是新引用 → wagmi 内部 `useEffect` deps 命中 → `unwatch() + watch()` 重建 RPC 订阅 → testnet 限速节点抖动 + 监听空窗期。

**修复**：handler 用 `useCallback`，deps 严格列全。详见 [feedback_wagmi_watcher_onlogs_usecallback](../../.claude/projects/-Users-hang-work-oddfi-frontend/memory/feedback_wagmi_watcher_onlogs_usecallback.md)（个人记忆）。

实证：`hooks/useLpPositions.ts` 的 `handleDepositedLogs` / `handleStateChangeLogs`。

### 7.3 ⚠️ `useWaitForTransactionReceipt.isConfirmed` 长期保持 true，配 inline `onSuccess` 会多次触发

```typescript
// ❌ 错误：一次 withdraw 弹 3 个 toast
useEffect(() => {
  if (isConfirmed) onSuccess?.();
}, [isConfirmed, onSuccess]);
```

成因：tx 上链后 `isConfirmed` 一直为 true；inline `onSuccess` 每次 parent re-render（例如 LiquidityWithdrawn 事件触发 refetch）都是新引用 → effect 反复重跑。

**修复**：用 `txHash` 边沿守卫，同一 hash 只触发一次：

```typescript
const firedForHashRef = useRef<`0x${string}` | undefined>(undefined);
useEffect(() => {
  if (isConfirmed && writeTxHash && firedForHashRef.current !== writeTxHash) {
    firedForHashRef.current = writeTxHash;
    onSuccess?.();
  }
}, [isConfirmed, writeTxHash, onSuccess]);
```

实证：`hooks/useWithdrawLpTx.ts` / `hooks/useUnbondLpTx.ts` 的 `firedForHashRef`。
回归测试：`hooks/useWithdrawLpTx.test.ts` / `useUnbondLpTx.test.ts` 的 "onSuccess 只触发一次" + "reset 后再次允许触发"。

### 7.4 ⚠️ Match Pool unbond 还有 `isMatchTerminal` 隐式校验

合约会校验该 match 所有 market 已终态才允许 unbond。前端目前未读 `BettingPool.isMatchTerminal`，依赖合约 revert 兜底。**风险**：用户点 Unbond → tx 上链 → revert → 钱包扣 gas。
**TODO**：Match Pool 仓位的 Unbond 按钮应额外读 `isMatchTerminal` 做前置 disable。

### 7.5 ⚠️ Position 扫描全量化随 `nextLpPositionId` 膨胀

当前实现把 1~N-1 全部 positions 一次拉回，前端 filter owner。N 上千后单页打开就要拉几十 KB。**未爆，但是定时炸弹**。后续要么走事件回放，要么后端缓存 user→positionIds。

### 7.6 ⚠️ Approve allowance 缓存

`useReadContract({ functionName: 'allowance' })` 默认会缓存。第一次 approve 后立即 deposit 可能拿到旧 allowance。已通过 `handledApproveHashRef` + receipt confirm 后再 trigger deposit 避免，但任何**新增**写 approve→action 链路都要注意。

---

## 8. 测试覆盖

| 文件                                           | 覆盖范围                                                                                |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| `hooks/useLpPositions.test.ts`                 | 仓位扫描 / owner filter / effective state 合并                                          |
| `hooks/useUnbondLpTx.test.ts`                  | 10 用例：状态机 + isAvailable + 4 种 state guard + Pause guard + onSuccess 边沿 + reset |
| `hooks/useWithdrawLpTx.test.ts`                | 9 用例：同上                                                                            |
| `hooks/useDepositGlobalTx.test.ts`             | approve → deposit 双 tx 链路                                                            |
| `components/pools/StatusBadge.test.tsx`        | 12 用例：6 态 × (badge + action)                                                        |
| `components/pools/PositionStatsCards.test.tsx` | 10 用例：4 张统计卡 × 6 态 + 混合场景 + source-level 事件订阅检查                       |
| `stores/lpRefetchStore.test.ts`                | bump 单调递增                                                                           |

---

## 9. 关联文档

- 合约 API 全景: `oddfi-ODD/docs/development/api.md` §8
- 状态机 / 用户故事: `.progress/stash/2026-05-19-lp-7h-position-states-story.md`
- LP 6 态扩展 review: `.progress/reviews/REV-feat-lp-position-states-v1-{memory-leak,quality}.md`
- 跨仓库上下文规则: `.claude/rules/cross-repo-context.md`
- 钱包/链 bug 排查: `.claude/rules/wallet-debug-runbook.md`
