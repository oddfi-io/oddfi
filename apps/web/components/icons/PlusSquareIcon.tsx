export default function PlusSquareIcon({
  size = 18,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox="0 0 14.4004 14.4004"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M10.7998 0C12.7879 0 14.4002 1.61156 14.4004 3.59961V10.7998C14.4004 12.788 12.788 14.4004 10.7998 14.4004H3.59961C1.61156 14.4002 0 12.7879 0 10.7998V3.59961C0.000211234 1.61169 1.61169 0.000211002 3.59961 0H10.7998ZM6.52539 2.7002V6.52539H2.7002V7.875H6.52539V11.7002H7.875V7.875H11.7002V6.52539H7.875V2.7002H6.52539Z"
        fill="currentColor"
      />
    </svg>
  );
}
