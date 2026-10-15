/**
 * 通用查询工具（无需私钥即可使用，但 config.ts 要求导出）
 * 用法:
 *   npx tsx script/query.ts balance <地址>
 *   npx tsx script/query.ts bet <betId>
 *   npx tsx script/query.ts parlay <parlayId>
 *   npx tsx script/query.ts pool
 *   npx tsx script/query.ts platform
 */
import { type Address, type Hex } from 'viem';
import { CONTRACTS, poolAbi, usdtAbi, publicClient, fromUsdtUnits } from './config.js';

const STATUS_LABELS = ['Pending', 'Won', 'Lost', 'Cancelled'];
const MARKET_LABELS = ['X12', 'AH', 'OU'];

const [action, arg] = process.argv.slice(2);
if (!action) {
  console.error('用法: npx tsx script/query.ts <balance|bet|parlay|pool|platform> [参数]');
  process.exit(1);
}

switch (action) {
  case 'balance': {
    if (!arg) { console.error('用法: npx tsx script/query.ts balance <地址>'); process.exit(1); }
    const addr = arg as Address;

    const [balance, locked] = await Promise.all([
      publicClient.readContract({ address: CONTRACTS.POOL, abi: poolAbi, functionName: 'userBalances', args: [addr] }),
      publicClient.readContract({ address: CONTRACTS.POOL, abi: poolAbi, functionName: 'lockedBalances', args: [addr] }),
    ]) as [bigint, bigint];

    const available = balance - locked;
    console.log(`\n=== 用户余额: ${addr} ===`);
    console.log(`总余额:   ${fromUsdtUnits(balance)} USDT`);
    console.log(`锁定中:   ${fromUsdtUnits(locked)} USDT`);
    console.log(`可用余额: ${fromUsdtUnits(available)} USDT\n`);
    break;
  }
  case 'bet': {
    if (!arg) { console.error('用法: npx tsx script/query.ts bet <betId>'); process.exit(1); }
    const result = await publicClient.readContract({
      address: CONTRACTS.POOL,
      abi: poolAbi,
      functionName: 'bets',
      args: [arg as Hex],
    }) as any[];

    console.log(`\n=== 注单: ${arg} ===`);
    console.log(`用户:       ${result[0]}`);
    console.log(`金额:       ${fromUsdtUnits(result[1] as bigint)} USDT`);
    console.log(`赛事:       ${result[2]}`);
    console.log(`盘口类型:   ${MARKET_LABELS[Number(result[3])]}`);
    console.log(`方向:       outcome=${result[4]}`);
    console.log(`线:         line=${result[5]}`);
    console.log(`锁定赔率:   ${(Number(result[6]) / 1000).toFixed(3)}`);
    console.log(`状态:       ${STATUS_LABELS[Number(result[7])]}`);
    console.log(`信用仓位:   ${result[8]}`);
    console.log(`串关:       ${result[10]}\n`);
    break;
  }
  case 'parlay': {
    if (!arg) { console.error('用法: npx tsx script/query.ts parlay <parlayId>'); process.exit(1); }

    const [parlay, legs] = await Promise.all([
      publicClient.readContract({ address: CONTRACTS.POOL, abi: poolAbi, functionName: 'parlays', args: [arg as Hex] }),
      publicClient.readContract({ address: CONTRACTS.POOL, abi: poolAbi, functionName: 'getParlayLegs', args: [arg as Hex] }),
    ]) as [any[], Hex[]];

    console.log(`\n=== 串关: ${arg} ===`);
    console.log(`用户:       ${parlay[0]}`);
    console.log(`投注额:     ${fromUsdtUnits(parlay[1] as bigint)} USDT`);
    console.log(`组合赔率:   ${(Number(parlay[2]) / 1000).toFixed(3)}`);
    console.log(`最大赔付:   ${fromUsdtUnits(parlay[3] as bigint)} USDT`);
    console.log(`状态:       ${STATUS_LABELS[Number(parlay[4])]}`);
    console.log(`已结算腿:   ${parlay[5]}`);
    console.log(`赢的腿:     ${parlay[6]}`);
    console.log(`取消的腿:   ${parlay[7]}`);
    console.log(`各腿 betId:`);
    legs.forEach((leg, i) => console.log(`  [${i}] ${leg}`));
    console.log('');
    break;
  }
  case 'pool': {
    const [bp, tpp, tfp, tub, tco, usdtBal, platBal] = await Promise.all([
      publicClient.readContract({ address: CONTRACTS.POOL, abi: poolAbi, functionName: 'bettingPool' }),
      publicClient.readContract({ address: CONTRACTS.POOL, abi: poolAbi, functionName: 'totalPotentialPayout' }),
      publicClient.readContract({ address: CONTRACTS.POOL, abi: poolAbi, functionName: 'totalFrozenPayouts' }),
      publicClient.readContract({ address: CONTRACTS.POOL, abi: poolAbi, functionName: 'totalUserBalances' }),
      publicClient.readContract({ address: CONTRACTS.POOL, abi: poolAbi, functionName: 'totalCreditOutstanding' }),
      publicClient.readContract({ address: CONTRACTS.USDT, abi: usdtAbi, functionName: 'balanceOf', args: [CONTRACTS.POOL] }),
      publicClient.readContract({ address: CONTRACTS.POOL, abi: poolAbi, functionName: 'platformBalance' }),
    ]) as bigint[];

    console.log(`\n=== 对赌池状态 ===`);
    console.log(`对赌池:       ${fromUsdtUnits(bp)} USDT`);
    console.log(`潜在赔付:     ${fromUsdtUnits(tpp)} USDT`);
    console.log(`冻结赔付:     ${fromUsdtUnits(tfp)} USDT`);
    console.log(`用户余额总额: ${fromUsdtUnits(tub)} USDT`);
    console.log(`信用在途:     ${fromUsdtUnits(tco)} USDT`);
    console.log(`平台余额:     ${fromUsdtUnits(platBal)} USDT`);
    console.log(`合约USDT余额: ${fromUsdtUnits(usdtBal)} USDT`);
    console.log('');
    break;
  }
  case 'platform': {
    const pb = await publicClient.readContract({
      address: CONTRACTS.POOL,
      abi: poolAbi,
      functionName: 'platformBalance',
    }) as bigint;
    console.log(`\n平台余额: ${fromUsdtUnits(pb)} USDT\n`);
    break;
  }
  default:
    console.error(`未知操作: ${action} (支持: balance, bet, parlay, pool, platform)`);
    process.exit(1);
}
