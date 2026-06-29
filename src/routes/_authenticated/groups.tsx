import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Flag } from "@/components/Flag";
import { MatchCard, type MatchCardData, type PredictionDisplay, type PickValue } from "@/components/MatchCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/groups")({
  component: GroupsPage,
});

type Standing = {
  team: string;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
};

type FixtureRow = MatchCardData & { stage: string };

const KNOCKOUT_STAGES = [
  { id: "round-of-32", label: "32 parasta" },
  { id: "round-of-16", label: "16 parasta (Neljännesvälierät)" },
  { id: "quarter-final", label: "Puolivälierät" },
  { id: "semi-final", label: "Välierät" },
  { id: "third-place", label: "Pronssiottelu" },
  { id: "final", label: "Finaali" },
];

function GroupsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["groups-and-knockouts"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;

      const [{ data: teams }, { data: matches }, { data: myPreds }] = await Promise.all([
        supabase.from("teams").select("*").not("group_code", "is", null),
        supabase.from("matches").select("*").order("kickoff_at", { ascending: true }),
        userId 
          ? supabase.from("predictions").select("match_id, pick, points").eq("user_id", userId)
          : Promise.resolve({ data: [] }),
      ]);

      const preds = new Map<string, PredictionDisplay>();
      for (const p of (myPreds ?? []) as Array<{
        match_id: string;
        pick: PickValue | null;
        points: number;
      }>) {
        preds.set(p.match_id, { pick: p.pick, points: p.points });
      }

      const groups = new Map<string, Standing[]>();
      for (const t of teams ?? []) {
        const g = t.group_code as string;
        const list = groups.get(g) ?? [];
        list.push({
          team: t.name,
          p: 0,
          w: 0,
          d: 0,
          l: 0,
          gf: 0,
          ga: 0,
          gd: 0,
          pts: 0,
        });
        groups.set(g, list);
      }

      for (const m of matches ?? []) {
        if (m.stage !== "group") continue;
        if (m.home_score === null || m.away_score === null || !m.group_code) continue;
        
        const list = groups.get(m.group_code);
        if (!list) continue;
        
        const h = list.find((s) => s.team === m.home_team);
        const a = list.find((s) => s.team === m.away_team);
        if (!h || !a) continue;
        
        h.p++;
        a.p++;
        h.gf += m.home_score;
        h.ga += m.away_score;
        a.gf += m.away_score;
        a.ga += m.home_score;
        
        if (m.home_score > m.away_score) {
          h.w++;
          a.l++;
          h.pts += 3;
        } else if (m.home_score < m.away_score) {
          a.w++;
          h.l++;
          a.pts += 3;
        } else {
          h.d++;
          a.d++;
          h.pts++;
          a.pts++;
        }
      }

      for (const list of groups.values()) {
        for (const s of list) s.gd = s.gf - s.ga;
        list.sort(
          (a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team),
        );
      }
      const groupStandings = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));

      const knockouts = (matches ?? []).filter(m => m.stage !== "group") as FixtureRow[];
      const knockoutGroups = new Map<string, FixtureRow[]>();
      for (const m of knockouts) {
        const list = knockoutGroups.get(m.stage) ?? [];
        list.push(m);
        knockoutGroups.set(m.stage, list);
      }

      return { groupStandings, knockoutGroups, preds };
    },
  });

  if (isLoading) return <div className="text-muted-foreground">Ladataan…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lohkot & Pudotuspelit</h1>
        <p className="text-sm text-muted-foreground">
          Sarjataulukot ja pudotuspeliottelut. Sarjataulukot päivittyvät automaattisesti tulosten myötä.
        </p>
      </div>

      {(!data || data.groupStandings.length === 0) && (
        <p className="text-muted-foreground">Ei joukkueita — synkronoi ottelut Ylläpito-sivulta.</p>
      )}

      {data && data.groupStandings.length > 0 && (
        <Tabs defaultValue="groups" className="w-full">
          <TabsList className="mb-6 bg-card/60 border border-border/40 p-1">
            <TabsTrigger value="groups" className="rounded-md">Lohkovaihe</TabsTrigger>
            <TabsTrigger value="knockouts" className="rounded-md">Pudotuspelit</TabsTrigger>
          </TabsList>
          
          <TabsContent value="groups" className="space-y-4 outline-none focus:outline-none">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.groupStandings.map(([code, list]) => (
                <div key={code} className="rounded-xl border border-border/60 bg-card/70 overflow-hidden">
                  <div className="px-4 py-2 bg-primary/10 text-primary text-sm font-semibold">
                    Lohko {code}
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs uppercase text-muted-foreground">
                        <th className="text-left p-2">Joukkue</th>
                        <th className="p-2">O</th>
                        <th className="p-2">V</th>
                        <th className="p-2">T</th>
                        <th className="p-2">H</th>
                        <th className="p-2">ME</th>
                        <th className="p-2">P</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((s, i) => (
                        <tr
                          key={s.team}
                          className={`border-t border-border/40 ${i < 2 ? "bg-primary/5" : ""}`}
                        >
                          <td className="p-2">
                            <Link
                              to="/teams/$team"
                              params={{ team: s.team }}
                              className="flex items-center gap-2 hover:underline"
                            >
                              <Flag name={s.team} className="w-5 h-auto" />
                              <span>{s.team}</span>
                            </Link>
                          </td>
                          <td className="text-center p-2 tabular-nums">{s.p}</td>
                          <td className="text-center p-2 tabular-nums">{s.w}</td>
                          <td className="text-center p-2 tabular-nums">{s.d}</td>
                          <td className="text-center p-2 tabular-nums">{s.l}</td>
                          <td className="text-center p-2 tabular-nums">{s.gd > 0 ? `+${s.gd}` : s.gd}</td>
                          <td className="text-center p-2 font-bold tabular-nums">{s.pts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="knockouts" className="space-y-8 outline-none focus:outline-none">
            {KNOCKOUT_STAGES.map((stage) => {
              const matches = data.knockoutGroups.get(stage.id) ?? [];
              if (matches.length === 0) return null;
              
              return (
                <section key={stage.id}>
                  <h2 className="text-sm uppercase tracking-wider text-muted-foreground font-semibold mb-3">
                    {stage.label}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {matches.map((m) => (
                      <MatchCard key={m.id} match={m} prediction={data.preds.get(m.id)} />
                    ))}
                  </div>
                </section>
              );
            })}
            
            {data.knockoutGroups.size === 0 && (
              <p className="text-muted-foreground">Pudotuspelejä ei ole vielä lisätty.</p>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
