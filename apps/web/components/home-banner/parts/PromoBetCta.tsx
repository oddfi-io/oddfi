"use client";

import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";

/**
 * 推广 banner 的「去竞猜」CTA（DD-143 · Figma 8487:109978 Default + 8487:109979 hover/Variant2）
 * 小圆形图标按钮（bg-tertiary + 右向 caret）+ 文案。整卡可点，CTA 仅视觉，无独立 onClick。
 * 文案走 i18n（markets.bannerPromoCta），非数据字段。
 * hover（卡片 group-hover）：文字 text-secondary→text-primary（白·"primary 颜色"高亮），
 * 圆底 bg-tertiary→bg-fill-switch(#37393a)，对齐 Figma Variant2；caret 资源两态同色不变。
 */
export default function PromoBetCta() {
  const t = useTranslations("markets");
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-tertiary transition-colors duration-200 group-hover:bg-fill-switch">
        <CaretRightIcon size={14} weight="bold" className="text-secondary" />
      </span>
      <span className="text-[12px] font-medium leading-[18px] text-secondary transition-colors duration-200 group-hover:text-primary">
        {t("bannerPromoCta")}
      </span>
    </div>
  );
}
