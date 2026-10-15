"use client";

import { memo, useEffect } from "react";
import { useBetSlipStore, selectSelectionCount } from "@/stores/betSlipStore";
import MobileBottomSheet from "@/components/ui/MobileBottomSheet";
import BetSlip from "./BetSlip";

// ─── MobileBetSlipSheet (Figma 816:64551 / 862:52719 / 862:49732) ───────────
// H5 Bottom Sheet wrapper for BetSlip. Internal <BetSlip /> is shared with PC.

interface MobileBetSlipSheetProps {
  open: boolean;
  onClose: () => void;
}

function MobileBetSlipSheet({ open, onClose }: MobileBetSlipSheetProps) {
  const count = useBetSlipStore(selectSelectionCount);
  const activeTab = useBetSlipStore((s) => s.activeTab);
  const setSettingsOpen = useBetSlipStore((s) => s.setSettingsOpen);

  // Auto-close when all selections removed (only in betslip tab).
  // setTimeout(0) defers the check by one event-loop tick so that any
  // synchronous setActiveTab("mybets") called in the same flush (e.g. after
  // a successful bet) lands in the store before we decide to close.
  useEffect(() => {
    if (!open || count !== 0 || activeTab !== "betslip") return;
    const id = setTimeout(() => {
      if (useBetSlipStore.getState().activeTab === "betslip") onClose();
    }, 0);
    return () => clearTimeout(id);
  }, [count, open, onClose, activeTab]);

  // Reset to bet slip view (not settings) when sheet closes
  useEffect(() => {
    if (!open) setSettingsOpen(false);
  }, [open, setSettingsOpen]);

  return (
    <MobileBottomSheet open={open} onClose={onClose} zIndex={65}>
      {/* Three-section layout: fixed header + scrollable cards + fixed footer */}
      <div className="flex flex-col flex-1 overflow-hidden max-h-[85vh] px-[16px] pt-[18px] pb-[24px]">
        <BetSlip mobile onClose={onClose} />
      </div>
    </MobileBottomSheet>
  );
}

export default memo(MobileBetSlipSheet);
