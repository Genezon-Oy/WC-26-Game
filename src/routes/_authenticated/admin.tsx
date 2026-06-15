import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  adminCreateUser,
  adminDeleteUser,
  adminListUsers,
  adminResetPassword,
  adminSyncFixtures,
  adminSetResult,
  adminPollLive,
  adminGetResults,
  adminSetResults,
  adminSetHistoricalBet,
} from "@/lib/admin.functions";
import { adminRefreshOdds, adminLockKickoffOdds, adminSetManualOdds } from "@/lib/odds.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { flag } from "@/lib/flags";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const qc = useQueryClient();
  const sync = useServerFn(adminSyncFixtures);
  const list = useServerFn(adminListUsers);
  const create = useServerFn(adminCreateUser);
  const delUser = useServerFn(adminDeleteUser);
  const reset = useServerFn(adminResetPassword);
  const setResult = useServerFn(adminSetResult);
  const poll = useServerFn(adminPollLive);
  const refreshOdds = useServerFn(adminRefreshOdds);
  const lockOdds = useServerFn(adminLockKickoffOdds);

  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => list() });

  const syncMut = useMutation({
    mutationFn: () => sync(),
    onSuccess: (r) => {
      toast.success(`Synkronoitu ${r.teams} joukkuetta, ${r.matches} ottelua`);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pollMut = useMutation({
    mutationFn: () => poll(),
    onSuccess: (r) =>
      r.ok
        ? toast.success(`Päivitetty ${r.updated} live-ottelua`)
        : toast.error(r.error ?? "Live-haku ei käytettävissä"),
    onError: (e: Error) => toast.error(e.message),
  });

  const oddsMut = useMutation({
    mutationFn: () => refreshOdds(),
    onSuccess: (r) => {
      toast.success(`Kertoimet päivitetty: ${r.updated} onnistui, ${r.failed} epäonnistui`);
      if (r.errors?.length) {
        console.warn("Odds errors:", r.errors);
        toast.error(r.errors[0], { duration: 10000 });
      }
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lockMut = useMutation({
    mutationFn: () => lockOdds(),
    onSuccess: (r) => {
      toast.success(`Lukittu ${r.locked} ottelun kertoimet`);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [u, setU] = useState({ username: "", password: "", display_name: "", is_admin: false });
  const createMut = useMutation({
    mutationFn: () => create({ data: u }),
    onSuccess: () => {
      toast.success("Pelaaja lisätty");
      setU({ username: "", password: "", display_name: "", is_admin: false });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setManualOdds = useServerFn(adminSetManualOdds);
  const [manual, setManual] = useState({ match_id: "", odds_1: "", odds_x: "", odds_2: "" });

  const matchesQuery = useQuery({
    queryKey: ["admin-matches-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("id, home_team, away_team, kickoff_at")
        .order("kickoff_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const manualMut = useMutation({
    mutationFn: () =>
      setManualOdds({
        data: {
          match_id: manual.match_id,
          odds_1: parseFloat(manual.odds_1),
          odds_x: parseFloat(manual.odds_x),
          odds_2: parseFloat(manual.odds_2),
        },
      }),
    onSuccess: () => {
      toast.success("Kertoimet tallennettu ja lukittu");
      setManual({ match_id: "", odds_1: "", odds_x: "", odds_2: "" });
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const getResults = useServerFn(adminGetResults);
  const setResults = useServerFn(adminSetResults);

  const [resForm, setResForm] = useState({
    winner: "",
    golden_boot: "",
    most_assists: "",
    semi1: "",
    semi2: "",
    semi3: "",
    semi4: "",
  });

  const resultsQuery = useQuery({
    queryKey: ["admin-tournament-results"],
    queryFn: async () => {
      const data = await getResults();
      if (data) {
        setResForm({
          winner: data.winner ?? "",
          golden_boot: data.golden_boot ?? "",
          most_assists: data.most_assists ?? "",
          semi1: data.semi_finalists?.[0] ?? "",
          semi2: data.semi_finalists?.[1] ?? "",
          semi3: data.semi_finalists?.[2] ?? "",
          semi4: data.semi_finalists?.[3] ?? "",
        });
      }
      return data;
    },
  });

  const resultsMut = useMutation({
    mutationFn: async () => {
      const semis = [resForm.semi1, resForm.semi2, resForm.semi3, resForm.semi4].filter(Boolean);
      await setResults({
        data: {
          winner: resForm.winner || undefined,
          golden_boot: resForm.golden_boot || undefined,
          most_assists: resForm.most_assists || undefined,
          semi_finalists: semis.length > 0 ? semis : undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Turnaustulokset tallennettu!");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Ylläpito</h1>
        <p className="text-sm text-muted-foreground">
          Hallinnoi otteluita, tuloksia ja pelaajatunnuksia.
        </p>
      </div>

      <section className="rounded-2xl border border-border/60 bg-card/70 p-6 space-y-3">
        <h2 className="font-semibold">Datan synkronointi</h2>
        <p className="text-sm text-muted-foreground">
          Hakee otteluohjelman ja lopputulokset openfootball/worldcup.json:sta sekä live-tilanteet
          football-data.org:sta (jos API-avain on määritetty).
        </p>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>
            {syncMut.isPending ? "Synkronoidaan…" : "Synkronoi ottelut (openfootball)"}
          </Button>
          <Button variant="secondary" onClick={() => pollMut.mutate()} disabled={pollMut.isPending}>
            {pollMut.isPending ? "Haetaan…" : "Päivitä live-tulokset"}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card/70 p-6 space-y-3">
        <h2 className="font-semibold">Kertoimet (The Odds API)</h2>
        <p className="text-sm text-muted-foreground">
          Hakee 1X2-kertoimet The Odds API:sta. Kertoimet lukittuvat automaattisesti, kun otteluun
          on ≤30 min. Lukitut kertoimet määräävät pelaajien pisteet (oikea veikkaus = kerroin).
        </p>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => oddsMut.mutate()} disabled={oddsMut.isPending}>
            {oddsMut.isPending ? "Päivitetään…" : "Päivitä kertoimet (seuraavat 14 pv)"}
          </Button>
          <Button variant="secondary" onClick={() => lockMut.mutate()} disabled={lockMut.isPending}>
            {lockMut.isPending ? "Lukitaan…" : "Lukitse kohta alkavien kertoimet"}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card/70 p-6 space-y-4">
        <h2 className="font-semibold">Syötä / korjaa kertoimet manuaalisesti</h2>
        <p className="text-sm text-muted-foreground">
          Aseta ottelun 1X2-kertoimet käsin. Nämä kertoimet lukitaan välittömästi, jolloin API ei
          enää ylikirjoita niitä. Tämä on hyödyllistä menneille otteluille, joista puuttuu
          kertoimet, tai jos haluat korjata virheelliset kertoimet.
        </p>
        <div className="flex flex-col gap-3">
          <select
            className="flex h-10 w-full md:w-96 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={manual.match_id}
            onChange={(e) => setManual({ ...manual, match_id: e.target.value })}
          >
            <option value="">-- Valitse ottelu --</option>
            {matchesQuery.data?.map((m) => {
              const dt = new Date(m.kickoff_at).toLocaleString("fi-FI", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <option key={m.id} value={m.id}>
                  {dt} - {m.home_team} vs {m.away_team}
                </option>
              );
            })}
          </select>
          <div className="flex gap-2">
            <Input
              className="w-24"
              type="number"
              step="0.01"
              min="1.0"
              placeholder="1 (Koti)"
              value={manual.odds_1}
              onChange={(e) => setManual({ ...manual, odds_1: e.target.value })}
            />
            <Input
              className="w-24"
              type="number"
              step="0.01"
              min="1.0"
              placeholder="X (Tasapeli)"
              value={manual.odds_x}
              onChange={(e) => setManual({ ...manual, odds_x: e.target.value })}
            />
            <Input
              className="w-24"
              type="number"
              step="0.01"
              min="1.0"
              placeholder="2 (Vieras)"
              value={manual.odds_2}
              onChange={(e) => setManual({ ...manual, odds_2: e.target.value })}
            />
          </div>
          <Button
            className="w-fit"
            onClick={() => manualMut.mutate()}
            disabled={
              manualMut.isPending ||
              !manual.match_id ||
              !manual.odds_1 ||
              !manual.odds_x ||
              !manual.odds_2
            }
          >
            {manualMut.isPending ? "Tallennetaan…" : "Tallenna ja lukitse kertoimet"}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card/70 p-6 space-y-4">
        <h2 className="font-semibold">Settle: Turnauksen lopputulokset</h2>
        <p className="text-sm text-muted-foreground">
          Aseta turnauksen lopputulokset, jotta pelaajien Futures-ennustuksista (Pre-Tournament
          Picks) voidaan laskea lisäpisteet.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Maailmanmestari</Label>
            <Input
              value={resForm.winner}
              onChange={(e) => setResForm({ ...resForm, winner: e.target.value })}
              placeholder="Esim. Brazil"
            />
          </div>
          <div className="space-y-1">
            <Label>Maalikuningas (Golden Boot)</Label>
            <Input
              value={resForm.golden_boot}
              onChange={(e) => setResForm({ ...resForm, golden_boot: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Eniten syöttöjä</Label>
            <Input
              value={resForm.most_assists}
              onChange={(e) => setResForm({ ...resForm, most_assists: e.target.value })}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Välieräjoukkueet (4 kpl)</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Input
                value={resForm.semi1}
                onChange={(e) => setResForm({ ...resForm, semi1: e.target.value })}
                placeholder="Joukkue 1"
              />
              <Input
                value={resForm.semi2}
                onChange={(e) => setResForm({ ...resForm, semi2: e.target.value })}
                placeholder="Joukkue 2"
              />
              <Input
                value={resForm.semi3}
                onChange={(e) => setResForm({ ...resForm, semi3: e.target.value })}
                placeholder="Joukkue 3"
              />
              <Input
                value={resForm.semi4}
                onChange={(e) => setResForm({ ...resForm, semi4: e.target.value })}
                placeholder="Joukkue 4"
              />
            </div>
          </div>
        </div>
        <Button onClick={() => resultsMut.mutate()} disabled={resultsMut.isPending}>
          {resultsMut.isPending ? "Tallennetaan..." : "Tallenna tulokset"}
        </Button>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card/70 p-6 space-y-4">
        <h2 className="font-semibold">Lisää pelaaja</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Käyttäjänimi</Label>
            <Input value={u.username} onChange={(e) => setU({ ...u, username: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Salasana</Label>
            <Input
              type="text"
              value={u.password}
              onChange={(e) => setU({ ...u, password: e.target.value })}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Näyttönimi (valinnainen)</Label>
            <Input
              value={u.display_name}
              onChange={(e) => setU({ ...u, display_name: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={u.is_admin}
              onCheckedChange={(c) => setU({ ...u, is_admin: c === true })}
            />
            Ylläpitäjä
          </label>
        </div>
        <Button
          onClick={() => createMut.mutate()}
          disabled={createMut.isPending || !u.username || u.password.length < 6}
        >
          {createMut.isPending ? "Lisätään…" : "Lisää pelaaja"}
        </Button>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card/70 p-6 space-y-3">
        <h2 className="font-semibold">Pelaajat</h2>
        {users.isLoading && <p className="text-muted-foreground text-sm">Ladataan…</p>}
        <ul className="divide-y divide-border/60">
          {users.data?.map((p) => (
            <UserRow
              key={p.id}
              player={p}
              reset={reset}
              del={async (args) => {
                await delUser(args);
                qc.invalidateQueries();
              }}
            />
          ))}
        </ul>
      </section>

      <ResultEntry setResult={setResult} qc={qc} />
      <HistoricalBetEntry
        setHistoricalBet={useServerFn(adminSetHistoricalBet)}
        qc={qc}
        users={users.data}
      />
    </div>
  );
}

function UserRow({
  player,
  reset,
  del,
}: {
  player: { id: string; username: string; display_name: string; roles: string[] };
  reset: (args: { data: { user_id: string; password: string } }) => Promise<unknown>;
  del: (args: { data: { user_id: string } }) => Promise<unknown>;
}) {
  const [pw, setPw] = useState("");
  const mut = useMutation({
    mutationFn: () => reset({ data: { user_id: player.id, password: pw } }),
    onSuccess: () => {
      toast.success(`Salasana vaihdettu käyttäjälle ${player.username}`);
      setPw("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: () => del({ data: { user_id: player.id } }),
    onSuccess: () => toast.success(`Pelaaja ${player.username} poistettu`),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <li className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1">
        <div className="font-medium">
          {player.display_name}{" "}
          <span className="text-muted-foreground text-xs">@{player.username}</span>
          {player.roles.includes("admin") && (
            <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent">
              ylläpitäjä
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className="w-32 sm:w-44"
          placeholder="Uusi salasana"
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={() => mut.mutate()}
          disabled={mut.isPending || pw.length < 6}
        >
          Vaihda
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="destructive" disabled={delMut.isPending}>
              {delMut.isPending ? "Poistetaan..." : "Poista"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Haluatko varmasti poistaa pelaajan?</AlertDialogTitle>
              <AlertDialogDescription>
                Tämä toiminto on lopullinen. Pelaajan <strong>{player.username}</strong> kaikki
                veikkaukset, pisteet ja käyttäjätili poistetaan pysyvästi. Tätä ei voi perua.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Peruuta</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => delMut.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Kyllä, poista pelaaja
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  );
}

function ResultEntry({
  setResult,
  qc,
}: {
  setResult: (args: {
    data: { match_id: string; home_score: number; away_score: number };
  }) => Promise<unknown>;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const matches = useQuery({
    queryKey: ["admin-matches"],
    queryFn: async () => {
      const { data } = await supabase
        .from("matches")
        .select("*")
        .order("kickoff_at", { ascending: true })
        .limit(200);
      return data ?? [];
    },
  });

  const [matchId, setMatchId] = useState("");
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      setResult({
        data: {
          match_id: matchId,
          home_score: parseInt(home, 10),
          away_score: parseInt(away, 10),
        },
      }),
    onSuccess: () => {
      toast.success("Tulos tallennettu ja pisteet laskettu");
      setMatchId("");
      setHome("");
      setAway("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-2xl border border-border/60 bg-card/70 p-6 space-y-3">
      <h2 className="font-semibold">Syötä / korvaa ottelutulos</h2>
      <p className="text-xs text-muted-foreground">
        Tuloksen tallennus laskee kaikkien veikkaukset automaattisesti uudelleen.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
        <div className="space-y-1">
          <Label>Ottelu</Label>
          <select
            value={matchId}
            onChange={(e) => setMatchId(e.target.value)}
            className="w-full bg-input border border-border rounded-md px-2 py-2 text-sm"
          >
            <option value="">— valitse ottelu —</option>
            {matches.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {new Date(m.kickoff_at).toLocaleDateString("fi-FI")} {flag(m.home_team)}{" "}
                {m.home_team} – {m.away_team} {flag(m.away_team)}{" "}
                {m.home_score !== null ? `(${m.home_score}-${m.away_score})` : ""}
              </option>
            ))}
          </select>
        </div>
        <Input
          type="number"
          min={0}
          max={20}
          value={home}
          onChange={(e) => setHome(e.target.value)}
          className="w-20"
        />
        <Input
          type="number"
          min={0}
          max={20}
          value={away}
          onChange={(e) => setAway(e.target.value)}
          className="w-20"
        />
        <Button
          onClick={() => mut.mutate()}
          disabled={!matchId || home === "" || away === "" || mut.isPending}
        >
          Tallenna
        </Button>
      </div>
    </section>
  );
}

function HistoricalBetEntry({
  setHistoricalBet,
  qc,
  users,
}: {
  setHistoricalBet: (args: {
    data: { user_id: string; match_id: string; pick: "1" | "X" | "2" };
  }) => Promise<unknown>;
  qc: ReturnType<typeof useQueryClient>;
  users?: { id: string; username: string; display_name: string }[];
}) {
  const matches = useQuery({
    queryKey: ["admin-matches"],
    queryFn: async () => {
      const { data } = await supabase
        .from("matches")
        .select("*")
        .order("kickoff_at", { ascending: true })
        .limit(200);
      return data ?? [];
    },
  });

  const [userId, setUserId] = useState("");
  const [matchId, setMatchId] = useState("");
  const [pick, setPick] = useState<"1" | "X" | "2" | "">("");

  const mut = useMutation({
    mutationFn: () =>
      setHistoricalBet({
        data: {
          user_id: userId,
          match_id: matchId,
          pick: pick as "1" | "X" | "2",
        },
      }),
    onSuccess: () => {
      toast.success("Menneisyyden veikkaus tallennettu ja pisteet laskettu!");
      setMatchId("");
      setPick("");
      // Keep user selected for rapid data entry
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-2xl border border-border/60 bg-card/70 p-6 space-y-3">
      <h2 className="font-semibold">Syötä menneisyyden veikkaus pelaajalle</h2>
      <p className="text-xs text-muted-foreground">
        Tällä työkalulla voit lisätä tai ylikirjoittaa minkä tahansa pelaajan veikkauksen, vaikka
        ottelu olisi jo alkanut tai päättynyt. Jos ottelu on jo päättynyt, pisteet lasketaan
        automaattisesti välittömästi.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
        <div className="space-y-1">
          <Label>Pelaaja</Label>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-full bg-input border border-border rounded-md px-2 py-2 text-sm"
          >
            <option value="">— valitse pelaaja —</option>
            {users?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.display_name} (@{u.username})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Ottelu</Label>
          <select
            value={matchId}
            onChange={(e) => setMatchId(e.target.value)}
            className="w-full bg-input border border-border rounded-md px-2 py-2 text-sm"
          >
            <option value="">— valitse ottelu —</option>
            {matches.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {new Date(m.kickoff_at).toLocaleDateString("fi-FI")} {flag(m.home_team)}{" "}
                {m.home_team} – {m.away_team} {flag(m.away_team)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Veikkaus</Label>
          <select
            value={pick}
            onChange={(e) => setPick(e.target.value as "1" | "X" | "2")}
            className="w-24 bg-input border border-border rounded-md px-2 py-2 text-sm"
          >
            <option value="">—</option>
            <option value="1">1</option>
            <option value="X">X</option>
            <option value="2">2</option>
          </select>
        </div>
        <Button
          onClick={() => mut.mutate()}
          disabled={!userId || !matchId || !pick || mut.isPending}
        >
          {mut.isPending ? "Tallennetaan..." : "Tallenna"}
        </Button>
      </div>
    </section>
  );
}
