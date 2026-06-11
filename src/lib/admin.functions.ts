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

// ---- Admin: create user (synthetic email from username) ----
export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        username: z.string().min(2).max(40).regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, underscore only"),
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

// ---- Admin: sync fixtures from openfootball ----
export const adminSyncFixtures = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
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
      const winner =
        m.score?.ft
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
    const { error: mErr } = await supabaseAdmin
      .from("matches")
      .upsert(rows, { onConflict: "match_key" });
    if (mErr) throw new Error(`Matches upsert: ${mErr.message}`);

    return { teams: teams.length, matches: rows.length };
  });

// ---- Admin: manually set a match result (and trigger rescore via DB trigger) ----
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
    return { ok: true };
  });

// ---- Admin: pull live updates from football-data.org (FIFA World Cup 2026, comp 2000) ----
export const adminPollLive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const apiKey = process.env.FOOTBALL_DATA_API_KEY;
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
    let updated = 0;
    for (const m of json.matches ?? []) {
      const date = m.utcDate.slice(0, 10);
      // Try both name orders since football-data names may differ slightly
      const candidates = [
        `${date}__${[m.homeTeam.name, m.awayTeam.name].sort().join("__vs__")}`,
      ];
      const { data: existing } = await supabaseAdmin
        .from("matches")
        .select("id")
        .in("match_key", candidates)
        .maybeSingle();
      if (!existing) continue;
      const status =
        m.status === "FINISHED"
          ? "finished"
          : m.status === "IN_PLAY" || m.status === "PAUSED"
            ? "live"
            : "scheduled";
      await supabaseAdmin
        .from("matches")
        .update({
          home_score: m.score.fullTime.home,
          away_score: m.score.fullTime.away,
          home_score_ht: m.score.halfTime.home,
          away_score_ht: m.score.halfTime.away,
          status,
        })
        .eq("id", existing.id);
      updated++;
    }
    return { ok: true, updated };
  });