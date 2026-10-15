"use client";

import { useEffect } from "react";
import { useReadContracts } from "wagmi";
import { zeroAddress } from "viem";
import type { Address } from "viem";
import { CORE_CHAIN } from "@/lib/wagmi.config";
import { getContracts } from "@/lib/contracts";
import { LIQUIDITY_POOL_ABI } from "@/lib/abi/liquidityPool";
import { useLpRefetchStore } from "@/stores/lpRefetchStore";

interface LiquidityPoolStats {
  totalActiveDeposited: bigint; // 1e18 ODD
  minDeposit: bigint; // 1e18 ODD
  isPaused: boolean; // true = all write ops disabled
  /** isFetching — refetch 期间也为 true，UI 用此控制 loading 占位 */
  isLoading: boolean;
}

// DD-147：删 IS_TESTNET 业务闸（testnet/mainnet 链上统一）。门控收敛到「pools 地址是否配置」。
function resolvePoolAddress(): Address | null {
  const c = getContracts(CORE_CHAIN.id);
  if (c.pools === zeroAddress) return null;
  return c.pools;
}

const FALLBACK: LiquidityPoolStats = {
  totalActiveDeposited: 0n,
  minDeposit: 0n,
  isPaused: false,
  isLoading: false,
};

export function useLiquidityPoolStats(): LiquidityPoolStats {
  const poolAddress = resolvePoolAddress();
  const lpBumpKey = useLpRefetchStore((s) => s.bumpKey);

  // TODO(DD-130 后端切换): 全局池 TVL/minDeposit/paused 暂走链上只读（A1）。
  // 后端就绪 GET /liquidity/global/stats（total_deposited / paused / min_deposit，见
  // BACKEND-FIELDS-liquidity-supplement.md §2）后，主动探测该接口可用 → 整个 hook 改 useQuery 取后端值，
  // 删本 useReadContracts + lib/abi/liquidityPool 相关只读。
  const { data, isFetching, refetch } = useReadContracts({
    contracts: poolAddress
      ? ([
          {
            address: poolAddress,
            abi: LIQUIDITY_POOL_ABI,
            functionName: "totalActiveDeposited",
          },
          {
            address: poolAddress,
            abi: LIQUIDITY_POOL_ABI,
            functionName: "minDeposit",
          },
          {
            address: poolAddress,
            abi: LIQUIDITY_POOL_ABI,
            functionName: "paused",
          },
        ] as const)
      : [],
    query: { enabled: !!poolAddress },
  });

  // bump → refetch on-chain stats（deposit/withdraw 后 totalActiveDeposited 变化）
  useEffect(() => {
    if (lpBumpKey > 0 && poolAddress) {
      refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lpBumpKey]);

  if (!poolAddress) return FALLBACK;

  const [totalActive, minDep, paused] = data ?? [];

  return {
    totalActiveDeposited: totalActive?.status === "success" ? totalActive.result : 0n,
    minDeposit: minDep?.status === "success" ? minDep.result : 0n,
    isPaused: paused?.status === "success" ? paused.result : false,
    isLoading: isFetching,
  };
}
