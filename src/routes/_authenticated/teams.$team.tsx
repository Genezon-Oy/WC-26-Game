import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Flag } from "@/components/Flag";
import { MatchCard, type MatchCardData } from "@/components/MatchCard";

export const Route = createFileRoute("/_authenticated/teams/$team")({
  component: TeamPage,
});

function TeamPage() {
  const { team } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["team", team],
    queryFn: async () => {
      const [{ data: t }, { data: matches }] = await Promise.all([
        supabase.from("teams").select("*").eq("name", team).maybeSingle(),
        supabase
          .from("matches")
          .select("*")
          .or(`home_team.eq.${team},away_team.eq.${team}`)
          .order("kickoff_at", { ascending: true }),
      ]);
      return { team: t, matches: (matches ?? []) as MatchCardData[] };
    },
  });

  if (isLoading) return <div className="text-muted-foreground">Ladataan…</div>;
  if (!data?.team)
    return (
      <div>
        <Link to="/teams" className="text-primary hover:underline text-sm">
          ← Kaikki joukkueet
        </Link>
        <p className="mt-4 text-muted-foreground">Joukkuetta ei löytynyt.</p>
      </div>
    );

  return (
    <div className="space-y-6">
      <Link to="/teams" className="text-primary hover:underline text-sm">
        ← Kaikki joukkueet
      </Link>
      <div className="rounded-2xl border border-border/60 bg-card/70 p-8 text-center">
        <Flag name={data.team.name} className="w-28 h-auto mx-auto" />
        <h1 className="text-3xl font-bold mt-3">{data.team.name}</h1>
        {data.team.group_code && (
          <div className="text-sm text-primary mt-1">Lohko {data.team.group_code}</div>
        )}
      </div>
      <h2 className="text-sm uppercase tracking-wider text-muted-foreground font-semibold">
        Ottelut
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data.matches.map((m) => (
          <MatchCard key={m.id} match={m} />
        ))}
      </div>
    </div>
  );
}
