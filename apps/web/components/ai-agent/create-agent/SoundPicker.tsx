"use client";

import { useTranslations } from "next-intl";

import Toggle from "@/components/ui/Toggle";
import { cn } from "@/lib/utils";
import type { AgentSound } from "@/stores/aiAgentStore";

interface SoundPickerProps {
  value: AgentSound;
  onChange: (next: AgentSound) => void;
  /**
   * DD-135 H5 设置页（Figma 7973:132123）：master Toggle 提升到「提示音」标题行右侧
   * （由 Step3Notify 的 Section titleAccessory 渲染），picker 内部不再重复渲染。
   * PC（默认 false）保持单行 chips + 行尾 Toggle 不变。
   */
  hideToggle?: boolean;
}

type SoundId = NonNullable<AgentSound["id"]>;

const SOUND_IDS: SoundId[] = ["ding", "bell", "crisp", "guqin", "comm"];

/**
 * 提示音 picker（DD-106 Step3 · Figma 6417:116426）。
 *
 * 5 个 chip（▶ + label）并排 + 末位 mint 主开关 Toggle。
 * - 选中态：bg rgba(0,230,160,0.1) + border rgba(0,230,160,0.3) + text #00e6a0
 * - 未选：bg #1a2129 + border #2a3440 + text #b8c1cc
 * - 点击 chip：切换为该声音
 * - 点击 chip 内 ▶：试听
 * - Toggle：声音 master 开关，关闭即静音但保留 id 选择
 */
export function SoundPicker({ value, onChange, hideToggle = false }: SoundPickerProps) {
  const t = useTranslations("aiAgent.wizard.step3.sound");
  const playPreview = (id: SoundId) => {
    if (!value.enabled) return;
    try {
      const audio = new Audio(`/sounds/notify-${id}.mp3`);
      audio.volume = 0.6;
      // Promise reject（如音频文件缺失 / decode 失败）必须显式 catch，否则会被 Next.js dev overlay 抓成 Runtime Error
      audio.play().catch((e) => {
        console.warn(`[SoundPicker] preview failed for ${id}`, e);
      });
    } catch (e) {
      console.warn("[SoundPicker] Audio construct failed", e);
    }
  };

  return (
    <div className="flex w-full flex-col gap-2">
      {/* flex-wrap：H5 窄屏 chips 换行（Figma 7973:132123 为 4+1 两行）；PC 宽容器自然单行不受影响 */}
      <div className="flex flex-wrap items-center gap-2">
        {SOUND_IDS.map((id) => {
          const label = t(`names.${id}`);
          const active = value.id === id && value.enabled;
          return (
            <button
              key={id}
              type="button"
              // 单 button 同时承担「选中」+「试听」（避免 button 嵌套），符合 Figma 「点击 ▶ 试听」语义
              onClick={() => {
                onChange({ id, enabled: true });
                playPreview(id);
              }}
              disabled={!value.enabled}
              aria-label={t("previewAria", { name: label })}
              // @figma-hardcoded: active mint 半透明 vs inactive #1a2129/#2a3440
              className={cn(
                "flex h-[33px] cursor-pointer items-center gap-1.5 rounded-full border border-solid px-3 text-[12.5px] leading-[18.75px] transition disabled:cursor-not-allowed disabled:opacity-50",
                active
                  ? "border-[rgba(0,230,160,0.3)] bg-[rgba(0,230,160,0.1)] text-[#00e6a0]"
                  : "border-[#2a3440] bg-[#1a2129] text-[#b8c1cc] hover:border-secondary"
              )}
            >
              <span aria-hidden className="text-[10px] leading-[15px]">
                ▶
              </span>
              {label}
            </button>
          );
        })}
        {!hideToggle && (
          <Toggle
            checked={value.enabled}
            onChange={(enabled) => onChange({ ...value, enabled })}
            ariaLabel={t("masterAria")}
          />
        )}
      </div>

      <p className="text-[11px] leading-[16.5px] text-[#6b7785]">{t("footnote")}</p>
    </div>
  );
}
