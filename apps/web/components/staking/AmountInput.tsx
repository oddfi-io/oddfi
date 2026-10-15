// [TEMP:staking] Temporary — will be replaced when backend staking API is ready
"use client";

import { useTranslations } from "next-intl";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import { formatOfi } from "./calc";

interface AmountInputProps {
  value: string;
  onChange: (val: string) => void;
  balance: string;
  onMax: () => void;
}

export default function AmountInput({ value, onChange, balance, onMax }: AmountInputProps) {
  const t = useTranslations("staking");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // 只允许数字和单个小数点
    if (/^\d*\.?\d*$/.test(raw)) {
      onChange(raw);
    }
  };

  return (
    <div className="flex flex-col gap-[12px]">
      {/* 标签行：Amount + Available 余额 */}
      <div className="flex items-center justify-between">
        <label className="text-[14px] text-secondary">{t("amount")}</label>
        <span className="hidden md:inline text-[12px] text-secondary">
          {t("available")}{" "}
          <span className="font-bold text-primary">
            {formatOfi(balance)} {PLATFORM_TOKEN_DISPLAY}
          </span>
        </span>
      </div>

      {/* 输入框 */}
      <div className="flex items-center bg-fill-input-modal h-[48px] rounded-8 px-[12px] md:px-[16px] gap-[8px]">
        <input
          type="text"
          inputMode="decimal"
          placeholder={t("inputAmount")}
          value={value}
          onChange={handleChange}
          className="flex-1 bg-transparent text-[14px] text-primary placeholder:text-tertiary focus:outline-none"
        />
        {/* 币种标识 */}
        <span className="text-[14px] font-medium text-primary shrink-0">
          {PLATFORM_TOKEN_DISPLAY}
        </span>
        {/* MAX 按钮 */}
        <button
          type="button"
          onClick={onMax}
          style={{ touchAction: "manipulation" }}
          className="text-[14px] font-medium text-brand-default shrink-0 min-h-[44px] px-[4px]"
        >
          {t("max")}
        </button>
      </div>
    </div>
  );
}
