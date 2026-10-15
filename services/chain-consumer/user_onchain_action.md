  -- =====================================================================
  -- 链上用户行为表
  -- 核心原则：
  --   1) 用户身份取事件 indexed 的 user/owner/referrer 字段，绝不用 tx.from
  --   2) 金额存原始最小单位整数(wei)，展示层再按 token decimals(ODD=18) 格式化
  --   3) (chain_id, tx_hash, log_index) 唯一，保证重扫幂等
  --   4) PushRefunded 是聚合汇总，不入此表(明细已由每注 BetRefunded 覆盖)

  -- action_type 取值：
  --   BET_PLACED / BET_CLAIMED / BET_REFUNDED
  --   REFERRAL_REWARD_ACCRUED / REFERRAL_CLAIMED / REFERRAL_CLAIMED_USDT / REFERRER_BOUND
  --   STAKE_CREATED / STAKE_WITHDRAWN
  --   LIQUIDITY_DEPOSITED / LIQUIDITY_UNBOND_REQUESTED / LIQUIDITY_WITHDRAWN
  -- =====================================================================

  CREATE TABLE user_onchain_action (
    id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,                 -- 自增主键，无业务含义

    -- ---------- 用户身份（一律取事件 topic，不取 tx.from） ----------
    user_address      CHAR(42)        NOT NULL,                                   -- 行为主体(统一小写0x地址)。BET_PLACED=BetPlaced.user；BET_CLAIMED=PayoutClaimed.user；BET_REFUNDED=BetRefunded.user；RE  FERRAL_REWARD_ACCRUED=ReferralRewardAccumulated.referrer(受益人)；REFERRAL_CLAIMED=ReferralClaimed.referrer；REFERRAL_  CLAIMED_USDT=ReferralClaimedUSDT.referrer；REFERRER_BOUND=ReferrerBound.user；STAKE_*=Stake*.user；LIQUIDITY_DEPOSITED  =LiquidityDeposited.user；LIQUIDITY_UNBOND_REQUESTED=UnbondRequested.user；LIQUIDITY_WITHDRAWN=LiquidityWithdrawn.user    
    counterparty_address CHAR(42)     NULL,                                       -- 对手方地址(可空)。BET_CLAIMED=BetClaimed.executor(代领人,当前==user)；REFERRAL_REWARD_ACCRUED=ReferralRewardAccumulate  d.from(贡献该返佣的下注者)；REFERRER_BOUND=ReferrerBound.referrer(被绑定的推荐人)；其余=NULL

    action_type       VARCHAR(32)     NOT NULL,                                   -- 行为类型，取上方枚举之一(由索引器按事件名映射)

    -- ---------- 业务关联键 ----------
    bet_id            CHAR(66)        NULL,                                       -- 注单ID(bytes32)。BET_PLACED/BET_CLAIMED/BET_REFUNDED = 各事件的 betId；其余=NULL
    market_id         CHAR(66)        NULL,                                       -- 盘口ID(bytes32)。BET_PLACED=BetPlac  ed.marketId；BET_CLAIMED=BetClaimed.marketId(注意PayoutClaimed无此字段)；BET_REFUNDED=BetRefunded.marketId； 其余=NULL
    match_id          CHAR(66)        NULL,                                       -- 比赛ID(bytes32)。事件本身没有，需回填：下注类经 market_match_map(MarketOpened) 用 market_id 查；LIQUIDITY_* 经 pool_match_map(MatchPoolOpened) 用 poolId 查
    position_id       VARCHAR(78)     NULL,                                       -- 质押/LP 仓位ID(uint256转十进制串)。STAKE_*=Stake*.positionId；LIQUIDITY_*=各事件 positionId；其余=NULL

    -- ---------- 金额（DECIMAL(65,0) 存原始wei整数；MySQL精度上限65位，足够真实代币金额） ----------
    amount            DECIMAL(65,0)   NULL,                                       -- 主金额。BET_PLACED=acceptedAmount(实际接受额)；BET_CLAIMED=PayoutClaimed.netPayout(到账净额)；BET_REFUNDED=refundAmoun  t；REFERRAL_REWARD_ACCRUED=ReferralRewardAccumulated.amount；REFERRAL_CLAIMED=oddAmount；REFERRAL_CLAIMED_USDT=oddAmou  nt(花掉的ODD)；STAKE_CREATED=principal；STAKE_WITHDRAWN=principal；LIQUIDITY_DEPOSITED=amount；LIQUIDITY_WITHDRAWN=wit  hdrawAmount；REFERRER_BOUND/UNBOND_REQUESTED=NULL
    amount_gross      DECIMAL(65,0)   NULL,                                       -- 含税总额。仅 BET_CLAIMED=PayoutClaimed.grossPayout；其余=NULL
    amount_tax        DECIMAL(65,0)   NULL,                                       -- 税额。仅 BET_CLAIMED=PayoutClaimed.taxAmount；其余=NULL
    amount_secondary  DECIMAL(65,0)   NULL,                                       -- 次金额(允许负值)。BET_PLACED=requestedAmount(请求额)；REFERRAL_CLAIMED_USDT=usdtAmount(换得的USDT)；STAKE_WITHDRAWN=re  ward(收益)；LIQUIDITY_WITHDRAWN=netPnl(int256,可为负)；其余=NULL

    -- ---------- 各事件独有小字段，统一装JSON（不需建索引的放这里） ----------
    extra             JSON            NULL,                                       -- 事件附加参数。BET_PLACED={lockedOdds,quoteVersion,outcome}；BET_REFUNDED={reason,quoteVersion}；REFERRAL_REWARD_ACCRUE  D={kind}(0=下注税返佣,1=派彩税返佣)；REFERRAL_CLAIMED_USDT={currentPriceX18}；STAKE_CREATED={planId,sourceType,weight,  unlockAt}；STAKE_WITHDRAWN={early}；LIQUIDITY_DEPOSITED={poolId,weight,planId,unlockAt}；LIQUIDITY_UNBOND_REQUESTED={u  nbondingEpoch,frozenRewardPerWeight,frozenLossPerPrincipal}；LIQUIDITY_WITHDRAWN={finalState}

    -- ---------- 链上溯源 & 幂等/重组 ----------
    chain_id          INT UNSIGNED    NOT NULL,                                   -- 链ID(BSC主网56/测试网97)，来自RPC配置
    contract_address  CHAR(42)        NOT NULL,                                   -- 发出事件的合约地址(log.address)，区分 BettingPool/StakingPool/LiquidityPool
    block_number      BIGINT UNSIGNED NOT NULL,                                   -- 区块高度(log.blockNumber)
    block_time        DATETIME        NOT NULL,                                   -- 区块时间(UTC)，由 block.timestamp 转换；事件本身不带时间，按区块批量取
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
    KEY idx_bet           (bet_id),                                              -- 按注单串起 下注→退款→领奖 全生命周期    KEY idx_block         (block_number)                                         -- reorg 回滚时按高度范围删除 重扫
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='链上用户行为流水(单事件单行)';


  -- =====================================================================
  -- 盘口→比赛 映射：索引 MarketOpened 事件填充
  -- BetPlaced/BetClaimed/BetRefunded 只带 marketId，靠这张表回填 match_id
  -- =====================================================================
  CREATE TABLE market_match_map (
    market_id   CHAR(66)        PRIMARY KEY,                                      -- 盘口ID。MarketOpened.marketId
    match_id    CHAR(66)        NOT NULL,                                         -- 比赛ID。MarketOpened.matchId
    chain_id          INT UNSIGNED    NOT NULL,                                   -- 链ID(BSC主网56/测试网97)，来自RPC配置
    contract_address  CHAR(42)        NOT NULL,                                   -- 发出事件的合约地址(log.address)，区分 BettingPool/StakingPool/LiquidityPool
    block_number      BIGINT UNSIGNED NOT NULL,                                   -- 区块高度(log.blockNumber)
    block_time        DATETIME        NOT NULL,                                   -- 区块时间(UTC)，由 block.timestamp 转换；事件本身不带时间，按区块批量取
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
    KEY idx_bet           (bet_id),                                              -- 按注单串起 下注→退款→领奖 全生命周期
    KEY idx_block         (block_number)                                         -- reorg 回滚时按高度范围删除重扫
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='链上用户行为流水(单事件单行)';


  -- =====================================================================
  -- 盘口→比赛 映射：索引 MarketOpened 事件填充
  -- BetPlaced/BetClaimed/BetRefunded 只带 marketId，靠这张表回填 match_id
  -- =====================================================================
  CREATE TABLE market_match_map (
    market_id   CHAR(66)        PRIMARY KEY,                                      -- 盘口ID。MarketOpened.marketId
    match_id    CHAR(66)        NOT NULL,                                         -- 比赛ID。MarketOpened.matchId
    market_type TINYINT UNSIGNED NULL,                                           -- 盘口类型。MarketOpened.marketType(胜平负/大小球/让球等)
    line        TINYINT UNSIGNED NULL,                                           -- 盘口线值。MarketOpened.line
    lock_at     DATETIME        NULL,                                            -- 封盘时间(UTC)。MarketOpened.lockAt
    KEY idx_match (match_id)                                                     -- 按比赛反查其下所有盘口
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='盘口到比赛映射(来源MarketOpened)';


  -- =====================================================================
  -- 流动池→比赛 映射：索引 MatchPoolOpened 事件填充
  -- LiquidityDeposited 只带 poolId，靠这张表回填 match_id
  -- =====================================================================
  CREATE TABLE pool_match_map (
    pool_id          VARCHAR(78)     PRIMARY KEY,                                 -- 流动池ID(uint256转串)。MatchPoolOpened.poolId
    match_id         CHAR(66)        NOT NULL,                                    -- 比赛ID。MatchPoolOpened.matchId
    match_end_time   DATETIME        NULL,                                        -- 比赛结束时间(UTC)。MatchPoolOpened.matchEndTime
    deposit_close_at DATETIME        NULL,                                        -- 截止注资时间(UTC)。MatchPoolOpened.depositCloseAt
    KEY idx_match (match_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='流动池到比赛映射(来源MatchPoolOpened)';


  -- =====================================================================
  -- 扫块进度：记录每条链已索引到的高度，断点续扫用
  -- =====================================================================
  CREATE TABLE indexer_checkpoint (
    chain_id           INT UNSIGNED    PRIMARY KEY,                               -- 链ID
    last_scanned_block BIGINT UNSIGNED NOT NULL,                                  -- 已安全索引到的区块高度(建议 = latest - N确认数)
    updated_at         TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP  -- 最后更新时间
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='索引器扫块断点';

######################################################################################
user_address 和 counterparty_address 的区分
┌────────────────────────────┬────────────────────────────┬────────────────────────────────────────────────┐
  │        action_type         │ user_address（主角，必填） │     counterparty_address（另一方，多为空）     │
  ├────────────────────────────┼────────────────────────────┼────────────────────────────────────────────────┤
  │ BET_PLACED                 │ 下注人 user                │ NULL                                           │
  ├────────────────────────────┼────────────────────────────┼────────────────────────────────────────────────┤
  │ BET_CLAIMED                │ 领奖人 user                │ 代领人 executor（当前=user，可填NULL）         │
  ├────────────────────────────┼────────────────────────────┼────────────────────────────────────────────────┤
  │ BET_REFUNDED               │ 被退款用户 user            │ NULL（注意：发起退款的运营在 tx_from，不在这） │
  ├────────────────────────────┼────────────────────────────┼────────────────────────────────────────────────┤
  │ REFERRAL_REWARD_ACCRUED    │ 拿到返佣的上线 referrer    │ 帮他产生返佣的下线 from                        │
  ├────────────────────────────┼────────────────────────────┼────────────────────────────────────────────────┤
  │ REFERRAL_CLAIMED           │ 提现的上线 referrer        │ NULL                                           │
  ├────────────────────────────┼────────────────────────────┼────────────────────────────────────────────────┤
  │ REFERRAL_CLAIMED_USDT      │ 提现的上线 referrer        │ NULL                                           │
  ├────────────────────────────┼────────────────────────────┼────────────────────────────────────────────────┤
  │ REFERRER_BOUND             │ 发起绑定的下线 user        │ 被绑定的上线 referrer                          │
  ├────────────────────────────┼────────────────────────────┼────────────────────────────────────────────────┤
  │ STAKE_CREATED              │ 质押人 user                │ NULL                                           │
  ├────────────────────────────┼────────────────────────────┼────────────────────────────────────────────────┤
  │ STAKE_WITHDRAWN            │ 质押人 user                │ NULL                                           │
  ├────────────────────────────┼────────────────────────────┼────────────────────────────────────────────────┤
  │ LIQUIDITY_DEPOSITED        │ LP user                    │ NULL                                           │
  ├────────────────────────────┼────────────────────────────┼────────────────────────────────────────────────┤
  │ LIQUIDITY_UNBOND_REQUESTED │ LP user                    │ NULL                                           │
  ├────────────────────────────┼────────────────────────────┼────────────────────────────────────────────────┤
  │ LIQUIDITY_WITHDRAWN        │ LP user                    │ NULL                                           │
  └────────────────────────────┴────────────────────────────┴────────────────────────────────────────────────┘


######################################################################################

  监听细节 

   ---
  ① BettingPool 代理 0xbbc6ef3f665bf65cb531172e5f2252155e80ce1f

  ▎ 下注/领奖/退款/推荐/市场全在这一个地址出（含结算模块 delegatecall 的事件）

  ┌───────────────────────────┬───────────────────────────┬───────────────────────────────────┐
  │           event           │         入哪张表          │        action_type / 用途         │
  ├───────────────────────────┼───────────────────────────┼───────────────────────────────────┤
  │ BetPlaced                 │ user_onchain_action               │ BET_PLACED                        │
  ├───────────────────────────┼───────────────────────────┼───────────────────────────────────┤
  │ BetClaimed                │ user_onchain_action               │ BET_CLAIMED（与下条合并）         │
  ├───────────────────────────┼───────────────────────────┼───────────────────────────────────┤
  │ PayoutClaimed             │ user_onchain_action               │ BET_CLAIMED（提供 gross/tax/net） │
  ├───────────────────────────┼───────────────────────────┼───────────────────────────────────┤
  │ BetRefunded               │ user_onchain_action               │ BET_REFUNDED                      │
  ├───────────────────────────┼───────────────────────────┼───────────────────────────────────┤
  │ ReferralRewardAccumulated │ user_onchain_action               │ REFERRAL_REWARD_ACCRUED           │
  ├───────────────────────────┼───────────────────────────┼───────────────────────────────────┤
  │ ReferralClaimed           │ user_onchain_action               │ REFERRAL_CLAIMED                  │
  ├───────────────────────────┼───────────────────────────┼───────────────────────────────────┤
  │ ReferralClaimedUSDT       │ user_onchain_action               │ REFERRAL_CLAIMED_USDT             │
  ├───────────────────────────┼───────────────────────────┼───────────────────────────────────┤
  │ ReferrerBound             │ user_onchain_action               │ REFERRER_BOUND                    │
  ├───────────────────────────┼───────────────────────────┼───────────────────────────────────┤
  │ MarketOpened              │ market_match_map          │ 回填 marketId→matchId             │
  ├───────────────────────────┼───────────────────────────┼───────────────────────────────────┤
  │ MarketSettled             │ market_settlement（可选） │ 比赛结果维度                      │
  └───────────────────────────┴───────────────────────────┴───────────────────────────────────┘

  - BetPlaced 【→user_action】 — 用户成功下注时触发。记录注单 betId、盘口 marketId、下注人 user、请求额 requestedAmount vs 实际接受额 acceptedAmount（可能因风控部分接受）、锁定赔率 lockedOdds、报价版本 quoteVersion、所选结果 outcome。用户"下了多少钱、押哪个结果"的源头。
  - BetClaimed 【→user_action】 — 用户领取中奖注单时触发。payout 是到账净额，executor 是实际执行领取的人（当前等于用户，字段为代领预留）。带 marketId。
  - PayoutClaimed 【→user_action，与 BetClaimed 合并】 — 与 BetClaimed 同一次领奖一起出，补充资金拆解：grossPayout(税前总额)、taxAmount(税)、netPayout(到账)。算"赢了多少、扣了多少税"看这条。
  - BetRefunded 【→user_action】 — 注单被退款时触发（盘口取消、push 平局、风控回滚等）。refundAmount 退款额、reason 退款原因码、user(=owner) 是被退款用户。⚠️ 这是运营批量结算触发的，tx.from 是运营地址，用户必须取事件里的 user。
  - ReferrerBound 【→user_action】 — 用户首次被绑定推荐人时触发。user 被推荐人、referrer 推荐人。推荐关系的建立。
  - ReferralRewardAccumulated 【→user_action】 — 推荐返佣"产生/累积"时触发（不是提取）。referrer 受益人、amount 返佣额、from 产生这笔返佣的下注者、kind(0=下注税返佣 / 1=派彩税返佣)。用户真正"赚到"返佣的时刻。
  - ReferralClaimed 【→user_action】 — 推荐人把累积的返佣以 ODD 形式提走。oddAmount 提取额。
  - ReferralClaimedUSDT 【→user_action】 — 推荐人提返佣并换成 USDT。oddAmount 花掉的 ODD、usdtAmount 换得的 USDT、currentPriceX18 成交价。
  - MarketOpened 【→映射表】 — 开盘时触发。建立 marketId → matchId 关系，外加盘口类型 marketType、线值 line、开赛/封盘时间。唯一能把盘口归属到比赛的来源。
  - MarketSettled 【→市场维度(可选)】 — 盘口结算时触发。resultKind 结算类型、winningOutcome 胜出结果、grossPayout 总赔付、LP/平台保证金分成。"这场盘口结果是什么"的来源，用于解释用户为何能领奖。
  ---
  ② StakingPool 代理 0x65fd4a2529010693ba474d1993631e305a42e061

  ┌────────────────┬─────────────┬────────────────────┐
  │     event      │  入哪张表   │ action_type / 用途 │
  ├────────────────┼─────────────┼────────────────────┤
  │ StakeCreated   │ user_onchain_action │ STAKE_CREATED      │
  ├────────────────┼─────────────┼────────────────────┤
  │ StakeWithdrawn │ user_onchain_action │ STAKE_WITHDRAWN    │
  └────────────────┴─────────────┴────────────────────┘

  - StakeCreated 【→user_action】 — 用户创建质押仓位。positionId 仓位、principal 本金、planId 套餐、sourceType 资金来源类型、weight 权重、unlockAt 解锁时间。
  - StakeWithdrawn 【→user_action】 — 用户提取质押。principal 本金、reward 收益、early 是否提前赎回。

  ---
  ③ LiquidityPool 代理 0xdf0c59b387dfdf9f18969880ddcf1216bfee318f

  ┌────────────────────┬────────────────┬────────────────────────────┐
  │       event        │    入哪张表    │     action_type / 用途     │
  ├────────────────────┼────────────────┼────────────────────────────┤
  │ LiquidityDeposited │ user_onchain_action    │ LIQUIDITY_DEPOSITED        │
  ├────────────────────┼────────────────┼────────────────────────────┤
  │ UnbondRequested    │ user_onchain_action    │ LIQUIDITY_UNBOND_REQUESTED │
  ├────────────────────┼────────────────┼────────────────────────────┤
  │ LiquidityWithdrawn │ user_onchain_action    │ LIQUIDITY_WITHDRAWN        │
  ├────────────────────┼────────────────┼────────────────────────────┤
  │ MatchPoolOpened    │ pool_match_map │ 回填 poolId→matchId        │
  └────────────────────┴────────────────┴────────────────────────────┘
  - LiquidityDeposited 【→user_action】 — LP 注入流动性。positionId 仓位、poolId 流动池、amount 注入额、weight 权重、planId 套餐、unlockAt 解锁时间。
  - UnbondRequested 【→user_action】 — LP 申请解绑（开始解锁倒计时）。unbondingEpoch 解绑周期，并冻结当时的 rewardPerWeight/lossPerPrincipal 用于结算。
  - LiquidityWithdrawn 【→user_action】 — LP 提取流动性。withdrawAmount 提取额、finalState 仓位终态、netPnl(有符号，可为负)即这笔 LP 的盈亏。
  - MatchPoolOpened 【→映射表】 — 为某场比赛开流动池。建立 poolId → matchId 关系，外加比赛结束/截止注资时间。LP 动作归属到比赛的来源。
