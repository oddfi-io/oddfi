# BettingSettlementModule 实施方案

**状态：** AH 扩盘口、赔率 V2、手动封锁 market、Cash Out 与 claimPayout 模块化本地实现已同步
**日期：** 2026-06-03
**关联架构：** `docs/architecture/2026-04-23-BettingSettlementModule-架构方案.md`

说明：本文已从旧 winningOutcome 结算口径同步为 score-based 目标口径，并补充 Cash Out 与 claimPayout 模块化当前实现。BSC Testnet 已完成当前 ABI live 验收。

## 1. 实施目标

通过“主合约 + 可替换结算模块”的方式压缩 `BettingPool` runtime size：

- 不改变用户主入口；
- 不删除 `claimUSDTReferralRewards(...)`；
- 不删除 UUPS 升级路径；
- 优先迁移结算/退款/瀑布重逻辑。

## 2. 代码结构

当前已新增：

- `src/modules/betting/BettingPoolStorage.sol`
- `src/modules/betting/BettingSettlementModule.sol`
- `src/modules/betting/interfaces/IBettingSettlementModule.sol`

当前已修改：

- `src/modules/betting/BettingPool.sol`

## 3. 主合约需要新增的状态与接口

### 3.1 新状态

- `address public settlementModule`

### 3.2 新治理入口

- `setSettlementModule(address newModule)`

约束：

- `onlyRole(Roles.DEFAULT_ADMIN_ROLE)`
- `newModule != address(0)`
- `newModule.code.length > 0`

### 3.3 新内部 helper

- `_delegateToSettlement(bytes memory data)`

要求：

- 透传 revert reason；
- 不吞掉底层错误。

## 4. 需要迁移的函数

主合约 wrapper 保留：

- `cashOut(...)`
- `claimPayout(...)`
- `settleMarketBetsByScore(...)`
- `finalizeMarketSettlement(...)`
- `refundBets(...)`

模块中实现：

- `cashOut(...)`
- `claimPayout(...)`
- `settleMarketBetsByScore(...)`
- `finalizeMarketSettlement(...)`
- `refundBets(...)`
- Cash Out 计算、风险回滚、提前关闭计数和资金出账
- payout claim、派奖税分发和 taxBuffer 注入
- `_refundBetsInternal(...)`
- score resolver
- `_materializeSettledBet(...)`
- `_applySettlementAccounting(...)`
- `_waterfall(...)`
- `_emitReserveStepAlerts(...)`

## 5. 存储约束

`BettingPoolStorage.sol` 中必须集中定义：

- structs
- state vars
- 共享 internal storage helper（如适合）

禁止：

- 在主合约和模块中复制两份“看起来一样”的状态定义。

## 6. 模块安全约束

### 6.1 onlyDelegateCall

模块业务入口必须带：

- `onlyDelegateCall`

防止用户直接调用模块实现地址。

说明：

- 受该 modifier 保护的是 `cashOut / claimPayout / settleMarketBetsByScore / finalizeMarketSettlement / refundBets` 业务入口；
- 由于模块继承 `BettingPoolStorage`，编译后的 ABI 会包含 inherited getter / AccessControl / Pausable 方法，但这些读取的是模块自身未初始化存储，不作为前后端或后端有效读口径。

### 6.2 入口权限

权限仍放在主合约 wrapper：

- `settleMarketBetsByScore(...)`：`onlyRole(SETTLER_ROLE) + nonReentrant`
- `finalizeMarketSettlement(...)`：`onlyRole(SETTLER_ROLE) + nonReentrant`
- `refundBets(...)`：`onlyRole(SETTLER_ROLE) + nonReentrant`
- `cashOut(...)`：用户入口，`nonReentrant + whenNotPaused`，owner 校验在模块中执行
- `claimPayout(...)`：用户入口，`nonReentrant + whenNotPaused`，owner 和可领取状态校验在模块中执行

结算/退款类 settlement wrapper 不带 `whenNotPaused`；用户主动的 `cashOut / claimPayout` 带 `whenNotPaused`。

模块内部不再重复做角色校验。

## 7. 测试要求

必须补齐或回归以下路径：

1. `settleMarketBetsByScore + finalizeMarketSettlement(marketId,0)` 正常比分分批结算；
2. AH full push / half win / half loss；
3. `finalizeMarketSettlement(marketId,1/2)` 的 `Refunded / Cancelled` 终态标记；
4. `refundBets`；
5. 旧 `settleMarket / settleMarketBets / pushRefundMarket` 从 ABI 删除；
6. `claimPayout` wrapper、派奖税分发、StakingPool notify、TaxBuffer / LP loss offset 注入；
7. L2/L3/L4 瀑布；
8. `onlyDelegateCall` direct call 防护；
9. `setSettlementModule(...)` 切模块后的回归；
10. Cash Out 的公式、锁盘拒绝、quote guard、dust、重复撤出、LP 拉款、全部 Cash Out 后 finalize；
11. 提供 `MAINNET_FORK_RPC_URL` 时主网 fork 套件应全量通过。

## 8. 实施结果

1. 已抽出 `BettingPoolStorage.sol`
2. 已新增 `IBettingSettlementModule.sol`
3. 已新增 `BettingSettlementModule.sol`
4. `BettingPool` 已新增 `settlementModule`
5. `BettingPool` 已新增 `setSettlementModule(...)`
6. `BettingPool` 已新增 `_delegateToSettlement(...)`
7. `cashOut / claimPayout / settleMarketBetsByScore / finalizeMarketSettlement / refundBets` 作为 delegatecall 路由；旧 `settleMarket / settleMarketBets / pushRefundMarket` 已由 AH 扩盘口改造删除
8. 赔率 V2 后，`settleMarketBetsByScore` 的 full push / half win / half loss 退款部分会逐笔释放 market 级 `totalStakedByOutcome` 与 `payoutByOutcome`
9. Cash Out 成功后 bet 进入 `CashedOut`，释放风险账本并通过 `marketPreClosedBetCount` 兼容最终结算
10. 最近一次 Cash Out 本地实现验证：`forge test --no-match-path 'test/Fork*' -vv` 46 passed，fork 测试 37 passed
11. claimPayout 模块化后，当前 `BettingPool` runtime size 为 `22,495 B`，低于 EIP-170 的 `24,576 B` 上限；`BettingSettlementModule` runtime size 为 `14,023 B`

## 9. 成功标准

1. `BettingPool` runtime size 明显下降；
2. 提供 `MAINNET_FORK_RPC_URL` 时主网 fork 测试保持全绿；
3. 对外主路径 ABI 保持可用；
4. AH 扩盘口后，正常结算只保留 score-based 分批入口；
5. 文档和脚本同步完成。
