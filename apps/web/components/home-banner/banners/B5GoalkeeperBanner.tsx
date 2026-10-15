import type { HomeBannerData } from "@/types/home-banner";
import { resolveDecoration } from "@/lib/home-banner-decorations";
import OddsListBanner from "../parts/OddsListBanner";
import BannerBackdrop from "../parts/BannerBackdrop";

interface B5GoalkeeperBannerProps {
  data: HomeBannerData;
  priority?: boolean;
}

/**
 * B5 金手套奖 / Best Goalkeeper（Figma 3231:236）
 * 深紫底 #68119a + 5 层斜切背景 + 金手套插画 + GOLDEN GLOVE 标签 + 4 行赔率（SavesPill 无 Bet）
 */
export default function B5GoalkeeperBanner({ data, priority = false }: B5GoalkeeperBannerProps) {
  const illustration = resolveDecoration(data.decoration_key, data.template_id);
  return (
    <OddsListBanner
      data={data}
      variant="top_golden_glove_name"
      // @figma-hardcoded: #68119a banner-b5-bg — pending design token
      background="#68119a"
      titleStyle={{
        // @figma intentional non-integer — Figma 33.231px / lh 38.5px
        fontSize: 33.231,
        lineHeight: "38.5px",
        // @figma-hardcoded: linear pink-tint banner-b5-title — pending design token
        backgroundImage: "linear-gradient(180deg, #ffffff 0%, #ffbaf1 100%)",
      }}
      titleGradient
      backdrop={<BannerBackdrop variant="top_golden_glove_name" />}
      illustration={illustration}
      priority={priority}
      // Figma 3231:312 金手套: left=357 top=19 w=h=328（靠右对齐）
      illustrationStyle={{ left: 357, top: 19, width: 328, height: 328 }}
    />
  );
}
