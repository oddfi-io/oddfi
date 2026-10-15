/**
 * 串关测试脚本：开3个盘口 → 下串关 → 结算2赢1输 → 验证串关全失败
 * 用法: npx tsx script/test-parlay.ts
 */
import { keccak256, encodePacked, type Hex } from 'viem';
import {
  CONTRACTS, poolAbi, usdtAbi,
  walletClient, publicClient, account,
  toUsdtUnits, fromUsdtUnits, generateId, waitForTx,
} from './config.js';

const STATUS_LABELS = ['Pending', 'Won', 'Lost', 'Cancelled'];
const MARKET_LABELS = ['X12', 'AH', 'OU'];

// ── 测试参数 ──
const user = account.address;
const depositAmount = 500;   // 充值 500 USDT
const parlayStake = 100;     // 串关投注 100 USDT
const ts = Date.now();

// 3 场比赛
const match1 = keccak256(encodePacked(['string'], [`match-parlay-A-${ts}`]));
const match2 = keccak256(encodePacked(['string'], [`match-parlay-B-${ts}`]));
const match3 = keccak256(encodePacked(['string'], [`match-parlay-C-${ts}`]));

// 串关 & 各腿 ID
const parlayId = keccak256(encodePacked(['string'], [`parlay-test-${ts}`]));
const leg1Id = keccak256(encodePacked(['string'], [`parlay-leg1-${ts}`]));
const leg2Id = keccak256(encodePacked(['string'], [`parlay-leg2-${ts}`]));
const leg3Id = keccak256(encodePacked(['string'], [`parlay-leg3-${ts}`]));

// 各腿赔率 (×1000): 1.8, 2.1, 1.5 → 组合赔率 ≈ 5.67
const odds1 = 1800n;
const odds2 = 2100n;
const odds3 = 1500n;

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║      串关测试：3盘口 + 1输全挂          ║');
  console.log('╚══════════════════════════════════════════╝\n');

  console.log(`用户地址: ${user}`);
  console.log(`赛事1: ${match1}`);
  console.log(`赛事2: ${match2}`);
  console.log(`赛事3: ${match3}`);
  console.log(`串关ID: ${parlayId}\n`);

  // ═══════════════════════════════════════
  // Step 1: 充值
  // ═══════════════════════════════════════
  console.log('── Step 1: 充值 ──');
  const amount = toUsdtUnits(depositAmount);

  // Mint USDT to pool
  const mintHash = await walletClient.writeContract({
    address: CONTRACTS.USDT,
    abi: usdtAbi,
    functionName: 'mint',
    args: [CONTRACTS.POOL, amount],
  });
  await waitForTx(mintHash);

  // creditDeposit
  const txHash = keccak256(encodePacked(
    ['address', 'uint256', 'uint256'],
    [user, amount, BigInt(ts)]
  ));
  const depHash = await walletClient.writeContract({
    address: CONTRACTS.POOL,
    abi: poolAbi,
    functionName: 'creditDeposit',
    args: [user, amount, txHash],
  });
  await waitForTx(depHash);

  const balBefore = await publicClient.readContract({
    address: CONTRACTS.POOL, abi: poolAbi,
    functionName: 'userBalances', args: [user],
  }) as bigint;
  console.log(`充值完成，余额: ${fromUsdtUnits(balBefore)} USDT\n`);

  // ═══════════════════════════════════════
  // Step 2: 开 3 个盘口 (全部用 X12, line=0)
  // ═══════════════════════════════════════
  console.log('── Step 2: 开 3 个盘口 ──');
  for (const [label, matchId] of [['赛事1', match1], ['赛事2', match2], ['赛事3', match3]]) {
    const h = await walletClient.writeContract({
      address: CONTRACTS.POOL,
      abi: poolAbi,
      functionName: 'openMarket',
      args: [matchId as Hex, 0, 0], // X12, line=0
    });
    await waitForTx(h);
    console.log(`  ${label} X12 盘口已开放`);
  }
  console.log('');

  // ═══════════════════════════════════════
  // Step 3: 下串关 (3腿，全押主胜 outcome=0)
  // ═══════════════════════════════════════
  console.log('── Step 3: 下串关 ──');
  console.log(`  投注额: ${parlayStake} USDT`);
  console.log(`  Leg1: 赛事1 X12 主胜 赔率 ${Number(odds1)/1000}`);
  console.log(`  Leg2: 赛事2 X12 主胜 赔率 ${Number(odds2)/1000}`);
  console.log(`  Leg3: 赛事3 X12 主胜 赔率 ${Number(odds3)/1000}`);

  const parlayHash = await walletClient.writeContract({
    address: CONTRACTS.POOL,
    abi: poolAbi,
    functionName: 'lockParlay',
    args: [
      parlayId,
      user,
      toUsdtUnits(parlayStake),
      [match1, match2, match3],         // matchIds
      [0, 0, 0],                         // markets (all X12)
      [0, 0, 0],                         // outcomes (all 主胜)
      [0, 0, 0],                         // lines (all 0)
      [odds1, odds2, odds3],             // legOdds
      [leg1Id, leg2Id, leg3Id],          // legBetIds
    ],
  });
  await waitForTx(parlayHash);
  console.log('  串关下注成功!\n');

  // 查询串关状态
  await queryParlay('下注后');

  // ═══════════════════════════════════════
  // Step 4: 封盘 3 个盘口
  // ═══════════════════════════════════════
  console.log('── Step 4: 封盘 ──');
  for (const [label, matchId] of [['赛事1', match1], ['赛事2', match2], ['赛事3', match3]]) {
    const h = await walletClient.writeContract({
      address: CONTRACTS.POOL,
      abi: poolAbi,
      functionName: 'closeMarket',
      args: [matchId as Hex, 0, 0],
    });
    await waitForTx(h);
    console.log(`  ${label} 已封盘`);
  }
  console.log('');

  // ═══════════════════════════════════════
  // Step 5: 结算赛事1 → 主胜(outcome=0) → Leg1 赢
  // ═══════════════════════════════════════
  console.log('── Step 5: 结算赛事1 → 主胜 (Leg1 赢) ──');
  const s1 = await walletClient.writeContract({
    address: CONTRACTS.POOL,
    abi: poolAbi,
    functionName: 'settle',
    args: [match1, 0, 0, 0, [leg1Id]], // winningOutcome=0 (主胜), leg1 押主胜 → 赢
  });
  await waitForTx(s1);
  console.log('  赛事1 结算完成: Leg1 赢\n');
  await queryParlay('赛事1结算后');

  // ═══════════════════════════════════════
  // Step 6: 结算赛事2 → 主胜(outcome=0) → Leg2 赢
  // ═══════════════════════════════════════
  console.log('── Step 6: 结算赛事2 → 主胜 (Leg2 赢) ──');
  const s2 = await walletClient.writeContract({
    address: CONTRACTS.POOL,
    abi: poolAbi,
    functionName: 'settle',
    args: [match2, 0, 0, 0, [leg2Id]], // winningOutcome=0, leg2 押主胜 → 赢
  });
  await waitForTx(s2);
  console.log('  赛事2 结算完成: Leg2 赢\n');
  await queryParlay('赛事2结算后');

  // ═══════════════════════════════════════
  // Step 7: 结算赛事3 → 客胜(outcome=2) → Leg3 输！
  // ═══════════════════════════════════════
  console.log('── Step 7: 结算赛事3 → 客胜 (Leg3 输!) ──');
  const s3 = await walletClient.writeContract({
    address: CONTRACTS.POOL,
    abi: poolAbi,
    functionName: 'settle',
    args: [match3, 0, 0, 2, [leg3Id]], // winningOutcome=2 (客胜), leg3 押主胜 → 输
  });
  await waitForTx(s3);
  console.log('  赛事3 结算完成: Leg3 输!\n');
  await queryParlay('赛事3结算后 (最终)');

  // ═══════════════════════════════════════
  // Step 8: 查询各腿注单最终状态
  // ═══════════════════════════════════════
  console.log('── Step 8: 各腿注单最终状态 ──');
  for (const [label, betId] of [['Leg1', leg1Id], ['Leg2', leg2Id], ['Leg3', leg3Id]]) {
    const bet = await publicClient.readContract({
      address: CONTRACTS.POOL, abi: poolAbi,
      functionName: 'bets', args: [betId as Hex],
    }) as any[];
    console.log(`  ${label} (${betId.slice(0, 10)}...): ${STATUS_LABELS[Number(bet[7])]}`);
  }
  console.log('');

  // ═══════════════════════════════════════
  // Step 9: 余额变化
  // ═══════════════════════════════════════
  const balAfter = await publicClient.readContract({
    address: CONTRACTS.POOL, abi: poolAbi,
    functionName: 'userBalances', args: [user],
  }) as bigint;
  console.log('── Step 9: 余额变化 ──');
  console.log(`  结算前余额: ${fromUsdtUnits(balBefore)} USDT`);
  console.log(`  结算后余额: ${fromUsdtUnits(balAfter)} USDT`);
  console.log(`  变化:       ${fromUsdtUnits(balAfter - balBefore)} USDT\n`);

  // ═══════════════════════════════════════
  // 最终验证
  // ═══════════════════════════════════════
  const finalParlay = await publicClient.readContract({
    address: CONTRACTS.POOL, abi: poolAbi,
    functionName: 'parlays', args: [parlayId],
  }) as any[];
  const parlayStatus = STATUS_LABELS[Number(finalParlay[4])];

  console.log('╔══════════════════════════════════════════╗');
  if (parlayStatus === 'Lost') {
    console.log('║  PASS: 串关状态 = Lost (1输全挂)       ║');
  } else {
    console.log(`║  FAIL: 串关状态 = ${parlayStatus} (期望 Lost)    ║`);
  }
  console.log('╚══════════════════════════════════════════╝\n');
}

async function queryParlay(label: string) {
  const parlay = await publicClient.readContract({
    address: CONTRACTS.POOL, abi: poolAbi,
    functionName: 'parlays', args: [parlayId],
  }) as any[];

  console.log(`  [${label}]`);
  console.log(`    状态:       ${STATUS_LABELS[Number(parlay[4])]}`);
  console.log(`    投注额:     ${fromUsdtUnits(parlay[1] as bigint)} USDT`);
  console.log(`    组合赔率:   ${(Number(parlay[2]) / 1000).toFixed(3)}`);
  console.log(`    最大赔付:   ${fromUsdtUnits(parlay[3] as bigint)} USDT`);
  console.log(`    已结算腿:   ${parlay[5]}`);
  console.log(`    赢的腿:     ${parlay[6]}`);
  console.log(`    取消的腿:   ${parlay[7]}\n`);
}

main().catch((err) => {
  console.error('测试失败:', err);
  process.exit(1);
});
