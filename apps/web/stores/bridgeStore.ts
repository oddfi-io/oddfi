import { create } from "zustand";
import { mainnet } from "wagmi/chains";
import type { TokenMeta } from "@/lib/token-registry";

interface BridgeState {
  /** 源链 ID（用户钱包当前链，默认 Ethereum Mainnet） */
  originChainId: number;
  /** 用户在源链上选择的代币 */
  originToken: TokenMeta | null;
  /** 目标代币（BSC 上，V1 固定由 BridgeCard 初始化） */
  destinationToken: TokenMeta | null;
  /** 用户输入的金额字符串 */
  amount: string;

  setOriginChainId: (chainId: number) => void;
  setOriginToken: (token: TokenMeta | null) => void;
  setDestinationToken: (token: TokenMeta | null) => void;
  setAmount: (amount: string) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  originChainId: mainnet.id,
  originToken: null,
  destinationToken: null,
  amount: "",
} as const;

export const useBridgeStore = create<BridgeState>((set) => ({
  ...INITIAL_STATE,

  /** 切换源链时清空已选代币，避免代币地址跨链错配 */
  setOriginChainId: (chainId) => set({ originChainId: chainId, originToken: null }),

  setOriginToken: (token) => set({ originToken: token }),

  setDestinationToken: (token) => set({ destinationToken: token }),

  setAmount: (amount) => set({ amount }),

  reset: () => set(INITIAL_STATE),
}));
