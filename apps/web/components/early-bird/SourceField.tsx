"use client";

import { useState, type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import { useTranslations } from "next-intl";
import CaretDownIcon from "@/components/icons/CaretDownIcon";
import { XIcon } from "@phosphor-icons/react";

export const SOURCE_OPTIONS = ["telegram", "x", "discord", "friends", "kol", "other"] as const;
export type SourceOption = (typeof SOURCE_OPTIONS)[number];

interface SourceFieldProps {
  value: SourceOption | "";
  onChange: (v: SourceOption | "") => void;
  other: string;
  onOtherChange: (v: string) => void;
  label: ReactNode;
  hint: ReactNode;
  required?: boolean;
}

/**
 * SourceField — DD-103 早鸟登记「How did you hear about Oddfi?」字段。
 *
 * 按 Figma 6086:4441 + 6089:58462 实现：
 * - Trigger 48h 显示当前选项或 placeholder
 * - 展开 panel 列出 6 选项；选 Other 时面板**不关闭**，Other 行变成含 input + Cancel 的复合块
 * - 走 Radix Popover（非 Radix Select），item 点击不强制关 popover，方便实现 Other 内嵌输入
 */
export default function SourceField({
  value,
  onChange,
  other,
  onOtherChange,
  label,
  hint,
  required,
}: SourceFieldProps) {
  const t = useTranslations("earlyBird.step1");
  const [open, setOpen] = useState(false);
  const isOtherExpanded = value === "other";

  const handlePick = (opt: SourceOption) => {
    onChange(opt);
    if (opt !== "other") {
      setOpen(false);
    }
  };

  const cancelOther = () => {
    onChange("");
    onOtherChange("");
  };

  const displayLabel = value ? t(`sourceOption.${value}`) : "";

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex flex-col gap-1">
        <label className="text-[14px] leading-[18px] text-primary">
          {label}
          {required && <span className="ml-1 text-fn-red">*</span>}
        </label>
        <p className="text-[12px] leading-[18px] font-medium text-tertiary">{hint}</p>
      </div>

      <Popover.Root open={open} onOpenChange={setOpen}>
        {/* Trigger: 48h, fill-input-modal bg, justify-between, placeholder tertiary */}
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={typeof label === "string" ? label : "source"}
            className="flex h-[48px] w-full items-center justify-between rounded-8 bg-fill-input-modal px-3 text-[14px] leading-[18px] text-primary outline-none touch-manipulation"
          >
            <span className={value ? "text-primary" : "text-tertiary"}>
              {displayLabel || t("sourcePlaceholder")}
            </span>
            <CaretDownIcon size={16} className="text-primary shrink-0" />
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          {/* Content: fill-input bg + border-divider + p-8 + gap-8, match trigger width */}
          <Popover.Content
            sideOffset={8}
            align="start"
            className="z-50 w-[var(--radix-popover-trigger-width)] rounded-8 border border-divider bg-fill-input p-2 shadow-modal backdrop-blur-[6.5px]"
          >
            <div className="flex flex-col gap-2">
              {SOURCE_OPTIONS.filter((o) => o !== "other").map((opt) => (
                <SourceItem key={opt} active={value === opt} onClick={() => handlePick(opt)}>
                  {t(`sourceOption.${opt}`)}
                </SourceItem>
              ))}

              {/* Other row — 普通态：普通 item；展开态：含 input + Cancel 复合块 */}
              {isOtherExpanded ? (
                <div className="flex flex-col gap-[13px] rounded-8 bg-tertiary pb-4">
                  <button
                    type="button"
                    onClick={cancelOther}
                    className="flex h-7 w-full items-center justify-between rounded-8 bg-tertiary p-2"
                  >
                    <span className="text-[12px] leading-[18px] font-medium text-primary">
                      {t("sourceOption.other")}
                    </span>
                    <XIcon size={12} weight="bold" className="text-primary" />
                  </button>
                  <div className="flex flex-col gap-1 px-2">
                    <p className="text-[12px] leading-[18px] font-medium text-tertiary">
                      {t("sourceOtherHint")}
                    </p>
                    <div className="flex h-10 items-center justify-between rounded-4 border-[0.5px] border-brand-default bg-fill-input px-3 backdrop-blur-[15px]">
                      <input
                        type="text"
                        autoFocus
                        value={other}
                        onChange={(e) => onOtherChange(e.target.value)}
                        placeholder={t("sourceOtherPlaceholder")}
                        className="flex-1 bg-transparent text-[14px] leading-[18px] text-primary outline-none placeholder:text-tertiary"
                      />
                      <button
                        type="button"
                        onClick={cancelOther}
                        className="ml-2 shrink-0 text-[14px] leading-[18px] text-brand-default"
                      >
                        {t("sourceOtherCancel")}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <SourceItem onClick={() => handlePick("other")}>
                  {t("sourceOption.other")}
                </SourceItem>
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

interface SourceItemProps {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}

function SourceItem({ active, onClick, children }: SourceItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-7 w-full items-center justify-center rounded-8 p-2 text-[12px] leading-[18px] font-medium transition-colors hover:bg-white/[0.06] ${
        active ? "text-brand-default" : "text-primary"
      }`}
    >
      {children}
    </button>
  );
}
