import type { ComponentType } from "react";
import * as Flags from "country-flag-icons/react/3x2";

interface CountryFlagProps {
  /** ISO 3166-1 alpha-2，GB-ENG 将 fallback 到 GB */
  code: string;
  /** 显示尺寸（宽 × 高）。Figma 基准 25.9 × 19 */
  width?: number;
  height?: number;
  className?: string;
}

// country-flag-icons 包导出类型为 object，没有 index signature
// 抽辅助函数集中收口断言，避免业务代码内出现 `as unknown as Record<...>` 噪声
type FlagComponent = ComponentType<{ className?: string }>;
const FLAGS = Flags as unknown as Record<string, FlagComponent>;

function getFlagComponent(code: string): FlagComponent | undefined {
  // GB-ENG（英格兰）库不支持，fallback 到 GB；后续导出 gb-eng.svg 再特判
  const normalized = code === "GB-ENG" ? "GB" : code;
  return FLAGS[normalized];
}

/**
 * Home Banner 国旗组件
 * 使用 country-flag-icons 的 3×2 SVG
 */
export default function CountryFlag({
  code,
  width = 25.9, // @figma intentional non-integer
  height = 19,
  className = "",
}: CountryFlagProps) {
  const Flag = getFlagComponent(code);
  if (!Flag) return null;

  return (
    <span
      className={`inline-block overflow-hidden rounded-[4px] flex-shrink-0 ${className}`}
      style={{ width, height }}
    >
      <Flag className="w-full h-full object-cover" />
    </span>
  );
}
