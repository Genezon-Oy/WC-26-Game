import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Flag } from "@/components/Flag";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/fixtures/$matchId")({
  component: MatchDetail,
});

function MatchDetail() {
  const { matchId } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["match", matchId],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      const [{ data: match }, { data: preds }, { data: oddsData }] = await Promise.all([
        supabase.from("matches").select("*").eq("id", matchId).single(),
        supabase.from("predictions").select("*").eq("match_id", matchId),
        supabase.from("match_odds").select("*").eq("match_id", matchId).single(),
      ]);
      const my = userId ? ((preds ?? []).find((p) => p.user_id === userId) ?? null) : null;
      // Get player names for predictions visible after kickoff
      const userIds = (preds ?? []).map((p) => p.user_id);
      const { data: profiles } =
        userIds.length > 0
          ? await supabase.from("profiles").select("id, display_name, username").in("id", userIds)
          : { data: [] };
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      return { match, preds: preds ?? [], my, profileMap, userId, odds: oddsData };
    },
  });

  const m = data?.match;
  const locked = m ? new Date(m.kickoff_at).getTime() <= Date.now() : false;
  const finished = m?.home_score !== null && m?.home_score !== undefined;
  const actualPick: "1" | "X" | "2" | null =
    finished && m
      ? m.home_score! > m.away_score!
        ? "1"
        : m.home_score! === m.away_score!
          ? "X"
          : "2"
      : null;

  if (isLoading || !m) return <div className="text-muted-foreground">Ladataan…</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link to="/fixtures" className="text-sm text-primary hover:underline">
        ← Kaikki ottelut
      </Link>
      <div className="rounded-2xl border border-border/60 bg-card/70 p-6">
        <div className="text-center text-xs uppercase tracking-wider text-muted-foreground">
          {m.group_code ? `Lohko ${m.group_code}` : m.matchday} &middot;{" "}
          {new Date(m.kickoff_at).toLocaleString("fi-FI")}
        </div>
        <div className="text-center text-xs text-muted-foreground mt-1">{m.venue}</div>
        <div className="grid grid-cols-3 items-center gap-4 mt-6">
          <div className="text-center">
            <Flag name={m.home_team} className="w-20 h-auto mx-auto" />
            <div className="mt-2 font-semibold">{m.home_team}</div>
          </div>
          <div className="text-center text-5xl font-bold tabular-nums">
            {finished ? `${m.home_score} – ${m.away_score}` : "vs"}
          </div>
          <div className="text-center">
            <Flag name={m.away_team} className="w-20 h-auto mx-auto" />
            <div className="mt-2 font-semibold">{m.away_team}</div>
          </div>
        </div>
        {finished && m.home_score_ht !== null && (
          <div className="text-center text-xs text-muted-foreground mt-3">
            PA {m.home_score_ht} – {m.away_score_ht}
          </div>
        )}
        {data?.odds && (
          <div className="mt-6 flex justify-center gap-4 text-sm">
            <div className="flex flex-col items-center">
              <span className="text-muted-foreground text-xs uppercase">1</span>
              <span className="font-semibold">{Number(data.odds.odds_1).toFixed(2)}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-muted-foreground text-xs uppercase">X</span>
              <span className="font-semibold">{Number(data.odds.odds_x).toFixed(2)}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-muted-foreground text-xs uppercase">2</span>
              <span className="font-semibold">{Number(data.odds.odds_2).toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/70 p-6">
        <h2 className="font-semibold mb-3">Veikkauksesi</h2>
        {locked ? (
          data?.my ? (
            <p>
              Veikkasit{" "}
              <span className="font-bold text-foreground tabular-nums">{data.my.pick ?? "—"}</span>
              {finished && (
                <span className="text-primary font-semibold ml-2">
                  +{Number(data.my.points).toFixed(2)} p
                </span>
              )}
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">Ei veikkausta (lukittu alkupotkussa).</p>
          )
        ) : (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {data?.my ? (
              <p>
                Veikkauksesi:{" "}
                <span className="font-bold text-foreground tabular-nums">
                  {data.my.pick ?? "—"}
                </span>
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">Et ole veikannut tätä ottelua vielä.</p>
            )}
            <Button asChild>
              <Link to="/veikkaa/$matchId" params={{ matchId }}>
                {data?.my ? "Muokkaa veikkausta" : "Veikkaa nyt"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        )}
      </div>

      {locked && (
        <div className="rounded-2xl border border-border/60 bg-card/70 p-6">
          <h2 className="font-semibold mb-3">Kaikkien veikkaukset</h2>
          {data!.preds.length === 0 ? (
            <p className="text-sm text-muted-foreground">Veikkauksia ei lähetetty.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {data!.preds
                .slice()
                .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
                .map((p) => {
                  const profile = data!.profileMap.get(p.user_id);
                  const correct = finished && actualPick && p.pick === actualPick;
                  return (
                    <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                      <span>{profile?.display_name ?? "Pelaaja"}</span>
                      <span className="tabular-nums">
                        <span className={`font-semibold ${correct ? "text-accent" : ""}`}>
                          {p.pick ?? "—"}
                        </span>
                        {finished && (
                          <span className="ml-3 text-primary font-semibold">
                            +{Number(p.points).toFixed(2)}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
