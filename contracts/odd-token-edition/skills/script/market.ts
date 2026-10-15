/**
 * BettingPool 市场与赔率工具。
 *
 * 用法:
 *   npx tsx script/market.ts id <matchId> <marketType> <line>
 *   npx tsx script/market.ts open <matchId> <marketType> <line> <startTs> <endTs> <oddsCsv> [updatedAt]
 *   npx tsx script/market.ts odds <marketId> <oddsCsv> [updatedAt]
 *   npx tsx script/market.ts lock <marketId>
 *   npx tsx script/market.ts status <marketId>
 */
import {
  CONTRACTS,
  bettingAbi,
  jsonStringify,
  marketId,
  parseBytes32,
  parseOddsCsv,
  publicClient,
  requireWalletClient,
  waitForTx,
} from './config.js';

const [action, a, b, c, d, e, f, g] = process.argv.slice(2);

if (!action) {
  console.error('用法: npx tsx script/market.ts <id|open|odds|lock|status> ...');
  process.exit(1);
}

switch (action) {
  case 'id': {
    if (!a || !b || !c) throw new Error('用法: market id <matchId> <marketType> <line>');
    const matchId = parseBytes32(a);
    const id = marketId(matchId, Number(b), Number(c));
    console.log(id);
    break;
  }

  case 'open': {
    if (!a || !b || !c || !d || !e || !f) {
      throw new Error('用法: market open <matchId> <marketType> <line> <startTs> <endTs> <oddsCsv> [updatedAt]');
    }
    const walletClient = requireWalletClient();
    const matchId = parseBytes32(a);
    const updatedAt = g ? BigInt(g) : BigInt(Math.floor(Date.now() / 1000));
    const hash = await walletClient.writeContract({
      address: CONTRACTS.BETTING_POOL,
      abi: bettingAbi,
      functionName: 'openMarket',
      args: [matchId, Number(b), Number(c), BigInt(d), BigInt(e), parseOddsCsv(f), updatedAt],
    });
    await waitForTx(hash);
    console.log(`marketId: ${marketId(matchId, Number(b), Number(c))}`);
    break;
  }

  case 'odds': {
    if (!a || !b) throw new Error('用法: market odds <marketId> <oddsCsv> [updatedAt]');
    const walletClient = requireWalletClient();
    const updatedAt = c ? BigInt(c) : BigInt(Math.floor(Date.now() / 1000));
    const hash = await walletClient.writeContract({
      address: CONTRACTS.BETTING_POOL,
      abi: bettingAbi,
      functionName: 'updateOdds',
      args: [parseBytes32(a), parseOddsCsv(b), updatedAt],
    });
    await waitForTx(hash);
    break;
  }

  case 'lock': {
    if (!a) throw new Error('用法: market lock <marketId>');
    const walletClient = requireWalletClient();
    const hash = await walletClient.writeContract({
      address: CONTRACTS.BETTING_POOL,
      abi: bettingAbi,
      functionName: 'lockMarket',
      args: [parseBytes32(a)],
    });
    await waitForTx(hash);
    break;
  }

  case 'status': {
    if (!a) throw new Error('用法: market status <marketId>');
    const [market, odds] = await Promise.all([
      publicClient.readContract({ address: CONTRACTS.BETTING_POOL, abi: bettingAbi, functionName: 'getMarket', args: [parseBytes32(a)] }),
      publicClient.readContract({ address: CONTRACTS.BETTING_POOL, abi: bettingAbi, functionName: 'getMarketOdds', args: [parseBytes32(a)] }),
    ]);
    console.log(jsonStringify({ market, odds }));
    break;
  }

  default:
    throw new Error(`未知操作: ${action}`);
}
