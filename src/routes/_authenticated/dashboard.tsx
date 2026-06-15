import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MatchCard, type PredictionDisplay, type PickValue } from "@/components/MatchCard";
import { Flag } from "@/components/Flag";
import { ArrowRight, Trophy } from "lucide-react";
import { Sarjataulukko } from "@/components/Sarjataulukko";
import { AvatarUpload } from "@/components/AvatarUpload";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id;
      const meta = (user.user?.user_metadata ?? {}) as { display_name?: string; username?: string };
      const myName = meta.display_name || meta.username || "Pelaaja";
      const [upcoming, live, myPreds, profiles, myProfile] = await Promise.all([
        supabase
          .from("matches")
          .select("*")
          .gte("kickoff_at", nowIso)
          .order("kickoff_at", { ascending: true })
          .limit(10),
        supabase.from("matches").select("*").eq("status", "live"),
        userId
          ? supabase.from("predictions").select("*").eq("user_id", userId)
          : Promise.resolve({ data: [] as never[] }),
        supabase.from("profiles").select("id, username, display_name"),
        userId
          ? supabase
              .from("profiles")
              .select("avatar_url, display_name")
              .eq("id", userId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const preds = new Map<string, PredictionDisplay>();
      for (const p of (myPreds.data ?? []) as Array<{
        match_id: string;
        pick: PickValue | null;
        points: number;
      }>) {
        preds.set(p.match_id, { pick: p.pick, points: p.points });
      }
      const { data: allPreds } = await supabase.from("predictions").select("user_id, points");
      const totals = new Map<string, number>();
      for (const p of allPreds ?? []) {
        totals.set(p.user_id, (totals.get(p.user_id) ?? 0) + Number(p.points));
      }
      const myRank = userId
        ? (profiles.data ?? [])
            .map((u) => ({ id: u.id, total: totals.get(u.id) ?? 0 }))
            .sort((a, b) => b.total - a.total)
            .findIndex((u) => u.id === userId) + 1 || null
        : null;
      const myTotal = userId ? (totals.get(userId) ?? 0) : 0;
      const upcomingList = upcoming.data ?? [];
      const nextMatch = upcomingList[0] ?? null;
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const todayUnpredicted = upcomingList.filter(
        (m) => new Date(m.kickoff_at) <= todayEnd && !preds.has(m.id),
      );
      return {
        nextMatch,
        todayUnpredicted,
        live: live.data ?? [],
        predictions: preds,
        myTotal,
        myRank,
        userId,
        myName,
        myAvatarPath: (myProfile.data as { avatar_url: string | null } | null)?.avatar_url ?? null,
      };
    },
  });

  if (isLoading || !data) {
    return <div className="text-muted-foreground">Ladataan…</div>;
  }

  const noFixtures = !data.nextMatch && data.live.length === 0;

  return (
    <div className="space-y-6">
      {/* Hero strip */}
      <section className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/15 via-card/70 to-card/70 p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {data.userId && (
            <AvatarUpload
              userId={data.userId}
              name={data.myName}
              avatarPath={data.myAvatarPath}
              size={56}
            />
          )}
          <div>
            <div className="text-sm text-muted-foreground">Tervehdys,</div>
            <div className="text-2xl font-bold">{data.myName} 👋</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Sijasi</div>
          <div className="text-2xl font-bold tabular-nums text-primary">
            {data.myRank ? `#${data.myRank}` : "—"}
            <span className="text-sm text-muted-foreground font-normal">
              {" "}
              · {data.myTotal.toFixed(2)} p
            </span>
          </div>
        </div>
      </section>

      {noFixtures && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-muted-foreground">
            Ei otteluita vielä. Pyydä ylläpitäjää synkronoimaan MM-kisojen ohjelma Ylläpito-sivulta.
          </p>
        </div>
      )}

      {/* Sarjataulukko */}
      <Sarjataulukko currentUserId={data.userId} />
      <div className="text-right">
        <Link to="/leaderboard" className="text-xs text-primary hover:underline">
          Koko tulostaulu →
        </Link>
      </div>

      {/* Live */}
      {data.live.length > 0 && (
        <section>
          <h2 className="text-sm uppercase tracking-wider text-live mb-3 font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-live animate-pulse" /> Käynnissä nyt
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {data.live.map((m) => (
              <MatchCard key={m.id} match={m} prediction={data.predictions.get(m.id)} />
            ))}
          </div>
        </section>
      )}

      {/* Next match hero */}
      {data.nextMatch && (
        <NextMatchHero
          match={data.nextMatch}
          hasPrediction={data.predictions.has(data.nextMatch.id)}
        />
      )}

      {/* Today unpredicted nudge */}
      {data.todayUnpredicted.length > 0 && (
        <section>
          <h2 className="text-sm uppercase tracking-wider text-accent mb-3 font-semibold">
            Veikkaamatta tänään ({data.todayUnpredicted.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.todayUnpredicted.slice(0, 4).map((m) => (
              <MatchCard key={m.id} match={m} prediction={data.predictions.get(m.id)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function NextMatchHero({
  match,
  hasPrediction,
}: {
  match: {
    id: string;
    home_team: string;
    away_team: string;
    kickoff_at: string;
    venue: string | null;
    group_code: string | null;
    matchday: string | null;
  };
  hasPrediction: boolean;
}) {
  const kickoff = new Date(match.kickoff_at);
  return (
    <Link
      to="/veikkaa/$matchId"
      params={{ matchId: match.id }}
      className="block rounded-2xl border border-border/60 bg-gradient-to-br from-card/90 to-card/60 p-6 hover:border-primary/60 transition-colors group"
    >
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground mb-4">
        <span className="text-primary font-semibold flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5" /> Seuraava ottelu
        </span>
        <span>
          {match.group_code ? `Lohko ${match.group_code}` : (match.matchday ?? "Pudotuspelit")}
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="text-center">
          <Flag name={match.home_team} className="w-16 h-auto mx-auto" />
          <div className="mt-2 font-semibold">{match.home_team}</div>
        </div>
        <div className="text-2xl text-muted-foreground font-bold">vs</div>
        <div className="text-center">
          <Flag name={match.away_team} className="w-16 h-auto mx-auto" />
          <div className="mt-2 font-semibold">{match.away_team}</div>
        </div>
      </div>
      <div className="mt-5 text-center text-sm text-muted-foreground">
        {kickoff.toLocaleString("fi-FI", {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
        {match.venue && <> · {match.venue}</>}
      </div>
      <div className="mt-5 flex justify-center">
        <span
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
            hasPrediction
              ? "bg-primary/15 text-primary group-hover:bg-primary/25"
              : "bg-accent text-accent-foreground group-hover:brightness-110"
          }`}
        >
          {hasPrediction ? "Muokkaa veikkausta" : "Veikkaa nyt"}
          <ArrowRight className="w-4 h-4" />
        </span>
      </div>
    </Link>
  );
}
