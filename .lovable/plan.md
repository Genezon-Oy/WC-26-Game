## Goal
Replace the flat 2-point 1X2 system with an odds-based "betting value" competition. Each correct pick awards points equal to the decimal odds snapshotted at kickoff. Wrong = 0.

## Data model
New migration:
- `match_odds` table — one row per match
  - `match_id` (uuid, FK → matches.id, unique)
  - `odds_1`, `odds_x`, `odds_2` (numeric)
  - `source` (text, default `'api-football'`)
  - `snapshot_at` (timestamptz) — when locked
  - `locked` (boolean, default false) — true once kickoff snapshot is taken
  - timestamps
  - RLS: select for `anon` + `authenticated`; writes only `service_role`
- Add `points` recalculation to use odds instead of flat 2

Replace `public.score_pick(pick, home, away)` with `public.score_pick_odds(pick, home, away, odds_1, odds_x, odds_2)` returning numeric. Update `recompute_match_predictions` trigger to multiply by the locked odds from `match_odds`.

Change `predictions.points` from `integer` to `numeric(6,2)`.

## Odds ingestion (api-football)
1. Add secret `API_FOOTBALL_KEY` (RapidAPI or direct).
2. Server function `snapshotMatchOdds({ match_id })` — admin-only:
   - Fetches `/odds?fixture={apiFixtureId}` or by date+teams
   - Picks bookmaker average or a chosen bookmaker (e.g. Bet365), market "Match Winner"
   - Upserts into `match_odds` with `locked=false`
3. Server function `lockOddsForKickoff()` — runs for matches within next ~15 min:
   - Snapshots latest odds, sets `locked=true`, `snapshot_at=now()`
   - Then recomputes predictions for matches whose result already exists (none yet at kickoff, but safe)
4. Public cron route `/api/public/cron/lock-odds` (no auth, signature via shared secret header) — called every 5 min. We'll give the user the URL to paste into an external cron (cron-job.org / GitHub Actions) since pg_cron-to-http isn't wired.

Matches need an `api_fixture_id` column (nullable text) to map to api-football. Add to `matches` via migration; admin UI lets you paste/lookup it per match.

## UI changes
- `MatchCard` — show current/locked odds under each 1/X/2 pick button.
- `veikkaa.$matchId` — show live odds; replace "Oikea veikkaus = 2 pistettä" with "Oikea veikkaus = kerroin × 1 piste (esim. 3.40 → 3.40 p)".
- `dashboard` Sarjataulukko / leaderboard — points display as 1 decimal (e.g. `12.4`).
- `predictions` history — show odds at lock and points earned.
- `admin` — add panel: "Päivitä kertoimet" (snapshot now), "Lukitse kertoimet kaikille tuleville", per-match api_fixture_id editor.

## Scoring code
`src/lib/predictions.functions.ts` `getLeaderboard`: keep aggregation but treat points as numeric; drop the exact/diff/result breakdown (only "correct" / "wrong" remain). Stats: `correct`, `submitted`, `settled`, `total` (numeric).

## Migration order (single migration)
1. `ALTER TABLE matches ADD COLUMN api_fixture_id text`
2. `CREATE TABLE match_odds (...)` + GRANTs + RLS + select policy
3. `ALTER TABLE predictions ALTER COLUMN points TYPE numeric(6,2)`
4. New `score_pick_odds` function
5. Replace `recompute_match_predictions` trigger body to look up odds and call new scorer; if `match_odds.locked=false` for that match, points = 0 until locked.

## Out of scope (now)
- Bankroll / staking variants
- Multiple bookmakers / line shopping
- Historical odds movement display
- Live (in-play) odds

## Open follow-ups after build mode
- After approval I'll prompt for `API_FOOTBALL_KEY` secret.
- You'll need to fill `api_fixture_id` for existing matches (via admin) before odds can be fetched.
