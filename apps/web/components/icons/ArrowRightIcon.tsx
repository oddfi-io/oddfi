// 日期范围中间箭头 — Figma node 3354:45610 icons-cutomized type="right"
// 原 SVG 由横线 + V 形尖头组合；合并为单一 20×20 路径，颜色通过 currentColor 继承 className

interface Props {
  className?: string;
  size?: number;
}

export default function ArrowRightIcon({ className, size = 20 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M6 10H14M10 6L14 10L10 14"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
