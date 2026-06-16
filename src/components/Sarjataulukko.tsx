import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getLeaderboard } from "@/lib/predictions.functions";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AvatarView, resolveAvatarUrls } from "@/components/AvatarUpload";
import { Trophy, Medal, Crown } from "lucide-react";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const LINE_COLORS = [
  "#3b82f6", // blue-500
  "#ec4899", // pink-500
  "#22c55e", // green-500
  "#eab308", // yellow-500
  "#8b5cf6", // violet-500
  "#f97316", // orange-500
];

function fiDay(d: Date) {
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

export function Sarjataulukko({ currentUserId }: { currentUserId: string | undefined }) {
  const fetchLeaderboard = useServerFn(getLeaderboard);

  const { data, isLoading } = useQuery({
    queryKey: ["sarjataulukko"],
    queryFn: async () => {
      const [leaderboard, { data: matches }, { data: preds }, { data: oddsData }] =
        await Promise.all([
          fetchLeaderboard(),
          supabase
            .from("matches")
            .select("id, kickoff_at, home_score, away_score")
            .not("home_score", "is", null)
            .order("kickoff_at", { ascending: true }),
          supabase.from("predictions").select("user_id, match_id, points, pick"),
          supabase.from("match_odds").select("match_id, odds_1, odds_x, odds_2"),
        ]);

      const finishedMatches = (matches ?? []).filter(
        (m) => m.home_score !== null && m.away_score !== null,
      );
      // Group days
      const dayKeys: string[] = [];
      const dayLabels: Record<string, string> = {};
      const matchDay = new Map<string, string>();
      for (const m of finishedMatches) {
        const d = new Date(m.kickoff_at);
        const key = d.toISOString().slice(0, 10);
        matchDay.set(m.id, key);
        if (!dayLabels[key]) {
          dayLabels[key] = fiDay(d);
          dayKeys.push(key);
        }
      }

      // Per user, per day points
      const oddsMap = new Map((oddsData ?? []).map((o) => [o.match_id, o]));
      const perDay = new Map<string, Map<string, number>>(); // userId -> day -> points
      for (const p of preds ?? []) {
        const day = matchDay.get(p.match_id);
        if (!day) continue; // unfinished match

        const pts = Number(p.points);
        let matrixYield = 0;
        if (pts > 0) {
          const o = oddsMap.get(p.match_id);
          let oddsVal = 0;
          if (p.pick === "1") oddsVal = Number(o?.odds_1) || 0;
          else if (p.pick === "X") oddsVal = Number(o?.odds_x) || 0;
          else if (p.pick === "2") oddsVal = Number(o?.odds_2) || 0;
          matrixYield = oddsVal * 0.5;
        } else {
          matrixYield = -1.0 * 0.5;
        }

        let u = perDay.get(p.user_id);
        if (!u) {
          u = new Map();
          perDay.set(p.user_id, u);
        }
        u.set(day, (u.get(day) ?? 0) + pts + matrixYield);
      }

      // Resolve avatar URLs
      const urls = await resolveAvatarUrls(leaderboard.map((p) => p.avatar_url));

      // Rank
      const ranked = leaderboard
        .map((p, i) => {
          const displayScore = p.total - (p.matrix_bonus || 0);
          return {
            id: p.id,
            name: p.display_name || p.username || "Pelaaja",
            avatar: urls[i] ?? null,
            total: p.total, // Exact leaderboard total
            displayScore, // Score without matrix bonus
            matrixBonus: p.matrix_bonus || 0,
          };
        })
        .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

      // Build chart series: include starting "0" point + each finished day
      const chartDays = ["start", ...dayKeys];
      const series = chartDays.map((dKey, idx) => {
        const row: Record<string, string | number> = {
          day: dKey === "start" ? "Alku" : dayLabels[dKey],
        };
        for (const player of ranked) {
          if (idx === 0) {
            row[player.id] = 0;
          } else {
            const userMap = perDay.get(player.id);
            row[player.id] = userMap?.get(dKey) ?? 0;
          }
        }
        return row;
      });
      // Convert per-day to cumulative
      for (let i = 1; i < series.length; i++) {
        for (const player of ranked) {
          const prevVal = Number(series[i - 1][player.id] ?? 0);
          series[i][player.id] = prevVal + Number(series[i][player.id] ?? 0);
        }
      }

      return { ranked, series, hasData: finishedMatches.length > 0 };
    },
  });

  if (isLoading || !data) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/70 p-6 h-[400px] animate-pulse" />
    );
  }

  const colorFor = (idx: number) => LINE_COLORS[idx % LINE_COLORS.length];

  return (
    <section className="rounded-3xl border border-border/40 bg-gradient-to-b from-card/95 to-card/50 p-6 space-y-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-accent" />
            Sarjataulukko
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Otteluiden pistekehitys</p>
        </div>
      </div>

      {!data.hasData ? (
        <div className="text-sm text-muted-foreground py-16 flex flex-col items-center justify-center border border-dashed border-border/60 rounded-xl">
          <p>Kuvaaja ilmestyy kun ensimmäinen ottelu on pelattu.</p>
        </div>
      ) : (
        <div className="h-72 w-full -ml-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.series} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <defs>
                {data.ranked.map((p, i) => (
                  <linearGradient key={p.id} id={`color${p.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colorFor(i)} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={colorFor(i)} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#334155"
                opacity={0.6}
                vertical={false}
              />
              <XAxis
                dataKey="day"
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                dy={10}
              />
              <YAxis
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                allowDecimals
                dx={-10}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-card/95 border border-border/50 rounded-xl shadow-xl p-3 backdrop-blur-md min-w-[160px]">
                        <p className="text-xs font-bold text-muted-foreground mb-3 px-1 tracking-wider uppercase border-b border-border/40 pb-2">
                          {label}
                        </p>
                        <div className="space-y-2">
                          {payload
                            .slice()
                            .sort((a, b) => (b.value as number) - (a.value as number))
                            .map((entry: any) => {
                              const p = data.ranked.find((r) => r.id === entry.dataKey);
                              return (
                                <div
                                  key={entry.dataKey}
                                  className="flex items-center justify-between gap-4 text-sm"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <div
                                      className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]"
                                      style={{
                                        background: entry.stroke,
                                        boxShadow: `0 0 10px ${entry.stroke}`,
                                      }}
                                    />
                                    <span className="font-medium text-foreground">{p?.name}</span>
                                  </div>
                                  <span className="font-bold tabular-nums text-foreground">
                                    {(entry.value as number).toFixed(2)}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {data.ranked.map((p, i) => (
                <Area
                  key={p.id}
                  type="monotone"
                  dataKey={p.id}
                  stroke={colorFor(i)}
                  fillOpacity={1}
                  fill={`url(#color${p.id})`}
                  strokeWidth={p.id === currentUserId ? 4 : 3}
                  activeDot={{ r: 6, strokeWidth: 0, fill: colorFor(i) }}
                  isAnimationActive
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 gap-1.5 pt-2">
        <TooltipProvider delayDuration={150}>
          {data.ranked.map((p, i) => (
            <div
              key={p.id}
              className={`group flex items-center gap-4 rounded-xl px-4 py-2.5 transition-all duration-300 ${
                p.id === currentUserId
                  ? "bg-primary/10 border border-primary/20 shadow-sm"
                  : "hover:bg-muted/40 border border-transparent hover:border-border/50"
              }`}
            >
              <span className="w-6 text-center text-sm font-bold tabular-nums">
                {i === 0 ? (
                  <Crown className="w-5 h-5 text-yellow-500 inline drop-shadow-md" />
                ) : i < 3 ? (
                  <Medal
                    className={`w-5 h-5 inline ${i === 1 ? "text-zinc-300" : "text-amber-600"}`}
                  />
                ) : (
                  <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                    {i + 1}
                  </span>
                )}
              </span>
              <span
                className="w-1.5 h-8 rounded-full opacity-80 group-hover:opacity-100 transition-opacity shadow-sm"
                style={{ background: colorFor(i) }}
                aria-hidden
              />
              <AvatarView name={p.name} url={p.avatar} size={36} />
              <Link to="/players/$playerId" params={{ playerId: p.id }} className="flex-1 font-semibold text-foreground truncate hover:underline hover:text-primary transition-colors">
                {p.name}
              </Link>
              <div className="flex flex-col items-end">
                <UITooltip>
                  <TooltipTrigger asChild>
                    <span className="font-bold text-lg tabular-nums leading-none tracking-tight cursor-help border-b border-dashed border-muted-foreground/40 pb-0.5">
                      {p.total.toFixed(2)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="bg-card/95 backdrop-blur-md border border-border/50 shadow-xl"
                  >
                    <div className="font-semibold mb-1.5 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-border/40 pb-1.5">
                      True Score
                    </div>
                    <div className="flex justify-between gap-4 items-center">
                      <span className="text-zinc-300">Ottelut + Futures:</span>
                      <span className="font-bold tabular-nums text-foreground">
                        {p.displayScore.toFixed(2)} p
                      </span>
                    </div>
                    {p.matrixBonus !== 0 && (
                      <div
                        className={`flex justify-between gap-4 items-center mt-1 ${p.matrixBonus > 0 ? "text-emerald-400" : "text-destructive"}`}
                      >
                        <span>Matrix-tuotto:</span>
                        <span className="font-semibold tabular-nums">
                          {p.matrixBonus > 0 ? "+" : ""}
                          {p.matrixBonus.toFixed(2)} p
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between gap-4 items-center mt-1.5 pt-1.5 border-t border-border/40">
                      <span className="font-bold">Yhteensä:</span>
                      <span className="font-bold tabular-nums text-primary text-sm">
                        {p.total.toFixed(2)} p
                      </span>
                    </div>
                  </TooltipContent>
                </UITooltip>
              </div>
            </div>
          ))}
        </TooltipProvider>
        {data.ranked.length === 0 && (
          <div className="text-sm text-muted-foreground py-6 text-center">Ei pelaajia vielä.</div>
        )}
      </div>
    </section>
  );
}
