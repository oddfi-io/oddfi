interface PlayerAvatarProps {
  /** 球员姓名（用于派生首字母 fallback） */
  name: string;
  /** 圆形尺寸（width=height），默认 64 */
  size?: number;
  /** 字体大小；缺省取 size 的 0.375（与设计稿 64→24 比例一致） */
  fontSize?: number;
  /** 透传到外层圆形容器，常用 `shrink-0` / `absolute` 等 */
  className?: string;
}

/**
 * 球员头像 fallback（金球 / 金靴 / 金手套 banner 通用）
 *
 * Phase 3 后端 image_url CDN 就绪后，此组件可在内部按 url 切真图，调用方无需调整。
 * 当前一律走"黄底圆 + 球员名首字母"。
 *
 * 视觉：bg #f1cb26（Yellow/brand-400 — pending design token），首字母最多 2 位。
 */
export default function PlayerAvatar({
  name,
  size = 64,
  fontSize,
  className = "",
}: PlayerAvatarProps) {
  const initials =
    name
      .split(/\s+/)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2) ||
    name[0] ||
    "";

  const computedFontSize = fontSize ?? Math.max(10, Math.round(size * 0.375));

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full ${className}`.trim()}
      style={{
        width: size,
        height: size,
        // @figma-hardcoded: #f1cb26 player-avatar-bg — pending design token (Yellow/brand-400)
        backgroundColor: "#f1cb26",
      }}
    >
      <span
        className="grid h-full w-full place-items-center text-center font-bold text-black"
        style={{
          fontSize: computedFontSize,
          lineHeight: 1,
          // CJK 字符全角 em-box 内通常有不对称留白（如 "西" 偏右），导致视觉左偏；
          // "palt" = proportional alternate metrics，让字体按实际字形宽度排版而非全角格
          fontFeatureSettings: '"palt"',
        }}
      >
        {initials}
      </span>
    </div>
  );
}
