import type { HomeBannerData } from "@/types/home-banner";
import { resolveDecoration } from "@/lib/home-banner-decorations";
import OddsListBanner from "../parts/OddsListBanner";
import BannerBackdrop from "../parts/BannerBackdrop";

interface B3MVPBannerProps {
  data: HomeBannerData;
  priority?: boolean;
}

/**
 * B3 金球奖 / MVP（Figma 3110:49585）
 * 青色底 #05929c + 5 层斜切背景 + Bellingham 插画 + GOLDEN BALL 黑字标签 + 4 行赔率（橙 Bet）
 */
export default function B3MVPBanner({ data, priority = false }: B3MVPBannerProps) {
  const illustration = resolveDecoration(data.decoration_key, data.template_id);
  return (
    <OddsListBanner
      data={data}
      variant="top_golden_ball_name"
      // @figma-hardcoded: #05929c banner-b3-bg — pending design token
      background="#05929c"
      titleStyle={{
        // @figma intentional non-integer — Figma 33.231px / lh 1.2
        fontSize: 33.231,
        lineHeight: 1.2,
        // @figma-hardcoded: linear cyan-tint banner-b3-title — pending design token
        backgroundImage: "linear-gradient(180deg, #ffffff 0%, #a8f0ff 100%)",
      }}
      titleGradient
      tagTextColor="#000000"
      backdrop={<BannerBackdrop variant="top_golden_ball_name" />}
      illustration={illustration}
      priority={priority}
      // Figma 3110:49678 image 26: left=400 top=26 w=221 h=338（梅西/贝林厄姆 portrait 居右上）
      illustrationStyle={{ left: 400, top: 26, width: 221, height: 338 }}
      // @figma-hardcoded: rgb(255,124,43) → rgb(255,192,34) bet-btn-b3-gradient — pending design token
      betGradient="linear-gradient(106.898deg, rgb(255, 124, 43) 6.8116%, rgb(255, 192, 34) 94.857%)"
      // @figma-hardcoded: #060724 bet-btn-b3-text — pending design token
      betTextColor="#060724"
    />
  );
}
