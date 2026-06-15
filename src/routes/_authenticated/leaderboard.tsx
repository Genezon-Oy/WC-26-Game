import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLeaderboard } from "@/lib/predictions.functions";
import { Trophy, Medal, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const fetchLb = useServerFn(getLeaderboard);
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => fetchLb(),
  });

  if (isLoading || !data) return <div className="text-muted-foreground">Ladataan…</div>;

  const matrixData = [...data].sort((a, b) => b.matrix_score - a.matrix_score);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="text-primary w-6 h-6" /> Safe Score
        </h1>
        <p className="text-sm text-muted-foreground">
          Oikea 1X2-veikkaus = kerroin pisteinä kerrottuna kierroksen kertoimella. Ennustuskohteet +
          Matrix Bonus lisätään loppupisteisiin.
        </p>
      </div>
      <div className="rounded-xl border border-border/60 bg-card/70 overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="text-xs uppercase text-muted-foreground bg-muted/30">
            <tr>
              <th className="text-left p-3 w-12">#</th>
              <th className="text-left p-3">Pelaaja</th>
              <th className="p-3 text-center">Oikein</th>
              <th className="p-3 text-right">Futures</th>
              <th className="p-3 text-right">Matrix Bonus</th>
              <th className="p-3 text-right">Yhteensä (Safe)</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={row.id} className="border-t border-border/40">
                <td className="p-3">
                  {i === 0 ? (
                    <Trophy className="w-4 h-4 text-accent" />
                  ) : i < 3 ? (
                    <Medal className="w-4 h-4 text-primary" />
                  ) : (
                    <span className="text-muted-foreground">{i + 1}</span>
                  )}
                </td>
                <td className="p-3 font-medium">{row.display_name}</td>
                <td className="p-3 text-center tabular-nums">
                  {row.correct} / {row.settled}
                </td>
                <td className="p-3 text-right tabular-nums text-muted-foreground">
                  +{row.futures_score}
                </td>
                <td className="p-3 text-right tabular-nums text-accent">+{row.matrix_bonus}</td>
                <td className="p-3 text-right font-bold tabular-nums text-lg">
                  {row.total.toFixed(2)}
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  Ei pelaajia vielä.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pt-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="text-accent w-6 h-6" /> Money Making Matrix
        </h1>
        <p className="text-sm text-muted-foreground">
          Oikea 1X2-veikkaus = kerroin. Väärä = -1.0. Turnauksen lopussa Top 3 saa bonuksia Safe
          Scoreen (+28, +15, +7).
        </p>
      </div>
      <div className="rounded-xl border border-border/60 bg-card/70 overflow-x-auto">
        <table className="w-full text-sm min-w-[400px]">
          <thead className="text-xs uppercase text-muted-foreground bg-muted/30">
            <tr>
              <th className="text-left p-3 w-12">#</th>
              <th className="text-left p-3">Pelaaja</th>
              <th className="p-3 text-center">Oikein</th>
              <th className="p-3 text-right">Matrix Score</th>
            </tr>
          </thead>
          <tbody>
            {matrixData.map((row, i) => (
              <tr key={row.id} className="border-t border-border/40">
                <td className="p-3">
                  {i === 0 ? (
                    <Trophy className="w-4 h-4 text-accent" />
                  ) : i < 3 ? (
                    <Medal className="w-4 h-4 text-primary" />
                  ) : (
                    <span className="text-muted-foreground">{i + 1}</span>
                  )}
                </td>
                <td className="p-3 font-medium">{row.display_name}</td>
                <td className="p-3 text-center tabular-nums">
                  {row.correct} / {row.settled}
                </td>
                <td
                  className={`p-3 text-right font-bold tabular-nums text-lg ${row.matrix_score < 0 ? "text-red-400" : "text-green-400"}`}
                >
                  {row.matrix_score > 0 ? "+" : ""}
                  {row.matrix_score.toFixed(2)}
                </td>
              </tr>
            ))}
            {matrixData.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-muted-foreground">
                  Ei pelaajia vielä.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
