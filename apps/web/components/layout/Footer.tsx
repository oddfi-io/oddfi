"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
// 链接/社交常量与 H5 MobileFooter 共用单一真源（避免两端漂移）
import { PRODUCT_LINK_CONFIG, RESOURCE_LINK_CONFIG, SOCIAL_LINKS } from "./footer-links";

/**
 * Footer（Figma 4227:195353/4227:195354/4227:195366）
 *
 * 上半区：Logo + 链接列 + 社交按钮（Figma 4227:195354，宽 1196.4 高 209）
 * - 左 209：Figma logo-icon (#28F4D2 青色) + "oddfi" Orbitron Bold 31 + slogan 16/24 #b9b9b9
 * - 中 211.2×2：两列链接，header 18/26 Medium，list 14/19 Regular opacity 50
 * - 右 208：3 个白底胶囊按钮（Twitter/Telegram/Discord），用 Figma 提供的彩色品牌图标 SVG
 *   按钮文字 17.859 Bold tracking -0.18 black（项目无 Satoshi → fallback system sans）
 * - 容器布局严格按 Figma：gap-[261px] items-start
 *
 * 下半区：版权分隔线 + 巨型 ODDFI 水印（Figma 4227:195366 → 4224:192645）
 * - copyright 用 system font sans-serif，opacity 30 — 与 Noto Sans SC 对中文渲染厚重感不同
 * - 装饰水印高度从 576 缩到 320，让整体更扁
 *
 * 字体：Schibsted Grotesk 项目未加载 → 暂用 Pilat Extended Black 替代（"@figma-pending-font"）。
 */

function ColumnHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-noto-sc text-[18px] font-medium leading-[26px] text-white">{children}</p>
  );
}

function FooterLinkList({ items }: { items: ReadonlyArray<{ label: string; href: string }> }) {
  return (
    <ul className="flex flex-col gap-[16px] opacity-50">
      {items.map((item) => (
        <li key={item.label}>
          <Link
            href={item.href}
            className="font-noto-sc text-[14px] font-normal leading-[19px] text-white transition-opacity hover:opacity-80"
            {...(item.href.startsWith("http")
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SocialButton({ label, href, icon }: { label: string; href: string; icon: string }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-[48px] w-[208px] items-center gap-[8px] rounded-[34px] bg-white px-[50px] py-[12px] transition-colors hover:bg-[#f1f1f1]"
      aria-label={label}
    >
      <Image
        src={icon}
        alt=""
        width={24}
        height={24}
        sizes="24px"
        className="shrink-0"
        aria-hidden
      />
      {/* @figma-hardcoded: -0.18px tracking — Satoshi Bold 项目未加载，fallback system sans */}
      <span className="text-[17.859px] font-bold leading-[26px] tracking-[-0.18px] text-black">
        {label}
      </span>
    </Link>
  );
}

export default function Footer() {
  const t = useTranslations("landing.footer");
  const productLinks = PRODUCT_LINK_CONFIG.map((c) => ({
    label: t(`links.${c.key}`),
    href: c.href,
  }));
  const resourceLinks = RESOURCE_LINK_CONFIG.map((c) => ({
    label: t(`links.${c.key}`),
    href: c.href,
  }));
  return (
    <footer
      data-figma-node="4227:195353"
      data-name="LandingFooter"
      // @figma-hardcoded: bg-black footer-bg, rgba(255,255,255,0.08) footer-top-border
      className="relative w-full border-t border-[rgba(255,255,255,0.08)] bg-black px-[120px] pt-[60px]"
    >
      {/* 上半区：4 列扁平布局，撑满 footer 内容宽度（视口 - 240 padding）
          justify-between 把 4 组（logo / 产品 / 资源 / 社交）等距分布到左右两端 */}
      <div className="relative z-10 flex items-start justify-between gap-[40px]">
        {/* Logo + Slogan（Figma 4227:195355） */}
        <div className="flex w-[209px] flex-col gap-[20px]">
          <div className="flex items-center gap-[8px]">
            <Image
              src="/images/footer/logo-icon.svg"
              alt="OddFi"
              width={32}
              height={24}
              sizes="32px"
              className="shrink-0"
              priority={false}
            />
            <span className="whitespace-nowrap font-orbitron text-[31px] font-bold leading-none text-white">
              oddfi
            </span>
          </div>
          {/* @figma-hardcoded: #b9b9b9 footer-slogan — H2 token (#B9B9B9) per Figma */}
          <p className="whitespace-nowrap font-noto-sc text-[16px] font-normal leading-[24px] text-[#b9b9b9]">
            {t("slogan")}
          </p>
        </div>

        {/* 产品列 */}
        <div className="flex w-[211.2px] flex-col gap-[24px]">
          <ColumnHeader>{t("product")}</ColumnHeader>
          <FooterLinkList items={productLinks} />
        </div>

        {/* 资源列 */}
        <div className="flex w-[211.2px] flex-col gap-[24px]">
          <ColumnHeader>{t("resources")}</ColumnHeader>
          <FooterLinkList items={resourceLinks} />
        </div>

        {/* 社交按钮列 */}
        <div className="flex w-[208px] flex-col gap-[24px]">
          {SOCIAL_LINKS.map((s) => (
            <SocialButton key={s.label} label={s.label} href={s.href} icon={s.icon} />
          ))}
        </div>
      </div>

      {/* 版权分隔线（Figma 4227:195364）— 字体改 system sans，让英文 © 2026... 更轻 */}
      <div className="relative z-10 mt-[32px] flex items-center justify-center border-t border-[rgba(255,255,255,0.10)] pt-[24px]">
        <p className="text-[12px] font-normal leading-[18px] tracking-[0.04em] text-white opacity-30">
          {t("copyright")}
        </p>
      </div>

      {/* 底部巨型 ODDFI 装饰区（Figma 节点 4227:195366 → 4224:192658）
          - 高度 576px（Figma 一致），让滚到底之后还有视觉空间
          - 4 个 Figma 椭圆 SVG 各加不同 drift 漂移动画 → 布朗运动效果
          - 3 个 ODDFI 文字水平 marquee，无缝循环
          @figma-pending-font: Schibsted Grotesk Bold 475.2 — 暂用 Pilat Extended Black */}
      {/* 用 -mx-[120px] 抵消 footer 的 px-[120px] padding，让 marquee 撑满整个视口宽度
          （block 元素在没有 w-* 显式宽度时，会随 margin 自动扩张到 parent_inner_width + 240） */}
      <div
        aria-hidden
        data-figma-node="4227:195366"
        className="pointer-events-none relative -mx-[120px] h-[576px] overflow-hidden"
      >
        {/* 4 个 Figma 光晕椭圆（节点 4224:192640~192643） — 各自布朗运动漂移 */}
        {/* Ellipse 23：大背景光，跨整宽 */}
        <div
          className="absolute h-[644px] w-[1549px] animate-drift-1"
          style={{ left: "-55px", top: "287.98px" }}
        >
          <div className="absolute" style={{ inset: "-46.58% -19.37%" }}>
            <img
              src="/images/footer/glow-ellipse-23.svg"
              alt=""
              className="block size-full max-w-none"
            />
          </div>
        </div>
        {/* Ellipse 19：右上旋转椭圆 */}
        <div
          className="absolute flex h-[466.303px] w-[616.192px] items-center justify-center animate-drift-2"
          style={{ left: "672.81px", top: "365.65px" }}
        >
          <div className="flex-none rotate-[8.48deg]">
            <div className="relative h-[387.204px] w-[565.29px]">
              <div className="absolute" style={{ inset: "-69.73% -47.76%" }}>
                <img
                  src="/images/footer/glow-ellipse-19.svg"
                  alt=""
                  className="block size-full max-w-none"
                />
              </div>
            </div>
          </div>
        </div>
        {/* Ellipse 22：中央光斑 */}
        <div
          className="absolute h-[340px] w-[557px] animate-drift-3"
          style={{ left: "360px", top: "404.01px" }}
        >
          <div className="absolute" style={{ inset: "-67.65% -41.29%" }}>
            <img
              src="/images/footer/glow-ellipse-22.svg"
              alt=""
              className="block size-full max-w-none"
            />
          </div>
        </div>
        {/* Ellipse 24：左下光斑 */}
        <div
          className="absolute h-[316px] w-[432px] animate-drift-4"
          style={{ left: "165px", top: "403.98px" }}
        >
          <div className="absolute" style={{ inset: "-94.94% -69.44%" }}>
            <img
              src="/images/footer/glow-ellipse-24.svg"
              alt=""
              className="block size-full max-w-none"
            />
          </div>
        </div>

        {/* 巨型 ODDFI 文字水平 marquee
            - flex w-max + animate-marquee-slow（60s）平移 -50% 形成无缝循环
            - 顶部 top:5.11 与 Figma 一致，让文字底部超出可见区给"很多内容感"
            - mask 上方梯度（对齐 Figma 4227:195363 frame 遮挡效果）：
              顶 35% 完全透明 → 60% 半遮 → 85% 实色 → 100% 实色
              让 ODDFI 上半隐藏在背景里，只显出下半，对齐设计稿的 frame 遮挡感
            - opacity 30 → 18：用户走查反馈过于显眼 */}
        <div
          className="absolute left-0 right-0 flex items-center"
          style={{
            top: "5.11px",
            maskImage:
              "linear-gradient(180deg, transparent 0%, transparent 35%, rgba(0,0,0,0.7) 60%, #000 85%, #000 100%)",
            WebkitMaskImage:
              "linear-gradient(180deg, transparent 0%, transparent 35%, rgba(0,0,0,0.7) 60%, #000 85%, #000 100%)",
          }}
        >
          <div className="flex w-max items-center gap-[200px] whitespace-nowrap pr-[200px] animate-marquee-slow">
            {Array.from({ length: 6 }).map((_, i) => (
              <span
                key={i}
                className="font-bold text-white mix-blend-overlay opacity-[0.18]"
                style={{
                  fontFamily: "'Schibsted Grotesk', sans-serif",
                  fontSize: "475.2px",
                  lineHeight: "617.76px",
                  letterSpacing: "-14.4px",
                }}
              >
                ODDFI
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
