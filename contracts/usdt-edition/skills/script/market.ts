/**
 * 盘口管理：开盘 / 封盘 / 查询状态
 * 用法:
 *   npx tsx script/market.ts open <matchId> <marketType> <line>
 *   npx tsx script/market.ts close <matchId> <marketType> <line>
 *   npx tsx script/market.ts status <matchId> <marketType> <line>
 * marketType: 0=X12(胜负平), 1=AH(让分), 2=OU(总分)
 * line: 0/1/2
 */
import { keccak256, encodeAbiParameters, type Hex } from 'viem';
import { CONTRACTS, poolAbi, walletClient, publicClient, waitForTx } from './config.js';

const [action, matchId, marketType, line] = process.argv.slice(2);
if (!action || !matchId || !marketType || !line) {
  console.error('用法: npx tsx script/market.ts <open|close|status> <matchId> <marketType> <line>');
  process.exit(1);
}

const MARKET_LABELS = ['X12(胜负平)', 'AH(让分)', 'OU(总分)'];
const STATUS_LABELS = ['NotCreated', 'Open', 'Closed', 'Settled', 'Cancelled'];

console.log(`\n=== 盘口 ${action} ===`);
console.log(`赛事: ${matchId}`);
console.log(`盘口: ${MARKET_LABELS[Number(marketType)] || marketType} line=${line}\n`);

switch (action) {
  case 'open': {
    const hash = await walletClient.writeContract({
      address: CONTRACTS.POOL,
      abi: poolAbi,
      functionName: 'openMarket',
      args: [matchId as Hex, Number(marketType), Number(line)],
    });
    await waitForTx(hash);
    console.log('盘口已开放');
    break;
  }
  case 'close': {
    const hash = await walletClient.writeContract({
      address: CONTRACTS.POOL,
      abi: poolAbi,
      functionName: 'closeMarket',
      args: [matchId as Hex, Number(marketType), Number(line)],
    });
    await waitForTx(hash);
    console.log('盘口已封盘');
    break;
  }
  case 'status': {
    const key = keccak256(encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'uint8' }, { type: 'uint8' }],
      [matchId as Hex, Number(marketType), Number(line)]
    ));
    const status = await publicClient.readContract({
      address: CONTRACTS.POOL,
      abi: poolAbi,
      functionName: 'marketStatus',
      args: [key],
    }) as number;
    console.log(`盘口状态: ${STATUS_LABELS[status]}`);
    break;
  }
  default:
    console.error(`未知操作: ${action} (支持: open, close, status)`);
    process.exit(1);
}
console.log('');
