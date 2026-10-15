import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        page: "var(--bg-page)",
        panel: "var(--bg-panel)",
        elevated: "var(--bg-elevated)",
        card: "var(--bg-card)",
        "card-hover": "var(--bg-card-hover)",
        input: "var(--bg-input)",
        edge: "var(--border)",
        "edge-light": "var(--border-light)",
        ink: "var(--text-primary)",
        "ink-2": "var(--text-secondary)",
        "ink-3": "var(--text-tertiary)",
        accent: "var(--accent)",
        "accent-dim": "var(--accent-dim)",
        "accent-bg": "var(--accent-bg)",
        "accent-border": "var(--accent-border)",
        warn: "var(--warn)",
        "warn-bg": "var(--warn-bg)",
        danger: "var(--danger)",
        "danger-bg": "var(--danger-bg)",
        info: "var(--info)",
        "info-bg": "var(--info-bg)",
        "user-blue": "var(--user-blue)",
        dock: "var(--dock-bg)",
        "dock-2": "var(--dock-bg-2)",
        "dock-3": "var(--dock-bg-3)",
        "dock-edge": "var(--dock-edge)",
        "dock-edge-soft": "var(--dock-edge-soft)",
        brand: "var(--brand)",
        "brand-bright": "var(--brand-bright)",
        "brand-fade": "var(--brand-fade)",
        "brand-glow": "var(--brand-glow)",
      },
      fontFamily: {
        body: "var(--font-body)",
        mono: "var(--font-mono)",
        display: "var(--font-display)",
      },
    },
  },
  plugins: [],
};
export default config;
