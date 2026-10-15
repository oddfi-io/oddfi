"use client";

import { memo, useState, useEffect, useRef } from "react";
import { useBetSlipStore, selectSelectionCount } from "@/stores/betSlipStore";
import { useMobileMenuStore, selectMobileMenuOpen } from "@/stores/mobileMenuStore";
import { useWalletSheetStore, selectWalletSheetOpen } from "@/stores/walletSheetStore";
import MobileBetSlipSheet from "./MobileBetSlipSheet";

// ─── Badge Roller (vertical scroll counter) ─────────────────────────────────

function BadgeRoller({ count }: { count: number }) {
  const [displayCount, setDisplayCount] = useState(count);
  const [prevDisplay, setPrevDisplay] = useState(count);
  const [direction, setDirection] = useState<"up" | "down">("up");
  const [animating, setAnimating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (count === displayCount) return;

    // Clear pending cleanup
    if (timerRef.current) clearTimeout(timerRef.current);

    setDirection(count > displayCount ? "up" : "down");
    setPrevDisplay(displayCount);
    setDisplayCount(count);
    setAnimating(true);

    // Cleanup after transition (300ms + buffer)
    timerRef.current = setTimeout(() => setAnimating(false), 350);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [count, displayCount]);

  // Going up: [old] [new], translateY 0 → -14
  // Going down: [new] [old], translateY -14 → 0
  const goingUp = direction === "up";

  return (
    <div className="w-[14px] h-[14px] overflow-hidden text-center">
      <div
        className="flex flex-col items-center"
        style={{
          transition: animating ? "transform 300ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
          transform: animating
            ? goingUp
              ? "translateY(-14px)"
              : "translateY(0)"
            : "translateY(0)",
        }}
      >
        {goingUp ? (
          <>
            <span className="h-[14px] flex items-center justify-center shrink-0">
              {animating ? prevDisplay : displayCount}
            </span>
            <span className="h-[14px] flex items-center justify-center shrink-0">
              {displayCount}
            </span>
          </>
        ) : (
          <>
            <span className="h-[14px] flex items-center justify-center shrink-0">
              {displayCount}
            </span>
            <span className="h-[14px] flex items-center justify-center shrink-0">
              {animating ? prevDisplay : displayCount}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── BetSlip FAB (Figma 864:53765) ──────────────────────────────────────────
// H5: pill 形态，居中固定底部，icon(-90° ticket + count) + "Betslip" 文字
// PC: 不显示（PC 用 BetSlipPanel 侧面板）
// 当 H5 用户菜单打开时隐藏
// Always-rendered for animation targets — visibility via CSS transition

function MobileBetSlipFAB() {
  const count = useBetSlipStore(selectSelectionCount);
  const mobileMenuOpen = useMobileMenuStore(selectMobileMenuOpen);
  const walletSheetOpen = useWalletSheetStore(selectWalletSheetOpen);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Track if ever shown to prevent entry animation on first mount
  const hasShownRef = useRef(false);

  const isVisible = count > 0 && !mobileMenuOpen && !walletSheetOpen;

  useEffect(() => {
    if (isVisible) hasShownRef.current = true;
  }, [isVisible]);

  return (
    <>
      <button
        id="betslip-fab"
        type="button"
        onClick={() => setSheetOpen(true)}
        className={`fixed bottom-[23px] left-1/2 -translate-x-1/2 z-[63] lg:hidden
          px-[12px] py-[9px] rounded-100
          backdrop-blur-[2.5px] bg-secondary border border-dt-hover text-brand-default
          flex items-center justify-center gap-[4px]
          active:scale-95
          transition-all duration-[350ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]
          ${
            isVisible
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 translate-y-[80px] pointer-events-none"
          }`}
      >
        {/* Icon: ticket shape with count inside (Figma 3474:81024) */}
        <div className="relative w-[20px] h-[20px] -rotate-90 shrink-0">
          {/* Ticket vector — inset 10%/5% per Figma, fill follows currentColor (brand mint) */}
          <div className="absolute inset-[10%_5%]">
            <svg
              viewBox="0 0 18 16"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              className="block w-full h-full"
              aria-hidden="true"
            >
              <path d="M0.823737 5.88989C0.401762 5.45044 0 4.92474 0 4.31549V1.5C0 0.671571 0.671573 0 1.5 0H16.5C17.3284 0 18 0.671573 18 1.5V4.3155C18 4.92474 17.5982 5.45044 17.1763 5.88989C16.6773 6.40949 16.3636 7.16238 16.3636 8C16.3636 8.83762 16.6773 9.59051 17.1763 10.1101C17.5982 10.5496 18 11.0753 18 11.6845V14.5C18 15.3284 17.3284 16 16.5 16H1.5C0.671573 16 0 15.3284 0 14.5V11.6845C0 11.0753 0.401763 10.5496 0.823737 10.1101C1.32267 9.59051 1.63636 8.83761 1.63636 8C1.63636 7.16239 1.32267 6.40949 0.823737 5.88989Z" />
            </svg>
          </div>
          {/* Count — centered on icon, rotate-90 to counter parent -90 */}
          <div id="betslip-fab-badge" className="absolute inset-0 flex items-center justify-center">
            <div className="rotate-90 text-[12px] font-bold text-static-black leading-none">
              <BadgeRoller count={count} />
            </div>
          </div>
        </div>
        <span className="text-[12px] font-medium leading-[18px] whitespace-nowrap">Betslip</span>
      </button>

      <MobileBetSlipSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}

export default memo(MobileBetSlipFAB);
