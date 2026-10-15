"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

interface AgentNameInputProps {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  /**
   * "pc"（默认）= label 16/24 + gap-16；
   * "h5" = DD-135 设置页（Figma 7973:128831）：label 14/18 Medium + gap-12。
   */
  variant?: "pc" | "h5";
}

/**
 * 「昵称」输入（DD-106 Step1 · Figma 6455:123056 / 123058）。
 * bg #212124 (fill-input-modal) + rounded-8 + h-48 + 14 regular text。
 */
export function AgentNameInput({
  value,
  onChange,
  maxLength = 20,
  variant = "pc",
}: AgentNameInputProps) {
  const t = useTranslations("aiAgent.wizard.step1");
  const h5 = variant === "h5";
  return (
    <div className={cn("flex flex-col", h5 ? "gap-3" : "gap-4")}>
      <label
        className={cn(
          "block font-medium text-primary",
          h5 ? "text-[14px] leading-[18px]" : "text-base leading-6"
        )}
      >
        {t("nicknameLabel")}
      </label>
      <div className="relative">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
          maxLength={maxLength}
          placeholder={t("nicknamePlaceholder")}
          className="block h-12 w-full rounded-lg border-0 bg-fill-input-modal px-3 pr-14 text-sm font-normal leading-[18px] text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-dt-hover"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-tertiary">
          {value.length}/{maxLength}
        </span>
      </div>
    </div>
  );
}
