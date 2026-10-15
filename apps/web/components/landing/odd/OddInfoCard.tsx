import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useTranslations } from "next-intl";
import OddInfoRow from "./OddInfoRow";
import OddFlywheelSvg from "./OddFlywheelSvg";

/**
 * §7 ODD Token 信息卡（Figma 节点 4227:195212 — Frame 481954, 1184×540）
 *
 * 结构：左 4 row + Buy 按钮 / 右 飞轮 SVG
 * 容器：bg-[rgba(13,13,15,0.4)] 半透明深色 + 圆角 24，无描边、无液态玻璃。
 */
export default function OddInfoCard() {
  const t = useTranslations("landing.oddToken");
  return (
    <div
      data-figma-node="4227:195212"
      // @figma-hardcoded: rgba(13,13,15,0.4) info-card bg (Figma P3: color(display-p3 0.051 0.051 0.0588 / 0.40), 视觉差 <0.1% 用 sRGB 近似), rgba(255,255,255,0.08) border — pending design token
      className="flex w-full items-center justify-between rounded-[24px] border border-[rgba(255,255,255,0.08)] bg-[rgba(13,13,15,0.4)] p-[64px] backdrop-blur-[12px]"
    >
      {/* 左侧：4 row + Buy 按钮 */}
      <div className="flex w-[400px] shrink-0 flex-col items-start gap-[40px]">
        <div className="flex w-full flex-col items-start gap-[20px]">
          <OddInfoRow
            label={t("tokenName")}
            value="OddFi Token (ODD)"
            icon={{ src: "/images/tokens/odd.svg", alt: "ODD" }}
          />
          <OddInfoRow label={t("totalSupply")} value="100,000,000 ODD" />
          <OddInfoRow
            label={t("network")}
            value="BNB Smart Chain"
            icon={{ src: "/images/chains/bsc.svg", alt: "BNB Smart Chain" }}
          />
          <OddInfoRow
            label={t("dex")}
            value="PancakeSwap ODD/USDT"
            icon={{
              src: "/images/providers/pancake-icon.png",
              alt: "PancakeSwap",
              objectCover: true,
            }}
          />
        </div>

        {/* 即刻购买 ODD 按钮（Figma 5410:109748） */}
        <Link
          href="/swap"
          data-figma-node="5410:109748"
          // @figma-hardcoded: white buy-btn-bg, #04060c buy-btn-text — pending design token
          className="flex h-[56px] w-[400px] items-center justify-center gap-[8px] rounded-[12px] bg-white px-[16px] py-[8px] text-[16px] font-medium leading-[24px] text-[#04060c]"
          style={{ touchAction: "manipulation" }}
        >
          <span>{t("buyButton")}</span>
          <ArrowUpRightIcon size={24} weight="bold" />
        </Link>
      </div>

      {/* 右侧：飞轮 SVG（静态） */}
      <OddFlywheelSvg />
    </div>
  );
}
