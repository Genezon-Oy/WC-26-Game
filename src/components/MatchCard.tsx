import { Flag } from "@/components/Flag";
import { Link } from "@tanstack/react-router";

export type PickValue = "1" | "X" | "2";
export interface PredictionDisplay {
  pick: PickValue | null;
  points?: number;
}

export interface MatchCardData {
  id: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  kickoff_at: string;
  venue: string | null;
  status: string;
  group_code: string | null;
  matchday: string | null;
}

export function MatchCard({
  match,
  prediction,
}: {
  match: MatchCardData;
  prediction?: PredictionDisplay | null;
}) {
  const kickoff = new Date(match.kickoff_at);
  const isLive = match.status === "live";
  const isFinished = match.status === "finished" || match.home_score !== null;
  const locked = kickoff.getTime() <= Date.now();
  return (
    <Link
      to={!locked && !prediction?.pick ? "/veikkaa/$matchId" : "/fixtures/$matchId"}
      params={{ matchId: match.id }}
      className="block group"
    >
      <div className="rounded-xl border border-border/60 bg-card/70 hover:bg-card transition-colors p-4 shadow-sm">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground mb-3">
          <span>
            {match.group_code ? `Lohko ${match.group_code}` : match.matchday ?? "Pudotuspelit"}
          </span>
          {isLive && (
            <span className="flex items-center gap-1 text-live font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse" /> KÄYNNISSÄ
            </span>
          )}
          {!isLive && isFinished && <span className="text-primary">PP</span>}
          {!isLive && !isFinished && (
            <span>
              {kickoff.toLocaleDateString("fi-FI", { weekday: "short", month: "short", day: "numeric" })}
              &nbsp;
              {kickoff.toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="text-right">
            <Flag name={match.home_team} className="w-8 h-auto" />
            <div className="mt-1 text-sm font-medium text-foreground line-clamp-1">{match.home_team}</div>
          </div>
          <div className="text-center">
            {isFinished ? (
              <div className="text-3xl font-bold tabular-nums text-foreground">
                {match.home_score}<span className="text-muted-foreground mx-1">–</span>{match.away_score}
              </div>
            ) : (
              <div className="text-sm font-semibold text-muted-foreground">vs</div>
            )}
          </div>
          <div className="text-left">
            <Flag name={match.away_team} className="w-8 h-auto" />
            <div className="mt-1 text-sm font-medium text-foreground line-clamp-1">{match.away_team}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span className="truncate">{match.venue ?? ""}</span>
          {prediction?.pick ? (
            <span className="flex items-center gap-2">
              <span>
                Veikkaus: <span className="font-medium text-foreground tabular-nums">{prediction.pick}</span>
              </span>
              {isFinished && typeof prediction.points === "number" && (
                <span
                  className={`px-1.5 py-0.5 rounded font-semibold ${
                    prediction.points > 0
                      ? "bg-accent/20 text-accent"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  +{Number(prediction.points).toFixed(2)}
                </span>
              )}
            </span>
          ) : (
            !locked && <span className="text-primary group-hover:underline">Veikkaa →</span>
          )}
        </div>
      </div>
    </Link>
  );
}