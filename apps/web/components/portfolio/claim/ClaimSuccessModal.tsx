"use client";

import { memo } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import Modal from "@/components/ui/Modal";
import ConfettiBurst from "./ConfettiBurst";

// ─── ClaimSuccessModal ──────────────────────────────────────────────────────
// Figma 2009:98553 — "Transaction sent successfully" 弹窗
// 80px success icon + title + 描述 + 全宽 OK 按钮

const MODAL_CLASS = "!border-[#37393a] !backdrop-blur-none";
const MODAL_STYLE: React.CSSProperties = {
  background: "#111114",
  paddingBottom: "0",
};

interface ClaimSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function ClaimSuccessModal({ isOpen, onClose }: ClaimSuccessModalProps) {
  const t = useTranslations("portfolio");

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      hideHeader
      className={MODAL_CLASS}
      containerStyle={MODAL_STYLE}
    >
      <ConfettiBurst trigger={isOpen} />
      {/* 抵消 Modal 的 px-4/md:px-10 + pt-6，再叠 Figma 的 p-[40px] gap-24 */}
      <div className="relative -mx-4 md:-mx-10 -mt-6 p-[40px] flex flex-col items-center gap-[24px]">
        {/* Success icon — Figma 2009:98556 80x80 */}
        <Image
          src="/images/status/success.png"
          alt=""
          width={80}
          height={80}
          sizes="80px"
          className="object-contain"
        />

        {/* Title + description — Figma 2009:98557 */}
        <div className="flex flex-col items-center gap-[12px]">
          <h2 className="text-[18px] font-semibold text-primary leading-[26px] text-center">
            {t("txSuccessTitle")}
          </h2>
          <p className="text-[14px] text-tertiary leading-[19px] text-center">
            {t("txSuccessDesc")}
          </p>
        </div>

        {/* OK button — Figma 2009:98565 */}
        <button
          onClick={onClose}
          className="w-full h-[48px] rounded-12 bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] min-h-[44px] touch-manipulation"
        >
          {/* @figma-hardcoded: #04060c static-black — pending design token */}
          <span className="text-[14px] font-medium text-[#04060c] leading-[19px]">
            {t("gotIt")}
          </span>
        </button>
      </div>
    </Modal>
  );
}

export default memo(ClaimSuccessModal);
