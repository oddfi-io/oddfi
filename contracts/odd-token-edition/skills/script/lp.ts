/**
 * LiquidityPool 工具。
 *
 * 用法:
 *   npx tsx script/lp.ts approve <amountODD>
 *   npx tsx script/lp.ts global <amountODD> <planId>
 *   npx tsx script/lp.ts match <matchId> <amountODD>
 *   npx tsx script/lp.ts unbond <positionId>
 *   npx tsx script/lp.ts withdraw <positionId>
 *   npx tsx script/lp.ts info <positionId>
 *   npx tsx script/lp.ts window <matchId>
 */
import { type Hex } from 'viem';
import {
  CONTRACTS,
  fromOddUnits,
  jsonStringify,
  liquidityAbi,
  oddAbi,
  parseBytes32,
  publicClient,
  requireWalletClient,
  toOddUnits,
  waitForTx,
} from './config.js';

const [action, a, b] = process.argv.slice(2);

if (!action) {
  console.error('用法: npx tsx script/lp.ts <approve|global|match|unbond|withdraw|info|window> ...');
  process.exit(1);
}

switch (action) {
  case 'approve': {
    if (!a) throw new Error('用法: lp approve <amountODD>');
    const walletClient = requireWalletClient();
    const hash = await walletClient.writeContract({
      address: CONTRACTS.ODD_TOKEN,
      abi: oddAbi,
      functionName: 'approve',
      args: [CONTRACTS.LIQUIDITY_POOL, toOddUnits(a)],
    });
    await waitForTx(hash);
    break;
  }

  case 'global': {
    if (!a || !b) throw new Error('用法: lp global <amountODD> <planId>');
    const walletClient = requireWalletClient();
    const hash = await walletClient.writeContract({
      address: CONTRACTS.LIQUIDITY_POOL,
      abi: liquidityAbi,
      functionName: 'depositGlobal',
      args: [toOddUnits(a), Number(b)],
    });
    await waitForTx(hash);
    break;
  }

  case 'match': {
    if (!a || !b) throw new Error('用法: lp match <matchId> <amountODD>');
    const walletClient = requireWalletClient();
    const hash = await walletClient.writeContract({
      address: CONTRACTS.LIQUIDITY_POOL,
      abi: liquidityAbi,
      functionName: 'depositMatch',
      args: [parseBytes32(a), toOddUnits(b)],
    });
    await waitForTx(hash);
    break;
  }

  case 'unbond': {
    if (!a) throw new Error('用法: lp unbond <positionId>');
    const walletClient = requireWalletClient();
    const hash = await walletClient.writeContract({
      address: CONTRACTS.LIQUIDITY_POOL,
      abi: liquidityAbi,
      functionName: 'requestUnbond',
      args: [BigInt(a)],
    });
    await waitForTx(hash);
    break;
  }

  case 'withdraw': {
    if (!a) throw new Error('用法: lp withdraw <positionId>');
    const walletClient = requireWalletClient();
    const hash = await walletClient.writeContract({
      address: CONTRACTS.LIQUIDITY_POOL,
      abi: liquidityAbi,
      functionName: 'withdraw',
      args: [BigInt(a)],
    });
    await waitForTx(hash);
    break;
  }

  case 'info': {
    if (!a) throw new Error('用法: lp info <positionId>');
    const positionId = BigInt(a);
    const [position, state] = await Promise.all([
      publicClient.readContract({ address: CONTRACTS.LIQUIDITY_POOL, abi: liquidityAbi, functionName: 'positions', args: [positionId] }),
      publicClient.readContract({ address: CONTRACTS.LIQUIDITY_POOL, abi: liquidityAbi, functionName: 'getPositionState', args: [positionId] }),
    ]);
    console.log(jsonStringify({ position, effectiveState: state }));
    break;
  }

  case 'window': {
    if (!a) throw new Error('用法: lp window <matchId>');
    const window = await publicClient.readContract({
      address: CONTRACTS.LIQUIDITY_POOL,
      abi: liquidityAbi,
      functionName: 'getPayoutLiquidityWindow',
      args: [parseBytes32(a) as Hex],
    });
    console.log(jsonStringify(window));
    break;
  }

  case 'requestable': {
    const liquidity = await publicClient.readContract({
      address: CONTRACTS.LIQUIDITY_POOL,
      abi: liquidityAbi,
      functionName: 'getRequestableLiquidity',
    }) as bigint;
    console.log(`requestableLiquidity: ${fromOddUnits(liquidity)} ODD`);
    break;
  }

  default:
    throw new Error(`未知操作: ${action}`);
}
