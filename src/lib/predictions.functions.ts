import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Submit or update a single 1X2 prediction (RLS enforces kickoff lock).
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

// Leaderboard: aggregate points per user.
export const getLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles }, { data: preds }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, username, display_name"),
      supabaseAdmin.from("predictions").select("user_id, points, match_id"),
    ]);
    const { data: finished } = await supabaseAdmin
      .from("matches")
      .select("id, home_score, away_score")
      .not("home_score", "is", null);
    const finishedSet = new Set((finished ?? []).map((m) => m.id));

    const stats = new Map<
      string,
      { total: number; correct: number; settled: number; submitted: number }
    >();
    for (const p of preds ?? []) {
      const cur = stats.get(p.user_id) ?? {
        total: 0,
        correct: 0,
        settled: 0,
        submitted: 0,
      };
      cur.submitted++;
      if (finishedSet.has(p.match_id)) {
        cur.settled++;
        const pts = Number(p.points);
        cur.total += pts;
        if (pts > 0) cur.correct++;
      }
      stats.set(p.user_id, cur);
    }

    return (profiles ?? [])
      .map((p) => {
        const s = stats.get(p.id) ?? {
          total: 0,
          correct: 0,
          settled: 0,
          submitted: 0,
        };
        return { ...p, ...s, total: +s.total.toFixed(2) };
      })
      .sort(
        (a, b) =>
          b.total - a.total || b.correct - a.correct || a.username.localeCompare(b.username),
      );
  });
