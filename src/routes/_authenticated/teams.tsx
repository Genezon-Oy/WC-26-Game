import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Flag } from "@/components/Flag";

export const Route = createFileRoute("/_authenticated/teams")({
  component: TeamsPage,
});

function TeamsPage() {
  const { data: teams, isLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data } = await supabase
        .from("teams")
        .select("*")
        .not("group_code", "is", null)
        .order("group_code", { ascending: true })
        .order("name", { ascending: true });
      return data ?? [];
    },
  });

  if (isLoading) return <div className="text-muted-foreground">Ladataan…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Joukkueet</h1>
        <p className="text-sm text-muted-foreground">Kaikki 48 maajoukkuetta MM-kisoissa 2026.</p>
      </div>
      {teams && teams.length === 0 && (
        <p className="text-muted-foreground">Ei joukkueita — synkronoi ottelut Ylläpito-sivulta.</p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {teams?.map((t) => (
          <Link
            key={t.name}
            to="/teams/$team"
            params={{ team: t.name }}
            className="rounded-xl border border-border/60 bg-card/70 hover:bg-card p-4 flex flex-col items-center text-center transition-colors"
          >
            <Flag name={t.name} className="w-16 h-auto" />
            <div className="mt-2 text-sm font-medium">{t.name}</div>
            {t.group_code && <div className="text-xs text-primary mt-1">Lohko {t.group_code}</div>}
          </Link>
        ))}
      </div>
    </div>
  );
}
