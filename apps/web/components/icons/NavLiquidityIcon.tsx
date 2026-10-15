// Figma 6959:123897 — H5 菜单 Liquidity 自定义图标（蛋形容器 + 双液面线）
// ASSETS.md 已查（liquidity / drop / egg / pool）：Phosphor DropIcon 是单尖水滴、EggIcon 无液面线，
// 与 Figma cutomized "Pool 蛋形 + 双液面" 视觉差异明显，无替代品。

interface NavLiquidityIconProps {
  size?: number;
  className?: string;
}

export default function NavLiquidityIcon({ size = 20, className }: NavLiquidityIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* 蛋形外壳（Figma inset[6.25% 18.75% 12.5% 18.75%]） */}
      <g
        transform="translate(3.75 1.25)"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M13.165 10.665C13.165 5.04 6.915 0.665 6.915 0.665C6.915 0.665 0.665 5.04 0.665 10.665C0.665 12.3226 1.32348 13.9123 2.49558 15.0844C3.66769 16.2565 5.2574 16.915 6.915 16.915C8.5726 16.915 10.1623 16.2565 11.3344 15.0844C12.5065 13.9123 13.165 12.3226 13.165 10.665Z" />
      </g>
      {/* 下液面线（inset[70.31% 22.09% 29.69% 22.09%]） */}
      <g
        transform="translate(4.418 14.062)"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M0.665 0.665H11.8306" />
      </g>
      {/* 中液面线（inset[54.69% 18.78% 45.31% 18.78%]） */}
      <g
        transform="translate(3.756 10.938)"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M0.665 0.665H13.1525" />
      </g>
    </svg>
  );
}
