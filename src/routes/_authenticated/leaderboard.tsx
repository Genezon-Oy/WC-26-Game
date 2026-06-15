import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLeaderboard } from "@/lib/predictions.functions";
import { Trophy, Medal } from "lucide-react";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="text-primary w-6 h-6" /> Sarjataulukko
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Oikea 1X2-veikkaus = kerroin kerrottuna kierroskertoimella. Oikea kerroin antaa lisäksi
          puolet arvostaan (+50%) Matrix-tuottoa pisteisiisi. Väärä veikkaus rokottaa pisteitä -0.50
          (Matrix-tappio). Vie hiiri yhteispisteiden päälle nähdäksesi erittelyn!
        </p>
      </div>
      <div className="rounded-xl border border-border/60 bg-card/70 overflow-x-auto">
        <TooltipProvider delayDuration={150}>
          <table className="w-full text-sm min-w-[600px]">
            <thead className="text-xs uppercase text-muted-foreground bg-muted/30">
              <tr>
                <th className="text-left p-3 w-12">#</th>
                <th className="text-left p-3">Pelaaja</th>
                <th className="p-3 text-center">Oikein</th>
                <th className="p-3 text-right">Futures</th>
                <th className="p-3 text-right">Yhteensä</th>
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
                  <td className="p-3 text-right font-bold tabular-nums text-lg">
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help border-b border-dashed border-muted-foreground/40 pb-0.5">
                          {row.total.toFixed(2)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="bg-card/95 backdrop-blur-md border border-border/50 shadow-xl"
                      >
                        <div className="font-semibold mb-1.5 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-border/40 pb-1.5">
                          Pistejakauma
                        </div>
                        <div className="flex justify-between gap-4 items-center">
                          <span className="text-zinc-300">Ottelut + Futures:</span>
                          <span className="font-bold tabular-nums text-foreground">
                            {(row.total - row.matrix_bonus).toFixed(2)} p
                          </span>
                        </div>
                        {row.matrix_bonus !== 0 && (
                          <div
                            className={`flex justify-between gap-4 items-center mt-1 ${row.matrix_bonus > 0 ? "text-emerald-400" : "text-destructive"}`}
                          >
                            <span>Matrix-tuotto:</span>
                            <span className="font-semibold tabular-nums">
                              {row.matrix_bonus > 0 ? "+" : ""}
                              {row.matrix_bonus.toFixed(2)} p
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between gap-4 items-center mt-1.5 pt-1.5 border-t border-border/40">
                          <span className="font-bold">Yhteensä:</span>
                          <span className="font-bold tabular-nums text-primary text-sm">
                            {row.total.toFixed(2)} p
                          </span>
                        </div>
                      </TooltipContent>
                    </UITooltip>
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
        </TooltipProvider>
      </div>
    </div>
  );
}
