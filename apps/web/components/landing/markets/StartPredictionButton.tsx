import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";

/**
 * 开始预测按钮（Figma 4227:195117 "Background+Shadow"）
 *
 * 规格：
 * - 280×56 胶囊（rounded-[62.5px]）
 * - 渐变 #28f4d2 → #00473b
 * - 底层 mix-blend-soft-light 噪声纹理 PNG（cta-bg-shadow.png）
 * - 12 组 Union 高光图层（cta-union-deco.svg, 每条 23×69.7, mix-blend-soft-light opacity-10）
 * - 阴影 0 7.25px 12px rgba(40,244,210,0.2) + inset 双向 white 40%
 * - 文字 20px Bold uppercase tracking 2px text-shadow #035748 50%
 * - 点击跳转 /markets 市场页
 *
 * 位置：定位由父级容器决定（落地页中位于 Hot Markets 顶部 (580, 18)，骑跨 Hero/HotMarkets 边界）
 */

const UNION_OFFSETS = [
  2, 25.01, 48.02, 71.03, 94.04, 117.05, 140.06, 163.07, 186.08, 209.09, 232.1, 255.11,
];

// 尺寸档位：default = 落地页 4227:195117（280×56）；lg = 认购页 7481:52039（280×69，整体 ×1.235）
const SIZES = {
  default: {
    shell: "h-[56px] w-[280px] gap-[8px]",
    round: "rounded-[62.5px]", // 单一圆角真值：外壳 + 内部 3 层高光共用
    union: "h-[69.729px] w-[23.01px]",
    text: "text-[20px] tracking-[2px]",
    textShadow: "0px 1px 2px rgba(3, 87, 72, 0.5)",
    boxShadow: "0px 7.25px 12px 0px rgba(40,244,210,0.2)",
    inset:
      "inset -2px -2px 5px 0px rgba(255,255,255,0.4), inset 2px -2px 5px 0px rgba(255,255,255,0.4)",
  },
  lg: {
    shell: "h-[69px] w-[280px] gap-[9.879px]",
    round: "rounded-[77.18px]",
    union: "h-[86.107px] w-[28.414px]",
    text: "text-[24.7px] tracking-[2.47px]",
    textShadow: "0px 1.235px 2.47px rgba(3, 87, 72, 0.5)",
    boxShadow: "0px 8.95px 14.82px 0px rgba(40,244,210,0.2)",
    inset:
      "inset -2.47px -2.47px 6.174px 0px rgba(255,255,255,0.4), inset 2.47px -2.47px 6.174px 0px rgba(255,255,255,0.4)",
  },
  // h5 = 认购页 H5 Hero 即刻认购按钮（Figma 7753:120592 · 260×48）。文案为中文，去掉 tracking。
  h5: {
    shell: "h-[48px] w-[260px] gap-[5.553px]",
    round: "rounded-[43.382px]",
    union: "h-[72.601px] w-[26.374px]",
    text: "text-[16px]",
    textShadow: "0px 0.694px 1.388px rgba(3, 87, 72, 0.5)",
    boxShadow: "0px 5.032px 8.329px 0px rgba(40,244,210,0.2)",
    inset:
      "inset -1.388px -1.388px 3.471px 0px rgba(255,255,255,0.4), inset 1.388px -1.388px 3.471px 0px rgba(255,255,255,0.4)",
  },
} as const;

export default function StartPredictionButton({
  className,
  onClick,
  label,
  size = "default",
}: {
  className?: string;
  /** 提供则渲染为 <button>（如认购页滚动锚点）；不提供则渲染 <Link href="/markets">（落地页默认） */
  onClick?: () => void;
  /** 文案覆盖；默认 landing.predictions.ctaButton（开始预测） */
  label?: string;
  /** 尺寸档位；default=落地页 280×56，lg=认购页 PC 280×69，h5=认购页 H5 Hero 260×48 */
  size?: "default" | "lg" | "h5";
}) {
  const t = useTranslations("landing.predictions");
  const s = SIZES[size];

  // 共享外壳（Link / button 两种渲染保持视觉完全一致）
  const shellClassName =
    "relative flex items-center justify-center overflow-clip " +
    s.shell +
    " " +
    s.round +
    " " +
    (className ?? "");
  const shellStyle = {
    touchAction: "manipulation" as const,
    // @figma-hardcoded: 外发光 rgba(40,244,210,0.2) — pending design token
    boxShadow: s.boxShadow,
  };

  const inner = (
    <>
      {/* 底层渐变 + 噪声纹理 */}
      <span aria-hidden className={"absolute inset-0 " + s.round}>
        <span
          className={"absolute inset-0 overflow-hidden " + s.round}
          style={{ mixBlendMode: "soft-light" }}
        >
          {/* ENH-023 Batch 3-c: 切 next/image — sizes 单值取按钮宽。
              不加 object-cover/contain：保持原裸 <img> 默认 object-fit: fill（拉伸铺满），
              避免 mix-blend-soft-light 容器内裁剪两侧引入视觉差异。fill prop 会自动注入
              position: absolute + inset: 0，依赖父级 span 已 absolute inset-0。 */}
          <Image
            src="/images/landing/cta-bg-shadow.png"
            alt=""
            fill
            sizes="280px"
            className="size-full max-w-none"
          />
        </span>
        {/* @figma-hardcoded: linear-gradient(to bottom, #28f4d2 0%, #00473b 100%) — pending design token */}
        <span
          className={"absolute inset-0 " + s.round}
          style={{ background: "linear-gradient(to bottom, #28f4d2 0%, #00473b 100%)" }}
        />
      </span>

      {/* 12 组 Union 高光条纹（offset 两档共用，尺寸随档位） */}
      <span aria-hidden className="absolute inset-0">
        {UNION_OFFSETS.map((left) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={left}
            src="/images/landing/cta-union-deco.svg"
            alt=""
            className={"absolute top-0 opacity-10 " + s.union}
            style={{ left: `${left}px`, mixBlendMode: "soft-light" }}
          />
        ))}
      </span>

      {/* 文字 */}
      <span
        className={"relative z-10 font-noto-sc font-bold uppercase text-white " + s.text}
        // @figma-hardcoded: text-shadow rgba(3,87,72,0.5) — pending design token
        style={{ textShadow: s.textShadow }}
      >
        {label ?? t("ctaButton")}
      </span>

      {/* inset 上下双向白色高光 */}
      <span
        aria-hidden
        className={"pointer-events-none absolute inset-0 " + s.round}
        style={{
          // @figma-hardcoded: inset white 40% top/bottom — pending design token
          boxShadow: s.inset,
        }}
      />
    </>
  );

  // onClick → 认购页滚动锚点（button）；否则落地页跳市场页（Link，输出与改造前一致）
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        data-cta="start-predict"
        style={shellStyle}
        className={shellClassName}
      >
        {inner}
      </button>
    );
  }

  return (
    <Link
      href="/markets"
      data-figma-node="4227:195117"
      data-cta="start-predict"
      style={shellStyle}
      className={shellClassName}
    >
      {inner}
    </Link>
  );
}
