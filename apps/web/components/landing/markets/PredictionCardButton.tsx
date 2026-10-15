/**
 * 预测卡 hover CTA — 「开始预测 →」（Figma 5655:6988 / 5655:6996）
 *
 * 视觉规格：
 * - 181×48 斜四边形（不是 rounded pill）
 *   bg path: `M18 0H181L163 48H0L18 0Z`（顶/底边平行，左右各斜 18px）
 *   fill: #28F4D2 实色
 * - 文案 "开始预测" 16px medium，黑色 #04060c
 * - 右侧斜箭头：本身已带曲线 + 外层 skew-x(-4.91°)
 *
 * 仅渲染视觉，不带交互（外层由 `<Link>` 包裹处理点击）。
 */
export default function PredictionCardButton({
  text = "开始预测",
  className = "",
}: {
  text?: string;
  className?: string;
}) {
  return (
    <span
      data-figma-node="5655:6988"
      className={`relative inline-block h-[48px] w-[181px] ${className}`}
    >
      {/* 斜四边形底色（Figma Rectangle 128，#28F4D2 实色） */}
      <svg
        aria-hidden="true"
        viewBox="0 0 181 48"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        {/* @figma-hardcoded: #28F4D2 prediction-card cta — pending design token */}
        <path d="M18 0H181L163 48H0L18 0Z" fill="#28F4D2" />
      </svg>

      {/* 文案 + 斜箭头 */}
      <span className="absolute inset-0 flex items-center justify-center gap-[6px]">
        <span className="font-noto-sc text-[16px] font-medium leading-[24px] text-[#04060c]">
          {text}
        </span>
        <span aria-hidden="true" className="block skew-x-[-4.91deg]">
          <svg
            width="25.86"
            height="10.84"
            viewBox="0 0 25.8627 10.8355"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M19.276 0.65C19.276 2.80633 24.3665 5.44185 24.3665 5.44185M24.3665 5.44185C24.3665 5.44185 20.082 7.35859 20.082 10.1855M24.3665 5.44185H0.65"
              stroke="#04060C"
              strokeWidth="1.3"
              strokeLinecap="square"
            />
          </svg>
        </span>
      </span>
    </span>
  );
}
