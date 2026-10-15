"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

import { ComingSoon } from "@/components/common/ComingSoon";

/**
 * H5 + 早鸟模式专用 Coming Soon 占位（DD-103 续 · DD-106 Batch 2 重构）。
 *
 * 早鸟模式下：H5 用户进入 / 或 /<locale>/home 不再被重定向到 /markets（middleware 会再跳回 Home 形成死循环），
 * 改为渲染本组件。「Notify Me」按钮带 data-earlybird-gate 触发 EarlyBirdProvider 全局拦截 → 弹早鸟登记 Modal。
 *
 * Batch 2 重构：通用视觉壳层 + 数据下沉到 <ComingSoon />，本文件只保留早鸟特化的装饰层与 Logo。
 */
export default function LandingComingSoonMobile() {
  const t = useTranslations("earlyBird.mobileGate");

  return (
    <ComingSoon
      sectionId="early-bird-mobile-gate"
      title={t("comingSoon")}
      subtitle={t("stayTuned")}
      decorations={<EarlyBirdGlowBackdrop />}
      header={
        <Image
          src="/images/logo-icon.svg"
          alt="OddFi"
          width={72}
          height={72}
          priority
          className="drop-shadow-[0_4px_24px_rgba(46,220,255,0.4)]"
        />
      }
      cta={{
        label: t("notifyMe"),
        dataAttrs: { "data-earlybird-gate": "" },
      }}
    />
  );
}

function EarlyBirdGlowBackdrop() {
  return (
    // @figma-hardcoded: radial brand glow rgba(46,220,255,0.18) — pending design token
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-[-20vh] mx-auto h-[60vh] w-[120vw] opacity-60"
      style={{
        background:
          "radial-gradient(ellipse at center, rgba(46, 220, 255, 0.18) 0%, rgba(46, 220, 255, 0.04) 40%, transparent 70%)",
      }}
    />
  );
}
