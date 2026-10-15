/**
 * LP 质押 1,000,000 USDT 测试
 * 用法: npx tsx script/test-lp-stake.ts
 */
import {
  createPublicClient, createWalletClient, http,
  type Address, type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const RPC = 'http://127.0.0.1:8545';
const KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as Hex;
const POOL = '0x8511738F1ca638d5A3cDbC07f847bF32b358446E' as Address;
const USDT = '0x6b92471D25e0c2F3Ec851B363D09Ea45435B3448' as Address;

const account = privateKeyToAccount(KEY);
const chain = { ...bsc, id: 56 };
const pub = createPublicClient({ chain, transport: http(RPC) });
const wal = createWalletClient({ account, chain, transport: http(RPC) });

const __dirname = dirname(fileURLToPath(import.meta.url));
const poolAbi = JSON.parse(readFileSync(resolve(__dirname, '..', 'assets', 'BettingPool.abi.json'), 'utf-8'));
const usdtAbi = JSON.parse(readFileSync(resolve(__dirname, '..', 'assets', 'MockUSDT.abi.json'), 'utf-8'));

const D = 6;
const toU = (n: number) => BigInt(Math.round(n * 10 ** D));
const fromU = (n: bigint) => (Number(n) / 10 ** D).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function tx(hash: Hex) {
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status === 'reverted') throw new Error(`reverted: ${hash}`);
  return r;
}

const user = account.address;
const amt = toU(1_000_000);

async function main() {
  console.log('\n════════════════════════════════════════════');
  console.log('  LP 质押 1,000,000 USDT 测试');
  console.log('════════════════════════════════════════════\n');

  // ── 质押前状态 ──
  const [bpBefore, sharesBefore, mySharesBefore, usdtBefore, platBefore] = await Promise.all([
    pub.readContract({ address: POOL, abi: poolAbi, functionName: 'bettingPool' }),
    pub.readContract({ address: POOL, abi: poolAbi, functionName: 'totalLpShares' }),
    pub.readContract({ address: POOL, abi: poolAbi, functionName: 'lpShares', args: [user] }),
    pub.readContract({ address: USDT, abi: usdtAbi, functionName: 'balanceOf', args: [POOL] }),
    pub.readContract({ address: POOL, abi: poolAbi, functionName: 'platformBalance' }),
  ]) as bigint[];

  console.log('── 质押前 ──');
  console.log(`  对赌池:       ${fromU(bpBefore)} USDT`);
  console.log(`  总LP份额:     ${fromU(sharesBefore)}`);
  console.log(`  我的LP份额:   ${fromU(mySharesBefore)}`);
  console.log(`  合约USDT余额: ${fromU(usdtBefore)} USDT`);
  console.log(`  平台余额:     ${fromU(platBefore)} USDT\n`);

  // ── 执行质押 ──
  console.log('── 执行质押 1,000,000 USDT ──');
  await tx(await wal.writeContract({ address: USDT, abi: usdtAbi, functionName: 'mint', args: [user, amt] }));
  console.log('  [1/3] Mint 完成');
  await tx(await wal.writeContract({ address: USDT, abi: usdtAbi, functionName: 'approve', args: [POOL, amt] }));
  console.log('  [2/3] Approve 完成');
  await tx(await wal.writeContract({ address: POOL, abi: poolAbi, functionName: 'addLiquidity', args: [amt] }));
  console.log('  [3/3] addLiquidity 完成\n');

  // ── 质押后状态 ──
  const [bpAfter, sharesAfter, mySharesAfter, usdtAfter, platAfter, tub, tpp, tfp, tco] = await Promise.all([
    pub.readContract({ address: POOL, abi: poolAbi, functionName: 'bettingPool' }),
    pub.readContract({ address: POOL, abi: poolAbi, functionName: 'totalLpShares' }),
    pub.readContract({ address: POOL, abi: poolAbi, functionName: 'lpShares', args: [user] }),
    pub.readContract({ address: USDT, abi: usdtAbi, functionName: 'balanceOf', args: [POOL] }),
    pub.readContract({ address: POOL, abi: poolAbi, functionName: 'platformBalance' }),
    pub.readContract({ address: POOL, abi: poolAbi, functionName: 'totalUserBalances' }),
    pub.readContract({ address: POOL, abi: poolAbi, functionName: 'totalPotentialPayout' }),
    pub.readContract({ address: POOL, abi: poolAbi, functionName: 'totalFrozenPayouts' }),
    pub.readContract({ address: POOL, abi: poolAbi, functionName: 'totalCreditOutstanding' }),
  ]) as bigint[];

  console.log('── 质押后 ──');
  console.log(`  对赌池:       ${fromU(bpAfter)} USDT  (+${fromU(bpAfter - bpBefore)})`);
  console.log(`  总LP份额:     ${fromU(sharesAfter)}  (+${fromU(sharesAfter - sharesBefore)})`);
  console.log(`  我的LP份额:   ${fromU(mySharesAfter)}  (+${fromU(mySharesAfter - mySharesBefore)})`);
  console.log(`  合约USDT余额: ${fromU(usdtAfter)} USDT  (+${fromU(usdtAfter - usdtBefore)})`);
  console.log(`  平台余额:     ${fromU(platAfter)} USDT\n`);

  // ── LP 份额分析 ──
  const myPct = Number(mySharesAfter) * 100 / Number(sharesAfter);
  const shareValue = Number(bpAfter) / Number(sharesAfter);
  console.log('── LP 份额分析 ──');
  console.log(`  我的份额占比:  ${myPct.toFixed(4)}%`);
  console.log(`  每份额价值:    ${shareValue.toFixed(6)} USDT`);
  console.log(`  我的LP估值:    ${fromU(BigInt(Math.floor(Number(mySharesAfter) * shareValue)))} USDT\n`);

  // ── 完整池状态 ──
  console.log('── 完整池状态 ──');
  console.log(`  对赌池:       ${fromU(bpAfter)} USDT`);
  console.log(`  潜在赔付:     ${fromU(tpp)} USDT`);
  console.log(`  冻结赔付:     ${fromU(tfp)} USDT`);
  console.log(`  用户余额总额: ${fromU(tub)} USDT`);
  console.log(`  信用在途:     ${fromU(tco)} USDT`);
  console.log(`  平台余额:     ${fromU(platAfter)} USDT`);
  console.log(`  合约USDT余额: ${fromU(usdtAfter)} USDT\n`);
}

main().catch((err) => {
  console.error('失败:', err.message || err);
  process.exit(1);
});
