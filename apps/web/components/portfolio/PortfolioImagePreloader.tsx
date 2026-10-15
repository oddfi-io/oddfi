import Image from "next/image";

// Static images used in Portfolio modals — preloaded so they appear instantly on modal open.
// PNGs: next/image priority injects <link rel="preload"> with the correct /_next/image URL.
// SVGs: <link rel="preload"> hoisted to <head> by App Router (served as-is, no optimization).
const PNG_IMAGES = [
  { src: "/images/status/congrats.png", width: 80, height: 80 },
  { src: "/images/status/success.png", width: 80, height: 80 },
  { src: "/images/deposit/success.png", width: 80, height: 80 },
] as const;

const SVG_IMAGES = ["/images/chains/bsc.svg", "/icons/gas.svg"] as const;

export function PortfolioImagePreloader() {
  return (
    <>
      {SVG_IMAGES.map((href) => (
        <link key={href} rel="preload" as="image" href={href} />
      ))}
      <div aria-hidden="true" className="hidden">
        {PNG_IMAGES.map(({ src, width, height }) => (
          <Image
            key={src}
            src={src}
            width={width}
            height={height}
            alt=""
            priority
            sizes={`${width}px`}
          />
        ))}
      </div>
    </>
  );
}
