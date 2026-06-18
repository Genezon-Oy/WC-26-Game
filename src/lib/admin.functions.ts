import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FLAGS } from "./flags";
import { toKickoffISO, inferStage, matchKey, uniqueTeams, type OFData } from "./openfootball";

const OPENFOOTBALL_URL =
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";

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

function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@league.local`;
}

export const adminGetResults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("tournament_results")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    return data;
  });

export const adminSetResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        winner: z.string().optional(),
        golden_boot: z.string().optional(),
        most_assists: z.string().optional(),
        semi_finalists: z.array(z.string()).max(4).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("tournament_results").upsert({
      id: 1,
      winner: data.winner ?? null,
      golden_boot: data.golden_boot ?? null,
      most_assists: data.most_assists ?? null,
      semi_finalists: data.semi_finalists ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Admin: create user (synthetic email from username) ----
export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        username: z
          .string()
          .min(2)
          .max(40)
          .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, underscore only"),
        password: z.string().min(6).max(200),
        display_name: z.string().min(1).max(80).optional(),
        is_admin: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = usernameToEmail(data.username);
    const display = data.display_name || data.username;
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { username: data.username.toLowerCase(), display_name: display },
    });
    if (error) throw new Error(error.message);
    if (data.is_admin && created.user) {
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: created.user.id, role: "admin" })
        .then(() => null);
    }
    return { id: created.user?.id, username: data.username.toLowerCase() };
  });

// ---- Admin: reset password ----
export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ user_id: z.string().uuid(), password: z.string().min(6).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Admin: delete user ----
export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Manual cascade delete to avoid FK constraints if not set on DB
    await Promise.all([
      supabaseAdmin.from("predictions").delete().eq("user_id", data.user_id),
      supabaseAdmin.from("futures_picks").delete().eq("user_id", data.user_id),
      supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id),
    ]);

    // Profiles
    await supabaseAdmin.from("profiles").delete().eq("id", data.user_id);

    // Auth user
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

// ---- Admin: list all users with roles ----
export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, username, display_name, created_at"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);
    const roleMap = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const list = roleMap.get(r.user_id) ?? [];
      list.push(r.role);
      roleMap.set(r.user_id, list);
    }
    return (profiles ?? []).map((p) => ({
      ...p,
      roles: roleMap.get(p.id) ?? [],
    }));
  });

export async function performSyncFixtures() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const res = await fetch(OPENFOOTBALL_URL, { headers: { "User-Agent": "wc-predictor" } });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const data = (await res.json()) as OFData;

  // Upsert teams
  const teams = uniqueTeams(data.matches).map((t) => ({
    name: t.name,
    group_code: t.group_code,
    flag_emoji: FLAGS[t.name] ?? null,
  }));
  const { error: tErr } = await supabaseAdmin.from("teams").upsert(teams, { onConflict: "name" });
  if (tErr) throw new Error(`Teams upsert: ${tErr.message}`);

  // Upsert matches
  const rows = data.matches.map((m) => {
    const stage = inferStage(m.round);
    const winner = m.score?.ft
      ? m.score.ft[0] > m.score.ft[1]
        ? m.team1
        : m.score.ft[1] > m.score.ft[0]
          ? m.team2
          : "draw"
      : null;
    return {
      match_key: matchKey(m),
      stage,
      group_code: m.group ? m.group.replace(/^Group\s+/i, "") : null,
      matchday: m.round,
      kickoff_at: toKickoffISO(m.date, m.time),
      venue: m.ground ?? null,
      home_team: m.team1,
      away_team: m.team2,
      home_score: m.score?.ft?.[0] ?? null,
      away_score: m.score?.ft?.[1] ?? null,
      home_score_ht: m.score?.ht?.[0] ?? null,
      away_score_ht: m.score?.ht?.[1] ?? null,
      status: m.score?.ft ? "finished" : "scheduled",
      winner,
    };
  });
  const { data: upsertedMatches, error: mErr } = await supabaseAdmin
    .from("matches")
    .upsert(rows, { onConflict: "match_key" })
    .select("id, status, home_score");
  if (mErr) throw new Error(`Matches upsert: ${mErr.message}`);

  if (upsertedMatches) {
    const finishedIds = upsertedMatches
      .filter((m) => m.status === "finished" && m.home_score !== null)
      .map((m) => m.id);
    
    if (finishedIds.length > 0) {
      await rescorePredictions(finishedIds);
    }
  }

  return { teams: teams.length, matches: rows.length };
}

// ---- Admin: sync fixtures from openfootball ----
export const adminSyncFixtures = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    return performSyncFixtures();
  });

// ---- Helper: recalculate prediction points for given match IDs ----
async function rescorePredictions(matchIds: string[]) {
  if (matchIds.length === 0) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  for (const matchId of matchIds) {
    const { error } = await supabaseAdmin.rpc("recompute_predictions_for_match", {
      _match_id: matchId,
    });
    if (error) {
      console.error(`Error rescoring match ${matchId}:`, error.message);
    }
  }
}

// ---- Admin: manually set a match result + rescore predictions ----
export const adminSetResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        match_id: z.string().uuid(),
        home_score: z.number().int().min(0).max(20),
        away_score: z.number().int().min(0).max(20),
        home_score_ht: z.number().int().min(0).max(20).nullable().optional(),
        away_score_ht: z.number().int().min(0).max(20).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: m, error: getErr } = await supabaseAdmin
      .from("matches")
      .select("home_team, away_team")
      .eq("id", data.match_id)
      .single();
    if (getErr) throw new Error(getErr.message);
    const winner =
      data.home_score > data.away_score
        ? m.home_team
        : data.away_score > data.home_score
          ? m.away_team
          : "draw";
    const { error } = await supabaseAdmin
      .from("matches")
      .update({
        home_score: data.home_score,
        away_score: data.away_score,
        home_score_ht: data.home_score_ht ?? null,
        away_score_ht: data.away_score_ht ?? null,
        status: "finished",
        winner,
      })
      .eq("id", data.match_id);
    if (error) throw new Error(error.message);

    // Recalculate points for all predictions on this match
    await rescorePredictions([data.match_id]);

    return { ok: true };
  });

export async function performPollLive() {
  const apiKey = import.meta.env.VITE_FOOTBALL_DATA_API_KEY || process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "FOOTBALL_DATA_API_KEY not set" };
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const res = await fetch("https://api.football-data.org/v4/competitions/WC/matches", {
    headers: { "X-Auth-Token": apiKey },
  });
  if (!res.ok) return { ok: false, error: `football-data.org: ${res.status}` };
  const json = (await res.json()) as {
    matches: Array<{
      utcDate: string;
      status: string;
      homeTeam: { name: string };
      awayTeam: { name: string };
      score: {
        fullTime: { home: number | null; away: number | null };
        halfTime: { home: number | null; away: number | null };
      };
    }>;
  };
  const candidates = (json.matches ?? []).map((m) => {
    const date = m.utcDate.slice(0, 10);
    return `${date}__${[m.homeTeam.name, m.awayTeam.name].sort().join("__vs__")}`;
  });

  if (candidates.length === 0) return { ok: true, updated: 0 };

  const { data: existingMatches } = await supabaseAdmin
    .from("matches")
    .select("id, match_key, stage, matchday, kickoff_at, venue, home_team, away_team, home_score, away_score, status")
    .in("match_key", candidates);

  if (!existingMatches || existingMatches.length === 0) {
    return { ok: true, updated: 0 };
  }

  const updatesToUpsert: import("./../integrations/supabase/types").Database["public"]["Tables"]["matches"]["Insert"][] =
    [];
  let updated = 0;

  for (const m of json.matches ?? []) {
    const date = m.utcDate.slice(0, 10);
    const matchKeyStr = `${date}__${[m.homeTeam.name, m.awayTeam.name].sort().join("__vs__")}`;

    const existing = existingMatches.find((e) => e.match_key === matchKeyStr);
    if (!existing) continue;

    const status =
      m.status === "FINISHED"
        ? "finished"
        : m.status === "IN_PLAY" || m.status === "PAUSED"
          ? "live"
          : "scheduled";

    // Only update if something actually changed
    if (
      existing.status === status &&
      existing.home_score === m.score.fullTime.home &&
      existing.away_score === m.score.fullTime.away
    ) {
      continue;
    }

    let winner = null;
    if (
      m.status === "FINISHED" &&
      m.score.fullTime.home !== null &&
      m.score.fullTime.away !== null
    ) {
      if (m.score.fullTime.home > m.score.fullTime.away) winner = existing.home_team;
      else if (m.score.fullTime.away > m.score.fullTime.home) winner = existing.away_team;
      else winner = "draw";
    }

    updatesToUpsert.push({
      ...existing,
      home_score: m.score.fullTime.home,
      away_score: m.score.fullTime.away,
      home_score_ht: m.score.halfTime.home,
      away_score_ht: m.score.halfTime.away,
      status,
      ...(winner ? { winner } : {}),
    });
    updated++;
  }

  if (updatesToUpsert.length > 0) {
    await supabaseAdmin.from("matches").upsert(updatesToUpsert, { onConflict: "id" });

    // Rescore predictions for all updated finished matches
    const finishedIds = updatesToUpsert
      .filter((u) => u.status === "finished" && u.home_score !== null)
      .map((u) => u.id!)
      .filter(Boolean);
    await rescorePredictions(finishedIds);
  }
  return { ok: true, updated };
}

// ---- Admin: pull live updates from football-data.org (FIFA World Cup 2026, comp 2000) ----
export const adminPollLive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    return performPollLive();
  });

// ---- Admin: manually insert a historical bet for a user ----
export const adminSetHistoricalBet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        user_id: z.string().uuid(),
        match_id: z.string().uuid(),
        pick: z.enum(["1", "X", "2"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Only admins can do this
    await assertAdmin(context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Upsert the prediction bypassing RLS
    const { error } = await supabaseAdmin.from("predictions").upsert(
      {
        user_id: data.user_id,
        match_id: data.match_id,
        pick: data.pick,
        points: 0, // Will be recalculated immediately if match has ended
      },
      { onConflict: "user_id, match_id" },
    );

    if (error) throw new Error(error.message);

    // Trigger recalculation for this match immediately
    await rescorePredictions([data.match_id]);

    return { ok: true };
  });
