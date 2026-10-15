interface CaretDownIconProps {
  size?: number;
  className?: string;
}

export default function CaretDownIcon({ size = 20, className }: CaretDownIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M15.8337 7.08398L10.0003 14.584L4.16699 7.08398H15.8337Z" fill="currentColor" />
    </svg>
  );
}
