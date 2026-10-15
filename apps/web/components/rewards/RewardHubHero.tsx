import { Fragment } from "react";
import Image from "next/image";
import { GiftIcon, UserIcon } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";

const HERO_COIN = "/images/rewards/hero-coin.png";
const TAG_TROPHY = "/images/rewards/tag-trophy.png";

/**
 * RewardHubHero —— 奖励中心促销头图（DD-150）。Figma PC 9003:160462(head) · H5 9021:163601。
 *
 * 注意：Figma 的 head(680) 含全局 TopNav，但本项目 layout 已渲染 TopNav，
 * 故此组件**只渲染 Nav 以下的促销内容**（tag + 标题 + 副标题 + 2 统计卡 + 3D 头图）。
 *
 * 响应式：PC(md+) 左文案 + 右侧 bleed 3D 头图；H5(<md) 头图在上(底部渐隐) + 居中文案。
 * stat 卡 2：person 图标 + 24,183 语义为「参与人数」，Figma 两卡 label 同为「总奖池」
 * 疑似设计笔误 → 采用 participants 文案并在 ACCEPTANCE 标注待设计确认。
 */

const STATS = [
  { key: "totalPool", value: "5,000,000", Icon: GiftIcon },
  { key: "participants", value: "24,183", Icon: UserIcon },
] as const;

export function RewardHubHero() {
  const t = useTranslations("rewards.hero");

  return (
    <section className="relative w-full overflow-hidden">
      {/* ===== H5（<md）：头图在上，底部渐隐到页面底色 ===== */}
      <div className="md:hidden">
        <div className="relative mx-auto h-[219px] w-full max-w-[480px] overflow-hidden">
          <div className="absolute left-1/2 top-0 h-full w-[119%] -translate-x-1/2">
            <Image
              src={HERO_COIN}
              alt=""
              fill
              priority
              // 内层 w-[119%] of max-w-[480px] → 渲染宽达 ~571px，sizes 取该值防 next/image 选小源放大糊图（static-assets §11）
              sizes="571px"
              className="object-cover object-center"
            />
          </div>
          {/* @figma-hardcoded: #04060c hero-gradient-end = bg/primary — pending design token（Figma 9021:163605） */}
          <div className="pointer-events-none absolute bottom-0 left-0 h-[61px] w-full bg-gradient-to-b from-transparent to-[#04060c]" />
        </div>
      </div>

      {/* ===== PC（md+）：右侧 bleed 3D 头图 =====
          Figma head(1440×680) 内图节点 9001:159222 = left 493 / top 96 / 1037×545。
          用 max-w-[1440px] 定位框约束：72% / 34.2% 在 1440 基准下换算回 1037px / 493px，
          监视器 >1440 时不再随视口放大（修「coin 过大」）。top-4 = 96−80(已被 layout 渲染的 nav)。 */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 hidden md:block">
        <div className="relative mx-auto max-w-[1440px]">
          <div className="absolute left-[34.2%] top-4 aspect-[1024/538] w-[72%]">
            <Image
              src={HERO_COIN}
              alt=""
              fill
              priority
              sizes="(min-width: 768px) 1037px, 0px"
              className="object-contain object-right-top"
            />
          </div>
        </div>
      </div>

      {/* ===== 文案区 ===== */}
      <div className="relative mx-auto w-full max-w-[1200px] px-4 pt-3 md:px-[120px] md:pb-10 md:pt-[103px]">
        <div className="flex flex-col items-center gap-6 md:w-[686px] md:items-start md:gap-10">
          <div className="flex flex-col items-center gap-3 md:items-start md:gap-6">
            {/* Tag */}
            <div className="flex h-9 items-center justify-center gap-2 rounded-full bg-[rgba(237,177,79,0.2)] px-4 py-2 md:h-auto">
              {/* @figma-hardcoded: #edb14f tag-trophy gold — pending design token */}
              <span className="relative h-6 w-[11px] shrink-0 overflow-hidden">
                <Image
                  src={TAG_TROPHY}
                  alt=""
                  width={17}
                  height={24}
                  className="absolute left-[-25%] top-0 h-full max-w-none"
                />
              </span>
              <span className="whitespace-nowrap text-xs font-medium leading-[18px] text-[#edb14f] md:text-sm">
                {t("tag")}
              </span>
            </div>

            {/* 标题 + 副标题 */}
            <div className="flex flex-col items-center gap-2 md:items-start md:gap-4">
              <h1 className="text-center text-[28px] font-bold leading-9 tracking-[-0.28px] text-primary md:text-left md:text-[56px] md:leading-[72px] md:tracking-normal">
                {t("title")}
              </h1>
              <p className="text-center text-sm font-normal leading-[18px] text-secondary md:text-left md:text-xl md:leading-7">
                {t("subtitle1")}
                <br />
                {t("subtitle2")}
              </p>
            </div>
          </div>

          {/* 2 统计卡 */}
          <div className="flex w-full items-center gap-10 rounded-2xl border border-divider bg-fill-card1 px-6 py-4 md:w-auto md:gap-12 md:px-8">
            {STATS.map((stat, i) => (
              <Fragment key={stat.key}>
                {i > 0 && <div className="h-14 w-px shrink-0 self-center bg-divider md:h-[66px]" />}
                <div className="flex flex-1 flex-col items-start gap-1 md:w-[114px] md:flex-none">
                  <stat.Icon className="h-4 w-4 text-brand-default md:h-5 md:w-5" weight="fill" />
                  <span className="text-base font-bold leading-6 text-primary md:text-lg md:leading-[26px]">
                    {stat.value}
                  </span>
                  <span className="text-xs font-medium leading-[18px] text-secondary md:text-sm md:font-normal">
                    {t(`stats.${stat.key}`)}
                  </span>
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
