import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  formatEther,
  http,
  keccak256,
  parseEther,
  toHex,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bscTestnet } from 'viem/chains';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

export const CONTRACTS = {
  ODD_TOKEN: '0x9D3cfd96C447D45FBf3e10bf0D233C51DEb58Ad0' as Address,
  STAKING_POOL: '0x9378fd8E53c3904e972bf633Dbb96aA3EF46E32F' as Address,
  LIQUIDITY_POOL: '0x2de40A5AE2eF4a3fb8168ccd357b37A9fFC04b50' as Address,
  BETTING_POOL: '0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3' as Address,
  SETTLEMENT_MODULE: '0xC29ebbdd68d7718f0fe1B8E187d84ae8F34bfA39' as Address,
  BET_MODULE: (process.env.BET_MODULE_ADDRESS || '0xe911D8472F53f64E8B06eAb31E8Ec6Cc5B4c8825') as Address,
  MARKET_MODULE: (process.env.MARKET_MODULE_ADDRESS || '0xD786A66a77Ff137A09Aa2fa69BbD8f6AE42f79De') as Address,
  REFERRAL_MODULE: (process.env.REFERRAL_MODULE_ADDRESS || '0x6f481A9E772AFDF85741a5FA82985DCcaC79Bb6B') as Address,
  PARLAY_MODULE: (process.env.PARLAY_MODULE_ADDRESS || '0xD7AcFb964C01D4be09757207034FD919dA06fE96') as Address,
  PARLAY_LENS: (process.env.PARLAY_LENS_ADDRESS || '0xd139C9C041783D48A3D36aedb8Ea7d99859bD2a2') as Address,
  TIER_SALE: (process.env.TIER_SALE_ADDRESS || '0xBe938fB7AF656B111a123B749bB724d8351497C7') as Address,
  HOUSE_VAULT: (process.env.HOUSE_VAULT_ADDRESS || '0x41e87F99f1a3dBDb09A337AEf4C4841d90b5d280') as Address,
  DEX_LAUNCH_CONTROLLER: (process.env.DEX_LAUNCH_CONTROLLER_ADDRESS || '0x070f72Fda6eAa8335162A5A5629Fb12f9f8b6d54') as Address,
  DEX_LP_LOCKER: (process.env.DEX_LP_LOCKER_ADDRESS || '0xC30d6407df0E7291dbE8A58A2c44808C92AFD3a9') as Address,
  ECOSYSTEM_REWARDS: (process.env.ECOSYSTEM_REWARDS_ADDRESS || '0x6c5352D01160E50C50b66dD61BD3d48Ff6B4E2ac') as Address,
} as const;

export const IMPLEMENTATIONS = {
  ODD_TOKEN: '0x1c35c6c048266c22390C8b6CCEec3D6e4479192c' as Address,
  STAKING_POOL: '0x07e3246b17d4FBd0325Bb0027b71C13734b084BA' as Address,
  LIQUIDITY_POOL: '0x359b8cd8Ab5ADD99335f7ABA806c793CBf3FD870' as Address,
  BETTING_POOL: '0x3a4845AAdDf529dd3Ee8F073EA7dE9e565df56DA' as Address,
  HOUSE_VAULT: '0x7e12549BC39B25B1Df4034abEDB9a0109E700128' as Address,
} as const;

export const RPC_URL = process.env.RPC_URL || 'https://bsc-testnet-dataseed.bnbchain.org';

export const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: http(RPC_URL, { retryCount: 3, timeout: 15_000 }),
});

const privateKey = process.env.PRIVATE_KEY as Hex | undefined;
export const account = privateKey ? privateKeyToAccount(privateKey) : undefined;

export function requireWalletClient() {
  if (!account) {
    throw new Error('写操作需要先设置 PRIVATE_KEY=0x...');
  }

  return createWalletClient({
    account,
    chain: bscTestnet,
    transport: http(RPC_URL, { retryCount: 3, timeout: 15_000 }),
  });
}

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadAbi(filename: string) {
  const path = resolve(__dirname, '..', 'assets', filename);
  return JSON.parse(readFileSync(path, 'utf-8'));
}

export const oddAbi = loadAbi('ODDToken.abi.json');
export const stakingAbi = loadAbi('StakingPool.abi.json');
export const liquidityAbi = loadAbi('LiquidityPool.abi.json');
export const bettingAbi = loadAbi('BettingPool.abi.json');
export const betModuleAbi = loadAbi('BettingBetModule.abi.json');
export const marketModuleAbi = loadAbi('BettingMarketModule.abi.json');
export const referralModuleAbi = loadAbi('BettingReferralModule.abi.json');
export const settlementAbi = loadAbi('BettingSettlementModule.abi.json');
export const parlayModuleAbi = loadAbi('BettingParlayModule.abi.json');
export const parlayLensAbi = loadAbi('BettingParlayLens.abi.json');
export const tierSaleAbi = loadAbi('TierSale.abi.json');
export const houseVaultAbi = loadAbi('HouseVault.abi.json');
export const dexLaunchControllerAbi = loadAbi('DexLaunchController.abi.json');
export const dexLpLockerAbi = loadAbi('DexLpLocker.abi.json');
export const ecosystemRewardsAbi = loadAbi('EcosystemRewards.abi.json');

export const CONTRACT_SPECS = {
  ODDToken: { address: CONTRACTS.ODD_TOKEN, abi: oddAbi },
  StakingPool: { address: CONTRACTS.STAKING_POOL, abi: stakingAbi },
  LiquidityPool: { address: CONTRACTS.LIQUIDITY_POOL, abi: liquidityAbi },
  BettingPool: { address: CONTRACTS.BETTING_POOL, abi: bettingAbi },
  BettingSettlementModule: {
    address: (process.env.SETTLEMENT_MODULE_ADDRESS || CONTRACTS.SETTLEMENT_MODULE) as Address,
    abi: settlementAbi,
  },
  BettingBetModule: {
    address: CONTRACTS.BET_MODULE,
    abi: betModuleAbi,
  },
  BettingMarketModule: {
    address: CONTRACTS.MARKET_MODULE,
    abi: marketModuleAbi,
  },
  BettingReferralModule: {
    address: CONTRACTS.REFERRAL_MODULE,
    abi: referralModuleAbi,
  },
  BettingParlayModule: {
    address: CONTRACTS.PARLAY_MODULE,
    abi: parlayModuleAbi,
  },
  BettingParlayLens: {
    address: CONTRACTS.PARLAY_LENS,
    abi: parlayLensAbi,
  },
  TierSale: { address: CONTRACTS.TIER_SALE, abi: tierSaleAbi },
  HouseVault: { address: CONTRACTS.HOUSE_VAULT, abi: houseVaultAbi },
  DexLaunchController: { address: CONTRACTS.DEX_LAUNCH_CONTROLLER, abi: dexLaunchControllerAbi },
  DexLpLocker: { address: CONTRACTS.DEX_LP_LOCKER, abi: dexLpLockerAbi },
  EcosystemRewards: { address: CONTRACTS.ECOSYSTEM_REWARDS, abi: ecosystemRewardsAbi },
  ODD_TOKEN: { address: CONTRACTS.ODD_TOKEN, abi: oddAbi },
  STAKING_POOL: { address: CONTRACTS.STAKING_POOL, abi: stakingAbi },
  LIQUIDITY_POOL: { address: CONTRACTS.LIQUIDITY_POOL, abi: liquidityAbi },
  BETTING_POOL: { address: CONTRACTS.BETTING_POOL, abi: bettingAbi },
  SETTLEMENT_MODULE: {
    address: (process.env.SETTLEMENT_MODULE_ADDRESS || CONTRACTS.SETTLEMENT_MODULE) as Address,
    abi: settlementAbi,
  },
  BET_MODULE: {
    address: CONTRACTS.BET_MODULE,
    abi: betModuleAbi,
  },
  MARKET_MODULE: {
    address: CONTRACTS.MARKET_MODULE,
    abi: marketModuleAbi,
  },
  REFERRAL_MODULE: {
    address: CONTRACTS.REFERRAL_MODULE,
    abi: referralModuleAbi,
  },
  PARLAY_MODULE: {
    address: CONTRACTS.PARLAY_MODULE,
    abi: parlayModuleAbi,
  },
  PARLAY_LENS: {
    address: CONTRACTS.PARLAY_LENS,
    abi: parlayLensAbi,
  },
  TIER_SALE: { address: CONTRACTS.TIER_SALE, abi: tierSaleAbi },
  HOUSE_VAULT: { address: CONTRACTS.HOUSE_VAULT, abi: houseVaultAbi },
  DEX_LAUNCH_CONTROLLER: { address: CONTRACTS.DEX_LAUNCH_CONTROLLER, abi: dexLaunchControllerAbi },
  DEX_LP_LOCKER: { address: CONTRACTS.DEX_LP_LOCKER, abi: dexLpLockerAbi },
  ECOSYSTEM_REWARDS: { address: CONTRACTS.ECOSYSTEM_REWARDS, abi: ecosystemRewardsAbi },
} as const;

export type ContractAlias = keyof typeof CONTRACT_SPECS;

export function getContractSpec(alias: string) {
  const spec = CONTRACT_SPECS[alias as ContractAlias];
  if (!spec) {
    throw new Error(`未知合约: ${alias}. 支持: ${Object.keys(CONTRACT_SPECS).join(', ')}`);
  }
  return spec;
}

export function toOddUnits(amount: string): bigint {
  return parseEther(amount);
}

export function fromOddUnits(amount: bigint): string {
  return formatEther(amount);
}

export function jsonStringify(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, inner) => (typeof inner === 'bigint' ? inner.toString() : inner),
    2,
  );
}

export function idFromText(text: string): Hex {
  return keccak256(toHex(text));
}

export function marketId(matchId: Hex, marketType: number, line: number): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'uint8' }, { type: 'uint8' }],
      [matchId, marketType, line],
    ),
  );
}

export function parseBytes32(input: string): Hex {
  if (input.startsWith('0x') && input.length === 66) return input as Hex;
  return idFromText(input);
}

export function parseOddsCsv(input: string): bigint[] {
  return input.split(',').map((value) => BigInt(value.trim()));
}

export async function waitForTx(hash: Hex) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === 'reverted') {
    throw new Error(`交易失败: ${hash}`);
  }
  console.log(`tx: ${hash}`);
  return receipt;
}
