// Figma icons-customized "settings" — 六边形齿轮 + 中心圆，区别于 Phosphor GearSixIcon

interface SettingsIconProps {
  size?: number;
  className?: string;
}

export default function SettingsIcon({ size = 20, className }: SettingsIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* 六边形外框 */}
      <path
        d="M13.9 16.5L17.7 10L13.9 3.5H6.1L2.3 10L6.1 16.5H13.9Z"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinejoin="round"
      />
      {/* 中心圆 */}
      <path
        d="M12.1 10C12.1 11.16 11.16 12.1 10 12.1C8.84 12.1 7.9 11.16 7.9 10C7.9 8.84 8.84 7.9 10 7.9C11.16 7.9 12.1 8.84 12.1 10Z"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinejoin="round"
      />
    </svg>
  );
}
