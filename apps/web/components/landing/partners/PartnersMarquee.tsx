/**
 * §13 合作伙伴 logo 横排（Figma 4227:195352 "our partners"）
 *
 * 实现：
 * - 7 个 unique partner logo（统一从 Figma 拼合到 public/images/partners/*.svg）
 *   生成脚本：.progress/stash/build-partner-logos.mjs
 * - 内容复制 2 倍 + Tailwind animate-marquee（30s linear infinite）
 *   keyframe 0% → translateX(0), 100% → translateX(-50%)，2 倍内容形成无缝循环
 * - 容器高 88, py-[30px], gap-[72px], 每个 logo 高 36px
 *
 * 注：marquee 是连续无限循环、无生命周期/事件回调，属 animation.md 例外（hover/transition 类）
 */

const PARTNERS: ReadonlyArray<{ name: string; w: number }> = [
  { name: "sumsub", w: 154 },
  { name: "fireblocks", w: 202.5 },
  { name: "coincover", w: 211.5 },
  { name: "coinmarketcap", w: 209 },
  { name: "tokeninsight", w: 192 },
  { name: "coindesk", w: 172.8 },
  { name: "chainalysis", w: 211.5 },
];

function PartnerRow({ ariaHidden = false }: { ariaHidden?: boolean }) {
  return (
    <div
      className="flex shrink-0 items-center gap-[72px] pr-[72px]"
      aria-hidden={ariaHidden || undefined}
    >
      {PARTNERS.map((p) => (
        <img
          key={p.name}
          src={`/images/partners/${p.name}.svg`}
          alt={ariaHidden ? "" : p.name}
          width={p.w}
          height={36}
          loading="lazy"
          decoding="async"
          className="block h-[36px] shrink-0"
          style={{ width: `${p.w}px` }}
        />
      ))}
    </div>
  );
}

export default function PartnersMarquee() {
  return (
    <div
      data-figma-node="4227:195352"
      data-name="PartnersMarquee"
      className="relative flex h-[88px] w-full items-center overflow-hidden py-[30px]"
    >
      {/* 内容复制 2 倍 → animate-marquee 平移 -50% 形成无缝循环 */}
      <div className="flex w-max items-center animate-marquee">
        <PartnerRow />
        <PartnerRow ariaHidden />
      </div>
    </div>
  );
}
