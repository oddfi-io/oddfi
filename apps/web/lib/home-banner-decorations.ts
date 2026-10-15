// decoration_key → 静态装饰资源映射
// 后端只返回 key，前端解析为实际资源路径，实现动静分离

import type { TemplateId } from "@/types/home-banner";

export const BANNER_DECORATIONS: Record<string, string> = {
  world_cup_trophy: "/banner/illustrations/world_cup_trophy.png",
  player_ronaldo: "/banner/illustrations/player_ronaldo.png",
  player_bellingham: "/banner/illustrations/player_bellingham.png",
  golden_boot: "/banner/illustrations/golden_boot.png",
  golden_glove: "/banner/illustrations/golden_glove.png",
};

// template_id → 默认装饰资源（decoration_key 未命中时的 fallback）
export const BANNER_DEFAULT_DECORATION: Record<string, string> = {
  B1: BANNER_DECORATIONS.world_cup_trophy,
  B2: BANNER_DECORATIONS.player_ronaldo,
  B3: BANNER_DECORATIONS.player_bellingham,
  B4: BANNER_DECORATIONS.golden_boot,
  B5: BANNER_DECORATIONS.golden_glove,
};

// tag_text → 标签左侧小图标
// HOT MARKET 用 Figma 导出的火焰图标，其余 tag 图标待 Figma 补全
export const BANNER_TAG_ICONS: Record<string, string> = {
  "HOT MARKET": "/banner/icons/fire-tag.svg",
  "PLAYER SPECIAL": "/banner/tags/player-special.svg",
  "GOLDEN BALL": "/banner/tags/golden-ball.svg",
  "GOLDEN BOOT": "/banner/tags/golden-boot.svg",
  "GOLDEN GLOVE": "/banner/tags/golden-glove.svg",
};

// tag_text → 标签整体背景 SVG（Figma 3231:414 等异形胶囊形）
// 命中则覆盖 tag_color 纯色/渐变回退
export const BANNER_TAG_BACKGROUNDS: Record<string, string> = {
  "HOT MARKET": "/banner/tags/hot-market-bg.svg",
};

export function resolveDecoration(key: string, templateId: string): string {
  return BANNER_DECORATIONS[key] ?? BANNER_DEFAULT_DECORATION[templateId] ?? "";
}

// ───────────────────────────────────────────────────────────────────────────
// DD-143 新版推广 banner 主题（2026-06-15 设计）
// 5 张卡布局一致，按 template_id 主题化：标题色 + hover 描边色 + 背景 SVG + 右侧插画。
// 几何值（box / img 的 px 与偏移）均由 Figma get_design_context 实测转录（节点 8487:109828 等），
// 禁止臆测；插画资源走 -v2 命名避开 30 天长缓存覆盖（static-assets §9）。
// ───────────────────────────────────────────────────────────────────────────

/** 单张插画的渲染规格（next/image 用 px，遵 static-assets §11 防糊） */
export interface PromoIllustrationSpec {
  /** 插画 PNG 路径 */
  src: string;
  /** 外层裁剪框：绝对定位于卡中心（translate(-50%,-50%) 基准），可溢出卡片由卡 overflow-hidden 裁切 */
  box: { width: number; height: number; left: string; top: string };
  /**
   * 内层图片：渲染像素宽高 + 相对 box 的偏移；transform 用于旋转插画（金靴卡）。
   * center=true 时改用 flex 居中（不读 left/top），transform 仅含 rotate/scale，
   * 避免「translate 居中」与 rotate 组合后在旋转坐标系里错位（金靴卡专用）。
   * 注：插画不裁切时 img 尺寸/偏移 == box（如 total_goals/golden_glove，内层退化为透明壳）；
   * 仅 trophy/mvp 用到「img 大于 box + 负偏移」的裁切框语义，两层模型为这两卡而存在。
   */
  img: {
    width: number;
    height: number;
    left: string;
    top: string;
    transform?: string;
    center?: boolean;
  };
}

/** 单个推广 banner 模板的主题 */
export interface PromoBannerTheme {
  /** 标题文字色（@figma-hardcoded，待设计补 token） */
  titleColor: string;
  /** hover 描边色（@figma-hardcoded，待设计补 token） */
  hoverBorderColor: string;
  /** 全卡背景装饰 SVG（不同主题不同 glow 配色） */
  background: string;
  /** 右侧插画规格 */
  illustration: PromoIllustrationSpec;
}

/**
 * 三套主题配色（标题色 / hover 描边 / 背景 glow），与插画几何解耦。
 * 金色被 3 张卡共用（夺冠/金靴/金手套），抽出常量避免三处复制后漂移。
 * @figma-hardcoded: #edb14f/#1bf19f/#3091e3 标题色、#a77f3c/#199264/#3091e3 hover 描边 — pending design token
 * 待设计补 token 时，集中改此三常量即可（不必逐卡）。
 */
type PromoPalette = Pick<PromoBannerTheme, "titleColor" | "hoverBorderColor" | "background">;

const GOLD_PALETTE: PromoPalette = {
  titleColor: "#edb14f",
  hoverBorderColor: "#a77f3c",
  background: "/banner/backdrops/promo/gold.svg",
};
const GREEN_PALETTE: PromoPalette = {
  titleColor: "#1bf19f",
  hoverBorderColor: "#199264",
  background: "/banner/backdrops/promo/green.svg",
};
const BLUE_PALETTE: PromoPalette = {
  titleColor: "#3091e3",
  hoverBorderColor: "#3091e3",
  background: "/banner/backdrops/promo/blue.svg",
};

/**
 * template_id → 推广卡主题。
 * 标题文案取后端 data.title（已本地化），此处只决定视觉主题：配色（palette）+ 插画几何。
 */
export const PROMO_BANNER_THEMES: Record<TemplateId, PromoBannerTheme> = {
  // banner-01 夺冠盘 · 金色主题
  top_wins_the_world_cup: {
    ...GOLD_PALETTE,
    illustration: {
      src: "/banner/illustrations/world_cup_trophy-v2.png",
      box: { width: 83, height: 178, left: "calc(50% + 100.5px)", top: "calc(50% - 8px)" },
      img: { width: 125, height: 187, left: "-20.84px", top: "-8.47px" },
    },
  },
  // banner-02 罗纳尔多进球 · 绿色主题
  total_goals: {
    ...GREEN_PALETTE,
    illustration: {
      src: "/banner/illustrations/player_ronaldo-v2.png",
      box: { width: 174, height: 232, left: "calc(50% + 93px)", top: "calc(50% - 9px)" },
      img: { width: 174, height: 232, left: "0px", top: "0px" },
    },
  },
  // banner-03 MVP/金球 · 蓝色主题
  top_golden_ball_name: {
    ...BLUE_PALETTE,
    illustration: {
      src: "/banner/illustrations/player_mvp-v2.png",
      box: { width: 168, height: 210, left: "calc(50% + 87px)", top: "calc(50% - 8px)" },
      img: { width: 313, height: 210, left: "-78.47px", top: "0px" },
    },
  },
  // banner-04 金靴 · 金色主题（插画旋转 156.92° + Y 翻转）
  top_golden_boot_name: {
    ...GOLD_PALETTE,
    illustration: {
      src: "/banner/illustrations/golden_boot-v2.png",
      box: { width: 226, height: 209, left: "calc(50% + 85.14px)", top: "calc(50% - 8px)" },
      img: {
        width: 182,
        height: 149,
        left: "0px",
        top: "0px",
        center: true,
        // Figma: 外层 flex 居中 + 内层 `-scale-y-100 rotate-[156.92deg]`
        // Tailwind 合成顺序为 rotate 先于 scale，故写 rotate→scaleY（与 flex 居中解耦）
        transform: "rotate(156.92deg) scaleY(-1)",
      },
    },
  },
  // banner-05 金手套 · 金色主题
  top_golden_glove_name: {
    ...GOLD_PALETTE,
    illustration: {
      src: "/banner/illustrations/golden_glove-v2.png",
      box: { width: 182, height: 182, left: "calc(50% + 98px)", top: "calc(50% - 10px)" },
      img: { width: 182, height: 182, left: "0px", top: "0px" },
    },
  },
};

/** 卡片底色（@figma-hardcoded: #131114 promo-card-bg — pending design token） */
export const PROMO_BANNER_CARD_BG = "#131114";
