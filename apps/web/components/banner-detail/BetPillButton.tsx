"use client";

interface Props {
  /** 点击回调（父组件 add(selection) → betSlipStore）。MouseEvent 透传给 useBetSelectionToggle 起飞行筹码。 */
  onClick: (e: React.MouseEvent) => void;
  /** 可选 a11y label，默认 "Place bet" */
  ariaLabel?: string;
  /**
   * 尺寸：
   * - "md" (默认 · PC) — 72×32 / 12px Bold（Figma 3550:71945）
   * - "sm" (H5)        — padding-driven px-3 py-[3px] / 11px Bold（Figma 3646:135980 内 Bet pill）
   */
  size?: "sm" | "md";
}

/**
 * BetPillButton：banner detail 页统一 Bet 按钮（DD-085 §3.5 决策 #12 · DD-086 §3.4 #1）
 *
 * Figma 节点群：
 *  - CountryOddsCard PC  [I3550:73361;3550:71945] (md)
 *  - CountryOddsCard H5  [3646:135980 内 bet pill] (sm)
 *  - PlayerOddsCard PC   [3606:13492 → bet pill] (md)
 *  - ScrollSelectorBetForm [3638:12289] (md)
 *
 * 视觉：bg=var(--text-brand-default) #28f4d2 teal，rounded-pill 50px，
 *      text=#060724 font-bold（@figma-hardcoded — pending btn-primary-fg token）。
 *
 * 注：bg 用 CSS 变量而非 Tailwind 类 `bg-brand-default`（项目仅注册 textColor，
 *      没有同名 backgroundColor，用类会渲染透明 — 这是抽公共组件的根本动机）。
 */
export default function BetPillButton({ onClick, ariaLabel = "Place bet", size = "md" }: Props) {
  const sizeClass =
    size === "sm"
      ? "px-3 py-[3px] text-[11px] leading-[1.8]"
      : "h-8 w-[72px] text-[12px] leading-[1.8]";
  return (
    <button
      type="button"
      onClick={(e) => onClick(e)}
      aria-label={ariaLabel}
      className={`flex shrink-0 items-center justify-center rounded-[50px] font-bold transition-opacity hover:opacity-90 active:opacity-80 ${sizeClass}`}
      style={{
        backgroundColor: "var(--text-brand-default)",
        // @figma-hardcoded: #060724 Bet-pill-fg — pending design token
        color: "#060724",
        touchAction: "manipulation",
      }}
    >
      Bet
    </button>
  );
}
