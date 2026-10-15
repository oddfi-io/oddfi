import Image from "next/image";

interface CircleFlagProps {
  /** ISO 3166-1 alpha-2 国家码（大小写不敏感）。`GB-ENG` 自动 fallback 到 `gb`。 */
  code: string;
  /** 国旗图本身的尺寸（width = height），默认 32；外框总尺寸为 size+4（含 2px border） */
  size?: number;
  /** 透传到外层 <span>，常用：`absolute`、`shrink-0` 等容器无关样式 */
  className?: string;
}

const CODE_OVERRIDE: Record<string, string> = {
  // country-flag-icons 库的 GB-ENG（英格兰）在设计师圆形国旗集合中暂未单独提供，回退到英国
  "gb-eng": "gb",
};

/**
 * 圆形国旗（设计师导出，`public/images/flags/{code}.svg`）
 *
 * 与 `components/home-banner/parts/CountryFlag.tsx` 的区别：
 * - CountryFlag 用 `country-flag-icons` 矩形 SVG，使用方需自行裁剪成圆
 * - CircleFlag 直接消费已圆形化的设计师 SVG，外层 2px `bg-secondary` 边框做视觉分割
 */
export default function CircleFlag({ code, size = 32, className = "" }: CircleFlagProps) {
  const lowered = code.toLowerCase();
  const normalized = CODE_OVERRIDE[lowered] ?? lowered;

  return (
    <span
      className={`inline-block overflow-hidden rounded-full border-2 border-[var(--bg-secondary)] ${className}`.trim()}
      style={{ width: size + 4, height: size + 4 }}
    >
      <Image
        src={`/images/flags/${normalized}.svg`}
        alt=""
        width={size}
        height={size}
        sizes={`${size}px`}
        className="block"
        unoptimized
      />
    </span>
  );
}
