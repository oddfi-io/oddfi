/**
 * 充值流程：mint USDT → transfer 到合约 → creditDeposit 入账
 * 用法: npx tsx script/deposit.ts <用户地址> <金额USDT>
 */
import { keccak256, encodePacked, type Address, type Hex } from 'viem';
import { CONTRACTS, poolAbi, usdtAbi, walletClient, publicClient, toUsdtUnits, fromUsdtUnits, waitForTx } from './config.js';

const [userArg, amountArg] = process.argv.slice(2);
if (!userArg || !amountArg) {
  console.error('用法: npx tsx script/deposit.ts <用户地址> <金额USDT>');
  process.exit(1);
}

const user = userArg as Address;
const amount = toUsdtUnits(Number(amountArg));

console.log(`\n=== 充值 ${amountArg} USDT 给 ${user} ===\n`);

// 1. Mint USDT 到合约地址
console.log('[1/3] Mint USDT to BettingPool...');
const mintHash = await walletClient.writeContract({
  address: CONTRACTS.USDT,
  abi: usdtAbi,
  functionName: 'mint',
  args: [CONTRACTS.POOL, amount],
});
await waitForTx(mintHash);

// 2. creditDeposit 入账
const txHash = keccak256(encodePacked(
  ['address', 'uint256', 'uint256'],
  [user, amount, BigInt(Date.now())]
));
console.log('[2/3] creditDeposit...');
const depositHash = await walletClient.writeContract({
  address: CONTRACTS.POOL,
  abi: poolAbi,
  functionName: 'creditDeposit',
  args: [user, amount, txHash],
});
await waitForTx(depositHash);

// 3. 查询余额
console.log('[3/3] 查询余额...');
const balance = await publicClient.readContract({
  address: CONTRACTS.POOL,
  abi: poolAbi,
  functionName: 'userBalances',
  args: [user],
}) as bigint;

console.log(`\n用户余额: ${fromUsdtUnits(balance)} USDT`);
console.log('=== 充值完成 ===\n');
