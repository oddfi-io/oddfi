// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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
