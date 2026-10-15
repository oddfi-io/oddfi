import { useTranslations } from "next-intl";
import MobilePredictionCarousel from "./MobilePredictionCarousel";

/**
 * Figma 6937:64403 — H5 预测卡区（375×353 @ y=657）
 * 内容：标题两行（h2）+ 横滚 5 张卡（209×240）
 *
 * stub: 占位骨架，由 Batch 4 补齐 Carousel + Card 还原
 */
export default function MobilePredictionSection() {
  const t = useTranslations("landing.mobile");
  return (
    <section data-figma-node="6937:64403" className="pt-[64px]">
      <div data-figma-node="6937:64281" className="px-[16px]">
        <h2
          data-figma-node="6937:64282"
          className="font-noto-sc text-[28px] font-bold leading-[38px] tracking-[-0.28px] text-primary"
        >
          <span className="block">{t("predictionsTitleLine1")}</span>
          <span className="block">{t("predictionsTitleLine2")}</span>
        </h2>
      </div>
      {/* mt=10：carousel 高度比 Figma 多 16px（给 active 卡 scale 1.1 顶部出框 buffer），mt 减 16 抵消视觉 */}
      <div className="mt-[10px]">
        <MobilePredictionCarousel />
      </div>
    </section>
  );
}
