import type { SportmonksLeague } from "@/types/api";

interface RegionGroup {
  label: string;
  countryIds: number[];
}

// Verified against backend GET /api/v1/detail/sports_all?league=0&country_id={cid} (DD-083 Batch 1, 2026-04-24)
const REGION_GROUPS: (RegionGroup & { labelKey: string })[] = [
  { label: "England", labelKey: "regionEngland", countryIds: [462] },
  { label: "Spain", labelKey: "regionSpain", countryIds: [32] },
  { label: "Italy", labelKey: "regionItaly", countryIds: [251] },
  { label: "Germany", labelKey: "regionGermany", countryIds: [11] },
  { label: "France", labelKey: "regionFrance", countryIds: [17] },
  { label: "Portugal", labelKey: "regionPortugal", countryIds: [20] },
  { label: "Netherlands", labelKey: "regionNetherlands", countryIds: [38] },
  { label: "Belgium", labelKey: "regionBelgium", countryIds: [556] },
  { label: "Saudi Arabia", labelKey: "regionSaudiArabia", countryIds: [35376] },
  { label: "Turkey", labelKey: "regionTurkey", countryIds: [404] },
  { label: "Norway", labelKey: "regionNorway", countryIds: [1578] },
  { label: "Sweden", labelKey: "regionSweden", countryIds: [47] },
  { label: "USA", labelKey: "regionUsa", countryIds: [3484] },
  { label: "Japan", labelKey: "regionJapan", countryIds: [479] },
];

export function groupLeaguesByRegion(leagues: SportmonksLeague[]) {
  const grouped: {
    label: string;
    labelKey: string;
    leagues: SportmonksLeague[];
  }[] = [];
  const assigned = new Set<number>();

  for (const region of REGION_GROUPS) {
    const match = leagues.filter((l) => region.countryIds.includes(l.country_id));
    if (match.length > 0) {
      grouped.push({
        label: region.label,
        labelKey: region.labelKey,
        leagues: match,
      });
      match.forEach((l) => assigned.add(l.id));
    }
  }

  const rest = leagues.filter((l) => !assigned.has(l.id));
  if (rest.length > 0) {
    grouped.push({ label: "Other", labelKey: "other", leagues: rest });
  }

  return grouped;
}
