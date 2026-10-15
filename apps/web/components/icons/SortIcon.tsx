// 排序表头 icon — Figma node 1683:80110 (Union)
// 外层 20×20 由 SortHeader 按钮提供热区；icon 本身 10×12 原尺寸
// 原 SVG viewBox 0 0 10 12，上下箭头合一 path；拆为两段以支持 asc/desc 激活态独立着色
// inactive: 上下皆 text-secondary
// asc: 上箭头 text-primary，下箭头 text-secondary
// desc: 下箭头 text-primary，上箭头 text-secondary

interface Props {
  state?: "inactive" | "asc" | "desc";
  className?: string;
}

export default function SortIcon({ state = "inactive", className }: Props) {
  const upFill = state === "asc" ? "var(--text-primary)" : "var(--text-secondary)";
  const downFill = state === "desc" ? "var(--text-primary)" : "var(--text-secondary)";
  return (
    <svg
      width="10"
      height="12"
      viewBox="0 0 10 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d="M10 5H0L5 0L10 5Z" fill={upFill} />
      <path d="M5 12L0 7H10L5 12Z" fill={downFill} />
    </svg>
  );
}
