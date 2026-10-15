"use client";

import { useMemo } from "react";
import { useReadContract } from "wagmi";
import { CORE_CHAIN } from "@/lib/chains";
import { getContracts } from "@/lib/contracts";
import { TIER_SALE_ABI } from "@/lib/abi/tierSale";
import { deriveSaleState, type SaleState } from "../config/tier-sale.config";

/**
 * DD-146 sale-state 前端直读链上（DD §8.4④，零后端依赖）。
 *
 * 读 TierSale `totalSold()`（public view，随 NetworkMode 取 CORE_CHAIN 上的地址），
 * 本地按 10 档逆运算派生当前档位 / 本档剩余 / 建池进度（deriveSaleState，逐行镜像合约）。
 * 页面仅 `!IS_TESTNET` 展示，实际读 mainnet TierSale（已满额注资 + saleClosed=false）。
 *
 * 30s 轮询刷新（发售期 totalSold 缓慢变化，无需更频繁）。供 VaultInfoCard /
 * TierPricingTable / BuyCard 信息面板共用（多调用方，deep module）。
 */
export interface UseTierSaleStateResult {
  saleState: SaleState | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useTierSaleState(): UseTierSaleStateResult {
  const tierSale = getContracts(CORE_CHAIN.id).tierSale;
  const { data, isLoading, isError, refetch } = useReadContract({
    address: tierSale,
    abi: TIER_SALE_ABI,
    functionName: "totalSold",
    chainId: CORE_CHAIN.id,
    query: { refetchInterval: 30_000, staleTime: 15_000 },
  });

  // memo 化派生：data 不变则 saleState 引用稳定，避免 VaultInfoCard / BuyCard / TierPricingTable 每帧重渲
  const saleState = useMemo(() => (data != null ? deriveSaleState(data as bigint) : null), [data]);

  return {
    saleState,
    isLoading,
    isError,
    refetch: () => void refetch(),
  };
}
