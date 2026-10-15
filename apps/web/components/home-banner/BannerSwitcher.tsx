import type { HomeBannerData } from "@/types/home-banner";
import B1WinnerBanner from "./banners/B1WinnerBanner";
import B2PlayerPropBanner from "./banners/B2PlayerPropBanner";
import B3MVPBanner from "./banners/B3MVPBanner";
import B4TopScorerBanner from "./banners/B4TopScorerBanner";
import B5GoalkeeperBanner from "./banners/B5GoalkeeperBanner";

interface BannerSwitcherProps {
  data: HomeBannerData;
  priority?: boolean;
}

/**
 * 按 template_id 路由到具体 Banner 组件
 * items 为空时隐藏整卡
 */
export default function BannerSwitcher({ data, priority = false }: BannerSwitcherProps) {
  if (data.items.length === 0) return null;

  switch (data.template_id) {
    case "top_wins_the_world_cup":
      return <B1WinnerBanner data={data} priority={priority} />;
    case "total_goals":
      return <B2PlayerPropBanner data={data} priority={priority} />;
    case "top_golden_ball_name":
      return <B3MVPBanner data={data} priority={priority} />;
    case "top_golden_boot_name":
      return <B4TopScorerBanner data={data} priority={priority} />;
    case "top_golden_glove_name":
      return <B5GoalkeeperBanner data={data} priority={priority} />;
    default:
      return null;
  }
}
