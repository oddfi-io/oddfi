import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { getAccountBalance } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { accountKeys } from "@/lib/query-keys";

export function useAccountBalance() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { address } = useAccount();
  return useQuery({
    queryKey: accountKeys.balance(address),
    queryFn: getAccountBalance,
    enabled: isAuthenticated,
    // TODO: 后端支持 balance_updated WS 推送后，改为 WS invalidateQueries + 慢轮询兜底（30s）
    staleTime: 8_000,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 2,
  });
}
