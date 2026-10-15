import Image from "next/image";
import type { TemplateId } from "@/types/home-banner";

type BackdropVariant = TemplateId;

// 用于 SVG 资源目录命名（保持 b1~b5 短名，无需重新命名物理文件夹）
const BACKDROP_SLUG: Record<BackdropVariant, string> = {
  top_wins_the_world_cup: "b1",
  total_goals: "b2",
  top_golden_ball_name: "b3",
  top_golden_boot_name: "b4",
  top_golden_glove_name: "b5",
};

interface Layer {
  id: string;
  file: string;
  left: number;
  top: number;
  width: number;
  height: number;
  transform?: string;
}

const RECT_WIDE = 369.61;
const RECT_NARROW = 339.261;
const RECT_HEIGHT = 362.023;

/**
 * 5 层斜切矩形装饰（Figma 3231:371 / 3110:44216 / 3110:49585 / 3223:59 / 3231:236）
 * 形状一致（rect-10~14 path 相同），每 variant 只换 SVG 内 linearGradient 颜色 + 微调位置
 */
const LAYERS: Record<BackdropVariant, Layer[]> = {
  // top_wins_the_world_cup — World Cup Winner（蓝）
  top_wins_the_world_cup: [
    {
      id: "rect-13",
      file: "rect-13.svg",
      left: -127.81,
      top: 23,
      width: RECT_WIDE,
      height: RECT_HEIGHT,
      transform: "scaleX(-1)",
    },
    {
      id: "rect-14",
      file: "rect-14.svg",
      left: -152.46,
      top: 1,
      width: RECT_NARROW,
      height: RECT_HEIGHT,
      transform: "rotate(180deg)",
    },
    {
      id: "rect-12",
      file: "rect-12.svg",
      left: 303,
      top: -22,
      width: RECT_WIDE,
      height: RECT_HEIGHT,
      transform: "scaleY(-1)",
    },
    {
      id: "rect-10",
      file: "rect-10.svg",
      left: 358,
      top: 0,
      width: RECT_NARROW,
      height: RECT_HEIGHT,
    },
    {
      id: "rect-11",
      file: "rect-11.svg",
      left: 412.19,
      top: 0,
      width: RECT_WIDE,
      height: RECT_HEIGHT,
      transform: "scaleY(-1)",
    },
  ],
  // total_goals — Player Special（金）— 位置与夺冠盘相同
  total_goals: [
    {
      id: "rect-13",
      file: "rect-13.svg",
      left: -127.81,
      top: 23,
      width: RECT_WIDE,
      height: RECT_HEIGHT,
      transform: "scaleX(-1)",
    },
    {
      id: "rect-14",
      file: "rect-14.svg",
      left: -152.46,
      top: 1,
      width: RECT_NARROW,
      height: RECT_HEIGHT,
      transform: "rotate(180deg)",
    },
    {
      id: "rect-12",
      file: "rect-12.svg",
      left: 303,
      top: -22,
      width: RECT_WIDE,
      height: RECT_HEIGHT,
      transform: "scaleY(-1)",
    },
    {
      id: "rect-10",
      file: "rect-10.svg",
      left: 358,
      top: 0,
      width: RECT_NARROW,
      height: RECT_HEIGHT,
    },
    {
      id: "rect-11",
      file: "rect-11.svg",
      left: 412.19,
      top: 0,
      width: RECT_WIDE,
      height: RECT_HEIGHT,
      transform: "scaleY(-1)",
    },
  ],
  // top_golden_ball_name — Golden Ball（青）
  top_golden_ball_name: [
    {
      id: "rect-13",
      file: "rect-13.svg",
      left: -106.8,
      top: 22,
      width: RECT_WIDE,
      height: RECT_HEIGHT,
      transform: "scaleX(-1)",
    },
    {
      id: "rect-14",
      file: "rect-14.svg",
      left: -130.46,
      top: 1,
      width: RECT_NARROW,
      height: RECT_HEIGHT,
      transform: "rotate(180deg)",
    },
    {
      id: "rect-12",
      file: "rect-12.svg",
      left: 303,
      top: -22,
      width: RECT_WIDE,
      height: RECT_HEIGHT,
      transform: "scaleY(-1)",
    },
    {
      id: "rect-10",
      file: "rect-10.svg",
      left: 357,
      top: -1,
      width: RECT_NARROW,
      height: RECT_HEIGHT,
    },
    {
      id: "rect-11",
      file: "rect-11.svg",
      left: 411.2,
      top: -1,
      width: RECT_WIDE,
      height: RECT_HEIGHT,
      transform: "scaleY(-1)",
    },
  ],
  // top_golden_boot_name — Golden Boot（深红）— 与金球同位置
  top_golden_boot_name: [
    {
      id: "rect-13",
      file: "rect-13.svg",
      left: -106.8,
      top: 22,
      width: RECT_WIDE,
      height: RECT_HEIGHT,
      transform: "scaleX(-1)",
    },
    {
      id: "rect-14",
      file: "rect-14.svg",
      left: -130.46,
      top: 1,
      width: RECT_NARROW,
      height: RECT_HEIGHT,
      transform: "rotate(180deg)",
    },
    {
      id: "rect-12",
      file: "rect-12.svg",
      left: 303,
      top: -22,
      width: RECT_WIDE,
      height: RECT_HEIGHT,
      transform: "scaleY(-1)",
    },
    {
      id: "rect-10",
      file: "rect-10.svg",
      left: 357,
      top: -1,
      width: RECT_NARROW,
      height: RECT_HEIGHT,
    },
    {
      id: "rect-11",
      file: "rect-11.svg",
      left: 411.2,
      top: -1,
      width: RECT_WIDE,
      height: RECT_HEIGHT,
      transform: "scaleY(-1)",
    },
  ],
  // top_golden_glove_name — Golden Glove（紫）
  top_golden_glove_name: [
    {
      id: "rect-13",
      file: "rect-13.svg",
      left: -114,
      top: 21,
      width: RECT_WIDE,
      height: RECT_HEIGHT,
      transform: "scaleX(-1)",
    },
    {
      id: "rect-14",
      file: "rect-14.svg",
      left: -130.46,
      top: 1,
      width: RECT_NARROW,
      height: RECT_HEIGHT,
      transform: "rotate(180deg)",
    },
    {
      id: "rect-12",
      file: "rect-12.svg",
      left: 303,
      top: -22,
      width: RECT_WIDE,
      height: RECT_HEIGHT,
      transform: "scaleY(-1)",
    },
    {
      id: "rect-10",
      file: "rect-10.svg",
      left: 363,
      top: -1,
      width: RECT_NARROW,
      height: RECT_HEIGHT,
    },
    {
      id: "rect-11",
      file: "rect-11.svg",
      left: 411.2,
      top: -1,
      width: RECT_WIDE,
      height: RECT_HEIGHT,
      transform: "scaleY(-1)",
    },
  ],
};

export default function BannerBackdrop({ variant }: { variant: BackdropVariant }) {
  const basePath = `/banner/backdrops/${BACKDROP_SLUG[variant]}`;
  return (
    <>
      {LAYERS[variant].map((layer) => (
        <div
          key={layer.id}
          className="absolute"
          style={{
            left: layer.left,
            top: layer.top,
            width: layer.width,
            height: layer.height,
            transform: layer.transform,
          }}
        >
          <Image
            src={`${basePath}/${layer.file}`}
            alt=""
            fill
            sizes="400px"
            loading="eager"
            className="select-none"
          />
        </div>
      ))}
    </>
  );
}
