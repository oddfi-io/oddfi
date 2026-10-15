/**
 * Layered CDN cache strategy for market data.
 * Only applied to successful (200) GET responses.
 */
export function getCacheControl(path: string[], searchParams: URLSearchParams): string {
  // detail/sports_all?type=live — live scores, second-level freshness
  if (path[0] === "detail" && path[1] === "sports_all" && searchParams.get("type") === "live") {
    return "public, s-maxage=10, stale-while-revalidate=30";
  }

  // detail/sports_all — fixture list, minute-level freshness
  if (path[0] === "detail" && path[1] === "sports_all") {
    return "public, s-maxage=60, stale-while-revalidate=300";
  }

  // detail/fixture/{id} — single fixture + odds, second-level freshness
  if (path[0] === "detail" && path[1] === "fixture" && path.length >= 3) {
    return "public, s-maxage=10, stale-while-revalidate=30";
  }

  // detail/onchain_test_fixtures — 10-min rolling test fixtures with per-second
  // countdown fields (remaining_sec/phase); any SWR window would serve stale
  // rounds after rollover — never cache (DD-138 / REV-v1-B #B1)
  if (path[0] === "detail" && path[1] === "onchain_test_fixtures") {
    return "no-store";
  }

  // detail/fixture_date/{date} — dynamic TTL based on date distance
  if (path[0] === "detail" && path[1] === "fixture_date" && path[2]) {
    const target = new Date(path[2] + "T00:00:00Z");
    if (!isNaN(target.getTime())) {
      const now = new Date();
      const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      const diffDays = Math.floor((target.getTime() - todayUtc) / 86_400_000);
      if (diffDays <= 0) return "public, s-maxage=60, stale-while-revalidate=300";
      if (diffDays === 1) return "public, s-maxage=300, stale-while-revalidate=600";
      return "public, s-maxage=600, stale-while-revalidate=1800";
    }
  }

  // Fallback
  return "public, s-maxage=15, stale-while-revalidate=60";
}
