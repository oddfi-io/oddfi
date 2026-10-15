# BettingPool 开发现状

**更新日期：** 2026-04-01
**负责人：** Hawk

---

## 当前状态：可编译，核心逻辑已对齐文档

合约 `src/core/BettingPool.sol` 使用 `forge build --via-ir` 可正常编译（solc 0.8.28, OZ v5）。

---

## 已完成模块

| 模块 | 状态 | 说明 |
|------|------|------|
| Storage 布局 | ✅ 完成 | 与 6.1 规范一致，27 个 slot，顺序固定 |
| initialize() | ✅ 完成 | `__Pausable_init()` + 三参数地址验证 |
| creditDeposit() | ✅ 完成 | 包含 txHash 去重、余额不变量校验 |
| withdraw() | ✅ 完成 | 小额直接到账，大额进审核队列 |
| executeLargeWithdrawal() | ✅ 完成 | 24h 等待期验证 |
| rejectLargeWithdrawal() | ✅ 完成 | 等待期内拒绝，余额退回 |
| openMarket / closeMarket | ✅ 完成 | 含 TooManyMarkets 上限检查 |
| batchOpenMarkets / batchCloseMarkets | ✅ 完成 | 批量盘口管理 |
| reopenMarket() | ✅ 完成 | 仅 onlyMultisig |
| lockBet() | ✅ 完成 | 红灯、流动性、全局上限校验 |
| lockCreditBet() | ✅ 完成 | 抵押校验、信用比例、Pool 出资 |
| lockParlay() | ✅ 完成 | 赔率连乘、赛事去重、maxPayout 校验 |
| unlockBet() | ✅ 完成 | 联动取消信用子注单，干净退回出资 |
| unlockParlay() | ✅ 完成 | 全腿未结算时可取消 |
| updateSignal() / isAccepting() | ✅ 完成 | 信号灯读写 |
| settle() | ✅ 完成 | 分批支持、首批存 marketOutcome、逐注幂等 |
| _settleNormalBet() | ✅ 完成 | 赢家利润入账，输家 70/30 分配 |
| _settleParlayLeg() | ✅ 完成 | 输腿即整串 Lost，剩余腿 Cancelled |
| _finalizeParlayWin() | ✅ 完成 | 全腿赢/已取消时结算串关 |
| _settleCreditBet() | ✅ 完成（已修复） | 见下方修复说明 |
| releaseOrForfeiture() | ✅ 完成 | 冻结赔付三路径（Won/Lost/Cancelled）|
| cancelMatch() | ✅ 完成 | 普通/信用/串关腿分路处理 |
| _cancelCreditBet() | ✅ 完成 | 安全 collateralUsed 递减（underflow 保护） |
| _cancelParlayLeg() | ✅ 完成 | 含步骤 9 自动结算检查 |
| batchCancelMatch() | ✅ 完成 | 批量赛事取消 |
| addLiquidity() | ✅ 完成 | MIN_LP_DEPOSIT 防护，SharesIsZero 校验 |
| removeLiquidity() | ✅ 完成 | availableLiquidity 防挤兑 |
| withdrawPlatform() | ✅ 完成 | 多签，platformBalance 校验 |
| setMaxMarketsPerMatch / setRedLightThreshold | ✅ 完成 | 多签配置 |
| setAdmin / setLpShareBps | ✅ 完成 | 多签，lpShareBps 范围 5000-9000 |
| pause() / unpause() | ✅ 完成 | 多签紧急暂停 |

---

## 代码审查修复记录（2026-04-01）

### 修复 1：`_settleCreditBet` 抵押仓位已取消分支 `bet.status` 错误

**问题：** 当抵押仓位状态为 `Cancelled` 时，代码在分支入口处统一设 `bet.status = BetStatus.Cancelled`，但随后 emit 事件却传 `Won`/`Lost`，状态与事件不一致。规范 6.6 明确说明"本注单按普通注单规则独立结算"，信用注单自身应根据赢/输设为 `Won` 或 `Lost`。

**修复：** 移除入口处的 `bet.status = Cancelled`，改为在 `if (betWon)` 分支内设 `Won`，在 `else` 分支内设 `Lost`。

### 修复 2：移除未使用的 `SettlementLib` import

**问题：** `BettingPool.sol` 导入了 `SettlementLib`，但所有结算逻辑已内联实现，未调用任何 `SettlementLib` 函数。

**修复：** 删除该 import 语句。

---

## 安全审查修复记录（2026-04-01，Task #4）

| 编号 | 说明 | 状态 |
|------|------|------|
| M-01 | _settleNormalBet / _settleParlayLeg 70/30 分配改用减法避免精度丢失 | ✅ 已修复 |
| M-02 | addLiquidity() CEI 违规：safeTransferFrom 移至状态更新之后 | ✅ 已修复 |
| M-05 | withdrawPlatform() 添加 nonReentrant 修饰符 | ✅ 已修复 |
| M-06 | 添加 uint256[50] private __gap 支持升级扩展 | ✅ 已修复 |
| L-01 | 移除未使用的 ParlayLib、LendingLib import（已内联实现） | ✅ 已修复 |
| L-02 | settle() 添加 winningOutcome 范围校验（X12: 0-2, AH/OU: 0-1） | ✅ 已修复 |
| L-03 | 串关输球时剩余腿 cancelledLegs 不递增（正确，只有 cancelMatch 递增） | ✅ 已验证（无需修改） |
| C-01 | ReentrancyGuard 非升级版（误报，OZ v5 使用 ERC7201 StorageSlot） | ✅ 确认为误报 |
| H-01 | releaseOrForfeiture onlyAdmin（符合规范 6.6，Jason 后端运营调用） | ✅ 确认为误报 |
| H-02 | __UUPSUpgradeable_init 缺失（OZ v5 无此函数） | ✅ 确认为误报 |

Foundry 测试：198 tests passed, 0 failed（forge test -vv）

## 已知待处理事项

| 项目 | 优先级 | 说明 |
|------|--------|------|
| `SettlementLib.sol` | 低 | 该库目前未被调用，可保留备用或删除文件 |
| BSC fork 集成测试 | 高 | Task #5，待执行 |

---

## 会计不变量（任意时刻）

```
usdt.balanceOf(address(this)) >= 
    totalUserBalances + bettingPool + platformBalance + 
    totalPendingWithdrawals + totalCreditOutstanding
```
