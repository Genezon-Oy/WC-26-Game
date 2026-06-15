import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const TARGET_USERNAMES = ["votoslogos", "vede"];

const RAW_BETS = [
  ["Mexico", "South Africa", "1"],
  ["South Korea", "Tshekki", "X"],
  ["Canada", "Bosnia", "X"],
  ["Usa", "Paraguay", "1"],
  ["Qatar", "Switzerland", "2"],
  ["Brazil", "Morocco", "X"],
  ["Haiti", "Scotland", "2"],
  ["Australia", "Turkey", "2"],
  ["Germany", "Curacaoi", "1"],
  ["Netherlands", "Japan", "1"],
];

const teamNameMap: Record<string, string> = {
  Tshekki: "Czech Republic",
  Bosnia: "Bosnia and Herzegovina",
  Curacaoi: "Curaçao",
  Curacao: "Curaçao",
};

function normalize(name: string) {
  const mapped = teamNameMap[name] || name;
  return mapped.toLowerCase().trim();
}

async function main() {
  const { data: matches } = await supabase.from("matches").select("id, home_team, away_team");
  if (!matches) return;

  const matchIds: string[] = [];
  for (const [home, away] of RAW_BETS) {
    const match = matches.find(
      (m) =>
        normalize(m.home_team).includes(normalize(home).substring(0, 3)) &&
        normalize(m.away_team).includes(normalize(away).substring(0, 3)),
    );
    if (match) matchIds.push(match.id);
  }

  for (const username of TARGET_USERNAMES) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (!profile) continue;

    console.log(`Poistetaan veikkaukset käyttäjältä ${username}...`);
    const { error } = await supabase
      .from("predictions")
      .delete()
      .eq("user_id", profile.id)
      .in("match_id", matchIds);

    if (error) console.error(error);
    else console.log(`Poistettiin onnistuneesti käyttäjältä ${username}`);
  }
}

main().catch(console.error);
