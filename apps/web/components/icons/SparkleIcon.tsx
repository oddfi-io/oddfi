/**
 * SparkleIcon —— 奖励中心主 Tab 选中态前缀的四角星图标（Figma 9002:159426）。
 * 矢量取自 Figma `icons-cutomized` Star，fill 用 currentColor 以继承外层文字色（薄荷绿）。
 */
export function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 0L14.2062 9.79383L24 12L14.2062 14.2062L12 24L9.79383 14.2062L0 12L9.79383 9.79383L12 0Z"
        fill="currentColor"
      />
    </svg>
  );
}
