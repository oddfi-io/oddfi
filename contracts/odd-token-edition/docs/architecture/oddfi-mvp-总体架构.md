# OddFi 当前总体架构

**状态：** AH 扩盘口、手动封锁 market、Cash Out、串关 MVP、BettingPool 模块化入口壳、ODDToken 锁仓与来源账本 MVP 已完成并部署到 BSC Testnet
**日期：** 2026-06-12
**基线：** `docs/research/2026-05-24-AH扩盘口最小改造调研.md`、`docs/development/2026-05-24-AH扩盘口比分结算实施方案.md`、`docs/research/2026-06-03-CashOut最小实现调研.md` 与 `docs/architecture/2026-06-12-ODDToken锁仓与发售MVP架构补充.md`

说明：本文已同步到当前 AH 扩盘口与 score-based 分批结算实现，旧结算 ABI 已删除；2026-06-02 起锁盘语义已调整为后端手动封锁，移除开赛前 5 分钟自动锁盘。2026-06-03 已完成 Cash Out 与 claimPayout 模块化实现，并已在 BSC Testnet 通过当前 ABI live 验收。2026-06-07 串关 MVP 已按 `BettingPool + BettingParlayModule(delegatecall)` 兼容方案完成 BSC Testnet 原址升级、源码验证和 live 验收，并已补充 LP payout reserve 残留事件索引与最小手动释放入口。2026-06-08 起目标结构调整为 `BettingPool` 入口壳：公共 ABI 和 storage 仍在 `BettingPool`，普通下注、市场、推荐、结算、串关等重逻辑分散到独立 module 并通过 `delegatecall/staticcall` 执行。2026-06-12 起 `ODDToken` 按锁仓与发售 MVP 扩展为来源与转账限制聚合根，`TierSale / EcosystemRewards / HouseVault / DexLaunchController / DexLpLocker` 已随全量新部署发布到 BSC Testnet；`Betting / Staking / Liquidity` 已按最小变更接入 Token 业务来源接口，真实链上验收已覆盖主业务流程。

## 1. 当前系统概览

当前核心系统由 15 个已实现业务/辅助合约组成：

1. `ODDToken`
2. `StakingPool`
3. `LiquidityPool`
4. `BettingPool`
5. `BettingSettlementModule`
6. `BettingBetModule`
7. `BettingMarketModule`
8. `BettingReferralModule`
9. `BettingParlayModule`
10. `BettingParlayLens`
11. `TierSale`
12. `HouseVault`
13. `DexLaunchController`
14. `DexLpLocker`
15. `EcosystemRewards`

`BettingBetModule / BettingMarketModule / BettingReferralModule / BettingParlayModule / BettingSettlementModule` 同类，作为 `BettingPool` 的卫星模块承载普通下注、市场、推荐、串关和结算重逻辑；注单、串关注单、synthetic exposure、税、推荐、用户风险、LP 瀑布和准备金仍写入 `BettingPool` proxy storage，不新增独立资金池或独立账本。`BettingParlayLens` 只读提供 `previewParlay` 与 `estimateParlayValue`。

与早期方案相比，当前最关键的架构变化是：

- `ODDToken` 不再是 betting 业务中心，但已扩展为 ODD 来源与转账限制聚合根；
- `BettingPool` 成为主要业务聚合根；
- 推荐关系、推荐奖励、税、结算、瀑布全部收口到 `BettingPool`；
- `BettingPool` 对外 ABI 保持主入口角色，内部通过 module 地址路由重逻辑，避免主合约 runtime size 被业务增长挤爆；
- `StakingPool` 与 `LiquidityPool` 分别只维护本模块账本，不反向 owner 业务主状态。

---

## 2. 当前模块职责

## 2.1 `ODDToken`

当前本地职责：

- ERC20 标准余额与授权；
- pause / unpause；
- UUPS 升级；
- 初始化时固定总量 mint 到 `address(this)`；
- 固定来源初始分配；
- sale / reward / business 来源账本；
- 销售和奖励解锁曲线；
- 白名单业务入金快照、出金登记、净盈利可转和亏损确认；
- DEX launch 与业务净盈利 swap 一次性放行。

当前不负责：

- 交易税；
- 推荐关系本身；
- 赔率、赛果、Cash Out、串关、LP 瀑布和 staking 奖励公式；
- 管理员任意转移用户余额。

### 为什么这样设计

- Token 只 owner 用户 ODD 来源和可转额度，不 owner betting/staking/liquidity 状态机；
- 既有业务合约通过最小接入提交业务 ID、实际入金、实际出金和终态标记，不复制锁仓算法；
- 赔率、结算、税、推荐关系、LP 和 staking 仍保持在各自模块内。

## 2.2 `StakingPool`

当前职责：

- 质押建仓；
- 奖励累加器；
- 正常解押；
- 提前解押；
- VIP 等级读取。

当前收口：

- `notifyReward` 只接受 `BettingPool`；
- 推荐奖励自动建仓接口已从当前 ABI 删除。

### 为什么这样设计

- 质押模块只保留“仓位 + 收益”的最小边界；
- 推荐奖励逻辑已经不再属于质押模块。

## 2.3 `LiquidityPool`

当前职责：

- Global Pool / Match Pool 存入；
- Match Pool 生命周期；
- Margin 分配；
- Loss 分摊；
- requestable liquidity；
- payout window；
- LP unbond / withdraw。
- payout reserve 残留事件索引与释放。

### 当前实现特点

- 仍保留 `rewardPerWeight / lossPerPrincipal` 字段名；
- 但 Global Pool 新存入已经按本金口径运行；
- `distributeLoss` 会回传 L2 实际承担量。
- 已为串关新增 `globalRequestableLiquidity / distributeGlobalMargin / distributeGlobalLoss`，让跨场串关只使用 Global LP，不污染任意单场 Match Pool。
- 已为普通单注 `matchId` 与串关 `parlayRiskId` 新增 `PayoutReserveOutstanding(riskId,outstandingAmount)`，后端可据此索引 residual；`BettingPool.releasePayoutReserve(riskId)` 可在运营确认后释放 `reservedAmount - paidOutAmount` 回 LP。

## 2.4 `BettingPool`

当前职责：

- 市场创建与赔率更新；
- 后端手动封锁 market；
- 下单与风控；
- Cash Out 主入口与注单终态；
- 注单主账；
- 结算主入口与模块路由；
- 胜单单笔领奖；
- 推荐关系与推荐奖励主账；
- ODD 推荐奖励直领；
- USDT 推荐奖励签名领取；
- score-based 正常赛果结算；
- 四层瀑布；

### 为什么这样设计

- 当前所有强业务耦合逻辑都围绕“下注 -> 结算 -> 赔付 -> 税 -> 推荐奖励 -> 瀑布”展开；
- 这些逻辑必须在一个聚合根里闭合，否则账很容易散掉。
- 当前将重结算逻辑通过 `delegatecall` 委派给 `BettingSettlementModule`，但对外主入口仍保持在 `BettingPool`。

## 2.5 `BettingSettlementModule`

当前职责：

- `settleMarketBetsByScore`
- `finalizeMarketSettlement`
- `refundBets`
- Cash Out
- `claimPayout`
- 结算/退款/Cash Out/claimPayout/瀑布内部重逻辑

### 为什么这样设计

- 这组逻辑是 `BettingPool` 中最重的体积来源；
- 通过可替换模块地址 + `delegatecall` 保持主入口不变，同时压缩 `BettingPool` runtime size；
- 所有业务状态仍然保存在 `BettingPool` proxy 的 storage 中。
- 正常赛果结算通过 `settleMarketBetsByScore + finalizeMarketSettlement(marketId,0)` 分批处理，避免单笔交易无界遍历全部注单，并由链上统一推导 1X2 / AH / OU 的胜负、Push、半赢和半输。

## 2.6 `BettingBetModule`

当前职责：

- 普通单注 `placeBet` 写路径；
- quote guard 校验后的成交、下注税、推荐税分配；
- 用户日限额、未结算本金、单 market 潜在赔付风控账本更新；
- market `S_i/P_i` 暴露更新、赔率刷新和下注事件。

当前边界：

- 只允许由 `BettingPool` wrapper 通过 `delegatecall` 执行；
- 不独立持有 ODD，不独立 owner `bets / userRiskLedger / marketExposure`；
- `BettingPool` 保留 public ABI、`nonReentrant`、`whenNotPaused` 和模块地址配置；
- 只读 preview/getter 可继续在 `BettingPool` 或 Lens 中保留，不强制通过 delegatecall。

## 2.7 `BettingMarketModule`

当前职责：

- `openMarket / updateOdds` 写路径；
- `previewSignal / isMatchTerminal` 只读计算；
- market 初始化、odds/exposure 初始化、赔率刷新。

当前边界：

- 写路径只允许由 `BettingPool` wrapper 通过 `delegatecall` 执行；
- 只读路径由 `BettingPool` wrapper 通过 `staticcall` 传入真实 `BettingPool` proxy 地址查询；
- 不独立 owner market、odds、exposure 或 match pool 状态。

## 2.8 `BettingReferralModule`

当前职责：

- 显式推荐绑定；
- ODD 推荐奖励领取；
- USDT 推荐奖励签名校验、nonce 消耗和 swap 出账。

当前边界：

- 只允许由 `BettingPool` wrapper 通过 `delegatecall` 执行；
- 资产、推荐关系和推荐奖励账本仍归 `BettingPool` proxy storage；
- 不作为前端或后端直连写入口。

## 2.9 `BettingParlayModule` 与 `BettingParlayLens`

当前职责：

- `2串1` 到 `6串1` 串关注单；
- 同场禁止串关；
- 串关总赔率 `200x` 封顶；
- 单张串关最高赔付 `30,000 ODD`；
- 通过 synthetic exposure 将串关风险写入底层 leg market 的 `P_i`，不把串关本金写入 `S_i`；
- 通过 `openParlayMaxPayout` 记录未结算串关最大赔付占用，防止跨场串关重复复用同一份 Global LP / reserve 容量；
- 复用 `BettingPool` 的下注税、派奖税、推荐奖励、VIP 日限额和未结算仓位；
- 复用 `BettingPool` 的 L2/L3/L4 瀑布；
- 根据 `BettingPool` 持久化的 market final result 结算串关；
- 用户通过 `BettingPool.claimParlayPayout` 领取串关派奖。
- 通过只读 `BettingParlayLens.estimateParlayValue(bettingPool,user,parlayId)` 返回未结算串关的进行中展示估值 `estimatedValue` 与浮动盈亏 `floatingPnL`。
- 通过 `BettingSettlementModule.getClaimStatus(bettingPool,user,betId)` 和
  `BettingParlayModule.getParlayClaimStatus(bettingPool,user,parlayId)` 提供赛后可领取净额查询；两者均为任何人可调用的直连只读接口，通过传入的 `BettingPool` proxy 读取真实状态，不读取模块自身 storage。

当前边界：

- 不作为独立 UUPS proxy 或独立资金池；
- 不新增 `parlayReserve`；
- 不新增独立用户风险账本；
- 串关资金进入 `BettingPool`；
- `openParlayMaxPayout` 只是 `BettingPool` 内的风险占用账本，不持有资金，不是独立准备金；
- 串关亏损通过每张串关的 `parlayRiskId` 走 Global LP 专属 payout window，不归属任何单场 Match Pool；
- 禁止串关 Cash Out，不设计、不预留、不暴露提前结算入口；
- `estimatedValue` 仅为展示估值，不是 `claimablePayout`、可提现金额或提前结算报价；
- 本期不支持串关部分成交。

## 3. 当前资金流

## 3.0A Market 手动封锁边界

当前目标语义为：

- market 创建后默认为 `Open`；
- 若后端未调用手动封锁方法，用户可在 `block.timestamp < matchEndTime` 的任意时间下注；
- 后端可在 `block.timestamp <= matchEndTime` 时调用 `BettingPool.lockMarket(marketId)` 主动封锁单个 market；
- 手动封锁后 market 进入 `Locked`，禁止下注、预览、赔率更新和 Cash Out；
- 手动封锁不改变赛后结算路径，比赛结束后仍通过 `settleMarketBetsByScore -> finalizeMarketSettlement(marketId,0)` 完成正常结算。

为避免链上无界遍历，本架构不提供按 `matchId` 一次性封锁所有 market 的入口；后端如需整场封锁，应逐个 market 调用。

## 3.1 下单资金流

用户在 `BettingPool.placeBet(...)` 时：

1. 支付 `acceptedAmount + betTax`；
2. `acceptedAmount` 留在 `BettingPool` 账本中作为注码；
3. `betTax`：
   - 有推荐人时，累积进 `referrerRewardsOdd`；
   - 无推荐人时，直接转平台金库。

## 3.2 胜单领奖资金流

用户在 `BettingPool.claimPayout(...)` 时：

1. 计算 `grossPayout`；
2. 按 bet 在 `settle` 时锁定的税率快照计算 `taxAmount`；
3. 若池内 ODD 不够，则向 `LiquidityPool.requestPayoutLiquidity(...)` 拉赔付流动性；
4. 派奖税拆成：
   - 质押池份额；
   - taxBuffer 份额；
   - 平台份额；
   - 推荐奖励份额；
5. 用户拿到净额 ODD。

## 3.2A Cash Out 提前结算资金流

Cash Out 是当前本地已实现路径。用户在 `BettingPool.cashOut(...)` 时：

1. 只能处理自己名下 `Pending` 注单；
2. market 必须仍为 `Open`，且 `block.timestamp < matchEndTime`；
3. 若 market 已被 `lockMarket` 手动封锁，Cash Out 必须失败，用户只能等待最终结算或退款；
4. 合约读取该 outcome 当前 `quotedOdds`，按 `remainingStake * lockedOdds / quotedOdds * (1 - feeBps)` 计算返还额；
5. 成功后该 bet 进入 `CashedOut` 终态，并释放对应 `S_i/P_i` 与用户未结算风险；
6. 若返还额低于剩余本金，差额留在 `BettingPool` 并记入 `platformReserve`；
7. 若返还额高于剩余本金，超出部分按现有 L2 -> L3 -> L4 瀑布承担，L2 booked loss 会通过 `LiquidityPool.requestPayoutLiquidity(...)` 拉取已预留赔付流动性；
8. Cash Out 不回滚用户当日 `dailyAcceptedAmount`，避免通过反复下注与撤出绕过每日限额。

## 3.3 推荐奖励资金流

推荐奖励首先都累计为 ODD：

- 下单 betTax；
- 派奖税中的推荐人份额。

领取时有两条路径：

### 路径 A：ODD 直领

- `claimReferralRewards(uint256 oddAmount)`
- 直接从 `BettingPool` 转 ODD 给用户

### 路径 B：USDT 领取

- `claimUSDTReferralRewards(...)`
- 先校验后台签名；
- 使用当前全部 `referrerRewardsOdd[msg.sender]` 做 ODD -> USDT；
- 通过治理配置的 Pancake V3 Router 与 USDT token 直接把 USDT 打给用户；
- 合约以用户 USDT 余额前后差额作为真实到账量。

## 3.4 瀑布资金流

当前顺序：

1. L1：输家筹码天然抵扣；
2. L2：`LiquidityPool.distributeLoss`；
3. L3：`taxBuffer`；
4. L4：`platformReserve`。

当 L4 被消耗时：

- 发 `ReserveTapped`；
- 过阶梯时发 `ReserveStepAlert`；
- 低于 `BettingConstants.EMERGENCY_FLOOR` 时发 `ReserveBelowFloor` 并 pause。

---

## 4. 当前状态 owner 边界

### 4.1 `BettingPool` owner 的状态

- 推荐关系
- 推荐奖励主账
- 市场配置 / 赔率
- 注单
- 用户风险账本
- 平台准备金
- taxBuffer
- lpLossOffsetRemaining
- Cash Out 提前关闭计数

### 4.2 `StakingPool` owner 的状态

- 质押仓位
- 活跃本金
- 奖励累加器
- VIP 读取依据

### 4.3 `LiquidityPool` owner 的状态

- LP 仓位
- Pool 主账
- payout window
- requestable liquidity
- L2 会计

### 4.4 `ODDToken` owner 的状态

- 只有 ERC20 自身余额状态和 pause/upgrade

---

## 5. 当前跨模块调用边界

允许的主方向：

- `BettingPool -> StakingPool.notifyReward`
- `BettingPool -> LiquidityPool.openMatchPool`
- `BettingPool -> LiquidityPool.closeMatchPoolDeposit`
- `BettingPool -> LiquidityPool.distributeMargin`
- `BettingPool -> LiquidityPool.distributeLoss`
- `BettingPool -> LiquidityPool.requestPayoutLiquidity`
- `BettingPool -> BettingSettlementModule (delegatecall)`

当前不再允许的旧方向：

- `ODDToken -> StakingPool` 做推荐奖励自动建仓
- `ODDToken -> BettingPool` 主动推业务税
- `StakingPool` 或 `LiquidityPool` 反向 owner `BettingPool` 业务主账

---

## 6. 当前权限模型

统一角色：

- `DEFAULT_ADMIN_ROLE`
- `UPGRADER_ROLE`
- `PAUSER_ROLE`
- `SETTLER_ROLE`
- `OPERATOR_ROLE`
- `KEEPER_ROLE`

模块特有限制：

- `StakingPool.notifyReward`：只认 `bettingPool`
- `LiquidityPool` 的关键结算函数：只认 `bettingPool`
- `BettingPool` 的市场创建 / 赔率更新：`OPERATOR_ROLE`
- `BettingPool.settleMarketBetsByScore / finalizeMarketSettlement / refundBets`：`SETTLER_ROLE`
- `BettingPool.cashOut(...)`：用户自助入口，仅允许 bet owner 调用，且受 `nonReentrant + whenNotPaused` 保护
- `BettingPool.claimPayout(...)`：用户自助入口，仅允许胜单 owner 调用，且受 `nonReentrant + whenNotPaused` 保护

当前治理可调的重要业务参数包括：

- `StakingPool`：最小质押量、VIP 门槛、VIP 每日限额
- `LiquidityPool`：最小存入量、解绑等待 Epoch 数
- `BettingPool`：下注税、派奖税、信号灯 WCL 阈值、LP Margin 分成比例、推荐奖励签名配置

---

## 7. 当前部署与升级口径

- 静态部署记录已经从 `docs/` 中移除；
- 部署与升级统一以仓库 `script/` 下脚本为准；
- 文档层只保留结构、接口和当前进度说明；
- 当前真实状态统一看：
  - `docs/progress/当前开发现状.md`

---

## 8. 当前架构结论

当前代码架构已经清晰收敛为：

- Token 极简；
- Betting 主中心；
- Staking 只管质押；
- Liquidity 只管 LP；
- 推荐奖励先 ODD 记账，再按 ODD 或 USDT 分支领取。
