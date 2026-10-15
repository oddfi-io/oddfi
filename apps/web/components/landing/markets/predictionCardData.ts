import type { CSSProperties } from "react";
import type { TemplateId } from "@/types/home-banner";

/**
 * Landing §2 PredictionCard 数据（Figma 5639:70361 5 张卡片）
 *
 * 复用规则：
 * - Card 1 trophy 来自用户提供 zip → /images/landing/markets/trophy.png
 * - Card 2/3 复用 players/* 现有资源
 * - Card 4/5 复用 banner/illustrations/* 金靴/金手套
 *
 * imageContainerStyle / imageInnerStyle 参考 Figma 节点（450×516 卡内坐标系）：
 * - 普通卡（1/2/3/5）：仅 imageContainerStyle，image 直接 fill 容器
 * - 转换卡（4 球鞋）：外层 flex 居中（imageContainerStyle），内层定尺寸 + transform（imageInnerStyle）
 *   transform 顺序需匹配 Tailwind 类生成顺序（scale 先，rotate 后），CSS 字符串中靠右先应用
 */
export interface PredictionCardItem {
  id: string;
  title: string;
  imageSrc: string;
  imageAlt: string;
  /** 对应市场 banner 详情页的 template_id（点击跳转 /markets/banner/<bannerCode>） */
  bannerCode: TemplateId;
  /** 图片绝对定位容器（450×516 卡坐标系） */
  imageContainerStyle: CSSProperties;
  /** 可选内层 wrapper：用于 transform / 自定义内层尺寸；image 填满它 */
  imageInnerStyle?: CSSProperties;
  /** next/image priority — 仅 Card 1 设 true */
  priority?: boolean;
  /** next/image sizes 覆盖；默认 `(min-width: 1440px) 450px, 50vw`。
   * 内层 img 横向溢出（如 Card 3 messi-mvp 渲染 ~814px）时需显式给更大值。 */
  imageSizes?: string;
}

export const PREDICTION_CARDS: PredictionCardItem[] = [
  {
    id: "world-cup-winner",
    title: "谁将赢得世界杯？",
    imageSrc: "/images/landing/markets/trophy.png",
    imageAlt: "FIFA World Cup trophy",
    bannerCode: "top_wins_the_world_cup",
    // Figma 5655:6909 image container：left=calc(50%-5.5px) top=0 w=227 h=488 + translateX(-50%)
    // trophy.png 实际像素 227×488 = viewport-cropped 版，直接 fill container 即可
    imageContainerStyle: {
      left: "calc(50% - 5.5px)",
      top: 0,
      width: 227,
      height: 488,
      transform: "translateX(-50%)",
    },
    priority: true,
  },
  {
    id: "ronaldo-goals",
    title: "罗纳尔多总进球数",
    imageSrc: "/images/landing/players/ronaldo.png",
    imageAlt: "Cristiano Ronaldo",
    bannerCode: "total_goals",
    imageContainerStyle: {
      left: "50%",
      top: -50,
      width: 433.02,
      height: 578,
      transform: "translateX(-50%)",
    },
  },
  {
    id: "mvp",
    title: "谁会成为最有价值球员？",
    imageSrc: "/images/landing/players/messi-mvp.png",
    imageAlt: "Lionel Messi",
    bannerCode: "top_golden_ball_name",
    // Figma 5788:54395 图外框：450×516 卡内 left=0 top=-26 w=436 h=542，overflow-hidden 裁切横向溢出
    imageContainerStyle: {
      left: 0,
      top: -26,
      width: 436,
      height: 542,
      overflow: "hidden",
    },
    // Figma 5788:54396 内层 img：width=186.55% left=-46.71%（横向溢出由父级裁切）
    // 渲染像素宽 = 436 × 1.8655 ≈ 813.6px → sizes 取 828
    imageInnerStyle: {
      position: "absolute",
      left: "-46.71%",
      top: 0,
      width: "186.55%",
      height: "100%",
    },
    imageSizes: "(min-width: 1440px) 828px, 92vw",
  },
  {
    id: "top-scorer",
    title: "谁将成为最佳射手？",
    imageSrc: "/banner/illustrations/golden_boot.png",
    imageAlt: "Golden Boot",
    bannerCode: "top_golden_boot_name",
    // Figma 5655:17669: 外层 flex 居中容器 + 内层 324×265 应用 scaleY(-1) → rotate(156.92°)
    imageContainerStyle: {
      left: 24,
      top: 15,
      width: 401.772,
      height: 370.413,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    imageInnerStyle: {
      width: 323.983,
      height: 264.586,
      position: "relative",
      // CSS 字符串靠右先应用：scaleY(-1) 先，再 rotate(156.92°)（与 Tailwind class 等价）
      transform: "rotate(156.92deg) scaleY(-1)",
    },
  },
  {
    id: "best-goalkeeper",
    title: "谁将成为最佳门将？",
    imageSrc: "/banner/illustrations/golden_glove.png",
    imageAlt: "Golden Glove",
    bannerCode: "top_golden_glove_name",
    // Figma 5655:17742: 352×352 居中略偏下
    imageContainerStyle: { left: 82, top: 13, width: 352, height: 352 },
  },
];
