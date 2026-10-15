// Figma 自定义图标 — 下箭头（caret-down）
// 来源: public/icons/caret-down.svg，12×12 三角形

interface CaretDownCustomIconProps {
  size?: number;
  className?: string;
}

export default function CaretDownCustomIcon({ size = 12, className }: CaretDownCustomIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M9.5 4.25L6 8.75L2.5 4.25H9.5Z" fill="currentColor" />
    </svg>
  );
}
