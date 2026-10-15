# Solidity DDD 映射

**状态：** AH 扩盘口边界、Cash Out、串关 MVP 与 BettingPool 模块化入口壳改造已完成设计
**日期：** 2026-06-08
**基线：** `docs/research/2026-05-24-AH扩盘口最小改造调研.md`、`docs/development/2026-05-24-AH扩盘口比分结算实施方案.md` 与 `docs/research/2026-06-03-CashOut最小实现调研.md`

说明：本文已同步到当前 AH 扩盘口与 score-based 分批结算实现，旧结算 ABI 已删除。Cash Out 已进入当前 ABI；BSC Testnet 已按该 ABI 完成 live 写入验收。串关 MVP 已按 `BettingPool + BettingParlayModule(delegatecall)` 完成实现、ABI 同步、BSC Testnet 原址升级、源码验证和 live 验收。2026-06-08 起目标架构调整为 `BettingPool` 保留 proxy storage、权限、公共 ABI wrapper 和模块地址路由，普通下注、市场、推荐、结算、串关等重逻辑通过独立 module + `delegatecall/staticcall` 执行。

## 1. 聚合根与模块边界

### 1.1 `BettingPool` 是业务主聚合根

当前由 `BettingPool` 持有并主导的领域状态：

- 市场配置与赔率
- 注单
- 用户下注风险账本
- Cash Out 提前结算状态
- 单市场风险暴露
- 结算拆账
- 推荐关系
- 推荐奖励主账
- 平台准备金 / tax buffer / lp loss offset
- 串关注单、串关 leg 快照、串关 synthetic exposure、串关结算状态

因此，下注、结算、推荐奖励、瀑布都以 `BettingPool` 为中心收口。

2026-06-08 模块化入口壳规则：

- `BettingPool` 继续 owner 全部 betting 业务 storage，不把资金或风险账本迁到独立合约；
- `BettingPool` 对外保留用户、运营和治理调用的稳定 ABI；
- 写路径重逻辑优先搬到独立 module，由 `BettingPool` wrapper 通过 `delegatecall` 执行；
- module 不允许独立持有 ODD、独立 owner 用户风险账本或绕过 `BettingPool` 权限 wrapper；
- 只读聚合查询可由 module/lens 通过传入 `BettingPool` proxy 地址直读状态，再由 `BettingPool` 使用 `staticcall` 暴露轻量 wrapper；
- `view` getter 不强制 delegatecall 模块化，因为 Solidity/EVM 的 static 上下文不适合通过 delegatecall 改写为通用只读路由。

### 1.2 `StakingPool` 是质押聚合根

它只 owner 以下状态：

- 质押仓位
- 质押活跃本金
- 质押奖励累加器
- VIP 等级读取

它不再 owner 推荐奖励来源规则。

### 1.3 `LiquidityPool` 是 LP 聚合根

它 owner 以下状态：

- Global / Match Pool
- LP 仓位
- requestable liquidity
- payout window
- L2 loss / margin 会计
- `globalRequestableLiquidity` 和串关 Global LP payout window

它不 owner：

- 推荐关系
- 税收主账
- 平台准备金

### 1.4 `ODDToken` 是来源聚合根，但不是 betting 业务聚合根

当前本地 `ODDToken` 负责：

- ERC20 余额与授权
- pause
- upgrade
- 固定来源分配
- sale / reward / business 来源账本
- 可转余额判断
- 白名单业务入金快照、出金登记、净盈利可转和亏损确认
- DEX launch 与业务净盈利 swap 的一次性放行

它不 owner market、下注、结算、LP、staking、推荐关系等业务状态机。

### 1.5 `BettingParlayModule` 不是独立聚合根

`BettingParlayModule` 当前已实现并部署到 BSC Testnet。它作为 `BettingPool` 的 delegatecall 卫星模块存在，类似当前 `BettingSettlementModule`。

它不 owner 任何独立业务资金或独立风险账本。以下状态仍由 `BettingPool` owner：

- 串关注单
- 串关 leg 快照
- 串关 synthetic exposure
- 串关结算状态
- 串关领取状态
- market final result
- 未结算串关最大赔付占用 `openParlayMaxPayout`
- 串关使用的税务、推荐、用户风险、准备金和瀑布账本

`openParlayMaxPayout` 是风险占用账本，不是独立资金池，不持有 ODD，不改变 `BettingPool` 作为唯一业务聚合根的边界。

`BettingParlayLens.estimateParlayValue` 是只读展示查询，不 owner 任何状态。其返回的 `estimatedValue / floatingPnL` 不进入 `BettingPool` 状态机，不改变 exposure、用户风险账本、税、LP payout window 或 token balance。

它不 owner：

- 单注 market 配置
- 单注下注账本
- `BettingPool` 的 `platformReserve / taxBuffer / lpLossOffsetRemaining`
- `LiquidityPool` 的 match pool 和 payout window
- 推荐关系和推荐奖励主账
- 独立 parlay reserve

## 2. 跨模块调用方向

允许的主方向：

- `BettingPool -> StakingPool.notifyReward`
- `BettingPool -> LiquidityPool.openMatchPool`
- `BettingPool -> LiquidityPool.distributeMargin`
- `BettingPool -> LiquidityPool.distributeLoss`
- `BettingPool -> LiquidityPool.requestPayoutLiquidity`
- `BettingPool -> LiquidityPool.releasePayoutReserve`
- `BettingPool -> LiquidityPool.distributeGlobalMargin / distributeGlobalLoss`（仅用于串关 Global LP 风险）
- `BettingPool -> BettingSettlementModule (delegatecall)`
- `BettingPool -> BettingParlayModule (delegatecall)`
- `BettingPool -> BettingBetModule (delegatecall)`（普通下注写路径）
- `BettingPool -> BettingMarketModule (delegatecall/staticcall)`（开盘、赔率更新、盘口预览、比赛终局查询）
- `BettingPool -> BettingReferralModule (delegatecall)`（推荐绑定、推荐奖励领取）
- `BettingPool -> ODDToken/IODDTokenBusiness` 进行用户入金快照、出金登记和净盈利登记
- `BettingPool -> ODDToken/IERC20` 进行平台储备、池间划转等非用户 outcome 资金路径

禁止的方向：

- `ODDToken` 主动驱动 `BettingPool` 业务状态机
- `StakingPool` 反向修改 `BettingPool` 风控状态
- `LiquidityPool` 反向修改 `BettingPool` 市场状态
- 独立 `ParlayPool` 持有串关资金、独立准备金或独立用户风险账本
- `BettingParlayModule` 直接调用方式写状态；它只能通过 `BettingPool` delegatecall 执行
- `BettingBetModule` 直接调用方式写状态；它只能通过 `BettingPool` delegatecall 执行
- `BettingMarketModule / BettingReferralModule` 直接调用方式写状态；写路径只能通过 `BettingPool` delegatecall 执行
- 串关亏损写入任意单场 Match Pool；跨场串关只能使用 Global LP、`taxBuffer` 和 `platformReserve`
- 串关进入 Cash Out 状态机；不得新增串关提前结算入口或 `CashedOut` 状态

## 3. owner 规则

### 3.1 推荐关系 owner

- 当前 owner：`BettingPool.referrers`
- 不再由 `ODDToken` owner

### 3.2 推荐奖励主账 owner

- 当前 owner：`BettingPool.referrerRewardsOdd`

### 3.3 税收 owner

- 下注税：`BettingPool`
- 派奖税：`BettingPool`
- Token 不持有买卖税逻辑，只持有来源锁仓和可转额度逻辑

### 3.4 准备金与瀑布 owner

- `platformReserve`：`BettingPool`
- `taxBuffer`：`BettingPool`
- `lpLossOffsetRemaining`：`BettingPool`
- L2 实际扣减金额：由 `LiquidityPool` 计算并返回

## 4. 当前对外行为映射

### 4.1 用户视角

- 质押：进 `StakingPool`
- 做市：进 `LiquidityPool`
- 下注：进 `BettingPool`
- 串关下注：进 `BettingPool.placeParlay`
- 串关进行中估值：进 `BettingParlayLens.estimateParlayValue`，仅返回展示字段 `estimatedValue / floatingPnL`
- Cash Out：进 `BettingPool.cashOut`，仅允许 market 为 `Open` 时处理
- 中奖领奖：进 `BettingPool.claimPayout`
- 串关领奖：进 `BettingPool.claimParlayPayout`
- 推荐奖励领奖：进 `BettingPool.claimReferralRewards` 或 `claimUSDTReferralRewards`

### 4.2 治理视角

- 改税、改推荐签名人、加准备金：`BettingPool`
- 设置 USDT 推荐奖励 router/token：`BettingPool`
- 改 treasury / bettingPool 地址：`StakingPool` / `LiquidityPool`
- pause / upgrade：各模块自身
- 正常结算：`getMarketBetIds -> settleMarketBetsByScore -> finalizeMarketSettlement(marketId,0)`，由链上按比分推导 1X2 / AH / OU 结果
- 退款或取消：`finalizeMarketSettlement(marketId,1/2)` 只标记 market 终态，逐笔退款由 `refundBets` 分批完成

## 5. 当前边界结论

如果未来再扩功能，默认遵守以下规则：

1. 新的 betting 业务状态仍由 `BettingPool` owner
2. 新的市场、下注、推荐、结算、串关重逻辑优先落到对应 module，由 `BettingPool` wrapper 路由
3. 新的 LP 会计逻辑优先落在 `LiquidityPool`
4. 不把 betting/staking/liquidity 状态机放回 `ODDToken`；Token 仅维护 ODD 来源、锁仓和可转额度
5. 串关相关下注、风控、结算和领取状态由 `BettingPool` owner，重逻辑放入 `BettingParlayModule`

## 6. LP payout reserve 关闭规则

- `LiquidityPool.distributeLoss / distributeGlobalLoss` 保持当前 booked loss 口径：结算时降低可承保流动性并计入 LP loss；
- `LiquidityPool.requestPayoutLiquidity` 保持当前拉款口径：按实际从 LP 拉走的金额更新 payout window 的 `paidOutAmount`；
- 当运营/keeper 判断某个 `riskId` 下无需继续保留 LP payout reserve 时，可调用 `BettingPool.releasePayoutReserve(riskId)`，由 `BettingPool` 转调 `LiquidityPool.releasePayoutReserve(riskId)` 释放 `reservedAmount - paidOutAmount`；
- 对于用户长期不 claim 的场景，本期采用最小链上改动：不新增 claim 状态机，按产品/运营 claim 窗口由 `SETTLER_ROLE` 手动释放，避免 LP 被无限期锁定；
- `LiquidityPool` 在 reserve、实际拉款和 release 后发出 `PayoutReserveOutstanding(riskId, outstandingAmount)`，后端以该事件索引需要检查和释放的 riskId；
- 本期为最小改动，不新增 LP 存入/解绑限制，不重构 `lossPerPrincipal`；unused reserve 释放按当前 active pool 权重回补为 LP reward，用于冲抵此前 booked loss。
