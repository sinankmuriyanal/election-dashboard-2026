# Election Dashboard — India Assembly Elections 2026

## Project Purpose
Professional election results dashboard for 5 Indian state assembly elections (Bihar, West Bengal, Assam, Kerala, Tamil Nadu) — May 2026. Features constituency-level results, party/alliance breakdowns, win margin analysis, and an alliance simulation engine ("what if parties had allied?").

## Stack
- **Framework:** Next.js 14 (App Router, TypeScript)
- **Styling:** Tailwind CSS (dark theme — `#0F172A` background)
- **Charts:** Recharts (SSR-safe via dynamic imports)
- **UI Primitives:** Radix UI (Accordion, Tabs, Tooltip, Dialog)
- **Data:** Static JSON in `/public/data/` — no database, no API routes
- **Deploy:** Vercel

## Commands
```bash
npm run dev          # local dev server
npm run build        # production build
npm run lint         # ESLint

# Scraper (run once to populate /public/data/)
cd scripts
pip install -r requirements.txt
python scrape_eci.py              # scrape all 5 states
python scrape_eci.py --state bihar  # single state
python scrape_eci.py --dry-run    # test URL discovery only
python validate_data.py          # check scraped data quality
```

## Data Flow
```
ECI website → scripts/scrape_eci.py → public/data/{state}/results.json
                                    → public/data/{state}/summary.json
                                    → public/data/index.json
                    ↓
          Next.js static generation → Vercel CDN → browser
```

All interactivity (search, sort, alliance simulator) is client-side JS.

## Project Structure
```
src/
  app/
    page.tsx                  # Overview — all 5 states
    [state]/page.tsx          # State detail (constituency table, charts)
    [state]/[constituency]/   # Constituency detail (candidates, margin)
    simulator/page.tsx        # Alliance Simulator (client component)
  components/
    overview/   StateCard, NationalSummaryBar
    state/      StateHeroBar, AllianceSummaryGrid, ConstituencyTable, WinMarginChart
    constituency/ CandidateVoteBar
    simulator/  PartyPicker, SimulatorResultsGrid, FlippedSeatsList
    ui/         SeatBar, PartyBadge, AllianceBadge, SearchInput, LastUpdated
  lib/
    data.ts           fetch functions (all fetch from /public/data/)
    simulator.ts      runSimulation() — pure function alliance computation
    party-colors.ts   party → hex color map
    state-metadata.ts static state info (seats, majority marks)
    format.ts         number/date formatters
  types/index.ts      shared TypeScript schema
scripts/
  scrape_eci.py          Python scraper
  party_alliance_map.json party→alliance mapping (edit after first scrape)
  validate_data.py       post-scrape validation
public/data/
  index.json
  {state}/results.json   array of ConstituencyResult
  {state}/summary.json   StateSummary with alliance/party tallies
```

## Alliance Simulator Logic
`src/lib/simulator.ts:runSimulation(constituencies, groups)`
1. Build `partyShort → groupId` map from user-defined groups
2. Per constituency: sum votes by group, find winner, check if flipped
3. Aggregate seat counts per group per state
4. Return `SimulationResult` with stateTallies + flippedSeats list

IND candidates are treated individually (by candidate name) to avoid merging unrelated independents.

## Key Design Decisions
- Dark theme only — professional dashboard aesthetic
- Recharts wrapped in `dynamic()` for SSR safety
- constituency pages use ISR (`revalidate: 3600`, `dynamicParams: true`) — not pre-built at deploy time to keep Vercel build fast
- State pages and overview are fully static (build-time generation)
- Party colors defined in `party-colors.ts` — extend this when new parties appear in scraped data

## Data Source
Election Commission of India: https://results.eci.gov.in/ResultAcGenMay2026/index.htm

## Changelog
- 2026-05-07: Initial scaffold — types, scraper, all pages, alliance simulator

- [2026-05-07] init: election dashboard scaffold — Next.js 14, all pages, alliance simulator, Python scraper
- [2026-05-13] update: settings.local.json