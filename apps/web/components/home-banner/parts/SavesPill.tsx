interface SavesPillProps {
  /** 扑救数 */
  saves: number;
}

/**
 * B5 金手套专用扑救数胶囊（Figma 3231:314）
 * 66×19 白 20% 底 rounded-full，12px 白字，"N Saves"
 */
export default function SavesPill({ saves }: SavesPillProps) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 rounded-full"
      style={{
        width: 66,
        height: 19,
        // @figma-hardcoded: rgba(255,255,255,0.2) saves-pill-bg — pending design token
        background: "rgba(255,255,255,0.2)",
      }}
    >
      <span
        className="font-noto-sc font-bold text-white whitespace-nowrap"
        style={{
          fontSize: 12,
          letterSpacing: -0.6,
        }}
      >
        {saves} Saves
      </span>
    </div>
  );
}
