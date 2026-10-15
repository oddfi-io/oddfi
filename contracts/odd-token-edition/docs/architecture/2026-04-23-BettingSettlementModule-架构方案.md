# BettingSettlementModule 架构方案

**状态：** AH 扩盘口、手动封锁 market、Cash Out 与 claimPayout 模块化本地实现已完成
**日期：** 2026-06-03
**目标：** 压缩 `BettingPool` 运行时代码体积，同时将正常赛果结算、Cash Out 与 claimPayout 重逻辑收敛到模块

说明：本文已同步到 AH 扩盘口当前实现，Solidity 已按 `docs/development/2026-05-24-AH扩盘口比分结算实施方案.md` 收敛为 score-based 结算 ABI。2026-06-02 手动封锁改造已将锁盘重逻辑放入结算模块，通过 `BettingPool` wrapper 对外暴露。2026-06-03 Cash Out 与 claimPayout 模块化已完成，并已在 BSC Testnet 通过当前 ABI live 验收。

## 1. 背景

当前 `BettingPool` 是 OddFi 的主业务聚合根，承担：

- 下单与风控；
- 结算；
- 退款；
- Cash Out；
- 税分发；
- 准备金瀑布；
- 推荐奖励 Claim；
- 管理参数配置。

当前主网部署阻塞点不是产品逻辑错误，而是：

- `BettingPool` 运行时代码超过 EIP-170 上限；
- 必须进一步压缩主合约 runtime size。

## 2. 架构目标

在不改变以下对外业务事实的前提下压缩体积：

- `BettingPool` 仍然是前后端唯一主入口；
- `claimUSDTReferralRewards(...)` 保持在 `BettingPool`；
- `claimPayout(...)` 作为用户主路径仍由 `BettingPool` 暴露入口，但派奖、税分发和拉款重逻辑进入模块；
- `BettingPool` 仍然保持 UUPS 可升级；
- 用户路径方法签名尽量不变；
- 跨模块账本 owner 关系不变。
- Cash Out 和 claimPayout 作为用户主路径由 `BettingPool` 暴露入口，但计算和账务重逻辑不进入主合约。

## 3. 方案 A：主合约 + 可替换结算模块

### 3.1 核心思路

保留：

- `BettingPool` 作为 proxy 主入口；
- `BettingPool` 保留用户主路径与治理主路径；

当前已新增：

- `BettingSettlementModule` 独立实现合约；
- `BettingPool` 持有 `address public settlementModule`；
- 通过 `delegatecall` 将结算相关重逻辑委派到模块中执行。

### 3.2 为什么不用模块 proxy

不采用：

- `BettingPool(proxy) -> delegatecall -> SettlementModule(proxy)` 的双层代理结构。

原因：

- 调用链更复杂；
- 排查和审计更困难；
- 收益不明显。

采用：

- `BettingPool(proxy)` 持有一个可替换的模块实现地址；
- 升级模块时，直接部署新模块实现并通过治理更新 `settlementModule`。

从效果上，这仍满足“模块逻辑可升级”。

## 4. 模块边界

### 4.1 当前已迁入 `BettingSettlementModule` 的函数

当前已迁移结算/退款/瀑布这一组重逻辑：

- `lockMarket`
- `settleMarketBetsByScore`
- `finalizeMarketSettlement`
- `refundBets`
- `cashOut`
- `claimPayout`
- `_refundBetsInternal`
- score-based settlement resolver
- Cash Out 计算、风险回滚和资金出账
- payout claim、派奖税分发和 taxBuffer 注入
- `_materializeSettledBet`
- `_applySettlementAccounting`
- `_distributePayoutTax`
- `_injectTaxBuffer`
- `_waterfall`
- `_emitReserveStepAlerts`

当前仍留在 `BettingPool` 主合约的相关逻辑：

- 下注、推荐奖励 Claim、USDT 推荐奖励 Claim、治理与读接口。

### 4.2 保留在 `BettingPool` 的函数

继续留在主合约：

- `placeBet`
- `previewSignal`
- `claimReferralRewards`
- `claimUSDTReferralRewards`
- `bindReferrer`
- 参数治理入口
- pause / upgrade 相关函数
- 读接口

## 5. 存储设计

### 5.1 共享存储基类

必须抽出共享存储基类，例如：

- `BettingPoolStorage.sol`

主合约和模块都继承同一份存储定义，确保：

- slot 顺序一致；
- struct 定义一致；
- helper 读取语义一致。

### 5.2 为什么不能复制状态定义

如果模块手写一份“看起来相同”的状态定义，风险极高：

- 极易出现 slot 漂移；
- delegatecall 下会直接破坏主合约状态。

## 6. delegatecall 约束

### 6.1 主合约侧

主合约 wrapper 当前负责：

- `settleMarketBetsByScore(...)`：`onlyRole(Roles.SETTLER_ROLE) + nonReentrant`；
- `finalizeMarketSettlement(...)`：`onlyRole(Roles.SETTLER_ROLE) + nonReentrant`；
- `refundBets(...)`：`onlyRole(Roles.SETTLER_ROLE) + nonReentrant`；
- `cashOut(...)`：用户入口，`nonReentrant + whenNotPaused`，仅允许 bet owner 提前结算；
- `claimPayout(...)`：用户入口，`nonReentrant + whenNotPaused`，仅允许胜单 owner 领奖；
- settlement wrapper 当前都不带 `whenNotPaused`；
- `_delegateToSettlement(data)`；

且 `_delegateToSettlement(...)` 必须透传底层 revert data，不能只 `require(ok)`。

### 6.2 模块侧

模块业务入口需要增加 `onlyDelegateCall` 防护，阻止被直接作为普通业务入口调用：

- 直接调用 `settleMarketBetsByScore / finalizeMarketSettlement / refundBets / cashOut / claimPayout` 应直接 revert；
- 只允许作为 `BettingPool` 的委派实现执行。
- 因模块继承 `BettingPoolStorage`，ABI 中仍会出现 inherited getter / AccessControl / Pausable 方法；这些方法读取的是模块自身未初始化存储，不作为有效业务读口径。

## 7. 升级模型

### 7.1 主合约升级

保持现状：

- `BettingPool` 继续 UUPS upgradeable。

### 7.2 模块升级

新增治理入口：

- `setSettlementModule(address newModule)`

要求：

- 仅 `DEFAULT_ADMIN_ROLE` 可调用；
- 不能设置为 `0`；
- 必须校验 `newModule.code.length > 0`；
- 文档与部署脚本必须同步更新模块地址。

## 8. 风险

该方案可行，但不属于“零风险改造”。

主要风险：

1. 存储布局不一致；
2. 模块地址配置错误；
3. delegatecall 下模块 bug 直接影响主合约状态；
4. 升级后主合约与模块版本不兼容；
5. 测试覆盖不足导致结算路径回归。

## 9. 验收标准

方案实施后必须满足：

1. `BettingPool` 对外主 ABI 不破坏用户主路径；
2. 正常赛果结算只保留 score-based 分批入口；
3. 旧 `settleMarket / settleMarketBets / pushRefundMarket` 从 ABI 删除；
4. `finalizeMarketSettlement(marketId, resultKindRaw)` 能统一收口 `Settled / Refunded / Cancelled`；
5. AH full push / half win / half loss 的资金拆分由模块完成；
6. 主网 fork 全量测试通过；
7. `BettingPool` runtime size 明显下降；
8. 模块地址可替换；
9. `claimUSDTReferralRewards(...)` 与升级能力保持不变；
10. `lockMarket(marketId)` 可由运营在比赛结束前手动封锁单个 market，且不引入按 match 无界遍历；
11. Cash Out 只允许 `Open` market；手动封锁 `Locked` 后用户不能提前撤出，只能等待最终结算或退款；
12. Cash Out 后的提前终态注单不应导致 `finalizeMarketSettlement` 卡死；
13. 文档、脚本、测试同步完成。
