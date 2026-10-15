"use client";

/**
 * MobileAgentBasics — H5 设置「基础」tab 内容（DD-135 Batch 3 · Figma 7973:128811 内容区）。
 *
 * 与 PC Step1Basics 布局差异大（DD §2.4 疑点 2：以 H5 设计稿为准，独立 H5 分支渲染）：
 *   - 80px 大头像预览（#f2f2f2 底 rounded-16，PC 是 120/rounded-24）
 *   - 头像八宫格：4 列 grid（cell 48px 高 rounded-8 bg-tertiary，选中 border-dt-hover；
 *     9 个 codex pets 自然换行 4+4+1，设计稿以 8 个占位示意）
 *   - 无「头像」label；昵称/AI 类型 label 14/18 Medium；分区通栏 divider（无 card 包裹）
 *   - AI 类型 SegmentedControl h-40（复用 ToneSegmented 传 className 覆写）
 *
 * draft 读写与 PC 同一来源（useAgentConfigDraft 由父组件注入 draft/onChange）。
 */

import { CODEX_PETS, findPet } from "@/lib/codex-pets/registry";
import { PetSprite } from "@/components/codex-pets/PetSprite";
import { cn } from "@/lib/utils";
import type { AgentConfig } from "@/stores/aiAgentStore";
import { AgentNameInput } from "@/components/ai-agent/create-agent/AgentNameInput";
import { ToneSegmented } from "@/components/ai-agent/create-agent/ToneSegmented";
import { useTranslations } from "next-intl";

interface MobileAgentBasicsProps {
  draft: AgentConfig;
  onChange: (patch: Partial<AgentConfig>) => void;
}

export function MobileAgentBasics({ draft, onChange }: MobileAgentBasicsProps) {
  const t = useTranslations("aiAgent.wizard.step1");
  const currentPet = findPet(draft.avatarRef) ?? CODEX_PETS[0];

  return (
    <div className="flex w-full flex-col gap-6">
      {/* 头像区（Figma 7973:128814 · px-16 gap-16 居中） */}
      <div className="flex flex-col items-center gap-[16px] px-[16px]">
        {/* @figma-hardcoded: #f2f2f2 avatar-hero-bg — pending design token（与 PC AvatarPicker 同源） */}
        <div className="relative flex size-[80px] items-center justify-center overflow-hidden rounded-[16px] bg-[#f2f2f2]">
          <PetSprite
            petId={currentPet.id}
            size={60}
            mode="idleHoverCycle"
            triggerCycleKey={currentPet.id}
            ariaLabel={`${currentPet.displayName} preview`}
          />
        </div>

        {/* 八宫格（Figma 7973:129114 · 4 列 gap-8，cell flex-1 h-48 rounded-8） */}
        <div className="grid w-full grid-cols-4 gap-[8px]">
          {CODEX_PETS.map((pet) => {
            const active = draft.avatarRef === pet.id;
            return (
              <button
                key={pet.id}
                type="button"
                onClick={() => onChange({ avatarRef: pet.id })}
                aria-pressed={active}
                aria-label={`Pet option ${pet.displayName}`}
                style={{ touchAction: "manipulation" }}
                className={cn(
                  // flex 居中：cell 宽随 grid 列伸缩（~76px），sprite 36px 必须水平垂直居中（设计稿 7973:129114）
                  "relative flex h-[48px] items-center justify-center overflow-hidden rounded-[8px] bg-tertiary p-[6px] transition",
                  active ? "border border-dt-hover" : "border-0 hover:opacity-80"
                )}
              >
                <PetSprite petId={pet.id} size={36} mode="static" />
              </button>
            );
          })}
        </div>
      </div>

      {/* @figma-hardcoded: divider 通栏 #212124，与设置大卡片 border 同源 */}
      <div aria-hidden className="h-px w-full bg-[#212124]" />

      {/* 昵称（Figma 7973:128831 · px-16 gap-12 + label 14/18） */}
      <div className="px-[16px]">
        <AgentNameInput variant="h5" value={draft.name} onChange={(name) => onChange({ name })} />
      </div>

      {/* @figma-hardcoded: divider 通栏 #212124，与设置大卡片 border 同源 */}
      <div aria-hidden className="h-px w-full bg-[#212124]" />

      {/* AI 类型（Figma 7973:128835 · px-16 gap-12 + label 14/18 + sub 12 + segmented h-40） */}
      <div className="flex flex-col gap-[12px] px-[16px]">
        <div className="flex flex-col gap-[8px]">
          <p className="text-[14px] font-medium leading-[18px] text-primary">{t("aiTypeLabel")}</p>
          <p className="text-[12px] leading-[18px] text-tertiary">{t("aiTypeSubtitle")}</p>
        </div>
        <ToneSegmented
          className="h-[40px]"
          value={draft.tone}
          onChange={(tone) => onChange({ tone })}
        />
      </div>
    </div>
  );
}
