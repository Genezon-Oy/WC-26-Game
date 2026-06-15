import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  MatchCard,
  type MatchCardData,
  type PredictionDisplay,
  type PickValue,
} from "@/components/MatchCard";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/veikkaa/")({
  component: VeikkaaIndex,
});

function VeikkaaIndex() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["veikkaa-queue"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      const nowIso = new Date().toISOString();
      const [{ data: upcoming }, { data: preds }] = await Promise.all([
        supabase
          .from("matches")
          .select("*")
          .gte("kickoff_at", nowIso)
          .order("kickoff_at", { ascending: true })
          .limit(80),
        userId
          ? supabase.from("predictions").select("match_id, pick, points").eq("user_id", userId)
          : Promise.resolve({ data: [] as never[] }),
      ]);
      const predMap = new Map<string, PredictionDisplay>();
      for (const p of (preds ?? []) as Array<{
        match_id: string;
        pick: PickValue | null;
        points: number;
      }>) {
        predMap.set(p.match_id, { pick: p.pick, points: p.points });
      }
      const upcomingList = (upcoming ?? []) as MatchCardData[];
      const unpredicted = upcomingList.filter((m) => !predMap.has(m.id));
      return { upcomingList, unpredicted, predMap };
    },
  });

  if (isLoading || !data) return <div className="text-muted-foreground">Ladataan…</div>;

  const next = data.unpredicted[0] ?? data.upcomingList[0] ?? null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Veikkaa</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Syötä tulosveikkauksesi jokaiseen otteluun. Veikkaus lukittuu alkupotkussa.
        </p>
      </div>

      <div
        className={`rounded-2xl border p-6 text-center transition-colors ${data.unpredicted.length > 0 ? "border-primary/60 bg-gradient-to-br from-primary/20 via-primary/5 to-card" : "border-border/60 bg-gradient-to-br from-primary/15 via-card/70 to-card/70"}`}
      >
        <div
          className={`text-xs uppercase tracking-wider font-bold ${data.unpredicted.length > 0 ? "text-primary" : "text-muted-foreground"}`}
        >
          {data.unpredicted.length > 0 ? "💡 Vinkki: Veikkauksia tekemättä" : "Veikkaamatta"}
        </div>
        <div className={`text-5xl font-bold tabular-nums mt-2 text-primary`}>
          {data.unpredicted.length}
        </div>
        <div className="text-sm text-muted-foreground mt-1">tulevaa ottelua</div>

        {data.unpredicted.length > 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            Voit rauhassa muokata veikkauksiasi aina kunkin ottelun alkupotkuun saakka.
          </p>
        )}

        {next ? (
          <Button
            size="lg"
            className={`mt-5 ${data.unpredicted.length > 0 ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}`}
            onClick={() => navigate({ to: "/veikkaa/$matchId", params: { matchId: next.id } })}
          >
            {data.unpredicted.length > 0 ? "Tee veikkauksia" : "Selaa veikkauksia"}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Ei tulevia otteluita.</p>
        )}
      </div>

      {data.unpredicted.length > 0 && (
        <section>
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground font-semibold mb-3">
            Veikkaamatta ({data.unpredicted.length})
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {data.unpredicted.slice(0, 20).map((m) => (
              <MatchCard key={m.id} match={m} prediction={data.predMap.get(m.id)} />
            ))}
          </div>
        </section>
      )}

      {data.upcomingList.length > data.unpredicted.length && (
        <section>
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground font-semibold mb-3">
            Veikatut tulevat
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {data.upcomingList
              .filter((m) => data.predMap.has(m.id))
              .slice(0, 20)
              .map((m) => (
                <MatchCard key={m.id} match={m} prediction={data.predMap.get(m.id)} />
              ))}
          </div>
        </section>
      )}

      <div className="text-center">
        <Link to="/fixtures" className="text-sm text-primary hover:underline">
          Kaikki ottelut →
        </Link>
      </div>
    </div>
  );
}
