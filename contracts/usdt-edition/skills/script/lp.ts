/**
 * LP 流动性管理
 * 用法:
 *   npx tsx script/lp.ts add <金额USDT>       添加流动性（需先mint USDT给自己并approve）
 *   npx tsx script/lp.ts remove <shares>      移除流动性
 *   npx tsx script/lp.ts info [地址]           查询仓位
 */
import { type Address } from 'viem';
import { CONTRACTS, poolAbi, usdtAbi, walletClient, publicClient, account, toUsdtUnits, fromUsdtUnits, waitForTx } from './config.js';

const [action, arg] = process.argv.slice(2);
if (!action) {
  console.error('用法: npx tsx script/lp.ts <add|remove|info> [参数]');
  process.exit(1);
}

switch (action) {
  case 'add': {
    if (!arg) { console.error('用法: npx tsx script/lp.ts add <金额USDT>'); process.exit(1); }
    const amount = toUsdtUnits(Number(arg));

    console.log(`\n=== 添加 ${arg} USDT 流动性 ===\n`);

    // Mint USDT 给自己
    console.log('[1/3] Mint USDT...');
    const mintHash = await walletClient.writeContract({
      address: CONTRACTS.USDT,
      abi: usdtAbi,
      functionName: 'mint',
      args: [account.address, amount],
    });
    await waitForTx(mintHash);

    // Approve
    console.log('[2/3] Approve USDT...');
    const approveHash = await walletClient.writeContract({
      address: CONTRACTS.USDT,
      abi: usdtAbi,
      functionName: 'approve',
      args: [CONTRACTS.POOL, amount],
    });
    await waitForTx(approveHash);

    // Add liquidity
    console.log('[3/3] addLiquidity...');
    const addHash = await walletClient.writeContract({
      address: CONTRACTS.POOL,
      abi: poolAbi,
      functionName: 'addLiquidity',
      args: [amount],
    });
    await waitForTx(addHash);

    console.log('=== 流动性添加完成 ===\n');
    break;
  }
  case 'remove': {
    if (!arg) { console.error('用法: npx tsx script/lp.ts remove <shares>'); process.exit(1); }
    const shares = BigInt(arg);

    console.log(`\n=== 移除 ${arg} 份额 ===\n`);
    const hash = await walletClient.writeContract({
      address: CONTRACTS.POOL,
      abi: poolAbi,
      functionName: 'removeLiquidity',
      args: [shares],
    });
    await waitForTx(hash);

    console.log('=== 流动性移除完成 ===\n');
    break;
  }
  case 'info': {
    const addr = (arg || account.address) as Address;

    console.log(`\n=== LP 信息 ===\n`);

    const [bettingPool, totalShares, userShares] = await Promise.all([
      publicClient.readContract({ address: CONTRACTS.POOL, abi: poolAbi, functionName: 'bettingPool' }),
      publicClient.readContract({ address: CONTRACTS.POOL, abi: poolAbi, functionName: 'totalLpShares' }),
      publicClient.readContract({ address: CONTRACTS.POOL, abi: poolAbi, functionName: 'lpShares', args: [addr] }),
    ]) as [bigint, bigint, bigint];

    console.log(`对赌池总额:   ${fromUsdtUnits(bettingPool)} USDT`);
    console.log(`总份额:       ${totalShares}`);
    console.log(`${addr} 持有: ${userShares}`);

    if (totalShares > 0n) {
      const value = (userShares * bettingPool) / totalShares;
      console.log(`估值:         ${fromUsdtUnits(value)} USDT`);
    }
    console.log('');
    break;
  }
  default:
    console.error(`未知操作: ${action} (支持: add, remove, info)`);
    process.exit(1);
}
