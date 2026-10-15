/**
 * Refunded / Cancelled 市场退款辅助。
 *
 * 当前流程：
 *   1. 比赛结束后调用 finalizeMarketSettlement(marketId, resultKind) 将市场置为 Refunded 或 Cancelled；
 *   2. refundBets(marketId, betIds, acceptedAmount-refundedAmount) 分批逐笔退款。
 *
 * 用法:
 *   npx tsx script/cancel.ts <marketId> <resultKind> <betId> [betId...]
 */
import {
  CONTRACTS,
  bettingAbi,
  parseBytes32,
  publicClient,
  requireWalletClient,
  waitForTx,
} from './config.js';

const [marketIdArg, resultKindArg, ...betIdArgs] = process.argv.slice(2);

if (!marketIdArg || !resultKindArg || betIdArgs.length === 0) {
  console.error('用法: npx tsx script/cancel.ts <marketId> <resultKind> <betId> [betId...]');
  process.exit(1);
}

const resultKind = Number(resultKindArg);
if (resultKind !== 1 && resultKind !== 2) {
  throw new Error('resultKind 必须为 1=Refunded 或 2=Cancelled');
}

const marketId = parseBytes32(marketIdArg);
const betIds = betIdArgs.map((betId: string) => parseBytes32(betId));
const walletClient = requireWalletClient();

console.log(`step 1/2: finalizeMarketSettlement(..., ${resultKind})`);
await waitForTx(await walletClient.writeContract({
  address: CONTRACTS.BETTING_POOL,
  abi: bettingAbi,
  functionName: 'finalizeMarketSettlement',
  args: [marketId, resultKind],
}));

console.log('step 2/2: refundBets with remaining accepted amount');
const amounts = await Promise.all(betIds.map(async (betId) => {
  const bet = await publicClient.readContract({
    address: CONTRACTS.BETTING_POOL,
    abi: bettingAbi,
    functionName: 'getBet',
    args: [betId],
  }) as readonly unknown[];
  const acceptedAmount = bet[3] as bigint;
  const refundedAmount = bet[4] as bigint;
  return acceptedAmount - refundedAmount;
}));

await waitForTx(await walletClient.writeContract({
  address: CONTRACTS.BETTING_POOL,
  abi: bettingAbi,
  functionName: 'refundBets',
  args: [marketId, betIds, amounts],
}));
