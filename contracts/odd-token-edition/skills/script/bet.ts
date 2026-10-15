/**
 * BettingPool 下单/领奖工具。
 *
 * 用法:
 *   npx tsx script/bet.ts approve <amountODD>
 *   npx tsx script/bet.ts bind <referrer>
 *   npx tsx script/bet.ts preview <marketId> <outcome> <amountODD>
 *   npx tsx script/bet.ts place <marketId> <outcome> <amountODD> <minOdds> <minAcceptedODD> <deadlineTs> [referrer]
 *   npx tsx script/bet.ts cashout <betId> <minAmountOutODD> <deadlineTs> [quotedAt]
 *   npx tsx script/bet.ts claim <betId>
 *   npx tsx script/bet.ts claim-ref <amountODD>
 */
import { type Address, type Hex } from 'viem';
import {
  CONTRACTS,
  bettingAbi,
  jsonStringify,
  oddAbi,
  parseBytes32,
  publicClient,
  requireWalletClient,
  toOddUnits,
  waitForTx,
} from './config.js';

const [action, a, b, c, d, e, f, g] = process.argv.slice(2);

if (!action) {
  console.error('用法: npx tsx script/bet.ts <approve|bind|preview|place|cashout|claim|claim-ref> ...');
  process.exit(1);
}

switch (action) {
  case 'approve': {
    if (!a) throw new Error('用法: bet approve <amountODD>');
    const walletClient = requireWalletClient();
    const hash = await walletClient.writeContract({
      address: CONTRACTS.ODD_TOKEN,
      abi: oddAbi,
      functionName: 'approve',
      args: [CONTRACTS.BETTING_POOL, toOddUnits(a)],
    });
    await waitForTx(hash);
    break;
  }

  case 'bind': {
    if (!a) throw new Error('用法: bet bind <referrer>');
    const walletClient = requireWalletClient();
    const hash = await walletClient.writeContract({
      address: CONTRACTS.BETTING_POOL,
      abi: bettingAbi,
      functionName: 'bindReferrer',
      args: [a as Address],
    });
    await waitForTx(hash);
    break;
  }

  case 'preview': {
    if (!a || !b || !c) throw new Error('用法: bet preview <marketId> <outcome> <amountODD>');
    const preview = await publicClient.readContract({
      address: CONTRACTS.BETTING_POOL,
      abi: bettingAbi,
      functionName: 'previewSignal',
      args: [parseBytes32(a), Number(b), toOddUnits(c)],
    });
    console.log(jsonStringify(preview));
    break;
  }

  case 'place': {
    if (!a || !b || !c || !d || !e || !f) {
      throw new Error('用法: bet place <marketId> <outcome> <amountODD> <minOdds> <minAcceptedODD> <deadlineTs> [referrer]');
    }
    const marketId = parseBytes32(a);
    const odds = await publicClient.readContract({
      address: CONTRACTS.BETTING_POOL,
      abi: bettingAbi,
      functionName: 'getMarketOdds',
      args: [marketId],
    }) as readonly [readonly bigint[], readonly bigint[], bigint, bigint];
    const guard = {
      quoteVersion: odds[3],
      quotedAt: odds[2],
      minOdds: BigInt(d),
      minAcceptedAmount: toOddUnits(e),
      deadline: BigInt(f),
    };
    const walletClient = requireWalletClient();
    const args = g
      ? [marketId, Number(b), toOddUnits(c), guard, g as Address]
      : [marketId, Number(b), toOddUnits(c), guard];
    const hash = await walletClient.writeContract({
      address: CONTRACTS.BETTING_POOL,
      abi: bettingAbi,
      functionName: 'placeBet',
      args,
    });
    await waitForTx(hash);
    break;
  }

  case 'cashout': {
    if (!a || !b || !c) {
      throw new Error('用法: bet cashout <betId> <minAmountOutODD> <deadlineTs> [quotedAt]');
    }
    const betId = parseBytes32(a);
    const bet = await publicClient.readContract({
      address: CONTRACTS.BETTING_POOL,
      abi: bettingAbi,
      functionName: 'getBet',
      args: [betId],
    }) as readonly [Address, Hex, number, bigint, bigint, bigint, number, number, bigint, number, number, number, number, Address];
    const odds = await publicClient.readContract({
      address: CONTRACTS.BETTING_POOL,
      abi: bettingAbi,
      functionName: 'getMarketOdds',
      args: [bet[1]],
    }) as readonly [readonly bigint[], readonly bigint[], bigint, bigint];
    const latestBlock = await publicClient.getBlock();
    const quotedAt = d ? BigInt(d) : BigInt(latestBlock.timestamp);
    const walletClient = requireWalletClient();
    const hash = await walletClient.writeContract({
      address: CONTRACTS.BETTING_POOL,
      abi: bettingAbi,
      functionName: 'cashOut',
      args: [betId, odds[3], quotedAt, toOddUnits(b), BigInt(c)],
    });
    await waitForTx(hash);
    break;
  }

  case 'claim': {
    if (!a) throw new Error('用法: bet claim <betId>');
    const walletClient = requireWalletClient();
    const hash = await walletClient.writeContract({
      address: CONTRACTS.BETTING_POOL,
      abi: bettingAbi,
      functionName: 'claimPayout',
      args: [parseBytes32(a)],
    });
    await waitForTx(hash);
    break;
  }

  case 'claim-ref': {
    if (!a) throw new Error('用法: bet claim-ref <amountODD>');
    const walletClient = requireWalletClient();
    const hash = await walletClient.writeContract({
      address: CONTRACTS.BETTING_POOL,
      abi: bettingAbi,
      functionName: 'claimReferralRewards',
      args: [toOddUnits(a)],
    });
    await waitForTx(hash);
    break;
  }

  default:
    throw new Error(`未知操作: ${action}`);
}
