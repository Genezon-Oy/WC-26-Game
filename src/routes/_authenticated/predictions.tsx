import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MatchCard, type MatchCardData, type PredictionDisplay, type PickValue } from "@/components/MatchCard";

export const Route = createFileRoute("/_authenticated/predictions")({
  component: PredictionsPage,
});

function PredictionsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["predictions-page"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      const nowIso = new Date().toISOString();
      const [{ data: upcoming }, { data: past }, { data: preds }] = await Promise.all([
        supabase
          .from("matches")
          .select("*")
          .gte("kickoff_at", nowIso)
          .order("kickoff_at", { ascending: true })
          .limit(60),
        supabase
          .from("matches")
          .select("*")
          .lt("kickoff_at", nowIso)
          .order("kickoff_at", { ascending: false })
          .limit(40),
        userId
          ? supabase.from("predictions").select("match_id, pick, points").eq("user_id", userId)
          : Promise.resolve({ data: [] as never[] }),
      ]);
      const map = new Map<string, PredictionDisplay>();
      for (const p of (preds ?? []) as Array<{ match_id: string; pick: PickValue | null; points: number }>)
        map.set(p.match_id, { pick: p.pick, points: p.points });
      return {
        upcoming: (upcoming ?? []) as MatchCardData[],
        past: (past ?? []) as MatchCardData[],
        preds: map,
      };
    },
  });

  if (isLoading || !data) return <div className="text-muted-foreground">Ladataan…</div>;

  const pending = data.upcoming.filter((m) => !data.preds.has(m.id));
  const submitted = data.upcoming.filter((m) => data.preds.has(m.id));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Veikkaukset</h1>
        <p className="text-sm text-muted-foreground">
          Napauta ottelua valitaksesi tuloksen. Veikkaukset lukittuvat alkupotkussa.
        </p>
      </div>

      <Section title={`Odottaa veikkaustasi (${pending.length})`} list={pending} preds={data.preds} />
      <Section title={`Lähetetyt (${submitted.length})`} list={submitted} preds={data.preds} />
      <Section title="Tulokset" list={data.past.filter((m) => m.home_score !== null)} preds={data.preds} />
    </div>
  );
}

function Section({
  title,
  list,
  preds,
}: {
  title: string;
  list: MatchCardData[];
  preds: Map<string, PredictionDisplay>;
}) {
  if (list.length === 0) return null;
  return (
    <section>
      <h2 className="text-sm uppercase tracking-wider text-muted-foreground font-semibold mb-3">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {list.map((m) => (
          <MatchCard key={m.id} match={m} prediction={preds.get(m.id)} />
        ))}
      </div>
    </section>
  );
}