# Featured Matches Configuration Guide

This directory contains configuration files for the featured match system. Product managers can edit these files directly to adjust which matches appear in the Hero Carousel.

## Directory Structure

```
config/featured/
├── leagues.ts           # League tiers & SportMonks IDs
├── club-teams.ts        # Featured club teams per league
├── world-cup-teams.ts   # Featured national teams (World Cup)
├── scoring.ts           # Scoring weights & display thresholds
├── index.ts             # Re-exports (do not edit)
└── README.md            # This file
```

## Common Operations

### Add a Featured Club Team

Edit `club-teams.ts`, add the team name keyword to the corresponding league array:

```diff
  // Premier League
- 8: ['Arsenal', 'Chelsea', 'Liverpool', 'Manchester City', 'Manchester United', 'Tottenham'],
+ 8: ['Arsenal', 'Chelsea', 'Liverpool', 'Manchester City', 'Manchester United', 'Tottenham', 'Newcastle'],
```

### Remove a Featured Team

Delete the corresponding string from the array.

### Add a New League

1. In `leagues.ts`, add a new entry to `TIER1_LEAGUES` or `TIER2_LEAGUES`:
   ```typescript
   { id: 271, name: 'Superliga', tier: 2, context: 'club' },
   ```
2. In `club-teams.ts`, add featured teams for that league:
   ```typescript
   271: ['Galatasaray', 'Fenerbahce', 'Besiktas'],
   ```

### Change Hero Carousel Size

Edit `scoring.ts`:
```typescript
HERO_MATCH_LIMIT: 8,  // Show up to 8 matches instead of 5
```

### Adjust Featured Threshold

Edit `scoring.ts`:
```typescript
MIN_SCORE_FOR_HERO: 3,  // Only show matches where BOTH teams are featured
```

## How Matching Works

- Team names use **substring matching**: `'Barcelona'` matches `'FC Barcelona'`
- Matching **ignores accents**: `'Atletico'` matches `'Atlético Madrid'`
- Matching is **scoped by league**: `'Inter'` in Serie A won't match teams in other leagues

## How to Verify Changes

After editing, verify your keywords match actual SportMonks data:

```bash
# Check actual team names for a league (replace {leagueId})
curl -s "https://www.oddfi.io/api/sportmonks/fixtures/date/$(date +%Y-%m-%d)?include=participants&filters=fixtureLeagues:{leagueId}" \
  | jq '[.data[].participants[].name] | unique'
```

## Scoring Reference

| Scenario | Score | Shows in Hero? |
|----------|-------|---------------|
| Both teams are featured (e.g., Arsenal vs Liverpool) | 3 | Yes |
| One team is featured (e.g., Arsenal vs Burnley) | 2 | Yes (default threshold) |
| Top league but no featured team | 1 | No |
| Unknown league | 0 | No |
| World Cup match bonus | +0.5 | Breaks ties in favor of WC |
