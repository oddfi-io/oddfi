# ODDToken 锁仓与发售 MVP 实施方案

**日期：** 2026-06-12
**状态：** 已完成开发、BNB mainnet fork、BSC Testnet 全量新部署、源码验证和真实链上 live 验收；剩余仅为协议时间锁等待项
**范围：** ODDToken 锁仓/来源账本、公平发售、DEX 建池锚点、奖励 claim、业务合约最小接入
**设计原则：** `ODDToken` 可以完整扩展；除 Token 外，既有业务合约原则上只做最小接入改动。

## 0. 产品覆盖审查结论

本实施方案以 `docs/product/ODD代币合约需求文档.docx` 为产品基线。当前覆盖结论：

- 代币基础参数、五类分配、TierSale、DEX 建池、销售/奖励解锁、HouseVault、treasury sink、48 小时 Timelock、角色、部署 gate、业务来源快照、净盈利可转、亏损确认、事件和 view 均已映射到开发任务；
- `ODDToken` 是本需求的主要改造面，可以新增 storage、接口、转账限制、来源账本和配套源发放能力；
- `BettingPool / BettingBetModule / BettingSettlementModule / BettingParlayModule / BettingReferralModule / StakingPool / LiquidityPool` 只能做最小必要改动：替换 Token 资金入口/出口、提前生成业务 ID、校验 treasury sink、补必要事件/测试，不得重写现有业务状态机；
- 新增 `TierSale / HouseVault / DexLaunchController / EcosystemRewards / DexLpLocker` 属于新配套合约，不计入“既有合约最小改动”限制，但仍需保持职责单一。

## 1. 关联文档

- `docs/product/ODD代币合约需求文档.docx`
- `docs/architecture/2026-06-12-ODDToken锁仓与发售MVP架构补充.md`
- `docs/development/2026-04-22-ODDToken-当前实现.md`
- `docs/development/2026-04-22-BettingPool-当前实现.md`
- `docs/development/2026-04-22-StakingPool-当前实现.md`
- `docs/development/2026-04-22-LiquidityPool-当前实现.md`
- `docs/testing/2026-06-12-ODDToken锁仓与发售MVP全量场景测试方案.md`

## 2. 当前代码约束

当前代码事实：

- `ODDToken` 已从纯 ERC20 扩展为锁仓与来源账本核心；
- `ODDToken.initialize(address adminTimelock, address pauser)` 直接 mint 全量给 `address(this)`；
- `Roles.sol` 已新增本需求所需的新角色；
- `IODDTokenBusiness` 已新增业务来源接口；
- `BettingPool / StakingPool / LiquidityPool` 入金已改为调用 `ODDToken.consumeBusinessInflow`；
- 普通单注、串关、质押、LP 仓位已通过 Token 侧业务快照记录来源，不在业务合约内复制来源锁仓账本；
- `BettingPool` 当前推荐奖励 USDT swap 已使用 Pancake V3 Router `exactInputSingle` 和 `referralSwapPoolFee`；仓库中 Pancake V2 Router 仅出现在 fork/test 脚本的 WBNB -> USDT 测试资金准备路径，不属于 `BettingPool` 生产 swap 逻辑；
- `TierSale / HouseVault / DexLaunchController / EcosystemRewards / DexLpLocker` 已新增本地主干实现；`OpsTreasuryVault` 仍按默认方案使用 TimelockController，不新增自定义合约；
- 测试 helper 已完成 `ODDToken.initialize(adminTimelock,pauser)` 签名兼容，并已通过 `OddMvpTestBootstrap` 将旧非 fork 测试迁移到 fixed sources / treasury sink / whitelist 初始化口径；
- `DeployAll / DeployBscTestnet` 已改造成完整 MVP 新发售/配套合约部署流，本地已通过编译；BNB mainnet fork 已通过；2026-06-12 已完成 BSC Testnet 全量新部署、源码验证和真实链上 live 验收。

因此本需求仍不是小型配置变更，而是一次 Token 侧新系统开发 + 配套合约新增 + 既有业务合约最小适配。当前已完成 Token 核心第一段、配套合约主干、LP NFT 强制锁定和 `Betting / Staking / Liquidity` 最小代码接入；普通单注、串关、推荐 ODD/USDT、Staking、Liquidity 主路径已有 `test/OddMvpBusinessIntegration.t.sol` 覆盖，ODDToken 专项 fuzz、本地 E2E、对抗性测试和场景矩阵已补齐，非 fork 业务矩阵已通过 96/96，BNB mainnet fork suite 已通过 37/37，fork 脚本完整流程也已通过。MVP 全量新部署脚本已补齐；BSC Testnet 升级/live 验证尚未完成；Slither 已执行但结果非 0，High/Medium 已按类别记录豁免，审计前仍需复核。

本轮修复必须补齐上一轮审查发现的可执行性缺口：DEX launch 使用量必须精确等于 TierSale 已批准额度，剩余 ODD / USDT 等任意资产只能回 treasury sink，LP NFT 释放目标必须等于锁定 beneficiary，EcosystemRewards 总预算必须硬限制在 15,000,000 ODD，BettingPool / StakingPool 的平台金库更新必须校验 ODDToken treasury sink，推荐 USDT swap 配置必须强制提供 expected V3 pool，部署脚本必须部署并配置 TierSale / HouseVault / DexLaunchController / EcosystemRewards / DexLpLocker 的 MVP 拓扑。

## 3. 非目标

- 不改下注赔率、WCL、Cash Out、串关结算、LP 瀑布和质押收益公式；
- 不把来源锁仓算法复制到 Betting / Staking / Liquidity 合约；
- 不为普通单注、串关、质押、LP 新建第二套业务状态机；
- 不在业务合约内实现多签；
- 不支持旧 ODD proxy 原址迁移作为 MVP 默认方案；
- 不允许 DEX Pair / V3 Pool / Router / PositionManager 进入普通白名单；
- 不允许用户普通 `transfer / transferFrom` 直接转入白名单业务合约。
- 不在 `ODDToken` 内置交易税、黑名单或管理员任意转移用户余额的能力。

## 4. 新增角色

在 `src/shared/access/Roles.sol` 增加：

```solidity
bytes32 internal constant WHITELIST_ADMIN_ROLE = keccak256("WHITELIST_ADMIN_ROLE");
bytes32 internal constant HOUSEVAULT_MANAGER_ROLE = keccak256("HOUSEVAULT_MANAGER_ROLE");
bytes32 internal constant DEX_LAUNCHER_ROLE = keccak256("DEX_LAUNCHER_ROLE");
bytes32 internal constant SALE_ADMIN_ROLE = keccak256("SALE_ADMIN_ROLE");
bytes32 internal constant REWARD_DISTRIBUTOR_ROLE = keccak256("REWARD_DISTRIBUTOR_ROLE");
```

授权建议：

| 角色 | 持有者 |
| --- | --- |
| `DEFAULT_ADMIN_ROLE` | adminTimelock |
| `UPGRADER_ROLE` | adminTimelock |
| `WHITELIST_ADMIN_ROLE` | adminTimelock |
| `SALE_ADMIN_ROLE` | adminTimelock 或 TierSale 管理合约 |
| `REWARD_DISTRIBUTOR_ROLE` | adminTimelock 或奖励运营合约 |
| `HOUSEVAULT_MANAGER_ROLE` | adminTimelock |
| `DEX_LAUNCHER_ROLE` | DexLaunchController，必要时 timelock |
| `PAUSER_ROLE` | 应急多签 |

`adminTimelock` 必须使用最小 48 小时延迟。多签只作为 Timelock proposer / canceller；`PAUSER_ROLE` 是唯一允许由应急多签直接持有、不经过 48 小时时间锁的角色。

## 5. Token storage 设计

`ODDToken` 新增 storage 建议：

```solidity
struct FixedSources {
    address tierSale;
    address houseVault;
    address dexLaunchController;
    address ecosystemRewards;
    address opsTreasury;
}

struct SourceAccount {
    uint256 salePrincipalRemaining;
    uint256 rewardPrincipalRemaining;
    uint256 businessLockedRemaining;
}

struct SourceBreakdown {
    uint256 saleLocked;
    uint256 rewardLocked;
    uint256 businessLocked;
    uint256 transferable;
}

struct BusinessSnapshot {
    address user;
    address businessContract;
    uint16 businessType;
    bytes32 rawId;
    uint64 createdAt;
    uint64 finalizedAt;
    uint256 businessIn;
    uint256 totalBusinessOut;
    uint256 principalReturned;
    uint256 profitRecognized;
    uint256 lossRecognized;
    bool finalized;
    SourceBreakdown sourceIn;
}
```

核心状态：

```solidity
FixedSources private _fixedSources;
uint64 public poolLaunchTime;
bool public fixedSourcesConfigured;
bool public initialSupplyAllocated;
uint256 public dexLiquidityTransferableAllocation;

mapping(address => bool) public whitelist;
mapping(address => bool) public treasurySink;
mapping(address => bool) public dexRestrictedTarget;
mapping(address => SourceAccount) private _sources;
mapping(bytes32 => BusinessSnapshot) private _businessSnapshots;
```

`__gap` 需要按实际新增 slot 数减少。由于 MVP 默认全量重新部署，不需要兼容旧 proxy storage；但仍应保留 upgradeable gap。

字段命名可以与上表等价，但必须覆盖产品文档要求的 `saleLockedRemaining / rewardLockedRemaining / businessReturnLockedRemaining / dexLiquidityTransferableAllocation / poolLaunchTime / whitelist / treasurySink / fixed source / business snapshot / lossRecognized` 能力。若采用 `SourceAccount` 等内部命名，必须在 view 方法中按产品语义暴露。

`dexRestrictedTarget` 用于记录不得被加入普通业务白名单的 DEX 相关地址，包括 PancakeSwap V3 Router、NonfungiblePositionManager、已创建或复用的 V3 Pool，以及部署/治理显式登记的聚合器或旧 V2 Pair / Router。该列表不是交易黑名单；它只用于防止这些地址被误加入 `whitelist`，并作为受控 DEX launch / referral USDT swap 的目标校验。

## 6. Token 初始化与分配

新签名：

```solidity
function initialize(address adminTimelock, address pauser) external initializer;
```

初始化规则：

1. 校验 `adminTimelock != address(0)`、`pauser != address(0)`；
2. 初始化 ERC20 / Pausable / AccessControl / UUPS / ReentrancyGuard；
3. 给 `adminTimelock` 授予治理与配置角色；
4. 给 `pauser` 授予 `PAUSER_ROLE`；
5. 将固定总量 mint 到 `address(this)`；
6. 发出 `TokenInitialized(adminTimelock, pauser, totalSupply)`。

代币基础参数必须固定为：

| 参数 | 值 |
| --- | --- |
| name | `OddFi` |
| symbol | `ODD` |
| chain / standard | `BSC` / `BEP-20 compatible` |
| decimals | `18` |
| totalSupply | `100,000,000 ether` |

合约不得保留任何对外 `mint` 入口。除初始化铸造外，不允许任何协议级增发。

部署后配置：

```solidity
function setFixedSourceContracts(FixedSources calldata sources) external onlyRole(WHITELIST_ADMIN_ROLE);
function setWhitelist(address account, bool allowed) external onlyRole(WHITELIST_ADMIN_ROLE);
function setTreasurySink(address account, bool allowed) external onlyRole(WHITELIST_ADMIN_ROLE);
function setDexRestrictedTarget(address account, bool restricted) external onlyRole(WHITELIST_ADMIN_ROLE);
function allocateInitialSupply() external onlyRole(WHITELIST_ADMIN_ROLE) nonReentrant;
```

`allocateInitialSupply` 只能调用一次，按 30% / 25% / 10% / 15% / 20% 从 `ODDToken` 自身转出到五类接收地址。

精确分配表：

| 接收方 | 占比 | 数量 |
| --- | --- | --- |
| TierSale | 30% | `30,000,000 ether` |
| HouseVault | 25% | `25,000,000 ether` |
| DexLaunchController | 10% | `10,000,000 ether` |
| EcosystemRewards | 15% | `15,000,000 ether` |
| OpsTreasuryVault 或 TimelockController | 20% | `20,000,000 ether` |

配置约束：

- `setFixedSourceContracts` 在 `allocateInitialSupply` 前完成，地址均必须非零；
- 除明确允许的 Timelock / treasury 接收方外，固定来源和白名单地址必须 `account.code.length > 0`；
- `setWhitelist` 不允许普通 EOA，且 `dexRestrictedTarget[account] == true` 时必须 revert；
- PancakeSwap V3 Router、NonfungiblePositionManager、V3 Pool、已知 V2 Pair / Router 和聚合器地址必须先通过 `setDexRestrictedTarget` 或部署脚本登记，部署 gate 必须断言这些地址没有进入 `whitelist`；
- `setWhitelist` 批量配置时必须有长度上限，建议单次 `<= 32`；
- `setTreasurySink` 批量配置时必须有长度上限，建议单次 `<= 16`；
- `OpsTreasuryVault` 若直接使用 OpenZeppelin `TimelockController`，部署脚本必须校验 `minDelay >= 48 hours`；
- 开放 sale、bet、stake、LP deposit 或 DEX launch 前，部署脚本必须断言固定来源、白名单、treasury sink、初始分配全部完成。

## 7. 转账限制

`_update(from,to,value)` 规则：

1. pause 时所有 transfer / transferFrom / burn 停止；
2. mint 只允许初始化路径；
3. 用户普通转入 `whitelist[to] == true` 必须 revert；
4. 用户转非白名单、DEX Pair 或 V3 Pool 时，`value <= transferableBalance(from)`；
5. `treasurySink[from]` 向外转账视为平台自有可转余额；
6. `whitelist[from] -> treasurySink[to]` 为平台路径，不登记用户锁仓；
7. `whitelist[from] -> 普通用户` 必须通过业务结果接口或 sale/reward 专用发放接口；普通 transfer 不得直接向用户出账；
8. `treasurySink[from] -> whitelist[to]`、`HouseVault -> whitelist` 是平台注资路径，可用受控普通转账，不登记用户业务快照；
9. DexLaunchController 建池路径不依赖把 Router / V3 Pool / PositionManager 加入白名单。

由于业务入口、销售发放、奖励发放、业务出金、初始分配和 DEX launch 都需要触发内部转账，Token 必须实现受控转账上下文，而不是在 `_update` 中写一个永久豁免。建议使用 `enum TransferContext { None, InitialAllocation, SaleDistribution, RewardDistribution, BusinessInflow, BusinessOutcome, BusinessProfit, DexLaunch, BusinessProfitSwap, HouseVaultGovernance }` 或等价方案；只有扩展接口内部执行单次 `_transfer` 时临时进入上下文，转账完成后立即恢复为 `None`。上下文打开期间不得执行外部调用，避免重入时继承 bypass。

普通 `transfer / transferFrom` 仍必须走完整锁仓校验。`consumeBusinessInflow`、`registerBusinessOutcomeDelta`、`registerBusinessProfitAndTransfer`、销售/奖励发放和初始分配使用内部受控转账；DexLaunchController 和 BettingPool 推荐奖励 USDT claim 这种必须被 Pancake V3 外部合约 `transferFrom` 拉币的路径，必须通过专用一次性额度实现，不能把 DEX Router、V3 Pool 或 PositionManager 加入 `whitelist`。

`burn(uint256 amount)` 规则：

- 只允许持有人销毁自身余额；
- pause 状态下不可执行；
- 不启用协议级强制销毁；
- 允许销毁锁定来源，但必须按 `businessLocked -> saleLocked -> rewardLocked -> transferable` 顺序同步扣减来源账本。

直接 `transfer(address(0), amount)` 不作为业务 burn 入口；实现可直接 revert 或统一引导到 `burn`。

## 8. 来源消耗与业务接口

新增接口建议放在 `src/modules/token/interfaces/IODDTokenBusiness.sol`：

```solidity
interface IODDTokenBusiness {
    function distributeSalePurchase(address user, uint256 amount) external;
    function reclaimSalePurchase(address user, uint256 amount) external;
    function distributeRewardClaim(address user, uint256 amount) external;

    function consumeBusinessInflow(
        address user,
        uint16 businessType,
        bytes32 rawId,
        uint256 amount
    ) external returns (bytes32 businessId);

    function registerBusinessOutcomeDelta(
        address user,
        bytes32 businessId,
        uint256 businessOutDelta,
        bool finalized
    ) external;

    function registerBusinessProfitAndTransfer(
        address user,
        uint16 businessType,
        bytes32 rawId,
        uint256 amount
    ) external returns (bytes32 businessId);

    function registerBusinessProfitForDexSwap(
        address user,
        uint16 businessType,
        bytes32 rawId,
        uint256 amount,
        address routerOrSpender,
        address expectedPoolOrTarget
    ) external returns (bytes32 businessId);

    function markDexPoolLaunched(uint64 launchTime) external;
}
```

`distributeSalePurchase` 和 `distributeRewardClaim` 是产品允许的“固定来源发放”接口，命名可等价：

- `distributeSalePurchase` 只能由已登记 `tierSale` 调用，从 TierSale 持有的 ODD 转给用户并增加用户 `saleLockedRemaining`；
- `reclaimSalePurchase` 只能由已登记 `tierSale` 调用，用于 sale cancel/refund 时在用户授权后收回仍可交回的销售来源 ODD，并扣减用户 `saleLockedRemaining`；
- `distributeRewardClaim` 只能由已登记 `ecosystemRewards` 调用，从 EcosystemRewards 持有的 ODD 转给用户并增加用户 `rewardLockedRemaining`；
- 两者均必须发事件，并记录发放 nonce 或关联 ID，便于前端和索引器对账；
- 两者不经过业务 `businessIn/businessOut` 快照，不登记为业务净盈利。

### 8.1 `consumeBusinessInflow`

规则：

- 只允许 `whitelist[msg.sender] == true`；
- `businessId = keccak256(abi.encode(msg.sender,businessType,rawId))`；
- 同一 `businessId` 不得重复创建；
- `amount > 0`；
- 按 `businessLocked -> saleLocked -> rewardLocked -> transferable` 顺序生成来源快照；
- 使用 `_spendAllowance(user,msg.sender,amount)` 消耗授权；
- 内部 `_transfer(user,msg.sender,amount)` 搬运资金；
- 记录 `businessIn = amount`。

### 8.2 `registerBusinessOutcomeDelta`

规则：

- 只允许创建该 snapshot 的业务合约调用；
- `businessOutDelta` 为用户本次实际收到的 ODD；
- Token 累计 `totalBusinessOut += businessOutDelta`；
- Token 根据累计值推导：
  - `profitDelta = max(totalBusinessOut - businessIn, 0) - profitRecognized`
  - `principalDelta = businessOutDelta - profitDelta`
  - 若 `finalized == true`，`loss = businessIn - min(totalBusinessOut,businessIn)`
- finalized 时必须计算 `lossDelta = loss - lossRecognized`，写入 `lossRecognized`，并在事件中暴露；
- 本金还原必须按累计比例计算：先得到新的 `principalReturnedTotal = min(totalBusinessOut,businessIn)`，再用 `principalDelta = principalReturnedTotal - principalReturned` 从 snapshot 的 `sourceIn` 中按比例释放本次新增本金来源；
- 净盈利不增加任何锁定来源；
- finalized 后不得再次登记 outcome；
- 方法内部从业务合约转账给用户，保证“登记金额 = 实际到账金额”。

`businessOutDelta == 0 && finalized == true` 必须允许，用于全输、LP 仓位清零、串关全输等没有用户出金但需要确认亏损的终态。`businessOutDelta == 0 && finalized == false` 应 revert，避免无意义事件。

本方案选择产品文档允许的“合并版本”：业务合约只提交实际到账 `businessOutDelta` 和终态标记；Token 由 snapshot 推导并在事件中发出 `principalReturnedDelta / lossDelta / profitDelta`。业务合约不得在本地复制来源拆分算法。

### 8.3 `registerBusinessProfitAndTransfer`

用于无用户入金的业务净收益，例如 BettingPool 推荐奖励 claim。规则：

- 只允许白名单业务合约调用；
- 直接从业务合约转账给用户；
- 不增加用户锁定来源；
- 生成独立 businessId 和事件，便于索引。

### 8.4 `registerBusinessProfitForDexSwap`

用于已确认属于用户净收益、但用户选择直接换成 USDT 等外部资产的路径，MVP 必须覆盖 `BettingPool.claimUSDTReferralRewards`。规则：

- 只允许白名单业务合约调用；
- 仅登记业务净收益已被用户消费，不增加用户锁定来源；
- `routerOrSpender` 和 `expectedPoolOrTarget` 必须已登记为 `dexRestrictedTarget`，且不得是普通业务白名单；
- Token 为 `msg.sender` 记录一次性 `businessProfitSwapAllowance[routerOrSpender][expectedPoolOrTarget] += amount` 或等价账本；
- 后续 Pancake V3 Router / PositionManager 对白名单业务合约执行 `transferFrom` 时，Token 在 `transferFrom` 中识别 `from == 业务合约`、`msg.sender == routerOrSpender`、`to == expectedPoolOrTarget`，扣减该一次性额度后放行；
- 额度只能用于已登记净收益金额，不能消费用户锁定本金或业务合约其他余额；
- swap 完成或失败后，业务合约必须清理外部 ERC20 approve；Token 侧未使用额度必须可由业务合约或治理清零；
- 必须发 `BusinessProfitSwapped` 或等价事件，字段包含 `businessId / user / businessContract / amount / routerOrSpender / expectedPoolOrTarget`。

该接口只解决“用户净收益直接换 USDT”的业务路径，不得作为普通业务合约绕过转账限制的通用 DEX 出口。

### 8.5 事件与审计视图

所有状态变更必须发事件。Token 至少覆盖：

- `FixedSourcesConfigured`、`InitialSupplyAllocated`；
- `WhitelistUpdated`、`TreasurySinkUpdated`、`DexRestrictedTargetUpdated`；
- `SalePurchaseDistributed`、`RewardClaimDistributed`；
- `BusinessInflowConsumed`；
- `BusinessOutcomeRegistered`，字段必须包含 `businessId / user / businessContract / businessOutDelta / principalReturnedDelta / lossDelta / profitDelta / totalBusinessOut / finalized`；
- `BusinessProfitTransferred`；
- `BusinessProfitSwapped`；
- `DexPoolLaunchMarked`；
- `SourceBurned`。

业务 snapshot view 必须返回累计状态，不要求链上保存每一次 outcome delta 数组。历史 delta 使用事件索引，storage 只保存当前累计值，避免无上限链上数组。

## 9. 解锁计算

`transferableBalance(account)`：

```text
balanceOf(account) - currentLockedBalance(account)
```

`currentLockedBalance` 包括：

- 销售剩余本金中按 29 天阶梯尚未解锁的部分；
- 奖励剩余本金中按 180 天线性尚未解锁的部分；
- `businessLockedRemaining` 中尚未解锁的部分。

标准业务回款不新增 `businessLockedRemaining`。该字段仅保留给治理批准的保守锁定或兼容路径；MVP 主路径缺少拆分数据时应 revert。

销售解锁公式：

```text
d = floor((block.timestamp - poolLaunchTime) / 1 days) + 1
d clamped to [0, 29]
saleUnlockedRatio = d * (d + 1) / 870
```

`poolLaunchTime == 0` 时销售解锁比例恒为 0；`d >= 29` 后销售锁定全部解锁。解锁计算只能依赖 `poolLaunchTime`、`block.timestamp` 和账户来源账本，不接受任何用户传入的时间或比例参数。Solidity 整数除法向下取整，预览和转账校验必须使用同一套计算函数。

奖励解锁公式：

```text
rewardUnlockedRatio = min((block.timestamp - poolLaunchTime) / 180 days, 1)
```

`poolLaunchTime == 0` 时奖励解锁比例恒为 0；多笔奖励领取共享同一全局曲线，不按批次单独计时。

必须提供 view：

- `transferableBalanceOf(address account)`；
- `lockedBalanceOf(address account)`；
- `sourceBalanceOf(address account)` 返回销售、奖励、业务锁定和可转拆分；
- `businessSnapshotOf(bytes32 businessId)`；
- `businessLossOf(bytes32 businessId)` 或在 `businessSnapshotOf` 中暴露 `lossRecognized`；
- `previewSaleUnlock(address account)`；
- `previewRewardUnlock(address account)`；
- `isWhitelist(address account)`；
- `isTreasurySink(address account)`；
- `isDexRestrictedTarget(address account)`；
- 固定来源地址读取。

## 10. 新增配套合约

### 10.1 `TierSale`

职责：

- 10 档固定价格售卖；
- 每档 `3,000,000 ODD`；
- 第 N 档价格为 `N * 0.01 USDT`，N 为 1 到 10；
- USDT 地址必须非零且有合约代码；价格计算必须按 USDT `decimals()` 或部署时固定的 USDT 精度换算，不能写死未经校验的精度假设；
- 跨档购买必须按实际跨越档位拆分计价并一次性结算；
- 请求购买量超过全池剩余量必须 revert，不做部分成交；
- USDT 收款；
- USDT 募资售罄或治理人工确认前不得任意提款、approve 或转出；
- 单地址购买上限 MVP 默认 `cap = 0`，但保留 Timelock 可配置参数；
- `previewBuy / previewTier / getCurrentTier / getRemainingByTier / saleStartTime / soldOut / soldOutTime` 必须可读，其中 `previewBuy(amount)` 返回本次跨档购买需要支付的 USDT 金额；
- `startSale / pauseSale / resumeSale / closeSale / cancelSale / forceFinalize / approveLaunch` 或等价 `approveUSDTForLaunch`；
- `startSale()` 只允许设置一次，以调用时 `block.timestamp` 作为 `saleStartTime`；
- 购买时调用 Token 的销售发放接口，将 ODD 转给用户并登记 sale source；
- 售罄或 forceFinalize 后只允许进入退款或 DEX launch 路径；
- `cancelSale` 后只能走用户退款和治理明确的未售 ODD 处理路径，不能继续购买或建池；
- `cancelSale` 后的用户退款必须以用户交回对应销售 ODD 为前提：用户调用 refund 时，TierSale / ODDToken 校验并收回或 burn 对应 `saleLockedRemaining`，再按该笔 purchase 实付 USDT 退款；
- 当前本地实现采用 `refundPurchase(purchaseId, oddAmount)`：用户先授权 TierSale，TierSale 调用 `ODDToken.reclaimSalePurchase(user, oddAmount)` 收回 ODD 并扣减 sale source，再按该笔 purchase 剩余未退 USDT 与本次交回 ODD 比例退款；
- 若用户已把销售 ODD 用于下注、质押、LP 或 burn 且余额/销售来源不足，合约不得无条件退还 USDT，也不得通过管理员任意转移用户余额追回 ODD；该用户只能退还仍可交回的部分或由治理走链下/额外补偿流程；
- 因此若产品要求“取消销售时所有买家无条件全额 USDT 退款”，则必须在 launch/cancel 决策前关闭 bet / stake / LP 等业务入口；若业务入口已开放，则产品必须接受按可交回 ODD 退款的链上规则；
- 每笔购买、退款、取消、forceFinalize 和 launch approve 均必须发事件；
- forceFinalize 必须记录 `forceFinalizeTime`、确认参与建池的 USDT 数量、确认参与建池的 ODD 数量和治理执行人。

### 10.2 `DexLaunchController`

职责：

- 拉取 TierSale 中确认参与建池的 USDT；
- 使用自身持有的 10,000,000 ODD 建池；
- 10,000,000 ODD 在 Token 侧登记为 `dexLiquidityTransferableAllocation` 或等价一次性建池额度；
- 建池目标固定为 PancakeSwap V3，不使用 PancakeSwap V2 Pair / Router；
- 使用 PancakeSwap V3 Factory / NonfungiblePositionManager 创建或复用 ODD/USDT pool，并通过治理配置 `poolFee`、初始价格、tick range、deadline 和最小入池数量；
- DexLaunchController 创建或确认 V3 Pool 后，必须在 Token 中把 NonfungiblePositionManager、V3 Router 和目标 V3 Pool 登记为 `dexRestrictedTarget`，防止进入普通白名单；
- Pancake V3 mint 时 ODD 通常由 NonfungiblePositionManager 通过 `transferFrom(DexLaunchController,V3Pool,amount)` 拉取，Token 必须在 `transferFrom` 中识别 `from == fixedSources.dexLaunchController`、`msg.sender == configuredNonfungiblePositionManager`、`to == configuredV3Pool`，扣减 `dexLiquidityTransferableAllocation` 后放行；
- DexLaunchController 直接向普通用户、普通 EOA、未登记 DEX target 或任意非 treasury sink 地址转出 ODD 必须失败；建池后未使用的 ODD 只能退回 treasury sink；
- 校验售罄或 forceFinalize；
- 校验实际建池资产与产品确定的经济下限；
- 满额销售建池时应使用 `1,650,000 USDT + 10,000,000 ODD`，初始价格锚点为 `$0.165`；非满额 forceFinalize 建池必须按实际资产入池并发事件；
- 锁定 PancakeSwap V3 LP NFT / position token 12 个月；
- LP NFT / position token 进入锁仓合约，不销毁；
- LP NFT locker 地址、tokenId、锁定期和解锁时间必须发事件并可查询；
- 成功后调用 `ODDToken.markDexPoolLaunched(uint64 launchTime)`；
- 剩余 ODD / USDT 退回 treasury sink。

当前本地主干实现：

- `launch` 使用 PancakeSwap V3 `NonfungiblePositionManager.createAndInitializePoolIfNecessary` 与 `mint`；
- launch 前校验 TierSale 的 `launchApproval()`，并要求批准 spender 为 DexLaunchController 自身；
- launch 入参的 ODD / USDT desired 数量必须分别等于 `launchApproval()` 已批准数量；不得以小于批准额度的 desired 发起建池；
- launch 时把 PositionManager 和实际 pool 登记为 ODDToken `dexRestrictedTarget`，再配置 `setDexLaunchTransferTarget(positionManager,pool)`；
- LP NFT recipient 为 `DexLpLocker`，launch 后立即调用 locker 记录 `tokenId / unlockAt / beneficiary`，到期前不能释放；
- `sweepRemainder` 允许 launch 后扫尾，所有 token 都只能扫回 ODDToken 登记的 treasury sink。

### 10.2.1 `DexLpLocker`

职责：

- 接收并持有 PancakeSwap V3 LP NFT / position token；
- 只允许授权的 `DEX_LAUNCHER_ROLE` 登记锁定；
- `lockPosition(tokenId,unlockAt)` 要求 locker 当前持有该 tokenId，且 `unlockAt > block.timestamp`；
- `releasePosition(tokenId,to)` 只能在 `block.timestamp >= unlockAt` 后执行；
- `releasePosition(tokenId,to)` 的 `to` 必须等于该 tokenId 锁定记录中的 `beneficiary`；
- 释放前不得销毁或转出 LP NFT；
- 默认 beneficiary 为 treasury sink 或治理确定的接收地址；
- 不参与 ODD 来源账本、建池参数或做市资金计算。

### 10.3 `EcosystemRewards`

职责：

- `REWARD_DISTRIBUTOR_ROLE` 创建用户可领取额度；
- 用户 claim 时间不受限制；claim 时从合约转出 ODD 并登记 reward source；
- 单池覆盖质押、金库 LP、推广三类奖励来源；
- 支持由 Timelock 治理调整三类奖励预算或分配比例，`allocated + claimed` 不得超过合约可用奖励额度；
- 不在本合约内实现质押/LP/推广复杂公式，MVP 只保存可领取余额、类别、claim nonce 和累计已分配/已领取；
- 创建可领取额度、取消可领取额度、claim 均必须发事件；
- 必须提供用户 claimable、类别累计、剩余额度和奖励解锁预览相关 view。

当前本地主干实现：

- `setCategoryBudget` 配置类别预算；
- `createClaimable / cancelClaimable / claim` 覆盖预算、可领取额度、取消和 claim 主路径；
- 类别预算总和与累计分配都必须受 15,000,000 ODD 总池上限约束；
- claim 时调用 `ODDToken.distributeRewardClaim` 登记 reward source。

### 10.4 `HouseVault`

职责：

- 持有 25% 储备；
- 只允许 timelock 管理划转至白名单合约或 treasury sink；
- 不直接向普通用户、DEX Pair、V3 Pool、DEX Router、PositionManager 出账。
- 不接管当前 BettingPool / LiquidityPool 结算路径；
- 未来如需增厚赔付深度，只能经 Timelock 向 BettingPool 平台准备金、LiquidityPool 协议自有 LP 或其他白名单合约划转。

当前本地主干实现：

- `transferOdd(to,amount)` 只允许 `HOUSEVAULT_MANAGER_ROLE`；
- 目标必须是 ODDToken 白名单业务合约或 treasury sink；
- 若目标是 DEX restricted target，直接 revert。
- `fundBettingPlatformReserve(bettingPool,amount)` 只允许 `HOUSEVAULT_MANAGER_ROLE`；
- 该专用入口向 BettingPool 一次性 approve 后调用 `BettingPool.addPlatformReserve(amount)`，由 BettingPool 从 HouseVault 拉取 ODD 并同步增加 `platformReserve / accountedBalance`；
- 普通 `transferOdd(BettingPool,amount)` 只改变 BettingPool 余额，不进入 L4 平台准备金账本。

### 10.5 `OpsTreasuryVault`

MVP 默认方案：

- 直接使用 OpenZeppelin `TimelockController` 作为 20% 运营金库接收方；
- 只有在部署或运营确实需要额外封装时，才实现一个极薄 `OpsTreasuryVault`，并且只允许 timelock 调用转账。

推荐优先使用 `TimelockController`，减少自定义金库代码。无论采用哪一种，运营金库对外划转必须经过最小 48 小时时间锁；Safe 只能作为 proposer / canceller，不得直接持有 20% 运营金库 ODD。

## 11. 既有业务合约最小改动

既有业务合约允许的改动范围：

- 将 `IERC20 oddToken` 的局部调用替换为兼容 `IERC20 + IODDTokenBusiness` 的接口；
- 在资金入口前生成或固定现有业务 ID；
- 将用户入金 `safeTransferFrom` 替换为 `consumeBusinessInflow`；
- 将用户出金 `safeTransfer` 替换为 `registerBusinessOutcomeDelta` 或 `registerBusinessProfitAndTransfer`；
- 平台储备注资、白名单合约之间的池间划转、白名单合约向 treasury sink 出账保持受控普通 ERC20 转账，不登记用户 outcome；
- 在 `setPlatformTreasury` 等配置入口增加 `treasurySink` 校验；
- 补充必要事件、测试和错误。

既有业务合约禁止的改动范围：

- 不新增第二套来源锁仓 storage；
- 不重写下注、串关、质押、LP、Cash Out、settlement、withdraw 状态机；
- 不改变现有对外主 ABI，除非是新增只读校验或治理配置所必需；
- 不改变现有税率、赔率、VIP、LP 瀑布、payout window、staking reward 计算公式；
- 不把 TierSale / EcosystemRewards 的职责塞进 BettingPool / StakingPool / LiquidityPool。

### 11.1 BettingBetModule

当前入金：

```solidity
oddToken.safeTransferFrom(msg.sender, address(this), totalDeduct);
```

改为：

```solidity
businessId = oddToken.consumeBusinessInflow(msg.sender, BET_SINGLE, betId, totalDeduct);
```

最小必要改动：

- 在资金转入前确定 `betId`；
- 把 `betId` 传入记录函数，避免记录函数内部再生成不同 ID；
- 保持原下注风控、下注税、exposure 和赔率刷新逻辑不变。

### 11.2 BettingSettlementModule

需要替换用户回款路径：

- `claimPayout`：`businessOutDelta = netPayout`，`finalized = true`；
- `refundBets`：部分退款 `finalized = bet 已全额退款`；
- `cashOut`：`businessOutDelta = cashOutAmount`，`finalized = true`；
- score settlement 中的 push / half refund：按是否终态决定 finalized。
- full loss 或结算后无任何用户出金的注单：必须调用 `registerBusinessOutcomeDelta(user,businessId,0,true)` 确认亏损。

平台税、staking share、taxBuffer、platformReserve、LP payout liquidity 路径不登记为用户 outcome。

### 11.3 BettingParlayModule

入金：

- `businessType = BET_PARLAY`；
- `rawId = parlayId`；
- `businessIn = stake + betTax`。
- 当前代码在扣款后生成 `parlayId`，接入时必须提前生成 `parlayId` 再调用 `consumeBusinessInflow`，其余串关风控和腿部记录流程不变。

出金：

- refundable claim：`businessOutDelta = refundAmount`；
- won claim：`businessOutDelta = netPayout`；
- `finalized = true`。
- full loss 串关在 settle 时必须调用 `registerBusinessOutcomeDelta(user,businessId,0,true)` 确认亏损。

串关 Cash Out 仍禁止，不新增提前结算入口。

### 11.4 StakingPool

入金：

- `businessType = STAKING_POSITION`；
- `rawId = bytes32(positionId)`；
- `businessIn = principal`。

出金：

- 正常 `unstake`：`businessOutDelta = principal + pendingReward`，`finalized = true`；
- `earlyUnstake`：`businessOutDelta = principal`，`finalized = true`；
- 被重分配或回收的 pending reward 不登记为该用户 outcome。

### 11.5 LiquidityPool

入金：

- `businessType = LP_POSITION`；
- `rawId = bytes32(positionId)`；
- `businessIn = principal`。

出金：

- `withdraw`：`businessOutDelta = withdrawAmount`，`finalized = true`；
- LP 亏损由 `withdrawAmount < principal` 自动体现；
- 仓位被清零或 liquidated 时，必须调用 `registerBusinessOutcomeDelta(user,businessId,0,true)` 确认亏损；
- `requestPayoutLiquidity` 是池间资金划转，不登记用户 outcome。

### 11.6 BettingReferralModule

`claimReferralRewards` 改为调用 `registerBusinessProfitAndTransfer`，使推荐奖励明确登记为业务净收益且可转。

`claimUSDTReferralRewards` 保持 Pancake V3 Router `exactInputSingle + referralSwapPoolFee` 的生产路径，但不得依赖把 Router / V3 Pool 加入普通白名单。最小改动为：

- 在消耗 `referrerRewardsOdd[user]` 后，先调用 `registerBusinessProfitForDexSwap(user, REFERRAL_REWARD, claimRawId, oddAmount, referralSwapRouter, expectedOddUsdtPool)`；
- Token 记录该笔净收益被用户选择用于 USDT swap，并为 `referralSwapRouter -> expectedOddUsdtPool` 开一次性额度；
- `BettingReferralLib.executeUsdtSwap` 继续执行 V3 `exactInputSingle`，swap 后清零 ERC20 approve；
- 两参数版 `setReferralSwapConfig(router,usdt)` 不得再生成可 claim 配置；生产和测试必须使用三参数版 `setReferralSwapConfig(router,usdt,expectedPool)`；
- 如果 Router 实际拉币目标不是预期 V3 Pool，Token transferFrom 必须 revert，避免用推荐奖励 swap allowance 绕过锁仓限制；
- 该路径不增加用户 ODD 锁定来源，也不把 USDT 结果写入 ODD 来源账本。

### 11.7 Treasury sink 配置接入

`BettingPool.setPlatformTreasury`、`StakingPool.setPlatformTreasury` 等现有平台收款地址配置入口需要增加最小校验：

- 新地址必须已在 `ODDToken.treasurySink` 中登记；
- 未登记时 revert；
- 不改变原权限模型和事件语义。

该改动是为了满足产品文档中“platformTreasury / OpsTreasuryVault / TimelockController 必须写入 treasury sink”的部署 gate，不属于业务状态机重写。

### 11.8 平台储备与池间划转路径

以下现有路径不是用户业务入金/出金，不接入 `businessId`：

- `BettingPool.addPlatformReserve`；
- `BettingPool -> StakingPool` 的 staking share / reward notify；
- `BettingPool / Parlay -> LiquidityPool` 的 LP margin 或 payout 相关划转；
- `LiquidityPool.requestPayoutLiquidity` 返回 BettingPool 的池间流动性；
- 白名单业务合约向 `platformTreasury` 或 `treasurySink` 的平台税金和收益划转。

最小改动要求：

- 保留现有会计事件和状态机；
- 仅在必要时增加来源地址校验，确保外部注资来自已登记 `treasurySink`、`HouseVault` 或 timelock 控制地址；
- 这些路径不得调用 `registerBusinessOutcomeDelta`，也不得改变用户来源账本。

## 12. 部署脚本改造

需要新增或更新：

- `script/DeployBscTestnet.s.sol`
- `script/DeployAll.s.sol`
- `script/deploy_and_verify*.sh`
- fork/local helper
- skills ABI/address 文件

部署顺序：

1. 部署 ODDToken implementation + proxy，initData 调 `initialize(adminTimelock,pauser)`；
2. 部署 TimelockController 或 OpsTreasuryVault，并校验最小延迟不少于 48 小时；
3. 部署 TierSale / HouseVault / DexLaunchController / EcosystemRewards / DexLpLocker / treasury 接收方；
4. 部署 BettingPool / StakingPool / LiquidityPool 等指向新 ODD 的业务 proxy；
5. `setFixedSourceContracts`；
6. `setWhitelist` 写入业务合约；
7. `setDexRestrictedTarget` 写入 Pancake V3 Router / NonfungiblePositionManager / 已知 V3 Pool、旧 V2 Pair / Router 和聚合器地址；
8. `setTreasurySink` 写入 platformTreasury / Timelock / OpsTreasury；
9. `allocateInitialSupply`；
10. 完成业务合约互相依赖配置；
11. 断言所有新业务合约和配套合约引用的新 `ODDToken` 地址一致，且没有残留旧 ODD 地址；
12. 断言 `dexRestrictedTarget` 均不在 `whitelist`，且 BettingPool 推荐 USDT swap 的 Router / poolFee / expected pool 与 Pancake V3 Factory 查询一致；
13. 若 sale 取消需要无条件全额 USDT 退款，则在 launch/cancel 决策前保持 bet、stake、LP deposit 关闭；否则部署配置必须明确采用“交回 ODD 才退款”的链上规则；
14. 部署 gate 全部通过后才允许 `startSale`、bet、stake、LP deposit、DEX launch。

当前本地脚本状态：

- `script/DeployAll.s.sol` 已改为全量 MVP 新部署拓扑：部署 `ODDToken / TierSale / HouseVault / DexLaunchController / DexLpLocker / EcosystemRewards / BettingPool / StakingPool / LiquidityPool`，配置 fixed sources、whitelist、treasury sink、DEX restricted target、初始供应分配、业务模块依赖和部署 gate；
- `script/DeployBscTestnet.s.sol` 复用 `DeployAll` 流程，并固定 BSC 常用 USDT、Pancake V3 Router、NonfungiblePositionManager 地址；
- 推荐 USDT claim 的 `expectedPool` 在 DEX Pool 未创建前可以留空，届时 claim 不启用；Pool 确认后必须用三参数 `setReferralSwapConfig(router,usdt,expectedPool)` 配置；
- `script/BscTestnetUpgradeExistingOnly.s.sol` 已停止使用两参数 referral swap 配置，只在提供 `REFERRAL_SWAP_EXPECTED_POOL` 时配置三参数入口。

所有 proxy 必须通过构造器 `initData` 完成最小初始化，不得留下可被第三方抢先 `initialize` 的窗口。

## 13. 测试计划

全量 E2E、对抗性测试和场景矩阵以 `docs/testing/2026-06-12-ODDToken锁仓与发售MVP全量场景测试方案.md` 为准。本节保留开发阶段的最低覆盖要求；完整实现后必须按该测试方案补齐测试代码并全部跑完。

### 13.1 Token 单元测试

必须覆盖：

- initialize 参数非零；
- 初始供应铸造到 `address(token)`；
- 初始分配只能一次；
- whitelist / treasury sink 权限；
- 用户普通转入白名单业务合约失败；
- 锁定余额向 DEX Pair / V3 Pool 转出失败；
- 可转余额向 DEX Pair / V3 Pool 转出成功；
- DEX Pair / V3 Pool -> 用户买入为可转余额；
- DEX Pair / V3 Pool / Router / PositionManager / 聚合器路径不会绕过可转额度限制，也不会误伤正常买入；
- DexLaunchController 经 NonfungiblePositionManager 向 V3 Pool 建池时扣减一次性 `dexLiquidityTransferableAllocation`，超额、错误 spender 或错误 pool 均失败；
- BettingPool 推荐奖励 USDT claim 只能使用已登记的 `BusinessProfitSwap` 一次性额度，错误 Router / pool 或重复使用额度失败；
- burn 消耗来源账本；
- pause 停止 transfer / transferFrom / burn / 业务入口。
- 关键状态变更事件字段完整，特别是 whitelist、treasury sink、来源发放、业务入金、业务出金、亏损确认、DEX launch。
- Token 不存在交易税、黑名单或管理员任意转移用户余额入口。

### 13.2 解锁曲线测试

必须覆盖：

- poolLaunchTime 前销售和奖励解锁为 0；
- 销售第 1 天、第 29 天、超过第 29 天；
- 销售解锁整数除法向下取整，与 view / transfer 校验一致；
- 奖励 0 秒、90 天、180 天；
- `markDexPoolLaunched` 二次调用失败、0 时间失败、未来时间失败、无权限失败。

### 13.3 业务来源测试

必须覆盖：

- 锁定销售 ODD 下注后全输，用户锁定来源减少；
- 锁定销售 ODD 下注后退款，本金按原曲线恢复；
- 锁定销售 ODD 下注后赢利，净盈利可转；
- DEX 买入可转 ODD 下注后赢利或退款，不被重新锁定；
- 锁定+可转混合投入，部分退款、Cash Out、最终结算均按累计比例还原；
- 全输单注、全输串关、LP 清零仓位通过 zero-delta finalized 正确确认亏损；
- Staking 正常 unstake、earlyUnstake；
- Liquidity withdraw 正收益、亏损、清零；
- Referral reward claim 可转。
- Platform reserve top-up、Betting -> Staking、Liquidity -> Betting 池间划转不生成用户 outcome。

### 13.4 配套合约测试

必须覆盖：

- TierSale 跨档购买、售罄、start/pause/resume/close/cancel/forceFinalize；
- TierSale 最后一档收尾和超过全池剩余量购买 revert；
- TierSale `previewBuy` 与实际扣款一致，覆盖 USDT decimals；
- TierSale 售罄或 forceFinalize 前 USDT 不得 approve / transfer；
- cancel 后不能继续购买或建池，只能退款或治理处理未售 ODD；
- cancel 后用户退款必须交回对应销售 ODD；余额/销售来源不足时不能无条件退 USDT；
- EcosystemRewards create claimable / cancel claimable / claim / 重复 claim / 类别预算上限；
- HouseVault 禁止向普通用户和 DEX 出账；
- DexLaunchController Pancake V3 launch gate、poolFee / tick range / position token 锁定、满额和非满额建池资产事件、剩余资产回 treasury sink。

### 13.5 对抗性测试

必须覆盖：

- 重入：所有涉及资产转移的外部方法 `nonReentrant`；
- 无上限循环：批量 setter / allocate / claim 不允许无界数组；
- businessId 重放；
- 非 snapshot owner 登记 outcome；
- finalized 后重复 outcome；
- outcome 超过业务合约余额；
- zero-delta 非 finalized 失败，zero-delta finalized 成功；
- totalBusinessOut 多次 delta 不重复计算利润；
- 直接 `approve + transferFrom` 绕过业务入口失败；
- DexLaunchController、推荐奖励 USDT swap 的 DEX 一次性额度不能被复用或转向普通 EOA；
- whitelist 新增 EOA / Pair / V3 Pool / Router / PositionManager 失败；
- treasury sink 错配导致平台税转账失败时明确 revert。
- TimelockController `minDelay < 48 hours` 的部署 gate 失败。
- 新业务合约残留旧 ODD 地址时部署 gate 失败。

## 14. 验收命令

开发完成后至少执行：

```bash
forge fmt --check
forge build
forge test --no-match-path 'test/ForkMainnet*' -vv
forge test --match-path 'test/*ODDToken*' -vv
forge test --match-path 'test/*Funds*' -vv
```

具备 RPC 后执行：

```bash
forge test --match-path 'test/ForkMainnet*.t.sol' -vv
```

审计前执行 Slither，所有 High/Medium 必须修复或记录豁免理由。上线前必须完成第三方审计；审计范围至少包括 `ODDToken`、`TierSale`、解锁/来源记账、`DexLaunchController`、`HouseVault`、`EcosystemRewards` 和 treasury / Timelock 交互边界。

## 15. 分阶段任务清单

### Phase 0: 文档同步（已完成，持续维护）

- 已更新主架构文档和 DDD 文档；
- 已更新 API 文档；
- 已更新本实施方案评审结论；
- 开发中继续按实现状态同步 `docs/progress/当前开发现状.md` 和当前模块文档。

### Phase 1: Token 核心（已本地实现）

- 已新增角色；
- 已新增 ODDToken storage；
- 已实现 `initialize(adminTimelock,pauser)` 与初始分配；
- 已实现 transfer 限制；
- 已实现解锁曲线；
- 已实现 `burn`；
- 已实现 view 方法。

### Phase 2: 业务来源接口（已本地实现并通过专项测试）

- 已实现 `consumeBusinessInflow`；
- 已实现 `registerBusinessOutcomeDelta`；
- 已实现 `registerBusinessProfitAndTransfer`；
- 已实现 `registerBusinessProfitForDexSwap`；
- 已实现 business snapshot view 与事件；
- 已新增 `test/ODDTokenPhase1.t.sol` 覆盖主路径；
- 已补齐 fuzz、部分解锁后混合来源消耗、业务合约真实接入后的对抗性与场景矩阵测试。

### Phase 3: 配套合约（已本地实现主干）

- 已实现 `TierSale`；
- 已实现 `EcosystemRewards`；
- 已实现 `HouseVault`；
- 已实现 `DexLaunchController`；
- 已实现 `DexLpLocker`；
- treasury 接收方方案仍采用 TimelockController 默认方案；
- 当前 DexLaunchController 已把 V3 LP NFT mint 到 `DexLpLocker`，并在 locker 记录 unlockTime；到期前释放会 revert。

### Phase 4: 既有业务最小接入（已本地实现并通过本地与 fork 验证）

- `BettingBetModule`：普通单注入金已接入 `consumeBusinessInflow`，提前生成 `betId`；
- `BettingSettlementModule`：普通单注 claim、refund、cashOut、score settlement refund 和 full loss 已接入 `registerBusinessOutcomeDelta`；
- `BettingParlayModule`：串关注单入金、claim 和 full loss 已接入 Token 业务接口，赢单 claim 主路径已有定向测试；
- `BettingReferralModule`：ODD claim 已接入 `registerBusinessProfitAndTransfer`；USDT claim 已新增 `referralSwapExpectedPool` 并接入 `registerBusinessProfitForDexSwap`，Pancake V3 swap 专项路径已在本地与 BNB mainnet fork 覆盖；
- `StakingPool`：stake、unstake、earlyUnstake 已接入 Token 业务接口；
- `LiquidityPool`：depositGlobal、depositMatch、withdraw 已接入 Token 业务接口；
- 已新增 `test/OddMvpBusinessIntegration.t.sol`，当前覆盖 Betting 普通单注、串关、推荐 ODD/USDT、Staking 和 Liquidity 主路径。

### Phase 5: 部署与验收（BSC Testnet 已完成真实链上验收）

- `DeployAll / DeployBscTestnet` 已补齐 MVP 全量新部署拓扑和部署 gate；
- BSC Testnet 当前采用部署账户临时兼任 admin / pauser / OpsTreasury / platformTreasury / referral signer，生产前仍需替换为正式治理地址；
- API / ABI / skills 已同步到当前 BSC Testnet 地址；
- 本地测试已通过；
- BNB mainnet fork suite 与脚本全流程已通过；
- E2E、对抗性测试、全量场景矩阵已按 `docs/testing/2026-06-12-ODDToken锁仓与发售MVP全量场景测试方案.md` 执行并生成报告；
- BSC Testnet 全量新部署与真实链上 live 验证已完成，覆盖发售、DEX V3 建池、LP NFT 锁定、三类来源质押、普通下注、推荐 ODD/USDT、Cash Out、串关、结算、claim、流动性添加和 requestUnbond；
- 实链验收中发现 Pancake V3 SwapRouter `exactInputSingle` 需要 `deadline` 参数，已修复 `IPancakeV3SwapRouterLike`、重新部署并验证 `BettingReferralLib / BettingReferralModule`，并通过 `BettingPool.setReferralModule` 切换到新模块；
- 剩余等待项仅为协议时间锁：成熟质押正常提现需等 `unlockAt`，LP position 2 已进入 `Unbonding`，最终 withdraw 需等 unbond epoch。
- `docs/progress/当前开发现状.md` 和 testing 报告已同步，后续 BSC Testnet/live 仍需继续更新。

## 16. 非阻塞上线配置项

以下不是技术阻塞。开发时应实现为受限配置、构造参数或部署脚本变量；正式开放 sale / bet / stake / LP / DEX launch 前必须由产品或治理给出具体值并通过部署 gate：

- `forceFinalize` 非满额建池的经济下限；
- PancakeSwap V3 Factory / NonfungiblePositionManager / Router / LP NFT locker 具体地址；
- PancakeSwap V3 `poolFee`、初始 tick range、slippage / min amount 和 deadline 参数；
- per-address sale cap 是否保持默认 `0`；
- cancel/refund 后未售 ODD、已退回 ODD 与剩余 USDT 的治理接收地址。

MVP 默认采用 OpenZeppelin `TimelockController` 直持 20% OpsTreasury，最小 48 小时延迟；只有在部署或运营需要额外封装时，才新增极薄 `OpsTreasuryVault`。

## 17. 产品需求覆盖矩阵

| 产品文档要求 | 实施方案位置 | 覆盖结论 |
| --- | --- | --- |
| Name/Symbol/decimals/固定总量/无增发 | 第 6 节 | 已覆盖 |
| 持有人 burn、pause 停止 burn、不强制销毁 | 第 7 节、13.1 | 已覆盖 |
| 五类初始分配与不得进入 EOA | 第 6 节、12 节 | 已覆盖 |
| 初始化只写最小角色，地址部署后配置 | 第 6 节、12 节 | 已覆盖 |
| TierSale 10 档、跨档、USDT、cap、startSale | 第 10.1 节 | 已覆盖 |
| USDT 募资锁定、取消/退款/launch 路径 | 第 10.1、10.2 节 | 已覆盖 |
| DEX 建池、LP 锁 12 个月、不销毁 LP、剩余回 treasury sink | 第 10.2 节 | 已覆盖 |
| PancakeSwap V3 建池、V3 LP NFT / position token 锁定、BettingPool 生产 swap 已是 V3 | 第 2、10.2、13.4、16 节 | 已覆盖 |
| V3 PositionManager 建池拉币、推荐奖励 USDT swap 不进入普通白名单 | 第 7、8.4、10.2、11.6、13.1、13.5 节 | 已覆盖 |
| `poolLaunchTime` 与 29 天/180 天解锁 | 第 8、9、13.2 节 | 已覆盖 |
| 普通转入白名单业务合约禁止 | 第 7、8、13.1、13.5 节 | 已覆盖 |
| businessId、businessIn、businessOutDelta、totalBusinessOut | 第 5、8、11、13.3 节 | 已覆盖 |
| 净盈利可转、亏损扣减来源、DEX 可转用户不误锁 | 第 8、11、13.3 节 | 已覆盖 |
| Betting / Staking / Liquidity 最小改动接入 | 第 11 节 | 已覆盖 |
| 平台储备注资和池间划转不误登记为用户回款 | 第 7、11.8、13.3 节 | 已覆盖 |
| HouseVault 独立储备，不接管结算 | 第 10.4 节 | 已覆盖 |
| 新角色与 Timelock / pauser 边界 | 第 4、12 节 | 已覆盖 |
| EcosystemRewards 管理员创建 claimable、用户 claim 后奖励锁定 | 第 8、10.3、13.4 节 | 已覆盖 |
| Treasury sink 与 platformTreasury 校验 | 第 6、7、11.7、13.5 节 | 已覆盖 |
| 全量重部署与部署 gate | 第 12 节 | 已覆盖 |
| 48 小时 Timelock、Safe 仅 proposer/canceller | 第 4、6、10.5、12、13.5 节 | 已覆盖 |
| 所有状态变更事件与亏损扣减 view | 第 5、8.4、9、13.1 节 | 已覆盖 |
| 不内置交易税、黑名单、管理员任意转移用户余额 | 第 3、13.1 节 | 已覆盖 |
| cancelSale 退款不引入管理员 clawback，用户需交回销售 ODD | 第 10.1、12、13.4 节 | 已覆盖 |
| 旧 ODD 地址不得残留、proxy initData 防抢初始化 | 第 12、13.5 节 | 已覆盖 |
| 第三方审计范围 | 第 14 节 | 已覆盖 |

## 18. 当前开发结论

本方案已进入编码阶段，当前结论：

- 产品文档中的强制需求均已映射到 Token、配套合约、既有业务合约最小接入、部署 gate 和测试计划；
- `ODDToken` Phase 1/2 主干和 `TierSale / EcosystemRewards / HouseVault / DexLaunchController / DexLpLocker` 配套合约主干已本地实现并通过针对性测试；
- 除 `ODDToken` 外，既有 `Betting / Staking / Liquidity` 合约本轮只替换资金入口/出口、提前生成必要业务 ID，并为推荐 USDT swap 增加 expected pool 配置；未重写业务状态机；
- PancakeSwap V3 建池、V3 PositionManager 拉币、LP NFT 锁定和 BettingPool 推荐奖励 USDT V3 swap 均有可实现路径，且不要求 DEX 地址进入普通白名单；
- `cancelSale` 退款已明确为“用户交回销售 ODD 后链上退款”，不会引入管理员任意转移用户余额；如产品要求无条件全额退款，部署 gate 必须在 launch/cancel 决策前关闭 bet / stake / LP 入口；
- 第 16 节剩余事项多为上线参数或治理接收地址，不再包含 LP NFT 强制锁定实现缺口；
- 下一段开发应优先补齐 BSC Testnet 升级/live 验证、skills ABI 同步和审计前 Slither High/Medium 逐条复核；如进入正式审计，建议继续补强专门 invariant。
