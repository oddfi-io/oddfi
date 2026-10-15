import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

/**
 * TaskProgressBar —— 任务组进度条（Figma PC 9003:161127 · H5 9021:164127）。
 * 「已完成 N/total」+ total 段 segment；已完成段薄荷绿，未完成段 #212124。
 * 展示型：done/total 由父组件用 getGroupProgress 计算后传入。
 */
export function TaskProgressBar({ done, total }: { done: number; total: number }) {
  const t = useTranslations("rewards.taskCenter");

  return (
    <div className="flex w-full items-center gap-3 md:gap-4">
      <div className="flex shrink-0 items-center gap-1 text-xs leading-[18px] md:text-sm">
        <span className="text-secondary">{t("completed")}</span>
        <span className="text-primary">
          {done}/{total}
        </span>
      </div>
      <div className="flex h-1 min-w-0 flex-1 items-start gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 min-w-0 flex-1 rounded-full",
              i < done ? "bg-fn-brand" : "bg-tertiary"
            )}
          />
        ))}
      </div>
    </div>
  );
}
