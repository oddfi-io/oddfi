function BracketColumn({ count, className = "" }: { count: number; className?: string }) {
  return (
    <div className={`flex flex-col justify-around gap-[16px] ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-[80px] w-[180px] rounded-12 bg-white/10 animate-pulse" />
      ))}
    </div>
  );
}

export default function BracketLoading() {
  return (
    <>
      {/* Mobile: vertical list */}
      <div className="lg:hidden flex flex-col gap-[16px] px-[16px] py-[16px]">
        <div className="h-[44px] rounded-full bg-white/10 animate-pulse" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="h-[72px] rounded-12 bg-white/10 animate-pulse" />
        ))}
      </div>

      {/* Desktop: horizontal bracket tree */}
      <div className="hidden lg:flex flex-row items-center justify-center gap-[24px] pt-[48px] pb-[24px] overflow-x-auto px-[24px]">
        <BracketColumn count={8} />
        <BracketColumn count={4} />
        <BracketColumn count={2} />
        {/* Final */}
        <div className="flex flex-col items-center gap-[16px]">
          <div className="h-[130px]" aria-hidden />
          <div className="h-[80px] w-[200px] rounded-12 bg-white/10 animate-pulse" />
        </div>
        <BracketColumn count={2} />
        <BracketColumn count={4} />
        <BracketColumn count={8} />
      </div>
    </>
  );
}
