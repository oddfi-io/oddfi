/**
 * ODDToken 工具。
 *
 * 用法:
 *   npx tsx script/token.ts balance <address>
 *   npx tsx script/token.ts allowance <owner> <spender>
 *   npx tsx script/token.ts approve <spender> <amountODD>
 *   npx tsx script/token.ts transfer <to> <amountODD>
 */
import { type Address } from 'viem';
import {
  CONTRACTS,
  fromOddUnits,
  oddAbi,
  publicClient,
  requireWalletClient,
  toOddUnits,
  waitForTx,
} from './config.js';

const [action, a, b] = process.argv.slice(2);

if (!action) {
  console.error('用法: npx tsx script/token.ts <balance|allowance|approve|transfer> ...');
  process.exit(1);
}

switch (action) {
  case 'balance': {
    if (!a) throw new Error('用法: token balance <address>');
    const balance = await publicClient.readContract({
      address: CONTRACTS.ODD_TOKEN,
      abi: oddAbi,
      functionName: 'balanceOf',
      args: [a as Address],
    }) as bigint;
    console.log(`${a}: ${fromOddUnits(balance)} ODD`);
    break;
  }

  case 'allowance': {
    if (!a || !b) throw new Error('用法: token allowance <owner> <spender>');
    const allowance = await publicClient.readContract({
      address: CONTRACTS.ODD_TOKEN,
      abi: oddAbi,
      functionName: 'allowance',
      args: [a as Address, b as Address],
    }) as bigint;
    console.log(`allowance: ${fromOddUnits(allowance)} ODD`);
    break;
  }

  case 'approve': {
    if (!a || !b) throw new Error('用法: token approve <spender> <amountODD>');
    const walletClient = requireWalletClient();
    const hash = await walletClient.writeContract({
      address: CONTRACTS.ODD_TOKEN,
      abi: oddAbi,
      functionName: 'approve',
      args: [a as Address, toOddUnits(b)],
    });
    await waitForTx(hash);
    break;
  }

  case 'transfer': {
    if (!a || !b) throw new Error('用法: token transfer <to> <amountODD>');
    const walletClient = requireWalletClient();
    const hash = await walletClient.writeContract({
      address: CONTRACTS.ODD_TOKEN,
      abi: oddAbi,
      functionName: 'transfer',
      args: [a as Address, toOddUnits(b)],
    });
    await waitForTx(hash);
    break;
  }

  default:
    throw new Error(`未知操作: ${action}`);
}
