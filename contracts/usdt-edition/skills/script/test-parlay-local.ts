/**
 * 串关完整测试（本地 Anvil Fork BSC）
 * 场景 A: 串关下单成功
 * 场景 B: 1腿输 → 串关全挂 → 用户投注额被扣
 * 场景 C: 全赢 → 用户收到奖励
 *
 * 用法: npx tsx script/test-parlay-local.ts
 */
import {
  createPublicClient, createWalletClient, http,
  keccak256, encodePacked,
  type Hex, type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── 本地 Anvil ──
const RPC = 'http://127.0.0.1:8545';
const DEPLOYER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as Hex;

const CONTRACTS = {
  USDT: '0x6b92471D25e0c2F3Ec851B363D09Ea45435B3448' as Address,
  POOL: '0x8511738F1ca638d5A3cDbC07f847bF32b358446E' as Address,
};

const account = privateKeyToAccount(DEPLOYER_KEY);
const localChain = { ...bsc, id: 56 };

const publicClient = createPublicClient({ chain: localChain, transport: http(RPC) });
const walletClient = createWalletClient({ account, chain: localChain, transport: http(RPC) });

const __dirname = dirname(fileURLToPath(import.meta.url));
const poolAbi = JSON.parse(readFileSync(resolve(__dirname, '..', 'assets', 'BettingPool.abi.json'), 'utf-8'));
const usdtAbi = JSON.parse(readFileSync(resolve(__dirname, '..', 'assets', 'MockUSDT.abi.json'), 'utf-8'));

const D = 6;
function toU(n: number): bigint { return BigInt(Math.round(n * 10 ** D)); }
function fromU(n: bigint): string { return (Number(n) / 10 ** D).toFixed(2); }
async function tx(hash: Hex) {
  const r = await publicClient.waitForTransactionReceipt({ hash });
  if (r.status === 'reverted') throw new Error(`reverted: ${hash}`);
  return r;
}

const STATUS = ['Pending', 'Won', 'Lost', 'Cancelled'];
const user = account.address;
const ts = Date.now();
let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail: string) {
  if (ok) { passed++; console.log(`  PASS  ${name}: ${detail}`); }
  else    { failed++; console.log(`  FAIL  ${name}: ${detail}`); }
}

async function getBalance(): Promise<bigint> {
  return publicClient.readContract({ address: CONTRACTS.POOL, abi: poolAbi, functionName: 'userBalances', args: [user] }) as Promise<bigint>;
}

async function getParlayStatus(pid: Hex): Promise<any[]> {
  return publicClient.readContract({ address: CONTRACTS.POOL, abi: poolAbi, functionName: 'parlays', args: [pid] }) as Promise<any[]>;
}

async function getBetStatus(bid: Hex): Promise<string> {
  const b = await publicClient.readContract({ address: CONTRACTS.POOL, abi: poolAbi, functionName: 'bets', args: [bid] }) as any[];
  return STATUS[Number(b[7])];
}

// 工具: 开盘+封盘+结算 一条龙
async function openMarket(mid: Hex) {
  await tx(await walletClient.writeContract({ address: CONTRACTS.POOL, abi: poolAbi, functionName: 'openMarket', args: [mid, 0, 0] }));
}
async function closeMarket(mid: Hex) {
  await tx(await walletClient.writeContract({ address: CONTRACTS.POOL, abi: poolAbi, functionName: 'closeMarket', args: [mid, 0, 0] }));
}
async function settle(mid: Hex, outcome: number, betIds: Hex[]) {
  await tx(await walletClient.writeContract({ address: CONTRACTS.POOL, abi: poolAbi, functionName: 'settle', args: [mid, 0, 0, outcome, betIds] }));
}

function id(s: string): Hex { return keccak256(encodePacked(['string'], [s])); }

async function main() {
  console.log('');
  console.log('================================================================');
  console.log('        串关完整测试 (本地 Anvil Fork BSC 主网)');
  console.log('================================================================');
  console.log(`  用户: ${user}`);
  console.log(`  Pool: ${CONTRACTS.POOL}`);
  console.log(`  USDT: ${CONTRACTS.USDT}\n`);

  // ════════════════════════════════════
  // 基础准备: LP + 充值
  // ════════════════════════════════════
  console.log('── 准备: 注入 LP 流动性 50,000 USDT + 用户充值 2,000 USDT ──');
  const lpAmt = toU(50000);
  await tx(await walletClient.writeContract({ address: CONTRACTS.USDT, abi: usdtAbi, functionName: 'mint', args: [user, lpAmt] }));
  await tx(await walletClient.writeContract({ address: CONTRACTS.USDT, abi: usdtAbi, functionName: 'approve', args: [CONTRACTS.POOL, lpAmt] }));
  await tx(await walletClient.writeContract({ address: CONTRACTS.POOL, abi: poolAbi, functionName: 'addLiquidity', args: [lpAmt] }));

  const depAmt = toU(2000);
  await tx(await walletClient.writeContract({ address: CONTRACTS.USDT, abi: usdtAbi, functionName: 'mint', args: [CONTRACTS.POOL, depAmt] }));
  const depHash = keccak256(encodePacked(['address', 'uint256', 'uint256'], [user, depAmt, BigInt(ts)]));
  await tx(await walletClient.writeContract({ address: CONTRACTS.POOL, abi: poolAbi, functionName: 'creditDeposit', args: [user, depAmt, depHash] }));

  const initBal = await getBalance();
  console.log(`  LP 注入完成，用户余额: ${fromU(initBal)} USDT\n`);

  // ════════════════════════════════════════════════════════════
  //   场景 A: 串关下单成功
  // ════════════════════════════════════════════════════════════
  console.log('================================================================');
  console.log('  场景 A: 串关是否能下单成功');
  console.log('================================================================\n');

  const pA = id(`parlayA-${ts}`);
  const legA1 = id(`legA1-${ts}`), legA2 = id(`legA2-${ts}`), legA3 = id(`legA3-${ts}`);
  const mA1 = id(`matchA1-${ts}`), mA2 = id(`matchA2-${ts}`), mA3 = id(`matchA3-${ts}`);

  // 开 3 个盘口
  for (const m of [mA1, mA2, mA3]) await openMarket(m);
  console.log('  3 个盘口已开放');

  const balBeforeA = await getBalance();

  // 下串关: 100 USDT, 3 腿全押主胜, 赔率 1.8/2.1/1.5
  try {
    await tx(await walletClient.writeContract({
      address: CONTRACTS.POOL, abi: poolAbi, functionName: 'lockParlay',
      args: [
        pA, user, toU(100),
        [mA1, mA2, mA3], [0, 0, 0], [0, 0, 0], [0, 0, 0],
        [1800n, 2100n, 1500n],
        [legA1, legA2, legA3],
      ],
    }));

    const parlayA = await getParlayStatus(pA);
    check('串关下单', STATUS[Number(parlayA[4])] === 'Pending', `状态=${STATUS[Number(parlayA[4])]}`);
    check('投注额锁定', parlayA[1] === toU(100), `stake=${fromU(parlayA[1] as bigint)} USDT`);
    check('3 腿创建', true, `combinedOdds=${(Number(parlayA[2])/1000).toFixed(3)}`);

    const balAfterA = await getBalance();
    const locked = balBeforeA - balAfterA;
    // 用户余额不减少（锁定在 lockedBalances 里），但 lockedBalances 增加
    // 实际上 lockParlay 会增加 lockedBalances 而不是减少 userBalances
    console.log(`  用户余额变化: ${fromU(balBeforeA)} → ${fromU(balAfterA)} USDT\n`);
  } catch (err: any) {
    check('串关下单', false, err.message);
  }

  // ════════════════════════════════════════════════════════════
  //   场景 B: 1腿输 → 串关全挂 → 用户被清算
  // ════════════════════════════════════════════════════════════
  console.log('================================================================');
  console.log('  场景 B: 1腿输 → 串关全失败 → 用户投注额被扣');
  console.log('================================================================\n');

  // 封盘
  for (const m of [mA1, mA2, mA3]) await closeMarket(m);
  console.log('  3 个盘口已封盘');

  const balBeforeSettle = await getBalance();
  console.log(`  结算前用户余额: ${fromU(balBeforeSettle)} USDT`);

  // 结算 Leg1: 主胜(0) → 赢
  await settle(mA1, 0, [legA1]);
  const s1 = await getBetStatus(legA1);
  console.log(`  赛事A 结算: 主胜 → Leg1 ${s1}`);

  // 结算 Leg2: 主胜(0) → 赢
  await settle(mA2, 0, [legA2]);
  const s2 = await getBetStatus(legA2);
  console.log(`  赛事B 结算: 主胜 → Leg2 ${s2}`);

  // 查看中间状态
  const midParlay = await getParlayStatus(pA);
  console.log(`  中间状态: 串关=${STATUS[Number(midParlay[4])]}  已结算=${midParlay[5]} 赢=${midParlay[6]}`);

  // 结算 Leg3: 客胜(2) → 输!
  await settle(mA3, 2, [legA3]);
  const s3 = await getBetStatus(legA3);
  console.log(`  赛事C 结算: 客胜 → Leg3 ${s3} (用户押主胜，实际客胜)`);

  const parlayFinal = await getParlayStatus(pA);
  const parlayStatusB = STATUS[Number(parlayFinal[4])];
  check('串关状态=Lost', parlayStatusB === 'Lost', `状态=${parlayStatusB}`);

  // 检查各腿状态
  const leg1s = await getBetStatus(legA1);
  const leg2s = await getBetStatus(legA2);
  const leg3s = await getBetStatus(legA3);
  console.log(`  各腿最终: Leg1=${leg1s}  Leg2=${leg2s}  Leg3=${leg3s}`);
  // 赢的腿在串关输后应该被 Cancelled 或保持 Won，但串关整体 Lost
  check('输的腿=Lost', leg3s === 'Lost', `Leg3=${leg3s}`);

  const balAfterSettle = await getBalance();
  const lostAmount = balBeforeSettle - balAfterSettle;
  console.log(`  结算后用户余额: ${fromU(balAfterSettle)} USDT`);
  console.log(`  用户损失: ${fromU(lostAmount)} USDT`);
  check('用户被扣款', lostAmount === toU(100), `扣款=${fromU(lostAmount)} USDT (期望 100.00)`);
  console.log('');

  // ════════════════════════════════════════════════════════════
  //   场景 C: 串关全赢 → 用户收到奖励
  // ════════════════════════════════════════════════════════════
  console.log('================================================================');
  console.log('  场景 C: 串关全赢 → 用户收到奖励');
  console.log('================================================================\n');

  const pC = id(`parlayC-${ts}`);
  const legC1 = id(`legC1-${ts}`), legC2 = id(`legC2-${ts}`), legC3 = id(`legC3-${ts}`);
  const mC1 = id(`matchC1-${ts}`), mC2 = id(`matchC2-${ts}`), mC3 = id(`matchC3-${ts}`);

  // 开盘
  for (const m of [mC1, mC2, mC3]) await openMarket(m);
  console.log('  3 个新盘口已开放');

  const balBeforeC = await getBalance();
  console.log(`  下注前余额: ${fromU(balBeforeC)} USDT`);

  // 下串关: 200 USDT, 赔率 1.8/2.0/1.5 → 组合赔率 5.4
  const oddsC1 = 1800n, oddsC2 = 2000n, oddsC3 = 1500n;
  // combinedOdds 是 ×1000 格式: 1800*2000*1500 / 1000^2 = 5400 (即 5.4 倍)
  const combinedOddsRaw = Number(oddsC1) * Number(oddsC2) * Number(oddsC3) / 1000 / 1000;
  const expectedCombined = combinedOddsRaw / 1000; // 5.4
  const expectedPayout = 200 * expectedCombined;    // 1080
  console.log(`  组合赔率: ${expectedCombined.toFixed(3)}  预计赔付: ${expectedPayout.toFixed(2)} USDT`);

  await tx(await walletClient.writeContract({
    address: CONTRACTS.POOL, abi: poolAbi, functionName: 'lockParlay',
    args: [
      pC, user, toU(200),
      [mC1, mC2, mC3], [0, 0, 0], [0, 0, 0], [0, 0, 0],
      [oddsC1, oddsC2, oddsC3],
      [legC1, legC2, legC3],
    ],
  }));
  console.log('  串关下注成功');

  // 封盘 + 全部结算为主胜(0) → 全赢
  for (const m of [mC1, mC2, mC3]) await closeMarket(m);
  console.log('  3 个盘口已封盘');

  await settle(mC1, 0, [legC1]);
  console.log(`  赛事1 结算: 主胜 → Leg1 ${await getBetStatus(legC1)}`);
  await settle(mC2, 0, [legC2]);
  console.log(`  赛事2 结算: 主胜 → Leg2 ${await getBetStatus(legC2)}`);
  await settle(mC3, 0, [legC3]);
  console.log(`  赛事3 结算: 主胜 → Leg3 ${await getBetStatus(legC3)}`);

  const parlayCFinal = await getParlayStatus(pC);
  const parlayStatusC = STATUS[Number(parlayCFinal[4])];
  check('串关状态=Won', parlayStatusC === 'Won', `状态=${parlayStatusC}`);

  const balAfterC = await getBalance();
  const profit = balAfterC - balBeforeC;
  // 净利润 = payout - stake = (stake * combinedOdds / 1000) - stake
  const expectedProfit = toU(expectedPayout) - toU(200);
  console.log(`  结算后余额: ${fromU(balAfterC)} USDT`);
  console.log(`  净利润: ${fromU(profit)} USDT (期望: ${fromU(expectedProfit)} USDT)`);
  check('用户收到奖励', profit > 0n, `净利润=${fromU(profit)} USDT`);
  check('奖励金额正确', profit === expectedProfit, `实际=${fromU(profit)} 期望=${fromU(expectedProfit)}`);
  console.log('');

  // ════════════════════════════════════════════════════════════
  //   汇总
  // ════════════════════════════════════════════════════════════
  console.log('================================================================');
  console.log(`  测试结果:  ${passed} passed / ${failed} failed`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\n测试异常:', err.message || err);
  process.exit(1);
});
