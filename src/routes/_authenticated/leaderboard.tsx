import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLeaderboard } from "@/lib/predictions.functions";
import { Trophy, Medal } from "lucide-react";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tulostaulu</h1>
        <p className="text-sm text-muted-foreground">
          Oikea 1X2-veikkaus = kerroin pisteinä (esim. 3.40 → 3.40 p)
        </p>
      </div>
      <div className="rounded-xl border border-border/60 bg-card/70 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground bg-muted/30">
            <tr>
              <th className="text-left p-3 w-12">#</th>
              <th className="text-left p-3">Pelaaja</th>
              <th className="p-3 text-center">Oikein</th>
              <th className="p-3 text-center">Ratkaistu</th>
              <th className="p-3 text-right">Pisteet</th>
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
                <td className="p-3 text-center tabular-nums">{row.correct}</td>
                <td className="p-3 text-center tabular-nums text-muted-foreground">
                  {row.settled}
                </td>
                <td className="p-3 text-right font-bold tabular-nums text-lg">
                  {row.total.toFixed(2)}
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
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
