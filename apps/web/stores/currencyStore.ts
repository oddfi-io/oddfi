import { create } from "zustand";

/**
 * 展示模式切换 —— "ODD" 是 UI 模式标识（平台币模式），不是链上 symbol，也不是 UI 展示单位。
 * 字面量保留稳定：上线真 ODD 合约后取值不变，localStorage 零迁移。
 * 若未来重命名（如 "PLATFORM"），需同步处理 localStorage 老值兼容。
 */
export type DisplayCurrency = "ODD" | "USD";

const STORAGE_KEY = "oddfi_display_currency";
const DEFAULT_CURRENCY: DisplayCurrency = "ODD";

function loadFromStorage(): DisplayCurrency {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "USD" || raw === "ODD") return raw;
    return DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
}

function saveToStorage(currency: DisplayCurrency) {
  try {
    localStorage.setItem(STORAGE_KEY, currency);
  } catch {
    /* quota exceeded — non-critical */
  }
}

interface CurrencyState {
  currency: DisplayCurrency;
  setCurrency: (c: DisplayCurrency) => void;
}

export const useCurrencyStore = create<CurrencyState>((set) => ({
  currency: DEFAULT_CURRENCY,
  setCurrency: (c) => {
    saveToStorage(c);
    set({ currency: c });
  },
}));

// Selectors
export const selectCurrency = (s: CurrencyState) => s.currency;

// SSR-safe hydration — call once in providers.tsx useEffect
let _hydrated = false;
export function hydrateCurrencyStore() {
  if (_hydrated) return;
  _hydrated = true;
  useCurrencyStore.setState({ currency: loadFromStorage() });
}
