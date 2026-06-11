import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { submitPrediction } from "@/lib/predictions.functions";
import { Flag } from "@/components/Flag";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, PartyPopper } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/veikkaa/$matchId")({
  component: VeikkaaMatch,
});

type Pick = "1" | "X" | "2";

function VeikkaaMatch() {
  const { matchId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const submit = useServerFn(submitPrediction);

  const { data, isLoading } = useQuery({
    queryKey: ["veikkaa-match", matchId],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      const nowIso = new Date().toISOString();
      const [{ data: match }, { data: upcoming }, { data: preds }, { data: odds }] = await Promise.all([
        supabase.from("matches").select("*").eq("id", matchId).single(),
        supabase
          .from("matches")
          .select("id, kickoff_at")
          .gte("kickoff_at", nowIso)
          .order("kickoff_at", { ascending: true })
          .limit(80),
        userId
          ? supabase.from("predictions").select("match_id, pick").eq("user_id", userId)
          : Promise.resolve({ data: [] as never[] }),
        supabase.from("match_odds").select("*").eq("match_id", matchId).maybeSingle(),
      ]);
      const predSet = new Set<string>(((preds ?? []) as Array<{ match_id: string }>).map((p) => p.match_id));
      const my = ((preds ?? []) as Array<{ match_id: string; pick: Pick | null }>).find(
        (p) => p.match_id === matchId,
      );
      return { match, upcoming: upcoming ?? [], predSet, my, odds: odds as { odds_1: number | null; odds_x: number | null; odds_2: number | null; locked: boolean } | null };
    },
  });

  const [pick, setPick] = useState<Pick | null>(null);

  useEffect(() => {
    setPick((data?.my?.pick as Pick | undefined) ?? null);
  }, [matchId, data?.my]);

  const queue = useMemo(() => {
    if (!data) return { total: 0, index: 0 };
    const list = data.upcoming.filter((m) => !data.predSet.has(m.id) || m.id === matchId);
    return { total: list.length, index: list.findIndex((m) => m.id === matchId) };
  }, [data, matchId]);

  const m = data?.match;
  const locked = m ? new Date(m.kickoff_at).getTime() <= Date.now() : false;

  const mut = useMutation({
    mutationFn: async () => {
      if (!pick) throw new Error("Valitse 1, X tai 2");
      await submit({ data: { match_id: matchId, pick } });
    },
    onSuccess: () => {
      toast.success("Veikkaus tallennettu");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["predictions-page"] });
      qc.invalidateQueries({ queryKey: ["veikkaa-queue"] });
      qc.invalidateQueries({ queryKey: ["veikkaa-match"] });
      qc.invalidateQueries({ queryKey: ["my-predictions"] });
      goNext();
    },
    onError: (e: Error) => toast.error(e.message || "Tallennus epäonnistui"),
  });

  function goNext() {
    if (!data) return;
    const nextId = data.upcoming.find((x) => x.id !== matchId && !data.predSet.has(x.id))?.id;
    if (nextId) navigate({ to: "/veikkaa/$matchId", params: { matchId: nextId } });
    else navigate({ to: "/veikkaa" });
  }

  if (isLoading || !m) return <div className="text-muted-foreground">Ladataan…</div>;

  if (locked) {
    return (
      <div className="max-w-xl mx-auto text-center space-y-4 py-10">
        <p className="text-muted-foreground">Tämä ottelu on lukittu — alkupotku on jo mennyt.</p>
        <Link
          to="/fixtures/$matchId"
          params={{ matchId }}
          className="inline-flex items-center gap-2 text-primary hover:underline"
        >
          Avaa ottelusivu <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  const kickoff = new Date(m.kickoff_at);
  if (queue.total === 0) {
    return (
      <div className="max-w-xl mx-auto text-center space-y-4 py-10">
        <PartyPopper className="w-12 h-12 text-accent mx-auto" />
        <h1 className="text-2xl font-bold">Valmis!</h1>
        <p className="text-muted-foreground">Olet veikannut kaikki tulevat ottelut.</p>
        <div className="flex gap-3 justify-center pt-2">
          <Button asChild variant="outline"><Link to="/dashboard">Koti</Link></Button>
          <Button asChild><Link to="/leaderboard">Tulostaulu</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="flex items-center justify-between text-sm">
        <Link to="/veikkaa" className="text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Veikkaa
        </Link>
        {queue.index >= 0 && (
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Ottelu {queue.index + 1} / {queue.total}
          </span>
        )}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/70 p-6">
        <div className="text-center text-xs uppercase tracking-wider text-muted-foreground">
          {m.group_code ? `Lohko ${m.group_code}` : m.matchday ?? "Pudotuspelit"} ·{" "}
          {kickoff.toLocaleString("fi-FI", {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
        {m.venue && <div className="text-center text-xs text-muted-foreground mt-1">{m.venue}</div>}

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mt-6">
          <div className="text-center">
            <Flag name={m.home_team} className="w-20 h-auto mx-auto" />
            <div className="mt-2 text-sm font-semibold line-clamp-1">{m.home_team}</div>
          </div>
          <div className="text-xl text-muted-foreground font-bold">vs</div>
          <div className="text-center">
            <Flag name={m.away_team} className="w-20 h-auto mx-auto" />
            <div className="mt-2 text-sm font-semibold line-clamp-1">{m.away_team}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <PickButton
          symbol="1"
          label={m.home_team}
          sub={data?.odds?.odds_1 ? `${Number(data.odds.odds_1).toFixed(2)}` : "Kotivoitto"}
          active={pick === "1"}
          onClick={() => setPick("1")}
        />
        <PickButton
          symbol="X"
          label="Tasapeli"
          sub={data?.odds?.odds_x ? `${Number(data.odds.odds_x).toFixed(2)}` : "X"}
          active={pick === "X"}
          onClick={() => setPick("X")}
        />
        <PickButton
          symbol="2"
          label={m.away_team}
          sub={data?.odds?.odds_2 ? `${Number(data.odds.odds_2).toFixed(2)}` : "Vierasvoitto"}
          active={pick === "2"}
          onClick={() => setPick("2")}
        />
      </div>

      <div className="text-xs text-center text-muted-foreground">
        {data?.odds
          ? data.odds.locked
            ? "Kertoimet on lukittu — oikea veikkaus = kerroin pisteinä."
            : "Kertoimet päivittyvät ja lukittuvat alkupotkussa."
          : "Kertoimia ei vielä saatavilla."}
      </div>

      <div className="space-y-2">
        <Button
          size="lg"
          className="w-full"
          disabled={mut.isPending || !pick}
          onClick={() => mut.mutate()}
        >
          {mut.isPending ? "Tallennetaan…" : data?.my ? "Päivitä ja seuraava" : "Tallenna ja seuraava"}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
        <Button variant="ghost" className="w-full" onClick={goNext} disabled={mut.isPending}>
          Ohita
        </Button>
      </div>
    </div>
  );
}

function PickButton({
  symbol,
  label,
  sub,
  active,
  onClick,
}: {
  symbol: string;
  label: string;
  sub: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-center transition-colors ${
        active
          ? "border-primary bg-primary/15 text-primary"
          : "border-border/60 bg-card/50 text-foreground hover:border-foreground/40"
      }`}
    >
      <div className="text-3xl font-bold tabular-nums">{symbol}</div>
      <div className="mt-1 text-xs font-semibold line-clamp-1">{label}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </button>
  );
}