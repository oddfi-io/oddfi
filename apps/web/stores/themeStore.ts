import { create } from "zustand";

export type Theme = "dark" | "light";

const STORAGE_KEY = "oddfi_theme";
const DEFAULT_THEME: Theme = "dark";

function loadFromStorage(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "dark" || raw === "light") return raw;
    return DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function saveToStorage(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* quota exceeded — non-critical */
  }
}

// data-theme="light" 触发 design-tokens.css 的浅色覆盖；删除属性 = 深色（:root 默认）
function applyToDOM(theme: Theme) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  if (theme === "light") {
    el.setAttribute("data-theme", "light");
  } else {
    el.removeAttribute("data-theme");
  }
}

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: DEFAULT_THEME,
  setTheme: (t) => {
    saveToStorage(t);
    applyToDOM(t);
    set({ theme: t });
  },
  toggleTheme: () => {
    const next: Theme = get().theme === "dark" ? "light" : "dark";
    saveToStorage(next);
    applyToDOM(next);
    set({ theme: next });
  },
}));

export const selectTheme = (s: ThemeState) => s.theme;

let _hydrated = false;
export function hydrateThemeStore() {
  if (_hydrated) return;
  _hydrated = true;
  const t = loadFromStorage();
  applyToDOM(t);
  useThemeStore.setState({ theme: t });
}
