import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LogOut,
  Trophy,
  Home,
  Calendar,
  PenLine,
  Medal,
  Menu,
  Settings,
  Users,
  LayoutGrid,
  CheckSquare,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

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

// Icons for the bottom mobile bar
const MOBILE_TABS = [
  { to: "/dashboard", label: "Koti", icon: Home },
  { to: "/fixtures", label: "Ottelut", icon: Calendar },
  { to: "/veikkaa", label: "Veikkaa", icon: PenLine },
  { to: "/leaderboard", label: "Taulu", icon: Medal },
] as const;

// Icons for the "More" menu
const MORE_TABS = [
  { to: "/results", label: "Tulokset", icon: CheckSquare },
  { to: "/groups", label: "Lohkot", icon: LayoutGrid },
  { to: "/teams", label: "Joukkueet", icon: Users },
  { to: "/futures", label: "Futures", icon: PenLine },
  { to: "/saannot", label: "Säännöt", icon: BookOpen },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const qc = useQueryClient();
  const matches = useRouterState({ select: (s) => s.location.pathname });
  const [displayName, setDisplayName] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active || !data.user) return;
      const meta = data.user.user_metadata as { display_name?: string; username?: string };
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", data.user.id)
        .maybeSingle();
      setDisplayName(
        profile?.display_name ||
          meta.display_name ||
          meta.username ||
          data.user.email?.split("@")[0] ||
          "Pelaaja",
      );
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
    qc.clear();
    router.navigate({ to: "/auth" });
  }

  // Close sheet when navigation changes
  useEffect(() => {
    setIsSheetOpen(false);
  }, [matches]);

  return (
    <div className="min-h-screen flex flex-col bg-background pb-16 md:pb-0">
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
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">{children}</main>
      <footer className="text-center text-xs text-muted-foreground py-6 border-t border-border/40 hidden md:block">
        Data: openfootball &middot; football-data.org &middot; Veikkaukset lukittuvat alkupotkussa
      </footer>

      {/* Mobile Bottom Tab Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-md border-t border-border/60 pb-safe">
        <div className="flex items-center justify-around h-16 px-2">
          {MOBILE_TABS.map((tab) => {
            const active = matches.startsWith(tab.to);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? "fill-primary/20" : ""}`} />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </Link>
            );
          })}

          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <button className="flex flex-col items-center justify-center w-full h-full space-y-1 text-muted-foreground hover:text-foreground transition-colors">
                <Menu className="w-5 h-5" />
                <span className="text-[10px] font-medium">Lisää</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl border-border/60 p-0">
              <div className="p-4 bg-background">
                <SheetHeader className="mb-4">
                  <SheetTitle className="text-left text-base">Kaikki sivut</SheetTitle>
                </SheetHeader>
                <div className="grid grid-cols-2 gap-2">
                  {MORE_TABS.map((tab) => {
                    const active = matches.startsWith(tab.to);
                    const Icon = tab.icon;
                    return (
                      <Link
                        key={tab.to}
                        to={tab.to}
                        className={`flex items-center gap-3 p-3 rounded-xl border ${
                          active
                            ? "bg-primary/10 border-primary/20 text-primary"
                            : "bg-card border-border/40 text-foreground"
                        }`}
                      >
                        <Icon className="w-5 h-5 opacity-70" />
                        <span className="text-sm font-medium">{tab.label}</span>
                      </Link>
                    );
                  })}
                  {isAdmin && (
                    <Link
                      to="/admin"
                      className={`flex items-center gap-3 p-3 rounded-xl border ${
                        matches.startsWith("/admin")
                          ? "bg-accent/10 border-accent/20 text-accent"
                          : "bg-card border-border/40 text-foreground"
                      }`}
                    >
                      <Settings className="w-5 h-5 opacity-70" />
                      <span className="text-sm font-medium">Ylläpito</span>
                    </Link>
                  )}
                </div>
                <div className="mt-6 pt-4 border-t border-border/40 text-center text-[10px] text-muted-foreground">
                  Veikkaukset lukittuvat alkupotkussa
                  <br />
                  Kirjautunut sisään: {displayName}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  );
}
