import { create } from "zustand";

/**
 * Dev tools modal open/close state.
 *
 * 历史背景：曾承载 Proxy Wallet Override 字段（持久化到 localStorage key `oddfi_devtools`），
 * Override 流程退出后该 store 只保留 modal 开关。残留的 localStorage 键无害，不主动清理。
 */
interface DevToolsStore {
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  /** DD-119: 信号灯模拟浮窗是否激活（独立于 modal 开关，激活后浮窗常驻页面可拖拽） */
  signalSimActive: boolean;
  setSignalSimActive: (active: boolean) => void;
}

export const useDevToolsStore = create<DevToolsStore>((set) => ({
  isModalOpen: false,
  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),
  signalSimActive: false,
  setSignalSimActive: (active) => set({ signalSimActive: active }),
}));
