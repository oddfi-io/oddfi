"use client";

import { useNetworkGuard } from "@/hooks/useNetworkGuard";

/**
 * Wrong-network indicator banner with manual switch button.
 *
 * Chain auto-switch during login is handled by useAuth.performLogin
 * (switches BEFORE the signing popup). This banner serves as a
 * fallback UI for post-login chain changes — no auto-switch here
 * to avoid racing with useAuth.
 */
export function WrongNetworkBanner() {
  const { isWrongNetwork, switchToCore, isSwitching, switchError } = useNetworkGuard();

  if (!isWrongNetwork) return null;

  return (
    <div className="sticky top-14 z-20 flex items-center justify-center gap-3 px-4 h-11 bg-orange-400/10 border-b border-orange-500/30">
      <span className="text-orange-400 text-[13px] whitespace-nowrap">
        ⚠ Please switch to a supported network.
      </span>

      <button
        onClick={switchToCore}
        disabled={isSwitching}
        className={`flex items-center flex-shrink-0 min-h-[44px] px-3 rounded-full border border-orange-500/50 bg-orange-500/20 font-semibold text-xs text-orange-400 whitespace-nowrap touch-manipulation ${isSwitching ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
      >
        {isSwitching ? "Switching..." : switchError ? "Retry" : "Switch network →"}
      </button>
    </div>
  );
}
