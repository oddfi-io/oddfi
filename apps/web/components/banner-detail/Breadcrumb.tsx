"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { CaretLeftIcon } from "@phosphor-icons/react";

interface Props {
  /** 链接目标，默认 `/markets` */
  href?: string;
  /** 显示文案，未传则取 next-intl key markets.bannerDetailBack */
  label?: string;
}

/**
 * 详情页面包屑「< Markets」
 *
 * Figma 节点 (PC)：[3550:73356](https://www.figma.com/design/6WH0v3q8t3rImMXpt7uGXs/oddfi-UI-UX?node-id=3550-73356)
 * Figma 节点 (H5)：[3646:135795](https://www.figma.com/design/6WH0v3q8t3rImMXpt7uGXs/oddfi-UI-UX?node-id=3646-135795)
 * 视觉：chevron_left 20×20 + Orbitron SemiBold 16/24 white，gap 8
 * H5：触控热区 min-h-[44px]（mobile-h5 规范），视觉保持与 PC 一致
 */
export default function Breadcrumb({ href = "/markets", label }: Props) {
  const t = useTranslations("markets");
  const displayLabel = label ?? t("bannerDetailBack");
  return (
    <Link
      href={href}
      className="inline-flex min-h-[44px] items-center gap-2 text-primary"
      data-figma-node="3550:73356"
    >
      <CaretLeftIcon size={20} weight="bold" />
      <span className="font-orbitron font-semibold text-[16px] leading-[24px]">{displayLabel}</span>
    </Link>
  );
}
