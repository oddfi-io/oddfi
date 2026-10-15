// [TEMP:staking] Temporary — will be replaced when backend staking API is ready

type TagVariant = "orange" | "green" | "gray";

const VARIANT_STYLE: Record<TagVariant, string> = {
  orange: "bg-tag-brand text-brand-default",
  green: "bg-tag-green text-green",
  gray: "bg-tag-gray text-secondary",
};

interface StakeTagProps {
  children: React.ReactNode;
  variant?: TagVariant;
  /** true = top-right corner tag (rounded-bl + rounded-tr), false = inline badge (rounded-8) */
  corner?: boolean;
}

export default function StakeTag({ children, variant = "orange", corner = false }: StakeTagProps) {
  return (
    <span
      className={[
        "inline-flex items-center h-[24px] px-[8px] text-[11px] font-medium",
        corner ? "rounded-bl-8 rounded-tr-8" : "rounded-8",
        VARIANT_STYLE[variant],
      ].join(" ")}
    >
      {children}
    </span>
  );
}
