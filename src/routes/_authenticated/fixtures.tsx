import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  MatchCard,
  type MatchCardData,
  type PredictionDisplay,
  type PickValue,
} from "@/components/MatchCard";

type FixtureRow = MatchCardData & { stage: string };
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/fixtures")({
  component: FixturesPage,
});

function FixturesPage() {
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<string>("all");

  const { data: matches, isLoading } = useQuery({
    queryKey: ["matches", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .order("kickoff_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as FixtureRow[];
    },
  });

  const { data: myPreds } = useQuery({
    queryKey: ["my-predictions"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return new Map<string, PredictionDisplay>();
      const { data } = await supabase
        .from("predictions")
        .select("match_id, pick, points")
        .eq("user_id", u.user.id);
      const map = new Map<string, PredictionDisplay>();
      for (const p of (data ?? []) as Array<{
        match_id: string;
        pick: PickValue | null;
        points: number;
      }>) {
        map.set(p.match_id, { pick: p.pick, points: p.points });
      }
      return map;
    },
  });

  const stages = useMemo(() => {
    const s = new Set<string>();
    for (const m of matches ?? []) s.add(m.stage);
    return ["all", ...Array.from(s)];
  }, [matches]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (matches ?? []).filter((m) => {
      const stageOk = stage === "all" || m.stage === stage;
      const qOk =
        !q ||
        m.home_team.toLowerCase().includes(q) ||
        m.away_team.toLowerCase().includes(q) ||
        (m.venue ?? "").toLowerCase().includes(q) ||
        (m.group_code ?? "").toLowerCase().includes(q);
      return stageOk && qOk;
    });
  }, [matches, search, stage]);

  // group by date
  const grouped = useMemo(() => {
    const byDate = new Map<string, FixtureRow[]>();
    for (const m of filtered) {
      const day = new Date(m.kickoff_at).toLocaleDateString("fi-FI", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      const list = byDate.get(day) ?? [];
      list.push(m);
      byDate.set(day, list);
    }
    return Array.from(byDate.entries());
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Ottelut & tulokset</h1>
        <p className="text-sm text-muted-foreground">
          Jalkapallon MM-kisojen 2026 koko otteluohjelma.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <div className="flex flex-wrap gap-1.5">
          {stages.map((s) => {
            const labels: Record<string, string> = {
              all: "Kaikki vaiheet",
              group: "Lohkovaihe",
              "round-of-32": "32 parasta",
              "round-of-16": "16 parasta",
              "quarter-final": "Puolivälierät",
              "semi-final": "Välierät",
              "third-place": "Pronssiottelu",
              final: "Finaali",
            };
            return (
              <button
                key={s}
                onClick={() => setStage(s)}
                className={`px-3 py-1.5 text-xs rounded-md border ${
                  stage === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {labels[s] ?? s.replace(/-/g, " ")}
              </button>
            );
          })}
        </div>
      </div>
      {isLoading && <p className="text-muted-foreground">Ladataan…</p>}
      {!isLoading && grouped.length === 0 && (
        <p className="text-muted-foreground">
          Suodattimilla ei löytynyt otteluita. (Jos lista on tyhjä, pyydä ylläpitäjää synkronoimaan
          ottelut.)
        </p>
      )}
      {grouped.map(([day, list]) => (
        <section key={day}>
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
            {day}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {list.map((m) => (
              <MatchCard key={m.id} match={m} prediction={myPreds?.get(m.id)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
