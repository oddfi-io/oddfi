"use client";

import { useTranslations } from "next-intl";

import type { AgentConfig } from "@/stores/aiAgentStore";
import { AgentNameInput } from "./AgentNameInput";
import { AvatarPicker } from "./AvatarPicker";
import { ToneSegmented } from "./ToneSegmented";

interface Step1BasicsProps {
  draft: AgentConfig;
  onChange: (patch: Partial<AgentConfig>) => void;
}

/**
 * Wizard Tab 1 「基础」（Figma 6644:141227）。
 *
 * Layout：「头像」label → 120 大头像 + 9 小头像横排（AvatarPicker） → card(昵称 + divider + AI 类型 + 副标题 + tone segmented)。
 * 已移除原 364×360 mint 装饰背景框（cat head 半透明），改为纯净头像选择器布局。
 */
export function Step1Basics({ draft, onChange }: Step1BasicsProps) {
  const t = useTranslations("aiAgent.wizard.step1");
  return (
    <div className="flex w-full flex-col gap-6">
      {/* 头像区 · Figma 6644:141227（label + 大头像 + 9 小头像） */}
      <div className="flex w-full flex-col gap-4 px-6">
        <label className="block text-base font-medium leading-6 text-primary">
          {t("avatarLabel")}
        </label>
        <AvatarPicker value={draft.avatarRef} onChange={(avatarRef) => onChange({ avatarRef })} />
      </div>

      {/* form card（Figma 6455:123055：bg secondary + border + py-24 内 24px gap） */}
      <div className="flex w-full flex-col gap-6 rounded-2xl border border-solid border-divider bg-secondary py-6">
        <div className="flex flex-col gap-4 px-6">
          <AgentNameInput value={draft.name} onChange={(name) => onChange({ name })} />
        </div>

        {/* tailwind `divider` token 仅在 borderColor 注册，bg-divider 无效；直读 CSS 变量 */}
        <div aria-hidden className="mx-6 h-px bg-[var(--line-divider-primary)]" />

        <div className="flex flex-col gap-4 px-6">
          <div className="flex flex-col gap-1">
            <label className="block text-base font-medium leading-6 text-primary">
              {t("aiTypeLabel")}
            </label>
            <p className="text-[12px] leading-[18px] text-tertiary">{t("aiTypeSubtitle")}</p>
          </div>
          <ToneSegmented value={draft.tone} onChange={(tone) => onChange({ tone })} />
        </div>
      </div>
    </div>
  );
}
