/**
 * 赛事取消（需multisig权限）
 * 用法: npx tsx script/cancel.ts <matchId> <marketType> <line> <betId1> [betId2...]
 */
import { type Hex } from 'viem';
import { CONTRACTS, poolAbi, walletClient, waitForTx } from './config.js';

const args = process.argv.slice(2);
if (args.length < 4) {
  console.error('用法: npx tsx script/cancel.ts <matchId> <marketType> <line> <betId1> [betId2...]');
  process.exit(1);
}

const [matchId, marketType, line, ...betIds] = args;

console.log(`\n=== 取消赛事盘口 ===`);
console.log(`赛事:    ${matchId}`);
console.log(`盘口:    type=${marketType} line=${line}`);
console.log(`注单数:  ${betIds.length}\n`);

const hash = await walletClient.writeContract({
  address: CONTRACTS.POOL,
  abi: poolAbi,
  functionName: 'cancelMatch',
  args: [
    matchId as Hex,
    Number(marketType),
    Number(line),
    betIds as Hex[],
  ],
});
await waitForTx(hash);

console.log('=== 取消完成 ===\n');
