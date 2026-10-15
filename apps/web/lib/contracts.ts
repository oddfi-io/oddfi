/**
 * Contract Addresses (DD-079, DD-089, DD-090)
 *
 * 按 chainId 组织的合约地址多链 map。扩新链只需在 CONTRACTS 中追加一条。
 *
 * 读合约前必须走 `requireContract`，避免 ZERO 占位时调合约调到黑洞。
 */

import { bsc, bscTestnet } from "wagmi/chains";
import type { Address } from "viem";
import { BSC_TOKENS, BSC_TESTNET_TOKENS } from "./token-registry";

// 所有代币地址统一从 token-registry 派生，不在此处独立维护
const BSC_USDC_ADDR = BSC_TOKENS.find((t) => t.symbol === "USDC")!.address;
const BSC_USDT_ADDR = BSC_TOKENS.find((t) => t.symbol === "USDT")!.address;
const BSC_ODD_ADDR = BSC_TOKENS.find((t) => t.symbol === "ODD")!.address;
const TESTNET_ODD_ADDR = BSC_TESTNET_TOKENS.find((t) => t.symbol === "ODD")!.address;
const TESTNET_USDT_ADDR = BSC_TESTNET_TOKENS.find((t) => t.symbol === "USDT")!.address;
const TESTNET_USDC_ADDR = BSC_TESTNET_TOKENS.find((t) => t.symbol === "USDC")!.address;

export interface ContractAddresses {
  depositVault: Address;
  oddToken: Address;
  stakingPool: Address;
  lending: Address;
  referral: Address;
  pools: Address;
  /** BettingPool 合约地址（onchain place_bet 目标合约；relay approve 已改走后端 target 枚举，前端不再取此址做 spender，见 DD-127） */
  bettingPool: Address;
  /** TierSale 公开发售合约（DD-146）；前端只读直读 totalSold/getCurrentTier 等 sale-state，购买仍走后端 relay。 */
  tierSale: Address;
  usdc: Address;
  usdt: Address;
}

const ZERO = "0x0000000000000000000000000000000000000000" as Address;

export const CONTRACTS: Record<number, ContractAddresses> = {
  [bsc.id]: {
    // BSC Mainnet — 2026-06-13 合约全量部署（oddfi-ODD/docs/deployment/bsc-mainnet-current.json）
    // 地址与后端 prod config（web-api/spider config_prod.yaml）逐字节 lockstep（DD-142）
    // depositVault/lending/referral：主网无独立部署（充值走 V1 多签；Referral 为 BettingPool 内部 module），保持 ZERO
    depositVault: ZERO,
    oddToken: BSC_ODD_ADDR, // 从 token-registry 派生（单一真值源，对齐 testnet/usdc/usdt）
    stakingPool: "0x837BEB9C2Cd6B45af68CD62009d874569584DDcA",
    lending: ZERO,
    referral: ZERO,
    pools: "0x55419B1529b89FE3C72BdC3062515f431a63F06A", // pools = LiquidityPool proxy
    bettingPool: "0x875D0CA32A74663E42a20d0C2b7E252b5A3121cA", // BettingPool proxy（relay approve 走后端 target 枚举，DD-127）
    tierSale: "0x6FF56E20308647868811089906687fB7706d6517", // TierSale proxy（DD-146；mainnet live + 满额注资 30M）
    usdc: BSC_USDC_ADDR,
    usdt: BSC_USDT_ADDR,
  },
  [bscTestnet.id]: {
    // BSC Testnet — 2026-06-01 合约全量重部署 proxy（oddfi-ODD/docs/development/api.md）
    // 06-07 原址升级 implementation，proxy 不变；与后端 web-api/spider config 一致
    // 代币地址全部派生自 token-registry.ts，不在此处独立维护
    depositVault: ZERO,
    oddToken: TESTNET_ODD_ADDR,
    stakingPool: "0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A",
    lending: ZERO,
    referral: ZERO,
    pools: "0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa", // pools = LiquidityPool proxy
    bettingPool: "0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291", // BettingPool proxy（relay approve 不从此取址，DD-127；当前字段未被消费）
    tierSale: "0xBe938fB7AF656B111a123B749bB724d8351497C7", // TierSale proxy testnet（DD-146 §2.3；前端 !IS_TESTNET 才显示，实际只读 mainnet）
    usdc: TESTNET_USDC_ADDR,
    usdt: TESTNET_USDT_ADDR,
  },
};

export function getContracts(chainId: number): ContractAddresses {
  const addrs = CONTRACTS[chainId];
  if (!addrs) throw new Error(`[contracts] unsupported chainId: ${chainId}`);
  return addrs;
}

/** 读合约前兜底：ZERO 占位时早抛错，避免调合约调到黑洞 */
export function requireContract(chainId: number, key: keyof ContractAddresses): Address {
  const addr = getContracts(chainId)[key];
  if (addr === ZERO) {
    throw new Error(
      `[contracts] ${key} not configured for chainId=${chainId} — fill lib/contracts.ts`
    );
  }
  return addr;
}
