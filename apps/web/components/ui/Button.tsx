import { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "outline" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  children: ReactNode;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-btn-primary text-static-black font-semibold hover:bg-btn-primary-hover active:bg-btn-primary-press disabled:bg-btn-primary-disable active:scale-[0.98]",
  outline:
    "bg-transparent border border-white/20 text-primary hover:bg-white/[0.08] active:scale-[0.98]",
  ghost:
    "bg-transparent text-secondary hover:text-primary hover:bg-white/[0.05] active:scale-[0.98]",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "text-xs px-4",
  md: "text-sm px-5",
  lg: "text-base px-8",
};

export default function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={[
        "inline-flex items-center justify-center rounded-full font-medium",
        "transition-all duration-150 select-none",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
        VARIANT_STYLES[variant],
        SIZE_STYLES[size],
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-busy={loading}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : (
        children
      )}
    </button>
  );
}
