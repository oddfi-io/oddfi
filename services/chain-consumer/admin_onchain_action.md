######################################################################################
链上「管理员特权操作」审计表 admin_onchain_action

核心原则：
  1) 只收录"管理员/特权角色调用"且确实会 emit 的事件
  2) (chain_id, tx_hash, log_index) 唯一，保证重扫幂等
  3) 金额/大整数存原始最小单位整数(wei)，JSON 里一律存字符串，绝不转 float
  4) operator 优先取事件自带的 operator/sender/account/admin 字段；事件无此字段时取 tx.from
  5) 结算模块 BettingSettlementModule 走 delegatecall，其事件 log.address = BettingPool 代理地址
  6) PlatformReserveUpdated 仅 reason=0(管理员注资) 入库，reason=1/2/3 是结算副产物不收

category 取值：
  BUSINESS_OPS  开盘/改赔率/结算/平局退款/储备注资
  CONFIG        Staking/Liquidity 参数配置
  ROLE          角色授予/撤销/管理角色变更
  PAUSE         暂停/恢复
  UPGRADE       代理升级换实现
  INIT          初始化
######################################################################################


-- =====================================================================
-- 建表 SQL（测试环境可直接部署）
-- =====================================================================
CREATE TABLE admin_onchain_action (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,                   -- 自增主键，无业务含义

  contract_address CHAR(42)        NOT NULL,                                     -- 事件来源合约地址 = log.address(统一小写)。靠它区分 Betting/Staking/Liquidity/ODDToken，无需 contract_name
  category         VARCHAR(16)     NOT NULL,                                     -- 操作大类：BUSINESS_OPS/CONFIG/ROLE/PAUSE/UPGRADE/INIT(由 event_name 固定映射)
  event_name       VARCHAR(48)     NOT NULL,                                     -- 事件名(MarketOpened/RoleGranted/Upgraded...)，一眼看出做了什么操作

  operator         CHAR(42)        NOT NULL,                                     -- 执行该操作的管理员地址(小写)。自带 operator/sender/account/admin 字段就取它；无则取 tx.from(详见下方映射)
  role             CHAR(66)        NULL,                                         -- 角色 bytes32。仅 RoleGranted/RoleRevoked/RoleAdminChanged=.role；其余 NULL
  target_address   CHAR(42)        NULL,                                         -- 操作目标地址。RoleGranted/RoleRevoked=.account；Upgraded=.implementation；BettingPoolUpdated/LiquidityConfigUpdated=新地址；StakingConfigUpdated=.treasury；StakingInitialized=.oddToken；无则 NULL

  params           JSON            NOT NULL,                                     -- ★该事件全部参数，自包含★。查一行即得完整操作详情。金额/大整数存十进制字符串。各事件具体 key 见下方映射

  -- ---------- 链上溯源 & 幂等/重组 ----------
  chain_id         INT UNSIGNED    NOT NULL,                                     -- 链ID(BSC主网56/测试网97)
  block_number     BIGINT UNSIGNED NOT NULL,                                     -- 区块高度(log.blockNumber)
  block_time       DATETIME        NOT NULL,                                     -- 区块时间(UTC)，由 block.timestamp 转换；事件不带时间，按区块批量取
  tx_hash          CHAR(66)        NOT NULL,                                     -- 交易哈希(log.transactionHash)
  tx_from          CHAR(42)        NOT NULL,                                     -- 交易发起EOA。无 operator 字段的事件用它当 operator
  log_index        INT UNSIGNED    NOT NULL,                                     -- 日志在区块内序号(log.logIndex)
  block_hash       CHAR(66)        NOT NULL,                                     -- 区块哈希(log.blockHash)，reorg检测

  created_at       TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,                    -- 本行入库时间(运维用)

  UNIQUE KEY uk_log (chain_id, tx_hash, log_index),                             -- 幂等唯一键：同一条log不重复入库
  KEY idx_operator (operator, block_time),                                      -- 查某管理员的全部操作
  KEY idx_category (category, block_time),                                      -- 按大类查(如只看 ROLE/UPGRADE)
  KEY idx_event    (event_name, block_time),                                    -- 按具体操作查
  KEY idx_role     (role),                                                      -- 查某角色授予/撤销史
  KEY idx_target   (target_address),                                            -- 查某地址被授权/某实现被升级
  KEY idx_contract (contract_address, block_time),                              -- 按合约查(替代 contract_name 的过滤能力)
  KEY idx_block    (block_number)                                               -- reorg 回滚时按高度范围删除重扫
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理员链上特权操作审计';


######################################################################################
监听地址（BSC 测试网 chain_id=97，主网替换为主网部署地址）

  BettingPool    代理  0xbbc6ef3f665bf65cb531172e5f2252155e80ce1f
  StakingPool    代理  0x65fd4a2529010693ba474d1993631e305a42e061
  LiquidityPool  代理  0xdf0c59b387dfdf9f18969880ddcf1216bfee318f
  ODDToken       代理  0x5530da4357803bd0ed806a999a1f1fcc3c45dc8c

⚠️ 不监听 BettingSettlementModule 0x742d8a6e7dd0bf97e57e57b37d288b4ffb1e8924
   (delegatecall 实现合约，不以自身地址出日志，监听它一条都收不到)
######################################################################################


######################################################################################
要监听进表的 admin 事件清单（共 22 个，只列真正会 emit 的）

┌────┬──────────────────────────┬───────────────┬────────────────────────┬──────────────┬──────────────┐
│ #  │          事件            │   来源合约    │        触发函数        │     角色     │     分类     │
├────┼──────────────────────────┼───────────────┼────────────────────────┼──────────────┼──────────────┤
│ 1  │ MarketOpened             │ BettingPool   │ openMarket             │ OPERATOR     │ BUSINESS_OPS │
│ 2  │ OddsUpdated              │ BettingPool   │ openMarket/updateOdds  │ OPERATOR     │ BUSINESS_OPS │
│ 3  │ MarketSettled            │ BettingPool   │ settleMarket           │ SETTLER      │ BUSINESS_OPS │
│ 4  │ PushRefunded             │ BettingPool   │ pushRefundMarket       │ SETTLER      │ BUSINESS_OPS │
│ 5  │ PlatformReserveUpdated   │ BettingPool   │ addPlatformReserve     │ DEFAULT_ADMIN│ BUSINESS_OPS │  (仅 reason=0)
│ 6  │ StakingConfigUpdated     │ StakingPool   │ setPlatformTreasury    │ DEFAULT_ADMIN│ CONFIG       │
│ 7  │ BettingPoolUpdated       │ StakingPool   │ setBettingPool         │ DEFAULT_ADMIN│ CONFIG       │
│ 8  │ MinStakeAmountUpdated    │ StakingPool   │ setMinStakeAmount      │ DEFAULT_ADMIN│ CONFIG       │
│ 9  │ VipTierConfigUpdated     │ StakingPool   │ setVipTierConfig       │ DEFAULT_ADMIN│ CONFIG       │
│ 10 │ VipConfigUpdated         │ StakingPool   │ setVipTierConfig/init  │ DEFAULT_ADMIN│ CONFIG       │
│ 11 │ LiquidityConfigUpdated   │ LiquidityPool │ setBettingPool         │ DEFAULT_ADMIN│ CONFIG       │
│ 12 │ MinDepositUpdated        │ LiquidityPool │ setMinDeposit          │ DEFAULT_ADMIN│ CONFIG       │
│ 13 │ UnbondEpochsUpdated      │ LiquidityPool │ setUnbondEpochs        │ DEFAULT_ADMIN│ CONFIG       │
│ 14 │ RoleGranted              │ 全部4合约     │ grantRole              │ role admin   │ ROLE         │
│ 15 │ RoleRevoked              │ 全部4合约     │ revokeRole/renounce    │ role admin   │ ROLE         │
│ 16 │ RoleAdminChanged         │ 全部4合约     │ _setRoleAdmin          │ —            │ ROLE         │
│ 17 │ Paused                   │ 全部4合约     │ pause                  │ PAUSER       │ PAUSE        │
│ 18 │ Unpaused                 │ 全部4合约     │ unpause                │ PAUSER       │ PAUSE        │
│ 19 │ Upgraded                 │ 全部4合约     │ upgradeToAndCall       │ UPGRADER     │ UPGRADE      │
│ 20 │ Initialized              │ 全部4合约     │ initialize/reinit      │ —            │ INIT         │
│ 21 │ TokenInitialized         │ ODDToken      │ initialize             │ DEFAULT_ADMIN│ INIT         │
│ 22 │ StakingInitialized       │ StakingPool   │ initialize             │ DEFAULT_ADMIN│ INIT         │
└────┴──────────────────────────┴───────────────┴────────────────────────┴──────────────┴──────────────┘
######################################################################################


######################################################################################
Go 类型对照总则（Solidity → go-ethereum 解码 → 入库）

用 go-ethereum 的 abi.UnpackIntoInterface 解非 indexed 字段，indexed 字段从 log.Topics[i] 取。

  Solidity      go-ethereum 解码 Go 类型                          入库处理
  --------      ------------------------                          --------
  address       common.Address                                    addr.Hex() 后转小写，存 CHAR(42)
  bytes32       非indexed:[32]byte / indexed(topic):common.Hash    common.Hash(v).Hex()，存 CHAR(66)
  uint256       *big.Int                                          decimal.NewFromBigInt(v,0) 或 v.String()；JSON 存字符串
  int256        *big.Int (有符号，可为负)                         同上
  uint64        uint64                                            直接存；若时间戳→time.Unix(int64(v),0).UTC()
  uint32        uint32                                            直接存
  uint16        uint16                                            直接存
  uint8         uint8                                             枚举/原因码
  bool          bool                                              TINYINT(1)

JSON params 列：用 map[string]any 或事件结构体 json.Marshal；大整数一律存字符串避免浮点丢精度。
######################################################################################


######################################################################################
字段映射 + Go 类型（每个事件的每个参数 → 填哪列 + Go 解码类型）

说明：tx.from 表示该事件本身无操作人字段，operator 取交易发起地址。
     params 列存"全部参数"(含已抽到 operator/role/target 的那些，保证自包含)。
     (idx) = 该字段是 indexed，从 log.Topics 取。

—————————————————————————————————————————————————————————————————————————————
【BUSINESS_OPS】BettingPool 0xbbc6
—————————————————————————————————————————————————————————————————————————————

1) MarketOpened — 运营开盘
   签名: MarketOpened(bytes32,bytes32,uint8,uint8,uint64,uint64,uint256)
   operator ← tx.from   role ← NULL   target_address ← NULL
   params(JSON key : Solidity : Go类型):
     marketId       : bytes32(idx) : common.Hash
     matchId        : bytes32(idx) : common.Hash
     marketType     : uint8        : uint8
     line           : uint8        : uint8
     matchStartTime : uint64       : uint64
     lockAt         : uint64       : uint64
     quoteVersion   : uint256      : *big.Int(字符串)

2) OddsUpdated — 运营/预言机更新赔率
   签名: OddsUpdated(bytes32,uint64,uint256,uint8)
   operator ← tx.from   role ← NULL   target_address ← NULL
   params:
     marketId     : bytes32(idx) : common.Hash
     updatedAt    : uint64       : uint64
     quoteVersion : uint256      : *big.Int(字符串)
     signal       : uint8        : uint8   (风险信号色)

3) MarketSettled — 运营结算盘口
   签名: MarketSettled(bytes32,uint8,uint8,uint256,uint256,uint256,uint256)
   operator ← tx.from   role ← NULL   target_address ← NULL
   params:
     marketId            : bytes32(idx) : common.Hash
     resultKind          : uint8        : uint8
     winningOutcome      : uint8        : uint8
     grossPayout         : uint256      : *big.Int(字符串)
     lpMarginShare       : uint256      : *big.Int(字符串)
     platformMarginShare : uint256      : *big.Int(字符串)
     quoteVersion        : uint256      : *big.Int(字符串)

4) PushRefunded — 运营对整盘平局退款(聚合汇总)
   签名: PushRefunded(bytes32,uint256,uint256)
   operator ← tx.from   role ← NULL   target_address ← NULL
   params:
     marketId          : bytes32(idx) : common.Hash
     totalRefundAmount : uint256      : *big.Int(字符串)
     count             : uint256      : *big.Int(字符串)

5) PlatformReserveUpdated — 管理员注资平台储备(仅 reason=0 入库)
   签名: PlatformReserveUpdated(int256,uint256,uint8)
   operator ← tx.from   role ← NULL   target_address ← NULL
   params:
     delta      : int256  : *big.Int(有符号，字符串)
     newBalance : uint256 : *big.Int(字符串)
     reason     : uint8   : uint8   (入库前过滤，仅 0)

—————————————————————————————————————————————————————————————————————————————
【CONFIG】StakingPool 0x65fd / LiquidityPool 0xdf0c
—————————————————————————————————————————————————————————————————————————————

6) StakingConfigUpdated — 改质押池平台金库
   签名: StakingConfigUpdated(address,address)
   operator ← operator(idx)   role ← NULL   target_address ← treasury
   params:
     operator : address(idx) : common.Address
     treasury : address(idx) : common.Address

7) BettingPoolUpdated — 改质押池关联的下注池
   签名: BettingPoolUpdated(address,address)
   operator ← operator(idx)   role ← NULL   target_address ← bettingPool
   params:
     operator    : address(idx) : common.Address
     bettingPool : address(idx) : common.Address

8) MinStakeAmountUpdated — 改最小质押额
   签名: MinStakeAmountUpdated(address,uint256,uint256)
   operator ← operator(idx)   role ← NULL   target_address ← NULL
   params:
     operator  : address(idx) : common.Address
     oldAmount : uint256      : *big.Int(字符串)
     newAmount : uint256      : *big.Int(字符串)

9) VipTierConfigUpdated — 改某 VIP 档位门槛/每日限额
   签名: VipTierConfigUpdated(address,uint8,uint256,uint256)
   operator ← operator(idx)   role ← NULL   target_address ← NULL
   params:
     operator   : address(idx) : common.Address
     tier       : uint8(idx)   : uint8
     threshold  : uint256      : *big.Int(字符串)
     dailyLimit : uint256      : *big.Int(字符串)

10) VipConfigUpdated — VIP 整体配置变更(哈希指纹)
    签名: VipConfigUpdated(address,bytes32)
    operator ← operator(idx)   role ← NULL   target_address ← NULL
    params:
      operator   : address(idx) : common.Address
      configHash : bytes32      : common.Hash

11) LiquidityConfigUpdated — 改流动性池关联的下注池
    签名: LiquidityConfigUpdated(address,address)
    operator ← operator(idx)   role ← NULL   target_address ← newBettingPool
    params:
      operator       : address(idx) : common.Address
      newBettingPool : address(idx) : common.Address

12) MinDepositUpdated — 改最小注资额
    签名: MinDepositUpdated(address,uint256,uint256)
    operator ← operator(idx)   role ← NULL   target_address ← NULL
    params:
      operator  : address(idx) : common.Address
      oldAmount : uint256      : *big.Int(字符串)
      newAmount : uint256      : *big.Int(字符串)

13) UnbondEpochsUpdated — 改解绑周期数
    签名: UnbondEpochsUpdated(address,uint32,uint32)
    operator ← operator(idx)   role ← NULL   target_address ← NULL
    params:
      operator  : address(idx) : common.Address
      oldEpochs : uint32       : uint32
      newEpochs : uint32       : uint32

—————————————————————————————————————————————————————————————————————————————
【ROLE / PAUSE / UPGRADE / INIT】四合约通用(OZ 继承)
—————————————————————————————————————————————————————————————————————————————

14) RoleGranted — 授予角色
    签名: RoleGranted(bytes32,address,address)
    operator ← sender(idx)   role ← role(idx)   target_address ← account
    params:
      role    : bytes32(idx) : common.Hash    (附可读名，见下)
      account : address(idx) : common.Address (被授角色的人)
      sender  : address(idx) : common.Address (执行授予的管理员)

15) RoleRevoked — 撤销角色
    签名: RoleRevoked(bytes32,address,address)
    operator ← sender(idx)   role ← role(idx)   target_address ← account
    params:
      role    : bytes32(idx) : common.Hash
      account : address(idx) : common.Address
      sender  : address(idx) : common.Address

16) RoleAdminChanged — 改某角色的管理角色
    签名: RoleAdminChanged(bytes32,bytes32,bytes32)
    operator ← tx.from   role ← role(idx)   target_address ← NULL
    params:
      role              : bytes32(idx) : common.Hash
      previousAdminRole : bytes32(idx) : common.Hash
      newAdminRole      : bytes32(idx) : common.Hash

17) Paused — 暂停合约
    签名: Paused(address)
    operator ← account   role ← NULL   target_address ← NULL
    params:
      account : address : common.Address

18) Unpaused — 恢复合约
    签名: Unpaused(address)
    operator ← account   role ← NULL   target_address ← NULL
    params:
      account : address : common.Address

19) Upgraded — 代理升级换实现
    签名: Upgraded(address)
    operator ← tx.from   role ← NULL   target_address ← implementation
    params:
      implementation : address(idx) : common.Address (新实现合约地址)

20) Initialized — 初始化/重新初始化版本
    签名: Initialized(uint64)
    operator ← tx.from   role ← NULL   target_address ← NULL
    params:
      version : uint64 : uint64

21) TokenInitialized — ODDToken 初始化(铸造总量)
    签名: TokenInitialized(address,uint256)
    operator ← admin(idx)   role ← NULL   target_address ← NULL
    params:
      admin       : address(idx) : common.Address
      totalSupply : uint256      : *big.Int(字符串)

22) StakingInitialized — StakingPool 初始化
    签名: StakingInitialized(address,address,address)
    operator ← admin(idx)   role ← NULL   target_address ← oddToken
    params:
      admin    : address(idx) : common.Address
      oddToken : address(idx) : common.Address
      treasury : address(idx) : common.Address
######################################################################################


######################################################################################
角色 bytes32 常量(role 列入库原始 bytes32，params 内附可读名)

  DEFAULT_ADMIN_ROLE = 0x0000000000000000000000000000000000000000000000000000000000000000
  UPGRADER_ROLE      = keccak256("UPGRADER_ROLE")
  PAUSER_ROLE        = keccak256("PAUSER_ROLE")
  SETTLER_ROLE       = keccak256("SETTLER_ROLE")
  OPERATOR_ROLE      = keccak256("OPERATOR_ROLE")
  KEEPER_ROLE        = keccak256("KEEPER_ROLE")
######################################################################################


######################################################################################
明确「不收录」的事件（避免重复/噪音）

1) BetRefunded                  退款明细，属于用户行为，已在 user_onchain_action 表，不在此重复
2) 结算级联记账事件(settleMarket 的副产物，不是 admin 动作)：
   MarginDistributed / LossDistributed / PayoutLiquidityReserved / PayoutLiquidityTransferred /
   ReserveTapped / ReserveBelowFloor / ReserveStepAlert / LpLossOffsetApplied / TaxBufferFunded /
   RewardNotified / RewardRedirectedToPlatform / PlatformReserveUpdated(reason≠0) /
   MatchPoolDepositClosed / LiquidityPositionStateChanged / *AccountingSnapshot
3) BettingPool 的 8 个配置 setter —— 全都不 emit 任何事件，纯监听抓不到：
   setTaxConfig / setRiskConfig / setMarginSplit / setReferralClaimConfig /
   setPlatformTreasury / setBettingDependencies / setSettlementModule / initializeV2
   ⚠️ 若将来要审计这些改动，须另起「按函数选择器解析交易 calldata」管线，本表不覆盖。
######################################################################################


######################################################################################
入库注意事项

1) 幂等：UNIQUE KEY (chain_id, tx_hash, log_index) + INSERT IGNORE / ON DUPLICATE KEY /
   gorm clause.OnConflict{DoNothing:true}。
2) reorg：①只索引 latest - N(建议 N=15~30 确认)；②存 block_hash，扫描前校验 checkpoint 附近
   区块 hash 是否变化，变了按 block_number 范围删除重扫。
3) getLogs 分页：BSC RPC 对单次 eth_getLogs 区块范围/结果数有上限，按固定步长(如2000块)分页，
   命中 range too large 时二分缩小区间重试。
4) operator 来源分两类：
   - CONFIG/Role/Pause/Init 事件自带 operator/sender/account/admin 字段 → 优先取它
   - BUSINESS_OPS(MarketOpened/OddsUpdated/MarketSettled/PushRefunded/PlatformReserveUpdated)
     和 Upgrade/RoleAdminChanged 无该字段 → 取 tx.from
5) role 是 bytes32 哈希 → 存原始值进 role 列，params 内附可读名(上方常量表)。
6) PlatformReserveUpdated 入库前先过滤 reason==0，其余丢弃。
7) 地址规范化：strings.ToLower(addr.Hex()) 入库，避免 checksum 大小写导致查不到。
8) 时间戳：事件不带时间，取所在区块 header.Time(uint64秒) → time.Unix().UTC()，按区块批量查。
9) 金额精度：*big.Int → decimal.Decimal(shopspring) 存；JSON 内存字符串，绝不转 float64。
######################################################################################


######################################################################################
常用查询示例

-- 某管理员的全部操作(连参数)
SELECT block_time, event_name, params
FROM   admin_onchain_action
WHERE  operator = '0x7501...'
ORDER  BY block_time DESC;

-- 所有角色授予/撤销记录
SELECT block_time, event_name, role, target_address, operator
FROM   admin_onchain_action
WHERE  category = 'ROLE'
ORDER  BY block_time DESC;

-- 所有合约升级记录
SELECT block_time, contract_address, target_address AS new_impl, tx_from
FROM   admin_onchain_action
WHERE  event_name = 'Upgraded';

-- 读 JSON 里的具体参数(例：VIP 档位门槛调整)
SELECT block_time, operator,
       params->>'$.tier'      AS tier,
       params->>'$.threshold' AS threshold
FROM   admin_onchain_action
WHERE  event_name = 'VipTierConfigUpdated';
######################################################################################
