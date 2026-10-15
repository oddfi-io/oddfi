import type { HomeBannerData } from "@/types/home-banner";
import { resolveDecoration } from "@/lib/home-banner-decorations";
import OddsListBanner from "../parts/OddsListBanner";
import BannerBackdrop from "../parts/BannerBackdrop";

interface B4TopScorerBannerProps {
  data: HomeBannerData;
  priority?: boolean;
}

/**
 * B4 金靴奖 / Top Scorer（Figma 3223:59）
 * 深红底 #9a111a + 5 层斜切背景 + 金靴插画（scaleY(-1) rotate(167.67deg)）+ GOLDEN BOOT 标签 + 4 行赔率（GoalsBar 无 Bet）
 */
export default function B4TopScorerBanner({ data, priority = false }: B4TopScorerBannerProps) {
  const illustration = resolveDecoration(data.decoration_key, data.template_id);
  return (
    <OddsListBanner
      data={data}
      variant="top_golden_boot_name"
      // @figma-hardcoded: #9a111a banner-b4-bg — pending design token
      background="#9a111a"
      titleStyle={{
        // @figma intentional non-integer — Figma 33.231px / lh 38.5px
        fontSize: 33.231,
        lineHeight: "38.5px",
        // @figma-hardcoded: linear yellow-tint banner-b4-title — pending design token
        backgroundImage: "linear-gradient(180deg, #fff8dc 0%, #ffd36a 100%)",
      }}
      titleGradient
      backdrop={<BannerBackdrop variant="top_golden_boot_name" />}
      illustration={illustration}
      priority={priority}
      // Figma 3223:122 金靴: 外框 left=325 top=26 w=381 h=334，内层 331×270 + scaleY(-1) rotate(167.67deg)
      // 居中位置：left=350 top=58 (325+381/2-331/2, 26+334/2-270/2)
      illustrationStyle={{
        left: 350,
        top: 58,
        width: 331,
        height: 270,
        transform: "rotate(156.92deg) scaleY(-1)",
      }}
    />
  );
}
