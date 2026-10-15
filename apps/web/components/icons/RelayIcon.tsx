interface RelayIconProps {
  size?: number;
  className?: string;
}

export default function RelayIcon({ size = 20, className }: RelayIconProps) {
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
      <circle cx="10" cy="10" r="10" fill="#7B3FE4" />
      <path
        d="M7.2 5.5l5.2 4.5-5.2 4.5"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.8 8l2.8 2-2.8 2"
        stroke="white"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </svg>
  );
}
