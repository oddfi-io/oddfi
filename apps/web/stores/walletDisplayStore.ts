import { create } from "zustand";

interface WalletDisplayStore {
  activeSymbol: string | null;
  setActiveSymbol: (symbol: string) => void;
  resetActiveSymbol: () => void;
  /** Incremented when a swap confirms — triggers WalletBalanceWidget to refetch */
  balanceVersion: number;
  bumpBalance: () => void;
}

export const useWalletDisplayStore = create<WalletDisplayStore>((set) => ({
  activeSymbol: null,
  setActiveSymbol: (symbol) => set({ activeSymbol: symbol }),
  resetActiveSymbol: () => set({ activeSymbol: null }),
  balanceVersion: 0,
  bumpBalance: () => set((s) => ({ balanceVersion: s.balanceVersion + 1 })),
}));
