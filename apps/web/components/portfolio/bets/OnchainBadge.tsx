"use client";

import { useTranslations } from "next-intl";

// 临时功能:链上下注阶段结束后整体下线,徽标视觉刻意保持低强度(灰色)。
// corner=true：左上角贴边变体（镜像质押 PeriodCard 右上角小标签），
//   仅外圆角 rounded-tl / 内圆角 rounded-br，供绝对定位贴行左上角用，不参与行内 Flex 排布。
export default function OnchainBadge({ corner = false }: { corner?: boolean }) {
  const t = useTranslations("common");
  return (
    <span
      className={[
        "bg-tag-gray text-secondary h-[24px] px-[8px] py-[2px] text-[11px] font-medium leading-[16px] flex items-center shrink-0",
        corner ? "rounded-tl-8 rounded-br-8" : "rounded-8",
      ].join(" ")}
    >
      {t("onchain")}
    </span>
  );
}
