import Image from "next/image";

interface RankMedalProps {
  /** 排名 1-4。1/2/3 渲染奖杯 + 7px 小数字；4 不渲染奖杯，仅渲染 15px 大数字 */
  rank: 1 | 2 | 3 | 4;
}

/**
 * B3/B4/B5 排名标识（Figma 3110:49626 / 49616 / 49605 / 49593）
 *
 * - rank 1/2/3：奖杯 SVG（viewBox 24×22.7203）通过 inset -27.17%/-25% 让自然尺寸溢出 16×14.72 容器，
 *   叠加 7px Black "1/2/3" 数字（left:6 top:5）
 * - rank 4：奖杯不可见，仅渲染 15px Bold/Noto Sans SC "4" 数字（left:4 top:-1，line-height 1.8 = 27px，uppercase white）
 *
 * 占位宽度统一 16，确保四行视觉对齐。
 */
export default function RankMedal({ rank }: RankMedalProps) {
  const isTop3 = rank === 1 || rank === 2 || rank === 3;
  return (
    <span className="relative inline-block flex-shrink-0" style={{ width: 16, height: 14.72 }}>
      {isTop3 && (
        <span
          className="absolute pointer-events-none"
          style={{ top: "-27.17%", left: "-25%", width: "150%", height: "154.34%" }}
        >
          <Image
            src={`/banner/icons/rank-medal-${rank}.svg`}
            alt=""
            fill
            sizes="24px"
            className="object-contain"
          />
        </span>
      )}
      <span
        className="absolute font-noto-sc text-white uppercase"
        style={
          isTop3
            ? { left: 6, top: 5, fontSize: 7, lineHeight: 1.8, fontWeight: 900 }
            : { left: 4, top: -1, fontSize: 15, lineHeight: 1.8, fontWeight: 700 }
        }
      >
        {rank}
      </span>
    </span>
  );
}
