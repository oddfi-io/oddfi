// Figma node 1032:135847 — magnifying glass with X mark (search empty state)

interface SearchEmptyIconProps {
  size?: number;
  className?: string;
}

export default function SearchEmptyIcon({ size = 100, className }: SearchEmptyIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Magnifying glass body */}
      <circle cx="42" cy="42" r="28" stroke="#5E5E63" strokeWidth="4" />
      {/* Handle */}
      <line
        x1="62"
        y1="62"
        x2="88"
        y2="88"
        stroke="#5E5E63"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* X mark inside */}
      <line
        x1="32"
        y1="32"
        x2="52"
        y2="52"
        stroke="#5E5E63"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="52"
        y1="32"
        x2="32"
        y2="52"
        stroke="#5E5E63"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
