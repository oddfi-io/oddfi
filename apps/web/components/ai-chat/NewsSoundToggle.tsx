"use client";

import { SpeakerHighIcon, SpeakerSlashIcon } from "@phosphor-icons/react";

import { useAiAgentStore } from "@/stores/aiAgentStore";
import { cn } from "@/lib/utils";

/**
 * NewsSoundToggle — 新闻推送通知音开关（DD-125 · Figma 7235:126604）。
 *
 * PC / H5 通用：唯一权威是 `aiAgentStore.config.sound.enabled`（playNotifySound 读同一字段），
 * 因此在任一端切换都会同步影响两端的通知音行为。
 *
 * 32×32 圆形描边按钮（与汉堡同 chrome），enabled → SpeakerHigh，muted → SpeakerSlash。
 */
export function NewsSoundToggle({ className }: { className?: string }) {
  const sound = useAiAgentStore((s) => s.config.sound);
  const patchConfig = useAiAgentStore((s) => s.patchConfig);
  const enabled = sound.enabled;

  const toggle = () => patchConfig({ sound: { ...sound, enabled: !enabled } });
  const Icon = enabled ? SpeakerHighIcon : SpeakerSlashIcon;

  return (
    <button
      type="button"
      aria-label={enabled ? "Mute news notifications" : "Unmute news notifications"}
      aria-pressed={enabled}
      onClick={toggle}
      style={{ touchAction: "manipulation" }}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full border bg-transparent text-primary transition hover:opacity-80",
        className
      )}
    >
      <Icon size={18} />
    </button>
  );
}
