// DD-115 · Match 列胜方箭头（Figma 节点 6714:103180）
// 10×10 实心三角朝右；颜色继承 currentColor（默认配 text-brand-default #28F4D2）。

interface Props {
  className?: string;
  ariaLabel?: string;
}

export function MatchWinnerArrow({ className, ariaLabel }: Props) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label={ariaLabel ?? "winner"}
      role="img"
    >
      <polygon points="2,1 9,5 2,9" fill="currentColor" />
    </svg>
  );
}
