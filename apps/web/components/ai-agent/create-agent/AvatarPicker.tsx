"use client";

import { CODEX_PETS, findPet } from "@/lib/codex-pets/registry";
import { PetSprite } from "@/components/codex-pets/PetSprite";
import { cn } from "@/lib/utils";

interface AvatarPickerProps {
  value: string;
  onChange: (avatarRef: string) => void;
}

/**
 * AvatarPicker（Figma 6644:141229 · DD-112）。
 *
 * 视觉：
 *   - 上方 120×120 圆角 24 大头像（按 value 渲染对应 codex-pet sprite 动画）
 *   - 下方 9 个小头像
 *     · PC (≥ lg)：保持 Figma 单行 9 列 nowrap
 *     · H5：flex-wrap，每格 min-w-[44px] 自然分两行（5+4），满足触控热区
 *   - active 项：border-dt-hover
 */
export function AvatarPicker({ value, onChange }: AvatarPickerProps) {
  const currentPet = findPet(value) ?? CODEX_PETS[0];

  return (
    <div className="flex w-full flex-col items-center gap-6">
      {/* Figma 6644:141230 */}
      {/* @figma-hardcoded: #f2f2f2 avatar-hero-bg — pending design token */}
      <div className="relative flex h-[120px] w-[120px] items-center justify-center overflow-hidden rounded-[24px] bg-[#f2f2f2]">
        <PetSprite
          petId={currentPet.id}
          size={108}
          mode="idleHoverCycle"
          triggerCycleKey={currentPet.id}
          ariaLabel={`${currentPet.displayName} preview`}
        />
      </div>

      {/* Figma 6644:141232 */}
      <div className="flex w-full flex-wrap gap-3 lg:flex-nowrap">
        {CODEX_PETS.map((pet) => {
          const active = value === pet.id;
          return (
            <button
              key={pet.id}
              type="button"
              onClick={() => onChange(pet.id)}
              aria-pressed={active}
              aria-label={`Pet option ${pet.displayName}`}
              className={cn(
                "relative h-12 min-w-[44px] flex-1 basis-[calc(20%-12px)] overflow-hidden rounded-lg bg-tertiary p-[6px] transition lg:basis-0",
                active ? "border border-dt-hover" : "border-0 hover:opacity-80"
              )}
              style={{ touchAction: "manipulation" }}
            >
              <PetSprite
                petId={pet.id}
                size={36}
                mode="static"
                className="size-full object-contain"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
