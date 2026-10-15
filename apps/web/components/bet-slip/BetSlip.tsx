"use client";

import { memo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { XIcon } from "@phosphor-icons/react";
import SettingsIcon from "@/components/icons/SettingsIcon";
import { useAccount } from "wagmi";
import { useShallow } from "zustand/react/shallow";
import { useBetSlipStore, selectTotalBet, selectActiveTab } from "@/stores/betSlipStore";
import { isGt } from "@/lib/decimal";
import { useCurrencyDisplay } from "@/hooks/useCurrencyDisplay";
import { useAccountBalance } from "@/hooks/useAccountBalance";
import { useDepositSheetStore } from "@/stores/depositSheetStore";
import { useWalletSheetStore } from "@/stores/walletSheetStore";
import { usePendingOnchainBets } from "@/hooks/usePendingOnchainBets";
import MyBetsView from "./MyBetsView";
import BetCard from "./BetCard";
import BetSummary from "./BetSummary";
import BetSettings from "./BetSettings";
import InsufficientFundsWarning from "./InsufficientFundsWarning";
import QuickAmountBar from "./QuickAmountBar";

interface BetSlipProps {
  mobile?: boolean;
  /** H5: close the sheet without clearing selections */
  onClose?: () => void;
}

function BetSlip({ mobile, onClose }: BetSlipProps = {}) {
  // DD-140：乐观链上注单后台跟踪挂在此处（两个 tab 的共同父级），跨 tab 切换不中断（REV-v1-A M-01）
  usePendingOnchainBets();

  const { selections, mode, isSettingsOpen, amounts } = useBetSlipStore(
    useShallow((s) => ({
      selections: s.selections,
      mode: s.mode,
      isSettingsOpen: s.isSettingsOpen,
      amounts: s.amounts,
    }))
  );
  const setAmountStore = useBetSlipStore((s) => s.setAmount);
  const t = useTranslations("betSlip");
  const count = selections.length;
  const setMode = useBetSlipStore((s) => s.setMode);
  const setOpen = useBetSlipStore((s) => s.setOpen);
  const setSettingsOpen = useBetSlipStore((s) => s.setSettingsOpen);
  const totalBet = useBetSlipStore(selectTotalBet);
  const activeTab = useBetSlipStore(selectActiveTab);
  const setActiveTab = useBetSlipStore((s) => s.setActiveTab);
  const { data: accountBalance } = useAccountBalance();
  const availableBalance = accountBalance?.available_balance ?? "0";
  const { canConvert, convert } = useCurrencyDisplay();
  const insufficientFunds =
    isGt(totalBet, "0") &&
    isGt(totalBet, canConvert ? convert(availableBalance) : availableBalance);

  const { isConnected } = useAccount();
  const openDeposit = useDepositSheetStore((s) => s.open);
  const triggerConnect = useWalletSheetStore((s) => s.triggerConnect);

  const handleDeposit = () => {
    onClose?.();
    if (!isConnected) {
      triggerConnect();
    } else {
      openDeposit();
    }
  };

  // Single mode: shared QuickAmountBar — sets amount for all selections
  const sharedAmount =
    count > 0 &&
    selections.every((s) => (amounts[s.id] || "") === (amounts[selections[0].id] || ""))
      ? amounts[selections[0].id] || ""
      : "";
  const handleQuickAmount = useCallback(
    (v: string) => {
      selections.forEach((s) => setAmountStore(s.id, v));
    },
    [selections, setAmountStore]
  );

  return (
    <div
      id={mobile ? undefined : "betslip-panel"}
      className={
        mobile
          ? "flex flex-col gap-[16px] flex-1 min-h-0"
          : "border-4 border-secondary rounded-16 px-[16px] py-[24px] flex flex-col gap-[16px] h-full overflow-hidden"
      }
    >
      {isSettingsOpen ? (
        <BetSettings />
      ) : (
        <>
          {/* Header — Figma 842:64722: 18px bold, no Orbitron */}
          <div className="flex items-center justify-between">
            {/* Left: title tabs */}
            <div className={`flex items-center ${mobile ? "gap-[16px]" : "gap-[24px]"}`}>
              <button
                type="button"
                onClick={() => setActiveTab("betslip")}
                className={
                  mobile
                    ? `${activeTab === "betslip" ? "text-primary" : "text-secondary"} text-[16px] leading-[24px] font-bold cursor-pointer`
                    : `${activeTab === "betslip" ? "text-primary" : "text-secondary"} text-[18px] leading-[26px] font-bold cursor-pointer`
                }
              >
                {t("title")}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("mybets")}
                className={
                  mobile
                    ? `${activeTab === "mybets" ? "text-primary" : "text-secondary"} text-[16px] leading-[24px] font-bold cursor-pointer`
                    : `${activeTab === "mybets" ? "text-primary" : "text-secondary"} text-[18px] leading-[26px] font-bold cursor-pointer`
                }
              >
                {t("myBets")}
              </button>
            </div>

            {/* Right: action icons — settings + close per Figma (trash moved to bottom) */}
            <div className="flex items-center gap-[12px]">
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                aria-label="Settings"
                className="min-h-[44px] flex items-center justify-center"
              >
                <SettingsIcon size={20} className="text-primary" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onClose) {
                    onClose();
                  } else {
                    setOpen(false);
                  }
                }}
                aria-label="Close panel"
                className="min-h-[44px] flex items-center justify-center"
              >
                <XIcon size={20} className="text-primary" />
              </button>
            </div>
          </div>

          {activeTab === "mybets" ? (
            <MyBetsView mobile={mobile} />
          ) : (
            <>
              {/* Mode Toggle + Available Balance row — H5: justify-between per Figma 862:49741 */}
              <div className={mobile ? "flex items-center justify-between w-full" : ""}>
                <div
                  className={`${mobile ? "bg-secondary border border-secondary" : "bg-fill-input"} p-[4px] rounded-full flex items-start ${mobile ? "" : "self-start"}`}
                >
                  <button
                    type="button"
                    className={`h-[32px] ${mobile ? "px-[12px]" : "px-[16px]"} py-[8px] rounded-full ${mobile ? "text-[12px] leading-[18px]" : "text-[14px] leading-[19px]"} font-semibold transition-colors flex items-center justify-center gap-[6px]
                    ${
                      mode === "single"
                        ? "bg-tag-brand border border-dt-hover text-brand-default"
                        : "text-secondary"
                    }`}
                    onClick={() => setMode("single")}
                  >
                    {t("single")}
                    {count > 0 && (
                      <span
                        id={mobile ? undefined : "betslip-multi-badge"}
                        className="bg-fn-brand w-[14px] rounded-full flex items-center justify-center text-[12px] leading-[18px] text-static-black px-[2px]"
                      >
                        {count}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    className={`h-[32px] ${mobile ? "px-[12px]" : "px-[16px]"} py-[8px] rounded-full ${mobile ? "text-[12px] leading-[18px]" : "text-[14px] leading-[19px]"} font-semibold transition-colors flex items-center justify-center
                    ${
                      mode === "multi"
                        ? "bg-tag-brand border border-dt-hover text-brand-default"
                        : "text-secondary"
                    }`}
                    onClick={() => setMode("multi")}
                  >
                    {t("multi")}
                  </button>
                </div>
                {/* Available Balance moved to BetSummary bottom area for H5 */}
              </div>

              {/* Insufficient funds warning — below mode toggle per Figma */}
              {insufficientFunds && (
                <InsufficientFundsWarning onRequestClose={mobile ? onClose : undefined} />
              )}

              {/* H5: three-section — fixed header/toggle above, scrollable cards middle, fixed summary bottom */}
              {mobile ? (
                <>
                  {/* Scrollable bet cards — flex-1 so it fills space between fixed top and fixed bottom */}
                  <div
                    data-scroll-content
                    className="flex-1 overflow-y-auto min-h-0 overscroll-contain flex flex-col gap-[12px]"
                  >
                    {count === 0 ? (
                      <div className="flex flex-col items-center justify-center text-center py-[40px]">
                        <p className="text-secondary text-[14px]">{t("noSelections")}</p>
                        <p className="text-tertiary text-[12px] mt-[4px]">
                          {t("noSelectionsHint")}
                        </p>
                      </div>
                    ) : (
                      selections.map((sel) => (
                        <BetCard
                          key={sel.id}
                          selection={sel}
                          showAmountInput={mode === "single"}
                          mobile={mobile}
                        />
                      ))
                    )}
                  </div>

                  {/* Fixed bottom: QuickAmountBar + BetSummary */}
                  {count > 0 && (
                    <div className="flex-shrink-0 flex flex-col gap-[12px] pt-[12px] border-t border-divider">
                      {mode === "single" && (
                        <QuickAmountBar
                          currentAmount={sharedAmount}
                          onSelect={handleQuickAmount}
                          mobile
                        />
                      )}
                      <BetSummary
                        mobile={mobile}
                        insufficientFunds={insufficientFunds}
                        onRequestClose={onClose}
                        onDeposit={handleDeposit}
                      />
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Scrollable card area — QuickAmountBar lives here so it follows the last card */}
                  <div
                    id="betslip-cards-scroll"
                    className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-[16px] scroll-pb-[52px]"
                  >
                    {count === 0 ? (
                      <div className="flex flex-col items-center justify-center flex-1 text-center py-[40px]">
                        <p className="text-secondary text-[14px]">{t("noSelections")}</p>
                        <p className="text-tertiary text-[12px] mt-[4px]">
                          {t("noSelectionsHint")}
                        </p>
                      </div>
                    ) : (
                      <>
                        {selections.map((sel) => (
                          <BetCard
                            key={sel.id}
                            selection={sel}
                            showAmountInput={mode === "single"}
                          />
                        ))}
                        {mode === "single" && (
                          <div className="sticky bottom-0 bg-primary border-t border-divider pt-[12px]">
                            <QuickAmountBar
                              currentAmount={sharedAmount}
                              onSelect={handleQuickAmount}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Fixed bottom: Summary info + Buttons */}
                  {count > 0 && (
                    <div className="flex-shrink-0 flex flex-col gap-[16px]">
                      <BetSummary insufficientFunds={insufficientFunds} onDeposit={handleDeposit} />
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default memo(BetSlip);
