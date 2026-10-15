"use client";

import { useCallback } from "react";
import type { BetSelection } from "@/types/betting";
import { useBetSlipStore } from "@/stores/betSlipStore";
import {
  flashOddsBtn,
  isRapidAdd,
  shakeFab,
  shrinkFab,
  flyChipToFab,
} from "@/lib/betslip-animations";
import {
  flashOddsBtn as flashOddsBtnPc,
  isPcRapidAdd,
  shakePanel,
  flyChipToPanel,
  scrollToNewest,
} from "@/lib/betslip-animations-pc";

/**
 * 公共 Bet 点击执行器：负责"选中切换 + 飞行筹码 + 闪/抖反馈" 的复用。
 *
 * 两种语义：
 *  - "toggle"：再点同一项移除（markets / match-detail 用）
 *  - "add"   ：再点同一项依然只触发飞行动画，不会移除（banner detail 用，因为 banner 走独立 placeBannerBet）
 *
 * Hook 形态见 `useBetSelectionToggle`；imperative 形态见 `runBetClick`。
 */
export type BetSelectionMode = "toggle" | "add";

export function runBetClick(
  e: React.MouseEvent,
  sel: BetSelection,
  mode: BetSelectionMode = "toggle",
  /** 赛事级禁投开关（DD-087 §4.1）；false 时 store.addSelection 会拒绝并 toast */
  enableBet = true
): void {
  e.stopPropagation();
  const btn = e.currentTarget as HTMLElement;
  const store = useBetSlipStore.getState();
  const already = store.selections.some((s) => s.id === sel.id);
  const isH5 = window.matchMedia("(max-width: 1023px)").matches;

  // toggle 模式 + 已选 → 直接移除（add 模式不走此路；禁投时也允许移除）
  if (mode === "toggle" && already) {
    store.toggleSelection(sel, enableBet);
    if (isH5) shrinkFab();
    return;
  }

  if (isH5) {
    flashOddsBtn(btn);
    if (mode === "add") store.addSelection(sel, enableBet);
    else store.toggleSelection(sel, enableBet);
    if (isRapidAdd()) shakeFab();
    else flyChipToFab(btn, sel.odds);
  } else {
    flashOddsBtnPc(btn);
    if (mode === "add") store.addSelection(sel, enableBet);
    else store.toggleSelection(sel, enableBet);
    if (isPcRapidAdd()) shakePanel();
    else flyChipToPanel(btn, sel.odds);
    scrollToNewest();
  }
}

export function useBetSelectionToggle(mode: BetSelectionMode = "toggle") {
  return useCallback((e: React.MouseEvent, sel: BetSelection) => runBetClick(e, sel, mode), [mode]);
}
