interface PancakeSwapIconProps {
  size?: number;
  className?: string;
}

export default function PancakeSwapIcon({ size = 20, className }: PancakeSwapIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="10" fill="#633001" />
      <path
        d="M6.2 6.6c0-.9.7-1.6 1.6-1.6s1.6.7 1.6 1.6v2.2h1.2V6.6c0-.9.7-1.6 1.6-1.6s1.6.7 1.6 1.6v3.6c0 2.3-1.9 4-4 4h-.4c-2.1 0-4-1.7-4-4V6.6z"
        fill="#FEDC90"
      />
      <circle cx="8.6" cy="10.6" r="0.55" fill="#633001" />
      <circle cx="11.4" cy="10.6" r="0.55" fill="#633001" />
      <path d="M9.1 12.3c.3.3.9.3 1.2 0" stroke="#633001" strokeWidth="0.6" strokeLinecap="round" />
    </svg>
  );
}
