"use client";

import { useQuery } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { getOddTokenPrice } from "@/lib/api";

/**
 * 临时 mock：在没有真实代币对汇率前，硬编码 1 ODD = 0.1 USD。
 * 真实汇率上线后置为 null 即可撤回，恢复走 getOddTokenPrice()。
 */
const MOCK_RATE: string | null = "0.1";

/**
 * Fetch ODD token price from api.oddfi.io (GET /market/price?chain=bsc&symbol=odd).
 * Separate from batch_price because ODD price comes from a different backend service.
 *
 * 契约说明：接口返回"当前平台币"的价格，由后端配置驱动。
 * URL 上的 `symbol=odd` 是历史命名遗留，后端并不据此筛选 —
 * 切换平台币（TODD → ODD 合约）时前端零改动，后端改配置即可。
 * 同理 queryKey ["oddPrice"] 保留为缓存 key，与链上 symbol 解耦。
 *
 * select 归一化字符串形式：避免 "2.00" / "2.0" 等价却字符串不等导致下游 useCallback/useMemo 失效。
 */
export function useOddPrice() {
  return useQuery({
    queryKey: ["oddPrice"] as const,
    queryFn: () => (MOCK_RATE != null ? Promise.resolve(MOCK_RATE) : getOddTokenPrice()),
    staleTime: 30_000,
    refetchInterval: 60_000,
    select: (price) => {
      if (price == null || price === "") return price;
      try {
        return new Decimal(price).toString();
      } catch {
        return price;
      }
    },
  });
}
