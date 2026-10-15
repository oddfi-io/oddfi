import { useEffect, useMemo, useRef } from "react";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { getPortfolioHistory } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { accountKeys } from "@/lib/query-keys";
import { PRESET_CONFIG, type HistoryPreset } from "@/hooks/usePortfolioHistory";
import type { PortfolioHistoryParams, PortfolioHistoryRes } from "@/types/auth";

export const HISTORY_PAGE_SIZE = 20;

type InfiniteParams = Omit<PortfolioHistoryParams, "page" | "page_size">;

export function usePortfolioHistoryInfinite(
  params: InfiniteParams,
  opts?: { preset?: HistoryPreset }
) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const cfg = PRESET_CONFIG[opts?.preset ?? "normal"];
  const queryParams = { ...params, page_size: HISTORY_PAGE_SIZE };

  const queryKey = useMemo(
    () => accountKeys.historyInfinite(address, queryParams),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [address, JSON.stringify(queryParams)]
  );

  // ENH-020 B1.6a：ref 持有最新 queryParams，避免 setInterval 闭包陈旧
  const paramsRef = useRef(queryParams);
  paramsRef.current = queryParams;

  const result = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => getPortfolioHistory({ ...queryParams, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((n, p) => n + p.asset_ledgers.length, 0);
      return loaded < lastPage.total ? allPages.length + 1 : undefined;
    },
    enabled: isAuthenticated && Boolean(address),
    staleTime: cfg.staleTime,
    // ENH-020 B1.6a：原生 refetchInterval 会重拉全部已加载页（随分页累积反向放大），
    // 改为下方 useEffect + queryClient.fetchQuery 单页刷新 page[0]
    refetchInterval: false,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (!isAuthenticated || !address) return;
    const id = setInterval(async () => {
      try {
        const fresh = await queryClient.fetchQuery({
          queryKey: [...queryKey, "refresh-page-1"],
          queryFn: () => getPortfolioHistory({ ...paramsRef.current, page: 1 }),
          staleTime: 0,
        });
        queryClient.setQueryData<InfiniteData<PortfolioHistoryRes, number>>(queryKey, (old) => {
          if (!old || old.pageParams[0] !== 1) return old;
          return { ...old, pages: [fresh, ...old.pages.slice(1)] };
        });
      } catch (e) {
        console.error("[usePortfolioHistoryInfinite] Page 1 refresh failed", e);
      }
    }, cfg.refetchInterval);
    return () => clearInterval(id);
  }, [isAuthenticated, address, queryKey, queryClient]);

  return result;
}
