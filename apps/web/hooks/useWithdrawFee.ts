import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { getWithdrawFee } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

// ─── useWithdrawFee (DD-080) ──────────────────────────────────────────────────
// GET /account/withdraw/fee — 实时报价（用户输入金额时触发）
// 300ms debounce 避免每次按键都请求
// 返回 { total_amount, fee, real_amount } 字符串形式，unit 与平台币一致（ODD）

const DEBOUNCE_MS = 300;

export function useWithdrawFee(amount: string, minAmount = 1) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { address } = useAccount();
  const [debouncedAmount, setDebouncedAmount] = useState(amount);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedAmount(amount), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [amount]);

  const parsed = Number(debouncedAmount);
  const isValid = Number.isFinite(parsed) && parsed >= minAmount;

  return useQuery({
    queryKey: ["account", address, "withdraw-fee", debouncedAmount],
    queryFn: () => getWithdrawFee({ amount: debouncedAmount }),
    enabled: isAuthenticated && isValid,
    staleTime: 30_000,
    retry: 1,
  });
}
