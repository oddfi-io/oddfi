# League ID × Country ID 映射（DD-083 Batch 1 探测产出）

**生成时间**: 2026-04-24T03:44:08.726Z
**数据源**: `http://market-api.oddfi.io:8080/api/v1/detail/sports_all?league=0&country_id={cid}`
**扫描**: 15 个国家 / 发现 15 个联赛

## 按国家分组

### Belgium (country_id=556)

| league_id | name               | fixtures | short_code | image_path                                                  |
| --------- | ------------------ | -------- | ---------- | ----------------------------------------------------------- |
| 208       | 比利时足球甲级联赛 | 53       | BEL FDA    | https://cdn.sportmonks.com/images/soccer/leagues/16/208.png |

### Saudi Arabia (country_id=35376)

| league_id | name       | fixtures | short_code | image_path                                                  |
| --------- | ---------- | -------- | ---------- | ----------------------------------------------------------- |
| 944       | pro_league | 49       | SAU PL     | https://cdn.sportmonks.com/images/soccer/leagues/16/944.png |

### England (Premier League) (country_id=462)

| league_id | name           | fixtures | short_code | image_path                                               |
| --------- | -------------- | -------- | ---------- | -------------------------------------------------------- |
| 8         | premier_league | 49       | UK PL      | https://cdn.sportmonks.com/images/soccer/leagues/8/8.png |
| 9         | Championship   | 28       | UK CHAMP   | https://cdn.sportmonks.com/images/soccer/leagues/9/9.png |

### England (Championship) (country_id=515)

_未发现任何联赛（接口返回为空）_

### Germany (country_id=11)

_未发现任何联赛（接口返回为空）_

### France (country_id=17)

| league_id | name    | fixtures | short_code | image_path                                                  |
| --------- | ------- | -------- | ---------- | ----------------------------------------------------------- |
| 301       | Ligue 1 | 38       | FRA L1     | https://cdn.sportmonks.com/images/soccer/leagues/13/301.png |

### Spain (country_id=32)

| league_id | name      | fixtures | short_code | image_path                                                  |
| --------- | --------- | -------- | ---------- | ----------------------------------------------------------- |
| 564       | La Liga   | 66       | ESP PL     | https://cdn.sportmonks.com/images/soccer/leagues/20/564.png |
| 567       | La Liga 2 | 63       | ESP S      | https://cdn.sportmonks.com/images/soccer/leagues/23/567.png |

### Italy (country_id=251)

| league_id | name    | fixtures | short_code | image_path                                                 |
| --------- | ------- | -------- | ---------- | ---------------------------------------------------------- |
| 384       | Serie A | 50       | ITA SA     | https://cdn.sportmonks.com/images/soccer/leagues/0/384.png |
| 387       | Serie B | 30       | ITA SB     | https://cdn.sportmonks.com/images/soccer/leagues/3/387.png |

### Netherlands (country_id=38)

| league_id | name       | fixtures | short_code | image_path                                              |
| --------- | ---------- | -------- | ---------- | ------------------------------------------------------- |
| 72        | Eredivisie | 36       | NLD E      | https://cdn.sportmonks.com/images/soccer/leagues/72.png |

### Turkey (country_id=404)

| league_id | name      | fixtures | short_code | image_path                                                  |
| --------- | --------- | -------- | ---------- | ----------------------------------------------------------- |
| 600       | Super Lig | 36       | TUR SL     | https://cdn.sportmonks.com/images/soccer/leagues/24/600.png |

### Portugal (country_id=20)

| league_id | name          | fixtures | short_code | image_path                                                  |
| --------- | ------------- | -------- | ---------- | ----------------------------------------------------------- |
| 462       | Liga Portugal | 37       | PRT PL     | https://cdn.sportmonks.com/images/soccer/leagues/14/462.png |

### Norway (country_id=1578)

| league_id | name        | fixtures | short_code | image_path                                                  |
| --------- | ----------- | -------- | ---------- | ----------------------------------------------------------- |
| 444       | Eliteserien | 199      | NOR TL     | https://cdn.sportmonks.com/images/soccer/leagues/28/444.png |

### Sweden (country_id=47)

| league_id | name        | fixtures | short_code | image_path                                                  |
| --------- | ----------- | -------- | ---------- | ----------------------------------------------------------- |
| 573       | Allsvenskan | 216      | SWE AL     | https://cdn.sportmonks.com/images/soccer/leagues/29/573.png |

### USA (country_id=3484)

_未发现任何联赛（接口返回为空）_

### Japan (country_id=479)

_未发现任何联赛（接口返回为空）_

## TIER3_LEAGUES 回填模板（`config/featured/leagues.ts`）

```ts
export const TIER3_LEAGUES: LeagueConfig[] = [
  { id: 208, name: "比利时足球甲级联赛", tier: 3, context: "club", weight: 3, countryId: 556 },
  { id: 944, name: "pro_league", tier: 3, context: "club", weight: 3, countryId: 35376 },
  { id: 9, name: "Championship", tier: 3, context: "club", weight: 3, countryId: 462 },
  { id: 8, name: "premier_league", tier: 3, context: "club", weight: 3, countryId: 462 },
  { id: 301, name: "Ligue 1", tier: 3, context: "club", weight: 3, countryId: 17 },
  { id: 564, name: "La Liga", tier: 3, context: "club", weight: 3, countryId: 32 },
  { id: 567, name: "La Liga 2", tier: 3, context: "club", weight: 3, countryId: 32 },
  { id: 387, name: "Serie B", tier: 3, context: "club", weight: 3, countryId: 251 },
  { id: 384, name: "Serie A", tier: 3, context: "club", weight: 3, countryId: 251 },
  { id: 72, name: "Eredivisie", tier: 3, context: "club", weight: 3, countryId: 38 },
  { id: 600, name: "Super Lig", tier: 3, context: "club", weight: 3, countryId: 404 },
  { id: 462, name: "Liga Portugal", tier: 3, context: "club", weight: 3, countryId: 20 },
  { id: 444, name: "Eliteserien", tier: 3, context: "club", weight: 3, countryId: 1578 },
  { id: 573, name: "Allsvenskan", tier: 3, context: "club", weight: 3, countryId: 47 },
];
```

## REGION_GROUPS 回填模板（`lib/league-utils.ts`）

```ts
const REGION_GROUPS = [
  { label: "Belgium", labelKey: "regionBelgium", countryIds: [556] },
  { label: "Saudi Arabia", labelKey: "regionSaudiArabia", countryIds: [35376] },
  { label: "England", labelKey: "regionEnglandPremierLeague", countryIds: [462] },
  { label: "England", labelKey: "regionEnglandChampionship", countryIds: [515] },
  { label: "Germany", labelKey: "regionGermany", countryIds: [11] },
  { label: "France", labelKey: "regionFrance", countryIds: [17] },
  { label: "Spain", labelKey: "regionSpain", countryIds: [32] },
  { label: "Italy", labelKey: "regionItaly", countryIds: [251] },
  { label: "Netherlands", labelKey: "regionNetherlands", countryIds: [38] },
  { label: "Turkey", labelKey: "regionTurkey", countryIds: [404] },
  { label: "Portugal", labelKey: "regionPortugal", countryIds: [20] },
  { label: "Norway", labelKey: "regionNorway", countryIds: [1578] },
  { label: "Sweden", labelKey: "regionSweden", countryIds: [47] },
  { label: "USA", labelKey: "regionUSA", countryIds: [3484] },
  { label: "Japan", labelKey: "regionJapan", countryIds: [479] },
];
```
