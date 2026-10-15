export default function CalendarLoading() {
  return (
    <div className="p-[24px] flex flex-col gap-[16px]">
      {/* Toolbar: filters + date range */}
      <div className="flex flex-col gap-[12px] lg:flex-row lg:items-center lg:gap-[16px]">
        <div className="h-[44px] w-full lg:w-[200px] rounded-full bg-white/10 animate-pulse" />
        <div className="h-[44px] w-full lg:w-[320px] rounded-full bg-white/10 animate-pulse" />
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-7 gap-[8px]">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-[48px] rounded-8 bg-white/10 animate-pulse" />
        ))}
      </div>

      {/* Match rows */}
      <div className="flex flex-col gap-[8px]">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="h-[64px] rounded-12 bg-white/10 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
