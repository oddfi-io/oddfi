// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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
error MarketNotClosed();               // 盘口非 Closed，不可结算
error OutcomeInconsistent();            // 分批 settle 时 winningOutcome 不一致
error ParlayPartiallySettled();         // 串关已部分结算，不可直接取消
error TooManyMarkets();                // 该赛事盘口数已达上限
error FrozenPayoutNotFound();          // 冻结赔付不存在（releaseOrForfeiture 幂等保护）
