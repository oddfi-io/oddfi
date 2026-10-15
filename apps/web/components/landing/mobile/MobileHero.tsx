import { useTranslations } from "next-intl";
import MobileStartPredictionButton from "./MobileStartPredictionButton";

/**
 * Figma 6937:64256 — Hero 文案区（343×190 @ x=16, y=88）
 * 内容：「AI 原生」徽章 + H1 两行 + 开始预测按钮
 *
 * stub: 占位骨架，由 Batch 2 完整还原
 */
export default function MobileHero() {
  const t = useTranslations("landing.mobile");
  return (
    <section
      data-figma-node="6937:64256"
      className="px-[16px] pt-[24px] flex flex-col items-center gap-[12px]"
    >
      <p
        data-figma-node="6937:64257"
        className="font-noto-sc text-[24px] font-bold leading-[30px] tracking-[-0.24px] text-brand-default text-center"
      >
        {t("heroBadge")}
      </p>
      <div className="flex flex-col items-center gap-[24px] w-full">
        <h1
          data-figma-node="6937:64259"
          className="font-noto-sc text-[28px] font-bold leading-[38px] tracking-[-0.28px] text-primary text-center"
        >
          <span className="block">{t("heroTitleLine1")}</span>
          <span className="block">{t("heroTitleLine2")}</span>
        </h1>
        <MobileStartPredictionButton />
      </div>
    </section>
  );
}
