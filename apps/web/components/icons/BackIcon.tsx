// Figma icons-customized "back" — 左箭头 + 横线组合，区别于 Phosphor ArrowLeftIcon

interface BackIconProps {
  size?: number;
  className?: string;
}

export default function BackIcon({ size = 20, className }: BackIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M16.7461 12.25H6.74609"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.7461 7.25L6.74609 12.25L11.7461 17.25"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
