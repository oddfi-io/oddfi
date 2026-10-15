import fs from "fs";
import path from "path";
import HotMarketsCarousel from "./markets/HotMarketsCarousel";
import StartPredictionButton from "./markets/StartPredictionButton";

/**
 * §2 Hot Markets Section
 * Figma 节点: 4227:195094 (Frame 2087327803, 1440×734)
 *
 * 实现要点（保留 Figma SVG 全部 filter，inline 渲染让浏览器执行）：
 * - section 高 734px，-mt-[100px] z-20 咬入 Hero
 * - inline SVG（hot-markets-bg-shape.svg）撑满 section：
 *   - <foreignObject> 内 backdrop-filter:blur(12px) → cloud 形状内 blur Hero 背景
 *   - filter0_n_ feTurbulence + feComponentTransfer → 颗粒噪点纹理
 *   - path fill=#0C0C0F 60% opacity → 半透明深色叠加
 *   - 上沿绿色渐变描边 #80FFEA → #23DFC0
 * - cloud 形状外（曲线之上左右两侧）SVG 透明，自然露出 Hero
 * - 服务端 fs 读取 raw SVG，dangerouslySetInnerHTML 注入（HotMarketsSection 是 Server Component）
 */
const SVG_RAW = fs.readFileSync(
  path.join(process.cwd(), "public/images/landing/hot-markets-bg-shape.svg"),
  "utf-8"
);

export default function HotMarketsSection() {
  return (
    <section
      data-section="hot-markets"
      data-figma-node="4227:195094"
      className="relative z-20 -mt-[100px] h-[960px] w-full"
    >
      {/* Figma 原 SVG inline 渲染 — 内含 backdrop-blur + 颗粒 noise filter + 渐变描边 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full"
        dangerouslySetInnerHTML={{ __html: SVG_RAW }}
      />

      {/* 开始预测按钮 — Figma (580, 18) 居中浮在 cloud 顶部 */}
      <StartPredictionButton className="absolute left-1/2 top-[18px] z-10 -translate-x-1/2" />

      <div className="relative z-10 pt-[187px]">
        <HotMarketsCarousel />
      </div>
    </section>
  );
}
