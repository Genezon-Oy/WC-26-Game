import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// api-football (api-sports.io) — direct endpoint
const API_BASE = "https://v3.football.api-sports.io";

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// Map a few openfootball names → api-football names where they differ.
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

type Fixture = { fixture: { id: number; date: string }; teams: { home: { name: string }; away: { name: string } } };

async function apiFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY not configured");
  const q = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}${path}?${q}`, {
    headers: { "x-apisports-key": key },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`api-football ${path} ${res.status}: ${text.slice(0, 200)}`);
  let json: { response: T; errors?: unknown };
  try { json = JSON.parse(text); } catch { throw new Error(`api-football ${path}: invalid JSON`); }
  // api-football returns 200 with errors object/array on quota/auth issues
  const errs = json.errors;
  if (errs && ((Array.isArray(errs) && errs.length) || (typeof errs === "object" && Object.keys(errs as object).length))) {
    throw new Error(`api-football ${path}: ${JSON.stringify(errs).slice(0, 300)}`);
  }
  return json.response;
}

async function findFixtureId(date: string, home: string, away: string): Promise<string | null> {
  // World Cup 2026 league id in api-football is 1; if season changes, fall back to date-only search.
  const tryParams: Array<Record<string, string>> = [
    { date, league: "1", season: "2026" },
    { date },
  ];
  for (const params of tryParams) {
    try {
      const fixtures = await apiFetch<Fixture[]>("/fixtures", params);
      const hit = fixtures.find((f) => namesMatch(f.teams.home.name, home) && namesMatch(f.teams.away.name, away));
      if (hit) return String(hit.fixture.id);
    } catch {
      // try next
    }
  }
  return null;
}

type OddsResponse = Array<{
  fixture: { id: number };
  bookmakers: Array<{
    id: number;
    name: string;
    bets: Array<{ id: number; name: string; values: Array<{ value: string; odd: string }> }>;
  }>;
}>;

function pickOddsFromResponse(rsp: OddsResponse): { odds_1: number; odds_x: number; odds_2: number; bookmaker: string } | null {
  if (!rsp.length) return null;
  // Average across all bookmakers offering "Match Winner".
  const sums = { "1": 0, X: 0, "2": 0 };
  const counts = { "1": 0, X: 0, "2": 0 };
  let usedBooks = 0;
  for (const book of rsp[0].bookmakers) {
    const bet = book.bets.find((b) => b.name === "Match Winner" || b.id === 1);
    if (!bet) continue;
    const h = bet.values.find((v) => v.value === "Home" || v.value === "1");
    const d = bet.values.find((v) => v.value === "Draw" || v.value === "X");
    const a = bet.values.find((v) => v.value === "Away" || v.value === "2");
    if (!h || !d || !a) continue;
    sums["1"] += parseFloat(h.odd); counts["1"]++;
    sums.X += parseFloat(d.odd); counts.X++;
    sums["2"] += parseFloat(a.odd); counts["2"]++;
    usedBooks++;
  }
  if (!usedBooks) return null;
  return {
    odds_1: +(sums["1"] / counts["1"]).toFixed(2),
    odds_x: +(sums.X / counts.X).toFixed(2),
    odds_2: +(sums["2"] / counts["2"]).toFixed(2),
    bookmaker: `average (${usedBooks} bookmakers)`,
  };
}

async function snapshotOneMatch(matchId: string): Promise<{ ok: boolean; reason?: string; odds?: { odds_1: number; odds_x: number; odds_2: number } }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: m, error } = await supabaseAdmin
    .from("matches")
    .select("id, kickoff_at, home_team, away_team, api_fixture_id")
    .eq("id", matchId)
    .single();
  if (error || !m) return { ok: false, reason: error?.message ?? "match not found" };

  let fixtureId = m.api_fixture_id;
  if (!fixtureId) {
    const date = m.kickoff_at.slice(0, 10);
    fixtureId = await findFixtureId(date, m.home_team, m.away_team);
    if (fixtureId) {
      await supabaseAdmin.from("matches").update({ api_fixture_id: fixtureId }).eq("id", m.id);
    }
  }
  if (!fixtureId) return { ok: false, reason: "fixture not found in api-football" };

  const rsp = await apiFetch<OddsResponse>("/odds", { fixture: fixtureId });
  const picked = pickOddsFromResponse(rsp);
  if (!picked) return { ok: false, reason: "no Match Winner odds available" };

  const minutesToKickoff = (new Date(m.kickoff_at).getTime() - Date.now()) / 60000;
  const shouldLock = minutesToKickoff <= 30; // lock when ≤30 min to kickoff (or already started)

  await supabaseAdmin
    .from("match_odds")
    .upsert(
      {
        match_id: m.id,
        odds_1: picked.odds_1,
        odds_x: picked.odds_x,
        odds_2: picked.odds_2,
        bookmaker: picked.bookmaker,
        source: "api-football",
        snapshot_at: new Date().toISOString(),
        locked: shouldLock,
      },
      { onConflict: "match_id" },
    );

  return { ok: true, odds: { odds_1: picked.odds_1, odds_x: picked.odds_x, odds_2: picked.odds_2 } };
}

// Admin: refresh (and lock if near kickoff) odds for all upcoming matches that aren't locked yet.
export const adminRefreshOdds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const horizonIso = new Date(Date.now() + 14 * 24 * 3600_000).toISOString(); // next 14 days
    const { data: matches } = await supabaseAdmin
      .from("matches")
      .select("id, kickoff_at, match_odds:match_odds(locked)")
      .lte("kickoff_at", horizonIso)
      .gte("kickoff_at", new Date(Date.now() - 3 * 3600_000).toISOString()) // include very recent kickoffs
      .order("kickoff_at", { ascending: true })
      .limit(60);

    let updated = 0;
    let failed = 0;
    const errors: string[] = [];
    for (const m of matches ?? []) {
      // skip already locked
      const odds = (m as unknown as { match_odds: Array<{ locked: boolean }> | { locked: boolean } | null }).match_odds;
      const isLocked = Array.isArray(odds) ? odds[0]?.locked : odds?.locked;
      if (isLocked) continue;
      try {
        const r = await snapshotOneMatch(m.id);
        if (r.ok) updated++;
        else { failed++; if (r.reason) errors.push(`${m.id}: ${r.reason}`); }
      } catch (e) {
        failed++;
        errors.push(`${m.id}: ${(e as Error).message}`);
      }
      // Be polite to API
      await new Promise((r) => setTimeout(r, 150));
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