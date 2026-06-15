import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const submitPrediction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        match_id: z.string().uuid(),
        pick: z.enum(["1", "X", "2"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("predictions").upsert(
      {
        user_id: userId,
        match_id: data.match_id,
        pick: data.pick,
        home_score: null,
        away_score: null,
      },
      { onConflict: "user_id,match_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [
      { data: profiles },
      { data: preds },
      { data: oddsData },
      { data: futures },
      { data: results },
      { data: finished },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, username, display_name, avatar_url"),
      supabaseAdmin.from("predictions").select("user_id, points, match_id, pick"),
      supabaseAdmin.from("match_odds").select("match_id, odds_1, odds_x, odds_2"),
      supabaseAdmin.from("futures_picks").select("*"),
      supabaseAdmin.from("tournament_results").select("*").maybeSingle(),
      supabaseAdmin
        .from("matches")
        .select("id, home_score, away_score")
        .not("home_score", "is", null),
    ]);

    const finishedSet = new Set((finished ?? []).map((m) => m.id));
    const oddsMap = new Map((oddsData ?? []).map((o) => [o.match_id, o]));
    const futuresMap = new Map((futures ?? []).map((f) => [f.user_id, f]));

    const stats = new Map<
      string,
      {
        safe_score_raw: number;
        matrix_score: number;
        futures_score: number;
        correct: number;
        settled: number;
        submitted: number;
      }
    >();

    // 1. Calculate base Safe Score and Matrix Score
    for (const p of preds ?? []) {
      const cur = stats.get(p.user_id) ?? {
        safe_score_raw: 0,
        matrix_score: 0,
        futures_score: 0,
        correct: 0,
        settled: 0,
        submitted: 0,
      };
      cur.submitted++;
      if (finishedSet.has(p.match_id)) {
        cur.settled++;
        const pts = Number(p.points);
        cur.safe_score_raw += pts;

        let oddsValue = 0;
        const o = oddsMap.get(p.match_id);
        if (p.pick === "1") oddsValue = Number(o?.odds_1) || 0;
        else if (p.pick === "X") oddsValue = Number(o?.odds_x) || 0;
        else if (p.pick === "2") oddsValue = Number(o?.odds_2) || 0;

        if (pts > 0) {
          cur.correct++;
          cur.matrix_score += oddsValue;
        } else {
          cur.matrix_score -= 1.0;
        }
      }
      stats.set(p.user_id, cur);
    }

    // 2. Calculate Futures Score
    for (const profile of profiles ?? []) {
      const cur = stats.get(profile.id) ?? {
        safe_score_raw: 0,
        matrix_score: 0,
        futures_score: 0,
        correct: 0,
        settled: 0,
        submitted: 0,
      };

      const pick = futuresMap.get(profile.id);
      if (pick && results) {
        if (results.winner && pick.winner === results.winner) cur.futures_score += 22;
        if (results.golden_boot && pick.golden_boot === results.golden_boot)
          cur.futures_score += 16;
        if (results.most_assists && pick.most_assists === results.most_assists)
          cur.futures_score += 13;
        if (results.semi_finalists && pick.semi_finalists) {
          for (const team of pick.semi_finalists) {
            if (results.semi_finalists.includes(team)) cur.futures_score += 5;
          }
        }
      }
      stats.set(profile.id, cur);
    }

    // 3. Determine Matrix Bonus (50% Yield)
    const matrixBonusMap = new Map<string, number>();
    for (const [userId, s] of stats.entries()) {
      matrixBonusMap.set(userId, s.matrix_score * 0.5);
    }

    // 4. Build final leaderboard
    return (profiles ?? [])
      .map((p) => {
        const s = stats.get(p.id)!;
        const matrix_bonus = matrixBonusMap.get(p.id) ?? 0;
        const total = s.safe_score_raw + s.futures_score + matrix_bonus;
        return {
          ...p,
          ...s,
          matrix_bonus,
          total: +total.toFixed(2),
          safe_score_raw: +s.safe_score_raw.toFixed(2),
          matrix_score: +s.matrix_score.toFixed(2),
        };
      })
      .sort(
        (a, b) =>
          b.total - a.total || b.correct - a.correct || a.username.localeCompare(b.username),
      );
  });

export const submitFutures = createServerFn({ method: "POST" })
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
    const { supabase, userId } = context;
    // Check if locked
    const { data: existing } = await supabase
      .from("futures_picks")
      .select("locked")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing?.locked) throw new Error("Valinnat on jo lukittu!");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("futures_picks").upsert(
      {
        user_id: userId,
        winner: data.winner ?? null,
        golden_boot: data.golden_boot ?? null,
        most_assists: data.most_assists ?? null,
        semi_finalists: data.semi_finalists ?? null,
        locked: true,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyFutures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("futures_picks")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    return data;
  });
