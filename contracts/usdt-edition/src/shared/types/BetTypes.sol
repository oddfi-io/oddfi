// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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
