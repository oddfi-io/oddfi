"use client";

import { useTranslations } from "next-intl";
import { validateUsername, type UsernameErrorCode } from "@/lib/username-validation";

interface UsernameFieldProps {
  value: string;
  onChange: (value: string) => void;
  error: UsernameErrorCode | null;
  onBlur?: () => void;
}

export default function UsernameField({ value, onChange, error, onBlur }: UsernameFieldProps) {
  const t = useTranslations("userSettings");
  const hasError = error !== null;

  return (
    <div className="flex flex-col gap-3 w-full">
      <label htmlFor="user-settings-username" className="text-[14px] leading-[18px] text-secondary">
        {t("username")}
      </label>
      <div
        className={`flex items-center h-[48px] px-3 rounded-8 bg-fill-input-modal ${
          hasError ? "border border-dt-error" : ""
        }`}
      >
        <input
          id="user-settings-username"
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={value}
          placeholder={t("usernamePlaceholder")}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="w-full bg-transparent border-0 outline-none text-[14px] leading-[18px] text-primary placeholder:text-secondary"
        />
      </div>
      {hasError && <p className="text-[12px] leading-[18px] text-red">{t(`errors.${error}`)}</p>}
    </div>
  );
}

export { validateUsername };
