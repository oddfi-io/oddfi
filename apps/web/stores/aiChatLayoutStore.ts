/**
 * AI Chat 浮窗布局持久化（DD-106 §3.3）。
 * 仅持久化 `position + size`，不含 isOpen / activeTab / messages（属 aiChatSessionStore）。
 *
 * Storage key: oddfi_ai_chat_layout_v1
 */
import { create } from "zustand";

const STORAGE_KEY = "oddfi_ai_chat_layout_v1";

export const CHAT_MODAL_DEFAULT_WIDTH = 400;
export const CHAT_MODAL_DEFAULT_HEIGHT = 617;
export const CHAT_MODAL_MIN_WIDTH = 360;
export const CHAT_MODAL_MIN_HEIGHT = 480;
export const CHAT_MODAL_VIEWPORT_INSET = 32;
export const CHAT_MODAL_DEFAULT_INSET = 24;

export interface ChatModalLayout {
  position: { x: number; y: number } | null; // null = 用 viewport 默认右下角
  size: { width: number; height: number };
}

interface PersistedLayout {
  position: { x: number; y: number } | null;
  size: { width: number; height: number };
}

function loadFromStorage(): PersistedLayout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedLayout>;
    if (
      !parsed.size ||
      typeof parsed.size.width !== "number" ||
      typeof parsed.size.height !== "number"
    ) {
      return null;
    }
    return {
      position: parsed.position ?? null,
      size: parsed.size,
    };
  } catch {
    return null;
  }
}

function saveToStorage(layout: PersistedLayout) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    /* quota exceeded — non-critical */
  }
}

interface ChatLayoutState extends ChatModalLayout {
  hydrated: boolean;
  setLayout: (next: ChatModalLayout) => void;
  hydrate: () => void;
  reset: () => void;
}

const INITIAL: ChatModalLayout = {
  position: null,
  size: { width: CHAT_MODAL_DEFAULT_WIDTH, height: CHAT_MODAL_DEFAULT_HEIGHT },
};

export const useAiChatLayoutStore = create<ChatLayoutState>((set) => ({
  ...INITIAL,
  hydrated: false,
  setLayout: (next) => {
    saveToStorage(next);
    set({ position: next.position, size: next.size });
  },
  hydrate: () => {
    const persisted = loadFromStorage();
    if (persisted) {
      set({ ...persisted, hydrated: true });
    } else {
      set({ hydrated: true });
    }
  },
  reset: () => {
    saveToStorage(INITIAL);
    set({ ...INITIAL });
  },
}));
