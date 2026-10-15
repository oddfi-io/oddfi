// Figma icons-customized "globe" — 自定义地球图标，区别于 Phosphor GlobeIcon

interface GlobeCustomIconProps {
  size?: number;
  className?: string;
}

export default function GlobeCustomIcon({ size = 20, className }: GlobeCustomIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* 外圆 */}
      <path
        d="M10 17C13.866 17 17 13.866 17 10C17 6.134 13.866 3 10 3C6.134 3 3 6.134 3 10C3 13.866 6.134 17 10 17Z"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 赤道横线 */}
      <path
        d="M3 10H17"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 经线椭圆 */}
      <path
        d="M12.6 10C12.6 14.6 10 16.9 10 16.9C10 16.9 7.4 14.6 7.4 10C7.4 5.4 10 3.1 10 3.1C10 3.1 12.6 5.4 12.6 10Z"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
