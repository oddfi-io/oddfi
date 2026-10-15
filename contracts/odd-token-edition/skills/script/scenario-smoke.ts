import { decodeEventLog, encodeFunctionData, formatEther, formatUnits, type Address, type Hex } from 'viem';
import {
  CONTRACTS,
  bettingAbi,
  idFromText,
  liquidityAbi,
  marketId,
  oddAbi,
  publicClient,
  requireWalletClient,
  stakingAbi,
  toOddUnits,
  waitForTx,
} from './config.js';

const BET_AMOUNT = toOddUnits('100');
const STAKE_AMOUNT = toOddUnits('100');
const LP_AMOUNT = toOddUnits('1000');
const APPROVE_BUFFER = toOddUnits('250');
const TRANSFER_AMOUNT = toOddUnits('1');
const ODD_DECIMALS = 18;
const TEST_RECIPIENT = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address;
const MARKET_START_DELAY_SECONDS = Number(process.env.MARKET_START_DELAY_SECONDS || '900');
const MARKET_DURATION_SECONDS = Number(process.env.MARKET_DURATION_SECONDS || '60');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function printStep(message: string) {
  console.log(`\n== ${message}`);
}

function odd(value: bigint) {
  return `${formatUnits(value, ODD_DECIMALS)} ODD`;
}

async function readOddBalance(address: Address) {
  return (await publicClient.readContract({
    address: CONTRACTS.ODD_TOKEN,
    abi: oddAbi,
    functionName: 'balanceOf',
    args: [address],
  })) as bigint;
}

async function approveOdd(spender: Address, amount: bigint) {
  const walletClient = requireWalletClient();
  const hash = await walletClient.writeContract({
    address: CONTRACTS.ODD_TOKEN,
    abi: oddAbi,
    functionName: 'approve',
    args: [spender, amount],
  });
  await waitForTx(hash);
  return hash;
}

async function readOptional(functionName: string) {
  try {
    return await publicClient.readContract({
      address: CONTRACTS.BETTING_POOL,
      abi: bettingAbi,
      functionName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
    return `UNREADABLE: ${message}`;
  }
}

async function readStakingOptional(functionName: string, args: unknown[] = []) {
  try {
    return await publicClient.readContract({
      address: CONTRACTS.STAKING_POOL,
      abi: stakingAbi,
      functionName,
      args,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
    return `UNREADABLE: ${message}`;
  }
}

async function waitForTimestamp(target: number) {
  while (true) {
    const block = await publicClient.getBlock();
    const now = Number(block.timestamp);
    if (now >= target) {
      return now;
    }
    const secondsLeft = target - now;
    console.log(`等待链上时间到期：还剩约 ${secondsLeft}s`);
    await sleep(Math.min(30_000, Math.max(5_000, secondsLeft * 1000)));
  }
}

function extractBetId(receipt: Awaited<ReturnType<typeof publicClient.waitForTransactionReceipt>>) {
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: bettingAbi,
        data: log.data,
        topics: log.topics,
      }) as { eventName: string; args: unknown };
      if (decoded.eventName === 'BetPlaced') {
        const args = decoded.args as unknown as { betId: Hex };
        return args.betId;
      }
    } catch {
      // Skip logs emitted by token/liquidity/staking contracts.
    }
  }
  throw new Error('BetPlaced event not found in receipt');
}

function chunksFromRaw(raw: Hex) {
  const body = raw.slice(2);
  return body.match(/.{64}/g) ?? [];
}

function wordToAddress(word: string) {
  return `0x${word.slice(24)}` as Address;
}

function wordToBigInt(word: string) {
  return BigInt(`0x${word}`);
}

async function readBetSnapshot(betId: Hex) {
  const data = encodeFunctionData({
    abi: bettingAbi,
    functionName: 'getBet',
    args: [betId],
  });
  const result = await publicClient.call({ to: CONTRACTS.BETTING_POOL, data });
  const chunks = chunksFromRaw(result.data ?? '0x');

  if (chunks.length !== 14) {
    throw new Error(`getBet 返回 ${chunks.length} 个 ABI word，预期当前 BettingPool ABI 为 14 个 word`);
  }

  return {
    layout: 'current-abi-14-word',
    owner: wordToAddress(chunks[0]),
    marketId: `0x${chunks[1]}` as Hex,
    outcome: Number(wordToBigInt(chunks[2])),
    acceptedAmount: wordToBigInt(chunks[3]).toString(),
    refundedAmount: wordToBigInt(chunks[4]).toString(),
    lockedOdds: wordToBigInt(chunks[5]).toString(),
    acceptedDayBucket: Number(wordToBigInt(chunks[6])),
    settlementState: Number(wordToBigInt(chunks[7])),
    claimablePayout: wordToBigInt(chunks[8]).toString(),
    payoutTaxRateBps: Number(wordToBigInt(chunks[9])),
    taxAllocStakingBps: Number(wordToBigInt(chunks[10])),
    taxAllocTaxBufferBps: Number(wordToBigInt(chunks[11])),
    taxAllocReferrerBps: Number(wordToBigInt(chunks[12])),
    referrerSnapshot: wordToAddress(chunks[13]),
  };
}

async function main() {
  const walletClient = requireWalletClient();
  const account = walletClient.account.address;

  printStep('环境与核心地址');
  const [
    chainId,
    bnbBalance,
    symbol,
    tokenOdd,
    stakingOdd,
    liquidityOdd,
    settlementModule,
    betModule,
    marketModule,
    referralModule,
  ] =
    await Promise.all([
    publicClient.getChainId(),
    publicClient.getBalance({ address: account }),
    publicClient.readContract({ address: CONTRACTS.ODD_TOKEN, abi: oddAbi, functionName: 'symbol' }),
    publicClient.readContract({ address: CONTRACTS.BETTING_POOL, abi: bettingAbi, functionName: 'oddToken' }),
    publicClient.readContract({ address: CONTRACTS.STAKING_POOL, abi: stakingAbi, functionName: 'oddToken' }),
    publicClient.readContract({ address: CONTRACTS.LIQUIDITY_POOL, abi: liquidityAbi, functionName: 'oddToken' }),
    readOptional('settlementModule'),
    readOptional('betModule'),
    readOptional('marketModule'),
    readOptional('referralModule'),
  ]);

  console.log(`chainId=${chainId}`);
  console.log(`account=${account}`);
  console.log(`BNB=${formatEther(bnbBalance)}`);
  console.log(`ODD symbol=${symbol}`);
  console.log(`BettingPool.oddToken=${tokenOdd}`);
  console.log(`StakingPool.oddToken=${stakingOdd}`);
  console.log(`LiquidityPool.oddToken=${liquidityOdd}`);
  console.log(`BettingPool.settlementModule=${settlementModule}`);
  console.log(`BettingPool.betModule=${betModule}`);
  console.log(`BettingPool.marketModule=${marketModule}`);
  console.log(`BettingPool.referralModule=${referralModule}`);

  if (
    String(tokenOdd).toLowerCase() !== CONTRACTS.ODD_TOKEN.toLowerCase() ||
    String(stakingOdd).toLowerCase() !== CONTRACTS.ODD_TOKEN.toLowerCase() ||
    String(liquidityOdd).toLowerCase() !== CONTRACTS.ODD_TOKEN.toLowerCase()
  ) {
    throw new Error('核心模块绑定的 ODDToken 地址与 skill 配置不一致');
  }

  const beforeOdd = await readOddBalance(account);
  const requiredOdd = BET_AMOUNT + STAKE_AMOUNT + LP_AMOUNT + APPROVE_BUFFER + TRANSFER_AMOUNT;
  console.log(`ODD balance=${odd(beforeOdd)}`);
  if (beforeOdd < requiredOdd) {
    throw new Error(`ODD 不足：需要至少 ${odd(requiredOdd)}，当前 ${odd(beforeOdd)}`);
  }

  printStep('DEP token 场景：普通转账无税');
  const recipientBefore = await readOddBalance(TEST_RECIPIENT);
  const transferHash = await walletClient.writeContract({
    address: CONTRACTS.ODD_TOKEN,
    abi: oddAbi,
    functionName: 'transfer',
    args: [TEST_RECIPIENT, TRANSFER_AMOUNT],
  });
  await waitForTx(transferHash);
  const recipientAfter = await readOddBalance(TEST_RECIPIENT);
  if (recipientAfter - recipientBefore !== TRANSFER_AMOUNT) {
    throw new Error('ODD 转账到账金额不等于转账金额，疑似存在转账税或异常扣减');
  }
  console.log(`transfer=${transferHash}`);

  printStep('STAKE 场景：授权并质押 100 ODD');
  const stakeApprove = await approveOdd(CONTRACTS.STAKING_POOL, STAKE_AMOUNT);
  const stakeHash = await walletClient.writeContract({
    address: CONTRACTS.STAKING_POOL,
    abi: stakingAbi,
    functionName: 'stake',
    args: [STAKE_AMOUNT, 0],
  });
  await waitForTx(stakeHash);
  console.log(`approve=${stakeApprove}`);
  console.log(`stake=${stakeHash}`);

  printStep('LP 场景：授权并存入全局流动性 1000 ODD');
  const lpApprove = await approveOdd(CONTRACTS.LIQUIDITY_POOL, LP_AMOUNT);
  const lpHash = await walletClient.writeContract({
    address: CONTRACTS.LIQUIDITY_POOL,
    abi: liquidityAbi,
    functionName: 'depositGlobal',
    args: [LP_AMOUNT, 0],
  });
  await waitForTx(lpHash);
  console.log(`approve=${lpApprove}`);
  console.log(`depositGlobal=${lpHash}`);

  printStep('BET 场景：开盘、预览、下注');
  const latestBlock = await publicClient.getBlock();
  const now = Number(latestBlock.timestamp);
  const startTime = now + MARKET_START_DELAY_SECONDS;
  const endTime = startTime + MARKET_DURATION_SECONDS;
  const matchId = idFromText(`skills-smoke-${Date.now()}`);
  const computedMarketId = marketId(matchId, 0, 0);
  const odds = [18000n, 32000n, 45000n] as const;

  const openHash = await walletClient.writeContract({
    address: CONTRACTS.BETTING_POOL,
    abi: bettingAbi,
    functionName: 'openMarket',
    args: [matchId, 0, 0n, BigInt(startTime), BigInt(endTime), odds, BigInt(now)],
  });
  await waitForTx(openHash);
  console.log(`marketId=${computedMarketId}`);
  console.log(`openMarket=${openHash}`);

  const betApprove = await approveOdd(CONTRACTS.BETTING_POOL, APPROVE_BUFFER);
  const preview = (await publicClient.readContract({
    address: CONTRACTS.BETTING_POOL,
    abi: bettingAbi,
    functionName: 'previewSignal',
    args: [computedMarketId, 0, BET_AMOUNT],
  })) as readonly [number, bigint, bigint, boolean, bigint];
  const marketOdds = (await publicClient.readContract({
    address: CONTRACTS.BETTING_POOL,
    abi: bettingAbi,
    functionName: 'getMarketOdds',
    args: [computedMarketId],
  })) as readonly [readonly bigint[], readonly bigint[], bigint, bigint];
  const guard = {
    quoteVersion: marketOdds[3],
    quotedAt: marketOdds[2],
    minOdds: preview[2],
    minAcceptedAmount: preview[1],
    deadline: BigInt(now + 600),
  };
  console.log(`approve=${betApprove}`);
  console.log(`preview=${JSON.stringify(preview, (_, value) => (typeof value === 'bigint' ? value.toString() : value))}`);

  const placeHash = await walletClient.writeContract({
    address: CONTRACTS.BETTING_POOL,
    abi: bettingAbi,
    functionName: 'placeBet',
    args: [
      computedMarketId,
      0,
      BET_AMOUNT,
      guard,
    ],
  });
  const placeReceipt = await publicClient.waitForTransactionReceipt({ hash: placeHash });
  const betId = extractBetId(placeReceipt);
  console.log(`placeBet=${placeHash}`);
  console.log(`betId=${betId}`);

  printStep('SETTLEMENT 场景：等待比赛结束、比分结算 1-0、派奖');
  await waitForTimestamp(endTime + 10);
  const settleBatchHash = await walletClient.writeContract({
    address: CONTRACTS.BETTING_POOL,
    abi: bettingAbi,
    functionName: 'settleMarketBetsByScore',
    args: [computedMarketId, 1, 0, [betId]],
  });
  await waitForTx(settleBatchHash);
  console.log(`settleMarketBetsByScore=${settleBatchHash}`);

  const finalizeHash = await walletClient.writeContract({
    address: CONTRACTS.BETTING_POOL,
    abi: bettingAbi,
    functionName: 'finalizeMarketSettlement',
    args: [computedMarketId, 0],
  });
  await waitForTx(finalizeHash);
  console.log(`finalizeMarketSettlement=${finalizeHash}`);

  const betAfterSettle = await readBetSnapshot(betId);
  console.log(`betAfterSettle=${JSON.stringify(betAfterSettle, null, 2)}`);
  if (betAfterSettle.settlementState !== 3) {
    throw new Error(`结算后 bet 不是 WonUnclaimed(3)，当前状态=${betAfterSettle.settlementState}`);
  }

  const claimHash = await walletClient.writeContract({
    address: CONTRACTS.BETTING_POOL,
    abi: bettingAbi,
    functionName: 'claimPayout',
    args: [betId],
  });
  await waitForTx(claimHash);
  console.log(`claimPayout=${claimHash}`);

  printStep('结果汇总');
  const afterOdd = await readOddBalance(account);
  const [pool, stakePositionCount] = await Promise.all([
    readOptional('getPoolStatus'),
    readStakingOptional('getUserPositionCount', [account]),
  ]);

  console.log(
    JSON.stringify(
      {
        account,
        contracts: CONTRACTS,
        transferHash,
        stakeHash,
        lpHash,
        openHash,
        placeHash,
        settleBatchHash,
        finalizeHash,
        claimHash,
        betId,
        oddBalanceBefore: beforeOdd.toString(),
        oddBalanceAfter: afterOdd.toString(),
        stakePositionCount: (stakePositionCount as bigint).toString(),
        pool,
      },
      (_, value) => (typeof value === 'bigint' ? value.toString() : value),
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
