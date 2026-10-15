/**
 * 提现流程
 * 用法: npx tsx script/withdraw.ts <金额USDT>
 * 小额(≤5000) 直接到账，大额(>5000) 进入24h审核
 */
import { CONTRACTS, poolAbi, walletClient, toUsdtUnits, waitForTx } from './config.js';

const [amountArg] = process.argv.slice(2);
if (!amountArg) {
  console.error('用法: npx tsx script/withdraw.ts <金额USDT>');
  process.exit(1);
}

const amount = Number(amountArg);
const amountE6 = toUsdtUnits(amount);

console.log(`\n=== 提现 ${amountArg} USDT ===\n`);

const hash = await walletClient.writeContract({
  address: CONTRACTS.POOL,
  abi: poolAbi,
  functionName: 'withdraw',
  args: [amountE6],
});
await waitForTx(hash);

if (amount > 5000) {
  console.log('大额提现已创建请求，24h 后可执行 executeLargeWithdrawal');
} else {
  console.log('提现完成，USDT 已到账');
}
console.log('=== 完成 ===\n');
