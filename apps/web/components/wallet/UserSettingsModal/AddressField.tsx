"use client";

import { useTranslations } from "next-intl";
import { CheckIcon } from "@phosphor-icons/react";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

interface AddressFieldProps {
  address: string;
}

export default function AddressField({ address }: AddressFieldProps) {
  const t = useTranslations("userSettings");
  const { copied, copy } = useCopyToClipboard();

  return (
    <div className="flex flex-col gap-3 w-full">
      <span className="text-[14px] leading-[18px] text-secondary">{t("address")}</span>
      <div className="flex items-center justify-between h-[48px] px-3 rounded-8 bg-fill-input-modal">
        <input
          type="text"
          readOnly
          value={address}
          className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[12px] leading-[18px] font-medium text-secondary cursor-text select-all"
        />
        <button
          type="button"
          onClick={() => void copy(address)}
          aria-label={copied ? t("copied") : t("copy")}
          className="shrink-0 ml-2 flex items-center gap-1 text-[12px] leading-[18px] font-medium text-brand-default cursor-pointer touch-manipulation border-0 bg-transparent p-0 min-h-[24px]"
        >
          {copied ? <CheckIcon size={14} weight="bold" /> : <span>{t("copy")}</span>}
        </button>
      </div>
      <p className="text-[12px] leading-[18px] text-tertiary">{t("addressHint")}</p>
    </div>
  );
}
