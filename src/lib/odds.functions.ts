import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// Map a few openfootball names → The Odds API names where they differ.
const NAME_ALIASES: Record<string, string[]> = {
  "ivory coast": ["cote divoire", "cotedivoire"],
  "south korea": ["koreareplublic", "korearepublic"],
  "united states": ["usa"],
  "dr congo": ["congodr", "democraticrepublicofcongo"],
  "cape verde": ["capeverdeislands"],
};

function namesMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  for (const [k, vs] of Object.entries(NAME_ALIASES)) {
    const nk = normalize(k);
    if ((nk === na && vs.some((v) => normalize(v) === nb)) ||
        (nk === nb && vs.some((v) => normalize(v) === na))) return true;
  }
  return false;
}

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

type OddsApiOutcome = {
  name: string;
  price: number;
};

type OddsApiMarket = {
  key: string;
  outcomes: OddsApiOutcome[];
};

type OddsApiBookmaker = {
  key: string;
  title: string;
  markets: OddsApiMarket[];
};

type OddsApiEvent = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
};

async function fetchOddsFromAPI(apiKey: string): Promise<OddsApiEvent[]> {
  const url = `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds?apiKey=${apiKey}&regions=eu&markets=h2h&oddsFormat=decimal`;
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`The Odds API returned ${res.status}: ${text.slice(0, 200)}`);
  }
  try {
    return JSON.parse(text) as OddsApiEvent[];
  } catch {
    throw new Error("The Odds API returned invalid JSON");
  }
}

function calculateAverageOdds(event: { home_team: string; away_team: string; bookmakers: OddsApiBookmaker[] }): { odds_1: number; odds_x: number; odds_2: number; bookmaker: string } | null {
  let sum1 = 0, sumX = 0, sum2 = 0;
  let count1 = 0, countX = 0, count2 = 0;
  let bookmakersUsed = 0;

  for (const bookmaker of event.bookmakers) {
    const market = bookmaker.markets.find((m) => m.key === "h2h");
    if (!market) continue;

    const homeOutcome = market.outcomes.find((o) => namesMatch(o.name, event.home_team));
    const awayOutcome = market.outcomes.find((o) => namesMatch(o.name, event.away_team));
    const drawOutcome = market.outcomes.find((o) => o.name.toLowerCase() === "draw");

    if (homeOutcome && awayOutcome && drawOutcome) {
      sum1 += homeOutcome.price;
      count1++;
      sum2 += awayOutcome.price;
      count2++;
      sumX += drawOutcome.price;
      countX++;
      bookmakersUsed++;
    }
  }

  if (bookmakersUsed === 0) return null;

  return {
    odds_1: +(sum1 / count1).toFixed(2),
    odds_x: +(sumX / countX).toFixed(2),
    odds_2: +(sum2 / count2).toFixed(2),
    bookmaker: `average (${bookmakersUsed} bookmakers)`,
  };
}

function findMatchingEvent(
  dbHome: string,
  dbAway: string,
  dbKickoff: string,
  events: OddsApiEvent[]
): OddsApiEvent | null {
  const kickoffTime = new Date(dbKickoff).getTime();
  return events.find((e) => {
    const commenceTime = new Date(e.commence_time).getTime();
    const daysDiff = Math.abs(commenceTime - kickoffTime) / (1000 * 60 * 60 * 24);
    if (daysDiff > 3) return false;

    const directMatch = namesMatch(e.home_team, dbHome) && namesMatch(e.away_team, dbAway);
    const swappedMatch = namesMatch(e.home_team, dbAway) && namesMatch(e.away_team, dbHome);
    return directMatch || swappedMatch;
  }) || null;
}

async function snapshotOneMatch(matchId: string): Promise<{ ok: boolean; reason?: string; odds?: { odds_1: number; odds_x: number; odds_2: number } }> {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return { ok: false, reason: "ODDS_API_KEY not configured" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: m, error } = await supabaseAdmin
    .from("matches")
    .select("id, kickoff_at, home_team, away_team")
    .eq("id", matchId)
    .single();
  if (error || !m) return { ok: false, reason: error?.message ?? "match not found" };

  let events: OddsApiEvent[];
  try {
    events = await fetchOddsFromAPI(apiKey);
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }

  const matchedEvent = findMatchingEvent(m.home_team, m.away_team, m.kickoff_at, events);
  if (!matchedEvent) {
    return { ok: false, reason: `Match not found in The Odds API response for ${m.home_team} vs ${m.away_team}` };
  }

  const picked = calculateAverageOdds(matchedEvent);
  if (!picked) return { ok: false, reason: "No h2h odds available for this match in The Odds API" };

  const minutesToKickoff = (new Date(m.kickoff_at).getTime() - Date.now()) / 60000;
  const shouldLock = minutesToKickoff <= 30;

  const { error: upsertErr } = await supabaseAdmin
    .from("match_odds")
    .upsert(
      {
        match_id: m.id,
        odds_1: picked.odds_1,
        odds_x: picked.odds_x,
        odds_2: picked.odds_2,
        bookmaker: picked.bookmaker,
        source: "the-odds-api",
        snapshot_at: new Date().toISOString(),
        locked: shouldLock,
      },
      { onConflict: "match_id" },
    );

  if (upsertErr) return { ok: false, reason: `Database upsert: ${upsertErr.message}` };

  return { ok: true, odds: { odds_1: picked.odds_1, odds_x: picked.odds_x, odds_2: picked.odds_2 } };
}

// Admin: refresh (and lock if near kickoff) odds for all upcoming matches that aren't locked yet.
export const adminRefreshOdds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const apiKey = process.env.ODDS_API_KEY;
    if (!apiKey) {
      return { updated: 0, failed: 0, errors: ["ODDS_API_KEY not configured"] };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const horizonIso = new Date(Date.now() + 14 * 24 * 3600_000).toISOString(); // next 14 days
    const { data: matches } = await supabaseAdmin
      .from("matches")
      .select("id, kickoff_at, home_team, away_team, match_odds:match_odds(locked)")
      .lte("kickoff_at", horizonIso)
      .gte("kickoff_at", new Date(Date.now() - 3 * 3600_000).toISOString()) // include very recent kickoffs
      .order("kickoff_at", { ascending: true })
      .limit(60);

    if (!matches?.length) {
      return { updated: 0, failed: 0, errors: [] };
    }

    let events: OddsApiEvent[];
    try {
      events = await fetchOddsFromAPI(apiKey);
    } catch (err) {
      return { updated: 0, failed: matches.length, errors: [(err as Error).message] };
    }

    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const m of matches) {
      const odds = (m as unknown as { match_odds: Array<{ locked: boolean }> | { locked: boolean } | null }).match_odds;
      const isLocked = Array.isArray(odds) ? odds[0]?.locked : odds?.locked;
      if (isLocked) continue;

      const matchedEvent = findMatchingEvent(m.home_team, m.away_team, m.kickoff_at, events);
      if (!matchedEvent) {
        failed++;
        errors.push(`${m.id}: match not found in The Odds API`);
        continue;
      }

      const picked = calculateAverageOdds(matchedEvent);
      if (!picked) {
        failed++;
        errors.push(`${m.id}: no h2h odds available`);
        continue;
      }

      const minutesToKickoff = (new Date(m.kickoff_at).getTime() - Date.now()) / 60000;
      const shouldLock = minutesToKickoff <= 30;

      const { error: upsertErr } = await supabaseAdmin
        .from("match_odds")
        .upsert(
          {
            match_id: m.id,
            odds_1: picked.odds_1,
            odds_x: picked.odds_x,
            odds_2: picked.odds_2,
            bookmaker: picked.bookmaker,
            source: "the-odds-api",
            snapshot_at: new Date().toISOString(),
            locked: shouldLock,
          },
          { onConflict: "match_id" },
        );

      if (upsertErr) {
        failed++;
        errors.push(`${m.id}: database error ${upsertErr.message}`);
      } else {
        updated++;
      }
    }

    return { updated, failed, errors: errors.slice(0, 10) };
  });

// Admin: snapshot a single match's odds now (does not lock unless within 30 min).
export const adminSnapshotMatchOdds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ match_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const r = await snapshotOneMatch(data.match_id);
    if (!r.ok) throw new Error(r.reason ?? "snapshot failed");
    return r;
  });

// Admin: lock all currently-snapshotted odds for matches at/within 5 min of kickoff.
export const adminLockKickoffOdds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cutoff = new Date(Date.now() + 5 * 60_000).toISOString();
    // Find unlocked odds for matches kicking off soon, snapshot them fresh and lock
    const { data: matches } = await supabaseAdmin
      .from("matches")
      .select("id, kickoff_at, match_odds:match_odds(locked)")
      .lte("kickoff_at", cutoff)
      .gte("kickoff_at", new Date(Date.now() - 60_000).toISOString());
    let locked = 0;
    for (const m of matches ?? []) {
      const odds = (m as unknown as { match_odds: Array<{ locked: boolean }> | { locked: boolean } | null }).match_odds;
      const isLocked = Array.isArray(odds) ? odds[0]?.locked : odds?.locked;
      if (isLocked) continue;
      const r = await snapshotOneMatch(m.id);
      if (r.ok) locked++;
    }
    return { locked };
  });

// Public: list current odds for matches (used in UI)
export const getOddsMap = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("match_odds")
      .select("match_id, odds_1, odds_x, odds_2, locked, snapshot_at");
    return data ?? [];
  });