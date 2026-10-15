"use client";

import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";

/**
 * Figma 6937:64260 — H5 「开始预测」按钮（195×48 渐变胶囊）
 *
 * 与 PC StartPredictionButton (280×56) 结构同源：渐变 + cta-bg-shadow noise
 * + 12 Union 高光条 + inset 白色高光 + drop shadow。
 *
 * H5 缩放：
 *   - 容器 195×48 / rounded-[43.382px]
 *   - Union 间距 ~12.94px（PC ~23.01px 的 0.696 倍）
 *   - 字号 16px medium（PC 20px bold uppercase）
 */

// H5 Union 12 列偏移（Figma 6937:64262 起 left=18.93 步进 ~12.94）
const UNION_OFFSETS = [
  18.93, 31.86, 44.8, 57.73, 70.67, 83.6, 96.53, 109.47, 122.4, 135.33, 148.27, 161.2,
];

export default function MobileStartPredictionButton() {
  const t = useTranslations("landing.mobile");
  return (
    <Link
      href="/markets"
      data-figma-node="6937:64260"
      data-cta="h5-start-predict"
      style={{
        touchAction: "manipulation",
        // @figma-hardcoded: 0 5.03px 8.33px rgba(40,244,210,0.2) — pending design token
        boxShadow: "0px 5.03px 8.33px 0px rgba(40,244,210,0.2)",
      }}
      className="relative flex h-[48px] w-[195px] items-center justify-center overflow-clip rounded-[43.382px]"
    >
      {/* 底层渐变 + cta-bg-shadow noise（mix-blend-soft-light） */}
      <span aria-hidden className="absolute inset-0 rounded-[43.382px]">
        <span
          className="absolute inset-0 overflow-hidden rounded-[43.382px]"
          style={{ mixBlendMode: "soft-light" }}
        >
          <Image
            src="/images/landing/cta-bg-shadow.png"
            alt=""
            fill
            sizes="195px"
            className="size-full max-w-none"
          />
        </span>
        {/* @figma-hardcoded: linear-gradient(to bottom, #28f4d2 0%, #00473b 100%) — pending design token */}
        <span
          className="absolute inset-0 rounded-[43.382px]"
          style={{ background: "linear-gradient(to bottom, #28f4d2 0%, #00473b 100%)" }}
        />
      </span>

      {/* 12 组 Union 高光条（mix-blend-soft-light opacity-20） */}
      <span aria-hidden className="absolute inset-0">
        {UNION_OFFSETS.map((left) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={left}
            src="/images/landing/cta-union-deco.svg"
            alt=""
            className="absolute top-0 h-[48.401px] w-[15.971px] opacity-20"
            style={{ left: `${left}px`, mixBlendMode: "soft-light" }}
          />
        ))}
      </span>

      {/* 文字 */}
      <span
        className="relative z-10 font-noto-sc text-[16px] font-medium leading-[24px] text-primary"
        // @figma-hardcoded: 0 0.694px 1.388px rgba(3,87,72,0.5) text-shadow — pending design token
        style={{ textShadow: "0px 0.694px 1.388px rgba(3, 87, 72, 0.5)" }}
      >
        {t("ctaStartPredict")}
      </span>

      {/* inset 上下双向白色高光 */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[43.382px]"
        style={{
          // @figma-hardcoded: inset white 40% top/bottom — pending design token
          boxShadow:
            "inset -1.388px -1.388px 3.471px 0px rgba(255,255,255,0.4), inset 1.388px -1.388px 3.471px 0px rgba(255,255,255,0.4)",
        }}
      />
    </Link>
  );
}
