"use client";

import { useShallow } from "zustand/react/shallow";
import { useDepositSheetStore } from "@/stores/depositSheetStore";
import { DepositModal } from "./DepositModal";

/**
 * Global deposit modal renderer — lives at layout level so it survives
 * BetSlip sheet close/unmount. State is driven by depositSheetStore.
 */
export default function GlobalDepositSheet() {
  const {
    isOpen,
    step,
    selectedAsset,
    usdAmount,
    txResult,
    close,
    goNext,
    goBack,
    setStep,
    selectAsset,
    setUsdAmount,
    setTxResult,
  } = useDepositSheetStore(
    useShallow((s) => ({
      isOpen: s.isOpen,
      step: s.step,
      selectedAsset: s.selectedAsset,
      usdAmount: s.usdAmount,
      txResult: s.txResult,
      close: s.close,
      goNext: s.goNext,
      goBack: s.goBack,
      setStep: s.setStep,
      selectAsset: s.selectAsset,
      setUsdAmount: s.setUsdAmount,
      setTxResult: s.setTxResult,
    }))
  );

  return (
    <DepositModal
      isOpen={isOpen}
      onClose={close}
      step={step}
      selectedAsset={selectedAsset}
      usdAmount={usdAmount}
      txResult={txResult}
      onGoNext={goNext}
      onGoBack={goBack}
      onSetStep={setStep}
      onSelectAsset={selectAsset}
      onSetUsdAmount={setUsdAmount}
      onSetTxResult={setTxResult}
    />
  );
}
