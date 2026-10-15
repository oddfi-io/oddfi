/**
 * StakingPool 工具。
 *
 * 用法:
 *   npx tsx script/stake.ts approve <amountODD>
 *   npx tsx script/stake.ts stake <amountODD> <planId>
 *   npx tsx script/stake.ts unstake <positionId>
 *   npx tsx script/stake.ts early <positionId>
 *   npx tsx script/stake.ts info <address>
 *   npx tsx script/stake.ts position <positionId>
 */
import { type Address } from 'viem';
import {
  CONTRACTS,
  fromOddUnits,
  jsonStringify,
  oddAbi,
  publicClient,
  requireWalletClient,
  stakingAbi,
  toOddUnits,
  waitForTx,
} from './config.js';

const [action, a, b] = process.argv.slice(2);

if (!action) {
  console.error('用法: npx tsx script/stake.ts <approve|stake|unstake|early|info|position> ...');
  process.exit(1);
}

switch (action) {
  case 'approve': {
    if (!a) throw new Error('用法: stake approve <amountODD>');
    const walletClient = requireWalletClient();
    const hash = await walletClient.writeContract({
      address: CONTRACTS.ODD_TOKEN,
      abi: oddAbi,
      functionName: 'approve',
      args: [CONTRACTS.STAKING_POOL, toOddUnits(a)],
    });
    await waitForTx(hash);
    break;
  }

  case 'stake': {
    if (!a || !b) throw new Error('用法: stake stake <amountODD> <planId>');
    const walletClient = requireWalletClient();
    const hash = await walletClient.writeContract({
      address: CONTRACTS.STAKING_POOL,
      abi: stakingAbi,
      functionName: 'stake',
      args: [toOddUnits(a), Number(b)],
    });
    await waitForTx(hash);
    break;
  }

  case 'unstake': {
    if (!a) throw new Error('用法: stake unstake <positionId>');
    const walletClient = requireWalletClient();
    const hash = await walletClient.writeContract({
      address: CONTRACTS.STAKING_POOL,
      abi: stakingAbi,
      functionName: 'unstake',
      args: [BigInt(a)],
    });
    await waitForTx(hash);
    break;
  }

  case 'early': {
    if (!a) throw new Error('用法: stake early <positionId>');
    const walletClient = requireWalletClient();
    const hash = await walletClient.writeContract({
      address: CONTRACTS.STAKING_POOL,
      abi: stakingAbi,
      functionName: 'earlyUnstake',
      args: [BigInt(a)],
    });
    await waitForTx(hash);
    break;
  }

  case 'info': {
    if (!a) throw new Error('用法: stake info <address>');
    const address = a as Address;
    const [active, tier, dailyLimit, minStake] = await Promise.all([
      publicClient.readContract({ address: CONTRACTS.STAKING_POOL, abi: stakingAbi, functionName: 'getActiveStakeAmount', args: [address] }),
      publicClient.readContract({ address: CONTRACTS.STAKING_POOL, abi: stakingAbi, functionName: 'getUserTier', args: [address] }),
      publicClient.readContract({ address: CONTRACTS.STAKING_POOL, abi: stakingAbi, functionName: 'getUserDailyLimit', args: [address] }),
      publicClient.readContract({ address: CONTRACTS.STAKING_POOL, abi: stakingAbi, functionName: 'minStakeAmount' }),
    ]) as [bigint, number, bigint, bigint];
    console.log(`activeStake: ${fromOddUnits(active)} ODD`);
    console.log(`tier: ${tier}`);
    console.log(`dailyLimit: ${fromOddUnits(dailyLimit)} ODD`);
    console.log(`minStakeAmount: ${fromOddUnits(minStake)} ODD`);
    break;
  }

  case 'position': {
    if (!a) throw new Error('用法: stake position <positionId>');
    const position = await publicClient.readContract({
      address: CONTRACTS.STAKING_POOL,
      abi: stakingAbi,
      functionName: 'positions',
      args: [BigInt(a)],
    });
    console.log(jsonStringify(position));
    break;
  }

  default:
    throw new Error(`未知操作: ${action}`);
}
