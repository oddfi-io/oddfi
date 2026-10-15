import { ReactNode } from "react";
import Button from "./Button";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}
    >
      {icon && (
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mb-5 text-2xl
                     bg-white/[0.05] border border-white/[0.12]"
        >
          {icon}
        </div>
      )}
      <p className="text-primary font-medium text-base mb-1">{title}</p>
      {description && (
        <p className="text-secondary text-sm mb-6 max-w-[240px] leading-relaxed">{description}</p>
      )}
      {action && (
        <Button
          variant="outline"
          size="sm"
          className={description ? "" : "mt-5"}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
