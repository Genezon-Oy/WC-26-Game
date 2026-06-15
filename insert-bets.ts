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
  console.log("Haetaan kaikki ottelut tietokannasta...");
  const { data: matches } = await supabase.from("matches").select("id, home_team, away_team");

  if (!matches) {
    console.error("Ei otteluita!");
    return;
  }

  const inserts = [];

  for (const username of TARGET_USERNAMES) {
    console.log(`Etsitään käyttäjä: ${username}...`);
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (!profile) {
      console.error(`Käyttäjää ${username} ei löytynyt! Skipataan.`);
      continue;
    }
    const userId = profile.id;
    console.log(`Käyttäjä löytyi: ${userId}`);

    for (const [home, away, pick] of RAW_BETS) {
      const match = matches.find(
        (m) =>
          normalize(m.home_team).includes(normalize(home).substring(0, 3)) &&
          normalize(m.away_team).includes(normalize(away).substring(0, 3)),
      );
      if (!match) {
        console.warn(`VAROITUS: Ottelua ${home} vs ${away} ei löytynyt! Tarkista kirjoitusasu.`);
        continue;
      }

      inserts.push({
        user_id: userId,
        match_id: match.id,
        pick: pick,
      });
    }
  }

  console.log(`Tallennetaan ${inserts.length} veikkausta...`);

  if (inserts.length > 0) {
    const { error } = await supabase
      .from("predictions")
      .upsert(inserts, { onConflict: "user_id, match_id" });
    if (error) {
      console.error("Virhe tallennuksessa:", error);
    } else {
      console.log("Kaikki veikkaukset tallennettu onnistuneesti!");
    }
  }
}

main().catch(console.error);
