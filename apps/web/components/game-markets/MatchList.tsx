import type { SportmonksFixture } from "@/types/api";

/** Group fixtures by league_id, preserving order */
export function groupByLeague(fixtures: SportmonksFixture[]) {
  const groups = new Map<number, SportmonksFixture[]>();
  for (const f of fixtures) {
    const list = groups.get(f.league_id) ?? [];
    list.push(f);
    groups.set(f.league_id, list);
  }
  return groups;
}

// ─── Skeleton ──────────────────────────────────────────────────────────────

/** Single match card skeleton — responsive dimensions mirror MatchCard.tsx */
export function MatchCardSkeleton() {
  return (
    <div className="bg-secondary rounded-12 lg:rounded-16 p-[16px] flex flex-col gap-[16px] border border-transparent animate-pulse">
      {/* Top row: date/time + icons + league name */}
      <div className="flex items-center justify-between gap-[8px]">
        <div className="flex items-center gap-[8px]">
          <div className="h-[18px] lg:h-[19px] w-[50px] lg:w-[60px] rounded bg-white/10" />
          <div className="h-[18px] lg:h-[19px] w-[35px] lg:w-[40px] rounded bg-white/10" />
          <div className="size-[12px] lg:size-[16px] rounded bg-white/10" />
          <div className="size-[12px] lg:size-[16px] rounded bg-white/10" />
        </div>
        <div className="h-[18px] w-[80px] rounded bg-white/10 hidden lg:block" />
      </div>
      {/* Content: teams + odds */}
      <div className="flex items-start lg:items-center justify-between gap-[12px]">
        <div className="flex flex-col gap-[4px] lg:gap-[10px] min-w-0">
          <div className="flex items-center gap-[8px]">
            <div className="size-[16px] lg:size-[24px] rounded-full bg-white/10 shrink-0" />
            <div className="h-[18px] lg:h-[19px] w-[100px] lg:w-[120px] rounded bg-white/10" />
          </div>
          <div className="flex items-center gap-[8px]">
            <div className="size-[16px] lg:size-[24px] rounded-full bg-white/10 shrink-0" />
            <div className="h-[18px] lg:h-[19px] w-[80px] lg:w-[100px] rounded bg-white/10" />
          </div>
        </div>
        <div className="shrink-0 grid grid-cols-3 gap-y-[4px] gap-x-[8px] lg:gap-x-[16px]">
          <div className="h-[20px] w-[36px] lg:h-[19px] lg:w-[40px] rounded-8 lg:rounded bg-white/10" />
          <div className="h-[20px] w-[36px] lg:h-[19px] lg:w-[40px] rounded-8 lg:rounded bg-white/10" />
          <div className="h-[20px] w-[36px] lg:h-[19px] lg:w-[40px] rounded-8 lg:rounded bg-white/10" />
          <div className="h-[20px] w-[36px] lg:h-[32px] lg:w-[64px] rounded-8 lg:rounded-8 bg-white/10" />
          <div className="h-[20px] w-[36px] lg:h-[32px] lg:w-[64px] rounded-8 lg:rounded-8 bg-white/10" />
          <div className="h-[20px] w-[36px] lg:h-[32px] lg:w-[64px] rounded-8 lg:rounded-8 bg-white/10" />
        </div>
      </div>
    </div>
  );
}

/** League group skeleton: header + card grid (auto-fill mirrors LeagueGroupSection) */
export function LeagueGroupSkeleton({ cardCount = 2 }: { cardCount?: number }) {
  return (
    <div>
      {/* LeagueGroupHeader skeleton */}
      <div className="flex items-center gap-2 w-full min-h-[44px] px-2 py-2">
        <div className="size-[20px] rounded-full bg-white/10 animate-pulse shrink-0" />
        <div className="h-[18px] w-[100px] rounded bg-white/10 animate-pulse" />
        <div className="h-[18px] w-[20px] rounded bg-white/10 animate-pulse ml-auto" />
      </div>
      <div
        className="grid gap-[16px] mt-1"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 480px), 1fr))" }}
      >
        {Array.from({ length: cardCount }).map((_, i) => (
          <MatchCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/** Full timeline skeleton: date header + league groups — used by loading.tsx */
export function TimelineSkeleton() {
  return (
    <div className="space-y-1">
      {/* DateSectionHeader skeleton */}
      <div className="sticky top-0 z-10 flex items-center gap-2 px-2 py-3 bg-primary/95 backdrop-blur-sm border-b border-divider">
        <div className="h-[20px] w-[60px] rounded bg-white/10 animate-pulse" />
      </div>
      <LeagueGroupSkeleton cardCount={4} />
      <LeagueGroupSkeleton cardCount={2} />
    </div>
  );
}

/** @deprecated Use TimelineSkeleton instead */
export function MatchListSkeleton() {
  return <TimelineSkeleton />;
}
