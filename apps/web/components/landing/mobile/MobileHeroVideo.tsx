import HeroVideo from "../hero/HeroVideo";

/**
 * Figma 6937:64278 — H5 视频区
 *
 * 像素级转录：
 *   - 容器 6937:64278：rounded-bl-[12px] rounded-br-[12px] overflow-clip
 *     （Figma frame 给的底部圆角）
 *   - 视频 6937:64279：w=502.302 h=288.556 靠 right=0 顶部 top=0.15px
 *     （Figma 设计稿 375 宽 → 实际宽度由父容器决定，视频锚定右侧自然左溢出）
 *
 * 复用 PC HeroVideo（带渐变 mask 的 <video>），不重写。
 */
export default function MobileHeroVideo() {
  return (
    <section
      data-figma-node="6937:64278"
      className="relative w-full h-[289px] overflow-clip rounded-bl-[12px] rounded-br-[12px]"
    >
      <div
        data-figma-node="6937:64279"
        className="absolute pointer-events-none"
        style={{ right: 0, top: 0, width: 502.302, height: 288.556 }}
      >
        <HeroVideo />
      </div>
    </section>
  );
}
