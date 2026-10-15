"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon, XIcon } from "@phosphor-icons/react";

type FollowNamespace = "countries" | "players";

interface FollowChipsProps {
  value: string[];
  onChange: (next: string[]) => void;
  /** i18n 子命名空间：aiAgent.wizard.step3.{i18nKey}.* */
  i18nKey: FollowNamespace;
  max?: number;
}

/**
 * 关注国家 / 关注球星 chip 选择器（DD-106 Step3 · Figma 6613:130849 chip + 6613:130934 添加）。
 *
 * 同一组件被复用 2 次（countries / players），i18n 通过 i18nKey 切换命名空间。
 *
 * ASSETS.md 已查（关键词：chip / tag / pill / keyword / follow），
 * 现有 PillSwitcher / SegmentedChips 是单选切换器，不支持多选 + 删除 + 添加；
 * tagClasses / betslip-animations* 是工具不是组件。本场景无替代品。
 *
 * 视觉：
 *   - 已选 chip（FollowChip）：bg-btn-secondary（mint 10%）+ 无 border + text-brand-default + 16px XIcon
 *   - 「添加」按钮（AddFollowButton）：1px solid border-divider + 16px PlusIcon + 12.5px text-secondary
 */
export function FollowChips({ value, onChange, i18nKey, max = 20 }: FollowChipsProps) {
  const t = useTranslations(`aiAgent.wizard.step3.${i18nKey}`);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const remove = (kw: string) => {
    onChange(value.filter((v) => v !== kw));
  };

  const commit = () => {
    const v = draft.trim();
    setDraft("");
    setAdding(false);
    if (!v || value.includes(v) || value.length >= max || v.length > 40) return;
    onChange([...value, v]);
  };

  return (
    <div className="flex w-full flex-wrap gap-2">
      {value.map((kw) => (
        <FollowChip key={kw} label={kw} onRemove={() => remove(kw)} />
      ))}

      {adding ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              setDraft("");
              setAdding(false);
            }
          }}
          placeholder={t("placeholder")}
          maxLength={40}
          className="w-[120px] rounded-full border border-solid border-divider bg-transparent px-3 py-[7px] text-[12.5px] font-medium leading-[18.75px] text-secondary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-dt-hover"
        />
      ) : (
        <AddFollowButton
          disabled={value.length >= max}
          label={t("addButton")}
          onClick={() => setAdding(true)}
        />
      )}
    </div>
  );
}

/**
 * 已选关注 chip（Figma 6613:130849）。
 * 单独导出，便于外部场景（如 wizard 预览、配置摘要）复用同款样式。
 */
export function FollowChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-btn-secondary px-3 py-[7px] text-[12.5px] font-medium leading-[18.75px] text-brand-default">
      {label}
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
        className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-brand-default transition hover:opacity-70"
      >
        <XIcon size={16} />
      </button>
    </span>
  );
}

/**
 * 「添加」按钮（Figma 6613:130934）。
 * 同样单独导出，与 FollowChip 在视觉系统内成对出现。
 */
export function AddFollowButton({
  disabled,
  label,
  onClick,
}: {
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-solid border-divider bg-transparent px-3 py-[7px] text-[12.5px] font-medium leading-[18.75px] text-secondary disabled:cursor-not-allowed disabled:opacity-50"
    >
      <PlusIcon size={16} />
      {label}
    </button>
  );
}
