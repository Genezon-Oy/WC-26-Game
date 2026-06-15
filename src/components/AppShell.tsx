import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/dashboard", label: "Koti" },
  { to: "/fixtures", label: "Ottelut" },
  { to: "/results", label: "Tulokset" },
  { to: "/groups", label: "Lohkot" },
  { to: "/teams", label: "Joukkueet" },
  { to: "/veikkaa", label: "Veikkaa" },
  { to: "/futures", label: "Futures" },
  { to: "/leaderboard", label: "Tulostaulu" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const matches = useRouterState({ select: (s) => s.location.pathname });
  const [displayName, setDisplayName] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active || !data.user) return;
      const meta = data.user.user_metadata as { display_name?: string; username?: string };
      setDisplayName(meta.display_name || meta.username || data.user.email || "Pelaaja");
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      setIsAdmin(!!roles?.some((r) => r.role === "admin"));
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/60 backdrop-blur-md bg-background/70 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
          <Link to="/dashboard" className="flex items-center gap-2 font-bold tracking-tight">
            <Trophy className="w-5 h-5 text-accent" />
            <span className="text-foreground">
              WC&nbsp;<span className="text-primary">'26</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            {NAV.map((n) => {
              const active = matches.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
            {isAdmin && (
              <Link
                to="/admin"
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  matches.startsWith("/admin")
                    ? "bg-accent/20 text-accent"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                Ylläpito
              </Link>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline">{displayName}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {/* mobile nav */}
        <div className="md:hidden border-t border-border/60 overflow-x-auto">
          <div className="flex gap-1 px-4 py-2 text-xs whitespace-nowrap">
            {NAV.map((n) => {
              const active = matches.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`px-3 py-1.5 rounded-md ${
                    active ? "bg-primary/15 text-primary" : "text-muted-foreground"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
            {isAdmin && (
              <Link
                to="/admin"
                className={`px-3 py-1.5 rounded-md ${
                  matches.startsWith("/admin")
                    ? "bg-accent/20 text-accent"
                    : "text-muted-foreground"
                }`}
              >
                Ylläpito
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">{children}</main>
      <footer className="text-center text-xs text-muted-foreground py-6 border-t border-border/40">
        Data: openfootball &middot; football-data.org &middot; Veikkaukset lukittuvat alkupotkussa
      </footer>
    </div>
  );
}
