import type { SportmonksOddsEntry } from "@/types/api";
import { mul, cmp } from "@/lib/decimal";
import { formatOdds } from "@/lib/odds";
import { assertUniqueKeys } from "@/lib/assert-unique-keys";

export interface OddsLine {
  lineValue: string;
  homeOdds: string;
  awayOdds: string;
  homeHandicap?: string;
  awayHandicap?: string;
  homeEntryId: number;
  awayEntryId: number;
}

/** Parse and group odds into sorted lines.
 *  Handles API quirks: asian_handicap labels may be '1'/'2' instead of 'Home'/'Away',
 *  and home/away entries may have opposite-sign handicap values for the same line. */
export function parseOddsLines(
  odds: SportmonksOddsEntry[],
  marketType: "asian_handicap" | "asian_total"
): OddsLine[] {
  const lineKey = marketType === "asian_handicap" ? "handicap" : "total";

  const isHome =
    marketType === "asian_handicap"
      ? (l: string) => l === "Home" || l === "1"
      : (l: string) => l === "Over";
  const isAway =
    marketType === "asian_handicap"
      ? (l: string) => l === "Away" || l === "2"
      : (l: string) => l === "Under";

  const homeEntries = odds.filter(
    (o) => isHome(o.label) && o[lineKey] != null && o[lineKey] !== ""
  );
  const awayEntries = odds.filter(
    (o) => isAway(o.label) && o[lineKey] != null && o[lineKey] !== ""
  );

  const lines: OddsLine[] = [];
  const usedAwayIds = new Set<number>();

  for (const home of homeEntries) {
    const hv = home[lineKey]!;
    const away = awayEntries.find((a) => {
      if (usedAwayIds.has(a.id)) return false;
      const av = a[lineKey]!;
      return cmp(av, hv) === 0 || (marketType === "asian_handicap" && cmp(av, mul(hv, "-1")) === 0);
    });
    if (away) usedAwayIds.add(away.id);

    lines.push({
      lineValue: hv,
      homeOdds: formatOdds(home.value),
      awayOdds: formatOdds(away?.value),
      homeHandicap: marketType === "asian_handicap" ? hv : undefined,
      awayHandicap:
        marketType === "asian_handicap" ? (away?.[lineKey] ?? mul(hv, "-1")) : undefined,
      homeEntryId: home.id,
      awayEntryId: away?.id ?? 0,
    });
  }

  lines.sort((a, b) => cmp(a.lineValue, b.lineValue));

  // Dev-only：dedupe 前先 warn 上游契约违规，便于反推后端 bug（ENH-030）
  assertUniqueKeys(lines, (l) => l.lineValue, `parseOddsLines(${marketType})`);

  // 同一 lineValue 可能因后端 label 别名（Home/1、Over/Under）或重复条目产生多行，
  // UI 期望每个盘口只渲染一次，保留第一条避免 React key 冲突。
  const seen = new Set<string>();
  const deduped = lines.filter((l) => {
    if (seen.has(l.lineValue)) return false;
    seen.add(l.lineValue);
    return true;
  });

  // DD-124：四分之一盘（.25/.75）由 0528 后端支持，前端不再过滤
  return deduped;
}
