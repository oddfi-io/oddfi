import { create } from "zustand";
import type { ProxyWalletInfo } from "@/lib/proxy-wallet/types";

interface ProxyWalletStore {
  proxyWallet: ProxyWalletInfo | null;
  isAssigning: boolean;
  assignError: string | null;
  setProxyWallet: (wallet: ProxyWalletInfo) => void;
  setAssigning: (v: boolean) => void;
  setAssignError: (err: string | null) => void;
  clearProxy: () => void;
}

export const useProxyWalletStore = create<ProxyWalletStore>((set) => ({
  proxyWallet: null,
  isAssigning: false,
  assignError: null,
  setProxyWallet: (wallet) => set({ proxyWallet: wallet, assignError: null, isAssigning: false }),
  setAssigning: (v) => set({ isAssigning: v }),
  setAssignError: (err) => set({ assignError: err, isAssigning: false }),
  clearProxy: () => set({ proxyWallet: null, isAssigning: false, assignError: null }),
}));
