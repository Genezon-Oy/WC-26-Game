import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (active && data.user) router.navigate({ to: "/dashboard", replace: true });
    })();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) router.navigate({ to: "/dashboard", replace: true });
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const email = `${username.trim().toLowerCase()}@league.local`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("Väärä käyttäjänimi tai salasana");
      return;
    }
    router.navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Trophy className="w-6 h-6 text-accent" />
            <span>MM&nbsp;<span className="text-primary">'26</span> Veikkaus</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">Kirjaudu sisään kaveriporukan tunnuksilla</p>
        </div>
        <form
          onSubmit={handleLogin}
          className="space-y-4 bg-card/80 border border-border/60 rounded-2xl p-6 shadow-xl"
        >
          <div className="space-y-2">
            <Label htmlFor="username">Käyttäjänimi</Label>
            <Input
              id="username"
              autoComplete="username"
              required
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="esim. pekka"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Salasana</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Kirjaudutaan…" : "Kirjaudu sisään"}
          </Button>
        </form>
        <p className="text-center text-xs text-muted-foreground mt-6">
          Uudet tunnukset luo ylläpitäjä.
        </p>
      </div>
    </div>
  );
}