1. 用户资产表 (User Balance)
注意：不区分链，此表是所有链的总和余额
注意：在更新 user_balance 时，在同一个数据库事务中插入 asset_ledger
注意： user_id使用雪花算法（snowflake）生成
CREATE TABLE `user_balance` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL COMMENT '用户ID',
  `coin_symbol` varchar(20) NOT NULL DEFAULT '' COMMENT '币种标识, 如 BTC, USDT',
  `available_balance` decimal(40,18) NOT NULL DEFAULT '0.000000000000000000' COMMENT '可用余额',
  `frozen_balance` decimal(40,18) NOT NULL DEFAULT '0.000000000000000000' COMMENT '提现或业务冻结',
  `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `bet_lock_balance` decimal(40,18) NOT NULL DEFAULT '0.000000000000000000',
  `stake_lock_balance` decimal(40,18) NOT NULL DEFAULT '0.000000000000000000',
  `liq_lock_balance` decimal(40,18) NOT NULL DEFAULT '0.000000000000000000',
  `claimable_balance` decimal(40,18) NOT NULL DEFAULT '0.000000000000000000' COMMENT '结算后待用户领取余额',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_coin` (`user_id`,`coin_symbol`)

) ENGINE=InnoDB COMMENT='用户资产核心表';


2. 充值地址映射表 (Deposit Address)
注意：记录用户各个链对应地址的绑定关系
CREATE TABLE `user_deposit_address` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `chain` VARCHAR(20) NOT NULL COMMENT '所属链, 如 bsc/tron/...',
    `token_address` VARCHAR(20) NOT NULL  DEFAULT '' COMMENT '充值代币的地址',
    `address` VARCHAR(128) NOT NULL COMMENT '充值地址',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_address_chain` (`address`, `chain`),
    INDEX `idx_user_id` (`user_id`)
) ENGINE=InnoDB COMMENT='用户充值地址映射表';


3. 资金流水表 (Internal Ledger)
注意：每一笔余额变动（交易、充提、奖励）都必须在这里产生一条不可篡改的记录。
CREATE TABLE `asset_ledger` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `business_type` VARCHAR(32) NOT NULL COMMENT '业务类型: DEPOSIT-充值, WITHDRAW-提现, TRADE-交易, FREEZE-冻结',
    `amount` DECIMAL(40, 18) NOT NULL COMMENT '变动金额(正负)',
    `balance_before` DECIMAL(40, 18) NOT NULL COMMENT '变动前余额',
    `balance_after` DECIMAL(40, 18) NOT NULL COMMENT '变动后余额',
    `frozen_before` DECIMAL(40, 18) NOT NULL COMMENT '变动前冻结余额',
    `frozen_after` DECIMAL(40, 18) NOT NULL COMMENT '变动后冻结余额',
    `lock_before` DECIMAL(40, 18) NOT NULL COMMENT '变动前锁定余额',
    `lock_after` DECIMAL(40, 18) NOT NULL COMMENT '变动后锁定余额',
    `ref_id` VARCHAR(80) NOT NULL DEFAULT ''  COMMENT '关联业务订单号(如 tx_hash，66字符)',
    `token_address` VARCHAR(20) NOT NULL DEFAULT '' COMMENT '充值/提现的代币地址',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_user_coin` (`user_id`, `token_address`),
    INDEX `idx_ref_id` (`ref_id`)
) ENGINE=InnoDB COMMENT='资金变动流水表';


4. 充值记录表 (External Deposit Records)
注意：记录链上真实发生的交易
CREATE TABLE `deposit_record` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `tx_id` VARCHAR(128) NOT NULL COMMENT '链上交易Hash',
    `user_id` BIGINT UNSIGNED NOT NULL,
    `log_index` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '交易内日志索引',
    `chain` VARCHAR(20) NOT NULL,
    `amount` DECIMAL(40, 18) NOT NULL,
    `from_address` VARCHAR(128) DEFAULT NULL,
    `to_address` VARCHAR(128) NOT NULL,
    `block_height` BIGINT UNSIGNED DEFAULT NULL,
    `status` TINYINT NOT NULL DEFAULT 0 COMMENT '0-待确认, 1-确认中, 2-已入账, 3-异常',
    `confirmations` INT DEFAULT 0 COMMENT '当前确认数',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_tx_log` (`tx_id`, `log_index`);
) ENGINE=InnoDB COMMENT='链上充值记录表';



5. 归集子钱包任务表 (Collection Tasks)
注意：未来归集钱包里余额使用



6.用户基础信息表 (User)
CREATE TABLE `user` (
    `user_id` BIGINT UNSIGNED PRIMARY KEY COMMENT '雪花算法生成的ID',
    `email` VARCHAR(100) DEFAULT NULL COMMENT '邮箱(唯一)',
    `phone` VARCHAR(20) DEFAULT NULL COMMENT '手机号(唯一)',
    `signing_address` VARCHAR(255) NOT NULL COMMENT '邮箱(唯一)',
    `magic_address` varchar(42) NOT NULL DEFAULT '' COMMENT 'Magic 托管 EOA（链上身份+充值地址）',
    `password_hash` VARCHAR(255) DEFAULT NULL COMMENT '加密后的密码',
    `pay_password_hash` VARCHAR(255) DEFAULT NULL COMMENT '资金密码/交易密码',
    `nickname` VARCHAR(50) DEFAULT NULL,
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '1-正常, 2-禁用, 3-冻结交易',
    `kyc_level` TINYINT DEFAULT 0 COMMENT '0-未认证, 1-实名认证, 2-高级认证',
    `two_fa_secret` VARCHAR(64) DEFAULT NULL COMMENT 'Google验证器密钥',
    `two_fa_enable` TINYINT DEFAULT 0 COMMENT '是否开启2FA: 0-关, 1-开',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_userId` (`user_id`),
    UNIQUE KEY `uk_singing_address` (`signing_address`)
) ENGINE=InnoDB COMMENT='用户主表';


7.用户登录信息表
注意： 风控用
CREATE TABLE `user_login_log` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `login_ip` VARCHAR(45) NOT NULL COMMENT '支持IPv6',
    `location` VARCHAR(100) DEFAULT NULL COMMENT '通过IP解析的地理位置',
    `device_id` VARCHAR(128) DEFAULT NULL COMMENT '前端生成的唯一设备标识',
    `user_agent` TEXT COMMENT '浏览器/App信息',
    `status` TINYINT NOT NULL COMMENT '1-成功, 2-密码错误, 3-2FA失败',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_user_time` (`user_id`, `created_at`)
) ENGINE=InnoDB COMMENT='登录日志表(风控用)';


8.全部子地址池表
注意： user_id 去除所有生成0值
CREATE TABLE `deposit_address` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `chain` VARCHAR(20) NOT NULL COMMENT '链名称: ETH, TRX, SOL, BTC, SUI',
    `address` VARCHAR(128) NOT NULL COMMENT '充值地址',
    `user_id` BIGINT UNSIGNED DEFAULT 0 COMMENT '所属用户ID, 0表示未分配',
    `status` TINYINT NOT NULL DEFAULT 0 COMMENT '状态: 0-未使用, 1-已分配, 2-禁用',
    `version` INT NOT NULL DEFAULT 0 COMMENT '乐观锁版本号',
    `allocated_at` DATETIME DEFAULT NULL COMMENT '分配时间',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_chain_address` (`chain`, `address`), -- 保证同条链地址不重复
    INDEX `idx_user_chain` (`user_id`, `chain`),       -- 方便查询用户在某条链的地址
    INDEX `idx_status_chain` (`status`, `chain`)       -- 核心：用于快速取出待分配地址
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='充值地址池表';

9.提现表
CREATE TABLE `withdraw_record` (
 	`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '自增主键',
 	`user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
 	`order_sn` VARCHAR(100) NOT NULL UNIQUE COMMENT '业务流水号(全局唯一)',

 	-- 资产信息
 	`coin_symbol` VARCHAR(20) NOT NULL DEFAULT '' COMMENT '提币币种',
 	`chain` VARCHAR(50) NOT NULL COMMENT '提现链名称',
 	`amount` DECIMAL(40, 18) NOT NULL COMMENT '提现数量',
 	`fee` DECIMAL(40, 18) NOT NULL COMMENT '手续费',
 	`real_amount` DECIMAL(40, 18) NOT NULL COMMENT '实际到账数量 (amount - fee)',

 	-- 地址信息
 	`to_address` VARCHAR(255) NOT NULL COMMENT '提现目标地址',
 	`tx_hash` VARCHAR(255) DEFAULT NULL COMMENT '区块链交易哈希',

 	-- 状态流转
 	-- 1:待审核, 2:审核通过(处理中), 3:已完成, 4:审核驳回, 5:提现失败(打款失败), 6:用户取消
 	`status` TINYINT NOT NULL DEFAULT '1' COMMENT '提现状态',

 	-- 审计与风控
 	`risk_level` TINYINT DEFAULT '0' COMMENT '风险等级 (0:正常, 1:高风险需人工)',
 	`admin_id`  VARCHAR(50)  DEFAULT NULL COMMENT '审核管理员ID',
 	`remark` VARCHAR(500) DEFAULT NULL COMMENT '审核备注或失败原因',

 	-- 时间线
 	`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '申请时间',
 	`audit_at` TIMESTAMP NULL DEFAULT NULL COMMENT '审核时间',
 	`finished_at` TIMESTAMP NULL DEFAULT NULL COMMENT '完成时间 (上链成功时间)',
 	`updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

 	PRIMARY KEY (`id`),
 	INDEX `idx_user_id_status` (`user_id`,`status`),
 	INDEX `idx_order_sn` (`order_sn`),
 	INDEX `idx_status` (`status`),
 	INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户提现记录表';


-- =====================================================================
-- 10. 链上「管理员特权操作」审计表 admin_onchain_action
-- 详见 admin_onchain_action.md。params 列存事件全部参数(大整数存字符串)。
-- =====================================================================
CREATE TABLE `admin_onchain_action` (
  `id`               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `contract_address` CHAR(42)        NOT NULL COMMENT '事件来源合约地址=log.address(小写)',
  `category`         VARCHAR(16)     NOT NULL COMMENT 'BUSINESS_OPS/CONFIG/ROLE/PAUSE/UPGRADE/INIT',
  `event_name`      VARCHAR(48)     NOT NULL COMMENT '事件名',
  `operator`         CHAR(42)        NOT NULL COMMENT '执行操作的管理员地址(小写)',
  `role`             CHAR(66)        NULL     COMMENT '角色 bytes32(仅 Role* 事件)',
  `target_address`   CHAR(42)        NULL     COMMENT '操作目标地址',
  `params`           JSON            NOT NULL COMMENT '事件全部参数(大整数存字符串)',
  `chain_id`         INT UNSIGNED    NOT NULL COMMENT '链ID(测试网97/主网56)',
  `block_number`     BIGINT UNSIGNED NOT NULL,
  `block_time`       DATETIME        NOT NULL COMMENT '区块时间(UTC)',
  `tx_hash`          CHAR(66)        NOT NULL,
  `tx_from`          CHAR(42)        NOT NULL COMMENT '交易发起EOA',
  `log_index`        INT UNSIGNED    NOT NULL,
  `block_hash`       CHAR(66)        NOT NULL COMMENT 'reorg检测',
  `created_at`       TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_log` (`chain_id`, `tx_hash`, `log_index`),
  KEY `idx_operator` (`operator`, `block_time`),
  KEY `idx_category` (`category`, `block_time`),
  KEY `idx_event`    (`event_name`, `block_time`),
  KEY `idx_role`     (`role`),
  KEY `idx_target`   (`target_address`),
  KEY `idx_contract` (`contract_address`, `block_time`),
  KEY `idx_block`    (`block_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理员链上特权操作审计';


-- =====================================================================
-- 11. 链上用户行为表 user_onchain_action（单事件单行）
-- 详见 user_onchain_action.md。金额 DECIMAL(65,0) 存原始wei；extra 存事件附加参数JSON。
-- =====================================================================
CREATE TABLE `user_onchain_action` (
  `id`                   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_address`         CHAR(42)        NOT NULL COMMENT '行为主体(取事件topic，非tx.from)',
  `counterparty_address` CHAR(42)        NULL     COMMENT '对手方地址',
  `action_type`          VARCHAR(32)     NOT NULL COMMENT 'BET_PLACED/BET_CLAIMED/... 枚举',
  `bet_id`               CHAR(66)        NULL,
  `market_id`            CHAR(66)        NULL,
  `match_id`             CHAR(66)        NULL     COMMENT '回填自映射表，查不到为NULL',
  `position_id`          VARCHAR(78)     NULL     COMMENT '质押/LP仓位ID(uint256十进制串)',
  `amount`               DECIMAL(65,0)   NULL     COMMENT '主金额(wei)',
  `amount_gross`         DECIMAL(65,0)   NULL     COMMENT '含税总额(仅BET_CLAIMED)',
  `amount_tax`           DECIMAL(65,0)   NULL     COMMENT '税额(仅BET_CLAIMED)',
  `amount_secondary`     DECIMAL(65,0)   NULL     COMMENT '次金额(可负)',
  `extra`                JSON            NULL     COMMENT '事件附加参数',
  `chain_id`             INT UNSIGNED    NOT NULL,
  `contract_address`     CHAR(42)        NOT NULL,
  `block_number`         BIGINT UNSIGNED NOT NULL,
  `block_time`           DATETIME        NOT NULL,
  `tx_hash`              CHAR(66)        NOT NULL,
  `tx_from`              CHAR(42)        NULL,
  `log_index`            INT UNSIGNED    NOT NULL,
  `block_hash`           CHAR(66)        NOT NULL,
  `created_at`           TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_log` (`chain_id`, `tx_hash`, `log_index`),
  KEY `idx_user_time`    (`user_address`, `block_time`),
  KEY `idx_user_action`  (`user_address`, `action_type`, `block_time`),
  KEY `idx_counterparty` (`counterparty_address`, `action_type`, `block_time`),
  KEY `idx_match`        (`match_id`),
  KEY `idx_bet`          (`bet_id`),
  KEY `idx_block`        (`block_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='链上用户行为流水(单事件单行)';


-- =====================================================================
-- 12. 盘口→比赛映射 market_match_map（来源 MarketOpened）
-- =====================================================================
CREATE TABLE `market_match_map` (
  `market_id`   CHAR(66)         NOT NULL PRIMARY KEY COMMENT 'MarketOpened.marketId',
  `match_id`    CHAR(66)         NOT NULL             COMMENT 'MarketOpened.matchId',
  `market_type` TINYINT UNSIGNED NULL,
  `line`        TINYINT UNSIGNED NULL,
  `lock_at`     DATETIME         NULL                 COMMENT '封盘时间(UTC)',
  KEY `idx_match` (`match_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='盘口到比赛映射(来源MarketOpened)';


-- =====================================================================
-- 13. 流动池→比赛映射 pool_match_map（来源 MatchPoolOpened）
-- =====================================================================
CREATE TABLE `pool_match_map` (
  `pool_id`          VARCHAR(78) NOT NULL PRIMARY KEY COMMENT 'MatchPoolOpened.poolId(uint256串)',
  `match_id`         CHAR(66)    NOT NULL             COMMENT 'MatchPoolOpened.matchId',
  `match_end_time`   DATETIME    NULL,
  `deposit_close_at` DATETIME    NULL,
  KEY `idx_match` (`match_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='流动池到比赛映射(来源MatchPoolOpened)';


  CREATE TABLE user_onchain_action (
    id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,                 -- 自增主键，无业务含义
    user_address      CHAR(42)        NOT NULL,                                   -- 行为主体(统一小写0x地址)。BET_PLACED=BetPlaced.user BET_CLAIMED=PayoutClaimed.user BET_REFUNDED=BetRefunded.user RE  FERRAL_REWARD_ACCRUED=ReferralRewardAccumulated.referrer(受益人) REFERRAL_CLAIMED=ReferralClaimed.referrer REFERRAL_  CLAIMED_USDT=ReferralClaimedUSDT.referrer REFERRER_BOUND=ReferrerBound.user STAKE_*=Stake*.user LIQUIDITY_DEPOSITED  =LiquidityDeposited.user LIQUIDITY_UNBOND_REQUESTED=UnbondRequested.user LIQUIDITY_WITHDRAWN=LiquidityWithdrawn.user    
    counterparty_address CHAR(42)     NULL,                                       
    action_type       VARCHAR(32)     NOT NULL,                                   -- 行为类型，取上方枚举之一(由索引器按事件名映射)

    -- ---------- 业务关联键 ----------
    bet_id            CHAR(66)        NULL,                                       -- 注单ID(bytes32)。BET_PLACED/BET_CLAIMED/BET_REFUNDED = 各事件的 betId 其余=NULL
    market_id         CHAR(66)        NULL,                                       -- 盘口ID(bytes32)。BET_PLACED=BetPlac  ed.marketId BET_CLAIMED=BetClaimed.marketId(注意PayoutClaimed无此字段) BET_REFUNDED=BetRefunded.marketId  其余=NULL
    match_id          CHAR(66)        NULL,                                       -- 比赛ID(bytes32)。事件本身没有，需回填：下注类经 market_match_map(MarketOpened) 用 market_id 查 LIQUIDITY_* 经 pool_match_map(MatchPoolOpened) 用 poolId 查
    position_id       VARCHAR(78)     NULL,                                       -- 质押/LP 仓位ID(uint256转十进制串)。STAKE_*=Stake*.positionId LIQUIDITY_*=各事件 positionId 其余=NULL

    -- ---------- 金额（DECIMAL(65,0) 存原始wei整数 MySQL精度上限65位，足够真实代币金额） ----------
    amount            DECIMAL(65,0)   NULL,                                       -- 主金额。BET_PLACED=acceptedAmount(实际接受额) BET_CLAIMED=PayoutClaimed.netPayout(到账净额) BET_REFUNDED=refundAmoun  t REFERRAL_REWARD_ACCRUED=ReferralRewardAccumulated.amount REFERRAL_CLAIMED=oddAmount REFERRAL_CLAIMED_USDT=oddAmou  nt(花掉的ODD) STAKE_CREATED=principal STAKE_WITHDRAWN=principal LIQUIDITY_DEPOSITED=amount LIQUIDITY_WITHDRAWN=wit  hdrawAmount REFERRER_BOUND/UNBOND_REQUESTED=NULL
    amount_gross      DECIMAL(65,0)   NULL,                                       -- 含税总额。仅 BET_CLAIMED=PayoutClaimed.grossPayout 其余=NULL
    amount_tax        DECIMAL(65,0)   NULL,                                       -- 税额。仅 BET_CLAIMED=PayoutClaimed.taxAmount 其余=NULL
    amount_secondary  DECIMAL(65,0)   NULL,                                       -- 次金额(允许负值)。BET_PLACED=requestedAmount(请求额) REFERRAL_CLAIMED_USDT=usdtAmount(换得的USDT) STAKE_WITHDRAWN=re  ward(收益) LIQUIDITY_WITHDRAWN=netPnl(int256,可为负) 其余=NULL

    -- ---------- 各事件独有小字段，统一装JSON（不需建索引的放这里） ----------
    extra             JSON            NULL,                                       -- 事件附加参数。BET_PLACED={lockedOdds,quoteVersion,outcome} BET_REFUNDED={reason,quoteVersion} REFERRAL_REWARD_ACCRUE  D={kind}(0=下注税返佣,1=派彩税返佣) REFERRAL_CLAIMED_USDT={currentPriceX18} STAKE_CREATED={planId,sourceType,weight,  unlockAt} STAKE_WITHDRAWN={early} LIQUIDITY_DEPOSITED={poolId,weight,planId,unlockAt} LIQUIDITY_UNBOND_REQUESTED={u  nbondingEpoch,frozenRewardPerWeight,frozenLossPerPrincipal} LIQUIDITY_WITHDRAWN={finalState}

    -- ---------- 链上溯源 & 幂等/重组 ----------
    chain_id          INT UNSIGNED    NOT NULL,                                   -- 链ID(BSC主网56/测试网97)，来自RPC配置
    contract_address  CHAR(42)        NOT NULL,                                   -- 发出事件的合约地址(log.address)，区分 BettingPool/StakingPool/LiquidityPool
    block_number      BIGINT UNSIGNED NOT NULL,                                   -- 区块高度(log.blockNumber)
    block_time        DATETIME        NOT NULL,                                   -- 区块时间(UTC)，由 block.timestamp 转换 事件本身不带时间，按区块批量取
    tx_hash           CHAR(66)        NOT NULL,                                   -- 交易哈希(log.transactionHash)
    tx_from           CHAR(42)        NULL,                                       -- 交易发起EOA(tx.from)。仅审计/排查用，不代表用户(批量退款时这里是运营地址)
    log_index         INT UNSIGNED    NOT NULL,                                   -- 日志在区块内序号(log.logIndex)，同一tx多条log靠它区分
    block_hash        CHAR(66)        NOT NULL,                                   -- 区块哈希(log.blockHash)，reorg检测：高度相同但hash变了即发生重组

    created_at        TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,                  -- 本行入库时间(运维用)

    UNIQUE KEY uk_log (chain_id, tx_hash, log_index),                            -- 幂等唯一键：同一条log不会重复入库(配合 INSERT IGNORE / ON DUPLICATE KEY)
    KEY idx_user_time     (user_address, block_time),                            -- 核心查询：某地址全部行为按时间倒序
    KEY idx_user_action   (user_address, action_type, block_time),               -- 某地址某类行为(如只看下注)
    KEY idx_counterparty  (counterparty_address, action_type, block_time),       -- 反向查：某地址作为对手方(如 X 给谁带来返佣 / 谁的推荐人)
    KEY idx_match         (match_id),                                            -- 按比赛聚合(某场比赛所有下注/LP)
    KEY idx_bet           (bet_id)                                              -- 按注单串起 下注→退款→领奖 全生命周期    KEY idx_block         (block_number)                                         -- reorg 回滚时按高度范围删除 重扫
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='链上用户行为流水(单事件单行)';