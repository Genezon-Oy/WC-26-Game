import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { flag } from "@/lib/flags";
import { Trophy, Swords, Shield, Target, Goal, Award } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/statistics")({
  component: StatisticsPage,
});

function StatisticsPage() {
  const playersQuery = useQuery({
    queryKey: ["player-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_stats")
        .select("*")
        .order("goals", { ascending: false })
        .order("assists", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const matchesQuery = useQuery({
    queryKey: ["finished-matches-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("home_team, away_team, home_score, away_score")
        .eq("status", "finished");
      if (error) throw error;
      return data;
    },
  });

  const isLoading = playersQuery.isLoading || matchesQuery.isLoading;

  const getTeamStats = () => {
    if (!matchesQuery.data) return { topScorers: [], mostConceded: [], cleanSheets: [] };
    const stats: Record<string, { scored: number; conceded: number; cleanSheets: number }> = {};
    matchesQuery.data.forEach((m) => {
      if (!stats[m.home_team]) stats[m.home_team] = { scored: 0, conceded: 0, cleanSheets: 0 };
      if (!stats[m.away_team]) stats[m.away_team] = { scored: 0, conceded: 0, cleanSheets: 0 };
      
      stats[m.home_team].scored += m.home_score ?? 0;
      stats[m.home_team].conceded += m.away_score ?? 0;
      if (m.away_score === 0) stats[m.home_team].cleanSheets += 1;

      stats[m.away_team].scored += m.away_score ?? 0;
      stats[m.away_team].conceded += m.home_score ?? 0;
      if (m.home_score === 0) stats[m.away_team].cleanSheets += 1;
    });

    const arr = Object.entries(stats).map(([team, s]) => ({ team, ...s }));
    return {
      topScorers: [...arr].sort((a, b) => b.scored - a.scored).slice(0, 5),
      mostConceded: [...arr].sort((a, b) => b.conceded - a.conceded).slice(0, 5),
      cleanSheets: [...arr].sort((a, b) => b.cleanSheets - a.cleanSheets).slice(0, 5),
    };
  };

  const getMatchStats = () => {
    if (!matchesQuery.data) return { highestScoring: [], biggestBlowouts: [] };
    const matches = matchesQuery.data.map(m => ({
      match: `${m.home_team} ${m.home_score} - ${m.away_score} ${m.away_team}`,
      home_team: m.home_team,
      away_team: m.away_team,
      totalGoals: (m.home_score ?? 0) + (m.away_score ?? 0),
      diff: Math.abs((m.home_score ?? 0) - (m.away_score ?? 0)),
    }));

    return {
      highestScoring: [...matches].sort((a, b) => b.totalGoals - a.totalGoals).slice(0, 5),
      biggestBlowouts: [...matches].sort((a, b) => b.diff - a.diff).slice(0, 5),
    };
  };

  const teamStats = getTeamStats();
  const matchStats = getMatchStats();

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-br from-primary to-primary/60 bg-clip-text text-transparent">
          Tilastot
        </h1>
        <p className="text-muted-foreground text-lg">
          Kuka vie Kultaisen Kengän? Mitkä joukkueet tekevät eniten maaleja? Katso turnauksen kuumimmat tilastot.
        </p>
      </div>

      <Tabs defaultValue="players" className="w-full">
        <TabsList className="w-full sm:w-auto grid grid-cols-3 bg-card/60 backdrop-blur-md border border-border/50 p-1 h-12 rounded-xl">
          <TabsTrigger value="players" className="rounded-lg h-9 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Pelaajat</TabsTrigger>
          <TabsTrigger value="teams" className="rounded-lg h-9 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Joukkueet</TabsTrigger>
          <TabsTrigger value="matches" className="rounded-lg h-9 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Ottelut</TabsTrigger>
        </TabsList>

        <TabsContent value="players" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Maalikuninkaat */}
            <Card className="border-border/50 bg-card/60 backdrop-blur-xl shadow-xl">
              <CardHeader className="pb-3 border-b border-border/50 bg-gradient-to-r from-yellow-500/10 to-transparent">
                <CardTitle className="flex items-center gap-2 text-xl text-yellow-500">
                  <Trophy className="w-5 h-5" /> Kultainen Kenkä
                </CardTitle>
                <CardDescription>Eniten maaleja turnauksessa</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <Skeleton className="h-64 w-full rounded-b-xl" />
                ) : (
                  <ul className="divide-y divide-border/50">
                    {playersQuery.data?.slice(0, 10).map((p, i) => (
                      <li key={p.id} className="flex items-center justify-between p-4 hover:bg-accent/30 transition-colors">
                        <div className="flex items-center gap-4">
                          <span className={`w-6 text-center font-bold ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                            {i + 1}.
                          </span>
                          <span className="text-2xl drop-shadow-sm">{flag(p.team_name)}</span>
                          <div>
                            <p className="font-semibold">{p.player_name}</p>
                            <p className="text-xs text-muted-foreground">{p.team_name}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-lg">{p.goals} <span className="text-xs font-normal text-muted-foreground">maalia</span></span>
                          {p.assists > 0 && <span className="text-xs text-muted-foreground">({p.assists} syöttöä)</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Syöttöpörssi */}
            <Card className="border-border/50 bg-card/60 backdrop-blur-xl shadow-xl">
              <CardHeader className="pb-3 border-b border-border/50 bg-gradient-to-r from-blue-500/10 to-transparent">
                <CardTitle className="flex items-center gap-2 text-xl text-blue-500">
                  <Award className="w-5 h-5" /> Syöttöpörssi
                </CardTitle>
                <CardDescription>Eniten maalisyöttöjä</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <Skeleton className="h-64 w-full rounded-b-xl" />
                ) : (
                  <ul className="divide-y divide-border/50">
                    {[...(playersQuery.data || [])].sort((a, b) => b.assists - a.assists).slice(0, 10).map((p, i) => (
                      <li key={p.id} className="flex items-center justify-between p-4 hover:bg-accent/30 transition-colors">
                        <div className="flex items-center gap-4">
                          <span className="w-6 text-center font-bold text-muted-foreground">{i + 1}.</span>
                          <span className="text-2xl drop-shadow-sm">{flag(p.team_name)}</span>
                          <div>
                            <p className="font-semibold">{p.player_name}</p>
                            <p className="text-xs text-muted-foreground">{p.team_name}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-lg">{p.assists} <span className="text-xs font-normal text-muted-foreground">syöttöä</span></span>
                          {p.goals > 0 && <span className="text-xs text-muted-foreground">({p.goals} maalia)</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="teams" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="border-border/50 bg-card/60 backdrop-blur-md">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-green-500"><Swords className="w-4 h-4" /> Eniten maaleja</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {teamStats.topScorers.map((t, i) => (
                    <li key={t.team} className="flex justify-between items-center">
                      <span className="flex gap-2 items-center"><span className="text-muted-foreground w-4">{i+1}.</span>{flag(t.team)} {t.team}</span>
                      <span className="font-bold">{t.scored}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/60 backdrop-blur-md">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-red-500"><Target className="w-4 h-4" /> Eniten päästettyjä</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {teamStats.mostConceded.map((t, i) => (
                    <li key={t.team} className="flex justify-between items-center">
                      <span className="flex gap-2 items-center"><span className="text-muted-foreground w-4">{i+1}.</span>{flag(t.team)} {t.team}</span>
                      <span className="font-bold">{t.conceded}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/60 backdrop-blur-md">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-blue-500"><Shield className="w-4 h-4" /> Nollapelit</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {teamStats.cleanSheets.filter(t => t.cleanSheets > 0).slice(0, 5).map((t, i) => (
                    <li key={t.team} className="flex justify-between items-center">
                      <span className="flex gap-2 items-center"><span className="text-muted-foreground w-4">{i+1}.</span>{flag(t.team)} {t.team}</span>
                      <span className="font-bold">{t.cleanSheets}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="matches" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-border/50 bg-card/60 backdrop-blur-md">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-orange-500"><Goal className="w-4 h-4" /> Runsasmaalisimmat ottelut</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {matchStats.highestScoring.map((m, i) => (
                    <li key={i} className="flex justify-between items-center p-2 rounded-lg hover:bg-accent/20">
                      <div className="flex items-center gap-2">
                        {flag(m.home_team)} {m.home_team} - {m.away_team} {flag(m.away_team)}
                      </div>
                      <span className="font-bold text-lg px-2 py-1 bg-accent/40 rounded">{m.totalGoals} <span className="text-xs font-normal text-muted-foreground">maalia</span></span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/60 backdrop-blur-md">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-purple-500"><Swords className="w-4 h-4" /> Suurimmat murskavoitot</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {matchStats.biggestBlowouts.map((m, i) => (
                    <li key={i} className="flex justify-between items-center p-2 rounded-lg hover:bg-accent/20">
                      <div className="flex items-center gap-2">
                        {flag(m.home_team)} {m.match} {flag(m.away_team)}
                      </div>
                      <span className="font-bold text-lg px-2 py-1 bg-accent/40 rounded">+{m.diff} <span className="text-xs font-normal text-muted-foreground">ero</span></span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}
