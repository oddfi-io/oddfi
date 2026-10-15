# Hawk — USDT 版本合约任务文档

**创建日期：** 2026-03-29
**最后更新：** 2026-04-01
**负责人：** Hawk
**协作对接：** Jason（链下后端，负责赔率引擎、下单验证、事件监听）
**链：** BSC (BNB Smart Chain)
**标准：** Solidity ^0.8.19 / OpenZeppelin / UUPS Upgradeable

---

## 一、产品背景

USDT 版本是平台基础版本。用户以 USDT 充值，资金由智能合约统一托管，下注由链下后端验证后调用合约锁定余额，赛事结算由 Admin 多签触发，用户随时可提现未锁定余额。

**核心原则：**
- 用户下注不需要每次签名，仅充值/提现需要链上交易
- 资金托管在合约，平台无法绕过合约直接动用用户资金
- 结算必须经 Gnosis Safe 多签，单人无法完成
- 所有合约采用 UUPS 可升级模式部署

**下注支持的盘口类型（V1）：**

| 类型 | 代码 | 说明 |
|------|------|------|
| 胜负平 | 1X2 | 三选一，主胜 / 平 / 客胜 |
| 让分 | AH | 亚盘，主要线：-0.5 / -1 / -1.5 |
| 总分 | OU | 大小球，主要线：2.5 / 3.5 / 4.5 |

---

## 二、DDD 架构设计

### 2.1 限界上下文划分

本项目为单一限界上下文 **OddFi Betting**，原因：用户余额、下注、结算、LP 资金池之间状态高度耦合，拆分会导致大量跨合约调用和状态同步问题。

**聚合根：** `BettingPool.sol` — 唯一外部调用入口，协调所有子模块。

### 2.2 目录结构

```text
contracts/
├── core/
│   └── betting/
│       ├── BettingPool.sol              # 聚合根（UUPS Proxy）
│       ├── interfaces/
│       │   └── IBettingPool.sol         # 对外接口定义
│       └── libraries/
│           ├── SettlementLib.sol         # 结算计算（普通注单 + 信用注单）
│           ├── ParlayLib.sol            # 串关逻辑
│           ├── LendingLib.sol           # 信用仓位逻辑
│           ├── LiquidityLib.sol         # LP 份额计算
│           └── SignalLib.sol            # 信号灯逻辑
├── shared/
│   ├── types/
│   │   └── BetTypes.sol                 # 共享 enum / struct
│   ├── errors/
│   │   └── Errors.sol                   # 共享自定义 error
│   └── constants/
│       └── Constants.sol                # 共享常量（阈值、比例等）
└── test/                                # 测试目录，结构镜像 contracts/
    └── core/
        └── betting/
            ├── BettingPool.t.sol
            ├── BettingPool.settle.t.sol
            ├── BettingPool.parlay.t.sol
            ├── BettingPool.lending.t.sol
            └── ...
```

### 2.3 可升级策略（UUPS）

所有合约采用 OpenZeppelin UUPS Proxy 模式：

| 项目 | 说明 |
|------|------|
| Proxy 模式 | UUPS（`UUPSUpgradeable`） |
| 初始化 | 使用 `initialize()` + `initializer` 修饰符；constructor 仅用于 `_disableInitializers()`，禁止其他逻辑 |
| 升级权限 | `_authorizeUpgrade()` 限制为 `onlyMultisig` |
| Storage Layout | 所有 storage 变量声明顺序不可变，新增只能追加到末尾 |
| 继承链 | `Initializable, UUPSUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable` |
| SafeERC20 | 所有 USDT 操作使用 `SafeERC20.safeTransfer` / `safeTransferFrom`，防止非标准 ERC20 返回值问题 |

```solidity
using SafeERC20 for IERC20;

/// @custom:oz-upgrades-unsafe-allow constructor
constructor() {
    _disableInitializers();  // 防止攻击者直接在实现合约上调用 initialize
}

// 初始化函数示例
function initialize(
    address _usdt,
    address _admin,
    address _multisig
) external initializer {
    __UUPSUpgradeable_init();
    __ReentrancyGuard_init();
    __Pausable_init();
    usdt = IERC20(_usdt);
    admin = _admin;
    multisig = _multisig;
    redLightThreshold = DEFAULT_RED_THRESHOLD;   // $28,000
    lpShareBps = DEFAULT_LP_SHARE_BPS;           // 7000 (70%)
    maxMarketsPerMatch = DEFAULT_MAX_MARKETS_PER_MATCH;  // 9
}

function _authorizeUpgrade(address newImplementation) internal override onlyMultisig {}
```

---

## 三、共享类型（shared/types/BetTypes.sol）

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

enum BetStatus { Pending, Won, Lost, Cancelled }
enum MarketType { X12, AH, OU }  // X12 = 产品文档中的 "1X2"（Solidity 标识符不可数字开头）
enum SignalColor { Green, Yellow, Orange, Red }
enum MarketStatus { NotCreated, Open, Closed, Settled, Cancelled }

struct Bet {
    address  user;
    uint256  amount;
    bytes32  matchId;
    MarketType market;
    uint8    outcome;       // X12: 0=主胜 1=平 2=客胜 / AH,OU: 0=主/大 1=客/小
    uint8    line;          // AH: 0=-0.5 1=-1 2=-1.5 / OU: 0=2.5 1=3.5 2=4.5
    uint256  lockedOdds;    // 赔率 ×1000，如 1818 = 1.818
    BetStatus status;
    bool     isCredit;          // 是否为信用仓位（Lending）
    bytes32  collateralBetId;   // 抵押仓位 ID（isCredit=true 时有效）
    bool     isParlay;          // 是否属于串关
    bytes32  parlayId;          // 串关 ID（isParlay=true 时有效）
}

struct Parlay {
    address  user;
    uint256  stake;             // 用户下注金额
    bytes32[] legBetIds;        // 各腿 betId
    uint256  combinedOdds;      // 连乘赔率 ×1000
    uint256  maxPayout;         // 预计最大赔付
    BetStatus status;           // Pending / Won / Lost / Cancelled
    uint8    settledLegs;       // 已结算腿数（Won/Lost）
    uint8    wonLegs;           // 赢的腿数
    uint8    cancelledLegs;     // 因赛事取消而取消的腿数
}

struct MarketSignal {
    uint256  heavyAmount;   // 重仓方向累计额
    uint8    heavySide;     // 重仓方向
    SignalColor color;
}

struct WithdrawalRequest {
    address  user;
    uint256  amount;
    uint256  requestTime;       // 申请时间戳
    bool     executed;          // 是否已执行
    bool     rejected;          // 是否被拒绝
}
```

---

## 四、共享常量（shared/constants/Constants.sol）

```solidity
uint256 constant ODDS_PRECISION = 1000;             // 赔率精度
uint256 constant BPS_DENOMINATOR = 10000;            // 基点分母
uint256 constant DEFAULT_LP_SHARE_BPS = 7000;        // LP 默认分得 70%
uint256 constant DEFAULT_RED_THRESHOLD = 28_000e6;   // 信号灯红灯默认阈值 $28,000
uint256 constant LARGE_WITHDRAWAL_THRESHOLD = 5_000e6; // 大额提现审核阈值 $5,000
uint256 constant WITHDRAWAL_DELAY = 24 hours;        // 大额提现等待期
uint256 constant MAX_PARLAY_LEGS = 6;                // 串关最多腿数
uint256 constant MIN_PARLAY_LEGS = 2;                // 串关最少腿数
uint256 constant MAX_PARLAY_PAYOUT = 10_000e6;       // 串关最大赔付 $10,000
uint256 constant CREDIT_RATIO_BPS = 5000;            // 信用比例 50%
uint256 constant DEFAULT_MAX_MARKETS_PER_MATCH = 9;  // 每赛事默认最多盘口数
uint256 constant GLOBAL_MAX_BET = 10_000e6;          // 全局单注硬上限 $10,000（合约层兜底）
uint256 constant MIN_LP_DEPOSIT = 1_000e6;           // LP 最小存入量 $1,000（防首笔精度攻击）
```

---

## 五、共享错误（shared/errors/Errors.sol）

```solidity
error InsufficientBalance();
error BetNotFound();
error BetAlreadySettled();
error MarketAlreadySettled();
error MarketRedLight();                  // 红灯拒绝接单
error InsufficientLiquidity();
error InvalidParlayLegs();              // 腿数不在 2-6 范围
error DuplicateMatchInParlay();         // 串关中同赛事重复
error ParlayPayoutExceeded();           // 串关赔付超上限
error ParlayNotCollateralizable();      // 串关不可作为抵押
error CreditChainForbidden();           // 禁止连环借贷
error CreditLimitExceeded();            // 同一抵押仓位累计信用超 50%
error WithdrawalNotReady();             // 大额提现未到等待期
error WithdrawalAlreadyProcessed();
error Unauthorized();
error ZeroAmount();
error InvalidBetForMarket();            // settle 时 betId 不属于该盘口
error MarketNotOpen();                  // 盘口非 Open 状态，不可下注
error GlobalMaxBetExceeded();           // 超过合约层全局单注硬上限
error SharesIsZero();                   // LP 存入后计算份额为 0（精度截断）
error BetIdAlreadyExists();             // betId 已存在，防止覆盖
error ParlayIdAlreadyExists();          // parlayId 已存在，防止覆盖
error InvalidLpShareBps();             // lpShareBps 超出允许范围
error InvalidAddress();                // 传入 address(0)
error InvalidOdds();                   // 赔率 < 1.0（lockedOdds < ODDS_PRECISION）
error MarketNotOpenOrClosed();          // 盘口非 Open/Closed，不可结算或取消
error OutcomeInconsistent();            // 分批 settle 时 winningOutcome 不一致
error ParlayPartiallySettled();         // 串关已部分结算，不可直接取消
error TooManyMarkets();                // 该赛事盘口数已达上限
```

---

## 六、BettingPool.sol — 聚合根

### 6.1 Storage 布局

> **重要：** UUPS 模式下 storage 变量顺序不可改变，新增只能追加到末尾。

```solidity
// ── Slot 1-3: 基础配置 ─────────────────────────
IERC20 public usdt;
address public admin;                               // Jason 后端地址（单签）
address public multisig;                             // Gnosis Safe 多签地址

// ── Slot 4-5: 用户余额 ─────────────────────────
mapping(address => uint256) public userBalances;     // 可用余额
mapping(address => uint256) public lockedBalances;   // 下注锁定中

// ── Slot 6: 注单存储 ───────────────────────────
mapping(bytes32 => Bet) public bets;

// ── Slot 7: 串关存储 ───────────────────────────
mapping(bytes32 => Parlay) public parlays;

// ── Slot 8-11: Betting Pool（对赌池）───────────
uint256 public bettingPool;                          // 对赌池总资金
uint256 public totalLpShares;                        // LP 份额总量
mapping(address => uint256) public lpShares;         // 各 LP 持有份额
uint256 public platformBalance;                      // 平台应收余额（30%）

// ── Slot 12: 信号灯 ───────────────────────────
// key: keccak256(matchId, marketType, line)
mapping(bytes32 => MarketSignal) public signals;

// ── Slot 13: 盘口生命周期 ──────────────────────
// key: keccak256(matchId, marketType, line)
mapping(bytes32 => MarketStatus) public marketStatus;  // 盘口状态
mapping(bytes32 => uint8) public marketOutcome;         // 结算结果：0=未结算, 1~255 = winningOutcome + 1

// ── Slot 14: 赛事 → 盘口反向映射 ──────────────
mapping(bytes32 => bytes32[]) public matchMarkets;     // matchId → 该赛事所有盘口 key 列表

// ── Slot 15-16: 信用仓位 ──────────────────────
mapping(bytes32 => uint256) public frozenPayouts;    // creditBetId → 冻结金额
mapping(bytes32 => uint256) public collateralUsed;   // collateralBetId → 已借出信用累计额

// ── Slot 17-18: 大额提现请求 ──────────────────
mapping(bytes32 => WithdrawalRequest) public withdrawalRequests;
uint256 public withdrawalNonce;

// ── Slot 19: 充值去重 ─────────────────────────
mapping(bytes32 => bool) public processedDeposits;   // txHash → 是否已处理

// ── Slot 20-21: 赔付跟踪 ───────────────────────
uint256 public totalPotentialPayout;                 // 所有 Pending 注单的潜在赔付总额
uint256 public totalFrozenPayouts;                   // 信用注单已结算但冻结中的赔付总额

// ── Slot 22-24: 会计校验 ──────────────────────
uint256 public totalUserBalances;                    // 所有用户 userBalances 的累计总额（creditDeposit 时 +，withdraw/settle 时 -）
uint256 public totalPendingWithdrawals;              // 大额提现待执行总额（withdraw 大额时 +，execute/reject 时 -）
uint256 public totalCreditOutstanding;               // 信用仓位在途总额（lockCreditBet 时 +，settle/cancel/unlock 信用注单时 -）
                                                     // 用于 creditDeposit 链上校验：usdt.balanceOf(this) >= totalUserBalances + bettingPool + platformBalance + totalPendingWithdrawals + totalCreditOutstanding

// ── Slot 25-27: 可调配置 ──────────────────────
uint256 public redLightThreshold;                    // 默认 $28,000（链上透明配置，供 Jason 读取参考）
uint256 public lpShareBps;                           // 默认 7000 (70%)
uint256 public maxMarketsPerMatch;                   // 默认 9（每赛事最多盘口数，Admin 可调）
```

### 6.2 用户函数

#### 充值（直接转账模式）

```solidity
/// @notice 后端监听到用户 USDT 直接转账后，调用此函数为用户入账
/// @dev 用户将 USDT 直接 transfer 到合约地址，后端监听 USDT 合约的 Transfer 事件，
///      确认 12 个区块后调用 creditDeposit 完成入账。txHash 用于防重复入账。
function creditDeposit(
    address user,
    uint256 amount,
    bytes32 txHash
) external onlyAdmin whenNotPaused;
// 1. if (amount == 0) revert ZeroAmount()
// 2. if (user == address(0)) revert InvalidAddress()
// 3. require(!processedDeposits[txHash])
// 4. processedDeposits[txHash] = true
// 5. require(usdt.balanceOf(address(this)) >= _totalAccountedBalance() + amount)
//    ← 链上校验：合约实际持有的 USDT ≥ 已记账总额 + 本次入账额，防止凭空增加余额
//    _totalAccountedBalance() = totalUserBalances + bettingPool + platformBalance + totalPendingWithdrawals + totalCreditOutstanding
// 6. userBalances[user] += amount
// 7. totalUserBalances += amount
// emit Deposited(user, amount, txHash)
```

> **充值流程说明：** 用户从钱包向合约地址直接发起 USDT `transfer()`，前端展示合约地址 + 一键复制。后端监听 USDT 合约的 `Transfer(from, to=contractAddress, amount)` 事件，BSC 链 12 个区块确认后调用 `creditDeposit()` 入账。`txHash` 去重防止重复入账。

#### 提现（含大额审核机制）

```solidity
/// @notice 小额直接到账；大额进入审核等待期
function withdraw(uint256 amount) external nonReentrant whenNotPaused;
// 可提额 = userBalances[msg.sender] - lockedBalances[msg.sender]
// require(amount > 0 && amount <= 可提额)
//
// 若 amount <= LARGE_WITHDRAWAL_THRESHOLD:
//   userBalances[msg.sender] -= amount
//   totalUserBalances -= amount                   ← 同步递减累计总额
//   usdt.safeTransfer(msg.sender, amount)
//   emit Withdrawn(msg.sender, amount)
//
// 若 amount > LARGE_WITHDRAWAL_THRESHOLD:
//   userBalances[msg.sender] -= amount          ← 立即扣减，防止重复提交
//   totalUserBalances -= amount                 ← 同步递减累计总额
//   totalPendingWithdrawals += amount           ← 记入待执行提现总额
//   lockedBalances[msg.sender] 不变（此金额已从可用余额移除）
//   requestId = keccak256(msg.sender, withdrawalNonce++)
//   withdrawalRequests[requestId] = WithdrawalRequest(msg.sender, amount, block.timestamp, false, false)
//   emit LargeWithdrawalRequested(requestId, msg.sender, amount)

/// @notice 大额提现：等待期满后用户自行执行
function executeLargeWithdrawal(bytes32 requestId) external nonReentrant whenNotPaused;
// 1. require(withdrawalRequests[requestId].user == msg.sender)
// 2. require(!rejected && !executed)
// 3. require(block.timestamp >= requestTime + WITHDRAWAL_DELAY)
// 4. executed = true
// 5. totalPendingWithdrawals -= amount          ← 释放待执行总额
// 6. usdt.safeTransfer(msg.sender, amount)
// emit Withdrawn(user, amount)

/// @notice Admin 拒绝大额提现（等待期内可拒绝，拒绝后余额退回）
function rejectLargeWithdrawal(bytes32 requestId) external onlyAdmin;
// 1. require(!executed && !rejected)
// 2. require(block.timestamp < requestTime + WITHDRAWAL_DELAY)  ← 只能在等待期内拒绝，防与 execute 竞态
// 3. rejected = true
// 4. totalPendingWithdrawals -= amount  ← 释放待执行总额
// 5. userBalances[user] += amount    ← 退回余额
// 6. totalUserBalances += amount     ← 同步更新累计总额
// emit LargeWithdrawalRejected(requestId, user, amount)
```

> **提现流程说明：**
> - ≤ $5,000：用户调用 `withdraw()` 直接到账
> - \> $5,000：调用 `withdraw()` 立即扣减余额并创建请求，24h 等待期内 Admin 可拒绝（余额自动退回）；等待期满后用户调用 `executeLargeWithdrawal()` 完成提现

### 6.3 Admin 函数（Jason 后端地址，单签）

#### 盘口生命周期管理

```solidity
/// @notice 开盘（Jason 计算好初始赔率后调用）
function openMarket(
    bytes32    matchId,
    MarketType market,
    uint8      line
) external onlyAdmin;
// key = keccak256(abi.encode(matchId, market, line))
// require(marketStatus[key] == NotCreated)
// require(matchMarkets[matchId].length < maxMarketsPerMatch)  ← 盘口数不超限
// marketStatus[key] = Open
// matchMarkets[matchId].push(key)          ← 注册到赛事的盘口列表（只增不减，已消耗槽位含已取消的不可复用）
// emit MarketOpened(matchId, market, line)

/// @notice 封盘（赛事开始前调用，停止接单）
function closeMarket(
    bytes32    matchId,
    MarketType market,
    uint8      line
) external onlyAdmin;
// key = keccak256(abi.encode(matchId, market, line))
// require(marketStatus[key] == Open)
// marketStatus[key] = Closed
// emit MarketClosed(matchId, market, line)

/// @notice 批量开盘（同一赛事多盘口一次性开放）
function batchOpenMarkets(
    bytes32    matchId,
    MarketType[] calldata markets,
    uint8[]    calldata lines
) external onlyAdmin;
// 遍历 markets/lines，逐个执行 openMarket 逻辑
// emit MarketOpened for each

/// @notice 批量封盘（同一赛事多盘口一次性封盘）
function batchCloseMarkets(
    bytes32    matchId,
    MarketType[] calldata markets,
    uint8[]    calldata lines
) external onlyAdmin;
// 遍历 markets/lines，逐个执行 closeMarket 逻辑
// emit MarketClosed for each

/// @notice 重新开盘（赛事延期/误封盘时使用，需多签审批）
function reopenMarket(
    bytes32    matchId,
    MarketType market,
    uint8      line
) external onlyMultisig;
// key = keccak256(abi.encode(matchId, market, line))
// require(marketStatus[key] == Closed)   ← 只有已封盘才可重新开放
// marketStatus[key] = Open
// emit MarketReopened(matchId, market, line)
```

> **盘口状态机：** `NotCreated → Open ⇄ Closed → Settled / Cancelled`。只有 Open 状态的盘口接受下注（lockBet / lockParlay / lockCreditBet 均检查）。封盘后若需重新接单，须由多签调用 `reopenMarket()`。已结算/已取消的盘口不可回退。

#### 锁定普通注单

```solidity
/// @notice 锁定注单（用户下注验证通过后调用）
function lockBet(
    bytes32    betId,
    address    user,
    uint256    amount,
    bytes32    matchId,
    MarketType market,
    uint8      outcome,
    uint8      line,
    uint256    lockedOdds
) external onlyAdmin whenNotPaused;
// if (amount == 0) revert ZeroAmount()
// if (lockedOdds < ODDS_PRECISION) revert InvalidOdds()           ← 赔率 >= 1.0
// if (bets[betId].user != address(0)) revert BetIdAlreadyExists() ← 防 ID 重复覆盖
// key = keccak256(abi.encode(matchId, market, line))
// require(marketStatus[key] == Open)                              ← 盘口必须处于接单中
// if (!isAccepting(matchId, market, line, outcome)) revert MarketRedLight()  ← 链上红灯校验
// if (amount > GLOBAL_MAX_BET) revert GlobalMaxBetExceeded()      ← 合约层全局单注硬上限兜底
// 检查：userBalances[user] - lockedBalances[user] >= amount
// potentialPayout = amount * lockedOdds / ODDS_PRECISION
// require(potentialPayout <= bettingPool - totalPotentialPayout - totalFrozenPayouts)  ← 流动性检查
// lockedBalances[user] += amount
// bets[betId] = Bet(..., isCredit=false, isParlay=false)
// totalPotentialPayout += potentialPayout                         ← 跟踪潜在赔付
// emit BetLocked(betId, user, amount, matchId)
```

> **链下 vs 链上校验决策记录：** 赔率变动确认（差值 >0.05 弹窗）、单注上限（按赔率分档）、每日限额（按用户等级）均为 Jason 链下校验，合约不重复检查。**原因：** 这些规则涉及用户等级、实时赔率等链下状态，链上实现复杂度高且 gas 昂贵。合约层仅设 `GLOBAL_MAX_BET`（$10,000）作为最终防线，防止后端异常时的极端情况。**风险接受：** 若 Jason 后端被攻破，攻击者可在限额内任意下注，但单注不超 $10,000，且仍受流动性校验约束。

#### 锁定信用仓位（Lending）

```solidity
/// @notice 锁定信用仓位
function lockCreditBet(
    bytes32    betId,
    bytes32    collateralBetId,
    address    user,
    uint256    amount,           // 最多 = 抵押仓位剩余可借额度
    bytes32    matchId,
    MarketType market,
    uint8      outcome,
    uint8      line,
    uint256    lockedOdds
) external onlyAdmin whenNotPaused;
// if (amount == 0) revert ZeroAmount()
// if (lockedOdds < ODDS_PRECISION) revert InvalidOdds()           ← 赔率 >= 1.0
// if (bets[betId].user != address(0)) revert BetIdAlreadyExists() ← 防 ID 重复覆盖
// key = keccak256(abi.encode(matchId, market, line))
// require(marketStatus[key] == Open)                              ← 盘口必须处于接单中
// if (!isAccepting(matchId, market, line, outcome)) revert MarketRedLight()  ← 链上红灯校验
// if (amount > GLOBAL_MAX_BET) revert GlobalMaxBetExceeded()      ← 合约层全局硬上限兜底
// 检查：
//   1. bets[collateralBetId].user == user
//   2. bets[collateralBetId].status == Pending
//   3. bets[collateralBetId].isCredit == false    （禁止连环借贷）
//   4. bets[collateralBetId].isParlay == false    （串关不可作为抵押）
//   5. collateralUsed[collateralBetId] + amount
//        <= bets[collateralBetId].amount * CREDIT_RATIO_BPS / BPS_DENOMINATOR
//      （累计信用不超过抵押仓位本金的 50%）
//   6. potentialPayout = amount * lockedOdds / ODDS_PRECISION
//      potentialPayout <= (bettingPool - amount) - totalPotentialPayout - totalFrozenPayouts
//      （Pool 出资 amount 后，剩余资金仍须覆盖含本注单在内的全部潜在赔付）
//   7. 信用仓位比赛结束时间 <= 抵押仓位比赛结束时间 + 7天（由 Jason 链下验证后传入）
//
// collateralUsed[collateralBetId] += amount        ← 记录累计借出
// bettingPool -= amount                            ← Pool 作为贷方出资
// totalCreditOutstanding += amount                  ← 记入信用在途总额
// bets[betId] = Bet(..., isCredit=true, collateralBetId=collateralBetId)
// totalPotentialPayout += amount * lockedOdds / ODDS_PRECISION
// 注意：信用仓位不锁定用户余额（amount 来源为 bettingPool 信用出资）
// emit CreditBetLocked(betId, collateralBetId, user, amount)
```

> **会计说明：** 信用仓位的 amount 在创建时从 `bettingPool` 扣减（Pool 出资），确保资金有实际来源。结算时按正常规则处理损益，会计恒等式始终成立。
>
> **有效期校验风险说明：** 信用仓位的有效期（抵押注单比赛结束时间 + 7天）完全由 Jason 链下校验，合约层不存储比赛结束时间。**风险：** 若 Jason 后端有 bug 忽略有效期检查，用户可用即将结束的抵押仓位借出信用投注遥远未来的赛事，增加 Pool 风险敞口。**缓解措施：** Jason 后端必须在 lockCreditBet 调用前严格校验有效期；后续版本考虑在合约层存储 `matchEndTime` 并做链上校验。

#### 锁定串关

```solidity
/// @notice 锁定串关注单
function lockParlay(
    bytes32    parlayId,
    address    user,
    uint256    stake,
    bytes32[]  calldata matchIds,     // 各腿赛事 ID
    MarketType[] calldata markets,
    uint8[]    calldata outcomes,
    uint8[]    calldata lines,
    uint256[]  calldata legOdds,      // 各腿锁定赔率
    bytes32[]  calldata legBetIds     // 各腿 betId（由 Jason 预生成）
) external onlyAdmin whenNotPaused;
// if (stake == 0) revert ZeroAmount()
// if (parlays[parlayId].user != address(0)) revert ParlayIdAlreadyExists() ← 防 ID 重复覆盖
// 检查：
//   1. legBetIds.length >= MIN_PARLAY_LEGS && <= MAX_PARLAY_LEGS
//   2. 所有数组长度一致
//   2a. 各腿 legOdds[i] >= ODDS_PRECISION（赔率 >= 1.0），否则 revert InvalidOdds()
//   3. 各腿盘口 marketStatus == Open                ← 所有腿必须处于接单中
//   4. matchIds 无重复（同一赛事只能选 1 个盘口）
//   5. userBalances[user] - lockedBalances[user] >= stake
//   6. if (stake > GLOBAL_MAX_BET) revert GlobalMaxBetExceeded()  ← 合约层全局硬上限兜底
//   7. 各腿盘口方向合约内调用 isAccepting() 校验（任意一腿红灯 → 整张 revert MarketRedLight）
//      ← 必须在合约内校验，不能仅依赖 Jason 链下检查
//   8. combinedOdds = legOdds[0] * legOdds[1] * ... / ODDS_PRECISION^(n-1)
//   9. maxPayout = stake * combinedOdds / ODDS_PRECISION
//   10. maxPayout <= MAX_PARLAY_PAYOUT
//   11. maxPayout <= bettingPool - totalPotentialPayout - totalFrozenPayouts（流动性校验）
//
// lockedBalances[user] += stake
// 创建各腿 Bet（逐腿校验 betId 唯一性）：
//   for each i in 0..legBetIds.length:
//     if (bets[legBetIds[i]].user != address(0)) revert BetIdAlreadyExists()
//     bets[legBetIds[i]] = Bet({
//       user:            user,              ← 必须设置，BetIdAlreadyExists 检查依赖此字段
//       amount:          0,                 ← 单腿不记金额，stake 统一在 Parlay 上
//       matchId:         matchIds[i],
//       market:          markets[i],
//       outcome:         outcomes[i],
//       line:            lines[i],
//       lockedOdds:      legOdds[i],        ← 用于结算时判断赢/输
//       status:          Pending,
//       isCredit:        false,
//       collateralBetId: bytes32(0),
//       isParlay:        true,
//       parlayId:        parlayId
//     })
// parlays[parlayId] = Parlay(user, stake, legBetIds, combinedOdds, maxPayout, Pending, 0, 0, 0)
// totalPotentialPayout += maxPayout
// emit ParlayLocked(parlayId, user, stake, legBetIds.length, combinedOdds, legBetIds)
```

> **串关各腿 Bet.amount = 0 说明：** 串关以整张为单位锁定和结算，stake 记录在 `Parlay` struct 上。各腿 `Bet` 的 `amount` 固定为 0，仅用于记录盘口信息和结算方向判定。

#### 取消注单

```solidity
/// @notice 取消普通注单，解锁余额
/// @param creditBetIds 以此注单为抵押的信用注单 ID（由 Jason 传入，合约校验归属）
function unlockBet(
    bytes32 betId,
    bytes32[] calldata creditBetIds
) external onlyAdmin;
// require(!bet.isParlay)（串关通过 unlockParlay 取消）
// require(bet.status == Pending)
// lockedBalances[user] -= amount
// totalPotentialPayout -= amount * lockedOdds / ODDS_PRECISION
// bets[betId].status = Cancelled
//
// 联动处理信用仓位（干净取消，与 6.6 Cancelled 不同 — Admin 主动取消时 Pool 收回出资）：
//   for each cid in creditBetIds:
//     require(bets[cid].collateralBetId == betId)   ← 校验归属
//     require(bets[cid].status == Pending)           ← 只处理未结算的
//     bettingPool += bets[cid].amount               ← 归还出资（Admin 取消 = 干净退回）
//     totalCreditOutstanding -= bets[cid].amount    ← 信用在途结清
//     totalPotentialPayout -= bets[cid].amount * bets[cid].lockedOdds / ODDS_PRECISION
//     bets[cid].status = Cancelled
//     emit CreditBetSettled(cid, user, Cancelled, 0, 0)
//     emit CreditCollateralCancelled(cid, betId, bets[cid].amount)
//   collateralUsed[betId] = 0
//   注：此处直接归还出资，不走 6.6 Cancelled 规则（6.6 用于结算时，Pool 承担信用风险）
//
// emit BetUnlocked(betId, user, amount)

/// @notice 取消串关（仅限所有腿均未结算时可调用）
function unlockParlay(bytes32 parlayId) external onlyAdmin;
// require(parlays[parlayId].status == Pending)
// require(parlays[parlayId].settledLegs == 0)   ← 部分结算的串关不可直接取消，需走赛事取消流程
// 遍历所有腿 bet，全部设为 Cancelled
// lockedBalances[user] -= parlay.stake
// totalPotentialPayout -= parlay.maxPayout
// parlays[parlayId].status = Cancelled
// emit ParlayUnlocked(parlayId, user, parlay.stake)
```

#### 信号灯

```solidity
/// @notice 更新信号灯（赔率调整后由 Jason 调用）
/// @dev Jason 根据链上 redLightThreshold 配置和各档阈值计算颜色后写入
function updateSignal(
    bytes32    matchId,
    MarketType market,
    uint8      line,
    uint256    heavyAmount,
    uint8      heavySide,
    SignalColor color
) external onlyAdmin;
// emit SignalUpdated(matchId, market, line, color)

/// @notice 查询串关各腿 betId 列表（Solidity 自动 getter 不返回动态数组）
function getParlayLegs(bytes32 parlayId) external view returns (bytes32[] memory);
// return parlays[parlayId].legBetIds

/// @notice 查询某盘口是否接受指定方向下注（Jason 下单前检查）
function isAccepting(
    bytes32    matchId,
    MarketType market,
    uint8      line,
    uint8      outcome
) external view returns (bool);
// Red 灯且 outcome == heavySide → false，否则 true
```

> **信号灯阈值说明：**
>
> | 颜色 | 重仓方向累计差额 | 处理 |
> |------|--------------|------|
> | 🟢 绿 | $0 – $8,000 | 正常接单 |
> | 🟡 黄 | $8,000 – $18,000 | 后端预警，继续接单 |
> | 🟠 橙 | $18,000 – $28,000 | 限额接单 |
> | 🔴 红 | > $28,000 | 重仓方向停止接单 |
>
> `redLightThreshold` 为链上透明配置（默认 $28,000），供 Jason 读取作为红灯判定依据。**各档阈值按比例缩放**（绿 < T×28.57%，黄 < T×64.29%，橙 < T×100%，红 ≥ T），T = redLightThreshold。当 T=$28,000 时：绿<$8,000、黄<$18,000、橙<$28,000、红≥$28,000，与产品文档一致。世界杯期间 Admin 通过多签调用 `setRedLightThreshold()` 收紧至 $8,000 时，所有档位等比缩小：绿<$2,286、黄<$5,143、橙<$8,000、红≥$8,000。Jason 读取链上新值后自动按比例调整。
>
> **橙灯"限额接单"规则：** 橙灯时重仓方向的单注上限降至正常值的 50%（由 Jason 链下在 lockBet 前校验）。合约层不区分橙/黄/绿，仅红灯时 `isAccepting()` 返回 false 拒绝重仓方向。橙灯限额为链下运营策略，不在合约层强制执行。

### 6.4 多签函数（Gnosis Safe，2/3 签名）

#### 结算

```solidity
/// @notice 结算赛事某盘口
/// @param betIds 该盘口下所有待结算注单 ID（由 Jason 提供，合约逐个校验）
function settle(
    bytes32    matchId,
    MarketType market,
    uint8      line,
    uint8      winningOutcome,
    bytes32[]  calldata betIds        // Jason 传入待结算注单列表（支持分批）
) external onlyMultisig nonReentrant;
// key = keccak256(abi.encode(matchId, market, line))
// require(marketStatus[key] == Closed || marketStatus[key] == Settled)
//   ← 必须先封盘再结算（Open 不可直接结算），Settled 允许后续分批
// 首次调用：require(marketOutcome[key] == 0)，存储 marketOutcome[key] = winningOutcome + 1
//           marketStatus[key] = Settled
// 后续批次：require(marketOutcome[key] == winningOutcome + 1)（校验结果一致性，marketStatus 已为 Settled）
//
// for each betId in betIds:
//   bet = bets[betId]
//   require(bet.matchId == matchId && bet.market == market && bet.line == line)  ← 校验归属
//   require(bet.status == Pending)    ← 逐注单幂等，已结算的自动跳过不会重复处理
//
//   ── 普通注单（isCredit=false, isParlay=false）──
//     赢家（bet.outcome == winningOutcome）：
//       payout = amount * lockedOdds / ODDS_PRECISION
//       userBalances[user] += (payout - amount)           ← 只加利润，stake 已在 userBalances 中
//       totalUserBalances += (payout - amount)            ← 同步递增累计总额
//       lockedBalances[user] -= amount                    ← 解锁 stake（变为可用）
//       bettingPool -= (payout - amount)                  ← Pool 赔出利润
//       totalPotentialPayout -= payout
//       bet.status = Won
//       emit BetSettled(betId, user, Won, payout)
//     输家：
//       userBalances[user] -= amount                      ← 扣除输掉的 stake
//       totalUserBalances -= amount                       ← 同步递减累计总额
//       lockedBalances[user] -= amount                    ← 解锁
//       bettingPool += amount * lpShareBps / BPS_DENOMINATOR
//       platformBalance += amount * (BPS_DENOMINATOR - lpShareBps) / BPS_DENOMINATOR
//       totalPotentialPayout -= amount * lockedOdds / ODDS_PRECISION
//       bet.status = Lost
//       emit BetSettled(betId, user, Lost, 0)
//
//     结算后清理 collateralUsed（无论赢/输）：
//       if (collateralUsed[betId] > 0):
//           collateralUsed[betId] = 0   ← 抵押仓位已结算，清理残余簿记数据
//
//   ── 串关腿（isParlay=true）──
//     见 6.5 串关结算逻辑（含逐注 emit）
//
//   ── 信用注单（isCredit=true）──
//     见 6.6 信用仓位结算逻辑（含逐注 emit）
//
// 仅首次调用时 emit（marketOutcome 从 0 变为非 0）：
//   emit MatchSettled(matchId, market, line, winningOutcome)
// 后续批次不重复 emit MatchSettled
```

> **settle 索引与分批说明：** 合约不维护按盘口索引的注单列表（避免 gas 开销）。由 Jason 链下索引所有 Pending 注单，按 `(matchId, market, line)` 分组后传入 `betIds`。合约逐个校验 matchId/market/line 一致性，不一致则 revert（`InvalidBetForMarket`）。**支持分批调用：** 首次调用时存储 `marketOutcome[key]`，后续批次校验 `winningOutcome` 一致性。逐注单幂等由 `bet.status == Pending` 保证，已结算注单不会被重复处理。
>
> **必须先封盘再结算：** settle 要求盘口状态为 Closed 或 Settled（分批），不接受 Open 状态。这确保了不会在盘口仍接单时就结算，符合盘口状态机设计（`NotCreated → Open ⇄ Closed → Settled / Cancelled`）。

### 6.5 串关结算逻辑（ParlayLib）

```
结算某盘口时，遇到 isParlay=true 的注单：

1. 若 parlays[parlayId].status != Pending → skip（已输的串关，剩余腿跳过）
2. 判定该腿赢/输，更新 bet.status
3. parlay.settledLegs += 1

4. 若该腿为 Lost：
   - 整张串关标记为 Lost
   - 剩余未结算腿状态设为 Cancelled（不再参与后续结算）
   - userBalances[user] -= parlay.stake                     ← 扣除输掉的 stake
   - totalUserBalances -= parlay.stake                      ← 同步递减累计总额
   - lockedBalances[user] -= parlay.stake                   ← 解锁
   - parlay.stake 按输家规则分配：
     bettingPool += stake * lpShareBps / BPS_DENOMINATOR
     platformBalance += stake * (BPS_DENOMINATOR - lpShareBps) / BPS_DENOMINATOR
   - totalPotentialPayout -= parlay.maxPayout
   - emit BetSettled(legBetId, user, Lost, 0)           ← 触发该腿
   - emit ParlayLost(parlayId, user, parlay.stake)

5. 若该腿为 Won：
   parlay.wonLegs += 1
   emit BetSettled(legBetId, user, Won, 0)              ← 单腿无独立 payout
   若 wonLegs + cancelledLegs == legBetIds.length（所有腿已有结果，且非取消的全赢）：
     payout = parlay.stake * parlay.combinedOdds / ODDS_PRECISION
     userBalances[user] += (payout - parlay.stake)          ← 只加利润
     totalUserBalances += (payout - parlay.stake)           ← 同步递增累计总额
     lockedBalances[user] -= parlay.stake                   ← 解锁 stake
     bettingPool -= (payout - parlay.stake)                 ← Pool 赔出利润
     totalPotentialPayout -= parlay.maxPayout
     parlay.status = Won
     emit ParlayWon(parlayId, user, payout)
```

### 6.6 信用仓位结算逻辑（LendingLib）

结算信用注单（isCredit=true）时的完整规则：

> **前置知识：** 信用仓位的 amount 在 lockCreditBet 时已从 bettingPool 扣减（Pool 出资）。

```
检查抵押仓位 bets[collateralBetId].status：

─── 抵押仓位已输（Lost）───
  无论本注单赢/输，均设为 Cancelled
  若本注单方向为赢家（outcome 匹配）：
    payout = amount * lockedOdds / ODDS_PRECISION
    platformBalance += payout（平台收益）
    bettingPool -= (payout - amount)               ← Pool 赔出利润（Pool 作为对赌方输了这注）
    // 总账：lock -amount + settle -(payout-amount) = -payout（Pool 支付全额赔付，转入 platform）
  若本注单方向为输家：
    bettingPool += amount（信用全额收回，无 70/30 分配）
  totalPotentialPayout -= amount * lockedOdds / ODDS_PRECISION
  totalCreditOutstanding -= amount                     ← 信用在途结清
  emit CreditBetForfeited(betId, collateralBetId, amount)
  emit CreditBetSettled(betId, user, Cancelled, 0, 0)

─── 抵押仓位已赢（Won）───
  按普通注单规则结算，但赢家需扣回信用额
  若本注单为赢家：
    payout = amount * lockedOdds / ODDS_PRECISION
    deduction = amount                 （归还信用本金）
    userBalances[user] += (payout - deduction)
    totalUserBalances += (payout - deduction)    ← 同步递增累计总额
    bettingPool -= (payout - amount)   （赔付差额）
    bettingPool += deduction           （收回信用本金）
    // 净效果：bettingPool -= (payout - amount - deduction) = bettingPool -= (payout - 2*amount)
    // 对比正常注单 bettingPool -= (payout - amount)，差值 = +amount（因创建时已扣 amount）
    // 总账：创建扣 -amount + 结算 -(payout-2*amount) = -(payout-amount) ← 与普通注单一致 ✓
    emit CreditBetSettled(betId, user, Won, payout - deduction, deduction)
  若本注单为输家：
    bettingPool += amount * lpShareBps / BPS_DENOMINATOR
    platformBalance += amount * (BPS_DENOMINATOR - lpShareBps) / BPS_DENOMINATOR
    // 总账：创建扣 -amount + 输家回收 +70%*amount = 净 -30%*amount（平台拿走 30%）
    emit CreditBetSettled(betId, user, Lost, 0, 0)
  totalPotentialPayout -= amount * lockedOdds / ODDS_PRECISION
  totalCreditOutstanding -= amount                     ← 信用在途结清

─── 抵押仓位仍 Pending（尚未结算）───
  若本注单为赢家：
    payout 写入 frozenPayouts[betId]，不立即入账
    totalFrozenPayouts += payout                     ← 计入冻结总额
    emit CreditPayoutFrozen(betId, user, payout)
    待抵押仓位结算后，由 releaseOrForfeiture() 决定
  若本注单为输家：
    按上方"抵押仓位已赢 + 本注单输家"同样规则分配（70/30）
    emit CreditBetSettled(betId, user, Lost, 0, 0)
  totalPotentialPayout -= amount * lockedOdds / ODDS_PRECISION
  totalCreditOutstanding -= amount                     ← 信用在途结清（无论赢家冻结还是输家分配）

─── 抵押仓位已取消（Cancelled）───
  资金池承担信用风险，不归还出资（lockCreditBet 时已扣减的 amount 留在"信用在途"状态）
  本注单按普通注单规则独立结算，Pool 作为出资方承担对赌风险
  若本注单为赢家：
    payout = amount * lockedOdds / ODDS_PRECISION
    userBalances[user] += payout                   ← 全额赔付（stake 来自 Pool，非用户）
    totalUserBalances += payout                    ← 同步递增累计总额
    bettingPool -= (payout - amount)               ← Pool 赔出利润
    // 总账：lock -amount + settle -(payout-amount) = -payout（Pool 承担全额赔付）
    emit CreditBetSettled(betId, user, Won, payout, 0)
  若本注单为输家：
    bettingPool += amount * lpShareBps / BPS_DENOMINATOR
    platformBalance += amount * (BPS_DENOMINATOR - lpShareBps) / BPS_DENOMINATOR
    // 总账：lock -amount + settle +70%*amount = -30%*amount（Pool 部分回收，平台拿 30%）
    emit CreditBetSettled(betId, user, Lost, 0, 0)
  totalPotentialPayout -= amount * lockedOdds / ODDS_PRECISION
  totalCreditOutstanding -= amount                     ← 信用在途结清
  emit CreditCollateralCancelled(betId, collateralBetId, amount)
```

#### 释放 / 没收冻结赔付

```solidity
/// @notice 抵押仓位结算后，处理冻结的信用仓位赢利
function releaseOrForfeiture(bytes32 creditBetId) external onlyAdmin;
// require(frozenPayouts[creditBetId] > 0)                         ← 幂等保护，防止重复调用凭空修改 Pool
// 检查 bets[collateralBetId].status：
//
//   Won →
//     deduction = bets[creditBetId].amount
//     netPayout = frozenPayouts[creditBetId] - deduction
//     userBalances[user] += netPayout
//     totalUserBalances += netPayout                                          // 同步递增累计总额
//     bettingPool -= (frozenPayouts[creditBetId] - bets[creditBetId].amount)  // 赔付差额
//     bettingPool += deduction                                                // 收回信用
//     emit CreditPayoutReleased(creditBetId, user, netPayout)
//
//   Lost →
//     platformBalance += frozenPayouts[creditBetId]
//     bettingPool -= (frozenPayouts[creditBetId] - bets[creditBetId].amount)  // Pool 赔出利润
//     // 总账：lock -amount + settle -(payout-amount) = -payout（Pool 承担全额，转入 platform）
//     emit CreditPayoutForfeited(creditBetId, frozenPayouts[creditBetId])
//
//   Cancelled →（Pool 承担信用风险，不归还出资）
//     userBalances[user] += frozenPayouts[creditBetId]  // 全额释放赢利给用户
//     totalUserBalances += frozenPayouts[creditBetId]  // 同步递增累计总额
//     bettingPool -= (frozenPayouts[creditBetId] - bets[creditBetId].amount)  // Pool 赔出利润
//     // 总账：lock -amount + settle -(payout-amount) = -payout（Pool 承担全额赔付）
//     emit CreditPayoutReleased(creditBetId, user, frozenPayouts[creditBetId])
//
// totalFrozenPayouts -= frozenPayouts[creditBetId]   ← 释放冻结总额
// delete frozenPayouts[creditBetId]
```

### 6.7 赛事取消

```solidity
/// @notice 取消赛事某盘口（赛事因故取消时调用）
/// @param betIds 该盘口下所有待处理注单 ID（由 Jason 提供）
function cancelMatch(
    bytes32    matchId,
    MarketType market,
    uint8      line,
    bytes32[]  calldata betIds
) external onlyMultisig nonReentrant;
// key = keccak256(abi.encode(matchId, market, line))
// require(marketStatus[key] == Open || marketStatus[key] == Closed || marketStatus[key] == Cancelled)
//   ← Open/Closed 允许首次取消，Cancelled 允许后续分批
// 首次调用：marketStatus[key] = Cancelled
// 后续批次：marketStatus 已为 Cancelled，直接继续处理
//
// for each betId in betIds:
//   bet = bets[betId]
//   require(bet.matchId == matchId && bet.market == market && bet.line == line)
//   require(bet.status == Pending)    ← 逐注单幂等，已取消的不会重复处理
//
//   ── 普通注单（isCredit=false, isParlay=false）──
//     lockedBalances[user] -= amount
//     totalPotentialPayout -= amount * lockedOdds / ODDS_PRECISION
//     bet.status = Cancelled
//     emit BetSettled(betId, user, Cancelled, 0)
//
//   ── 串关腿（isParlay=true）──
//     见下方「串关腿取消逻辑」
//
//   ── 信用注单（isCredit=true）──
//     ⚠️ 注意区分：此处是信用注单自身所在盘口被取消（直接退回出资），
//     与 6.6 Cancelled 分支不同 — 6.6 是"抵押仓位被取消、信用注单仍存活"（Pool 承担风险不退回出资）
//     bettingPool += amount（归还出资 — 盘口取消属于干净退回）
//     totalCreditOutstanding -= amount                ← 信用在途结清
//     collateralUsed[bet.collateralBetId] -= amount   ← 释放抵押额度，允许重新借出
//     // ⚠️ 注意：若抵押仓位已在同批次中被取消（collateralUsed 已清零），
//     //    此处需先检查 collateralUsed >= amount，避免 underflow
//     if (collateralUsed[bet.collateralBetId] >= amount):
//         collateralUsed[bet.collateralBetId] -= amount
//     else:
//         collateralUsed[bet.collateralBetId] = 0      ← 安全兜底
//     totalPotentialPayout -= amount * lockedOdds / ODDS_PRECISION
//     bet.status = Cancelled
//     emit CreditBetSettled(betId, user, Cancelled, 0, 0)
//     （若有冻结赔付 frozenPayouts[betId] > 0，不受影响，由 releaseOrForfeiture 处理）
//
//   ── 作为抵押仓位的注单（同时是普通注单，已在上方处理取消和退款）──
//     collateralUsed[betId] = 0（簿记清零）
//     注：不立即处理跨盘口的信用子注单，也不归还出资（Pool 承担信用风险）。
//         信用子注单在自身盘口 settle 时，检测到 collateral 状态为 Cancelled，
//         自动走 6.6 Cancelled 规则（Pool 作为出资方承担对赌风险，不做 bettingPool += amount）。
//         若信用子注单已有冻结赔付，由 releaseOrForfeiture() Cancelled 分支处理（同样不归还出资）。
//
// emit MatchCancelled(matchId, market, line)
```

#### 串关腿取消逻辑

```
cancelMatch 遇到 isParlay=true 的注单时：

1. 若 parlays[parlayId].status != Pending → skip（串关已结束）
2. bet.status = Cancelled
3. parlay.cancelledLegs += 1
4. 重新计算串关赔率：
   newCombinedOdds = parlay.combinedOdds * ODDS_PRECISION / bet.lockedOdds
   （移除该腿的赔率贡献）

5. 计算剩余有效腿数 = legBetIds.length - parlay.cancelledLegs

6. 若剩余有效腿数 >= 2：
   - parlay.combinedOdds = newCombinedOdds
   - newMaxPayout = parlay.stake * newCombinedOdds / ODDS_PRECISION
   - assert(newMaxPayout <= parlay.maxPayout)            ← 防御性断言：取消腿后赔付应不增
   - 更新 totalPotentialPayout：减去旧 maxPayout，加上 newMaxPayout
   - parlay.maxPayout = newMaxPayout
   - emit ParlayLegCancelled(parlayId, betId, newCombinedOdds)
   - ── 检查是否已全部结清（见步骤 9）──

7. 若剩余有效腿数 == 1：
   - 串关退化为单注
   - 找到唯一剩余的**非 Cancelled** 腿（可能为 Pending 或 Won），其 lockedOdds 即为新赔率
   - parlay.combinedOdds = 该腿 lockedOdds
   - newMaxPayout = parlay.stake * 该腿 lockedOdds / ODDS_PRECISION
   - assert(newMaxPayout <= parlay.maxPayout)            ← 防御性断言
   - 更新 totalPotentialPayout：减去旧 maxPayout，加上 newMaxPayout
   - parlay.maxPayout = newMaxPayout
   - emit ParlayDegradedToSingle(parlayId, remainingBetId, newOdds)
   - ── 检查是否已全部结清（见步骤 9）──

8. 若剩余有效腿数 == 0：
   - 全额退款（合并余额模型：stake 在 lockParlay 时未从 userBalances 扣减，只锁定了 lockedBalances）
   - lockedBalances[user] -= parlay.stake（解锁，stake 自动变为可用）
   - totalPotentialPayout -= parlay.maxPayout
   - parlay.status = Cancelled
   - emit ParlayUnlocked(parlayId, user, parlay.stake)

9. 取消后自动结算检查（步骤 6、7 结束后执行）：
   若 parlay.wonLegs + parlay.cancelledLegs == legBetIds.length && parlay.status == Pending：
     // 所有非取消腿均已赢 → 串关已全部有结果，立即结算为 Won
     payout = parlay.stake * parlay.combinedOdds / ODDS_PRECISION
     userBalances[user] += (payout - parlay.stake)
     totalUserBalances += (payout - parlay.stake)
     lockedBalances[user] -= parlay.stake
     bettingPool -= (payout - parlay.stake)
     totalPotentialPayout -= parlay.maxPayout
     parlay.status = Won
     emit ParlayWon(parlayId, user, payout)

注意：若串关已因某腿输球标记为 Lost（status != Pending），赛事取消不追溯改判。
```

```solidity
/// @notice 批量取消赛事（同一赛事多盘口一次性取消）
function batchCancelMatch(
    bytes32    matchId,
    MarketType[] calldata markets,
    uint8[]    calldata lines,
    bytes32[][] calldata betIdsByMarket   // 每个盘口对应的 betIds
) external onlyMultisig nonReentrant;
// 遍历 markets/lines/betIdsByMarket，逐个执行 cancelMatch 逻辑
// emit MatchCancelled for each market
```

> **赛事取消 vs 注单取消区别：** `cancelMatch()` / `batchCancelMatch()` 由多签调用，用于赛事盘口取消（不可逆）。`unlockBet()` / `unlockParlay()` 由 Admin 单签调用，用于取消尚未开赛的单个注单。

### 6.8 LP 函数

```solidity
/// @notice LP 添加对赌池资金
function addLiquidity(uint256 amount) external nonReentrant whenNotPaused;
// 任何人均可调用（LP 投资人）
// require(amount >= MIN_LP_DEPOSIT)                    ← 最小存入量防精度攻击
// usdt.safeTransferFrom(msg.sender, address(this), amount)
// shares = (totalLpShares == 0) ? amount : amount * totalLpShares / bettingPool
// if (shares == 0) revert SharesIsZero()               ← 防止因精度截断获得 0 份额
// lpShares[msg.sender] += shares
// totalLpShares += shares
// bettingPool += amount
// emit LiquidityAdded(msg.sender, amount, shares)

/// @notice LP 提取对赌池资金 + 收益
function removeLiquidity(uint256 shares) external nonReentrant whenNotPaused;
// amount = shares * bettingPool / totalLpShares
// availableLiquidity = bettingPool - totalPotentialPayout - totalFrozenPayouts
// require(amount <= availableLiquidity, "InsufficientLiquidity")  ← 防止挤兑
// lpShares[msg.sender] -= shares
// totalLpShares -= shares
// bettingPool -= amount
// usdt.safeTransfer(msg.sender, amount)
// emit LiquidityRemoved(msg.sender, amount, shares)

/// @notice 平台提取 30% Margin 收益
function withdrawPlatform(address to, uint256 amount) external onlyMultisig;
// require(amount <= platformBalance)
// platformBalance -= amount
// usdt.safeTransfer(to, amount)
// emit PlatformWithdrawn(to, amount)

/// @notice 调整每赛事最大盘口数（全局配置，需多签审批）
function setMaxMarketsPerMatch(uint256 max) external onlyMultisig;
// maxMarketsPerMatch = max
// emit MaxMarketsPerMatchUpdated(max)

/// @notice 调整红灯阈值（世界杯多盘口期间收紧）
/// @dev 链上透明配置，Jason 读取此值作为信号灯判定依据
function setRedLightThreshold(uint256 threshold) external onlyMultisig;
// uint256 old = redLightThreshold
// redLightThreshold = threshold
// emit RedLightThresholdUpdated(old, threshold)

// ── 以下为多签管理函数（非 LP 专属，归入此处便于集中管理）──

/// @notice 更换 Admin 地址（密钥轮换）
function setAdmin(address newAdmin) external onlyMultisig;
// require(newAdmin != address(0))
// address old = admin
// admin = newAdmin
// emit AdminUpdated(old, newAdmin)

/// @notice 调整 LP/平台分成比例
function setLpShareBps(uint256 newBps) external onlyMultisig;
// if (newBps < 5000 || newBps > 9000) revert InvalidLpShareBps()  ← 限制范围 50%-90%
// uint256 old = lpShareBps
// lpShareBps = newBps
// emit LpShareBpsUpdated(old, newBps)

/// @notice 紧急暂停 / 恢复
function pause() external onlyMultisig;
function unpause() external onlyMultisig;
```

> **LP 流动性保护：** `removeLiquidity` 检查 `bettingPool - totalPotentialPayout - totalFrozenPayouts` 作为可提取上限，确保池中始终保留足够资金覆盖所有 Pending 注单的潜在赔付以及已冻结但尚未释放的信用仓位赔付，防止 LP 挤兑导致合约无法兑付。

### 6.9 收益分配逻辑

```
用户输掉 amount：
  userBalances      -= amount（扣除输掉的 stake）
  totalUserBalances -= amount（同步递减累计总额）
  lockedBalances    -= amount（解锁）
  bettingPool    += amount × 70%（LP 用户按份额分）
  platformBalance += amount × 30%（平台收益）

用户赢了 payout（= amount × odds / 1000）：
  userBalances      += (payout - amount)（只加利润，stake 已在 userBalances 中）
  totalUserBalances += (payout - amount)（同步递增累计总额）
  lockedBalances    -= amount（解锁 stake，变为可用）
  bettingPool    -= (payout - amount)（从对赌池赔出利润）

USDT 不变量（任意时刻恒成立）：
  Contract USDT = totalUserBalances + bettingPool + platformBalance + totalPendingWithdrawals + totalCreditOutstanding
  注：totalUserBalances = sum(userBalances)，链上维护累计值用于 creditDeposit 校验
  注：totalPendingWithdrawals 跟踪大额提现已扣减但未转出的 USDT
  注：totalCreditOutstanding 跟踪信用仓位从 Pool 借出、尚未结算归还的 USDT
  注：userBalances 包含锁定金额（lockedBalances 为追踪用子集，不独立计入不变量）

信用仓位出资与归还（每条路径均执行 totalCreditOutstanding -= amount）：
  创建时：bettingPool -= amount，totalCreditOutstanding += amount（Pool 出资，记入在途）
  A赢 + B赢：bettingPool += amount（收回信用）- (payout-amount)（赔出利润）
  A赢 + B输：bettingPool += amount × 70%（部分回收，平台拿 30%）
  A输 + B赢：platformBalance += payout，bettingPool -= (payout-amount)（Pool 赔出利润，总计承担 -payout）
  A输 + B输：bettingPool += amount（全额收回）
  A取消 + B赢：Pool 承担全额赔付 -payout（不归还出资）
  A取消 + B输：Pool 部分回收 +70%×amount（不归还出资，净亏 30%）
  B自身盘口取消：bettingPool += amount（干净退回出资）
  unlockBet联动取消：bettingPool += amount（干净退回出资）
```

---

## 七、事件清单

```solidity
// ── 充值 / 提现 ──────────────────────────────────
event Deposited(address indexed user, uint256 amount, bytes32 indexed txHash);
event Withdrawn(address indexed user, uint256 amount);
event LargeWithdrawalRequested(bytes32 indexed requestId, address indexed user, uint256 amount);
event LargeWithdrawalRejected(bytes32 indexed requestId, address indexed user, uint256 amount);

// ── 普通注单 ─────────────────────────────────────
event BetLocked(bytes32 indexed betId, address indexed user, uint256 amount, bytes32 indexed matchId);
event BetUnlocked(bytes32 indexed betId, address indexed user, uint256 amount);
event BetSettled(bytes32 indexed betId, address indexed user, BetStatus status, uint256 payout);
//   settle() 中对每条注单逐一 emit，供链下逐注对账

// ── 盘口结算（聚合事件）──────────────────────────
event MatchSettled(bytes32 indexed matchId, MarketType market, uint8 line, uint8 winningOutcome);

// ── 串关 ─────────────────────────────────────────
event ParlayLocked(bytes32 indexed parlayId, address indexed user, uint256 stake, uint8 legs, uint256 combinedOdds, bytes32[] legBetIds);
event ParlayUnlocked(bytes32 indexed parlayId, address indexed user, uint256 stake);
event ParlayWon(bytes32 indexed parlayId, address indexed user, uint256 payout);
event ParlayLost(bytes32 indexed parlayId, address indexed user, uint256 stake);

// ── 信用仓位 ─────────────────────────────────────
event CreditBetLocked(bytes32 indexed betId, bytes32 indexed collateralBetId, address indexed user, uint256 amount);
event CreditBetSettled(bytes32 indexed betId, address indexed user, BetStatus status, uint256 payout, uint256 deduction);
//   信用注单结算的专用事件，deduction=扣回的信用额（无扣回时为 0）
event CreditPayoutFrozen(bytes32 indexed betId, address indexed user, uint256 payout);
event CreditPayoutReleased(bytes32 indexed betId, address indexed user, uint256 netPayout);
event CreditPayoutForfeited(bytes32 indexed betId, uint256 payout);
event CreditBetForfeited(bytes32 indexed betId, bytes32 indexed collateralBetId, uint256 amount);
event CreditCollateralCancelled(bytes32 indexed betId, bytes32 indexed collateralBetId, uint256 amount);

// ── LP ───────────────────────────────────────────
event LiquidityAdded(address indexed provider, uint256 amount, uint256 shares);
event LiquidityRemoved(address indexed provider, uint256 amount, uint256 shares);

// ── 信号灯 ───────────────────────────────────────
event SignalUpdated(bytes32 indexed matchId, MarketType market, uint8 line, SignalColor color);

// ── 盘口生命周期 ─────────────────────────────────
event MarketOpened(bytes32 indexed matchId, MarketType market, uint8 line);
event MarketClosed(bytes32 indexed matchId, MarketType market, uint8 line);
event MarketReopened(bytes32 indexed matchId, MarketType market, uint8 line);

// ── 赛事取消 ─────────────────────────────────────
event MatchCancelled(bytes32 indexed matchId, MarketType market, uint8 line);
event ParlayLegCancelled(bytes32 indexed parlayId, bytes32 indexed betId, uint256 newCombinedOdds);
event ParlayDegradedToSingle(bytes32 indexed parlayId, bytes32 indexed remainingBetId, uint256 newOdds);

// ── 管理操作 ─────────────────────────────────────
event PlatformWithdrawn(address indexed to, uint256 amount);
event RedLightThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
event MaxMarketsPerMatchUpdated(uint256 newMax);
event AdminUpdated(address indexed oldAdmin, address indexed newAdmin);
event LpShareBpsUpdated(uint256 oldBps, uint256 newBps);
```

---

## 八、与 Jason 的接口边界

| 操作 | Hawk 提供 | Jason 负责 |
|------|----------|-----------|
| 盘口开放 | `openMarket()` / `batchOpenMarkets()` | 赛事数据就绪、初始赔率计算完成后调用 |
| 盘口封盘 | `closeMarket()` / `batchCloseMarkets()` | 赛事开始前调用，停止该盘口接单 |
| 盘口重开 | `reopenMarket()`（多签） | 赛事延期/误封盘，需多签审批 |
| 用户充值确认 | `creditDeposit()` | 监听 USDT 合约 Transfer 事件，12 确认后调用 |
| 下单锁定 | `lockBet()` | 验证通过后调用（合约检查盘口 Open 状态） |
| 串关锁定 | `lockParlay()` | 验证规则后调用（赛事去重、红灯检查） |
| 信用仓位锁定 | `lockCreditBet()` | 验证抵押条件后调用 |
| 信号灯更新 | `updateSignal()` | 读取链上 `redLightThreshold`，按比例计算颜色后调用 |
| 接单拦截查询 | `isAccepting()` | 下单前查询 |
| 赛事结算 | `settle(matchId, market, line, outcome, betIds)` | 准备 betIds 列表 + 多签 calldata，推送给 Admin 审批；支持分批 |
| 赛事取消 | `cancelMatch()` / `batchCancelMatch()` | 赛事取消时准备 betIds + 多签 calldata；支持逐盘口或批量 |
| 冻结赔付释放 | `releaseOrForfeiture()` | 抵押仓位结算后调用 |
| 提现确认 | `Withdrawn` 事件 | 监听后更新 DB |
| 大额提现审核 | `rejectLargeWithdrawal()` | 审核不通过时调用 |

> **对齐时间：** 4/1 前 Hawk 和 Jason 需对齐 `lockBet()`、`lockParlay()` 和 `settle()` 的参数格式，否则 W3 联调会卡。

---

## 九、安全要求

| 要求 | 说明 |
|------|------|
| UUPS Upgradeable | 所有合约可升级，`_authorizeUpgrade()` 限多签 |
| ReentrancyGuard | 所有资金操作防重入 |
| Pausable | 紧急情况可暂停合约 |
| 分批结算 | `settle()` 支持分批调用，`marketOutcome` 保证结果一致性，逐注单 `Pending` 检查防重复 |
| 权限分级 | lockBet/updateSignal/creditDeposit（Admin 单签）vs settle/withdrawPlatform/upgrade/setMaxMarketsPerMatch/setAdmin/setLpShareBps（多签） |
| 密钥轮换 | `setAdmin()` 支持多签更换 Admin 地址，防止私钥泄露后无法恢复 |
| ID 唯一性 | lockBet/lockCreditBet/lockParlay 检查 ID 不存在，防止覆盖已有注单 |
| 全局硬上限 | `GLOBAL_MAX_BET` $10,000 — 合约层兜底，防止后端异常时的极端单注 |
| LP 精度攻击防护 | `MIN_LP_DEPOSIT` $1,000 + `require(shares > 0)` — 防止首笔存入精度攻击 |
| 充值余额校验 | `creditDeposit` 检查 `balanceOf >= totalUserBalances + bettingPool + platformBalance + totalPendingWithdrawals + totalCreditOutstanding + amount`，含信用在途，防止凭空入账 |
| 大额提现竞态防护 | `rejectLargeWithdrawal` 限制在等待期内调用，防止 reject/execute 竞态 |
| 充值去重 | `processedDeposits[txHash]` 防止重复入账 |
| 大额提现 | > $5,000 进入 24h 审核等待期，余额立即扣减防重复提交 |
| 信用累计校验 | `collateralUsed` 防止同一抵押仓位超额借贷 |
| LP 流动性保护 | `removeLiquidity` 受 `totalPotentialPayout + totalFrozenPayouts` 约束，防止挤兑 |
| Storage Layout | 变量声明顺序不可变，新增只能追加末尾 |
| 部署后 30 天 | Admin 权限移交 Gnosis Safe 多签 |

---

## 十、部署顺序

```
首次部署：
1. 部署 BettingPool Implementation 合约（含 constructor + _disableInitializers）
2. 部署 ERC1967Proxy，指向 Implementation，调用 initialize(usdt, admin, multisig)
3. 初始化 LP：调用 addLiquidity() 注入初始对赌池资金
4. 设置 Jason 后端地址为 Admin
5. 测试网完整流程验证后上主网
6. 主网部署后验证 Proxy → Implementation 指向正确

合约升级：
1. 暂停合约（pause）
2. 新增 storage 变量只能追加到末尾，不可改变已有变量顺序
3. 若新增变量需要非零初始值（如 totalCreditOutstanding 在已有信用仓位时不能为 0）：
   a. 方案 A（推荐）：升级前结清所有在途仓位，确保新变量初始值 0 正确
   b. 方案 B：编写 reinitializer(N) 函数，在升级时遍历/计算已有数据赋值
4. 部署新 Implementation，通过多签调用 upgradeToAndCall() 执行升级 + re-initialize
5. 验证 Storage 布局正确、新功能可用
6. 恢复合约（unpause）
```

---

## 十一、验收节点

| 日期 | 验收内容 |
|------|---------|
| **4/7** | 测试网部署（UUPS Proxy）；creditDeposit / withdraw / lockBet / settle 完整流程跑通 |
| **4/14** | LP addLiquidity / removeLiquidity 完成；收益分配比例验证；大额提现审核流程验证；LP 流动性保护验证 |
| **4/21** | 信号灯接入；多盘口（1X2+AH+OU）结算测试通过；分批 settle 验证；串关 lockParlay / 结算全链路 |
| **4/28** | Lending 全场景结算验证（含冻结释放、累计借贷上限）；赛事取消全场景（普通/串关/信用联动）；与 Jason 联调完成；E2E 全链路 |
| **5/5** | 合约升级流程演练；Slither 全量扫描通过；Fuzz 测试覆盖关键函数；会计恒等式校验 |
