import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AvatarView, resolveAvatarUrls } from "@/components/AvatarUpload";
import { Trophy, Medal } from "lucide-react";

const LINE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(160 70% 55%)",
  "hsl(330 75% 60%)",
  "hsl(40 90% 60%)",
  "hsl(260 75% 65%)",
];

function fiDay(d: Date) {
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

export function Sarjataulukko({ currentUserId }: { currentUserId: string | undefined }) {
  const { data, isLoading } = useQuery({
    queryKey: ["sarjataulukko"],
    queryFn: async () => {
      const [{ data: profiles }, { data: matches }, { data: preds }] = await Promise.all([
        supabase.from("profiles").select("id, display_name, avatar_url"),
        supabase
          .from("matches")
          .select("id, kickoff_at, home_score, away_score")
          .not("home_score", "is", null)
          .order("kickoff_at", { ascending: true }),
        supabase.from("predictions").select("user_id, match_id, points"),
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
      const totals = new Map<string, number>();
      const perDay = new Map<string, Map<string, number>>(); // userId -> day -> points
      for (const p of preds ?? []) {
        const day = matchDay.get(p.match_id);
        if (!day) continue; // unfinished match
        const pts = Number(p.points);
        totals.set(p.user_id, (totals.get(p.user_id) ?? 0) + pts);
        let u = perDay.get(p.user_id);
        if (!u) {
          u = new Map();
          perDay.set(p.user_id, u);
        }
        u.set(day, (u.get(day) ?? 0) + pts);
      }

      // Resolve avatar URLs
      const allProfiles = profiles ?? [];
      const urls = await resolveAvatarUrls(allProfiles.map((p) => p.avatar_url));
      const profileMap = new Map(
        allProfiles.map((p, i) => [
          p.id,
          { ...p, avatarUrl: urls[i] },
        ]),
      );

      // Rank
      const ranked = allProfiles
        .map((p) => ({
          id: p.id,
          name: p.display_name,
          avatar: profileMap.get(p.id)?.avatarUrl ?? null,
          total: totals.get(p.id) ?? 0,
        }))
        .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

      // Build chart series: include starting "0" point + each finished day
      const chartDays = ["start", ...dayKeys];
      const series = chartDays.map((dKey, idx) => {
        const row: Record<string, string | number> = {
          day: dKey === "start" ? "—" : dayLabels[dKey],
        };
        for (const player of ranked) {
          if (idx === 0) {
            row[player.id] = 0;
          } else {
            const userMap = perDay.get(player.id);
            const prev = row; // unused; we'll compute cumulative below
            void prev;
            row[player.id] = (userMap?.get(dKey) ?? 0);
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
      <div className="rounded-2xl border border-border/60 bg-card/70 p-6 h-64 animate-pulse" />
    );
  }

  const colorFor = (idx: number) => LINE_COLORS[idx % LINE_COLORS.length];

  return (
    <section className="rounded-2xl border border-border/60 bg-gradient-to-br from-card/90 to-card/60 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-accent" />
            Sarjataulukko
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pisteiden kehitys päivä kerrallaan
          </p>
        </div>
      </div>

      {!data.hasData ? (
        <div className="text-sm text-muted-foreground py-10 text-center">
          Kuvaaja ilmestyy kun ensimmäinen ottelu on pelattu.
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.series} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis
                dataKey="day"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
              allowDecimals
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number, name: string) => {
                  const player = data.ranked.find((p) => p.id === name);
                return [`${Number(value).toFixed(2)} p`, player?.name ?? name];
                }}
              />
              {data.ranked.map((p, i) => (
                <Line
                  key={p.id}
                  type="monotone"
                  dataKey={p.id}
                  stroke={colorFor(i)}
                  strokeWidth={p.id === currentUserId ? 3 : 2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 gap-1">
        {data.ranked.map((p, i) => (
          <div
            key={p.id}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
              p.id === currentUserId ? "bg-primary/10" : "hover:bg-muted/30"
            }`}
          >
            <span className="w-5 text-center text-xs font-bold tabular-nums text-muted-foreground">
              {i === 0 ? (
                <Trophy className="w-4 h-4 text-accent inline" />
              ) : i < 3 ? (
                <Medal className="w-4 h-4 text-primary inline" />
              ) : (
                i + 1
              )}
            </span>
            <span
              className="w-1.5 h-6 rounded-full"
              style={{ background: colorFor(i) }}
              aria-hidden
            />
            <AvatarView name={p.name} url={p.avatar} size={32} />
            <span className="flex-1 font-medium truncate">{p.name}</span>
            <span className="font-bold tabular-nums">{p.total.toFixed(2)}</span>
          </div>
        ))}
        {data.ranked.length === 0 && (
          <div className="text-sm text-muted-foreground py-4 text-center">
            Ei pelaajia vielä.
          </div>
        )}
      </div>
    </section>
  );
}