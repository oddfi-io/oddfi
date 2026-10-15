import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        wide: "1600px",
        ultra: "1920px",
      },
      // ════════════════════════════════════════════════
      // Figma Design Tokens (via CSS Variables)
      // Source: tokens/figma/ → pnpm sync-tokens
      //
      // Token 分注册策略（避免 text-text-* / bg-bg-* 冗余）：
      //   textColor     → text-primary, text-secondary, ...
      //   backgroundColor → bg-primary, bg-secondary, ...
      //   borderColor   → border-divider, border-primary/secondary/tertiary, ...
      //   colors        → 多用途 token (fn/btn/fill/tag)
      // ════════════════════════════════════════════════

      textColor: {
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        tertiary: "var(--text-tertiary)",
        "static-white": "var(--text-static-white)",
        "static-black": "var(--text-static-black)",
        "white-to-back": "var(--text-white-to-back)",
        "brand-default": "var(--text-brand-default)",
        "brand-hover": "var(--text-brand-hover)",
        "brand-press": "var(--text-brand-press)",
        "brand-disable": "var(--text-brand-disable)",
        green: "var(--text-green)",
        red: "var(--text-red)",
        orange: "var(--text-orange)",
        warning: "var(--text-warning)",
      },
      backgroundColor: {
        primary: "var(--bg-primary)",
        secondary: "var(--bg-secondary)",
        tertiary: "var(--bg-tertiary)",
      },
      borderColor: {
        divider: "var(--line-divider-primary)",
        "divider-light": "var(--line-divider-secondary)",
        DEFAULT: "var(--line-border-primary)",
        secondary: "var(--line-border-secondary)",
        tertiary: "var(--line-border-tertiary)",
        "dt-hover": "var(--line-border-hover)",
        "dt-error": "var(--line-border-error)",
        "dt-orange": "var(--line-border-orange)",
      },
      colors: {
        // Fill (surface) — bg-fill-input, bg-fill-modal, etc.
        "fill-input": "var(--fill-input1)",
        "fill-input-modal": "var(--fill-input2)",
        "fill-card1": "var(--fill-card1)",
        "fill-card2": "var(--fill-card2)",
        "fill-select": "var(--fill-select)",
        "fill-switch": "var(--fill-switch-switcher)",
        "fill-slider": "var(--fill-slider)",
        "fill-tab-primary": "var(--fill-tab-primary)",
        "fill-tooltip-app": "var(--fill-tooltip-app)",
        "fill-tooltip-web": "var(--fill-tooltip-web)",
        "fill-modal": "var(--fill-modal)",
        "fill-mask": "var(--fill-mask)",
        "fill-dropdown": "var(--fill-dropdown)",
        "fill-hover": "var(--fill-hover-1)",
        "fill-checkbox": "var(--fill-checkbox)",
        "fill-dragger": "var(--fill-dragger)",
        "fill-toast": "var(--fill-toast)",

        // Button states — bg-btn-primary, bg-btn-red, etc.
        "btn-primary": "var(--btn-primary-brand-default)",
        "btn-primary-hover": "var(--btn-primary-brand-hover)",
        "btn-primary-press": "var(--btn-primary-brand-press)",
        "btn-primary-disable": "var(--btn-primary-brand-disable)",
        "btn-primary-white": "var(--btn-primary-white-default)",
        "btn-primary-white-hover": "var(--btn-primary-white-hover)",
        "btn-primary-white-press": "var(--btn-primary-white-press)",
        "btn-primary-white-disable": "var(--btn-primary-white-disable)",
        "btn-secondary": "var(--btn-secondary-btn-default)",
        "btn-secondary-hover": "var(--btn-secondary-btn-hover)",
        "btn-secondary-press": "var(--btn-secondary-btn-press)",
        "btn-tertiary": "var(--btn-tertiary-btn-default)",
        "btn-tertiary-hover": "var(--btn-tertiary-btn-hover)",
        "btn-tertiary-press": "var(--btn-tertiary-btn-press)",
        "btn-red": "var(--btn-red-btn-default)",
        "btn-red-hover": "var(--btn-red-btn-hover)",
        "btn-red-press": "var(--btn-red-btn-press)",
        "btn-red-bg": "var(--btn-red-button-bg-btn)",
        "btn-green": "var(--btn-green-btn-default)",
        "btn-green-hover": "var(--btn-green-btn-hover)",
        "btn-green-press": "var(--btn-green-btn-press)",
        "btn-green-disable": "var(--btn-green-btn-disable)",

        // Tag fills — bg-tag-brand, bg-tag-green, etc.
        "tag-brand": "var(--tag-brand-transparent)",
        "tag-brand-solid": "var(--tag-brand-solid)",
        "tag-green": "var(--tag-green)",
        "tag-red": "var(--tag-red)",
        "tag-gray": "var(--tag-gray)",
        "tag-yellow": "var(--tag-yellow)",
        "tag-orange": "var(--tag-orange)",

        // Function (semantic) — text-fn-brand, bg-fn-green, etc.
        "fn-brand": "var(--fn-brand)",
        "fn-green": "var(--fn-green)",
        "fn-red": "var(--fn-red)",
        "fn-yellow": "var(--fn-yellow)",
        "fn-orange": "var(--fn-orange)",

        // Primitive palette aliases — 按需扩展，CSS 变量由 sync-tokens 自动从 tokens/figma/Primitive.tokens.json 维护
        "yellow-brand-400": "var(--yellow-brand-400)",
        // DD-139 Token 页薄荷色阶（CSS 变量已存在 design-tokens.css:129-138；按钮/品牌语义优先用 brand-default/btn-primary，仅色阶刻度用途用此 primitive）
        "brand2-50": "var(--brand-2-brand-50)",
        "brand2-100": "var(--brand-2-brand-100)",
        "brand2-200": "var(--brand-2-brand-200)",
        "brand2-300": "var(--brand-2-brand-300)",
        "brand2-400": "var(--brand-2-brand-400)",
        "brand2-500": "var(--brand-2-brand-500)",
        "brand2-600": "var(--brand-2-brand-600)",
        "brand2-700": "var(--brand-2-brand-700)",
        "brand2-800": "var(--brand-2-brand-800)",
        "brand2-900": "var(--brand-2-brand-900)",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "SF Pro Text", "system-ui", "sans-serif"],
        orbitron: ["var(--font-orbitron)", "sans-serif"],
        poppins: ["var(--font-poppins)", "sans-serif"],
        "noto-sc": ["var(--font-noto-sc)", "sans-serif"],
        // DD-088 §13 Footer 巨型 ODDFI 水印 — Schibsted Grotesk 项目未加载，暂用 Pilat Extended 替代
        pilat: ["'Pilat Extended'", "sans-serif"],
        // DD-088 §6 StatsSection 大数字 — Figma 指定 Racing Sans One（赛车字体）
        racing: ["var(--font-racing)", "cursive"],
        // DD-088 §11 FaqSection 标题 — Figma 指定 Anton Regular（高浓缩黑体）
        anton: ["var(--font-anton)", "sans-serif"],
      },
      borderRadius: {
        4: "var(--radius-4)",
        8: "var(--radius-8)",
        12: "var(--radius-12)",
        16: "var(--radius-16)",
        24: "var(--radius-24)",
        100: "var(--radius-100)",
      },
      boxShadow: {
        shell: "0 20px 60px rgba(0,0,0,0.55)",
        modal: "0 18px 40px rgba(0,0,0,0.85)",
      },
      animation: {
        "fade-up": "fadeUp 0.9s ease forwards",
        marquee: "marquee 30s linear infinite",
        "marquee-slow": "marquee 60s linear infinite",
        "slide-up": "slideUp 0.25s ease-out",
        "slide-down": "slideDown 0.22s ease-out",
        "dropdown-in": "dropdownIn 0.2s ease-out",
        "dropdown-out": "dropdownOut 0.15s ease-in",
        "slide-in-right": "slideInRight 300ms cubic-bezier(0.4,0,0.2,1) forwards",
        "betcard-enter": "betcardEnter 250ms ease-out both",
        "betcard-exit": "betcardExit 250ms ease-in forwards",
        // 布朗运动 — 4 条慢速漂移轨迹，duration 错开形成无规则视觉
        "drift-1": "drift1 18s ease-in-out infinite",
        "drift-2": "drift2 22s ease-in-out infinite",
        "drift-3": "drift3 16s ease-in-out infinite",
        "drift-4": "drift4 24s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(18px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(40px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          from: { opacity: "0", transform: "translateY(-16px) scale(0.97)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        dropdownIn: {
          from: { opacity: "0", transform: "translateY(-8px) scale(0.96)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        dropdownOut: {
          from: { opacity: "1", transform: "translateY(0) scale(1)" },
          to: { opacity: "0", transform: "translateY(-8px) scale(0.96)" },
        },
        slideInRight: {
          from: { opacity: "0", transform: "translateX(20px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        betcardEnter: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        betcardExit: {
          from: { opacity: "1", transform: "translateY(0)" },
          to: { opacity: "0", transform: "translateY(20px)" },
        },
        // 布朗运动 keyframes — 4 条不同轨迹 + 缩放呼吸
        drift1: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "25%": { transform: "translate(60px, -40px) scale(1.05)" },
          "50%": { transform: "translate(-40px, -60px) scale(0.97)" },
          "75%": { transform: "translate(40px, 40px) scale(1.03)" },
        },
        drift2: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "30%": { transform: "translate(-50px, 30px) scale(1.06)" },
          "60%": { transform: "translate(40px, -50px) scale(0.95)" },
          "85%": { transform: "translate(-20px, 20px) scale(1.02)" },
        },
        drift3: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "20%": { transform: "translate(70px, 20px) scale(1.04)" },
          "55%": { transform: "translate(-30px, -30px) scale(0.98)" },
          "80%": { transform: "translate(20px, 50px) scale(1.05)" },
        },
        drift4: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "35%": { transform: "translate(-60px, -20px) scale(1.05)" },
          "65%": { transform: "translate(30px, 50px) scale(0.96)" },
          "90%": { transform: "translate(-10px, -40px) scale(1.03)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
