// DD-115 · Settled 表 Bet Type 列（Figma 节点 6714:103940）
//
// 三行复合单元格：
//   Asian Total       ← 玩法（market_type，由调用方做 i18n 翻译后传入）
//   Blend (0.5)       ← 盘口数（handicapLine 缺失时回退 "--"）
//   1.59 x            ← 倍数 / 总赔率
//
// 颜色：
//   line 1 text-primary
//   line 2 text-fn-yellow
//   line 3 text-brand-default

interface Props {
  /** 已翻译的玩法名（如 "Asian Total" / "Fulltime Result"） */
  marketLabel: string;
  /** 盘口数字（如 "0.5"）；缺省时渲染 "--" */
  handicapLine?: string;
  /** 赔率（单注）或总赔率（串关） */
  odds: string;
  /** 盘口行前缀文案，默认 "Blend"（与 Figma 一致；后续可换 i18n key） */
  blendLabel?: string;
}

export function BetTypeCell({ marketLabel, handicapLine, odds, blendLabel = "Blend" }: Props) {
  const line = handicapLine ?? "--";
  return (
    <div className="w-[120px] h-full px-[16px] flex flex-col gap-[2px] items-start justify-center">
      <p className="text-[11px] font-medium leading-[16px] text-primary whitespace-nowrap">
        {marketLabel}
      </p>
      <p className="text-[11px] font-medium leading-[16px] text-fn-yellow whitespace-nowrap">
        {blendLabel} ({line})
      </p>
      <p className="text-[11px] font-medium leading-[16px] text-brand-default whitespace-nowrap">
        {odds} x
      </p>
    </div>
  );
}
