# BettingPool.sol 对抗性安全代码审查报告

**审查日期：** 2026-04-01
**审查范围：** `src/core/BettingPool.sol` 及所有 libraries
**审查类型：** 对抗性安全审查（READ-ONLY）
**编译器：** Solidity 0.8.28, via_ir=true, OpenZeppelin v5

---

## 审查摘要

**文件审查数：** 10
**发现总数：** 14

| 严重度 | 数量 |
|--------|------|
| CRITICAL | 1 |
| HIGH | 2 |
| MEDIUM | 6 |
| LOW | 3 |
| INFO | 2 |

---

## CRITICAL

### [C-01] UUPS 代理合约使用了非可升级版本的 ReentrancyGuard

- **Location**: `src/core/BettingPool.sol:6`, `src/core/BettingPool.sol:28`
- **Description**:
  合约导入并继承了 `@openzeppelin/contracts/utils/ReentrancyGuard.sol`（非可升级版本），而非 `@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol`。

  在 OZ v5 中，非可升级版 `ReentrancyGuard` 的 constructor 将 `_status` 设为 `_NOT_ENTERED (1)`。但在 UUPS 代理模式下，constructor 只在 implementation 合约上执行，proxy 的存储中 `_status` 初始为 `0`。虽然功能上 `0 != _ENTERED(2)` 使得 `nonReentrant` 修饰符仍可通过检查，但这依赖于实现细节而非正确初始化。

  更关键的是，开发文档（`docs/development/USDT版本合约任务.md` 第 82 行）明确规定继承链应为 `Initializable, UUPSUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable`，当前实现违反了设计规范。

  同时，`initialize()` 函数缺少 `__ReentrancyGuard_init()` 调用（因为使用了非可升级版本，该函数不存在），这意味着在 proxy 的存储上下文中 ReentrancyGuard 从未被正确初始化。

- **Impact**:
  - 违反 UUPS 可升级合约最佳实践，proxy 存储中 `_status` 未正确初始化
  - 未来 OpenZeppelin 版本升级若改变 `_NOT_ENTERED` 的值或检查逻辑，可能导致 `nonReentrant` 失效
  - 违反项目设计规范
  - 在合约升级时可能引发不可预测的行为

- **Recommendation**:
  ```solidity
  // 替换导入
  - import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
  + import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

  // 替换继承
  - ReentrancyGuard,
  + ReentrancyGuardUpgradeable,

  // 在 initialize() 中添加
  + __ReentrancyGuard_init();
  ```

---

## HIGH

### [H-01] `releaseOrForfeiture` 使用 `onlyAdmin` 而非 `onlyMultisig`，违反访问控制设计

- **Location**: `src/core/BettingPool.sol:773`
- **Description**:
  `releaseOrForfeiture()` 函数使用 `onlyAdmin` 修饰符，但在接口 `IBettingPool.sol` 中（第 148-160 行）该函数被归类在 "Multisig Functions" 区段下。该函数执行冻结赔付的释放或没收操作，直接影响用户资金和平台资金分配。

  结算相关操作（`settle`、`cancelMatch`）均要求 `onlyMultisig`，`releaseOrForfeiture` 作为结算后的资金释放操作，安全等级应当一致。

- **Impact**:
  单一 admin（后端服务器密钥）即可触发冻结赔付的释放或没收，绕过多签保护。若 admin 密钥泄露，攻击者可将冻结赔付没收到 platformBalance 或错误释放给用户。

- **Recommendation**:
  ```solidity
  - function releaseOrForfeiture(bytes32 creditBetId) external onlyAdmin {
  + function releaseOrForfeiture(bytes32 creditBetId) external onlyMultisig {
  ```

### [H-02] `initialize()` 缺少 `__UUPSUpgradeable_init()` 调用

- **Location**: `src/core/BettingPool.sol:112-121`
- **Description**:
  `initialize()` 函数仅调用了 `__Pausable_init()`，缺少 `__UUPSUpgradeable_init()` 调用。开发文档（第 99 行）明确要求调用该初始化函数。虽然在 OZ v5 中 `__UUPSUpgradeable_init()` 可能是空操作，但省略它违反了可升级合约初始化链的最佳实践，且若 OZ 未来版本在该 init 中添加逻辑，合约升级后将缺少必要的初始化。

- **Impact**:
  违反 OpenZeppelin 可升级合约规范，未来升级存在潜在风险。

- **Recommendation**:
  ```solidity
  function initialize(address _usdt, address _admin, address _multisig) external initializer {
  +   __UUPSUpgradeable_init();
  +   __ReentrancyGuard_init();  // 修复 C-01 后
      __Pausable_init();
      // ...
  }
  ```

---

## MEDIUM

### [M-01] 普通注单和串关亏损的 70/30 分成计算存在精度截断，导致记账不变式泄漏

- **Location**: `src/core/BettingPool.sol:611-612`, `src/core/BettingPool.sol:655-656`
- **Description**:
  普通注单亏损和串关亏损的分成使用两次独立整除：
  ```solidity
  // 当前代码（BettingPool.sol:611-612）
  bettingPool += (amount * lpShareBps) / BPS_DENOMINATOR;
  platformBalance += amount * (BPS_DENOMINATOR - lpShareBps) / BPS_DENOMINATOR;
  ```
  由于整数除法截断，`lpShare + platShare` 可能小于 `amount`。例如：
  - `amount = 3`, `lpShareBps = 7000`: `lpShare = 21000/10000 = 2`, `platShare = 9000/10000 = 0`, 总计 `2 < 3`

  而信用注单亏损路径（`_settleCreditBet` 第 728-729 行）正确使用了减法：
  ```solidity
  uint256 lpShare = (amount * lpShareBps) / BPS_DENOMINATOR;
  uint256 platShare = amount - lpShare;
  ```

  记账不变式 `usdt.balanceOf(this) >= totalUserBalances + bettingPool + platformBalance + totalPendingWithdrawals + totalCreditOutstanding` 会因每次亏损结算逐渐产生正向偏差（合约实际余额 > 记账总和），导致少量资金永久"消失"在记账系统之外。

- **Impact**:
  虽然单次泄漏极小（dust 级别），但在海量小额注单场景下会累积。不影响合约安全（余额始终 >= 记账），但违反精确记账原则。

- **Recommendation**:
  统一使用减法避免双重截断：
  ```solidity
  uint256 lpShare = (amount * lpShareBps) / BPS_DENOMINATOR;
  uint256 platShare = amount - lpShare;
  bettingPool += lpShare;
  platformBalance += platShare;
  ```

### [M-02] `addLiquidity` 违反 Checks-Effects-Interactions 模式

- **Location**: `src/core/BettingPool.sol:994-1001`
- **Description**:
  `addLiquidity()` 在更新状态变量之前执行了外部调用 `safeTransferFrom`：
  ```solidity
  function addLiquidity(uint256 amount) external nonReentrant whenNotPaused {
      require(amount >= MIN_LP_DEPOSIT, "below min deposit");
      usdt.safeTransferFrom(msg.sender, address(this), amount);  // 外部调用在前
      uint256 shares = LiquidityLib.calcShares(amount, totalLpShares, bettingPool);  // 状态读取在后
      lpShares[msg.sender] += shares;  // 状态更新在后
      totalLpShares += shares;
      bettingPool += amount;
  }
  ```
  虽然 `nonReentrant` 提供了保护，但 CEI 违反本身是一个代码质量问题，也违反了项目编码红线中 "外部调用必须遵循 Checks-Effects-Interactions 模式" 的要求。

- **Impact**:
  若将来移除或修改 `nonReentrant` 保护，将暴露重入风险。同时，BSC 上的 USDT 可能被替换为带回调功能的代币（如 ERC-777），此时 CEI 违反将成为真实漏洞。

- **Recommendation**:
  先更新状态，再执行外部调用：
  ```solidity
  function addLiquidity(uint256 amount) external nonReentrant whenNotPaused {
      require(amount >= MIN_LP_DEPOSIT, "below min deposit");
      uint256 shares = LiquidityLib.calcShares(amount, totalLpShares, bettingPool);
      lpShares[msg.sender] += shares;
      totalLpShares += shares;
      bettingPool += amount;
      usdt.safeTransferFrom(msg.sender, address(this), amount);  // 外部调用最后
  }
  ```

### [M-03] 信用注单与抵押注单在同一盘口结算时存在顺序依赖

- **Location**: `src/core/BettingPool.sol:550-587` (`settle` 函数)
- **Description**:
  `lockCreditBet()` 不禁止信用注单与其抵押注单属于同一盘口（matchId + market + line）的不同 outcome。当 `settle()` 被调用时，`betIds` 数组中的顺序决定了信用注单看到的抵押状态：

  - 若抵押注单在 betIds 中排在前面 → 先被结算为 Won/Lost → 信用注单看到最终状态 → 正常结算
  - 若信用注单在 betIds 中排在前面 → 抵押状态仍为 Pending → 赔付被冻结 → 需要额外的 `releaseOrForfeiture` 调用

  两种顺序产生不同的结算路径和最终结果（冻结 vs 直接结算），且赔付金额可能因多次精度截断而有微小差异。

- **Impact**:
  多签操作者必须确保 betIds 的正确排序，否则将触发不必要的冻结流程，增加操作复杂度和 gas 成本。

- **Recommendation**:
  方案 A: 在 `settle()` 中对 betIds 排序，优先结算非信用注单
  方案 B: 在 `lockCreditBet()` 中禁止信用注单与抵押注单属于同一 marketKey

### [M-04] 串关取消时组合赔率重算存在精度损失

- **Location**: `src/core/BettingPool.sol:896`
- **Description**:
  取消串关腿时，组合赔率通过除法反向计算：
  ```solidity
  uint256 newCombinedOdds = (parlay.combinedOdds * ODDS_PRECISION) / bet.lockedOdds;
  ```
  乘法→除法→再除法的链路会累积精度损失。例如：
  - 赔率 1818 × 1500 → combinedOdds = 2727
  - 取消第一腿（1818）: (2727 × 1000) / 1818 = 1499（应为 1500）

  当 `remainingLegs == 1` 时使用了直接赋值 `bets[remainingBetId].lockedOdds`（第 909 行），正确避免了此问题。但 `remainingLegs >= 2` 时仍使用除法（第 917 行）。

- **Impact**:
  精度损失导致赔付金额略低于理论值，用户蒙受微小损失。多次取消后损失累积。

- **Recommendation**:
  对于剩余 2+ 腿的情况，重新从剩余腿的 lockedOdds 连乘计算 combinedOdds，而非通过除法反向推导：
  ```solidity
  // 重新计算而非除法反推
  uint256 newCombinedOdds = ODDS_PRECISION;
  for (uint256 i = 0; i < legIds.length; i++) {
      if (bets[legIds[i]].status != BetStatus.Cancelled) {
          newCombinedOdds = (newCombinedOdds * bets[legIds[i]].lockedOdds) / ODDS_PRECISION;
      }
  }
  ```

### [M-05] `withdrawPlatform` 缺少 `nonReentrant` 保护

- **Location**: `src/core/BettingPool.sol:1017-1023`
- **Description**:
  `withdrawPlatform()` 执行 `usdt.safeTransfer()` 外部调用，但仅有 `onlyMultisig` 访问控制，缺少 `nonReentrant` 修饰符。虽然 BSC USDT 不具备回调功能，且 `onlyMultisig` 已限制调用者，但作为防御性编程和合约编码规范要求，所有涉及资产转移的函数应添加 `nonReentrant`。

- **Impact**:
  当前 BSC USDT 实现下风险极低。但若通过 UUPS 升级切换到其他代币或部署到其他链，可能引入重入风险。

- **Recommendation**:
  ```solidity
  - function withdrawPlatform(address to, uint256 amount) external onlyMultisig {
  + function withdrawPlatform(address to, uint256 amount) external onlyMultisig nonReentrant {
  ```

### [M-06] UUPS 可升级合约缺少 storage gap

- **Location**: `src/core/BettingPool.sol`（末尾）
- **Description**:
  合约未声明 `__gap` 存储占位变量。虽然 OZ v5 的父合约使用 ERC-7201 命名空间存储（不占用常规 slot），但 BettingPool 自身声明了大量常规存储变量（slot 1-27）。未来升级若需在现有变量之间插入新变量将破坏存储布局。

  项目开发文档已标注 "Storage Layout (order MUST NOT change)"，但缺少 gap 使得未来扩展只能在末尾追加，灵活性受限。

- **Impact**:
  限制未来升级的存储扩展空间。若开发者不慎在非末尾位置添加变量，将导致存储碰撞和数据损坏。

- **Recommendation**:
  在所有存储变量声明之后添加：
  ```solidity
  // 预留升级存储空间
  uint256[50] private __gap;
  ```

---

## LOW

### [L-01] 未使用的库导入（死代码）

- **Location**: `src/core/BettingPool.sol:15-17`
- **Description**:
  `SettlementLib`、`ParlayLib`、`LendingLib` 被导入但从未使用。BettingPool 内联了所有结算、串关和信用仓位逻辑，这三个库成为死代码。

  ```solidity
  import "./libraries/SettlementLib.sol";  // 未使用
  import "./libraries/ParlayLib.sol";      // 未使用
  import "./libraries/LendingLib.sol";     // 未使用
  ```

- **Impact**:
  增加合约编译产物体积，可能导致维护者误以为逻辑在库中（实际已内联），增加代码审计复杂度。

- **Recommendation**:
  删除未使用的导入和对应的库文件，或将内联逻辑重构为库调用以保持 DRY 原则。

### [L-02] `settle()` 未验证 `winningOutcome` 范围

- **Location**: `src/core/BettingPool.sol:550-556`
- **Description**:
  `settle()` 接受 `uint8 winningOutcome` 但未校验其范围：
  - X12 市场：有效值 0, 1, 2
  - AH/OU 市场：有效值 0, 1

  若传入无效值（如 255），所有注单都将被判为 Lost（没有 `bet.outcome` 会匹配 255），导致所有用户资金被错误没收。

- **Impact**:
  虽然仅 multisig 可调用，但操作错误无法撤回（已结算的注单状态不可逆）。无 range check 是一个防御性编程缺失。

- **Recommendation**:
  ```solidity
  // 添加基本范围检查
  if (market == MarketType.X12) {
      require(winningOutcome <= 2, "invalid outcome");
  } else {
      require(winningOutcome <= 1, "invalid outcome");
  }
  ```

### [L-03] 串关亏损时剩余 Pending 腿标记为 Cancelled 但未更新 `cancelledLegs` 计数

- **Location**: `src/core/BettingPool.sol:644-649`
- **Description**:
  当串关某腿判负导致整个串关 Lost 时，代码将剩余 Pending 腿标记为 `BetStatus.Cancelled`，但未递增 `parlay.cancelledLegs`。虽然串关已终态（`status = Lost`），后续操作会跳过该串关，不会导致逻辑错误，但 `cancelledLegs` 值不准确，影响链下数据查询的正确性。

- **Impact**:
  链下系统查询 `cancelledLegs` 时获得不准确的值，可能影响数据分析和用户展示。

- **Recommendation**:
  在循环中同步更新 `cancelledLegs`，或在链下查询时根据 `parlay.status == Lost` 单独处理。

---

## INFO

### [I-01] LP 首笔存入攻击已通过 `MIN_LP_DEPOSIT` 缓解

- **Location**: `src/shared/constants/Constants.sol:16`, `src/core/BettingPool.sol:995`
- **Description**:
  经典的 LP 首笔存入攻击（存入 1 wei → 捐赠大量代币 → 稀释后续存入者份额）已通过 `MIN_LP_DEPOSIT = 1_000e6`（$1,000）进行缓解。首笔存入者获得 `shares = amount`（$1,000 份额），攻击者需捐赠远超 $1,000 的资金才能产生有意义的稀释效果，经济上不可行。

  `LiquidityLib.calcShares()` 在 `shares == 0` 时 revert（`SharesIsZero` 错误），进一步防止了零份额存入。

- **Conclusion**: 已充分缓解，无需额外措施。

### [I-02] 前端运行（Front-running）风险分析

- **Location**: 全局
- **Description**:
  **Admin 前置运行 settle()**: Admin 理论上可在知晓赛果后、multisig 提交 settle 交易前通过 `lockBet()` 下注。但这是信任假设的一部分 — admin 是后端服务器，由平台控制。

  **用户前置运行 closeMarket()**: 用户无法直接调用 `lockBet()`（需 admin 代理），因此无法自行下注。用户的下注请求必须经过后端验证和 admin 提交，不存在用户级别的 front-running。

  **multisig 内部串谋**: settle 和 cancel 操作需多签，单一签名者无法独自操控。

- **Conclusion**: 在当前架构下（admin = 可信后端），front-running 风险已通过架构设计缓解。核心信任假设为 admin 后端诚实运行。

---

## 正面观察

1. **记账不变式设计合理**: `_totalAccountedBalance()` 辅助函数和 `creditDeposit` 中的余额校验表明开发团队对记账完整性有清晰认知。
2. **信用注单状态机覆盖全面**: `_settleCreditBet()` 正确处理了 4 种抵押状态 × 2 种注单结果的所有 8 条路径，逻辑清晰。
3. **串关自动结算设计正确**: `wonLegs + cancelledLegs == total` 的自动结算检查在 settle 和 cancel 两个入口均正确实现。
4. **SafeERC20 使用一致**: 所有 USDT 操作均使用 `SafeERC20` 包装，防止非标准返回值问题。
5. **BetId/ParlayId 防重复**: 通过检查 `bets[betId].user != address(0)` 和 `parlays[parlayId].user != address(0)` 防止 ID 碰撞覆盖。
6. **depositDedup 防双重充值**: `processedDeposits[txHash]` 机制防止同一链上交易被重复记账。
7. **大额提现两阶段设计**: 24 小时等待期 + admin 否决权为大额提现提供了安全缓冲。

---

## 审查结论

**Verdict: REQUEST CHANGES**

存在 1 个 CRITICAL 和 2 个 HIGH 级别问题，必须在部署前修复：

| 优先级 | 问题 | 修复难度 |
|--------|------|----------|
| **P0** | [C-01] 替换为 ReentrancyGuardUpgradeable | 低（替换导入 + 继承 + 添加 init） |
| **P0** | [H-01] releaseOrForfeiture 改为 onlyMultisig | 极低（一行修改） |
| **P0** | [H-02] initialize 添加缺失的 init 调用 | 极低（添加两行） |
| **P1** | [M-01] 修复分成计算精度截断 | 低 |
| **P1** | [M-02] addLiquidity 遵循 CEI | 低 |
| **P1** | [M-05] withdrawPlatform 添加 nonReentrant | 极低 |
| **P2** | [M-03] 信用注单同盘口结算顺序 | 中 |
| **P2** | [M-04] 串关赔率精度损失 | 中 |
| **P2** | [M-06] 添加 storage gap | 低 |
