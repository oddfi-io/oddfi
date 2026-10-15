/**
 * 结算盘口（需multisig权限）
 * 用法: npx tsx script/settle.ts <matchId> <marketType> <line> <winningOutcome> <betId1> [betId2...]
 */
import { type Hex } from 'viem';
import { CONTRACTS, poolAbi, walletClient, waitForTx } from './config.js';

const args = process.argv.slice(2);
if (args.length < 5) {
  console.error('用法: npx tsx script/settle.ts <matchId> <marketType> <line> <winningOutcome> <betId1> [betId2...]');
  process.exit(1);
}

const [matchId, marketType, line, winningOutcome, ...betIds] = args;

console.log(`\n=== 结算盘口 ===`);
console.log(`赛事:    ${matchId}`);
console.log(`盘口:    type=${marketType} line=${line}`);
console.log(`胜出:    outcome=${winningOutcome}`);
console.log(`注单数:  ${betIds.length}\n`);

const hash = await walletClient.writeContract({
  address: CONTRACTS.POOL,
  abi: poolAbi,
  functionName: 'settle',
  args: [
    matchId as Hex,
    Number(marketType),
    Number(line),
    Number(winningOutcome),
    betIds as Hex[],
  ],
});
await waitForTx(hash);

console.log('=== 结算完成 ===\n');
