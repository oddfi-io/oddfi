"use client";

export default function HeroVideo() {
  return (
    <video
      src="/images/landing/hero-character.mp4"
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      aria-hidden="true"
      className="size-full object-cover"
      style={{
        maskImage:
          "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.4) 8%, black 20%, black 100%)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.4) 8%, black 20%, black 100%)",
      }}
    />
  );
}
