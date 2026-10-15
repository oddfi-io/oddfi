export default function LiveDotIcon({ size = 14 }: { size?: number }) {
  // Outer ring (static, 50% opacity) + inner dot with breathing pulse animation
  // Breathing effect: CSS keyframe scale+opacity loop (pure decorative, no state lifecycle — exempt from WAAPI rule)
  const dotR = size * 0.21; // ~3px at 14
  const ringR = size * 0.42; // ~6px at 14
  const cx = size / 2;
  const cy = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <style>{`
        @keyframes liveDotBreathe {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.75); }
        }
      `}</style>
      {/* Outer ring — static, semi-transparent */}
      <circle cx={cx} cy={cy} r={ringR} fill="var(--tag-brand-transparent)" />
      {/* Inner dot — breathing pulse */}
      <circle
        cx={cx}
        cy={cy}
        r={dotR}
        fill="var(--text-brand-default)"
        style={{
          transformOrigin: `${cx}px ${cy}px`,
          animation: "liveDotBreathe 1.5s ease-in-out infinite",
        }}
      />
    </svg>
  );
}
