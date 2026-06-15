import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyFutures, submitFutures } from "@/lib/predictions.functions";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, ShieldAlert, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useState, useEffect } from "react";

export const Route = createFileRoute("/_authenticated/futures")({
  component: FuturesPage,
});

function FuturesPage() {
  const qc = useQueryClient();
  const fetchMyFutures = useServerFn(getMyFutures);
  const saveFutures = useServerFn(submitFutures);

  const { data: teams, isLoading: loadingTeams } = useQuery({
    queryKey: ["all-teams"],
    queryFn: async () => {
      const { data } = await supabase
        .from("teams")
        .select("name, group_code")
        .order("group_code")
        .order("name");
      return data ?? [];
    },
  });

  const { data: myPicks, isLoading: loadingPicks } = useQuery({
    queryKey: ["my-futures"],
    queryFn: () => fetchMyFutures(),
  });

  const [form, setForm] = useState<{
    winner: string;
    golden_boot: string;
    most_assists: string;
    semi1: string;
    semi2: string;
    semi3: string;
    semi4: string;
  }>({
    winner: "",
    golden_boot: "",
    most_assists: "",
    semi1: "",
    semi2: "",
    semi3: "",
    semi4: "",
  });

  useEffect(() => {
    if (myPicks) {
      setForm({
        winner: myPicks.winner ?? "",
        golden_boot: myPicks.golden_boot ?? "",
        most_assists: myPicks.most_assists ?? "",
        semi1: myPicks.semi_finalists?.[0] ?? "",
        semi2: myPicks.semi_finalists?.[1] ?? "",
        semi3: myPicks.semi_finalists?.[2] ?? "",
        semi4: myPicks.semi_finalists?.[3] ?? "",
      });
    }
  }, [myPicks]);

  const mut = useMutation({
    mutationFn: async () => {
      const semis = [form.semi1, form.semi2, form.semi3, form.semi4].filter(Boolean);
      await saveFutures({
        data: {
          winner: form.winner || undefined,
          golden_boot: form.golden_boot || undefined,
          most_assists: form.most_assists || undefined,
          semi_finalists: semis.length > 0 ? semis : undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Ennustukset tallennettu!");
      qc.invalidateQueries({ queryKey: ["my-futures"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loadingTeams || loadingPicks) return <div className="text-muted-foreground">Ladataan…</div>;

  const isLocked = myPicks?.locked ?? false;

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="text-primary w-6 h-6" /> Pre-Tournament Futures
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Valitse koko turnauksen parhaat ja voita massiiviset lisäpisteet Safe Scoreen. Ennustukset
          lukittuvat juuri ennen turnauksen avausottelua.
        </p>
      </div>

      {isLocked && (
        <div className="rounded-xl bg-accent/20 border border-accent p-4 flex gap-3 text-accent-foreground">
          <Lock className="w-5 h-5 shrink-0" />
          <div className="text-sm">
            <strong>Valinnat lukittu.</strong> Olet lukinnut Futures-valintasi, eikä niitä voi enää
            muuttaa.
          </div>
        </div>
      )}

      <div className="space-y-6">
        <section className="rounded-2xl border border-border/60 bg-card/70 p-6 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <Label className="text-lg font-bold">Maailmanmestari</Label>
              <p className="text-sm text-muted-foreground">+22 pistettä</p>
            </div>
          </div>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={form.winner}
            onChange={(e) => setForm({ ...form, winner: e.target.value })}
            disabled={isLocked || mut.isPending}
          >
            <option value="">-- Valitse voittaja --</option>
            {teams?.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
                {t.group_code ? ` (${t.group_code})` : ""}
              </option>
            ))}
          </select>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card/70 p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-lg font-bold">Maalikuningas (Golden Boot)</Label>
              <p className="text-sm text-muted-foreground">+16 pistettä</p>
              <Input
                placeholder="Kirjoita pelaajan nimi..."
                value={form.golden_boot}
                onChange={(e) => setForm({ ...form, golden_boot: e.target.value })}
                disabled={isLocked || mut.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-lg font-bold">Eniten syöttöjä</Label>
              <p className="text-sm text-muted-foreground">+13 pistettä</p>
              <Input
                placeholder="Kirjoita pelaajan nimi..."
                value={form.most_assists}
                onChange={(e) => setForm({ ...form, most_assists: e.target.value })}
                disabled={isLocked || mut.isPending}
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card/70 p-6 space-y-4">
          <div>
            <Label className="text-lg font-bold">Välieräjoukkueet (Top 4)</Label>
            <p className="text-sm text-muted-foreground">+5 pistettä per oikea joukkue (max +20)</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((num) => {
              const key = `semi${num}` as keyof typeof form;
              return (
                <select
                  key={num}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                  value={form[key] as string}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  disabled={isLocked || mut.isPending}
                >
                  <option value="">-- Valitse joukkue {num} --</option>
                  {teams?.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name}
                      {t.group_code ? ` (${t.group_code})` : ""}
                    </option>
                  ))}
                </select>
              );
            })}
          </div>
        </section>

        {!isLocked && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="lg" className="w-full sm:w-auto" disabled={mut.isPending}>
                {mut.isPending ? "Tallennetaan..." : "Tallenna ja lukitse ennustukset"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Haluatko varmasti lukita valintasi?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tämä toiminto on lopullinen. Et voi enää muuttaa Futures-ennustuksiasi
                  tallentamisen jälkeen. Olethan varma valinnoistasi?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Peruuta</AlertDialogCancel>
                <AlertDialogAction onClick={() => mut.mutate()}>
                  Kyllä, lukitse valinnat
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
