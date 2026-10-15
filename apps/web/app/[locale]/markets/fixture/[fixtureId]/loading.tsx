export default function FixtureDetailLoading() {
  return (
    <div className="max-w-3xl mx-auto space-y-4 p-4 lg:p-6">
      {/* Match header skeleton */}
      <div className="bg-secondary rounded-16 overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-3 border-b border-divider">
          <div className="w-10 h-10 rounded-8 bg-white/10 animate-pulse" />
          <div className="h-4 w-40 rounded bg-white/10 animate-pulse" />
        </div>
        <div className="px-6 py-5 flex flex-col items-center gap-4">
          <div className="h-3 w-32 rounded bg-white/10 animate-pulse" />
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-white/10 animate-pulse" />
              <div className="h-4 w-20 rounded bg-white/10 animate-pulse" />
            </div>
            <div className="h-5 w-6 rounded bg-white/10 animate-pulse" />
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-white/10 animate-pulse" />
              <div className="h-4 w-20 rounded bg-white/10 animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Odds sections skeleton */}
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-secondary rounded-16 overflow-hidden">
          <div className="px-4 py-3 border-b border-divider">
            <div className="h-4 w-28 rounded bg-white/10 animate-pulse" />
          </div>
          <div className="p-4 grid grid-cols-3 gap-3">
            {[0, 1, 2].map((j) => (
              <div key={j} className="h-14 rounded-8 bg-white/10 animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
