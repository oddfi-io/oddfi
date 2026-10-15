/**
 * 链上 tx revert reason 解码器（DD-105 P1）
 *
 * 后端通过 EIP-7702 SmartAccount 代签下注：外层调用 `AccountManager`
 * （`0x8d54...dd03`），内层路由到 `BettingPool`。合约 revert 时 AccountManager
 * 把内部 error 包成 `CallFailed(uint256 callIndex, bytes reason)` 抛回前端。
 *
 * 本模块：
 *   1. `parseRevertData(hex)` — 纯函数，递归解开 `CallFailed` 外层、按 4-byte
 *      selector 映射到 `RevertKind`，便于上层做 i18n。
 *   2. `decodeRevertedTx(txHash, client)` — eth_call 重放 reverted tx 拿 revert
 *      data，套用 parseRevertData。失败/超时返回 null，调用方 fallback 到通用
 *      文案。
 *
 * 仅维护 BettingPool / ERC20 高频 selector，未知 selector 落到 `unknown`。
 */
import { createPublicClient, decodeErrorResult, http, slice, type PublicClient } from "viem";
import { CORE_CHAIN, CHAIN_RPC } from "@/lib/chains";

export type RevertKind =
  | "bet-amount-below-min"
  | "pool-liquidity-insufficient"
  | "market-locked"
  | "market-not-open"
  | "market-closed"
  | "invalid-quote-guard"
  | "daily-limit-exceeded"
  | "open-position-exceeded"
  | "match-payout-exceeded"
  | "erc20-insufficient-allowance"
  | "erc20-insufficient-balance"
  | "contract-panic"
  | "unknown";

export interface DecodedRevert {
  kind: RevertKind;
  /** ABI-decoded args（按 selector 对应 error 的参数顺序） */
  args: readonly unknown[];
  /** 原始 hex bytes（unwrap 之前的最外层） */
  rawData: `0x${string}`;
  /** 是否经过 CallFailed 外层解包 */
  unwrapped: boolean;
}

/** 4-byte selector → RevertKind 映射（与下方 ABI 一一对应） */
const SELECTOR_TO_KIND: Record<string, RevertKind> = {
  "0x27ab623f": "bet-amount-below-min",
  "0xbcf56fa9": "pool-liquidity-insufficient",
  "0x72752842": "market-locked",
  "0x2e1ca92e": "market-not-open",
  "0x685acf17": "market-closed",
  "0xda803aa3": "invalid-quote-guard",
  "0x357d8e0a": "daily-limit-exceeded",
  "0x12d0cb2d": "open-position-exceeded",
  "0xff5b6f7f": "match-payout-exceeded",
  "0xfb8f41b2": "erc20-insufficient-allowance",
  "0xe450d38c": "erc20-insufficient-balance",
  // Solidity 内置 Panic(uint256)：合约内部断言失败（如 0x32 数组越界、0x11 溢出）。
  // 多为合约/链上数据 bug（非业务条件），CallFailed 解包后命中（见 BUG-018）。
  "0x4e487b71": "contract-panic",
};

/** CallFailed 外层 selector（AccountManager 包裹用） */
const CALL_FAILED_SELECTOR = "0x5c0dee5d";

/**
 * 解码 ABI（合约 src/shared/errors/BettingErrors.sol + ERC20 + AccountManager）。
 * 不引入 typechain，手写最小集合避免膨胀。
 */
const ERRORS_ABI = [
  {
    type: "error",
    name: "CallFailed",
    inputs: [
      { name: "callIndex", type: "uint256" },
      { name: "reason", type: "bytes" },
    ],
  },
  {
    type: "error",
    name: "BetAmountBelowMinimum",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "minimum", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "PoolLiquidityInsufficient",
    inputs: [
      { name: "requestedPayout", type: "uint256" },
      { name: "availableLiquidity", type: "uint256" },
    ],
  },
  // 注：Solidity 内置 Panic(uint256) 无需在此声明 —— viem decodeErrorResult 会自动追加
  // solidityError/solidityPanic，args[0] 即 panic code（0x32=数组越界，0x11=算术溢出 等）。
  { type: "error", name: "MarketLocked", inputs: [{ name: "marketId", type: "bytes32" }] },
  { type: "error", name: "MarketNotOpen", inputs: [{ name: "marketId", type: "bytes32" }] },
  { type: "error", name: "MarketClosed", inputs: [{ name: "marketId", type: "bytes32" }] },
  { type: "error", name: "InvalidQuoteGuard", inputs: [] },
  {
    type: "error",
    name: "DailyLimitExceeded",
    inputs: [
      { name: "user", type: "address" },
      { name: "attempted", type: "uint256" },
      { name: "remaining", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "OpenPositionExceeded",
    inputs: [
      { name: "user", type: "address" },
      { name: "attempted", type: "uint256" },
      { name: "allowed", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "MatchPayoutExceeded",
    inputs: [
      { name: "user", type: "address" },
      { name: "marketId", type: "bytes32" },
      { name: "attempted", type: "uint256" },
      { name: "allowed", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "ERC20InsufficientAllowance",
    inputs: [
      { name: "spender", type: "address" },
      { name: "allowance", type: "uint256" },
      { name: "needed", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "ERC20InsufficientBalance",
    inputs: [
      { name: "sender", type: "address" },
      { name: "balance", type: "uint256" },
      { name: "needed", type: "uint256" },
    ],
  },
] as const;

function selectorOf(hex: `0x${string}`): string | null {
  if (!hex || hex.length < 10) return null;
  return slice(hex, 0, 4).toLowerCase();
}

/**
 * 纯函数：解析 revert hex bytes 为 `DecodedRevert`。
 *
 * - 输入空 / 长度不足返回 null（无可解码内容）
 * - 命中外层 CallFailed → 自动解包取 `reason` bytes 继续
 * - selector 不在白名单 → `kind = 'unknown'`，args 留空（保留 rawData 供诊断）
 */
export function parseRevertData(data: `0x${string}` | null | undefined): DecodedRevert | null {
  if (!data || data.length < 10 || !data.startsWith("0x")) return null;
  const rawData = data;
  let bytes: `0x${string}` = data;
  let unwrapped = false;

  const outer = selectorOf(bytes);
  if (outer === CALL_FAILED_SELECTOR) {
    try {
      const r = decodeErrorResult({ abi: ERRORS_ABI, data: bytes });
      if (r.errorName === "CallFailed" && Array.isArray(r.args) && r.args.length >= 2) {
        const inner = r.args[1] as `0x${string}`;
        if (typeof inner === "string" && inner.startsWith("0x") && inner.length >= 10) {
          bytes = inner as `0x${string}`;
          unwrapped = true;
        }
      }
    } catch {
      /* fall through with original bytes */
    }
  }

  const sel = selectorOf(bytes);
  if (!sel) return { kind: "unknown", args: [], rawData, unwrapped };
  const kind = SELECTOR_TO_KIND[sel] ?? "unknown";

  if (kind === "unknown") return { kind, args: [], rawData, unwrapped };

  let args: readonly unknown[] = [];
  try {
    const r = decodeErrorResult({ abi: ERRORS_ABI, data: bytes });
    args = (r.args as readonly unknown[]) ?? [];
  } catch {
    /* 命中 selector 但 ABI 解码失败：退化为 kind 已知 / args 为空 */
  }
  return { kind, args, rawData, unwrapped };
}

/**
 * 从 viem 抛出的 error 对象（包含 cause 链）提取 revert hex data。
 * 兼容 BaseError / RpcError / TransactionExecutionError 等不同包装层级。
 */
export function extractRevertData(err: unknown): `0x${string}` | null {
  const seen = new Set<unknown>();
  const visit = (e: unknown): `0x${string}` | null => {
    if (!e || typeof e !== "object" || seen.has(e)) return null;
    seen.add(e);
    const obj = e as Record<string, unknown>;
    if (typeof obj.data === "string" && (obj.data as string).startsWith("0x")) {
      return obj.data as `0x${string}`;
    }
    // viem RpcError: data 可能挂在 `details` / `metaMessages` 不可靠，统一沿 cause 链找
    if (obj.cause) {
      const r = visit(obj.cause);
      if (r) return r;
    }
    return null;
  };
  return visit(err);
}

/**
 * 浏览器端 PublicClient 单例：与 receipt-poller 同样的 SSR 防护，避免服务端实例化
 * 持有 RPC 长连接。让 UI 层不依赖 wagmi 的 `usePublicClient` hook（测试更易隔离）。
 */
let cachedClient: PublicClient | null = null;
function getDefaultPublicClient(): PublicClient {
  if (typeof window === "undefined") {
    throw new Error(
      "[RevertDecoder] Default client cannot be created on the server; pass a client explicitly"
    );
  }
  if (!cachedClient) {
    cachedClient = createPublicClient({
      chain: CORE_CHAIN,
      transport: http(CHAIN_RPC[CORE_CHAIN.id]),
    }) as unknown as PublicClient;
  }
  return cachedClient;
}

/**
 * I/O 封装：基于 reverted tx hash 重放 eth_call 拿 revert reason。
 *
 * 任何失败（getTransaction 失败、call 没抛 revert data、网络超时）都返回 null，
 * 调用方应 fallback 到通用 "tx reverted" 文案。
 *
 * `client` 缺省时使用模块内单例（CORE_CHAIN + Alchemy RPC），与 receipt-poller 对齐。
 */
export async function decodeRevertedTx(
  txHash: `0x${string}`,
  client: PublicClient = getDefaultPublicClient()
): Promise<DecodedRevert | null> {
  let tx: Awaited<ReturnType<PublicClient["getTransaction"]>>;
  try {
    tx = await client.getTransaction({ hash: txHash });
  } catch {
    return null;
  }
  if (!tx || !tx.to) return null;

  const blockNumber = tx.blockNumber == null ? undefined : tx.blockNumber - 1n;
  try {
    await client.call({
      to: tx.to,
      data: tx.input,
      value: tx.value,
      account: tx.from,
      ...(blockNumber !== undefined ? { blockNumber } : {}),
    });
    return null; // 不应到达
  } catch (e) {
    const data = extractRevertData(e);
    if (!data) return null;
    return parseRevertData(data);
  }
}
