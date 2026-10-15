export default function BannerDetailLoading() {
  return (
    <div className="flex h-full lg:overflow-hidden">
      {/* Main content */}
      <div className="flex flex-1 min-w-0 flex-col gap-6 px-4 py-3 lg:px-6 lg:py-4 lg:overflow-y-auto">
        {/* Banner header */}
        <div className="h-[180px] lg:h-[240px] rounded-16 bg-white/10 animate-pulse" />

        {/* Section title */}
        <div className="h-[22px] w-[160px] rounded bg-white/10 animate-pulse" />

        {/* Match cards */}
        <div className="flex flex-col gap-[12px]">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-[88px] rounded-16 bg-white/10 animate-pulse" />
          ))}
        </div>
      </div>

      {/* Right BetSlip panel — desktop only */}
      <div className="hidden w-[440px] shrink-0 lg:block lg:overflow-y-auto">
        <div className="h-full m-4 rounded-16 bg-white/10 animate-pulse" />
      </div>
    </div>
  );
}
