import { create } from "zustand";

interface WalletSheetState {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** 递增此值触发 ConnectButton 打开连接弹窗（PC Modal / H5 Sheet） */
  connectTrigger: number;
  triggerConnect: () => void;
  /** 触发连接的来源，用于关闭时展示上下文 toast（如 "ai-agent"）。用完须清空。 */
  connectSource: string | null;
  setConnectSource: (source: string | null) => void;
}

export const useWalletSheetStore = create<WalletSheetState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  connectTrigger: 0,
  triggerConnect: () => set((s) => ({ connectTrigger: s.connectTrigger + 1 })),
  connectSource: null,
  setConnectSource: (source) => set({ connectSource: source }),
}));

export const selectWalletSheetOpen = (s: WalletSheetState) => s.open;
