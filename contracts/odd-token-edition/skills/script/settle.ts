/**
 * BettingPool score-based 结算/退款工具。
 *
 * 用法:
 *   npx tsx script/settle.ts score <marketId> <homeScore> <awayScore> [batchSize]
 *   npx tsx script/settle.ts batch <marketId> <homeScore> <awayScore> <betId> [betId...]
 *   npx tsx script/settle.ts finalize <marketId> <resultKind>
 *   npx tsx script/settle.ts refund <marketId> <betId:amountODD> [betId:amountODD...]
 *   npx tsx script/settle.ts list <marketId> [offset] [limit]
 */
import {
  CONTRACTS,
  bettingAbi,
  jsonStringify,
  parseBytes32,
  publicClient,
  requireWalletClient,
  toOddUnits,
  waitForTx,
} from './config.js';

const DEFAULT_BATCH_SIZE = 100;
const [action, marketIdArg, a, b, ...rest] = process.argv.slice(2);

if (!action || !marketIdArg) {
  usage();
  process.exit(1);
}

const marketId = parseBytes32(marketIdArg);
const walletClient = action === 'list' ? undefined : requireWalletClient();

switch (action) {
  case 'score': {
    if (!a || !b) throw new Error('用法: settle score <marketId> <homeScore> <awayScore> [batchSize]');
    const homeScore = Number(a);
    const awayScore = Number(b);
    const batchSize = rest[0] ? Number(rest[0]) : DEFAULT_BATCH_SIZE;
    if (!Number.isInteger(batchSize) || batchSize <= 0) throw new Error('batchSize 必须是正整数');

    let offset = 0n;
    let processed = 0;
    while (true) {
      const betIds = await readBetIds(marketId, offset, BigInt(batchSize));
      if (betIds.length === 0) break;
      const hash = await walletClient!.writeContract({
        address: CONTRACTS.BETTING_POOL,
        abi: bettingAbi,
        functionName: 'settleMarketBetsByScore',
        args: [marketId, homeScore, awayScore, betIds],
      });
      await waitForTx(hash);
      processed += betIds.length;
      offset += BigInt(betIds.length);
      console.log(`settled batch: ${betIds.length}, totalProcessed=${processed}`);
      if (betIds.length < batchSize) break;
    }

    const finalizeHash = await walletClient!.writeContract({
      address: CONTRACTS.BETTING_POOL,
      abi: bettingAbi,
      functionName: 'finalizeMarketSettlement',
      args: [marketId, 0],
    });
    await waitForTx(finalizeHash);
    console.log(`finalized score settlement: ${finalizeHash}`);
    break;
  }

  case 'batch': {
    if (!a || !b || rest.length === 0) {
      throw new Error('用法: settle batch <marketId> <homeScore> <awayScore> <betId> [betId...]');
    }
    const betIds = rest.map((entry) => parseBytes32(entry));
    const hash = await walletClient!.writeContract({
      address: CONTRACTS.BETTING_POOL,
      abi: bettingAbi,
      functionName: 'settleMarketBetsByScore',
      args: [marketId, Number(a), Number(b), betIds],
    });
    await waitForTx(hash);
    break;
  }

  case 'finalize': {
    if (!a) throw new Error('用法: settle finalize <marketId> <resultKind>');
    const hash = await walletClient!.writeContract({
      address: CONTRACTS.BETTING_POOL,
      abi: bettingAbi,
      functionName: 'finalizeMarketSettlement',
      args: [marketId, Number(a)],
    });
    await waitForTx(hash);
    break;
  }

  case 'refund': {
    const entries = [a, b, ...rest].filter(Boolean) as string[];
    if (entries.length === 0) throw new Error('用法: settle refund <marketId> <betId:amountODD> [betId:amountODD...]');
    const betIds = entries.map((entry) => parseBytes32(entry.split(':')[0]));
    const amounts = entries.map((entry) => {
      const [, amount] = entry.split(':');
      if (!amount) throw new Error(`退款项缺少金额: ${entry}`);
      return toOddUnits(amount);
    });
    const hash = await walletClient!.writeContract({
      address: CONTRACTS.BETTING_POOL,
      abi: bettingAbi,
      functionName: 'refundBets',
      args: [marketId, betIds, amounts],
    });
    await waitForTx(hash);
    break;
  }

  case 'list': {
    const offset = a ? BigInt(a) : 0n;
    const limit = b ? BigInt(b) : BigInt(DEFAULT_BATCH_SIZE);
    const betIds = await readBetIds(marketId, offset, limit);
    console.log(jsonStringify(betIds));
    break;
  }

  default:
    usage();
    throw new Error(`未知操作: ${action}`);
}

async function readBetIds(targetMarketId: `0x${string}`, offset: bigint, limit: bigint) {
  return await publicClient.readContract({
    address: CONTRACTS.BETTING_POOL,
    abi: bettingAbi,
    functionName: 'getMarketBetIds',
    args: [targetMarketId, offset, limit],
  }) as readonly `0x${string}`[];
}

function usage() {
  console.error([
    '用法:',
    '  npx tsx script/settle.ts score <marketId> <homeScore> <awayScore> [batchSize]',
    '  npx tsx script/settle.ts batch <marketId> <homeScore> <awayScore> <betId> [betId...]',
    '  npx tsx script/settle.ts finalize <marketId> <resultKind>',
    '  npx tsx script/settle.ts refund <marketId> <betId:amountODD> [betId:amountODD...]',
    '  npx tsx script/settle.ts list <marketId> [offset] [limit]',
  ].join('\n'));
}
