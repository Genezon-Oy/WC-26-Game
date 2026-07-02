import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLeaderboard, getPlayerDetails } from "@/lib/predictions.functions";
import { supabase } from "@/integrations/supabase/client";
import { AvatarView } from "@/components/AvatarUpload";
import { Trophy, Target, TrendingUp, Medal, Star } from "lucide-react";
import { Flag } from "@/components/Flag";
import { flagCode } from "@/lib/flags";
import { MatchCard, type PredictionDisplay } from "@/components/MatchCard";
import { useMemo } from "react";

export const Route = createFileRoute("/_authenticated/players/$playerId")({
  component: PlayerProfilePage,
});

function PlayerProfilePage() {
  const { playerId } = Route.useParams();
  const fetchLeaderboard = useServerFn(getLeaderboard);
  const fetchDetails = useServerFn(getPlayerDetails);

  const { data, isLoading } = useQuery({
    queryKey: ["player-profile", playerId],
    queryFn: async () => {
      const [lb, details, { data: matches }, { data: players }] = await Promise.all([
        fetchLeaderboard(),
        fetchDetails({ data: { target_user_id: playerId } }),
        supabase.from("matches").select("*").order("kickoff_at", { ascending: false }),
        supabase.from("player_stats").select("player_name, team_name"),
      ]);
      const lbUser = lb.find((u) => u.id === playerId);
      const rank = lb.findIndex((u) => u.id === playerId) + 1;
      return { lbUser, rank, details, matches: matches ?? [], players: players ?? [] };
    },
  });

  const predsMap = useMemo(() => {
    const map = new Map<string, PredictionDisplay>();
    if (data?.details?.predictions) {
      for (const p of data.details.predictions) {
        // We cast p.pick because it's string | null
        map.set(p.match_id, { pick: p.pick as "1" | "X" | "2" | null, points: p.points });
      }
    }
    return map;
  }, [data?.details?.predictions]);

  if (isLoading || !data) {
    return <div className="text-muted-foreground animate-pulse">Ladataan pelaajan tietoja…</div>;
  }

  if (!data.details?.profile || !data.lbUser) {
    return <div className="text-destructive font-semibold">Pelaajaa ei löytynyt.</div>;
  }

  const { lbUser, rank, details, matches, players } = data;
  const { profile, futures } = details;
  const displayName = profile.display_name || profile.username;

  // Filter matches where user made a prediction or it's finished
  const userMatches = matches.filter((m) => predsMap.has(m.id));

  // Sort: finished first, then scheduled. But we ordered by kickoff desc, which is good for past matches.
  // Actually, separating into "Upcoming" and "Past" might be nice.
  const now = new Date();
  const pastMatches = userMatches.filter((m) => new Date(m.kickoff_at) <= now);
  // upcoming matches are tricky because user's pick is hidden if not me. But if they have a prediction, we can show that they *made* a prediction.
  const upcomingMatches = userMatches.filter((m) => new Date(m.kickoff_at) > now).reverse(); // reverse so next is first

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Profile Header */}
      <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-card/80 to-card/40 p-6 sm:p-10 flex flex-col sm:flex-row items-center sm:items-start gap-8 shadow-sm">
        <div className="shrink-0 relative">
          <AvatarView name={displayName} url={profile.avatar_url} size={120} />
          {rank === 1 && (
            <div className="absolute -top-3 -right-3 bg-yellow-500 text-yellow-950 p-2 rounded-full shadow-lg">
              <Trophy className="w-6 h-6" />
            </div>
          )}
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{displayName}</h1>
          <p className="text-muted-foreground mt-1 text-lg">@{profile.username}</p>

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-card/60 border border-border/50 p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1 flex items-center justify-center sm:justify-start gap-1.5">
                <Medal className="w-3.5 h-3.5" /> Sijoitus
              </div>
              <div className="text-2xl font-bold tabular-nums">#{rank}</div>
            </div>
            <div className="rounded-2xl bg-card/60 border border-border/50 p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1 flex items-center justify-center sm:justify-start gap-1.5">
                <Trophy className="w-3.5 h-3.5" /> Yhteensä
              </div>
              <div className="text-2xl font-bold tabular-nums text-primary">
                {lbUser.total.toFixed(2)} p
              </div>
            </div>
            <div className="rounded-2xl bg-card/60 border border-border/50 p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1 flex items-center justify-center sm:justify-start gap-1.5">
                <Target className="w-3.5 h-3.5" /> Osumat
              </div>
              <div className="text-2xl font-bold tabular-nums">
                {lbUser.correct} / {lbUser.settled}
              </div>
            </div>
            <div className="rounded-2xl bg-card/60 border border-border/50 p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1 flex items-center justify-center sm:justify-start gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> Matrix
              </div>
              <div
                className={`text-2xl font-bold tabular-nums ${lbUser.matrix_bonus > 0 ? "text-emerald-500" : lbUser.matrix_bonus < 0 ? "text-destructive" : ""}`}
              >
                {lbUser.matrix_bonus > 0 ? "+" : ""}
                {lbUser.matrix_bonus.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Futures */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Star className="text-accent w-5 h-5" /> Ennustukset (Futures)
        </h2>
        {futures ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <FutureCard label="Mestari" value={futures.winner} points={22} players={players} />
            <FutureCard
              label="Maalikuningas"
              value={futures.golden_boot}
              points={16}
              players={players}
            />
            <FutureCard
              label="Syöttökuningas"
              value={futures.most_assists}
              points={13}
              players={players}
            />
            <div className="rounded-2xl border border-border/60 bg-card/50 p-4 flex flex-col justify-center">
              <div className="flex justify-between items-center mb-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  Välierissä
                </div>
                <div className="text-xs text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  +5p / joukkue
                </div>
              </div>
              <ul className="text-sm font-semibold space-y-2 mt-2">
                {futures.semi_finalists?.map((t: string, i: number) => {
                  return (
                    <li key={i} className="flex items-center gap-2">
                      <span className="text-muted-foreground">•</span>{" "}
                      <Flag name={t} className="w-6 h-auto rounded-sm" /> {t || "-"}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-muted-foreground text-sm">
            Ei futures-veikkauksia
          </div>
        )}
      </section>

      {/* Matches */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        {/* Past Matches */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold">Pelatut ottelut ({pastMatches.length})</h2>
          <div className="space-y-3">
            {pastMatches.map((m) => (
              <MatchCard key={m.id} match={m} prediction={predsMap.get(m.id)} />
            ))}
            {pastMatches.length === 0 && (
              <div className="text-sm text-muted-foreground">Ei pelattuja otteluita.</div>
            )}
          </div>
        </section>

        {/* Upcoming Matches */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold">Tulevat ottelut ({upcomingMatches.length})</h2>
          <div className="space-y-3">
            {upcomingMatches.map((m) => (
              <div key={m.id} className="relative">
                <MatchCard match={m} prediction={predsMap.get(m.id)} />
                {predsMap.get(m.id)?.pick === null && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-[2px] rounded-2xl pointer-events-none">
                    <div className="bg-card px-4 py-2 rounded-full border border-border/50 text-sm font-semibold shadow-sm">
                      Veikkaus piilotettu
                    </div>
                  </div>
                )}
              </div>
            ))}
            {upcomingMatches.length === 0 && (
              <div className="text-sm text-muted-foreground">Ei tulevia veikkauksia.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

const KNOWN_PLAYERS: Record<string, string> = {
  "bruno fernandes": "Portugal",
  "kylian mbappe": "France",
  "kylian mbappé": "France",
  "harry kane": "England",
  "jude bellingham": "England",
  "kevin de bruyne": "Belgium",
  "cristiano ronaldo": "Portugal",
  "lionel messi": "Argentina",
  "vinicius junior": "Brazil",
  "vinicius jr": "Brazil",
  neymar: "Brazil",
  "jamal musiala": "Germany",
  "bukayo saka": "England",
  "romelu lukaku": "Belgium",
  "lamine yamal": "Spain",
  "alvaro morata": "Spain",
  "antoine griezmann": "France",
  "cody gakpo": "Netherlands",
  "rafael leao": "Portugal",
  "rafael leão": "Portugal",
  "phil foden": "England",
  "bernardo silva": "Portugal",
};

function FutureCard({
  label,
  value,
  points,
  players,
}: {
  label: string;
  value: string | null;
  points: number;
  players: any[];
}) {
  let teamName = value;

  if (value) {
    // If we can't find a flag code for this string, it might be a player
    if (!flagCode(value)) {
      let found = false;
      const p = players.find(
        (p) =>
          p.player_name.toLowerCase().includes(value.toLowerCase()) ||
          value.toLowerCase().includes(p.player_name.toLowerCase()),
      );
      if (p) {
        teamName = p.team_name;
        found = true;
      }

      // Fallback to hardcoded list if not in DB yet
      if (!found) {
        const valLower = value.toLowerCase().trim();
        for (const [pName, tName] of Object.entries(KNOWN_PLAYERS)) {
          if (valLower.includes(pName) || pName.includes(valLower)) {
            teamName = tName;
            found = true;
            break;
          }
        }
      }

      // Fallback: check if user wrote "Player Name (Country)"
      if (!found) {
        const countryMatch = value.match(/\((.*?)\)/);
        if (countryMatch && flagCode(countryMatch[1])) {
          teamName = countryMatch[1];
        }
      }
    }
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card/50 p-4 flex flex-col justify-center">
      <div className="flex justify-between items-center mb-2">
        <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
          {label}
        </div>
        <div className="text-xs text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
          +{points}p
        </div>
      </div>
      <div className="font-semibold text-lg flex items-center gap-2">
        {value ? (
          <>
            <Flag name={teamName || ""} className="w-7 h-auto rounded-[2px]" />
            <span className="line-clamp-1" title={value}>
              {value}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground/50">-</span>
        )}
      </div>
    </div>
  );
}
