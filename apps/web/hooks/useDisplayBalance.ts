import { useAccountBalance } from "@/hooks/useAccountBalance";

/**
 * Simplified balance hook — always returns real backend balance.
 * Kept for backward compatibility with components that import this hook.
 */
export function useDisplayBalance() {
  const { data: accountBalance, isLoading } = useAccountBalance();
  const balance = accountBalance?.available_balance ?? "0";

  return {
    balance,
    isLoading,
    effectiveBalance: balance, // backward compat
    displayBalance: balance, // backward compat
  };
}
