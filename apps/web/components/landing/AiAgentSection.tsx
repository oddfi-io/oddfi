import Image from "next/image";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import AiAgentCard from "./ai-agent/AiAgentCard";

/**
 * §9 AI Agent Section（Figma 节点 4227:195234）
 *
 * 布局：
 * - 顶部居中 "即将上线" badge + H2 + 副标题
 * - 中部 3 卡横向（1202px container）
 * - 底部居中白色按钮 "抢先锁定内测资格"
 *
 * 背景：linear-gradient(155.637deg, #0c0c0f 64.5% → rgba(40,244,210,0.7) 101.7% → #28f4d2 155.9%)
 *
 * Phase 1 静态版：3 卡静态网格，不做入场动画。
 */

const aiCards = [
  {
    cardKey: "card1" as const,
    iconSrc: "/images/landing/ai-robot.svg",
    iconAlt: "Train your agent",
    iconSize: { width: 52, height: 52 },
  },
  {
    cardKey: "card2" as const,
    iconSrc: "/images/landing/ai-trophy.svg",
    iconAlt: "Auto predict",
    iconSize: { width: 46, height: 52 },
  },
  {
    cardKey: "card3" as const,
    iconSrc: "/images/landing/ai-brain.svg",
    iconAlt: "Trade memory",
    iconSize: { width: 49, height: 52 },
  },
];

export default function AiAgentSection() {
  const t = useTranslations("landing.aiAgent");
  return (
    <section
      data-section="ai-agent"
      data-figma-node="4227:195234"
      className="relative w-full overflow-hidden"
      style={{
        // @figma-hardcoded: linear-gradient(155.637deg, #0c0c0f 64.539% → rgba(40,244,210,0.7) 101.71% → #28f4d2 155.89%) — pending design token
        backgroundImage:
          "linear-gradient(155.637deg, rgb(12, 12, 15) 64.539%, rgba(40, 244, 210, 0.7) 101.71%, rgb(40, 244, 210) 155.89%)",
      }}
    >
      <div className="mx-auto flex w-full max-w-[1440px] flex-col items-center gap-[59px] px-[120px] py-[100px]">
        {/* Header */}
        <div className="flex flex-col items-center gap-[24px]">
          {/* 即将上线 badge（114x36） - hidden per product request */}
          <div
            // @figma-hardcoded: rgba(255,255,255,0.1) badge-bg — pending design token
            className="hidden flex h-[36px] items-center justify-center gap-[6px] rounded-full bg-[rgba(255,255,255,0.1)] px-[16px] py-[6px]"
          >
            <span className="relative size-[20px] shrink-0">
              <Image
                src="/images/landing/ai-sparkle.svg"
                alt=""
                fill
                sizes="20px"
                className="object-contain"
                aria-hidden="true"
              />
            </span>
            <span className="text-[14px] leading-[19px] text-white">{t("comingSoon")}</span>
          </div>

          <div className="flex flex-col items-center gap-[16px] text-center">
            <h2 className="whitespace-nowrap text-[48px] font-bold leading-[64px] text-primary">
              {t("title")}
            </h2>
            <p className="whitespace-nowrap text-[16px] leading-[24px] text-white opacity-70">
              {t("subtitle")}
            </p>
          </div>
        </div>

        {/* 3 卡 Container 1202px */}
        <div className="flex w-full max-w-[1202px] items-start gap-[24px]">
          {aiCards.map((c) => (
            <AiAgentCard
              key={c.cardKey}
              iconSrc={c.iconSrc}
              iconAlt={c.iconAlt}
              iconSize={c.iconSize}
              title={t(`${c.cardKey}.title`)}
              description={t(`${c.cardKey}.description`)}
            />
          ))}
        </div>

        {/* 底部 CTA 按钮 — hover 同 MatchesGlassWall 见证按钮：宽度撑开 + 右侧 ArrowRight 滑入 */}
        <button
          type="button"
          // @figma-hardcoded: #ffffff btn-bg, #04060c btn-text — pending design token
          className="group flex h-[56px] items-center justify-center gap-[8px] overflow-hidden rounded-[12px] bg-white px-[16px] py-[8px] text-[16px] font-medium leading-[24px] text-[#04060c] transition-[background-color] duration-300 ease-out hover:bg-[#f1f1f1]"
          style={{ touchAction: "manipulation" }}
        >
          <span className="whitespace-nowrap">{t("ctaButton")}</span>
          <span
            aria-hidden="true"
            className="-ml-[8px] flex w-0 shrink-0 items-center justify-center opacity-0 transition-[width,opacity,margin] duration-300 ease-out group-hover:ml-0 group-hover:w-[24px] group-hover:opacity-100"
          >
            <ArrowRightIcon size={24} weight="regular" className="shrink-0" />
          </span>
        </button>
      </div>
    </section>
  );
}
