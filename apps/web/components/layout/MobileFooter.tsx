"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CaretUpIcon } from "@phosphor-icons/react";
// 链接/社交常量与桌面 Footer 共用单一真源（避免两端漂移）
import { PRODUCT_LINK_CONFIG, RESOURCE_LINK_CONFIG, SOCIAL_LINKS } from "./footer-links";

/**
 * 移动端 Footer（Figma H5 7766:125452）
 *
 * 桌面 Footer（components/layout/Footer.tsx）为固定 4 列 px-120 版式，无响应式；H5 设计是另一套版式：
 * 居中 logo + 标语 + 3 个圆形社交按钮 → 产品/资源 折叠列（设计展开态，caret 向上）→ 分割线 + 版权
 * → 缩小版 ODDFI 光晕水印（160px）。链接 / 社交 / 文案与桌面共用同一套常量 + i18n。
 *
 * 由 PartnersSection 按断点择一渲染：PC `<Footer>` / H5 `<MobileFooter>`。
 */

function FooterColumn({
  header,
  items,
}: {
  header: string;
  items: ReadonlyArray<{ label: string; href: string }>;
}) {
  return (
    <div className="flex w-full flex-col gap-4">
      {/* header + caret（设计为展开态，caret 向上 · Figma 7766:123603） */}
      <div className="flex w-full items-center justify-between">
        <span className="font-noto-sc text-[16px] font-medium leading-6 text-white">{header}</span>
        <CaretUpIcon size={16} className="text-white" aria-hidden />
      </div>
      <ul className="flex flex-col gap-4 px-4">
        {items.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className="flex h-8 items-center font-noto-sc text-[14px] font-normal leading-[18px] text-white transition-opacity hover:opacity-80"
              {...(item.href.startsWith("http")
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function MobileFooter() {
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
    // @figma-hardcoded: #212124 line/border-secondary 顶边 — pending design token
    <footer data-name="MobileFooter" className="flex w-full flex-col border-t border-[#212124]">
      <div className="flex w-full flex-col items-center gap-8 bg-primary px-4 pb-6 pt-10">
        {/* logo + 标语 + 社交 */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <Image
              src="/images/footer/logo-icon.svg"
              alt="OddFi"
              width={32}
              height={24}
              sizes="32px"
              className="h-6 w-8 shrink-0"
            />
            <span className="font-orbitron text-[31px] font-bold leading-none text-white">
              oddfi
            </span>
          </div>
          <p className="font-noto-sc text-[16px] font-normal leading-6 text-white">{t("slogan")}</p>
          <div className="flex items-start gap-[14.545px]">
            {SOCIAL_LINKS.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="flex size-10 items-center justify-center rounded-full bg-white transition-colors hover:bg-[#f1f1f1]"
              >
                <Image src={s.icon} alt="" width={20} height={20} sizes="20px" aria-hidden />
              </Link>
            ))}
          </div>
        </div>

        {/* 折叠列：产品 / 资源 */}
        <FooterColumn header={t("product")} items={productLinks} />
        <FooterColumn header={t("resources")} items={resourceLinks} />

        {/* 分割线 + 版权 */}
        <div className="flex w-full flex-col gap-6">
          <div className="h-px w-full bg-white/10" />
          <p className="text-center text-[12px] font-normal leading-[18px] text-tertiary">
            {t("copyright")}
          </p>
        </div>
      </div>

      {/* 巨型 ODDFI 光晕水印（缩小版 160px · Figma 7766:125160）。装饰用，复用桌面光晕 SVG。
          @figma-hardcoded: #04060c bg, rgba(255,255,255,0.08) 顶边 — pending design token */}
      <div className="relative h-[160px] w-full overflow-clip border-t-[0.26px] border-white/[0.08] bg-[#04060c]">
        {/* eslint-disable @next/next/no-img-element */}
        <img
          src="/images/footer/glow-ellipse-23.svg"
          aria-hidden
          alt=""
          className="pointer-events-none absolute left-[5px] top-[78px] h-[179px] w-[365px] max-w-none select-none"
        />
        {/* Ellipse 19：右侧紫色光晕（Figma 7766:125163，旋转 9.17°/斜切 1.34°）。缺它右半会发空 */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-[206px] top-[103px] flex h-[131.566px] w-[160.467px] items-center justify-center"
        >
          <img
            src="/images/footer/glow-ellipse-19.svg"
            alt=""
            className="h-[109.073px] w-[147.489px] max-w-none rotate-[9.17deg] skew-x-[1.34deg] select-none"
          />
        </div>
        <img
          src="/images/footer/glow-ellipse-22.svg"
          aria-hidden
          alt=""
          className="pointer-events-none absolute left-[94px] top-[108px] h-[96px] w-[145px] max-w-none select-none"
        />
        <img
          src="/images/footer/glow-ellipse-24.svg"
          aria-hidden
          alt=""
          className="pointer-events-none absolute left-[54px] top-[80px] h-[89px] w-[112px] max-w-none select-none"
        />
        {/* eslint-enable @next/next/no-img-element */}
        {/* 文字带左偏 172.52px（Figma 7766:125166 left:calc(50%-172.52px)）→ 可见窗内呈现「…DDFI  ODD…」错位重复，
            非 3 个居中词。配合 -translate-x-1/2 让 907px 宽的 3 词带中心落在 x≈15，与设计一致 */}
        <div
          aria-hidden
          className="absolute left-[calc(50%-172.52px)] top-[42px] flex -translate-x-1/2 items-center gap-8 whitespace-nowrap"
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="font-bold text-white opacity-30 mix-blend-overlay"
              // @figma-pending-font: Schibsted Grotesk Bold 89.346 — 项目未加载，fallback system sans
              style={{
                fontFamily: "'Schibsted Grotesk', sans-serif",
                fontSize: "89.346px",
                lineHeight: "116.149px",
                letterSpacing: "-2.7074px",
              }}
            >
              ODDFI
            </span>
          ))}
        </div>
      </div>
    </footer>
  );
}
