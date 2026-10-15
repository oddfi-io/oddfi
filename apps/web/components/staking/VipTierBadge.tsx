// VIP tier badge — pure display, no progress bar (DD-107 §3.6)
// Future: extend to VipTierProgressCard with "X ODD to next tier" (enh-todo)

interface VipTierBadgeProps {
  tier: number; // 0..10
}

export default function VipTierBadge({ tier }: VipTierBadgeProps) {
  return (
    <span
      className="inline-flex items-center rounded-8 bg-tag-brand text-brand-default px-[8px] py-[2px] text-[12px] font-bold leading-[18px]"
      aria-label={`VIP tier ${tier}`}
    >
      VIP {tier}
    </span>
  );
}
