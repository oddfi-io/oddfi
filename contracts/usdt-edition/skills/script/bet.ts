/**
 * 下注
 * 用法: npx tsx script/bet.ts <betId> <用户地址> <金额USDT> <matchId> <marketType> <outcome> <line> <赔率>
 * 赔率: ×1000, 如 1.818 → 1818
 */
import { type Address, type Hex } from 'viem';
import { CONTRACTS, poolAbi, walletClient, toUsdtUnits, waitForTx } from './config.js';

const args = process.argv.slice(2);
if (args.length < 8) {
  console.error('用法: npx tsx script/bet.ts <betId> <user> <amount> <matchId> <marketType> <outcome> <line> <odds>');
  process.exit(1);
}

const [betId, user, amountStr, matchId, marketType, outcome, line, odds] = args;
const amount = toUsdtUnits(Number(amountStr));

console.log(`\n=== 下注 ===`);
console.log(`betId:   ${betId}`);
console.log(`用户:    ${user}`);
console.log(`金额:    ${amountStr} USDT`);
console.log(`赛事:    ${matchId}`);
console.log(`盘口:    type=${marketType} line=${line}`);
console.log(`方向:    outcome=${outcome}`);
console.log(`赔率:    ${(Number(odds) / 1000).toFixed(3)}\n`);

const hash = await walletClient.writeContract({
  address: CONTRACTS.POOL,
  abi: poolAbi,
  functionName: 'lockBet',
  args: [
    betId as Hex,
    user as Address,
    amount,
    matchId as Hex,
    Number(marketType),
    Number(outcome),
    Number(line),
    BigInt(odds),
  ],
});
await waitForTx(hash);

console.log('=== 下注成功 ===\n');
