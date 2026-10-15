import { createPublicClient, createWalletClient, http, parseAbi, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bscTestnet } from 'viem/chains';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── 环境变量 ──
const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) {
  console.error('错误: 请先 export PRIVATE_KEY=0x...');
  process.exit(1);
}

// ── 合约地址 ──
export const CONTRACTS = {
  USDT: '0xd8f86e84b4475d7bd398788e594124429e7700cf' as Address,
  POOL: '0xCcAD84d0772262AeDe15B1B702d1Bd69D02f177D' as Address,
  IMPL: '0xb2809eaa08cd5d0344339fc2297702bdc9936297' as Address,
} as const;

// ── RPC (多节点 fallback) ──
const RPC_URLS = [
  'https://bsc-testnet-dataseed.bnbchain.org',
  'https://bsc-testnet.bnbchain.org',
  'https://bsc-prebsc-dataseed.bnbchain.org',
];

// ── 客户端 ──
export const account = privateKeyToAccount(privateKey as Hex);

export const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: http(RPC_URLS[0], {
    fetchOptions: { timeout: 10000 },
    retryCount: 3,
    onFetchRequest: async (request) => request,
  }),
});

export const walletClient = createWalletClient({
  account,
  chain: bscTestnet,
  transport: http(RPC_URLS[0]),
});

// ── ABI 加载 ──
const __dirname = dirname(fileURLToPath(import.meta.url));

function loadAbi(filename: string) {
  const path = resolve(__dirname, '..', 'assets', filename);
  return JSON.parse(readFileSync(path, 'utf-8'));
}

export const poolAbi = loadAbi('BettingPool.abi.json');
export const usdtAbi = loadAbi('MockUSDT.abi.json');

// ── 工具函数 ──
export const USDT_DECIMALS = 6;

export function toUsdtUnits(amount: number): bigint {
  return BigInt(Math.round(amount * 10 ** USDT_DECIMALS));
}

export function fromUsdtUnits(amount: bigint): string {
  return (Number(amount) / 10 ** USDT_DECIMALS).toFixed(2);
}

export function generateId(prefix: string): Hex {
  const hash = Buffer.alloc(32);
  const data = `${prefix}-${Date.now()}`;
  for (let i = 0; i < data.length && i < 32; i++) {
    hash[i] = data.charCodeAt(i);
  }
  return `0x${hash.toString('hex')}` as Hex;
}

export async function waitForTx(hash: Hex) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === 'reverted') {
    throw new Error(`交易失败: ${hash}`);
  }
  console.log(`  ✓ tx: ${hash}`);
  return receipt;
}
