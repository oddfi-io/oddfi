import Image from "next/image";
import { useTranslations } from "next-intl";
import OddInfoCard from "./odd/OddInfoCard";

/**
 * §7 ODD Token Section（Figma 节点 4227:195206）
 *
 * 布局（1440 设计宽 · sticky stack）：
 * - 上半 Hero（标题 "ODD 代币" + 副文案 + ODD 3D logo） — sticky top-[80px]（锚定到 TopNav 下沿）
 * - 下半 OddInfoCard（信息表 + 飞轮） — sticky top-[227px]（同步偏移 80，底对齐 Hero）
 *
 * 滚动行为：
 * 1. wrapper 顶到达 viewport y=80 → Hero sticky 锚定（避免被 TopNav 遮挡）
 * 2. 继续滚 → InfoCard 从 Hero 下方上推（自然 flow）
 * 3. 当 InfoCard 顶部到达 viewport y=227 → InfoCard sticky 锚定（z-20 覆盖 Hero）
 *    此时 Hero[80, 80+687] / InfoCard[227, 227+540] 底部对齐 viewport y=767
 * 4. 继续滚 → 两者随 wrapper 一起滚出视窗
 *
 * 关键尺寸：
 * - TopNav 下沿 = 80px（PC: pt-16 + h-64 浮岛栏 / fixed 定位）
 * - Title 与 TopNav 下沿间距 = pt-80 → title 顶在 viewport y = 80(sticky锚) + 80(pt) = 160
 * - Hero 高度 = pt-80 + h2-64 + gap-16 + p-24 + gap-40 + image-423 + pb-40 = 687px
 * - InfoCard 高度 = 540px (Figma)
 * - InfoCard sticky-top = TopNav 下沿 80 + (Hero h - InfoCard h) 147 = 227 (底对齐)
 * - wrapper height = Hero h + InfoCard h + 400 (buffer) = 1627px
 *
 * Phase 1 静态版：飞轮**不旋转**，按钮无 hover 动画。
 */
export default function OddTokenSection() {
  const t = useTranslations("landing.oddToken");
  return (
    <section data-section="odd-token" data-figma-node="4227:195206" className="relative w-full">
      {/* 外 wrapper：高度决定 sticky 持续滚动距离 */}
      <div className="relative mx-auto h-[1627px] w-full max-w-[1440px] px-[128px]">
        {/* Hero — sticky top-[80px] 锚到 TopNav 下沿，pt-[80px] 让 title 与 TopNav 下沿距离 80px；z-10 在 InfoCard 之下 */}
        <div className="sticky top-[80px] z-10 mx-auto flex w-full max-w-[472px] flex-col items-center gap-[40px] pb-[40px] pt-[80px]">
          <div className="flex flex-col items-center gap-[16px] text-center">
            <h2 className="text-[48px] font-bold leading-[64px] text-primary">{t("title")}</h2>
            <p className="text-[16px] leading-[24px] text-white opacity-70">{t("subtitle")}</p>
          </div>

          {/* ODD 3D logo（76x76 PNG，按 Figma 容器约 472x423） */}
          <div className="relative aspect-[472/423] w-full">
            <Image
              src="/images/landing/odd-logo-3d.png"
              alt="ODD Token 3D logo"
              fill
              sizes="(min-width: 1024px) 472px, 80vw"
              className="object-contain"
              priority={false}
            />
          </div>
        </div>

        {/* InfoCard — sticky top-[227px]（80 TopNav + 147 底对齐偏移），z-20 覆盖 Hero 下半部 */}
        <div className="sticky top-[227px] z-20">
          <OddInfoCard />
        </div>
      </div>
    </section>
  );
}
