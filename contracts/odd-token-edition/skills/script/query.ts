/**
 * 当前 OddFi 合约查询工具。
 *
 * 用法:
 *   npx tsx script/query.ts addresses
 *   npx tsx script/query.ts token <address>
 *   npx tsx script/query.ts staking <address>
 *   npx tsx script/query.ts lp <positionId>
 *   npx tsx script/query.ts market <marketId>
 *   npx tsx script/query.ts odds <marketId>
 *   npx tsx script/query.ts bet <betId>
 *   npx tsx script/query.ts risk <address>
 *   npx tsx script/query.ts pool
 */
import { type Address, type Hex } from 'viem';
import {
  CONTRACTS,
  bettingAbi,
  fromOddUnits,
  jsonStringify,
  liquidityAbi,
  oddAbi,
  publicClient,
  stakingAbi,
} from './config.js';

const [action, arg] = process.argv.slice(2);

if (!action) {
  console.error('用法: npx tsx script/query.ts <addresses|token|staking|lp|market|odds|bet|risk|pool> [参数]');
  process.exit(1);
}

async function readPoolOptional(functionName: string) {
  try {
    return await publicClient.readContract({
      address: CONTRACTS.BETTING_POOL,
      abi: bettingAbi,
      functionName,
    });
  } catch (error) {
    return `UNREADABLE: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`;
  }
}

switch (action) {
  case 'addresses': {
    console.log(jsonStringify(CONTRACTS));
    break;
  }

  case 'token': {
    if (!arg) throw new Error('用法: query token <address>');
    const address = arg as Address;
    const [name, symbol, totalSupply, balance, paused] = await Promise.all([
      publicClient.readContract({ address: CONTRACTS.ODD_TOKEN, abi: oddAbi, functionName: 'name' }),
      publicClient.readContract({ address: CONTRACTS.ODD_TOKEN, abi: oddAbi, functionName: 'symbol' }),
      publicClient.readContract({ address: CONTRACTS.ODD_TOKEN, abi: oddAbi, functionName: 'totalSupply' }),
      publicClient.readContract({ address: CONTRACTS.ODD_TOKEN, abi: oddAbi, functionName: 'balanceOf', args: [address] }),
      publicClient.readContract({ address: CONTRACTS.ODD_TOKEN, abi: oddAbi, functionName: 'paused' }),
    ]) as [string, string, bigint, bigint, boolean];

    console.log(`Token: ${name} (${symbol})`);
    console.log(`paused: ${paused}`);
    console.log(`totalSupply: ${fromOddUnits(totalSupply)} ODD`);
    console.log(`${address}: ${fromOddUnits(balance)} ODD`);
    break;
  }

  case 'staking': {
    if (!arg) throw new Error('用法: query staking <address>');
    const address = arg as Address;
    const [active, tier, dailyLimit, minStake, pool] = await Promise.all([
      publicClient.readContract({ address: CONTRACTS.STAKING_POOL, abi: stakingAbi, functionName: 'getActiveStakeAmount', args: [address] }),
      publicClient.readContract({ address: CONTRACTS.STAKING_POOL, abi: stakingAbi, functionName: 'getUserTier', args: [address] }),
      publicClient.readContract({ address: CONTRACTS.STAKING_POOL, abi: stakingAbi, functionName: 'getUserDailyLimit', args: [address] }),
      publicClient.readContract({ address: CONTRACTS.STAKING_POOL, abi: stakingAbi, functionName: 'minStakeAmount' }),
      publicClient.readContract({ address: CONTRACTS.STAKING_POOL, abi: stakingAbi, functionName: 'bettingPool' }),
    ]) as [bigint, number, bigint, bigint, Address];

    console.log(`activeStake: ${fromOddUnits(active)} ODD`);
    console.log(`tier: ${tier}`);
    console.log(`dailyLimit: ${fromOddUnits(dailyLimit)} ODD`);
    console.log(`minStakeAmount: ${fromOddUnits(minStake)} ODD`);
    console.log(`bettingPool: ${pool}`);
    break;
  }

  case 'lp': {
    if (!arg) throw new Error('用法: query lp <positionId>');
    const positionId = BigInt(arg);
    const [position, state] = await Promise.all([
      publicClient.readContract({ address: CONTRACTS.LIQUIDITY_POOL, abi: liquidityAbi, functionName: 'positions', args: [positionId] }),
      publicClient.readContract({ address: CONTRACTS.LIQUIDITY_POOL, abi: liquidityAbi, functionName: 'getPositionState', args: [positionId] }),
    ]);
    console.log(jsonStringify({ position, effectiveState: state }));
    break;
  }

  case 'market': {
    if (!arg) throw new Error('用法: query market <marketId>');
    const market = await publicClient.readContract({
      address: CONTRACTS.BETTING_POOL,
      abi: bettingAbi,
      functionName: 'getMarket',
      args: [arg as Hex],
    });
    console.log(jsonStringify(market));
    break;
  }

  case 'odds': {
    if (!arg) throw new Error('用法: query odds <marketId>');
    const odds = await publicClient.readContract({
      address: CONTRACTS.BETTING_POOL,
      abi: bettingAbi,
      functionName: 'getMarketOdds',
      args: [arg as Hex],
    });
    console.log(jsonStringify(odds));
    break;
  }

  case 'bet': {
    if (!arg) throw new Error('用法: query bet <betId>');
    const bet = await publicClient.readContract({
      address: CONTRACTS.BETTING_POOL,
      abi: bettingAbi,
      functionName: 'getBet',
      args: [arg as Hex],
    });
    console.log(jsonStringify(bet));
    break;
  }

  case 'risk': {
    if (!arg) throw new Error('用法: query risk <address>');
    const risk = await publicClient.readContract({
      address: CONTRACTS.BETTING_POOL,
      abi: bettingAbi,
      functionName: 'getUserRiskLedger',
      args: [arg as Address],
    });
    console.log(jsonStringify(risk));
    break;
  }

  case 'pool': {
    const [requestableLiquidity, platformReserve, taxBuffer, lpLossOffsetRemaining, settlementModule] = await Promise.all([
      publicClient.readContract({ address: CONTRACTS.LIQUIDITY_POOL, abi: liquidityAbi, functionName: 'getRequestableLiquidity' }),
      readPoolOptional('platformReserve'),
      readPoolOptional('taxBuffer'),
      readPoolOptional('lpLossOffsetRemaining'),
      readPoolOptional('settlementModule'),
    ]) as [bigint, bigint | string, bigint | string, bigint | string, Address | string];

    console.log(`requestableLiquidity: ${fromOddUnits(requestableLiquidity)} ODD`);
    console.log(`platformReserve: ${typeof platformReserve === 'bigint' ? `${fromOddUnits(platformReserve)} ODD` : platformReserve}`);
    console.log(`taxBuffer: ${typeof taxBuffer === 'bigint' ? `${fromOddUnits(taxBuffer)} ODD` : taxBuffer}`);
    console.log(`lpLossOffsetRemaining: ${typeof lpLossOffsetRemaining === 'bigint' ? `${fromOddUnits(lpLossOffsetRemaining)} ODD` : lpLossOffsetRemaining}`);
    console.log(`settlementModule: ${settlementModule}`);
    break;
  }

  default:
    throw new Error(`未知操作: ${action}`);
}
