"use client";

import Toggle from "@/components/ui/Toggle";

interface PushChannelRowProps {
  label: string;
  hint?: string;
  enabled: boolean;
  onToggle: (next: boolean) => void;
}

/**
 * 推送渠道单行（DD-106 Step3 · Figma 6417:116376）。
 *
 * 左：14/regular label + 12/tertiary 副文案；右：42×24 mint Toggle。
 * 不再有外层 card 包裹（Figma 6417:116376 为透明 row + space-between），由 Step3Notify 容器统一管理 row 间距。
 */
export function PushChannelRow({ label, hint, enabled, onToggle }: PushChannelRowProps) {
  return (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="flex flex-col gap-2">
        <span className="text-sm leading-[18px] text-primary">{label}</span>
        {hint && <span className="text-xs leading-[18px] text-tertiary">{hint}</span>}
      </div>
      <Toggle checked={enabled} onChange={onToggle} ariaLabel={`${label} 开关`} />
    </div>
  );
}
