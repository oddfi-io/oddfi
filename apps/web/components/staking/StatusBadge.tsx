// [TEMP:staking] Temporary — will be replaced when backend staking API is ready
import { useTranslations } from "next-intl";
import type { PositionStatus } from "./types";

const STATUS_STYLE: Record<PositionStatus, { bgClass: string; textClass: string }> = {
  ready: { bgClass: "bg-tag-green", textClass: "text-green" },
  active: { bgClass: "bg-tag-orange", textClass: "text-brand-default" },
  withdrawn: { bgClass: "bg-tag-gray", textClass: "text-secondary" },
};

interface StatusBadgeProps {
  status: PositionStatus;
  daysLeft?: number;
}

export default function StatusBadge({ status, daysLeft }: StatusBadgeProps) {
  const t = useTranslations("staking");
  const { bgClass, textClass } = STATUS_STYLE[status];

  let label: string;
  if (status === "ready") label = t("statusReady");
  else if (status === "active") label = t("statusActive", { days: daysLeft ?? 0 });
  else label = t("statusWithdrawn");

  return (
    <span
      className={`inline-flex items-center px-[8px] py-[2px] rounded-8 h-[24px] text-[11px] font-medium ${bgClass} ${textClass}`}
    >
      {label}
    </span>
  );
}
