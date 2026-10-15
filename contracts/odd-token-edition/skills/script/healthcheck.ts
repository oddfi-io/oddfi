import { type Abi, type AbiFunction, type Address, type Hex } from 'viem';
import {
  CONTRACTS,
  CONTRACT_SPECS,
  IMPLEMENTATIONS,
  bettingAbi,
  liquidityAbi,
  oddAbi,
  publicClient,
  stakingAbi,
} from './config.js';

const IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc' as Hex;

type ProxyName = keyof typeof IMPLEMENTATIONS;

function addressFromStorageWord(word: Hex | undefined): Address {
  if (!word || word === '0x') throw new Error('implementation storage slot is empty');
  return `0x${word.slice(-40)}` as Address;
}

function sameAddress(left: Address | string, right: Address | string) {
  return left.toLowerCase() === right.toLowerCase();
}

function functionCount(abi: unknown) {
  return (abi as Abi).filter((item): item is AbiFunction => item.type === 'function').length;
}

async function readImplementation(proxy: Address) {
  const word = await publicClient.getStorageAt({ address: proxy, slot: IMPLEMENTATION_SLOT });
  return addressFromStorageWord(word);
}

async function assertEqualAddress(label: string, actual: Address | string, expected: Address | string) {
  if (!sameAddress(actual, expected)) {
    throw new Error(`${label} mismatch: actual=${actual}, expected=${expected}`);
  }
  console.log(`${label}: ${actual}`);
}

async function main() {
  const chainId = await publicClient.getChainId();
  if (chainId !== 97) {
    throw new Error(`chainId mismatch: actual=${chainId}, expected=97`);
  }
  console.log(`chainId: ${chainId}`);

  const proxies: Record<ProxyName, Address> = {
    ODD_TOKEN: CONTRACTS.ODD_TOKEN,
    STAKING_POOL: CONTRACTS.STAKING_POOL,
    LIQUIDITY_POOL: CONTRACTS.LIQUIDITY_POOL,
    BETTING_POOL: CONTRACTS.BETTING_POOL,
    HOUSE_VAULT: CONTRACTS.HOUSE_VAULT,
  };

  for (const [name, proxy] of Object.entries(proxies) as [ProxyName, Address][]) {
    const implementation = await readImplementation(proxy);
    await assertEqualAddress(`${name}.implementation`, implementation, IMPLEMENTATIONS[name]);
  }

  const [bettingOdd, stakingOdd, liquidityOdd, settlementModule] = await Promise.all([
    publicClient.readContract({ address: CONTRACTS.BETTING_POOL, abi: bettingAbi, functionName: 'oddToken' }),
    publicClient.readContract({ address: CONTRACTS.STAKING_POOL, abi: stakingAbi, functionName: 'oddToken' }),
    publicClient.readContract({ address: CONTRACTS.LIQUIDITY_POOL, abi: liquidityAbi, functionName: 'oddToken' }),
    publicClient.readContract({ address: CONTRACTS.BETTING_POOL, abi: bettingAbi, functionName: 'settlementModule' }),
  ]);

  await assertEqualAddress('BettingPool.oddToken', bettingOdd as Address, CONTRACTS.ODD_TOKEN);
  await assertEqualAddress('StakingPool.oddToken', stakingOdd as Address, CONTRACTS.ODD_TOKEN);
  await assertEqualAddress('LiquidityPool.oddToken', liquidityOdd as Address, CONTRACTS.ODD_TOKEN);
  await assertEqualAddress('BettingPool.settlementModule', settlementModule as Address, CONTRACTS.SETTLEMENT_MODULE);

  const symbol = await publicClient.readContract({
    address: CONTRACTS.ODD_TOKEN,
    abi: oddAbi,
    functionName: 'symbol',
  });
  console.log(`ODDToken.symbol: ${symbol}`);

  console.log('method counts:');
  for (const alias of [
    'ODDToken',
    'StakingPool',
    'LiquidityPool',
    'BettingPool',
    'BettingBetModule',
    'BettingMarketModule',
    'BettingReferralModule',
    'BettingSettlementModule',
  ] as const) {
    console.log(`  ${alias}: ${functionCount(CONTRACT_SPECS[alias].abi)}`);
  }

  console.log('healthcheck: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
