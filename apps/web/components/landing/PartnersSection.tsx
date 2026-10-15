import { useTranslations } from "next-intl";
import Footer from "@/components/layout/Footer";
import MobileFooter from "@/components/layout/MobileFooter";
import PartnersMarquee from "./partners/PartnersMarquee";

/**
 * §13 合作伙伴 + Footer（Figma 4227:195349 "Frame 481940"）
 *
 * 内容：
 * - 上：标题 "合作伙伴" 40px Bold + PartnersMarquee（Figma 4227:195350）
 * - 下：Footer 主体（Figma 4227:195353）
 *
 * Phase 1 静态版（DD-088 §0）：
 * - PartnersMarquee 占位灰块（资源未到位）
 * - Footer 完整 3 列 + logo + 社交按钮 + 版权 + ODDFI 装饰水印
 */
export default function PartnersSection() {
  const t = useTranslations("landing.partners");
  return (
    <section
      data-section="partners-footer"
      data-figma-node="4227:195349"
      className="relative flex w-full flex-col gap-[40px]"
    >
      {/* 合作伙伴块（Figma 4227:195350） */}
      <div className="flex w-full flex-col items-stretch gap-[40px]">
        <h2
          data-figma-node="4227:195351"
          // @figma-hardcoded: -0.8px tracking, font-family HarmonyOS Sans SC fallback Noto Sans SC
          // H5 标题 28px（Figma 7766:121751）/ PC 40px
          className="text-center font-noto-sc text-[28px] font-bold leading-[38px] tracking-[-0.56px] text-white md:text-[40px] md:leading-[56px] md:tracking-[-0.8px]"
        >
          {t("title")}
        </h2>
        <PartnersMarquee />
      </div>

      {/* Footer：PC 桌面版（Figma 4227:195353）/ H5 移动版（Figma 7766:125452） */}
      <div className="hidden md:block">
        <Footer />
      </div>
      <div className="md:hidden">
        <MobileFooter />
      </div>
    </section>
  );
}
