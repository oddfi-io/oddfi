"use client";

import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InfoIcon } from "@phosphor-icons/react";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";
import MobileBottomSheet from "@/components/ui/MobileBottomSheet";
import Modal from "@/components/ui/Modal";
import TeamAvatarPair from "@/components/lending/TeamAvatarPair";
import { repayBorrow } from "@/lib/api";
import { IS_SUBSCRIPTION_MODE } from "@/lib/subscription-mode";
import { useCurrencyDisplay } from "@/hooks/useCurrencyDisplay";
import type { ActiveBorrow } from "@/types/lending";

// ─── RepayDrawer ──────────────────────────────────────────────────────────────
// H5: MobileBottomSheet bottom drawer
// PC: centered Modal dialog
// Content: Repayment Details — auto-deducted on settlement, no manual action needed

interface RepayDrawerProps {
  open: boolean;
  onClose: () => void;
  borrow: ActiveBorrow;
}

// ── InfoCard ── shared info notice block
function InfoCard({ text }: { text: string }) {
  return (
    <div className="bg-fill-card2 flex gap-[8px] items-start p-[12px] rounded-8 w-full">
      <InfoIcon size={20} weight="regular" className="text-primary shrink-0 mt-[1px]" />
      <p className="flex-1 text-[12px] text-primary leading-[18px]">{text}</p>
    </div>
  );
}

// ── DetailRow ── label / value pair
function DetailRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between w-full">
      <span className="text-[14px] text-tertiary leading-[19px]">{label}</span>
      <span
        className={`text-[14px] font-medium leading-[19px] text-right ${valueClass ?? "text-primary"}`}
      >
        {value}
      </span>
    </div>
  );
}

// ── RepayContent ── shared content for both H5 and PC
function RepayContent({
  borrow,
  isPending,
  onConfirm,
}: {
  borrow: ActiveBorrow;
  isPending: boolean;
  onConfirm: () => void;
}) {
  const t = useTranslations("lending");
  const { format } = useCurrencyDisplay();
  const isActive = borrow.status === "active";

  const statusColor = isActive ? "text-fn-green" : "text-brand-default";
  const statusLabel = isActive ? t("statusActive") : t("principalFrozen");

  const infoText = isActive ? t("noManualRepay") : t("profitCredited");

  const buttonLabel = isActive ? t("confirmRepay") : t("awaitingSettlement");

  return (
    <div className="flex flex-col gap-[24px] w-full">
      {/* ── Header: team avatar + match title ── */}
      <div className="flex flex-col gap-[16px] w-full">
        <div className="flex flex-col gap-[20px] w-full">
          {/* Match row */}
          <div className="flex gap-[8px] items-center w-full">
            <TeamAvatarPair
              homeTeamLogo={borrow.homeTeamLogo}
              awayTeamLogo={borrow.awayTeamLogo}
              size={36}
            />
            <div className="flex flex-col gap-[2px] flex-1 min-w-0">
              <span className="text-[14px] text-secondary leading-[19px]">
                {isActive ? t("collateralPosition") : t("creditBet")}
              </span>
              <span className="text-[16px] font-bold text-primary leading-[24px] truncate">
                {borrow.matchTitle}
              </span>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex gap-[12px] items-start w-full">
            {isActive ? (
              <>
                {/* Active: Bet Principal + Earned So Far */}
                <div className="flex flex-col gap-[4px] flex-1 min-w-0">
                  <span className="text-[12px] text-secondary leading-[18px]">
                    {t("betPrincipal")}
                  </span>
                  <span className="text-[14px] font-semibold text-primary leading-[19px]">
                    {format(String(borrow.borrowedAmount))}
                  </span>
                </div>
                <div className="flex flex-col gap-[4px] flex-1 min-w-0">
                  <span className="text-[12px] text-secondary leading-[18px]">
                    {t("earnedSoFar")}
                  </span>
                  <span className="text-[14px] font-semibold text-fn-green leading-[19px]">
                    {borrow.netProfit !== undefined ? format(String(borrow.netProfit)) : "—"}
                  </span>
                </div>
              </>
            ) : (
              <>
                {/* Principal Frozen: Borrowed Amount + Potential Return */}
                <div className="flex flex-col gap-[4px] flex-1 min-w-0">
                  <span className="text-[12px] text-secondary leading-[18px]">
                    {t("borrowedAmount")}
                  </span>
                  <span className="text-[16px] font-bold text-primary leading-[24px]">
                    {format(String(borrow.borrowedAmount))}
                  </span>
                </div>
                <div className="flex flex-col gap-[4px] flex-1 min-w-0">
                  <span className="text-[12px] text-secondary leading-[18px]">
                    {t("potentialReturnLabel")}
                  </span>
                  <span className="text-[16px] font-bold text-fn-green leading-[24px]">
                    {borrow.potentialReturn !== undefined && borrow.times !== undefined
                      ? `${format(String(borrow.potentialReturn))} (${borrow.times}×)`
                      : "—"}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="w-full h-px" style={{ background: "var(--line-border-secondary)" }} />
      </div>

      {/* ── Details rows ── */}
      <div className="flex flex-col gap-[12px] w-full">
        <DetailRow label={t("collateralBet")} value={borrow.collateralInfo} />
        <DetailRow
          label={isActive ? t("creditExpires") : t("repayment")}
          value={t("autoDeducted")}
        />
        <DetailRow
          label={t("status")}
          value={statusLabel}
          valueClass={`font-medium ${statusColor}`}
        />
      </div>

      {/* ── Info notice ── */}
      <InfoCard text={infoText} />

      {/* ── Action button — DD-113 认购模式强制 disabled ── */}
      <button
        onClick={isActive && !isPending && !IS_SUBSCRIPTION_MODE ? onConfirm : undefined}
        disabled={!isActive || isPending || IS_SUBSCRIPTION_MODE}
        className="w-full h-[48px] rounded-12 flex items-center justify-center
                   bg-btn-primary-white text-static-black text-[14px] font-medium leading-[19px]
                   shadow-[0px_1px_2px_0px_rgba(0,0,0,0.10)]
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-opacity"
        style={{ touchAction: "manipulation" }}
        aria-label={buttonLabel}
      >
        {isPending ? t("confirming") : buttonLabel}
      </button>
    </div>
  );
}

// ── RepayDrawer ──
export default function RepayDrawer({ open, onClose, borrow }: RepayDrawerProps) {
  const t = useTranslations("lending");
  const mode = useResponsiveMode();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => repayBorrow(borrow.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lending", "borrows"] });
      onClose();
    },
    onError: (error) => {
      console.error("[RepayDrawer] Failed to repay borrow —", error);
    },
  });

  const content = (
    <RepayContent
      borrow={borrow}
      isPending={mutation.isPending}
      onConfirm={() => mutation.mutate()}
    />
  );

  if (mode === "h5") {
    return (
      <MobileBottomSheet
        open={open}
        onClose={onClose}
        title={t("repaymentDetails")}
        showCloseButton
        zIndex={70}
      >
        <div className="px-[16px] pb-[env(safe-area-inset-bottom)] pt-[8px]" data-scroll-content>
          {content}
        </div>
      </MobileBottomSheet>
    );
  }

  // PC: centered Modal
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={t("repaymentDetails")}
      showCloseButton
      className="w-[440px]"
    >
      {content}
    </Modal>
  );
}
