// Figma 自定义图标 — K 线图类型切换（ic/k-line）
// 节点: 1440:81316（trigger 按钮上下文，1:1 比例），20×20，两根蜡烛图柱（左短右高）

interface KLineIconProps {
  size?: number;
  className?: string;
}

export default function KLineIcon({ size = 20, className }: KLineIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* 左侧蜡烛（较短）— Figma: left=4.29 top=5.31 w=4.898 h=11.429 */}
      <svg x="4.29" y="5.31" width="4.898" height="11.429" viewBox="0 0 4.89813 11.4286">
        <path d="M2.44908 0V11.4286" stroke="currentColor" strokeWidth="1.22449" />
        <rect y="3.26524" width="4.89796" height="5.71429" fill="currentColor" />
      </svg>
      {/* 右侧蜡烛（较高）— Figma: left=10.82 top=2.86 w=4.898 h=13.878 */}
      <svg x="10.82" y="2.86" width="4.898" height="13.878" viewBox="0 0 4.89813 13.8776">
        <path d="M2.44873 0L2.44873 13.8776" stroke="currentColor" strokeWidth="1.22449" />
        <rect y="3.26547" width="4.89796" height="8.16326" fill="currentColor" />
      </svg>
    </svg>
  );
}
