"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import FaqItem from "./faq/FaqItem";

/**
 * §11 FAQ Section — Figma 节点 5895:24786
 *
 * 容器 1200×654, items-start, justify-between, pb-[80px]
 * 左栏 160×152: H2 "FAQ" (48/64 Bold) + "查看更多" 白色按钮 (160×56, rounded-[12px])
 * 右栏 700×574: 6 行 FAQ 折叠列表，gap-[18px]，border 1px #212124
 */

type FaqEntry = { question: string; answer: string };

export default function FaqSection() {
  const t = useTranslations("landing.faq");
  const FAQS = useMemo(() => t.raw("items") as FaqEntry[], [t]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section data-section="faq" data-figma-node="5895:24786" className="relative w-full bg-primary">
      <div className="relative mx-auto flex w-[1200px] items-start justify-between pb-[80px]">
        {/* 左栏 — 标题 + 查看更多按钮 */}
        <div data-figma-node="5895:24787" className="flex shrink-0 flex-col items-start gap-[32px]">
          <h2 className="font-noto-sc whitespace-nowrap text-[48px] font-bold leading-[64px] text-primary">
            {t("title")}
          </h2>
          <a
            href="https://oddfi.gitbook.io/oddfi-docs-1"
            target="_blank"
            rel="noopener noreferrer"
            data-figma-node="5897:24934"
            style={{ touchAction: "manipulation" }}
            // @figma-hardcoded: #04060c view-more-text — token text/white-to-back
            className="flex h-[56px] w-[160px] items-center justify-center gap-[8px] rounded-[12px] bg-white px-[24px] py-[8px] text-[16px] font-medium leading-[24px] text-[#04060c]"
          >
            {t("viewMore")}
          </a>
        </div>

        {/* 右栏 — 6 行 FAQ 折叠列表 */}
        <div
          data-figma-node="5897:24941"
          className="flex w-[700px] shrink-0 flex-col items-start gap-[18px]"
        >
          {FAQS.map((f, i) => (
            <FaqItem
              key={f.question}
              question={f.question}
              answer={f.answer}
              open={openIndex === i}
              onToggle={() => setOpenIndex((cur) => (cur === i ? null : i))}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
