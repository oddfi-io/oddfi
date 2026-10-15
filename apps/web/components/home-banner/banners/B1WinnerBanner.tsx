import type { HomeBannerData } from "@/types/home-banner";
import { resolveDecoration } from "@/lib/home-banner-decorations";
import OddsListBanner from "../parts/OddsListBanner";
import BannerBackdrop from "../parts/BannerBackdrop";

interface B1WinnerBannerProps {
  data: HomeBannerData;
  priority?: boolean;
}

/**
 * B1 夺冠市场（Figma 3231:371 World Cup Winner）
 * 深蓝底 #101399 + 5 层斜切背景 + 世界杯奖杯插画 + HOT MARKET 火焰标签 + 4 行赔率
 */
export default function B1WinnerBanner({ data, priority = false }: B1WinnerBannerProps) {
  const illustration = resolveDecoration(data.decoration_key, data.template_id);
  return (
    <OddsListBanner
      data={data}
      variant="top_wins_the_world_cup"
      // @figma-hardcoded: #101399 banner-b1-bg — pending design token
      background="#101399"
      titleStyle={{
        // @figma intentional non-integer — Figma 33.231px / lh 1.8
        fontSize: 33.231,
        lineHeight: 1.8,
        // @figma-hardcoded: #f8f8f8 banner-b1-title — pending design token
        color: "#f8f8f8",
      }}
      titleTransform="capitalize"
      backdrop={<BannerBackdrop variant="top_wins_the_world_cup" />}
      illustration={illustration}
      priority={priority}
      // Figma 3104:43834 奖杯: left=406 top=64 w=244.261 h=434.243（超出底部裁剪）
      illustrationStyle={{ left: 406, top: 64, width: 244.261, height: 434.243 }}
      // Figma 3231:371 B1 内容区: 标题 left=28 top=55、赔率行底部 bottom=34 left=28
      bodyPadding={{ top: 55, right: 28, bottom: 34, left: 28 }}
      rowGap={12}
    />
  );
}
